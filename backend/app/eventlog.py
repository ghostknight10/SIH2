"""Central append-only event logger.

The logger exposes the same queue/writer interface used by the async runtime while
keeping writes immediately visible to the rest of the MVP. This is intentional for
SQLite: it prevents an AAR request immediately after a command from observing a
half-flushed log. The queue is still available for a later Postgres/batched writer.
"""
import asyncio
import logging
from dataclasses import dataclass
from typing import Any

log = logging.getLogger("sih.eventlog")


@dataclass(frozen=True)
class EventRecord:
    session_id: str
    type: str
    actor: str | None
    payload: dict[str, Any]


class EventWriter:
    def __init__(self, db):
        self.db = db
        self.queue: asyncio.Queue[EventRecord] = asyncio.Queue()
        self.task: asyncio.Task | None = None

    def start(self) -> None:
        if self.task is None or self.task.done():
            try:
                self.task = asyncio.create_task(self._drain(), name="event-writer")
            except RuntimeError:
                self.task = None

    def put(self, session_id: str, type: str, actor: str | None, payload: dict) -> None:
        # Immediate persistence is part of the MVP contract: callers can request the
        # AAR immediately after a command and see every event. The queue receives a
        # lightweight copy for observability/future batched persistence.
        self.db.insert_event(session_id, type, actor, payload)
        try:
            self.queue.put_nowait(EventRecord(session_id, type, actor, payload))
            self.start()
        except RuntimeError:
            pass

    async def flush(self) -> None:
        if self.task is not None:
            await self.queue.join()

    async def stop(self) -> None:
        if self.task is not None:
            await self.flush()
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def _drain(self) -> None:
        while True:
            item = await self.queue.get()
            # The DB write already happened synchronously; the worker drains the
            # queue so the interface remains compatible with a true async writer.
            self.queue.task_done()
