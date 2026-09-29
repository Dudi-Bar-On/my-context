// @basis TASK-release-phase-3-the-defects, STD-a-summary-is-one-plain-sentence-for-someone-who-does-not, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **Task 3.11: the summary gate's order, and the back doors on `lesson` and
 * `inbox-promote`.**
 *
 * Three defects share one file because they share one shape: a caller who
 * did nothing wrong except omit `--summary` gets told about the WRONG thing.
 *
 *  1. **`add` refused the summary before the category.** `mycontext add
 *     nosuchcategory "x"` with no `--summary` printed the summary-required
 *     refusal — asking a human to write a sentence for an item that could
 *     never be created, because the category does not exist. The category
 *     check already existed (`resolveCategory`, mutate.ts) but ran only
 *     deep inside `createItem`, reached AFTER the summary gate had already
 *     thrown. Fixed by resolving the category first, the same ordering
 *     argument `--severity`/`--step`/`scopeRequirementError` already make in
 *     `cmdAdd`'s own comments.
 *
 *  2. **`lesson "text"` had no way to give a summary at all.** It is a
 *     creation route — `createItem(ctx, { type: 'lesson', ... })` — and until
 *     this fix it was one of exactly two left that could mint an item with
 *     no summary and no recorded omission (`inbox-promote` was the other).
 *     `--summary`/`--summary-omitted` are new; the refusal is
 *     `summaryAtCreateRefusal` reused, not restated — `lesson` is a sixth
 *     authored surface for the SAME gate (`core/summary-gate.ts`), the way
 *     `lesson-accept` became a fifth on 2026-09-12.
 *
 *  3. **`inbox-promote <id> --to <cat>` promoted with no summary.** The
 *     seventh authored surface, same two flags, same reused refusal.
 *
 * `promoteRevision`'s `SUMMARY_OMITTED_NOTE` fix (defect 4) is a CORE
 * concern with no CLI flag of its own — it lives in
 * `test/core/revision-summary-omitted.test.ts`, beside the rest of that
 * module's tests, per this repository's own tree convention
 * (`test/core/revision*.test.ts`).
 *
 * **Throwaway workspaces, not this repository's corpus** —
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` — every
 * test here creates its own `mycontext init` workspace under the OS temp dir
 * and removes it, the pattern `test/cli/lesson-accept-summary.test.ts` beside
 * this file already uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-summary-gate-order-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/* ---------------------------------------------------------------------------
 * (1) `add`: the category is resolved before the summary is required.
 * ------------------------------------------------------------------------- */

test('add on an unknown category with no --summary is refused for the CATEGORY, not the summary', () => {
  withProject((cwd) => {
    const { code, out } = run(['add', 'nosuchcategory', 'Some title'], cwd);
    assert.equal(code, 1, out);
    // The category refusal names the unknown type and offers the real
    // catalogue (`enumError`) — the summary refusal never mentions a category
    // at all, so this is the one line that tells the two apart.
    assert.match(out, /nosuchcategory/, out);
    assert.doesNotMatch(out, /this capture carries no summary/, out);
  });
});

/** The control: a KNOWN category with no summary still gets the summary
 * refusal — the fix must not have swallowed the gate along with the
 * ordering. */
test('add on a known category with no --summary is still refused for the summary', () => {
  withProject((cwd) => {
    const { code, out } = run(['add', 'constraint', 'Pool cap'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /this capture carries no summary/, out);
  });
});

/* ---------------------------------------------------------------------------
 * (2) `lesson`: the summary gate, on its own create path.
 * ------------------------------------------------------------------------- */

const LESSON_SUMMARY =
  'A standing note that migrations deadlock under concurrent peak-hour traffic.';

function lessonFile(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'lesson', `${id}.md`), 'utf8');
}

test('lesson "text" --summary "…" records the summary', () => {
  withProject((cwd) => {
    const { code, out } = run(
      ['lesson', 'Migrations deadlock under peak traffic', '--summary', LESSON_SUMMARY], cwd,
    );
    assert.equal(code, 0, out);
    const id = /LESSON-[a-z0-9-]+/.exec(out)![0];
    assert.ok(
      lessonFile(cwd, id).includes(`summary: ${LESSON_SUMMARY}`),
      `the summary must be persisted:\n${lessonFile(cwd, id)}`,
    );
  });
});

test('lesson "text" alone is refused with the capture refusal, and creates nothing', () => {
  withProject((cwd) => {
    const { code, out } = run(['lesson', 'Migrations deadlock under peak traffic'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /this capture carries no summary/, out);
    const list = run(['list', 'lesson', '--json'], cwd).out;
    assert.equal((JSON.parse(list) as { count: number }).count, 0, list);
  });
});

test('lesson "text" --summary-omitted creates the lesson, and the audit row carries summary-omitted', () => {
  withProject((cwd) => {
    const { code, out } = run(
      ['lesson', 'Migrations deadlock under peak traffic', '--summary-omitted'], cwd,
    );
    assert.equal(code, 0, out);
    const id = /LESSON-[a-z0-9-]+/.exec(out)![0];
    assert.doesNotMatch(lessonFile(cwd, id), /^summary: /m, lessonFile(cwd, id));

    const audit = run(['audit', '--limit', '10'], cwd).out;
    const row = audit.split('\n').find((line) => line.includes(id));
    assert.ok(row, `no audit row for ${id}:\n${audit}`);
    assert.match(row, /summary-omitted/, `the omission must be recorded, not assumed:\n${audit}`);
  });
});

/** The re-derive path — `lesson <existing-id>` — creates nothing, so the gate
 * must not fire on it even with no summary flag: there is no capture here to
 * refuse. */
test('re-deriving from an existing lesson id is not refused for a missing summary', () => {
  withProject((cwd) => {
    const created = run(
      ['lesson', 'Migrations deadlock under peak traffic', '--summary-omitted'], cwd,
    );
    const id = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
    const { code, out } = run(['lesson', id], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /this capture carries no summary/, out);
  });
});

test('--summary beside --summary-omitted on lesson is refused, and nothing is created', () => {
  withProject((cwd) => {
    const { code, out } = run(
      ['lesson', 'Migrations deadlock under peak traffic', '--summary', LESSON_SUMMARY, '--summary-omitted'],
      cwd,
    );
    assert.equal(code, 1, out);
    assert.match(out, /say that a summary was written and that none was/, out);
    const list = run(['list', 'lesson', '--json'], cwd).out;
    assert.equal((JSON.parse(list) as { count: number }).count, 0, list);
  });
});

test('the lesson usage line advertises --summary and --summary-omitted', () => {
  withProject((cwd) => {
    const usage = run(['lesson'], cwd).out;
    assert.match(usage, /--summary/, usage);
  });
});

/* ---------------------------------------------------------------------------
 * (3) `inbox-promote`: the summary gate, on its own create path.
 * ------------------------------------------------------------------------- */

const PROMOTE_SUMMARY =
  'A standing rule that customer email addresses are never written to any log.';

function noteId(cwd: string, title: string): string {
  const out = run(['add', 'note', title, '--summary-omitted'], cwd).out;
  return /NOTE-[a-z0-9-]+/.exec(out)![0];
}

function ruleFile(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
}

test('inbox-promote without --summary is refused, and the origin note is untouched', () => {
  withProject((cwd) => {
    const id = noteId(cwd, 'Never log customer email');
    const { code, out } = run(['inbox-promote', id, '--to', 'rule', '--yes'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /this capture carries no summary/, out);
    const origin = run(['show', id], cwd).out;
    assert.doesNotMatch(origin, /deprecated/, `the origin must still be live:\n${origin}`);
  });
});

test('inbox-promote --summary-omitted promotes, and the audit row carries summary-omitted', () => {
  withProject((cwd) => {
    const id = noteId(cwd, 'Never log customer email');
    const { code, out } = run(['inbox-promote', id, '--to', 'rule', '--summary-omitted', '--yes'], cwd);
    assert.equal(code, 0, out);
    const ruleId = /RULE-[a-z0-9-]+/.exec(out)![0];
    assert.doesNotMatch(ruleFile(cwd, ruleId), /^summary: /m, ruleFile(cwd, ruleId));

    const audit = run(['audit', '--limit', '10'], cwd).out;
    const row = audit.split('\n').find((line) => line.includes(ruleId));
    assert.ok(row, `no audit row for ${ruleId}:\n${audit}`);
    assert.match(row, /summary-omitted/, audit);
  });
});

test('inbox-promote --summary lands the summary on the promoted item', () => {
  withProject((cwd) => {
    const id = noteId(cwd, 'Never log customer email');
    const { code, out } = run(
      ['inbox-promote', id, '--to', 'rule', '--summary', PROMOTE_SUMMARY, '--yes'], cwd,
    );
    assert.equal(code, 0, out);
    const ruleId = /RULE-[a-z0-9-]+/.exec(out)![0];
    assert.ok(
      ruleFile(cwd, ruleId).includes(`summary: ${PROMOTE_SUMMARY}`),
      `the summary must be persisted:\n${ruleFile(cwd, ruleId)}`,
    );
  });
});

test('the inbox-promote usage line advertises --summary and --summary-omitted', () => {
  withProject((cwd) => {
    const usage = run(['inbox-promote'], cwd).out;
    assert.match(usage, /--summary/, usage);
  });
});
