import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isAcknowledged } from '../core/acknowledge.ts';
import {
  AUDIT_MAX_BYTES, AUDIT_REPORT_BYTES, auditDir, auditSize, readAudit, type AuditRecord,
} from '../core/audit.ts';
import { scopePolicyFor, skippedKeyNotice, type Config } from '../core/config.ts';
import {
  governs, isEligible, itemCost, RETIRED_STATUSES, standDownFields, STOOD_DOWN_STATUSES,
} from '../core/select.ts';
// `plan:contra seq:3` — the DRAIN. The gate's own predicates, its own
// measurement and its own verdict log, so the sweep and the write path cannot
// come to different answers about the same pair. `verdict-store.ts` exists so
// this module can read those rulings without importing the one that writes
// items: `ui/read-model.ts` reaches this file for `/api/doctor`.
import {
  governsNow, inContradictionScope, latestVerdicts, overlapPartsOfTokens, overlapTokensOf,
  pairKey, CONTRADICTION_THRESHOLD, OVERLAP_THRESHOLD,
} from '../core/overlap.ts';
import { contradictionBasis, readVerdicts } from '../core/verdict-store.ts';
import {
  BLOCKED_STATE, buildTaskIndex, NEEDS_FIELD, readNeeds, workItems,
} from '../core/needs.ts';
import { globToRegExp, matchesAnyGlob, normalizePosix, relPosix } from '../core/paths.ts';
import { summaryState } from '../core/content-hash.ts';
import { isSnapshot, snapshotText } from '../core/reference.ts';
import { RATIONALE_NOT_INJECTED } from '../core/render-item.ts';
import { checksum } from '../core/slug.ts';
import { projectionMismatches } from '../core/tag-projection.ts';
import {
  loadTutorialManifest, TUTORIAL_MANIFEST_PATH, type TutorialManifestEntry,
} from '../core/tutorial-manifest.ts';
import { SUMMARY_MAX_CHARS } from '../core/validate.ts';
import type { Item } from '../core/types.ts';
import { chunkDocument } from '../ingest/chunk.ts';
import { ingestDir, SESSION_PROTOCOL } from '../ingest/session.ts';
import { ACK, AUDIT_FILES, DECAY, NOTHING, PERSON, REBUILD, REPAIR, refreshRemedy, stateTodoRemedy } from './finding.ts';
import type { Finding, RemedyValues } from './finding.ts';
import { FILE_LIMIT, SKIP_DIRS, listFilesForScopeCheck, listRepoFiles, newestMarkdownMtime } from './repo-files.ts';
import {
  checkGoverningSpillPressure, checkStateUnaudited, checkTaskUnverified, type AuditReader,
} from './state-verification.ts';
import { checkBodyAgreement, checkBodyTruncation, checkCitationForm, checkLaunderedEnum } from './body-integrity.ts';

// Re-exported so every existing importer of `doctor/checks.ts` keeps working: the
// split moved code, not surface. `TASK-the-checks-file-splits-along-a-boundary-its-own-tests`.
export { REMEDY } from './finding.ts';
export type { Finding, Remedy, RemedyValues } from './finding.ts';
export { listRepoFiles } from './repo-files.ts';
export { checkGoverningSpillPressure, checkStateUnaudited, checkTaskUnverified } from './state-verification.ts';
export { CLI_BIN_NAME, checkCliOnPath, defaultCliLookup, readShimTarget } from './cli-on-path.ts';
export type { CliLookup } from './cli-on-path.ts';
export { checkBodyAgreement, checkBodyTruncation, checkCitationForm, checkLaunderedEnum } from './body-integrity.ts';
/**
 * Turns the `'migration'`-kind `LoadError`s `loadLayer` produces (see
 * `LoadError.kind`, rebuild.ts) into ordinary `warn`-level `Finding`s, so
 * `mycontext doctor` can report a corpus sitting on an old checksum basis
 * for what it is — a migration `mycontext repair` clears — rather than
 * folding it into the `error`-level "corpus load errors" block that drives
 * doctor's non-zero exit code (`exitCode`, cli/commands/doctor.ts).
 *
 * NOT part of `runChecks`: every other caller of that function (`ack`,
 * `status`, the UI read-model) never sees `LoadError`s at all — it takes
 * `items`, not `errors` — so folding this in there would require threading
 * `errors` through every one of them for a distinction only `doctor` was
 * asked to make. `doctor.ts` calls this directly, alongside `runChecks`,
 * and nowhere else needs to.
 *
 * `item` is recovered from the message's own `"<id>"` rather than carried
 * as a separate field on `LoadError` — the id is already there once, in the
 * one place every reader of a `LoadError` already looks, and duplicating it
 * is exactly the kind of second copy that drifts from the first.
 */
export function checksumMigrationFindings(errors: { file: string; message: string; kind?: string }[]): Finding[] {
  return errors
    .filter((e) => e.kind === 'migration')
    .map((e) => {
      const m = /checksum mismatch for "([^"]+)":/.exec(e.message);
      return {
        level: 'warn',
        code: 'checksum_basis_migration',
        remedy: REPAIR,
        item: m ? m[1] : undefined,
        message: e.message,
      };
    });
}

/**
 * Index freshness compares against `.md` mtimes under `root/items` AND
 * `root/config.json` (folded in below) — but it does NOT see edits to a
 * neighboring global layer. The absence of an `index_stale` finding is
 * therefore not proof the index reflects global-layer state, only that no
 * *project* item file or config outran it. A full fix needs the global
 * root threaded through from the caller; out of scope for this check's
 * current signature, but a real gap — recorded for Task 12/15.
 */
export function checkIndexFreshness(root: string, dbPath: string): Finding[] {
  if (!existsSync(dbPath)) {
    return [{
      level: 'info', code: 'index_missing',
      remedy: NOTHING,
      message: `no index at ${dbPath}. It is disposable and will be built on the next command.`,
    }];
  }

  let indexMtime: number;
  try {
    indexMtime = statSync(dbPath).mtimeMs;
  } catch (err) {
    return [{
      level: 'error', code: 'index_unreadable',
      remedy: PERSON,
      message: `cannot stat ${dbPath}: ${err instanceof Error ? err.message : String(err)}`,
    }];
  }

  let newest = newestMarkdownMtime(path.join(root, 'items'));
  try {
    newest = Math.max(newest, statSync(path.join(root, 'config.json')).mtimeMs);
  } catch {
    // No config.json, or it can't be stat'd: not a doctor finding on its own.
  }

  if (newest > indexMtime) {
    return [{
      level: 'warn', code: 'index_stale',
      remedy: REBUILD,
      message:
        `the index is older than the newest item file ` +
        `(${new Date(indexMtime).toISOString()} vs ${new Date(newest).toISOString()}). ` +
        `Run \`mycontext rebuild\`.`,
    }];
  }
  return [];
}

/**
 * Note for the caller (Task 12): this compares every relation's target
 * against `items` as a flat set of ids. If `items` is only the project
 * layer, a relation pointing at a real global-layer item will be reported as
 * an orphan — a false positive, not a bug in this function. Pass the full,
 * merged cross-layer item set.
 */
export function checkOrphanRelations(items: Item[]): Finding[] {
  const known = new Set(items.map((i) => i.id));
  const findings: Finding[] = [];

  for (const item of items) {
    for (const relation of item.relations) {
      if (known.has(relation.target)) continue;
      findings.push({
        level: 'warn', code: 'orphan_relation', item: item.id,
        remedy: ACK,
        message:
          `relation "${relation.type} [[${relation.target}]]" points at an item that does not exist. ` +
          `Create it, or remove the line from ${item.filePath}.`,
      });
    }
  }
  return findings;
}

/** Cap on how many current anchors get listed in a `source_anchor_missing`
 * message — an oversize PRD can have hundreds of sections, and dumping all
 * of them makes the finding unreadable rather than more useful. */
const MAX_LISTED_ANCHORS = 10;

/**
 * The drift check for a WHOLE-FILE SNAPSHOT — a `reference`-shaped item, whose
 * body is a copy of a file rather than an assertion extracted from a section
 * of one (`isSnapshot`, core/reference.ts, carries that distinction).
 *
 * It is a separate function from the anchored check below rather than a branch
 * inside it, because almost nothing is shared: there is no anchor to find, no
 * document to chunk, and — decisively — the remedy is different. An anchored
 * item's source changed under an assertion a human wrote, so the route is
 * "read it and judge it". A snapshot's source changed under a copy, so the
 * route is mechanical and has a command: `mycontext refresh <id>`. The
 * message names it, which is the requirement spec §2 states in as many words.
 *
 * `source_missing` is shared, and deliberately worded the same way: a file
 * that cannot be read is the same failure whichever shape pointed at it.
 */
function checkSnapshotDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];

  for (const item of items) {
    if (!isSnapshot(item)) continue;
    // Narrowing for the type checker; `isSnapshot` has already established it.
    const sourceFile = item.sourceFile as string;

    const absolute = path.resolve(repoRoot, ...sourceFile.split('/'));
    // Same rule as the anchored check: doctor only ever reads inside the
    // workspace it was pointed at, whether or not something exists outside it.
    const rel = relPosix(repoRoot, absolute);
    let live: string | null = null;
    if (rel !== '..' && !rel.startsWith('../')) {
      try {
        live = snapshotText(readFileSync(absolute, 'utf8'));
      } catch {
        live = null;
      }
    }

    if (live === null) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        remedy: ACK,
        message:
          `source document "${sourceFile}" could not be read (missing, unreadable, or outside the ` +
          `repository). ${item.id} still holds the snapshot taken when it was captured, and that ` +
          `text is unchanged — what cannot be checked is whether it is still current. Restore the ` +
          `file, or retire ${item.id} with \`mycontext supersede\`.`,
      });
      continue;
    }

    const liveChecksum = checksum(live);
    if (liveChecksum === item.sourceChecksum) continue;

    findings.push({
      level: 'warn', code: 'source_drift', item: item.id,
      remedy: refreshRemedy(item.id),
      message:
        `"${sourceFile}" has changed since ${item.id} snapshotted it ` +
        `(${item.sourceChecksum} → ${liveChecksum}). The item still holds the OLD text, and that ` +
        `is what any session reading it gets. Nothing was auto-resolved: run ` +
        `\`mycontext refresh ${item.id}\` to take a fresh snapshot, which shows you the size ` +
        `change and asks before it writes.`,
    });
  }

  return findings;
}

export function checkSourceDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = checkSnapshotDrift(repoRoot, items);
  const cache = new Map<string, ReturnType<typeof chunkDocument> | null>();

  for (const item of items) {
    if (!item.sourceFile || !item.sourceAnchor || !item.sourceChecksum) continue;

    if (!cache.has(item.sourceFile)) {
      const absolute = path.resolve(repoRoot, ...item.sourceFile.split('/'));
      // A source_file that climbs out of repoRoot (e.g. "../../etc/passwd")
      // is never trusted, whether or not something happens to exist there:
      // doctor only ever reads inside the workspace it was pointed at.
      const rel = relPosix(repoRoot, absolute);
      if (rel === '..' || rel.startsWith('../')) {
        cache.set(item.sourceFile, null);
      } else {
        try {
          cache.set(item.sourceFile, chunkDocument(readFileSync(absolute, 'utf8')));
        } catch {
          cache.set(item.sourceFile, null);
        }
      }
    }

    const chunks = cache.get(item.sourceFile);
    if (chunks === null || chunks === undefined) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        remedy: ACK,
        message:
          `source document "${item.sourceFile}" could not be read (missing, unreadable, or outside the ` +
          `repository). The item still stands, but its provenance cannot be verified. Clear source_file, ` +
          `or restore the document.`,
      });
      continue;
    }

    const chunk = chunks.find((c) => c.anchor === item.sourceAnchor);
    if (!chunk) {
      const anchors = chunks.map((c) => c.anchor);
      const listed = anchors.slice(0, MAX_LISTED_ANCHORS).join(', ');
      const suffix = anchors.length > MAX_LISTED_ANCHORS ? `, and ${anchors.length - MAX_LISTED_ANCHORS} more` : '';
      findings.push({
        level: 'warn', code: 'source_anchor_missing', item: item.id,
        remedy: ACK,
        message:
          `"${item.sourceFile}" no longer has a section anchored "${item.sourceAnchor}" — it was probably ` +
          `renamed. Current anchors: ${listed}${suffix}.`,
      });
      continue;
    }

    if (chunk.checksum !== item.sourceChecksum) {
      findings.push({
        level: 'warn', code: 'source_drift', item: item.id,
        remedy: refreshRemedy(item.id),
        message:
          `"${item.sourceFile}" § ${item.sourceAnchor} has changed since this item was captured ` +
          `(${item.sourceChecksum} → ${chunk.checksum}). Nothing was auto-resolved: read the section and ` +
          `update or supersede ${item.id} yourself.`,
      });
    }
  }

  return findings;
}

/**
 * What deleting a dead glob would actually do — which depends on the
 * category's TIER and then on its `scopePolicy`, not on a constant. This
 * sentence used to end "an item left with no globs at all is unrestricted and
 * injects on every file" unconditionally, which is true on neither axis: under
 * `inert` the item would stop being injected altogether, under `required` the
 * deletion is refused outright (`scopeRequirementError`, mutate.ts), and on
 * the rationale tier the item is injected on no file whatever its scope says.
 * Advice a reader can act on has to know which project — and which category —
 * it is talking about.
 */
function deletingTheGlob(config: Config, type: string): string {
  // Tier FIRST, mirroring `select`'s own order — `eligible.filter((i) =>
  // isNormative(i, config))` runs before anything reads `always` or `scope` —
  // and the same order `mycontext supersede`'s preview and `review promote`'s
  // completion line were already written in. Every `scopePolicy` branch below
  // makes a claim about injection, and not one of them is true on the
  // rationale tier: this sentence used to end "an item left with no globs at
  // all is unrestricted and injects on every file" for a `decision`, which is
  // injected on no file whatever its scope says.
  //
  // `RATIONALE_NOT_INJECTED` (core/render-item.ts) is the existing spelling
  // and is reused rather than reworded — an eighth wording for one fact is
  // this project's recurring defect class.
  //
  // The scope is still worth fixing on a rationale item, so the advice does
  // not stop at "it changes nothing": `matchesScope` is what
  // `query_items({path})` and `mycontext query` filter on, and those are the
  // surfaces through which a rationale item is actually reached.
  //
  // Same `isNormative` shape as select.ts, `Object.hasOwn`-guarded: a type of
  // "constructor" would otherwise resolve through `Object.prototype`. A
  // category absent from config resolves as NOT normative, which agrees with
  // `isNormative` — such an item is admitted to no full-text tier at all.
  const normative = Object.hasOwn(config.categories, type) &&
    config.categories[type].tier === 'normative';
  if (!normative) {
    return ` Deleting it would not widen what is injected: "${type}" is a rationale-tier ` +
      `category in this project — ${RATIONALE_NOT_INJECTED} — so an item of it reaches no ` +
      'file through its scope in the first place. The globs still decide what ' +
      '`query_items({path})` and `mycontext query` return for a path, which is what makes ' +
      're-scoping worth doing here.';
  }
  // **Every member named, and no `default`** —
  // `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan`. This
  // read `default:` and returned the WIDEST sentence — "unrestricted, and
  // injects on every file" — for anything that was not `required` or `inert`.
  // That is right for `global` and wrong for a fourth `ScopePolicy`, which
  // would have taken the permissive branch with nothing said. Spelled as an
  // exhaustive switch closed by `never`, it is a COMPILE error instead, which
  // is the shape `GOVERNING_STATUS` (trust.ts) already uses on `Status` and
  // for the same stated reason.
  const policy = scopePolicyFor(config, type);
  switch (policy) {
    case 'required':
      return ' Deleting it is not an option here: categories.' + type +
        '.scopePolicy is "required", so an item must keep at least one glob.';
    case 'inert':
      return ' Deleting it would not widen the item: categories.' + type +
        '.scopePolicy is "inert", so an item with no globs is injected on no file at all.';
    case 'global':
      return ' Deleting the glob is only right if the item should apply everywhere: scope ' +
        'restricts, so an item left with no globs at all is unrestricted and injects on every file.';
    default: {
      const unhandled: never = policy;
      throw new Error(
        `my_context: scopePolicy "${String(unhandled)}" has no sentence in doctor's dead-scope `
        + 'remedy. A new policy must say what deleting a glob does under it, rather than '
        + 'inheriting the widest answer by default.',
      );
    }
  }
}

export function checkDeadScopes(repoRoot: string, items: Item[], config: Config): Finding[] {
  const scoped = items.filter((i) => i.status === 'active' && i.scope.length > 0);
  if (scoped.length === 0) return [];

  const files = listFilesForScopeCheck(repoRoot);
  const findings: Finding[] = [];

  /**
   * **"Does this glob match anything?" asked once per DISTINCT glob, not once
   * per (item, glob) pair — and asked of a compiled RegExp rather than through
   * `matchesAnyGlob`.** Same question, same answer, two orders of magnitude
   * cheaper, and neither part changes what is decided.
   *
   * `matchesAnyGlob(f, [glob])` re-normalizes its SUBJECT on every call, and
   * the subject here is a repository file: 935 items' 286 glob instances
   * against 3,795 files is 1.09 million `normalizePosix` calls (each a
   * `split`/`join`, a `path.posix.normalize` and two `replace`s) plus 1.09
   * million throwaway `[glob]` arrays — for an answer that needs 117 regex
   * compilations. `globToRegExp`'s own cache (core/paths.ts) already made the
   * COMPILATION free; it could do nothing about the per-subject normalization
   * happening inside the loop, because that is `matchesAnyGlob`'s contract,
   * not the compiler's.
   *
   * Testing `re.test(f)` directly is sound because `listFilesForScopeCheck`
   * returns `relPosix` output, and `relPosix` ends in `normalizePosix` — the
   * paths are already in exactly the form `matchesAnyGlob` would have put them
   * in, and `normalizePosix` is idempotent, so the call it drops was a no-op
   * repeated a million times. Measured on this corpus: 557 ms -> 4 ms, with
   * the same 286 answers.
   *
   * The memo is keyed on the glob TEXT and holds a boolean about the file
   * list, so it is scoped to this one call and cannot go stale — a second
   * `checkDeadScopes` re-walks the repository and builds a new one. That is
   * deliberate: the staleness question the owner ruled on is about caching
   * ACROSS runs, and nothing here survives the return.
   */
  const matchedSomething = new Map<string, boolean>();
  const globMatches = (glob: string): boolean => {
    const seen = matchedSomething.get(glob);
    if (seen !== undefined) return seen;
    const re = globToRegExp(glob);
    const hit = files.some((f) => re.test(f));
    matchedSomething.set(glob, hit);
    return hit;
  };

  for (const item of scoped) {
    for (const glob of item.scope) {
      if (globMatches(glob)) continue;
      findings.push({
        level: 'warn', code: 'dead_scope', item: item.id,
        remedy: ACK,
        // The item is NOT named again inside the sentence. It used to be, and
        // it was the widest line `doctor` printed: every surface that renders
        // this finding already carries `item` beside the message — the text
        // report prefixes the line with it, `--full` puts it on its own
        // labelled line, `--json` has the field — so the second mention was
        // the same id twice on one line. Unlike `source_drift` below, which
        // names the id as the argument of a command the reader is being told
        // to run, nothing here needs it inline: the finding is about this one
        // item's own glob, and the remediation ("re-scope it") is about the
        // glob.
        message:
          `scope glob "${glob}" matches no file in the repository. The item will never activate ` +
          `through it — the clearest rot signal after a refactor. Re-scope it to the path that ` +
          `replaced it.${deletingTheGlob(config, item.type)}`,
      });
    }
  }

  // **The bound, disclosed — and this check reaches it soonest of the three.**
  // `checkWatchedDocsServable` below has carried `watched_doc_coverage` since
  // it shipped; this consumer of the same bounded walk did not, which is site
  // M8 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`.
  // The sentence above is a confident *"matches no file in the repository"*
  // over a walk that may have read part of one, and a reader or an agent who
  // acts on it re-scopes a GOVERNING constraint to a wrong path. `warn`, so the
  // exit code says nothing either way.
  //
  // It is worse here than at the other two sites for a measurable reason:
  // `listFilesForScopeCheck` walks with `SCOPE_SKIP_DIRS` — `.git` and
  // `node_modules`, and nothing else — because a scope glob may legitimately
  // name anything, so `dist/`, `build/`, `coverage/` and `.next/` all count
  // against the same 20,000 that `SKIP_DIRS` keeps out of the other two walks.
  //
  // `about: 'dead_scope'` makes it a DISCLOSURE rather than a finding
  // (`Finding.about`, and `isDoctorDisclosure` in `src/mcp/tools.ts`): it is a
  // note the check makes about itself, it must not move a health count, and
  // every surface that partitions on `about` already prints it.
  if (files.length >= FILE_LIMIT) {
    findings.push({
      level: 'info', code: 'dead_scope_coverage', about: 'dead_scope',
      remedy: NOTHING,
      message:
        `the repository walk stopped at its ${FILE_LIMIT}-file bound, so this check compared the ` +
        `globs above against only part of the tree. Every "matches no file" line above is ` +
        `therefore a statement about the part that fit — a glob reported dead here may match a ` +
        `file the walk never reached, so verify the path before re-scoping anything on it. ` +
        `Globs that DID match are unaffected.`,
    });
  }

  return findings;
}

/**
 * **Which repository files the document route can serve** — README.md, plus
 * every `.md` under `docs/` or `reports/`.
 *
 * This predicate is the boundary
 * `DEC-the-documentation-system-is-hand-built-over-a-wide-glob` ruled: *"the
 * wider glob over docs and reports rather than `watchedDocs` alone. A
 * documentation system that cannot show a report is not one, and most of what
 * this project actually knows is written in reports."* `README.md` is named on
 * top of it because it sits at the repository root, outside both directories,
 * and `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` calls
 * it (with `docs/README.he.md`, which `docs/` already covers) the base of the
 * whole system.
 *
 * **It lives HERE, in doctor, rather than in the route that reads it**, and
 * that is a direction decision rather than a filing accident. Two callers need
 * the same sentence: `buildDocManifest` (`src/ui/read-model.ts`), which builds
 * the manifest a reader picks from, and `checkWatchedDocsServable` below,
 * which measures whether this corpus claims documents that manifest cannot
 * reach. `read-model.ts` already imports `listRepoFiles` and `runChecks` from
 * this module and nothing here imports from it, so putting the predicate on
 * this side keeps that arrow pointing one way; putting it on the other would
 * make the CLI's `doctor` load the whole UI read model to answer a question
 * about two string prefixes.
 *
 * One wording, in one place, for one fact — the alternative is the recurring
 * defect this codebase names by hand: a second copy of a rule that can drift
 * from the first without anything failing.
 */
export function isServableDocPath(relPath: string): boolean {
  if (relPath === 'README.md') return true;
  return (relPath.startsWith('docs/') || relPath.startsWith('reports/')) && relPath.endsWith('.md');
}

/**
 * **Which CORPUS files the file browser can serve** — every `.md` under the
 * workspace's own `items/` directory, and nothing else.
 *
 * ── IT IS THE OTHER BOUNDARY, NOT A WIDENING OF THE ONE ABOVE ─────────────
 *
 * `isServableDocPath` answers a question about the CHECKOUT: repo-relative
 * paths, rooted at the repository. This one answers a question about the
 * CORPUS: paths relative to `.my_context/`, rooted at the workspace. They are
 * two different roots and two different rosters, and the owner ruling of
 * 2026-09-06 (recorded as `DEC-the-ui-serves-the-corpus-through-its-own-route`)
 * is that the corpus becomes reachable by ADDING this one rather than by
 * loosening that one.
 *
 * **Widening `isServableDocPath` would not have worked anyway, and that is a
 * measurement rather than a preference.** `buildDocManifest` sources its paths
 * from `coverageFiles` → `listRepoFiles`, and `listRepoFiles` drops every path
 * carrying a `.my_context` segment through `SKIP_DIRS` — deliberately, since
 * 2026-09-04, so the workspace's own storage is not drawn as project content.
 * A predicate that admitted `.my_context/items/**` would therefore have been
 * asked about no such path, ever, and the feature would have shipped serving
 * nothing while looking done.
 *
 * ── WHAT THIS PREDICATE IS ACTUALLY FOR ──────────────────────────────────
 *
 * The roster it filters is the INDEX's own `file_path` column, not a directory
 * walk, so an id can never be joined onto a path and no traversal is reachable
 * through the request at all (`apiCorpusFile`, `src/ui/read-model.ts`). This
 * predicate guards the OTHER direction: the index is a SQLite file on disk that
 * a process other than this one wrote, so a row claiming
 * `file_path: ../../../../etc/shadow` must not become a servable id merely
 * because it was in the table. Every clause below is therefore about a hostile
 * row rather than about a tidy one:
 *
 *   - it must be exactly its own POSIX normalisation, so `./`, a trailing `/`
 *     and any `..` that `normalizePosix` would resolve are all refused rather
 *     than quietly rewritten into something servable;
 *   - it must sit under `items/` or under `.drafts/`, which are the two
 *     directories `loadLayer` reads and therefore the only two that can be
 *     called the corpus — see the paragraph below, because that clause changed
 *     and the reason it changed is the reason it was written that way;
 *   - it must end `.md`, because the corpus is Markdown and `state/` holds
 *     databases nobody should be handed;
 *   - and no segment may be empty, `.` or `..`, which catches a Windows-style
 *     `items\..\..` that POSIX normalisation leaves alone.
 *
 * It lives beside `isServableDocPath` for that predicate's own stated reason —
 * one wording, in one place, for one fact — and so that a reader asking "what
 * can this server hand out" finds both answers side by side instead of one
 * here and one in the read model.
 */
/**
 * The corpus's own walk roots, and the whole of what `CORPUS_ROOTS` is for.
 *
 * ── WHY `.drafts/` JOINED IT, AND WHY IT IS A WIDENING RATHER THAN A ROUTE ─
 *
 * This predicate's `items/` clause was never about `items/` — it was about
 * *"the only directory `loadLayer` reads"*. `plan:loop seq:3` gave `loadLayer`
 * a SECOND walk root (`core/drafts.ts` · `DRAFT_DIR`), so a draft is loaded,
 * indexed, listed, shown and duplicate-checked exactly like any other item and
 * its `file_path` sits in the same `items.file_path` column this roster is
 * built from. The stated reason for the narrow clause expired the moment that
 * landed; leaving the clause would have kept the RULE while losing the reason,
 * which is the defect this repository spends most of its comments on.
 *
 * **The alternative was a second route, and it was refused on the security
 * argument rather than on the effort.** `/api/corpus/:id`'s defence is four
 * things — an id that is a KEY and never a path, a roster built from the index
 * rather than from a walk, this predicate over the hostile row, and a realpath
 * check over the file. A `/api/drafts/:id` would have to reproduce all four,
 * for the one class of file in this product that an AGENT wrote. A second
 * implementation of a traversal defence, guarding the least trusted content
 * the corpus holds, is the worst place in this codebase to have two of
 * something.
 *
 * **What becomes reachable, said out loud.** A draft's Markdown — frontmatter
 * included — is now readable by a browser holding the UI token, and appears in
 * the Library's file tree. That is the same content `/api/review-queue`,
 * `/api/items` and `/api/item/:id` already serve to the same holder of the
 * same token, and it is what the review surface needs in order to open a draft
 * in the right pane at all. Nothing else moves: `state/`, `config.json`,
 * `.audit/` and every non-`.md` file are outside the roster by construction,
 * and the `.gitignore` inside `.drafts/` still means none of it reaches
 * anybody else's checkout.
 */
export const CORPUS_ROOTS = ['items/', '.drafts/'] as const;

export function isCorpusFilePath(relPath: string): boolean {
  if (relPath !== normalizePosix(relPath)) return false;
  if (!CORPUS_ROOTS.some((root) => relPath.startsWith(root))) return false;
  if (!relPath.endsWith('.md')) return false;
  return relPath.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/**
 * Which of `CORPUS_ROOTS` a servable path sits under, or `null`.
 *
 * `apiCorpusFile` needs it because its realpath containment check is against
 * the root directory the file claims to be in, and with two roots that is no
 * longer a constant. Derived from the same list the predicate uses, so a third
 * root can never be admitted by one and refused by the other.
 */
export function corpusRootOf(relPath: string): string | null {
  if (!isCorpusFilePath(relPath)) return null;
  const root = CORPUS_ROOTS.find((candidate) => relPath.startsWith(candidate));
  return root === undefined ? null : root.slice(0, -1);
}

/**
 * **A document this corpus WATCHES that no reader can open**
 * (`plan:docsys seq:4`, carrying out
 * `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`).
 *
 * That requirement is `severity: hard` and says being in the repository does
 * not make a document viewable — being in the CORPUS does, "reachable through
 * `watchedDocs`". `DEC-the-documentation-system-is-hand-built-over-a-wide-glob`
 * then decided the SERVING boundary separately, and made it wider. Two
 * boundaries, decided eleven days apart, with nothing measuring that the
 * narrow one still fits inside the wide one — so a `watchedDocs` entry naming
 * a document outside `docs/`, `reports/` or `README.md` would put that
 * document in the corpus and out of every reader's reach, silently, which is
 * the exact failure the requirement was written about.
 *
 * **Today the answer is zero and that zero is measured, not assumed.**
 * `watchedDocs` is `["docs/**\/*.md", "README.md"]` on this project as of
 * 2026-09-05 — the owner added `README.md` to it for this task, and
 * `docs/README.he.md` was already inside `docs/**\/*.md` — and both sides of
 * every one of those matches are servable. The check exists so that the day a
 * glob is widened past the route, `doctor` says so instead of the reader
 * finding out by looking for a document that is not there.
 *
 * **It reports a FILE, never a glob.** A glob matching nothing at all is a
 * different finding with a different remedy (`watched_docs_no_match`,
 * `DEC-a-dead-watched-docs-list-earns-a-one-command-repair`, not built here);
 * this one is only ever about a real file that a real reader would expect to
 * be able to open.
 *
 * `PERSON` rather than `ACK`: the finding names no item, so there is nothing
 * to anchor an acknowledgement to, and the fix is a `config.json` edit or a
 * moved file — both outside my_context, exactly the shape `PERSON`'s own
 * docblock describes.
 *
 * The walk is `listRepoFiles`' bounded one, so a repository big enough to
 * truncate it gets a disclosure saying the answer is partial rather than a
 * silent zero (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`,
 * and `INV-nothing-is-dropped-silently`).
 */
export function checkWatchedDocsServable(repoRoot: string, config: Config): Finding[] {
  if (config.watchedDocs.length === 0) return [];

  const files = listRepoFiles(repoRoot);
  const findings: Finding[] = [];

  for (const rel of files) {
    if (!matchesAnyGlob(rel, config.watchedDocs)) continue;
    if (isServableDocPath(rel)) continue;
    const glob = config.watchedDocs.find((g) => matchesAnyGlob(rel, [g])) ?? '(unknown)';
    findings.push({
      level: 'warn', code: 'watched_doc_unserved',
      remedy: PERSON,
      message:
        `"${rel}" is matched by watchedDocs glob "${glob}", so this corpus claims it as one of ` +
        `its documents — but the document route cannot serve it, so no reader can open it in ` +
        `the UI. That route reaches README.md and every .md under docs/ or reports/, and this ` +
        `file is outside all three. Move the document under docs/, or drop the glob from ` +
        `watchedDocs so the corpus stops claiming a document nobody can read. (watchedDocs also ` +
        `drives the capture nudge in src/hooks/post-tool-use.ts, so dropping the glob also stops ` +
        `the nudge on this file — a consequence, not a coincidence.)`,
    });
  }

  if (files.length >= FILE_LIMIT) {
    findings.push({
      level: 'info', code: 'watched_doc_coverage', about: 'watched_doc_unserved',
      remedy: NOTHING,
      message:
        `the repository walk stopped at its ${FILE_LIMIT}-file bound, so this check read only ` +
        `part of the tree. Whatever it found above is real; a file it never reached could still ` +
        `be watched and unservable, and nothing here is claiming otherwise.`,
    });
  }

  return findings;
}

/**
 * **A tutorial file the corpus watches and serves that the tutorial ROSTER
 * does not name** (`plan:docsys seq:4`, the tutorial half, carrying out
 * `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` and
 * `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`).
 *
 * **Why this exists at all, when the READMEs needed nothing like it.**
 * `LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of` settled
 * that the corpus's record of a watched document is the pair (`watchedDocs`
 * membership, a manifest entry served fresh off disk) and never a copy, so
 * there is nothing that can be silently stale. `checkWatchedDocsServable`
 * above binds the two halves of that pair together. For the READMEs that is
 * the whole story: two files, two boundaries, both measured.
 *
 * The tutorials have a THIRD boundary the READMEs do not, and it IS a copy:
 * `docs/tutorials/manifest.json` is a checked-in, DERIVED roster
 * (`scripts/build-tutorial-manifest.ts`, run by hand via
 * `npm run gen:tutorials`). Its drift against the four SURFACES it clusters is
 * already gated — `test/core/tutorial-manifest.test.ts` globs those surfaces
 * itself and fails when a file is claimed twice or not at all. Its drift
 * against the FILE ROSTER was gated by nothing, in the one direction that is
 * silent:
 *
 *  - A manifest entry naming a file that is not there is DISCLOSED already:
 *    `apiTutorials` draws that row `unmeasured` (English) or `todo` (Hebrew),
 *    and `heRollup.total` excludes it. A reader sees the gap. Not reported
 *    here — a second, quieter copy of a fact the screen already draws is how
 *    the two come to disagree.
 *  - A tutorial file on disk that NO entry names is silent in every surface at
 *    once. `watchedDocs`' `docs/**\/*.md` claims it, `isServableDocPath` will
 *    serve it at `GET /api/doc/:id`, the capture nudge fires on editing it —
 *    and the Tutorials screen never lists it, `heRollup` never counts it, and
 *    `test/docs/tutorial-facts.test.ts` never reads it, because that gate
 *    derives its document set from this same manifest. Its version string, its
 *    hook roster and its budget numbers can then go stale forever with nothing
 *    saying so, while the screen beside it reports the set complete. That is a
 *    stale claim served silently, which is exactly what
 *    `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` asks to
 *    be made VISIBLE rather than merely unlikely.
 *
 * **Today the answer is zero and that zero is measured, not assumed** — 48
 * files on disk under `docs/tutorials/`, 24 entries naming 48 files, and the
 * two sets are equal (2026-09-06). `STD-a-measured-zero-is-drawn-and-named-an-
 * unmeasured-thing-is`: the check exists so that the day the two diverge,
 * `doctor` says which file, instead of a reader discovering it by counting
 * rows.
 *
 * **Silent on a project that has no tutorial system**, which is nearly every
 * project this plugin is installed into: no `docs/tutorials/manifest.json`, no
 * roster claim, no finding. A manifest that EXISTS and cannot be parsed is a
 * different matter and is reported, because `apiTutorials` catches that same
 * failure and answers an empty list — a blank Tutorials screen with no
 * explanation is the unmeasured-drawn-as-zero this codebase forbids.
 *
 * **One directory read, never a repository walk.** The question is about one
 * directory's contents, `checkDeadScopes` and `checkWatchedDocsServable`
 * already pay for the bounded walk twice, and `doctor` runs on every
 * `/api/status`.
 *
 * `PERSON` rather than `ACK`: the finding names no item, and the fix is
 * `npm run gen:tutorials` or a moved file — both outside my_context.
 */
export function checkTutorialRoster(repoRoot: string): Finding[] {
  const manifestAbs = path.join(repoRoot, ...TUTORIAL_MANIFEST_PATH.split('/'));
  if (!existsSync(manifestAbs)) return [];

  let entries: TutorialManifestEntry[];
  try {
    entries = loadTutorialManifest(repoRoot);
  } catch (err) {
    return [{
      level: 'warn', code: 'tutorial_roster_unreadable',
      remedy: PERSON,
      message:
        `${TUTORIAL_MANIFEST_PATH} exists but cannot be read as a tutorial roster: ` +
        `${err instanceof Error ? err.message : String(err)}. GET /api/tutorials catches this ` +
        `same failure and answers an empty list, so the Tutorials screen draws nothing and says ` +
        `nothing — this line is the only place that discrepancy is stated. Fix the file, or ` +
        `regenerate it with \`npm run gen:tutorials\`.`,
    }];
  }

  // The directory is `manifest.json`'s own, never a second literal: the roster
  // and the files it rosters live together by construction, and two spellings
  // of one path is how a check comes to measure a directory nothing writes to.
  const dir = TUTORIAL_MANIFEST_PATH.split('/').slice(0, -1).join('/');
  let onDisk: string[];
  try {
    onDisk = readdirSync(path.join(repoRoot, ...dir.split('/')), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => relPosix(repoRoot, path.join(e.parentPath, e.name)));
  } catch {
    // The roster exists and its own directory does not, or cannot be read.
    // Every entry then names an absent file, which `apiTutorials` already
    // draws row by row — nothing to add here that the screen does not say.
    return [];
  }

  const named = new Set(entries.flatMap((e) => [e.enFile, e.heFile]));
  return onDisk.filter((rel) => !named.has(rel)).sort().map((rel): Finding => ({
    level: 'warn', code: 'tutorial_unlisted',
    remedy: PERSON,
    message:
      `"${rel}" is a tutorial file that no entry in ${TUTORIAL_MANIFEST_PATH} names. The corpus ` +
      `watches it and GET /api/doc/${rel} will serve it, but the Tutorials screen does not list ` +
      `it, the Hebrew rollup does not count it, and test/docs/tutorial-facts.test.ts does not ` +
      `check its version, hook, profile or budget claims — that gate reads the manifest, so an ` +
      `unlisted tutorial's facts can go stale with nothing failing. Run ` +
      `\`npm run gen:tutorials\` to re-derive the roster, or move the file out of ${dir}/ if it ` +
      `is not a tutorial.`,
  }));
}

/**
 * Does gitignore `line` cover a file literally named `name` (e.g.
 * `.index.db`, `.index.db-wal`)? Handles the shapes doctor is actually
 * likely to see: a bare name, a trailing `*` (`.index.db*`), a leading `/`
 * (root-anchored — irrelevant to whether it covers the name, since the name
 * has no path segments of its own here), a leading double-star segment, and a bare `*` or
 * `**` that ignores everything. Not a full gitignore engine (no `!`
 * negation, no `[...]` character classes, no mid-pattern `**`) — deliberately
 * scoped to the patterns this specific check needs to stop false-positiving
 * on, not a general-purpose implementation.
 */
function gitignoreLineCoversName(line: string, name: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  let pattern = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (pattern === '*' || pattern === '**' || pattern === '**/*') return true;
  if (pattern.startsWith('**/')) pattern = pattern.slice(3);
  if (pattern.endsWith('/')) return false; // directory-only rule; handled by gitignoreLineCoversDir
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return re.test(name);
}

/** Does gitignore `line` ignore the whole directory named `dirName`
 * (e.g. a top-level `.gitignore` with `.my_context/`)? If so, everything
 * inside — including `.index.db` — is covered too. */
function gitignoreLineCoversDir(line: string, dirName: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  let pattern = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (!pattern.endsWith('/')) return false;
  pattern = pattern.slice(0, -1);
  if (pattern.startsWith('**/')) pattern = pattern.slice(3);
  if (!pattern) return false;
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return re.test(dirName);
}

function indexCoveredByGitignore(gitignorePath: string, matchDir: boolean, dirName: string): boolean {
  let lines: string[];
  try {
    lines = readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
  } catch {
    return false;
  }
  return lines.some((line) => (
    gitignoreLineCoversName(line, '.index.db')
    || gitignoreLineCoversName(line, '.index.db-wal')
    || gitignoreLineCoversName(line, '.index.db-shm')
    || (matchDir && gitignoreLineCoversDir(line, dirName))
  ));
}

export function checkPermissions(
  root: string,
  access: (target: string, mode?: number) => void = accessSync,
  repoRoot?: string,
): Finding[] {
  const findings: Finding[] = [];

  for (const target of [root, path.join(root, 'items')]) {
    try {
      access(target, constants.R_OK | constants.W_OK);
    } catch (err) {
      findings.push({
        level: 'error', code: 'not_writable',
        remedy: PERSON,
        message: `${target} is not readable and writable: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const ignore = path.join(root, '.gitignore');
  let ignored = indexCoveredByGitignore(ignore, false, '');
  if (!ignored && repoRoot) {
    const topIgnore = path.join(repoRoot, '.gitignore');
    ignored = indexCoveredByGitignore(topIgnore, true, path.basename(root));
  }
  if (!ignored) {
    findings.push({
      level: 'warn', code: 'index_not_ignored',
      remedy: PERSON,
      message:
        `${ignore} does not ignore .index.db. The index is disposable and machine-specific; ` +
        `committing it produces binary merge conflicts. Add ".index.db" and ".index.db-*".`,
    });
  }

  return findings;
}

/**
 * A sixth check, added in Task 12 (the `doctor` command task), not Task 11:
 * a gap Task 11's own review recorded but explicitly left unclosed because
 * it scoped itself to the five checks its brief named. This one is cheap —
 * a bounded directory listing plus a JSON parse per file, the same shape as
 * `listSessions` itself (src/ingest/session.ts) — and squarely in scope for
 * a corpus-health command.
 *
 * The actual failure mode this catches (verified against `session.ts`'s
 * real read/write paths, not assumed): `openIngestSession` computes its
 * lookup id deterministically from `sourceFile` + `sourceChecksum`, which
 * matches the ORIGINAL, correct filename — so a resume's applied-log read
 * is unaffected by a mismatched header id; nothing is silently skipped on
 * resume. The damage happens on the next SAVE: `openIngestSession` returns
 * `{ ...existing, applied }`, which keeps `existing.id` (the bogus header
 * value) on the returned session object. `saveSession`/`writeHeader` then
 * trust `session.id` for where to write, producing a SECOND header file
 * (and a second, empty-until-now applied log) under the bogus id, alongside
 * the original. `listSessions` then lists both files, and because both now
 * resolve to the same id, the same logical session is listed twice.
 *
 * The safe remediation is therefore to correct the header's `id` field back
 * to match the filename — NOT to rename the file to match the id.  Renaming
 * the file would make it stop matching what `openIngestSession` computes
 * from `sourceFile` + `sourceChecksum` on the next `ingest` of that
 * document, so the existing session would no longer be found at all: the
 * whole document would be re-chunked and re-extracted from scratch, and the
 * applied log recorded under the old filename would be orphaned — the exact
 * loss this finding exists to prevent, self-inflicted by "fixing" it the
 * wrong way.
 */
export function checkSessionIdMismatch(root: string): Finding[] {
  const dir = ingestDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  for (const name of names) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      // A corrupt session file is working state, not knowledge — the same
      // call `listSessions` makes for the identical reason.
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const obj = parsed as { protocol?: unknown; id?: unknown };
    // Only files `listSessions` itself would recognize as a session are in
    // scope — a stray, unrelated `.json` file dropped into `.ingest/` (or
    // one from a future/older protocol version) must never trip an
    // error-level finding just because it happens to have an `id` key.
    if (obj.protocol !== SESSION_PROTOCOL) continue;
    if (typeof obj.id !== 'string') continue;

    const expected = `${obj.id}.json`;
    if (expected !== name) {
      findings.push({
        level: 'error', code: 'session_id_mismatch',
        remedy: PERSON,
        message:
          `ingest session file "${name}" has internal id "${obj.id}", which disagrees with its ` +
          `filename. Nothing is lost on the next resume — reads are keyed off the filename-derived ` +
          `id — but the NEXT SAVE will trust the internal id and write a duplicate header and ` +
          `applied log under "${expected}", and \`mycontext ingest-status\` will then list this ` +
          `session twice. Fix it by editing the file's "id" field back to match the filename ` +
          `(here, "${name.replace(/\.json$/, '')}"). Do NOT rename the file to match the id instead: ` +
          `the applied log is keyed by the filename, so renaming would orphan it and the next ` +
          `ingest of this document would re-extract it from scratch.`,
      });
    }
  }
  return findings;
}

/**
 * Spec §4b's third hazard, made visible: **changing `scopePolicy` does not
 * rewrite existing items.** An item captured while its category was `global`
 * and later read under `inert` stops being injected on any file, and its
 * Markdown never changed — nothing in the corpus records the difference,
 * because the difference is not in the corpus. That is legitimate (policy is
 * configuration, not content) but it is invisible, and an invisible behaviour
 * change is what this whole check family exists to surface.
 *
 * `info`, not `warn`: nothing here is wrong. `doctor`'s exit code is driven by
 * errors, and a note must not turn a correctly-configured project red.
 *
 * One finding per category rather than per item: on a corpus where a whole
 * category is unscoped this would otherwise be the longest section of the
 * report, saying the same sentence once per item.
 */
export function checkScopePolicy(items: Item[], config: Config): Finding[] {
  const unscoped = new Map<string, number>();
  for (const item of items) {
    if (item.status !== 'active' || item.scope.length > 0) continue;
    unscoped.set(item.type, (unscoped.get(item.type) ?? 0) + 1);
  }

  const findings: Finding[] = [];
  for (const [type, count] of [...unscoped].sort((a, b) => a[0].localeCompare(b[0]))) {
    const policy = scopePolicyFor(config, type);
    if (policy === 'inert') {
      findings.push({
        level: 'info', code: 'scope_policy_inert',
        remedy: NOTHING,
        message:
          `${count} active "${type}" item(s) declare no scope, and categories.${type}.scopePolicy ` +
          `is "inert" — so they match no path: they are not JIT-injected on any file and ` +
          `query_items({path}) does not return them. They still appear in the session index, and ` +
          `an item with always: true is still pinned at session start, which scope never governs. ` +
          `Their files are unchanged and nothing needs fixing: the policy is configuration, not ` +
          `content, so setting it back to "global" makes the same items apply everywhere again ` +
          `with no edit to any item.`,
      });
    } else if (policy === 'required') {
      findings.push({
        level: 'info', code: 'scope_policy_required',
        remedy: NOTHING,
        message:
          `${count} active "${type}" item(s) declare no scope, although ` +
          `categories.${type}.scopePolicy is "required". Changing the policy does not rewrite ` +
          `existing items, so these predate it. They are still injected on every file — ` +
          `"required" refuses at capture, never at injection — and a new ${type} without a scope ` +
          `is refused from now on.`,
      });
    }
  }
  return findings;
}

/**
 * Items whose category is absent from config entirely — the state a project
 * lands in when a category is REMOVED from the catalogue (Phase 3 removed
 * `policy`, `postmortem` and `taxonomy`) or renamed in config after its items
 * were captured.
 *
 * `loadLayer` (rebuild.ts) deliberately indexes such items rather than
 * dropping them, and reports one load error per file. That is the safety net;
 * this is the route. A load error is keyed to a FILE and says what is wrong
 * with it; a doctor finding is keyed to an ITEM, carries a code a script can
 * match on, survives `--json`, and is where this project puts "here is what to
 * do about it". Removing a category with no finding here would leave a user
 * whose corpus has ten `policy` items reading the same sentence ten times with
 * no named migration.
 *
 * One finding per item, not per category, deliberately — the opposite choice
 * from `checkScopePolicy` above. There the message is identical for every item
 * and the count is the information; here the answer is "supersede THIS item
 * onto a replacement", which has to name the item to be actionable.
 *
 * `warn`, not `error`: the item is not lost and the corpus is not corrupt —
 * it is indexed, listed, shown and queryable, and only injection is closed to
 * it. `doctor`'s exit code is already 1 on such a corpus, driven by the load
 * error `loadLayer` raises for the same file, so making this an error would
 * count one problem twice in the summary line.
 */
/**
 * **The continuity tier's overflow, reported where a person looks rather than
 * only where a session reads.**
 *
 * R3 of the task that built the tier: overflow must be LOUD, in the injected
 * block AND as a doctor finding. The reason is the defect the tier exists to
 * end — `REF-v2-handover-read-before-discussing-the-web-ui` cost 37,831
 * estimated tokens against a largest budget of 24,000, was delivered on no
 * event, and nothing anywhere said so. A tier that quietly drops its payload
 * reproduces that with a longer fuse, so this check exists even though the
 * tier's content is meant to be a pointer plus a bounded digest and should
 * never approach the budget: "should never happen" is not a behaviour.
 *
 * **A total is enough, and no event has to be simulated.** `fitToBudget`
 * admits first-fit, so what it admits can never exceed the budget — therefore
 * a candidate set whose TOTAL exceeds the budget must spill at least one item,
 * whatever order it considers them in.
 *
 * The other finding is the other silence on this axis: an item that carries the
 * marker and can never be delivered, because it is retired or its category is
 * off. `warn` rather than `error` for `checkUnknownCategory`'s reason — nothing
 * is lost and nothing is corrupt — but said, because "the continuity guarantee
 * is switched off" is exactly the fact this feature exists to stop being
 * invisible.
 */
export function checkContinuity(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  const marked = items.filter((i) => i.continuity);
  if (marked.length === 0) return findings;

  for (const item of marked.filter((i) => !isEligible(i, config))) {
    const enabled = config.categories[item.type]?.enabled === true;
    findings.push({
      level: 'warn', code: 'continuity_inert', item: item.id,
      remedy: ACK,
      message:
        `${item.id} carries continuity: true and cannot be delivered: its status is `
        + `"${item.status}" and its category "${item.type}" is `
        + `${enabled ? 'enabled' : 'disabled or unknown to this config'}. The continuity `
        + 'tier admits active items in enabled categories only, so the guarantee this item '
        + 'is supposed to carry is in force for no session. Set the status back to active, '
        + 'enable the category, or clear the flag with `mycontext edit '
        + `${item.id} --continuity=false\` so that nothing claims a guarantee nothing keeps.`,
    });
  }

  const live = marked.filter((i) => isEligible(i, config));
  if (live.length === 0) return findings;
  const cost = live.reduce((sum, i) => sum + itemCost(i), 0);
  const budget = config.budgets.continuity;
  if (cost <= budget) return findings;

  findings.push({
    level: 'error', code: 'continuity_overflow',
    remedy: PERSON,
    message:
      `the continuity tier costs ${cost} estimated tokens and budgets.continuity is `
      + `${budget}, so at least one continuity item reaches no session: `
      + `${live.map((i) => i.id).sort().join(', ')}. The project-continuity guarantee is NOT `
      + 'in force. The tier is meant to carry a POINTER PLUS A BOUNDED DIGEST — the document '
      + 'named, the current state summarised — and never the document itself, so the first '
      + 'answer is to shorten it: raising budgets.continuity relocates the spill rather than '
      + 'removing it, and a budget chosen against a document that keeps growing expires.',
  });
  return findings;
}

/**
 * **A summary that no longer describes its item, reported as a measurement
 * rather than a suspicion.**
 *
 * A summary does not know the body moved, and it is the most quotable thing an
 * item has — the one most likely to be repeated into a session and trusted
 * without anybody opening the item. Five stale justifications were corrected in
 * this codebase in three days; a stale summary is that failure with a shorter
 * sentence and a wider audience.
 *
 * So `summaryOf` records what the summary was written against
 * (`itemSummaryBasis`, content-hash.ts) and this compares the two. Nothing
 * here guesses: a finding means the summarised content — body, steps,
 * observations, extra — has a different hash than the one stored beside the
 * summary. A change to the TITLE, scope, tags, `always` or a relation produces
 * no finding, deliberately (see `SUMMARY_BASIS` for each exclusion and why;
 * `title` is the owner's 2026-08-27 ruling and carries its accepted risk
 * there).
 *
 * `warn`, not `error`: nothing is lost and nothing is corrupt — the summary is
 * still on disk, still shown, still round-trips. What is wrong is that it may
 * be believed, and the remedy is a person or an agent writing a new one.
 *
 * The states are reported apart because their remedies differ. An ABSENT
 * summary is the one this function used to walk past in silence, and it has its
 * own argument at the clause that reports it. A `stale`
 * summary was correct once and the content moved under it. An `unanchored` one
 * carries no basis at all, which no write path in this product can produce —
 * it means the file was edited by hand, so the summary may never have described
 * the item, and rewriting the basis to match would be recording a claim nobody
 * made.
 *
 * The OVER-LENGTH case is here too, and it is here rather than at load
 * (`parseItem` deliberately does not measure it) for the reason
 * `checkBodyTruncation` exists: a file already on disk that no validator ever
 * saw must be reported, not refused, because refusing to load it would make an
 * item invisible for being wordy.
 */
export function checkSummary(items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    // **The item no other clause in this function can reach**, named rather
    // than skipped past.
    //
    // Every check below compares a summary against something: the basis it was
    // stamped with, or the length limit. An item with no summary answers none
    // of those questions, so it used to fall through this loop silently — and
    // silence was indistinguishable from health. Seventeen items sat in that
    // state while `mycontext doctor` reported the corpus clean, because the one
    // check that could have spoken about them had nothing to compare and the
    // edit gate waived them on the same grounds. That is the shape
    // `INV-nothing-is-dropped-silently` exists for, one layer up: not an item
    // dropped from output, but an item dropped from every check that applies to
    // it.
    //
    // **`warn`, the same level as `summary_stale`, because it is the same
    // defect one step earlier.** A stale summary may be believed; an absent one
    // means the item arrives everywhere it is listed with nothing to be
    // believed at all — no sentence beside it in a report, nothing quotable
    // into a session, and no way for a reader to judge it without opening the
    // body. Nothing is lost and nothing is corrupt: the item loads, indexes,
    // injects and governs exactly as it always did, which is why this is not
    // `error` — `error` in this file is reserved for a guarantee that is NOT in
    // force (see `continuity_overflow`), and every guarantee this product makes
    // still holds for an item with no summary. It is not `info` either: `info`
    // is for what a reader may want to know, and this is a remedy waiting for
    // somebody, on an item that will otherwise stay this way forever.
    //
    // The remedy is one command and the finding names it. There is deliberately
    // no note here about opting out: `--summary-omitted` is a capture-time act
    // and the item already exists, so offering it would be offering a way to
    // silence a finding rather than answer it.
    if (item.summary === null) {
      findings.push({
        level: 'warn', code: 'summary_absent', item: item.id,
        remedy: ACK,
        message:
          `has no summary, so nothing here can say whether what it claims is still what it ` +
          `means. It is the one state no other summary check reaches: \`summary_stale\` and ` +
          `\`summary_unanchored\` both compare a summary against the content it was written ` +
          `against, and an item with none has neither — it is reported here or it is reported ` +
          `nowhere. It is either older than the requirement, hand-written into a \`.md\` file, ` +
          `or captured with an explicit opt-out, and all three end the same way: read the body ` +
          `and write the one plain sentence a reader who does not know this codebase would ` +
          `need — \`mycontext edit ${item.id} --summary "<text>"\` (or update_item, which ` +
          `stages it for review on a category set to agentEdits "review"). Nothing is wrong ` +
          `with the item: it loads, injects and governs exactly as it did. What it cannot do ` +
          `is be summarised to anyone who has not opened it.`,
      });
      continue;
    }

    const state = summaryState(item);
    if (state === 'unanchored') {
      findings.push({
        level: 'warn', code: 'summary_unanchored', item: item.id,
        remedy: ACK,
        message:
          `carries a summary with no "summary_of", so there is no record of what it was written ` +
          `against and nothing can say whether it still describes this item. No command in this ` +
          `product writes one without the other, so this file was edited by hand. Rewrite the ` +
          `summary through \`mycontext edit ${item.id} --summary "<text>"\`, which stamps the ` +
          `basis from the item as it stands; the basis is not repaired on its own, because ` +
          `stamping it here would record that this summary was checked against this text when ` +
          `nobody checked it.`,
      });
    } else if (state === 'stale') {
      findings.push({
        level: 'warn', code: 'summary_stale', item: item.id,
        remedy: ACK,
        message:
          `its summary is STALE: this item's body, steps, observations or extra fields ` +
          `have changed since the summary was written, so the summary describes text that is no ` +
          `longer here. It is still stored and still shown — nothing was dropped — but it is ` +
          `drawn as stale wherever it appears, and it must not be quoted as though it described ` +
          `this item. Read the sentence against the body, and there are two honest endings. ` +
          `If it no longer describes the item, write a new one: ` +
          `\`mycontext edit ${item.id} --summary "<text>"\` (or update_item, which stages it for ` +
          `review on a category set to agentEdits "review"). If it STILL describes the item — ` +
          `the text moved in a way the sentence already covers — pass the same sentence back ` +
          `verbatim: \`mycontext edit ${item.id} --summary "<the same sentence>"\`, which ` +
          `re-stamps the basis, changes no word, and is recorded in the audit log as a ` +
          `re-affirmation. Do NOT invent a different sentence to clear this warning; a ` +
          `gratuitous rewrite is the dishonesty the summary standard exists to prevent. Either ` +
          `way the basis is re-stamped by a write that carries the sentence and by nothing else, ` +
          `so an edit to the body alone will never quietly re-bless it.`,
      });
    }

    if (item.summary.length > SUMMARY_MAX_CHARS) {
      findings.push({
        level: 'warn', code: 'summary_too_long', item: item.id,
        remedy: ACK,
        message:
          `its summary is ${item.summary.length} characters and the limit is ` +
          `${SUMMARY_MAX_CHARS}. No write path accepts one this long, so it was written into ` +
          `the file by hand. A summary is reproduced beside the item everywhere the item is ` +
          `listed, so one that is itself a paragraph is a paragraph printed once per row. ` +
          `Shorten it — and if this item cannot be said in ${SUMMARY_MAX_CHARS} characters, ` +
          `that is a finding about the item rather than about the limit: it is carrying more ` +
          `than one claim and wants splitting.`,
      });
    }
  }
  return findings;
}

export function checkUnknownCategory(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (Object.hasOwn(config.categories, item.type)) continue;
    findings.push({
      level: 'warn', code: 'unknown_category', item: item.id,
      remedy: ACK,
      message:
        `declares type "${item.type}", which this project's config does not define — a ` +
        `category removed or renamed since this item was captured. Nothing has been dropped: ` +
        `it is still indexed, listed, shown and queryable. What it cannot do is govern, ` +
        `because no tier admits an item whose category is unknown, so the session index ` +
        `counts it rather than naming it. There is no retype — "type" is fixed at creation ` +
        `and decides where the file lives — so there are two routes. Keep the category: ` +
        `declare "${item.type}" in .my_context/config.json with a "tier" and a "description", ` +
        `and it is a first-class category of this project again. Or migrate the item: capture ` +
        `a replacement under a live category, then \`mycontext supersede ${item.id} --by ` +
        `<replacement id>\`, which retires this one and records the link between them.`,
    });
  }
  return findings;
}

/**
 * **The top-level config keys this build did not read, disclosed to the
 * person who wrote them.**
 *
 * `resolveConfig` accepts an unknown top-level key, leaves it out of the
 * resolved config, and carries it on `skippedKeys` (`core/config.ts` ·
 * `  skippedKeys: string[];` · ~529). That field's own docblock states the
 * consequence as a duty rather than a convenience: *"a surface that shows
 * config to a human and does not print this notice has re-created the silent
 * drop this field exists to end."* Until this check existed, the only caller
 * of `skippedKeyNotice` (`core/config.ts` ·
 * `export function skippedKeyNotice(config: Config): string {` · ~1637) was
 * the web UI's `/api/config` — so a `"uiu"` one transposed letter from
 * `"ui"` made `doctor` report `0 error(s), 0 warning(s), 0 note(s)` and the
 * user believed the setting they wrote was in force. The person most likely
 * to have hand-edited `config.json` is at a terminal, which is the surface
 * that was silent.
 *
 * The message is `skippedKeyNotice(config)` VERBATIM. Nothing here composes a
 * sentence of its own, and nothing here should: two spellings of one
 * disclosure drift apart, which is the same failure — a fact worded in one
 * place and not carried to another — that this check exists to end. That
 * function also names the KEY, which is what makes this a disclosure rather
 * than an alarm: "some key was skipped" tells the reader nothing they can act
 * on, and a test asserting merely that output is non-empty would pass on it.
 *
 * **`warn`, and the argument, because both neighbours are defensible.**
 *
 *  - **Not `error`.** An `error` fails this command's exit code (`doctor.ts` ·
 *    `export function exitCode(` · ~58), and nothing here is broken: the
 *    config PARSED, every key this build understands is in force, and the
 *    corpus is healthy. The skip is also deliberate forward compatibility — a
 *    config written for a newer my_context is MEANT to load on this one — so
 *    `error` would turn a perfectly correct file red and fail CI on the day
 *    somebody runs an older build. That is the same line the `warn`/`error`
 *    split was already drawn on for `dead_scope`: worth surfacing, must not
 *    break someone's CI. Disclosure is what this task asked for; enforcement
 *    is not, and an unknown key is deliberately not a hard refusal.
 *  - **Not `info`.** `info` in this file is the level for a fact that is the
 *    feature working — `checkAuditSize`: *"a large audit log in a busy project
 *    is the feature working."* A skipped key is the opposite. Whatever the
 *    user wrote there is NOT in force, and under the misspelling reading —
 *    the likelier one at a terminal, where the file is hand-edited — their
 *    intent was discarded without their knowing. A fact that means a setting
 *    silently does not apply outranks a note, and at `--summary` the note
 *    count is the one a reader skims past.
 *
 * `warn` is therefore what is left, and it is the right shape rather than
 * merely the residue: counted in the summary line at every detail level,
 * printed with its key at the default and `--full` levels, and never the
 * reason a build goes red.
 *
 * **One finding, not one per key.** `skippedKeyNotice` names every skipped key
 * in a single sentence; emitting it per key would print that same sentence N
 * times over. (`read-model-config.ts` maps it per key instead because its
 * consumer is a table with a `where` column — a different shape, same words.)
 */
export function checkSkippedConfigKeys(config: Config): Finding[] {
  const notice = skippedKeyNotice(config);
  if (notice === '') return [];
  return [{ level: 'warn', code: 'config_key_skipped', message: notice, remedy: PERSON }];
}

/**
 * **The growth check the revision log never got.**
 *
 * `.my_context/.revisions/` shipped in Phase 1 with no compaction and no
 * `doctor` check at all, and the phase review recorded that as an undisclosed
 * liability. The audit log is written on every tool call, so the same silence
 * would be worse here.
 *
 * What it reports, and what it deliberately does not do:
 *
 *  - Rotation bounds the size of any ONE segment (`AUDIT_MAX_BYTES`), so the
 *    read path never has to parse an unbounded file. It does NOT delete
 *    anything: rotation renames, and every record ever written is still on
 *    disk. Total growth is therefore unbounded, and this finding is where that
 *    is disclosed rather than left to be discovered.
 *  - Nothing here removes a segment, and nothing ever will. Deleting audit
 *    records is a decision for the person being audited, not for the thing
 *    doing the auditing — so the finding names the files and says they are the
 *    user's to archive, and stops there.
 *
 * `info`, not `warn`: a large audit log in a busy project is the feature
 * working. `doctor`'s exit code is driven by errors, and a correctly-behaving
 * project must not go red for having a history.
 */
export function checkAuditSize(root: string): Finding[] {
  const { files, bytes } = auditSize(root);
  if (bytes < AUDIT_REPORT_BYTES) return [];
  const rotated = files.length - 1;
  return [{
    level: 'info', code: 'audit_log_size',
    remedy: AUDIT_FILES,
    message:
      `the run-time audit log is ${(bytes / 1024 / 1024).toFixed(1)} MiB across ` +
      `${files.length} file(s) under ${auditDir(root)}. Nothing is wrong: the live log ` +
      `rotates at ${(AUDIT_MAX_BYTES / 1024 / 1024).toFixed(0)} MiB so no single file grows ` +
      `without bound, and my_context never deletes a rotated segment — which is why the TOTAL ` +
      `keeps growing. ${rotated === 0 ? 'There are no rotated segments yet' : `The ${rotated} ` +
      `rotated segment(s) are yours to archive or delete`}; removing one removes that stretch ` +
      `of history for good, and no command will do it for you. \`audit.db\` beside them is a ` +
      `derived query index and is always safe to delete — it rebuilds on the next ` +
      `\`mycontext audit\`. See \`mycontext audit --files\`.`,
  }];
}

/**
 * The low edge of the fallback mitigation band (~5–10k, never-miss design
 * §6 risk 3). 5,000 is the largest size the warm-cache fallback was priced
 * at (597.7 ms, design measurement M1) and half the measured cold-cache
 * ceiling (9,903 ms at 10,000 items, review probe R5).
 */
export const FALLBACK_CEILING_WARN_ITEMS = 5000;

/**
 * `warn`, not `error`: the corpus works today; what shrinks is the margin on
 * a CONDITIONAL guarantee, and the condition is stated in the same sentence
 * as the claim (STD-guarantee-claims-carry-their-condition-in-the-same-sentence).
 */
export function checkCorpusSize(items: Item[]): Finding[] {
  if (items.length < FALLBACK_CEILING_WARN_ITEMS) return [];
  return [{
    level: 'warn', code: 'corpus_size_fallback_ceiling',
    remedy: DECAY,
    message:
      `the corpus holds ${items.length} items. my_context's never-miss injection guarantee is ` +
      `conditional on corpus size: when the index is unavailable, hooks serve the injection ` +
      `straight from the Markdown, and that fallback was measured at 9,903 ms for 10,000 items ` +
      `on a cold file cache (review probe R5, 2026-08-16, this class of machine) against the ` +
      `10 s hook kill — and cold cache is the first run after a reboot, exactly when the ` +
      `fallback fires. Past ~10,000 items a fallback-served injection can be killed and ` +
      `degrades to a disclosed miss. \`mycontext decay\` is the lever for retiring unused ` +
      `items; splitting the corpus across layers does not help (both layers are parsed).`,
  }];
}

/**
 * **A field and the tag projected from it, disagreeing — the defect this
 * check's absence let run for the life of the corpus.**
 *
 * Measured on 2026-08-23 over this project's own items with the real parser:
 * 293 `task` items, all 293 carrying a `state:` TAG, 213 also carrying a
 * `state` FIELD, and fifteen of those disagreeing — `done` as a tag against
 * `todo`, `doing` or `blocked` as a field. Nothing synced them and, until this
 * function, nothing looked: no code anywhere read the `plan:`/`seq:`/`state:`
 * prefixes at all, so a `state:donee` typo removed a task from every progress
 * view and no gate noticed. The corpus was clean by discipline, not by
 * enforcement, and fifteen items are what discipline missed.
 *
 * `projectionMismatch` (core/tag-projection.ts) owns the classification, not
 * this file: `doctor`, the seq-19 migration and any future caller have to read
 * the same corpus the same way, and a second hand-written predicate here is how
 * two readings of one rule come to disagree — which is the very failure being
 * reported.
 *
 * **Two codes, not one, because a doctor code carries exactly one level.** The
 * grouped report prints `bucket[0].level` as the heading for the whole group
 * (doctor.ts), so a code with mixed levels would label its own findings wrong.
 *
 *  - `tag_projection_drift` is an **error**: the index gives a WRONG answer.
 *    A stale, duplicated, absent or out-of-vocabulary projection means
 *    `mycontext focus state:todo` and `search --tag state:todo` return a set
 *    that is not the set of items whose `state` is `todo` — silently, and in
 *    both directions. Unlike a dead scope glob, nothing here is cosmetic and
 *    nothing is a false alarm on the day someone renames a directory.
 *  - `tag_projection_unprojected` is **info**: a projected tag with no field
 *    behind it. Nothing is wrong with the filtering — the tag is there and
 *    resolves — the value simply lives only in the index and has not been
 *    adopted into the field that can hold it. That is the ordinary state of
 *    every item captured before a projection was declared (eighty `task` items
 *    here on the day this shipped), and turning a whole corpus red for not yet
 *    having been migrated would make the exit code useless on the one day it
 *    matters. The migration is plan:categories seq 19; this is its worklist.
 */
export function checkTagProjection(items: Item[], config: Config): Finding[] {
  return projectionMismatches(items, config).map((m) => {
    const { field, prefix, command, values } = m.projection;
    const tag = m.tagValues.map((v) => `"${prefix}:${v}"`).join(', ');
    const vocabulary = values === undefined ? '' : ` Declared values: ${values.join(', ')}.`;
    const fix =
      ` The field is the store and the tag is the index generated from it, so the fix is to ` +
      `set the field and let my_context rewrite the tag: \`${command}\`. Do not edit the tag ` +
      `by hand — update is not a legal operation on a tag, and a remove-then-add done by a ` +
      `person is exactly how this item got here.`;

    if (m.kind === 'unprojected') {
      return {
        level: 'info' as const, code: 'tag_projection_unprojected', item: m.itemId,
        remedy: ACK,
        message:
          `carries the projected tag ${tag} but no "${field}" field, so the value lives only in ` +
          `the index. Filtering is unaffected — the tag is there and \`mycontext focus ` +
          `${prefix}:${m.tagValues[0]}\` still finds this item — but nothing can UPDATE it: a ` +
          `tag is a membership, and changing one by hand is a remove plus an add that can ` +
          `half-fail. Adopting the value into the field makes the tag generated from then on.` +
          `${vocabulary}`,
      };
    }

    const said =
      m.kind === 'duplicate'
        ? `carries ${m.tagValues.length} tags under "${prefix}:" — ${tag} — where a projection ` +
          `permits exactly one. That is the silent third membership a hand-written ` +
          `remove-then-add produces: this item is now returned by two different ` +
          `\`--tag ${prefix}:…\` filters at once, and its "${field}" field says ` +
          `${m.field === null ? 'nothing at all' : `"${m.field}"`}.`
        : m.kind === 'absent'
          ? `has "${field}": "${m.field}" and no "${prefix}:" tag projected from it, so it is ` +
            `invisible to \`mycontext focus ${prefix}:${m.field}\`, to ` +
            `\`search --tag ${prefix}:${m.field}\` and to every progress view that groups by ` +
            `"${field}" — the field is right and the item is in no answer.`
          : m.kind === 'unknown_value'
            ? `carries a "${field}" value outside the declared vocabulary — field ` +
              `${m.field === null ? '(absent)' : `"${m.field}"`}, tag ${tag || '(none)'}. This ` +
              `is the \`${prefix}:donee\` case: a value nothing reads back, filed under a group ` +
              `no filter names, removing the item from every view that groups by "${field}".` +
              `${vocabulary}`
            : `says "${field}": "${m.field}" in its field and ${tag} in its tag. The two ` +
              `disagree, so one of \`--tag ${prefix}:${m.field}\` and \`--tag ${tag.replace(/"/g, '')}\` ` +
              `returns this item wrongly and the other misses it. Nothing syncs them by hand.`;

    return {
      level: 'error' as const, code: 'tag_projection_drift', item: m.itemId,
      remedy: ACK,
      message: `${said}${fix}`,
    };
  });
}

/**
 * How to set `needs` on this item, in the spelling that actually works TODAY.
 *
 * Two spellings, because there are two states of the world and printing the
 * wrong one costs a reader an attempt at a command that is refused by name.
 * `--extra needs=…` reaches `unknownExtraFieldError` (core/trust.ts) and is
 * refused unless the item's own category DECLARES the field, so the remedy is
 * read off the resolved config rather than assumed — the same reason
 * `cmdTodo` looks its tier up instead of asserting one.
 */
function needsRemedy(config: Config, item: Item): string {
  const declared = Object.hasOwn(config.categories, item.type)
    && config.categories[item.type].extraFields.includes(NEEDS_FIELD);
  return declared
    ? `Set it: \`mycontext edit ${item.id} --extra ${NEEDS_FIELD}="plan/seq, plan/seq"\`.`
    : `"${NEEDS_FIELD}" is not yet declared by "${item.type}" in this project, so ` +
      `\`--extra ${NEEDS_FIELD}=…\` is refused by name. Add "${NEEDS_FIELD}" to ` +
      `categories.${item.type}.extraFields in .my_context/config.json — that list ADDS to what ` +
      `the category already declares, so nothing it has now is lost — and the command above ` +
      `starts working.`;
}

/**
 * **`needs`: a blocker with no target, and a blocker that has already
 * cleared.**
 *
 * This is the check that turns `needs` from documentation into a gate, and it
 * exists because of one measured incident rather than a theory. `plan:walk
 * seq:8` carried the sentence "Blocked on plan:walk seq:7". `seq:7` landed and
 * went green. `seq:8` stayed at `state: blocked` until a human drawing a
 * progress table noticed by hand — and two further tasks, `plan:port seq:6`
 * and `plan:walk seq:14`, were freed by the same landing with nothing
 * announcing either. Nothing could have noticed, because `state: blocked` was
 * a flag with no target: five tasks said they were blocked and not one said by
 * what.
 *
 * Four findings, and the split between them is the point:
 *
 *  - **`blocked_needs_met`** — `state: blocked`, every reference satisfied.
 *    The `seq:8` case, and the one that pays for the field. `warn`.
 *  - **`blocked_without_needs`** — `state: blocked`, nothing named. The state
 *    that made `seq:8` invisible. `warn`.
 *  - **`needs_malformed`** — an entry that is not `plan/seq`. `warn`, because
 *    the author said something is holding this task and nothing can read it.
 *  - **`needs_unresolved`** — well-shaped, and nothing answers to it. `info`,
 *    deliberately and by ruling: plans are written before the tasks in them
 *    are, so a forward reference is LEGITIMATE and stays legitimate. Refusing
 *    one would make the field unusable exactly when it is most useful, and the
 *    regex that produced `the/45` out of the middle of a sentence is the
 *    evidence that a machine cannot tell a forward reference from a typo.
 *
 * None is an `error`, so none moves `doctor`'s exit code. A stale blocker is a
 * planning fact about people, not a corrupt corpus, and failing someone's CI
 * over the ordering of their work would be the "must not break someone's CI on
 * the day they rename a directory" line drawn one column over.
 *
 * `STD-the-progress-table-has-one-format-and-this-is-it` already makes
 * reconciling states a human obligation before counting, and names what it
 * prevents: a table drawn over stale states is "precise about the wrong
 * corpus, and precise in the flattering direction." A cleared-but-unmoved
 * blocker is that same failure in the other column. This check is the part of
 * that obligation a machine can carry.
 */
export function checkTaskNeeds(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  const index = buildTaskIndex(items, config);

  for (const item of workItems(items, config)) {
    const reading = readNeeds(item, index);

    if (reading.malformed.length > 0) {
      findings.push({
        level: 'warn', code: 'needs_malformed', item: item.id,
        remedy: ACK,
        message:
          `declares "${NEEDS_FIELD}" entries that are not \`plan/seq\` references — ` +
          `${reading.malformed.map((m) => JSON.stringify(m)).join(', ')} — so nothing reads them ` +
          `back and this task's dependency on whatever they meant is invisible to ` +
          `\`mycontext ready\` and to this check. The field is a comma-separated list of ` +
          `\`plan/seq\`, lowercase, e.g. "walk/7, port/6". Whether the reference EXISTS is not ` +
          `checked and is not an error; only its shape is.`,
      });
    }

    if (reading.unresolved.length > 0) {
      findings.push({
        level: 'info', code: 'needs_unresolved', item: item.id,
        remedy: ACK,
        message:
          `waits on ${reading.unresolved.join(', ')}, which no task in this corpus answers to. ` +
          `That is NOT a defect on its own: plans are routinely written before the tasks in them ` +
          `exist, and a forward reference is how a dependency gets recorded at the moment it is ` +
          `known. It is reported because the other reading is a typo — a plan name that never ` +
          `existed, or a sequence that moved — and only a person can tell the two apart. ` +
          `Nothing is hidden by it: a task holding an unresolved reference is listed as held ` +
          `rather than ready, with this reason.`,
      });
    }

    if (reading.state !== BLOCKED_STATE) continue;

    if (reading.satisfied.length + reading.pending.length + reading.unresolved.length === 0
      && reading.malformed.length === 0) {
      findings.push({
        level: 'warn', code: 'blocked_without_needs', item: item.id,
        remedy: ACK,
        message:
          `is at state "${BLOCKED_STATE}" and names nothing in "${NEEDS_FIELD}", so it is a ` +
          `blocker with no target: nothing can say what would free it, and nothing will notice ` +
          `when that thing lands. This is the state that let a task sit blocked for days after ` +
          `its blocker had shipped. If the blocker is another task, name it. If it is a person, ` +
          `a decision or an answer rather than a task, this field cannot hold it — say so in the ` +
          `body and leave the state honest. ${needsRemedy(config, item)}`,
      });
      continue;
    }

    if (reading.pending.length === 0 && reading.unresolved.length === 0
      && reading.malformed.length === 0 && reading.satisfied.length > 0) {
      findings.push({
        level: 'warn', code: 'blocked_needs_met', item: item.id,
        remedy: stateTodoRemedy(item.id),
        message:
          `is at state "${BLOCKED_STATE}", and everything it waits on has landed: ` +
          `${reading.satisfied.join(', ')} ${reading.satisfied.length === 1 ? 'is' : 'are'} done. ` +
          `It should have moved and did not. Nothing here changes the state — a task's state is ` +
          `the owner's to set — so confirm the ground is finished ground and then ` +
          `\`mycontext edit ${item.id} --extra state=todo\`. Until it moves, every count of ` +
          `blocked work overstates the trouble this project is in, which is the same defect as a ` +
          `stale "todo" understating its progress.`,
      });
    }
  }

  return findings;
}

/**
 * **`open_question.blocks` names what is waiting, and nothing surfaced that
 * dependency from anywhere but the item's own prose.**
 *
 * TASK-three-item-fields-can-be-filled-in-but-nothing-ever-reads: a field a
 * writer can fill in and no check ever reads back is worse than an absent
 * one, because it looks like it works. `blocks` is free text naming the work
 * that cannot proceed until this question is answered — and until this
 * check, the only way to learn that was to already be reading this specific
 * item.
 *
 * `info`, not `warn`: a filled-in `blocks` is the category doing exactly what
 * it is for, not a defect. The finding exists to make the dependency VISIBLE
 * — in `mycontext doctor`'s report, alongside every other thing a reader is
 * already being told — not to ask anyone to change anything. `ACK` all the
 * same, because a reader who has seen it and does not need it repeated can
 * say so; the corollary in this file's own rule is that a finding a person
 * cannot act on is a defect in the check, and "I've seen this, stop showing
 * it to me" is itself an action.
 */
export function checkOpenQuestionBlocks(items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.type !== 'open_question') continue;
    // A RETIRED question was settled — a superseded one's own `superseded_by`
    // says by what — so a `blocks` note from before that is history, not a
    // live dependency, and naming it here would be exactly the stale noise
    // this check exists to avoid adding.
    //
    // Through `RETIRED_STATUSES` and not by naming `superseded` alone, which
    // is what this line said until 2026-09-11. The reason above is a reason
    // about being retired; `deprecated` and `validated` are retired by the
    // same set every other surface reads, and the corpus was paying for the
    // gap — two of this check's seven findings named `deprecated` questions.
    // Found while building `core/questions.ts`, which resolves the same field
    // for `mycontext ready` and deliberately did not copy this clause.
    if (RETIRED_STATUSES.has(item.status)) continue;
    const blocks = (item.extra.blocks ?? '').trim();
    if (blocks === '') continue;
    findings.push({
      level: 'info', code: 'open_question_blocks', item: item.id,
      remedy: ACK,
      message:
        `blocks ${JSON.stringify(blocks)} until this is answered. That dependency is recorded ` +
        `in "blocks" and nowhere else surfaces it — this finding is what makes it visible to a ` +
        `reader who never opens ${item.id} itself. Nothing is wrong with the item: an ` +
        `\`open_question\` that names what it blocks is the category working as intended. ` +
        `\`mycontext ack ${item.id} open_question_blocks\` records that the wait is known.`,
    });
  }
  return findings;
}

/**
 * **The instant this check became able to flag an overdue `assumption`.**
 *
 * Mirrors what `checkTaskUnverified`'s cutoff used to be — and it is still a
 * hard-coded date, which is now the only one left in this file; see
 * `verifiedOnAdoptedAt` for why that one went and the paragraph at the end of
 * this docblock for why this one could not follow it. The reason it was
 * written is the same: `assumption.validate_by` has been a real field since the
 * category shipped, but nothing has ever compared it against today's date
 * until this check exists to do it. Without a cutoff, every assumption whose
 * deadline already passed BEFORE this check was written would surface at
 * once — not because anyone missed a deadline the product was watching, but
 * because the product had never watched before. That is the same "406 tasks
 * suddenly missing a field nothing could have written yet" shape
 * `verifiedOnAdoptedAt`'s own docblock argues from, one category over.
 *
 * Keyed on the assumption's own CREATION, read off its `create` audit
 * record — simpler than `checkTaskUnverified`'s transition-keyed cutoff, and
 * deliberately so: that check was reversed onto a transition because a task
 * can be created long before it reaches `done`, so keying on creation would
 * exempt it forever. An assumption has no analogous later transition to key
 * on — becoming overdue is not a write anything makes, only a calendar date
 * passing — so the fact this check can actually ask about is when the item
 * itself first existed, which is exactly what a `create` record answers.
 *
 * ── WHY THIS ONE IS STILL A DATE, WHEN THE OTHER STOPPED BEING ONE ──────────
 *
 * `verifiedOnAdoptedAt` could be derived because the question underneath it —
 * *had this workspace started using the field* — is one the workspace's own
 * log answers. This cutoff's question is not: it is *when was the version of
 * this product containing this check installed here*, and nothing in a corpus
 * records that. No derivation was invented to stand in for it, because a
 * plausible wrong line is worse than an honest hard-coded one.
 *
 * **And the consumer consequence is the opposite of the other one's, which is
 * why it is not urgent.** In an install created today every `create` record
 * postdates this instant, so the branch grandfathers nothing — and nothing
 * needs grandfathering, because the check was watching from that workspace's
 * first second. The population is "assumptions whose deadline passed", which
 * is small and is a real finding wherever it is non-empty. Contrast the task
 * cutoff, whose population over there was *every closed task*. The cost here
 * is one stale-looking date in shipped code; it is filed, not fixed, and this
 * paragraph is the reason.
 */
export const ASSUMPTION_OVERDUE_INTRODUCED_AT = '2026-09-05T12:00:00.000Z';

/** `''` and whitespace-only both read as absent — the same convention `taskVerifiedOn` uses. */
function assumptionField(item: Item, key: string): string {
  return (item.extra[key] ?? '').trim();
}

/**
 * **`assumption.validate_by` / `validated_on`'s only consumer.**
 *
 * An assumption whose deadline has passed with nothing recorded in
 * `validated_on` is reported — unless it was captured before this check
 * could have watched it (`ASSUMPTION_OVERDUE_INTRODUCED_AT`), in which case
 * it is counted into a single coverage disclosure and never named, the same
 * shape `checkTaskUnverified` uses for its own grandfathered population.
 *
 * `validate_by`/`validated_on` are read as plain `YYYY-MM-DD` strings, like
 * every other date field this corpus stores, so ordinal string comparison
 * against `new Date().toISOString().slice(0, 10)` is a correct date compare
 * without parsing either side.
 */
export function checkAssumptionOverdue(
  root: string, items: Item[], readRecords: AuditReader = () => readAudit(root),
): Finding[] {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = items.filter((item) => item.type === 'assumption' && item.status !== 'superseded')
    .filter((item) => {
      const validateBy = assumptionField(item, 'validate_by');
      return validateBy !== '' && validateBy < today && assumptionField(item, 'validated_on') === '';
    });
  if (overdue.length === 0) return [];

  let records: AuditRecord[];
  try {
    records = readRecords();
  } catch (err) {
    return [{
      level: 'info', code: 'assumption_overdue_coverage',
      about: 'assumption_overdue',
      remedy: PERSON,
      message:
        `${overdue.length} assumption(s) carry a \`validate_by\` date that has passed with no ` +
        `\`validated_on\`, and none of them has been checked against the audit log, because the ` +
        `log could not be read: ${err instanceof Error ? err.message : String(err)} That is an ` +
        `UNMEASURED set and not a clean one. The file named in that refusal is what a person has ` +
        `to look at first.`,
    }];
  }

  const createdAt = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'mutation' || record.op !== 'create') continue;
    const id = record.itemId;
    if (typeof id !== 'string' || id === '') continue;
    // Records arrive oldest-first (`readAudit`'s own contract); an id is
    // created once, so the first (and only) match is kept as-is rather than
    // overwritten by anything later.
    if (!createdAt.has(id)) createdAt.set(id, record.at);
  }

  const findings: Finding[] = [];
  let unmeasured = 0;
  for (const item of overdue) {
    const at = createdAt.get(item.id);
    // No recorded creation — a hand-written file, or one captured before this
    // workspace began recording writes — is not evidence either way, so it is
    // grandfathered the same as a birth date this check can prove predates it,
    // rather than reported on a fact this log cannot establish.
    if (at === undefined || at < ASSUMPTION_OVERDUE_INTRODUCED_AT) { unmeasured++; continue; }

    findings.push({
      level: 'warn', code: 'assumption_overdue', item: item.id,
      remedy: ACK,
      message:
        `carries \`validate_by: ${assumptionField(item, 'validate_by')}\`, which has passed, ` +
        `and no \`validated_on\`. An assumption with a missed deadline and nothing recorded is a ` +
        `belief nobody has checked — read the premise, and either \`mycontext edit ${item.id} ` +
        `--extra validated_on=<date>\` records that it was, or \`mycontext ack ${item.id} ` +
        `assumption_overdue\` records a ruling that no check is needed.`,
    });
  }

  if (unmeasured > 0) {
    findings.push({
      level: 'info', code: 'assumption_overdue_coverage',
      about: 'assumption_overdue',
      remedy: NOTHING,
      message:
        `${unmeasured} assumption(s) carry a passed \`validate_by\` with no \`validated_on\` and ` +
        `were either captured before this check existed (${ASSUMPTION_OVERDUE_INTRODUCED_AT}) or ` +
        `carry no recorded creation this log can read — so \`assumption_overdue\` cannot say ` +
        `whether the deadline was ever one this product could have flagged. Nothing is owed on ` +
        `this line, and this set can only shrink: every assumption created from now on is watched ` +
        `for its whole life.`,
    });
  }

  return findings;
}

/**
 * **A `reference` with no `source_file` at all is invisible to every drift
 * check this corpus has**, and the category's whole stated purpose — "a
 * snapshot of a file, with its origin recorded so doctor reports drift" (see
 * `mycontext_help("categories")`) — depends on one being set.
 *
 * `checkSourceDrift` and the snapshot half of it (`checkSnapshotDrift`) both
 * examine only items that ALREADY carry `sourceFile`/`sourceAnchor`/
 * `sourceChecksum` — reasonably, since drift is a question about a file
 * that was recorded and might have changed. A `reference` minted with none of
 * the three (by hand, or through `create_item` with no source fields) never
 * reaches either check, and sits in the corpus looking exactly like a
 * snapshot that has not drifted, when in fact nothing was ever recorded to
 * compare it against.
 *
 * **`continuity: true` is exempt, and it is a structural exemption, not a
 * blanket one.** `DEC-continuity-gets-its-own-budget-and-the-item-it-holds-
 * must-be` rules that the continuity item is a POINTER PLUS A BOUNDED DIGEST,
 * never the document itself, and that its `source_file` is DELIBERATELY
 * cleared so `mycontext refresh` cannot silently pull an unbounded document
 * back in — the item's own body states this in as many words. That is a
 * cited, owner-ruled reason for this exact shape on this exact tier, not a
 * license for any hand-authored `reference` to skip capture: a `reference`
 * that is not on the continuity tier and carries no `source_file` gets no
 * exemption here, and is exactly the gap this check exists to surface.
 */
export function checkReferenceNoSource(items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.type !== 'reference') continue;
    if (item.status === 'superseded') continue;
    if (item.continuity) continue;
    if (item.sourceFile !== null) continue;
    findings.push({
      level: 'warn', code: 'reference_no_source', item: item.id,
      remedy: ACK,
      message:
        `carries no "source_file" at all, so \`mycontext doctor\` can never report drift for it ` +
        `— a \`reference\` exists to be a snapshot of a file with its origin recorded, and one ` +
        `with no recorded origin cannot be checked against anything. Capture it properly with ` +
        `\`mycontext add reference "<title>" --file <path>\`, which records "source_file" and ` +
        `"source_checksum" so drift can be reported; or, if ${item.id} is not really a copy of a ` +
        `file, recategorize it — a reference with no source is invisible to the one check its ` +
        `category exists to receive.`,
    });
  }
  return findings;
}

/**
 * **A retired item that still says it is pinned, or still says it binds.**
 *
 * `supersedeItem` stands an item down in the same act that retires it (see its
 * doc comment). That is PROSPECTIVE: it fixes retirements from 2026-09-08
 * onward and repairs nothing already on disk. This check is the other half —
 * the items retired before it existed, which nothing would otherwise surface.
 *
 * **On this corpus, the day it was written: seven items, eight fields.** 1,021
 * items, 60 of them retired; `RULE-delegate-to-subagents-by-default-to-preserve
 * -the-context` superseded and still `always: true` AND `severity: hard`, plus
 * six more carrying `hard` alone — `OPENQ-does-sessionstart-injection-actually-
 * work`, `OPENQ-how-do-filters-respect-dependencies`, `REQ-items-carry-a-domain`
 * and three deprecated `KNOWN-` items. All seven are normative-tier categories,
 * so none of the fields is inert; every one of them is a stored claim to
 * authority the item no longer has.
 *
 * ── WARN, NOT ERROR, AND THE LEVEL IS THE RULING ────────────────────────────
 *
 * Nothing is being delivered wrongly. `isEligible` filters `RETIRED_STATUSES`
 * out of selection before a pin can matter, so the first tier holds and this is
 * BOOKKEEPING — a field that survives as data and misleads a reader or a count,
 * not an item reaching a session it should not. `warn` keeps it off the exit
 * code (`exitCode` reads `counts.errors`), which is the whole of "reported, not
 * gated": a person may have a reason for any one of these, and a check that
 * failed CI over an unpinned pin would be answered by turning the check off.
 *
 * The remedy is `edit` rather than `ACK` because there is an exact command
 * here, and this file's rule for the `run` route is that the finding's own
 * MESSAGE names it — it does, and `values` is built per item so an item
 * carrying only `hard` is not offered a pin it does not have. `mycontext ack`
 * remains available on every finding and the message says so, which is the
 * route for the person who has a reason.
 *
 * `validated` is EXCLUDED, and it is the one judgement call in the check —
 * `STOOD_DOWN_STATUSES` (select.ts) carries the argument and the measurement.
 */
export function checkRetiredStillBinding(items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (!STOOD_DOWN_STATUSES.has(item.status)) continue;
    const fields = standDownFields(item);
    if (fields.length === 0) continue;
    const pinned = fields.includes('always');
    const hard = fields.includes('severity');
    // Only the fields this item actually carries, so the composed command
    // cannot set one it does not have — the same reason `fields` is a list
    // rather than a boolean in `standDownFields`.
    const values: RemedyValues = {
      id: item.id, ...(pinned ? { always: 'false' } : {}), ...(hard ? { severity: 'soft' } : {}),
      yes: true,
    };
    const carries = [
      ...(pinned ? ['`always: true`'] : []),
      ...(hard ? ['`severity: "hard"`'] : []),
    ].join(' and ');
    const flags = [
      ...(pinned ? ['--always=false'] : []),
      ...(hard ? ['--severity soft'] : []),
    ].join(' ');
    findings.push({
      level: 'warn', code: 'retired_still_binding', item: item.id,
      remedy: { route: 'run', command: 'edit', values },
      message:
        `is "${item.status}" and still carries ${carries}. Nothing is being delivered wrongly — ` +
        `a retired item is filtered out of injection before a pin can matter — but the ` +
        `${fields.length > 1 ? 'fields survive' : 'field survives'} as DATA, read by counts, ` +
        `reports, the pinned-set review and anything written later by somebody who reasonably ` +
        `assumes a pinned item is a live one. Retiring an item stands it down in the same act ` +
        `since 2026-09-08; ${item.id} was retired before that. Stand it down with ` +
        `\`mycontext edit ${item.id} ${flags} --yes\`, or, if the ` +
        `${fields.length > 1 ? 'values are' : 'value is'} deliberate, record why with ` +
        `\`mycontext ack ${item.id} retired_still_binding\`.`,
    });
  }
  return findings;
}

/**
 * **THE DRAIN — the contradictions already in the corpus, found and REPORTED,
 * NEVER GATED.**
 *
 * `plan:contra seq:3`; design of record
 * `docs/superpowers/specs/2026-09-07-contradiction-gate-design.md` §9. The gate
 * (`contradictionGate`, core/overlap.ts) guards NEW writes only, and turning it
 * on did nothing about what was already written. In one working day this
 * project found **five superseded instructions being acted on as current**,
 * including two comment blocks in `e2e/app.ts` asserting opposite things about
 * which corpus it uses, forty lines apart, both live. This is how that debt
 * drains: a pairwise sweep over the items that currently govern, reporting the
 * closest pairs for a person to settle.
 *
 * ── IT NEVER GATES, AND THE TITLE OF ITS OWN ITEM SAYS SO ───────────────────
 *
 * `info`, which keeps it off `exitCode` (which reads `counts.errors`), and it
 * must never be anything else. The reason is the one this project keeps
 * relearning rather than a preference: **a gate that fires on a large
 * pre-existing population is a gate people mute, and a muted gate has stopped
 * gating.** Measured twice in the week this was written — `cssom-restatement`
 * spent a day red over a line number and four lanes recorded it as "the known
 * pre-existing failure" and worked around it; two `palette-lib` failures sat in
 * a "known-red" bucket for a day and turned out to need one row. It is the same
 * ruling `check-cited-items` and `check-basis`' RETIRED tier already carry one
 * layer up.
 *
 * ── ONE SET OF RULINGS, SHARED WITH THE GATE ───────────────────────────────
 *
 * §9 is explicit: *"a pair already ruled distinct must not be reported here
 * either, and a verdict that has lapsed because one item changed meaning SHOULD
 * be. Otherwise the drain and the gate would disagree about the same pair,
 * which is the failure this whole subject exists to prevent."* So this reads
 * the gate's own log through `readVerdicts` (core/verdict-store.ts), keys on
 * `pairKey`, and lapses on `contradictionBasis` exactly as `verdictHolds` does.
 * The log is the only state; nothing here writes.
 *
 * The POPULATION is the gate's too — `governsNow` and `inContradictionScope`
 * for the candidates, `overlapScore >= CONTRADICTION_THRESHOLD` for the pair —
 * so no pair the gate would raise on a write is invisible here.
 *
 * ── BUT THE RANKING IS NOT THE GATE'S, AND THAT IS A MEASUREMENT ───────────
 *
 * Measured over this corpus on 2026-09-10 — 1,076 items, 208 governing and in
 * scope by §3, 21,528 pairs:
 *
 *   band   <0.10   0.10-0.20   0.20-0.30   0.30-0.35   0.35-0.40   0.40-0.45   0.45+
 *   pairs    370       8,364      11,079       1,170         313         150      82
 *
 * Of the **82** pairs at or above `CONTRADICTION_THRESHOLD`, **72 involve one
 * item**: `REF-the-d-numbers-what-each-one-means-and-which-are-only`, a pinned
 * 808-token reference index (median in-scope item: 161 tokens). Its `jaccard`
 * with those 72 partners is **0.13–0.16** — they are not about the same subject
 * at all. The score is coming entirely from `containment * 0.8`, which is
 * measuring LENGTH: almost any ordinary item's vocabulary is nearly a subset of
 * an 808-token English body. Ranked by the gate's score, this report would be
 * 88% one long item.
 *
 * **So it ranks by `jaccard`**, the symmetric half of the same measurement, and
 * the difference is visible in the output: the top of the jaccard order is
 * `DEC-the-ui-upkeep-is-off-unless-a-port-is-configured` against
 * `REQ-the-ui-server-is-running-whenever-the-owner-looks`, and
 * `RULE-drive-the-ui-through-playwright-while-doing-the-work` against
 * `RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most` — real pairs of
 * governing items about one subject, which is what a person can settle. Both
 * numbers are printed on every finding so the reader can see which half carried
 * it. `PER_ITEM` then caps one item to one finding, so no single hub can fill
 * the report even within the jaccard order.
 *
 * ── THE LIMIT, STATED ONCE, BECAUSE THE NUMBER MUST NOT BE READ WIDER ──────
 *
 * **This cannot rank the corpus's own worked example into view, and that was
 * measured, not feared.** `DEC-the-ui-is-developed-against-a-simulated-corpus-
 * until-the` versus `INSTR-testing-happens-against-the-current-corpus-and-an-
 * exception` is the contradiction §1 of the design opens with — it cost a
 * morning of misdiagnosis, and both items were live at the time. It scores
 * **0.267, jaccard 0.150**: far below the threshold, among 11,079 pairs in the
 * 0.20–0.30 band, and **no lexical cutoff exists that admits it and excludes
 * them**. The maximum jaccard between ANY two governing in-scope items in this
 * corpus is 0.345.
 *
 * So what this check reports is *the closest pairs*, and that is all it claims.
 * It is a FLOOR and not a census, the coverage line says so in as many words,
 * and a contradiction between two items that share little vocabulary is
 * invisible here. That is also why §12's ruling stands: no negation heuristics,
 * no embedding model, no new dependency — the honest fix for the rest is a
 * person reading, and this check exists to put the cheapest ten pairs in front
 * of them rather than to pretend the other 21,446 were examined.
 */
export const CONTRADICTION_DRAIN_CAP = 10;
export const CONTRADICTION_DRAIN_PER_ITEM = 1;

/** One pair the sweep raised, with both halves of its measurement. */
interface DrainPair {
  a: Item;
  b: Item;
  score: number;
  jaccard: number;
}

export function checkCorpusContradictions(root: string, items: Item[]): Finding[] {
  const candidates = items.filter(
    (i) => governsNow(i.status) && inContradictionScope(i.type, i.always),
  );
  // Nothing to compare is NOT a clean corpus, and it is not reported as one:
  // with fewer than two governing in-scope items there is no pair, and the
  // coverage line below says how many were compared rather than leaving a
  // silence to be read as a verdict (`STD-a-measured-zero-is-drawn-and-named`).
  let compared = 0;
  const raised: DrainPair[] = [];
  // ── TOKENIZED ONCE PER ITEM, NOT ONCE PER PAIR ────────────────────────────
  //
  // `overlapParts(a, b)` tokenizes both TEXTS, which is right where one draft
  // is compared against a list and wrong here, where the list is compared
  // against itself: every item's body was re-tokenized once per partner.
  //
  // Measured on the owner's corpus, 2026-09-15, 1,269 items and 214 candidates
  // over 22,791 pairs: the check went from **1,453 ms to 65 ms**, and the sweep
  // inside it from 1,240 ms to 59 ms — 45,582 tokenizations reduced to 214.
  // `runChecks` as a whole went from 2,202 ms to 700 ms and returned the same
  // 190 findings. This check was 66 % of `runChecks`, which is
  // in turn ~97 % of `/api/status` and `/api/doctor`
  // (`src/ui/read-model-health.ts` carries the endpoint measurement).
  //
  // The result is IDENTICAL and not approximately so: `overlapParts` is now
  // literally `overlapPartsOfTokens(overlapTokensOf(a), overlapTokensOf(b))`
  // (core/overlap.ts), so this is that same composition with the left half
  // hoisted out of the inner loop. `test/doctor/contradiction-drain.test.ts`
  // proves the two agree over every pair of a real corpus rather than over a
  // fixture, and would redden here if the hoist ever stopped being sound —
  // an item mutated mid-sweep, for instance, which nothing does and which the
  // proof would catch if something started to.
  const tokens = candidates.map((i) => overlapTokensOf(i));
  for (let i = 0; i < candidates.length; i++) {
    const ti = tokens[i]!;
    for (let j = i + 1; j < candidates.length; j++) {
      compared++;
      const parts = overlapPartsOfTokens(ti, tokens[j]!);
      if (parts.score < CONTRADICTION_THRESHOLD) continue;
      raised.push({
        a: candidates[i]!, b: candidates[j]!, score: parts.score, jaccard: parts.jaccard,
      });
    }
  }

  // **The gate's own rulings, honoured here by reading the gate's own log.** A
  // pair somebody already settled is gone from this report exactly as it is
  // gone from the gate's refusal, and it comes back in both places on the same
  // event: either item's `contradictionBasis` moving, which is what "the
  // verdict lapsed because one item changed meaning" means.
  //
  // A verdict log that cannot be READ throws out of `readVerdicts` on purpose
  // ("cannot read" and "nothing was ruled" are opposite facts), and `runChecks`
  // turns a throwing check into one `check_failed` finding — which is the right
  // outcome: the sweep reporting every settled pair again would be the wall §7
  // exists to prevent, reached through a silent read.
  const settled = latestVerdicts(readVerdicts(root));
  const basis = new Map(candidates.map((i) => [i.id, contradictionBasis(i)]));
  const holds = (p: DrainPair): boolean => {
    const recorded = settled.get(pairKey(p.a.id, p.b.id));
    if (recorded === undefined) return false;
    const aFirst = recorded.a === p.a.id;
    return (aFirst ? recorded.aBasis : recorded.bBasis) === basis.get(p.a.id) &&
      (aFirst ? recorded.bBasis : recorded.aBasis) === basis.get(p.b.id);
  };
  const open = raised.filter((p) => !holds(p));

  // ── THE JACCARD FLOOR, AND BOTH NUMBERS IN IT ALREADY EXISTED ─────────────
  //
  // A pair is in the POPULATION when it clears `CONTRADICTION_THRESHOLD` on the
  // gate's own score, which is what makes the drain and the gate agree about
  // which pairs exist. It is REPORTED only when its `jaccard` also clears
  // `OVERLAP_THRESHOLD` — the 0.2 that has meant "this much lexical overlap is
  // worth putting in front of a person" since the Capture screen's hint
  // shipped, applied here to the symmetric half.
  //
  // **Neither number is invented for this check, and the floor was measured
  // rather than chosen.** Without it the first run reported ten pairs and the
  // bottom four carried jaccards of 0.16, 0.12, 0.09 and 0.05 —
  // `CONST-node-24-no-build-step` against a requirement about README
  // documentation, at jaccard 0.05, where the 0.46 score is the two bodies'
  // lengths and nothing else. With it, the report is the six pairs of governing
  // items that actually share a subject. The 76 it drops are counted and named
  // in the coverage line, because "dropped" and "absent" are different facts.
  const subject = open.filter((p) => p.jaccard >= OVERLAP_THRESHOLD);

  // Jaccard first — see the docblock for the 72-of-82 measurement that decided
  // it — then the gate's score, then the ids, so the order is a fact about the
  // corpus rather than about the order two equal pairs happened to arrive in.
  subject.sort((x, y) =>
    y.jaccard - x.jaccard || y.score - x.score ||
    (x.a.id === y.a.id ? x.b.id.localeCompare(y.b.id) : x.a.id.localeCompare(y.a.id)));

  const shown: DrainPair[] = [];
  const appearances = new Map<string, number>();
  for (const p of subject) {
    if (shown.length >= CONTRADICTION_DRAIN_CAP) break;
    const na = appearances.get(p.a.id) ?? 0;
    const nb = appearances.get(p.b.id) ?? 0;
    if (na >= CONTRADICTION_DRAIN_PER_ITEM || nb >= CONTRADICTION_DRAIN_PER_ITEM) continue;
    appearances.set(p.a.id, na + 1);
    appearances.set(p.b.id, nb + 1);
    shown.push(p);
  }

  const findings: Finding[] = [];
  for (const p of shown) {
    const said = (i: Item): string =>
      i.summary === null ? '(no summary — read the item before ruling on it)' : `"${i.summary}"`;
    findings.push({
      // `info` and never anything else — see the docblock. The remedy is ACK
      // because the question genuinely has an answer this reader can give: read
      // the two items and decide. It is RULABLE in this file's own terms, and
      // `ack` lapses on a content change exactly as a verdict does, so a pair
      // whose meaning moves comes back.
      level: 'info', code: 'contradiction_pair', item: p.a.id,
      remedy: ACK,
      message:
        `may contradict ${p.b.id} (${p.b.severity === 'hard' ? `${p.b.type} · hard` : p.b.type}), ` +
        `which also governs. Overlap ${p.score.toFixed(2)}, of which jaccard ` +
        `${p.jaccard.toFixed(2)} — the lower the jaccard, the more of the score is the two ` +
        `items' LENGTHS rather than their subject.\n` +
        `    ${p.a.id}: ${said(p.a)}\n` +
        `    ${p.b.id}: ${said(p.b)}\n` +
        `    Nothing in this product can tell you whether these conflict: the match is LEXICAL, ` +
        `and two items that AGREE score exactly as high as two that conflict. If both can be ` +
        `true, record it with \`mycontext ack ${p.a.id} contradiction_pair\`; if one replaces ` +
        `the other, \`mycontext supersede <the wrong one> --by <the right one>\`, which also ` +
        `tells you which tests rest on it.`,
    });
  }

  // ── THE COVERAGE LINE: ONE PER RUN, NEVER PER ITEM ─────────────────────────
  //
  // This file's rule is that what a check cannot measure is disclosed ONCE and
  // never beside each finding, and §9's whole claim rests on the disclosure
  // being honest: the 0.267 measurement below is what stops this report being
  // read as "these are the contradictions in the corpus".
  //
  // It rides WITH the findings, like `body_review_limits`, for that check's
  // stated reason: "a clean corpus's summary counts are exactly 0/0/0" is
  // pinned in three test files and is what makes `doctor` usable in CI. The
  // cost is named rather than hidden — on a corpus where no pair clears the
  // threshold, this says nothing, and "nothing found" is still not "nothing
  // present".
  if (findings.length > 0) {
    findings.push({
      level: 'info', code: 'contradiction_drain_limits',
      about: 'contradiction_pair',
      remedy: NOTHING,
      message:
        `${compared} pair(s) of the ${candidates.length} item(s) that currently govern were ` +
        `compared; ${raised.length} scored at or above ${CONTRADICTION_THRESHOLD}, ` +
        `${raised.length - open.length} of those are already settled by a recorded ruling, ` +
        `${open.length - subject.length} score below ${OVERLAP_THRESHOLD} on jaccard and are ` +
        `dropped as LENGTH rather than subject, and ${shown.length} of the remaining ` +
        `${subject.length} are shown (at most ${CONTRADICTION_DRAIN_PER_ITEM} per item and ` +
        `${CONTRADICTION_DRAIN_CAP} in total, so one long item cannot fill the report). This ` +
        `NEVER gates. It is a FLOOR and not a census: the one contradiction this project ` +
        `actually measured — ` +
        `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the against ` +
        `INSTR-testing-happens-against-the-current-corpus-and-an-exception, which cost a morning ` +
        `of misdiagnosis while both were live — scores 0.267, below the cutoff and among ` +
        `thousands of pairs that say nothing about each other. No lexical cutoff admits it and ` +
        `excludes them, so a contradiction between two items that share little vocabulary is ` +
        `INVISIBLE here. "None found" is not "none present".`,
    });
  }

  return findings;
}

/**
 * **A second `.my_context` below this one, which would shadow it.**
 *
 * `findProjectRoot` walks UP from the session's working directory and stops at
 * the FIRST `.my_context` it finds. So a corpus nested inside the repository
 * captures every session started at or below it — silently, and with a
 * different corpus than the one the repository is about.
 *
 * **This project is its own example.** `my-context/.my_context` holds 44 items
 * and ZERO tasks, on a different category set (`adr`, `invariant`, `non_goal`);
 * the repository root holds 510 items and 361 tasks. A session started one
 * directory in gets the small one and a board that looks empty.
 *
 * **It is `info`, not a defect.** A nested workspace is a legitimate thing —
 * a plugin that carries its own design corpus, a fixture, a vendored project —
 * and the notice exists so a reader learns it HERE rather than from a surprise,
 * which is the register `foreign_store` is drawn in for the same reason.
 *
 * Written on 2026-08-26, the day a session spent nine days outside the
 * workspace with nothing on any surface reporting it. That failure was a cwd
 * ABOVE the corpus; this is the same failure with the cwd BELOW it, and it is
 * the one variant the fixes that day do not cover: resolving from the file
 * still finds the nearest root, and the nearest root is the nested one.
 *
 * The walk is bounded the way every other scan here is — `SKIP_DIRS` minus
 * `.my_context` itself, since that is precisely what is being looked for.
 */
export function checkNestedCorpus(root: string, repoRoot: string): Finding[] {
  // `SKIP_DIRS` minus `.my_context` itself — that is what is being looked for —
  // plus the places a corpus is a FIXTURE rather than somewhere anyone works.
  // Measured on this repository the first time it ran: four hits, of which one
  // was the real hazard (`my-context/.my_context`, 44 items and no tasks) and
  // three were a test fixture, a generated demo corpus and a harness scratch
  // directory. A check whose true positives are outnumbered three to one is a
  // check people learn to scroll past, which is worse than not having it.
  //
  // The list was this repository's own directory names until 2026-09-14, and
  // a stranger's were missing from it. Measured on a workspace created that
  // day by `mycontext init`: a corpus planted under `__fixtures__/`, `spec/`
  // and `e2e/` produced three `nested_corpus` findings, and the identical
  // corpus under `test/` produced none — three false positives against zero,
  // the same three-to-one ratio the paragraph above says makes a check people
  // scroll past, only pointed at somebody else's repository. The four names
  // added here are the ones a JavaScript project actually uses; `fixture` is
  // the singular nobody writes and is added for the same cost as reading this
  // sentence.
  const FIXTURE_DIRS = [
    'test', 'tests', '__tests__', 'spec', 'specs', 'e2e',
    'fixture', 'fixtures', '__fixtures__', 'harness', '.scratch', '.demo-corpus',
  ];
  const skip = new Set([
    ...[...SKIP_DIRS].filter((d) => d !== '.my_context'),
    ...FIXTURE_DIRS,
  ]);
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4 || found.length >= 8) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // unreadable is not this check's problem
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = path.join(dir, name);
      try {
        if (!statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      if (name === '.my_context') {
        // The workspace's own root is the thing every session is meant to
        // find. Only a DIFFERENT one shadows it.
        if (path.resolve(full) !== path.resolve(root)) found.push(relPosix(repoRoot, full));
        continue; // never descend into a corpus
      }
      walk(full, depth + 1);
    }
  };
  walk(repoRoot, 0);

  return found.sort().map((where) => ({
    level: 'info' as const,
    code: 'nested_corpus',
    remedy: NOTHING,
    message:
      `a second corpus is nested at "${where}". \`findProjectRoot\` stops at the FIRST ` +
      '`.my_context` above the working directory, so any session started at or below that path ' +
      'gets THAT corpus instead of this one — a different board, silently. Nothing is wrong with ' +
      'it existing; start sessions at the repository root, or cd out of it before you do.',
  }));
}

/**
 * Directories inside the repository where ANOTHER tool keeps durable knowledge
 * of the same kind my_context keeps. One entry today; a second is one line.
 *
 * `docs/solutions/` is the compound-engineering plugin's learnings store — a
 * directory of Markdown files, written by an agent when it finishes a problem,
 * describing what must hold next time. That is a `lesson` by any other name,
 * spelled differently and with no ids either side can resolve.
 *
 * The list is HARD-CODED and repository-relative on purpose. The alternative
 * shapes were weighed in
 * `open_question/OPENQ-where-may-foreign-store-look-given-it-reads-outside-the.md`:
 * a configured list is honest and needs someone to write it, and a filesystem
 * scan is thorough and is the one that surprises people. A short named list
 * goes stale, which is a cost paid by editing one line here.
 */
const FOREIGN_STORE_DIRS = ['docs/solutions'];

/**
 * **Another tool is keeping durable learnings inside this repository.**
 *
 * my_context exists to be the place durable knowledge lives. A second store in
 * the same tree quietly defeats that: the learnings written there are real,
 * they are the same KIND as a `lesson`, and my_context will never inject one of
 * them — not because anything failed, but because it does not know they exist.
 *
 * **It is `info`, the same register as `checkNestedCorpus` above and for the
 * same reason.** Two knowledge stores in one repository is a legitimate state —
 * two plugins installed, each doing its own job — so this is a fact to learn
 * HERE rather than from a surprise, not a defect to fix. `info` informs and
 * does not nag, which is why `decision/DEC-foreign-store-becomes-a-real-check-at-notice-level.md`
 * put it at notice level in the design.
 *
 * **What this check deliberately does NOT do: leave the repository.** The
 * mockup's notice card draws TWO `foreign_store` rows, and the second one names
 * `~/.gsd/knowledge/` — a path in the user's HOME directory. The owner dropped
 * that row on 2026-08-26: it was a guess at one specific other plugin, no
 * requirement or incident sits behind it, and a diagnostic that reads a home
 * directory is a different KIND of thing from one that reads `.my_context/` —
 * it can be slow, and on a shared machine it can see paths that are not the
 * user's business. With that row gone this check never reads outside the
 * repository, which DISSOLVES the open question rather than answering it, and
 * means `test/core/real-home-guard.test.ts` has nothing here to guard against.
 *
 * The read is a single `statSync` per named directory rather than the bounded
 * walk `checkNestedCorpus` needs — the paths are known, so there is nothing to
 * search for.
 */
export function checkForeignStore(repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  for (const where of FOREIGN_STORE_DIRS) {
    // `FOREIGN_STORE_DIRS` is written POSIX and reported POSIX; only the join
    // is native, per INV-posix-normalized-paths — a backslash must never reach
    // a message a reader is meant to paste back at a shell.
    const full = path.join(repoRoot, ...where.split('/'));
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue; // absent, or unreadable — either way there is nothing to report
    }
    findings.push({
      level: 'info' as const,
      code: 'foreign_store',
      remedy: NOTHING,
      message:
        `another plugin writes durable learnings in "${where}/" inside this repository — the ` +
        'same KIND of knowledge as a `lesson`, in a second spelling, with no ids either store ' +
        'can resolve in the other. my_context never reads that directory and never writes to ' +
        'it: nothing there is indexed, and nothing there is ever injected into a session. It ' +
        'is reported so you learn it HERE rather than from a surprise — what is written there ' +
        'is knowledge this tool will not carry for you.',
    });
  }
  return findings;
}

/**
 * **Every finding a person has already ruled on, marked — and nothing else
 * touched.**
 *
 * One pass, after all the checks, and that placement is the design. Twenty
 * checks do not each need to remember that acknowledgement exists, a check
 * written tomorrow is acknowledgeable the day it ships, and no check can be
 * written that quietly declines to honour a ruling. `Finding.code` plus
 * `Finding.item` is the whole key, which is exactly what a person types into
 * `mycontext ack`.
 *
 * `isAcknowledged` is what decides, and it does the anchor comparison: a
 * ruling made against content that has since moved is `lapsed` and marks
 * nothing, so the finding is reported open again. That is the guarantee the
 * feature stands on — see `core/acknowledge.ts`.
 *
 * A finding with no `item` (`body_review_limits`, `index_stale`, the corpus-wide
 * notes) is never marked: there is nowhere to record a ruling on it, because
 * the record lives on the item. An id no longer in the corpus is likewise not
 * marked — `byId` is built from the items this run actually read.
 *
 * The array is mutated in place rather than rebuilt. A finding is an object
 * every caller already holds by reference by the time this runs, and returning
 * copies would leave `runChecks`' own `findings.push` results unmarked.
 */
export function markAcknowledged(findings: Finding[], items: Item[]): void {
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const finding of findings) {
    if (finding.item === undefined) continue;
    const item = byId.get(finding.item);
    if (item === undefined) continue;
    if (isAcknowledged(item, finding.code)) finding.acknowledged = true;
  }
}

/**
 * **An acknowledgement is anchored to an ITEM, so a finding that names none
 * cannot carry one.**
 *
 * `acknowledgeFinding` (core/mutate.ts) writes into the item's own
 * `acknowledged` map and re-stamps its checksum — that anchoring is the whole
 * of the 2026-08-27 ruling, and it is why `mycontext ack` takes an id as its
 * first operand. A check that declared `route: 'acknowledge'` on a finding with
 * no `item` would therefore have a surface compose `mycontext ack undefined
 * <code>`, which the CLI refuses.
 *
 * TypeScript cannot see the pairing — `item` is optional on `Finding` and the
 * route is a literal — so it is enforced here, once, over the assembled list.
 * It DOWNGRADES rather than throws: the honest reading of "a person settles
 * this and there is nothing to anchor a ruling to" is exactly `why: 'person'`,
 * and a doctor that refused to run over a mis-declared remedy would take the
 * whole report away to report one field.
 */
export function anchorAcknowledgeRemedies(findings: Finding[]): void {
  for (const finding of findings) {
    if (finding.remedy.route !== 'acknowledge') continue;
    if (typeof finding.item === 'string' && finding.item !== '') continue;
    finding.remedy = PERSON;
  }
}

/**
 * **Which check a registry entry calls, READ OFF THE ENTRY ITSELF.**
 *
 * `check_failed` is the one finding in the whole set whose meaning is "a gate
 * is broken" — every other finding says something about the corpus and can be
 * traced from the item it names, and this one says something about the tool.
 * It was also the only one that could not say which part: the message read
 * `a doctor check threw: <message>` with no check, no index and no frame,
 * although the array being iterated was right there (raised twice
 * independently on 2026-09-12/13, as row 67 of the consolidated findings).
 *
 * **Derived, never a parallel array of labels.** A second list of names beside
 * the registry is one more hand-kept inclusion list — the exact shape
 * `a-scanner-names-what-it-skips-not-what-it-scans` exists against — and it
 * would drift silently, mislabelling a failure, which is worse than not
 * naming it. The entries are arrow closures whose whole body is one call, so
 * their SOURCE names the callee and cannot disagree with what they call.
 * `CONST-node-24-no-build-step` is what makes this safe: the `.ts` file is
 * executed as shipped, there is no minifier between this and the reader, and
 * `test/doctor/registry-membership.test.ts` derives the same names the same
 * way over the same array.
 *
 * Exported for its test alone, the same way `markAcknowledged` below is: the
 * composition of this message is the whole of what row 67 asked for, and a
 * test that could only reach it by making a real check throw would be pinning
 * whichever check happens to be fragile today rather than the naming.
 */
export function registeredCheckName(entry: () => Finding[]): string {
  const match = /\bcheck[A-Za-z0-9_]*/.exec(entry.toString());
  return match === null ? 'an unnamed check' : match[0];
}

/**
 * The first stack frame inside this project — `node:internal` frames and the
 * `Error:` header line say nothing a reader can act on, and the frame that
 * matters is the line in a check that threw.
 */
export function firstOwnFrame(stack: string): string {
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('at ') && !trimmed.includes('node:internal')) return trimmed;
  }
  return 'no frame outside node internals';
}

/**
 * `read` at most once, throw included.
 *
 * The throw is memoised alongside the value because a log that cannot be read
 * cannot be read twice either: re-reading it would pay the 165 ms parse again
 * to reach the same refusal, and the three checks that ask each need to see the
 * SAME error to write their own `*_coverage` finding about it. See
 * `AuditReader` (doctor/state-verification.ts) for why this is a thunk rather
 * than an array.
 *
 * **It takes the reader rather than the root, and that is what makes "once"
 * provable.** A version closing over `readAudit(root)` directly could only be
 * tested by watching a filesystem; this one is tested by counting calls —
 * `test/doctor/audit-read-once.test.ts`. Exported for that reason and no other.
 */
export function auditOnce(read: AuditReader): AuditReader {
  let records: AuditRecord[] | null = null;
  let failure: unknown;
  let failed = false;
  return () => {
    if (failed) throw failure;
    if (records !== null) return records;
    try {
      records = read();
    } catch (err) {
      failed = true;
      failure = err;
      throw err;
    }
    return records;
  };
}

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[]; config: Config;
}): Finding[] {
  // One reading of the audit log for the whole sweep — `AuditReader` carries
  // the measurement. Built even when no check reaches for it; it reads nothing
  // until one does.
  const audit = auditOnce(() => readAudit(opts.root));
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkBodyTruncation(opts.root, opts.items),
    () => checkLaunderedEnum(opts.root, opts.items),
    () => checkBodyAgreement(opts.items, opts.config),
    () => checkCitationForm(opts.repoRoot, opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items, opts.config),
    () => checkWatchedDocsServable(opts.repoRoot, opts.config),
    () => checkTutorialRoster(opts.repoRoot),
    () => checkScopePolicy(opts.items, opts.config),
    () => checkUnknownCategory(opts.items, opts.config),
    () => checkSkippedConfigKeys(opts.config),
    () => checkContinuity(opts.items, opts.config),
    () => checkSummary(opts.items),
    () => checkPermissions(opts.root, accessSync, opts.repoRoot),
    () => checkSessionIdMismatch(opts.root),
    () => checkAuditSize(opts.root),
    () => checkGoverningSpillPressure(opts.root, opts.items, opts.config),
    () => checkStateUnaudited(opts.root, opts.items, opts.config, audit),
    () => checkTaskUnverified(opts.root, opts.items, opts.config, audit),
    () => checkCorpusSize(opts.items),
    () => checkTagProjection(opts.items, opts.config),
    () => checkTaskNeeds(opts.items, opts.config),
    () => checkOpenQuestionBlocks(opts.items),
    () => checkAssumptionOverdue(opts.root, opts.items, audit),
    () => checkReferenceNoSource(opts.items),
    () => checkRetiredStillBinding(opts.items),
    () => checkCorpusContradictions(opts.root, opts.items),
    () => checkNestedCorpus(opts.root, opts.repoRoot),
    () => checkForeignStore(opts.repoRoot),
  ];

  const findings: Finding[] = [];
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]!;
    try {
      findings.push(...check());
    } catch (err) {
      // A check that throws must never suppress the others.
      findings.push({
        level: 'error', code: 'check_failed',
        remedy: PERSON,
        message:
          `\`${registeredCheckName(check)}\` (entry ${i + 1} of ${checks.length} in ` +
          `\`runChecks\`, src/doctor/checks.ts) threw, so this run reports NOTHING that check ` +
          `would have found — its whole population is missing from the counts above, and the ` +
          `other ${checks.length - 1} checks ran normally. ` +
          `${err instanceof Error ? err.message : String(err)}` +
          `${err instanceof Error && typeof err.stack === 'string'
            ? ` — first frame: ${firstOwnFrame(err.stack)}` : ''}`,
      });
    }
  }
  // After every check, never inside one — see `markAcknowledged`. Nothing is
  // removed here and no count moves; findings a person has ruled on are marked
  // so a reporting surface can DISTINGUISH them, which is the whole of the
  // owner's ruling and the whole of what this line does.
  markAcknowledged(findings, opts.items);
  anchorAcknowledgeRemedies(findings);
  return findings;
}
