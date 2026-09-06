/**
 * **The Library's command-line half: one selection box, one subject.**
 *
 * `TASK-the-library-explains-the-command-line-every-switch-parameter`, owner
 * requirement 2026-09-06: *"the command-line help, structured and explained,
 * with examples and simple explanations. Every switch, parameter and option
 * explained. A selection box so a reader can ask for help on a specific
 * subject — a command, a slash command, and so on — rather than scrolling."*
 *
 * ── NOT ONE NAME ON THIS SCREEN IS TYPED IN THIS FILE ─────────────────────
 *
 * The requirement says why in as many words: *"a flag list spelled into a
 * screen is the drift this project measures in days — the command catalogue
 * said '38 commands' and was right on 2026-08-24."* So there is no command
 * list here, no flag list, no topic list and no count. `GET /api/cli-help`
 * answers with the roster, read on this request out of `COMMAND_FLAGS`,
 * `SUBCOMMAND_FLAGS`, `FLAG_DECLARATIONS`, `editFlagSurface(config)`,
 * `MCP_HELP_TOPICS`, the MCP tool registry and the committed `commands/*.md` —
 * and `GET /api/cli-help/:kind/:id` answers about one of them. What this file
 * holds is the DRAWING: which element a row is, which string key labels it,
 * and what happens when the picker changes.
 *
 * The only strings are keys into `strings/en.js` and `strings/he.js`, which is
 * the same bargain every screen makes and is what makes the Hebrew console a
 * translation rather than a second implementation.
 *
 * ── THE EXAMPLES ARE COMMAND OUTPUT, NOT PROSE ────────────────────────────
 *
 * Every worked example on this card is a block `scripts/gen-doc-examples.ts`
 * produced by RUNNING the real command against the committed fixture, and
 * `test/docs/examples.test.ts` re-runs the same command and fails when the
 * block no longer matches. Nothing on this card was written by anybody as an
 * illustration. A command the README does not demonstrate shows no example
 * rather than an invented one, and the card says which of the two it is.
 *
 * That is also why a topic is drawn as a `<pre>` transcript. The Library
 * screen "READS NO MARKDOWN" — `/doc.html` is where a document is read, and
 * this file imports no renderer and draws no document body. What it draws for
 * `mycontext help slash` is the TEXT that command prints in a terminal, which
 * is the same kind of thing as the examples below it: command output, shown as
 * output. The console is not becoming a documentation site.
 *
 * ── THE SELECT, AND THE TRAP THAT IS ALREADY ON THIS PAGE'S RECORD ────────
 *
 * A plain `<select>` on a console screen once put 2,559px of horizontal
 * overflow into `main` with 942 options, because a select's shrink-to-fit
 * never goes below its widest OPTION — min-content equals max-content when the
 * text cannot wrap. `styles.css` bounds `label.small select`, and this picker
 * is built with `capture.js`'s own `labelled()` shape (the select nested
 * INSIDE the label) so that it is reached by that existing rule rather than
 * needing a second one. Its longest option is a slash-command label, an order
 * of magnitude shorter than the id picker that caused the overflow — but the
 * cap is what makes that a measurement rather than a hope.
 *
 * `<optgroup>` per kind, because 164 flat options is the scroll the
 * requirement asked to replace. The group LABELS come from the string table;
 * the group MEMBERSHIP comes from the endpoint's own `kind`.
 */
import { el, errorNote, mono, spaced } from '/screens/parts.js';
import { markdownNodes } from '/lib/markdown.js';

/** The kinds, in the order their groups are drawn. Order only — never a roster:
 *  every option in every group comes from the endpoint's `subjects`. */
const KINDS = [
  { kind: 'command', key: 'clih.gcmd' },
  { kind: 'slash', key: 'clih.gslash' },
  { kind: 'tool', key: 'clih.gtool' },
  { kind: 'topic', key: 'clih.gtopic' },
];

/** `capture.js`'s own shape, so `label.small select` in styles.css reaches it. */
function labelled(caption, control) {
  const label = el('label', 'small');
  label.append(document.createTextNode(caption), ' ', control);
  return label;
}

function optionEl(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

/**
 * The address of one subject. Both halves are encoded: a slash-command name is
 * `[a-z0-9-]+` today, and encoding it is what keeps that from being a rule this
 * file quietly depends on.
 *
 * Exported and pure so `node --test` can measure it without a browser — the
 * same bargain every parse in this app makes.
 */
export function subjectHref(kind, id) {
  return `/api/cli-help/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

/**
 * What a flag TAKES, as one cell.
 *
 * The three shapes are mutually exclusive and one of them always holds —
 * `test/cli/command-flags.test.ts` requires every value-taking flag to declare
 * either a closed set or a format with an example, over both key spaces — so a
 * fourth branch here would be dead code claiming a case that cannot arrive.
 * A bare switch is stated rather than left blank: an empty cell reads as a
 * missing answer, and "this one takes no value" is an answer.
 */
function takesCell(ctx, flag) {
  const cell = el('td');
  if (Array.isArray(flag.values) && flag.values.length > 0) {
    cell.append(...ctx.t('clih.oneof'));
    for (const [i, value] of flag.values.entries()) {
      if (i > 0) cell.append(', ');
      cell.append(mono(value));
    }
    return cell;
  }
  if (typeof flag.format === 'string') {
    cell.append(flag.format);
    if (typeof flag.example === 'string' && flag.example !== '') {
      cell.append(' ', ...ctx.t('clih.eg'), ' ', mono(flag.example));
    }
    return cell;
  }
  // `.small` already carries `--dim`; there is no separate dimming class and
  // inventing one would be a second spelling of the same colour token.
  const bare = el('span', 'small');
  bare.append(...ctx.t('clih.bare'));
  cell.append(bare);
  return cell;
}

/** One flag table. Returns null when there are no rows, so a caller can say
 *  WHY there are none instead of drawing an empty header. */
function flagTable(ctx, flags) {
  if (flags.length === 0) return null;
  const table = el('table', 'flagtable');
  const head = el('tr');
  for (const key of ['clih.cflag', 'clih.ctakes', 'clih.cmeans']) {
    const th = el('th');
    th.append(...ctx.t(key));
    head.append(th);
  }
  table.append(head);
  for (const flag of flags) {
    const row = el('tr');
    const name = el('td');
    name.append(mono(`--${flag.flag}`));
    row.append(name, takesCell(ctx, flag));
    const means = el('td');
    means.append(flag.note);
    if (typeof flag.source === 'string') {
      // A per-workspace vocabulary is not a value this page can print, and
      // saying so is the honest answer: the legal set depends on config.json,
      // so the reader is told to ask their own project rather than shown a
      // list that happens to be true here.
      const ask = el('p', 'small');
      ask.append(...ctx.t('clih.ask', { source: flag.source }));
      means.append(ask);
    }
    row.append(means);
    table.append(row);
  }
  return table;
}

/** The worked examples, drawn as what they are: a command line and the output
 *  it produced. Never edited here — see this file's header. */
function paintExamples(ctx, host, examples) {
  const heading = el('p', 'welllabel');
  heading.append(...ctx.t('clih.ex'));
  host.append(heading);

  if (examples.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('clih.exnone'));
    host.append(none);
    return;
  }
  for (const example of examples) {
    // `.excmd` and not a bare `.small`: a marker like the README's `add
    // constraint "Uploads capped at 10 MB" --body "…"` is one 600-character
    // command line, and MEASURED in the browser on 2026-09-06 its `span.m`
    // laid out at 2,321px — which pushed `main.body`'s single auto grid track
    // to 2,696px against a 1,403px viewport and put 1,325px of horizontal
    // overflow on the page. Same failure as the 942-option select, arriving
    // through prose instead of through a control. It SCROLLS rather than
    // wrapping, because a shell command broken across lines mid-flag is a
    // command a reader cannot copy.
    const line = el('p', 'small excmd');
    line.append(mono(example.command));
    host.append(line);
    host.append(el('pre', 'm transcript', example.output));
  }
  const how = el('p', 'small');
  how.append(...ctx.t('clih.exhow'));
  host.append(how);
}

/**
 * One command. Four shapes, and the shape is `surface` — the endpoint's own
 * word for WHICH of the four records holds this command's flags, which is the
 * question `plan:library seq:1` had to answer before "every switch explained"
 * was a claim anybody could make.
 */
function paintCommand(ctx, host, body) {
  if (body.surface === 'none') {
    const none = el('p', 'small');
    none.append(...ctx.t('clih.noflags'));
    host.append(none);
  } else if (body.surface === 'subcommand') {
    const note = el('p', 'small');
    note.append(...ctx.t('clih.subs'));
    host.append(note);
    for (const sub of body.subcommands) {
      const heading = el('p', 'welllabel');
      heading.append(mono(`${body.label} ${sub.subcommand}`));
      host.append(heading);
      const table = flagTable(ctx, sub.flags);
      if (table === null) {
        const empty = el('p', 'small');
        empty.append(...ctx.t('clih.subnoflags'));
        host.append(empty);
      } else {
        host.append(table);
      }
    }
  } else {
    if (body.surface === 'dynamic') {
      const note = el('p', 'small');
      note.append(...ctx.t('clih.dynamic'));
      host.append(note);
      // The count is the endpoint's, measured against THIS project's config on
      // the request that asked, so it moves when a category declares a flag.
      const declared = Array.isArray(body.declared) ? body.declared : [];
      const mine = el('p', 'small');
      mine.append(...ctx.t('clih.declared', { n: declared.length }));
      for (const [i, flag] of declared.entries()) {
        mine.append(i === 0 ? ' ' : ', ', mono(`--${flag}`));
      }
      host.append(mine);
    }
    const table = flagTable(ctx, body.flags);
    if (table !== null) host.append(table);
  }
  paintExamples(ctx, host, body.examples ?? []);
}

/** One MCP tool: its description and its schema's own arguments. */
function paintTool(ctx, host, body) {
  const summary = el('p', 'small');
  summary.append(body.description);
  host.append(summary);

  if (body.args.length === 0) {
    const none = el('p', 'small');
    none.append(...ctx.t('clih.noargs'));
    host.append(none);
    return;
  }
  const table = el('table', 'flagtable');
  const head = el('tr');
  for (const key of ['clih.carg', 'clih.ctakes', 'clih.cmeans']) {
    const th = el('th');
    th.append(...ctx.t(key));
    head.append(th);
  }
  table.append(head);
  for (const arg of body.args) {
    const row = el('tr');
    const name = el('td');
    name.append(mono(arg.argument));
    if (arg.required === true) {
      // Bold rather than a `.chip`: the five chip hues are a budgeted meaning
      // set (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`)
      // and "this argument is required" is not one of the five verdicts.
      const req = el('b');
      req.append(...ctx.t('clih.req'));
      name.append(' ', req);
    }
    const takes = el('td');
    if (Array.isArray(arg.values) && arg.values.length > 0) {
      takes.append(...ctx.t('clih.oneof'));
      for (const [i, value] of arg.values.entries()) {
        if (i > 0) takes.append(', ');
        takes.append(mono(value));
      }
    } else {
      takes.append(mono(arg.type ?? '—'));
    }
    const means = el('td');
    means.append(arg.note);
    row.append(name, takes, means);
    table.append(row);
  }
  host.append(table);
}

/** One slash command: what its file declares, and who may type it. */
function paintSlash(ctx, host, body) {
  const summary = el('p', 'small');
  summary.append(body.description);
  host.append(summary);

  // What it takes. Owner review 2026-09-06: "most if not all the slash
  // commands does not shows parameters like the cli commands does" — and they
  // did not, though 90 of the 91 files had declared it since they were
  // generated. The hint is Claude Code's own `argument-hint` spelling, so it
  // is shown VERBATIM rather than parsed into a flag table: it is one string
  // written for a person, and splitting it on brackets would invent a
  // structure the source does not have.
  //
  // `mono` for the same reason the flag names are mono — it is literal text a
  // reader types — and the absence is NAMED rather than left blank, because
  // "takes no argument" and "nobody wrote it down" are different facts and
  // `LoadMyContext` is genuinely the first.
  const takes = el('p', 'small');
  if (typeof body.argumentHint === 'string' && body.argumentHint !== '') {
    takes.append(...ctx.t('clih.slashargs'), ' ', mono(body.argumentHint));
  } else {
    takes.append(...ctx.t('clih.slashnoargs'));
  }
  host.append(takes);

  const who = el('p', 'small');
  who.append(...ctx.t(body.modelInvocable === true ? 'clih.slashmodel' : 'clih.slashuser'));
  host.append(spaced(who));
}

/**
 * One help topic, RENDERED as the Markdown it already is.
 *
 * Owner request 2026-09-06: "they are already markdown, just render them as
 * such and not as simple print text". It was a `<pre class="m transcript">`
 * until then, on the reasoning that a topic is what the terminal prints — but
 * `src/help/topics/*.md` are Markdown files with headings, lists and fenced
 * code, and a `<pre>` showed the reader the `##` rather than the heading.
 *
 * `markdownNodes` is THE renderer — the same one the item pane and `/doc.html`
 * use, lifted out of the Docs screen on 2026-09-05 precisely so a second one
 * never gets written. `.md` is the console's own body-text class, so a topic
 * now reads like an item body rather than like a paste.
 *
 * Two things borrowed from `app.js`'s call site rather than rediscovered: it
 * answers `{ nodes, refusals }`, so spreading the return value bare throws
 * AFTER the surrounding card is built and silently keeps the previous
 * subject's text — spread `.nodes`; and it produces NO HTML string anywhere,
 * which is what makes it safe on text this screen did not author.
 */
function paintTopic(ctx, host, body) {
  const how = el('p', 'small');
  how.append(...ctx.t('clih.topichow', { cmd: body.label }));
  host.append(how);
  const topic = el('div', 'md topicbody');
  topic.append(...markdownNodes(body.markdown ?? '', document).nodes);
  host.append(topic);
}

/**
 * Draw one subject into `pane`, replacing whatever was there.
 *
 * The pane is emptied FIRST and the fetch awaited after, so a reader who
 * changes the picker twice quickly never sees the previous subject's flags
 * under the new subject's heading. The `seq` guard is what makes that true for
 * the ANSWERS as well: two reads in flight settle in whatever order the server
 * chooses, and without it the slower of the two would paint last.
 */
async function paintSubject(ctx, pane, subject, seq, current) {
  pane.replaceChildren();
  if (subject === null) {
    const hint = el('p', 'small');
    hint.append(...ctx.t('clih.nopick'));
    pane.append(hint);
    return;
  }
  const heading = el('h3');
  heading.append(mono(subject.label));
  pane.append(heading);

  let body;
  try {
    body = await ctx.api(subjectHref(subject.kind, subject.id));
  } catch (error) {
    if (current() !== seq) return;
    pane.append(errorNote(error.message));
    return;
  }
  if (current() !== seq) return;
  if (body === null || typeof body !== 'object' || body.kind !== subject.kind) {
    pane.append(errorNote(`cli-help: /api/cli-help answered without a ${subject.kind} body`));
    return;
  }
  if (subject.kind === 'command') paintCommand(ctx, pane, body);
  else if (subject.kind === 'tool') paintTool(ctx, pane, body);
  else if (subject.kind === 'slash') paintSlash(ctx, pane, body);
  else paintTopic(ctx, pane, body);
}

/**
 * The card. Appended to the Library screen by `library.js`; it owns nothing
 * outside the element it is handed, so the corpus-tree half of this screen and
 * this half cannot collide over the screen's shell.
 */
export async function paintCliHelp(ctx, host) {
  const card = el('div', 'card pane');
  card.dataset.role = 'nav';
  host.append(card);

  const heading = el('h3');
  heading.append(...ctx.t('clih.h'));
  card.append(heading);
  const sub = el('p', 'small');
  sub.append(...ctx.t('clih.sub'));
  card.append(sub);

  let index;
  try {
    index = await ctx.api('/api/cli-help');
    if (index === null || typeof index !== 'object' || !Array.isArray(index.subjects)) {
      throw new Error('cli-help: /api/cli-help answered without a subjects array');
    }
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }

  // Every figure here is the endpoint's, measured on this request. None of the
  // four is a number this file could state and none of them is checked against
  // a constant, which is the whole point of the requirement.
  const counts = el('p', 'small');
  counts.append(...ctx.t('clih.counts', {
    commands: index.counts.command,
    slash: index.counts.slash,
    tools: index.counts.tool,
    topics: index.counts.topic,
    flags: index.flagRows,
  }));
  card.append(counts);

  const select = document.createElement('select');
  select.append(optionEl('', ctx.tFlat('clih.choose')));
  for (const { kind, key } of KINDS) {
    const rows = index.subjects.filter((row) => row.kind === kind);
    // A group with no rows draws no heading: an empty "Slash commands" band
    // would be a claim the endpoint does not support.
    if (rows.length === 0) continue;
    const group = document.createElement('optgroup');
    group.label = ctx.tFlat(key);
    for (const row of rows) group.append(optionEl(`${row.kind}/${row.id}`, row.label));
    select.append(group);
  }
  card.append(labelled(ctx.tFlat('clih.pick'), select));

  const withheld = el('p', 'small');
  withheld.append(...ctx.t('clih.withheld'));
  card.append(spaced(withheld));

  const pane = el('div', 'clihdetail');
  card.append(pane);

  let seq = 0;
  const current = () => seq;
  select.addEventListener('change', () => {
    seq += 1;
    const value = select.value;
    const slash = value.indexOf('/');
    const subject = slash === -1
      ? null
      : { kind: value.slice(0, slash), id: value.slice(slash + 1) };
    const row = subject === null
      ? null
      : index.subjects.find((s) => s.kind === subject.kind && s.id === subject.id) ?? null;
    void paintSubject(ctx, pane, row, seq, current);
  });
  await paintSubject(ctx, pane, null, seq, current);
}
