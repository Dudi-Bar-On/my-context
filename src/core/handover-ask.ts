import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Config, HandoverConfig } from './config.ts';
import { sanitizeSessionId } from './ledger.ts';
import { resolveWorkspace } from './workspace.ts';

/**
 * **The rendezvous between an ask and a writing that happen turns apart.**
 *
 * `Stop` asks the model to bring the handover up to date when the context
 * window crosses the configured threshold, and until 2026-08-27 nothing ever
 * checked whether it did. The audit row said an ask went out, which reads
 * exactly like the mechanism worked — and this project has already measured
 * what that costs once, in a neighbouring mechanism: the item held to be the
 * continuity guarantee was delivered on no event at all, for weeks, while
 * everyone believed the guarantee was in force. Nothing said so.
 *
 * `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is` is the owner's
 * ruling, and its load-bearing sentence is *the flag is not a claim, it is a
 * comparison*. The writer is the MODEL — a handover is prose about what was
 * decided and why, and no hook can produce that — so the two halves are
 * inherently a turn or more apart and no hook timeout could ever contain them.
 * What a hook CAN do is compare two facts it can both observe: when the ask
 * went out, and when the file was last written.
 *
 *     written after the ask  ->  ACTED ON
 *     not written            ->  IGNORED, and that is a fact worth having
 *
 * ── WHY THE LATCH LIVES HERE AND NOT IN `hooks/stop.ts` ────────────────────
 *
 * It was written there, because `Stop` was the only hook that had one. Three
 * events now need it and they need it for three different reasons: `Stop`
 * takes it, `PreCompact` reads it before a compaction destroys the window, and
 * `SessionEnd` with `reason: 'clear'` reads it before a `/clear` does. A latch
 * that three hooks read is a core concern, and leaving it inside a per-turn
 * hook would have made two other hooks import that hook for a file format.
 *
 * ── WHAT IS DELIBERATELY NOT MEASURED ──────────────────────────────────────
 *
 * The file's CONTENT. `readHandover` in `core/handover.ts` parses the document
 * and it is the right tool for delivering it; it is the wrong tool here. This
 * runs on `Stop`, which the platform genuinely waits on before ending a turn,
 * and a `stat` answers the only question being asked — *was it written after we
 * asked* — for the cost of one inode read. Judging the CONTENT would also be a
 * judgement: a model that wrote something this module disliked would be asked
 * again for a document it had just written, which is the loop the latch exists
 * to prevent.
 */

/**
 * Everything remembered about one session's handover ask. One small JSON file
 * in `state/`, beside the seen file and the restore snapshot — this is where
 * per-session hook state lives, and a second location for five fields would be
 * a second directory for `mycontext status` and every cleanup path to learn.
 *
 * **`sanitizeSessionId` is `ledger.ts`'s, deliberately, not
 * `statusline-tee.ts`'s.** The two differ in their failure direction: the tee's
 * REFUSES an id it cannot make a filename from (returning `null`), while
 * ledger's FOLDS one, always yielding a name. A refusal here would mean no
 * latch, and no latch means the stand-down line repeats on every turn of that
 * session — the exact noise the latch exists to prevent. It is also the
 * spelling every other file in `state/` already uses, so one session has one
 * name across all of them.
 *
 * **`core/window-state.ts` still does not remove it**, and that is unchanged by
 * this file moving house. A `/clear` destroys a context window and this latch
 * belongs to that window, but adding it to that sweep is a change to what a
 * `/clear` removes — another module's stated contract — and the cost of leaving
 * it is bounded and one-directional: a session that clears and then refills its
 * window after having been asked is asked fewer times, never more.
 */
export interface AskLatch {
  /**
   * The `thresholdPercent` the most recent ask was delivered at, or `null` for
   * a session that has never been asked.
   *
   * The THRESHOLD and not the occupancy, and that is what makes the two edits a
   * user might make mid-session behave differently. Lowering it is somebody
   * saying *ask me sooner than that*, which is a new instruction and is allowed
   * to re-arm; raising it is not a request for anything, and a mechanism that
   * has already spoken must not start again because a number moved away from
   * it. Storing the occupancy instead would re-arm on every higher reading,
   * which is every turn after the first.
   */
  askedAtThreshold: number | null;
  /**
   * WALL CLOCK of the most recent ask, ISO-8601, or `null` for a session that
   * has never been asked. The whole of what `plan:handover seq:9` adds here.
   *
   * A wall clock and not a counter, because the other half of the comparison is
   * a file's mtime and that is wall clock too. The cost is the one every mtime
   * comparison has: a clock moved backwards mid-session makes a write look
   * older than the ask that provoked it, and this module reports that as
   * IGNORED. The failure is bounded at one extra ask and one line, and the
   * alternative — believing the ask worked — is the failure this exists to end.
   */
  askedAt: string | null;
  /**
   * How many asks this session has been delivered. Bounded by `MAX_ASKS`.
   *
   * `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is`: *a third
   * would be nagging, and a hook that nags is a hook that gets uninstalled*.
   * The count is what makes the bound a bound rather than an emergent property
   * of the other four fields.
   */
  asks: number;
  /**
   * Whether the most recent ask has been VERIFIED as acted on.
   *
   * This is the field that changes what the latch means. It used to mean
   * "asked"; with this it means "asked and NOT YET SATISFIED", which is what
   * makes a second ask safe: an ask that was ignored can be repeated, and an
   * ask that was answered cannot.
   *
   * It is also what keeps the per-turn cost at zero on the ordinary path. Once
   * a verification comes back `acted-on` it is written here, so every later turn
   * of that session answers from the latch it already reads and never stats the
   * handover again.
   */
  satisfied: boolean;
  /** Whether the occupancy stand-down line has already been shown this session. */
  stoodDown: boolean;
  /**
   * Whether an ignored ask has already been disclosed on stderr this session.
   *
   * A session can be compacted more than once, and each compaction destroys a
   * window, so each is a real and separate loss — the argument for saying it
   * again is genuine. It is still said only once, for the reason `stoodDown`
   * is: this product's standing choice is silence wherever it has one, and a
   * paragraph the user has already read and already declined to act on teaches
   * nothing the second time. The audit row carries every occurrence, which is
   * the channel that is supposed to be exhaustive.
   */
  disclosedIgnored: boolean;
}

/**
 * At most two asks per session, ever.
 *
 * The first is the mechanism. The second exists only because the first can be
 * verified to have failed, and it names the first when it goes out. There is no
 * third: the audit row is the accountability story for the ones that went
 * unanswered, and a per-turn hook that keeps asking is a session that cannot
 * finish.
 */
export const MAX_ASKS = 2;

export const NO_LATCH: AskLatch = {
  askedAtThreshold: null,
  askedAt: null,
  asks: 0,
  satisfied: false,
  stoodDown: false,
  disclosedIgnored: false,
};

export function latchPath(root: string, sessionId: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(sessionId)}.handover-ask.json`);
}

/**
 * The latch as it stands, or `NO_LATCH` for anything that cannot be read.
 *
 * A latch that cannot be READ reads as "nothing has happened yet" — but that
 * alone would be the loop, so it is only half the rule. The other half is in
 * `Stop`: nothing is ever asked unless the latch was successfully WRITTEN
 * first. An unreadable-and-unwritable latch therefore produces silence, not
 * repetition, which is the direction this design cannot afford to get wrong.
 *
 * **`asks` is inferred rather than defaulted to 0 for a latch that predates
 * it.** A file written by the build before `seq:9` carries `askedAtThreshold`
 * and no `asks`, and reading that as zero would hand a session that has already
 * been asked a full budget of two more. One ask is what such a file records, so
 * one ask is what it is read as — the same absent-is-not-zero rule the audit
 * fields keep, in the direction that costs nothing: the worst case is one ask
 * fewer, which is the direction this design chooses everywhere it has a choice.
 */
export function readLatch(root: string, sessionId: string): AskLatch {
  try {
    const raw = JSON.parse(readFileSync(latchPath(root, sessionId), 'utf8')) as unknown;
    if (raw === null || typeof raw !== 'object') return NO_LATCH;
    const value = raw as Record<string, unknown>;
    const askedAtThreshold = typeof value.askedAtThreshold === 'number'
      ? value.askedAtThreshold
      : null;
    return {
      askedAtThreshold,
      askedAt: typeof value.askedAt === 'string' && value.askedAt !== '' ? value.askedAt : null,
      asks: typeof value.asks === 'number' && Number.isFinite(value.asks)
        ? value.asks
        : (askedAtThreshold === null ? 0 : 1),
      satisfied: value.satisfied === true,
      stoodDown: value.stoodDown === true,
      disclosedIgnored: value.disclosedIgnored === true,
    };
  } catch {
    return NO_LATCH;
  }
}

/**
 * Writes the latch, and says whether it went. `false` means the caller must
 * stay silent: the thing that would stop it repeating did not persist.
 *
 * A plain `writeFileSync`, not the atomic write-and-rename `ledger.ts` uses for
 * the restore snapshot. The trade is different in both directions: this file is
 * five small fields written by one process per turn, so a torn write costs one
 * re-ask or one re-disclosure, while the snapshot is a whole context window
 * whose loss is unrecoverable. And `Stop` is the hook with the tightest timeout
 * of the ten, so a rename retry budget measured in seconds is a budget it does
 * not have.
 */
export function writeLatch(root: string, sessionId: string, latch: AskLatch): boolean {
  try {
    const file = latchPath(root, sessionId);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(latch), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * What became of a handover ask. Five values, and the two in the middle are the
 * whole point of the feature.
 *
 *  - `off`          — no `handover` key. Nothing was promised and nothing asked.
 *  - `not-asked`    — configured, but this session never crossed the threshold.
 *  - `acted-on`     — asked, and the file was written after the ask.
 *  - `ignored`      — asked, and it was not. The silence this feature answers.
 *  - `unverifiable` — asked, and the comparison could not be made. Never
 *                     collapsed into `ignored`: an accusation nothing supports
 *                     is the same defect as a guarantee nothing supports.
 *
 * `off` and `not-asked` are kept apart for the reason that keeps
 * `handoverState`'s `off` apart from `missing` on the `post-compact` row: one
 * means nobody configured this, the other means somebody did and the moment
 * never came. Collapsing them would make the log unable to answer *was this
 * feature ever actually exercised*.
 */
export type HandoverAskVerdict = 'off' | 'not-asked' | 'acted-on' | 'ignored' | 'unverifiable';

export interface HandoverAskCheck {
  verdict: HandoverAskVerdict;
  /** The path AS CONFIGURED, repo-relative, or `null` when the feature is off. */
  path: string | null;
  /** When the ask went out, ISO-8601, or `null` when none has. */
  askedAt: string | null;
  /** When the handover was last written, ISO-8601, or `null` when that is not known. */
  writtenAt: string | null;
  /** One clause for an audit note. Never empty, for any verdict. */
  note: string;
}

/**
 * **The comparison.** Never throws, for any filesystem outcome.
 *
 * `root` is the `.my_context` DIRECTORY — the latch hangs off it — and the
 * handover is resolved against its PARENT, because `handover.path` is validated
 * repo-relative. `core/handover.ts` documents at length why that distinction is
 * a trap worth naming: resolving a repo-relative path against `.my_context/`
 * reports every configured handover in the world as missing, and `missing` is
 * the value that means a broken agreement. Here the same mistake would report
 * every ask as IGNORED — a loud, plausible, permanent lie. The parent is taken
 * once, here, so no caller can get it wrong.
 *
 * **`statSync`, not `readHandover`.** One inode read answers the only question
 * asked. See this module's header for why the content is deliberately not
 * judged.
 *
 * **Strictly `>`.** A file whose mtime equals the ask to the millisecond was
 * not written in response to it — the ask is delivered at the END of a turn and
 * the writing happens in the next one, so a real response is milliseconds to
 * minutes later, never simultaneous. The failure directions are asymmetric and
 * this is the cheaper one: a false `ignored` costs one extra ask and one line;
 * a false `acted-on` is the belief this whole mechanism exists to replace.
 *
 * **A MISSING file is `ignored`, not `unverifiable`.** There is no ambiguity to
 * respect: the model was asked to update a named document and the document is
 * not there, so it certainly was not written. `unverifiable` is reserved for a
 * comparison that genuinely could not be made — an unreadable directory, a
 * permission error, a latch whose timestamp will not parse.
 */
export function checkHandoverAsk(
  root: string, handover: HandoverConfig | null, sessionId: string,
): HandoverAskCheck {
  if (handover === null) {
    return {
      verdict: 'off',
      path: null,
      askedAt: null,
      writtenAt: null,
      note: 'no handover is configured, so none was ever asked for',
    };
  }

  const latch = readLatch(root, sessionId);
  if (latch.askedAt === null) {
    return {
      verdict: 'not-asked',
      path: handover.path,
      askedAt: null,
      writtenAt: null,
      note: `${handover.path} is configured but this session was never asked to update it`,
    };
  }

  const askedMs = Date.parse(latch.askedAt);
  if (!Number.isFinite(askedMs)) {
    return {
      verdict: 'unverifiable',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `an ask for ${handover.path} was recorded but its timestamp (${latch.askedAt}) ` +
        'will not parse, so nothing could be compared against it',
    };
  }

  let writtenMs: number | null = null;
  try {
    // `throwIfNoEntry: false` so an absent file is a VALUE rather than an
    // exception: it is the commonest shape of an ignored ask and it is not an
    // error. A DIRECTORY at the configured path is folded in with it, the way
    // `readHandover` folds it into `missing` — there is no handover there
    // either way, and its mtime would answer a question nobody asked.
    const stat = statSync(path.resolve(path.dirname(root), handover.path), {
      throwIfNoEntry: false,
    });
    if (stat !== undefined && stat.isFile()) writtenMs = stat.mtimeMs;
  } catch (err) {
    return {
      verdict: 'unverifiable',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `an ask for ${handover.path} was recorded at ${latch.askedAt} but the file could ` +
        `not be examined (${err instanceof Error ? err.message : String(err)}), so whether it ` +
        'was acted on is not known',
    };
  }

  if (writtenMs === null) {
    return {
      verdict: 'ignored',
      path: handover.path,
      askedAt: latch.askedAt,
      writtenAt: null,
      note: `the handover ${handover.path} was asked for at ${latch.askedAt} and does not ` +
        'exist — the ask was not acted on',
    };
  }

  const writtenAt = new Date(writtenMs).toISOString();
  return writtenMs > askedMs
    ? {
        verdict: 'acted-on',
        path: handover.path,
        askedAt: latch.askedAt,
        writtenAt,
        note: `the handover ${handover.path} was written at ${writtenAt}, after the ask at ` +
          `${latch.askedAt}`,
      }
    : {
        verdict: 'ignored',
        path: handover.path,
        askedAt: latch.askedAt,
        writtenAt,
        note: `the handover ${handover.path} was asked for at ${latch.askedAt} and has not ` +
          `been written since (last written ${writtenAt}) — the ask was not acted on`,
      };
}

/**
 * The one line a user sees when an ask went unanswered and the window is about
 * to be destroyed. `occasion` names what is destroying it, in words a user
 * recognises.
 *
 * **This is the exception `pre-compact.ts` argues against everywhere else.**
 * That hook deliberately does NOT write the occupancy stand-down line, because
 * a compaction is the one moment where an unsolicited paragraph of ours
 * competes with Claude Code's own compaction notice for a user who asked for
 * neither. This line is a different kind of thing and the difference is the
 * whole justification: the stand-down asks the user to go and install
 * something, while this reports that a thing the product said it would do did
 * not happen, at the last moment where knowing still helps. One line, one
 * verdict, and only for `ignored` — `acted-on` is the mechanism working and
 * needs no announcement.
 */
export function ignoredAskLine(check: HandoverAskCheck, occasion: string): string {
  return (
    `my_context: ${check.path} was asked for at ${check.askedAt} and has not been written ` +
    `since${check.writtenAt === null ? ' (the file does not exist)' : ''}. This ${occasion} ` +
    'destroys the context window, so whatever was not written down goes with it.\n'
  );
}

/**
 * The line to write, or `''` — the whole of the disclosure decision, in one
 * place, so the two boundaries cannot answer it differently.
 *
 * Only `ignored`, and only ONCE per session across both boundaries. A session
 * can be compacted more than once and each compaction is a real, separate loss,
 * which is a genuine argument for repeating it; the latch wins anyway, for
 * `AskLatch.disclosedIgnored`'s reason. The audit row records every occurrence,
 * so nothing is dropped — it is only said aloud once.
 *
 * **The latch is written BEFORE the line is returned, and the line is withheld
 * when the write fails**, which is `standDownOnce`'s rule and it is the same
 * rule: a disclosure that cannot record having been made is a disclosure that
 * will be made again.
 *
 * Never throws — `writeLatch` swallows every filesystem outcome and this
 * function does nothing else.
 */
export function discloseIgnoredAsk(
  root: string, sessionId: string, check: HandoverAskCheck, occasion: string,
): string {
  if (check.verdict !== 'ignored') return '';
  const latch = readLatch(root, sessionId);
  if (latch.disclosedIgnored) return '';
  if (!writeLatch(root, sessionId, { ...latch, disclosedIgnored: true })) return '';
  return ignoredAskLine(check, occasion);
}

/**
 * The whole resolved configuration for a workspace, or `null` for every reason
 * there is not one. `root` is the `.my_context` directory.
 *
 * **`resolveWorkspace` throws on a `config.json` that is not valid JSON**, and
 * that throw is caught here rather than left to a caller's outer catch. A
 * broken config turns this feature off; it does not stop a hook doing its
 * actual job — `Stop` still writes the row that says where one turn ended and
 * the next began, and `SessionEnd` still clears the window a `/clear`
 * destroyed. That is the same choice `session-end.ts` makes by reaching for
 * `findProjectRoot` rather than `resolveWorkspace`, and this function is how a
 * hook that has already made it can still ask about the handover.
 *
 * `path.dirname(root)` because `resolveWorkspace` takes a directory to search
 * FROM, and `root` is the `.my_context` inside it.
 */
export function workspaceConfigAt(root: string): Config | null {
  try {
    return resolveWorkspace(path.dirname(root)).config;
  } catch {
    return null;
  }
}

/** `workspaceConfigAt`, narrowed to the one key three hooks want out of it. */
export function handoverConfigAt(root: string): HandoverConfig | null {
  return workspaceConfigAt(root)?.handover ?? null;
}
