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
  boundedList, el, errorNote, mono, screenHead, spaced, zonedStampOf,
} from './parts.js';
import { helpDisclosure } from '../lib/disclosure.js';
import { shouldPing } from '../lib/heartbeat.js';
import { markdownNodes } from '../lib/markdown.js';
import { ansiNodes, hasEscapes, stripEscapes } from '../lib/ansi.js';
import { formatBytes } from '../lib/viewmodel.js';
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

/** A title, or the honest absence of one. Never a fabricated name. */
function titleNodes(ctx, row) {
  if (row.title === null) return ctx.t('conv.untitled');
  const wrap = [el('bdi', 'convtitle', row.title)];
  // The model wrote it, and the reader is told so rather than left to assume a
  // person did — the spec asks for the title to be shown as what it is.
  if (row.titleSource === 'ai') {
    const by = el('span', 'small');
    by.append(...ctx.t('conv.titleByModel'));
    // The separating space is a SIBLING of the span, not its first child. As a
    // first child it is at the start of an inline box and the browser collapses
    // it, which drew `archive(named by the model)` with no gap — seen in the
    // screenshot in both languages, after the strings had been checked.
    wrap.push(' ', by);
  }
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
  return zonedStampOf(iso);
}

/* ══ THE LIST ══════════════════════════════════════════════════════════════ */

function drawRow(ctx, row, open) {
  const button = el('button', 'row convrow');
  button.type = 'button';

  const head = el('div', 'convhead');
  head.append(...titleNodes(ctx, row));
  button.append(head);

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
    meta.append(...ctx.t(row.subagents === 1 ? 'conv.lane' : 'conv.lanes', {
      n: row.subagents,
    }));
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
  button.append(meta);

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
  if (marks.childNodes.length > 0) button.append(marks);

  button.addEventListener('click', () => open(row.sessionId));
  return button;
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
  const rows = el('div', 'rows');
  host.append(rows);
  boundedList(
    ctx, rows, body.conversations,
    (row) => drawRow(ctx, row, open),
    { cap: 20, order: 'recent' },
  );
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

  let timer = null;
  const settle = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; onChange(read()); }, FILTER_SETTLE_MS);
  };
  // Typing settles; choosing does not. A `<select>` or a date picker is one
  // deliberate act with nothing following it, so waiting a quarter of a second
  // after it would be a delay bought for nothing.
  find.addEventListener('input', settle);
  for (const control of [branch, since, until]) {
    control.addEventListener('change', () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      onChange(read());
    });
  }
  clear.addEventListener('click', () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    find.value = '';
    branch.value = '';
    since.value = '';
    until.value = '';
    onChange(read());
  });

  return bar;
}

/** The query string for one filter state. Absent keys are absent, never empty. */
function filterQuery(state) {
  const params = new URLSearchParams();
  if (state.q !== null) params.set('q', state.q);
  if (state.branch !== null) params.set('branch', state.branch);
  if (state.since !== null) params.set('since', state.since);
  if (state.until !== null) params.set('until', state.until);
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/* ══ THE DOCUMENT: MEASUREMENT AND ARITHMETIC ══════════════════════════════ */

/** Nodes kept in the DOM above and below the viewport, so a scroll is smooth. */
const OVERSCAN = 6;

/** Node bodies one fetch asks for. The endpoint caps at 80. */
const FETCH_PAGE = 24;

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
 * makes the screen ask, though: see `LOOK_GAP_MS` and `onLook` below, which
 * turn "the reader came back to the tab" into a tick of its own.
 *
 * **The cadence is DISCLOSED on screen**, in `conv.doc.follows` in both string
 * tables, and the two are held together by
 * `test/ui/conversation-follow-cadence.test.ts` rather than by memory.
 */
const TIP_MS = 1_000;

/**
 * The first guess at a node's height, in pixels, before it has been drawn.
 *
 * **A guess is all this can be, and the design depends on it being replaced
 * rather than on it being right.** Every drawn row is measured and its true
 * height written back (`Scroller.measure`), so the estimate only has to be
 * good enough that the scrollbar is not absurd on first paint and that the
 * jump when a row is measured is small.
 *
 * The numbers are read off the drawn stylesheet rather than invented:
 * `--fs-1` at 14.5px on a 1.45 line-height is a ~21px line, a turn's heading
 * plus timestamp plus padding is ~58px, and a folded run is one line in a
 * bordered box, ~34px. `CHARS_PER_LINE` is the one honest fudge — prose wraps
 * at a width this function cannot see.
 */
const LINE_PX = 21;
const CHARS_PER_LINE = 92;
const TURN_CHROME_PX = 58;
const WORK_PX = 34;

export function estimateHeight(node) {
  if (node.k === 'work') return WORK_PX;
  const lines = Math.max(1, Math.ceil((node.c || 0) / CHARS_PER_LINE));
  // A `deed` is a heading, the command or the question, and the arguments
  // under it — closer to a turn than to a folded line, and its `c` is what was
  // ASKED rather than what came back, so the same arithmetic reads it.
  return TURN_CHROME_PX + Math.min(lines, 400) * LINE_PX;
}

/**
 * Does this outline node match what the reader typed?
 *
 * **It searches the WHOLE SESSION, and that is the change.** The old filter
 * matched the fifty records that happened to be loaded and the count line said
 * "Showing all {total} entries on this page" — a phrase `seq:7` singles out
 * for presuming a second page the product did not have. The outline holds
 * every node, so there is no page to be on.
 *
 * **What it can and cannot see, stated rather than implied.** The outline
 * carries each turn's OPENING (`p`, 140 characters) and the tools a run ran,
 * not every word of a 61 MB file. So this finds a turn by how it starts and by
 * what ran in it, and the count line says so in as many words. Full text
 * search over the whole transcript is a server-side index this feature does
 * not have and does not pretend to — `INV-nothing-is-dropped-silently` applies
 * to a search's reach as much as to a count's.
 */
export function matchesNode(node, needle) {
  if (needle === '') return true;
  const hay = `${node.p ?? ''} ${(node.x ?? []).join(' ')} ${node.y ?? ''} ${node.w ?? ''}`;
  return hay.toLowerCase().includes(needle);
}

/**
 * The scroll's arithmetic, kept apart from its drawing so it can be reasoned
 * about — and tested — without a browser.
 *
 * It owns one array of heights over the VIEW (the nodes currently shown, which
 * is every node until a filter narrows it) and the running sum over them.
 * `prefix[i]` is the pixel at which view row `i` begins, so `prefix[view]` is
 * the document's whole height and a binary search over it turns a scroll
 * position into a row index.
 *
 * A plain array and a full re-sum, rather than a Fenwick tree: the owner's
 * session is 4,916 nodes, a re-sum is 4,916 additions, and it runs only when a
 * measurement actually changed something. The clever structure would be real
 * work to read and would save microseconds.
 */
export class Scroller {
  constructor(heights) {
    this.heights = heights;
    this.prefix = new Float64Array(heights.length + 1);
    this.resum();
  }

  resum() {
    const { heights, prefix } = this;
    let total = 0;
    for (let i = 0; i < heights.length; i += 1) {
      prefix[i] = total;
      total += heights[i];
    }
    prefix[heights.length] = total;
  }

  get total() { return this.prefix[this.heights.length]; }

  /** Pixel where view row `i` begins. `i === length` is the document's end. */
  top(i) { return this.prefix[Math.max(0, Math.min(i, this.heights.length))]; }

  /**
   * The first view row whose box contains pixel `y` — a binary search, so a
   * scroll over 4,916 nodes costs thirteen comparisons rather than 4,916.
   */
  at(y) {
    const { prefix, heights } = this;
    if (heights.length === 0) return 0;
    let lo = 0;
    let hi = heights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (prefix[mid] <= y) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
}

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
function drawTurn(ctx, body) {
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
 * The address of one lane's transcript — **the SAME document route a session
 * uses**, which is `plan:archive seq:15`'s "the same renderer, whichever shape
 * wins" spent rather than restated. `rowFor` in
 * `read-model-conversation-document.ts` resolves a lane, so `#/conversations/
 * <agentId>` is already a working address and nothing new renders it.
 */
export function laneHref(agentId) {
  return `#/conversations/${encodeURIComponent(agentId)}`;
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
  if (body === null || typeof body !== 'object' || !Array.isArray(body.subagents)) {
    return { byCall, total: 0, unlinked: 0, owner: null, read: false };
  }
  for (const lane of body.subagents) {
    if (lane === null || typeof lane !== 'object') continue;
    if (typeof lane.toolUseId !== 'string' || lane.toolUseId === '') continue;
    byCall.set(lane.toolUseId, lane);
  }
  return {
    byCall,
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
  byCall: new Map(), total: 0, unlinked: 0, owner: null, read: false, notKept: false,
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
  if (typeof toolUseId !== 'string' || toolUseId === '') return null;
  const lane = lanes.byCall.get(toolUseId);
  if (lane !== undefined) return laneLink(ctx, lane);
  if (lanes.notKept !== true) return null;
  const missing = el('span', 'tvcut');
  missing.append(...ctx.t('conv.doc.laneNotKept'));
  return missing;
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
function stepLabel(ctx, step) {
  if (step.tool !== null) return mono(step.tool);
  if (Array.isArray(step.blocks) && step.blocks.includes('tool_result')) {
    const word = el('span', 'tvresult');
    word.append(...ctx.t('conv.doc.result'));
    return word;
  }
  if (typeof step.subtype === 'string' && step.subtype !== '') {
    return mono(`${step.type} · ${step.subtype}`);
  }
  if (Array.isArray(step.blocks) && step.blocks.length > 0) return mono(step.blocks.join(' + '));
  return mono(step.type);
}

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
  const laneNode = laneMark(ctx, lanes, step.toolUseId);
  if (laneNode !== null) line.append(' ', laneNode);
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
  const laneNode = laneMark(ctx, lanes, step.toolUseId);
  if (laneNode !== null) {
    const line = el('p', 'tvstephead');
    line.append(laneNode);
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
  for (const step of body.steps) {
    const item = el('li', `tvstep${step.failed === true ? ' tvfail' : ''}`);
    if (Array.isArray(step.blocks) && step.blocks.includes('thinking')) thought += 1;
    item.append(...stepParts(ctx, step, lanes));
    list.append(item);
  }
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
function mountDocument(ctx, host, outline, back, roster = NO_LANES) {
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
  title.append(...titleNodes(ctx, outline));
  head.append(title);

  const facts = el('p', 'tvfacts');
  facts.append(mono(outline.sessionId));
  if (outline.branch !== null) facts.append(' · ', mono(outline.branch));
  facts.append(' · ', mono(formatBytes(outline.bytes)));
  head.append(facts);
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
      home.href = laneHref(lanes.owner);
      home.target = '_blank';
      home.rel = 'noopener';
      home.append(...ctx.t('conv.doc.laneHome'));
      from.append(' ', home);
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
  bar.append(copyLabel, copyMessage, copySeen, copyRaw);
  host.append(bar);

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

  const buildRow = (nodeIndex) => {
    const body = bodies.get(nodeIndex);
    if (body === undefined) {
      waiting.add(nodeIndex);
      return drawWaiting(ctx, nodes[nodeIndex], heightOf(nodeIndex));
    }
    waiting.delete(nodeIndex);
    if (body.kind === 'said') return drawTurn(ctx, body);
    // A command, or a question put to him — drawn open. `plan:archive seq:16`.
    if (body.kind === 'deed') return drawDeed(ctx, body, lanes);
    return drawWork(ctx, body, lanes);
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
  toTop.addEventListener('click', () => { stickUntil = 0; scroll.scrollTop = 0; paint(); });
  toEnd.addEventListener('click', () => { scroll.scrollTop = scroller.total; paint(); });

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
      if (needle === '' || matchesNode(nodes[i], needle)) view.push(i);
    }
    rebuild();
    count.replaceChildren();
    if (needle === '') {
      count.append(...ctx.t('conv.doc.whole', {
        turns: outline.said, records: outline.records,
      }));
    } else if (view.length === 0) {
      count.append(...ctx.t('conv.doc.noMatch'));
    } else {
      count.append(...ctx.t('conv.doc.matched', {
        shown: view.length, total: nodes.length, peek: outline.peekChars,
      }));
    }
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
  find.addEventListener('input', applyFilter);
  redraw('end');

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
  };
  document.addEventListener('selectionchange', onSelect);
  for (const button of copyButtons) {
    button.addEventListener('mousedown', (event) => { event.preventDefault(); });
  }

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
        const built = messagePassage(list, openFolds(), passageLabels(ctx));
        text = built.text;
        extra = () => {
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
        };
      }

      if (!await toClipboard(text)) { say('conv.copy.refused'); return; }
      // WHAT IT TOOK, in sections and in the record numbers every other
      // surface counts in. Three sentences rather than one with a count
      // substituted into it: "Copied 1 sections" is what one sentence produces
      // for a passage of one, and a fold of five records is a passage of ONE
      // section spanning five, so "record" and "records" are both real cases.
      const span = recordSpan(passage);
      if (passage.length > 1) {
        say('conv.copy.took', { n: passage.length, from: span.from, to: span.to });
      } else if (span.from === span.to) {
        say('conv.copy.took1', { from: span.from });
      } else {
        say('conv.copy.took1span', { from: span.from, to: span.to });
      }
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
   * How close to the last ask a look-tick is dropped as a duplicate.
   *
   * **Sized against the collision it exists for, not against the interval.**
   * One tab switch fires `visibilitychange` and `focus` within the same task,
   * so the gap this has to swallow is microseconds; a quarter second is two
   * orders of magnitude of slack over that and still a quarter of `TIP_MS`, so
   * a reader who genuinely leaves and returns inside one interval is answered
   * rather than debounced away.
   */
  const LOOK_GAP_MS = 250;

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
    // **THREE LISTENERS ARE ADDED AND THREE ARE REMOVED, and the two below are
    // the ones that would leak.** `hashchange` is on `window` and the two here
    // are on `document` and `window` — none of them dies with the well, so a
    // reader who opens six conversations in one session would otherwise leave
    // six `onLook` handlers behind and fire all six on the next tab focus.
    // `tick`'s `scroll.isConnected` guard makes each of them harmless, which is
    // exactly why the leak would never be noticed.
    document.removeEventListener('visibilitychange', onLook);
    window.removeEventListener('focus', onLook);
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
   * One tick: has the file moved?
   *
   * Four answers, and each is a state rather than an error.
   *   - gone      the harness pruned the transcript under the reader.
   *   - shrank    it was REPLACED rather than appended to, so every byte
   *               offset on screen now points somewhere else. This is the
   *               `resync` discipline borrowed from `watch-model.ts`: say the
   *               tail cannot be trusted instead of drawing a hole.
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
        // than resuming — and the honest answer is the `resync` one borrowed
        // from `watch-model.ts`: say the tail cannot be trusted rather than
        // draw a hole. The reader reloads and gets a document built against
        // the file as it now is.
        if (tip.bytes < seenBytes
          || (tip.bytes === seenBytes && tip.mtimeMs !== seenMtime)) {
          stopWith('conv.doc.replaced');
          return;
        }
        if (tip.bytes > seenBytes) void refill();
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
    // Both, for the reason `onLook` gives: a tab switch fires the first and a
    // window raised without a tab change fires only the second. Removed
    // together in `stopFollowing`.
    document.addEventListener('visibilitychange', onLook);
    window.addEventListener('focus', onLook);
  } else if (outline.truncated === true) {
    follows.hidden = true;
  }
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

  const session = sessionFromHash(location.hash);
  const open = (id) => { ctx.navigate(`#/conversations/${encodeURIComponent(id)}`); };
  const back = () => { ctx.navigate('#/conversations'); };

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
  mountDocument(ctx, viewer, outline, back, await lanes);
}
