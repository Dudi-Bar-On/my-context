/**
 * **`GET /api/cli-help` — the command line, one subject at a time.**
 *
 * `TASK-the-library-explains-the-command-line-every-switch-parameter`, owner
 * requirement 2026-09-06: *"the command-line help, structured and explained,
 * with examples and simple explanations. Every switch, parameter and option
 * explained. A selection box so a reader can ask for help on a specific
 * subject — a command, a slash command, and so on — rather than scrolling."*
 *
 * This module is the read half of that. It answers about four kinds of
 * subject, and **not one of the four is a list written down here**:
 *
 *   `command`  44 — the flag surface of every command the CLI dispatches, from
 *                   `COMMAND_FLAGS` + `FLAG_DECLARATIONS`, `SUBCOMMAND_FLAGS` +
 *                   `SUBCOMMAND_FLAG_DECLARATIONS`, `FLAGLESS_COMMANDS`, and —
 *                   for `edit` alone — `editFlagSurface(ws.config)`, computed
 *                   per workspace on this request.
 *   `topic`     6 — `mycontext help <topic>`, rendered by `helpTopic` from the
 *                   same `src/help/topics/*.md` sources the terminal reads.
 *   `tool`     26 — `toolDefinitions()`, the MCP registry's own list, each with
 *                   its real JSON Schema.
 *   `slash`    91 — `slashCommands()`, read off the committed `commands/*.md`
 *                   whose presence on disk IS the surface Claude Code scans.
 *
 * A count in this comment would be the exact defect the requirement names — the
 * command catalogue said "38 commands" and was right on 2026-08-24 — so the
 * four above are the shape of the answer and `test/ui/cli-help.test.ts`
 * derives every figure it asserts. What the ROUTE reports is measured on the
 * request that asked.
 *
 * ── WHY THE `cli` TOPIC IS NOT ONE OF THE SIX, AND THE SCREEN SAYS SO ─────
 *
 * `HELP_TOPICS` has seven. `MCP_HELP_TOPICS` withholds `cli` because
 * `commandList` builds it out of `COMMANDS`, which only `src/cli/index.ts`
 * fills by side effect, and an MCP server process never loads that module —
 * the topic would come back complete-looking and empty, so it refuses instead.
 *
 * **Every word of that is true of this server too, and more so.** Loading
 * `src/cli/index.ts` here would put the entire mutating command surface into
 * the read server's runtime import graph, which `test/ui/no-writes.test.ts`
 * exists to prevent. So the set served here is `MCP_HELP_TOPICS` BY NAME
 * rather than a copy of it: the two surfaces cannot come to disagree about
 * which topics exist, because there is one list and both read it.
 *
 * The withholding is REPORTED rather than silent (`INV-nothing-is-dropped-
 * silently`): the index carries `withheld`, naming `cli` and why, and the
 * Library screen draws that sentence beside the picker. A reader who wants
 * that page is told the one place it can be rendered — a terminal.
 *
 * ── THE EXAMPLES ARE THE ONES THE DRIFT TEST ALREADY RE-RUNS ──────────────
 *
 * A worked example is prose, and prose is what goes stale. `scripts/gen-doc-
 * examples.ts` already solved that for the READMEs: it RUNS the real command
 * against a committed fixture and writes the true stdout into a marked block,
 * and `test/docs/examples.test.ts` re-runs the same commands and fails when a
 * block no longer matches.
 *
 * So no example is authored here. This module reads the SHIPPED README, parses
 * its marked blocks with `collectExamples` — the generator's own parse,
 * lifted into `core/doc-examples.ts` precisely so a read surface could reach
 * it — and indexes each block by the commands its marker names. What a reader
 * sees under `mycontext review promote` is the command line as the marker
 * spells it and the output the CLI actually produced on the last
 * `npm run gen:docs`, verified on every test run. A command with no block is
 * shown with none: inventing one would be authoring the thing this design
 * refuses to author.
 *
 * ── IT READS, AND THAT IS ALL IT CAN DO ───────────────────────────────────
 *
 * Every import here is one `src/ui/` already had — `core/command-flags.ts`,
 * `core/edit-flags.ts`, `help/index.ts` — plus `core/doc-examples.ts`, which
 * imports nothing at all. No store is opened, no file under the corpus is
 * touched, and the only file read is the plugin's own README, by a path
 * derived from this module's location rather than from anything a request can
 * name.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  COMMAND_FLAGS, DYNAMIC_FLAG_COMMANDS, FLAGLESS_COMMANDS, FLAG_DECLARATIONS,
  SUBCOMMAND_FLAGS, SUBCOMMAND_FLAG_DECLARATIONS,
  type FlagDeclaration, type FlagDeclarations, type FlagSpec,
} from '../core/command-flags.ts';
import { collectExamples, splitPipeline } from '../core/doc-examples.ts';
import { editFlagSurface, UNLINK_ARITY } from '../core/edit-flags.ts';
import { MCP_HELP_TOPICS, type HelpTopic } from '../core/teach.ts';
import type { Workspace } from '../core/workspace.ts';
import {
  COMMANDS_DIR, exampleItemTitle, helpTopic, slashCommands, toolDefinitions,
} from '../help/index.ts';
import { catalogueEntries } from './execute-catalogue.ts';
import { checkCommand } from './read-model-command.ts';
import { badRequest, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/** The four kinds of subject the picker offers. */
export const SUBJECT_KINDS = ['command', 'topic', 'tool', 'slash'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/**
 * How a command's flag surface is KNOWN, which is a different question from
 * what the flags are and is the one the gate in `plan:library seq:1` asked.
 *
 * A screen that only rendered rows could not tell a reader the difference
 * between `mycontext show`, which takes nothing, and a command whose flags
 * nobody had got round to declaring — and that ambiguity is exactly what made
 * "every switch explained" unclaimable before this. So the shape is named.
 */
export type FlagSurface = 'flat' | 'subcommand' | 'none' | 'dynamic';

/** One flag, as a row a person reads. */
export interface FlagView {
  flag: string;
  /** true when the flag consumes the next token; a bare switch is false. */
  takesValue: boolean;
  /** The closed set, when the flag has one. */
  values?: string[];
  /** The open shape and one legal value, when it does not. */
  format?: string;
  example?: string;
  /** The per-workspace vocabulary a control must ASK for, when there is one. */
  source?: string;
  /**
   * The exclusivity group, where `command-flags.ts` declares one — at most one
   * member of a group belongs on a line. Carried through so the worked example
   * below the table can say WHICH flags it left out and why, instead of a
   * reader wondering whether the composer forgot them.
   */
  group?: string;
  note: string;
}

/** One subcommand's own row set — `review promote` and `review list` differ. */
export interface SubcommandView { subcommand: string; flags: FlagView[] }

/** One row of the picker. `label` is what the option says; nothing else. */
export interface SubjectRow { kind: SubjectKind; id: string; label: string; note: string }

/** One worked example, as the generator wrote it and the drift test re-runs it. */
export interface ExampleView { command: string; output: string }

/**
 * A flag row, from the spec that says whether it takes a value and the
 * declaration that says what it means.
 *
 * A flag with no declaration cannot be rendered as a blank note — that is the
 * bare text box with no hint the owner described on 2026-08-24 — so it is a
 * REFUSAL, on `flagReference`'s terms. The two tables are already held to each
 * other flag for flag by `test/cli/command-flags.test.ts`, in both directions
 * and for both key spaces, so reaching this throw means one of them moved
 * without the other and the route says which flag rather than serving a hole.
 */
function flagView(command: string, flag: string, spec: FlagSpec, decl?: FlagDeclaration): FlagView {
  if (decl === undefined) {
    throw new Error(
      `my_context: ${command} accepts --${flag} and no declaration describes it. The Library ` +
      'renders these two tables together (core/command-flags.ts), so an undeclared flag would ' +
      'reach a reader as a row with an empty explanation — which is the state this page exists ' +
      'to end. Declare it beside the spec.',
    );
  }
  const row: FlagView = { flag, takesValue: spec.values.includes(flag), note: decl.note };
  if (decl.values !== undefined) row.values = [...decl.values];
  if (decl.format !== undefined) row.format = decl.format;
  if (decl.example !== undefined) row.example = decl.example;
  if (decl.source !== undefined) row.source = decl.source;
  if (decl.group !== undefined) row.group = decl.group;
  return row;
}

/** Every flag of one spec, in the order the spec accepts them. */
function flagViews(command: string, spec: FlagSpec, declared: FlagDeclarations): FlagView[] {
  return spec.allowed.map((flag) => flagView(command, flag, spec, declared[flag]));
}

/**
 * Every command the CLI dispatches, and which of the four records holds it.
 *
 * The union is the registry — `test/cli/command-flags.test.ts` asserts that
 * partition against `COMMANDS` itself — which is what lets this server name
 * all 44 without importing `src/cli/index.ts`. Sorted, because a picker is
 * read alphabetically and `Object.keys` order is a fact about how the file was
 * typed.
 */
export function commandNames(): string[] {
  return [
    ...Object.keys(COMMAND_FLAGS),
    ...Object.keys(SUBCOMMAND_FLAGS),
    ...FLAGLESS_COMMANDS,
    ...DYNAMIC_FLAG_COMMANDS,
  ].sort((a, b) => a.localeCompare(b));
}

/** Which record a command's flags come from. */
function surfaceOf(name: string): FlagSurface {
  if (Object.hasOwn(COMMAND_FLAGS, name)) return 'flat';
  if (Object.hasOwn(SUBCOMMAND_FLAGS, name)) return 'subcommand';
  if (DYNAMIC_FLAG_COMMANDS.includes(name)) return 'dynamic';
  return 'none';
}

/** The shipped README — this plugin's own, beside `src/`, never the user's. */
const README = path.join(import.meta.dirname, '..', '..', 'README.md');

/**
 * Every worked example, indexed by every command its marker names.
 *
 * A marker may be a pipeline (`ingest … && ingest-apply … && review list`),
 * because a walkthrough's last step often cannot exist without its earlier
 * ones. Each STAGE is indexed, so `ingest-apply` is offered the block that
 * demonstrates it even though the block's visible output belongs to the stage
 * after it — and the command line shown is the whole marker, so a reader is
 * never handed a fragment that would not run.
 *
 * A missing or unreadable README yields no examples rather than a refusal.
 * The flag reference is the page's subject and it is served from code; losing
 * the examples degrades the page, and taking the page down over them would
 * make a documentation file load-bearing on a screen about the CLI.
 */
export function exampleIndex(markdown: string): Map<string, ExampleView[]> {
  const index = new Map<string, ExampleView[]>();
  for (const example of collectExamples(markdown)) {
    const view: ExampleView = { command: `mycontext ${example.command}`, output: example.body };
    for (const stage of splitPipeline(example.command)) {
      const verb = stage[0];
      if (verb === undefined || verb.startsWith('-')) continue;
      const bucket = index.get(verb);
      if (bucket === undefined) index.set(verb, [view]);
      else if (!bucket.includes(view)) bucket.push(view);
    }
  }
  return index;
}

function readExamples(): Map<string, ExampleView[]> {
  try {
    return exampleIndex(readFileSync(README, 'utf8').replaceAll('\r\n', '\n'));
  } catch {
    return new Map();
  }
}

/* ────────────────────────────────────────────────────────────────────────── *
 * `plan:library seq:5` — ONE SKELETON, AND WHAT EACH KIND FILLS.
 *
 * MEASURED STRUCTURALLY on 2026-09-06, before anything below was written:
 *
 *   command   p.small (surface), table.flagtable, subcommand sections, examples
 *   tool      p.small (description), table.flagtable
 *   slash     THREE p.small sentences. No table, no example, no link.
 *   topic     p.small, then rendered Markdown
 *
 * `command` and `tool` already shared one table across two sources that have
 * nothing in common — CLI flag declarations and a JSON Schema — which is the
 * evidence the shape generalises rather than a hope that it might. `slash` was
 * the outlier. `topic` is legitimately different because it IS a document.
 *
 * **What is standardised is the ORDER, not the table.** Every subject now reads
 * the same way: what it is; what it takes; where it runs or who may invoke it;
 * a worked example. A section is drawn when the subject HAS one and is absent
 * when it does not — a `topic` forced to stop being a document, or a shortcut
 * given a one-row table reading "the draft id", would be the same defect as the
 * one this fixes: an absence dressed as data.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * **What a command IS, which this server cannot ask the CLI for.**
 *
 * The one-line summary of every command lives on `COMMANDS`, and `COMMANDS` is
 * filled only by `src/cli/index.ts`'s side-effect imports — the module
 * `test/ui/no-writes.test.ts` bans from `src/ui/` because reaching it registers
 * the whole mutating surface. So the sentence exists and is unreachable from
 * here, which is why a command was the one kind of subject on this card with no
 * "what it is" at all while `tool` and `slash` both had one.
 *
 * It is reachable through the ARTEFACT. `scripts/gen-cli-ui-coverage.ts` prints
 * `c.summary` for every registered command into `docs/cli-ui-coverage.md`, and
 * `test/docs/doc-system.test.ts` regenerates that document and fails on any
 * difference — so the table is the registry, re-derived on every test run. This
 * is exactly the bargain `exampleIndex` already makes with the README, made
 * again for the same reason: the alternative is 44 sentences written here that
 * nothing re-runs.
 */
const COVERAGE = path.join(import.meta.dirname, '..', '..', 'docs', 'cli-ui-coverage.md');

/**
 * A command row of that document → the command, and what it does.
 *
 * `cell()` in the generator escapes `|` as `\|` so a usage summary cannot close
 * the column three characters in; that escape is undone here and nothing else
 * is interpreted. A line that is not a command row simply does not match.
 */
export function commandSummaries(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of markdown.split('\n')) {
    // `((?:\\\||[^|])*?)` and not `(.*?)`: `add`'s own usage summary contains
    // three pipes, escaped by the generator as `\|`, and a lazy match to the
    // next `|` reads the first of them as the end of the column — which
    // truncated `mycontext add` to "create an item (--body\" the first time
    // this ran. The cell is taken whole and the escape undone after.
    const row = /^\|\s*`mycontext ([a-z][a-z-]*)`\s*\|\s*((?:\\\||[^|])*?)\s*\|/.exec(line);
    if (row === null) continue;
    out.set(row[1], (row[2] ?? '').replaceAll('\\|', '|'));
  }
  return out;
}

/** A missing or unreadable document costs the sentence, never the page — the
 *  flag reference is this card's subject and is served from code. */
function readCommandSummaries(): Map<string, string> {
  try {
    return commandSummaries(readFileSync(COVERAGE, 'utf8').replaceAll('\r\n', '\n'));
  } catch {
    return new Map();
  }
}

/* ── WHAT A SHORTCUT RUNS ─────────────────────────────────────────────────── */

/** One subject a slash command was measured to invoke. */
export interface RunTarget {
  kind: 'command' | 'tool';
  /** The subject this links to — `review`, never `review discard`. */
  id: string;
  /** What the link says: `mycontext review`, or the tool's own name. */
  label: string;
  /** The invocations that resolved to it, in the order the file runs them. */
  paths: string[];
  /** True when the shortcut's own NAME designates this subject. */
  named: boolean;
}

/**
 * Every `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" <command> …` in a command
 * file. The invocation IS the link target, which is what stops the reference
 * drifting from what the shortcut really runs: the thing it points at is the
 * thing it executes.
 */
const CLI_INVOCATION = /src\/cli\/index\.ts"\s+([^\n`]*)/g;

/**
 * A tool named the way every command file that calls one names it: *"Call the
 * `create_item` tool on the `mycontext` MCP server"*.
 *
 * The captured word is checked against the LIVE registry before it is believed,
 * so this cannot invent a tool out of a backticked noun: `/mycontext:link`
 * resolves to `link_items` because `link_items` is a tool, and a file that
 * happened to write "the `widget` tool" resolves to nothing at all.
 */
const TOOL_MENTION = /`([a-z_]+)`\s+tool/g;

/** `add-known-issue` and `add known_issue` are one path in two spellings. */
function pathWords(segments: readonly string[]): string {
  return segments.flatMap((seg) => seg.split(/[-_]/)).filter(Boolean).join(' ');
}

/**
 * **What one slash command runs, and which of those it is NAMED for.**
 *
 * Owner, 2026-09-06, asked to be explicit: *"i ment all the slash commands not
 * only the six."* So this answers for all 91 rather than for the six that had
 * nothing else to show — the six were never the special case, they were only
 * the ones where the link was the last thing left to give.
 *
 * ── THE RULE, BECAUSE THE FIRST INVOCATION IS NOT THE ANSWER ──────────────
 *
 * MEASURED over the 91 committed files before the rule was chosen, because the
 * distribution had to drive it rather than the other way round: **40 name
 * exactly one subject** and no rule is needed for them at all; 51 name several;
 * the most any one names is five (`/inbox-promote`, `/lesson-stage`). Taking
 * the first would be wrong twice over on the smallest sample there is —
 * `/discard` runs `review list` first and is about `review discard`, and
 * `/unlink` runs `show` first and is about `edit`.
 *
 * So NOTHING IS DISCARDED: every subject a file invokes is named, in the order
 * the file invokes it, each one a link. That is the whole answer for the 40,
 * and for the other 51 it is the honest answer rather than a confident wrong
 * one — two links beat one guess.
 *
 * On top of that, and only on top of it, the shortcut's own NAME may PROMOTE
 * one of them, because the name is the one thing about a shortcut that was
 * chosen to say what it does. Read as a command path — `-` and `_` are both
 * segment separators, so `session-carry` IS `session carry` and
 * `add-known-issue` IS `add known_issue` — it is tried three ways, in order:
 *
 *   1. the whole path      `session-carry` → `session carry`; `audit` → `audit`
 *   2. the FIRST segment   `add-rule` → `add`; `procedure` → `procedure list`
 *   3. the LAST segment    `discard` → `review discard`
 *
 * Where none of the three matches, nothing is promoted and the list stands in
 * file order. That is `/unlink` — `show`, then `edit` — and nobody has to
 * pretend to know which of the two a reader wanted.
 *
 * ── AND WHAT DERIVING IT FROM THE FILE CORRECTED ─────────────────────────
 *
 * `/link` does NOT run `mycontext link`. The command exists and shares the
 * name, and the file calls the `link_items` MCP tool instead — which a
 * name-matching cross-reference would have got exactly wrong and which reading
 * the invocation gets right. One case, and it is the whole argument.
 */
export function slashRuns(
  source: string, name: string, tools: readonly string[],
): RunTarget[] {
  const runs: RunTarget[] = [];
  const add = (target: RunTarget, invocation: string): void => {
    const found = runs.find((r) => r.kind === target.kind && r.id === target.id);
    if (found === undefined) runs.push({ ...target, paths: [invocation] });
    else if (!found.paths.includes(invocation)) found.paths.push(invocation);
  };

  const known = commandNames();
  for (const match of source.matchAll(CLI_INVOCATION)) {
    // Everything up to the first token that is a flag, a placeholder, a quoted
    // value or `$ARGUMENTS` — the command PATH, and nothing a caller supplies.
    const words: string[] = [];
    for (const word of (match[1] ?? '').trim().split(/\s+/)) {
      if (word === '' || /^[-<"'$]/.test(word)) break;
      words.push(word);
    }
    const verb = words[0];
    if (verb === undefined || !known.includes(verb)) continue;
    const sub = Object.hasOwn(SUBCOMMAND_FLAGS, verb)
      && words[1] !== undefined && Object.hasOwn(SUBCOMMAND_FLAGS[verb], words[1])
      ? words[1]
      : undefined;
    add(
      { kind: 'command', id: verb, label: `mycontext ${verb}`, paths: [], named: false },
      sub === undefined ? verb : `${verb} ${sub}`,
    );
  }

  for (const match of source.matchAll(TOOL_MENTION)) {
    const tool = match[1] ?? '';
    if (!tools.includes(tool)) continue;
    add({ kind: 'tool', id: tool, label: tool, paths: [], named: false }, tool);
  }

  const whole = pathWords([name]);
  const head = pathWords([name.split('-')[0] ?? '']);
  const tests: ((invocation: string) => boolean)[] = [
    (p) => pathWords(p.split(' ')) === whole,
    (p) => pathWords([p.split(' ')[0] ?? '']) === head,
    (p) => pathWords([p.split(' ').at(-1) ?? '']) === whole,
  ];
  for (const test of tests) {
    const hit = runs.find((run) => run.paths.some(test));
    if (hit === undefined) continue;
    hit.named = true;
    // The designated invocation leads its own row too: `/discard` should read
    // `review discard` first and `review list` after it.
    hit.paths.sort((a, b) => Number(test(b)) - Number(test(a)));
    runs.splice(runs.indexOf(hit), 1);
    runs.unshift(hit);
    break;
  }
  return runs;
}

/** The command file behind one shortcut, or '' when it cannot be read. */
function slashSource(name: string): string {
  try {
    return readFileSync(path.join(COMMANDS_DIR, `${name}.md`), 'utf8').replaceAll('\r\n', '\n');
  } catch {
    return '';
  }
}

/* ── WHAT A CAPTURE SHORTCUT IS FOR ───────────────────────────────────────── */

/** The category a shortcut's name carries, described in its own words. */
export interface CategoryView {
  category: string;
  /** `src/core/categories.ts`, resolved against THIS project's config. */
  description: string;
  /** One real generated title of that kind — `add-*` only. */
  example?: string;
}

/**
 * **`plan:library seq:3`: a capture command told you its shape and never what
 * belonged in it.**
 *
 * MEASURED across all 91 hints: 30 are CIRCULAR — the 29 `add-<category>` files
 * plus `add` itself — every one generated from one template, `[the <category>
 * in one sentence]`, which states the SHAPE and names the category back at the
 * reader. 32 are flag lists mirroring the CLI and need nothing. 10 are
 * hand-written and good, and they are the proof that the template is the
 * problem rather than the format.
 *
 * The missing sentence already exists and is already generated. Every category
 * carries its own description in the resolved config — *"constraint:
 * Non-negotiable limit: budget, stack, regulation, SLA"* — which is the exact
 * thing a reader of `/mycontext:add-constraint` is short of, and it is resolved
 * from THIS project's config, so a category a pack enabled or this repo defined
 * is described here too. The worked value is generated as well: `exampleItemTitle`
 * is what `mycontext examples <category> --short` prints.
 *
 * **Nothing here is typed.** 29 hand-written example sentences are the drift
 * this project measures in days. The second half of that item — improving the
 * GENERATED hint template in `src/plugin/commands.ts` — writes a new sentence
 * into 29 committed files and is product copy, so it is not this module's to
 * make and is not made.
 */
function categoryView(name: string, ws: Workspace): CategoryView | null {
  const prefix = name.startsWith('add-') ? 'add-' : name.startsWith('list-') ? 'list-' : null;
  if (prefix === null) return null;
  // `add-known-issue` names `known_issue`: the file name is the category with
  // its underscores spelled as hyphens, which is `isPerCategory`'s own split.
  const wanted = name.slice(prefix.length).replaceAll('-', '_');
  if (!Object.hasOwn(ws.config.categories, wanted)) return null;
  const category = ws.config.categories[wanted];
  const view: CategoryView = { category: category.name, description: category.description };
  if (prefix === 'add-') {
    try {
      view.example = exampleItemTitle(category.name, ws.config);
    } catch { /* a category with no specimen shows the description alone. */ }
  }
  return view;
}

/* ── ONE WORKED LINE, COMPOSED FROM WHAT THE COMMAND DECLARES ─────────────── */

/** One composed command line, and everything that had to be decided to draw it. */
export interface WorkedLine {
  /** The line as it would be typed. */
  command: string;
  /** The same line as argv — what the checker was actually handed. */
  argv: string[];
  /** Positional slots whose value is a fact about the reader's own project. */
  asks: string[];
  /**
   * Whether the Composer's catalogue declares this command's positionals at
   * all. `false` means the line below is FLAGS ONLY and may be short of the
   * operand the command actually takes — a different sentence from "this
   * command takes no operand", and the two must not read alike.
   */
  catalogued: boolean;
  /**
   * Flags left off, each with the reason — never silently
   * (`INV-nothing-is-dropped-silently`). Three reasons, and all three are read
   * off a record rather than judged here:
   *
   *   `group`       another member of a declared exclusivity group is on the
   *                 line; `with` names THAT FLAG rather than the group, because
   *                 a group's internal name (`detail`, `body-source`) is an
   *                 identifier and `--full` is the answer to "why not this one".
   *   `combination` the Composer's catalogue declares this flag as one that
   *                 cannot stand beside something already on the line, or that
   *                 stands only beside something absent; `with` names it.
   *   `arity`       the flag takes operands no record declares a value for —
   *                 `--unlink <relation> <target>`, and only that one.
   *   `refused`     the declaration names this flag as refused beside
   *                 something the line already carries; `with` names it.
   */
  omitted: {
    flag: string; reason: 'group' | 'combination' | 'arity' | 'refused'; with?: string;
  }[];
  /** `POST /api/command/check`'s own verdict on this exact argv. */
  ok: boolean;
  error?: string;
}

/**
 * A value as it would be typed: quoted only where it has to be, so a reader can
 * copy the line and so `mycontext show <id>` does not acquire quotes it never
 * needed.
 */
function shellWord(word: string): string {
  return /^[A-Za-z0-9_@%+=:,./<>-]+$/.test(word) ? word : `"${word.replaceAll('"', '\\"')}"`;
}

/** One positional slot, as the Composer's own catalogue declares it. */
interface Slot { name: string; source?: string; options?: string[] }

/**
 * The positional slots of one command, from the catalogue the Composer already
 * builds argv out of.
 *
 * **Positionals are not flags, and that is the half a flags-only example
 * omits**: `mycontext show <id>` takes no flag at all, so a line made only of
 * switches would leave out the only thing that command takes. `FlagSpec` cannot
 * answer this and neither can `positionals()`, which is a PARSER and declares
 * nothing about what a command's positionals ARE. `PALETTE` can, because the
 * Composer screen could not compose a line without it — and it covers 26 of the
 * 44. A command with no catalogue entry gets a flags-only line, and the card
 * says so rather than letting the absence read as "takes nothing".
 */
function positionalSlots(command: string): Slot[] | null {
  const entry = catalogueEntries().find((def) => def.name === command);
  if (entry === undefined) return null;
  return (entry.args ?? []).map((arg) => {
    const slot: Slot = { name: arg.name };
    const source = (arg as { source?: unknown }).source;
    if (typeof source === 'string') slot.source = source;
    if (Array.isArray(arg.options)) slot.options = arg.options.map(String);
    return slot;
  });
}

/**
 * What the Composer's catalogue says about how a command's fields stand to each
 * other, keyed the way the composer needs to ask it.
 *
 * `notWith` here is INVERTED from the catalogue's own spelling: the catalogue
 * writes `notWith: 'all'` on the `id` POSITIONAL, meaning "required unless
 * --all is set", and what a composer needs to know is that `--all` may not be
 * spent because `id` already is. Positionals are composed first and are the
 * only thing the command genuinely cannot do without, so the flag yields to the
 * operand rather than the other way round.
 */
function fieldCombinations(command: string): {
  notWith: Map<string, string>; onlyWith: Map<string, string>;
} {
  const notWith = new Map<string, string>();
  const onlyWith = new Map<string, string>();
  const entry = catalogueEntries().find((def) => def.name === command);
  if (entry === undefined) return { notWith, onlyWith };
  for (const field of [...(entry.args ?? []), ...(entry.flags ?? []), ...(entry.flagsNotOffered ?? [])]) {
    const not = (field as { notWith?: unknown }).notWith;
    if (typeof not === 'string') notWith.set(not, field.name);
    const only = (field as { onlyWith?: unknown }).onlyWith;
    if (typeof only === 'string') onlyWith.set(field.name, only);
  }
  return { notWith, onlyWith };
}

/**
 * **One worked line for one command, and the three things that make it harder
 * than a join** (`plan:library seq:4`).
 *
 * Owner request 2026-09-06, below the syntax: *"a comprehensive example that
 * will use most if not all the parameters and will show actual values, so a
 * date would show how a date looks, because otherwise the user does not know
 * the correct format."* Half of that already shipped — 53 of the 148
 * declarations carry a format AND an example, ZERO bare declarations consume a
 * value, so every value-taking flag already declares one legal value and the
 * table already draws it. What was missing is the whole LINE: `audit` explains
 * eleven parameters and served no example of them used together.
 *
 *   1. **"ALL THE PARAMETERS" IS NOT SATISFIABLE**, and a generator that tries
 *      draws a line the CLI refuses. The item's ruling was to declare the
 *      exclusivity or to state the picking rule, and NOT to infer it by finding
 *      the words "mutually exclusive" in a note — which is a guess wearing
 *      data's clothes. **Both halves were taken, in that order.** `group` is
 *      now a field on `FlagDeclaration`, set only where `command-flags.ts`
 *      already stated the fact in its own words (the four `DETAIL` levels,
 *      `add --body|--file`, `ui --nonce|--port|--idle-ms`, `config`'s four act
 *      flags). Where a group is declared this spends the FIRST member the
 *      command's own `allowed` order offers and names the rest as omitted with
 *      the group that took the slot. Where none is declared it spends every
 *      flag — and that is a STATED RULE, not a claim that the rest combine: a
 *      command that splits its forms in its body (`carry --show|--clear`) says
 *      so nowhere this module can read, and declaring the group here would be
 *      this file asserting a refusal it has never seen.
 *   2. **POSITIONALS ARE NOT FLAGS** — `positionalSlots` above.
 *   3. **THE LINE MUST BE VALID**, and validity is checkable rather than
 *      assertable: `checkCommand` is `POST /api/command/check`'s own function,
 *      the one that walks argv with the CLI's `unknownFlag`. A line it refuses
 *      is NOT DRAWN — the refusal is carried in its place, so a composer that
 *      ever begins producing invalid lines announces it on the screen instead
 *      of teaching one. What that verdict does not cover — arity, whether a
 *      value is legal for the flag that took it, exclusion past what is
 *      declared — is the endpoint's own `unchecked` list, and is exactly why
 *      (1) is declared data rather than left for the checker to catch.
 *
 * WHETHER IT IS ALSO RUN is a separate question and a later one. The README
 * blocks ARE run, against a committed fixture, by `scripts/gen-doc-examples.ts`
 * — which is why they are trustworthy and why they are drawn beside this rather
 * than replaced by it. Doing the same for every command means executing writes,
 * and that needs a scratch-corpus ruling nobody has asked for.
 */
function workedLine(
  ws: Workspace, command: string, spec: FlagSpec, declared: FlagDeclarations,
): WorkedLine {
  const argv = ['mycontext', ...command.split(' ')];
  const asks: string[] = [];
  const omitted: WorkedLine['omitted'] = [];
  const slots = positionalSlots(command);
  const combinations = fieldCombinations(command);

  for (const slot of slots ?? []) {
    if (slot.options !== undefined && slot.options.length > 0) {
      argv.push(slot.options[0]);
      continue;
    }
    if (slot.source === 'categories') {
      const first = Object.values(ws.config.categories)
        .filter((c) => c.enabled).map((c) => c.name).sort((a, b) => a.localeCompare(b))[0];
      if (first !== undefined) { argv.push(first); continue; }
    }
    if (slot.source === 'topics') {
      const first = MCP_HELP_TOPICS[0];
      if (first !== undefined) { argv.push(first); continue; }
    }
    // **The one free-text slot with a real value already generated.**
    // `mycontext add` takes `<category> <title>`, and a title of an item of
    // that category is what `mycontext examples <category> --short` prints —
    // the same sentence `plan:library seq:3` puts beside
    // `/mycontext:add-<category>`. So the line reads `add adr "Server-side
    // rendering for the marketing pages"` rather than `add adr <title>`, which
    // is the difference between showing a value and naming a slot. Keyed on the
    // category ALREADY on this line rather than on the command name, so it can
    // never produce a title of one kind beside a category of another.
    if (slot.name === 'title') {
      const category = argv.at(-1);
      if (category !== undefined && Object.hasOwn(ws.config.categories, category)) {
        try {
          argv.push(exampleItemTitle(category, ws.config));
          continue;
        } catch { /* fall through to the placeholder below */ }
      }
    }
    // An id, a draft, a finding: a real one is a fact about the reader's own
    // corpus and would be a different line in every project. The slot is drawn
    // as itself and NAMED — `clih.ask`'s existing bargain for a per-workspace
    // vocabulary, applied to the positional half.
    argv.push(`<${slot.name}>`);
    asks.push(slot.name);
  }

  /** How many operands the line carries — fixed before any flag is spent. */
  const operands = argv.length - 1 - command.split(' ').length;

  /** group → the flag that took its slot, which is what a reader is owed. */
  const spent = new Map<string, string>();
  for (const flag of spec.allowed) {
    const decl = declared[flag];
    if (decl === undefined) continue;
    // **`--unlink <relation> <target>`, and only it.** `edit-flags.ts` exports
    // `UNLINK_ARITY` and says why in as many words: the flag takes TWO operands
    // and is absent from `values` so that `unknownFlag` cannot swallow one
    // token of a pair, so "a control built from that alone would compose
    // `--unlink` with nothing after it". That is precisely what a composer
    // reading `{ allowed, values }` does, and it is what this drew before the
    // declaration was read. Nothing declares a legal relation or target, so the
    // flag is left off and SAID rather than drawn wrong.
    if (flag === 'unlink' && UNLINK_ARITY === 2) {
      omitted.push({ flag, reason: 'arity' });
      continue;
    }
    // The Composer's own catalogue, which is the only record that states how a
    // field stands to the OTHER fields of its command: `--all` on `ack`
    // replaces the id positional (`notWith`), and `--code`/`--count` mean
    // nothing without it (`onlyWith`). Both are enforced by `commandFor` when
    // the Composer builds a line, so honouring them here is reading the rule
    // the product already keeps rather than inventing a second one.
    // `--yes` on `carry` and on `focus`, `--all` on `review promote`: the
    // declaration names what it is refused beside, and `'<operand>'` is how it
    // names the positional rather than a flag.
    const refused = decl.refusedWith?.find(
      (other) => (other === '<operand>' ? operands > 0 : argv.includes(`--${other}`)),
    );
    if (refused !== undefined) {
      omitted.push({ flag, reason: 'refused', with: refused === '<operand>' ? refused : `--${refused}` });
      continue;
    }
    const blocked = combinations.notWith.get(flag);
    if (blocked !== undefined) {
      omitted.push({ flag, reason: 'combination', with: `<${blocked}>` });
      continue;
    }
    const needs = combinations.onlyWith.get(flag);
    if (needs !== undefined && !argv.includes(`--${needs}`)) {
      omitted.push({ flag, reason: 'combination', with: `--${needs}` });
      continue;
    }
    if (decl.group !== undefined) {
      const took = spent.get(decl.group);
      if (took !== undefined) { omitted.push({ flag, reason: 'group', with: `--${took}` }); continue; }
      spent.set(decl.group, flag);
    }
    if (!spec.values.includes(flag)) { argv.push(`--${flag}`); continue; }
    // A value-taking flag with neither a vocabulary nor an example is
    // undrawable, and `test/cli/command-flags.test.ts` forbids one in both key
    // spaces. Skipping the flag ENTIRELY rather than emitting a bare `--flag`
    // is what keeps a hypothetical one from composing `--flag --nextflag`,
    // where the parser would swallow the next switch as this one's value.
    const value = decl.values?.[0] ?? decl.example;
    if (value === undefined) continue;
    argv.push(`--${flag}`, value);
  }

  const verdict = checkCommand(ws, argv);
  const line: WorkedLine = {
    command: argv.map(shellWord).join(' '),
    argv,
    asks,
    omitted,
    catalogued: slots !== null,
    ok: verdict.ok,
  };
  if (!verdict.ok && verdict.error !== undefined) line.error = verdict.error;
  return line;
}

/** Every worked line for one command: one per subcommand where it has them. */
function workedLines(ws: Workspace, name: string, surface: FlagSurface): WorkedLine[] {
  if (surface === 'flat') {
    return [workedLine(ws, name, COMMAND_FLAGS[name], FLAG_DECLARATIONS[name])];
  }
  if (surface === 'subcommand') {
    const declared = SUBCOMMAND_FLAG_DECLARATIONS[name];
    return Object.entries(SUBCOMMAND_FLAGS[name])
      .map(([sub, spec]) => workedLine(ws, `${name} ${sub}`, spec, declared));
  }
  if (surface === 'dynamic') {
    const edit = editFlagSurface(ws.config);
    return [workedLine(ws, name, { allowed: [...edit.allowed], values: [...edit.values] }, edit.flags)];
  }
  // `show`, `rebuild`, `help`: no flag at all, and a positional that IS the
  // whole surface. A flagless command is precisely the one this half exists
  // for, so it composes a line rather than being skipped.
  return [workedLine(ws, name, { allowed: [], values: [] }, {})];
}

/**
 * The picker's whole roster, and the counts a reader is entitled to see.
 *
 * `flagRows` is the figure the requirement is really about — how many switches
 * this page explains — and it is summed on the request rather than stated, so
 * the day a flag is added the number on the screen moves with it.
 */
export function apiCliHelp(ws: Workspace): JsonResult {
  const subjects: SubjectRow[] = [];

  for (const name of commandNames()) {
    subjects.push({
      kind: 'command', id: name, label: `mycontext ${name}`, note: surfaceOf(name),
    });
  }
  for (const topic of MCP_HELP_TOPICS) {
    subjects.push({
      kind: 'topic', id: topic, label: `mycontext help ${topic}`, note: 'topic',
    });
  }
  for (const tool of toolDefinitions()) {
    subjects.push({ kind: 'tool', id: tool.name, label: tool.name, note: tool.description });
  }
  for (const slash of slashCommands()) {
    subjects.push({
      kind: 'slash', id: slash.name, label: `/mycontext:${slash.name}`, note: slash.description,
    });
  }

  const edit = editFlagSurface(ws.config);
  /**
   * How many switch ROWS this page can draw, which is deliberately not the
   * number of distinct flag NAMES.
   *
   * `review list --json` and `review revisions --json` are two rows, because a
   * subcommand is a different command line and a reader looking up one of them
   * is not helped by being told the other exists. So each subcommand's
   * `allowed` is counted in full rather than unioned, and the figure the
   * screen prints is the number of explanations a reader can actually reach.
   * `test/ui/cli-help.test.ts` derives the same number by walking every
   * subject the route serves and counting what comes back.
   */
  const flagRows =
    Object.values(COMMAND_FLAGS).reduce((n, spec) => n + spec.allowed.length, 0)
    + Object.values(SUBCOMMAND_FLAGS)
      .reduce((n, subs) => n + Object.values(subs)
        .reduce((m, spec) => m + spec.allowed.length, 0), 0)
    + edit.allowed.length;

  return {
    status: 200,
    body: {
      subjects,
      counts: {
        command: commandNames().length,
        topic: MCP_HELP_TOPICS.length,
        tool: toolDefinitions().length,
        slash: slashCommands().length,
      },
      flagRows,
      /**
       * Named, not dropped. `cli` is the one topic neither this server nor an
       * MCP server can render, and a reader who cannot find it here would
       * otherwise conclude it does not exist.
       */
      withheld: {
        topics: ['cli'],
        why: 'The "cli" topic prints the command registry, which only `src/cli/index.ts` fills '
          + 'by side effect — and loading that module would put the whole write surface into '
          + 'this read-only server. `mycontext_help` withholds it for the same reason. Read it '
          + 'in a terminal with `mycontext help cli`.',
      },
    },
  };
}

/** `GET /api/cli-help/:kind/:id`'s body, per kind — documented on the handler. */
export interface CliHelpDetail {
  kind: SubjectKind;
  id: string;
  label: string;
  [key: string]: unknown;
}

function commandDetail(ws: Workspace, name: string): JsonResult {
  const surface = surfaceOf(name);
  const examples = readExamples().get(name) ?? [];
  const base = {
    kind: 'command' as const,
    id: name,
    label: `mycontext ${name}`,
    surface,
    examples,
    // The skeleton's first section. `null` where the generated coverage
    // document could not be read at all, which the screen says rather than
    // drawing a blank where a sentence belongs.
    what: readCommandSummaries().get(name) ?? null,
    // The skeleton's fourth. `plan:library seq:4`: every parameter was
    // explained and none of them was ever shown used.
    worked: workedLines(ws, name, surface),
  };

  if (surface === 'flat') {
    return {
      status: 200,
      body: { ...base, flags: flagViews(name, COMMAND_FLAGS[name], FLAG_DECLARATIONS[name]) },
    };
  }
  if (surface === 'subcommand') {
    const declared = SUBCOMMAND_FLAG_DECLARATIONS[name];
    const subcommands: SubcommandView[] = Object.entries(SUBCOMMAND_FLAGS[name])
      .map(([subcommand, spec]) => ({
        subcommand, flags: flagViews(`${name} ${subcommand}`, spec, declared),
      }));
    return { status: 200, body: { ...base, subcommands } };
  }
  if (surface === 'dynamic') {
    // `edit` and only `edit`. `declared` is what THIS project's categories add
    // to the shipped set, and it travels separately so a screen can say why a
    // flag a reader read about elsewhere is not on their page.
    const edit = editFlagSurface(ws.config);
    return {
      status: 200,
      body: {
        ...base,
        flags: flagViews(name, { allowed: edit.allowed, values: edit.values }, edit.flags),
        declared: edit.declared,
      },
    };
  }
  return { status: 200, body: { ...base, flags: [] } };
}

/**
 * `GET /api/cli-help/:kind/:id` — one subject, in the shape its kind has.
 *
 *  - `command` — `flags` (flat and dynamic), or `subcommands` each with their
 *    own `flags`; `surface` says which, and says `none` for the three that
 *    take no flag at all. `examples` is whatever the README's generated blocks
 *    demonstrate, and is often empty.
 *  - `topic` — the rendered Markdown, exactly what `mycontext help <topic>`
 *    prints, generated sections and all.
 *  - `tool` — the MCP tool's description and its schema's own properties,
 *    required set and enums.
 *  - `slash` — the command file's `description` frontmatter and whether the
 *    model may invoke it.
 *
 * An unknown kind is a 400 and an unknown id a 404, and the two are told apart
 * on purpose: a client that could not distinguish them would either give up on
 * a subject that exists or keep retrying one that never did.
 */
export function apiCliHelpSubject(
  ws: Workspace, url: URL, params: { kind: string; id: string },
): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);

  if (!(SUBJECT_KINDS as readonly string[]).includes(params.kind)) {
    return badRequest(
      `unknown subject kind "${params.kind}" — this endpoint answers about: ` +
      `${SUBJECT_KINDS.join(', ')}.`,
    );
  }
  const kind = params.kind as SubjectKind;
  const missing = (what: string, known: string[]): JsonResult => ({
    status: 404,
    body: {
      error: `no ${what} "${params.id}". This endpoint answers about ${known.length} of them; ` +
        'GET /api/cli-help lists every subject it serves.',
    },
  });

  if (kind === 'command') {
    const names = commandNames();
    if (!names.includes(params.id)) return missing('command', names);
    return commandDetail(ws, params.id);
  }
  if (kind === 'topic') {
    if (!(MCP_HELP_TOPICS as string[]).includes(params.id)) {
      // `cli` is a real topic that this server cannot render, and saying "no
      // such topic" about it would be false. The refusal names the reason and
      // the surface that CAN print it.
      if (params.id === 'cli') {
        return {
          status: 404,
          body: {
            error: 'The "cli" topic prints the command registry, which only `src/cli/index.ts` '
              + 'fills by side effect — loading it here would put the whole write surface into '
              + 'this read-only server. Every flag it lists is on this page already, per '
              + 'command. Read the topic itself with `mycontext help cli`.',
          },
        };
      }
      return missing('help topic', MCP_HELP_TOPICS as string[]);
    }
    return {
      status: 200,
      body: {
        kind, id: params.id, label: `mycontext help ${params.id}`,
        markdown: helpTopic(params.id as HelpTopic, ws.config),
      },
    };
  }
  if (kind === 'tool') {
    const tools = toolDefinitions();
    const tool = tools.find((t) => t.name === params.id);
    if (tool === undefined) return missing('MCP tool', tools.map((t) => t.name));
    const schema = tool.inputSchema;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    return {
      status: 200,
      body: {
        kind, id: tool.name, label: tool.name, description: tool.description,
        args: Object.entries(properties).map(([argument, detail]) => ({
          argument,
          required: required.includes(argument),
          type: typeof detail.type === 'string' ? detail.type : null,
          values: Array.isArray(detail.enum) ? detail.enum.map(String) : undefined,
          note: typeof detail.description === 'string' ? detail.description : '',
        })),
      },
    };
  }
  const commands = slashCommands();
  const tools = toolDefinitions().map((t) => t.name);
  const slash = commands.find((c) => c.name === params.id);
  if (slash === undefined) return missing('slash command', commands.map((c) => c.name));
  const category = categoryView(slash.name, ws);
  return {
    status: 200,
    body: {
      kind, id: slash.name, label: `/mycontext:${slash.name}`,
      description: slash.description,
      modelInvocable: slash.modelInvocable,
      /**
       * What this shortcut RUNS, derived from the file itself — see
       * `slashRuns`. Every one of the 91 carries at least one, so a reader of
       * any shortcut is handed the subject that documents what it does rather
       * than three sentences and no way onward.
       */
      runs: slashRuns(slashSource(slash.name), slash.name, tools),
      /**
       * The category this shortcut's NAME carries, described in its own words
       * and shown with one real generated title of that kind — `plan:library
       * seq:3`. `null` for the 33 shortcuts whose name carries no category.
       */
      category,
      // Owner review 2026-09-06: a slash command showed no parameters while a
      // CLI command showed every flag. The hint was declared in 90 of the 91
      // committed files all along and simply never read. `null` is carried
      // through rather than flattened to '' so the screen can say "takes no
      // argument" where that is the measured truth.
      argumentHint: slash.argumentHint,
    },
  };
}

/** Registered from `registerReadRoutes`, beside the other read models. */
export function registerCliHelpRoutes(): void {
  registerRoute('GET', '/api/cli-help', {
    kind: 'json', handle: (ctx: ApiContext) => apiCliHelp(ctx.ws),
  });
  registerRoute('GET', '/api/cli-help/:kind/:id', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiCliHelpSubject(ctx.ws, ctx.url, {
      kind: ctx.params['kind'] ?? '', id: ctx.params['id'] ?? '',
    }),
  });
}
