/**
 * Ephemerality (spec §2): idle means NO non-stream /api request for this long.
 * The caller decides what counts as activity — this class only measures the gap
 * since the last `touch()`. An open stream holding a connection never calls
 * `touch()`, so it cannot hold the server up; the page's visibility-gated
 * heartbeat (GET /api/ping, Task 16) is what keeps a server alive exactly as
 * long as a tab is actually visible.
 *
 * ── WHY THIS IS EIGHT HOURS AND NOT FIFTEEN MINUTES ───────────────────────
 *
 * Owner ruling, 2026-08-23, after the fifteen-minute window reaped a server
 * three separate times before they could open it: *"the timeout should be much
 * longer."*
 *
 * Fifteen minutes was the right number for the case §2.3 names — a forgotten
 * background tab must not hold a process open forever — and the wrong number
 * for every other case, because it measures the wrong thing. **An open tab is
 * already safe: its heartbeat touches `/api/ping` once a minute while visible,
 * so a tab someone is actually using never reaches this window at all.** What
 * the window really governs is a server nobody has open yet, and fifteen
 * minutes is far shorter than the gap between starting one and walking back to
 * it.
 *
 * So the failure mode it produced was never the one it was designed against. It
 * was: start the server, finish the work, hand over the URL, and find the
 * process gone — reported each time as "the page is blank", investigated as a
 * fresh defect, and answered by the log's own line, unread until the third
 * occurrence.
 *
 * Eight hours is a working day: long enough that a server started in the
 * morning is there in the afternoon, and short enough that a machine left
 * running overnight does not accumulate them. It is still ephemeral — it still
 * exits on its own, and it still dies with the terminal. `--idle-ms` moves it in
 * either direction, and `MAX_IDLE_MS` below still bounds it at a day.
 */
export const IDLE_MS = 8 * 60 * 60_000;

/**
 * The longest window the constructor will accept: one day.
 *
 * A maximum is not a matter of taste — without one, `Number.MAX_VALUE` is the
 * `Infinity` the constructor already refuses, arriving through the front door.
 * Measured: `new IdleMonitor(Number.MAX_VALUE, …).start()` derives a poll delay
 * of `1.7976931348623158e+307`, which does not fit `setInterval`'s 32-bit
 * signed delay, so Node clamps it to 1ms and prints a `TimeoutOverflowWarning`.
 * That is the same hot poll that can never fire that NaN produced, and it
 * begins at any window past `10 * (2 ** 31 - 1)` = 21_474_836_470ms (~248
 * days), because `start()` polls at `idleMs / 10`.
 *
 * The bound is a day rather than that overflow point because the overflow point
 * is where the TIMER breaks, and a day is where the WINDOW stops meaning
 * anything: this class exists to make the server ephemeral (spec §2), and a
 * server that sits idle for a day has outlived the session, very likely the
 * machine's uptime, and any reason it was started. A day is three times
 * the eight-hour default — headroom for a session that genuinely runs long,
 * and four orders of magnitude below anything that breaks — so it bounds the
 * mistake without bounding a real use. It is stated in the units the flag speaks
 * (milliseconds of idleness), not in the units `setInterval` happens to use.
 */
export const MAX_IDLE_MS = 24 * 60 * 60_000;

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
   * **A fractional window is refused too, and rounding is the reason.** The
   * real clock moves in whole milliseconds, so the gap `expired()` measures
   * against the ambient `Date.now()` is always whole, and for a whole gap
   * `gap > 1.5` is the same test as `gap > 1`. A fractional window is
   * therefore indistinguishable from `Math.floor` of itself: accepting `1.5`
   * means accepting a value and silently using `1`, which is
   * `INV-nothing-is-dropped-silently` with extra steps. `--limit`
   * (cli/commands/search.ts, cli/commands/audit.ts) and `--sessions`
   * (cli/commands/decay.ts) already take `Number.isInteger(x) && x > 0`; this
   * is that same predicate. It is split across two throws rather than written
   * as one condition because the two halves fail for different reasons and
   * each message here is the whole user-facing message — the `x > 0` half is
   * the guard directly above, so repeating it below would be a condition
   * nothing can reach.
   *
   * **A window above `MAX_IDLE_MS` is refused as well**, for the reason given
   * on that constant: unbounded above, `Number.MAX_VALUE` reproduces the
   * `Infinity` failure this constructor was written to stop, and reproduces it
   * as a value that passes every check above.
   *
   * **`onIdle` is checked here for the same reason `idleMs` is.** Left to the
   * poll, a callback that is not a function throws
   * `this.#onIdle is not a function` from inside a `setInterval` callback one
   * whole idle window after the mistake — measured: the stack names this file
   * and `node:internal/timers`, and nothing else, so the caller that built the
   * monitor appears nowhere in it. Nothing catches it either, and `stop()` has
   * already run by then, so the clean exit the callback existed to perform is
   * replaced by an uncaught exception. The invariant belongs where every
   * caller meets it, not where the failure happens to surface.
   *
   * **Each thrown message is the whole user-facing message.** It names the
   * value it rejected and which way that value would have failed, which is
   * everything the downstream error needs to say — so Task 13's `--idle-ms`
   * handling should let it through unchanged (the plan's entry point already
   * prints `err.message` and exits 1) rather than inventing a second wording
   * for the same refusal. That holds for all four refusals below, not only the
   * first. A malformed flag must refuse to start and say why; this is the why.
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
    // Past this point `idleMs` is a finite number greater than zero, so the
    // quoting dance above is not repeated below: a string, `null` and
    // `undefined` have all already been refused, and `String` of a number is
    // unambiguous.
    if (!Number.isInteger(idleMs)) {
      throw new Error(
        `my_context: the idle window must be a positive whole number of milliseconds. ` +
        `You passed ${String(idleMs)}. A fractional window is refused rather than rounded down, ` +
        `because rounding down is exactly what would otherwise happen without saying so: the real ` +
        `clock moves in whole milliseconds, so the gap is always whole and a gap exceeding ` +
        `${String(idleMs)} is the same test as a gap exceeding ${String(Math.floor(idleMs))} — ` +
        `the window you would get, not the one you asked for.`,
      );
    }
    if (idleMs > MAX_IDLE_MS) {
      throw new Error(
        `my_context: the idle window must be at most ${MAX_IDLE_MS}ms (24 hours). ` +
        `You passed ${String(idleMs)}. A window this long is the Infinity refused above arriving ` +
        `as a finite number: the server would outlive the session, the machine's uptime and any ` +
        `reason it was started, which is the direction ephemerality forbids. It is not merely ` +
        `unwise — past 21474836470ms the poll derived from it no longer fits setInterval's 32-bit ` +
        `delay, so Node clamps that poll to 1ms with a TimeoutOverflowWarning: the same hot poll ` +
        `that can never fire that NaN produced. The bound is a day, not that overflow point, ` +
        `because a day is already three times the eight-hour default — longer than any ` +
        `session needs, and far less than anything that breaks.`,
      );
    }
    if (typeof onIdle !== 'function') {
      // Reported by `typeof` rather than by value: what is wrong with it is
      // its type, and `String(value)` on an object whose own `toString` throws
      // would throw from inside the construction of this very error. `null`
      // is named as itself because `typeof null` is `'object'`, which would
      // describe the one value a reader is least likely to guess from it.
      const kind = onIdle === null || onIdle === undefined
        ? String(onIdle)
        : `${/^[aeiou]/.test(typeof onIdle) ? 'an' : 'a'} ${typeof onIdle}`;
      throw new Error(
        `my_context: the idle callback must be a function. You passed ${kind}. It is refused here, ` +
        `at construction, for the same reason the window is: the invariant belongs where every ` +
        `caller meets it. Left to the poll it throws "this.#onIdle is not a function" from inside ` +
        `a setInterval callback one whole idle window later — uncaught, on a stack that names ` +
        `idle.ts and node:internal/timers but not the caller that built the monitor — and by then ` +
        `stop() has already run, so the clean exit this callback exists to perform is replaced by ` +
        `an uncaught exception.`,
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
   * not positive and finite, and no larger than `MAX_IDLE_MS`, so this
   * arithmetic cannot hand `setInterval` a `NaN` or `Infinity` delay, nor one
   * past its 32-bit ceiling: the widest delay this can now produce is
   * `MAX_IDLE_MS / 10` = 8_640_000ms, well inside `2 ** 31 - 1`. The timer is unref'd so it can never be the
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
