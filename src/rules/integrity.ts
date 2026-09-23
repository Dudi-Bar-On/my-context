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

/* ══ READING THE MANIFEST, AND THE TWO "CANNOT" IT TELLS APART ═════════════ */

/**
 * **There is a manifest and nothing can read it** — which is a different fact
 * from *there is no manifest*, and keeping them apart is the whole of
 * `TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store`.
 *
 * Every read on the publish path used to be wrapped in a `catch` that answered
 * *"then there is no manifest"* for both. A store whose `manifest.json` was one
 * byte of junk therefore published as if it were a first publish: sixteen
 * entries reported as `added`, the store's version reset to 1, and five
 * published versions of changelog replaced by the single row that publish cut.
 * It returned `ok: true`. Measured on a copy of the shipped store, 2026-09-23.
 *
 * A caller that genuinely wants "absent is fine" asks `readManifestIfPresent`
 * and gets `null`; nobody gets "absent" for a file that is right there.
 */
export class ManifestUnreadableError extends Error {
  /** The bare reason, without the framing sentence, for a caller composing its own. */
  readonly reason: string;
  constructor(reason: string) {
    super(`${MANIFEST_FILE}: ${reason}`);
    this.name = 'ManifestUnreadableError';
    this.reason = reason;
  }
}

/**
 * **The one sentence for "the manifest could not be read", said in one place.**
 *
 * `verifyManifest` below and `planPublish`'s refusal (src/rules/manifest.ts)
 * are two surfaces for the same fact, and two hand-written sentences about it
 * would drift the way this project has already paid for. The detail a caller
 * hands in names WHICH way it is unreadable; this adds what it costs.
 */
export function manifestUnreadableDetail(why: string): string {
  return `the integrity manifest could not be read (${why}). ` +
    `Without it nothing can say whether the rules are the ones that shipped.`;
}

/** The digest width `ALGORITHM` actually produces — derived, never a literal 64. */
const DIGEST_HEX = new RegExp(`^[0-9a-f]{${createHash(ALGORITHM).update('').digest('hex').length}}$`);

/**
 * A manifest row is a seal or a refusal, never both and never neither (B12) —
 * and a "checksum" that is not a digest of the declared algorithm is not a
 * seal, because nothing on disk can ever be compared with it.
 */
function rowFault(row: unknown, where: string, at: number): string | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    return `\`${where}[${at}]\` is not a row`;
  }
  const r = row as Record<string, unknown>;
  if (typeof r.file !== 'string' || r.file === '') return `\`${where}[${at}]\` names no file`;
  if (typeof r.id !== 'string' || r.id === '') return `\`${where}[${at}]\` (${r.file}) names no entry id`;
  const sealed = r.checksum !== undefined;
  const refused = r.refused !== undefined;
  if (sealed === refused) {
    return `the \`${where}\` row for ${r.file} carries `
      + `${sealed ? 'both a checksum and a refusal' : 'neither a checksum nor a refusal'} — `
      + `a row is one or the other (B12)`;
  }
  if (sealed && (typeof r.checksum !== 'string' || !DIGEST_HEX.test(r.checksum))) {
    return `the \`${where}\` row for ${r.file} carries \`${String(r.checksum)}\`, which is not a `
      + `${ALGORITHM} digest, so nothing on disk can be compared with it`;
  }
  if (refused && (typeof r.refused !== 'string' || r.refused === '')) {
    return `the \`${where}\` row for ${r.file} is refused and says nothing about why`;
  }
  return null;
}

function changelogRowFault(row: unknown, at: number): string | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    return `\`store.changelog[${at}]\` is not a row`;
  }
  const r = row as Record<string, unknown>;
  if (typeof r.version !== 'number' || !Number.isInteger(r.version)) {
    return `\`store.changelog[${at}]\` names no version`;
  }
  if (typeof r.at !== 'string' || r.at === '') {
    return `\`store.changelog[${at}]\` (version ${r.version}) names no instant`;
  }
  if (r.note !== undefined && typeof r.note !== 'string') {
    return `\`store.changelog[${at}]\` (version ${r.version}) carries a note that is not text`;
  }
  for (const field of ['added', 'changed', 'removed'] as const) {
    const list = r[field];
    if (!Array.isArray(list) || list.some((id) => typeof id !== 'string')) {
      return `\`store.changelog[${at}].${field}\` (version ${r.version}) is not a list of entry ids`;
    }
  }
  return null;
}

function storeBlockFault(store: unknown): string | null {
  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    return '`store` is present and is not a block';
  }
  const s = store as Record<string, unknown>;
  if (typeof s.version !== 'number' || !Number.isInteger(s.version) || s.version < 0) {
    return '`store.version` is not a version number';
  }
  if (!(s.publishedAt === null || typeof s.publishedAt === 'string')) {
    return '`store.publishedAt` is neither an instant nor null';
  }
  if (!Array.isArray(s.changelog)) {
    return '`store.changelog` is not a list, so the history in it cannot be carried forward';
  }
  for (let at = 0; at < s.changelog.length; at += 1) {
    const fault = changelogRowFault(s.changelog[at], at);
    if (fault !== null) return fault;
  }
  return null;
}

/**
 * **Everything a reader of this file assumes, checked once, here.**
 *
 * The old reader checked one thing — that `entries` was an array — and every
 * other field was taken on trust by whoever touched it next. `store.changelog`
 * holding the string `"oops"` therefore reached `[row, ...previous.changelog]`
 * in `publishStore`, which spreads a string into its characters: five real
 * changelog rows became one real row and the four letters of `oops`, written
 * to disk, `ok: true`. Measured 2026-09-23. A field checked where it is USED is
 * a field checked by whoever remembers to; this is the one place that has to.
 */
function manifestFault(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'it is not an object';
  const m = raw as Record<string, unknown>;
  if (typeof m.version !== 'number' || !Number.isInteger(m.version) || m.version < 1) {
    return '`version` is not a manifest format version';
  }
  if (m.algorithm !== ALGORITHM) {
    return `it declares algorithm \`${String(m.algorithm)}\` and this reader computes \`${ALGORITHM}\`, `
      + `so not one checksum in it can be compared with the entries on disk`;
  }
  if (!Array.isArray(m.entries)) return 'it carries no entry list';
  for (let at = 0; at < m.entries.length; at += 1) {
    const fault = rowFault(m.entries[at], 'entries', at);
    if (fault !== null) return fault;
  }
  if (m.working !== undefined) {
    if (!Array.isArray(m.working)) return '`working` is present and is not a list';
    for (let at = 0; at < m.working.length; at += 1) {
      const fault = rowFault(m.working[at], 'working', at);
      if (fault !== null) return fault;
    }
  }
  if (m.store !== undefined) return storeBlockFault(m.store);
  return null;
}

/**
 * **`null` means THERE IS NO MANIFEST. Anything else that goes wrong throws.**
 *
 * This is the read every caller that used to write `try { readManifest(dir) }
 * catch { /* no manifest *\/ }` wanted: the absent case is a value it can
 * branch on, and the corrupt case can no longer be mistaken for it.
 */
export function readManifestIfPresent(dir: string): Manifest | null {
  let text: string;
  try {
    text = readFileSync(manifestPath(dir), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new ManifestUnreadableError(
      `it could not be opened (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ManifestUnreadableError(
      `it is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  const fault = manifestFault(raw);
  if (fault !== null) throw new ManifestUnreadableError(fault);
  return raw as Manifest;
}

export function readManifest(dir: string): Manifest {
  const manifest = readManifestIfPresent(dir);
  if (manifest === null) throw new ManifestUnreadableError('it is not there');
  return manifest;
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
      // The same sentence `planPublish`'s refusal uses, from the same function:
      // one fact, two surfaces, and no second wording to drift.
      detail: manifestUnreadableDetail(err instanceof Error ? err.message : String(err)),
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
