/**
 * **The redacted copy: the mirror with exactly the ticked values faked, and
 * nothing else touched.** `plan:archive seq:46`, step 4.
 *
 * ── WHY THIS IS A SECOND FILE AND NOT THE MIRROR REWRITTEN ────────────────
 *
 * `plan:archive seq:4` made the mirror byte-for-byte the first `bytes` bytes
 * of the transcript, and everything the mark can promise rests on that: an
 * interrupted append costs the partial line rather than the file, and
 * `stillPrefix` can tell "this transcript grew" from "a different file is now
 * at this path" by comparing the last page of both. Redacting the mirror in
 * place would end all three properties at once — the copy would stop being a
 * prefix of anything, `bytes` would stop being its length, and the integrity
 * check would report every mark as broken on the next turn.
 *
 * So the mirror stays the RECORD and this is the SHAREABLE COPY, derived from
 * it. That is not the "two copies to disagree about" that `seq:4` refused when
 * it declined a separate `export` verb: those would have been two answers to
 * one question. These are two different things, one derived from the other by
 * a plan on disk, and the derived one names its source and its plan in its own
 * sidecar.
 *
 * ── THE PLAN CARRIES IDS AND NEVER VALUES, AND THAT IS THE POINT ──────────
 *
 * `conversation-secrets.ts` gives a candidate an id that is a HASH of its
 * value. So the plan a person's choice produces is a list of ids, and the tail
 * appended after that choice is redacted by SCANNING IT AGAIN and replacing
 * the matches whose id is in the list. Nothing on this path stores a
 * credential: not the report, not the form's payload, not the plan file — and
 * the plan file is the one that would otherwise sit unencrypted beside the
 * copy for ever.
 *
 * It also answers `seq:46`'s two hardest requirements without any further
 * machinery, because both fall out of the hash:
 *
 *   - *"a choice made once must apply to everything appended AFTERWARDS, or
 *     the first tail after an export reintroduces the secret"* — the plan
 *     outlives the export event, and `advanceRedaction` runs on the same pass
 *     that advances the mirror.
 *   - *"the same secret appearing twice must get the same placeholder"* — one
 *     value hashes to one id, hence to one placeholder, in every record and in
 *     every future tail.
 *
 * ── AND THE DEFAULT PATH WRITES NOTHING ───────────────────────────────────
 *
 * There is no plan until somebody makes one, so `advanceRedaction` costs one
 * `existsSync` per mark and every `mycontext conversation persist` that nobody
 * asked to redact produces the byte-faithful mirror `seq:4` always produced.
 * With an empty accepted set `redactLine` returns its input, so even a plan
 * that accepts nothing yields a copy that is byte-for-byte the mirror — proved
 * in `test/core/conversation-redaction.test.ts` rather than argued here.
 */
import {
  closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readFileSync, readSync, renameSync,
  rmSync, statSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { redactLine, scanSessionSecrets, type SecretScan } from './conversation-secrets.ts';

/** How much is read per pass. The 1 MiB every reader in the archive uses. */
const CHUNK_BYTES = 1024 * 1024;

/** The plan's own shape version. A plan this build cannot read is regenerated. */
export const REDACTION_PLAN_VERSION = 1;

/**
 * **The choice, and how far it has been applied** — one JSON file beside the
 * copy it explains.
 *
 * It is a file rather than a column on the `persisted` row for one reason
 * worth stating: `persisted` is the archive's own schema, `openReadOnlyChecked`
 * treats a missing column as an index built by an older build, and adding one
 * would put every existing workspace through a rebuild in order to ship a
 * feature nobody has turned on. The plan belongs to the copy, so it lives
 * beside the copy — and `mycontext conversation persist --off` leaves both,
 * exactly as it already leaves the mirror.
 */
export interface RedactionPlan {
  version: number;
  sessionId: string;
  /** Candidate ids, sorted. The whole of the person's choice. */
  accepted: string[];
  /** id → shape, for the ids the scan could resolve. A label, not a key. */
  shapes: Record<string, string>;
  /** id → what it becomes. Written down so a reader of the copy can grep it. */
  placeholders: Record<string, string>;
  /** Bytes of the MIRROR already projected into the copy. */
  sourceBytes: number;
  /** Bytes the copy holds. Truncated back to this before any append. */
  outputBytes: number;
  /** Records written. */
  records: number;
  /** Occurrences replaced so far — the number that shows the plan working. */
  replaced: number;
  /** Lines the redactor could not parse and therefore left VERBATIM. */
  unreadable: number;
  /** When the choice was made. Never moved by an append. */
  chosenAt: string;
  /** When the copy last caught up. */
  projectedAt: string;
}

/** `…/<session>.redacted.jsonl` — the copy with the ticked values faked. */
export function redactedCopyPath(mirror: string): string {
  return mirror.replace(/\.jsonl$/, '') + '.redacted.jsonl';
}

/** `…/<session>.redaction.json` — the choice, and how far it has been applied. */
export function redactionPlanPath(mirror: string): string {
  return mirror.replace(/\.jsonl$/, '') + '.redaction.json';
}

/**
 * The plan, or `null` when there is none — which is the ordinary state and not
 * a fault.
 *
 * A plan that will not parse, or that this build does not know the shape of,
 * is also `null`: the caller's answer to both is to regenerate from the
 * choice, and a half-read plan would resume an append at an offset it cannot
 * justify.
 */
export function readRedactionPlan(mirror: string): RedactionPlan | null {
  const file = redactionPlanPath(mirror);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const plan = parsed as Partial<RedactionPlan>;
  if (plan.version !== REDACTION_PLAN_VERSION) return null;
  if (!Array.isArray(plan.accepted) || typeof plan.sessionId !== 'string') return null;
  return {
    version: REDACTION_PLAN_VERSION,
    sessionId: plan.sessionId,
    accepted: plan.accepted.filter((id): id is string => typeof id === 'string'),
    shapes: plan.shapes ?? {},
    placeholders: plan.placeholders ?? {},
    sourceBytes: typeof plan.sourceBytes === 'number' ? plan.sourceBytes : 0,
    outputBytes: typeof plan.outputBytes === 'number' ? plan.outputBytes : 0,
    records: typeof plan.records === 'number' ? plan.records : 0,
    replaced: typeof plan.replaced === 'number' ? plan.replaced : 0,
    unreadable: typeof plan.unreadable === 'number' ? plan.unreadable : 0,
    chosenAt: typeof plan.chosenAt === 'string' ? plan.chosenAt : new Date().toISOString(),
    projectedAt: typeof plan.projectedAt === 'string' ? plan.projectedAt : new Date().toISOString(),
  };
}

/** Write the plan atomically, so an interrupted write cannot leave half of one. */
function writeRedactionPlan(mirror: string, plan: RedactionPlan): void {
  const file = redactionPlanPath(mirror);
  mkdirSync(path.dirname(file), { recursive: true });
  const scratch = `${file}.tmp`;
  writeFileSync(scratch, JSON.stringify(plan, null, 2) + '\n');
  renameSync(scratch, file);
}

/** A file's size, or `null` when it is not there. */
function sizeOf(file: string): number | null {
  try {
    const stat = statSync(file);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

/** What one projection pass did. */
interface Projected {
  /** Bytes of the source consumed — always ending on a line boundary. */
  sourceBytes: number;
  /** Bytes the copy now holds. */
  outputBytes: number;
  records: number;
  replaced: number;
  unreadable: number;
}

/**
 * **Project `[from, to)` of `source` into `target`, line by line.**
 *
 * Truncates the copy back to `outputFrom` BEFORE it writes a byte — the same
 * ordering `appendTail` uses in `conversation-mirror.ts` and for the same
 * reason: an interrupted pass then costs the partial line rather than
 * duplicating one, and the copy is valid JSONL at every instant a reader could
 * open it.
 *
 * A line nothing was replaced in is written back as its ORIGINAL BYTES rather
 * than re-serialised. That is what makes the byte-faithful default exact: with
 * an empty accepted set every line takes that path, so the copy is the file
 * and not a reformatting of it.
 *
 * Stops at the last newline in the range. A trailing partial line is left for
 * the next pass — the mirror always ends on a line boundary, so in practice
 * this only ever happens to a copy of a file being written to.
 */
function project(
  source: string, target: string, accepted: ReadonlySet<string>,
  from: number, to: number, outputFrom: number,
): Projected {
  const done: Projected = {
    sourceBytes: from, outputBytes: outputFrom, records: 0, replaced: 0, unreadable: 0,
  };
  if (to <= from) return done;
  mkdirSync(path.dirname(target), { recursive: true });
  const src = openSync(source, 'r');
  try {
    const dst = openSync(target, existsSync(target) ? 'r+' : 'w');
    try {
      ftruncateSync(dst, outputFrom);
      const buffer = Buffer.alloc(CHUNK_BYTES);
      /** The bytes of a line the last chunk ended in the middle of. */
      let carry: Buffer | null = null;
      let at = from;
      let outAt = outputFrom;
      const emit = (line: Buffer): void => {
        done.records += 1;
        let bytes = line;
        if (line.length > 0) {
          const result = redactLine(line.toString('utf8'), accepted);
          if (result.unreadable) done.unreadable += 1;
          if (result.replaced > 0) {
            done.replaced += result.replaced;
            bytes = Buffer.from(result.text, 'utf8');
          }
        }
        if (bytes.length > 0) {
          writeSync(dst, bytes, 0, bytes.length, outAt);
          outAt += bytes.length;
        }
        writeSync(dst, NEWLINE, 0, 1, outAt);
        outAt += 1;
      };
      while (at < to) {
        const want = Math.min(CHUNK_BYTES, to - at);
        const read = readSync(src, buffer, 0, want, at);
        if (read <= 0) break;
        const view = buffer.subarray(0, read);
        const chunkAt = at;
        at += read;
        let cut = 0;
        for (;;) {
          const nl = view.indexOf(0x0a, cut);
          if (nl === -1) break;
          const line = carry === null
            ? view.subarray(cut, nl)
            : Buffer.concat([carry, view.subarray(cut, nl)]);
          carry = null;
          cut = nl + 1;
          emit(line);
          done.sourceBytes = chunkAt + cut;
          done.outputBytes = outAt;
        }
        if (cut < read) {
          const rest = view.subarray(cut, read);
          carry = carry === null ? Buffer.from(rest) : Buffer.concat([carry, rest]);
        }
      }
      // The trailing fragment is deliberately NOT emitted. It is a record
      // still being written, and half a JSON object in the copy would be a
      // silent corruption of the one file this whole feature exists to make
      // safe to hand to somebody.
      ftruncateSync(dst, done.outputBytes);
      return done;
    } finally {
      try { closeSync(dst); } catch { /* nothing usable to close */ }
    }
  } finally {
    try { closeSync(src); } catch { /* nothing usable to close */ }
  }
}

/** One byte, allocated once — `writeSync` needs a buffer and this one never changes. */
const NEWLINE = Buffer.from('\n');

/** What a choice, or one pass keeping up with it, produced. */
export interface RedactionResult {
  /** The redacted copy — the file to hand to somebody. */
  file: string;
  /** The plan beside it. */
  planFile: string;
  /** The mirror it was derived from. */
  from: string;
  plan: RedactionPlan;
  /** Bytes written by THIS pass. `0` on a copy that was already caught up. */
  written: number;
  /** The copy was rebuilt from byte 0 rather than appended to. */
  regenerated: boolean;
  /** Accepted ids the scan of the mirror could not find anything for. */
  unresolved: string[];
  ms: number;
}

/** The mirror is not on disk, so there is nothing to derive a copy from. */
export class NoMirrorError extends Error {}

/**
 * **Take the choice and build the copy** — the call site of
 * `redactString`, and the whole of `mycontext conversation persist --replace`.
 *
 * The copy is always rebuilt from byte 0 here, never appended to, and that is
 * the only correct answer when the accepted set CHANGES: a placeholder already
 * written cannot be un-written incrementally, so unticking a box has to mean
 * re-deriving the file. It is affordable because it happens when a person
 * chooses, not on a hook.
 *
 * The mirror is scanned once more in order to RESOLVE the ids into shapes and
 * placeholders for the plan — and to report the ids that resolve to nothing,
 * which is what a mistyped id looks like. An unresolved id is kept in the plan
 * rather than dropped: the value may appear in a tail appended later, and
 * silently forgetting a choice is the one thing this design must not do.
 */
export function chooseRedactions(
  mirror: string, sessionId: string, accepted: readonly string[],
): RedactionResult {
  const startedMs = Date.now();
  const mirrorBytes = sizeOf(mirror);
  if (mirrorBytes === null) {
    throw new NoMirrorError(
      `my_context: there is no copy of session "${sessionId}" at ${mirror}, so there is nothing ` +
      'to derive a redacted copy from. `mycontext conversation persist ' +
      `${sessionId}\` makes the copy first; this replaces values inside it.`,
    );
  }
  const ids = [...new Set(accepted)].sort();
  const wanted = new Set(ids);
  const scan = scanSessionSecrets(mirror);
  const shapes: Record<string, string> = {};
  const placeholders: Record<string, string> = {};
  for (const candidate of scan.candidates) {
    if (!wanted.has(candidate.id)) continue;
    shapes[candidate.id] = candidate.shape;
    placeholders[candidate.id] = candidate.placeholder;
  }
  const unresolved = ids.filter((id) => !Object.hasOwn(shapes, id));

  const target = redactedCopyPath(mirror);
  const done = project(mirror, target, wanted, 0, mirrorBytes, 0);
  const now = new Date().toISOString();
  const existing = readRedactionPlan(mirror);
  const plan: RedactionPlan = {
    version: REDACTION_PLAN_VERSION,
    sessionId,
    accepted: ids,
    shapes,
    placeholders,
    sourceBytes: done.sourceBytes,
    outputBytes: done.outputBytes,
    records: done.records,
    replaced: done.replaced,
    unreadable: done.unreadable,
    chosenAt: existing?.chosenAt ?? now,
    projectedAt: now,
  };
  writeRedactionPlan(mirror, plan);
  return {
    file: target,
    planFile: redactionPlanPath(mirror),
    from: mirror,
    plan,
    written: done.outputBytes,
    regenerated: true,
    unresolved,
    ms: Date.now() - startedMs,
  };
}

/**
 * **Keep the copy up with the mirror** — one append, on the same pass that
 * appended to the mirror.
 *
 * `null` when there is no plan, which is every session nobody has chosen
 * anything for. That is what keeps this off the cost of the ordinary path.
 *
 * A copy whose own size no longer matches what the plan agreed it holds, or
 * whose source has SHRUNK below the offset the plan resumed from, is rebuilt
 * from byte 0 rather than appended to — `conversation-mirror.ts`' own argument
 * for refusing to resume: appending the tail of one file onto the body of
 * another is a corruption every count would still add up over.
 */
export function advanceRedaction(mirror: string, sessionId: string): RedactionResult | null {
  const startedMs = Date.now();
  const plan = readRedactionPlan(mirror);
  if (plan === null) return null;
  const mirrorBytes = sizeOf(mirror);
  if (mirrorBytes === null) return null;
  const target = redactedCopyPath(mirror);
  const outputBytes = sizeOf(target);
  const resumable = outputBytes === plan.outputBytes && mirrorBytes >= plan.sourceBytes;
  if (!resumable) return chooseRedactions(mirror, sessionId, plan.accepted);
  if (mirrorBytes === plan.sourceBytes) {
    return {
      file: target,
      planFile: redactionPlanPath(mirror),
      from: mirror,
      plan,
      written: 0,
      regenerated: false,
      unresolved: [],
      ms: Date.now() - startedMs,
    };
  }
  const done = project(
    mirror, target, new Set(plan.accepted), plan.sourceBytes, mirrorBytes, plan.outputBytes,
  );
  const next: RedactionPlan = {
    ...plan,
    sourceBytes: done.sourceBytes,
    outputBytes: done.outputBytes,
    records: plan.records + done.records,
    replaced: plan.replaced + done.replaced,
    unreadable: plan.unreadable + done.unreadable,
    projectedAt: new Date().toISOString(),
  };
  writeRedactionPlan(mirror, next);
  return {
    file: target,
    planFile: redactionPlanPath(mirror),
    from: mirror,
    plan: next,
    written: done.outputBytes - plan.outputBytes,
    regenerated: false,
    unresolved: [],
    ms: Date.now() - startedMs,
  };
}

/**
 * Drop the plan and the copy it produced.
 *
 * Unlike the mirror, this one CAN be deleted without destroying knowledge: it
 * is derived, the mirror it came from is untouched, and re-running the choice
 * rebuilds it byte for byte. That asymmetry is the whole reason `persist --off`
 * refuses to delete a mirror and this exists at all.
 */
export function clearRedactions(mirror: string): boolean {
  const plan = redactionPlanPath(mirror);
  const copy = redactedCopyPath(mirror);
  let removed = false;
  for (const file of [plan, copy]) {
    if (!existsSync(file)) continue;
    try { unlinkSync(file); removed = true; } catch { rmSync(file, { force: true }); }
  }
  return removed;
}

/** Re-export so a caller needs one import for the scan and its call site. */
export type { SecretScan };
