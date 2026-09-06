/**
 * **The Library's command-line card, and the claim it makes.**
 *
 * `TASK-the-library-explains-the-command-line-every-switch-parameter`, owner
 * requirement 2026-09-06: every switch, parameter and option, explained, with
 * examples, behind a selection box. The card asserts a completeness — "every
 * switch" — and a completeness claim is only worth what checks it, so that is
 * what this file is about. Four properties, and each one is a different way
 * for the card to be a lie:
 *
 *   1. **It offers every command.** The picker's command group is the CLI's
 *      registry, exactly, in both directions. This is the gate the task set:
 *      34 of 43 commands had a flat flag spec and nine did not, and until the
 *      nine were accounted for "every switch" was unreachable. It is derived
 *      here from `COMMANDS` — the registry itself, after `src/cli/index.ts`
 *      has filled it — against a route that must never load that module.
 *   2. **Every switch it draws is explained.** No row has an empty note, and
 *      no value-taking flag is offered without saying what may go in it.
 *   3. **It agrees with the two surfaces that already answer these
 *      questions.** The topic set is `MCP_HELP_TOPICS` and not a copy, `cli`
 *      is withheld with the same reason, and the tools and slash commands are
 *      the same lists `mycontext help tools` and `help slash` render from.
 *   4. **Its examples are generated output, not prose.** Every example the
 *      route serves is a block `test/docs/examples.test.ts` re-runs, and its
 *      command line is one the CLI actually dispatches.
 *
 * **This file may import `src/cli/index.ts` and the route may not**, which is
 * the whole shape of the argument. A test is a process that loads whatever it
 * needs; the read server is the process `test/ui/no-writes.test.ts` bans the
 * write surface from. So the registry is the ORACLE here and never the source,
 * and that asymmetry is the reason property 1 is checkable at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import '../../src/cli/index.ts';
import {
  COMMAND_FLAGS, FLAGLESS_COMMANDS, SUBCOMMAND_FLAGS,
} from '../../src/core/command-flags.ts';
import { collectExamples, splitPipeline } from '../../src/core/doc-examples.ts';
import { HELP_TOPICS, MCP_HELP_TOPICS } from '../../src/core/teach.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { slashCommands, toolDefinitions } from '../../src/help/index.ts';
import {
  apiCliHelp, apiCliHelpSubject, commandNames, exampleIndex,
} from '../../src/ui/read-model-cli-help.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

/**
 * THIS repository is the workspace under test, which is the dogfooding bargain
 * every test in this directory makes. It matters for exactly one subject:
 * `edit`, whose accepted flags are computed from `config.json`'s declared
 * fields, so its answer is a fact about this project and not about the code.
 */
const ws = resolveWorkspace(REPO);
const NO_PARAMS = new URL('http://127.0.0.1/api/cli-help');

/* ══ 1. EVERY COMMAND, AND WHICH RECORD ANSWERS FOR IT ═════════════════════ */

test('the picker offers exactly the commands the CLI dispatches — the gate this task set', () => {
  const offered = (apiCliHelp(ws).body as { subjects: { kind: string; id: string }[] }).subjects
    .filter((s) => s.kind === 'command').map((s) => s.id).sort();
  assert.deepEqual(
    offered, [...COMMANDS.keys()].sort(),
    'the Library offers a different set of commands from the one the CLI dispatches. The card '
    + 'says "every switch", so a command it cannot name is a command a reader is told does not '
    + 'exist — and a command it names that the CLI does not have is syntax that comes back '
    + '"unknown command".',
  );
  assert.equal(offered.length, commandNames().length);
});

/**
 * The nine that have no entry in `COMMAND_FLAGS`, named rather than counted.
 *
 * The task's own measurement — "34 of the 43 commands declare flags in
 * COMMAND_FLAGS; nine do not" — was the gate, and the answer is that none of
 * the nine was an omission: five are keyed by subcommand, three take no flag,
 * and one is computed per workspace. This asserts the SPLIT, so the day one of
 * them moves between records the change is deliberate rather than noticed
 * later on a screen.
 */
test('the nine commands with no flat flag spec are exactly the ones the other records hold', () => {
  const withoutFlat = [...COMMANDS.keys()].filter((n) => !Object.hasOwn(COMMAND_FLAGS, n)).sort();
  assert.deepEqual(withoutFlat, [
    'edit', 'help', 'pack', 'procedure', 'rebuild', 'review', 'session', 'show', 'statusline',
  ], 'the nine are the measurement this task gated itself on; a different nine is a different task');

  const surfaces: Record<string, string> = {};
  for (const name of withoutFlat) {
    const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'command', id: name }).body as
      { surface: string };
    surfaces[name] = body.surface;
  }
  assert.deepEqual(surfaces, {
    edit: 'dynamic',
    help: 'none',
    pack: 'subcommand',
    procedure: 'subcommand',
    rebuild: 'none',
    review: 'subcommand',
    session: 'subcommand',
    show: 'none',
    statusline: 'subcommand',
  }, 'a command changed which record answers for its flags, and the screen states that per '
    + 'command — "takes no switch at all" over a command that has grown one is the failure this '
    + 'gate exists to make impossible');
});

/* ══ 2. EVERY SWITCH IT DRAWS IS EXPLAINED ═════════════════════════════════ */

interface FlagRow {
  flag: string; takesValue: boolean; note: string;
  values?: string[]; format?: string; example?: string;
}

/** Every flag row the card can draw, across all 43 commands. */
function everyRow(): { where: string; row: FlagRow }[] {
  const rows: { where: string; row: FlagRow }[] = [];
  for (const name of commandNames()) {
    const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'command', id: name }).body as
      { flags?: FlagRow[]; subcommands?: { subcommand: string; flags: FlagRow[] }[] };
    for (const row of body.flags ?? []) rows.push({ where: name, row });
    for (const sub of body.subcommands ?? []) {
      for (const row of sub.flags) rows.push({ where: `${name} ${sub.subcommand}`, row });
    }
  }
  return rows;
}

test('every switch the card draws carries a real explanation', () => {
  const rows = everyRow();
  assert.ok(rows.length > 100, `only ${rows.length} flag rows — this assertion is measuring nothing`);
  const blank = rows.filter(({ row }) => typeof row.note !== 'string' || row.note.trim() === '')
    .map(({ where, row }) => `${where} --${row.flag}`);
  assert.deepEqual(
    blank, [],
    'these switches would render as a row with an empty explanation column, which is the exact '
    + 'state the owner described on 2026-08-24 — a user who "does not know what is the correct '
    + 'format what is legal and what is not".',
  );
});

test('a switch that takes a value says what may go in it', () => {
  const bad = everyRow()
    .filter(({ row }) => row.takesValue)
    .filter(({ row }) => !(Array.isArray(row.values) && row.values.length > 0)
      && !(typeof row.format === 'string' && typeof row.example === 'string'))
    .map(({ where, row }) => `${where} --${row.flag}`);
  assert.deepEqual(
    bad, [],
    'these switches consume the next token and offer neither a legal set nor a format with an '
    + 'example, so the card would draw a value column a reader cannot act on.',
  );
});

/**
 * The count on the screen is the count on the page, and neither is written
 * down. `flagRows` is what the card prints as "N switches are explained here",
 * so it is re-derived here from the same three sources and compared — a
 * hand-kept figure in either place is the "38 commands" defect this task was
 * written against.
 */
test('the switch count the card prints is the number of rows it can draw', () => {
  const index = apiCliHelp(ws).body as { flagRows: number };
  assert.equal(
    index.flagRows, everyRow().length,
    'the headline figure and the rows disagree. The figure is what a reader believes without '
    + 'checking, which is why it is measured rather than stated.',
  );
});

/* ══ 3. IT AGREES WITH THE SURFACES THAT ALREADY ANSWER ════════════════════ */

test('the topics offered are MCP_HELP_TOPICS, and `cli` is withheld with its reason', () => {
  const body = apiCliHelp(ws).body as {
    subjects: { kind: string; id: string }[];
    withheld: { topics: string[]; why: string };
  };
  const offered = body.subjects.filter((s) => s.kind === 'topic').map((s) => s.id);
  assert.deepEqual(
    offered, [...MCP_HELP_TOPICS],
    'the Library and the MCP tool must offer the same topics. Both are read surfaces that '
    + 'cannot load the CLI, and two different answers to "which topics exist" is the drift one '
    + 'shared list exists to prevent.',
  );
  assert.deepEqual(
    [...HELP_TOPICS].filter((t) => !offered.includes(t)), body.withheld.topics,
    'a topic `mycontext help` serves and this page does not must be NAMED as withheld. A topic '
    + 'that is simply absent is a topic a reader concludes does not exist.',
  );
  assert.match(body.withheld.why, /mycontext help cli/,
    'the withholding names where the topic CAN be read; a refusal with no alternative is a '
    + 'dead end');

  // And asking for it directly refuses in the same terms rather than reporting
  // it as a topic that does not exist — the two are different facts.
  const refusal = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'topic', id: 'cli' });
  assert.equal(refusal.status, 404);
  assert.match((refusal.body as { error: string }).error, /command registry/);
});

test('every topic the card serves renders, and is what the terminal prints', () => {
  for (const topic of MCP_HELP_TOPICS) {
    const result = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'topic', id: topic });
    assert.equal(result.status, 200, `${topic} did not render`);
    const body = result.body as { markdown: string; label: string };
    assert.ok(body.markdown.length > 200, `${topic} rendered ${body.markdown.length} characters`);
    assert.equal(body.label, `mycontext help ${topic}`,
      'the label IS the command, because what the card shows is that command\'s own output');
  }
});

test('the tools and the slash commands are the registry\'s and the directory\'s own', () => {
  const subjects = (apiCliHelp(ws).body as { subjects: { kind: string; id: string }[] }).subjects;
  assert.deepEqual(
    subjects.filter((s) => s.kind === 'tool').map((s) => s.id),
    toolDefinitions().map((t) => t.name),
    'the tool list is the MCP registry\'s own list, in its own order',
  );
  assert.deepEqual(
    subjects.filter((s) => s.kind === 'slash').map((s) => s.id),
    slashCommands().map((c) => c.name),
    'the slash list is the committed `commands/*.md` — the directory Claude Code scans IS the '
    + 'surface, so what is on disk is what a user can type',
  );
  // Every tool answer carries its schema's own arguments, not a re-description.
  for (const tool of toolDefinitions()) {
    const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'tool', id: tool.name }).body as
      { args: { argument: string }[] };
    const properties = Object.keys((tool.inputSchema.properties ?? {}) as Record<string, unknown>);
    assert.deepEqual(body.args.map((a) => a.argument), properties, `${tool.name}'s arguments`);
  }
});

/* ══ 4. THE EXAMPLES ARE GENERATED OUTPUT ══════════════════════════════════ */

test('every worked example is a generated README block, and names a real command', () => {
  const readme = readFileSync(path.join(REPO, 'README.md'), 'utf8').replaceAll('\r\n', '\n');
  const blocks = collectExamples(readme);
  assert.ok(blocks.length > 10, `only ${blocks.length} example blocks — nothing to serve`);

  // Every stage of every marker names a command the CLI dispatches. A marker
  // that named something else would put a command line on the screen that
  // comes back "unknown command" — and would also mean the generator had been
  // running something this repository does not ship.
  const unknown = blocks
    .flatMap((b) => splitPipeline(b.command))
    .map((stage) => stage[0])
    .filter((verb) => verb !== undefined && !verb.startsWith('-') && !COMMANDS.has(verb));
  assert.deepEqual(unknown, [], 'an example marker names a command that is not registered');

  // And what the route serves for a command is drawn from those same blocks —
  // never authored, which is the property the whole design turns on.
  const index = exampleIndex(readme);
  const bodies = new Set(blocks.map((b) => b.body));
  for (const name of commandNames()) {
    const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'command', id: name }).body as
      { examples: { command: string; output: string }[] };
    for (const example of body.examples) {
      assert.ok(bodies.has(example.output),
        `${name}: an example output that is not a committed generated block`);
      assert.match(example.command, /^mycontext /,
        `${name}: an example command line that is not a mycontext invocation`);
    }
    assert.deepEqual(
      body.examples, index.get(name) ?? [],
      `${name}: the route's examples and the README's own index disagree`,
    );
  }
  // The index is not empty for the commands the README actually walks through,
  // or this whole mechanism would be reporting "no example" for everything and
  // passing.
  assert.ok((index.get('list') ?? []).length > 0, 'the README demonstrates `list` and the index missed it');
  assert.ok((index.get('review') ?? []).length > 0, 'the README demonstrates `review` and the index missed it');
});

/* ══ THE REFUSALS ══════════════════════════════════════════════════════════ */

test('an unknown kind is a 400 and an unknown id a 404 — two different facts', () => {
  const kind = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'nonsense', id: 'x' });
  assert.equal(kind.status, 400);
  assert.match((kind.body as { error: string }).error, /command, topic, tool, slash/);

  for (const [k, id] of [['command', 'nope'], ['tool', 'nope'], ['slash', 'nope']] as const) {
    const result = apiCliHelpSubject(ws, NO_PARAMS, { kind: k, id });
    assert.equal(result.status, 404, `${k}/${id}`);
    assert.match((result.body as { error: string }).error, /GET \/api\/cli-help lists/);
  }
});

test('an unknown query parameter is refused rather than answered around', () => {
  const url = new URL('http://127.0.0.1/api/cli-help/command/add?detail=full');
  const result = apiCliHelpSubject(ws, url, { kind: 'command', id: 'add' });
  assert.equal(result.status, 400);
  assert.match((result.body as { error: string }).error, /unknown parameter "detail"/);
});

/* ══ THE SCREEN ════════════════════════════════════════════════════════════ */

interface CliHelpModule { subjectHref: (kind: string, id: string) => string }
const screen = (): Promise<CliHelpModule> => browserModule<CliHelpModule>('screens', 'cli-help.js');
const strings = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

test('a subject address encodes both halves, so a name cannot escape its own path', async () => {
  const { subjectHref } = await screen();
  assert.equal(subjectHref('command', 'add'), '/api/cli-help/command/add');
  assert.equal(subjectHref('slash', 'add-known-issue'), '/api/cli-help/slash/add-known-issue');
  assert.equal(subjectHref('command', 'a/b?c'), '/api/cli-help/command/a%2Fb%3Fc');
});

test('every string key the card names is declared in both tables, with matching slots', async () => {
  const en = await strings('en');
  const he = await strings('he');
  const { slots } = await browserModule<{ slots: (t: string) => string[] }>('lib', 'i18n.js');

  const source = readFileSync(path.join(PUBLIC, 'screens', 'cli-help.js'), 'utf8');
  const named = new Set<string>();
  for (const m of source.matchAll(/\bt(?:Flat)?\(\s*'([a-zA-Z][\w.]*)'/g)) named.add(m[1]!);
  // The four group labels are named through the KINDS table rather than at a
  // call site, so they are collected from the same source by their own shape.
  for (const m of source.matchAll(/key:\s*'([a-zA-Z][\w.]*)'/g)) named.add(m[1]!);
  assert.ok(named.size >= 25, `expected the card to name many keys, found ${named.size}`);

  const missing: string[] = [];
  for (const key of [...named].sort()) {
    if (!(key in en.strings)) missing.push(`en:${key}`);
    if (!(key in he.strings)) missing.push(`he:${key}`);
  }
  assert.deepEqual(missing, [], 'a key with no Hebrew is permanently English on the Hebrew page');

  const mismatched: string[] = [];
  for (const key of Object.keys(en.strings).filter((k) => k.startsWith('clih.'))) {
    const a = [...slots(en.strings[key]!)].sort();
    const b = [...slots(he.strings[key]!)].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      mismatched.push(`${key}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    }
  }
  assert.deepEqual(mismatched, [], 'a substitution present in one language and absent in the '
    + 'other renders a sentence with a hole in it');
});

/**
 * The card names no command, no flag and no count, and that is the
 * requirement's own instruction rather than a style rule: *"if you find
 * yourself typing a command name into a template, stop."*
 *
 * Checked over the module's bytes, because that is where the defect would be.
 * The search is for a registered command name appearing as a QUOTED literal —
 * the shape a hardcoded roster takes — and it deliberately ignores prose in
 * comments, where `mycontext help cli` and `capture.js` are named on purpose.
 */
test('the card holds no command name, flag name or roster of its own', () => {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'cli-help.js'), 'utf8');
  // Comments out, so the argument a header makes is not mistaken for a list.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const literals = [...code.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]!);
  const roster = literals.filter((literal) => COMMANDS.has(literal));
  assert.deepEqual(
    roster, [],
    'a command name is written into the screen. Every name on this card arrives from '
    + '/api/cli-help, which reads the tables the CLI itself parses with — a name typed here is '
    + 'the drift this whole task exists to avoid.',
  );
  const flagNames = new Set(Object.values(COMMAND_FLAGS).flatMap((s) => s.allowed)
    .concat(Object.values(SUBCOMMAND_FLAGS).flatMap((subs) =>
      Object.values(subs).flatMap((s) => s.allowed))));
  // `none` is BOTH a flag (`mycontext session carry --none`) and the route's
  // own word for a command with no flag surface at all, and the card compares
  // against the second. Subtracted by name rather than by loosening the scan:
  // the whole value of this assertion is that it is crude, so an actual
  // hardcoded `--yes` or `--scope` cannot be argued past it.
  for (const word of ['none', 'flat', 'dynamic', 'subcommand']) flagNames.delete(word);
  assert.deepEqual(
    literals.filter((literal) => flagNames.has(literal)), [],
    'a flag name is written into the screen, for the same reason.',
  );
  // And no count: the three figures the card prints are the endpoint's.
  assert.deepEqual(
    [...code.matchAll(/\b(?:4[0-9]|9[0-9]|1[0-9][0-9])\b/g)].map((m) => m[0]),
    [],
    'a two- or three-digit literal in this file is almost certainly a count of commands, flags '
    + 'or slash commands — every one of those is measured on the request instead.',
  );
  assert.ok(FLAGLESS_COMMANDS.length > 0, 'the flagless record is what the `none` surface means');
});
