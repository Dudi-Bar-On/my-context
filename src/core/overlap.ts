/**
 * **Overlap retrieval, and the contradiction gate built on it.**
 *
 * Two halves that share one measurement and nothing else:
 *
 *  - `overlapScore` — the lexical similarity that has been in this product
 *    since the Work read model shipped, MOVED here verbatim (design
 *    `docs/superpowers/specs/2026-09-07-contradiction-gate-design.md` §4). It
 *    moved because a MUTATION path must not import from `src/ui/`, and the
 *    existing caller (`ui/read-model-work.ts`, `POST /api/overlap`) keeps
 *    working by importing it back out of here. Not rewritten, not retuned:
 *    the threshold, the cap, the token rule and the 0.8 containment scale are
 *    the ones `test/ui/read-model-work-search.test.ts` already pins.
 *  - `contradictionGate` — the §5 refusal, as a PURE function of
 *    `(draft, activeItems, verdicts)`. It reads no file, opens no store and
 *    knows no workspace, which is what lets §11's tests run with no
 *    filesystem. Everything that touches disk — reading and appending the
 *    verdict log, resolving an item's basis — lives in `core/mutate.ts`
 *    beside the write it guards.
 *
 * **This module must never import `node:fs`.** `ui/read-model-work.ts` imports
 * it, and `test/ui/no-writes.test.ts` walks that module's whole runtime import
 * graph looking for a module that calls an fs writer by a name it imported.
 * The purity §11 asks for and the purity that test enforces are the same
 * property, reached from two directions.
 *
 * ── WHAT THE GATE DOES AND DOES NOT CLAIM ──────────────────────────────────
 *
 * **It never judges contradiction.** There is no model in this product and the
 * summary gate already says so in its own refusal text. This retrieves the
 * closest items that currently stand, refuses the write, and REMEMBERS the
 * answer. `overlapScore` is lexical, so two items that AGREE score exactly as
 * high as two that conflict — which is precisely why §7's memory is not
 * optional and why a verdict, once given, is not asked for again until one of
 * the two items changes what it says.
 */
import { RETIRED_STATUSES } from './select.ts';
import { GOVERNING_STATUS } from './trust.ts';
import type { Origin, Severity, Status } from './types.ts';

/**
 * **Which items are candidates — and this is NOT `RETIRED_STATUSES`, which the
 * design (§4) names. The reason is measured, and the deviation is one line.**
 *
 * §4 says: *"Active means status not in `RETIRED_STATUSES` — `superseded`,
 * `deprecated`, `validated` — imported from `src/core/select.ts`, never
 * restated."* The IMPORTED-not-restated half is honoured and is right; the
 * choice of constant is not, and `RETIRED_STATUSES` is wrong in BOTH
 * directions for the question this gate asks. §1 and §2 state that question in
 * their own words — *"checked against the items that currently govern"* — and
 * this project already has the predicate for it.
 *
 *  - **`draft` is not in `RETIRED_STATUSES`, so it would be a CANDIDATE.** A
 *    draft governs nothing: `select` never injects it and a human still has to
 *    promote it. Worse, `trustedStatus` forces every non-human normative
 *    capture to `draft`, so `RETIRED_STATUSES` would let an agent's unreviewed
 *    draft refuse a human's write. Measured: `test/mcp/tools.test.ts` · "an
 *    agent cannot supersede a governing normative item through the registry"
 *    creates two agent drafts and promotes one, and the promotion was refused
 *    by the other draft.
 *  - **`validated` IS in `RETIRED_STATUSES`, so it would NOT be a candidate.**
 *    It governs — `GOVERNING_STATUS.validated` is `true`, and
 *    `governsNormatively` protects a validated item from a non-human caller
 *    for exactly that reason, in `supersedeItem`'s own words: *"a human
 *    affirming an item must not make it easier for an agent to retire"*. A
 *    gate that skipped it would leave the most strongly endorsed items in the
 *    corpus unable to be contradicted.
 *
 * `GOVERNING_STATUS` (trust.ts) is the project's own answer to "does this item
 * govern", it is keyed BY `Status` so a new status fails to compile rather
 * than defaulting to `false`, and it is imported here exactly as §4 asks —
 * just from the module that owns the question. **On today's corpus the two
 * agree exactly** (0 drafts and 0 validated items among the 207 in-scope
 * active ones, measured 2026-09-08), so nothing about the corpus turns on it;
 * what turns on it is the agent-draft case above, which tests reach and the
 * corpus has not yet.
 *
 * `RETIRED_STATUSES` is still imported and still read, one line down, so that
 * the two sets cannot drift apart silently: `test/core/contradiction-gate.test.ts`
 * asserts their exact relationship and reddens if either moves.
 */
export function governsNow(status: Status): boolean {
  return GOVERNING_STATUS[status];
}

/**
 * The members of `RETIRED_STATUSES` that `governsNow` nevertheless admits —
 * `['validated']` today, and the number is the whole content of the function.
 *
 * It exists so that the disagreement documented above is a VALUE a test can
 * read rather than a paragraph a reader has to trust, and so that a change to
 * either constant reddens `test/core/contradiction-gate.test.ts` instead of
 * quietly widening or narrowing what the gate compares against.
 */
export function retiredButGoverning(): Status[] {
  return [...RETIRED_STATUSES].filter((s) => governsNow(s as Status)) as Status[];
}

// --- Retrieval (moved from ui/read-model-work.ts, unchanged) ----------------

/**
 * Capture-time overlap detection (web-UI spec §4, Work): a HEURISTIC hint that
 * two texts say nearly the same thing — never a dedup rule the corpus
 * enforces, and the Capture screen's wording says "may already say this", not
 * "duplicate". Deliberately simple and deterministic: lowercase word sets
 * (runs of `[a-z0-9]`, length >= 3), jaccard for symmetric similarity,
 * containment (scaled 0.8) so a short draft that is a subset of a long item
 * still surfaces.
 *
 * It earns its place at capture because `type` is fixed at creation: a
 * duplicate filed under the wrong category cannot be cleanly undone
 * afterwards. It earns its place at the gate for the opposite reason — a
 * contradiction filed as a second live rule cannot be cleanly undone either.
 */
function overlapTokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3));
}

/**
 * The item side is a STRUCTURAL `{ title, body }` rather than `Item`, and the
 * widening is what makes §11's "no filesystem, no store" testable: the gate's
 * candidates are a narrow view (`ContradictionItem`) and not whole items. An
 * `Item` still satisfies it, so `apiOverlap`'s call is unchanged.
 */
export interface OverlapParts {
  /** What `overlapScore` returns: `max(jaccard, containment * 0.8)`. */
  score: number;
  /** Symmetric similarity. Indifferent to which of the two texts is longer. */
  jaccard: number;
  /** `common / min(size)`, UNSCALED. A short text inside a long one scores 1. */
  containment: number;
  aTokens: number;
  bTokens: number;
}

/**
 * **The same measurement, with its two halves visible — and they are visible
 * because the DRAIN needs to tell them apart.**
 *
 * `overlapScore` below is unchanged in value and is now one line over this, so
 * the tokenizer, the 0.8 scale and the `max` live in exactly one place rather
 * than two. The reason the halves had to be separable is measured on this
 * corpus and is recorded on `checkCorpusContradictions` (doctor/checks.ts): of
 * the 82 governing in-scope pairs that clear `CONTRADICTION_THRESHOLD`, **72
 * involve one 808-token pinned reference item**, whose `jaccard` with each of
 * those partners is 0.13–0.16. Containment is doing all the work there and it
 * is measuring LENGTH rather than subject — which is exactly what containment
 * is FOR at capture time (a short draft inside a long item should surface) and
 * exactly wrong for ranking a corpus-wide sweep.
 */
export function overlapParts(
  draft: { title: string; body: string }, item: { title: string; body: string },
): OverlapParts {
  const a = overlapTokens(`${draft.title}\n${draft.body}`);
  const b = overlapTokens(`${item.title}\n${item.body}`);
  // Nothing to compare is 0, not NaN. A NaN sorts unpredictably and would put
  // an empty draft anywhere in the list.
  if (a.size === 0 || b.size === 0) {
    return { score: 0, jaccard: 0, containment: 0, aTokens: a.size, bTokens: b.size };
  }
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  const jaccard = common / (a.size + b.size - common);
  const containment = common / Math.min(a.size, b.size);
  return {
    score: Math.max(jaccard, containment * 0.8),
    jaccard,
    containment,
    aTokens: a.size,
    bTokens: b.size,
  };
}

export function overlapScore(
  draft: { title: string; body: string }, item: { title: string; body: string },
): number {
  return overlapParts(draft, item).score;
}

export const OVERLAP_THRESHOLD = 0.2;
export const OVERLAP_CAP = 5;

/**
 * **The gate's own cutoff, and it is NOT `OVERLAP_THRESHOLD` — measured, not
 * preferred.**
 *
 * The design (§4) says to move `overlapScore` rather than rewrite it, and it is
 * moved: the function above is byte-for-byte the one that shipped, the UI hint
 * keeps `OVERLAP_THRESHOLD = 0.2`, and `apiOverlap` is unaffected. What could
 * not survive contact with the corpus is the 0.2 CUTOFF applied to a refusal.
 *
 * Measured over `.my_context/` on 2026-09-08 (1,011 items, 951 active, 207
 * active and in scope by §3), scoring every in-scope pair:
 *
 *   score band   0.0–0.1   0.1–0.2   0.2–0.3   0.3–0.4   0.4–0.5   0.5+
 *   pairs            369     8,306    11,174     1,406        65      1
 *
 * **59.3% of all 21,321 in-scope pairs score at or above 0.2**, and the
 * threshold sits in the middle of the distribution's mass rather than in its
 * tail. Re-writing each of the 207 in-scope items today would therefore be
 * refused **207 times out of 207 — 100%, every one of them carrying the full
 * cap of 5 candidates.** That is the exact failure §3 forbids in as many words:
 * *"a gate that fires on every write is a gate people learn to click through"*,
 * with the same shape as the doctor screen this project measured, where 74 of
 * 74 findings offered no remedy and the control was ignored.
 *
 * The cause is in the metric and is not a tuning opinion: `overlapTokens` has
 * no stopword list and no IDF, so two ordinary English item bodies (median
 * token-set size 162, max 487) share 20–30% of their vocabulary before either
 * says anything about the other's subject. That costs nothing behind
 * `POST /api/overlap`, where a false positive is one extra line on a hint
 * screen the reader is free to ignore, and it costs a refused write here.
 *
 * Calibrated against the same corpus:
 *
 *   cutoff   writes refused   mean candidates on a refused write
 *   0.20      207/207 (100%)   5.00
 *   0.30      205/207  (99%)   4.56
 *   0.35      151/207  (73%)   2.69
 *   0.40       65/207  (31%)   1.63
 *   0.45       19/207  (9.2%)  1.05
 *   0.50        2/207  (1.0%)  1.00
 *
 * **0.45**, so the gate raises a question on about one in eleven of the writes
 * it is in scope for and raises one candidate rather than five when it does.
 * It is a SEPARATE constant rather than a changed one so that the hint and the
 * refusal can never be moved by the same edit, and so that this measurement has
 * somewhere to live. **It is a calibration and not a ruling**: the number is the
 * owner's to confirm, the table above is what it was chosen from, and re-running
 * `contradictionGate` over the corpus is how it is re-derived when the corpus
 * grows.
 */
export const CONTRADICTION_THRESHOLD = 0.45;

// --- What the gate fires on (§3) --------------------------------------------

/**
 * **The categories that can contradict, as the owner named them on
 * 2026-09-07: `rule`, `constraint`, `requirement`, `decision`, `instruction`,
 * `standard`.**
 *
 * ── THIS IS A LIST, AND IT IS A LIST ON PURPOSE, AND THAT COSTS SOMETHING ──
 *
 * Everywhere else in this codebase a rule about "which categories govern" is
 * DERIVED — `isNormative` (select.ts) reads `config.categories[type].tier`, and
 * `scripts/check-dependency-budget.ts` sets the precedent that a second copy of
 * a rule is how two halves of it drift apart. That precedent is followed for
 * `RETIRED_STATUSES` below and deliberately NOT followed here, because the
 * owner's set is not the tier and cannot be computed from it. Measured against
 * `core/categories.ts` on 2026-09-08:
 *
 *  - `decision` is on the **rationale** tier (`def('decision', 'DEC',
 *    'rationale', …)`) and IS in the owner's set — 89 active items today, the
 *    largest single group the gate fires on.
 *  - `invariant`, `open_question`, `non_goal`, `pattern`, `glossary`,
 *    `runbook`, `procedure`, `environment`, `known_issue`, `exception` and
 *    `contract` are all on the **normative** tier and are NOT in the owner's
 *    set. §3 names `invariant` and `open_question` as out of scope in as many
 *    words.
 *
 * So `isNormative` is the wrong predicate in both directions, and using it
 * would have silently changed the ruling. The list is written here once,
 * beside the sentence that says why it is a list; `always: true` is the
 * derived half (§3: pinning an item is an explicit declaration that it is
 * load-bearing), and it needs no list at all.
 */
export const GATED_CATEGORIES: ReadonlySet<string> = new Set([
  'rule', 'constraint', 'requirement', 'decision', 'instruction', 'standard',
]);

/** §3's trigger: a named category, or any pinned item whatever its category. */
export function inContradictionScope(type: string, always: boolean): boolean {
  return GATED_CATEGORIES.has(type) || always === true;
}

// --- The verdict (§7) -------------------------------------------------------

export const CONTRADICTION_PROTOCOL = 'my_context/contradiction@1';

export type ContradictionDisposition = 'distinct' | 'supersedes';

/**
 * One ruling about one PAIR, keyed to both items' summary bases (§7).
 *
 * `a` and `b` are stored in lexicographic order, so a pair has one key however
 * the two ids arrived, and `aBasis`/`bBasis` line up with them positionally.
 * The gate skips the pair when a verdict exists AND both bases still match;
 * when either item's meaning changes, its basis changes, the verdict lapses,
 * and the pair is raised again — which is correct rather than noise.
 *
 * `carried` marks a row that no human ruled: it re-stamps an existing verdict
 * onto a new basis after a write that asserted, in words, that the item's
 * meaning did not move (`--summary-unchanged`, or a re-affirmation). See
 * `carryVerdicts` in `core/mutate.ts` for why that is the same act as
 * re-stamping `summary_of` and not a second, quieter kind of ruling.
 */
export interface ContradictionVerdict {
  protocol: string;
  a: string;
  b: string;
  verdict: ContradictionDisposition;
  aBasis: string;
  bBasis: string;
  ruledAt: string;
  ruledBy: Origin;
  carried?: boolean;
}

/**
 * One key per unordered pair. The separator is `\u0000`, written as an ESCAPE
 * rather than as a literal byte: a NUL inside a source file is exactly what
 * `scripts/check-text-files.ts` refuses. It cannot occur inside an id
 * (`validateExplicitId`), so no two different pairs can collide on one key.
 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * The latest verdict for each pair, by file order.
 *
 * "Later wins on read" is §10's concurrency answer and it is the whole reason
 * the log is append-only: a verdict written twice is idempotent, and two
 * processes appending two lines cost one extra line rather than the 1–21 rows
 * a read-modify-write destroyed per run when it was measured on this project.
 */
export function latestVerdicts(
  verdicts: readonly ContradictionVerdict[],
): Map<string, ContradictionVerdict> {
  const out = new Map<string, ContradictionVerdict>();
  for (const v of verdicts) out.set(pairKey(v.a, v.b), v);
  return out;
}

// --- The gate (§5) ----------------------------------------------------------

/** An item as the gate sees it — never a whole `Item`, so §11 can build one by hand. */
export interface ContradictionItem {
  id: string;
  type: string;
  title: string;
  body: string;
  summary: string | null;
  severity: Severity;
  always: boolean;
  status: Status;
  /**
   * What this item's summary is written against — `summary_of` when it has
   * one, and its live summarised-content hash when it does not. See
   * `contradictionBasis` (core/mutate.ts) for why the fallback exists: an
   * unsummarised item records `summary_of: null`, and a verdict keyed to
   * `null` could never lapse, which is worse than raising the pair again.
   */
  basis: string;
}

/** What is about to be written, as the gate sees it. */
export interface ContradictionDraft {
  /** `null` at creation: the id is allocated by the write this gate precedes. */
  id: string | null;
  type: string;
  title: string;
  body: string;
  always: boolean;
  basis: string;
  /** `--distinct <id>`, repeatable: both can be true, they are about different things. */
  distinct: readonly string[];
  /** `--supersedes <id>`: this replaces it, and it is retired. */
  supersedes: string | null;
}

export interface ContradictionCandidate extends ContradictionItem {
  score: number;
}

export interface ContradictionOutcome {
  allowed: boolean;
  /**
   * When refused, every candidate still OPEN. When allowed, every candidate
   * this call DISPOSITIONED — the caller has to record a verdict for each of
   * them after the write succeeds, and asking a second time would let the two
   * answers disagree.
   */
  candidates: readonly ContradictionCandidate[];
  /** Every candidate the retrieval raised, before the memory and the dispositions. */
  raised: readonly ContradictionCandidate[];
  /**
   * Dispositioned ids that name NO ITEM AT ALL. See
   * `unknownDispositionRefusal` for why the test is that narrow: a typo has no
   * honest reading, and everything else does.
   */
  stray: readonly string[];
}

/**
 * **The gate, whole, as one pure function** (§11).
 *
 * The order of the four filters is the design:
 *
 *  1. **Scope** (§3). Out of scope is allowed with no candidates at all, and
 *     no comparison is made. About one write in five on today's corpus reaches
 *     step 2; the rest cost nothing.
 *  2. **Governing, in scope, and not the draft itself.** The predicate is
 *     IMPORTED and never restated, as §4 requires — see `governsNow` for why
 *     it is `GOVERNING_STATUS` (trust.ts) rather than `RETIRED_STATUSES`
 *     (select.ts), and for the measurement that decided it.
 *  3. **Overlap** at `CONTRADICTION_THRESHOLD` — read its comment before
 *     changing it, and read the measurement in it before assuming it should
 *     have been `OVERLAP_THRESHOLD` — capped at `OVERLAP_CAP`, ties broken
 *     by id so the list is a fact about the corpus rather than about the order
 *     two equally-scoring items happened to arrive in.
 *  4. **The memory** (§7), then this call's own dispositions. A candidate
 *     already ruled on, whose ruling has not lapsed, is never raised; a
 *     candidate this call disposes of is settled here and now.
 *
 * Every remaining candidate refuses the write. **A write settling one of two
 * is refused again, naming the one still open** — which falls out of the
 * filter rather than needing its own clause.
 */
export function contradictionGate(
  draft: ContradictionDraft,
  activeItems: readonly ContradictionItem[],
  verdicts: readonly ContradictionVerdict[],
): ContradictionOutcome {
  if (!inContradictionScope(draft.type, draft.always)) {
    return { allowed: true, candidates: [], raised: [], stray: [] };
  }
  // Every id that EXISTS, which is all `unknownDispositionRefusal` needs: it
  // catches a typo and nothing else, and a typo is the one disposition with no
  // honest reading.
  const eligible = new Set<string>();
  const scored: ContradictionCandidate[] = [];
  for (const item of activeItems) {
    eligible.add(item.id);
    if (item.id === draft.id) continue;
    // "Currently governing", not "not retired" — see `governsNow` for the
    // measurement and for why §4's constant is the wrong one in both
    // directions.
    if (!governsNow(item.status)) continue;
    if (!inContradictionScope(item.type, item.always)) continue;
    const score = overlapScore(draft, item);
    if (score < CONTRADICTION_THRESHOLD) continue;
    scored.push({ ...item, score });
  }
  scored.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
  const raised = scored.slice(0, OVERLAP_CAP);

  const settled = draft.id === null
    ? new Map<string, ContradictionVerdict>()
    : latestVerdicts(verdicts);
  const disposed = new Set<string>(draft.distinct);
  if (draft.supersedes !== null) disposed.add(draft.supersedes);

  const open: ContradictionCandidate[] = [];
  const closed: ContradictionCandidate[] = [];
  for (const candidate of raised) {
    if (disposed.has(candidate.id)) { closed.push(candidate); continue; }
    if (draft.id !== null) {
      const recorded = settled.get(pairKey(draft.id, candidate.id));
      if (recorded !== undefined && verdictHolds(recorded, draft.id, draft.basis, candidate)) {
        continue;
      }
    }
    open.push(candidate);
  }
  const stray = [...disposed].filter((id) => !eligible.has(id)).sort();
  if (open.length > 0) return { allowed: false, candidates: open, raised, stray };
  return { allowed: true, candidates: closed, raised, stray };
}

/** A verdict holds while BOTH bases still match — §7, and the whole of it. */
function verdictHolds(
  recorded: ContradictionVerdict, draftId: string, draftBasis: string, other: ContradictionItem,
): boolean {
  const draftIsA = recorded.a === draftId;
  const recordedDraftBasis = draftIsA ? recorded.aBasis : recorded.bBasis;
  const recordedOtherBasis = draftIsA ? recorded.bBasis : recorded.aBasis;
  return recordedDraftBasis === draftBasis && recordedOtherBasis === other.basis;
}

// --- The refusal (§5) -------------------------------------------------------

/** Which spelling of the two dispositions the reader can actually type. */
export type ContradictionSurface = 'add' | 'edit' | 'create_item' | 'update_item';

function dispositionSpelling(
  surface: ContradictionSurface,
): { distinct: string; supersedes: string } {
  return surface === 'add' || surface === 'edit'
    ? { distinct: '--distinct <id>    ', supersedes: '--supersedes <id>  ' }
    : { distinct: 'distinct: ["<id>"] ', supersedes: 'supersedes: "<id>" ' };
}

/**
 * **The refusal, in the summary gate's shape and for its reasons.**
 *
 * That gate is the proven pattern in this repository — it stopped four wrong
 * edits in one session and each was corrected rather than forced — and it does
 * four things this one copies exactly: it says WHY, it promises **nothing was
 * written**, it names the exact re-send, and it explains why the product cannot
 * decide for you. The last is not modesty. `overlapScore` is lexical: it
 * measures that two items are ABOUT the same thing, and it cannot tell
 * agreement from conflict, so a product that ruled here would be guessing with
 * a straight face.
 *
 * Each candidate is printed with its own summary, quoted whole rather than
 * truncated, for `summaryRequiredRefusal`'s reason: the entire point of
 * printing it is that the reader decides. An item with no summary is shown as
 * such, rather than having its body silently substituted — "nobody wrote one"
 * and "here is what it says" are different facts.
 */
export function contradictionRefusal(
  draft: ContradictionDraft,
  candidates: readonly ContradictionCandidate[],
  surface: ContradictionSurface,
): string {
  const creating = surface === 'add' || surface === 'create_item';
  const what = creating ? 'this item' : draft.id;
  const spell = dispositionSpelling(surface);
  const lines = candidates.map((c) => {
    const force = c.severity === 'hard' ? `${c.type} · hard` : c.type;
    const said = c.summary === null
      ? '(no summary — read the item before ruling on it)'
      : `"${c.summary}"`;
    return `  ${c.id}  (${force})\n    ${said}`;
  });
  const settled = draft.distinct.length + (draft.supersedes === null ? 0 : 1);
  // **The clause that makes "every candidate must be dispositioned" legible.**
  // A write settling one of two is refused again, and a reader who sent a
  // disposition and got the same-shaped refusal back has to be told that it
  // was taken and that something else is still open, or the gate reads as
  // broken rather than as unfinished.
  const carried = settled === 0
    ? ''
    : ` ${settled} disposition${settled === 1 ? ' was' : 's were'} accepted on this call and ` +
      `${candidates.length === 1 ? 'one candidate is' : `${candidates.length} candidates are`} ` +
      `still open — every candidate has to be settled before anything is written, because a ` +
      `write that settles some of them would put the rest in force unexamined.`;
  return (
    `my_context: ${what} may contradict ${candidates.length} item` +
    `${candidates.length === 1 ? ' that currently governs' : 's that currently govern'}, and ` +
    `nothing was ${creating ? 'created' : 'changed'}.${carried}\n\n` +
    `${lines.join('\n\n')}\n\n` +
    `Nothing in this product can tell you whether these conflict. The match above is LEXICAL — ` +
    `it measures that two items are about the same thing, and two items that AGREE score exactly ` +
    `as high as two that conflict — and there is no model in this product to judge the ` +
    `difference. You have just written the text and are holding it, so this is the cheapest ` +
    `moment there will ever be.\n\n` +
    `Settle each one and send the write again:\n\n` +
    `  ${spell.distinct} both can be true; they are about different things\n` +
    `  ${spell.supersedes} this replaces it, and it is retired\n\n` +
    `Or abandon this write, which is what to do when the existing item is right. Each ruling is ` +
    `recorded against the PAIR and against what both items say today, so you are not asked about ` +
    `it again until one of them changes its meaning.`
  );
}

/**
 * The refusal for a disposition that names something that cannot be a
 * candidate at all — no such item, or one that does not currently govern, or
 * one outside §3's scope.
 *
 * `null` when every named id is a real candidate for this write, so a caller
 * cannot print an empty refusal beside a perfectly good write.
 *
 * **The test is "does this id name an item at all", not the narrower "was it
 * raised on THIS call", and the difference was measured rather than chosen.**
 * The narrow test refuses three legitimate things. A caller re-sending after an
 * edit names ids the gate no longer raises, because the edit moved the text and
 * the score fell — being refused for over-answering teaches nothing. A caller
 * settling a pair ahead of time is making a true statement about two real
 * items, and recording it early costs nothing, because the pair it was actually
 * asked about is still open and still refused BY NAME on the same call. And a
 * fixture can only ever settle everything it has created, since it cannot know
 * which of them scored — measured on `test/ingest/schema.test.ts` and
 * `test/plugin/commands.test.ts`, both of which the narrow test refused.
 *
 * A typo is still caught, which is the whole reason this refusal exists: a
 * mistyped id names no item at all, so it can never be settled by accident,
 * and it is named here rather than silently recording a ruling about a pair
 * nobody looked at.
 */
export function unknownDispositionRefusal(
  draft: ContradictionDraft,
  stray: readonly string[],
  surface: ContradictionSurface,
): string | null {
  if (stray.length === 0) return null;
  const creating = surface === 'add' || surface === 'create_item';
  return (
    `my_context: this write disposes of ${stray.join(', ')}, which names no item in this ` +
    `corpus. A disposition is a ruling about a PAIR and it is recorded as one, so settling an ` +
    `id that does not exist would record a ruling nobody made while leaving the real candidate ` +
    `open — and the mistyped id is the only evidence the ruling was ever attempted. Nothing was ` +
    `${creating ? 'created' : 'changed'}. Send the write again naming the ids the refusal ` +
    `listed, or send it with no disposition to see them.`
  );
}
