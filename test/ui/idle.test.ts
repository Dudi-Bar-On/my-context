import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { IdleMonitor, IDLE_MS, MAX_IDLE_MS } from '../../src/ui/idle.ts';

/**
 * The timer tests drive `node:test`'s mock clock rather than sleeping, for the
 * reason the module exists: a monitor is a timer, and a test that waits out a
 * real timeout is both slow and eventually flaky — it asserts a deadline
 * against a machine that may be busy. Under a mocked clock the SAME assertions
 * are exact, so "never before the window" is a real assertion rather than a
 * margin. The one thing a mocked clock cannot show — that the poll timer does
 * not hold the process open — is measured in a child process at the bottom of
 * this file, which is the only place real time is involved.
 *
 * `enable({ apis: ['setInterval', 'Date'] })` mocks both, because `expired()`
 * reads `Date.now()` from inside the interval callback: mocking one without
 * the other would leave the monitor comparing a frozen clock to a moving one.
 * The monitor is therefore always constructed AFTER `enable()`, so that the
 * `#lastTouch` its constructor records comes from the mocked clock too.
 */

test('IDLE_MS is fifteen minutes — the number the spec fixes', () => {
  assert.equal(IDLE_MS, 15 * 60_000);
});

/**
 * Owner ruling 4: a window that cannot work is refused by the CONSTRUCTOR, so
 * every caller is covered rather than only the flag parser that happens to
 * exist. The defect these pin was measured, not imagined:
 * `new IdleMonitor(Number('abc'), …)` — NaN — made `expired()` return false
 * forever, so the server never idled out at all, and `start()` handed NaN to
 * `setInterval`, which Node coerces to 1ms with a `TimeoutNaNWarning`: a hot
 * poll that can never fire. A window of zero or less failed the other way,
 * expiring at the first poll. Neither case needs a clock to observe — the
 * constructor throws before any timer or any monitor exists, which is also
 * what these assert: a refusal that happened in `start()` instead would leave
 * `new IdleMonitor(NaN, …)` returning an object, and every case below fails.
 */
const REFUSED_WINDOWS: Array<{ label: string; value: number }> = [
  { label: "NaN — what a bare Number(flag) makes of `--idle-ms abc`", value: Number('abc') },
  { label: 'Infinity — expired() would be false forever, same as NaN', value: Infinity },
  { label: '-Infinity', value: -Infinity },
  { label: 'zero — expired 1ms after the touch, the opposite failure', value: 0 },
  { label: 'a negative window — already expired at the touch itself', value: -1 },
  // The annotation `idleMs: number` is erased at runtime, so these three do
  // reach the constructor from a JavaScript caller or through an `any`.
  { label: 'a non-number: the raw string a flag arrives as', value: '900000' as unknown as number },
  { label: 'a non-number: null', value: null as unknown as number },
  { label: 'a non-number: undefined, an option that was never set', value: undefined as unknown as number },
];

test('the constructor refuses a window that is not a positive, finite number of milliseconds', () => {
  for (const { label, value } of REFUSED_WINDOWS) {
    assert.throws(
      () => new IdleMonitor(value, () => {}),
      (err: unknown) => {
        assert.ok(err instanceof Error, `${label}: refused with something that is not an Error`);
        assert.match(
          err.message,
          /idle window must be a positive, finite number of milliseconds/,
          `${label}: threw, but not the refusal this class owes its caller`,
        );
        return true;
      },
      `${label}: accepted a window that cannot work — it must be refused in the constructor, ` +
      'not defaulted, and not left for whoever parses the flag',
    );
  }
});

/** Returns the refusal message, or fails if the window was accepted. */
function refusalMessage(value: number): string {
  try {
    new IdleMonitor(value, () => {});
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail(`the constructor accepted ${String(value)}, a window it must refuse`);
}

/**
 * The refusal is the whole user-facing message: Task 13 prints `err.message`
 * and exits, so whatever is thrown here IS what a user reading
 * `--idle-ms abc` sees. It therefore has to name the value it rejected and
 * which way that value fails, so that nobody writing Task 13 has to invent a
 * second wording for the same refusal.
 */
test('the refusal names the rejected value and which way it would have failed', () => {
  const message = refusalMessage(Number('abc'));
  assert.match(message, /^my_context: /, 'printed verbatim to a user, so it carries the product prefix');
  assert.match(
    message,
    /You passed NaN\b/,
    'JSON.stringify(NaN) is the string "null"; a refusal that said "null" would name a value nobody passed',
  );
  assert.match(message, /positive, finite number of milliseconds/, 'it says what would have been accepted');
  assert.match(
    message,
    /never idle out at all/,
    'it says which way this window fails — the server that outlives its window, not one that exits early',
  );
  assert.match(message, /refused rather than replaced by a default/, 'INV-nothing-is-dropped-silently, stated');

  assert.match(refusalMessage(Infinity), /You passed Infinity\b/);
  assert.match(refusalMessage(0), /You passed 0\./);
  assert.match(refusalMessage(-1), /You passed -1\./);
  assert.match(
    refusalMessage('900000' as unknown as number),
    /You passed "900000"/,
    'a string window is shown quoted, so it is not read as the number 900000',
  );
});

/**
 * Owner ruling B1, first of three: the window must be a WHOLE number of
 * milliseconds. `Number.isInteger(x) && x > 0` is the predicate `--limit`
 * (cli/commands/search.ts, cli/commands/audit.ts) and `--sessions`
 * (cli/commands/decay.ts) already apply to their own counts; the class applies
 * the same one, split across two throws because its two halves fail for
 * different reasons and each message here is the whole user-facing message.
 *
 * The defect is not a crash — it is silent rounding. `Date.now()` moves in
 * whole milliseconds, so the gap `expired()` measures against the ambient
 * clock is always whole, and for a whole gap `gap > 1.5` is the identical
 * test to `gap > 1`. A fractional window is therefore accepted and then used
 * as `Math.floor` of itself: a value accepted and ignored, which is
 * INV-nothing-is-dropped-silently. Below 1 it is worse — `0.5` behaves as a
 * window of `0`, the case the guard above refuses outright.
 */
const FRACTIONAL_WINDOWS: Array<{ label: string; value: number }> = [
  { label: '1.5 — the case the ruling names', value: 1.5 },
  { label: '0.5 — behaves as a window of 0, refused outright one guard above', value: 0.5 },
  { label: '5e-324 — the smallest positive double, accepted until ruling B1', value: Number.MIN_VALUE },
  { label: '900000.5 — a production window with a fractional tail', value: 900_000.5 },
  { label: 'a window that came out of a division: 15 minutes / 7', value: (15 * 60_000) / 7 },
];

test('the constructor refuses a fractional window — whole milliseconds or nothing', () => {
  for (const { label, value } of FRACTIONAL_WINDOWS) {
    assert.throws(
      () => new IdleMonitor(value, () => {}),
      (err: unknown) => {
        assert.ok(err instanceof Error, `${label}: refused with something that is not an Error`);
        assert.match(
          err.message,
          /idle window must be a positive whole number of milliseconds/,
          `${label}: threw, but not the refusal this class owes its caller`,
        );
        return true;
      },
      `${label}: accepted a window it can only honour rounded down — it must be refused, not ` +
      'floored behind the caller\'s back',
    );
  }
});

test('the fractional refusal names the value and the window it would silently have become', () => {
  const message = refusalMessage(1.5);
  assert.match(message, /^my_context: /, 'printed verbatim to a user, so it carries the product prefix');
  assert.match(message, /positive whole number of milliseconds/, 'it says what would have been accepted');
  assert.match(message, /You passed 1\.5\b/);
  assert.match(
    message,
    /a gap exceeding 1\.5 is the same test as a gap exceeding 1\b/,
    'it says which way this window fails — not a crash, but the window quietly becoming another one',
  );
  assert.match(
    refusalMessage(0.5),
    /a gap exceeding 0\.5 is the same test as a gap exceeding 0\b/,
    'below 1 the window it would become is 0, which is the failure the first guard exists to stop',
  );
});

/**
 * SUPERSEDED BOUNDARY, rewritten rather than deleted. Until ruling B1 this
 * test constructed `new IdleMonitor(Number.MIN_VALUE, …)` and recorded that
 * the smallest accepted window was the smallest positive double — the boundary
 * "non-positive is refused" literally draws, and all 8d18670 decided (its
 * commit message left "whether a sub-millisecond or fractional window should
 * also be refused" explicitly open). B1 closes it: whole numbers only, so
 * 5e-324 is refused along with everything else between 0 and 1, and the
 * smallest accepted window is 1ms. The move is recorded here so a later reader
 * sees a ruling, not a test quietly edited to match new code.
 *
 * 1ms is still not a sensible window and accepting it still costs nothing: the
 * 10ms poll floor governs it, so it cannot become a hot loop.
 */
test('the smallest accepted window is 1ms, and the poll floor still governs it', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });

  assert.throws(
    () => new IdleMonitor(Number.MIN_VALUE, () => {}),
    /positive whole number of milliseconds/,
    'the superseded boundary: the smallest positive double is no longer a window',
  );

  let fired = 0;
  const monitor = new IdleMonitor(1, () => { fired++; });
  monitor.touch();
  monitor.start();

  t.mock.timers.tick(9);
  assert.equal(fired, 0, 'expired since the second millisecond, but the 10ms floor still governs the poll');

  t.mock.timers.tick(1);
  assert.equal(fired, 1);

  monitor.stop();
});

/**
 * Owner ruling B1, second of three: a maximum, because without one
 * `Number.MAX_VALUE` passes — a window of roughly 10^295 years, which is the
 * `Infinity` the first guard just outlawed arriving through the front door.
 * It is not a philosophical point. Measured on this class before the guard:
 * `new IdleMonitor(Number.MAX_VALUE, …).start()` derives a poll delay of
 * 1.7976931348623158e+307 and Node answers
 * `TimeoutOverflowWarning: … does not fit into a 32-bit signed integer.
 * Timeout duration was set to 1.` — the hot poll that can never fire, the
 * exact failure NaN produced.
 *
 * Both ends of the boundary are pinned: the largest window still accepted, and
 * the smallest one refused.
 */
test('the largest accepted window is MAX_IDLE_MS, and one millisecond more is refused', () => {
  const atTheBound = new IdleMonitor(MAX_IDLE_MS, () => {});
  atTheBound.touch(0);
  assert.equal(atTheBound.expired(MAX_IDLE_MS), false, 'the largest accepted window is used as given, never clamped');
  assert.equal(atTheBound.expired(MAX_IDLE_MS + 1), true);

  assert.throws(
    () => new IdleMonitor(MAX_IDLE_MS + 1, () => {}),
    /idle window must be at most 86400000ms/,
    'the smallest refused window is one millisecond past the bound',
  );
  assert.throws(
    () => new IdleMonitor(Number.MAX_VALUE, () => {}),
    /idle window must be at most 86400000ms/,
    'the case the ruling names: MAX_VALUE is Infinity through the front door',
  );
});

/**
 * The bound is a number someone chose, so the reasoning it was chosen for is
 * asserted rather than left in a comment to rot. Two independent claims:
 * a day is 96 production windows (the argument the refusal makes to a user),
 * and the poll a day derives still fits `setInterval`. The second is the one
 * that would silently break: raise MAX_IDLE_MS past 10 x (2^31 - 1) and every
 * window above that point reintroduces the clamped-to-1ms hot poll the guard
 * exists to prevent, with no test noticing unless this one does.
 */
test('MAX_IDLE_MS is a day, and the poll it derives still fits setInterval\'s 32-bit delay', () => {
  assert.equal(MAX_IDLE_MS, 24 * 60 * 60_000, 'one day, stated in the milliseconds the flag speaks');
  assert.equal(MAX_IDLE_MS, 96 * IDLE_MS, 'and 96 production windows — the argument the refusal makes');

  const TIMEOUT_MAX = 2 ** 31 - 1;
  const widestPoll = Math.floor(MAX_IDLE_MS / 10);
  assert.ok(
    widestPoll <= TIMEOUT_MAX,
    `a window of ${MAX_IDLE_MS}ms polls every ${widestPoll}ms, past setInterval's ${TIMEOUT_MAX}ms ` +
    'ceiling — Node would clamp that poll to 1ms with a TimeoutOverflowWarning, which is how NaN failed',
  );
  assert.ok(MAX_IDLE_MS < 10 * TIMEOUT_MAX, 'the bound sits below the overflow point, not on it');
});

test('the maximum refusal names the value and defends the bound it enforces', () => {
  const message = refusalMessage(Number.MAX_VALUE);
  assert.match(message, /^my_context: /, 'printed verbatim to a user, so it carries the product prefix');
  assert.match(
    message,
    /at most 86400000ms \(24 hours\)/,
    'the bound is stated both in the units the flag speaks and in a unit a reader can check',
  );
  assert.match(message, /You passed 1\.7976931348623157e\+308\b/);
  assert.match(
    message,
    /Infinity refused above arriving as a finite number/,
    'it says which way this window fails — the server that outlives its window, not one that exits early',
  );
  assert.match(
    message,
    /TimeoutOverflowWarning/,
    'and that the failure is measured, not merely disapproved of',
  );
  assert.match(
    message,
    /96 times production's fifteen-minute window/,
    'the bound is defended in the message, not asserted — a reader can disagree with a stated reason',
  );

  assert.match(refusalMessage(MAX_IDLE_MS + 1), /You passed 86400001\./);
});

/**
 * Owner ruling B1, third of three: `onIdle` is validated in the CONSTRUCTOR.
 * Measured before the guard: `new IdleMonitor(1000, undefined)` constructed
 * fine, and one idle window later the poll threw
 * `TypeError: this.#onIdle is not a function` from
 * `at Timeout.<anonymous> (…/src/ui/idle.ts:109) / at listOnTimeout
 * (node:internal/timers) / at process.processTimers` — three frames, none of
 * them the caller that built the monitor. Nothing catches a throw from a timer
 * callback, and `stop()` has already run by the time it happens, so the clean
 * exit the callback existed to perform becomes an uncaught exception instead.
 *
 * The same argument that put the window check here: the invariant belongs
 * where every caller meets it, not where the failure happens to surface. What
 * these assert is that it is the constructor doing the refusing — a check that
 * moved into `start()` would leave `new IdleMonitor(1000, undefined)`
 * returning an object, and every case below fails.
 */
const REFUSED_CALLBACKS: Array<{ label: string; value: unknown }> = [
  { label: 'undefined — the case the ruling names', value: undefined },
  { label: 'null', value: null },
  { label: 'a string: the name of a function rather than the function', value: 'exit' },
  { label: 'an object', value: {} },
  { label: 'a number', value: 0 },
  { label: 'a boolean', value: false },
];

test('the constructor refuses an onIdle that is not a function, before any monitor exists', () => {
  for (const { label, value } of REFUSED_CALLBACKS) {
    let escaped: unknown = 'nothing was constructed';
    assert.throws(
      () => { escaped = new IdleMonitor(1_000, value as () => void); },
      (err: unknown) => {
        assert.ok(err instanceof Error, `${label}: refused with something that is not an Error`);
        assert.match(
          err.message,
          /idle callback must be a function/,
          `${label}: threw, but not the refusal this class owes its caller`,
        );
        return true;
      },
      `${label}: accepted a callback that cannot be called — it must be refused in the constructor, ` +
      'where every caller meets it, not in the timer callback that would have called it',
    );
    assert.equal(
      escaped,
      'nothing was constructed',
      `${label}: a monitor escaped the constructor, so the refusal is no longer in it`,
    );
  }

  // The shape this actually arrives in: `onIdle: () => void` is a type-stripped
  // annotation with no runtime force, so a JavaScript caller — or an `any`
  // inside a TypeScript one — can simply not pass it at all.
  const Erased = IdleMonitor as unknown as new (idleMs: number) => IdleMonitor;
  assert.throws(
    () => new Erased(1_000),
    /idle callback must be a function/,
    'the second argument omitted entirely, which no compiler is present to prevent at runtime',
  );
});

/** Returns the callback refusal message, or fails if the callback was accepted. */
function callbackRefusalMessage(onIdle: unknown): string {
  try {
    new IdleMonitor(1_000, onIdle as () => void);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('the constructor accepted a callback it must refuse');
}

test('the callback refusal names what was passed and where that failure would otherwise surface', () => {
  const message = callbackRefusalMessage(undefined);
  assert.match(message, /^my_context: /, 'printed verbatim to a user, so it carries the product prefix');
  assert.match(message, /idle callback must be a function/, 'it says what would have been accepted');
  assert.match(message, /You passed undefined\./);
  assert.match(
    message,
    /setInterval callback one whole idle window later/,
    'it says WHERE the failure would otherwise surface, which is the whole reason the check is here',
  );
  assert.match(message, /uncaught/, 'and that nothing would catch it there');

  assert.match(
    callbackRefusalMessage(null),
    /You passed null\./,
    'typeof null is "object"; reporting it as one would describe the single value a reader cannot infer back',
  );
  assert.match(callbackRefusalMessage('exit'), /You passed a string\./);
  assert.match(callbackRefusalMessage({}), /You passed an object\./);
  assert.match(callbackRefusalMessage(0), /You passed a number\./);
  assert.match(callbackRefusalMessage(false), /You passed a boolean\./);

  // Reported by type rather than by `String(value)`, and this is why: an
  // object whose own `toString` throws would otherwise throw from inside the
  // construction of this very error, replacing a clear refusal with someone
  // else's TypeError raised from a line that was trying to explain itself.
  const hostile = { toString() { throw new Error('toString says no'); } };
  assert.match(
    callbackRefusalMessage(hostile),
    /You passed an object\./,
    'the refusal must survive a value that cannot be stringified',
  );
});

/** A valid window is used as given: the guard refuses, it never clamps or substitutes. */
test('an accepted window is kept exactly as passed', () => {
  const monitor = new IdleMonitor(1, () => {});
  monitor.touch(0);
  assert.equal(monitor.expired(1), false, 'still a 1ms window — not raised to the 10ms poll floor');
  assert.equal(monitor.expired(2), true);

  const production = new IdleMonitor(IDLE_MS, () => {});
  production.touch(0);
  assert.equal(production.expired(IDLE_MS), false);
  assert.equal(production.expired(IDLE_MS + 1), true, 'the fifteen-minute window survives the guard unchanged');
});

test('expired() is false inside the window and true past it, measured from the last touch', () => {
  const monitor = new IdleMonitor(1_000, () => {});
  monitor.touch(0);
  assert.equal(monitor.expired(999), false);
  assert.equal(monitor.expired(1_001), true);
  monitor.touch(1_000);
  assert.equal(monitor.expired(1_999), false);
  assert.equal(monitor.expired(2_001), true);
});

/**
 * The boundary the window's arithmetic turns on, and the one an implementation
 * can flip without any other test noticing: at EXACTLY `idleMs` since the last
 * touch the gap has not yet exceeded the window, so the server stays up.
 */
test('exactly one window since the last touch is not yet expired', () => {
  const monitor = new IdleMonitor(1_000, () => {});
  monitor.touch(0);
  assert.equal(monitor.expired(1_000), false, 'the gap must exceed the window, not merely reach it');
  assert.equal(monitor.expired(1_001), true);
});

test('start() fires onIdle once the window passes with no touch, never before, and never twice', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(1_000, () => { fired++; });
  monitor.touch();
  monitor.start();

  t.mock.timers.tick(1_000);
  assert.equal(fired, 0, 'the exit is never early: at exactly the window the server is still up');

  // One poll interval (idleMs / 10) later, so this also pins the lateness
  // bound the module documents: at most 10% past the window, for any window
  // of 100ms or more.
  t.mock.timers.tick(100);
  assert.equal(fired, 1, 'the exit is at most one poll interval late');

  t.mock.timers.tick(60 * 60_000);
  assert.equal(fired, 1, 'a monitor that has fired has stopped itself; onIdle is a one-shot');

  monitor.stop();
});

test('a touch inside the window postpones the exit — that is how a heartbeat holds a server up', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(1_000, () => { fired++; });
  monitor.touch();
  monitor.start();

  for (let i = 0; i < 5; i++) {
    t.mock.timers.tick(900);
    monitor.touch();
  }
  assert.equal(fired, 0, 'four and a half windows of elapsed time, none of it idle');

  t.mock.timers.tick(1_100);
  assert.equal(fired, 1, 'one window with no touch, and it exits');

  monitor.stop();
});

/**
 * `start()` is called once by the server, but a second call must not arm a
 * SECOND interval: the first one would be unreachable by `stop()` and would
 * outlive it, which is the leak this class is supposed to make impossible.
 * A duplicate timer is visible as a duplicate `onIdle`.
 */
test('start() twice arms one timer, not two', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(1_000, () => { fired++; });
  monitor.touch();
  monitor.start();
  monitor.start();

  t.mock.timers.tick(2_000);
  assert.equal(fired, 1, 'a second start() must not arm a second timer');

  monitor.stop();
});

test('stop() cancels the pending exit, is safe before start(), and is safe twice', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(1_000, () => { fired++; });

  monitor.stop();
  monitor.touch();
  monitor.start();
  monitor.stop();
  monitor.stop();

  t.mock.timers.tick(60 * 60_000);
  assert.equal(fired, 0, 'a stopped monitor never fires');
});

/**
 * A window shorter than the poll floor must not turn the monitor into a hot
 * loop — `Math.max(10, …)` is what stops `setInterval(fn, 0)`. Asserted as
 * behaviour rather than by reading the interval back: with a 1ms window
 * everything past 1ms is expired, so the only thing that can still delay the
 * exit is the poll floor itself.
 */
test('a window shorter than the poll floor still polls no faster than the floor', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(1, () => { fired++; });
  monitor.touch();
  monitor.start();

  t.mock.timers.tick(9);
  assert.equal(fired, 0, 'expired long since, but the monitor has not polled — it is not a hot loop');

  t.mock.timers.tick(1);
  assert.equal(fired, 1);

  monitor.stop();
});

/**
 * The one property real time has to show, and the whole reason the interval is
 * unref'd: a started monitor must not be the thing keeping a process alive.
 * The child imports the module, starts a monitor with an hour-long window and
 * then falls off the end of its script; with the `unref()` it exits at once,
 * without it the event loop stays alive for the full hour and `spawnSync`'s
 * timeout kills it instead — status `null`, signal `SIGTERM`.
 *
 * The green path costs one node startup; only a regression pays the timeout.
 */
test('a started monitor does not hold the process open — the poll timer is unref\'d', () => {
  const moduleHref = pathToFileURL(
    path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'idle.ts'),
  ).href;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', [
      `import { IdleMonitor } from ${JSON.stringify(moduleHref)};`,
      `const monitor = new IdleMonitor(60 * 60_000, () => { process.stdout.write('FIRED'); });`,
      `monitor.touch();`,
      `monitor.start();`,
      `process.stdout.write('STARTED');`,
    ].join('\n')],
    { timeout: 10_000, encoding: 'utf8' },
  );

  assert.equal(child.stdout, 'STARTED', child.stderr || 'the child did not reach the end of its script');
  assert.equal(child.signal, null, 'the process was still alive at the timeout: the poll timer is holding it open');
  assert.equal(child.status, 0);
});
