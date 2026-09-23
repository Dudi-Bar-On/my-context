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
 * refused config, a screened code point, an item carrying `valid_until`, two
 * files claiming one id, or an item whose category cannot hold it each abandon
 * the whole plan, with nothing written — which is only a promise `planImport`
 * can make because it writes nothing on any path.
 *
 * ## The pre-flight, and why it is the plan's job and not the apply's
 *
 * `createItem` refuses several things this module used to discover from inside
 * the apply loop: an `extra` key the item's own category does not declare
 * (`unknownExtraFieldError`, core/trust.ts), a type nothing declares, a type
 * this workspace has switched off. Each of those threw AFTER the merged config
 * had been written and after an arbitrary prefix of the pack had been created,
 * and the sentence it threw said "Nothing was written" — which was false of the
 * workspace by the time a person read it. `preflightCreates` asks the same
 * questions in the pure half, against the MERGED config (the one the creates
 * will actually run under), so the common failure is a refusal that names the
 * item and the field before a single byte moves.
 *
 * All three are knowable from the artefact and the catalogue alone, which is
 * the test for whether a rule belongs here: it is answerable without the corpus
 * and without a write. The category refusals are re-voiced in `resolveCategory`
 * (core/mutate.ts)'s own words rather than in new ones — see `categoryRefusal`.
 *
 * It cannot be complete, and is not pretended to be: `createItem` holds rules
 * that depend on the corpus as it is at the moment of the write, and mirroring
 * all of them here would be a second copy of the creator. What it covers is the
 * class a pack can carry — a stranger's frontmatter against this workspace's
 * catalogue. Everything it does not cover is caught by the disclosure below.
 *
 * ## The order `applyImport` writes in, and the one place it departs from the
 * plan document
 *
 * The plan's Task 12 lists the merged config as step 3, after the creates. It
 * cannot be: `createItem` resolves an item's category out of `ctx.config`
 * (`core/mutate.ts` · `function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {` · ~339),
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
 * ## ...and when a write fails anyway, the wreckage is named and reachable
 *
 * The config is written through a temp file and a rename, so no failure can
 * leave `config.json` half a document: after any crash the file is the old
 * bytes or the new bytes and nothing between. Everything after that write runs
 * inside `applyImport`'s one `try`, and a throw from any of it is re-voiced by
 * `refusePartial`: it says the config was adopted, names the ids that WERE
 * created and the ids that were not, says whether the history and the record
 * landed, and carries the original refusal as the last line and as `cause`.
 *
 * And before it rethrows it files the import record for what did land. That is
 * the half the report called unreachable: without a record `pack list` does not
 * name the pack, and because it does not, `review promote --all --pack <name>`
 * cannot reach the drafts that were created. A record naming exactly the ids in
 * the corpus is the route out, and it is written from the same `PackKey` the
 * successful path uses, so a re-import lands on it rather than beside it.
 *
 * ## Nothing in `identical` is applied
 *
 * The creator's explicit-id branch already treats identical content as a no-op
 * duplicate (`core/mutate.ts` · `if (itemContentHash(explicitExisting) === hash) return duplicateOf(explicitExisting);` · ~986),
 * so re-running an import with nothing approved is idempotent by construction
 * rather than by a flag. Those ids are still MEMBERS of the pack — they are in
 * `imported` and in the import record — because `review promote --all --pack`
 * has to reach them; `created` is the narrower list of what this run wrote.
 */
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig, type Config } from '../core/config.ts';
import {
  createItem, updateItem,
  type CreateInput, type MutationContext, type UpdateInput,
} from '../core/mutate.ts';
import { retryOnTransientFsError } from '../core/rebuild.ts';
import { enumError } from '../core/teach.ts';
import { unknownExtraFieldError } from '../core/trust.ts';
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
  /**
   * Whether the caller KEEPS what a failed import managed to write. Default
   * true, which is what `mycontext pack import` is.
   *
   * It exists because the partial-write disclosure ends with a route out —
   * `pack list` names the pack, `review promote --all --pack <name>` reaches
   * the drafts that landed — and that route is only real where the workspace
   * survives. `init --pack` is the surface where it is not: `cmdInit`
   * (cli/index.ts) removes the whole tree it had just created, so the two
   * commands would name a corpus that is no longer on disk, printed one line
   * above init's own accurate "nothing was created". So the caller says which
   * it is, and `refusePartial` prints the route only where there is one.
   *
   * **Required, like `overwriteApproved`.** It was optional for one round
   * (default: keeps), and the review of that round asked for this: a third
   * caller added later would inherit "keeps" by omission, and print a route
   * to a corpus it had just removed, with nobody having decided that. Every
   * caller says which it is. What is NOT conditional on it is the disclosure
   * itself: what was written and what was not is printed either way, because
   * that is the invariant and the route is only a convenience on top of it.
   */
  keepsPartialWrites: boolean;
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
 * (`core/validate.ts` · `export function normalizeSteps(steps: string[]): Step[] {` · ~722)
 * sets `checked: false` on every entry, and `checked` is part of the content
 * hash (`core/content-hash.ts` · `function canonicalStep(s: Step): Step {` · ~45),
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
 * One refusal's sentence without its prefix, so it can be carried INSIDE
 * another sentence that names the item it is about.
 *
 * `unknownExtraFieldError` is written to be thrown on its own and prefixes
 * itself; here it is the tail of a line that opens with the id, and a line
 * reading `my_context: "STD-x" — my_context: extra field …` is exactly what
 * STD-error-message-conventions forbids. The same re-voicing `refuseByResolver`
 * (pack/config-io.ts) does, and for the same reason.
 */
function bare(message: string): string {
  return message.replace(/^my_context:\s*/, '');
}

/** One item's refusal as a line of a `refuseAll`: the id, then the reason. */
function refusalFor(id: string, reason: string): string {
  return `my_context: ${JSON.stringify(id)} — ${bare(reason)}`;
}

/**
 * Whether this workspace can create an item of `type` at all, worded exactly as
 * `resolveCategory` (`core/mutate.ts` · `function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {` · ~339)
 * words it — the same `enumError` helper for the unknown case, and the disabled
 * sentence character for character.
 *
 * Reproduced rather than called because `resolveCategory` is private to the
 * creator, and re-voiced rather than re-invented because `init --pack` pins the
 * "You passed …" wording and a second phrasing for one refusal is the defect
 * `STD-error-message-conventions` exists about. The two must stay in step;
 * `test/cli/init-pack.test.ts` is what notices if they do not.
 *
 * `null` when the category is fine — the shape every check in this file uses.
 */
function categoryRefusal(merged: Config, type: string): string | null {
  if (!Object.hasOwn(merged.categories, type)) {
    const enabled = Object.values(merged.categories).filter((c) => c.enabled).map((c) => c.name);
    return enumError('type', type, enabled, 'categories');
  }
  if (!merged.categories[type].enabled) {
    return `my_context: category "${type}" is disabled in this project, so no new `
      + `${type} items are accepted. Enable it in .my_context/config.json under `
      + `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`;
  }
  return null;
}

/**
 * Whether the `extra` an item arrived carrying belongs to the category it will
 * be written under — `unknownExtraFieldError` (core/trust.ts), asked of the
 * MERGED catalogue.
 *
 * A type the catalogue does not declare answers `null` here and is the previous
 * function's question, not this one's: on the create path `categoryRefusal` has
 * already refused it, and on the overwrite path it is deliberately allowed
 * through, because that is `updateItem`'s own shape
 * (`core/mutate.ts` · `  if (input.extra !== undefined && Object.hasOwn(ctx.config.categories, item.type)) {` · ~1483)
 * — an item whose category was removed after capture is still updatable, and
 * refusing it here would refuse a write that would have gone through.
 */
function ownershipRefusal(
  merged: Config, type: string, extra: Record<string, string>, surface: 'capture' | 'edit',
): string | null {
  if (!Object.hasOwn(merged.categories, type)) return null;
  return unknownExtraFieldError(merged, merged.categories[type], extra, surface);
}

/**
 * Every arriving item this workspace could not create, asked BEFORE anything
 * is written.
 *
 * Against `merged` and never against the local config: the creates run under
 * the merged one (see `applyImport`), so a pack that DEFINES the category its
 * items belong to is asked about the category it brought with it, and not about
 * one this workspace has never heard of.
 *
 * Both questions, in `createItem`'s own order — the category first, because the
 * ownership question cannot be asked without one, and because that is the order
 * the creator asks them in. Every offending item is reported, not the first:
 * a pack fixed one refusal at a time is a pack imported one failure at a time.
 */
function preflightCreates(source: string, buckets: Buckets, merged: Config): void {
  const reasons: string[] = [];
  for (const item of buckets.new) {
    const refusal = categoryRefusal(merged, item.type)
      ?? ownershipRefusal(merged, item.type, item.extra, 'capture');
    if (refusal !== null) reasons.push(refusalFor(item.id, refusal));
  }
  if (reasons.length === 0) return;
  refuseAll(
    `${JSON.stringify(source)} carries ${reasons.length} item(s) this workspace cannot create, so `
    + 'nothing was imported and nothing was written — not the merged config.json, and not the '
    + 'items that would otherwise have landed ahead of these ones:',
    reasons,
  );
}

/**
 * The same question for the overwrites an approval has just made reachable —
 * and the reason it is asked in `applyImport` rather than in `planImport`.
 *
 * A plan is computed before the user is asked anything and is never told the
 * answer (see the §6n.7 note at the top of this module), so refusing here from
 * the plan would refuse an import that was about to succeed with the approval
 * withheld. `applyImport` is the first place the answer exists, and this runs
 * at the top of it — still before the config write, so "nothing was written"
 * stays true.
 *
 * `categoryRefusal` is deliberately NOT asked: an overwrite goes through
 * `updateItem`, which resolves no category at all, so a type this catalogue has
 * stopped declaring is a write that still lands. The category consulted is the
 * LOCAL item's, for the same reason — it is the one `updateItem` reads.
 */
function preflightOverwrites(plan: ImportPlan, overwriteApproved: boolean): void {
  if (!overwriteApproved) return;
  const merged = plan.config.resolved;
  const reasons: string[] = [];
  for (const entry of plan.buckets.changed) {
    if (!entry.overwritable) continue;
    const refusal = ownershipRefusal(merged, entry.existing.type, entry.incoming.extra, 'edit');
    if (refusal !== null) reasons.push(refusalFor(entry.incoming.id, refusal));
  }
  if (reasons.length === 0) return;
  refuseAll(
    `${JSON.stringify(plan.source)} carries ${reasons.length} approved overwrite(s) this `
    + 'workspace cannot apply, so nothing was imported and nothing was written — not the merged '
    + 'config.json, and not the new items that would otherwise have landed first:',
    reasons,
  );
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
  // Resolved ONCE, here rather than in the literal below, because step 6b asks
  // its questions of it: a second `resolveConfig` call would be a second answer
  // to "which catalogue do the creates run under", and the pre-flight has to be
  // holding the one `applyImport` will use.
  const resolved = resolveConfig(document);

  // 6b. The create pre-flight. Last of the refusing stages, because it needs
  //     both the buckets (only `new` is created) and the merged config.
  preflightCreates(artefact.source, buckets, resolved);

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
      resolved,
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
 * **No `kind` parameter, and no provenance fields, any more.** Both used to
 * exist for a full export: `source_file`/`source_anchor`/`source_checksum`
 * travelled only when `kind === 'export'`, because a pack has already had
 * those three fields cleared by the exporter. Ruling C (2026-09-21) closed
 * the only door a `kind: 'export'` plan could reach this function through —
 * `cmdImport` (cli/commands/pack.ts) and `planPack` (cli/index.ts) both
 * refuse on the artefact's `manifest.kind` before `planImport` runs — so the
 * branch was dead code with a parameter to match. Removed rather than kept
 * as an unreachable no-op: a function nobody can call with the value it
 * branches on is not documentation, it is a second place to wonder whether
 * the branch still matters.
 */
function createInputFor(item: Item): CreateInput {
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
 * `  if (update.extra !== undefined) item.extra = { ...item.extra, ...update.extra };` · ~2037),
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
 * **The one sentence every door a full export reaches says.** Ruling C
 * (2026-09-21, B10): a full export is an archive to copy back, not something
 * this product imports; `mycontext export --as-pack` is what writes something
 * that is.
 *
 * Self-contained — one sentence, no artefact path and no "nothing was
 * imported/created" tail. `cmdImport` (cli/commands/pack.ts), `planPack`
 * (cli/index.ts) and the MCP `preview_pack_import` tool (mcp/tools.ts) each
 * refuse on their own artefact's `manifest.kind === 'export'`, before
 * `planImport` runs, and each of the three completes it differently: an
 * import says nothing was imported, `init --pack` says nothing was created, a
 * preview says neither. A constant that tried to say all three would be
 * wrong on two of them; the path is context each caller already has (the
 * positional it was given), so repeating it here would be three surfaces
 * choosing three ways to quote one string instead of sharing one sentence.
 */
export const FULL_EXPORT_REFUSAL =
  'my_context: a full export is an archive to copy back, not something to import — '
  + '`mycontext export --as-pack` is what makes an importable pack.';

/**
 * The workspace's `config.json`, written so that no failure can leave it half a
 * document.
 *
 * Write-then-rename, which is what every other durable write in this codebase
 * does (`writeStagedRestore`, core/restore-store.ts; `writeItem`,
 * core/rebuild.ts): the bytes land under a name nothing reads, and the rename
 * is the single step that makes them the config. A crash, a full disk or a
 * killed process therefore leaves the OLD document or the NEW one, never a
 * truncated JSON file that the next `resolveConfig` refuses — which would take
 * the whole workspace down over an import that failed on one item.
 *
 * `retryOnTransientFsError` guards the rename for the Windows reason
 * `core/rebuild.ts` documents: `MoveFileEx` over an existing target fails with
 * `EPERM`/`EACCES`/`EBUSY` while a scanner or another process holds a handle.
 * The temp file is removed on failure, so a refused import leaves no litter
 * beside the config it did not change.
 */
function writeWorkspaceConfig(root: string, document: RawConfigJson): void {
  const file = path.join(root, WORKSPACE_CONFIG);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmp, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    retryOnTransientFsError(() => renameSync(tmp, file));
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best effort — the rename is what matters */ }
    throw err;
  }
}

/** What `applyImport` had actually done when something below it threw. */
interface Progress {
  created: string[];
  overwritten: string[];
  historyWritten: boolean;
  quarantineWritten: boolean;
  recordWritten: boolean;
}

/** `none` rather than an empty gap, so a list that is empty still reads. */
function idsOrNone(ids: readonly string[]): string {
  return ids.length === 0 ? 'none' : nameIds(ids);
}

/**
 * The refusal for an import that stopped after it had already changed the
 * workspace — `INV-nothing-is-dropped-silently`'s second half, which asks an
 * import that fails after a write to say exactly what was written and what was
 * not.
 *
 * It files the import record FIRST, and that is the point rather than tidiness.
 * Without one `pack list` does not name the pack, and because it does not,
 * `review promote --all --pack <name>` cannot reach the drafts that were
 * created — a half-applied pack with no command that names it. The record
 * carries exactly the ids that are in the corpus now, so the route out leads to
 * what is there and not to what was planned.
 *
 * Filing it can itself fail (it is a write, and a write is what just failed),
 * so it is best-effort and the message says which of the two answers it got.
 * The original error is the last line AND the `cause`: the sentence a person
 * reads must still name the rule that refused, and a caller that inspects
 * errors must still reach it.
 */
function refusePartial(
  ctx: MutationContext, plan: ImportPlan, options: ImportOptions, stamp: string,
  done: Progress, cause: unknown,
): never {
  const imported = [...done.created, ...plan.buckets.identical.map((i) => i.id)];
  const members = [...imported, ...done.overwritten];
  // A caller that discards what landed is not offered a record of it, and is
  // not told one exists: the record would be written inside the tree it is
  // about to remove — pointless, and on Windows one more open handle in the
  // way of the `rmSync` that has to succeed for its own message to be true.
  const keeps = options.keepsPartialWrites;
  let filed = done.recordWritten;
  if (keeps && !filed) {
    try {
      writeImportRecord(ctx.root, {
        protocol: IMPORT_RECORD_PROTOCOL,
        pack: options.name,
        version: plan.version ?? '',
        kind: plan.kind,
        source: options.source,
        origin: options.origin,
        importedAt: stamp,
        manifestFiles: plan.manifest.files,
        items: members,
        // What is on disk, not what was planned: a record claiming rows that
        // were never filed would send `pack list` looking for them.
        historyRecords: done.historyWritten ? plan.history.records.length : 0,
        quarantined: done.quarantineWritten ? plan.history.unknown.length : 0,
      });
      filed = true;
    } catch {
      filed = false;
    }
  }

  const unwritten = plan.buckets.new.map((i) => i.id).filter((id) => !done.created.includes(id));
  const reason = cause instanceof Error ? cause.message : String(cause);
  const route = filed
    ? 'my_context: WHERE TO GO: the pack is filed under the name above, so `mycontext pack list` '
      + `names it and \`mycontext review promote --all --pack ${JSON.stringify(options.name)}\` `
      + 'reaches the drafts that did land. Re-running the import after fixing the artefact '
      + 'treats what is already here as identical or changed, and says which.'
    : 'my_context: WHERE TO GO: the import record could NOT be written either, so `mycontext '
      + 'pack list` will not name this pack and `review promote --all --pack` cannot reach the '
      + 'drafts above. They are in the corpus under the ids named here and can be promoted one '
      + 'at a time.';
  // The headline says what is true on the surface that is printing it. A caller
  // that discards what landed prints its own account of the disk one line
  // below, and "this workspace WAS changed" above "nothing was created" is two
  // sentences a reader has to reconcile for us.
  const headline = keeps
    ? `my_context: this import of ${JSON.stringify(options.name)} stopped part-way, and this `
      + 'workspace WAS changed — it is not the case that nothing happened.'
    : `my_context: this import of ${JSON.stringify(options.name)} stopped part-way, after it had `
      + 'already written. What it had written by then is listed below, so the account of what is '
      + 'on disk now can be read against it.';

  throw new Error([
    headline,
    `my_context: WRITTEN: config.json now holds the merged configuration${plan.config.merged.length > 0
      ? ` (it declares ${nameIds(plan.config.merged)})` : ''}; `
    + `${done.created.length} of ${plan.buckets.new.length} new item(s) were created as drafts `
    + `(${idsOrNone(done.created)}); ${done.overwritten.length} overwrite(s) completed `
    + `(${idsOrNone(done.overwritten)}); the pack's history was `
    + `${done.historyWritten ? 'filed' : 'NOT filed'}; its unreadable rows were `
    + `${done.quarantineWritten ? 'quarantined' : 'NOT quarantined'}`
    + `${keeps ? `; the import record was ${filed ? 'filed' : 'NOT filed'}` : ''}.`,
    `my_context: NOT WRITTEN: ${unwritten.length} item(s) the pack carries (${idsOrNone(unwritten)}).`,
    // The route out, only where there is one to offer.
    ...(keeps ? [route] : []),
    `my_context: WHAT REFUSED: ${reason}`,
  ].join('\n'), { cause });
}

/**
 * Applies a plan to the workspace `ctx` is open on.
 *
 * The stages are in the order the module comment argues for: the approved
 * overwrites pre-flighted (before any write, because that is where the approval
 * first exists), then the merged config (because a create cannot resolve a
 * category the config has not adopted), then the creates, then the overwrite
 * pass, then the history and the quarantine, then the import record with the
 * membership list. Everything from the config write on is inside one `try`, so
 * that a failure in any of it is disclosed rather than reported as if nothing
 * had happened.
 */
export function applyImport(
  ctx: MutationContext, plan: ImportPlan, options: ImportOptions,
): ImportOutcome {
  const stamp = new Date(options.now).toISOString();

  preflightOverwrites(plan, options.overwriteApproved);

  writeWorkspaceConfig(ctx.root, plan.config.document);
  // The caller's own `Config` is left exactly as it was: it was resolved before
  // this pack was heard of, and silently mutating a caller's object is not how
  // this module tells it that the config moved. Every write below goes through
  // the merged one instead.
  const writing: MutationContext = { root: ctx.root, store: ctx.store, config: plan.config.resolved };

  const done: Progress = {
    created: [], overwritten: [],
    historyWritten: false, quarantineWritten: false, recordWritten: false,
  };
  try {
    return applyStages(ctx, writing, plan, options, stamp, done);
  } catch (err) {
    refusePartial(ctx, plan, options, stamp, done, err);
  }
}

/**
 * The write stages, split out so `applyImport` holds the `try` and this holds
 * the order. `done` is written as each stage completes and is what the refusal
 * above reads — a stage that threw has not recorded itself, so the disclosure
 * cannot claim a write that did not happen.
 */
function applyStages(
  ctx: MutationContext, writing: MutationContext, plan: ImportPlan,
  options: ImportOptions, stamp: string, done: Progress,
): ImportOutcome {
  const created = done.created;
  for (const item of plan.buckets.new) {
    // `createItem` has one path that returns an id other than the one it was
    // given: an item carrying both `source_file` and `source_anchor` whose
    // content already exists here under a different name is reported as
    // already captured (`core/mutate.ts` · `      message: \`my_context: already captured as ${anchored.id}. Nothing changed.\`,` · ~951).
    // Those two fields no longer travel through `createInputFor` at all — see
    // its own comment — because the only plan that ever carried them was a
    // full export's, and ruling C (2026-09-21) refuses a full export before
    // it reaches here. So the mismatched-id refusal that used to stand here
    // — naming the other id and asking which corpus was right about it — no
    // longer has an artefact that can reach it. Removed rather than left to
    // rot: INV-nothing-is-dropped-silently is about a live silence, not a
    // branch nothing can still walk into.
    createItem(writing, createInputFor(item));
    created.push(item.id);
  }
  const imported = [...created, ...plan.buckets.identical.map((i) => i.id)];

  const overwritten = done.overwritten;
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
  done.historyWritten = true;
  const quarantined = quarantine(
    ctx.root, key, plan.history.unknown, HISTORY_NAME, stamp,
  );
  done.quarantineWritten = true;

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
  done.recordWritten = true;

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
