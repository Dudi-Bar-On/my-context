import type { Config, ResolvedCategory } from '../core/config.ts';

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
 */
function frontmatter(description: string, argumentHint: string): string {
  return [
    '---',
    `description: ${description}`,
    `argument-hint: ${argumentHint}`,
    'disable-model-invocation: true',
    '---',
    '',
  ].join('\n');
}

/** Where the CLI lives inside an installed plugin, quoted for a path with spaces. */
const CLI = 'node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts"';

function addCommand(category: ResolvedCategory): CommandFile {
  const slug = commandSlug(category.name);
  // Normative items are demoted to `draft` on capture and govern nothing
  // until a human promotes them; rationale items are created active and are
  // never auto-injected at all. Saying which one happened is the difference
  // between "captured" and "captured and now governing".
  const landing = category.tier === 'normative'
    ? 'It lands as a **draft**: it governs nothing until a human promotes it with ' +
      '`/mycontext:review`. Say so in your one-line report.'
    : 'Rationale items land active, and rationale is never auto-injected into a session — ' +
      'it is there to be found later. Say so in your one-line report.';

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
   not interrogate the user — at most one clarifying question. Leave \`scope\` empty if the
   item is not about particular files; an unscoped item is indexed and searchable but is
   never auto-injected.
4. Report the id it returns, in one line. ${landing}

If the MCP server is not available, \`${CLI} add ${category.name} "<title>"\` captures the
title only — no body, scope or tags — so prefer the tool.
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
