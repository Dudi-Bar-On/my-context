/**
 * The Template packs read model (web-UI plan 2, `plan:api` seq:4) — the endpoint
 * behind `<section data-p="packs">`.
 *
 * ## What this endpoint is allowed to be
 *
 * Importing a pack is a WRITE, and this server performs none. So the screen is
 * served two things and never a third: a DESCRIPTION of the packs already
 * present in this workspace, and a description of what importing one would do
 * — the rules, asked of the functions that enforce them, rather than restated
 * here. The settlement itself is a command the user runs in their own shell,
 * composed in the browser (`lib/command.js`) exactly as the Work and Configure
 * screens do. Nothing in this module, or reachable from it, mutates anything;
 * `test/ui/no-writes.test.ts` holds the import graph to that.
 *
 * **The one thing this screen cannot have, named rather than quietly missing.**
 * `planImport` (`pack/import.ts` · `export function planImport(artefact: Artefact, against: ImportAgainst): ImportPlan {` · ~307)
 * is PURE — it opens nothing, creates nothing and stamps nothing, and it is
 * exactly the function that could answer "what would importing THIS artefact
 * do to THIS corpus": the three buckets, the config merge, the not-carried
 * fields. It cannot be reached from here. Its module binds `createItem` and
 * `updateItem` at runtime
 * (`pack/import.ts` · `  createItem, updateItem,` · ~63), so importing it puts
 * `core/mutate.ts` into the server's graph — the same refusal `read-model.ts`
 * already makes about the `cli` help topic
 * (`ui/read-model.ts` · ` * not**: it reaches \`core/mutate.ts\`, so serving that one topic would put the` · ~3078).
 * A per-artefact preview is therefore REPORTED as unreachable rather than
 * approximated by a second bucketing written in here, which would be a copy of
 * `collide.ts`'s rule free to disagree with the one the import actually runs.
 *
 * ## Why there is a live half at all, when the mockup draws none
 *
 * The mockup's packs section is four cards of prose and one example command:
 * it lists no pack. But `mycontext pack list` exists and answers "which packs
 * are here, and what state are their items in", which is the screen's own
 * trust story — `pk.trustn`'s "so it waits for you" — measured on this corpus
 * instead of asserted. Served without it this screen is an explainer with a
 * copy button, which is the judgement `/api/help/:topic` already made about
 * its own screen ("built without it, this screen is a documentation viewer and
 * should be cut"). The prose halves are still served, because each of them is
 * a claim the BUILD owns and the page would otherwise hard-code — see
 * `carries` and `landing` below.
 *
 * ## Two screens, one plan
 *
 * The task pairs this with Export / import (`<section data-p="port">`) and asks
 * for one route rather than two. `carries` and `artefact` below are shared
 * facts — the same artefact format, the same protocol — but the port screen's
 * other rows (`.audit/` filtered, `.index.db` rebuilt, the dir/bundle/zip
 * preference) are `pack/bundle.ts`'s and belong to an export model this task
 * does not own. What is shared is served once, here; what is not is reported.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { TOP_LEVEL_KEYS, type Config } from '../core/config.ts';
import { normalizeForSlug } from '../core/slug.ts';
import type { Item, Status } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { refusePackConfig } from '../pack/config-io.ts';
import { importedDir, readImportRecords, type ImportRecord } from '../pack/imported-audit.ts';
import { comparePaths, MANIFEST_NAME, PACK_PROTOCOL, UNKNOWN_PACK_DIR } from '../pack/layout.ts';
import { MANIFEST_MEANING } from '../pack/manifest.ts';
import { badRequest, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/* -------------------------------------------------------------------------- *
 * 1. What a pack may carry — the mockup's `pk.what` card, ASKED not restated.
 * -------------------------------------------------------------------------- */

/**
 * The top-level keys a workspace `config.json` may hold, which is the domain
 * the `pk.what` table is drawn over — THE LOADER'S OWN LIST, imported.
 *
 * It used to be a hand-typed `CONFIG_KEYS` pinned to `keyof Config` minus
 * `skippedKeys`, because `TOP_LEVEL_KEYS` was module-private in `core/config.ts`
 * and there was nothing to import. That pin caught one direction: a `Config`
 * field missing from the copy failed `tsc`, and a key added to the loader's
 * list that `Config` does not carry slipped past it — this table would then
 * have been drawn over four of the loader's five keys, which is the silent drop
 * this project bans arriving through a screen instead of through a file.
 *
 * The `Exclude` pin goes WITH the copy rather than being re-aimed at the
 * import. It exists to catch a `Config` field with no key in the list, and the
 * loader's own `resolveConfig` is what would now be wrong in that case, not
 * this table; asserting it from a read model would be this file holding open a
 * property of a module it only reads. `skippedKeys` is the loader's OUTPUT
 * rather than a key a file may write
 * (`core/config.ts` · `   * The top-level keys this build did not understand, in the order the file` · ~557),
 * and it was never a member of `TOP_LEVEL_KEYS`, so nothing has to subtract it
 * here any more.
 */

/** One row of the `pk.what` table: may a pack's `config.json` carry this key? */
export interface CarriesRow {
  key: string;
  travels: boolean;
  /** The refuser's own sentences, verbatim. Empty exactly when `travels`. */
  refusals: string[];
}

/**
 * The `pk.what` table, computed by the function that will actually refuse.
 *
 * `refusePackConfig` is asked once per key with a config carrying ONLY that
 * key, and its answer is the row. That is the same discipline
 * `/api/config/preview` follows — *"every answer below being computed by the
 * function that will actually run"* — and it matters more here than there,
 * because the rows the mockup draws are not merely a table: `pk.line` is a
 * paraphrase of the refusals themselves. `refuseTopLevel`'s `budgets` sentence
 * says budgets are *"a fact about your machine and your context window rather
 * than knowledge about the author's domain"*
 * (`pack/config-io.ts` · `      \`Budgets decide how much of YOUR corpus reaches a session, which is a fact about your \` +` · ~378);
 * `pk.line` says *"never a setting that describes you — your context budget or
 * your repository layout"*. Serving the refusal means the screen and the CLI
 * cannot come to say different things about the same boundary.
 *
 * **The probe value is `{}` for every key, and it is not arbitrary.**
 * `refusePackConfig` decides a non-`categories` key on its NAME alone — the
 * value is never consulted — and `{ categories: {} }` is a legal empty
 * vocabulary that produces no refusal. So one probe shape answers all five
 * without any of them needing a plausible fixture invented for it.
 *
 * **All five keys, not the two the mockup draws.** The set is the loader's, and
 * a table filtered to the rows somebody had already thought of is the silent
 * drop this project bans, arriving through a screen instead of through a file.
 * The screen renders one row per entry, so nothing here is a field no screen
 * reads. `items/**` is deliberately NOT a row: it is not a config key, and "a
 * pack's items travel" is a restatement of what a pack IS rather than a fact
 * this module could measure.
 *
 * `local` is this workspace's resolved config because §6n.1 is asked against
 * the vocabulary that is really here — a pack may define a category and may not
 * re-tier one this build already has, and only the local config knows which is
 * which. The five keys above never reach that branch, but passing a fabricated
 * config so that they could not is how the answer stops being the real one.
 */
function carriesFor(local: Config): CarriesRow[] {
  return TOP_LEVEL_KEYS.map((key) => {
    const refusals = refusePackConfig({ [key]: {} }, local);
    return { key, travels: refusals.length === 0, refusals };
  });
}

/* -------------------------------------------------------------------------- *
 * 2. Where an imported item lands — the mockup's `pk.trust` card.
 * -------------------------------------------------------------------------- */

/**
 * The status an item has after each of the two import routes.
 *
 * **Both are `draft`, and the mockup says one of them is `active`.** The
 * screen's table pairs `init --pack` with `pk.active` and `pack import` with
 * `pk.draft`, and `pk.trustn` argues the split at length — *"choosing a pack at
 * init is itself the act of trust"*. The build does not do that. There is ONE
 * import implementation behind both surfaces, its create input hard-codes the
 * status (`pack/import.ts` · ` * \`status: 'draft'\` is explicit and is NOT left to \`trustedStatus\`: that rule` · ~414), and `init`'s own
 * refusal text says so in words: *"everything a pack brings in still lands
 * `draft`, governing nothing until you promote it"*
 * (`cli/index.ts` · `    '--yes: there is no confirmation on this command to answer. \`init --pack\` creates the ' +` · ~183).
 * `mycontext pack list` prints the same sentence about every pack it lists
 * (`cli/commands/pack.ts` · `      'Everything a pack imported landed as a draft. \`mycontext review promote --all --pack '` · ~652).
 *
 * So this serves what the code does, and the disagreement is REPORTED rather
 * than reconciled here: a read model that echoed the mockup would be telling a
 * user their corpus is governed by something that governs nothing, and a read
 * model that edited `strings/en.js` would be deciding a product question from
 * inside an endpoint. Which of the two is wrong is the owner's ruling.
 *
 * **This constant is a mirror, and the only kind of mirror available.** The
 * literal it mirrors is an argument inside a private function, so there is
 * nothing to import and nothing to pin it to beyond `Status` — which catches a
 * renamed member of the union and nothing else. `satisfies` is what makes even
 * that much fail loudly.
 */
const LANDING = {
  initPack: 'draft',
  packImport: 'draft',
} as const satisfies Record<'initPack' | 'packImport', Status>;

/* -------------------------------------------------------------------------- *
 * 3. The artefact's own facts — the mockup's `pk.man` card.
 * -------------------------------------------------------------------------- */

/**
 * What this build can state about an artefact without holding one.
 *
 * `meaning` is `MANIFEST_MEANING`, VERBATIM, and carrying it is a duty rather
 * than a convenience — the same duty `/api/config` discharges by carrying
 * `skippedKeyNotice`'s sentence instead of composing its own. That constant
 * exists *"so that the CLI, the import report and both READMEs say it the same
 * way"* (`pack/manifest.ts` · `export const MANIFEST_MEANING =` · ~124), and
 * `pk.theatre` is the fifth surface saying it. Its two halves may not travel
 * apart, so nothing here splits it.
 *
 * **Three of the mockup's four rows are NOT here, and each absence has the same
 * cause: there is nothing to read.** `pk.m1n` ("`sha256`, full, per file,
 * sorted") is true of `buildManifest`, and the algorithm is a literal inside it
 * with no exported name; `pk.m2n` (a descriptive version, never parsed) and
 * `pk.m3n` (a curated list in the docs, no registry) are statements about what
 * this product does NOT do, and an absence has no value to serve. Serving a
 * hand-written `"sha256"` here would be a second place the algorithm is
 * written down, free to disagree with the one that hashes. Those three rows
 * stay strings on the page; that they are strings is reported, not hidden.
 */
const ARTEFACT = {
  protocol: PACK_PROTOCOL,
  manifest: MANIFEST_NAME,
  meaning: MANIFEST_MEANING,
} as const;

/* -------------------------------------------------------------------------- *
 * 4. The packs that are actually here.
 * -------------------------------------------------------------------------- */

/** One pack imported into this workspace, joined to the corpus as it is now. */
export interface PackRow {
  /** The name it was filed under — what `review promote --all --pack` matches. */
  name: string;
  /** Descriptive, never parsed. `''` for an export imported under `--name`. */
  version: string;
  kind: string;
  /** The path as the importer typed it, recorded verbatim. */
  source: string;
  importedAt: string;
  manifestFiles: number;
  items: {
    /** Every id this import placed here — the membership list's own length. */
    total: number;
    /** The statuses those ids hold NOW, over the ones still in the corpus. */
    byStatus: Record<string, number>;
  };
  /** Members no longer in the index, named. `byStatus` sums to `total` minus these. */
  missing: string[];
  historyRecords: number;
  quarantined: number;
}

/**
 * A membership record, joined to the live index.
 *
 * The join is the whole live half of this screen: `pk.draft` is a chip on a
 * mockup, and *"11 of 12 still draft"* is the same claim about this corpus. It
 * is taken over the record's `items` list rather than by scanning the corpus
 * for something pack-shaped, because there is nothing pack-shaped to scan for —
 * an imported item carries no tag saying where it came from, deliberately: a
 * tag *"would have changed the items' content hashes, which would have made
 * every one of them `changed` against the pack it came from on the next
 * import"* (`pack/imported-audit.ts` · ` * \`review promote --all --pack <name>\` reads it. A tag would have changed the` · ~424).
 * The record IS the membership, and this reads the same list `review promote
 * --all --pack` reads.
 *
 * **`missing` is named and not merely counted, and it is not capped.** An id in
 * the membership list that no longer resolves is an item that was superseded,
 * renamed or removed after the import — a fact about this corpus that a bare
 * count cannot be checked against, which is why the config preview names its
 * affected items too ("17 items" is a number a reader has to trust). No cap is
 * applied because a cap would be a truncation to disclose, and the list is
 * already bounded by one import's own membership.
 *
 * **`byStatus` carries only the statuses present**, which is `/api/status`'
 * shape for the same tally; a zero invented for the other four would be this
 * module deciding which statuses a screen should draw.
 *
 * **`name` is served EXACTLY as the record holds it, and it may hold anything.**
 * Reported here and not fixed here. `screenPackMeta` exists for precisely these
 * two strings — its own words are that they are *"the strings every surface
 * prints WITHOUT the item beside them — a pack list, a confirmation prompt, an
 * import record"*
 * (`pack/screen.ts` · ` * every surface prints WITHOUT the item beside them — a pack list, a` · ~319)
 * — and `planImport` does run it over the MANIFEST's name and version
 * (`pack/import.ts` · `    ...screenPackMeta(manifest.name ?? '', manifest.version ?? ''),` · ~333).
 * But `pack import --name <text>` overrides the manifest's name AFTER the plan
 * has been screened (`cli/commands/pack.ts` · `    const name = override ?? plan.pack;` · ~541),
 * and nothing re-checks the override. Measured, not inferred: importing with
 * `--name` holding U+202E RIGHT-TO-LEFT OVERRIDE exits 0 and writes the control
 * character into `import.json`'s `pack` field verbatim, and so does a `--name`
 * holding a newline — which `refusePackName` refuses on the manifest path
 * because such a name *"is printed as ONE line ... so a newline or a carriage
 * return inside it forges a second line of a report the reader is relying on"*
 * (`pack/manifest.ts` · `    return \`${lead} ${json(v)} contains a control character. It is printed as ONE line in the \`` · ~306).
 * Screening on this READ path would be the wrong repair: these packs are already
 * in the corpus, and a finding here could only refuse to serve one, which hides
 * a pack instead of naming a bad name. The boundary is where the override is
 * accepted. The screen this feeds must treat `name` as untrusted text.
 */
function packRow(record: ImportRecord, status: Map<string, Status>): PackRow {
  const byStatus: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of record.items) {
    const found = status.get(id);
    if (found === undefined) { missing.push(id); continue; }
    byStatus[found] = (byStatus[found] ?? 0) + 1;
  }
  return {
    name: record.pack,
    version: record.version,
    kind: record.kind,
    source: record.source,
    importedAt: record.importedAt,
    manifestFiles: record.manifestFiles,
    items: { total: record.items.length, byStatus },
    // Sorted with the one comparator, over UTF-8 bytes — the order `items` is
    // already written in, so a reader comparing the two lists is comparing
    // them in one order rather than in two.
    missing: missing.toSorted(comparePaths),
    historyRecords: record.historyRecords,
    quarantined: record.quarantined,
  };
}

/** One thing this response could not report, and where it was. */
export interface Dropped { where: string; message: string }

/**
 * `readImportRecords`' own silence, made visible.
 *
 * That function *"skips rather than reports"* a directory under
 * `.audit/imported/` with no `import.json` in it
 * (`pack/imported-audit.ts` · ` * A directory with no \`import.json\` is skipped rather than reported: the` · ~559),
 * and its reasoning is right for the question IT answers — the quarantine
 * directory is one such, and so is a pack directory left behind by an import
 * that failed before its record was written. Neither is a pack that was
 * imported.
 *
 * But this screen answers a wider question — *"what is in this workspace"* —
 * and a half-imported pack's directory sitting there with a history file in it
 * and no membership record is precisely the state a user needs told about:
 * nothing will ever offer to promote those items, and `pack list` will never
 * mention them. So the directory is walked a second time here and every entry
 * that produced no record is disclosed by name. That is
 * `INV-nothing-is-dropped-silently` applied to a drop this module did not make
 * and does inherit.
 *
 * The quarantine directory is excluded because it is not a pack and never was
 * (`pack/layout.ts` · `export const UNKNOWN_PACK_DIR = 'unknown';` · ~97); what
 * it holds is already reported per pack as `quarantined`.
 *
 * **DIRECTORIES only, and that is not a shortcut.** A pack's records live in a
 * directory `packDir` makes, so a directory is the only shape a half-imported
 * pack can leave behind. The one non-directory entry that is always there is a
 * `.gitignore` this build writes itself
 * (`core/jsonl-log.ts` · `  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');` · ~95),
 * and reporting it as a pack whose record is missing would be a disclosure
 * that is wrong every single time — which is how a disclosure stops being read.
 *
 * A pack's directory name is `normalizeForSlug` of its name — the same mapping
 * `packDir` makes — so the recorded set is compared as slugs rather than as
 * names. A missing directory is not an error and yields nothing: it is the
 * same "no packs here" `readImportRecords` answers with an empty array.
 */
function droppedFrom(root: string, records: readonly ImportRecord[]): Dropped[] {
  const recorded = new Set(records.map((r) => normalizeForSlug(r.pack)));
  const dir = importedDir(root);
  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name !== UNKNOWN_PACK_DIR && !recorded.has(name))
    .toSorted(comparePaths)
    .map((name) => ({
      where: path.join(dir, name),
      message:
        `this directory sits under .audit/imported/ and carries no import.json, so it names no `
        + `pack that was imported: \`mycontext pack list\` does not show it and `
        + `\`mycontext review promote --all --pack\` cannot reach whatever it holds. An import `
        + `that failed before its record was written leaves exactly this.`,
    }));
}

/** `GET /api/packs`' body. */
export interface PacksBody {
  packs: PackRow[];
  dropped: Dropped[];
  landing: typeof LANDING;
  carries: CarriesRow[];
  artefact: typeof ARTEFACT;
}

/**
 * `GET /api/packs` — the packs present in this workspace, and what importing
 * one would do.
 *
 * **A corrupt or version-skewed import record THROWS, and is allowed to.** That
 * is `readImportRecords`' ruling, in its own words: such a record *"is refused
 * rather than skipped: a pack missing from this list is a pack whose items
 * nothing would offer to promote"*
 * (`pack/imported-audit.ts` · `        + '(it may have been written by a different version). It is refused rather than skipped: '` · ~523).
 * It reaches the client as the server's 500 carrying that sentence. The
 * alternative — a field, the way `/api/config` carries `parseError` — is right
 * there and wrong here: that endpoint exists to help a user fix the file it is
 * reporting on, and this screen cannot fix an import record. `/api/status`
 * makes the same call about a damaged revision log for the same reason.
 *
 * **No paging, no cap, no filter.** Every record `readImportRecords` returns is
 * carried, in the order it files them, `kind: 'export'` records included — an
 * export imported under `--name` is a member of this list and hiding it would
 * be a filter with no disclosure. `dropped` is the only place this response
 * admits to a gap, and it is non-empty only when the imported directory holds
 * something no record accounts for.
 */
export function apiPacks(ws: Workspace, url: URL): JsonResult {
  // An empty allow-list subsumes `repeatedParams`: with nothing accepted, a
  // repeat of nothing is refused already. This endpoint takes no arguments —
  // there is no artefact path to name, for the reason the module comment gives.
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 404, body: { error: 'no workspace here' } };

  return withStores(ws, (store): JsonResult => {
    // `store.all()` once, into an id → status map: a per-record `store.get`
    // would ask the index once per member of every pack, and the join below is
    // the only thing either read is for.
    const status = new Map<string, Status>(store.all().map((i: Item) => [i.id, i.status]));
    const records = readImportRecords(root);
    const body: PacksBody = {
      packs: records.map((record) => packRow(record, status)),
      dropped: droppedFrom(root, records),
      landing: LANDING,
      // `ws.config` and not a second read of the file spelled here: `carries`
      // describes the rules an import would be judged by, and `ws.config` IS
      // the file as THIS request read it. There is no boot-time config left to
      // be behind — `liveWorkspace` re-resolves `config.json` once per request
      // and hands that one answer to every route
      // (`src/ui/server.ts` · `const now = live.now();` · ~1160).
      //
      // The behaviour this line always wanted is unchanged and so is the
      // reason for it: ONE config answers one page. What changed is how old
      // that config is — a moment, not a boot. A re-read spelled here would be
      // a second read microseconds after the request's own, and two configs
      // answering one page is still worse than one that is a moment old.
      carries: carriesFor(ws.config),
      artefact: ARTEFACT,
    };
    return { status: 200, body };
  });
}

/**
 * Registration, for `server.ts` to call from `registerReadRoutes` beside
 * `registerConfigRoutes` and `registerWorkRoutes`. Nothing here is registered
 * by importing this module — the route table is one contended block and the
 * wiring is the caller's.
 */
export function registerPacksRoutes(): void {
  registerRoute('GET', '/api/packs', {
    kind: 'json', handle: (ctx: ApiContext) => apiPacks(ctx.ws, ctx.url),
  });
}
