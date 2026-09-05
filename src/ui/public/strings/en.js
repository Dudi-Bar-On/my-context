/**
 * English UI string table — TRANSCRIBED from the design of record, not authored here.
 *
 * `docs/design/web-ui-mockup.html` is the UI specification. All but FOUR of the keys below
 * are one of its 398 distinct string keys — the 382 it declares with `data-t`, the 12 accessibility
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
 * The four that are not are `dec.caveat`, `dec.caveatNew`, `dec.caveatIn` and
 * `dec.caveatUnit`, added 2026-09-05 under
 * `DEC-the-decay-threshold-is-stated-on-the-screen-and-read-from`. The mockup draws that
 * paragraph in its own script rather than declaring a `data-t` for it, so there was no key
 * to transcribe and the sentence was simply absent from the product. Adding one the mockup
 * does not declare is ordinary development under the ruling named below, not an invention.
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
  'sess.name': '{b:Names are optional.} An unnamed session still keeps its id and prefix. Name it with {m:mycontext session name} or {m:/mycontext-session}.',
  'sess.cold': 'Cold session',
  'sess.coldn': 'no seen set',
  'sess.coldhelp': 'What a brand new session would see for this file — never shown as the current session preview.',
  'sess.parent': 'Previews show the {b:parent thread}. A subagent has its own dedupe key, so its deliveries are not included.',
  'sess.notProjected': 'This corpus’s session history has not been projected yet. Run {m:mycontext status} to build it.',
  'sess.nocred': '{b:No credential on this page} — not the same as an empty corpus. It lives only in the URL fragment, so a bookmark, typed address, or reload cannot recover it. Run {m:mycontext ui --nonce} and open the link it prints.',
  'aria.focuspop': 'Focus',
  'focus.title': 'Focus',
  'focus.live': 'The focus that is set',
  'focus.off': 'Focus off',
  'focus.offn': 'no narrowing',
  'focus.help': 'The focus that is set is what Claude really gets. Focus off is the other choice: nothing narrowing the corpus at all.',
  'focus.tags': 'Tags to focus on',
  // ── The tag picker (REQ-the-focus-dialog-offers-the-tags-it-could-focus-on)
  'focus.picking': 'Reading the tags in this corpus…',
  'focus.pickn': 'This corpus carries no tags yet, so there is nothing to pick. Type one above to focus on a tag as soon as an item has it.',
  'focus.pickerr': 'The tags could not be read, so none are offered. Type them instead — the line below composes either way.',
  'focus.free': 'Tags people wrote — {n} of {eligible} items',
  // The OR is stated because the opposite reading is the one that fails
  // silently: `core/select.ts` matches an item that carries ANY ticked tag,
  // and a reader who takes a checkbox list as "all of these" would tick three
  // and expect a narrower session than they get.
  'focus.any': 'Tick any number. An item matches if it carries {b:any one} of them — the other axes still have to match too.',
  // The count beside each tag, as a title a reader can hover for the whole
  // truth: a focus never hides a hard rule, a pinned item or a continuity
  // item, so what it INJECTS is always more than what carries the tag.
  'focus.tagn': '{items} item(s) carry {tag}. Focusing on it alone injects {visible} of {eligible} eligible items — a focus never hides a hard rule or a pinned item.',
  // Projected tags are not a membership anybody typed: `mutate.ts` generates
  // them from a field and refuses a hand-written one, and `seq:` alone is 217
  // values on this corpus. So they are picked one-per-prefix, not ticked.
  'focus.proj': '{prefix}:',
  'focus.projn': 'Generated from {fields} — set with {cmd}, never written by hand. One at a time.',
  'focus.projany': '(any)',
  'focus.projnone': 'no {prefix}: tag is in use yet',
  'focus.compose': 'Nothing here writes. The choice above and the tags beside it {b:compose} the line; running it is the one act, behind the same confirmation every other composed command gets.',
  'aria.rail': 'Screens',
  'nav.inj': 'Injection — what arrives',
  's.preview': 'Injection preview',
  's.coverage': 'Scope coverage',
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
  'preview.sub': 'What the latest session got at start. Pick a file to preview a tool event instead — session and focus above narrow this like the hook does.',
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
  'preview.carried': '{b:{lines} index lines carried from session} {mv:session}. Shown here and in {m:mycontext context} the same way — an item arriving unseen is as much a defect as one silently dropped.',
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
  'preview.whyn': 'Gates run in order: eligible, tier, focus, scope, seen, budget — as {m:select()} uses them. The first to fail is the answer: above passed, below never reached. The fix maps to a stable code on {m:injection()}.',
  // The picker's own disclosure. It holds ONE EXEMPLAR PER RUNG — the first
  // item by id that fails there — so it is stable against exactly the changes
  // a reader is trying to observe, which is what "cannot see changes to why
  // not" was reporting. Said rather than replaced: the rung a reader is
  // usually chasing is the budget, and every item that failed THAT now has a
  // list of its own below.
  'preview.spec': 'The strip holds one {b:specimen} per gate — the first item that fails there — so it stays still as selection moves. Items that spilled are named under {b:Not delivered} below. Each specimen carries {b:how many items fail with it}, repeated per gate.',
  // The ladder's six one-line descriptions, transcribed from the mockup's own
  // `GATES` table (`docs/design/web-ui-mockup.html` · `const GATES=[` · ~5784),
  // which already carries Hebrew for all six — see `preview.js`'s `GATE_Q_KEY`.
  'preview.gEligible': 'active, not retired, not superseded, category enabled, not past valid_until',
  'preview.gTier': 'only a normative category is injectable in full; a rationale category reaches '
    + 'the index line and no further',
  'preview.gFocus': 'a focus predicate narrows the corpus before scope is even considered',
  'preview.gScope': '{m:matchesScope} against the event path, POSIX-normalised on both sides',
  'preview.gSeen': 'already-delivered items are filtered out before budgeting',
  'preview.gBudget': 'what reaches here and does not fit spills whole, with its reason — never truncated',
  'preview.notReached': 'not reached — ',
  'preview.spill': 'Not delivered — every item that spilled, and what it cost',
  'preview.spilln': 'One row per item in {m:Selection.spilled}, {b:whole across every tier this event ran}, in try order. First-fit is greedy: same costs in another order spill a different item. {b:band} names the pass. An index line shows {b:—}: no endpoint serves per-line costs.',
  'preview.ribbon': 'Budget ribbon — five tiers, and what fell out of each',
  'preview.ribbonn': 'One segment per admitted item, sized by {m:itemCost}. The {b:ghost lane} shows spilled items at the width they would take. A tier never reached is drawn {b:absent}, not blank, so it cannot look like it ran.',
  // The ribbon tier label's two prose fragments — the mockup translates the
  // in/out clause itself (`renderRibbons` · `HEB?' נכנסו · ':' in · '` · ~6204).
  'preview.rbTo': 'to {mv:scale}',
  'preview.rbInOut': '{inCount} in · {outCount} out',
  // The four ribbon hints. `rbFit` and `rbSpill` are the mockup's own two
  // sentences for a filled and a spilling tier (`renderRibbons` · ~6220-6231);
  // `rbRange` and `rbIndex` are app-only — the simulator's range control and
  // the per-line index figure have no mockup counterpart to transcribe.
  'preview.rbRange': "{b:Drawn to the simulator's range, {mv:scale}} — the budget in force is "
    + 'still {mv:budget}, and the track past it is range, not headroom.',
  'preview.rbFit': 'Everything selected fit. Headroom {mv:headroom} tokens.',
  'preview.rbIndex': 'Headroom {mv:headroom}. {outCount} index lines did not fit; per-line index '
    + 'costs are exposed by no endpoint, so the ghost lane cannot size them.',
  'preview.rbSpill': 'Headroom {mv:headroom}. {b:the smallest thing that did not fit costs '
    + '{mv:smallest}} — so the headroom is not usable by anything currently selected.',
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
  'preview.contover': '{b:Continuity overflow} — {n} continuity item(s) did not fit {m:budgets.continuity}: {mv:ids}, costing {mv:cost} against a budget of {mv:budget}. NOT in force this session — shown here, in the injected block, and as a doctor finding, so nothing drops silently.',
  // ── The warm/cold question, the `seen` gate, and the When column ───────
  //
  // Added 2026-08-29 with the fix for "Not delivered is not working". Three
  // groups, and each closes a hole the screen had been drawing a zero over.
  'preview.qwarmn': 'the seen set it has really been given',
  'preview.qnote': '{b:Two questions, not two views.} Default is what the session above gets now — seen set, focus and carry included — {b:exactly what Claude gets}. {b:Cold} answers what a brand-new window would get. Pressed control shows which you are reading.',
  'preview.seen': '{b:Filtered before budgeting} — {n} item(s) hit the {m:seen} gate and were removed because this session already got them. This gate runs before any tier picks candidates, so it shows what was removed, not what would arrive.',
  'preview.seen0': 'Nothing was removed at the {m:seen} gate — none of the injectable corpus has reached this session yet. A cold preview always reads zero here: a new window has been shown nothing.',
  'preview.spillNone': 'Everything that reached the budget gate fit — {n} candidate(s) went in, none spilled. A full budget, not an empty answer.',
  'preview.spillUnreached': 'Nothing reached the budget gate. {n} item(s) were removed earlier, at {m:seen}, as already delivered, so no tier had a candidate left. This zero is {b:not} "nothing spilled".',
  'preview.spillNoCand': 'Nothing reached the budget gate, and nothing was removed at {m:seen} either — no tier here had a candidate to offer. This zero is {b:not} "nothing spilled".',
  'preview.gseen': 'already delivered to this session, so filtered at the {m:seen} gate before any budget was checked',
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
  'preview.scope': '{b:The path narrows only the {m:jit} tier, only for items declaring a scope.} {b:{scoped} of {total}} do. The other {b:{unscoped}} carry {m:scope: []} — under {m:scopePolicy}, unscoped is {b:unrestricted}, matching every path, so the file above cannot change them.',
  'preview.scopeinert': 'Of those unscoped items, {b:{inert}} belong to a category set to {m:scopePolicy: inert}. There, an unscoped item matches {b:no} path, so the file above cannot bring them in either.',
  'preview.scopeunk': '{b:The path narrows only the {m:jit} tier, only for items that declare a scope.} {b:How many items in this corpus declare one is unmeasured here} — the scope join did not answer, so this stays unstated rather than guessed: {mv:reason}.',
  // ── Each rung's own population ─────────────────────────────────────────
  //
  // Added 2026-08-29. The picker offered three names over a corpus where 564
  // items failed — 551 of them at one rung — and the card said "of how many"
  // nowhere at all, so a specimen standing for 551 read as the whole set. The
  // picker is unchanged (one exemplar per rung is the design, and 139 names
  // would be `preview.whyn`'s own objection one axis along); what these
  // sentences add is the number the specimen stands in for, on every rung,
  // including the rungs nothing fails at.
  'preview.rungn': '{b:{n} item(s) fail at this gate.} The strip above names the first by id; the rest are listed below.',
  'preview.rung0': '{b:No item fails at this gate.} A measured zero — every item was put to this gate and none stopped here, not a rung nobody checked.',
  // Rung 4 never takes a plain number and never takes the zero above. Its
  // count is the item-level half of a question the other half of which no
  // endpoint answers, and a bare `0` would claim this event's path excluded
  // nothing — the one thing nobody measured.
  'preview.rungunk': '{b:{n} item(s) fail at this gate at the item level} — no scope under {m:scopePolicy: inert}. How many the event path excludes is {b:unmeasured}: {m:matchesScope} has no endpoint, so dropped items are absent, not counted. Not a zero — no list can be drawn.',
  'preview.rungseen': '{b:{n} item(s) fail at this gate.} Each is named under {b:Filtered before budgeting}, in the {b:Not delivered} card below.',
  'preview.rungspill': '{b:{n} item(s) fail at this gate.} Each is named under {b:Not delivered} below, with the tier that dropped it and its cost.',
  'preview.rungopen': 'Every item stopped at {mv:gate}, by id. The strip above names the first; this is the rest.',
  'preview.pickn': 'first of {n}',
  'preview.pickunk': 'first of {n} measured',
  'preview.when': '{b:The When on each row is the past, not this preview.} Nothing here is injected now. Each row shows the last real delivery or spill, from {m:audit_item.role} joined to {m:audit.at}, matched on its tier. Rows can be weeks apart and both right.',
  'preview.whenoff': '{b:Delivery times unavailable} — {reason}',
  'preview.whenabsent': '{b:Delivery times unavailable} — the audit projection was never built here, so there is no record. {m:mycontext audit} builds it; a read surface cannot, since building it is a write.',
  'preview.whentrunc': 'The delivery-time answer was cut at {n} rows, so a row may read {b:never} where the log actually holds an older record.',
  'preview.lastinj': 'last delivered {mv:at} · {mv:tier}',
  'preview.neverinj': 'never delivered',
  'preview.lastspill': 'last spilled {mv:at} · {mv:tier}',
  'preview.neverspill': 'never spilled before',
  // Scope coverage — redesigned 2026-09-04, TASK-scope-coverage-summarises-
  // first-and-shows-detail-on-demand (seq:21) and TASK-coverage-gaps-folds-
  // into-scope-coverage-keeping-the-one-fact (seq:22).
  'cov.h': 'Scope coverage',
  'cov.v': 'what covers each folder, and what does not',
  'cov.sub': 'Colour shows which rules apply where.',
  'cov.status': '{covered} / {total} files covered · {gaps} gaps · {catEmpty} / {catTotal} categories empty',
  'cov.pin': 'Pinned — {n} items, always on, everywhere',
  'cov.pinNote': 'These apply to every file, so they are not repeated per folder below.',
  'help.whyTree': 'Why these are not in the tree',
  'cov.pinhelp': 'An {m:always:true} item governs every path. Colouring it per-path made a directory that {i:is} governed look like a gap. Hoisted here, "gap" means something real. {m:CONST-zero-runtime-dependencies} is pinned, so it already covers a file that does not exist yet.',
  'cov.tree': 'Repository',
  'cov.tree.filter': 'Filter by path…',
  'help.whyMagnitude': 'What the bar on each folder shows',
  'cov.magn': '{b:Magnitude}, not just a state: bar shows governed / ungoverned / not-examined, count {m:governed of total}. Dots alone could not say {i:how} dark a row was. Dot stays for monochrome; depth adds {m:data-depth}.',
  'cov.k1': 'scoped',
  'cov.k2': 'one item',
  'cov.k3': 'gap',
  'cov.k4': 'not examined',
  'cov.gov': 'What governs',
  'cov.gov.summary': '{n} items, in {c} categories',
  'help.showIds': 'Show ids',
  'cov.emptycat.h': 'Categories with nothing in them',
  'cov.emptycat.none': 'none — measured, every category holds at least one item',
  'cov.e1': 'Nothing governs this project yet.',
  'cov.e2': 'The normal state for a new workspace, not a wall of warnings — said once, not repeated per row.',
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
  // `screens/gaps.js` retired 2026-09-04 (`TASK-coverage-gaps-folds-into-
  // scope-coverage-keeping-the-one-fact`, seq:22); its one live fact — empty
  // categories — is now `cov.emptycat.*` above. `th.where` and `th.act` were
  // exclusive to that screen's table and retire with it; `th.what`,
  // `btn.compose` and `gaps.r2` are shared with other screens (`ask.js`,
  // `palette.js`, `coverage.js`'s own truncation line) and stay declared.
  'th.what': 'What',
  'btn.compose': 'Compose',
  'gaps.r2': 'past the file limit',
  // Budget simulator
  'sim.h': 'Budget simulator',
  'sim.v': 'all five tiers',
  'sim.sub': 'Drag a budget and watch what fits. Raising it can {b:evict} an item — the selector is first-fit, not a ranked cut line.',
  'sim.stair': 'Admission staircase — items admitted, per budget',
  'aria.tierBudget': 'Tier budget in tokens',
  'aria.tierpick': 'Tier',
  'sim.stairn': 'The sweep is {b:exact, not sampled} — the selector re-runs at every cumulative candidate cost, so nothing between two rungs is invented. Per-item costs come from {m:itemCost}, exported by {m:select.ts}.',
  'sim.rangeh': 'Range maximum',
  'sim.rangebtn': 'Set range',
  'sim.rangen': 'The slider explores a range; this sets it. It is {b:a bound the simulator owns}, not a budget — nothing here writes {m:config.json}. Cannot fall below the budget in force; raising the budget raises this too. Preview uses the same range.',
  'sim.rangeset': 'Range maximum for {mv:tier} is now {max}.',
  'sim.rangebad': 'The range maximum must be a positive integer. Got {typed}. Nothing was changed.',
  'sim.thresh': 'Thresholds',
  'sim.snap': 'The thumb moves in single tokens; the ladder marks the rung that governs. Between two rungs, {offrung} follows the rung below. A red rung is an {b:eviction} — more budget, fewer items.',
  'sim.tier': 'Tier',
  'sim.budget': 'Budget',
  'sim.fits': 'Fits',
  'sim.spills': 'Spills',
  'sim.spillHeld': '{b:ALREADY IN CONTEXT} ({n}): {mv:ids} — the agent already holds these; spending this tier’s budget on them would change nothing.',
  'sim.spillAbsent': '{b:GENUINELY ABSENT} ({n}): {mv:ids} — never delivered this session. Raising the budget is what would actually change what arrives.',
  'sim.chipn': 'The fits column is a {b:ratio}, not a count: "{fits} of {eligible}" shows how much of what was eligible arrived; the chip flips at the boundary. The row for the tier you drag follows the slider.',
  // The ratio the fits chip draws, in the words `sim.chipn` above already
  // quotes — the mockup's own `' of '`, which used to reach the page as an
  // unkeyed English literal and now does not.
  'sim.fitsOf': '{fits} of {eligible}',
  'help.whyBudget': 'Why raising a budget can remove an item',
  'sim.evict': '{m:fitToBudget} is {b:first-fit}: it keeps trying later items after one fails to fit. A larger budget can admit one large item early and crowd out two smaller ones. "Spilled" is not a priority ranking.',
  'sim.ratio': 'Selected, then not delivered',
  'sim.ration': 'Delivered grows toward reading start, spilled toward reading end, normalised to the largest count in the table. A long red half names {b:which budget is too small}. Both numbers come from {m:audit_item.role} through {m:topItems}.',
  // ── The question: this session, or a brand-new one (plan:walk seq:86) ────
  // The injection preview's precedent, carried to the second screen with the
  // same defect. Warm stays the default; cold is offered and LABELLED.
  'sim.qnote': '{b:Two questions, not two views.} Default is {b:cold} — what a brand-new window would get from this corpus and these budgets, unaffected by any one session’s history. The session above answers what it would get right now, with the {m:seen} set it was handed. Pressed control shows which one you see.',
  'sim.seen': '{b:Filtered before budgeting} — {n} item(s) removed at the {m:seen} gate: already delivered this session. The gate runs before any tier picks candidates, so 0 of 0 below can mean this. Ask the cold question instead.',
  'sim.seen0': 'Nothing was removed at the {m:seen} gate, so an empty tier below means nothing qualified. A cold question always reads zero — a new window has been shown nothing.',
  'sim.zeroSeen': 'everything it could have had was already delivered',
  'sim.zeroNone': 'nothing qualified for it',
  'sim.stair0seen': 'No rung to draw. The {m:seen} gate removed {n} item(s) before this tier picked candidates, leaving none to admit — empty for a measured reason, not unknown.',
  'sim.stair0none': 'No rung to draw: nothing qualified for this tier under the question being asked.',
  'sim.stairIndex': 'The {m:index} tier admits index LINES, not items, and no endpoint exposes per-line costs — nothing here to price. Absent, not empty.',
  'sim.stairNoPath': 'The {m:jit} tier is reached only by a {m:tool} event, which needs a file path — this repository walk offers none. Absent, not empty.',
  // ── The readout under the staircase (mockup #readout) ────────────────────
  // The words are the design of record's own, lifted from `renderStair`'s
  // unkeyed English/Hebrew ternaries and given the keys it never had.
  'sim.readout': '{b:{fits} in · {spills} out · {used} tokens used}',
  'sim.nextin': 'next in at {mv:at} — {mv:id}',
  'sim.evictw': 'Raising this budget evicts at least one item — see the downward step. First-fit is not stable that way.',
  // ── The recommendation carries the numbers (plan:budget seq:2) ───────────
  'sim.rech': 'What this tier costs, what it is set to, and what it would have to be',
  'sim.recn': 'The {mv:tier} tier costs {cost} tokens for the {n} item(s) that reached it, is set to {set}, and would need {need} to admit them all.',
  'sim.recNone': 'Not measured: this tier has not been swept under any question this screen can ask, so there is no cost to report and nothing to recommend.',
  'sim.recExact': 'Exactly enough',
  'sim.recExactn': 'admits all {n} · costs {cost} tokens of the window',
  'sim.recGrow': 'Room to grow',
  'sim.recGrown': 'admits all {n} with {pct}% headroom for the corpus to grow · costs {cost} tokens of the window',
  'sim.recCeil': 'The most this tier may take',
  'sim.recCeiln': 'leaves the other four tiers {other} tokens plus a {pct}% reserve inside the {win}-token window · costs {cost} tokens',
  'sim.recCeilNon': 'not offered: no window has been measured, and a ceiling on a guess is worse than no ceiling at all',
  'sim.recFreeh': 'Or a value of your own',
  'sim.recGo': 'Simulate it',
  'sim.recSet': 'Simulating {mv:tier} at {value}.',
  'sim.recRange': 'Simulating {mv:tier} at {value}. The range maximum rose to {max} so the slider can reach it.',
  'sim.recBad': 'A budget must be a positive integer written in digits. Got {typed}. Nothing was changed.',
  // ── Validation is against the whole window (plan:budget seq:3) ───────────
  'sim.winh': 'All five budgets, against the whole window',
  'sim.winOk': '{total} tokens across all five tiers of a {win}-token window — {pct}% — leaving {left} tokens to work in, clearing the {res}% reserve.',
  'sim.winTight': '{total} tokens across five tiers of a {win}-token window — {pct}%. It fits, but leaves only {left} tokens free, under the {res}% reserve. Fitting with nothing left to work in is still wrong.',
  'sim.winOver': '{total} tokens across all five tiers does not fit a {win}-token window: {over} tokens over. A budget that passes alone while the five together fail is exactly what this check catches.',
  'sim.winNone': '{b:Not validated, and not guessed.} No context window was measured this session — no ceiling for budgets. {m:context_window_size} comes only from the status line; a lookup table once measured this machine wrong by 5x. Install with {m:mycontext statusline install}.',
  // ── A full window is a state with a next step (plan:budget seq:4) ────────
  'sim.full': '{b:This cannot take effect now.} {used} of {win} tokens in use, {free} left; five budgets need {total}. Run {m:/compact} or {m:/clear} to admit the {n} {mv:tier} item(s) — budgets read at session start. Set either way; effect waits.',
  // ── An edited budget shows what it was (plan:budget seq:6) ───────────────
  'sim.restore': 'Restore the values in force',
  'sim.wasn': '{b:The first number is the budget in force} — what {m:config.json} holds for this tier now; the second is the value being simulated. {b:Restore} puts everything back, and is enabled only when something changed.',
  // Injected now
  'inj.h': 'Injected now',
  'inj.v': 'live, not hypothetical',
  'inj.sub': "What this context window actually received, from the per-session seen file — the parent thread's, keyed as the hook keys it.",
  'th.when': 'When',
  'inj.note': 'Read from the seen file, not {m:Ledger.seen} — that is a replayed projection nothing here updates, and it would show a different number.',
  // Audit stream
  'watch.h': 'Audit stream',
  'watch.v': 'the only record of what spilled',
  'watch.sub': 'Six record kinds: mutations, injections, hook actions, focus changes, access refusals, progress steps. A focus change is a {b:regime change} — a rule across the feed, not a row.',
  // The regime rule's own label. `watch.sub` above already carries the phrase
  // in both languages; the ROW that draws the rule used to carry it as an
  // English literal in the module, which is the one place the language toggle
  // cannot reach.
  'watch.regime': 'regime change',
  'watch.pulsen': '{b:Activity pulse} — one column per ten seconds, newest at the reading-end edge. Height is records in that column; colour is the kind. Buckets are indexed by {m:idx_audit_at}.',
  // The pulse's two silences, both named now rather than left as a bare floor
  // line or a bare status chip — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
  'watch.pulseEmpty': 'Measured, and empty — no record landed in the last {minutes} minutes. A '
    + 'measured zero, not a chart that failed to draw.',
  'watch.pulseAbsent': 'Not measured — no audit projection has ever been built for this '
    + 'workspace, so this window has nothing to read from.',
  'aria.wfilters': 'Filter',
  'watch.all': 'All',
  'th.at': 'At',
  'th.kind': 'Kind',
  // The op/who/detail split (plan seq: lane grouping) — `th.what` retired,
  // three columns replace it.
  'th.op': 'Op',
  'th.who': 'Who / subject',
  'th.detail': 'Detail',
  // Lane grouping: a dispatch, its steps and its stop, joined on `agent=<id>`
  // and folded to one row. See `watch.js`'s `laneGroupRows` for the shape.
  'aria.laneExpand': 'Show this lane’s steps',
  'aria.laneCollapse': 'Fold this lane’s steps',
  'aria.laneIsolate': 'Show only this lane',
  'aria.laneClear': 'Clear the lane filter',
  'watch.laneSteps': '{steps} steps',
  // TASK-expanding-a-lane-is-dead-for-every-lane-but-the-newest: the
  // on-demand steps lookup's own unmeasured state, drawn with this screen's
  // `.chip.unmeas` primitive rather than as a bare "0 steps" — a lane whose
  // steps have not been fetched yet must stay distinguishable from one that
  // fetched and found none (`STD-a-measured-zero-is-drawn-and-named-an-
  // unmeasured-thing-is`).
  'watch.laneStepsUnmeasured': 'steps not measured yet',
  'title.laneStepsUnmeasured': 'this lane’s steps were not in the shown window. A lookup beyond it is in flight or has not been asked for yet — a different fact from zero.',
  'watch.laneRunning': 'running',
  'watch.laneFinished': 'finished',
  'watch.laneNotInView': 'dispatch not in view',
  // TASK-a-lane-backfills-more-steps-than-the-feed-window-holds-so: a
  // dispatch looked up past the window, named but still not itself drawn.
  'watch.laneFound': 'dispatch found beyond the window',
  'watch.laneIsolated': 'Showing one lane only.',
  'watch.laneClear': 'Show every lane',
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
  'watch.backlogSome': 'The {shown} most recent records already in the log, replayed below the line. Earlier ones are in the log but not on this stream.',
  'watch.backlogAll': 'All {shown} records that were already in the log, replayed below the line. Nothing was held back.',
  'watch.emptyLog': 'this corpus has no audit log at all — it was read to its beginning and holds nothing. A measured zero, not a filter and not a refusal.',
  'watch.delivered': '{delivered} delivered',
  'watch.spilled': '{spilled} spilled',
  'watch.tokens': '{tokens} estimated tokens, computed at injection time',
  'watch.tokensNotRecorded': 'tokens: not recorded — this record predates the field. Not zero.',
  'title.tokensNotRecorded': 'tokens not recorded',
  'watch.voidn': 'A gold bar shows cost against the budgets of the tiers it drew from. Missing {m:tokens} draws a {b:hatched void}: the field is optional on {m:AuditRecord}; records before 1.0.1 lack it.',
  // The registered-hooks panel (hooks/31): every hook `hooks.json` registers,
  // measured against the full audit projection rather than against this
  // feed's own bounded window, so a hook crowded out of the {records}-record
  // feed above by a burst of lane steps can still be told apart from one that
  // has never fired at all.
  'watch.regh': 'Registered hooks',
  'watch.reghn': 'Every hook {m:hooks.json} registers, measured against the whole audit log — not against the window above, which a burst of lane steps can crowd. A {b:seen} row is a fact; a {b:never seen} row is a fact too, measured and not merely absent from the feed.',
  'th.hook': 'Hook',
  'th.status': 'Status',
  'th.count': 'Count',
  'th.last': 'Last seen',
  'watch.reghSeen': 'seen',
  'watch.reghNever': 'never seen',
  'watch.reghUnmeasured': 'not measured',
  'title.reghUnmeasured': 'the audit projection is absent or refused, so whether this hook has ever fired is not known. That is a different fact from never — see the note above the table.',
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
  'ask.updatedAtTrap': '{m:updated_at} is {b:index write time}, not a content timestamp. This surface never rebuilds the index: rows stay as the last hook or CLI run left them.',
  'ask.predefined': 'Predefined queries',
  'ask.predefined.ops': 'Operations by count',
  'ask.predefined.spilled': 'Most-spilled items',
  'ask.predefined.injected': 'Most-injected items',
  'ask.predefined.sessions': 'Sessions',
  'ask.sqlh': 'The query this composed',
  'ask.sqlCaption': 'the SQL this answer ran. The final {m:LIMIT} binds one row more than the cap — the extra row signals truncation, dropped before display.',
  'ask.sqln': '{b:Shown, never typed.} Composed from the fields above, values bound as parameters. {m:/api/ask} takes fields only, never the statement — no path from here to the database.',
  'ask.whyq': 'Why there is no SQL box',
  'ask.why': "{m:readOnly:true} still permits {m:VACUUM INTO '<any path>'} — a full db copy. A keyword scan misses bracket or backtick identifiers. Removing the input removes it.",
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
  'doc.zero': 'Checked — none here.',
  'inj.zeroLines': 'This session was read and has received nothing yet.',
  'inj.noSession': 'No session is selected, so nothing was read — which is not the same as a session that received nothing.',
  // The THIRD zero, and until `InjectedBody.seen` was served there was no way
  // to tell it from the second: `readJsonlFile` swallows ENOENT, so an absent
  // seen file and an empty one arrived as the same `{ lines: [], error: null }`
  // and a cleared session was told it “was read and has received nothing” about a
  // file nobody opened. Seven of nineteen live sessions were in that state.
  'inj.noSeenFile': 'No seen file was written for this session, so nothing was read here — the audit log may still record what it was given.',
  // The split over REAL injections (`TASK-the-already-in-context-split-only-
  // appears-under-a-hand`) — `screens/injected.js`'s `spillSection` draws
  // these. `spillHeld`/`spillAbsent` echo `sim.spillHeld`/`sim.spillAbsent`'s
  // own wording deliberately, so a reader who has met the hypothetical split
  // recognises the real one.
  'inj.spillsH': 'Spilled, and whether it is still absent',
  'inj.spillsUnmeas': 'not measured',
  'inj.spillsUnmeasTitle': 'The audit projection for this session’s real injection history could not be read. Run mycontext audit to build or refresh it.',
  'inj.spillsZero': 'This session’s own injection history spilled nothing — every real injection here delivered everything it offered.',
  'inj.spillHeld': '{b:ALREADY IN CONTEXT} ({n}): {mv:ids} — spilled from a real injection, but already delivered into this window since. Nothing to act on.',
  'inj.spillAbsent': '{b:GENUINELY ABSENT} ({n}): {mv:ids} — spilled from a real injection and never delivered into this window since. This is what a carry would actually change.',
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
  'ask.recall1': 'Matching is literal: {m:search "silently drop"} misses "dropped silently". {b:A stemmer is decided} — only in {m:search}/{m:query_items}, not {m:select()}, keeping injection deterministic.',
  'ask.recall2': '{b:The case is recall, not ranking.} {m:core/search.ts} decided against ranking here. A parity test ships with it: one naive swap dropped a query from {b:14 hits to 1}.',
  // Doctor
  'doc.h': 'Doctor',
  'doc.v': '"exit 1" loses the findings list',
  'doc.sub': 'Grouped by code, in three levels. Each row links its item. A repair command sits under the table it answers for; a finding only a person can settle carries mycontext ack on its own row, which records the ruling and changes nothing else.',
  'doc.d1': 'its source document changed since the snapshot',
  'doc.d2': 'scope {mv:scope} matches no file',
  'doc.d3': '{b:Zero files match any watched glob}, so the capture nudge never fires. The shipped defaults name three paths from one workflow — this repo has none.',
  'doc.notice': 'notice',
  // The other two card headings. The mockup keys only `doc.notice` and
  // draws these two as literals; the app draws all three from the table, so
  // two of three headings are no longer English under Hebrew.
  'doc.error': 'error',
  'doc.warning': 'warning',
  'doc.d4': 'a second cross-project knowledge store exists on this machine. {b:mycontext never reads or writes it}.',
  'doc.d5': 'another plugin writes durable learnings here — the same kind as {m:lesson}, a second spelling, no shared ids. It is {b:watched}: edits nudge, a human decides.',
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
  // Reworded 2026-09-03. It used to end "Nothing to compose, so nothing is
  // offered", which stopped being true the day a finding a person settles began
  // drawing `mycontext ack`. What it says now is the narrower fact still true of
  // the rows that draw it: the finding names no item, so there is not even a
  // ruling to record against one.
  'title.noRepair': 'Settled by a person, outside my_context — a file edit, a config key, a machine PATH. This finding names no item either, so there is nothing to acknowledge: what settles it is not a command this product can compose.',
  // The OTHER reason, and it is a different fact rather than a softer one: the
  // finding asks for no action at all. `index_missing` says the index is
  // disposable and will be built on the next command; `nested_corpus` says
  // nothing is wrong with it existing. "No automated repair" over those two
  // described the product instead of the finding — true, and about the wrong
  // thing.
  'doc.noaction': 'nothing to do',
  'title.noAction': 'A disclosure, not a defect. This finding reports something worth knowing and asks for no change — its own words say so. Nothing is offered because nothing needs doing.',
  // **THE ROW SAYS THAT SOMEBODY RULED ON IT.** Added 2026-09-03, after the
  // owner reported that running a repair from Doctor "do nothing": `ack` had
  // been writing `Finding.acknowledged` since 2026-08-27, `/api/doctor` had been
  // serving it, and no screen had ever drawn it — so the one command 73 of 74
  // findings offer changed nothing a reader could see.
  //
  // The word is what tells this chip apart from the other neutral one beside
  // it, so it is the carrier and not the decoration — see `doctor.js`'s
  // `acknowledgedChip`. The title carries the sentence, and the sentence is the
  // ack design's own load-bearing claim, in the CLI's own words: still
  // reported, still counted, still in the exit code. A reader who believed this
  // was a silencer would be reading the screen wrong in the one direction that
  // matters.
  'doc.acked': 'acknowledged',
  // Sits directly above the command on a row that is already ruled on, so the
  // reader learns it BEFORE pressing rather than from the run. Owner,
  // 2026-09-03: "clicked execute, clicked run it but nothing has changed".
  // Says what the command will do and stops — which control an acknowledged row
  // ought to offer instead is the owner's open question, not this sentence's.
  'doc.ackedNoop': 'Already ruled on. Running this again writes nothing.',
  'title.acked': 'A person read this finding and ruled on it. It is still reported, still counted in the numbers above, and still contributes to the exit code — an acknowledgement is a mark, never a silencer. Run mycontext ack <id> <code> --clear to withdraw the ruling and open the finding again.',
  // A THIRD number, added the day `mycontext ack` reached this screen. Two
  // numbers said the screen was honest; neither said what to DO, and on this
  // repository the answer was 74 findings with no control on any row.
  //
  // And a FOURTH, 2026-09-03. `settle` counts the rows that CARRY the ack
  // control and is deliberately not reduced by the rulings already made — see
  // `doctor.js` for the argument, and `read-model.ts` for the badge that does
  // answer the "waiting for you" question. `acked` is the number that was
  // missing: without it, acking a finding moved no figure on this screen at
  // all, which is the same silence one level up from the row.
  // And a FIFTH, 2026-09-03, the day a note stopped being counted as work.
  // Owner: "after you complete handling them, the test should be that they will
  // not be listed anymore at doctor list". `state_audit_coverage`,
  // `body_review_limits` and `citation_form_excused` each say in their own words
  // that nothing is owed, and each was a row he had to read and dismiss. They
  // are notes about the CHECKS now, drawn under the table each one limits, and
  // out of `findings` — which is why the count needs a slot of its own rather
  // than a smaller first number and no explanation. Nothing vanishes with no
  // figure (INV-nothing-is-dropped-silently); it is just no longer counted as
  // something to do.
  //
  // "notes about the checks" and not "notes": `doc.notice` already calls an
  // info-level FINDING a notice on this very screen, and two meanings of one
  // word in one tally is the reader's problem, not the label's.
  'doc.tally': 'findings: {findings} · with an automated repair: {repairs} · yours to settle: {settle} · already ruled on: {acked} · notes about the checks: {notes}',
  // **THE NOTE A CHECK MAKES ABOUT ITSELF**, drawn where it explains something.
  // `Finding.about` names the CHECK, so `body_review_limits` — "the findings
  // above are a FLOOR and not a count" — opens under the
  // `body_disagrees_with_meta` table those findings are in, and
  // `state_audit_coverage` opens under `state_unaudited`.
  //
  // The check comes FIRST because it is what the reader is looking at; the
  // disclosure's own code comes second because it is what they would grep or
  // paste, and dropping it would be the only thing this change actually lost.
  // Both are `{mv:} — a finding code is an identifier, and an identifier inside
  // RTL prose reorders unless it is isolated (`doc.shared`'s own reason).
  //
  // "not a finding" is the load-bearing half: the sentence must not read as a
  // hint that something was hidden. Nothing was — the whole message is one
  // click away, unedited, and the CLI prints it under the same two codes.
  'doc.about': '{mv:check} — {mv:code}: a note about this check, not a finding',
  // **THE REPEAT, SAID ONCE.** Measured 2026-09-01 against this repo's own
  // corpus: 42,353 characters of `Finding.message` on the Doctor screen, of
  // which 34,440 are the same paragraph re-printed — 34 `citation_form` rows
  // carrying one 943-character explanation each, 36 `body_disagrees_with_meta`
  // rows carrying one 91-character instruction each. The owner has reported
  // that shape three times, once measured at "58,000 characters of
  // near-identical paragraph".
  //
  // `sharedTail` finds the sentence they share and `doctor.js` draws it ONCE
  // per code, in the mockup's own `details.help`, under the table. This is the
  // summary of that disclosure and it says three things a reader needs before
  // opening it: WHICH code it belongs to, that it is the REST of a note they
  // have already begun reading, and how many rows it is the rest of. Nothing
  // was deleted — `row text + this note` is the producer's message byte for
  // byte — so the summary must not read as a hint that something was.
  //
  // `{mv:code}` and never `{code}`: a finding code is an identifier, and an
  // identifier inside RTL prose reorders unless it is isolated.
  'doc.shared': '{mv:code} — the rest of the note, same on {count} rows',
  // **ONE RULING FOR A WHOLE CODE**, added 2026-09-03 when the owner overturned
  // his own no-bulk ruling: "for notices that could be many items, we need to
  // have a capability to fix all of them at once using doctor". Seventy of this
  // corpus's seventy-one findings are settled by a person reading one argument,
  // and one at a time that is seventy confirmations.
  //
  // Three facts and no more, in the order a reader needs them: WHICH code, HOW
  // MUCH it covers, and that nothing disappears. The last is the one a reader
  // could most easily get wrong — an acknowledgement is a mark and never a
  // filter (`core/acknowledge.ts`, owner ruling 2026-08-27) — and it is the same
  // promise `title.acked` makes on the row.
  //
  // The count is in this sentence AND in the command under it, which is not a
  // repetition: `--count` is how the CLI is consented to, so the number agreed
  // to is a number that is visible in the line being agreed to.
  //
  // `{mv:code}` and never `{code}`: a finding code is an identifier, and an
  // identifier inside RTL prose reorders unless it is isolated.
  'doc.settle': 'One ruling for all {count} {mv:code} findings, on {items} item(s). Every one stays reported and counted, and each ruling clears on its own.',
  // Decay
  'dec.h': 'Decay',
  'dec.v': 'a chart, not a table — of sessions',
  'dec.sub': 'Items not injected in the last N {b:sessions}, not weeks. The ledger keeps one row per session, item and tier — a repeat in one session collides, storing first-injections only. Delivery history below is a separate measurement.',
  'dec.comb': 'Recency comb — one tooth per item, never bucketed',
  'dec.warm': 'warm',
  'dec.cold': 'cold',
  'dec.never': 'never injected — a kind, not a big number',
  'dec.badpin': 'pinned {b:and} cold — a defect signal, not decay',
  'dec.unres': 'unrestricted — a breadth view over cold ∪ warm, never a third bucket',
  'dec.caveat': '"Cold" means: not injected in the last {window} sessions. This ledger holds {sessions} sessions.',
  'dec.caveatNew': 'That is fewer than the window, so "cold" here mostly means "new".',
  'dec.caveatIn': 'The window sits inside what the ledger can see, so the badge means what it says.',
  'dec.caveatUnit': 'Axis and badge are both counted in sessions; there is no clock in this chart.',
  'help.whyCold': 'What "cold" does and does not mean',
  'dec.help': 'The ledger records {b:injection}, not reading or reliance. A cold item can still govern — a cold {m:always:true} item is a selection bug, not decay.',
  'dec.heat': '90-day delivery, per item — delivered against spilled',
  'dec.heatn': 'One cell per day. Intensity is delivery amount; {b:hatched} means {b:spilled} that day; empty means nothing happened — quiet, not chosen or thrown away. Source: {m:audit_item.role} joined to {m:audit.at}, filtered by {m:since}/{m:until}.',
  // Relations
  'gr.h': 'Relations',
  'gr.v': 'an ego-graph, not a hairball',
  'gr.sub': 'One focused item, radius 1, deterministic layered layout, hard cap of 60 nodes with an explicit "+N more". No physics, no dependency.',
  // The focus picker's label. Until it existed the ego graph was drawn around
  // `items.items[0].id` and nothing chose it.
  'gr.focus': 'The item at the centre',
  // ── THE RELATION-TYPE FILTER (owner ruling 2026-09-01) ───────────────────
  // The type NAMES are not here and never will be: they are `RELATION_TYPES`,
  // a closed vocabulary in `core/vocabulary.ts` served on `/api/graph`, and a
  // copy of them in a string table is the same defect as a copy of them in the
  // screen. What is keyed is the prose AROUND them.
  // ── THE PICKER HIDES THE UNRELATED, AND SAYS SO (owner ruling 2026-09-01)
  'gr.lonely': '{n} item(s) have no relations of the types you kept and are not listed — each would draw a single node.',
  'gr.lonelyShow': 'List them anyway',
  'gr.retired': '{n} retired item(s) are not listed.',
  'gr.retiredShow': 'List retired items',
  'gr.retiredHide': 'Hide retired items',
  'gr.lonelyHide': 'Hide them again',
  'gr.filter': 'Relation types',
  'gr.filterAll': 'All',
  'gr.filterNone': 'None',
  'gr.filterHid': '{n} relation(s) hidden by the type filter',
  'gr.filterEmpty': 'No relation of the types you kept. {n} relation(s) are hidden — turn a type back on to see them.',
  // ── ALL-OFF IS A FACT ABOUT THE CONTROL, NOT ABOUT THE CORPUS ────────────
  // `gr.filterEmpty` above measures ONE ITEM against a filter and is undone by
  // choosing another item; these two are true of every item at once and are
  // undone only by `All`. Said separately for that reason — a reader told "no
  // relation of the types you kept" while nothing at all is kept would go
  // looking for the item that does have one, and there is none.
  'gr.filterOff': 'No relation type is selected, so there is nothing to draw — here or on any other item. Press All, or choose a type.',
  'gr.lonelyOff': 'No relation type is selected, so no item has a relation of a kept type — {n} item(s) are not listed.',
  'gr.filterNoRel': 'This item has no relations at all, so there is nothing for the type filter to act on.',
  'gr.lfocus': 'focus',
  'gr.lmiss': 'target not in corpus',
  'gr.lsup': 'superseded',
  'gr.lbear': 'load-bearing',
  'gr.lref': 'referential',
  'gr.ldang': 'dangling',
  'gr.note': 'Nodes carry {b:ids}, not titles — keeping bidi text out of the SVG. Each edge shows {b:relation type}; line style shows severity: {m:isLoadBearing} classifies it, so dangling {m:relates_to} reads as noise, dangling {m:constrains} as alarm. Column shows direction.',
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
  'work.drafts': '{b:Drafts awaiting a decision.} {n} in this queue. A draft governs nothing until promoted.',
  'work.draftsEmpty': '{b:Drafts awaiting a decision.} None — everything captured is already settled.',
  'work.revisions': '{b:Revisions proposed against items in force.} {n} in this queue. Items keep their current text until promoted.',
  'work.revisionsEmpty': '{b:Revisions proposed against items in force.} None — nothing has been proposed yet.',
  'work.draftMeta': '{mv:type} · {mv:severity} · captured by {mv:origin}',
  'work.outcome': 'Outcome',
  'work.accept': 'Accept',
  'work.reject': 'Reject',
  'work.promoteDraft': '{b:Accept} promotes the draft: it becomes active and governs this project from the next session.',
  'work.discardDraft': '{b:Reject} discards the draft: retired unpromoted, it never governs, and the text is not deleted.',
  'work.promoteRev': '{b:Accept} promotes the revision: the proposed fields replace the text in force on the item above.',
  'work.discardRev': '{b:Reject} discards the revision: the proposal is dropped and the item keeps its current text — the outcome a stale revision can still reach.',
  'work.moved': 'changed since staging',
  'work.blocked': 'promote refuses until re-based',
  'work.diffn': 'The proposed column is a line-level diff, not a paragraph to compare by eye: additions are tinted, removals are struck, both real {m:<ins>} and {m:<del>} elements, so a screen reader announces the change with no added ARIA.',
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
  'work.h3': '{b:If the body moved first}, promote refuses and names both values — that is the product working, not failing.',
  // Capture
  'cap.h': 'Capture',
  'cap.v': 'shows what already governs before you add another',
  'cap.sub': 'Composes an {m:add}. What it contributes over the CLI is the overlap check — the items already governing this scope.',
  'cap.already': 'Already governing {mv:scope}',
  'cap.o1': 'invariant, normative',
  'cap.o2': 'standard, normative',
  'cap.nosim': 'These are the items whose {b:scope matches}. No similarity or ranking is shown, because no similarity metric exists in this product.',
  // `notGoverning` — served since the screen was built and drawn nowhere for
  // want of this key. It is the count the overlap check REMOVED: items whose
  // scope matches and which do not govern. A bare number would not be a fact.
  'cap.notgov': '{n} more items match this scope and do not govern — drafts, deprecated items and rationale categories.',
  // Composer
  'pal.h': 'Composer',
  'pal.v': 'real pickers and a live glob tester',
  'pal.sub': 'Builds a command from selections. Arguments show as chips, so shell syntax in a value is visible before it reaches your clipboard.',
  'pal.argv': 'Arguments',
  'pal.block': '{b:Copy is blocked.} One argument has shell substitution syntax; double-quoting does not neutralise {m:$(…)} in a POSIX shell.',
  'pal.glob': 'Glob tester',
  'pal.pattern': 'Scope pattern',
  'pal.globn': 'Every file in the repository, matches {b:lit as you type}. A bare count — "{matches} files" — cannot be inspected: an empty and a near-empty result look the same until you see which files. Uses the {m:globToRegExp} cache, over {m:listRepoFiles}.',
  'pal.globDead': 'An item scoped to this pattern would govern nothing — it matches no file in '
    + 'the repository. {m:doctor} reports that as {m:dead_scope}.',
  // The Composer's own six keys — `TASK-the-six-palette-keys-the-plan-declares-and-neither-table`.
  // `pal.run`, `pal.item`, `pal.rows`, `pal.noRows` and `pal.truncated` replace
  // this screen's borrowing of `ask.run` / `th.item` / `ask.rows` / `ask.noRows`
  // / `ask.truncated` — editing one of those for the Ask screen would silently
  // have changed this one too, and no test would have noticed. `pal.incomplete`
  // is new: the sentence "Required inputs are missing" used to be `aria-invalid`
  // and nothing else, so a sighted reader saw an empty command box and no
  // reason for it.
  'pal.run': 'Run',
  'pal.item': 'Item',
  'pal.rows': '{rows} rows',
  'pal.noRows': 'no rows matched',
  'pal.truncated': 'capped at {rows} rows — more matched; raise the limit to see them',
  'pal.incomplete': 'Required inputs are missing — fill them in to compose a command.',
  // Execute — the one Copy-and-Execute control (lib/command-actions.js).
  //
  // The RESIDUAL is deliberately not a key here. `src/ui/execute.ts` spells it
  // once and the confirm renders what the server sent, because a sentence
  // duplicated into the browser is a sentence that gets reworded on one side
  // only — and this is the one sentence a security boundary is made of.
  'exec.btn': 'Execute',
  // The confirm GET runs the command against a copy of the corpus before it
  // will show anything, which is seconds rather than milliseconds — measured
  // 5.1–7.3s on `.demo-corpus`. This is what stands there meanwhile, so a wait
  // reads as a wait rather than as a control that did nothing.
  'exec.checking': 'Checking what this command changes — it is run against a copy of the corpus first, which takes a few seconds.',
  'exec.h': 'Run this command?',
  'exec.go': 'Run it',
  'exec.cancel': 'Cancel',
  'exec.changes': 'What changes — in force, then proposed',
  'exec.exit': 'exit {code}',
  'exec.noexit': 'the command did not exit under observation',
  // The label over the command's own output. Owner, 2026-09-03: the run
  // answered "already acknowledged … nothing was written" and the page drew a
  // green exit code over it. Four words, because the field under it is the
  // content and a heading that explains itself is a heading nobody reads.
  'exec.said': 'What the command said',
  'exec.item.created': '{b:{mv:id}} — created',
  'exec.item.changed': '{b:{mv:id}} — changed',
  'exec.item.removed': '{b:{mv:id}} — removed',
  'exec.nochange': '{b:This changes nothing.} It was run against a copy of the corpus and no item came out different. It is still a write, and it still runs.',
  // Configure
  'cfg.h': 'Configure',
  'cfg.v': 'the strongest "a terminal cannot do this"',
  'cfg.sub': 'Every change is previewed as a diff, checked against the same {m:resolveConfig} that reads it.',
  'cfg.budgets': 'Budgets',
  // The two hard stops `/api/config` carries as FIELDS rather than as a 500.
  // The loader's own sentence follows each of these, unedited and
  // untranslated; what these say is WHICH of the two failures it is, which
  // is the one thing about them a reader could not get from the text itself.
  'cfg.parseErr': '{m:config.json} could not be parsed. The loader’s own message follows.',
  'cfg.resolveErr': '{m:config.json} parsed, and could not be resolved. The loader’s own message follows.',
  'cfg.effect': 'What changes',
  'cfg.deltan': 'Each row is the {b:pair}: old value struck through, new value highlighted, tinted by direction. A lone {m:+1} chip loses the pairing.',
  'aria.scopepolicy': 'scopePolicy',
  'cfg.spn': 'The border colour and count {b:are} the blast radius: how much of the corpus stops working. {m:inert} is the most destructive option. {m:scopePolicyFor} computes this exactly — items named, not estimated.',
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
  'cfg.nocmd': 'No {m:mycontext} command edits a budget, and no agent can — the hook says so verbatim: {i:"changes to {m:.my_context/config.json} are the user\'s to make — ask, do not edit."} A person can, behind a confirm showing every value.',
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
  'cfg.watchednote': '{m:init} writes what this repository actually has, not a fixed set of paths from one workflow. The list {b:replaces} and never merges — it never gains globs you did not add.',
  'cfg.h1': '{b:Budgets are written here}, past the confirm above. Every other key is yours to edit — the hook refuses an agent that tries.',
  'cfg.h2': '{b:The receipt:} this screen re-reads {m:config.json} from disk every load, so returning shows the new value, or a {m:parseError} field if the JSON broke.',
  // ── One pane per configuration subject — `plan:config seq:1`, 2026-08-29.
  // Four headings, four explanatory sentences, and the labels on the controls
  // inside them. Every value a control offers is a literal the loader accepts,
  // drawn untranslated on the control itself, so these sentences carry the
  // MEANING of each value and never a second vocabulary for it.
  'cfg.profile': 'Profile',
  'cfg.profilen': 'Which category catalogue applies. {m:standard} ships every category; {m:minimal} is the smallest useful set. A left-out category is not disabled, it is absent — its items are injected nowhere.',
  'cfg.inforce': 'In force now. Press the other to compose the change.',
  'cfg.budgetsn': 'The token ceiling per tier — the one value on this screen a person can write here, behind the confirm below.',
  'cfg.cats': 'Categories',
  'cfg.catsn': 'One category at a time: tier, what an empty scope means, whether an agent may edit it, and its two free-text fields. A change here goes {b:inside} the {m:categories} object, never as a new top-level key.',
  'cfg.catpick': 'Which category',
  'cfg.tier': 'Tier — {m:normative} injects in full; {m:rationale} only counts in the session index.',
  'cfg.policy': 'What an empty scope means: {m:global} is unrestricted, {m:required} refuses a capture without one, {m:inert} injects on no file.',
  'cfg.agentedits': 'Whether an agent may edit an item of this category, or must stage a revision for review.',
  'cfg.prefix': 'The id prefix, uppercase. The placeholder is the prefix in force.',
  'cfg.desc': 'What this category is for, as the help prints it. The placeholder is the description in force.',
  'cfg.extran': 'Extra fields in force: {fields}. Read-only here — a list or nested {m:updates} object needs the category wizard, which is not built.',
  'cfg.watchedn': 'Globs whose edits earn a nudge. Read only by the PostToolUse hook — no {m:mycontext} command prints this list back.',
  'cfg.globhint': 'docs/**/*.md',
  'cfg.blast0': 'No change — this is the configuration in force.',
  'cfg.blast0n': 'Nothing starts or stops governing, delivery does not move, and all {unchanged} items are unaffected.',
  'cfg.blasts': '{n} items stop being delivered at the start of a session',
  'cfg.blastsn': 'They still govern but no longer fit. Counted by running {m:select}, the same selector the hook runs, twice over the same items — what would start spilling.',
  'cfg.blaste': '{n} items change who may edit them',
  'cfg.blasten': 'Nothing starts or stops governing, and nothing stops being delivered — {m:agentEdits} decides who may write, not what is injected. Items are the ones {m:agentEditsFor} named — counted, not estimated.',
  'cfg.blasta': '{n} more items are delivered at the start of a session',
  'cfg.blastan': 'Nothing stops governing or being delivered. Counted by running {m:select} twice over the same items and context.',
  'cfg.blastw': '{n} items start governing this project',
  'cfg.blastwn': 'Nothing stops governing, and {unchanged} items are unaffected. Counted by running {m:injection} twice, once per config — not estimated.',
  'cfg.blastc': '{n} items stop governing this project',
  'cfg.blastcn': 'They keep existing but stop being injected; {unchanged} items are unaffected. Counted by running {m:injection} twice, once per config — not estimated.',
  'cfg.blastu': 'Unmeasured — no endpoint answers what this key governs.',
  'cfg.blastun': 'The preview runs {m:injection}, {m:scopePolicyFor}, {m:agentEditsFor} and {m:select} — none reads this key. A zero here would answer a question nobody asked, so no count is drawn.',
  'cfg.unscoped': '{mv:policy} decides its reach: {n} unscoped {mv:cat} items, named and counted by the same lookup the selector runs.',
  'cfg.gov': 'governs',
  'cfg.notgov': 'does not govern',
  'cfg.delivered': 'items delivered at session start',
  'cfg.spilledn': 'items spilled',
  'cfg.tokensn': 'tokens charged',
  // ── The paste hand-off — `plan:config seq:4`, 2026-09-01. ────────────────
  // Composing the right bytes and leaving a person holding them is half a
  // hand-off. Four numbered steps: the file, WHERE in it, the block, and what
  // to run afterwards. Step 2 is derived from what the file already contains —
  // the six `cfg.pl.*` sentences below are the six placements a block can have,
  // and picking the wrong one is the failure the task names as its acceptance
  // test.
  'cfg.step1': 'Open this file in your editor — it is the exact file this server read, not an abbreviation of one elsewhere.',
  'cfg.step1new': 'This file does not exist yet — the block below is its whole contents, outer braces included.',
  'btn.copypath': 'Copy the path',
  'cfg.step3': 'Paste this — it is already indented to align with the entries around it.',
  'cfg.step4': 'Save the file, then run this to confirm the paste took. It re-reads {m:config.json} and names the file if it fails to load.',
  'cfg.step4b': 'Save the file. No {m:mycontext} command reads a budget back — return to this tab and the value above re-reads from disk.',
  'cfg.pl.newfile': 'The file does not exist yet. The block below is its entire contents, outer braces and all.',
  'cfg.pl.newkey': 'Your file has no {mv:key} key yet. Paste the block inside the outermost braces as a new top-level entry, comma after the entry before it.',
  'cfg.pl.replacekey': 'Your file already sets {mv:key}. Replace that entire entry, key to closing brace, with the block below.',
  'cfg.pl.newentry': 'Your file already has a {m:categories} object. Paste {b:inside} it, never as a second top-level {m:categories} key — that would silently replace everything. Paste after {mv:last} and its comma.',
  'cfg.pl.newentry0': 'Your file has an empty {m:categories} object. Paste this between its braces, {b:inside} the object — never a second top-level {m:categories} key.',
  'cfg.pl.replaceentry': 'Your file already declares {mv:key}. Replace that entry inside the {m:categories} object, name to closing brace, with the block below.',
  // ── The category wizard — `plan:config seq:3`, 2026-09-01. ───────────────
  // Stepped rather than a form, because the ordering is real: the tier decides
  // which `agentEdits` default sits under it, and a prefix collision is only
  // knowable against the whole catalogue. Every closed vocabulary is served by
  // `GET /api/config`'s `meta`, so nothing here invents a value the loader
  // would refuse.
  'cfg.wiz': 'Create a category',
  'cfg.wizn': 'A kind of item the catalogue does not ship. Every step offers only values the loader accepts, so nothing here can compose a refusal. The two free-text steps show the rule they are checked against.',
  'cfg.wizstep': 'Step {n} of {total}',
  'cfg.wizback': 'Back',
  'cfg.wiznext': 'Next',
  'cfg.wizpending': 'Finish the flow first. The effect on this corpus is measured once the category is complete — the loader cannot check one with no name or tier.',
  'cfg.wz.name': 'The category name, lowercase, typed after {m:mycontext capture}. It becomes the item {m:type} and cannot match one already configured.',
  'cfg.wz.namehint': 'decision',
  'cfg.wz.prefix': 'The id prefix this category mints ids under — an id is {m:PREFIX-slug}, also the file name. Leave empty and the loader derives one from the name.',
  'cfg.wz.desc': 'What this category is for, in one sentence, as the help will print it. Required: a custom category needs a tier and description, or the loader refuses it by name.',
  'cfg.wz.deschint': 'A choice made once, with the reasoning that made it.',
  'cfg.wz.extra': 'Extra frontmatter fields its items may carry, comma-separated. Leave empty for none.',
  'cfg.wz.extrahint': 'plan, seq, state',
  'cfg.wz.updates': 'What may be changed on its items, beyond what the tier already declares. A category may declare none.',
  'cfg.wz.upname': 'The updatable name — the word a person types to change it.',
  'cfg.wz.upnamehint': 'state',
  'cfg.wz.upstore': 'Where the value lives.',
  'cfg.wz.upvalues': 'Its legal values, comma-separated. Leave empty for free text.',
  'cfg.wz.upvalueshint': 'todo, doing, done',
  'cfg.wz.upprojects': 'The field or tag prefix it projects to. Optional.',
  'cfg.wz.upnote': 'One sentence saying what it is for. Optional.',
  'cfg.wz.upnotehint': 'Where this task is.',
  'cfg.wz.upadd': 'Add another',
  'cfg.wz.updrop': 'Remove',
  'cfg.wz.upnone': 'None declared — a deliberate choice, not a gap. This category adds nothing of its own; the tier still sets the general rules.',
  'cfg.wz.taken': '{mv:name} is already a category here. This flow defines a new one — to change the existing one, use the Categories pane above.',
  'cfg.wz.pfxtaken': '{mv:prefix} is already used by {mv:cat}. Two categories sharing a prefix would mint ids nobody can tell apart.',
  'cfg.wz.need': 'This step needs a value before the next one.',
  'cfg.wz.resolved': 'What the loader makes of it, including every default it filled in — read back from {m:POST /api/config/check}, not predicted here.',
  // Procedures
  'pr.h': 'Procedures',
  'pr.sub': 'An ordered set of steps performed {b:once} and then done — unlike a rule, which applies every time. {b:Built, and this screen reports it.}',
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
  'pr.why': '{b:Injecting only in {m:active} is the mechanism, not a request the model can ignore.} A procedure held in full may be followed, so delivered only when you set the state deliberately. Real risk: a procedure left {m:active} forever, injecting long after work ended.',
  'pr.item': '{mv:item}',
  'pr.steps': 'steps',
  'pr.k1': 'Add the integer column beside the decimal one',
  'pr.k2': 'Backfill, and verify the two agree on every row',
  'pr.k3': 'Switch reads to the integer column',
  'pr.k4': 'Switch writes, behind the flag',
  'pr.k5': 'Drop the decimal column',
  'pr.md': 'Steps are a {m:## Steps} section in the Markdown, parsed like {m:## Observations}. {b:"{done} of {steps}" is counted, never stored} — no second place to disagree.',
  'pr.write': 'Who may tick a box',
  'pr.w1': '{m:mycontext procedure step} may flip {b:one checkbox}, matched by a strict pattern, touching no other byte of the item. It skips the draft gate.',
  'pr.w2': '{b:That is a distinction, not an exemption.} The gate stops an agent changing normative {i:content}; a checkbox is {i:progress}. Every flip is audited, so this stays visible.',
  'pr.w3': '{b:What is not relaxed:} the state. {m:active → done} stays yours. The last box does not close the procedure — it lets the agent {i:ask}.',
  'pr.aband': 'Abandoned rather than finished is {m:superseded} — the existing status already means exactly that.',
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
  'port.sub': '{b:Built, and this screen reports it.} It once listed five open questions — now it lists their answers.',
  'port.what': 'What travels',
  'port.yes': 'travels',
  'port.filtered': 'filtered',
  'port.no': 'rebuilt',
  'port.hist': '{b:History travels, and it is filtered.} Mutations carry; injections, hook actions, focus records, refusals and procedure ticks do not. Imports land in {m:.audit/imported/}, so a receiver can tell witnessed from told.',
  'port.fmt': 'The format, in order of preference',
  'port.f1': 'A plain directory',
  'port.f1n': 'canonical. Readable, diffable, and needs no tool to open',
  'port.f2n': 'where git exists — carries real history, one file',
  'port.f3': 'Deterministic ZIP',
  'port.f3n': 'otherwise. Fixed order and fixed timestamps, so the same corpus is the same bytes',
  'port.git': '{b:What it adds over git:} the corpus already lives in the repository; this is for someone {i:not} sharing it — another workspace, team, or a machine with no common remote.',
  'port.coll': 'On import — three buckets, and nothing applies unconfirmed',
  'th.bucket': 'Bucket',
  'th.example': 'Example',
  'port.b1': 'new',
  'port.b2': 'same id, different content',
  'port.b3': 'identical',
  // Template packs
  'pk.h': 'Template packs',
  'pk.sub': 'A pre-authored corpus someone published — "the regulated-industry flavour" — imported at {m:init}, so you start from an opinion, not empty.',
  'pk.trust': 'Where it lands, and why that differs',
  'pk.active': 'draft',
  'pk.draft': 'draft',
  'pk.trustn': '{b:Both routes land the same way, as draft} — every item a pack brings in arrives as a proposal. {b:There is no {m:--trust} flag}: a boundary a flag can override is not a boundary.',
  'pk.what': 'What a pack may carry',
  'pk.cats': 'category configuration',
  'pk.never': 'never',
  'pk.line': 'The line, once: a pack carries what its author knows about the {b:domain}, never a setting describing {b:you} — budget or repo layout the author cannot see.',
  'pk.man': 'Integrity, described accurately',
  'pk.m1': 'Digest',
  'pk.m1n': 'full, per file, sorted',
  'pk.m2': 'Version',
  'pk.m2n': 'descriptive, supplied by the author when packing — there is no git address to derive one from',
  'pk.m3': 'Discovery',
  'pk.m3n': 'a curated list in the docs. No registry, no re-fetch, no version check over the network',
  'pk.m4': 'Updating',
  'pk.m4n': 'import again; the three buckets show what changed',
  'pk.theatre': '{b:What the digest does not prove.} A checksum proves files arrived intact, not that the author is trustworthy — it never gates activation. The {m:checksum} field is a 16-hex drift truncation, unused here.',
  // Documentation
  'dv.h': 'Documentation',
  // Rewritten 2026-09-05 (`docsys/5`). The screen used to render exactly one
  // `mycontext help` topic and these two sentences said so; it now draws the
  // server's own document manifest, so they say THAT instead. A verdict and a
  // subtitle describing a data source the screen no longer reads is the same
  // defect `TASK-the-documentation-screen-still-promises-the-readme-on-screen`
  // was filed for, pointing the other way.
  'dv.v': 'the repository’s own documents, indexed from the server’s manifest and read here',
  'dv.sub': 'Every Markdown document under {m:docs/} and {m:reports/}, plus {m:README.md} itself — listed from the server’s own manifest and opened by id. The browser never sends a path.',
  'dv.toc': 'Contents',
  'dv.t1': 'What this is',
  'dv.t2': 'Install',
  'dv.t3': 'The five tiers',
  'dv.t4': 'Scope',
  'dv.t7': 'The trust boundary',
  'dv.parity': 'The EN/HE switch self-disables when the parity test is red — a mirror that has drifted is worse than none.',
  'dv.rendered': '§{ordinal} — {heading}',
  'dv.mdnote': 'A vendored tokeniser hands over tokens, never an HTML string, so nothing needs sanitising. Raw HTML, images and unknown URL schemes are {b:refused and shown as refusals}, never dropped silently.',
  // The three refusals `dv.mdnote` promises, worded. The mockup builds them
  // inside its own script and keys none of them; drawn from here they are the
  // renderer's words in the reader's language, and the alt text and the link
  // label — which are the document's, not the product's — still survive.
  'dv.imgRefused': '{alt} (image refused)',
  'dv.linkRefused': '{label} (link refused)',
  'dv.htmlRefused': 'raw HTML block refused',
  // ── The derived index, the picker and the measured Hebrew mirror ────────
  // `docsys/5` (the index is the manifest's, not five literals) and `docsys/6`
  // (whether a Hebrew mirror exists is READ OFF DISK, per document, and never
  // written down here). Every number in these sentences arrives as a
  // substitution from `GET /api/doc`; not one of them is a literal.
  'dv.docs': 'Documents',
  'dv.filter': 'Filter by path',
  'dv.shown': 'Showing {shown} of {total}. Type above to narrow the list.',
  'dv.nomatch': 'No document matches that filter.',
  'dv.hemirror': 'Hebrew mirror: {done} of {total} documents have one, measured on disk on every read.',
  'dv.heyes': 'a Hebrew mirror of this document exists',
  'dv.heno': 'no Hebrew mirror of this document exists yet',
  'dv.inthis': 'In this document',
  'dv.nohead': 'This document declares no headings.',
  'dv.nodoc': 'No document selected',
  'dv.pick': 'Pick a document from the list to read it here.',
  'dv.trunc': 'The repository walk stopped at its bound, so this list is incomplete and says so rather than presenting itself as the whole.',
  'dv.noid': 'This address names no document in the manifest, so nothing was read for it. The list beside this card is everything that is served.',
  // Tutorials
  'tu.h': 'Tutorials',
  'tu.v': 'each one titled with a job, not a feature',
  // Rewritten 2026-09-05 (`tuts/4`): "six replacing two" was the count the
  // screen hard-coded, and the roster is the manifest's now — 24 today, a
  // number this sentence therefore refuses to state.
  'tu.sub': 'One tutorial per feature, read in place. The roster is {m:docs/tutorials/manifest.json}; the EN and HE columns are measured against the files on disk on every read.',
  'tu.t': 'Tutorial',
  'tu.job': 'The job it answers',
  // ── The manifest-driven list, the rollup and the reader (`tuts/4`) ──────
  'tu.id': 'Manifest id',
  'tu.basic': 'Basic',
  'tu.adv': 'Advanced',
  'tu.rollup': 'Hebrew: {done} of {total} written, measured on disk.',
  'tu.donemeans': '{b:✅ means the file exists and carries all four required sections} — what it is for, how it works, from the CLI, from the UI. It is not a claim that the prose under them is any good.',
  'tu.unwritten': 'A tutorial with no file yet is not a link, because there is nothing to open.',
  'tu.back': 'All tutorials',
  'tu.enonly': 'This tutorial has no Hebrew file yet, so the English text is shown and labelled as English — never substituted silently under a Hebrew heading.',
  'tu.trunc': 'This tutorial is longer than one read serves, and was cut at that bound rather than trailing off.',
  'tu.none': 'The manifest names no tutorial at all.',
  'tu.noid': 'This address names no tutorial in the manifest, so nothing was read for it.',
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
  'tu.gap': 'Hebrew is shown as {b:to write}, not a language toggle that would silently fall back to English. The changelog already notes tutorials have no parity test — this is that gap, drawn.',
  // Learn
  'ln.h': 'Learn',
  'ln.v': 'conditional pass — the corpus cross-links earn it',
  'ln.sub': 'The four help topics, each linked to the items in {i:this} corpus that demonstrate it. That join is what a docs page cannot do.',
  'ln.c': 'which are normative',
  'ln.s': 'how scope restricts',
  'ln.p': 'what to write down, and when',
  'ln.w': 'the queue, revisions, supersede',
  'ln.cUnmeasured': 'no single item represents this',
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
  'pane.histn': 'Twelve weekly buckets from the audit projection: hatched where the item {b:spilled} that week, grey where nothing was delivered. It answers "is this still alive" for {i:every} item.',
  'pane.body': 'Body — as authored',
  // The label over the item summary — owner ruling 2026-09-01. It takes
  // `.welllabel`, the same register `pane.body` and `pane.hist` take, because the
  // ask was that the summary stop being the one unlabelled block in the pane and
  // not that it gain a heading of its own kind.
  'pane.summary': 'Summary',
  'pane.well': "Corpus text sits in a well and inside {m:<bdi>}. The product's own words never do — that is how you tell them apart.",
  // ── THE ITEM SUMMARY (2026-09-01, `plan:walk seq:119` phase 3) ───────────
  //
  // Two of these say a summary can no longer be trusted, and they are the app's
  // OWN wording rather than `summaryStalenessNote`'s. That function is one
  // English paragraph shared by `mycontext show`, `get_item` and `doctor`;
  // reusing it here would put English prose into the Hebrew UI, which is the
  // defect the provenance bar above already records costing every screen in
  // this product. The FACT is measured in exactly one place — `summaryState`,
  // core/content-hash.ts — and each surface says it in its reader's language.
  //
  // `sum.stale` and `sum.unanchored` are chip words and are deliberately two
  // or three: a chip carries its state in a WORD as well as a hue, and a chip
  // that needed a sentence would not be a chip.
  //
  // The four property words are the chips beside the summary. Each names a
  // property that changes whether a reader should act on the sentence they
  // just read and that the `<dl>` below does not carry — the argument is in
  // `fillPaneSummary` (app.js), against every field that did NOT earn one.
  'sum.stale': 'stale summary',
  'sum.unanchored': 'unanchored summary',
  'sum.staleNote': 'This item changed after the sentence above was written, so it describes text that is no longer here. Read the body, not the summary.',
  'sum.unanchoredNote': 'The sentence above has no record of what it was written against, so nothing says it still describes this item. Read the body, not the summary.',
  'sum.always': 'always injected',
  'sum.continuity': 'carries across sessions',
  'sum.agent': 'captured by an agent',
  'sum.until': 'valid until {mv:until}',
  'aria.prov': 'Provenance',
  // The four provenance-group labels. Colour says where a number came from
  // and these say it a second time, because colour alone fails a dichromat,
  // a monochrome printer and forced-colors (06-a11y.html).
  // ── THE TWO-ROW STRIP'S LINE 1, AND THE THREE FIELDS LINE 2 GAINED
  // (2026-09-01). Every one of these was already on the terminal status line
  // and on no web surface at all, which is the divergence this pass exists to
  // end: the two bars were specified separately with nothing holding them
  // together, and this project has now measured that same defect eight times.
  //
  // The strip is a SUPERSET, never a harmonisation: it keeps every field it
  // had — the review queue included, which the terminal refuses because it
  // costs a second database there and is free from /api/status here — and
  // gains everything the terminal draws.
  'strip.project': '{mv:project}',
  'strip.grp.model': 'model',
  'strip.grp.window': 'window',
  'strip.grp.cost': 'cost',
  'strip.grp.limits': 'limits',
  'strip.rlNone': 'no account windows reported',
  'strip.model': '{name}',
  // The non-default modes only. Composed server-side into one phrase, because
  // which words are "not the ordinary case" is a judgement about a payload and
  // not about a language: 'medium' effort is the default and is suppressed,
  // and a null is "the payload did not say", treated exactly as a default.
  'strip.modelModes': '{modes}',
  'title.model': 'The model answering this session, with any mode that is not the ordinary case.',
  'strip.sessionName': 'named {name}',
  'title.window': 'Which window this is, and what it is for. The name is drawn only when it differs from the project name — a session called after its project restates a block already on screen, and this field exists to tell two windows apart when the model, the project and the branch are identical in both.',
  'strip.focus': 'focus {mv:focus}',
  'strip.noFocus': 'no focus set',
  'strip.cost': '${usd}',
  'strip.warm': '{pct}% served from cache',
  'title.cost': 'What this session has cost so far, across every turn since it started.',
  // The DISTANCE to the ask, which is a different fact from what became of the
  // last one. Neutral, never gold: gold is earned at the warn band and a
  // marker that is gold at every fill has stopped meaning anything by the time
  // it is needed.
  'strip.ctxAsk': '{askPct}% ({pct} / {threshold}) ·+{headroom}',
  'strip.log': 'last {mv:op}, {age} ago',
  'strip.logQuiet': 'last {mv:op}, {age} ago',
  'strip.logEmpty': 'nothing recorded yet',
  'strip.logUnreadable': 'audit log unreadable',
  'title.sessionName': 'The name this window was given. Shown only when it differs from the project, so several windows can be told apart.',
  'title.focus': 'What this session has narrowed its knowledge to. Nothing focused means everything in scope is eligible.',
  'title.warm': 'How much of the input on this turn the cache served. Worked out from the payload, not reported by it.',
  'title.elapsed': 'How long this session has been running, in wall-clock time since its first turn.',
  'title.myctx': 'How much of this window my_context put there, against the window itself. Counted from the injection records’ own frozen estimates — bounded to the CURRENT compaction epoch and to operations that reach this model, so subagent injections delivered into other windows are not counted here. A ≥ means some records predate the estimate field and the true share is at least this.',
  'title.modelModes': 'Modes that are not the default: effort, extended thinking, fast mode, or a larger window.',
  'title.log': 'When the audit log last moved, and what moved it. If this stops advancing while you work, something has stopped recording.',
  'strip.grp.focus': 'focus',
  'strip.grp.sessionName': 'session name',
  'strip.grp.ask': 'ask',
  'strip.grp.rate5': '5h',
  'strip.grp.rate7': '7d',
  'strip.grp.myctx': 'myctx',
  'strip.configOk': 'config current',
  'strip.configBroken': 'config.json broken',
  'strip.configUnknown': 'config not read',
  'title.configOk': 'The config governing this page is {m:config.json} as it is on disk right now.',
  'title.configBroken': '{m:config.json} stopped loading. This page is still drawn from the last config that DID load. Open {m:Configure} to see the loader’s message and fix the file.',
  'title.configUnknown': 'Whether {m:config.json} is loading has not been checked yet on this page.',
  'strip.grp.elapsed': 'elapsed',
  'strip.grp.cache': 'cache',
  'strip.elapsed': '{elapsed}',
  'strip.level.caution': 'caution',
  'strip.level.warning': 'warning',
  'strip.level.critical': 'critical',
  // ── WHERE THIS SESSION IS, WHICH CORPUS IT GOT, AND AS OF WHEN ──────────
  //
  // Owner request, 2026-09-02. A stray `cd` twice moved a session into
  // `my-context/`, which silently switched every hook onto the nested 44-item
  // corpus instead of the real 759-item one, and nothing on either bar said
  // so. The directory is the CAUSE and the corpus is the EFFECT; both are
  // drawn, because a reader who sees only the directory still has to know that
  // `my-context/` holds a corpus of its own before it means anything.
  //
  // Both paths are drawn RELATIVE to the directory the session was launched
  // in, so the ordinary session NAMES that directory —
  // `test_mycontext_plugin` — and the broken one reads `./my-context`: a shape
  // change, not a diff two long paths apart. It read `.` until 2026-09-02 and
  // the owner could not read it ("they show maybe . that does not read"); a
  // field whose quiet value is a bare dot teaches the eye to skip it, which is
  // fatal to a field whose only job is to be glanced at. The whole absolute
  // path is on the hover; `relDir` in `lib/viewmodel.js` carries the argument
  // for all of it.
  'strip.grp.where': 'where',
  'strip.grp.cwd': 'cwd',
  'strip.grp.corpusRoot': 'corpus',
  'strip.grp.clock': 'clock',
  'strip.cwd': '{mv:dir}',
  'strip.cwdUnknown': 'not reported',
  'strip.corpusRoot': '{mv:dir}',
  // THE ALARM, and both counts are the point of it: the outage this comes from
  // was reading "44 items" as a project with little in it rather than as a
  // DIFFERENT corpus.
  'strip.corpusRootNested': '{mv:dir} — {items} items, {enclosing} above',
  'strip.corpusRootNone': 'no corpus here',
  'strip.clock': '{mv:stamp}',
  'title.cwd': 'Where this session is working right now, relative to the directory it was launched in. The launch directory’s own name — matching the repo field — means it has not moved. A path starting with ./ means a command changed the working directory to somewhere below it — which also changes which corpus the hooks resolve, so check the corpus field beside this one. A path starting with … is somewhere else entirely, shown as its last two segments.',
  'title.corpusRoot': 'Which corpus this session’s working directory resolves to, relative to the directory the session was launched in. The corpus is found by walking up from the working directory and stopping at the first .my_context, so the directory decides which one it gets. A warning here means the walk stopped at a nested corpus while another one stands higher up the same tree: the smaller item count is A DIFFERENT CORPUS, not a project with little recorded in it.',
  'title.clock': 'When this bar was last drawn. The web strip repaints on its own cycle, so this is close to the current time; the terminal status line is drawn only when Claude Code sends a message, so the same field there tells you how stale that line is.',
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
  // ── THE CONTEXT OCCUPANCY, BANDED (plan:walk seq:117) ─────────────────
  // Three bands, three existing hues, and a WORD in every one of them: the
  // percentage stays a number beside the chip, so the state survives a
  // dichromat, a monochrome printer and forced-colors, exactly as the four
  // group labels do. The boundaries are DERIVED from the served
  // `handoverThresholdPercent` and are never a constant here — see
  // `lib/viewmodel.js`'s `occupancyBands` for the derivation and the two
  // auto-compaction records it was measured against.
  // ── HOW FULL THE WINDOW IS, on ABSOLUTE bands (owner ruling 2026-08-31).
  // These three answer "how much room is left"; the two gold chips below answer
  // "has the handover ask fired". Two questions, two fields, two colours — red
  // at 91% with NO gold means the window is full and the ask has not fired,
  // which one three-step ramp could never draw. The boundaries are
  // CONTEXT_FILL_WARN_PERCENT and CONTEXT_FILL_CRIT_PERCENT in
  // `lib/viewmodel.js`, declared once and restated by name anywhere else they
  // are needed.
  'strip.fillOk': 'room left',
  'strip.fillWarn': 'filling up',
  'strip.fillCrit': 'nearly full',
  // ── AND HOW CLOSE THE HANDOVER ASK IS. One GOLD marker at two weights, not
  // a second ramp: `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-
  // warn` assigns all five hues, and two ramps would need a sixth and a
  // seventh. Gold already means "this wants your attention" here, and an ask is
  // a REQUEST rather than a severity. Below the warn band it says nothing at
  // all: the reassurance state that used to sit there — `strip.ctxOk`, "well
  // below the handover ask" — was cut in the same pass that cut `strip.inSync`,
  // and for the same reason. It fired in the common case and changed nothing.
  'strip.ctxWarn': 'handover near',
  'strip.ctxCrit': '{b:handover due}',
  'strip.ctxLevelStale': 'too old to place',
  'title.fillOk': 'This window is below {fillWarn}% full. These bands are ABSOLUTE — {fillWarn} and {fillCrit} — and are not the handover threshold: this chip answers how much room is left, and the gold marker beside it answers whether the handover ask has fired. Two questions, two fields.',
  'title.fillWarn': 'This window is at or past {fillWarn}% full and below {fillCrit}%. These bands are ABSOLUTE and do not move when the handover threshold moves — a full window and a fired ask are different facts, and this chip is only about the first.',
  'title.fillCrit': 'This window is at or past {fillCrit}% full. These bands are ABSOLUTE and do not move when the handover threshold moves. With no gold marker beside it, this says the window is nearly full and the handover ask has NOT yet fired.',
  'title.ctxWarn': 'This window is at or past {warn}% and has not yet reached {threshold}%, where the handover ask fires. This is the room there is to act in — finish a thought, capture a lesson, write the handover deliberately. Claude Code compacts automatically at about 99.75%, so once the ask has gone out under two points of the window are left.',
  'title.ctxCrit': 'This window is at or past {threshold}%, the threshold the handover ask fires at. Claude Code compacts automatically at about 99.75%, so what remains past this point is under two per cent of the window.',
  'title.ctxLevelStale': 'This reading is more than fifteen minutes old, so it is shown WITHOUT a level. The status-line bridge rewrites it on every response, so a sample this old is not describing the window in front of you — and a fossil in a confident colour is worse than an uncoloured number.',
  // ── WHAT BECAME OF THE HANDOVER ASK (plan:walk seq:118) ───────────────
  // The verdict is computed by `core/handover-ask.ts` against the handover
  // file's mtime and served on `/api/watch/context`; nothing here re-derives
  // it. `ignored` is the state that matters most — the ask went out and the
  // file was not written — and it is the one a reader would never think to
  // check for, so it is drawn in the loudest hue the budget has rather than
  // as a quieter `acted on`.
  'strip.hoActed': 'handover written {age} ago',
  'strip.hoIgnored': 'handover asked for and not written',
  'strip.hoNotAsked': 'handover not yet asked',
  'strip.hoOff': 'no handover configured',
  'strip.hoUnknown': 'handover state not known',
  'title.hoActed': 'The handover ask went out at {asked} and {path} was written at {written}, after it. The comparison is the whole flag: this is not a claim that an ask was sent, it is the observation that the file moved afterwards.',
  'title.hoIgnored': 'The handover ask went out at {asked} and {path} has not been written since. The window this session is holding will be compacted or cleared with nothing carried across it. Nothing is broken and nothing will say so on its own — which is exactly why this is drawn.',
  'title.hoNotAsked': 'A handover is configured at {path} and this session has not crossed the {threshold}% threshold, so it has never been asked to update it. A measured not-yet, not an absence.',
  'title.hoOff': 'No handover is configured for this corpus, so none was ever promised and none was ever asked for. That is a different fact from a handover that was asked for and not written, and it is drawn rather than left blank.',
  'title.hoUnknown': 'An ask was recorded but the comparison could not be made — the handover could not be examined, or the recorded time will not parse. This is "not known", never an accusation: a charge nothing supports is the same defect as a guarantee nothing supports.',
  'strip.unread': 'not read',
  'strip.unmeasured': 'not measured',
  'title.unread': 'The server did not answer this call, so nothing here is a claim about the repository, the corpus or the session. Refresh asks again.',
  'title.unmeasured': 'The call answered, and could not produce this figure: no audit projection has been built for this corpus, or reading it refused. Unknown, never zero — and a zero here would be the one claim this bar must not invent.',
  'title.gitState': 'Click to cycle the six git states the spec requires',
  'strip.branch': 'branch {mv:branch} @ {mv:commit}',
  'strip.detached': 'detached HEAD @ {mv:commit}',
  'strip.differs': 'differs from origin',
  'strip.noUpstream': 'no upstream',
  'strip.unknownTip': 'the local tip could not be read',
  'strip.notARepo': 'not a git repository',
  'strip.items': 'items',
  // ── WHAT THE CORPUS IS WAITING ON, and a door to it (owner ruling
  // 2026-08-31). Both counts come out of the `/api/status` body the item count
  // above already fetches — `health` and `reviewQueue` — so neither costs a
  // request, and neither runs a doctor sweep on the heartbeat. Both are
  // BUTTONS: the owner has twice reported doctor findings discovered late, and
  // a count that is not a door is half a count.
  'strip.doc': '{mv:count} doctor notices',
  'title.doc': 'Doctor findings at error or warning level. Click to open them.',
  'strip.queue': '{mv:count} to rule on',
  'title.queue': 'Drafts in the project layer waiting to be promoted, plus revision proposals waiting for a verdict — the same two queues the rail badge counts. Drawn only when there is something in them. Opens the review queue.',
  // ── THE LABEL SAYS WHAT THE NUMBER IS, 2026-09-01. It said `injections
  // today` for four days with a permanent `not measured` chip under it. The
  // figure that exists is `/api/watch/context`'s `mycontext.injections`,
  // which `core/context-share.ts` bounds to the CURRENT CONTEXT EPOCH — what
  // survived the last compaction — and not to a calendar day. A real "today"
  // would mean 1,440 columns off `/api/watch/volume` on every page boot, past
  // that endpoint's own cap, and would still be wrong by part of a minute
  // because its window ends at `now` rather than on a midnight boundary. So
  // the word moved to meet the number: a wrong word on a correct figure is
  // still a wrong figure. It is also the bound the terminal bar's own share
  // uses, so the two surfaces cannot disagree about what they are counting.
  'strip.inj': 'injections this context',
  'title.items': 'How many items the corpus holds, counted from the files rather than from the index.',
  'title.ctxAsk': 'How far this window is from the handover ask, as a proportion of the way there. The threshold is CONFIGURABLE and currently {threshold}; the bar and the percentage are the window measured against it, and the +figure is the remaining distance in percentage POINTS of the window, not tokens. Banded at 60, 70 and 80 percent of the way to the ask. Past the ask this field stops showing a number and says handover due instead — the distance is spent and the action is the point.',
  'title.rateWindow': 'How much of this rate-limit window the account has used, with the time until it resets. NO COUNTS: the status-line payload serves a percentage for these windows and no denominator at all — no token count, no message count — so a pair here would be a maximum nobody reported. Banded on the same absolute scale as every other used-of-maximum field: amber at 60, orange at 70, red at 80. A quota’s own fullness has nothing to do with when a handover is due, which is why these do not move with the handover threshold.',
  'title.myctxBar': 'How much of THIS window my_context put there, against the window itself — the same denominator the context figure uses. Counted from the injection records’ own frozen estimates, bounded to the CURRENT compaction epoch and to operations that reach this model, so subagent-start injections delivered into other windows are excluded. Without those two bounds the figure would span a fortnight and several models. Banded at 60, 70 and 80 percent of the window.',
  'title.inj': 'How many times project knowledge was added to this session since the last compaction — not a running total for the day.',
  'title.corpus': 'Click to cycle the item count and the state where it could not be read',
  'title.audit': 'Click to cycle the injections figure between measured, not measured and not read',
  'title.ctx': 'Click to cycle the context states, the three project-knowledge answers and the unread state',
  'strip.ctx.known': '{pct}% ({used} / {size}) — as of last response, {age} ago',
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
  'strip.ctx.noBridge': 'showing only what mycontext injected — that is all this number is. The status line bridge is not installed; {m:mycontext statusline install} shows what installing would change, then asks.',
  'strip.ctx.cold': 'cold session — a hypothetical has no live context number',
  'strip.myctx': '≈{pct}% of it from project knowledge — {tokens} tokens, {injections} injections',
  'strip.myctxPartial': '≥{pct}% of it from project knowledge — {tokens} tokens, {injections} injections, {unrecorded} not recorded',
  'strip.myctxUnavailable': 'project-knowledge share unavailable: {error}',
  // ── THE ACCOUNT'S TWO RATE-LIMIT WINDOWS (owner ruling 2026-08-31). Read
  // off `rate_limits.five_hour` / `.seven_day` in the status-line payload this
  // strip already tees to disk — no new source and no new call. The countdown
  // is half the field: a percentage with no reset time is alarming rather than
  // actionable, and `resets_at` is unix SECONDS.
  'strip.rl5': '{mv:pct}% · {reset}',
  'strip.rl7': '{mv:pct}% · {reset}',
  // Banded by `occupancyBands`/`occupancyLevel` — the SAME function the
  // handover proximity uses, never a second threshold set. Silent below the
  // warn band, for the reason the gold marker is silent there.
  'strip.rlNear': '{mv:win} limit near',
  'strip.rlAt': '{mv:win} limit hit',
  'title.rate': 'The usage windows on your account, not on this session. Shown only when one is close enough to matter.',
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
  'ex.stale': 'Not connected. Refresh the page — if it stays this way, this browser has no credential, and the printed link is the way back.',
  // Code skew. NO value slots, deliberately: `app.js` calls translate() on this
  // key with no substitutions, and t() throws on one it cannot fill.
  'ex.codeSkew': '{b:This page is newer than the server answering it.} Files under {m:src/ui/public/} reload every request, but server modules load at startup and stay fixed until restart. Restart it to catch up.',
  'ex.ok': 'OK',
  // The one refusal frame every screen shares — `errorNote` in
  // `screens/parts.js`. The message inside it is the server's, the
  // platform's or the command's, verbatim and in whatever language it was
  // written in; what was missing until 2026-08-30 was any word at all around
  // it, so every refusal on every screen was unworded English at the exact
  // moment something had gone wrong.
  'err.note': 'Refused. The wording is the system’s own and is not translated: {error}',
};
