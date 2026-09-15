/**
 * **What to DO with a draft, decided when the draft is captured** —
 * `TASK-the-review-queue-explains-a-proposal-at-length-and-never`
 * (`plan:review seq:7`), from the owner's own words on 2026-09-15:
 *
 *   *"the 'Why this was proposed' section is not short and could be tedious so
 *   a helpful addition would be a short recommendation including short and
 *   simple explanation of 'why you are recommending this'."*
 *
 * ── THE ONE CONSTRAINT THAT DECIDES EVERY LINE BELOW ────────────────────────
 *
 * `work.brief` — the sentence under the panel he is looking at — ends
 * *"Nothing here is composed now."* That is a promise the screen keeps about
 * the brief, and a recommendation drawn beside it inherits the promise whether
 * anybody intended that or not. A verdict composed when the queue is OPENED
 * would be a fresh answer about a session that ended days ago, sitting in the
 * same box as something written with the transcript in hand, and the reader
 * could not tell which was which.
 *
 * So: **composed at capture, recorded on the draft, rendered by the screen.**
 * Nothing in this module is reachable from `src/ui/read-model-work.ts`'s
 * compose path — the read model SPLITS a recorded body and reads a tag, and
 * that is the whole of what it does.
 *
 * ── AND NO MODEL, FOR THE SAME REASON `briefOf` NEEDS NONE ──────────────────
 *
 * `briefOf` (`propose.ts`) composes five sentences deterministically out of
 * the proposal's own fields. This does the same thing with the same fields
 * plus two facts the pass can look up while it still has the workspace open:
 * whether the named subject EXISTS, and whether the selected sentence is
 * WHOLE. `recommend` below is pure — the caller hands it facts — so the
 * decision can be replayed, disagreed with, and tested by removal.
 *
 * ── THE FAILURE CONDITION, WHICH THE ITEM MAKES BINDING ─────────────────────
 *
 * *"A recommendation that is always 'promote' is a button with a sentence next
 * to it."* Two of the three verdicts below exist precisely because a lexical
 * pass genuinely cannot decide some drafts, and `needs-you` is a first-class
 * answer rather than a fallback: `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`
 * is the same shape of rule — *none, with a reason, is a legal answer.*
 *
 * ── ABSENT IS ABSENT ────────────────────────────────────────────────────────
 *
 * Every signal on `RecommendInput` is TRI-STATE. `null` means *nobody recorded
 * this*, and it is never collapsed into `false`. That distinction is not
 * decoration: the backfill (`backfill-recommendations.ts`) reads drafts whose
 * structured record was never kept, and a backfill that read "no evidence
 * count" as "zero evidence" would be inventing a measurement — the exact
 * defect `TASK-task-reconstruct-a-subject-from-a-passage-you-copied-without`,
 * standing in this very queue, is about.
 */

/** What a reader should do with this draft. Three answers, and the third is real. */
export type Verdict = 'promote' | 'decline' | 'needs-you';

/** In reading order, and the order the screen's own label map must match. */
export const VERDICTS: readonly Verdict[] = ['promote', 'decline', 'needs-you'];

/**
 * **The verdict travels as a TAG, and that is not an implementation detail.**
 *
 * `Proposer`'s comment in `propose.ts` argues the case at length for the
 * provenance axis: a label that must survive, must be machine-readable and
 * must not be mistaken for a trust boundary goes on `tags`, next to
 * `proposer:deterministic` and `confirmed`/`unconfirmed`, which are already
 * exactly that. A verdict parsed back out of the body's prose would be a
 * second spelling of a decision, and the two would drift the first time
 * somebody improved a sentence.
 *
 * So the screen reads the verdict HERE and the reason from the body, and
 * nothing anywhere reconstructs one from the other.
 */
export const REC_TAG_PREFIX = 'rec:';

/** `rec-backfilled:<YYYY-MM-DD>`. Present only on a row that was NOT captured with one. */
export const BACKFILL_TAG_PREFIX = 'rec-backfilled:';

export function recommendTag(verdict: Verdict): string {
  return `${REC_TAG_PREFIX}${verdict}`;
}

export function backfillTag(isoDate: string): string {
  return `${BACKFILL_TAG_PREFIX}${isoDate}`;
}

/** The recorded verdict, or `null` — which is what a draft captured before this shipped has. */
export function verdictFromTags(tags: readonly string[]): Verdict | null {
  for (const tag of tags) {
    if (!tag.startsWith(REC_TAG_PREFIX)) continue;
    const value = tag.slice(REC_TAG_PREFIX.length);
    if ((VERDICTS as readonly string[]).includes(value)) return value as Verdict;
  }
  return null;
}

/** The date a recommendation was BACKFILLED on, or `null` for one written at capture. */
export function backfilledFromTags(tags: readonly string[]): string | null {
  for (const tag of tags) {
    if (tag.startsWith(BACKFILL_TAG_PREFIX)) {
      const value = tag.slice(BACKFILL_TAG_PREFIX.length).trim();
      if (value !== '') return value;
    }
  }
  return null;
}

/**
 * What the proposal is ABOUT, as a kind.
 *
 * `file` and `item` are told apart by the same predicate `propose.ts` uses to
 * decide whether to write `scope` at all (`proposal.target.includes('/')`) —
 * one predicate, not two spellings of it. `none` is `targetOf` returning null,
 * which is a legal and common answer.
 */
export type TargetKind = 'file' | 'item' | 'none';

/**
 * The shape of the sentence the pass selected, and it is the signal that does
 * the most work on today's queue.
 *
 * `claimSentence` (`propose.ts`) splits a transcript record on
 * `(?<=[.!?:])\s+`, so a selected claim ends in `.`/`!`/`?` — a statement — or
 * in `:` — an introducer whose list stayed in the transcript — or in nothing
 * at all, when the record itself ran out mid-sentence. A deterministic
 * proposal IS its selected sentence, so an introducer with nothing introduced
 * is a draft with no finding in it, however true the finding may be back in
 * the transcript.
 */
export type ClaimShape = 'whole' | 'introducer' | 'cut';

/**
 * Everything the decision rests on. Every field is tri-state: `null` is
 * *not recorded*, and it is never read as `false`.
 */
export interface RecommendInput {
  /** What it is about, or `null` when the draft does not record which kind. */
  targetKind: TargetKind | null;
  /** The file path or item id itself, for the sentence. `null` with `targetKind: 'none'`. */
  target: string | null;
  /** Whether that subject exists right now. `null` when it could not be asked. */
  targetResolves: boolean | null;
  /** The selected sentence's shape, or `null` when only a clipped copy survived. */
  claim: ClaimShape | null;
  /** Seen in two or more independent sessions. */
  confirmed: boolean | null;
  sessionsSeen: number | null;
  evidenceCount: number | null;
  /**
   * What the deriver looked for and could not find, in plain words. EMPTY at
   * capture, where everything is in hand; non-empty on a backfill, where it is
   * the honest half of the row.
   */
  absent: readonly string[];
}

export interface Recommendation {
  verdict: Verdict;
  /** One or two plain sentences. The owner asked for exactly this and no more. */
  why: string;
  /** The signals, named, so a reader can disagree with the specific one. */
  from: string;
}

function subject(input: RecommendInput): string {
  return input.target === null ? 'the thing it is about' : input.target;
}

/**
 * **The decision, as a total order of first-match-wins rules** — deliberately
 * the same shape as `classify` (`propose.ts`), and for the same reason: a
 * precedence written as a list of guards can be proved by REMOVAL, where a
 * score threshold can only be asserted.
 *
 * The order is an argument, not an arrangement:
 *
 *  1. **A subject that is gone ends it.** Nothing else about a draft matters if
 *     the file or item it is about is not in the repository any more.
 *  2. **Then the draft's own form.** A deterministic proposal IS its selected
 *     sentence; if that sentence does not stand up, there is nothing to weigh.
 *  3. **Then what could not be seen.** Every remaining `null` is a question the
 *     pass could not ask, and an unasked question is `needs-you`, never a
 *     default.
 *  4. **Then the judgements a lexical pass has no standing to make** — a draft
 *     about an item in this corpus is a claim about the corpus's own
 *     bookkeeping, and whether that is wrong is the owner's call.
 *  5. **Only what survives all four is `promote`.**
 */
export function recommend(input: RecommendInput): Recommendation {
  const from = signalLine(input);

  if (input.targetResolves === false) {
    return {
      verdict: 'decline',
      why:
        `${subject(input)} is not in this repository any more, so there is nothing left to ` +
        `check and nothing to build. If it comes back, the pass will find the claim again — ` +
        `the sighting ledger keeps it either way.`,
      from,
    };
  }

  if (input.claim === 'introducer') {
    return {
      verdict: 'decline',
      why:
        `The sentence the pass selected ends at a colon: it introduces a list that stayed ` +
        `behind in the transcript, so this draft is an opening with no finding under it. ` +
        `What would change the answer is a whole sentence, not a better reading of this one.`,
      from,
    };
  }

  if (input.claim === 'cut') {
    return {
      verdict: 'decline',
      why:
        `The transcript record ran out mid-sentence, so the claim this draft carries has no ` +
        `end and cannot be read off the draft. The evidence quote is where it would be, if ` +
        `there is one.`,
      from,
    };
  }

  if (input.claim === null) {
    return {
      verdict: 'needs-you',
      why:
        `Whether the selected sentence stands whole cannot be seen from what this draft kept, ` +
        `so the question that separates a finding from a fragment was never asked. You have ` +
        `the transcript quote below; the pass does not.`,
      from,
    };
  }

  if (input.targetKind === null) {
    return {
      verdict: 'needs-you',
      why:
        `What this draft is about was not recorded in a form that can be read back, so it ` +
        `cannot be checked that the subject still exists. That check is the one thing that ` +
        `would have settled this without you.`,
      from,
    };
  }

  if (input.targetKind === 'none') {
    return {
      verdict: 'needs-you',
      why:
        `It names no file and no item, so nothing says where it applies and it will never be ` +
        `delivered to anyone working on a file. Whether a claim about nothing in particular ` +
        `is worth keeping is a judgement about this corpus, not something a transcript answers.`,
      from,
    };
  }

  if (input.targetKind === 'item') {
    return {
      verdict: 'needs-you',
      why:
        `It is about ${subject(input)}, an item in this corpus rather than code. Whether that ` +
        `item's own state is wrong is a ruling about the corpus, and the pass has no standing ` +
        `to make it.`,
      from,
    };
  }

  if (input.targetResolves === null) {
    return {
      verdict: 'needs-you',
      why:
        `It names ${subject(input)}, but whether that file is still in the repository was ` +
        `never checked, so the difference between live work and a stale observation is open.`,
      from,
    };
  }

  if (input.confirmed === true) {
    const n = input.sessionsSeen;
    return {
      verdict: 'promote',
      why:
        `It makes a whole claim about ${subject(input)}, which is in the repository, and the ` +
        `same claim turned up in ${n === null ? 'more than one' : String(n)} independent ` +
        `sessions — so it is not one afternoon's work talking to itself.`,
      from,
    };
  }

  // **`null` is not `false` here either, and the sentence is what would have
  // given it away.** A draft whose recurrence was never recorded is not a
  // draft seen in one session, and saying "it rests on one session" about it
  // would be the row asserting a measurement nobody took — the whole reason
  // every field on `RecommendInput` is tri-state.
  if (input.confirmed === null) {
    return {
      verdict: 'promote',
      why:
        `It makes a whole claim about ${subject(input)}, which is in the repository now. ` +
        `Whether the same claim turned up in other sessions was never recorded, so nothing ` +
        `here rests on recurrence in either direction.`,
      from,
    };
  }

  return {
    verdict: 'promote',
    why:
      `It makes a whole claim about ${subject(input)}, which is in the repository now. It ` +
      `rests on one session, but approving this creates work to BUILD rather than a law to ` +
      `obey — a check that turns out wrong is found by whoever writes it.`,
    from,
  };
}

/**
 * The signals, named one by one, including the ones that were absent.
 *
 * **A signal nobody recorded is printed as absent rather than omitted.** An
 * omitted field and a field that was looked for and not found read identically
 * on a screen, and `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * is the standing rule about exactly that.
 */
function signalLine(input: RecommendInput): string {
  const parts: string[] = [];

  if (input.targetKind === null) parts.push('subject: not recorded');
  else if (input.targetKind === 'none') parts.push('subject: none named');
  else {
    const where = input.targetResolves === null
      ? 'not checked'
      : input.targetResolves ? 'present' : 'GONE';
    parts.push(`subject: ${input.targetKind} ${input.target ?? '(unnamed)'} (${where})`);
  }

  parts.push(`claim: ${input.claim === null ? 'not visible' : input.claim}`);

  if (input.confirmed === null) parts.push('recurrence: not recorded');
  else if (input.confirmed) {
    parts.push(`recurrence: confirmed in ${input.sessionsSeen ?? 2}+ sessions`);
  } else parts.push('recurrence: one session only');

  parts.push(input.evidenceCount === null
    ? 'evidence: not recorded'
    : `evidence: ${input.evidenceCount} record(s)`);

  const line = `Decided from — ${parts.join('; ')}.`;
  if (input.absent.length === 0) return line;
  return `${line} Not recoverable, and so treated as absent rather than guessed: ${input.absent.join('; ')}.`;
}

// ── HOW IT IS RECORDED ON THE DRAFT ─────────────────────────────────────────

/**
 * **The line that separates the recommendation from the brief**, written by
 * the pass and split on by the read model.
 *
 * A draft's body carries the recommendation FIRST and the brief after it,
 * unchanged, byte for byte — the item's own words: *"the full brief stays
 * exactly where it is and is not shortened."* The marker is what lets
 * `/api/review-queue` hand the screen two fields instead of one without
 * touching either text, and it is what keeps `BRIEF_MAX_CHARS` meaning the
 * same thing it meant before: the bound applies to the brief half, after the
 * split, so no recommendation can ever eat into it.
 *
 * It does not begin with `#`. A body line starting with a hash is read as a
 * section heading and everything after it is silently destroyed on the next
 * write — `validateBody` (`core/validate.ts`) documents the loss.
 */
export const RECOMMENDATION_END =
  '--- the recommendation ends here; the brief as it was recorded follows, unchanged ---';

/**
 * **The durable mark that a row was re-derived rather than captured with one,
 * and it says ONLY what the screen does not.**
 *
 * `work.recBackfilled` already tells the reader the row was backfilled, on
 * what date, and that it was re-derived from the fields that survived — and
 * it promises that "the note below names them". So this note names them and
 * stops. It used to repeat all three of those sentences first, which put the
 * same fact on the screen twice at four lines apiece: measured 2026-09-15 by
 * driving the Work screen, and it is the exact tedium `review/7` exists to
 * remove, reintroduced by the fix for it.
 *
 * It still opens with `BACKFILLED on <date>` because this line is the SECOND
 * of two independent marks — the first is the `rec-backfilled:` tag — and a
 * mark that only makes sense beside the other one is not independent. Strip
 * the tags and this sentence still says what it is.
 */
export function backfillNotice(isoDate: string, derivedFrom: string): string {
  return (
    `BACKFILLED on ${isoDate} — re-derived from ${derivedFrom}.`
  );
}

/**
 * The body a draft is stored with: the recommendation, the marker, then the
 * brief exactly as `briefOf` composed it.
 *
 * `notice` is `null` at capture and the backfill declaration otherwise. The
 * VERDICT is deliberately not printed here — it lives on the tag, once, and
 * the screen renders it from there in the reader's own language.
 */
export function composeBody(
  rec: Recommendation, brief: string, notice: string | null,
): string {
  const head = notice === null ? [] : [notice];
  return [...head, rec.why, rec.from, RECOMMENDATION_END, brief].join('\n');
}

/**
 * The read half: a stored body, split back into the recommendation's prose and
 * the brief.
 *
 * **This parses a MARKER, never prose.** It returns the recommendation text as
 * text; it does not read a verdict out of it, and the caller must not either —
 * `verdictFromTags` is where a verdict comes from. A body with no marker has
 * no recommendation and the brief is the whole of it, which is every draft
 * captured before this shipped.
 */
export function splitRecommendation(body: string): { why: string | null; brief: string } {
  const at = body.indexOf(RECOMMENDATION_END);
  if (at === -1) return { why: null, brief: body };
  const why = body.slice(0, at).trim();
  const brief = body.slice(at + RECOMMENDATION_END.length).replace(/^\r?\n/, '');
  return { why: why === '' ? null : why, brief };
}

// ── READING THE SIGNALS OFF WHAT IS ACTUALLY THERE ──────────────────────────

/**
 * The shape of a claim sentence, from the sentence itself.
 *
 * Used at CAPTURE, where the real selected sentence is in hand. The backfill
 * cannot call this on a `summary`, because a summary may have been clipped —
 * see `claimShapeOfSummary`.
 */
export function claimShapeOf(claim: string): ClaimShape {
  const text = claim.trim();
  if (text === '') return 'cut';
  const last = text[text.length - 1];
  if (last === '.' || last === '!' || last === '?') return 'whole';
  if (last === ':') return 'introducer';
  return 'cut';
}

/**
 * The shape of a claim, read off a stored `summary` — and `null` when the
 * summary was CLIPPED and so does not show how the claim ends.
 *
 * `clip` (`propose.ts`) appends `…` when it truncates, which is the one honest
 * thing this function has to work with. A backfill that ignored the ellipsis
 * and judged the claim by the last character of a cut copy would be asserting
 * something it cannot see — so a clipped summary yields `null`, the tri-state
 * absent, and the row says as much.
 */
export function claimShapeOfSummary(summary: string): ClaimShape | null {
  const text = summary.trim();
  if (text === '') return null;
  if (text.endsWith('…')) return null;
  return claimShapeOf(text);
}

/** `file` when the target is a path, `item` when it is an id, matching `propose.ts`'s scope predicate. */
export function targetKindOf(target: string | null): TargetKind {
  if (target === null) return 'none';
  return target.includes('/') ? 'file' : 'item';
}
