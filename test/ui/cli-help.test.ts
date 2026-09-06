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
  COMMAND_FLAGS, FLAGLESS_COMMANDS, FLAG_DECLARATIONS, SUBCOMMAND_FLAGS,
  SUBCOMMAND_FLAG_DECLARATIONS,
} from '../../src/core/command-flags.ts';
import { collectExamples, splitPipeline } from '../../src/core/doc-examples.ts';
import { HELP_TOPICS, MCP_HELP_TOPICS } from '../../src/core/teach.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { exampleItemTitle, slashCommands, toolDefinitions } from '../../src/help/index.ts';
import { checkCommand } from '../../src/ui/read-model-command.ts';
import {
  apiCliHelp, apiCliHelpSubject, commandNames, commandSummaries, exampleIndex,
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

/** One subject's body, through the route, so nothing below reads past it. */
const subject = (kind: string, id: string): Record<string, unknown> => {
  const answer = apiCliHelpSubject(ws, NO_PARAMS, { kind, id });
  assert.equal(answer.status, 200, `${kind}/${id} did not answer 200`);
  return answer.body as Record<string, unknown>;
};

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

/* ══ 8. THE SKELETON, AND WHAT EACH KIND FILLS (plan:library seq:3, 4, 5) ═══ */

/**
 * `what it is` was the section a COMMAND did not have, while a tool and a
 * shortcut both did — the summary lives on the CLI's registry, which this
 * server may not load. It is read out of the generated coverage document
 * instead, and this is the test that the parse survives the document's own
 * escaping: `mycontext add`'s summary contains three `|` characters, escaped as
 * `\|`, and the first parse read the first of them as the end of the column.
 */
test('every command says what it is, and the one summary with pipes in it survives', () => {
  const summaries = commandSummaries(
    readFileSync(path.join(REPO, 'docs', 'cli-ui-coverage.md'), 'utf8').replaceAll('\r\n', '\n'),
  );
  const missing = commandNames().filter((name) => !summaries.has(name));
  assert.deepEqual(missing, [], 'the coverage table is generated from the registry itself');

  const add = summaries.get('add') ?? '';
  assert.match(add, /--body\|--file/, 'the escaped pipe is restored, not treated as a column end');
  assert.match(add, /--yes\)$/, 'and the cell is taken whole rather than truncated at it');

  for (const name of commandNames()) {
    const body = subject('command', name) as { what: string | null };
    assert.equal(body.what, summaries.get(name), `${name}'s sentence is the document's`);
  }
});

/**
 * **The `plan:library seq:4` gate, and the whole reason that item waited on
 * `builder/4`.** A generated example the product's own checker refuses is a
 * defect the moment it is drawn, so every line this card can serve is put
 * through `checkCommand` — the function `POST /api/command/check` answers with,
 * which walks argv using the CLI's own `unknownFlag`.
 *
 * It sweeps every command rather than a sample, because the composer is
 * data-driven: the line that breaks will be the one a declaration changed
 * under, and a sample is exactly what would miss it.
 */
test('every composed worked line is accepted by the CLI\'s own parser', () => {
  let lines = 0;
  for (const name of commandNames()) {
    const body = subject('command', name) as { worked: { command: string; argv: string[]; ok: boolean; error?: string }[] };
    assert.ok(body.worked.length > 0, `${name} composes no line at all`);
    for (const line of body.worked) {
      lines += 1;
      assert.equal(line.argv[0], 'mycontext', 'the checker is handed the whole line');
      const verdict = checkCommand(ws, line.argv);
      assert.equal(
        verdict.ok, true,
        `the card would draw a line the CLI refuses: ${line.command} — ${verdict.error ?? ''}`,
      );
      assert.equal(line.ok, true, 'and the endpoint reports the same verdict it took');
    }
  }
  // Not a constant: one line per flat command and one per subcommand, counted
  // by walking what the route served.
  assert.ok(lines >= commandNames().length, 'every command contributed at least one line');
});

/**
 * "All the parameters" is not satisfiable, and this is the half of that ruling
 * that became DATA. A composed line carrying two members of one declared group
 * is the invalid line the item predicted; the ones left off are named with the
 * flag that took the slot, because `INV-nothing-is-dropped-silently` applies to
 * a switch a reader can see in the table above and not on the line below it.
 */
test('no composed line spends two members of one declared exclusivity group', () => {
  const groupsOf = (declared: Record<string, { group?: string }>): Map<string, string> => {
    const out = new Map<string, string>();
    for (const [flag, decl] of Object.entries(declared)) {
      if (decl.group !== undefined) out.set(flag, decl.group);
    }
    return out;
  };
  const check = (line: { argv: string[]; omitted: { flag: string }[] }, declared: Record<string, { group?: string }>, where: string): void => {
    const groups = groupsOf(declared);
    const seen = new Map<string, string>();
    for (const word of line.argv) {
      if (!word.startsWith('--')) continue;
      const flag = word.slice(2);
      const group = groups.get(flag);
      if (group === undefined) continue;
      const already = seen.get(group);
      assert.equal(already, undefined, `${where}: --${flag} and --${already} are both "${group}"`);
      seen.set(group, flag);
    }
    // And the ones that lost the slot are on the record rather than vanished.
    for (const [flag, group] of groups) {
      if (line.argv.includes(`--${flag}`)) continue;
      if (!seen.has(group)) continue;
      assert.ok(
        line.omitted.some((off) => off.flag === flag),
        `${where}: --${flag} was dropped for its group and never named`,
      );
    }
  };

  for (const name of Object.keys(COMMAND_FLAGS)) {
    const body = subject('command', name) as { worked: { argv: string[]; omitted: { flag: string }[] }[] };
    for (const line of body.worked) check(line, FLAG_DECLARATIONS[name], `mycontext ${name}`);
  }
  for (const [name, subs] of Object.entries(SUBCOMMAND_FLAGS)) {
    const body = subject('command', name) as { worked: { argv: string[]; omitted: { flag: string }[] }[] };
    for (const [i, line] of body.worked.entries()) {
      check(line, SUBCOMMAND_FLAG_DECLARATIONS[name], `mycontext ${name} ${Object.keys(subs)[i]}`);
    }
  }
});

/**
 * Positionals are not flags, and a flags-only example omits the only thing
 * three commands take. This asserts the half that IS declared and the half that
 * is not, in the same test, because the two must not read alike on the screen.
 */
test('a command whose operands are declared spends them; one whose are not says so', () => {
  const show = subject('command', 'show') as { worked: { command: string; asks: string[]; catalogued: boolean }[] };
  assert.equal(show.worked[0]?.command, 'mycontext show <id>', 'show takes no flag and one operand');
  assert.deepEqual(show.worked[0]?.asks, ['id'], 'and the operand names the reader\'s own corpus');

  const add = subject('command', 'add') as { worked: { command: string; catalogued: boolean }[] };
  assert.match(
    add.worked[0]?.command ?? '', /^mycontext add \w+ "/,
    'add spends a real category and a generated title, not two angle-bracket slots',
  );

  const todo = subject('command', 'todo') as { worked: { catalogued: boolean }[] };
  assert.equal(todo.worked[0]?.catalogued, false, 'the catalogue declares no operand for todo');
});

/**
 * **Owner, asked to be explicit: "i ment all the slash commands not only the
 * six."** Every shortcut carries a link to the subject that documents what it
 * runs, and the target is a subject this endpoint actually serves — a link to
 * something the picker has no option for would be worse than none.
 */
test('all 91 slash commands name a subject they run, and every target is served', () => {
  const index = apiCliHelp(ws).body as { subjects: { kind: string; id: string }[] };
  const served = new Set(index.subjects.map((s) => `${s.kind}/${s.id}`));
  const slash = index.subjects.filter((s) => s.kind === 'slash');
  assert.equal(slash.length, slashCommands().length);

  let several = 0;
  for (const row of slash) {
    const body = subject('slash', row.id) as { runs: { kind: string; id: string; paths: string[] }[] };
    assert.ok(body.runs.length > 0, `/${row.id} names nothing it runs`);
    if (body.runs.length > 1) several += 1;
    for (const run of body.runs) {
      assert.ok(served.has(`${run.kind}/${run.id}`), `/${row.id} points at an unserved ${run.kind}/${run.id}`);
      assert.ok(run.paths.length > 0, `/${row.id}'s ${run.id} link names no invocation`);
    }
  }
  assert.ok(several > 0, 'the several-target case is real and is what the rule exists for');
});

/**
 * The rule itself, on the five files that decide it — and the first invocation
 * is not the answer in three of them.
 */
test('the shortcut\'s own name promotes one target, and where it names none, none is promoted', () => {
  const runs = (id: string): { id: string; kind: string; paths: string[]; named: boolean }[] =>
    (subject('slash', id) as { runs: { id: string; kind: string; paths: string[]; named: boolean }[] }).runs;

  // `/discard` runs `review list` FIRST and is about `review discard`.
  const discard = runs('discard');
  assert.deepEqual(discard.map((r) => r.id), ['review']);
  assert.equal(discard[0]?.named, true, 'the last segment of the path matched the name');
  assert.equal(discard[0]?.paths[0], 'review discard', 'and it leads its own row');
  assert.ok(discard[0]?.paths.includes('review list'), 'without the others being dropped');

  // `session-carry` is `session carry` with a hyphen for the space.
  assert.equal(runs('session-carry')[0]?.paths[0], 'session carry');

  // `add-known-issue` is `add known_issue`: the first segment carries it.
  const addKnown = runs('add-known-issue');
  assert.equal(addKnown[0]?.id, 'add');
  assert.equal(addKnown[0]?.named, true);

  // `/unlink` runs `show` and then `edit`, and its name matches neither. Two
  // honest links, and nothing promoted — the case the item explicitly allows.
  const unlink = runs('unlink');
  assert.deepEqual(unlink.map((r) => r.id), ['show', 'edit']);
  assert.deepEqual(unlink.map((r) => r.named), [false, false]);

  // **The correction that only reading the file could make.** `mycontext link`
  // exists and shares the name; the FILE calls the `link_items` MCP tool, and
  // a name-matching cross-reference would have sent a reader to the wrong one.
  const link = runs('link');
  assert.deepEqual(link.map((r) => `${r.kind}/${r.id}`), ['tool/link_items']);
});

/**
 * `plan:library seq:3`: the hint states the SHAPE and names the category back
 * at the reader. The sentence it is missing is the category's own, resolved
 * from THIS project's config, and the worked value is the generated specimen —
 * neither is written down here or anywhere else.
 */
test('every add- and list- shortcut carries its category\'s own words, and add- a real title', () => {
  const index = apiCliHelp(ws).body as { subjects: { kind: string; id: string }[] };
  const perCategory = index.subjects
    .filter((s) => s.kind === 'slash' && (s.id.startsWith('add-') || s.id.startsWith('list-')));
  assert.ok(perCategory.length > 0);

  for (const row of perCategory) {
    const body = subject('slash', row.id) as { category: { category: string; description: string; example?: string } | null };
    assert.notEqual(body.category, null, `/${row.id} names a category and carries nothing about it`);
    const resolved = ws.config.categories[body.category?.category ?? ''];
    assert.equal(body.category?.description, resolved?.description, 'the description is the config\'s');
    assert.notEqual(body.category?.description, '', 'and it is not empty');
    if (!row.id.startsWith('add-')) continue;
    assert.equal(
      body.category?.example, exampleItemTitle(resolved?.name ?? '', ws.config),
      'the example is what `mycontext examples <category> --short` answers, not a sentence typed here',
    );
  }

  // A shortcut whose name carries no category says so by carrying nothing,
  // rather than by carrying an empty one.
  assert.equal((subject('slash', 'audit') as { category: unknown }).category, null);
});
