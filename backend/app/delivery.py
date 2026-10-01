"""Background delivery scheduler (pipeline step 9).

Deliveries are timestamped in scenario-clock seconds.  The scheduler sleeps until the
next due entry, so a paused session naturally freezes the queue without rewriting every
pending timestamp.  Messages that become due while a player is offline are moved to a
small per-recipient holding list and flushed immediately after that player's reconnect
snapshot.
"""
import asyncio
import contextlib
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .degradation import Delivery
    from .sessions import SessionManager, SessionState

log = logging.getLogger("sih.delivery")


class DeliveryScheduler:
    def __init__(self, manager: "SessionManager", state: "SessionState", tick_s: float = 0.25):
        self.manager = manager
        self.state = state
        self.tick_s = tick_s
        self._wake = asyncio.Event()
        self.task: asyncio.Task | None = None
        self._stopping = False

    def start(self) -> None:
        if self.task is None or self.task.done():
            self._stopping = False
            self.task = asyncio.create_task(self._loop(), name=f"delivery-{self.state.id}")

    def notify(self) -> None:
        self._wake.set()

    async def stop(self) -> None:
        self._stopping = True
        self._wake.set()
        task, self.task = self.task, None
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def _wait(self, timeout: float | None = None) -> None:
        if self._wake.is_set():
            self._wake.clear()
            return
        if timeout is None:
            await self._wake.wait()
            self._wake.clear()
            return
        try:
            await asyncio.wait_for(self._wake.wait(), timeout=max(0.001, timeout))
        except asyncio.TimeoutError:
            pass
        finally:
            self._wake.clear()

    async def _loop(self) -> None:
        while not self._stopping and self.state.status != "ended":
            try:
                await self._drain_due()
                if self.state.status == "ended":
                    break
                if self.state.paused:
                    await self._wait()
                    continue
                if not self.state.delivery_heap:
                    await self._wait()
                    continue
                delay = max(0.0, self.state.delivery_heap[0][0] - self.state.clock_s)
                await self._wait(min(delay, self.tick_s) if delay > self.tick_s else delay)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("delivery scheduler failed in session %s", self.state.id)
                await asyncio.sleep(self.tick_s)

    async def _drain_due(self) -> None:
        if self.state.paused:
            return
        import heapq
        now = self.state.clock_s
        while self.state.delivery_heap and self.state.delivery_heap[0][0] <= now + 1e-9:
            _, _, delivery = heapq.heappop(self.state.delivery_heap)
            conn = self.manager.connection_for_username(self.state, delivery.recipient)
            if conn is None or not conn.ready:
                self.state.offline_deliveries.setdefault(delivery.recipient, []).append(delivery)
                continue
            await self.manager.deliver_one(self.state, conn, delivery)
