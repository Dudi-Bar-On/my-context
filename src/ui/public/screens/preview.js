/**
 * `nav.inj` — **Injection preview**, `<section data-p="preview">` in the design
 * of record. The landing screen, and the one the whole visual direction is
 * judged on.
 *
 * **Built from the mockup's markup, not from the plan's Step 3 sketch.** That
 * sketch draws a `<ul>` of items and a `<pre>` of rendered text and names nine
 * string keys — `preview.pickFile`, `preview.nothing`, `preview.spilled`,
 * `preview.renderedText`, `common.loading` among them — that **no string table
 * declares**, because the tables are transcribed key-for-key from the design of
 * record and it declares none of them. `t()` THROWS on a key it cannot find, so
 * that sketch cannot render a single line; and its shape is superseded anyway
 * by the repaint, whose own words for this screen are the composition below.
 * Every key named here is one the mockup declares.
 *
 * **The composition** (repaint Task 6, spec §3 primitives 2 and 3): a left
 * `.plane` holding a `.pane` of `.row`s, a right `.plane` holding a `.lit` of
 * `.blk`s, both inside the `.pair` that carries the perspective, and the rail
 * outside both. Selecting a row holds it up (`aria-pressed`) and lights its
 * paired block; every other block drops to `.58` — which is a STYLESHEET fact
 * (`.lit.linked .blk{opacity:.58}` / `.lit.linked .blk.sel{opacity:1}`), so
 * this file toggles the `.sel` class and never a number.
 * `e2e/injection-preview.spec.ts` pins the value against the mockup.
 *
 * **The two graphics, and where each figure on them comes from.** Both were
 * withheld by the previous pass on the reading *"where a view cannot be drawn,
 * stop and ask"*. The owner answered on 2026-08-22
 * (`DEC-every-screen-the-mockup-shows-is-approved-for-implementation`): every
 * screen, graphic and static datum in the mockup is approved work — where an
 * endpoint answers, read it; where none does, render the mockup's own content
 * rather than leaving it out. So both are built, and every figure on them is
 * named here as LIVE or as the design's own literal.
 *
 *   - **The gate ladder** (`#gatepick` + `#gates`, between `preview.why` and
 *     `preview.whyn`) is LIVE, and the field the old note said did not exist
 *     now does. `injection()` writes a `GateCode` beside its sentence off the
 *     same branch — never a second reading of the item
 *     (`cli/commands/injection.ts` · `The first gate this item fails, in` · ~22) —
 *     and `/api/items` serves it on every item. The other three rungs come
 *     from where each is decided, exactly as that field's own note directs:
 *     *"A full ladder is composed from those four sources — and from none of
 *     their sentences."* Rung 3 is `Selection.focus.hidden`, rung 6 is
 *     `Selection.spilled`, and **rung 5, `seen`, is the fourth — since
 *     2026-08-29, and it was the last hole in this ladder.** This block used to
 *     read *"the one that cannot be composed here: the seen set is resolved
 *     server-side from the session and appears in no response, so no item can
 *     be shown failing at it"*. That was true and it was a defect, not a
 *     limitation: an item removed at rung 5 appeared in NO field of any
 *     response, so a reader saw *Delivered 1 · Not delivered 0* with the rest
 *     of the corpus accounted for nowhere. `/api/simulate` now serves
 *     `seenFiltered` — the ids `select`'s own `injectable ∩ seen` removed,
 *     computed against the same context the selection was — the rung binds, and
 *     the `Not delivered` card names every one of them.
 *
 *     **The picker holds ONE EXEMPLAR PER RUNG, and since 2026-08-28 it says
 *     so** (`preview.spec`). `/api/items` is sorted by id, so "the first item
 *     that fails this rung" is stable by construction — and stable against
 *     precisely the changes a reader is trying to observe. The specimen is
 *     kept and disclosed rather than replaced by a picker over every failing
 *     item, which would be `preview.whyn`'s own objection one axis along; the
 *     rung a reader is usually chasing is rung 6, and every item that failed
 *     THAT is now named in the `Not delivered` card below.
 *
 *     **And since 2026-08-29 every rung carries HOW MANY items fail at it.**
 *     The owner reported *"the why not in injection preview shows only 3 items,
 *     spill had much more"*, and the reading was right: over 673 items the
 *     picker offered three names for 564 failures — 13 at rung 1, 551 at rung
 *     2, 1 at rung 6 — and the card said *of how many* nowhere. A specimen
 *     standing silently for 551 reads as the whole set, which is
 *     `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` in a new
 *     place. The tally is `rungOf`'s own partition COUNTED rather than a second
 *     derivation of it, the three rungs this screen names nowhere else list
 *     their population under the ladder, and rung 4 names its unknown instead
 *     of drawing a zero. `RUNG_OPENABLE` carries the whole argument.
 *   - **The spilled-items list** (`#spilledRows`, `preview.spill` /
 *     `preview.spilln`) is LIVE and whole: one row per `Selection.spilled`
 *     entry, in that array's own order, with its tier, its band where the tier
 *     banded, and its `sim.costs` price. It is the second half of
 *     `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands`, which
 *     changed which items arrive on a tool event and asked for the
 *     displacement to be observable rather than mysterious.
 *   - **The five-tier budget ribbon with its ghost lane** (`#ribbons`, between
 *     `preview.ribbon` and `preview.ribbonn`) is LIVE for its budgets, its
 *     tier dispatch, its admitted segments and its spilled ghosts —
 *     `/api/simulate` serves `budgets`, `tiersRun` and `costs`, and
 *     `/api/select` serves `full` and `spilled`. **Two figures on it are not
 *     served, and both are drawn the way the design of record itself draws
 *     them rather than guessed:**
 *
 *       1. **Per-line index costs.** The index tier admits LINES, and their
 *          costs are exposed by no endpoint
 *          (`ui/read-model.ts` · `per-line index costs are exposed by no endpoint in this plan` · ~397).
 *          The tier's own total spend IS recoverable — `Selection.tokens` is
 *          the full-text costs plus the per-line estimates, so the difference
 *          against `costs` is arithmetic on two served numbers and not a
 *          second derivation of a decision — so the track carries ONE segment
 *          for the whole admitted run. That is the mockup's own shape for this
 *          tier and not a reduction of it: its `CANDIDATES.index` is already
 *          two aggregates, `19 normative index lines` and `6 more that did not
 *          fit`. What is lost is the second of those — a spilled aggregate
 *          cannot be sized, so the lane holds no ghost for the index tier and
 *          its `.hint` says which count went unsized rather than drawing a
 *          width nobody served.
 *       2. **The interleaving of fills and ghosts.** The lane's positions are
 *          the selector's candidate order, and `full` and `spilled` are two
 *          SUBSEQUENCES of it with the merge missing. It is not recoverable:
 *          first-fit admits greedily, so `[9,1,5]` at a budget of 10 and
 *          `[4,9,4]` at 10 both yield two fills and one spill, and the spill
 *          sits last in one and second in the other. Recovering it needs
 *          either a spill ORDINAL or the spilled item's `severity`/`layer` on
 *          the wire; `Spill` carries `{id, tier, reason, band?}` — the band
 *          orders the two GROUPS and not the items inside one — and
 *          `ItemSummary` carries neither, and reading the position back out of the reason
 *          sentence is the second implementation of `select()`'s decision this
 *          project keeps paying for. So each admitted candidate holds its
 *          position as a `.gap` at its real width and each spilled one is a
 *          `.gh` at its real width, in `selection.spilled`'s own order — which
 *          is the order the read model states it must be drawn in
 *          (`ui/read-model.ts` · `order the selector considered each item, tier by tier` · ~390) —
 *          but a ghost cannot yet appear BETWEEN two fills, which is the
 *          placement `preview.ribbonn` asks for. Filed.
 *
 * **The rungs' names and descriptions are the mockup's own literals. The
 * ribbon's two ABSENT-TIER sentences are not, since 2026-08-29 — and the reason
 * this block used to give for leaving them that way had expired a fortnight
 * before anybody re-read it.**
 *
 * It read: *"they cannot become keys here … `test/ui/strings-parity.test.ts`
 * fails a table key the design of record does not declare, in that exact
 * direction."* That direction was DROPPED on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` — *"a feature
 * built in the app no longer needs to be drawn in the mockup first"* — and
 * `strings-parity` now compares mockup-to-app only. So the gate that was cited
 * as forbidding the keys had stopped forbidding them, and two English sentences
 * went on shipping under `א` on a reading nothing re-checked. **A constraint
 * quoted from memory rather than from the gate is how a defect outlives its
 * cause**, which is why the constraint is now cited with its decision beside it.
 *
 * `preview.notrun` and `preview.notrunn` carry those two sentences, in both
 * tables, in the design of record's own English and Hebrew — its `renderRibbons`
 * already drew both languages, so nothing was invented.
 *
 * What is still literal, and correctly:
 *
 *   - The gate CODES and the `GATES` table's one-line descriptions. The codes
 *     are product vocabulary and are right as literals, the same treatment
 *     `parts.js`'s `TIERCHIP` gives a tier name and `watch.js`'s `KIND_CHIP`
 *     gives a record kind. The DESCRIPTIONS are prose and are not right as
 *     literals — they stay English under `א`, and that is a real defect, now
 *     RECORDED rather than asserted: `test/ui/screen-literals.test.ts`
 *     enumerates every user-facing literal under `screens/` and holds the list
 *     of unkeyed ones so it can only shrink.
 *   - The four ribbon `.hint` sentences below, for the same reason and in the
 *     same ledger.
 *
 * **That check is the durable half of this.** Before it, "we think the UI is
 * translated" rested on nobody having added a literal — an assumption these two
 * sentences disproved — and no gate could see them, because a string with no key
 * is invisible to a key comparison and text under no `data-t` is not censused.
 */
import { selectQuery } from '/lib/viewmodel.js';
import {
  BOUND_CAP_LIST, boundedList, el, errorNote, idFull, linkId, mono, num, screenHead,
  simRangeFor, spaced, tierChip,
} from '/screens/parts.js';

/**
 * The mockup's four `<option>`s, in its order. Literals, not translated
 * strings: these are `SelectContext.event`'s own values, and the query grammar
 * sends them back over the wire unchanged.
 */
const EVENTS = ['session-start', 'tool', 'compact', 'manual'];

/**
 * The five tracks of the budget ribbon, in the mockup's own drawing order.
 *
 * **Not `sim.tiersRun`, which is a MEMBERSHIP test here and not a layout.**
 * `select.ts` says so where it exports that field: *"A caller drawing fixed
 * tracks reads it as a membership test; the order is a disclosure, not a
 * layout."* Five fixed tracks is what makes an absent tier drawable at all —
 * a track that vanished with its tier would say nothing, where a hatched one
 * says the event never reached it.
 */
const TIERS = ['pinned', 'jit', 'restored', 'continuity', 'index'];

/**
 * `select()`'s six gates, in `GATE_LADDER`'s order, with the one-line
 * description the design of record writes beside each.
 *
 * **The order is the whole of what the ladder shows** — `preview.whyn`: *"the
 * order is the explanation … the one that binds is only meaningful in the
 * position it holds"* — so it is transcribed from the design of record rather
 * than composed here, and `test/core/gate-code.test.ts` already holds that
 * table against `GATE_LADDER` rung for rung, in the mockup, so this list
 * cannot drift from the codes without that test saying so.
 *
 * `code` is `GateCode`'s own spelling, which is what `/api/items` sends and
 * what this file matches on. `name` is what the mockup DRAWS, which differs at
 * rung 2 — *"normative tier"* for the code `tier` — and the appearance is the
 * mockup's business.
 *
 * The descriptions are its literals; see this file's header for why they
 * cannot be string keys and what that costs under `א`.
 */
const GATES = [
  {
    code: 'eligible',
    name: 'eligible',
    q: 'active, not retired, not superseded, category enabled, not past valid_until',
  },
  {
    code: 'tier',
    name: 'normative tier',
    q: 'only a normative category is injectable in full; a rationale category reaches the '
      + 'index line and no further',
  },
  {
    code: 'focus',
    name: 'focus',
    q: 'a focus predicate narrows the corpus before scope is even considered',
  },
  {
    code: 'scope',
    name: 'scope',
    q: 'matchesScope against the event path, POSIX-normalised on both sides',
  },
  {
    code: 'seen',
    name: 'seen',
    q: 'already-delivered items are filtered out before budgeting',
  },
  {
    code: 'budget',
    name: 'budget',
    q: 'what reaches here and does not fit spills whole, with its reason — never truncated',
  },
];

/** `GATES`' index for a `GateCode`, or -1 for `passed` and anything unknown. */
const RUNG = (code) => GATES.findIndex((gate) => gate.code === code);

/**
 * **The rungs whose whole population this card LISTS, rather than only counts.**
 *
 * Since 2026-08-29 every rung carries HOW MANY items fail at it. The owner read
 * the card as *"the why not in injection preview shows only 3 items, spill had
 * much more"*, and he was right about the reading: the picker offered three
 * names for 564 failures, one of those names standing silently for 551 items,
 * and nothing on the card said *of how many*. A specimen presented without its
 * population reads as the whole set — which is
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` in a new
 * place. The counts are a partition `rungOf` already computes, tallied rather
 * than newly derived.
 *
 * **The picker itself does not change**, and that is a ruling rather than an
 * omission: one exemplar per rung is the design, argued below where the strip
 * is built, and a picker of 139 names would rebuild `preview.whyn`'s own
 * objection one axis along.
 *
 * Whether a rung's NAMES can also be drawn is a different question per rung,
 * and it has three answers:
 *
 *   - **rungs 1, 2 and 3** — `eligible`, `tier`, `focus` — are listed HERE,
 *     below the ladder, in `/api/items`' own id order. Their ids are reachable
 *     (rungs 1 and 2 are `ItemSummary.gate` over the whole corpus, rung 3 is
 *     `Selection.focus.hidden`) and no other card on this screen names them.
 *   - **rungs 5 and 6** — `seen`, `budget` — are already named IN FULL under
 *     `Not delivered`: rung 6 as the spill rows with their tier and price, rung
 *     5 as the `seenFiltered` rows beneath them. They are counted here and the
 *     sentence says where the list already is. A second bounded list of the
 *     same ids would be the same fact drawn twice, and the version down there
 *     carries more of it.
 *   - **rung 4** — `scope` — is counted with its unknown NAMED, and draws no
 *     list at all. `ItemSummary.gate` says `scope` only in its item-level form
 *     (an unscoped item under `scopePolicy: "inert"`); the per-event
 *     `matchesScope` refusal is on no endpoint, so the items THAT drops are
 *     absent from the verdict rather than placed on a rung nobody served. A
 *     list here would be the measured half presented as the whole, and a bare
 *     number would be a count standing where nobody measured.
 */
const RUNG_OPENABLE = new Set([0, 1, 2]);

/**
 * **An audit instant, drawn as a wall date AND a wall time.**
 *
 * `screens/ask.js`'s `clockOf` reduces an `at` to `09:26:05`, which is right
 * for a table whose every row is from the last few minutes and wrong here: the
 * whole point of the When on a preview row is that two rows can be WEEKS apart
 * (see `preview.when`), and a bare clock would draw those two identically.
 *
 * `en-GB` is a FORMAT choice and not a language one — the 24-hour, day-first
 * spelling in both UI languages, the same argument `parts.js`'s `num()` makes
 * for `en-US` and `clockOf` makes for itself.
 *
 * A string that is not a parsable instant is drawn AS IT ARRIVED, which is what
 * both existing spellings of this do: rendering an unparsed stamp through a
 * formatter is how a value gets shifted by the machine's offset and then shown
 * as though it had been measured.
 */
function stampOf(at) {
  const when = new Date(String(at));
  if (Number.isNaN(when.getTime())) return String(at);
  return when.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

/**
 * `/api/injection-history`'s rows, indexed the two ways a preview row asks.
 *
 * **Two indexes and not one, because a row has two honest answers and they are
 * not the same claim.** `byTriple` answers *"when did this item last do this AT
 * THIS TIER"* — the question the row is actually about, since the row already
 * names its tier, and the one the coordinator's measurement pins: an item in
 * this corpus has spilled from `jit` and from `pinned` fourteen minutes apart,
 * and a `jit` row showing the `pinned` instant would be reporting a different
 * event. `byPair` answers *"and if this tier has no record at all, when did the
 * item last do it anywhere"* — which is a weaker and still true statement, and
 * strictly better than the `never` it replaces, PROVIDED the tier it came from
 * is named. `whenRun` names it.
 *
 * The `MAX` is taken here as well as in SQL. The endpoint already groups by the
 * triple so `byTriple` cannot see two rows for one key, but `byPair` folds
 * across tiers and must pick the newest itself — and taking it in both places
 * costs one comparison and removes a dependence on the server's `ORDER BY`,
 * which is a claim this file cannot see.
 */
const historyKey = (role, id, tier) => (tier === null
  ? `${role}\u0000${id}`
  : `${role}\u0000${id}\u0000${tier}`);

function historyIndex(rows) {
  const byTriple = new Map();
  const byPair = new Map();
  for (const row of rows) {
    // Keys are composed by `historyKey` and never spelled inline, so a lookup
    // below cannot join the parts a different way from the index. It joins on
    // NUL because a `:` or a `-` occurs in every id this project writes.
    const triple = historyKey(row.role, row.id, row.tier);
    const prior = byTriple.get(triple);
    if (prior === undefined || row.at > prior) byTriple.set(triple, row.at);
    const pair = historyKey(row.role, row.id, null);
    const best = byPair.get(pair);
    if (best === undefined || row.at > best.at) byPair.set(pair, { at: row.at, tier: row.tier });
  }
  return { byTriple, byPair, truncated: false, cap: 0 };
}

/** The mockup's `isz()` — a data width, through the CSSOM and logical. */
function sized(node, percent) {
  node.style.setProperty('inline-size', `${percent}%`);
  return node;
}

/**
 * A cost as a percentage of its tier's budget — the one arithmetic the ribbon
 * does.
 *
 * **Not clamped, and that is deliberate.** A single candidate can cost more
 * than the whole budget, and its ghost is then WIDER than the track above it:
 * that is the fact `preview.ribbonn` calls first-fit being honest, and
 * clamping it to 100 would draw an item that merely just missed. `.track`
 * carries `overflow:hidden` for the admitted side, and `.ghosts` is a flex row
 * that shrinks — neither escapes the card.
 *
 * A budget of zero is not a division. It answers 0, and the `.hint` beside it
 * still reports the real headroom, so a tier configured to zero reads as a
 * tier that could admit nothing rather than as `NaN%`.
 */
function pct(tokens, budget) {
  return budget <= 0 ? 0 : (tokens / budget) * 100;
}

/**
 * **What one track is drawn to: the tier's budget, or the range the reader set
 * on the simulator when that is wider.**
 *
 * The budget is still the FACT — `used / budget` in the label, `headroom` in
 * the hint, and both are computed from it and not from this. What this changes
 * is the SCALE the segments are laid out against, so that a reader who has
 * widened the simulator's range to 40,000 sees this ribbon drawn over 40,000
 * too, and the tier they are considering raising has visible room to grow into
 * rather than a track that is already full by construction.
 *
 * `Math.max`, never a replacement: a range NARROWER than the budget in force
 * would draw a full track as an overflowing one, which is a different claim.
 * With no range set this is the budget exactly, so the default drawing is byte
 * for byte what it always was.
 */
function scaleFor(tier, budget) {
  const range = simRangeFor(tier);
  return range === null ? budget : Math.max(budget, range);
}

/**
 * This module's own unsubscribe from the shell's session listeners, if any.
 *
 * Module-level and not per-render, because a screen module is imported ONCE
 * and `render()` runs again on every return to `#/preview` and on every live
 * refresh. `ctx.onSessionChange` used to push and never remove, so each of
 * those renders left one more closure listening over a `show()` bound to a
 * container the next render had already discarded.
 */
let dropSessionListener = null;

/**
 * **THE READER'S PLACE ON THIS SCREEN, HELD ACROSS EVERY `render()`.**
 *
 * `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` says a screen either
 * keeps the reader's place or asks before redrawing. `preview` correctly
 * declares `refresh: 'ask'` — and until 2026-08-29, when the reader said yes,
 * it threw away the thing the asking was for. `render()` rebuilt `#evsel` from
 * `EVENTS[0]`, and `chosenPath` and `sessionMode` were `let`s INSIDE `render()`,
 * so a taken refresh returned the screen to *session-start · warm · no path*
 * and the reader's question was gone.
 *
 * Measured in a real browser before the fix, on the live corpus: with
 * `event=tool`, `path=my-context/src/core/select.ts` and the COLD question
 * pressed, one re-render answered `session-start`, no path picker at all, and
 * `live` pressed. Three separate losses on one act.
 *
 * **Module level, and that is the house's own answer to this shape rather than
 * a new one.** `parts.js`'s `SIM_RANGE` holds the simulator's slider bound the
 * same way, for the reason written there: an ES module is a singleton per page,
 * so this object already outlives every `render()` and every navigation, which
 * is exactly the lifetime a reader's pick wants. It does not survive a reload —
 * also right: a reload is the reader starting over, and a question remembered
 * across one is a question nobody on that page asked.
 *
 * **Not fixed by moving `refresh` to `'auto'`.** That would remove the ask and
 * keep the loss. The ask stays; what changes is that taking it now costs the
 * reader nothing.
 *
 * **`path` is VALIDATED on restore, never trusted.** `/api/coverage` walks the
 * repository live, so a file that was in the list when the reader picked it can
 * be gone by the next render. Assigning a `value` a `<select>` does not offer
 * silently leaves it `''`, which would send a query about no file at all — so
 * `ensureFiles` drops a remembered path the walk no longer names and falls back
 * to the first file, exactly as a first visit does.
 */
const PICKED = { event: EVENTS[0], path: null, mode: 'live' };

export async function render(root, ctx) {
  // A second render must not leave the first one's session listener behind —
  // `screens/watch.js`' `openStream` argument, for the other subscription a
  // screen can hold. `route()` calls `render()` again on every return to
  // `#/preview` and `setupLiveScreen`'s refresh calls it in place, so without
  // this the listeners accumulate one per render and a single session refresh
  // starts three `show()` calls on the third visit. Dropped HERE rather than
  // only on the way out, so it also covers a render that threw.
  if (dropSessionListener !== null) {
    dropSessionListener();
    dropSessionListener = null;
  }

  root.replaceChildren();
  screenHead(ctx, root, 'preview.h', 'preview.v', 'preview.sub');

  // --- Event --------------------------------------------------------------
  const evCard = el('div', 'card pane');
  const evH = el('h3');
  evH.append(...ctx.t('preview.ev'));
  // The mockup writes this row's layout as a `style` attribute. CSP forbids one
  // in the shipped app, so the same declarations go through CSSOM instead.
  const bar = el('div');
  bar.style.setProperty('display', 'flex');
  bar.style.setProperty('gap', '8px');
  bar.style.setProperty('flex-wrap', 'wrap');
  bar.style.setProperty('align-items', 'center');
  bar.style.setProperty('font-size', '14.5px');

  const evLabel = el('label', 'small');
  evLabel.htmlFor = 'evsel';
  evLabel.append(...ctx.t('preview.evl'));
  const evsel = el('select');
  evsel.id = 'evsel';
  for (const name of EVENTS) {
    const option = el('option', null, name);
    option.value = name;
    evsel.append(option);
  }
  // **The reader's event, restored — see `PICKED`.** A `<select>` rebuilt from
  // `EVENTS` opens on `EVENTS[0]`, so this line is the whole difference between
  // a taken refresh that keeps the reader's question and one that discards it.
  // Membership-checked rather than assigned blind: `EVENTS` is the option list,
  // and a value it does not offer would leave `evsel.value` as `''` and send a
  // query about no event at all.
  if (EVENTS.includes(PICKED.event)) evsel.value = PICKED.event;
  // The path slot. The mockup draws `session-start` and writes one unkeyed
  // literal here — `path — none (session-start takes none)`. Three of the four
  // events take no path, so the literal is drawn with the event it is actually
  // about; the sentence is the mockup's, the noun is the one on screen.
  const pathSlot = el('span');
  bar.append(evLabel, evsel, pathSlot);

  /**
   * **WHAT THE PATH PICKER CAN AND CANNOT DO, SAID BESIDE THE PATH PICKER.**
   *
   * Owner, 2026-08-28: *"event - when selecting tool, the path should be used as
   * filter but it does nothing"*. Traced end to end and every link holds — the
   * control refetches, `read-model.ts` sets `ctx.path`, `jitTarget()` normalises
   * it, and the jit tier filters candidates on `matchesScope`. The control is
   * not broken.
   *
   * **What makes it inert is the CORPUS, and the screen never mentioned it.**
   * `matchesScope` answers `scopePolicyFor(config, item.type) !== 'inert'` for
   * an item with no scope of its own — so under the default policy an unscoped
   * item is unrestricted and matches EVERY path. 619 of this repository's 621
   * items carry `scope: []`, so the jit candidate set is the same whatever path
   * is chosen and the path is arithmetically incapable of changing the answer.
   * Measured in a browser before this landed: `.gitignore`,
   * `my-context/src/core/select.ts` and `reports/V2-HANDOVER.md` each delivered
   * the SAME three ids.
   *
   * So this is the same shape the project keeps finding — correct about what it
   * does, silent about what it cannot do — and it takes the same fix the
   * `cap.warn` and bare-URL 401 disclosures took: **disclosure at the point of
   * use.** Not a rewrite, and explicitly **not** hiding the control when nothing
   * is scoped: a missing control is the same silence one step further on. And
   * explicitly not changing `scopePolicy`, which is the owner's config and a
   * corpus-wide behaviour change.
   *
   * **Drawn only on a tool event**, because that is the only event with a path
   * at all, and it is where the sentence is about something.
   *
   * **Every figure is the SERVER'S OWN**, and that is why `/api/help/scope` is
   * the source rather than `/api/items` plus a client-side policy lookup.
   * `ItemSummary` carries `scope` and `type`, so the split is reachable from
   * what this screen already holds — but the POLICY is not: resolving it means
   * `Object.hasOwn(config.categories, type) ? … : DEFAULT_SCOPE_POLICY`, and a
   * client spelling that fallback would be a second implementation of
   * `scopePolicyFor` that agrees today and drifts later — the two-spellings
   * defect `GateCode` exists to prevent. `/api/help/scope` already partitions
   * the corpus into `scoped` and `unscoped` and stamps each unscoped item with
   * `scopePolicyFor`'s own answer, so nothing new is needed server-side and
   * nothing is re-derived here. `'inert'` is matched as a VALUE the way this
   * file already matches `GateCode` values, which is reading a code rather than
   * recomputing a decision.
   */
  const scopeNote = el('p', 'small');
  scopeNote.id = 'scopeNote';

  // --- The QUESTION: this session, or a brand-new one ---------------------
  //
  // **`/api/select` has always served both, and this screen only ever asked
  // one.** The endpoint requires exactly one of `session=<id>` or `cold=1`
  // (`ui/read-model.ts`, `parseSelectQuery`) and refuses a request carrying
  // neither or both, precisely because they are two different questions. Until
  // 2026-08-29 this file contained the string `cold` zero times: it always sent
  // `session=<id>`, so the cold question — *what would a brand-new window get* —
  // was reachable from `curl` and from nowhere in the product.
  //
  // Measured on this repository's own corpus, same event, same focus, only that
  // parameter differing: `session=<id>` answered `full: 0, spilled: 0`, and
  // `cold=1` answered `full: 23, spilled: 1`. A reader looking for the Not
  // delivered list was being shown a structurally empty one.
  //
  // **THE DEFAULT DOES NOT MOVE, and that is a ruling rather than an
  // oversight.** Warm is the honest answer to this screen's own promise —
  // *exactly what Claude gets*, *what the most recent session was given at its
  // start* — and substituting the cold answer to make the panel look busier
  // would be answering a question nobody asked. Cold is offered, labelled, and
  // never silently swapped in: a reader who cannot tell which of the two they
  // are looking at is worse off than one who could only ever see the first.
  //
  // **The mockup's own home for this is the `#sesspop` dialog** (its
  // `button.row[data-cold="1"]`, with `sess.cold` / `sess.coldn` /
  // `sess.coldhelp` beside it), and that dialog is not built in this shell —
  // `app.js`'s header lists `#sesspop` under "what this task did not wire", and
  // `app.js` is not this task's file. So the control is built HERE, on the
  // screen whose reading it changes, out of the design of record's own three
  // strings rather than three invented ones. Presentation decision, recorded:
  // when the shell's session dialog lands, this becomes its second door and the
  // words are already shared.
  // Restored from `PICKED` for the reason written there: the question a reader
  // pressed is reader state that no fetch carries, and a refresh that resets it
  // to warm is answering a question they had already left.
  let sessionMode = PICKED.mode;
  const qbar = el('div', 'segbar');
  qbar.id = 'qpick';
  qbar.setAttribute('role', 'group');
  qbar.setAttribute('aria-label', ctx.tFlat('sess.title'));
  const qNote = el('p', 'small');
  qNote.append(...ctx.t('preview.qnote'));

  /**
   * The session the query actually carries — `'cold'` is `selectQuery`'s own
   * sentinel for `cold=1` and is not a session id
   * (`lib/viewmodel.js` · `if (session === 'cold') qs.set('cold', '1');` · ~214).
   *
   * A shell with no sessions at all already answers `'cold'` from
   * `ctx.session()`, so the two states collapse there — correctly: there is no
   * warm question to ask, and `paintQ` draws one button rather than an inert
   * second one.
   */
  const sessionFor = () => (sessionMode === 'cold' ? 'cold' : ctx.session());

  function paintQ() {
    qbar.replaceChildren();
    const live = ctx.session();
    const options = live === 'cold' ? ['cold'] : ['live', 'cold'];
    for (const mode of options) {
      const button = el('button');
      button.type = 'button';
      button.dataset.q = mode;
      const head = el('span');
      // The warm option is named by the session ITSELF — a value, drawn the way
      // `#sesslbl` draws it, because that is what identifies the question. The
      // cold option is prose and takes the design of record's string.
      if (mode === 'live') head.append(el('b', 'v', live));
      else head.append(...ctx.t('sess.cold'));
      const sub = el('span', 'small');
      sub.append(...ctx.t(mode === 'live' ? 'preview.qwarmn' : 'sess.coldn'));
      button.append(head, ' ', sub);
      button.setAttribute('aria-pressed', String(mode === sessionMode));
      button.onclick = () => {
        if (sessionMode === mode) return;
        sessionMode = mode;
        PICKED.mode = mode;
        paintQ();
        void show();
      };
      qbar.append(button);
    }
  }

  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.more'));
  const helpBox = el('div', 'helpbox');
  const firstLine = el('span');
  const p1 = el('b');
  p1.append(...ctx.t('help.p1'));
  firstLine.append(p1, ' ');
  // The five narrowing inputs, as the mockup writes them: `.m` literals rather
  // than translated strings — they are `SelectContext`'s own field names.
  const inputs = ['event', 'path', 'seen', 'restore', 'focus'];
  inputs.forEach((name, i) => {
    firstLine.append(mono(name));
    if (i < inputs.length - 1) firstLine.append(', ');
  });
  firstLine.append(' — all five, or this previews a different question.');
  const secondLine = el('span');
  secondLine.append(...ctx.t('help.p2'));
  helpBox.append(firstLine, secondLine);
  help.append(summary, helpBox);
  // The scope disclosure sits between the picker it is about and the question
  // strip — the point of use, which is the whole of the fix.
  evCard.append(evH, bar, scopeNote, qbar, spaced(qNote), help);
  root.append(evCard);

  // --- Delivered, the scene, and the carry --------------------------------
  const out = el('div');
  root.append(out);

  /**
   * The file list, fetched ONCE and only when a tool event first needs it.
   * `/api/coverage` walks the whole repository, and the landing event is
   * `session-start`, which takes no path at all — paying for that walk on first
   * paint would be paying for a picker the screen has not shown.
   */
  let files = null;
  // Restored from `PICKED`, and re-validated against the walk in `ensureFiles`
  // below — see `PICKED` for why a remembered path may no longer exist.
  let chosenPath = PICKED.path;

  /**
   * Every item and its injection verdict, fetched ONCE for the gate ladder.
   *
   * It is the corpus, not the selection, and it is right that it is: the
   * ladder's subject is *"why not"*, and an item that failed rung 1 or rung 2
   * is in no selection at all. `/api/items` is also the only place the gate
   * CODE travels, so there is nowhere else to ask.
   *
   * Cached across event changes because it does not depend on the event —
   * `injection()` is asked about an item and a config, with no event in hand
   * (`cli/commands/injection.ts` · `the question about an item it has not written yet` · ~73).
   * The three rungs that DO move with the event come from the selection, which
   * is refetched every time.
   */
  let items = null;

  async function ensureFiles() {
    if (files !== null) return files;
    const coverage = await ctx.api('/api/coverage');
    files = coverage.files.map((f) => f.path);
    // A path the walk no longer names is dropped rather than carried: assigning
    // it to the `<select>` would leave `picker.value` as `''` and send a query
    // about no file. Falling back to the first file is exactly what a first
    // visit does, so the recovered state is a state this screen can reach.
    if (chosenPath !== null && !files.includes(chosenPath)) chosenPath = null;
    if (chosenPath === null && files.length > 0) [chosenPath] = files;
    PICKED.path = chosenPath;
    return files;
  }

  async function ensureItems() {
    if (items !== null) return items;
    items = (await ctx.api('/api/items')).items;
    return items;
  }

  /**
   * The corpus split by whether an item declares a scope, and the policy in
   * force for the ones that do not — `/api/help/scope`'s `corpus`, fetched ONCE
   * and cached like `/api/items`, and for the same reason: it is a fact about
   * the corpus and the config, and it does not move when the reader changes the
   * event, the path or the session.
   *
   * **It swallows its own failure the way `ensureHistory` does**, and into a
   * REASON rather than into silence. A config that does not parse is a state
   * `/api/config` reports as a field on a 200 (`read-model-config.ts`: *"Neither
   * failure is a 500"*), and `/api/help/scope` resolves the policy through the
   * workspace, so either a refusal or an unresolvable config must cost the
   * reader this sentence and say why — never the selection beside it. The
   * screen then draws `preview.scopeunk`, which reports the halves it DID
   * measure and names the half it did not, rather than a zero nobody measured.
   */
  let scopeSplit = null;
  let scopeError = null;

  async function ensureScope() {
    if (scopeSplit !== null || scopeError !== null) return;
    try {
      const body = await ctx.api('/api/help/scope');
      const corpus = body.corpus;
      if (corpus === null || corpus === undefined
        || !Array.isArray(corpus.scoped) || !Array.isArray(corpus.unscoped)) {
        scopeError = 'the scope join was not served';
        return;
      }
      scopeSplit = {
        scoped: corpus.scoped.length,
        unscoped: corpus.unscoped.length,
        // `policy` is `scopePolicyFor`'s own answer, stamped server-side per
        // item. Matched as a value, never recomputed — see `scopeNote`.
        inert: corpus.unscoped.filter((entry) => entry.policy === 'inert').length,
      };
    } catch (error) {
      scopeError = error.message;
    }
  }

  /**
   * The disclosure itself, repainted on every `show()` because it appears and
   * disappears with the event.
   *
   * **Three states and no fourth.** Measured, measured-with-an-inert-clause, and
   * unmeasured-and-named — which is
   * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` applied to a
   * sentence rather than to a number. A `scoped` count of zero is drawn as zero
   * by the ordinary sentence: that IS the measurement, and it is the case where
   * the sentence matters most.
   */
  function paintScopeNote(event) {
    scopeNote.replaceChildren();
    if (event !== 'tool') return;
    if (scopeSplit === null) {
      if (scopeError === null) return;
      scopeNote.append(...ctx.t('preview.scopeunk', { reason: scopeError }));
      return;
    }
    const { scoped, unscoped, inert } = scopeSplit;
    scopeNote.append(...ctx.t('preview.scope', {
      scoped: num(scoped), total: num(scoped + unscoped), unscoped: num(unscoped),
    }));
    // Only when the policy actually removes something. A clause reporting zero
    // inert categories on every corpus is a sentence nobody reads.
    if (inert > 0) {
      scopeNote.append(' ', ...ctx.t('preview.scopeinert', { inert: num(inert) }));
    }
  }

  /**
   * **When each item last really was delivered, and last really did spill** —
   * `/api/injection-history`, fetched ONCE and cached like `/api/items`, for the
   * same reason: it does not depend on the event, the path or the session. These
   * are facts about the AUDIT LOG, and they do not move when the reader changes
   * the question.
   *
   * **It is fetched AFTER the selection has been drawn, not beside it** — see
   * the measurement in `show()`, where the ordering is argued and the browser
   * failure it fixes is recorded.
   *
   * **It swallows its own failure, deliberately.** The audit projection is
   * allowed to refuse: `behind`,
   * `diverged` and `damaged` all answer 503 rather than data, because syncing is
   * a write and a read surface may not perform one. That refusal must cost the
   * reader the When column and a sentence saying why — never the selection. If
   * these times rode on `/api/simulate`, a projection one record behind would
   * refuse the landing screen outright, which is worse than the gap it was meant
   * to close.
   *
   * Three outcomes, and all three are drawn:
   *
   *   - rows        — `history` holds the two indexes, and every row gets a When.
   *   - `rows: null`— the projection was never built. `preview.whenabsent`, which
   *                   says so and names the command that builds it. NOT "never
   *                   delivered" on every row: that would be a claim about the
   *                   corpus manufactured out of a missing file.
   *   - a throw     — `preview.whenoff` carrying the SERVER's own sentence, which
   *                   already names the state and what to run.
   *
   * `historyNote` is set for the second and third and is what the cards draw
   * INSTEAD of `preview.when`; `history` stays null, so `whenRun` draws nothing
   * on a row rather than a dash a reader would have to decode.
   */
  let history = null;
  let historyNote = null;

  async function ensureHistory() {
    if (history !== null || historyNote !== null) return;
    try {
      const body = await ctx.api('/api/injection-history');
      if (body.rows === null || body.rows === undefined) {
        historyNote = { key: 'preview.whenabsent', slots: {} };
        return;
      }
      history = historyIndex(body.rows);
      history.truncated = body.truncated === true;
      history.cap = body.cap ?? body.rows.length;
    } catch (error) {
      historyNote = { key: 'preview.whenoff', slots: { reason: error.message } };
    }
  }

  /**
   * The When on one row: the last time this item really did this, at the tier
   * the row names, or under another tier with that tier named, or never.
   *
   * `null` when there are no times at all — the card carries `historyNote`
   * instead, said once where a reader will read it rather than repeated on
   * twenty rows.
   *
   * **`tier === null` asks the item-level question**, which is the only one the
   * filtered-at-`seen` rows can ask: those items reached no tier, so there is no
   * tier of theirs to match against.
   */
  function whenRun(role, id, tier) {
    if (history === null) return null;
    const run = el('span', 'small');
    const key = role === 'injected' ? 'preview.lastinj' : 'preview.lastspill';
    const exact = tier === null ? undefined : history.byTriple.get(historyKey(role, id, tier));
    if (exact !== undefined) {
      run.append(...ctx.t(key, { at: stampOf(exact), tier: String(tier) }));
      return run;
    }
    // No record at this row's tier. The item's most recent record under ANY
    // tier is a weaker statement and a true one, and it is drawn with that
    // tier NAMED — never folded into the row's own tier, which would report an
    // event at a tier where it did not happen.
    const other = history.byPair.get(historyKey(role, id, null));
    if (other !== undefined) {
      run.append(...ctx.t(key, { at: stampOf(other.at), tier: other.tier }));
      return run;
    }
    // **A measured absence, drawn and named.** An empty cell here reads as a
    // rendering failure; "never delivered" is a fact the projection actually
    // holds, and it is the more informative half of this column —
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
    run.append(...ctx.t(role === 'injected' ? 'preview.neverinj' : 'preview.neverspill'));
    return run;
  }

  /**
   * **What the current `draw()` still owes a When to**, in draw order.
   *
   * The selection is fetched and drawn first and the audit history a moment
   * later (see `show()`), so the first paint has rows and no times. What it must
   * NOT do is redraw when the times land: `out.replaceChildren()` followed by a
   * second `draw()` swaps every node on the screen out from under whoever is
   * reading it — measured 2026-08-29 as `e2e/served-shape.spec.ts` failing on
   * one run in one, at `--workers=1`, because `evaluateAll` takes an
   * instantaneous snapshot and the row it had located had been replaced. A real
   * reader mid-click meets the same swap.
   *
   * So the second pass DECORATES instead: each row keeps the identity of the
   * When it is owed, each card keeps an empty paragraph in the position its
   * sentence will occupy, and `fillWhen` fills both in place. Nothing moves, and
   * a card drawn on the first visit has the same node order as one drawn on the
   * fifth.
   */
  let whenTargets = [];

  /** Append the When to a row now, or register the row to be filled later. */
  function whenSlot(row, role, id, tier) {
    const run = whenRun(role, id, tier);
    if (run !== null) row.append(run);
    else whenTargets.push({ row, role, id, tier });
  }

  /**
   * The When disclosure a card carries once: what the column IS, or why it is
   * missing, plus the cut line where the answer was bounded.
   *
   * **Three states, not two.** Both `null` is NOT READ YET, and it leaves the
   * paragraph EMPTY rather than absent: the rows carry no When either, so a
   * sentence describing the column would be a claim about a column that is not
   * on screen — and an absent paragraph would have to be inserted later, which
   * is the node movement this whole arrangement exists to avoid.
   */
  function paintWhenNote(note) {
    note.replaceChildren();
    if (history === null && historyNote === null) return;
    note.append(...(historyNote === null
      ? ctx.t('preview.when')
      : ctx.t(historyNote.key, historyNote.slots)));
    // The cut sentence joins the SAME paragraph rather than adding a second
    // one, for the reason above: what arrives late may fill a node, never
    // create one beside it.
    if (history !== null && history.truncated) {
      note.append(' ', ...ctx.t('preview.whentrunc', { n: num(history.cap) }));
    }
  }

  function whenNote(card) {
    const note = el('p', 'small');
    card.append(note);
    paintWhenNote(note);
    if (history === null && historyNote === null) whenTargets.push({ note });
  }

  /**
   * The second pass, run once `/api/injection-history` has answered: every row
   * gains its run and every card its sentence, in place.
   */
  function fillWhen() {
    for (const target of whenTargets) {
      if (target.note !== undefined) { paintWhenNote(target.note); continue; }
      const run = whenRun(target.role, target.id, target.tier);
      if (run !== null) target.row.append(run);
    }
    whenTargets = [];
  }

  function drawPathSlot(event) {
    pathSlot.replaceChildren();
    if (event !== 'tool') {
      pathSlot.className = 'm small';
      pathSlot.append(`path — none (${event} takes none)`);
      return;
    }
    pathSlot.className = '';
    // `path` is a `.m` LITERAL, exactly as the helpbox above spells it — the one
    // accessible name for this control the design of record supplies without
    // inventing a string key the tables do not declare.
    const label = el('label', 'm small', 'path');
    label.htmlFor = 'pathsel';
    const picker = el('select', 'path');
    picker.id = 'pathsel';
    for (const file of files ?? []) {
      const option = el('option', 'path', file);
      option.value = file;
      picker.append(option);
    }
    if (chosenPath !== null) picker.value = chosenPath;
    picker.onchange = () => { chosenPath = picker.value; PICKED.path = chosenPath; void show(); };
    pathSlot.append(label, ' ', picker);
  }

  /**
   * **The render generation, and the two rules that hang off it.**
   *
   * `show()` awaits `/api/select` and `/api/simulate`, and `draw()` APPENDS.
   * Until 2026-08-29 there was no guard between those two facts, so two
   * overlapping calls each cleared an already-empty `out` and then each
   * appended a FULL render: the screen held two `#spilledRows`, two Delivered
   * cards and two ribbons, one per selection, both on screen at once. Measured
   * (`TASK-the-preview-can-hold-two-renders-at-once-and-session`): an unscoped
   * `#spilledRows .row` read 40 rows from two different selections, and
   * `e2e/preview-spilled.spec.ts`'s band assertion failed 4 runs out of 4 in
   * isolation because of it.
   *
   * Overlaps are not exotic here. `evsel.onchange`, `pathsel.onchange` and
   * `ctx.onSessionChange` all call this, and the session listener fires while
   * the reader is mid-change.
   *
   * RULE 1 — **the LAST call to start is the one that draws.** Every entry
   * takes a token; a call whose token is stale by the time its answers land
   * abandons the render rather than appending to a screen somebody else now
   * owns. Newest wins, not fastest: the reader's most recent question is the
   * one they are looking at.
   *
   * RULE 2 — **`out` is cleared where the ANSWER arrives, not before the
   * request.** Clearing first is what made a slow render a blank screen and a
   * fast one a double, and it is why the two halves have to move together: a
   * guard that abandoned the render while the clear stayed at the top would
   * leave the screen empty every time a late call was dropped.
   *
   * The ONE pre-clear that survives is `shown`, below, and it is a different
   * statement: the rows on screen answer the question `shown` records, so once
   * the reader moves the event or the path they are an answer to a question
   * nobody asked any more, and holding them under the new picker values would
   * be a lie rather than a stale-but-true reading. A refresh for the SAME
   * question — which is every `onSessionChange` on an unchanged selection —
   * keeps what is drawn until the replacement is in hand.
   */
  let generation = 0;
  /** The query string `out`'s current contents answer, or `null` if nothing does. */
  let shown = null;

  async function show() {
    const mine = ++generation;
    const event = evsel.value;
    try {
      // Both are tool-event reads and neither blocks the other: the picker needs
      // the repository walk, the disclosure beside it needs the scope join, and
      // a reader on `session-start` pays for neither.
      if (event === 'tool') await Promise.all([ensureFiles(), ensureScope()]);
      if (mine !== generation) return;
      drawPathSlot(event);
      paintScopeNote(event);
      // No file to preview a tool event against. `/api/select` refuses
      // `event=tool` without a path, and asking anyway would turn an empty
      // repository into a refusal the reader would have to decode.
      if (event === 'tool' && chosenPath === null) { shown = null; out.replaceChildren(); return; }

      const qs = selectQuery(event, event === 'tool' ? chosenPath : null, sessionFor());
      // Rule 2's exception — see above. The selection MOVED, so what is drawn
      // answers a question the reader has already left.
      if (qs !== shown) { shown = null; out.replaceChildren(); }
      // `/api/select` is `select()`'s serialization and nothing else (design
      // decision 7), so the SELECTION is read from there and never from the
      // simulator's copy of it. `/api/simulate` is asked only for the two things
      // decision 7 keeps off that response: the budgets, and which tiers ran.
      const [selection, sim, corpus] = await Promise.all([
        ctx.api(`/api/select?${qs}`),
        ctx.api(`/api/simulate?${qs}`),
        ensureItems(),
      ]);
      if (mine !== generation) return;
      // Here, and nowhere earlier: the replacement is in hand, so the swap is
      // one act and the screen is never both empty and current.
      out.replaceChildren();
      shown = qs;
      draw(selection, sim, corpus);

      // ── THE WHEN ARRIVES SECOND, AND IT DECORATES RATHER THAN REDRAWS ───
      //
      // **Not in the wave above.** `/api/injection-history` opens the AUDIT
      // PROJECTION and the server reads it synchronously; the three requests
      // above open the INDEX and carry this screen's actual subject. Sequencing
      // the heavier, unrelated read after them means a reader gets the selection
      // immediately and the history a moment later, rather than waiting on the
      // log to be told what would be injected.
      //
      // **What this ordering is NOT.** It is not a fix for
      // `500 {"error":"database is locked"}`, which this workspace's browser
      // suite produces on its own: `e2e/app.ts` runs `mycontext audit` before
      // every fixture and several workers do it at once over one corpus, so a
      // server read can land on a sibling's write. Measured 2026-08-29 on
      // `e2e/item-pane.spec.ts` under four workers — SIX runs of eight failed
      // with this fetch removed from the screen entirely, three of eight with it
      // present, and none at all at `--workers=1`. The contention predates this
      // change and belongs to the harness; it is in the report, not papered over
      // here.
      //
      // **NOT awaited, and that is the part that had to be measured.**
      // `route()` awaits `render()`, and `renderScreen` QUEUES the next render
      // behind it — so an `await` here keeps `render()` pending for the length of
      // an audit read and pushes any queued re-render (a live invalidation, a
      // second route to this screen) that much later. Measured: with the fetch
      // awaited, `e2e/served-shape.spec.ts` failed four runs out of four at
      // `--workers=1` and zero out of four with it removed — its `count()` takes
      // an instantaneous reading and was landing in the window where the delayed
      // re-render had cleared the section and not yet redrawn it. A real reader
      // gets the same blank. So `render()` resolves the moment the selection is
      // drawn, exactly as it did before the When existed, and the times catch up
      // afterwards.
      //
      // **`fillWhen`, never a second `draw`.** Redrawing would clear `out` and
      // rebuild it, swapping every node on screen out from under whoever is
      // reading. So the rows and cards this pass drew keep their places and are
      // filled in situ — nothing moves, and nothing a reader had located stops
      // existing.
      //
      // `ensureHistory` never rejects, so there is nothing to catch; the
      // generation guard is what stops a reader who moved the event meanwhile
      // from having a stale screen decorated.
      if (history === null && historyNote === null) {
        void ensureHistory().then(() => { if (mine === generation) fillWhen(); });
      }
    } catch (error) {
      if (mine !== generation) return;
      // The endpoint's own words, drawn INSTEAD of the data: an empty selection
      // and a refused request are two facts, and only one of them is about the
      // corpus.
      shown = null;
      out.replaceChildren(errorNote(error.message));
    }
  }

  function draw(selection, sim, corpus) {
    // Every row and card this pass will owe a When to is collected fresh: the
    // previous pass's nodes are gone, and filling one of them would write into
    // a screen nobody is looking at.
    whenTargets = [];
    // `Delivered` — the three numbers `preview.cap` words. `used` is
    // `Selection.tokens`, the figure the budget decisions were actually made
    // against and which the selector computed rather than a client re-derived;
    // `budget` is the sum over the tiers this event RAN, because a budget for a
    // tier that never ran is not part of what this selection could spend.
    const budget = sim.tiersRun.reduce((total, tier) => total + sim.budgets[tier], 0);
    const delivered = el('div', 'card pane');
    const dh = el('h3');
    dh.append(...ctx.t('preview.delivered'));
    const cap = el('p', 'small');
    cap.append(...ctx.t('preview.cap', {
      items: num(selection.full.length),
      used: num(selection.tokens),
      budget: num(budget),
    }));
    // `.two` — Delivered beside Why not, the house two-column pattern this
    // screen used before the repaint and five other screens still use.
    const two = el('div', 'two');
    delivered.append(dh, cap);

    // ── The delivered rows live INSIDE the Delivered card ──────────────────
    //
    // Until 2026-08-26 they sat in a `.scene > .pair > .plane.l` beside a
    // `.plane.r` holding each item's BODY, and that right plane was the only
    // untitled card on the screen. The owner asked for it out, and he was
    // right on the facts: it duplicated the item detail pane, which draws the
    // same body PLUS type, status, tier, scope, governs, file and the
    // twelve-week sparkline.
    //
    // It was not a misunderstanding — repaint Task 6 built it deliberately,
    // for a stated reason: "never look at a rule without seeing the text it
    // produced". What changed is that the detail pane can now do that job; when
    // the linked view was written the pane had no sparkline, a `file` row that
    // showed a dash on every item, and `.well`/`.welllabel` rules that were
    // never carried.
    //
    // AND THE PATTERN HAD ONE INSTANCE. `.scene`, `.pair` and `.plane` were
    // called "the composition pattern the other twenty screens copy"; measured
    // across the whole mockup they appear EXACTLY ONCE each, here, and no
    // screen ever copied them. `.two` — what the pre-repaint design used for
    // this very screen — is used six times.
    //
    // So the layout returns to `.two`: Delivered beside Why not, the ribbon
    // below both, and a row opens the pane.
    const rows = el('div', 'rows');
    rows.id = 'deliveredRows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));

    // **`data-id`, so the shell's own delegated handler opens the pane.** Not a
    // second listener: `app.js` already routes any click inside `[data-id]` to
    // `openPane`, and a screen adding its own would be a second implementation
    // of the one behaviour every id in this product shares.
    // **A DISPLAY cap, and the sentence says so in those words.** The order is
    // the selector's own first-fit admission order, because `SelectionEntry` is
    // `{item, tier}` and carries no time — see `boundedList`. Getting the
    // wording wrong here turns "showing 20 of 47" into "you were given 20",
    // which would be false about the one screen that promises *exactly what
    // Claude gets*.
    const deliveredBound = boundedList(ctx, rows, selection.full, (entry) => {
      const row = el('button', 'row');
      row.type = 'button';
      row.dataset.id = entry.item.id;
      row.append(idFull(entry.item.id), tierChip(entry.tier));
      // **The When, and it is about the PAST rather than about this row's
      // selection.** Nothing on this screen is being injected as the reader
      // looks at it — `select()` was asked what a session start WOULD get. So
      // the instant here is the last time this item really was delivered, read
      // from `audit_item`, and two rows can carry times weeks apart without
      // either being wrong. `preview.when`, below the list, says exactly that
      // in the reader's own language; getting this wrong would put a stale
      // reading on the one screen that promises *exactly what Claude gets*.
      whenSlot(row, 'injected', entry.item.id, entry.tier);
      return row;
    }, { cap: BOUND_CAP_LIST, order: 'admitted', displayOnly: true });
    delivered.append(rows, deliveredBound);
    whenNote(delivered);

    // Why not sits in the SECOND column, so `drawGates` is handed its host
    // rather than reaching for `out`.
    two.append(delivered);
    drawGates(corpus, selection, sim, two);
    out.append(two);

    drawCarry(selection.index);
    // Between the ladder and the ribbon, and that is the argument the whole
    // screen is read in: Why not diagnoses ONE item, Not delivered NAMES every
    // one of them, and the ribbon then shows what the budgets did with the
    // widths. The ribbon still comes last.
    drawSpilled(selection, sim);
    drawRibbons(selection, sim);
  }

  /**
   * The cross-session carry, in the four clauses `core/render.ts` already
   * composes for the CLI out of this same one field — so the two surfaces have
   * one vocabulary rather than two that agree today.
   *
   * **Each clause is omitted entirely when its own list is empty**, which is the
   * mockup's rule and not a tidiness preference: a clause carrying a zero every
   * session is how a reader learns to skim past the one session where it
   * matters.
   *
   * **The `.carrieditem` blocks are the ids behind `carried.shown`**, and they
   * come from `IndexSummary.normative` rather than from `CarriedSummary`:
   * `shown` is a COUNT, and the ids that produced it are the lines the summary
   * flags — `carried` is set to `true` on a line a previous session had and is
   * ABSENT otherwise, deliberately
   * (`core/select.ts` · `The key is ABSENT otherwise, deliberately` · ~70). One block per
   * arriving line, so the sentence's number and the list under it are the same
   * fact twice rather than two facts that agree today.
   *
   * They are SIBLINGS of the `preview.carried` paragraph and never nested
   * inside it — the mockup's own arrangement, for the defect
   * `e2e/language.spec.ts` pins: a `data-t` element's children are replaced
   * wholesale from the string table, which knows nothing of a button or a chip
   * someone put inside one.
   *
   * **The `PROPOSED` badge is NOT drawn, and this is an ACCEPTED DIVERGENCE
   * from the design of record — the first one this project has recorded.**
   *
   * Owner ruling, 2026-08-23, in his own words: "leave the mockup intact, do it
   * only in the real, i need it to stay on the mockup for history, when
   * comparing to mockup the proposed word is a known diff and it is ok."
   *
   * The badge marks a FEATURE as proposed — that is what `.prop` means
   * everywhere else in the design of record, on rail buttons and on whole
   * screens' verdicts. This block is now BUILT, and the app's own tested rule
   * is that a built feature stops advertising itself as proposed
   * (`e2e/app-layout.spec.ts` · `the rail no longer badges watch as PROPOSED` · ~322).
   * Drawing it here would label a working feature a proposal.
   *
   * So the two files deliberately differ, and each is right for its own job:
   * the mockup keeps the badge as the historical record of what was proposed
   * when it was drawn, and the app drops it because the thing exists. The
   * divergence is REGISTERED rather than silent — `e2e/screen-parity.spec.ts`
   * carries `span.prop` in `preview`'s ledger with this reason, so the gate
   * still fails if any OTHER kind goes missing, and nobody later mistakes this
   * for a screen that forgot something.
   */
  function drawCarry(index) {
    const carried = index.carried;
    if (carried === null || carried === undefined) return;
    const line = el('p', 'small');
    line.append(...ctx.t('preview.carried', {
      lines: num(carried.shown),
      session: `${carried.sessionId} · ${carried.label}`,
    }));
    out.append(spaced(line));

    // The same rule as the delivered list, by the owner's own instruction:
    // `IndexLine` is `{id, type, title, carried?}` and has no timestamp either.
    // The blocks need a host of their own — they used to be appended straight
    // to `out`, which leaves nothing for a bound line to sit under.
    const carriedHost = el('div');
    const carriedLines = index.normative.filter((line) => line.carried === true);
    const carriedBound = boundedList(ctx, carriedHost, carriedLines, (indexLine) => {
      const block = el('div', 'carrieditem small');
      const chip = el('span', 'chip gov');
      chip.dataset.g = '◇';
      chip.append(...ctx.t('tier.carried'));
      block.append(linkId(indexLine.id), chip);
      return block;
    }, { cap: BOUND_CAP_LIST, order: 'admitted', displayOnly: true });
    out.append(carriedHost, carriedBound);

    if (carried.dropped.length > 0) {
      const dropped = el('p', 'small');
      dropped.append(...ctx.t('index.carriedDropped', {
        dropped: num(carried.dropped.length),
        // The drop REASONS ride untranslated inside the slot: `select.ts`'s
        // `carriedDropReason` is their one spelling and there is no stable code
        // to translate from.
        ids: carried.dropped.map((d) => `${d.id} (${d.reason})`).join(', '),
      }));
      out.append(dropped);
    }
    if (carried.displaced.length > 0) {
      const displaced = el('p', 'small');
      displaced.append(...ctx.t('index.carriedDisplaced', {
        displaced: num(carried.displaced.length),
        ids: carried.displaced.join(', '),
      }));
      out.append(displaced);
    }
    // The fetch line appears only when there is something to fetch.
    if (carried.dropped.length > 0 || carried.displaced.length > 0) {
      const fetchLine = el('p', 'small');
      fetchLine.append(...ctx.t('index.carriedFetch'));
      out.append(fetchLine);
    }
  }

  /**
   * **`Not delivered` — every item that spilled, NAMED, with what it cost.**
   *
   * Until 2026-08-28 the only account this screen gave of what did not arrive
   * was the ribbon's ghost lane: widths without names, and `selection.spilled`
   * consulted solely to answer *"did this one item spill"* — a question the
   * reader has to already suspect the answer to. The owner reported it as
   * *"there is no place there for a list of items that did not delivered"*.
   *
   * **It does not overturn `preview.whyn` beside it.** That note argues against
   * listing six REASONS — a closed vocabulary whose order carries the meaning —
   * and it is right. This lists ITEMS: the reader's own data, different every
   * run, and its count is the answer to *"was my budget too small"*.
   *
   * **WHOLE, not per-tier**, with the tier on each row. `Selection.spilled` is
   * one list across every tier that ran; the ribbon splits it five ways only
   * because a ghost has to be sized against its own tier's budget. Both
   * readings are true and the aggregate is the one most easily lost between
   * them, so `preview.spilln` says which this is in those words.
   *
   * **In `selection.spilled`'s own order, never sorted here.** That order is
   * the one the selector considered each item in, tier by tier
   * (`ui/read-model.ts` · `order the selector considered each item, tier by tier` · ~390),
   * and it is load-bearing rather than incidental: first-fit admits greedily,
   * so `[4,9,4]` against a budget of 10 spills a different item than `[9,1,5]`
   * does. Re-sorting these rows by size or by id would draw a different
   * algorithm.
   *
   * **The band is READ, not re-derived** — `Spill.band`, written inside
   * `fitToBudget` where the position is known
   * (`core/select.ts` · `const partitioned = bands.filter(` · ~575). Comparing
   * `item.scope.length` against the event path here would be a second
   * implementation of the selector's own partition, which is the two-spellings
   * defect `GateCode` exists to prevent. It is ABSENT wherever the candidates
   * were not actually split, and the row then carries no marker: a partition
   * nobody made is not a fact to draw.
   *
   * **An index row shows a dash where a cost would be**, and the note says why.
   * `sim.costs` prices every id in `full ∪ spilled` with `itemCost` — the
   * FULL-TEXT cost — but the index tier admitted a LINE, and per-line index
   * costs are exposed by no endpoint
   * (`ui/read-model.ts` · `per-line index costs are exposed by no endpoint in this plan` · ~397).
   * Drawing the full-text figure beside an index line would be a number this
   * screen invented. The same gap the ghost lane already declines to size.
   *
   * **Bounded like every other list here**, through the one `boundedList` — 139
   * spills is an ordinary session-start figure on a real corpus — and with the
   * `considered` order, because these rows were not admitted. `displayOnly` is
   * deliberately NOT passed: that clause says *"all N were in the injection"*,
   * which is false of every row in this card.
   */
  function drawSpilled(selection, sim) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.spill'));
    const rows = el('div', 'rows');
    rows.id = 'spilledRows';
    rows.setAttribute('role', 'group');
    rows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
    card.append(heading, rows);

    const cost = new Map(sim.costs.map((entry) => [entry.id, entry.tokens]));
    const bound = boundedList(ctx, rows, selection.spilled, (spill) => {
      const row = el('button', 'row');
      row.type = 'button';
      // `data-id`, so the shell's own delegated handler opens the pane — the
      // one path every id in this product takes. It is the whole point of
      // naming the item: the reader asks "why did this not arrive", reads the
      // tier and the cost, and opens the item without leaving the screen.
      row.dataset.id = spill.id;
      row.append(idFull(spill.id), tierChip(spill.tier));
      // The band, where the selector actually banded. A `.m` run rather than a
      // chip: the chips on this row already carry the tier, a second coloured
      // token would compete with it, and `band 2` is product vocabulary from
      // the ruling rather than prose.
      if (spill.band !== undefined) row.append(mono(`band ${spill.band}`));
      row.append(mono(spill.tier === 'index' ? '—' : num(cost.get(spill.id) ?? 0)));
      // The last time this item really DID spill, from this tier — not a
      // property of the spill on this row, which has not happened. See
      // `preview.when` and `whenRun`. A row with no prior record reads "never
      // spilled before", which is more informative than a gap: it is spilling
      // here for the first time.
      whenSlot(row, 'spilled', spill.id, spill.tier);
      // The reason as the tooltip, in the SERVER's own words — the same
      // treatment the ghost lane gives it, and never parsed for the figures
      // above.
      row.title = spill.reason;
      return row;
    }, { cap: BOUND_CAP_LIST, order: 'considered' });
    card.append(bound);

    // ── WHICH EMPTINESS THIS IS, WHEN IT IS EMPTY ─────────────────────────
    //
    // `boundedList` closes an empty list with *Showing all 0*, which is true
    // and is not the fact a reader needs. **"Nothing spilled" and "nothing
    // reached the budget gate" are different facts**, and the second one used
    // to be drawn as the first: on this repository's own corpus a warm session
    // start answered `full: 0, spilled: 0` while 106 items had been removed one
    // gate earlier, and the screen said *Delivered 0 · Not delivered 0* with the
    // 106 accounted for nowhere at all. That is the exact shape
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids,
    // and it is why the owner read this panel as broken rather than as empty.
    //
    // `full.length + spilled.length` is what actually REACHED the budget gate:
    // every full-text candidate that got there was either admitted or spilled,
    // by construction — `fitToBudget` returns exactly those two lists. The
    // index tier is not counted, because it admits LINES and its own overflow
    // is `index.truncated`, drawn on the ribbon.
    const filtered = sim.seenFiltered ?? [];
    if (selection.spilled.length === 0) {
      const reached = selection.full.length + selection.spilled.length;
      const empty = el('p', 'small');
      if (reached > 0) empty.append(...ctx.t('preview.spillNone', { n: num(reached) }));
      else if (filtered.length > 0) {
        empty.append(...ctx.t('preview.spillUnreached', { n: num(filtered.length) }));
      } else empty.append(...ctx.t('preview.spillNoCand'));
      card.append(empty);
    }

    const note = el('p', 'small');
    note.append(...ctx.t('preview.spilln'));
    card.append(note);
    whenNote(card);

    // ── RUNG 5: WHAT THE `seen` GATE REMOVED, NAMED ───────────────────────
    //
    // **The second half of this card, and the one that closes the accounting
    // hole.** `Not delivered` used to mean "spilled at the budget", which is
    // one of two ways an item fails to arrive; the other is that this session
    // has already been given it, and until `/api/simulate` began serving
    // `seenFiltered` (2026-08-29) that removal rode on no response and could
    // not be drawn at all. This file's own header used to say so of rung 5:
    // *"the field is not in any response, so no item can be shown failing at
    // it"*.
    //
    // **It sits under the spills rather than in a card of its own**, because a
    // reader asking "why did this not arrive" is looking at exactly one place,
    // and two cards would split one question across them. The heading above
    // stays what it is — every row here is also an item that was not delivered.
    //
    // **The sentence does NOT claim these would otherwise have arrived**, and
    // that restraint is the point. Rung 5 runs before any tier picks its
    // candidates, so an item can clear it and still be no tier's candidate:
    // `always` for pinned, `matchesScope` for jit, the restore list for
    // restored. `preview.seen` says what the gate removed and stops there. What
    // a fresh window would actually get is the OTHER question, and the control
    // at the top of the screen is how a reader asks it.
    //
    // A `seen` row has no tier — it reached none — so its When asks the
    // item-level question, which `whenRun` takes as `tier === null`.
    const seenLine = el('p', 'small');
    seenLine.append(...(filtered.length === 0
      ? ctx.t('preview.seen0')
      : ctx.t('preview.seen', { n: num(filtered.length) })));
    card.append(spaced(seenLine));
    if (filtered.length > 0) {
      const seenRows = el('div', 'rows');
      seenRows.id = 'seenRows';
      seenRows.setAttribute('role', 'group');
      seenRows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
      const seenBound = boundedList(ctx, seenRows, filtered, (id) => {
        const row = el('button', 'row');
        row.type = 'button';
        row.dataset.id = id;
        row.append(idFull(id));
        whenSlot(row, 'injected', id, null);
        return row;
      // `considered`, and never `displayOnly`: these items were considered at
      // rung 5 in this order and NONE of them was in the injection, which is
      // the one claim `displayOnly` would make.
      }, { cap: BOUND_CAP_LIST, order: 'considered' });
      card.append(seenRows, seenBound);
    }
    out.append(card);
  }

  /**
   * **`Why not — the first gate that failed`**: the segmented item picker and
   * the six-rung ladder, in `select()`'s own order.
   *
   * The order IS the view. A two-column table naming the failing gate loses it,
   * and `preview.whyn` says why that matters: *"a list of six reasons is noise,
   * and the one that binds is only meaningful in the position it holds. Rungs
   * above it passed, the rung itself carries the diagnosis, and everything
   * below is not reached rather than passed."*
   *
   * **Which rung binds is READ, never re-derived.** Rungs 1, 2 and 4 are
   * `ItemSummary.gate`, written beside `injection()`'s sentence by the same
   * branch; rung 3 is membership of `Selection.focus.hidden`; rung 6 is
   * membership of `Selection.spilled`. Nothing here parses a sentence and
   * nothing here re-asks a predicate — the four sources are exactly the four
   * `InjectionVerdict.gate`'s own note names, and they are consulted in LADDER
   * order so an item hidden by focus AND unscoped under `inert` binds at rung
   * 3, which is where `select` would have stopped, and not at rung 4.
   *
   * **Rung 5 has a source since 2026-08-29, and the ladder is now whole.** It
   * used to read: *"the seen set is resolved server-side out of the session and
   * rides on no response, so this screen cannot name an item that was filtered
   * as already-delivered … it simply never binds."* `/api/simulate`'s
   * `seenFiltered` is that source — `select`'s own `injectable ∩ seen`,
   * computed in the read model from the four imported predicates rather than
   * respelled — so an item removed at the gate is placed on rung 5 for real,
   * and the exemplar picker offers one. Rung 5 is also where the specimen most
   * often binds on a WARM preview, which is why the rung's absence was invisible
   * for so long: cold is the only question the screen used to ask, and cold
   * removes nothing here.
   *
   * The picker holds one representative per rung, lowest first, and opens on
   * the DEEPEST one: the item that got furthest before failing is the one whose
   * ladder has something to show above the break, and it is the case the design
   * of record opens on too.
   */
  function drawGates(corpus, selection, sim, host) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.why'));
    const pick = el('div', 'segbar');
    pick.id = 'gatepick';
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
    // **THE PICKER SAYS WHAT IT IS HOLDING.** It offers one EXEMPLAR PER RUNG,
    // and `/api/items` is sorted by id so "the first" is stable by
    // construction — which is exactly the property the owner ran into: change
    // the event, change a budget, change what actually arrived, and the same
    // specimen very often comes back. *"Can not see changes to why not"* is
    // that stability, correctly reported about a panel that never disclosed it.
    //
    // **Disclosed rather than replaced, and the reasoning is recorded rather
    // than left in this choice.** Offering every failing item would rebuild
    // `preview.whyn`'s own objection one axis along — a picker of 139 names is
    // noise, and the ladder is a diagnosis of ONE item by construction. What
    // was missing was not a bigger picker but a list, and rung 6 — the rung a
    // reader is usually chasing — now has one below, named in the selector's
    // own order. The other five rungs remain specimens and now say so.
    const spec = el('p', 'small');
    spec.append(...ctx.t('preview.spec'));
    const ladderHost = el('div', 'gladder plate');
    ladderHost.id = 'gates';
    // **Where the selected rung's own population is named**, for the three
    // rungs this screen names nowhere else — see `RUNG_OPENABLE`. Built empty
    // and refilled by `paint()`, because which rung it is about is the picker's
    // answer and moves with every click.
    const popWrap = el('div');
    const note = el('p', 'small');
    note.append(...ctx.t('preview.whyn'));
    card.append(heading, pick, spaced(spec), ladderHost, popWrap, spaced(note));
    host.append(card);

    const hidden = new Set(selection.focus === null ? [] : selection.focus.hidden);
    const spills = new Map(selection.spilled.map((spill) => [spill.id, spill]));
    // **Rung 5, which had no source until 2026-08-29.** `/api/simulate` now
    // serves the ids the `seen` gate removed, computed against the SAME context
    // the selection was — so an item placed on this rung is one `select` really
    // did drop there, not one this file guessed at from a session id it does
    // not have.
    const seenOut = new Set(sim.seenFiltered ?? []);

    /** The first rung this item fails, walked in ladder order. -1 if it fails none. */
    const rungOf = (item) => {
      const own = RUNG(item.gate);
      // Rungs 1 and 2 are item-level and sit above focus, so they answer first.
      if (own === 0 || own === 1) return own;
      if (hidden.has(item.id)) return 2;
      // `ItemSummary.gate` can only ever say `scope` in its one item-level
      // form — an unscoped item under `scopePolicy: "inert"`. The per-event
      // `matchesScope` refusal is not on this endpoint at all, so an item this
      // event's path does not reach is simply absent from the picker rather
      // than being placed on a rung nobody served.
      if (own === 3) return 3;
      // Rung 5 before rung 6, which is `select`'s own order and the whole
      // reason this ladder exists: `fresh` is computed BEFORE `fitToBudget`
      // runs, so an item that is both already-delivered and unaffordable binds
      // where the selector actually stopped.
      if (seenOut.has(item.id)) return 4;
      return spills.has(item.id) ? 5 : -1;
    };

    // ── THE POPULATION EACH SPECIMEN STANDS FOR ───────────────────────────
    //
    // **One pass, and it is a TALLY of the partition `rungOf` already makes** —
    // not a second derivation of anything. Every item the corpus holds is asked
    // the same question the picker asks, and the answer is kept rather than
    // thrown away after the first hit.
    //
    // `/api/items` is sorted by id, so each rung's list arrives in id order and
    // `first[rung]` is exactly the specimen the picker has always offered: "the
    // first item by id that fails here" is unchanged, and now it is drawn
    // beside the number of items it is standing in for.
    const population = GATES.map(() => []);
    const first = GATES.map(() => null);
    for (const item of corpus) {
      const rung = rungOf(item);
      if (rung < 0) continue;
      population[rung].push(item.id);
      if (first[rung] === null) first[rung] = item;
    }

    const chosen = [];
    for (let rung = 0; rung < GATES.length; rung++) {
      if (first[rung] !== null) chosen.push({ rung, item: first[rung] });
    }
    let who = chosen.length === 0 ? null : chosen[chosen.length - 1];

    /**
     * **How many items fail at this rung, said on EVERY rung and in every
     * state** — including the rungs nothing fails at, which is the same
     * standard the `Not delivered` card's three emptinesses already meet: a
     * measured zero is drawn and named, and an unmeasured thing is named as
     * unmeasured rather than drawn as a zero.
     *
     * Four sentences, and the branch order is the whole of the argument:
     *
     *   - **rung 4 first, whatever its number.** Its count is the item-level
     *     half of a question whose other half no endpoint answers, so it never
     *     takes the plain sentence and never takes the zero one — `0` there
     *     would claim the event's path excluded nothing, which is precisely the
     *     thing nobody measured.
     *   - **zero next**, so a rung with no failures says so rather than going
     *     blank.
     *   - **rungs 5 and 6 name where their list already is.** Those items are
     *     drawn in full under `Not delivered`, with the tier and the price a
     *     bare id here could not carry.
     *   - everything else takes the plain count, and its ids are listed under
     *     the ladder.
     */
    const rungSentence = (rung, n) => {
      if (rung === 3) return ctx.t('preview.rungunk', { n: num(n) });
      if (n === 0) return ctx.t('preview.rung0');
      if (rung === 4) return ctx.t('preview.rungseen', { n: num(n) });
      if (rung === 5) return ctx.t('preview.rungspill', { n: num(n) });
      return ctx.t('preview.rungn', { n: num(n) });
    };

    /** The binding rung's diagnosis, in the SERVER'S own words. */
    const diagnosis = (pickedItem, rung) => {
      if (rung === 2) {
        // `describeFocus()` is the CLI's one spelling of this and is served
        // nowhere, so the axes are NAMED rather than re-worded here: they are
        // identifiers, and an identifier belongs in a `.m` run.
        const axes = selection.focus.axes;
        const parts = [];
        for (const [name, values] of [
          ['tags', axes.tags], ['categories', axes.categories], ['scope', axes.scope],
        ]) {
          if (values.length === 0) continue;
          if (parts.length > 0) parts.push(' · ');
          parts.push(mono(`${name}: ${values.join(', ')}`));
        }
        return parts;
      }
      // Rung 5 has no server sentence to carry: the `seen` gate produces a set,
      // not a phrase — `fresh = injectable.filter((i) => !seen.has(i.id))` — so
      // the diagnosis is this screen's own keyed sentence rather than a
      // paraphrase of a reason nobody wrote. It says what membership of that
      // set MEANS and nothing more.
      if (rung === 4) return [...ctx.t('preview.gseen')];
      // `Spill.reason` and `injection()`'s `phrase` ride untranslated, for the
      // reason the carry's drop reasons do: each is its own one spelling, and
      // there is no stable code under it to translate from.
      if (rung === 5) return [spills.get(pickedItem.id).reason];
      return [pickedItem.phrase];
    };

    function paint() {
      pick.replaceChildren();
      for (const candidate of chosen) {
        const button = el('button');
        button.type = 'button';
        // `.v` — bidi isolation WITHOUT the monospace, which is `lib/i18n.js`'s
        // own description of that class. The mockup writes the id as bare
        // button text, so `.m` would draw this strip in a different face from
        // the design of record; a bare text node would draw it identically and
        // lose the isolation an identifier needs in an RTL paragraph. `.v` is
        // the one that is both.
        const label = el('span', 'v', candidate.item.id);
        // **The specimen and the size of what it stands for, on the same
        // control.** The ladder says it at length; the button says it where the
        // choice is actually made, because a strip of three bare names is read
        // as three failures — which is exactly how 564 of them came to be
        // reported as *"only 3 items"*. Rung 4 takes its own word: the number
        // beside it is the measured half of its population, never the whole.
        const tally = el('span', 'small');
        tally.append(...(candidate.rung === 3
          ? ctx.t('preview.pickunk', { n: num(population[3].length) })
          : ctx.t('preview.pickn', { n: num(population[candidate.rung].length) })));
        button.append(label, ' ', tally);
        button.setAttribute('aria-pressed', String(candidate === who));
        button.onclick = () => { who = candidate; paint(); };
        pick.append(button);
      }
      ladderHost.replaceChildren();
      GATES.forEach((gate, i) => {
        // No candidate at all: every rung is drawn NEUTRAL rather than passed.
        // "Nothing was asked" and "everything passed" are different facts, and
        // six green ticks for a question nobody put is the second one told
        // wrongly.
        const state = who === null ? '' : i < who.rung ? 'pass' : i === who.rung ? 'binds' : 'after';
        const rung = el('div', state === '' ? 'rung' : `rung ${state}`);
        const mark = state === 'pass' ? ' ✓' : state === 'binds' ? ' ✗' : '';
        rung.append(el('span', 'n', `${i + 1}${mark}`));
        const name = el('span');
        name.append(el('b', null, gate.name));
        const why = el('span', 'q');
        // **The tally leads, and it is a property of the RUNG rather than of
        // the specimen** — so it is drawn identically whether this rung passed
        // for the selected item, bound it, or was never reached by it, and it
        // does not move when the picker does. Its own `<span>`, because it is a
        // keyed sentence sitting in a cell that also holds an unkeyed literal;
        // appending the nodes bare would render the same and diverge
        // structurally, which is the difference `screen-parity` exists to see.
        const tally = el('span');
        tally.append(...rungSentence(i, population[i].length));
        why.append(tally, ' ');
        if (state === 'binds') why.append(...diagnosis(who.item, who.rung));
        else if (state === 'after') why.append(`not reached — ${gate.q}`);
        else why.append(gate.q);
        rung.append(name, why);
        ladderHost.append(rung);
      });

      // ── AND THE SELECTED RUNG'S OWN POPULATION, NAMED ──────────────────
      //
      // Bounded through the house's one `boundedList`, never a second paging
      // mechanism, and in the `'position'` order — the one that claims nothing
      // about WHY these ids are in this sequence. They are in `/api/items`'
      // id order, which is not an admission order, not a consideration order
      // and not a recency, so the three sentences that name one would each be
      // a claim this list cannot support.
      //
      // No When column here, deliberately. An item stopped at `eligible`,
      // `tier` or `focus` reached no tier at all, and the two questions
      // `whenRun` can answer are both about a delivery — a "last delivered"
      // beside a retired item is a true fact about a different subject. The
      // rows that DO carry one are the rows about a real injection event.
      popWrap.replaceChildren();
      if (who !== null && RUNG_OPENABLE.has(who.rung)) {
        const opened = el('p', 'small');
        opened.append(...ctx.t('preview.rungopen', { gate: GATES[who.rung].name }));
        const popRows = el('div', 'rows');
        popRows.id = 'gateRows';
        popRows.setAttribute('role', 'group');
        popRows.setAttribute('aria-label', ctx.tFlat('aria.gatepick'));
        const popBound = boundedList(ctx, popRows, population[who.rung], (id) => {
          const row = el('button', 'row');
          row.type = 'button';
          // `data-id` — the shell's delegated handler opens the pane, the one
          // path every id in this product takes. Naming an item without making
          // it openable is the button-that-does-nothing defect.
          row.dataset.id = id;
          row.append(idFull(id));
          return row;
        }, { cap: BOUND_CAP_LIST, order: 'position' });
        popWrap.append(spaced(opened), popRows, popBound);
      }
    }
    paint();
  }

  /**
   * **`Budget ribbon — five tiers, and what fell out of each`.**
   *
   * Five FIXED tracks, one per tier, whatever this event reached: a tier that
   * never ran is hatched and named, and an empty track would claim it ran and
   * delivered nothing, which is a different fact — `select.ts`'s own words
   * where it exports `tiersRun`, and `preview.ribbonn`'s where it draws it.
   *
   * Deliberately CSS flex and not SVG. The mockup's ruling: *"a quantity bar
   * must mirror, and flex with logical properties mirrors for free"*. Every
   * width goes through the CSSOM (`sized`), never a `style` attribute, which
   * the shipped `style-src` would refuse.
   *
   * It follows `#evsel` rather than adding a second event selector, which is
   * the last sentence of `preview.ribbonn`.
   */
  function drawRibbons(selection, sim) {
    const card = el('div', 'card pane');
    const heading = el('h3');
    heading.append(...ctx.t('preview.ribbon'));
    const host = el('div', 'plate');
    host.id = 'ribbons';
    const note = el('p', 'small');
    note.append(...ctx.t('preview.ribbonn'));
    card.append(heading, host, note);

    // **The continuity tier's overflow, said out loud on the screen too.**
    // `select` already reports it structurally (`Selection.continuitySpill`)
    // and `render.ts` says it inside the injected block; this is the third
    // place, and three is deliberate. The defect being fixed is a guarantee
    // believed to be in force that silently was not, so the disclosure is put
    // wherever somebody might be looking. Drawn ONLY when the tier actually
    // overflowed — `null` is the ordinary case and draws nothing, because a
    // warning that is always on screen is a warning nobody reads.
    const overflow = selection.continuitySpill;
    if (overflow) {
      const loud = el('p', 'small');
      loud.append(...ctx.t('preview.contover', {
        n: String(overflow.ids.length),
        ids: overflow.ids.join(', '),
        cost: num(overflow.cost),
        budget: num(overflow.budget),
      }));
      card.append(loud);
    }
    out.append(card);

    const cost = new Map(sim.costs.map((entry) => [entry.id, entry.tokens]));
    let fullTokens = 0;
    for (const entry of selection.full) fullTokens += cost.get(entry.item.id) ?? 0;
    // The index tier's own spend. `Selection.tokens` is the `itemCost` of every
    // full-text entry PLUS the per-line estimate of every admitted index line,
    // and `costs` prices the first set — so the difference is the second. That
    // is arithmetic over two numbers the server computed, not a client
    // re-deriving a decision: nothing here re-estimates a line.
    const indexTokens = Math.max(0, selection.tokens - fullTokens);

    for (const tier of TIERS) {
      const budget = sim.budgets[tier];
      // Every width below is a percentage of `scale`; every FIGURE below is
      // computed from `budget`. Keeping the two apart is what lets the ribbon be
      // drawn over a raised range without any sentence on it becoming untrue.
      const scale = scaleFor(tier, budget);
      const ribbon = el('div', 'ribbon');
      const label = el('div', 'rlabel');
      label.append(tierChip(tier));

      if (!sim.tiersRun.includes(tier)) {
        // **KEYED SINCE 2026-08-29, and they are the reason `screen-literals`
        // exists.** Both of these shipped as English literals under no key and
        // no `ctx.t`, so the screen switched language around them and they did
        // not move — measured in a real browser with `document.dir === 'rtl'`
        // and both sentences still in English. Nothing could see it:
        // `strings-parity` compares KEY SETS, and a string with no key is
        // invisible to a key comparison; `bidi.spec` censuses runs per `data-t`,
        // and text under no `data-t` is not censused. The gates were sound and
        // the defect sat outside what they measured.
        //
        // The copy is the design of record's own, both languages — its
        // `renderRibbons` draws these two sentences in its `if(!runs)` branch
        // with a Hebrew form beside the English — so the tables carry the
        // mockup's words rather than invented ones.
        const absentLabel = el('span');
        absentLabel.append(...ctx.t('preview.notrun'));
        label.append(absentLabel);
        const absent = el('div', 'track');
        absent.append(el('div', 'notrun'));
        const absentHint = el('div', 'hint');
        absentHint.append(...ctx.t('preview.notrunn'));
        ribbon.append(label, absent, absentHint);
        host.append(ribbon);
        continue;
      }

      // What the track draws, what the lane draws, and the two counts beside
      // the chip. The index tier is one aggregate segment and no ghosts — see
      // this file's header for exactly which figure is missing and why.
      const isIndex = tier === 'index';
      const fits = isIndex
        ? [{ id: `${selection.index.normative.length} normative index lines`, tokens: indexTokens }]
        : selection.full.filter((entry) => entry.tier === tier)
          .map((entry) => ({ id: entry.item.id, tokens: cost.get(entry.item.id) ?? 0 }));
      const spilled = isIndex
        ? []
        : selection.spilled.filter((spill) => spill.tier === tier)
          .map((spill) => ({ id: spill.id, tokens: cost.get(spill.id) ?? 0 }));
      const used = isIndex ? indexTokens : fits.reduce((total, f) => total + f.tokens, 0);
      const outCount = isIndex
        ? selection.index.truncated
        : spilled.length;
      const inCount = isIndex ? selection.index.normative.length : fits.length;

      // The range is named whenever it is not the budget, because a track drawn
      // to a scale nobody is told about is the silent-ambiguity shape this
      // project keeps paying for: two ribbons of different widths would
      // otherwise mean the same spend.
      label.append(el('span', 'n',
        `${num(used)} / ${num(budget)}${scale === budget ? '' : ` · to ${num(scale)}`}`
        + ` · ${inCount} in · ${outCount} out`));

      const track = el('div', 'track');
      for (const fit of fits) {
        const segment = sized(el('div', `seg ${tier}`), pct(fit.tokens, scale));
        // The mockup's own tooltip, and an unkeyed literal there as here.
        segment.title = `${fit.id} · ${num(fit.tokens)} tokens`;
        track.append(segment);
      }
      // The head: what the tier did not spend, drawn as the track's own
      // remainder rather than as a fifth colour.
      track.append(el('div', 'seg head'));

      const ghosts = el('div', 'ghosts');
      for (const fit of fits) {
        // An admitted candidate holds its position INVISIBLY, so a ghost sits
        // under the place in the track the selector considered it.
        ghosts.append(sized(el('div', 'gap'), pct(fit.tokens, scale)));
      }
      for (const spill of spilled) {
        const ghost = sized(el('div', 'gh'), pct(spill.tokens, scale));
        ghost.title = `${spill.id} · ${num(spill.tokens)} tokens · budget exceeded`;
        ghosts.append(ghost);
      }

      const hint = el('div', 'hint');
      const headroom = budget - used;
      // Said once, before the headroom sentence, so the track's empty tail is
      // never read as headroom it is not: past the budget the tail is range, and
      // range admits nothing until the budget is actually raised.
      if (scale !== budget) {
        hint.append(
          el('b', null, `Drawn to the simulator's range, ${num(scale)}`),
          ` — the budget in force is still ${num(budget)}, and the track past it is `
          + 'range, not headroom. ',
        );
      }
      if (outCount === 0) {
        hint.append(`Everything selected fit. Headroom ${num(headroom)} tokens.`);
      } else if (isIndex) {
        // The one figure no endpoint serves, said rather than drawn at a width
        // nobody computed.
        hint.append(`Headroom ${num(headroom)}. ${outCount} index lines did not fit; `
          + 'per-line index costs are exposed by no endpoint, so the ghost lane cannot size them.');
      } else {
        const smallest = Math.min(...spilled.map((spill) => spill.tokens));
        hint.append(
          `Headroom ${num(headroom)}. `,
          el('b', null, `the smallest thing that did not fit costs ${num(smallest)}`),
          ' — so the headroom is not usable by anything currently selected.',
        );
      }
      ribbon.append(label, track, ghosts, hint);
      host.append(ribbon);
    }
  }

  evsel.onchange = () => { PICKED.event = evsel.value; void show(); };
  // The question strip is repainted BEFORE the refetch, because the warm option
  // is labelled with the session id itself: a shell that moved to another
  // session and left this strip naming the old one would be captioning the new
  // answer with the old question.
  dropSessionListener = ctx.onSessionChange(() => { paintQ(); void show(); });
  paintQ();
  await show();
}
