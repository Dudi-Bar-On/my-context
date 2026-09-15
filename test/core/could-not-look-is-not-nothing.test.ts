/**
 * `plan:swallow seq:11` — twenty-one one-line swallows where the docstring
 * asserts what the catch denies.
 *
 * THE RULE THIS FILE PINS, which is the item's real output and is worth more
 * than any one of the twenty-one lines:
 *
 *   **A `catch` may swallow around an ACTION. It may not swallow around an
 *   ANSWER.** An action's failure costs the action; fail open and disclose.
 *   An answer's failure changes what the CALLER BELIEVES ABOUT THE WORLD, and
 *   there the failure belongs in the return value — a different value from the
 *   one a successful look would have produced, with the reason attached. Three
 *   questions decide it, and all three must pass before a catch may swallow:
 *
 *     1. IDENTIFIED — is the caught condition narrowed (`.code`, `instanceof`)
 *        to the one the comment names? Only `ENOENT` is absence.
 *     2. ACTION, NOT ANSWER — is the value returned a claim about the world
 *        someone will act on ("nothing matched", "not torn", "no symlinks",
 *        "nothing to remove")? Then it must not swallow.
 *     3. READ — does something downstream read the disclosure? A field that
 *        records a refusal is not a disclosure until something reads it.
 *
 * Each test below is one of the twenty-one, and names which.
 *
 * WHAT CAN AND CANNOT BE BUILT ON THIS PLATFORM, stated rather than faked.
 * `icacls /deny` does not bite for this account, so no EACCES can be produced
 * against a real file here. What CAN be: a DIRECTORY where a file should be
 * (`readFileSync` → `EISDIR`) and a FILE where a directory should be
 * (`readdirSync` → `ENOTDIR`). Both are non-`ENOENT` refusals over a path that
 * exists, which is exactly the question. Where even that is unreachable the
 * test says so instead of claiming coverage.
 *
 * @basis INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { computeDecay } from '../../src/core/decay.ts';
import { clearFocus, focusPath } from '../../src/core/focus.ts';
import { handoverBlock, readHandover } from '../../src/core/handover.ts';
import { carryOnceErrorNote, carryOncePath, readCarryOnce, spendCarryOnce } from '../../src/core/ledger.ts';
import { restingTestsSaid, testTreeFiles, testsRestingOn } from '../../src/core/tests-resting-on.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseHookInput } from '../../src/hooks/io.ts';
import { loadSessionDigests, recordSessionDigest, sessionsPath } from '../../src/core/ui-sessions.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const scratch: string[] = [];
function tmp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  scratch.push(dir);
  return dir;
}
test.after(() => { for (const dir of scratch) removeTree(dir); });

/* --- m11 · `clearFocus` said "there was nothing to remove" when it could not look --- */

test('m11 · a focus that could not be looked at is not reported as no focus at all', () => {
  const root = path.join(tmp('swallow-focus-'), '.my_context');
  mkdirSync(path.join(root, 'state'), { recursive: true });

  // The measured absence first, so the failure below is not the only shape
  // this function has ever been seen to produce.
  assert.deepEqual(
    clearFocus(root), { removed: false, error: null },
    'a workspace with no focus file must still answer a MEASURED nothing',
  );

  // A directory where `focus.json` should be: `readFileSync` answers EISDIR,
  // which is a path that EXISTS and was not read.
  mkdirSync(focusPath(root));
  const blind = clearFocus(root);
  assert.equal(blind.removed, false);
  assert.notEqual(
    blind.error, null,
    'clearFocus reported "there was nothing to remove" for a focus it could not look at. '
    + '`readFocus`, eighty lines above in the same file, discriminates ENOENT correctly — the '
    + 'inconsistency inside one file is the tell.',
  );
  assert.match(String(blind.error), /EISDIR|could not be/u);
});

/* --- m2/m3 · the carry queue, and the reader that never read it --- */

test('m2 · a carry queue that could not be read does not print as "nothing carried"', () => {
  const root = path.join(tmp('swallow-carry-'), '.my_context');
  mkdirSync(path.join(root, 'state'), { recursive: true });

  assert.deepEqual(
    readCarryOnce(root), { ids: [], error: null },
    'a workspace that never marked anything answers a measured nothing',
  );

  mkdirSync(carryOncePath(root));
  const blind = readCarryOnce(root);
  assert.deepEqual(blind.ids, []);
  assert.notEqual(
    blind.error, null,
    '`carry --show` printed "nothing carried" for a queue it could not read, under a docstring '
    + 'that says it degrades to "nothing is carried" AND SAYS SO.',
  );
});

test('m3 · the queue error has a READER — it reaches the block the model is given', () => {
  const root = path.join(tmp('swallow-carry-note-'), '.my_context');
  mkdirSync(path.join(root, 'state'), { recursive: true });
  writeFileSync(carryOncePath(root), '{ not json', 'utf8');

  const spent = spendCarryOnce(root);
  assert.deepEqual(spent.ids, [], 'nothing was spent, because nothing could be read');
  assert.notEqual(spent.error, null, 'and the producer says why');

  // **The half that was missing.** `spendCarryOnce` has returned `error` all
  // along and `foldOnceCarry` — its only caller — destructured it away, so the
  // injected block was identical whether the queue was empty or unreadable.
  const note = carryOnceErrorNote(spent.error);
  assert.notEqual(note, '', 'the sentence exists');
  assert.match(note, /carry-once\.json/u);
  assert.equal(carryOnceErrorNote(null), '', 'and says nothing when there is nothing to say');

  // **And the sentence is WIRED, not merely correct beside the producer.**
  // The idiom is `execute-effect.test.ts`'s "the filter is WIRED to the copy":
  // a note nobody composes is the same defect one step along, and this whole
  // item is about values that were returned and never read. `foldOnceCarry`
  // is the only caller of the only producer, and `buildInjection` is the only
  // caller of `foldOnceCarry`.
  const inject = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', 'inject.ts'), 'utf8');
  assert.match(
    inject, /carryOnceErrorNote\(/u,
    'nothing in inject.ts composes the sentence, so a queue that could not be read reaches the '
    + 'model as an ordinary injection again',
  );
  assert.match(
    inject, /carryError \? `/u,
    'and nothing puts it into the block — a note that is composed and not concatenated is the '
    + 'same drop with an extra step',
  );
});

/* --- m9 · an unreadable handover reported itself missing --- */

test('m9 · "the file is not there" and "the file is there and refused" are different sentences', () => {
  const repo = tmp('swallow-handover-');
  const gone = readHandover(repo, { path: 'reports/NOT-THERE.md', marker: '#', budgetTokens: 100 });
  assert.equal(gone.state, 'missing', 'a file that is genuinely absent is still MISSING');

  // **A platform limit, stated rather than faked.** Reaching `unreadable`
  // needs `statSync().isFile()` to be TRUE and the following `readFileSync` to
  // throw; a directory at the path makes `isFile()` false (the `missing`
  // branch, correctly), `icacls /deny` does not bite for this account, and a
  // file used as a directory component answers ENOENT on Windows. So the
  // ROUTING is not exercised here; what is asserted is that the state exists
  // and that a reader is told something different by it — which is the half
  // that was missing, since `missing` sends a person to look for a file that
  // is sitting exactly where the key says it is.
  const refused = handoverBlock({ state: 'unreadable', path: 'reports/HANDOVER.md', error: 'EACCES' });
  const absent = handoverBlock({ state: 'missing', path: 'reports/HANDOVER.md' });
  assert.notEqual(refused, absent);
  assert.match(refused, /IS there and could not be read/u);
  assert.match(refused, /EACCES/u);
  assert.match(absent, /there is no file there/u);
});

/* --- m12 · an unreadable test file read as a test that declares nothing --- */

test('m12 · a test tree that could not be walked is named, not folded into "no test declares this"', () => {
  const repo = tmp('swallow-resting-');
  mkdirSync(path.join(repo, 'e2e'));
  writeFileSync(path.join(repo, 'e2e', 'a.spec.ts'), '// @basis RULE-x\n', 'utf8');
  // A FILE where the `test/` tree should be: `readdirSync` answers ENOTDIR.
  writeFileSync(path.join(repo, 'test'), 'not a directory', 'utf8');

  const walked = testTreeFiles(repo);
  assert.deepEqual(walked.files, ['e2e/a.spec.ts'], 'the readable tree was still walked');
  assert.equal(walked.truncated, false, 'and the ceiling is not what stopped it');
  assert.equal(
    walked.unreadable.length, 1,
    'a tree that refused the walk was reported as a tree with nothing in it',
  );
  assert.match(walked.unreadable[0]!, /^test\/ \(ENOTDIR\)/u);

  const found = testsRestingOn(repo, 'RULE-y', []);
  const said = restingTestsSaid('RULE-y', found);
  assert.match(
    said, /COULD NOT BE READ/u,
    'the paragraph a person is shown at the moment of retiring an item claimed "no test '
    + 'declares @basis RULE-y" over a tree nothing looked inside.',
  );
  assert.match(said, /ENOTDIR/u);
});

test('m12 · a tree that is simply absent is NOT reported as unreadable', () => {
  const repo = tmp('swallow-resting-clean-');
  mkdirSync(path.join(repo, 'test'));
  writeFileSync(path.join(repo, 'test', 'a.test.ts'), '// @basis RULE-x\n', 'utf8');
  const walked = testTreeFiles(repo);
  assert.deepEqual(
    walked.unreadable, [],
    '`e2e/` does not exist here, and ENOENT is absence — a disclosure that fires on every '
    + 'ordinary project is a disclosure nobody reads',
  );
  assert.deepEqual(walked.files, ['test/a.test.ts']);
});

/* --- m1 · `readStdin`'s catch was wider than its comment, at the product's door --- */

test('m1 · a stdin that REFUSED is not an interactive run with no payload', () => {
  // The case the comment names, still answered exactly as before: nothing was
  // sent, nothing was lost, nothing is disclosed. A fix that made every
  // interactive run noisy would be a worse defect than the silence it replaces.
  assert.equal(parseHookInput({ text: '', unreadable: null }).parseError, null);
  assert.equal(parseHookInput({ text: '   \n', unreadable: null }).parseError, null);

  // The case the comment did NOT name. `readFileSync(0)` throws EAGAIN on a
  // non-blocking pipe — a payload that ARRIVED and was lost — and that used to
  // return `''`, which three modules then cite this function's own docstring to
  // explain away as "an interactive run with no stdin".
  const refused = parseHookInput({ text: '', unreadable: 'EAGAIN' });
  assert.deepEqual(refused.input, {}, 'it still fails open — no payload, no throw');
  assert.match(
    String(refused.parseError), /stdin could not be read \(EAGAIN\)/u,
    'an empty payload and a pipe that refused reached every hook as the same value, so a '
    + 'session with no session_id, no source and no transcript_path looked ordinary.',
  );
});

/* --- m4 · the UI session store answered "first run" for a store it could not read --- */

test('m4 · a session store that exists and could not be read says so, and is not overwritten', () => {
  const dir = tmp('swallow-uisessions-');
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = dir;
  try {
    assert.deepEqual(
      loadSessionDigests(), { digests: [], error: null },
      'the ordinary first run: no store, and that is a measured nothing',
    );

    // A directory where `sessions.json` should be: EISDIR, a path that exists
    // and was not read.
    mkdirSync(sessionsPath());
    const blind = loadSessionDigests();
    assert.deepEqual(blind.digests, []);
    assert.notEqual(
      blind.error, null,
      'the docstring says `error` is non-null whenever a file EXISTS and could not be used. '
      + 'Every open tab is locked out here and the channel built to explain it was silent.',
    );

    // And the write REFUSES rather than rebuilding the store from an empty
    // base: that rewrite discarded every digest ever issued and reported
    // `written: true` for having done it.
    const wrote = recordSessionDigest('a'.repeat(64));
    assert.equal(wrote.written, false);
    assert.match(String(wrote.error), /Nothing was written/u);
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
  }
});

test('m4 · a store that parses to something that is not this store is still recoverable in place', () => {
  const dir = tmp('swallow-uisessions-corrupt-');
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = dir;
  try {
    writeFileSync(sessionsPath(), '42', 'utf8');
    assert.notEqual(
      loadSessionDigests().error, null,
      'a JSON scalar is not this store, and used to answer `error: null`',
    );
    // The bytes WERE read, so overwriting costs a still-open tab one re-opened
    // link and nothing else. Only a store that could not be READ refuses the
    // write — the distinction the fix turns on.
    assert.equal(recordSessionDigest('b'.repeat(64)).written, true);
    assert.deepEqual(loadSessionDigests().digests, ['b'.repeat(64)]);
  } finally {
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
  }
});

/* --- m13 · a renamed category made its items silently not-normative --- */

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: ['src/**'], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('m13 · items whose category the config does not declare are counted, not dropped', () => {
  const report = computeDecay({
    items: [
      item({ id: 'CONST-known', type: 'constraint' }),
      item({ id: 'X-one', type: 'rationale-renamed' }),
      item({ id: 'X-two', type: 'rationale-renamed' }),
    ],
    config: CONFIG,
    usage: [],
    recentlyUsed: [],
    window: 10,
    sessionsRecorded: 3,
  });

  assert.deepEqual(
    report.unknownCategory, [{ type: 'rationale-renamed', count: 2 }],
    'rename a category in config.json and every item still carrying the old type left this '
    + 'report entirely — not cold, not warm, not counted, and never reviewed for retirement '
    + 'again. `?.tier !== "normative"` made an ABSENT category answer "not normative".',
  );
  assert.equal(
    report.cold.concat(report.warm).some((r) => r.type === 'rationale-renamed'), false,
    'and they are still in neither bucket, because no tier could be established for them — '
    + 'the disclosure is the fix, not a fourth bucket',
  );
  assert.ok(report.cold.some((r) => r.id === 'CONST-known'), 'the ordinary census still runs');
});

test('m13 · a config that declares every type present reports an empty unknown list', () => {
  const report = computeDecay({
    items: [item({ id: 'CONST-known', type: 'constraint' })],
    config: CONFIG,
    usage: [],
    recentlyUsed: [],
    window: 10,
    sessionsRecorded: 3,
  });
  assert.deepEqual(
    report.unknownCategory, [],
    'empty is the ordinary answer and means the census covered everything eligible',
  );
});
