/**
 * **Every KIND of element the mockup draws on a screen must exist on that
 * screen in the app — and the gaps are a ledger that may only shrink.**
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * On 2026-08-22 the Audit stream screen landed, rendered, passed every gate,
 * and was wrong the moment the owner looked at it. Measured element by element
 * against the mockup it was missing 109 `<rect>` elements — the entire graphic
 * of the screen — plus the token bar, the regime-change row and five status
 * chips. Nothing in the suite could fail for that, because nothing compared the
 * app to the design of record.
 *
 * Screenshots did not catch it either. Four were taken that day and read
 * approvingly. A tally does not read approvingly.
 *
 * ── WHAT IS COMPARED, AND WHY IT IS KINDS AND NOT COUNTS ───────────────────
 *
 * A "kind" is `tag.class1.class2` with the classes sorted — `svg`, `rect`,
 * `div.ladder.plate`, `span.chip.ok`. For each screen this collects the set of
 * kinds the mockup's `[data-p="<name>"]` section renders, and the set the app's
 * section renders, and reports what the mockup has that the app does not.
 *
 * **Counts are deliberately NOT compared.** The mockup carries four sample rows
 * where the app renders 275 real items; on the Audit stream the app draws 382
 * elements to the mockup's 218 and is right to. Equality of counts would fail
 * on correctness. What must hold is that no KIND is absent: a screen missing
 * every `<rect>` is missing its graphic, however many rows it drew.
 *
 * Hidden elements are excluded on both sides. The mockup keeps every state
 * variant in markup and shows one — six git states, five context states — so
 * counting hidden nodes would demand the app render states that are not true.
 *
 * ── THE LEDGER, AND WHY IT FAILS IN BOTH DIRECTIONS ────────────────────────
 *
 * `KNOWN_GAPS` records what is missing today, per screen, measured. A screen
 * whose gaps match its entry passes. Two things fail:
 *
 *   - **A gap not in the ledger** — a regression, or a screen that was built
 *     without reading the mockup. This is the case this file exists for.
 *   - **A ledger entry that is no longer missing** — the gap was closed and
 *     nobody updated the ledger. Failing here is what stops the list rotting
 *     into a permanent excuse: closing a gap forces the entry out, so the
 *     ledger can only ever shrink.
 *
 * That is the same mechanism `test.fail()` gave the empty-band assertion, which
 * did exactly this and forced its own removal when `renderChrome()` landed.
 *
 * **This ledger is not a target to be tuned green.** Every entry is a task in
 * mycontext under `plan:screens`. Deleting an entry to make the suite pass,
 * without building the thing, is the one edit that makes this file worse than
 * nothing.
 */
import { test, expect } from './app.ts';

/** `tag.class1.class2`, classes sorted, for one visible element. */
const COLLECT_KINDS = (selector: string): string[] | null => {
  const root = document.querySelector<HTMLElement>(selector);
  if (root === null) return null;
  const kinds = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    // `offsetParent === null` catches display:none and every ancestor's
    // [hidden]; the position check keeps a legitimately fixed element in.
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    // `getAttribute('class')`, NOT `el.className`. On an SVG element
    // `className` is an SVGAnimatedString, so `typeof … === 'string'` is false
    // and every `<rect>`, `<path>`, `<circle>` and `<text>` was recorded as a
    // BARE TAG with no classes — measured 2026-08-23, after four agents each
    // reported an SVG screen and the eighteen `svg.chart` rules turned out never
    // to have been carried into styles.css at all.
    //
    // Two things were wrong while that held. This gate could not tell
    // `<path class="edge dangling">` from `<path>`, so a screen could draw every
    // edge unclassed and pass. And a CSS carry derived from this ledger — which
    // is how the wave-2 carry was measured — was structurally blind to every SVG
    // rule, which is exactly what happened, twice.
    const raw = (el.getAttribute('class') ?? '').trim();
    const cls = raw === '' ? '' : `.${raw.split(/\s+/).sort().join('.')}`;
    kinds.add(`${el.tagName.toLowerCase()}${cls}`);
  }
  return [...kinds].sort();
};

/**
 * Screens the app has a module for. Not derived from the rail: the rail lists
 * all 21 by design, and the eleven with no module are a different fact from a
 * screen that exists and is incomplete.
 */
const BUILT = [
  'preview', 'coverage', 'gaps', 'simulate', 'injected',
  'watch', 'doctor', 'decay', 'graph', 'status', 'learn',
  // Landed 2026-08-23: the six screens whose endpoints already existed, built
  // in one parallel wave. Seventeen of twenty-one now. The four still absent —
  // capture, proc, port, packs — had no endpoint at all until that same wave
  // built their read models, and are the next wave's work.
  'ask', 'work', 'palette', 'config', 'docs', 'tut',
  // The last four, later the same day. TWENTY-ONE OF TWENTY-ONE — this walk is
  // now the whole rail, and `plan:port seq:98`, the screen-by-screen review
  // with the owner, is no longer waiting on a screen that does not exist.
  'capture', 'proc', 'port', 'packs',
] as const;

/**
 * Measured on 2026-08-22 at 1568x779 against this repository's own corpus.
 *
 * Read the shape of it: almost every entry is a GRAPHIC. `svg`, `rect`,
 * `circle`, `line`, `path`, `text`, and the structures that carry them —
 * `div.ribbon`, `div.ladder.plate`, `div.heat.plate`, `div.segbar`,
 * `div.track`. The screens draw their data and omit their pictures. That is one
 * defect repeated eleven times, not eleven defects.
 *
 * `injected` is empty because that screen is complete. It is the proof the
 * comparison can reach zero.
 */
/**
 * **Screens whose gap set moves with the DATA, not with the code.**
 *
 * For these the ledger is a CEILING, not an exact match: a gap must still be
 * listed, but an entry that is temporarily closed does not fail. Everywhere
 * else the ledger stays exact and can only shrink.
 *
 * `watch` is here because it draws what the audit log happens to contain.
 * `div.tokbar`, `div.tokvoid`, `div.nt` and `span.chip.ok` need an INJECTION
 * record in the recent window; `div.rw`, `span.ln` and `tr.regime` need a FOCUS
 * record; `rect` needs any record at all inside the pulse's twenty-minute
 * window. `screens/watch.js` builds all of them — photographed doing so in
 * `reports/2026-08-22-ui3-11-watch/watch-live-1568x779.png` — and this
 * repository's own newest fifty records happen to be mutations, so most are
 * absent here on most runs.
 *
 * That is not a hypothetical. The ledger was measured at 15 gaps, shrank to 8
 * an hour later as the corpus changed, and `rect` came back on the very next
 * run because the pulse window emptied. An exact ledger over live data is a
 * test that fails for a reason that is not a regression, which this project has
 * already learned is the most expensive kind of red.
 *
 * **The real fix is a fixture corpus** holding one record of every kind, so the
 * comparison measures the code instead of the day. `e2e/app.ts` already takes
 * `MYCONTEXT_E2E_CORPUS`, so the hook exists. Tracked as its own task; until
 * then this exemption is the honest way to keep the gate useful for the other
 * ten screens rather than switching it off.
 */
// `ask` joined on 2026-08-23, for the same reason and a sharper one. Its Audit
// tab reads the AUDIT PROJECTION, and a projection goes stale the moment the
// log outgrows it — which the read surface causes ITSELF: a refusal is the one
// write this server makes, so every 401 an unauthenticated tab collects appends
// an `access` record and pushes the log ahead. Measured within one session on
// 2026-08-23: the gate passed, a test that deliberately provokes 401s ran, and
// the next run reported sixteen absent kinds on `ask` alone. All sixteen are the
// REFUSAL state of a screen whose code draws them perfectly well when the
// projection is fresh; the agent that built it measured all four projection
// states and the entry below is their union. Tracked as
// TASK-on-a-working-corpus-the-audit-projection-is-stale-within and
// TASK-the-401-is-the-read-surface-s-one-write-and-it-makes-the-next.
const DATA_DEPENDENT = new Set<string>([
  'watch', 'ask', 'decay', 'simulate', 'coverage', 'graph', 'proc', 'capture',
]);

const KNOWN_GAPS: Record<string, string[]> = {
  // **26 on 2026-08-22, the largest of any screen; 2 on 2026-08-23.** The tier
  // ribbon, its ghost lane, the gate ladder, the carried item blocks and the
  // bulleted item body all landed in `screens/preview.js` (ui3 Task 1s), and
  // this gate demanded the ledger follow. Twenty-four names came out.
  //
  // **`div.gh` is DATA, not code, and is the one entry here that could go
  // stale for a reason that is not a regression.** `drawRibbons()` builds a
  // `.gh` for every entry in `Selection.spilled` at its `costs` width —
  // photographed doing so, twice, in
  // `reports/2026-08-23-ui3-1s-preview/app-spills-ribbon.png` (two ghosts on
  // the pinned track) and `app-tool-ribbon.png` (three on jit). It is absent
  // here only because THIS corpus, at ITS configured budgets, spills nothing
  // on a session-start: 3,581 of 16,000 pinned tokens used, 0 out. Lower
  // `budgets.pinned` and it draws; that is exactly how those photographs were
  // taken, and the config was restored byte-identical afterwards.
  //
  // So the correct edit the day this closes is to DELETE this name — not to
  // add `preview` to `DATA_DEPENDENT`, which would switch off the stale check
  // for the twenty-four entries that just came out of it. The real fix is the
  // fixture corpus the `watch` note above already tracks: one corpus holding a
  // spill, a focus and a seen item makes both this entry and seven of watch's
  // measurable against the CODE instead of against the day.
  //
  // **`i` is the one real gap, and it is not this screen's to close.** The
  // mockup italicises one run inside a translated string — `everything below
  // is <i>not reached</i> rather than passed`, in `preview.whyn` — and
  // `lib/i18n.js`'s run grammar has three markers (`{m:}`, `{mv:}`, `{name}`)
  // and no emphasis marker, so no string table can carry one. Identical in
  // kind to watch's `b`, and tracked with it under
  // TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup.
  // `span.prop` is an ACCEPTED DIVERGENCE, not a gap. Owner ruling 2026-08-23:
  // "leave the mockup intact, do it only in the real, i need it to stay on the
  // mockup for history, when comparing to mockup the proposed word is a known
  // diff and it is ok." The mockup badges the carried-item block PROPOSED; the
  // block is now built, and the app's own tested rule is that a built feature
  // drops the badge. The two files differ on purpose — the mockup keeps the
  // historical record of what was proposed when it was drawn, the app reports
  // what exists. Listed here so the gate still fails for any OTHER missing kind
  // and nobody later reads this as a screen that forgot something.
  //
  // `div.gh` is DATA, not code — built and photographed in
  // reports/2026-08-23-ui3-1s-preview/, absent only because this corpus does
  // not spill at its real budgets. `i` is the string grammar's missing emphasis
  // marker, the same defect as the bold run on the audit stream.
  // `span.chip` is a SECOND accepted divergence, and a legibility fix rather
  // than an omission. `TIERCHIP.index` is the only tier the mockup gives no
  // modifier class, so its chip takes bare `.chip` — which sets `color:#0b0c11`
  // and no background, i.e. near-black text on a near-black panel, invisible in
  // the mockup and in the app alike. Owner ruling 2026-08-23: fix it in the app
  // only, leaving the mockup as drawn. The app renders `chip index`, so the
  // bare `span.chip` kind legitimately disappears from this screen. A label
  // nobody can read is a label that is not there.
  // ── RE-BASED 2026-08-23: the reference corpus changed ───────────────────
  //
  // Every entry from here down was re-measured on that date, because `e2e/app.ts`
  // stopped serving the project's LIVE corpus and started serving `.demo-corpus`,
  // the deterministic simulated one. Read that file's `CORPUS` for the argument;
  // the short version is that a gate whose entire output is a list of what is
  // missing cannot have a reference that changes every time somebody files a
  // task. Numbers before and after this line are NOT comparable, and the growth
  // below is a change of instrument rather than a regression.
  //
  // **What that means for the entries these five gained.** Each was measured, so
  // each is true of the app over this corpus today. What has NOT been done is
  // the work of separating, per kind, "the code cannot draw this" from "this
  // corpus gives it nothing to draw" — the distinction that cost this project a
  // day and produced `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the`.
  // That separation is exactly what `plan:port seq:98`, the screen-by-screen
  // review with the owner, exists to do. Recorded honestly rather than sorted
  // by guess: an entry here is a claim that the app does not draw the kind, and
  // nothing more.
  // **Two entries came out on 2026-08-25, and neither was closed by code.**
  //
  // `div.gh` — the ghost lane — and `div.carrieditem.small` — the carried item
  // block — were both listed here for over a week and both were BUILT the whole
  // time. What was missing was a fixture that made them draw:
  //
  //   `div.gh` needs a SPILL. The demo budgets were 2,400 pinned tokens against
  //   six items of filler prose, and length was doing the spilling; when the
  //   filler was replaced with the real short bodies the mockup shows, nothing
  //   overran and the lane would have emptied. The budgets went to a tenth, so
  //   the spill is now a property of the BUDGET rather than of how much text
  //   somebody pasted — which is what a budget is.
  //
  //   `div.carrieditem.small` needs a session-start with a resolved root.
  //   `read-model.ts` resolves `IndexSummary.carried` for that event alone, and
  //   the fixture's re-clocking had left an unnumbered tool-event session as the
  //   newest record, so the preview computed against a session that carried
  //   nothing. It now stripes sessions across twelve weeks and keeps the newest
  //   NUMBERED session newest.
  //
  // Both are the same lesson twice: an absent element here is a claim about the
  // CODE, and this ledger cannot tell the difference between code that is
  // missing and code the fixture never asked to run. That is `plan:port seq:94`.
  // `li` and `ul` left on 2026-08-26 and NOT because the app started drawing
  // them: the mockup stopped. They lived in the `.blkbody` of the two-plane
  // linked view, and that plane was removed from the design of record when
  // Delivered and Why-not went back side by side in `.two`. Both sides now
  // draw zero, so there is no gap to record — which is the ledger working in
  // the direction nobody expects it to.
  preview: ['i', 'span.chip', 'span.prop'],
  coverage: [
    'button', 'button.linkid.m', 'div.mini', 'i', 'i.g', 'i.u', 'i.x',
    'span.covn', 'span.nm', 'table', 'tbody', 'td', 'th', 'thead', 'tr',
  ],
  gaps: ['button.icon', 'span.m', 'span.v', 'td', 'td.m', 'td.small'],
  // The spill-ratio card landed, closing seven. The staircase, the ladder and
  // the readout did not, and the file says why at length: both graphics need a
  // SWEEP no endpoint answers, and the readout's words are unkeyed literals in
  // the mockup's own script. Held open by plan:ui1 seq:17c.
  simulate: [
    'b', 'circle', 'div', 'div.at', 'div.card.pane.sim', 'div.ev',
    'div.ladder.plate', 'div.readout', 'div.small', 'line', 'path',
    'span.chip.warn', 'span.v', 'svg', 'text',
    // Reported for the first time on 2026-08-23, when COLLECT_KINDS stopped
    // reading `el.className` on SVG elements. These were always missing; the
    // gate simply could not name them.
    'line.axis', 'line.defline', 'line.nowline', 'path.step', 'svg.chart', 'text.mono',
    // The spill-ratio bars, which the code DOES draw — measured and
    // photographed against a synced corpus. They read /api/watch/ratio, which
    // 503s the moment the audit projection falls behind, and the suite stales
    // it itself: a refusal is the read surface's one write, so the 401s these
    // very tests provoke push the log past the projection. Listed as a
    // CEILING, which is what DATA_DEPENDENT means — present alone, absent
    // under six workers, and neither is a regression.
    'div.div-l', 'div.div-r', 'div.div-row', 'i', 'span.div-n', 'span.div-name',
  ],
  // **`button` is DATA, and it is the seventh instance of a class worth naming.**
  // `boundedList` draws the bound line's "Show all N" control on every one of
  // the five bounded surfaces, this table included — and hides it, correctly,
  // when nothing was truncated. `BOUND_CAP_TABLE` is 50; the demo corpus's
  // longest seen file holds 8 lines, so the cap cannot bite here and the button
  // is `hidden`, which `COLLECT_KINDS` skips by construction (`offsetParent`).
  //
  // The code is built and the fixture never asks it to run. That is the same
  // reading error `div.gh` and `div.carrieditem.small` cost this project twice
  // before — a FIXTURE gap read as a CODE gap — and `plan:port seq:94` (the
  // fixture mirrors the mockup scene) is the task that closes the whole class.
  // Lowering the cap until the gate went green would have been tuning the
  // ledger, which the header above names as the one edit that makes this file
  // worse than nothing.
  injected: ['button', 'button.linkid.m', 'span.chip.gov', 'span.chip.ok', 'td', 'td.m.small'],
  // Shrank from 15 to 8 while this gate was being written: the agent building
  // screens/watch.js landed the SVG (rect, svg), the bidi runs and the table,
  // and the gate demanded the ledger follow. Exactly the mechanism.
  //
  // **SEVEN OF THESE EIGHT ARE DATA, NOT CODE, and this entry will fail in the
  // stale-entry direction the day that changes.** `screens/watch.js` builds
  // `div.nt`, `div.tokbar`, `div.tokvoid` and `span.chip.ok` for every
  // INJECTION row and `div.rw`, `span.ln` and `tr.regime` for every FOCUS
  // record; all seven are absent here only because this corpus's newest fifty
  // audit records happen to be mutations. Photographed rendering, all seven, in
  // `reports/2026-08-22-ui3-11-watch/watch-live-1568x779.png` — the same build
  // over a corpus that has injections and a focus change in its recent history.
  // When one lands in this corpus's newest fifty, this entry shrinks, and the
  // correct edit is to remove the closed names — not to widen the screen's
  // backlog window until the gate agrees with the ledger.
  //
  // `b` is the one real gap: the mockup bolds three runs inside translated
  // strings (`Activity pulse`, `regime change`, `hatched void`) and
  // `lib/i18n.js`'s run grammar has no emphasis marker, so no string table can
  // carry one. Tracked as
  // TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup.
  //
  // The same entry is also hostage to the audit PROJECTION: it went stale
  // twice in forty minutes of ordinary work on 2026-08-22, and a stale
  // projection empties this screen entirely — `rect`, `svg`, `td`, `bdi` and
  // both chips vanish and the gate fails in the other direction, for a reason
  // that is not a regression. Tracked as
  // TASK-on-a-working-corpus-the-audit-projection-is-stale-within.
  watch: [
    // The union of every kind observed absent across runs — a ceiling, not a
    // measurement of one moment. See DATA_DEPENDENT above.
    'b', 'bdi', 'div.nt', 'div.rw', 'div.tokbar', 'div.tokvoid', 'rect',
    'span.chip.crit', 'span.chip.ok', 'span.chip.warn', 'span.ln', 'svg', 'td',
    'td.m.small', 'tr.regime',
    // `svg.chart` appeared for the first time on 2026-08-23, when the collector
    // stopped reading `el.className` on SVG elements. The pulse's own <svg> is
    // the same element already listed here as a bare `svg`; the class is what
    // the gate could not previously see.
    'svg.chart',
  ],
  // `button`, `code` and `div.cmd` came out on 2026-08-23 — not because the
  // screen changed, but because the FIXTURE did. This corpus had only
  // `dead_scope` findings, and `dead_scope` composes no command by design, so
  // the remedy block had nothing to draw. One staged `source_drift` closed all
  // three. The agent refused to close them by composing something for
  // `dead_scope`, because the mockup composes nothing for it either.
  doctor: ['b', 'span.m.v', 'span.prop'],
  // 23 -> 15 on 2026-08-23: the recency comb and the 90-day heatstrip both
  // landed. What remains is almost entirely DATA — the heatstrip reads the
  // audit projection, which the read surface itself stales, so this screen
  // has the same disease as `watch` and `ask` and joins them below.
  decay: [
    'b', 'circle', 'div', 'div.heataxis', 'div.hname', 'div.hstrip', 'i',
    'i.h1', 'i.h2', 'i.h3', 'i.sp', 'line', 'rect', 'svg', 'text',
  ],
  // `path` was the whole ego graph before the edges landed. What remains is the
  // classed forms the old collector could not see, and every one of them needs
  // a focus WITH RELATIONS — this corpus creates none, so the screen draws its
  // nodes and has no edge to draw. DATA, not code: the agent rendered all of
  // them against a connected body and photographed the result.
  graph: [
    'b', 'path', 'path.bearing.edge', 'path.dangling.edge', 'path.edge.ref',
    'rect.missing.node', 'rect.more.node', 'rect.node', 'rect.node.superseded',
    'text.rel',
  ],

  // ── The six screens built in parallel on 2026-08-23 ─────────────────────
  //
  // Every entry below was measured by the agent that built the screen, against
  // the mockup section and its own render, and then RE-MEASURED here by a real
  // run of this gate before it was committed. Where the two disagreed, the run
  // won and the agent's number was corrected — a gap list derived from reading
  // code is a prediction, and this file only records measurements.
  //
  // `b` recurs in five of the six for one reason: `lib/i18n.js`'s run grammar
  // has `{m:}`, `{mv:}` and `{name}` and NO emphasis marker, so a mockup string
  // whose English bolds a run renders flat in the app and no string table can
  // carry the difference. That is now its ninth site across the ledger. Tracked
  // as TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup, whose
  // title undercounts by six.
  // `span.prop` is the PROPOSED badge, an ACCEPTED DIVERGENCE by the owner's
  // ruling of 2026-08-23 and not a gap: the mockup keeps it for history, the app
  // drops it because the screen is built. Same entry, same reason, as `preview`
  // and `doctor` carry above.
  ask: [
    // The union across the four projection states the building agent measured:
    // fresh-with-records (`b` alone), fresh-but-empty, `absent`, and `behind`.
    // A ceiling, not a moment — see DATA_DEPENDENT above.
    'b', 'caption', 'div.card', 'div.plate', 'h3', 'p.small', 'pre.m',
    'span.chip.ok', 'span.chip.warn', 'span.m', 'span.prop', 'span.v',
    'table', 'tbody', 'td', 'td.m.small', 'th', 'thead', 'tr',
  ],
  // `div.hit` is DATA: the glob tester lights a row per matching file, and this
  // corpus answers the opening pattern with none. `span.chip.crit` is
  // INTERACTION: it appears the moment an argv value carries a shell
  // substitution, which no default value does. Neither is missing code.
  // `div.hit` came out the same way: the glob tester lights a row per matching
  // file, and this corpus had no repository files at all until fifteen were
  // added to the fixture. Code that was correct all along.
  palette: ['span.chip.crit'],
  config: [
    'div.blast', 'div.delta', 'div.delta.gain', 'div.delta.loss',
    'span.arrow', 'span.was', 'span.will',
  ],
  docs: ['a', 'h4', 'pre', 'span.refusal'],
  // ── The last four screens, landed 2026-08-23 ──────────────────────────
  // The table needs a scope the reader has TYPED — there is no route parameter
  // and no endpoint that supplies one, which is this screen's loudest open
  // question. Nothing renders below the controls until someone types.
  capture: [
    'b', 'p.cmdnote', 'span.m.v', 'table', 'tbody', 'td.m', 'td.small', 'tr',
  ],
  // This corpus holds no `procedure` item at all, so the whole live half — one
  // card per procedure, its progress bar and its composed `procedure done` —
  // has nothing to draw. The static states table renders unconditionally.
  proc: [
    'b', 'button', 'code', 'div.bar', 'i', 'i.f', 'span', 'span.m.v',
    'span.prop', 'span.v', 'span.verdict', 'div.cmd',
  ],
  packs: ['span.prop', 'span.verdict'],
};

/**
 * **Two kinds the APP draws that the mockup does not, on `ask`.** Recorded
 * here because this gate does not check that direction, so nothing else would
 * ever say them out loud.
 *
 * `button.linkid.m` — the mockup writes the item cell as a bare `span.m`.
 * Every screen this project has shipped writes an id as `linkId()`, the
 * `button.linkid` whose click the shell will route to the item detail pane.
 * The agent chose consistency with the app over consistency with the mockup;
 * the alternative would be one screen whose ids are the only dead ones.
 *
 * `span.chip.index` — the neutral chip for `subject`, the third of the audit
 * projection's three roles. The mockup hues only `injected` and `spilled` and
 * gives the third no treatment at all.
 *
 * Both await the owner's confirmation, alongside the two divergences already
 * registered above (`span.prop`, `span.chip`).
 */
const APP_ONLY_KINDS_ON_ASK = ['button.linkid.m', 'span.chip.index'] as const;
void APP_ONLY_KINDS_ON_ASK;

test('every screen draws every KIND of element its mockup section draws', async ({ app }) => {
  // **This one test walks SEVENTEEN screens twice** (eleven until 2026-08-23),
  // waits 300ms for each mockup
  // section to settle and up to 25 x 400ms for each app screen to stop growing.
  // Alone it takes 16s; inside the full suite, with six workers each running
  // their own server over the same corpus, it took 22.5s in `chrome` and
  // **timed out at 30s in `chromium` on the same run** — a wall-clock failure
  // with no assertion behind it, which is the worst kind of red because it
  // reads exactly like a regression. The budget is raised rather than the
  // settle loop shortened: shortening it is how this file's own header records
  // sampling a half-drawn screen and writing a ledger full of gaps that were
  // not there.
  test.setTimeout(180_000);
  const { page } = app;

  // The mockup is opened in a second page of the same context rather than a
  // second fixture: one browser, one run, and the two renders are guaranteed
  // to be at the same viewport and colour scheme.
  const mockupPage = await page.context().newPage();
  const { MOCKUP_URL } = await import('./mockup.ts');
  await mockupPage.goto(MOCKUP_URL);
  await mockupPage.waitForLoadState('domcontentloaded');

  const report: string[] = [];
  const stale: string[] = [];

  try {
    for (const screen of BUILT) {
      await mockupPage.evaluate((name) => {
        for (const section of document.querySelectorAll<HTMLElement>('[data-p]')) {
          section.hidden = section.dataset.p !== name;
        }
      }, screen);
      // The mockup's own transitions run on `hidden`; sample after they settle.
      await mockupPage.waitForTimeout(300);
      const mockKinds = await mockupPage.evaluate(COLLECT_KINDS, `[data-p="${screen}"]`);
      expect(mockKinds, `the mockup has no [data-p="${screen}"] section — the screen list ` +
        'and the design of record disagree').not.toBeNull();

      await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
      // **Wait for the render to SETTLE, not merely to start.**
      //
      // A screen draws its heading synchronously and its data after one or more
      // fetches resolve, so "has any element" is true almost immediately and is
      // the wrong signal — sampling on it reported `div.scene` and `div.pair`
      // missing from the preview screen, which are plainly there. That would
      // have written a ledger full of gaps that do not exist, which is worse
      // than no ledger at all.
      //
      // Two consecutive equal counts, sampled 400ms apart, is the signal: a
      // screen still fetching changes between samples. Capped so a genuinely
      // empty screen fails on the assertion below rather than hanging here.
      let previous = -1;
      for (let attempt = 0; attempt < 25; attempt++) {
        const now = await page.evaluate(
          (s) => document.querySelectorAll(`[data-p="${s}"] *`).length, screen);
        if (now > 0 && now === previous) break;
        previous = now;
        await page.waitForTimeout(400);
      }
      expect(previous, `${screen}: never rendered anything`).toBeGreaterThan(0);
      const appKinds = (await page.evaluate(COLLECT_KINDS, `[data-p="${screen}"]`)) ?? [];

      const missing = mockKinds!.filter((k) => !appKinds.includes(k));
      const known = KNOWN_GAPS[screen] ?? [];
      const unexpected = missing.filter((k) => !known.includes(k));
      // A data-dependent screen's ledger is a ceiling: an entry that is closed
      // today may be open tomorrow because the corpus moved, not because the
      // code did, so 'no longer missing' is not a finding there.
      const closed = DATA_DEPENDENT.has(screen)
        ? [] : known.filter((k) => !missing.includes(k));

      if (unexpected.length > 0) {
        report.push(`${screen}: the mockup draws these and the app does not, and they are ` +
          `NOT in the ledger — ${JSON.stringify(unexpected)}`);
      }
      if (closed.length > 0) {
        stale.push(`${screen}: these are in KNOWN_GAPS but are no longer missing — delete them ` +
          `from the ledger and close the matching task — ${JSON.stringify(closed)}`);
      }
    }
  } finally {
    await mockupPage.close();
  }

  expect(report, 'a screen is missing something the design of record draws. Read the mockup ' +
    'section and build it, or add a task and record it in KNOWN_GAPS — never delete a ledger ' +
    'entry to go green').toEqual([]);
  expect(stale, 'the ledger claims a gap that is closed. This failure is the ledger working: ' +
    'it can only shrink, and closing a gap must remove its entry').toEqual([]);
});
