import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit, type AuditInput } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { CORPUS_DIR_ENV } from '../../src/core/workspace.ts';
import { checkStateUnaudited } from '../../src/doctor/checks.ts';
import { runCli } from '../../src/cli/index.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **The check that asks the audit log a question no file can answer.**
 *
 * A `state: done` written straight into an item's Markdown is
 * indistinguishable, ON DISK, from one `mycontext edit` wrote: same
 * frontmatter shape, a correct summary, a correct checksum, `state:done`
 * correctly projected into `tags`, and every other doctor check green. The
 * fixture at the bottom of this file BUILDS both of those items with the real
 * CLI and proves it — the honest one draws nothing and the hand-edited one
 * draws a finding, and the only thing separating them is the audit log.
 *
 * **The negative case is the one that matters.** A check that fires on
 * everything is worthless, and this check's whole risk is that it fires on the
 * 400-odd tasks that were closed properly. `a task closed through the product
 * draws nothing` is the test to break first if this file is ever refactored.
 */

const CONFIG = resolveConfig({});

function task(id: string, extra: Record<string, string>): Item {
  return {
    id, type: 'task', title: id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: 'Body.', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/task/${id}.md`,
  };
}

/** A throwaway corpus root with a real, product-written audit log in it. */
function root(records: AuditInput[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-unaudited-'));
  const corpus = path.join(dir, '.my_context');
  mkdirSync(corpus, { recursive: true });
  for (const record of records) {
    const result = recordAudit(corpus, record);
    assert.equal(result.written, true, 'the fixture log must actually be written');
  }
  return corpus;
}

function withRoot(records: AuditInput[], fn: (corpus: string) => void): void {
  const corpus = root(records);
  try {
    fn(corpus);
  } finally {
    removeTree(path.dirname(corpus));
  }
}

const created = (itemId: string): AuditInput => (
  { kind: 'mutation', op: 'create', origin: 'human', itemId }
);
const updated = (itemId: string, fields: string[]): AuditInput => (
  { kind: 'mutation', op: 'update', origin: 'human', itemId, fields }
);

test('a done task whose state never moved through a recorded write is reported', () => {
  withRoot([created('TASK-a'), updated('TASK-a', ['summary'])], (corpus) => {
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    const [finding] = findings;
    assert.equal(finding!.code, 'state_unaudited');
    assert.equal(finding!.item, 'TASK-a');
    // `info`, for `citation_form`'s reason: 27 of these exist on this
    // repository's own corpus the moment the check ships, every one about
    // history nobody can now reconstruct. A check that turns a corpus red on
    // arrival is a check people switch off.
    assert.equal(finding!.level, 'info');
    // A person rules on it. Nothing can be run: re-asserting the value it
    // already has moves no field, so `movedFields` would record an empty
    // `fields` and the finding would survive its own remedy.
    assert.deepEqual(finding!.remedy, { route: 'acknowledge' });
  });
});

test('a task closed through the product draws nothing', () => {
  // THE NEGATIVE CASE. `mycontext edit --extra state=done` moves `extra.state`
  // (and `tags`, through the projection), and that record is the whole
  // difference between this item and the one above.
  withRoot([created('TASK-a'), updated('TASK-a', ['extra.state', 'tags'])], (corpus) => {
    assert.deepEqual(
      checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG), [],
    );
  });
});

test('an unrelated extra edit no longer credits an item whose state never moved', () => {
  // THE WHOLE POINT OF THE WIDENING. `fields` used to say `extra` for both of
  // these writes, so a `priority` edit through the product credited an item
  // whose `state` was written by hand. At `extra.<key>` resolution the two are
  // different records and this item is reported.
  withRoot([created('TASK-a'), updated('TASK-a', ['extra.priority'])], (corpus) => {
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'state_unaudited');
    assert.match(findings[0]!.message, /extra\.state/);
  });
});

test('a record written before the widening still credits, and is named as the reason', () => {
  // BACKWARDS COMPATIBILITY, and it is the direction that matters: a bare
  // `extra` was written by a build that could not say which key moved, so it
  // is UNMEASURED for `state` and must not be turned into an accusation now
  // (`STD-a-measured-zero-is-drawn-and-named`). It credits, exactly as it did
  // before this change, which is why the count on an existing corpus does not
  // move.
  withRoot([created('TASK-a'), updated('TASK-a', ['extra', 'tags'])], (corpus) => {
    assert.deepEqual(
      checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG), [],
    );
  });
});

test('a RECORDED divergence is reported, and defeats an old coarse credit', () => {
  // The check no longer has to infer from an absent record. `persist` measured
  // this file diverging under a write and said so, and a bare `extra` record —
  // which cannot say which key it moved — is not allowed to excuse it.
  withRoot([
    created('TASK-a'),
    {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-a',
      fields: ['extra', 'tags'], checksumAfter: 'after-1',
      diverged: { recorded: 'stamped-0', actual: 'hand-edited-0' },
    },
  ], (corpus) => {
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'state_unaudited');
    assert.match(findings[0]!.message, /log RECORDS this item's file being changed outside/);
    // It reports what it measured and does not overclaim: a divergence does
    // not name the field that moved.
    assert.match(findings[0]!.message, /not proof that `state` was the field bypassed/);
    // And the two readings are no longer offered, because one of them is now
    // measured rather than guessed.
    assert.doesNotMatch(findings[0]!.message, /cannot choose between them/);
  });
});

test('a file that disagrees with the LOG is reported even when it agrees with itself', () => {
  // The soundness claim for `checksumAfter`. This item's own frontmatter is
  // perfectly consistent — `mycontext repair` re-stamped it and wrote no
  // record — so every file-level check passes. The comparison that still
  // fails is against the log, which the file cannot reach.
  withRoot([
    created('TASK-a'),
    {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-a',
      fields: ['title'], checksumAfter: 'stamped-by-the-product',
    },
  ], (corpus) => {
    const item = { ...task('TASK-a', { state: 'done' }), checksum: 're-stamped-by-hand' };
    const findings = checkStateUnaudited(corpus, [item], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0]!.message, /stamped `stamped-by-the-product`/);
    assert.match(findings[0]!.message, /file now carries `re-stamped-by-hand`/);
    assert.match(findings[0]!.message, /against the LOG/);
  });
});

test('a stamp that still agrees with the file is not reported as a divergence', () => {
  // THE NEGATIVE CASE for the log-versus-file comparison, and the one to break
  // first: every item my_context itself last wrote agrees with its own newest
  // record, so this must draw nothing extra on any of them.
  withRoot([
    created('TASK-a'),
    {
      kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-a',
      fields: ['title'], checksumAfter: 'x',
    },
  ], (corpus) => {
    // `task()` stamps `checksum: 'x'` — the same value the record carries.
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1, 'still reported: no record ever moved extra.state');
    assert.doesNotMatch(findings[0]!.message, /RECORDS/);
    assert.match(findings[0]!.message, /cannot choose between them/);
  });
});

test('records written before this shipped carry no stamp, and absence stays UNMEASURED', () => {
  // A record with neither `checksumAfter` nor `diverged` is every record in
  // every log that exists today. It must not be read as "measured and clean":
  // the check falls back to the absence reading it always used, and says so.
  withRoot([created('TASK-a'), updated('TASK-a', ['title'])], (corpus) => {
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.doesNotMatch(findings[0]!.message, /RECORDS/);
    assert.match(findings[0]!.message, /cannot choose between them/);
  });
});

test('the message states the two readings and accuses neither', () => {
  withRoot([created('TASK-a')], (corpus) => {
    const [finding] = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    const message = finding!.message;
    // Both readings, named, in the finding itself — a `create` record carries
    // no `fields`, so a task captured already done is invisible here and the
    // check must not call it a bypass.
    assert.match(message, /CREATED\s+already done/);
    assert.match(message, /written into the Markdown by hand/);
    assert.match(message, /cannot choose between them/);
    // And the blind spot, stated where it is read (RULE-say-what-your-check-
    // cannot-see-when-you-report-it-green): `fields` names `extra`, never
    // which extra key moved.
    assert.match(message, /never WHICH/);
    assert.match(message, /floor on the bypass, never a count of it/);
    // The remedy's own command, spelled with this item's id.
    assert.match(message, /mycontext ack TASK-a state_unaudited/);
  });
});

test('only the terminal state is asked about — todo, doing and blocked are not', () => {
  withRoot([created('TASK-a'), created('TASK-b'), created('TASK-c')], (corpus) => {
    const items = [
      task('TASK-a', { state: 'todo' }),
      task('TASK-b', { state: 'doing' }),
      task('TASK-c', { state: 'blocked' }),
    ];
    // `todo` is the value a task is CREATED in, so "no record ever set this to
    // todo" reports the default on every open task in the corpus. `doing` and
    // `blocked` are transient. `done` is the value another person's plan
    // depends on.
    assert.deepEqual(checkStateUnaudited(corpus, items, CONFIG), []);
  });
});

test('an item that is not a work item is not asked about at all', () => {
  withRoot([created('DEC-a')], (corpus) => {
    const decision = { ...task('DEC-a', { state: 'done' }), type: 'decision' };
    assert.deepEqual(checkStateUnaudited(corpus, [decision], CONFIG), []);
  });
});

test('a superseded task is out of scope, as it is for every other task check', () => {
  withRoot([created('TASK-a')], (corpus) => {
    const gone = { ...task('TASK-a', { state: 'done' }), status: 'superseded' as const };
    assert.deepEqual(checkStateUnaudited(corpus, [gone], CONFIG), []);
  });
});

test('a done task the log never saw is named as UNMEASURED, not accused', () => {
  // `STD-a-measured-zero-is-drawn-and-named`, clause 2. An item restored from
  // a pack, or older than the oldest surviving segment, has a life this log
  // cannot describe — and reporting it as a bypass would be an accusation
  // nothing here can check.
  withRoot([created('TASK-a'), updated('TASK-a', ['extra', 'tags'])], (corpus) => {
    const items = [task('TASK-a', { state: 'done' }), task('TASK-imported', { state: 'done' })];
    const findings = checkStateUnaudited(corpus, items, CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'state_audit_coverage');
    assert.equal(findings[0]!.level, 'info');
    assert.equal(findings[0]!.item, undefined);
    assert.deepEqual(findings[0]!.remedy, { route: 'copy', argv: ['mycontext', 'audit', '--files'] });
    assert.match(findings[0]!.message, /1 task\(s\)/);
    assert.match(findings[0]!.message, /has NOT looked at them/);
    // And never a finding against the item itself.
    assert.equal(findings.some((f) => f.item === 'TASK-imported'), false);
  });
});

test('a workspace with no audit log at all reports one unmeasured note and no accusations', () => {
  // The shape that would make this check cry wolf loudest: a corpus copied in
  // without `.audit/`. Every done task is unmeasured and NONE is reported.
  withRoot([], (corpus) => {
    const items = [task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' })];
    const findings = checkStateUnaudited(corpus, items, CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'state_audit_coverage');
    assert.match(findings[0]!.message, /2 task\(s\)/);
  });
});

test('a corpus with no closed tasks is silent', () => {
  withRoot([created('TASK-a')], (corpus) => {
    assert.deepEqual(checkStateUnaudited(corpus, [task('TASK-a', { state: 'todo' })], CONFIG), []);
    assert.deepEqual(checkStateUnaudited(corpus, [], CONFIG), []);
  });
});

test('a log that cannot be read is reported as unmeasured, not as a crashed check', () => {
  withRoot([created('TASK-a')], (corpus) => {
    const log = path.join(corpus, '.audit', 'audit.jsonl');
    const text = readFileSync(log, 'utf8');
    // A damaged line in the MIDDLE — `readAudit` tolerates only a damaged
    // final line, and refuses the whole file otherwise.
    writeFileSync(log, `${text.trimEnd()}\nnot json at all\n${text.trimEnd()}\n`, 'utf8');
    const findings = checkStateUnaudited(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'state_audit_coverage');
    assert.equal(findings[0]!.level, 'info');
    assert.match(findings[0]!.message, /UNMEASURED/);
    // It must not reach `runChecks`' `check_failed`, which is an ERROR and
    // would report a corpus problem as a bug in doctor.
    assert.equal(findings[0]!.remedy.route, 'none');
  });
});

/**
 * **The fixture the whole check stands on: two items built by the real CLI,
 * one closed through the product and one closed by hand.**
 *
 * Nothing here is synthesised. `mycontext add` captures both at `state: todo`,
 * `mycontext edit` closes the first, an editor closes the second by rewriting
 * its Markdown, and `mycontext repair` re-stamps the checksum the way anybody
 * bypassing the write path would have to. Then `doctor` is asked which is
 * which.
 *
 * It runs in a throwaway workspace named by `MYCONTEXT_CORPUS_DIR`
 * (`RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is`): the
 * override is set for the duration and restored afterwards, so an ambient
 * value cannot point this at a corpus somebody is using and this one cannot
 * leak into the tests that run after it.
 */
test('RED and GREEN, built by the product: the hand edit is found and the honest close is not', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unaudited-cli-'));
  const previous = process.env[CORPUS_DIR_ENV];
  process.env[CORPUS_DIR_ENV] = path.join(cwd, '.my_context');
  const run = (args: string[]): { code: number; out: string } => {
    let out = '';
    const code = runCli(args, cwd, (s) => { out += s + '\n'; });
    return { code, out };
  };
  try {
    assert.equal(run(['init']).code, 0);

    const honest = run(['add', 'task', 'closed through the product',
      '--body', 'A unit of work with a body long enough to be an item.',
      '--summary', 'Closed through the product.',
      '--extra', 'plan=p', '--extra', 'seq=1', '--extra', 'state=todo', '--yes']);
    assert.equal(honest.code, 0, honest.out);
    const honestId = /created (\S+)/.exec(honest.out)?.[1];
    assert.ok(honestId);
    assert.equal(run(['edit', honestId, '--extra', 'state=done',
      '--summary-unchanged', '--yes']).code, 0);

    const bypass = run(['add', 'task', 'closed by hand',
      '--body', 'A unit of work with a body long enough to be an item.',
      '--summary', 'Closed by hand.',
      '--extra', 'plan=p', '--extra', 'seq=2', '--extra', 'state=todo', '--yes']);
    assert.equal(bypass.code, 0, bypass.out);
    const bypassId = /created (\S+)/.exec(bypass.out)?.[1];
    assert.ok(bypassId);
    const file = path.join(cwd, '.my_context', 'items', 'task', `${bypassId}.md`);
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('state: todo', 'state: done')
      .replaceAll('state:todo', 'state:done'), 'utf8');
    // The checksum is the only thing a hand edit breaks, and re-stamping it is
    // one command. After this the two items are indistinguishable on disk.
    assert.equal(run(['repair', '--yes']).code, 0);

    const doctor = run(['doctor', '--json']);
    const findings = (JSON.parse(doctor.out) as { findings: { code: string; item?: string }[] })
      .findings.filter((f) => f.code === 'state_unaudited');
    assert.deepEqual(findings.map((f) => f.item), [bypassId],
      'the hand edit is the only one the log cannot account for');
    // GREEN: doctor's exit code is driven by errors, and this is a note.
    assert.equal(doctor.code, 0);
  } finally {
    if (previous === undefined) delete process.env[CORPUS_DIR_ENV];
    else process.env[CORPUS_DIR_ENV] = previous;
    removeTree(cwd);
  }
});

/**
 * **The eraser, driven end to end, and the witness that now survives it.**
 *
 * The fixture above closes the bypass with `mycontext repair`, which is the
 * loud route — `doctor` reported the stale checksum first. This one uses the
 * SILENT route, which is the one the 27 items on this repository's corpus went
 * through: an ordinary `mycontext edit` about something else entirely, which
 * re-stamps the checksum over the hand-edited value with nothing recorded.
 * After it the file is clean and every file-level check passes. What is
 * different now is that the write recorded what it found before it wrote.
 */
test('the silent eraser is driven, and the divergence it erased is in the log after it', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unaudited-erase-'));
  const previous = process.env[CORPUS_DIR_ENV];
  process.env[CORPUS_DIR_ENV] = path.join(cwd, '.my_context');
  const run = (args: string[]): { code: number; out: string } => {
    let out = '';
    const code = runCli(args, cwd, (s) => { out += s + '\n'; });
    return { code, out };
  };
  try {
    assert.equal(run(['init']).code, 0);
    const added = run(['add', 'task', 'closed by hand then edited about something else',
      '--body', 'A unit of work with a body long enough to be an item.',
      '--summary', 'Closed by hand.',
      '--extra', 'plan=p', '--extra', 'seq=1', '--extra', 'state=todo', '--yes']);
    assert.equal(added.code, 0, added.out);
    const id = /created (\S+)/.exec(added.out)?.[1];
    assert.ok(id);

    const file = path.join(cwd, '.my_context', 'items', 'task', `${id}.md`);
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('state: todo', 'state: done')
      .replaceAll('state:todo', 'state:done'), 'utf8');

    // At THIS moment the file betrays the edit: the recorded checksum is stale
    // and doctor goes red naming it. That is the sentence the docblock used to
    // get wrong, and it is asserted rather than described.
    const red = run(['doctor']);
    assert.equal(red.code, 1, red.out);
    assert.match(red.out, /checksum mismatch/);
    assert.match(red.out, /an edit outside my_context is one cause/);

    // THE ERASER: an ordinary edit, about `priority`, which re-stamps.
    assert.equal(run(['edit', id, '--extra', 'priority=2', '--summary-unchanged', '--yes']).code, 0);

    // The file is clean again — the checksum load error is gone, and doctor's
    // exit code is back to 0.
    const after = run(['doctor', '--json']);
    assert.equal(after.code, 0, after.out);
    const findings = (JSON.parse(after.out) as {
      findings: { code: string; item?: string; message: string }[];
    }).findings.filter((f) => f.code === 'state_unaudited' && f.item === id);
    assert.equal(findings.length, 1, 'the erased bypass is still reported');
    // And it is reported as a MEASURED fact rather than as one of two readings.
    assert.match(findings[0]!.message, /log RECORDS this item's file being changed outside/);
  } finally {
    if (previous === undefined) delete process.env[CORPUS_DIR_ENV];
    else process.env[CORPUS_DIR_ENV] = previous;
    removeTree(cwd);
  }
});
