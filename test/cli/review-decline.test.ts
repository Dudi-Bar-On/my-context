// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen
//
// `mycontext review discard` is the line the Decline button on the review
// screen composes, so the two acts that command now performs are asserted
// THROUGH the command rather than only through `declineDraft`: the screen
// executes this text, and a screen that composed a line whose behaviour was
// only proved one layer down would be proving the wrong thing.
//
// Two acts, one verb, and the discriminator is the origin:
//   - a draft the review pass wrote is DELETED and its claim remembered (§8);
//   - a draft a person or an ingest wrote is deprecated and kept as a trail,
//     exactly as it was before this phase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readDeclines } from '../../src/review/declined.ts';
import { DRAFT_DIR } from '../../src/core/drafts.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** A workspace with one draft in it, in whichever region the origin implies. */
function project(origin: 'review' | 'ingest'): { cwd: string; root: string; id: string; file: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-decline-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const root = path.join(cwd, '.my_context');
  const id = 'TASK-check-basis-admits-a-test-that-declares-none';
  const rel = origin === 'review'
    ? `${DRAFT_DIR}/task/${id}.md`
    : `items/task/${id}.md`;
  const file = path.join(root, ...rel.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: task
title: check basis admits a test that declares none
status: draft
severity: soft
always: false
summary: The basis gate passes a test file carrying no @basis line at all.
scope:
  - scripts/gate-basis.ts
tags:
  - review-pass
origin: ${origin}
valid_from: 2026-09-11
---

Run npm run check:basis over test/review and the gate passes a file with no @basis line,
so the declaration it exists to require is optional in practice.
`, 'utf8');
  return { cwd, root, id, file };
}

test('discarding a review-pass draft deletes it and records the decline', () => {
  const { cwd, root, id, file } = project('review');
  try {
    const settled = run(['review', 'discard', id, '--reason', 'the gate is advisory on purpose', '--yes'], cwd);
    assert.equal(settled.code, 0, settled.out);
    assert.match(settled.out, /about to decline:/);
    assert.match(settled.out, /DELETED rather than deprecated/);
    assert.match(settled.out, /is declined/);

    assert.equal(existsSync(file), false, 'the draft file is gone');
    const kept = readDeclines(root);
    assert.equal(kept.length, 1, 'and the claim is on record in its place');
    assert.equal(kept[0]?.why, 'the gate is advisory on purpose');
    assert.equal(kept[0]?.target, 'scripts/gate-basis.ts');

    const queue = run(['review', 'list'], cwd);
    assert.match(queue.out, /no drafts pending review/);
  } finally {
    removeTree(cwd);
  }
});

test('discarding a draft a person or an ingest wrote still deprecates and keeps it', () => {
  const { cwd, root, id, file } = project('ingest');
  try {
    const settled = run(['review', 'discard', id, '--yes'], cwd);
    assert.equal(settled.code, 0, settled.out);
    assert.doesNotMatch(settled.out, /about to decline:/);
    assert.match(settled.out, /is now deprecated. It is kept as a trail rather than deleted/);
    assert.ok(existsSync(file), 'an authored draft leaves a trail — the act is unchanged');
    assert.equal(
      readDeclines(root).length, 0,
      'and nothing goes to the decline ledger: nothing here re-proposes an ingest draft, so a ' +
      'decline recorded against one would be a row that suppresses nothing',
    );
  } finally {
    removeTree(cwd);
  }
});

test('a decline with no --reason still records the claim, and says what was lost', () => {
  const { cwd, root, id } = project('review');
  try {
    const settled = run(['review', 'discard', id, '--yes'], cwd);
    assert.equal(settled.code, 0, settled.out);
    assert.match(settled.out, /No --reason given/);
    const kept = readDeclines(root);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.why, null, 'absent is absent, and it is not an empty sentence');
  } finally {
    removeTree(cwd);
  }
});

test('the decline is refused without --yes, and the draft survives the refusal', () => {
  const { cwd, root, id, file } = project('review');
  try {
    const settled = run(['review', 'discard', id], cwd);
    assert.equal(settled.code, 1);
    assert.ok(existsSync(file), 'an unconfirmed delete is not a delete');
    assert.equal(readDeclines(root).length, 0);
  } finally {
    removeTree(cwd);
  }
});
