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
 * A HELP TOPIC IS RENDERED, AND THIS PARAGRAPH USED TO SAY THE OPPOSITE. It
 * read: *"a topic is drawn as a `<pre>` transcript … this file imports no
 * renderer and draws no document body"*, which was true until the owner's
 * 2026-09-06 request — *"they are already markdown, just render them as such
 * and not as simple print text"* — and false from the line above it onward,
 * where `markdownNodes` is imported. `paintTopic` carries the reasoning. The
 * console still reads no OTHER document: `/doc.html` is where a document is
 * read, and the renderer used here is the one the item pane already uses rather
 * than a second one.
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
 * One section heading of THE SKELETON — `plan:library seq:5`.
 *
 * The four sections are the same four in the same order for every kind of
 * subject: what it is; what it takes; where it runs or who may invoke it; a
 * worked example. **What is standardised is that order, not the table.** A
 * section is drawn when the subject HAS one and is absent when it does not,
 * because a `topic` given a flag table, or a shortcut given a one-row table
 * reading "the draft id", would be the same defect this is fixing — an absence
 * dressed as data.
 *
 * `p.welllabel` is the class the examples heading and the subcommand headings
 * on this card already use, so the skeleton is drawn in a hierarchy the screen
 * already has rather than in one invented for it.
 */
function section(ctx, host, key) {
  const heading = el('p', 'welllabel');
  heading.append(...ctx.t(key));
  host.append(heading);
}

/**
 * **A run of product text, in whatever language it was written in.**
 *
 * Everything on this card that is not a string-table key is text this app did
 * not choose the language of: a flag's declaration, a tool's schema
 * description, a category's own sentence, a help topic. On the Hebrew page all
 * of it sits inside an RTL flow, and an English sentence there renders its
 * trailing full stop at the WRONG END — `.precedence` rather than `precedence.`
 *
 * MEASURED in Chromium on 2026-09-07, `dir="rtl"`, `mycontext add`: the period
 * closing `--body`'s note laid out 70px to the LEFT of the `e` before it, on
 * the same line, with nothing between them. 15 of the 15 note cells on that one
 * command, 16 of 16 on `audit`, and every paragraph and list item of the
 * `capture` topic — 41 runs on that subject alone. Every assertion on this card
 * passed throughout, which is why it took a picture and then a range
 * measurement to find.
 *
 * `dir="auto"` is `conversations.js`'s own repair for exactly this, and its
 * header carries the full argument: the browser infers the direction from the
 * run's FIRST STRONG CHARACTER, so an English note reads left-to-right and a
 * Hebrew category description reads right-to-left, on either page. It is
 * applied to the run rather than to the cell, so a sentence the card DID author
 * — the per-workspace `clih.ask` disclosure that follows a note — keeps the
 * page's own direction beside it.
 */
function foreign(text) {
  const run = el('span');
  run.setAttribute('dir', 'auto');
  run.append(text);
  return run;
}

/**
 * A link from one subject to another, drawn as `button.crumb` — the console's
 * existing text-link affordance, already styled with an underline, a hover and
 * a focus ring, so this needs no rule of its own in `styles.css`.
 *
 * It changes the PICKER rather than painting the pane behind its back: the
 * select is the address of this card, and a link that swapped the detail
 * without moving the control would leave the two disagreeing about which
 * subject is on screen. Dispatching `change` is what makes one code path draw
 * every subject however it was reached.
 */
function subjectLink(ctx, kind, id, label, goto) {
  const link = el('button', 'crumb');
  link.type = 'button';
  link.append(mono(label));
  link.addEventListener('click', () => { goto(kind, id); });
  return link;
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
    cell.append(foreign(flag.format));
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
    means.append(foreign(flag.note));
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
  heading.append(...ctx.t('clih.exran'));
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
    // **`dir` is set, and a screenshot in Hebrew is what found it.** `.excmd`
    // scrolls, and a scroll container inherits the page's direction: under
    // `dir="rtl"` its origin is the RIGHT edge, so a Hebrew reader opened
    // `mycontext audit` and was shown `… --items --sessions --files` — the TAIL
    // of the line — with the command's own name off-screen to the left. The
    // text inside is a shell command and is left-to-right in both languages, so
    // the container is told so rather than the layout being worked around.
    line.dir = 'ltr';
    line.append(mono(example.command));
    host.append(line);
    host.append(el('pre', 'm transcript', example.output));
  }
  const how = el('p', 'small');
  how.append(...ctx.t('clih.exhow'));
  host.append(how);
}

/**
 * **The composed line — `plan:library seq:4`.**
 *
 * Owner request 2026-09-06: below the syntax, *"a comprehensive example that
 * will use most if not all the parameters and will show actual values, so a
 * date would show how a date looks."* Every switch on this card already
 * declared its format and one legal value and the table already drew both; what
 * a reader never saw was them USED TOGETHER, because the transcripts below come
 * from the README and the README demonstrates a minority of the commands.
 *
 * Nothing here is written. The line is composed by the endpoint out of the same
 * declarations the table above renders, and it is then put through the CLI's own
 * argument parser (`POST /api/command/check`'s function) before it is served —
 * so a line this screen draws is a line that parser accepted. A line it refused
 * would arrive with `ok: false` and is drawn as the refusal instead, because a
 * generated example the product's own checker will not take is a defect the
 * moment it is drawn, not something to render and hope about.
 *
 * `.excmd` for the same measured reason the transcript command lines use it: a
 * composed `add` line is ~450 characters, and a `span.m` that long laid out at
 * 2,321px on this card on 2026-09-06 and put 1,325px of horizontal overflow on
 * the page. It scrolls rather than wrapping, because a shell command broken
 * mid-flag is a command nobody can copy.
 */
function paintWorked(ctx, host, worked) {
  if (!Array.isArray(worked) || worked.length === 0) return;
  const heading = el('p', 'welllabel');
  heading.append(...ctx.t('clih.composed'));
  host.append(heading);

  for (const line of worked) {
    if (line.ok !== true) {
      // The composer produced something the CLI's parser refuses. Saying so is
      // the only honest thing this screen can do with it — drawing it would
      // teach a line that does not run, and dropping it silently would hide a
      // defect in the thing that produced it.
      host.append(errorNote(line.error ?? line.command));
      continue;
    }
    const shown = el('p', 'small excmd');
    // See `paintExamples` — an RTL scroll container opens at its right edge and
    // showed a Hebrew reader the end of the command instead of its name.
    shown.dir = 'ltr';
    shown.append(mono(line.command));
    host.append(shown);

    if (Array.isArray(line.asks) && line.asks.length > 0) {
      const asks = el('p', 'small');
      asks.append(...ctx.t('clih.asks'));
      host.append(asks);
    }
    if (line.catalogued === false) {
      const none = el('p', 'small');
      none.append(...ctx.t('clih.nopos'));
      host.append(none);
    }
    if (Array.isArray(line.omitted) && line.omitted.length > 0) {
      const left = el('p', 'small');
      left.append(...ctx.t('clih.omitted'));
      host.append(left);
      const list = el('ul', 'small');
      for (const off of line.omitted) {
        const row = el('li');
        row.append(mono(`--${off.flag}`), ' — ');
        // The reason is the endpoint's, and each of the four names a record
        // rather than a judgement: a declared group, a declared refusal, the
        // Composer catalogue's own pairing, or an arity no value exists for.
        const key = off.reason === 'group' ? 'clih.omgroup'
          : off.reason === 'refused' ? 'clih.omrefused'
            : off.reason === 'combination' ? 'clih.omcomb' : 'clih.omarity';
        row.append(...ctx.t(key, { with: off.with ?? '' }));
        list.append(row);
      }
      host.append(list);
    }
  }
  const how = el('p', 'small');
  how.append(...ctx.t('clih.composedhow'));
  host.append(spaced(how));
}

/**
 * One command. Four shapes, and the shape is `surface` — the endpoint's own
 * word for WHICH of the four records holds this command's flags, which is the
 * question `plan:library seq:1` had to answer before "every switch explained"
 * was a claim anybody could make.
 */
function paintCommand(ctx, host, body) {
  // §1 — what it is. Until `plan:library seq:5` a command was the one kind of
  // subject on this card with no such sentence at all, while a tool and a
  // shortcut both had one: the summary lives on the CLI's own registry, which a
  // read-only server may not load. It is served now, read out of the generated
  // coverage document — see `read-model-cli-help.ts`. `null` means that
  // document could not be read, and nothing is drawn rather than a blank line.
  if (typeof body.what === 'string' && body.what !== '') {
    section(ctx, host, 'clih.s1');
    const what = el('p', 'small');
    what.append(foreign(body.what));
    host.append(what);
  }

  section(ctx, host, 'clih.s2');
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
  // §4 — a worked example. The composed line first because every command has
  // one, then the transcripts, which are RUN rather than merely checked and are
  // therefore the stronger evidence where they exist at all.
  section(ctx, host, 'clih.ex');
  paintWorked(ctx, host, body.worked ?? []);
  paintExamples(ctx, host, body.examples ?? []);
}

/** One MCP tool: its description and its schema's own arguments. */
function paintTool(ctx, host, body) {
  section(ctx, host, 'clih.s1');
  const summary = el('p', 'small');
  summary.append(foreign(body.description));
  host.append(summary);

  section(ctx, host, 'clih.s2');
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
    // **An argument whose schema declares no description is a MEASURED absence,
    // and is drawn as one.** 21 of the 109 argument rows on this card were a
    // blank third cell under a column headed "what it does", which is the exact
    // state `flagView` REFUSES a CLI flag for: "an undeclared flag would reach a
    // reader as a row with an empty explanation".
    //
    // The repair is here rather than in `src/mcp/tools.ts` because those
    // sentences are what the MODEL is sent, and that file's rule is deliberate
    // and restated at each one — the description says the one thing a caller
    // cannot infer from the name. `get_item`'s `id` is not under-documented for
    // a model; it is under-documented for a reader of this table. So the card
    // says which kind of nothing it is, exactly as it does for the one shortcut
    // that genuinely takes no argument.
    if (typeof arg.note === 'string' && arg.note !== '') {
      means.append(foreign(arg.note));
    } else {
      const undeclared = el('span', 'small');
      undeclared.append(...ctx.t('clih.argnodesc'));
      means.append(undeclared);
    }
    row.append(name, takes, means);
    table.append(row);
  }
  host.append(table);
}

/**
 * **One slash command, read in the same four sections as everything else.**
 *
 * MEASURED before this was written: a `slash` subject was THREE `p.small`
 * sentences, no table, no example and no way onward, while `command` and
 * `tool` shared one table across two sources with nothing in common. `slash`
 * was the outlier and this is the repair.
 *
 * ── WHAT DOES *NOT* CHANGE, AND WHY IT MUST NOT ──────────────────────────
 *
 * The hint is still shown VERBATIM. It is one string written for a person —
 * `[category] [the item in one sentence]` — and splitting it on brackets would
 * invent a structure the source does not have. **A one-row table reading "the
 * draft id" is the defect, not the fix**: it dresses an absence as data, which
 * is the same fault as a shortcut with nothing to show. Where a hint is all
 * there is, the hint is what is drawn — beside a link to the subject that has
 * more.
 *
 * ── WHAT IS ADDED ────────────────────────────────────────────────────────
 *
 * §1 grows the CATEGORY the shortcut's name carries, in the category's own
 * words, with one real generated title of that kind (`plan:library seq:3`).
 * `/mycontext:add-rule` said `[the rule in one sentence]` and named the
 * category back at the reader; what a person needs at that moment is what
 * distinguishes a rule from an invariant, and every category has carried that
 * sentence in `src/core/categories.ts` all along.
 *
 * §3 grows the CROSS-REFERENCE. Owner, asked to be explicit: *"i ment all the
 * slash commands not only the six."* Every shortcut names at least one subject
 * that documents what it runs, derived from the invocations inside its own
 * file, so the reference cannot drift from what the shortcut really does. Where
 * a file names several, ALL of them are drawn in the order it runs them — the
 * first invocation is not the answer and neither is a guess between them.
 */
function paintSlash(ctx, host, body, goto) {
  section(ctx, host, 'clih.s1');
  const summary = el('p', 'small');
  summary.append(foreign(body.description));
  host.append(summary);

  const category = body.category ?? null;
  if (category !== null) {
    const what = el('p', 'small');
    what.append(...ctx.t('clih.catwhat', { name: category.category }), ' ',
      foreign(category.description));
    host.append(what);
  }

  section(ctx, host, 'clih.s2');
  // Owner review 2026-09-06: "most if not all the slash commands does not shows
  // parameters like the cli commands does" — and they did not, though 90 of the
  // 91 files had declared it since they were generated. `mono` for the reason
  // the flag names are mono: it is literal text a reader types. The absence is
  // NAMED rather than left blank, because "takes no argument" and "nobody wrote
  // it down" are different facts and `LoadMyContext` is genuinely the first.
  const takes = el('p', 'small');
  if (typeof body.argumentHint === 'string' && body.argumentHint !== '') {
    takes.append(...ctx.t('clih.slashargs'), ' ', mono(body.argumentHint));
  } else {
    takes.append(...ctx.t('clih.slashnoargs'));
  }
  host.append(takes);

  // The generated specimen — what `mycontext examples <category> --short`
  // answers, never a sentence written here. 29 hand-written examples are the
  // drift this project measures in days.
  if (category !== null && typeof category.example === 'string' && category.example !== '') {
    const eg = el('p', 'small');
    eg.append(...ctx.t('clih.eg'), ' ', mono(category.example));
    host.append(eg);
  }

  section(ctx, host, 'clih.s3');
  const who = el('p', 'small');
  who.append(...ctx.t(body.modelInvocable === true ? 'clih.slashmodel' : 'clih.slashuser'));
  host.append(who);

  const runs = Array.isArray(body.runs) ? body.runs : [];
  if (runs.length > 0) {
    const line = el('p', 'small');
    line.append(...ctx.t('clih.runs'));
    for (const [i, run] of runs.entries()) {
      line.append(i === 0 ? ' ' : ', ');
      line.append(subjectLink(ctx, run.kind, run.id, run.label, goto));
      // The exact invocations behind the link, where they are not simply the
      // subject's own name: `/discard` runs `review discard`, `review list` and
      // `review show`, and all three are one subject on this card.
      const paths = Array.isArray(run.paths) ? run.paths : [];
      const detail = paths.filter((p) => `mycontext ${p}` !== run.label && p !== run.label);
      if (detail.length === 0) continue;
      line.append(' (');
      for (const [j, p] of detail.entries()) {
        if (j > 0) line.append(', ');
        line.append(mono(p));
      }
      line.append(')');
    }
    host.append(spaced(line));
  }
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
  // A topic fills the first section and no other, and that is the point: it IS
  // a document. Forcing it to grow a "what it takes" table would be the defect
  // this skeleton exists to remove, in the opposite direction.
  section(ctx, host, 'clih.s1');
  const how = el('p', 'small');
  how.append(...ctx.t('clih.topichow', { cmd: body.label }));
  host.append(how);
  const topic = el('div', 'md topicbody');
  // The whole document, in the language it was written in — see `foreign`.
  // A help topic is English (only `categories` has a Hebrew source at all), so
  // on the Hebrew page every one of its paragraphs and list items renders its
  // closing full stop at the wrong end without this.
  topic.setAttribute('dir', 'auto');
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
async function paintSubject(ctx, pane, subject, seq, current, goto) {
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
  else if (subject.kind === 'slash') paintSlash(ctx, pane, body, goto);
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
  /**
   * Follow a cross-reference by MOVING THE PICKER, so the control and the pane
   * cannot come to disagree about which subject is on screen — and so that a
   * reader who arrived at `mycontext review` through `/mycontext:discard` can
   * see where they are and go back the way any other reader would.
   *
   * A target the endpoint does not serve is ignored rather than painted as an
   * error: `select.value = …` on a value no option carries silently sets '',
   * which would blank the card. The roster is the endpoint's own, so this is
   * unreachable today and is guarded because a link is worth less than a
   * screen.
   */
  const goto = (kind, id) => {
    const value = `${kind}/${id}`;
    if (!index.subjects.some((s) => `${s.kind}/${s.id}` === value)) return;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
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
    void paintSubject(ctx, pane, row, seq, current, goto);
  });
  await paintSubject(ctx, pane, null, seq, current, goto);
}
