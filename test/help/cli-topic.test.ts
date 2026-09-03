/**
 * **The `cli` topic, and the property that makes it worth having: its command
 * section is DERIVED from the registry, not written down.**
 *
 * The gap this topic closes is concrete. `HELP_TOPICS` had four members and
 * none of them covered the CLI's own commands and flags, so three wrong
 * invocations in one session — `add … --always` (that flag was `edit`'s;
 * `add` has taken it since 2026-09-03, and the test below now asserts the
 * flip), `link <id> refines <id>` (there is no `link` command), `supersede
 * <id> --reason …` (`--by` is required) — each cost a round trip. Every one of
 * those facts already existed in `COMMANDS`; nothing pointed a reader at it.
 *
 * So the command section is generated, on the same terms as the category
 * table (`categoryTable`, and `test/help/categories-he.test.ts`'s placeholder
 * check): a hand-written command list is stale the first time a command is
 * added and nothing catches it. The first three tests below are the pin —
 * modelled on `test/core/audit-surfaces-derive.test.ts`, which asserts that
 * the MCP schema IS `AUDIT_OPS` rather than a copy of it. A mutation that
 * pastes the rendered list into `cli.md` reddens all three.
 *
 * The rest of the file holds the topic's WRITTEN claims to the running
 * program, because a flag claim is exactly the kind that rots quietly: each of
 * the three refusals is executed against the real CLI and checked against what
 * the topic says about it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HELP_TOPICS, commandList, helpTopic, toolDescriptions } from '../../src/help/index.ts';
import { COMMANDS, registerCommand } from '../../src/cli/commands/registry.ts';
import { resolveConfig } from '../../src/core/config.ts';
// Importing `runCli` is also what POPULATES `COMMANDS`: loading src/cli/index.ts
// registers the seven built-ins and imports the module that registers the rest.
// Nothing else in this file would make the registry non-empty.
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

function topicSource(file: string): string {
  return readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'help', 'topics', file), 'utf8',
  ).replaceAll('\r\n', '\n');
}

const SOURCE = topicSource('cli.md');
const SOURCE_CAPTURE = topicSource('capture.md');

function topic(): string {
  return helpTopic('cli', CONFIG);
}

/**
 * A throwaway directory with a workspace in it, so a command reaches its own
 * argument checks rather than stopping at "no workspace here".
 */
function workspace<T>(fn: (cwd: string) => T): T {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-topic-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    return fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function run(argv: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(argv, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

test('the command section is generated from the registry, not written into cli.md', () => {
  const name = 'zzz-probe';
  registerCommand({
    name, usage: `${name} <thing> [--probe]`, summary: 'a command invented by this test',
    run: () => 0,
  });
  try {
    assert.match(
      topic(), /`mycontext zzz-probe <thing> \[--probe\]` — a command invented by this test/,
      'a command registered a moment ago is missing from `mycontext help cli`. The topic\'s ' +
      'command section must be generated from COMMANDS — a hand-written list is stale the ' +
      'first time a command is added, and nothing would catch it.',
    );
  } finally {
    COMMANDS.delete(name);
  }
  assert.doesNotMatch(topic(), /zzz-probe/, 'a de-registered command still appears in the topic');
});

test('every registered command reaches the topic, with its own usage and summary', () => {
  assert.ok(COMMANDS.size > 1, `expected several registered commands, found ${COMMANDS.size}`);
  const text = topic();
  const missing = [...COMMANDS.values()].filter(
    (c) => !text.includes(`\`mycontext ${c.usage}\``) || !text.includes(c.summary),
  );
  assert.deepEqual(
    missing.map((c) => c.name), [],
    'these registered commands are absent from `mycontext help cli`, or reach it in words ' +
    'other than their own. The section is the whole set or it is not usable as one: a reader ' +
    'who does not find a verb there concludes the CLI has no such verb.',
  );
});

test("cli.md carries the placeholder once and none of the registry's own words", () => {
  assert.equal(
    (SOURCE.match(/\{\{COMMAND_LIST\}\}/g) ?? []).length, 1,
    'cli.md must carry {{COMMAND_LIST}} exactly once — the command section is generated from ' +
    'COMMANDS, and a pasted copy would stop tracking the registry the moment it was pasted',
  );
  const spelled = [...COMMANDS.values()].filter((c) => SOURCE.includes(c.summary));
  assert.deepEqual(
    spelled.map((c) => c.name), [],
    'cli.md spells out summaries that belong to the registry. Those words have one home ' +
    '(`CommandDef.summary`); a second copy in a Markdown file is free to drift from it, ' +
    'which is the failure the placeholder exists to prevent.',
  );
});

test('an empty registry is refused, never rendered as an empty command section', () => {
  // The MCP server is such a process: it imports src/help/index.ts and never
  // loads the CLI, so `COMMANDS` is empty there. Rendering would produce a
  // section that reads as complete and names nothing.
  assert.throws(
    () => commandList(new Map()),
    /the "cli" topic is generated from the CLI's command registry/,
    'an empty registry rendered instead of refused — the one answer this topic must never give',
  );
});

/* -------------------------------------------------------------------- *
 * The three real errors, executed and then read back off the topic.    *
 * -------------------------------------------------------------------- */

/**
 * **This test used to assert the opposite, and the flip is the point of
 * keeping it.**
 *
 * `add --always` was the first of the three failed invocations above: the flag
 * was `edit`'s alone, `add` refused it by name, and the topic said so. On
 * 2026-09-03 `add` grew it — seven of the 44 items being merged from
 * `.my_context.nested-44/` carry `always: true`, and until then every one of
 * them had to be captured unpinned and pinned by a second command. So the
 * topic's claim became false, and a help page that tells a reader a flag is
 * refused when the command takes it is exactly the round trip this page exists
 * to prevent, pointed the other way.
 *
 * What is asserted now is the same property as before — the topic's claim about
 * `--always` matches the running program, in BOTH directions — against the
 * opposite fact. The generated section must advertise the flag on `add`
 * (`ADD_FLAG_SUMMARY` derives it from `ADD_USAGE`, so this fails if the usage
 * line loses it) and on `edit`, and the prose must not still be standing over
 * the refusal it once recorded.
 */
test('`add --always` is accepted, and the topic advertises it on `add` and on `edit`', () => {
  const { code, out } = workspace((cwd) => run(
    ['add', '--summary-omitted', 'rule', 'x', '--body', 'y', '--always', '--yes'], cwd,
  ));
  assert.equal(code, 0, `add refused --always. Output:\n${out}`);
  assert.doesNotMatch(out, /unknown option "--always"/);
  // The gate is what consents to a pin, so it has to SAY there is one — the
  // flag adds no gate of its own precisely because this one already fires.
  assert.match(out, /pinned: injected in full at every session start/,
    'the normative confirmation approved a pinned capture without naming the pin');

  // Searched in the GENERATED section rather than in the whole topic: the prose
  // above it quotes the three failed invocations verbatim, so a whole-file
  // search finds `mycontext add … --always` in the sentence about them.
  const generated = commandList().split('\n');
  const edit = generated.find((l) => l.startsWith('- `mycontext edit '));
  assert.ok(edit, 'the topic has no line for `edit`');
  assert.match(edit, /--always/,
    'the topic must show --always on `edit`, which is still the only command that can UNPIN');
  const add = generated.find((l) => l.startsWith('- `mycontext add '));
  assert.ok(add !== undefined, 'the topic has no line for `add`');
  assert.match(add, /--always/,
    "`add`'s line hides --always, which `add` accepts. The line is derived from ADD_USAGE, so " +
    'this fails when the usage line drops the flag rather than when the topic does.');

  const text = topic();
  assert.match(text, /`mycontext pin <id>`/,
    'the topic must still name the second-act route for an item that already exists');
  // The stale claim, named by its own words so it cannot come back quietly.
  assert.doesNotMatch(
    text, /`mycontext add` has no spelling for it/,
    'the topic still says `add` cannot pin. It can, and a reader who believes this page will ' +
    'run two commands where one would do — or skip the pin on a migration entirely.',
  );
});

test('there is no `link` command, and the topic says where relations are made', () => {
  assert.equal(COMMANDS.has('link'), false,
    'a `link` command now exists — the topic says it does not, and must be corrected');
  const { code, out } = workspace((cwd) => run(['link', 'A', 'refines', 'B'], cwd));
  assert.equal(code, 1);
  assert.match(out, /unknown command "link"/);

  const text = topic();
  assert.match(text, /link_items\(from, to, relation\)/,
    'the topic must name the route that does record a relation');
  assert.match(text, /`create_item` does \*\*not\*\* take a `relations` argument/,
    'the second half of the same answer: the obvious guess is refused too');
  assert.match(text, /--unlink <relation> <target>/,
    'the one relation verb the CLI does have is removal, and the topic must not claim that ' +
    'relations are absent from the CLI entirely');
});

test('`supersede` without --by is refused, and the topic says --by is required', () => {
  const { code, out } = workspace((cwd) => run(['supersede', 'DEC-x', '--reason', 'y'], cwd));
  assert.equal(code, 1, `supersede ran without --by. Output:\n${out}`);
  assert.match(out, /usage: mycontext supersede <retired id> --by <replacement id>/);

  const text = topic();
  const line = commandList().split('\n').find((l) => l.startsWith('- `mycontext supersede '));
  assert.ok(line !== undefined, 'the topic has no line for `supersede`');
  assert.ok(line.includes('--by'), `the topic's supersede line hides --by: ${line}`);
  assert.match(text, /`supersede` requires `--by <replacement id>`/);
  assert.match(text, /--status deprecated/,
    'retiring something nothing replaces is the other half of the answer');
});

/* -------------------------------------------------------------------- *
 * The routes the topic sends a reader to must actually work.           *
 * -------------------------------------------------------------------- */

test('a command that needs an argument prints its own usage line and writes nothing', () => {
  // The topic tells a reader to run the command bare to get its full flag
  // list. If that stopped being true the topic would be advice that fails.
  for (const name of ['add', 'show', 'edit', 'supersede']) {
    const { code, out } = workspace((cwd) => run([name], cwd));
    assert.equal(code, 1, `\`mycontext ${name}\` with no arguments exited ${code}`);
    assert.match(out, new RegExp(`^usage: mycontext ${name} `, 'm'),
      `\`mycontext ${name}\` printed no usage line of its own:\n${out}`);
  }
});

test('an unknown flag is refused BY NAME, which is the probe the topic recommends', () => {
  const { code, out } = workspace((cwd) => run(['add', '--summary-omitted', 'rule', 'x', '--nonsense'], cwd));
  assert.equal(code, 1);
  assert.match(out, /unknown option "--nonsense"/,
    'the topic tells a reader that an unaccepted flag is named back at them, and that the ' +
    "check reads the command's own accept-list. A refusal that did not name the flag would " +
    'make that advice useless.');
  // And the usage line that follows it is the COMPLETE one, not the abbreviated
  // column the generated command section prints.
  assert.match(out, /--extra key=value/, 'the full usage line lost --extra, which `add` accepts');
});

/**
 * `capture.md` prints `mycontext add`'s spelling in full, and that is a second
 * copy of a flag list — the one shape this branch exists to argue against. It
 * earns its place (a reader of the capture topic is being handed the command
 * to print for a user) only if it cannot drift, so it is pinned to the
 * command's own usage line IN BOTH DIRECTIONS.
 *
 * It had already drifted: the paragraph advertised `--body --scope --tags
 * --yes` and `add` has accepted `--file`, `--note`, `--severity` and `--extra`
 * for some time. The half that catches that is "every flag the command prints
 * appears in the topic"; the other half catches the topic advertising a flag
 * the command would refuse, which is the costlier direction for a reader.
 */
test("the capture topic's `add` spelling carries exactly the flags `add` prints", () => {
  // The one PARAGRAPH that carries the spelling, not the whole section: the
  // paragraphs after it discuss individual flags in prose, and reading those
  // too would let a flag be quietly dropped from the spelling itself while
  // the set still matched. Mutation testing found exactly that — removing
  // `--note` from the usage line survived, because `--note` is discussed
  // below it.
  const section = SOURCE_CAPTURE.slice(SOURCE_CAPTURE.indexOf("## The human's CLI"));
  const paragraph = section.split('\n\n').find((p) => p.includes('mycontext add <category>'));
  assert.ok(paragraph !== undefined, 'the `mycontext add` spelling is no longer a paragraph of ' +
    "capture.md's \"The human's CLI\" section; point this test at wherever it lives now");

  const flags = (text: string): string[] =>
    [...new Set([...text.matchAll(/--([a-z-]+)/g)].map((m) => m[1]))].sort();

  const { out } = workspace((cwd) => run(['add'], cwd));
  assert.match(out, /^usage: mycontext add /m, out);

  assert.deepEqual(
    flags(paragraph), flags(out),
    'capture.md and `mycontext add`\'s own usage line disagree about which flags `add` takes. ' +
    'The topic is the copy: correct it, and do not add a flag to the command without it.',
  );
});

test('the commands the topic names in prose all exist, and are not stale', () => {
  const named = ['add', 'edit', 'pin', 'unpin', 'harden', 'soften', 'supersede', 'lesson',
    'lesson-accept', 'show', 'review'];
  for (const name of named) {
    assert.equal(COMMANDS.has(name), true,
      `cli.md names \`mycontext ${name}\` and it is no longer registered`);
    assert.ok(SOURCE.includes(`\`mycontext ${name}`) || SOURCE.includes(`\`${name}\``),
      `\`${name}\` is asserted here but cli.md does not mention it — this list has drifted ` +
      `from the topic it is supposed to guard`);
  }
});

/* -------------------------------------------------------------------- *
 * Surfaces.                                                            *
 * -------------------------------------------------------------------- */

test('the CLI serves the topic, and does so outside a workspace', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-topic-'));
  try {
    const { code, out } = run(['help', 'cli'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /`mycontext supersede <id> --by <id>`/);
    assert.equal(out.includes('{{'), false, 'an unexpanded placeholder reached the reader');
  } finally {
    removeTree(cwd);
  }
});

/**
 * No Hebrew twin, and this is how that was established rather than assumed.
 *
 * `readTopicFile` throws for a locale with no `<topic>.he.md`, and the only
 * caller that passes a locale is `cmdHelp` under `MYCONTEXT_DOC_LOCALE`, which
 * only the documentation generator sets — and the generator embeds exactly one
 * help block, `<!-- example-md: help categories -->`, in each README. So
 * `scope`, `capture` and `workflow` have shipped without a Hebrew source since
 * they were written, `docs/README.he.md`'s structural parity test never sees
 * this topic, and a Hebrew `cli.md` would be a translation nothing reads.
 * Asserted rather than left implicit: if a second topic is ever embedded in the
 * Hebrew README, this is where the decision gets revisited.
 */
test('the cli topic has no Hebrew source, and asking for one says which file to create', () => {
  assert.throws(
    () => helpTopic('cli', CONFIG, 'he'),
    /the topic "cli" has no "he" source/,
    'a silent English fallback is how the Hebrew README came to carry an English section',
  );
});

/**
 * The schema is now derived — `MCP_HELP_TOPICS`, which is `HELP_TOPICS` minus
 * `cli`, the one topic the MCP server genuinely cannot render (see
 * `commandList`'s refusal: it never loads the CLI registry). So `cli` still
 * reaches `mycontext help cli` and not the tool.
 *
 * **capture.md's description is still written by hand, and that is what this
 * pins.** A derived schema fixes half the drift and makes the other half
 * easier to miss: the topic list grows in `core/teach.ts`, the schema follows
 * it silently, and the sentence the model actually READS when choosing an
 * argument keeps advertising the old four. This holds the two to each other in
 * both directions — every accepted topic is named, and no topic is named that
 * the schema refuses — so a widened list reddens here until the description
 * catches up.
 */
test('the mycontext_help description names exactly the topics its schema accepts', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-topic-'));
  try {
    const spec = createRegistry(cwd).list().find((t) => t.name === 'mycontext_help');
    assert.ok(spec, 'mycontext_help is registered');
    const schema = spec.inputSchema as { properties: Record<string, { enum?: string[] }> };
    const accepted = schema.properties.topic.enum;
    assert.ok(accepted !== undefined && accepted.length > 0,
      'the topic argument advertises no enum');
    const described = toolDescriptions().mycontext_help;
    for (const name of accepted) {
      assert.ok(described.includes(name),
        `the schema accepts "${name}" and capture.md's tool description does not name it`);
    }
    for (const name of HELP_TOPICS) {
      if (accepted.includes(name)) continue;
      assert.equal(described.includes(name), false,
        `capture.md's mycontext_help description advertises "${name}", which the tool's own ` +
        `schema does not accept. Either the schema should be HELP_TOPICS — which needs the ` +
        `MCP server to be able to render every topic — or the description must stop offering ` +
        `it. Advertising a topic the tool refuses is the drift this project keeps paying for.`);
    }
  } finally {
    removeTree(cwd);
  }
});
