/**
 * **The pass: it reads, it writes one report, and it creates nothing** —
 * `plan:loop seq:2`, design §5.
 *
 * ── IT NOW PROPOSES, AND THE RATION IS WHAT DECIDES ───────────────────────
 *
 * `plan:loop seq:2` shipped with `dryRun` as the only mode. `plan:loop seq:3`
 * adds the proposing half (`propose.ts`), and what decides whether a pass
 * writes anything is **`maxProposals`** — §11's `maxProposalsPerPass`, which
 * ships at 0 and is the owner's to raise. Zero is the ration set to nothing,
 * not a second kill switch: the switch is `review.enabled` and there is one of
 * it, which is §11's rule and the reason upstream's issue #82708 happened.
 *
 * `created` and `proposed` are FIELDS on the report rather than sentences in
 * this comment, because a reader checking whether the loop has started writing
 * to the corpus should be able to check it rather than trust it.
 *
 * **The reading half is unchanged.** Everything above the proposing block in
 * `runPass` is seq:2's, and the report is built in full before anything can be
 * written — a pass that lost its coverage record because the writing half
 * failed would be the worst of both.
 *
 * ── THE ONE ASSERTION THAT PROTECTS THE PERSON ─────────────────────────────
 *
 * `Stop` is the hook where somebody is staring at a prompt. The child is
 * `detached: true`, `stdio: 'ignore'`, `.unref()`ed and **never awaited** —
 * `src/ui/open.ts`'s pattern, including the part of it that is easy to leave
 * out: a `ChildProcess` whose spawn failed emits `'error'` on a later tick,
 * and an `EventEmitter` with no `'error'` listener rethrows it as an uncaught
 * exception. `openBrowser` records the measurement that established this on
 * Node v24.14.0, and the listener below is the difference between a hook that
 * returns and a hook that takes the session down.
 *
 * ── AND WHAT THE REPORT IS FOR ─────────────────────────────────────────────
 *
 * It is the whole output of this phase. Its first field after the stamp is the
 * wholeness line, because a report whose coverage is a footnote is a report
 * whose coverage nobody reads.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import { POINT_CATEGORIES, type PointCategory } from '../core/session-summary.ts';
import { openRebuiltStore } from '../core/open-store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { gather, wholenessLine, type PassInput, type SkippedSource } from './input.ts';
import {
  callAgentCli, isUsableModelName, parseReply, rulesMissing, MODEL_TIMEOUT_MS,
  type ModelCall, type ModelCandidate,
} from './model.ts';
import { reviewPrompt } from './prompt.ts';
import { NO_QUEUE_CEILING, propose, type Proposer } from './propose.ts';
import type { Verdict } from './recommend.ts';
import { worthAPass, type RubricVerdict } from './rubric.ts';

/** The report's name under `<corpusRoot>/state/`. */
const REPORT_FILE = 'review-last-pass.json';

/** Where the pass writes what it read. Gitignored with the rest of `state/`. */
export function passReportPath(stateRoot: string): string {
  return path.join(stateRoot, 'state', REPORT_FILE);
}

/**
 * What one pass looked at and concluded.
 *
 * **Everything here is a floor and the report says so in `wholeness`.** The
 * transcript records what was SAID; it does not record what was understood,
 * what was acted on, or the parts of a lane's reasoning that never reached its
 * transcript — `plan:loop seq:1`'s standing caveat, which applies unchanged.
 */
export interface PassReport {
  at: string;
  sessionId: string | null;
  /**
   * Whether this pass wrote anything. **A field, not a promise** — a reader
   * checking whether the loop has started writing to the corpus checks
   * `created` and this together rather than trusting a comment.
   *
   * `plan:loop seq:2` typed this as the literal `true` because a dry run was
   * the only mode that existed. `plan:loop seq:3` gives it a second value and
   * the type widens with the behaviour, which is the honest direction: a
   * `dryRun: true` that could not be false was a claim about the whole
   * product, and it has stopped being one.
   */
  dryRun: boolean;
  /** `wholenessLine(input)`. The first thing a reader should read. */
  wholeness: string;
  whole: boolean;
  /** Where this pass started returning points. The last report's `readTo`. */
  sinceByte: number;
  /** Where it stopped. The NEXT pass's `sinceByte`. */
  readTo: number;
  sources: string[];
  skipped: SkippedSource[];
  readBytes: number;
  records: number;
  unreadable: number;
  ms: number;
  rubric: RubricVerdict;
  byCategory: Record<string, number>;
  points: {
    category: PointCategory; who: string; source: string; recordIndex: number;
    at: string | null; text: string;
  }[];
  /**
   * The draft ids this pass wrote. **Empty on a dry run by construction**, and
   * a field rather than a sentence so that "the loop has not started writing
   * to the corpus" is something a reader checks rather than believes.
   */
  created: string[];
  /**
   * What the proposing half did with what the reading half found — every
   * candidate accounted for, in `propose.ts`'s own counters.
   *
   * Present on a dry run too, carrying what the pass WOULD have proposed.
   * That is the whole point of a dry run: the way to find out what a proposer
   * would say is to let it say it somewhere that costs nothing.
   */
  proposed: ProposeSummary | null;
  /**
   * **What happened when this pass tried to reach a model**, or `null` when
   * none was configured — `plan:loop seq:6`.
   *
   * `null` is the shipped state and it reads as "no model was called". Every
   * other value says a call was attempted and how it went, including the ways
   * it can fail without a model ever seeing anything: no CLI on this machine,
   * a non-zero exit, a timeout, a reply that did not follow the output
   * contract, and the one this build refuses on its own — a prompt that had
   * lost an anti-learning rule.
   */
  model: ModelPassRecord | null;
}

/** One pass's attempt to reach a model. Every failure is a named field, never a silence. */
export interface ModelPassRecord {
  /** The model name from config. */
  requested: string;
  /** The argv, without the prompt — the prompt goes on stdin. */
  command: string;
  /** Bytes of prompt handed to the transport. */
  promptBytes: number;
  /**
   * **The five anti-learning rules, verified present in the exact text that
   * was about to be sent.** Design §12 calls the list a scar record; a
   * pipeline that delivered four of five would be indistinguishable from one
   * that delivered five, so this is a count taken at the last moment before
   * the bytes leave the process and not a restatement of a constant.
   */
  antiLearningRulesDelivered: number;
  /** Named, when any rule was missing. The call is refused in that case. */
  antiLearningRulesMissing: string[];
  ok: boolean;
  /** Why no answer was used. `null` when one was. */
  why: string | null;
  ms: number;
  /** Candidates `parseReply` accepted. */
  returned: number;
  /** Elements of the reply that were not usable, with a reason each. */
  rejected: string[];
  /**
   * **The reply itself, kept ONLY when a model answered and no candidate came
   * out of it.** Three different events produce `returned: 0` with
   * `rejected: []` — a model that returned an empty array, a model that
   * returned prose the parser never saw as a candidate, and a model that
   * returned nothing at all — and before this field they were the same three
   * zeros. A loop whose whole purpose is to propose could not tell a
   * considered refusal from an unreadable answer, and the evidence to tell
   * them apart was discarded at the moment it existed.
   *
   * `null` when a candidate WAS produced: the answer is then visible as the
   * proposal, and keeping the text as well would put a model's prose in every
   * report for no question it answers. Truncated at
   * `EMPTY_REPLY_BYTES` with the dropped count stated, because a bound that
   * hides how much it dropped is the defect this product files against others.
   *
   * The report is gitignored (`.my_context/state/.gitignore`), so this stays
   * on the machine that wrote it.
   */
  emptyReply: string | null;
}

/**
 * How much of an unusable reply is kept. Enough to see whether the model
 * refused, rambled or answered in a shape the parser does not read — and not
 * so much that a report a person opens is mostly somebody else's prose.
 */
export const EMPTY_REPLY_BYTES = 2000;

/** One reply, bounded, saying how much it dropped rather than hiding it. */
export function boundedReply(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= EMPTY_REPLY_BYTES) return text;
  const kept = Buffer.from(text, 'utf8').subarray(0, EMPTY_REPLY_BYTES).toString('utf8');
  return `${kept}
[... ${bytes - EMPTY_REPLY_BYTES} more byte(s) not kept]`;
}

/** `ProposeResult` without the drafts' full text. The report is read by people. */
export interface ProposeSummary {
  considered: number;
  screened: number;
  empty: number;
  suppressed: number;
  declined: number;
  irrelevant: number;
  rationed: number;
  /**
   * The QUEUE was full, and how full — §10. `null` when the ceiling did not
   * bite. Kept apart from `rationed` for `ProposeResult.held`'s reason: one
   * says the next pass will carry on, the other says no pass will until a
   * person works the queue down.
   */
  held: { pending: number; ceiling: number } | null;
  unauthored: Record<string, number>;
  /** id (or `null` on a dry run), tier, target, title, and whether anything confirms it. */
  drafts: DraftLine[];
  /**
   * **What the pass WOULD have proposed and did not, because of the ration or
   * the ceiling** — `plan:loop seq:6`.
   *
   * `maxProposalsPerPass` ships at 0, so until the owner raises it `drafts` is
   * always empty and `rationed` was the only trace a proposer left. That made
   * a proposer that worked and a proposer that found nothing look identical in
   * this file, which is the one thing a report whose entire job is to be read
   * for a week must not do.
   *
   * **These were not written.** `created` is still the field that answers
   * whether the loop has started writing to the corpus, and it is still empty.
   */
  withheld: DraftLine[];
  /** The model path's own accounting, or `null` when no model ran. */
  model: {
    returned: number; screened: number; irrelevant: number; suppressed: number;
    declined: number; empty: number; unauthored: number; ranked: number;
  } | null;
}

/** One proposal as the report names it. `by` is the provenance axis — see `Proposer`. */
export interface DraftLine {
  id: string | null;
  by: Proposer;
  artifact: string;
  category: string;
  target: string | null;
  title: string;
  confirmed: boolean;
  /**
   * **What the pass recommended doing with it, so the SPREAD is measurable
   * from the report alone** — `TASK-the-review-queue-explains-a-proposal-at-length-and-never`
   * makes that measurement binding: *"if the recommendation is the same value
   * on nearly all of them, it carries no information and the item is not
   * closed."* A verdict visible only on a screen could only be counted by
   * opening every row, which is how a degenerate distribution goes unnoticed.
   */
  recommendation: Verdict;
}

/**
 * The last report, or `null`.
 *
 * Read by TYPE and not trusted, `readCounter`'s posture for its reason: the
 * one field this build acts on is `readTo`, and a `readTo` that arrived as a
 * string would silently become `NaN` in an arithmetic comparison and turn
 * every pass into a whole-file send.
 */
export function readPassReport(stateRoot: string): PassReport | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(passReportPath(stateRoot), 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as PassReport;
  } catch {
    return null;
  }
}

/** The offset the last pass stopped at, or 0 for a workspace with no report. */
export function lastReadTo(stateRoot: string): number {
  const previous = readPassReport(stateRoot);
  const value = previous?.readTo;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Write the report atomically. `writeCounter`'s shape, for `writeCounter`'s
 * reason — a torn report is worse than no report, because the half that
 * survives is a `readTo` the next pass would obey.
 */
function writeReport(stateRoot: string, report: PassReport): boolean {
  const target = passReportPath(stateRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
    return true;
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
    return false;
  }
}

/** One `Proposal`, minus its body, as the report names it. */
function draftLine(p: {
  id: string | null; by: Proposer; artifact: string; category: string;
  target: string | null; title: string; confirmed: boolean;
  recommendation: { verdict: Verdict };
}): DraftLine {
  return {
    id: p.id, by: p.by, artifact: p.artifact, category: p.category,
    target: p.target, title: p.title, confirmed: p.confirmed,
    recommendation: p.recommendation.verdict,
  };
}

/** How many points of each category the pass found. Zeros are drawn, not omitted. */
function tally(input: PassInput): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of POINT_CATEGORIES) counts[category] = 0;
  for (const point of input.points) {
    counts[point.category] = (counts[point.category] ?? 0) + 1;
  }
  return counts;
}

export interface PassOptions {
  /** The corpus root — `findProjectRoot`'s answer, the `.my_context` directory. */
  workspace: string;
  transcript: string;
  sessionId: string | null;
  subagentDir: string | null;
  includeSubagents: boolean;
  /**
   * Read and report, and write NOTHING — no draft, no sighting ledger entry.
   *
   * No longer typed as the literal `true`: `plan:loop seq:3` gives the pass a
   * second mode, and a type that forbade the second mode would be a claim the
   * product no longer makes.
   */
  dryRun: boolean;
  /**
   * §11's `maxProposalsPerPass`. **The ration bounds VOLUME, never the
   * rubric** — a pass that found ten things worth proposing still found ten;
   * this decides how many reach a person in one go.
   *
   * `0` writes nothing, and it is a legal value rather than a disabled one, in
   * exactly the way `maxFiresPerSession: 0` is (`core/config.ts`): it is the
   * ration set to nothing, not a second kill switch. The switch is
   * `review.enabled`, and there is one of it.
   */
  maxProposals: number;
  /**
   * §10's `queueCeiling` — how much may already be waiting before this pass
   * writes nothing. Read from the config by the PARENT and passed down, for
   * `maxProposals`' own reason: a second reader is a second answer.
   */
  queueCeiling: number;
  /**
   * **§11's `model`, and the key that decides whether a model is called at
   * all** — `plan:loop seq:6`.
   *
   * `null` — the shipped default, and what every workspace has until somebody
   * writes the key — means NO model is reached, by any path, and `pass.model`
   * in the report is `null` rather than a zero. Set, it is the name handed to
   * the CLI.
   *
   * **It is not a second kill switch and it is not the ration.** `enabled`
   * decides whether a pass runs (§11: one switch, one subsystem);
   * `maxProposalsPerPass` decides whether anything is written; this decides
   * whether the pass composes with a model or only selects lexically. The
   * three are orthogonal on purpose, and the combination the owner's config
   * has today — enabled, ration 0, model set — is the one this task was built
   * to make provable: the model runs, the report says what it would have
   * proposed, and nothing is written.
   */
  model: string | null;
  /**
   * How the model is reached. Injected so the pass is testable on a machine
   * with no CLI and no network; production passes none and gets `callAgentCli`.
   */
  modelCall?: ModelCall;
  modelTimeoutMs?: number;
  budgetBytes?: number;
  capBytes?: number;
}

/**
 * Read, decide, report. **Creates nothing.**
 *
 * The rubric is applied HERE as well as in the hook, and the duplication is
 * deliberate rather than sloppy: the hook's rubric decides whether to spend a
 * fire on a stretch it can see cheaply, and this one records what the whole
 * read actually found. When the two disagree — the hook fired and the pass
 * found nothing worth firing on — that disagreement is in the report, and it
 * is the signal that the trigger is mistuned. A pass that reused the hook's
 * verdict could never show it.
 */
export async function runPass(options: PassOptions): Promise<PassReport> {
  const sinceByte = lastReadTo(options.workspace);
  const input = gather({
    transcript: options.transcript,
    sinceByte,
    includeSubagents: options.includeSubagents,
    subagentDir: options.subagentDir,
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
    ...(options.capBytes === undefined ? {} : { capBytes: options.capBytes }),
  });

  const report: PassReport = {
    at: new Date().toISOString(),
    sessionId: options.sessionId,
    dryRun: options.dryRun,
    wholeness: wholenessLine(input),
    whole: input.whole,
    sinceByte,
    readTo: input.readTo,
    sources: input.sources,
    skipped: input.skipped,
    readBytes: input.readBytes,
    records: input.records,
    unreadable: input.unreadable,
    ms: input.ms,
    rubric: worthAPass(input.points.map((p) => ({ category: p.category, who: p.who }))),
    byCategory: tally(input),
    points: input.points,
    created: [],
    proposed: null,
    model: null,
  };

  // ── REACHING A MODEL ─────────────────────────────────────────────────────
  //
  // **This is the half `plan:loop seq:3` left unbuilt and said so**:
  // `propose.ts` opens with *"Nothing in this product calls a model, and this
  // module does not either"*, and `prompt.ts` — the file the design calls the
  // most important in the change — was imported by its own test and by nothing
  // else. `review/model.ts` carries the argument for the mechanism.
  //
  // It runs BEFORE the proposing block and its result is folded in, rather
  // than living inside `propose`, for the reason the report is built before
  // anything can be written: a model call that fails must still leave a report
  // saying it was attempted and why it failed. `propose` stays synchronous in
  // spirit and testable without a transport.
  const modelCandidates: ModelCandidate[] = [];
  if (options.model !== null) {
    const prompt = reviewPrompt(input);
    const missing = rulesMissing(prompt);
    const call = options.modelCall ?? callAgentCli;
    const record: ModelPassRecord = {
      requested: options.model,
      command: '',
      promptBytes: Buffer.byteLength(prompt, 'utf8'),
      antiLearningRulesDelivered: 5 - missing.length,
      antiLearningRulesMissing: missing,
      ok: false,
      why: null,
      ms: 0,
      returned: 0,
      rejected: [],
      emptyReply: null,
    };
    if (!isUsableModelName(options.model)) {
      record.why = `"${options.model}" is not a usable model name, so no call was made`;
    } else {
      // `callAgentCli` refuses a prompt with a rule missing, and refuses it
      // again rather than trusting this caller to have checked. Two checks,
      // one for the report and one at the boundary the bytes actually cross.
      try {
        const outcome = await call(prompt, {
          model: options.model,
          cwd: path.dirname(options.workspace),
          timeoutMs: options.modelTimeoutMs ?? MODEL_TIMEOUT_MS,
        });
        record.command = outcome.command;
        record.ms = outcome.ms;
        if (!outcome.ok) {
          record.why = outcome.why;
        } else {
          const parsed = parseReply(outcome.text);
          record.rejected = parsed.rejected;
          if (parsed.unparseable !== null) {
            record.why = parsed.unparseable;
          } else {
            record.ok = true;
            record.returned = parsed.candidates.length;
            modelCandidates.push(...parsed.candidates);
          }
          // **Kept on BOTH zero paths, and only on them.** An unparseable
          // reply and a clean empty array are different answers to the same
          // question a reader asks of a pass that proposed nothing, and
          // `why` distinguishes them only when the parser had a complaint.
          if (record.returned === 0) record.emptyReply = boundedReply(outcome.text);
        }
      } catch (err) {
        // A transport that throws is still a transport that answered nothing,
        // and the report is the only thing anybody will read. `ok` stays false
        // and `why` names it, which is the difference between "the model found
        // nothing" and "nothing reached a model".
        record.why = `the model transport threw: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    report.model = record;
  }

  // ── THE PROPOSING HALF ────────────────────────────────────────────────────
  //
  // **Everything above this line is `plan:loop seq:2` and is unchanged.** The
  // report is built first and in full, so a proposing step that throws still
  // leaves a report saying what was read — a pass that lost its coverage
  // record because the half that writes items failed would be the worst of
  // both.
  //
  // `maxProposals: 0` skips the store open entirely rather than opening one
  // and proposing nothing: the open is a rebuild of the whole corpus
  // (`openRebuiltStore` says why it is unconditional), and paying for it to
  // produce an empty list on every `Stop` is exactly the kind of cost that
  // gets a subsystem turned off.
  //
  // ── AND WHY THE RATION NO LONGER DECIDES WHETHER THIS BLOCK RUNS ─────────
  //
  // `plan:loop seq:3` skipped it entirely at `maxProposals: 0`, and the reason
  // was cost: the store open is a full rebuild, and paying for it on every
  // `Stop` to produce an empty list is how a subsystem gets turned off. That
  // reason is intact and the skip is intact — for a pass with no model.
  //
  // **A pass that called a model has already paid the expensive thing.** It
  // holds candidates that cost real tokens to produce, and throwing them away
  // unexamined because the ration is 0 would make the model path unobservable
  // at precisely the setting it ships on. So: the block runs when there is a
  // ration to spend OR when a model returned something, and the report then
  // carries `proposed.withheld` — what it would have proposed — while
  // `created` stays empty because the ration is what stops the write.
  if (options.maxProposals > 0 || modelCandidates.length > 0) {
    try {
      // `workspace` is the `.my_context` directory; `resolveWorkspace` takes
      // the project cwd, which is its parent. Resolved rather than assumed so
      // the config the pass writes under is the same one every other surface
      // reads — category tiers, `scopePolicy` and the contradiction gate all
      // come off it.
      const ws = resolveWorkspace(path.dirname(options.workspace));
      const opened = openRebuiltStore(ws);
      try {
        const outcome = await propose(input, {
          workspace: options.workspace,
          ctx: { root: options.workspace, store: opened.store, config: ws.config },
          sessionId: options.sessionId,
          max: options.maxProposals,
          queueCeiling: options.queueCeiling,
          dryRun: options.dryRun,
          modelCandidates,
        });
        report.created = outcome.created;
        report.proposed = {
          considered: outcome.considered,
          screened: outcome.screened,
          empty: outcome.empty,
          suppressed: outcome.suppressed,
          declined: outcome.declined,
          irrelevant: outcome.irrelevant,
          rationed: outcome.rationed,
          held: outcome.held,
          unauthored: { ...outcome.unauthored },
          drafts: outcome.proposals.map(draftLine),
          withheld: outcome.withheld.map(draftLine),
          model: outcome.model === null ? null : { ...outcome.model },
        };
      } finally {
        opened.store.close();
      }
    } catch {
      // A detached child has nobody to tell, and the report is the only thing
      // anybody will read. `proposed` stays `null`, which is distinguishable
      // from `proposed` with zero drafts — absent is not zero.
    }
  }

  writeReport(options.workspace, report);
  return report;
}

/** What the hook did about the pass, so the audit row can carry it. */
export interface SpawnOutcome {
  spawned: boolean;
  /** Present when the spawn failed, and it says why. */
  why?: string;
}

/**
 * Start the pass in a detached child and return IMMEDIATELY.
 *
 * `spawnFn` is injected so the kill switch and the failure path are testable
 * on one machine; production passes none. **The kill switch is not checked
 * here** — it is checked by the one caller, before this function is reached,
 * because §11's rule is one switch for one subsystem and a second check in a
 * second place is how a switch that does not kill gets written.
 */
export function spawnPass(options: PassOptions, spawnFn: typeof spawn = spawn): SpawnOutcome {
  const args = [
    '--disable-warning=ExperimentalWarning',
    path.resolve(import.meta.dirname, 'pass.ts'),
    '--workspace', options.workspace,
    '--transcript', options.transcript,
    ...(options.sessionId === null ? [] : ['--session', options.sessionId]),
    ...(options.subagentDir === null ? [] : ['--subagents', options.subagentDir]),
    ...(options.includeSubagents ? [] : ['--no-subagents']),
    // The ration crosses the process boundary as a number rather than as a
    // flag, so a child started with no `--max` proposes NOTHING. That is the
    // safe direction for the one argument that decides whether a detached
    // process writes to the corpus: a lost argument must cost a proposal, not
    // produce one nobody asked for.
    '--max', String(Math.max(0, options.maxProposals)),
    // The ceiling crosses the boundary the same way and for the same reason,
    // but it defaults in the OPPOSITE direction: a child started without one
    // proposes into an unbounded queue, so the absent value has to be the
    // permissive one for `--max` to still be the argument that decides whether
    // anything is written. A lost `--ceiling` costs a ration; a lost `--max`
    // costs nothing at all, which is the safe pair.
    '--ceiling', String(Math.max(0, options.queueCeiling)),
    // The model name crosses the boundary in `--max`'s safe direction, not
    // `--ceiling`'s: a child started without one calls NO model. The absent
    // value has to be the one that spends nothing and reaches nothing, and a
    // name that is not usable is not passed at all rather than passed and
    // rejected downstream — an argv value beginning with "-" is an option to
    // the program being spawned, which is `src/ui/open.ts`'s lesson.
    ...(options.model === null || !isUsableModelName(options.model)
      ? []
      : ['--model', options.model]),
    ...(options.dryRun ? ['--dry-run'] : []),
  ];
  try {
    const child: ChildProcess = spawnFn(process.execPath, args, {
      detached: true, stdio: 'ignore',
    });
    // BEFORE unref and before anything can return — see the header. Without
    // this listener a machine on which the spawn fails takes down the hook.
    child.on('error', () => { /* the pid check below is the answer */ });
    child.unref();
    if (child.pid === undefined) {
      return { spawned: false, why: 'the child could not be started on this system' };
    }
    return { spawned: true };
  } catch (err) {
    return { spawned: false, why: err instanceof Error ? err.message : String(err) };
  }
}

/** The child's own argument reader. Positional-free, so an absent flag is absent. */
function flag(argv: string[], name: string): string | null {
  const at = argv.indexOf(name);
  if (at === -1 || at + 1 >= argv.length) return null;
  const value = argv[at + 1];
  return value === undefined || value.startsWith('--') ? null : value;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const argv = process.argv.slice(2);
  const workspace = flag(argv, '--workspace');
  const transcript = flag(argv, '--transcript');
  if (workspace !== null && transcript !== null) {
    void runPass({
      workspace,
      transcript,
      sessionId: flag(argv, '--session'),
      subagentDir: flag(argv, '--subagents'),
      includeSubagents: !argv.includes('--no-subagents'),
      // Absent, unparseable or negative all mean 0 — see `spawnPass`. The
      // child never infers a ration from the config: the parent read the
      // config, and a second reader is a second answer.
      maxProposals: Math.max(0, Number(flag(argv, '--max') ?? 0) || 0),
      // Absent or unparseable means NO ceiling — see `spawnPass`. `--max` is
      // the flag whose absence must cost a write; this one's absence must not
      // cost a report.
      queueCeiling: Math.max(0, Number(flag(argv, '--ceiling') ?? 0) || NO_QUEUE_CEILING),
      // Absent means NO model, which is `--max`'s direction and for `--max`'s
      // reason: the argument that decides whether a detached process spends
      // tokens must cost nothing when it is lost.
      model: flag(argv, '--model'),
      dryRun: argv.includes('--dry-run'),
    }).catch(() => { /* a detached child has nobody to tell */ });
  }
}
