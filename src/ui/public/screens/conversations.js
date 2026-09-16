// The conversation archive — a list of sessions, then ONE SCROLLABLE DOCUMENT
// over the whole of one — `plan:archive seq:3` for the list, and `seq:7`,
// `seq:8` and `seq:13` for the document, which are one surface and were built
// together.
//
// ── WHAT THE OWNER SAW, AND WHY THE TRANSCRIPT HALF WAS REPLACED ──────────
//
// He opened his own session and the screen drew "Showing entries 0–50 of
// 24,757" with NO WAY TO REACH ENTRY 51: the fetch below used to be
// `?limit=50&offset=0`, hard-coded, and no next control existed. The endpoint
// accepted an `offset` this screen never sent. Worse, the fifty it did draw
// were almost all book-keeping — 1 prompt, 0 answers, 49 folded "0 characters"
// rows.
//
// `seq:7` rules out the obvious repair in the owner's own words: "view the
// session on a SEQUENTIAL DOCUMENT with markers for prompts and answers AND
// NOT BROKEN TO PIECES — user should have a similar experience like SCROLLING
// OVER A TERMINAL." A pager is not that, and the design of record already said
// "page OR VIRTUALISE" while only the paging half was attempted. So what is
// below is a VIRTUALISED SCROLL: one document over the whole session, with
// only what is on screen in the DOM.
//
// ── THE THREE ITEMS, AND WHERE EACH ONE IS ────────────────────────────────
//
//   `seq:13` — THE SKELETON. A heading per turn naming the speaker, the
//              timestamp beneath it, and the machinery folded into one
//              summarised line. `drawTurn` and `drawWork` below.
//   `seq:8`  — THE CELL CONTENT. What the terminal showed, with its
//              formatting and colour: Markdown through `lib/markdown.js`,
//              escape sequences through `lib/ansi.js`. `saidBody` and
//              `termBody` below.
//   `seq:7`  — THE ONE SCROLL. `mountDocument` below, and the arithmetic in
//              `Scroller`.
//   `seq:15` — THE LANE, OPENED FROM THE TURN THAT DISPATCHED IT. `laneIndex`
//              and `laneLink` below, and the link is drawn on the step in
//              `drawWork`. A new tab, because the return the item asks for is
//              then not restored but never lost — `laneLink`'s own header
//              carries the whole argument and what it rejects.
//
// ── WHY IT IS NOT DRAWN IN A CARD ─────────────────────────────────────────
//
// Owner ruling, carried by `seq:8`: "DO NOT USE THE CSS STYLE OF THE APP
// CARDS, it should not be limiting you — you can use the cards to EMBED IN
// THEM components." The item calls that "a RELEASE, NOT A BAN".
//
// Taken literally: the LIST still draws in `.card pane`, because a list of
// sessions is an ordinary thing this app already knows how to draw. The
// DOCUMENT does not. It gets `.tvroot` and a stylesheet block of its own that
// shares no rule with `.card`, `.plate`, `.row` or `.convrec` — it is a
// terminal, and it is supposed to look like one and unlike the rest of the
// app. Nobody should correct it for that.
//
// ── EVERY MEASUREMENT BELOW IS FROM THE OWNER'S OWN TRANSCRIPT ────────────
//
// 2026-09-08, 63,871,429 bytes: 27,813 records, which this document renders as
// 4,916 nodes — 2,456 turns somebody took and 2,460 folded runs of machinery.
// The outline costs one 358 ms walk; every scroll after it costs 2 ms.

import {
  BOUND_CAP_LIST, boundedList, el, errorNote, glyphed, mono, screenHead, spaced,
  zonedStampOf,
} from './parts.js';
import { estimateHeight, matchesNode, Scroller } from '../lib/transcript-scroll.js';
import { foldedMatches } from '../lib/fold.js';
import { helpDisclosure } from '../lib/disclosure.js';
import { LOOK_GAP_MS, attachLook, shouldPing } from '../lib/heartbeat.js';
import { markdownNodes } from '../lib/markdown.js';
import { ansiNodes, hasEscapes, stripEscapes } from '../lib/ansi.js';
import { formatBytes, readerZone, zonedZone } from '../lib/viewmodel.js';
import { composeCommand } from '../lib/command.js';
import { commandActions } from '../lib/command-actions.js';
import {
  PASSAGE_NODE_CAP, PASSAGE_RAW_CAP, messagePassage, runsOf,
} from '../lib/passage.js';

/**
 * The glyph that marks each of the three kinds. ONE table, so the list and the
 * document cannot drift into two vocabularies for one idea.
 *
 * It used to carry a chip class and a string key as well, because the paged
 * transcript drew a `.chip` per record. The document does not: a turn wears
 * `.tvmark` with its glyph beside a speaker HEADING, which is what
 * `seq:13`'s format asks for, and the chip vocabulary stayed where it belongs
 * — on the LIST, which is an ordinary list of sessions. What is left here is
 * the glyph, which both surfaces still share.
 *
 * The distinction is still carried by MORE than colour, which is the design's
 * own rule and this app's own reason: it is bilingual and themed, so a glyph
 * and a keyed word survive a monochrome print, a colour-blind reader and the
 * RTL flip where a hue alone would not.
 */
const KINDS = {
  prompt: { glyph: '▸' },
  answer: { glyph: '◆' },
  machinery: { glyph: '⚙' },
};

/**
 * A name, or the honest absence of one. Never a fabricated one.
 *
 * ── THREE SOURCES, AND THE HEADING SAYS WHICH — `plan:archive seq:34` ─────
 *
 * Until this, one field was drawn and it was always the harness's: the model's
 * own `ai-title`, marked; or a title set in Claude Code, unmarked; and nothing
 * anywhere could be the reader's. `seq:10`'s spec asked for the title to be
 * *"taken from the transcript's own `aiTitle` AND OVERRIDABLE"* and `seq:34`
 * recorded the missing half rather than leaving it silent.
 *
 * **`row.name` is drawn INSTEAD of the title and the title is drawn BESIDE
 * it.** Not merged into one field, which is the shape that created the
 * problem: a reader looking at a name has to be able to tell whose it is, and
 * the only way to tell is to be shown the other one. So a named session reads
 *
 *     the archive lane  (named here)  Claude Code calls it MyContext V2.0
 *
 * and an unnamed one is exactly what it was before this change, to the node.
 *
 * **It is the same function on the list and in the document head**, which is
 * what puts it on `/lane.html` too: `mountDocument` runs in the bare lane
 * window, and a lane's `name` is `null` by construction — names are keyed by
 * session and `mycontext conversation name` refuses a lane id — so a lane
 * window draws the line its dispatcher typed, unmarked, exactly as it did.
 */
function titleNodes(ctx, row) {
  const own = typeof row.name === 'string' && row.name !== '' ? row.name : null;
  if (own === null) {
    if (row.title === null) return ctx.t('conv.untitled');
    const borrowedOnly = [el('bdi', 'convtitle', row.title)];
    // The model wrote it, and the reader is told so rather than left to assume a
    // person did — the spec asks for the title to be shown as what it is.
    if (row.titleSource === 'ai') {
      const by = el('span', 'small');
      by.append(...ctx.t('conv.titleByModel'));
      // The separating space is a SIBLING of the span, not its first child. As a
      // first child it is at the start of an inline box and the browser collapses
      // it, which drew `archive(named by the model)` with no gap — seen in the
      // screenshot in both languages, after the strings had been checked.
      borrowedOnly.push(' ', by);
    }
    return borrowedOnly;
  }
  const wrap = [el('bdi', 'convtitle', own)];
  const mine = el('span', 'small');
  mine.append(...ctx.t('conv.titleByYou'));
  wrap.push(' ', mine);
  // **What the harness still calls it, drawn rather than dropped.** The one
  // rule this whole feature turns on is that Claude Code's record is reported
  // and never rewritten — so the moment we draw a name of our own, the
  // borrowed one has to stay visible or the screen has quietly replaced a fact
  // it does not own. `{title}` is a value slot, so it is bidi-isolated and is
  // text rather than markup, in a corpus that is half Hebrew.
  const borrowed = el('span', 'small');
  if (row.title === null) borrowed.append(...ctx.t('conv.borrowedNone'));
  else {
    borrowed.append(...ctx.t(
      row.titleSource === 'ai' ? 'conv.borrowedByModel' : 'conv.borrowed',
      { title: row.title },
    ));
  }
  wrap.push(' · ', borrowed);
  return wrap;
}

/**
 * **How long a session lasted, in at most two units** — `plan:archive seq:10`,
 * whose spec clause names duration among the list's columns.
 *
 * The range is the whole design problem and it was measured before this was
 * written: the two sessions indexed in this workspace on 2026-09-09 are
 * **84.553 seconds** and **6 days 21 minutes**. A milliseconds field is
 * unreadable for the second and a "days" field is a zero for the first, so the
 * unit is chosen from the value and a second unit is added only when it
 * carries information — the six-day session draws `6d`, because its 21 extra
 * minutes round to a zero hour and a unit that says nothing is not shown.
 *
 * Two units and never three, which is the same judgement `formatBytes`
 * (`lib/viewmodel.js`, lifted out of this file on 2026-09-09 so the status
 * strip could not spell one file's size a second way) makes with one decimal: `5d 23h` is a duration a person compares at a glance
 * and `5d 23h 41m 12s` is a number they have to read. Nothing is rounded away
 * silently — `durationMs` is in the body for anything that needs the exact
 * value, and the SCREEN is where the reading happens.
 *
 * Every unit is a keyed string, in both languages. A screen that assembled
 * `${n}d` in script would be permanently English on the Hebrew page, which is
 * the defect class `STD-a-screen-explains-itself-in-plain-words-and-depth-hides`
 * names in its last paragraph.
 */
function durationText(ctx, ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const unit = (key, n) => ctx.tFlat(key, { n });
  if (days > 0) {
    const rest = hours - days * 24;
    return rest === 0
      ? unit('conv.dur.d', days)
      : `${unit('conv.dur.d', days)} ${unit('conv.dur.h', rest)}`;
  }
  if (hours > 0) {
    const rest = minutes - hours * 60;
    return rest === 0
      ? unit('conv.dur.h', hours)
      : `${unit('conv.dur.h', hours)} ${unit('conv.dur.m', rest)}`;
  }
  if (minutes > 0) {
    const rest = seconds - minutes * 60;
    return rest === 0
      ? unit('conv.dur.m', minutes)
      : `${unit('conv.dur.m', minutes)} ${unit('conv.dur.s', rest)}`;
  }
  return unit('conv.dur.s', seconds);
}

/**
 * An ISO stamp as a date a person reads — **IN THE READER'S OWN CLOCK, AND
 * SAYING WHICH CLOCK THAT IS.**
 * `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`.
 *
 * What stood here was `iso.slice(0, 16).replace('T', ' ')`: the stored UTC
 * value, with its `Z` cut off by the slice. That is how the owner came to
 * report three hours of his session missing — 14:11 drawn where his own clock
 * said 17:11, and nothing on the screen to say the two were the same instant.
 * The whole defect fits in that one expression, which is why it is quoted
 * rather than described.
 *
 * The stored value does not move: the `<time>` element's `datetime` still
 * carries the raw UTC ISO the record holds, and so does the endpoint. Only the
 * DISPLAY is in the reader's zone. See `zonedStampOf` in `parts.js` for the
 * guard and `zonedStamp` in `lib/viewmodel.js` for the spelling and for why
 * the locale is pinned while the zone is not.
 *
 * Invalid or absent stays absent — a header with no `<time>`, never a stamp
 * that cannot say which clock it is on.
 */
function dayText(iso) {
  return zonedStampOf(iso, READER_ZONE);
}

/**
 * **THE ONE ZONE THIS SCREEN IS IN — read once, drawn with, and SENT** —
 * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`.
 *
 * `zonedStampOf(iso)` with no second argument already rendered in the reader's
 * zone, because `undefined` resolves to the runtime's. Naming that same value
 * changes nothing on the screen and everything about what can be PROVED: the
 * string passed to `filterQuery` as `tz` is character-for-character the string
 * the stamps beside the filter were formatted in. A filter asking about
 * `Asia/Jerusalem` while the column was drawn in "whatever the runtime says"
 * is two answers that agree today and are not required to.
 *
 * Read at module load rather than per row: a browser's zone does not change
 * under a mounted screen, and `zonedFormat`'s cache is keyed by exactly this
 * string.
 */
const READER_ZONE = readerZone();

/* ══ THE LIST ══════════════════════════════════════════════════════════════ */

/**
 * One session's row on the list — **A CONTAINER WITH TWO CONTROLS IN IT, AND
 * NOT A BUTTON, SINCE `plan:archive seq:53`.**
 *
 * ── WHAT WAS WRONG, AND WHY IT WAS NOT A STYLESHEET'S PROBLEM ────────────
 *
 * The row said "2 helper agents" and the number was not a link. `seq:41` made
 * that count a control in the DOCUMENT and wrote down, in its own docblock,
 * why it could not do the same here: *"an `<a>` or a second `<button>` nested
 * inside a `<button>` is invalid markup that browsers un-nest"*. `seq:47` was
 * then asked to write `.convrowwrap`/`.convlanelink` and correctly refused,
 * because a rule nothing wears is dead CSS. Both were right, and both point at
 * the same repair: **the ROW CONTROL had to change**, and that is what this is.
 *
 * ── THE SHAPE, AND WHY THIS ONE ──────────────────────────────────────────
 *
 *   `div.row.convrow.convrowwrap`   the row. Not focusable, no click handler.
 *     `button.convhead.convrowopen` opens the session. Its `::after` is
 *                                   stretched over the WHOLE row, so the
 *                                   whole-row target is unchanged.
 *     `p.convmeta`  … `a.convlanelink` … the roster of this session's lanes.
 *     `p.small`     the chips.
 *
 * **The two controls are SIBLINGS, not one inside the other**, which is the
 * whole reason this shape was chosen over "a div with a click handler that
 * checks what was pressed". A click on the count cannot also fire the row
 * because the count is not inside the row's control — there is no propagation
 * to stop and therefore no `stopPropagation` to get wrong. `e2e/
 * conversations.spec.ts` asserts both halves anyway (`a click on the lane
 * count opens the roster and does NOT open the session`), because a structural
 * argument that is never executed is a comment.
 *
 * **The whole row is still the target.** `.convrowopen::after` is an inset
 * overlay over the row's padding box and its border, so every pixel a reader
 * could press before still opens the session — the areas either side of the
 * count included. The count sits above that overlay (`position:relative`) and
 * is the only hole in it.
 *
 * **A `<button>` and not a `<div role="button">`**: the control keeps Enter,
 * Space, the browser's own focus and the one accessible name a reader needs.
 * The focus RING moves to the wrapper (`.convrowwrap:has(…:focus-visible)`) so
 * a keyboard reader still sees the whole row light up, which is what the ring
 * meant before this change.
 *
 * **Tab order is the row, then the count**, by DOM order and by nothing else:
 * the button is the row's first child and the count is inside the second. A
 * row that dispatched no lanes is one tab stop, exactly as it was.
 *
 * **The accessible NAME of the row control narrowed, deliberately.** It used
 * to be every word on the row — title, counts, duration, branch, size and
 * every chip — read out as one button label. It is now the title. The rest is
 * still text in the row and still read; what it is not any more is a
 * two-hundred-character button name.
 */
function drawRow(ctx, row, open) {
  const wrap = el('div', 'row convrow convrowwrap');

  // The control that opens the session. It wears `.convhead` because it IS the
  // head — one element rather than a button wrapped round a div.
  const head = el('button', 'convhead convrowopen');
  head.type = 'button';
  head.append(...titleNodes(ctx, row));
  wrap.append(head);

  const meta = el('p', 'small convmeta');
  const day = dayText(row.endedAt);
  if (day !== null) meta.append(mono(day), ' · ');
  meta.append(...ctx.t('conv.counts', {
    prompts: row.prompts, answers: row.answers, machinery: row.machinery,
  }));
  // **The lanes this session dispatched** (`plan:archive seq:12`).
  //
  // On the counts line and not as a chip, because it is the same KIND of fact
  // as the three beside it — how much of this session there is to read — and
  // not a warning about the row. The chips below are all conditions a reader
  // should worry about; this one is not.
  //
  // Drawn only when there are some. A session that dispatched no lanes is the
  // ordinary case and `0 subagents` on every such row would be noise, which is
  // the one place this differs from the measured-zero rule: that rule governs
  // an EMPTY LIST, where silence would be indistinguishable from a check that
  // never ran, and here the counts beside it already prove the row was scanned.
  if (typeof row.subagents === 'number' && row.subagents > 0) {
    meta.append(' · ');
    // **AND IT IS THE WAY TO THE ROSTER** — `plan:archive seq:53`, which is the
    // half `seq:41` could not build. Until this, the count was a dead end on
    // every list row and the roster was two clicks away: open the session, then
    // press the count in its head.
    //
    // `rosterHref` and nothing else. It is the one place that knows a roster's
    // address, exactly as `laneHref` is the one place that knows a lane's, and
    // `button.tvlanes` in the document already spends it — a second spelling
    // here would be the defect `archive/48` existed to remove, one screen over.
    // The word is the same keyed string the document's control uses too, so the
    // two controls that go to the same place cannot come to say different
    // things in either language.
    //
    // **A real `<a>` with a real `href`, not a `<button>` calling `navigate`.**
    // `laneLink` records the reasoning and it holds here: middle-click, "open
    // in a new tab", "copy link address" and the keyboard all work by
    // construction and none of them is coded here. The document's own roster
    // control is a `<button>` only because it sits inside `.tvhead` where the
    // face is a jump's; nothing constrains this one, and the cheaper shape is
    // the better one.
    //
    // The same tab, like the document's control and unlike `laneLink`'s
    // `target="_blank"`: `seq:15`'s new-tab ruling is about a virtualised
    // transcript whose scroll position cannot be recomputed. A roster is a page
    // of rows the browser's own Back restores.
    const roster = el('a', 'convlanelink');
    roster.href = rosterHref(row.sessionId);
    roster.append(...ctx.t(row.subagents === 1 ? 'conv.lane' : 'conv.lanes', {
      n: row.subagents,
    }));
    meta.append(roster);
    // **AND HOW MANY OF THEM CAN STILL BE OPENED** — `plan:archive seq:35`,
    // which built `openableSubagents` and could not draw it because this file
    // was held by another lane at the time.
    //
    // The count above is true of the RECORDING and can be false of what the
    // archive holds: a session kept by the mirror keeps its lane rows for ever
    // (`removeMissingSubagents` is scoped to sessions found on disk), so a row
    // can advertise lanes that nothing can open. `bytes`/`fileBytes` on this
    // same row already have this shape — what was recorded, and what is there
    // now — and a surface carrying only the second could not say that anything
    // had gone missing.
    //
    // Drawn ONLY when the two disagree, and that is not the measured-zero rule
    // being bent: the clause beside it is the measurement, and "268 helper
    // agents · 268 still on disk" on every ordinary row would be a number
    // repeated to say nothing. When they disagree the second number IS the
    // finding, and `0 still on disk` is drawn in full for exactly that reason.
    if (typeof row.openableSubagents === 'number'
      && row.openableSubagents < row.subagents) {
      meta.append(' · ');
      meta.append(...ctx.t('conv.lanesOpenable', { n: row.openableSubagents }));
    }
  }
  // **How long it lasted** (`plan:archive seq:10`). On the counts line for the
  // lane count's own reason: it is another measure of how much session there
  // is, not a warning about the row.
  //
  // `tookFloor` rather than `took` when the file has grown past the scan or the
  // scan hit its cap. The number is the same; what changes is the claim made
  // about it, and a session still being written has an end time that is only
  // the last record READ. No new chip and no second field says this — the row
  // already carries `Behind by` for the same fact, and this is that fact
  // reaching the one number a reader would otherwise take as final.
  if (typeof row.durationMs === 'number') {
    meta.append(' · ');
    const floor = row.staleBytes > 0 || row.scanTruncated === true;
    meta.append(...ctx.t(floor ? 'conv.tookFloor' : 'conv.took', {
      d: durationText(ctx, row.durationMs),
    }));
  }
  if (row.branch !== null) {
    meta.append(' · ');
    meta.append(mono(row.branch));
  }
  meta.append(' · ', mono(formatBytes(row.bytes)));
  // **Why this row is in a filtered answer.** Drawn only when a search term
  // matched LANES, because that is the only case a reader cannot see for
  // themselves: a session matched by its own title has the title right there,
  // and one matched by its lanes looks, without this, like a row that should
  // not be on the list.
  //
  // `0` is deliberately not drawn. It is a real measured zero — searched, and
  // none of this session's lanes matched — but it is the ordinary case for a
  // row that matched by title, and the sentence "matched in 0 helper agents"
  // on such a row would read as a contradiction of the row's own presence.
  if (typeof row.matchedLanes === 'number' && row.matchedLanes > 0) {
    meta.append(' · ');
    meta.append(...ctx.t(
      row.matchedLanes === 1 ? 'conv.laneMatch1' : 'conv.laneMatch',
      { n: row.matchedLanes },
    ));
  }
  wrap.append(meta);

  const marks = el('p', 'small');
  // ── A COPY IS MARKED WHEREVER IT APPEARS, AND THE MARK SAYS WHICH KIND —
  //    `plan:archive seq:4`/`seq:5` ──────────────────────────────────────────
  //
  // The owner asked for a live session and a copy never to be confused, and
  // `source` is a column for that reason. It carries THREE values and they are
  // three answers to one question — which file this row was read from — so one
  // chip serves them and the WORD is what differs:
  //
  //   `'live'`      nothing drawn. It is the ordinary case.
  //   `'persisted'` the transcript is still here AND a copy is kept beside it.
  //   `'exported'`  the transcript is gone; the copy is all there is.
  //
  // Until 2026-09-09 this line read `row.source !== 'live'` and could not fire:
  // `'live'` was hard-coded in `conversation-index.ts` and `'exported'` was
  // reserved for these two items, so three separate lanes reported the chip as
  // dead-but-not-wrong. The value is now written, and the predicate names the
  // two values it means rather than every value that is not `'live'` — the
  // third, `'subagent'`, belongs to a row this list never carries and a
  // negation would have quietly adopted it.
  if (row.source === 'persisted' || row.source === 'exported') {
    const chip = el('span', 'chip carry glyphed');
    chip.dataset.g = '⎘';
    chip.append(...ctx.t(row.source === 'exported' ? 'conv.exported' : 'conv.persisted'));
    marks.append(chip, ' ');
  }
  // **PERSISTED AND CURRENT versus PERSISTED AND BEHIND, which `seq:5` requires
  // never to blur.** `keptBytes` is what the copy holds and `fileBytes` is what
  // the transcript holds right now, from the same `stat` that answered
  // `present` — so the difference is measured rather than assumed, and a copy
  // that is a turn behind says so instead of looking finished.
  //
  // A stopped copy takes precedence over a behind one, because "behind by
  // 4 KB" invites waiting for the next turn and a stopped copy will never
  // catch up. `INV-nothing-is-dropped-silently`.
  if (typeof row.keptNote === 'string' && row.keptNote !== '') {
    const chip = el('span', 'chip warn');
    chip.append(...ctx.t('conv.keptStopped'));
    chip.title = row.keptNote;
    marks.append(chip, ' ');
  } else if (row.source === 'persisted' && typeof row.keptBytes === 'number'
    && typeof row.fileBytes === 'number' && row.fileBytes > row.keptBytes) {
    const chip = el('span', 'chip warn');
    chip.append(...ctx.t('conv.keptBehind', { bytes: formatBytes(row.fileBytes - row.keptBytes) }));
    marks.append(chip, ' ');
  }
  // ── A SESSION WHOSE TRANSCRIPT IS GONE, AND WHY THE CHIP SURVIVED A RULING
  //    THAT SAID TO DELETE IT — `plan:archive seq:11` ──────────────────────
  //
  // The spec said a pruned transcript should be a BROKEN ROW kept in the index.
  // The owner ruled against that on 2026-09-07: `removeMissing` stays, the list
  // shows only sessions that still exist, and the ruling records this chip and
  // its siblings as "DEAD CODE to remove rather than a state to make
  // reachable".
  //
  // **The write half of that ruling stands and is untouched.** No row is kept
  // for a session whose file is gone; the next rebuild drops it, exactly as he
  // decided.
  //
  // **The premise about THIS half was wrong, and it is measurable.** The state
  // is not unreachable. `removeMissing` runs during a REBUILD; the list is
  // served from the index between rebuilds, and `summarise` stats each file at
  // request time. Delete a transcript and load this screen before the next
  // assistant turn and the row is here with `present: false` —
  // `test/ui/conversations-endpoint.test.ts` · `a transcript deleted between
  // two rebuilds` builds exactly that and asserts it, so the claim is a test
  // rather than a paragraph. The window is one turn wide, not zero.
  //
  // So what would have been deleted is not dead code, it is the DISCLOSURE FOR
  // THAT WINDOW, and deleting it would have replaced a chip that says "this
  // file is gone" with a row that opens onto a document that cannot load —
  // `INV-nothing-is-dropped-silently` failing at the one moment it is about.
  // The chip stays, and what changes is what it CLAIMS: not "the archive keeps
  // pruned sessions", which the ruling reversed, but "this one is already gone
  // and will leave the list at the end of your next turn", which is what
  // `conv.missingSome` now says. The help text that took the deleting side —
  // "A session your machine has deleted is gone from here too" — is correct and
  // is kept; the contradiction the item found was real and this is the side of
  // it that had to move.
  if (row.present === false) {
    const chip = el('span', 'chip warn glyphed');
    // **`⦸` AND NOT `⃠`, WHICH IS WHAT THIS LINE SAID WHILE IT WAS DEAD
    // MARKUP.** `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds`
    // records the pruned chip's glyph as U+20E0 COMBINING ENCLOSING CIRCLE
    // BACKSLASH, and nobody ever saw it: `.chip.warn::before` overrode it, so
    // the chip drew `▲`. Rendered for the first time on 2026-09-08 it does what
    // a combining mark does with no base character — it swallows the trailing
    // space `content: attr(data-g) " "` supplies and lands ON the `F` of
    // `File deleted`, eating the chip's leading space. U+29B8 CIRCLED REVERSE
    // SOLIDUS draws the same picture as a standalone character and spaces
    // correctly; the two were rendered side by side before this was changed.
    chip.dataset.g = '⦸';
    chip.append(...ctx.t('conv.pruned'));
    marks.append(chip, ' ');
  }
  // The transcript has grown past the row. Drawn as a chip beside the pruned
  // and capped ones because it is the same KIND of fact — every number on this
  // row is what a scan saw and not what the file holds — and because a reader
  // scanning the list has to be able to tell WHICH session is behind, which an
  // aggregate line above the list cannot say.
  //
  // **NO `glyphed` AND NO `dataset.g`, unlike the two chips around it, and it
  // is a choice rather than an omission.** The three chips on this row used to
  // draw one `▲` between them because a colour class' glyph beat every
  // `data-g` a screen wrote — `.chip.warn::before` is a two-class rule and
  // `.chip::before{content:attr(data-g)}` is not
  // (`TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds`). The
  // other two now opt in to `glyphed` and wear `⃠` and `⋯`. This one keeps the
  // plain `▲`, because "the file has grown past what the scan read" is the
  // ordinary warning of the three and the one a reader can safely read as the
  // colour's own meaning. Three facts, three marks; the distinction the item
  // asked for is made by giving the two SPECIAL ones a glyph, not by inventing
  // a third symbol for the general case.
  if (row.staleBytes > 0) {
    const chip = el('span', 'chip warn');
    chip.append(...ctx.t('conv.behindRow', { bytes: formatBytes(row.staleBytes) }));
    marks.append(chip, ' ');
  }
  // The scan hit its cap, so every count above is a floor rather than a total.
  if (row.scanTruncated === true) {
    const chip = el('span', 'chip warn glyphed');
    chip.dataset.g = '⋯';
    chip.append(...ctx.t('conv.scanCapped'));
    marks.append(chip, ' ');
  }
  if (marks.childNodes.length > 0) wrap.append(marks);

  // **ON THE CONTROL, NEVER ON THE CONTAINER.** The listener used to be on the
  // row because the row was the button; putting it back on the container would
  // make every click inside the row — the roster link's included — open the
  // session, and the only way back would be a `stopPropagation` on the link.
  // The overlay above does the same job with no exception to get wrong.
  head.addEventListener('click', () => open(row.sessionId));
  return wrap;
}

function drawList(ctx, host, body, open) {
  // A screen that only spoke up when something was missing would leave a
  // reader unable to tell a complete archive from a check that had stopped
  // running, so the where-it-looked line is drawn either way.
  const where = el('p', 'small');
  where.append(...ctx.t('conv.lookedIn'), ' ');
  where.append(mono(body.dir));
  host.append(where);

  if (body.indexed === false) {
    // NOT an error and NOT an empty list — a third state, with the command
    // that changes it. Composed, never run: this server cannot write.
    //
    // **AND IT IS TWO STATES, NOT ONE** (`plan:archive seq:12`). `outdated`
    // means the index is a SCHEMA BEHIND rather than never scanned — full,
    // and momentarily unreadable. Telling a reader with a complete archive
    // that nothing has ever been scanned would be false, and it is the exact
    // false sentence the owner met on his own running server on 2026-09-08
    // when this table was added. That state repairs itself on the next
    // assistant turn, so it says so; the rebuild command is still drawn
    // beneath, because a reader who does not want to wait should not have to.
    const note = el('p', 'small');
    note.append(...ctx.t(body.outdated === true ? 'conv.outdated' : 'conv.neverScanned'));
    host.append(spaced(note));
    const cmd = el('p', 'plate convcmd');
    cmd.append(mono(body.rebuild));
    host.append(cmd);
    return;
  }

  if (body.total === 0) {
    // A MEASURED zero — the scan ran and found nothing — drawn with the one
    // `◌` primitive this product already uses for exactly this state, never a
    // second glyph invented here.
    //
    // **`glyphed` HERE IS TURNING A COINCIDENCE INTO A STATEMENT, and that is
    // the whole reason it is on a chip whose picture does not change.** This
    // chip drew the right `◌` before the fix and after it, but for two
    // different reasons: before, `.chip.unmeas::before` overrode the `data-g`
    // and happened to declare the same character; now the `data-g` is what
    // renders. The item names that agreement as accidental and says not to
    // preserve it by accident, so the chip asks for its own glyph like its
    // five siblings and stops depending on two rules agreeing.
    const zero = el('span', 'chip unmeas glyphed');
    zero.dataset.g = '◌';
    zero.append(...ctx.t('conv.none'));
    const line = el('p', 'small');
    line.append(zero);
    host.append(spaced(line));
    return;
  }

  // ── WHAT THE FILTER LEFT OUT, BEFORE ANYTHING ELSE IS SAID ───────────────
  //
  // `plan:archive seq:10`. A narrowed list that does not say it is narrowed is
  // a list a reader will read as the whole archive — the same failure as a
  // stale one that does not say it is stale, twenty lines below.
  //
  // Drawn only when something was actually asked for. On an unfiltered list
  // `matching === total` and the sentence would be a count of nothing.
  const filtered = body.filter !== undefined && (
    body.filter.q !== null || body.filter.branch !== null
    || body.filter.since !== null || body.filter.until !== null);
  if (filtered) {
    const summary = el('p', 'small');
    summary.append(...ctx.t('conv.matchedList', {
      n: body.matching, total: body.total,
    }));
    host.append(spaced(summary));
    // ── WHICH CLOCK THOSE DAYS WERE COUNTED IN ──────────────────────────────
    //
    // `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`, and it
    // is `seq:18`'s rule — never a zoned value without the name of the zone —
    // applied to a CONTROL rather than to a stamp.
    //
    // The rows already carry `GMT+3` on every date they draw, so on a list
    // with rows this repeats them. It is drawn anyway, because the one moment
    // a reader most needs it is the one where there are NO rows to read it
    // off: "I asked for my own Tuesday and got nothing" is the report this
    // whole item began as, and an empty answer that cannot say whose Tuesday
    // it looked for is the same silence one screen later.
    //
    // ANCHORED TO THE BOUND and not to now, for `zonedZone`'s stated reason: a
    // zone's name moves with its transitions, and naming January's `GMT+2`
    // over a July filter would be a small copy of the defect above. Noon UTC
    // on the bound's own day is inside that day in every real zone.
    const bound = body.filter.since ?? body.filter.until;
    if (bound !== null && bound !== undefined) {
      const label = zonedZone(new Date(`${bound}T12:00:00Z`), body.filter.tz ?? 'UTC');
      if (label !== null) {
        const clock = el('p', 'small');
        clock.append(...ctx.t('conv.datesIn'), ' ', mono(label), '.');
        host.append(clock);
      }
    }
    // Sessions a DATE could not place, named rather than merely absent.
    if (body.undated > 0) {
      const undated = el('p', 'small spill');
      undated.append(...ctx.t('conv.undated', { n: body.undated }));
      host.append(undated);
    }
    if (body.matching === 0) {
      const none = el('p', 'small');
      const chip = el('span', 'chip unmeas glyphed');
      chip.dataset.g = '◌';
      chip.append(...ctx.t('conv.noMatchList', { total: body.total }));
      none.append(chip);
      host.append(spaced(none));
      return;
    }
  }

  if (body.missing > 0) {
    const gone = el('p', 'small spill');
    gone.append(...ctx.t('conv.missingSome', { n: body.missing }));
    host.append(spaced(gone));
  }

  // ── HOW FAR BEHIND THIS LIST IS, DRAWN EITHER WAY ────────────────────────
  //
  // This is the line whose absence let the archive be over a day stale in
  // front of the owner without anything saying so: on 2026-09-08 the index
  // said his session ended 2026-09-07T00:50 while the file had been written
  // that minute and had grown 11,231,042 bytes past the row.
  //
  // It is drawn when the list is CURRENT as well as when it is behind, which
  // is the same rule and the same reason as the where-it-looked line twenty
  // lines above: a screen that only speaks up when something is wrong leaves a
  // reader unable to tell a fresh list from a check that has stopped running.
  // That is exactly the state this feature was in.
  //
  // Both numbers come from `stat`. `staleBytes` is the file's size now minus
  // the size the row was scanned at — the endpoint takes it from the same
  // `stat` that already answered `present`, so the disclosure costs no extra
  // syscall and, crucially, no rebuild. A read-only screen can say it is
  // behind; it cannot be the thing that fixes it.
  if (body.stale > 0) {
    const behind = el('p', 'small spill');
    behind.append(...ctx.t('conv.behind', {
      n: body.stale, bytes: formatBytes(body.staleBytes),
    }));
    host.append(spaced(behind));
    // WHO refreshes it, and the command a person can run instead of waiting —
    // the same composed-never-run shape the never-scanned state uses, because
    // this server writes nothing either way.
    const how = el('p', 'small');
    how.append(...ctx.t('conv.refreshedBy'));
    host.append(how);
    const cmd = el('p', 'plate convcmd');
    cmd.append(mono(body.rebuild));
    host.append(cmd);
  } else {
    const fresh = el('p', 'small');
    fresh.append(...ctx.t('conv.current'));
    host.append(spaced(fresh));
  }

  // `boundedList` calls `host.replaceChildren(...)` — it OWNS the element it
  // is given — so it gets a container of its own rather than the card, whose
  // heading and where-it-looked line would otherwise be wiped on every page
  // step. Found by driving the screen, not by reading the signature.
  /* ── THE LIST IS BOUNDED IN HEIGHT AS WELL AS IN ROWS ───────────────────
   *
   * `TASK-the-marks-card-sits-1-3-screens-below-the-fold-under-a`, owner
   * report 2026-09-15: he opened the viewer after a rebuild and could not find
   * his marks. All 1,156 were drawing correctly. He could not REACH the card.
   *
   * **MEASURED HERE, in this repository's own corpus, at 1280x1299** — the
   * viewport the item measured at, re-measured rather than quoted, because the
   * item's figures are a fortnight of data old and two of them have moved:
   *
   *     card                      item said        measured 2026-09-15
   *     Sessions                  188, h 1,302     188, h 1,339
   *     Search what was said      1,502, h 181     1,539, h 235
   *     Points you marked         1,695            1,786
   *
   * and the screen holds FIVE cards, not the three the item names — "Reconstruct
   * a subject" and "What has been asked before" sit below the marks card, at
   * 4,001 and 4,427.
   *
   * **AND THE FOLD IS NOT WHERE THE WINDOW ENDS.** `<body>` hides its own
   * overflow; the thing that scrolls is `main.body`, which at 1280x1299 starts
   * 46px down and is 1,116px tall — so the fold is at **1,162**, with a status
   * strip below it. The marks card began **624px** below that, and the screen
   * ran to 4,529px: four screens of scroll, under a session list taller than
   * the window. The first cap written for this was measured against 1,299 and
   * was 44px short; `.convlistscroll`'s own comment carries that table.
   *
   * **OPTION 4 OF THE ITEM'S FOUR, which is the one it recommends: cap the
   * list's height and let it scroll inside its own card.** Not option 2 (marks
   * first) — the item forbids it in as many words, because the session picker
   * is how a reader OPENS a conversation and that is the screen's other job,
   * and moving it down trades one complaint for its mirror image. Not option 1
   * (collapse past a few rows), which HIDES rows a reader scans; every row is
   * still here and still reachable, by a gesture inside the card rather than a
   * gesture that moves the page. Not option 3 (a jump link), which the item
   * calls thin and `D58` is about: it adds a control and moves nothing.
   *
   * **`.cardscroll` IS THE SHAPE THIS PROJECT ALREADY USES**, owner request
   * 2026-09-06 for the Tutorials roster — "do not scroll the title, only the
   * sections below it" — heading a sibling rather than a child, so it cannot
   * travel, and `overscroll-behavior:contain` so reaching the end does not
   * carry the page along underneath. The one thing added is the CAP: this card
   * takes `.convlistscroll` beside it, which is 64vh brought down to 30vh, for
   * the arithmetic written on that rule.
   *
   * **A SCROLLER A KEYBOARD CANNOT REACH IS A LIST A KEYBOARD CANNOT READ**, so
   * this takes `.tvscroll`'s own three attributes for `.tvscroll`'s own reason
   * — `tabIndex = 0` to be focusable without being a second tab stop's worth of
   * furniture, `role="region"` and a name, so the thing that now scrolls is a
   * thing a screen reader can find and announce.
   */
  const rows = el('div', 'rows cardscroll convlistscroll');
  rows.tabIndex = 0;
  rows.setAttribute('role', 'region');
  rows.setAttribute('aria-label', ctx.tFlat('conv.list.region'));
  host.append(rows);
  // **THE BOUND LINE IS PLACED, and for two weeks it was not.** `boundedList`
  // draws the rows into `rows` and RETURNS the line and the two step buttons
  // for the caller to place — `preview.js`, `work.js`, `packs.js`, `ask.js`
  // and `config.js` all append the return; this call discarded it. The result
  // was 20 session rows and no control of any kind: measured 2026-09-13 with
  // 31 sessions seeded, 20 rows drawn and ZERO `.bound` elements on the
  // screen.
  //
  // That is exactly the defect THIS FILE'S OWN HEADER opens with — "Showing
  // entries 0–50 of 24,757 with NO WAY TO REACH ENTRY 51" — reintroduced on
  // the half of the screen the rebuild did not touch, and it is what
  // `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`
  // forbids. A discarded return value is invisible in review and invisible in
  // a screenshot of the first page, which is why it survived.
  //
  // **`order: 'position'` and not `'recent'`, which is what stood here.**
  // `orderKeyFor` picks the bound line's sentence from `order` alone, and its
  // `recent` pair is written for `take: 'last'` — the append-order reading
  // every other `recent` caller passes (`injected.js`, `packs.js`,
  // `work.js`). This answer is the opposite: `/api/conversations` is
  // `ORDER BY ended_at DESC`, newest FIRST, so the head slice is correct and
  // `list.rowsRecent`'s "oldest first — the newest are last" would be a FALSE
  // sentence on page two. It was never seen because the bound line was never
  // placed. `position` claims nothing about order, which is the honest answer
  // while the shared part has no sentence for a head-take recent list, and
  // every row already carries its own date.
  host.append(boundedList(
    ctx, rows, body.conversations,
    (row) => drawRow(ctx, row, open),
    { cap: BOUND_CAP_LIST, order: 'position' },
  ));
}

/**
 * **ONE SETTLE, USED BY EVERY FIND BOX ON THIS SCREEN.**
 *
 * There are four: the list's filter, the archive search, the find over anchor
 * labels, and the document's own. Three of them hand-rolled the same six lines
 * — a `let timer = null`, a `clearTimeout`, a `setTimeout` — and the fourth
 * had no settle at all, which is the defect below. Writing a fifth copy to fix
 * the fourth would have been the shape this file argues against everywhere
 * else: one idea with several implementations, which drift.
 *
 *   `settle()`  the reader is still typing; run after the quiet gap.
 *   `now()`     the reader has finished deciding — a `<select>`, a date, the
 *               clear button. Cancels any pending settle and runs at once,
 *               because a deliberate act with nothing following it should not
 *               be made to wait.
 *   `cancel()`  drop what is pending and run nothing.
 */
function settler(ms, run) {
  let timer = null;
  const cancel = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  return {
    settle: () => { cancel(); timer = setTimeout(() => { timer = null; run(); }, ms); },
    now: () => { cancel(); run(); },
    cancel,
  };
}

/**
 * How long the box waits after the last keystroke before it asks the server.
 *
 * A request per character over a 200-row cap is work nobody reads: a person
 * typing `conversation` at an ordinary pace would fire twelve queries and act
 * on the twelfth. 250 ms is under the threshold at which a person notices a
 * pause and above the gap between two keystrokes, and every one of those
 * requests is a read of an index measured at 0.076 ms — so what this saves is
 * not the server's time but a screen redrawn twelve times under the reader's
 * hands.
 */
const FILTER_SETTLE_MS = 250;

/**
 * **The controls that narrow the list** — `plan:archive seq:10`, whose whole
 * complaint is that "drawList has no filter control at all".
 *
 * ── BUILT ONCE AND NEVER REDRAWN, WHICH IS NOT AN OPTIMISATION ────────────
 *
 * The results below are replaced on every answer; this bar is not. Rebuilding
 * an `<input>` a reader is typing into destroys its focus and its caret — the
 * screen would take the first letter and drop the rest — so the bar is created
 * before the first fetch and only the region under it is replaced.
 * `RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it` is why the
 * list refreshes with no button to press; keeping the caret is what makes that
 * refresh usable rather than hostile.
 *
 * ── THE BRANCH LIST IS A CHOICE, NOT A TYPED STRING ───────────────────────
 *
 * `body.branches` is every branch the ARCHIVE holds, served unnarrowed. A text
 * box would let a reader type `mian` and read the empty answer as "no sessions
 * on that branch"; a `<select>` cannot express a branch that does not exist.
 *
 * ── AND EVERY CONTROL CARRIES ITS OWN NAME ────────────────────────────────
 *
 * A placeholder is not an accessible name, which this file has already paid
 * for once on the document's own find box. Each control here is labelled by a
 * real `<label>` element, so the name is visible to a reader who can see it as
 * well as to one who cannot — four unlabelled boxes in a row are a puzzle
 * (`STD-a-screen-explains-itself-in-plain-words-and-depth-hides`).
 */
function filterBar(ctx, branches, state, onChange) {
  const bar = el('div', 'convfilter');
  bar.setAttribute('role', 'search');
  bar.setAttribute('aria-label', ctx.tFlat('conv.filter.region'));

  const field = (labelKey, control) => {
    const wrap = el('label', 'convfield');
    const name = el('span', 'convfieldname');
    name.append(...ctx.t(labelKey));
    wrap.append(name, control);
    return wrap;
  };

  const find = el('input', 'convfind');
  // `search` and not `text`: it is the type this control IS, and the browser
  // gives it a clear affordance for free rather than this screen drawing one.
  find.type = 'search';
  find.value = state.q ?? '';
  bar.append(field('conv.filter.find', find));

  const branch = el('select', 'convselect');
  const any = el('option');
  any.value = '';
  any.append(...ctx.t('conv.filter.anyBranch'));
  branch.append(any);
  for (const name of branches) {
    const option = el('option');
    option.value = name;
    option.textContent = name;
    if (state.branch === name) option.selected = true;
    branch.append(option);
  }
  bar.append(field('conv.filter.branch', branch));

  const since = el('input', 'convdate');
  since.type = 'date';
  since.value = state.since ?? '';
  bar.append(field('conv.filter.since', since));

  const until = el('input', 'convdate');
  until.type = 'date';
  until.value = state.until ?? '';
  bar.append(field('conv.filter.until', until));

  const clear = el('button', 'convclear');
  clear.type = 'button';
  clear.append(...ctx.t('conv.filter.clear'));
  bar.append(clear);

  // An empty string is "not asked for" HERE and a 400 at the endpoint, which
  // is not a disagreement: the endpoint refuses `?q=` because a caller who
  // sent it asked a question, and this screen simply never sends it.
  const read = () => ({
    q: find.value.trim() === '' ? null : find.value.trim(),
    branch: branch.value === '' ? null : branch.value,
    since: since.value === '' ? null : since.value,
    until: until.value === '' ? null : until.value,
  });

  const typing = settler(FILTER_SETTLE_MS, () => { onChange(read()); });
  // Typing settles; choosing does not. A `<select>` or a date picker is one
  // deliberate act with nothing following it, so waiting a quarter of a second
  // after it would be a delay bought for nothing.
  find.addEventListener('input', typing.settle);
  for (const control of [branch, since, until]) {
    control.addEventListener('change', typing.now);
  }
  clear.addEventListener('click', () => {
    find.value = '';
    branch.value = '';
    since.value = '';
    until.value = '';
    typing.now();
  });

  return bar;
}

/**
 * The query string for one filter state. Absent keys are absent, never empty.
 *
 * **`tz` rides with the DATES and only with them** —
 * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`. A bound is
 * a day, and a day is a day only in some clock; the endpoint reads one in UTC
 * when nobody says otherwise, and this screen is the party that knows
 * otherwise. It is omitted when no bound is set for the reason every other key
 * here is: a parameter that changes no answer is noise in a URL a reader may
 * copy, and it would put a zone into the request an unfiltered list has no
 * opinion about.
 */
function filterQuery(state) {
  const params = new URLSearchParams();
  if (state.q !== null) params.set('q', state.q);
  if (state.branch !== null) params.set('branch', state.branch);
  if (state.since !== null) params.set('since', state.since);
  if (state.until !== null) params.set('until', state.until);
  if (state.since !== null || state.until !== null) params.set('tz', READER_ZONE);
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}


/* ══ SEARCH WHAT WAS SAID — `plan:recall seq:1`, Tasks 2, 4 and 5 ═════════ */

/**
 * **The second box on this screen, and it is a different question from the
 * first.**
 *
 * `filterBar` above narrows the LIST of sessions by what their rows hold — the
 * name, the title, the branch, the id, the lanes' briefs — and
 * `conv.searchScope` says so out loud because a search box that quietly
 * searched less than a reader assumed is how a real match gets read as an
 * absence. This one reads the WORDS, through `/api/conversations/search` and
 * the FTS5 index behind it, over every session and every helper agent at once.
 *
 * Both are drawn, and neither replaces the other, because they answer
 * different questions and a reader holding one of them in mind would be badly
 * served by the other silently taking over.
 *
 * ── WHAT THIS CARD DOES, AND WHAT IT USED TO ONLY DESCRIBE ───────────────
 *
 * **It marks the point itself** — owner ruling 2026-09-12,
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`. What stood
 * here said this card "may not mark an anchor", composed
 * `mycontext conversation anchor …` from the server's own argv, and offered it
 * for a person to copy into a terminal. That was a limitation being disclosed
 * rather than a design, and he ruled on it in as many words: *"a composed
 * command the reader must copy into a terminal is NOT the UI having the
 * capability — it is the UI describing one."*
 *
 * So `markRow` writes, through `POST /api/conversations/anchors/mark`. The
 * server-composed argv is gone from this path, and with it the reason it
 * existed: there is no second composer to disagree with, because nothing is
 * composed. `src/ui/anchor-write.ts` carries the four properties that bound
 * the write and `test/ui/no-writes.test.ts` names the three bindings.
 */
const ARCH_SETTLE_MS = 250;

/**
 * The anchor kinds this build has a word for, in both languages.
 *
 * A SET rather than a lookup that falls back, because `t()` throws on a key it
 * does not hold: asking it and catching would be a render that survives by
 * exception handling, and this way the fallback is the ordinary path for a
 * kind written by a later build.
 */
/* EXPORTED so the vocabulary gate can read all NINE rather than only the six
 * a person may choose. `test/ui/anchor-kind-vocabulary.test.ts` held
 * `OWNER_KIND_CHOICES` to the core's list and to both string tables, and
 * `ruling`, `table` and `report` — the kinds the AUTOMATIC pass writes —
 * were in none of its assertions. "a ruling you gave" survived in the table
 * for exactly that long. */
export const ANCHOR_KIND_KEYS = new Set([
  'note', 'table', 'report', 'ruling',
  'decision', 'question', 'defect', 'evidence', 'todo',
]);

/**
 * **THE KINDS HE MAY CHOOSE, IN THE ORDER THE FORM OFFERS THEM** —
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`, owner
 * ruling 2026-09-15. `note` first because it is what every hand-made anchor in
 * this workspace already carries.
 *
 * **IT IS A COPY OF `OWNER_ANCHOR_KINDS` AND THE COPY IS THE PROBLEM, SO IT
 * IS MEASURED.** `src/core/anchors.ts` is TypeScript executed by Node; this
 * file is an ES module a BROWSER loads with no build step
 * (`CONST-node-24-no-build-step`), so it cannot import from there and there is
 * no third place that both can read. What holds the two in step is
 * `test/ui/anchor-kind-vocabulary.test.ts`, which imports both and asserts set
 * equality — and also that each member has a word in BOTH string tables,
 * because a kind offered in a `<select>` with no translation would draw its
 * raw id to a Hebrew reader. That is the same bargain `TIP_MS` and
 * `conv.doc.follows` already make, named where the copy is rather than left
 * to memory.
 *
 * The API is the second guard and the harder one: `apiAnchorMark` checks the
 * kind against `OWNER_ANCHOR_KINDS` itself and answers 400 naming the list, so
 * a drift here is refused by the server rather than written.
 */
export const OWNER_KIND_CHOICES = [
  'note', 'decision', 'question', 'defect', 'evidence', 'todo',
];

/**
 * ── THE GLYPH EACH ANCHOR KIND WEARS ───────────────────────────────────────
 *
 * `TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every`, owner
 * instruction 2026-09-13, and this is the case he asked about. The design of
 * record is the glyph survey in
 * `reports/2026-09-13-the-ui-reviewed-round-two.md`; these four are its table.
 *
 * **Why this list and not another surface.** A marked point carries SIX facts
 * in one line of words and, until this, not one glyph: the session name as the
 * link, the kind, who marked it, the stamp, the lane where there is one, and
 * the byte. Nothing on that row was scannable — a reader told two kinds apart
 * by reading. It is a CLOSED four-member set, repeated across a list measured
 * at 684 rows, which is the strongest case in the product for a glyph and the
 * exact shape the survey's rule admits: members of a closed set, told apart at
 * a glance, repeatedly, in a dense list.
 *
 *   U+1F4CC  note    a pin — the one a person placed by hand, and the only
 *                    kind the sweep will never touch.
 *   U+25A6   table   tabular data. **Deliberately not the bar-chart emoji**:
 *                    that reads as "chart", and Decay is this app's chart
 *                    screen. A geometric mark sits on the text baseline and
 *                    needs no colour font. Keeping `table` and `chart` apart
 *                    matters more than a uniform emoji style.
 *   U+1F4C4  report  a document.
 *   U+2696   ruling  scales — a judgement, and the kind carrying most weight.
 *
 * **Written as escapes, not as pasted emoji**, so that a codepoint cannot be
 * silently changed by an editor normalising a variation selector — the
 * difference between U+2696 and U+2696 U+FE0F is text presentation against
 * emoji presentation, and it is invisible in a diff.
 *
 * **A kind this build has no word for gets NO glyph**, for the same reason the
 * word falls back to the raw string one function below: there is no mark for
 * "unknown", and inventing one would be a second meaning for a glyph nobody
 * could look up. The row is still complete — it carries the kind as itself.
 */
/**
 * **FIVE MORE, because the owner may now choose them** —
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`. The set
 * stopped being closed at four the moment `OWNER_ANCHOR_KINDS` shipped, and a
 * kind he can pick from a list that drew no mark beside it would be the one
 * member of a dense list nobody could scan for.
 *
 *   U+2611   decision  a ticked box — the thing was settled. TEXT presentation
 *                      and no variation selector, for `table`'s stated reason
 *                      one entry up: a geometric mark sits on the text
 *                      baseline and needs no colour font.
 *   U+2610   todo      the EMPTY box, which is `decision`'s own mark before
 *                      anybody ticked it. The pair is the whole reason these
 *                      two are legible at a glance beside each other, and it
 *                      is why neither of them is an emoji.
 *   U+2753   question  the ornament, and **deliberately not a bare `?`**: an
 *                      ASCII question mark inside a label cannot be told from
 *                      the label's own punctuation.
 *   U+1F41E  defect    a bug. **NOT U+26A0**, which this app already means
 *                      "warning" with on Doctor and in the shell —
 *                      `test/ui/glyph-set.test.ts` records that one English
 *                      word is already answered by two marks and rules a
 *                      SECOND such clash a defect. So it is not made.
 *   U+1F50E  evidence  a glass — something looked at closely, and kept so it
 *                      can be looked at again.
 */
const ANCHOR_KIND_GLYPH = {
  note: '\u{1F4CC}',
  table: '\u25A6',
  report: '\u{1F4C4}',
  ruling: '\u2696\uFE0F',
  decision: '\u2611',
  question: '\u2753',
  defect: '\u{1F41E}',
  evidence: '\u{1F50E}',
  todo: '\u2610',
};

/**
 * \u2500\u2500 WHAT A MARK IS FOR, IN COLOUR \u2014 THREE GROUPS AND THE UNGROUPED NOTE \u2500\u2500\u2500\u2500
 *
 * `TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds`, owner
 * request 2026-09-15: *"let's have the different anchores types different
 * marking color or emoji or text (a combination is fine) to fast observe
 * between them."*
 *
 * Half of it already existed \u2014 every kind has a glyph above and a word in both
 * tables. What did not was COLOUR: `.convanchorkind` and `.tvanchorkind` were
 * both `color:var(--dim)`, one grey for all nine, on the row and in the
 * document alike. It matters HERE more than it would elsewhere because his
 * archive is 1,155 marks and 779 of them are tables \u2014 67% \u2014 so the list is
 * two-thirds one kind in one colour and the rare kinds he hunts are needles in
 * a grey haystack.
 *
 * \u2500\u2500 THE SENTENCE A READER CAN STATE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *
 * **Colour says what a mark is FOR: gold, a judgement that was made; orange,
 * something still owed; blue, material the conversation produced \u2014 and a plain
 * note keeps the standing grey, because it claims nothing beyond "here".**
 *
 *   `--gold`   SETTLED   ruling, decision. Something was decided.
 *   `--warn`   OWED      defect, question, todo. Something is outstanding \u2014 a
 *                        fix, an answer, an act. Three different debts, one
 *                        posture, and the glyph says which debt.
 *   `--carry`  FOUND     table, report, evidence. Material the conversation
 *                        produced or dug up. This is the 67%, and putting the
 *                        bulk on ONE hue is the point: a list that is mostly
 *                        one colour lets the two that are not jump out.
 *   (none)     note      the unqualified mark. It keeps `--dim`.
 *
 * \u2500\u2500 WHY THREE HUES AND NOT FIVE, WHICH IS THE BUDGET \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` fixes the
 * palette at gold / ok / carry / crit / warn and forbids a sixth. Nine kinds do
 * not get nine colours; the question is only which of the five are spent.
 *
 * **`--crit` IS NOT AVAILABLE HERE, AND THAT IS A MEASUREMENT RATHER THAN A
 * PREFERENCE.** Red is the obvious colour for a defect. Measured 2026-09-15 in
 * a browser, as 12px text on the ground this card actually paints \u2014
 * `rgb(10, 41, 50)`, the lightest flat fill inside the marks card, sampled from
 * a screenshot rather than read off a token \u2014 `#ef4444` scores **4.06:1**,
 * under the 4.5:1 bar `button-contrast.spec.ts` and `chip-hue-authority.spec.ts`
 * hold every control and every chip to. The decision's own body already warned
 * about exactly this hue: *"on `--panel-2` the same colour measures 4.45:1 and
 * FAILS"*. So a defect wears `--warn` (5.44:1) with the other two debts, and
 * the bug glyph is what separates it from a question.
 *
 * **`--ok` IS LEFT UNSPENT ON PURPOSE.** It means "fine, safe, passing" on
 * doctor's levels, on the watch pulse and on every chip in the product. Not one
 * of these nine kinds means that, and spending it to mean a fourth thing is how
 * a five-hue budget stops meaning anything \u2014 the amendment's own warning.
 *
 * \u2500\u2500 AND COLOUR IS NEVER THE ONLY CARRIER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *
 * The amendment of 2026-08-27 is binding and it is narrow: *"a hue may narrow a
 * group, never name one"*, because *gold against ok is 1.04:1 and two hues a
 * reader cannot reliably tell apart were already being separated by the word
 * beside them.* So the hue narrows nine kinds to three postures; the GLYPH and
 * the WORD name the kind, both stay, and both are what survives when the hue
 * does not \u2014 `@media print` flattens every one of these tokens to `#000`, and
 * a reader who cannot separate orange from blue still reads `\uD83D\uDC1E a defect`.
 * That is the same rule the review verdicts follow: rail, ground, weight AND
 * word.
 *
 * **`null` is written out for `note` rather than left absent**, so the table is
 * TOTAL over `ANCHOR_KIND_KEYS` and a kind added without a group is a hole a
 * test can see rather than an `undefined` that silently means grey.
 * `test/ui/anchor-kind-vocabulary.test.ts` asserts that totality.
 *
 * A kind this build has no word for gets no group and no glyph, for the reason
 * written one table up: there is no colour for "unknown" either.
 */
export const ANCHOR_KIND_HUE = {
  ruling: 'kindsettled',
  decision: 'kindsettled',
  defect: 'kindowed',
  question: 'kindowed',
  todo: 'kindowed',
  table: 'kindfound',
  report: 'kindfound',
  evidence: 'kindfound',
  note: null,
};

/**
 * The group class a kind wears, or `''` \u2014 ready to be concatenated onto a base
 * class, which is the one thing every caller does with it.
 *
 * **It returns a class rather than a colour**, so the hue lives in the
 * stylesheet and nothing here restates one. `scripts/check-cssom-restatement.ts`
 * and `chip-hue-authority`'s inline-colour assertion both exist because a
 * colour written from a module is a colour no gate that reads a stylesheet can
 * see.
 */
function kindHueClass(kind) {
  const group = ANCHOR_KIND_HUE[kind];
  return typeof group === 'string' ? ` ${group}` : '';
}

/**
 * ── THE KEYBOARD ROUTE TO EVERY ACTION ON A CONVERSATION DOCUMENT ──────────
 *
 * `TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so`, owner
 * request 2026-09-15. `mountDocument` binds these; the whole of what they mean
 * is here, in one table, because a binding written at its call site is a
 * binding nothing can check for a collision.
 *
 * **`code`, NOT `key`.** A `KeyboardEvent.code` is the PHYSICAL key and does
 * not move with the layout; `key` is the character produced. Half this archive
 * is Hebrew, and on a Hebrew layout the key printed `M` reports `key: 'צ'` —
 * so a table keyed on `key` binds these for a Latin keyboard and silently
 * unbinds every one of them for the reader the product is actually for.
 *
 * **`show` is what the reader is told**, and it is deliberately the Latin
 * legend rather than the character the current layout produces: it is what is
 * printed on the physical keycap, which is the thing a reader is looking at
 * when they go to press it.
 *
 * **EXPORTED SO A COLLISION IS A TEST FAILURE.** Two actions on one binding is
 * the defect this shape exists to make impossible to ship — one of them simply
 * never fires, and nothing on the screen says which. `test/ui/doc-shortcuts.
 * test.ts` reads this table.
 *
 * **WHAT IS DELIBERATELY NOT HERE, and each has a reason rather than an
 * omission:**
 *   — **Escape.** `confirm/5` bound it on the rename box and `app.js` binds it
 *     on the item pane; the item rules a third meaning unavailable and it is
 *     not taken.
 *   — **Take it back.** It has no confirm, by owner ruling of 2026-09-11. A
 *     bare letter that destroys a bookmark with nothing between the keystroke
 *     and the act is not a fast path, it is a trap. It keeps its button and
 *     gains the menu.
 *   — **Top and End.** They are named in neither the item's list nor his
 *     request, and every binding spent is a key a later one cannot have.
 */
export const DOC_SHORTCUTS = [
  { action: 'find', code: 'Slash', shift: false, show: '/' },
  // One key for the row's write, because the row has ONE write control: it
  // reads "Mark this point" on an unmarked turn and "Rename" on a marked one,
  // and a reader pressing this means "do the thing this turn offers".
  { action: 'write', code: 'KeyM', shift: false, show: 'M' },
  { action: 'markNext', code: 'KeyN', shift: false, show: 'N' },
  { action: 'markPrev', code: 'KeyN', shift: true, show: 'Shift+N' },
  { action: 'youNext', code: 'KeyU', shift: false, show: 'U' },
  { action: 'youPrev', code: 'KeyU', shift: true, show: 'Shift+U' },
  /*
   * ── THE KIND, ON A KEY — `TASK-stepping-to-the-next-mark-of-a-particular-
   * kind-needs-its-own`, owner request 2026-09-15: *"it would be nice to be
   * able to jump to different mark types with special keys (do not replace
   * existing just add specifc)."*
   *
   * **ADDED, NOT REPLACING.** Every line above this one is untouched: `N` and
   * `Shift+N` still walk the marks, `U` and `Shift+U` still walk his messages,
   * `M` still writes and `/` still finds. The kind `<select>` from `anchors/6`
   * and the `menuitemradio` rows from the right-click menu both stay. This is a
   * THIRD route to a capability that already has two, which is `anchors/4`'s
   * own ruling applied again.
   *
   * ── THE QUESTION THE ITEM SAYS MUST BE ANSWERED, AND THE ANSWER ─────────
   *
   * Nine kinds, and no room for nine mnemonic pairs that miss `N`, `U`, `M`
   * and `/`. The item offers three shapes: a PREFIX key, CYCLING the filter
   * with one key, or keys for ONLY THE FEW KINDS a reader hunts. **This is the
   * cycle, and it is one key plus its Shift twin.**
   *
   * **Why not per-kind keys, which is the shape the request sounds like.** The
   * `<select>` does not offer nine options. `fillKinds` builds it from
   * `kindsPresent()` — THE KINDS THIS CONVERSATION ACTUALLY HOLDS — because
   * offering `a report` on a document with no report is a control that can only
   * answer "nothing", which is the measured-zero rule pointed at a `<select>`.
   * So a key bound to `defect` has no option to select on a document with no
   * defect: it would either do nothing silently, or need a SECOND vocabulary
   * that disagrees with the one on screen. A cycle walks the list that is
   * actually there, so every press lands on a choice the reader can see.
   *
   * **The item's own frequency argument survives this rather than losing to
   * it.** His 1,155 marks are 67% tables, so the kinds worth reaching are the
   * RARE ones — and cycling reaches them by COUNT OF KINDS, never by count of
   * marks. A document holding tables, a ruling and one defect is a three-press
   * ring no matter that the tables outnumber the rest 700 to 2. A per-kind key
   * would be faster only on the document that holds all nine, and there is no
   * such document in this archive.
   *
   * **And it does not run out.** Two bindings cover nine kinds and cover the
   * tenth on the day the vocabulary grows. A per-kind table needs a key that
   * does not exist, which is the state this table is already in.
   *
   * **Why not a prefix.** A prefix key is a MODE — a keystroke after which the
   * next keystroke means something else — and a mode this screen enters
   * silently is one a reader cannot leave, because `Escape` is spoken for
   * twice and the item rules it unavailable. That is the one shape the
   * constraints actually forbid rather than merely disfavour.
   *
   * `KeyK` for KIND, and it is free: nothing above binds it. Bound by `code`
   * like everything else — on a Hebrew layout that key prints `ל`. `Shift+K`
   * goes the other way, which is the direction convention `Shift+N` and
   * `Shift+U` already set on this bar, so it is not a new thing to learn.
   */
  { action: 'kindNext', code: 'KeyK', shift: false, show: 'K' },
  { action: 'kindPrev', code: 'KeyK', shift: true, show: 'Shift+K' },
];

/**
 * **THE BINDING IS SHOWN ON THE BUTTON**, which is the item's closing sentence
 * and not a nicety: *"A keyboard route nobody can discover is the same defect
 * as a right-click-only action. The binding belongs on the button's own title
 * or beside it, so the discovery path teaches the fast path."*
 *
 * Three carriers, and they are three different readers rather than belt and
 * braces. The `title` is the sentence, for a reader who hovers. The chip
 * beside the word is what is seen without hovering. `aria-keyshortcuts` is the
 * one a screen reader announces AS a shortcut rather than as part of the name
 * — which is exactly why the chip is `aria-hidden` and the accessible name is
 * left untouched.
 *
 * `span.m` on the chip for the reason every identifier on this screen wears
 * it: `Shift+N` inside a Hebrew button label lands at the wrong end of the
 * label unless it is isolated.
 *
 * **A module-level function and not a closure**, because `markControl` draws
 * the row's own write button on every paint and is defined long before the
 * shortcuts are wired; a helper defined down there would be in its temporal
 * dead zone at the moment the first row is built.
 */
function shortcutOn(ctx, control, action) {
  const binding = DOC_SHORTCUTS.find((entry) => entry.action === action);
  if (binding === undefined) return;
  control.setAttribute('aria-keyshortcuts', binding.show);
  control.title = ctx.tFlat('conv.keys.on', { key: binding.show });
  if (control.tagName !== 'BUTTON') return;
  const chip = el('span', 'm tvkey', binding.show);
  chip.setAttribute('aria-hidden', 'true');
  control.append(' ', chip);
}

/** The controls that scope a search — Task 5. Built once, never redrawn. */
function archiveBar(ctx, sessions, state, onChange) {
  const bar = el('div', 'convfilter convarchbar');
  bar.setAttribute('role', 'search');
  bar.setAttribute('aria-label', ctx.tFlat('conv.arch.region'));

  const field = (labelKey, control) => {
    const wrap = el('label', 'convfield');
    const name = el('span', 'convfieldname');
    name.append(...ctx.t(labelKey));
    wrap.append(name, control);
    return wrap;
  };

  const find = el('input', 'convfind convarchq');
  find.type = 'search';
  find.value = state.q ?? '';
  bar.append(field('conv.arch.find', find));

  // A CHOICE and not a typed id, for `filterBar`'s branch reason: a reader
  // typing part of a session id would read the empty answer as a fact about
  // their words rather than about their typing. The option text is the name
  // this project gave it, then the one Claude Code gave it, then the id —
  // `titleNodes`' own order of preference, because the name is the one word in
  // it the reader chose.
  const session = el('select', 'convselect convarchsession');
  const anySession = el('option');
  anySession.value = '';
  anySession.append(...ctx.t('conv.arch.anySession'));
  session.append(anySession);
  for (const row of sessions) {
    const option = el('option');
    option.value = row.sessionId;
    option.textContent = row.name ?? row.title ?? row.sessionId.slice(0, 8);
    if (state.session === row.sessionId) option.selected = true;
    session.append(option);
  }
  bar.append(field('conv.arch.session', session));

  const kind = el('select', 'convselect convarchkind');
  for (const [value, key] of [
    ['', 'conv.arch.anyKind'], ['prompt', 'conv.arch.kindPrompt'], ['answer', 'conv.arch.kindAnswer'],
  ]) {
    const option = el('option');
    option.value = value;
    option.append(...ctx.t(key));
    if ((state.kind ?? '') === value) option.selected = true;
    kind.append(option);
  }
  bar.append(field('conv.arch.kind', kind));

  const since = el('input', 'convdate convarchsince');
  since.type = 'date';
  since.value = state.since ?? '';
  bar.append(field('conv.arch.since', since));

  const until = el('input', 'convdate convarchuntil');
  until.type = 'date';
  until.value = state.until ?? '';
  bar.append(field('conv.arch.until', until));

  const clear = el('button', 'convclear convarchclear');
  clear.type = 'button';
  clear.append(...ctx.t('conv.filter.clear'));
  bar.append(clear);

  const read = () => ({
    q: find.value.trim() === '' ? null : find.value.trim(),
    session: session.value === '' ? null : session.value,
    kind: kind.value === '' ? null : kind.value,
    since: since.value === '' ? null : since.value,
    until: until.value === '' ? null : until.value,
  });

  const typing = settler(ARCH_SETTLE_MS, () => { onChange(read()); });
  find.addEventListener('input', typing.settle);
  for (const control of [session, kind, since, until]) {
    control.addEventListener('change', typing.now);
  }
  clear.addEventListener('click', () => {
    find.value = '';
    session.value = '';
    kind.value = '';
    since.value = '';
    until.value = '';
    typing.now();
  });
  return bar;
}

/**
 * The query string for one search state.
 *
 * `tz` rides with the DATES and only with them, exactly as `filterQuery`'s own
 * header argues: a bound is a day, a day is a day only in some clock, and this
 * screen is the party that knows which one.
 */
function archiveQuery(state) {
  const params = new URLSearchParams();
  params.set('q', state.q);
  if (state.session !== null) params.set('session', state.session);
  if (state.kind !== null) params.set('kind', state.kind);
  if (state.since !== null) params.set('since', state.since);
  if (state.until !== null) params.set('until', state.until);
  if (state.since !== null || state.until !== null) params.set('tz', READER_ZONE);
  return `?${params.toString()}`;
}

/** How a hit names the conversation it was found in. */
function hitWhere(ctx, hit) {
  const where = el('p', 'small convhitwhere');
  const open = el('a', 'convhitopen');
  if (hit.agentId === null) {
    open.href = sessionHref(hit.sessionId);
    open.textContent = hit.sessionName ?? hit.sessionTitle ?? hit.sessionId.slice(0, 8);
    open.title = ctx.tFlat('conv.arch.open');
  } else {
    open.href = laneHref(hit.agentId);
    open.textContent = hit.sessionName ?? hit.sessionTitle ?? hit.sessionId.slice(0, 8);
    open.title = ctx.tFlat('conv.arch.openLane');
  }
  where.append(open);
  if (hit.agentId !== null) {
    const lane = el('span', 'convhitlane');
    lane.append(' ', ...(hit.agentTitle === null
      ? ctx.t('conv.arch.inLaneUnnamed')
      : ctx.t('conv.arch.inLane', { title: hit.agentTitle })));
    where.append(lane);
  }
  const stamp = zonedStampOf(hit.at, READER_ZONE);
  if (stamp !== null) {
    where.append(' · ');
    where.append(mono(stamp));
  }
  // A plain span and NOT a chip. `.chip` spends one of five meaning hues and
  // an unmodified one renders invisible — the defect `plan:screens 1s-c`
  // measured and `chip-hue-authority.spec.ts` now gates. Who spoke is not a
  // meaning hue; it is the same glyph-and-word pair `KINDS` already carries
  // for the document, so this uses that and nothing new.
  const kind = el('span', 'convhitkind');
  kind.textContent = `${KINDS[hit.kind]?.glyph ?? ''} `;
  kind.append(...ctx.t(hit.kind === 'prompt' ? 'conv.doc.you' : 'conv.doc.claude'));
  where.append(' ', kind);
  return where;
}

/* ══ NAMING A POINT — ONE IMPLEMENTATION, THREE PLACES ════════════════════
 *
 * **This was written three times.** `markRow` for a search hit, `anchorRow`
 * for the marked-points list, and `markControl` inside the document each
 * hand-built their own input, their own save button, their own `aria-live`
 * region and their own write against the same three endpoints — and the map
 * of 2026-09-13 (`reports/2026-09-13-conversations-js-mapped.md`) called that
 * the strongest drift risk in the file. Three copies of one behaviour do not
 * stay the same: they had already diverged on whether a refused empty label
 * returns the caret to the field, which is the smallest possible symptom of
 * exactly the failure and the reason this is worth a shared function rather
 * than a comment asking three people to remember.
 *
 * **What is shared is the BEHAVIOUR, not the layout.** The three surfaces
 * genuinely differ — a search hit's field is wrapped in a real `<label>`
 * because it sits beside three other unlabelled boxes, a document row's is
 * named by `aria-label` because it sits inside a scrolling well where a
 * visible label would cost a line per turn — so the shape is a parameter and
 * the sequence is not. The sequence is the part that must not drift:
 *
 *   1. an empty label is REFUSED, in words, and nothing is written;
 *   2. the save button is disabled for the duration and comes BACK, because
 *      "a refusal is drawn and the control comes back" —
 *      `INV-nothing-is-dropped-silently` forbids the button that appears to
 *      have worked and has not;
 *   3. the live region says what is happening, then what happened;
 *   4. Enter in the one field submits it — a single-field form that needs the
 *      mouse asks twice for one answer;
 *   5. success hands back to the caller, which is the only part the three
 *      surfaces answer differently;
 *   6. **there is a way out that writes nothing** — a Cancel beside the Save
 *      and Escape anywhere in the box — because a field a reader can only
 *      leave by saving something is a field that traps them
 *      (`TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the`).
 */

/**
 * **WHAT THE SERVER ACTUALLY SAID ABOUT THE WRITE, READ BEFORE ANYTHING IS
 * DRAWN AS A SUCCESS** —
 * `TASK-the-anchor-write-routes-answer-indexed-false-and-no-client`.
 *
 * The four write routes in `src/ui/anchor-write.ts` answer three shapes that
 * are `200` and are NOT the write having happened, and until this existed not
 * one client call site read any of them. `post()` throws on a refusal, so
 * every 400 and 404 already reached a `catch`; these three do not throw,
 * because they are STATES rather than failures — and the relabel path read
 * only `tookOwnership`, so it drew **"Renamed" for a rename that did not
 * happen.** That is `INV-nothing-is-dropped-silently` on the screen.
 *
 *   - `{ indexed: false }` — the archive has never been built in this
 *     workspace, so there is nothing to mark and nothing was written. It is
 *     `NOT_INDEXED`, the one shape every verb answers that with.
 *   - `{ indexed: true, anchor: null }` — a success envelope around an absent
 *     result: the row was written and could not be read back. The screen then
 *     knows that what it is showing is not known to be what is stored, which
 *     is a different and worse thing than a refusal.
 *   - `{ indexed: true, dropped: false }` — the row was already gone. An
 *     answer, not a failure (`apiAnchorDrop` says so in as many words), and
 *     not a removal either, so it must not be announced as one.
 *
 * Returns the nodes of the sentence to draw, or `null` when the answer is one
 * a success may be drawn for. `wants` is `'anchor'` for the three writes that
 * answer with a row, `'dropped'` for the one that does not.
 */
function anchorRefusal(ctx, answer, wants = 'anchor') {
  if (answer === null || typeof answer !== 'object') return ctx.t('conv.anchors.writeUnread');
  if (answer.indexed === false) return ctx.t('conv.anchors.writeNotIndexed');
  if (answer.indexed !== true) return ctx.t('conv.anchors.writeUnread');
  if (wants === 'dropped') {
    return answer.dropped === true ? null : ctx.t('conv.anchors.dropNone');
  }
  return answer.anchor === null || typeof answer.anchor !== 'object'
    ? ctx.t('conv.anchors.writeNoRow') : null;
}

/**
 * A box holding one named field, its save button, its way out, and the write
 * behind it.
 *
 * `said` is the caller's live region rather than one built here, because the
 * three callers place it in three different parents — inside the box, under
 * the row's actions, at the end of the bar — and where a message appears is a
 * layout decision.
 */
function labelWrite(ctx, spec) {
  const box = el('div', spec.boxClass);
  box.hidden = true;
  const input = el('input', spec.inputClass);
  input.type = 'text';
  input.value = spec.value ?? '';
  // `dir="auto"` for `saidBody`'s reason: this archive is half Hebrew, and a
  // Hebrew label typed into an LTR field reads with its punctuation at the
  // wrong end.
  input.setAttribute('dir', 'auto');
  const save = el('button', spec.saveClass);
  save.type = 'button';
  save.append(...ctx.t(spec.saveKey));

  /*
   * ── THE WAY OUT, AND IT IS NOT A CONFIRM ─────────────────────────────────
   *
   * `TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the`. Until
   * this existed the only way out of one of these boxes was to SAVE one: the
   * button that opened it does toggle it shut, and it still reads "Rename"
   * while the box is open, so nothing on the screen says so. A reader who
   * opened a rename by mistake had a field, a Save, and no stated route back.
   *
   * **A cancel is not a gate.** The owner's ruling of 2026-09-11 — a bookmark
   * does not get a confirm dialog and a subprocess — is about what stands
   * BEFORE an act. This is on the other side: nothing here asks permission,
   * and nothing here is written. It is the sixth step of the sequence this
   * function exists to keep from drifting, and it is shared for the same
   * reason as the other five, because three hand-written copies of a way out
   * would be three different ways out.
   *
   * `exec.cancel` ("Cancel") is REUSED rather than re-spelled — the same
   * deliberate reuse `cfg.savebtn`'s own note records, and for its stated
   * test: the string names no command, so a second spelling of it would be
   * exactly the two-tables-that-can-disagree this UI keeps refusing.
   */
  const cancel = el('button', spec.cancelClass);
  cancel.type = 'button';
  cancel.append(...ctx.t('exec.cancel'));

  // **A placeholder is not an accessible name**, which this file has already
  // paid for once on the document's own find box. `'label'` is a real
  // `<label>` element, visible to a reader who can see it as well as to one
  // who cannot; `'aria'` is the name without the line, for a control drawn on
  // every row of a scrolling document.
  let field = input;
  if (spec.named === 'label') {
    const wrap = el('label', 'convfield');
    const name = el('span', 'convfieldname');
    name.append(...ctx.t(spec.labelKey));
    wrap.append(name, input);
    field = wrap;
  } else {
    input.setAttribute('aria-label', ctx.tFlat(spec.labelKey));
  }

  /*
   * ── WHAT KIND OF POINT IT IS, FROM HIS OWN VOCABULARY ────────────────
   *
   * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`, owner
   * ruling 2026-09-15: *"does the user have the same input options so it will
   * be documented it is marked anchores?"* The answer was no — a hand-made
   * mark was pinned to `kind: 'note'` and he could type a label and nothing
   * else, and he had made ONE mark in 750 while the automatic pass recorded a
   * kind, a byte, a session, an agent and an instant for every one of its own.
   *
   * **A `<select>` and not a text box**, which is the item's one constraint
   * rather than a preference: a free-text kind could be typed as `table`, and
   * the row would then be an `origin: 'owner'` anchor wearing the automatic
   * pass's own word for what it writes. The route is closed twice — the
   * options come from `OWNER_KIND_CHOICES`, and `apiAnchorMark` checks what
   * arrives against `OWNER_ANCHOR_KINDS` and answers 400 naming the list.
   *
   * **Named by `aria-label` in both shapes.** A visible `<label>` per control
   * would cost two more lines on every marked row of a scrolling document,
   * which is the measurement `named: 'aria'` already exists for; the name is
   * still there for anything that reads the page.
   */
  let kindPick = null;
  if (spec.kinds === true) {
    kindPick = el('select', spec.kindClass);
    kindPick.setAttribute('aria-label', ctx.tFlat('conv.anchors.kindLabel'));
    for (const choice of OWNER_KIND_CHOICES) {
      const option = el('option', null, ctx.tFlat(`conv.anchors.kind.${choice}`));
      option.value = choice;
      kindPick.append(option);
    }
    /*
     * **A KIND THIS FORM CANNOT OFFER IS KEPT, NOT SILENTLY REPLACED.** A
     * relabel carries `kind` over when the request says nothing, and the two
     * kinds the automatic pass writes (`table`, `ruling`) are not in this
     * list. Selecting the first option for such a row and sending it would
     * turn every rename of an automatic mark into a re-kinding —
     * `INV-nothing-is-dropped-silently` in the direction that costs a fact.
     * So an unofferable kind leaves the control OUT and `run` sends nothing.
     */
    if (spec.kindValue !== undefined && OWNER_KIND_CHOICES.includes(spec.kindValue)) {
      kindPick.value = spec.kindValue;
    } else if (spec.kindValue !== undefined) {
      kindPick = null;
    }
  }

  /*
   * ── HIS FREE TEXT BESIDE THE LABEL ─────────────────────────────────
   *
   * A label is what he recognises the point by in a list, and it has a cap and
   * a job. This is the sentence that says WHY, and the column has existed on
   * the row since anchors shipped with nothing on any screen writing to it or
   * drawing it.
   *
   * **A `<textarea>` and not an `<input>`**, because the thing it holds is
   * prose up to 2,000 characters and a one-line box tells a reader it wants
   * four words. `dir="auto"` for `input`'s own reason, one control up.
   *
   * **NO `maxlength`, and that is deliberate.** `NOTE_CAP` lives in
   * `src/ui/anchor-write.ts` and the route answers a 400 naming it. A second
   * copy of the number here would be a bound this screen could silently drift
   * from — the defect this project files as one fact recorded twice — and
   * `post()` already throws a refusal this box draws in its own live region.
   */
  let detail = null;
  if (spec.details === true) {
    detail = el('textarea', spec.detailClass);
    detail.rows = 2;
    detail.value = spec.detailValue ?? '';
    detail.setAttribute('dir', 'auto');
    detail.setAttribute('aria-label', ctx.tFlat('conv.anchors.noteLabel'));
    detail.placeholder = ctx.tFlat('conv.anchors.noteLabel');
  }
  /*
   * **THE PARAGRAPH ABOVE THE FIELD**, which only the search hit draws. It
   * was `spec.note` until the owner's free text arrived under that very name
   * on the wire (`AnchorSpec.note`) — one word for two unrelated things in
   * one function is how a caller passes the wrong one and nothing says so.
   */
  if (spec.lede !== undefined) box.append(spec.lede);
  box.append(field);
  if (kindPick !== null) box.append(kindPick);
  if (detail !== null) box.append(detail);
  box.append(save, cancel);

  /**
   * Whether the sentence now standing in `spec.said` is one THIS box put
   * there. The document's bar shares one region between its mark, its rename
   * and its take-back, so a cancel that cleared it unconditionally would wipe
   * "Marked." — a sentence about a write that did happen — off the screen.
   */
  let mine = false;

  const run = async () => {
    const label = input.value.trim();
    spec.said.hidden = false;
    mine = true;
    if (label === '') {
      spec.said.replaceChildren(...ctx.t(spec.emptyKey));
      // The caret goes back to the field it was refused over. Two of the three
      // copies did this and the third did not; a reader told "this needs a
      // name" and left with focus nowhere has to find the box again.
      input.focus();
      return;
    }
    save.disabled = true;
    spec.said.replaceChildren(...ctx.t(spec.busyKey));
    /*
     * **WHAT THE TWO NEW CONTROLS SEND, AND THE ONE THING THEY MUST NOT.**
     *
     * `kind` is sent only when the control is drawn; a form that does not
     * offer it says nothing, and `apiAnchorRelabel` then carries the standing
     * kind over — "re-deriving either would reorder his list every time he
     * fixed a typo".
     *
     * `note` is `null` WHEN HE CLEARED IT and the trimmed text otherwise, and
     * NEVER `''`. The route reads the three apart deliberately: absent keeps
     * the existing note, `null` clears it, and a string replaces it. An empty
     * string is a fourth spelling of "nothing" that `AnchorSpec.note` names as
     * the defect `subagents.dispatched_by` was repaired for.
     */
    const more = {};
    if (kindPick !== null) more.kind = kindPick.value;
    if (detail !== null) {
      const said = detail.value.trim();
      more.note = said === '' ? null : said;
    }
    let answer;
    try {
      answer = await ctx.post(spec.endpoint, spec.body(label, more));
    } catch (error) {
      spec.said.replaceChildren(errorNote(error.message));
      save.disabled = false;
      return;
    }
    save.disabled = false;
    // **THE ANSWER IS READ HERE AND NOT IN THE FOUR CALLERS**, because that is
    // the sequence this function exists to keep from drifting: three copies of
    // it had already diverged on a smaller question than this one. A refusal
    // is drawn in the live region, the caret goes back to the field it was
    // refused over, and `done` — the half that draws "Renamed", replaces the
    // row, or redraws the document — is NOT reached.
    const refusal = anchorRefusal(ctx, answer);
    if (refusal !== null) {
      spec.said.replaceChildren(...refusal);
      input.focus();
      return;
    }
    await spec.done(answer, label);
  };
  save.addEventListener('click', () => { void run(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void run(); }
  });

  const writer = {
    box, input, save, cancel, run, shut: null,
    // What a cancel puts back — all three fields and not only the label,
    // because a reader who opened a rename, changed the kind and thought
    // better of it must get the row they opened back and not two thirds of it.
    opened: input.value,
    openedKind: kindPick === null ? null : kindPick.value,
    openedDetail: detail === null ? null : detail.value,
  };

  /**
   * **LEAVE WITHOUT WRITING.** The draft goes back to what the box opened
   * with, this box's own sentence comes down, and NOTHING IS SENT — there is
   * no request on this path at all, which is the half of a cancel that has to
   * be true before the half a reader can see is worth anything.
   *
   * **A write in flight is not cancellable, and it says so by doing nothing.**
   * `save.disabled` is exactly the window between the request leaving and the
   * answer arriving. Shutting the box there would leave the screen claiming a
   * rename was abandoned while the row was being renamed on disk — a cancel
   * that quietly commits, which is worse than no cancel. The window is one
   * request long, `done` shuts the box on success, and a refusal re-enables
   * the button, so the way out is back within the same gesture.
   */
  const abandon = () => {
    if (box.hidden || save.disabled) return;
    input.value = writer.opened;
    if (kindPick !== null && writer.openedKind !== null) kindPick.value = writer.openedKind;
    if (detail !== null && writer.openedDetail !== null) detail.value = writer.openedDetail;
    if (mine) {
      spec.said.replaceChildren();
      spec.said.hidden = true;
      mine = false;
    }
    if (writer.shut !== null) { writer.shut(); return; }
    box.hidden = true;
  };
  cancel.addEventListener('click', abandon);
  /*
   * **ESCAPE ANYWHERE IN THE BOX**, and not only in the field: a reader who
   * has tabbed to Save and thought better of it is the reader this is for.
   *
   * `stopPropagation` because `app.js` listens for the same key on
   * `document` and closes the item pane with it. Without this, one Escape
   * over an open rename would shut the box AND the pane behind it — the same
   * one-key-one-level rule that listener already states for the popovers.
   */
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    abandon();
  });

  return writer;
}

/**
 * The button that opens and shuts one of those boxes.
 *
 * `onToggle` runs after the box has moved and before the field takes focus,
 * which is the order the three callers need: one renames its own button, one
 * puts the standing label back before the caret arrives, and one asks the
 * document to re-measure the row that just grew.
 */
function boxToggle(button, box, input, onToggle = () => {}, writer = null) {
  button.addEventListener('click', () => {
    box.hidden = !box.hidden;
    onToggle(box.hidden);
    if (box.hidden) return;
    // What the field holds AT THE MOMENT IT OPENS, which is what a cancel puts
    // back. Read after `onToggle`, because that is where the caller that
    // restores the standing label restores it.
    if (writer !== null) {
      writer.opened = input.value;
      // The other two are read the same way and at the same moment, so a
      // caller that restores a standing value in `onToggle` restores all of
      // them and a cancel puts back exactly what opened.
      const picked = box.querySelector('select');
      const said = box.querySelector('textarea');
      writer.openedKind = picked === null ? null : picked.value;
      writer.openedDetail = said === null ? null : said.value;
    }
    input.focus();
  });
  if (writer === null) return;
  /**
   * Shut it from the inside, for a cancel.
   *
   * `onToggle(true)` runs for the same three callers' sake it runs for on the
   * way in — one puts its own word back on the button, one asks the document
   * to re-measure the row that just shrank — and the caret goes to the control
   * that opened the box, which is the row the reader was on.
   * `TASK-every-write-on-conversations-throws-focus-to-the-document` is about
   * a write; this is not a write, and it lands the caret in the same place for
   * the same reason.
   */
  writer.shut = () => {
    box.hidden = true;
    onToggle(true);
    button.focus();
  };
}

/**
 * The button that takes a marked point back.
 *
 * ── **STILL NO CONFIRM, AND THAT IS THE RULING** ──────────────────────────
 *
 * Owner, 2026-09-11: he asked why a bookmark needed a confirm dialog and a
 * subprocess when an anchor never touches the session file. It does not — it
 * is a row in a rebuildable index plus a line in a gitignored document — so
 * **a dialog and a subprocess are the wrong ceremony for a bookmark**, and
 * nothing here gates the act. One click, as before.
 *
 * ── WHAT `TASK-take-it-back-deletes-immediately-with-no-confirm-no-undo-and`
 *    ACTUALLY ASKED FOR, WHICH IS NOT A DIALOG ─────────────────────────────
 *
 * The item names three absences and only one of them is a confirm: **no
 * confirm, no undo, and NO ANNOUNCEMENT.** The proportion it asks for is on
 * the act's far side, and it is spent where the class of thing decides:
 *
 *   1. **It is announced, always, in a region that outlives the row.** The
 *      sentence used to be written into `spec.said` — which lives ON the row
 *      the write removes — so the redraw took the announcement out with the
 *      element before any reader or any screen reader could reach it. That is
 *      why the item reads "no announcement" over code that plainly writes one.
 *      So `done` is handed the row that went, and the CALLER places the
 *      sentence somewhere that survives.
 *   2. **A way back, on the one class nothing regenerates.** An
 *      `origin: 'owner'` point is the owner's own work and the automatic pass
 *      never reads one, so nothing in this product can recreate it. That row,
 *      and only that row, is offered "Put it back". An `origin: 'automatic'`
 *      point IS regenerated — by the pass, from the button four lines above
 *      this list — so it is told so instead of being given a second button
 *      that would re-file it as a hand-made note of his.
 *   3. **The answer is read.** `{ dropped: false }` is the row having been
 *      already gone, and announcing that as a removal is the same defect one
 *      verb along.
 *
 * `spec.anchor` is the whole row and not its id, because every one of those
 * three needs a field of it: the label to name what went, the origin to
 * decide, and the session/lane/byte to put it back at.
 */
function dropWrite(ctx, spec) {
  const drop = el('button', spec.dropClass);
  drop.type = 'button';
  drop.append(...ctx.t('conv.anchors.drop'));
  drop.addEventListener('click', () => {
    void (async () => {
      drop.disabled = true;
      spec.said.hidden = false;
      spec.said.replaceChildren(...ctx.t('conv.anchors.dropping'));
      let answer;
      try {
        answer = await ctx.post('/api/conversations/anchors/drop', { id: spec.anchor.id });
      } catch (error) {
        spec.said.replaceChildren(errorNote(error.message));
        drop.disabled = false;
        return;
      }
      const refusal = anchorRefusal(ctx, answer, 'dropped');
      if (refusal !== null) {
        spec.said.replaceChildren(...refusal);
        drop.disabled = false;
        return;
      }
      await spec.done(spec.anchor);
    })();
  });
  return drop;
}

/**
 * **THE SENTENCE A TAKE-BACK LEAVES BEHIND, AND THE WAY BACK WHEN THERE IS
 * ONE** — written into a live region the CALLER owns.
 *
 * `said` must already be in the document when this runs: an `aria-live` region
 * announces a CHANGE to its contents, and a region built at the moment of the
 * write is a region with nothing to change from. Both callers hand in a region
 * that was mounted long before and that the write's own redraw does not touch.
 *
 * Returns the "Put it back" button when one was drawn, so the caller can put
 * the caret on it — the take-back removed the control the reader's caret was
 * on, and this is the nearest thing that is still true.
 */
function sayTakenBack(ctx, said, anchor, backClass, onPutBack) {
  const own = anchor.origin === 'owner';
  const line = el('p', 'small');
  line.append(...ctx.t(own ? 'conv.anchors.droppedOwn' : 'conv.anchors.droppedAuto'));
  // **WHICH POINT WENT, said rather than left to be inferred from a list that
  // is one row shorter.** `dir="auto"` for `saidBody`'s reason: this archive is
  // half Hebrew and a label is the half a person wrote.
  const name = el('p', 'small convtakenname');
  name.setAttribute('dir', 'auto');
  name.textContent = anchor.label;
  /**
   * **WHICH OF THE TURN'S MARKS WENT, and after 2026-09-16 a turn can have
   * two** — `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`.
   *
   * The label alone answered it while a point could only ever carry one mark.
   * It cannot now: a reader who pressed Take it back on the report of a turn
   * that is also a table would read a sentence and a name and still not know
   * which of the two rows in front of them had gone. The kind is the thing
   * that tells them apart on the bar, so it is the thing that names the one
   * that left — same glyph, same word, same hue as the row it came off.
   *
   * It is OUTSIDE `name`, which carries `dir="auto"`: a glyph in front of a
   * Hebrew label would decide that paragraph's direction from the glyph.
   */
  const went = el('p', `small convtakenkind${kindHueClass(anchor.kind)}`);
  went.append(ANCHOR_KIND_KEYS.has(anchor.kind)
    ? glyphed(ANCHOR_KIND_GLYPH[anchor.kind], ctx.t(`conv.anchors.kind.${anchor.kind}`))
    : document.createTextNode(anchor.kind));
  const kids = [line, went, name];
  let back = null;
  if (own) {
    back = el('button', backClass);
    back.type = 'button';
    back.append(...ctx.t('conv.anchors.putBack'));
    back.addEventListener('click', () => { void onPutBack(back); });
    kids.push(back);
  }
  said.hidden = false;
  said.replaceChildren(...kids);
  return back;
}

/**
 * Put one point back where it was — the same transcript, the same byte, the
 * same name — through the door the screen already marks points with.
 *
 * **IT IS A MARK AND NOT AN UN-DELETE, and the screen says so.**
 * `apiAnchorMark` fixes `kind: 'note'`, `origin: 'owner'` and the stamp,
 * precisely so that no request can forge a row the automatic pass is forbidden
 * to read — a property this path is not entitled to spend. So a point put back
 * is dated now and filed as his, and `conv.anchors.putBackDone` states both.
 *
 * **Nothing is stored to make this work.** The whole undo is the row the
 * button closed over, held for as long as the sentence is on screen and no
 * longer. There is no second store, which is the standing constraint on
 * everything about anchors: the file is the truth and the table is derived
 * from it.
 */
async function putBackAnchor(ctx, said, anchor, button, done) {
  button.disabled = true;
  const busy = el('p', 'small');
  busy.append(...ctx.t('conv.anchors.puttingBack'));
  said.replaceChildren(busy);
  let answer;
  try {
    answer = await ctx.post('/api/conversations/anchors/mark', {
      sessionId: anchor.sessionId,
      agentId: anchor.agentId,
      byteOffset: anchor.byteOffset,
      label: anchor.label,
    });
  } catch (error) {
    said.replaceChildren(errorNote(error.message));
    return;
  }
  const refusal = anchorRefusal(ctx, answer);
  if (refusal !== null) {
    said.replaceChildren(...refusal);
    return;
  }
  const line = el('p', 'small');
  line.append(...ctx.t('conv.anchors.putBackDone'));
  said.replaceChildren(line);
  await done(answer.anchor);
}

/**
 * **THE POINT IS MARKED FROM HERE** — creation path 3 as it reaches a search
 * hit, owner ruling 2026-09-12.
 *
 * A button opens one field, and the field is the LABEL: an anchor with no
 * label is a bookmark nobody recognises in a list, which is why the CLI has
 * always refused one and why this asks rather than inventing a name. It is
 * pre-filled with the words that were searched for, because those are the
 * words that made this turn worth keeping — the same default the composed
 * command carried, now typed into a box a person can correct.
 *
 * **Nothing here is composed.** The three fields the write needs —
 * `sessionId`, `agentId`, `byteOffset` — go to the server as themselves. The
 * old shape had to serve a pre-built argv precisely because a screen
 * assembling a command line out of them would have been a second composer; a
 * screen sending them as numbers and strings cannot be.
 */
function markRow(ctx, hit, term, onMarked) {
  const row = el('div', 'convhitmark');
  if (hit.anchored === true) {
    // `ok` and not a class of its own: "this point is already kept" is the
    // settled-state meaning that hue already carries, and inventing a sixth
    // would spend the five-hue budget `DEC-the-meaning-hue-budget-is-five-gold-
    // ok-carry-crit-and-warn` sets.
    const chip = el('span', 'chip ok glyphed convhitmarked');
    chip.dataset.g = '⚑';
    // **FOCUSABLE, AND DELIBERATELY OUT OF THE TAB ORDER.** Saving the name
    // destroys the control the caret was on, and before this the caret fell to
    // `document.body` — `TASK-every-write-on-conversations-throws-focus-to-the-
    // document`. There is nothing left on this row to act on, so the caret goes
    // to the thing that REPLACED the control, which is also the sentence saying
    // the write landed. `-1` because a settled chip is not a stop a reader
    // tabbing through the results should have to pass.
    chip.tabIndex = -1;
    chip.append(...ctx.t('conv.arch.marked'));
    row.append(chip);
    return row;
  }
  const button = el('button', 'convhitmarkbtn');
  button.type = 'button';
  button.append(...ctx.t('conv.arch.mark'));
  const note = el('p', 'small');
  note.append(...ctx.t('conv.arch.markRun'));
  const said = el('p', 'small convmarksaid');
  said.setAttribute('aria-live', 'polite');
  said.hidden = true;

  const marker = labelWrite(ctx, {
    // Pre-filled with the words that were searched for, because those are the
    // words that made this turn worth keeping — the same default the composed
    // command carried, now typed into a box a person can correct.
    value: term ?? '',
    named: 'label',
    labelKey: 'conv.arch.markLabel',
    saveKey: 'conv.arch.markSave',
    emptyKey: 'conv.arch.markNeedsLabel',
    busyKey: 'conv.arch.marking',
    boxClass: 'convhitcmd',
    inputClass: 'convmarklabel',
    saveClass: 'convmarksave',
    cancelClass: 'convmarkcancel',
    lede: note,
    said,
    kinds: true,
    details: true,
    endpoint: '/api/conversations/anchors/mark',
    body: (label, more) => ({
      sessionId: hit.sessionId,
      agentId: hit.agentId,
      byteOffset: hit.byteOffset,
      label,
      ...more,
    }),
    done: () => {
      // The row redraws as MARKED rather than saying so beside a button that
      // still offers to mark it — two statements about one point, one of them
      // stale, is the state this screen already refuses on the automatic side.
      hit.anchored = true;
      row.replaceChildren(...markRow(ctx, hit, term, onMarked).childNodes);
      // The caret follows the row rather than falling to the top of the page.
      const chip = row.querySelector('.convhitmarked');
      if (chip !== null) chip.focus();
      onMarked();
    },
  });
  const { box, input } = marker;
  box.append(said);
  // **THE BUTTON'S OWN WORD IS PUT BACK BY A CANCEL TOO**, because `boxToggle`
  // runs this on the way out as well as on the way in. A box shut by Escape
  // that left "Never mind" standing over a closed field would be the screen
  // describing a state it is not in.
  boxToggle(button, box, input, (hidden) => {
    button.replaceChildren(...ctx.t(hidden ? 'conv.arch.mark' : 'conv.arch.markShut'));
  }, marker);

  row.append(button, box);
  return row;
}

/**
 * **The freshness of the index, drawn on every answer.**
 *
 * The prose index is filled by a CLI write, so this card can be answering from
 * an index that is behind the transcripts on disk — and an answer that was
 * quietly stale would be indistinguishable from an archive that does not hold
 * the words, which is the one confusion this whole feature exists to remove.
 * So it is said, either way, and the command that changes it is composed
 * beside it.
 */
function indexNote(ctx, body) {
  const out = [];
  const line = el('p', 'small convarchindex');
  if (body.index.spans === 0 || body.index.indexedAt === null) {
    line.append(...ctx.t('conv.arch.neverIndexed'));
  } else {
    line.append(...ctx.t('conv.arch.indexedAt', {
      at: zonedStampOf(body.index.indexedAt, READER_ZONE) ?? body.index.indexedAt,
      sources: body.index.sources,
      spans: body.index.spans,
    }));
  }
  out.push(spaced(line));
  const cmd = el('p', 'plate convcmd');
  cmd.append(mono(body.rebuild));
  out.push(cmd);
  return out;
}

/**
 * **WHAT THE SEARCH DID WITH HIS WORDS** — the disclosures that belong above
 * an answer AND above a zero, `semantic/4`.
 *
 * Two of them, and both exist because the alternative is silence:
 *
 *   — **Words too short for the index.** A trigram index matches runs of three
 *     characters, so `ui` cannot be looked for at all. It stays in the phrase
 *     reading, where the characters around it can still match, and it is left
 *     out of the two boolean readings — because `"ui" AND "search"` returns 0
 *     while `"search"` alone returns 654, and NOTHING says why. 21.0% of the
 *     words the owner types are under the floor, and in Hebrew it is 14.5% of
 *     word occurrences: §3 Finding 1 of the search-grammar report.
 *   — **Words he excluded.** `-word` removes hits, and a removal that is not
 *     said is the thing `INV-nothing-is-dropped-silently` is about.
 *
 * **Composed HERE and not on the server**, unlike `body.note`: this is drawn
 * to a reader who may be reading in Hebrew, and a sentence built out of
 * `String` on the server arrives in one language whatever the page is set to.
 * The server sends the WORDS; the screen owns the sentence.
 */
function queryNotes(ctx, body) {
  const out = [];
  const short = body.short ?? [];
  const excluded = body.excluded ?? [];
  if (short.length > 0) {
    const note = el('p', 'small convarchshort');
    note.append(...ctx.t('conv.arch.short', {
      words: short.join(', '), n: body.minChars ?? 3,
    }));
    out.push(note);
  }
  if (excluded.length > 0) {
    const note = el('p', 'small convarchexcluded');
    note.append(...ctx.t('conv.arch.excluded', { words: excluded.join(', ') }));
    out.push(note);
  }
  return out;
}

/**
 * The line above one tier's rows: what this reading is, and what it kept back.
 *
 * `bounded` is the half that cannot be left implicit. A reading that filled
 * its bound says so AND says by how much — `tier.matched` is COUNTED on the
 * server rather than guessed at, so this is a number and not a shrug.
 * Ordering is not filtering.
 */
function tierHead(ctx, tier, body) {
  const head = el('p', 'small convarchtier');
  head.dataset.tier = tier.tier;
  head.append(...ctx.t(`conv.arch.tier.${tier.tier}`, { n: body.nearChars ?? 30 }));
  if (tier.bounded === true) {
    const cut = el('span', 'convarchtiercut');
    cut.append(...ctx.t('conv.arch.tierBounded', {
      shown: tier.shown, matched: tier.matched,
    }));
    head.append(' ', cut);
  }
  return head;
}

/** One hit, drawn. Lifted out of `drawHits` when the answer grew tiers. */
function hitRow(ctx, hit, term, onMarked) {
  const row = el('div', 'convhit');
  row.dataset.tier = hit.tier ?? '';
  row.append(hitWhere(ctx, hit));
  // `dir="auto"` and not the page's direction: a passage is in whatever
  // language it was typed in, and this archive is half Hebrew. Without it a
  // Hebrew snippet on the English page reads with its punctuation at the
  // wrong end — `saidBody` below makes the same repair for the same reason.
  const snip = el('p', 'convhitsnip');
  snip.setAttribute('dir', 'auto');
  // **The match is a STRUCTURE and not a marked string.** The index's own
  // `snippet()` wraps its match in `[` and `]`, which are ordinary
  // characters in this archive — a screen parsing them would draw a
  // highlight over a bracket somebody typed. `hit.passage` arrives already
  // cut into before/match/after, so the `<mark>` cannot land on the wrong
  // characters. `hit.snippet` is the fallback for a record the server could
  // not read back: narrow, and true.
  if (hit.passage === null || hit.passage === undefined) {
    snip.textContent = hit.snippet;
  } else {
    snip.append(hit.passage.before);
    if (hit.passage.match !== '') snip.append(el('mark', 'convhitmatch', hit.passage.match));
    snip.append(hit.passage.after);
  }
  row.append(snip);
  row.append(markRow(ctx, hit, term, onMarked));
  return row;
}

/**
 * One answer from `/api/conversations/search`, drawn.
 *
 * `term` is the words that were searched for and it travels down to
 * `markRow` as the default LABEL for a point marked from a hit — the same
 * default the server-composed `--label` carried before the write moved here.
 * `onMarked` refreshes the marked-points card, because a point that has just
 * been marked and a list that does not show it are two statements about one
 * archive.
 */
function drawHits(ctx, host, body, term = null, onMarked = () => {}) {
  host.replaceChildren();

  // **Three empty answers, and they are three different facts.** A query the
  // index cannot match at all, a scope that names nothing, and an archive that
  // genuinely does not hold the words. Collapsing them into one "no results"
  // is the defect `searchArchive` answers with an object to prevent.
  if (body.searchable === false) {
    const note = el('p', 'small convarchnote');
    note.textContent = body.note ?? '';
    host.append(note);
    return;
  }
  if (body.scopeNote !== null && body.scopeNote !== undefined) {
    const note = el('p', 'small convarchscopenote');
    note.textContent = body.scopeNote;
    host.append(note);
    host.append(...indexNote(ctx, body));
    return;
  }
  // **WHAT WAS DONE WITH HIS WORDS, BEFORE THE ANSWER AND BEFORE THE ZERO.**
  // A word this index cannot match is the commonest reason for an empty
  // answer and it is invisible in one — `INV-nothing-is-dropped-silently`, and
  // §5 TWO of `reports/2026-09-16-the-search-grammar.md`: the three-character
  // floor moved from the query to the TERM, and it says so.
  host.append(...queryNotes(ctx, body));

  if (body.hits.length === 0) {
    const zero = el('span', 'chip unmeas glyphed');
    zero.dataset.g = '◌';
    zero.append(...ctx.t('conv.arch.noMatch'));
    const line = el('p', 'small convarchnomatch');
    line.append(zero);
    host.append(spaced(line));
    if (body.undated > 0) {
      const note = el('p', 'small convarchundated');
      note.append(...ctx.t('conv.arch.undated', { n: body.undated }));
      host.append(note);
    }
    host.append(...indexNote(ctx, body));
    return;
  }

  const count = el('p', 'small convarchcount');
  count.append(...ctx.t('conv.arch.matched', { n: body.hits.length }));
  host.append(count);

  // ── THE ANSWER IN TIERS — `semantic/4`, §5 ONE ──────────────────────────
  //
  // One heading per reading that returned anything, and the rows under it, in
  // the order the server asked them: his words next to each other, then in the
  // same sentence, then anywhere in the same turn. **The heading is what a
  // relevance score cannot be**: it says WHY a row is where it is. Inside a
  // tier the rows are the server's `bm25()` order, which is the ranking
  // `RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` allows.
  //
  // **NO NEW CONTROL, and that is the whole shape of this feature.** §5's own
  // line: the failure mode is a Find dialog with nine checkboxes nobody ticks,
  // and the right number of new controls here is zero.
  for (const tier of body.tiers ?? []) {
    const rows = body.hits.filter((hit) => hit.tier === tier.tier);
    // A reading that matched nothing draws NO heading. An empty block under a
    // heading reads as a promise the archive broke; the tier simply did not
    // find anything the one above it had not already shown.
    if (rows.length === 0) continue;
    host.append(tierHead(ctx, tier, body));
    const list = el('div', 'convhits');
    for (const hit of rows) list.append(hitRow(ctx, hit, term, onMarked));
    host.append(list);
  }
  // A server that answered without tiers at all — an older one behind a
  // reloaded screen — still draws its hits rather than an empty card.
  if ((body.tiers ?? []).length === 0) {
    const list = el('div', 'convhits');
    for (const hit of body.hits) list.append(hitRow(ctx, hit, term, onMarked));
    host.append(list);
  }

  if (body.more === true) {
    const note = el('p', 'small convarchmore');
    note.append(...ctx.t('conv.arch.more', { n: body.hits.length }));
    host.append(note);
  }
  if (body.undated > 0) {
    const note = el('p', 'small convarchundated');
    note.append(...ctx.t('conv.arch.undated', { n: body.undated }));
    host.append(note);
  }
  host.append(...indexNote(ctx, body));
}

/**
 * **THE ADDRESS OF ONE MARKED POINT** — capability 4, "go to", owner ruling
 * 2026-09-12.
 *
 * A session's document is the app's own route and a lane's is `/lane.html`,
 * so this is two spellings of one idea and `sessionHref`/`laneHref` already
 * own that split. What is added is WHERE IN the document, which both carry the
 * same way: the byte offset the anchor holds.
 *
 * **A byte and not a node index**, and that is the whole reason this works at
 * all. A node index is the viewer's own count of what it folded and would move
 * the next time `work` runs are re-folded; the byte is what the anchor
 * actually stores and what `resolveAnchor` seeks to. The document resolves it
 * back to a row on arrival — `nodeAtByte` — so the two never have to agree in
 * advance.
 *
 * It is an ADDRESS and not a panel, for `rosterHref`'s reason: a reader can
 * copy it, bookmark it and open it in a tab of their own.
 */
export function anchorHref(anchor) {
  if (anchor.agentId !== null) {
    return `${laneHref(anchor.agentId)}&at=${encodeURIComponent(String(anchor.byteOffset))}`;
  }
  return `/#/conversations/at/${encodeURIComponent(anchor.sessionId)}/${anchor.byteOffset}`;
}

/** `#/conversations/at/<session>/<byte>`, or `null` when the hash is not one. */
export function anchorFromHash(hash) {
  const id = sessionFromHash(hash);
  if (id === null || !id.startsWith('at/')) return null;
  const rest = id.slice('at/'.length);
  const cut = rest.lastIndexOf('/');
  if (cut <= 0) return null;
  const sessionId = rest.slice(0, cut);
  const byte = rest.slice(cut + 1);
  if (sessionId === '' || !/^\d+$/.test(byte)) return null;
  return { sessionId, byteOffset: Number(byte) };
}

/**
 * **EVERY ANCHOR CAPABILITY, ON ONE ROW** — owner ruling 2026-09-12,
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`.
 *
 * What stood here drew the label, the kind and the stamp, and offered a
 * composed `--drop` command for a person to copy into a terminal. It is now
 * the whole set:
 *
 *   SEE      label, kind, origin, when, session, lane, byte — all seven of the
 *            details the item lists, because an anchor a reader cannot tell
 *            apart from another anchor is a list they stop reading
 *   GO TO    `a.convanchoropen`, the address above
 *   RELABEL  one field, in place
 *   DROP     a button that drops it
 *
 * **ORIGIN IS DRAWN, and it is the field that decides what the automatic pass
 * is allowed to do to this row.** A point marked for him and a point he marked
 * look identical until it is said, and the difference is exactly what the
 * sweep button below acts on: the pass reads back every `automatic` row and
 * never reads an `owner` one.
 *
 * ── AND IT IS PAGED, THROUGH THE HOUSE'S ONE `boundedList` ────────────────
 *
 * `TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and`
 * (`plan:confirm seq:3`). This drew every row: measured 2026-09-13 on a seeded
 * archive of **884 marked points — 16,799 elements in this box, 97.8% of every
 * element on the screen**, which reproduces the item's own 11,996 / 92% at a
 * larger count. The item's words for why that is a defect rather than a scale
 * problem: *"the anchors list is the first list in the product to break"* a
 * pattern every other list here holds.
 *
 * **PAGED AND NOT VIRTUALISED, and the choice is against the document two
 * hundred lines below rather than in ignorance of it.** `Scroller` virtualises
 * because a transcript node is inert text a reader only looks at. A row here
 * is not: it carries a rename field a reader may be typing into, a drop
 * button, and an `aria-live` region mid-sentence. Virtualisation destroys a
 * row the moment it leaves the viewport, which is the same failure `paint`
 * refuses one screen along — *"a rebuilt row is a `<details>` a reader opened
 * being shut"* — except here what is thrown away is a half-typed label. A page
 * step is a deliberate act, so nothing is destroyed under anybody's hands.
 *
 * It also costs nothing new to read: `boundedList` is the control the product
 * already has, already bilingual, already styled by `.bound button`, already
 * decided by `pageWindow` in `test/ui/bounded-list.test.ts`, and already
 * driven in the browser by `e2e/bounded-paging.spec.ts`.
 *
 * **`order: 'position'`, and it is a refusal rather than a default.** The
 * answer IS ordered — `ConversationIndex.anchorRows` reads the whole archive
 * `at DESC` and `matchAnchors` orders a label search the same way — so
 * `'recent'` looks right and its page-one sentence, *"Showing the 20 most
 * recent of 684"*, is true. Its PAGE-TWO sentence is not: `list.rowsRecent`
 * reads *"oldest first — the newest are last"*, which is written for
 * `take: 'last'`, the append-order reading every other `recent` caller in this
 * app passes. A list that is newest-FIRST has no sentence in the shared part,
 * and `orderKeyFor` picks by `order` alone. Claiming nothing on both pages
 * beats claiming the truth on one and its reverse on the other, and every row
 * here already carries its own stamp.
 *
 * `whole` is how many points there are when nothing is being searched for, or
 * `null` before that is known. It exists for the second half of the same item:
 * a filtered list said *"1 marked."* where every other list in the product
 * says *"the first N of M"*, so a reader who narrowed the list lost the size
 * of the thing they were narrowing. It is remembered by the caller from its
 * own unfiltered read rather than asked of the server, because the endpoint
 * answers with the count of what MATCHED and a second request to learn the
 * total would be a request spent on a number the screen already had.
 */
function drawAnchors(ctx, host, body, onChanged, whole = null) {
  host.replaceChildren();
  // **THE ARCHIVE HAS NEVER BEEN BUILT, and that is a third state.** Not "no
  // marked points" and not an error: there is nothing here to mark yet. The
  // sentence is the one the search card already uses for the same fact, and
  // the command that changes it is drawn beside it exactly as `indexNote`
  // draws it — one answer to "how do I turn this on", not two.
  if (body.indexed === false) {
    const note = el('p', 'small convanchnone');
    note.append(...ctx.t('conv.arch.neverIndexed'));
    host.append(spaced(note));
    const cmd = el('p', 'plate convcmd');
    cmd.append(mono(body.rebuild));
    host.append(cmd);
    return;
  }
  if (body.anchors.length === 0) {
    const note = el('p', 'small convanchnone');
    // Two empty answers, and they are two different facts: nothing is marked
    // at all, and nothing matches the words in the find box. Collapsing them
    // would let a reader read their own typing as a fact about the archive —
    // `drawHits`' three-empty-answers rule, one card along.
    note.append(...ctx.t(body.q === null ? 'conv.anchors.none' : 'conv.anchors.findNone'));
    host.append(note);
    return;
  }

  const count = el('p', 'small convanchcount');
  // A search that narrowed the list says what it narrowed. With no search, or
  // before the unfiltered read has answered once, the plain count is the whole
  // truth and "684 of 684" would be ceremony.
  if (body.q !== null && whole !== null) {
    count.append(...ctx.t('conv.anchors.countOf', { n: body.anchors.length, total: whole }));
  } else {
    count.append(...ctx.t('conv.anchors.count', { n: body.anchors.length }));
  }
  host.append(count);

  // `boundedList` OWNS the element it is given — it calls `replaceChildren` on
  // every page step — so it gets a container of its own and its returned bound
  // line is APPENDED. Discarding that return is what left the sessions list
  // above with twenty rows and no way to reach twenty-one.
  const list = el('div', 'convanchors');
  host.append(list);
  host.append(boundedList(
    ctx, list, body.anchors,
    (anchor) => anchorRow(ctx, anchor, onChanged),
    { cap: BOUND_CAP_LIST, order: 'position' },
  ));
}

/** One marked point, with everything it carries and everything it can do. */
function anchorRow(ctx, anchor, onChanged) {
  const row = el('div', 'convanchor');
  // **THE ROW SAYS WHICH POINT IT IS**, so that a write which does redraw the
  // list can put the caret back on the row it changed —
  // `TASK-every-write-on-conversations-throws-focus-to-the-document`. The id
  // is derived from the position, so it survives a rename and a put-back.
  row.dataset.anchor = anchor.id;
  const head = el('p', 'small convanchorwhere');
  /*
   * **THE NAME OF THE CONVERSATION IS TEXT, NOT THE LINK** —
   * `TASK-every-row-in-the-mark-list-links-with-the-same-word-because`, owner
   * ruling 2026-09-15: *"on a list where 24 marks sit in one conversation, all
   * 24 rows read the same word and none of them says what it does."*
   *
   * **The control did not change and none was added.** `a.convanchoropen` is
   * still the one go-to on this row, still carrying `anchorHref`, still the
   * element `e2e/anchors.spec.ts` drives. What moved is its TEXT: it is now
   * the byte at the tail of this line — the one field on the row that differs
   * between two marks in one session — and the session name it used to carry
   * is a `<bdi>` in the same place it always read, one word earlier in the
   * sentence. The item's own line: *"If the fix grows a control, it has gone
   * wrong."* Nothing here grows one, and the previous lane's refusal to add a
   * second button beside a working one still stands.
   *
   * **The byte is NOT drawn twice.** It was already at the end of this line as
   * plain text; the link is now wrapped around the text that was there rather
   * than repeating it, so the row says the position exactly once and the one
   * clickable thing on it is that position.
   *
   * `<bdi>` for the reason every label on this card is one: a Hebrew session
   * name inside an English sentence takes the sentence's direction unless it
   * is isolated.
   */
  const sessionLabel = anchor.sessionName ?? anchor.sessionTitle
    ?? anchor.sessionId.slice(0, 8);
  const session = el('bdi', 'convanchorsession');
  session.textContent = sessionLabel;
  head.append(session, ' ');
  const kind = el('span', 'convanchorkind');
  // **A kind this build has no word for is drawn AS ITSELF**, and the set is
  // checked here rather than by asking the string table, because `t()`
  // THROWS on a key it does not hold — and a throw inside a render is the
  // shape that leaves a tab showing nothing at all while every unit test
  // passes. The `anchors` table takes any `kind` string, so an anchor
  // written by a later build must still be readable on this one.
  const showKind = () => {
    kind.replaceChildren();
    /*
     * **THE GROUP CLASS IS REWRITTEN, NOT ADDED** —
     * `TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds`.
     *
     * This function runs again after a relabel, and a relabel may CHANGE the
     * kind — `apiAnchorRelabel` carries the new one back and `showKind` is
     * called with it. An `add()` would leave the old group's class behind
     * beside the new one, and with both present the stylesheet's source order
     * would silently pick a winner: a table re-kinded to a defect would keep
     * reading blue, which is worse than no colour at all because it is a
     * confident wrong answer.
     *
     * **BOTH CARRIERS, and they are not the same carrier twice.** The ROW takes
     * it for its rail — `.convanchor`'s 2px inline-start border, the thing a
     * reader sees down a long list in peripheral vision without reading
     * anything — and the KIND FIELD takes it for the word. That is the pair
     * `DEC-the-meaning-hue-budget-is-five-…`'s amendment asks for wherever
     * colour is spent: *rail, ground, weight AND word*.
     */
    const hue = kindHueClass(anchor.kind);
    row.className = `convanchor${hue}`;
    kind.className = `convanchorkind${hue}`;
    if (ANCHOR_KIND_KEYS.has(anchor.kind)) {
      // **The glyph is a MARK BESIDE the word, never instead of it.** `glyphed`
      // hides it from assistive tech and isolates the pair for bidi; the keyed
      // word stays exactly where it was and keeps its key, so `screen-literals`
      // and `strings-parity` measure the same thing they measured before.
      kind.append(glyphed(ANCHOR_KIND_GLYPH[anchor.kind],
        ctx.t(`conv.anchors.kind.${anchor.kind}`)));
    } else {
      kind.textContent = anchor.kind;
    }
  };
  showKind();
  head.append(kind);
  // **WHO MARKED IT.** The same two-value fact the sweep button acts on, said
  // where a reader can see it rather than left for them to infer from the kind.
  const origin = el('span', 'convanchororigin');
  origin.append(...ctx.t(anchor.origin === 'owner'
    ? 'conv.anchors.origin.owner' : 'conv.anchors.origin.automatic'));
  head.append(' · ', origin);
  const stamp = zonedStampOf(anchor.at, READER_ZONE);
  if (stamp !== null) { head.append(' · '); head.append(mono(stamp)); }
  // **THE LANE AND THE BYTE**, which are the two details a reader needs to
  // tell two marks in one session apart. `mono` isolates both for the reason
  // `.tvat` gives one screen along: an identifier inside a Hebrew paragraph
  // takes the paragraph's direction unless it is isolated.
  /*
   * **THREE STATES, AND THE MAIN SESSION IS NOT AN EMPTY LANE** —
   * `TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a`, owner
   * ruling 2026-09-15: *"you write Marked lane, it would be nice to see which
   * lane, which table, which report etc for every mark you add."*
   *
   *   `agentId === null`                 the MAIN SESSION marked it. 364 of
   *                                      his 750 are this, and drawing them
   *                                      as a lane with no name is exactly
   *                                      what `STD-a-measured-zero-is-drawn-
   *                                      and-named` forbids.
   *   `agentId` set, `laneName` set      the lane, in the name its dispatcher
   *                                      typed. `<bdi>` because a lane name
   *                                      is prose and this archive is half
   *                                      Hebrew.
   *   `agentId` set, `laneName` null     a lane the archive no longer holds a
   *                                      row for. Zero of his today, measured
   *                                      — and it is drawn anyway, because a
   *                                      state that is empty today is not a
   *                                      state that cannot happen.
   *
   * The ID IS STILL DRAWN beside the name, and that is not redundancy: two
   * lanes can carry the same description, and the id is what tells them apart
   * and what a reader pastes into `mycontext conversation`.
   */
  head.append(' · ');
  if (anchor.agentId === null) {
    head.append(...ctx.t('conv.anchors.inMain'));
  } else if (anchor.laneName !== null && anchor.laneName !== undefined) {
    head.append(...ctx.t('conv.anchors.inLane'));
    const named = el('bdi', 'convanchorlane');
    named.textContent = anchor.laneName;
    head.append(' ', named, ' ', mono(anchor.agentId));
  } else {
    head.append(...ctx.t('conv.anchors.inLaneGone'));
    head.append(' ', mono(anchor.agentId));
  }
  head.append(' · ');
  /*
   * **THE GO-TO, WEARING THE ONE FIELD THAT DIFFERS BETWEEN TWO MARKS IN ONE
   * CONVERSATION.** Same element, same class, same `href`, same title — the
   * text is the byte the anchor actually stores, which is also the number
   * `resolveAnchor` seeks to and the one a reader pastes into the CLI.
   *
   * **AND THE ACCESSIBLE NAME CARRIES BOTH**, because a screen reader hears
   * the link out of its row: on screen the surrounding sentence says which
   * conversation, and in a links list it does not. The item is explicit that
   * 24 links reading alike is worse there than here, so the name names the
   * conversation AND the byte, and it is the byte that makes each one
   * different.
   *
   * **Both substitutions are named rather than passed by shorthand**, and that
   * is load-bearing rather than a style: `test/ui/viewmodel.test.ts` reads
   * every slot out of this file by PARSING the argument object after the key,
   * so a shorthand property is a slot that gate cannot see.
   */
  const open = el('a', 'convanchoropen');
  open.href = anchorHref(anchor);
  open.append(...ctx.t('conv.anchors.byte'), ' ', mono(String(anchor.byteOffset)));
  open.title = ctx.tFlat('conv.anchors.goto');
  open.setAttribute('aria-label', ctx.tFlat('conv.anchors.gotoAt',
    { byte: String(anchor.byteOffset), where: sessionLabel }));
  head.append(open);
  row.append(head);

  const label = el('p', 'convanchorlabel');
  label.setAttribute('dir', 'auto');
  label.textContent = anchor.label;
  row.append(label);

  /*
   * **HIS FREE TEXT, WHICH HAD NOWHERE TO SHOW.** The column has been on the
   * row since anchors shipped and nothing on any screen drew it, so a note
   * written from the CLI was invisible in the product's own list. Drawn only
   * when there is one — an empty paragraph on 750 rows is the noise a
   * measured zero rule is about, and the absence of a note is not a fact a
   * reader needs stated per row.
   */
  const detail = el('p', 'small convanchornote');
  detail.setAttribute('dir', 'auto');
  const showNote = () => {
    const said = anchor.note ?? '';
    detail.textContent = said;
    detail.hidden = said === '';
  };
  showNote();
  row.append(detail);

  const said = el('p', 'small convanchorsaid');
  said.setAttribute('aria-live', 'polite');
  said.hidden = true;

  /* ── RELABEL, in place ───────────────────────────────────────────────── */
  const rename = el('button', 'convanchorrename');
  rename.type = 'button';
  rename.append(...ctx.t('conv.anchors.relabel'));

  const renamer = labelWrite(ctx, {
    value: anchor.label,
    named: 'label',
    labelKey: 'conv.anchors.relabelLabel',
    saveKey: 'conv.anchors.relabelSave',
    emptyKey: 'conv.anchors.relabelNeedsLabel',
    busyKey: 'conv.anchors.saving',
    boxClass: 'convanchorrenamebox',
    inputClass: 'convanchorrenameinput',
    saveClass: 'convanchorrenamesave',
    cancelClass: 'convanchorrenamecancel',
    said,
    kinds: true,
    kindValue: anchor.kind,
    kindClass: 'convanchorkindpick',
    details: true,
    detailValue: anchor.note ?? '',
    detailClass: 'convanchornoteinput',
    endpoint: '/api/conversations/anchors/relabel',
    body: (label, more) => ({ id: anchor.id, label, ...more }),
    done: (answer) => {
      /*
       * **THE ROW IS CORRECTED IN PLACE AND THE LIST IS NOT REDRAWN** —
       * `TASK-every-write-on-conversations-throws-focus-to-the-document`.
       *
       * This called `onChanged()`, which re-fetched and rebuilt the whole box.
       * That tore out the subtree the caret was in, so the browser dropped
       * focus to `document.body` — measured at **47 tab stops** back to this
       * very button, on a 26-point list in Chromium at 1280x720. It also reset
       * the page: a reader who renamed a row on page two was returned to page
       * one, holding a sentence about a row they can no longer see.
       *
       * Nothing about the LIST changed, so nothing about the list needs
       * redrawing. A rename moves a label and, at most, the origin; membership,
       * order and count are all untouched — `apiAnchorRelabel` carries `kind`
       * and `at` over deliberately, "re-deriving either would reorder his list
       * every time he fixed a typo". So the two fields that moved are written
       * from the row the server sent back, and the caret goes to the control
       * that opened the box.
       *
       * `answer.anchor` is known to be a row here: `labelWrite` refuses the
       * `{ anchor: null }` answer before `done` is reached.
       */
      const stored = answer.anchor;
      anchor.label = stored.label;
      anchor.origin = stored.origin;
      // **THE FIELDS THE FORM CAN NOW MOVE ARE READ BACK FROM THE ROW THE
      // SERVER STORED**, never from what was typed. `apiAnchorRelabel` decides
      // what a kind and a note become — an absent note keeps the standing
      // one, `null` clears it — so a row corrected from the FORM would be the
      // screen describing a write it did not read.
      anchor.kind = stored.kind;
      anchor.note = stored.note;
      label.textContent = stored.label;
      showKind();
      showNote();
      // **THE ROW BECOMES HIS, AND THE SCREEN SAYS SO.** Naming a point the
      // pass marked takes it out of the pass's hands — `apiAnchorRelabel` sets
      // `origin: 'owner'` precisely so the next sweep cannot quietly put his
      // label back to the grammar's. A reader who is not told that would find
      // out by the row changing under them, which is the silent half
      // `INV-nothing-is-dropped-silently` forbids. Said in the sentence AND
      // drawn in the field beside the kind, because the sentence is transient
      // and the field is what the row will still say tomorrow.
      origin.replaceChildren(...ctx.t(stored.origin === 'owner'
        ? 'conv.anchors.origin.owner' : 'conv.anchors.origin.automatic'));
      said.replaceChildren(...ctx.t(
        answer.tookOwnership === true
          ? 'conv.anchors.tookOwnership' : 'conv.anchors.relabelled',
      ));
      renamer.box.hidden = true;
      rename.focus();
    },
  });
  const renameBox = renamer.box;
  // The standing label goes back in every time the box opens, so a reader who
  // typed, shut it and came back is not handed their abandoned draft as if it
  // were the name the point has.
  boxToggle(rename, renameBox, renamer.input, (hidden) => {
    if (hidden) return;
    renamer.input.value = anchor.label;
    // The same rule applied to the two fields the box grew: what the point
    // HAS goes back in every time, so a reader who typed, shut it and came
    // back is not handed their abandoned draft as if it were what is stored.
    const picked = renameBox.querySelector('select');
    if (picked !== null) picked.value = anchor.kind;
    const said = renameBox.querySelector('textarea');
    if (said !== null) said.value = anchor.note ?? '';
  }, renamer);

  /* ── DROP ────────────────────────────────────────────────────────────── */
  // The whole row and not its id: the take-back has to name what went, decide
  // whether anything will ever mark it again, and know where to put it back.
  const drop = dropWrite(ctx, {
    anchor, said, dropClass: 'convanchordrop', done: onChanged,
  });

  const actions = el('div', 'convanchoractions');
  actions.append(rename, drop);
  row.append(actions, renameBox, said);
  return row;
}

/**
 * Mount both cards under the sessions list: the search over what was said, and
 * the points that are marked.
 *
 * Drawn only for an archive that HAS something in it, for `filterBar`'s own
 * reason: a search box over nothing can only ever answer "no match", which a
 * reader would read as a fact about their sessions rather than about an index
 * nobody has built. The two empty states above say what is actually true.
 */
function mountArchiveSearch(ctx, root, sessions) {
  const card = el('div', 'card pane convarch');
  const title = el('h3');
  title.append(...ctx.t('conv.arch.h'));
  const sub = el('p', 'small');
  sub.append(...ctx.t('conv.arch.sub'));
  card.append(title, spaced(sub));
  root.append(card);

  const results = el('div', 'convarchresults');
  const state = { q: null, session: null, kind: null, since: null, until: null };
  let inFlight = 0;

  const anchorsCard = el('div', 'card pane convanch');
  const anchorsTitle = el('h3');
  anchorsTitle.append(...ctx.t('conv.anchors.h'));
  const anchorsSub = el('p', 'small');
  anchorsSub.append(...ctx.t('conv.anchors.sub'));
  const anchorsBox = el('div', 'convanchorsbox');
  anchorsCard.append(anchorsTitle, spaced(anchorsSub));

  /* ── FIND, ACROSS THE SET — capability 3 ──────────────────────────────────
   *
   * It searches the LABELS and not the conversation, and the placeholder says
   * so, because the box above it searches the words and two search boxes on
   * one screen that quietly mean different things is how a real match gets
   * read as an absence. `searchAnchors`' own header draws the same line one
   * layer down.
   */
  // **`.convanchbar` ALONE, and NOT `.convfilter` beside it.** Reusing the
  // list's class for the look was the obvious move and it broke three tests in
  // another file by a route nothing here could see: `e2e/conversations.spec.ts`
  // finds the sessions card with `.card.pane` filtered by
  // `has: .convfilter`, so a second card wearing that class turned a
  // one-element locator into a strict-mode violation. A class is a HANDLE as
  // well as a style, and a new control does not get to rename an existing one
  // by sharing it — the same rule `.tvcount`, `.tvtop` and `.tvnew` are each
  // named for, one screen along.
  const findBar = el('div', 'convanchbar');
  findBar.setAttribute('role', 'search');
  findBar.setAttribute('aria-label', ctx.tFlat('conv.anchors.findRegion'));
  const findField = el('label', 'convfield');
  const findName = el('span', 'convfieldname');
  findName.append(...ctx.t('conv.anchors.find'));
  const find = el('input', 'convanchfind');
  find.type = 'search';
  find.setAttribute('dir', 'auto');
  findField.append(findName, find);
  findBar.append(findField);

  /* ── RUN THE AUTOMATIC PASS — capability 7, creation path 2 ───────────────
   *
   * Owner, 2026-09-12: *"i need a trigger in the ui to initiate anchores
   * creations if can't do it automatically which you told me you can."* Both
   * halves of that are true at once. The pass IS automatic — it marked 564 of
   * the 565 anchors in this workspace — and it could only ever START from a
   * terminal, which is this requirement's own defect in its purest form.
   *
   * **THE COST IS ON THE CONTROL AND THE RESULT IS SAID.** A whole-archive
   * walk measured at 8.6 s cold over 307 transcripts, so the button says so
   * before it is pressed, and `INV-nothing-is-dropped-silently` decides what
   * it says afterwards: newly marked, renamed, and TAKEN BACK. A button that
   * runs a nine-second walk and says nothing is a button nobody presses twice.
   *
   * **No confirm**, because the pass is safe to press twice and that is
   * measured rather than hoped: it reads back only `origin: automatic` rows,
   * never reads one the reader marked, and a second run immediately after a
   * first reports 0 new, 0 taken back, 0 renamed.
   */
  const sweep = el('button', 'convanchsweep');
  sweep.type = 'button';
  sweep.append(...ctx.t('conv.anchors.sweep'));
  const sweepSub = el('p', 'small convanchsweepsub');
  sweepSub.append(...ctx.t('conv.anchors.sweepSub'));
  const sweepSaid = el('p', 'small convanchsweepsaid');
  sweepSaid.setAttribute('aria-live', 'polite');
  sweepSaid.hidden = true;
  const sweepBox = el('div', 'convanchsweepbox');
  sweepBox.append(sweep, spaced(sweepSub), sweepSaid);

  /* ── WHAT A WRITE LEFT BEHIND, AND THE ONE WAY BACK ──────────────────────
   *
   * `TASK-take-it-back-deletes-immediately-with-no-confirm-no-undo-and`.
   *
   * **IT IS OUTSIDE `anchorsBox`, and that is the whole of why it works.**
   * Every row carries its own `aria-live` region and a take-back writes into
   * it — and then the list redraws and the row, the region and the sentence go
   * together. The item records that as "no announcement", over code that
   * plainly writes one, because nothing a reader or a screen reader could
   * reach ever saw it. This region is mounted once, at the card, and no anchor
   * redraw touches it.
   *
   * **Above the list rather than below it.** What it describes is a row that
   * is no longer there, and a sentence about an absence placed under the list
   * would be read after the reader has already gone looking for the row.
   *
   * `tabIndex = -1` so it can take the caret when there is no button to take
   * it — focusable, and not a tab stop of its own.
   */
  const anchorsSaid = el('div', 'convanchsaid');
  anchorsSaid.setAttribute('aria-live', 'polite');
  anchorsSaid.tabIndex = -1;
  anchorsSaid.hidden = true;

  anchorsCard.append(findBar, sweepBox, anchorsSaid, anchorsBox);
  root.append(anchorsCard);

  const idle = () => {
    results.replaceChildren();
    const note = el('p', 'small convarchidle');
    note.append(...ctx.t('conv.arch.idle', { n: 3 }));
    results.append(note);
  };

  const anchorState = { q: null };
  let anchorsInFlight = 0;
  /**
   * How many marked points there are with nothing being searched for.
   *
   * `null` until the unfiltered read at mount has answered, and re-learned on
   * every later unfiltered read, so a point marked or dropped while the card
   * is open moves it. `drawAnchors`' own header says why the screen keeps this
   * rather than asking for it.
   */
  let anchorsWhole = null;

  const refreshAnchors = async () => {
    const mine = ++anchorsInFlight;
    let body;
    const query = anchorState.q === null ? '' : `?q=${encodeURIComponent(anchorState.q)}`;
    try {
      body = await ctx.api(`/api/conversations/anchors${query}`);
    } catch (error) {
      if (mine !== anchorsInFlight) return;
      anchorsBox.replaceChildren(errorNote(error.message));
      return;
    }
    // A later answer must never be overwritten by an earlier one that arrived
    // late — `filterBar`'s counter, for the same reason.
    if (mine !== anchorsInFlight) return;
    if (anchorState.q === null) anchorsWhole = body.anchors.length;
    drawAnchors(ctx, anchorsBox, body, onAnchorChanged, anchorsWhole);
  };

  /**
   * The caret, on the row a write just put back — or on the sentence, when
   * that row is not on this page.
   *
   * A restored point can land on any page of a bounded list, and a list that
   * silently did nothing visible would be the same defect this whole item is
   * about. The region is always there, so there is always somewhere honest for
   * the caret to be.
   */
  const focusAnchorRow = (id) => {
    const back = anchorsBox.querySelector(
      `.convanchor[data-anchor="${CSS.escape(id)}"] .convanchorrename`);
    if (back !== null) { back.focus(); return; }
    anchorsSaid.focus();
  };

  /**
   * What the list does after one of its own writes.
   *
   * `taken` is the row a take-back removed, or `null` for every other change —
   * a mark from the search card above, a sweep, a put-back. Only a removal has
   * anything to announce here, because only a removal destroys the row that
   * was going to do the announcing.
   */
  const onAnchorChanged = async (taken = null) => {
    if (taken === null || taken === undefined) { await refreshAnchors(); return; }
    const back = sayTakenBack(ctx, anchorsSaid, taken, 'convanchputback', async (button) => {
      await putBackAnchor(ctx, anchorsSaid, taken, button, async (restored) => {
        await refreshAnchors();
        focusAnchorRow(restored.id);
      });
    });
    await refreshAnchors();
    // **THE CARET FOLLOWS THE ROW THAT IS GONE.** It was on the take-back
    // button, which the redraw removed; before this it fell to `document.body`
    // and the way back was twenty-four stops of tabbing. It lands on the way
    // back where there is one, and on the sentence where there is not.
    if (back !== null) back.focus(); else anchorsSaid.focus();
  };

  const findTyping = settler(ARCH_SETTLE_MS, () => {
    const typed = find.value.trim();
    anchorState.q = typed === '' ? null : typed;
    void refreshAnchors();
  });
  find.addEventListener('input', findTyping.settle);

  /**
   * **THE FIRST PRESS IN A WORKSPACE THE PASS HAS NEVER MARKED IS A BULK ACT,
   * SO IT IS SHOWN BEFORE IT HAPPENS** —
   * `TASK-a-user-who-installs-mycontext-mid-project-has-conversations`, owner
   * request 2026-09-16.
   *
   * Nobody starts a project by installing this plugin. The ordinary case is a
   * repository with months of Claude Code sessions already on disk, and this
   * button is one of the two doors those conversations come through. Measured
   * that day on a DIFFERENT real project's archive on this machine — 13,375
   * turns, 575 helper agents — that first press marks **1,213 points at once**:
   * 907 tables, 275 lane reports, 31 rulings. `anchors/9` measured that 1,155
   * marks was already enough to make the rare kinds hard to find.
   *
   * **"Safe to press twice" is still true and is not the point.** A press that
   * can be undone is not the same as a press whose size the reader expected.
   * So the first one asks the server what it WOULD do, draws the count per
   * kind and a label of each, and waits. Every later press is exactly what it
   * was: one press, one run, no confirm — `report.firstRun` from the route is
   * what tells the two apart, and it is the server's own count of the rows the
   * pass owns rather than anything this screen infers from a paged list.
   */
  const runSweep = async () => {
    sweep.disabled = true;
    sweepSaid.hidden = false;
    sweepSaid.replaceChildren(...ctx.t('conv.anchors.sweepRunning'));
    let answer;
    try {
      answer = await ctx.post('/api/conversations/anchors/sweep', {});
    } catch (error) {
      sweepSaid.replaceChildren(errorNote(error.message));
      sweep.disabled = false;
      return;
    }
    sweep.disabled = false;
    drawSweepReport(answer);
  };

  /** The plan, drawn as something a reader can refuse. */
  const drawSweepPlan = (report) => {
    const said = [];
    const head = el('p', 'small');
    head.append(...ctx.t('conv.anchors.sweepPlan', { marked: report.marked }));
    said.push(head);
    const kinds = el('ul', 'small convanchsweepkinds');
    for (const kind of ['table', 'report', 'ruling']) {
      const n = report.byKind === undefined ? 0 : report.byKind[kind];
      if (!n) continue;
      const row = el('li');
      row.append(`${n} × `, ...ctx.t(`conv.anchors.kind.${kind}`));
      kinds.append(row);
    }
    said.push(kinds);
    if (Array.isArray(report.samples) && report.samples.length > 0) {
      const lead = el('p', 'small');
      lead.append(...ctx.t('conv.anchors.sweepPlanSamples'));
      said.push(lead);
      const list = el('ul', 'small convanchsweepsamples');
      for (const sample of report.samples) {
        const row = el('li');
        row.append(sample.label);
        list.append(row);
      }
      said.push(list);
    }
    const go = el('button', 'convanchsweepgo');
    go.type = 'button';
    go.append(...ctx.t('conv.anchors.sweepPlanGo', { marked: report.marked }));
    go.addEventListener('click', () => { void runSweep(); });
    const no = el('button', 'convanchsweepno');
    no.type = 'button';
    no.append(...ctx.t('conv.anchors.sweepPlanNo'));
    no.addEventListener('click', () => {
      sweepSaid.replaceChildren(...ctx.t('conv.anchors.sweepPlanNone'));
    });
    const row = el('p', 'convanchsweepchoice');
    row.append(go, no);
    said.push(row);
    sweepSaid.replaceChildren(...said);
  };

  sweep.addEventListener('click', () => {
    void (async () => {
      sweep.disabled = true;
      sweepSaid.hidden = false;
      sweepSaid.replaceChildren(...ctx.t('conv.anchors.sweepPlanning'));
      let plan;
      try {
        plan = await ctx.post('/api/conversations/anchors/sweep', { plan: true });
      } catch (error) {
        sweepSaid.replaceChildren(errorNote(error.message));
        sweep.disabled = false;
        return;
      }
      sweep.disabled = false;
      const planned = plan === null || typeof plan !== 'object' ? null : plan.report;
      if (planned !== null && planned !== undefined
        && plan.firstRun === true && planned.marked > 0) {
        drawSweepPlan(planned);
        return;
      }
      // Not a first press, or a first press with nothing to mark: the button
      // behaves exactly as it did before this item — one press, one run.
      await runSweep();
    })();
  });

  /** What the run said, drawn — unchanged since 2026-09-12 but for its name. */
  function drawSweepReport(answer) {
    const report = answer === null || typeof answer !== 'object' ? null : answer.report;
    if (report === null || report === undefined) {
      sweepSaid.replaceChildren(...ctx.t('conv.arch.neverIndexed'));
      return;
    }
    const said = [];
    // **THE THREE COUNTS, ALWAYS**, including when every one of them is
    // zero: "nothing changed" is the answer that proves the pass is
    // idempotent, and a screen that drew nothing on a run that changed
    // nothing would be indistinguishable from one whose button did not work.
    const line = el('p', 'small');
    line.append(...ctx.t(
      report.marked === 0 && report.relabelled === 0 && report.dropped === 0
        ? 'conv.anchors.sweepNone' : 'conv.anchors.sweepDone',
      {
        marked: report.marked, relabelled: report.relabelled,
        dropped: report.dropped, ms: report.ms,
      },
    ));
    said.push(line);
    // A capped pass and a complete one must not look the same — the same
    // disclosure `searchLines` makes at the terminal, on the screen that now
    // starts the pass.
    if (report.capped === true) {
      const capped = el('p', 'small convanchsweepcapped');
      capped.append(...ctx.t('conv.anchors.sweepCapped'));
      said.push(capped);
    }
    sweepSaid.replaceChildren(...said);
    void refreshAnchors();
  }

  const refresh = async (next) => {
    Object.assign(state, next);
    if (state.q === null) { idle(); return; }
    const mine = ++inFlight;
    results.replaceChildren();
    const waiting = el('p', 'small convarchwait');
    waiting.append(...ctx.t('conv.arch.searching'));
    results.append(waiting);
    let body;
    try {
      body = await ctx.api(`/api/conversations/search${archiveQuery(state)}`);
    } catch (error) {
      // A later answer must never be overwritten by an earlier one that
      // arrived late — `filterBar`'s counter, for the same reason.
      if (mine !== inFlight) return;
      results.replaceChildren(errorNote(error.message));
      return;
    }
    if (mine !== inFlight) return;
    drawHits(ctx, results, body, state.q, () => { void refreshAnchors(); });
    void refreshAnchors();
  };

  card.append(archiveBar(ctx, sessions, state, (next) => { void refresh(next); }));
  card.append(results);
  idle();
  void refreshAnchors();

  // **RECONSTRUCT, below search and anchors** — `plan:recall seq:2` Task 11.
  // Search finds a turn; this reconstructs a SUBJECT out of many, and it is
  // last because it is the heaviest thing on the screen and the one a reader
  // reaches for when the two above have not been enough.
  mountRetrieval(ctx, root);
}
/* ══ RECONSTRUCT — `plan:recall seq:2`, Tasks 11 and 12 ════════════════════
 *
 * THE SCREEN DOES NOT ANSWER OUT OF THE ARCHIVE. It composes a MISSION for a
 * subagent that reads in a window of its own, verifies against the code and
 * git, and writes back a small cited file; then the owner reads that file here
 * and chooses what, if anything, comes back. §8, §9, §10 and §10a of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── THE SAFETY BOUNDARY, AND WHY THIS FILE CANNOT BREAK IT ────────────────
 *
 * The plan's own self-review: Task 11 step 2 is *"the safety boundary.
 * Everything else can be imperfect; this one cannot."* Nothing reaches the
 * owner's context until he chooses it — and on this screen that is not a rule
 * anybody has to keep, it is a fact about what the page can do. The two POSTs
 * that RENDER — the brief and the marking — write nothing, and the read
 * surface behind them is proved byte-for-byte by `test/ui/server-e2e.test.ts`.
 * The only route the marked text has into THIS window is the owner's own copy
 * and paste, and `conv.recall.safe` says exactly that, on screen, in both
 * languages, beside the text it is true of.
 *
 * **What changed on 2026-09-12 is the OTHER destination, and it did not move
 * this boundary.** The screen now stages a return for a FRESH window
 * (`POST /api/retrieval/stage`) instead of composing a command for a terminal.
 * Staging is not delivery: the record is a PROPOSAL, the question the injection
 * asks — `approvedRestore` — still answers nothing afterwards, approving is a
 * separate confirm behind a single-use nonce, and clearing the window has no
 * verb anywhere in this product.
 *
 * ── WHAT IS DRAWN, IN THE ORDER IT IS DRAWN ───────────────────────────────
 *
 *   1. THE FOUR MODES (§4, step 1), scoped by session and date. All four ship
 *      by owner ruling, and they come from the SERVER rather than being typed
 *      here, so "which modes exist" has one answer.
 *   2. THE BRIEF. `missionText` is pure, so the page shows the owner exactly
 *      what a subagent would be told before anything is dispatched — including
 *      the *nothing to match on* answer, which is SHOWN rather than hidden: a
 *      guess that resolves is worse than silence.
 *   3. THE RESULTS, and one read: its claims numbered, its findings, and
 *      whether its citations still resolve.
 *   4. THE CHOICE (steps 3 and 4). He ticks what returns — one line is a legal
 *      answer, which is his own example — and what comes back is MARKED:
 *      dated, stated a record rather than an instruction, and a ruling since
 *      reversed says so at the top.
 *   5. THE SECOND DESTINATION (§10a, steps 4a-4c): a fresh window, through
 *      D34's carrier, STAGED BY THIS SCREEN before the clear and delivered
 *      only after his approval and his clear. Both acts are on the screen —
 *      the stage, and the confirm that spends his click as the `'human'`
 *      `approveStagedRestore` insists on.
 *
 * ── AND IT IS MOUNTED TWICE, WHICH IS STEP 6's REASON ─────────────────────
 *
 * Once on the archive screen and once inside `mountDocument`, which is what
 * `/lane.html` and the session document both run. The document's copy of it is
 * SEEDED from the marked passage, because §3's whole finding is that a
 * selection is not a guess at the subject — it IS the subject — and the moment
 * he has one marked is the moment the offer is worth making.
 */

/** The mode picked when the panel opens, and the reason it is this one. */
const DEFAULT_MODE = 'from-selection';

/**
 * **The retrieval panel.** `seed` is a function returning the passage the host
 * can offer — the document's marked selection, or nothing on the archive
 * screen, which is why it is a function rather than a string: the selection
 * changes under the panel and reading it at mount would pin the first one.
 */
function mountRetrieval(ctx, host, seed = () => '', collapsed = false) {
  /**
   * **On a DOCUMENT it starts closed, and that is a measurement rather than a
   * taste.** `e2e/conversations.spec.ts`' bare-lane test asserts that the well
   * takes the room the rail and the strip gave up — `share > 0.55` — and
   * mounting this panel open at the foot of `/lane.html` dropped that to
   * **0.333**. The panel is chrome, and a window whose whole purpose is one
   * document may not spend two thirds of itself on chrome nobody asked for.
   *
   * So the document mounts it closed and the copy bar's control opens it,
   * which is the better shape anyway: the offer is made at the moment he has a
   * passage marked, and costs nothing until then. The archive screen, whose
   * subject IS this, mounts it open.
   */
  const box = el('div', 'convrecallbox');
  box.hidden = collapsed;
  host.append(box);
  host = box;

  const card = el('div', 'card pane convrecall');
  const title = el('h3');
  title.append(...ctx.t('conv.recall.h'));
  const sub = el('p', 'small');
  sub.append(...ctx.t('conv.recall.sub'));
  card.append(title, spaced(sub));
  host.append(card);

  const state = { mode: DEFAULT_MODE, round: null, result: null };

  /* ── 1. the four modes ─────────────────────────────────────────────────── */
  const modeHead = el('p', 'small convrecallmodeh');
  modeHead.append(...ctx.t('conv.recall.mode.h'));
  const modes = el('div', 'convrecallmodes');
  modes.setAttribute('role', 'radiogroup');
  modes.setAttribute('aria-label', ctx.tFlat('conv.recall.mode.h'));
  card.append(modeHead, modes);

  const passageBox = el('div', 'convrecallpassagebox');
  const passageLabel = el('label', 'small convrecallpassagel');
  passageLabel.append(...ctx.t('conv.recall.passage.label'));
  const passage = el('textarea', 'convrecallpassage');
  passage.rows = 4;
  passageLabel.htmlFor = 'convrecallpassage';
  passage.id = 'convrecallpassage';
  const passageHint = el('p', 'small convrecallpassagehint');
  passageHint.append(...ctx.t('conv.recall.passage.hint'));
  passageBox.append(passageLabel, passage, passageHint);
  card.append(passageBox);

  /**
   * A mode button. `aria-checked` rather than a class alone, because the group
   * is a radiogroup and a reader who cannot see the highlight has to be told
   * which one is armed — and because a test can then name the ARMED one rather
   * than counting styles.
   */
  const drawModes = () => {
    modes.replaceChildren();
    for (const entry of state.modes ?? []) {
      const button = el('button', 'tvjump convrecallmode');
      button.type = 'button';
      button.dataset.mode = entry.mode;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', entry.mode === state.mode ? 'true' : 'false');
      button.append(...ctx.t(`conv.recall.mode.${entry.mode}`));
      button.addEventListener('click', () => {
        state.mode = entry.mode;
        // Picking a mode drops any round-2 the last one set up: a second round
        // is about a subject he chose, and choosing a different way IN is
        // starting over rather than narrowing.
        state.round = null;
        round.hidden = true;
        drawModes();
      });
      modes.append(button);
      if (entry.mode === state.mode) passageBox.hidden = entry.needsText !== true;
    }
  };

  /* ── the scope, §12 ────────────────────────────────────────────────────── */
  const scope = el('div', 'convrecallscope');
  const scopeHead = el('span', 'small');
  scopeHead.append(...ctx.t('conv.recall.scope.h'));
  const session = el('input', 'convrecallsession');
  session.type = 'text';
  session.placeholder = ctx.tFlat('conv.recall.scope.any');
  session.setAttribute('aria-label', ctx.tFlat('conv.recall.scope.session'));
  const since = el('input', 'convrecallsince');
  since.type = 'date';
  since.setAttribute('aria-label', ctx.tFlat('conv.recall.scope.from'));
  const until = el('input', 'convrecalluntil');
  until.type = 'date';
  until.setAttribute('aria-label', ctx.tFlat('conv.recall.scope.to'));
  scope.append(scopeHead, session, since, until);
  card.append(scope);

  /** The round-2 banner. Hidden until he has picked a subject out of a list. */
  const round = el('p', 'small convrecallround');
  round.hidden = true;
  card.append(round);

  const prepare = el('button', 'tvjump convrecallprepare');
  prepare.type = 'button';
  prepare.append(...ctx.t('conv.recall.prepare'));
  card.append(prepare);

  const brief = el('div', 'convrecallbrief');
  brief.setAttribute('aria-live', 'polite');
  card.append(brief);

  /* ── 2. the brief ──────────────────────────────────────────────────────── */
  const drawBrief = (body) => {
    brief.replaceChildren();

    // **The query, and the refusal, both drawn.** `matchable: false` is a
    // STATED answer and not an empty list: `queryFromPassage` refuses a
    // word-bag fallback because a guess that resolves is worse than silence,
    // and a screen that drew nothing here would turn that refusal back into
    // silence one layer up.
    const q = el('div', 'convrecallquery');
    const qh = el('h4');
    qh.append(...ctx.t('conv.recall.query.h'));
    q.append(qh);
    if (body.query.matchable !== true) {
      const none = el('p', 'small convrecallnomatch');
      none.append(...ctx.t('conv.recall.query.none'));
      q.append(none);
      if (body.query.note !== null) {
        const note = el('p', 'small convrecallnote');
        note.append(body.query.note);
        q.append(note);
      }
    } else {
      if (body.query.names.length > 0) {
        const names = el('p', 'small convrecallnames');
        names.append(...ctx.t('conv.recall.query.names'), ' ');
        for (const name of body.query.names) names.append(mono(name), ' ');
        q.append(names);
      }
      if (body.query.terms.length > 0) {
        const terms = el('p', 'small convrecallterms');
        terms.append(...ctx.t('conv.recall.query.terms'), ' ');
        for (const term of body.query.terms) terms.append(mono(term), ' ');
        q.append(terms);
      }
    }
    brief.append(q);

    const mh = el('h4');
    mh.append(...ctx.t('conv.recall.mission.h'));
    const hint = el('p', 'small');
    hint.append(...ctx.t('conv.recall.mission.hint'));
    const text = el('pre', 'convrecallmission');
    text.append(body.text);
    brief.append(mh, spaced(hint), text, copyButton(ctx, 'conv.recall.mission.copy',
      () => body.text, 'convrecallmissioncopy'));
    const where = el('p', 'small');
    where.append(...ctx.t('conv.recall.mission.where'));
    brief.append(where);
  };

  prepare.addEventListener('click', async () => {
    brief.replaceChildren(waiting(ctx, 'conv.recall.preparing'));
    const request = {
      mode: state.mode,
      passage: passage.value,
      scope: {
        sessionId: session.value.trim() === '' ? null : session.value.trim(),
        from: since.value === '' ? null : since.value,
        to: until.value === '' ? null : until.value,
      },
    };
    if (state.round !== null) request.round = state.round;
    let body;
    try {
      body = await ctx.post('/api/retrieval/mission', request);
    } catch (error) {
      brief.replaceChildren(errorNote(error.message));
      return;
    }
    drawBrief(body);
  });

  /* ── 3. the results, and one read ──────────────────────────────────────── */
  const resultsCard = el('div', 'card pane convrecallresults');
  const resultsTitle = el('h3');
  resultsTitle.append(...ctx.t('conv.recall.results.h'));
  const resultsBox = el('div', 'convrecallresultsbox');
  resultsCard.append(resultsTitle, resultsBox);
  host.append(resultsCard);

  const readBox = el('div', 'convrecallread');
  readBox.setAttribute('aria-live', 'polite');
  resultsCard.append(readBox);

  const drawResults = (body) => {
    resultsBox.replaceChildren();
    // **The privacy boundary, said on the workspace the reader is looking at.**
    // A test proves `.gitignore` holds the rule today; this proves it here, in
    // a copy, a worktree, or a checkout somebody has edited. It is a WARNING
    // and not a silent absence, because what leaks is conversation text.
    const where = el('p', body.ignored === true ? 'small convrecalldir' : 'small warn convrecallleak');
    where.append(...ctx.t(body.ignored === true ? 'conv.recall.results.dir'
      : 'conv.recall.results.leak', { dir: body.dir }));
    resultsBox.append(where);

    if (body.results.length === 0) {
      const none = el('p', 'small convrecallnoresults');
      none.append(...ctx.t('conv.recall.results.none'));
      resultsBox.append(none);
      return;
    }
    for (const row of body.results) {
      const line = el('div', 'convrecallrow');
      // **`data-result`, and NOT `data-id`.** `installItemPane` in `app.js`
      // opens the item pane on a click anywhere inside ANY `[data-id]`, so the
      // first draft of this row hijacked every press of its own Read button
      // and opened a pane reading "no item recall-0001 in this corpus". A
      // retrieval result is not a corpus item and has no id in that namespace.
      // Found by looking at the screen; no unit test could have seen it.
      line.dataset.result = row.id;
      const name = el('span', 'convrecallrowid');
      name.append(mono(row.id));
      const facts = el('span', 'small convrecallrowfacts');
      facts.append(...ctx.t('conv.recall.results.row',
        { n: row.claims, mode: row.mode, at: row.at }));
      const open = el('button', 'tvjump convrecallopen');
      open.type = 'button';
      open.append(...ctx.t('conv.recall.open'));
      open.addEventListener('click', () => { void openResult(row.id); });
      line.append(name, facts, open);
      resultsBox.append(line);
    }
  };

  const refreshResults = async () => {
    let body;
    try {
      body = await ctx.api('/api/retrieval');
    } catch (error) {
      resultsBox.replaceChildren(errorNote(error.message));
      return;
    }
    state.modes = body.modes;
    drawModes();
    drawResults(body);
  };

  async function openResult(id) {
    readBox.replaceChildren(waiting(ctx, 'conv.recall.returning'));
    let body;
    try {
      body = await ctx.api(`/api/retrieval/${encodeURIComponent(id)}`);
    } catch (error) {
      readBox.replaceChildren(errorNote(error.message));
      return;
    }
    state.result = body;
    drawResult(body);
  }

  const drawResult = (body) => {
    readBox.replaceChildren();
    const head = el('h4');
    head.append(...ctx.t('conv.recall.result.h'));
    readBox.append(head);

    // **A result that has aged SAYS SO**, and `unchecked` is said separately
    // rather than folded in. Citations nothing could check are not citations
    // that checked out — `INV-nothing-is-dropped-silently`, and `aged` is
    // driven by `unresolved` alone for exactly that reason.
    if (body.age.aged === true) {
      const aged = el('p', 'small warn convrecallaged');
      aged.append(...ctx.t('conv.recall.result.aged', { n: body.age.unresolved }));
      readBox.append(aged);
    }
    if (body.age.unchecked > 0) {
      const unchecked = el('p', 'small convrecallunchecked');
      unchecked.append(...ctx.t('conv.recall.result.unchecked', { n: body.age.unchecked }));
      readBox.append(unchecked);
    }
    for (const finding of body.findings) {
      const line = el('p', 'small warn convrecallfinding');
      line.append(...ctx.t('conv.recall.result.finding'), ' ', finding.detail);
      readBox.append(line);
    }

    const pick = el('p', 'small convrecallpick');
    pick.append(...ctx.t('conv.recall.result.pick'));
    readBox.append(pick);

    const list = el('div', 'convrecallclaims');
    for (const claim of body.claims) {
      const row = el('div', 'convrecallclaim');
      row.dataset.n = String(claim.n);
      const tick = el('input', 'convrecalltick');
      tick.type = 'checkbox';
      tick.checked = true;
      tick.dataset.n = String(claim.n);
      tick.setAttribute('aria-label', claim.text);
      // **`<bdi>`, which is what archive-supplied text wears on this screen.**
      // A claim is a sentence a subagent wrote about a conversation that may be
      // in either language, and the page it is drawn on may be in either too.
      // A bare span took the PARAGRAPH's direction, and the Hebrew screenshot
      // showed an English claim with its full stop at the left-hand end.
      // `<bdi>` infers direction from the text's own first strong character —
      // the same treatment `convtitle` already gives a session title, and the
      // reason `bdi{unicode-bidi:isolate}` is in the stylesheet at all.
      const text = el('bdi', 'convrecallclaimtext');
      text.append(claim.text);
      row.append(tick, text);
      for (const citation of claim.citations) {
        const chip = el('span', 'chip convrecallcite');
        chip.dataset.kind = citation.kind;
        chip.append(mono(`${citation.kind} ${citation.where}`));
        row.append(chip);
      }
      // **Task 12 — rounds compose.** One claim of a subject list is a subject,
      // and this is where he picks it: the next brief names it and tells the
      // helper not to answer with another list.
      const deeper = el('button', 'tvjump convrecalldeeper');
      deeper.type = 'button';
      deeper.append(...ctx.t('conv.recall.result.deeper'));
      deeper.addEventListener('click', () => {
        state.round = { n: 2, subject: claim.text, from: body.path };
        round.replaceChildren();
        round.append(...ctx.t('conv.recall.round2'), ' ');
        round.append(...ctx.t('conv.recall.round2.of', { subject: claim.text }));
        round.hidden = false;
        brief.replaceChildren();
        round.scrollIntoView({ block: 'nearest' });
      });
      row.append(deeper);
      list.append(row);
    }
    readBox.append(list);

    const show = el('button', 'tvjump convrecallreturn');
    show.type = 'button';
    show.append(...ctx.t('conv.recall.return'));
    const marked = el('div', 'convrecallmarked');
    marked.setAttribute('aria-live', 'polite');
    show.addEventListener('click', async () => {
      const chosen = [...list.querySelectorAll('input.convrecalltick')]
        .filter((box) => box.checked).map((box) => Number(box.dataset.n));
      marked.replaceChildren(waiting(ctx, 'conv.recall.returning'));
      let answer;
      try {
        answer = await ctx.post('/api/retrieval/return', { id: body.id, claims: chosen });
      } catch (error) {
        marked.replaceChildren(errorNote(error.message));
        return;
      }
      drawMarked(marked, answer, { id: body.id, claims: chosen });
    });
    readBox.append(show, marked);
  };

  /* ── 4 and 5. what returns, marked — and the two destinations ──────────── */
  /**
   * `asked` is the SAME `{ id, claims }` the preview was computed from, carried
   * here so the stage below re-sends it rather than re-deriving it off the
   * ticks — which would let the reader change a tick after reading the text and
   * then stage something he never read.
   */
  const drawMarked = (host2, body, asked) => {
    host2.replaceChildren();
    const head = el('h4');
    head.append(...ctx.t('conv.recall.marked.h'));
    host2.append(head);

    // **THE SENTENCE THE WHOLE FEATURE RESTS ON**, drawn before the text it is
    // true of rather than under it. A reader who stops reading after the first
    // line has still been told.
    const safe = el('p', 'small convrecallsafe');
    safe.append(...ctx.t('conv.recall.safe'));
    host2.append(safe);

    // The reversals, as their own region — never only inside the text. The
    // text says it too, and it must: the text is what travels. This is for the
    // reader who is deciding whether to send it at all.
    if (body.reversed.length > 0) {
      const box = el('div', 'convrecallreversed');
      const rh = el('h5');
      rh.append(...ctx.t('conv.recall.reversed.h'));
      box.append(rh);
      for (const ruling of body.reversed) {
        const line = el('p', 'small warn convrecallreversedone');
        line.append(...ctx.t(
          ruling.supersededBy === null ? 'conv.recall.reversed.orphan' : 'conv.recall.reversed.one',
          { id: ruling.id, status: ruling.status, by: ruling.supersededBy ?? '' },
        ));
        box.append(line);
      }
      host2.append(box);
    }
    if (body.unknown.length > 0) {
      const box = el('div', 'convrecallunknown');
      const uh = el('h5');
      uh.append(...ctx.t('conv.recall.unknown.h'));
      const hint = el('p', 'small');
      hint.append(...ctx.t('conv.recall.unknown.hint'));
      box.append(uh, hint);
      for (const id of body.unknown) {
        const line = el('p', 'small convrecallunknownone');
        line.append(mono(id));
        box.append(line);
      }
      host2.append(box);
    }

    const text = el('pre', 'convrecallmarkedtext');
    text.append(body.text);
    host2.append(text);

    const portion = el('p', 'small convrecallportion');
    portion.append(...ctx.t('conv.recall.marked.portion', {
      chosen: body.chosen.length, total: body.chosen.length + body.left, left: body.left,
    }));
    host2.append(portion);
    host2.append(copyButton(ctx, 'conv.recall.marked.copy', () => body.text,
      'convrecallmarkedcopy'));

    /* ── the SECOND destination, §10a — AND THE SCREEN STAGES IT ──────────
     *
     * **This was a command a reader copied into a terminal until 2026-09-12**,
     * and the owner ruled it out: *"Yes — screen stages it"*, under the
     * sentence `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`
     * decides by — a composed command is not the UI having a capability, it is
     * the UI describing one. The write is `POST /api/retrieval/stage`, through
     * the same narrow no-writes exception the anchor writes on this very screen
     * already take, and never through a second mechanism.
     *
     * **Two acts, and both are his.** Staging leaves a PROPOSAL on disk;
     * approving it is what lets the NEXT session read it, and
     * `approveStagedRestore` refuses any actor but a human. So the approval is
     * a confirm: the button opens what he would be approving — read back off
     * the disk — and a second press spends a single-use nonce only that confirm
     * can mint. The CLEAR is still his, and there is no verb for it here or
     * anywhere in this product.
     */
    const fresh = el('div', 'convrecallfresh');
    const fh = el('h5');
    fh.append(...ctx.t('conv.recall.fresh.h'));
    const fhint = el('p', 'small');
    fhint.append(...ctx.t('conv.recall.fresh.hint'));
    const stageButton = el('button', 'tvjump convrecallstage');
    stageButton.type = 'button';
    stageButton.append(...ctx.t('conv.recall.fresh.stage'));
    const stagedBox = el('div', 'convrecallstaged');
    stagedBox.setAttribute('aria-live', 'polite');
    const then = el('p', 'small convrecallfreshthen');
    then.append(...ctx.t('conv.recall.fresh.then'));
    const formHead = el('h5');
    formHead.append(...ctx.t('conv.recall.form.h'));
    const form = el('pre', 'convrecallform');
    form.append(body.reviewForm);

    // **The coverage disclosure comes BEFORE the button, not after it.** What
    // this return does not cover is what `INV-nothing-is-dropped-silently`
    // requires him to have in front of him at the moment he decides, and a
    // form drawn under the control is a form read after the decision. The
    // confirm draws it again later, read back off the DISK — two renderings of
    // two different facts, which is why both are here.
    fresh.append(fh, spaced(fhint), formHead, form, then, stageButton, stagedBox);
    host2.append(fresh);

    /**
     * **A refusal is DRAWN and the control comes back** — `markRow`'s rule on
     * this same screen, and the shape `INV-nothing-is-dropped-silently`
     * requires: a button that appears to have worked and has not is what a
     * disabled button left disabled produces.
     */
    const stageIt = async () => {
      stageButton.disabled = true;
      stagedBox.replaceChildren(waiting(ctx, 'conv.recall.fresh.staging'));
      let staged;
      try {
        staged = await ctx.post('/api/retrieval/stage', asked);
      } catch (error) {
        stagedBox.replaceChildren(errorNote(error.message));
        stageButton.disabled = false;
        return;
      }
      drawStaged(stagedBox, staged);
    };
    stageButton.addEventListener('click', () => { void stageIt(); });
  };

  /**
   * **What is on disk NOW, and the one sentence a reader may act on.**
   *
   * `verified` is the ONLY basis for saying anything about clearing —
   * `stageRestoreSummary` re-reads the record it has just written for exactly
   * that, and its header refuses every other basis in as many words. So an
   * unverified stage draws the refusal and offers NO approval: approving a
   * record that could not be read back would be releasing bytes nobody saw.
   */
  const drawStaged = (host2, staged) => {
    host2.replaceChildren();
    if (staged.verified !== true) {
      const bad = el('p', 'small warn convrecallstagefailed');
      bad.append(...ctx.t('conv.recall.staged.failed', { reason: staged.reason ?? '' }));
      host2.append(bad);
      return;
    }
    const ok = el('p', 'small convrecallstagedok');
    ok.append(...ctx.t('conv.recall.staged.ok',
      { key: staged.key, bytes: staged.payloadBytes, file: staged.file }));
    const approve = el('button', 'tvjump convrecallapprove');
    approve.type = 'button';
    approve.append(...ctx.t('conv.recall.approve'));
    const confirmBox = el('div', 'convrecallapprovebox');
    confirmBox.setAttribute('aria-live', 'polite');
    host2.append(ok, approve, confirmBox);

    const openConfirm = async () => {
      approve.disabled = true;
      confirmBox.replaceChildren(waiting(ctx, 'conv.recall.approve.opening'));
      let confirmed;
      try {
        confirmed = await ctx.api(
          `/api/retrieval/approve/confirm?key=${encodeURIComponent(staged.key)}`);
      } catch (error) {
        confirmBox.replaceChildren(errorNote(error.message));
        approve.disabled = false;
        return;
      }
      drawConfirm(confirmBox, confirmed, approve);
    };
    approve.addEventListener('click', () => { void openConfirm(); });
  };

  /**
   * **The confirm — and the nonce it carries is the whole of what makes a
   * click count as the owner's own act.**
   *
   * The form drawn here is read back off the STAGED RECORD, not the one
   * rendered before it was written: what he approves is what is on disk. The
   * nonce is minted only by the request that produced this block, is bound to
   * the key AND to a digest of those bytes, and is spent on attempt — so a page
   * that never drew this cannot approve, and a record that changed underneath
   * it cannot be approved as the one he read.
   */
  const drawConfirm = (host2, confirmed, approve) => {
    host2.replaceChildren();
    const head = el('h5');
    head.append(...ctx.t('conv.recall.approve.h'));
    const hint = el('p', 'small');
    hint.append(...ctx.t('conv.recall.approve.hint', { bytes: confirmed.payloadBytes }));
    const form = el('pre', 'convrecallapproveform');
    form.append(confirmed.reviewForm);
    const yes = el('button', 'tvjump convrecallapproveyes');
    yes.type = 'button';
    yes.append(...ctx.t('conv.recall.approve.yes'));
    const said = el('div', 'convrecallapproved');
    said.setAttribute('aria-live', 'polite');
    host2.append(head, spaced(hint), form, yes, said);

    yes.addEventListener('click', () => {
      void (async () => {
        yes.disabled = true;
        said.replaceChildren(waiting(ctx, 'conv.recall.approving'));
        let answer;
        try {
          answer = await ctx.post('/api/retrieval/approve',
            { key: confirmed.key, nonce: confirmed.nonce });
        } catch (error) {
          // **The nonce is spent either way** — `redeem` deletes on ATTEMPT —
          // so what comes back is the control that mints a NEW confirm. Leaving
          // this button live would be offering a credential that is gone.
          host2.replaceChildren(errorNote(error.message));
          approve.disabled = false;
          return;
        }
        if (answer.safeToClear !== true) {
          const bad = el('p', 'small warn convrecallapproveunsafe');
          bad.append(...ctx.t('conv.recall.approve.unsafe', { reason: answer.reason ?? '' }));
          said.replaceChildren(bad);
          return;
        }
        const good = el('p', 'small convrecallsafetoclear');
        good.append(...ctx.t('conv.recall.approved',
          { key: answer.key, bytes: answer.payloadBytes }));
        said.replaceChildren(good);
      })();
    });
  };

  /* ── seeding, which is §3's primary way in ─────────────────────────────── */
  const seedPassage = () => {
    const text = seed();
    if (typeof text === 'string' && text.trim() !== '') passage.value = text;
  };
  // **`focusin`, and no listener on the textarea itself.** `focusin` bubbles,
  // so entering the panel anywhere seeds it once and a second listener would
  // buy nothing. `test/ui/conversation-follow-cadence.test.ts` also forbids
  // registering either LOOK event by name anywhere in this screen — one of
  // them shares its name with the non-bubbling form of this one — because
  // `attachLook` is the single place either may be spelled. It caught the
  // redundant listener rather than a bug, which is the gate reaching past its
  // own subject and worth leaving that way.
  card.addEventListener('focusin', seedPassage, { once: true });

  drawModes();
  // **Nothing is asked of the server until the panel is on screen.** A closed
  // panel on every open document would fire a request per document for a list
  // nobody is looking at, which is the cost `TIP_MS`' own table says has to be
  // counted per open document rather than once.
  if (!collapsed) void refreshResults();
  return {
    seedPassage,
    open: () => {
      const first = box.hidden;
      box.hidden = false;
      if (first) void refreshResults();
    },
  };
}

/** A button that puts text on the clipboard, and SAYS when the browser refused. */
function copyButton(ctx, key, textOf, className) {
  const wrap = el('div', 'convrecallcopywrap');
  const button = el('button', `tvjump ${className}`);
  button.type = 'button';
  button.append(...ctx.t(key));
  // The same element `mountDocument` keeps for the same reason: a suite with no
  // clipboard permission should assert the payload the page WOULD write rather
  // than pretend to read the OS clipboard, and this is that payload.
  const clip = el('pre', 'convrecallclip');
  clip.hidden = true;
  clip.setAttribute('aria-hidden', 'true');
  const said = el('span', 'small convrecallcopied');
  said.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    const text = textOf();
    clip.replaceChildren(text);
    let went = false;
    try {
      if (navigator.clipboard !== undefined
        && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        went = true;
      }
    } catch { went = false; }
    said.replaceChildren(...ctx.t(went ? 'conv.recall.copied' : 'conv.copy.refused'));
  });
  wrap.append(button, clip, said);
  return wrap;
}

/** The waiting line, one shape for all three requests this panel makes. */
function waiting(ctx, key) {
  const line = el('p', 'small convrecallwait');
  line.append(...ctx.t(key));
  return line;
}

/* ══ THE DOCUMENT: MEASUREMENT AND ARITHMETIC ══════════════════════════════ */

/** Nodes kept in the DOM above and below the viewport, so a scroll is smooth. */
/**
 * **CAN THIS BROWSER PAINT A HIGHLIGHT WITHOUT TOUCHING THE PAGE?**
 *
 * The CSS Custom Highlight API — `CSS.highlights` plus `::highlight()` —
 * paints `Range`s with NO wrapper elements, no reflow and nothing to unwind.
 * Baseline "newly available" since June 2025 (Chrome/Edge 105, Safari 17.2,
 * Firefox 140) and an Interop 2026 focus area.
 *
 * **It is the only highlighter this screen can use, and the reason is the
 * virtualiser rather than taste.** Every library of that kind — `mark.js` and
 * its descendants — wraps a match in a `<mark>`, which mutates the DOM inside
 * a scroll whose rows are absolutely positioned from a measured model. A
 * wrapper re-measures the row it is in, `paint`'s anchor arithmetic then holds
 * a position that has moved, and the well can end up blank — the defect
 * `tvinner`'s own comment records from the two-spacer draft. A `Range` changes
 * no layout at all, so a highlight cannot move a row.
 *
 * A browser that lacks it gets everything else and is TOLD the colour is
 * missing, rather than being handed a find box that silently does half of
 * what the line above it claims (`INV-nothing-is-dropped-silently`).
 */
const CAN_HIGHLIGHT = typeof CSS !== 'undefined'
  && typeof CSS.highlights !== 'undefined'
  && typeof Highlight === 'function';

/**
 * The name the stylesheet paints. One spelling, because `::highlight(name)`
 * and `CSS.highlights.set(name, …)` are joined by nothing but this string.
 */
const FIND_HIGHLIGHT = 'mycontextfind';

/**
 * **HOW MANY HIGHLIGHTS ONE ROW MAY CARRY.**
 *
 * A single turn of terminal output holds thousands of occurrences of a common
 * letter, and a reader cannot see a thousand highlights in one row. It is a
 * bound on the DRAWING and not on the answer: the count beside the find box
 * comes from the server's scan of the whole transcript and is not affected by
 * it, which is the only reason a bound here is allowed to be silent.
 */
const FIND_PAINT_PER_ROW = 300;

/**
 * How far below the top of the well a stepped-to match is put.
 *
 * Enough that the line above it is readable, which is what tells a reader
 * they are inside a turn rather than at the head of one. Not centred: the
 * eye goes to the top third of a well and a centred landing costs a screen
 * of context above the thing that was looked for.
 */
const MATCH_MARGIN_PX = 80;

/**
 * **THE ELEMENTS A MATCH MAY NOT RUN ACROSS.**
 *
 * A row's text is read by walking its text nodes and JOINING them, because
 * `markdownNodes` splits a sentence the moment it carries emphasis — *"the
 * **byte** offset"* is three text nodes — and a reader searching for `byte
 * offset` means the sentence they can see, not the fragment between two
 * tags. Joined blindly, though, the last word of one paragraph and the first
 * of the next become one string and a match can be found in a gap that has no
 * text in it at all.
 *
 * So a separator is inserted wherever the nearest ancestor in this list
 * changes. The list is what `markdownNodes`, `drawTurn`, `drawDeed` and
 * `drawWork` actually emit rather than a general idea of block-level: a tag
 * missing from it costs a false match ACROSS a boundary, never a lost one,
 * and `test/ui/conversations-find.test.ts` pins the paragraph case.
 */
const FIND_BLOCKS = new Set([
  'P', 'DIV', 'PRE', 'LI', 'UL', 'OL', 'TABLE', 'TR', 'TD', 'TH', 'BLOCKQUOTE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER',
  'DETAILS', 'SUMMARY', 'FIGURE', 'FIGCAPTION', 'HR', 'BR',
]);

const OVERSCAN = 6;

/** Node bodies one fetch asks for. The endpoint caps at 80. */
const FETCH_PAGE = 24;

/**
 * How long a selection must stop changing before its records are pre-fetched —
 * `TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form`.
 *
 * **The owner ruled PRE-FETCH ON SELECTION (2026-09-10)**, over three other
 * shapes, so that `Ctrl+C` can serve MESSAGE TEXT synchronously and therefore
 * means ONE thing. This constant is the one number that ruling did not fix,
 * and it exists because `selectionchange` fires on every mouse move of a drag:
 * asking per event would spend a request per pixel down a document the reader
 * is still sweeping. A settle of 90ms is under the ~100ms a reader reads as
 * instant, and shorter than the fastest measured mark-then-press.
 *
 * It is NOT a debounce on the KEY. Option 4 — fetch on the keypress — was put
 * to him and declined for exactly that: he preferred to spend the request
 * early and keep the key instant.
 */
const PREFETCH_SETTLE_MS = 90;

/**
 * How often an OPEN conversation document asks whether its transcript moved —
 * `plan:archive seq:19`, and the number is the whole decision in that item.
 *
 * ── IT DOES NOT SHORTEN THE HEARTBEAT, AND THAT IS THE POINT ──────────────
 *
 * The owner asked to see a session he is watching update "live near real time
 * asap", and named the status strip as the precedent. The strip is filled by
 * `startHeartbeat` in `app.js` at **60 seconds**, and that 60 "was RULED
 * rather than inherited": the occupancy read it carries is 0.32 ms and would
 * be affordable far faster, but `measureCorpusDrift` rides the same request
 * and its once-a-minute budget is the argument that ruled out a file watcher
 * in the first place. That comment also refuses a second timer, as "a second
 * cadence to keep in step".
 *
 * **Both halves of that ruling are met rather than stepped around.** The
 * global heartbeat is untouched, and the transcript `stat` is NOT hung on
 * `/api/ping` — it has a route of its own, `/tip`, which does the `stat` and
 * not the sweep. What is left of the "second cadence" objection is answered by
 * scope: this timer is not global. It is created by `mountDocument`, it exists
 * only while one conversation document is on screen, and it stops the moment
 * the reader navigates away or the well leaves the DOM. There is nothing to
 * keep in step with, because there is nothing running when nobody is reading.
 *
 * **And the argument that made 60 s ENOUGH for the strip does not transfer.**
 * `app.js` says so itself: what makes a minute enough there is that "the
 * sample under it is rewritten once per assistant message". A transcript gains
 * records many times inside a single turn — measured on the owner's own file,
 * 28,998 records against 2,533 turns, so about eleven records per turn — and a
 * reader watching his own session go by would see it arrive in minute-long
 * jumps at that cadence.
 *
 * ── WHAT THE POLL COSTS, MEASURED, AND AGAINST WHAT BUDGET ───────────────
 *
 * The comparison that matters is not "is a poll cheap" but "is it cheap
 * against the number the 60 s ruling protects", which is `measureCorpusDrift`
 * at **6.24 ms of server CPU per minute**. Measured on this machine,
 * 2026-09-08, against the owner's own 67,192,723-byte transcript:
 *
 *     `/tip` as first drafted, opening the index      1.930 ms per call
 *     `/tip` as shipped, reading the directory        0.057 ms per call
 *     the whole outline it avoids re-walking            258 ms, 884 KB
 *     the resumed outline a real append costs         2.722 ms, 512 bytes
 *
 * At 0.057 ms a call, the cost of an interval is arithmetic rather than taste
 * (`TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send`):
 *
 *     5000 ms    12 calls/min    0.68 ms/min    under budget   <- was
 *     2000 ms    30 calls/min    1.71 ms/min    under budget
 *     1000 ms    60 calls/min    3.42 ms/min    under budget   <- IS
 *      750 ms    80 calls/min    4.56 ms/min    under budget
 *      500 ms   120 calls/min    6.84 ms/min    OVER budget
 *      250 ms   240 calls/min   13.68 ms/min    OVER budget
 *
 * **AND EVERY ROW OF THAT TABLE IS PER OPEN DOCUMENT.** It is not a global
 * budget line: this timer is created by `mountDocument`, so THREE conversation
 * documents open in three tabs at 1000 ms is 10.26 ms/min and already over the
 * sweep. What makes that survivable is `shouldPing` — a tab in the background
 * contributes nothing, so the multiplier only applies to documents somebody is
 * actually looking at. Lower this constant and that disclosure moves with it.
 *
 * **Half a second is the first step that breaks the budget**, so 1000 ms is
 * the floor a poll can reach and anything faster is a different mechanism: a
 * PUSH, which `seq:19` ruled against for a read surface and which is the
 * owner's to reopen rather than a lane's to assume.
 *
 * **Polling faster genuinely buys freshness**, which is not obvious and was
 * measured rather than assumed: the harness writes the transcript DURING a
 * turn, not at the end of it. Sampling the owner's own live transcript three
 * seconds apart mid-turn — 69,751,672 bytes then 69,760,908 — it grew 9,236
 * bytes in those three seconds with an mtime two seconds old. So the ceiling
 * on how fresh this screen can be is this interval, not the harness's
 * buffering.
 *
 * `shouldPing` is honoured on every tick, so a tab in the background stops
 * asking — the same rule, and the same reason, as the heartbeat's: a forgotten
 * tab must not hold the server up. The interval is not the only thing that
 * makes the screen ask, though: see `onLook` below and the imported
 * `LOOK_GAP_MS` it debounces against, which turn "the reader came back to the
 * tab" into a tick of its own.
 *
 * **The cadence is DISCLOSED on screen**, in `conv.doc.follows` in both string
 * tables, and the two are held together by
 * `test/ui/conversation-follow-cadence.test.ts` rather than by memory.
 */
const TIP_MS = 1_000;

/* ── THE SCROLL'S ARITHMETIC LIVES IN `lib/transcript-scroll.js` ──────────
 *
 * Moved 2026-09-13, the first of the cuts
 * `TASK-the-largest-client-file-is-seven-movable-units-around-one` sets out,
 * because it was the one part of this file with no closure coupling at all.
 *
 * **It is RE-EXPORTED here and that is not a convenience.** `Scroller`,
 * `estimateHeight` and `matchesNode` were already this module's public
 * surface: `test/ui/transcript-viewer.test.ts` imports all three from this
 * path, and 22 of its assertions are about them. Re-exporting means the move
 * changed no importer, so the test file is UNCHANGED and its staying green is
 * a proof the arithmetic went across whole rather than a test rewritten to
 * agree with a new shape.
 */
export {
  estimateHeight, matchesNode, Scroller,
} from '../lib/transcript-scroll.js';

/* ══ THE DOCUMENT: DRAWING ONE NODE ════════════════════════════════════════ */

/**
 * A refusal label in the reader's own language.
 *
 * `markdownNodes` takes this because its default is English — and every
 * existing caller in this app takes that default, which is a real defect on
 * the Hebrew page and is fixed HERE rather than left. The three keys already
 * live in both string tables for the Documentation screen.
 */
function refusalLabel(ctx) {
  return (key, subs = {}) => {
    if (key === 'dv.imgRefused') return ctx.tFlat('dv.imgRefused', { alt: subs.alt ?? '' });
    if (key === 'dv.linkRefused') return ctx.tFlat('dv.linkRefused', { label: subs.label ?? '' });
    return ctx.tFlat('dv.htmlRefused');
  };
}

/**
 * A turn's words — `seq:8`'s cell content, and the measurement that chose it.
 *
 * The transcript's text blocks hold MARKDOWN, not ANSI: one record of 27,752
 * carries an escape sequence and 175 carry a fence. So "as close as it could
 * be to what was seen on the terminal" is served by rendering the Markdown the
 * terminal itself renders — through `lib/markdown.js`, the vendored,
 * pinned, offline-gated tokeniser this app already ships, which builds every
 * node with `createElement` and produces no HTML string at all.
 *
 * `dir="auto"` is load-bearing rather than tidiness. A record's text is in a
 * language this app does not choose: an English turn sitting in the Hebrew
 * page's RTL flow renders its trailing full stop at the WRONG END — ".Reading
 * the spec first" — the same Unicode bidi effect `library.js` wraps path
 * segments in `<bdi>` for. Seen in the Hebrew screenshot after every assertion
 * had passed.
 */
function saidBody(ctx, text) {
  const body = el('div', 'tvsaid');
  body.setAttribute('dir', 'auto');
  body.append(...markdownNodes(text, document, refusalLabel(ctx)).nodes);
  return body;
}

/**
 * Terminal output — monospace, colours honoured, every other escape removed.
 *
 * `hasEscapes` is asked first because it answers `false` 27,751 times out of
 * 27,752 on the owner's transcript: the common path is one `textContent`
 * assignment, and the walk runs only where there is something to walk.
 */
function termBody(text) {
  const pre = el('pre', 'tvterm');
  pre.setAttribute('dir', 'auto');
  if (hasEscapes(text)) pre.append(...ansiNodes(text, document));
  else pre.textContent = text;
  return pre;
}

/** The keyed word for a person-side turn nobody typed. */
const SYNTHETIC_KEYS = {
  'task-notification': 'conv.doc.syn.task',
  'slash-command': 'conv.doc.syn.slash',
  meta: 'conv.doc.syn.meta',
  'system-reminder': 'conv.doc.syn.reminder',
  'harness-compaction-summary': 'conv.doc.syn.compaction',
};

/**
 * THE NAME AT THE TOP OF A TURN — `plan:archive seq:28`.
 *
 * The owner read a row that said **You** above *"Background task finished"* and
 * took it for his own input being overridden. Nothing was overridden: the
 * sentence is `conv.doc.syn.task` REPLACING the raw `<task-notification>`
 * payload, which is correct and stays. The row had exactly one defect — the
 * heading named him as the speaker of something he did not say.
 *
 * His ruling was per kind and the kinds were measured before any was assigned;
 * `Speaker` in `read-model-conversation-document.ts` carries the table. Three
 * things about it are worth having here, because a later edit will be tempted
 * by each:
 *
 *   - **`claude` never appears.** Every synthetic person-side turn is
 *     something delivered TO the assistant, so naming Claude would repeat the
 *     error one name over.
 *   - **The 23 slash commands keep `You`.** The wrapper is machinery; the act
 *     was his. A change that renamed all 271 would take his own invocations
 *     away from him.
 *   - **`null` is a real answer**, for the 47 turns nobody caused. The row then
 *     draws no name at all and its keyed chip says what it is, which is what
 *     the ruling asked for — an invented name would be worse than none.
 */
const SPEAKER_KEYS = {
  you: 'conv.doc.you',
  claude: 'conv.doc.claude',
  subagent: 'conv.doc.subagent',
  shell: 'conv.doc.shell',
};

/** The accent a turn wears. Only the two real speakers get one of their own. */
const SPEAKER_CLASS = { you: 'tvyou', claude: 'tvclaude' };

/**
 * The words `lib/passage.js` needs, in the reader's language.
 *
 * **It is a bridge and not a second table**, which is the point of it. The
 * passage builder emits sentences and must therefore be bilingual; it must
 * also be drivable by `node --test` with no string table and no DOM. So the
 * words arrive as four functions, and `SPEAKER_KEYS` and `SYNTHETIC_KEYS`
 * above stay the only place either mapping is written down — a copy of them in
 * a library the screen imports is exactly the drift this file's own header
 * warns about for the KINDS table.
 *
 * `stamp` is `dayText`, so a timestamp in a copied passage is the same string
 * the row above it drew: the reader's own zone, saying which zone it is
 * (`TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`).
 */
function passageLabels(ctx) {
  return {
    t: (key, subs = {}) => ctx.tFlat(key, subs),
    speaker: (who) => {
      const key = SPEAKER_KEYS[who];
      return key === undefined ? null : ctx.tFlat(key);
    },
    // A label this screen has no word for is served AS ITSELF rather than
    // dropped — the same choice `drawTurn` makes for the chip.
    synthetic: (label) => {
      const key = SYNTHETIC_KEYS[label];
      return key === undefined ? label : ctx.tFlat(key);
    },
    stamp: (iso) => dayText(iso),
  };
}

/** The glyph beside the name — distinction by more than colour. */
function speakerGlyph(who) {
  if (who === 'you') return KINDS.prompt.glyph;
  if (who === 'claude') return KINDS.answer.glyph;
  return KINDS.machinery.glyph;
}

/**
 * One turn: who spoke, when, and what they said — `seq:13`'s skeleton, read
 * off the export he supplied as the format.
 *
 * The export writes `## User:` with the timestamp on a quoted line beneath.
 * Here that is a real `<h4>` inside a `<header>` with a `<time>`, because a
 * document a screen reader walks wants headings and a machine-readable stamp,
 * and because "a heading per turn" is the part of that format `seq:13` itself
 * says survives virtualisation.
 */
function drawTurn(ctx, body, lanes = NO_LANES) {
  const who = body.who;
  const accent = SPEAKER_CLASS[who] ?? '';
  const turn = el('article', `tvturn ${accent}${body.synthetic !== null ? ' tvsyn' : ''}`.trim());
  turn.dataset.n = String(body.n);

  const head = el('header', 'tvwho');
  const mark = el('span', 'tvmark');
  mark.dataset.g = speakerGlyph(who);
  head.append(mark);

  // **A TURN NOBODY CAUSED CARRIES NO NAME.** `SPEAKER_KEYS` has the ruling and
  // the measured table. The chip below is then the row's whole identity, which
  // is what "or none" meant — a monitor tick has no speaker in any honest
  // sense, and inventing one is the defect this fix exists to end.
  const key = SPEAKER_KEYS[who];
  if (key !== undefined) {
    const name = el('h4', 'tvname');
    name.append(...ctx.t(key));
    head.append(name);
  }

  // Person-side text nobody typed keeps its place and its record and is
  // LABELLED. `classifyTurn` counts these as prompts and is right to for the
  // archive; a document that names a speaker cannot be neutral about it —
  // 202 of this session's 549 person-side turns are background-task
  // notifications, and drawing those as "You" would make the document lie.
  if (body.synthetic !== null) {
    const tag = el('span', 'chip index tvtag');
    tag.dataset.g = '⌁';
    // **THE LABEL IS UNCHANGED, AND `plan:archive seq:28` SAYS SO IN AS MANY
    // WORDS.** *"The format, the timestamp, the dimming, the readable sentence
    // in place of raw XML — correct and must survive the fix."* Only the
    // HEADING above moved. A finer label per notification subtype was
    // available and was not taken for exactly this reason.
    const label = SYNTHETIC_KEYS[body.synthetic];
    if (label !== undefined) tag.append(...ctx.t(label));
    else tag.append(body.synthetic);
    head.append(tag);
  }

  const day = dayText(body.timestamp);
  if (day !== null) {
    const at = el('time', 'tvat', day);
    if (typeof body.timestamp === 'string') at.dateTime = body.timestamp;
    // **`dir="ltr"`, and it was found in the Hebrew screenshot.** A stamp is
    // one left-to-right unit, but `2026-09-08 09:00` is two neutral runs
    // separated by a space, so the RTL paragraph reordered them and the screen
    // drew `09:00 2026-09-08`. Bidi was doing exactly what it is specified to
    // do; the mistake was letting a timestamp inherit the paragraph's
    // direction at all. This is the same isolation `{mv:…}` gives an
    // identifier in the string tables.
    //
    // **AND IT IS LOAD-BEARING TWICE OVER SINCE THE ZONE WAS NAMED.** The
    // stamp is now `2026-09-08 09:00 GMT+0` — THREE runs, not two, and the
    // third is the one a reader most needs beside its own time. Removing this
    // attribute would draw `GMT+0 09:00 2026-09-08` on the Hebrew page, which
    // is a worse version of the defect this stamp was rewritten to end.
    // `e2e/conversations.spec.ts` asserts the visible order in Hebrew.
    at.setAttribute('dir', 'ltr');
    head.append(at);
  }

  // **AND WHOSE REPORT IT IS** — `plan:archive seq:49`. Last in the header, so
  // the row still reads who / what / when before it offers the way in, and so
  // the wrap `.tvwho` already does puts the control on its own line rather than
  // between the chip and the stamp. `laneReport` carries the ruling on which
  // rows reach it and on the second route to one lane.
  for (const mark of laneReport(ctx, lanes, body.lane)) head.append(mark);

  turn.append(head);

  // **A synthetic turn is machinery, and it is drawn as machinery.** It is
  // filed on the person's side but nobody typed it, and its body is almost
  // never prose: measured on the owner's own session, its 255 such turns are
  // 202 `<task-notification>` blocks, 25 `isMeta` records, 23 slash-command
  // wrappers and 5 compaction carry-overs — angle-bracket markup, every one.
  //
  // Put through the Markdown renderer, `<task-notification>` is an
  // `html_block`, and the console policy REFUSES raw HTML by name. So the
  // screen drew "raw HTML block refused" above the text on 255 turns — a
  // correct refusal answering a question nobody asked, because that text was
  // never Markdown. Seen in the screenshot of his real transcript, not in a
  // fixture.
  //
  // Monospace, escapes stripped, whole text kept. Nothing is refused because
  // nothing is parsed.
  turn.append(body.synthetic !== null ? termBody(body.text) : saidBody(ctx, body.text));

  // NOTHING IS CUT HERE ANY MORE, so nothing says it was. A `tvcut` line drawn
  // from `body.textTruncated` stood here until 2026-09-08 and went with the
  // cap it disclosed — owner ruling, read off this very screen: "if there is a
  // size restriction it must be removed, i want no restriction or limitation."
  // The bounds that remain are on the WINDOW rather than on text and are still
  // named: `conv.doc.truncated` below when the walk stopped, and each fold's
  // own true `span`.

  // Reasoning that came with the words. Folded, never drawn as prose: it is
  // not what was said. Measured on the owner's session this fires on no turn
  // at all — the harness files thinking in records of its own, which become
  // folded runs — and it is built anyway, because a schema that separates them
  // today may join them tomorrow and a silent drop is the thing to avoid.
  if (body.thinking !== '') {
    const fold = el('details', 'tvthink');
    const summary = el('summary');
    summary.append(...ctx.t('conv.doc.thinking'));
    fold.append(summary, termBody(body.thinking));
    turn.append(fold);
  }

  // A TURN THAT ALSO CALLED A TOOL. Measured on the owner's transcript: 3
  // records of 31,101 carry words and a call in the same record, and two of
  // those calls are shell commands. Words win the classification — the reader
  // came for the words — and the call is drawn beneath them rather than
  // dropped for being rare.
  for (const step of body.steps ?? []) turn.append(...stepParts(ctx, step, NO_LANES));
  return turn;
}

/**
 * ONE ARGUMENT of a tool call, drawn as itself.
 *
 * A string is drawn VERBATIM — a `command` reads as a command, a `content`
 * reads as the file that was written, newlines and all. Anything else is drawn
 * as indented JSON, because it IS structured: measured on the owner's
 * transcript, `questions` is an array of objects on all 71 `AskUserQuestion`
 * calls, and stringifying it early would hand `plan:archive seq:16` a
 * paragraph where it needs a list of options. The value arrives here in its
 * own JSON type and this is the last place it is turned into characters.
 */
function argBody(value) {
  if (typeof value === 'string') return termBody(value);
  let json;
  try { json = JSON.stringify(value, null, 2); } catch { json = undefined; }
  return termBody(json === undefined ? String(value) : json);
}

/** Longest argument drawn beside its name instead of in a block of its own. */
const ARG_INLINE = 120;

/**
 * The argument as ONE LINE, or `null` if it needs a block.
 *
 * Without this every argument got its own bordered `<pre>`, so a single `Bash`
 * step drew four boxes — one of them holding the number `600000`. Measured on
 * the owner's transcript, arguments that are one short line are the MAJORITY:
 * 347 numeric `timeout`s, 61 boolean `replace_all`s, every `file_path`, and
 * most `description`s. A box each is noise around the two arguments a reader
 * opened the step for, and `STD-a-screen-explains-itself-in-plain-words-and-depth-hides`
 * is the standard that makes that a defect rather than a taste.
 */
function shortArg(value) {
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  if (typeof value !== 'string') return null;
  if (value.includes('\n') || value.length > ARG_INLINE) return null;
  return value;
}

/* ══ THE LANES A DOCUMENT DISPATCHED ═══════════════════════════════════════ */

/**
 * The address of one lane's transcript — **a PAGE OF ITS OWN, and that is the
 * whole of `plan:archive seq:51`.**
 *
 * ── WHAT WAS WRONG WITH THE OLD ADDRESS ──────────────────────────────────
 *
 * It was `#/conversations/<agentId>`, and it worked: `rowFor` in
 * `read-model-conversation-document.ts` resolves a lane, so one route served
 * both kinds and nothing new rendered it. What it opened, though, was THE
 * WHOLE APPLICATION at a lane address — the rail, the status strip, the
 * header, every visited screen still hidden in `#screen`. Owner, 2026-09-09,
 * correcting what he meant by a new tab: *"what i meant is to only see the
 * viewer with the transcript in it as a single window without all the app
 * arround it"*.
 *
 * ── AND ONLY A LANE. THE SESSION KEEPS THE APP ───────────────────────────
 *
 * Ruled 2026-09-09 after both alternatives were put to him and declined —
 * both-bare, and a toggle he chooses per reading. A SESSION is where he works
 * and the strip and rail are the instruments; a LANE is something he visits,
 * reads and closes. So the seam is the DOCUMENT KIND, and `rowFor` already
 * answers it: `sessionHref` below is the app's own route and is unchanged.
 * There is no mode, no preference and no parameter that chooses a shape — the
 * shape follows from WHAT is being opened, and `lane.js` re-asks the read
 * model on arrival rather than trusting the address it was reached by.
 *
 * ── THE PAGE SHAPE IS `doc.html`'s. THE RENDERER IS NOT ──────────────────
 *
 * `/doc.html` is the precedent for a second page beside `index.html`, and
 * `seq:19`'s own item records his earlier permission for it — *"you can use a
 * different browser tab as we did for readme"*. It is NOT the precedent for
 * how to draw a transcript: `githubNodes` draws that page and `markdownNodes`
 * draws this one, and they differ exactly where it matters (`span.m` against
 * a bare `code`), so a lane rendered through it would silently lose the inline
 * hue, the fence colouring, the folds and the terminal rendering. `lane.js`
 * therefore imports `mountDocument` from this file and forks nothing.
 *
 * **Widening it later is one line**: if a session should open bare too,
 * `sessionHref` stops being a separate answer.
 */
export function laneHref(agentId) {
  return `/lane.html?id=${encodeURIComponent(agentId)}`;
}

/**
 * The address of one SESSION's document — the app's own route, and the half of
 * `seq:51` that deliberately did not move.
 *
 * Root-absolute rather than a bare `#/…`, and that is not cosmetic: a bare
 * fragment resolves against the page it is written on, and `a.tvlanehome` is
 * written on `/lane.html`, where `#/conversations/<id>` would address the lane
 * window itself. One spelling that means the same thing on both pages.
 */
export function sessionHref(id) {
  return `/#/conversations/${encodeURIComponent(id)}`;
}

/**
 * The address of one SPILLED TOOL RESULT — `plan:archive seq:30`.
 *
 * Root-absolute for `sessionHref`'s reason: this control is drawn by
 * `stepParts`, which serves the app AND `/lane.html`, and a relative address
 * would mean two different things on the two pages.
 *
 * The whole absolute path goes in the query string because that is what the
 * transcript recorded — there is no id to name this file by. `/api/spill`
 * confines it to a `tool-results` directory inside the harness's own project
 * tree before it reads anything; see `serveSpill`.
 */
export function spillHref(file) {
  return `/api/spill?file=${encodeURIComponent(file)}`;
}

/**
 * **THE EVIDENCE BEHIND A STEP WHOSE OUTPUT WAS TOO LARGE TO CARRY** —
 * `plan:archive seq:30`, and the same three-answers-never-nothing shape
 * `laneMark` above already draws for a lane.
 *
 * The harness spills a large tool result to a file and leaves a stub naming it.
 * The stub is the CONCLUSION and the file is the EVIDENCE, and a reader who met
 * the sentence "Full output saved to: …" in a step could go no further, because
 * nothing on this page knew the file existed.
 *
 * ── WHY IT IS DRAWN HERE AND NOT BESIDE THE TEXT ──────────────────────────
 *
 * On the SUMMARY LINE, beside the lane mark, for the reason that one is:
 * a reader who opens a fold meets the way in before the body rather than after
 * scrolling through a 2 KB preview of it. The stub's own text is still drawn
 * below, in full, path included — this adds a control, it hides nothing.
 *
 * ── AND THE SIZES ARE BOTH SHOWN WHEN THEY DISAGREE ───────────────────────
 *
 * `said` is what the stub claimed at the time; `bytes` is what the file
 * measures now, and they DISAGREE on 1,453 of the 1,814 spilled files on the
 * owner's tree — always with the file the larger, because the harness counted
 * CHARACTERS and the file system counts BYTES. `DocSpill.said` works one
 * through. So the link draws `bytes`, which is the unit this archive counts in
 * everywhere else, and `said` rides in the `title` so the record's own claim is
 * recoverable without opening anything.
 *
 * A file that is GONE gets `conv.doc.spillGone` in `.tvcut`, the class
 * `laneGone` already wears: a pruned spill and a pruned lane are the same fact
 * about the same tree, and a reader should not have to learn two looks for it.
 */
function spillMarks(ctx, step) {
  const spills = Array.isArray(step.spills) ? step.spills : [];
  const marks = [];
  for (const spill of spills) {
    if (spill === null || typeof spill !== 'object') continue;
    if (typeof spill.file !== 'string' || spill.file === '') continue;
    if (spill.present !== true) {
      const gone = el('span', 'tvcut tvspillgone');
      gone.append(...ctx.t('conv.doc.spillGone'));
      marks.push(gone);
      continue;
    }
    const open = el('a', 'tvspill');
    open.href = spillHref(spill.file);
    open.target = '_blank';
    // `noopener` and not `noreferrer`, exactly as `laneLink` argues: this app
    // reads its own referrer nowhere, and hiding where a link came from would
    // be inventing a policy.
    open.rel = 'noopener';
    if (typeof spill.said === 'string' && spill.said !== '') open.title = spill.said;
    open.append(...ctx.t('conv.doc.spill', { bytes: formatBytes(spill.bytes) }));
    marks.push(open);
  }
  return marks;
}

/**
 * The address of one session's ROSTER of lanes — `plan:archive seq:41`.
 *
 * **A real address, with no change to the shell's router.** `app.js`'
 * `screenFromHash` splits at the FIRST `/` and hands the rest to the screen,
 * saying so in as many words: *"the segment after the screen is NOT parsed
 * here, deliberately."* So `#/conversations/lanes/<id>` reaches this module
 * exactly as `#/conversations/<id>` does, and `rosterFromHash` below is the
 * only code that knows what the extra segment means — which is where that
 * knowledge belongs.
 *
 * It is an ADDRESS and not a panel for the reason `laneLink` gives for using a
 * real `<a>`: a reader can copy it, bookmark it, and open it in a tab of their
 * own choosing, and none of that is code written here.
 */
export function rosterHref(sessionId) {
  return `#/conversations/lanes/${encodeURIComponent(sessionId)}`;
}

/** The session a roster address names, or `null` when the hash is not one. */
export function rosterFromHash(hash) {
  const id = sessionFromHash(hash);
  if (id === null || !id.startsWith('lanes/')) return null;
  const rest = id.slice('lanes/'.length);
  return rest === '' ? null : rest;
}

/**
 * The lanes this document can open, keyed by the `Agent` call that dispatched
 * each one.
 *
 * ── WHY A MAP FROM `toolUseId`, AND WHY THAT IS THE WHOLE CORRELATION ─────
 *
 * Both sides already recorded the join. Every lane has an
 * `agent-<id>.meta.json` beside it carrying `toolUseId` — 253 of 253 in this
 * workspace, never missing — and that value is the `id` of the `tool_use`
 * block in the dispatching turn, which `DocStep.toolUseId` now serves. So the
 * screen matches a recorded id against a recorded id and invents nothing: no
 * timestamp window, no ordinal, no comparing a description against a prompt.
 *
 * ── AND IT WORKS AT DEPTH 2 WITHOUT KNOWING WHAT DEPTH IS ─────────────────
 *
 * 43 of this workspace's 254 lanes were dispatched from INSIDE another lane, so
 * a document opened on a lane has dispatching turns of its own. A build that
 * asked only about the session would mis-file a fifth of them. It does not
 * arise here because `/subagents` answers the WHOLE roster of the owning
 * session for a lane id as well (`SubagentListBody.ownerSessionId`), and a
 * `tool_use` id is unique across that whole tree — so one map serves a document
 * at any depth and this function has no idea depth exists.
 *
 * ── A ROSTER THAT DID NOT LOAD IS NOT AN EMPTY ONE ────────────────────────
 *
 * `read: false` is a state the page says out loud (`conv.doc.lanesUnread`),
 * exactly as `doc.js` says `gh.noroster` rather than quietly drawing every
 * relative link as plain text. `INV-nothing-is-dropped-silently`.
 *
 * Exported and pure so `node --test` can measure it without a browser — the
 * same bargain `sessionFromHash` and `doc.js`' `docAddress` make.
 */
export function laneIndex(body) {
  const byCall = new Map();
  // **AND BY THE LANE'S OWN ID** — `plan:archive seq:49`. The turn where a
  // lane REPORTED BACK names it by `<task-id>` and carries no `tool_use` id at
  // all, so `byCall` cannot answer for it. Same rows, second key, one fetch.
  //
  // Keyed through `laneKey` because the two sides spell the id differently:
  // `agentId` is read off the file name (`agent-<id>.jsonl`) and the payload
  // writes the bare id. That is `seq:48`'s asymmetry, normalised at the reader
  // in the one place this file already normalises it — `rosterOrder` keys its
  // parents the same way and for the same reason.
  const byAgent = new Map();
  if (body === null || typeof body !== 'object' || !Array.isArray(body.subagents)) {
    return { byCall, byAgent, total: 0, unlinked: 0, owner: null, read: false };
  }
  for (const lane of body.subagents) {
    if (lane === null || typeof lane !== 'object') continue;
    const key = laneKey(lane.agentId);
    if (key !== null) byAgent.set(key, lane);
    if (typeof lane.toolUseId !== 'string' || lane.toolUseId === '') continue;
    byCall.set(lane.toolUseId, lane);
  }
  return {
    byCall,
    byAgent,
    total: typeof body.total === 'number' ? body.total : byCall.size,
    unlinked: typeof body.unlinked === 'number' ? body.unlinked : 0,
    // The SESSION this roster belongs to, which for a lane document is not the
    // document's own id — the endpoint resolved it, and the head uses it to
    // say where this lane came from.
    owner: typeof body.ownerSessionId === 'string' ? body.ownerSessionId : null,
    read: true,
  };
}

/** An empty roster nobody has read yet, so a caller always holds the shape. */
const NO_LANES = {
  byCall: new Map(), byAgent: new Map(),
  total: 0, unlinked: 0, owner: null, read: false, notKept: false,
};

/**
 * The control that opens one lane — **a real `<a>` with `target="_blank"`, and
 * that IS the answer to "return exactly to the cursor point".**
 *
 * `plan:archive seq:15` left the shape open — *"either as a popup window with
 * the same renderer or a different way"* — and made the return the requirement:
 * *"what's important is to let the user return exactly to the cursor point from
 * where it requested to view the subagent content"*. A new tab answers it by
 * NOT LEAVING. The reader's document is never unmounted, never re-laid-out and
 * never scrolled, so their position is not restored — it was never lost, and
 * there is no arithmetic that can get it wrong.
 *
 * **That matters more here than the phrase "a new tab" makes it sound**,
 * because this document is virtualised: the row a reader is looking at may not
 * be in the DOM at all, `scroller.total` is a sum of estimates that moves as
 * rows are measured, and a landing computed from a remembered pixel is the
 * defect `atTail()` and `paint`'s anchor node were both written to avoid. A
 * shape with no return path cannot reintroduce it.
 *
 * **An `<a>` and not a `<button>` calling `window.open`.** Middle-click,
 * ctrl-click, "open in new window", "copy link address" and the keyboard all
 * work by construction and none of them is coded here — the same reasoning
 * `lib/disclosure.js` records for using a real `<details>`. A popup would also
 * have kept the reader's place, and is rejected for exactly these: it needs
 * script, it can be blocked, and it has no copyable address.
 *
 * **AND THE TAB IT OPENS IS BARE SINCE `seq:51`.** `laneHref` now names
 * `/lane.html`, a page of its own with no rail, no header and no status strip
 * — which is what the owner meant by a new tab and did not get the first time.
 * Nothing here changes for that: the anchor, its `target`, its `rel` and its
 * label are the same, because the SHAPE follows from the address and the
 * address follows from the kind of document. See `laneHref`.
 *
 * `.tvjump` for the look it already has, and `.tvlane` so a test can name THIS
 * control rather than counting them — the note `toNew` already carries.
 */
function laneLink(ctx, lane) {
  if (lane.present === false) {
    const gone = el('span', 'tvcut');
    gone.append(...ctx.t('conv.doc.laneGone'));
    return gone;
  }
  const open = el('a', 'tvjump tvlane');
  open.href = laneHref(lane.agentId);
  open.target = '_blank';
  // `noopener` alone would be enough for a same-origin page, and `noreferrer`
  // is not added: this app reads its own `document.referrer` nowhere, and a
  // link that hid where it came from would be inventing a policy.
  open.rel = 'noopener';
  open.append(...ctx.t('conv.doc.lane', { records: lane.records }));
  return open;
}

/**
 * The mark a dispatching step carries — **the link, the "it is gone", or the
 * "it was never in this copy", and never nothing** —
 * `INV-nothing-is-dropped-silently`.
 *
 * ── WHY THE THIRD ANSWER EXISTS, `plan:archive seq:5` ────────────────────
 *
 * A copy kept outside the project holds the SESSION transcript and not its
 * lanes, and that is a measurement rather than an oversight: this workspace's
 * 253 lanes are 615.3 MB against 65 MB of session, so mirroring them would
 * multiply the cost of keeping a session by ten for files the session's own
 * turns already summarise. The consequence has to be VISIBLE: a reader of a
 * copy meets `Agent` calls whose working they cannot open.
 *
 * Without this, the link would simply not be drawn — the roster has no entry
 * for that call — and a control that silently does nothing is worse than one
 * that says why. So an exported document says it on the step, where the reader
 * is looking, as well as once at the top.
 *
 * The condition is deliberately narrow. In a LIVE document a step with no lane
 * in the roster is the ordinary case — most tool calls dispatch nothing — and
 * saying "not in the copy" there would be a false claim on almost every step.
 */
function laneMark(ctx, lanes, toolUseId) {
  if (typeof toolUseId !== 'string' || toolUseId === '') return [];
  const lane = lanes.byCall.get(toolUseId);
  if (lane !== undefined) {
    const kind = laneKind(ctx, lane);
    const link = laneLink(ctx, lane);
    return kind === null ? [link] : [kind, link];
  }
  if (lanes.notKept !== true) return [];
  const missing = el('span', 'tvcut');
  missing.append(...ctx.t('conv.doc.laneNotKept'));
  return [missing];
}

/**
 * **THE MARK ON THE ROW WHERE A LANE REPORTED BACK** — `plan:archive seq:49`.
 *
 * ── WHY THIS ROW AND NOT ONLY THE DISPATCHING ONE ─────────────────────────
 *
 * `laneMark` above draws the way in on the step that ASKED for the work. This
 * one draws it on the turn where the work CAME BACK, and that is the row a
 * reader reaches first: they are scrolling their own session, they meet
 * *"Background task finished"*, and what they want next is the reasoning
 * behind it. Before this they had to scroll BACKWARDS to find the `Agent` call
 * — past everything the lane's report caused — or open the roster and match a
 * one-line brief by eye.
 *
 * ── TWO ROUTES TO ONE LANE IN ONE DOCUMENT, ON PURPOSE ────────────────────
 *
 * A document that holds both the dispatching step and the notification now
 * holds two links to the same transcript. **That is the decision and not an
 * accident.** They are different MOMENTS — one is where the work was asked
 * for, the other where it came back — and a reader at either one wants the
 * same file without travelling to the other. Suppressing the second when the
 * first is on screen would also be a lie in a virtualised document, where
 * "on screen" is a few dozen rows out of ten thousand and the dispatching step
 * is usually not in the DOM at all.
 *
 * ── WHICH ROWS, AND WHY NOTHING HERE DECIDES THAT ─────────────────────────
 *
 * Only a row `syntheticSpeaker` already named `subagent` carries `body.lane`
 * at all — the read model sets it nowhere else, so a Background command row or
 * a monitor tick has nothing to link with and this function is never reached
 * with an id for one. `seq:28`'s speaker mapping stays the single ruling; this
 * adds a link to a row it named and does not rename anything.
 *
 * ── AND A MISSING LANE IS SAID, NOT SWALLOWED ─────────────────────────────
 *
 * `INV-nothing-is-dropped-silently`, and `seq:15`'s three answers: the link,
 * "it is gone", or "it was never in this copy". A lane can be pruned off disk
 * after its report was written, and an exported copy carries the session
 * without its lanes. The one silence left is a roster that never loaded, which
 * the page already says once at the top (`conv.doc.lanesUnread`) — repeating
 * it on 187 rows would be the same claim 187 times.
 */
function laneReport(ctx, lanes, id) {
  const key = laneKey(id);
  if (key === null || lanes.read !== true) return [];
  const lane = lanes.byAgent.get(key);
  if (lane !== undefined) return [laneLink(ctx, lane)];
  const missing = el('span', 'tvcut');
  missing.append(...ctx.t(lanes.notKept === true ? 'conv.doc.laneNotKept' : 'conv.doc.laneGone'));
  return [missing];
}

/**
 * **WHAT KIND OF WORKER THIS LANE IS** — `plan:archive seq:50`, and the one
 * name the owner already knows.
 *
 * Owner report 2026-09-09, after clicking through to a lane successfully:
 * *"near the agent there was no name like the names i see on the terminal that
 * mostly starts with general purpose"*. The terminal names a lane by its KIND
 * first and this document named it only by its BRIEF, so the field he
 * recognises was the one field on the screen that was missing.
 *
 * ── TWO FIELDS, NEVER ONE SENTENCE ────────────────────────────────────────
 *
 * The type says what kind of worker it is; the brief says what THIS one was
 * asked to do. They are different facts and both are wanted, so this is its
 * own run beside `.tvdetail` rather than words glued onto it. The label is
 * `type`, which is the word `mycontext conversation subagents` already puts at
 * the head of the same column — one field, one name, in the CLI and on the
 * screen.
 *
 * ── AND IT IS READ OFF THE ROSTER, NOT OFF THE CALL ───────────────────────
 *
 * The dispatching call's own input carries `subagent_type`, so the fold's
 * argument list below already shows it — sometimes. Measured on this project's
 * session files, 2026-09-09: **227 `Agent` calls, 227 with a `description`,
 * only 214 with a `subagent_type`** — 13 calls named no type at all because the
 * dispatcher let it default. The lane's own sidecar carries `agentType` for
 * **269 of 269** indexed lanes, and `/subagents` already serves it into
 * `laneIndex`, so the roster is both the complete answer and the one already
 * in hand. Nothing new is read to draw this.
 *
 * ── A FIELD THAT LOOKS CONSTANT IS NOT ────────────────────────────────────
 *
 * The item warns that every lane here is `general-purpose` and that this does
 * not make the field useless. Re-measured over the whole index the warning is
 * milder than it says and the conclusion is stronger: **269 lanes, 8 distinct
 * types — 233 `general-purpose`, 21 `Explore`, 8 `fork`, and 7 more across
 * five plugin agents.** 36 of 269 rows, 13%, say something the brief does not.
 *
 * `null` is answered by drawing nothing, which is the same answer
 * `drawLaneRow` has always given an absent type, and it is not a silent drop:
 * no lane in this workspace has one (269 of 269 carry it), so a phrase saying
 * "no type was recorded" would be a sentence with no measured occurrence.
 */
function laneKind(ctx, lane) {
  if (typeof lane.agentType !== 'string' || lane.agentType === '') return null;
  const kind = el('span', 'tvkind');
  kind.append(...ctx.t('conv.lanes.kind', { type: lane.agentType }));
  return kind;
}

/**
 * What one folded step calls itself: the tool, else the blocks, else the type
 * — **and the type's own name for itself where it has one**.
 *
 * `plan:archive seq:28`. `attachment` names the ENVELOPE;
 * `total_tokens_reminder` and `hook_additional_context` name the thing, and
 * 1,218 of the owner's 4,864 attachments are the second kind while 3,646 are
 * the first. They rendered identically, so a reader could not tell the harness
 * counting tokens from a hook injecting context into that turn. The subtype is
 * drawn beside the type for the same reason `seq:13` made a fold name its
 * tools: a fold that says one word forty times cannot be skimmed.
 */
function typeWord(ctx, step) {
  if (step.tool !== null) return step.tool;
  if (Array.isArray(step.blocks) && step.blocks.includes('tool_result')) {
    return ctx.tFlat('conv.doc.result');
  }
  if (typeof step.subtype === 'string' && step.subtype !== '') {
    return `${step.type} · ${step.subtype}`;
  }
  if (Array.isArray(step.blocks) && step.blocks.length > 0) return step.blocks.join(' + ');
  return step.type;
}

/**
 * The same word, dressed — mono for an identifier, `.tvresult`'s carry hue for
 * the one that is a keyed English word rather than a name the harness wrote.
 *
 * **It is a wrapper around `typeWord` and not a second copy of that ladder**,
 * because `quietLine` below names the same types in a summary where only a
 * STRING will do. Two ladders would drift, and the drift would be a fold whose
 * collapsed line names a type differently from the row it replaced.
 */
function stepLabel(ctx, step) {
  const word = typeWord(ctx, step);
  if (step.tool === null && Array.isArray(step.blocks) && step.blocks.includes('tool_result')) {
    const said = el('span', 'tvresult');
    said.append(word);
    return said;
  }
  return mono(word);
}

/**
 * **Did this record yield anything a reader could look at?** — `plan:archive
 * seq:39`, and the whole of that item's first decision.
 *
 * ── DERIVED, NEVER LISTED ─────────────────────────────────────────────────
 *
 * The item was raised on eight type NAMES the owner was shown, and a list of
 * eight names is wrong twice over: it rots the moment the harness adds a
 * ninth, and it was already an undercount when it was written. Measured on his
 * own transcript, 2026-09-09, 32,610 records — **50 distinct `type · subtype`
 * keys appear inside folds, and 26 of them carry records that draw nothing.**
 * A hard-coded eight would have collapsed 11,256 rows and left 3,681 more
 * standing that are exactly as empty.
 *
 * So the question asked here is the one `stepParts` itself answers: after
 * `seq:28`'s field sweep, is there ANY of it left to draw? Every clause below
 * names one thing `stepParts` would have put on the screen:
 *
 *     step.text        the record's own text, whole
 *     step.input       the arguments `seq:24` captured
 *     step.detail      the one-line summary of what was asked
 *     unreadable       a chip saying the line would not parse
 *     failed           a colour, and a place in the fold's own `{n} failed`
 *     toolUseId        a lane link, when the roster holds that call
 *
 * ── THINKING IS NOT COLLAPSED, AND THAT IS A CORRECTION TO THE ITEM ───────
 *
 * A record whose only block is `thinking` passes every clause above — Claude
 * Code writes no reasoning text to a transcript, so its `text` is empty for
 * ever (`conv.doc.thinkingNever`). Measured, it is **2,158 records** in this
 * session, and folding them into a line that says "nothing but their type"
 * would be false: they say that REASONING HAPPENED, which is a fact the fold
 * already discloses once, in its own sentence, and which is not bookkeeping.
 *
 * Exported and pure so `node --test` can measure it without a browser — the
 * same bargain `laneIndex` and `matchesNode` make.
 */
export function saysNothing(step) {
  if (step === null || typeof step !== 'object') return false;
  if (step.unreadable === true || step.failed === true) return false;
  if (typeof step.text === 'string' && step.text !== '') return false;
  if (Array.isArray(step.input) && step.input.length > 0) return false;
  if (typeof step.detail === 'string' && step.detail !== '') return false;
  if (typeof step.toolUseId === 'string' && step.toolUseId !== '') return false;
  if (Array.isArray(step.blocks) && step.blocks.includes('thinking')) return false;
  return true;
}

/** Types named on the collapsed line before it says "and N more". */
const TYPES_NAMED = 4;

/**
 * ONE STEP, drawn as its pieces — the summary line, what the tool was asked,
 * and what came back.
 *
 * Shared by all three node kinds rather than written three times: a folded run
 * wraps these in an `<li>`, a promoted call (`drawDeed`) appends them under its
 * own heading, and the three turns that carry both words and a call append them
 * beneath the words. One renderer means a step looks the same wherever a reader
 * meets it, which is the property `seq:13`'s fold and `seq:16`'s promotion both
 * depend on.
 */
function stepParts(ctx, step, lanes) {
  const parts = [];
  const line = el('p', 'tvstephead');
  line.append(mono(String(step.index)), ' ', stepLabel(ctx, step));
  if (step.detail !== null && step.detail !== '') {
    const detail = el('span', 'tvdetail');
    detail.setAttribute('dir', 'auto');
    detail.textContent = stripEscapes(step.detail);
    line.append(' ', detail);
  }
  if (step.unreadable === true) {
    const bad = el('span', 'chip crit tvtag glyphed');
    bad.dataset.g = '⚠';
    bad.append(...ctx.t('conv.unreadable'));
    line.append(' ', bad);
  }

  // **THE LANE THIS STEP DISPATCHED, OPENED FROM THE STEP THAT DISPATCHED
  // IT** — `plan:archive seq:15`. The item puts the link exactly here and
  // nowhere else: the `Agent` call carries the whole brief in `input` since
  // `seq:24`, so the turn a reader is looking at when they want the working
  // IS this step. A list of lanes somewhere else on the page would be a
  // second place to look and would lose which turn each belonged to.
  //
  // Drawn on the SUMMARY LINE, above the arguments, so a reader who opens a
  // fold meets it before the brief rather than after 22 KB of it.
  //
  // TWO MARKS AND NOT ONE since `seq:50`: the KIND of worker, then the way in.
  // `laneKind`'s note carries why the type is drawn here at all and why it is
  // read off the roster rather than off this call's own arguments.
  for (const mark of laneMark(ctx, lanes, step.toolUseId)) line.append(' ', mark);

  // **THE EVIDENCE THIS STEP'S OUTPUT WAS TOO LARGE TO CARRY** — `plan:archive
  // seq:30`, beside the lane mark because it answers the same question one
  // level down: the lane mark opens the WORKING behind a call, this opens the
  // OUTPUT behind a result. Both belong on the line a reader meets first.
  //
  // It needs no roster and no second fetch — `DocStep.spills` is parsed by the
  // read model out of the step's own text and arrives in the same window.
  for (const mark of spillMarks(ctx, step)) line.append(' ', mark);
  parts.push(line);

  // WHAT THE TOOL WAS ASKED, before what came back. The owner pasted his own
  // terminal back and found a `Write(...)` and a `Bash(...)` whose file and
  // whose command were both absent from this screen: `detail` above is one
  // line of at most 160 characters, and until 2026-09-08 it was the only
  // thing the read model carried about an input at all. It was a CAPTURE
  // defect, so opening the fold could not have shown it — 3,027 of 3,280
  // tool calls on his transcript lost content, 4.45 MB of it.
  //
  // The summary line stays one line and this sits under it, so a fold is
  // still skimmable closed and complete open. Nothing is capped here: the
  // largest input in that file is 22,382 characters, against the 62,002-
  // character step TEXT this same list already draws whole.
  const args = argsList(step.input);
  if (args !== null) parts.push(args);

  // WHOLE, never clipped — see `drawTurn` above for the ruling. Measured on
  // the owner's own transcript before the cap came off: 41 of 28,998 records
  // were over the old 4,000-character step cap, the largest of them 58,888
  // characters, and every one of them sits inside a `<details>` that is
  // closed until a reader opens it.
  if (step.text !== '') parts.push(termBody(step.text));
  return parts;
}

/** The arguments of a call as a `<dl>`, or `null` when there were none. */
function argsList(input, skip = []) {
  if (!Array.isArray(input)) return null;
  const fields = input.filter((f) => !skip.includes(f.name));
  if (fields.length === 0) return null;
  const args = el('dl', 'tvargs');
  for (const field of fields) {
    const short = shortArg(field.value);
    // A `<div>` around each pair, which `<dl>` allows: it is what lets one
    // argument sit beside its name and the next one sit under it.
    const row = el('div', short === null ? 'tvargrow' : 'tvargrow tvarg1');
    const name = el('dt', 'tvarg');
    // The NAME is monospace-isolated the way `stepLabel` isolates a tool
    // name: `file_path` is an identifier, and on the Hebrew page an
    // identifier inside an RTL paragraph is reordered unless it is a run
    // of its own.
    name.append(mono(field.name));
    const value = el('dd', 'tvargv');
    value.setAttribute('dir', 'auto');
    // A BLOCK renders its escapes as colour (`seq:8`); a one-line value
    // strips them, the way `.tvdetail` above does — a control character in
    // a span is invisible damage rather than a colour. Measured: exactly
    // one record in the owner's transcript carries an escape at all, and
    // it is a tool RESULT, so neither branch fires on his file.
    if (short === null) value.append(argBody(field.value));
    else value.textContent = stripEscapes(short);
    row.append(name, value);
    args.append(row);
  }
  return args;
}

/** One named argument of a call, or `undefined`. */
function argOf(input, name) {
  if (!Array.isArray(input)) return undefined;
  const found = input.find((f) => f.name === name);
  return found === undefined ? undefined : found.value;
}

/**
 * A COMMAND THAT RAN, OR A QUESTION HE WAS ASKED — `plan:archive seq:16`,
 * drawn open where the fold used to swallow it.
 *
 * Owner ruling 2026-09-08: he wants *"the questions put to him, the suggestions
 * offered, which one he chose and what he answered — and the same for shell
 * commands that were executed."* All four were already in the file; they were
 * classified as machinery and folded away, which is what the 49 rows reading
 * "Tool step … 0 characters" on the first page of his own session actually
 * were.
 *
 * **Every option is drawn, not only the chosen one.** The item says why in one
 * line and it is the whole reason this is a list rather than a sentence: *"The
 * options he declined are the record of what was considered."*
 *
 * **The command is here; its OUTPUT is not.** That is the ruling exactly — the
 * result stays in the folded run below, where a reader can open it. What this
 * row carries about the outcome is whether it succeeded, which is the one part
 * a reader needs without opening anything.
 */
function drawDeed(ctx, body, lanes = NO_LANES) {
  const turn = el('article', 'tvturn tvsyn tvdeed');
  turn.dataset.n = String(body.n);
  const step = Array.isArray(body.steps) && body.steps.length > 0 ? body.steps[0] : null;

  const head = el('header', 'tvwho');
  const mark = el('span', 'tvmark');
  mark.dataset.g = speakerGlyph(body.who);
  head.append(mark);
  const key = SPEAKER_KEYS[body.who];
  if (key !== undefined) {
    const name = el('h4', 'tvname');
    name.append(...ctx.t(key));
    head.append(name);
  }
  const tag = el('span', 'chip index tvtag');
  tag.dataset.g = body.deed === 'ask' ? '?' : '$';
  tag.append(...ctx.t(body.deed === 'ask' ? 'conv.doc.deed.ask' : 'conv.doc.deed.ran'));
  head.append(tag);

  // HOW IT ENDED. `.exitcode` / `.exitcode.bad` is the vocabulary this app
  // already uses for the outcome of a command, so the word is keyed and the
  // colour is the stylesheet's, not this file's.
  if (body.outcome !== null) {
    const code = el('span', `exitcode${body.outcome === 'failed' ? ' bad' : ''}`);
    code.append(...ctx.t(body.outcome === 'failed' ? 'conv.doc.deed.bad' : 'conv.doc.deed.ok'));
    head.append(code);
  } else {
    // A call whose result is not in the file. Measured zero on the owner's
    // session — and said out loud rather than left as a blank that reads like
    // success. `INV-nothing-is-dropped-silently`.
    const none = el('span', 'tvcut');
    none.append(...ctx.t('conv.doc.deed.noResult'));
    head.append(none);
  }

  const day = dayText(body.timestamp);
  if (day !== null) {
    const at = el('time', 'tvat', day);
    if (typeof body.timestamp === 'string') at.dateTime = body.timestamp;
    at.setAttribute('dir', 'ltr');
    head.append(at);
  }
  turn.append(head);

  if (step === null) return turn;

  if (body.deed === 'ran') {
    // THE COMMAND EXACTLY AS IT RAN, verbatim and whole — newlines, heredocs
    // and all. `detail` collapses it to 160 characters for a fold summary and
    // 81% of the owner's are longer than that, so the summary is not the
    // record and this is.
    const command = argOf(step.input, 'command');
    if (typeof command === 'string') turn.append(termBody(command));
    const rest = argsList(step.input, ['command']);
    if (rest !== null) turn.append(rest);
  } else {
    turn.append(...askParts(ctx, body, step));
  }

  // The lane a promoted call dispatched — a shell command dispatches none
  // today, but the join is the step's and costs nothing to honour here.
  //
  // The spilled evidence joins it for the same reason and on the same terms.
  // A promoted step is the CALL record, whose text is its thinking rather than
  // a result, so this is expected to draw nothing on a shell command — the
  // spilled OUTPUT of one lands in the `tool_result` record, which is a `work`
  // step and reaches `stepParts`. It is honoured here so that a promoted step
  // is not the one place on the page where a stub goes unanswered.
  const marks = [...laneMark(ctx, lanes, step.toolUseId), ...spillMarks(ctx, step)];
  if (marks.length > 0) {
    const line = el('p', 'tvstephead');
    line.append(...marks.flatMap((node, i) => (i === 0 ? [node] : [' ', node])));
    turn.append(line);
  }
  return turn;
}

/**
 * THE QUESTIONS, THEIR OPTIONS, AND THE ONE HE PICKED.
 *
 * The question and its options arrive as STRUCTURE — `seq:24` kept every
 * argument in its own JSON type for exactly this. The ANSWER arrives as English
 * prose in the `tool_result` and there is no chosen-index field anywhere in the
 * record, so the match is by TEXT and it is allowed to fail: an option is
 * marked only when the answer names it, and an answer that matches no option is
 * drawn as itself. `DocAnswer` in the read model carries the three measured
 * shapes of that sentence.
 */
function askParts(ctx, body, step) {
  const parts = [];
  const questions = argOf(step.input, 'questions');
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const asked = Array.isArray(questions) ? questions : [];

  for (const q of asked) {
    if (q === null || typeof q !== 'object') continue;
    const text = typeof q.question === 'string' ? q.question : '';
    const line = el('p', 'tvstephead');
    line.setAttribute('dir', 'auto');
    line.textContent = stripEscapes(text);
    parts.push(line);

    const answer = answers.find((a) => a.question === text);
    const chosen = answer === undefined || answer.answer === null ? null : answer.answer;
    const options = Array.isArray(q.options) ? q.options : [];
    const list = el('ul', 'tvsteps');
    let matched = false;
    for (const option of options) {
      if (option === null || typeof option !== 'object') continue;
      const label = typeof option.label === 'string' ? option.label : '';
      // The answer sentence carries the label the harness wrote, which for a
      // recommended option ends in a marker the option itself does not have.
      const picked = chosen !== null && chosen.includes(label) && label !== '';
      if (picked) matched = true;
      const item = el('li', 'tvstep');
      const row = el('p', 'tvstephead');
      row.setAttribute('dir', 'auto');
      // **THE LABEL IS THE BRIGHT HALF AND ITS DESCRIPTION IS THE DIM ONE, AND
      // THAT ORDER WAS FOUND IN THE PICTURE.** Drawn first as a `<p
      // class="tvdetail">` of its own, the description inherited the article's
      // sans body type while the label kept `.tvstephead`'s small mono — so an
      // option's blurb shouted over the option, on the owner's own screen,
      // after every assertion had passed. `.tvdetail` is `color: var(--ink)`
      // and `.tvstep` is `color: var(--dim)`, so putting the label in the
      // first and the blurb in neither gets the hierarchy from rules that
      // already exist. No new CSS: `styles.css` is another lane's file
      // tonight.
      const name = el('span', 'tvdetail');
      name.textContent = stripEscapes(label);
      row.append(name);
      if (picked) {
        const mark = el('span', 'chip ok tvtag glyphed');
        mark.dataset.g = '✓';
        mark.append(...ctx.t('conv.doc.deed.chose'));
        row.append(' ', mark);
      }
      if (typeof option.description === 'string' && option.description !== '') {
        const why = el('span');
        why.textContent = ` — ${stripEscapes(option.description)}`;
        row.append(why);
      }
      item.append(row);
      list.append(item);
    }
    if (options.length > 0) parts.push(list);

    // WHAT HE TYPED, when it was not one of the options — or when it was one of
    // them and he wrote more beside it. Drawn as itself rather than reduced to
    // a tick nobody can read.
    if (chosen === null) {
      const none = el('p', 'tvcut');
      none.append(...ctx.t('conv.doc.deed.noAnswer'));
      parts.push(none);
    } else if (!matched || chosen.length > 120) {
      parts.push(termBody(chosen));
    }
  }

  // A SENTENCE THIS PARSER DID NOT RECOGNISE is served as it was written. The
  // shapes are measured and there are three of them, and a fourth arriving must
  // not turn into a blank row.
  if (typeof body.answerText === 'string' && body.answerText !== '') {
    parts.push(termBody(body.answerText));
  }
  const rest = argsList(step.input, ['questions']);
  if (rest !== null) parts.push(rest);
  return parts;
}

/**
 * THE RECORDS THAT SAY ONLY THEIR OWN NAME, ON ONE LINE — `plan:archive
 * seq:39`, and it is OPENABLE.
 *
 * ── WHY IT OPENS, WHICH THE ITEM LEFT TO BE DECIDED ───────────────────────
 *
 * The item warns that a fold inside a fold may be worse than the problem, and
 * asks which. It opens, for one reason that outranks the tidiness: **the
 * record indexes are the only thing these rows ever carried, and they are the
 * one thing a reader might want.** A reader who is reconciling this document
 * against the file — which is what a record index is FOR, and what
 * `conv.copy.took` counts in — needs to know that records 31,359 to 31,366 are
 * these and not a hole. `INV-nothing-is-dropped-silently` is about what a
 * reader can REACH, not only about what a count says, and a line that says
 * "nine records" with no way to learn which nine fails it.
 *
 * **And the cost the item feared is not paid here, because this is not a
 * second fold over the same material.** The outer fold hides a run of
 * MACHINERY; this hides nothing but a list of indexes and type names, which is
 * the cheapest possible thing to be behind a disclosure — it is closed, it is
 * one line, and opening it can never produce a wall of text. Measured on the
 * owner's own transcript: the rows drawn inside opened folds fall from 27,156
 * to 14,223, a 47.6% reduction, and the deepest this line can ever be is the
 * `WORK_RUN_CAP` of 40 index lines.
 *
 * ── THE TYPES ARE NAMED, UP TO FOUR ───────────────────────────────────────
 *
 * `TYPES_NAMED` and its "and N more" are `drawWork`'s own choice for tool
 * names two functions down, made again for the same reason: a summary that
 * names everything is not a summary. Measured, the median collapsed line
 * covers NINE distinct types and the worst covers fifteen, so naming them all
 * would put a fifteen-item list on the line that exists to replace a list.
 *
 * ── IT WEARS `.tvthink`, AND THAT IS BORROWED RATHER THAN CHOSEN ──────────
 *
 * `styles.css` is another lane's file tonight. `.tvthink > summary` is the
 * only rule in this stylesheet that dresses a `<summary>` INSIDE the well —
 * `--fs-00` mono, `--dim`, and the `cursor:pointer` a summary does not get on
 * its own — and it is exactly what this line wants. `.tvquiet` is beside it so
 * a test can name THIS control rather than counting `<details>` elements, the
 * note `toNew` and `tvtop` both carry. The rule I would have written is in the
 * lane's report; nothing here depends on it existing.
 */
function quietLine(ctx, steps) {
  const fold = el('details', 'tvthink tvquiet');
  const summary = el('summary');
  // **`.tvdetail` AND NOT `.tvworkn`, WHICH IS THE OBVIOUS CHOICE AND IS
  // WRONG.** Both are `color: var(--ink)` and either would have drawn the same
  // picture, but `.tvworkn` is the fold's OWN count — the number a test names
  // when it means "how many records this run holds" — and a second element
  // wearing it inside the same `<details>` turns that name into a strict-mode
  // violation. `arrived` and `copied` carry the same note about `p.tvcount`
  // one screen down, and this file has now paid for it twice. `.tvdetail` is
  // the class `askParts` already borrows for exactly this — the bright half of
  // a line whose rest is dim.
  const count = el('span', 'tvdetail');
  count.append(...ctx.t(steps.length === 1 ? 'conv.doc.quiet1' : 'conv.doc.quiet', {
    n: steps.length,
  }));
  summary.append(count);

  const named = [];
  for (const step of steps) {
    const word = typeWord(ctx, step);
    if (!named.includes(word)) named.push(word);
  }
  if (named.length > 0) {
    // **A COMMA BETWEEN THE TYPES, AND `drawWork`'s ` · ` WOULD HAVE BEEN
    // WRONG HERE.** The fold's own summary joins TOOL NAMES with ` · ` and
    // that is right, because a tool name is one word. A type word can be two
    // — `seq:28` made it `attachment · total_tokens_reminder` — so the same
    // separator drew `attachment · hook_success · system · stop_hook_summary`
    // on the owner's own document, which reads as four types and is two. Seen
    // in the browser before this line changed.
    //
    // And it is inside `mono`, whose `.m` is `direction:ltr; unicode-bidi:
    // isolate`: this is a run of identifiers the harness wrote, and on the
    // Hebrew page a comma-separated Latin list inside an RTL paragraph is
    // reordered exactly the way `dayText`'s stamp was.
    const types = el('span', 'tvtools');
    types.append(mono(named.slice(0, TYPES_NAMED).join(', ')));
    summary.append(' ', types);
  }
  if (named.length > TYPES_NAMED) {
    const more = el('span');
    more.append(...ctx.t('conv.doc.quietMore', { n: named.length - TYPES_NAMED }));
    summary.append(' ', more);
  }
  fold.append(summary);

  // Exactly the rows that were removed, and nothing added: the index and the
  // type, drawn by the same `stepLabel` the fold's own rows use. There is no
  // body to draw — that is what put them here.
  const list = el('ol', 'tvsteps');
  for (const step of steps) {
    const item = el('li', 'tvstep');
    const line = el('p', 'tvstephead');
    line.append(mono(String(step.index)), ' ', stepLabel(ctx, step));
    item.append(line);
    list.append(item);
  }
  fold.append(list);
  return fold;
}

/**
 * A run of machinery, folded to one line — the part `seq:13` says it ADDS to
 * `seq:7`, and the whole reason 27,813 records read as 4,916 nodes.
 *
 * **A fold per record is not a fold.** That is what shipped, and it is what
 * produced the owner's first screen: 49 rows saying "0 characters". A run of
 * thirty-seven records becomes one line naming what ran, and opening it shows
 * all thirty-seven — his export's own shape, where a block of tool activity is
 * summarised rather than transcribed.
 *
 * A real `<details>`, not a `<div>` with a click handler: keyboard reachable,
 * screen-reader announced and print-expandable for free, which is the reason
 * `lib/disclosure.js` gives for the same choice. There is no key handler here.
 */
function drawWork(ctx, body, lanes = NO_LANES) {
  const fold = el('details', 'tvwork');
  fold.dataset.n = String(body.n);

  const summary = el('summary', 'tvworksum');
  const mark = el('span', 'tvmark');
  mark.dataset.g = KINDS.machinery.glyph;
  summary.append(mark);

  const count = el('span', 'tvworkn');
  count.append(...ctx.t(body.span === 1 ? 'conv.doc.fold1' : 'conv.doc.fold', { n: body.span }));
  summary.append(count);

  const tools = [];
  for (const step of body.steps) if (step.tool !== null && !tools.includes(step.tool)) tools.push(step.tool);
  if (tools.length > 0) {
    const named = el('span', 'tvtools');
    named.append(tools.slice(0, 4).join(' · '));
    summary.append(named);
  }
  const failed = body.steps.filter((s) => s.failed === true).length;
  if (failed > 0) {
    const bad = el('span', 'chip crit tvtag glyphed');
    bad.dataset.g = '⚠';
    bad.append(...ctx.t('conv.doc.failed', { n: failed }));
    summary.append(bad);
  }
  fold.append(summary);

  const list = el('ol', 'tvsteps');
  let thought = 0;
  /**
   * The records that draw nothing but their own type, and the `<li>` held for
   * them — `plan:archive seq:39`.
   *
   * **The slot is placed where the FIRST of them stood**, so the collapsed
   * line is in the fold at the point the run it replaces began, rather than
   * swept to the end. Every record it covers keeps its own index inside it, in
   * file order, so the reader can still read the run in the order it happened.
   *
   * **One line per FOLD and not one per run**, which is the item's word and is
   * also what the transcript asks for. Measured on the owner's own file,
   * 2026-09-09: 2,002 folds hold at least one such record, and in **396 of
   * them the empty records are not one contiguous block** — up to six separate
   * runs inside a single fold. A line per run would have drawn six "nothing
   * but their type" lines inside one fold, which is the noise this item exists
   * to end wearing a shorter label.
   */
  const quiet = [];
  let slot = null;
  for (const step of body.steps) {
    if (Array.isArray(step.blocks) && step.blocks.includes('thinking')) thought += 1;
    if (saysNothing(step)) {
      quiet.push(step);
      if (slot === null) { slot = el('li', 'tvstep'); list.append(slot); }
      continue;
    }
    const item = el('li', `tvstep${step.failed === true ? ' tvfail' : ''}`);
    item.append(...stepParts(ctx, step, lanes));
    list.append(item);
  }
  // **`span` IS UNTOUCHED AND SO IS THE COUNT ON THE SUMMARY LINE.** The
  // records stay in the node, stay in `body.steps`, stay inside the copy a
  // marked passage takes (`passageBody` fills from the RECORD, not from the
  // DOM, so a closed line below drops nothing) and stay in
  // `sum(span) === records`. The item was offered dropping them and declined
  // it on exactly that cost; only their DRAWN FORM collapses.
  if (slot !== null) slot.append(quietLine(ctx, quiet));
  fold.append(list);

  // ── THINKING IS NEVER RECORDED, AND THAT IS SAID ONCE ──────────────────
  //
  // `plan:archive seq:28`. Measured on the owner's own transcript: 2,080
  // thinking blocks, EVERY ONE of them holding zero characters. Claude Code
  // does not persist thinking text to a transcript at all, so this is not a
  // capture bug and there is nothing to recover — the row saying "thinking"
  // with nothing beside it is TRUE, and will be true of every thinking block
  // that will ever be written.
  //
  // Which makes it a DISCLOSURE question rather than a rendering one, and
  // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` decides it:
  // what must not happen is drawing them as
  // though the text were merely missing this time. So the fold says it ONCE —
  // not 2,080 times that a block existed, and not never.
  //
  // Once per FOLD rather than once per document, because that is where a
  // reader meets the row and asks the question. The archive can never show the
  // assistant's reasoning; it can show that reasoning happened.
  if (thought > 0) {
    const note = el('p', 'tvcut');
    note.append(...ctx.t('conv.doc.thinkingNever'));
    fold.append(note);
  }
  return fold;
}

/** A node whose body has not arrived. Holds its estimated height so the scroll does not jump. */
function drawWaiting(ctx, node, height) {
  const wait = el('div', 'tvwait');
  wait.dataset.n = String(node.n);
  // A COMPUTED value, never a static one: `check-cssom-restatement.ts` refuses
  // an inline write that restates what the stylesheet already says, and this
  // number exists only at runtime.
  wait.style.minBlockSize = `${Math.round(height)}px`;
  wait.append(...ctx.t('conv.doc.loading'));
  return wait;
}

/* ══ THE DOCUMENT: THE SCROLL ══════════════════════════════════════════════ */

/**
 * Mount the virtualised document into `host` and wire it to the endpoints.
 *
 * ── HOW IT STAYS ONE DOCUMENT WHILE HOLDING ONLY A SCREENFUL ──────────────
 *
 * One container as tall as the whole session, with about thirty rows POSITIONED
 * inside it at the pixel the model says they begin. The scrollbar therefore
 * describes the whole session while the DOM holds a screenful; the reader
 * scrolls one continuous surface, and there is no page, no next control and no
 * boundary to cross.
 *
 * ── THE PART THAT IS EASY TO GET WRONG, AND WAS GOT WRONG TWICE ───────────
 *
 * A row's height is a GUESS until it has been drawn, so the model is wrong on
 * every first paint at a new position and has to be corrected from the layout.
 * The trap is that the correction can move the reader. `paint` below holds an
 * ANCHOR NODE — the node the viewport starts inside, and how far into it — and
 * puts that node back under the reader's eye after every re-sum, with the
 * offset clamped to the height the row actually took. That is
 * `TASK-a-refresh-keeps-the-reader-s-place-or-it-asks`' rule applied at the
 * scale of a single frame.
 *
 * The shape this replaced was two spacers with the rows in normal flow between
 * them, and its flaw is worth recording because it is the obvious shape: a row
 * then has TWO positions, the model's and the layout's, and they disagree by
 * construction until every height is measured. Driven on the owner's real
 * session it left the well blank at four of seven scroll positions. Positioning
 * from the model deletes the second position instead of reconciling it.
 *
 * ── AND THE PART THAT LOOKS WRONG AND IS NOT ──────────────────────────────
 *
 * Rows are MOVED, never rebuilt, while they stay in the window: `<details>` a
 * reader opened must survive a scroll of two pixels, and rebuilding would shut
 * every one of them. `live` is the map that makes that possible.
 */
/**
 * **THE FORM WITH CHECKBOXES** — `plan:archive seq:46`, step 3, and the
 * owner's own words: *"we'll show the user a form with checkboxes and user
 * could mark what to be replaced if it required."*
 *
 * ── THE SCREEN COMPOSES. THE CLI RUNS. ───────────────────────────────────
 *
 * This is not a preference and it is not a shortcut: `test/ui/no-writes.test.ts`
 * holds `src/ui/` write bindings to an exact set of ONE, so no surface here
 * can perform an export. `GET /api/conversations/:id/secrets` is a read — the
 * scanner is a module with no `node:fs` write in it at all, deliberately split
 * from the half that produces a file — and what this panel builds is a COMMAND
 * LINE. That is the Composer pattern this product already has, and the item
 * names it as one of the two acceptable answers to "where the form lives".
 *
 * ── AND IT IS COPY, NOT EXECUTE ──────────────────────────────────────────
 *
 * `commandActions` grows an Execute button when it is given a command id, and
 * it is deliberately not given one. `test/ui/palette-lib.test.ts` withholds
 * `conversation persist` from the palette in as many words — it is a write
 * whose preview says something a reader must actually READ before confirming,
 * namely what a copy of a session holds — so putting it one click from a
 * browser would settle, silently, a decision that file says is still open.
 *
 * ── NOTHING IS TICKED ─────────────────────────────────────────────────────
 *
 * Every box starts clear unless a choice already on disk ticks it, and the
 * command line is not even drawn until something is ticked. That is the rule
 * this panel could most easily break by being helpful: an export he did not
 * read must be byte-faithful, so a pre-ticked box would be this product
 * deciding for him and calling it a default.
 *
 * ── AND NO CREDENTIAL REACHES THE SCREEN ─────────────────────────────────
 *
 * The payload carries a MASK, a length, a shape and a context window with
 * every match inside it masked — never a value. So a reader who is
 * screen-sharing while they judge this list is no worse off than before they
 * opened it, which is the exact exposure `plan:archive seq:27` was closed on.
 *
 * The scan is not cheap (2.6 s over the 83.6 MB live session, measured
 * 2026-09-09), so it runs when the fold is OPENED and never on the way in.
 */
function mountSecrets(ctx, host, outline) {
  const details = el('details', 'help convsecrets');
  const summary = el('summary');
  summary.append(...ctx.t('conv.secrets.h'));
  const box = el('div', 'helpbox');
  details.append(summary, box);
  host.append(details);

  let loaded = false;
  details.addEventListener('toggle', () => {
    if (!details.open || loaded) return;
    loaded = true;
    void fillSecrets(ctx, box, outline.sessionId);
  });
  return details;
}

/** Fetch the candidates and draw them, or say why there are none to draw. */
async function fillSecrets(ctx, box, sessionId) {
  const waiting = el('p', 'small');
  waiting.append(...ctx.t('conv.secrets.reading'));
  box.append(waiting);

  let body;
  try {
    body = await ctx.api(`/api/conversations/${encodeURIComponent(sessionId)}/secrets`);
  } catch (error) {
    waiting.remove();
    box.append(errorNote(error.message));
    return;
  }
  waiting.remove();

  if (body.indexed === false) {
    const note = el('p', 'small');
    note.append(...ctx.t('conv.neverScanned'));
    box.append(note);
    const cmd = el('p', 'plate convcmd');
    cmd.append(mono(body.rebuild));
    box.append(cmd);
    return;
  }

  // The sentence FIRST, above the list, because it is the thing that makes the
  // list safe to be wrong: most of a list like this is wrong, and a reader who
  // does not know that will tick things to be tidy.
  const lede = el('p', 'small convsecrlede');
  lede.append(...ctx.t('conv.secrets.lede'));
  box.append(lede);

  if ((body.candidates ?? []).length === 0) {
    // **A MEASURED ZERO, AND NOT A PROMISE** —
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. A
    // credential that looks like an ordinary word is missed by every shape
    // here, and a clean list that read as a clean session would be exactly the
    // silent reassurance the whole design refuses.
    const none = el('p', 'small convsecrnone');
    const chip = el('span', 'chip unmeas glyphed');
    chip.dataset.g = '◌';
    chip.append(...ctx.t('conv.secrets.none'));
    none.append(chip, ' ', ...ctx.t('conv.secrets.noneWhy', { n: (body.shapes ?? []).length }));
    box.append(none);
    boundedNote(ctx, box, body);
    return;
  }

  const ticked = new Set(
    (body.candidates ?? []).filter((c) => c.accepted === true).map((c) => c.id),
  );
  const list = el('div', 'convsecrlist');
  for (const candidate of body.candidates ?? []) {
    list.append(secretRow(ctx, candidate, ticked, () => redraw()));
  }
  box.append(list);

  // The composed line lives in its own container so a tick can rebuild it
  // without disturbing the boxes above — `commandActions` bakes its argv in at
  // construction, so the row IS the selection and has to be built again when
  // the selection changes.
  const composed = el('div', 'convsecrcmd');
  box.append(composed);
  const redraw = () => {
    composed.replaceChildren();
    composed.append(...replaceRow(ctx, body, ticked));
  };
  redraw();
  boundedNote(ctx, box, body);
}

/**
 * One candidate: a checkbox, what it looks like, how often, where, and what it
 * would become.
 *
 * The label is the whole row, so the hit target is the sentence rather than a
 * 13px square — and the `<input>` is a real checkbox rather than a styled
 * `<div>`, so a keyboard and a screen reader get the control the platform
 * already knows how to describe.
 */
function secretRow(ctx, candidate, ticked, onChange) {
  const row = el('label', 'convsecr');
  const tick = el('input', 'convsecrtick');
  tick.type = 'checkbox';
  tick.value = candidate.id;
  tick.checked = ticked.has(candidate.id);
  tick.addEventListener('change', () => {
    if (tick.checked) ticked.add(candidate.id);
    else ticked.delete(candidate.id);
    onChange();
  });
  row.append(tick);

  const head = el('span', 'convsecrhead');
  head.append(
    ...ctx.t('conv.secrets.what', { what: candidate.shapeTitle }),
    ' ', mono(candidate.preview),
    // Two keys and not one with a variable, which is `conv.lane`/`conv.lanes`'
    // own shape one screen up: "1 times" is the marker of a count formatted by
    // a program that was not reading, and Hebrew does not agree with English
    // about where the plural starts anyway.
    ' · ', ...(candidate.occurrences === 1
      ? ctx.t('conv.secrets.time')
      : ctx.t('conv.secrets.times', { n: candidate.occurrences })),
    ' · ', ...ctx.t('conv.secrets.chars', { n: candidate.length }),
  );
  row.append(head);

  // WHERE it appears, because "how many times" without "where" is a number a
  // reader cannot check. Capped in the payload, and the cap says so rather
  // than being trimmed into a shorter list that looks complete.
  const where = el('span', 'convsecrwhere');
  const at = (candidate.records ?? []).join(', ')
    + (candidate.recordsOmitted > 0 ? `+${candidate.recordsOmitted}` : '');
  // Spelled `records: at` rather than as a shorthand `{ records }`: the slot
  // checker in `test/ui/viewmodel.test.ts` reads object-literal KEYS out of
  // this file, and ES shorthand hides the key from it — so a substitution that
  // IS passed reads as one that is missing, and the test that exists to catch
  // `{records}` reaching the screen goes red over the opposite.
  where.append(...ctx.t('conv.secrets.at', { records: at }), ' ', mono(candidate.paths?.[0] ?? '—'));
  row.append(where);

  // **THE CONTEXT IS THE FIELD THAT DOES THE WORK.** The shape and the count
  // say what a candidate is; this is what tells `secret = cryptoRandomBytes`
  // from a credential. Measured over 333 MB of this machine's transcripts on
  // 2026-09-09: of 19 distinct candidates, 13 were identifiers, quotations,
  // regex source or test probes — and every one of them is dismissible at a
  // glance from this line alone.
  const context = el('span', 'convsecrctx');
  context.append(mono(candidate.contexts?.[0] ?? ''));
  row.append(context);

  // What it BECOMES, shown before the choice rather than after it.
  const becomes = el('span', 'convsecrinto');
  becomes.append(...ctx.t('conv.secrets.becomes'), ' ', mono(candidate.placeholder));
  row.append(becomes);
  return row;
}

/** The command a tick composes, or the sentence that says nothing is ticked. */
function replaceRow(ctx, body, ticked) {
  const out = [];
  if (ticked.size === 0) {
    const note = el('p', 'small convsecrnothing');
    note.append(...ctx.t('conv.secrets.nothing'));
    out.push(note);
    return out;
  }
  const argv = [
    ...body.persistCommand.split(' '),
    body.sessionId,
    '--replace',
    [...ticked].join(','),
  ];
  const heading = el('p', 'small convsecrrun');
  heading.append(...ctx.t('conv.secrets.run', { n: ticked.size }));
  const cmd = el('div', 'cmd');
  cmd.append(el('code', null, composeCommand(argv)));
  out.push(heading, cmd, commandActions({ argv, id: null, values: {}, ctx }));
  return out;
}

/**
 * The bound, drawn only when it BIT.
 *
 * A scan that read the whole file says nothing — a per-open line about a cap
 * nobody reached is noise — and one that stopped at the cap says its counts
 * are floors, because a list a reader believes is complete is worse than one
 * that admits it is not.
 */
function boundedNote(ctx, box, body) {
  if (body.truncated === true) {
    const note = el('p', 'small convsecrfloor');
    note.append(...ctx.t('conv.secrets.floor', { bytes: formatBytes(body.cap) }));
    box.append(note);
  }
  if ((body.unreadable ?? 0) > 0) {
    const note = el('p', 'small convsecrunread');
    note.append(...ctx.t('conv.secrets.unreadable', { n: body.unreadable }));
    box.append(note);
  }
  if (body.chosen !== null && body.chosen !== undefined) {
    const note = el('p', 'small convsecrchosen');
    note.append(...ctx.t('conv.secrets.chosen', {
      n: body.chosen.accepted.length, replaced: body.chosen.replaced,
    }));
    box.append(note);
  }
}

/**
 * **EXPORTED FOR `/lane.js` AND FOR NOTHING ELSE** — `plan:archive seq:51`.
 *
 * The bare lane window is a second PAGE, not a second VIEWER. It supplies a
 * host element and the four-field `ctx` this function actually uses (`t`,
 * `tFlat`, `api`, `navigate`) and then calls THIS — so the virtualised scroll,
 * the byte-offset windowing, the landing at the end, the follow timer, the
 * folds, the copy bar, the lane links and the agent type are the same code on
 * both pages by construction. A page that forked any of it is what `seq:15`
 * refused and what `rowFor` exists to prevent.
 */
export function mountDocument(ctx, host, outline, back, roster = NO_LANES, landAt = null) {
  const nodes = outline.nodes;
  /**
   * **A COPY IS STATIC, AND EVERY BEHAVIOUR ON THIS SCREEN THAT ASSUMES A LIVE
   * FILE HAS TO KNOW** — `plan:archive seq:5`.
   *
   * `source === 'exported'` means the transcript the harness wrote is gone and
   * this document is being read out of the copy that was kept. Such a file
   * cannot grow: there is nothing appending to it, so there is nothing to
   * poll, no Stop-hook refresh behind it, and no lane transcripts beside it.
   */
  const isCopy = outline.source === 'exported';
  const lanes = { ...roster, notKept: isCopy };

  /* ── head ──────────────────────────────────────────────────────────────── */
  const head = el('div', 'tvhead');
  const backButton = el('button', 'tvback');
  backButton.type = 'button';
  backButton.append(...ctx.t('conv.back'));
  backButton.addEventListener('click', back);
  head.append(backButton);

  const title = el('h3', 'tvtitle');
  const facts = el('p', 'tvfacts');
  /**
   * The two lines of the head that describe the FILE rather than the screen —
   * and they are a function because `seq:19`'s silent rebuild re-reads that
   * file underneath them.
   *
   * A transcript that was REPLACED rather than appended to comes back at a
   * different size, and possibly with a different title and branch. Drawing
   * these once at mount and never again would leave a head stating the size of
   * a file that no longer exists, beside a document built from the one that
   * does — which is worse than the notice it replaced, because nothing on the
   * page would say so. `INV-nothing-is-dropped-silently`.
   */
  const fillHead = () => {
    title.replaceChildren(...titleNodes(ctx, outline));
    facts.replaceChildren(mono(outline.sessionId));
    if (outline.branch !== null) facts.append(' · ', mono(outline.branch));
    facts.append(' · ', mono(formatBytes(outline.bytes)));
  };
  fillHead();
  head.append(title);
  head.append(facts);

  /**
   * **THE ROSTER, WHICH THE COUNT USED TO BE THE END OF** — `plan:archive
   * seq:41`. Until this, a count of helper agents was a dead end everywhere
   * it was drawn and `mycontext conversation subagents` in a terminal was the
   * only way to see the list.
   *
   * **AND IT IS NO LONGER THE ONLY WAY IN — `plan:archive seq:53`.** What
   * stood here said the list row could not carry this control, because the row
   * was a `<button>` and an `<a>` inside one is markup a browser un-nests; the
   * roster was therefore two clicks from the list rather than one. That was
   * true and it was a limitation being disclosed, not a design, and `seq:53`
   * removed it: `drawRow` is a container with the open-the-session control and
   * `a.convlanelink` side by side in it, so the count on the LIST is a link to
   * exactly this address. The paragraph is rewritten rather than deleted
   * because the reason a nested anchor was refused is still the reason this
   * control is shaped the way it is.
   *
   * **Drawn from `lanes.owner`, not from this document's own id**, which is
   * what makes it work on a lane as well as on a session: 43 of this
   * workspace's 264 lanes were dispatched from inside another lane, and the
   * roster endpoint resolves any id to the session that owns it
   * (`SubagentListBody.ownerSessionId`). So a reader on a depth-2 lane reaches
   * its 263 siblings — which is the route the item says some of them have no
   * other way to be found by.
   *
   * A `<button>` and not a link, and the same tab: the roster is a LIST, so
   * there is no scroll position to lose and no reason to spend a tab on it.
   * `seq:15`'s new-tab ruling is about THIS document — a virtualised scroll
   * whose position cannot be recomputed — and it does not generalise to a
   * page of rows the browser's own Back restores.
   */
  if (lanes.read === true && lanes.total > 0) {
    const roster = el('button', 'tvjump tvlanes');
    roster.type = 'button';
    roster.append(...ctx.t(lanes.total === 1 ? 'conv.lane' : 'conv.lanes', { n: lanes.total }));
    roster.addEventListener('click', () => {
      ctx.navigate(rosterHref(lanes.owner ?? outline.sessionId));
    });
    head.append(roster);
  }
  host.append(head);

  // **A LANE SAYS IT IS A LANE, AND SAYS WHOSE.** Opened in a tab of its own it
  // otherwise arrives with no context at all: a transcript whose title is a
  // one-line brief and whose Back button goes to a list it is not on. `source`
  // is the read model's own honest answer to "what is this row"
  // (`subagentAsRow`), so the screen states it rather than inferring it from
  // the id.
  //
  // The session link is `target="_blank"` for the same reason the lane link
  // is: a reader has a position in THIS document too, and following a link
  // must not cost it. Never a same-tab replacement — see `laneLink`.
  if (outline.source === 'subagent') {
    const from = el('p', 'tvnote tvlaneof');
    from.append(...ctx.t('conv.doc.laneOf'));
    if (lanes.owner !== null) {
      const home = el('a', 'tvjump tvlanehome');
      home.href = sessionHref(lanes.owner);
      home.target = '_blank';
      home.rel = 'noopener';
      home.append(...ctx.t('conv.doc.laneHome'));
      from.append(' ', home);
    }
    /**
     * **THE WAY BACK OUT OF THE TAB `seq:15` OPENED** — `plan:archive
     * seq:40`, and it is here because it was MEASURED to work rather than
     * assumed.
     *
     * The item is right that this needed a measurement: `window.close()` is
     * specified to work only on a window a script opened, or on one whose
     * session history holds a single entry, and `laneLink` sets
     * `rel="noopener"` — so the new tab has **no `window.opener` at all** and
     * cannot lean on the first clause. Driven in GOOGLE CHROME ITSELF on
     * 2026-09-09, through a real trusted click on `a.tvlanehome` against this
     * app on an ephemeral port:
     *
     *     window.opener in the new tab                     null
     *     history.length in the new tab                       1
     *     window.close() from the page                    CLOSED   target gone
     *     window.close() after a hash navigation          CLOSED   still gone
     *
     * `e2e/conversations.spec.ts` re-takes that measurement in chromium AND
     * in chrome on every run, because it is a browser rule rather than a fact
     * about this code, and browser rules move.
     *
     * ── WHY IT IS GATED ON `history.length === 1` ────────────────────────
     *
     * A reader who reached this lane WITHOUT a new tab — by editing the hash,
     * or by a route this screen may grow later — has somewhere to go back to,
     * and closing their only tab would take the session away with it. One
     * history entry is the honest, measurable signature of "this tab was
     * opened for this document and has shown nothing else", which is exactly
     * the tab this control is for. The back-link above is the route in every
     * other case and is drawn either way.
     *
     * ── AND IT IS NEVER A BUTTON THAT SILENTLY DOES NOTHING ──────────────
     *
     * If a browser refuses after all, the page SAYS SO in the reader's own
     * language and points at the link beside it, rather than sitting there
     * having appeared to work. `INV-nothing-is-dropped-silently` — and this
     * project has just removed two disclosures for being unreachable.
     *
     * **`.tvjump` sets its own colour, background and border**, which is the
     * item's standing requirement after a Clear button shipped at contrast
     * 1.0: `--ink-dim` on `--panel-2`, not the user agent's default. It is the
     * class Top, End and "N new below" already wear, and the label is TWO
     * WORDS for the reason `styles.css` gives beside `.tvlane` — a sentence
     * in a bordered mono box wraps into two open-ended boxes.
     */
    if (window.history.length === 1) {
      const shut = el('button', 'tvjump tvlaneshut');
      shut.type = 'button';
      shut.append(...ctx.t('conv.doc.laneShut'));
      shut.addEventListener('click', () => {
        window.close();
        // `window.closed` does not become true synchronously in every engine,
        // so the refusal is read one turn later. A tab that really closed
        // never runs this.
        setTimeout(() => {
          if (window.closed === true) return;
          shut.disabled = true;
          const why = el('span', 'tvcut');
          why.append(...ctx.t('conv.doc.laneShutNo'));
          from.append(' ', why);
        }, 250);
      });
      from.append(' ', shut);
    }
    host.append(from);
  }

  // **WHICH OF THE THREE FILES A READER IS LOOKING AT, SAID ON THE PAGE** —
  // `plan:archive seq:5`: *"A copy that looks identical to a live session is
  // worse than no copy, because a reader cannot tell which they are acting
  // on."* The list marks it with a chip; a document opened in a tab of its own
  // has no list beside it, so it says it in a sentence.
  //
  // The two are not one sentence with a variable in it, because they are not
  // one fact: a persisted session can still be checked against the harness's
  // own file, and an exported one cannot, and that difference is exactly what
  // the reader needs in order to know what they are holding.
  if (outline.source === 'persisted' || isCopy) {
    const kept = el('p', 'tvnote tvkept');
    kept.append(...ctx.t(isCopy ? 'conv.doc.isCopy' : 'conv.doc.isKept'));
    host.append(kept);
  }

  if (outline.present === false) {
    const gone = el('p', 'tvnote tvwarn');
    gone.append(...ctx.t('conv.prunedBody'));
    host.append(gone);
    if (outline.uncounted !== null) {
      const why = el('p', 'tvnote');
      why.textContent = outline.uncounted;
      host.append(why);
    }
    return;
  }

  /**
   * **THE CHECKBOX FORM, and only on a SESSION.** `plan:archive seq:46`.
   *
   * A lane is not persisted — `mycontext conversation persist` takes a session
   * and the mirror is a session's — so there is no export for a choice to
   * apply to and a form on a lane would compose a command the CLI refuses.
   * `outline.source === 'subagent'` is the read model's own answer to "what is
   * this document", so the screen asks it rather than guessing from the id.
   *
   * Above the bar and below the head, in a fold that is CLOSED: it is about
   * the file rather than about the reading, it costs a scan to open, and a
   * reader who came to read a conversation should not have to scroll past a
   * list of things that look private in order to reach it.
   */
  if (outline.source !== 'subagent') mountSecrets(ctx, host, outline);

  /* ── bar ───────────────────────────────────────────────────────────────── */
  const bar = el('div', 'tvbar');
  const find = el('input', 'tvfind');
  find.type = 'text';
  find.placeholder = ctx.tFlat('conv.doc.filter');
  // A placeholder alone is not an accessible name.
  find.setAttribute('aria-label', ctx.tFlat('conv.doc.filter'));
  bar.append(find);

  // **`tvtop` AND `tvend` ARE HANDLES, and they exist because counting broke
  // twice.** `seq:19` added a third `button.tvjump` and the note on `toNew`
  // below records what it cost: `e2e/conversations.spec.ts` reached End with
  // `.last()`, and a new control moved it. The copy controls
  // (`TASK-a-selected-passage-copies-as-something-a-terminal-will`) are inside
  // THIS bar, so `.last()` inside `.tvbar` moved as well — the same defect, one
  // scope in. A test that names the button it means cannot be broken by a
  // button it does not, so both of these now say which one they are.
  const toTop = el('button', 'tvjump tvtop');
  toTop.type = 'button';
  toTop.append(...ctx.t('conv.doc.top'));
  const toEnd = el('button', 'tvjump tvend');
  toEnd.type = 'button';
  toEnd.append(...ctx.t('conv.doc.end'));
  bar.append(toTop, toEnd);

  /* ── THE THREE COPIES ───────────────────────────────────────────────────
   *
   * `TASK-a-selected-passage-copies-as-something-a-terminal-will`. Each is
   * named by WHAT IT IS FOR, which is the item's own instruction and not a
   * style preference: *"A menu offering 'text / rendered / raw' makes a reader
   * guess; one offering 'paste into a prompt / paste as it looks / the exact
   * record' does not."*
   *
   * **Three buttons rather than one button and a menu**, so that the choice is
   * visible without being opened and a test can name each one. They live in the
   * bar that already holds Top and End, so nothing appears or disappears as a
   * selection is made and dropped — a control that materialised beside a
   * marked passage would reflow the page under a reader in the middle of
   * marking it. They are DISABLED until something is marked instead.
   *
   * **They wear `.tvjump` and get no colour of their own.** This app has
   * already shipped a Clear button at contrast ≈ 1.0 by letting a new control
   * inherit the user agent's background; `.tvjump` sets `color`, `background`
   * and `border` explicitly and is the class Top, End and "N new below"
   * already wear, so the only new rule is `:disabled`.
   */
  const copyLabel = el('span', 'tvcopyh');
  copyLabel.append(...ctx.t('conv.copy.h'));
  const copyMessage = el('button', 'tvjump tvcopy tvcopymsg');
  copyMessage.type = 'button';
  copyMessage.append(...ctx.t('conv.copy.msg'));
  const copySeen = el('button', 'tvjump tvcopy tvcopyseen');
  copySeen.type = 'button';
  copySeen.append(...ctx.t('conv.copy.seen'));
  const copyRaw = el('button', 'tvjump tvcopy tvcopyraw');
  copyRaw.type = 'button';
  copyRaw.append(...ctx.t('conv.copy.raw'));
  /**
   * **"Reconstruct from this"** — `plan:recall seq:2` Task 11, and §3's
   * primary way in.
   *
   * It sits in the copy bar because that is where a reader already is the
   * moment he has a passage marked, and because the finding it rests on is
   * exactly about this moment: *"every extraction method is a guess at what he
   * cares about. A selection is not a guess."* Measured against this archive
   * as FTS5 queries, item-id slugs matched 68% where headings matched 4%, and
   * a passage worth marking is dense in those.
   *
   * It COPIES NOTHING and sends nothing. It fills the panel at the foot of
   * this document with the message text of what is marked and takes the reader
   * to it, which is one scroll rather than a screen change — the reader has a
   * position in this virtualised document and following a link would cost it.
   */
  const recall = el('button', 'tvjump tvcopy tvrecall');
  recall.type = 'button';
  recall.append(...ctx.t('conv.recall.h'));
  bar.append(copyLabel, copyMessage, copySeen, copyRaw, recall);
  host.append(bar);

  /* ── THE STEPPER ────────────────────────────────────────────────────────
   *
   * **`TASK-there-is-no-way-to-step-through-the-marks-or-through-your`**,
   * owner ruling 2026-09-15, option 3c. His words: *"jump to marks forward and
   * backward as well as the user prompts 'You'"*.
   *
   * Measured before this existed: nothing in this file stepped the document by
   * anything. Top and End are the two ends, the find box narrows, and the only
   * other movement on the screen is the reader's own scrolling. A reader who
   * had marked twelve points in a 61 MB session could reach them one at a time
   * from the LIST, on another screen, losing this document each time.
   *
   * ── A SECOND ROW AND NOT FOUR MORE CONTROLS IN `tvbar` ─────────────────
   *
   * `.tvbar` already carries seven: the find box, Top, End, three copies and
   * Reconstruct. Four more in it would put "where am I" and "what do I take"
   * on one line, and `e2e/conversations.spec.ts` has already been broken twice
   * by `.last()` inside that bar finding a control that moved. These are a
   * group of their own, named as one, and each button says which it is.
   *
   * ── NO ARROW GLYPHS, AND THAT IS A BIDI DECISION ──────────────────────
   *
   * A `◂`/`▸` pair means "back"/"forward" only in a left-to-right reading
   * order. Half this archive is Hebrew and the anchors card already isolates
   * every identifier for that reason; a triangle that flips meaning with the
   * page direction is a second thing to reconcile for no reader's benefit, so
   * the buttons carry words in both languages and no mark at all.
   */
  const nav = el('div', 'tvnav');
  nav.setAttribute('role', 'group');
  nav.setAttribute('aria-label', ctx.tFlat('conv.nav.region'));
  const navHead = el('span', 'small tvnavh');
  navHead.append(...ctx.t('conv.nav.h'));
  const markPrev = el('button', 'tvjump tvnavstep tvnavmarkprev');
  markPrev.type = 'button';
  markPrev.append(...ctx.t('conv.nav.markPrev'));
  const markNext = el('button', 'tvjump tvnavstep tvnavmarknext');
  markNext.type = 'button';
  markNext.append(...ctx.t('conv.nav.markNext'));
  const markCount = el('span', 'small tvnavcount tvnavmarkcount');
  const youPrev = el('button', 'tvjump tvnavstep tvnavyouprev');
  youPrev.type = 'button';
  youPrev.append(...ctx.t('conv.nav.youPrev'));
  const youNext = el('button', 'tvjump tvnavstep tvnavyounext');
  youNext.type = 'button';
  youNext.append(...ctx.t('conv.nav.youNext'));
  const youCount = el('span', 'small tvnavcount tvnavyoucount');
  /*
   * **EACH PAIR AND ITS COUNT ARE ONE GROUP**, and it was laid out the other
   * way first. With all six controls in one flex row and the counts at
   * `flex-basis:100%`, the bar came out THREE lines tall at 1280x720 — pair,
   * count, pair, count — above a `.tvbar` that is already two. Worse on a
   * narrow screen: the counts and the buttons interleave, so "16 message(s) of
   * yours" can end up sitting under the MARK pair and describing it.
   *
   * A group wraps as a unit and its count can never be orphaned onto the other
   * pair. Measured after the change at the same size: two lines, and the two
   * groups side by side.
   *
   * **AND THERE ARE THREE GROUPS SINCE 2026-09-16, so that measurement is
   * re-taken rather than left standing.** `semantic/8` added the find walk's
   * own pair. Measured at 1280x1000: the bar is 60.8 px with nothing typed and
   * **162.8 px with a query in the box** (95.2 px in Hebrew, whose sentences
   * are shorter), and the groups sit on three lines rather than two. The
   * property this comment exists to protect is unchanged and is the reason the
   * growth is acceptable: each pair still wraps with its own count, so no
   * count can describe the pair above it. The height is on the lane's report
   * as the owner's to look at.
   */
  /* ── WHICH KIND OF MARK THE WALK IS OVER ────────────────────────────────
   *
   * **`TASK-the-six-kinds-a-mark-can-carry-have-no-reader-so-you-cannot`**,
   * owner ruling 2026-09-15, chosen from four this screen's previous lane
   * offered. His problem: `anchors/2` gave him six kinds and `anchors/3` gave
   * him a walk over every mark, and *"the two do not meet"* — a reader who
   * marked four defects across a long session had to walk every mark to find
   * them.
   *
   * **ONE CONTROL, AND THE ITEM SAYS WHY IT MUST BE.** Six kinds times two
   * directions is twelve buttons on a bar this project measured at one line;
   * the item names a select beside the existing pair as the shape that does
   * not cost that, and this is it. The bar's height afterwards is measured in
   * the browser and carried in the lane's report, the way the stepper's was.
   *
   * **IT IS A FILTER OVER `markStops`, NOT A SECOND WALK.** The item is
   * explicit — *"two walks that can disagree about where the reader is would
   * be worse than no filter"* — so there is one `markStops`, one `cursor`, one
   * `step`, and this select changes exactly one line inside the first of them.
   * Everything the stepper earned therefore still holds with no second
   * implementation to keep in step: a stop is a NODE and not an anchor, the
   * caret does not move, the ends are said rather than disabled, and the walk
   * reaches past the list's page bound because these stops never came from the
   * list.
   *
   * **THE OPTIONS ARE THE KINDS THIS DOCUMENT ACTUALLY HOLDS**, not the nine
   * the build has words for. A conversation with three notes and one defect
   * offers two choices and an "every kind"; offering `a report` there is a
   * control that can only ever answer "nothing", which is the measured-zero
   * rule pointed at a `<select>`. It also keeps the automatic pass's own kinds
   * — `table`, `report`, `ruling`, which are NOT in `OWNER_KIND_CHOICES` —
   * reachable, because they are in the document whether or not he may write
   * them by hand.
   *
   * **AND THE LIST IS ONLY REBUILT WHEN IT CHANGED.** `navRefresh` runs on
   * every filter keystroke and after every write; replacing the options each
   * time would shut the dropdown under a reader who had it open and throw the
   * caret off it. The signature below is what makes that unwritable.
   */
  const kindPick = el('select', 'small tvnavkind');
  kindPick.setAttribute('aria-label', ctx.tFlat('conv.nav.kindLabel'));
  /* ── AND THE KEY IS SHOWN ON THE CONTROL ────────────────────────────────
   *
   * `TASK-stepping-to-the-next-mark-of-a-particular-kind-needs-its-own`, its
   * fourth constraint in its own words: *"THE KEY IS SHOWN ON THE CONTROL, or
   * the fast path is as undiscoverable as the right-click was."*
   *
   * **Three carriers, exactly as `shortcutOn` spends them on a button, and for
   * the same three readers** — the `title` for a reader who hovers, the chip
   * for one who does not, `aria-keyshortcuts` for one who hears. The chip is
   * `aria-hidden` so the `<select>`'s accessible name stays the sentence
   * `conv.nav.kindLabel` gives it.
   *
   * **`shortcutOn` is NOT called, and that is deliberate rather than an
   * oversight.** It returns before drawing a chip on anything that is not a
   * `<button>` — a chip cannot be appended INTO a `<select>`, whose children
   * are its options — and it writes the one-key sentence, which would name `K`
   * and silently drop `Shift+K`. This control is the only one on the bar with
   * a PAIR of keys and no button to hang them on, so it gets the pair's own
   * sentence and a sibling chip.
   *
   * `span.m` on the chip for the reason every identifier on this screen wears
   * it: a Latin legend inside a Hebrew bar lands at the wrong end of it unless
   * it is isolated.
   */
  const kindNextKey = DOC_SHORTCUTS.find((binding) => binding.action === 'kindNext');
  const kindPrevKey = DOC_SHORTCUTS.find((binding) => binding.action === 'kindPrev');
  kindPick.setAttribute('aria-keyshortcuts', `${kindNextKey.show} ${kindPrevKey.show}`);
  kindPick.title = ctx.tFlat('conv.keys.onPair',
    { key: kindNextKey.show, back: kindPrevKey.show });
  const kindChip = el('span', 'm tvkey tvnavkindkey', kindNextKey.show);
  kindChip.setAttribute('aria-hidden', 'true');
  const markGroup = el('div', 'tvnavgroup tvnavmarks');
  markGroup.append(kindPick, kindChip, markPrev, markNext, markCount);
  const youGroup = el('div', 'tvnavgroup tvnavyous');
  youGroup.append(youPrev, youNext, youCount);
  /*
   * **AND A THIRD PAIR, FOR WHAT THE FIND BOX FOUND** — `semantic/8`.
   *
   * The item asks for the count and the position together: *"a reader needs
   * to know how many there are and where he is in them"*. The marks pair and
   * the "You" pair already answer that shape, so this is the same shape a
   * third time rather than a new control language — one group, two buttons
   * and a count that says what it counts, wrapping as a unit for the reason
   * `markGroup` records above.
   *
   * **No glyphs**, which is the bidi decision this bar already took: half
   * this archive is Hebrew and a triangle means "forward" only in a
   * left-to-right reading order.
   */
  const foundPrev = el('button', 'tvjump tvnavstep tvnavfoundprev');
  foundPrev.type = 'button';
  foundPrev.append(...ctx.t('conv.nav.foundPrev'));
  const foundNext = el('button', 'tvjump tvnavstep tvnavfoundnext');
  foundNext.type = 'button';
  foundNext.append(...ctx.t('conv.nav.foundNext'));
  const foundCount = el('span', 'small tvnavcount tvnavfoundcount');
  const foundGroup = el('div', 'tvnavgroup tvnavfounds');
  foundGroup.append(foundPrev, foundNext, foundCount);
  nav.append(navHead, markGroup, youGroup, foundGroup);
  host.append(nav);

  /**
   * The kind the mark walk is narrowed to, or `null` for every kind.
   *
   * `null` and not `''`: the empty string is what the `<option>` carries, and
   * a state that is a control's value is a state that changes meaning the day
   * the control does.
   */
  let markKind = null;
  /** The option list as last drawn, so it is only rebuilt when it moved. */
  let kindsDrawn = null;
  /** A kind's word in the reader's language, or the kind itself. */
  const kindWord = (kind) => (ANCHOR_KIND_KEYS.has(kind)
    // A kind this build has no word for is drawn AS ITSELF — `anchorRow`'s own
    // rule, for its own reason: `t()` THROWS on a key it does not hold, and a
    // throw inside a render leaves a tab showing nothing at all.
    ? ctx.tFlat(`conv.anchors.kind.${kind}`) : kind);

  /**
   * **WHERE A STEP LANDED, ANNOUNCED OUTSIDE THE WELL.**
   *
   * The same trap `.convanchsaid` was mounted at the card for: a sentence
   * rendered on the ROW a step lands on is destroyed by the next `paint` —
   * rows are evicted the moment they leave the window, and a step that moves
   * the reader is exactly the gesture that evicts things. This region is a
   * sibling of the bar, so nothing the scroll does can take it down.
   *
   * It is also the whole of how a step is legible to a reader who cannot see
   * the scroll move: `aria-live` announces "marked point 3 of 12" with the
   * name on it, which is the one thing that says WHICH mark this is.
   */
  const navSaid = el('p', 'tvnote tvnavsaid');
  navSaid.setAttribute('aria-live', 'polite');
  navSaid.hidden = true;
  host.append(navSaid);

  const count = el('p', 'tvcount');
  count.setAttribute('aria-live', 'polite');
  host.append(count);

  /**
   * What the last copy actually took — and, before there has been one, how to
   * make one.
   *
   * **This is where `INV-nothing-is-dropped-silently` is discharged for the
   * two omissions that cannot live in the payload.** A closed fold and a
   * synthetic turn are disclosed IN the copied text, because they have to
   * travel with it. A bare shell command copied on its own cannot carry a
   * disclosure — a note above it would be the thing that stops a terminal
   * accepting it, which is the whole case the item was filed for — so what was
   * left beside the command is said HERE. Same for a rendered copy that could
   * not reach sections the browser is not currently drawing.
   *
   * `aria-live` so a reader who cannot see the line still hears what was
   * taken, and `tvnote` rather than `tvcount` for the reason the arrived line
   * gives above: `p.tvcount` is a test's handle for the count line and a second
   * element wearing it turns that handle into a strict-mode violation.
   */
  const copied = el('p', 'tvnote tvcopied');
  copied.setAttribute('aria-live', 'polite');
  copied.append(...ctx.t('conv.copy.hint'));
  host.append(copied);

  /**
   * The text the page would put on the clipboard, kept in the document.
   *
   * It exists for the `execCommand` fallback, which needs something selectable
   * when `navigator.clipboard` is refused — a headless engine with no
   * clipboard permission, or any page not on a secure context. It is `hidden`,
   * so the reset's `[hidden]{display:none}` removes it, and it is unhidden for
   * the length of one synchronous copy and hidden again.
   *
   * It is also what a browser test can read. That is not a back door: a suite
   * that cannot get at the OS clipboard should assert the payload the page
   * WOULD write rather than pretend to read the clipboard, and this element is
   * that payload, written before either clipboard path is attempted.
   */
  const clip = el('pre', 'tvclip');
  clip.hidden = true;
  clip.setAttribute('aria-hidden', 'true');
  host.append(clip);

  /**
   * "N new below" — the affordance for the reader who has SCROLLED UP.
   *
   * `plan:archive seq:19` rules the condition both ways: at the tail, append
   * and follow; scrolled up, append and DO NOT MOVE. "A reader dragged to the
   * bottom mid-sentence has been punished for reading." So the arrival of new
   * turns reaches a reader who is not at the end as a thing they can take,
   * never as a jump they did not ask for.
   *
   * It is a real `<button>` in an `aria-live` region, above the well rather
   * than floating inside it: a reader scrolled to the middle of a virtualised
   * document must be able to reach this without hunting, and a screen reader
   * has to hear that it appeared.
   */
  // `tvnote` and NOT `tvcount`. The count line is addressed as `p.tvcount` by
  // `e2e/conversations.spec.ts` — twice, once for its `aria-live` and once for
  // the whole-session figure — and a second element wearing that class turned
  // both into strict-mode violations. A new control does not get to rename an
  // existing one by sharing its class.
  const arrived = el('p', 'tvnote tvarrived');
  arrived.setAttribute('aria-live', 'polite');
  arrived.hidden = true;
  // `tvjump` for the look it already has, and `tvnew` so a test can name THIS
  // button rather than counting them: `button.tvjump` used to resolve to two
  // controls and now resolves to three, and `e2e/conversations.spec.ts` reached
  // the End button with `.last()`.
  const toNew = el('button', 'tvjump tvnew');
  toNew.type = 'button';
  arrived.append(toNew);
  host.append(arrived);

  // Drawn only when a window refuses, and never removed once drawn: a reader
  // who saw part of a document must be told the rest could not be read.
  const failed = el('div', 'tvfail');
  failed.hidden = true;
  host.append(failed);

  /* ── the scroll ────────────────────────────────────────────────────────── */
  const scroll = el('div', 'tvscroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', ctx.tFlat('conv.doc.region'));
  /**
   * The document's whole height, with the drawn rows POSITIONED inside it.
   *
   * ── WHY NOT TWO SPACERS, WHICH IS THE OBVIOUS SHAPE AND WAS THE FIRST ONE ──
   *
   * A top spacer, the rows in normal flow, a bottom spacer. It is simpler to
   * write and it has one flaw that cost this build two rounds of repair: **a
   * row then has two positions** — the one the model computes and the one the
   * layout gives it, which is the top spacer's height plus the real heights of
   * its neighbours. Every height starts as an estimate, so the two disagree by
   * construction on every first paint, and the whole correction pass exists to
   * reconcile them. Driven on the owner's real session that reconciliation
   * left the well **completely blank at four of seven scroll positions**: the
   * model said the thirteen drawn rows filled 5,200px, the layout had put them
   * in 2,133px, and the viewport sat below all of them.
   *
   * Absolute positioning deletes the disagreement instead of reconciling it. A
   * row's top is WRITTEN from the model, so it is where the model says it is,
   * always. `total` is the model's own sum, so the scrollbar describes the
   * whole session. A measurement then changes only one thing — the model — and
   * the layout follows it on the next line of code rather than arguing with
   * it.
   */
  const inner = el('div', 'tvinner');
  scroll.append(inner);
  host.append(scroll);

  // The line that used to stand here read "A turn longer than 60000
  // characters is shown up to there and says so; tool output, up to 4000." It
  // is what the owner was reading when he ruled the caps out, and it went with
  // them: a disclosure of a limit that no longer exists is a false claim about
  // the screen, not a habit worth keeping. The notes below stay, because the
  // walk cap and unreadable lines are real and can still fire.
  //
  // What takes its place is the OTHER kind of disclosure this screen already
  // practises — the staleness line on the list is drawn when the list is
  // CURRENT as well as when it is behind, because "a screen that only speaks
  // up when something is wrong leaves a reader unable to tell a fresh list
  // from a check that has stopped running". A document that quietly follows
  // its file has exactly that problem, so it says that it is following, and
  // at what cadence.
  const follows = el('p', 'tvnote tvfollows');
  // **THE CADENCE IS SPELLED, NOT SUBSTITUTED, and that is a change from
  // `seq:19`.** The sentence used to carry a `{secs}` slot filled from
  // `TIP_MS`, which was drift-proof and ungrammatical the moment the interval
  // reached one: "every 1 seconds" in English and "כל 1 שניות" in Hebrew, and
  // this table has refused count-plural constructions twice already for want of
  // a plural rule (`rail.cntSome`, `doctor` — see `en.js`). So the number is
  // written into the sentence in both languages, and what holds it to `TIP_MS`
  // is `test/ui/conversation-follow-cadence.test.ts` rather than memory.
  // A copy says what it does INSTEAD of following, rather than saying nothing.
  // The list's own rule, quoted where it was written: "a screen that only
  // speaks up when something is wrong leaves a reader unable to tell a fresh
  // list from a check that has stopped running". A document with no follow
  // note at all is exactly that — indistinguishable from a follow that broke.
  follows.append(...ctx.t(isCopy ? 'conv.doc.static' : 'conv.doc.follows'));
  host.append(follows);

  if (outline.truncated === true) {
    const cut = el('p', 'tvnote tvwarn');
    cut.append(...ctx.t('conv.doc.truncated', { bytes: outline.walkedBytes }));
    host.append(cut);
  }
  if (outline.unreadable > 0) {
    const bad = el('p', 'tvnote tvwarn');
    bad.append(...ctx.t('conv.doc.unreadable', { n: outline.unreadable }));
    host.append(bad);
  }

  // **WHAT THIS PAGE CANNOT OPEN, SAID ON THE PAGE** —
  // `INV-nothing-is-dropped-silently`, and the same shape `doc.js` gives
  // `gh.noroster`: a roster that failed to read must not be treated as a
  // session that dispatched nothing, because the two look identical from the
  // reader's side and only one of them is true.
  //
  // The unlinked count is the second half. A lane whose sidecar carried no
  // `toolUseId` has a transcript worth reading and NO turn to hang it on, so
  // the absence of a link on every turn is a fact about the recording rather
  // than about this screen — and a reader who is told the number can go
  // looking. Measured in this workspace: 0 of 253. A measured zero draws
  // nothing here because the roster is answered per session and "0 unlinked"
  // on every session would be noise; what is drawn is the non-zero case,
  // which is the one nobody could otherwise see.
  if (lanes.read === false) {
    const noroster = el('p', 'tvnote tvwarn');
    noroster.append(...ctx.t('conv.doc.lanesUnread'));
    host.append(noroster);
  } else if (lanes.unlinked > 0) {
    const unlinked = el('p', 'tvnote tvwarn');
    unlinked.append(...ctx.t('conv.doc.lanesUnlinked', {
      n: lanes.unlinked, total: lanes.total,
    }));
    host.append(unlinked);
  }

  /* ── state ─────────────────────────────────────────────────────────────── */
  /** Node indices currently shown, in document order. Narrowed by the filter. */
  let view = nodes.map((_, i) => i);
  let scroller = new Scroller(view.map((i) => estimateHeight(nodes[i])));
  /** True heights, once a row has been drawn and measured. Keyed by NODE index. */
  const known = new Map();
  /** Bodies that have arrived, keyed by node index. */
  const bodies = new Map();
  /** Node indices a fetch is already in flight for. */
  const inflight = new Set();
  /**
   * **WHERE THE READER'S WORDS ARE IN THE WHOLE TRANSCRIPT** — `semantic/8`.
   *
   * Node index to the number of times the server found the query in that
   * turn's own words. Filled from `GET /api/conversations/:id/find`, which
   * scans EVERY prose span of this transcript rather than the rows that
   * happen to be drawn — the distinction the whole feature rests on, because
   * `bodies` is a windowed and deliberately non-monotonic cache and a find
   * that walked it would report a count meaning *"in what I have"*.
   */
  const foundAt = new Map();
  /** The find answer as served, or `null` when nothing has been asked yet. */
  let findBody = null;
  /**
   * Turns the server found that this document cannot reach.
   *
   * Real, and only on one kind of document: one whose walk stopped at
   * `DOCUMENT_WALK_CAP`, where the transcript runs on past the last node
   * drawn. The index has those turns and the outline does not, so they are
   * counted and SAID rather than quietly missing from a total.
   */
  let findUnreached = 0;
  /**
   * Which find request is the current one.
   *
   * A scan of the largest transcript here costs about 160 ms, and a reader
   * types faster than that. Without this, a slow answer to `byt` arrives
   * after a fast answer to `byte offset` and overwrites it — the count and
   * the highlights would then describe a query nobody has on screen.
   */
  let findGen = 0;
  /**
   * **THE READER HAS NOT VISITED THE MATCH THEY ARE STANDING ON.**
   *
   * Found by driving it. `applyFilter` puts the reader at `scrollTop = 0`,
   * which is the FIRST match — so the mark walk's rule, *"the next stop after
   * the one under the viewport"*, made the first press of Next announce
   * "Match 2 of 12" and left match 1 reachable only by pressing Previous.
   * That is correct for a mark, which the reader placed and can see, and
   * wrong for a match they have only just asked for.
   *
   * So the FIRST step after a query settles is allowed to land on the match at
   * the viewport rather than past it, and exactly once: `endWalk` clears this,
   * and `endWalk` is what `wheel`, `keydown` and `pointerdown` on the well
   * already call. A reader who has scrolled is back under the mark walk's
   * rule, which is the rule that does not stall.
   */
  let findFresh = false;
  /** Rows in the DOM right now, keyed by node index. */
  const live = new Map();
  /**
   * Rows in `live` that are still the "Reading…" placeholder.
   *
   * **Without this the document never fills in.** Rows are kept and MOVED
   * rather than rebuilt, so that a `<details>` a reader opened survives a
   * two-pixel scroll — and that same rule, applied to a placeholder, pins it
   * there for ever: the body arrives, `paint` finds the node already in
   * `live`, and leaves the placeholder where it is. Every row read "Reading…"
   * and the endpoint was answering 200 the whole time. This set is the one
   * exception to "a live row is never rebuilt", and it is the narrowest one:
   * a placeholder has no reader state to lose.
   */
  const waiting = new Set();
  let frame = 0;
  /**
   * Until when a paint must land the reader at the very end — see the follow
   * block at the foot of this function.
   *
   * **A DEADLINE, and the first draft's counter is why.** That counter was
   * "the next two paints", and the two paints it bought were spent before the
   * new rows existed: `refill` sets this, `paint` asks the server for the
   * bodies it is missing, and the measurement pass that follows the CURRENT
   * rows runs another paint immediately — so both were gone by the time the
   * bodies arrived and the reader was left a screenful above the turn they
   * were following. Caught in the browser, on `at the end of the file, a new
   * turn arrives on its own`, which read the text into the DOM and then found
   * it out of the viewport.
   *
   * Bounded by the clock rather than by a flag, because a flag would pin the
   * reader to the bottom for ever — the wrong `seq:19` names in the other
   * direction — and released early the moment they take the scroll back.
   *
   * ── WHO MAY SET IT, AND IT IS A SHORT LIST ON PURPOSE ─────────────────
   *
   * **Every setter is the reader consenting to be at the end**, and nothing
   * else may join them. There are three:
   *   - `refill`'s `if (following)` branch — they WERE at the end when the
   *     turn arrived, measured by `atTail()` BEFORE the append and never
   *     after it. A reader one row short of the end is not at the end.
   *   - the `toNew` click — they asked to go down, in as many words.
   *   - `redraw('end')`, the mount landing
   *     (`TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`).
   *     The owner ruled the END is where a session opens, so at mount the
   *     reader's position IS the end and holding it there is holding their
   *     position, not moving them off it.
   *
   * **AND `onLook` IS DELIBERATELY NOT ONE OF THEM.** Coming back to the tab
   * is a request for FRESH, not a request for the bottom: a reader who left
   * the tab while reading half way up comes back to the same place, with a
   * count of what arrived below. `seq:19`'s ruling — *"if the user is looking
   * at a point upper than the end of the session, do not scroll it down
   * automatically"* — does not weaken because the tick that noticed the append
   * was fired by a look instead of by a timer.
   */
  let stickUntil = 0;
  const STICK_MS = 3_000;
  /**
   * The rows the reader's SELECTION BEGINS AND ENDS IN, which `paint` will not
   * evict. **At most two.**
   *
   * **This is the second half of making a passage markable at all, and it was
   * found by dragging** — `TASK-a-selected-passage-copies-as-something-a-
   * terminal-will`. A drag that reaches the bottom edge of the well
   * auto-scrolls it; `paint` then removes the rows that left the window, and
   * removing a node a selection BOUNDARY sits in moves that boundary up to the
   * container. The selection is not destroyed — it is QUIETLY NARROWED, which
   * is the worst of the outcomes available: the reader watches their highlight
   * cover forty turns and the clipboard gets the last dozen.
   *
   * A row is `position:absolute` with its top written from the model, so
   * keeping one that has scrolled out costs a node and nothing else — it is
   * still exactly where the model says it is, and it is off screen.
   *
   * **ONLY THE TWO ENDS, and the difference is not a micro-optimisation.**
   * The first draft pinned every marked row, which is up to `PASSAGE_NODE_CAP`
   * of them, and `measure` walks `live` calling `getBoundingClientRect` on
   * every entry — so a 400-section passage would have cost four hundred forced
   * layouts per scroll frame, on the surface whose whole design is "every
   * scroll after the first costs 2 ms". It is also unnecessary: removing a node
   * from the MIDDLE of a range does not move either boundary, and the middle of
   * a passage is filled from the RECORD rather than from the DOM. So the ends
   * are held and the middle is allowed to go.
   */
  const held = new Set();

  const heightOf = (nodeIndex) => known.get(nodeIndex) ?? estimateHeight(nodes[nodeIndex]);

  /**
   * The node indices a selection's two boundary points sit in — what `held`
   * keeps. Empty when neither end is inside the well.
   *
   * `rowOf` is declared with the rest of the copy machinery further down; this
   * is only ever called from a listener, so the binding exists by then.
   */
  const boundaryRows = () => {
    const selection = document.getSelection();
    if (selection === null || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const out = [];
    for (const end of [range.startContainer, range.endContainer]) {
      const row = rowOf(end);
      if (row === null) continue;
      const nodeIndex = Number(row.dataset.n);
      if (Number.isInteger(nodeIndex)) out.push(nodeIndex);
    }
    return out;
  };

  /** First position in `view` holding a node index at or after `n`. */
  const viewFrom = (n) => {
    let lo = 0;
    let hi = view.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (view[mid] < n) lo = mid + 1; else hi = mid;
    }
    return lo;
  };

  const rebuild = () => {
    scroller = new Scroller(view.map(heightOf));
  };

  /**
   * Ask the server for a page of bodies starting at `nodeIndex`.
   *
   * **A window that will not load SAYS SO.** The first draft swallowed the
   * failure and left the rows reading "Reading…" for ever, which is the exact
   * shape `INV-nothing-is-dropped-silently` exists to forbid: a screen that
   * looks like it is still working when it has stopped. It cost an hour of
   * this build to find, because the endpoint was answering `200` the whole
   * time and the fault was in the drawing.
   *
   * So a refusal is drawn, once, above the scroll — and the rows it could not
   * fill stay in place rather than vanishing, because their positions are
   * still true.
   */
  const fetchFrom = async (nodeIndex) => {
    if (inflight.has(nodeIndex)) return;
    inflight.add(nodeIndex);
    const node = nodes[nodeIndex];
    try {
      const got = await ctx.api(
        `/api/conversations/${encodeURIComponent(outline.sessionId)}/nodes`
        + `?at=${node.o}&from=${node.f}&node=${node.n}&count=${FETCH_PAGE}`);
      for (const body of got.nodes ?? []) bodies.set(body.n, body);
      inflight.delete(nodeIndex);
      paint();
      return;
    } catch (error) {
      inflight.delete(nodeIndex);
      failed.replaceChildren(errorNote(error.message));
      failed.hidden = false;
    }
  };

  /**
   * **CREATION PATH 3: BY HAND WHILE READING, AT THE POINT HE IS LOOKING AT**
   * — owner ruling 2026-09-12,
   * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`.
   *
   * His own words: *"user could add anchores while he browses the conversation
   * using the ui viewer"*, and the ruling that decides what counts: *"you
   * shouldn't limit me because you decided to use the CLI."* Until this,
   * marking a point was reachable only from a SEARCH HIT — so a reader who had
   * found the turn by reading had to go and search for it first.
   *
   * **The byte comes from the outline node and nothing derives it here.**
   * `DocOutlineNode.o` is "byte offset of the first record's line — the seek
   * target", which is the same number `anchorIdFor` hashes and the same one
   * `resolveAnchor` seeks to. A control that counted characters would mark a
   * point inside a record rather than at the start of one, which reads as
   * unreadable instead of throwing — the failure this archive's Hebrew makes
   * certain.
   *
   * **The session is `outline.ownerSessionId` and the lane is the document's
   * own id when it is a lane.** A lane's anchor is filed under the session that
   * owns it; `subagentAsRow` carries why the outline now says which.
   */
  const anchorSessionId = outline.ownerSessionId ?? outline.sessionId;
  const anchorAgentId = outline.source === 'subagent' ? outline.sessionId : null;

  /**
   * **Every anchor in THIS document, by byte offset — a LIST per byte.**
   * Refilled on every change.
   *
   * It held ONE anchor per byte until 2026-09-16, because the store could not
   * hold two: `anchorIdFor` derives the id from the position. It is a list now
   * because `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`
   * made a turn able to carry two marks — a table AND the lane report it is —
   * and a `Map#set` per byte would have silently kept whichever arrived last,
   * which is the drawing half of exactly the precedence the owner rejected.
   */
  const anchorsHere = new Map();

  /** Every anchor in this document, marks not positions, in no particular order. */
  const everyAnchorHere = () => [...anchorsHere.values()].flat();

  const loadAnchors = async () => {
    let body;
    try {
      body = await ctx.api(
        `/api/conversations/anchors?session=${encodeURIComponent(anchorSessionId)}`);
    } catch {
      // A document whose anchors could not be read still draws. The control
      // says "mark this point" and a mark that turns out to exist already is
      // the SAME ROW — `anchorIdFor` derives the id from the position — so the
      // worst a failed read costs is a button offering something already done.
      return;
    }
    anchorsHere.clear();
    for (const anchor of body.anchors ?? []) {
      if ((anchor.agentId ?? null) !== anchorAgentId) continue;
      // **APPENDED AND NOT SET**, which is the whole of the two-mark change on
      // this side: a turn that is both a table and a lane report answers with
      // two rows at one byte, and the second `set` would have thrown the first
      // away without anything on the screen saying so.
      const held = anchorsHere.get(anchor.byteOffset);
      if (held === undefined) anchorsHere.set(anchor.byteOffset, [anchor]);
      else held.push(anchor);
    }
    // **THE STEPPER'S COUNT IS DERIVED FROM THIS MAP AND FROM NOTHING ELSE**,
    // so it is put back in step HERE rather than at the four call sites that
    // write an anchor. A mark made while reading that left "3 marked points"
    // standing beside four of them is the same two-statements-one-false defect
    // `refreshMarks` exists to stop one control along.
    navRefresh();
  };

  /**
   * **PUT EVERY DRAWN ROW'S CONTROL BACK IN STEP WITH THE ANCHORS FILE.**
   *
   * `paint` deliberately does NOT rebuild a row it has already drawn — a
   * rebuilt row is a `<details>` a reader opened being shut, which is the one
   * thing the scroll moves rows to avoid. So the anchors arriving after the
   * first paint would leave a marked turn offering to mark itself, which is
   * two statements about one point with one of them false. This replaces the
   * BAR and nothing else, so nothing a reader opened is disturbed.
   *
   * It was found in the browser, not in review: the first eleven assertions of
   * `e2e/anchors.spec.ts` passed and the twelfth — a turn the automatic pass
   * had already marked — showed the unmarked control, because the rows were on
   * screen before the fetch came back.
   */
  const refreshMarks = () => {
    for (const [nodeIndex, row] of live) {
      const bar = row.querySelector('.tvanchorbar');
      if (bar !== null) bar.replaceWith(markControl(nodeIndex));
    }
    schedule();
  };

  /**
   * The mark control for one node — three states, never two.
   *
   * NOT MARKED: a button that opens one field. MARKED: the label, with rename
   * and take-back beside it. The third is the one a two-state control loses —
   * a write that REFUSED — and it is drawn in place rather than swallowed.
   *
   * **`after` IS WHAT THE WRITE THAT CAUSED THIS REDRAW LEFT TO SAY**, and it
   * exists because the redraw is the thing that destroys it. A write here ends
   * in `redrawMe`, which replaces the whole bar: the sentence in `said` and the
   * caret on the button both went out with the old element, so the caret fell
   * to `document.body` — measured at **29 tab stops** back to this row — and
   * nothing was announced at all. Three fields, each optional:
   *
   *   `say`    a keyed sentence to put in the rebuilt live region
   *   `taken`  the row a take-back removed, which draws the sentence AND the
   *            way back when it is a point he marked himself
   *   `focus`  selectors tried in order against the rebuilt bar
   */
  const markControl = (nodeIndex, after = null) => {
    const node = nodes[nodeIndex];
    const bar = el('div', 'tvanchorbar');
    const said = el('p', 'small tvanchorsaid');
    said.setAttribute('aria-live', 'polite');
    said.hidden = true;

    const redrawMe = (next = null) => {
      const row = live.get(nodeIndex);
      if (row === undefined) return;
      const old = row.querySelector('.tvanchorbar');
      if (old === null) return;
      const built = markControl(nodeIndex, next);
      old.replaceWith(built);
      schedule();
      // **THE CARET IS PLACED AFTER THE BAR IS IN THE DOCUMENT**, never inside
      // `markControl`: an element that is not in the tree cannot take focus.
      if (next === null || next.focus === undefined) return;
      for (const selector of next.focus) {
        const target = built.querySelector(selector);
        if (target !== null) { target.focus(); return; }
      }
    };

    /**
     * Put the previous write's sentence back into the region this redraw just
     * rebuilt, and draw the way back when the row that went was his own.
     */
    const carry = () => {
      if (after === null) return;
      if (after.taken !== undefined) {
        sayTakenBack(ctx, said, after.taken, 'tvjump tvanchorputback', async (button) => {
          await putBackAnchor(ctx, said, after.taken, button, async () => {
            await loadAnchors();
            redrawMe({ focus: ['.tvanchorrename'], say: 'conv.anchors.putBackDone' });
          });
        });
        return;
      }
      if (after.say !== undefined) {
        said.hidden = false;
        said.replaceChildren(...ctx.t(after.say));
      }
    };

    /**
     * **ONE MARK OF THIS TURN, AND A TURN MAY NOW HAVE TWO** —
     * `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing`, owner
     * ruling 2026-09-16: *"table & report - if required make them 2 different
     * anchor types with 2 distinguished marks"*.
     *
     * Every line of the body below stood inline in `markControl` and drew THE
     * mark; it is a function now and draws A mark, called once per row standing
     * at this byte. Nothing inside it changed, which is deliberate: a second
     * drawing of a bookmark is a second place for the kind, the note, the
     * rename and the take-back to drift apart.
     *
     * ── HOW THE TWO ARE TOLD APART, AND WHY NOT BY COLOUR ────────────────
     *
     * `table` and `report` are both in the `kindfound` hue group — material the
     * conversation produced — and they stay there. `DEC-the-meaning-hue-budget-
     * is-five` forbids a sixth hue, and the amendment of 2026-08-27 already
     * settles which carrier names a kind: *"a hue may narrow a group, never
     * name one"*. So the hue says POSTURE and the GLYPH and the WORD say which
     * kind — `▦ a table` against `📄 a report`, one under the other, each with
     * its own label, its own Rename and its own Take it back. That is the
     * distinction the ruling asks for, drawn with what the screen already has.
     *
     * ── AND THE FLAG IS DRAWN ONCE ───────────────────────────────────────
     *
     * `first` is what decides it. `⚑ Marked` is a claim about the TURN — *there
     * is a bookmark here* — and a turn with two bookmarks is not marked twice
     * over. Repeating the chip is what would make two marks read as a bug,
     * which is the one thing the item says they must not do.
     */
    const drawMark = (standing, first) => {
      const one = el('div', 'tvanchorone');
      const chip = el('span', 'chip ok glyphed tvanchored');
      chip.dataset.g = '⚑';
      chip.append(...ctx.t('conv.doc.marked'));
      const label = el('span', 'tvanchorlabel');
      label.setAttribute('dir', 'auto');
      label.textContent = standing.label;
      /*
       * **THE KIND AND THE NOTE, ON THE ROW THEY BELONG TO** —
       * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your`.
       * A mark that can now BE a decision, a defect or a question must say
       * which on the turn it sits on, or the vocabulary is one the reader can
       * only see by opening the form that wrote it. The glyph is the whole
       * point of a closed set in a dense surface, and a kind this build has no
       * word for is drawn as itself — `anchorRow`'s own rule, one card over.
       */
      /*
       * **THE SAME THREE GROUPS, IN THE DOCUMENT** —
       * `TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds`. The
       * item's defect is `.convanchorkind` AND `.tvanchorkind`, both
       * `color:var(--dim)`, "on the row and in the document alike", so the fix
       * is on both or it is on neither.
       *
       * **Set at construction and never rewritten**, which is the opposite of
       * `showKind`'s rule one card over and is correct for the opposite reason:
       * this bar is rebuilt wholesale by `redrawMe` after every write, so there
       * is no second paint for a stale class to survive into. What the two
       * share is the helper, so the grouping is decided in exactly one place.
       *
       * No rail here. `.convanchor` has a 2px inline-start border to recolour;
       * this is an inline run inside `.tvanchorbar`, beside a `⚑ marked` chip
       * that owns the row's left edge already — and a second coloured edge
       * against it would be two rails disagreeing about what the row is.
       */
      const kind = el('span', `tvanchorkind${kindHueClass(standing.kind)}`);
      if (ANCHOR_KIND_KEYS.has(standing.kind)) {
        kind.append(glyphed(ANCHOR_KIND_GLYPH[standing.kind],
          ctx.t(`conv.anchors.kind.${standing.kind}`)));
      } else {
        kind.textContent = standing.kind;
      }
      const detail = el('span', 'small tvanchornote');
      detail.setAttribute('dir', 'auto');
      detail.textContent = standing.note ?? '';
      detail.hidden = (standing.note ?? '') === '';
      const rename = el('button', 'tvjump tvanchorrename');
      rename.type = 'button';
      rename.append(...ctx.t('conv.anchors.relabel'));
      // The row's write control says its key, on both of the two faces it
      // wears — `TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so`.
      // One binding, because the reader means "do what this turn offers".
      shortcutOn(ctx, rename, 'write');
      // **The same `labelWrite` the archive list and the search hit use**, in
      // its `'aria'` shape: a visible `<label>` would cost a line on every
      // marked turn of a scrolling document, and the name is still there.
      const renamer = labelWrite(ctx, {
        value: standing.label,
        named: 'aria',
        labelKey: 'conv.anchors.relabelLabel',
        saveKey: 'conv.anchors.relabelSave',
        emptyKey: 'conv.anchors.relabelNeedsLabel',
        busyKey: 'conv.anchors.saving',
        boxClass: 'tvanchorbox',
        inputClass: 'tvanchorinput',
        saveClass: 'tvjump tvanchorsave',
        cancelClass: 'tvjump tvanchorcancel',
        said,
        kinds: true,
        kindValue: standing.kind,
        kindClass: 'tvanchorkindpick',
        details: true,
        detailValue: standing.note ?? '',
        detailClass: 'tvanchornoteinput',
        endpoint: '/api/conversations/anchors/relabel',
        body: (label, more) => ({ id: standing.id, label, ...more }),
        done: async (answer) => {
          await loadAnchors();
          redrawMe({
            focus: ['.tvanchorrename'],
            say: answer.tookOwnership === true
              ? 'conv.anchors.tookOwnership' : 'conv.anchors.relabelled',
          });
        },
      });
      const drop = dropWrite(ctx, {
        anchor: standing,
        said,
        dropClass: 'tvjump tvanchordrop',
        done: async (taken) => {
          await loadAnchors();
          // The bar that comes back is the UNMARKED one, so the way back is
          // the first thing on it when there is one and the offer to mark the
          // point again is the fallback.
          redrawMe({ focus: ['.tvanchorputback', '.tvanchormark'], taken });
        },
      });
      // A box that opens changes the row's height, so the well re-measures —
      // and one that a cancel SHUTS changes it back, which is why `schedule`
      // is called on both edges rather than only on the way in.
      const { box, input } = renamer;
      boxToggle(rename, box, input, () => { schedule(); }, renamer);
      /**
       * **THE CONTROLS GET THEIR OWN LINE, SO THEY HAVE A CONSTANT PLACE.**
       *
       * Owner, 2026-09-16, after the labels grew: "because now the text is
       * long it makes the buttons (rename, take it back) to move and not
       * apear in a constant place". Every child used to be a sibling in one
       * wrapping flex row, so Rename sat wherever the label happened to end
       * — and the labels got much longer the same week, first when a table
       * mark became its header cells plus the heading above it, then when a
       * lane report took its mission as its name.
       *
       * `flex-basis: 100%` on the group is the whole mechanism, and it is
       * `.tvanchorbox`’s own idiom one control along — the write box already
       * claims a full line for exactly this reason. The head (flag, kind,
       * label, note) still wraps as it likes; the controls start a new line
       * whatever it does.
       *
       * The ORDER of the children is unchanged, so the tab order a reader
       * walks and every `focus` selector `redrawMe` is handed still resolve
       * to the same controls in the same sequence.
       */
      const acts = el('div', 'tvanchoracts');
      acts.append(rename, drop);
      if (first) one.append(chip);
      one.append(kind, label, detail, acts, box);
      return one;
    };

    /**
     * **THE MARKS AT THIS BYTE, IN THE ORDER THE STORE HOLDS THEM.**
     *
     * `anchorRows` orders by `at DESC, id ASC`, and two marks written by one
     * pass at one point share a stamp — so the tie breaks on the id, and the
     * id of the mark that OWNS the point sorts before the one suffixed with its
     * kind (`anchorIdBeside`). The table therefore draws above the report, the
     * same way round the grammar found them, on every row and every reload.
     *
     * `said` is the BAR's and not a mark's: it is one live region for one row,
     * and a take-back announces which mark went by naming it.
     */
    const standing = anchorsHere.get(node.o) ?? [];
    if (standing.length > 0) {
      standing.forEach((anchor, at) => { bar.append(drawMark(anchor, at === 0)); });
      bar.append(said);
      carry();
      return bar;
    }

    const mark = el('button', 'tvjump tvanchormark');
    mark.type = 'button';
    mark.append(...ctx.t('conv.doc.mark'));
    shortcutOn(ctx, mark, 'write');
    const marker = labelWrite(ctx, {
      named: 'aria',
      labelKey: 'conv.doc.markLabel',
      saveKey: 'conv.doc.markSave',
      emptyKey: 'conv.doc.markNeedsLabel',
      busyKey: 'conv.arch.marking',
      boxClass: 'tvanchorbox',
      inputClass: 'tvanchorinput',
      saveClass: 'tvjump tvanchorsave',
      cancelClass: 'tvjump tvanchorcancel',
      said,
      kinds: true,
      kindClass: 'tvanchorkindpick',
      details: true,
      detailClass: 'tvanchornoteinput',
      endpoint: '/api/conversations/anchors/mark',
      body: (label, more) => ({
        sessionId: anchorSessionId,
        agentId: anchorAgentId,
        byteOffset: node.o,
        label,
        ...more,
      }),
      done: async () => {
        await loadAnchors();
        redrawMe({ focus: ['.tvanchorrename'], say: 'conv.anchors.marked' });
      },
    });
    const { box, input } = marker;
    boxToggle(mark, box, input, () => { schedule(); }, marker);
    bar.append(mark, box, said);
    carry();
    return bar;
  };

  const buildRow = (nodeIndex) => {
    const body = bodies.get(nodeIndex);
    if (body === undefined) {
      waiting.add(nodeIndex);
      return drawWaiting(ctx, nodes[nodeIndex], heightOf(nodeIndex));
    }
    waiting.delete(nodeIndex);
    const row = body.kind === 'said' ? drawTurn(ctx, body, lanes)
      // A command, or a question put to him — drawn open. `plan:archive seq:16`.
      : body.kind === 'deed' ? drawDeed(ctx, body, lanes)
        : drawWork(ctx, body, lanes);
    // **THE CONTROL IS ON EVERY KIND OF ROW, not only on a turn somebody
    // spoke.** A folded run of machinery is exactly the sort of place a reader
    // wants a bookmark — it is where the work is — and a control that appeared
    // on two of the three kinds would be a rule nobody could state.
    row.append(markControl(nodeIndex));
    return row;
  };

  /**
   * Every visible run of text in one drawn row, JOINED, with a way back from
   * an offset in the join to the text node it came from.
   *
   * **The join is the point.** `markdownNodes` splits *"the **byte** offset"*
   * into three text nodes, and a matcher run per node would find neither of
   * the two phrases a reader can plainly see. A separator goes in wherever
   * the nearest `FIND_BLOCKS` ancestor changes, so a match still cannot run
   * from the end of one paragraph into the start of the next.
   */
  const rowText = (row) => {
    const parts = [];
    let whole = '';
    let block = null;
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.data === '') continue;
      let owner = node.parentNode;
      while (owner !== null && owner !== row && !FIND_BLOCKS.has(owner.nodeName)) {
        owner = owner.parentNode;
      }
      if (block !== null && owner !== block) whole += '\n';
      block = owner;
      parts.push({ node, at: whole.length });
      whole += node.data;
    }
    return { parts, whole };
  };

  /**
   * **PAINT EVERY MATCH IN EVERY ROW THAT IS DRAWN, AND OWN NOTHING.**
   *
   * The owner's second requirement in his own words: *"every found search
   * result in my viewer should be highlited"*.
   *
   * ── WHY IT IS REBUILT WHOLE ON EVERY PAINT ──────────────────────────────
   *
   * A `Range` holds live node references, and this scroll RECYCLES rows: a
   * row scrolled out of the window is removed from the DOM and a row scrolled
   * back in is BUILT AGAIN (`paint`, and `live` is the register of which are
   * real right now). A highlight registry kept across that would hold ranges
   * into detached nodes — which paint nothing, silently, for ever. Rebuilding
   * from `live` costs one walk of about twenty rows and cannot go stale,
   * which is the same bargain `place()` makes for row positions two functions
   * up. **Driven in the browser rather than assumed**: a match was scrolled
   * out of the window and back, and it is coloured again on arrival.
   *
   * ── AND IT IS THE SAME MATCHER THE SERVER COUNTED WITH ─────────────────
   *
   * `foldedMatches` from `lib/fold.js`, imported here and loaded by
   * `core/conversation-search.ts` over there. What it paints is the RENDERED
   * text and what the server counted is the RECORD's text, and those are not
   * the same string — Markdown syntax is in one and not the other. That is
   * why the count beside the box counts TURNS and never occurrences: a number
   * of occurrences would be a promise about painted ranges that the rendering
   * is free to break.
   */
  const paintFinds = () => {
    if (!CAN_HIGHLIGHT) return;
    const needle = find.value.trim();
    if (needle === '') { CSS.highlights.delete(FIND_HIGHLIGHT); return; }
    const ranges = [];
    for (const [, row] of live) {
      const { parts, whole } = rowText(row);
      if (parts.length === 0) continue;
      const place = (offset) => {
        let lo = 0;
        let hi = parts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (parts[mid].at <= offset) lo = mid; else hi = mid - 1;
        }
        return parts[lo];
      };
      for (const hit of foldedMatches(whole, needle, FIND_PAINT_PER_ROW)) {
        const from = place(hit.from);
        const to = place(hit.to);
        const range = document.createRange();
        // A separator this function inserted is not in any text node, so an
        // offset can land one past the end of the part it belongs to. Clamped
        // rather than thrown: `setStart` raises on an out-of-range offset and
        // a throw inside `paint` leaves the well blank.
        range.setStart(from.node, Math.min(hit.from - from.at, from.node.data.length));
        range.setEnd(to.node, Math.min(hit.to - to.at, to.node.data.length));
        ranges.push(range);
      }
    }
    CSS.highlights.set(FIND_HIGHLIGHT, new Highlight(...ranges));
  };

  /**
   * Draw the window the reader is looking at, correct the model from what was
   * drawn, and go round again if the model moved.
   *
   * Three steps, in this order, and the order is the design:
   *
   *   1. **Choose the window** from where the scroll is — a binary search, so
   *      it costs thirteen comparisons over 4,978 nodes rather than 4,978.
   *   2. **Place it.** Every row's top is WRITTEN from the model, so nothing
   *      has a second opinion about where a row is; the container's height is
   *      the model's own total, so the scrollbar describes the whole session.
   *   3. **Correct the model** from the heights the rows actually took, hold
   *      the reader's anchor node still, and schedule one more pass so the
   *      window is re-chosen against a model that is now true.
   *
   * Step 3 terminates: a height only ever goes from estimate to measured and
   * never back, so each pass leaves strictly fewer unmeasured rows on screen.
   */
  function paint() {
    if (view.length === 0) {
      for (const [, node] of live) node.remove();
      live.clear();
      waiting.clear();
      inner.style.blockSize = '0px';
      return;
    }
    const top = scroll.scrollTop;
    const window = scroll.clientHeight || 600;
    /**
     * THE ANCHOR: the node the viewport starts inside, and how far into it.
     *
     * A scroll position is a PIXEL, and every pixel in this document is a
     * guess until the row it lands in has been drawn and measured. So the
     * moment a measurement lands, that pixel means something different, and a
     * pass that kept the pixel would be looking at different content than the
     * pass before it. Anchoring on the NODE is what keeps "where the reader
     * is" meaningful across a re-sum.
     */
    const anchor = scroller.at(top);
    const anchorDelta = top - scroller.top(anchor);
    const first = Math.max(0, anchor - OVERSCAN);
    const last = Math.min(view.length - 1, scroller.at(top + window) + OVERSCAN);

    const wanted = [];
    for (let i = first; i <= last; i += 1) wanted.push(i);
    const want = new Set(wanted.map((i) => view[i]));

    for (const [nodeIndex, node] of [...live]) {
      // Out of the window, or a placeholder whose body has since arrived.
      const gone = !want.has(nodeIndex);
      if (!gone && !(waiting.has(nodeIndex) && bodies.has(nodeIndex))) continue;
      // A row the reader has MARKED is not evicted for scrolling past it —
      // see `held`. The placeholder swap is still allowed to happen even on a
      // held row: a row still reading "Reading…" has no text worth keeping a
      // selection in, and leaving it would pin the placeholder for ever.
      if (gone && held.has(nodeIndex)) continue;
      node.remove();
      live.delete(nodeIndex);
      waiting.delete(nodeIndex);
    }
    // Build what is missing and PLACE everything. A row already in the DOM is
    // moved, never rebuilt — a `<details>` a reader opened must survive a
    // two-pixel scroll, and rebuilding would shut every one of them.
    //
    // **A NEW ROW IS INSERTED IN DOCUMENT ORDER, NOT APPENDED** —
    // `TASK-a-selected-passage-copies-as-something-a-terminal-will`. Every row
    // is `position:absolute` with its top written from the model, so where it
    // sits in the DOM has no effect on where it is DRAWN, and `inner.append`
    // was therefore free. It is not free for a SELECTION: a browser range runs
    // in DOM order, so a reader scrolling UP — which appends the rows above
    // the viewport AFTER the rows below it — could drag across three visible
    // rows and get a range that, read in DOM order, ran the other way and
    // swept in rows that are elsewhere on the screen. Inserting after the
    // previous row of the window keeps the two orders equal for ever.
    //
    // **And it never moves a row that is already in the DOM**, which matters
    // twice: moving one would shut nothing (`open` is an attribute) but it
    // WOULD destroy the reader's selection, on every scroll, which is the one
    // thing this feature cannot survive. Only rows built on this pass are
    // placed, and a row only ever leaves the DOM by being removed above.
    //
    // The FIRST row of a window has no previous row to follow, so its place is
    // found among whatever else is in the container — which, with `held`, can
    // be a marked passage a long way up or down the document. `inner.prepend`
    // would put a window at record 12,000 in front of a passage marked at
    // record 40.
    const placeFirst = (row, nodeIndex) => {
      let next = null;
      for (const [otherIndex, other] of live) {
        if (otherIndex <= nodeIndex) continue;
        if (next === null || otherIndex < next.index) next = { index: otherIndex, node: other };
      }
      if (next === null) inner.append(row); else next.node.before(row);
    };
    let previous = null;
    for (const i of wanted) {
      const nodeIndex = view[i];
      let row = live.get(nodeIndex);
      if (row === undefined) {
        row = buildRow(nodeIndex);
        row.classList.add('tvrow');
        if (previous === null) placeFirst(row, nodeIndex); else previous.after(row);
        live.set(nodeIndex, row);
      }
      previous = row;
    }

    /**
     * Every row's top, written from the model — including the held ones.
     *
     * A held row is outside the window, so nothing in the loop above touches
     * it; but a measurement moves every row BELOW the one that changed, and a
     * marked passage left at a stale pixel would be in the wrong place the
     * moment the reader scrolled back to it. `viewFrom` is how a node index
     * becomes a view row when it is not in the window's own list.
     *
     * The value is COMPUTED, never static: `check-cssom-restatement.ts`
     * refuses an inline write that restates what the stylesheet says, and this
     * number exists only at runtime.
     */
    const place = () => {
      for (const i of wanted) {
        const row = live.get(view[i]);
        if (row !== undefined) row.style.insetBlockStart = `${Math.round(scroller.top(i))}px`;
      }
      for (const nodeIndex of held) {
        if (want.has(nodeIndex)) continue;
        const row = live.get(nodeIndex);
        if (row !== undefined) {
          row.style.insetBlockStart = `${Math.round(scroller.top(viewFrom(nodeIndex)))}px`;
        }
      }
      inner.style.blockSize = `${Math.round(scroller.total)}px`;
    };
    place();

    // Ask for the first body this window is missing. One request covers
    // `FETCH_PAGE` consecutive nodes, so a scroll asks about once per screen.
    for (const i of wanted) {
      const nodeIndex = view[i];
      if (!bodies.has(nodeIndex) && !inflight.has(nodeIndex)) { void fetchFrom(nodeIndex); break; }
    }

    if (measure()) {
      rebuild();
      place();
      // Put the anchor node back under the reader's eye. `anchorDelta` was
      // measured against that row's ESTIMATED height, so it is clamped to the
      // height the row actually took — otherwise a 900px offset into a row the
      // estimate called 980px tall and the measurement calls 100px would land
      // the viewport 800px past the very row it is holding still. That was the
      // second half of the blank-well defect.
      const height = scroller.heights[anchor] ?? 0;
      scroll.scrollTop = scroller.top(anchor) + Math.min(anchorDelta, Math.max(0, height - 1));
      schedule();
    }

    // A reader who WAS at the end when new turns arrived stays at the end
    // while they draw. This runs after the anchor correction above, because
    // that correction holds the reader's OLD position still and the whole
    // point here is that their position is the end, which has just moved.
    if (stickUntil > Date.now()) scroll.scrollTop = scroller.total;

    // **LAST, BECAUSE THE ROWS ARE ONLY FINAL HERE.** A highlight is a
    // `Range` into a text node, and the block above can still have built,
    // moved or evicted rows. Painting earlier would range into nodes this
    // pass is about to remove.
    paintFinds();
  }

  /**
   * Write back what the rows actually measured. Returns whether anything moved.
   *
   * `getBoundingClientRect().height` and not `offsetHeight`: the first is
   * fractional, and rounding every row down accumulates into a scrollbar that
   * is visibly wrong over four thousand of them.
   *
   * It only WRITES the model; the caller decides what to do about it. That
   * split is load-bearing — a function that both measured and compensated
   * could not be asked "did the model change?", which is the question the
   * compensation depends on.
   */
  function measure() {
    let changed = false;
    for (const [nodeIndex, row] of live) {
      const height = row.getBoundingClientRect().height;
      if (height <= 0) continue;
      const was = known.get(nodeIndex);
      if (was === undefined || Math.abs(was - height) > 1) {
        known.set(nodeIndex, height);
        changed = true;
      }
    }
    return changed;
  }

  const schedule = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => { frame = 0; paint(); });
  };
  scroll.addEventListener('scroll', schedule, { passive: true });
  // A fold that opens changes its row's height by a lot. `toggle` bubbles from
  // `<details>`, so one listener on the container covers every fold in it and
  // no row needs a handler of its own.
  scroll.addEventListener('toggle', () => { schedule(); }, true);
  window.addEventListener('resize', schedule);

  // **`stickUntil = 0` IS WHAT KEEPS Top WORKING NOW THAT THE DOCUMENT OPENS
  // AT THE END** (`TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`).
  // The mount landing is held for `STICK_MS` the way `refill`'s is, and the
  // three inputs that release it — `wheel`, `keydown`, `pointerdown` — are
  // bound to the WELL. This button is in the bar above it, so pressing it
  // inside that window would set `scrollTop` to zero and the next `paint`
  // would put the reader straight back at the end. Top is the affordance a
  // reader needs MORE once the default moves, so it says so itself.
  // **AND BOTH END THE STEPPER'S WALK.** They are not in the well, so the
  // three reader-inputs bound there never see them — and a reader who pressed
  // Top after stepping to the seventh mark and then pressed Next would be
  // taken to the EIGHTH, which is the walk continuing from a place they have
  // just left. `cursor` carries the whole argument.
  toTop.addEventListener('click', () => {
    stickUntil = 0; scroll.scrollTop = 0; endWalk(); paint();
  });
  toEnd.addEventListener('click', () => {
    scroll.scrollTop = scroller.total; endWalk(); paint();
  });

  /**
   * **THE HOOK THE STEPPER'S COUNTERS HANG ON, and it is a `let` because of
   * the order this function is written in.**
   *
   * `reView` runs for the first time inside `redraw('end')`, which is called
   * some ninety lines above the stepper is wired — so a `const` defined down
   * there would be in its temporal dead zone at the moment the mount's first
   * view is derived, and the document would fail to open at all. A no-op that
   * is replaced once is the narrowest way to say "this runs on every change of
   * view, including the ones that happen before it exists".
   */
  let navRefresh = () => {};
  /** Ends the stepper's walk, so the next press reads the viewport again. */
  let endWalk = () => {};

  /**
   * Re-derive `view` from the nodes and the needle, and say what it holds.
   *
   * Split out of `applyFilter` because an APPEND has to do exactly this and
   * must NOT do the two things `applyFilter` does around it — throw away every
   * drawn row and send the reader back to the top. A new turn arriving is not
   * a new search.
   */
  const reView = () => {
    const needle = find.value.trim().toLowerCase();
    view = [];
    for (let i = 0; i < nodes.length; i += 1) {
      // A folded run is machinery; a reader filtering for a phrase wants the
      // TURNS. With an empty needle everything shows, which is the document.
      //
      // **`foundAt` is an OR and never a replacement** — `semantic/8`. The
      // outline predicate reads a turn's opening and the TOOLS it ran, and
      // `foundAt` reads the words of the turn itself; each finds rows the
      // other cannot. Narrowing to the server's answer alone would lose every
      // machinery row a reader can find by the command it ran, which is a
      // capability this box already has.
      if (needle === '' || matchesNode(nodes[i], needle) || foundAt.has(i)) view.push(i);
    }
    rebuild();
    count.replaceChildren();
    if (needle === '') {
      count.append(...ctx.t('conv.doc.whole', {
        turns: outline.said, records: outline.records,
      }));
    } else if (view.length === 0) {
      count.append(...ctx.t('conv.doc.noMatch'));
    } else if (findBody === null) {
      // The answer has not come back yet. The sentence says only what this
      // side actually knows, because the fuller one below names numbers that
      // do not exist until the scan does.
      count.append(...ctx.t('conv.doc.matched', {
        shown: view.length, total: nodes.length, peek: outline.peekChars,
      }));
    } else {
      /*
       * **THE SENTENCE NAMES WHAT THE NUMBER IS A NUMBER OF**, and that is the
       * half of this task the owner emphasised second: *"a count that silently
       * means 'in the rows I have drawn' is worse than no count at all"*.
       *
       *   — `turns` is turns OF WORDS that hold the query, over the whole
       *     transcript. It is the server's, from a scan of every prose span.
       *   — `scanned` against `records` is the scope, and the gap is enormous
       *     and invisible without it: **47,910 of one session's 52,292
       *     records are machinery**, in no index, findable here only by the
       *     tools they ran. Lane AI's report closes on exactly this.
       *   — `shown` is rows on the screen, which is the two readings joined.
       */
      count.append(...ctx.t('conv.doc.matchedFull', {
        shown: view.length,
        total: nodes.length,
        turns: findBody.turns.length,
        matches: findBody.matches,
        scanned: findBody.scanned,
        records: findBody.records,
      }));
      // Drawn only when real — `STD-a-measured-zero-is-drawn-and-named` binds a
      // measurement a reader asked for, and these are qualifications on one.
      if (findBody.capped === true) {
        count.append(' ', ...ctx.t('conv.doc.findCapped', { cap: findBody.scanCap }));
      }
      if (findUnreached > 0) {
        count.append(' ', ...ctx.t('conv.doc.findUnreached', { n: findUnreached }));
      }
      if (!CAN_HIGHLIGHT) count.append(' ', ...ctx.t('conv.doc.findNoPaint'));
    }
    navRefresh();
  };

  /**
   * Throw away every drawn row, re-derive the view, and land the reader.
   *
   * **`land` is the whole reason this is a parameter and not a constant**
   * (`TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`). The
   * mount path and the filter path used to share one function and therefore one
   * scroll position, and they want OPPOSITE ends:
   *
   *   - `'top'` — a reader who has typed a query wants the matches from the
   *     start of the session. That is correct and does not move. It also
   *     CLEARS the hold below, because a filter arriving inside the mount's
   *     three seconds must not be dragged back down by it.
   *   - `'end'` — a session opens where the work is. Owner ruling 2026-09-08:
   *     *"when the session is opened in conversation, scroll it to the end by
   *     default."* On his own session the top is 28,998 records from where he
   *     is working.
   *
   * **AND OPENING AT THE END IS THE MISSING HALF OF `seq:19`, not a
   * preference.** The document follows a live session only for a reader who is
   * AT THE TAIL — that is what `atTail()` gates — so a session that opened at
   * the top made the reader travel to the end before the following he asked for
   * began. Opening at the end means it is running from the first frame.
   *
   * **THE LANDING IS HELD, NOT SET AND HOPED FOR.** `scroller.total` is a sum
   * of ESTIMATES at mount — nothing has been measured yet — so a single
   * `scrollTop = total` lands somewhere that stops being the end as soon as
   * the first rows are measured and the first bodies arrive. `stickUntil` is
   * the mechanism `refill` already uses for exactly this, and `paint` re-pins
   * to the end on every pass while it is hot. It is a CEILING, not a pin: the
   * same `wheel`/`keydown`/`pointerdown` listeners that release the follow's
   * hold release this one, so a reader who opens a session and immediately
   * scrolls up is obeyed at once.
   *
   * **"THE END" IS THE END OF THE VIEW, not of the nodes.** `scroller.total` is
   * summed over `view`, which is the filtered list. They are the same thing
   * today because no filter can be present at mount, and this is the reading
   * that stays right when `seq:10` makes them diverge: a reader looking at a
   * filtered document should land at the last MATCH, not at a node the filter
   * is hiding.
   */
  const redraw = (land) => {
    reView();
    for (const [, row] of live) row.remove();
    live.clear();
    waiting.clear();
    if (land === 'end') {
      scroll.scrollTop = scroller.total;
      stickUntil = Date.now() + STICK_MS;
    } else {
      stickUntil = 0;
      scroll.scrollTop = 0;
    }
    paint();
  };

  /**
   * A new search throws away every drawn row, so it throws away the passage
   * too. Forgetting it is the honest answer: the sections the reader marked
   * were marked on a document that no longer exists, and a copy taken after a
   * filter narrowed the view would be filled from records they can no longer
   * see. Nothing is silently kept.
   */
  const applyFilter = () => {
    marked = null;
    held.clear();
    armCopy(false);
    redraw('top');
  };
  /**
   * **AND IT SETTLES, LIKE THE OTHER THREE.**
   *
   * This was wired straight to `applyFilter`, alone among the four find boxes
   * on this screen, and what one keystroke costs is not the handler's own
   * milliseconds — measured 4.6 to 23.6 ms on a seeded 28,001-record session,
   * so the 1,200 ms in `TASK-the-conversation-document-s-find-box-has-no-debounce`
   * did NOT reproduce on this build and is recorded here as not reproduced
   * rather than quietly repeated. What it costs is everything `applyFilter`
   * does AROUND the search, per character:
   *
   *   - every drawn row torn out of the DOM and rebuilt, folds a reader opened
   *     shut with them;
   *   - the reader thrown back to `scrollTop = 0`, mid-word;
   *   - the marked passage and the held selection DISCARDED — `marked = null`
   *     — so a copy being composed is lost to the second letter of a search;
   *   - a refill round trip for whatever the new top of the view needs.
   *
   * Measured over "keep going" typed at 120 ms a character on that session:
   * **10 keystrokes, 10 whole-document redraws, 4 fetches, 1,350 ms before the
   * screen settled.** Settled, the same burst is ONE redraw.
   *
   * The number is `FILTER_SETTLE_MS`'s own, and deliberately the same one: the
   * argument there — that 250 ms is under the pause a person notices and above
   * the gap between two keystrokes — is about the READER, not about the list,
   * so it transfers whole and a second number would be a second thing to
   * justify. `settler` is the shared mechanism, so there is no fourth copy of
   * it.
   */
  /**
   * **ASK THE SERVER WHERE THE WORDS ARE, OVER THE WHOLE TRANSCRIPT.**
   *
   * `semantic/8`. This is the half that cannot be done in the browser: the
   * session is ~133 MB over ~52,000 records and this page holds an outline
   * plus a windowed `bodies` cache, so a find that walked the DOM would see
   * only the rows currently drawn and would report a wrong count SILENTLY.
   *
   * **And the endpoint folds, which is the other half.** Measured on this
   * repository's own archive, 2026-09-16: a reader typing `...` reaches 463
   * spans as a plain substring and as an FTS5 trigram query, and **1,024**
   * folded, because this product writes `…` and a keyboard does not.
   *
   * A failure draws nothing and changes nothing. The outline filter above is
   * still a real answer to a real question, and a screen that emptied itself
   * because a second, better search could not be reached would be worse than
   * one that quietly keeps the first — the count line then still says what it
   * counted, which is the outline reading, because `findBody` stays `null`.
   */
  const askFind = async () => {
    const asked = find.value.trim();
    findGen += 1;
    const mine = findGen;
    if (asked === '') {
      foundAt.clear();
      findBody = null;
      findUnreached = 0;
      return;
    }
    let body;
    try {
      body = await ctx.api(
        `/api/conversations/${encodeURIComponent(outline.sessionId)}/find`
        + `?q=${encodeURIComponent(asked)}`);
    } catch {
      /*
       * **A FAILED SCAN FORGETS THE PREVIOUS ONE, and returning here quietly
       * was a real defect until it was read back.** The first draft just
       * returned, which leaves `findBody` and `foundAt` holding the answer to
       * a query the reader has since replaced: the count line would have gone
       * on describing the OLD words under the NEW ones, which is a wrong
       * answer with nothing on the screen saying so.
       *
       * Cleared, and the count line falls back to the outline reading it can
       * still honestly make — `findBody === null` is the branch that says the
       * whole-text search has not answered.
       */
      if (mine !== findGen) return;
      foundAt.clear();
      findBody = null;
      findUnreached = 0;
      reView();
      paint();
      return;
    }
    // A stale answer is DROPPED rather than drawn late. `findGen` moved
    // because the reader typed again, and the words on the screen are the
    // newer ones.
    if (mine !== findGen) return;
    foundAt.clear();
    findUnreached = 0;
    for (const turn of body.turns ?? []) {
      const at = nodeAtByte(turn.byteOffset);
      // `-1` is a byte this document's walk never reached. It is not a hit
      // that can be stepped to and it is not nothing — it is counted, and the
      // count line says so beside `conv.doc.truncated`, which is already on
      // the page for the same reason.
      if (at < 0) { findUnreached += 1; continue; }
      foundAt.set(at, (foundAt.get(at) ?? 0) + turn.matches);
    }
    findBody = body;
    reView();
    paint();
    // AFTER `reView`, which runs `navRefresh` and therefore `endWalk`.
    findFresh = true;
  };

  const typing = settler(FILTER_SETTLE_MS, () => {
    applyFilter();
    void askFind();
  });
  find.addEventListener('input', typing.settle);

  /**
   * **THE NODE THE MARKED BYTE FALLS IN** — capability 4's other half.
   *
   * The anchor stores a BYTE and the document draws NODES, and the two are
   * joined here rather than in the address: `DocOutlineNode.o` is the byte the
   * node's first record begins at, so the node a byte belongs to is the last
   * one whose `o` is at or before it. An exact hit is the ordinary case — an
   * anchor is always at the start of a record — and the inequality is what
   * keeps a mark inside a folded RUN landing on the fold that holds it rather
   * than on nothing.
   *
   * `-1` when the byte is before the first node, which is a document whose
   * walk resumed past it. The caller lands at the end instead of pretending.
   */
  const nodeAtByte = (byte) => {
    let best = -1;
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].o > byte) break;
      best = i;
    }
    return best;
  };

  /**
   * Land on one node and say so.
   *
   * **`stickUntil = 0` is what makes this survive the mount's three-second
   * hold to the end.** `redraw('end')` pins the next paints to the tail
   * precisely so the estimate-driven landing is not lost as rows are measured,
   * and a scroll set inside that window would be dragged straight back down —
   * the defect `button.tvtop`'s own comment records, one control along.
   */
  const landOn = (nodeIndex) => {
    if (nodeIndex < 0) return false;
    stickUntil = 0;
    scroll.scrollTop = scroller.top(viewFrom(nodeIndex));
    paint();
    return true;
  };

  /* ══ STEPPING: MARKS, AND HIS OWN PROMPTS ═════════════════════════════════
   *
   * `TASK-there-is-no-way-to-step-through-the-marks-or-through-your`.
   *
   * ── WHAT A STOP IS, AND WHY IT IS A NODE AND NOT AN ANCHOR ──────────────
   *
   * An anchor holds a BYTE; the document draws NODES; and `nodeAtByte` already
   * owns the join. Two anchors can therefore share one stop — a folded `work`
   * run covers many records, and both bytes land on the fold that holds them.
   * A stepper counted in ANCHORS would then say "3 of 12" and stop twelve
   * times at eleven places, which is a counter that cannot be checked against
   * the screen. So a stop is a POSITION, its anchors travel with it, and the
   * announcement names every label at that position rather than the first —
   * `INV-nothing-is-dropped-silently` applied to a sentence rather than to a
   * list.
   *
   * ── AND THE STOPS ARE TAKEN OVER `view`, NOT OVER `nodes` ───────────────
   *
   * `passageSpan` makes the same choice one screen down and states its reason:
   * with a filter typed, the sections the filter hides are not on the screen
   * and the reader did not mark them by dragging past them. A step is the same
   * kind of claim — it moves the reader to something they can see. What a
   * filter is holding back is SAID rather than silently subtracted, in the
   * counter beside the buttons, because a reader whose twelve marks became two
   * has to be able to tell a filter from a lost bookmark.
   *
   * ── THE PAGE BOUND ON THE LIST DOES NOT REACH HERE ─────────────────────
   *
   * `drawAnchors` pages its list at `BOUND_CAP_LIST` (20). These stops come
   * from `anchorsHere`, which `loadAnchors` fills from
   * `GET /api/conversations/anchors?session=…` — an UNPAGED answer scoped to
   * this transcript — so the twenty-first mark is as reachable from here as
   * the first. Measured in the browser rather than assumed; the report carries
   * the number.
   */

  /** Node indices in `view`, as a set, so a stop can be tested for membership. */
  const inView = () => new Set(view);

  /**
   * Every marked position in this document, ascending, with the anchors that
   * sit at it — and how many marks the filter is holding back.
   */
  const markStops = () => {
    const shown = inView();
    const byNode = new Map();
    const hiddenAt = new Set();
    // **OVER MARKS AND NOT OVER POSITIONS.** A turn that is both a table and a
    // lane report holds two of them at one byte, and the kind filter has to be
    // able to reach it under EITHER — which is the whole point of the second
    // mark. `byNode` then groups them back, so the STOPS stay positions.
    for (const anchor of everyAnchorHere()) {
      /*
       * **THE KIND FILTER IS APPLIED BEFORE THE VIEW TEST, AND THE ORDER IS
       * THE DESIGN** — `TASK-the-six-kinds-a-mark-can-carry-have-no-reader-so`.
       *
       * `hidden` means ONE thing on this screen: *"this many more are in the
       * conversation and the search above is hiding them"*, with a sentence
       * that offers to clear the search. A mark of another kind is not hidden
       * by anything — the reader chose the narrowing and the counter names it
       * — so counting it there would put a number under a sentence that is
       * false about it and offer a cure that does nothing. Filtered out first,
       * it is in neither number, and the count says what it counts instead.
       */
      if (markKind !== null && anchor.kind !== markKind) continue;
      const at = nodeAtByte(anchor.byteOffset);
      /*
       * **A BYTE THIS DOCUMENT DOES NOT REACH IS NOT A STOP, AND IT IS NOT THE
       * FILTER'S DOING EITHER**, so it is counted in neither number.
       *
       * It happens on one kind of document: one whose walk stopped at
       * `DOCUMENT_WALK_CAP`, where the transcript runs on past the last node
       * drawn. `conv.doc.landedNowhere` is what an ADDRESS into that region
       * says on arrival, and `conv.doc.truncated` is already on this very page
       * saying the document ends before the file does — so a reader whose
       * count is short of their anchor list has the reason in front of them
       * rather than nowhere. Naming it in the counter as well would be a
       * fourth sentence about a state that only the capped walk produces.
       */
      if (at < 0) continue;
      // **HIDDEN IS COUNTED IN POSITIONS, THE SAME UNIT AS `stops`**, and that
      // became a real distinction on 2026-09-16: a turn with two marks is ONE
      // thing the search is holding back, and counting it twice would put a
      // number under "N more are in this conversation" that no amount of
      // clearing the search could ever produce as stops.
      if (!shown.has(at)) { hiddenAt.add(at); continue; }
      const held = byNode.get(at);
      if (held === undefined) byNode.set(at, [anchor]); else held.push(anchor);
    }
    const stops = [...byNode.keys()].sort((a, b) => a - b)
      .map((at) => ({ at, anchors: byNode.get(at) }));
    /**
     * **HOW MANY OF THE STOPS CARRY MORE THAN ONE MARK** — the disclosure
     * `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing` asks
     * for, and the reason it is needed rather than tidy.
     *
     * `conv.nav.marks` says *"N marked point(s) here"*, and a POINT is a place
     * in the conversation: the stepper stops at places, and the item forbids it
     * landing on the same turn twice without saying why. So a two-mark turn
     * counts ONCE and the sentence stays true of the walk.
     *
     * But the archive list counts ROWS, and after this change the two numbers
     * can differ — 240 turns' worth on the owner's own archive. A count whose
     * meaning silently changed is `confirm/3`'s defect exactly, so the
     * difference is SAID beside the number rather than left for a reader to
     * discover by comparing two screens.
     */
    const doubled = stops.filter((stop) => stop.anchors.length > 1).length;
    return { stops, hidden: hiddenAt.size, doubled };
  };

  /**
   * Every turn drawn as HIS — the second half of the ruling, and it reads the
   * same field the heading does.
   *
   * `DocOutlineNode.w` is who CAUSED the turn, and `drawTurn` draws `'you'` as
   * "You". A slash command he typed is `w: 'you'` with a synthetic label, and
   * it is here for the reason `syntheticSpeaker` gives in as many words — *"He
   * typed the slash command. The wrapper is machinery; the ACT was his."* A
   * task notification is `'subagent'` or `'shell'` or nobody, and is not.
   *
   * So this is exactly "the turns shown as You", which is what he asked for,
   * rather than a second opinion about which of them really count.
   */
  const youStops = () => {
    const stops = [];
    let hidden = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].k !== 'said' || nodes[i].w !== 'you') continue;
      stops.push(i);
    }
    const shown = inView();
    const kept = stops.filter((at) => shown.has(at));
    hidden = stops.length - kept.length;
    return { stops: kept, hidden };
  };

  /**
   * **EVERY TURN THE SERVER FOUND, ASCENDING** — `semantic/8`.
   *
   * `foundAt` is keyed by node index already, so this is a sort and a view
   * test and nothing else. **`hidden` is always zero and is returned anyway**,
   * and that is deliberate rather than dead: `reView` puts every found node
   * into the view by construction, so a found turn the filter is hiding
   * cannot exist today — and a later edit that narrowed the view would make
   * it possible in one line, with the counter already able to say so. The
   * turns this document genuinely cannot reach are counted in
   * `findUnreached`, which is a different fact and has its own sentence.
   */
  const foundStops = () => {
    const shown = inView();
    const stops = [];
    let hidden = 0;
    for (const at of [...foundAt.keys()].sort((a, b) => a - b)) {
      if (shown.has(at)) stops.push(at); else hidden += 1;
    }
    return { stops, hidden };
  };

  /**
   * **WHERE THE WALK IS UP TO, WHICH IS NOT THE SAME QUESTION AS "WHERE IS
   * THE SCROLL"** — and the difference was found by driving it.
   *
   * The obvious implementation reads the node at the top of the viewport on
   * every press. It stalls twice, and both are arithmetic rather than bad
   * luck:
   *
   *   - **At the foot of the document the scroll CANNOT reach the last rows.**
   *     `scrollTop` is clamped at `total - clientHeight`, so a reader standing
   *     on the last mark has a viewport whose TOP is six rows above it. "The
   *     next mark after the top of the viewport" is then that same mark again,
   *     for ever, and the last two or three marks in every session become one.
   *   - **`scrollTop` is a browser number.** Writing `scroller.top(i)` and
   *     reading it back can give a value a fraction BELOW it, which puts the
   *     binary search one row early and asks for "the next mark after the row
   *     before the one I am on" — the same mark, again.
   *
   * So the walk keeps its own place: an index into the list of stops, set when
   * a step lands and thrown away the moment the reader moves themselves.
   * `wheel`, `keydown` and `pointerdown` on the well are the three inputs this
   * file already treats as unambiguously the reader's — the follow's hold is
   * released by exactly those three, and for the same reason. Anything else
   * (a paint, a measurement, a correction) is the document, not the person.
   *
   * `-1` is "no walk in progress", and then the viewport IS the answer: a
   * reader who scrolled to the middle and pressed Next means the middle.
   */
  const cursor = { mark: -1, you: -1, found: -1 };
  endWalk = () => { cursor.mark = -1; cursor.you = -1; cursor.found = -1; findFresh = false; };
  for (const event of ['wheel', 'keydown', 'pointerdown']) {
    scroll.addEventListener(event, endWalk, { passive: true });
  }

  /**
   * Where the reader is: the node the top of the viewport sits in.
   *
   * **Nudged forward by a whisker** for the rounding above. Two pixels cannot
   * cross a row — the shortest row this document draws is a folded run at
   * 34px — so this changes the answer only where `scrollTop` came back a
   * fraction short of the row it was set to.
   */
  const hereNode = () => (view.length === 0 ? -1 : view[scroller.at(scroll.scrollTop + 2)]);

  /**
   * **A STEP THAT LANDS ON A TURN HAS NOT LANDED ON THE MATCH** — found by
   * driving it, and it is the difference between the feature working and
   * appearing to.
   *
   * `landOn` writes `scroller.top(row)`, which is the TOP of the turn. Turns
   * in this archive run to tens of thousands of characters, so stepping to a
   * match in one of them put the reader at the head of a wall of text with
   * the highlight several screens below the fold — highlighted, and not where
   * he is looking, which is exactly what the item says a hit that cannot be
   * seen is worth.
   *
   * So the row's first match is measured where it actually IS — a `Range`'s
   * own box, in the layout, after the paint — and the scroll is nudged only
   * if it is outside the well. Never centred and never moved when it is
   * already visible: a step that re-scrolled a match the reader can already
   * see would move the page for nothing.
   *
   * **It reads the DRAWN row and can honestly find nothing.** The server
   * matched the RECORD's text and this matches what Markdown rendered from
   * it, and the two are not the same string — `**byte**` is in one and not
   * the other. When the rendered text does not carry the match, the turn is
   * still the right turn and the head of it is still the right landing, so
   * this returns and says nothing rather than inventing a position.
   */
  const showMatch = (nodeIndex) => {
    const needle = find.value.trim();
    if (needle === '') return;
    const row = live.get(nodeIndex);
    if (row === undefined) return;
    const { parts, whole } = rowText(row);
    if (parts.length === 0) return;
    const hit = foldedMatches(whole, needle, 1)[0];
    if (hit === undefined) return;
    let lo = 0;
    let hi = parts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (parts[mid].at <= hit.from) lo = mid; else hi = mid - 1;
    }
    const range = document.createRange();
    range.setStart(parts[lo].node, Math.min(hit.from - parts[lo].at, parts[lo].node.data.length));
    range.collapse(true);
    const box = range.getBoundingClientRect();
    const rect = scroll.getBoundingClientRect();
    /*
     * **THE WELL IS NOT THE SAME THING AS THE PART OF IT YOU CAN SEE**, and
     * measuring it was what found this: on a 1280x800 window `.tvscroll`'s own
     * box runs to y=1040, past the bottom of the viewport, because the page
     * scrolls as well as the well does. Tested against the well alone, a match
     * at y=795 is "visible" and the reader is looking at 800 pixels of screen
     * that does not contain it. So the test is against the INTERSECTION, which
     * is the only rectangle a reader actually has.
     */
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight || rect.bottom);
    // A collapsed range in a row that is drawn but positioned outside the
    // window answers with an empty box. Nothing to aim at, so nothing moves.
    if (box.top === 0 && box.bottom === 0) return;
    if (box.top >= top && box.bottom <= bottom) return;
    scroll.scrollTop += box.top - top - MATCH_MARGIN_PX;
    paint();
  };

  const sayNav = (key, subs = {}, tail = null) => {
    navSaid.hidden = false;
    navSaid.replaceChildren(...ctx.t(key, subs));
    if (tail !== null) navSaid.append(' ', tail);
  };

  /**
   * One step, in one direction, over one set of stops.
   *
   * **THE CARET DOES NOT MOVE, and that is the discipline rather than an
   * omission of it.** Every write on this screen returns the caret to the row
   * it changed, because a write DESTROYS the control the reader was using. A
   * step destroys nothing: the button is still there, still focused, and a
   * reader stepping through twelve marks presses it twelve times. Moving the
   * caret into the well would cost a walk back to the bar for every single
   * step, and would put the focus on a row `paint` evicts the moment the next
   * step scrolls past it. What the reader is owed instead is to be TOLD where
   * they landed, and `navSaid` — outside the well, live, and never rebuilt —
   * is where that is said.
   *
   * **THE ENDS ARE SAID, NOT DISABLED.** A disabled button cannot hold focus,
   * so disabling the one the reader is pressing at the last mark would throw
   * the caret to the body at exactly the moment they most need it — the same
   * defect `TASK-every-write-on-conversations-throws-focus-to-the-document`
   * measured at 29 tab stops. The button stays, and pressing it at the end
   * says there is nothing beyond rather than appearing to be broken.
   */
  const step = (which, forward) => {
    const { stops } = which === 'mark' ? markStops()
      : which === 'you' ? youStops() : foundStops();
    const positions = which === 'mark' ? stops.map((s) => s.at) : stops;
    /*
     * **EVERY SENTENCE THE MARK WALK SAYS HAS A FILTERED TWIN, and that is the
     * item's own constraint rather than thoroughness for its own sake.** *"The
     * count must say what it counts. '3 of 24' when filtered to defects is a
     * lie unless the sentence says defects."* The landing is the loudest case
     * and it is not the only one: *"Nothing is marked after this point"* is
     * equally false when four defects sit below the reader and the walk is
     * over questions. So the KIND travels with every one of them.
     *
     * **SPELLED OUT RATHER THAN COMPOSED FROM A VARIABLE KEY**, for the reason
     * `navRefresh` already carries: `test/ui/viewmodel.test.ts` reads every key
     * and every slot out of this file by PARSING it, and a key arriving as a
     * variable is a key that gate cannot see.
     */
    if (positions.length === 0) {
      if (which === 'found') sayNav('conv.nav.noFounds');
      else if (which === 'you') sayNav('conv.nav.noYous');
      else if (markKind === null) sayNav('conv.nav.noMarks');
      else sayNav('conv.nav.noMarksKind', { kind: kindWord(markKind) });
      return;
    }
    const standing = cursor[which];
    let target = -1;
    if (standing >= 0 && standing < positions.length) {
      const next = standing + (forward ? 1 : -1);
      if (next >= 0 && next < positions.length) target = next;
    } else {
      const here = hereNode();
      // `>=` for the first step of a fresh find, and `>` for everything else.
      // See `findFresh`: a match under the viewport has not been visited, a
      // mark under it has.
      const first = which === 'found' && findFresh;
      if (forward) {
        for (let i = 0; i < positions.length; i += 1) {
          if (first ? positions[i] >= here : positions[i] > here) { target = i; break; }
        }
      } else {
        for (let i = positions.length - 1; i >= 0; i -= 1) {
          if (positions[i] < here) { target = i; break; }
        }
      }
    }
    if (target === -1) {
      if (which === 'found') {
        sayNav(forward ? 'conv.nav.foundLast' : 'conv.nav.foundFirst');
      } else if (which === 'you') {
        sayNav(forward ? 'conv.nav.youLast' : 'conv.nav.youFirst');
      } else if (markKind === null) {
        sayNav(forward ? 'conv.nav.markLast' : 'conv.nav.markFirst');
      } else if (forward) {
        sayNav('conv.nav.markLastKind', { kind: kindWord(markKind) });
      } else {
        sayNav('conv.nav.markFirstKind', { kind: kindWord(markKind) });
      }
      return;
    }
    landOn(positions[target]);
    if (which === 'found') { findFresh = false; showMatch(positions[target]); }
    // The walk's own place, set only by a step. `landOn` writes `scrollTop`,
    // which fires `scroll` — and `scroll` is deliberately NOT one of the three
    // events that throw this away, for the reason the follow's hold gives one
    // control along: *"`scroll` itself is not [the reader's], because `paint`
    // fires it."*
    cursor[which] = target;
    if (which === 'found') {
      sayNav('conv.nav.atFound', { n: target + 1, total: positions.length });
      return;
    }
    if (which === 'you') {
      sayNav('conv.nav.atYou', { n: target + 1, total: positions.length });
      return;
    }
    // The NAMES, isolated: a Hebrew label inside an English sentence takes the
    // sentence's direction unless it is, which is the convention the anchors
    // card already holds for every label it draws.
    const named = el('bdi', 'tvnavat');
    named.textContent = stops[target].anchors.map((a) => a.label).join(' · ');
    if (markKind === null) {
      sayNav('conv.nav.atMark', { n: target + 1, total: positions.length }, named);
      return;
    }
    sayNav('conv.nav.atMarkKind',
      { n: target + 1, total: positions.length, kind: kindWord(markKind) }, named);
  };

  markPrev.addEventListener('click', () => { step('mark', false); });
  markNext.addEventListener('click', () => { step('mark', true); });
  youPrev.addEventListener('click', () => { step('you', false); });
  youNext.addEventListener('click', () => { step('you', true); });
  foundPrev.addEventListener('click', () => { step('found', false); });
  foundNext.addEventListener('click', () => { step('found', true); });

  /**
   * What there is to step through, said before anything is pressed.
   *
   * A pair of buttons with no count beside them is a control a reader has to
   * press to find out whether it does anything, and a measured zero is a real
   * answer here — a lane's transcript can genuinely hold no mark at all.
   * `STD-a-measured-zero-is-drawn-and-named`.
   */
  /**
   * The kinds this document actually holds, ascending, as one comparable line.
   *
   * Read off `anchorsHere` rather than off `view`: the SELECT is about what is
   * in the conversation, and a kind whose only mark the find box is currently
   * hiding is still a kind of this conversation. The counter beside it is what
   * says how many of them the reader can reach right now, and it already has a
   * sentence for the difference.
   */
  const kindsPresent = () => {
    const seen = new Set();
    // Over MARKS. A turn that is both a table and a lane report puts BOTH kinds
    // in this list, which is what makes it selectable — and reachable — under
    // either one.
    for (const anchor of everyAnchorHere()) seen.add(anchor.kind);
    return [...seen].sort();
  };

  /**
   * Draw the choices, and ONLY when they moved.
   *
   * **A `<select>` rebuilt under an open dropdown shuts it**, and this runs on
   * every keystroke in the find box and after every write. The signature is
   * what makes "rebuild anyway" unwritable rather than merely discouraged.
   *
   * **A kind that left the document takes the filter with it.** The last
   * defect being taken back while the walk is narrowed to defects would
   * otherwise leave a `<select>` showing a choice it no longer offers, and a
   * counter counting nothing with no way back to everything — so the filter
   * falls back to every kind, which is the state the control can express.
   */
  const fillKinds = () => {
    const present = kindsPresent();
    // **THE SEPARATOR IS WRITTEN AS AN ESCAPE, and it was a raw NUL byte in
    // the source until 2026-09-15.** A literal NUL makes git treat this whole
    // 9,400-line file as BINARY — no diff, no review, and a merge conflict
    // nothing can resolve. `scripts/check-text-files.ts` reports it in those
    // words, and it is why `grep` has been answering "Binary file … matches"
    // over this file for weeks. The escape sends the same byte and leaves the
    // file readable, which is the repair that gate asks for.
    const signature = present.join('\u0000');
    if (signature === kindsDrawn) return;
    kindsDrawn = signature;
    if (markKind !== null && !present.includes(markKind)) markKind = null;
    kindPick.replaceChildren();
    const any = el('option', null, ctx.tFlat('conv.nav.kindAny'));
    any.value = '';
    kindPick.append(any);
    for (const kind of present) {
      const option = el('option', null, kindWord(kind));
      option.value = kind;
      kindPick.append(option);
    }
    kindPick.value = markKind ?? '';
  };

  /*
   * **A CHANGE OF FILTER THROWS THE WALK AWAY**, through `navRefresh`'s own
   * `endWalk` — for the reason written there: the list of stops has been
   * re-derived, so "stop 7" afterwards is a different place and a kept cursor
   * would step the reader somewhere they never asked to go.
   */
  /*
   * **AND THE NEW SUBJECT IS SAID, IN THE REGION THE WALK ALREADY SPEAKS IN**
   * — `TASK-stepping-to-the-next-mark-of-a-particular-kind-needs-its-own`,
   * closing sentence: *"a key that changes the subject must announce the change
   * in the same region, or a reader will not know why the next press went
   * somewhere unexpected."*
   *
   * **IT IS SAID HERE AND NOT IN THE KEY HANDLER, which is the whole point.**
   * Three routes now set this filter — the `<select>` itself, the menu's
   * `menuitemradio` rows, and `K`/`Shift+K` — and all three reach it through
   * this one `change`. An announcement written in the key handler would be a
   * sentence only the keyboard reader ever hears, and a fourth route added
   * later would arrive with no sentence at all. One event, one announcement.
   *
   * **THE WORDS ARE `markCount`'S OWN**, re-used rather than written again:
   * `conv.nav.marksKind` is exactly "N marked point(s) here of one kind — X",
   * which is the sentence the counter beside the control is about to draw. Two
   * spellings of one fact is the defect `confirm/3` is about, and this screen
   * has refused it twice already.
   *
   * `navRefresh` runs FIRST, because it is what re-derives the stops these
   * numbers describe — announcing before it would report the old walk.
   */
  kindPick.addEventListener('change', () => {
    markKind = kindPick.value === '' ? null : kindPick.value;
    navRefresh();
    const after = markStops();
    // **SPELLED OUT RATHER THAN COMPOSED FROM A VARIABLE KEY**, for the reason
    // `navRefresh` carries twenty lines down: `test/ui/viewmodel.test.ts` reads
    // every key and every slot out of this file by PARSING it, and a key
    // arriving as a variable is a key that gate cannot see.
    if (markKind === null) {
      sayNav('conv.nav.marks', { n: after.stops.length });
    } else if (after.stops.length === 0 && after.hidden === 0) {
      sayNav('conv.nav.marksNoneKind', { kind: kindWord(markKind) });
    } else {
      sayNav('conv.nav.marksKind', { n: after.stops.length, kind: kindWord(markKind) });
    }
  });

  /**
   * **ONE STEP AROUND THE RING OF KINDS THIS DOCUMENT HOLDS** — `K` and
   * `Shift+K`, `TASK-stepping-to-the-next-mark-of-a-particular-kind-needs-its-
   * own`.
   *
   * **IT DRIVES THE REAL `<select>` AND DISPATCHES ITS OWN `change`**, which is
   * the discipline every other route on this screen already keeps and the one
   * the menu's radios were built to: *"setting the value alone leaves the walk
   * unnarrowed"*, measured when the menu landed. So there is still exactly one
   * `markKind`, one `markStops`, one `cursor` and one announcement — the item's
   * "ONE WALK" constraint is kept by having no second mechanism to keep it in,
   * rather than by two mechanisms agreeing.
   *
   * **THE RING INCLUDES "every kind", AND THAT IS THE WAY BACK.** The options
   * are `['', ...kindsPresent()]`, so pressing `K` past the last kind returns
   * to the unnarrowed walk. A ring with no way home would be a filter a
   * keyboard reader could enter and not leave — and `Escape`, which is the
   * gesture they would try, is spoken for twice and is not available.
   *
   * **IT WRAPS RATHER THAN ENDING, which is not the walk's rule and should not
   * be.** `step` announces its ends instead of disabling, because a POSITION in
   * a document has a first and a last and a reader needs to be told they are
   * there. A set of choices has neither; it has a cycle. Refusing to wrap here
   * would invent an end that nothing on screen expresses.
   *
   * **A DOCUMENT WITH NOTHING MARKED IS SAID, NOT SWALLOWED**, for
   * `runShortcut`'s own stated reason one screen down: a key that silently did
   * nothing is indistinguishable from a key that is not bound. One option means
   * `kindsPresent()` came back empty — there is no mark here at all — and
   * `conv.nav.noMarks` is already the sentence for exactly that.
   */
  const cycleKind = (by) => {
    const options = [...kindPick.options];
    if (options.length <= 1) { sayNav('conv.nav.noMarks'); return; }
    const at = options.findIndex((option) => option.value === kindPick.value);
    // `findIndex` answering -1 would make `(-1 + 1) % n` land on 1 and skip the
    // unnarrowed option, so a value the list does not hold is treated as being
    // AT the unnarrowed option, which is the state `fillKinds` puts it in.
    const from = at < 0 ? 0 : at;
    const next = (from + by + options.length) % options.length;
    kindPick.value = options[next].value;
    kindPick.dispatchEvent(new Event('change'));
  };

  navRefresh = () => {
    // **A WALK IN PROGRESS DOES NOT SURVIVE THE LIST IT WALKS CHANGING.** A
    // filter re-derives every stop, and a mark made while reading inserts one
    // — so "stop 7" afterwards is a different place, and a cursor kept across
    // either would step the reader somewhere they never asked to go. Thrown
    // away rather than re-derived: the viewport is a correct answer and a
    // guessed index is not.
    endWalk();
    /**
     * **THE EMPTY SENTENCE IS ONLY DRAWN WHEN THE EMPTINESS IS REAL.**
     *
     * Found by driving it: with a filter typed that matched only his turns,
     * the counter read *"Nothing is marked in this conversation. Mark a point
     * on any turn below…"* beside *"24 more are in this conversation and the
     * search above is hiding them"* — two sentences about one fact, the first
     * of them false, which is the exact shape this screen refuses everywhere
     * else. A zero that the FILTER produced is a zero here and not a zero in
     * the conversation, so it is drawn as the number it is and the hidden
     * count says where the rest went.
     */
    // **SPELLED OUT TWICE RATHER THAN PASSED AS THREE KEYS TO ONE HELPER**,
    // and that is not a style preference: `test/ui/viewmodel.test.ts` reads
    // every key and every slot out of the `t` and `tFlat` calls in this file
    // by PARSING it, so a key arriving as a variable is a key that gate cannot
    // see — and this file has six of them that exist only here.
    fillKinds();
    const marks = markStops();
    markCount.replaceChildren();
    if (markKind !== null) {
      // **THE NUMBER NAMES ITS OWN SUBJECT.** `confirm/3`'s defect is a count
      // whose meaning silently changed, and this is exactly that shape: the
      // same "12" means every mark one second and every defect the next.
      if (marks.stops.length === 0 && marks.hidden === 0) {
        markCount.append(...ctx.t('conv.nav.marksNoneKind', { kind: kindWord(markKind) }));
      } else {
        markCount.append(...ctx.t('conv.nav.marksKind',
          { n: marks.stops.length, kind: kindWord(markKind) }));
      }
    } else if (marks.stops.length === 0 && marks.hidden === 0) {
      markCount.append(...ctx.t('conv.nav.marksNone'));
    } else {
      markCount.append(...ctx.t('conv.nav.marks', { n: marks.stops.length }));
    }
    if (marks.hidden > 0) {
      markCount.append(' ', ...ctx.t('conv.nav.marksHidden', { n: marks.hidden }));
    }
    /**
     * **AND WHERE THE NUMBER DIFFERS FROM THE NUMBER OF MARKS, IT SAYS SO.**
     *
     * Drawn only when it is real, like `marksHidden` above and for the same
     * reason: a sentence saying *"0 of them carry two marks"* on 1,059 turns
     * out of 1,059 would be a line nobody reads, standing where a line that
     * matters has to be noticed. `STD-a-measured-zero-is-drawn-and-named` binds
     * a measurement a reader asked for; this is a qualification on one.
     *
     * It is skipped under a kind filter, and that is not an omission: with the
     * walk narrowed to `report`, every stop shows one mark of that kind and the
     * count is a count of marks again. The two numbers only come apart when the
     * walk is unnarrowed.
     */
    if (markKind === null && marks.doubled > 0) {
      markCount.append(' ', ...ctx.t('conv.nav.marksDoubled', { n: marks.doubled }));
    }

    const yous = youStops();
    youCount.replaceChildren();
    if (yous.stops.length === 0 && yous.hidden === 0) {
      youCount.append(...ctx.t('conv.nav.yousNone'));
    } else {
      youCount.append(...ctx.t('conv.nav.yous', { n: yous.stops.length }));
    }
    if (yous.hidden > 0) {
      youCount.append(' ', ...ctx.t('conv.nav.yousHidden', { n: yous.hidden }));
    }
    /*
     * **AND THE THIRD COUNT SAYS WHERE IT CAME FROM** — `semantic/8`.
     *
     * A find bar's count is the one number on this screen a reader is most
     * likely to read as *"everywhere in this conversation"*, and it is not:
     * it is turns of WORDS, over the whole transcript, from the server's own
     * scan. The long sentence lives on the count line beside the find box,
     * which is where the scope belongs; this one is the short form beside the
     * buttons it describes, and it is the number of stops the walk actually
     * has, which is the only thing these two buttons can promise.
     *
     * **A measured zero is drawn and named.** With nothing typed the pair
     * would otherwise be a control a reader has to press to discover it does
     * nothing — `STD-a-measured-zero-is-drawn-and-named`, the same reason the
     * marks counter has an empty sentence of its own.
     */
    const founds = foundStops();
    foundCount.replaceChildren();
    if (find.value.trim() === '') {
      foundCount.append(...ctx.t('conv.nav.foundsIdle'));
    } else if (founds.stops.length === 0) {
      foundCount.append(...ctx.t('conv.nav.foundsNone'));
    } else {
      foundCount.append(...ctx.t('conv.nav.founds', { n: founds.stops.length }));
    }
    if (findUnreached > 0) {
      foundCount.append(' ', ...ctx.t('conv.nav.foundsUnreached', { n: findUnreached }));
    }
  };

  redraw('end');

  /**
   * **OPENED AT THE POINT HE MARKED** — the far end of `anchorHref`.
   *
   * The landing is DISCLOSED rather than silent: a document that opened
   * somewhere other than where it always opens, with nothing saying why, is a
   * reader wondering whether the scroll broke. The line names the label, which
   * is the one thing that says WHICH bookmark this is.
   *
   * A byte this document does not reach is said as itself — it is a real state
   * on a transcript whose walk stopped at `DOCUMENT_WALK_CAP`, and reporting
   * it as a successful landing at the end would be the silent half
   * `INV-nothing-is-dropped-silently` forbids.
   */
  if (typeof landAt === 'number' && Number.isInteger(landAt) && landAt >= 0) {
    const note = el('p', 'tvnote tvlanded');
    note.setAttribute('aria-live', 'polite');
    host.insertBefore(note, scroll);
    void (async () => {
      await loadAnchors();
      const at = nodeAtByte(landAt);
      if (!landOn(at)) {
        note.append(...ctx.t('conv.doc.landedNowhere'));
        return;
      }
      refreshMarks();
      // The FIRST mark at the byte the address named — the one holding the
      // point's own id, which is the one the address was composed from.
      const anchor = (anchorsHere.get(nodes[at].o) ?? [])[0];
      if (anchor === undefined) {
        note.append(...ctx.t('conv.doc.landedUnmarked'));
        return;
      }
      note.append(...ctx.t('conv.doc.landed'));
      const named = el('bdi', 'tvlandedlabel');
      named.textContent = anchor.label;
      note.append(' ', named);
    })();
  } else {
    void loadAnchors().then(refreshMarks);
  }

  /* ── A MARKED PASSAGE, AND THE THREE THINGS IT CAN BECOME ───────────────
   *
   * `TASK-a-selected-passage-copies-as-something-a-terminal-will`.
   *
   * ── THE HARD PART, WHICH THE ITEM NAMES AND WHICH IS SOLVED HERE ───────
   *
   * *"A browser selection is a DOM range, and the clipboard must be filled
   * from the RECORD range it corresponds to. In a VIRTUALISED document the
   * rows around the selection may not even be in the DOM."*
   *
   * **The item says this is the same anchor problem as `seq:15`'s cursor
   * return and that the two should be solved once. They could not be.**
   * `seq:15` solved its half by DELETING it — a lane opens in a NEW TAB, so
   * the document is never unmounted and no position is ever restored. That
   * answer is not available here: a selection genuinely spans records, and
   * they genuinely have to be mapped. Nothing below is reused from it.
   *
   * **What makes it tractable is one observation.** A selection's two
   * ENDPOINTS are DOM positions by definition, so they are always in the DOM —
   * it is only the MIDDLE that can be missing. So the DOM is asked for the two
   * ends and for nothing else, and the middle is filled from the RECORD, by
   * node index, from the same endpoint the scroll already uses. The mapping
   * therefore costs one round trip per `FETCH_PAGE` sections that are not
   * already cached, and nothing at all for a passage the reader can see.
   *
   * That also makes the DOM's own order irrelevant: the span is `min`/`max` of
   * `data-n`, never first-in-the-range and last-in-the-range. `paint` now
   * keeps the two orders equal anyway, for the sake of the highlight the
   * reader sees while dragging, but this code does not depend on it.
   *
   * ── AND NOT ONE LINE OF IT MOVES THE READER ────────────────────────────
   *
   * `stickUntil` has exactly three setters, all of them the reader consenting
   * to be at the end, and copying adds none. Nothing here writes `scrollTop`,
   * nothing here calls `paint`, and `passageBodies` deliberately does NOT
   * reuse `fetchFrom` — which repaints on arrival — precisely so that filling
   * a passage cannot move a document somebody is reading.
   */

  /** The row a selection endpoint sits in, or `null` if it is outside the well. */
  const rowOf = (node) => {
    const start = node === null || node === undefined ? null
      : (node.nodeType === 3 ? node.parentElement : node);
    if (start === null || typeof start.closest !== 'function') return null;
    const row = start.closest('.tvrow');
    return row !== null && inner.contains(row) ? row : null;
  };

  /**
   * The node indices the reader has marked.
   *
   * Three answers, and the difference between two of them is load-bearing:
   *   - `null`   there is no usable selection at all (none, or collapsed).
   *              The remembered passage is KEPT — see `onSelect`.
   *   - `[]`     there is a real selection and none of it is in the well.
   *   - indices  the sections it covers, ascending, in DOCUMENT order.
   *
   * **The span is taken over `view` and not over `nodes`.** With a filter
   * typed, the sections between the two ends include ones the filter is
   * hiding, and the reader did not mark those — they are not on the screen. A
   * copy that swept them in would be filled from the record with content the
   * reader never saw, which is the mirror image of the defect this feature
   * exists to fix.
   */
  const passageSpan = () => {
    const selection = document.getSelection();
    if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;
    let lowest = Infinity;
    let highest = -Infinity;
    for (const [nodeIndex, row] of live) {
      let touched = false;
      try { touched = selection.containsNode(row, true); } catch { touched = false; }
      if (!touched) continue;
      if (nodeIndex < lowest) lowest = nodeIndex;
      if (nodeIndex > highest) highest = nodeIndex;
    }
    // `containsNode` is not in every engine, and a selection that starts in a
    // row and ends past the end of the well contains no whole row at all. The
    // two ENDS always answer, so they are the fallback rather than the
    // primary: a passage of one partly-marked row is still a passage.
    if (highest < 0) {
      const range = selection.getRangeAt(0);
      for (const end of [range.startContainer, range.endContainer]) {
        const row = rowOf(end);
        if (row === null) continue;
        const nodeIndex = Number(row.dataset.n);
        if (!Number.isInteger(nodeIndex)) continue;
        if (nodeIndex < lowest) lowest = nodeIndex;
        if (nodeIndex > highest) highest = nodeIndex;
      }
    }
    if (highest < 0) return [];
    return view.slice(viewFrom(lowest), viewFrom(highest + 1));
  };

  /** The passage the reader marked, or `null`. Node indices, ascending. */
  let marked = null;
  const copyButtons = [copyMessage, copySeen, copyRaw];
  const armCopy = (on) => { for (const button of copyButtons) button.disabled = !on; };
  armCopy(false);

  /**
   * **A CLICK ON A BUTTON CLEARS THE SELECTION BEFORE THE CLICK ARRIVES.**
   *
   * `mousedown` on a control collapses the caret, so `selectionchange` fires
   * with nothing selected and the button would disable itself out from under
   * the finger already pressing it. Two things answer that, and both are
   * needed: the buttons refuse the default on `mousedown`, which keeps the
   * marked text highlighted and is what makes the RENDERED form possible at
   * all; and a collapsed selection here is treated as "nothing changed" rather
   * than as "nothing is marked", so the passage survives a stray click.
   *
   * A real selection made somewhere ELSE does clear it, because that is a
   * reader marking something else.
   */
  const onSelect = () => {
    if (!scroll.isConnected) {
      document.removeEventListener('selectionchange', onSelect);
      return;
    }
    const span = passageSpan();
    if (span === null) return;
    marked = span.length === 0 ? null : span;
    armCopy(marked !== null);
    // The two rows the selection BEGINS AND ENDS IN stop being evictable, so a
    // drag that auto-scrolls the well cannot narrow the passage under the
    // reader. `schedule` lets the next paint drop whatever this stopped
    // holding — see `held` for why it is the ends and not the whole passage.
    held.clear();
    for (const nodeIndex of boundaryRows()) held.add(nodeIndex);
    schedule();
    // **THE RULED HALF OF `Ctrl+C`.** The records behind the mark are read NOW,
    // so that the synchronous `copy` handler already has them — see `onCopy`.
    schedulePrefetch();
  };
  document.addEventListener('selectionchange', onSelect);
  for (const button of copyButtons) {
    button.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

  /* ══ THE OTHER TWO ROUTES TO EVERY ACTION ═════════════════════════════════
   *
   * **`TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so`**, owner
   * request 2026-09-15, after using the navigation the day it shipped: *"when
   * a user is brousing in the viewer he can not see the buttons so we have to
   * find solutions like right mouse button, a popup window, keboard
   * shortcuts."*
   *
   * The defect is narrow and real: the controls are correct and they are not
   * WHERE HE IS. A reader thirty screens into a transcript has scrolled the
   * bar off the top, so one click becomes a scroll up, a click and a scroll
   * back — per action, on a surface whose whole purpose is to keep reading.
   *
   * ── THE RULING IS "ALSO", NOT "ONLY", AND THE BUTTONS STAY ──────────────
   *
   * A right-click-only action is INVISIBLE — nothing on the screen says it
   * exists, which is `D58` (*the UI is present and changes nothing*) arriving
   * from the other side: not a control that does nothing, but a capability
   * with no control. So three routes, each with a job the others do badly, in
   * the item's own words:
   *
   *   THE BUTTON      tells a reader the capability exists. It is how you
   *                   learn — and it is untouched here except that it now
   *                   SAYS its key.
   *   THE KEYBOARD    is for someone who already knows. It is how you go fast.
   *   THE RIGHT-CLICK acts ON THE TURN UNDER THE CURSOR, which is the one job
   *                   neither of the others does at all.
   *
   * ── AND NEITHER NEW ROUTE REIMPLEMENTS ANYTHING ────────────────────────
   *
   * Every menu item and every shortcut ends in `.click()` on the REAL control,
   * or in the same `step()` the buttons call. There is no second write path,
   * no second announcement and no second focus rule, so nothing here can
   * disagree with the button beside it — which is the failure two routes to
   * one act invite and the reason the three copies, the stepper and the mark
   * bar were each built as one implementation in the first place.
   */

  /**
   * **THE BINDINGS ARE BY `event.code`, NOT BY `event.key`, AND THAT IS A BIDI
   * DECISION** — the same one `.tvnav` made when it refused arrow glyphs.
   *
   * Half this archive is Hebrew and so is half its owner's typing. On a Hebrew
   * layout the key under `M` reports `event.key === 'צ'`, so a table keyed on
   * `key` binds the shortcuts for a Latin keyboard and silently unbinds them
   * for the reader this product is actually for. `event.code` is the PHYSICAL
   * key and is layout-independent, so the same finger lands on the same action
   * in both languages.
   */
  const keyOf = (action) => DOC_SHORTCUTS.find((binding) => binding.action === action);

  /**
   * **INERT INSIDE A FIELD, AND IT IS ASSERTED RATHER THAN ASSUMED** — the
   * item's first constraint, in its own words: *"a shortcut that fires while a
   * field has focus eats the keystroke."*
   *
   * This screen has a find box, a rename box on every marked turn, a kind
   * `<select>` and a note `<textarea>`; typing the word "mark" into any of
   * them would otherwise step the document four times and mark a turn. The
   * `<select>` is in the list because its own keys are letters — a reader
   * picking `defect` by typing `d` must not also fire whatever `d` becomes.
   */
  const inField = (node) => {
    if (node === null || node === undefined || typeof node.tagName !== 'string') return false;
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return node.isContentEditable === true;
  };

  /**
   * The turn a keyboard act applies to: the row the caret is in, or — when the
   * caret is nowhere in the well, which is the ordinary case for a reader who
   * has been scrolling — the row at the top of the viewport.
   *
   * `hereNode` is reused rather than re-derived for the reason the stepper
   * gives where it is defined: it already nudges past the rounding that makes
   * `scrollTop` answer one row early.
   */
  const rowUnderCaret = () => {
    const row = rowOf(document.activeElement);
    if (row !== null) {
      const at = Number(row.dataset.n);
      if (Number.isInteger(at)) return at;
    }
    return hereNode();
  };

  /** The row's own write control — mark if it is unmarked, rename if it is. */
  const rowWriteControl = (nodeIndex) => {
    const row = live.get(nodeIndex);
    if (row === undefined) return null;
    return row.querySelector('.tvanchormark') ?? row.querySelector('.tvanchorrename');
  };

  /* ── THE MENU ──────────────────────────────────────────────────────────
   *
   * **MOUNTED OUTSIDE THE WELL**, for `.tvnavsaid`'s measured reason one
   * control along: rows are evicted the moment they leave the window, and a
   * menu drawn on the row it acts on would be destroyed by the paint that
   * follows the act. It is `position:fixed`, so it is placed against the
   * viewport rather than against a scroll that is about to move.
   */
  const menu = el('div', 'tvmenu');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', ctx.tFlat('conv.menu.region'));
  menu.hidden = true;
  host.append(menu);

  /** Where the caret was when the menu opened. `confirm/1`'s 47 tab stops. */
  let menuFrom = null;
  const menuIsOpen = () => menu.hidden === false;

  /**
   * Shut it.
   *
   * `restore` is the difference between the two dismissals and it is the rule
   * `closePopovers` already states in this app, applied here for the same
   * reason: **Escape is a keyboard gesture and must hand the caret back**,
   * while a click outside has already put the caret where the reader aimed and
   * yanking it away would be the screen overruling them.
   */
  const closeMenu = (restore) => {
    if (!menuIsOpen()) return null;
    const back = menuFrom;
    menuFrom = null;
    menu.hidden = true;
    menu.replaceChildren();
    document.removeEventListener('pointerdown', onOutsideMenu, true);
    if (restore && back !== null && back.isConnected) back.focus();
    return back;
  };

  /**
   * **THE CARET IS NEVER LEFT ON THE BODY**, which is the half of the focus
   * rule that actually bites.
   *
   * The menu's items are where the caret is while it is open, and shutting it
   * removes them — so unless something else takes focus in the same turn, the
   * browser drops it to `document.body` and the reader is back at the top of
   * the page. `TASK-every-write-on-conversations-throws-focus-to-the-document`
   * measured that at 47 tab stops on this very screen.
   *
   * So: whatever route closed the menu, if nothing took the caret, it goes
   * back where it came from. A click that landed on a real control keeps it.
   */
  const caretHome = (back) => {
    if (back === null || !back.isConnected) return;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    back.focus();
  };

  function onOutsideMenu(event) {
    if (menu.contains(event.target)) return;
    const back = closeMenu(false);
    // `pointerdown` fires BEFORE focus moves, so where the click landed is not
    // known yet. Asked one turn later, when it is.
    setTimeout(() => { caretHome(back); }, 0);
  }

  /**
   * One row of the menu.
   *
   * **The key is written beside the action**, which is the teaching half of
   * the item: a reader who reaches an action by right-clicking learns the
   * faster route by reading the row they just used. `aria-hidden` on the chip
   * and `aria-keyshortcuts` on the control, so it is announced as a shortcut
   * rather than read as part of the name.
   */
  const menuItem = (label, binding, run) => {
    const item = el('button', 'tvmenuitem');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.append(...label);
    if (binding !== undefined && binding !== null) {
      item.setAttribute('aria-keyshortcuts', binding.show);
      const chip = el('span', 'm tvkey', binding.show);
      chip.setAttribute('aria-hidden', 'true');
      item.append(' ', chip);
    }
    item.addEventListener('click', () => {
      // **SHUT FIRST, ACT SECOND.** A `.click()` on the real control may open
      // a box and take the caret; doing that under an open menu would leave
      // two things claiming the focus, and shutting afterwards would then take
      // the caret back off the field the reader is meant to be typing in.
      const back = closeMenu(false);
      run();
      caretHome(back);
    });
    return item;
  };

  /**
   * Draw the menu for one row and place it at a point.
   *
   * **WHAT IS ON IT IS WHAT THAT ROW CAN ACTUALLY DO.** The row's own controls
   * are looked up and offered only where they exist, so an unmarked turn
   * offers "Mark this point" and a marked one offers Rename and Take it back —
   * `markControl`'s three states, read rather than re-derived. A menu that
   * listed all four would be four items of which two do nothing, which is the
   * defect this whole item is a case of.
   */
  const openMenu = (nodeIndex, x, y) => {
    closeMenu(false);
    const active = document.activeElement;
    menuFrom = active !== null && active !== document.body ? active : null;
    menu.replaceChildren();

    const row = live.get(nodeIndex);
    const marker = row === undefined ? null : row.querySelector('.tvanchormark');
    const renamer = row === undefined ? null : row.querySelector('.tvanchorrename');
    const dropper = row === undefined ? null : row.querySelector('.tvanchordrop');
    const backer = row === undefined ? null : row.querySelector('.tvanchorputback');
    if (marker !== null) {
      menu.append(menuItem(ctx.t('conv.doc.mark'), keyOf('write'), () => { marker.click(); }));
    }
    if (renamer !== null) {
      menu.append(menuItem(ctx.t('conv.anchors.relabel'), keyOf('write'),
        () => { renamer.click(); }));
    }
    if (dropper !== null) {
      // **NO KEY, AND THAT IS DELIBERATE.** A take-back has no confirm by
      // owner ruling, so a single letter would destroy a bookmark on a
      // mistyped keystroke with nothing between the two. It keeps its button
      // and gains the menu; it does not gain a bare key.
      menu.append(menuItem(ctx.t('conv.anchors.drop'), null, () => { dropper.click(); }));
    }
    if (backer !== null) {
      menu.append(menuItem(ctx.t('conv.anchors.putBack'), null, () => { backer.click(); }));
    }
    menu.append(menuItem(ctx.t('conv.nav.markPrev'), keyOf('markPrev'),
      () => { step('mark', false); }));
    menu.append(menuItem(ctx.t('conv.nav.markNext'), keyOf('markNext'),
      () => { step('mark', true); }));
    menu.append(menuItem(ctx.t('conv.nav.youPrev'), keyOf('youPrev'),
      () => { step('you', false); }));
    menu.append(menuItem(ctx.t('conv.nav.youNext'), keyOf('youNext'),
      () => { step('you', true); }));
    menu.append(menuItem(ctx.t('conv.doc.filter'), keyOf('find'), () => {
      find.focus();
      find.select();
    }));

    /**
     * **THE MARK FILTER, IN THE MENU, AND IT IS A STATE RATHER THAN AN ACT.**
     *
     * The owner asked for it here because the `<select>` lives on the nav bar
     * and the menu opens where he is reading — so from the menu he could step
     * through marks without being able to see, or change, WHICH KIND he was
     * stepping through. Every other row in this menu answers "what can I do
     * to this turn"; these answer "what am I walking", which is why they are
     * `menuitemradio` and carry a checked state.
     *
     * **They set the real `<select>` and dispatch its own `change`**, so the
     * filter still has exactly one code path, one `markKind`, one walk and
     * one cursor — `anchors/6` put the filter inside `markStops` for that
     * reason and a second route must not become a second mechanism. It is
     * the same discipline as every other row ending in `.click()` on the
     * control it names.
     *
     * Drawn only when there is a choice to make: a document whose marks are
     * all one kind gets one option and no rows, because a radio group of one
     * is a statement, not a choice.
     */
    const kindOptions = [...kindPick.options];
    if (kindOptions.length > 1) {
      const head = el('p', 'small tvmenuhead');
      head.append(...ctx.t('conv.menu.kinds'));
      // **AND THE HEADING TEACHES THE KEY**, which is the `.tvkey` chip's whole
      // stated job one section along: *"the discovery path teaches the fast
      // path."* It goes on the HEADING and not on each radio, because `K` does
      // not select the row it would sit beside — it steps to the NEXT kind,
      // which is a fact about the group rather than about any member of it.
      // `aria-hidden`, so the heading's own words are what is announced, and
      // the `<select>` on the bar carries the `aria-keyshortcuts` that a screen
      // reader announces AS a shortcut.
      const headKey = el('span', 'm tvkey', keyOf('kindNext').show);
      headKey.setAttribute('aria-hidden', 'true');
      head.append(' ', headKey);
      menu.append(head);
      for (const option of kindOptions) {
        const chosen = option.value === kindPick.value;
        const pick = el('button', 'tvmenuitem');
        pick.type = 'button';
        pick.setAttribute('role', 'menuitemradio');
        pick.setAttribute('aria-checked', chosen ? 'true' : 'false');
        pick.append(option.textContent);
        if (chosen) {
          // Colour is never the only carrier, and neither is `aria-checked`:
          // the tick is what a reader SEES, and it is `aria-hidden` so the
          // accessible name stays the kind's own word.
          const tick = el('span', 'm tvmenutick', '\u2713');
          tick.setAttribute('aria-hidden', 'true');
          pick.append(' ', tick);
        }
        pick.addEventListener('click', () => {
          const back = closeMenu(false);
          kindPick.value = option.value;
          kindPick.dispatchEvent(new Event('change'));
          caretHome(back);
        });
        menu.append(pick);
      }
    }

    menu.hidden = false;
    /*
     * **PLACED IN LOGICAL PROPERTIES, WITH THE POINTER'S PHYSICAL X CONVERTED
     * ONCE.** `parts.js` forbids a `style=` attribute (CSP) and this app writes
     * geometry through CSSOM in logical properties only. A pointer, though,
     * answers in PHYSICAL pixels from the left — so in a Hebrew page, where
     * `inset-inline-start` is measured from the RIGHT edge, the number has to
     * be reflected or the menu opens on the opposite side of the screen from
     * the cursor. Clamped both ways so it cannot open off the edge.
     */
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const start = rtl ? vw - x : x;
    menu.style.setProperty('inset-inline-start',
      `${Math.round(Math.max(0, Math.min(start, vw - menu.offsetWidth)))}px`);
    menu.style.setProperty('inset-block-start',
      `${Math.round(Math.max(0, Math.min(y, vh - menu.offsetHeight)))}px`);
    /*
     * **FOCUS MOVES IN.** A dialog that opens without taking focus strands a
     * keyboard user — `installPopovers` says it in those words — and it is
     * worse here, because the whole point of this menu is to be reachable
     * without a mouse.
     */
    menu.querySelector('.tvmenuitem')?.focus();
    document.addEventListener('pointerdown', onOutsideMenu, true);
  };

  /**
   * ── ESCAPE, AND WHY THIS IS NOT THE THIRD MEANING THE ITEM FORBIDS ──────
   *
   * The item is explicit that Escape is spoken for twice and *"is not
   * available"*: `app.js` closes the item pane with it, and `confirm/5` bound
   * it on the rename box with `stopPropagation` so the document-level listener
   * never sees it. What is forbidden is a THIRD MEANING — Escape standing for
   * some action of this screen's own.
   *
   * This is not that. It is the SAME meaning the two existing bindings already
   * have — *dismiss the innermost open thing, one level per press* — extended
   * to one more innermost thing, with the identical `stopPropagation` guard
   * `confirm/5` established so that the pane behind it is untouched. A menu
   * that could not be dismissed with Escape would be a keyboard trap, which is
   * the defect one layer below the one this item is about.
   *
   * It is measured rather than argued: the browser suite presses Escape with
   * the menu shut and asserts the rename box and the item pane still answer to
   * it exactly as before.
   */
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('.tvmenuitem')];
    const at = items.indexOf(document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      if (items.length === 0) return;
      const step1 = event.key === 'ArrowDown' ? 1 : -1;
      const next = (at + step1 + items.length) % items.length;
      items[next].focus();
      return;
    }
    if (event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();
    if (items.length === 0) return;
    (event.key === 'Home' ? items[0] : items[items.length - 1]).focus();
  });

  /**
   * ── SUPPRESSING THE NATIVE MENU, AND THE FOUR PLACES THIS REFUSES TO ────
   *
   * The item's third constraint: *"Suppressing the native menu costs the
   * reader copy, open-in-new-tab and inspect. Suppress it only over the
   * elements where this screen genuinely has actions, and leave it alone
   * everywhere else."* So the browser keeps its menu:
   *
   *   — anywhere that is not a row of this document,
   *   — inside a field, where the native menu is cut/copy/paste and there is
   *     no version of this screen's menu that replaces it,
   *   — over a link, where it is open-in-new-tab, and this document draws
   *     lane links on the turns that dispatched them,
   *   — **and over a live SELECTION**, which is the one worth spelling out:
   *     the three copy controls in the bar exist precisely for a marked
   *     passage, so a reader who has just dragged across a turn and
   *     right-clicked means Copy. Taking that gesture to offer them a bookmark
   *     would be the feature stealing the gesture it was built beside.
   */
  scroll.addEventListener('contextmenu', (event) => {
    if (inField(event.target)) return;
    const row = rowOf(event.target);
    if (row === null) return;
    if (typeof event.target.closest === 'function' && event.target.closest('a') !== null) return;
    const selection = document.getSelection();
    if (selection !== null && selection.rangeCount > 0 && !selection.isCollapsed) return;
    const at = Number(row.dataset.n);
    if (!Number.isInteger(at)) return;
    event.preventDefault();
    openMenu(at, event.clientX, event.clientY);
  });

  /** What one binding does. One line each, and every line ends in a control. */
  const runShortcut = (action) => {
    if (action === 'find') { find.focus(); find.select(); return; }
    if (action === 'markPrev') { step('mark', false); return; }
    if (action === 'markNext') { step('mark', true); return; }
    if (action === 'youPrev') { step('you', false); return; }
    if (action === 'youNext') { step('you', true); return; }
    if (action === 'kindNext') { cycleKind(1); return; }
    if (action === 'kindPrev') { cycleKind(-1); return; }
    const control = rowWriteControl(rowUnderCaret());
    // **A ROW THAT IS NOT THERE IS SAID, NOT SWALLOWED.** It happens on a
    // document filtered to nothing, and a key that silently did nothing would
    // be indistinguishable from a key that is not bound.
    if (control === null) { sayNav('conv.menu.noRow'); return; }
    control.click();
  };

  /**
   * The keyboard route, on `document` rather than on the well.
   *
   * It has to be: the reader this item is about has been scrolling with the
   * wheel, so the caret is on `document.body` and a listener on the well would
   * never fire. The three guards above it are what make a document-level
   * listener legitimate — a modifier is the browser's, a field is the
   * reader's, and an open menu owns its own keys.
   */
  const onDocKey = (event) => {
    // The well outlives nothing: a re-render replaces it without the hash
    // moving, which `onLeave` cannot see. Same guard, same reason, as
    // `onSelect` two screens up.
    if (!scroll.isConnected) { document.removeEventListener('keydown', onDocKey); return; }
    if (event.defaultPrevented || menuIsOpen()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (inField(event.target)) return;
    // **THE MOUSELESS ROUTE TO THE MENU** — the item's fourth constraint. Both
    // gestures a browser already sends for it are honoured: the dedicated
    // context-menu key, and Shift+F10.
    if (event.key === 'ContextMenu' || (event.shiftKey && event.code === 'F10')) {
      const at = rowUnderCaret();
      const row = live.get(at);
      const box = (row ?? scroll).getBoundingClientRect();
      event.preventDefault();
      openMenu(at, Math.round(box.left + 8), Math.round(box.top + 8));
      return;
    }
    const binding = DOC_SHORTCUTS.find(
      (k) => k.code === event.code && k.shift === event.shiftKey);
    if (binding === undefined) return;
    event.preventDefault();
    runShortcut(binding.action);
  };
  document.addEventListener('keydown', onDocKey);

  shortcutOn(ctx, find, 'find');
  shortcutOn(ctx, markPrev, 'markPrev');
  shortcutOn(ctx, markNext, 'markNext');
  shortcutOn(ctx, youPrev, 'youPrev');
  shortcutOn(ctx, youNext, 'youNext');

  /**
   * **AND THE ROUTE NO BUTTON CAN TEACH GETS ONE SENTENCE.**
   *
   * The key on a button teaches the key. Nothing on the screen can teach a
   * gesture that has no control — which is the item's own argument for why a
   * right-click-only action is `D58` from the other side — so the right-click
   * and its keyboard equivalent are said once, in a line under the bar, where
   * a reader is already looking for what this document can do.
   *
   * Placed before `navSaid` so it sits under the stepper rather than after the
   * region a step announces into: a static instruction between a reader and a
   * live sentence is a line they learn to skip.
   */
  const menuHint = el('p', 'small tvnote tvmenuhint');
  menuHint.append(...ctx.t('conv.menu.hint'));
  host.insertBefore(menuHint, navSaid);

  const say = (key, subs = {}) => {
    copied.replaceChildren();
    copied.append(...ctx.t(key, subs));
  };
  const alsoSay = (key, subs = {}) => { copied.append(' ', ...ctx.t(key, subs)); };

  /**
   * Which sections have a fold the reader has OPENED.
   *
   * A `work` row IS the `<details>`; a `said` row may hold one for the
   * thinking beside it. Either way a node has at most one, so one boolean per
   * node is the whole state — and a node that is not drawn has none, which is
   * the same answer the screen would give if it were drawn, because a fold
   * opens closed.
   */
  const openFolds = () => {
    const open = new Set();
    for (const [nodeIndex, row] of live) {
      const fold = row.tagName === 'DETAILS' ? row : row.querySelector('details');
      if (fold !== null && fold.open === true) open.add(nodeIndex);
    }
    return open;
  };

  /**
   * The bodies for a passage, fetching whatever is not already cached.
   *
   * **It does not call `paint`, and that is not an oversight.** `fetchFrom`
   * repaints when a window arrives, which is right for a window the reader is
   * looking at and wrong for one being read behind their back: a repaint
   * re-measures, re-sums and moves rows, which would destroy the very
   * selection this is filling. `bodies` is the shared cache either way, so a
   * passage that is fetched here is on screen for free when it is scrolled to.
   */
  const passageBodies = async (indices) => {
    const out = [];
    for (let i = 0; i < indices.length; i += 1) {
      const nodeIndex = indices[i];
      if (!bodies.has(nodeIndex)) {
        const node = nodes[nodeIndex];
        const got = await ctx.api(
          `/api/conversations/${encodeURIComponent(outline.sessionId)}/nodes`
          + `?at=${node.o}&from=${node.f}&node=${node.n}&count=${FETCH_PAGE}`);
        for (const body of got.nodes ?? []) bodies.set(body.n, body);
        // The file was replaced under the read. Answered as a refusal rather
        // than as a passage with a hole in it.
        if (!bodies.has(nodeIndex)) return null;
      }
      out.push(bodies.get(nodeIndex));
    }
    return out;
  };

  /**
   * Put the text on the clipboard, and say honestly whether it went.
   *
   * `navigator.clipboard` is not everywhere: it wants a secure context, and a
   * headless engine may refuse the permission outright. So the payload is
   * written into `clip` FIRST — it is the text the page would put on the
   * clipboard, it is in the document either way, and the `execCommand`
   * fallback needs something in the document to select. A refusal returns
   * `false` and is SAID, never swallowed into a button that looks like it
   * worked.
   */
  const toClipboard = async (text) => {
    clip.textContent = text;
    try {
      if (navigator.clipboard !== undefined
        && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* the older path below is the answer, not a failure */ }
    try {
      const selection = document.getSelection();
      const kept = selection !== null && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange() : null;
      clip.hidden = false;
      const range = document.createRange();
      range.selectNodeContents(clip);
      selection.removeAllRanges();
      selection.addRange(range);
      const wrote = document.execCommand('copy');
      selection.removeAllRanges();
      // The reader's own marked passage is put back. Nothing has moved in
      // between — no repaint, no scroll — so the range is still valid.
      if (kept !== null) selection.addRange(kept);
      clip.hidden = true;
      return wrote === true;
    } catch {
      clip.hidden = true;
      return false;
    }
  };

  /** How many records the passage covers, as the numbers every surface counts in. */
  const recordSpan = (indices) => {
    const first = nodes[indices[0]];
    const last = nodes[indices[indices.length - 1]];
    return { from: first.f, to: last.f + last.s - 1 };
  };

  /**
   * MESSAGE TEXT for a passage whose bodies are already in hand, and the
   * sentence that discloses whatever the payload could not carry.
   *
   * **It takes the bodies rather than fetching them, and that is what makes
   * `Ctrl+C` possible at all.** The `copy` event is SYNCHRONOUS —
   * `clipboardData.setData` must be called before the handler returns — so the
   * key path cannot await anything. Splitting the build out from the fetch is
   * how the button and the key produce THE SAME BYTES from the same code
   * rather than two spellings of one format.
   */
  const messageForm = (list) => {
    const built = messagePassage(list, openFolds(), passageLabels(ctx));
    return {
      text: built.text,
      extra: () => {
        if (built.notes.shutFolds === 1) {
          alsoSay('conv.copy.leftFolds1', { n: built.notes.shutRecords });
        } else if (built.notes.shutFolds > 1) {
          alsoSay('conv.copy.leftFolds', {
            n: built.notes.shutRecords, folds: built.notes.shutFolds,
          });
        }
        if (built.notes.dropped.length > 0) {
          alsoSay('conv.copy.leftArgs', { names: built.notes.dropped.join(', ') });
        }
      },
    };
  };

  /**
   * WHAT IT TOOK, in sections and in the record numbers every surface counts
   * in. Three sentences rather than one with a count substituted into it:
   * "Copied 1 sections" is what one sentence produces for a passage of one,
   * and a fold of five records is a passage of ONE section spanning five, so
   * "record" and "records" are both real cases.
   */
  const sayTook = (passage) => {
    const span = recordSpan(passage);
    if (passage.length > 1) {
      say('conv.copy.took', { n: passage.length, from: span.from, to: span.to });
    } else if (span.from === span.to) {
      say('conv.copy.took1', { from: span.from });
    } else {
      say('conv.copy.took1span', { from: span.from, to: span.to });
    }
  };

  let copying = false;

  /**
   * ONE OF THE THREE COPIES.
   *
   *   `message`  the record's text, no envelope and no presentation layer.
   *              THE DEFAULT, and the only one that can reach the whole
   *              passage, because it is filled from the record.
   *   `seen`     the browser's OWN text for what is on screen. Not
   *              reimplemented here: `Selection.toString()` is what the
   *              browser would have put on the clipboard, and any serializer
   *              written in this file would be an imitation of it that differs
   *              in exactly the invisible ways the item is about. It stops at
   *              the DOM, and says so — you cannot see what is not drawn.
   *              **And that — not hidden characters — is the reason the item's
   *              ruling holds.**
   *              `NOTE-the-dom-selection-was-measured-and-it-carries-no-bidi`
   *              has the measurement: on the Hebrew page, over the owner's own
   *              transcript, the browser's selection carried no bidi control
   *              character on any of fourteen sampled rows. Do not repeat the
   *              "invisible characters" argument; repeat this one.
   *   `raw`      a BYTE SLICE of the transcript. The server's, and exact by
   *              construction rather than by care. It carries the record's
   *              ENVELOPE as well as its text —
   *              `TASK-the-raw-record-copy-serves-envelope-fields-the-screen-never`
   *              is where that is filed.
   */
  const copy = async (form) => {
    if (copying) return;
    if (marked === null || marked.length === 0) { say('conv.copy.empty'); return; }
    if (marked.length > PASSAGE_NODE_CAP) {
      say('conv.copy.tooMany', { n: marked.length, cap: PASSAGE_NODE_CAP });
      return;
    }
    const passage = marked;
    copying = true;
    armCopy(false);
    try {
      say('conv.copy.working');
      let text = null;
      let extra = null;

      if (form === 'seen') {
        const selection = document.getSelection();
        const shown = selection === null || selection.rangeCount === 0
          ? '' : selection.toString();
        if (shown === '') { say('conv.copy.empty'); return; }
        // **IT SAYS WHAT IT IS, IN THE PAYLOAD.** The item requires the
        // rendered form to declare itself, and the payload is the only place
        // that travels with the text into whatever it is pasted into.
        text = `${ctx.tFlat('conv.copy.renderedIs')}\n\n${shown}`;
        const missing = passage.filter((n) => !live.has(n)).length;
        if (missing > 0) {
          extra = () => {
            if (missing === 1) alsoSay('conv.copy.notDrawn1');
            else alsoSay('conv.copy.notDrawn', { n: missing });
          };
        }
      } else if (form === 'raw') {
        const parts = [];
        let bytes = 0;
        for (const run of runsOf(passage)) {
          const at = nodes[run.from].o;
          const next = nodes[run.to + 1];
          const got = await ctx.api(
            `/api/conversations/${encodeURIComponent(outline.sessionId)}/raw`
            + `?at=${at}${next === undefined ? '' : `&to=${next.o}`}`);
          if (got.present === false) { say('conv.copy.noBytes'); return; }
          if (got.tooLong === true) {
            say('conv.copy.tooLong', { bytes: got.wanted, cap: PASSAGE_RAW_CAP });
            return;
          }
          bytes += got.bytes;
          if (bytes > PASSAGE_RAW_CAP) {
            say('conv.copy.tooLong', { bytes, cap: PASSAGE_RAW_CAP });
            return;
          }
          parts.push(got.text);
        }
        text = parts.join('');
      } else {
        const list = await passageBodies(passage);
        if (list === null) { say('conv.copy.noBytes'); return; }
        const form = messageForm(list);
        text = form.text;
        extra = form.extra;
      }

      if (!await toClipboard(text)) { say('conv.copy.refused'); return; }
      sayTook(passage);
      if (extra !== null) extra();
    } catch (error) {
      copied.replaceChildren(errorNote(error.message));
    } finally {
      copying = false;
      armCopy(marked !== null);
    }
  };

  copyMessage.addEventListener('click', () => { void copy('message'); });
  copySeen.addEventListener('click', () => { void copy('seen'); });
  copyRaw.addEventListener('click', () => { void copy('raw'); });

  /* ── Ctrl+C, AND WHY IT SPENDS A REQUEST BEFORE ANYBODY PRESSES IT ──────
   *
   * `TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form`.
   *
   * ── THE DEFECT, AND THE RULING THAT CLOSED IT ──────────────────────
   *
   * The three buttons above shipped without a keyboard shortcut, so a reader
   * who marked a passage and pressed the key they have pressed for thirty
   * years got the BROWSER's copy: speaker names, timestamps, a fold's summary
   * line instead of its records, whitespace as CSS collapsed it — and NOTHING
   * AT ALL from the rows this virtualised document has not drawn.
   *
   * **Owner ruling, 2026-09-10: PRE-FETCH ON SELECTION.** Four shapes were put
   * to him in plain words and he took the first: fill `bodies` for a passage
   * as it is MARKED, so that the `copy` handler already has everything it
   * needs and `Ctrl+C` serves MESSAGE TEXT — the same format the first button
   * serves, which is the default `seq:17` already ruled.
   *
   * **SO THE KEY MEANS ONE THING.** That is why option 1 beat option 2
   * (intercept only when complete, and say which form you got): the item
   * itself argues that a key which sometimes serves the record and sometimes
   * falls through to the browser is the WORST of the three, because one
   * gesture produces two formats with nothing on screen saying which. The
   * ruling removes the ambiguity rather than labelling it. Option 3 (leave it,
   * teach the buttons) and option 4 (fetch on the keypress, which spends
   * nothing until a copy happens but puts the delay INSIDE the gesture) were
   * declined with it and are not to be re-proposed.
   *
   * **AND THIS IS AN AFFORDANCE, NOT A FOURTH FORMAT.** Nothing above changed.
   * The three buttons are untouched and the clipboard formats stay as `seq:17`
   * and this item's parent ruled them; `messageForm` is the one builder both
   * paths call, so the key and the first button cannot drift apart.
   *
   * ── WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER ───────────────
   *
   * Requests the reader did not ask for, on every drag that marks undrawn
   * rows. The item bounds it — 10 requests and 207ms for a 274-section passage
   * on the owner's own transcript — and that is the worst case for a very
   * large mark, not the typical one. Nothing is spent for a passage the reader
   * can see, because `passageBodies` asks only for what `bodies` is missing,
   * and nothing at all above `PASSAGE_NODE_CAP`, where a copy refuses anyway.
   *
   * ── THE THREE THINGS THIS MUST NOT GET WRONG ───────────────────────
   *
   *   1. `bodies` IS NOT MONOTONIC. `refill` deletes the tail node's body when
   *      a partial record is replaced, and `rebuildReplaced` clears the whole
   *      map. So readiness is never remembered: `onCopy` re-reads `bodies` on
   *      every press, and a miss re-arms the pre-fetch rather than trusting a
   *      flag set minutes ago.
   *   2. THE HANDLER STAYS HONEST WHEN THE PRE-FETCH HAS NOT LANDED. It does
   *      NOT fall through to the browser — that is the ambiguity the ruling
   *      deleted — and it does not serve a partial record, which
   *      `INV-nothing-is-dropped-silently` calls worse than the browser's own
   *      because it looks right. It refuses, in the payload AND on the screen,
   *      and says the passage is still being read.
   *   3. IT MOVES NOBODY. `passageBodies` does not repaint, so a pre-fetch
   *      cannot pull the document out from under a reader mid-drag — the same
   *      reason it exists rather than `fetchFrom`.
   */

  /** Node indices of `passage` whose body is not in hand. */
  const missingOf = (passage) => passage.filter((n) => !bodies.has(n));

  let prefetchTimer = null;
  let prefetchBusy = false;
  let prefetchAgain = false;

  /**
   * Fill `bodies` for whatever is marked, once.
   *
   * A run that finishes while the reader is still dragging leaves `marked`
   * wider than the passage it just filled, so `prefetchAgain` runs it once
   * more. Each run either fetches something missing or returns immediately, so
   * the chain terminates.
   */
  const runPrefetch = async () => {
    // A document that has been unmounted keeps whatever it had marked; it must
    // not go on reading records for a screen nobody is looking at, which is the
    // same test `onSelect` uses to take itself off `selectionchange`.
    if (!scroll.isConnected) return;
    if (prefetchBusy) { prefetchAgain = true; return; }
    const passage = marked;
    if (passage === null || passage.length === 0) return;
    // Above the cap a copy REFUSES rather than truncates, so a pre-fetch here
    // would buy the reader nothing and cost the server everything.
    if (passage.length > PASSAGE_NODE_CAP) return;
    if (missingOf(passage).length === 0) return;
    prefetchBusy = true;
    try {
      await passageBodies(passage);
    } catch {
      // A refusal is the KEY's to report, at the moment it is pressed, in the
      // reader's own language. Saying it here would put a sentence on screen
      // about a copy nobody has asked for yet.
    } finally {
      prefetchBusy = false;
      if (prefetchAgain) { prefetchAgain = false; void runPrefetch(); }
    }
  };

  /** Wait for the drag to stop, then fill. See `PREFETCH_SETTLE_MS`. */
  const schedulePrefetch = () => {
    if (prefetchTimer !== null) clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => {
      prefetchTimer = null;
      void runPrefetch();
    }, PREFETCH_SETTLE_MS);
  };

  /**
   * THE KEY. Synchronous from end to end, because the event is.
   *
   * It intercepts only a passage of THIS well: with nothing marked here the
   * event is left entirely alone, so `Ctrl+C` in the filter box, in the head,
   * or over the `clip` element the button path selects behaves as it always
   * did.
   */
  const onCopy = (event) => {
    const passage = marked;
    if (passage === null || passage.length === 0) return;
    // A button copy is mid-flight and owns both the payload and the line.
    if (copying) return;
    const data = event.clipboardData;
    if (data === null || data === undefined) return;

    let text = null;
    let extra = null;
    if (passage.length > PASSAGE_NODE_CAP) {
      text = ctx.tFlat('conv.copy.keyTooMany', { n: passage.length, cap: PASSAGE_NODE_CAP });
      say('conv.copy.tooMany', { n: passage.length, cap: PASSAGE_NODE_CAP });
    } else if (missingOf(passage).length > 0) {
      text = ctx.tFlat('conv.copy.keyNotYet');
      say('conv.copy.keyNotYet');
      // `bodies` may have been emptied under a pre-fetch that already ran, so
      // the miss re-arms it rather than waiting for another `selectionchange`.
      schedulePrefetch();
    } else {
      const form = messageForm(passage.map((n) => bodies.get(n)));
      text = form.text;
      extra = form.extra;
    }

    event.preventDefault();
    // The same element the button path fills, and for the same reason: it is
    // the payload the page put on the clipboard, readable by a suite that
    // cannot reach the OS clipboard.
    clip.textContent = text;
    data.setData('text/plain', text);
    if (extra === null) return;
    sayTook(passage);
    extra();
  };
  scroll.addEventListener('copy', onCopy);

  /* ── FOLLOWING A SESSION THAT IS STILL BEING WRITTEN ────────────────────
   *
   * `plan:archive seq:19`, in the owner's words: "if the session is updated
   * and the browser is opend on the current session, update the browser to so
   * if i am at the end of the file i could see the changes live near real time
   * asap" — amended a minute later to "the same way the web status bar is
   * updated".
   *
   * THE TRANSPORT IS A POLL, NOT A SOCKET, and the amendment is why. The strip
   * is filled by a client timer on `/api/ping`; `/api/watch/stream` exists and
   * is a real SSE feed, but it holds a socket open per tab and the whole
   * `kind: 'stream'` idle carve-out exists to stop that pinning the process
   * alive. `seq:19`: "Do not grow a second long-lived socket for a READ
   * surface when a poll the page already runs will do." One thing is stolen
   * from it and only one — its `resync` discipline: when the tail cannot be
   * trusted, SAY SO rather than showing a hole. That is `conv.doc.replaced`.
   *
   * THE PROBE IS CHEAP AND THE REFILL IS NOT, which is the shape `/api/ping`
   * already states in its own header: "it is cheap enough to be asked on every
   * heartbeat, so the expensive refill happens only on the ticks where the
   * reading actually moved." Here the cheap probe is `/tip` — one `stat()` —
   * and the expensive half is a resumed outline walk that reads the APPENDED
   * BYTES and nothing else, which `iterateTranscript`'s `startByte` has
   * supported since the document was built. On the owner's file that is the
   * difference between reading a few kilobytes and re-reading 67 MB.
   *
   * THE FRESHNESS KEY IS `(bytes, mtimeMs)` — `ConversationIndex`' own, the
   * one the LIST's staleness line already uses. One notion of "the file
   * moved", two readers of it.
   */
  let seenBytes = outline.bytes;
  let seenMtime = outline.mtimeMs;
  /**
   * **THE ANCHOR STORE AS THE LAST TICK FOUND IT** — `"bytes:mtime"`, or
   * `null` for "not compared yet".
   *
   * The owner, 2026-09-16: "i want to see marks as soon as they are created".
   * Before this, `loadAnchors` ran at mount and after the reader's own write,
   * and nothing else ever called it — so the pass could mark the very turn on
   * screen and the page would go on saying `576 marked point(s) here` until
   * it was reloaded. He caught exactly that, three minutes after the per-turn
   * pass marked a table he was looking at.
   *
   * `null` is deliberately NOT a token any comparison can match, so the first
   * tick that carries `marks` adopts it and does not refetch. Adopting it as
   * `''` would make the first tick look like a change and cost every opened
   * document one unpaged anchors fetch it does not need.
   */
  let seenMarks = null;
  /** Nodes appended while the reader was NOT at the tail. */
  let unseen = 0;
  /** A refill is in flight; a second tick must not start another. */
  let asking = false;
  let tipTimer = 0;
  /**
   * When the last tick actually ASKED — the half of the double-fire guard that
   * `onLook` reads. `0` is "never", which is correct on the first look.
   */
  let askedAt = 0;
  /**
   * Remove the look pair this document registered. A no-op until it does —
   * `stopFollowing` is reachable from `stopWith` before the bottom of
   * `mountDocument` runs, and a copy or a truncated document never registers
   * at all.
   *
   * **`LOOK_GAP_MS` IS IMPORTED AND NO LONGER DECLARED HERE** —
   * `plan:archive seq:29`. This screen chose the number and wrote the argument
   * for it; `lib/heartbeat.js` carries both now, and carrying them twice is
   * what that item was filed about. The argument has not changed: one tab
   * switch fires `visibilitychange` and `focus` within the same task, so the
   * gap to swallow is microseconds, and a quarter second is a quarter of
   * `TIP_MS` — a reader who genuinely leaves and returns inside one interval is
   * answered rather than debounced away.
   */
  let detachLook = () => {};

  /**
   * Is the reader at the end of the document?
   *
   * **NOT `scrollTop + clientHeight >= scrollHeight`.** `seq:19` singles that
   * out, and the reason is this document's own arithmetic: every row's height
   * is an ESTIMATE until it has been drawn and measured, so `scroller.total` —
   * which is what `inner`'s height and therefore `scrollHeight` is written
   * from — moves under the reader as rows are measured. A pixel comparison
   * against a number that is still settling answers differently on consecutive
   * frames for a reader who has not moved.
   *
   * So the question is asked about a NODE, the same unit `paint`'s anchor
   * uses: is the LAST row of the view the one the bottom of the viewport lands
   * in? That survives a re-sum, because a node keeps its identity across one.
   */
  const atTail = () => {
    if (view.length === 0) return true;
    const bottom = scroll.scrollTop + (scroll.clientHeight || 600);
    return scroller.at(Math.max(0, bottom - 1)) >= view.length - 1;
  };

  const sayArrived = () => {
    if (unseen <= 0) { arrived.hidden = true; return; }
    toNew.replaceChildren();
    toNew.append(...ctx.t('conv.doc.newBelow', { n: unseen }));
    arrived.hidden = false;
  };

  const stopFollowing = () => {
    if (tipTimer !== 0) { clearInterval(tipTimer); tipTimer = 0; }
    window.removeEventListener('hashchange', onLeave);
    // **THREE LISTENERS ARE ADDED AND THREE ARE REMOVED, and the pair below is
    // the one that would leak.** `hashchange` is on `window` and the look pair
    // is on `document` and `window` — none of them dies with the well, so a
    // reader who opens six conversations in one session would otherwise leave
    // six `onLook` handlers behind and fire all six on the next tab focus.
    // `tick`'s `scroll.isConnected` guard makes each of them harmless, which is
    // exactly why the leak would never be noticed.
    //
    // **AND THE REMOVAL IS THE ONE `attachLook` HANDED BACK**, not two lines
    // that restate the event names. Half a teardown is the same leak with a
    // line of evidence that it was thought about, and the only way to make that
    // unwritable is for the registration and the removal to be one value.
    detachLook();
    detachLook = () => {};
  };

  /**
   * The screen contract has no teardown hook — `watch.js` says so where it
   * solves the same problem — so the router's own event is the signal
   * available. Leaving THIS session is enough: navigating back to the list, to
   * another session or to another screen all change the hash away from this
   * id. The tick below also checks `isConnected`, which covers the case this
   * cannot see: a re-render that replaces the well without the hash moving.
   */
  function onLeave() {
    if (sessionFromHash(location.hash) === outline.sessionId) return;
    stopFollowing();
    // The copy listener is on `document` and does not die with the well
    // either. It is NOT removed in `stopFollowing`, because `stopWith` calls
    // that when a transcript is pruned or replaced — the document stays on
    // screen and readable then, and a reader must still be able to copy what
    // they are looking at. `onSelect`'s own `isConnected` guard removes it in
    // the case this cannot see, exactly as `tick`'s does.
    document.removeEventListener('selectionchange', onSelect);
    /*
     * **THE TWO LISTENERS THE KEYBOARD ROUTE ADDS TO `document`, REMOVED
     * HERE** — `TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so`.
     *
     * `onDocKey` is on `document` by necessity: the reader this route exists
     * for has been scrolling with the wheel, so the caret is on the body and a
     * listener on the well would never fire. Neither of these dies with the
     * well, so a reader who opens six conversations in one session would leave
     * six behind and step six documents on one keystroke. `onDocKey`'s own
     * `isConnected` guard makes each harmless — which is exactly why the leak
     * would never be noticed, the same shape `stopFollowing` records one
     * function up.
     *
     * The menu is SHUT rather than merely unlistened: a `position:fixed`
     * element left visible would float over whatever screen the reader went
     * to, and the caret is handed back on the way out.
     */
    document.removeEventListener('keydown', onDocKey);
    document.removeEventListener('pointerdown', onOutsideMenu, true);
    closeMenu(true);
  }

  /** Say the transcript can no longer be followed, and stop asking. */
  const stopWith = (key) => {
    stopFollowing();
    follows.replaceChildren();
    follows.classList.add('tvwarn');
    follows.append(...ctx.t(key));
  };

  /**
   * The file grew. Read the tail and splice it on.
   *
   * **The LAST node is re-asked for, not skipped past.** It may have been an
   * open `work` run that the append extended — a run of three that is now a
   * run of seven — so it is rebuilt and replaced, and its cached body and
   * measured height go with it. Asking for the node AFTER it would leave the
   * reader holding a fold that says three for ever.
   */
  const refill = async () => {
    if (asking || nodes.length === 0) return;
    asking = true;
    const last = nodes[nodes.length - 1];
    const following = atTail();
    try {
      const tail = await ctx.api(
        `/api/conversations/${encodeURIComponent(outline.sessionId)}/outline`
        + `?at=${last.o}&from=${last.f}&node=${last.n}`);
      if (!scroll.isConnected) return;
      if (tail.present === false) { stopWith('conv.prunedBody'); return; }
      // **A BIG JUMP IS CAUGHT UP IN STEPS RATHER THAN CLAIMED IN ONE.** A
      // reader who left the tab for an hour comes back to a file that may have
      // grown past `DOCUMENT_WALK_CAP`, and the resumed outline then stops at
      // the cap and says so in `truncated`. Recording `tail.bytes` there would
      // mark the document current at a size it has NOT read to, and the tail
      // between the cap and the end would never be asked for again — a hole,
      // drawn as continuity, which is the one thing this screen's own
      // `conv.doc.replaced` path exists to refuse. `walkedBytes` is how far
      // this tail actually READ, so the next tick sees the file is still ahead
      // and asks for the next stretch from the new last node.
      seenBytes = tail.truncated === true ? tail.walkedBytes : tail.bytes;
      seenMtime = tail.mtimeMs;
      const fresh = tail.nodes ?? [];
      if (fresh.length === 0) return;

      // The replaced node loses its cached body, its measured height and its
      // drawn row — all three describe the node as it was three records ago.
      bodies.delete(last.n);
      known.delete(last.n);
      const stale = live.get(last.n);
      if (stale !== undefined) { stale.remove(); live.delete(last.n); waiting.delete(last.n); }

      const before = nodes.length;
      nodes.length = last.n;
      for (const node of fresh) nodes.push(node);
      // The headline counts are re-derived from the nodes rather than added
      // up: `said` and `work` are counts over the WHOLE document and the tail
      // only knows its own share, and `sum(span) === records` is the
      // invariant a test asserts, so it is computed the same way here.
      outline.said = 0;
      outline.work = 0;
      outline.deed = 0;
      outline.records = 0;
      for (const node of nodes) {
        if (node.k === 'said') outline.said += 1;
        else if (node.k === 'deed') outline.deed += 1;
        else outline.work += 1;
        outline.records += node.s;
      }
      reView();
      if (following) {
        unseen = 0;
        scroll.scrollTop = scroller.total;
        // The next three seconds of paints are pinned to the end: the bodies
        // of the new rows have not been asked for yet, and the measurement
        // that follows them moves `scroller.total` under the reader.
        stickUntil = Date.now() + STICK_MS;
      } else {
        unseen += nodes.length - before;
      }
      sayArrived();
      paint();
    } catch (error) {
      // A refill that will not load SAYS SO, in the one place this screen
      // already draws a window that refused. The timer keeps running: the next
      // tick is five seconds away and a transient refusal must not end the
      // following silently.
      failed.replaceChildren(errorNote(error.message));
      failed.hidden = false;
    } finally {
      asking = false;
    }
  };

  /**
   * **THE FILE WAS REPLACED AND THE READER IS AT THE END, SO IT IS SIMPLY
   * REBUILT** — owner ruling 2026-09-09, on seeing `conv.doc.replaced` and
   * being told to reload: fix it.
   *
   * ── THE DIAGNOSIS WAS RIGHT AND THE REMEDY WAS NOT ──────────────────────
   *
   * `tick`'s shrank branch is correct about the file: a transcript only ever
   * appends, so a smaller one — or the same length with a new `mtime` — is a
   * REWRITE, and every byte offset this document holds now points somewhere
   * else. Saying so was honest. What was wrong is that the only way forward
   * was `F5`, on a screen whose whole purpose is that the reader never has to
   * press it.
   *
   * ── AND `seq:19`'s OWN RULE DECIDES WHO GETS WHICH ANSWER ───────────────
   *
   * *"if i am at the end of the file i could see the changes live near real
   * time asap"* — which binds in both directions, and `atTail()` is the gate
   * the append path already runs through. A reader AT THE TAIL was reading the
   * live end of a file; the live end is what they still get, so the document
   * is rebuilt against the file as it now stands and the following carries on.
   * A reader ABOVE the end keeps today's behaviour exactly: the notice, and
   * the follow stopped. Rebuilding under them would move their place, which is
   * what `TASK-a-refresh-keeps-the-reader-s-place-or-it-asks` forbids and what
   * `seq:19` already refused once for the ordinary append.
   *
   * ── NO CHIP SAYING "REBUILT", DELIBERATELY ──────────────────────────────
   *
   * There is nothing for the reader to decide, and a "rebuilt" mark is a claim
   * that decays — true for a second, then noise. `app.js` makes the same
   * argument for not drawing a "live again" chip when the stream recovers.
   * `conv.doc.replaced` is kept, for the mid-document case only.
   *
   * ── WHAT IS THROWN AWAY, AND WHY EVERY ONE OF THEM HAS TO BE ────────────
   *
   * `bodies`, `known` and `inflight` are all keyed by node index against the
   * OLD file, so a surviving entry would draw one file's text at another
   * file's position — the hole this branch exists to refuse, one layer in.
   * `marked` and `held` go for `applyFilter`'s reason, stated there: a passage
   * marked on a document that no longer exists must not be copyable.
   *
   * A REPLACED FILE THAT IS NOW TOO BIG TO WALK falls back to the notice. The
   * mount path refuses to follow a truncated document at all — it would append
   * the newest records onto a document missing the ones between — so a rebuild
   * that came back `truncated` has nothing to hand a follower, and the reader
   * is owed the reload that gets them the truncation disclosure with it.
   */
  const rebuildReplaced = async () => {
    if (asking) return;
    asking = true;
    try {
      const fresh = await ctx.api(
        `/api/conversations/${encodeURIComponent(outline.sessionId)}/outline`);
      if (!scroll.isConnected) return;
      if (fresh.present === false) { stopWith('conv.prunedBody'); return; }
      if (fresh.truncated === true) { stopWith('conv.doc.replaced'); return; }
      seenBytes = fresh.bytes;
      seenMtime = fresh.mtimeMs;
      bodies.clear();
      known.clear();
      inflight.clear();
      marked = null;
      held.clear();
      armCopy(false);
      nodes.length = 0;
      for (const node of fresh.nodes ?? []) nodes.push(node);
      // Re-derived from the nodes rather than read off the head, which is the
      // spelling `refill` already uses and for its reason: `sum(span) ===
      // records` is an invariant a test asserts, and one arithmetic for it
      // means the two paths cannot disagree.
      outline.said = 0;
      outline.work = 0;
      outline.deed = 0;
      outline.records = 0;
      for (const node of nodes) {
        if (node.k === 'said') outline.said += 1;
        else if (node.k === 'deed') outline.deed += 1;
        else outline.work += 1;
        outline.records += node.s;
      }
      outline.bytes = fresh.bytes;
      outline.mtimeMs = fresh.mtimeMs;
      outline.title = fresh.title;
      outline.titleSource = fresh.titleSource;
      // The name this project gave it, carried over the silent rebuild with
      // the two fields it sits beside — `plan:archive seq:34`. A head that
      // kept the reader's name while re-reading everything around it would be
      // the same staleness this loop exists to prevent, one field over.
      outline.name = fresh.name;
      outline.namedAt = fresh.namedAt;
      outline.branch = fresh.branch;
      fillHead();
      unseen = 0;
      sayArrived();
      // `'end'` for the same reason the mount lands there: this reader WAS at
      // the end, and `redraw` holds them there through the re-sum that follows
      // the first measurements rather than setting a pixel and hoping.
      redraw('end');
    } catch (error) {
      // A rebuild that will not load says so in the one place this screen
      // already draws a window that refused, and the timer keeps running: the
      // next tick is a second away and a transient refusal must not end the
      // following silently. Same shape as `refill`'s own catch.
      failed.replaceChildren(errorNote(error.message));
      failed.hidden = false;
    } finally {
      asking = false;
    }
  };

  /**
   * One tick: has the file moved?
   *
   * Four answers, and each is a state rather than an error.
   *   - gone      the harness pruned the transcript under the reader.
   *   - shrank    it was REPLACED rather than appended to, so every byte
   *               offset on screen now points somewhere else. `seq:19`'s own
   *               rule splits this in two: a reader AT THE TAIL gets the
   *               document rebuilt against the file as it now stands and keeps
   *               following, and a reader above the end gets the `resync`
   *               discipline borrowed from `watch-model.ts` — say the tail
   *               cannot be trusted rather than move them. See
   *               `rebuildReplaced`.
   *   - grew      read the tail.
   *   - unchanged nothing, not even a repaint. `mtimeMs` is still recorded, so
   *               a touch that does not change the size does not read as
   *               growth on the next tick.
   */
  const tick = () => {
    if (!scroll.isConnected) { stopFollowing(); return; }
    // The heartbeat's own rule, imported rather than restated: a tab nobody is
    // looking at stops asking, so a forgotten one cannot hold the server up.
    if (!shouldPing(document.visibilityState)) return;
    askedAt = Date.now();
    ctx.api(`/api/conversations/${encodeURIComponent(outline.sessionId)}/tip`)
      .then((tip) => {
        if (!scroll.isConnected) { stopFollowing(); return; }
        if (tip.present === false) { stopWith('conv.prunedBody'); return; }
        // SHRANK, or the same length with a different mtime. Either way the
        // file on disk is not the file these byte offsets were computed
        // against, and every `o` the outline holds now points somewhere else.
        // A transcript only ever appends, so both are a REPLACEMENT — the
        // index treats a shrink the same way, re-reading the whole file rather
        // than resuming.
        //
        // **AND WHO IS ASKING DECIDES WHAT HAPPENS NEXT**, which is `seq:19`'s
        // own rule and not a new one: the follow moves only the reader who is
        // at the end. At the tail the document is rebuilt against the file as
        // it now stands and the following carries on, with no notice, because
        // there is nothing to decide — the owner's ruling 2026-09-09, after
        // meeting `conv.doc.replaced` and being told to press F5. Above the
        // end, the `resync` discipline borrowed from `watch-model.ts` stands
        // unchanged: say the tail cannot be trusted rather than move a reader
        // who is mid-document. See `rebuildReplaced`.
        if (tip.bytes < seenBytes
          || (tip.bytes === seenBytes && tip.mtimeMs !== seenMtime)) {
          if (atTail()) { void rebuildReplaced(); return; }
          stopWith('conv.doc.replaced');
          return;
        }
        if (tip.bytes > seenBytes) void refill();
        // **A MARK IS ITS OWN KIND OF ARRIVAL, SO IT IS ASKED ABOUT
        // SEPARATELY.** Not folded into the growth branch above, because the
        // two events do not coincide: the per-turn pass runs at the Stop hook
        // and writes its row AFTER the bytes it read are already on disk, so a
        // reader who refetched anchors only when the file grew would fetch
        // them a moment too early and still not see the mark. And a relabel or
        // a take-back moves the store while the transcript does not move at
        // all.
        //
        // `tip.marks === null` is the server saying it COULD NOT LOOK, and it
        // is handled by doing nothing: the token is left as it was, so the
        // next tick that does get an answer compares against the last one this
        // screen actually trusted rather than against a gap.
        if (tip.marks !== null && tip.marks !== undefined) {
          const token = `${tip.marks.bytes}:${tip.marks.mtimeMs}`;
          if (seenMarks === null) seenMarks = token;
          else if (seenMarks !== token) {
            seenMarks = token;
            void loadAnchors().then(refreshMarks);
          }
        }
      })
      .catch(() => {
        // `api()` raises `#exited` itself when the server is gone, which is a
        // global state and not this screen's to restate. A refused probe is
        // simply a tick that learned nothing.
      });
  };

  /**
   * **Looking at the tab is the fastest signal a reader can send, and this is
   * the screen answering it** —
   * `TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send`.
   *
   * Without this the reader who comes back waits for the next SCHEDULED tick,
   * and that is not one interval: browsers throttle a hidden tab's
   * `setInterval` to roughly once a minute, so the wait after a return is a
   * throttled period rather than `TIP_MS`. Coming back to the tab converts
   * that into one round trip.
   *
   * **Both events, because they answer different questions.** A tab switch
   * fires `visibilitychange`; a window RAISED without a tab change fires only
   * `focus`. Registering one of the two leaves half the returns slow, and the
   * half it leaves slow is the one an owner watching a terminal beside a
   * browser actually does.
   *
   * **`shouldPing` is still the gate and it does not move.** `focus` fires on a
   * window whose tab is not the front one, so this asks the same question
   * `tick` asks and stops there when the answer is no: a HIDDEN tab must not
   * ask, which is what `test/ui/viewmodel.test.ts` asserts about the rule in
   * isolation. This makes a VISIBLE tab faster and nothing else.
   *
   * **AND IT MUST NOT DOUBLE-FIRE**, which at 1000 ms is load-bearing rather
   * than tidy. Two guards, and they cover different collisions:
   *   - `askedAt` drops a look-tick that lands within `LOOK_GAP_MS` of the
   *     last ask. This is what stops the PAIR — `visibilitychange` and `focus`
   *     both fire on one tab switch, microseconds apart — from asking twice.
   *   - re-basing the interval is what stops a look-tick colliding with a
   *     SCHEDULED one: after a manual ask the next scheduled ask is a full
   *     `TIP_MS` away rather than whatever was left of the old period.
   *
   * ── WHAT IS SHARED WITH `lib/heartbeat.js` AND WHAT IS NOT ──────────────
   *
   * `plan:archive seq:29`. Shared: `attachLook` registers the pair and hands
   * back the one removal, `shouldPing` is the gate, `LOOK_GAP_MS` is the
   * number. Not shared, and `startLookTicks` is therefore NOT what this uses:
   * that export debounces against its OWN last fire, and this debounces against
   * `askedAt` — which the SCHEDULED `tick` writes too. At `TIP_MS` a look
   * landing 50 ms after a scheduled `/tip` has to be dropped, and a private
   * clock would not know the scheduled ask happened, so one return to the tab
   * would become two requests a quarter-second apart. The other three things
   * this owns are `tipTimer === 0` (a stopped follow has no look), the
   * `scroll.isConnected` teardown, and the interval re-base — none of which a
   * module with no interval and no well can hold.
   */
  function onLook() {
    if (tipTimer === 0) return;
    if (!scroll.isConnected) { stopFollowing(); return; }
    if (!shouldPing(document.visibilityState)) return;
    if (Date.now() - askedAt < LOOK_GAP_MS) return;
    clearInterval(tipTimer);
    tipTimer = setInterval(tick, TIP_MS);
    tick();
  }

  // A reader who scrolls back down to the end has SEEN what arrived, so the
  // affordance goes away on its own rather than needing to be dismissed.
  scroll.addEventListener('scroll', () => {
    if (unseen > 0 && atTail()) { unseen = 0; sayArrived(); }
  }, { passive: true });

  toNew.addEventListener('click', () => {
    unseen = 0;
    sayArrived();
    scroll.scrollTop = scroller.total;
    stickUntil = Date.now() + STICK_MS;
    paint();
  });

  // The reader taking the scroll back ends the pinning at once, so the three
  // seconds above are a ceiling rather than a sentence. `wheel` and `keydown`
  // are the two inputs that are unambiguously theirs — `scroll` itself is not,
  // because `paint` fires it.
  for (const event of ['wheel', 'keydown', 'pointerdown']) {
    scroll.addEventListener(event, () => { stickUntil = 0; }, { passive: true });
  }

  // A document whose walk stopped at `DOCUMENT_WALK_CAP` already ends before
  // the file does, and it says so two lines above. Following it would append
  // the newest records onto a document that is missing the ones in between —
  // a hole, drawn as continuity. So it does not follow, and the note that
  // explains why is the one already on screen.
  //
  // **AND A COPY IS NOT POLLED AT ALL** — `plan:archive seq:5`. The file a
  // copy is read from has nothing writing to it, so a `/tip` every second
  // would be a `stat` per second per open tab asking a question whose answer
  // cannot change. Worse than wasteful: `tick`'s own `shrank` branch treats
  // "same length, different mtime" as a REPLACEMENT and would stop the
  // document with `conv.doc.replaced` if anything ever touched the copy's
  // mtime — a warning about a document that is perfectly intact.
  //
  // The note is NOT hidden here, unlike the truncated branch: a truncated
  // document already carries `conv.doc.truncated` two lines below saying why
  // it does not follow, and a copy has no such second sentence. It keeps the
  // line and changes what it says.
  if (outline.truncated !== true && !isCopy) {
    tipTimer = setInterval(tick, TIP_MS);
    window.addEventListener('hashchange', onLeave);
    // **THE PAIR COMES FROM `lib/heartbeat.js`, WHICH IS THE ONE PLACE EITHER
    // EVENT NAME IS SPELLED** — `plan:archive seq:29`. Both, for the reason
    // `onLook` gives: a tab switch fires the first and a window raised without
    // a tab change fires only the second, and registering one of the two leaves
    // half the returns waiting for a throttled interval. Taking them from a
    // function that registers both or neither is what makes adopting half of it
    // impossible rather than merely discouraged. Removed in `stopFollowing`
    // through the handle it returns.
    detachLook = attachLook(document, window, onLook);
  } else if (outline.truncated === true) {
    follows.hidden = true;
  }

  /**
   * **RECONSTRUCT, at the foot of the document, seeded from the marked
   * passage** — Task 11 step 6, which asks for it *"on `/lane.html` as well as
   * the session document — both run the same `mountDocument`"*. One mount
   * serves both, because both are this function.
   *
   * The seed is `clip.textContent`, which is the payload the page WOULD put on
   * the clipboard and is written before either clipboard path is attempted.
   * Reading it rather than rebuilding the passage is deliberate twice over: it
   * is the SAME BYTES the three copy buttons and `Ctrl+C` produce, so the
   * panel can never be handed a fourth spelling of one format; and it needs no
   * await, so the control below is instant.
   */
  /**
   * The marked passage as MESSAGE TEXT, synchronously — `onCopy`'s three
   * branches and not a fourth spelling of them.
   *
   * `messageForm` is the one builder, so what the panel is seeded with is byte
   * for byte what the first copy button and `Ctrl+C` produce. The two refusals
   * are kept rather than smoothed over: a passage past the cap and a passage
   * whose records are still being read both say so, because a panel seeded
   * with half a passage looks exactly like one seeded with a whole one, and
   * `INV-nothing-is-dropped-silently` calls that worse than an empty box.
   */
  const builtText = () => {
    const passage = marked;
    if (passage === null || passage.length === 0) return clip.textContent ?? '';
    if (passage.length > PASSAGE_NODE_CAP) {
      return ctx.tFlat('conv.copy.keyTooMany', { n: passage.length, cap: PASSAGE_NODE_CAP });
    }
    if (missingOf(passage).length > 0) {
      schedulePrefetch();
      return ctx.tFlat('conv.copy.keyNotYet');
    }
    return messageForm(passage.map((n) => bodies.get(n))).text;
  };

  const panel = mountRetrieval(ctx, host, () => clip.textContent ?? '', true);
  recall.addEventListener('click', () => {
    clip.textContent = builtText();
    panel.open();
    panel.seedPassage();
    host.querySelector('.convrecallpassage')?.scrollIntoView({ block: 'center' });
    host.querySelector('.convrecallpassage')?.focus();
  });
}

/* ══ THE ROSTER: EVERY LANE ONE SESSION DISPATCHED ═════════════════════════ */

/**
 * How deep this lane is drawn, with its children after it — **A FLAT LIST WITH
 * THE CHILDREN INDENTED, NOT A FOLDER TREE.**
 *
 * ── THE OWNER RULED THE SHAPE, AND THE MEASUREMENT IS WHY ─────────────────
 *
 * `plan:archive seq:41`. Measured on this workspace, 2026-09-09: **221 lanes
 * at depth 1, 43 at depth 2, and only SEVENTEEN of the 264 have any children
 * at all.** A folder tree would be 264 rows of which 17 are folders and 247
 * are leaves — expand and collapse spent on 6.4% of the rows, and the other
 * 247 put behind nesting they do not need.
 *
 * The deciding argument is that **finding a lane is a SEARCH problem and not a
 * navigation one**. `seq:10` built the filter for sessions; a flat list
 * inherits it, and a tree cannot — filtering a tree either hides a parent
 * whose child matched or keeps a parent that did not, and both are lies about
 * what was searched.
 *
 * ── THE TWO SIDES OF THE JOIN SPELL AN AGENT ID DIFFERENTLY ───────────────
 *
 * **`agentId` carries the `agent-` prefix and `parentAgentId` does not**, and
 * this is the first code that ever tried to join them, so nothing had found
 * it. Measured on this workspace, 2026-09-09, over all 265 rows the endpoint
 * answers:
 *
 *     rows carrying a `parentAgentId`                      43
 *     of those, whose parent matched an `agentId`           0
 *     of those, matched after `agent-` is prepended        43   100%
 *     distinct parents, which is the count seq:41 ruled on 17
 *
 * `agentId` is read off the FILE NAME (`agent-<id>.jsonl`) and
 * `parentAgentId` is copied out of the sidecar, which writes the bare id. So
 * the ids are keyed here rather than compared: without this every one of the
 * 43 lanes dispatched from inside another lane would draw at the top level,
 * which is a flat list that has quietly lost the one fact the indent carries.
 * The root of it is in `SubagentMeta`/`upsertSubagent` and is in this lane's
 * report; normalising here costs nothing and needs no rebuild.
 *
 * ── AND NOTHING IS DROPPED FOR HAVING A PARENT THAT IS NOT HERE ───────────
 *
 * A lane whose `parentAgentId` names something this roster does not hold is
 * drawn at the top level rather than left out of the walk. `seen` is not
 * defensiveness for its own sake either: a row that named itself as its own
 * parent would otherwise recurse for ever, and this list is drawn from an
 * index a rebuild writes rather than from anything this file controls.
 *
 * Exported and pure so `node --test` can measure it without a browser.
 */
export function laneKey(id) {
  return typeof id !== 'string' || id === '' ? null : (id.startsWith('agent-') ? id : `agent-${id}`);
}

export function rosterOrder(lanes) {
  const rows = Array.isArray(lanes) ? lanes.filter((l) => l !== null && typeof l === 'object') : [];
  const kids = new Map();
  const known = new Set(rows.map((l) => laneKey(l.agentId)));
  const parentOf = (lane) => {
    const parent = laneKey(lane.parentAgentId);
    if (parent === null || !known.has(parent) || parent === laneKey(lane.agentId)) return null;
    return parent;
  };
  for (const lane of rows) {
    const parent = parentOf(lane);
    if (parent === null) continue;
    const list = kids.get(parent) ?? [];
    list.push(lane);
    kids.set(parent, list);
  }
  const out = [];
  const seen = new Set();
  const place = (lane, depth) => {
    if (seen.has(lane.agentId)) return;
    seen.add(lane.agentId);
    const children = kids.get(laneKey(lane.agentId)) ?? [];
    out.push({ lane, depth, children: children.length });
    for (const child of children) place(child, depth + 1);
  };
  for (const lane of rows) {
    if (parentOf(lane) !== null) continue;
    place(lane, 1);
  }
  // A cycle among parents would leave rows unplaced; they are drawn rather
  // than lost, at the top level, where the reader can at least reach them.
  for (const lane of rows) place(lane, 1);
  return out;
}

/** Does this lane match what the reader typed? Exported so `node --test` can measure it. */
export function laneMatches(lane, needle) {
  if (needle === '') return true;
  const hay = `${lane.description ?? ''} ${lane.agentType ?? ''} ${lane.agentId ?? ''}`;
  return hay.toLowerCase().includes(needle);
}

function drawLaneRow(ctx, row, open) {
  const button = el('button', 'row convrow');
  button.type = 'button';

  const head = el('div', 'convhead');
  // The lane's own brief, which `seq:24` captures whole and which is the only
  // thing that makes a row identifiable — an agent id is a hash. A lane whose
  // sidecar recorded none says so; a fabricated name would be worse than none,
  // which is `titleNodes`' own rule one screen up.
  if (typeof row.lane.description === 'string' && row.lane.description !== '') {
    head.append(el('bdi', 'convtitle', row.lane.description));
  } else {
    head.append(...ctx.t('conv.lanes.unnamed'));
  }
  button.append(head);

  const meta = el('p', 'small convmeta');
  meta.append(mono(row.lane.agentId));
  // THE KIND OF WORKER, NAMED — `seq:50`. This row already drew the type, and
  // it drew it as a bare monospace run sitting between two other bare
  // monospace runs, where it reads as a second identifier rather than as an
  // answer to "what kind of agent is this". `laneKind` is the same field, with
  // the same label, as the dispatching step in the document now carries: a
  // reader who learns the word `type` on one surface does not relearn it on
  // the other.
  const kind = laneKind(ctx, row.lane);
  if (kind !== null) meta.append(' · ', kind);
  meta.append(' · ');
  meta.append(...ctx.t('conv.lanes.records', { n: row.lane.records }));
  meta.append(' · ', mono(formatBytes(row.lane.bytes)));
  // **What a parent is, said on the parent's own row.** Seventeen rows of 264
  // carry this, which is exactly why the shape is a flat list: the fact is
  // worth a phrase and is not worth a folder.
  if (row.children > 0) {
    meta.append(' · ');
    meta.append(...ctx.t(row.children === 1 ? 'conv.lane' : 'conv.lanes', { n: row.children }));
  }
  // And what a CHILD is, on the child's own row. The indent says it visually;
  // this says it in words, for a reader who cannot see the indent and for the
  // filtered list, where a parent may not be on screen at all.
  if (row.depth > 1) {
    meta.append(' · ');
    meta.append(...ctx.t('conv.lanes.fromLane'));
  }
  button.append(meta);

  const marks = el('p', 'small');
  if (row.lane.present === false) {
    const chip = el('span', 'chip warn glyphed');
    chip.dataset.g = '⦸';
    chip.append(...ctx.t('conv.pruned'));
    marks.append(chip, ' ');
  }
  if (row.lane.staleBytes > 0) {
    const chip = el('span', 'chip warn');
    chip.append(...ctx.t('conv.behindRow', { bytes: formatBytes(row.lane.staleBytes) }));
    marks.append(chip, ' ');
  }
  if (row.lane.scanTruncated === true) {
    const chip = el('span', 'chip warn glyphed');
    chip.dataset.g = '⋯';
    chip.append(...ctx.t('conv.scanCapped'));
    marks.append(chip, ' ');
  }
  if (marks.childNodes.length > 0) button.append(marks);

  /**
   * **HOW FAR IN A CHILD IS DRAWN — and the number is no longer here.**
   *
   * `LANE_INDENT_PX = 18` stood at the top of this section, written as a
   * computed `padding-inline-start` on the row's three inner lines, and its
   * header said why: `styles.css` was another lane's the night the roster
   * landed. It is not any more. `.convrow.lanechild` in the sheet owns the
   * STEP (`--sp-3`) and the hairline that draws the relation; what is written
   * here is the DEPTH, which is an integer read off the data and is the one
   * part of this no stylesheet can hold — `check-cssom-restatement.ts`' own
   * line between a value computed from data and a copy of a declaration.
   *
   * `depth - 1` rather than `depth`, so the custom property counts STEPS OUT
   * from the top level and a depth-1 row would compute to zero if it ever
   * reached here. It cannot, because of the guard — the property is never set
   * on a row that has no parent, which is what keeps
   * `e2e/conversations.spec.ts`' "parent === 0" half true by construction
   * rather than by arithmetic.
   */
  if (row.depth > 1) {
    button.classList.add('lanechild');
    button.style.setProperty('--lanedepth', String(row.depth - 1));
  }

  // A lane whose transcript is gone has nothing to open, and the row says so
  // rather than opening a document that cannot load.
  //
  // WHAT `open` DOES CHANGED on his ruling of 2026-09-09 and this line did
  // not: the row hands over an agent id and the caller decides what a lane's
  // address is. It is now `/lane.html` — bare, in this same window — and the
  // whole of that decision is in `openLane` where the screen is mounted.
  if (row.lane.present === false) button.disabled = true;
  else button.addEventListener('click', () => open(row.lane.agentId));
  return button;
}

/**
 * `#/conversations/lanes/<id>` — the whole roster of one session's lanes.
 *
 * **It does not undo `seq:12`.** That item kept lanes OUT of the sessions list
 * on a measurement — 264 lanes against 2 sessions would bury both real
 * conversations — and that argument is about the DEFAULT list. This is a
 * surface a reader asks for by name, on one session, and the sessions list is
 * untouched.
 *
 * **It draws every row.** `boundedList`'s cap is what the sessions list wears,
 * and it is right there: that list grows without bound across all time. This
 * one is bounded by how many lanes ONE session dispatched, the endpoint says
 * so in its own header and answers uncapped for the same reason, and a reader
 * who came here to browse should not meet a pager. What the item asked to be
 * measured first — what 264 rows cost to draw — is in the lane's report.
 */
async function renderRoster(ctx, root, session, openLane, back) {
  // `.convlanes` carries no rule and is not meant to: it is a HANDLE, so a
  // test can name THIS card rather than counting `.card` on a page that holds
  // more than one. The look is `.card pane`'s, unchanged.
  const card = el('div', 'card pane convlanes');
  const title = el('h3');
  title.append(...ctx.t('conv.lanes.h'));
  card.append(title);

  const backButton = el('button', 'tvback');
  backButton.type = 'button';
  backButton.append(...ctx.t('conv.lanes.back'));
  backButton.addEventListener('click', back);
  card.append(backButton);

  const sub = el('p', 'small');
  sub.append(...ctx.t('conv.lanes.sub'));
  card.append(spaced(sub));

  const of = el('p', 'small');
  of.append(...ctx.t('conv.lanes.of'), ' ', mono(session));
  card.append(of);
  root.append(card);

  let body;
  try {
    body = await ctx.api(`/api/conversations/${encodeURIComponent(session)}/subagents`);
  } catch (error) {
    // Drawn INSTEAD of a list, never beside an empty one: an endpoint that
    // refused and a session that dispatched nothing are two facts.
    card.append(errorNote(error.message));
    return;
  }

  if (body.indexed === false) {
    const note = el('p', 'small');
    note.append(...ctx.t('conv.neverScanned'));
    card.append(spaced(note));
    const cmd = el('p', 'plate convcmd');
    cmd.append(mono(body.rebuild));
    card.append(cmd);
    return;
  }

  const all = rosterOrder(body.subagents ?? []);
  if (all.length === 0) {
    const none = el('p', 'small');
    const chip = el('span', 'chip unmeas glyphed');
    chip.dataset.g = '◌';
    chip.append(...ctx.t('conv.lanes.none'));
    none.append(chip);
    card.append(spaced(none));
    return;
  }

  // The lanes NOTHING on a transcript page can open, said once here as well as
  // on the document — this roster is the only route to them, so it is the one
  // surface where the number changes what a reader does.
  if (typeof body.unlinked === 'number' && body.unlinked > 0) {
    const unlinked = el('p', 'small spill');
    unlinked.append(...ctx.t('conv.doc.lanesUnlinked', {
      n: body.unlinked, total: body.total,
    }));
    card.append(spaced(unlinked));
  }

  /**
   * The box, and it filters IN THE PAGE.
   *
   * `seq:10`'s session filter is a query the server answers, because that list
   * is a window over an index that may hold far more than is drawn. This
   * answer is whole — the endpoint is uncapped and every row is already here —
   * so a round trip per keystroke would buy nothing and would put a settle
   * delay between the reader and their own answer.
   */
  const bar = el('div', 'convfilter');
  bar.setAttribute('role', 'search');
  bar.setAttribute('aria-label', ctx.tFlat('conv.lanes.find'));
  const wrap = el('label', 'convfield');
  const name = el('span', 'convfieldname');
  name.append(...ctx.t('conv.lanes.find'));
  const find = el('input', 'convfind');
  find.type = 'search';
  wrap.append(name, find);
  bar.append(wrap);
  card.append(bar);

  const count = el('p', 'small');
  count.setAttribute('aria-live', 'polite');
  card.append(count);
  const rows = el('div', 'rows');
  card.append(rows);

  const paint = () => {
    const needle = find.value.trim().toLowerCase();
    const shown = needle === '' ? all : all.filter((r) => laneMatches(r.lane, needle));
    count.replaceChildren();
    if (needle === '') count.append(...ctx.t('conv.lanes.all', { n: all.length }));
    else if (shown.length === 0) count.append(...ctx.t('conv.lanes.noMatch', { total: all.length }));
    else count.append(...ctx.t('conv.lanes.matched', { n: shown.length, total: all.length }));
    rows.replaceChildren(...shown.map((row) => drawLaneRow(ctx, row, openLane)));
  };
  find.addEventListener('input', paint);
  paint();
}

/* ══ THE SCREEN ════════════════════════════════════════════════════════════ */

/** `#/conversations/<id>` — the id is the rest of the hash, or `null`. */
export function sessionFromHash(hash) {
  const rest = String(hash).replace(/^#\//, '');
  const cut = rest.indexOf('/');
  if (cut === -1) return null;
  const id = rest.slice(cut + 1);
  return id === '' ? null : decodeURIComponent(id);
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'conv.h', 'conv.v', 'conv.sub');

  // **Two paragraphs, and the second one is the one that was missing.**
  //
  // `plan:archive seq:11` asks for the security sentence in the feature's own
  // help — the spec's words are that the archive "widens what a leaked nonce
  // would show and THAT SHOULD BE SAID OUT LOUD IN THE FEATURE OWN HELP" — and
  // measured across all 30 `conv.*` keys there was not one mention of
  // sensitivity, of pasted secrets or of the local port. What the help did say
  // was the reassuring half, "nothing here enters your repository", which is
  // true and was the only half being said.
  //
  // It is in the disclosure rather than on the page because the page's own
  // sentence has to stay short, and it is the FIRST thing in the disclosure
  // rather than the last because it is the fact that decides whether a reader
  // wants this feature at all.
  const helpSecurity = el('p');
  helpSecurity.append(...ctx.t('conv.sensitive'));
  const helpBody = el('p');
  helpBody.append(...ctx.t('conv.help.body'));
  root.append(helpDisclosure(ctx, 'conv.help.summary', [helpSecurity, helpBody]));

  /**
   * **`#/conversations/at/<session>/<byte>` — A DOCUMENT OPENED AT A MARKED
   * POINT**, capability 4 of
   * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`.
   *
   * Read BEFORE `sessionFromHash`, for the reason `rosterFromHash` is: the
   * shell's router splits at the FIRST `/` and hands the rest here untouched,
   * so `at/<id>/<byte>` reaches this module as a session id of that shape and
   * would open a session that does not exist. `anchorFromHash` is the only
   * code that knows what the extra segments mean, which is where `app.js` says
   * that knowledge goes.
   */
  const landing = anchorFromHash(location.hash);
  const session = landing !== null ? landing.sessionId : sessionFromHash(location.hash);
  const open = (id) => { ctx.navigate(`#/conversations/${encodeURIComponent(id)}`); };
  const back = () => { ctx.navigate('#/conversations'); };

  /**
   * **A ROSTER ROW OPENS A LANE BARE** — owner ruling 2026-09-09, answering
   * the one boundary `plan:archive seq:51` drew on purpose and reported in
   * prose rather than deciding for him.
   *
   * `seq:51`'s argument for leaving this route alone was that a list's rows
   * are not links that spend a tab. THAT ARGUMENT IS ANSWERED RATHER THAN
   * OVERRULED: this navigates the CURRENT window, so no tab is spent, the
   * browser's own Back returns to the roster, and what changes is only the
   * SHAPE the lane arrives in — `/lane.html`, with no rail, no header and no
   * status strip, which is what he asked a lane to look like.
   *
   * **Through `laneHref`, which is the only code that knows a lane's
   * address.** A second spelling written here is precisely the class of defect
   * `plan:archive seq:48` was filed about — one fact recorded two ways and
   * nothing comparing them until a join quietly returns nothing.
   *
   * **`location.assign` and not `ctx.navigate`.** The app's router moves a
   * HASH inside this page; `/lane.html` is a different document, and
   * `lane.js` re-asks the read model on arrival rather than trusting the
   * address — `window.location.replace(sessionHref(id))` there is the same
   * move in the other direction. `assign` rather than `replace` because the
   * roster is somewhere a reader wants to come back to.
   *
   * **AND THE IN-APP ROUTE IS NOT REMOVED.** `#/conversations/<agentId>` still
   * renders a lane inside the shell — `rowFor` resolves either kind — which is
   * what `button.tvlaneshut`'s `history.length === 1` gate calls "a reader who
   * reached this lane WITHOUT a new tab". A reader arriving here now has a
   * history entry behind them, so that control correctly does not draw, and
   * `a.tvlanehome` — drawn either way — is their route back.
   */
  const openLane = (agentId) => { window.location.assign(laneHref(agentId)); };

  // **THE ROSTER, ASKED FOR BY ADDRESS** — `plan:archive seq:41`. Taken before
  // the session branch because `sessionFromHash` cannot tell `lanes/<id>` from
  // an id; `rosterFromHash` is the only code that knows the extra segment
  // means anything, which is where `app.js`' router says that knowledge goes.
  const roster = rosterFromHash(location.hash);
  if (roster !== null) {
    await renderRoster(ctx, root, roster, openLane, () => {
      ctx.navigate(`#/conversations/${encodeURIComponent(roster)}`);
    });
    return;
  }

  if (session === null) {
    // The LIST is an ordinary list and wears the app's own card. Only the
    // document below is released from that.
    const card = el('div', 'card pane');
    const title = el('h3');
    title.append(...ctx.t('conv.card'));
    card.append(title);
    root.append(card);
    let body;
    try {
      body = await ctx.api('/api/conversations');
    } catch (error) {
      // Drawn INSTEAD of the list, never beside an empty one: an endpoint that
      // refused and an archive that is empty are two facts, and this project's
      // own invariant is that the difference survives.
      card.append(errorNote(error.message));
      return;
    }

    // ── THE FILTER, AND WHY IT IS NOT DRAWN ON AN EMPTY ARCHIVE ────────────
    //
    // `plan:archive seq:10`. A search box over nothing is a control that can
    // only ever answer "no match", which a reader would read as a fact about
    // their sessions rather than about an index nobody has built. The two
    // empty states below say what is actually true instead, and `drawList`
    // still owns both.
    const results = el('div', 'convresults');
    if (body.indexed === true && body.total > 0) {
      const scope = el('p', 'small');
      scope.append(...ctx.t('conv.searchScope'));
      const state = { q: null, branch: null, since: null, until: null };
      let inFlight = 0;
      const refresh = async (next) => {
        Object.assign(state, next);
        const mine = ++inFlight;
        let answer;
        try {
          answer = await ctx.api(`/api/conversations${filterQuery(state)}`);
        } catch (error) {
          // A LATER answer must never be overwritten by an earlier one that
          // arrived late — a reader who typed `arc` then `archive` would
          // otherwise be shown the `arc` answer. The counter is the whole
          // mechanism: only the newest request paints.
          if (mine !== inFlight) return;
          results.replaceChildren();
          results.append(errorNote(error.message));
          return;
        }
        if (mine !== inFlight) return;
        results.replaceChildren();
        drawList(ctx, results, answer, open);
      };
      card.append(filterBar(ctx, body.branches ?? [], state, (next) => { void refresh(next); }));
      card.append(spaced(scope));
    }
    card.append(results);
    drawList(ctx, results, body, open);

    // **THE OTHER SEARCH, and the marks** — `plan:recall seq:1`, Tasks 2, 4
    // and 5. Below the list rather than inside it, because it answers a
    // different question: the box above narrows the sessions, this one reads
    // inside them. Drawn on the same condition the filter is, for the same
    // reason — a search over an index nobody has built can only ever answer
    // "no match", and a reader would read that as a fact about their words.
    if (body.indexed === true && body.total > 0) {
      mountArchiveSearch(ctx, root, body.conversations ?? []);
    }
    return;
  }

  const viewer = el('section', 'tvroot');
  root.append(viewer);

  // **The lane roster, started BEFORE the outline and awaited after it** — the
  // shape `doc.js` already uses for the document roster it checks links
  // against, and for the same two reasons. Two reads that need nothing from
  // each other should not be two round trips in sequence; and a refusal is
  // caught into "not read" rather than thrown, because a roster this page
  // could not fetch must not take the document down with it. It costs the
  // links, and `conv.doc.lanesUnread` says so on the page.
  //
  // It is fetched HERE rather than after the mount so the first paint already
  // carries the links. A roster arriving later would have to rebuild rows that
  // are already drawn — and a rebuilt row is a `<details>` a reader opened
  // being shut, which is the one thing `paint` moves rows to avoid.
  const lanes = ctx.api(`/api/conversations/${encodeURIComponent(session)}/subagents`)
    .then((body) => laneIndex(body))
    .catch(() => laneIndex(null));

  let outline;
  try {
    outline = await ctx.api(
      `/api/conversations/${encodeURIComponent(session)}/outline`);
  } catch (error) {
    viewer.append(errorNote(error.message));
    const backButton = el('button', 'tvback');
    backButton.type = 'button';
    backButton.append(...ctx.t('conv.back'));
    backButton.addEventListener('click', back);
    viewer.append(backButton);
    return;
  }
  mountDocument(ctx, viewer, outline, back, await lanes,
    landing === null ? null : landing.byteOffset);
}
