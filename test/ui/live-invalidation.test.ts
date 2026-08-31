/**
 * The gate `plan:live seq:2` exists to build: every screen `app.js` routes
 * has an entry in `src/ui/public/lib/live-invalidation.js`'s
 * `SCREEN_INVALIDATION`, including the ones whose honest entry is "nothing
 * invalidates me". That answer is legal — `docs`, `tut` and `port` all give
 * it, for three different reasons named in that file's own header — and it
 * is indistinguishable from "nobody thought about this screen" unless a
 * check like this one fails the moment a routed screen has no key at all.
 *
 * **`plan:live seq:3` widened the shape, not the gate's job.** Each entry is
 * now `{ kinds, refresh }` rather than a bare `kinds` value — `refresh` is
 * `'auto'` or `'ask'`, the second property
 * `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` names ("which of the
 * two a screen does is a property the SCREEN DECLARES"). Every test below
 * that used to read an entry directly now reads `.kinds`, and one new test
 * covers `.refresh` the same way the entry-shape test already covered
 * `.kinds` — a screen with `kinds` but no valid `refresh` is exactly as
 * undeclared as one with neither.
 *
 * **The screen list is read from `app.js`, not hand-copied.** A hand-copied
 * list would pass this file forever while `app.js` grew a twenty-second
 * screen — exactly the silent drift the task exists to refuse. The
 * extraction reuses `test/ui/pane-route.test.ts`'s own regex
 * (`import\('\/screens\/([a-z]+)\.js'\)` against the dynamic-import form
 * inside `SCREENS`), which is anchored to the loader shape the screen
 * contract requires (`app.js`'s header, item 1: *"The loader is `() =>
 * import('/screens/x.js')`"*) rather than to the object's own key names, so
 * a screen registered under a mismatched key would still be found by its
 * module path.
 *
 * **2026-08-29: the shell's own chrome joins, as a SIBLING export.** The
 * status strip and the provenance bar are not screens — no route, no entry in
 * `SCREENS`, built once by `renderChrome()` and outliving every navigation —
 * so `CHROME_INVALIDATION` declares them per GROUP, and the same shape checks
 * run over it at the bottom of this file. It could not be a key in
 * `SCREEN_INVALIDATION`: the "declares no screen app.js does not route" test
 * below fails on exactly that, and loosening it to admit one would cost the
 * check that catches a renamed screen.
 *
 * `SCREEN_INVALIDATION` cannot import `AuditKind` from `core/audit.ts` —
 * that module is TypeScript and this one ships to a browser with no build
 * step — so its seven kind strings are repeated as literals. This file is
 * what checks that repetition against `AUDIT_KINDS`, the same division of
 * labour `test/ui/palette-lib.test.ts` holds over `palette-defs.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_KINDS, AUDIT_OPS, kindOf, type AuditKind, type AuditOp } from '../../src/core/audit.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const LIVE_INVALIDATION_FILE = path.join(PUBLIC, 'lib', 'live-invalidation.js');

/**
 * A `file://` specifier, built the way `test/ui/viewmodel.test.ts`'s `lib()`
 * helper builds one: a bare relative `import()` of a `.js` file type-checks
 * as TS7016 with `allowJs` off, and `npm run typecheck` is a gate, so this
 * form — which tsc never resolves statically — is what every test in this
 * project uses to load `src/ui/public/lib/*.js`. `replaceAll('\\', '/')`
 * is load-bearing on this machine: a bare Windows path fed to `new URL()`
 * is not a valid `file://` URL.
 */
/** One screen's row: what invalidates it, and what it does about that. */
interface ScreenInvalidation {
  kinds: AuditKind[] | '*';
  refresh: 'auto' | 'ask';
}

async function loadLiveInvalidation(): Promise<{
  SCREEN_INVALIDATION: Record<string, ScreenInvalidation>;
  CHROME_INVALIDATION: Record<string, ScreenInvalidation>;
  LIVE_INVALIDATION_DEBOUNCE_MS: number;
}> {
  const file = LIVE_INVALIDATION_FILE.replaceAll('\\', '/');
  return (await import(new URL(`file://${file}`).href)) as {
    SCREEN_INVALIDATION: Record<string, ScreenInvalidation>;
    CHROME_INVALIDATION: Record<string, ScreenInvalidation>;
    LIVE_INVALIDATION_DEBOUNCE_MS: number;
  };
}

/**
 * Every key `app.js`'s `CHROME_REFILL` declares a refill for — extracted the
 * same way `routedScreens()` extracts the screen list, and for the identical
 * reason: a hand-copied list here would pass forever while the shell grew a
 * fifth strip group. `CHROME_REFILL`'s values are one-line arrows, so the
 * first `};` after the declaration closes the object.
 */
function chromeRefillKeys(): string[] {
  const source = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  const start = source.indexOf('const CHROME_REFILL = {');
  assert.ok(
    start >= 0,
    'app.js no longer declares `const CHROME_REFILL = {` — this extraction is stale',
  );
  const end = source.indexOf('};', start);
  assert.ok(end > start, 'no closing `};` found for CHROME_REFILL after its declaration');
  const body = source.slice(start, end);
  return [...body.matchAll(/^ {2}([a-z]+): \(\) =>/gm)].map((m) => m[1]!).sort();
}

/**
 * Every screen name `app.js` dynamically imports inside `SCREENS` — the same
 * `import\('\/screens\/([a-z]+)\.js'\)` `pane-route.test.ts` rewrites, read
 * here instead of rewritten. `Set` dedupes on principle; the loader form
 * appears exactly once per screen today, so a duplicate would itself be
 * worth knowing about, not something to hide by returning it twice.
 */
function routedScreens(): string[] {
  const source = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  // Sliced to the `SCREENS` object's own body before matching: the file
  // header quotes the loader form in prose — `` `() => import('/screens/x.js')` ``
  // — and unsliced that literal `x` matches the same regex and reads as a
  // twenty-second, nonexistent screen. `SCREENS` holds no nested `{`/`}` (every
  // value is a one-line arrow returning a call, never a block), so the first
  // `};` after the declaration is the object's own close.
  const start = source.indexOf('const SCREENS = {');
  assert.ok(start >= 0, 'app.js no longer declares `const SCREENS = {` — this extraction is stale');
  const end = source.indexOf('};', start);
  assert.ok(end > start, 'no closing `};` found for SCREENS after its declaration');
  const body = source.slice(start, end);
  const names = new Set<string>();
  for (const [, name] of body.matchAll(/import\('\/screens\/([a-z]+)\.js'\)/g)) {
    if (name !== undefined) names.add(name);
  }
  return [...names].sort();
}

/**
 * The check itself, factored out so the test below that proves it FAILS on
 * an undeclared screen exercises the identical function the gate test does
 * — not a paraphrase of it that could drift from what actually runs.
 */
function missingDeclarations(
  screens: string[], map: Record<string, unknown>,
): string[] {
  return screens.filter((name) => !Object.hasOwn(map, name));
}

test('app.js routes 21 screens (sanity — the extraction found something)', () => {
  const screens = routedScreens();
  assert.ok(
    screens.length >= 21,
    `expected 21+ routed screens, found ${screens.length}: ${screens.join(', ')}`,
  );
});

test('THE GATE: every screen app.js routes has a live-invalidation entry', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  const missing = missingDeclarations(routedScreens(), SCREEN_INVALIDATION);
  assert.deepEqual(
    missing, [],
    `${missing.join(', ')} — routed by app.js with no entry in SCREEN_INVALIDATION. `
    + 'Every screen must say what invalidates it, even if the honest answer is nothing ([]).',
  );
});

test('the gate FAILS for a screen added and not declared', () => {
  // Proof, not narration: run the exact function the gate test above runs,
  // against the real routed screens PLUS one app.js does not have, and
  // require it to name that one screen and nothing else. If a future edit
  // loosened `missingDeclarations` to stop catching this, this test is what
  // would say so.
  const synthetic = 'zzz-undeclared-screen';
  const missing = missingDeclarations(
    [...routedScreens(), synthetic],
    { preview: ['mutation'] }, // a map that plainly lacks every real screen too
  );
  assert.ok(missing.includes(synthetic), 'the synthetic undeclared screen was not caught');
});

test('SCREEN_INVALIDATION declares no screen app.js does not route', async () => {
  // The reverse direction: a stale entry left behind by a removed or
  // renamed screen is a table that claims more than it should, and would
  // hide the gate above ever having anything to catch for that name again.
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  const routed = new Set(routedScreens());
  const orphaned = Object.keys(SCREEN_INVALIDATION).filter((name) => !routed.has(name));
  assert.deepEqual(orphaned, [], `${orphaned.join(', ')} — declared, but app.js routes no such screen`);
});

test('every entry\'s kinds is \'*\' or a de-duplicated array of real AuditKind values', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  const kinds = new Set<string>(AUDIT_KINDS);
  const bad: string[] = [];
  for (const [screen, entry] of Object.entries(SCREEN_INVALIDATION)) {
    const value = entry.kinds;
    if (value === '*') continue;
    if (!Array.isArray(value)) { bad.push(`${screen}: not '*' or an array`); continue; }
    const seen = new Set<string>();
    for (const kind of value) {
      if (!kinds.has(kind)) bad.push(`${screen}: "${kind}" is not in AUDIT_KINDS`);
      if (seen.has(kind)) bad.push(`${screen}: "${kind}" listed twice`);
      seen.add(kind);
    }
  }
  assert.deepEqual(bad, []);
});

/**
 * The second property's own gate — the same shape as the kinds check above,
 * because an entry with a `kinds` array and a typo'd `refresh` is exactly as
 * undeclared, for the SCREEN-DECLARES-SAFETY half of the task, as a screen
 * with no entry at all.
 */
test('every entry\'s refresh is \'auto\' or \'ask\' — no third value, no omission', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  const bad: string[] = [];
  for (const [screen, entry] of Object.entries(SCREEN_INVALIDATION)) {
    if (entry.refresh !== 'auto' && entry.refresh !== 'ask') {
      bad.push(`${screen}: refresh is ${JSON.stringify(entry.refresh)}, not 'auto' or 'ask'`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the three static-content screens declare "nothing" explicitly, not by omission', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  for (const screen of ['docs', 'tut', 'port']) {
    assert.deepEqual(
      SCREEN_INVALIDATION[screen]?.kinds, [],
      `${screen} should be the reasoned-about "nothing" case: [], not absent and not '*'`,
    );
  }
});

test('watch and ask — the two screens whose subject IS the audit log — carry \'*\'', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  assert.equal(SCREEN_INVALIDATION.watch?.kinds, '*');
  assert.equal(SCREEN_INVALIDATION.ask?.kinds, '*');
});

/**
 * **`watch` is the one screen `app.js` deliberately never subscribes through
 * this table** — it has managed the shared stream itself since `seq:1`.
 * `refresh` still has to be a real value here (the test above requires it of
 * every entry, `watch` included, for shape-completeness), but this is where
 * that is written down as a DECISION rather than left for a reader of
 * `app.js`'s `EXCLUDED_FROM_GENERIC_LIVE_REFRESH` to reconstruct alone.
 */
test('watch is excluded from the generic wiring in app.js, by name', () => {
  const source = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  assert.match(
    source, /EXCLUDED_FROM_GENERIC_LIVE_REFRESH\s*=\s*new Set\(\[[^\]]*'watch'[^\]]*\]\)/,
    'app.js no longer excludes watch from the generic live-refresh wiring — '
    + 'if that changed on purpose, watch.js\'s own subscription needs removing too',
  );
});

/**
 * **The four ops that move the Injection preview, held against `KIND_OF`
 * rather than against two strings someone typed here.**
 *
 * This is deliberately NOT "preview now lists `injection` and `hook`". That
 * assertion is the one the task's own bounds refuse: a row with the wrong
 * kinds is well-formed, every gate above passes it, and restating the row's
 * contents in a test restates the mistake as well as the fix. The BEHAVIOUR
 * — a compaction reaches a live screen — is pinned in a browser, by
 * `e2e/preview-compact-continuity.spec.ts`, which is where it can be pinned
 * at all.
 *
 * What this adds is the half a browser cannot see: the derivation. The
 * preview's staleness is not a property of any endpoint, it is a property of
 * the four MOMENTS that rewrite the session state `/api/select` and
 * `/api/simulate` resolve per request — the seen file and the restore
 * snapshot. Those moments are named as OPS here, and their kinds are read
 * from `kindOf` at run time, so the day someone re-maps `compact-restore`
 * out of `injection` this fails with the op that moved rather than leaving
 * the screen quietly deaf again. That is the failure mode this whole file
 * exists for, one level up from "is the row well formed".
 */
test('preview declares a kind for every op that rewrites the session state it previews', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  // Each op with WHAT it rewrites, because the reason is the derivation and a
  // bare list would be four strings to keep current by hand.
  const MOVES_THE_PREVIEW: [AuditOp, string][] = [
    ['session-start', 'appends the seen lines the next preview dedupes against'],
    ['compact-restore', 'appends continuity/restored seen lines keyed on the new window'],
    ['post-compact', 'closes the compaction whose snapshot IS the continuity window'],
    ['session-end', 'clears the session dedupe state the preview reads'],
  ];
  const declared = SCREEN_INVALIDATION['preview']?.kinds;
  assert.ok(Array.isArray(declared), 'preview has no kinds array to check');
  const missing = MOVES_THE_PREVIEW
    .filter(([op]) => !declared.includes(kindOf(op)))
    .map(([op, why]) => `${op} (kind ${kindOf(op)}) — ${why}`);
  assert.deepEqual(
    missing, [],
    'the Injection preview does not subscribe to the records its own subject writes:\n  '
    + missing.join('\n  ')
    + '\nA preview of an event is stale the moment that event happens, and the record '
    + 'proving it happened is the one this row omits.',
  );
});

test('the debounce is a positive, finite, hardcoded number of milliseconds', async () => {
  const { LIVE_INVALIDATION_DEBOUNCE_MS } = await loadLiveInvalidation();
  assert.ok(Number.isFinite(LIVE_INVALIDATION_DEBOUNCE_MS));
  assert.ok(LIVE_INVALIDATION_DEBOUNCE_MS > 0);
  // "stated in the code rather than tuned" (the task's own words) means no
  // path to an outside value — scanned as bytes, the same way
  // `test/ui/no-writes.test.ts` and `palette-lib.test.ts` scan for what a
  // file must not contain rather than trusting a comment that says so.
  const source = readFileSync(LIVE_INVALIDATION_FILE, 'utf8');
  assert.doesNotMatch(source, /process\.env|process\.argv/,
    'the debounce must be a literal, not read from the environment or argv');
});

/* ══ THE SHELL'S OWN CHROME — `CHROME_INVALIDATION` ═════════════════════════
 *
 * The status strip and the provenance bar are not screens: they have no route,
 * `SCREENS` does not list them, and `renderChrome()` builds them once for the
 * life of the page. That is exactly why they could not be a key in
 * `SCREEN_INVALIDATION` — the gate above fails a key `app.js` routes no screen
 * for, and loosening it to admit one would cost the check that catches a
 * renamed screen. A sibling export in the same file, under the same gate, is
 * what keeps "one declaration read by the shell and by the gate" true.
 *
 * The three tests below are the shape checks the screen table already gets.
 * The BEHAVIOUR — a record lands and a strip segment changes with nothing
 * reloaded — is `e2e/strip-live-refresh.spec.ts`, for the reason
 * `e2e/preview-compact-continuity.spec.ts` states about its own subject: a row
 * carrying the wrong kinds is perfectly well formed, and a test that asserts
 * this table has one more key measures nothing about what the strip does.
 */

test('CHROME_INVALIDATION and app.js\'s CHROME_REFILL declare the SAME groups', async () => {
  // Both directions, like the screen gate above. A declared group with no
  // refill is a row that can never act; a refill with no declaration is a
  // segment whose staleness nobody wrote down — and the second is the one
  // that reads as a decision when it is an omission.
  const { CHROME_INVALIDATION } = await loadLiveInvalidation();
  assert.deepEqual(
    Object.keys(CHROME_INVALIDATION).sort(), chromeRefillKeys(),
    'the chrome groups app.js can refill and the groups this table declares have drifted apart',
  );
});

test('every chrome entry\'s kinds is \'*\' or a de-duplicated array of real AuditKind values', async () => {
  const { CHROME_INVALIDATION } = await loadLiveInvalidation();
  const kinds = new Set<string>(AUDIT_KINDS);
  const bad: string[] = [];
  for (const [group, entry] of Object.entries(CHROME_INVALIDATION)) {
    const value = entry.kinds;
    if (value === '*') continue;
    if (!Array.isArray(value)) { bad.push(`${group}: not '*' or an array`); continue; }
    const seen = new Set<string>();
    for (const kind of value) {
      if (!kinds.has(kind)) bad.push(`${group}: "${kind}" is not in AUDIT_KINDS`);
      if (seen.has(kind)) bad.push(`${group}: "${kind}" listed twice`);
      seen.add(kind);
    }
  }
  assert.deepEqual(bad, []);
});

/**
 * **Every chrome row is `'auto'`, and this is the gate that keeps the day one
 * is not from being a silent no-op.**
 *
 * `app.js`'s `setupLiveChrome` SKIPS a chrome row whose `refresh` is not
 * `'auto'`, deliberately: the shared affordance in the strip is the SCREEN's,
 * driven by a single `pendingScreenRefresh` slot, and borrowing it for chrome
 * would take back a screen refresh the reader has not pressed yet — while a
 * second control in the strip is a presentation change the design of record
 * decides first. Skipping is the safe direction, and it is also the silent
 * one, so this is what makes it loud: set a chrome row to `'ask'` and this
 * fails, naming the affordance that has to exist before the row may change.
 */
test('every chrome entry is \'auto\' — the shell has no \'ask\' path for chrome', async () => {
  const { CHROME_INVALIDATION } = await loadLiveInvalidation();
  const bad: string[] = [];
  for (const [group, entry] of Object.entries(CHROME_INVALIDATION)) {
    if (entry.refresh !== 'auto') {
      bad.push(`${group}: refresh is ${JSON.stringify(entry.refresh)}`);
    }
  }
  assert.deepEqual(
    bad, [],
    'a chrome group asks to be REFRESHED ON DEMAND, and nothing in app.js draws that '
    + 'affordance for chrome — `setupLiveChrome` skips such a row, so it would simply stop '
    + 'refreshing. Design the control (the mockup is edited first) before changing the row.',
  );
});

/**
 * The group whose honest answer is "nothing", written down rather than left
 * absent — the same distinction the three static screens carry above, and
 * checked here for the same reason: `[]` and a missing key read identically
 * unless something enforces the difference.
 *
 * `repo` is `/api/meta`'s git state, and no op in `AUDIT_OPS` records a commit,
 * a checkout or a fetch. It cannot be made stale by a record and may not be
 * refetched on one: an item write that made the git group flicker would be the
 * wasteful blanket this per-group table exists to refuse.
 *
 * **`audit` LEFT THIS TEST ON 2026-09-01, because it gained a live source.**
 * It was `[]` while the group's only content was `injections today`, which has
 * no endpoint on this read surface and is drawn NAMED as unmeasured. The group
 * now also carries the audit CLOCK — the newest row's op and how long ago —
 * which `/api/watch/context` serves, so there is a source, and `'*'` is its
 * honest subscription: the clock's entire job is to report that the log moved,
 * so a record of ANY kind is precisely its event. A row that leaves this test
 * because the thing it described stopped being true is the direction these
 * ledgers are meant to move; one that leaves because somebody stopped checking
 * is not, which is why the reason is written here rather than left to a diff.
 * The `'*'` case is held by the provenance-bar test below, which `audit` now
 * shares.
 */
test('the chrome group with no live source declares "nothing" explicitly', async () => {
  const { CHROME_INVALIDATION } = await loadLiveInvalidation();
  assert.deepEqual(
    CHROME_INVALIDATION['repo']?.kinds, [],
    "repo should be the reasoned-about 'nothing' case: [], not absent and not '*'",
  );
  // AND `audit` is now the opposite case, asserted here so the move is a
  // MEASUREMENT rather than a deletion: a group that quietly went from `[]` to
  // absent would look identical to this edit in a diff.
  assert.equal(
    CHROME_INVALIDATION['audit']?.kinds, '*',
    "audit carries the audit clock since 2026-09-01, so its subscription is every kind",
  );
});

/**
 * **The provenance bar's subject is the LOG, so its row is `'*'` — and this
 * holds that against `kindOf` rather than against seven strings someone
 * typed.**
 *
 * `#provproj` asks `/api/watch/volume` for its `projectionState`. Every op
 * this build has writes a line into a segment on disk, and a record is the
 * ONLY moment that answer can change — `recordAudit` catches the projection up
 * in the same call, so the ordinary case moves nothing, and the cases that DO
 * move it (`keepProjectionCurrent` returning `unbuilt`, `foreign`, `diverged`
 * or `failed`, which it never repairs) are indistinguishable from the ordinary
 * one at the frame. So the row must hear every kind, and an enumerated list
 * would mean "all of them" in seven strings plus an edit due the day an eighth
 * kind ships — the staleness `live-invalidation.js` exists to refuse.
 */
test('the provenance bar declares a kind for every op that can move the projection', async () => {
  const { CHROME_INVALIDATION } = await loadLiveInvalidation();
  const declared = CHROME_INVALIDATION['prov']?.kinds;
  if (declared === '*') return; // the honest spelling of "all of them"
  assert.ok(Array.isArray(declared), 'prov has no kinds to check');
  const missing = [...new Set(AUDIT_OPS.map((op) => kindOf(op)))]
    .filter((kind) => !declared.includes(kind));
  assert.deepEqual(
    missing, [],
    `${missing.join(', ')} — a record of these kinds is a line appended to the audit log, and `
    + 'the projection upkeep that runs beside it is best-effort. A row that does not hear them '
    + 'leaves the bar asserting "already current" over a projection that stopped being current, '
    + 'which is the one thing that bar exists to make impossible.',
  );
});
