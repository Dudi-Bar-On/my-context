/**
 * The gate `plan:live seq:2` exists to build: every screen `app.js` routes
 * has an entry in `src/ui/public/lib/live-invalidation.js`'s
 * `SCREEN_INVALIDATION`, including the ones whose honest entry is "nothing
 * invalidates me". That answer is legal — `docs`, `tut` and `port` all give
 * it, for three different reasons named in that file's own header — and it
 * is indistinguishable from "nobody thought about this screen" unless a
 * check like this one fails the moment a routed screen has no key at all.
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
import { AUDIT_KINDS, type AuditKind } from '../../src/core/audit.ts';

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
async function loadLiveInvalidation(): Promise<{
  SCREEN_INVALIDATION: Record<string, AuditKind[] | '*'>;
  LIVE_INVALIDATION_DEBOUNCE_MS: number;
}> {
  const file = LIVE_INVALIDATION_FILE.replaceAll('\\', '/');
  return (await import(new URL(`file://${file}`).href)) as {
    SCREEN_INVALIDATION: Record<string, AuditKind[] | '*'>;
    LIVE_INVALIDATION_DEBOUNCE_MS: number;
  };
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
  screens: string[], map: Record<string, AuditKind[] | '*'>,
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

test('every entry is \'*\' or a de-duplicated array of real AuditKind values', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  const kinds = new Set<string>(AUDIT_KINDS);
  const bad: string[] = [];
  for (const [screen, value] of Object.entries(SCREEN_INVALIDATION)) {
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

test('the three static-content screens declare "nothing" explicitly, not by omission', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  for (const screen of ['docs', 'tut', 'port']) {
    assert.deepEqual(
      SCREEN_INVALIDATION[screen], [],
      `${screen} should be the reasoned-about "nothing" case: [], not absent and not '*'`,
    );
  }
});

test('watch and ask — the two screens whose subject IS the audit log — carry \'*\'', async () => {
  const { SCREEN_INVALIDATION } = await loadLiveInvalidation();
  assert.equal(SCREEN_INVALIDATION.watch, '*');
  assert.equal(SCREEN_INVALIDATION.ask, '*');
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
