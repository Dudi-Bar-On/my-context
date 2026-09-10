/**
 * **The integrity manifest — a checksum per entry, and the refusal that rests
 * on it.**
 *
 * D41 spec §13. The rules ship inside the package, so restoring them is a
 * LOCAL operation: if the package is intact, they are intact, and the network
 * is not a dependency. Nothing in this module reaches outside the two
 * directories it is handed.
 *
 * ── WHY node:crypto AND NOT `core/content-hash.ts` ─────────────────────────
 *
 * The plan (Task 4 step 3) says to use "the existing checksum helper rather
 * than a second hash", and the same plan's File Structure section says
 * `src/rules/` imports nothing from `src/core/` except the frontmatter parser,
 * *"because the corpus must not depend on it and it must not depend on the
 * corpus"*. Those two instructions cannot both be honoured: the helper lives
 * in `core/content-hash.ts`.
 *
 * The isolation rule wins, because it is the one spec §7 argues for at length
 * and the one `test/rules/isolation.test.ts` guards. `node:crypto` is not a
 * second hash *implementation* — it is the platform's, and it is what the
 * corpus helper is built on too. What is deliberately NOT reused is the
 * corpus' *content shape*: an item's hash covers a chosen set of fields
 * because an item has fields that are not part of what it says. An entry has
 * no such distinction, so this hashes the FILE, and the difference between the
 * two is a reason to keep them apart rather than to share one function.
 *
 * ── LINE ENDINGS ARE NORMALIZED BEFORE HASHING, DELIBERATELY ───────────────
 *
 * A checkout with `core.autocrlf` on rewrites every `\n` to `\r\n` on the way
 * to disk. Hashing raw bytes would then report every entry in the store as
 * ALTERED on a Windows clone — a verification command whose first answer on a
 * clean install is "your rules have been tampered with" is a command people
 * turn off. The manifest therefore hashes the text with `\r\n` folded to `\n`,
 * which is the same normalization the file's own meaning already has.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseEntry } from './schema.ts';

export const MANIFEST_FILE = 'manifest.json';
const ALGORITHM = 'sha256';
const VERSION = 1;

export interface ManifestRow {
  /** The file's name inside the store directory. */
  file: string;
  /** The entry's id, so a refusal can name the ENTRY and not only a path. */
  id: string;
  checksum: string;
}

export interface Manifest {
  version: number;
  algorithm: string;
  entries: ManifestRow[];
}

export type Damage = 'missing' | 'altered' | 'unexpected';

export interface Problem {
  /** The entry id where one is known, and the file name where it is not. */
  entry: string;
  why: Damage;
  /** One sentence a person can act on. */
  detail: string;
}

export type Verification =
  | { ok: true }
  | { ok: false; entry: string; why: Damage; problems: Problem[] };

export function manifestPath(dir: string): string {
  return path.join(dir, MANIFEST_FILE);
}

function checksum(text: string): string {
  return createHash(ALGORITHM).update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

function entryFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
}

/**
 * Regenerate the manifest from what is on disk. Spec §12.2: this is what the
 * publish step does.
 *
 * **This is the one write in this module that is NOT gated on the store being
 * intact, and that is deliberate.** Regenerating the manifest is how a damaged
 * store is made whole again — by the owner, having looked at the diff — so
 * gating it on the manifest already agreeing would make damage a dead end. The
 * catch below is on writes to the ENTRIES, which are the thing a damaged store
 * cannot be trusted to accept.
 */
export function writeManifest(dir: string): Manifest {
  const entries: ManifestRow[] = [];
  for (const file of entryFiles(dir)) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseEntry(text, path.join(dir, file));
    entries.push({
      file,
      // A file too broken to parse still gets a row: leaving it out would make
      // the manifest agree with a store it cannot describe, and the entry
      // would then read as `unexpected` rather than as the broken entry it is.
      id: 'error' in parsed ? (parsed.id ?? file) : parsed.id,
      checksum: checksum(text),
    });
  }
  const manifest: Manifest = { version: VERSION, algorithm: ALGORITHM, entries };
  writeFileSync(manifestPath(dir), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function readManifest(dir: string): Manifest {
  const raw = JSON.parse(readFileSync(manifestPath(dir), 'utf8')) as Manifest;
  if (!Array.isArray(raw.entries)) throw new Error(`${MANIFEST_FILE} carries no entry list`);
  return raw;
}

/**
 * Verify the store against its manifest, and say **which** entry is missing,
 * altered or unexpected.
 *
 * Every problem is returned, not only the first (`INV-nothing-is-dropped-
 * silently`): naming one of three damaged entries makes a repair look complete
 * when it has fixed a third of the damage. `entry` and `why` name the first in
 * sorted order so that a caller wanting one sentence has one.
 */
export function verifyManifest(dir: string): Verification {
  let manifest: Manifest;
  try {
    manifest = readManifest(dir);
  } catch (err) {
    const problem: Problem = {
      entry: MANIFEST_FILE,
      why: 'missing',
      detail: `the integrity manifest could not be read (${err instanceof Error ? err.message : String(err)}). ` +
        `Without it nothing can say whether the rules are the ones that shipped.`,
    };
    return { ok: false, entry: problem.entry, why: problem.why, problems: [problem] };
  }

  const problems: Problem[] = [];
  const listed = new Set<string>();
  for (const row of manifest.entries) {
    listed.add(row.file);
    let text: string;
    try {
      text = readFileSync(path.join(dir, row.file), 'utf8');
    } catch {
      problems.push({
        entry: row.id,
        why: 'missing',
        detail: `${row.file} is not there. It shipped with the package, so this is an incomplete ` +
          `install rather than a configuration mistake.`,
      });
      continue;
    }
    if (checksum(text) !== row.checksum) {
      problems.push({
        entry: row.id,
        why: 'altered',
        detail: `${row.file} does not match the checksum that shipped with it. Somebody changed ` +
          `it, or something did.`,
      });
    }
  }
  for (const file of entryFiles(dir)) {
    if (listed.has(file)) continue;
    problems.push({
      entry: file,
      why: 'unexpected',
      detail: `${file} is in the store and the manifest never listed it. An entry nobody shipped ` +
        `loads exactly like one that did, so this is the damage most worth seeing.`,
    });
  }

  if (problems.length === 0) return { ok: true };
  return { ok: false, entry: problems[0].entry, why: problems[0].why, problems };
}

/**
 * **The refusal, and it is NOT the budget refusal — which is worth stating
 * because the two look alike.**
 *
 * Spec §10 says a user's install NEVER refuses on BUDGET: everything in the
 * store is injected, no exception, because a user's install failing because
 * *our* store grew is a self-inflicted outage they can do nothing about. The
 * gate for that is at publish time, in the maintenance tool a user never runs.
 *
 * A DAMAGED store is a different fact. It means the rules governing the write
 * are unknown, and writing anyway would be acting under rules nobody can name.
 * **One refuses because we overspent; the other because we cannot say what is
 * true.**
 *
 * And it refuses WRITES ONLY. `loadRules` never calls this and must never call
 * it: blocking reads punishes a user for a damaged install they can still
 * recover from, and a tool that has stopped answering is one they cannot
 * recover from at all. This is a safety catch, not a hostage.
 */
export class StoreDamagedError extends Error {
  readonly problems: Problem[];
  constructor(problems: Problem[]) {
    const named = problems.map((p) => `${p.entry} (${p.why})`).join(', ');
    super(
      `my_context: the rule store has been changed since it was installed — ${named}. ` +
      `Writes are refused while that is true, because the rules governing the write are ` +
      `themselves in doubt; reads still work. ` +
      `${problems.map((p) => p.detail).join(' ')} ` +
      `Run \`mycontext rules verify --restore\` to put back what shipped.`,
    );
    this.name = 'StoreDamagedError';
    this.problems = problems;
  }
}

/** Throws `StoreDamagedError` when the store does not match its manifest. */
export function assertStoreWritable(dir: string): void {
  const answer = verifyManifest(dir);
  if (!answer.ok) throw new StoreDamagedError(answer.problems);
}

/**
 * The store's single write path for an ENTRY, and therefore the single place
 * the catch above has to be applied. The maintenance tool of Phase 3 writes
 * through this rather than through `node:fs` directly, so "does a damaged
 * store refuse this write" is answerable by reading one function.
 */
export function writeEntry(dir: string, file: string, text: string): void {
  assertStoreWritable(dir);
  writeFileSync(path.join(dir, file), text, 'utf8');
}

export interface RestoreReport {
  /** Entry ids put back from the package. */
  restored: string[];
  /** Files in the target the package does not have. Named, never deleted. */
  unexpected: string[];
}

/**
 * Restore `to` from `from` — the installed package — and regenerate `to`'s
 * manifest so a following `verify` answers about what is now on disk.
 *
 * A file the package does not have is NAMED and LEFT WHERE IT IS. Deleting it
 * is a decision to take rather than one to make on somebody's behalf: it may
 * be the only copy of something a person put there deliberately, and this
 * project already draws that line the same way for a persisted conversation.
 */
export function restoreEntries(from: string, to: string): RestoreReport {
  const source = readManifest(from);
  const restored: string[] = [];
  for (const row of source.entries) {
    const original = readFileSync(path.join(from, row.file), 'utf8');
    let current: string | null;
    try { current = readFileSync(path.join(to, row.file), 'utf8'); } catch { current = null; }
    if (current !== null && checksum(current) === checksum(original)) continue;
    writeFileSync(path.join(to, row.file), original, 'utf8');
    restored.push(row.id);
  }
  const shipped = new Set(source.entries.map((e) => e.file));
  const unexpected = entryFiles(to).filter((file) => !shipped.has(file));
  /**
   * The package's manifest is COPIED, never regenerated from the restored
   * directory. Regenerating it would list whatever is on disk — including a
   * file the package never shipped — so a restore would end by certifying the
   * planted entry it had just declined to delete, and the next `verify` would
   * come back clean over it.
   */
  if (path.resolve(from) !== path.resolve(to)) {
    writeFileSync(manifestPath(to), readFileSync(manifestPath(from), 'utf8'), 'utf8');
  }
  return { restored, unexpected };
}
