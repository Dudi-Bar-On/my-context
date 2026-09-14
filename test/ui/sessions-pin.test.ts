// @basis TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
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
 *
 * ── THE THREE MATCHERS THIS FILE USED TO GET WRONG ──────────────────────────
 *
 * Measured 2026-09-13 (report 6, G4). All three scans read RAW source, so a
 * commented-out call or a sentence in a docblock counted as minting; the
 * import matcher accepted SINGLE-QUOTED specifiers only, so a double-quoted
 * import of a pinning helper was neither credited nor followed; and the pin
 * was a literal substring including the bracket, the quote and the `=`, so
 * `process.env.MYCONTEXT_UI_SESSIONS_DIR = …` or two spaces before the `=`
 * read as an offence. Each is a way for this gate to be confidently wrong, and
 * a gate that is wrong on a legitimate file is a gate somebody deletes.
 *
 * All three are now regexes over comment-blanked source, and — the part that
 * matters more — the scan is a FUNCTION over a file map, so it is driven
 * against planted files as well as against the real tree. A gate with an
 * anti-vacuity floor and no positive control still cannot be shown to go red.
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

/** The env assignment that pins the store without importing the helper. */
const PINS_ITSELF = /MYCONTEXT_UI_SESSIONS_DIR['"\]]?\s*\]?\s*=[^=]/;

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

/**
 * `source` with every comment blanked, newlines kept.
 *
 * Blanking rather than deleting, so an index still maps to its own line. This
 * file names all three minters in prose and in `MINTERS` itself; without this
 * it is its own first offender, and the old guard — "a call, not a mention",
 * implemented as `includes(name + '(')` — did not cover a commented-out call,
 * which is the shape that actually appears when somebody disables a server
 * while debugging.
 */
export function blankComments(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  for (let i = 0; i < source.length; i++) {
    // `:` before `//` is a URL scheme, never a comment. Without this line a
    // string holding `https://…` blanks the REST OF ITS LINE, and a real call
    // sitting after it on that line becomes invisible — a false negative
    // manufactured by the masker itself, which is the one thing a masker must
    // not do. `test/ui/no-writes.test.ts` carries a guard for the same class.
    if (source[i] === '/' && source[i + 1] === '/' && source[i - 1] !== ':') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop - 1;
    }
  }
  return out.join('');
}

/**
 * The relative imports of one file, resolved to absolute paths.
 *
 * BOTH quote styles. The single-quote-only matcher this replaces made a
 * double-quoted `import x from "../helpers/pin-sessions-dir.ts"` invisible in
 * both directions at once: the pin was not credited, and a minting helper
 * imported that way was never followed.
 */
export function relativeImports(source: string): string[] {
  const out: string[] = [];
  for (const m of blankComments(source).matchAll(
    /(?:from|import)\s*\(?\s*(['"])(\.[^'"]+)\1/g,
  )) {
    out.push(m[2]!);
  }
  return out;
}

export interface Offence {
  /** The file that mints without pinning. */
  file: string;
  /** Where the minting call is — `<file>:<line>`, so the reader has a coordinate. */
  at: string;
}

export interface ScanResult {
  minters: number;
  offences: Offence[];
}

/**
 * The whole check, as a function of a file map — which is what lets it be
 * driven against planted files as well as against the real tree.
 *
 * `read` returns `null` for a path that is not a file this scan can see; the
 * import graph is not this check's subject, so an unresolvable specifier stops
 * the walk there rather than failing and sending the reader somewhere else.
 */
export function scan(
  entries: string[], read: (file: string) => string | null, root: string, pin: string,
): ScanResult {
  const reachable = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const next = queue.pop();
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      const src = read(next);
      if (src === null) continue;
      const imports = relativeImports(src).map((s) => path.resolve(path.dirname(next), s));
      // Only within `test/`. Descending into `src/` finds the files that
      // DEFINE the minters, which every hook test transitively reaches through
      // the module it is testing — 44 false offenders on the first run. The
      // question here is who CALLS one, and the callers are all under `test/`.
      queue.push(...imports.filter((f) => f.startsWith(root)));
    }
    return seen;
  };

  const offences: Offence[] = [];
  let minters = 0;
  for (const file of entries) {
    const graph = reachable(file);
    let at: string | null = null;
    for (const f of [...graph].sort()) {
      const src = read(f);
      if (src === null) continue;
      const masked = blankComments(src);
      for (const name of MINTERS) {
        // A CALL, not a mention, and now also not a commented-out call.
        const m = new RegExp(`\\b${name}\\s*\\(`).exec(masked);
        if (m !== null) {
          at = `${path.relative(root, f)}:${masked.slice(0, m.index).split('\n').length}`;
          break;
        }
      }
      if (at !== null) break;
    }
    if (at === null) continue;
    minters += 1;
    // Reaching the pin module is one way to pin. Assigning the variable
    // directly is the other, and `test/ui/server-record.test.ts` needs it: it
    // points the store at a DIFFERENT directory per test, including one that
    // is deliberately unwritable, which a shared temp dir cannot express. The
    // ordering — assign before minting — is that file's own responsibility;
    // what is checked here is that it took responsibility at all.
    const pinsItself = [...graph].some((f) => {
      if (!f.startsWith(root)) return false;
      const src = read(f);
      return src !== null && PINS_ITSELF.test(blankComments(src));
    });
    if (!graph.has(pin) && !pinsItself) offences.push({ file: path.relative(root, file), at });
  }
  return { minters, offences };
}

/** `read` over the real filesystem. */
const readOrNull = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

test('every test that can mint a session token pins the store out of the real home', () => {
  const files = testFiles(TEST_ROOT);
  assert.ok(files.length > 0, `no test files under ${TEST_ROOT}: the walk found nothing to check`);

  const { minters, offences } = scan(files, readOrNull, TEST_ROOT, PIN);

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
    offences.map((o) => `${o.file} (mints at ${o.at})`),
    [],
    `these test files can mint a UI session token without pinning the store, so `
    + `running them evicts digests from the developer's real `
    + `~/.my-context/ui-sessions.json (capped at 8) and locks their open tabs `
    + `out. Fix by importing '../helpers/pin-sessions-dir.ts', or — if the file needs a `
    + `different directory per test, as test/ui/server-record.test.ts does — by assigning `
    + `process.env['MYCONTEXT_UI_SESSIONS_DIR'] before the first mint.`,
  );
});

/* ── THE POSITIVE CONTROL ──────────────────────────────────────────────────── */

/** A planted tree: `read` answers from this map and nothing else. */
function planted(files: Record<string, string>): {
  entries: string[]; read: (f: string) => string | null; root: string; pin: string;
} {
  // Resolved, not joined: the graph walk uses path.resolve, which on Windows
  // prepends the drive letter. A map keyed on a joined path would never be
  // found again, and every planted import would read as unresolvable.
  const root = path.resolve('planted-fixture') + path.sep;
  const abs = (rel: string): string => path.resolve(root, rel);
  const map = new Map(Object.entries(files).map(([k, v]) => [abs(k), v]));
  return {
    entries: [...map.keys()].filter((f) => f.endsWith('.test.ts')),
    read: (f) => map.get(f) ?? null,
    root,
    pin: abs(path.join('helpers', 'pin-sessions-dir.ts')),
  };
}

const run = (files: Record<string, string>): ScanResult => {
  const p = planted(files);
  return scan(p.entries, p.read, p.root, p.pin);
};

test('a file that mints without pinning is NAMED, with the line it mints on', () => {
  const r = run({ 'a.test.ts': "import x from './nothing.ts';\nstartUiServer({});\n" });
  assert.equal(r.minters, 1, 'the planted minter was not recognised as one');
  assert.deepEqual(r.offences.map((o) => o.file), ['a.test.ts']);
  assert.deepEqual(r.offences.map((o) => o.at), ['a.test.ts:2']);
});

test('the SAME file with the pin imported is not an offence', () => {
  // The green direction on the identical fixture, so the power of the test
  // above is in the missing pin and not in the fixture.
  const r = run({
    'a.test.ts': "import './helpers/pin-sessions-dir.ts';\nstartUiServer({});\n",
    'helpers/pin-sessions-dir.ts': '',
  });
  assert.equal(r.minters, 1);
  assert.deepEqual(r.offences, []);
});

test('a DOUBLE-quoted import of the pin is credited — the matcher used to see only one quote', () => {
  const r = run({
    'a.test.ts': 'import "./helpers/pin-sessions-dir.ts";\nrunUi([]);\n',
    'helpers/pin-sessions-dir.ts': '',
  });
  assert.equal(r.minters, 1);
  assert.deepEqual(r.offences, [], 'a double-quoted specifier is the same import');
});

test('a double-quoted import of a MINTING helper is followed too', () => {
  // The other half of the same defect, and the dangerous half: an unfollowed
  // import is a minter this gate never sees.
  const r = run({
    'a.test.ts': 'import { boot } from "./boot.ts";\nboot();\n',
    'boot.ts': 'export const boot = () => spawnUiChild([]);\n',
  });
  assert.equal(r.minters, 1, 'the minting helper was reached through a double-quoted import');
  assert.deepEqual(r.offences.map((o) => o.file), ['a.test.ts']);
});

test('the three spellings of the direct pin are all credited', () => {
  // The literal substring this replaces required the bracket, the single
  // quote and exactly one space before the `=`. Each of these was reported as
  // an offence and none of them is one.
  for (const spelling of [
    "process.env['MYCONTEXT_UI_SESSIONS_DIR'] = d;",
    'process.env["MYCONTEXT_UI_SESSIONS_DIR"] = d;',
    'process.env.MYCONTEXT_UI_SESSIONS_DIR  =  d;',
  ]) {
    const r = run({ 'a.test.ts': `${spelling}\nstartUiServer({});\n` });
    assert.equal(r.minters, 1, `not recognised as a minter: ${spelling}`);
    assert.deepEqual(r.offences, [], `this pin was reported as an offence: ${spelling}`);
  }
});

test('a COMMENTED-OUT mint is not a mint, and a mentioned name is not a call', () => {
  const commented = run({ 'a.test.ts': '// startUiServer({});\n/* runUi([]); */\n' });
  assert.equal(commented.minters, 0, 'a commented-out call was counted as minting');
  assert.deepEqual(commented.offences, []);

  const mentioned = run({ 'a.test.ts': 'const names = [startUiServerLabel];\n' });
  assert.equal(mentioned.minters, 0, 'a longer identifier that merely starts with a minter name');
});

test('an unresolvable import stops the walk there rather than failing the run', () => {
  const r = run({ 'a.test.ts': "import './gone.ts';\nstartUiServer({});\n" });
  assert.equal(r.minters, 1);
  assert.deepEqual(r.offences.map((o) => o.file), ['a.test.ts']);
});

test('the masker does not blank a line because a URL happens to be on it', () => {
  // The guard against the masker MANUFACTURING a false negative: `https://`
  // holds a `//`, and a masker that read it as a comment start would blank the
  // rest of that line — hiding a real mint written after it. `no-writes.test
  // .ts` carries a guard for the same class over `maskNonCode`.
  const r = run({ 'a.test.ts': "const url = 'https://example.test/x'; startUiServer({});\n" });
  assert.equal(r.minters, 1, 'a URL in a string blanked the mint that followed it on the same line');
  assert.deepEqual(r.offences.map((o) => o.at), ['a.test.ts:1']);
});
