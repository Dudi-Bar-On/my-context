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
import { parseEntry, type Tier } from './schema.ts';

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
export function writeManifest(dir: string, store?: StoreMeta): Manifest {
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
  /**
   * The store's version and changelog are CARRIED FORWARD, never recomputed.
   * They are history: regenerating the manifest is a statement about what is on
   * disk now, and a regeneration that dropped the changelog would make every
   * repair of a damaged store also an erasure of how it got here.
   */
  const kept = store ?? (((): StoreMeta | undefined => {
    try { return readManifest(dir).store; } catch { return undefined; }
  })());
  const manifest: Manifest = {
    version: VERSION,
    algorithm: ALGORITHM,
    ...(kept === undefined ? {} : { store: kept }),
    entries,
  };
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

/**
 * Throws `StoreDamagedError` when the store holds a change nobody made through
 * this module.
 *
 * **This is deliberately NOT `verifyManifest`, and the difference is the whole
 * of what makes the catch usable.** `verifyManifest` answers *"is this the
 * store that was published"*, which is the question a user's install asks and
 * the question `mycontext rules verify` prints. In a workspace where the store
 * is being MAINTAINED the honest answer to that is "no, three entries are
 * being rewritten", and refusing every further write on those grounds would
 * turn the safety catch into a lock on the owner's own work.
 *
 * So the question asked here is the narrower one: **is anything in this store
 * different from both what was published AND what was written through
 * `writeEntry`.** A file altered by anything else matches neither and refuses,
 * which is the case §13 is about.
 */
export function assertStoreWritable(dir: string): void {
  const answer = verifyManifest(dir, sanctioned(dir));
  if (!answer.ok) throw new StoreDamagedError(answer.problems);
}

/** The checksums `writeEntry` has recorded since the last publish, by file. */
function sanctioned(dir: string): Map<string, string> {
  const known = new Map<string, string>();
  try {
    for (const row of readManifest(dir).working ?? []) known.set(row.file, row.checksum);
  } catch { /* no manifest is its own problem, reported by verifyManifest */ }
  return known;
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
  recordWrite(dir, file, text);
}

/**
 * **A sanctioned write updates the manifest row it just made stale, and that
 * is what makes the catch above mean anything.**
 *
 * Without this, the FIRST edit the maintenance tool makes leaves the store
 * disagreeing with its manifest, and the SECOND edit is refused — the safety
 * catch firing on the owner's own work, in the one tool whose whole purpose is
 * to change the store. A person would then either regenerate the manifest by
 * hand after every keystroke or, far more likely, stop using `writeEntry` and
 * reach for `node:fs`, which is how the catch stops existing at all.
 *
 * So the invariant is not "the manifest matches what shipped" — it is **"the
 * manifest matches every change made through the sanctioned path"**, and
 * `verifyManifest` therefore answers the question worth asking: has anything
 * changed that nobody made deliberately. The `assertStoreWritable` above still
 * runs FIRST, so a store already damaged by something else refuses the write
 * and this line is never reached: you may only change a store you can attest
 * to.
 *
 * The row goes in `working`, NOT in `entries`: `entries` is the last PUBLISHED
 * state, and it is the only thing `planPublish` can diff against. A sanctioned
 * write that updated `entries` would leave the store permanently in agreement
 * with its manifest and publishing with nothing left to show.
 */
function recordWrite(dir: string, file: string, text: string): void {
  let manifest: Manifest;
  try { manifest = readManifest(dir); } catch { return; }
  const parsed = parseEntry(text, path.join(dir, file));
  const row: ManifestRow = {
    file,
    id: 'error' in parsed ? (parsed.id ?? file) : parsed.id,
    checksum: checksum(text),
  };
  const working = manifest.working ?? [];
  const at = working.findIndex((e) => e.file === file);
  if (at === -1) working.push(row); else working[at] = row;
  working.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  manifest.working = working;
  writeFileSync(manifestPath(dir), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
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

/* ══ THE BUDGET — GOVERNED HERE, ENFORCED AT PUBLISH ═══════════════════════ */

/**
 * **The recommended size of the `product` tier, in bytes.**
 *
 * A DEFAULT and not a constant: spec §10 says *"the budget is changeable by
 * the owner, not a constant in the code"*, so every function below takes it as
 * an argument and this is only what they use when nobody said.
 *
 * 20 KB is roughly five thousand tokens — about the size of one of this
 * project's larger pinned items, and small enough that reaching it is a
 * genuine prompt to demote something rather than an alarm that fires once a
 * year. It is a RECOMMENDATION at maintenance time and a REFUSAL only at
 * publish; nothing a user runs ever consults it.
 */
export const DEFAULT_BUDGET_BYTES = 20_000;

export interface EntrySize {
  id: string;
  file: string;
  /** Computed from the file on disk, on every call. Never stored. */
  bytes: number;
}

export interface TierSize {
  tier: Tier;
  bytes: number;
  /** Largest first — the order the question "what do I move" is asked in. */
  entries: EntrySize[];
}

export interface BudgetReport {
  budgetBytes: number;
  /** Counted. This is what reaches a user. */
  product: TierSize;
  /** Reported and NOT counted: it never leaves this workspace. */
  developer: TierSize;
  over: boolean;
  /** How far over, in bytes. `0` when inside. */
  overBy: number;
}

/**
 * The tier a file on disk claims, read WITHOUT the tier filter.
 *
 * `loadRules` would be the obvious source and is the wrong one: it drops
 * developer-tier entries outside my_context, and a budget report that could not
 * see the developer tier would report the product tier as the whole store —
 * which is the one number spec §10 says not to conflate.
 */
function sizes(dir: string): Record<Tier, EntrySize[]> {
  const byTier: Record<Tier, EntrySize[]> = { product: [], developer: [] };
  for (const file of entryFiles(dir)) {
    const full = path.join(dir, file);
    const text = readFileSync(full, 'utf8');
    const parsed = parseEntry(text, full);
    // A file too broken to parse still takes up room, and it is counted in the
    // tier it claims; a file that claims no readable tier is counted as
    // `product`, which is the direction that errs toward refusing a publish
    // rather than toward shipping something nobody measured.
    const tier: Tier = 'error' in parsed
      ? (/^tier:\s*developer\s*$/m.test(text) ? 'developer' : 'product')
      : parsed.tier;
    byTier[tier].push({
      id: 'error' in parsed ? (parsed.id ?? file) : parsed.id,
      file,
      bytes: Buffer.byteLength(text, 'utf8'),
    });
  }
  for (const tier of ['product', 'developer'] as const) {
    byTier[tier].sort((a, b) => b.bytes - a.bytes || (a.id < b.id ? -1 : 1));
  }
  return byTier;
}

/**
 * **Size, computed on the fly, every time.**
 *
 * Spec §10: *"Per-entry size is computed on the fly, never persisted. A
 * persisted size is a cache that goes stale silently. Same lesson as
 * `archive/37`, where the day is derived once so the filter and the printed
 * stamp cannot disagree."* So this function reads the files. There is no
 * `size` field anywhere in the store or its manifest, and
 * `test/rules/budget.test.ts` asserts that by growing a file and asking again.
 */
export function budgetReport(dir: string, budgetBytes?: number): BudgetReport {
  const budget = budgetBytes ?? DEFAULT_BUDGET_BYTES;
  const byTier = sizes(dir);
  const total = (rows: EntrySize[]): number => rows.reduce((sum, row) => sum + row.bytes, 0);
  const product: TierSize = { tier: 'product', bytes: total(byTier.product), entries: byTier.product };
  const developer: TierSize = {
    tier: 'developer', bytes: total(byTier.developer), entries: byTier.developer,
  };
  const overBy = Math.max(0, product.bytes - budget);
  return { budgetBytes: budget, product, developer, over: overBy > 0, overBy };
}

/* ══ PUBLISHING ════════════════════════════════════════════════════════════ */

export interface PublishChange {
  how: 'added' | 'changed' | 'removed';
  id: string;
  file: string;
}

export interface PublishPlan {
  changes: PublishChange[];
  budget: BudgetReport;
  /** Largest product entries first: the answer to "what do I move". */
  toMove: EntrySize[];
  /** `null` when publishing may proceed; the refusal sentence otherwise. */
  refusal: string | null;
  fromVersion: number;
  toVersion: number;
}

export interface PublishOptions {
  budgetBytes?: number;
  note?: string;
}

/**
 * **What a publish would do, computed and shown before anything is done.**
 *
 * Spec §12.2: *"Shows a diff of what changes, and ASKS before it goes.
 * Publishing is outward-facing and hard to reverse."* The diff is against
 * `entries` — the last published state — which is why `writeEntry` records
 * into `working` and leaves `entries` alone. If a sanctioned write updated
 * `entries`, the store would always agree with its manifest and there would be
 * no diff left to show.
 */
export function planPublish(dir: string, options: PublishOptions = {}): PublishPlan {
  const budget = budgetReport(dir, options.budgetBytes);
  let published: ManifestRow[] = [];
  let fromVersion = 0;
  try {
    const manifest = readManifest(dir);
    published = manifest.entries;
    fromVersion = manifest.store?.version ?? 0;
  } catch { /* no manifest: everything on disk is new */ }

  const wasPublished = new Map(published.map((row) => [row.file, row]));
  const changes: PublishChange[] = [];
  for (const file of entryFiles(dir)) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseEntry(text, path.join(dir, file));
    const id = 'error' in parsed ? (parsed.id ?? file) : parsed.id;
    const before = wasPublished.get(file);
    if (before === undefined) { changes.push({ how: 'added', id, file }); continue; }
    if (before.checksum !== checksum(text)) changes.push({ how: 'changed', id, file });
  }
  const onDisk = new Set(entryFiles(dir));
  for (const row of published) {
    if (!onDisk.has(row.file)) changes.push({ how: 'removed', id: row.id, file: row.file });
  }
  changes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  /**
   * **The machine gate, and the design's own addition** (spec §10): *"if the
   * only thing preventing spill is discipline at maintenance time, that is a
   * human gate on a machine problem — the shape that already failed for the
   * corpus, where items were pinned one at a time, each reasonably, until
   * twelve of them spill and one does so 482 times."*
   *
   * It names what to move, because a refusal that does not say what to do next
   * is a refusal somebody works around.
   */
  const toMove = budget.product.entries.slice(0, 3);
  const refusal = budget.over
    ? `publishing is refused: the product tier is ${budget.product.bytes} bytes against a budget `
      + `of ${budget.budgetBytes} — ${budget.overBy} over. Everything in the product tier reaches `
      + `every user's install and is injected there with no exception, so this cannot be enforced `
      + `where a user would meet it. Move something to the developer tier (demotion is reversible, `
      + `spec §10); the largest are `
      + `${toMove.map((row) => `\`${row.id}\` (${row.bytes} bytes)`).join(', ')}.`
    : null;

  return { changes, budget, toMove, refusal, fromVersion, toVersion: fromVersion + 1 };
}

export type PublishResult =
  | { ok: true; version: number; changes: PublishChange[] }
  | { ok: false; error: string; plan: PublishPlan };

/**
 * Publish. **Nothing on disk moves unless `confirm` is true and the plan has no
 * refusal** — asserted on the manifest's bytes in `test/rules/publish.test.ts`,
 * because a function that merely returns `ok: false` has proved only that it
 * declined.
 */
export function publishStore(
  dir: string, options: PublishOptions & { confirm: boolean },
): PublishResult {
  const plan = planPublish(dir, options);
  if (plan.refusal !== null) return { ok: false, error: plan.refusal, plan };
  if (plan.changes.length === 0) {
    return {
      ok: false,
      plan,
      error: 'there is nothing to publish: the store on disk is the store that was published. '
        + 'Cutting a version for no change would have every install download a store it already '
        + 'has, and would put a row in the changelog naming nothing.',
    };
  }
  if (!options.confirm) {
    return {
      ok: false,
      plan,
      error: `publishing is not confirmed. ${plan.changes.length} change(s) would go out as store `
        + `version ${plan.toVersion}; publishing is outward-facing and hard to reverse (spec §12.2), `
        + `so it asks first.`,
    };
  }

  const previous = ((): StoreMeta => {
    try {
      return readManifest(dir).store ?? { version: 0, publishedAt: null, changelog: [] };
    } catch { return { version: 0, publishedAt: null, changelog: [] }; }
  })();
  const at = new Date().toISOString();
  const row: ChangelogRow = {
    version: plan.toVersion,
    at,
    ...(options.note === undefined || options.note.trim() === '' ? {} : { note: options.note }),
    added: plan.changes.filter((c) => c.how === 'added').map((c) => c.id),
    changed: plan.changes.filter((c) => c.how === 'changed').map((c) => c.id),
    removed: plan.changes.filter((c) => c.how === 'removed').map((c) => c.id),
  };
  writeManifest(dir, {
    version: plan.toVersion,
    publishedAt: at,
    changelog: [row, ...previous.changelog],
  });
  return { ok: true, version: plan.toVersion, changes: plan.changes };
}
