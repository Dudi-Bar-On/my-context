// @basis TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan, INV-nothing-is-dropped-silently, TASK-the-checks-file-splits-along-a-boundary-its-own-tests

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **`runChecks` is a hand-kept registry, and this is the derivation that stops
 * it being one.**
 *
 * `src/doctor/` declares a `check*` function per diagnostic and then lists
 * them, by hand, in an array inside `runChecks`. That is an INCLUSION list: a
 * check that exists and is not in the array runs nowhere, reports nothing, and
 * goes red in no gate. It has already happened once on record — the removal
 * review names one silent miss of exactly this shape — and the failure mode is
 * the one `a-scanner-names-what-it-skips-not-what-it-scans` exists against: *a
 * scanner that skips an input reports success. Nothing goes red. The only
 * evidence is the defect it let through, arriving later and looking like
 * something else.*
 *
 * The rule's second half is what is carried out here, because the first half
 * cannot be: `runChecks` must call each check with its own arguments, so it
 * cannot be inverted into "run everything except a skip list" — there is no
 * uniform thing to run. Where a list of inclusions is unavoidable the rule
 * says: **derive the set from the tree or the registry rather than typing it by
 * hand, and assert the derivation covers the real set in BOTH directions.**
 *
 * So every `check*` function DECLARED anywhere under `src/doctor/` is derived
 * from the sources, every name the registry array actually calls is derived
 * from the source, and the two are compared both ways:
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
 * ── WHY THE DERIVATION READS A TREE AND NOT ONE FILE ────────────────────────
 *
 * It read exactly `src/doctor/checks.ts`, by a hardcoded path, until
 * TASK-the-checks-file-splits-along-a-boundary-its-own-tests came to split that
 * file — and **a one-file derivation is blind in precisely the direction a
 * split moves code.** Move `checkFoo` to a sibling module and leave it out of
 * the registry, and the old guard saw no declaration, so it raised no
 * complaint: the check stops running and the guard that exists to notice says
 * nothing. That is the silent skip this file was built to refuse, reintroduced
 * by the refactor the file was supposed to make safe.
 *
 * The fix is the rule's own words — *derive the set from the tree* — so
 * `readDoctorModules` walks `src/doctor/` recursively and the audit runs over
 * every module it finds. A check is now covered by where it IS, not by which
 * path someone remembered to type here. `the derivation spans modules` below is
 * the assertion that this is true and not merely intended.
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
 * block extractor that returned the empty string, a tree walk that found one
 * file — passes on its first run too, and on every run after. So
 * `auditRegistry` is a pure function of the module list, and the mutation test
 * feeds it MUTATED module lists, one per failure above, asserting first that
 * the mutation actually landed and then that the audit reports it. The floors
 * in the first test (`>= 25` either side) close the last vacuous reading: a
 * derivation that finds nothing cannot be green here.
 */

const DOCTOR_DIR = path.resolve(import.meta.dirname, '..', '..', 'src', 'doctor');

/** One module of the doctor, as the derivation sees it. */
export interface DoctorModule {
  /** Path relative to `src/doctor/`, POSIX-separated, for messages. */
  readonly file: string;
  readonly source: string;
}

/**
 * **Every `.ts` file under `src/doctor/`, recursively.**
 *
 * The tree is the registry of modules, exactly as `runChecks`' array is the
 * registry of checks, and for the same reason: a list of files typed here would
 * be the very hand-kept inclusion list this file exists to replace. A new
 * module added in a split is covered the moment it is written, with nobody
 * remembering anything.
 */
export function readDoctorModules(dir: string): DoctorModule[] {
  const out: DoctorModule[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile() && entry.name.endsWith('.ts')) {
        out.push({ file: childRel, source: readFileSync(childAbs, 'utf8') });
      }
    }
  };
  walk(dir, '');
  out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return out;
}

/**
 * **Every `check*` function a source DECLARES, exported or not.**
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

/** The same, across a module list, keeping the module each name came from. */
export function declaredAcrossModules(modules: readonly DoctorModule[]): { name: string; file: string }[] {
  const out: { name: string; file: string }[] = [];
  for (const mod of modules) {
    for (const name of declaredCheckNames(mod.source)) out.push({ name, file: mod.file });
  }
  return out;
}

const REGISTRY_MARKER = 'const checks: (() => Finding[])[] = [';

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
  const start = source.indexOf(REGISTRY_MARKER);
  if (start === -1) return [];
  let depth = 0;
  let end = -1;
  for (let i = start + REGISTRY_MARKER.length - 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return [];
  const block = source.slice(start + REGISTRY_MARKER.length, end);
  const names: string[] = [];
  const re = /\b(check[A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) names.push(m[1]!);
  return names;
}

/** The modules that contain the registry array — expected to be exactly one. */
export function modulesWithRegistry(modules: readonly DoctorModule[]): DoctorModule[] {
  return modules.filter((m) => m.source.includes(REGISTRY_MARKER));
}

/**
 * **The checks `runChecks` deliberately does not call, and why.**
 *
 * Every reason here is already argued at length in the doctor sources
 * themselves, at the function it names; this list exists so the argument is
 * REACHABLE from the derivation instead of being something a reader has to
 * already know.
 */
export const EXCLUDED: ReadonlyMap<string, string> = new Map([
  [
    'checkCliOnPath',
    'answers a question about the MACHINE (is `mycontext` on this PATH), not about the corpus, ' +
    'so its answer differs between two clones of the same repository. `doctor.ts` calls it ' +
    'directly and folds it into its own exit code without folding it into `findings`/`counts`; ' +
    "`runChecks`' other callers (`status`, `ack`, the UI health widget) never run it and never " +
    'could. Its docblock says so in as many words.',
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
 * passes on the real sources can be shown failing on broken ones. Empty means
 * the registry and the tree agree.
 */
export function auditRegistry(
  modules: readonly DoctorModule[],
  excluded: ReadonlyMap<string, string>,
): string[] {
  const complaints: string[] = [];

  const holders = modulesWithRegistry(modules);
  if (holders.length === 0) {
    complaints.push(
      `no module under src/doctor/ contains runChecks' registry array (looked for ` +
      `\`${REGISTRY_MARKER}\`). The derivation can see no registry, so it can prove nothing ` +
      `about one — if the array moved or changed shape, teach this file its new shape.`,
    );
    return complaints;
  }
  if (holders.length > 1) {
    complaints.push(
      `${holders.length} modules contain runChecks' registry array ` +
      `(${holders.map((h) => h.file).join(', ')}); the derivation cannot tell which one runs.`,
    );
  }

  const declared = declaredAcrossModules(modules);
  const registered = registryNames(holders[0]!.source);
  const declaredIn = new Map(declared.map((d) => [d.name, d.file]));
  const registeredSet = new Set(registered);

  for (const { name, file } of declared) {
    if (registeredSet.has(name)) continue;
    const reason = excluded.get(name);
    if (reason === undefined) {
      complaints.push(
        `${name} is declared in src/doctor/${file} and is NOT in runChecks' registry array. A ` +
        `check that is not in the array runs nowhere and reports nothing, and no gate goes red. ` +
        `Add it to the array, or add it to EXCLUDED in this file with the reason it must not run.`,
      );
      continue;
    }
    if (reason.trim() === '') {
      complaints.push(`${name} is in EXCLUDED with an empty reason; the reason is the whole cost.`);
    }
  }

  for (const name of registered) {
    if (declaredIn.has(name)) continue;
    complaints.push(`runChecks' registry calls ${name}, which no module under src/doctor/ declares.`);
  }

  for (const [name] of excluded) {
    if (!declaredIn.has(name)) {
      complaints.push(
        `EXCLUDED names ${name}, which src/doctor/ no longer declares — a stale exclusion is ` +
        `where a later check with the same name would land pre-excused.`,
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

  const duplicated = new Map<string, string[]>();
  for (const { name, file } of declared) {
    if (!duplicated.has(name)) duplicated.set(name, []);
    duplicated.get(name)!.push(file);
  }
  for (const [name, files] of duplicated) {
    if (files.length > 1) {
      complaints.push(
        `${name} is declared in ${files.length} modules (${files.join(', ')}). A split that ` +
        `copied a check instead of moving it leaves two, and the registry runs only one.`,
      );
    }
  }

  return complaints;
}

/** The real tree, read once per test so a mutation in one cannot leak into another. */
function realModules(): DoctorModule[] {
  return readDoctorModules(DOCTOR_DIR);
}

/** Replace one module's source in a copy of the list, asserting the edit landed. */
function mutate(modules: readonly DoctorModule[], file: string, edit: (s: string) => string): DoctorModule[] {
  const out = modules.map((m) => ({ ...m }));
  const target = out.find((m) => m.file === file);
  assert.ok(target, `the mutation targets src/doctor/${file}, which the tree no longer has`);
  const next = edit(target.source);
  assert.notEqual(next, target.source, `the mutation of ${file} did not land; the fixture is stale`);
  target.source = next;
  return out;
}

test('every check function declared under src/doctor/ is registered, or excluded with a reason', () => {
  const modules = realModules();
  const declared = declaredAcrossModules(modules);
  const holders = modulesWithRegistry(modules);
  assert.equal(holders.length, 1, `expected exactly one registry array, found ${holders.length}`);
  const registered = registryNames(holders[0]!.source);

  // The floors: a derivation that found nothing would agree with anything.
  // These are not pinned counts — they may grow freely — they only refuse a
  // vacuous green.
  assert.ok(
    declared.length >= 25,
    `derived only ${declared.length} check declarations from src/doctor/; the extraction is ` +
    `broken, not the registry`,
  );
  assert.ok(
    registered.length >= 25,
    `derived only ${registered.length} registry entries from runChecks; the block extraction is ` +
    `broken, not the registry`,
  );

  assert.deepEqual(auditRegistry(modules, EXCLUDED), []);
});

test('the derivation spans modules — a check in a sibling module is covered by where it is', () => {
  // Half one: the reader really does read more than one file, and really does
  // recurse. Proven on a fixture tree, because proving it on src/doctor/ would
  // only say the tree equals itself.
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-doctor-tree-'));
  try {
    mkdirSync(path.join(dir, 'checks'), { recursive: true });
    writeFileSync(path.join(dir, 'top.ts'), 'export function checkTop(): void {}\n');
    writeFileSync(path.join(dir, 'checks', 'nested.ts'), 'export function checkNested(): void {}\n');
    writeFileSync(path.join(dir, 'notes.md'), 'not a module\n');
    const read = readDoctorModules(dir);
    assert.deepEqual(read.map((m) => m.file), ['checks/nested.ts', 'top.ts']);
    assert.deepEqual(declaredAcrossModules(read), [
      { name: 'checkNested', file: 'checks/nested.ts' },
      { name: 'checkTop', file: 'top.ts' },
    ]);
  } finally {
    removeTree(dir);
  }

  // And on the real tree it reads more than the one file it used to.
  const modules = realModules();
  assert.ok(modules.length >= 2, `read ${modules.length} module(s) from src/doctor/; expected the whole tree`);
  assert.ok(modules.some((m) => m.file === 'checks.ts'), 'checks.ts is missing from the derivation');
  assert.ok(modules.some((m) => m.file !== 'checks.ts'), 'the derivation still sees only checks.ts');

  // Half two — THE ONE THE SPLIT DEPENDS ON. A check declared in a module
  // OTHER than the one holding the registry, and absent from the registry, is
  // reported. Before this file read the tree, this exact case was silent.
  const moved = [...modules, { file: 'checks/moved.ts', source: 'export function checkMovedAndForgotten(i: number[]) {}\n' }];
  const complaints = auditRegistry(moved, EXCLUDED);
  assert.equal(complaints.length, 1, complaints.join('\n'));
  assert.match(
    complaints[0]!,
    /^checkMovedAndForgotten is declared in src\/doctor\/checks\/moved\.ts and is NOT in runChecks/,
  );
});

test('the derivation reports a red — one mutation per failure it claims to catch', () => {
  const modules = realModules();
  const registryFile = modulesWithRegistry(modules)[0]!.file;

  // 1. A check is dropped from the registry array. This is the incident that
  //    has already happened once, and the one this file exists for.
  const dropped = mutate(modules, registryFile, (s) => s.replace('    () => checkCorpusSize(opts.items),\n', ''));
  const droppedComplaints = auditRegistry(dropped, EXCLUDED);
  assert.equal(droppedComplaints.length, 1, droppedComplaints.join('\n'));
  assert.match(droppedComplaints[0]!, /^checkCorpusSize is declared .* NOT in runChecks/);

  // 2. A registry entry names a function no module declares.
  const phantom = mutate(modules, registryFile, (s) =>
    s.replace('    () => checkCorpusSize(opts.items),', '    () => checkCorpusSizeTypo(opts.items),'));
  const phantomComplaints = auditRegistry(phantom, EXCLUDED);
  assert.ok(
    phantomComplaints.some((c) => /registry calls checkCorpusSizeTypo, which no module/.test(c)),
    phantomComplaints.join('\n'),
  );

  // 3. An exclusion goes stale — the function it excuses is gone.
  const renamed = mutate(modules, 'checks.ts', (s) =>
    s.replace('function checkSnapshotDrift(', 'function checkSnapshotDriftRenamed('));
  const renamedComplaints = auditRegistry(renamed, EXCLUDED);
  assert.ok(
    renamedComplaints.some((c) => /EXCLUDED names checkSnapshotDrift, which src\/doctor\/ no longer/.test(c)),
    renamedComplaints.join('\n'),
  );

  // 4. An exclusion is a lie — the registry does call it after all.
  const lying = new Map(EXCLUDED);
  lying.set('checkCorpusSize', 'a reason that is not true');
  const lyingComplaints = auditRegistry(modules, lying);
  assert.ok(
    lyingComplaints.some((c) => /EXCLUDED names checkCorpusSize, but runChecks' registry does call it/.test(c)),
    lyingComplaints.join('\n'),
  );

  // 5. An exclusion with no reason is not an exclusion.
  const empty = new Map(EXCLUDED);
  empty.set('checkCliOnPath', '   ');
  const emptyComplaints = auditRegistry(modules, empty);
  assert.ok(
    emptyComplaints.some((c) => /checkCliOnPath is in EXCLUDED with an empty reason/.test(c)),
    emptyComplaints.join('\n'),
  );

  // 6. The registry array itself goes missing — the derivation must say it has
  //    been blinded, not quietly agree with everything.
  const blinded = mutate(modules, registryFile, (s) =>
    s.replace(REGISTRY_MARKER, 'const checks: Array<() => Finding[]> = ['));
  const blindedComplaints = auditRegistry(blinded, EXCLUDED);
  assert.equal(blindedComplaints.length, 1, blindedComplaints.join('\n'));
  assert.match(blindedComplaints[0]!, /^no module under src\/doctor\/ contains runChecks' registry array/);

  // 7. A split COPIES a check instead of moving it. Both declarations satisfy
  //    the registry, and the one nobody edits rots in place.
  const copied = [...modules, { file: 'checks/copy.ts', source: 'export function checkCorpusSize(i: number[]) {}\n' }];
  const copiedComplaints = auditRegistry(copied, EXCLUDED);
  assert.ok(
    copiedComplaints.some((c) => /checkCorpusSize is declared in 2 modules/.test(c)),
    copiedComplaints.join('\n'),
  );
});
