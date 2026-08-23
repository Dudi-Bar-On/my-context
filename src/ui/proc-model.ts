/**
 * The Procedures read model — the one-shot lifecycle, served READ-ONLY.
 *
 * The screen is `<section data-p="proc">` in `docs/design/web-ui-mockup.html`
 * and its 26 strings under the `pr.` prefix. It draws four things a server has
 * to answer: which procedure is being looked at, what STAGE it is in, "3 / 5
 * steps" with the steps themselves and their ticks, and a `procedure done`
 * command for the user to run. Everything else on that screen — the four-state
 * table, "Who may tick a box", the abandonment note — is prose from
 * `strings/en.js` and is not this module's to invent or to serve.
 *
 * **The domain model already existed, and this file reuses it rather than
 * re-deciding it.** `mycontext procedure [list|show|activate|done|step]`
 * (`cli/commands/procedure.ts`) owns the lifecycle; the two subcommands that
 * READ — `list` and `show` — are what these two routes answer. Every number
 * below comes from the function the CLI already calls:
 *
 *   | Fact                | Where it comes from                                      |
 *   |---------------------|----------------------------------------------------------|
 *   | which steps are done| `core/progress.ts` · `export function procedureProgress(records: AuditRecord[], itemId: string): Set<number> {` · ~88 |
 *   | records not read    | `core/progress.ts` · `export function unreadableProgress(records: AuditRecord[], itemId: string): number {` · ~102 |
 *   | the records         | `core/audit.ts` · `export function readAudit(root: string): AuditRecord[] {` · ~620 |
 *   | done vs abandoned   | `core/select.ts` · `export const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);` · ~397 |
 *   | is it injected      | `cli/commands/injection.ts` · `export function injection(` · ~84 |
 *
 * **What could NOT be reused, and it is a defect rather than a preference.**
 * `cli/commands/procedure.ts` imports the write surface at its third line
 * (`cli/commands/procedure.ts` · `import { updateItem }` · ~3),
 * because `activate` and `done` mutate. Measured: the import walk from that
 * module reaches `core/mutate.ts`, `core/relations.ts` and `core/revision.ts`.
 * So the module cannot be imported here at all, and the three things this file
 * needs out of it — the STAGE vocabulary, the `ready` tag that distinguishes
 * two of the stages, and the two disclosure sentences — are RE-SPELLED below
 * with the original cited beside each. That is a second spelling of a closed
 * vocabulary, which this project treats as a defect class; the fix is to lift
 * `stageOf`/`STAGES`/`READY_TAG` into a core module both sides import, and
 * that is a change to files this task does not own. **Reported, not made.**
 *
 * The citation above stops at the BINDING rather than quoting the whole import
 * line, and that is load-bearing rather than terse. `no-writes.test.ts`'s
 * raw-source guard scans for anything shaped like a relative module specifier
 * and requires the walk to have parsed a statement at that line — the one
 * direction the comment masker can fail is over-blanking, and a graph smaller
 * than the program makes every assertion in that file weaker than it reads.
 * A doc comment quoting a `from` clause with the mutation surface's own
 * relative path trips it, and the
 * assertion's own message refuses to guess which cause it is looking at:
 * *"a doc comment quotes an import line and this guard needs to learn about
 * it. Both need a human; neither is a pass."* Measured here on 2026-08-23 —
 * it failed exactly that way. Shortening the fragment costs the guard nothing
 * and keeps the citation resolvable; teaching it an exception would spend a
 * real check to buy back six characters of prose.
 *
 * ── READ-ONLY, AND WHAT THE IMPORT CHECK ACTUALLY SHOWED ───────────────────
 *
 * Nothing here writes and nothing here offers to. The settlement this screen
 * leads to — `mycontext procedure done <id>` — is composed in the browser and
 * pasted into the user's own shell, exactly as the Work and Configure screens
 * do; `pr.w3` is the reason in the product's own words: *"`active → done`
 * stays yours."* A route that closed a procedure would be the UI deciding a
 * thing the CLI deliberately refuses to let an agent decide.
 *
 * The domain half of this module's graph is CLEAN, measured rather than
 * asserted: walking `core/progress.ts`, `core/audit.ts`, `core/select.ts` and
 * `cli/commands/injection.ts` reaches 16 modules and NONE of `core/mutate.ts`,
 * `lesson/derive.ts`, `ingest/session.ts` or `mcp/tools.ts`.
 *
 * The `./read-model.ts` import is a different story and it is stated plainly
 * rather than left for a reader to discover: `read-model.ts` already reaches
 * `core/mutate.ts` by `help/index.ts` → `mcp/tools.ts`, and `ingest/session.ts`
 * by `doctor/checks.ts`. That is the pre-existing shape of the server's graph,
 * recorded in `test/ui/no-writes.test.ts`'s own header, and it is what
 * `read-model-work.ts` and `read-model-config.ts` already sit on top of. This
 * module adds no module to that graph — it takes three helpers (`withStores`,
 * `badRequest`, `unknownParams`) whose second spelling would be worse than the
 * edge. The ban that is actually enforced is per SYMBOL: no `src/ui/` module
 * may BIND a writer, and the only writer symbol this file names is none.
 *
 * ── NOTHING IS DROPPED SILENTLY ────────────────────────────────────────────
 *
 * FIVE facts about a procedure are true and invisible unless a response says
 * them out loud, so each is a `Disclosure` with a CODE beside the sentence —
 * the same shape `InjectionVerdict` uses for its gate, so a client can branch
 * on the code without matching on the prose. `DISCLOSURE_CODES` lists them and
 * each is justified where it is composed. A screen that renders the rows and
 * drops the disclosures has re-created the silent drop they exist to end.
 */
import { injection, type InjectionVerdict } from '../cli/commands/injection.ts';
import { readAudit } from '../core/audit.ts';
import { procedureProgress, unreadableProgress } from '../core/progress.ts';
import { RETIRED_STATUSES } from '../core/select.ts';
import type { Item, Status } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/** The category this endpoint set acts on, and the one it must refuse by name. */
const CATEGORY = 'procedure';
const NEAR_MISS = 'runbook';

/**
 * The tag that separates `proposed` from `ready`.
 *
 * A TAG and not a status, and the reason is not this module's to restate:
 * (`cli/commands/procedure.ts` · `const READY_TAG = 'ready';` · ~60) records
 * that a sixth `Status` would be §2.1's "index line only" decision taken
 * quietly. Re-spelled here only because that module cannot be imported.
 */
const READY_TAG = 'ready';

/**
 * The lifecycle stages, in the order the CLI's own table names them
 * (`cli/commands/procedure.ts` · `const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;` · ~97).
 *
 * **THERE ARE FIVE, AND THE MOCKUP'S TABLE HAS FOUR ROWS.** `pr.states` is
 * *"Four states, and exactly one of them injects"* and the table draws
 * `proposed`, `ready`, `active`, `done`. The fifth is not an invention here:
 * `pr.aband` is on the same screen and says *"Abandoned rather than finished
 * is `superseded`"*, so the screen knows the state exists and has no row for
 * it. Serving four and folding `superseded` into `done` would report an
 * abandoned procedure as a finished one — the exact silent-wrong-answer this
 * lifecycle exists to prevent — so all five are served and `stages` travels
 * with the list so a client can tell that it has been handed a stage its
 * static table cannot draw. **Which row the mockup grows is the owner's.**
 */
const STAGES = ['proposed', 'ready', 'active', 'done', 'abandoned'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * `status` (+ one tag) → stage. A re-spelling of
 * (`cli/commands/procedure.ts` · `function stageOf(item: Item): Stage {` · ~100),
 * kept line-for-line identical to it, including the ORDER of the tests:
 * `superseded` is checked before `RETIRED_STATUSES` because it is a member of
 * that set with a stage of its own. Abandoned is not done.
 *
 * The set is imported rather than re-listed, so the day a fourth retired
 * status is added this function moves with it — which is exactly the drift the
 * CLI's own comment refuses to hand-copy the set for.
 */
function stageOf(item: Item): Stage {
  if (item.status === 'superseded') return 'abandoned';
  if (RETIRED_STATUSES.has(item.status)) return 'done';
  if (item.status === 'active') return 'active';
  return item.tags.includes(READY_TAG) ? 'ready' : 'proposed';
}

/**
 * A fact that is true whether or not a response mentions it, paired with the
 * code a client branches on.
 *
 * The sentence is what a human reads and the code is a second FIELD off the
 * same branch — never a second reading of the corpus — which is the shape
 * `InjectionVerdict` chose for its gate and for the same reason: a screen that
 * grouped by matching on prose would break on a reworded sentence.
 *
 * **A disclosure is not a warning.** Every one of these is unconditionally
 * true of the row it is attached to; none of them is this module's opinion,
 * and none of them means anything is wrong.
 */
export interface Disclosure { code: DisclosureCode; message: string }

const DISCLOSURE_CODES = [
  'progress-is-workspace-scoped',
  'ready-is-not-injected',
  'unreadable-progress-records',
  'file-ticks-are-not-progress',
  'category-disabled',
] as const;
export type DisclosureCode = (typeof DISCLOSURE_CODES)[number];

/**
 * The limit that belongs beside every number these routes serve, VERBATIM from
 * the command that already prints it
 * (`cli/commands/procedure.ts` · `const WORKSPACE_SCOPE =` · ~185).
 *
 * Verbatim rather than reworded: two phrasings of one limit is two limits as
 * far as a reader can tell, and the browser cannot compose this sentence
 * because nothing in `strings/en.js` says it — **`pr.` has no key for it**, so
 * WHERE the screen prints it is an open question for the owner, and the server
 * sending it is what keeps the answer available when they rule.
 */
const WORKSPACE_SCOPE: Disclosure = {
  code: 'progress-is-workspace-scoped',
  message:
    'progress is recorded per workspace, not per session — two terminals on this workspace ' +
    'share one record set.',
};

/**
 * What a `ready` procedure does today, which is nothing — VERBATIM from
 * (`cli/commands/procedure.ts` · `  \`a ready procedure is not injected and not named in the index — the model does not learn it \`` · ~200).
 *
 * **THE MOCKUP'S TABLE SAYS OTHERWISE AND IT IS THE MOCKUP THAT IS WRONG.**
 * `pr.idx` is *"index line only"* against the `ready` row, and the shipped
 * selector does not do that: `isEligible` admits `active` only, so `buildIndex`
 * never enumerates a `ready` procedure and it reaches neither the injected
 * block nor an index line. Both facts are served — this sentence, and the
 * per-item `injection` verdict, which is computed by the function the hook
 * actually runs and will say `not injected` for that row. **A mockup change is
 * the owner's and needs a screenshot** (`RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change`),
 * so nothing here edits the table and nothing here quietly agrees with it.
 */
const READY_DISCLOSURE: Disclosure = {
  code: 'ready-is-not-injected',
  message:
    'a ready procedure is not injected and not named in the index — the model does not learn ' +
    'it exists until `mycontext procedure activate` runs. Nothing is lost: it is a draft, and ' +
    '`mycontext procedure list` is where it is visible.',
};

/** One procedure's replayed run. `total` is what the item declares TODAY. */
export interface ProcedureProgress {
  /** How many steps are ticked. The numerator of `pr.md`'s "{done} of {steps}". */
  done: number;
  /** `item.steps.length` — the denominator, re-read every request. */
  total: number;
  /**
   * Progress records in THIS run that this build could not read, counted in
   * neither direction. Non-zero means `done` is a count of the records that
   * parsed and not of the records that exist.
   */
  unreadable: number;
}

/** A row of the mockup's step table. */
export interface ProcedureStep {
  /** 1-based — the `<n>` `mycontext procedure step <id> <n>` takes. */
  n: number;
  text: string;
  /**
   * **Replayed from the audit log, NOT read from the file.** `pr.md` is the
   * screen's own words for why: *"is counted, never stored"*. The item on disk
   * carries a `checked` for every step too, and it is deliberately not this
   * field — see `file-ticks-are-not-progress`.
   */
  checked: boolean;
}

/** A row of `GET /api/procedures`, and the head of every detail response. */
export interface ProcedureSummary {
  id: string;
  /**
   * Served although the mockup's card draws the ID and has no string for a
   * title: the CLI's `list` prints one on every row, and no picker over more
   * than one procedure can work without it. **Where the screen puts it is an
   * open question** — the card's `h3` is `pr.item`, which is the id.
   */
  title: string;
  /**
   * The raw status `stage` is computed FROM, because that map is many-to-one:
   * `deprecated` and `validated` both read as `done`. Serving the derived
   * value alone would make it uncheckable and would lose which of the two a
   * finished procedure actually is.
   */
  status: Status;
  stage: Stage;
  /**
   * The real verdict from the real function — what this item does at a session
   * start under THIS config, not what the state table says it should.
   */
  injection: InjectionVerdict;
  progress: ProcedureProgress;
}

/** `GET /api/procedure/:id`'s procedure — a summary plus the steps. */
export interface ProcedureDetail extends ProcedureSummary {
  steps: ProcedureStep[];
  disclosures: Disclosure[];
}

/** How this config treats the one category with a lifecycle. */
export interface CategoryState {
  name: string;
  /** Whether this config declares it at all. */
  declared: boolean;
  /**
   * Whether it is switched on. `procedure` is in the `standard` profile and
   * NOT in `minimal` (`core/categories.ts` · `  procedure:     def('procedure', 'PROC', 'normative', true,` · ~58
   * and the `minimal` list beside it), so an empty list has two completely
   * different meanings and a screen must be able to tell them apart.
   */
  enabled: boolean;
}

export interface ProceduresBody {
  category: CategoryState;
  /** The five stages in lifecycle order — see `STAGES`. */
  stages: readonly Stage[];
  procedures: ProcedureSummary[];
  disclosures: Disclosure[];
}

export interface ProcedureBody { procedure: ProcedureDetail }

/** The summary half, shared by both routes so the two cannot drift. */
function summarize(item: Item, ws: Workspace, done: Set<number>, unreadable: number):
ProcedureSummary {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    stage: stageOf(item),
    injection: injection(item, ws.config),
    progress: { done: done.size, total: item.steps.length, unreadable },
  };
}

/**
 * `GET /api/procedures` — `mycontext procedure list`, as JSON.
 *
 * **Sorted by id, and grouped by nobody.** The CLI groups its output by stage
 * because a terminal has one column to print into; a client has a table and
 * the `stages` array to group with, and a server that pre-grouped would be
 * deciding a layout the mockup has not drawn. The sort is the CLI's own
 * (`cli/commands/procedure.ts` · `    .sort((a, b) => a.id.localeCompare(b.id));` · ~207),
 * so the two surfaces list the same corpus in the same order.
 *
 * **No cap, and that is a decision rather than an omission.** `/api/items`
 * serves every item uncapped for the same reason: the set is bounded by what a
 * human has captured, `INV-nothing-is-dropped-silently` would require the
 * truncation to be disclosed, and `pr.` has no string to disclose it with. If
 * a corpus is ever found where this matters, the answer is a `limit` parameter
 * with a `truncated` flag beside it — the shape `/api/search` already uses —
 * not a silent slice.
 *
 * **The corpus comes from the INDEX, and the CLI reads the Markdown.** Both
 * are the merged two-layer corpus with the project layer winning
 * (`core/rebuild.ts` · `const LAYER_ORDER: Layer[] = ['global', 'project'];` · ~435),
 * so the answers agree — except on a corpus whose files have moved since the
 * last rebuild, where this endpoint serves the indexed text. That is plan 1's
 * design decision 1, the server reads what the hooks read, and the staleness
 * is disclosed where every other reader learns it: `index_stale`, on
 * `/api/doctor`. It also costs no write lock, which is the property the CLI
 * chose `loadLayer` to protect in the first place.
 */
export function apiProcedures(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 404, body: { error: 'no workspace here' } };

  return withStores(ws, (store): JsonResult => {
    // ONE read of the log for the whole listing — `procedureProgress` is pure
    // and takes the records, which is what lets one read serve every row
    // (`core/progress.ts` · `// Everything here is PURE — no I/O, no clock, no workspace. The caller supplies` · ~18).
    //
    // A damaged log THROWS here and is allowed to, the way `/api/status` lets
    // a damaged revision log through: reporting `0 of 5` for a procedure whose
    // ticks this endpoint failed to read would hide a run behind a number that
    // looks like a fresh start.
    const records = readAudit(root);
    const procedures = store.all()
      .filter((i) => i.type === CATEGORY)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((item) => summarize(
        item, ws, procedureProgress(records, item.id), unreadableProgress(records, item.id),
      ));

    const category = ws.config.categories[CATEGORY];
    const disclosures: Disclosure[] = [];
    // Carried with its CONDITION and not asserted unconditionally, exactly as
    // the CLI carries it: a disabled-category sentence printed over a working
    // corpus teaches a limitation this project is not subject to.
    if (category === undefined || !category.enabled) {
      disclosures.push({
        code: 'category-disabled',
        message:
          `the "${CATEGORY}" category is ${category === undefined ? 'not declared' : 'disabled'} ` +
          'in this config, so this list is empty for that reason and not for want of ' +
          'procedures. It is in the "standard" profile and not in "minimal"; a per-category ' +
          `{ "${CATEGORY}": { "enabled": true } } switches it on and says which.`,
      });
    }
    if (procedures.some((p) => p.stage === 'ready')) disclosures.push(READY_DISCLOSURE);
    const unreadable = procedures.filter((p) => p.progress.unreadable > 0);
    if (unreadable.length > 0) {
      disclosures.push({
        code: 'unreadable-progress-records',
        message:
          `${unreadable.length} procedure(s) carry progress record(s) this build could not ` +
          'read, counted in neither direction: ' +
          `${unreadable.map((p) => `${p.id} (${p.progress.unreadable})`).join(', ')}. They were ` +
          'written by something that spelled the step differently; the counts above are of the ' +
          'records that parsed.',
      });
    }
    // Last, and unconditional — it qualifies every number above it.
    disclosures.push(WORKSPACE_SCOPE);

    const body: ProceduresBody = {
      category: {
        name: CATEGORY,
        declared: category !== undefined,
        enabled: category?.enabled ?? false,
      },
      stages: STAGES,
      procedures,
      disclosures,
    };
    return { status: 200, body };
  });
}

/**
 * `GET /api/procedure/:id` — `mycontext procedure show`, as JSON: the steps,
 * with the audit log's ticks laid over them.
 *
 * **Two different 404s, because they are two different facts.** "No such item"
 * and "that item is a `runbook`" send a client to two different places, and one
 * status carrying one sentence would leave it unable to tell a typo from a
 * category error. The refusal names the near miss when it IS the near miss,
 * for the reason the CLI's does: `runbook` and `procedure` is the confusion
 * people actually arrive with.
 *
 * **The boundary paragraph is deliberately NOT re-spelled here.** §6o requires
 * that "a runbook is repeatable, so it has no lifecycle" be statable in FOUR
 * places — `help categories`, two `examples` specimens, and the CLI's own
 * refusal (`cli/commands/procedure.ts` · `function categoryRefusal(item: Item): string {` · ~115).
 * A fifth wording of one idea is the defect `pr.aband` names in its own words
 * (*"a fifth spelling of one idea is the defect this project has paid for four
 * times"*), so this refusal states the category fact and points at the routes
 * that answer, and leaves the paragraph where it is worded. Reusing the real
 * one needs `categoryRefusal` exported or lifted to core — reported, not done.
 */
export function apiProcedure(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 404, body: { error: 'no workspace here' } };

  return withStores(ws, (store): JsonResult => {
    const item = store.get(params.id);
    if (item === null) {
      return {
        status: 404,
        body: {
          error:
            `no item with id ${JSON.stringify(params.id)}. /api/procedures lists the ` +
            'procedures in this corpus.',
        },
      };
    }
    if (item.type !== CATEGORY) {
      return {
        status: 404,
        body: {
          error:
            `${item.id} is a ${item.type}, not a ${CATEGORY}. This route serves ${CATEGORY} ` +
            `items only — /api/item/${item.id} serves this one` +
            (item.type === NEAR_MISS
              // Named, not explained: a `runbook` is the near miss, so a client
              // that lands here has confused the pair rather than mistyped an
              // id, and `mycontext help categories` is where the pair is
              // distinguished in the wording §6o fixed.
              ? ', and `mycontext help categories` is where the two are told apart.'
              : '.'),
        },
      };
    }

    const records = readAudit(root);
    const done = procedureProgress(records, item.id);
    const unreadable = unreadableProgress(records, item.id);
    const summary = summarize(item, ws, done, unreadable);

    const disclosures: Disclosure[] = [];
    if (summary.stage === 'ready') disclosures.push(READY_DISCLOSURE);
    if (unreadable > 0) {
      disclosures.push({
        code: 'unreadable-progress-records',
        message:
          `${unreadable} progress record(s) in this run could not be read by this build and ` +
          'are counted in neither direction. They were written by something that spelled the ' +
          'step differently; the count above is of the records that parsed.',
      });
    }

    // **The file's own `- [x]` is a SECOND place, and `pr.md` says there is
    // not one.** A step parses its checkbox out of the Markdown
    // (`core/item.ts` · `    const step: Step = { text: m[2]!, checked: m[1] === 'x' };` · ~233),
    // so `item.steps[i].checked` is a STORED tick that this endpoint — like
    // `mycontext procedure show`, which overlays it away — does not serve. Not
    // serving it is right: progress is the audit log's, and a file hand-edited
    // to `[x]` has recorded nothing. But discarding it in silence is precisely
    // the drop the invariant forbids, and the screen's own words (*"there is
    // no second place a procedure could disagree with itself"*) are not true
    // of the shipped parser. So the divergence is NAMED, with the steps that
    // diverge, and whether the answer is a mockup change, a parser change or a
    // `doctor` check is the owner's.
    //
    // **Only the steps where the two DISAGREE about the answer**, which means
    // the file ticks a box the log does not. The other direction is not a
    // divergence: a step ticked in the log and unticked in the file is the
    // normal, designed state of every procedure in progress — flagging it
    // would put this sentence on every card and teach nothing.
    const fileTicked = item.steps
      .map((step, i) => ({ n: i + 1, checked: step.checked }))
      .filter((s) => s.checked && !done.has(s.n));
    if (fileTicked.length > 0) {
      disclosures.push({
        code: 'file-ticks-are-not-progress',
        message:
          `the Markdown for ${item.id} ticks step(s) ` +
          `${fileTicked.map((s) => s.n).join(', ')} that the audit log does not, and the log is ` +
          'what is served: every box above is rendered from progress records, and a checkbox ' +
          'written into the file is not a progress record. Nothing was written either way.',
      });
    }
    disclosures.push(WORKSPACE_SCOPE);

    const body: ProcedureBody = {
      procedure: {
        ...summary,
        steps: item.steps.map((step, i) => ({ n: i + 1, text: step.text, checked: done.has(i + 1) })),
        disclosures,
      },
    };
    return { status: 200, body };
  });
}

/**
 * The two routes, for `server.ts` to call from inside `registerReadRoutes`.
 *
 * Registered here and NOT in `server.ts` for the two reasons that block
 * already records: `startUiServer` runs more than once per process in
 * `test/ui/server.test.ts`, so registration has to sit behind that function's
 * guard; and `server-e2e.test.ts` asks `registeredRoutes()` what the table
 * holds, so a route registered anywhere else would be invisible to its sweep.
 *
 * `/api/procedure/:id` cannot collide with `/api/procedures`: `routes.ts`
 * matches on segment COUNT first, and these differ. It also cannot collide
 * with `/api/item/:id`, whose second segment is a different literal.
 */
export function registerProcedureRoutes(): void {
  registerRoute('GET', '/api/procedures', {
    kind: 'json', handle: (ctx: ApiContext) => apiProcedures(ctx.ws, ctx.url),
  });
  registerRoute('GET', '/api/procedure/:id', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiProcedure(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
}
