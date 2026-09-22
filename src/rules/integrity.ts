/**
 * **The integrity manifest: its shape, how it is read, and the one question
 * "is this the store that shipped".**
 *
 * D41 spec §13. This module answers that question and does nothing else. It
 * performs no write, holds no budget, and imports nothing — not even
 * `schema.ts` — so the closure of anything that consults it is this file and
 * the platform.
 *
 * ── WHY IT IS A SEPARATE FILE FROM `manifest.ts`, WHICH IS THE WHOLE POINT ──
 *
 * `test/rules/budget.test.ts` walks the imports of `store.ts` and `deliver.ts`
 * and fails if either can reach the module holding the budget, and its reason
 * is spec §10's: *"a user's install NEVER refuses on size, because a user
 * cannot fix a store that grew"*. A budget reachable from the delivery path is
 * a refusal waiting for a store one byte larger.
 *
 * That gate was written when verification and the budget lived in one file, so
 * it read as *"the delivery path may not consult the manifest at all"* — and
 * `store/6` is what that cost: a Markdown file dropped into the entries
 * directory was delivered at every door as a governing constant, while
 * `verifyManifest` sat one import away calling it `unexpected`. The manifest
 * was right and no door could ask it without also importing the budget.
 *
 * So the two are separated by what they are, not by what they happen to sit
 * beside: **reading the manifest is a read a door may do; the budget and every
 * write are `manifest.ts`'s and stay unreachable from delivery.** The gate is
 * unchanged and still passes — `deliver.ts` cannot reach `manifest.ts` — and
 * `test/rules/budget.test.ts` now also asserts the budget SYMBOLS are absent
 * from the delivery closure, so moving them in here would fail rather than go
 * quiet.
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
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const MANIFEST_FILE = 'manifest.json';
export const ALGORITHM = 'sha256';

export interface ManifestRow {
  /** The file's name inside the store directory. */
  file: string;
  /** The entry's id, so a refusal can name the ENTRY and not only a path. */
  id: string;
  /**
   * Absent exactly when `refused` is present (B12).
   *
   * A file the parser cannot read must never be SEALED with a checksum: a
   * checksum only ever proves "unchanged since sealing", and sealing broken
   * content would let a later `verify` say that about content nobody has
   * ever read. See `refused`.
   */
  checksum?: string;
  /**
   * The parser's own refusal, when this file could not be sealed with a
   * checksum (B12). The row is still WRITTEN — dropping it would make the
   * manifest agree with a store it cannot describe, and the entry would then
   * read as `unexpected` rather than as the broken entry it is — but it
   * carries no checksum, so `verifyManifest` reports it as damage on every
   * call rather than silently treating unreadable content as verified.
   */
  refused?: string;
}

/**
 * One published version of the store, and what moved in it. Spec §12.1: the
 * store is versioned independently of the product, *"so the store carries its
 * own version and its own changelog, and a store update is an artifact a
 * user's install can take on its own."*
 */
export interface ChangelogRow {
  version: number;
  /** ISO instant of the publish. */
  at: string;
  /** What the owner said this publish was for. Optional. */
  note?: string;
  added: string[];
  changed: string[];
  removed: string[];
}

export interface StoreMeta {
  /** The STORE's version — not the product's, and not `Manifest.version`. */
  version: number;
  publishedAt: string | null;
  /** Newest first, so the top of the list is what an install just took. */
  changelog: ChangelogRow[];
}

export interface Manifest {
  /**
   * The manifest FORMAT's version. Deliberately not the store's — a reader
   * that conflated the two would refuse a store whose contents had merely been
   * republished. `store.version` below is the one spec §12.1 is about.
   */
  version: number;
  algorithm: string;
  /**
   * **The last PUBLISHED state**, and therefore what `verifyManifest` answers
   * against. It is regenerated at publish (spec §12.2) and at no other time,
   * which is what makes `planPublish` able to show a diff at all.
   */
  entries: ManifestRow[];
  /**
   * **Changes made since that publish through the sanctioned write path.**
   *
   * Without this the FIRST edit the maintenance tool makes leaves the store
   * disagreeing with its manifest and the SECOND edit is refused by the §13
   * catch — the safety catch firing on the owner's own work, in the one tool
   * whose purpose is to change the store. See `writeEntry`.
   *
   * It is absent from a freshly published manifest rather than present and
   * empty, so a shipped manifest carries no field describing work in progress.
   */
  working?: ManifestRow[];
  store?: StoreMeta;
}

/**
 * `refused` (B12) is a fourth kind of damage, distinct from the other three:
 * it is not about whether the bytes changed, it is that the row was never
 * sealed with a checksum in the first place, because the parser could not
 * read the file when the manifest was last written.
 */
export type Damage = 'missing' | 'altered' | 'unexpected' | 'refused';

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

export function checksum(text: string): string {
  return createHash(ALGORITHM).update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export function entryFiles(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
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
export function verifyManifest(dir: string, sanctionedBy?: Map<string, string>): Verification {
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
    // B12: a row sealed with `refused` carries no checksum, so it can never
    // "match" one — it is reported as damage on every call, independent of
    // what is currently on disk. That is deliberate: the row records what
    // was true when the store was last sealed, and re-parsing the file here
    // would make `verifyManifest` a second parser to keep in sync with
    // `parseEntry` for a question `writeManifest`/`recordWrite` already
    // answered once, at the only moment that is allowed to change the seal.
    if (row.refused !== undefined) {
      problems.push({
        entry: row.id,
        why: 'refused',
        detail: `${row.file} failed to parse when the store was last sealed (${row.refused}). It ` +
          `carries no checksum and cannot be verified as unchanged. Fix the entry, then regenerate ` +
          `the manifest.`,
      });
      continue;
    }
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
    const now = checksum(text);
    if (now !== row.checksum && sanctionedBy?.get(row.file) !== now) {
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
    // A file the maintenance tool CREATED is not yet published and is not
    // damage — it is the change `planPublish` is about to show.
    if (sanctionedBy?.has(file) === true) continue;
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
 * **The store's own version, or `null` when the manifest carries none** —
 * `store/9`.
 *
 * It lives here rather than in `manifest.ts` because the surfaces that need to
 * ANSWER "which store version do I have" are shipped ones — the CLI — and the
 * only readers it had were under `src/ui/maintenance/`, which `package.json`
 * excludes from the published package. A version nobody in a real install can
 * read is a version that does not exist there.
 */
export function storeMeta(dir: string): StoreMeta | null {
  try {
    return readManifest(dir).store ?? null;
  } catch {
    return null;
  }
}
