import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { parseItem } from '../../src/core/item.ts';
import { detectDivergence } from '../../src/core/persist.ts';
import { CORPUS_DIR_ENV } from '../../src/core/workspace.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **The witness that a file moved outside my_context, and the erasure it is
 * lifted out of the way of.**
 *
 * `computeItemChecksum` hashes `extra`, so a hand-edited item's recorded
 * checksum is stale the moment the edit lands and `loadLayer` reports it as a
 * corpus load error. `writeItem` then recomputes that checksum
 * UNCONDITIONALLY on every write path, so the next ordinary `mycontext edit`
 * on the item — for any reason, on any field — silently re-hashes the
 * hand-edited value and the evidence is gone with nothing recorded. Measured
 * on this repository's own corpus, every flagged item had a later product
 * write and every one now checksums cleanly.
 *
 * Every fixture here is built the honest way, by the product: `mycontext add`
 * writes the item, an editor rewrites its Markdown, `mycontext edit` writes
 * over it, and the audit log is then asked what it saw. Nothing is
 * synthesised, because a synthesised divergence would prove only that the
 * comparison compares.
 *
 * It runs in a throwaway workspace named by `MYCONTEXT_CORPUS_DIR`
 * (`RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is`): the
 * override is set for the duration and restored afterwards, so an ambient
 * value cannot point this at a corpus somebody is using and this one cannot
 * leak into the tests that run after it.
 */

interface Workspace {
  cwd: string;
  corpus: string;
  run: (args: string[]) => { code: number; out: string };
  /** The newest mutation record the log holds for `id`. */
  last: (id: string) => AuditRecord;
  records: (id: string) => AuditRecord[];
  file: (id: string) => string;
}

function withWorkspace(fn: (ws: Workspace) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-divergence-'));
  const corpus = path.join(cwd, '.my_context');
  const previous = process.env[CORPUS_DIR_ENV];
  process.env[CORPUS_DIR_ENV] = corpus;
  const run = (args: string[]): { code: number; out: string } => {
    let out = '';
    const code = runCli(args, cwd, (s) => { out += s + '\n'; });
    return { code, out };
  };
  const records = (id: string): AuditRecord[] => readAudit(corpus)
    .filter((r) => r.kind === 'mutation' && r.itemId === id);
  try {
    assert.equal(run(['init']).code, 0);
    fn({
      cwd,
      corpus,
      run,
      records,
      last: (id) => {
        const all = records(id);
        const record = all[all.length - 1];
        assert.ok(record, `the log holds no mutation record for ${id}`);
        return record;
      },
      file: (id) => path.join(corpus, 'items', 'task', `${id}.md`),
    });
  } finally {
    if (previous === undefined) delete process.env[CORPUS_DIR_ENV];
    else process.env[CORPUS_DIR_ENV] = previous;
    removeTree(cwd);
  }
}

/** A task captured through the product, at `state: todo`. */
function addTask(ws: Workspace, title: string, seq: string): string {
  const added = ws.run(['add', 'task', title,
    '--body', 'A unit of work with a body long enough to be an item.',
    '--summary', 'A unit of work.',
    '--extra', 'plan=p', '--extra', `seq=${seq}`, '--extra', 'state=todo', '--yes']);
  assert.equal(added.code, 0, added.out);
  const id = /created (\S+)/.exec(added.out)?.[1];
  assert.ok(id, added.out);
  return id;
}

/** The checksum the file itself carries, read back off disk. */
function checksumOnDisk(ws: Workspace, id: string): string {
  const file = ws.file(id);
  return parseItem(readFileSync(file, 'utf8'), `items/task/${id}.md`, 'project').checksum;
}

test('a write over a hand-edited file records the divergence it is about to erase', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'closed by hand then edited again', '1');
    const before = checksumOnDisk(ws, id);

    // THE BYPASS. Not `mycontext edit`: an editor, writing the Markdown
    // directly, exactly as the 27 flagged items on this repository's corpus
    // were written.
    const file = ws.file(id);
    writeFileSync(file, readFileSync(file, 'utf8')
      .replaceAll('state: todo', 'state: done')
      .replaceAll('state:todo', 'state:done'), 'utf8');

    // THE ERASER. An ordinary edit, about something else entirely. Before
    // this, it re-stamped the checksum over the hand-edited value and left
    // nothing behind.
    const edited = ws.run(['edit', id, '--extra', 'priority=2',
      '--summary-unchanged', '--yes']);
    assert.equal(edited.code, 0, edited.out);

    const record = ws.last(id);
    assert.equal(record.op, 'update');
    assert.ok(record.diverged, 'the write recorded no divergence');
    // `recorded` is what the file claimed about itself — the checksum the
    // product stamped on it last — and `actual` is what the hand-edited
    // content really hashes to. They are the two halves of the disagreement.
    assert.equal(record.diverged.recorded, before);
    assert.notEqual(record.diverged.actual, before);
    assert.notEqual(record.diverged.actual, record.diverged.recorded);

    // NOT A GATE. The owner ruled against blocking: the edit landed.
    assert.equal(
      parseItem(readFileSync(file, 'utf8'), `items/task/${id}.md`, 'project').extra['priority'],
      '2',
    );
    // And the erasure still happened — which is the point. The file
    // checksums cleanly now, and the only surviving evidence is the record.
    assert.equal(record.checksumAfter, checksumOnDisk(ws, id));
    assert.notEqual(record.checksumAfter, record.diverged.recorded);
  });
});

test('an ordinary edit over an untouched file records the stamp and NO divergence', () => {
  // THE NEGATIVE CASE, and the one to break first. A witness that fires on
  // every write says nothing about any of them.
  withWorkspace((ws) => {
    const id = addTask(ws, 'edited only through the product', '2');
    assert.equal(ws.run(['edit', id, '--extra', 'priority=2',
      '--summary-unchanged', '--yes']).code, 0);

    const record = ws.last(id);
    assert.equal(record.diverged, undefined);
    // Absence is only readable as "measured and clean" BECAUSE the stamp is
    // here — see `AuditRecord.checksumAfter`. A record with neither field is
    // unmeasured, not clean.
    assert.equal(record.checksumAfter, checksumOnDisk(ws, id));
  });
});

test('every mutation record carries the checksum its write stamped, create included', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'stamped from the first write', '3');
    const [creation] = ws.records(id);
    assert.equal(creation?.op, 'create');
    // The `create` record's stamp is what makes the FIRST hand edit
    // measurable against the log rather than against the file's own
    // frontmatter, which a hand editor can rewrite.
    assert.equal(creation?.checksumAfter, checksumOnDisk(ws, id));
    assert.equal(creation?.diverged, undefined);

    assert.equal(ws.run(['edit', id, '--title', 'A retitled unit of work', '--yes']).code, 0);
    assert.equal(ws.last(id).checksumAfter, checksumOnDisk(ws, id));
  });
});

test('a hand edit is measurable against the LOG even after the file has been re-stamped', () => {
  // The soundness claim for `checksumAfter`. `mycontext repair` re-stamps a
  // hand-edited file so it checksums correctly again and writes no audit
  // record at all — after which the file agrees with itself perfectly, and
  // the ONLY thing that still disagrees is the log.
  withWorkspace((ws) => {
    const id = addTask(ws, 'hand edited then repaired', '4');
    const stamped = ws.last(id).checksumAfter;
    assert.ok(stamped);

    const file = ws.file(id);
    writeFileSync(file, readFileSync(file, 'utf8')
      .replaceAll('state: todo', 'state: done')
      .replaceAll('state:todo', 'state:done'), 'utf8');
    assert.equal(ws.run(['repair', '--yes']).code, 0);

    // The file now agrees with itself: `doctor`'s checksum load error is gone.
    const after = readFileSync(file, 'utf8');
    const reparsed = parseItem(after, `items/task/${id}.md`, 'project');
    assert.equal(reparsed.extra['state'], 'done');
    // And the log still holds the number the product last stamped, which the
    // re-stamp could not reach.
    assert.notEqual(reparsed.checksum, stamped);
    assert.equal(ws.last(id).checksumAfter, stamped, 'repair must not have written a record');
  });
});

test('an extra edit names the KEY it moved, never the whole bag', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'closed through the product', '5');
    assert.equal(ws.run(['edit', id, '--extra', 'state=done',
      '--summary-unchanged', '--yes']).code, 0);

    const fields = ws.last(id).fields ?? [];
    // `extra.state` and not `extra`: this resolution is the whole reason
    // `state_unaudited` can stop crediting an item whose `priority` moved.
    assert.equal(fields.includes('extra.state'), true, fields.join(', '));
    assert.equal(fields.includes('extra'), false, fields.join(', '));
    // The projection moves with it, and is still reported as itself.
    assert.equal(fields.includes('tags'), true, fields.join(', '));
    // Sorted, like every other `fields` this log carries.
    assert.deepEqual(fields, [...fields].sort());
  });
});

test('an unrelated extra edit does not name the key it left alone', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'priority moved and nothing else', '6');
    assert.equal(ws.run(['edit', id, '--extra', 'priority=2',
      '--summary-unchanged', '--yes']).code, 0);

    const fields = ws.last(id).fields ?? [];
    assert.equal(fields.includes('extra.priority'), true, fields.join(', '));
    // THE POINT OF THE WIDENING. Before it, this record said `extra` and
    // credited the item's `state` with a write that never touched it.
    assert.equal(fields.includes('extra.state'), false, fields.join(', '));
  });
});

test('re-sending an extra key with the value it already holds moves nothing', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'a no-op edit', '7');
    // `--extra state=todo` re-asserts what the item already says. A record
    // naming it would make the log disagree with the item's own history.
    ws.run(['edit', id, '--extra', 'state=todo', '--extra', 'priority=2',
      '--summary-unchanged', '--yes']);
    const fields = ws.last(id).fields ?? [];
    assert.equal(fields.includes('extra.state'), false, fields.join(', '));
    assert.equal(fields.includes('extra.priority'), true, fields.join(', '));
  });
});

test('detectDivergence stays silent where it cannot honestly speak', () => {
  withWorkspace((ws) => {
    const id = addTask(ws, 'the silences', '8');
    const file = ws.file(id);
    const item = parseItem(readFileSync(file, 'utf8'), `items/task/${id}.md`, 'project');

    // A file the product itself last wrote.
    assert.equal(detectDivergence(ws.corpus, item), null);

    // No file at all — the ordinary `add` case, where there is nothing to
    // have diverged from.
    assert.equal(
      detectDivergence(ws.corpus, { ...item, filePath: 'items/task/NOTHING-HERE.md' }),
      null,
    );

    // A file with no checksum recorded: hand-authored, or written before
    // checksums existed. Nothing to verify against, so nothing is claimed.
    const raw = readFileSync(file, 'utf8');
    writeFileSync(file, raw.replace(/^checksum: .*$/m, 'checksum: ""'), 'utf8');
    assert.equal(detectDivergence(ws.corpus, item), null);

    // A file that will not parse: `loadLayer` already reports that, loudly,
    // on every command. A second voice for one fact adds nothing.
    writeFileSync(file, 'not an item at all\n', 'utf8');
    assert.equal(detectDivergence(ws.corpus, item), null);
  });
});
