/**
 * **Noticing drift while it happens** — `plan:recall seq:3`, Task 13 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §14 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * D42's third and last phase. Retrieval is the cure and stands alone; this is
 * prevention — a hand on the shoulder before he is lost, rather than a way
 * back once he is.
 *
 * ── OFF BY DEFAULT. ONE PLACE ENFORCES IT, AND THIS IS THE PLACE IT IS ─────
 * ── STATED ────────────────────────────────────────────────────────────────
 *
 * **`driftCheck` is the only gate, `DEFAULT_DRIFT` is the default, and the
 * default is `enabled: false`.** Nothing else in this file consults the
 * switch, because nothing else in this file has an effect: `noticeDrift`,
 * `anchorForStretch` and `anchorSubject` are pure, they return values, and a
 * value nobody asked for warns nobody. One gate is sufficient precisely
 * because the other half cannot do anything on its own.
 *
 * This paragraph exists because of `plan:archive seq:9`, where off-by-default
 * was correctly enforced in **three** places and stated in **none** — so the
 * item read as never built until somebody traced the callers. Enforcing it is
 * half the job; saying where, in the header a reader opens first, is the
 * other half.
 *
 * **Why this feature in particular.** *"It must be able to be wrong quietly."*
 * Telling the owner he has drifted when he has not is worse than silence, so
 * the switch is not a config nicety, it is the safety property. Every path
 * below that cannot answer confidently answers *nothing* rather than
 * *probably*: no anchor, an anchor with no name in it, a stretch with no name
 * in it, a stretch the rubric declined — each is a stated refusal, never a
 * warning, and never a guess (`INV-nothing-is-dropped-silently` is why each
 * one says so rather than returning a bare `false`).
 *
 * **The key is TOP-LEVEL `drift`, not `review.drift`, and that is forced.**
 * `core/config.ts` · `requireReview` refuses any key it does not know inside
 * the `review` block — by design, since a typo there has no honourable reading —
 * so `{"review": {"drift": …}}` would not switch this on, it would stop the
 * whole config loading. A top-level key is the one shape R14.2 makes
 * survivable: unknown top-level keys are skipped and disclosed. Nothing here
 * edits `config.json`; the owner adds
 *
 *     "drift": { "enabled": true }
 *
 * if he ever wants it, and until he does this module is inert.
 *
 * ── DRIFT IS MEASURED AGAINST AN ANCHOR, NEVER AGAINST A GUESS AT INTENT ───
 *
 * The comparison is between **two texts the owner produced**: the anchor —
 * the point he fixed, its label and the record it marks (`core/anchors.ts`) —
 * and the stretch of session that followed it. Both are reduced to NAMES by
 * `retrieval/from-selection.ts`, the same extraction the retrieval half
 * already runs, whose ranking is measured: item-id slugs matched **68%** of
 * the time against this archive where a word-bag matched **32%**.
 *
 * So the question this asks is *does the work still name what he fixed*. It
 * is not *what did he mean*, and there is no model, no classifier and no
 * topic here to make it one. The difference shows up in the negative cases:
 * **with no anchor there is no verdict at all.** A guess that resolves is
 * worse than silence, and this is the sentence Task 6 wrote for the same
 * reason one phase earlier.
 *
 * ── AND THERE IS NO SECOND THRESHOLD, DELIBERATELY ────────────────────────
 *
 * §14 says *"on one thing for many turns"*, which invites a constant — warn
 * after N off-subject turns. There is none here, because the stretch handed
 * in is ALREADY the many: `review.everyNToolCalls` (15) is what defines where
 * a stretch begins and ends, and `plan:loop seq:2` measured what that
 * produces — 3,924 tool calls → **261 considerations**. A number of my own on
 * top of that would be a threshold with no derivation behind it, which is
 * what `core/retire.ts` is this project's ruling about. `turns` is carried so
 * the warning can say how long, and is compared with nothing.
 *
 * ── THE RUBRIC IS `loop/2`'s, IMPORTED ────────────────────────────────────
 *
 * `worthAPass` already answers *is this stretch worth looking at* and its
 * shape is measured: 261 considerations → 164 fires → 3 passes, against the
 * **766** that firing on every `Stop` would have been. This asks the same
 * machinery a different question — it gates first, and a stretch the rubric
 * would not have read is not a stretch to warn about. It is imported, not
 * copied: `test/review/drift.test.ts` asserts the refusal sentence is
 * `worthAPass`'s own, so a fork would be visible the day it happened.
 *
 * **What could NOT be reused, and the specific reason.** `reviewTrigger` in
 * `trigger.ts` is the other half of that machinery — counter, ration,
 * interval, `stat` — and it is not called here. It is gated on
 * `review.enabled` and it **spawns a detached child**, so calling it would
 * both make drift fire whenever the review loop fires (a second switch
 * silently deciding a first) and make this feature load-bearing on a
 * subsystem the item says the owner may drop. The item's own instruction is
 * to build this last and leave it droppable. So the rationing half is reused
 * by SHAPE — a verdict whose reason is present on refusals too, which is
 * `TriggerVerdict`'s and `RubricVerdict`'s rule — and by the stretch the
 * caller hands in, which is the one the trigger's interval already carved.
 *
 * This module is PURE except for `driftConfigAt`, which reads one file. It
 * writes nothing, opens no database, spawns nothing, and imports neither
 * `core/inject.ts` nor anything under `src/hooks/`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { queryFromPassage } from '../core/retrieval/from-selection.ts';
import { worthAPass, type RubricPoint, type RubricVerdict } from './rubric.ts';
import type { AnchorRow } from '../core/conversation-index.ts';
import type { ResolvedAnchor } from '../core/anchors.ts';

/** The top-level `config.json` key. See the header for why it is not under `review`. */
export const DRIFT_CONFIG_KEY = 'drift';

/** What the `drift` section can say. One switch, which is all §11 allows a subsystem. */
export interface DriftConfig {
  enabled: boolean;
}

/**
 * **OFF.** The default, and the one place it is written down.
 *
 * A separate object rather than an inline `false` so that a reader asking
 * *what does this do if I do nothing* gets an answer from a value rather than
 * from a control-flow reading — the same choice `DEFAULT_REVIEW` makes.
 */
export const DEFAULT_DRIFT: DriftConfig = { enabled: false };

/**
 * The `drift` section of a workspace's config, or the default.
 *
 * `root` is the `.my_context` directory — what `findProjectRoot` returns.
 *
 * **Every unreadable thing resolves to OFF, and that asymmetry is deliberate.**
 * `core/config.ts` refuses a malformed `review` block loudly, because a loop the
 * user thought they had narrowed is a real harm. Here the harm runs the other
 * way: the failure this feature must not have is warning when it should be
 * silent, so a file that is not JSON, a `drift` that is not an object, and an
 * `enabled` that is not the literal `true` all leave it off. Nothing here
 * throws, for the same reason — this is read beside work, not instead of it.
 */
export function driftConfigAt(root: string): DriftConfig {
  try {
    const raw: unknown = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8'));
    if (raw === null || typeof raw !== 'object') return { ...DEFAULT_DRIFT };
    const section = (raw as Record<string, unknown>)[DRIFT_CONFIG_KEY];
    if (section === null || typeof section !== 'object') return { ...DEFAULT_DRIFT };
    return { enabled: (section as Record<string, unknown>).enabled === true };
  } catch {
    return { ...DEFAULT_DRIFT };
  }
}

/**
 * The anchor, reduced to what a comparison needs.
 *
 * `text` is the record the anchor points at, or `null` when the transcript is
 * no longer in the archive — `resolveAnchor` keeps those two states apart and
 * this keeps them apart too, because an anchor whose record has gone still has
 * a label the owner wrote and is still something to judge against.
 */
export interface DriftAnchor {
  id: string;
  label: string;
  text: string | null;
  at: string;
  byteOffset: number;
}

/** A resolved anchor as this file compares against it. A pure projection. */
export function anchorSubject(resolved: ResolvedAnchor): DriftAnchor {
  return {
    id: resolved.anchor.id,
    label: resolved.anchor.label,
    text: resolved.text,
    at: resolved.anchor.at,
    byteOffset: resolved.anchor.byteOffset,
  };
}

/**
 * **The anchor in force when a stretch began** — the last one at or before
 * `startByte`, or `null`.
 *
 * Two exclusions, and both are about comparing like with like:
 *
 *  - **An anchor set AFTER the stretch began is not what the stretch departed
 *    from.** Judging against it would report drift away from a point that did
 *    not yet exist, which is the purest form of an opinion about intent.
 *  - **A lane's anchor is not one.** Its `byteOffset` is into the lane's own
 *    transcript, so comparing it with a session offset is comparing two
 *    rulers. `anchorsFor` deliberately returns both kinds — a reader asking
 *    what he marked is not asking which file the words landed in — so the
 *    filter belongs here, at the one place the numbers are compared.
 */
export function anchorForStretch(
  anchors: readonly AnchorRow[], startByte: number,
): AnchorRow | null {
  let best: AnchorRow | null = null;
  for (const anchor of anchors) {
    if (anchor.agentId !== null) continue;
    if (anchor.byteOffset > startByte) continue;
    if (best === null || anchor.byteOffset > best.byteOffset) best = anchor;
  }
  return best;
}

/** The stretch of session being judged. The caller carved it; see the header. */
export interface DriftStretch {
  /** The words of the stretch — `retrieval/noise.ts` output, where a caller has it. */
  text: string;
  /** The reader's points, for the rubric. `loop/2`'s vocabulary, unchanged. */
  points: readonly RubricPoint[];
  /** How many turns it covers. Reported, and compared with nothing. */
  turns: number;
  /** Where it began, in bytes, so the anchor in force can be found. */
  startByte: number;
}

/** What was compared, what it concluded, and why — the reason is never optional. */
export interface DriftVerdict {
  /** `true` only when there was an anchor, names on both sides, and no overlap. */
  drifted: boolean;
  /**
   * One sentence. **Present on refusals too**, which is the half that matters
   * here more than anywhere: a detector that stays quiet and cannot say why is
   * indistinguishable from a broken one, and this one is quiet by default.
   */
  because: string;
  /** What it was judged against, or `null` when there was nothing to judge against. */
  anchor: { id: string; label: string } | null;
  /** The anchor's names, normalised. Shown, so a bad warning can be diagnosed. */
  anchorNames: string[];
  /** The stretch's names, normalised. */
  stretchNames: string[];
  /** The names both carry. Empty and both sides non-empty is the drift. */
  shared: string[];
  /** `loop/2`'s own verdict on whether this stretch was worth looking at. */
  rubric: RubricVerdict;
}

/**
 * **One name, comparably.**
 *
 * Lowercased, and trailing sentence punctuation removed.
 *
 * **Measured, 2026-09-11, and the measurement is narrower than it looks.** The
 * path pattern in `from-selection.ts` admits `.` as a path character and does
 * not admit `,`. So *"pointers into `src/core/retrieval/mission.ts`, never
 * passages"* yields the path clean, while *"pointers into
 * `src/core/retrieval/mission.ts`. It never carries passages"* yields
 * `src/core/retrieval/mission.ts.` with the full stop attached — and a name
 * that ends a sentence is the ordinary case in a label somebody wrote.
 * Compared literally against the same path written mid-sentence in the
 * stretch, that is a MISS, and a miss on this comparison is a warning that
 * should not have been given, which is the one outcome this feature may not
 * produce.
 *
 * The first draft of `test/review/drift.test.ts` wrote the comma form, so the
 * assertion that rests on this function passed with the whole `replace` taken
 * out. That is recorded here rather than quietly corrected: the fixture now
 * ends the sentence, and the removal proof reddens.
 */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[.,;:!?'"`)\]}]+$/, '');
}

/** Every name in a text, normalised and deduplicated, order preserved. */
function namesOf(text: string, vocabulary: readonly string[]): string[] {
  const query = queryFromPassage(text, vocabulary);
  if (!query.matchable) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of [...query.names, ...query.terms]) {
    const name = normalise(raw);
    if (name === '' || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names.sort();
}

/** `n thing(s)`, so a reason never reads "1 turns". */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** At most three names, for a sentence a person reads rather than a dump. */
function listed(names: readonly string[]): string {
  return names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

/**
 * **Has the work wandered from the point he fixed?**
 *
 * PURE. It decides nothing about whether anybody is told — see `driftCheck`.
 *
 * The order of the gates is the order of confidence, cheapest first, and every
 * one of them answers *nothing* rather than *probably*:
 *
 *  1. **The rubric.** `loop/2`'s, imported. A stretch it would not have read
 *     is not a stretch to warn about, and its refusal sentence is carried
 *     verbatim so the reason a reader sees is the reason that was computed.
 *  2. **An anchor.** None means no verdict. This is the ruling.
 *  3. **Names on the anchor's side.** An anchor reading *"we talked it over"*
 *     is a real anchor with nothing to compare, and saying so is the honest
 *     answer where picking its ordinary words would be the word-bag the
 *     retrieval half measured at 32% and refused.
 *  4. **Names on the stretch's side**, for the same reason from the other
 *     end: a quiet stretch is not a wandering one.
 *
 * Only then does an empty overlap mean drift.
 */
export function noticeDrift(
  anchor: DriftAnchor | null,
  stretch: DriftStretch,
  vocabulary: readonly string[] = [],
): DriftVerdict {
  const rubric = worthAPass([...stretch.points]);
  const base = {
    anchor: anchor === null ? null : { id: anchor.id, label: anchor.label },
    anchorNames: [] as string[],
    stretchNames: [] as string[],
    shared: [] as string[],
    rubric,
  };

  if (!rubric.fire) {
    return {
      ...base, drifted: false,
      because: `the rubric declined this stretch — ${rubric.because}`,
    };
  }

  if (anchor === null) {
    return {
      ...base, drifted: false,
      because:
        'no anchor at or before this stretch, so there is nothing to judge against — and a '
        + 'guess at what the work was meant to be is not an anchor',
    };
  }

  const anchorNames = namesOf(`${anchor.label}\n${anchor.text ?? ''}`, vocabulary);
  if (anchorNames.length === 0) {
    return {
      ...base, drifted: false,
      because:
        `the anchor "${anchor.label}" carries no name to judge against — no item id, no file `
        + 'path, no backticked name. Its ordinary words are not offered as one',
    };
  }

  const stretchNames = namesOf(stretch.text, vocabulary);
  if (stretchNames.length === 0) {
    return {
      ...base, drifted: false, anchorNames,
      because:
        `nothing in these ${plural(stretch.turns, 'turn')} carries a name, so there is nothing `
        + `to compare with the anchor "${anchor.label}"`,
    };
  }

  const anchorSet = new Set(anchorNames);
  const shared = stretchNames.filter((name) => anchorSet.has(name));
  if (shared.length > 0) {
    return {
      ...base, drifted: false, anchorNames, stretchNames, shared,
      because:
        `still on it — these ${plural(stretch.turns, 'turn')} name ${listed(shared)}, which the `
        + `anchor "${anchor.label}" names too`,
    };
  }

  return {
    ...base, drifted: true, anchorNames, stretchNames, shared,
    because:
      `${plural(stretch.turns, 'turn')} since the anchor "${anchor.label}" and not one of its `
      + `names — ${listed(anchorNames)} — appears in them; the work has been on `
      + `${listed(stretchNames)} instead`,
  };
}

/** What `driftCheck` is asked. `corpusRoot` is the `.my_context` directory. */
export interface DriftRequest {
  corpusRoot: string;
  anchor: DriftAnchor | null;
  stretch: DriftStretch;
  /** `retrieval/subjects.ts`' vocabulary, where a caller has built one. */
  vocabulary?: readonly string[];
}

/**
 * **The gate, and the only one.** `null` means OFF — no verdict, no reason, no
 * row, nothing for a caller to render.
 *
 * `null` rather than a verdict carrying `enabled: false`, deliberately: a
 * caller that must decide what to do with a shape cannot forget to check a
 * boolean it never receives, and `reviewTrigger` returns `null` from its own
 * switch for exactly this reason.
 *
 * Nothing in `src/` calls this. That is the item's instruction — *do not make
 * it load-bearing for anything else, and do not wire it into a path that runs
 * whether he wants it or not* — and `test/review/drift.test.ts` asserts it by
 * reading the sources, with a positive control, so it stays true.
 */
export function driftCheck(request: DriftRequest): DriftVerdict | null {
  if (!driftConfigAt(request.corpusRoot).enabled) return null;
  return noticeDrift(request.anchor, request.stretch, request.vocabulary ?? []);
}
