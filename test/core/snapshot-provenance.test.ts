import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { parseItem } from '../../src/core/item.ts';
import { isSnapshot, snapshotChecksum, snapshotSource } from '../../src/core/reference.ts';
import { checksum } from '../../src/core/slug.ts';
import { CORPUS_DIR_ENV } from '../../src/core/workspace.ts';
import { runCli } from '../../src/cli/index.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **A snapshot survives a body write only if what was written is what the file
 * says now.**
 *
 * `persist` used to re-stamp `source_checksum` from the body on every write
 * while the snapshot SHAPE held, so `mycontext edit --body` turned a
 * provenance record into a hash of the item's own authored text — after which
 * `doctor` compared the live file against a number that no longer described
 * it, and the remedy it printed (`mycontext refresh`) would replace the
 * authored body whole from the file. Measured live: fifteen `edit --body`
 * writes to repair citations, five of them on snapshot items, and doctor went
 * from 0 warnings to 5 `source_drift`. See
 * `KNOWN-edit-body-silently-re-stamps-source-checksum-on-a-snapshot`.
 *
 * Every fixture is built by the product — `mycontext add --file` captures the
 * snapshot, `mycontext edit --body` authors over it, `mycontext refresh`
 * re-snapshots it — in a throwaway workspace named by `MYCONTEXT_CORPUS_DIR`
 * (`RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is`), set for
 * the duration and restored afterwards.
 */

const SOURCE = 'notes/source.md';
const FILE_TEXT = [
  '# A source document',
  '',
  'One line of it, and then another that a citation points into.',
  '',
  'A third line so the file is worth snapshotting.',
].join('\n');

interface Workspace {
  cwd: string;
  corpus: string;
  run: (args: string[]) => { code: number; out: string };
  item: (id: string) => Item;
  /** The newest mutation record the log holds for `id`. */
  last: (id: string) => AuditRecord;
  writeSource: (text: string) => void;
  sourcePath: string;
}

function withWorkspace(fn: (ws: Workspace) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-snapshot-'));
  const corpus = path.join(cwd, '.my_context');
  const previous = process.env[CORPUS_DIR_ENV];
  process.env[CORPUS_DIR_ENV] = corpus;
  const run = (args: string[]): { code: number; out: string } => {
    let out = '';
    const code = runCli(args, cwd, (s) => { out += s + '\n'; });
    return { code, out };
  };
  const sourcePath = path.join(cwd, ...SOURCE.split('/'));
  const writeSource = (text: string): void => {
    writeFileSync(sourcePath, text, 'utf8');
  };
  try {
    assert.equal(run(['init']).code, 0);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeSource(FILE_TEXT);
    fn({
      cwd,
      corpus,
      run,
      sourcePath,
      writeSource,
      item: (id) => {
        const rel = `items/reference/${id}.md`;
        return parseItem(readFileSync(path.join(corpus, ...rel.split('/')), 'utf8'), rel, 'project');
      },
      last: (id) => {
        const all = readAudit(corpus).filter((r) => r.kind === 'mutation' && r.itemId === id);
        const record = all[all.length - 1];
        assert.ok(record, `the log holds no mutation record for ${id}`);
        return record;
      },
    });
  } finally {
    if (previous === undefined) delete process.env[CORPUS_DIR_ENV];
    else process.env[CORPUS_DIR_ENV] = previous;
    removeTree(cwd);
  }
}

/** A whole-file snapshot captured by the product, at the file's current text. */
function capture(ws: Workspace): string {
  const added = ws.run(['add', 'reference', 'the source document',
    '--file', SOURCE, '--summary', 'A copy of the source document.', '--yes']);
  assert.equal(added.code, 0, added.out);
  const id = /created (\S+)/.exec(added.out)?.[1];
  assert.ok(id, added.out);
  const item = ws.item(id);
  assert.equal(isSnapshot(item), true, 'the fixture must actually be a snapshot');
  assert.equal(item.sourceChecksum, snapshotChecksum(FILE_TEXT));
  return id;
}

test('authoring a body over a snapshot ENDS the snapshot instead of re-stamping it', () => {
  withWorkspace((ws) => {
    const id = capture(ws);
    const authored = '> # A source document\n>\n> One line of it, with the citation repaired.';

    const edited = ws.run(['edit', id, '--body', authored, '--summary-unchanged', '--yes']);
    assert.equal(edited.code, 0, edited.out);

    const item = ws.item(id);
    // THE DEFECT, gone: `source_checksum` is not a hash of the authored body.
    assert.notEqual(item.sourceChecksum, checksum(snapshotSource(item.body)));
    // It is cleared, so the item has stopped claiming to be a copy of the file.
    assert.equal(item.sourceChecksum, null);
    assert.equal(isSnapshot(item), false);
    // `source_file` is KEPT — the record of where this text came from is true
    // and is not deleted to tidy away an implication the product itself no
    // longer draws.
    assert.equal(item.sourceFile, SOURCE);
    // The body is exactly what was written. Nothing here touches text.
    assert.equal(item.body, authored);
    // The file was not touched either.
    assert.equal(readFileSync(ws.sourcePath, 'utf8'), FILE_TEXT);
  });
});

test('the end of a provenance record is SAID, not only done', () => {
  withWorkspace((ws) => {
    const id = capture(ws);
    const edited = ws.run(['edit', id, '--body', '> authored over the snapshot',
      '--summary-unchanged', '--yes']);
    // Said to the person who ran the command, through the message every
    // mutation surface already prints. Unwrapped first: the CLI wraps to the
    // terminal, so a sentence is asserted as a sentence rather than as
    // whatever width it happened to be printed at.
    const said = edited.out.replace(/\s+/g, ' ');
    assert.match(said, /no longer a copy of it/);
    assert.match(
      said, new RegExp(`source_checksum \\(${snapshotChecksum(FILE_TEXT)}\\) was cleared`),
    );
    assert.match(said, /source_file is KEPT/);
    assert.match(said, /`mycontext refresh` refuses it/);

    // And recorded, where a later reader can find it.
    const record = ws.last(id);
    assert.deepEqual(record.snapshotEnded, {
      kind: 'ended', sourceFile: SOURCE, wasChecksum: snapshotChecksum(FILE_TEXT),
    });
  });
});

test('doctor stops asking a question that has no answer, and refresh refuses', () => {
  withWorkspace((ws) => {
    const id = capture(ws);
    ws.run(['edit', id, '--body', '> authored over the snapshot', '--summary-unchanged', '--yes']);

    // BEFORE the fix this was `source_drift` on a file nobody had changed,
    // with `mycontext refresh` as its printed remedy — the command that would
    // have replaced the authored body whole.
    const doctor = ws.run(['doctor', '--json']);
    const findings = (JSON.parse(doctor.out) as { findings: { code: string; item?: string }[] })
      .findings.filter((f) => f.item === id);
    assert.deepEqual(findings.filter((f) => f.code === 'source_drift'), []);
    assert.deepEqual(findings.filter((f) => f.code === 'source_missing'), []);

    // And the command that would have destroyed the body refuses, with the
    // sentence it already had for this shape.
    const refreshed = ws.run(['refresh', id, '--yes']);
    assert.equal(refreshed.code, 1);
    assert.match(refreshed.out, /records no source_checksum/);
  });
});

test('refresh still re-snapshots: the body IS the file, so the item stays one', () => {
  // THE NEGATIVE CASE, and the one to break first. The re-stamp exists for
  // `refresh` and for a promoted staged refresh, neither of which sets
  // `source_checksum` itself. A fix that stopped re-stamping altogether would
  // leave every refreshed item describing text it no longer holds.
  withWorkspace((ws) => {
    const id = capture(ws);
    const moved = `${FILE_TEXT}\n\nA fourth line, added after the snapshot was taken.`;
    ws.writeSource(moved);

    const refreshed = ws.run(['refresh', id, '--yes']);
    assert.equal(refreshed.code, 0, refreshed.out);

    const item = ws.item(id);
    assert.equal(isSnapshot(item), true, 'a refreshed snapshot is still a snapshot');
    assert.equal(item.sourceChecksum, snapshotChecksum(moved));
    assert.equal(checksum(snapshotSource(item.body)), snapshotChecksum(moved));
    // Nothing ended, so nothing is recorded as having ended and nothing is said.
    assert.equal(ws.last(id).snapshotEnded, undefined);
    assert.doesNotMatch(refreshed.out, /no longer a copy/);
  });
});

test('a write that carries no body leaves the provenance exactly as it found it', () => {
  // The trigger is a body, not a write. `edit --title`, `link`, `supersede`
  // and `repair` must not touch a snapshot's provenance, and before this they
  // re-stamped it on every one of those paths.
  withWorkspace((ws) => {
    const id = capture(ws);
    const before = ws.item(id);
    assert.equal(ws.run(['edit', id, '--title', 'The source document, retitled', '--yes']).code, 0);

    const after = ws.item(id);
    assert.equal(after.title, 'The source document, retitled');
    assert.equal(after.sourceChecksum, before.sourceChecksum);
    assert.equal(after.sourceFile, before.sourceFile);
    assert.equal(isSnapshot(after), true);
    assert.equal(ws.last(id).snapshotEnded, undefined);
  });
});

test('an item already in the damaged state is repaired by re-writing its own body', () => {
  // **The state the five items on this repository's corpus are in**, built the
  // only honest way it can be: `source_checksum` agrees with the body and
  // disagrees with the file. That is byte-for-byte what a legitimately DRIFTED
  // snapshot looks like — which is why no automatic pass can heal one without
  // corrupting the other, and why the repair is an explicit act naming the
  // item. Here the state is reached by moving the FILE, and the repair is the
  // person asserting "this body is mine": `edit --body` with the item's own
  // current text, which moves not one byte of it.
  withWorkspace((ws) => {
    const id = capture(ws);
    ws.writeSource(`${FILE_TEXT}\n\nThe file moved after the snapshot was taken.`);

    const damaged = ws.item(id);
    assert.equal(damaged.sourceChecksum, checksum(snapshotSource(damaged.body)),
      'the record describes the body');
    assert.notEqual(damaged.sourceChecksum, snapshotChecksum(readFileSync(ws.sourcePath, 'utf8')));

    // **The route, and its one awkwardness, pinned rather than described.**
    // `mycontext edit` refuses a body byte-identical to the one stored
    // ("nothing to change — X already has the body you passed"), and that
    // guard compares the RAW flag value while `updateItem` stores
    // `normalizeEol(body).trim()`. So the item's own text plus a trailing
    // newline is a different argument and the same body: the edit is applied,
    // `movedFields` correctly reports that no field moved, and what the write
    // does is end a provenance record that was never true. No
    // `--summary-unchanged`, because the body does not move and the gate that
    // flag answers never rises.
    const repaired = ws.run(['edit', id, '--body', `${damaged.body}\n`, '--yes']);
    assert.equal(repaired.code, 0, repaired.out);
    // The record is honest about both halves: no field moved, and the
    // provenance ended.
    assert.equal(ws.last(id).fields, undefined);

    const after = ws.item(id);
    // THE BODY IS UNTOUCHED, byte for byte. A `refresh` would have restored
    // the provenance by throwing the text away; this keeps both.
    assert.equal(after.body, damaged.body);
    assert.equal(after.sourceChecksum, null);
    assert.equal(after.sourceFile, SOURCE);
    assert.equal(ws.last(id).snapshotEnded?.kind, 'ended');
  });
});

test('an unreadable source changes NOTHING, in either direction, and says so', () => {
  // Ending a provenance record on a transient read failure would destroy a
  // true fact; re-stamping would assert one nobody checked. So neither.
  withWorkspace((ws) => {
    const id = capture(ws);
    const before = ws.item(id);
    rmSync(ws.sourcePath);

    const edited = ws.run(['edit', id, '--body', '> authored while the file was gone',
      '--summary-unchanged', '--yes']);
    assert.equal(edited.code, 0, edited.out);

    const after = ws.item(id);
    assert.equal(after.sourceChecksum, before.sourceChecksum);
    assert.equal(after.sourceFile, before.sourceFile);
    assert.match(edited.out, /could not be read/);
    assert.equal(ws.last(id).snapshotEnded?.kind, 'unconfirmed');

    // And the unreadable source is doctor's to report, at `error`, which is
    // what makes this silence safe rather than convenient.
    const doctor = ws.run(['doctor', '--json']);
    const codes = (JSON.parse(doctor.out) as { findings: { code: string; item?: string }[] })
      .findings.filter((f) => f.item === id).map((f) => f.code);
    assert.equal(codes.includes('source_missing'), true, codes.join(', '));
  });
});
