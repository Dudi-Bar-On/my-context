/**
 * One import implementation, behind both surfaces: `mycontext pack import`
 * and `mycontext init --pack`.
 *
 * ## Two functions, and the boundary between them is the §6n.7 rule
 *
 * `planImport` is PURE and writes nothing. That is what lets `init --pack`
 * validate a stranger's artefact before it creates a directory: a bad pack
 * refuses with no half-built workspace left behind. `applyImport` takes an
 * already-open `MutationContext`, so both surfaces share it without either
 * knowing how the other got one.
 *
 * **`overwriteApproved` is a parameter of `applyImport`, not of `planImport`,
 * and that placement is §6n.7 held in the type system.** The plan is computed
 * before the user is asked anything — it is what the warning is *rendered
 * from* — so a plan cannot carry an approval, and `applyImport` cannot
 * overwrite without one being handed to it at the call site where the human
 * just answered. `ImportPlan` has no field for one and cannot acquire one.
 *
 * ## Every stage that finds something STOPS the plan
 *
 * There is no partial import here and deliberately no flag to ask for one. A
 * refused config, a screened code point, an item carrying `valid_until` or two
 * files claiming one id each abandon the whole plan, with nothing written —
 * which is only a promise `planImport` can make because it writes nothing on
 * any path.
 *
 * ## The order `applyImport` writes in, and the one place it departs from the
 * plan document
 *
 * The plan's Task 12 lists the merged config as step 3, after the creates. It
 * cannot be: `createItem` resolves an item's category out of `ctx.config`
 * (`core/mutate.ts` · `function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {` · ~233),
 * so a pack that DEFINES a category — the half §6n.1 restored — would have
 * every one of its items refused as an unknown type before the config that
 * declares them was ever written. So the merged config is written and adopted
 * FIRST. The partial state that ordering leaves behind is also the readable
 * one: a category declared with no items yet is additive and harmless, where
 * items of a category nothing declares are a corpus whose types resolve
 * nowhere.
 *
 * **Creates still come before overwrites, and that IS the plan's ordering.** A
 * failure part-way through the overwrite pass leaves the new items landed and
 * the audit log showing exactly which overwrites completed, rather than a
 * corpus whose new half is missing and whose old half was rewritten. There is
 * no transaction here and inventing one would be a much larger change;
 * ordering the passes so that the partial state is the readable one is what
 * this codebase does everywhere else.
 *
 * ## Nothing in `identical` is applied
 *
 * The creator's explicit-id branch already treats identical content as a no-op
 * duplicate (`core/mutate.ts` · `      if (itemContentHash(existing) === hash) return duplicateOf(existing);` · ~579),
 * so re-running an import with nothing approved is idempotent by construction
 * rather than by a flag. Those ids are still MEMBERS of the pack — they are in
 * `imported` and in the import record — because `review promote --all --pack`
 * has to reach them; `created` is the narrower list of what this run wrote.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig, type Config } from '../core/config.ts';
import {
  createItem, updateItem,
  type CreateInput, type MutationContext, type UpdateInput,
} from '../core/mutate.ts';
import type { Item } from '../core/types.ts';
import { bucketise, type Buckets } from './collide.ts';
import { mergePackConfig, refusePackConfig, type RawConfigJson } from './config-io.ts';
import type { PackHistoryRecord, UnknownHistoryRow } from './history.ts';
import {
  quarantine, writeImportRecord, writeImportedHistory, type PackKey,
} from './imported-audit.ts';
import {
  comparePaths, HISTORY_NAME, IMPORT_RECORD_PROTOCOL, type ArtefactKind,
} from './layout.ts';
import type { Artefact, ArtefactFormat } from './reader.ts';
import { screenItem, screenPackMeta } from './screen.ts';

/**
 * The workspace's own `config.json`, spelled here rather than reached for out
 * of `layout.ts`: that module's `CONFIG_NAME` is the name of a file INSIDE an
 * artefact, and the two happening to be the same string is not a reason to let
 * one stand for the other.
 */
const WORKSPACE_CONFIG = 'config.json';

/** One field an item carried that this build will not store as it arrived. */
export interface NotCarried {
  /** The frontmatter spelling, or the section name — what a reader looks for. */
  field: string;
  /** How many items in the `new` bucket carry it. Never a count of all items. */
  items: number;
  /** What happens to it, as the report's own sentence completes it. */
  effect: string;
}

/** The corpus and the two configs a plan is computed against. */
export interface ImportAgainst {
  /**
   * The local corpus, by id. `null` for a miss — the spelling `Store.get` uses
   * (`core/store.ts` · `  get(id: string): Item | null {` · ~504). A predicate
   * written against `undefined` is never true here, so every item would fall
   * out of `new` and the plan would offer to import nothing.
   */
  existing: (id: string) => Item | null;
  /** The workspace's `config.json` as it is on disk. Merged into, never replaced. */
  rawConfig: unknown;
  /** ...and the same file resolved, which is what §6n.1's two branches read. */
  local: Config;
}

/**
 * What an import WOULD do, computed without writing anything.
 *
 * It carries the warning's whole content — the buckets, with `differs`,
 * `overwritable` and `blockedBy` already computed — so nothing downstream has
 * to recompute what the user was shown, and the text report and the `--json`
 * document cannot disagree about which items an approval covers.
 */
export interface ImportPlan {
  /** The pack's name, or `null` for a whole-workspace export, which has none. */
  pack: string | null;
  version: string | null;
  kind: ArtefactKind;
  /** The path as the caller typed it, so a message can quote what they typed. */
  source: string;
  format: ArtefactFormat;
  /**
   * What the manifest check found, carried so the report can state it.
   * `readArtefact` throws unless all three lists are empty, so on a plan this
   * function RETURNS `verified` equals `files` — the counts are what the report
   * renders and the lists are here for a caller that wants to print what was
   * checked.
   */
  manifest: {
    files: number;
    verified: number;
    missing: string[];
    extra: string[];
    mismatched: string[];
  };
  buckets: Buckets;
  /** Every id in the artefact, sorted. The four outcome lists partition it. */
  allIds: string[];
  config: {
    /** The category names the merge would write, sorted. */
    merged: string[];
    /** The top-level keys of the local config the merge does not touch. */
    untouched: string[];
    /** The merged `config.json`, computed and not written. */
    document: RawConfigJson;
    /**
     * ...and resolved, which proves a pack that DEFINES a category loads here
     * before anything is written, and is the config `applyImport` creates
     * against. Resolving in the pure half is what keeps that failure a refusal
     * rather than a half-built corpus.
     */
    resolved: Config;
  };
  history: {
    /** Rows this build can act on, in file order. Counted, not yet written. */
    records: PackHistoryRecord[];
    /**
     * Rows whose op this build has never heard of, each with the line of
     * `history.jsonl` it was read from. Wrapped, never rewritten.
     */
    unknown: UnknownHistoryRow[];
  };
  notCarried: NotCarried[];
}

/** The approval, and the three facts a record needs that the plan does not hold. */
export interface ImportOptions {
  /** What this workspace calls the pack: `--name`, or the manifest's own. */
  name: string;
  /** The path as the caller typed it, recorded verbatim in the import record. */
  source: string;
  /**
   * The same location RESOLVED, and the half of this import's key that the
   * pack did not choose.
   *
   * A name is a stranger's text and two packs may share one, so the name alone
   * never says which import a record belongs to; the caller has already
   * resolved this path in order to read the artefact, and passing it here is
   * what keeps a second `acme-security` from landing on the first one's
   * membership record. See `packDir` (pack/imported-audit.ts).
   */
  origin: string;
  /** Milliseconds since the epoch, injected — never read from the clock here. */
  now: number;
  /**
   * §6n.7's second act, and the only way an overwrite can happen. Required, not
   * optional: a defaulted `false` would let a call site overwrite by omission
   * the day somebody changed the default.
   */
  overwriteApproved: boolean;
}

/** What one import did. The four id lists partition `plan.allIds`. */
export interface ImportOutcome {
  /**
   * Every id this pack has in the corpus now: the ones created by this run,
   * plus the ones that were already here carrying the pack's own content.
   * Both are members — `review promote --all --pack <name>` reads the record
   * this list is written into.
   */
  imported: string[];
  /** The subset of `imported` this run actually wrote. Never inferred from it. */
  created: string[];
  /** The ids replaced under §6n.7. Empty unless `overwriteApproved` was true. */
  overwritten: string[];
  /** Changed ids left exactly as they were, because no approval was given. */
  overwriteSkipped: string[];
  /** Changed ids no write path can reach, skipped whether or not approved. */
  overwriteBlocked: string[];
  /** History rows filed under this pack's own directory. */
  historyRecords: number;
  /** Rows set aside under `.audit/imported/unknown/`, which the caller must report. */
  quarantined: number;
}

function refuse(sentence: string): never {
  throw new Error(`my_context: ${sentence}`);
}

/**
 * Several findings as one refusal, each on its own line.
 *
 * The individual sentences keep their own `my_context:` prefix: they are
 * written to be read one per line by the report, and stripping it here would
 * make the same sentence look different depending on which surface printed it.
 */
function refuseAll(headline: string, reasons: readonly string[]): never {
  throw new Error(`my_context: ${headline}\n${reasons.join('\n')}`);
}

/** `"a", "b" and "c"` — the ids a refusal names, never a bare count. */
function nameIds(ids: readonly string[]): string {
  const quoted = ids.map((id) => JSON.stringify(id));
  if (quoted.length === 1) return quoted[0];
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

/**
 * The ids two files in one artefact both claim, sorted.
 *
 * An artefact this product WRITES cannot hold one — a file's path is
 * `items/<type>/<id>.md`, so two items with one id are one file — but an
 * artefact is a stranger's directory and nothing about the format stops a hand
 * -written one from carrying two. Left alone, the second file's item would be
 * bucketed `new` beside the first, and the create for it would either throw
 * mid-apply on an occupied id or be swallowed as a duplicate, so one of the two
 * would vanish with nobody told.
 */
function duplicateIds(items: readonly Item[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) twice.add(item.id);
    seen.add(item.id);
  }
  return [...twice].toSorted(comparePaths);
}

/**
 * What a pack does not carry into the corpus as it arrived, counted over the
 * items that will actually be CREATED.
 *
 * Only the `new` bucket: an `identical` item is not written at all, and an
 * overwrite goes through `updateItem`, which touches neither of these fields.
 * Counting the whole artefact would report a drop that does not happen.
 *
 * `valid_from` is re-stamped because `CreateInput` has no such field and
 * `createItem` stamps it from today — which is honest, since the item is valid
 * HERE from today and the pack's own history carries the original dates.
 *
 * A ticked step is reported for a harder reason. `normalizeSteps`
 * (`core/validate.ts` · `export function normalizeSteps(steps: string[]): Step[] {` · ~614)
 * sets `checked: false` on every entry, and `checked` is part of the content
 * hash (`core/content-hash.ts` · `function canonicalStep(s: Step): Step {` · ~43),
 * so an arriving procedure with a ticked box lands unticked AND buckets
 * `changed` against its own pack on the next import — differing in `steps`,
 * which has no write path, so it is then reported as not overwritable forever.
 * That is a silent drop with a confusing second act, and the plan's field list
 * predates the `procedure` category, so it names only `valid_from`.
 */
function notCarriedFor(buckets: Buckets): NotCarried[] {
  const out: NotCarried[] = [];
  const restamped = buckets.new.filter((i) => i.validFrom !== null).length;
  if (restamped > 0) {
    out.push({ field: 'valid_from', items: restamped, effect: 're-stamped to today' });
  }
  const ticked = buckets.new.filter((i) => i.steps.some((s) => s.checked)).length;
  if (ticked > 0) {
    out.push({ field: 'ticked steps', items: ticked, effect: 'unticked' });
  }
  return out;
}

/**
 * An artefact, planned against the corpus that is already here.
 *
 * Pure: it opens nothing, creates nothing and stamps nothing. Every stage
 * below either produces a value or throws, and the throw is what "nothing was
 * half-applied" means on this side of the module.
 */
export function planImport(artefact: Artefact, against: ImportAgainst): ImportPlan {
  const { manifest, verification } = artefact;

  // 1. Manifest verification, already done by the reader and carried so the
  //    report can state what was checked rather than re-deriving it.
  const files = manifest.files.length;
  const verified = files - verification.missing.length - verification.mismatched.length;

  // 2. §6n.1. A pack DEFINING a category is legal here and is not a refusal; a
  //    pack RETIERING one is. The rule itself lives in `config-io.ts` and is
  //    asked rather than restated.
  const refusals = refusePackConfig(artefact.config, against.local);
  if (refusals.length > 0) {
    refuseAll(
      'this pack\'s config.json cannot be merged into this workspace, so nothing was imported '
      + 'and nothing was written:',
      refusals,
    );
  }

  // 3. The Unicode screen, over every item and over the two strings the pack
  //    carries about itself. A whole-workspace export has neither of those —
  //    `refuseMeta` makes `name` and `version` null for an export and non-null
  //    for a pack — and screening the empty string finds nothing, which is why
  //    this asks the screen rather than branching around it.
  const findings = [
    ...screenPackMeta(manifest.name ?? '', manifest.version ?? ''),
    ...artefact.items.flatMap((item) => screenItem(item)),
  ];
  if (findings.length > 0) {
    refuseAll(
      `${JSON.stringify(artefact.source)} carries ${findings.length} screened code point(s) and `
      + 'was not imported. Nothing here was normalised: the text is refused exactly as it '
      + 'arrived, so the bytes the manifest hashed are still the bytes on disk.',
      findings.map((f) => f.message),
    );
  }

  // 4. `valid_until` has no route through `CreateInput`, and dropping it turns
  //    an expired claim into a live one — `INV-nothing-is-dropped-silently`
  //    pointed at the one field where the silence is dangerous.
  const bounded = artefact.items.filter((i) => i.validUntil !== null).map((i) => i.id);
  if (bounded.length > 0) {
    refuse(`${bounded.length} item(s) in this artefact carry valid_until — ${nameIds(bounded)}. `
      + 'An imported item is created here, and creation has no route to that field, so importing '
      + 'them would turn a claim that has expired into one that has not. Nothing was imported. '
      + 'Remove the field, or let the items expire where they were written.');
  }

  // 4b. Two files claiming one id. See `duplicateIds` for why this cannot be
  //     left to `createItem` to discover half-way through the apply.
  const twice = duplicateIds(artefact.items);
  if (twice.length > 0) {
    refuse(`${JSON.stringify(artefact.source)} carries more than one item for `
      + `${nameIds(twice)}. An id names one item, and every count this import reports — what is `
      + 'new, what is identical, what an approval would replace — is taken per id, so a second '
      + 'item under the same one would be dropped with nobody told. Nothing was imported.');
  }

  // 5. The buckets, which is where `differs`, `overwritable` and `blockedBy`
  //    are computed. The plan carries them, so nothing downstream recomputes
  //    what the user was shown.
  const buckets = bucketise(artefact.items, against.existing);

  // 6. The config merge, computed and NOT written.
  const document = mergePackConfig(against.rawConfig, artefact.config);
  const packCategories = isObject(artefact.config) && isObject(artefact.config.categories)
    ? Object.keys(artefact.config.categories)
    : [];
  const untouched = isObject(against.rawConfig)
    ? Object.keys(against.rawConfig).filter((key) => key !== 'categories')
    : [];

  return {
    pack: manifest.name,
    version: manifest.version,
    kind: manifest.kind,
    source: artefact.source,
    format: artefact.format,
    manifest: {
      files,
      verified,
      missing: verification.missing,
      extra: verification.extra,
      mismatched: verification.mismatched,
    },
    buckets,
    allIds: artefact.items.map((i) => i.id).toSorted(comparePaths),
    config: {
      merged: packCategories.toSorted(comparePaths),
      untouched: untouched.toSorted(comparePaths),
      document,
      resolved: resolveConfig(document),
    },
    // 7. The history split, counted and not written.
    history: { records: artefact.history, unknown: artefact.unknownHistory },
    notCarried: notCarriedFor(buckets),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The create call for one arriving item.
 *
 * `status: 'draft'` is explicit and is NOT left to `trustedStatus`: that rule
 * demotes a non-human capture on the NORMATIVE tier only, so a rationale item
 * arriving `active` would stay active and govern nothing-reviewed. `origin:
 * 'ingest'` is the third member of a closed union and no fourth was invented
 * for imports — §6m.5 refused that carve-out.
 *
 * Provenance travels only for a full export. A pack has already had those
 * three fields cleared by the exporter, so passing them would be passing
 * `null` three times; an export is the author's own workspace travelling
 * whole, and dropping them there would lose the link to the file each item was
 * captured from.
 */
function createInputFor(item: Item, kind: ArtefactKind): CreateInput {
  const provenance = kind === 'export'
    ? {
      sourceFile: item.sourceFile,
      sourceAnchor: item.sourceAnchor,
      sourceChecksum: item.sourceChecksum,
    }
    : {};
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    status: 'draft',
    origin: 'ingest',
    severity: item.severity,
    always: item.always,
    scope: [...item.scope],
    tags: [...item.tags],
    extra: { ...item.extra },
    steps: item.steps.map((s) => s.text),
    observations: item.observations.map((o) => ({ ...o, tags: [...o.tags] })),
    relations: item.relations.map((r) => ({ ...r })),
    ...provenance,
  };
}

/**
 * The overwrite call for one approved `changed` entry — §6n.7.
 *
 * `origin: 'human'` is not a lie about authorship: `updateItem` never writes
 * `origin` onto the item, it reads it as the caller's claim about who is
 * taking this act, and a human took it one prompt ago. Without it the write is
 * refused outright on a governing normative item's gated fields and diverted
 * into a staged revision on its content, so §6n.7's "IS overwritten" would be
 * false for exactly the items it was written about.
 *
 * `status: 'draft'` is §6m.5 still holding: leaving an overwritten item active
 * would let pack content govern with no review at all.
 *
 * `extra` MERGES rather than replaces (`core/mutate.ts` ·
 * `  if (update.extra !== undefined) item.extra = { ...item.extra, ...update.extra };` · ~878),
 * so a key the local item carries and the pack does not survives the
 * overwrite. That is `updateItem`'s own semantics and this does not work
 * around them; the consequence is that such an item can still bucket `changed`
 * on the next import, which the report will say.
 */
function updateInputFor(item: Item): UpdateInput {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    scope: [...item.scope],
    tags: [...item.tags],
    severity: item.severity,
    always: item.always,
    extra: { ...item.extra },
    status: 'draft',
    origin: 'human',
  };
}

/**
 * Applies a plan to the workspace `ctx` is open on.
 *
 * The stages are in the order the module comment argues for: the merged config
 * first (because a create cannot resolve a category the config has not
 * adopted), then the creates, then the overwrite pass, then the history and
 * the quarantine, then the import record with the membership list.
 */
export function applyImport(
  ctx: MutationContext, plan: ImportPlan, options: ImportOptions,
): ImportOutcome {
  const stamp = new Date(options.now).toISOString();

  writeFileSync(
    path.join(ctx.root, WORKSPACE_CONFIG),
    `${JSON.stringify(plan.config.document, null, 2)}\n`,
    'utf8',
  );
  // The caller's own `Config` is left exactly as it was: it was resolved before
  // this pack was heard of, and silently mutating a caller's object is not how
  // this module tells it that the config moved. Every write below goes through
  // the merged one instead.
  const writing: MutationContext = { root: ctx.root, store: ctx.store, config: plan.config.resolved };

  const created: string[] = [];
  for (const item of plan.buckets.new) {
    const result = createItem(writing, createInputFor(item, plan.kind));
    // `createItem` has one path that returns an id other than the one it was
    // given: an item carrying both `source_file` and `source_anchor` whose
    // content already exists here under a different name is reported as
    // already captured (`core/mutate.ts` · `      message: \`my_context: already captured as ${anchored.id}. Nothing changed.\`,` · ~467).
    // Reachable only from a full export, and refused rather than absorbed: the
    // outcome's four lists are keyed on the pack's own ids, so quietly
    // substituting one would make every count in the report describe an item
    // the pack does not contain.
    if (result.id !== item.id) {
      refuse(`this artefact's ${JSON.stringify(item.id)} is already captured here as `
        + `${JSON.stringify(result.id)} — the same content, from the same source passage, under `
        + 'a different id. The two corpora allocated the id family differently and nothing here '
        + 'can decide which of them names the same item; that is a judgement about meaning. '
        + `Remove ${JSON.stringify(item.id)} from the artefact, or rename it.`);
    }
    created.push(item.id);
  }
  const imported = [...created, ...plan.buckets.identical.map((i) => i.id)];

  const overwritten: string[] = [];
  const overwriteSkipped: string[] = [];
  const overwriteBlocked: string[] = [];
  for (const entry of plan.buckets.changed) {
    const id = entry.incoming.id;
    // Blocked regardless of the approval, because `overwritable` is a fact
    // about the entry and not about what the user answered — an approval that
    // silently covered these would be the partial overwrite presented as a
    // whole one.
    if (!entry.overwritable) {
      overwriteBlocked.push(id);
      continue;
    }
    if (!options.overwriteApproved) {
      overwriteSkipped.push(id);
      continue;
    }
    updateItem(writing, updateInputFor(entry.incoming));
    overwritten.push(id);
  }

  // The ONE key this import is filed under, built once and handed to all three
  // writers: a history filed under one directory and a record under another is
  // a membership list that names items whose history is somewhere else.
  const key: PackKey = { name: options.name, origin: options.origin, source: options.source };

  writeImportedHistory(ctx.root, key, plan.history.records);
  const quarantined = quarantine(
    ctx.root, key, plan.history.unknown, HISTORY_NAME, stamp,
  );

  writeImportRecord(ctx.root, {
    protocol: IMPORT_RECORD_PROTOCOL,
    pack: options.name,
    version: plan.version ?? '',
    kind: plan.kind,
    source: options.source,
    origin: options.origin,
    importedAt: stamp,
    manifestFiles: plan.manifest.files,
    // The membership list, overwritten ids included: they are pack members
    // now, and `review promote --all --pack <name>` is how an overwritten item
    // that used to govern starts governing again.
    items: [...imported, ...overwritten],
    historyRecords: plan.history.records.length,
    quarantined,
  });

  return {
    imported,
    created,
    overwritten,
    overwriteSkipped,
    overwriteBlocked,
    historyRecords: plan.history.records.length,
    quarantined,
  };
}
