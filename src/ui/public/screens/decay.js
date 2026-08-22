/**
 * `nav.ev` — **Decay**, `<section data-p="decay">` in the design of record.
 *
 * **This screen is two graphical views and nothing else, and NEITHER can be
 * served by this repository today.** It is therefore drawn as its own frames —
 * the heading, the measurement note, and each card's own explanation of what
 * it measures — with no marks in it. The instruction for this case is
 * explicit and is the same one `preview.js` already obeys twice: *"Where a
 * view cannot be drawn, stop and ask; do not draw a weaker one."* Both are
 * escalated in this task's report rather than approximated here.
 *
 * ── 1 · THE RECENCY COMB (`#comb`, `dec.comb`) — the axis is not served ───
 *
 * The comb plots ONE TOOTH PER ITEM at *sessions since last injection*, on a
 * log axis running out to sixty, with a terminal bucket for "never". Its
 * classification is fully served — `/api/decay` returns `report.cold`,
 * `report.warm` and `report.unrestricted`, `DecayRow.always` carries the
 * pinned half of `dec.badpin` and `DecayRow.useCount === 0` is "never". **What
 * is not served is the ordinal the axis is made of.** `DecayReport` gives a
 * BINARY split at `window` plus a `lastUsed` TIMESTAMP; the axis wants a count
 * IN SESSIONS, past the window. The endpoint says so itself, and corrects the
 * plan's own survey while it does:
 * `ui/read-model.ts` · `Needs: `sessionsAgo: number | null` per row, computed where the ordering lives` · ~933.
 *
 * Three routes to derive it were checked, and all three are closed:
 *
 *   - **From `series`.** `/api/decay`'s `series` is `Ledger.history()`, whose
 *     docstring forbids this use by name — *"It is NOT the decay chart's
 *     source, and must not be made one"*
 *     (`core/ledger.ts` · `Decay is measured in SESSIONS rather than against a clock, and is served` · ~458).
 *     Ordering items by session would also mean re-deriving `recentSessions`'
 *     `MAX(injected_at) DESC, session_id DESC` in the browser, over every row
 *     the ledger holds — the copied-rule defect §0.3 row 14 objects to.
 *   - **From `/api/sessions`.** Its window is twenty
 *     (`ui/read-model.ts` · `export const SESSIONS_LIMIT = 20;` · ~483), and
 *     the comb's axis runs to sixty. An ordered list that stops at twenty
 *     cannot place a tooth at fifty.
 *   - **From repeated `?window=N` calls.** Asking at 1, 5, 20 and 50 would
 *     bucket every item against the mockup's own tick marks — and the view's
 *     title is *"Recency comb — one tooth per item, **never bucketed**"*
 *     (`dec.comb`). The one derivation available is the one the view forbids.
 *
 * A tooth-per-item list with no axis is not a weaker comb; it is a table, and
 * `dec.v` is *"a chart, not a table — of sessions"*.
 *
 * ── 2 · THE 90-DAY HEATSTRIP (`#heat`, `dec.heat`) — no endpoint at all ───
 *
 * Already refused by the plan (§0.3 row 8, §0.4) and re-refused here. Its
 * source is stated on screen by the design of record itself, in `dec.heatn`:
 * *"Its source is not the ledger, which records deliveries only: it is
 * `audit_item.role` joined to `audit.at`, both indexed, with the `since` /
 * `until` filters that already ship."* No route in any of the three web-UI
 * plans serves that projection. And approximating it from the ledger asserts
 * the OPPOSITE of what the view exists to show: the ledger records deliveries
 * only, so every spill day would come back unhatched, and *"a hatched cell is
 * a day the item was spilled"* is the whole distinction the strip is for.
 *
 * ── WHAT IS DRAWN, AND WHY IT IS THE FRAMES AND NOT AN EMPTY SCREEN ───────
 *
 * `dec.sub` names *"the second card"* in its own last sentence, so a decay
 * screen with no cards contradicts its own subtitle. Each card therefore keeps
 * its heading and the mockup's own note about what it measures — `dec.heatn`
 * states the heatstrip's missing source on screen, which is the refusal's own
 * reason drawn from the design of record with no key invented for it.
 *
 * What is NOT drawn: the two `.plate` hosts, obviously; the comb's legend,
 * which names marks (`dec.warm`, `dec.cold`, `dec.never`, `dec.badpin`,
 * `dec.unres`) that are not on screen to be named; and `#deccaveat`, which the
 * mockup builds in script behind a `HEB ? … : …` ternary and therefore keys in
 * neither string table — the same defect the mockup records having fixed in
 * its own provenance bar and git strip. That caveat is a third open question:
 * it is the sentence that tells a reader "cold" means twenty sessions rather
 * than twenty days, and no key can carry it today.
 *
 * **Nothing is fetched.** A screen that draws no data has no business asking
 * for any; `/api/decay` is called by nothing here rather than called and
 * discarded.
 */
import { el, screenHead } from '/screens/parts.js';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'dec.h', 'dec.v', 'dec.sub');

  // Card 1 — the recency comb's frame, and the caveat about what "cold" means
  // that the mockup hangs inside it. `<details class="help"><summary>…` is the
  // mockup's own disclosure widget, used on four screens.
  const comb = el('div', 'card pane');
  const combHead = el('h3');
  combHead.append(...ctx.t('dec.comb'));
  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.whyCold'));
  const helpBox = el('div', 'helpbox');
  helpBox.append(...ctx.t('dec.help'));
  help.append(summary, helpBox);
  comb.append(combHead, help);

  // Card 2 — the heatstrip's frame. `dec.heatn` is the note the mockup already
  // draws under it, and it happens to name the projection this build cannot
  // read, which is why it is worth keeping when the strip itself is not there.
  const heat = el('div', 'card pane');
  const heatHead = el('h3');
  heatHead.append(...ctx.t('dec.heat'));
  const heatNote = el('p', 'small');
  heatNote.append(...ctx.t('dec.heatn'));
  heat.append(heatHead, heatNote);

  root.append(comb, heat);
}
