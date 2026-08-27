/**
 * Every test file that can mint a UI session token has pinned the store first.
 *
 * ── WHY A TEST AND NOT A COMMENT ────────────────────────────────────────────
 *
 * `core/ui-sessions.ts` defaults its store to `~/.my-context/ui-sessions.json`,
 * which is capped at `SESSION_MAX = 8`. A test that mints a token without
 * pinning the store elsewhere therefore EVICTS a digest belonging to a tab the
 * developer has open, and that tab has no route back to a working session
 * except a fresh nonce typed in from a terminal.
 *
 * This was already known and already written down, twice, in the two files
 * that held the pin — `test/helpers/pin-rendering.ts` said a stray write
 * "turned 134 unrelated tests red", and `test/ui/helpers.ts` said in as many
 * words that an unpinned run "would evict the digests of the tabs the
 * developer actually has open, and lock them out". Both were accurate. Both
 * were bypassed anyway, because each covered one runner and neither covered a
 * bare `node --test <file>` calling `startUiServer` in process — which is how
 * a test is run while someone is working on it.
 *
 * On 2026-08-27 that cost a developer 134 minutes of a UI answering 401 to its
 * own open tab. The lesson is not that the comments were wrong; it is that a
 * property no test checks is a property that decays. So it is checked here.
 *
 * ── WHAT IS MEASURED ────────────────────────────────────────────────────────
 *
 * For each `test/**​/*.test.ts`, follow its relative imports transitively and
 * ask two questions: does the reachable set touch a token-minting entry point,
 * and does it reach the pin? Minting without the pin is the offence.
 *
 * Following imports rather than scanning one file is what makes the check
 * survive refactoring: a test that mints through a helper is caught, and a test
 * that pins through a helper is credited. `test/ui/helpers.ts` does both, which
 * is why files importing it need no line of their own.
 *
 * **The residual.** The walk stops at the `test/` boundary, so a test that
 * mints by calling PRODUCT code which itself starts a server — a hook, an
 * upkeep tick — is not seen as a minter here. Those are pinned today through
 * `real-home-guard.ts`, and widening the walk into `src/` costs 44 false
 * offenders, every hook test reaching a minter through the module under test.
 * A false offender is worse than this gap: it is the shape that gets a check
 * deleted.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const TEST_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PIN = path.join(TEST_ROOT, 'helpers', 'pin-sessions-dir.ts');

/**
 * The entry points that mint a token and record its digest.
 *
 * `startUiServer` mints in process. `spawnUiChild` and `runUi` reach the same
 * code in a child, which inherits this process's environment — so the pin has
 * to be set here, in the parent, before the child is forked.
 */
const MINTERS = ['startUiServer', 'spawnUiChild', 'runUi'] as const;

/** Every `*.test.ts` under `test/`, recursively. */
function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(full));
    else if (entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** The relative imports of one file, resolved to absolute paths. */
function relativeImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/from\s+'(\.[^']+)'|import\s+'(\.[^']+)'/g)) {
    const spec = m[1] ?? m[2];
    if (spec !== undefined) out.push(path.resolve(path.dirname(file), spec));
  }
  return out;
}

/** Every file reachable from `entry` through relative imports, including it. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const next = queue.pop();
    if (next === undefined || seen.has(next)) continue;
    seen.add(next);
    let imports: string[];
    try {
      imports = relativeImports(next);
    } catch {
      // Not a file we can read (a directory specifier, a missing path): the
      // import graph is not this test's subject, so it stops here rather than
      // failing and sending the reader somewhere unrelated.
      continue;
    }
    // Only within `test/`. Descending into `src/` finds the files that
    // DEFINE the minters, which every hook test transitively reaches through
    // the module it is testing — 44 false offenders on the first run. The
    // question here is who CALLS one, and the callers are all under `test/`.
    queue.push(...imports.filter((f) => f.startsWith(TEST_ROOT)));
  }
  return seen;
}

test('every test that can mint a session token pins the store out of the real home', () => {
  const offenders: string[] = [];
  let minters = 0;

  for (const file of testFiles(TEST_ROOT)) {
    const graph = reachable(file);
    const mints = [...graph].some((f) => {
      let src: string;
      try {
        src = readFileSync(f, 'utf8');
      } catch {
        return false;
      }
      // A CALL, not a mention: this file names all three in prose and in
      // `MINTERS` itself, and a doc comment describing minting does not mint.
      return MINTERS.some((name) => src.includes(name + '('));
    });
    if (!mints) continue;
    minters += 1;
    // Reaching the pin module is one way to pin. Assigning the variable
    // directly is the other, and `test/ui/server-record.test.ts` needs it: it
    // points the store at a DIFFERENT directory per test, including one that
    // is deliberately unwritable, which a shared temp dir cannot express. The
    // ordering — assign before minting — is that file's own responsibility;
    // what is checked here is that it took responsibility at all.
    const pinsItself = [...graph].some((f) => {
      if (!f.startsWith(TEST_ROOT)) return false;
      try {
        return readFileSync(f, 'utf8').includes("MYCONTEXT_UI_SESSIONS_DIR'] =");
      } catch {
        return false;
      }
    });
    if (!graph.has(PIN) && !pinsItself) offenders.push(path.relative(TEST_ROOT, file));
  }

  // Anti-vacuity: if the walk found nothing that mints, the check above passed
  // by measuring an empty set, and would keep passing while the real store was
  // being written. That is the failure this whole file exists to prevent, so it
  // fails as itself rather than reporting green.
  assert.ok(
    minters > 0,
    'found no test file reaching a token-minting entry point, which means this '
    + 'check measured nothing — the walk or the MINTERS list is broken, not the '
    + 'codebase',
  );

  assert.deepEqual(
    offenders,
    [],
    `these test files can mint a UI session token without pinning the store, so `
    + `running them evicts digests from the developer's real `
    + `~/.my-context/ui-sessions.json (capped at 8) and locks their open tabs `
    + `out: ${offenders.join(', ')}. Fix by importing `
    + `'../helpers/pin-sessions-dir.ts'.`,
  );
});
