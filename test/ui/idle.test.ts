import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { IdleMonitor, IDLE_MS } from '../../src/ui/idle.ts';

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
 * The accepted side of the boundary the ruling actually draws. "Non-positive
 * is refused" means the smallest accepted window is the smallest positive
 * double, not 1ms and not 100ms — recorded here so a later reader can see
 * what was decided rather than infer it. It is not a sensible window, and
 * accepting it costs nothing: the 10ms poll floor still governs, so even this
 * cannot become a hot loop.
 */
test('the smallest accepted window is any positive number, and the poll floor still holds', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  let fired = 0;
  const monitor = new IdleMonitor(Number.MIN_VALUE, () => { fired++; });
  monitor.touch();
  monitor.start();

  t.mock.timers.tick(9);
  assert.equal(fired, 0, 'expired since the first millisecond, but the 10ms floor still governs the poll');

  t.mock.timers.tick(1);
  assert.equal(fired, 1);

  monitor.stop();
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
