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
import { editFlagSurface } from '../core/edit-flags.ts';
import { MCP_HELP_TOPICS, type HelpTopic } from '../core/teach.ts';
import type { Workspace } from '../core/workspace.ts';
import { helpTopic, slashCommands, toolDefinitions } from '../help/index.ts';
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
  const base = { kind: 'command' as const, id: name, label: `mycontext ${name}`, surface, examples };

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
  const slash = commands.find((c) => c.name === params.id);
  if (slash === undefined) return missing('slash command', commands.map((c) => c.name));
  return {
    status: 200,
    body: {
      kind, id: slash.name, label: `/mycontext:${slash.name}`,
      description: slash.description,
      modelInvocable: slash.modelInvocable,
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
