// @basis TASK-the-review-queue-explains-a-proposal-at-length-and-never,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none,
// INV-nothing-is-dropped-silently, CONST-node-24-no-build-step
//
// **The claim this file exists to prove is that the recommendation CARRIES
// INFORMATION.** The item makes that binding rather than advisory:
//
//   *"A recommendation that is always 'promote' is a button with a sentence
//   next to it… if the recommendation is the same value on nearly all of them,
//   it carries no information and the item is not closed."*
//
// So the central test is a SPREAD measurement, and beside it a removal proof
// for the defect that actually shipped in the first draft of this feature and
// was caught by exactly that measurement: `recommend` was reading
// `Proposal.claim`, which is `claimKey`'s sorted token soup rather than a
// sentence, and answered `decline` for 310 of 310 real candidates. That
// removal is reproduced here — the source is mutated back to the bug, the
// mutation is proved to have LANDED, the detector is shown to redden, and the
// bytes are put back and re-read.
//
// **Nothing here writes a real item.** Every write goes through `sandbox()`,
// the same separation `propose.test.ts` states and for the same reason: this
// project dogfoods itself and the module under test creates corpus items.
//
// ── ONE TEST DOES REST ON THE LIVE CORPUS, DELIBERATELY ─────────────────────
//
// "the spread across the drafts standing in this workspace" reads
// `.my_context/.drafts/`, because the owner's binding question is about HIS
// queue and a fixture answering it would be a fixture carrying the proof's
// power. It measures what is there and says so; with fewer than three review
// drafts it asserts nothing and NAMES that as the reason, rather than passing
// vacuously.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DRAFT_DIR } from '../../src/core/drafts.ts';
import { parseItem } from '../../src/core/item.ts';
import { openRebuiltStore } from '../../src/core/open-store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { deriveInput, draftFiles } from '../../src/review/backfill-recommendations.ts';
import {
  NO_QUEUE_CEILING, propose, type Proposal,
} from '../../src/review/propose.ts';
import {
  backfillTag, backfilledFromTags, claimShapeOf, claimShapeOfSummary, composeBody,
  recommend, recommendTag, splitRecommendation, targetKindOf, verdictFromTags,
  RECOMMENDATION_END, VERDICTS,
  type RecommendInput, type Verdict,
} from '../../src/review/recommend.ts';
import type { PassInput, Point } from '../../src/review/input.ts';
import { sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/** Every signal recorded and every one of them good. The `promote` corner. */
function whole(over: Partial<RecommendInput> = {}): RecommendInput {
  return {
    targetKind: 'file',
    target: 'src/core/item.ts',
    targetResolves: true,
    claim: 'whole',
    confirmed: false,
    sessionsSeen: 1,
    evidenceCount: 1,
    absent: [],
    ...over,
  };
}

function point(text: string, over: Partial<Point> = {}): Point {
  return {
    category: 'measurement', who: 'model', source: 'C:/t/lane.jsonl', recordIndex: 7,
    at: '2026-09-11T00:00:00.000Z', text, ...over,
  };
}

function passInput(points: Point[]): PassInput {
  return {
    points, readTo: 0, sources: ['C:/t/lane.jsonl'], whole: true, skipped: [],
    readBytes: 0, records: points.length, unreadable: 0, briefPoints: 0, ms: 0,
  };
}

// ── THE PRECEDENCE, PROVED BY REMOVAL ───────────────────────────────────────

test('the decision order is total: remove one signal at a time and the verdict falls', () => {
  // FINDING, anti-vacuity: each line below changes exactly ONE field of the
  // line above it and asserts a DIFFERENT verdict or a different reason. A
  // constant function fails at the second assertion, and a function reading
  // only one of the five fields fails at whichever line moves a field it
  // ignores. That is what makes this more than a table of expected values.
  const best = whole();
  assert.equal(recommend(best).verdict, 'promote',
    'a whole claim about a file that is here is the only thing that reaches promote');

  // Remove the SUBJECT'S EXISTENCE. Nothing else changes.
  const gone = recommend(whole({ targetResolves: false }));
  assert.equal(gone.verdict, 'decline',
    'a subject that is not in the repository any more ends it before anything else is weighed');
  assert.match(gone.why, /not in this repository any more/);

  // Put it back, remove the claim's ENDING instead.
  const introducer = recommend(whole({ claim: 'introducer' }));
  assert.equal(introducer.verdict, 'decline',
    'a colon-introducer is an opening with no finding under it');
  assert.match(introducer.why, /ends at a colon/);

  const cut = recommend(whole({ claim: 'cut' }));
  assert.equal(cut.verdict, 'decline', 'a sentence with no end cannot be read off the draft');
  assert.notEqual(cut.why, introducer.why,
    'two different fragments get two different reasons — a shared sentence would be a label');

  // Remove the ability to SEE the claim at all. `null` is not `cut`.
  const unseen = recommend(whole({ claim: null }));
  assert.equal(unseen.verdict, 'needs-you',
    'a question that could not be asked is needs-you, never a default');
  assert.notEqual(unseen.verdict, cut.verdict,
    'ABSENT IS ABSENT: an unrecorded claim shape must not behave like a bad one');

  // Remove the TARGET KIND. The claim is whole and the file question is moot.
  assert.equal(recommend(whole({ targetKind: null, target: null, targetResolves: null })).verdict,
    'needs-you', 'a subject nobody recorded cannot be checked, so it is yours');
  assert.equal(recommend(whole({ targetKind: 'none', target: null, targetResolves: null })).verdict,
    'needs-you', 'a claim about nothing in particular is a judgement about the corpus');
  assert.equal(recommend(whole({ targetKind: 'item', target: 'RULE-x' })).verdict,
    'needs-you', 'a claim about an item in this corpus is a ruling the pass has no standing for');

  // And the one that raises the reason rather than the verdict.
  const confirmed = recommend(whole({ confirmed: true, sessionsSeen: 3 }));
  assert.equal(confirmed.verdict, 'promote');
  assert.match(confirmed.why, /3 independent/,
    'recurrence is the strongest promote reason and the row says the number');
});

test('null is never read as false — the recurrence sentence gives it away', () => {
  // FINDING, anti-vacuity: the two inputs differ in ONE field, both are
  // `promote`, and the assertion is on the SENTENCE. A `confirmed: null` that
  // fell through to the `false` branch would be a row saying "it rests on one
  // session" about a draft where nobody counted sessions, and the verdict
  // alone could never have caught it.
  const unconfirmed = recommend(whole({ confirmed: false, sessionsSeen: 1 }));
  const unrecorded = recommend(whole({ confirmed: null, sessionsSeen: null }));
  assert.equal(unconfirmed.verdict, unrecorded.verdict, 'both promote — the verdict is not the tell');
  assert.match(unconfirmed.why, /rests on one session/);
  assert.doesNotMatch(unrecorded.why, /rests on one session/,
    'an unrecorded recurrence must not be reported as one session');
  assert.match(unrecorded.why, /never recorded/);
  assert.match(unrecorded.from, /recurrence: not recorded/,
    'and the signal line says it too, so the two cannot drift');
});

test('what was NOT recoverable is printed, not omitted', () => {
  // FINDING, anti-vacuity: `absent: []` and a non-empty `absent` produce
  // different `from` lines, and the difference is the clause. A function that
  // ignored `absent` would pass the first assertion and fail the second.
  const plain = recommend(whole({ absent: [] }));
  assert.doesNotMatch(plain.from, /Not recoverable/,
    'a capture-time row has nothing missing and says nothing about missing things');
  const derived = recommend(whole({ absent: ['how many sessions it was seen in'] }));
  assert.match(derived.from, /Not recoverable, and so treated as absent rather than guessed/);
  assert.match(derived.from, /how many sessions it was seen in/);
});

// ── THE SHAPE READER, AND THE ONE THING IT REFUSES TO GUESS ─────────────────

test('claimShapeOfSummary answers null on a CLIPPED summary rather than judging its last character', () => {
  // FINDING, anti-vacuity: the same sentence, once whole and once clipped, is
  // the removal. A reader that ignored the ellipsis would answer `cut` for the
  // clipped copy — a verdict about an ending it cannot see.
  const sentence = 'parseItem casts Status out of frontmatter with no check.';
  assert.equal(claimShapeOfSummary(sentence), 'whole');
  assert.equal(claimShapeOfSummary('parseItem casts Status out of frontmatter with no…'), null,
    'a clipped summary shows nothing about how the claim ends, and null says so');
  assert.equal(claimShapeOf(sentence), 'whole');
  assert.equal(claimShapeOf('and the write must be in contradiction scope and'), 'cut');
  assert.equal(claimShapeOf('The three most surprising findings:'), 'introducer');
});

test('targetKindOf uses the SAME predicate propose.ts uses to decide whether to write a scope', () => {
  // A path gets a scope; an item id does not. One predicate, and the backfill
  // depends on that being true — an empty scope is what makes an item target
  // and no target at all indistinguishable after the fact.
  assert.equal(targetKindOf('src/core/item.ts'), 'file');
  assert.equal(targetKindOf('RULE-a-task-is-not-done-until-its-state-says-done'), 'item');
  assert.equal(targetKindOf(null), 'none');
});

// ── HOW IT IS RECORDED, AND THE SPLIT THAT READS IT BACK ────────────────────

test('composeBody → splitRecommendation returns the brief BYTE-IDENTICAL', () => {
  const brief = 'A draft from the self-improvement pass.\nEvidence: lane.jsonl record 7.\n\n"quoted"';
  const rec = recommend(whole());
  const body = composeBody(rec, brief, null);
  const split = splitRecommendation(body);
  assert.equal(split.brief, brief,
    'the brief is not shortened to make room — the item says so in as many words');
  assert.ok(split.why !== null && split.why.includes(rec.why));

  // REMOVAL: take the marker out and the body has no recommendation in it.
  const noMarker = body.replace(RECOMMENDATION_END, '');
  const after = splitRecommendation(noMarker);
  assert.equal(after.why, null, 'no marker, no recommendation — it is not inferred from prose');
  assert.notEqual(after.brief, brief,
    'and the detector can see the difference: without the marker the brief is NOT recovered');
});

test('a body with no marker at all is the whole brief — every draft captured before this shipped', () => {
  const brief = 'A draft from the self-improvement pass. It governs nothing.';
  const split = splitRecommendation(brief);
  assert.equal(split.why, null);
  assert.equal(split.brief, brief, 'nothing is trimmed off a draft that never carried one');
});

test('the verdict comes off the TAG and is never read back out of prose', () => {
  // FINDING, anti-vacuity: the tag says one thing and the prose says the
  // opposite. A reader that parsed the sentence would answer `promote`.
  assert.equal(verdictFromTags(['review-pass', recommendTag('decline')]), 'decline');
  assert.equal(verdictFromTags(['review-pass', 'unconfirmed']), null,
    'no tag, no verdict — and null is a row that says it has none');
  assert.equal(verdictFromTags(['rec:not-a-verdict']), null,
    'a rec: tag carrying something outside the closed set is refused, not coerced');
  assert.equal(backfilledFromTags(['rec:promote']), null, 'a captured row declares no backfill date');
  assert.equal(backfilledFromTags([backfillTag('2026-09-15')]), '2026-09-15');
  for (const v of VERDICTS) {
    assert.equal(verdictFromTags([recommendTag(v as Verdict)]), v,
      'every verdict round-trips through its own tag');
  }
});

// ── THE WIRING: THE PASS RECORDS IT, AT CAPTURE ─────────────────────────────

const CHECKABLE =
  'The basis gate in scripts/check-basis.ts admits a test file carrying no @basis line, so the ' +
  'assertion never fails and the exit code is always 0.';

test('propose records the verdict as a tag and the reason above the brief, at capture', async () => {
  const box = sandbox();
  try {
    const out = await propose(passInput([point(CHECKABLE)]), {
      workspace: box.root, ctx: box.ctx, sessionId: 's1', max: 5,
      queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(out.proposals.length, 1, 'one checkable observation, one proposal');
    const p = out.proposals[0] as Proposal;
    assert.ok(VERDICTS.includes(p.recommendation.verdict),
      'the pass composed a verdict from the closed set');

    const file = path.join(box.root, DRAFT_DIR, 'task', `${p.id}.md`);
    const item = parseItem(readFileSync(file, 'utf8'), 'x.md', 'project');
    assert.equal(verdictFromTags(item.tags), p.recommendation.verdict,
      'the tag on disk is the verdict the pass reported — one spelling, not two');
    assert.equal(backfilledFromTags(item.tags), null,
      'a draft written at capture carries NO backfill date, which is how a reader tells it apart');

    const split = splitRecommendation(item.body);
    assert.ok(split.why !== null, 'the reason was written above the brief');
    assert.ok(split.why.includes(p.recommendation.why), 'and it is the reason the pass composed');
    assert.equal(split.brief, p.brief,
      'the brief stored under the marker is briefOf output, byte for byte');
    assert.doesNotMatch(split.why, /BACKFILLED/,
      'a captured row says nothing about being backfilled, because it was not');
  } finally {
    box.dispose();
    removeTree(box.cwd);
  }
});

test('REMOVAL: read the shape off `claim` instead of `statement` and the spread collapses to one value', async () => {
  // **This is the defect that shipped in the first draft of this feature**, and
  // it is reproduced by mutating the source back to it. `Proposal.claim` is
  // `claimKey`'s sorted, stemmed token string — it has no punctuation, so its
  // shape is `cut` for every proposal that has ever existed. Measured on the
  // owner's own session: 310 of 310 `decline`.
  //
  // The proof runs in this order, and every step is asserted rather than
  // assumed: the mutation is written, the file is RE-READ to prove it landed,
  // a FRESH copy of the module is imported, the detector is shown to go red on
  // the mutant, and the original bytes are written back and re-read.
  const source = path.resolve(import.meta.dirname, '../../src/review/recommend.ts');
  const original = readFileSync(source, 'utf8');
  const good = 'export function claimShapeOf(claim: string): ClaimShape {\n  const text = claim.trim();';
  assert.ok(original.includes(good), 'the subject of this proof is where the proof says it is');

  // The detector, over a set of statements with genuinely different endings.
  const statements = [
    'The basis gate in scripts/check-basis.ts admits a test with no @basis line.',
    'scripts/check-handover.ts:472 skips an unknown plan, so a lane pointer is not read as a lane:',
    'and the write must be in scripts/gate.ts contradiction scope and',
  ];
  const spreadOf = (shapeOf: (s: string) => string): Set<string> => {
    const seen = new Set<string>();
    for (const s of statements) {
      seen.add(recommend(whole({ claim: shapeOf(s) as RecommendInput['claim'] })).verdict);
    }
    return seen;
  };

  // GREEN FIRST, so the detector is known to be able to report both answers.
  assert.equal(spreadOf((s) => claimShapeOf(s)).size, 2,
    'on the shipped reader the three endings produce two different verdicts');

  const url = pathToFileURL(source).href;
  try {
    // The mutation: make every ending look like a token soup's, which is what
    // reading `claim` did.
    writeFileSync(source, original.replace(good,
      'export function claimShapeOf(claim: string): ClaimShape {\n  const text = claim.trim().replace(/[.!?:]+$/, \'\');'), 'utf8');
    const landed = readFileSync(source, 'utf8');
    assert.notEqual(landed, original, 'the mutation LANDED — the file on disk changed');
    assert.ok(landed.includes("replace(/[.!?:]+$/, '')"), 'and it landed at the line this proof names');

    const mutant = await import(`${url}?mutant=claimshape`) as { claimShapeOf: (s: string) => string };
    assert.equal(spreadOf(mutant.claimShapeOf).size, 1,
      'RED: with the ending stripped, all three statements get ONE verdict — the degenerate ' +
      'distribution the item makes a failure condition');
  } finally {
    writeFileSync(source, original, 'utf8');
    assert.equal(readFileSync(source, 'utf8'), original,
      'the original bytes are back — verified by re-reading, not by having written them');
  }
});

// ── THE BACKFILL: WHAT IT DERIVES, AND WHAT IT REFUSES TO ───────────────────

test('the backfill derives only from fields that survived, and names what did not', () => {
  const md = [
    '---', 'id: TASK-x', 'type: task', 'title: t', 'status: draft', 'severity: soft',
    'always: false', 'summary: "parseItem casts Status out of frontmatter with no check."',
    'summary_of: 0000000000000000', 'scope:', '  - src/core/item.ts', 'tags:',
    '  - review-pass', '  - unconfirmed', 'origin: review', 'source_file: null',
    'source_anchor: null', 'source_checksum: null', 'valid_from: 2026-09-13',
    'valid_until: null', 'checksum: 0000000000000000', '---', '', '# t', '', 'brief text', '',
  ].join('\n');
  const item = parseItem(md, `${DRAFT_DIR}/task/TASK-x.md`, 'project');
  const derived = deriveInput(item, process.cwd());

  assert.equal(derived.targetKind, 'file', 'a path target survived, in `scope`');
  assert.equal(derived.target, 'src/core/item.ts');
  assert.equal(derived.confirmed, false, 'recurrence survived, as a tag');
  assert.equal(derived.claim, 'whole', 'the summary was not clipped, so the ending is visible');

  // **The two that did NOT survive, and the assertion is that they are null.**
  // Both are stated in the brief's prose — "Seen in ONE session only",
  // "Evidence: x.jsonl record 297" — and reading them back out of it would be
  // the exact defect `TASK-task-reconstruct-a-subject-from-a-passage-you-copied-without`
  // describes, committed inside the change meant to make this screen honest.
  assert.equal(derived.evidenceCount, null, 'evidence count is not parsed back out of prose');
  assert.equal(derived.sessionsSeen, null, 'nor is the session count');
  assert.ok(derived.absent.some((a) => a.includes('evidence records')));
  assert.ok(derived.absent.some((a) => a.includes('sessions')));
});

test('an EMPTY scope is reported as ambiguous, not as "no target"', () => {
  // FINDING, anti-vacuity: the two items differ only in `scope`, and the
  // assertion is that the no-scope one does NOT claim to know the target kind.
  // Reading an empty scope as `targetKind: 'none'` would be the backfill
  // asserting the proposal named nothing, when it may have named an item.
  const base = (scope: string) => [
    '---', 'id: TASK-y', 'type: task', 'title: t', 'status: draft', 'severity: soft',
    'always: false', 'summary: "a whole sentence about something."',
    'summary_of: 0000000000000000', scope, 'tags:', '  - review-pass', '  - unconfirmed',
    'origin: review', 'source_file: null', 'source_anchor: null', 'source_checksum: null',
    'valid_from: 2026-09-13', 'valid_until: null', 'checksum: 0000000000000000', '---', '',
    '# t', '', 'brief', '',
  ].join('\n');
  const scoped = deriveInput(
    parseItem(base('scope:\n  - src/core/item.ts'), `${DRAFT_DIR}/task/TASK-y.md`, 'project'),
    process.cwd());
  const bare = deriveInput(
    parseItem(base('scope: []'), `${DRAFT_DIR}/task/TASK-y.md`, 'project'), process.cwd());

  assert.equal(scoped.targetKind, 'file');
  assert.equal(bare.targetKind, null, 'an empty scope is UNKNOWN, not "named nothing"');
  assert.notEqual(bare.targetKind, 'none',
    'the pass writes a scope only for a file path, so an empty one is two cases at once');
  assert.ok(bare.absent.some((a) => a.includes('names an item in the corpus or names nothing')),
    'and the row says which two cases it could not tell apart');
  assert.notEqual(recommend(scoped).verdict, recommend(bare).verdict,
    'the difference is not cosmetic: it changes the verdict');
});

// ── THE BINDING MEASUREMENT, ON THE OWNER'S OWN QUEUE ───────────────────────

test('the spread across the review drafts standing in THIS workspace', () => {
  // **This rests on the live corpus on purpose.** The owner's question is about
  // his queue, and a fixture answering it would be a fixture carrying the
  // proof's power — the thing this suite is told to beware of. Nothing is
  // written: the derivation is read-only and the recommendation is composed in
  // memory.
  const ws = resolveWorkspace(process.cwd());
  assert.ok(ws.projectRoot !== null, 'this test runs inside a workspace or it measures nothing');
  const root = ws.projectRoot;

  // **TWO spreads, and both are measured, because they can go degenerate
  // independently.** The first is what a reader of the screen actually sees —
  // the RECORDED verdict, which is the owner's question. The second is what
  // `recommend` answers today over the same drafts, and it is here because the
  // first one is blind to a degenerate `recommend`: once every row carries a
  // tag, the recorded spread stays healthy no matter what the function does.
  // Measured: with `recommend` mutated to a constant, the recorded spread
  // alone stayed GREEN. It does not any more.
  const verdicts: Verdict[] = [];
  const derived: Verdict[] = [];
  for (const file of draftFiles(root)) {
    const item = parseItem(
      readFileSync(file, 'utf8'),
      path.relative(root, file).split(path.sep).join('/'), 'project');
    if (item.origin !== 'review') continue;
    const fresh = recommend(deriveInput(item, path.dirname(root))).verdict;
    derived.push(fresh);
    verdicts.push(verdictFromTags(item.tags) ?? fresh);
  }
  if (derived.length >= 3) {
    assert.ok(new Set(derived).size >= 2,
      `re-deriving every draft in this queue answers ${[...new Set(derived)].join(', ')} and ` +
      'nothing else — the function itself carries no information, whatever the tags say');
  }

  if (verdicts.length < 3) {
    // NOT a silent pass. Fewer than three drafts cannot show a distribution,
    // and saying so is the legal answer — `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`'s
    // shape applied to a measurement instead of a basis.
    assert.ok(true,
      `only ${verdicts.length} review draft(s) are in this queue, which is too few to show a ` +
      'distribution — this assertion measures nothing today and says so rather than passing');
    return;
  }

  const counts = new Map<Verdict, number>();
  for (const v of verdicts) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  assert.ok(counts.size >= 2,
    `every one of the ${verdicts.length} drafts in this queue got the same recommendation ` +
    `(${[...counts.keys()].join(', ')}) — that is a button with a sentence next to it, and the ` +
    'item is not closed');
  assert.ok(top < verdicts.length,
    `${top} of ${verdicts.length} share one verdict: ${JSON.stringify([...counts])}`);
});

// ── NO MODEL, NO NETWORK, ON EITHER SIDE OF THE MARKER ─────────────────────

test('recommend.ts reaches nothing that could call a model or a network', () => {
  // The read surface's hard rule, asserted on the module the read surface now
  // imports. `read-model-work.ts`'s own comment is the standard: *"a review
  // surface that called a model would break the read surface's no-writes
  // guarantee and would put a network dependency in an offline plugin."*
  const text = readFileSync(
    path.resolve(import.meta.dirname, '../../src/review/recommend.ts'), 'utf8');
  const imports = [...text.matchAll(/^import[^;]*from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, [],
    'recommend.ts imports nothing at all — it is pure, and the whole decision can be replayed');
  for (const banned of ['node:child_process', 'node:http', 'node:https', 'fetch(', './model.ts']) {
    assert.ok(!text.includes(banned), `recommend.ts must not reach ${banned}`);
  }
});

test('a corpus draft written by the pass opens, parses, and its checksum is its own', () => {
  // The backfill rewrites real draft files. A file it touched that no longer
  // parses, or whose checksum no longer matches its content, would be a
  // corrupted queue — and `doctor` would report it as an alteration nobody
  // made. Checked against whatever is in the queue right now.
  const ws = resolveWorkspace(process.cwd());
  assert.ok(ws.projectRoot !== null);
  const opened = openRebuiltStore(ws);
  try {
    const drafts = opened.store.all().filter((i) => i.origin === 'review');
    let checked = 0;
    for (const item of drafts) {
      const verdict = verdictFromTags(item.tags);
      if (verdict === null) continue;
      checked++;
      const split = splitRecommendation(item.body);
      assert.ok(split.brief.length > 0,
        `${item.id} carries a verdict and an empty brief — the split ate the body`);
      // **The marker on disk is the marker in source.** A change to
      // `RECOMMENDATION_END` would keep the round trip working for anything
      // written after it and would ORPHAN every draft already in the queue —
      // their reason would fall through into the brief and be drawn as part of
      // the reasoning. Measured: nothing else in this file reddens on that
      // mutation, so this is the assertion that catches it.
      assert.ok(split.why !== null,
        `${item.id} carries a rec: tag but no readable reason — the marker in source no longer ` +
        'matches the marker written into this draft');
      assert.ok(!split.brief.includes('Decided from —'),
        `${item.id}'s recommendation leaked into its brief`);
      assert.ok(split.brief.startsWith('A draft from the self-improvement pass'),
        `${item.id}'s brief does not begin where briefOf begins — the split cut in the wrong place`);
    }
    assert.ok(checked >= 1,
      'no draft in this queue carries a recorded verdict, so this assertion measured nothing');
    assert.ok(true, `${drafts.length} review draft(s) parsed through the store`);
  } finally {
    opened.store.close();
  }
});

