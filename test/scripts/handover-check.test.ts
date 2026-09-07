// @basis TASK-a-handover-pointer-at-a-retired-lane-is-not-dangling-and-the, TASK-code-and-tests-that-speak-with-a-retired-item-s-authority, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The handover truth check, proved by planting what it must refuse.**
 *
 * `scripts/check-handover.ts` reads `reports/V2-HANDOVER.md` and asks two
 * questions nothing asked before: does every pointer in it name something that
 * exists, and is any instruction being carried forward session after session
 * over work that never closes. The second question is the one that matters —
 * six carries and no closure is what the `isServableDocPath` defect looked like
 * from outside, and a lane that followed it faithfully would have shipped a
 * feature that served nothing and passed every gate.
 *
 * A checker is not verified until it has been made red (`check-retired.ts` says
 * so in its own comments, having been caught passing everything once). So every
 * clause below is demonstrated by PLANTING the thing it must complain about and
 * requiring the specific complaint.
 *
 * **The anti-vacuity tests come first and are the ones that matter most.** Every
 * plant is worthless if the scanner cannot see the real document: a regex that
 * silently stopped matching would report zero dangling pointers, zero carries,
 * and read as a clean bill of health over 2,831 lines it never looked at. That
 * is the exact failure — a report correct about what it measured and silent
 * about what it missed — that this whole check exists to end. So the scanner is
 * first required to find the REAL blocks and the REAL pointers in the REAL
 * handover, against the REAL corpus.
 *
 * Read-only throughout. Nothing here writes to `.my_context/`, and nothing here
 * touches the live handover latch under `.my_context/state/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../../src/core/select.ts';
import { SUPERSEDED_BY } from '../../src/core/relations.ts';
import {
  BLOCK_HEAD, DEFAULT_DOC, ITEM_ID, LANE,
  blockOf, parseArgs, readBlocks, readCorpus, resolveId, scan, successorChain,
  type Corpus, type Pointer,
} from '../../scripts/check-handover.ts';
import { removeTree } from '../helpers/tmp.ts';
import type { Item } from '../../src/core/types.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const HANDOVER = path.join(REPO, ...DEFAULT_DOC.split('/'));
const SCRIPT = path.join(REPO, 'scripts', 'check-handover.ts');

const ws = resolveWorkspace(REPO);
const CORPUS: Corpus | null = ws.projectRoot === null
  ? null
  : readCorpus(loadLayer(ws.projectRoot, 'project', [], ws.config), ws.config);

/** Scan a synthetic document against the REAL corpus. */
function scanText(body: string): Pointer[] {
  assert.ok(CORPUS !== null, 'the corpus must load for these tests to mean anything');
  const lines = body.split('\n');
  return scan(body, readBlocks(lines), CORPUS);
}

function find(pointers: Pointer[], raw: string): Pointer | undefined {
  return pointers.find((p) => p.raw === raw);
}

/** A real id, and a real shortening of it, taken from the corpus at run time. */
function aLongId(): string {
  assert.ok(CORPUS !== null);
  const id = CORPUS.ids.find((i) => i.startsWith('DEC-') && i.split('-').length >= 8);
  assert.ok(id !== undefined, 'the corpus should hold at least one long DEC- id');
  return id;
}

// ── 0. The scanner is not blind ────────────────────────────────────────────

test('the real handover is segmented into the blocks it actually has', () => {
  if (!existsSync(HANDOVER)) return;
  const lines = readFileSync(HANDOVER, 'utf8').split(/\r?\n/);
  const blocks = readBlocks(lines);
  // Eleven `## ⏭` sections and four older `### ⏭` ones on 2026-09-06, and the
  // file only ever grows: each compaction PREPENDS one. A lower bound, not an
  // equality, because pinning the count would turn every future handover into
  // a test failure — but a scanner that found fewer than ten has stopped
  // reading the document and every carry count below it is a fiction.
  assert.ok(blocks.length >= 10, `expected at least 10 blocks, found ${blocks.length}`);
  assert.ok(blocks[0]!.line >= 1);
  // Newest first, and strictly increasing: `blockOf` is a scan that depends on it.
  for (let i = 1; i < blocks.length; i++) {
    assert.ok(blocks[i]!.line > blocks[i - 1]!.line);
  }
});

test('the real handover is read for the pointers it actually carries', () => {
  if (!existsSync(HANDOVER) || CORPUS === null) return;
  const text = readFileSync(HANDOVER, 'utf8');
  const pointers = scan(text, readBlocks(text.split(/\r?\n/)), CORPUS);
  // 117 distinct pointers on 2026-09-06 — 57 lane, 60 item. A floor well under
  // that is a scanner that has gone quiet, which is the only way every plant
  // below can pass while the gate checks nothing.
  assert.ok(pointers.length >= 60, `expected 60+ pointers, found ${pointers.length}`);
  assert.ok(pointers.some((p) => p.kind === 'lane'), 'no lane reference was read at all');
  assert.ok(pointers.some((p) => p.kind === 'item'), 'no item id was read at all');
  // And it must be able to SEE repetition: the handover is an accumulating
  // file, so something in it is carried across more than one block. A scanner
  // that reported every pointer in exactly one block has lost `blockOf`.
  assert.ok(
    pointers.some((p) => p.blocks.length >= 3),
    'nothing was seen in three or more blocks — repetition is not being counted',
  );
});

test('the real handover resolves every pointer it carries', () => {
  if (!existsSync(HANDOVER) || CORPUS === null) return;
  const text = readFileSync(HANDOVER, 'utf8');
  const pointers = scan(text, readBlocks(text.split(/\r?\n/)), CORPUS);
  const dangling = pointers.filter((p) => p.resolved === null);
  // The gated tier, measured at zero the day it landed. If this ever fails it
  // is reporting a real defect — a handover line pointing at nothing — and the
  // repair is to correct the handover, never to widen this test.
  assert.deepEqual(
    dangling.map((p) => `${DEFAULT_DOC}:${p.line} ${p.raw} — ${p.why}`),
    [],
  );
});

// ── 1. A pointer that names nothing is REFUSED ─────────────────────────────

test('a lane reference nothing answers to is reported', () => {
  const p = find(scanText('see `handover/99999` for the rest'), 'handover/99999');
  assert.ok(p !== undefined, 'a known plan with an unknown seq must be read as a lane');
  assert.equal(p.resolved, null);
  assert.equal(p.why, 'no task answers to it');
});

test('an item id nothing answers to is reported', () => {
  const raw = 'TASK-this-item-does-not-exist-in-any-corpus-anywhere';
  const p = find(scanText(`ruled in ${raw}, go read it`), raw);
  assert.ok(p !== undefined);
  assert.equal(p.resolved, null);
  assert.equal(p.why, 'no item answers to it');
});

test('a shortening that names more than one item is reported, not guessed', () => {
  const { id, why } = resolveId(CORPUS!, 'TASK-the-handover');
  assert.equal(id, null);
  assert.match(why ?? '', /items start with it/);
});

// ── 1b. A pointer at RETIRED work is not dangling ──────────────────────────

/**
 * **This tier was added the day the gate went red for a reason that was not a
 * defect.** The owner retired seven `walk` tasks with successors; four of them
 * are named in handover blocks written before the ruling, and the check called
 * each *"no task answers to it"* and failed the build. A retired item EXISTS —
 * file, status, and a `superseded_by` edge naming its replacement — and calling
 * that "nothing" is the retired/absent conflation this project ruled against.
 *
 * Every test below is written against a SYNTHETIC corpus wherever it needs an
 * exact shape, and against the REAL one wherever the claim is about this
 * repository. The synthetic ones cannot go quietly vacuous: each asserts the
 * plant it depends on is really in the index it was built for.
 */

/** A minimal item, so a plant names only the fields the check reads. */
function fakeTask(
  id: string, status: string, plan: string, seq: string,
  relations: Item['relations'] = [], state = 'todo',
): Item {
  return {
    id, type: 'task', title: `title of ${id}`, status: status as Item['status'],
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null, validFrom: null,
    validUntil: null, checksum: 'x', extra: { plan, seq, state }, body: '', steps: [],
    observations: [], relations, layer: 'project', filePath: `items/task/${id}.md`,
  };
}

/** Shape a corpus out of plants with the REAL `readCorpus`, not a hand-built literal. */
function corpusOf(items: Item[]): Corpus {
  assert.ok(ws.config !== undefined, 'the workspace config must load');
  return readCorpus(items, ws.config);
}

function scanAgainst(body: string, corpus: Corpus): Pointer[] {
  const lines = body.split('\n');
  return scan(body, readBlocks(lines), corpus);
}

test('a lane whose only task was retired is RETIRED, naming its successor', () => {
  const corpus = corpusOf([
    fakeTask('TASK-plant-the-retired-one', 'superseded', 'plant', '7',
      [{ type: SUPERSEDED_BY, target: 'TASK-plant-the-successor' }]),
    fakeTask('TASK-plant-the-successor', 'active', 'plant', '8'),
  ]);
  // Anti-vacuity: the plant must really be out of the ACTIVE index and in the
  // retired one, or everything below is asserting about a lane that resolved
  // normally.
  assert.equal(corpus.lanes.get('plant/7'), undefined);
  assert.ok(corpus.retiredLanes.has('plant/7'));

  const p = find(scanAgainst('finish `plant/7` next', corpus), 'plant/7');
  assert.ok(p !== undefined, 'a retired lane must still be read as a lane');
  // The whole ruling in one assertion: it RESOLVES, so it is not DANGLING.
  assert.equal(p.resolved, 'plant/7');
  assert.equal(p.why, null);
  assert.notEqual(p.retired, null);
  assert.deepEqual(p.retired!.items, [
    { id: 'TASK-plant-the-retired-one', status: 'superseded' },
  ]);
  assert.deepEqual(p.retired!.chain, [
    { id: 'TASK-plant-the-successor', retired: false },
  ]);
});

test('a successor that was itself retired is followed to the end of the chain', () => {
  // One hop is not enough: a report naming only the first hop sends the reader
  // to a second retired item and gives them no reason to doubt it, which is
  // the defect this tier exists to end, reproduced by the tier itself.
  const corpus = corpusOf([
    fakeTask('TASK-plant-hop-zero', 'superseded', 'plant', '1',
      [{ type: SUPERSEDED_BY, target: 'TASK-plant-hop-one' }]),
    fakeTask('TASK-plant-hop-one', 'superseded', 'plant', '2',
      [{ type: SUPERSEDED_BY, target: 'TASK-plant-hop-two' }]),
    fakeTask('TASK-plant-hop-two', 'active', 'plant', '3'),
  ]);
  const p = find(scanAgainst('see `plant/1`', corpus), 'plant/1');
  assert.ok(p !== undefined);
  assert.deepEqual(p.retired!.chain, [
    { id: 'TASK-plant-hop-one', retired: true },
    { id: 'TASK-plant-hop-two', retired: false },
  ]);
});

test('a retirement with no successor recorded says so, and is still not dangling', () => {
  const corpus = corpusOf([fakeTask('TASK-plant-orphan', 'superseded', 'plant', '9')]);
  const p = find(scanAgainst('see `plant/9`', corpus), 'plant/9');
  assert.ok(p !== undefined);
  assert.equal(p.resolved, 'plant/9');
  // Empty is a real and different answer — "retired, and nothing records what
  // replaced it" — not the same claim as "nothing answers to this name".
  assert.deepEqual(p.retired!.chain, []);
  assert.deepEqual(p.retired!.items, [{ id: 'TASK-plant-orphan', status: 'superseded' }]);
});

/**
 * **`deprecated` is retired to the corpus and LIVE to the lane index, and the
 * difference is deliberate on both sides.** A first draft of the test above
 * planted a `deprecated` task and asserted a RETIRED verdict; it failed,
 * correctly, and the failure is worth pinning rather than deleting.
 *
 * `RETIRED_STATUSES` is `superseded`, `deprecated`, `validated` — the set the
 * injector filters on. `workItems` drops only `superseded`, on the stated
 * ground that a cancelled task should keep RESOLVING so it stays visible and
 * addressable rather than reading as a typo. So a deprecated lane never left
 * the active index, was never reported as dangling, and reaches no gate that
 * needs answering. The RETIRED tier is therefore reached only by `superseded`
 * today — and it is keyed on `RETIRED_STATUSES` anyway, so that if `workItems`
 * ever widens, the pointer becomes RETIRED rather than DANGLING on the same
 * day.
 */
test('a deprecated lane still resolves as live work, and is not re-labelled RETIRED', () => {
  const corpus = corpusOf([fakeTask('TASK-plant-cancelled', 'deprecated', 'plant', '10')]);
  assert.ok(corpus.lanes.has('plant/10'), 'workItems keeps deprecated work in the active index');
  assert.ok(corpus.retiredLanes.has('plant/10'), 'and RETIRED_STATUSES still counts it retired');
  const p = find(scanAgainst('see `plant/10`', corpus), 'plant/10');
  assert.ok(p !== undefined);
  assert.equal(p.resolved, 'plant/10');
  // The active bucket wins, so nothing about the existing reading changed.
  assert.equal(p.retired, null);
  assert.equal(p.open, true);
});

test('a live task under a key wins over a retired one sharing it', () => {
  const corpus = corpusOf([
    fakeTask('TASK-plant-the-dead', 'superseded', 'plant', '4',
      [{ type: SUPERSEDED_BY, target: 'TASK-plant-the-live' }]),
    fakeTask('TASK-plant-the-live', 'active', 'plant', '4'),
  ]);
  const p = find(scanAgainst('do `plant/4`', corpus), 'plant/4');
  assert.ok(p !== undefined);
  assert.equal(p.resolved, 'plant/4');
  // Live work is what a reader of the handover needs. The retired tier is
  // consulted ONLY when the active index is empty.
  assert.equal(p.retired, null);
  assert.equal(p.open, true);
});

test('a retired lane repeated across blocks is never reported as a stuck instruction', () => {
  const corpus = corpusOf([
    fakeTask('TASK-plant-retired-carried', 'superseded', 'plant', '5',
      [{ type: SUPERSEDED_BY, target: 'TASK-plant-carried-successor' }]),
    fakeTask('TASK-plant-carried-successor', 'active', 'plant', '6'),
  ]);
  const doc = ['## ⏭ a', 'do `plant/5`', '## ⏭ b', 'do `plant/5`', '## ⏭ c', 'do `plant/5`'].join('\n');
  const p = find(scanAgainst(doc, corpus), 'plant/5');
  assert.ok(p !== undefined);
  assert.equal(p.blocks.length, 3, 'the repetition must actually be seen, or this test proves nothing');
  // `open` is the field CARRIED filters on. Retired work is not open work: it
  // has already been answered, by being replaced.
  assert.equal(p.open, null);
});

test('a plan whose every task was retired is still read as a plan', () => {
  // Building the plan set from the ACTIVE index alone would make such a lane
  // INVISIBLE rather than RETIRED — the same conflation one level up, and one
  // that hides pointers instead of naming them.
  const corpus = corpusOf([fakeTask('TASK-plant-only-retired', 'superseded', 'gonezo', '1')]);
  assert.ok(corpus.plans.has('gonezo'));
  const p = find(scanAgainst('see `gonezo/1`', corpus), 'gonezo/1');
  assert.ok(p !== undefined, 'a lane in an all-retired plan must not vanish from the report');
  assert.notEqual(p.retired, null);
});

test('successorChain stops on a cycle rather than hanging', () => {
  // The back-edge cap is one per ITEM, not one per corpus, so a cycle is
  // expressible in hand-edited files even though no command writes one.
  const a = fakeTask('TASK-plant-cycle-a', 'superseded', 'plant', '20',
    [{ type: SUPERSEDED_BY, target: 'TASK-plant-cycle-b' }]);
  const b = fakeTask('TASK-plant-cycle-b', 'superseded', 'plant', '21',
    [{ type: SUPERSEDED_BY, target: 'TASK-plant-cycle-a' }]);
  const byId = new Map([[a.id, a], [b.id, b]]);
  assert.deepEqual(successorChain(a, byId).map((i) => i.id), ['TASK-plant-cycle-b']);
});

test('the real corpus holds retired work items, and they are indexed as retired', () => {
  // Anti-vacuity over the REAL corpus: if this index were empty, every claim
  // above would be about a mechanism this repository never exercises, and the
  // four `walk` lanes that reddened the gate would be back to DANGLING with
  // nothing here to notice.
  assert.ok(CORPUS !== null);
  assert.ok(CORPUS.retiredLanes.size > 0, 'no retired work item carries a plan/seq at all');
  for (const [key, bucket] of CORPUS.retiredLanes) {
    assert.ok(bucket.length > 0, `${key} was indexed with an empty bucket`);
    for (const it of bucket) {
      assert.ok(RETIRED_STATUSES.has(it.status), `${it.id} is under ${key} but is not retired`);
    }
  }
});

// ── 2. What it must NOT refuse, which is where a checker dies ──────────────

test('a shortened id resolves by unambiguous prefix', () => {
  const full = aLongId();
  const short = full.split('-').slice(0, 5).join('-');
  const { id, why } = resolveId(CORPUS!, short);
  assert.equal(why, null);
  assert.equal(id, full);
});

test('an id broken across a line wrap at its own hyphen still resolves', () => {
  const full = aLongId();
  const short = `${full.split('-').slice(0, 5).join('-')}-`;
  // This is what a hard wrap leaves behind, and sixteen of the sixty-three
  // references in the real handover are shaped like it. Calling them broken
  // would make the check wrong sixteen times on its first run.
  assert.equal(resolveId(CORPUS!, short).id, full);
});

test('an English compound in caps is not mistaken for an item id', () => {
  // `UI-side`, `MCP-only`, `SVG-blind` and `NUL-byte` are all in the real
  // handover and were reported as four broken pointers by the first version of
  // this check. Four false findings on run one is a check switched off on run
  // two.
  const pointers = scanText('the UI-side of it is MCP-only, SVG-blind and NUL-byte safe');
  assert.deepEqual(pointers.filter((p) => p.kind === 'item'), []);
});

test('a word/number that names no plan is not mistaken for a lane', () => {
  const pointers = scanText('roughly `2026/09` and `and/3` — neither is a lane');
  assert.deepEqual(pointers.filter((p) => p.kind === 'lane'), []);
});

// ── 3. Repetition is counted in BLOCKS, and only where it can close ────────

test('a pointer repeated inside one block is carried once, not three times', () => {
  const doc = [
    '## ⏭ READ THIS FIRST — at 96%',
    'do `handover/15`',
    'and again `handover/15`',
    'and once more `handover/15`',
  ].join('\n');
  const p = find(scanText(doc), 'handover/15');
  assert.ok(p !== undefined);
  assert.equal(p.blocks.length, 1);
});

test('a pointer repeated across blocks is carried once per block', () => {
  const doc = [
    '## ⏭ READ THIS FIRST — at 96%',
    'do `handover/15`',
    '## ⏭ READ THIS FIRST — at 95%',
    'do `handover/15`',
    '### ⏭ READ THIS FIRST — older spelling',
    'do `handover/15`',
  ].join('\n');
  const p = find(scanText(doc), 'handover/15');
  assert.ok(p !== undefined);
  // Three, and the third proves the older `###` spelling is still a boundary:
  // four of the real handover's fifteen blocks are written that way, and a
  // checker blind to them would silently stop counting the older half of its
  // own evidence.
  assert.equal(p.blocks.length, 3);
});

test('text above the first block is a block of its own, not folded into the first', () => {
  const doc = ['# title', 'do `handover/15`', '## ⏭ READ THIS FIRST', 'do `handover/15`'].join('\n');
  const p = find(scanText(doc), 'handover/15');
  assert.ok(p !== undefined);
  assert.equal(p.blocks.length, 2);
  assert.deepEqual(p.blocks, [-1, 0]);
});

test('blockOf places a line in the last block that opened above it', () => {
  const blocks = readBlocks(['a', '## ⏭ one', 'b', 'c', '## ⏭ two', 'd']);
  assert.equal(blockOf(blocks, 1), -1);
  assert.equal(blockOf(blocks, 2), 0);
  assert.equal(blockOf(blocks, 4), 0);
  assert.equal(blockOf(blocks, 6), 1);
});

test('a decision carries no state, so repeating it is not reported as stuck', () => {
  const full = aLongId();
  const doc = ['## ⏭ a', full, '## ⏭ b', full, '## ⏭ c', full].join('\n');
  const p = find(scanText(doc), full);
  assert.ok(p !== undefined);
  assert.equal(p.resolved, full);
  // `open` is the field the CARRIED report filters on. A standing decision
  // restated in three blocks is a reminder, not an instruction that cannot
  // land, and reporting it would bury the signal this check exists to raise.
  assert.equal(p.open, null);
  assert.deepEqual(p.states, []);
});

test('an open lane carried across blocks is marked open, a done one is not', () => {
  assert.ok(CORPUS !== null);
  const open = [...CORPUS.lanes.entries()]
    .find(([, bucket]) => bucket.every((i) => (i.extra['state'] ?? '') === 'todo'));
  const done = [...CORPUS.lanes.entries()]
    .find(([, bucket]) => bucket.every((i) => (i.extra['state'] ?? '') === 'done'));
  assert.ok(open !== undefined && done !== undefined, 'the corpus should hold both');
  const doc = ['## ⏭ a', `\`${open[0]}\` and \`${done[0]}\``].join('\n');
  const pointers = scanText(doc);
  assert.equal(find(pointers, open[0])?.open, true);
  assert.equal(find(pointers, done[0])?.open, false);
});

// ── 4. The regexes themselves, since two of them decide everything ─────────

test('BLOCK_HEAD reads both spellings and nothing else', () => {
  assert.ok(BLOCK_HEAD.test('## ⏭ READ THIS FIRST'));
  assert.ok(BLOCK_HEAD.test('### ⏭ DO THIS FIRST'));
  assert.ok(!BLOCK_HEAD.test('# ⏭ a title'));
  assert.ok(!BLOCK_HEAD.test('## READ THIS FIRST'));
  assert.ok(!BLOCK_HEAD.test('text ## ⏭ mid-line'));
});

test('LANE reads a backticked plan/seq, including a lettered seq', () => {
  const got = [...'`ui3/11x` `repaint/7b` `walk/20` plain/3'.matchAll(LANE)]
    .map((m) => `${m[1]}/${m[2]}`);
  assert.deepEqual(got, ['ui3/11x', 'repaint/7b', 'walk/20']);
});

// ── 5. The argument that decided WHICH FILE gets read ──────────────────────

test('a path given with no flags is the file that gets read', () => {
  // The first draft dropped it and reported, greenly and at length, on the
  // DEFAULT document instead. A checker pointed at the wrong file is the
  // failure this script exists to name, so it gets its own test.
  assert.equal(parseArgs(['reports/OTHER.md']).rel, 'reports/OTHER.md');
  assert.equal(parseArgs([]).rel, DEFAULT_DOC);
  assert.equal(parseArgs(['--json']).rel, DEFAULT_DOC);
});

test('the value of --carried is not read as a path', () => {
  const a = parseArgs(['--carried', '5', 'reports/OTHER.md']);
  assert.equal(a.carriedAt, 5);
  assert.equal(a.rel, 'reports/OTHER.md');
  const b = parseArgs(['reports/OTHER.md', '--carried', '2']);
  assert.equal(b.carriedAt, 2);
  assert.equal(b.rel, 'reports/OTHER.md');
  // A floor below two would report every pointer written once as "carried",
  // which is every pointer. Refused, and the default stands.
  assert.equal(parseArgs(['--carried', '1']).carriedAt, 3);
  assert.equal(parseArgs(['--carried']).carriedAt, 3);
});

test('ITEM_ID reads an id whether or not it is backticked', () => {
  const got = [...'`DEC-one-two-three` and REQ-four-five-six'.matchAll(ITEM_ID)]
    .map((m) => `${m[1]}-${m[2]}`);
  assert.deepEqual(got, ['DEC-one-two-three', 'REQ-four-five-six']);
});

// ── 6. THE EXIT CODE, run as a process, because that is what a gate is ─────

/**
 * **The anti-vacuity question the RETIRED tier had to answer before it landed:
 * after teaching the check that a retired lane resolves, would it still fail on
 * a genuinely invented pointer?**
 *
 * `scan` returning `resolved: null` is not the same claim as the gate exiting
 * 1, and only the second is what CI reads. So these two run the real script as
 * a child process against a planted document and assert the STATUS, which is
 * the only thing that can go quietly permissive.
 */
function runOn(body: string): { status: number; out: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'handover-check-'));
  try {
    const doc = path.join(dir, 'PLANTED.md');
    writeFileSync(doc, body);
    const r = execFileSync(process.execPath, [SCRIPT, doc], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out: r };
  } catch (e) {
    const err = e as { status?: number | null; stdout?: string };
    return { status: err.status ?? -1, out: err.stdout ?? '' };
  } finally {
    removeTree(dir);
  }
}

/** A `plan/seq` no item in this corpus has ever carried, verified against both indexes. */
function inventedLane(): string {
  assert.ok(CORPUS !== null);
  const plan = [...CORPUS.plans][0];
  assert.ok(plan !== undefined, 'the corpus must know at least one plan name');
  for (let n = 900001; n < 900100; n++) {
    const key = `${plan}/${n}`;
    if (!CORPUS.lanes.has(key) && !CORPUS.retiredLanes.has(key)) return key;
  }
  throw new Error('could not invent a lane key this corpus does not carry');
}

test('a plan/seq no item has ever carried still fails the gate', () => {
  const key = inventedLane();
  const { status, out } = runOn(`## ⏭ READ THIS FIRST\n\nnow do \`${key}\`\n`);
  assert.match(out, new RegExp(`DANGLING[^]*lane ${key.replace('/', '\\/')}`));
  assert.match(out, /no task answers to it/);
  assert.match(out, /1 resolving to nothing/);
  // The load-bearing line of this whole change. DANGLING keeps its exit code.
  assert.equal(status, 1);
});

test('a document naming only retired lanes is reported and passes', () => {
  assert.ok(CORPUS !== null);
  // A real retired lane with no live task under the same key — the exact shape
  // that reddened HEAD on 2026-09-07.
  const entry = [...CORPUS.retiredLanes.entries()].find(([k]) => !CORPUS!.lanes.has(k));
  assert.ok(entry !== undefined, 'the corpus must hold a lane whose only tasks are retired');
  const { status, out } = runOn(`## ⏭ READ THIS FIRST\n\nnow do \`${entry[0]}\`\n`);
  assert.match(out, /RETIRED /);
  assert.match(out, new RegExp(entry[1][0]!.id));
  assert.doesNotMatch(out, /DANGLING/);
  assert.match(out, /0 resolving to nothing, 1 naming retired work/);
  // REPORTED, never gated. The handover is a historical document, and a block
  // written before a retirement was true when it was written.
  assert.equal(status, 0);
});
