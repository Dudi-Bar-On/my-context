/**
 * `nav.ev` — **Ask**, `<section data-p="ask">` in the design of record: one
 * card holding a tab strip, ONE filter row, four canned queries, the SQL the
 * server composed, a three-column result table, and a disclosure above the
 * table and one below it.
 *
 * ── THE PROMISE, AND WHY IT IS THE SERVER'S AND NOT THIS FILE'S ───────────
 *
 * `ask.sub` says *"bound as parameters, composed on the server. No query text
 * crosses the wire"*, and `ask.sqlCaption` says the pane holds *"the SQL this
 * answer ran"*. Both are properties of the ENDPOINTS. The statement is built
 * by `corpusSelect` / `filterSelect` and travels back beside the rows it
 * produced
 * (`src/ui/ask-model.ts` · `` `sql` and `params` travel with the rows because the screen SHOWS them, `` · ~181),
 * so this module composes no SQL and cannot drift from what ran: it picks a
 * field, an operator and a value, sends them as query parameters, and renders
 * what came back. The pane is filled from `body.sql` and nothing else — never
 * from a template here, never kept from a previous answer.
 *
 * ── WHERE EACH PART COMES FROM ────────────────────────────────────────────
 *
 *   - **The corpus tab** is `GET /api/ask/corpus` — a read-only `Store` over
 *     the index, which NEVER rebuilds it. That is what `ask.updatedAtTrap`
 *     warns about and why the note hangs on this tab alone.
 *   - **The audit tab** is `GET /api/ask/audit` — the projection, read through
 *     the read-only door
 *     (`src/ui/watch-model.ts` · `export function readProjection<T>(root: string, read: (db: ProjectionHandle) => T): ProjectionRead<T> {` · ~166).
 *     Three answers reach this screen: `fresh` (it answers), `absent` (200,
 *     no records — an empty state, not a fault) and a 503 naming the state for
 *     `behind` / `diverged` / `damaged`. All three are drawn, differently.
 *   - **The four canned queries** are `GET /api/ask/summary` — `summaryByOp`,
 *     `topItems` and `sessions`, whose rows are `{ label, count, last }`
 *     (`src/core/audit-db.ts` · `export interface SummaryRow { label: string; count: number; last: string | null }` · ~764).
 *   - **The value vocabularies** are DERIVED — see `learn` below for the four
 *     sources and for what no endpoint serves.
 *
 * ── THE MOCKUP'S DESIGN, NEVER ITS BEHAVIOUR ──────────────────────────────
 *
 * Four of its arrangements are scaffolding for a problem this app does not
 * have, and are not reproduced. Each is the same shape as `screens/watch.js`'s
 * `#wrowparts` note: the mockup declares strings as MARKUP and scans the
 * document for `data-t`, so anything it wants translated has to exist in the
 * document at load; `ctx.t()` returns fresh nodes on every call, so here the
 * declaration IS the call.
 *
 *   1. **Two field selects and two value selects, both in the markup, toggled
 *      by `hidden`.** One of each is built here and repainted per tab.
 *   2. **`#qv` is filled with `AUDIT_KINDS` once and never repainted**, so the
 *      mockup offers record kinds as the value list for `op`, `origin` and
 *      `item` too. Here the value list follows the field.
 *   3. **The audit value select has no empty option.** `(any)` is offered on
 *      BOTH tabs: the filter row must be able to ask the unfiltered question —
 *      it is this screen's landing state — and a derived vocabulary can be
 *      empty, which would leave a select with nothing in it at all.
 *   4. **`renderQ` cycles three sample states on click.** The three selects run
 *      the three states are reached by the data, and all three are drawn.
 *
 * ── FIVE THINGS THE DESIGN ASKS FOR THAT NO ENDPOINT SERVES ───────────────
 *
 * Named here and in this task's report rather than papered over:
 *
 *   1. ~~**`is not`**~~ — **SERVED SINCE 2026-08-26, and the entry is kept
 *      because what it used to say is the argument for what replaced it.** It
 *      read: neither builder emits `<>`, so on the three fields with a CLOSED
 *      vocabulary the negation is sent as the other member's equality, and
 *      everywhere else the option is disabled rather than silently sent as
 *      `is`. That was honest about the substitution and wrong about the
 *      remedy — a control that greys out on nine fields of twelve and says
 *      nothing is a defect of its own, which is what `plan:walk seq:36`
 *      reported. Both builders negate for real now, `is not` is offered on
 *      every field, and the request carries a FIELD NAME to negate rather than
 *      an operator (`src/ui/ask-model.ts` · `  negate?: 'type' | 'status' | 'layer' | 'always' | 'scoped' | 'titleContains';` · ~93).
 *   2. **The canned queries as "a shortcut THROUGH the same filter fields".**
 *      Three of the four are aggregates (`GROUP BY`), and the filter row has no
 *      aggregate to fill. They call `/api/ask/summary` — a second way in, which
 *      the mockup's own comment rejects — and that endpoint returns no `sql`,
 *      so the pane has nothing true to show and the card is not drawn beside
 *      them. They do feed the filter row's vocabulary, which is the only part
 *      of the mockup's sentence this build can keep.
 *   3. **A column for `count`.** The design's three columns are At · Kind ·
 *      What (they were At · Item · Role until 2026-08-29 — see `AUDIT_FIELDS`
 *      below for the ruling), and a report named "Operations by count" answers
 *      with a count. It is drawn INSIDE the chip that closes the What cell
 *      (`12 spilled`, the shape `screens/coverage.js` already gives a count
 *      plus a literal) rather than dropped.
 *   4. **`ask.truncated` on the audit tab.** Only `corpusSelect` binds the
 *      probe row — `params.push(f.limit + 1)`; `filterSelect` binds the cap
 *      itself, so a capped audit answer is indistinguishable from a complete
 *      one and this screen never claims otherwise. `ask.sqlCaption`'s sentence
 *      about the final `LIMIT` is therefore true of the corpus tab only.
 *      **This got sharper on 2026-08-29 rather than going away**: the fetch
 *      cap is now a control, so a reader can raise the audit tab's limit from
 *      200 to 2,000 — and still cannot be told whether that was enough. The
 *      remedy is one line in `core/audit-db.ts` (`filterSelect` binding
 *      `limit + 1` the way `corpusSelect` does, and `queryProjection` dropping
 *      the probe), which is a file this task does not own. It is in the report.
 *   5. **A sentence for a projection that is not `fresh`.** No key declares
 *      one. The server's own word is drawn as a literal chip, which is the
 *      treatment a record kind and a tier already get
 *      (`src/ui/public/screens/watch.js` · `const state = el('span', 'chip warn', String(volume.projectionState));` · ~670).
 *
 * ── TWO WAYS PAST A CAP, AND THEY ANSWER DIFFERENT QUESTIONS ──────────────
 *
 * The owner's report of 2026-08-29: *"ask corpus has a limit parameter but it
 * could not be changed, either add capability to set the limit or paging
 * buttons."* Both were built, because they are not alternatives:
 *
 *   - **Paging** (`boundedList`, `BOUND_CAP_TABLE`) answers *"show me the rest
 *     of what you already have"*. It costs no request: the whole answer is in
 *     hand and a page is a re-render, which is the condition
 *     `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held` sets on
 *     every bounded list in this product. Before it, an audit answer of 200
 *     records drew 986 rows in one table — one row per item a record names —
 *     with no bound line and nothing to say how far down the reader was.
 *   - **The fetch cap** (`ask.limit`, `LIMIT_STEPS`) answers *"go and get
 *     more"*, which no amount of paging can. A reader at the end of 100 corpus
 *     rows under `ask.truncated` — *"more matched; raise the limit to see
 *     them"* — was being told to move a control that did not exist.
 *
 * **The cap is NOT a `filterFields` entry, and that is the one design question
 * this task had to answer.** `limit` is in `apiAskCorpus`' `unknownParams`
 * allow-list beside `type`, `status` and the rest, so it would have fitted the
 * filter machinery mechanically. It does not fit it in meaning: every entry of
 * that list is a COLUMN a reader narrows the corpus by, spelled as (field,
 * operator, value) and negatable. A cap has no operator — "limit is not 100" is
 * not a question — no vocabulary to learn, and it does not narrow the corpus at
 * all; it bounds the ANSWER. Rendered as a filter it would read as one, which
 * is a claim about which rows matched.
 *
 * **`boundedList` fitted the table with one addition, `order: 'position'`.**
 * The host is the `<tbody>` and the bound line goes under the `<table>` — the
 * arrangement `screens/injected.js` already uses for the same reason (a `<div>`
 * is not a legal child of a table). What did not fit was the ORDER sentence:
 * the four surfaces before this one bound lists this app itself ordered, and
 * this table's order is the server's `ORDER BY` and differs per tab. See
 * `orderKeyFor` in `screens/parts.js`.
 *
 * **The design of record gained the cap control and the fourth state sentence;
 * it did NOT gain the `div.bound` block, and that is a deliberate asymmetry.**
 * `e2e/screen-parity.spec.ts`'s `ask` ledger is the list of kinds the MOCKUP
 * draws and the app does not, it is exact, and *it may only shrink*. In the run
 * that ledger was measured from, this screen's projection refuses and no table
 * is drawn at all — `table`, `tbody`, `tr`, `td`, `caption` are all in it — so
 * a `div.bound` in the mockup would enter that ledger as a NEW gap and its
 * entry would have to be written into a spec file this task does not own.
 * `boundedList` is a shared part the mockup already draws five times, and one
 * more use of it by the app is an app-only kind, which that gate cannot see and
 * `APP_ONLY_KINDS_ON_ASK` is the existing prose note for. The two genuinely new
 * PRESENTATION decisions — a labelled cap select in the filter row, and a
 * fourth `#qstate` sentence — are in the mockup, and the app follows them.
 *
 * ── NO `innerHTML`, NO `style` ATTRIBUTE ──────────────────────────────────
 *
 * Both for the reasons `screens/parts.js` sets down: assigning markup destroys
 * the `.m` spans that carry `unicode-bidi:isolate`, and the server sends
 * `style-src 'self'` with no `'unsafe-inline'`. Every declaration the mockup
 * writes as an attribute is set through CSSOM here, with logical properties.
 */
// `clockOf` — the At column, `09:26:05`. It used to live here and be exported
// only because this screen's own test imported it; it now lives beside `num()`
// with the Audit stream's copy folded into it, because both audit tables draw
// the SAME records from the same log and were reading them through two
// different parse guards. `parts.js` carries the guard and the argument.
import {
  BOUND_CAP_TABLE, boundedList, clockOf, el, errorNote, linkId, mono, num, screenHead, spaced,
} from '/screens/parts.js';

/**
 * **ONE LIST PER TAB — every field the tab knows, whether a reader can FILTER
 * on it, and which COLUMN shows it. The filter select and the table's headers
 * are both derived from this, and neither is written down a second time.**
 *
 * Until 2026-08-29 there were two lists: `AUDIT_FIELDS`, which fed the filter
 * select, and a literal `['th.at', 'th.item', 'th.role']` in `render()`, which
 * fed the header row. They disagreed, and the disagreement WAS the defect
 * `plan:walk seq:73` reports. `kind` and `op` — the two fields that say what a
 * record IS — were in the filter list and in neither column, so the audit
 * history drew a timestamp and two em dashes 498 times and a reader could not
 * tell a subagent stopping from a credential being refused. Both dashes were
 * honest: a `hook` row is a session-lifecycle event and an `access` row is a
 * credential refusal, and neither is about an item. An honest dash is still
 * useless if nothing beside it says what the row is.
 *
 * Two hand-kept lists of one thing is the failure `lib/live-invalidation.js`'s
 * header is an essay on and `lib/palette-defs.js` names in one line — *"a
 * hand-kept list… is a defect waiting to happen"*. So a field is declared once
 * and the declaration answers both questions at once: adding one to the select
 * forces an answer about where it is DRAWN, and adding a column is not
 * expressible without a field to fill it.
 *
 * `filter: false` is the entry a reader sees and cannot query — the timestamp
 * every row has, and the corpus id. `column: null` is the converse and is
 * written down rather than omitted, for `live-invalidation.js`'s reason:
 * *"nothing invalidates me" is a legal and common answer, and it is
 * indistinguishable from "nobody thought about this" unless it is written
 * down.* `origin` and the four corpus flags are filterable and undrawn on
 * purpose — each would spend a column, on every row, on a value a reader
 * narrows BY rather than scans; the What cell already carries the op and the
 * item, which are what a record is and what it is about.
 *
 * **`column` is not a per-KIND table and must never become one.** This screen
 * declares `kinds: '*'` in `lib/live-invalidation.js` because its subject IS
 * the log; a column set enumerating the seven members of `AUDIT_KINDS` would
 * be the same staleness one layer up, blank on the eighth. Nothing below names
 * a kind: `kind` and `op` are drawn as the record's own words, whatever they
 * are.
 *
 * The audit field names are drawn as LITERALS — product vocabulary is never
 * translated here, the same ruling `screens/watch.js` makes for a record kind
 * and `screens/parts.js` makes for a tier, and the mockup draws those four as
 * bare options for exactly that reason. The corpus field names are prose and
 * are keyed.
 *
 * A field name IS its query parameter, on both tabs — `type`, `status`,
 * `layer`, `always`, `scoped`, `title` and `kind`, `op`, `origin`, `item` are
 * spelled identically in `apiAskCorpus`' and `apiAskAudit`'s `unknownParams`
 * allow-lists. There is no mapping table here on purpose: a second spelling of
 * ten names is how the screen and the endpoint come to disagree about one.
 * `at` and `id` below are the two entries that are NOT parameters, which is
 * exactly what `filter: false` says about them.
 */
const AUDIT_FIELDS = [
  { name: 'at', filter: false, column: 'at', label: null },
  { name: 'kind', filter: true, column: 'kind', label: null },
  { name: 'op', filter: true, column: 'what', label: null },
  { name: 'origin', filter: true, column: null, label: null },
  { name: 'item', filter: true, column: 'what', label: null },
];
const CORPUS_FIELDS = [
  { name: 'updated_at', filter: false, column: 'at', label: null },
  { name: 'type', filter: true, column: 'kind', label: 'ask.field.type' },
  { name: 'id', filter: false, column: 'what', label: null },
  { name: 'status', filter: true, column: null, label: 'ask.field.status' },
  { name: 'layer', filter: true, column: null, label: 'ask.field.layer' },
  { name: 'always', filter: true, column: null, label: 'ask.field.always' },
  { name: 'scoped', filter: true, column: null, label: 'ask.field.scoped' },
  { name: 'title', filter: true, column: null, label: 'ask.field.title' },
];

/**
 * **The fetch cap's ladder, per tab — every rung a value its own endpoint
 * accepts, the first rung the endpoint's OWN DEFAULT, the last its MAXIMUM.**
 *
 * Two ladders because the two endpoints are not the same shape and pretending
 * otherwise would put a rung on screen that comes back 400: `apiAskCorpus`
 * takes `limit` in 1..1000 defaulting to 100, `apiAskAudit` takes it in 1..2000
 * defaulting to 200 (`src/ui/ask-model.ts` · `  const limit = intParam(url, 'limit', 1, 1000, 100);` · ~192).
 *
 * **The first rung is the default, so the landing state is exactly what the
 * endpoint would have done unasked.** A screen whose opening question is not
 * the endpoint's own would make the first answer a decision this control made
 * silently, and the reader would have no way to get back to it.
 *
 * **The last rung is the maximum, so the top of the ladder is the top of the
 * endpoint.** That is what lets `ask.truncatedMax` be true: a reader who is at
 * the last rung and still truncated has genuinely run out of limit, and
 * `ask.truncated`'s *"raise the limit"* would be an instruction they cannot
 * follow. The two facts are one declaration — the sentence cannot come to
 * disagree with the control about where the ladder ends.
 *
 * A ladder rather than a number input: a free integer would need its own
 * validation of a range the server already owns, and every value it could
 * refuse is a 400 the reader has to read to learn about.
 */
const LIMIT_STEPS = {
  audit: [200, 500, 1000, 2000],
  corpus: [100, 250, 500, 1000],
};

/** The tab's rungs. A copy: the caller renders it and must not be able to edit it. */
export function limitSteps(mode) {
  return [...(mode === 'corpus' ? LIMIT_STEPS.corpus : LIMIT_STEPS.audit)];
}

/**
 * The rung `held` means, and **never a value off the ladder** — which is what
 * makes `queryPath` unable to compose a limit its endpoint refuses.
 *
 * An exact rung is itself. Anything else falls to the largest rung BELOW it,
 * and to the first rung when there is none. The case that is not hypothetical
 * is the tab switch: a reader who raised the audit tab to 2,000 and clicks
 * Corpus means "as much as you have", and 2,000 is past what that endpoint
 * serves — so they land on 1,000, the corpus tab's own top, rather than being
 * dropped back to 100. The chosen rung is what the control DISPLAYS, so nothing
 * here is a silent clamp: the number the reader can see is the number that was
 * sent, and it is in the SQL pane's parameters too.
 */
export function limitFor(mode, held) {
  const steps = limitSteps(mode);
  const asked = Number(held);
  if (!Number.isInteger(asked)) return steps[0];
  let chosen = steps[0];
  for (const step of steps) if (step <= asked) chosen = step;
  return chosen;
}

/** At the top of the tab's ladder — the state `ask.truncated` cannot honestly describe. */
export function atLargestLimit(mode, held) {
  const steps = limitSteps(mode);
  return limitFor(mode, held) === steps[steps.length - 1];
}

/**
 * The three columns, and the string key each one's header takes.
 *
 * **They are the Audit stream's own three** (`screens/watch.js` · `for (const
 * key of ['th.at', 'th.kind', 'th.what'])`), and that is the point rather than
 * a coincidence. This product had two tables over one log with two different
 * column sets; the reader who learns one was learning nothing about the other.
 * `th.kind` and `th.what` were already in the mockup's string vocabulary for
 * that table, so no sentence had to be invented and no translation reviewed.
 *
 * **Item and Role MERGED into What rather than two columns added.** `Role` was
 * empty for exactly the rows `Item` was empty for — one record, one reason —
 * and a column blank whenever its neighbour is blank is not earning its width.
 * Merged, the cell says the op for every row and qualifies the item with its
 * role where there is one, so every row says something; the alternative was a
 * five-column table two of whose columns are blank together on most rows.
 */
const COLUMN_HEAD = { at: 'th.at', kind: 'th.kind', what: 'th.what' };

/** The tab's field declarations — the ONE list both derivations below read. */
function fieldsOf(mode) {
  return mode === 'corpus' ? CORPUS_FIELDS : AUDIT_FIELDS;
}

/** The filter select's vocabulary, derived: every field a reader can query. */
export function filterFields(mode) {
  return fieldsOf(mode).filter((field) => field.filter);
}

/** The header keys, derived: every column some field is declared to fill. */
export function columnHeads(mode) {
  const columns = [];
  for (const field of fieldsOf(mode)) {
    if (field.column !== null && !columns.includes(field.column)) columns.push(field.column);
  }
  return columns.map((column) => COLUMN_HEAD[column]);
}

/**
 * `always` and `scoped` are `1` or `0` at the endpoint — it refuses anything
 * else — and `true`/`false` on screen, which is the frontmatter's own spelling
 * and the mockup's. Two members, so `is not` is expressible for both.
 */
const BOOLEAN = [{ value: '1', label: 'true' }, { value: '0', label: 'false' }];

/**
 * The one other CLOSED vocabulary, seeded rather than learned. `Layer` is a
 * declared two-member type in `core/types.ts` and `apiAskCorpus` refuses
 * anything else, so — exactly like the booleans above — it is a shape rather
 * than a list that grows, and the mockup writes it out for the same reason
 * (`docs/design/web-ui-mockup.html` · `'ask.field.layer':['project','global'],` · ~3140).
 * Learning still runs over it: a third layer would simply be ADDED. Before
 * 2026-08-26 it would also have switched negation off, because the fake
 * negation needed exactly two members; a real `<>` does not care how many
 * there are.
 */
const LAYER = [{ value: 'project', label: 'project' }, { value: 'global', label: 'global' }];

/**
 * **`NEGATABLE_FIELDS` and `negatable()` are gone, and the reasoning they
 * carried is kept here because it is still true and still load-bearing.**
 *
 * They named the three fields whose vocabulary is CLOSED, EXHAUSTIVE and
 * MUTUALLY EXCLUSIVE — `layer`, `always`, `scoped` — the only ones where
 * "is not X" and "is Y" are the same question. That mattered when a negation
 * could only be FAKED as the other member's equality. It stopped mattering on
 * 2026-08-26, when both builders learned `<>`.
 *
 * What survives is WHY the other fields could never have been faked, and it is
 * worth keeping because it is the argument for having fixed the builders
 * rather than widened the fake:
 *
 *   - `type`, `status`, `kind`, `op`, `origin` are open lists this screen
 *     learns; two members today is an accident of the corpus, and "not a rule"
 *     is every category the log has not shown yet.
 *   - `title` is a `LIKE '%x%'` fragment. Two titles do not partition
 *     anything: a row can contain both, or neither. Its negation is `NOT LIKE`,
 *     which is why `corpusSelect` spells that one out separately.
 *   - `item` is worse still — one audit record names SEVERAL items (a subject,
 *     what it injected, what it spilled), so even in a corpus of exactly two
 *     items "item is not A" is not "item is B".
 */

const IS = 'is';
const IS_NOT = 'is not';

/**
 * The chip a role wears. `injected` and `spilled` are the mockup's own two —
 * `ch.className='chip '+(role==='spilled'?'warn':'ok')`.
 *
 * **`subject` gets no chip any more, and losing it is the merge paying for
 * itself.** It used to take the neutral chip, because the Role column had to
 * say SOMETHING for a mutation's own item and the design gives the third role
 * no hue. With the op drawn beside the id, `create RULE-x ◇subject` says
 * "subject" twice: `create` is what makes that id the subject. The chip is
 * drawn only where it adds a fact the row does not otherwise carry — which of
 * an injection's several items landed and which spilled.
 */
const ROLE_CHIP = { injected: ['chip ok', '●'], spilled: ['chip warn', '▲'] };
/**
 * The KIND cell's chip, and the fallback for a count with no role.
 *
 * Neutral for EVERY kind, which is where this diverges from the Audit stream's
 * `KIND_CHIP` and the reason is worth stating. That screen hues `mutation` and
 * `access` because its pulse is coloured by kind and the chip is the pulse's
 * legend; there is no pulse here. This column also carries a corpus CATEGORY
 * on the other tab, which has no audit hue at all, so one neutral treatment is
 * the only one that is true on both tabs — and a second per-kind hue table is
 * a second thing to keep in step with `core/audit.ts`.
 *
 * Bare `.chip` is the one that cannot be read (near-black text, no background:
 * the owner ruling recorded in `e2e/screen-parity.spec.ts`'s preview note), so
 * the neutral is `.chip.index` — `screens/parts.js`'s own fallback.
 */
const NEUTRAL_CHIP = ['chip index', '◇'];

// ── THE PURE HALF ─────────────────────────────────────────────────────────
//
// Everything below this line to `render()` is DOM-free and exported, and
// `test/ui/ask-screen.test.ts` imports it. Spec §6's rendering gap is real —
// the DOM glue in `render()` has no test — but the gap is the GLUE, not the
// decisions: which parameter a filter becomes, which rows an answer produces
// and which of the table's three states is true are all decidable without a
// browser, so none of them lives inside the glue. `lib/viewmodel.js` is where
// this would otherwise sit (it is where the Watch screen's decisions live),
// and it belongs to another task; exporting from the screen module is the
// smaller of the two evils and is named in this task's report.


/**
 * One (field, operator, value) as the query parameter it becomes.
 *
 *   - `null`         — no filter at all. `(any)` is the empty value, and an
 *                      empty value with `is not` is still no question.
 *   - `[name, value]`        — the equality to send.
 *   - `[name, value, true]`  — the same, NEGATED. The third member is a flag,
 *                      not a value: `queryPath` turns it into `not=<name>` and
 *                      the server chooses the operator. There is no longer an
 *                      `'unserved'` third answer — every field this screen can
 *                      offer, the server can now negate.
 */
export function filterParam(field, operator, value) {
  if (value === '') return null;
  // **`is not` is now a real operator, and this no longer fakes one.**
  //
  // Until 2026-08-26 neither query builder could emit `<>` at all, so this
  // function faked a negation the only way it could: on a field with exactly
  // TWO values it swapped to the other one, and on anything wider it returned
  // `'unserved'` and the screen greyed the operator out without saying why.
  // That is not negation — it is a coincidence that holds for booleans.
  //
  // The owner ruled the cause be fixed rather than described, so `corpusSelect`
  // and `filterSelect` now negate for real and this sends the FIELD NAME to
  // negate rather than a swapped value. `'unserved'` is gone: there is no
  // longer a field this screen can offer and the server cannot answer.
  return operator === IS_NOT ? [field, value, true] : [field, value];
}

/**
 * The path to fetch for one filter row, at the cap the reader has chosen.
 *
 * **`limit` is ALWAYS sent, including at the endpoint's own default.** The
 * alternative — omit it while it matches the default — would make the request
 * and the SQL pane's parameters stop reflecting a control that is on screen
 * saying 100, and it would put a branch here for a state nothing can tell apart
 * from the other one. It goes through `limitFor`, so a value off the tab's
 * ladder cannot be composed: there is no path from this function to a 400.
 */
export function queryPath(mode, field, operator, value, limit) {
  const filter = filterParam(field, operator, value);
  const base = mode === 'corpus' ? '/api/ask/corpus' : '/api/ask/audit';
  const params = new URLSearchParams();
  if (filter !== null) {
    params.set(filter[0], filter[1]);
    // `not` names the FIELD, never an operator: the server maps that name onto
    // `<>` itself, so no fragment of SQL and no operator token crosses the wire.
    if (filter[2] === true) params.set('not', filter[0]);
  }
  params.set('limit', String(limitFor(mode, limit)));
  return `${base}?${params.toString()}`;
}

/**
 * `/api/ask/corpus`' rows in the design's three columns.
 *
 * **`kind` is the item's CATEGORY, and that is what the column means here.**
 * A corpus row's answer to "what is this" is `rule`, `decision`, `invariant` —
 * the same question the audit tab answers with `hook` or `access`. Until this
 * merge a corpus row drew `At | <id> | —`, with the dash for a Role a corpus
 * row can never have: the same empty column the audit tab was reported for,
 * on a tab nobody happened to report.
 */
export function corpusRows(rows) {
  return rows.map((row) => ({
    at: row.updated_at ?? null,
    kind: typeof row.type === 'string' ? row.type : null,
    op: null,
    item: row.id ?? null,
    linkable: true,
    role: null,
    count: null,
  }));
}

/**
 * `/api/ask/audit`' records in the design's three columns — ONE ROW PER ITEM
 * THE RECORD NAMES, tagged with the role it names it in.
 *
 * The three roles are the projection's own, not invented here: `audit_item`
 * holds `(seq, item_id, role)` and `filterSelect`'s `item` filter reads all
 * three of them — *"the item this record is ABOUT, an item this injection
 * delivered, or an item it spilled"*
 * (`src/core/audit-db.ts` · `// Any of the three roles: the item this record is ABOUT, an item this` · ~734).
 * That is also what the mockup's own sample draws: two rows at one timestamp,
 * one `injected` and one `spilled`.
 *
 * **A record that names no item still gets a row, and since 2026-08-29 that
 * row SAYS SOMETHING.** A hook action, a session-start or a focus change is a
 * real record with a real timestamp and no item, and an item-shaped table that
 * dropped it would drop it silently. It kept it and drew two em dashes
 * instead, which is the defect `plan:walk seq:73` reports: on the owner's
 * machine 59 of the last 60 records were `hook` and one was `access`, none of
 * them named an item, and 498 rows read `06:22:59 | — | —`. The dashes were
 * honest and useless. Every row now carries `kind` and `op` — what the record
 * IS — whether or not it is about an item.
 *
 * Newest first. `filterSelect` takes the newest n in descending order and
 * reverses them, so the wire order is oldest-first and every reading surface
 * turns it around again.
 */
export function auditRows(records) {
  const out = [];
  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index];
    // The record's OWN words, never a table keyed by kind: a value this build
    // has never met draws itself, which is what `kinds: '*'` in
    // `lib/live-invalidation.js` promises about this screen.
    const said = {
      at: record.at,
      kind: typeof record.kind === 'string' ? record.kind : null,
      op: typeof record.op === 'string' ? record.op : null,
      count: null,
    };
    const named = [];
    if (typeof record.itemId === 'string') named.push([record.itemId, 'subject']);
    for (const ref of record.injected ?? []) named.push([ref.id, 'injected']);
    for (const ref of record.spilled ?? []) named.push([ref.id, 'spilled']);
    if (named.length === 0) {
      out.push({ ...said, item: null, linkable: false, role: null });
      continue;
    }
    for (const [item, role] of named) {
      out.push({ ...said, item, linkable: true, role });
    }
  }
  return out;
}

/**
 * `/api/ask/summary`' rows in the design's three columns.
 *
 * `label` is an item id for `report=items` and is NOT one for the other two —
 * an op name, a session id — which is why only the first is linkable: a
 * `button.linkid` on a session id resolves to no item at all.
 *
 * The ROLE of an `items` report is the report's own `role` parameter: every
 * row of "Most-spilled items" is a spill. `report=items` with no role asks a
 * different question — every role at once — and claims none.
 */
export function summaryRows(report, role, rows) {
  return rows.map((row) => ({
    at: row.last ?? null,
    // **An aggregate has no kind, and says so rather than borrowing one.** A
    // report row folds many records together; `create` belongs to `mutation`
    // and `subagent-stop` to `hook`, but the only way to say so here would be
    // an op→kind table copied out of `core/audit.ts` — the enumerated
    // vocabulary this file's field declarations refuse on principle, wrong the
    // day an eighth kind ships. The em dash is the honest answer, and unlike
    // the one this task was reported for it does not stand alone: the What
    // cell names the op, the item or the session the row counts.
    kind: null,
    op: null,
    item: row.label ?? null,
    linkable: report === 'items',
    role: report === 'items' ? role : null,
    count: row.count ?? null,
  }));
}

/**
 * Which of the three states the result table is in — the three the mockup
 * names and only ever drew one of.
 *
 * `truncated` is a property of the ANSWER (the probe row fired), never of the
 * row count, so it is asked of the body rather than inferred from a length
 * that equals the cap by coincidence.
 */
export function tableState(count, truncated) {
  if (truncated) return 'truncated';
  return count === 0 ? 'none' : 'rows';
}

/**
 * `[className, glyph]` for a role the design HUES, or `null` for one it does
 * not. `subject` is the `null` — see `ROLE_CHIP` for why it stopped earning a
 * chip when the op arrived beside it.
 */
export function roleChip(role) {
  return ROLE_CHIP[role] ?? null;
}

// ── THE GLUE ──────────────────────────────────────────────────────────────

/** An `<option>`; `label` is a string, or the node list `ctx.t()` returns. */
function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  // An `<option>` renders TEXT and nothing else. A text node is legal content
  // there, so t()'s list appends cleanly — but only because none of the keys
  // used as an option label here (`ask.field.any` and the six `ask.field.*`
  // names) carries a monospace slot. A key that carried one would need the
  // flattening companion `ctx.tFlat` instead, because the element the slot
  // produces has nowhere to render inside an option.
  if (typeof label === 'string') node.textContent = label;
  else node.append(...label);
  return node;
}

/** The mockup's inline `style="…"`, set through CSSOM because CSP forbids the attribute. */
function styled(node, declarations) {
  for (const [property, value] of Object.entries(declarations)) {
    node.style.setProperty(property, value);
  }
  return node;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'ask.h', 'ask.v', 'ask.sub');

  const card = el('div', 'card pane');
  root.append(card);

  // ── The tab strip ────────────────────────────────────────────────────────
  // Two corpora, not one. `ask.recallq` at the foot of this card is a
  // disclosure about CORPUS search recall, and until the strip landed it sat
  // over a filter row that could only ask the audit projection.
  const tabs = el('div', 'segbar');
  tabs.setAttribute('role', 'group');
  // An `aria-label` is an ATTRIBUTE and cannot hold an element, which is the
  // sink `tFlat` exists for and the reason reaching for it is written down.
  tabs.setAttribute('aria-label', ctx.tFlat('aria.askTabs'));
  const tabButtons = new Map();
  for (const [name, key] of [['audit', 'ask.tab.audit'], ['corpus', 'ask.tab.corpus']]) {
    const button = el('button');
    button.type = 'button';
    button.dataset.tab = name;
    button.append(...ctx.t(key));
    tabs.append(button);
    tabButtons.set(name, button);
  }
  card.append(tabs);

  // ── The filter row ───────────────────────────────────────────────────────
  // ONE field, one operator, one value — the mockup's row, not the plan's six
  // labelled inputs. `ask.field` is singular ("Field") and the six
  // `ask.field.*` keys are the OPTIONS of the field select, which is how the
  // mockup spends them and the only reading their wording supports.
  const row = styled(el('div'), {
    display: 'flex', gap: '8px', 'flex-wrap': 'wrap', 'align-items': 'center', 'font-size': '14.5px',
  });
  const fieldLabel = el('label', 'small');
  fieldLabel.htmlFor = 'ask-field';
  fieldLabel.append(...ctx.t('ask.field'));
  const fieldSelect = document.createElement('select');
  fieldSelect.id = 'ask-field';
  // **The operator labels are KEYED, and the values are not.** `is` / `is not`
  // are the mockup's own literals and carry no `data-t`, and this comment used
  // to stop there: "adding a key that the design of record does not declare
  // fails `strings-parity` in the direction that names it". It does not, and
  // has not since 2026-08-26 — `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`
  // dropped that direction and the gate's docstring says so. Until it was
  // re-read, these two were the only PROSE on this screen the א/A toggle could
  // not reach.
  //
  // The `<option>` VALUE stays the English literal, because it is not prose:
  // `filterFor` compares it against `IS_NOT` to decide whether to negate, and a
  // control whose behaviour changed with the UI language would be a second
  // thing to reconcile. Label translated, value fixed — the split `tierChip`
  // already makes between a tier's name and its chip.
  const opSelect = document.createElement('select');
  const isNotOption = option(IS_NOT, ctx.t('ask.opIsNot'));
  opSelect.append(option(IS, ctx.t('ask.opIs')), isNotOption);
  const valueSelect = document.createElement('select');
  // **NO RUN BUTTON, and that is an owner ruling rather than an omission.**
  //
  // The mockup draws one here. It was built, and it was INDISTINGUISHABLE
  // FROM BROKEN: the three selects below each call `runFilter()` on change
  // and Run called the same function, so by the time it could be clicked the
  // answer was already on screen and clicking changed nothing visible. The
  // owner reported it in those words on 2026-08-27 — *"the run is unusable
  // because you calculate at least the sql whenever it changes so run does
  // nothing"* — and ruled it out rather than giving it an acknowledgement.
  //
  // A live screen does not need a trigger, and a control that re-runs a query
  // nobody changed is one a reader has to be TOLD is working. See
  // DEC-the-ask-screen-is-live-so-it-draws-no-run-button.
  //
  // `ask.run` STAYS in both string tables: the composer uses it for its own
  // read action, and `strings-parity` holds every sentence the mockup declares
  // to exist in the tables regardless of which screen draws it.
  //
  // **The fetch cap, LAST in the row and labelled separately.** It is the one
  // control here that is not part of the (field, operator, value) triple —
  // see `LIMIT_STEPS` for why it is not an entry in the field select — and it
  // sits in this row rather than beside the table because it is a property of
  // the QUESTION: the SQL pane directly below shows it arriving as the
  // statement's last bound parameter.
  const limitLabel = el('label', 'small');
  limitLabel.htmlFor = 'ask-limit';
  limitLabel.append(...ctx.t('ask.limit'));
  const limitSelect = document.createElement('select');
  limitSelect.id = 'ask-limit';
  row.append(fieldLabel, fieldSelect, opSelect, valueSelect, limitLabel, limitSelect);
  card.append(row);

  // A property of the CORPUS query and of nothing else, so it hangs on that
  // tab alone — the mockup's own arrangement.
  const corpusNote = spaced(el('p', 'small'));
  corpusNote.append(...ctx.t('ask.updatedAtTrap'));
  corpusNote.hidden = true;
  card.append(corpusNote);

  // ── The four canned queries ──────────────────────────────────────────────
  const canned = styled(spaced(el('div')), {
    display: 'flex', gap: '6px', 'flex-wrap': 'wrap', 'align-items': 'center',
  });
  const cannedLabel = el('span', 'small');
  cannedLabel.append(...ctx.t('ask.predefined'));
  canned.append(cannedLabel);
  const REPORTS = [
    ['ask.predefined.ops', { report: 'ops', role: null }],
    ['ask.predefined.spilled', { report: 'items', role: 'spilled' }],
    ['ask.predefined.injected', { report: 'items', role: 'injected' }],
    ['ask.predefined.sessions', { report: 'sessions', role: null }],
  ];
  for (const [key, query] of REPORTS) {
    const button = styled(el('button', 'icon'), { 'inline-size': 'auto' });
    button.type = 'button';
    button.append(...ctx.t(key));
    button.onclick = () => { void runSummary(query); };
    canned.append(button);
  }
  card.append(canned);

  // ── The composed query ───────────────────────────────────────────────────
  // `.plate` under the statement because it is DATA — the repaint's rule is
  // "text may float on glass, data may not", and the executed SQL is the whole
  // point of this screen. The mockup's own `style="background:var(--sunk)"` on
  // this card is a dead token (`--sunk` is defined nowhere in the mockup or in
  // styles.css, so the declaration is dropped and `.card`'s own background
  // shows); it is not reproduced, and it is in this task's report.
  const sqlCard = styled(el('div', 'card'), { 'margin-block-start': '10px' });
  const sqlHead = el('h3');
  sqlHead.append(...ctx.t('ask.sqlh'));
  const sqlCaption = el('p', 'small');
  sqlCaption.append(...ctx.t('ask.sqlCaption'));
  const sqlPlate = el('div', 'plate');
  const sqlPane = el('pre', 'm');
  sqlPlate.append(sqlPane);
  const sqlNote = el('p', 'small');
  sqlNote.append(...ctx.t('ask.sqln'));
  sqlCard.append(sqlHead, sqlCaption, sqlPlate, sqlNote);
  card.append(sqlCard);

  const whyHelp = el('details', 'help');
  const whySummary = el('summary');
  whySummary.append(...ctx.t('ask.whyq'));
  const whyBox = el('div', 'helpbox');
  const whyText = el('span');
  whyText.append(...ctx.t('ask.why'));
  whyBox.append(whyText);
  whyHelp.append(whySummary, whyBox);
  card.append(whyHelp);

  // ── The result table ─────────────────────────────────────────────────────
  const plate = styled(el('div', 'plate'), { 'margin-block-start': '10px' });
  const table = el('table');
  const caption = el('caption');
  // **The header row is DERIVED and REDRAWN per tab, never written down.** It
  // was a literal list here, which is the second of the two hand-kept lists
  // `AUDIT_FIELDS` above describes; `columnHeads()` reads the same
  // declarations the filter select reads, so a column and the field that fills
  // it cannot be added one without the other. Both tabs answer with the same
  // three today — a corpus row's kind is its category and its what is its id —
  // and the redraw is still per tab, because that is a property of the
  // declarations and not a promise this function is entitled to make.
  const head = el('tr');
  const thead = el('thead');
  thead.append(head);
  function paintHead() {
    head.replaceChildren();
    for (const key of columnHeads(mode)) {
      const cell = el('th');
      cell.append(...ctx.t(key));
      head.append(cell);
    }
  }
  const tbody = el('tbody');
  table.append(caption, thead, tbody);
  plate.append(table);
  card.append(plate);

  // **The bound line lives OUTSIDE the `<table>`**, which is not a preference:
  // a `<div>` is not a legal child of a table, and `screens/injected.js` places
  // the same part the same way for the same reason. It is replaced wholesale on
  // every answer — `boundedList` closes over the rows it was given, so a line
  // kept from a previous answer would page a list that is no longer on screen.
  let boundLine = el('div', 'bound');
  card.append(boundLine);

  let stateLine = el('p', 'small');
  card.append(stateLine);

  const recallHelp = el('details', 'help');
  const recallSummary = el('summary');
  recallSummary.append(...ctx.t('ask.recallq'));
  const recallBox = el('div', 'helpbox');
  const recallOne = el('span');
  recallOne.append(...ctx.t('ask.recall1'));
  const recallTwo = el('span');
  recallTwo.append(...ctx.t('ask.recall2'));
  recallBox.append(recallOne, recallTwo);
  recallHelp.append(recallSummary, recallBox);
  card.append(recallHelp);

  // ── The vocabularies, and what no endpoint serves ────────────────────────
  //
  // A value select can only offer a vocabulary, and the mockup's own
  // instruction is that the shipped screen DERIVES its lists rather than
  // writing them down — the same standing rule `screens/watch.js`'s filter row
  // obeys, and for the reason it gives: a hand-copied enum goes stale in
  // silence, and this project's own already did.
  //
  // FOUR SOURCES, and each is weaker than the declaration it stands in for:
  //
  //   - `/api/items` — every id, category, status and title in the corpus.
  //   - `/api/watch/volume`'s `byKind` — a real derivation of `AUDIT_KINDS`:
  //     every bucket carries every member at zero, built from the one
  //     declaration, so its key order IS the enum. It is asked for one bucket
  //     of one minute, which is the cheapest question that carries the
  //     breakdown, and it needs a projection that is not stale.
  //   - the records an audit query returns — kinds, ops, origins and item ids
  //     that have actually occurred.
  //   - the rows a corpus query returns — `layer`, plus categories and
  //     statuses again.
  //
  // **What no browser-reachable endpoint serves at all:** `AUDIT_OPS` (19
  // members), `ORIGINS`, `STATUSES`, `LAYERS` and the 29 categories of
  // `core/categories.ts`. `AUDIT_KINDS` is served only through a projection
  // read, which refuses when the projection is stale. So on a corpus whose
  // audit history is empty or whose projection is behind, the audit tab can
  // offer no values to filter by — which is true, and is why the vocabulary
  // is derived rather than typed. In this task's report.
  const vocabulary = {
    kind: [], op: [], origin: [], item: [],
    type: [], status: [], title: [],
    layer: [...LAYER], always: [...BOOLEAN], scoped: [...BOOLEAN],
  };

  /** Union-only, sorted, never shrinking: a filtered answer must not narrow the offer. */
  function learn(field, values) {
    const list = vocabulary[field];
    if (list === undefined) return;
    const seen = new Set(list.map((entry) => entry.value));
    let changed = false;
    for (const value of values) {
      if (typeof value !== 'string' || value === '' || seen.has(value)) continue;
      seen.add(value);
      list.push({ value, label: value });
      changed = true;
    }
    if (changed) list.sort((a, b) => a.value.localeCompare(b.value));
  }

  let mode = 'audit';

  function paintValues() {
    const field = fieldSelect.value;
    const entries = vocabulary[field] ?? [];
    const held = valueSelect.value;
    valueSelect.replaceChildren(option('', ctx.t('ask.field.any')));
    for (const entry of entries) valueSelect.append(option(entry.value, entry.label));
    valueSelect.value = entries.some((entry) => entry.value === held) ? held : '';
    // **Never disabled any more, on any field.** It was offered only where it
    // could be served, which until 2026-08-26 meant the three two-valued
    // fields — and on every other field it greyed out and silently swapped
    // itself back to `is`, teaching nothing about why. Both builders negate for
    // real now (`plan:walk seq:36`), so there is no field this screen can offer
    // and the server cannot answer.
    isNotOption.disabled = false;
  }

  function paintFields() {
    const fields = filterFields(mode);
    const names = fields.map((field) => field.name);
    const held = names.includes(fieldSelect.value) ? fieldSelect.value : names[0];
    fieldSelect.replaceChildren();
    for (const field of fields) {
      fieldSelect.append(option(field.name, field.label === null ? field.name : ctx.t(field.label)));
    }
    fieldSelect.value = held;
    paintHead();
    paintValues();
    paintLimits();
  }

  function swapStateLine(node) {
    stateLine.replaceWith(node);
    stateLine = node;
  }

  function swapBoundLine(node) {
    boundLine.replaceWith(node);
    boundLine = node;
  }

  /** The tab's rungs, redrawn per tab because the two endpoints' ladders differ. */
  function paintLimits() {
    const held = limitFor(mode, limitSelect.value);
    limitSelect.replaceChildren();
    for (const step of limitSteps(mode)) limitSelect.append(option(String(step), num(step)));
    limitSelect.value = String(held);
  }

  /** One chip, `[className, glyph]` and a text run. */
  function chipOf([className, glyph], text) {
    const chip = el('span', className, text);
    chip.dataset.g = glyph;
    return chip;
  }

  /**
   * One row, in the three columns `columnHeads()` derived: **At**, **Kind**,
   * **What**.
   *
   * The What cell is composed in the order a reader asks the questions — what
   * happened, to which item, in which role — and every part is optional
   * EXCEPT that the cell is never empty. An audit row always has an op; a
   * corpus row always has an id; a summary row always has a label. The em dash
   * stays as the last resort for a shape none of the three produces, because a
   * cell that silently drew nothing would be the reported defect returning by
   * a different route.
   */
  function rowFor(row) {
    const line = el('tr');
    line.append(el('td', 'm small', row.at === null ? '—' : clockOf(row.at)));

    // The record's own word, drawn as a literal — product vocabulary is never
    // translated (`screens/watch.js`'s ruling for a kind, `parts.js`'s for a
    // tier). A kind this build has never seen draws itself.
    const kindCell = el('td');
    if (row.kind === null) kindCell.append('—');
    else kindCell.append(chipOf(NEUTRAL_CHIP, row.kind));

    const what = el('td');
    let said = false;
    const gap = () => { if (said) what.append(' '); said = true; };
    if (row.op !== null) { gap(); what.append(mono(row.op)); }
    // `button.linkid` is what every id on every screen already is, so a click
    // reaches the global item pane when the shell grows one; the mockup draws
    // a bare `span.m` here and every shipped screen — the Audit stream's own
    // table included — draws the button. A label that is NOT an item id (an op
    // name, a session id) stays a plain monospace run: a linkid on one would
    // resolve to nothing.
    if (row.item !== null) {
      gap();
      what.append(row.linkable ? linkId(row.item, false) : mono(row.item));
    }
    const hue = roleChip(row.role);
    if (row.count !== null) {
      // A count is drawn INSIDE the chip — `12 spilled`, the shape
      // `screens/coverage.js` gives a count plus a literal. With no role to
      // qualify it (`report=ops`, `report=sessions`) it takes the neutral.
      gap();
      what.append(chipOf(hue ?? NEUTRAL_CHIP,
        row.role === null ? num(row.count) : `${num(row.count)} ${row.role}`));
    } else if (hue !== null) {
      gap();
      what.append(chipOf(hue, row.role));
    }
    if (!said) what.append('—');

    line.append(kindCell, what);
    return line;
  }

  /**
   * One answer, drawn. `sql === null` means the answer carried no statement —
   * a refusal, or one of the three predefined reports, whose endpoint does not
   * return one. The card is not drawn there rather than drawn empty: its own
   * caption says "the SQL this answer ran", and an empty box under that
   * sentence is a claim about a statement that does not exist.
   */
  function paint(result) {
    sqlCard.hidden = result.sql === null;
    if (result.sql !== null) {
      sqlPane.textContent = `${result.sql}\n-- parameters: ${JSON.stringify(result.params)}`;
    }
    // A refusal is drawn INSTEAD of the data, never beside an empty view —
    // `screens/parts.js`'s ruling on `errorNote`. An endpoint that refused and
    // a corpus that matched nothing are two facts, and one empty table would
    // report neither.
    plate.hidden = result.error !== null;
    // **The rows go through the ONE bounded list**, host `<tbody>`, cap
    // `BOUND_CAP_TABLE`. An audit answer of 200 records draws one row per item
    // each record names — 986 of them on the owner's corpus — and until this
    // landed they all went into the table at once with no line saying how many
    // there were and no way to move through them. `order: 'position'` because
    // this table's order is the server's and changes with the tab; see the
    // header, and `orderKeyFor` in `screens/parts.js`.
    const bound = boundedList(ctx, tbody, result.rows, (row) => rowFor(row),
      { cap: BOUND_CAP_TABLE, order: 'position' });
    // Hidden on an answer with NO rows, and that is not a silent drop: the
    // state line immediately below already says which zero this is — the
    // endpoint's refusal, an absent projection, or `ask.noRows` — in words a
    // bound line cannot. "Showing all 0." beside any of the three is a second
    // sentence for one fact, and beside a refusal it is a claim about a table
    // that was not drawn.
    bound.hidden = result.rows.length === 0;
    swapBoundLine(bound);
    // **THE STATUS LINE IS PART OF THE PAGE REFRESH, not only of the answer**
    // — owner, 2026-08-29: *"the refresh mechanism you already implemented
    // should include also the status line"*.
    //
    // The two lines under this table are drawn by two different mechanisms.
    // `boundedList` owns the upper one and redraws it, and the rows above it,
    // on every step; the lower one is this screen's own disclosure — the
    // truncation sentence, the projection's word, `ask.noRows` — and it was
    // drawn once per ANSWER and then left alone while the reader moved. Nothing
    // visibly broke, because the disclosure is true of the whole answer at every
    // page; but it survived by ORDERING rather than by construction, and the
    // moment it acquires anything page-dependent it would be stale with nothing
    // to catch it.
    //
    // The state it is sharpest about today is *show all*: `list.allOf` says
    // "Showing all 100." at exactly the moment the reader most needs to still
    // be told that 100 was a cap and more matched. Redrawing the disclosure
    // beside it makes that a guarantee rather than a leftover.
    //
    // ONE DELEGATED LISTENER on the bound line, not three on its buttons: the
    // steps and the escape hatch all bubble here, `boundedList` owns which of
    // them exist, and a per-button wiring would have to be kept in step with a
    // control set this file does not build. It runs AFTER the part's own
    // handler — a listener on the target fires before one on its ancestor —
    // so the page has already moved when the disclosure is redrawn.
    bound.addEventListener('click', () => { paintState(result); });
    caption.replaceChildren(...ctx.t('ask.rows', { rows: num(result.rows.length) }));
    caption.hidden = result.rows.length === 0;
    paintState(result);
  }

  /**
   * The line under the bound line: what this ANSWER is — a refusal, a cap that
   * bit, a projection that is not fresh, or nothing matched.
   *
   * Split out of `paint` so that the page controls can call it too (see the
   * delegated listener above). It reads no state of its own: everything it says
   * comes from the `result` it is handed, so a redraw at any moment says exactly
   * what the first draw said about the same answer.
   */
  function paintState(result) {
    if (result.error !== null) {
      // The endpoint's own words, never a paraphrase: the 503 for a stale
      // projection names the state AND the command that repairs it, and no
      // string table declares a sentence that could say either.
      swapStateLine(errorNote(result.error));
      return;
    }
    const line = el('p', 'small');
    const state = tableState(result.rows.length, result.truncated);
    if (state === 'truncated') {
      // Two sentences, chosen by whether the control has anywhere left to go.
      // `ask.truncated` ends *"raise the limit to see them"*, which stops being
      // an instruction at the top of the ladder and becomes a control that
      // looks broken. `atLargestLimit` and the ladder are one declaration, so
      // the sentence cannot outlive the rung it is about.
      const key = atLargestLimit(mode, limitSelect.value) ? 'ask.truncatedMax' : 'ask.truncated';
      line.append(...ctx.t(key, { rows: num(result.rows.length) }));
    } else if (result.projectionState !== null && result.projectionState !== 'fresh') {
      // `absent` — nobody has built a projection. NOT "no rows matched": that
      // sentence is a claim about a log this answer never read. The server's
      // own word, as a literal chip.
      const chip = el('span', 'chip warn', String(result.projectionState));
      chip.dataset.g = '▲';
      line.append(chip);
    } else if (state === 'none') {
      line.append(...ctx.t('ask.noRows'));
    }
    swapStateLine(line);
  }

  function failed(error) {
    paint({ sql: null, params: null, rows: [], truncated: false, projectionState: null, error: error.message });
  }

  async function runFilter() {
    const field = fieldSelect.value;
    const path = queryPath(mode, field, opSelect.value, valueSelect.value, limitSelect.value);
    // The `'unserved'` guard that stood here is gone with the thing it guarded:
    // `queryPath` had a third answer for a negation this surface could not
    // express, and since 2026-08-26 there is no such negation. Removed rather
    // than left as a defensive branch — a check for a value nothing can produce
    // reads to the next person as though something can.
    try {
      const body = await ctx.api(path);
      if (mode === 'corpus') {
        learn('type', body.rows.map((row) => row.type));
        learn('status', body.rows.map((row) => row.status));
        learn('layer', body.rows.map((row) => row.layer));
        learn('title', body.rows.map((row) => row.title));
        paint({
          sql: body.sql, params: body.params, rows: corpusRows(body.rows),
          truncated: body.truncated === true, projectionState: null, error: null,
        });
      } else {
        learn('kind', body.records.map((record) => record.kind));
        learn('op', body.records.map((record) => record.op));
        learn('origin', body.records.map((record) => record.origin));
        learn('item', body.records.map((record) => record.itemId));
        paint({
          sql: body.sql, params: body.params, rows: auditRows(body.records),
          // `filterSelect` binds the cap itself, with no probe row, so an
          // audit answer cannot report truncation. See this file's header.
          truncated: false, projectionState: body.projectionState ?? null, error: null,
        });
      }
      paintValues();
    } catch (error) {
      failed(error);
    }
  }

  /**
   * A predefined report. Audit history, always — the mockup's own comment
   * calls these "four canned queries over the audit history" — so pressing one
   * on the corpus tab moves the strip rather than answering an audit question
   * under a corpus heading.
   *
   * Their rows feed the filter row's vocabulary, which is as much of the
   * mockup's "a shortcut THROUGH the same filter fields" as an aggregate
   * endpoint can be: after "Operations by count" the `op` select knows every
   * op the log holds.
   *
   * **The fetch cap does NOT travel here, deliberately.** `/api/ask/summary`
   * has a third limit of its own — 1..200, defaulting to 20 — and `report=ops`
   * takes none at all, so the filter row's ladder does not fit it: two of its
   * four rungs are past what this endpoint accepts on either tab, and sending
   * one would be a 400 where the reader changed nothing. Clamping instead would
   * put 200 rows on screen under a control reading 1,000. These reports are
   * aggregates over the whole log rather than a page of it, so what a raised
   * cap would buy is a longer top-N — a different question, and one no sentence
   * on this screen currently asks. Named here and in this task's report rather
   * than papered over; the rows they do return are still bounded and paged like
   * every other answer.
   */
  async function runSummary(query) {
    selectTab('audit');
    const params = new URLSearchParams({ report: query.report });
    if (query.role !== null) params.set('role', query.role);
    try {
      const body = await ctx.api(`/api/ask/summary?${params.toString()}`);
      if (body.report === 'items') learn('item', body.rows.map((row) => row.label));
      if (body.report === 'ops') learn('op', body.rows.map((row) => row.label));
      paintValues();
      paint({
        sql: null, params: null, rows: summaryRows(body.report, query.role, body.rows),
        truncated: false, projectionState: body.projectionState ?? null, error: null,
      });
    } catch (error) {
      failed(error);
    }
  }

  function selectTab(name) {
    mode = name;
    for (const [key, button] of tabButtons) {
      button.setAttribute('aria-pressed', String(key === name));
    }
    corpusNote.hidden = name !== 'corpus';
    paintFields();
  }

  tabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (button === null || button.dataset.tab === mode) return;
    selectTab(button.dataset.tab);
    void runFilter();
  });
  fieldSelect.onchange = () => { paintValues(); void runFilter(); };
  opSelect.onchange = () => { void runFilter(); };
  valueSelect.onchange = () => { void runFilter(); };
  // Live, like the other three, and for the ruling recorded above: this screen
  // draws no Run button because it re-asks whenever the question changes, and a
  // cap is part of the question.
  limitSelect.onchange = () => { void runFilter(); };

  // The two vocabulary reads that are not the answer. Their refusals are NOT
  // drawn: this screen reports the refusal of the query it ran, and a second
  // error line for a list of options would say the same 503 twice. What their
  // failure costs is fewer values to choose from, which the empty select shows
  // for itself.
  try {
    const items = await ctx.api('/api/items');
    learn('item', items.items.map((item) => item.id));
    learn('type', items.items.map((item) => item.type));
    learn('status', items.items.map((item) => item.status));
    learn('title', items.items.map((item) => item.title));
  } catch { /* the query below reports what this screen could not read */ }
  try {
    const volume = await ctx.api('/api/watch/volume?minutes=1&bucket=60');
    if (volume.buckets.length > 0) learn('kind', Object.keys(volume.buckets[0].byKind ?? {}));
  } catch { /* a stale projection: the audit query below says so in full */ }

  selectTab('audit');
  await runFilter();
}
