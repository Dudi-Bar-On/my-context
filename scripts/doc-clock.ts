/**
 * Pins the calendar day of a documented example's child process.
 *
 * Loaded with `node --import` by `runExample`, never by the CLI itself: this
 * module exists only so that generating a documentation block twice on two
 * different days produces the same bytes. Without it, every command that
 * stamps or prints a date — `mycontext examples <category>` renders
 * `valid_from` with the day it ran — writes today's date into the
 * documentation, and `test/docs/examples.test.ts` goes red the moment the
 * clock passes midnight, with nothing in the repository having changed.
 *
 * The clock is SHIFTED, not stopped. `Date.now()` keeps advancing at the
 * normal rate; only its origin moves, so the pinned instant is what the
 * process believes "now" was when it started. A stopped clock would make any
 * `while (Date.now() < deadline)` in the code under test spin forever —
 * `src/ingest/lock.ts` has exactly that shape — and a documentation harness
 * must not be able to hang the command it is documenting. The pin is at
 * midday UTC, so the twelve hours of headroom on either side are far more
 * than a documented command's runtime and the day cannot roll over mid-run.
 *
 * The instant comes from `MYCONTEXT_DOC_CLOCK` and a missing or unparseable
 * value throws. It is deliberately not defaulted: a preload that silently did
 * nothing would leave the real clock in place, and the generated block would
 * be correct on the day it was generated and stale the next — the exact
 * failure this module removes, reintroduced invisibly.
 */
const iso = process.env.MYCONTEXT_DOC_CLOCK;
if (iso === undefined || iso === '') {
  throw new Error(
    'my_context: doc-clock.ts was preloaded without MYCONTEXT_DOC_CLOCK. It pins the ' +
    'calendar day of a documented example and has nothing to pin it to.',
  );
}
const pinned = Date.parse(iso);
if (Number.isNaN(pinned)) {
  throw new Error(`my_context: MYCONTEXT_DOC_CLOCK is not a parseable instant: ${iso}`);
}

const RealDate = Date;
const shift = pinned - RealDate.now();
const shifted = (): number => RealDate.now() + shift;

/**
 * A `Proxy` rather than a subclass, so `Date` keeps its own identity: the
 * prototype, `instanceof`, and every static other than `now` are the real
 * ones, and code that reaches for `Date.parse` or `Date.UTC` inside the CLI
 * gets the real implementation.
 */
globalThis.Date = new Proxy(RealDate, {
  construct(target, args, newTarget) {
    return args.length === 0
      ? Reflect.construct(target, [shifted()], newTarget)
      : Reflect.construct(target, args, newTarget);
  },
  // `Date()` without `new` returns a string, and never reads its arguments.
  apply() {
    return new RealDate(shifted()).toString();
  },
  get(target, prop, receiver) {
    return prop === 'now' ? shifted : Reflect.get(target, prop, receiver);
  },
});
