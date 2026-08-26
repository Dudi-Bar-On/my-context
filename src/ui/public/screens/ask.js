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
 *   4. **`renderQ` cycles three sample states on click.** Run runs the query;
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
 *   3. **A column for `count`.** The design's three columns are At · Item ·
 *      Role, and a report named "Operations by count" answers with a count.
 *      It is drawn INSIDE the role chip (`12 spilled`, the shape
 *      `screens/coverage.js` already gives a count plus a literal) rather than
 *      dropped.
 *   4. **`ask.truncated` on the audit tab.** Only `corpusSelect` binds the
 *      probe row — `params.push(f.limit + 1)`; `filterSelect` binds the cap
 *      itself, so a capped audit answer is indistinguishable from a complete
 *      one and this screen never claims otherwise. `ask.sqlCaption`'s sentence
 *      about the final `LIMIT` is therefore true of the corpus tab only.
 *   5. **A sentence for a projection that is not `fresh`.** No key declares
 *      one. The server's own word is drawn as a literal chip, which is the
 *      treatment a record kind and a tier already get
 *      (`src/ui/public/screens/watch.js` · `const state = el('span', 'chip warn', String(volume.projectionState));` · ~670).
 *
 * ── NO `innerHTML`, NO `style` ATTRIBUTE ──────────────────────────────────
 *
 * Both for the reasons `screens/parts.js` sets down: assigning markup destroys
 * the `.m` spans that carry `unicode-bidi:isolate`, and the server sends
 * `style-src 'self'` with no `'unsafe-inline'`. Every declaration the mockup
 * writes as an attribute is set through CSSOM here, with logical properties.
 */
import { el, errorNote, linkId, mono, num, screenHead, spaced } from '/screens/parts.js';

/**
 * The audit projection's own column names, drawn as LITERALS. Product
 * vocabulary is never translated here — the same ruling `screens/watch.js`
 * makes for a record kind and `screens/parts.js` makes for a tier — and the
 * mockup draws these four as bare options for exactly that reason. The corpus
 * field names are prose and are keyed, below.
 */
const AUDIT_FIELDS = ['kind', 'op', 'origin', 'item'];
const CORPUS_FIELDS = ['type', 'status', 'layer', 'always', 'scoped', 'title'];
const CORPUS_LABEL = {
  type: 'ask.field.type',
  status: 'ask.field.status',
  layer: 'ask.field.layer',
  always: 'ask.field.always',
  scoped: 'ask.field.scoped',
  title: 'ask.field.title',
};

/**
 * A field name IS its query parameter, on both tabs — `type`, `status`,
 * `layer`, `always`, `scoped`, `title` and `kind`, `op`, `origin`, `item` are
 * spelled identically in `apiAskCorpus`' and `apiAskAudit`'s `unknownParams`
 * allow-lists. There is no mapping table here on purpose: a second spelling of
 * ten names is how the screen and the endpoint come to disagree about one.
 */

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
 * `ch.className='chip '+(role==='spilled'?'warn':'ok')` — and the third role
 * the projection has, `subject`, is drawn in the neutral chip rather than in a
 * fourth meaning hue nobody ruled. Bare `.chip` is the one that cannot be
 * read (near-black text, no background: the owner ruling recorded in
 * `e2e/screen-parity.spec.ts`'s preview note), so the neutral is `.chip.index`
 * — `screens/parts.js`'s own fallback.
 */
const ROLE_CHIP = { injected: ['chip ok', '●'], spilled: ['chip warn', '▲'] };
const ROLE_CHIP_NEUTRAL = ['chip index', '◇'];

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

/** The path to fetch for one filter row. */
export function queryPath(mode, field, operator, value) {
  const filter = filterParam(field, operator, value);
  const base = mode === 'corpus' ? '/api/ask/corpus' : '/api/ask/audit';
  if (filter === null) return base;
  const params = new URLSearchParams();
  params.set(filter[0], filter[1]);
  // `not` names the FIELD, never an operator: the server maps that name onto
  // `<>` itself, so no fragment of SQL and no operator token crosses the wire.
  if (filter[2] === true) params.set('not', filter[0]);
  return `${base}?${params.toString()}`;
}

/**
 * A wall clock, `09:26:05` — the mockup's At column.
 *
 * **Only a real INSTANT is reduced to one.** An audit record's `at` is UTC
 * ISO-8601 by declaration; the index's `updated_at` is `2026-08-23 05:21:54`,
 * which carries no zone at all — `new Date()` reads it as LOCAL time, and
 * rendering that as a clock would shift a timestamp by the machine's offset
 * and show the result as if it had been measured. So a string that is not an
 * instant is rendered AS IT ARRIVED, which is also what `screens/watch.js`
 * does with a stamp it cannot parse.
 *
 * `en-GB` is a FORMAT choice, not a language one — the 24-hour spelling in
 * both UI languages, the same argument `parts.js`'s `num()` makes for `en-US`.
 *
 * **A second spelling of `screens/watch.js`'s `clockOf`**, which is not
 * exported and lives in a file this task does not own. Both audit tables must
 * read their At column the same way; the fix is to move it into
 * `screens/parts.js` beside `num()`, and that is in this task's report.
 */
export function clockOf(at) {
  const text = String(at);
  if (!/T.*(Z|[+-]\d\d:?\d\d)$/.test(text)) return text;
  const when = new Date(text);
  return Number.isNaN(when.getTime()) ? text : when.toLocaleTimeString('en-GB', { hour12: false });
}

/** `/api/ask/corpus`' rows in the design's three columns. */
export function corpusRows(rows) {
  return rows.map((row) => ({
    at: row.updated_at ?? null,
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
 * **A record that names no item still gets a row.** A hook action, a
 * session-start or a focus change is a real record with a real timestamp and
 * no item, and an item-shaped table that dropped it would drop it silently.
 * Both cells take the em dash the design uses for "no value here" — the mark
 * `screens/status.js` already draws for a count this server cannot take.
 *
 * Newest first. `filterSelect` takes the newest n in descending order and
 * reverses them, so the wire order is oldest-first and every reading surface
 * turns it around again.
 */
export function auditRows(records) {
  const out = [];
  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index];
    const named = [];
    if (typeof record.itemId === 'string') named.push([record.itemId, 'subject']);
    for (const ref of record.injected ?? []) named.push([ref.id, 'injected']);
    for (const ref of record.spilled ?? []) named.push([ref.id, 'spilled']);
    if (named.length === 0) {
      out.push({ at: record.at, item: null, linkable: false, role: null, count: null });
      continue;
    }
    for (const [item, role] of named) {
      out.push({ at: record.at, item, linkable: true, role, count: null });
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

/** `[className, glyph]` for a role, or the neutral chip for anything else. */
export function roleChip(role) {
  return ROLE_CHIP[role] ?? ROLE_CHIP_NEUTRAL;
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
  // `is` / `is not` are the mockup's own literals and carry no `data-t` — the
  // only PROSE on this screen that no string table declares, so the א/A toggle
  // cannot reach them. Reported rather than keyed here: adding a key that the
  // design of record does not declare fails `strings-parity` in the direction
  // that names it.
  const opSelect = document.createElement('select');
  const isNotOption = option(IS_NOT, IS_NOT);
  opSelect.append(option(IS, IS), isNotOption);
  const valueSelect = document.createElement('select');
  const runButton = styled(el('button', 'icon'), { 'inline-size': 'auto' });
  runButton.type = 'button';
  runButton.append(...ctx.t('ask.run'));
  row.append(fieldLabel, fieldSelect, opSelect, valueSelect, runButton);
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
  const head = el('tr');
  for (const key of ['th.at', 'th.item', 'th.role']) {
    const cell = el('th');
    cell.append(...ctx.t(key));
    head.append(cell);
  }
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  table.append(caption, thead, tbody);
  plate.append(table);
  card.append(plate);

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
  // members), `ORIGINS`, `STATUSES`, `LAYERS` and the 24 categories of
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
    const fields = mode === 'corpus' ? CORPUS_FIELDS : AUDIT_FIELDS;
    const held = fields.includes(fieldSelect.value) ? fieldSelect.value : fields[0];
    fieldSelect.replaceChildren();
    for (const name of fields) {
      fieldSelect.append(option(name, mode === 'corpus' ? ctx.t(CORPUS_LABEL[name]) : name));
    }
    fieldSelect.value = held;
    paintValues();
  }

  function swapStateLine(node) {
    stateLine.replaceWith(node);
    stateLine = node;
  }

  function rowFor(row) {
    const line = el('tr');
    line.append(el('td', 'm small', row.at === null ? '—' : clockOf(row.at)));
    const itemCell = el('td');
    // `button.linkid` is what every id on every screen already is, so a click
    // reaches the global item pane when the shell grows one; the mockup draws
    // a bare `span.m` here and every shipped screen — the Audit stream's own
    // table included — draws the button. A label that is NOT an item id (an op
    // name, a session id) stays a plain monospace run: a linkid on one would
    // resolve to nothing.
    if (row.item === null) itemCell.append('—');
    else if (row.linkable) itemCell.append(linkId(row.item, false));
    else itemCell.append(mono(row.item));
    const roleCell = el('td');
    if (row.role === null && row.count === null) {
      roleCell.append('—');
    } else {
      const [className, glyph] = roleChip(row.role);
      const text = row.count === null ? row.role
        : row.role === null ? num(row.count)
        : `${num(row.count)} ${row.role}`;
      const chip = el('span', className, text);
      chip.dataset.g = glyph;
      roleCell.append(chip);
    }
    line.append(itemCell, roleCell);
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
    tbody.replaceChildren();
    for (const row of result.rows) tbody.append(rowFor(row));
    caption.replaceChildren(...ctx.t('ask.rows', { rows: num(result.rows.length) }));
    caption.hidden = result.rows.length === 0;

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
      line.append(...ctx.t('ask.truncated', { rows: num(result.rows.length) }));
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
    const path = queryPath(mode, field, opSelect.value, valueSelect.value, vocabulary[field] ?? []);
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
  runButton.onclick = () => { void runFilter(); };

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
