// @basis TASK-release-phase-1-the-repository-tells-the-truth
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { computeItemChecksum } from '../../src/core/item.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { readAudit } from '../../src/core/audit.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext edit <id> --detach-source --yes` — the repair Task 1.1's corpus
 * step runs 84 times over, and the route this project did not have before it:
 * `source_file` had "no command at all" (categories.ts, until 2026-09-22).
 *
 * The three claims under test are the ones the task brief and the controller
 * ruling make: the write goes through the ORDINARY edit path (checksum
 * recomputed, audit row written, exactly like any other field), both fields
 * land null together, and the two refusals (`--body`/`--unlink` in the same
 * call, and an item with no source) fire before anything is written.
 */

const ROADMAP = ['# Roadmap', '', '## Q3', '', '- usage-based pricing', ''].join('\n');

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-detach-source-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  mkdirSync(path.join(cwd, 'docs'));
  writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP, 'utf8');
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function capture(cwd: string): string {
  const { code } = run(
    ['add', '--summary-omitted', 'reference', 'Roadmap', '--file', 'docs/roadmap.md'], cwd,
  );
  assert.equal(code, 0);
  return 'REF-roadmap';
}

test('--detach-source clears both fields, through a write doctor and the audit log both confirm', () => {
  const cwd = sandbox();
  try {
    const id = capture(cwd);

    // Before: a real source_file and a real source_checksum, or the rest of
    // this test would be proving nothing.
    {
      const { store } = openStore(resolveWorkspace(cwd));
      const before = store.all().find((i) => i.id === id);
      store.close();
      assert.ok(before, `no item ${id}`);
      assert.equal(before!.sourceFile, 'docs/roadmap.md');
      assert.notEqual(before!.sourceChecksum, null);
    }

    const { code, out } = run(['edit', id, '--detach-source', '--yes'], cwd);
    assert.equal(code, 0, out);

    // Both fields are null, and the item's OWN checksum verifies against the
    // content it now holds — `updateItem` recomputed it through `persist`,
    // exactly as any other edit does, and the write is not a special case.
    const { store } = openStore(resolveWorkspace(cwd));
    const after = store.all().find((i) => i.id === id);
    store.close();
    assert.ok(after, `no item ${id}`);
    assert.equal(after!.sourceFile, null);
    assert.equal(after!.sourceChecksum, null);
    assert.equal(after!.checksum, computeItemChecksum(after!),
      'the recorded checksum no longer matches the item\'s own content — the detach did not ' +
      'go through the ordinary write path');

    // `mycontext doctor` in the same workspace reports no checksum finding —
    // the black-box confirmation the brief asks for, alongside the direct one
    // just above.
    const doctor = run(['doctor'], cwd);
    assert.equal(doctor.code, 0, doctor.out);
    assert.doesNotMatch(doctor.out, /checksum mismatch/);

    // An audit row exists for the write, and it names the two fields that
    // moved — the same `sourceFile`/`sourceChecksum` `snapshotFields`
    // (persist.ts) now carries.
    const audit = readAudit(path.join(cwd, '.my_context'));
    const row = audit.find((r) => r.op === 'update' && r.itemId === id);
    assert.ok(row, `no audit row for the edit of ${id}`);
    assert.deepEqual([...(row!.fields ?? [])].sort(), ['sourceChecksum', 'sourceFile']);
  } finally {
    removeTree(cwd);
  }
});

test('--detach-source is refused alongside --body, and alongside --unlink, in the same call', () => {
  const cwd = sandbox();
  try {
    const id = capture(cwd);

    const withBody = run(['edit', id, '--detach-source', '--body', 'New text.', '--yes'], cwd);
    assert.equal(withBody.code, 1);
    assert.match(withBody.out, /--detach-source is refused alongside --body or --unlink/);

    // `--unlink` is pulled out of argv (and this refusal reached) before the
    // relation it names is ever checked against the item, so a relation that
    // does not exist still proves the COMBINATION is refused — the missing
    // relation is never reached.
    const withUnlink = run(
      ['edit', id, '--detach-source', '--unlink', 'blocks', 'RULE-does-not-exist', '--yes'], cwd,
    );
    assert.equal(withUnlink.code, 1);
    assert.match(withUnlink.out, /--detach-source is refused alongside --body or --unlink/);

    // The item is untouched by either refused call — `sourceFile` still names
    // the file, which is the proof "nothing was changed" is true and not
    // merely printed.
    const { store } = openStore(resolveWorkspace(cwd));
    const untouched = store.all().find((i) => i.id === id);
    store.close();
    assert.equal(untouched!.sourceFile, 'docs/roadmap.md');
  } finally {
    removeTree(cwd);
  }
});

test('--detach-source on an item with no source_file is refused: there is nothing to detach', () => {
  const cwd = sandbox();
  try {
    const { code: addCode } = run(
      ['add', '--summary-omitted', 'reference', 'Typed note', '--body', 'Not a snapshot.', '--yes'],
      cwd,
    );
    assert.equal(addCode, 0);
    const { code, out } = run(['edit', 'REF-typed-note', '--detach-source', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /records no source_file — there is nothing to detach/);
  } finally {
    removeTree(cwd);
  }
});
