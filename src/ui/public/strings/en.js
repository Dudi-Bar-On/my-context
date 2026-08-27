/**
 * English UI string table — TRANSCRIBED from the design of record, not authored here.
 *
 * `docs/design/web-ui-mockup.html` is the UI specification. Every key below is one of its
 * 398 distinct string keys — the 382 it declares with `data-t`, the 12 accessibility
 * labels it declares with `data-t-aria` and the 4 tooltips it declares with
 * `data-t-title`. Those four numbers are a READING of the file and nothing tests
 * them — `strings-parity.test.ts` derives its own count for exactly that reason. This
 * block said 396/379/12/5 against a mockup declaring 395/379/12/4, so the tooltip line
 * had been wrong since a title key left, and the total wore the error.
 *
 * The English values are the rendered text of those elements — or, for the sixteen
 * keyed by an ATTRIBUTE, that attribute’s value, because neither an
 * `aria-label` nor a `title` is reachable by the text path and both stayed English in
 * the Hebrew UI until they were keyed. The Hebrew values are the mockup’s own
 * `const HE = {…}` table. Adding a key the mockup does not declare, or dropping one it
 * does, fails `test/ui/strings-parity.test.ts` in the direction that names it. If the
 * mockup and the product are agreed to diverge, the mockup changes first.
 *
 * Three brace grammars, and two of them are value slots:
 *
 *   {name}     a value substitution, performed by t() in i18n.js and rendered as a
 *              bidi-ISOLATED element — `<span class="v">`, whose entire styling is
 *              `unicode-bidi:isolate`. The run takes the paragraph’s own direction, so
 *              a Hebrew sentence reads a Hebrew value the Hebrew way; what it does NOT
 *              do is dissolve into the prose. This block used to call it a TEXT node
 *              taking the paragraph’s direction like any other prose; the mockup’s
 *              corrected grammar says the code has never done that, and the wrong half
 *              was the COMMENT. The mockup spells it `{v:name=sample}`, because it has
 *              to keep drawing a realistic number on screen; `sample` is the mockup’s
 *              business and never travels here.
 *
 *   {mv:name}  the same substitution, rendered the way `{m:…}` is: a monospace,
 *              bidi-ISOLATED element built around the substituted value. It is what
 *              an id, a branch, a commit SHA, a path, a glob or a scope takes — data
 *              that is not prose and must not be laid out as prose. The mockup spells
 *              it `{mv:name=sample}`. It is NOT interchangeable with `{name}`: nine
 *              slots over eight keys once shipped as plain `{name}`, and two of them
 *              regressed visibly — `cap.already` and `pr.item`, a glob and an item id
 *              inside RTL prose, lost isolation they had already shipped with.
 *
 *   {m:…}      a monospace, direction-known run — an identifier, path, glob, command
 *              or flag embedded in prose. It is NOT a value slot: the text between
 *              the braces is literal and is the same in both languages. t() builds it
 *              as a real element rather than as text, so an LTR identifier inside RTL
 *              prose is isolated in both languages rather than only in English.
 *
 * So t() owes each marker one of two treatments and never a third: `{name}` becomes a
 * bidi-isolated element; `{m:…}` and `{mv:name}` become that same isolate PLUS
 * `direction:ltr` and the mono face, and the only difference between those two is
 * whether the run’s text comes from this table or from the data. All THREE build an
 * element, which is what makes the next sentence true: a t() that returns a STRING can
 * honour none of them — a string cannot carry an element, so the isolation is flattened
 * at the one moment it is needed, and an unparsed `{mv:branch}` renders its braces on
 * screen.
 *
 * A slot is NOT free of language. Hebrew is RTL and inflects, so a slot sits where
 * Hebrew grammar wants it rather than where English put it; `preview.carried` had to
 * take a numeral where the Hebrew once spelled the number out, because a slot cannot
 * inflect for gender; and `strip.inSync` writes `origin/{mv:branch}` in English but
 * `{mv:branch} ב‑origin` in Hebrew, because a bare `origin/` immediately before an
 * isolated run resolves to the wrong VISUAL order in an RTL paragraph — a reader
 * would see `main/origin`. None of those three is a defect to tidy.
 *
 * `test/ui/strings-parity.test.ts` compares the `{m:…}` runs key for key, and the
 * value-slot NAMES — `{name}` and `{mv:name}` alike — key for key in both directions.
 *
 * What no test here checks, said so a green suite is not mistaken for verified
 * Hebrew: translation freshness. A Hebrew value left stale by an English edit passes
 * every assertion. That remains a review obligation.
 */

export const lang = 'en';
export const dir = 'ltr';

export const strings = {
  // Chrome — the top bar, the session and focus popovers, the rail
  'top.focus': 'focus',
  'top.session': 'session',
  'title.empty': 'Toggle the zero-data view',
  'aria.sesspop': 'Session',
  'sess.title': 'Session',
  'sess.name': '{b:Names are optional and mycontext owns them.} A session nobody named keeps its id and short prefix — nothing is invented for it, because a derived name can be wrong and naming is the moment you know what a session was for. {m:mycontext session name} · {m:/mycontext-session} — selecting and naming both work without this UI.',
  'sess.cold': 'Cold session',
  'sess.coldn': 'no seen set',
  'sess.coldhelp': "A different question, not a different view: what a brand-new session would get on this file. Never shown as the current session's preview.",
  'sess.parent': 'Previews are of the {b:parent thread}. A subagent has its own dedupe key and its deliveries are not folded in here.',
  'aria.focuspop': 'Focus',
  'focus.title': 'Focus',
  'focus.live': 'The focus that is set',
  'focus.off': 'Focus off',
  'focus.offn': 'no narrowing',
  'focus.help': 'Focus off answers a different question — what this file would get with nothing narrowing it. The default is always what Claude really gets.',
  'aria.rail': 'Screens',
  'nav.inj': 'Injection — what arrives',
  's.preview': 'Injection preview',
  's.coverage': 'Scope coverage',
  's.gaps': 'Coverage gaps',
  's.simulate': 'Budget simulator',
  's.injected': 'Injected now',
  'nav.ev': "Evidence — why it did or didn't",
  's.watch': 'Audit stream',
  's.ask': 'Ask',
  's.doctor': 'Doctor',
  's.decay': 'Decay',
  's.graph': 'Relations',
  's.status': 'Status',
  'nav.ch': 'Change — composed, never run',
  's.work': 'Review queue',
  's.capture': 'Capture',
  's.palette': 'Composer',
  's.config': 'Configure',
  's.proc': 'Procedures',
  's.port': 'Export / import',
  's.packs': 'Template packs',
  'nav.read': 'Read',
  's.docs': 'Documentation',
  's.tut': 'Tutorials',
  's.learn': 'Learn',
  // Injection preview
  'preview.h': 'Injection preview',
  'preview.v': 'exactly what Claude gets',
  'preview.sub': 'What the most recent session was given at its start. Pick a file to preview a tool event instead; the session and focus above narrow this the way the hook does.',
  'preview.ev': 'Event',
  'preview.evl': 'Event',
  'help.more': 'What decides this',
  'help.p1': 'Five inputs narrow it.',
  'help.p2': 'This screen reads. Nothing here changes your corpus.',
  'preview.delivered': 'Delivered',
  'preview.cap': '{items} items, {used} of {budget} tokens',
  'th.item': 'Item',
  'th.tier': 'Tier',
  'tier.carried': 'carried',
  'preview.carried': '{b:{lines} index lines carried from session} {mv:session}. Shown here and in {m:mycontext context} identically — an item arriving from somewhere you cannot see is the same defect as one dropped silently, pointed the other way.',
  // The other three clauses of the SAME disclosure, transcribed from the one
  // renderer that already composes it —
  // `core/render.ts` · `function renderCarried(carried: CarriedSummary | null): string {` · ~47
  // — out of the one field /api/select serves this page unchanged. There is no
  // `index.carriedFrom`: `preview.carried` above is that sentence, and a second
  // key for it would be a second spelling. Each clause is omitted entirely when
  // its list is empty, and the drop reasons ride inside `{mv:ids}` untranslated
  // because `core/select.ts` · `function carriedDropReason(` · ~502 is where
  // they are spelled and no stable code exists to translate from.
  'index.carriedDropped': '{dropped} carried ids got no line: {mv:ids}.',
  'index.carriedDisplaced': "{displaced} of this session's own lines displaced to make room: {mv:ids}.",
  'index.carriedFetch': 'Fetch any of these with {m:mycontext show <id>}.',
  'preview.why': 'Why not — the first gate that failed',
  'aria.gatepick': 'Item',
  'preview.whyn': "The gates in {m:select()}'s own order — eligible, tier, focus, scope, seen, budget — because the order is the explanation: a list of six reasons is noise, and the one that binds is only meaningful in the position it holds. Rungs above it passed, the rung itself carries the diagnosis, and everything below is not reached rather than passed. Composing the fix binds to a stable code on {m:injection()}, so each cause is named by that code and not only by English prose.",
  'preview.ribbon': 'Budget ribbon — four tiers, and what fell out of each',
  'preview.ribbonn': 'One segment per admitted item, sized by its real {m:itemCost}. Beneath each track is the {b:ghost lane}: every spilled item at the width it would have taken, in the position the selector considered it. A wide ghost followed by a narrow fill is first-fit being honest — drawing spills as a tail would misrepresent the algorithm. A tier this event never reaches is drawn as {b:absent}, hatched and named; an empty track would claim it ran and delivered nothing, which is a different fact. Follows the event selector above rather than adding a second one.',
  // Scope coverage
  'cov.h': 'Scope coverage',
  'cov.v': 'the gaps are the point',
  'cov.sub': 'Every path, coloured by what governs it — through {m:matchesScope} and {m:injection()}, never a bare glob match.',
  'cov.pin': 'Pinned — governs every path, independent of scope',
  'help.whyTree': 'Why these are not in the tree',
  'cov.pinhelp': 'An {m:always:true} item governs every path. Colouring it per-path is why a directory that {i:is} governed used to render as a gap. Hoisted here, "gap" means something true.',
  'cov.tree': 'Repository',
  'cov.magn': 'Each row carries a {b:magnitude}, not only a state: the bar is governed / ungoverned / not-examined of the files rolled up under it, and the count is {m:governed of total}. Four categorical dots said which rows were dark; they could not say {i:how} dark. The dot stays because its shape survives monochrome; depth is a {m:data-depth} step, so it mirrors.',
  'cov.k1': 'scoped',
  'cov.k2': 'one item',
  'cov.k3': 'gap',
  'cov.k4': 'not examined',
  'cov.gov': 'What governs',
  'cov.e1': 'Nothing governs this project yet.',
  'cov.e2': 'That is the normal state of a new workspace, not a wall of warnings. One sentence, said once — not repeated per row.',
  'btn.refresh': 'Refresh',
  'btn.copy': 'Copy',
  // Coverage gaps
  'gaps.h': 'Coverage gaps',
  'gaps.v': 'names what is missing, which no listing can',
  'gaps.sub': 'Directories no item scopes, and categories with nothing in them.',
  'th.where': 'Where',
  'th.what': 'What',
  'th.act': 'Next',
  'gaps.r1': '{files} files, no item scopes here',
  'btn.compose': 'Compose',
  'gaps.r2': 'past the file limit',
  'gaps.cat': 'category {m:open_question}',
  'gaps.r3': 'empty',
  'gaps.note': '{b:Not examined} is a third state, never folded into "gap". A file the walk did not reach is not a file nothing governs.',
  // Budget simulator
  'sim.h': 'Budget simulator',
  'sim.v': 'all four tiers',
  'sim.sub': 'Drag a budget and watch what fits. Raising a budget can {b:evict} an item — the selector is first-fit, not a stable ranking with a cut line.',
  'sim.stair': 'Admission staircase — items admitted, per budget',
  'aria.tierBudget': 'Tier budget in tokens',
  'aria.tierpick': 'Tier',
  'sim.stairn': 'The sweep is {b:exact, not sampled} — the selector is re-run at every cumulative candidate cost, so nothing is invented between two rungs. The per-item costs it needs are {m:itemCost}, which is private in {m:select.ts} today: one export, and this chart is live.',
  'sim.thresh': 'Thresholds',
  'sim.snap': 'Every value between two rungs behaves identically, so the slider snaps to rungs — dragging lands on meaning rather than on {offrung}. A red rung is an {b:eviction}: more budget, fewer items.',
  'sim.tier': 'Tier',
  'sim.budget': 'Budget',
  'sim.fits': 'Fits',
  'sim.spills': 'Spills',
  'sim.chipn': 'The fits column is a {b:ratio}, not a count: "{fits} of {eligible}" says how much of what was eligible actually arrived, and the chip flips at the boundary. The row for the tier being dragged follows the slider.',
  'help.whyBudget': 'Why raising a budget can remove an item',
  'sim.evict': '{m:fitToBudget} is {b:first-fit}: it keeps trying later items after one does not fit. A larger budget admits a large item early, which can then crowd out two small ones that previously both fitted. "Spilled" is not a suffix of a priority list.',
  'sim.ratio': 'Selected, then not delivered',
  'sim.ration': 'Delivered grows from the centre toward the reading start, spilled toward the reading end, both normalised to the largest count in the table. A long red half names {b:which budget is too small}, which is the question this simulator exists to answer. The two numbers come from {m:audit_item.role} through {m:topItems} — already exported, already indexed, called twice.',
  // Injected now
  'inj.h': 'Injected now',
  'inj.v': 'live, not hypothetical',
  'inj.sub': "What this context window actually received, from the per-session seen file — the parent thread's, keyed as the hook keys it.",
  'th.when': 'When',
  'inj.note': 'Read from the seen file, not {m:Ledger.seen} — that is a replayed projection nothing here updates, and it would show a different number.',
  // Audit stream
  'watch.h': 'Audit stream',
  'watch.v': 'the only record of what spilled',
  'watch.sub': 'Six record kinds — mutations, injections, hook actions, focus changes, access refusals and progress steps. A focus change is a {b:regime change}, drawn as a rule across the feed rather than as one row.',
  'watch.pulsen': '{b:Activity pulse} — one column per ten seconds, newest at the reading-end edge. Height is records in that column, colour is the record kind. It is the only thing that makes a live stream feel live, and the time buckets it needs are already indexed by {m:idx_audit_at}.',
  'aria.wfilters': 'Filter',
  'watch.all': 'All',
  'th.at': 'At',
  'th.kind': 'Kind',
  'watch.shown': '{records} records shown',
  'watch.streamWaiting': 'connected — waiting for the next record',
  'watch.streamFault': 'the stream refused to continue: {error}',
  'watch.resync': 'the log rotated or moved — continuing from now; the history list below was refetched',
  // The four sentences the blank feed cost (plan:walk seq:52). A live tail that
  // is empty is UNMEASURED — "nothing since you opened this", never "no
  // records" — and the owner read a blank Watch screen as the second over a
  // corpus holding 2,076. `watch.emptyLog` is the MEASURED empty and says so in
  // those words; `watch.streamWaiting` above is still the unmeasured one.
  'watch.historyLine': 'already in the log when you opened this',
  'watch.backlogSome': 'The {shown} most recent records that were already in the log, replayed below the line. Earlier ones are in the log and are not on this stream.',
  'watch.backlogAll': 'All {shown} records that were already in the log, replayed below the line. Nothing was held back.',
  'watch.emptyLog': 'this corpus has no audit log at all — it was read to its beginning and holds nothing. A measured zero, not a filter and not a refusal.',
  'watch.delivered': '{delivered} delivered',
  'watch.spilled': '{spilled} spilled',
  'watch.tokens': '{tokens} estimated tokens, computed at injection time',
  'watch.tokensNotRecorded': 'tokens: not recorded — this record predates the field. Not zero.',
  'title.tokensNotRecorded': 'tokens not recorded',
  'watch.voidn': 'An injection row carries a gold bar of its cost against the {budget}-token budget. Where {m:tokens} is absent the row draws a {b:hatched void} and says so: the field is optional on {m:AuditRecord} and records written before 1.0.1 never had it. A zero-length bar would be a claim the record does not make.',
  // Ask
  'ask.h': 'Ask',
  'ask.v': 'filters, for people who do not write SQL',
  'ask.sub': 'Fields, operators and values — bound as parameters, composed on the server. No query text crosses the wire.',
  'aria.askTabs': 'What this asks',
  'ask.tab.audit': 'Audit history',
  'ask.tab.corpus': 'Corpus',
  'ask.field': 'Field',
  'ask.field.type': 'Category',
  'ask.field.status': 'Status',
  'ask.field.layer': 'Layer',
  'ask.field.always': 'Pinned (always)',
  'ask.field.scoped': 'Has scope',
  'ask.field.title': 'Title contains',
  'ask.field.any': '(any)',
  'ask.run': 'Run',
  'ask.updatedAtTrap': '{m:updated_at} is {b:index write time}, not a content timestamp — and this surface never rebuilds the index (it reads exactly what the hooks read), so rows are as the last hook or CLI run left them.',
  'ask.predefined': 'Predefined queries',
  'ask.predefined.ops': 'Operations by count',
  'ask.predefined.spilled': 'Most-spilled items',
  'ask.predefined.injected': 'Most-injected items',
  'ask.predefined.sessions': 'Sessions',
  'ask.sqlh': 'The query this composed',
  'ask.sqlCaption': 'the SQL this answer ran — shown so it teaches. The final {m:LIMIT} binds one row more than the cap: that extra row is the truncation signal, dropped before display.',
  'ask.sqln': '{b:Shown, never typed.} The server composed this from the fields above and bound every value as a parameter; the text is here so the shape of the corpus is learnable, not so it can be edited. There is no path from this box back to the database — {m:/api/ask} accepts the fields, never the statement.',
  'ask.whyq': 'Why there is no SQL box',
  'ask.why': "A {m:readOnly:true} connection still permits {m:VACUUM INTO '<any path>'}, which writes a full copy of the database wherever the statement says. A keyword scan is what stops it, and that scan cannot see keywords inside backtick or bracket identifiers. Removing the input removes the problem.",
  'ask.rows': '{rows} rows',
  'th.role': 'Role',
  'ask.truncated': 'capped at {rows} rows — more matched; raise the limit to see them',
  // The bound every list declares — one vocabulary across five surfaces.
  // `admittedOf` and `recentOf` are the two ORDERS a bounded list can honestly
  // claim; `displayOnly` is the clause the preview must carry so a display cap
  // is never read as a claim about what was injected.
  'list.allOf': 'Showing all {total}.',
  'list.admittedOf': 'Showing the first {shown} of {total}, in the order the selector admitted them.',
  'list.recentOf': 'Showing the {shown} most recent of {total}.',
  'list.displayOnly': 'A display limit. All {total} were in the injection — none were dropped.',
  'list.showAll': 'Show all {total}',
  'list.showFewer': 'Show fewer',
  // The way THROUGH the bound
  // (`REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`, owner,
  // 2026-08-27). Declaring the bound was never sufficient: a list saying "20
  // of 2,076" with no way to the other 2,056 has told the truth and left the
  // reader stuck.
  //
  // **These say WHERE YOU ARE, which is the requirement's own distinction** —
  // *"20 of 2,076" is a fact; "rows 21-40 of 2,076" is a position*. They
  // replace `admittedOf`/`recentOf` only once the reader has MOVED: those two
  // are already positions ("the first 20", "the 50 most recent") and they
  // carry the ORDER ruling in full, so the opening page keeps them and only a
  // page that has left the end needs row numbers instead.
  //
  // **`omittedBoth` is `/api/coverage`'s reading, deliberately not a second
  // one.** That endpoint already pages and its `omitted` "counts every
  // matching path this answer does not carry — the ones `offset` skipped as
  // well as the ones past `limit`" (`ui/read-model.ts`). Reporting only what
  // is AHEAD would leave the two surfaces meaning different things by the same
  // word. Weighed against the extra sentence's cost on the preview, where a
  // paged line already carries `displayOnly` after it: three short sentences
  // on a state the reader chose to enter, against two surfaces that disagree.
  'list.rowsAdmitted': 'Rows {from}–{to} of {total}, in the order the selector admitted them.',
  'list.rowsRecent': 'Rows {from}–{to} of {total}, oldest first — the newest are last.',
  'list.omittedBoth': '{before} before this page, {after} after it.',
  // ONE vocabulary for both `take` modes, and the row numbers beside them are
  // what fix the direction: on an append-only log the oldest rows carry the
  // LOW numbers, so "Previous" is older and the sentence says so without a
  // second pair of words for the same two buttons.
  'list.prevRows': 'Previous',
  'list.nextRows': 'Next',
  // The three empty states these two screens can be in. `zeroLines` and
  // `noSession` are DIFFERENT FACTS — a session that received nothing, and no
  // session being looked at — and `noSession` names the distinction out loud
  // rather than leaving a reader to infer it.
  'doc.zero': 'Checked — nothing at this level.',
  'inj.zeroLines': 'This session was read and has received nothing yet.',
  'inj.noSession': 'No session is selected, so nothing was read — which is not the same as a session that received nothing.',
  // The rail's count badges. Three states, because a badge that is merely
  // absent cannot tell "nothing needs attention" from "nobody looked" —
  // STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is.
  // Phrased to dodge verb agreement: "1 need attention" is wrong and
  // "1 needs attention" would need a plural rule the i18n grammar has no
  // marker for. A label form is correct at every count, in both languages.
  'rail.cntSome': 'awaiting attention: {count}',
  'rail.cntZero': 'nothing needs attention',
  'rail.cntNone': 'not measured — this screen’s endpoint refused',
  'ask.noRows': 'no rows matched',
  'ask.recallq': 'Why a search can return nothing',
  'ask.recall1': 'Matching is literal today, so {m:search "silently drop"} finds nothing while the corpus says "dropped silently". {b:Full-text search with a stemmer is decided} — behind {m:search} and {m:query_items} only, never in {m:select()}, so what gets injected stays deterministic.',
  'ask.recall2': '{b:The case is recall, not ranking.} That distinction is load-bearing: {m:core/search.ts} carries a written decision against ranking, and this does not touch it. It is also why the change ships with a parity test — measured, a naive swap took one query from {b:14 hits to 1}.',
  // Doctor
  'doc.h': 'Doctor',
  'doc.v': 'a findings list flattened to "exit 1" is what a terminal loses',
  'doc.sub': 'Grouped by finding code, three levels kept distinct, each linked to the item it names and the command that repairs it — composed, not run.',
  'doc.d1': 'its source document changed since the snapshot',
  'doc.d2': 'scope {mv:scope} matches no file',
  'doc.d3': '{b:zero files match any watched glob}, so the capture nudge can never fire. The shipped defaults name three paths from one workflow; this repo has none of them.',
  'doc.notice': 'notice',
  'doc.d4': 'a second cross-project knowledge store exists on this machine. {b:mycontext never reads or writes it} — reported so you learn it here rather than from a surprise.',
  'doc.d5': 'another plugin writes durable learnings here — the same kind as {m:lesson}, in a second spelling with no shared ids. It is a {b:watched} path, so edits nudge and a human decides.',
  // Decay
  'dec.h': 'Decay',
  'dec.v': 'a chart, not a table — of sessions',
  'dec.sub': 'Items not injected in the last N {b:sessions}. The unit is sessions, not weeks: the ledger holds one row per (session, item, tier) and a repeat injection inside one session collides, so what it stores is a set of first-injections, not an event stream — and an axis against a clock would be wrong here even where it would look better. The delivery history in the second card is a different measurement from a different source.',
  'dec.comb': 'Recency comb — one tooth per item, never bucketed',
  'dec.warm': 'warm',
  'dec.cold': 'cold',
  'dec.never': 'never injected — a kind, not a big number',
  'dec.badpin': 'pinned {b:and} cold — a defect signal, not decay',
  'dec.unres': 'unrestricted — a breadth view over cold ∪ warm, never a third bucket',
  'help.whyCold': 'What "cold" does and does not mean',
  'dec.help': 'The ledger records {b:injection}, not reading or reliance. A cold item may still be governing — and a cold {m:always:true} item is a bug in selection, not decay.',
  'dec.heat': '90-day delivery, per item — delivered against spilled',
  'dec.heatn': 'One cell per day. Intensity is how much was delivered that day, a {b:hatched} cell is a day the item was {b:spilled}, and an empty cell is a day nothing happened — six quiet weeks are six weeks of empty cells and need no reading. This is the one view that separates "quiet" from "selected and thrown away repeatedly". Its source is not the ledger, which records deliveries only: it is {m:audit_item.role} joined to {m:audit.at}, both indexed, with the {m:since} / {m:until} filters that already ship.',
  // Relations
  'gr.h': 'Relations',
  'gr.v': 'an ego-graph, not a hairball',
  'gr.sub': 'One focused item, radius 1, deterministic layered layout, hard cap of 60 nodes with an explicit "+N more". No physics, no dependency.',
  'gr.lfocus': 'focus',
  'gr.lmiss': 'target not in corpus',
  'gr.lsup': 'superseded',
  'gr.lbear': 'load-bearing',
  'gr.lref': 'referential',
  'gr.ldang': 'dangling',
  'gr.note': 'Nodes carry {b:ids}, not titles — which keeps bidi-sensitive text out of every SVG in the product. Every edge carries its {b:relation type} and its line style carries severity, because those are two different facts: {m:isLoadBearing} already classifies the vocabulary, so a dangling {m:relates_to} reads as noise and a dangling {m:constrains} reads as an alarm. Without that, a graph can only show breakage, never how much it matters — which is why the dangling edges need no separate table. Direction is the layout: the column decides which way the relation points, so nothing has to be simulated.',
  // Status
  'st.h': 'Status',
  'st.v': "a table is a terminal's home ground — a recorded exception",
  'st.sub': "Not the landing screen, and no longer justified by being one. It is where the header's corpus counts lead.",
  'st.items': 'Items',
  'st.drafts': 'Drafts awaiting review',
  'st.pending': 'Pending revisions',
  'st.staged': 'Staged lessons',
  'st.ingest': 'Unfinished ingests',
  'st.four': 'There are {b:four} unfinished-work queues, not one. {m:mycontext review} shows two of them.',
  // Review queue
  'work.h': 'Review queue',
  'work.v': 'the diff is the capability; the approval is a paste',
  'work.sub': 'Per-field staleness against the text in force. Nothing here writes.',
  'work.field': 'Field',
  'work.now': 'In force',
  'work.prop': 'Proposed',
  'work.moved': 'changed since staging',
  'work.blocked': 'promote refuses until re-based',
  'work.diffn': 'The proposed column is a word-level diff, not a second paragraph to compare by eye: additions are tinted, removals are struck, and both are real {m:<ins>} and {m:<del>} elements, so a screen reader announces the change without any added ARIA. The stale field carries a rule down its reading-start edge — the one physical offset in the sheet, and its mirror is written next to it rather than discovered later.',
  'state.armed': 'armed',
  'work.state': 'copied, not yet observed landing',
  'help.land': 'How you will know it worked',
  'work.h1': '{b:Run it in your own shell.} This tool never writes.',
  'work.h2': '{b:The receipt:} an audit record with {m:op: promote-revision}. Returning to this tab re-checks.',
  'work.h3': '{b:If the body moved first}, promote refuses and names both values — that refusal is the product working, not failing.',
  // Capture
  'cap.h': 'Capture',
  'cap.v': 'shows what already governs before you add another',
  'cap.sub': 'Composes an {m:add}. What it contributes over the CLI is the overlap check — the items already governing this scope.',
  'cap.already': 'Already governing {mv:scope}',
  'cap.o1': 'invariant, normative',
  'cap.o2': 'standard, normative',
  'cap.nosim': 'These are the items whose {b:scope matches}. No similarity or ranking is shown, because no similarity metric exists in this product — and inventing one here is how a mockup starts lying.',
  // Composer
  'pal.h': 'Composer',
  'pal.v': 'real pickers and a live glob tester',
  'pal.sub': 'Builds a command from selections. The argument list is shown as chips, so a value carrying shell syntax is visible before it reaches your clipboard.',
  'pal.argv': 'Arguments',
  'pal.block': '{b:Copy is blocked.} One argument contains shell substitution syntax. Double-quoting does not neutralise {m:$(…)} — a POSIX shell still substitutes inside double quotes.',
  'pal.glob': 'Glob tester',
  'pal.pattern': 'Scope pattern',
  'pal.globn': 'Every file in the repository, with the matches {b:lit as you type}. A count on its own — "{matches} files" — is a count you cannot inspect, and a count you cannot inspect is a count you cannot trust: the empty result and the nearly-empty result look identical until you can see which files. Matching goes through the same {m:globToRegExp} cache the selector uses, over {m:listRepoFiles}.',
  // Execute — the one Copy-and-Execute control (lib/command-actions.js).
  //
  // The RESIDUAL is deliberately not a key here. `src/ui/execute.ts` spells it
  // once and the confirm renders what the server sent, because a sentence
  // duplicated into the browser is a sentence that gets reworded on one side
  // only — and this is the one sentence a security boundary is made of.
  'exec.btn': 'Execute',
  'exec.h': 'Run this command?',
  'exec.go': 'Run it',
  'exec.cancel': 'Cancel',
  'exec.changes': 'What changes — in force, then proposed',
  'exec.exit': 'exit {code}',
  'exec.noexit': 'the command did not exit under observation',
  'exec.item.created': '{b:{mv:id}} — created',
  'exec.item.changed': '{b:{mv:id}} — changed',
  'exec.item.removed': '{b:{mv:id}} — removed',
  'exec.nochange': '{b:This changes nothing.} It was run against a copy of the corpus and no item came out different. It is still a write, and it still runs.',
  // Configure
  'cfg.h': 'Configure',
  'cfg.v': 'the strongest "a terminal cannot do this"',
  'cfg.sub': 'Every change previewed as a diff of what would govern, validated against the same {m:resolveConfig} that will read it.',
  'cfg.budgets': 'Budgets',
  'cfg.effect': 'What changes',
  'cfg.deltan': 'Each row is the {b:pair}, not the direction alone: the old value struck through, the new one highlighted, and the row tinted by which way it went. "What was it before" is half of "what changes", and a lone {m:+1} chip keeps the direction while losing the pairing.',
  'aria.scopepolicy': 'scopePolicy',
  'cfg.spn': 'The border colour and the count {b:are} the blast radius: how much of the corpus stops working if this value changes. {m:inert} is the most destructive change the configuration offers, and {m:scopePolicyFor} makes its effect computable exactly rather than estimated — the items are named, and the ones past the cut are counted rather than hidden.',
  'cfg.apply': 'Apply this',
  'cfg.nocmd': 'There is no command that edits a budget. Configuration is a file, and the deny hook says so in those words: {i:"changes to {m:.my_context/config.json} are the user\'s to make — ask, do not edit."} So this is the edit, not a command.',
  'btn.copypatch': 'Copy the patch',
  'cfg.watched': 'Watched documents',
  'cfg.watchednote': '{m:init} writes what this repository actually has, rather than shipping three paths from one workflow that match nothing here. The list {b:replaces} and never merges — a list you wrote must not silently gain globs you did not.',
  'cfg.h1': '{b:Edit the file yourself.} Nothing here writes it, and the hook refuses an agent that tries.',
  'cfg.h2': '{b:The receipt:} this screen re-reads {m:config.json} from disk on every load, so returning to the tab shows the new value — or a {m:parseError} field if the JSON broke.',
  // Procedures
  'pr.h': 'Procedures',
  'pr.sub': 'An ordered set of steps performed {b:once} and then done — as against a rule, which is one instruction that applies every time. A rule is a single instruction; a procedure is a sequence. Decided; nothing implements it yet.',
  'pr.states': 'Four states, and exactly one of them injects',
  'th.state': 'State',
  'pr.mean': 'Meaning',
  'pr.inj': 'Injection',
  'pr.s1': 'written, not approved. An agent may author one here',
  'pr.none': 'not injected',
  'pr.s2': 'you approved it',
  'pr.idx': 'index line only',
  'pr.s3': 'you initiated it',
  'pr.full': 'in full, every session',
  'pr.s4': 'completed',
  'pr.why': '{b:Injecting only in {m:active} is the mechanism, not a sentence asking the model to wait.} A procedure the model holds in full is one it may begin following, so it is delivered only in the state you put it in deliberately. The failure this guards against is not the obvious one: it is a procedure left {m:active} forever, injecting in full long after the work finished.',
  'pr.item': '{mv:item}',
  'pr.steps': 'steps',
  'pr.k1': 'Add the integer column beside the decimal one',
  'pr.k2': 'Backfill, and verify the two agree on every row',
  'pr.k3': 'Switch reads to the integer column',
  'pr.k4': 'Switch writes, behind the flag',
  'pr.k5': 'Drop the decimal column',
  'pr.md': 'Steps are a {m:## Steps} section in the Markdown, parsed the way {m:## Observations} already is. {b:"{done} of {steps}" is counted, never stored} — there is no second place a procedure could disagree with itself.',
  'pr.write': 'Who may tick a box',
  'pr.w1': '{m:mycontext procedure step} may flip {b:one checkbox}, matched by a strict pattern, and may reach no other byte of the item. It does not go through the draft gate.',
  'pr.w2': '{b:That is a distinction, not an exemption.} The gate exists to stop an agent changing normative {i:content}; a checkbox is {i:progress}. Every flip is audited, so the relaxation is visible rather than quiet.',
  'pr.w3': '{b:What is not relaxed:} the state. {m:active → done} stays yours. Ticking the last box does not close the procedure — it lets the agent {i:ask}. An agent that can mark its own procedure done can declare victory.',
  'pr.aband': 'Abandoned rather than finished is {m:superseded} — the existing status already means exactly that, and a fifth spelling of one idea is the defect this project has paid for four times.',
  // Export / import
  'port.h': 'Export / import',
  'port.sub': '{b:Built, and this screen reports it.} It used to list five open questions; all five are answered now, so it lists the answers instead.',
  'port.what': 'What travels',
  'port.yes': 'travels',
  'port.filtered': 'filtered',
  'port.no': 'rebuilt',
  'port.hist': '{b:History travels, and it is filtered.} Mutations carry; injections, hook actions, focus records, refused requests and procedure ticks do not — they describe a machine, not a corpus. Imported records land in {m:.audit/imported/} so a receiver can always tell what it witnessed from what it was told.',
  'port.fmt': 'The format, in order of preference',
  'port.f1': 'A plain directory',
  'port.f1n': 'canonical. Readable, diffable, and needs no tool to open',
  'port.f2n': 'where git exists — carries real history, one file',
  'port.f3': 'Deterministic ZIP',
  'port.f3n': 'otherwise. Fixed order and fixed timestamps, so the same corpus is the same bytes',
  'port.git': '{b:What it adds over git:} the corpus lives in the repository, so this is for someone {i:not} sharing it — another workspace, another team, or a machine with no remote in common.',
  'port.coll': 'On import — three buckets, and nothing applies unconfirmed',
  'th.bucket': 'Bucket',
  'th.example': 'Example',
  'port.b1': 'new',
  'port.b2': 'same id, different content',
  'port.b3': 'identical',
  // Template packs
  'pk.h': 'Template packs',
  'pk.sub': 'A pre-authored corpus someone published — "the regulated-industry flavour" — imported at {m:init} to start from an opinion instead of an empty directory.',
  'pk.trust': 'Where it lands, and why that differs',
  'pk.active': 'draft',
  'pk.draft': 'draft',
  'pk.trustn': '{b:Both routes land the same way, and it is draft} — there is one importer behind them, and it writes every item a pack brings in as a proposal. Choosing a pack at init looks like the act of trust, but an empty corpus is exactly where an unreviewed opinion is hardest to notice, so the import asks rather than assumes. {b:There is no {m:--trust} flag}; a boundary a flag can override is not a boundary.',
  'pk.what': 'What a pack may carry',
  'pk.cats': 'category configuration',
  'pk.never': 'never',
  'pk.line': 'The line, once: a pack carries what its author knows about the {b:domain}; never a setting that describes {b:you} — your context budget or your repository layout. The author cannot see either.',
  'pk.man': 'Integrity, described accurately',
  'pk.m1': 'Digest',
  'pk.m1n': 'full, per file, sorted',
  'pk.m2': 'Version',
  'pk.m2n': 'descriptive, supplied by the author when packing — there is no git address to derive one from',
  'pk.m3': 'Discovery',
  'pk.m3n': 'a curated list in the docs. No registry, no re-fetch, no version check over the network',
  'pk.m4': 'Updating',
  'pk.m4n': 'import again; the three buckets show what changed',
  'pk.theatre': '{b:What the digest does not prove.} A checksum a pack carries about itself is transit integrity — the files arrived intact. It is not evidence the author is trustworthy, and it never gates activation. The item {m:checksum} field is a 16-hex truncation for drift detection and is a different thing entirely; a pack manifest does not reuse it.',
  // Documentation
  'dv.h': 'Documentation',
  'dv.v': 'cross-linked to your own corpus, which a docs site cannot do',
  'dv.sub': "The repository's own README, rendered here and addressed by heading ordinal — so one integer gives both a deep link and a language switch that lands on the same section.",
  'dv.toc': 'Contents',
  'dv.t1': 'What this is',
  'dv.t2': 'Install',
  'dv.t3': 'The four tiers',
  'dv.t4': 'Scope',
  'dv.t7': 'The trust boundary',
  'dv.parity': 'The EN/HE switch self-disables when the parity test is red — a mirror that has drifted is worse than none.',
  'dv.rendered': '§{ordinal} — {heading}',
  'dv.mdnote': 'Rendered by a hand-written subset renderer: no HTML string is ever produced, so there is nothing to sanitise. Raw HTML, images and unknown URL schemes are {b:refused and shown as refusals}, not silently dropped.',
  // Tutorials
  'tu.h': 'Tutorials',
  'tu.v': 'each one titled with a job, not a feature',
  'tu.sub': 'Six replacing two. Every transcript is a generated block, so a tutorial cannot teach a flag that no longer exists without a test going red.',
  'tu.t': 'Tutorial',
  'tu.job': 'The job it answers',
  'tu.1': 'First twenty minutes',
  'tu.j1': 'I have just installed this',
  'tu.todo': 'to write',
  'tu.2': 'When it did not fire',
  'tu.j2': 'the model did the banned thing',
  'tu.3': 'Scope and the empty scope',
  'tu.j3': 'what governs this file',
  'tu.4': 'Budgets and spill',
  'tu.j4': 'why did that not arrive',
  'tu.5': 'Review and revisions',
  'tu.j5': 'settle what is open',
  'tu.6': 'Ingest a document you already wrote',
  'tu.j6': 'I have a spec, not items',
  'tu.gap': 'Hebrew is shown as {b:to write} rather than as a language toggle that would silently fall back to English. The changelog already records that the tutorials have no parity test; this is that gap, drawn.',
  // Learn
  'ln.h': 'Learn',
  'ln.v': 'conditional pass — the corpus cross-links earn it',
  'ln.sub': 'The four help topics, each linked to the items in {i:this} corpus that demonstrate it. That join is what a docs page cannot do.',
  'ln.c': 'which are normative',
  'ln.s': 'how scope restricts',
  'ln.p': 'what to write down, and when',
  'ln.w': 'the queue, revisions, supersede',
  'aria.pane': 'Item detail',
  'aria.paneclose': 'Close',
  // Added 2026-08-27 for `plan:pane`. The mockup declares neither, and that is
  // legal now: the 2026-08-26 ruling dropped the app->mockup direction from
  // `strings-parity`, so a key the design of record never drew no longer fails
  // in the invented direction. The GAP direction still fails, so the mockup can
  // still catch what the app is missing.
  'aria.panegrip': 'Resize the item pane',
  'aria.panefloat': 'Expand the item pane',
  // Chrome — the item detail pane, the status strip, the exit banner
  'pane.type': 'type',
  'pane.status': 'status',
  'pane.tier': 'tier',
  'pane.scope': 'scope',
  'pane.gov': 'governs',
  'pane.file': 'file',
  'pane.hist': 'Delivered — twelve weeks',
  'pane.histn': 'Twelve weekly buckets from the audit projection, hatched where the item was {b:spilled} that week and grey where nothing was delivered. It is the cheapest possible answer to "is this thing still alive", and the one history that belongs on {i:every} item rather than on a screen of its own.',
  'pane.body': 'Body — as authored',
  'pane.well': "Corpus text sits in a well and inside {m:<bdi>}. The product's own words never do — that is how you tell them apart.",
  'aria.prov': 'Provenance',
  'title.gitState': 'Click to cycle the six git states the spec requires',
  'strip.branch': 'branch {mv:branch} @ {mv:commit}',
  'strip.detached': 'detached HEAD @ {mv:commit}',
  'strip.inSync': 'in sync with origin/{mv:branch}',
  'strip.differs': 'differs from origin/{mv:branch}',
  'strip.noUpstream': 'no upstream',
  'strip.unknownTip': 'the local tip could not be read',
  'strip.notARepo': 'not a git repository',
  'strip.items': 'items',
  'strip.inj': 'injections today',
  'title.ctx': 'Click to cycle the five context states and the three project-knowledge answers',
  'strip.ctx.known': 'context {pct}% ({used} of {size}) — as of last response, {age} ago',
  'strip.ctx.notYetKnown': 'context not yet known — no API call since the last compact',
  'strip.ctx.unknown': 'context unknown — this Claude Code build sends no {m:context_window}',
  'strip.ctx.noBridge': 'showing only what mycontext injected — that is all this number is. The status line bridge is not installed; {m:mycontext statusline install} shows what installing would change, and asks.',
  'strip.ctx.cold': 'cold session — a hypothetical has no live context number',
  'strip.myctx': '{tokens} of it from project knowledge ({injections} injections)',
  'strip.myctxPartial': '≥{tokens} of it from project knowledge ({injections} injections, {unrecorded} not recorded)',
  'strip.myctxUnavailable': 'project-knowledge share unavailable: {error}',
  'strip.append': 'audit append p95',
  'strip.meas': 'measured',
  'strip.rt': 'simulate reduced-transparency',
  // The provenance bar — one home for the qualifications every screen owes
  'prov.projFresh': 'already current',
  'prov.projCaughtUp': '{mv:state} and caught up before answering',
  'prov.projFailed': 'could not catch up — no partial answer is shown: {error}',
  'ex.msg': 'The server has exited. This page shows what it last knew.',
  'ex.stale': 'Not connected. Refresh this page — if it stays that way this browser holds no credential for the server, and the link it printed is the way back.',
  'ex.ok': 'OK',
};
