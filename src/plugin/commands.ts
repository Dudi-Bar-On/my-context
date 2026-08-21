import { NAMED_ENTRY_POINTS, type NamedEntryPoint } from '../cli/commands/edit.ts';
import type { Config, ResolvedCategory } from '../core/config.ts';
import { serializeFrontmatter } from '../core/frontmatter.ts';
import { RELATION_TYPES } from '../core/vocabulary.ts';
import { SEVERITIES, STATUSES } from '../core/validate.ts';

/**
 * The user-facing slash-command surface, generated from the SAME resolved
 * config `mycontext_help("categories")` renders its table from.
 *
 * Why generated rather than hand-written: the command set and the enabled
 * category set are the same set. This project's most-repeated defect is two
 * hand-maintained lists of the same thing drifting apart (the extra-field
 * list, the tool list, the F2 exit-code rule, the usage banner), and a
 * hand-written `commands/add-requirement.md` would be the next instance — a
 * disabled category would keep its command and offer the user a capture that
 * `resolveCategory` then refuses.
 *
 * The files ARE committed, because Claude Code discovers plugin commands by
 * scanning `commands/*.md` on disk; nothing runs at install time. So the
 * generator is the source of truth and `test/plugin/commands.test.ts` asserts
 * the committed files are byte-identical to what it produces — the drift is
 * caught in CI rather than discovered by a user whose `/mycontext:add-policy`
 * writes nothing.
 *
 * Claude Code namespaces plugin commands by the plugin's `name`
 * (`.claude-plugin/plugin.json`), so `add-requirement.md` here is
 * `/mycontext:add-requirement` for the user. Do NOT add a `commands` field to
 * plugin.json: it REPLACES the default `commands/` scan rather than adding to
 * it.
 */

/** What one generated file is: its name under `commands/`, and its content. */
export type CommandFile = { file: string; content: string };

/**
 * `non_goal` → `non-goal`. Category names are snake_case; command names are
 * kebab-case, because that is how every other slash command in Claude Code
 * reads and `/mycontext:add-non_goal` is nobody's muscle memory.
 *
 * The transform is not injective over arbitrary names — a custom category
 * literally named `non-goal` alongside `non_goal` would collide — so
 * `generateCommands` refuses that rather than silently emitting one file for
 * two categories.
 */
export function commandSlug(category: string): string {
  return category.replace(/_/g, '-');
}

function enabledCategories(config: Config): ResolvedCategory[] {
  return Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Frontmatter shared by every generated command.
 *
 * `disable-model-invocation: true` on all of them: these are the USER's
 * surface. The model already has the eleven MCP tools, which are strictly
 * more capable, so a model-invocable duplicate would only add a second way to
 * do the same thing and a second description to carry.
 *
 * VERIFIED from the Claude Code docs: this field "prevent[s] Claude from
 * automatically loading this skill", and also prevents preloading into
 * subagents. NOT verified: that it removes the description from the session's
 * context entirely — the docs do not say that, so this comment does not
 * claim it.
 *
 * Only `$ARGUMENTS` is used, never `$1`/`$2`: the current docs define `$N` as
 * `$ARGUMENTS[N]` with `$0` as the FIRST argument, which inverts the older
 * 1-based reading. A generated file that guessed wrong would silently capture
 * the wrong words, so the surface avoids positionals entirely.
 *
 * Both values go through `serializeFrontmatter` rather than being
 * interpolated raw. They were interpolated raw, and every hint starts with
 * `[`, which opens a YAML flow sequence: `argument-hint: [--full|--short|
 * --summary] [--json]` closes one sequence and opens another, which no YAML
 * parser accepts. `claude plugin validate .` reported it on 19 files and
 * stated the consequence — "At runtime this command loads with empty
 * metadata (all frontmatter fields silently dropped)" — so on those 19 the
 * `disable-model-invocation: true` immediately below was written down and
 * not in effect: a declaration asserting a property that was not there.
 * `[the decision in one sentence]` on the other 19 is legal YAML but parses
 * as a one-element LIST, not the string the field is meant to hold.
 *
 * `description` is quoted by the same path and for the same reason, not for
 * symmetry: a custom category's name is an arbitrary JSON key (`resolveConfig`
 * validates `tier` and `description` but never the name), so a category named
 * `db: pooling` would emit `description: Capture a db: pooling in ...` — the
 * identical defect, latent, waiting on a config file.
 *
 * The emitted form is double-quoted (`"[--full|--short|--summary] [--json]"`),
 * which is what this repository's one escaping path produces and what its
 * parser reads back. Rendering is unaffected either way — Claude Code parses
 * the YAML and shows the string, so the user sees `[--full|--short|--summary]
 * [--json]` on the argument line with no quotes in it — and double quotes are
 * the form whose escapes (`\\`, `\"`) `emitScalar` already emits and
 * `parseFrontmatter` already undoes. A single-quoted emitter would need its
 * own `''` doubling rule, i.e. a second escaping path to keep correct.
 */
function frontmatter(description: string, argumentHint: string): string {
  return [
    '---',
    serializeFrontmatter({
      description,
      'argument-hint': argumentHint,
      'disable-model-invocation': true,
    }).trimEnd(),
    '---',
    '',
  ].join('\n');
}

/** Where the CLI lives inside an installed plugin, quoted for a path with spaces. */
const CLI = 'node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts"';

/**
 * The one category whose capture is not a `create_item` call, because its
 * body is not text a caller supplies: `reference` snapshots a FILE, and the
 * only surface that reads a file is `mycontext add … --file`.
 *
 * Named here rather than derived from a field on `CategoryDef`, and the
 * reason is that there is nothing honest to derive it from: `--file` is not
 * restricted to a category (the provenance fields it fills are on every item,
 * and `doctor`'s drift check is keyed on their shape, not on a name), so a
 * `captureFrom: 'file'` flag would assert a restriction the code does not
 * have. What is true is narrower and is exactly this: `reference` is the
 * category whose *whole point* is that its body came from a file, so the
 * generated command for it must not tell the model to write one.
 *
 * `test/plugin/commands.test.ts` compares the committed files byte-for-byte
 * with this generator, so a future file-bodied category that is added without
 * being named here produces a command that is wrong in a visible way — a
 * `create_item` instruction in a file the reviewer is reading — rather than
 * silently.
 */
const SNAPSHOT_CATEGORY = 'reference';

/**
 * `/mycontext:add-reference`, which is a different shape from every other
 * capture command and has to be.
 *
 * There is no tool for it. `create_item` takes a `body` from its caller, and
 * a snapshot's one guarantee is that its body is a copy of the named file —
 * which a caller-supplied body cannot carry. The surface that reads the file
 * is `mycontext add … --file`, a CLI command, and every CLI capture claims
 * `origin: "human"`: that is the claim the README's recommended deny list
 * exists to keep an agent from making. So this command ends in a command for
 * the USER to run, and says why, rather than instructing the model to run it
 * and quietly contradicting the section of the README that asks the user to
 * deny exactly that.
 */
function addReferenceCommand(category: ResolvedCategory): CommandFile {
  return {
    file: `add-${commandSlug(category.name)}.md`,
    content: `${frontmatter(
      `Capture a ${category.name} in this project's knowledge base`,
      '[which file, and why it matters]',
    )}
Capture a **${category.name}** — ${category.description} — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

A reference's body is a **snapshot** of a file, so capturing one means reading that file —
which no MCP tool does, and which is deliberate: a body you compose is not a copy of a
file, and the whole value of this category is that it is one.

1. If no file was named, ask which file, and stop. Do not guess, and do not paste a file's
   contents into a \`create_item\` call — that is the stale-copy problem this category exists
   to replace.
2. Work out the repository-relative path, and a one-sentence \`title\` saying what the file
   IS to this project ("Billing roadmap", not "roadmap.md").
3. Draft the *why*, as one \`--note\` per point: what this file is for, and what would make
   the snapshot misleading. The snapshot says what the file says; only you and the user can
   say why it is in the corpus, and the item's own text is the only place that goes.
4. Print this command for the user to run, filled in, and stop:

   \`${CLI} add ${category.name} "<title>" --file <path> --note "<why>"\`

   Do not run it yourself. \`mycontext add\` claims \`origin: "human"\`, which is the one
   claim you cannot make, and it is on the deny list this plugin's README recommends.

Afterwards: \`mycontext doctor\` reports \`source_drift\` when the file has moved on, and
\`refresh_item\` takes a fresh snapshot. Neither happens on its own.
`,
  };
}

function addCommand(category: ResolvedCategory): CommandFile {
  if (category.name === SNAPSHOT_CATEGORY) return addReferenceCommand(category);
  const slug = commandSlug(category.name);
  // Normative items captured through `create_item` are demoted to `draft` and
  // govern nothing until a human promotes them; rationale items are created
  // active and are never auto-injected at all. Saying which one happened is
  // the difference between "captured" and "captured and now governing".
  //
  // The demotion is a property of the ROUTE, not of the category: it comes
  // from `trustedStatus` (core/trust.ts) refusing `active` for a non-`human`
  // origin, and the MCP server passes `origin: 'agent'`. The CLI fallback
  // named at the bottom of this file passes `origin: 'human'` and therefore
  // lands ACTIVE. Both sentences used to appear in the same generated file,
  // one describing each route but neither saying which — so every normative
  // `add-<type>.md` contradicted itself about the same capture. Each claim is
  // now attached to the route it is true of.
  const landing = category.tier === 'normative'
    ? 'It lands as a **draft**: it governs nothing until a human promotes it with ' +
      '`/mycontext:review`. Say so in your one-line report.'
    : 'Rationale items land active, and rationale is never auto-injected into a session — ' +
      'it is there to be found later. Say so in your one-line report.';

  // Kept on ONE line and spelled with the real flags, because
  // `test/plugin/commands.test.ts` parses this exact invocation out of the
  // generated file and RUNS it: if the CLI stops accepting a flag named here,
  // or stops landing the status the sentence claims, that test fails.
  const invocation = `${CLI} add ${category.name} "<title>" --body "<why it holds>" ` +
    `--scope "<glob>" --tags "<tag>"${category.tier === 'normative' ? ' --yes' : ''}`;
  const fallback = category.tier === 'normative'
    ? `If the MCP server is not available, \`${invocation}\` captures the same fields from a
shell — but not by the same route: \`mycontext add\` is the human-facing command, so the
item lands **active** rather than as a draft and governs this project the moment it is
written. That is why it requires \`--yes\`. Prefer the tool, which puts the capture through
review first.`
    : `If the MCP server is not available, \`${invocation}\` captures the same fields from a
shell, landing active exactly as the tool does.`;

  return {
    file: `add-${slug}.md`,
    content: `${frontmatter(
      `Capture a ${category.name} in this project's knowledge base`,
      `[the ${slug} in one sentence]`,
    )}
Capture a **${category.name}** — ${category.description} — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what to capture and stop. Do not invent one.
2. Call the \`create_item\` tool on the \`mycontext\` MCP server with
   \`type: "${category.name}"\` and a \`title\` that states the claim in one sentence
   (not a topic — "Postgres pool capped at 20", not "database pooling").
3. Fill \`body\` with WHY it holds, and \`scope\` with the glob(s) it governs, from what
   has actually been said in this conversation. Do not invent supporting detail, and do
   not interrogate the user — at most one clarifying question. \`scope\` RESTRICTS where the
   item applies, so leave it empty if the item is not about particular files — an item with
   no scope is unrestricted and applies everywhere.
4. Report the id it returns, in one line. ${landing}

${fallback}
`,
  };
}

function listCommand(category: ResolvedCategory): CommandFile {
  const slug = commandSlug(category.name);
  return {
    file: `list-${slug}.md`,
    content: `${frontmatter(
      `List this project's ${category.name} items`,
      '[--full|--short|--summary] [--json]',
    )}
List this project's **${category.name}** items.

Run: \`${CLI} list ${category.name} $ARGUMENTS\`

Show the table as it is printed — it is already column-aligned with headers. Do not
re-format it, re-sort it or summarise it away. \`--full\` adds origin, layer and scope;
\`--summary\` counts instead of listing; \`--json\` is for piping.

If the user asked a question rather than for a listing, answer it from the rows, and say
which ids you used.
`,
  };
}

/* -------------------------------------------------------------------------- *
 * Phase 4: the surface a user types.
 *
 * The requirement this half of the file exists for, in the owner's words:
 * "anything the model can do through a tool, the user should be able to do
 * through a command". Before Phase 4 the two surfaces were not parallel —
 * eleven tools, and slash commands covering about four of them, with `show`,
 * `edit`, `supersede`, `promote`, `discard`, `query`, `doctor`, `decay`,
 * `refresh`, `link` and the whole `lesson` and `ingest` flow reachable only
 * from a terminal. `test/plugin/parity.test.ts` is what keeps them parallel
 * from here; this is where the commands themselves are written.
 * -------------------------------------------------------------------------- */

/**
 * **The one shape every write command on this surface takes, and the reason it
 * is not a second copy of the CLI's preview.**
 *
 * `mycontext edit`, `supersede`, `review promote`, `review discard` and the
 * four named forms all print a preview — what governs today, what changes,
 * what governs afterwards — and then ask. Run without `--yes` from a
 * non-interactive shell, each prints that preview in full and then refuses,
 * writing nothing (`confirmAction`, src/cli/commands/review.ts). So the slash
 * command runs exactly that: the preview the user reads is the CLI's own
 * output, not a paraphrase, and no text in this file has to be kept in step
 * with what the gate actually decides.
 *
 * The confirmation is then the user's, and it is a second invocation they type
 * themselves. That is not ceremony: `mycontext edit` and its siblings claim
 * `origin: "human"`, which is the one claim an agent cannot make, and they are
 * on the deny list this plugin's README recommends. A command that ran the
 * `--yes` form would be asking the user to permit exactly what that list
 * exists to refuse.
 *
 * `exitCode` is spelled out because a model that reads exit 1 as a failure
 * will retry, and the retry is the thing that must not happen.
 */
function previewThenHandBack(command: string, note = ''): string {
  return `2. Run it WITHOUT \`--yes\`, exactly as written:

   \`${command}\`

   It prints the real preview — what the item is, what would change, and what
   governs before and after — and then refuses, because stdin here is not a terminal.
   **Exit code 1 is the expected outcome and is not a failure: nothing was written.**
3. Show that preview to the user as it was printed. Do not summarise it, re-order it or
   drop the "after" line — it is the whole of what they are being asked to approve.
4. Print the same command with \`--yes\` on the end, for the USER to run, and stop.
${note}
   Do not run it yourself. It claims \`origin: "human"\`, which is the one claim you cannot
   make, and it is on the deny list this plugin's README recommends.
`;
}

/**
 * A fixed set of values, offered as a numbered list.
 *
 * Claude Code has **no native picker**: `argument-hint` is placeholder text on
 * the input line, not a control, and nothing in a command file can render a
 * menu. What a command file CAN do is run through you — so presenting the
 * values and waiting for a number is available, and is the whole mechanism.
 * Every list below is generated from the enum in `src/core/mutate.ts` rather
 * than typed here, so a widened vocabulary reaches this surface without anyone
 * remembering to widen it twice; `test/plugin/commands.test.ts` enumerates
 * both directions.
 */
function numbered(values: readonly string[]): string {
  return values.map((v, i) => `${i + 1}. ${v}`).join('   ');
}

/**
 * The statuses `mycontext edit` will actually set, which is every status
 * except `superseded`.
 *
 * Not a shortened list for brevity: `cmdEdit` refuses `--status superseded` by
 * name, because a retirement in this system records its replacement in both
 * directions and a bare status change would produce an item marked as replaced
 * by nothing. Offering it in a picker would be offering a refusal.
 */
const EDITABLE_STATUSES = STATUSES.filter((s) => s !== 'superseded');

function readCommands(): CommandFile[] {
  return [
    {
      file: 'show.md',
      content: `${frontmatter(
        'Print one item from this project\'s knowledge base in full',
        '[the item id]',
      )}
Print one item from this project's my_context knowledge base, in full.

What the user typed: $ARGUMENTS

1. If no id was given, ask which item — or, if they described one instead of naming it,
   run \`${CLI} search "<their words>"\` and offer the ids it returns. Never guess an id;
   ids look guessable and are not.
2. Run: \`${CLI} show <id>\`
3. Print what it returns as it is printed. The body, the observations and the relations are
   the item; a summary of them is not what was asked for.

The fields are explained by \`${CLI} help capture\`. If the item is a \`reference\`, its body
is a snapshot of a file and may have drifted — \`${CLI} doctor\` reports that.
`,
    },
    {
      file: 'doctor.md',
      content: `${frontmatter(
        "Run this project's my_context self-check and explain what it found",
        '[--quiet] [--full|--short|--summary] [--json]',
      )}
Run this project's my_context self-check.

Run: \`${CLI} doctor $ARGUMENTS\`

Print the report as it is printed. Then, and only then, add at most three lines: the
finding that matters most, why it matters, and the one command that addresses it.

\`doctor\` exits non-zero when it finds an error-level problem. That is the command
working, not failing — say what it found rather than reporting that a command failed.

Do not fix anything yourself. Several of the routes it names — \`repair\`, \`supersede\`,
\`edit\` — claim \`origin: "human"\` and are on the deny list this plugin's README
recommends. Name the command; let the user run it.
`,
    },
    {
      file: 'decay.md',
      content: `${frontmatter(
        'Show items that have not been injected into a session lately',
        '[--sessions N] [--all] [--full|--short|--summary] [--json]',
      )}
Show which items in this project have not reached a session lately.

Run: \`${CLI} decay $ARGUMENTS\`

Print the table as it is printed. \`--sessions N\` sets the window; \`--all\` includes the
items that have never been injected at all.

A cold item is **not** evidence that it is wrong. Read the list for what it actually
says: an item nothing has matched may be scoped to files nobody touched, may be a
rationale item that is never auto-injected by design, or may genuinely be stale. Say
which of those you think it is and why, and do not propose deleting anything — nothing in
this product deletes an item, and retirement names a replacement (\`/mycontext:supersede\`).
`,
    },
    {
      file: 'audit.md',
      content: `${frontmatter(
        'Show what my_context did at run time: mutations, and injections by scope',
        '[--since T] [--item ID] [--session ID] [--op O] [--limit N] [--summary|--items|--sessions|--files]',
      )}
Show the run-time audit log: every mutation, and every hook action including injections.

Run: \`${CLI} audit $ARGUMENTS\`

Print the table as it is printed. Useful shapes: \`--since 7d\` for the last week,
\`--item <id>\` for everything that happened to one item (including the injections that
delivered it and the ones that spilled it), \`--summary\` for counts by operation,
\`--items\` for what the log names most, \`--sessions\` for which sessions it has seen.

**What an injection record does and does not contain.** It records the SCOPE of the
injection — which items, at which tier, and what the budget spilled — and never the
injected text. So it answers "what did this session see" and cannot answer "what did that
item say at the time"; the item's own file and \`/mycontext:show\` answer that.

The append-only JSONL under \`.my_context/.audit/\` is the record; the SQLite file beside
it is a derived query index and is safe to delete. Both are gitignored, so this log
describes THIS machine only — a clone of the repository elsewhere has its own.
(v2.0 decides that a corpus export carries the mutation records and leaves the
rest behind; that is decided and not built, and nothing travels today.)
`,
    },
    {
      file: 'focus.md',
      content: `${frontmatter(
        'Narrow what my_context injects, and report what that hides',
        '[<tag>…] [--tag t] [--category c] [--scope path] [--preview] [--show] [--clear]',
      )}
Narrow — or widen — what my_context injects into sessions in this project.

Run: \`${CLI} focus $ARGUMENTS\`

Print the report as it is printed. With no arguments it shows the focus now in effect;
\`--clear\` removes it; \`--preview\` reports the cost and changes nothing.

**Focus discloses and allows.** It hides exactly what it was asked to hide, and reports
two numbers: how many items are hidden, and how many load-bearing relations that leaves
dangling — an edge with one end hidden and the other still visible, such as a hidden
\`open_question\` that \`blocks\` a requirement still on screen. It never refuses a hide.
Read those numbers out; a dangling count above zero is the user's decision to make, not
a failure.

**Nothing is deleted and nothing is dropped.** A hidden item is still in the corpus and
still readable with \`/mycontext:show\`. \`severity: hard\` items are never hidden at all,
and the report says how many were kept for that reason.

The focus belongs to this workspace, not to one session, so it outlives the session that
set it. Every injection under a focus says so.
`,
    },
    {
      file: 'todo.md',
      content: `${frontmatter(
        "Show this project's my_context inbox: what was jotted down and not yet placed",
        '[--tag t] [--all] [--limit n] [--full|--short|--summary] [--json]',
      )}
Show this project's my_context inbox — the items captured as \`todo\`.

Run: \`${CLI} todo $ARGUMENTS\`

Print the list as it is printed, including the note that follows it, and stop there.

**Do not promote anything from this list.** An inbox is a human's to triage: deciding
that a jotted-down line is really a rule is the act that makes it govern this repository,
and doing it unasked is laundering an intention into a directive. If an entry obviously
belongs somewhere, say which category you would put it in and why — then let the user run
\`${CLI} add <category> "<title>"\` and
\`${CLI} supersede <todo id> --by <new id>\` themselves.

A todo is on the rationale tier, so nothing here has been injected into your context and
nothing here governs anything. Read it as a list of intentions, not as instructions.
`,
    },
    {
      file: 'query.md',
      content: `${frontmatter(
        'Run a read-only SQL query over this project\'s my_context index',
        '[a SELECT statement, or a question to turn into one]',
      )}
Answer a question about this project's my_context corpus with SQL.

What the user typed: $ARGUMENTS

1. If they wrote a statement, use it. If they wrote a question, write the statement — and
   show it to them before you run it, so they can see what you asked.
2. Run: \`${CLI} query "<the statement>"\` (add \`--json\` when you need to compute on the
   result rather than read it).
3. Report the rows. If the answer is a count or a single value, say the value; do not
   paste a one-cell table.

The schema, which is one table:

    items(id, type, title, status, always, has_scope, layer, file_path, updated_at, data)

\`data\` holds the whole item as JSON — reach into it with \`json_extract(data, '$.scope')\`,
\`'$.tags'\`, \`'$.severity'\`, \`'$.relations'\`.

**\`updated_at\` is index write time, not a Markdown timestamp.** Every query rebuilds the
index first, so \`updated_at\` is rewritten to "now" on every row on every run. It answers
"when was this row last indexed" — always: this invocation — and never "when did this item
last change". For that, read the file or its git history. Sorting or filtering by it
produces an answer that looks meaningful and is not.

**What "read-only" here does and does not mean.** Only \`SELECT\` (or \`WITH … SELECT\`) is
accepted, one statement at a time; the connection is opened read-only, so the engine
itself refuses writes to the index. Those two together are the boundary. They are not a
proof: the denylist is a keyword scan over a full SQL grammar and cannot be complete, and
\`VACUUM INTO\` is the one statement that writes a file **outside** the index — the
read-only connection does not stop it, and the keyword scan is the only thing that does.
So: this is a read surface, and it is not a sandbox. Do not tell a user it cannot touch
their disk.

To change an item, that is \`/mycontext:edit\` — never a SQL statement.
`,
    },
  ];
}

function writeCommands(): CommandFile[] {
  return [
    {
      file: 'edit.md',
      content: `${frontmatter(
        'Change a field on an item, with the preview and confirmation the CLI gives',
        '[the item id, and what to change]',
      )}
Change a field on an item in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Work out the id and the field. If no id was given, run \`${CLI} search "<their words>"\`
   and offer what it returns; never guess an id.

   **If they named a field with a fixed set of values but not which value, present the
   values as a numbered list and stop until they answer.** Claude Code has no picker —
   \`argument-hint\` is placeholder text on the input line, not a control — so a numbered
   list and a wait is the whole mechanism, and it works because this command runs
   through you.

       severity   ${numbered(SEVERITIES)}
       status     ${numbered(EDITABLE_STATUSES)}
       always     1. yes (\`--always\`)   2. no (\`--always=false\`)

   \`superseded\` is deliberately absent from the status list: a retirement records its
   replacement in both directions, so it is \`/mycontext:supersede\`, not a status change.

   The flags are \`--title\`, \`--body\`, \`--scope "a/**,b/**"\`, \`--tags "a,b"\`,
   \`--severity\`, \`--always[=false]\`, \`--status\`, \`--extra key=value\`, and
   \`--unlink <relation> <target>\` to remove a relation.
${previewThenHandBack(`${CLI} edit <id> <the flags>`)}
For the two changes people make constantly there are shorter commands with the same
gate: ${NAMED_ENTRY_POINTS.map((e) => `\`/mycontext:${e.name}\``).join(', ')}.
`,
    },
    {
      file: 'supersede.md',
      content: `${frontmatter(
        'Retire an item in favour of a replacement, recorded in both directions',
        '[which item, and what replaces it]',
      )}
Retire an item in this project's my_context knowledge base, in favour of a replacement.

What the user typed: $ARGUMENTS

1. Work out both ids — the item being RETIRED and the item that replaces it — and say
   which is which back to the user before going further. Getting them the wrong way round
   retires the wrong item, and this has happened: an agent recording that it had answered
   an open question retired the answer and left the question standing.

   If the replacement does not exist yet, capture it first with the matching
   \`/mycontext:add-<type>\` command. Retirement without a successor is not offered here;
   the status that means exactly that is \`/mycontext:edit <id> --status deprecated\`.
${previewThenHandBack(`${CLI} supersede <retired id> --by <replacement id>`)}
`,
    },
    {
      file: 'promote.md',
      content: `${frontmatter(
        'Promote a draft so it starts governing this project',
        '[the draft id]',
      )}
Promote a draft in this project's my_context knowledge base, so that it starts governing.

What the user typed: $ARGUMENTS

1. If no id was given, run \`${CLI} review list\` and show what is waiting. Then print each
   candidate in full with \`${CLI} review show <id>\`, and stop until the user names one.
   **Do not promote them all**, even if asked to: the point of this queue is that a human
   read each one.
${previewThenHandBack(`${CLI} review promote <id>`)}
Promotion is the act that turns captured text into a rule this repository is governed by.
It is the single decision this whole product exists to keep with the user.
`,
    },
    {
      file: 'discard.md',
      content: `${frontmatter(
        'Discard a draft that should not govern this project',
        '[the draft id]',
      )}
Discard a draft from this project's my_context review queue.

What the user typed: $ARGUMENTS

1. If no id was given, run \`${CLI} review list\`, then \`${CLI} review show <id>\` for each,
   and stop until the user names one. Discarding is not reversible from any command here,
   so a wrong id is not a mistake a later step fixes.
${previewThenHandBack(`${CLI} review discard <id>`)}
`,
    },
    {
      file: 'refresh.md',
      content: `${frontmatter(
        'Re-snapshot a reference from the file it was captured from',
        '[the reference id]',
      )}
Take a fresh snapshot of a \`reference\` item from the file it was captured from.

What the user typed: $ARGUMENTS

1. If no id was given, run \`${CLI} list reference\` and offer what it returns.
   \`${CLI} doctor\` is what reports which snapshots have drifted from their source.
${previewThenHandBack(`${CLI} refresh <id>`)}
A refresh replaces the stored body with the file as it is now. What the file said before
is not kept by this command — the item's own git history is where that lives.
`,
    },
    {
      file: 'link.md',
      content: `${frontmatter(
        'Record a relation from one item to another',
        '[from which item, how, to which item]',
      )}
Record a relation between two items in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Work out three things: the item the relation is stored ON (\`from\`), the relation, and
   the item it points at (\`to\`). The direction is not symmetric — "A ${RELATION_TYPES[3]} B"
   is stored on A.
2. If the relation was not named, present the vocabulary as a numbered list and stop until
   the user picks one. It is closed on purpose: an open one produces \`derived_from\`,
   \`derivedFrom\` and \`derived-from\` in one corpus, and then no query finds all three.

       ${numbered(RELATION_TYPES)}

3. Call the \`link_items\` tool on the \`mycontext\` MCP server with \`from\`, \`to\` and
   \`relation\`. Report what it says in one line.

\`supersedes\` and \`superseded_by\` are **not** available here, and that is not an
oversight. A supersession is a lifecycle change, not just an edge: it sets the retired
item's status too. Use \`/mycontext:supersede\`, which writes both directions and the
status together.

The target does not have to exist yet — an unresolved link resolves when the item is
created. To remove a relation, that is \`/mycontext:unlink\`.
`,
    },
    {
      file: 'unlink.md',
      content: `${frontmatter(
        'Remove a relation from an item',
        '[which item, which relation, pointing at what]',
      )}
Remove a relation from an item in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Run \`${CLI} show <id>\` first and read the relations it actually carries. Present them
   as a numbered list and stop until the user picks one — the exact relation AND target
   both have to match, and an unlink that matches nothing is refused rather than reported
   as a success.
${previewThenHandBack(`${CLI} edit <id> --unlink <relation> <target>`)}
Two relations cannot be removed at all: \`supersedes\` and \`superseded_by\`. They are
written together with the lifecycle change that makes them true, and removing one would
leave an item marked as retired with nothing recording what replaced it. If a retirement
itself was wrong, the route is \`/mycontext:edit <id> --status active\`.

There is no MCP tool for this, deliberately: adding a relation cannot change what governs,
and removing one from a governing item can — it takes away part of what that item asserts.
That makes it the user's, the same way promotion is.
`,
    },
  ];
}

/**
 * The two stateful flows, and the decision that shapes both of them: **each
 * slash command advances the state machine by ONE step and hands control
 * back.** Neither drives to completion.
 *
 * Ingest resumes across chunks and lessons stage before they are accepted, so
 * a command that "finished the job" would be either guessing at the next
 * chunk's contents or accepting rules on the user's behalf. Handing back after
 * one step costs a second invocation and buys the property both flows exist
 * for: at every point where the corpus is about to gain something, a human has
 * seen what it is.
 *
 * The dividing line is not "how far through the flow" but **who the write
 * claims to be**. `mycontext ingest-apply` writes `origin: 'ingest'` and lands
 * drafts — an agent may run it, and does. `mycontext lesson --agent` writes
 * `origin: 'agent'` — an agent may run that one too, and because a lesson is
 * RATIONALE tier it lands active without crossing anything: nothing on that
 * tier is injected into a session, so there is no draft gate for it to be
 * held behind. What an agent may not run is the `origin: 'human'` spelling of
 * either command — `mycontext lesson` with no flag, and `mycontext
 * lesson-accept`, which has no flag to give it and is not getting one.
 *
 * That asymmetry is the point rather than an inconsistency. `lesson-accept`
 * turns a staged candidate into a **rule**: normative, active, and governing
 * this repository from the moment it exists. It does not lead to the approval
 * gate — it IS the approval gate. Recording what was learned and approving
 * what everyone is now obliged to do are different acts, and only the first
 * of them has an honest agent spelling.
 *
 * `lesson.md` below used to tell an agent it could not record a lesson at
 * all. That was true of the unflagged CLI command and false as a whole, in
 * the way that costs a detour: `create_item` on the MCP server has recorded
 * agent-origin lessons since it existed, and stamps the origin in the handler
 * rather than trusting the caller to declare it. The generated text now names
 * all three routes and says which of them is strongest, and why.
 */
function statefulCommands(): CommandFile[] {
  return [
    {
      file: 'ingest.md',
      content: `${frontmatter(
        'Extract candidate items from a document, one chunk at a time',
        '[the path to a document]',
      )}
Extract candidate items from a document into this project's my_context knowledge base.
**You are the extractor** — there is no model inside this tool.

What the user typed: $ARGUMENTS

1. If no path was given, ask which document and stop.
2. Run: \`${CLI} ingest <path>\`
   It splits the document into chunks and prints an extraction request for the FIRST one:
   the session id, the anchor, the chunk's text, and the fields a candidate needs.
3. Read that chunk and write the candidates it actually supports as a JSON array to a
   temporary file. Every candidate needs a \`quote\` that appears in the chunk verbatim —
   that is what makes this an extraction rather than a composition, and a candidate whose
   quote is not in the chunk is refused.
4. Run: \`${CLI} ingest-apply <session id> --anchor <anchor> --file <your json>\`
   You may run this one: it writes \`origin: "ingest"\` and everything it creates lands as
   a **draft** that governs nothing until a human promotes it.
5. Report what it says — created, deduped, superseded — and **stop there.**

   - If it rejected any candidate, fix ONLY those and resubmit against the SAME session
     and anchor before doing anything else.
   - If it printed the next chunk's request, say how many chunks are left and let the user
     decide whether to continue. Do not walk the whole document unasked: each chunk is a
     batch of drafts someone has to review, and forty of them arriving at once is how a
     review queue stops being read.

\`${CLI} ingest-status\` shows every session and which chunks are still pending, so an
interrupted ingest is resumed rather than restarted. \`/mycontext:review\` is where the
drafts go next.
`,
    },
    {
      file: 'lesson.md',
      content: `${frontmatter(
        'Record something learned, and derive candidate rules from it',
        '[what was learned, in one or two sentences]',
      )}
Record a lesson in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. If nothing was typed, ask what was learned and stop. A lesson is a specific thing that
   happened and what it cost — not a maxim.
2. If the USER learned it, print this command for the user to run, filled in, and stop:

   \`${CLI} lesson "<the lesson in one sentence>"\`

   Do not run that one yourself. With no flag it claims \`origin: "human"\`, which is the
   one claim you cannot make.
3. If YOU learned it, record it yourself. There are two honest routes, and this file used
   to say there were none:

   - **Preferred: the \`create_item\` tool** on the \`mycontext\` MCP server, with
     \`type: "lesson"\`. The handler stamps \`origin: "agent"\` itself and refuses to take an
     origin from the tool call at all, so the claim is not yours to make, to mistype or to
     forget.
   - If the MCP server is not available, the same claim from a shell:

     \`${CLI} lesson --agent "<the lesson in one sentence>"\`

     \`--agent\` records \`origin: "agent"\`. This route is **weaker** than the tool: the flag
     is self-declared, so an agent that omits it is back to claiming human and nothing can
     tell. Weaker is not dishonest — it is the only shell spelling that is not.

   Either way the lesson lands **active** rather than as a draft, and that crosses no
   boundary: a lesson is **rationale** tier, and rationale is never injected into a
   session. The draft gate is for normative captures, because those are the ones that
   govern.
4. With the id in hand — from the tool's reply, or from what the user reports — the flow
   continues at \`/mycontext:lesson-stage\`, which is where candidate rules are derived from
   the lesson and staged for approval. Recording a lesson and approving what it obliges are
   different acts: \`lesson-accept\` creates a rule that governs this repository, claims
   \`origin: "human"\`, and has no \`--agent\` spelling. That one is the user's and stays the
   user's.

A lesson is worth recording on its own, even if no rule ever comes out of it. Rationale
items are never auto-injected — they are there to be found later — so recording one costs
nothing that a session has to carry.
`,
    },
    {
      file: 'lesson-stage.md',
      content: `${frontmatter(
        'Derive candidate rules from a recorded lesson and stage them for approval',
        '[the lesson id]',
      )}
Derive candidate rules from a lesson and stage them for the user's approval.

What the user typed: $ARGUMENTS

1. If no id was given, run \`${CLI} list lesson\` and offer what it returns.
2. Run \`${CLI} show <lesson id>\` and read it. Write the rules it genuinely supports as a
   JSON array to a temporary file — each with a \`title\` that states the rule in one
   sentence, a \`directive\` of \`do\` or \`dont\`, and a \`body\` saying why it holds. One
   lesson usually supports one rule and sometimes none; a lesson that supports four
   probably was not one lesson.
3. Run: \`${CLI} lesson-stage <lesson id> --file <your json>\`
   You may run this one. **Staging writes nothing into the corpus** — that is the whole
   point of the gate: the candidates sit beside the lesson until a human accepts one.
4. Present what it staged as a numbered list — the key, the title and the directive of
   each — and **stop until the user says which they want.**
5. For each one they choose, print the command for the USER to run:

   \`${CLI} lesson-accept <lesson id> <key>\`

   and, for any they reject, \`${CLI} lesson-discard <lesson id> <key>\`.

   Do not run either yourself. \`lesson-accept\` is what turns a staged candidate into a
   rule that governs this repository, it claims \`origin: "human"\`, and it is on the deny
   list this plugin's README recommends. Their typing it is the point.
`,
    },
  ];
}

/**
 * `pin`, `unpin`, `harden`, `soften` — one slash command each, generated from
 * `NAMED_ENTRY_POINTS` (src/cli/commands/edit.ts), which is the same list the
 * CLI registers them from.
 *
 * **One implementation, two spellings, one enumerating test.** These are not a
 * second edit path: the CLI command each one invokes rewrites argv and calls
 * `cmdEdit`, so the gate, the preview and the refusals are `edit`'s. Generating
 * the files from the same list is the same idea one level up — a fifth named
 * form gets its command for free, and a command with no CLI behind it cannot
 * be written here without the drift test failing.
 *
 * A surface checked separately is a surface excluded from the agreement, which
 * this project proved when a per-preview test stayed green on a mutant. So
 * `test/plugin/commands.test.ts` enumerates this list rather than naming four
 * files.
 */
function namedCommand(entry: NamedEntryPoint): CommandFile {
  return {
    file: `${entry.name}.md`,
    content: `${frontmatter(
      `${entry.summary[0].toUpperCase()}${entry.summary.slice(1)}`,
      '[the item id]',
    )}
\`${entry.name}\` an item in this project's my_context knowledge base: it ${entry.effect}.

What the user typed: $ARGUMENTS

1. If no id was given, run \`${CLI} search "<their words>"\` and offer what it returns.
   Never guess an id.
${previewThenHandBack(
  `${CLI} ${entry.name} <id>`,
  `
   \`${entry.name}\` is \`mycontext edit <id> ${entry.sets}\` under a shorter name — same gate,
   same preview, same result — so it takes one id and nothing else. To change any other
   field, or more than one, that is \`/mycontext:edit\`.
`,
)}`,
  };
}

/**
 * The commands that are NOT per-category: searching the whole corpus, walking
 * the review queue, and the health dashboard. Hand-written here rather than
 * generated from anything, because there is nothing to drift against.
 */
function genericCommands(): CommandFile[] {
  return [
    ...readCommands(),
    ...writeCommands(),
    ...statefulCommands(),
    ...NAMED_ENTRY_POINTS.map(namedCommand),
    {
      file: 'search.md',
      content: `${frontmatter(
        "Search this project's my_context knowledge base",
        '[what to look for]',
      )}
Search this project's my_context knowledge base for: $ARGUMENTS

1. Call the \`query_items\` tool on the \`mycontext\` MCP server. Use its \`text\` filter for
   words, \`type\` for a category, \`tag\` for a tag, and \`path\` when the user is asking what
   governs a particular file.
2. If nothing matches, widen once (drop the type filter, or try a synonym) before saying
   there is nothing — and then say so plainly rather than answering from your own
   assumptions about this project.
3. Report each hit as id — title, and offer to open one in full with \`get_item\` (or
   \`/mycontext:show\`). Never guess an id; ids look guessable and are not.

The same search from a terminal is \`${CLI} search "<words>"\`, which takes the same
filters — \`--type\`, \`--tag\`, \`--path\`, \`--status\`, \`--relation\` — and runs the same
predicate. Name it when the user asks how to do this without you.
`,
    },
    {
      file: 'review.md',
      content: `${frontmatter(
        'Walk the queue of drafts waiting for human review',
        '[--full|--short|--summary] [--json]',
      )}
Show what is waiting for human review in this project.

Run: \`${CLI} review list $ARGUMENTS\`

Then, for each draft, offer to print it in full with \`${CLI} review show <id>\`.

**Do not promote or discard anything yourself.** Promotion is the human's act: it is what
turns a captured draft into a rule that governs this repository. Tell the user the exact
command to run — \`mycontext review promote <id>\` or \`mycontext review discard <id>\` —
and stop there, even if they say "promote them all". Their typing it is the point.
`,
    },
    {
      file: 'status.md',
      content: `${frontmatter(
        "Show this project's my_context status and health",
        '[--full|--short|--summary] [--json]',
      )}
Show the state of this project's my_context knowledge base.

Run: \`${CLI} status $ARGUMENTS\`

Print the report as-is, then add at most two lines: what, if anything, needs the user's
attention (drafts waiting, an unfinished ingest, an error-level health finding), and the
one command that addresses it. Do not restate the counts they can already see.

For the detail behind \`health:\`, run \`${CLI} doctor\`.
`,
    },
  ];
}

/**
 * Every command file this plugin ships, EXCEPT `LoadMyContext.md`, which is
 * hand-written and predates this generator (Plan 3) — it is listed by the
 * test as a known exception rather than generated, because it is the one
 * command about the session rather than about the corpus.
 */
export function generateCommands(config: Config): CommandFile[] {
  const files = [...genericCommands()];
  const seen = new Map<string, string>();

  for (const category of enabledCategories(config)) {
    const slug = commandSlug(category.name);
    const clash = seen.get(slug);
    if (clash !== undefined) {
      throw new Error(
        `my_context: categories "${clash}" and "${category.name}" both produce the command ` +
        `slug "${slug}", so one would overwrite the other's command file. Rename one of them.`,
      );
    }
    seen.set(slug, category.name);
    files.push(addCommand(category), listCommand(category));
  }

  return files.sort((a, b) => a.file.localeCompare(b.file));
}
