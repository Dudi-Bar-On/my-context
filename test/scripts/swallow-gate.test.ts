// @basis TASK-the-gate-for-the-swallow-class-was-proposed-twice-and-built, TASK-d70-closed-all-five-instances-and-never-built-the-gate-the, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The swallow gate, proved by planting each class it claims to detect.**
 *
 * Two items asked for one gate, from opposite ends of the same event:
 *
 *   - `TASK-the-gate-for-the-swallow-class-was-proposed-twice-and-built` —
 *     report 3 proposed a gate for the swallowed `catch`, the consolidation
 *     carried twelve INSTANCES forward and the gate nowhere, so "nothing stops
 *     the thirteenth being written tomorrow".
 *   - `TASK-d70-closed-all-five-instances-and-never-built-the-gate-the` — the
 *     same report proposed a gate for a returned write flag nobody binds, all
 *     five known readers were fixed, and "a fifteenth arrives with the next
 *     hook".
 *
 * So what is proved here is that the gate SEES each class and, just as
 * important, that it does NOT see the swallows this project keeps on purpose.
 * `src/core/line-walk.ts` records a state and continues; `src/core/jsonl-log.ts`
 * memoises one; 195 `catch` blocks in this tree carry a written argument and
 * nothing else. The subject is SILENCE, not `catch` — a gate that reddened on
 * `catch` would be turned off within the day, which is how the first two
 * proposals for it died.
 *
 * Every fixture below is PLANTED in a throwaway git repository, never asserted
 * against the live tree, so nothing here changes meaning when a lane edits a
 * source file. The two live-tree cases at the bottom are deliberately narrow
 * and say in their own names what they measure.
 *
 * **On the unread tier and today's tree.** The gate is red at three shipped
 * sites the day it was built — `src/core/inject.ts` (the injection's own audit
 * record), `src/hooks/post-tool-use.ts` (`bumpCounter`) and
 * `src/rules/delivered.ts` (`recordDelivery`). That is the gate working: the
 * item predicted exactly this caller. No assertion below pins that count,
 * because the count is the TREE's state and is meant to reach zero; what is
 * pinned is that the tier can see every one of the six producers, which is the
 * property that would rot silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  CLASS_EMPTY_CATCH, CLASS_MUTE_HANDLER, CLASS_UNREAD_RESULT, PRODUCERS,
  SKIP_NOT_SOURCE, SKIP_VENDOR, emptyCatches, mutedHandlers, partition,
  producerCallSites, shippedRoots, skipReason, sources, summarise, unreadResults,
} from '../../scripts/check-swallows.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-swallows.ts');

/** A throwaway git repository with a ship list, so `partition` has something real to read. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'swallow-gate-'));
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'f', files: ['src/', 'hooks/'] }, null, 2),
  );
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(dir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  spawnSync('git', ['-C', dir, 'init', '-q'], { encoding: 'utf8' });
  spawnSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
  return dir;
}

function run(root: string): { status: number; out: string } {
  const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

// ── class 1: the catch that says nothing at all ───────────────────────────

test('an empty catch is a finding, and a catch that argues in its body is not', () => {
  const src = [
    'export function a() {',
    '  try { read(); } catch {}',                       // line 2 — finding
    '}',
    'export function b() {',
    '  try { read(); } catch { /* ENOENT: there is no file yet */ }',
    '}',
    'export function c() {',
    '  try { read(); } catch (e) {',
    '    // Recorded and carried on — see `line-walk.ts`.',
    '    state.unreadable = String(e);',
    '  }',
    '}',
    'export function d() {',
    '  try { read(); } catch (e) { record(e); throw e; }',
    '}',
  ].join('\n');
  const found = emptyCatches('src/a.ts', src);
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}`), ['src/a.ts:2']);
  assert.equal(found[0].cls, CLASS_EMPTY_CATCH);
});

test('a catch whose argument is only a string or a regex is still empty', () => {
  // The masking lexer must not read a comment out of a string literal, and must
  // not mistake a division for a regex. Both would make a swallow invisible.
  const src = [
    'const url = "https://example.invalid/* not a comment */";',
    'const half = total / 2; const re = /\\/\\* nor this \\*\\//;',
    'try { go(); } catch {}',
  ].join('\n');
  assert.deepEqual(emptyCatches('src/b.ts', src).map((f) => f.line), [3]);
});

// ── class 2: the rejection handler that says nothing at all ───────────────

test('a mute rejection handler is a finding', () => {
  const src = [
    'ping().catch(() => {});',
    'load().catch(() => null);',
    'save().catch((e) => undefined);',
    'tick().catch(() => void 0);',
  ].join('\n');
  const found = mutedHandlers('src/c.ts', src);
  assert.deepEqual(found.map((f) => f.line), [1, 2, 3, 4]);
  assert.equal(found[0].cls, CLASS_MUTE_HANDLER);
});

test('a rejection handler that argues — in it, after it, above it, or above its function — is not a finding', () => {
  const inBody = 'ping().catch(() => { /* fail open: INV-hooks-fail-open */ });';
  const trailing = 'ping().catch(() => {}); // fail open, and the hook says so on stderr';
  const aboveStatement = [
    '// The roster is caught into null: a list this page could not read must',
    '// not take the document down with it.',
    'const roster = readJson(url).then(pick).catch(() => null);',
  ].join('\n');
  const aboveFunction = [
    '/**',
    ' * Still `.catch(() => {})`: a heartbeat that cannot reach the server is',
    " * `showExited()`'s business, raised by `api()` itself.",
    ' */',
    'function heartbeatPing() {',
    '  return api("/api/ping").then(note).catch(() => {});',
    '}',
  ].join('\n');
  for (const [what, src] of Object.entries({ inBody, trailing, aboveStatement, aboveFunction })) {
    assert.deepEqual(mutedHandlers('src/d.ts', src), [], `${what} was read as silence`);
  }
});

test('the older and quieter spellings of a mute handler are findings too', () => {
  const src = [
    'const noop = () => {};',
    'ping().catch(noop);',
    'ping().catch(function () {});',
    'load().then(useIt, () => {});',
    'load().then(useIt, noop);',
  ].join('\n');
  assert.deepEqual(mutedHandlers('src/f.ts', src).map((f) => f.line), [2, 3, 4, 5]);
});

test('a named handler this file does not declare empty is left alone', () => {
  const src = [
    'ping().catch(reportAndRethrow);',
    'ping().then(useIt, warnLoudly);',
    'const shout = () => { log("x"); };',
    'ping().catch(shout);',
  ].join('\n');
  assert.deepEqual(mutedHandlers('src/g.ts', src), []);
});

test('a handler that does something is never a finding, whatever it returns', () => {
  const src = [
    'load().catch((e) => { warn(e); return null; });',
    'load().catch((e) => fallback(e));',
    'load().catch(reportAndRethrow);',
  ].join('\n');
  assert.deepEqual(mutedHandlers('src/e.ts', src), []);
});

/**
 * **The positive control for the attachment walk, which is the only reason this
 * class is more than a grep.** Two of the argued fixtures contain the literal
 * text a naive matcher looks for. If the walk ever stops working, the gate
 * reddens on `app.js`'s heartbeat and `doc.js`'s roster — both correct code —
 * and gets switched off. So: prove the naive grep WOULD fire, and that this
 * gate does not.
 */
test('the fixtures a naive grep would redden are exactly the ones the walk clears', () => {
  const NAIVE = /\.catch\(\(\)\s*=>\s*\{\}\)/;
  const trailing = 'ping().catch(() => {}); // fail open, and the hook says so on stderr';
  const aboveFunction = [
    '/**',
    ' * Still `.catch(() => {})`: a heartbeat that cannot reach the server is',
    " * `showExited()`'s business, raised by `api()` itself.",
    ' */',
    'function heartbeatPing() {',
    '  return api("/api/ping").then(note).catch(() => {});',
    '}',
  ].join('\n');
  for (const [what, src] of Object.entries({ trailing, aboveFunction })) {
    assert.ok(NAIVE.test(src), `${what} is not a control — the naive grep does not match it`);
    assert.deepEqual(mutedHandlers('src/n.ts', src), [], `${what} was read as silence`);
  }
});

// ── class 3: the write result nobody binds ────────────────────────────────

test('the six producers report 3 names, and each one is carried with what it returns', () => {
  const names = [...PRODUCERS.keys()].toSorted();
  assert.deepEqual(names, [
    'bumpCounter', 'readStagingDir', 'recordAudit', 'recordDecline',
    'recordDelivery', 'writeState',
  ]);
  for (const [name, producer] of PRODUCERS) {
    assert.ok(producer.lost.length > 0, `${name} is listed with no reason a caller must read it`);
    assert.ok(producer.module.endsWith('.ts'), `${name} is listed with no declaring module`);
  }
});

/**
 * `\\bwriteState\\s*\\(` on its own flags any unrelated local of that name, and a
 * gate that reports someone else's function is a gate people learn to
 * disbelieve. Resolution is a direct named import from the producer's module,
 * or being that module.
 */
test('an unrelated function of the same name is not the producer', () => {
  const stranger = [
    'function writeState(a, b) { return true; }',
    'writeState(a, b);',
  ].join('\n');
  assert.deepEqual(unreadResults('src/other/widget.ts', stranger), []);
  // The producer's OWN module needs no import.
  assert.deepEqual(
    unreadResults('src/core/ui-server-upkeep.ts', stranger).map((f) => f.line), [2],
  );
  // And so does a file that imports it from there.
  const importer = [
    "import { writeState } from '../core/ui-server-upkeep.ts';",
    'writeState(a, b);',
  ].join('\n');
  assert.deepEqual(unreadResults('src/ui/x.ts', importer).map((f) => f.line), [2]);
});

const IMPORTS = [
  "import { recordAudit } from '../core/audit.ts';",
  "import { bumpCounter } from '../core/review-counter.ts';",
  "import { writeState } from '../core/ui-server-upkeep.ts';",
  "import { recordDelivery } from '../rules/delivered.ts';",
].join('\n');
/** Line 1 of the fixture body, once the four import lines are prepended. */
const BODY = 5;

function withImports(...lines: string[]): string {
  return `${IMPORTS}\n${lines.join('\n')}`;
}

test('a producer call made as a statement is a finding; a bound one is not', () => {
  const found = unreadResults('src/f.ts', withImports(
    'recordAudit(root, { kind: "injection" });',              // BODY + 0 — finding
    'const r = recordAudit(root, input); use(r);',
    'return recordAudit(root, input);',
    'if (!recordAudit(root, input).written) warn();',
    'const { written } = await recordAudit(root, input);',
    'void bumpCounter(root, id);',                            // BODY + 5 — finding
    'if (ready) writeState(root, state);',                    // BODY + 6 — finding
    'const ok = writeState(root, state) ? a : b; use(ok);',
    'disclose(recordDelivery(root, row));',
  ));
  assert.deepEqual(found.map((f) => f.line), [BODY, BODY + 5, BODY + 6]);
  assert.equal(found[0].cls, CLASS_UNREAD_RESULT);
  assert.equal(found[0].producer, 'recordAudit');
});

/**
 * **The shapes that read as bound and are not.** `unread/6` asks this tier to
 * fail CLOSED on an unrecognised call site; reading "dropped" as "called as a
 * statement" let five spellings of the same discard through. These are the ones
 * a lexer can answer honestly. The ones it cannot — a result pushed into an
 * array, passed as an argument, or read only on a branch that cannot run — are
 * in the printed blind-spot list instead of being guessed at.
 */
test('a binding nobody reads, and a value computed into nothing, are both dropped', () => {
  const found = unreadResults('src/g.ts', withImports(
    'function a() { const _ = recordAudit(root, input); }',
    'function b() { const written = recordAudit(root, input); }',
    'function c() { ok && recordAudit(root, input); }',
    'function d() { ok ? recordAudit(root, input) : 0; }',
    'function e() { switch (k) { case 1: recordAudit(root, input); } }',
    'function f() { maybe ?? recordAudit(root, input); }',
  ));
  assert.deepEqual(
    found.map((f) => f.line),
    [BODY, BODY + 1, BODY + 2, BODY + 3, BODY + 4, BODY + 5],
  );
  assert.match(found[0].why, /_/, 'the `_` case must say why `_` is not a reader');
  assert.match(found[1].why, /never read again/);
});

test('a binding that IS read later is not a finding', () => {
  const found = unreadResults('src/h.ts', withImports(
    'function a() {',
    '  const answer = recordAudit(root, input);',
    '  if (!answer.written) process.stderr.write(answer.error);',
    '}',
    'function b() {',
    '  const ok = writeState(root, state);',
    '  return ok ? 1 : 0;',
    '}',
    'function c() { return ok && recordDelivery(root, row); }',
    'function d() { const r = bumpCounter(root, id); return r.written; }',
  ));
  assert.deepEqual(found, []);
});

test('a producer DECLARATION is not a call site', () => {
  const src = [
    'export function recordAudit(root: string, input: AuditInput): AuditWriteResult {',
    '  return { written: true, error: null };',
    '}',
  ].join('\n');
  assert.deepEqual(unreadResults('src/core/audit.ts', src), []);
});

/**
 * The anti-vacuity seam for the tier as a whole: `producerCallSites` classifies
 * EVERY call, read or dropped, so a test can prove the tier still sees the
 * producers rather than passing because its matcher stopped matching.
 */
test('every producer call is classified, kept ones included', () => {
  const sites = producerCallSites('src/i.ts', withImports(
    'const r = recordAudit(root, input); use(r);',
    'recordAudit(root, input);',
  ));
  assert.deepEqual(sites.map((s) => s.dropped === ''), [true, false]);
  assert.deepEqual(sites.map((s) => s.producer), ['recordAudit', 'recordAudit']);
});

// ── the population: what is scanned, what is gated, what is skipped ───────

test('the ship list is read from package.json rather than kept by this gate', () => {
  const dir = fixture({ 'src/a.ts': '', 'test/a.test.ts': '' });
  try {
    assert.deepEqual(shippedRoots(dir).include, ['src/', 'hooks/']);
  } finally {
    removeTree(dir);
  }
});

test('the only two skips carry a reason, and an extension nobody declared is read', () => {
  assert.equal(skipReason('src/ui/public/lib/vendor/markdown-it.esm.min.js'), SKIP_VENDOR);
  assert.equal(skipReason('docs/guide.md'), SKIP_NOT_SOURCE);
  assert.equal(skipReason('reports/x.html'), SKIP_NOT_SOURCE);
  // Read, not waved through: an unknown source flavour is the input that needed
  // the gate, and `.jsx`/`.mts` arrive without anyone editing this file.
  for (const file of ['src/a.ts', 'src/b.mts', 'src/c.cjs', 'src/d.jsx', 'e2e/e.spec.ts']) {
    assert.equal(skipReason(file), null, `${file} was declined`);
  }
});

test('only the shipped sources gate; everything else read is reported', () => {
  const roots = { include: ['src/', 'hooks/'], exclude: ['src/ui/maintenance/'] };
  const { gated, reported } = partition([
    'src/core/a.ts', 'src/ui/public/app.js', 'hooks/h.ts', 'test/a.test.ts',
    'e2e/a.spec.ts', 'scripts/s.ts', 'src/ui/maintenance/m.ts',
  ], roots);
  assert.deepEqual(gated.toSorted(), ['hooks/h.ts', 'src/core/a.ts', 'src/ui/public/app.js']);
  assert.deepEqual(reported.toSorted(), [
    'e2e/a.spec.ts', 'scripts/s.ts', 'src/ui/maintenance/m.ts', 'test/a.test.ts',
  ]);
});

test('the summary names what was gated, what was reported only, and what was skipped with why', () => {
  const line = summarise(
    {
      scanned: ['src/a.ts', 'test/a.test.ts', 'e2e/b.spec.ts'],
      skipped: [{ file: 'src/ui/public/lib/vendor/x.js', why: SKIP_VENDOR }],
    },
    ['src/a.ts'], ['test/a.test.ts', 'e2e/b.spec.ts'],
  );
  assert.match(line, /1 gated/);
  assert.match(line, /2 scanned and reported/);
  assert.match(line, /skipped 1/);
  assert.match(line, new RegExp(SKIP_VENDOR.split(' ')[0]));
  assert.match(line, /not tracked:/, 'what the walk never saw is named too');
});

// ── the gate itself: exit code and the printed line ───────────────────────

test('a planted swallow in shipped code exits 1 and prints file, line and class', () => {
  const dir = fixture({
    'src/bare.ts': 'export function a() {\n  try { read(); } catch {}\n}\n',
    'src/mute.ts': 'export function b() {\n  return load().catch(() => {});\n}\n',
    'src/unread.ts': "import { recordAudit } from './core/audit.ts';\n"
      + 'export function c() {\n  recordAudit(root, input);\n}\n',
  });
  try {
    const { status, out } = run(dir);
    assert.equal(status, 1, out);
    assert.match(out, new RegExp(`src/bare\\.ts:2\\b`), out);
    assert.match(out, new RegExp(`src/mute\\.ts:2\\b`), out);
    assert.match(out, new RegExp(`src/unread\\.ts:3\\b`), out);
    for (const cls of [CLASS_EMPTY_CATCH, CLASS_MUTE_HANDLER, CLASS_UNREAD_RESULT]) {
      assert.match(out, new RegExp(cls), `${cls} was found and never named`);
    }
    assert.match(out, /recordAudit/, 'the producer whose answer was dropped must be named');
  } finally {
    removeTree(dir);
  }
});

test('the same swallows outside the ship list are reported and do not fail the run', () => {
  const dir = fixture({
    'src/fine.ts': 'export function a() {\n  try { read(); } catch { /* argued */ }\n}\n',
    'test/a.test.ts': 'try { read(); } catch {}\n',
    'e2e/b.spec.ts': 'await click().catch(() => {});\n',
  });
  try {
    const { status, out } = run(dir);
    assert.equal(status, 0, out);
    // Counted per tree per class, never listed line by line — see `countUngated`
    // and the ruling above `check:cited-items` in `ci.yml`: 270 never-gating
    // lines in a green log manufacture the appearance of coverage.
    assert.match(out, /test\/\s+1 empty-catch in 1 file\(s\)/, out);
    assert.match(out, /e2e\/\s+1 mute-handler in 1 file\(s\)/, out);
    assert.match(out, /NOT gated/i);
  } finally {
    removeTree(dir);
  }
});

test('a gate that can see nothing refuses rather than reporting a clean scan', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'swallow-empty-'));
  try {
    spawnSync('git', ['-C', dir, 'init', '-q'], { encoding: 'utf8' });
    const { status, out } = run(dir);
    assert.notEqual(status, 0, 'an empty population must not pass');
    assert.match(out, /INV-nothing-is-dropped-silently|no file/i, out);
  } finally {
    removeTree(dir);
  }
});

// ── the live tree ─────────────────────────────────────────────────────────

test('this repository ships no catch and no rejection handler that says nothing', () => {
  const { gated } = partition(sources(REPO).scanned, shippedRoots(REPO));
  const findings = [
    ...gated.flatMap((f) => emptyCatches(f, read(f))),
    ...gated.flatMap((f) => mutedHandlers(f, read(f))),
  ];
  assert.deepEqual(
    findings.map((f) => `${f.cls} ${f.file}:${f.line}`), [],
    'phase 4 cleared these; a new one is the thirteenth instance the item names',
  );
  // Anti-vacuity: the two above mean nothing if the population collapsed.
  assert.ok(gated.length > 300, `only ${gated.length} shipped source(s) scanned`);
});

test('the unread tier can see every one of the six producers in this tree', () => {
  const files = sources(REPO).scanned;
  const seen = new Set<string>();
  let sites = 0;
  for (const file of files) {
    for (const site of producerCallSites(file, read(file))) {
      seen.add(site.producer);
      sites += 1;
    }
  }
  assert.deepEqual([...seen].toSorted(), [...PRODUCERS.keys()].toSorted(),
    'a producer this gate can no longer find is a gate that passes by not looking');
  assert.ok(sites > 100, `only ${sites} call site(s) classified`);
});

function read(rel: string): string {
  return readFileSync(path.join(REPO, rel), 'utf8');
}
