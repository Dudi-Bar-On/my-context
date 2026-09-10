import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  acknowledgementState, clearAcknowledgement, stampAcknowledgement,
} from './acknowledge.ts';
import { type MutationOp } from './audit.ts';
import { agentEditsFor, type Config, type ResolvedCategory } from './config.ts';
import { contentHash, itemContentHash, itemSummaryBasis, stampSummary } from './content-hash.ts';
import { parseItem } from './item.ts';
import { appendJsonlLine, readJsonlFile, type JsonlLogSpec } from './jsonl-log.ts';
// The contradiction gate's PURE half. It knows no workspace and touches no
// file — see `core/overlap.ts`' module comment for why the split is not
// stylistic: `ui/read-model-work.ts` imports that module for `overlapScore`,
// and `test/ui/no-writes.test.ts` walks its graph for fs writers.
import {
  contradictionGate, contradictionRefusal, inContradictionScope, latestVerdicts,
  unknownDispositionRefusal, CONTRADICTION_PROTOCOL,
  type ContradictionCandidate, type ContradictionDisposition, type ContradictionDraft,
  type ContradictionItem, type ContradictionSurface,
} from './overlap.ts';
// The verdict log's READ half, lifted to a module that never writes so that
// `doctor/checks.ts` — which the UI server's graph reaches — can read the same
// log this file appends to. `plan:contra seq:3` requires the drain and the gate
// to honour one set of rulings; one reader is how they cannot disagree.
import {
  contradictionBasis, contradictionLogPath, readVerdicts, verdictsDir,
} from './verdict-store.ts';
// `plan:contra seq:2` §8: the one moment somebody knows which tests rest on an
// item is the moment it is retired. It READS and never writes — see that
// module's header, and see `restingTestsSaid` for why it can never gate.
import { restingTestsSaid, testsRestingOn } from './tests-resting-on.ts';
import { draftFilePath, ensureDraftDir } from './drafts.ts';
import { normalizePosix } from './paths.ts';
import {
  auditMutation, normalizeSource, persist, projectItem, projectItems, requireWritableItem,
  snapshotFields, movedFields, stampValidUntil, today,
} from './persist.ts';
import { isItemExistsError } from './rebuild.ts';
import { standDownFields, STOOD_DOWN_STATUSES } from './select.ts';
import { existingSuccessorRefusal, SUPERSEDED_BY } from './relations.ts';
// `revision.ts` imports `updateItem` back out of this module, so this edge
// closes a cycle. It resolves under ESM because both sides only ever CALL
// each other's hoisted `function` declarations, never read a binding while
// the other module is still evaluating. Nothing here may become a top-level
// `const` initialised from a `revision.ts` export, and nothing there may
// read one of ours — verified against the CLI, the MCP server and the hooks
// entry points, not only under `node --test`.
import { stageRevision, type RevisionChanges } from './revision.ts';
import { makeId } from './slug.ts';
import { afterContent, basisMoves, summaryReaffirmed } from './summary-gate.ts';
import {
  reaffirmSummary, reviseSummary,
  SUMMARY_OMITTED_NOTE, SUMMARY_REAFFIRMED_NOTE, SUMMARY_UNCHANGED_NOTE,
} from './summary-history.ts';
import type { Store } from './store.ts';
import { projectFieldUpdate, projectOntoTags } from './tag-projection.ts';
import { enumError, missingFieldError } from './teach.ts';
import { normalizeEol } from './text.ts';
import {
  contentChange, governsNormatively, guardedChange, inertFieldError, inertFieldNote,
  nonContentChanges, openContentPhrase, scopeRequirementError, stagedContentCaveat,
  fieldList, tierOf, trustedStatus, unknownExtraFieldError, GOVERNING_STATUS, GUARDED_FIELDS,
} from './trust.ts';
import type { Item, Observation, Origin, Relation, Severity, Status } from './types.ts';
import {
  normalizeObservations, normalizeSteps, normalizeSummary, validateBody, validateEnums,
  validateExplicitId, validateExtra, validateObservationText, validateRelations,
  validateRelationTarget, validateScope, validateSummary, validateTags, validateTitle,
  validateValidFrom,
} from './validate.ts';

export interface MutationContext {
  /** Absolute path to the project layer root, i.e. `<repo>/.my_context`. */
  root: string;
  store: Store;
  config: Config;
  /**
   * **How a mutation asks a person before it retires something, when there is
   * a person to ask.**
   *
   * Retirement is the one irreversible lifecycle move, and until this existed
   * the confirmation for it lived in ONE command — `mycontext supersede` — and
   * therefore covered exactly one of the three routes into `supersedeItem`.
   * The gate's `--supersedes <id>` disposition (`preflightSupersede`) reaches
   * the same write from `add` and from `edit`, and asked nothing at all.
   *
   * **A hook rather than a call, because `core/` must not import `cli/`.**
   * `confirmAction` (cli/commands/review.ts) reads `--yes`, refuses off a TTY
   * and prints its own refusal; it is a surface concern and stays one. A
   * surface that can ask a person supplies this and the mutation asks through
   * it; a surface that cannot — the MCP tools, ingestion, `applyCandidates` —
   * leaves it undefined, and the ORIGIN guards (`governsNormatively`, in both
   * `preflightSupersede` and `supersedeItem`) remain what protects a governing
   * item from a non-human caller. A missing hook is therefore never a silent
   * "yes" on the path that matters.
   *
   * `mycontext supersede` deliberately does NOT set it: that command already
   * asks the identical question (`supersedeQuestion`, imported rather than
   * re-spelled) beside a preview this depth cannot render, and setting it here
   * would ask a person the same thing twice in one command.
   *
   * Returns `true` to proceed. `false` means the person declined, and the
   * caller of the hook turns that into a refusal — never into a quiet skip of
   * the retirement while the rest of the write lands.
   */
  confirm?: (question: string) => boolean;
}

export interface CreateInput {
  type: string;
  title: string;
  body?: string;
  /**
   * Explicit id. Defaults to an auto-allocated id derived from `title`.
   * Plan 4 requires this: a superseded item and its replacement share a title,
   * so the replacement needs an explicit revision id (`-r2`) to avoid colliding
   * with the item it replaces. `createItem` never overwrites an existing item
   * at this id — see the explicit-id handling below.
   */
  id?: string;
  /**
   * Checksum of the source passage at capture time. Plan 4's `doctor` compares
   * it against the live source to detect drift; hardcoding null here would make
   * drift undetectable for every ingested item.
   */
  sourceChecksum?: string | null;
  status?: Status;
  severity?: Severity;
  always?: boolean;
  /**
   * Continuity-tier membership, mirroring `always` — see `Item.continuity`.
   * Defaults to false, so nothing captured without it joins the tier.
   *
   * **Unlike `always`, it is NOT refused on the rationale tier.** `always`
   * asks for the PINNED tier, which selection admits only normative items to,
   * so `always: true` on a `lesson` is a stored value that can never act —
   * hence `inertFieldError`. The continuity tier is not a governance tier and
   * does not consult `isNormative` at all (`select.ts`), by the same ruling
   * that refused to make continuity a category: it answers "what does the next
   * session need in order not to start over", which is orthogonal to what
   * governs. The item this tier exists for is a `reference`, and a refusal
   * here would have shipped a tier that could never deliver it.
   */
  continuity?: boolean;
  /**
   * **One plain sentence, readable by somebody who does not know this
   * codebase** — plain words rather than project vocabulary, no ids, no file
   * paths, no measurements, saying what the item IS and why it matters rather
   * than how it was found. See `Item.summary` for the worked example and
   * `SUMMARY_MAX_CHARS` (validate.ts) for the bar and the bound.
   *
   * Omitted, empty, or whitespace-only all mean the same thing and all store
   * `null`. Nothing here generates one — the owner's constraint is no external
   * API, and a CLI write cannot call a model, so a summary arrives only
   * because a person or an agent wrote one through the ordinary capture path.
   *
   * **Absent is legal HERE and refused at the authored surfaces.** This field
   * stays optional on `CreateInput` because `createItem` is the shared road
   * every mechanical caller drives down — ingest, pack import, `mycontext
   * lesson`, `inbox-promote`, `lesson-accept` — and none of those is a person
   * holding new prose. `mycontext add` and the MCP `create_item` tool are the
   * two surfaces where somebody IS, and both refuse a capture that carries
   * neither a summary nor `summaryOmitted` (`summaryRequiredAtCreate` /
   * `summaryAtCreateRefusal`, summary-gate.ts). The asymmetry is the same one
   * `summaryUnchanged` has at `updateItem`, for the same reason.
   *
   * The basis it is written against is NOT an input at any surface:
   * `stampSummary` (content-hash.ts) computes it from the item this call
   * actually builds, so a caller cannot claim a summary describes content it
   * does not.
   */
  summary?: string;
  /**
   * **The creation opt-out: this item is being captured with no summary, and
   * that is deliberate.**
   *
   * The sibling of `UpdateInput.summaryUnchanged`, at the other end of an
   * item's life and with the same three properties. It is spelled in words
   * (`--summary-omitted`, `summary_omitted: true`), it is never a default, and
   * it is RECORDED — `createItem` writes `SUMMARY_OMITTED_NOTE` into the audit
   * row, so "nobody wrote a summary for this item" is a fact a reader of the
   * log can find rather than an absence they have to infer.
   *
   * It exists because the gate has to be answerable. `mycontext lesson` mints a
   * title-only stub; a pack brings items somebody else summarised or did not;
   * an item captured as a pointer to a document may genuinely have nothing to
   * say in one sentence that its title does not already say. Refusing those
   * outright would make the gate a wall rather than a question, and a wall gets
   * routed around. What the opt-out must never be is cheap to reach by
   * accident, which is why there is no short spelling and no default.
   *
   * **It is an instruction about a write, not a field of an item**, exactly as
   * `summaryUnchanged` is: nothing on disk corresponds to it, `contentHash`
   * does not read it, and it is absent from `ContentShape`. Refused beside a
   * `summary` at both authored surfaces (`summaryOmittedRefusal`) — a capture
   * cannot assert that a sentence was written and that none was.
   */
  summaryOmitted?: boolean;
  /**
   * **The contradiction gate's two answers** (contradiction-gate design §5,
   * §6), and they are answers rather than options: the gate raises the items
   * this capture may contradict, refuses the write, and accepts nothing else.
   *
   *  - `distinct` — "both can be true; they are about different things",
   *    repeatable because a write can raise up to `OVERLAP_CAP` candidates and
   *    every one of them has to be settled before anything is written.
   *  - `supersedes` — "this replaces it, and it is retired". It routes into
   *    `supersedeItem` after the capture lands, so the new item is created and
   *    the old one retired with the link recorded, and nothing retires without
   *    a successor.
   *
   * Abandoning the write is the third outcome and needs no field: nothing was
   * written, which is already the state.
   *
   * **Both are instructions about a write, not fields of an item.** Nothing on
   * disk corresponds to either, `contentHash` does not read them, and they are
   * absent from `ContentShape` — the same shape `summaryOmitted` has. What they
   * leave behind is a row in `.my_context/.verdicts/contradiction.jsonl`, keyed
   * to the pair and to what both items say today.
   */
  distinct?: string[];
  supersedes?: string;
  scope?: string[];
  tags?: string[];
  origin?: Origin;
  sourceFile?: string | null;
  sourceAnchor?: string | null;
  /**
   * The day this item started holding, as `YYYY-MM-DD`. Defaults to `today()`,
   * which is what every capture got and the only thing any surface could
   * produce until this field existed.
   *
   * **It exists for the one job the clock cannot do: re-creating an item that
   * already exists.** An item carried in from another corpus, or rebuilt from
   * a document that predates this workspace, has its own start date; stamping
   * it with the day of the import makes the corpus claim a history it does not
   * have, and `valid_from` is a reserved frontmatter name, so `extra` could not
   * carry it either (`RESERVED_FRONTMATTER_KEYS`, validate.ts — correctly, an
   * `extra` field of that name would overwrite the real one unvalidated).
   *
   * Not on `UpdateInput`, and that is the same boundary `steps` and
   * `observations` have: moving an existing item's start date is rewriting when
   * it began to govern, which is a claim about the past rather than a
   * correction to content. It is settable at CREATION, where it is a fact about
   * the item being copied, and nowhere else.
   *
   * `validUntil` has no sibling here: it is stamped by `stampValidUntil`
   * (persist.ts) at the lifecycle change that ends the item, so a caller that
   * could set it at creation would be minting an item that had already expired.
   */
  validFrom?: string;
  observations?: Observation[];
  /**
   * A `procedure`'s ordered steps, as TEXT — never `Step[]`.
   *
   * A caller cannot set `checked`, so "nothing in this product ever writes
   * `checked: true`" holds by construction at this boundary rather than by
   * convention (`normalizeSteps`, validate.ts, sets it to `false` for every
   * entry). A box is ticked only by a human editing the Markdown.
   *
   * **Create-only, and deliberately absent from `UpdateInput`** (spec §6m.3):
   * that absence is what keeps `UPDATE_FIELD_POLICY` (trust.ts) and its four
   * `Assert<>` types compiling untouched, and it is the same shape
   * `observations` already has. Correcting a step means editing the file and
   * running `mycontext repair`; there is no command that edits or ticks one,
   * because progress lives in the audit log and never in the item.
   *
   * Accepted on EVERY category, `runbook` included. §6o says a runbook has no
   * `## Steps` field and this plan makes that documentary rather than
   * enforced: there is no category-conditional field rule anywhere in the
   * product to follow (`observations`, `scope` and `tags` are accepted on
   * every category) and adding the first one is a larger decision than §6o
   * took. What is category-specific is where the OFFER is made — `--step`'s
   * help and the `create_item` schema both name `procedure` and say what a
   * runbook does instead.
   */
  steps?: string[];
  relations?: Relation[];
  extra?: Record<string, string>;
}

export interface MutationResult {
  id: string;
  /** False when the call was a no-op: a duplicate, or an already-present link. */
  created: boolean;
  status: Status;
  filePath: string;
  message: string;
  /**
   * Present ONLY when the write was staged instead of applied — a non-human
   * caller's content edit under `agentEdits: "review"` (spec §4). The item is
   * unchanged on disk and in the index; `created` is `false` and `status` is
   * the status the item still has. Absent means the write was applied, so a
   * caller that ignores this field never mistakes an applied write for a
   * staged one, only the reverse — which is why `message` says it too.
   */
  staged?: {
    revisionId: string;
    /** True when this exact proposal was already pending; no new revision. */
    duplicate: boolean;
    /** How many OTHER proposals were already queued on this item. */
    alsoPending: number;
  };
}

/**
 * `ctx.config.categories[type]` would be a prototype-unsafe lookup — a type
 * of `"constructor"` resolves to `Object.prototype.constructor` and reports
 * a nonsensical "is disabled" instead of "unknown". `Object.hasOwn` guards it.
 */
function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {
  if (!Object.hasOwn(ctx.config.categories, type)) {
    // Only enabled categories are offered: naming a disabled one as the
    // "closest match" would invite a retry that create_item refuses too.
    const enabledNames = Object.values(ctx.config.categories)
      .filter((c) => c.enabled)
      .map((c) => c.name);
    throw new Error(enumError('type', type, enabledNames, 'categories'));
  }
  const category = ctx.config.categories[type];
  if (!category.enabled) {
    throw new Error(
      `my_context: category "${type}" is disabled in this project, so no new ` +
      `${type} items are accepted. Enable it in .my_context/config.json under ` +
      `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`,
    );
  }
  return category;
}

const MAX_FAMILY = 1000;

/**
 * Finds either a content duplicate among `base`, `base-2`, `base-3`, … (the
 * exact sequence `createItem` allocates into), or the next free id in that
 * sequence. Checking the whole family — not just `base` — matters: without
 * it, a third identical call to a title that has already collided once
 * would find `base` already an (unrelated) `base-2` sibling occupies and
 * think there is no duplicate, minting a third item for the same content.
 */
function familyId(base: string, n: number): string {
  return n === 1 ? base : `${base}-${n}`;
}

function familyExhausted(title: string): Error {
  return new Error(
    `my_context: cannot allocate an id for "${title}" — ${MAX_FAMILY} variants already exist. ` +
    `Use a more specific title.`,
  );
}

function locateInFamily(
  ctx: MutationContext, prefix: string, title: string, hash: string,
): { duplicate: Item | null; base: string; nextN: number } {
  const base = makeId(prefix, title);
  for (let n = 1; n <= MAX_FAMILY; n++) {
    const item = projectItem(ctx, familyId(base, n));
    if (!item) return { duplicate: null, base, nextN: n };
    if (itemContentHash(item) === hash) return { duplicate: item, base, nextN: n };
  }
  throw familyExhausted(title);
}

/**
 * The item ACTUALLY on disk at the path `item` would occupy — read from the
 * file, never from `ctx.store`. This is the whole point of the `EEXIST`
 * retry in `createItem`: the store snapshot is stale by construction (that
 * IS the bug being fixed), so consulting it again after losing the race
 * would just re-derive the same wrong answer.
 *
 * A file that exists but cannot be parsed is reported, not guessed at.
 * Under the `linkSync` construction (`createExclusive`, rebuild.ts) a target
 * that exists always holds complete content; under its no-hard-links
 * fallback there is a brief window where it is empty, and this is what that
 * window surfaces as — a visible error rather than a silent wrong answer.
 */
function itemAtPath(ctx: MutationContext, filePath: string): Item {
  const abs = path.join(ctx.root, ...filePath.split('/'));
  try {
    return parseItem(readFileSync(abs, 'utf8'), filePath, 'project');
  } catch (err) {
    throw new Error(
      `my_context: another process created ${filePath} at the same moment, but that file could ` +
      `not be read back to compare it with this content (${err instanceof Error ? err.message : String(err)}). ` +
      `Nothing was written. Check the file, then retry.`,
    );
  }
}

// --- The contradiction gate (spec 2026-09-07, §2 §4 §5 §7) ------------------
//
// **Here, and not in the CLI, because these two functions are the only write
// paths for item content.** `mycontext add`/`edit`, the MCP `create_item`/
// `update_item` tools, `inbox-promote`, `lesson`, `lesson-accept`,
// `ingest-apply`, a promoted revision and pack import all drive down this road.
// A gate one layer out would be a gate with seven doors beside it, and
// `test/core/contradiction-gate.test.ts` walks the runtime import graph of
// every one of those entry points to prove none of them reaches `persist`
// without passing through here.
//
// **It is DELIBERATELY not shaped like `summary-gate.ts`, and the difference is
// worth stating once.** That module exports predicates and refusals and is
// called from the four AUTHORED surfaces alone, on the stated grounds that a
// gate inside `createItem` would refuse mechanical callers who have no person
// at the keyboard. This gate makes the opposite trade, on the owner's ruling
// (§2, §10): a mechanical caller that would file a second live rule against a
// standing one is exactly the case the gate exists for, so it "must either
// carry dispositions decided earlier or fail cleanly naming what to settle",
// and a bypass "would defeat §2 entirely". The two gates therefore sit at
// different depths on purpose, and neither position is a mistake about the
// other.

/** One ruling, appended. Ids are stored in lexicographic order — see `pairKey`. */
function appendVerdict(
  root: string,
  one: { id: string; basis: string },
  other: { id: string; basis: string },
  verdict: ContradictionDisposition,
  ruledBy: Origin,
  carried?: { ruledAt: string },
): void {
  const [a, b] = one.id < other.id ? [one, other] : [other, one];
  appendJsonlLine(verdictsDir(root), contradictionLogPath(root), {
    protocol: CONTRADICTION_PROTOCOL,
    a: a.id, b: b.id, verdict, aBasis: a.basis, bBasis: b.basis,
    ruledAt: carried?.ruledAt ?? new Date().toISOString(),
    ruledBy,
    ...(carried === undefined ? {} : { carried: true }),
  });
}

/** Every project item as the gate sees it — a narrow view, never whole `Item`s. */
function contradictionCandidates(ctx: MutationContext): ContradictionItem[] {
  return projectItems(ctx).map((i) => ({
    id: i.id, type: i.type, title: i.title, body: i.body, summary: i.summary,
    severity: i.severity, always: i.always, status: i.status, basis: contradictionBasis(i),
  }));
}

/**
 * Run the gate and THROW its refusal, or return what this call settled.
 *
 * Every candidate the call dispositioned comes back, because a verdict has to
 * be recorded for each of them after the write lands and asking the gate a
 * second time afterwards would let the two answers disagree — the item on disk
 * would then carry a ruling the refusal never raised, or miss one it did.
 */
function contradictionCheck(
  ctx: MutationContext,
  draft: ContradictionDraft,
  surface: ContradictionSurface,
): readonly ContradictionCandidate[] {
  const outcome = contradictionGate(draft, contradictionCandidates(ctx), readVerdicts(ctx.root));
  // Before the refusal, deliberately: a caller that typo'd an id would
  // otherwise read the refusal, see its own disposition ignored, and have no
  // way to tell that from the gate having lost it.
  const stray = unknownDispositionRefusal(draft, outcome.stray, surface);
  if (stray !== null) throw new Error(stray);
  if (!outcome.allowed) throw new Error(contradictionRefusal(draft, outcome.candidates, surface));
  return outcome.candidates;
}

/**
 * The other half of §7: record what was just settled, once the write has
 * actually landed.
 *
 * After rather than before, and the ordering is the guarantee: a refusal
 * upstream promises "nothing was written", and a verdict written beside a
 * write that then failed would silence a pair on the strength of an act that
 * never happened.
 */
function recordVerdicts(
  ctx: MutationContext,
  self: { id: string; basis: string },
  settled: readonly ContradictionCandidate[],
  draft: ContradictionDraft,
  ruledBy: Origin,
): void {
  for (const candidate of settled) {
    const verdict: ContradictionDisposition =
      draft.supersedes === candidate.id ? 'supersedes' : 'distinct';
    appendVerdict(ctx.root, self, { id: candidate.id, basis: candidate.basis }, verdict, ruledBy);
  }
}

/**
 * **The no-lapse half of §7, and it is the summary's own mechanism applied to
 * the verdicts keyed on it.**
 *
 * `--summary-unchanged` (and a re-affirmation) says in words that this edit did
 * not change what the item MEANS, and `reaffirmSummary` answers it by
 * re-stamping `summary_of` onto the new content. Every verdict about this item
 * is keyed to that stamp, so unless they move with it, the one flag whose whole
 * assertion is "the meaning did not move" would lapse every ruling about the
 * item — the gate would then raise, on a typo fix, exactly the pairs a person
 * has already settled, which is the wall §7 exists to prevent.
 *
 * So they are RE-STAMPED, not re-ruled: only verdicts that are live at this
 * moment are carried (both bases still matching), the other item's basis is
 * taken as it stands rather than as it was, `ruledAt` keeps the day the person
 * actually ruled, and the row is marked `carried` so the log can always
 * distinguish a ruling from its re-stamp. A verdict whose OTHER side has
 * changed meaning is not carried, and lapses exactly as it should.
 */
function carryVerdicts(ctx: MutationContext, item: Item, basisBefore: string): void {
  const basisAfter = contradictionBasis(item);
  if (basisAfter === basisBefore) return;
  const live = latestVerdicts(readVerdicts(ctx.root));
  for (const recorded of live.values()) {
    if (recorded.a !== item.id && recorded.b !== item.id) continue;
    const selfIsA = recorded.a === item.id;
    if ((selfIsA ? recorded.aBasis : recorded.bBasis) !== basisBefore) continue;
    const otherId = selfIsA ? recorded.b : recorded.a;
    const other = projectItem(ctx, otherId);
    if (other === null) continue;
    const otherBasis = contradictionBasis(other);
    if ((selfIsA ? recorded.bBasis : recorded.aBasis) !== otherBasis) continue;
    appendVerdict(
      ctx.root, { id: item.id, basis: basisAfter }, { id: otherId, basis: otherBasis },
      recorded.verdict, recorded.ruledBy, { ruledAt: recorded.ruledAt },
    );
  }
}

/**
 * §6 path 2, routed rather than reimplemented: `--supersedes <id>` retires the
 * candidate by the item this call just wrote, through `supersedeItem` — which
 * already validates both ids, refuses a second successor, writes both edges and
 * records one audit row for the pair.
 *
 * **The pre-flight is the honest part.** `supersedeItem` runs AFTER the write,
 * because a successor has to exist before anything can be superseded by it, so
 * a refusal raised in there would land with the new item already on disk and
 * break the "nothing was written" promise this gate's own refusal makes. Both
 * of its refusals that a caller can trip from here — an id that names nothing
 * writable, and a non-human caller retiring a governing normative item — are
 * therefore asked BEFORE the write, through the very functions `supersedeItem`
 * itself consults, so the answer cannot drift from the one it would give.
 *
 * What is left is narrow and is disclosed rather than papered over: an id that
 * stops being writable between the pre-flight and the write, and the existing-
 * successor refusal, can still surface after the create. Both leave the new
 * item on disk and the old one un-retired, and the message says so.
 */
/**
 * Which spelling of the two dispositions the reader of this refusal can
 * actually type, inferred from `origin` — for `summaryRequiredRefusal`'s stated
 * reason: *"a refusal that names a command the reader cannot run is worse than
 * one that names nothing"*.
 *
 * `origin` is the only surface signal that reaches this depth, and it is a
 * true one for every path that exists today: every CLI write passes
 * `origin: 'human'` (that is precisely the claim `updateItem`'s trust guard
 * says a non-human caller cannot make), and every MCP tool and every ingest
 * path hardcodes a non-human origin. **The limit is real and is stated rather
 * than assumed away**: a human running the MCP tools through an agent gets the
 * flag spelling, and a human-origin caller that is not the CLI does not exist
 * yet. The day one does, this inference becomes a field on the input the way
 * `summary-gate.ts` takes a `surface` argument, and not a guess with a wider
 * range.
 */
function createSurface(origin: Origin): ContradictionSurface {
  return origin === 'human' ? 'add' : 'create_item';
}

function updateSurface(origin: Origin): ContradictionSurface {
  return origin === 'human' ? 'edit' : 'update_item';
}

/**
 * **The pass proposes; it never edits** — design §4, and the refusal names the
 * ruling rather than only the rule, because a caller that reads only "refused"
 * looks for the flag that turns it off.
 *
 * The reason is not a preference about tidiness. Continuous LLM updating
 * causes progressive fidelity loss that ACCELERATES as it compounds
 * (arXiv:2605.12978): each rewrite is taken over the previous rewrite rather
 * than over the evidence, so the drift has no restoring force. A pass that may
 * only ADD leaves every earlier statement exactly as its author left it, and a
 * human comparing a draft against the item it wants to replace is comparing
 * two things that were each written once.
 *
 * Shared by `updateItem` and `supersedeItem` deliberately. Superseding is not
 * an edit of the retired item's TEXT, but it stamps its status and its
 * `valid_until` and writes an edge onto it — which is a change to what
 * governs, made by the caller least entitled to make one. One message for both
 * so the two cannot drift into saying different things about the same
 * boundary.
 */
function reviewNeverEditsError(verb: string, id: string): Error {
  return new Error(
    `my_context: the self-improvement pass cannot ${verb} ${id}. It carried origin "review", and ` +
    `that origin PROPOSES — it creates drafts nobody has to trust and it changes nothing that ` +
    `already exists. This is a ruling, not a permission that can be raised: an item rewritten by ` +
    `each pass is rewritten over the last rewrite rather than over the evidence, and the drift ` +
    `that produces has nothing pulling it back. Propose the change instead — create_item with ` +
    `origin "review" lands a draft beside the corpus, and a person promotes it.`,
  );
}

/**
 * **The one wording of the question that retires an item, so the gated path
 * cannot ask it differently from `mycontext supersede`.**
 *
 * `cmdSupersede` (cli/commands/supersede.ts) has asked exactly this since the
 * command shipped and now imports it; `preflightSupersede` asks it on the
 * `--supersedes <id>` path. A second sentence here would be the same defect
 * this file names everywhere else — one rule, two spellings — arriving at the
 * one prompt whose whole job is to be recognisable.
 *
 * `by` is a LABEL rather than an id, and that is forced rather than chosen: on
 * the `add` path the replacement has not been minted yet — its id is allocated
 * by `createItem`'s family walk, AFTER the pre-flight — so there is nothing to
 * name but the item about to be written. `edit` and `supersede` both pass a
 * real id. The half of the sentence that carries the irreversible act, the
 * retiree, is identical in all three.
 */
export function supersedeQuestion(retired: { id: string; title: string }, by: string): string {
  return `Supersede ${retired.id} ("${retired.title}") with ${by}?`;
}

/**
 * **What a person is asked, and what they are told when they say no.**
 *
 * `confirmAction` has already printed its own "not confirmed" line by the time
 * this throws, so this message does NOT restate that. It states the thing only
 * this depth knows: the retirement was one half of a write that had two, and
 * the OTHER half did not happen either. Without that sentence a person who
 * declined at the second prompt of `mycontext add` would be left unable to
 * tell whether the new item had landed.
 */
function supersedeDeclinedRefusal(id: string): string {
  return (
    `my_context: ${id} was not superseded, and nothing was written — the item this write would ` +
    `have created or changed was not written either, so the pair is not half done. Re-run when ` +
    `you mean to retire ${id}, or answer the gate with "--distinct" instead, which says both can ` +
    `be true and is recorded the same way.`
  );
}

function preflightSupersede(
  ctx: MutationContext, id: string, origin: Origin, by: string,
): void {
  const target = requireWritableItem(ctx, id);
  if (origin !== 'human' && governsNormatively(ctx, target)) {
    throw new Error(
      `my_context: this write disposes of ${target.id} with "supersedes", which retires it — and ` +
      `a non-human caller cannot retire a governing normative item. ${target.id} is currently ` +
      `"${target.status}", a status only a human sets. Nothing was written. The other ` +
      `disposition is open to you: "distinct" says both can be true, and it is recorded the same ` +
      `way. If ${target.id} genuinely has to go, ask the user, who can run ` +
      `\`mycontext supersede ${target.id} --by <the new id>\`.`,
    );
  }
  // **THE EXISTING-SUCCESSOR REFUSAL, HOISTED IN FRONT OF THE WRITE.**
  //
  // It used to be reachable only from inside `supersedeItem`, which runs AFTER
  // the create — so a `--supersedes` naming an item that already had a
  // successor left the new item on disk and the old one un-retired, the exact
  // half-done pair this path's own docblock disclosed. It is a pure question
  // about the RETIREE's relations, so nothing about it needed the write to
  // have happened; it was only ever asked late because that is where the
  // function that asks it lives.
  //
  // `by` is passed through rather than a second sentence being written for the
  // `add` case: the refusal's closing advice names the replacement, and on
  // that path the honest name is the label — the item has not been minted yet.
  // It cannot mis-fire as the idempotent case either, because a label is never
  // equal to a recorded relation target.
  //
  // `supersedeItem` still asks it too, and that duplication is deliberate: it
  // is that function's own contract, reachable from `mycontext supersede` and
  // the MCP tool, and a guard on one side of a pair of call paths is the
  // "fixed in one place, live in the next" gap this file keeps naming. What is
  // NOT closed by hoisting it, and is disclosed rather than implied: an id
  // that stops being writable BETWEEN this pre-flight and the write can still
  // surface after the create. That one is a time-of-check/time-of-use window
  // and only a transaction closes it — see the task's own note that atomic
  // create-plus-retire is the larger, better guarantee.
  const successorRefusal = existingSuccessorRefusal(target, by);
  if (successorRefusal !== null) throw new Error(successorRefusal);

  // **ASKED, on every surface that can ask** — the second half of this
  // pre-flight's promise, and the reason it is here rather than in `cmdAdd`
  // and `cmdEdit` twice. `supersedeItem` never prompted; the confirm lived in
  // `mycontext supersede`, so retiring a governing item through the gate
  // happened with no confirmation at all.
  //
  // UNCONDITIONAL when a surface offers the hook, deliberately: `mycontext
  // supersede` asks about every item it retires, not only a governing one, and
  // a narrower condition here would be a second policy about the same act
  // wearing the same sentence. The origin refusal above is a different
  // question — "may this caller do it" — and is not softened by an answer.
  //
  // BEFORE the write, like every other refusal in this pre-flight, so the
  // "nothing was written" the gate's own refusal promises stays true when the
  // answer is no.
  if (ctx.confirm !== undefined && !ctx.confirm(supersedeQuestion(target, by))) {
    throw new Error(supersedeDeclinedRefusal(target.id));
  }
}

export function createItem(
  ctx: MutationContext, input: CreateInput, auditOp: MutationOp = 'create',
): MutationResult {
  const category = resolveCategory(ctx, input.type);

  const title = (input.title ?? '').trim();
  if (title === '') throw new Error(missingFieldError('title', 'create_item', 'capture'));
  // Normalized ONCE, here, into a local `body` that both the validator and
  // the stored item read — not validated-then-re-derived, and not stored
  // raw. `parseItem` (item.ts) normalizes line endings before splitting the
  // body into lines; a body carrying a lone `\r` (any Windows- or old-Mac-
  // authored source text) has no literal `\n` to reveal a hidden `## `
  // heading to a naive check, but normalizing after storage would have
  // already lost the chance — the checksum, and `contentHash` below, both
  // need to see the SAME normalized text the file will actually hold.
  const body = normalizeEol(input.body ?? '').trim();

  validateEnums(input);
  // Beside the enums and before anything is written, for their reason: a date
  // the format cannot store would land as a frontmatter line every later read
  // reparses into a different day, and the write itself would report success.
  // Enforced HERE rather than only at `mycontext add`, so that every surface
  // that grows a spelling for the field gets the same refusal (spec §10).
  if (input.validFrom !== undefined) validateValidFrom(input.validFrom, '"valid_from"');
  validateTitle(title);
  validateExtra(input.extra ?? {});
  // AFTER `validateExtra`, deliberately — see `unknownExtraFieldError`: a
  // reserved frontmatter name must keep failing as a collision, not as an
  // undeclared field whose remedy is to declare it.
  const extraRefusal = unknownExtraFieldError(ctx.config, category, input.extra);
  if (extraRefusal) throw new Error(extraRefusal);
  validateScope(input.scope ?? []);
  // Before anything is written, and before the id family is even consulted:
  // the refusal promises "nothing was written", and every write in this
  // function happens below.
  const scopeRefusal = scopeRequirementError(category, input.scope);
  if (scopeRefusal) throw new Error(scopeRefusal);
  // Spec §3, and here for the same reason the scope refusal is: before any
  // write, so "nothing was written" is true. Only the governing value of each
  // field is an assertion — see `inertFieldError` for why the neutral values
  // (`false`, `"soft"`) must stay accepted.
  if (input.always === true) {
    const refusal = inertFieldError(category, 'always');
    if (refusal) throw new Error(refusal);
  }
  if (input.severity === 'hard') {
    const refusal = inertFieldError(category, 'severity');
    if (refusal) throw new Error(refusal);
  }
  validateTags(input.tags ?? []);
  // **The capture half of the projection** (plan:categories seq 20). Two
  // things, and they are the same rule seen from either end.
  //
  // It REFUSES a value outside the declared vocabulary, before anything is
  // written — `mycontext add --extra state=donee` exited 0 and wrote the field
  // until this line existed, because `validateExtra` and
  // `unknownExtraFieldError` above answer "is this key writable" and "does this
  // category own this key" and neither of them ever asked "is this value one of
  // the declared ones". That made this the same class of rule as the four
  // refusals it now stands beside, and the odd one out for living only in a
  // command.
  //
  // And it WRITES the projected tag from the field, so an item cannot be born
  // with a `state` field and no `state:` tag — which is `absent` in
  // `projectionMismatch`'s terms: invisible to `focus`, to `search --tag` and
  // to every progress view, from the moment of capture.
  //
  // A hand-written projected tag that AGREES with the field is a no-op:
  // `reconcileTags` gives the first tag under the prefix the value and drops
  // any further one, so `--tags state:todo --extra state=todo` stores one tag,
  // and a duplicate membership cannot be captured even by hand. Capture does
  // NOT refuse a hand-written projected tag the way `edit` does
  // (`handWrittenProjectionError`): the ruling this implements names the
  // projection and the vocabulary, and nothing else.
  //
  // Before `contentHash` below, deliberately: `tags` is part of content
  // identity (`ContentShape`, content-hash.ts), so hashing the caller's list
  // and storing the projected one would put the dedup key permanently out of
  // step with the bytes on disk — the same "hash what you store" discipline
  // `body`, `observations` and `steps` each get a few lines down.
  const tags = projectFieldUpdate(
    ctx.config,
    { type: input.type, tags: input.tags ?? [], extra: input.extra ?? {} },
    input.extra ?? {},
  ).tags ?? input.tags ?? [];
  validateBody(body);
  // Normalised ONCE, here, into the local `stampSummary` is handed below — the
  // discipline `body`, `observations` and `steps` each get, for the same
  // reason: the value validated and the value stored must be one string.
  //
  // `''` (and whitespace-only) collapses to `null` rather than being stored:
  // `asString` (item.ts) reads an empty frontmatter scalar back as absent, so
  // storing it would produce an item whose summary silently vanishes on the
  // next read — the failure `validateExtra` refuses for an extra value, and
  // the reason `--summary=` is the CLEAR spelling on `edit` rather than a
  // second way of writing nothing.
  const summary = normalizeSummary(input.summary ?? '');
  validateSummary(summary);
  // Normalized ONCE, here, into a local both `contentHash` below and the
  // stored item read — the same discipline `body` gets just above, for the
  // same reason: hashing the raw text and storing the normalized text (or
  // the reverse) puts the checksum permanently out of step with disk.
  const observations = normalizeObservations(input.observations ?? []);
  // Normalised ONCE, here, for the reason `body` and `observations` are — and
  // with one extra: `contentHash` below re-derives this from `input.steps`
  // through the SAME function, so a step that would be refused must be refused
  // before either sees it, and both must see the identical array.
  //
  // Unlike `normalizeObservations`, this trims nothing and collapses nothing:
  // `parseSteps` (item.ts) requires a step to re-render byte-identically to
  // the line it was read from, so a normalisation here would write a file that
  // no longer says what its author typed — or, for leading whitespace, one
  // that refuses to load at all. See `normalizeSteps`.
  const steps = normalizeSteps(input.steps ?? []);
  validateRelations(input.relations ?? []);
  // An id is a relation TARGET the moment anything later supersedes this
  // item (see `validateRelationTarget`'s doc comment) — guarded here, at
  // mint time, rather than only at whichever future `supersede_item`/
  // `link_items` call first tries to write it as one.
  if (input.id !== undefined) validateRelationTarget(input.id, '"id"');
  // ...and it is a FILENAME as well as a relation target, which
  // `validateRelationTarget` says nothing about: it refuses an empty string,
  // a line break and a "]", all of which a traversal id passes cleanly. See
  // `validateExplicitId`.
  if (input.id !== undefined) validateExplicitId(input.id, '"id"');

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  // `tags` overrides the spread's `input.tags` for the reason stated at its
  // declaration: the projected list is what gets written, so it is what must
  // be hashed.
  const hash = contentHash({ ...input, title, body, observations, tags });

  // Spec §7.3: the idempotency key is `(source_file, source_anchor)` PLUS a
  // content hash — `type` is part of the match too, since a requirement and
  // a constraint captured from the same heading are different items, not a
  // collision. Content hash is folded into the match itself (not checked
  // after) so that different content at the same anchor simply falls
  // through to the normal id-allocation path below and creates a new item,
  // rather than being refused: a single heading routinely yields more than
  // one item, and a revision must be mintable at the same anchor as its
  // predecessor for supersede_item to have anything to wire together.
  const anchored = sourceFile !== null && sourceAnchor !== null
    ? projectItems(ctx).find(
        (i) => i.type === input.type && i.sourceFile === sourceFile &&
          i.sourceAnchor === sourceAnchor && itemContentHash(i) === hash,
      )
    : undefined;

  if (anchored) {
    return {
      id: anchored.id,
      created: false,
      status: anchored.status,
      filePath: anchored.filePath,
      message: `my_context: already captured as ${anchored.id}. Nothing changed.`,
    };
  }

  const origin: Origin = input.origin ?? 'human';
  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');

  const duplicateOf = (existing: Item): MutationResult => ({
    id: existing.id,
    created: false,
    status: existing.status,
    filePath: existing.filePath,
    message: `my_context: already captured as ${existing.id}. Nothing changed.`,
  });

  const occupiedError = (existingId: string): Error => new Error(
    `my_context: "${existingId}" already exists with different content. create_item never ` +
    `overwrites an existing item — call update_item(id: "${existingId}", ...) to change it, ` +
    `or supersede_item(id: "${existingId}", ...) to replace it with a new revision.`,
  );

  // **The duplicate probe, ABOVE the gate** — the same two lookups the id
  // allocation below makes, hoisted so their answers are known before anything
  // is refused. `located` is reused below rather than recomputed, so this costs
  // one store scan and not two.
  //
  // The ordering is the point: a re-capture of content the corpus already holds
  // writes NOTHING, and gating a write that was never going to happen would ask
  // a person to rule on a pair that this call was not going to add to. It is
  // the same reason the anchored-duplicate return above sits where it does.
  // Measured before the hoist: `test/core/mutate-create.test.ts` · "a colliding
  // title with identical content is a duplicate, not a suffix" was refused by
  // the gate for re-capturing an item byte for byte.
  const explicitExisting = input.id === undefined ? null : projectItem(ctx, input.id);
  if (explicitExisting !== null) {
    if (itemContentHash(explicitExisting) === hash) return duplicateOf(explicitExisting);
    throw occupiedError(input.id as string);
  }
  const located = input.id === undefined
    ? locateInFamily(ctx, category.prefix, title, hash)
    : null;
  if (located?.duplicate) return duplicateOf(located.duplicate);

  // ── THE CONTRADICTION GATE, BEFORE ANY BYTES ARE WRITTEN ────────────────
  //
  // Placed beside the existing refusals and above every `persist` in this
  // function, so the promise its message makes — "nothing was created" — is
  // true in the same way the scope, inert-field and extra-field refusals'
  // is.
  //
  // **Gated on the item this call would actually put IN FORCE, not on the
  // category alone.** `trustedStatus` has just forced a non-human normative
  // capture to `draft`, and a draft governs nothing and contradicts nothing —
  // `select` never injects it, and a human still has to promote it. The
  // promotion is an `updateItem` and is gated there, at the moment the item
  // starts to govern, which is where a person is present to answer. Without
  // this clause the gate would fire on every agent capture, refuse it with a
  // question no agent can answer, and be routed around within a week; with it,
  // `lesson-accept` and `ingest-apply` filing normative drafts are unaffected
  // and the ruling happens once, at review.
  const draft: ContradictionDraft = {
    id: null,
    type: input.type,
    title,
    body,
    always: input.always ?? false,
    basis: itemSummaryBasis({
      type: input.type, title, body, steps,
      severity: input.severity ?? 'soft',
      always: input.always ?? false,
      continuity: input.continuity ?? false,
      scope: (input.scope ?? []).map((g) => normalizePosix(g)),
      tags, observations, relations: input.relations ?? [], extra: input.extra ?? {},
    }),
    distinct: input.distinct ?? [],
    supersedes: input.supersedes ?? null,
  };
  const gated = inContradictionScope(draft.type, draft.always) && GOVERNING_STATUS[status];
  const settled = gated ? contradictionCheck(ctx, draft, createSurface(origin)) : [];
  // The pre-flight §6 path 2 needs, and it has to happen here rather than
  // after the write — see `preflightSupersede`.
  // The label, not an id: nothing has been minted yet on this path — see
  // `supersedeQuestion`. `category.prefix` is not used because the person
  // answering typed the category, not the prefix.
  if (gated && draft.supersedes !== null) {
    preflightSupersede(ctx, draft.supersedes, origin, `the new ${input.type} "${title}"`);
  }

  const buildItem = (itemId: string): Item => {
    const built: Item = {
    id: itemId,
    type: input.type,
    title,
    status,
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    continuity: input.continuity ?? false,
    // Both `null` here and then set together by `stampSummary` below, never
    // assigned in this literal: the basis is a hash OF this item, so it cannot
    // be computed until the item exists. Stamping afterwards is also what
    // makes the basis describe the item that was actually written — title,
    // body, steps, observations and extra as they landed — rather than
    // whatever the caller passed.
    summary: null,
    summaryOf: null,
    // Empty, and there is no input for it. A history entry records that a
    // summary was REPLACED; an item being created has replaced nothing, and a
    // caller that could declare one at capture would be declaring that this
    // item used to say something before it existed. `reviseSummary`
    // (summary-history.ts) is the only writer.
    summaryWas: [],
    // Empty at creation, and there is no input for it. An acknowledgement is a
    // record that a PERSON read a doctor finding on an item that already
    // exists; a caller that could declare one at capture time would be
    // declaring somebody had ruled on a finding nothing has yet computed.
    // `mycontext ack` is the only writer — see `core/acknowledge.ts`.
    acknowledged: {},
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags,
    origin,
    sourceFile,
    sourceAnchor,
    sourceChecksum: input.sourceChecksum ?? null,
    // The clock is the DEFAULT, not the rule — see `CreateInput.validFrom`.
    // Already validated above, so nothing that could not have been produced by
    // `today()` itself reaches the file.
    validFrom: input.validFrom ?? today(),
    validUntil: null,
    checksum: '',
    extra: input.extra ?? {},
    body,
    // Already validated and already `checked: false` throughout — see the
    // `normalizeSteps` call above. An input with no steps still produces `[]`,
    // which is what keeps a stepless item's `checksum` identical to what it
    // was before steps existed: `computeItemChecksum` adds the key only when
    // the list is non-empty (spec §6n.4), so every corpus that predates this
    // field hashes exactly as it did.
    steps,
    observations,
    relations: input.relations ?? [],
    layer: 'project',
    // **`items/` is committed; `.drafts/` is not** — design §4, and
    // `core/drafts.ts` carries the reasoning. The branch is here, at the one
    // place an item's path is decided, rather than in `writeItem`: a path
    // chosen at write time would be invisible to the `MutationResult` this
    // function returns, and `filePath` is what every caller — the CLI's
    // "created … at …", the audit row, `detectDivergence` — reads back.
    filePath: origin === 'review'
      ? draftFilePath(input.type, itemId)
      : `items/${input.type}/${itemId}.md`,
    };
    // AFTER every field is in place, so a capture that carries a body and a
    // summary produces a summary that is `current` rather than one born stale.
    stampSummary(built, summary === '' ? null : summary);
    return built;
  };

  /**
   * Allocate an id and write the file, with the WRITE — not a store lookup —
   * as the thing that decides whether the id was free.
   *
   * `ctx.store` is a snapshot taken before this call; every check against it
   * is advisory, and under concurrency several processes read the same
   * snapshot, compute the same id, and each believe it is free. The store
   * checks below are kept because they answer the common questions cheaply
   * and produce the better messages (a duplicate is recognised without
   * touching the filesystem), but the guarantee comes from
   * `persist(..., { exclusive: true })`: `writeItem` creates the file with a
   * single atomic operation that fails if the name is taken, so exactly one
   * racer can win a given id. On losing, the loser reparses the file that is
   * ACTUALLY there — never `ctx.store`, which is stale by construction — and
   * either recognises its own content (a duplicate no-op) or moves to the
   * next id in the family.
   *
   * This lives in `persist`/`writeItem` rather than in a lock because
   * `writeItem` has ten call paths through `persist` and eight of them never
   * take the ingest apply lock; and because the ingest apply lock is
   * workspace-scoped and already held around `applyCandidates`, which calls
   * `createItem` — taking it here would deadlock that path.
   */
  // BEFORE the first `persist`, and unconditionally on this origin rather
  // than once per workspace: `writeItem` creates `.drafts/<type>/` with a bare
  // `mkdirSync`, so without this the FIRST proposal in a workspace would land
  // in a directory no `.gitignore` covers. `ensureDraftDir` rewrites the `*`
  // file every time for the reason `ensureLogDir` states — an emptied or
  // hand-edited ignore self-heals — and here the cost of not self-healing is a
  // proposal nobody approved arriving in somebody else's clone.
  if (origin === 'review') ensureDraftDir(ctx.root);

  let item: Item;
  if (input.id !== undefined) {
    // An explicit id names an item this call must never silently overwrite.
    // Only two outcomes are legal: it's the same content (a no-op duplicate),
    // or the caller is pointed at update_item/supersede_item instead. There
    // is no "next candidate" here — the caller named this exact id. The store
    // lookup itself is `explicitExisting` above, hoisted so that a duplicate
    // is recognised before the contradiction gate can refuse a call that was
    // going to write nothing; the `catch` below is still the guarantee, for
    // the reason this comment block gives.
    item = buildItem(input.id);
    try {
      persist(ctx, item, { exclusive: true });
    } catch (err) {
      if (!isItemExistsError(err)) throw err;
      const onDisk = itemAtPath(ctx, item.filePath);
      if (itemContentHash(onDisk) === hash) return duplicateOf(onDisk);
      throw occupiedError(item.id);
    }
  } else {
    // Computed above the gate (`located`) rather than here, so that a
    // re-capture of identical content returns as the duplicate it is before
    // anything can be refused. Non-null on this branch by construction: it is
    // assigned exactly when `input.id === undefined`.
    const family = located as NonNullable<typeof located>;

    let written: Item | null = null;
    for (let n = family.nextN; n <= MAX_FAMILY && written === null; n++) {
      const candidate = buildItem(familyId(family.base, n));
      try {
        persist(ctx, candidate, { exclusive: true });
        written = candidate;
      } catch (err) {
        if (!isItemExistsError(err)) throw err;
        const onDisk = itemAtPath(ctx, candidate.filePath);
        if (itemContentHash(onDisk) === hash) return duplicateOf(onDisk);
        // Someone else's item holds this id: advance in the same sequence
        // `locateInFamily` allocates into, and try again.
      }
    }
    if (written === null) throw familyExhausted(title);
    item = written;
  }
  const id = item.id;

  // §7, after the write and only on the path that actually wrote — the
  // duplicate returns above created nothing, so they rule on nothing. The
  // basis is read off the item that was actually built rather than off the
  // draft, for `stampSummary`'s reason: the recorded key has to describe what
  // landed on disk, not what was passed in.
  if (settled.length > 0) {
    recordVerdicts(ctx, { id, basis: contradictionBasis(item) }, settled, draft, origin);
  }
  // §6 path 2: created AND retired in one act, with the link recorded. It runs
  // last, after the verdict, so that a `supersedeItem` refusal the pre-flight
  // could not foresee leaves behind the ruling that was made rather than losing
  // it — the item is on disk either way, and re-sending the capture would
  // otherwise ask the same question again.
  //
  // **Its message is CARRIED, not discarded**, and that was a real hole: the
  // gated path retired an item, stood it down and wrote two relation edges,
  // and the only thing printed was "created <id>". A person who had just
  // confirmed the retirement was told nothing about whether it happened, and
  // under `--yes` there was neither a prompt nor a line — the act was
  // invisible on the surface that performed it. `INV-nothing-is-dropped-
  // silently` reads on an ACT as much as on a field.
  const retirement = draft.supersedes !== null && settled.some((c) => c.id === draft.supersedes)
    ? supersedeItem(ctx, {
      id: draft.supersedes, by: id, origin,
      reason: `settled by the contradiction gate at capture: ${id} replaces it`,
    })
    : null;
  // One line, not two: `MutationResult.message` is a single sentence-run every
  // surface prints as one, so the prefix comes off rather than a second
  // `my_context:` landing mid-line.
  const retired = retirement === null
    ? ''
    : ` ${retirement.message.replace(/^my_context: /, '')}`;

  // Gated on the rule having actually fired — not merely on the resulting
  // status — so a caller that explicitly asks for `draft` on a non-normative
  // (e.g. rationale) item never sees a demotion explanation for a demotion
  // that did not happen. Since this can then only ever be the normative
  // case, the message says "normative" literally rather than interpolating
  // `category.tier`, so it cannot drift from the condition again. The
  // condition mirrors `trustedStatus` exactly (`origin !== 'human'`, not
  // `origin === 'agent'`) — an ingested item that gets demoted must get the
  // same explanation an agent-authored one does, or the message would be
  // silently missing for the one path (batch ingestion, spec §7.2) that is
  // going to demote the most items.
  const suffix = origin !== 'human' && category.tier === 'normative' && (input.status ?? 'active') !== 'draft'
    ? ` It is a draft because non-human-authored normative items are not injected until ` +
      `reviewed — a human can promote it with \`mycontext review promote ${id}\`.`
    : '';

  // After the write, and only on the path that actually wrote: the duplicate
  // returns above (`duplicateOf`) created nothing, so they record nothing.
  //
  // **The opt-out's record**, and it is the half of `--summary-omitted` that
  // makes it an act rather than a shrug. An item minted with no summary is
  // invisible to every summary check by construction (`checkSummary` skips it,
  // and `summary_absent` in doctor exists precisely because of that), so
  // without this note "nobody wrote a summary" and "nobody noticed there was no
  // summary" are the same row. A `note` rather than a `field` for
  // `SUMMARY_UNCHANGED_NOTE`'s reason: it is short, non-content and greppable,
  // and `fields` means "what this write moved", which on a create is everything
  // and therefore nothing worth naming.
  //
  // Gated on the flag alone rather than on the summary having come out null.
  // The two cannot disagree — `summaryOmittedRefusal` refuses the flag beside a
  // summary at both authored surfaces, and no internal caller passes it — and a
  // second condition here would be a quieter, divergent answer to the question
  // that refusal exists to ask.
  const audited = auditMutation(
    ctx, auditOp, origin, id,
    input.summaryOmitted === true ? { note: SUMMARY_OMITTED_NOTE } : {},
  );

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message:
      `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}${retired}${audited}`,
  };
}

export interface UpdateInput {
  id: string;
  title?: string;
  body?: string;
  scope?: string[];
  tags?: string[];
  severity?: Severity;
  always?: boolean;
  /** Continuity-tier membership — see `Item.continuity` and `CreateInput.continuity`. */
  continuity?: boolean;
  /**
   * The item's summary — one plain sentence for a reader who does not know
   * this codebase. See `Item.summary` and `CreateInput.summary` for the bar.
   *
   * **The empty string CLEARS it**, and absence leaves it alone: the two are
   * different instructions, exactly as they are for `scope` at `mycontext
   * edit` ("Absent (`null`) and empty (`--scope=`) are different instructions
   * — the second one clears the field"). There is no `null` spelling, so this
   * field stays a `string` and a staged revision can carry it like any other
   * content field.
   *
   * **It is CONTENT** (`UPDATE_FIELD_POLICY`, trust.ts), so `agentEdits`
   * governs it with no exception carved: on a category set to `review` an
   * agent's summary write is STAGED as a pending revision for a human,
   * alongside a title or body change, rather than applied.
   *
   * `summaryOf` is absent from this interface on purpose and there is no
   * surface that sets it: it is stamped from the item AFTER this call's
   * assignments land, so an edit that rewrites the body and the summary
   * together yields a current summary, and one that rewrites only the body
   * leaves the basis behind and the summary goes stale. That asymmetry IS the
   * mechanism.
   */
  summary?: string;
  /**
   * **The escape hatch: this edit does not change what the item means, so the
   * summary it already carries still describes it.**
   *
   * The gate (`summary-gate.ts`) refuses an edit that moves the summarised
   * content without a summary to go with it. A mechanical edit — a typo, a
   * reflow, a rewrapped paragraph — genuinely does not need a rewritten
   * sentence, and forcing one would teach writers to paste the old summary
   * back, which is the same act with no record that it happened.
   *
   * So this says it in words instead. It re-stamps the basis from the item as
   * the edit leaves it, WITHOUT new text and WITHOUT a history entry (nothing
   * was replaced), and `updateItem` records it in the audit row so "nobody
   * rewrote the summary" is visible rather than assumed.
   *
   * **It is never a default and it is not a general re-blessing tool.** Both
   * constraints are enforced by the two surfaces that accept it, through
   * `summaryUnchangedRefusal`: it is refused alongside `summary`, refused on an
   * item that has no summary, and refused on an edit that does not raise the
   * gate at all — which is what stops it becoming a way to mark an
   * already-stale summary current without reading it. A summary that is
   * already stale AND still correct has its own route and it is not a flag:
   * pass the same sentence back as `summary`, which re-stamps the basis and is
   * audited as a re-affirmation (`summaryReaffirmed`, summary-gate.ts). The
   * cost of typing the sentence is the guard, and it is why this clause does
   * not need widening.
   *
   * Absent from `RevisionChanges` (revision.ts) and from `AUDITED_FIELDS`
   * (persist.ts), because it is an instruction about a write rather than a
   * field of an item: there is nothing on disk for it to become.
   */
  summaryUnchanged?: boolean;
  /**
   * The contradiction gate's two answers at the other end of an item's life —
   * see `CreateInput.distinct` for what each one asserts and where the ruling
   * is recorded. On an edit, `supersedes` makes THIS item the successor: the
   * named item is retired by it, in one act, with both edges written.
   */
  distinct?: string[];
  supersedes?: string;
  status?: Status;
  extra?: Record<string, string>;
  origin?: Origin;
}

export interface SupersedeInput {
  id: string;
  by: string;
  reason?: string;
  origin?: Origin;
}

/**
 * The second write path. `createItem` is the only place a non-human-authored
 * normative item gets forced to `draft` (via `trustedStatus`) — but nothing
 * stops a non-human caller from *editing* an already-active constraint, so
 * the boundary that matters here is narrower and different: a non-human
 * caller may PROPOSE a change to a governing normative item's content —
 * `title`, `body`, `tags` and `extra` (that is deliberate — an agent sharpening
 * the wording of a rule is the point of the tool) — and whether the proposal
 * applies at once or waits for a human is the category's `agentEdits` setting,
 * below. What it may not touch at all is `status`, or the injection-control
 * fields `scope`/`always`/`severity`. Forcing `draft` here
 * would be wrong (spec intent, see module docs) — it would let a non-human
 * caller demote a human's active constraint just by editing its body — so an
 * attempted change is refused outright rather than silently rewritten.
 *
 * Both refusals are narrow on purpose, and gated on the same predicate:
 * non-human origin, normative tier, and currently governing — the same
 * `!== 'human'` widening as `trustedStatus`, for the same reason: `'ingest'`
 * reaches this tool exactly the same way `'agent'` does, and an ingestion
 * pipeline retiring or defanging a human's governing constraint is no less
 * dangerous than an agent doing it interactively. A caller editing its own
 * `draft` (which governs nothing yet), or any rationale item, is unaffected
 * in every field, regardless of origin.
 */
export function updateItem(
  ctx: MutationContext, input: UpdateInput, auditOp: MutationOp = 'update',
): MutationResult {
  const item = requireWritableItem(ctx, input.id);
  const origin: Origin = input.origin ?? 'human';
  // FIRST — above the normalisation block below, and above `requireWritableItem`
  // in effect if not in line order, because this refusal is about the CALLER and
  // not about the input. A `review` caller that got as far as a validation error
  // would learn that its title was too long, which is an answer to a question it
  // is not allowed to ask.
  if (origin === 'review') throw reviewNeverEditsError('edit', input.id);

  // Every replacement value is normalized and validated up front, before
  // any trust-boundary check runs and before `item` is touched — the same
  // ordering `createItem` uses, and the same reason: a shape violation
  // (an unreadable-once-written body, title, scope glob or tag) is refused
  // on its own terms rather than surfacing as a confusing trust-boundary
  // error, or worse, silently corrupting the file after the trust check
  // passes. `update_item` is a first-class MCP surface (not merely an
  // ingest-adjacent one), so it needs the identical guards `create_item`
  // does for the identical fields — see `validateTitle`/`validateScope`/
  // `validateTags` (validate.ts).
  const title = input.title !== undefined ? input.title.trim() : undefined;
  const body = input.body !== undefined ? normalizeEol(input.body).trim() : undefined;
  // Normalised up front with `title` and `body`, and validated with them
  // below, for the ordering reason stated above: a summary over the bound is
  // refused on its own terms, before any trust-boundary check and before
  // anything can be staged, so every message downstream that says "nothing was
  // changed" is true.
  const summary = input.summary !== undefined ? normalizeSummary(input.summary) : undefined;

  validateEnums(input);
  if (input.extra !== undefined) validateExtra(input.extra);
  // The edit half of extra-field ownership, and before any mutation of `item`
  // so the message's "nothing was changed" is true. `Object.hasOwn` for the
  // prototype-safety reason `tierOf` documents, and the missing-category branch
  // does nothing on purpose: an item whose category was renamed or removed
  // after capture is still indexed (`loadLayer`, rebuild.ts) and has no
  // declaration to check against, so refusing every `extra` on it would strand
  // it behind a list that no longer exists — the same reason `scopePolicyFor`
  // resolves such an item to a product default rather than to a refusal.
  if (input.extra !== undefined && Object.hasOwn(ctx.config.categories, item.type)) {
    const refusal = unknownExtraFieldError(
      ctx.config, ctx.config.categories[item.type], input.extra, 'edit',
    );
    if (refusal) throw new Error(refusal);
  }
  if (title !== undefined) {
    if (title === '') throw new Error(missingFieldError('title', 'update_item', 'capture'));
    validateTitle(title);
  }
  if (body !== undefined) validateBody(body);
  if (summary !== undefined) validateSummary(summary);
  if (input.scope !== undefined) validateScope(input.scope);
  // The edit half of `scopePolicy: 'required'` — see `scopeRequirementError`
  // for why removing the last glob is refused as well as capturing without
  // one. Gated on the item actually LOSING globs, and placed before any
  // mutation of `item`, so the message's "nothing was changed" is true.
  // `tierOf`-style prototype safety comes from `Object.hasOwn` inside the
  // lookup; a type absent from config has no policy to enforce.
  if (input.scope !== undefined && input.scope.length === 0 && item.scope.length > 0 &&
      Object.hasOwn(ctx.config.categories, item.type)) {
    const refusal = scopeRequirementError(ctx.config.categories[item.type], input.scope, 'edit');
    if (refusal) throw new Error(refusal);
  }
  if (input.tags !== undefined) validateTags(input.tags);
  // Spec §3. Gated on the update actually MOVING the field to its governing
  // value — not on the value being present — for the reasons in
  // `inertFieldError`: an echo asserts nothing, and an item whose category was
  // retiered underneath it must stay editable. Placed before any mutation of
  // `item`, so "nothing was changed" is true, and before the trust-boundary
  // checks below so that a rationale item (which those checks never reach) is
  // refused on its own terms. `Object.hasOwn` for the same prototype-safety
  // reason `tierOf` documents; a type absent from config has no tier to read,
  // and `tierOf` already fails closed to `normative` for it.
  if (Object.hasOwn(ctx.config.categories, item.type)) {
    const category = ctx.config.categories[item.type];
    if (input.always === true && !item.always) {
      const refusal = inertFieldError(category, 'always', 'edit');
      if (refusal) throw new Error(refusal);
    }
    if (input.severity === 'hard' && item.severity !== 'hard') {
      const refusal = inertFieldError(category, 'severity', 'edit');
      if (refusal) throw new Error(refusal);
    }
  }

  // **The edit half of the projection** (plan:categories seq 20), and the
  // last of the up-front checks: it THROWS on a value outside the declared
  // vocabulary before `item` is touched, before the trust-boundary refusals
  // below and before anything can be staged, so every sentence downstream that
  // says "nothing was changed" is true. Measured before it existed: MCP
  // `update_item({extra: {state: "donee"}})` was accepted and written and
  // returned "updated", because this function called `validateExtra` and
  // `unknownExtraFieldError` and never `updatableExtraError` — the declared
  // vocabulary was not enforced on this path at all, and `mycontext edit` was
  // the only closed door of three.
  //
  // Three things about the shape, each of which was a defect in some earlier
  // reading of it:
  //
  //  - It projects from the INCOMING tag list, `input.tags ?? item.tags`, and
  //    not from the stored one. `updateItem` MERGES `extra` and ASSIGNS `tags`
  //    outright (see the block of assignments below), so reconciling onto
  //    `item.tags` and then letting `input.tags` overwrite the result would
  //    silently discard the caller's whole list — `update_item({tags: ["v2",
  //    "ui"], extra: {state: "done"}})` measured exactly that, landing an item
  //    with no `state:` tag at all. `edit.ts` composes them in this same order
  //    and `test/cli/edit-projection.test.ts` pins it there.
  //  - Only when the call actually carries `extra`. `projectFieldUpdate`
  //    reconciles only the projections whose field the CALLER is moving, so a
  //    bare `--title` edit projects nothing and the items that already
  //    disagree are left for the migration that owns them (seq 19) — this is
  //    not one.
  //  - `projected.tags` is the WHOLE replacement list, already carrying every
  //    tag outside the prefix in its original position, so it REPLACES
  //    `input.tags` rather than merging with it.
  //
  // Everything below reads `update`, never `input`, so the projected list
  // reaches BOTH exits: the staged-revision path (`contentChange`), where the
  // tag rewrite must be staged WITH the field or a promoted revision lands the
  // field without the tag and reopens this hole one door further in; and the
  // direct apply. `input` itself is the caller's object and is never mutated.
  const projected = input.extra === undefined
    ? undefined
    : projectFieldUpdate(
      ctx.config,
      { type: item.type, tags: input.tags ?? item.tags, extra: item.extra },
      input.extra,
    );
  // **The OTHER half of the same door, and the one that was still open**
  // (`projectOntoTags`, core/tag-projection.ts — see its comment for the
  // measurement). The block above answers "the caller moved a field, so move
  // the tag with it". This one answers the mirror question the store never
  // asked: the caller replaced the TAG LIST, and `tags` is assigned outright a
  // few dozen lines down, so whatever it says about a projected prefix becomes
  // the stored projection — with no field moving and nothing checking. Measured
  // over `src/mcp/server.ts` on 2026-08-29: `update_item({tags:
  // [...,'state:done']})` wrote the tag and left `state: todo` on disk, and
  // `update_item({tags: ['v2','ui']})` dropped the projected tag while the
  // field kept its value. Both exit `mycontext doctor` at 1 on drift the store
  // itself had just written, and the first is precisely the `tag=done` against
  // a stale field that seq 19 counted thirteen of, then twenty-eight of.
  //
  // Only when the caller actually PASSES `tags`, for the reason stated just
  // above: a call that says nothing about tags must project nothing, or an
  // unrelated `--title` edit becomes a migration.
  const nextTags = input.tags === undefined
    ? projected?.tags
    : projectOntoTags(
      ctx.config, item, projected?.tags ?? input.tags, input.extra ?? {},
    );
  const update: UpdateInput = nextTags === undefined
    ? input
    : { ...input, tags: nextTags };

  if (origin !== 'human' && governsNormatively(ctx, item)) {
    const field = guardedChange(item, update);
    if (field) {
      // This message is only ever shown to a NON-HUMAN caller, so it must
      // name something that caller can actually do. It used to end by
      // telling it to edit the field in the item's Markdown file. That was
      // wrong twice over: the plugin's own PreToolUse hook
      // (src/hooks/pre-tool-use.ts) denies the model every Write/Edit under
      // `.my_context/items/`, so it was instructing the one caller who reads
      // it to do the one thing it is blocked from doing; and a hand edit
      // leaves the item failing its own recorded checksum, because every
      // write path re-stamps `checksum` through `persist` and a hand edit
      // does not, while `rebuild` only REPORTS the resulting mismatch (see
      // loadLayer in rebuild.ts) and never restamps it. `mycontext doctor`
      // then exits 1, blaming an edit made outside my_context.
      //
      // Until `mycontext edit` shipped there was no COMMAND that made this
      // change on an already-governing item, and this message said so — then
      // named hand edit + `mycontext repair` as the only thing a human could
      // do, while forbidding the caller from taking that route itself.
      //
      // `mycontext edit` (and its named forms `pin`/`unpin`/`harden`/`soften`)
      // makes exactly this change, behind a preview of what governs before and
      // after and a confirmation. So the old message was false in its main
      // clause, and its remedy was the one route this project's documentation
      // is not allowed to instruct: a hand edit leaves the item failing its
      // own recorded checksum until `repair` re-stamps it, and the pairing
      // leaves no evidence it happened. Naming a supported command instead is
      // both true and shorter.
      //
      // The prohibition stays, and for a reason that did not change: `edit`
      // passes `origin: 'human'`, which is precisely the claim a non-human
      // caller cannot make. Naming the route without forbidding it would turn
      // this refusal into an instruction to walk around itself.
      throw new Error(
        `my_context: a non-human caller cannot change the ${GUARDED_FIELDS[field]} of a governing ` +
        `normative item. ${item.id} is currently "${item.status}" and its ${GUARDED_FIELDS[field]} ` +
        `decides whether it is injected into a session at all, so changing it is a human ` +
        `decision. A human has a command for it: \`mycontext edit ${item.id} --${field} …\`, ` +
        `which previews what governs before and after and asks for confirmation ` +
        `(\`mycontext pin\`/\`unpin\` and \`harden\`/\`soften\` are that edit under a shorter ` +
        `name). Do not run it yourself: it passes origin "human", which is the one claim you ` +
        `cannot make, and it is on the deny list this plugin's README recommends. Ask the user. ` +
        `${openContentPhrase(ctx, item)}. A draft or rationale item is unaffected by THIS ` +
        `refusal. See mycontext_help("capture").`,
      );
    }
  }

  if (
    update.status !== undefined && update.status !== item.status &&
    origin !== 'human' && tierOf(ctx, item) === 'normative'
  ) {
    // The "what else is editable" clause has to match reality for *this*
    // item: on a governing (active/validated) normative item, scope/always/
    // severity are refused too (see the field guard above) — only the content
    // fields title, body, tags and extra remain open, and `openContentPhrase`
    // says whether they apply or are staged. A draft normative item has no such
    // restriction, so every other field really is editable there.
    const otherFields = governsNormatively(ctx, item)
      ? `${openContentPhrase(ctx, item)}; scope, always and severity are not, for the same reason.`
      : `Every other field is editable.${stagedContentCaveat(ctx, item)}`;
    // A human's next action differs by what `item` currently is, and only
    // one of the two branches has a route at all. A draft is one verb away
    // from `mycontext review promote`; anything else has NO command today —
    // `review` refuses a non-draft outright (see review.ts), and every MCP
    // write path hardcodes a non-human origin, so it lands right back here.
    // Conflating the two would send a human to `review promote` for an item
    // it refuses to touch.
    //
    // The non-draft branch went through two false versions — "edit `status:`
    // directly in its Markdown file", then a hand edit deterred by a checksum
    // mismatch `mycontext repair` had already made temporary. Both are retired
    // for the same reason as the sibling refusal above: `mycontext edit <id>
    // --status <name>` makes this change, behind a preview and a confirmation,
    // so there is a supported command to name and no reason to describe a
    // route this project's documentation must not instruct. `superseded` is
    // the one status `edit` refuses, because a retirement names its
    // replacement and records it in both directions.
    const humanRoute = item.status === 'draft'
      ? `A human can promote it with \`mycontext review promote ${item.id}\`.`
      : `A human has a command for it: \`mycontext edit ${item.id} --status <name>\`, which ` +
        `previews the change and asks for confirmation — or \`mycontext supersede ${item.id} ` +
        `--by <id>\` for a retirement, which is the one status \`edit\` refuses because it names ` +
        `a replacement. Do not run either yourself: both pass origin "human", which is the one ` +
        `claim you cannot make.`;
    throw new Error(
      `my_context: a non-human caller cannot change the status of a normative item. ` +
      `${item.id} stays "${item.status}". ${otherFields} Status changes on a ` +
      `normative item are a human decision. ${humanRoute} ` +
      `See mycontext_help("capture").`,
    );
  }

  // Spec §4, and the LAST thing before anything is written: a non-human
  // caller's edit to CONTENT is routed by the item category's `agentEdits`
  // policy. `review` stages it; `allow` falls through to the apply below,
  // which is what happened before this setting existed.
  //
  // Placed after both trust-boundary refusals above deliberately, and both
  // directions matter:
  //
  //  - `review` cannot become a route around them. A call that would change
  //    scope/always/severity/status on a governing normative item is refused
  //    up there and never reaches here, so nothing guarded can be staged.
  //    (`stageRevision` refuses those fields a second time on its own side;
  //    that is a backstop, not this rule.)
  //  - `allow` does not widen them either. It is read only here, on content;
  //    the refusals above do not consult it at all.
  //
  // `agentEditsFor` fails closed to `review` for a category absent from
  // config — see its doc comment.
  if (origin !== 'human' && agentEditsFor(ctx.config, item.type) === 'review') {
    // **A RE-AFFIRMATION cannot be staged either, and it reached this branch
    // disguised as nothing at all.**
    //
    // `contentChange` calls an echoed summary no change — correctly, because
    // there is no new TEXT for a revision to carry. But an echo on a write that
    // re-stamps the basis is not nothing: it moves the item from `stale` to
    // `current` and takes the "do not quote this" banner off a governing item's
    // most quotable sentence. With `proposed` null the call fell straight
    // through to the apply below and did exactly that, on an agent's say-so,
    // under a `review` policy whose whole point is that it does not happen —
    // and the audit row named no field and carried no note, so there was no
    // evidence it had.
    //
    // Refused, for `summaryUnchanged`'s reason immediately below and in its
    // shape: the assertion is "I read this item and this sentence still
    // describes it", a revision has nowhere to put it, and a human is the one
    // who gets to make it about an item this project holds for human review.
    if (summaryReaffirmed(item, update)) {
      throw new Error(
        `my_context: this call to update ${item.id} passes back the summary it already carries, ` +
        `which is a RE-AFFIRMATION — "I have read this item and this sentence still describes ` +
        `it" — and re-stamps what the summary was written against. "${item.type}" is set to ` +
        `agentEdits: "review" in this project, so content here is held for a human, and a ` +
        `staged revision has nowhere to carry that assertion: it carries new TEXT, and there is ` +
        `no new text. Letting it through would take the STALE marker off ${item.id} on an ` +
        `agent's word, which is the one thing "review" exists to prevent. Refused instead: ` +
        `nothing was applied and nothing was staged, and ${item.id} is exactly as it was. If the ` +
        `summary no longer describes the item, send a DIFFERENT sentence — that is stageable, ` +
        `and it is held and promoted with the rest. If it still describes the item, say so to ` +
        `the user, who can re-affirm it with \`mycontext edit ${item.id} --summary "<the same ` +
        `sentence>"\`. See mycontext_help("capture").`,
      );
    }
    const proposed = contentChange(item, update, title, body, summary);
    if (proposed !== null) {
      // Nothing is dropped silently (`INV-nothing-is-dropped-silently`), and
      // nothing is applied by halves. A call that mixes a content change with
      // a change to a field a revision cannot carry has no honest outcome
      // except refusal: staging the content while applying the rest would
      // leave the item in a state neither the caller nor a human asked for
      // and report it as a success, and staging only the content while
      // dropping the rest would be the silent drop itself. On a governing
      // normative item the guard above has already refused such a call; this
      // covers the cases it does not reach — a normative DRAFT, and any
      // rationale category a user has set to `review`.
      const alsoMoved = nonContentChanges(item, update);
      if (alsoMoved.length > 0) {
        throw new Error(
          `my_context: this call to update ${item.id} mixes a content change ` +
          `(${fieldList(proposed)}) with a change to ${alsoMoved.join(', ')}, which a staged ` +
          `revision cannot carry. "${item.type}" is set to agentEdits: "review" in this project, ` +
          `so the content change would be held for a human to approve while the rest applied ` +
          `immediately — leaving ${item.id} in a state nobody asked for and calling it a ` +
          `success. Refused instead: nothing was applied and nothing was staged, and ${item.id} ` +
          `is exactly as it was. Send the two halves as separate calls — the content change will ` +
          `be staged for review, and the other change will be applied or refused on its own ` +
          `terms. See mycontext_help("capture").`,
        );
      }
      // **The escape hatch cannot be staged, and dropping it silently is the
      // one outcome that is not available.** `RevisionChanges` carries text —
      // title, body, summary, tags, extra — and `summaryUnchanged` is not text
      // but an assertion ABOUT this write: that the content moved and the
      // sentence describing it did not. A revision has nowhere to put that, so
      // letting the call through would stage the body, drop the assertion, and
      // land a promoted body against a basis nobody re-stamped — a summary
      // reading stale after a human approved a change that was said not to
      // change what the item means, with no record anywhere of who said so.
      //
      // Refused rather than applied-anyway for `alsoMoved`'s reason directly
      // above, and the remedy is the same shape: send the sentence. A summary
      // IS stageable, so the call that carries one is held and promoted whole.
      if (input.summaryUnchanged === true) {
        throw new Error(
          `my_context: this call to update ${item.id} says the summary is unchanged, and ` +
          `"${item.type}" is set to agentEdits: "review" in this project — so the content ` +
          `change (${fieldList(proposed)}) is held for a human to approve, and a staged ` +
          `revision has nowhere to carry "the summary still describes this". The assertion ` +
          `would be dropped and the promotion would land the new text under a summary nobody ` +
          `re-stamped. Refused instead: nothing was applied and nothing was staged, and ` +
          `${item.id} is exactly as it was. Send the change with a "summary" — a summary IS ` +
          `stageable, so it is held and promoted together with the rest — or ask the user, who ` +
          `can use \`mycontext edit ${item.id} --summary-unchanged\`. ` +
          `See mycontext_help("capture").`,
        );
      }
      const result = stageRevision(ctx, item.id, proposed, origin);
      // Staging is itself an auditable act: it is the record that an agent
      // proposed a change to a governing item, which is exactly the kind of
      // thing "what did this session do" has to be able to answer. The
      // proposed TEXT is not duplicated here — it is already in the revision
      // log, which is the store for it; the audit log records that it
      // happened, to which item, in which fields, by whom. A duplicate
      // re-stage records nothing, because nothing was appended.
      const stageNote = result.duplicate
        ? ''
        : auditMutation(ctx, 'stage', origin, item.id, {
          fields: Object.keys(result.revision.changes).sort(),
          note: result.revision.revisionId,
        });
      return {
        id: item.id,
        // The item was not written. `created: false` is this interface's
        // existing spelling for "this call changed nothing" (a duplicate, an
        // already-present link), and a staged revision changed nothing about
        // the item — `status` and `filePath` below are the ones it still has.
        created: false,
        status: item.status,
        filePath: item.filePath,
        message: `${result.message}${stageNote}`,
        staged: {
          revisionId: result.revision.revisionId,
          duplicate: result.duplicate,
          alsoPending: result.alsoPending.length,
        },
      };
    }
    // proposed === null: every content field this call carried is an echo, so
    // there is nothing to stage. Fall through — a call that also moves a
    // non-content field must still do it, and one that moves nothing at all
    // must still report the same no-op it always did.
  }

  // ── THE CONTRADICTION GATE, BEFORE ANY BYTES ARE WRITTEN ────────────────
  //
  // Below the staging branch and above every assignment, and both halves of
  // that position are the design.
  //
  // **Below staging**, because a staged revision writes nothing to the item: it
  // is a proposal held for a human, and refusing it here would refuse the
  // proposal instead of the change. The PROMOTION comes back through this
  // function with `origin: 'human'` (`revision.ts`), which is where a person is
  // present to rule, and it is gated there.
  //
  // **Above the assignments**, because `item` is mutated in place a few lines
  // down and every message this function prints promises "nothing was changed".
  //
  // ── WHAT TRIGGERS IT, AND WHY EACH CLAUSE IS THERE ─────────────────────
  //
  // `basisMoves` is the same derived predicate the summary gate fires on, and
  // it is used here for that module's own stated reason: the alternative is a
  // list of fields that change what an item SAYS, and this repository has
  // measured that list being wrong eight times. A status change, a retag, a
  // scope narrowing, a pin — none of them moves a word of what the item claims,
  // and none of them can newly contradict anything.
  //
  // Two clauses stand beside it because they are the moments an item starts to
  // govern without its text moving at all, and both are otherwise a way around
  // the gate: promotion out of `draft` (which is exactly where every agent
  // capture lands, by `trustedStatus`), and pinning an item into scope with
  // `--always true`. Without them, "capture a draft, then promote it" and
  // "capture it as a note, then pin it" would each file an unexamined item into
  // force through a door the gate is standing beside.
  const alwaysAfter = update.always ?? item.always;
  const statusAfter = update.status ?? item.status;
  const contradictionGated =
    inContradictionScope(item.type, alwaysAfter) &&
    GOVERNING_STATUS[statusAfter] &&
    (basisMoves(item, update) ||
      !GOVERNING_STATUS[item.status] ||
      (alwaysAfter && !item.always));
  // Read before the assignments for `reaffirmed`'s reason one line down: it is
  // the key every verdict about this item is filed under, and it is about to be
  // overwritten by `reaffirmSummary` on exactly the write that must not lapse
  // them. See `carryVerdicts`.
  const contradictionBasisBefore = contradictionBasis(item);
  // **The write that says its meaning did not move is MEASURED against the
  // basis it had, not the one it is about to get — and this is the whole of
  // §11's no-lapse test.**
  //
  // `--summary-unchanged` and a re-affirmation both assert, in words, that this
  // edit does not change what the item MEANS; both are answered by re-stamping
  // `summary_of` onto the new content, and `carryVerdicts` re-stamps every
  // verdict with it. But `carryVerdicts` runs AFTER the write, and this gate
  // runs before — so asking it with the new basis would find every verdict
  // lapsed and refuse the write, and the carry-forward would never get to
  // happen. The pair would be raised again on a typo fix, which is precisely
  // the wall §7 exists to prevent.
  //
  // So the assertion is honoured at both ends of the write: the basis the
  // memory is looked up under is the one the item HAD, and the basis recorded
  // afterwards is the one it has. The retrieval still uses the NEW text — a
  // write that raises a candidate it has never ruled on is still refused,
  // whatever it says about its own meaning.
  const meaningHeld = update.summaryUnchanged === true || summaryReaffirmed(item, update);
  const editDraft: ContradictionDraft = {
    id: item.id,
    type: item.type,
    title: title ?? item.title,
    body: body ?? item.body,
    always: alwaysAfter,
    basis: meaningHeld ? contradictionBasisBefore : itemSummaryBasis(afterContent(item, update)),
    distinct: update.distinct ?? [],
    supersedes: update.supersedes ?? null,
  };
  const editSettled = contradictionGated
    ? contradictionCheck(ctx, editDraft, updateSurface(origin))
    : [];
  if (contradictionGated && editDraft.supersedes !== null) {
    preflightSupersede(ctx, editDraft.supersedes, origin, item.id);
  }

  // Taken immediately before the assignments, so `changedFields` below reports
  // what this call MOVED rather than what it carried — an echoed value is not
  // a change and must not appear in the audit record as one.
  const before = snapshotFields(item);
  // Read here for the same reason and it is the same reason twice over: the
  // predicate compares the summary this call carries against the one the item
  // HAS and the basis it was stamped against, and both are about to be
  // overwritten. Asked after the assignments it would answer about the item
  // this write produced, which is always "current" and always an echo.
  const reaffirmed = summaryReaffirmed(item, input);
  // What the status assignment below stood down, if it retired the item —
  // read again at the end of the call, by the message and by nothing else.
  // `movedFields` needs no help from it: the fields move on `item` before the
  // snapshot is compared, so the audit row names them on its own.
  let stoodDown: ('always' | 'severity')[] = [];

  if (title !== undefined) item.title = title;
  if (body !== undefined) item.body = body;
  if (update.scope !== undefined) item.scope = update.scope.map((g) => normalizePosix(g));
  // The projected list when this call moved a projected field, and the
  // caller's own list otherwise — see the projection above for why an
  // outright assignment is what makes passing `input.tags` into it mandatory.
  if (update.tags !== undefined) item.tags = update.tags;
  if (update.severity !== undefined) item.severity = update.severity;
  if (update.always !== undefined) item.always = update.always;
  if (update.continuity !== undefined) item.continuity = update.continuity;
  if (update.status !== undefined) {
    // ── RETIRING AN ITEM STANDS IT DOWN HERE TOO, FOR `validUntil`'S REASON ──
    //
    // `supersedeItem` is not the only way to retire something, and the line
    // below already says so about ONE field: whichever path reaches "retired",
    // `validUntil` moves with it, or `update_item({status: 'deprecated'})`
    // becomes a second, divergent way to be retired. `always` and `severity`
    // are the same sentence about two more fields, and until this block they
    // were left behind on FOUR supported commands — `mycontext edit <id>
    // --status deprecated`, `review discard`, `procedure done` and `inbox
    // promote` all reach retirement through `updateItem` and not through
    // `supersedeItem`. Measured on a sandbox 2026-09-10: a pinned, hard rule
    // deprecated through `updateItem` came out `deprecated` with `always:
    // true` and `severity: "hard"` intact — which is precisely the state
    // `doctor`'s `retired_still_binding` reports, so the product was still
    // manufacturing its own findings after the seven were cleared.
    //
    // ONLY ON THE CROSSING, and never on a write to an item already retired.
    // That is `supersedeItem`'s own ruling (see its idempotent early return):
    // the stand-down belongs to the ACT of retiring, and a later edit to a
    // long-deprecated item performs no such act — quietly repairing one there
    // would be a corpus edit nobody asked for, hidden inside an unrelated
    // write. `retired_still_binding` is where those surface, for a person.
    //
    // `validated` is outside `STOOD_DOWN_STATUSES` and so is not a crossing:
    // it means a human AFFIRMED the item, and on an affirmed item `hard` and a
    // pin are a claim a person made. The constant carries the measurement.
    const retiring = STOOD_DOWN_STATUSES.has(update.status)
      && !STOOD_DOWN_STATUSES.has(item.status);
    item.status = update.status;
    // Whichever write path retires an item, `validUntil` must move with it —
    // `supersedeItem` establishes this invariant at its own retirement point,
    // and a direct `update_item({status: 'deprecated'})` must not be a second,
    // divergent way to reach "retired" that leaves it null. It moves in BOTH
    // directions: see `stampValidUntil` for what the field is and why an
    // un-retired item must not keep the stamp.
    stampValidUntil(item);
    if (retiring) {
      // Read AFTER the `always`/`severity` assignments above, so it is the
      // item this write LEAVES that is measured rather than the one it found.
      // `mycontext edit <id> --status deprecated --severity hard` therefore
      // retires and stands down in one act instead of landing a retired item
      // that still binds: a call asking for both is asking for two things that
      // cannot both be true, and the stand-down is the half that is not
      // silent — it says so in the message and records itself on the item.
      stoodDown = standDownFields(item);
      if (stoodDown.length > 0) {
        item.always = false;
        item.severity = 'soft';
        item.observations.push(...normalizeObservations([{
          // `retirement`, NOT `supersedeItem`'s `supersession`, and the
          // difference is the truth about this act: nothing replaced this
          // item. A `supersession` category here would assert a successor
          // that does not exist, on the one file a reader asking "what
          // happened to this?" has open.
          category: 'retirement',
          text: standDownNote(stoodDown, `its status was set to "${item.status}"`),
          tags: [],
          context: null,
        }]));
      }
    }
  }
  if (update.extra !== undefined) item.extra = { ...item.extra, ...update.extra };

  // **LAST of the assignments, and the position is the mechanism.**
  //
  // `stampSummary` records the basis by hashing the item's summarised content
  // as it stands, so it has to run after `title`, `body` and `extra` have
  // already moved. An edit that rewrites the body AND supplies a new summary
  // therefore lands a summary that is `current`; an edit that rewrites only
  // the body does not reach this line at all, leaves the old basis in place,
  // and the summary is measurably STALE from that moment.
  //
  // `''` clears — see `UpdateInput.summary`. Nothing here refreshes a basis on
  // its own: a write that carries no summary must not touch either field, or
  // every unrelated edit would silently re-bless a summary that no longer
  // describes the item, which is the one outcome this whole field exists to
  // make impossible.
  if (summary !== undefined) reviseSummary(item, summary === '' ? null : summary, today());
  // The escape hatch (`UpdateInput.summaryUnchanged`), and it is `else if`
  // rather than a second statement: a call carrying both instructions is
  // refused at the surfaces that accept them (`summaryUnchangedRefusal`), and
  // an ordering here that silently preferred one would be a second, quieter
  // answer to the question that refusal exists to ask.
  //
  // Guarded on there BEING a summary, and the guard has a different meaning
  // now that the hatch is reachable on an item with none. There, the flag is
  // not saying "the sentence still stands" — there is no sentence — but "this
  // item is being left without one, deliberately", which is an assertion with
  // nothing on disk to write. `reaffirmSummary` would be a no-op on it anyway
  // (`stampSummary(item, null)` sets `summaryOf` to null, which it already is),
  // so skipping it says the same thing more plainly: the whole effect of the
  // hatch on an unsummarised item is the audit note below.
  else if (input.summaryUnchanged === true && item.summary !== null) reaffirmSummary(item);

  const moved = movedFields(before, item);
  // `bodyWritten` is what lets `persist` decide whether this item is still a
  // snapshot of the file it names (`reconcileSnapshot`, core/persist.ts). It
  // says the call CARRIED a body, not that the body moved — an item whose
  // `source_checksum` was already re-stamped from an authored body is repaired
  // by re-writing its own text, which moves nothing.
  persist(ctx, item, body === undefined ? undefined : { bodyWritten: true });
  const audited = auditMutation(ctx, auditOp, origin, item.id, {
    fields: moved,
    // **The escape hatch's record.** The point of the flag is that a summary
    // was NOT rewritten across an edit that changed what the item says, and an
    // unrecorded exemption is indistinguishable from nobody having noticed. A
    // `note` rather than a field, on `AUDIT_PROTOCOL`'s own terms — it is
    // short, non-content and greppable, exactly like a discard reason or
    // `step 3` — and it cannot go in `fields`, which means "what this write
    // moved": `summary` did not move, and saying it did would make the audit
    // log disagree with the item's own history.
    //
    // **`summary-reaffirmed` is the sibling record, and it is a SECOND note
    // rather than this one reused.** Both say "nobody wrote a new sentence",
    // and they say it about different acts: the hatch certifies that an EDIT
    // was mechanical, a re-affirmation certifies that somebody read the ITEM
    // and found the sentence still true. One note for both would make the log
    // unable to answer either question. They cannot co-occur — `summary` beside
    // the hatch is refused at both authored surfaces — so the chain never has
    // to choose between them. See `SUMMARY_REAFFIRMED_NOTE`.
    //
    // Here too `fields` is right to stay silent: a re-affirmation moves
    // `summaryOf` alone, which `AUDITED_FIELDS` deliberately does not carry
    // (persist.ts), so on a bare re-affirmation the row names no field and the
    // note is the entire record of what happened. That is exactly why it has
    // to exist: without it the row is indistinguishable from a write that did
    // nothing.
    //
    // **And a third note, chosen by what happened rather than by what was
    // typed.** The hatch on an item that HAS a summary certifies that the
    // sentence still stands: `summary-unchanged`. The same flag on an item that
    // has none certifies something else — that the item is being left with no
    // summary on purpose — and that is `summary-omitted`, the identical
    // assertion `--summary-omitted` makes at capture. Recording both as
    // `summary-unchanged` would make the log unable to answer "which items are
    // still carrying no summary, and did anyone mean it", which is the question
    // the whole opt-out exists to keep answerable. `item.summary` is read AFTER
    // the assignments above on purpose: it is the state this write LEAVES, and
    // a call that both cleared the summary and passed the hatch cannot reach
    // here — `summaryUnchangedRefusal` refuses that pair at both surfaces.
    ...(input.summaryUnchanged === true
      ? { note: item.summary === null ? SUMMARY_OMITTED_NOTE : SUMMARY_UNCHANGED_NOTE }
      : reaffirmed ? { note: SUMMARY_REAFFIRMED_NOTE } : {}),
  });

  // §7, after the write and never before it: a refusal upstream promises
  // "nothing was changed", and a verdict recorded beside a write that then
  // failed would silence a pair on the strength of an act that never happened.
  if (editSettled.length > 0) {
    recordVerdicts(
      ctx, { id: item.id, basis: contradictionBasis(item) }, editSettled, editDraft, origin,
    );
  }
  // Carried into the message rather than discarded, for `createItem`'s stated
  // reason: an edit that also retired another item said only "updated <id>",
  // so the act nobody can undo was the one act the surface did not report.
  const retirement =
    editDraft.supersedes !== null && editSettled.some((c) => c.id === editDraft.supersedes)
      ? supersedeItem(ctx, {
        id: editDraft.supersedes, by: item.id, origin,
        reason: `settled by the contradiction gate on an edit: ${item.id} replaces it`,
      })
      : null;
  const retired = retirement === null
    ? ''
    : ` ${retirement.message.replace(/^my_context: /, '')}`;
  // **The no-lapse half of §7.** The escape hatch and the re-affirmation are
  // the two ways of saying "this write did not change what the item MEANS",
  // and both re-stamp `summary_of`. Every verdict about this item is keyed to
  // that stamp, so they are re-stamped with it — see `carryVerdicts` for why
  // that is the summary's own mechanism rather than a second, quieter ruling.
  if ((input.summaryUnchanged === true && item.summary !== null) || reaffirmed) {
    carryVerdicts(ctx, item, contradictionBasisBefore);
  }

  return {
    id: item.id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message:
      `my_context: updated ${item.id} (${item.status}).${inertFieldNote(ctx, item)}`
      // Before `retired`, because they are different acts on different items
      // in the order they happened: this one is what THIS write did to THIS
      // item, and `retired` is `supersedeItem`'s message about the OTHER item
      // the contradiction gate disposed of.
      + `${standDownSaid(stoodDown, item.id)}${retired}${audited}`,
  };
}

/** The code of a doctor finding, and the item it was reported on. */
export interface AcknowledgeInput {
  id: string;
  /** `Finding.code` — `body_disagrees_with_meta`, `summary_stale`, and so on. */
  code: string;
  /** `false` withdraws an acknowledgement. Defaults to making one. */
  on?: boolean;
  /**
   * Only `'human'` is accepted, and the refusal is the ruling itself: a
   * finding is "distinguishable because a person looked", so an origin that is
   * not a person has nothing to record. See `acknowledgeFinding`.
   */
  origin?: Origin;
}

/**
 * A finding shape: lowercase, digits and underscores, which is what every
 * `Finding.code` in `doctor/checks.ts` is.
 *
 * Checked here rather than against a list of the codes that exist, and the
 * difference matters in both directions. A list would have to be imported from
 * `doctor/`, which `core/` does not depend on and should not; and it would make
 * this module refuse a code a check added yesterday. What the CLI does instead
 * is stronger than either: it refuses a code that is not CURRENTLY REPORTED on
 * this item, which is a fact about this corpus rather than about a list — see
 * `cmdAck`.
 */
const FINDING_CODE = /^[a-z][a-z0-9_]*$/;

/**
 * **A person records having ruled on a doctor finding** (owner ruling
 * 2026-08-27 — the mechanism, the anchor and the limits are all argued on
 * `core/acknowledge.ts`).
 *
 * Its own entry point rather than a field on `UpdateInput`, and the separation
 * is deliberate three times over. An acknowledgement is not content: it says
 * nothing about what the item asserts, so it must not be staged as a revision,
 * must not be routed by `agentEdits`, and must not be classified by
 * `UPDATE_FIELD_POLICY` — whose `satisfies Record<keyof UpdateInput, …>` clause
 * would have had to grow a row for a field that is neither `content` nor
 * `gated`. It is also not `gated`: nothing about it changes what governs.
 *
 * **`origin: 'human'` is required, not defaulted-and-forgotten.** The ruling is
 * that nothing is silenced by the machine, only by a person, and that sentence
 * is only true if the write refuses the machine. There is deliberately no MCP
 * tool for this; an agent that wants a finding settled has to get a person to
 * settle it.
 *
 * The anchor is stamped LAST, after `requireWritableItem` has resolved the
 * item, so it is taken over the content the person is actually looking at.
 * Audited as an `update` carrying the one field it moves: a new `MutationOp`
 * would renumber a vocabulary the CLI, the MCP tool enum and the UI all read
 * from an appended-never-inserted list, for no gain — this IS an update to the
 * item, and `fields: ['acknowledged']` says which one.
 */
export function acknowledgeFinding(ctx: MutationContext, input: AcknowledgeInput): MutationResult {
  const origin: Origin = input.origin ?? 'human';
  if (origin !== 'human') {
    throw new Error(
      `my_context: only a person can acknowledge a doctor finding, and this call carried ` +
      `origin "${origin}". An acknowledgement records that somebody READ the finding and ruled ` +
      `on it; a machine recording that about itself would turn the report into a report of what ` +
      `the machine has decided to stop mentioning. Run \`mycontext ack ${input.id} ` +
      `${input.code}\` as the person who read it.`,
    );
  }
  if (!FINDING_CODE.test(input.code)) {
    throw new Error(
      `my_context: "${input.code}" is not a doctor finding code. A code is lowercase letters, ` +
      `digits and underscores — "body_disagrees_with_meta", "summary_stale" — and is printed in ` +
      `every line of \`mycontext doctor --full\`.`,
    );
  }

  const item = requireWritableItem(ctx, input.id);
  const on = input.on ?? true;
  const before = acknowledgementState(item, input.code);

  if (on) {
    // Re-stamping a `lapsed` acknowledgement is a real change and lands as one:
    // the person read the item again. Re-stamping a `current` one is a no-op on
    // disk, and is reported as one rather than written — see the return below.
    if (before === 'current') {
      return {
        id: item.id, created: false, status: item.status, filePath: item.filePath,
        message:
          `my_context: ${item.id} already acknowledges "${input.code}" against its current ` +
          `content. Nothing was written.`,
      };
    }
    stampAcknowledgement(item, input.code);
  } else if (!clearAcknowledgement(item, input.code)) {
    return {
      id: item.id, created: false, status: item.status, filePath: item.filePath,
      message:
        `my_context: ${item.id} carries no acknowledgement of "${input.code}". Nothing was ` +
        `written.`,
    };
  }

  persist(ctx, item);
  const audited = auditMutation(ctx, 'update', origin, item.id, { fields: ['acknowledged'] });
  /**
   * **THE SENTENCE AFTER THE VERB DEPENDS ON THE VERB, and it used not to.**
   *
   * One trailing sentence was appended to BOTH outcomes: *"The finding is still
   * reported and still counted — it is reported as acknowledged. Editing the
   * item's content lapses this, and the finding is open again."* On `--clear`
   * every clause of that is false — the acknowledgement was just withdrawn, so
   * the finding is reported as OPEN, and there is nothing left for an edit to
   * lapse. A withdrawal that reports itself as an acknowledgement is the
   * failure `STD-a-refusal-names-what-would-make-it-succeed`'s neighbour rule
   * exists for: a message that contradicts the act it just performed.
   *
   * Found 2026-09-07 by EXECUTING `ack --clear` from the Composer and reading
   * what came back (`plan:builder seq:11`, the write half), which is the whole
   * argument for that item's bar — the composed line was right, the exit code
   * was 0, and the sentence was wrong.
   */
  const said = on
    ? `${before === 'lapsed'
      ? `re-acknowledged "${input.code}" (the previous ruling had lapsed — the item's content `
        + 'had moved under it)'
      : `acknowledged "${input.code}"`}`
      + '. The finding is still reported and still counted — it is reported as acknowledged. '
      + "Editing the item's content lapses this, and the finding is open again."
    : `withdrew the acknowledgement of "${input.code}". The finding is reported as OPEN again `
      + 'from here; it was never silenced, and nothing about the item itself changed.';
  return {
    id: item.id,
    created: false,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: ${item.id} ${said}${audited}`,
  };
}

/**
 * Never deletes and never drops content (spec §10): the retired item keeps
 * its file, body, observations and existing relations — `status` and
 * `validUntil` move, one relation is added, and the item is STOOD DOWN.
 *
 * ── STANDING DOWN IS PART OF RETIRING, NOT A SECOND CALL ────────────────────
 *
 * `always: true` and `severity: 'hard'` are cleared here, in the same act, for
 * exactly the reason both relation directions are written here rather than
 * left to a caller: two things that must always be true together must not be
 * two calls that can diverge. Until 2026-09-08 they were, and the corpus had
 * measured the divergence — 60 retired items, of which SEVEN still carried
 * `severity: hard` (two open questions, a requirement and three known issues)
 * and one, `RULE-delegate-to-subagents-by-default-to-preserve-the-context`,
 * was superseded and still `always: true`.
 *
 * **This was never a delivery bug and the fix is not for one.** `isEligible`
 * (select.ts) filters `RETIRED_STATUSES` out before a pin can matter, so the
 * first tier held the whole time — which is why nobody noticed. What the
 * fields do is SURVIVE AS DATA, read by counts, reports, the pinned-set review
 * and anything written later by somebody who reasonably assumes a pinned item
 * is a live one. See `standDownFields` (select.ts), which owns the predicate
 * so `doctor`'s `retired_still_binding` asks the identical question of the
 * items retired before this existed.
 *
 * It is PROSPECTIVE: this function stands down what it retires and repairs
 * nothing it finds. See the idempotent early return for why.
 *
 * BOTH directions are written. The `supersedes` edge goes onto the
 * *replacement*, so the surviving item carries the pointer to its own history
 * (spec §3.2 file format); the mirroring `superseded_by` edge goes onto the
 * retiree, because `STD-answered-questions-are-superseded` requires an
 * answered item to name what answered it, and because a reader who opens a
 * `superseded` file otherwise has no way to reach the replacement short of
 * scanning the corpus for whichever item points back. `superseded_by` is not
 * in `RELATION_TYPES` and cannot be forged through `link_items` — see the
 * constant's doc comment for why that omission is the guard.
 *
 * Note for future work (logged, not fixed here): a superseded item is still
 * a *content* duplicate as far as `createItem`'s dedup lookups are
 * concerned, so re-capturing the same text after a supersede returns
 * "already captured" pointing at the now-dead item. Nothing in this
 * function changes `createItem`'s dedup keys, so it does not make that
 * pre-existing gap any wider.
 */
/**
 * **The sentence a stood-down field leaves behind on the item itself.**
 *
 * `INV-nothing-is-dropped-silently` in its standing form: an item that was
 * pinned mattered enough for somebody to pin it, so a reader who later wonders
 * why a once-pinned rule is quiet gets an answer on the file rather than a
 * mystery plus an audit log they would have to know to go looking in. The
 * audit row records the same act for a machine; this records it for a person
 * reading the item.
 *
 * On the RETIREE, not the replacement — unlike the supersede `reason`, which
 * goes on the replacement because it explains what the SUCCESSOR is for. This
 * explains what happened to THIS item, and the retiree is the only file a
 * reader who asks that question has open.
 *
 * The date is `today()`, the same stamp `validUntil` takes in the same act, so
 * the two cannot disagree about when the retirement happened.
 *
 * Shape constraints, all of them enforced by `validateObservationText`: one
 * line, no "#word" away from the end, and it must not END in a parenthetical
 * (which the reader would silently lift into the observation's `context`
 * field). The closing clause is prose for that last reason and not decoration.
 */
function standDownNote(fields: readonly ('always' | 'severity')[], cause: string): string {
  const clauses = fields.map((f) => (f === 'always'
    ? 'the pin was cleared, so "always" is now false and it no longer asks to be injected every session'
    : 'the binding severity was dropped, so "severity" is now "soft" instead of "hard"'));
  return (
    `Stood down on ${today()} when ${cause}: ${clauses.join('; and ')}. ` +
    `Nothing else was changed and nothing was deleted — a retired item keeps its file, its body, ` +
    `its observations and its relations, and stops claiming to govern.`
  );
}

/**
 * **What the person standing here is TOLD, on either retirement path.**
 *
 * The observation and the audit row are for a reader who comes back later;
 * this is for the person who asked to retire an item and would otherwise learn
 * only from a diff that the same act unpinned it. It is one function for the
 * reason `standDownFields` is one predicate and `supersedeQuestion` is one
 * sentence: `supersedeItem` and `updateItem` both stand an item down now, and
 * two hand-kept spellings of "it was also stood down" is how the two surfaces
 * come to describe the same act differently.
 *
 * EXPORTED for `mycontext review discard`, which composes its own sentence
 * instead of printing `updateItem`'s and would otherwise stand a pinned draft
 * down without a word — the same shape of defect as `add --supersedes`
 * retiring an item and printing nothing, which is why the answer is this
 * function rather than a third wording over there.
 */
export function standDownSaid(fields: readonly ('always' | 'severity')[], id: string): string {
  if (fields.length === 0) return '';
  const said = fields
    .map((f) => (f === 'always' ? '"always" is now false' : '"severity" is now "soft"'))
    .join(' and ');
  return ` It was also stood down: ${said}, recorded as an observation on ${id}.`;
}

export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {
  if (input.id === input.by) {
    throw new Error(`my_context: ${input.id} cannot supersede itself.`);
  }
  // `input.id` is about to be written verbatim as the REPLACEMENT's new
  // `supersedes` relation target (`replacement.relations.push` below) —
  // guarded here even though `createItem` now refuses to mint a malformed id
  // in the first place, because this function's own contract (retiring `id`)
  // is what actually performs the write that would silently corrupt on
  // read-back; defending only the mint site and not the write site is the
  // same "fixed in one place, live in the next" gap this review round found.
  validateRelationTarget(input.id, '"id"');
  // `input.by` is now written verbatim too, as the RETIREE's `superseded_by`
  // target, for exactly the reason the line above guards `input.id`. Before
  // the back-reference existed, `by` was only ever read (via
  // `requireWritableItem`) and never rendered into a `[[...]]` link, so it
  // needed no such check; it does now, and a guard on one side of a pair of
  // mirrored writes is the "fixed in one place, live in the next" gap again.
  validateRelationTarget(input.by, '"by"');

  const origin: Origin = input.origin ?? 'human';
  // The pass cannot retire anything either — see `reviewNeverEditsError`, and
  // note this is WIDER than the `governsNormatively` refusal below: that one
  // protects items that currently govern, and this one also covers superseding
  // a draft, which every other non-human origin is allowed to do.
  if (origin === 'review') throw reviewNeverEditsError('supersede', input.id);
  validateEnums(input);
  // `reason` becomes the text of an observation on the replacement (below),
  // so it goes through the same round-trip guard as any other observation
  // text — otherwise a reason like "see #4521" is silently shredded into a
  // tag on the way back off disk.
  if (input.reason) validateObservationText(input.reason, 'the supersede reason');

  const retired = requireWritableItem(ctx, input.id);
  const replacement = requireWritableItem(ctx, input.by);

  // The second route to the demotion `updateItem` refuses: retiring a
  // GOVERNING normative item (one currently `active` or `validated`) stops
  // it from being injected, exactly like a non-human caller editing its
  // status directly — so it gets the same refusal. Widened to `!== 'human'`
  // for the same reason `trustedStatus` and `updateItem`'s guards are:
  // `'ingest'` reaches this tool exactly the way `'agent'` does, and batch
  // ingestion (spec §7.2) retiring a human's governing constraint is the
  // same hazard as an agent doing it interactively. Narrow on purpose: a
  // non-human caller superseding its own `draft` (never governed anything),
  // an already `deprecated`/`superseded` item, or any rationale-tier item is
  // harmless and stays allowed — a later task legitimately supersedes one
  // agent- or ingest-authored draft with another.
  if (origin !== 'human' && governsNormatively(ctx, retired)) {
    throw new Error(
      `my_context: a non-human caller cannot supersede a governing normative item. ${retired.id} is ` +
      // Deliberately not "and still governs": only `active` is actually
      // eligible for selection (`isEligible` in select.ts, which classifies
      // `validated` as retired). `validated` is protected here because a
      // human affirming an item must not make it *easier* for an agent to
      // retire, but the message must not claim it is being injected.
      `currently "${retired.status}", a status only a human sets; retiring it is a human ` +
      `decision. Superseding a draft, deprecated or already-superseded item — or any rationale ` +
      `item — is unaffected. See mycontext_help("capture").`,
    );
  }

  const alreadyWired = replacement.relations.some(
    (r) => r.type === 'supersedes' && r.target === retired.id,
  );
  // The mirror of `alreadyWired`, tracked separately rather than assumed to
  // follow from it: every item superseded before this back-reference existed
  // has the forward edge and not this one, and so does any item whose file a
  // human hand-edited. Folding the two into one flag would make the
  // early-return below permanently swallow the repair — the pair would be
  // reported "already superseded" and the missing half never written.
  const backWired = retired.relations.some(
    (r) => r.type === SUPERSEDED_BY && r.target === replacement.id,
  );
  // NOT a stand-down point, deliberately: this return's own message says
  // "already superseded ... Nothing changed", and clearing a field here would
  // make that sentence false. The stand-down is PROSPECTIVE — it belongs to
  // the act of retiring, and this call performs no act. Items retired before
  // it existed are surfaced by `doctor`'s `retired_still_binding` instead,
  // where a person can rule on each one; a repeat `supersede` quietly
  // repairing them would be a corpus edit nobody asked for, hidden inside a
  // no-op.
  if (alreadyWired && backWired && retired.status === 'superseded') {
    return {
      id: retired.id,
      created: false,
      status: retired.status,
      filePath: retired.filePath,
      message: `my_context: ${retired.id} is already superseded by ${replacement.id}.`,
    };
  }

  // ── AT MOST ONE `superseded_by`, AND THE RETURN ABOVE IS NOT THAT GUARD ──
  //
  // It fires only when `alreadyWired && backWired` — both halves, for the SAME
  // pair. Superseding an already-retired item with a DIFFERENT replacement
  // matches neither flag, so it fell straight through and APPENDED a second
  // `superseded_by` to an item that already had one. The file then asserts two
  // successors: the graph draws both, a reader of the retired item is offered
  // two answers to "what replaced this", and nothing in the product can say
  // which is current. That edge is the ONLY route from a retired item to its
  // replacement — `STD-answered-questions-are-superseded` is why it is
  // written at all — so an ambiguous one costs as much as a missing one.
  //
  // REFUSED rather than repaired, and the refusal names the successor already
  // recorded. Re-pointing a retirement is a decision about what replaced what,
  // and this call has no way to take it: nothing in the input distinguishes
  // "the earlier record was wrong" from "there is a newer replacement", and
  // those want opposite outcomes.
  //
  // `supersedes` is deliberately NOT capped the same way, and the asymmetry is
  // the truth about retirement rather than an oversight: ONE replacement
  // legitimately retires SEVERAL items — a rule that answers four open
  // questions is the ordinary case — so a cap on that side would refuse real
  // supersessions. The cardinality belongs on the RETIREE, where the question
  // "what replaced this?" has exactly one answer.
  //
  // The remedy offered is the only true one. `mycontext edit --unlink` refuses
  // both retirement edges by name (`retirementEdgeRefusal`, core/relations.ts),
  // so the recorded edge cannot simply be taken off; what CAN be done, and what
  // models the situation correctly, is to retire the recorded successor by the
  // new one, leaving a chain a reader can follow end to end.
  const successorRefusal = existingSuccessorRefusal(retired, replacement.id);
  if (successorRefusal !== null) throw new Error(successorRefusal);

  // ── RETIREMENT STANDS THE ITEM DOWN, IN THE SAME ACT ───────────────────
  //
  // See `standDownFields` for what moves and why it moves HERE rather than in
  // a caller. Computed before the assignments below because the note it
  // produces has to name the values the item HAD.
  const stoodDown = standDownFields(retired);

  // Content is never removed — only the lifecycle fields move (spec §10)
  // and this one relation is ADDED. The retiree's own relations, body and
  // observations are untouched, except for the one observation the stand-down
  // adds to RECORD itself (`INV-nothing-is-dropped-silently`): a field cleared
  // with no trace is exactly the silent drop that invariant forbids, and an
  // item somebody once pinned deserves an answer to "why is this quiet now?"
  // on the item itself rather than only in the audit log.
  retired.status = 'superseded';
  retired.validUntil = today();
  if (stoodDown.length > 0) {
    retired.always = false;
    retired.severity = 'soft';
    // Through `normalizeObservations`, never pushed raw, for the reason the
    // supersede reason is: an uncollapsed string is hashed uncollapsed and
    // read back collapsed, which is a permanent checksum mismatch that
    // `doctor` reports as a hand edit.
    retired.observations.push(...normalizeObservations([{
      category: 'supersession',
      text: standDownNote(stoodDown, `${replacement.id} superseded it`),
      tags: [],
      context: null,
    }]));
  }
  if (!backWired) retired.relations.push({ type: SUPERSEDED_BY, target: replacement.id });
  persist(ctx, retired);

  if (!alreadyWired) {
    replacement.relations.push({ type: 'supersedes', target: retired.id });
    // Guarded by the same `alreadyWired` check as the relation push, not by
    // `input.reason` alone: a repeat supersede after a human resets the
    // retiree's status back (so the idempotent early-return above no longer
    // applies) must not append a second copy of the same observation just
    // because the relation was already there.
    if (input.reason) {
      // Through `normalizeObservations`, not pushed raw: a reason carrying a
      // double space (routine after a sentence-ending period), a tab or a
      // non-breaking space would otherwise be stored uncollapsed, hashed
      // uncollapsed, and read back collapsed — a permanent checksum mismatch
      // on the REPLACEMENT, reported by `doctor` as if a human had edited the
      // file by hand. The text is re-validated on the way through, which is
      // redundant with the `validateObservationText(input.reason, ...)` call
      // above only for the shapes that call already refuses; the prefix this
      // adds ("Replaces X: ") is itself unvalidated text otherwise.
      replacement.observations.push(...normalizeObservations([{
        category: 'supersession',
        text: `Replaces ${retired.id}: ${input.reason}`,
        tags: [],
        context: null,
      }]));
    }
  }
  persist(ctx, replacement);

  // ONE record for the pair, on the item that was retired — the act is
  // "X was superseded by Y", not two independent edits. `note` carries the
  // replacement so a reader of the log never has to correlate two lines to
  // learn what replaced what.
  const audited = auditMutation(
    ctx, 'supersede', input.origin ?? 'human', retired.id,
    // `stoodDown` is spread rather than always listed: `fields` means "what
    // this write MOVED", and naming `always` on a retirement that found it
    // already false would put an echo in the log — the same reason
    // `snapshotFields`/`movedFields` exist for `updateItem`.
    {
      fields: ['status', 'relations', 'validUntil', ...stoodDown],
      note: `by ${replacement.id}`,
    },
  );

  // ── WHICH TESTS REST ON IT, ASKED WHEREVER RETIREMENT IS REACHED ────────
  //
  // `plan:contra seq:2` / design §8. The owner's ruling is that every test
  // relying on a superseded item must be updated or deleted, and the reason it
  // cannot be a scanner was measured: of the 26 fixtures `budget/16` reddened,
  // ZERO named the rule they rested on. So the question is asked at the one
  // moment a person knows the answer, and it is asked HERE rather than in
  // `cli/commands/supersede.ts` alone, because this function is every door
  // into retirement-with-a-successor — `mycontext supersede`, `add
  // --supersedes`, `edit --supersedes`, MCP `supersede_item` and
  // `ingest/apply.ts` all arrive through it, and a question asked on one door
  // is the "fixed in one place, live in the next" gap this file keeps naming.
  //
  // BOTH ITEMS' SCOPES are consulted, in §8's own order of preference: the
  // cheapest version of the answer needs no new field at all, because "the
  // successor's existing `scope` can carry the test paths". The retiree's is
  // read too — it is where the answer would already be if anybody recorded it
  // before the retirement.
  //
  // IT CANNOT FAIL THE WRITE. Not "does not today" — cannot: the call is
  // wrapped, and a tree that cannot be walked costs a sentence rather than a
  // retirement. §8 requires that in as many words, and `restingTestsSaid`
  // carries the reason to the reader.
  let restingSaid = '';
  try {
    restingSaid = restingTestsSaid(
      retired.id,
      testsRestingOn(path.dirname(ctx.root), retired.id, [retired, replacement]),
    );
  } catch {
    restingSaid = '';
  }

  return {
    id: retired.id,
    created: true,
    status: retired.status,
    filePath: retired.filePath,
    message:
      `my_context: ${retired.id} is now superseded by ${replacement.id}. ` +
      `Nothing was deleted — the file remains and the item stays searchable.` +
      restingSaid +
      // SAID, not merely recorded — see `standDownSaid`, which is where the
      // sentence lives so that this path and `updateItem`'s cannot spell the
      // same act two ways.
      `${standDownSaid(stoodDown, retired.id)}${audited}`,
  };
}
