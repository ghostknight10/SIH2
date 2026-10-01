"""Session clock (pipeline step 5).

Scenario time ("T+2:00") is separate from wall time so it can be paused. Everything
time-related in a session (timed scenario events, message `deliver_at`, order
timestamps) uses this clock. Because `deliver_at` is expressed in scenario seconds,
pausing the clock automatically freezes pending deliveries: no times need shifting
on resume.
"""
import time
from typing import Callable


class ClockError(Exception):
    pass


class SessionClock:
    def __init__(self, time_source: Callable[[], float] = time.monotonic):
        self._time = time_source
        self._started = False
        self._running = False
        self._elapsed = 0.0   # scenario seconds accumulated before the current run
        self._since = 0.0     # time_source() value when the current run began

    @property
    def started(self) -> bool:
        return self._started

    @property
    def running(self) -> bool:
        return self._running

    @property
    def paused(self) -> bool:
        return self._started and not self._running

    def start(self) -> None:
        if self._started:
            raise ClockError("clock already started")
        self._started = self._running = True
        self._since = self._time()

    def pause(self) -> None:
        if self._running:
            self._elapsed += self._time() - self._since
            self._running = False

    def resume(self) -> None:
        if self._started and not self._running:
            self._running = True
            self._since = self._time()

    def now(self) -> float:
        """Scenario seconds elapsed (0.0 before start, frozen while paused)."""
        if self._running:
            return self._elapsed + (self._time() - self._since)
        return self._elapsed
