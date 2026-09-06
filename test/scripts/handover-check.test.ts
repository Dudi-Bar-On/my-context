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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import {
  BLOCK_HEAD, DEFAULT_DOC, ITEM_ID, LANE,
  blockOf, parseArgs, readBlocks, readCorpus, resolveId, scan,
  type Corpus, type Pointer,
} from '../../scripts/check-handover.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const HANDOVER = path.join(REPO, ...DEFAULT_DOC.split('/'));

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
