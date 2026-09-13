// @basis TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * **`runChecks` is a hand-kept registry, and this is the derivation that stops
 * it being one.**
 *
 * `src/doctor/checks.ts` declares a `check*` function per diagnostic and then
 * lists them, by hand, in an array inside `runChecks`. That is an INCLUSION
 * list: a check that exists and is not in the array runs nowhere, reports
 * nothing, and goes red in no gate. It has already happened once on record —
 * the removal review names one silent miss of exactly this shape — and the
 * failure mode is the one `a-scanner-names-what-it-skips-not-what-it-scans`
 * exists against: *a scanner that skips an input reports success. Nothing goes
 * red. The only evidence is the defect it let through, arriving later and
 * looking like something else.*
 *
 * The rule's second half is what is carried out here, because the first half
 * cannot be: `runChecks` must call each check with its own arguments, so it
 * cannot be inverted into "run everything except a skip list" — there is no
 * uniform thing to run. Where a list of inclusions is unavoidable the rule
 * says: **derive the set from the tree or the registry rather than typing it by
 * hand, and assert the derivation covers the real set in BOTH directions.**
 *
 * So every `check*` function DECLARED in the file is derived from the source,
 * every name the registry array actually calls is derived from the source, and
 * the two are compared both ways:
 *
 *   - declared but not registered → must appear in `EXCLUDED` **with a
 *     reason**, or this test fails naming the function;
 *   - registered but not declared → a phantom entry, which is a compile error
 *     today and would be a silent skip the moment the array is built from
 *     anything less direct than a direct call;
 *   - listed in `EXCLUDED` but not declared → a stale exclusion, which is how
 *     an exclusion list rots into a place to hide things;
 *   - listed in `EXCLUDED` **and** registered → an exclusion that is a lie, so
 *     the list stops describing the code.
 *
 * ── THE EXCLUSION LIST IS THE POINT, NOT THE LOOPHOLE ───────────────────────
 *
 * A skip list only beats an inclusion list if adding to it costs something. It
 * costs a reason here, read in a diff, and the two directions above mean an
 * entry cannot be parked: it has to name a function that exists and that the
 * registry really does not call. `test/cli/f2-registry.test.ts` is the shape
 * this follows — `ALLOWED_NONZERO` lives in the test, beside the assertion it
 * qualifies, rather than in the product code it is auditing.
 *
 * ── AND IT PROVES IT CAN GO RED ─────────────────────────────────────────────
 *
 * A guard over a registry that is already correct passes on its first run, and
 * a guard that passes for the wrong reason — a regex that matched nothing, a
 * block extractor that returned the empty string — passes on its first run
 * too, and on every run after. So `auditRegistry` is a pure function of the
 * source text, and the second test feeds it four MUTATED sources, one per
 * failure above, asserting first that the mutation actually landed and then
 * that the audit reports it. The floors in the first test (`>= 25` either
 * side) close the last vacuous reading: a derivation that finds nothing
 * cannot be green here.
 */

const SOURCE_PATH = path.resolve(import.meta.dirname, '..', '..', 'src', 'doctor', 'checks.ts');

/**
 * **Every `check*` function the file DECLARES, exported or not.**
 *
 * Not "every exported one": `checkSnapshotDrift` is private and is still a
 * check by every other measure, and a future check made private would
 * otherwise leave the derivation without ever touching this list. `export` is
 * an accident of who calls it in tests; `function check…` is the shape.
 */
export function declaredCheckNames(source: string): string[] {
  const names: string[] = [];
  const re = /^(?:export\s+)?(?:async\s+)?function\s+(check[A-Za-z0-9_]*)\s*\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) names.push(m[1]!);
  return names;
}

/**
 * **Every name the registry array inside `runChecks` actually calls.**
 *
 * Read by bracket-matching from the array literal's own `[` rather than by
 * scanning to the first `];`, so a nested array or an object literal added to
 * an entry cannot silently truncate the block and shrink the derived set —
 * which is the same class of quiet under-read this whole file exists to
 * refuse.
 */
export function registryNames(source: string): string[] {
  const marker = 'const checks: (() => Finding[])[] = [';
  const start = source.indexOf(marker);
  if (start === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = start + marker.length - 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return [];
  const block = source.slice(start + marker.length, end);
  const names: string[] = [];
  const re = /\b(check[A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) names.push(m[1]!);
  return names;
}

/**
 * **The checks `runChecks` deliberately does not call, and why.**
 *
 * Every reason here is already argued at length in `checks.ts` itself, at the
 * function it names; this list exists so the argument is REACHABLE from the
 * derivation instead of being something a reader has to already know.
 */
export const EXCLUDED: ReadonlyMap<string, string> = new Map([
  [
    'checkCliOnPath',
    'answers a question about the MACHINE (is `mycontext` on this PATH), not about the corpus, ' +
    'so its answer differs between two clones of the same repository. `doctor.ts` calls it ' +
    'directly and folds it into its own exit code without folding it into `findings`/`counts`; ' +
    "`runChecks`' other callers (`status`, `ack`, the UI health widget) never run it and never " +
    'could. Its docblock in checks.ts says so in as many words.',
  ],
  [
    'checksumMigrationFindings',
    'not a check at all — it TRANSLATES corpus load errors, which the caller already holds, into ' +
    'findings. It takes no corpus and reads no disk, and `doctor.ts` calls it directly alongside ' +
    '`runChecks` for the same reason it calls `checkCliOnPath` directly: a file that could not be ' +
    'read is a property of the read, not of an item. Only its name puts it in this derivation.',
  ],
  [
    'checkSnapshotDrift',
    'IS run on every `runChecks` — as the first line of `checkSourceDrift`, which registers for ' +
    'both. It is a separate function because a snapshot and an anchored assertion share almost ' +
    'nothing and have different remedies, not because it is a separate check. Registering it as ' +
    'well would report every `source_drift` twice.',
  ],
]);

/**
 * The whole judgement, as a list of complaints, so the same function that
 * passes on the real source can be shown failing on a broken one. Empty means
 * the registry and the file agree.
 */
export function auditRegistry(source: string, excluded: ReadonlyMap<string, string>): string[] {
  const declared = declaredCheckNames(source);
  const registered = registryNames(source);
  const declaredSet = new Set(declared);
  const registeredSet = new Set(registered);
  const complaints: string[] = [];

  for (const name of declared) {
    if (registeredSet.has(name)) continue;
    const reason = excluded.get(name);
    if (reason === undefined) {
      complaints.push(
        `${name} is declared in checks.ts and is NOT in runChecks' registry array. A check that ` +
        `is not in the array runs nowhere and reports nothing, and no gate goes red. Add it to ` +
        `the array, or add it to EXCLUDED in this file with the reason it must not run.`,
      );
      continue;
    }
    if (reason.trim() === '') {
      complaints.push(`${name} is in EXCLUDED with an empty reason; the reason is the whole cost.`);
    }
  }

  for (const name of registered) {
    if (declaredSet.has(name)) continue;
    complaints.push(`runChecks' registry calls ${name}, which checks.ts does not declare.`);
  }

  for (const [name] of excluded) {
    if (!declaredSet.has(name)) {
      complaints.push(
        `EXCLUDED names ${name}, which checks.ts no longer declares — a stale exclusion is where ` +
        `a later check with the same name would land pre-excused.`,
      );
    } else if (registeredSet.has(name)) {
      complaints.push(
        `EXCLUDED names ${name}, but runChecks' registry does call it. The list has stopped ` +
        `describing the code.`,
      );
    }
  }

  const seen = new Set<string>();
  for (const name of registered) {
    if (seen.has(name)) complaints.push(`runChecks' registry calls ${name} more than once.`);
    seen.add(name);
  }

  return complaints;
}

test('every check function declared in checks.ts is registered, or excluded with a reason', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const declared = declaredCheckNames(source);
  const registered = registryNames(source);

  // The floors: a derivation that found nothing would agree with anything.
  // These are not pinned counts — they may grow freely — they only refuse a
  // vacuous green.
  assert.ok(
    declared.length >= 25,
    `derived only ${declared.length} check declarations from checks.ts; the extraction is broken, ` +
    `not the registry`,
  );
  assert.ok(
    registered.length >= 25,
    `derived only ${registered.length} registry entries from runChecks; the block extraction is ` +
    `broken, not the registry`,
  );

  assert.deepEqual(auditRegistry(source, EXCLUDED), []);
});

test('the derivation reports a red — one mutation per failure it claims to catch', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');

  // 1. A check is dropped from the registry array. This is the incident that
  //    has already happened once, and the one this file exists for.
  const dropped = source.replace('    () => checkCorpusSize(opts.items),\n', '');
  assert.notEqual(dropped, source, 'the drop mutation did not land; the fixture is stale');
  const droppedComplaints = auditRegistry(dropped, EXCLUDED);
  assert.equal(droppedComplaints.length, 1, droppedComplaints.join('\n'));
  assert.match(droppedComplaints[0]!, /^checkCorpusSize is declared .* NOT in runChecks/);

  // 2. A registry entry names a function the file does not declare.
  const phantom = source.replace(
    '    () => checkCorpusSize(opts.items),',
    '    () => checkCorpusSizeTypo(opts.items),',
  );
  assert.notEqual(phantom, source, 'the phantom mutation did not land; the fixture is stale');
  const phantomComplaints = auditRegistry(phantom, EXCLUDED);
  assert.ok(
    phantomComplaints.some((c) => /registry calls checkCorpusSizeTypo, which checks.ts does not/.test(c)),
    phantomComplaints.join('\n'),
  );

  // 3. An exclusion goes stale — the function it excuses is gone.
  const renamed = source.replace('function checkSnapshotDrift(', 'function checkSnapshotDriftRenamed(');
  assert.notEqual(renamed, source, 'the rename mutation did not land; the fixture is stale');
  const renamedComplaints = auditRegistry(renamed, EXCLUDED);
  assert.ok(
    renamedComplaints.some((c) => /EXCLUDED names checkSnapshotDrift, which checks.ts no longer/.test(c)),
    renamedComplaints.join('\n'),
  );

  // 4. An exclusion is a lie — the registry does call it after all.
  const lying = new Map(EXCLUDED);
  lying.set('checkCorpusSize', 'a reason that is not true');
  const lyingComplaints = auditRegistry(source, lying);
  assert.ok(
    lyingComplaints.some((c) => /EXCLUDED names checkCorpusSize, but runChecks' registry does call it/.test(c)),
    lyingComplaints.join('\n'),
  );

  // 5. An exclusion with no reason is not an exclusion.
  const empty = new Map(EXCLUDED);
  empty.set('checkCliOnPath', '   ');
  const emptyComplaints = auditRegistry(source, empty);
  assert.ok(
    emptyComplaints.some((c) => /checkCliOnPath is in EXCLUDED with an empty reason/.test(c)),
    emptyComplaints.join('\n'),
  );
});
