// src/ui/public/lib/passage.js
//
// TURNING A MARKED PASSAGE INTO SOMETHING A TERMINAL WILL ACCEPT —
// `TASK-a-selected-passage-copies-as-something-a-terminal-will`.
//
// ── THE THREE FORMS, AND WHY THE OWNER'S TWO WERE NOT ENOUGH ──────────────
//
// He asked to mark a section and copy it into a context window, and asked
// which source was right: the rendered browser text, or the raw session file.
// The item's answer is that the best one for a terminal is NEITHER, and his
// own amendment — "you can actually allow the user both formats for different
// purposes" — makes it three:
//
//   1. MESSAGE TEXT   the record's text, no JSON envelope, no presentation
//                     layer. THE DEFAULT. This module builds it.
//   2. RENDERED TEXT  what he can see. The BROWSER builds it — see
//                     `conversations.js`, which uses `Selection.toString()`
//                     and does not reimplement it here. The item's reason for
//                     ruling that form out was MEASURED and turned out to be
//                     the wrong reason —
//                     `NOTE-the-dom-selection-was-measured-and-it-carries-no-bidi`
//                     — while the ruling itself stands, on the fact that a
//                     virtualised screen only holds what is drawn.
//   3. RAW RECORD     the JSONL exactly as created. The SERVER builds it, as
//                     a byte slice — `/api/conversations/:id/raw`.
//
// Each is named on screen by what it is FOR. A menu offering "text / rendered
// / raw" makes a reader guess; one offering "paste into a prompt / paste as it
// looks / the exact record" does not.
//
// ── WHAT THIS FILE IS, AND WHAT IT DELIBERATELY IS NOT ────────────────────
//
// It is a pure text assembler over `DocNodeBody` values. It touches no DOM, no
// `document`, no clipboard and no string table: every word it emits arrives
// through the `l` argument (`t`, `speaker`, `synthetic`, `stamp`), so the same
// function serves both languages and `node --test` can drive it with a stub.
// `renderedText` has no counterpart here for the reason stated above.
//
// ── THE ONE RULE THAT SHAPES EVERY BRANCH ─────────────────────────────────
//
// `INV-nothing-is-dropped-silently`, in the item's own words: *"A clipboard
// that quietly drops the middle of a passage is worse than one that refuses."*
// So a closed fold contributes a SENTENCE saying what was left out, and a
// synthetic turn carries a clause saying nobody typed it. The one thing that
// is dropped without a line in the payload — a shell call's non-`command`
// arguments in the bare single-command case — is named on the SCREEN instead,
// and the reason is in `barePassage`.

/**
 * The most sections one copy will take.
 *
 * **It refuses rather than truncates**, which is the item's own preference.
 * The bound exists because filling the passage costs one request per
 * `FETCH_PAGE` nodes that are not already cached, and a reader who drags a
 * selection down a 4,916-node document would otherwise fire two hundred of
 * them at the server.
 *
 * 400 is generous against the thing it bounds: a `Ctrl+A` inside the well
 * reaches only what is drawn, which is about thirty rows, so a passage this
 * size takes a deliberate scroll with the shift key down. On the owner's own
 * session it is 8% of the whole document.
 */
export const PASSAGE_NODE_CAP = 400;

/** Longest byte slice the raw form will take. See `apiConversationRaw`. */
export const PASSAGE_RAW_CAP = 8 * 1024 * 1024;

/** A value that is not a string, as the JSON it is. Never `[object Object]`. */
function jsonOf(value) {
  try {
    const json = JSON.stringify(value, null, 2);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

/** One named argument of a call, by name, or `undefined`. */
export function fieldOf(input, name) {
  for (const field of input ?? []) if (field.name === name) return field.value;
  return undefined;
}

/**
 * A call's arguments as lines.
 *
 * A multi-line value goes on lines of its own under its name, because a
 * `content` argument holding a whole file on one `name: value` line is not
 * something anybody reads — the same judgement `shortArg` makes on screen with
 * `ARG_INLINE`, made here in characters instead of pixels.
 */
function fieldLines(input, skip, out) {
  for (const field of input ?? []) {
    if (skip.includes(field.name)) continue;
    const value = typeof field.value === 'string' ? field.value : jsonOf(field.value);
    out.push(value.includes('\n') ? `${field.name}:\n${value}` : `${field.name}: ${value}`);
  }
}

/** Names of the arguments `fieldLines` would emit — what a bare copy omits. */
function fieldNames(input, skip) {
  const names = [];
  for (const field of input ?? []) if (!skip.includes(field.name)) names.push(field.name);
  return names;
}

/** One record inside an opened fold: what ran, what it was asked, what came back. */
function stepLines(step, out) {
  const name = step.tool ?? step.subtype ?? step.type;
  const detail = step.detail === null || step.detail === '' ? '' : ` — ${step.detail}`;
  out.push(`### ${name}${detail}`);
  fieldLines(step.input, [], out);
  if (step.text !== '') out.push(step.text);
}

/** A question, every option it offered, and what was answered. */
function askLines(body, step, l, out) {
  const asked = fieldOf(step?.input, 'questions');
  const questions = Array.isArray(asked) ? asked : [];
  for (const question of questions) {
    if (question === null || typeof question !== 'object') continue;
    const text = typeof question.question === 'string' ? question.question : '';
    out.push(text);
    const answer = (body.answers ?? []).find((a) => a.question === text);
    const chosen = answer === undefined || answer.answer === null ? null : answer.answer;
    let matched = false;
    const options = Array.isArray(question.options) ? question.options : [];
    for (const option of options) {
      if (option === null || typeof option !== 'object') continue;
      const label = typeof option.label === 'string' ? option.label : '';
      // The answer sentence carries the label the harness wrote, which for a
      // recommended option ends in a marker the option itself does not have —
      // so the test is `includes`, exactly as `askParts` does it on screen.
      const picked = chosen !== null && label !== '' && chosen.includes(label);
      if (picked) matched = true;
      const why = typeof option.description === 'string' && option.description !== ''
        ? ` — ${option.description}` : '';
      out.push(`- ${label}${why}${picked ? ` [${l.t('conv.doc.deed.chose')}]` : ''}`);
    }
    if (chosen === null) out.push(l.t('conv.doc.deed.noAnswer'));
    else if (!matched || chosen.length > 120) out.push(chosen);
  }
  if (typeof body.answerText === 'string' && body.answerText !== '') out.push(body.answerText);
  fieldLines(step?.input, ['questions'], out);
}

/**
 * THE NAME AT THE TOP OF A SECTION, and the clause that keeps it honest.
 *
 * **A synthetic turn carries `conv.copy.notTyped` and it is not decoration.**
 * The owner read a row headed *You* above *"Background task finished"* and took
 * it for his own input being overridden (`plan:archive seq:28`). A copy is
 * WORSE than a screen here, because the passage travels into a prompt with no
 * chip, no dimming and no glyph beside it — the heading is the only thing left
 * that can say a person did not type this, so it says it in words.
 *
 * The shape is the owner's own export format, which `drawTurn` already follows:
 * `## User:` with the timestamp on a quoted line beneath. Nothing new invented.
 */
export function passageHead(body, l) {
  const parts = [];
  const who = l.speaker(body.who);
  if (who !== null) parts.push(who);
  if (body.kind === 'deed') {
    parts.push(l.t(body.deed === 'ask' ? 'conv.doc.deed.ask' : 'conv.doc.deed.ran'));
    if (body.outcome !== null) {
      parts.push(l.t(body.outcome === 'failed' ? 'conv.doc.deed.bad' : 'conv.doc.deed.ok'));
    }
  } else if (body.kind === 'work') {
    parts.push(l.t(body.span === 1 ? 'conv.doc.fold1' : 'conv.doc.fold', { n: body.span }));
  } else if (body.synthetic !== null) {
    parts.push(l.synthetic(body.synthetic));
    parts.push(l.t('conv.copy.notTyped'));
  }
  // A `said` turn nobody caused and nothing labelled. Measured zero on the
  // owner's session — every speaker-less turn is synthetic — and named rather
  // than left as a heading reading `## `.
  if (parts.length === 0) parts.push(l.t('conv.copy.turn'));
  const lines = [`## ${parts.join(' · ')}`];
  const stamp = l.stamp(body.timestamp);
  if (stamp !== null) lines.push(`> ${stamp}`);
  return lines.join('\n');
}

/**
 * ONE SECTION'S CONTENT, with `open` deciding what a fold contributes.
 *
 * **`open` is read off the screen, not guessed.** A `<details>` the reader
 * opened contributes every record inside it; one still shut contributes a
 * sentence naming how many were left out. That is the fold rule the item asks
 * for — *"either include its content or say it was omitted"* — resolved in
 * favour of MIRRORING WHAT THE READER SAW, which has one property no other
 * answer has: it is reversible by the reader, in one click, without leaving
 * the passage they marked.
 *
 * A node that is not drawn at all has no fold state and is therefore SHUT,
 * which is the same answer the screen would give if it were drawn — a fold
 * opens closed.
 */
export function passageBody(body, open, l) {
  const lines = [];
  let shutRecords = 0;

  if (body.kind === 'work') {
    if (open) for (const step of body.steps) stepLines(step, lines);
    else {
      shutRecords = body.span;
      lines.push(l.t('conv.copy.shutFold', { n: body.span }));
    }
    return { lines, shutRecords };
  }

  if (body.kind === 'deed') {
    const step = body.steps.length > 0 ? body.steps[0] : null;
    if (step === null) return { lines, shutRecords };
    if (body.deed === 'ran') {
      // THE COMMAND EXACTLY AS IT RAN — the case the owner named, and the one
      // sentence of the item that is about characters rather than about menus.
      const command = fieldOf(step.input, 'command');
      if (typeof command === 'string') lines.push(command);
      fieldLines(step.input, ['command'], lines);
    } else {
      askLines(body, step, l, lines);
    }
    return { lines, shutRecords };
  }

  if (body.text !== '') lines.push(body.text);
  if (body.thinking !== '') {
    if (open) lines.push(body.thinking);
    else lines.push(l.t('conv.copy.shutThinking'));
  }
  // A turn that ALSO called a tool. 3 records of 31,101 on the owner's file,
  // and served beside the words rather than dropped for being rare.
  for (const step of body.steps) stepLines(step, lines);
  return { lines, shutRecords };
}

/**
 * ONE SECTION, WITH NO HEADING AT ALL — or `null` when that would lie.
 *
 * **This is the owner's own case and the reason the default is what it is.**
 * He marks a shell command and pastes it into a terminal. `## Shell · Command`
 * above it would make the paste fail, so a passage of exactly one node that
 * can stand alone is copied bare.
 *
 * **`null` for everything that cannot.** A synthetic turn bare would present
 * a task notification as something a person typed; a folded run bare would be
 * a disclosure sentence with nothing to disclose about; a question bare would
 * lose which option was chosen. Each of those keeps its heading.
 *
 * **AND THE ONE DELIBERATE OMISSION IN THIS WHOLE MODULE IS HERE.** A bare
 * `ran` copy is the command and NOTHING else — not its `description`, not its
 * `timeout` — because a terminal will not accept them. They are named on the
 * SCREEN, in `conv.copy.leftArgs`, rather than in the payload: putting them in
 * the payload is exactly the failure this branch exists to avoid. `dropped`
 * carries the names so the caller can say them.
 */
export function barePassage(body) {
  if (body.kind === 'deed' && body.deed === 'ran') {
    const step = body.steps.length > 0 ? body.steps[0] : null;
    const command = fieldOf(step?.input, 'command');
    if (typeof command !== 'string') return null;
    return { text: command, dropped: fieldNames(step?.input, ['command']) };
  }
  if (body.kind !== 'said') return null;
  if (body.synthetic !== null) return null;
  if (body.thinking !== '' || body.steps.length > 0) return null;
  // It takes no `l`, and that is the tell: a bare copy emits NO SENTENCE OF
  // THIS APP'S at all. Every branch that would need a word of English or
  // Hebrew is one of the `null`s above.
  return { text: body.text, dropped: [] };
}

/**
 * THE WHOLE PASSAGE, AS MESSAGE TEXT.
 *
 * `bodies` must be in ascending `n` — the order of the DOCUMENT, which is not
 * the order of the DOM. See `passageSpan` in `conversations.js` for why those
 * two are allowed to differ and why nothing here depends on the second.
 *
 * `open` is a `Set` of node indices whose fold the reader has opened.
 */
export function messagePassage(bodies, open, l) {
  const notes = { sections: bodies.length, shutFolds: 0, shutRecords: 0, dropped: [] };
  if (bodies.length === 0) return { text: '', notes };
  if (bodies.length === 1) {
    const bare = barePassage(bodies[0]);
    if (bare !== null) {
      notes.dropped = bare.dropped;
      return { text: bare.text, notes };
    }
  }
  const blocks = [];
  for (const body of bodies) {
    const part = passageBody(body, open.has(body.n), l);
    if (part.shutRecords > 0) {
      notes.shutFolds += 1;
      notes.shutRecords += part.shutRecords;
    }
    blocks.push([passageHead(body, l), ...part.lines].join('\n\n'));
  }
  return { text: blocks.join('\n\n'), notes };
}

/**
 * Ascending node indices, grouped into runs that are consecutive.
 *
 * **The raw form needs this and the other two do not.** A raw copy is a BYTE
 * SLICE of the transcript, and a slice is only meaningful over records that sit
 * next to each other in the file. With the reader's filter narrowing the view,
 * the sections they marked can have gaps in them — so the slice is asked for
 * once per run, and the runs are joined in file order.
 */
export function runsOf(indices) {
  const runs = [];
  for (const index of indices) {
    const last = runs.length === 0 ? null : runs[runs.length - 1];
    if (last !== null && index === last.to + 1) last.to = index;
    else runs.push({ from: index, to: index });
  }
  return runs;
}
