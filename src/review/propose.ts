/**
 * **Turning what the pass read into drafts nobody has to trust** —
 * `plan:loop seq:3`, design §4 (the artifact order), §5b (dedupe), §5c
 * (relevance), §6 (the two summaries), §12 (anti-learning), §3c (recurrence),
 * §13 (what stays manual).
 *
 * ── THE ONE THING TO KNOW BEFORE READING ANY OF IT ─────────────────────────
 *
 * **Nothing in this product calls a model, and this module does not either.**
 * `prompt.ts` is the artifact a forked session would carry (design §5), and it
 * is built, tested and unused by the code path below. What runs today is a
 * DETERMINISTIC proposer: it classifies each observation the pass gathered by
 * the same two questions §4 asks, in the same order, and writes a draft for
 * the tiers it can legitimately author — see `AUTHORABLE`, which is `check`
 * alone and says why in measured terms. That is a narrower thing than the
 * design imagines and it is said out loud rather than implied, because the
 * alternative — shipping a prompt nothing invokes and letting a reader assume
 * a model is reading it — is exactly §12's fifth rule applied to this file.
 *
 * What the deterministic proposer buys is the property the design cares most
 * about: **the artifact order is EXECUTED rather than requested.** A prompt
 * asking a model to prefer checks is a request that fails silently. `classify`
 * below takes the first tier that fits and `test/review/propose.test.ts`
 * proves the precedence by REMOVAL — strip the mechanism from a text and watch
 * it fall to `rule`; strip the modal too and watch it fall to `lesson`.
 *
 * ── AND WHAT IT CANNOT SEE ─────────────────────────────────────────────────
 *
 *  - **It reads a transcript, so it sees what was SAID.** Not what was
 *    understood, not what was acted on, not reasoning that never reached a
 *    transcript. `plan:loop seq:1`'s standing caveat, unchanged.
 *  - **`briefPoints`.** A lane's dispatch brief is stored as a `type:'user'`
 *    record, so the reader would have counted it as something a person typed.
 *    `gather` drops those and counts them; `wholenessLine` and the prompt both
 *    disclose the count. A rule quoted into ten briefs is one rule, not ten
 *    confirmations, and §3c's independence check depends on that being true.
 *  - **Falsehood.** The screen below is lexical. A four-stage write-time
 *    screen with 83.2% recall on indirect prompt injection rejected 0 of 360
 *    poisoned memories (arXiv:2608.21230). These rules catch carelessness.
 */
import { readFileSync, renameSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createItem, type MutationContext } from '../core/mutate.ts';
import { SUMMARY_MAX_CHARS } from '../core/validate.ts';
import { claimKey, sameClaim } from './claim.ts';
import { alreadyDeclined } from './declined.ts';
import { suppress, type Pending } from './dedupe.ts';
import type { PassInput, Point } from './input.ts';

// ── §4: WHAT IT PROPOSES ────────────────────────────────────────────────────

/** Check, then rule, then lesson. The order is the finding, not a preference. */
export type Artifact = 'check' | 'rule' | 'lesson';

/**
 * The category each artifact becomes, and the middle row is the one worth
 * pausing on.
 *
 * **A proposed check becomes a `task`, not a `rule`.** §4: *"approving a check
 * creates WORK TO BE BUILT — a task, not a law. A proposed check that is wrong
 * is found the moment someone writes it, because it passes or fails against
 * real data. A wrong prose lesson simply sits there being read."* Filing it as
 * a task is what makes approving it safe: the owner is agreeing that something
 * is worth building, not that something is true.
 */
export const ARTIFACT_CATEGORY: Record<Artifact, string> = {
  check: 'task',
  rule: 'rule',
  lesson: 'lesson',
};

/**
 * **Can it be checked?** — the second of §4's two questions, as a predicate.
 *
 * A cue here means the observation names something a machine could decide:
 * a command that can be run, a file that can be opened, a gate that can pass
 * or fail, an exit code, a count. It does NOT mean the observation is
 * important, and it does not mean the check is easy — only that a check is
 * conceivable, which is the whole of what §4 asks.
 *
 * Kept lexical and small on purpose. A wider list would start classifying
 * anything with a filename in it as checkable, and the cost of that error is
 * the expensive direction: a `task` proposing a check nobody can build wastes
 * the owner's review, where a `rule` that could have been a check merely
 * under-delivers.
 */
const CHECK_CUES: [RegExp, string][] = [
  [/\bnpm run [a-z:-]+/i, 'names an npm script'],
  [/\bnode\s+(?:--[\w=-]+\s+)*[\w./-]+\.(?:ts|js|mjs)/i, 'names a script that can be run'],
  [/\b(?:scripts|test)\/[\w./-]+/i, 'names a file under scripts/ or test/'],
  [/\bcheck-[a-z-]+\b/i, 'names a check by name'],
  [/\bexit code\b/i, 'turns on an exit code'],
  [/\b(?:assert|asserts|asserted|assertion)\b/i, 'is stated as an assertion'],
  [/\b(?:gate|gates|gated)\b/i, 'describes a gate'],
  [/\bfails? the build\b/i, 'describes a build failure'],
  [/\b(?:doctor|lint|linter|typecheck|tsc)\b/i, 'names an existing checking surface'],
  [/\b\d+ of \d+\b/i, 'carries a countable outcome'],
];

/**
 * **Is it normative?** — §4's fallback before prose.
 *
 * A modal says what must or must not happen. Without a mechanism beside it
 * (above) there is nothing to run, but there is still something to obey, and
 * a constraint is a stronger artifact than a paragraph.
 */
const RULE_CUES: [RegExp, string][] = [
  [/\b(?:never|must not|may not|cannot|do not|don't)\b/i, 'forbids something'],
  [/\b(?:must|always|has to|required)\b/i, 'requires something'],
  [/\bonly\b.{0,40}\b(?:way|path|place|caller|surface)\b/i, 'names a sole legal route'],
  [/\brather than\b/i, 'states a preference between two options'],
];

export interface Classification {
  artifact: Artifact;
  /** Why this tier and not the one above it. Written into the draft. */
  because: string;
  /** Which cues fired, so a reader can disagree with the specific one. */
  cues: string[];
}

/**
 * §4's two questions, in order, over one observation.
 *
 * **The precedence is total and it is the point.** The first tier that fits
 * wins, so a text carrying both a mechanism and a modal is a `check` — never a
 * `rule` — and a text carrying neither is a `lesson`. Removing the mechanism
 * from such a text must move it to `rule`; removing the modal too must move it
 * to `lesson`. That is a property, and it is proved by removal in the tests
 * rather than asserted by this comment.
 */
export function classify(text: string): Classification {
  const checks = CHECK_CUES.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (checks.length > 0) {
    return {
      artifact: 'check',
      because: `it can be checked: the observation ${checks[0]}`,
      cues: checks,
    };
  }
  const rules = RULE_CUES.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (rules.length > 0) {
    return {
      artifact: 'rule',
      because: `nothing here can be run, but it is normative: the observation ${rules[0]}`,
      cues: rules,
    };
  }
  return {
    artifact: 'lesson',
    because: 'neither checkable nor normative, so prose is the fallback',
    cues: [],
  };
}

// ── §12: THE ANTI-LEARNING SCREEN, MECHANICALLY ─────────────────────────────

/**
 * The four lexical rules, plus the structural fifth.
 *
 * **This is the carelessness half of §12 and nothing more.** The full five
 * rules live in `prompt.ts` for a reader that can weigh them; what is here is
 * what a regular expression can decide. Every entry was written against a real
 * shape and none is a guess about wording in general.
 */
const ANTI_LEARNING_SCREEN: [RegExp, string][] = [
  [
    /command not found|is not recognized as (?:an )?internal|could not find [\w.-]+ on (?:the )?path|not installed/i,
    'a missing binary is a fact about one machine, not about this project',
  ],
  [
    /\bapi[ _-]?keys?\b|\bcredentials?\b|\bpasswords?\b|\b(?:access|auth|bearer) tokens?\b/i,
    'an unset credential is a setup step, and writing it down puts a secret shape in a file',
  ],
  [
    /\bflak(?:e|y|iness)\b|\btransient\b|\bintermittent\b|retried?[^.]{0,30}\b(?:passed|succeeded|green)\b/i,
    'a failure that resolved taught nothing, and captured as a fact it makes future sessions afraid',
  ],
  [
    /\bstill (?:fails|failing|broken|red|does not work)\b|\bgave up\b|\bcould not (?:get|make)[^.]{0,40}\bwork\b|\bunresolved\b/i,
    'an unresolved failure written up as guidance is an untested sequence of failures a future session would trust and repeat',
  ],
];

/** Why this observation must not be captured, or `null`. */
export function antiLearning(text: string): string | null {
  for (const [re, why] of ANTI_LEARNING_SCREEN) {
    if (re.test(text)) return why;
  }
  return null;
}

// ── §5c: RELEVANCE ──────────────────────────────────────────────────────────

/** A repository path, or an item id. Whichever appears first. */
const TARGET_PATH = /\b(?:src|test|scripts|docs|e2e|hooks)\/[\w./-]+\.[a-z]{1,4}\b/;
const TARGET_ITEM = /\b(?:CONST|INV|RULE|REQ|STD|PAT|DEC|ADR|TASK|LESSON|PROC|RUN|OPENQ)-[a-z0-9-]{4,}\b/;

/**
 * What an observation is ABOUT, or `null`.
 *
 * `null` is a legal answer and not a failure: plenty of real observations name
 * no file. What it costs is `suppress`'s target gate — a claim about nothing in
 * particular is only ever compared with other claims about nothing in
 * particular — which is the conservative direction.
 */
export function targetOf(text: string): string | null {
  return TARGET_PATH.exec(text)?.[0] ?? TARGET_ITEM.exec(text)?.[0] ?? null;
}

/**
 * §5c's gate: **a proposal whose evidence does not touch its target is
 * refused, not softened.**
 *
 * Upstream issue #66350 shipped without this and wrote content from an
 * unrelated research task into an existing skill. Here the target is DERIVED
 * from the evidence, so the gate should never fire on this module's own
 * output — and it is checked anyway, because the value of a gate that cannot
 * fire on today's caller is what it does to tomorrow's.
 */
export function evidenceTouchesTarget(target: string | null, evidence: readonly string[]): boolean {
  if (target === null) return true;
  return evidence.some((text) => text.includes(target));
}

// ── §3c: RECURRENCE, WHICH LABELS AND NEVER GATES ───────────────────────────

/** One claim this workspace has seen, and the sessions it was seen in. */
export interface Sighting {
  claim: string;
  target: string | null;
  /** Distinct session ids. Length >= 2 is what `confirmed` means. */
  sessions: string[];
  first: string;
  last: string;
}

/**
 * How many claims the sightings ledger keeps. Bounded for `DECLINE_CAP`'s
 * reasons — it is read on every pass and it is a file on disk.
 */
export const SIGHTING_CAP = 1000;

/** `<root>/state/review-claims.json`. Gitignored with the rest of `state/`. */
export function sightingsPath(root: string): string {
  return path.join(root, 'state', 'review-claims.json');
}

/** Every sighting on record. `[]` for anything unreadable — `readDeclines`' posture. */
export function readSightings(root: string): Sighting[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(sightingsPath(root), 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Sighting[] = [];
  for (const row of parsed) {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.claim !== 'string' || r.claim === '') continue;
    out.push({
      claim: r.claim,
      target: typeof r.target === 'string' ? r.target : null,
      sessions: Array.isArray(r.sessions) ? r.sessions.filter((s) => typeof s === 'string') : [],
      first: typeof r.first === 'string' ? r.first : '',
      last: typeof r.last === 'string' ? r.last : '',
    });
  }
  return out;
}

function writeSightings(root: string, rows: Sighting[]): void {
  const target = sightingsPath(root);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(path.join(path.dirname(target), '.gitignore'), '*\n', 'utf8');
    writeFileSync(tmp, `${JSON.stringify(rows.slice(-SIGHTING_CAP), null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
  }
}

/**
 * Record that this claim was seen in this session, and answer whether anything
 * INDEPENDENT confirms it.
 *
 * **Recurrence gates the LABEL, not the proposal** (§3c). A one-session
 * observation is still proposed; it is marked unconfirmed so the owner can
 * weigh it differently. The reason is measured rather than cautious: steps
 * within one session are causally correlated and cannot count as independent
 * confirmation (arXiv:2607.02579), so "I saw it three times today" is one
 * observation. Two sessions in the same workspace is the smallest thing that
 * is not.
 *
 * The workspace IS the CWD constraint §3c asks for: this ledger lives inside
 * one corpus root, so a claim recorded here was seen while working on this
 * project and nowhere else.
 */
export function noteSighting(
  root: string, claim: string, target: string | null, sessionId: string | null, at: string,
): { confirmed: boolean; sessions: number } {
  const rows = readSightings(root);
  const session = sessionId ?? 'unknown-session';
  const hit = rows.find((row) => (row.target ?? null) === (target ?? null) && sameClaim(claim, row.claim));
  if (hit === undefined) {
    rows.push({ claim, target, sessions: [session], first: at, last: at });
    writeSightings(root, rows);
    return { confirmed: false, sessions: 1 };
  }
  if (!hit.sessions.includes(session)) hit.sessions.push(session);
  hit.last = at;
  writeSightings(root, rows);
  return { confirmed: hit.sessions.length >= 2, sessions: hit.sessions.length };
}

// ── BUILDING ONE PROPOSAL ───────────────────────────────────────────────────

/** Where an observation came from. §5c: a proposal names this or it is refused. */
export interface Evidence {
  source: string;
  recordIndex: number;
  at: string | null;
  /** Bounded. Cited as evidence, never used as the proposal's content (§12). */
  quote: string;
}

export interface Proposal {
  /** The created draft's id, or `null` on a dry run. */
  id: string | null;
  artifact: Artifact;
  category: string;
  title: string;
  summary: string;
  /** §6's review brief. Several sentences, for the person deciding. */
  brief: string;
  target: string | null;
  claim: string;
  confirmed: boolean;
  sessionsSeen: number;
  evidence: Evidence[];
  /** `classify`'s reason. Why this tier and not the one above it. */
  because: string;
}

/** Markdown, list markers and runs of whitespace, removed. */
function clean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * **A one-off task narrative, recognised by its opening** — §12's fourth rule,
 * as far as a regular expression can take it.
 *
 * *"What happened on one day is a story. What must happen every time is a
 * rule."* A sentence that opens in the first person, or by naming a lane, or
 * by continuing an unstated previous point, is reporting an event. It may well
 * be reporting a true and important event — the screen is about SHAPE, not
 * truth — but the thing it is shaped like is a status update, and a status
 * update promoted into this corpus is a story a future session obeys.
 *
 * Measured before it existed: over the owner's own session the five
 * highest-ranked candidates were all narrative or instruction, and two of them
 * opened *"1 should be retired…"* and *"i know the last requirement
 * contradicts…"* — a person's instructions to an agent, proposed back to him
 * as things this project had learned.
 */
const NARRATIVE_OPENING =
  /^(?:i|we|my|our|you|your|it|that|this|there|here|so|and|but|also|now|then|next|ok|okay|yes|no)\b|^lane\s|^\d+[.)]?\s|^(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:thing|more|other)/i;

/**
 * The sentence in `text` that actually mentions `target`, cleaned, date- and
 * ticket-stripped and bounded — or `null` when no single sentence does.
 *
 * **This is §5c's relevance gate doing real work rather than nodding.** A
 * proposal's title is the sentence about the thing the proposal is about; if
 * the observation mentions `src/core/needs.ts` in one paragraph and makes its
 * claim in another, this build cannot tell which claim belongs to that file,
 * and the honest answer is to refuse rather than to staple them together. That
 * stapling is upstream issue #66350 in miniature.
 */
function claimSentence(text: string, target: string): string | null {
  for (const raw of clean(text).split(/(?<=[.!?:])\s+/)) {
    if (!raw.includes(target)) continue;
    const stripped = raw
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
      .replace(/#\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[-–—:,;]+\s*/, '');
    if (stripped.length < 20) continue;
    if (NARRATIVE_OPENING.test(stripped)) return null;
    return stripped;
  }
  return null;
}

/** Bounded to `SUMMARY_MAX_CHARS`, which the write path enforces anyway. */
function clip(text: string, max: number): string {
  const flat = clean(text);
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * §6's review brief and the draft's body: several sentences for the person
 * deciding, and **no `## ` heading anywhere in it** — a body is stored only as
 * the prose before its first heading, so a heading here would silently lose
 * everything after it.
 */
function briefOf(proposal: Omit<Proposal, 'id' | 'brief'>): string {
  const where = proposal.evidence
    .map((e) => `${path.basename(e.source)} record ${e.recordIndex}`)
    .join('; ');
  const confirmation = proposal.confirmed
    ? `Seen in ${proposal.sessionsSeen} independent sessions in this workspace, so something ` +
      `other than one afternoon's work supports it.`
    : `Seen in ONE session only, so it is UNCONFIRMED. Steps inside a single session are ` +
      `causally correlated and cannot confirm each other; a second, independent session is what ` +
      `would make this more than one observation.`;
  const targetLine = proposal.target === null
    ? 'It names no file or item, so nothing narrows where it applies.'
    : `It is about ${proposal.target}, which the evidence names directly.`;
  const tierLine = proposal.artifact === 'check'
    ? `Proposed as a task to BUILD a check rather than as a rule to obey, because ` +
      `${proposal.because}. Approving this creates work, not law: a check that is wrong is ` +
      `found by whoever writes it.`
    : `Proposed as a ${proposal.artifact} because ${proposal.because}.`;

  return [
    `A draft from the self-improvement pass. It governs nothing and is not committed.`,
    tierLine,
    targetLine,
    confirmation,
    `Evidence: ${where === '' ? 'none recorded' : where}.`,
    ``,
    `What was observed, quoted as evidence rather than as the content of this proposal:`,
    ...proposal.evidence.map((e) => `"${clip(e.quote, 400)}"`),
  ].join('\n');
}

// ── THE PASS'S PROPOSING HALF ───────────────────────────────────────────────

/**
 * **Which tiers this build will actually AUTHOR, and the reason is measured
 * rather than cautious.**
 *
 * Read the first dry run over the owner's own session before reading the
 * decision. 1,282 observations, 841,502,108 bytes, 292 sources. The five
 * highest-ranked candidates were: a person's instruction about retiring an
 * item, a person's instruction about migrating 42 items, a person's request
 * for a contradiction mechanism, and two more of his own turns — every one of
 * them **his words, proposed back to him as something this project had
 * learned**, and every one of them naming no file. That is §12's fourth rule
 * (one-off task narratives) and its shape contract (no quoted user text as
 * content) failing together, and it is the exact outcome the plan's Task 5
 * Step 5 says to look for: *"If they are narratives rather than rules… the
 * prompt is wrong."*
 *
 * Requiring a target and screening narrative openings fixed the material — the
 * candidates that survive now cite a file and a record — but it did not change
 * the underlying fact, which is structural and not a tuning problem:
 *
 *   **A lexical proposer can select an observation. It cannot write a rule.**
 *
 * Every candidate it produces is a SENTENCE FROM THE TRANSCRIPT. As the body
 * of a `rule` or a `lesson`, that sentence becomes law or knowledge, and the
 * corpus grows a paragraph nobody generalised. As the body of a `task`, the
 * same sentence is a piece of work somebody is being asked to look at — which
 * is precisely §4's own safety argument for preferring checks: *"approving a
 * check creates WORK TO BE BUILT — a task, not a law. A proposed check that is
 * wrong is found the moment someone writes it."*
 *
 * So this build authors `check` and nothing else. The `rule` and `lesson`
 * candidates are classified, counted and reported — `ProposeResult.unauthored`
 * — so nothing is dropped silently (INV-nothing-is-dropped-silently); they are
 * simply not written by a thing that would be quoting rather than composing.
 * **Widening this set is not a config change**; it waits for the writer §5
 * describes, and for a week of read output that earns it.
 */
export const AUTHORABLE: readonly Artifact[] = ['check'];

export interface ProposeOptions {
  /** The corpus root — the `.my_context` directory. Drafts and ledgers live under it. */
  workspace: string;
  /** How to write. The caller owns the store's lifetime. */
  ctx: MutationContext;
  sessionId: string | null;
  /** §11's `maxProposalsPerPass`. The ration on VOLUME, never on the rubric. */
  max: number;
  /**
   * Build every candidate and write NOTHING — no draft, no sighting.
   * `plan:loop seq:2` shipped a dry run as its only mode for the same reason
   * this keeps one: the way to find out what a proposer would say is to let it
   * say it somewhere that costs nothing.
   */
  dryRun?: boolean;
  /**
   * Which tiers to author. Defaults to `AUTHORABLE` — read its comment before
   * widening it, and note that widening it in a caller is not the same as
   * earning it.
   */
  authors?: readonly Artifact[];
}

export interface ProposeResult {
  /** Ids of the drafts written. Empty on a dry run, by construction. */
  created: string[];
  /** Every candidate that survived, whether or not it was written. */
  proposals: Proposal[];
  /** Observations the pass gathered. The denominator for everything below. */
  considered: number;
  /** Dropped by §12's lexical screen. */
  screened: number;
  /** Dropped because §5c found no claim worth a proposal. */
  empty: number;
  /** Dropped by §5b as a near-duplicate of something already pending. */
  suppressed: number;
  /** Dropped because the owner already declined this claim (§8). */
  declined: number;
  /** Refused by §5c's relevance gate. Should be 0 while the target is derived. */
  irrelevant: number;
  /** Beyond the ration. Candidates that would have been proposed on a bigger budget. */
  rationed: number;
  /**
   * Candidates whose tier this build will not author, by tier — see
   * `AUTHORABLE`. **Counted rather than merely skipped**: a proposer that
   * silently declined to write two thirds of what it found would be
   * indistinguishable from one that found nothing.
   */
  unauthored: Record<Artifact, number>;
  /** The reasons, in order, so a pass that proposed nothing can say why. */
  because: string[];
}

/** Ranking inside the ration. Highest first. */
function weigh(point: Point, artifact: Artifact, confirmed: boolean): number {
  const tier = artifact === 'check' ? 3 : artifact === 'rule' ? 2 : 1;
  const who = point.who === 'person' ? 3 : 0;
  const kind = point.category === 'correction' ? 3
    : point.category === 'failure' ? 2
      : point.category === 'decision' ? 1 : 0;
  return tier + who + kind + (confirmed ? 2 : 0);
}

/**
 * Read every observation this pass gathered, and write drafts for the few that
 * survive.
 *
 * **The order of the gates is cost order and it is deliberate**, the same
 * shape `plan:loop seq:2`'s rubric uses: the lexical screen is free, the claim
 * key is cheap, the decline and dedupe sweeps are linear in bounded lists, and
 * the write is last. Nothing expensive runs for a candidate that was never
 * going to survive.
 *
 * `async` because the plan declares it so and because a later build that forks
 * a model here must not be a signature change. Nothing inside awaits today.
 */
export async function propose(
  input: PassInput, options: ProposeOptions,
): Promise<ProposeResult> {
  const at = new Date().toISOString();
  const result: ProposeResult = {
    created: [], proposals: [], considered: input.points.length,
    screened: 0, empty: 0, suppressed: 0, declined: 0, irrelevant: 0, rationed: 0,
    unauthored: { check: 0, rule: 0, lesson: 0 },
    because: [],
  };
  const authors = options.authors ?? AUTHORABLE;

  // `pending` starts with this pass's own survivors and grows as they are
  // accepted, so two observations of one thing inside a single pass collapse
  // to one proposal — the failure §5b names first.
  const pending: Pending[] = [];
  const ranked: { point: Point; proposal: Omit<Proposal, 'id' | 'brief'>; weight: number }[] = [];

  for (const point of input.points) {
    const text = clean(point.text);
    if (text === '') { result.empty++; continue; }

    const screened = antiLearning(text);
    if (screened !== null) {
      result.screened++;
      result.because.push(`screened: ${screened}`);
      continue;
    }

    // **A proposal must NAME something** — §5c, and requiring it here is what
    // measurement forced. Without this line the five highest-ranked candidates
    // over the owner's own 841 MB session named no file, no module and no item
    // between them; every one was a person's instruction to a lane, re-proposed
    // to him as a thing this project had learned. 438 of 1,282 observations
    // name a target, and those are the ones that carry a claim about this
    // codebase rather than a claim about that afternoon.
    const target = targetOf(text);
    if (target === null) {
      result.irrelevant++;
      result.because.push('refused: names no file, module or item, so nothing narrows it');
      continue;
    }
    if (!evidenceTouchesTarget(target, [point.text])) {
      result.irrelevant++;
      result.because.push(`refused: evidence does not touch ${target}`);
      continue;
    }

    const sentence = claimSentence(text, target);
    if (sentence === null) {
      result.screened++;
      result.because.push(
        'screened: no single sentence makes a claim about the target, or the one that does is ' +
        'a narrative rather than a rule',
      );
      continue;
    }

    // The TITLE is the claim sentence bounded to one line; the SUMMARY is the
    // same sentence with room to finish itself (§6: 250 characters, and a
    // longer summary costs zero tokens per session because `IndexLine` never
    // carries one). Two clips of one sentence rather than two derivations, so
    // they can never disagree about what the proposal says.
    const title = clip(sentence, 100);
    const claim = claimKey(title, text, target);
    if (claim === '') { result.empty++; continue; }

    const declinedBefore = alreadyDeclined(options.workspace, claim, target);
    if (declinedBefore !== null) {
      result.declined++;
      result.because.push(`declined before${declinedBefore.why === null ? '' : ' by the owner'}`);
      continue;
    }

    const candidate: Pending = { id: `candidate:${ranked.length}`, target, title, body: text };
    const dropped = suppress(candidate, pending);
    if (dropped.drop) {
      result.suppressed++;
      result.because.push(`suppressed: ${dropped.because ?? 'near-duplicate'}`);
      continue;
    }
    pending.push(candidate);

    const { artifact, because } = classify(text);
    if (!authors.includes(artifact)) {
      result.unauthored[artifact]++;
      result.because.push(
        `not authored: a ${artifact} written from a transcript sentence would be quoted rather ` +
        `than composed — see AUTHORABLE`,
      );
      continue;
    }
    // A dry run must not write the sightings ledger either — a "what would it
    // propose" run that mutated the confirmation state would change the answer
    // the next real run gives.
    const seen = options.dryRun === true
      ? { confirmed: false, sessions: 1 }
      : noteSighting(options.workspace, claim, target, options.sessionId, at);

    ranked.push({
      point,
      weight: weigh(point, artifact, seen.confirmed),
      proposal: {
        artifact,
        category: ARTIFACT_CATEGORY[artifact],
        title,
        summary: clip(sentence, SUMMARY_MAX_CHARS),
        target,
        claim,
        confirmed: seen.confirmed,
        sessionsSeen: seen.sessions,
        because,
        evidence: [{
          source: point.source, recordIndex: point.recordIndex, at: point.at, quote: point.text,
        }],
      },
    });
  }

  ranked.sort((a, b) => b.weight - a.weight);
  const admitted = ranked.slice(0, Math.max(0, options.max));
  result.rationed = ranked.length - admitted.length;

  for (const { proposal } of admitted) {
    const brief = briefOf(proposal);
    if (options.dryRun === true) {
      result.proposals.push({ ...proposal, id: null, brief });
      continue;
    }
    // `origin: 'review'` is the whole trust boundary. It forces `draft` on any
    // tier (`trustedStatus`), sends the file to the gitignored draft region
    // (`core/drafts.ts`), and makes `update_item` and `supersede_item` refuse
    // this caller outright. Nothing here asks for any of that; it is a
    // property of the origin.
    const made = createItem(options.ctx, {
      type: proposal.category,
      title: proposal.title,
      summary: proposal.summary,
      body: brief,
      origin: 'review',
      tags: ['review-pass', proposal.confirmed ? 'confirmed' : 'unconfirmed'],
      ...(proposal.target === null || !proposal.target.includes('/')
        ? {}
        : { scope: [proposal.target] }),
    });
    if (made.created) result.created.push(made.id);
    result.proposals.push({ ...proposal, id: made.id, brief });
  }

  return result;
}
