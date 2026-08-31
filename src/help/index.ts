import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  TIER_UPDATES, type CategoryUpdates, type UpdatableName,
} from '../core/categories.ts';
import type { Config, ResolvedCategory } from '../core/config.ts';
import { table, wrap } from '../cli/commands/format.ts';
import { parseFrontmatter } from '../core/frontmatter.ts';
import { computeItemChecksum, renderItem } from '../core/item.ts';
import { snapshotBody, snapshotChecksum, snapshotText } from '../core/reference.ts';
import { makeId } from '../core/slug.ts';
import { COMMANDS, type CommandDef } from '../cli/commands/registry.ts';
import { HELP_TOPICS, enumError, type HelpTopic } from '../core/teach.ts';
import type { Item } from '../core/types.ts';
import { createRegistry } from '../mcp/tools.ts';
import type { ToolDefinition } from '../mcp/protocol.ts';
import { CLI_WITHOUT_SLASH, TOOL_PARITY } from '../plugin/parity.ts';
import { HE_CATEGORY_DESCRIPTIONS, HE_TABLE_HEADER } from './he.ts';

// Re-exported, not declared: the list itself lives in `core/teach.ts`, which
// imports nothing, so `mcp/tools.ts` can read it while building its schemas
// without depending on which side of the cycle loaded first.
export { HELP_TOPICS };

/**
 * The one non-English source language a topic can carry. The CLI itself is
 * NOT localized — `mycontext help` speaks English on every terminal — and
 * this type exists for exactly one caller: the documentation generator, which
 * fills `docs/README.he.md`'s `help categories` block from the Hebrew source
 * so the Hebrew document's largest section is not English prose inside it.
 */
export type HelpLocale = 'he';

/**
 * The locale the documentation harness asked for, read from the environment
 * the way `MYCONTEXT_DOC_CLOCK` is: an undocumented pin for the generator and
 * its drift test, not a user surface. Unset means English; anything that is
 * set and is not a known locale throws rather than being silently English —
 * a typo'd value would otherwise regenerate the Hebrew document's block in
 * English and every test would agree it is fine.
 */
export function docLocale(): HelpLocale | undefined {
  const value = process.env.MYCONTEXT_DOC_LOCALE;
  if (value === undefined || value === '') return undefined;
  if (value === 'he') return 'he';
  throw new Error(
    `my_context: MYCONTEXT_DOC_LOCALE is "${value}", which is not a known locale ("he"). ` +
    'Unset it for English.',
  );
}

/** Documented but deliberately not registered. Empty now that Plan 4 implements
 * ingest_document; keep the export — it is what lets a tool be documented ahead
 * of its implementation without breaking the documented-set-equals-known-set test. */
export const RESERVED_TOOLS: string[] = [];

const TOPIC_DIR = path.join(import.meta.dirname, 'topics');

/**
 * A localized topic lives beside its English source as `<topic>.<locale>.md`.
 * A locale whose file does not exist throws with the path to create rather
 * than falling back to English: a silent fallback is how the Hebrew README's
 * categories section came to be English in the first place, and "nothing is
 * dropped silently" is this project's rule for exactly that shape of failure.
 */
function readTopicFile(topic: string, locale?: HelpLocale): string {
  const file = path.join(TOPIC_DIR, locale ? `${topic}.${locale}.md` : `${topic}.md`);
  try {
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch (err) {
    if (locale && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `my_context: the topic "${topic}" has no "${locale}" source (${file} does not exist). ` +
        'Translate the topic before asking for it in that locale.',
      );
    }
    throw err;
  }
}

/**
 * The raw text of capture.md. Exported so a test can build a MODIFIED COPY
 * and hand it to `toolDescriptions(source)` — see the note there — instead of
 * writing to the tracked file.
 */
export function captureTopicSource(): string {
  return readTopicFile('capture');
}

function tierRank(category: ResolvedCategory): number {
  return category.tier === 'normative' ? 0 : 1;
}

/**
 * The resolved category a caller named, or a teaching refusal.
 *
 * `Object.hasOwn`, not a bare index: `config.categories[type]` on a
 * prototype-polluting `type` (e.g. `"constructor"`) resolves to
 * `Object.prototype.constructor` instead of `undefined`, producing a raw
 * `TypeError` deep inside the caller rather than a teaching message — the same
 * hazard `mutate.ts`'s `resolveCategory` guards against twice. Shared by the
 * two things `mycontext examples` prints, so the specimen and the update
 * surface cannot answer differently about whether a type exists.
 */
function categoryOf(type: string, config: Config): ResolvedCategory {
  if (!Object.hasOwn(config.categories, type)) {
    throw new Error(enumError('type', type, Object.keys(config.categories), 'categories'));
  }
  return config.categories[type];
}

/**
 * The category table, generated from the resolved config (spec §9).
 *
 * The `locale` changes ONLY the language column and the header. Name, tier
 * and id prefix are printed from the resolved config in every locale — they
 * are identifiers a user types into config and ids, and machine facts a test
 * can check — so the Hebrew table cannot disagree with the English one about
 * anything but words. A custom category has no translation and keeps the
 * description its own project wrote.
 */
export function categoryTable(config: Config, locale?: HelpLocale): string {
  const describe = (name: string, description: string): string =>
    (locale === 'he' ? HE_CATEGORY_DESCRIPTIONS[name] ?? description : description);
  const rows = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => tierRank(a) - tierRank(b) || a.name.localeCompare(b.name))
    .map((c) => `| \`${c.name}\` | ${c.tier} | \`${c.prefix}-\` | ${describe(c.name, c.description)} |`);

  const header = locale === 'he' ? HE_TABLE_HEADER : '| type | tier | id prefix | use for |';
  return [header, '|---|---|---|---|', ...rows].join('\n');
}

/* -------------------------------------------------------------------------- *
 * The updatable surface: what may be changed on an item, and by which command.
 *
 * Every line of it is rendered from `TIER_UPDATES` and `CategoryDef.updates`
 * (core/categories.ts). Nothing below re-states a fact those declarations
 * carry, and that restraint is the requirement rather than a style: five rules
 * — `state` on a task being a TAG, `--tags` replacing the whole list,
 * `--severity hard` being refused on the rationale tier, `always` having two
 * spellings, `source_file` having no command at all — were each learned by
 * trying something and reading the refusal, which is guidance arriving after
 * the attempt. A sentence written here beside a declaration would be free to
 * drift from it, and four statements in this project's design of record were
 * measured false in one week that way.
 * -------------------------------------------------------------------------- */

/**
 * How a name is written where the surrounding surface can carry a code span
 * (`SPAN`, the Markdown topic) or cannot (`PLAIN`, a bordered terminal table).
 * One pair of renderers, so the two surfaces cannot come to disagree about
 * which facts they print — only about how they mark them up.
 */
type Code = (s: string) => string;
const PLAIN: Code = (s) => s;
const SPAN: Code = (s) => `\`${s}\``;

/**
 * The width the topic sources' own paragraphs are hard-wrapped to, so a
 * generated sentence sits in the document at the same measure as the
 * hand-written ones around it. Not `outputWidth()`: this is a committed
 * Markdown document rendered into two READMEs, and a width read from the
 * environment would make the generated block a fact about the terminal the
 * maintainer last ran `npm run gen:docs` in.
 */
const TOPIC_PROSE_WIDTH = 79;

/**
 * The spelling for a name whose declaration carries no `command` of its own.
 *
 * `UpdatableName.command` states the default in as many words — "Absent means
 * the generic spelling for an extra field, `mycontext edit <id> --extra
 * <name>=<value>`" — and that flag is a real flag of a real command
 * (`cli/commands/edit.ts` · `[--extra key=value]`). The name is substituted
 * into it rather than left as `<name>`, because the reader is looking at one
 * name and the whole point of the column is that they can type what it says.
 */
function changeCommand(name: string, entry: UpdatableName): string {
  return entry.command ?? `mycontext edit <id> --extra ${name}=<value>`;
}

/**
 * Where the value lives — and, when the declaration names one, the tag prefix
 * the tool keeps in sync with it. `projectsTo` is the one thing a reader
 * cannot see from the item: a field whose value is also written as a tag looks
 * like two facts that must be kept in step by hand, and it is not one.
 */
function storedAs(entry: UpdatableName, code: Code): string {
  return entry.projectsTo === undefined
    ? entry.store
    : `${entry.store}, projected to ${code(`${entry.projectsTo}:`)} tags`;
}

/** The closed vocabulary, or the answer an absent one declares: free text. */
function legalValues(entry: UpdatableName, code: Code): string {
  return entry.values === undefined ? 'free text' : entry.values.map(code).join(', ');
}

/**
 * One name as two Markdown lines: what it is and how it is typed, then the
 * declaration's own note verbatim.
 *
 * A LIST rather than a table, and for the reason `commandList` gives above:
 * `body`'s command is `mycontext edit <id> --body "…" | --file <path>`, and a
 * literal `|` ends a GFM table cell. The escape that fixes the rendering is
 * printed literally by `mycontext help categories` — a backslash inside the
 * exact string the reader is about to type.
 */
function updateList(updates: CategoryUpdates): string[] {
  return Object.entries(updates).flatMap(([name, entry]) => [
    // Unwrapped, like a row of the category table above it: the three answers
    // are one line each so the names line up, and a break inside the command
    // would put half of a string the reader is about to type on its own line.
    `- **\`${name}\`** — a ${storedAs(entry, SPAN)}; ${legalValues(entry, SPAN)}; ` +
    `\`${changeCommand(name, entry)}\``,
    // The note IS prose, and is wrapped to the width this topic's own
    // paragraphs are written to. Markdown reflows it either way; a terminal
    // does not, and `mycontext help categories` is read in one.
    ...wrap(entry.note, TOPIC_PROSE_WIDTH - 2).map((line) => `  ${line}`),
  ]);
}

/** The header every rendering of the surface carries, spelled once. */
const UPDATE_HEADERS = ['name', 'stored as', 'values', 'how to change it', 'what it is'];

/** The same names as rows for `table` (cli/commands/format.ts), unmarked up. */
function updateRows(updates: CategoryUpdates): string[][] {
  return Object.entries(updates).map(([name, entry]) => [
    name,
    storedAs(entry, PLAIN),
    legalValues(entry, PLAIN),
    changeCommand(name, entry),
    entry.note,
  ]);
}

/**
 * `{{TIER_UPDATES}}` — the rules that belong to the TIER, one block per tier.
 *
 * They are rendered here, in the topic every category shares, because that is
 * where they are declared: `TIER_UPDATES` holds them once rather than in 24
 * copies. The two tiers genuinely differ, and the difference is the part a
 * reader cannot guess — on `rationale`, `severity` offers only `soft` and
 * `always` only `false`, because the governing values are refused there — so
 * both blocks are printed in full rather than one being described as "the
 * other, except…".
 */
export function tierUpdateList(): string {
  return Object.entries(TIER_UPDATES)
    .flatMap(([tier, updates]) => [
      `**Every \`${tier}\`-tier item:**`, '', ...updateList(updates), '',
    ])
    .join('\n').trimEnd();
}

/**
 * `{{CATEGORY_UPDATES}}` — what each enabled category adds beyond its tier.
 *
 * From the resolved config, so a category defined only in `config.json` is
 * rendered by this function and no other: it is listed here if it declares
 * names of its own and named in the closing line if it does not, on exactly
 * the terms every shipped category is. There is no branch for a built-in, and
 * that absence is the check that the data path is the only path.
 *
 * The categories that declare nothing are named in one line rather than given
 * a block each. Nineteen of the twenty-four shipped ones are silent, and
 * nineteen blocks saying "nothing of its own" would bury the five that are
 * not — but leaving them out entirely would leave a reader unable to tell "no
 * declaration" from "not rendered", which is the distinction the whole
 * requirement is about.
 */
export function categoryUpdateList(config: Config): string {
  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => tierRank(a) - tierRank(b) || a.name.localeCompare(b.name));

  const lines: string[] = [];
  const silent: string[] = [];
  for (const category of enabled) {
    const names = Object.keys(category.updates);
    if (names.length === 0) { silent.push(category.name); continue; }
    lines.push(
      `**\`${category.name}\`** — the \`${category.tier}\` rules above, and ` +
      `${names.length} of its own:`,
      '', ...updateList(category.updates), '',
    );
  }
  if (silent.length > 0) {
    // "The other 20 … declare nothing of THEIR own" against "Every enabled
    // category … declares nothing of ITS own": the subject is plural only in
    // the first form, and only when there is more than one of them. A
    // catalogue where every category declares something is a real state and
    // prints no sentence at all.
    const all = lines.length === 0;
    const one = !all && silent.length === 1;
    lines.push(...wrap(
      `${all ? 'Every enabled category' : `The other ${silent.length}`} — ` +
      `${silent.map((n) => `\`${n}\``).join(', ')} — ` +
      `${all || one ? 'declares nothing of its own' : 'declare nothing of their own'}: ` +
      `what may be changed on one is exactly its tier's rules above, and nothing else.`,
      TOPIC_PROSE_WIDTH,
    ));
  }
  return lines.join('\n').trimEnd();
}

/**
 * The same surface for ONE category, as `mycontext examples <category>` prints
 * it beside the specimen.
 *
 * Two tables rather than one merged table, because the split is the fact: the
 * first is everything true of any item on that tier, the second is what this
 * category adds. A single table would have to carry a "declared where?" column
 * to say the same thing, and would then say it once per row.
 *
 * Bordered through `table` (cli/commands/format.ts), which is what the six
 * reporting commands draw with and which honours `MYCONTEXT_ASCII` /
 * `MYCONTEXT_UNICODE` — this is terminal output, not the Markdown the help
 * topic is.
 */
export function updatableSurface(type: string, config: Config): string {
  const category = categoryOf(type, config);
  const own = updateRows(category.updates);
  return [
    `What may be changed on a \`${category.name}\`, and by which command.`,
    '',
    `Every \`${category.tier}\`-tier item:`,
    ...table(UPDATE_HEADERS, updateRows(TIER_UPDATES[category.tier])),
    '',
    own.length === 0
      ? `A \`${category.name}\` declares nothing of its own: those are all of them.`
      : `And on a \`${category.name}\` in particular:`,
    ...table(UPDATE_HEADERS, own),
  ].join('\n');
}

/**
 * The command list, generated from the CLI's own registry (spec §9's rule for
 * the category table, applied to the other half of the surface).
 *
 * **Generated, not written, and that is the whole point of it.** A
 * hand-written command list is stale the first time a command is added, and
 * nothing catches it — which is exactly what happened to the two lines in the
 * README that still say `mycontext help` takes four topics. `CommandDef`
 * already carries the two facts a reader needs (`usage`, the spelling; and
 * `summary`, what it does), so this reads them rather than restating them, and
 * a command registered tomorrow appears in `mycontext help cli` with no edit
 * here and none in `cli.md`.
 *
 * **A list rather than a Markdown table**, which is where this departs from
 * `categoryTable` above. Six usage strings contain a literal `|` —
 * `edit <id> [--title|--body|…]`, `lesson "<text>" | <id>`,
 * `review [list|show|…]`, and the three that carry `[--full|--short|--summary]`.
 * A `|` inside a GFM table cell ends the cell, and the escape that fixes the
 * rendering (`\|`) is printed LITERALLY by `mycontext help cli` — backslashes
 * inside the exact strings the reader is about to type. One line per command
 * costs nothing in either surface.
 *
 * `commands` is injectable for the same reason `toolDescriptions(source)` is:
 * a test needs to render this from a registry it controls, and no test may
 * write to `src/`.
 */
export function commandList(commands: Map<string, CommandDef> = COMMANDS): string {
  // An empty registry is refused rather than rendered. `COMMANDS` is populated
  // by side effect when `src/cli/index.ts` loads — it imports
  // `cli/commands/index.ts` AND registers the seven built-ins itself — so a
  // process that never loaded the CLI (the MCP server is one) would otherwise
  // print a topic whose "Commands" section is complete, authoritative and
  // empty. That is the accepted-and-wrong answer this project rules out, and
  // it is invisible: every other line of the topic still reads correctly.
  if (commands.size === 0) {
    throw new Error(
      'my_context: the "cli" topic is generated from the CLI\'s command registry, and this ' +
      'process never loaded the CLI, so the registry is empty. Rendering it here would print ' +
      'a command section that names no commands — complete-looking and empty. Run ' +
      '`mycontext help cli` in a terminal, which does load it. (To serve this topic from ' +
      'another process, import src/cli/index.ts: loading it is what registers the commands. ' +
      'The MCP server does not, which is why mycontext_help does not offer this topic.)',
    );
  }
  return [...commands.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `- \`mycontext ${c.usage}\` — ${c.summary}`)
    .join('\n');
}

/* -------------------------------------------------------------------------- *
 * The `tools` topic's three generated sections.
 * -------------------------------------------------------------------------- */

/**
 * The tool definitions the MCP server advertises, read from the registry that
 * answers `tools/list` rather than from anything written down.
 *
 * **`SPECS` is a module-level array literal, so this has NONE of the emptiness
 * hazard `commandList` refuses on.** `COMMANDS` is a `Map` that
 * `src/cli/index.ts` fills BY SIDE EFFECT as it loads, which is why the `cli`
 * topic cannot render in a process that never loaded the CLI. The tool
 * registry is complete the moment `src/mcp/tools.ts` finishes evaluating, and
 * this module imports it, so it is complete everywhere this module is —
 * checked by `test/help/tools-topic.test.ts`, which renders the topic from a
 * child process that loads nothing but this file.
 *
 * The import is a CYCLE — `mcp/tools.ts` imports `helpTopic`, `exampleItem`
 * and `toolDescriptions` from here — and it is safe for one reason worth
 * stating rather than discovering: neither module *calls* the other at module
 * scope. `mcp/tools.ts`'s top level builds `DEFAULT_CONFIG` and `SPECS`; this
 * file's top level builds `HELP_TOPICS`, `TOPIC_DIR` and `SEEDS`. Whichever is
 * entered first, the other finishes evaluating before any function in it runs,
 * so no binding is read in its temporal dead zone. Do not move a
 * `createRegistry()` or `helpTopic()` call to module scope in either file.
 *
 * `createRegistry`'s `cwd` is captured by the tool HANDLERS and never read by
 * `list()`, so nothing here can touch a workspace. `TOPIC_DIR` is passed
 * rather than a fabricated path so that the value is at least a real
 * directory if that ever changes.
 */
function toolDefinitions(): ToolDefinition[] {
  return createRegistry(TOPIC_DIR).list();
}

/** `{"type": "string", "enum": [...]}` → `hard, soft`; otherwise null. */
function schemaEnum(schema: Record<string, unknown>): string | null {
  const values = schema.enum;
  return Array.isArray(values) ? values.map((v) => `\`${String(v)}\``).join(', ') : null;
}

/**
 * The whole argument surface, tool by tool, generated from the schemas the MCP
 * server advertises (spec §9's rule for the category table, applied to the
 * third surface).
 *
 * **Generated, not written, and that is the whole point of it.** A
 * hand-written argument list is stale the first time a tool gains, loses or
 * renames an argument, and nothing catches it — the failure `commandList`
 * documents, one surface over. Everything printed here has exactly one home:
 * the name and the description come from `toolDescriptions` (capture.md, which
 * is also what the model is sent), and the arguments, their `required` flag,
 * their enums and their per-argument descriptions come from `ToolSpec.schema`,
 * which is the same object `tools/list` returns.
 *
 * A LIST rather than a Markdown table, for `commandList`'s reason: several
 * argument descriptions contain a literal `|` (`kind: functional |
 * non_functional`, and every other `EXTRA_FIELD_HINTS` entry), a `|` inside a
 * GFM cell ends the cell, and the `\|` that fixes the rendering is printed
 * literally by `mycontext help tools`.
 */
export function toolReference(definitions: ToolDefinition[] = toolDefinitions()): string {
  if (definitions.length === 0) {
    throw new Error(
      'my_context: the "tools" topic is generated from the MCP tool registry, and it came ' +
      'back empty. Unlike the CLI\'s command registry this one is never populated by side ' +
      'effect, so an empty answer means the registry itself is broken rather than unloaded.',
    );
  }
  return definitions.map((tool) => {
    const schema = tool.inputSchema;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    const names = Object.keys(properties);

    const args = names.length === 0
      ? ['  - takes no arguments at all.']
      : names.map((name) => {
        const detail = properties[name] ?? {};
        const values = schemaEnum(detail);
        const description = typeof detail.description === 'string' ? detail.description : null;
        return `  - \`${name}\`${required.includes(name) ? ' — **required**' : ''}`
          + (values === null ? '' : ` — one of ${values}`)
          + (description === null ? '' : ` — ${description}`);
      });

    return [`- \`${tool.name}\` — ${tool.description}`, ...args].join('\n');
  }).join('\n\n');
}

/**
 * Which `mycontext` command and which `/mycontext:` command answer each tool,
 * generated from `TOOL_PARITY` (src/plugin/parity.ts) — the declaration
 * `test/plugin/parity.test.ts` already holds to the running program in both
 * directions, so a row here cannot claim a command that does not exist.
 *
 * NAMES ONLY in the table, and the reasons in `toolParityNotes` below it. A
 * `note` is prose and may one day contain a `|`; a command name is `[a-z_-]+`
 * and cannot.
 */
export function toolParityTable(rows = TOOL_PARITY): string {
  const cell = (name: string | null, prefix: string): string =>
    (name === null ? '— *see below*' : `\`${prefix}${name}\``);
  return [
    '| tool | the CLI command | the slash command |',
    '|---|---|---|',
    ...[...rows]
      .sort((a, b) => a.tool.localeCompare(b.tool))
      .map((r) => `| \`${r.tool}\` | ${cell(r.cli, 'mycontext ')} | ${cell(r.slash, '/mycontext:')} |`),
  ].join('\n');
}

/** The reason beside every one-sided row above — required by `ToolParity`. */
export function toolParityNotes(rows = TOOL_PARITY): string {
  return [...rows]
    .filter((r) => r.cli === null || r.slash === null)
    .sort((a, b) => a.tool.localeCompare(b.tool))
    .map((r) => `- \`${r.tool}\` has no ${r.cli === null ? 'CLI' : 'slash'} spelling. ${r.note}`)
    .join('\n');
}

/* -------------------------------------------------------------------------- *
 * The `slash` topic's two generated sections.
 * -------------------------------------------------------------------------- */

/** Where the committed plugin command files live: `<repo>/commands`. */
const COMMANDS_DIR = path.join(import.meta.dirname, '..', '..', 'commands');

/**
 * One command file as this topic reads it: the name a user types, the
 * `description:` its own frontmatter declares, and whether that frontmatter
 * leaves the command open to the model.
 *
 * Exported for the reason `commandList`'s injectable `commands` is: a test
 * needs to render these sections from a list it controls, and no test may
 * write into `commands/`.
 */
export interface SlashCommand { name: string; description: string; modelInvocable: boolean }

/**
 * Every slash command this plugin ships, read from the committed
 * `commands/*.md` files.
 *
 * **The directory is the source because the directory is the product**: Claude
 * Code discovers plugin commands by scanning `commands/` on disk, so what is
 * there is what a user can type. `src/plugin/commands.ts` generates those
 * files and `test/plugin/commands.test.ts` holds them byte-identical to it, so
 * reading the directory is reading the generator through the artefact it
 * writes — `test/help/slash-topic.test.ts` closes that loop from this side by
 * asserting the topic names every file `generateCommands` produces.
 *
 * Reading the directory rather than importing the generator is a decision, not
 * a shortcut, and the reason is a side effect: `src/plugin/commands.ts`
 * imports `NAMED_ENTRY_POINTS` from `src/cli/commands/edit.ts`, and *loading*
 * that module REGISTERS `edit`, `pin`, `unpin`, `harden`, `soften` and
 * `review` into `COMMANDS`. Importing the generator here would therefore make
 * the CLI's command registry half-populated in every process that loads help —
 * including the MCP server, where `commandList` would then render six commands
 * as the CLI's complete surface instead of refusing. That is precisely the
 * complete-looking-and-wrong answer the `cli` topic's refusal exists to
 * prevent, and this topic must not be the thing that causes it.
 */
function slashCommands(): SlashCommand[] {
  let files: string[];
  try {
    files = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }
  return files.sort((a, b) => a.localeCompare(b)).map((file) => {
    const name = file.replace(/\.md$/, '');
    const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path.join(COMMANDS_DIR, file), 'utf8'));
    const data = front === null ? {} : parseFrontmatter(front[1]);
    const description = typeof data.description === 'string' ? data.description : '';
    return {
      name,
      description,
      // Absent means the model MAY invoke it — the Claude Code default — so
      // this reads the absence as permission rather than treating an
      // unannotated file as if it carried the flag.
      modelInvocable: data['disable-model-invocation'] !== true,
    };
  });
}

/** `add-rule` and `list-rule` are one pair per category; everything else is
 * a command in its own right. Split on the FILE prefix rather than on the
 * category set, so this needs no config and cannot disagree with one. */
function isPerCategory(name: string): boolean {
  return name.startsWith('add-') || name.startsWith('list-');
}

/**
 * An empty command set is refused rather than rendered, exactly as
 * `commandList` refuses an empty `COMMANDS` — and the reason is the same, one
 * surface over: an empty section reads as complete and authoritative. It is
 * checked at the RENDER boundary rather than inside `slashCommands`, so it
 * holds for a caller that supplies its own list too.
 */
function requireCommands(commands: SlashCommand[]): SlashCommand[] {
  if (commands.length === 0) {
    throw new Error(
      `my_context: the "slash" topic is generated from the plugin's committed command files, ` +
      `and there are none to render (${COMMANDS_DIR}). Those files ARE the surface — Claude ` +
      `Code discovers slash commands by scanning that directory — so an empty answer here ` +
      `would describe a plugin with no commands rather than a checkout with no files. Run ` +
      `\`npm run gen:commands\`.`,
    );
  }
  return commands;
}

/**
 * The slash surface, generated from the files that are it.
 *
 * The per-category pairs are counted rather than enumerated, and that is the
 * ruling this topic was written under: the category set is `help("categories")`
 * and printing 24 more names here would be a second copy of it, free to drift.
 * What is printed instead is what a reader cannot get from that table — the
 * spelling rule, demonstrated with a real name taken from the directory.
 */
export function slashCommandList(input = slashCommands()): string {
  const commands = requireCommands(input);
  const generic = commands.filter((c) => !isPerCategory(c.name));
  const add = commands.filter((c) => c.name.startsWith('add-'));
  const list = commands.filter((c) => c.name.startsWith('list-'));
  // A category whose name is snake_case reaches this surface kebab-cased, and
  // the example is taken from the directory so it cannot become a name that
  // is not there.
  const kebab = add.find((c) => c.name.slice('add-'.length).includes('-'));

  return [
    ...generic.map((c) => `- \`/mycontext:${c.name}\` — ${c.description}`),
    '',
    `- \`/mycontext:add-<type>\` — ${add.length} of them, one per category the shipped `
    + `catalogue enables, each capturing one item of that type.`,
    `- \`/mycontext:list-<type>\` — ${list.length} of them, the listing half of the same pair.`,
    '',
    'The `<type>` in those two is the category name **kebab-cased**: a category is'
    + ' `snake_case` everywhere else in this product, and'
    + (kebab === undefined
      ? ' no enabled category has a multi-word name in this build to show it with.'
      : ` \`${kebab.name.slice('add-'.length).replaceAll('-', '_')}\` is`
        + ` \`/mycontext:${kebab.name}\`, not \`/mycontext:add-${kebab.name.slice('add-'.length).replaceAll('-', '_')}\`.`),
  ].join('\n');
}

/** The one command file the model may invoke itself, derived from the
 * `disable-model-invocation` flag each file declares. */
export function slashModelInvocable(input = slashCommands()): string {
  const open = requireCommands(input).filter((c) => c.modelInvocable);
  if (open.length === 0) return 'None. Every command file declares `disable-model-invocation: true`.';
  return open.map((c) => `\`/mycontext:${c.name}\``).join(', ');
}

/**
 * The CLI verbs with no slash command at all, and the declared reason for each
 * — `CLI_WITHOUT_SLASH` (src/plugin/parity.ts), which `test/plugin/parity.test.ts`
 * refuses to let go stale in either direction: an entry with no reason fails,
 * and so does a command missing from the list.
 */
export function slashAbsences(entries = CLI_WITHOUT_SLASH): string {
  return Object.entries(entries)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, why]) => `- \`mycontext ${name}\` — ${why}`)
    .join('\n');
}

/**
 * `split`/`join` rather than `String.replace`: a generated table can contain
 * `$` sequences that `replace` would interpret as capture-group references.
 */
function expand(text: string, token: string, value: string): string {
  return text.split(token).join(value);
}

/**
 * Every generated section, keyed by the token that stands in for it.
 *
 * Each value is a THUNK, and each is called only for a topic that actually
 * carries its token — so rendering `categories` from a process which never
 * loaded the CLI does not acquire a precondition on the command registry being
 * populated (see `commandList`'s refusal), and rendering `cli` does not
 * acquire one on the `commands/` directory being present. A section whose
 * source is unavailable must fail only for the topic that prints it.
 *
 * `{{CATEGORY_TABLE}}` and `{{CATEGORY_UPDATES}}` are not here: they are the
 * sections that take the caller's `config` (and, for the table, its `locale`),
 * and neither has a precondition to defer.
 */
const GENERATED: Record<string, () => string> = {
  '{{COMMAND_LIST}}': () => commandList(),
  '{{TIER_UPDATES}}': () => tierUpdateList(),
  '{{TOOL_REFERENCE}}': () => toolReference(),
  '{{TOOL_PARITY_TABLE}}': () => toolParityTable(),
  '{{TOOL_PARITY_NOTES}}': () => toolParityNotes(),
  '{{SLASH_COMMAND_LIST}}': () => slashCommandList(),
  '{{SLASH_MODEL_INVOCABLE}}': () => slashModelInvocable(),
  '{{SLASH_ABSENCES}}': () => slashAbsences(),
};

export function helpTopic(topic: string, config: Config, locale?: HelpLocale): string {
  if (!HELP_TOPICS.includes(topic as HelpTopic)) {
    throw new Error(enumError('topic', topic, HELP_TOPICS, 'workflow'));
  }
  let text = expand(
    readTopicFile(topic, locale), '{{CATEGORY_TABLE}}', categoryTable(config, locale),
  );
  text = expand(text, '{{CATEGORY_UPDATES}}', categoryUpdateList(config));
  for (const [token, render] of Object.entries(GENERATED)) {
    if (text.includes(token)) text = expand(text, token, render());
  }
  return text;
}

const TOOL_LINE = /^-\s+`([a-z_]+)`:\s+(.+)$/;

/**
 * Tool descriptions, parsed from capture.md's `## Tools` section. This is the
 * single source: Task 7 asserts the documented set equals the registered set
 * plus RESERVED_TOOLS, so neither can drift from the other.
 *
 * `source` overrides the text parsed, defaulting to capture.md itself. It
 * exists so the malformed-line tests can exercise this parser against a
 * string instead of temporarily rewriting `src/help/topics/capture.md` — a
 * TRACKED SOURCE FILE the shipped product reads at runtime. `node --test`
 * runs test files concurrently, so a test that corrupted it for even a few
 * milliseconds could be observed by any other test (or child process) that
 * calls `createRegistry`, and a suite killed mid-test would leave the
 * corrupted file behind in the working tree. No test may write to `src/`.
 *
 * Every non-blank line inside the section must be a well-formed
 * `- \`tool_name\`: description` line — a blank line is fine, and a `##`
 * heading ends the section as it always did, but anything else (a malformed
 * name, or a description wrapped onto a second line) throws rather than
 * being silently dropped or silently truncated. A wrapped-continuation line
 * does not start with `- `, so it cannot be caught by checking only lines
 * that do; requiring every non-blank line to match is what actually closes
 * that gap. "Nothing is dropped silently" is a project invariant, and this
 * is the one parse a later task depends on being complete.
 */
export function toolDescriptions(source?: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inSection = false;

  const text = source ?? readTopicFile('capture');
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Tools\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = TOOL_LINE.exec(trimmed);
    if (!match) {
      throw new Error(
        `my_context: capture.md's Tools section has a line that does not match the ` +
        `expected "- \`tool_name\`: description" shape: ${JSON.stringify(trimmed)}`,
      );
    }
    out[match[1]] = match[2].trim();
  }

  return out;
}

/** `YYYY-MM-DD` for today, the same shape and slice `mutate.ts`'s own
 * `today()` writes into `valid_from`. Duplicated rather than imported: this
 * module deliberately depends on nothing in the write path, and a two-line
 * date format is not the kind of thing whose drift can hurt. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A date roughly a year out, for example fields that are meant to name a
 * FUTURE deadline (`assumption.validate_by`). The literal `2026-12-01` this
 * replaces was the same defect as the frozen `valid_from` below, one step
 * subtler: an `assumption` example whose validate-by date has passed
 * illustrates an overdue assumption, i.e. exactly the state the field exists
 * to help a reader avoid. 365 days, not calendar arithmetic — the value is
 * illustrative, and only its being plausibly ahead of the reader matters.
 */
function aboutAYearFromNow(): string {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface Seed {
  title: string;
  body: string;
  /**
   * The file this specimen is a SNAPSHOT of. Set only for `reference`, and it
   * is the distinguishing fact about that category — an item whose body came
   * from a file rather than from someone typing it. `exampleItemOf` derives
   * `source_checksum` from the body rather than taking a literal, so the
   * specimen satisfies the invariant `persist` (core/persist.ts) maintains on a real
   * one: a snapshot's recorded checksum is the checksum of the text it holds.
   */
  sourceFile?: string;
  /**
   * The `## Steps` section, in file order. Set only for `procedure`, and it is
   * the distinguishing fact about that category the same way `sourceFile` is
   * for `reference`: the ordered, tickable list is what the category ADDS over
   * a body, and a `procedure` specimen without one teaches the opposite of what
   * the category is for.
   *
   * Text only. `exampleItemOf` builds every entry `checked: false`, and there
   * is no spelling here for anything else — a shipped specimen must never teach
   * that a tick is stored in the file, because it is not: progress is audit
   * records (`core/progress.ts`), replayed.
   */
  steps?: string[];
  scope?: string[];
  tags?: string[];
  severity?: 'hard' | 'soft';
  always?: boolean;
  extra?: Record<string, string>;
  observations?: { category: string; text: string; tags: string[]; context: string | null }[];
  relations?: { type: string; target: string }[];
}

const SEEDS: Record<string, Seed> = {
  constraint: {
    title: 'Postgres connection pool capped at 20',
    body: 'RDS permits 25 connections; 5 are reserved for migrations and the admin console.',
    scope: ['src/db/**', 'src/api/handlers/**'],
    tags: ['database', 'performance'],
    severity: 'hard',
    observations: [
      { category: 'limit', text: 'Pool size must never exceed 20 across all workers', tags: ['database'], context: null },
    ],
    relations: [{ type: 'derived_from', target: 'ADR-managed-postgres' }],
  },
  invariant: {
    title: 'Order total always equals the sum of its line items',
    body: 'Any divergence means a rounding or currency bug and must fail loudly.',
    scope: ['src/billing/**'],
    severity: 'hard',
  },
  rule: {
    title: 'Never log request bodies on auth endpoints',
    body: 'Bodies carry passwords and reset tokens; logs are retained for 90 days.',
    scope: ['src/api/auth/**'],
    extra: { directive: 'dont' },
  },
  requirement: {
    title: 'Users can reset their password without support',
    body: 'A one-time link is emailed and expires after 30 minutes.',
    scope: ['src/api/auth/**'],
    extra: { kind: 'functional' },
  },
  standard: {
    title: 'Every exported function carries a doc comment',
    body: 'Internal helpers do not need one; the public surface does.',
    scope: ['src/**/*.ts'],
  },
  pattern: {
    title: 'Repository objects wrap every query, handlers never open a connection',
    body: 'Keeps pool accounting in one place and makes the pool cap enforceable.',
    scope: ['src/db/**'],
  },
  glossary: {
    title: 'Tenant means a paying organisation, not a user',
    body: 'Say "tenant" for the billing entity and "member" for a person inside it. Never "account".',
  },
  instruction: {
    title: 'Run the test suite before proposing a change is complete',
    body: 'A claim of completion without a test run has been wrong often enough to be a rule.',
    always: true,
  },
  non_goal: {
    title: 'We are not building offline support',
    body: 'Every client is assumed online. Do not add local queues or sync reconciliation.',
  },
  open_question: {
    title: 'Do we shard by tenant or by region?',
    body: 'Both are viable; the decision waits on Q3 traffic data. Do not assume either.',
  },
  runbook: {
    title: 'Rotating the Stripe webhook secret',
    body:
      '1. Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.\n' +
      '2. Roll the endpoint secret in Stripe; rolling it before 1 ships loses events.\n' +
      '3. Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.\n'
      + 'Run every time the secret is rotated, which is what makes it a runbook '
      + 'rather than a `procedure`.',
    scope: ['src/billing/webhooks/**'],
    tags: ['billing', 'operations'],
  },
  // Beside `runbook`'s for the same reason their `def()` entries are adjacent:
  // both READMEs print the two specimens next to each other, and the two
  // categories a reader has to tell apart are the two whose worked examples
  // should be read together. `runbook`'s body is the ORDER; this one's body is
  // the WHEN — a one-time correction, and the sentence that names the sibling
  // that keeps doing the job afterwards.
  procedure: {
    title: 'Backfill the tenant_id column on invoices',
    body:
      'One-time correction after the multi-tenant migration: rows written before 2026-07 '
      + 'carry a null tenant_id. Run it once, in this order; the reconciliation query is '
      + 'meaningless until the backfill has finished. Done once and then finished — the '
      + 'nightly job that keeps the column correct from here on is a `runbook`.',
    steps: [
      'Take the invoices table out of the nightly reconciliation job.',
      'Backfill tenant_id in batches of 5,000, oldest first.',
      'Re-run the reconciliation query and compare against the pre-migration total.',
      'Put the table back in the nightly job.',
    ],
    scope: ['src/billing/invoices/**'],
    tags: ['migration', 'billing'],
  },
  environment: {
    title: 'Staging talks to the real Stripe API, local does not',
    body:
      'Local: the Stripe CLI mock. Staging: the real API with test keys.\n'
      + 'Production: the real API with live keys, and the only place retries happen.\n'
      + 'A signature bug therefore looks fine in local and staging, and only bites live.',
    scope: ['src/billing/**'],
    tags: ['billing', 'environments'],
  },
  adr: {
    title: 'Use SQLite with JSONB for the local index',
    body: 'Context, drivers, considered options and consequences follow the MADR shape.',
    observations: [
      { category: 'driver', text: 'Zero runtime dependencies is non-negotiable', tags: [], context: null },
      { category: 'option', text: 'Rejected: an embedded document store, which adds a dependency', tags: [], context: null },
      { category: 'consequence', text: 'Requires Node 24 for stable node:sqlite', tags: [], context: null },
    ],
  },
  decision: {
    title: 'Slug ids rather than sequential ids',
    body: 'Sequential ids collide on branch merge; slugs are self-describing when cited.',
  },
  lesson: {
    title: 'Migrations need an advisory lock',
    body: 'Two deploys ran migrations concurrently and left the schema half-applied.',
    observations: [
      { category: 'symptom', text: 'Duplicate column errors on the second deploy', tags: [], context: null },
    ],
  },
  tradeoff: {
    title: 'Hand-written YAML subset instead of a parser dependency',
    body: 'Bought zero dependencies and fast startup; cost is that unsupported syntax throws.',
  },
  assumption: {
    title: 'Peak traffic stays under 500 requests per second',
    body: 'Based on the last two quarters. The pool cap depends on it.',
    extra: { validate_by: aboutAYearFromNow() },
  },
  edge_case: {
    title: 'Checkout with an empty cart',
    body: 'Reachable via a stale tab. Must return 409, not a 500 from the totals code.',
  },
  risk: {
    title: 'Vendor rate limit could throttle bulk imports',
    body: 'The importer has no backoff today.',
    extra: { likelihood: 'medium', impact: 'high' },
    relations: [{ type: 'mitigates', target: 'CONST-import-batch-size' }],
  },
  reference: {
    title: 'Billing roadmap',
    // The body is what `docs/billing-roadmap.md` said when it was captured —
    // a snapshot, not a summary of one — because that is what the category
    // does, and a specimen that showed a paraphrase would teach the opposite.
    body:
      '# Billing roadmap\n\n'
      + '- Q3: usage-based pricing behind a flag, invoices unchanged.\n'
      + '- Q3: dunning emails move to the billing service.\n'
      + '- Q4: proration. Blocked on the tax vendor decision (OPENQ-tax-vendor).',
    sourceFile: 'docs/billing-roadmap.md',
    scope: ['src/billing/**'],
    tags: ['billing', 'planning'],
    observations: [
      { category: 'why', text: 'The dates move; the ordering has not, and it decides what is safe to build against', tags: [], context: null },
      { category: 'staleness', text: 'Run mycontext doctor after pulling; source_drift means the file moved on and this snapshot did not', tags: [], context: null },
    ],
  },
  known_issue: {
    title: 'The Stripe sandbox declines 3DS test cards at random',
    body:
      'About one checkout test in five fails with card_declined on a card that should pass.\n'
      + 'The same card succeeds on retry: it is the sandbox, not our code. Do not chase it.\n'
      + 'Untrue the day Stripe closes SUP-41022 — check there, and retire this item then.',
    scope: ['test/billing/**'],
    tags: ['billing', 'flaky'],
  },
  todo: {
    title: 'Retry the webhook dispatcher on 5xx',
    body:
      'Stripe retries for 3 days; we drop on the first 5xx from our own handler, '
      + 'so a 30-second outage loses the events that arrived during it.',
    scope: ['src/billing/webhooks/**'],
    tags: ['billing', 'reliability'],
  },
  // `tags: ['bug']` is not decoration. §1.4 makes `note --tag bug` → understood
  // → promoted to `known_issue` the documented route for a bug nobody has
  // characterised yet, and this specimen is where a reader meets it: the body
  // says out loud that it has not been characterised, and names both of the
  // two things it could turn out to be.
  note: {
    title: 'The staging seed script leaves orphaned carts',
    body:
      'Noticed while debugging something else; not characterised yet. If it turns out '
      + 'to be real it is a `known_issue`, and if it turns out to be the seed data it is '
      + 'nothing at all.',
    tags: ['bug'],
  },
};

/**
 * The specimen for a category. Every category in the built-in catalogue has a
 * real one above — `test/help/help.test.ts` asserts that, so a category added
 * without a worked example fails rather than shipping the placeholder below.
 *
 * The placeholder is reached only by a CUSTOM category, where it is the honest
 * answer: this catalogue has never seen the name, so it can offer the shape of
 * an item and the description the project itself wrote, and nothing more. It
 * used to be reached by `policy`, `postmortem` and `taxonomy` as well — three
 * built-ins that shipped disabled — so `mycontext examples policy` printed
 * "Replace this body with the real content and reason." for a category the
 * product itself supplied. Phase 3 removed those three.
 */
function seedFor(category: ResolvedCategory): Seed {
  return SEEDS[category.name] ?? {
    title: `Example ${category.name.replace(/_/g, ' ')}`,
    body: `${category.description}. Replace this body with the real content and reason.`,
  };
}

/** A complete, correct item of the given type, rendered exactly as it is stored. */
export function exampleItem(type: string, config: Config): string {
  return renderItem(exampleItemOf(type, config));
}

/**
 * The same specimen, cut to what distinguishes its category: the id, the
 * title, the category-specific frontmatter fields, and the body.
 *
 * Why a second rendering exists at all. `exampleItem` prints the item exactly
 * as it is stored — every frontmatter key, most of them identical across every
 * category (`status: active`, `origin: human`, three `source_*` nulls, a
 * checksum). That is the right answer for "show me the file shape" and the
 * wrong one for "show me one of each": twenty of those blocks is ~500 lines of
 * near-identical YAML per document, which teaches less per line than the
 * comparisons above it and would make the categories section the largest in
 * the README by some distance.
 *
 * What is kept is what a reader cannot infer from the other blocks:
 *
 * - `id` and `title`, because the id is a slug of the title and that is worth
 *   seeing once per prefix.
 * - Every field the item's `extra` carries. Those are the category-specific
 *   frontmatter fields — `directive` on `rule`, `kind` on `requirement`,
 *   `likelihood`/`impact` on `risk` — and they are the one part of the
 *   frontmatter that differs *because of the category*.
 * - `severity: hard` and `always: true` ONLY when set. Both have a default
 *   (`soft`, `false`) that most specimens take, so printing them everywhere
 *   would say nothing; printing them where a specimen departs from the default
 *   is the whole signal.
 * - The observation categories, when the specimen has observations, because
 *   the shape of an `adr`'s drivers and consequences is a fact about `adr`.
 * - The body.
 * - The `## Steps` lines, when the specimen has any. They earn their place on
 *   exactly the terms `source_file` and the `extra` fields do: they are the
 *   frontmatter-equivalent that differs *because of* the category. Only
 *   `procedure` carries them, and a `procedure` specimen printed without them
 *   is a procedure with no steps — a specimen teaching the opposite of the
 *   category, in both READMEs, which print this block.
 *
 * What is dropped is dropped from the *rendering*, not from the item: the full
 * form is one command away and is what both READMEs show for `rule`. Four to
 * six lines, which is what makes one block per category affordable.
 */
export function exampleItemShort(type: string, config: Config): string {
  const item = exampleItemOf(type, config);

  const lines = [`id: ${item.id}`, `title: ${item.title}`];
  // `source_file` earns its place here on exactly the terms the `extra` fields
  // below do: it is the frontmatter that differs BECAUSE of the category. It
  // is what makes the body below a snapshot of a file rather than text
  // somebody typed, and without it the specimen's quoted body reads as a
  // stylistic choice instead of the format it is.
  if (item.sourceFile !== null) lines.push(`source_file: ${item.sourceFile}`);
  for (const [field, value] of Object.entries(item.extra)) lines.push(`${field}: ${value}`);
  if (item.severity === 'hard') lines.push('severity: hard');
  if (item.always) lines.push('always: true');
  if (item.observations.length > 0) {
    lines.push(`observations: ${item.observations.map((o) => o.category).join(', ')}`);
  }
  lines.push('', item.body.trim());
  // After the body, as the file and the injected block both order them
  // (item.ts · `renderItem`, render-item.ts · `renderItemBlock`): the steps ARE
  // the procedure and the body is what it is for. The marker is the file's own
  // spelling, unticked — see `Seed.steps`.
  if (item.steps.length > 0) {
    lines.push('', ...item.steps.map((step) => `- [${step.checked ? 'x' : ' '}] ${step.text}`));
  }
  return lines.join('\n');
}

/**
 * The specimen itself, before it is rendered either way. Shared so the two
 * renderings cannot show different items — a short form built from its own
 * seed would be a second copy of the catalogue's worked examples, free to
 * drift from the full one the same document prints a few hundred lines above.
 */
function exampleItemOf(type: string, config: Config): Item {
  const category = categoryOf(type, config);

  const seed = seedFor(category);
  const id = makeId(category.prefix, seed.title);

  // A specimen with a `sourceFile` is a SNAPSHOT, and it is built the way a
  // real one is rather than by writing out what one looks like: the body is
  // the seed's text quoted (`snapshotBody`), and `source_checksum` is the
  // checksum of the unquoted text — which is the invariant `persist`
  // (mutate.ts) maintains on every real snapshot. Written this way, the
  // specimen cannot show a shape the write path would not produce.
  const snapshot = seed.sourceFile !== undefined;
  const body = snapshot ? snapshotBody(snapshotText(seed.body)) : seed.body;

  const item: Item = {
    id,
    type: category.name,
    title: seed.title,
    status: 'active',
    severity: seed.severity ?? 'soft',
    always: seed.always ?? false,
    continuity: false, summary: null, summaryOf: null,
    scope: seed.scope ?? [],
    tags: seed.tags ?? [],
    origin: 'human',
    sourceFile: seed.sourceFile ?? null,
    sourceAnchor: null,
    sourceChecksum: snapshot ? snapshotChecksum(seed.body) : null,
    // `today()`, not a literal: `createItem` (mutate.ts) stamps `valid_from`
    // with the day the item was written, and this function's whole contract
    // is "a complete, correct item, rendered exactly as it is stored". A
    // frozen literal made every `mycontext_examples` answer show the same
    // long-past capture date, which is the one field in the rendered example
    // a reader can check against their own clock and find wrong.
    validFrom: today(),
    validUntil: null,
    checksum: '',
    extra: seed.extra ?? {},
    body,
    // Every entry `checked: false`, and there is no spelling for anything else
    // — see `Seed.steps`. A seed that declares none still produces `[]`, which
    // keeps its rendered checksum exactly where it was: `computeItemChecksum`
    // adds its `steps` key only when there are steps.
    steps: seed.steps?.map((text) => ({ text, checked: false })) ?? [],
    observations: seed.observations ?? [],
    relations: seed.relations ?? [],
    layer: 'project',
    filePath: `items/${category.name}/${id}.md`,
  };
  item.checksum = computeItemChecksum(item);

  return item;
}
