/**
 * **The READ half of lesson staging — everything that only looks at
 * `.staging/*.json`, in a module that imports nothing which writes.**
 *
 * Owner ruling `DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read`
 * (2026-09-06). The measured problem it settles: `listStaging` lived in
 * `lesson/derive.ts`, which VALUE-IMPORTS `createItem` from `core/mutate.ts`,
 * so the read server could not list what is waiting for a human without
 * pulling the mutation surface into its runtime import graph.
 * `src/ui/read-model.ts` had already refused exactly that read for exactly
 * that reason (`StatusBody`, on `st.staged`), and `palette-defs.js` had
 * refused the `key` picker on `lesson-accept` for the same one.
 *
 * **Measured, before and after.** The runtime import graph (type-only imports
 * erased, as `tsconfig.json`'s `verbatimModuleSyntax` + `erasableSyntaxOnly`
 * guarantee) from `lesson/derive.ts` is 35 files and reaches `core/mutate.ts`
 * and `core/persist.ts` — the code that writes item Markdown. From THIS file
 * it is 1 file: this one. There is no project import here at all, only
 * `node:fs` and `node:path`, and both are used for reads —
 * `existsSync`/`readFileSync`/`readdirSync` and nothing else.
 * `test/ui/staging-endpoint.test.ts` walks that graph and fails if a writer
 * ever becomes reachable, so the boundary is enforced rather than asserted.
 *
 * **What must NOT happen to this file** (the ruling names both): it must not
 * grow the write half back, and `derive.ts` must not RE-EXPORT what is here.
 * A re-export would leave every caller's import graph exactly as it was while
 * the diff looked like a fix, so `derive.ts` imports these symbols for its own
 * use and every other caller — the CLI, the MCP server, the read server —
 * imports them from here.
 *
 * The doc comments below travelled with their functions unchanged. They record
 * defects that were found and fixed in this code; moving the code without them
 * would move the code back to before those fixes were understood.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const STAGING_PROTOCOL = 'my_context/lesson-staging@1';

export interface RuleCandidate {
  title: string;
  directive: 'do' | 'dont';
  body: string;
  scope: string[];
  severity: 'hard' | 'soft';
}

export interface StagedRule {
  /** Stable handle used by `mycontext lesson-accept`. */
  key: string;
  candidate: RuleCandidate;
  state: 'pending' | 'accepted' | 'discarded';
  ruleId: string | null;
}

export interface LessonStaging {
  protocol: string;
  lessonId: string;
  createdAt: string;
  candidates: StagedRule[];
}

export function stagingDir(root: string): string {
  return path.join(root, '.staging');
}

/**
 * A lesson id becomes both a JSON filename (`stagingFile`, below) and a
 * relation target written into a rule's frontmatter (`acceptStagedRule`).
 * Task 9 takes this id from argv, so an id containing a path separator
 * (`/` or `\`) would let `stagingFile` read or write outside `.staging/` —
 * the same class of hazard `validateRelationTarget` (core/validate.ts) guards for
 * relation targets in general, checked here at the one place this module
 * turns an id into a filesystem path. Note: this pattern allows `.` and
 * therefore allows a lone `..` segment — harmless here only because there is
 * no path separator alongside it for `..` to act on (`stagingFile` always
 * appends it as one whole `${lessonId}.json` filename component, never a
 * directory segment), not because the pattern itself excludes it.
 */
const LESSON_ID_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Exported because `saveStaging` (`derive.ts`) resolves the SAME path this
 * function resolves, and the id check above is the guard on the write as much
 * as on the read. Two spellings of "which file is this lesson's" is exactly
 * how a write lands somewhere a read never looks.
 */
export function stagingFile(root: string, lessonId: string): string {
  if (!LESSON_ID_RE.test(lessonId)) {
    throw new Error(
      `my_context: "${lessonId}" is not a valid lesson id — only letters, digits, ".", "_" and ` +
      `"-" are allowed, so it cannot safely be used as a staging file name.`,
    );
  }
  return path.join(stagingDir(root), `${lessonId}.json`);
}

/**
 * Reads `.staging/<lessonId>.json`.
 *
 * Returns `null` for exactly ONE case — the file does not exist — and THROWS
 * for a file that exists but cannot be trusted (unparseable JSON, a
 * non-object payload, a wrong/garbled `protocol`, a `lessonId` field that
 * disagrees with the filename, or a `candidates` field that is not an
 * array). Collapsing those two outcomes into one `null` was a real defect:
 * `stageRuleCandidates` read `null` as "nothing here yet" and OVERWROTE a
 * corrupt file, which meant a candidate a human had already discarded came
 * back `pending` and acceptable; `lesson-accept` read the same `null` as
 * "nothing staged" and told the user to run `lesson-stage`, i.e. steered
 * them into that overwrite. A corrupt staging file is working state a human
 * has to look at, so every caller now has to handle it as its own case.
 *
 * The thrown messages deliberately name the file's path rather than
 * suggesting a re-stage: `stageRuleCandidates` refuses on the same condition,
 * so "re-run lesson-stage to regenerate it" would not be true of what this
 * code does.
 *
 * What this does NOT check is provenance. A hand-written
 * `.staging/<realLessonId>.json` with the right protocol and a matching
 * `lessonId` is indistinguishable from a real one and is accepted. The
 * staging directory is unauthenticated working state; this function only
 * checks the SHAPE the rest of this module depends on.
 */
export function loadStaging(root: string, lessonId: string): LessonStaging | null {
  const file = stagingFile(root, lessonId);
  if (!existsSync(file)) return null;

  const corrupt = (reason: string): Error => new Error(
    `my_context: the staging file for ${lessonId} cannot be trusted — ${reason}. Refusing to read or ` +
    `overwrite it, because it may record candidates a human already accepted or discarded. Inspect ` +
    `${file} and delete it if it is genuinely junk, then re-stage.`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw corrupt(`it is not valid JSON (${err instanceof Error ? err.message : String(err)})`);
  }

  if (!isObject(parsed)) {
    throw corrupt(`its top level is ${parsed === null ? 'null' : Array.isArray(parsed) ? 'an array' : `a ${typeof parsed}`}, not an object`);
  }

  const staging = parsed as unknown as LessonStaging;
  if (staging.protocol !== STAGING_PROTOCOL) {
    throw corrupt(
      `its protocol is ${JSON.stringify(staging.protocol)}, expected ${JSON.stringify(STAGING_PROTOCOL)} ` +
      `(it may be from an incompatible version)`,
    );
  }

  // `saveStaging` derives the FILENAME from `staging.lessonId`, and every
  // legitimate write path (`stageRuleCandidates`) sets that field to the
  // same lesson it was called with — so on a normal, untampered file the two
  // always agree. They can disagree only if something wrote (or rewrote) the
  // file directly rather than through this module's own save path: a file
  // literally named `<lessonId>.json` whose CONTENTS name a different
  // lesson. Without this check, `acceptStagedRule` would create the
  // rule and write its `derived_from` relation using whichever lesson id it
  // trusted, while persisting the resulting `accepted` state to a FILE NAMED
  // AFTER THE OTHER ONE (`saveStaging` uses `staging.lessonId` for the
  // filename) — leaving the file this function was asked to load still
  // `pending`, so a second accept against the same key would silently
  // succeed again.
  if (staging.lessonId !== lessonId) {
    throw new Error(
      `my_context: the staging file for "${lessonId}" names a different lesson internally ` +
      `(${JSON.stringify(staging.lessonId)}) than its filename (${JSON.stringify(lessonId)}). Refusing to ` +
      `trust it — this file may have been copied from another lesson's staging or edited by hand. ` +
      `Inspect ${file} and delete it if it is genuinely junk, then re-stage.`,
    );
  }

  if (!Array.isArray(staging.candidates)) {
    throw corrupt(`its "candidates" field is ${JSON.stringify(staging.candidates)}, not an array`);
  }

  return staging;
}

/** One `.staging/*.json` this sweep would not read, and the reason in words. */
export interface SkippedStaging {
  /** The bare filename, never an absolute path — this travels to a browser. */
  file: string;
  reason: string;
}

/**
 * **Every `.staging/*.json` this directory holds, and every one that was NOT
 * read, with the reason.**
 *
 * `listStaging` below is this function with the second half thrown away, which
 * is what it always was — the loop it replaced ended `catch { /* skip *​/ }`,
 * and a status line reading *"3 staged lessons"* over a directory of five
 * files was indistinguishable from a correct one. `INV-nothing-is-dropped-silently`
 * is the rule that makes that a defect rather than a tidiness question, and a
 * PICKER is where it bites hardest: a `key` box that silently omits the lesson
 * a reader is looking for reads as "there is nothing staged for it".
 *
 * **Skipped, not thrown.** `loadStaging` refuses one named file and throws,
 * because its caller asked about that file and a wrong answer about it is
 * worse than no answer. A sweep is asked about the DIRECTORY, and one junk
 * file must not make the other four unlistable — so every refusal
 * `loadStaging` would throw becomes a row here instead, and the caller decides
 * how loudly to say it.
 *
 * The checks are `loadStaging`'s, minus provenance, in the same order and for
 * the same reasons — including two the old loop did not make: `candidates`
 * being an array, and the file's own `lessonId` agreeing with its filename.
 * Both were latent: `status.ts` calls `.filter` on `candidates` (`cli/commands/status.ts`
 * · `listStaging(ws.projectRoot)`), which is a TypeError on a string, and a
 * file whose contents name another lesson would have offered a `key` under the
 * wrong lesson id — composing `mycontext lesson-accept <wrong-lesson> <key>`,
 * which the CLI then refuses in a sentence about a candidate that does exist.
 *
 * A missing or unreadable `.staging` directory is not a skip and not an error:
 * a project that has never staged anything has nothing to report, which is the
 * empty answer this returns.
 */
export function readStagingDir(root: string): { staging: LessonStaging[]; skipped: SkippedStaging[] } {
  const dir = stagingDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return { staging: [], skipped: [] };
  }

  const staging: LessonStaging[] = [];
  const skipped: SkippedStaging[] = [];
  const skip = (file: string, reason: string): void => { skipped.push({ file, reason }); };

  for (const name of names.sort()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      skip(name, `it could not be read as JSON (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (!isObject(parsed)) {
      skip(name, `its top level is ${parsed === null ? 'null' : Array.isArray(parsed) ? 'an array' : `a ${typeof parsed}`}, not an object`);
      continue;
    }
    const one = parsed as unknown as LessonStaging;
    if (one.protocol !== STAGING_PROTOCOL) {
      skip(name, `its protocol is ${JSON.stringify(one.protocol)}, not ${JSON.stringify(STAGING_PROTOCOL)}`);
      continue;
    }
    if (typeof one.lessonId !== 'string' || `${one.lessonId}.json` !== name) {
      skip(name, `it names lesson ${JSON.stringify(one.lessonId)} internally, which is not the lesson its filename names`);
      continue;
    }
    if (!Array.isArray(one.candidates)) {
      skip(name, `its "candidates" field is ${JSON.stringify(one.candidates)}, not an array`);
      continue;
    }
    staging.push(one);
  }

  staging.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
  return { staging, skipped };
}

/**
 * The staged lessons, for callers that only want a count or a list and have
 * nowhere to put what was skipped (`status --json`, the MCP `ready` tool).
 * `readStagingDir` is the one that can say what it left out; prefer it on any
 * surface that has room for the sentence.
 */
export function listStaging(root: string): LessonStaging[] {
  return readStagingDir(root).staging;
}

/**
 * Shared with `derive.ts` rather than spelled twice: it is the guard both
 * `loadStaging` above and `validateRuleCandidates` there use to decide that a
 * parsed value is an object at all, and two copies of it is two things that
 * can come to disagree about `null` or an array.
 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
