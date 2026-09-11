// @basis TASK-the-summary-is-staged-to-disk-reviewed-as-numbered-points, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **Staging a session summary to disk, and the one ordering that matters** —
 * `plan:restore seq:2`, design of record
 * `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md` §3, §5
 * and §6.
 *
 * `seq:1` built the reader. This is the half that puts a summary on disk, in a
 * form the owner can approve, so that it survives the clear he is about to
 * perform. What is worth proving here:
 *
 *   1. **Stage before clear, and the stage is VERIFIED by a re-read.** The
 *      item's one non-negotiable: *"Step 5 must complete and be verifiable on
 *      disk BEFORE the owner is told it is safe to clear — 'the clear happens
 *      without the stage' is the one failure mode that loses the thing this
 *      exists to save."* So the test corrupts the file between the write and
 *      the approval and asserts the owner is NOT told it is safe.
 *   2. **Two artefacts, not one.** §5: the payload, as long as it needs to be,
 *      and the review form — numbered subjects, one line each — which is what
 *      he reads and approves. Both are stored; neither is derivable from the
 *      other at approval time.
 *   3. **A partial build cannot produce a form that looks complete.** §5 again:
 *      *"A review form that reads as complete when it is partial is worse than
 *      no review form."* This is a requirement on the form's CONTENT, so it is
 *      tested on the rendered text, not on a flag.
 *   4. **Never automatic.** An agent may build. Only the owner approves, and
 *      the module has no path to the injection at all — the injection reaches
 *      IN, which the test asserts as a direction rather than a sentence.
 *   5. **No budget management** — owner ruling, explicit. A payload far larger
 *      than any tier in this product survives the round trip byte for byte.
 *
 * Everything runs in a temp workspace. Nothing here reads the developer's own
 * transcripts and nothing writes outside its own temp directory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { readStagingDir } from '../../src/lesson/staging.ts';
import {
  RESTORE_STAGING_PROTOCOL, approvedRestore, loadStagedRestore, readRestoreStagingDir,
  restoreStagingFile, verifyStagedRestore,
} from '../../src/core/restore-staging.ts';
import {
  approveStagedRestore, buildRestoreProposal, coverageShortfalls, discardStagedRestore,
  renderStagedReviewForm, stageRestoreSummary,
} from '../../src/core/restore-stage.ts';
import { summariseTranscript } from '../../src/core/session-summary.ts';
import { sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '../..');

/** A throwaway transcript. Real JSONL, one record per line, as the harness writes it. */
function fixture(lines: unknown[]): { file: string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-restore-'));
  const file = path.join(dir, 'session.jsonl');
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  return { file, dispose: () => removeTree(dir) };
}

function answer(text: string, at = '2026-09-07T10:00:00.000Z'): unknown {
  return { type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

/** Enough real material that a build has something to say. */
const MATERIAL: unknown[] = [
  answer('We ruled that the index is derived, because losing it costs time and never knowledge.'),
  answer('I was wrong about the filter: it is structural, not a whitelist of record types.'),
  answer('Measured: of 24,757 records, 15,788 carry no message object at all — 64% of the file.'),
  answer('We tried a global top-60 and it failed: 45 of 60 slots went to measurements.'),
  answer('Still open: whether thinking blocks should be scored, and that waits on the owner.'),
];

/* ── 1. the stage is a file on disk, and the reader is a separate module ──── */

test('a staged summary is a file on disk that a reader which cannot write can load back', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);

    assert.equal(staged.verified, true, 'staging reports verified only after it re-reads the file');
    const onDisk = JSON.parse(readFileSync(restoreStagingFile(ws.root, staged.key), 'utf8'));
    assert.equal(onDisk.protocol, RESTORE_STAGING_PROTOCOL);

    const loaded = loadStagedRestore(ws.root, staged.key);
    assert.ok(loaded, 'the record must load back through the read half');
    assert.equal(loaded.state, 'proposed',
      'a build is automatic and approves nothing — the owner approves, and he has not yet');
    assert.equal(loaded.payload, proposal.payload);
    assert.equal(loaded.reviewForm, proposal.reviewForm);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 2. stage before clear: the safe-to-clear sentence rests on a re-read ─── */

test('the owner is not told it is safe to clear when the file on disk is not what was staged', () => {
  // The one failure mode the item names: the clear happens without the stage.
  // A write that RETURNED is not a summary that SURVIVES, so the approval
  // re-reads and compares rather than trusting its own earlier success.
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);

    // Something else wrote over the file between the stage and the approval —
    // a half-finished sync, another process, a hand edit.
    const file = restoreStagingFile(ws.root, staged.key);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    record.payload = 'a truncated payload that is not what the owner read';
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    const approved = approveStagedRestore(ws.root, staged.key, 'human', proposal);
    assert.equal(approved.safeToClear, false,
      'a clear on this answer would destroy the window and restore nothing');
    assert.match(String(approved.reason), /payload on disk/,
      'and the refusal must say WHICH artefact disagreed, not merely that something did');
    assert.equal(loadStagedRestore(ws.root, staged.key)?.state, 'proposed',
      'and it must not be left APPROVED on disk: a refusal that leaves an approved record ' +
      'behind hands the next session start exactly the summary it just refused');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('an approval that verifies says it is safe to clear, and only then', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);
    const approved = approveStagedRestore(ws.root, staged.key, 'human', proposal);

    assert.equal(approved.safeToClear, true);
    assert.equal(approved.verification.ok, true);
    assert.ok(approved.verification.payloadBytes > 0,
      'the verification reports the bytes it actually read back, not a boolean it was handed');
    const loaded = loadStagedRestore(ws.root, staged.key);
    assert.equal(loaded?.state, 'approved');
    assert.equal(loaded?.approvedBy, 'human');
    assert.equal(approvedRestore(ws.root).record?.key, staged.key,
      'and it is now the record the next injection is allowed to deliver');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('the approval is refused when the form on disk is not the form that was read', () => {
  // The OTHER artefact, and it is a separate refusal rather than the same one:
  // the payload can be intact while the form that described it is not, and the
  // owner approved against the form. A verification that only compared payloads
  // would let him approve a summary described by a document he never saw.
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);
    const file = restoreStagingFile(ws.root, staged.key);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    record.reviewForm = 'COVERAGE: COMPLETE — a form describing some other summary';
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    const approved = approveStagedRestore(ws.root, staged.key, 'human', proposal);
    assert.equal(approved.safeToClear, false);
    assert.match(String(approved.reason), /review form on disk/);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('a staged restore carrying a foreign protocol is refused, not read', () => {
  // `lesson/staging.ts`'s own reason: a file from an incompatible version is
  // working state a human has to look at, and reading it as though its fields
  // meant what this build means by them is how an approval gets honoured that
  // nobody gave.
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const staged = stageRestoreSummary(ws.root, buildRestoreProposal(t.file));
    const file = restoreStagingFile(ws.root, staged.key);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    record.protocol = 'my_context/session-restore@99';
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    assert.throws(() => loadStagedRestore(ws.root, staged.key), /protocol is/);
    assert.equal(approvedRestore(ws.root).record, null,
      'and it is certainly not eligible for delivery');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('verifyStagedRestore refuses when nothing is staged at all', () => {
  // The degenerate case of the same ordering: a stage that never landed must
  // read as "not safe", never as "nothing to check, carry on".
  const ws = sandbox();
  try {
    const v = verifyStagedRestore(ws.root, 'nothing-here', { payload: 'p', reviewForm: 'r' });
    assert.equal(v.ok, false);
    assert.match(String(v.reason), /did not survive/);
  } finally {
    ws.dispose();
  }
});

/* ── 3. two artefacts, not one ────────────────────────────────────────────── */

test('the payload and the review form are two artefacts, and the form is the numbered one', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    assert.notEqual(proposal.payload, proposal.reviewForm,
      'design §5: the review form is NOT the payload');
    // The form is numbered main subjects, one line each — that is the whole of
    // what the owner reads before he approves.
    const numbered = proposal.reviewForm.split('\n').filter((l) => /^\s+\d+\.\s/.test(l));
    assert.ok(numbered.length > 0, 'the review form must carry numbered points');
    assert.ok(
      numbered.every((l) => !l.includes('\n')),
      'one line each — a form whose entries wrap is not the short form he agreed to read',
    );
    assert.equal(proposal.summary.points.length, numbered.length,
      'and every point kept is a line on the form: a form listing fewer would be the ' +
      'partial-that-reads-as-complete §5 refuses');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 4. the form is honest about coverage ─────────────────────────────────── */

test('a partial build cannot produce a review form that reads as complete', () => {
  const t = fixture(MATERIAL);
  try {
    // Partial three ways at once, each a different kind of partial: the read is
    // pinned behind the end of the file, the range is not the whole session,
    // and the cap is below what was admitted.
    const whole = summariseTranscript(t.file);
    const size = whole.coverage.fileBytes;
    const partial = summariseTranscript(t.file, {
      upToBytes: Math.floor(size / 2), maxPoints: 1,
    });

    const shortfalls = coverageShortfalls(partial);
    assert.ok(shortfalls.length > 0, 'a build that read half the file is partial');
    const form = renderStagedReviewForm(partial);
    assert.ok(form.includes('COVERAGE: PARTIAL'),
      'the headline must say partial, at the top, where he cannot miss it');
    assert.equal(form.includes('COVERAGE: COMPLETE'), false,
      'and it must not ALSO claim completeness anywhere in the same form');
    for (const shortfall of shortfalls) {
      assert.ok(form.includes(shortfall),
        `the form omits a shortfall it knows about: ${shortfall}`);
    }
  } finally {
    t.dispose();
  }
});

test('a build that read the whole file and kept everything says so, so PARTIAL means something', () => {
  // Anti-vacuity for the test above: if the headline were always PARTIAL it
  // would carry no information at all.
  const t = fixture(MATERIAL);
  try {
    const complete = summariseTranscript(t.file, { maxPoints: 500 });
    assert.deepEqual(coverageShortfalls(complete), [],
      'a whole-file, uncapped, unfiltered build has nothing to disclose');
    const form = renderStagedReviewForm(complete);
    assert.ok(form.includes('COVERAGE: COMPLETE'));
    assert.equal(form.includes('COVERAGE: PARTIAL'), false);
  } finally {
    t.dispose();
  }
});

test('every way of being partial is named, not just the first one found', () => {
  const t = fixture(MATERIAL);
  try {
    const size = summariseTranscript(t.file).coverage.fileBytes;
    const many = summariseTranscript(t.file, {
      upToBytes: size - 10,
      maxPoints: 1,
      subjects: ['the'],
      range: { kind: 'record', index: 1 },
    });
    const shortfalls = coverageShortfalls(many);
    const kinds = new Set(shortfalls.map((s) => s.split(' ')[0]));
    assert.deepEqual(
      [...kinds].sort(),
      ['CAP:', 'EMPTY:', 'RANGE:', 'SNAPSHOT:', 'SUBJECTS:'],
      'five different kinds of partial are present in this build and each must be named in its ' +
      `own words: ${shortfalls.join(' | ')}`,
    );
  } finally {
    t.dispose();
  }
});

test('a read that stopped short of what it was asked for says so', () => {
  // TRUNCATED. Asked for twice the file, so the read ends before the offset it
  // was pinned to — a real state on a transcript that shrank or was replaced
  // under the run, and the one shortfall a reader would otherwise have to
  // notice by comparing two numbers nobody points at.
  const t = fixture(MATERIAL);
  try {
    const size = summariseTranscript(t.file).coverage.fileBytes;
    const short = summariseTranscript(t.file, { upToBytes: size * 2, maxPoints: 500 });
    assert.ok(short.coverage.readBytes < short.coverage.upToBytes,
      'the fixture must actually produce a short read, or this proves nothing');
    const shortfalls = coverageShortfalls(short);
    assert.ok(shortfalls.some((s) => s.startsWith('TRUNCATED:')),
      `a short read is partial and must be named: ${shortfalls.join(' | ')}`);
    assert.ok(renderStagedReviewForm(short).includes('COVERAGE: PARTIAL'));
  } finally {
    t.dispose();
  }
});

test('a transcript line that would not parse is named as coverage lost, not swallowed', () => {
  // UNPARSEABLE. `seq:1` counts it (`coverage.unreadable`); what this adds is
  // that it reaches the form the owner approves against, because a record that
  // could not be read is a record whose content nobody can promise is absent
  // from the summary for a good reason.
  const t = fixture(MATERIAL);
  try {
    writeFileSync(t.file, `${readFileSync(t.file, 'utf8')}{not json at all\n`, 'utf8');
    const built = summariseTranscript(t.file, { maxPoints: 500 });
    assert.equal(built.coverage.unreadable, 1, 'the fixture must produce exactly one bad line');
    const shortfalls = coverageShortfalls(built);
    assert.ok(shortfalls.some((s) => s.startsWith('UNPARSEABLE:')),
      `a line nobody could read is coverage lost: ${shortfalls.join(' | ')}`);
    assert.ok(renderStagedReviewForm(built).includes('COVERAGE: PARTIAL'));
  } finally {
    t.dispose();
  }
});

/* ── 5. never automatic: only the owner approves ──────────────────────────── */

test('an agent cannot approve a staged restore, and the refusal is by actor not by flag', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);
    const attempt = approveStagedRestore(
      ws.root, staged.key, 'agent' as unknown as 'human', proposal,
    );
    assert.equal(attempt.safeToClear, false);
    assert.match(String(attempt.reason), /owner/i);
    assert.equal(loadStagedRestore(ws.root, staged.key)?.state, 'proposed');
    assert.equal(approvedRestore(ws.root).record, null,
      'and nothing became eligible for the next injection');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('a proposed restore is never eligible for delivery — the approval is what releases it', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    stageRestoreSummary(ws.root, buildRestoreProposal(t.file));
    assert.equal(approvedRestore(ws.root).record, null,
      'an agent may build; a build is not a decision');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('neither restore module can inject: the dependency runs one way, and this is that way', async () => {
  // `core/retire.ts` asserts its own inability the same way, and for the same
  // reason: the owner acts, always. A module that could reach the injection
  // could deliver a summary into a window without him — which is the one thing
  // the item forbids by name.
  const { readFile } = await import('node:fs/promises');
  for (const name of ['restore-staging.ts', 'restore-store.ts', 'restore-stage.ts']) {
    const source = await readFile(path.join(REPO, 'src', 'core', name), 'utf8');
    const imports = [...source.matchAll(/^import (?!type )[^;]*?from '(.+?)';$/gms)].map((m) => m[1]!);
    assert.deepEqual(
      imports.filter((m) => /inject|select|render\.ts|hooks\//.test(m)), [],
      `${name} has grown a runtime edge to the injection. The injection reaches IN for a ` +
      'staged restore; nothing here may reach out to a context window.',
    );
    const exported = [...source.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]!);
    assert.deepEqual(
      exported.filter((n) => /^(inject|apply|deliver)/i.test(n)), [],
      `${name} exports a verb that reads as putting this into a window. There is no such verb ` +
      'for an agent to call: only the owner injects, and he does it by clearing.',
    );
  }
});

test('the read half loads nothing that writes, and nothing at all from this project', () => {
  // `test/ui/staging-endpoint.test.ts` holds the same boundary for lesson
  // staging, by walking the graph rather than describing it. Same walk here,
  // and type-only edges are erased at runtime so they are not followed.
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [path.join(REPO, 'src', 'core', 'restore-staging.ts')];
  const push = (from: string, spec: string): void => {
    if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(from), spec));
    else bare.add(spec);
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*(['"])([^'"]+)\3/g)) {
      if (m[1] === undefined) push(file, m[4]!);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*(['"])([^'"]+)\1/g)) push(file, m[2]!);
    for (const m of source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)) push(file, m[2]!);
  }
  assert.deepEqual(
    [...files].map((f) => path.relative(REPO, f).split(path.sep).join('/')),
    ['src/core/restore-staging.ts'],
    'the read half of restore staging has grown a project import. One file with no project ' +
    'edge is what lets it be trusted to hold the owner\'s approval.',
  );
  assert.deepEqual([...bare].sort(), ['node:fs', 'node:path'],
    'the read half imports something beyond node:fs and node:path');
  const source = readFileSync(path.join(REPO, 'src', 'core', 'restore-staging.ts'), 'utf8');
  const fsImport = /import\s*\{([^}]*)\}\s*from\s*'node:fs'/.exec(source);
  assert.ok(fsImport, 'the node:fs import is no longer a named-binding list this test can read');
  assert.deepEqual(
    fsImport[1]!.split(',').map((s) => s.trim()).filter((s) => s !== '').sort(),
    ['existsSync', 'readFileSync', 'readdirSync'],
    'the read half binds an fs API it did not before, and every name here must be a READ',
  );
});

/* ── 6. no budget management — owner ruling, explicit ─────────────────────── */

test('a payload larger than every budget in this product is stored and read back whole', () => {
  // *"NO BUDGET MANAGEMENT - owner ruling, explicit: it takes as much as it
  // requires, because this is not ongoing behaviour but the last option for
  // restoring things that would otherwise be lost."*
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const huge = `${proposal.payload}\n${'x'.repeat(400_000)}`;
    const staged = stageRestoreSummary(ws.root, { ...proposal, payload: huge });
    assert.equal(staged.verified, true);
    assert.equal(loadStagedRestore(ws.root, staged.key)?.payload, huge,
      'not truncated, not tiered, not trimmed — 400 KB out is 400 KB back');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 7. living beside lesson staging without setting off its alarms ───────── */

test('the lesson sweep reports no skipped file when a restore is staged beside it', () => {
  // `.staging/*.json` is swept by `lesson/staging.ts`, which reports every file
  // carrying a foreign protocol as one it could not read — on the Status screen
  // and in `mycontext status`. A restore record in that directory would be an
  // alarm about a file that is exactly where it belongs, so restores live one
  // level down, where that sweep's `.json` filter never sees them.
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    stageRestoreSummary(ws.root, buildRestoreProposal(t.file));
    const { staging, skipped } = readStagingDir(ws.root);
    assert.deepEqual(skipped, [], 'a staged restore must be invisible to the lesson sweep');
    assert.deepEqual(staging, []);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 8. the read half's trust checks ──────────────────────────────────────── */

test('a staged restore whose file disagrees with its own name is refused, not read', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const staged = stageRestoreSummary(ws.root, buildRestoreProposal(t.file));
    const file = restoreStagingFile(ws.root, staged.key);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    record.key = 'some-other-restore';
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    assert.throws(() => loadStagedRestore(ws.root, staged.key), /names "some-other-restore"/);
    // And the DIRECTORY sweep turns the same refusal into a row rather than
    // making every other record unlistable — INV-nothing-is-dropped-silently.
    const { staged: listed, skipped } = readRestoreStagingDir(ws.root);
    assert.deepEqual(listed, []);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0]!.file, `${staged.key}.json`);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('a key that could escape the staging directory is refused where it becomes a path', () => {
  const ws = sandbox();
  try {
    assert.throws(() => restoreStagingFile(ws.root, '../../escape'), /not a valid staged-restore key/);
  } finally {
    ws.dispose();
  }
});

test('a discarded restore is gone, and nothing is left eligible for delivery', () => {
  const ws = sandbox();
  const t = fixture(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);
    approveStagedRestore(ws.root, staged.key, 'human', proposal);
    assert.ok(approvedRestore(ws.root).record);

    assert.equal(discardStagedRestore(ws.root, staged.key).removed, true);
    assert.equal(loadStagedRestore(ws.root, staged.key), null);
    assert.equal(approvedRestore(ws.root).record, null);
  } finally {
    t.dispose();
    ws.dispose();
  }
});
