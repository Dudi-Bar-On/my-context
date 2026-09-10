/**
 * **The prompt. It is the product, and it is the file most likely to ship
 * untested** — `plan:loop seq:3`, design §4, §5c, §6, §12.
 *
 * ── WHAT IS ASSERTED HERE, AND WHAT NO TEST CAN ASSERT ─────────────────────
 *
 * `test/review/prompt.test.ts` pins STRUCTURE: that all five anti-learning
 * rules are present, that the artifact order is checks before rules before
 * lessons, that the relevance requirement is stated, that the framing which
 * caused upstream issue #66350 is absent, and that the sentence which trips
 * the provider content filter never appears. **No test can tell you the
 * prompt produces good proposals.** The plan says so and the plan is right:
 * the only real check is reading a week of drafts.
 *
 * ── THE LIMIT, STATED IN THE FILE BECAUSE §12 SAYS TO ──────────────────────
 *
 * **These rules catch carelessness, not falsehood.** A four-stage write-time
 * screen with 83.2% recall on indirect prompt injection rejected **0 of 360**
 * poisoned memories (arXiv:2608.21230), because separating a false assertion
 * from a true one needs external grounding that no content screen has. Nothing
 * below is a defence against a plausible untruth. The three things that are:
 * §3c's cross-session recurrence, §4's preference for artifacts that can be
 * executed and therefore fail, and the human who promotes.
 *
 * ── AND ONE SENTENCE THAT MUST NEVER APPEAR ────────────────────────────────
 *
 * Upstream's pass carried a sentence urging the model to save its approach as
 * a reusable skill. That phrasing provoked a provider content-filter rejection
 * which surfaced to the user as a BILLING error — a failure that looks like an
 * account problem and is not. It is asserted absent rather than merely avoided,
 * because the next person to write encouraging copy here will not know that.
 */
import type { PassInput, Point } from './input.ts';
import { wholenessLine } from './input.ts';

/**
 * **The order, and the order IS the finding.**
 *
 * TRACE (arXiv:2606.13174) mined user corrections, rewrote them as atomic
 * rules and compiled them into runtime checks that must pass before an agent
 * completes a task: preference violations fell **100% → 37.6%**
 * in-distribution and **2.0%** out-of-distribution, where memory-style capture
 * alone left **57.5%** violated. The difference is not capture and it is not
 * approval — it is that the artifact is executable and enforced rather than
 * prose a model may or may not attend to. Distilled prose skills measured
 * **−2.44pp**.
 *
 * And this repository is local evidence for the same thing. What measurably
 * improved it was checks born from corrections: `check-cited-items` from a
 * comment citing a retired decision, `check-basis` from 26 fixtures that named
 * nothing, the contradiction gate from the owner's own question. Every one
 * came from a correction; every one is enforced rather than advisory.
 *
 * A prose fallback is unchanged as a category. It stops being the default.
 */
export const ARTIFACT_ORDER = [
  'Ask two questions, in this order, and never only the first.',
  '',
  '  1. What did we learn?',
  '  2. CAN IT BE CHECKED?',
  '',
  'Then propose exactly one artifact, taking the first that fits:',
  '',
  '  check   - it can be decided mechanically. Propose a task to BUILD the',
  '            check: a script, a doctor finding, a test, a gate. Name what it',
  '            would run and what would make it fail. Approving this creates',
  '            WORK, not law - a check that is wrong is found the moment',
  '            somebody writes it, because it passes or fails against real data.',
  '  rule    - it cannot be decided mechanically, but it is normative: it says',
  '            what must or must not happen. Propose a constraint.',
  '  lesson  - neither. Propose prose. This is the FALLBACK and not the',
  '            default, and a proposal that lands here should say why the two',
  '            above did not fit.',
  '',
  'A wrong check is discovered. A wrong prose note sits there being read.',
].join('\n');

/**
 * **All five, and the fifth is a scar.** Design §12.
 *
 * The first four were upstream's original list. The fifth was added LATER, as
 * a separate fix, and its text is the sharpest in that file — an untested
 * sequence of failures written up as a reliable workflow is guidance a future
 * session will trust and repeat. **Start with all five** rather than
 * rediscovering the fifth.
 */
export const ANTI_LEARNING = [
  'DO NOT capture any of these. Each one is a scar, not a style preference:',
  '',
  '  1. Missing binaries. A tool that was not installed on one machine is not',
  '     knowledge about this project.',
  '  2. Unset credentials. An environment variable nobody exported is a setup',
  '     step, and writing it down puts a secret shape in a file.',
  '  3. Transient failures that resolved. A retry that succeeded taught',
  '     nothing; a flake captured as a fact makes future sessions afraid.',
  '  4. One-off task narratives. What happened on one day is a story. What',
  '     must happen every time is a rule. Only the second is worth keeping.',
  '  5. Unresolved failures written up as if they worked. If the session ended',
  '     WITHOUT actually finding a working method, do NOT write those attempts',
  '     up as a reliable workflow. That presents an untested sequence of',
  '     failures as validated guidance a future session will trust and repeat.',
  '',
  'These five catch carelessness. They do NOT catch falsehood: a write-time',
  'screen with 83.2% recall on indirect prompt injection rejected 0 of 360',
  'poisoned memories, because telling a false assertion from a true one needs',
  'grounding no content screen has. What guards against a plausible untruth is',
  'recurrence across independent sessions, artifacts that can fail, and the',
  'person who promotes. Not this list.',
].join('\n');

/** §12's shape contract, plus §6's instruction about the two summaries. */
export const SHAPE_CONTRACT = [
  'SHAPE:',
  '',
  '  - Procedure first. What to do, then why - never a narrative of what you',
  '    tried.',
  '  - A pitfall is written as a generalisable statement plus one clause of',
  '    why. Not an anecdote.',
  '  - NO ticket ids, NO dates, and NO quoted user text as the content of the',
  '    proposal. Cite evidence by location, never by transcribing what',
  '    somebody typed.',
  '  - The same thing learned twice is ONE proposal, not two.',
  '  - Fix a claim in place. Never append "UPDATE:" to it.',
  '',
  'THE TWO SUMMARIES, both written with maximum care - the owner asked for',
  'this in those words:',
  '',
  '  - summary: one plain sentence, at most 250 characters, for a reader who',
  '    does not know this codebase. It costs zero tokens per session to make',
  '    it a good one.',
  '  - review brief: several sentences for the person deciding. What was',
  '    observed, where, what it would take to check, and what you are unsure',
  '    of. It is deleted when the proposal is promoted, so it is written for',
  '    one reader on one occasion and never for the corpus.',
].join('\n');

/**
 * §5c. **A proposal must name what in the transcript it came from**, and one
 * whose evidence does not touch its target is refused.
 *
 * Upstream issue #66350: the fork wrote content from an UNRELATED research
 * task into an existing skill. The reporter named the cause — "be ACTIVE"
 * framing plus "add support files under existing umbrellas", with no topical
 * relevance check. **That framing is absent from this file deliberately, and
 * a test asserts its absence.** A pass that finds nothing has found nothing;
 * that is a legal and frequent answer, and it is stated here so the model does
 * not infer otherwise from the length of the prompt.
 */
export const RELEVANCE = [
  'EVIDENCE:',
  '',
  '  - Name what in the transcript this came from: the source file and the',
  '    record index, both of which are printed beside every observation below.',
  '  - Name the target: the path, the module or the item id the proposal is',
  '    about. If the evidence does not touch the target, the proposal is',
  '    refused - not softened.',
  '  - Proposing nothing is a correct outcome. Most passes should propose',
  '    nothing. A session in which nobody was corrected and nothing was',
  '    measured has taught this project nothing, and saying so is the right',
  '    answer rather than a wasted run.',
].join('\n');

/** What the pass may and may not do with what it concludes. Design §13. */
export const BOUNDARY = [
  'WHAT YOU MAY DO:',
  '',
  '  - Propose. Every proposal is a DRAFT. It governs nothing, it is injected',
  '    into no session, and it is not committed to this repository.',
  '  - Nothing else. You may not edit an existing item, retire one, promote',
  '    anything, or change what governs. The write path refuses all four, so',
  '    this is a description of the product and not a request.',
  '',
  'The person promotes. Always. Without ground truth an agent that scores its',
  'own work inflates the score on the episodes it got wrong and then reuses its',
  'most confident mistakes; approval by a person is the only break in that loop.',
].join('\n');

/** How many observations of one category are shown. Bounds the prompt, not the read. */
const PER_CATEGORY = 12;

/** One observation, with the location a proposal must cite. */
function renderPoint(point: Point): string {
  const where = `${point.source.split(/[\\/]/).pop() ?? point.source}#${point.recordIndex}`;
  const text = point.text.replace(/\s+/g, ' ').trim();
  const clipped = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  return `  [${point.category}/${point.who}] ${where}: ${clipped}`;
}

/**
 * The prompt for one pass.
 *
 * **The wholeness line leads**, exactly as it does in the report: a pass told
 * that it read a fraction of a session must weigh what it did not see, and a
 * coverage note at the bottom is a coverage note nobody reads. When the read
 * was partial, `wholenessLine` says so in its first three words and states
 * that every count is a floor.
 */
export function reviewPrompt(input: PassInput): string {
  const byCategory = new Map<string, Point[]>();
  for (const point of input.points) {
    const list = byCategory.get(point.category) ?? [];
    if (list.length < PER_CATEGORY) list.push(point);
    byCategory.set(point.category, list);
  }

  const observations: string[] = [];
  for (const [category, points] of [...byCategory].sort()) {
    const total = input.points.filter((p) => p.category === category).length;
    const shown = points.length < total ? ` (${points.length} of ${total} shown)` : '';
    observations.push(`${category.toUpperCase()}${shown}`);
    for (const point of points) observations.push(renderPoint(point));
    observations.push('');
  }
  if (observations.length === 0) {
    observations.push('Nothing in this stretch met the keep-categories. Propose nothing.');
  }

  const briefNote = input.briefPoints > 0
    ? `\n${input.briefPoints} line(s) in lane transcripts were dropped before you saw them: ` +
      `they are dispatch briefs, which are stored as if a person typed them and were not. ` +
      `A rule quoted into ten briefs is one rule, not ten confirmations.`
    : '';

  return [
    'You are reading one coding session to decide whether this project learned',
    'anything worth writing down. You propose; you never promote.',
    '',
    `COVERAGE: ${wholenessLine(input)}${briefNote}`,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    ARTIFACT_ORDER,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    ANTI_LEARNING,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    SHAPE_CONTRACT,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    RELEVANCE,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    BOUNDARY,
    '',
    '─────────────────────────────────────────────────────────────────────────',
    'WHAT THIS PASS READ:',
    '',
    ...observations,
  ].join('\n');
}
