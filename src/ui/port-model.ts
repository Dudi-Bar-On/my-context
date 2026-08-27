/**
 * The Export / import read model — the endpoint behind `<section data-p="port">`.
 *
 * **This screen describes an act; it never performs one.** Export writes files
 * and import writes items, so the two modules that would answer this screen
 * most directly are the two this server may not load: `pack/import.ts` binds
 * the mutation surface (`import.ts` · `  createItem, updateItem,` · ~63) and
 * `pack/imported-audit.ts` and `pack/dir-writer.ts` bind `writeFileSync`. What
 * is served instead is a DESCRIPTION of what an export would carry, plus the
 * argv of a command the reader pastes into their own shell — the settlement
 * pattern the Work and Configure screens already use (`lib/command.js`, which
 * composes and never runs). `test/ui/no-writes.test.ts` holds the import graph
 * to that; this comment is the rule and the test is only the gate on it.
 *
 * ## Why this is a server document and not markup
 *
 * Every value below is a constant of THIS BUILD, and that is the point rather
 * than an apology. The six rows of the "what travels" table, the audit kinds
 * that do and do not carry, the format rungs and the three import buckets are
 * facts the exporter owns. Typed into the page they would be a second copy
 * that agrees with `src/pack/` until the day one of them changes — the drift
 * this project treats as a defect class. Served from here, three of the four
 * are pinned to the defining module at COMPILE time and the fourth is derived
 * at request time, so a seventh audit kind or a third artefact format reaches
 * this screen without anyone editing a screen.
 *
 * What is deliberately NOT here is a preview: no row of the mockup's port
 * section renders a number, and `buildBundle` — which would produce exact
 * counts and writes nothing (`bundle.ts` · ` * Nothing here touches the filesystem except through the item loader, and` · ~11)
 * — would be a field no screen reads, which is itself a filed defect here
 * (plan:ui1 seq:17f). It stays available: `mycontext export --dry-run` prints
 * those numbers today, and wiring them in is one call if the owner wants them.
 */
import { AUDIT_KINDS, type AuditKind } from '../core/audit.ts';
import { SEEN_FILE_SUFFIX } from '../core/seen-file.ts';
import type { Workspace } from '../core/workspace.ts';
import type { Buckets } from '../pack/collide.ts';
import { CONFIG_NAME, HISTORY_NAME, IMPORTED_DIR, ITEMS_DIR, ROOT_FILES } from '../pack/layout.ts';
import type { ArtefactFormat } from '../pack/reader.ts';
import { badRequest, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The three chips the table draws, and the whole vocabulary of them
 * (`en.js` · `'port.yes': 'travels',` · ~414, `port.filtered` and `port.no`
 * beside it). A row is never assigned one directly: see `verdictOf`.
 */
export type PortVerdict = 'travels' | 'filtered' | 'rebuilt';

/** One row of `port.what` — a path in `.my_context/`, and what becomes of it. */
export interface PortRow {
  /** The workspace path, as the mockup's monospace cell spells it. */
  path: string;
  verdict: PortVerdict;
}

/**
 * One rung of `port.fmt`, in the mockup's own preference order.
 *
 * `built` is the load-bearing field and the reason this list has three
 * entries rather than two. The mockup draws three rungs and `en.js` ships
 * prose for all three, but the middle one does not exist in this release:
 * `ArtefactFormat` is a two-member union (`reader.ts` · `export type ArtefactFormat = 'dir' | 'zip';` · ~66)
 * and `--format` refuses anything else (`export.ts` · `const FORMATS: readonly ArtefactFormat[] = ['dir', 'zip'];` · ~83).
 * Serving two rungs to a screen that draws three would make the third row
 * fall back to whatever the page invented for it; serving three with a
 * `built` flag is the same fact with nothing dropped.
 */
export interface PortFormat {
  id: string;
  built: boolean;
}

/** An omission the screen must state. Same shape as `/api/config/check`'s `dropped`. */
export interface PortDisclosure {
  where: string;
  message: string;
}

export interface PortBody {
  travels: PortRow[];
  history: {
    /** Audit kinds that travel. */
    carries: AuditKind[];
    /** Every other kind this build has — derived, never listed by hand. */
    withheld: AuditKind[];
    /** Where a receiver's imported history lands, relative to `.audit/`. */
    importedDir: string;
  };
  formats: PortFormat[];
  /** The three collision buckets, pinned to `Buckets`' own keys. */
  buckets: string[];
  command: {
    /**
     * INCOMPLETE by construction: the destination is the user's and this
     * server does not invent one. See the `command.argv` disclosure.
     */
    argv: string[];
  };
  disclosures: PortDisclosure[];
}

/**
 * The rows, and the ONE fact each row actually asserts: where it lands inside
 * an artefact, or that it lands nowhere.
 *
 * The verdict is computed from `becomes` rather than written beside each path,
 * so no row can carry a chip that disagrees with what the exporter does with
 * it. Three of the four destinations are `pack/layout.ts`'s own constants, so
 * renaming `config.json` inside the artefact format renames it here too.
 *
 * **The three `becomes: null` rows are hand-written, and that is a real cost.**
 * `buildBundle` produces one file per selected item plus the three root files
 * and has no directory walk, so it knows what it assembled and cannot know
 * what the rest of `.my_context/` holds. The CLI carries the same fact in its
 * own words and its own list (`export.ts` · `const NOT_TRAVELLING = [` · ~101),
 * which is not exported — that module registers a command at import time, so
 * a read surface cannot borrow the list without loading the CLI. Two copies of
 * one fact is a defect; it is disclosed below rather than papered over, and
 * fixing it means moving the list somewhere both surfaces can read.
 */
const TRAVELS: readonly { path: string; becomes: string | null; filtered: boolean }[] = [
  { path: `${ITEMS_DIR}/**`, becomes: `${ITEMS_DIR}/`, filtered: false },
  { path: CONFIG_NAME, becomes: CONFIG_NAME, filtered: false },
  // `.audit/` is the one row with a filter between the source and the
  // destination, and `filtered` is what draws the third chip.
  { path: '.audit/', becomes: HISTORY_NAME, filtered: true },
  { path: '.index.db', becomes: null, filtered: false },
  { path: `state/*${SEEN_FILE_SUFFIX}`, becomes: null, filtered: false },
  { path: 'state/focus.json', becomes: null, filtered: false },
];

const verdictOf = (row: { becomes: string | null; filtered: boolean }): PortVerdict =>
  row.becomes === null ? 'rebuilt' : row.filtered ? 'filtered' : 'travels';

/**
 * The audit kinds that travel — one, and it is `exportableHistory`'s own
 * filter (`history.ts` · `  return filterAudit(readAudit(root), { kind: 'mutation' })` · ~447).
 *
 * The annotation is the pin: the day `AuditKind` stops having a `mutation`
 * member this file fails to compile, rather than serving a kind the filter no
 * longer names. Everything else is subtracted from `AUDIT_KINDS` at request
 * time, which is what makes this list correct for a build with a seventh kind
 * that nobody has thought of yet.
 *
 * That subtraction is not cosmetic. `port.hist` names three withheld kinds —
 * injections, hook actions and focus records — and this build has FIVE:
 * `access` (a refused web-UI request) and `progress` (a procedure step tick)
 * arrived after that sentence was written. `projectMutation`'s refusal already
 * lists all five in its own words, and this endpoint agrees with the code
 * rather than with the prose.
 */
const CARRIES: readonly AuditKind[] = ['mutation'];

/**
 * The format ladder. `dir` and `zip` are the shipped pair; `bundle` is the rung
 * §6n.6 decided against for v2.0 — dropped rather than deferred, with the
 * `--format` flag left in place so the rung costs one writer if it is ever
 * wanted (`2026-08-20-v2-export-import-and-packs.md` · `**§6n.6 drops the rung from v2.0 — decided, not recommended.**` · ~83).
 *
 * `FORMATS_EXHAUSTIVE` is the compile-time half: a third member added to
 * `ArtefactFormat` fails `tsc` here, which is the only moment this list is
 * wrong. It cannot be derived instead, because `ArtefactFormat` is a union and
 * `erasableSyntaxOnly` leaves a union with no runtime members to read — the
 * same problem `read-model-config.ts` solves the same way for `Tier`
 * (`read-model-config.ts` · `const TIERS = ['normative', 'rationale'] as const;` · ~42).
 */
type FormatsExhaustive = Exclude<ArtefactFormat, 'dir' | 'zip'> extends never ? true : never;
const formatsExhaustive: FormatsExhaustive = true;
void formatsExhaustive;

const FORMATS: readonly PortFormat[] = [
  { id: 'dir', built: true },
  { id: 'bundle', built: false },
  { id: 'zip', built: true },
];

/**
 * The three buckets an import sorts an artefact into, pinned to the interface
 * that defines them (`collide.ts` · `export interface Buckets {` · ~105).
 *
 * `collide.ts` itself is imported for its TYPE only and is therefore never
 * loaded — `verbatimModuleSyntax` erases the whole statement. That is not
 * squeamishness about `bucketise`, which is pure: it is that bucketing needs
 * an artefact to have ARRIVED, and reading a path a browser named is a
 * different surface with a different threat model. See the `buckets`
 * disclosure.
 */
const BUCKETS = ['new', 'changed', 'identical'] as const;
type BucketsExhaustive = Exclude<keyof Buckets, (typeof BUCKETS)[number]> extends never
  ? true : never;
const bucketsExhaustive: BucketsExhaustive = true;
void bucketsExhaustive;

/**
 * `mycontext export --out` — and it stops there, one argument short of a
 * command.
 *
 * The mockup's copy block shows a complete line with a dated destination, and
 * this endpoint will not supply one. The CLI refuses to default it in as many
 * words: there is no default because "an artefact written into whatever
 * directory the command happened to be run from is the one destination nobody
 * chose". A server that invented a plausible path would be handing the reader
 * a command that looks ready to run and writes somewhere they did not pick.
 *
 * The flag is `--out`. The mockup writes `--to`, which this parser refuses as
 * an unknown flag — reported in the disclosure, not silently corrected here,
 * because the mockup is not this module's to edit.
 */
const EXPORT_ARGV: readonly string[] = ['mycontext', 'export', '--out'];

/**
 * Every omission this response makes, named (`INV-nothing-is-dropped-silently`).
 *
 * Two of the six are computed rather than written, because a written one is
 * only accurate on the day it is written:
 *
 *   - the unaccounted root files, from `ROOT_FILES` minus the destinations the
 *     table names, so a fourth root file added to the artefact format appears
 *     here on its own;
 *   - the withheld audit kinds, counted from `AUDIT_KINDS`, so the sentence
 *     says five today and six the day a kind is added.
 *
 * The remaining four are this module's own wording. There is no sentence in
 * `src/` to reuse for them the way `/api/config` reuses `skippedKeyNotice`, so
 * they are worded once, here, beside the fact they are about.
 */
function disclosuresFor(withheld: readonly AuditKind[]): PortDisclosure[] {
  const named = new Set(TRAVELS.map((r) => r.becomes).filter((b) => b !== null));
  const unaccounted = ROOT_FILES.filter((f) => !named.has(f));

  const out: PortDisclosure[] = [];

  if (unaccounted.length > 0) {
    out.push({
      where: 'travels',
      message:
        `An artefact also holds ${unaccounted.join(', ')}, which no path in this table becomes: `
        + 'it is generated at export time rather than copied out of the workspace. The table '
        + 'answers "what happens to what I already have", so it has no row for it.',
    });
  }

  out.push({
    where: 'travels',
    message:
      'The three "rebuilt" rows are a hand-maintained list, not a derivation. The exporter '
      + 'assembles what travels and has no walk over what does not, so nothing in this build '
      + 'can enumerate the rest of .my_context/. The CLI preview prints the same fact from a '
      + 'second, differently worded list of its own; two copies of one fact is the drift this '
      + 'row exists to warn about.',
  });

  out.push({
    where: 'history',
    message:
      `${withheld.length} of this build's ${AUDIT_KINDS.length} audit kinds do not travel, and `
      + 'the screen prose names three of them. The full list is in `withheld` and is derived '
      + 'from the audit vocabulary itself, so it does not go stale when a kind is added.',
  });

  out.push({
    where: 'history',
    message:
      'The kind filter is not the only one. A mutation that names no item, or that names an '
      + 'item the export did not carry, does not travel either — history is joined to the '
      + 'items beside it, so an artefact never carries provenance for something it lacks.',
  });

  out.push({
    where: 'formats',
    message:
      'One rung is drawn and is not built. `built: false` says which; a screen that renders '
      + 'the row without reading that flag is offering a format --format refuses.',
  });

  out.push({
    where: 'buckets',
    message:
      'The bucket NAMES are served; the example ids beside them in the mockup are not, and '
      + 'cannot be. Sorting real ids into buckets needs an artefact to have arrived and to be '
      + 'read from a path, and this surface reads nothing a browser names. A screen that wants '
      + 'examples is showing illustrations, and should say so.',
  });

  out.push({
    where: 'command.argv',
    message:
      'The argv is one argument short: --out takes a destination and this server does not '
      + 'choose one, because the CLI refuses to default it and a plausible invented path is '
      + 'worse than an obviously incomplete one. The screen appends what the user supplies. '
      + 'Note the flag is --out; the mockup\'s copy block writes --to, which this command '
      + 'refuses as an unknown flag.',
  });

  return out;
}

/**
 * `GET /api/port` — what an export of this workspace would carry, what it
 * would leave behind, and the command that would do it.
 *
 * **404 off-workspace, matching `/api/config` and `/api/revisions`.** Outside
 * a workspace there is no corpus to describe the travel of, and answering with
 * the constants anyway would present a format document as an answer about a
 * project that does not exist here.
 *
 * No query parameters, so every one of them is refused: the mockup's port
 * section has no control on it, and a filter accepted here would answer a
 * narrower question than the one the screen asked.
 */
export function apiPort(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (ws.projectRoot === null) return { status: 404, body: { error: 'no workspace here' } };

  const carries = [...CARRIES];
  const withheld = AUDIT_KINDS.filter((kind) => !carries.includes(kind));

  const body: PortBody = {
    travels: TRAVELS.map((row) => ({ path: row.path, verdict: verdictOf(row) })),
    history: {
      carries,
      withheld,
      // `.audit/imported/` — the directory the collision report names and
      // `imported-audit.ts` writes into, taken from the constant both of them
      // share so a receiver is never sent to a directory spelled two ways.
      importedDir: `${IMPORTED_DIR}/`,
    },
    formats: FORMATS.map((f) => ({ id: f.id, built: f.built })),
    buckets: [...BUCKETS],
    command: { argv: [...EXPORT_ARGV] },
    disclosures: disclosuresFor(withheld),
  };
  return { status: 200, body };
}

/**
 * The wiring, in the shape `registerConfigRoutes` and `registerWorkRoutes`
 * present — `server.ts` calls it from inside its own guarded block and never
 * learns what path this model claims.
 *
 * Nothing calls this yet. Until `server.ts` does, `test/ui/no-writes.test.ts`
 * reports this module as "a route nobody wired", by name and on purpose: that
 * assertion exists to say exactly this out loud, and it is the merge step
 * rather than a defect in this file.
 */
export function registerPortRoutes(): void {
  registerRoute('GET', '/api/port', {
    kind: 'json', handle: (ctx: ApiContext) => apiPort(ctx.ws, ctx.url),
  });
}
