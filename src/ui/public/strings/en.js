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
 * `const HE = {…}` table. DROPPING a key the mockup declares fails
 * `test/ui/strings-parity.test.ts` in the direction that names it. ADDING one the
 * mockup does not declare does NOT, and has not since 2026-08-26:
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped the
 * invented direction, leaving the mockup as history and as a list of gaps rather
 * than as a permission slip. The gate's own docstring is the authority on which
 * directions exist on the day you read this; this paragraph said the opposite for
 * three days and fifteen modules quoted it rather than the gate.
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
  'sess.nocred': '{b:This page has no credential} — that is not the same as an empty corpus. The credential lives in the URL fragment, so a bookmark, a typed address, or a reload cannot recover it. Run {m:mycontext ui --nonce} and open the link it prints, fragment included.',
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
  // The picker's own disclosure. It holds ONE EXEMPLAR PER RUNG — the first
  // item by id that fails there — so it is stable against exactly the changes
  // a reader is trying to observe, which is what "cannot see changes to why
  // not" was reporting. Said rather than replaced: the rung a reader is
  // usually chasing is the budget, and every item that failed THAT now has a
  // list of its own below.
  'preview.spec': 'The strip holds one {b:specimen} per gate — the first item by id that fails there — so it holds still while your selection moves. Every item that really spilled is named under {b:Not delivered} below, in the order the selector considered it. Each specimen now carries {b:how many items fail with it}, and the ladder below carries that count for every gate — including the gates nothing fails at, which say zero rather than going blank.',
  'preview.spill': 'Not delivered — every item that spilled, and what it cost',
  'preview.spilln': 'One row per item in {m:Selection.spilled}, {b:whole across every tier this event ran} — not the ribbon\'s per-tier split — in the selector\'s own candidate order, which is load-bearing: first-fit admits greedily, so the same three costs in a different order spill a different item. {b:band} appears where the tier offered its candidates in more than one: on a tool event band 1 is the items whose own globs name this path and band 2 is the items that match only by having no scope at all, so a scoped item displacing an unscoped one is visible rather than mysterious. An index line shows {b:—} instead of a cost: the index tier admits lines, and per-line costs are exposed by no endpoint, so the number is absent rather than invented.',
  'preview.ribbon': 'Budget ribbon — five tiers, and what fell out of each',
  'preview.ribbonn': 'One segment per admitted item, sized by its real {m:itemCost}. Beneath each track is the {b:ghost lane}: every spilled item at the width it would have taken, in the position the selector considered it. A wide ghost followed by a narrow fill is first-fit being honest — drawing spills as a tail would misrepresent the algorithm. A tier this event never reaches is drawn as {b:absent}, hatched and named; an empty track would claim it ran and delivered nothing, which is a different fact. Follows the event selector above rather than adding a second one.',
  // ── The absent-tier ribbon, keyed ─────────────────────────────────────
  //
  // Added 2026-08-29. These two sentences shipped as ENGLISH LITERALS with no
  // key and no `ctx.t`, so the screen switched language around them and they
  // did not move. No gate could see it: `strings-parity` compares KEY SETS, and
  // a string with no key is invisible to it — there is nothing to be missing
  // from the other table — while `bidi.spec` censuses runs per `data-t` and text
  // under no `data-t` is not censused either. The gates are sound; the defect
  // was outside what they measure. `test/ui/screen-literals.test.ts` is the
  // check that now measures it.
  //
  // The copy is NOT invented: the design of record draws both sentences in
  // `renderRibbons`' own `if(!runs)` branch, with a Hebrew form beside the
  // English, so both tables carry the mockup's own words. What was missing was
  // only a key.
  'preview.notrun': 'does not run on this event',
  'preview.notrunn': 'Absent, not empty — this event never reaches the tier at all.',
  'preview.contover': '{b:Continuity overflow} — {n} continuity item(s) did not fit {m:budgets.continuity}: {mv:ids}, costing {mv:cost} against a budget of {mv:budget}. The continuity guarantee is NOT in force for this session. It is said here, in the injected block itself and as a doctor finding, because a continuity item dropped in silence is the exact defect this tier exists to end.',
  // ── The warm/cold question, the `seen` gate, and the When column ───────
  //
  // Added 2026-08-29 with the fix for "Not delivered is not working". Three
  // groups, and each closes a hole the screen had been drawing a zero over.
  'preview.qwarmn': 'the seen set it has really been given',
  'preview.qnote': '{b:Two questions, not two views.} The default is what the session above would be given now — seen set, focus and carry included, which is what {b:exactly what Claude gets} means. {b:Cold} answers what a brand-new window would get from the same corpus. Both are legitimate; neither is ever shown as the other, and the pressed control says which one you are reading.',
  'preview.seen': '{b:Filtered before budgeting} — {n} item(s) reached the {m:seen} gate and were removed there, because this session has already been given them. Rung 5 runs before any tier picks its candidates, so this is what the gate removed and not what would otherwise have arrived.',
  'preview.seen0': 'Nothing was removed at the {m:seen} gate: none of the injectable corpus has been delivered to this session yet. A cold preview always reads zero here, because a brand-new window has been shown nothing.',
  'preview.spillNone': 'Everything that reached the budget gate fit — {n} candidate(s) went in and none spilled. That is a full budget, not an empty answer.',
  'preview.spillUnreached': 'Nothing reached the budget gate. {n} item(s) were removed one gate earlier, at {m:seen}, as already delivered to this session — so no tier had a candidate left to offer it. This zero is {b:not} "nothing spilled".',
  'preview.spillNoCand': 'Nothing reached the budget gate, and nothing was removed at {m:seen} either: no tier that ran on this event had a candidate to offer. This zero is {b:not} "nothing spilled".',
  'preview.gseen': 'already delivered to this session, so it was filtered at the {m:seen} gate — before any budget was consulted',
  // ── What the path picker can and cannot do ─────────────────────────────
  //
  // Added 2026-08-29. Owner: "event - when selecting tool, the path should be
  // used as filter but it does nothing". Traced end to end and the wiring is
  // whole: the control refetches, `ctx.path` is set, `jitTarget` normalises it
  // and the jit tier filters on `matchesScope`. What makes it inert is the
  // CORPUS — `matchesScope` returns true for an item with no scope of its own
  // whenever its category's `scopePolicy` is not `inert`, and 619 of this
  // repository's 621 items carry `scope: []`. So the candidate set is the same
  // whatever path is chosen, and the owner reasonably read a control that
  // cannot change the answer as broken.
  //
  // The fix is DISCLOSURE AT THE POINT OF USE, not a rewrite and not hiding
  // the control — a missing control is the same silence one step further on.
  // Every figure here is counted from `/api/items`' own `scope` field and
  // `/api/config`'s resolved `scopePolicy`; nothing is estimated.
  'preview.scope': '{b:The path narrows the {m:jit} tier and nothing else, and it can only narrow items that declare a scope.} {b:{scoped} of {total}} items in this corpus do. The other {b:{unscoped}} carry {m:scope: []}, and under the {m:scopePolicy} in force for their categories an unscoped item is {b:unrestricted} — it matches every path — so changing the file above cannot change whether they are candidates.',
  'preview.scopeinert': 'Of those unscoped items, {b:{inert}} belong to a category set to {m:scopePolicy: inert}, under which an item with no scope of its own matches {b:no} path at all — so the file above cannot bring them in either.',
  'preview.scopeunk': '{b:The path narrows the {m:jit} tier and nothing else, and it can only narrow items that declare a scope.} {b:How many of this corpus\'s items declare one is unmeasured here} — the scope join did not answer, so what the path can do on this corpus is left unstated rather than guessed at: {mv:reason}.',
  // ── Each rung's own population ─────────────────────────────────────────
  //
  // Added 2026-08-29. The picker offered three names over a corpus where 564
  // items failed — 551 of them at one rung — and the card said "of how many"
  // nowhere at all, so a specimen standing for 551 read as the whole set. The
  // picker is unchanged (one exemplar per rung is the design, and 139 names
  // would be `preview.whyn`'s own objection one axis along); what these
  // sentences add is the number the specimen stands in for, on every rung,
  // including the rungs nothing fails at.
  'preview.rungn': '{b:{n} item(s) fail at this gate.} The strip above names the first of them by id; the rest are listed below.',
  'preview.rung0': '{b:No item fails at this gate.} A measured zero: every item in the corpus was put to this gate and none stopped here — not a rung nobody looked at.',
  // Rung 4 never takes a plain number and never takes the zero above. Its
  // count is the item-level half of a question the other half of which no
  // endpoint answers, and a bare `0` would claim this event's path excluded
  // nothing — the one thing nobody measured.
  'preview.rungunk': "{b:{n} item(s) fail at this gate at the item level} — an item with no scope of its own under {m:scopePolicy: inert}. How many the event's own path excludes is {b:unmeasured}: the per-event {m:matchesScope} refusal is served by no endpoint, so the items it drops are absent from this ladder rather than counted on it. Not a zero, and no list of them can be drawn here.",
  'preview.rungseen': '{b:{n} item(s) fail at this gate.} Every one of them is named under {b:Filtered before budgeting}, in the {b:Not delivered} card below.',
  'preview.rungspill': '{b:{n} item(s) fail at this gate.} Every one of them is named under {b:Not delivered} below, with the tier that dropped it and what it cost.',
  'preview.rungopen': 'Every item stopped at {mv:gate}, by id — the strip above names the first of them, and this is the rest of what it stands for.',
  'preview.pickn': 'first of {n}',
  'preview.pickunk': 'first of {n} measured',
  'preview.when': '{b:The When on each row is the past, not this preview.} A preview is a simulation: nothing here is being injected as you read it. Each row carries the last time that item really was delivered, or really did spill, from {m:audit_item.role} joined to {m:audit.at} — matched on the tier the row itself names, and naming the tier when only another one has a record. Two rows can be weeks apart and both be right.',
  'preview.whenoff': '{b:Delivery times unavailable} — {reason}',
  'preview.whenabsent': '{b:Delivery times unavailable} — the audit projection has never been built in this workspace, so there is no record to read. {m:mycontext audit} builds it; a read surface may not, because building it is a write.',
  'preview.whentrunc': 'The delivery-time answer was cut at {n} rows, so a row may read {b:never} where the log holds an older record than the cut.',
  'preview.lastinj': 'last delivered {mv:at} · {mv:tier}',
  'preview.neverinj': 'never delivered',
  'preview.lastspill': 'last spilled {mv:at} · {mv:tier}',
  'preview.neverspill': 'never spilled before',
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
  // `plan:live seq:3` — the shared, footer-strip affordance a screen that
  // declares `refresh: 'ask'` draws instead of silently rebuilding itself.
  // One line, reused across every screen it appears on rather than named per
  // screen: it says something arrived, not WHAT — the screen's own re-render,
  // once pressed, is what answers that. `btn.refresh` above is its control.
  'live.screenStale': 'New activity for this screen.',
  // **THE SCREEN'S OWN UNREAD STATE**, drawn between the route and the first
  // paint. `route()` clears the section and then awaits a dynamic import; for
  // the length of that fetch the `body` row was a full-height band of nothing
  // — 610px of it, measured on `preview` at 1280x720 on 2026-08-29 by
  // `e2e/app-layout.spec.ts`'s "no silent band" assertion. `route()` said so
  // itself and deferred the fix for want of a key: "no string-table key exists
  // yet for a transient loading state ... Open question, this task's report."
  // This is that key, and it is the SAME named state the strip already draws —
  // STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is, clause 3: a
  // blank cannot tell a reader whether the screen is empty, broken or still
  // arriving, and one that cannot tell those apart stops trusting the surface.
  'screen.unread': 'not read yet',
  'title.screenUnread': 'This screen has not been read yet — its module and its figures are still arriving. Nothing is drawn because nothing has been measured, not because there is nothing to show; whatever the screen has to say replaces this the moment it lands.',
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
  'gaps.cat': 'category {mv:name}',
  'gaps.r3': 'empty',
  'gaps.note': '{b:Not examined} is a third state, never folded into "gap". A file the walk did not reach is not a file nothing governs.',
  // Budget simulator
  'sim.h': 'Budget simulator',
  'sim.v': 'all five tiers',
  'sim.sub': 'Drag a budget and watch what fits. Raising a budget can {b:evict} an item — the selector is first-fit, not a stable ranking with a cut line.',
  'sim.stair': 'Admission staircase — items admitted, per budget',
  'aria.tierBudget': 'Tier budget in tokens',
  'aria.tierpick': 'Tier',
  'sim.stairn': 'The sweep is {b:exact, not sampled} — the selector is re-run at every cumulative candidate cost, so nothing is invented between two rungs. The per-item costs it needs are {m:itemCost}, exported from {m:select.ts} for exactly this chart.',
  'sim.rangeh': 'Range maximum',
  'sim.rangebtn': 'Set range',
  'sim.rangen': 'The slider explores a range; this sets the range. It is the {b:simulator’s own bound} and not a budget — nothing here writes {m:config.json}. It can never fall below the budget in force, which the slider must always be able to reach, and raising a budget past it — here or on Configure — raises it. The injection preview draws its ribbon to the same range.',
  'sim.rangeset': 'Range maximum for {mv:tier} is now {max}.',
  'sim.rangebad': 'The range maximum must be a positive integer. Got {typed}. Nothing was changed.',
  'sim.thresh': 'Thresholds',
  'sim.snap': 'The thumb moves in single tokens and lands where you put it — the ladder marks the rung that actually governs. Every value between two rungs behaves identically, so {offrung} decides exactly what the rung below it decides. A red rung is an {b:eviction}: more budget, fewer items.',
  'sim.tier': 'Tier',
  'sim.budget': 'Budget',
  'sim.fits': 'Fits',
  'sim.spills': 'Spills',
  'sim.chipn': 'The fits column is a {b:ratio}, not a count: "{fits} of {eligible}" says how much of what was eligible actually arrived, and the chip flips at the boundary. The row for the tier being dragged follows the slider.',
  // The ratio the fits chip draws, in the words `sim.chipn` above already
  // quotes — the mockup's own `' of '`, which used to reach the page as an
  // unkeyed English literal and now does not.
  'sim.fitsOf': '{fits} of {eligible}',
  'help.whyBudget': 'Why raising a budget can remove an item',
  'sim.evict': '{m:fitToBudget} is {b:first-fit}: it keeps trying later items after one does not fit. A larger budget admits a large item early, which can then crowd out two small ones that previously both fitted. "Spilled" is not a suffix of a priority list.',
  'sim.ratio': 'Selected, then not delivered',
  'sim.ration': 'Delivered grows from the centre toward the reading start, spilled toward the reading end, both normalised to the largest count in the table. A long red half names {b:which budget is too small}, which is the question this simulator exists to answer. The two numbers come from {m:audit_item.role} through {m:topItems} — already exported, already indexed, called twice.',
  // ── The question: this session, or a brand-new one (plan:walk seq:86) ────
  // The injection preview's precedent, carried to the second screen with the
  // same defect. Warm stays the default; cold is offered and LABELLED.
  'sim.qnote': '{b:Two questions, not two views.} The default is what the session in the strip above would be given now, with the {m:seen} set it has really been handed. {b:Cold} answers what a brand-new window would get from the same corpus. Both are legitimate, neither is ever shown as the other, and the pressed control says which one this screen is answering.',
  'sim.seen': '{b:Filtered before budgeting} — {n} item(s) were removed at the {m:seen} gate, because this session has already been given them. That gate runs before any tier picks its candidates, so a tier reading 0 of 0 below may be empty for that reason rather than because nothing qualified. Ask the cold question to see what a brand-new window would be given.',
  'sim.seen0': 'Nothing was removed at the {m:seen} gate, so an empty tier below is empty because nothing qualified for it. A cold question always reads zero here: a brand-new window has been shown nothing.',
  'sim.zeroSeen': 'everything it could have had was already delivered',
  'sim.zeroNone': 'nothing qualified for it',
  'sim.stair0seen': 'No rung to draw. The {m:seen} gate removed {n} item(s) before this tier picked its candidates, so it had none left to admit — this staircase is empty for a measured reason rather than an unknown one.',
  'sim.stair0none': 'No rung to draw: nothing qualified for this tier under the question being asked.',
  'sim.stairIndex': 'The {m:index} tier admits index LINES rather than items, and no endpoint exposes per-line costs — so there is nothing here to price. Absent, not empty.',
  'sim.stairNoPath': 'The {m:jit} tier is reached only by a {m:tool} event, which needs a file path, and this repository walk offers none. Absent, not empty.',
  // ── The readout under the staircase (mockup #readout) ────────────────────
  // The words are the design of record's own, lifted from `renderStair`'s
  // unkeyed English/Hebrew ternaries and given the keys it never had.
  'sim.readout': '{b:{fits} in · {spills} out · {used} tokens used}',
  'sim.nextin': 'next in at {mv:at} — {mv:id}',
  'sim.evictw': 'Raising this budget evicts at least one item — see the downward step. First-fit is not monotone in membership.',
  // ── The recommendation carries the numbers (plan:budget seq:2) ───────────
  'sim.rech': 'What this tier costs, what it is set to, and what it would have to be',
  'sim.recn': 'The {mv:tier} tier costs {cost} tokens for the {n} item(s) that reached it, is set to {set}, and would have to be {need} for every one of them to be admitted.',
  'sim.recNone': 'Not measured: this tier has been swept under no question this screen can ask, so there is no cost to report and no value to recommend. Nothing is guessed.',
  'sim.recExact': 'Exactly enough',
  'sim.recExactn': 'admits all {n} · costs {cost} tokens of the window',
  'sim.recGrow': 'Room to grow',
  'sim.recGrown': 'admits all {n} with {pct}% headroom for the corpus to grow · costs {cost} tokens of the window',
  'sim.recCeil': 'The most this tier may take',
  'sim.recCeiln': 'leaves the other four tiers their {other} tokens and a {pct}% working reserve inside the {win}-token window · costs {cost} tokens',
  'sim.recCeilNon': 'not offered: no window has been measured, and a ceiling against a guessed window is worse than no ceiling at all',
  'sim.recFreeh': 'Or a value of your own',
  'sim.recGo': 'Simulate it',
  'sim.recSet': 'Simulating {mv:tier} at {value}.',
  'sim.recRange': 'Simulating {mv:tier} at {value}. The range maximum rose to {max} so the slider can reach it.',
  'sim.recBad': 'A budget must be a positive integer written in digits. Got {typed}. Nothing was changed.',
  // ── Validation is against the whole window (plan:budget seq:3) ───────────
  'sim.winh': 'All five budgets, against the whole window',
  'sim.winOk': '{total} tokens across all five tiers, of a {win}-token window — {pct}% — leaving {left} tokens to work in, which clears the {res}% working reserve this screen holds back.',
  'sim.winTight': '{total} tokens across all five tiers, of a {win}-token window — {pct}%. It fits, and it leaves only {left} tokens to work in, under the {res}% working reserve. A budget that technically fits and leaves nothing to work in is still wrong.',
  'sim.winOver': '{total} tokens across all five tiers does not fit a {win}-token window: {over} tokens over. A single budget that passes on its own while the five together do not is the failure this check exists to catch.',
  'sim.winNone': '{b:Not validated, and not guessed.} No context window has been measured for this session, so there is no ceiling to hold five budgets to. {m:context_window_size} comes from Claude Code’s status line and from nowhere else this product can reach, and a model-to-window table measured this machine wrong by 5x — so this screen names what is missing instead of accepting or rejecting numbers against a guess. Install the bridge with {m:mycontext statusline install}.',
  // ── A full window is a state with a next step (plan:budget seq:4) ────────
  'sim.full': '{b:This cannot take effect in the window you have now.} {used} of {win} tokens are already in use, {free} are left, and the five budgets ask for {total}. Run {m:/compact} or {m:/clear} and the {n} {mv:tier} item(s) will arrive — budgets are read at session start, so that is the moment a new value takes effect. The value is set either way; only its consequence is deferred.',
  // ── An edited budget shows what it was (plan:budget seq:6) ───────────────
  'sim.restore': 'Restore the values in force',
  'sim.wasn': '{b:The first number is the budget in force} — what {m:config.json} holds for this tier right now — and the second is the value being simulated. {b:Restore} puts the slider and every range back to it, and is enabled only while something has changed.',
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
  // The regime rule's own label. `watch.sub` above already carries the phrase
  // in both languages; the ROW that draws the rule used to carry it as an
  // English literal in the module, which is the one place the language toggle
  // cannot reach.
  'watch.regime': 'regime change',
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
  // The FETCH cap, and it is deliberately not one of the `ask.field.*` options
  // above: those name a column to filter ON, this names how many rows to ask
  // for. Reading it as a field would put "limit is 100" in a row of filters,
  // where it would look like a narrowing of the corpus rather than a bound on
  // the answer.
  'ask.limit': 'Rows to fetch',
  // The operator select's two options. The mockup draws them as bare
  // literals with no `data-t`, so they used to be the only prose on the Ask
  // screen the A/א toggle could not reach.
  'ask.opIs': 'is',
  'ask.opIsNot': 'is not',
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
  // The same fact at the TOP of the ladder, where the sentence above stops
  // being an instruction and becomes a dead end: the limit control is already
  // at the highest value the endpoint serves, so "raise the limit" names a move
  // the reader cannot make. Two sentences rather than one because a control at
  // its stop that is told to move is indistinguishable from a broken one.
  'ask.truncatedMax': 'capped at {rows} rows — more matched, and this is the largest answer this endpoint serves. Narrow the filter to reach the rest.',
  // The bound every list declares — one vocabulary across five surfaces.
  // `admittedOf` and `recentOf` are the two ORDERS a bounded list can honestly
  // claim; `displayOnly` is the clause the preview must carry so a display cap
  // is never read as a claim about what was injected.
  'list.allOf': 'Showing all {total}.',
  'list.admittedOf': 'Showing the first {shown} of {total}, in the order the selector admitted them.',
  // The THIRD order, and it exists because the other two would each say
  // something false about a list of items that did NOT arrive. `admittedOf`
  // puts "admitted" under the one card whose subject is everything that was
  // not; `recentOf` claims a time a computation never happened at. What is
  // true of a spill is the position the selector CONSIDERED it in — first-fit
  // is greedy, so that order decides which item spills — and that is the
  // wording `ui/read-model.ts` already uses for the same field.
  'list.consideredOf': 'Showing the first {shown} of {total}, in the order the selector considered them.',
  'list.recentOf': 'Showing the {shown} most recent of {total}.',
  // The FOURTH, and the one that names no order at all — for a table whose
  // order is the SERVER's and changes with the question asked (the Ask screen's
  // result table: newest-first on the audit tab, by id on the corpus tab, by
  // count on a predefined report). The other three would each be false on two
  // of those three. See `orderKeyFor` in `screens/parts.js` for why saying
  // nothing is honest there and would not be on the four lists above.
  'list.positionOf': 'Showing the first {shown} of {total}.',
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
  'list.rowsConsidered': 'Rows {from}–{to} of {total}, in the order the selector considered them.',
  'list.rowsRecent': 'Rows {from}–{to} of {total}, oldest first — the newest are last.',
  'list.rowsPosition': 'Rows {from}–{to} of {total}.',
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
  // The THIRD zero, and until `InjectedBody.seen` was served there was no way
  // to tell it from the second: `readJsonlFile` swallows ENOENT, so an absent
  // seen file and an empty one arrived as the same `{ lines: [], error: null }`
  // and a cleared session was told it “was read and has received nothing” about a
  // file nobody opened. Seven of nineteen live sessions were in that state.
  'inj.noSeenFile': 'No seen file was written for this session, so nothing was read here — the audit log may still record what it was given.',
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
  // The other two card headings. The mockup keys only `doc.notice` and
  // draws these two as literals; the app draws all three from the table, so
  // two of three headings are no longer English under Hebrew.
  'doc.error': 'error',
  'doc.warning': 'warning',
  'doc.d4': 'a second cross-project knowledge store exists on this machine. {b:mycontext never reads or writes it} — reported so you learn it here rather than from a surprise.',
  'doc.d5': 'another plugin writes durable learnings here — the same kind as {m:lesson}, in a second spelling with no shared ids. It is a {b:watched} path, so edits nudge and a human decides.',
  // **A finding with no composed command SAYS SO, and the screen counts them.**
  //
  // Owner, 2026-08-28, on a corpus whose two findings were `blocked_without_needs`
  // and `nested_corpus`: "doctor lost it's execute an fix controls ? why yo broke
  // it ?" Nothing had. Most findings are repaired by editing a file, so `null` is
  // `repairCommandFor`'s ordinary answer — but a row that draws bare and a screen
  // that has lost its controls look identical, and the reader guessed the second.
  //
  // Same vocabulary as the strip's three named states, deliberately, and the same
  // `.chip.unmeas` primitive: `strip.unread` / `strip.unmeasured` / `screen.unread`
  // name the state in a few words and put WHY in a `title`
  // (STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is). A fourth
  // spelling of "nothing here, and here is why" would be worse than the silence.
  //
  // `doc.tally` is phrased as a label rather than a sentence for the reason
  // `rail.cntSome` gives: "1 findings" is wrong and "1 finding" needs a plural
  // rule the run grammar has no marker for, so the count leads and the noun does
  // not inflect. It is drawn at every count including zero — a measured zero is
  // drawn and named.
  'doc.norepair': 'no automated repair',
  'title.noRepair': 'This finding is repaired by a person, not by a command: an edit to a file, or a decision only someone with the context can take. There is nothing for the screen to compose, so it offers nothing — and that is the state, not a missing control.',
  'doc.tally': 'findings: {findings} · with an automated repair: {repairs}',
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
  // The focus picker's label. Until it existed the ego graph was drawn around
  // `items.items[0].id` and nothing chose it.
  'gr.focus': 'The item at the centre',
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
  'work.sub': 'Per-field staleness against the text in force.',
  'work.field': 'Field',
  'work.now': 'In force',
  'work.prop': 'Proposed',
  'work.drafts': '{b:Drafts awaiting a decision.} {n} in this queue. A draft governs nothing until a person promotes it.',
  'work.draftsEmpty': '{b:Drafts awaiting a decision.} None. Everything captured has already been settled by a person.',
  'work.revisions': '{b:Revisions proposed against items in force.} {n} in this queue. The items keep their current text until one is promoted.',
  'work.revisionsEmpty': '{b:Revisions proposed against items in force.} None. Nothing has been proposed against a governing item.',
  'work.draftMeta': '{mv:type} · {mv:severity} · captured by {mv:origin}',
  'work.outcome': 'Outcome',
  'work.accept': 'Accept',
  'work.reject': 'Reject',
  'work.promoteDraft': '{b:Accept} promotes the draft: it becomes active and starts governing this project from the next session.',
  'work.discardDraft': '{b:Reject} discards the draft: it is retired unpromoted, it never governs, and the text is not deleted.',
  'work.promoteRev': '{b:Accept} promotes the revision: the proposed fields replace the text in force on the item above.',
  'work.discardRev': '{b:Reject} discards the revision: the proposal is dropped and the item keeps every word it has now. This is the settlement a stale revision can still take.',
  'work.moved': 'changed since staging',
  'work.blocked': 'promote refuses until re-based',
  'work.diffn': 'The proposed column is a word-level diff, not a second paragraph to compare by eye: additions are tinted, removals are struck, and both are real {m:<ins>} and {m:<del>} elements, so a screen reader announces the change without any added ARIA. The stale field carries a rule down its reading-start edge — the one physical offset in the sheet, and its mirror is written next to it rather than discovered later.',
  // The Copy control's opening state, and the two the shell's live region
  // announces. `state.uncopied` is drawn beside a composed command BEFORE
  // anything is copied; `state.armed` below is what replaces it only when the
  // clipboard promise RESOLVES. A refused write leaves this one in place.
  'state.uncopied': 'not copied',
  'live.copied': 'Copied to the clipboard.',
  // Assertive, and it is the only assertive announcement in this product: a
  // reader who believes the line is on their clipboard pastes whatever WAS on
  // it into a shell, and a polite queue can hold that news until after they
  // have.
  'live.copyFailed': 'Copy failed. Nothing was written to the clipboard.',
  'state.armed': 'armed',
  'work.state': 'copied, not yet observed landing',
  'help.land': 'How you will know it worked',
  // The sentence beside `state.uncopied`. It replaced one that said "copied,
  // not yet observed landing" UNCONDITIONALLY, beside a command nobody had
  // copied — a state claiming an act that had not happened.
  'work.uncopied': 'the line is composed; nothing has been copied yet',
  'work.h1': '{b:Run it in your own shell.}',
  'work.h2': '{b:The receipt:} an audit record whose {m:op} is {mv:op}. Returning to this tab re-checks.',
  'work.h3': '{b:If the body moved first}, promote refuses and names both values — that refusal is the product working, not failing.',
  // Capture
  'cap.h': 'Capture',
  'cap.v': 'shows what already governs before you add another',
  'cap.sub': 'Composes an {m:add}. What it contributes over the CLI is the overlap check — the items already governing this scope.',
  'cap.already': 'Already governing {mv:scope}',
  'cap.o1': 'invariant, normative',
  'cap.o2': 'standard, normative',
  'cap.nosim': 'These are the items whose {b:scope matches}. No similarity or ranking is shown, because no similarity metric exists in this product — and inventing one here is how a mockup starts lying.',
  // `notGoverning` — served since the screen was built and drawn nowhere for
  // want of this key. It is the count the overlap check REMOVED: items whose
  // scope matches and which do not govern. A bare number would not be a fact.
  'cap.notgov': '{n} more items match this scope and do not govern — drafts, deprecated items and rationale categories.',
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
  // The two hard stops `/api/config` carries as FIELDS rather than as a 500.
  // The loader's own sentence follows each of these, unedited and
  // untranslated; what these say is WHICH of the two failures it is, which
  // is the one thing about them a reader could not get from the text itself.
  'cfg.parseErr': '{m:config.json} could not be parsed. The loader’s own message follows.',
  'cfg.resolveErr': '{m:config.json} parsed, and could not be resolved. The loader’s own message follows.',
  'cfg.effect': 'What changes',
  'cfg.deltan': 'Each row is the {b:pair}, not the direction alone: the old value struck through, the new one highlighted, and the row tinted by which way it went. "What was it before" is half of "what changes", and a lone {m:+1} chip keeps the direction while losing the pairing.',
  'aria.scopepolicy': 'scopePolicy',
  'cfg.spn': 'The border colour and the count {b:are} the blast radius: how much of the corpus stops working if this value changes. {m:inert} is the most destructive change the configuration offers, and {m:scopePolicyFor} makes its effect computable exactly rather than estimated — the items are named, and the ones past the cut are counted rather than hidden.',
  'cfg.apply': 'Apply this',
  // REWRITTEN 2026-08-27 — task `plan:budget seq:5`,
  // `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`. The old
  // sentence ("There is no command that edits a budget… So this is the edit,
  // not a command") became FALSE the day this screen gained the Write button
  // below: it now IS a write, behind a confirm. What stays true, and what this
  // rewrite says instead: no COMMAND edits a budget, and an agent still
  // cannot reach one — the deny hook still refuses every OTHER key in this
  // file, and still refuses an agent here. A person can, now, past the
  // confirm.
  'cfg.nocmd': 'No {m:mycontext} command edits a budget, and an agent still cannot — the deny hook says so in those words: {i:"changes to {m:.my_context/config.json} are the user\'s to make — ask, do not edit."} A person can, here, behind a confirm that shows every value before it is written.',
  'btn.copypatch': 'Copy the patch',
  // The four Save/write strings the budgets form and its confirm draw. Not a
  // second `exec.*` set: `exec.btn`/`exec.h`/`exec.go` all say "Execute" /
  // "Run this command?" / "Run it", which is precisely false of a write that
  // runs no command — see `cfg.nocmd` above. `exec.cancel` ("Cancel") and
  // `exec.changes` ("What changes — in force, then proposed") ARE reused,
  // deliberately: neither one names a command, and a third spelling of either
  // is exactly the "two tables that can disagree" this UI keeps refusing.
  'cfg.savebtn': 'Write budgets',
  'cfg.saveh': 'Write these budgets?',
  'cfg.saveg': 'Write it',
  'cfg.saved': 'Written to {m:config.json}.',
  'cfg.watched': 'Watched documents',
  'cfg.watchednote': '{m:init} writes what this repository actually has, rather than shipping three paths from one workflow that match nothing here. The list {b:replaces} and never merges — a list you wrote must not silently gain globs you did not.',
  'cfg.h1': '{b:Budgets are written here}, past the confirm above. Every other key on this screen is yours to edit yourself, and the hook refuses an agent that tries.',
  'cfg.h2': '{b:The receipt:} this screen re-reads {m:config.json} from disk on every load, so returning to the tab shows the new value — or a {m:parseError} field if the JSON broke.',
  // ── One pane per configuration subject — `plan:config seq:1`, 2026-08-29.
  // Four headings, four explanatory sentences, and the labels on the controls
  // inside them. Every value a control offers is a literal the loader accepts,
  // drawn untranslated on the control itself, so these sentences carry the
  // MEANING of each value and never a second vocabulary for it.
  'cfg.profile': 'Profile',
  'cfg.profilen': 'Which category catalogue this project has at all. {m:standard} is every shipped category; {m:minimal} is the smallest useful normative vocabulary. A category the profile leaves out is not disabled — it is absent, and an item of that type is injected nowhere.',
  'cfg.inforce': 'In force now. Press the other to compose the change.',
  'cfg.budgetsn': 'The token ceiling per tier, and the one key on this screen a person can write from here — behind the confirm below, which shows every value before it is written.',
  'cfg.cats': 'Categories',
  'cfg.catsn': 'One category at a time: the tier it injects at, what an empty scope means for it, whether an agent may edit one, and its two free-text fields. A change composed here is an entry {b:inside} the file\'s {m:categories} object, never a new top-level key — getting that wrong produces invalid JSON and a refusal that reads like this screen was wrong.',
  'cfg.catpick': 'Which category',
  'cfg.tier': 'Tier — {m:normative} is injected in full, {m:rationale} is counted in the session index and nothing more.',
  'cfg.policy': 'What an empty scope means here: {m:global} is unrestricted, {m:required} refuses a new capture without one, {m:inert} injects on no file at all.',
  'cfg.agentedits': 'Whether an agent may edit an item of this category, or must stage a revision for review.',
  'cfg.prefix': 'The id prefix, uppercase. The placeholder is the prefix in force.',
  'cfg.desc': 'What this category is for, as the help prints it. The placeholder is the description in force.',
  'cfg.extran': 'Extra fields in force: {fields}. Read here and not composable — a list and a nested {m:updates} object need the category wizard, which is not built.',
  'cfg.watchedn': 'The globs whose edits earn a nudge. Read by the PostToolUse hook and by nothing else, and no {m:mycontext} command prints this list back.',
  'cfg.globhint': 'docs/**/*.md',
  'cfg.blast0': 'No change — this is the configuration in force.',
  'cfg.blast0n': 'Measured against this corpus: nothing starts governing, nothing stops, delivery does not move, and all {unchanged} items are unaffected.',
  'cfg.blasts': '{n} items stop being delivered at the start of a session',
  'cfg.blastsn': 'They still govern; they no longer fit. Counted by running {m:select} — the selector the hook itself runs — twice over the same items and the same context, so this is what would actually start spilling.',
  'cfg.blaste': '{n} items change who may edit them',
  'cfg.blasten': 'Nothing starts or stops governing and nothing stops being delivered — {m:agentEdits} decides who may write, not what is injected. The items are the ones {m:agentEditsFor} named, counted rather than estimated.',
  'cfg.blasta': '{n} more items are delivered at the start of a session',
  'cfg.blastan': 'Nothing stops governing and nothing stops being delivered. Counted by running {m:select} twice over the same items and the same context.',
  'cfg.blastw': '{n} items start governing this project',
  'cfg.blastwn': 'Nothing stops governing, and {unchanged} items are unaffected. Counted by running the same {m:injection} check twice over the real corpus, once per config — not estimated here.',
  'cfg.blastc': '{n} items stop governing this project',
  'cfg.blastcn': 'They keep existing and stop being injected; {unchanged} items are unaffected. Counted by running the same {m:injection} check twice over the real corpus, once per config — not estimated here.',
  'cfg.blastu': 'Unmeasured — no endpoint answers what this key governs.',
  'cfg.blastun': 'The preview runs {m:injection}, {m:scopePolicyFor}, {m:agentEditsFor} and {m:select}, and not one of the four reads this key. A zero here would be a true answer to a question nobody asked, so no count is drawn.',
  'cfg.unscoped': 'Its reach is what {mv:policy} decides: {n} unscoped {mv:cat} items, named and counted by the same lookup the selector runs.',
  'cfg.gov': 'governs',
  'cfg.notgov': 'does not govern',
  'cfg.delivered': 'items delivered at session start',
  'cfg.spilledn': 'items spilled',
  'cfg.tokensn': 'tokens charged',
  // Procedures
  'pr.h': 'Procedures',
  'pr.sub': 'An ordered set of steps performed {b:once} and then done — as against a rule, which is one instruction that applies every time. A rule is a single instruction; a procedure is a sequence. {b:Built, and this screen reports it.}',
  'pr.states': 'Five states, and exactly one of them injects',
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
  // The fifth stage. `STAGES` in `src/ui/proc-model.ts` has always had five and this
  // table drew four; `pr.aband` names the state in prose three cards further down.
  'pr.s5': 'you stopped it, and it is {m:superseded} rather than finished',
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
  // The disclosure card's heading. The card is the endpoint's own
  // qualifications in the endpoint's own words; this says what the card IS,
  // so it is no longer a `.card.pane` a reader meets with no title on it.
  'pr.disc': 'True whether or not a card above says so',
  // The zero state. A corpus with no procedure drew the static half and said nothing
  // about the live one, which `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
  // forbids: an empty corpus and a screen that failed looked identical.
  'pr.empty': 'No procedure in this corpus. The lifecycle above is what one would be; nothing has been written yet.',
  // ONE KEY PER DISCLOSURE CODE — the closed set `src/ui/proc-model.ts` serves
  // (`DISCLOSURE_CODES`). `pr.d1` and `pr.d2` are the model's two CONSTANT sentences,
  // verbatim, so an English reader sees the byte the endpoint sent. `pr.d3`-`pr.d5`
  // are the three the model COMPOSES per corpus: the key carries the reason and the
  // served sentence still follows it, because the ids, the step numbers and the
  // category are in that sentence and nothing here could carry them.
  'pr.d1': 'progress is recorded per workspace, not per session — two terminals on this workspace share one record set.',
  'pr.d2': 'a ready procedure is not injected and not named in the index — the model does not learn it exists until {m:mycontext procedure activate} runs. Nothing is lost: it is a draft, and {m:mycontext procedure list} is where it is visible.',
  'pr.d3': 'Progress records this build could not read are counted in neither direction, so every count above is of the records that parsed.',
  'pr.d4': 'A tick written into an item’s Markdown is not a progress record: every box above is replayed from the audit log, and the two can disagree.',
  'pr.d5': 'The list is empty because the {m:procedure} category is off in this config, not for want of procedures.',
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
  'dv.t3': 'The five tiers',
  'dv.t4': 'Scope',
  'dv.t7': 'The trust boundary',
  'dv.parity': 'The EN/HE switch self-disables when the parity test is red — a mirror that has drifted is worse than none.',
  'dv.rendered': '§{ordinal} — {heading}',
  'dv.mdnote': 'Rendered by a hand-written subset renderer: no HTML string is ever produced, so there is nothing to sanitise. Raw HTML, images and unknown URL schemes are {b:refused and shown as refusals}, not silently dropped.',
  // The three refusals `dv.mdnote` promises, worded. The mockup builds them
  // inside its own script and keys none of them; drawn from here they are the
  // renderer's words in the reader's language, and the alt text and the link
  // label — which are the document's, not the product's — still survive.
  'dv.imgRefused': '{alt} (image refused)',
  'dv.linkRefused': '{label} (link refused)',
  'dv.htmlRefused': 'raw HTML block refused',
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
  // The four provenance-group labels. Colour says where a number came from
  // and these say it a second time, because colour alone fails a dichromat,
  // a monochrome printer and forced-colors (06-a11y.html).
  'strip.grp.repo': 'repo',
  'strip.grp.corpus': 'corpus',
  'strip.grp.session': 'session',
  'strip.grp.audit': 'audit',
  // Two states no group could say before, and neither may be a blank —
  // STD-a-measured-zero-is-drawn-and-named, clause 3. "not read" is a call
  // that did not answer and is retryable; "not measured" is a figure this
  // read surface exposes no aggregate for, and retrying cannot help.
  // Whether the corpus moved WITHOUT the audit log seeing it — a file edited in
  // an editor, by another tool, or by a branch switch writes no record at all.
  // Measured by an mtime sweep on the heartbeat rather than watched: `fs.watch`
  // was measured on 2026-08-31 and misses EVERY file past a burst of ~20-50,
  // collapsing to two events that name nothing. Three states, and the third is
  // load-bearing: `Unknown` is not-known and is never inferred from a
  // truncated sweep.
  'strip.corpusDrifted': 'corpus changed outside the log — {age} ago',
  'strip.corpusInStep': 'in step with the log',
  'strip.corpusDriftUnknown': 'outside edits not known',
  'title.corpusDrifted': 'An item file under {m:items/} is newer than the last thing the audit log recorded, so this page is drawing a corpus that has moved under it. Everything live here comes from the audit log, and an item edited in an editor, by another tool, or by a branch switch writes no record at all. Reload to read the corpus as it is now.',
  'title.corpusInStep': 'Nothing under {m:items/} is newer than the last recorded change — measured, not assumed. This page reflects changes made through mycontext and through a Claude Code session; a file edited any other way would show above as changed outside the log.',
  'title.corpusDriftUnknown': 'Whether anything changed outside the log could not be measured — there is no audit log to compare against yet, or the corpus could not be read. This is "not known" rather than "nothing changed".',
  'strip.unread': 'not read',
  'strip.unmeasured': 'not measured',
  'title.unread': 'The server did not answer this call, so nothing here is a claim about the repository, the corpus or the session. Refresh asks again.',
  'title.unmeasured': 'This read surface exposes no aggregate over the audit log, so the figure is unknown rather than zero. Refreshing cannot help; the endpoint has to exist first.',
  'title.gitState': 'Click to cycle the seven git states the spec requires',
  'strip.branch': 'branch {mv:branch} @ {mv:commit}',
  'strip.detached': 'detached HEAD @ {mv:commit}',
  'strip.inSync': 'in sync',
  'strip.differs': 'differs from origin',
  'strip.noUpstream': 'no upstream',
  'strip.unknownTip': 'the local tip could not be read',
  'strip.notARepo': 'not a git repository',
  'strip.items': 'items',
  'strip.inj': 'injections today',
  'title.corpus': 'Click to cycle the item count and the state where it could not be read',
  'title.audit': 'Click to cycle the audit figures between measured and not measured',
  'title.ctx': 'Click to cycle the context states, the three project-knowledge answers and the unread state',
  'strip.ctx.known': 'context {pct}% ({used} of {size}) — as of last response, {age} ago',
  'strip.ctx.notYetKnown': 'context not yet known — no API call since the last compact',
  'strip.ctx.unknown': 'context unknown — this Claude Code build sends no {m:context_window}',
  // The state, in three words, because this is a status strip: drawn at full
  // length it was a third of the bar AND still ellipsised, so it cost the most
  // and said the least, and the context percentage — the number this product
  // is about — had no room at all. Owner, 2026-08-29: "it includes a very long
  // text that are not so important and other more important info could not be
  // seen like the context size left filled percentage". The sentence below is
  // what the short state discloses on demand; neither is dropped, which is
  // 05-dataviz.html's rule for a bounded thing — bound it, and disclose.
  'strip.ctx.noBridgeShort': 'no status-line bridge',
  'strip.ctx.noBridge': 'showing only what mycontext injected — that is all this number is. The status line bridge is not installed; {m:mycontext statusline install} shows what installing would change, and asks.',
  'strip.ctx.cold': 'cold session — a hypothetical has no live context number',
  'strip.myctx': '{tokens} of it from project knowledge ({injections} injections)',
  'strip.myctxPartial': '≥{tokens} of it from project knowledge ({injections} injections, {unrecorded} not recorded)',
  'strip.myctxUnavailable': 'project-knowledge share unavailable: {error}',
  'strip.append': 'audit append p95',
  'strip.meas': 'measured',
  'strip.rt': 'simulate reduced-transparency',
  // The provenance bar — one home for the qualifications every screen owes
  // The label was PAINTED, with its own `HEB ? … : …` ternary in the mockup's
  // script and no key — the residue the 2026-08-21 reconciliation did not
  // reach. Keyed here because the app has no such ternary: every string it
  // draws comes through the table, so an unkeyed label is an English literal
  // the א/A toggle can never reach.
  'prov.projLabel': 'projection',
  'prov.projFresh': 'already current',
  // The state `readProjection` reports as `absent` and names in its own words:
  // "the never-built empty state, and ONLY it". It had no key, so the one
  // answer a fresh workspace always gives was the one the bar could not say —
  // and a bar that cannot say it renders blank, which is
  // STD-a-measured-zero-is-drawn-and-named clause 3.
  'prov.projAbsent': 'not built — nothing has been projected from the audit log yet',
  'prov.projCaughtUp': '{mv:state} and caught up before answering',
  'prov.projFailed': 'could not catch up — no partial answer is shown: {error}',
  'ex.msg': 'The server has exited. This page shows what it last knew.',
  'ex.stale': 'Not connected. Refresh this page — if it stays that way this browser holds no credential for the server, and the link it printed is the way back.',
  // Code skew. NO value slots, deliberately: `app.js` calls translate() on this
  // key with no substitutions, and t() throws on one it cannot fill.
  'ex.codeSkew': '{b:This page is newer than the server answering it.} Files under {m:src/ui/public/} are read from disk on every request, so a reload picks up new screens; the server’s own modules were loaded when it started and cannot change until it does. Restart it to catch up.',
  'ex.ok': 'OK',
  // The one refusal frame every screen shares — `errorNote` in
  // `screens/parts.js`. The message inside it is the server's, the
  // platform's or the command's, verbatim and in whatever language it was
  // written in; what was missing until 2026-08-30 was any word at all around
  // it, so every refusal on every screen was unworded English at the exact
  // moment something had gone wrong.
  'err.note': 'Refused. The wording is the system’s own and is not translated: {error}',
};
