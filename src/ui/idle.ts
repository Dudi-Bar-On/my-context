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

  /**
   * A window that cannot work is refused HERE, at construction, and never
   * absorbed. The window is the only thing this class is: `expired()` compares
   * against it and `start()` derives the poll interval from it. So a `NaN`
   * window makes every expiry comparison false and the server never idles out
   * at all, while `setInterval` gets a `NaN` delay that Node coerces to 1ms
   * with a `TimeoutNaNWarning` — a hot poll that can never fire. `Infinity`
   * fails the same way. Zero or negative fails the other way, expiring at the
   * first poll after `start()`. NaN is not a hypothetical: a bare
   * `Number(flag)` makes it out of `--idle-ms abc`, and Task 13 is planned to
   * parse the flag exactly that way. It is also the direction ephemerality
   * forbids — a server that outlives its window is the defect this class
   * exists to prevent — so neither direction is left to the caller to get
   * right.
   *
   * It is the CONSTRUCTOR that refuses, not whatever parses the flag, so the
   * invariant covers every caller rather than only the caller that happens to
   * be written first. Nothing constructs an `IdleMonitor` yet; when
   * `startUiServer` and its `--idle-ms` flag arrive (Task 13), and for
   * anything written after them, this one check is what they inherit.
   * Validating at the flag alone would leave the class loaded for the next
   * caller.
   *
   * It throws rather than falling back to `IDLE_MS`, because a value accepted
   * and ignored is exactly `INV-nothing-is-dropped-silently`.
   *
   * `Number.isFinite` does not coerce, so a non-number — the raw string a flag
   * arrives as, `null`, `undefined` — fails it too. That matters because
   * `idleMs: number` is a type-stripped annotation with no runtime force: a
   * JavaScript caller, or an `any` inside a TypeScript one, reaches this line
   * with whatever it likes.
   *
   * **The thrown message is the whole user-facing message.** It names the
   * value it rejected and which way that value would have failed, which is
   * everything the downstream error needs to say — so Task 13's `--idle-ms`
   * handling should let it through unchanged (the plan's entry point already
   * prints `err.message` and exits 1) rather than inventing a second wording
   * for the same refusal. A malformed flag must refuse to start and say why;
   * this is the why.
   */
  constructor(idleMs: number, onIdle: () => void) {
    if (!Number.isFinite(idleMs) || idleMs <= 0) {
      // The declared type is erased, so the rejected value may not be a
      // number at all; a string is shown quoted so `"900000"` is not read as
      // the number. `JSON.stringify` is deliberately NOT used for the number
      // case — it renders both `NaN` and `Infinity` as the string `null`,
      // which would name a value that was never passed.
      const rejected: unknown = idleMs;
      const shown = typeof rejected === 'string' ? JSON.stringify(rejected) : String(rejected);
      const hint = Number.isNaN(idleMs)
        ? ' NaN is what Number() makes of text that is not a number, so check the value that was supplied.'
        : '';
      throw new Error(
        `my_context: the idle window must be a positive, finite number of milliseconds. ` +
        `You passed ${shown}.${hint} It is refused rather than replaced by a default: NaN and ` +
        `Infinity make every expiry comparison false, so the server would never idle out at ` +
        `all, and a window of zero or less makes it exit at the first poll after start().`,
      );
    }
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
   * rather than wait. The constructor has already refused a window that is
   * not positive and finite, so this arithmetic cannot hand `setInterval` a
   * `NaN` or `Infinity` delay. The timer is unref'd so it can never be the
   * thing keeping the process alive.
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
