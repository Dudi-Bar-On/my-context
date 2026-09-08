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

/** `52,061,736` → `49.6 MB`. Sizes are read, not computed, by a person. */
function sizeText(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  if (row.branch !== null) {
    meta.append(' · ');
    meta.append(mono(row.branch));
  }
  meta.append(' · ', mono(sizeText(row.bytes)));
  button.append(meta);

  const marks = el('p', 'small');
  // An exported copy is marked wherever it appears — the owner asked for the
  // two never to be confused, and `source` is a column for that reason.
  if (row.source !== 'live') {
    const chip = el('span', 'chip carry');
    chip.dataset.g = '⎘';
    chip.append(...ctx.t('conv.exported'));
    marks.append(chip, ' ');
  }
  // A session whose transcript the harness has pruned. The list SHOWS this
  // rather than failing to load it — the spec names it as the strongest
  // argument for export.
  if (row.present === false) {
    const chip = el('span', 'chip warn');
    chip.dataset.g = '⃠';
    chip.append(...ctx.t('conv.pruned'));
    marks.append(chip, ' ');
  }
  // The transcript has grown past the row. Drawn as a chip beside the pruned
  // and capped ones because it is the same KIND of fact — every number on this
  // row is what a scan saw and not what the file holds — and because a reader
  // scanning the list has to be able to tell WHICH session is behind, which an
  // aggregate line above the list cannot say.
  //
  // NO `dataset.g`, unlike the two chips around it, and that is deliberate:
  // `styles.css` declares `.chip.warn::before{content:"▲ "}`, which is a
  // two-class rule and therefore beats `.chip::before{content:attr(data-g)}`.
  // So a `data-g` on a `warn` chip NEVER RENDERS — the `⃠` above and the `⋯`
  // below are both dead lines, verified in a browser 2026-09-08, and both
  // chips draw `▲`. Adding a third dead line would be copying a defect
  // forward; correcting theirs would change two glyphs the owner has seen, so
  // it is reported rather than done here.
  if (row.staleBytes > 0) {
    const chip = el('span', 'chip warn');
    chip.append(...ctx.t('conv.behindRow', { bytes: sizeText(row.staleBytes) }));
    marks.append(chip, ' ');
  }
  // The scan hit its cap, so every count above is a floor rather than a total.
  if (row.scanTruncated === true) {
    const chip = el('span', 'chip warn');
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
    const note = el('p', 'small');
    note.append(...ctx.t('conv.neverScanned'));
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
    const zero = el('span', 'chip unmeas');
    zero.dataset.g = '◌';
    zero.append(...ctx.t('conv.none'));
    const line = el('p', 'small');
    line.append(zero);
    host.append(spaced(line));
    return;
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
      n: body.stale, bytes: sizeText(body.staleBytes),
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
 * ── WHAT FIVE SECONDS COSTS, MEASURED, AND AGAINST WHAT BUDGET ───────────
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
 * At 5 s the shipped route is **0.68 ms/min per open document** — an order of
 * magnitude under the sweep the ruling protects. The first draft would have
 * been 23 ms/min, four times over it, and that measurement is why the route
 * resolves its file from `listTranscriptFiles` rather than from the index;
 * `read-model-conversation-document.ts` carries the working.
 *
 * `shouldPing` is honoured on every tick, so a tab in the background stops
 * asking — the same rule, and the same reason, as the heartbeat's: a forgotten
 * tab must not hold the server up.
 */
const TIP_MS = 5_000;

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
  const who = body.who === 'you' ? 'you' : 'claude';
  const turn = el('article', `tvturn tv${who}${body.synthetic !== null ? ' tvsyn' : ''}`);
  turn.dataset.n = String(body.n);

  const head = el('header', 'tvwho');
  const mark = el('span', 'tvmark');
  mark.dataset.g = who === 'you' ? KINDS.prompt.glyph : KINDS.answer.glyph;
  head.append(mark);

  const name = el('h4', 'tvname');
  name.append(...ctx.t(who === 'you' ? 'conv.doc.you' : 'conv.doc.claude'));
  head.append(name);

  // Person-side text nobody typed keeps its place and its record and is
  // LABELLED. `classifyTurn` counts these as prompts and is right to for the
  // archive; a document that names a speaker cannot be neutral about it —
  // 202 of this session's 549 person-side turns are background-task
  // notifications, and drawing those as "You" would make the document lie.
  if (body.synthetic !== null) {
    const tag = el('span', 'chip index tvtag');
    tag.dataset.g = '⌁';
    const key = SYNTHETIC_KEYS[body.synthetic];
    if (key !== undefined) tag.append(...ctx.t(key));
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
  return turn;
}

/** What one folded step calls itself: the tool, else the blocks, else the type. */
function stepLabel(ctx, step) {
  if (step.tool !== null) return mono(step.tool);
  if (Array.isArray(step.blocks) && step.blocks.includes('tool_result')) {
    const word = el('span', 'tvresult');
    word.append(...ctx.t('conv.doc.result'));
    return word;
  }
  if (Array.isArray(step.blocks) && step.blocks.length > 0) return mono(step.blocks.join(' + '));
  return mono(step.type);
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
function drawWork(ctx, body) {
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
    const bad = el('span', 'chip crit tvtag');
    bad.dataset.g = '⚠';
    bad.append(...ctx.t('conv.doc.failed', { n: failed }));
    summary.append(bad);
  }
  fold.append(summary);

  const list = el('ol', 'tvsteps');
  for (const step of body.steps) {
    const item = el('li', `tvstep${step.failed === true ? ' tvfail' : ''}`);
    const line = el('p', 'tvstephead');
    line.append(mono(String(step.index)), ' ', stepLabel(ctx, step));
    if (step.detail !== null && step.detail !== '') {
      const detail = el('span', 'tvdetail');
      detail.setAttribute('dir', 'auto');
      detail.textContent = stripEscapes(step.detail);
      line.append(' ', detail);
    }
    if (step.unreadable === true) {
      const bad = el('span', 'chip crit tvtag');
      bad.dataset.g = '⚠';
      bad.append(...ctx.t('conv.unreadable'));
      line.append(' ', bad);
    }
    item.append(line);
    // WHOLE, never clipped — see `drawTurn` above for the ruling. Measured on
    // the owner's own transcript before the cap came off: 41 of 28,998 records
    // were over the old 4,000-character step cap, the largest of them 58,888
    // characters, and every one of them sits inside a `<details>` that is
    // closed until a reader opens it.
    if (step.text !== '') item.append(termBody(step.text));
    list.append(item);
  }
  fold.append(list);

  if (body.stepsOmitted > 0) {
    const more = el('p', 'tvcut');
    more.append(...ctx.t('conv.doc.stepsOmitted', { n: body.stepsOmitted }));
    fold.append(more);
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
function mountDocument(ctx, host, outline, back) {
  const nodes = outline.nodes;

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
  facts.append(' · ', mono(sizeText(outline.bytes)));
  head.append(facts);
  host.append(head);

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

  const toTop = el('button', 'tvjump');
  toTop.type = 'button';
  toTop.append(...ctx.t('conv.doc.top'));
  const toEnd = el('button', 'tvjump');
  toEnd.type = 'button';
  toEnd.append(...ctx.t('conv.doc.end'));
  bar.append(toTop, toEnd);
  host.append(bar);

  const count = el('p', 'tvcount');
  count.setAttribute('aria-live', 'polite');
  host.append(count);

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
  follows.append(...ctx.t('conv.doc.follows', { secs: TIP_MS / 1000 }));
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
   */
  let stickUntil = 0;
  const STICK_MS = 3_000;

  const heightOf = (nodeIndex) => known.get(nodeIndex) ?? estimateHeight(nodes[nodeIndex]);

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
    return body.kind === 'said' ? drawTurn(ctx, body) : drawWork(ctx, body);
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
      if (!want.has(nodeIndex) || (waiting.has(nodeIndex) && bodies.has(nodeIndex))) {
        node.remove();
        live.delete(nodeIndex);
        waiting.delete(nodeIndex);
      }
    }
    // Build what is missing and PLACE everything. A row already in the DOM is
    // moved, never rebuilt — a `<details>` a reader opened must survive a
    // two-pixel scroll, and rebuilding would shut every one of them.
    for (const i of wanted) {
      const nodeIndex = view[i];
      let row = live.get(nodeIndex);
      if (row === undefined) {
        row = buildRow(nodeIndex);
        row.classList.add('tvrow');
        live.set(nodeIndex, row);
        inner.append(row);
      }
      // A COMPUTED value, never a static one: `check-cssom-restatement.ts`
      // refuses an inline write that restates what the stylesheet says, and
      // this number exists only at runtime.
      row.style.insetBlockStart = `${Math.round(scroller.top(i))}px`;
    }
    inner.style.blockSize = `${Math.round(scroller.total)}px`;

    // Ask for the first body this window is missing. One request covers
    // `FETCH_PAGE` consecutive nodes, so a scroll asks about once per screen.
    for (const i of wanted) {
      const nodeIndex = view[i];
      if (!bodies.has(nodeIndex) && !inflight.has(nodeIndex)) { void fetchFrom(nodeIndex); break; }
    }

    if (measure()) {
      rebuild();
      for (const i of wanted) {
        const row = live.get(view[i]);
        if (row !== undefined) row.style.insetBlockStart = `${Math.round(scroller.top(i))}px`;
      }
      inner.style.blockSize = `${Math.round(scroller.total)}px`;
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

  toTop.addEventListener('click', () => { scroll.scrollTop = 0; paint(); });
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

  const applyFilter = () => {
    reView();
    for (const [, row] of live) row.remove();
    live.clear();
    waiting.clear();
    scroll.scrollTop = 0;
    paint();
  };
  find.addEventListener('input', applyFilter);
  applyFilter();

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
      seenBytes = tail.bytes;
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
      outline.records = 0;
      for (const node of nodes) {
        if (node.k === 'said') outline.said += 1; else outline.work += 1;
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
  if (outline.truncated !== true) {
    tipTimer = setInterval(tick, TIP_MS);
    window.addEventListener('hashchange', onLeave);
  } else {
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

  root.append(helpDisclosure(ctx, 'conv.help.summary', [
    ...ctx.t('conv.help.body'),
  ]));

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
    drawList(ctx, card, body, open);
    return;
  }

  const viewer = el('section', 'tvroot');
  root.append(viewer);

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
  mountDocument(ctx, viewer, outline, back);
}
