// The conversation archive — a list, then a transcript, then folding and
// search (`plan:archive seq:3`, step 3 of five in
// docs/superpowers/specs/2026-09-04-conversation-archive-design.md).
//
// ── WHAT THIS SCREEN IS FOR ───────────────────────────────────────────────
//
// The owner asked for "an ongoing recording of the conversation ... i need a
// way to browse, retrieve and display the content at a later time, there
// should be a distinguishable way like color, tag, title or other way to mark
// user input as prompt vs agent answers and output", and for browsing to be a
// web feature rather than a terminal one.
//
// So the whole point is RENDERING rather than dumping a file, and the mark
// that makes it worth rendering is `kind` — `prompt`, `answer` or `machinery`
// — computed by the endpoint. See `classifyTurn` in
// `core/conversation-index.ts` for why that is not `message.role`: measured on
// this project's own 52 MB transcript, 2,504 of 2,954 role-"user" records are
// TOOL RESULTS, which nobody typed.
//
// ── DISTINCT BY MORE THAN COLOUR ──────────────────────────────────────────
//
// The design says so in as many words, and the reason is this app's own: it is
// bilingual and themed, and colour is not the only channel available. Every
// turn therefore carries a CHIP with a glyph and a keyed word — `data-g` plus
// text — beside its border accent, so the distinction survives a monochrome
// print, a colour-blind reader, and the RTL flip.
//
// ── THE MOCKUP DREW NO CONVERSATION SCREEN ────────────────────────────────
//
// Checked before building: `docs/design/web-ui-mockup.html` has no
// conversation, transcript or archive section — measured 2026-09-07. There is
// no design of record to follow here and none to contradict, so this is built
// out of the primitives the other twenty screens already share: `.card pane`,
// `.plate` for anything that displays a quantity, `.rows`/`.row`, `.chip` with
// one of the five budgeted hues, `boundedList` for the bound, `helpDisclosure`
// for depth, and `errorNote` drawn INSTEAD of the data.
//
// ── NOTHING HERE WRITES ───────────────────────────────────────────────────
//
// The index is built by `mycontext conversation rebuild`, a CLI write, because
// this server cannot create it. When the archive has never been scanned the
// screen COMPOSES that command and the reader runs it — the Doctor screen's
// own shape, and the third nav section's promise: CHANGE — COMPOSED, NEVER RUN.

import {
  boundedList, el, errorNote, mono, screenHead, spaced,
} from './parts.js';
import { helpDisclosure } from '../lib/disclosure.js';

/** How many transcript records one fetch asks for. The endpoint caps at 200. */
const WINDOW = 50;

/**
 * The three kinds, each with the chip class, the glyph and the string key that
 * name it. ONE table, so the list legend, the transcript rows and the fold
 * summaries cannot drift into three vocabularies for one idea.
 *
 * `gov` / `ok` / `index` are three of the hues the palette already budgets —
 * no new hue is spent here, which `styles-parity.test.ts` checks.
 */
const KINDS = {
  prompt: { chip: 'gov', glyph: '▸', key: 'conv.kind.prompt' },
  answer: { chip: 'ok', glyph: '◆', key: 'conv.kind.answer' },
  machinery: { chip: 'index', glyph: '⚙', key: 'conv.kind.machinery' },
};

/**
 * What a folded row calls itself: the tool it ran, else the content blocks it
 * carries, else the harness's record type.
 *
 * The two obvious labels are each wrong on their own. `tool` is null for a
 * tool RESULT, and `type` is the string "user" for one — which is exactly the
 * confusion `classifyTurn` exists to remove, arriving back through the label.
 * Blocks are what the record actually holds.
 */
function foldLabel(record) {
  if (record.tool !== null) return record.tool;
  if (Array.isArray(record.blocks) && record.blocks.length > 0) return record.blocks.join(' + ');
  return record.type;
}

/** The chip that names a turn — glyph and word, never colour alone. */
function kindChip(ctx, kind) {
  const spec = KINDS[kind] ?? KINDS.machinery;
  const chip = el('span', `chip ${spec.chip}`);
  chip.dataset.g = spec.glyph;
  chip.append(...ctx.t(spec.key));
  return chip;
}

/** A title, or the honest absence of one. Never a fabricated name. */
function titleNodes(ctx, row) {
  if (row.title === null) return ctx.t('conv.untitled');
  const wrap = [el('bdi', 'convtitle', row.title)];
  // The model wrote it, and the reader is told so rather than left to assume a
  // person did — the spec asks for the title to be shown as what it is.
  if (row.titleSource === 'ai') {
    const by = el('span', 'small');
    by.append(' ', ...ctx.t('conv.titleByModel'));
    wrap.push(by);
  }
  return wrap;
}

/** `52,061,736` → `49.6 MB`. Sizes are read, not computed, by a person. */
function sizeText(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** An ISO stamp as a date a person reads. Invalid or absent stays absent. */
function dayText(iso) {
  if (typeof iso !== 'string') return null;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : iso.slice(0, 16).replace('T', ' ');
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

/* ══ THE TRANSCRIPT ════════════════════════════════════════════════════════ */

/**
 * One record. A prompt and an answer are drawn open; machinery is a real
 * `<details>`, folded by default.
 *
 * `<details>`/`<summary>` rather than a button and a class: it is keyboard
 * reachable, screen-reader announced and print-expandable for free, which is
 * the same reason `lib/disclosure.js` gives for using it. There is no click or
 * key handler anywhere below.
 */
function drawRecord(ctx, record) {
  const wrap = el('div', `convrec kind-${record.kind}`);

  const line = el('p', 'small convrecmeta');
  line.append(kindChip(ctx, record.kind));
  const day = dayText(record.timestamp);
  if (day !== null) { line.append(' ', mono(day)); }
  if (record.tool !== null) { line.append(' ', mono(record.tool)); }
  if (record.unreadable === true) {
    const bad = el('span', 'chip crit');
    bad.dataset.g = '⚠';
    bad.append(...ctx.t('conv.unreadable'));
    line.append(' ', bad);
  }

  const body = el('div', 'convtext plate');
  // **`dir="auto"`, and it is load-bearing rather than tidiness.** A record's
  // text is content in a language this app does not choose: an English turn
  // sitting in the Hebrew page's RTL flow renders its trailing full stop at
  // the WRONG END — ".Reading the spec first" — which is the same Unicode bidi
  // effect `library.js` wraps path segments in `<bdi>` for. Seen in the
  // Hebrew screenshot after every assertion had passed; `auto` makes the
  // browser infer direction from the record's own first strong character, so
  // an English turn reads LTR and a Hebrew one reads RTL, on either page.
  body.setAttribute('dir', 'auto');
  // `textContent`, never `innerHTML`: a transcript is arbitrary text a model
  // and a person wrote, and this app builds every node rather than parsing
  // markup — `lib/sanitize.js`' first structural guarantee, applied here by
  // not producing an HTML string at all.
  body.textContent = record.text;

  const cut = el('p', 'small spill');
  if (record.textTruncated === true) {
    cut.append(...ctx.t('conv.textCut', {
      shown: record.text.length, total: record.totalChars,
    }));
  }

  if (record.kind === 'machinery') {
    const fold = el('details', 'convfold');
    const summary = el('summary');
    summary.append(kindChip(ctx, record.kind));
    // The tool if it names one, else the record TYPE — so a fold is never a
    // row that says only "Tool step, 0 characters". A transcript carries
    // book-keeping records (`ai-title`, `attachment`, `file-history-snapshot`
    // and five more measured on the real file) which are neither prompt nor
    // answer; they are folded and NAMED rather than dropped, because a reader
    // who cannot see that a record was there cannot know one was skipped.
    summary.append(' ', mono(foldLabel(record)));
    summary.append(' ', ...ctx.t('conv.foldedChars', { chars: record.totalChars }));
    fold.append(summary, body);
    if (record.textTruncated === true) fold.append(cut);
    wrap.append(fold);
    return wrap;
  }

  wrap.append(line, body);
  if (record.textTruncated === true) wrap.append(cut);
  return wrap;
}

/**
 * The disclosures a transcript owes, drawn whether or not they have anything
 * to report — `library.js`' rule: a screen that only spoke up when something
 * was dropped leaves a reader unable to tell a complete answer from a check
 * that stopped running.
 */
function drawBounds(ctx, host, body) {
  const line = el('p', 'small');
  if (body.total === null) {
    line.classList.add('spill');
    line.append(...ctx.t('conv.walkCapped', { bytes: body.walkedBytes }));
  } else {
    line.append(...ctx.t('conv.window', {
      from: body.offset, to: body.offset + body.records.length, total: body.total,
    }));
  }
  host.append(spaced(line));

  const cap = el('p', 'small');
  cap.append(...ctx.t('conv.textCap', { cap: body.textCap }));
  host.append(cap);
}

/* ══ SEARCH WITHIN THE LOADED WINDOW ═══════════════════════════════════════ */

/**
 * The filter matches WHAT IS DISPLAYED and nothing else — `library.js`' rule,
 * and the reason it is stated: a filter that silently matched a record outside
 * the window would make the list respond to text no reader can see.
 *
 * So the count line says how many of the LOADED records matched, and names the
 * window it searched. It is a pure function so `conversations-screen.test.ts`
 * can assert it without a browser.
 */
export function matches(record, needle) {
  if (needle === '') return true;
  const hay = `${record.text} ${record.type} ${record.tool ?? ''}`.toLowerCase();
  return hay.includes(needle);
}

function drawTranscript(ctx, host, body, back) {
  const backButton = el('button', 'row convback');
  backButton.type = 'button';
  backButton.append(...ctx.t('conv.back'));
  backButton.addEventListener('click', back);
  host.append(backButton);

  const head = el('h3');
  head.append(...titleNodes(ctx, body));
  host.append(head);

  const meta = el('p', 'small');
  meta.append(mono(body.sessionId));
  if (body.branch !== null) { meta.append(' · ', mono(body.branch)); }
  meta.append(' · ', mono(sizeText(body.bytes)));
  host.append(meta);

  if (body.present === false) {
    const gone = el('p', 'small spill');
    gone.append(...ctx.t('conv.prunedBody'));
    host.append(spaced(gone));
    if (body.uncounted !== null) {
      const why = el('p', 'small');
      why.textContent = body.uncounted;
      host.append(why);
    }
    return;
  }

  drawBounds(ctx, host, body);

  const filterLine = el('p', 'small');
  const filterInput = el('input', 'filter');
  filterInput.type = 'text';
  filterInput.placeholder = ctx.tFlat('conv.filter');
  // A placeholder alone is not an accessible name.
  filterInput.setAttribute('aria-label', ctx.tFlat('conv.filter'));
  filterLine.append(filterInput);
  host.append(filterLine);

  const count = el('p', 'small convcount');
  count.setAttribute('aria-live', 'polite');
  host.append(count);

  const list = el('div', 'convlist');
  host.append(list);

  const drawn = body.records.map((record) => ({ record, node: drawRecord(ctx, record) }));
  for (const one of drawn) list.append(one.node);

  const apply = () => {
    const needle = filterInput.value.trim().toLowerCase();
    let shown = 0;
    for (const one of drawn) {
      // Rows are built once and toggled with `hidden`, never rebuilt — so an
      // open fold stays open across a filter, and the reader's own disclosure
      // state is not spent by typing.
      const hit = matches(one.record, needle);
      one.node.hidden = !hit;
      if (hit) shown += 1;
    }
    count.replaceChildren();
    count.append(...ctx.t(
      needle === '' ? 'conv.showingAll' : 'conv.showingMatch',
      { shown, total: drawn.length },
    ));
  };
  filterInput.addEventListener('input', apply);
  apply();
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

  const card = el('div', 'card pane');
  const title = el('h3');
  title.append(...ctx.t('conv.card'));
  card.append(title);
  root.append(card);

  const session = sessionFromHash(location.hash);
  const open = (id) => { ctx.navigate(`#/conversations/${encodeURIComponent(id)}`); };
  const back = () => { ctx.navigate('#/conversations'); };

  if (session === null) {
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

  let body;
  try {
    body = await ctx.api(
      `/api/conversations/${encodeURIComponent(session)}?limit=${WINDOW}&offset=0`);
  } catch (error) {
    card.append(errorNote(error.message));
    const backButton = el('button', 'row convback');
    backButton.type = 'button';
    backButton.append(...ctx.t('conv.back'));
    backButton.addEventListener('click', back);
    card.append(backButton);
    return;
  }
  drawTranscript(ctx, card, body, back);
}
