/**
 * **`Injected now` when there is nothing to draw — in the browser, because
 * that is the only place the sentence and its absence look different.**
 *
 * `TASK-injected-now-lands-on-the-one-session-that-has-no-lines-and` is two
 * defects that were reported together and must not be fixed together:
 *
 *  1. the screen LANDED on the one session with no lines, so a reader's first
 *     impression of *"live, not hypothetical"* was a bare table head;
 *  2. `{"lines":[]}` with `error:null` said NOTHING about why it was empty.
 *
 * The first is the fixture's and is closed by `scripts/demo-corpus.ts`: the
 * default session keeps its seen file and draws rows. The first test here is
 * that closure's guard, and it is the one that fails the day the fixture drifts
 * back.
 *
 * The second is `screens/injected.js`' and is drawn from `inj.zeroLines`. It
 * cannot be measured on the landing any more, precisely BECAUSE the first is
 * fixed — which is the trap this file exists to get out of. So the second test
 * renders the real screen module against the one session in the corpus whose
 * window was destroyed.
 *
 * ── WHY THE SCREEN IS MOUNTED RATHER THAN NAVIGATED TO ────────────────────
 *
 * **The app has no session picker.** `app.js` says so in its own header —
 * *"#focusbtn/#sessbtn open no popup … loadSessions() below still computes and
 * exposes the real default/cold session (ctx.session()) so a later task can
 * wire the popup"* — so `ctx.session()` is always `/api/sessions`' default and
 * no click anywhere in the shell can move it. A screen whose whole subject is
 * *which session* can therefore only ever be seen showing one, and the empty
 * state is unreachable by navigation on any corpus where the default has rows.
 *
 * So the module is mounted the way `e2e/bounded-paging.spec.ts` mounts
 * `boundedList`, and for its reason: the specifiers are the ones the BROWSER
 * resolves, so this is the shipped module under the shipped stylesheet inside
 * the shipped shell, with only `ctx.session()` overridden. Every ancestor rule
 * that decides whether the sentence can be SEEN is the real one.
 *
 * ── AND THE TWO ENDPOINTS, THROUGH THE PAGE'S OWN DOOR ────────────────────
 *
 * The third test measures the disagreement the task reports, in the browser,
 * through `window.myctx.api` — the same credentialed door every screen uses.
 * `test/ui/injected-endpoints.test.ts` holds WHY the two answers differ and
 * which axis each difference is on; this one holds that they still differ over
 * the corpus the UI is developed against, so the case cannot quietly stop
 * existing the way it did when every seen file was kept.
 *
 * Every query below is scoped to `#injprobe` or to the VISIBLE injected
 * section: the router keeps every visited screen inside `#screen`, merely
 * hidden, and an unscoped `td` counts rows off four other screens.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { settleScreen } from './settle.ts';

/** The session `scripts/demo-corpus.ts` replays `/clear` on. */
const CLEARED = 'demo-session-a3f9c1-20';

/**
 * Navigate to `#/injected` and wait only for the SECTION to exist.
 *
 * Deliberately not `settleScreen` — two of the three tests below do not read
 * the shell's own render at all (one mounts its own, one only calls the API),
 * and waiting for a render they will not look at buys them nothing but a share
 * of `plan:walk seq:85`'s audit-projection contention, which empties every read
 * surface on this corpus under parallel workers. The one test that DOES read
 * the shell's render waits for it itself, and says so when it does not arrive.
 */
async function openInjected(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/injected'; });
  // **`.card.pane`, not the section, and this is load-bearing.** `route()`
  // writes a holding chip into the section and only THEN awaits the screen
  // module, whose `render()` opens with `root.replaceChildren()` — so a probe
  // prepended while the section merely EXISTS is thrown away by a render that
  // had not started yet. Measured: three runs, `#injprobe` gone every time.
  // The card is appended synchronously at the top of `render()`, so its
  // presence is the signal that the clear has already happened. It is also the
  // signal for a REFUSED read, which lands inside the same card — waiting for
  // content instead would wait out the timeout on exactly the state
  // `refusalIn` exists to name.
  await page.locator('section[data-p="injected"] .card.pane')
    .waitFor({ state: 'attached', timeout: 20_000 });
}

/**
 * The refusal a stale audit projection puts on every read surface, or `''`.
 *
 * `errorNote` is `p.small.spill`, and this screen appends it BEFORE the table —
 * so a refused read draws a sentence and an empty table, which is exactly the
 * shape the empty-seen-file case draws and must never be confused with it.
 * Reading it back is what lets every bound below fail as ITSELF rather than as
 * "no rows" (`LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine`).
 */
async function refusalIn(page: Page, root: string): Promise<string> {
  return page.evaluate((sel) => {
    const note = document.querySelector(`${sel} p.small.spill`);
    return note === null ? '' : (note.textContent ?? '');
  }, root);
}

/**
 * Render `screens/injected.js` for `session` into a probe card inside the
 * visible injected section, and hand back its selector.
 *
 * `window.myctx` is spread rather than rebuilt, so `t`, `api` and the language
 * are the shell's own; only `session()` and `onSessionChange()` are replaced —
 * the first because nothing else can move it, the second so the mounted copy
 * never re-renders itself behind the assertions.
 */
async function mountFor(page: Page, session: string): Promise<string> {
  await page.evaluate(async (id) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const screen = await load('/screens/injected.js') as unknown as
      { render: (root: Element, ctx: unknown) => Promise<void> };
    // @ts-expect-error — `window.myctx` is the plain-JS screen contract, the
    // same reach `e2e/live-stream.spec.ts` makes for `subscribeStream`.
    const shell = window.myctx as Record<string, unknown>;
    const scene = document.querySelector('section[data-p="injected"]')!;
    document.getElementById('injprobe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'injprobe';
    scene.prepend(probe);
    await screen.render(probe, {
      ...shell,
      session: () => id,
      onSessionChange: () => () => {},
    });
  }, session);
  // The probe survived the shell's render rather than being replaced by it —
  // asserted rather than assumed, because a probe that was thrown away leaves
  // every locator below empty and every bound failing as "no rows".
  await expect(page.locator('#injprobe'),
    'the mounted screen was wiped by the shell\'s own render — `openInjected` waited for the '
    + 'wrong signal').toBeAttached();
  return '#injprobe';
}

/* ══ 1 · THE LANDING, WHICH IS THE HALF THE FIXTURE CLOSED ═══════════════ */

test('the screen lands on a session that has lines, and says nothing about emptiness', async ({ app }) => {
  await openInjected(app.page);
  const { settled, count } = await settleScreen(app.page, 'injected', { requires: 'table' });
  expect(settled,
    `injected never settled (last count ${count}); refusal on the screen: `
    + `"${await refusalIn(app.page, 'section[data-p="injected"]')}". Anything below would be a `
    + 'statement about a half-drawn screen. An empty refusal string with a low count is the '
    + 'audit-projection contention of `plan:walk seq:85` — re-run this spec alone.').toBe(true);
  const section = app.page.locator('section[data-p="injected"]');

  // The subtitle promises "what this context window actually received". Rows
  // are what makes that promise true on arrival, and their absence is the
  // whole of the owner's first sentence.
  await expect(section.locator('tbody tr'),
    'the default session must have a seen file with lines in it — if this is 0, '
    + '`scripts/demo-corpus.ts` has drifted back to deleting the newest session\'s seen file')
    .not.toHaveCount(0);

  // And the zero sentence is ABSENT, not merely invisible. A screen that draws
  // "this session has received nothing yet" underneath six rows is a worse
  // failure than the blank it replaced.
  await expect(section.getByText('has received nothing yet')).toHaveCount(0);
  await expect(section.getByText('No session is selected')).toHaveCount(0);
});

/* ══ 2 · THE EMPTY ANSWER, WHICH IS THE HALF THE SCREEN OWNS ═════════════ */

test('a session with no seen file draws its columns AND a sentence, never a bare table head', async ({ app }) => {
  await openInjected(app.page);
  const root = await mountFor(app.page, CLEARED);
  const probe = app.page.locator(root);

  // A refused read draws a sentence over an empty table, which is the SAME
  // shape this test is about. Told apart first, and named, so a contended run
  // cannot be read as the screen having handled the empty case.
  expect(await refusalIn(app.page, root),
    'the read was REFUSED, so this test measured a refusal and not an empty seen file — '
    + 'the audit-projection contention of `plan:walk seq:85`. Re-run alone.').toBe('');

  // Non-vacuity: this session must really be the empty one. A corpus where it
  // has rows would pass every assertion below for the wrong reason.
  await expect(probe.locator('tbody tr'),
    `${CLEARED} must have no lines — \`scripts/demo-corpus.ts\` replays the real SessionEnd `
    + 'hook with reason=clear on it. If this is not 0, the cleared-window shape is gone from '
    + 'the fixture and this test is measuring nothing.').toHaveCount(0);

  // The columns stay. An empty table is still a table, and the reader is
  // entitled to know what would have been in it.
  await expect(probe.locator('thead th')).toHaveCount(3);

  // THE SENTENCE. `inj.noSeenFile`, drawn under the table where a reader
  // reaches the end of it and finds no rows.
  const zero = probe.locator('p.small', { hasText: 'No seen file was written' });
  await expect(zero,
    'STD-a-measured-zero-is-drawn-and-named: a blank is indistinguishable from a failure '
    + 'to load, and this is the screen whose subtitle promises live delivery state').toBeVisible();
  // **The WORDING moved on 2026-08-30, and this line said in advance that it
  // would.** It used to pin `inj.zeroLines` — *"This session was read and has
  // received nothing yet"* — and to record that the sentence OVER-CLAIMED:
  // this session's seen file does not exist, so nothing was read, and the
  // response could not tell that apart from a file that WAS read and held
  // nothing (`{lines: [], error: null}` is both). `InjectedBody.seen` is the
  // field that separates them, `inj.noSeenFile` is the key the screen draws for
  // `absent`, and `test/ui/injected-endpoints.test.ts` holds the collapse
  // itself. Seven of nineteen live sessions were being told the wrong one.
  await expect(zero).toHaveText(
    'No seen file was written for this session, so nothing was read here — the audit log may '
    + 'still record what it was given.');
  // And it must NOT claim the session was read. That is the sentence this test
  // pinned for weeks and the one the field exists to stop.
  await expect(probe.getByText('was read and has received nothing')).toHaveCount(0);

  // Visible is not the same as occupying space — `states.spec.ts`' own point:
  // a state that renders nothing is not a state.
  const height = await zero.evaluate((el) => el.getBoundingClientRect().height);
  expect(height, 'the sentence must have a box, not just a node').toBeGreaterThan(0);

  // No error note beside it. Nothing failed here, and two explanations of one
  // absence is worse than none — `injected.js` is silent about the zero
  // whenever `errorNote` has already spoken.
  await expect(probe.locator('p.small.spill')).toHaveCount(0);
});

/* ══ 3 · THE TWO ENDPOINTS, OVER THE CORPUS THE UI IS BUILT AGAINST ══════ */

test('the picker\'s itemCount and the injected lines disagree about the cleared session', async ({ app }) => {
  await openInjected(app.page);
  const measured = await app.page.evaluate(async (id) => {
    // @ts-expect-error — the plain-JS screen contract, as above.
    const ctx = window.myctx as { api: (p: string) => Promise<Record<string, unknown>> };
    const sessions = await ctx.api('/api/sessions') as unknown as {
      default: string; sessions: { sessionId: string; itemCount: number }[];
    };
    const injected = await ctx.api(`/api/session/${encodeURIComponent(id)}/injected`) as unknown as
      { lines: unknown[]; error: string | null };
    const row = sessions.sessions.find((s) => s.sessionId === id);
    return {
      landsOn: sessions.default,
      itemCount: row === undefined ? null : row.itemCount,
      lines: injected.lines.length,
      error: injected.error,
    };
  }, CLEARED);

  expect(measured.landsOn,
    'the default must not BE the cleared session, or test 1 above is measuring the same thing')
    .not.toBe(CLEARED);
  expect(measured.itemCount,
    '/api/sessions reports this session received items — its ledger rows survived the clear')
    .toBeGreaterThan(0);
  expect(measured.lines,
    '/api/session/:s/injected reports none — the seen file went with the window').toBe(0);
  expect(measured.error,
    'and NOT as an error: nothing failed, which is exactly why the two answers are hard to '
    + 'tell apart and why the screen has to say which one it is').toBeNull();
});

/* ══ 4 · THE LONG SESSION, WHICH IS THE OTHER END OF THE SAME AXIS ═══════ */

/**
 * The session `scripts/demo-corpus.ts` drives through a full working day —
 * fifteen tool events, three compactions and three resumes, all through the
 * real hooks on stdin.
 */
const LONG = 'demo-session-a3f9c1-11';

/**
 * **A bounded list that holds something back, over data the product wrote.**
 *
 * `TASK-the-demo-corpus-cannot-trip-a-single-list-bound-so-paging-is`
 * (`plan:port seq:94b`) measured the fixture on 2026-08-27 and found that **not
 * one bounded surface in it exceeded its own bound** — the preview delivered 4
 * rows against a cap of 20, this table 0 against 50, the pack stack 1. So every
 * paging assertion in `e2e/bounded-paging.spec.ts` had to be made against a
 * `boundedList` MOUNTED over synthetic rows, and the agent that wrote it
 * refused to lower a cap to make the fixture trip: *"Lowering a cap to make the
 * fixture trip would have turned every paging assertion green against a bound
 * no user ever meets."*
 *
 * The fixture crosses it now, and it crosses it by being a longer SESSION
 * rather than by anything being lowered. Sixty rows against a cap of fifty, on
 * a seen file written entirely by `hooks/session-start.ts` and
 * `hooks/pre-tool-use.ts` being fed real payloads.
 *
 * **Mounted for the same reason test 2 is** — the shell has no session picker,
 * so the only session the served screen can be pointed at is the default. That
 * is the residual gap and it is named in `screen-parity.spec.ts`'s `injected`
 * entry: this table draws its control the day `#sessbtn` opens a popup, and not
 * before.
 */
test('a long session holds rows back, and the screen draws the way to reach them', async ({ app }) => {
  await openInjected(app.page);
  const root = await mountFor(app.page, LONG);
  const probe = app.page.locator(root);

  expect(await refusalIn(app.page, root),
    'the read was REFUSED, so this test measured a refusal and not a bounded list — '
    + 'the audit-projection contention of `plan:walk seq:85`. Re-run alone.').toBe('');

  // **The bound line states a truncation, and the number it truncates from is
  // the session's own.** `BOUND_CAP_TABLE` is 50; anything at or below it draws
  // "Showing all N" and no control at all, which is the state test 1 measures
  // on the default session. This table passes `order: 'recent', take: 'last'`
  // because a seen file is an append-only log, so its opening page is the
  // NEWEST end and its line says so — *"Showing the 50 most recent of 60"*, not
  // *"the first 50"*. `e2e/bounded-paging.spec.ts` holds that direction against
  // a mounted list; this is the first time the corpus itself has produced one.
  const bound = probe.locator('.bound');
  await expect(bound, 'the table declares its bound whatever it holds').toBeVisible();
  await expect(bound.locator('p'),
    `${LONG} must hold back rows — \`scripts/demo-corpus.ts\` drives it through fifteen tool `
    + 'events, three compactions and three resumes so its seen file passes 50 lines. If this '
    + 'reads "Showing all N", the long-session shape is gone from the fixture and the only '
    + 'bounded surface the product itself fills is gone with it.')
    .toHaveText(/Showing the 50 most recent of \d+\./);

  // The rows are capped at the bound, not merely reported as capped.
  await expect(probe.locator('tbody tr')).toHaveCount(50);

  // **ABSENT is the failure mode this control has** — `bounded-paging.spec.ts`'s
  // first test asserts the mirror of this over the default session, and the
  // requirement's own sentence is that *an inert control is the same lie as a
  // blank screen*. Both buttons are here; on arrival the one pointing past the
  // newest end is disabled, which is the browser's own answer and the
  // append-only reading `take: 'last'` exists for.
  await expect(bound.locator('button[data-step]'),
    'a list holding rows back must offer the way to them').toHaveCount(2);
  await expect(bound.locator('button[data-step="next"]'),
    'nothing is newer than the opening page of an append-only log').toBeDisabled();
  await expect(bound.locator('button[data-step="prev"]'),
    'and the rows it held back are OLDER, so Previous is the way to them').toBeEnabled();

  // The way through actually goes somewhere: the older page is different rows.
  const newestFirstRow = await probe.locator('tbody tr').first().textContent();
  await bound.locator('button[data-step="prev"]').click();
  await expect(bound.locator('p')).toHaveText(/Rows \d+–\d+ of \d+/);
  await expect(probe.locator('tbody tr').first(),
    'Previous on an append-only log means OLDER, not the same page re-drawn')
    .not.toHaveText(newestFirstRow ?? '');
});

/**
 * **The `jit` tier reaches a screen at all**, which no numbered session in this
 * fixture could show until 2026-08-30.
 *
 * Every session in the loop received exactly one `SessionStart`, and a session
 * start delivers `pinned`; the tool events all went to the bare unnumbered
 * session. So every row every screen could draw was `pinned`, the neutral chip
 * had nothing to mark, and `span.chip.ok` sat in `screen-parity`'s ledger for
 * this screen reading as a kind the code does not build. It builds it.
 */
test('a session that edited files carries jit rows, and they are chipped as jit', async ({ app }) => {
  await openInjected(app.page);
  const root = await mountFor(app.page, LONG);
  const probe = app.page.locator(root);

  expect(await refusalIn(app.page, root),
    'the read was REFUSED — re-run alone.').toBe('');

  // The tier chip the mockup gives `jit`. `TIERCHIP` maps it to `chip ok`, the
  // same neutral face every other screen gives the tier.
  await expect(probe.locator('tbody span.chip.ok').first(),
    `${LONG} must carry at least one jit line — the fixture drives fifteen PreToolUse events `
    + 'through the real hook on it. A table of nothing but pinned rows is the state that made '
    + 'this chip look like missing code for eight days.').toBeVisible();
});
