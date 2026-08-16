import type { Config, ResolvedCategory } from '../core/config.ts';
import { serializeFrontmatter } from '../core/frontmatter.ts';

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
  // from `trustedStatus` (mutate.ts) refusing `active` for a non-`human`
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

/**
 * The commands that are NOT per-category: searching the whole corpus, walking
 * the review queue, and the health dashboard. Hand-written here rather than
 * generated from anything, because there is nothing to drift against.
 */
function genericCommands(): CommandFile[] {
  return [
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
3. Report each hit as id — title, and offer to open one in full with \`get_item\`. Never
   guess an id; ids look guessable and are not.
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
