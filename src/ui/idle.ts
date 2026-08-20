/**
 * Ephemerality (spec §2): idle means NO non-stream /api request for fifteen
 * minutes. The caller decides what counts as activity — this class only
 * measures the gap since the last `touch()`. An open stream holding a
 * connection never calls `touch()`, so it cannot hold the server up; the
 * page's visibility-gated heartbeat (GET /api/ping, Task 16) is what keeps a
 * server alive exactly as long as a tab is actually visible.
 */
export const IDLE_MS = 15 * 60_000;

export class IdleMonitor {
  #idleMs: number;
  #onIdle: () => void;
  #lastTouch: number = Date.now();
  #timer: NodeJS.Timeout | null = null;

  constructor(idleMs: number, onIdle: () => void) {
    this.#idleMs = idleMs;
    this.#onIdle = onIdle;
  }

  touch(now: number = Date.now()): void {
    this.#lastTouch = now;
  }

  /** The gap must EXCEED the window: at exactly `idleMs` the server stays up. */
  expired(now: number = Date.now()): boolean {
    return now - this.#lastTouch > this.#idleMs;
  }

  /**
   * Polls rather than re-arming a precise timeout on every touch: touches
   * arrive per request and a heartbeat arrives every minute, so a coarse
   * check every `idleMs / 10` is exact enough. The exit is never EARLY —
   * `expired()` is what decides — and it is late by at most one poll
   * interval, which is 10% of the window for any window of 100ms or more
   * (production's 15-minute window polls every 90s). Below that the floor of
   * 10ms dominates, so the lateness is larger in proportion but the poll is
   * never a hot loop; short windows exist for tests, which pass a clock
   * rather than wait. The timer is unref'd so it can never be the thing
   * keeping the process alive.
   */
  start(): void {
    if (this.#timer) return;
    const interval = Math.max(10, Math.floor(this.#idleMs / 10));
    this.#timer = setInterval(() => {
      if (this.expired()) {
        this.stop();
        this.#onIdle();
      }
    }, interval);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
