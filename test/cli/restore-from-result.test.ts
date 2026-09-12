// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently
/**
 * **The SECOND destination, reached through D34's carrier and not around it**
 * — `plan:recall seq:2` Task 11 step 4a, and §10a of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`, owner
 * ruling 2026-09-11.
 *
 * `mycontext restore --build --from-result <file> --claims <list>` is the ONE
 * verb this destination adds, and it is a flag on the command that already
 * stages rather than a command of its own. That is the ruling, in its own
 * words: *"IT REUSES D34's CARRIER AND MUST NOT GROW A SECOND ONE."*
 * Everything after this point — `--show`, `--approve`, the owner's clear, the
 * one-shot delivery and the loop guard — is untouched, and this file asserts
 * that by driving `--approve` through the SAME command.
 *
 * ── WHAT IS ASSERTED, AND WHAT EACH ONE WOULD CATCH ───────────────────────
 *
 *   - the build stages a PROPOSAL and nothing more (step 4b);
 *   - the staged payload is MARKED, and a reversed ruling says so (step 4c) —
 *     asserted on the payload's own section structure, never by substring,
 *     because the reversed id also appears in the claim that named it;
 *   - `--approve` still refuses anything but the owner, and still rests on a
 *     re-read of the file;
 *   - a result file that does not exist is REFUSED with the path in the
 *     message, rather than staging an empty window-filler.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { sectionsOf } from '../../src/core/retrieval/return.ts';
import { removeTree } from '../helpers/tmp.ts';

const REVERSED = 'DEC-the-ui-is-developed-against-a-simulated-corpus-until-the';
const SUCCESSOR = 'INSTR-testing-happens-against-the-current-corpus-and-an-exception';

const RESULT = [
  '# Retrieval result — recall-0001',
  '',
  '**Written** 2026-09-10T08:00:00.000Z · **mode** `from-selection`',
  '**Mission** `.my_context/.retrieval/recall-0001.mission.md`',
  '',
  '## What it found',
  '',
  `- The suite ran against a simulated corpus under ${REVERSED}. [commit a50fc84]`,
  '- The anchors table is keyed by session and byte offset. [file src/core/anchors.ts:95]',
  '- A selection is not a guess at the subject. [turn sess-a@918273]',
  '',
].join('\n');

interface Box {
  cwd: string;
  run: (argv: string[]) => { code: number; text: string };
  result: string;
  dispose(): void;
}

function workspace(): Box {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-fromresult-'));
  const run = (argv: string[]): { code: number; text: string } => {
    const lines: string[] = [];
    let code: number;
    try {
      code = runCli(argv, cwd, (s) => lines.push(s));
    } catch (err) {
      lines.push(`THREW: ${(err as Error).message}`);
      code = 1;
    }
    return { code, text: lines.join('\n') };
  };
  assert.equal(run(['init']).code, 0, 'the probe workspace did not initialize');

  // The reversed ruling, as the corpus really records one. `--status
  // superseded` is refused on `edit` by design — a retirement without a
  // successor is not offered — so it is written by the command that writes
  // both halves of it, and the fixture is therefore a REAL supersession
  // rather than a field set by hand.
  assert.equal(run([
    'add', 'decision', 'The UI is developed against a simulated corpus until the shell lands',
    '--body', 'The browser suite runs against a fixture rather than the live corpus.',
    '--summary', 'The browser tests use a stand-in corpus for now.', '--yes',
  ]).code, 0, 'the reversed decision was not created');
  assert.equal(run([
    'add', 'instruction', 'Testing happens against the current corpus and an exception',
    '--body', 'Dogfooding: every test runs on the live corpus unless he approves otherwise.',
    '--summary', 'Tests run against the real corpus unless he approves an exception.', '--yes',
  ]).code, 0, 'the successor was not created');
  assert.equal(run([
    'supersede', REVERSED, '--by', SUCCESSOR, '--reason', 'overruled 2026-09-07', '--yes',
  ]).code, 0, 'the supersession was not written');

  const dir = path.join(cwd, '.my_context', '.retrieval');
  mkdirSync(dir, { recursive: true });
  const result = path.join(dir, 'recall-0001.result.md');
  writeFileSync(result, RESULT, 'utf8');
  return { cwd, run, result, dispose: () => removeTree(cwd) };
}

/** The one staged record's JSON, whatever its key. */
function staged(cwd: string): Record<string, unknown> {
  const dir = path.join(cwd, '.my_context', '.staging', 'restore');
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  assert.equal(files.length, 1, `expected exactly one staged record, found ${files.length}`);
  return JSON.parse(readFileSync(path.join(dir, files[0] ?? ''), 'utf8')) as Record<string, unknown>;
}

test('--from-result stages a retrieval result as a PROPOSAL, and delivers nothing', () => {
  const box = workspace();
  try {
    const built = box.run(['restore', '--build', '--from-result', box.result, '--claims', '1,3']);
    assert.equal(built.code, 0, built.text);

    const record = staged(box.cwd);
    assert.equal(record['state'], 'proposed', 'a build must stage a proposal, never an approval');
    assert.equal(record['approvedAt'], null);
    assert.equal(record['deliveredAt'], null);

    // The command SAYS nothing is injected, because that sentence is what the
    // owner acts on. A build that staged silently would read as a delivery.
    assert.match(built.text, /NOTHING IS INJECTED YET/);
  } finally { box.dispose(); }
});

test('the staged payload is marked, and the reversed ruling says so on arrival', () => {
  const box = workspace();
  try {
    assert.equal(
      box.run(['restore', '--build', '--from-result', box.result, '--claims', '1,3']).code, 0,
    );
    const payload = String(staged(box.cwd)['payload']);
    const sections = sectionsOf(payload);

    assert.ok(
      sections.has('THIS IS A RECORD, NOT AN INSTRUCTION'),
      `a staged return must state itself a record; sections were ${[...sections.keys()].join(' / ')}`,
    );

    // **Structure, not substring.** `REVERSED` is also in claim 1, which is in
    // this payload, so `payload.includes(REVERSED)` is green on a build that
    // dropped the reversal section altogether.
    const listed = (sections.get('REVERSED SINCE — READ THESE FIRST') ?? [])
      .filter((line) => line.startsWith('- '));
    assert.equal(listed.length, 1, 'the reversed ruling is not listed as reversed');
    assert.match(listed[0] ?? '', new RegExp(`\`${REVERSED}\``));

    // He took 2 of 3, and the record says so rather than reading as the whole.
    assert.match(payload, /2 of the 3 claims/);
    const returned = (sections.get('WHAT RETURNS') ?? []).filter((l) => l.startsWith('- '));
    assert.equal(returned.length, 2, 'exactly the claims he chose');
  } finally { box.dispose(); }
});

test('--approve still rests on a re-read, and the sequence is D34\'s untouched', () => {
  const box = workspace();
  try {
    assert.equal(box.run(['restore', '--build', '--from-result', box.result]).code, 0);
    const key = String(staged(box.cwd)['key']);

    const shown = box.run(['restore', '--show']);
    assert.equal(shown.code, 0, shown.text);
    assert.match(shown.text, new RegExp(key), '`--show` must list a retrieval return like any other');

    const approved = box.run(['restore', '--approve', key, '--yes']);
    assert.equal(approved.code, 0, approved.text);
    assert.match(approved.text, /IT IS SAFE TO CLEAR/, 'the safe-to-clear sentence is the carrier\'s');
    assert.equal(staged(box.cwd)['state'], 'approved');
    assert.equal(staged(box.cwd)['approvedBy'], 'human');
  } finally { box.dispose(); }
});

test('a result file that is not there is refused, and the path is in the refusal', () => {
  const box = workspace();
  try {
    const missing = path.join(box.cwd, '.my_context', '.retrieval', 'no-such.result.md');
    const built = box.run(['restore', '--build', '--from-result', missing]);
    assert.equal(built.code, 1);
    // **On the product's OWN sentence, not on the output.** A removal proof
    // caught the looser form: the underlying `ENOENT` message carries the path
    // too, so `assert.match(built.text, /no-such\.result\.md/)` stayed green
    // with the path taken out of the refusal this command writes. That is the
    // commonest false-green here — asserting a substring some other part of
    // the output also contains — so the line is selected first and then read.
    const refusal = built.text.split(String.fromCharCode(10))
      .find((line) => line.startsWith('my_context: the retrieval result '));
    assert.ok(refusal !== undefined, `no refusal names the result: ${built.text}`);
    assert.ok(
      (refusal ?? '').includes(missing),
      'the refusal does not name the file it could not read, so it cannot be acted on',
    );
    // Nothing was staged, and the strongest form of that is the directory
    // never having been created at all.
    const dir = path.join(box.cwd, '.my_context', '.staging', 'restore');
    const left = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')) : [];
    assert.deepEqual(left, [], 'a refused build staged something anyway');
  } finally { box.dispose(); }
});

test('a claim number the result does not have is refused rather than quietly dropped', () => {
  const box = workspace();
  try {
    const built = box.run(['restore', '--build', '--from-result', box.result, '--claims', '1,9']);
    assert.equal(built.code, 1);
    assert.match(built.text, /no claim 9/i);
  } finally { box.dispose(); }
});
