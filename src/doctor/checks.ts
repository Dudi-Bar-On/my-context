import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAcknowledged } from '../core/acknowledge.ts';
import {
  AUDIT_MAX_BYTES, AUDIT_REPORT_BYTES, auditDir, auditSize, readAudit, type AuditRecord,
} from '../core/audit.ts';
import { scopePolicyFor, skippedKeyNotice, type Config } from '../core/config.ts';
import { isEligible, itemCost } from '../core/select.ts';
import {
  BLOCKED_STATE, buildTaskIndex, DONE_STATE, NEEDS_FIELD, readNeeds, STATE_FIELD, taskState,
  workItems,
} from '../core/needs.ts';
import { droppedBodyText } from '../core/item.ts';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import { summaryState } from '../core/content-hash.ts';
import { isSnapshot, snapshotText } from '../core/reference.ts';
import { RATIONALE_NOT_INJECTED } from '../core/render-item.ts';
import { checksum } from '../core/slug.ts';
import { projectionMismatches, updatesFor } from '../core/tag-projection.ts';
import { SUMMARY_MAX_CHARS } from '../core/validate.ts';
import type { Item } from '../core/types.ts';
import { chunkDocument } from '../ingest/chunk.ts';
import { ingestDir, SESSION_PROTOCOL } from '../ingest/session.ts';

/**
 * **THE RULE EVERY CHECK IN THIS FILE OBEYS: a check reports a finding only
 * when a person could DO something about it; what it cannot judge is disclosed
 * as UNMEASURED, once, and never per item.**
 *
 * Owner, 2026-09-03: *"the main problem is that even the user has no tools to
 * solve them ... i want to clear them all and complete to be annoyed by this
 * issue"* — against the purpose he had already stated for this whole module,
 * *"doctor was added to the app for repairing, this is its role"*. A finding a
 * reader cannot act on is a defect in the CHECK and not a chore for the
 * reader, which makes this a rule about what a check may EMIT and not about
 * how a screen draws what it emitted.
 *
 * Every row is therefore one of three things, and a check that produces a
 * fourth is wrong:
 *
 *  - **FIXABLE** — a command settles it (`Remedy.route: 'run'` or `'copy'`),
 *    and the finding's own message names that command.
 *  - **RULABLE** — a PERSON can answer the question it asks
 *    (`route: 'acknowledge'`). The test is NOT "is `ack` available": `ack` is
 *    available on every finding that names an item, which is exactly why its
 *    availability proves nothing. The test is *does the question have an
 *    answer this reader can give*. A question whose evidence was never
 *    recorded and cannot now be reconstructed does not, and asking for a
 *    ruling on it is the shape the owner is objecting to.
 *  - **NOT REPORTED — and said so, ONCE**, as a coverage line naming how many
 *    items the check could not look at and why. This is
 *    `STD-a-measured-zero-is-drawn-and-named` applied at the other end of the
 *    scale: a measured zero is drawn and named, an unmeasured set is named as
 *    unmeasured, and neither is ever blank. N per-item rows saying "this could
 *    not be measured" is the failure both halves of that standard forbid — it
 *    is blank dressed up as work. `checkStateUnaudited`'s
 *    `state_audit_coverage` is the worked example.
 *
 * **The failure this closes was measured, not imagined.** `state_unaudited`
 * shipped with 28 findings on this corpus, every one of them about a write
 * that predated the witness which could have recorded it. No command could
 * clear one; an unrelated edit could, and did — the count eroded 28 → 25 → 24
 * while nobody repaired anything. **A row that only an accident can clear is
 * not work. It is noise wearing work's clothes**, and it costs the reader the
 * attention that the rows next to it needed.
 *
 * The corollary for the loud half, which this rule must never be read as
 * softening: a condition a person CAN act on is still reported per item, by
 * name, with the evidence that established it. Narrowing a check to what it
 * can measure is not the same as narrowing it to what is comfortable.
 */
export interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
  /**
   * **A person has ruled on this exact finding, on this item, against the
   * content the item still has** (owner ruling 2026-08-27 — the whole argument
   * is on `core/acknowledge.ts`).
   *
   * Set by `markAcknowledged` below, after every check has run, and never by a
   * check: a check answers "is this true of the corpus", which does not change
   * because somebody read the answer.
   *
   * **It is a MARK, not a filter.** The finding is still in `findings`, still
   * in `counts`, and still contributes to the exit code exactly as its `level`
   * always did. Absent (rather than `false`) when nobody has ruled, so a
   * consumer can tell "not acknowledged" from a field that was never
   * populated — the same choice `cliOnPath: null` makes in doctor's JSON.
   */
  acknowledged?: true;

  /**
   * **This row is a NOTE ABOUT A CHECK, not a finding about the corpus**, and
   * the value is the code of the check it is about.
   *
   * The rule above this interface says what a check cannot judge is disclosed
   * once and never per item. `src/cli/commands/doctor.ts` finished the other
   * half — owner, 2026-09-03: *"after you complete handling them, the test
   * should be that they will not be listed anymore at doctor list"* — because a
   * row saying "nothing is owed" is still a row he has to read and dismiss.
   * `partitionFindings` routes anything carrying this out of the worklist and
   * under its own heading, where every character still prints and none of it is
   * counted as work.
   *
   * It names the CHECK rather than saying "this is a note", because a reader
   * meeting the sentence needs to know a note about WHAT: it is drawn under the
   * table whose reach it limits. `state_audit_coverage` is
   * `about: 'state_unaudited'`; `citation_form_excused` is
   * `about: 'citation_form'`.
   *
   * Absent, never `false`, on an ordinary finding — the same choice
   * `acknowledged` makes one field up, so a consumer can tell "not a
   * disclosure" from a field that was never populated. `doctor.ts` reads it
   * through `disclosureAbout`, which was written as a runtime test on an
   * optional string precisely so this declaration could land later without a
   * second edit there; its docblock names the `as` cast that is now redundant.
   */
  about?: string;

  /**
   * **What settles this finding**, declared by the check that emits it and
   * never by a surface that renders it — the design of record recorded at
   * `reports/V2-HANDOVER.md:437`. See `Remedy`.
   *
   * Required, not optional, and that is the whole point: a check added
   * tomorrow cannot reach a screen without somebody deciding what a reader is
   * supposed to DO about it. An optional field would have let the same silence
   * back in through the same door.
   */
  remedy: Remedy;
}

/**
 * The values a catalogue entry is rebuilt with — `src/ui/execute-catalogue.ts`
 * resolves an id plus one of these into the argv, and refuses anything outside
 * the entry's declared shape. `true` is a boolean flag SET; a flag left out is
 * simply absent, never `false`.
 */
export type RemedyValues = Record<string, string | true>;

/**
 * **What settles a finding, declared by the check that emits it.**
 *
 * Recorded as designed-and-unbuilt at `reports/V2-HANDOVER.md:437` and
 * `reports/EXECUTION-BOARD.md:99` (E32): *"a `Finding` in `src/doctor/` must
 * declare its OWN remedies, never a UI-side table."* Until 2026-09-03 the
 * decision lived twice in the browser — `screens/doctor.js`'s `repairFor` and
 * `lib/viewmodel.js`'s `repairCommandFor`, four `if`s each — and every code
 * either of them did not name drew a chip saying there was nothing to offer.
 * On this repository's own corpus that was 74 findings out of 74. Owner,
 * 2026-09-03: *"currently doctor contains many items i do not have any way to
 * handle, solve it"*.
 *
 * **It is DATA and never a composed string.** The client sends a catalogue id
 * and a value bag and never a command (spec §3.1, `src/ui/execute-catalogue.ts`),
 * so a remedy that carried a line would be a second composer whose output the
 * confirm could not be bound to. The one exception carries an explicit `argv`
 * and says why: see `copy`.
 *
 * The four routes, and the question each answers:
 *
 *  - **`run`** — a catalogue command RESOLVES it. `command` is the entry's name
 *    in `src/ui/public/lib/palette-defs.js`; `values` is what it is rebuilt
 *    with. Declared only where the finding's own MESSAGE names that command:
 *    the message is the specification and this field is its machine-readable
 *    half, never a second opinion about it.
 *  - **`copy`** — a line the catalogue declares NO entry for. There is nothing
 *    for the server to rebuild, so it is copied and never run. `audit --files`
 *    is the only one, and naming a nearby id instead would put a different
 *    command behind a confirm that looked right.
 *  - **`acknowledge`** — `mycontext ack <item> <code>`: a PERSON reads the
 *    finding and rules on it (owner ruling 2026-08-27, argued in
 *    `core/acknowledge.ts`). This is the route for every message whose own
 *    words say the answer is a judgement or a hand edit — *"which of the two
 *    moves is the owner's call"*, *"only a person can tell the two apart"*,
 *    *"Re-scope it to the path that replaced it"*. It carries no id and no code
 *    of its own: the finding already has both, and a copy here could disagree
 *    with the finding it is attached to.
 *  - **`none`** — no control, because there is nothing honest to offer: the
 *    finding names no item, so nobody can rule on it either. `why` picks which
 *    sentence says so — `person` for something a person fixes OUTSIDE
 *    my_context (a PATH, a `.gitignore`, `config.json`), `nothing` for a
 *    finding that explicitly asks for no action at all.
 */
export type Remedy =
  | { route: 'run'; command: string; values: RemedyValues }
  | { route: 'copy'; argv: string[] }
  | { route: 'acknowledge' }
  | { route: 'none'; why: 'person' | 'nothing' };

/** `mycontext ack <id> <code>` — a person rules; nothing runs on their behalf. */
const ACK: Remedy = { route: 'acknowledge' };

/**
 * A person settles it, outside my_context, and the finding names no item — so
 * there is not even an acknowledgement to anchor. A PATH entry, a `.gitignore`
 * line, a key in `config.json`, a doctor check that threw.
 */
const PERSON: Remedy = { route: 'none', why: 'person' };

/** The finding asks for no action: it is a disclosure, not a defect. */
const NOTHING: Remedy = { route: 'none', why: 'nothing' };

/** `mycontext rebuild` — `index_stale`'s own last sentence. */
const REBUILD: Remedy = { route: 'run', command: 'rebuild', values: {} };

/** `mycontext decay` — named by `corpus_size_fallback_ceiling` as "the lever". */
const DECAY: Remedy = { route: 'run', command: 'decay', values: {} };

/**
 * `mycontext repair --yes` — `checksum_basis_migration`'s own recommendation
 * ("Run `mycontext repair` to re-stamp it in the current format"), plus the
 * `--yes` every boundary command composed for this UI carries: it is SHOWN in
 * the line a reader reads, never implied, and without it a command run as a
 * child process with no terminal refuses for want of a confirmation it has no
 * way to ask for.
 */
const REPAIR: Remedy = { route: 'run', command: 'repair', values: { yes: true } };

/**
 * `mycontext audit --files`, and it names NO catalogue id DELIBERATELY.
 * `PALETTE` carries no `audit` entry, so there is nothing for the server to
 * rebuild; the control draws Copy alone, and that is the correct outcome rather
 * than a gap to work around.
 */
const AUDIT_FILES: Remedy = { route: 'copy', argv: ['mycontext', 'audit', '--files'] };

/**
 * `mycontext refresh <id> --yes` — `source_drift`'s own recommendation.
 *
 * **`yes: true`, and without it this command cannot run at all.** Owner-reported
 * twice on 2026-08-28 from the Doctor screen: `refresh` REPLACES an item's whole
 * body, so it gates on a human by reading stdin; a command run from this UI is a
 * child with no terminal, so it computed the change, printed it, and refused —
 * and the dry run behind the confirm refused first, so the confirm never
 * rendered either. The button was dead in both directions. This does not imply
 * the confirmation, it MOVES it: the flag is in the composed argv, so it appears
 * in the line the reader reads and in the confirm's own copy of it.
 */
const refreshRemedy = (id: string): Remedy => (
  { route: 'run', command: 'refresh', values: { id, yes: true } }
);

/**
 * `mycontext edit <id> --extra state=todo --yes` — `blocked_needs_met`'s own
 * recommendation, verbatim but for the `--yes` that every boundary command
 * composed for this UI carries (see `refreshRemedy`).
 *
 * The message asks the reader to "confirm the ground is finished ground and
 * then" run it. The confirm dialog IS that confirmation — it shows, field by
 * field, what the edit changes before anything is written — so the control does
 * not skip the step the sentence asks for; it is where that step happens.
 */
const stateTodoRemedy = (id: string): Remedy => (
  { route: 'run', command: 'edit', values: { id, extra: 'state=todo', yes: true } }
);

/**
 * The reusable remedies, by name, for the one caller outside this file that
 * builds a `Finding` of its own: `cmdDoctor` synthesises a `cli_lookup_failed`
 * when `checkCliOnPath` itself throws, and it must declare the same remedy the
 * check declares rather than a second opinion about the same code.
 */
export const REMEDY = { ACK, PERSON, NOTHING, REBUILD, DECAY, REPAIR, AUDIT_FILES } as const;


/**
 * Directories `listRepoFiles` never descends into, for its general "fast,
 * bounded scan of the repository" purpose. `checkDeadScopes` deliberately
 * does NOT use this list (see `SCOPE_SKIP_DIRS` below) — a scope glob is
 * allowed to target generated output (`dist/`, `coverage/`, ...) or the
 * workspace itself (`.my_context/`), and skipping those directories here
 * previously made `checkDeadScopes` report a live scope as dead.
 */
const SKIP_DIRS = new Set([
  '.git', '.my_context', '.my-context', 'node_modules', 'dist', 'build', 'out',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
]);

/**
 * Directories `checkDeadScopes` never descends into. Deliberately much
 * smaller than `SKIP_DIRS`: `.git` internals can never be a meaningful scope
 * target and are large, so they stay excluded; `node_modules` is vendor
 * code no first-party constraint should realistically scope into, and can be
 * enormous, so it stays excluded too. Every directory a real constraint might
 * legitimately scope into — `.my_context/` itself, `dist/`, `build/`,
 * `coverage/`, `.next/`, and so on — is walked.
 */
const SCOPE_SKIP_DIRS = new Set(['.git', 'node_modules']);

const FILE_LIMIT = 20_000;

function walkFiles(repoRoot: string, limit: number, skipDirs: ReadonlySet<string>): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));
    }
  };

  walk(repoRoot);
  return out;
}

/** Repo-relative POSIX paths of every tracked-looking file, bounded so doctor stays fast. */
export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  return walkFiles(repoRoot, limit, SKIP_DIRS);
}

/**
 * Same walk as `listRepoFiles`, but for `checkDeadScopes` specifically: it
 * must see everything a scope glob could legitimately name, including
 * `.my_context/` and build output, so it uses the much smaller
 * `SCOPE_SKIP_DIRS` instead of `SKIP_DIRS`.
 */
function listFilesForScopeCheck(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  return walkFiles(repoRoot, limit, SCOPE_SKIP_DIRS);
}

function newestMarkdownMtime(dir: string): number {
  let newest = 0;
  const walk = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      try {
        newest = Math.max(newest, statSync(full).mtimeMs);
      } catch {
        // A file deleted mid-walk is not a doctor finding.
      }
    }
  };
  walk(dir);
  return newest;
}

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
  switch (scopePolicyFor(config, type)) {
    case 'required':
      return ' Deleting it is not an option here: categories.' + type +
        '.scopePolicy is "required", so an item must keep at least one glob.';
    case 'inert':
      return ' Deleting it would not widen the item: categories.' + type +
        '.scopePolicy is "inert", so an item with no globs is injected on no file at all.';
    default:
      return ' Deleting the glob is only right if the item should apply everywhere: scope ' +
        'restricts, so an item left with no globs at all is unrestricted and injects on every file.';
  }
}

export function checkDeadScopes(repoRoot: string, items: Item[], config: Config): Finding[] {
  const scoped = items.filter((i) => i.status === 'active' && i.scope.length > 0);
  if (scoped.length === 0) return [];

  const files = listFilesForScopeCheck(repoRoot);
  const findings: Finding[] = [];

  for (const item of scoped) {
    for (const glob of item.scope) {
      if (files.some((f) => matchesAnyGlob(f, [glob]))) continue;
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
  return findings;
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
 * resolved config, and carries it on `skippedKeys` (`config.ts` ·
 * `  skippedKeys: string[];` · ~529). That field's own docblock states the
 * consequence as a duty rather than a convenience: *"a surface that shows
 * config to a human and does not print this notice has re-created the silent
 * drop this field exists to end."* Until this check existed, the only caller
 * of `skippedKeyNotice` (`config.ts` ·
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
 * The audited field name a record written BEFORE the widening used for the
 * whole `extra` bag.
 *
 * `state` is an EXTRA field (`categories.ts`: `task.state`, `store: 'field'`),
 * and `movedFields` (core/persist.ts) used to compare `AUDITED_FIELDS` with
 * `extra` as one entry covering the whole bag. So a record that moved `state`
 * said `extra`, and so did a record that moved `priority`, `progress`,
 * `last_change` or `needs` — which is why this check could only ever be a
 * floor on the bypass and never a count of it.
 *
 * `movedFields` now reports per key (`STATE_AUDITED_FIELD` below), so this
 * spelling identifies exactly one thing: a record old enough that its `extra`
 * says nothing about which key moved. Such a record is treated as UNMEASURED
 * for `state` and credits the item, because reading it as evidence in either
 * direction would be inventing a measurement nobody took
 * (`STD-a-measured-zero-is-drawn-and-named`).
 */
const EXTRA_AUDITED_FIELD = 'extra';

/**
 * What a record naming this item's `state` says since `movedFields`
 * (core/persist.ts) began reporting `extra` per key. A record carrying it
 * moved `state` and nothing else can have; a record not carrying it did not.
 */
const STATE_AUDITED_FIELD = `${EXTRA_AUDITED_FIELD}.${STATE_FIELD}`;

/**
 * **A task that says it is finished, over a log that never recorded anybody
 * finishing it.**
 *
 * Owner ruling, verbatim: *"i never allow to do that only using create and
 * edit that updates properties, generates summary and calculates checksum."*
 * A `state` typed straight into an item's Markdown skips all three of those
 * acts. Measured on this corpus 2026-09-03: 28 tasks carry `state: done` with
 * no recorded write that could have set it.
 *
 * **This check exists because the file STOPS betraying the bypass, which is
 * not the same as never having betrayed it.** The earlier wording here — that
 * a hand-edited item "checksums correctly" and passes every file-level check
 * "by construction, and always would" — was measured and is false at the
 * moment of the edit, and the correction is the mechanism this whole check
 * depends on:
 *
 *  1. **At the hand edit, the file DOES betray it, loudly.**
 *     `computeItemChecksum` (core/item.ts) hashes `extra`, and `state` lives
 *     in `extra`, so a hand-edited item's recorded checksum is stale the
 *     instant the edit lands. `loadLayer` (core/rebuild.ts) raises that as a
 *     corpus LOAD ERROR naming the file, `doctor` exits 1, and the message
 *     says in as many words that "an edit outside my_context is one cause".
 *     Every one of the bypasses on this corpus was catchable at the moment it
 *     happened.
 *  2. **The next ordinary write erases it.** `writeItem` recomputes the
 *     checksum unconditionally on every write path, so the next `mycontext
 *     edit` on that item — for any reason at all, on any field — silently
 *     re-hashes the hand-edited value. `mycontext repair` does the same
 *     deliberately. From that moment the two items ARE indistinguishable on
 *     disk: identical frontmatter shape, a correct `summary` and
 *     `summary_of`, a correct `checksum`, `state:done` correctly projected
 *     into `tags`, and `doctor` green on both.
 *  3. **So the log is the only witness that survives**, and on this corpus
 *     every flagged item had a later product write and every one now
 *     checksums cleanly. The evidence eroded while it was being counted: the
 *     count drifted 28 → 25 → 24 as ordinary edits credited items out of the
 *     check.
 *
 * `persist` (core/persist.ts) now takes the measurement in (1) at write time
 * and records it in the mutation record that would have erased it, so a
 * divergence is a fact this check can READ rather than one it has to infer
 * from an absence — see `AuditRecord.diverged` and `AuditRecord.checksumAfter`.
 *
 * **`done` alone, and that is a scope decision rather than an oversight.**
 * `todo` is the value a task is CREATED in — 95 of them here — so "no record
 * ever set this to todo" reports the default on a hundred items and teaches a
 * reader to skim the code. `doing` and `blocked` are transient: the next real
 * move corrects them, and a stale one costs a glance. `done` is terminal. It
 * is the value that removes a task from `mycontext ready`, satisfies every
 * `needs` pointing at it (core/needs.ts) and closes the work; it is the one
 * whose truth another person's plan depends on, and it is the value the
 * owner's ruling was made about. Widening this to every tracked field would
 * fire on `title` for every item that was never retitled, which is a check
 * that fires on everything and therefore says nothing.
 *
 * **What it CANNOT determine, said here and said again in the finding**
 * (RULE-say-what-your-check-cannot-see-when-you-report-it-green):
 *
 *  - **Create-time values are invisible.** A `create` record carries no
 *    `fields` — on a create everything moved, so naming fields would name all
 *    of them — so a task captured with `--extra state=done` already set looks
 *    exactly like one hand-edited to `done` later. The two are
 *    indistinguishable from the log, and several of the findings on this
 *    corpus are honestly the first. That is why the message does not ACCUSE:
 *    it states the two readings and hands the choice to the person who knows.
 *  - **Records written before `fields` reported `extra` per key say only
 *    `extra`** (see `EXTRA_AUDITED_FIELD`). Over that stretch of the log a
 *    task whose `priority` was edited through the product and whose `state`
 *    was written by hand is still CREDITED here, and over that stretch this
 *    check is a floor on the bypass rather than a count of it. Records
 *    written from now on say `extra.state` or they do not, so for them the
 *    question has an answer. The finding says which of the two it is looking
 *    at, because a silence from this check would otherwise be read as an
 *    assurance it has no way to give. A coarse credit is defeated by positive
 *    divergence evidence — see below.
 *  - **Divergence, when the log holds it, is REPORTED rather than inferred.**
 *    Two independent measurements reach this check, and either one is enough:
 *    a `diverged` on some mutation record for the item (the file had moved
 *    under the product at the instant of that write), and a `checksumAfter`
 *    on the newest such record that disagrees with the item's checksum today
 *    (the file has moved since, and that comparison is made against the LOG
 *    rather than against a number stored inside the very file being checked,
 *    so the file cannot lie about its own history). Neither says WHICH field
 *    moved, and the finding does not pretend otherwise.
 *
 * **THE CUTOFF: an item born before the witness is UNMEASURABLE, and is
 * counted rather than accused.** This is the rule at the top of this file
 * applied to the one check that broke it, and it is the change of 2026-09-03.
 *
 * The predicate is exact: **the item's own `create` record carries
 * `checksumAfter`** — that is, the item was born after `persist`'s write-time
 * witness shipped. `checksumAfter` is stamped by `persist` on every write that
 * touches an item file (core/persist.ts), so its presence on a record is the
 * signature of the witness and `audit.ts` already rules what its absence
 * means: *"on a record without `checksumAfter`, absence is UNMEASURED and must
 * never be read as 'no divergence'"*. An item born under the witness has been
 * watched for its whole life, so a hand edit anywhere in it leaves something:
 * the write that overwrote it RECORDED the divergence it found, a `repair`
 * that re-stamped it left a checksum the log disagrees with, and one still
 * standing is red under the checksum check today. An item born before it has a
 * stretch of life nobody measured, and a hand edit inside that stretch was
 * erased by the next ordinary write with nothing recorded anywhere. **No
 * command can retro-fit that evidence and there must not be one.**
 *
 * So the question this check asks has no answer on such an item, and asking a
 * person to RULE on it is asking them to guess. Measured on this repository on
 * 2026-09-03: the witness's first record is `2026-09-03T10:18:56Z`, the log
 * reaches back to 2026-08-17, and all 24 of the items this check was reporting
 * had zero witnessed writes — every one of them unanswerable, which is why the
 * count could only ever erode by accident.
 *
 * **Why the CREATE record and not "any record".** An item created before the
 * witness and written after it is still dark over the stretch between the two,
 * and a bypass inside that stretch is just as gone. Keying on the create
 * record is also the only spelling that cannot erode: a create record is
 * written once and never rewritten, so membership of the measurable set is
 * FIXED at birth. Keying on "any record carries a stamp" would have let an
 * ordinary unrelated edit move an item into the reported set, which is the
 * same accident-driven drift in the opposite direction.
 *
 * **The loud half is untouched, and it is deliberately checked FIRST.**
 * Positive divergence evidence — a recorded `diverged`, or a newest
 * `checksumAfter` the file disagrees with — is reported per item whatever the
 * item's birth, because it is a measurement and not an inference from silence.
 * A bypass from now on is caught by name.
 *
 * **Items the log never saw are named as unmeasured, not counted as clean**
 * (`STD-a-measured-zero-is-drawn-and-named`, clause 2). A task with no
 * `create` record anywhere in the log — an imported pack, a corpus copied
 * without `.audit/`, a segment archived by its owner — has a life this log
 * cannot describe, and reporting it would be accusing an item of a bypass
 * nothing here could check for. Those are skipped and COUNTED, and the count
 * is emitted as its own finding whenever it is non-zero. The pre-witness set
 * is the second population of exactly the same kind and is emitted the same
 * way, as its own line under the same `state_audit_coverage` code: two facts,
 * two sentences, two remedies, and never a row per item.
 *
 * The zero case stays silent, which is doctor's own convention rather than a
 * departure from that standard: `checkCitationForm`, `checkAuditSize` and
 * `emitAcknowledged` all refuse to draw a line nobody can ever clear, and
 * doctor prints no per-check green for a reader to misread. The blind spots
 * above therefore travel in the per-item message, where they are read on
 * every run in which this check speaks at all.
 *
 * **It reads the whole log, and that is affordable HERE and nowhere else.**
 * `readAudit`'s own docblock draws the line — it is the read surface, not the
 * hot path, and nothing on the hook path calls it. Measured 2026-09-03 over
 * this repository's log: 11,296 records, 5.7 MiB, one un-rotated segment,
 * 39 ms. `doctor` already walks the repository twice and stats every source a
 * `reference` names; one pass over the log beside that is not the cost that
 * matters, and no cheaper answer exists — the question is about the ABSENCE of
 * a record, which cannot be answered from a bounded tail.
 *
 * **`info`, deliberately, and `citation_form` is the precedent.** The original
 * reason was volume — 28 findings existed the moment this shipped, and a check
 * that turns a corpus amber on arrival for historical reasons is a check
 * people switch off. The cutoff above retires that reason: zero per-item
 * findings remain on this corpus. The level does not change with it, on the
 * standing reason rather than the retired one — what is reported is a question
 * about PROVENANCE that a person answers once per item, not a fault in the
 * product's own state, and doctor's exit code is reserved for the second.
 * `acknowledge` remains its remedy for the same reason and only now honestly:
 * every finding still emitted asks a question whose evidence is in the log the
 * reader can go and read, so the ruling it asks for is one they can actually
 * make.
 */
export function checkStateUnaudited(root: string, items: Item[], config: Config): Finding[] {
  const closed = workItems(items, config).filter((i) => taskState(i) === DONE_STATE);
  if (closed.length === 0) return [];

  let records: AuditRecord[];
  try {
    records = readAudit(root);
  } catch (err) {
    // `readAudit` REFUSES a log with a damaged line rather than skipping it,
    // and that refusal must not become a `check_failed` error: doctor would go
    // red, and the red would say a doctor check crashed when what actually
    // happened is that this workspace's log cannot be read. Reported as the
    // maximal case of the thing this check reports anyway — it could not look.
    return [{
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      remedy: PERSON,
      message:
        `${closed.length} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and none of them has ` +
        `been checked against the audit log, because the log could not be read: ` +
        `${err instanceof Error ? err.message : String(err)} That is an UNMEASURED set and not ` +
        `a clean one. Nothing about the items is being asserted here in either direction; the ` +
        `file named in that refusal is what a person has to look at first.`,
    }];
  }

  // Six facts per item and nothing else: was its creation recorded here at
  // all; was that creation WITNESSED (its record carries `checksumAfter`, the
  // signature of `persist`'s write-time guard — see the cutoff in the
  // docblock); did any recorded write name `state` itself; did any record name
  // the whole `extra` bag coarsely (a write from before the widening, which is
  // unmeasured for `state` rather than evidence about it); did any write
  // OBSERVE the file diverging under it; and what did the last recorded write
  // stamp on it.
  const created = new Set<string>();
  const bornWitnessed = new Set<string>();
  const laterWrites = new Map<string, number>();
  const movedState = new Set<string>();
  const movedExtraCoarsely = new Set<string>();
  const observedDivergence = new Map<string, string>();
  const stamped = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'mutation') continue;
    const id = record.itemId;
    if (typeof id !== 'string' || id === '') continue;
    if (record.op === 'create') {
      created.add(id);
      // The cutoff, read off the record rather than off a date: a `create`
      // carrying the guard's stamp is an item born under the witness, and
      // every write of its life since has been measured.
      if (typeof record.checksumAfter === 'string' && record.checksumAfter !== '') {
        bornWitnessed.add(id);
      }
    } else laterWrites.set(id, (laterWrites.get(id) ?? 0) + 1);
    if (Array.isArray(record.fields)) {
      if (record.fields.includes(STATE_AUDITED_FIELD)) movedState.add(id);
      if (record.fields.includes(EXTRA_AUDITED_FIELD)) movedExtraCoarsely.add(id);
    }
    // Records arrive oldest-first across every segment, so a plain overwrite
    // leaves the NEWEST of each — which is what both divergence questions are
    // about.
    if (record.diverged !== undefined) observedDivergence.set(id, record.at);
    if (typeof record.checksumAfter === 'string' && record.checksumAfter !== '') {
      stamped.set(id, record.checksumAfter);
    }
  }

  const findings: Finding[] = [];
  let unseen = 0;
  let unwitnessed = 0;
  for (const item of closed) {
    if (!created.has(item.id)) { unseen++; continue; }
    // A record that named `state` itself settles the question: a recorded
    // write moved it, and this check has nothing to ask.
    if (movedState.has(item.id)) continue;

    // The two divergence measurements, either of which is a POSITIVE fact
    // rather than an inference from silence. See the docblock.
    const observedAt = observedDivergence.get(item.id);
    const lastStamp = stamped.get(item.id);
    const stampDisagrees = lastStamp !== undefined && item.checksum !== ''
      && lastStamp !== item.checksum;
    const divergence = observedAt !== undefined
      ? `The log RECORDS this item's file being changed outside my_context: the write at ` +
        `${observedAt} found the file's own recorded checksum disagreeing with its own ` +
        `content, which is what a hand edit leaves and what the write after it erases. `
      : stampDisagrees
        ? `The log RECORDS a divergence: the last write it holds for this item stamped ` +
          `\`${lastStamp}\`, and the file now carries \`${item.checksum}\`, so the file has ` +
          `been written since by something this log never saw — a hand edit, or a ` +
          `\`mycontext repair\` re-stamp of one. That comparison is made against the LOG and ` +
          `not against a number stored inside the file being checked, so the file cannot ` +
          `answer it for itself. `
        : '';

    // A record that named the whole bag coarsely predates the widening and is
    // UNMEASURED for `state` — it credits the item rather than accusing it,
    // exactly as this check always did. Positive divergence evidence defeats
    // that credit: an old coarse record cannot excuse a file the log actually
    // saw move.
    if (divergence === '' && movedExtraCoarsely.has(item.id)) continue;

    // THE CUTOFF. With no positive evidence left, all this check has is the
    // ABSENCE of a record — and an absence is only evidence where something
    // was watching. An item born before `persist`'s witness has a stretch of
    // life nobody measured; a hand edit inside it was erased by the next
    // ordinary write with nothing recorded, and no command can retro-fit that.
    // A person asked to rule on it would be guessing, so it is COUNTED as
    // unmeasurable and reported once, below, rather than as a row of its own.
    // See the docblock, and the rule at the top of this file.
    if (divergence === '' && !bornWitnessed.has(item.id)) { unwitnessed++; continue; }

    const later = laterWrites.get(item.id) ?? 0;
    findings.push({
      level: 'info', code: 'state_unaudited', item: item.id,
      remedy: ACK,
      message:
        `\`${STATE_FIELD}: ${DONE_STATE}\` closes this task, and no write recorded in the audit ` +
        `log ever moved it there. The log holds this item's \`create\` record and ` +
        `${later} later write(s), and not one of them named \`${STATE_AUDITED_FIELD}\` among ` +
        `the fields it moved. ${divergence}` +
        (divergence === ''
          ? `Two readings fit that evidence and this check cannot choose between them: the ` +
            `task was CREATED already done, which is invisible from here because a \`create\` ` +
            `record lists no fields at all; or \`${STATE_FIELD}\` was written into the Markdown ` +
            `by hand, outside \`mycontext edit\` — the path that updates the properties, ` +
            `regenerates the summary and re-stamps the checksum. `
          : `That does not by itself say WHICH field moved, so it is evidence of a bypass on ` +
            `this item and not proof that \`${STATE_FIELD}\` was the field bypassed. `) +
        `What the FILE can tell you is bounded, and it is bounded in a way worth knowing: a ` +
        `hand edit DOES show up at the moment it lands, because the recorded checksum covers ` +
        `\`extra\` and \`doctor\` goes red naming the file — and then the very next write ` +
        `through the product re-stamps it, after which the hand-set state projects into ` +
        `\`tags\`, checksums correctly, and passes every other check in this report. The log ` +
        `is what survives that, so which reading is right is yours to say and nobody else's — ` +
        `\`mycontext ack ${item.id} state_unaudited\` records the ruling. What this check ` +
        `cannot see, said here so its silence elsewhere is not read as an assurance: a ` +
        `mutation record written before \`fields\` reported \`${EXTRA_AUDITED_FIELD}\` per key ` +
        `names the bag and never WHICH extra key moved, so over that stretch of the log a task ` +
        `whose \`priority\` or \`progress\` was edited through the product is credited by this ` +
        `check even if its \`${STATE_FIELD}\` never was. Over that stretch this is a ` +
        `floor on the bypass, never a count of it; over what follows it, \`${STATE_AUDITED_FIELD}\` ` +
        `is named or it is not.`,
    });
  }

  if (unseen > 0) {
    findings.push({
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      remedy: AUDIT_FILES,
      message:
        `${unseen} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and have no \`create\` record ` +
        `anywhere in the audit log, so \`state_unaudited\` has NOT looked at them — an ` +
        `unmeasured set, which is a different fact from a clean one and is reported as itself. ` +
        `The log describes the stretch of history it holds and no more: an item restored from ` +
        `a pack, copied in without \`.audit/\`, or older than the oldest segment still present ` +
        `leaves no trace of its own capture, and an item whose life this log never saw must not ` +
        `be accused of a bypass nothing here can check for. \`mycontext audit --files\` names ` +
        `the segments that do survive, and how far back they reach.`,
    });
  }

  if (unwitnessed > 0) {
    findings.push({
      level: 'info', code: 'state_audit_coverage',
      about: 'state_unaudited',
      // NOTHING, and it is the whole point of this line. There is no command,
      // and there is no ruling to ask for either: `acknowledge` on a question
      // whose evidence was never recorded asks a person to certify a guess.
      // The set shrinks on its own as items created under the witness replace
      // the ones created before it — which is repair by turnover, not by
      // accident, because nothing an unrelated edit does can move an item into
      // or out of it.
      remedy: NOTHING,
      message:
        `${unwitnessed} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and were CREATED before ` +
        `this workspace began recording what each write found on disk, so \`state_unaudited\` ` +
        `cannot measure them and does not report them one by one. That is an UNMEASURED set ` +
        `and not a clean one: nothing is being asserted about these items in either direction. ` +
        `The reason it is stated once here rather than as ${unwitnessed} finding(s) is that ` +
        `there is no answer to give — a write that bypassed the product before the guard ` +
        `existed was erased by the next ordinary write, the evidence is not recoverable, and ` +
        `no command can retro-fit it. Nothing is owed on this line and this set can only ` +
        `shrink: every task created from now on is watched for its whole life, and a bypass on ` +
        `one is reported against that item by name.`,
    });
  }
  return findings;
}

/** `task.verified_on`. Its whole existence is `checkTaskUnverified` below. */
const VERIFIED_ON_FIELD = 'verified_on';

/**
 * **The instant `task.verified_on` became a legal field.**
 *
 * Owner ruling, 2026-09-03: *"`task.verified_on` WITH its doctor check ...
 * Shipping a field without its consumer repeats that."* This constant is the
 * half of the check that makes the consumer honest about a field that
 * shipped onto a corpus already holding 406 tasks at `state: done` — every
 * one of them incapable of ever having carried `verified_on`, because the
 * write that could have set it had nothing to write it INTO until this
 * moment.
 *
 * **`checkStateUnaudited` faced the identical shape of problem and is the
 * model this check follows**: a fact unknowable for items that predate the
 * mechanism, solved with a cutoff plus one coverage disclosure rather than
 * 406 rows nobody can clear (`RULE` at the top of this file — a row only an
 * accident can clear is noise wearing work's clothes, and doctor was just
 * taken from 95 findings to zero).
 *
 * **Keyed on the recorded `done` TRANSITION, not on creation — reversed from
 * this check's first ship, by owner ruling, 2026-09-04.** The first version
 * grandfathered by the `create` record's date, and the owner named the
 * consequence and did not like it: the ~116 tasks that existed but were not
 * yet `done` would stay exempt FOREVER, because their `create` record
 * predates this field and a birth date cannot un-predate itself. He asked
 * whether `done` was even the right trigger and worried some would be
 * *"missed forever."* The ruling: key the check on the write that actually
 * closes the task, so a task open today and finished next month is judged by
 * WHEN it finishes, not by when it was opened.
 *
 * **His worry had a real basis, and the design has to answer it rather than
 * paper over it.** A task can reach `state: done` with no audit record ever
 * setting it — the hand-edit bypass `checkStateUnaudited` (immediately above)
 * already exists to catch, 27 of them measured on this corpus at the time of
 * that check's own writing. Keying purely on "the newest write that touched
 * `state`" would silently say nothing about exactly those items, which is
 * the opposite of the point. **The two checks PARTITION instead**, and nobody
 * has to trust that by assertion — it follows from a shared test: an item
 * this check finds no recorded `state`-transition for is, by the identical
 * predicate, the item `checkStateUnaudited` does not credit with a witnessed
 * `state` write either. It is that check's `state_unaudited` finding, or it
 * is inside one of that check's own coverage disclosures (`unwitnessed` or
 * `unseen`). Either way it already has an owner, and this check saying
 * nothing about it is not a gap — it is the other half of the same
 * partition. Measured on the live corpus, 2026-09-04: of 413 tasks at
 * `state: done`, precisely ZERO carry a recorded write that ever touched
 * `state` — every one of them is `state_unaudited`'s to account for, and
 * none is silently uncovered by both checks at once (see the report for the
 * query that established this).
 *
 * **The transition timestamp, read off the same log `checkStateUnaudited`
 * reads, by the same test.** A record's `fields` names `extra.state`
 * (`STATE_AUDITED_FIELD`, above) when a write moved it — never what it moved
 * it TO, because this log stores no copy of item content
 * (`AuditRecord.fields`'s own docblock). So "the log recorded this task's
 * done transition" cannot be verified more precisely than "the log recorded
 * A write to `state`, on an item now `done`" — the identical resolution
 * `checkStateUnaudited` already lives with for the same field, on the same
 * log. `create` records carry no `fields` at all (`auditMutation`,
 * persist.ts: "on a create everything moved, so naming fields would name all
 * of them"), so a task minted with `--extra state=done` already set leaves no
 * entry here — which is correct rather than a hole, because
 * `checkStateUnaudited` already reports that exact ambiguity everywhere it
 * can and grandfathers it everywhere it cannot, and this check must not draw
 * a second, disagreeing conclusion about the same fact from the same log.
 *
 * **Going `done` → `todo` → `done` again**: nothing here can see VALUES, only
 * that `state` moved, so this check takes the NEWEST recorded write to
 * `state` for the item — records arrive oldest-first across every segment
 * (`readAudit`'s own contract), so the map below is left holding the latest
 * one by construction. That is the best-available reading and the same one
 * `checkStateUnaudited`'s own `movedState` set makes: a task that cycles
 * `done → todo → done` entirely through the product is judged by its LAST
 * recorded touch, which is also the transition that actually left it
 * `done` today. A cycle where the FINAL hop back to `done` is a hand-edit
 * bypass with no record of its own is `checkStateUnaudited`'s question, not
 * this one's — this check would use the timestamp of the last-recorded
 * (earlier) product write, which is still an honest answer to "when did the
 * product last verifiably touch this field," and the reader is not left
 * unwarned: `checkStateUnaudited`'s own divergence machinery is what would
 * catch the bypass itself, on the same item, under its own code.
 *
 * Set with a five-hour margin ahead of every `TASK-*` `create` record
 * measured in this repository's own audit log on 2026-09-03 (the latest at
 * `10:43:33.824Z`) and behind the moment this check was written. Unchanged by
 * the 2026-09-04 ruling — the ruling moved WHAT is compared against this
 * instant, not the instant itself.
 */
export const VERIFIED_ON_INTRODUCED_AT = '2026-09-03T12:00:00.000Z';

/** `mycontext edit <id> --extra verified_on=<date>`, after checking the work. */
const VERIFIED_ON_EDIT_COMMAND = `mycontext edit <id> --extra ${VERIFIED_ON_FIELD}=<date>`;

/** `''` and whitespace-only both read as absent — `taskState`'s own convention. */
function taskVerifiedOn(item: Item): string {
  return (item.extra[VERIFIED_ON_FIELD] ?? '').trim();
}

/**
 * **`task.verified_on`'s only consumer.** A `done` task with nothing in
 * `verified_on` is reported — unless the log's newest recorded write to
 * `state` for it predates the field, in which case it is counted into a
 * single coverage disclosure and never named; and unless the log holds NO
 * recorded write to `state` for it at all, in which case it is
 * `checkStateUnaudited`'s population and not reported HERE either. See
 * `VERIFIED_ON_INTRODUCED_AT` for the cutoff and the argument for keying it
 * on the recorded transition, and for why the two checks partition rather
 * than overlap.
 *
 * Structured identically to `checkStateUnaudited` immediately above:
 * read-failure falls back to one `PERSON`-remedy disclosure.
 */
export function checkTaskUnverified(root: string, items: Item[], config: Config): Finding[] {
  const closed = workItems(items, config).filter((i) => taskState(i) === DONE_STATE);
  if (closed.length === 0) return [];

  let records: AuditRecord[];
  try {
    records = readAudit(root);
  } catch (err) {
    return [{
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      remedy: PERSON,
      message:
        `${closed.length} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and none of them has ` +
        `been checked for \`${VERIFIED_ON_FIELD}\` coverage, because the audit log could not be ` +
        `read: ${err instanceof Error ? err.message : String(err)} That is an UNMEASURED set ` +
        `and not a clean one. The file named in that refusal is what a person has to look at ` +
        `first.`,
    }];
  }

  // The recorded DONE TRANSITION per item: the newest record naming
  // `extra.state` among the fields it moved — exactly the test
  // `checkStateUnaudited`'s own `movedState` set uses to decide whether ANY
  // write touched `state` through the product (`STATE_AUDITED_FIELD`,
  // defined above this check's own docblock). Reusing that identical
  // predicate is what makes the two checks PARTITION rather than overlap or
  // double-count: an item this map has no entry for is, by the SAME test,
  // the item `checkStateUnaudited` does not credit with a witnessed `state`
  // write either — either it is one of that check's own `state_unaudited`
  // findings, or it is inside one of that check's own coverage disclosures.
  // Either way it already has an owner, and it is not this check's to name.
  //
  // A `create` record never carries `fields` (`auditMutation`, persist.ts —
  // "on a create everything moved, so naming fields would name all of
  // them"), so a task minted with `--extra state=done` already set leaves no
  // entry here either. That is deliberate rather than a gap:
  // `checkStateUnaudited` already reports that exact ambiguity ("the task
  // was CREATED already done ... or state was written by hand") everywhere
  // it can and grandfathers it everywhere it cannot, and this check must not
  // draw a second, disagreeing conclusion about the same fact from the same
  // log.
  //
  // Records arrive oldest-first across every segment (`readAudit`'s own
  // contract), so a plain overwrite of the map below leaves the NEWEST
  // matching record for each id — see the docblock on
  // `VERIFIED_ON_INTRODUCED_AT` for what a task that goes
  // `done` → `todo` → `done` does to this timestamp.
  const stateTransitionAt = new Map<string, string>();
  for (const record of records) {
    if (record.kind !== 'mutation') continue;
    const id = record.itemId;
    if (typeof id !== 'string' || id === '') continue;
    if (Array.isArray(record.fields) && record.fields.includes(STATE_AUDITED_FIELD)) {
      stateTransitionAt.set(id, record.at);
    }
  }

  const findings: Finding[] = [];
  let noTransition = 0;
  let grandfathered = 0;
  for (const item of closed) {
    if (taskVerifiedOn(item) !== '') continue;

    const transitionAt = stateTransitionAt.get(item.id);
    if (transitionAt === undefined) { noTransition++; continue; }
    if (transitionAt < VERIFIED_ON_INTRODUCED_AT) { grandfathered++; continue; }

    findings.push({
      level: 'warn', code: 'task_unverified', item: item.id,
      remedy: ACK,
      message:
        `\`${STATE_FIELD}: ${DONE_STATE}\` closes this task, and it carries no ` +
        `\`${VERIFIED_ON_FIELD}\`. The log records a write that moved \`${STATE_AUDITED_FIELD}\` ` +
        `for this item at ${transitionAt}, after \`${VERIFIED_ON_FIELD}\` became a field \`task\` ` +
        `declares — so this task could have carried one from that moment and does not. Check the ` +
        `work \`${STATE_FIELD}: ${DONE_STATE}\` claims and, if it holds up, ` +
        `\`${VERIFIED_ON_EDIT_COMMAND}\` records that; \`mycontext ack ${item.id} task_unverified\` ` +
        `records a ruling that this task does not need one.`,
    });
  }

  if (noTransition > 0) {
    findings.push({
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      // NOTHING, deliberately: this check has no command to offer and no
      // ruling to ask for, because the population is not its own — see the
      // docblock. The question "was this task's `done` ever witnessed by the
      // product" is `checkStateUnaudited`'s, and its own findings and its own
      // coverage disclosures (`state_audit_coverage`) are where it is
      // actually answered.
      remedy: NOTHING,
      message:
        `${noTransition} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and no write recorded ` +
        `in the audit log ever moved \`${STATE_AUDITED_FIELD}\`, so \`task_unverified\` has no ` +
        `recorded transition to measure a cutoff against and does not report them one by one. ` +
        `That is \`state_unaudited\`'s population and not this check's: a task whose \`state\` was ` +
        `never witnessed moving through the product is either one of that check's own findings or ` +
        `named inside one of its own coverage disclosures, and this check must not draw a second, ` +
        `disagreeing conclusion from the same log. Nothing is owed on this line.`,
    });
  }

  if (grandfathered > 0) {
    findings.push({
      level: 'info', code: 'task_verification_coverage',
      about: 'task_unverified',
      // NOTHING: there is no command, and no ruling to ask for either — the
      // newest write this log ever recorded moving this item's `state`
      // predates `verified_on`, so the person who made that write had no
      // field to set. The set can only shrink, by turnover, as these tasks
      // are superseded, replaced, or eventually re-closed by a write the
      // field already exists for.
      remedy: NOTHING,
      message:
        `${grandfathered} task(s) carry \`${STATE_FIELD}: ${DONE_STATE}\` and the newest write ` +
        `this log records moving \`${STATE_AUDITED_FIELD}\` for each of them predates ` +
        `\`${VERIFIED_ON_FIELD}\`, so \`task_unverified\` does not report them one by one. That is ` +
        `not a clean set — nothing is asserted about these items in either direction — it is a ` +
        `set this check cannot fault: the field these items lack did not exist to be filled in at ` +
        `the moment each was last recorded moving. Nothing is owed on this line.`,
    });
  }
  return findings;
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
  const FIXTURE_DIRS = ['test', 'tests', 'fixtures', 'harness', '.scratch', '.demo-corpus'];
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
 * **The word every documented command begins with, checked against what this
 * machine's shell would actually do with it.**
 *
 * `package.json` names `mycontext` as this project's `bin`, and from that one
 * fact every README, the skill, and all 24 UI palette entries treat the word
 * as something a shell can run — 262 documented invocations of it, by the
 * count in `KNOWN-every-command-the-product-tells-a-user-to-run-begins-with-a`.
 * That was false on the owner's own machine for the whole life of this
 * project: the package was never linked, so `mycontext` resolved to nothing,
 * and nothing anywhere said so. It was found by a person typing one and
 * reading `command not found`. This check exists so the NEXT machine where
 * that is true hears it from `doctor`, not from a failed command.
 *
 * There are three answers, not two, and they are not the same finding:
 *
 *  - **Resolves to this workspace's own CLI.** Healthy — the word runs the
 *    code sitting in this checkout, exactly as every doc assumes. No finding,
 *    the same silence `checkDeadScopes` and `checkIndexFreshness` return on a
 *    clean corpus.
 *  - **Does not resolve at all.** Loud and self-evident — the same
 *    `command not found` the owner hit — so every documented command is
 *    wrong, but a person finds out on the first one they try. `warn`: nothing
 *    about the CORPUS is broken, and CI commonly runs this very command via
 *    `node src/cli/index.ts doctor` without ever linking `mycontext` onto
 *    PATH at all — making this `error` would fail a healthy corpus on an
 *    unrelated environment fact, the same reasoning `index_not_ignored` and
 *    `corpus_size_fallback_ceiling` are `warn` rather than `error` for.
 *  - **Resolves to something else** — a different checkout, a different
 *    version, or a stale link left over from one. `error`, and the one this
 *    check exists to catch: `src/ui/execute.ts`'s `CLI_ENTRY` comment names
 *    exactly this as "the case that matters — not this project at all", and
 *    it is SILENT. A person runs `mycontext review` believing it reads this
 *    corpus and it reads a different one, with nothing on screen to say so —
 *    the same shape of harm `tag_projection_drift` is `error` for: not a
 *    corpus defect, but a WRONG ANSWER given with no error attached. Reported
 *    as healthy, this would be worse than not having the check at all.
 *
 * A fourth outcome — **cannot tell** — is not a defect either, and must never
 * be silence or a crash (`runChecks`'s own `check_failed` catch-all exists
 * for exactly the failure mode of a check finding out the hard way). It fires
 * when the platform's own lookup tool can't be run at all, or when something
 * resolves on PATH but doctor cannot see through it to a target — `info`,
 * the same register `index_missing` uses for "this cannot be answered right
 * now", not for "something is wrong".
 *
 * **Why the platform's own lookup, not a hand-rolled `PATH` walk:** a
 * reimplementation can disagree with the shell asking the same question —
 * different rules for extensions, different rules for which directory wins a
 * tie — and a disagreement there is indistinguishable from a bug in this
 * check. `where` (Windows) and `which -a` (POSIX) are what `cmd.exe`,
 * PowerShell and a POSIX shell are themselves built on; this defers to them
 * rather than re-deriving their answer.
 *
 * **Resolving a shim to what it actually runs — the part that only exists on
 * Windows.** On POSIX, `mycontext` on PATH can be a real symlink straight to
 * `src/cli/index.ts`, and `realpathSync` alone resolves it. On Windows the
 * target is never the file itself: `npm link` writes a `.cmd` (and a `.ps1`,
 * and a POSIX-shaped shell script for Git Bash) that WRAPS `node` and a
 * relative path — verified by reading this machine's own linked shim, which
 * launches `node "%dp0%\node_modules\mycontext\src\cli\index.ts" %*`.
 * `realpathSync` cannot see through that text to the file it names, so this
 * reads the shim itself and pulls out the `node_modules/<pkg>/<path>`
 * segment every npm-generated shim embeds (the `.cmd`, `.ps1`, and POSIX
 * templates all carry it, in that literal shape, regardless of npm version),
 * resolves it relative to the shim's own directory, and `realpathSync`s the
 * result — which is also what collapses the `npm link` symlink at
 * `node_modules/mycontext` back to this checkout, the same symlink verified
 * by hand while building this check (`node_modules/mycontext -> …/my-context`).
 *
 * **What this cannot establish:** a candidate too large to be a text shim
 * (`SHIM_MAX_BYTES`, comfortably above every real npm-generated shim's
 * actual size) or one that has vanished between the platform lookup
 * reporting it and this check reading it is reported as "found, target
 * unverifiable", never guessed at as either healthy or a mismatch — this
 * check trades "some candidates are opaque to it" for "never asserts a fact
 * about a target it never actually looked at". A SMALL file with no
 * `node_modules/…` marker in it (an unrelated program small enough to read,
 * or a genuine POSIX symlink straight to a CLI file with no wrapper at all)
 * is instead compared BY PATH directly — its own resolved location either
 * matches this checkout's CLI or it does not, and either answer is a real
 * fact about a real file this check actually read, not a guess.
 */

/** The `bin` name `package.json` declares — see the module comment above. */
export const CLI_BIN_NAME = 'mycontext';

/**
 * This checkout's own CLI entry, resolved from THIS FILE rather than looked
 * up — the same non-negotiable `src/ui/execute.ts` states for its own
 * `CLI_ENTRY`: "Never a `mycontext` found on PATH: what is on PATH is
 * whatever the user last installed... Resolved from `import.meta.url` so it
 * moves with the file and cannot drift into a string somebody has to
 * remember to update." `checks.ts` lives one level deeper than `execute.ts`
 * does (`src/doctor/` vs `src/ui/`), and the relative path is identical
 * either way — both are one `..` below `src/`.
 */
const OWN_CLI_ENTRY = fileURLToPath(new URL('../cli/index.ts', import.meta.url));

/** Longest shim `readShimTarget` will read whole. Every shim actually seen —
 * npm's `.cmd`, `.ps1`, and POSIX templates — is a few hundred bytes; a
 * `mycontext` on PATH bigger than this is almost certainly a compiled binary,
 * not a text wrapper, and reading it in full would be pure waste. */
const SHIM_MAX_BYTES = 8_192;

/**
 * Resolves `candidate` (a path `defaultCliLookup` returned) as far toward its
 * real target as this check can establish, in two steps:
 *
 *  1. `realpathSync` — resolves ordinary symlinks, which is the whole answer
 *     on a POSIX box where `mycontext` links straight to the CLI file.
 *  2. If step 1 didn't land on something ending in the CLI's own basename,
 *     the result is read as TEXT and searched for an embedded
 *     `node_modules/<pkg>/<path>` segment — the shape every npm-generated
 *     shim (`.cmd`, `.ps1`, POSIX) carries, verified against this machine's
 *     own linked shim while this check was built. Found, it is resolved
 *     relative to the shim's own directory and `realpathSync`d in turn,
 *     which is also what collapses an `npm link` symlink sitting inside
 *     `node_modules`.
 *
 * Returns `null` when neither step lands on a readable target — a candidate
 * that IS on PATH but that this cannot see through, reported by the caller as
 * "found, but unverifiable" rather than guessed at either way.
 */
export function readShimTarget(
  candidate: string,
  readFile: (p: string, enc: 'utf8') => string = (p, enc) => readFileSync(p, enc),
  realpath: (p: string) => string = realpathSync,
): string | null {
  let real: string;
  try {
    real = realpath(candidate);
  } catch {
    real = candidate;
  }

  let size = 0;
  try {
    size = statSync(real).size;
  } catch {
    return null; // the candidate does not exist to be read — nothing to resolve
  }
  if (size > SHIM_MAX_BYTES) return null; // almost certainly a binary, not a text shim

  let text: string;
  try {
    text = readFile(real, 'utf8');
  } catch {
    return null;
  }

  const at = text.search(/node_modules[\\/]/);
  if (at === -1) return real; // not a wrapper shape — `real` itself is the answer

  const rest = text.slice(at);
  const stop = rest.search(/["'\r\n]/);
  const segment = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  if (!segment) return real;

  const parts = segment.split(/[\\/]/).filter(Boolean);
  const absolute = path.join(path.dirname(real), ...parts);
  try {
    return realpath(absolute);
  } catch {
    return absolute; // could not confirm it exists; still the best available answer
  }
}

/** What the platform's own lookup reports for `name`: every path on PATH a
 * shell could resolve it to, in the order the platform itself returns them.
 * Injected by `checkCliOnPath`'s caller in tests so no test has to touch the
 * real `PATH` environment variable to exercise this check. */
export type CliLookup = (name: string) => string[];

/**
 * The real lookup: `where` on Windows, `which -a` on POSIX — see the module
 * comment on why a platform tool rather than a hand-rolled `PATH` walk. A
 * nonzero exit with no output is a normal, DETERMINATE "not found" (both
 * tools do this) and is returned as `[]`, not thrown. Only `result.error` —
 * the lookup tool itself could not be started at all — is thrown, so the
 * caller can tell "asked and the answer is no" apart from "could not ask".
 */
export function defaultCliLookup(name: string): string[] {
  const result = process.platform === 'win32'
    ? spawnSync('where', [name], { encoding: 'utf8', windowsHide: true })
    : spawnSync('which', ['-a', name], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return (result.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Windows paths are case-insensitive and `realpathSync` does not normalize
 * drive-letter casing; POSIX paths are compared verbatim. This is a native
 * filesystem-path comparison, not a stored corpus path, so it deliberately
 * does not go through `relPosix` (INV-posix-normalized-paths governs paths
 * that cross into the database or a glob match — this crosses into neither). */
function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Walks up from `fromFile` looking for the nearest `package.json`, so the
 * "not on PATH" remedy can name the directory `npm link` should be run from
 * without assuming a fixed number of directories between the CLI entry and
 * the package root. Bounded the way every other walk in this file is; falls
 * back to `fromFile`'s own directory if none is found within the bound, which
 * only degrades the remedy's wording, never throws. */
function nearestPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(fromFile);
}

export function checkCliOnPath(
  ownCliEntry: string = OWN_CLI_ENTRY,
  lookup: CliLookup = defaultCliLookup,
): Finding[] {
  let candidates: string[];
  try {
    candidates = lookup(CLI_BIN_NAME);
  } catch (err) {
    return [{
      level: 'info', code: 'cli_lookup_failed',
      remedy: NOTHING,
      message:
        `could not determine whether \`${CLI_BIN_NAME}\` resolves on this machine's PATH: the ` +
        `platform lookup itself could not be run (${err instanceof Error ? err.message : String(err)}). ` +
        `This is a gap in what doctor could check, not a corpus problem — it means doctor cannot ` +
        `tell you whether the commands this project prints would actually run here.`,
    }];
  }

  if (candidates.length === 0) {
    const packageRoot = nearestPackageRoot(ownCliEntry);
    return [{
      level: 'warn', code: 'cli_not_on_path',
      remedy: PERSON,
      message:
        `\`${CLI_BIN_NAME}\` — the word every documented command in this project's READMEs and ` +
        `skill begins with, and what every UI palette entry composes — does not resolve on this ` +
        `machine's PATH. Exactly as typed, every one of those commands, and the UI's Copy button, ` +
        `would fail with "command not found". Run \`npm link\` from ${packageRoot} to provide it, ` +
        `or use \`node ${ownCliEntry} <args>\` until then — the fallback the README already documents.`,
    }];
  }

  const ownReal = (() => {
    try { return realpathSync(ownCliEntry); } catch { return ownCliEntry; }
  })();

  // Every candidate ends up in exactly one of three buckets: `matched` (its
  // target IS this checkout), `mismatch` (readable, and a DIFFERENT target —
  // the worst state, so its presence short-circuits below regardless of
  // what any other candidate said), or neither, which can only mean
  // `readShimTarget` returned `null` for every one of them — "found on
  // PATH, target unverifiable" is exactly that leftover case, not a third
  // flag tracked alongside these two.
  let matched = false;
  let mismatch: { candidate: string; target: string } | undefined;

  for (const candidate of candidates) {
    const target = readShimTarget(candidate);
    if (target === null) continue;
    if (samePath(target, ownReal)) matched = true;
    else mismatch ??= { candidate, target };
  }

  if (mismatch) {
    return [{
      level: 'error', code: 'cli_path_mismatch',
      remedy: PERSON,
      message:
        `\`${CLI_BIN_NAME}\` on this machine's PATH — "${mismatch.candidate}" — resolves to ` +
        `"${mismatch.target}", NOT this workspace's own CLI ("${ownReal}"). This is worse than ` +
        `not resolving at all: every documented command a person runs as \`${CLI_BIN_NAME} …\` ` +
        `silently drives a DIFFERENT checkout or version, with nothing on screen to say so. Run ` +
        `\`npm link\` from ${nearestPackageRoot(ownCliEntry)} to point it back at this checkout, ` +
        `after confirming what the other target is and that overwriting its link is intended.`,
    }];
  }

  if (matched) return [];

  return [{
    level: 'info', code: 'cli_path_unverifiable',
    remedy: NOTHING,
    message:
      `\`${CLI_BIN_NAME}\` resolves on PATH to ${candidates.map((c) => `"${c}"`).join(', ')}, but ` +
      `doctor could not read through ${candidates.length === 1 ? 'it' : 'any of them'} to the CLI ` +
      `script it actually runs — not shaped like an npm-generated shim, and not a symlink to a ` +
      `readable target. It may be this workspace's own CLI behind a wrapper doctor does not ` +
      `recognize, or a completely different program; this check cannot tell which.`,
  }];
}

/**
 * `checkCliOnPath` deliberately is NOT one of the checks below, even though
 * it returns the same `Finding[]` shape every other one does — see its own
 * doc comment for the three-state, "resolves to something else is the worst
 * outcome" reasoning; this comment is only about why it is wired in
 * DIFFERENTLY from its dozen siblings.
 *
 * Every check below answers a question about the FILES in `root`/`repoRoot`
 * — the same corpus on every machine that clones it. `checkCliOnPath`
 * answers a question about THIS MACHINE'S PATH, which two clones of the
 * identical corpus can answer differently. Folding it into `findings` would
 * make `counts.warnings` — and the "N finding(s)" this project's own test
 * suite and its generated documentation assert is exactly the printed count
 * — depend on whether the box asking happens to have `npm link`ed this
 * package. That is precisely the silent, environment-dependent divergence
 * this check exists to catch; making the check ITSELF introduce it into
 * every existing "this fixture is clean" assertion would defeat it before
 * it shipped.
 *
 * `mycontext doctor` (`src/cli/commands/doctor.ts`) calls `checkCliOnPath`
 * directly, the same way it already calls `openMutateContext` for corpus
 * LOAD errors — a second category of thing this command reports and folds
 * into its exit code without folding into `findings`/`counts`, for the same
 * reason: a load error is not a property of the item that failed to load
 * either, it is a property of whether the file could be read at all. Every
 * OTHER caller of `runChecks` — `status`, and the UI's health widget in
 * `read-model.ts` — therefore never runs this check and never could, for
 * the same reason they never see corpus load errors flow through `findings`
 * either — that is `doctor`'s own reporting surface, not `runChecks`'s.
 */
/**
 * A body's last non-blank line, ending in a way that reads as cut off.
 *
 * Measured on this repository's own corpus before it was written: 655 of 656
 * non-empty bodies end with a full stop and the 656th with a `*`. Ending
 * mid-sentence, or on a colon whose list is not there, is therefore not a
 * style this corpus has — which is what makes it worth reporting at all, and
 * also exactly how little it proves. See `checkBodyTruncation`.
 */
const UNFINISHED_TAIL = /(?::|[^.!?)\]"'*_|\u00bb\u201d\u2019\u2026])$/u;

/**
 * **Text an item's file holds that no future write will keep — and bodies that
 * read as though that already happened.**
 *
 * Two findings, and the difference between them is the whole point.
 *
 * `body_truncation` is EXACT. `droppedBodyText` (core/item.ts) partitions the
 * file the way `parseItem` does and reports what falls out: a `## ` section
 * that is not a field of an item, the earlier of two same-named sections, a
 * second `# ` line, a line inside `## Observations`/`## Relations` that the
 * section's grammar does not match. Every one of those is deleted, silently,
 * by the next command that writes the item — `renderItem` writes back what was
 * parsed, and what was parsed is missing them. Nothing reported this before,
 * which is how two task bodies in this corpus lost roughly two-thirds of
 * themselves (3,918 -> 1,272 bytes and 5,507 -> 1,535) in a commit that
 * hand-edited them and then ran `mycontext repair`. `repair` now refuses those
 * items (cli/commands/repair.ts); this is where they are reported before
 * anybody runs it.
 *
 * `body_ends_unfinished` is a HEURISTIC, and is `info` for that reason. Once a
 * truncation has been written back, the file is internally consistent and its
 * checksum agrees with the shortened content — the deleted text leaves no
 * trace whatsoever. The only residue is prose that stops in the middle, so
 * that is what this looks for, and the message says plainly that a truncation
 * which happened to land after a full stop is invisible to it. A check that
 * implied otherwise would be the same failure this whole pair exists to fix.
 *
 * PROJECT items only, exactly as `needsRestamp` (repair.ts) is: `item.filePath`
 * is relative to its own layer's root, and `root` here is the project's.
 *
 * COST, measured rather than assumed: this is the only check that reads every
 * item file, and it has to — the loss is a property of the FILE, and the
 * parsed item in memory is precisely the thing with the text already missing.
 * Reading this repository's own 661 item files takes 23-27ms, which `doctor`
 * and `status` can afford; a corpus large enough for that to matter is one
 * `checkCorpusSize` is already complaining about.
 */
/**
 * A `file.ts:123` pointer in an item body, with or without backticks around it
 * and with or without a `-129` / `,95` tail. The file part is captured so it
 * can be checked against the repository before anything is reported.
 */
const BARE_POINTER = /`?([A-Za-z0-9_.\-/@]+\.(?:ts|js|mjs|cjs|md|json|html|css)):\d+(?:[-,]\d+)*`?/g;

/**
 * **The `historical-citation` marker, which this project already ships and
 * `scripts/verify-citations.ts` already honours. Copied, not invented.**
 *
 * The spelling is NOT written out here, and that is the same refusal
 * `checkCitationForm`'s own message makes one screen down about the citation
 * form: a real marker written into this file would be read as one by the gate
 * that walks `src/`, and a marker that excuses nothing is a fault there — so a
 * specimen printed here would manufacture the defect it describes. The two
 * regexes below ARE the spelling, exactly; `scripts/verify-citations.ts` writes
 * it out properly in its own header, where it is exempt for this reason.
 *
 * Three items in this corpus hold sixteen bare pointers that must never be
 * converted, because the sentence they sit in is ABOUT the pointer: a stale
 * citation quoted so it can be named as stale, a measured count of what the
 * corpus contained, a doctor message reproduced verbatim. Converting one of
 * those to the fragment form does not repair a citation — it falsifies a
 * quotation. Left alone they fire `citation_form` forever, and a finding
 * nobody can ever clear is the shape `state_unaudited` was just narrowed to
 * stop producing: noise wearing work's clothes.
 *
 * **`acknowledge` is the wrong SHAPE here, not the wrong strength.** An `ack`
 * records only *a person read this*, and it anchors on the content hash — so
 * every future edit to the item lapses it and reopens sixteen findings the
 * next reader has to re-derive as fine. The claim actually being made is
 * different and durable: *this pointer is a quotation, not a citation.* That
 * is a claim about the text, so it belongs IN the text, on the line it governs.
 *
 * **The same marker, deliberately, and not a second spelling of it.** The
 * escape `verify-citations.ts` grants a plan is the escape this check grants an
 * item, word for word: one vocabulary, a claim a person signs with a stated
 * reason, scoped to the line it sits on and nothing wider. A reader who has
 * learned the marker in a plan does not learn it twice, and a second noun would
 * be a second thing to get subtly wrong. Its docblock argues the line scope out
 * in full and every word of it holds here: a section- or item-level fence grows
 * its blast radius in silence and can never go stale, where a line-scoped one
 * has to keep earning itself.
 *
 * **TWO regexes rather than one, and that is the point of them** — the same
 * two, for the same reason. `OPEN` finds anything that was TRYING to be a
 * marker; `FULL` decides whether it managed it. A single strict pattern would
 * let a marker whose keyword is pluralised, or whose reason is missing, or
 * whose close ran onto the next line, fall
 * through as "no marker here" — leaving the author staring at a pointer they
 * believe they excused and a check that never mentions the thing they wrote.
 * Without this half the mechanism decays into a blanket suppressor, which is
 * exactly what `SOURCE_EXEMPT` refuses to become over in the script.
 */
const MARKER_OPEN = /<!--[ \t]*historical-citation/g;
const MARKER_FULL = /^<!--[ \t]*historical-citation[ \t]*:[ \t]*(\S.*?)[ \t]*-->/;

/** One body line's markers: the reason it excuses by, and what it got wrong. */
interface MarkerRead {
  /** The reason of the ONE honoured marker on this line, or `null` if none. */
  reason: string | null;
  /** The line with every honoured marker removed, so rule 1 cannot be gamed. */
  stripped: string;
  /** Why each marker on this line is not doing the job markers exist to do. */
  faults: string[];
}

/**
 * Every attempt at the marker on one body line, sorted into the one this check
 * will honour and the ones it refuses to.
 *
 * A SECOND marker on a line is a fault rather than a redundancy — one marker
 * already covers the whole line, so a second can only mean its author thought
 * markers attach to individual pointers, and someone who believes that will
 * eventually leave one attached to nothing.
 *
 * A malformed marker is reported AND leaves the pointers on its line judged as
 * normal: a mangled marker fails twice rather than swallowing once.
 */
function readMarkers(line: string): MarkerRead {
  MARKER_OPEN.lastIndex = 0;
  let reason: string | null = null;
  let stripped = line;
  const faults: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MARKER_OPEN.exec(line)) !== null) {
    const full = MARKER_FULL.exec(line.slice(m.index));
    if (full === null) {
      // `MARKER_OPEN` has already advanced `lastIndex` past its own match, so
      // the loop makes progress without touching it here.
      faults.push(
        'malformed — an HTML comment opening on the `historical-citation` keyword, spelled ' +
        'exactly, then a colon, then a reason, then the comment closed on the same line',
      );
      continue;
    }
    MARKER_OPEN.lastIndex = m.index + full[0]!.length;
    if (reason === null) {
      reason = full[1]!;
      stripped = stripped.replace(full[0]!, '');
      continue;
    }
    faults.push('a second marker on one line — one marker already covers every pointer on the line');
  }
  return { reason, stripped, faults };
}

/**
 * **A line number is not a citation, and this is the only place that says so
 * where the writing happens.**
 *
 * `scripts/verify-citations.ts` resolves citations BY FRAGMENT — a verbatim
 * quotation of the cited text, which survives a refactor moving it and fails
 * loudly when the text is rewritten. Its docblock records why it will never
 * learn `file:line` instead: a bare line number carries no fragment, so the
 * check can only prove the line EXISTS. Measured over this corpus on
 * 2026-08-29 that proved the line existed for 161 of 165 pointers while
 * proving nothing about what any of them said.
 *
 * That is why the gate does not walk `.my_context/`: **it walks what it can
 * resolve by fragment**, and a tree whose citations carry no fragment is out of
 * scope until they do. Normalising the corpus once would not keep it — agents
 * and the owner write `file:line` constantly, and the count comes back. So the
 * form is stated in the corpus (a `standard`, which is injected and therefore
 * read before the writing) and counted here, which is where a claim that the
 * writing changed can be checked instead of believed.
 *
 * **`info`, deliberately.** A bare pointer is not a defect in the project; it
 * is a citation that cannot be checked. It costs nothing until someone follows
 * it, so it is a note that stays visible and countable until the corpus is
 * converted, rather than a warning that makes `doctor` look broken over
 * prose.
 *
 * **One finding per ITEM, not per pointer**, and the file part must name a
 * file this repository actually has. Both are for the same reason: the fault
 * being reported is "this item's citations are unresolvable", which is one
 * fact per item — and a pointer whose file does not exist here is far more
 * often an EXAMPLE of the form (`file.ts:123`, written to describe it) than a
 * citation of anything. Reporting the example as the fault it documents is how
 * a check earns itself a permanent finding nobody can clear.
 *
 * **AN ITEM MAY DECLARE A SPAN EXEMPT, and the count is drawn rather than
 * hidden.** See `MARKER_OPEN` above for the marker, why it is the one
 * `verify-citations.ts` already honours rather than a second spelling, and why
 * `acknowledge` is the wrong shape for the claim. Three rules keep it from
 * becoming a suppressor, and they are the script's three rules:
 *
 *   1. **It must excuse something.** A marker on a line carrying no bare
 *      pointer this check would have reported is itself a fault. It cannot be
 *      pre-armed against a pointer somebody might write later, and one left
 *      behind after the pointer is converted turns red rather than sitting
 *      there ready to hide the next one underneath itself. The line is read
 *      with the marker's own text REMOVED first, so a pointer written inside a
 *      reason cannot be the thing the marker claims to excuse.
 *   2. **It must be well formed.** Missing reason, missing colon, misspelled
 *      or unterminated is reported AND leaves the pointers on its line judged
 *      as normal — a mangled marker fails twice rather than swallowing once.
 *   3. **It excuses only what this check would otherwise REPORT** — a pointer
 *      whose file this repository has. A pointer naming no file here is already
 *      read as an example of the form and needs no excuse, so a marker cannot
 *      borrow one to satisfy rule 1.
 *
 * **The excused count is a DISCLOSURE and never a finding**, emitted once under
 * `citation_form_excused` with `remedy: none/nothing` and naming no item —
 * `state_audit_coverage`'s shape exactly. An excused span is not UNMEASURED:
 * it was measured and then RULED, in writing, by the person who wrote the
 * reason, so there is nothing left for a reader to do and nothing to
 * acknowledge. But it must still be counted where a person reads it, because
 * an exemption that leaves no trace is precisely the silent drop
 * `INV-nothing-is-dropped-silently` forbids, and a measured number is drawn
 * and named (`STD-a-measured-zero-is-drawn-and-named`). Zero excused spans
 * stay silent, which is doctor's own convention rather than a departure from
 * that standard — no per-check green is printed here for a reader to misread.
 *
 * **A marker fault IS a finding, at `warn`**, one row per item listing every
 * broken marker in it by body line. It is louder than the `info` it failed to
 * excuse on purpose: a marker that is not working is the only thing standing
 * between this exception and a blanket suppressor, and it is repairable by
 * hand in the body — which is exactly the question `ack` exists to let a person
 * answer if they disagree.
 */
export function checkCitationForm(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const known = new Set<string>();
  for (const rel of listRepoFiles(repoRoot)) {
    known.add(rel);
    known.add(rel.slice(rel.lastIndexOf('/') + 1));
  }
  let excusedSpans = 0;
  let excusedItems = 0;
  for (const item of items) {
    if (item.layer !== 'project') continue;
    const found: string[] = [];
    const markerFaults: string[] = [];
    let excusedHere = 0;
    // Line at a time, because one line is the marker's entire scope. Nothing
    // here joins or wraps: an item body is Markdown, and a pointer and the
    // marker that excuses it could always have been written on one line.
    const lines = item.body.split('\n');
    for (let n = 0; n < lines.length; n++) {
      const { reason, stripped, faults } = readMarkers(lines[n]!);
      for (const why of faults) markerFaults.push(`body line ${n + 1}: ${why}`);
      const here: string[] = [];
      BARE_POINTER.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BARE_POINTER.exec(reason === null ? lines[n]! : stripped)) !== null) {
        const cited = m[1]!;
        if (!known.has(cited) && !known.has(cited.slice(cited.lastIndexOf('/') + 1))) continue;
        here.push(m[0].replace(/`/g, ''));
      }
      if (reason === null) {
        found.push(...here);
        continue;
      }
      if (here.length === 0) {
        markerFaults.push(
          `body line ${n + 1}: excuses nothing — this line carries no bare pointer this check ` +
          'would have reported, so the marker is either pre-armed against one nobody has ' +
          'written, or left behind after the pointer it excused was converted',
        );
        continue;
      }
      excusedHere += here.length;
    }
    if (excusedHere > 0) {
      excusedSpans += excusedHere;
      excusedItems++;
    }
    if (markerFaults.length > 0) {
      findings.push({
        level: 'warn', code: 'citation_marker', item: item.id,
        remedy: ACK,
        message:
          `${markerFaults.length} \`historical-citation\` marker(s) in this body are not doing ` +
          `the job the marker exists to do — ${markerFaults.join('; ')}. The marker says a ` +
          `pointer on its line is a QUOTATION rather than a citation, so \`citation_form\` must ` +
          `not count it; a marker that is malformed, doubled, or excusing nothing is reported ` +
          `here rather than silently obeyed, because a marker obeyed without being read is a ` +
          `blanket suppressor with extra steps. The pointers on a malformed marker's line are ` +
          `judged as normal in the same run, so a mangled marker fails twice rather than ` +
          `swallowing once. Write it on the line the pointer sits on, with a reason that says ` +
          `why THIS pointer is a quotation, or delete it. (The spelling is not printed here for ` +
          `the reason \`citation_form\` does not print the citation form: a real marker in this ` +
          `string would be read as one where this message is written. ` +
          `\`scripts/verify-citations.ts\` writes it out properly in its header, and honours the ` +
          `identical marker under the identical rules in plans and specs.)`,
      });
    }
    if (found.length === 0) continue;
    const shown = found.slice(0, 3).join(', ');
    findings.push({
      level: 'info', code: 'citation_form', item: item.id,
      remedy: ACK,
      message:
        `${found.length} citation(s) point by line number and carry no fragment — ${shown}` +
        `${found.length > 3 ? ', …' : ''}. A line number proves only that the line exists; it ` +
        `cannot say whether the code it named is still there, and a plausible wrong number ` +
        `sends a reader somewhere real. Write the form \`verify:citations\` resolves instead: ` +
        `the cited file in backticks, then a middle dot, then a VERBATIM fragment of the cited ` +
        `text in backticks, then optionally a middle dot and a ~line hint. (It is not spelled ` +
        `out here: a real citation in this string would be read as one, and a mangled example ` +
        `is exactly what the gate exists to catch. \`scripts/verify-citations.ts\` opens with ` +
        `the form written properly.) The fragment is the identity and ` +
        `the ~line is a convenience allowed to be stale. Anchor on a KEY or an identifier, ` +
        `never on user-facing copy. Where the fragment itself contains backticks, use a ` +
        `double-backtick span, or the span ends early and the rest of the citation is read as ` +
        `prose. If the cited code is gone, say so — do not repoint to something plausible.`,
    });
  }
  // One line, whatever the number, naming no item and asking for nothing —
  // `state_audit_coverage`'s shape. This is not an unmeasured set: every span
  // counted here was measured and then RULED, in writing, on the line it sits
  // on. What the line exists to prevent is the other failure — an exemption
  // that leaves no trace, which is the silent drop the invariant forbids.
  if (excusedSpans > 0) {
    findings.push({
      level: 'info', code: 'citation_form_excused',
      // A note about `citation_form`'s own reach, not a row of work — so it
      // prints under its own heading and is not counted among the things a
      // reader has to do. See `Finding.about`.
      about: 'citation_form',
      remedy: NOTHING,
      message:
        `${excusedSpans} bare pointer(s) across ${excusedItems} item(s) are excused as SPECIMENS ` +
        `and are not counted above: each sits on a line carrying a \`historical-citation\` ` +
        `marker, which says the sentence is ABOUT the pointer — a ` +
        `stale citation quoted so it can be named as stale, a measured count of what the corpus ` +
        `held, a doctor message reproduced verbatim. Converting one of those to the fragment ` +
        `form would not repair a citation; it would falsify a quotation. Nothing is owed on this ` +
        `line: the ruling is already made, in writing, by the person who wrote the reason, and ` +
        `each marker governs one line and no more. It is drawn rather than left silent because ` +
        `an exemption that leaves no trace is the silent drop ` +
        `\`INV-nothing-is-dropped-silently\` forbids, and because a measured number is drawn and ` +
        `named. The reasons are in the item bodies beside the pointers they excuse; a marker ` +
        `that is malformed, doubled or excusing nothing is reported as \`citation_marker\` ` +
        `instead of being obeyed.`,
    });
  }
  return findings;
}

export function checkBodyTruncation(root: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.layer !== 'project') continue;

    let text: string | null = null;
    try {
      text = readFileSync(path.join(root, ...item.filePath.split('/')), 'utf8');
    } catch {
      // Unreadable is `loadLayer`'s report to make, not this check's.
      text = null;
    }
    const loss = text === null ? null : droppedBodyText(text);
    if (loss !== null) {
      findings.push({
        level: 'error', code: 'body_truncation', item: item.id,
        remedy: ACK,
        message:
          `${item.filePath} holds ${loss.lines} line(s) (${loss.bytes} bytes) that are not part ` +
          `of any field of an item, starting at ${JSON.stringify(loss.line)}. An item's body is ` +
          `the prose BEFORE its first "## " section, so the next command that writes this item — ` +
          `\`mycontext repair\`, or any \`mycontext edit\` — re-renders it WITHOUT that text and ` +
          `reports success, and nothing recovers it afterwards. Write the heading as bold ` +
          `("**Name**"), or move the content into "## Observations": both survive being read ` +
          `back. \`mycontext repair\` holds this item back until one of those is done.`,
      });
      // One finding per item: the exact report already names the first dropped
      // line, and adding a guess beside a measurement would only dilute it.
      continue;
    }

    const body = item.body.trim();
    if (body === '') continue;
    const lines = body.split('\n').filter((l) => l.trim() !== '');
    const last = lines[lines.length - 1]!.trimEnd();
    if (!UNFINISHED_TAIL.test(last)) continue;
    findings.push({
      level: 'info', code: 'body_ends_unfinished', item: item.id,
      remedy: ACK,
      message:
        `this item's body ends ${JSON.stringify(last.slice(-60))} — mid-sentence, or on a colon ` +
        `whose list is not there. That is what a body cut short at a "## " heading looks like ` +
        `once the cut has been written back to disk. It is a heuristic and nothing more: a ` +
        `performed truncation leaves no other trace (the file is self-consistent and its ` +
        `checksum agrees with the shortened text), and one that happened to land after a full ` +
        `stop leaves none at all. Compare the item against git history if the text reads ` +
        `unfinished; otherwise ignore this.`,
    });
  }
  return findings;
}

/**
 * List and blockquote scaffolding a line may open with before its first word.
 * Stripped so "does this line OPEN with a shouted clause" is asked of the
 * prose rather than of the Markdown wrapped around it.
 */
const LINE_SCAFFOLD = /^(?:[>\s*_•+-]|\d+[.)])+/;

/** The leading run of shouted words on a line, with the punctuation between them. */
const CAPS_RUN = /^[A-Z][A-Z'’]*(?:-[A-Z'’]+)*(?:[ ,;:.—'’-]+[A-Z][A-Z'’]*(?:-[A-Z'’]+)*)*/;

/**
 * Words that make a shouted clause conditional, hypothetical or negated, so
 * the clause is a PLAN rather than a verdict: "DONE WHEN:", "UNTIL THIS IS
 * FIXED", "THIS TASK IS NOT DONE AND MUST NOT BE CLOSED". These are English
 * function words, not this project's vocabulary — nothing derived exists for
 * them to fall out of step with.
 *
 * `NO` is deliberately absent. "THE QUESTION THIS TASK ASKED IS ANSWERED, AND
 * THE ANSWER IS NO" is a verdict, and hedging on `NO` would drop it.
 */
const HEDGES = new Set([
  'NOT', 'NOR', 'NEVER', 'UNTIL', 'UNLESS', 'WHEN', 'IF', 'WHETHER',
  'CANNOT', 'MUST', 'WOULD', 'SHOULD', 'RATHER', 'BEFORE', 'ONCE',
]);

/**
 * Closing verdicts that NO vocabulary in this project declares, so there is
 * nothing to derive them from — see the docblock on `checkBodyAgreement` for
 * why this list exists, what it is not, and why the check says so in its own
 * output rather than leaving its reach implied by silence.
 */
const CLOSING_VERDICTS = new Set([
  'RESOLVED', 'FIXED', 'CLOSED', 'ANSWERED', 'MOOT', 'WITHDRAWN',
  'OBSOLETE', 'CANCELLED', 'CANCELED', 'REVERTED', 'RETRACTED',
]);

/**
 * A body clause withdrawing something the item states. Two branches, and the
 * difference decides what else the clause must carry (see `retracts`):
 * `WITHDRAWN` announces itself, while "is wrong" / "was false" is the most
 * ordinary thing a body can say ABOUT ITS SUBJECT and means nothing on its own
 * — "the SNAPSHOT is stale" and "PACKS WAS WRONG" are the finding, not a
 * retraction of it.
 */
const RETRACTION_ANNOUNCED =
  /\bno longer (?:holds|true|the case|applies|stands)\b|\bwithdrawn by\b|\bretracted\b/i;
const RETRACTION_PREDICATE =
  /\b(?:is|was|are|were|has become|have become|turned out to be)\s+(?:now\s+|since\s+)?(?:wrong|false|stale|moot|obsolete)\b/i;

/** The same clause pointing at THIS item's own title, premise, claim or ruling. */
const SELF_REF =
  /\b(?:the|this|that|its)\s+(?:title|premise|claim|ruling)\b|\bthis\s+(?:task|item|rule|note|lesson|requirement|decision|standard)(?:'s|’s)?\b/i;

/**
 * `<count> <noun>` in a title, so the body can be asked for the same count.
 * The count may not be preceded by a digit or a dot: `v2.0 citations` and
 * `pass 2: 13 keys` are a VERSION and a SEQUENCE, and reading either as a
 * measurement produced two findings that said nothing.
 */
const TITLE_COUNT = /(?<![\dA-Za-z.-])(\d{1,5})\s+([A-Za-z][A-Za-z-]{3,})\b/g;

function leadClauses(line: string): string[][] {
  const m = CAPS_RUN.exec(line.replace(LINE_SCAFFOLD, ''));
  if (m === null || m[0].length < 3) return [];
  const out: string[][] = [];
  for (const clause of m[0].split(/[.;:]/)) {
    const words = clause.split(/[^A-Z'’-]+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;
    if (words.some((w) => HEDGES.has(w))) continue;
    out.push(words);
  }
  return out;
}

/** This item's value for `field`, whether it is a column or an extra. */
function fieldValue(item: Item, field: string): string | null {
  if (field === 'status') return item.status;
  if (field === 'severity') return item.severity;
  if (field === 'always') return String(item.always);
  if (field === 'continuity') return String(item.continuity);
  return Object.hasOwn(item.extra, field) ? item.extra[field] : null;
}

/**
 * Every enumerated value this item's own category declares that it does NOT
 * currently hold, keyed by the shouted form a body would write it in.
 *
 * Derived, with nothing hand-kept: `updatesFor` is the same merge of
 * `TIER_UPDATES` and the category's own `updates` that `edit`, `help` and the
 * tag projection read, so a status added to the type or a `state` value added
 * to `config.json` arrives here with no edit to this file. Booleans and digits
 * are skipped because "TRUE" and "4" are not words a body shouts a verdict in,
 * and `true`/`false` in particular would collide with "THAT PREMISE WAS FALSE".
 */
function unheldValues(config: Config, item: Item): Map<string, { field: string; current: string }> {
  const out = new Map<string, { field: string; current: string }>();
  const updates = updatesFor(config, item.type);
  for (const field of Object.keys(updates).sort()) {
    const decl = updates[field];
    if (decl.store !== 'field' || decl.values === undefined) continue;
    const current = fieldValue(item, field);
    if (current === null || current === '') continue;
    for (const value of decl.values) {
      if (value === current || value === 'true' || value === 'false') continue;
      if (!/^[a-z]{4,}$/.test(value)) continue;
      const key = value.toUpperCase();
      if (!out.has(key)) out.set(key, { field, current });
    }
  }
  return out;
}

/** Whether this item's own fields already say it is finished. */
function alreadyClosed(item: Item): boolean {
  if (item.status === 'superseded' || item.status === 'deprecated') return true;
  return Object.hasOwn(item.extra, 'state') && item.extra.state === 'done';
}

function snippet(text: string, max: number = 64): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return JSON.stringify(flat.length > max ? `${flat.slice(0, max)}…` : flat);
}

/**
 * **Does the body agree with the title and the fields above it?**
 *
 * Nothing asked that before. `doctor` checks checksums, projections, citations
 * and scope; every one of those compares a field against something outside the
 * item, and none of them reads the prose. Writing summaries for the whole
 * corpus on 2026-08-26 forced somebody to read every body for the first time
 * and turned up items whose own text closes them while the fields say they are
 * open, titles asserting a defect the body withdraws, and one INJECTED rule
 * whose title claims a parity its body had already given up — that one being
 * fed to agents as governing truth.
 *
 * **Three signals, and only the first is fully derived.** Saying which is
 * which is the point, not a caveat.
 *
 * 1. **A value the item does not hold.** `unheldValues` reads this item's own
 *    declared field vocabularies through `updatesFor` — the same merge `edit`
 *    and `help` read — so a body shouting `SUPERSEDED` on `status: active`, or
 *    `DONE` on `state: todo`, is a disagreement between two things this corpus
 *    already declares. Nothing is hand-kept: add a `state` value to
 *    `config.json` and this follows it with no edit here.
 * 2. **A closing verdict no vocabulary declares.** `RESOLVED`, `FIXED`,
 *    `MOOT`, `ANSWERED` and the rest of `CLOSING_VERDICTS` are English, not
 *    this project's words, and there is no derived list anywhere for them to
 *    drift out of step with — which is what makes them a lexicon rather than
 *    the duplicated-list defect this project has been bitten by. It is still
 *    the part that can silently miss, so `body_review_limits` states the
 *    reach of the whole check beside its findings, and says in as many words
 *    that the count is a floor.
 * 3. **The body retracting its own title.** `RETRACTION` + `SELF_REF` on one
 *    sentence, and `TITLE_COUNT` for a count in the title the body re-measures.
 *    Both compare the item against ITSELF; neither consults a list of items.
 *
 * **What makes it precise enough to be worth reading is the SHAPE, not the
 * words.** A verdict in this corpus opens a line in capitals — the corpus's own
 * emphasis convention — so only a clause at the head of a line is read, and a
 * clause carrying a `HEDGES` word is a plan rather than a verdict and is
 * dropped. That is what keeps `DONE WHEN:` (an acceptance criterion, on eight
 * requirements here) and `UNTIL THIS IS FIXED` out of the report.
 *
 * **`info`, and it must never become an error.** The ruling and its reasoning
 * are recorded on the check that reports it: the signal is inferential, a false
 * positive on a gate stops the world over prose, and the remedy — moving a
 * status or rewriting a title — is the owner's call. An error here would push
 * whoever wanted a green run into editing exactly the two fields that are not
 * theirs to edit.
 *
 * **One short finding per item.** The owner has already filed a task about a
 * doctor message that repeats a long explanation with every finding; the
 * standing limitation is stated ONCE, in `body_review_limits`, and never
 * beside each item.
 */
export function checkBodyAgreement(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];

  for (const item of items) {
    const body = item.body.trim();
    if (body === '') continue;
    const reasons: string[] = [];
    const vocabulary = unheldValues(config, item);
    const closed = alreadyClosed(item);
    // Once per WORD, never once per line: "RESOLVED" shouted three times is
    // one disagreement, not three.
    const said = new Set<string>();

    for (const line of body.split('\n')) {
      for (const words of leadClauses(line)) {
        for (const word of words) {
          if (said.has(word)) continue;
          const held = vocabulary.get(word);
          if (held !== undefined) {
            said.add(word);
            reasons.push(`body shouts "${word}" while ${held.field} is "${held.current}".`);
            continue;
          }
          if (!closed && CLOSING_VERDICTS.has(word)) {
            said.add(word);
            reasons.push(`body shouts the closing verdict "${word}" on an item still open.`);
          }
        }
      }
    }

    // Split on the colon as well as the full stop: this corpus writes
    // paragraph-long sentences with a colon in the middle, and without the
    // colon "THE SECOND HALF OF THIS TASK … and both are wrong" reads as one
    // clause in which a self-reference and a falsity claim about something
    // else are neighbours.
    for (const clause of body.split(/(?<=[.!?:])\s+|\n/)) {
      const announced = RETRACTION_ANNOUNCED.test(clause);
      const predicate = RETRACTION_PREDICATE.test(clause) && SELF_REF.test(clause);
      if (!announced && !predicate) continue;
      // An ANNOUNCED retraction still has to be about this item rather than
      // quoted from elsewhere: either it names the item's own title/premise, or
      // it is shouted, which is how this corpus marks a verdict on itself.
      if (announced && !predicate && !SELF_REF.test(clause) && leadClauses(clause).length === 0) continue;
      reasons.push(`body retracts its own premise: ${snippet(clause)}.`);
      break;
    }

    TITLE_COUNT.lastIndex = 0;
    let counted: RegExpExecArray | null;
    while ((counted = TITLE_COUNT.exec(item.title)) !== null) {
      if (counted[1] === '0' || counted[1] === '1') continue;
      const stem = counted[2]!.replace(/s$/i, '');
      const again = new RegExp(`(?<![\\dA-Za-z.-])(\\d{1,5})\\s+${stem}s?\\b`, 'gi');
      const inBody = [...body.matchAll(again)].map((m) => m[1]!);
      // Nothing is reported while the body ALSO states the title's own count:
      // a body that says both is elaborating, not disagreeing.
      if (inBody.length === 0 || inBody.includes(counted[1]!)) continue;
      reasons.push(`title says ${counted[1]} ${counted[2]}; body says ${inBody[0]}.`);
      break;
    }

    if (reasons.length === 0) continue;
    const extra = reasons.length > 2 ? ` (+${reasons.length - 2} more)` : '';
    findings.push({
      level: 'info', code: 'body_disagrees_with_meta', item: item.id,
      remedy: ACK,
      message:
        `${reasons.slice(0, 2).join(' ')}${extra} Read the body against the title and the ` +
        `fields; which of the two moves is the owner's call.`,
    });
  }

  // The standing statement of reach, once per run and never beside a finding
  // — the owner has already filed a task about a doctor message that repeats a
  // long explanation with every finding.
  //
  // It rides WITH the findings rather than being emitted unconditionally, and
  // that is a deliberate trade rather than an oversight. "A clean corpus's
  // summary counts are exactly 0/0/0" is pinned in three test files
  // (`doctor-cli-on-path`, `docs/fixture`, `docs/examples`) and is the contract
  // that makes `doctor` usable in CI; a note nobody can ever clear is also the
  // failure `checkCitationForm`'s own docblock refuses. The cost is real and is
  // named here rather than hidden: on a corpus where this check finds nothing,
  // it says nothing, and "nothing found" is still not "nothing present".
  if (findings.length > 0) {
    findings.push({
      level: 'info', code: 'body_review_limits',
      about: 'body_disagrees_with_meta',
      remedy: NOTHING,
      message:
        `the ${findings.length} finding(s) above, out of ${items.length} item(s) read, are a ` +
        `FLOOR and not a count. This check reads two shapes only: a shouted clause OPENING a ` +
        `line, and a clause retracting the item's own title or premise. The field values it ` +
        `checks against are derived from each item's own category, so they follow config; the ` +
        `closing verdicts (RESOLVED, FIXED, CLOSED, ANSWERED, MOOT, …) are a listed lexicon, ` +
        `because no vocabulary in this project declares them. A contradiction written in ` +
        `ordinary sentence case, by implication, or in words not on that list is INVISIBLE ` +
        `here — "none found" is not "none present".`,
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

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[]; config: Config;
}): Finding[] {
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkBodyTruncation(opts.root, opts.items),
    () => checkBodyAgreement(opts.items, opts.config),
    () => checkCitationForm(opts.repoRoot, opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items, opts.config),
    () => checkScopePolicy(opts.items, opts.config),
    () => checkUnknownCategory(opts.items, opts.config),
    () => checkSkippedConfigKeys(opts.config),
    () => checkContinuity(opts.items, opts.config),
    () => checkSummary(opts.items),
    () => checkPermissions(opts.root, accessSync, opts.repoRoot),
    () => checkSessionIdMismatch(opts.root),
    () => checkAuditSize(opts.root),
    () => checkStateUnaudited(opts.root, opts.items, opts.config),
    () => checkTaskUnverified(opts.root, opts.items, opts.config),
    () => checkCorpusSize(opts.items),
    () => checkTagProjection(opts.items, opts.config),
    () => checkTaskNeeds(opts.items, opts.config),
    () => checkNestedCorpus(opts.root, opts.repoRoot),
    () => checkForeignStore(opts.repoRoot),
  ];

  const findings: Finding[] = [];
  for (const check of checks) {
    try {
      findings.push(...check());
    } catch (err) {
      // A check that throws must never suppress the others.
      findings.push({
        level: 'error', code: 'check_failed',
        remedy: PERSON,
        message: `a doctor check threw: ${err instanceof Error ? err.message : String(err)}`,
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
