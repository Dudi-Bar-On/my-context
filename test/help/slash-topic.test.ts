/**
 * **The `slash` topic, and the property that makes it worth having: its
 * command list is DERIVED from the files this plugin ships, not written down.**
 *
 * The gap it closes: `HELP_TOPICS` covered the concepts and, after the `cli`
 * branch, one of the three invocation surfaces. The user's surface had no page
 * at all — so the commands a model is asked to name for a user were reachable
 * only by listing a directory, and the one thing an agent most needs to know
 * about them (which of them stop and hand back, and why) was written once per
 * generated file and nowhere a reader could find it.
 *
 * The list is generated from `commands/*.md`, which IS the surface: Claude
 * Code discovers plugin commands by scanning that directory. `src/plugin/commands.ts`
 * generates those files and `test/plugin/commands.test.ts` holds them
 * byte-identical to it, so this file closes the loop from the other side —
 * every file the generator produces has to reach the topic. A mutation that
 * pastes the rendered list into `slash.md` reddens the first three tests.
 *
 * The rest holds the topic's written claims to the running program: the
 * approval gate's refusal is executed, and the deny-list claim is checked
 * against the real command files and the real README rather than restated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  helpTopic, slashAbsences, slashCommandList, slashModelInvocable,
} from '../../src/help/index.ts';
import { CLI_WITHOUT_SLASH } from '../../src/plugin/parity.ts';
import { generateCommands } from '../../src/plugin/commands.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseFrontmatter } from '../../src/core/frontmatter.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});
const REPO = path.join(import.meta.dirname, '..', '..');
const COMMANDS_DIR = path.join(REPO, 'commands');

const SOURCE = readFileSync(
  path.join(REPO, 'src', 'help', 'topics', 'slash.md'), 'utf8',
).replaceAll('\r\n', '\n');

function topic(): string {
  return helpTopic('slash', CONFIG);
}

const committed = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));

/** The `description:` a committed command file declares. */
function descriptionOf(file: string): string {
  const text = readFileSync(path.join(COMMANDS_DIR, file), 'utf8');
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  assert.ok(front, `${file} has no frontmatter`);
  return String(parseFrontmatter(front[1]).description ?? '');
}

/* -------------------------------------------------------------------- *
 * Derived, not written.                                                *
 * -------------------------------------------------------------------- */

test('the command list is generated from what it is given, not written into slash.md', () => {
  const rendered = slashCommandList([
    { name: 'zzz-probe', description: 'a command invented by this test', modelInvocable: false },
    { name: 'add-zzz-probe', description: 'invented', modelInvocable: false },
    { name: 'list-zzz-probe', description: 'invented', modelInvocable: false },
  ]);
  assert.match(rendered, /- `\/mycontext:zzz-probe` — a command invented by this test/);
  assert.match(rendered, /`\/mycontext:add-<type>` — 1 of them/,
    'the per-category pairs are COUNTED from what was given; a written number would be stale ' +
    'the first time a category is enabled or disabled');
  assert.equal(SOURCE.includes('zzz-probe'), false, 'the probe leaked into the tracked file');
});

test('every command file this plugin generates reaches the topic', () => {
  const generated = generateCommands(CONFIG).map((c) => c.file.replace(/\.md$/, ''));
  assert.ok(generated.length > 20, `expected many generated commands, found ${generated.length}`);
  const text = topic();

  const perCategory = generated.filter((n) => n.startsWith('add-') || n.startsWith('list-'));
  const generic = generated.filter((n) => !perCategory.includes(n));

  const missing = generic.filter((name) => !text.includes(`\`/mycontext:${name}\``));
  assert.deepEqual(
    missing, [],
    'these generated slash commands are absent from `mycontext help slash`. The list is the ' +
    'whole surface or it is not usable as one: a reader who does not find a command there ' +
    'concludes the plugin has none.',
  );
  // The pairs are counted rather than named — `help("categories")` owns the
  // category list — so the COUNT is what has to agree with the generator.
  const adds = perCategory.filter((n) => n.startsWith('add-')).length;
  assert.match(
    text, new RegExp(`\`/mycontext:add-<type>\` — ${adds} of them`),
    `the topic states a different number of per-category capture commands than the generator ` +
    `produces (${adds}).`,
  );
  // And the hand-written command the generator does NOT produce is in the
  // directory and in the topic all the same.
  assert.equal(generated.includes('LoadMyContext'), false,
    'LoadMyContext is now generated; the topic and this test both treat it as the one ' +
    'hand-written command file');
  assert.ok(text.includes('`/mycontext:LoadMyContext`'));
});

test("slash.md carries each placeholder once and none of the command files' own words", () => {
  for (const token of ['{{SLASH_COMMAND_LIST}}', '{{SLASH_MODEL_INVOCABLE}}', '{{SLASH_ABSENCES}}']) {
    assert.equal(
      (SOURCE.match(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g')) ?? []).length, 1,
      `slash.md must carry ${token} exactly once — that section is generated, and a pasted ` +
      'copy would stop tracking its source the moment it was pasted',
    );
  }
  const spelled = committed.filter((f) => {
    const description = descriptionOf(f);
    return description.length > 0 && SOURCE.includes(description);
  });
  assert.deepEqual(
    spelled, [],
    "slash.md spells out descriptions that belong to the command files' own frontmatter. " +
    'Those words have one home; a second copy here is free to drift from it.',
  );
  const notes = Object.entries(CLI_WITHOUT_SLASH).filter(([, why]) => SOURCE.includes(why));
  assert.deepEqual(
    notes.map(([name]) => name), [],
    'slash.md spells out reasons that belong to CLI_WITHOUT_SLASH (src/plugin/parity.ts), ' +
    'where test/plugin/parity.test.ts refuses to let them go stale.',
  );
});

test('an empty commands directory is refused, never rendered as an empty list', () => {
  assert.throws(
    () => slashCommandList([]),
    /the "slash" topic is generated from the plugin's committed command files/,
    'an empty directory rendered instead of refused — a plugin with no commands is what that ' +
    'would describe, and it would be wrong in exactly the way a reader cannot detect',
  );
});

/* -------------------------------------------------------------------- *
 * Why the directory, and not the generator: a side effect.             *
 * -------------------------------------------------------------------- */

/**
 * **The reason `src/help/index.ts` reads `commands/` instead of importing
 * `generateCommands`, proved rather than asserted in a comment.**
 *
 * `src/plugin/commands.ts` imports `NAMED_ENTRY_POINTS` from
 * `src/cli/commands/edit.ts`, and loading that module REGISTERS commands into
 * `COMMANDS` as a side effect. Importing the generator from help would
 * therefore leave the CLI's registry half-populated in every process that
 * loads help — including the MCP server — and `commandList` would then render
 * those few commands as the CLI's complete surface instead of refusing. That
 * is the complete-looking-and-wrong answer the `cli` topic exists to prevent,
 * and this topic must not be what causes it.
 *
 * Both halves are executed in child processes, because the state in question
 * is per-process module state that this suite's other imports have already
 * destroyed.
 */
test('loading help leaves the CLI registry empty, and loading the generator does not', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-slash-child-'));
  try {
    const url = (...parts: string[]): string =>
      JSON.stringify(pathToFileURL(path.join(REPO, ...parts)).href);
    const size = (firstImport: string): number => {
      const script = path.join(dir, `probe-${Math.random().toString(36).slice(2)}.mjs`);
      writeFileSync(script, [
        `await import(${firstImport});`,
        `const { COMMANDS } = await import(${url('src', 'cli', 'commands', 'registry.ts')});`,
        'console.log(COMMANDS.size);',
      ].join('\n'));
      const out = execFileSync(process.execPath, [script], { encoding: 'utf8', cwd: REPO });
      return Number(out.trim().split('\n').at(-1));
    };

    assert.equal(
      size(url('src', 'help', 'index.ts')), 0,
      'loading src/help/index.ts now registers CLI commands as a side effect. `mycontext ' +
      'help cli` served from the MCP server would print those few commands as the whole CLI ' +
      'surface instead of refusing. Whatever this file started importing, stop.',
    );
    assert.ok(
      size(url('src', 'plugin', 'commands.ts')) > 0,
      'importing the slash-command GENERATOR no longer registers CLI commands, so the ' +
      'assertion above is no longer testing anything and the topic could read the generator ' +
      'directly. Check src/plugin/commands.ts before relaxing anything.',
    );
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Which of these the model may invoke.                                 *
 * -------------------------------------------------------------------- */

test('exactly one command file is model-invocable, and the topic names that one', () => {
  const open = committed.filter((file) => {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path.join(COMMANDS_DIR, file), 'utf8'));
    assert.ok(front, `${file} has no frontmatter`);
    return parseFrontmatter(front[1])['disable-model-invocation'] !== true;
  }).map((f) => f.replace(/\.md$/, ''));

  assert.deepEqual(
    open, ['LoadMyContext'],
    'the set of command files the model may invoke has changed. Every other file declares ' +
    '`disable-model-invocation: true`; the topic reports this set from the files themselves, ' +
    'so it will follow — but the change should be a decision.',
  );
  assert.equal(slashModelInvocable(), '`/mycontext:LoadMyContext`');
  assert.match(topic(), /\*\*One\.\*\*/);
  // Not vacuous: the renderer really does read the flag rather than hardcoding
  // the answer.
  assert.equal(
    slashModelInvocable([{ name: 'zzz-probe', description: 'x', modelInvocable: true }]),
    '`/mycontext:zzz-probe`',
  );
  assert.match(
    slashModelInvocable([{ name: 'zzz-probe', description: 'x', modelInvocable: false }]),
    /^None\./,
  );
});

/* -------------------------------------------------------------------- *
 * The approval gate, executed.                                         *
 * -------------------------------------------------------------------- */

test('lesson-accept refuses --agent, has no slash command, and the topic says both', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-slash-topic-'));
  let out = '';
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    const code = runCli(['lesson-accept', '--agent'], cwd, (s) => { out += `${s}\n`; });
    assert.equal(code, 1, `lesson-accept accepted --agent. Output:\n${out}`);
  } finally {
    removeTree(cwd);
  }
  assert.match(out, /lesson-accept takes no --agent/, out);

  for (const name of ['lesson-accept', 'lesson-discard']) {
    assert.equal(
      committed.includes(`${name}.md`), false,
      `a /mycontext:${name} command file now exists — the topic says the approval gate has ` +
      `no slash command, and would have to be corrected`,
    );
    assert.ok(Object.hasOwn(CLI_WITHOUT_SLASH, name), `${name} left CLI_WITHOUT_SLASH`);
    assert.ok(slashAbsences().includes(`\`mycontext ${name}\``));
  }

  const text = topic();
  assert.match(text, /lesson-accept takes no\n?-*-agent/,
    "the topic quotes the refusal; if the program's words changed, requote them");
  assert.match(text, /`\/mycontext:lesson-stage` prints it for the user and stops/);
});

/**
 * The deny-list claim, checked against the two real documents it is about.
 *
 * The topic says the README's recommended `Bash(mycontext lesson-accept *)`
 * rule does not match the spelling this plugin's own command file prints. Both
 * halves are read here rather than restated: the rule out of README.md, the
 * invocation out of the committed `lesson-stage.md`.
 */
test("the recommended deny rule does not match the spelling the plugin's own command prints", () => {
  const readme = readFileSync(path.join(REPO, 'README.md'), 'utf8');
  assert.ok(
    readme.includes('"Bash(mycontext lesson-accept *)"'),
    'README.md no longer recommends `Bash(mycontext lesson-accept *)`; the topic describes ' +
    'that rule by name and must be corrected with it',
  );
  const staged = readFileSync(path.join(COMMANDS_DIR, 'lesson-stage.md'), 'utf8');
  const printed = staged.split('\n').find((l) => l.includes('lesson-accept <lesson id>'));
  assert.ok(printed, `lesson-stage.md no longer prints a lesson-accept command:\n${staged}`);
  assert.match(
    printed, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/src\/cli\/index\.ts" lesson-accept/,
    'the command file now spells the invocation differently. The topic says the printed ' +
    'spelling is one the recommended prefix rule does not match; recheck that claim.',
  );
  assert.equal(
    printed.trim().startsWith('`mycontext lesson-accept'), false,
    'if the printed command ever became a bare `mycontext …`, the deny rule WOULD match it ' +
    'and the topic overstates the gap',
  );
  assert.match(topic(), /prefix match on the command string/);
});

test('the write commands really do run without --yes and hand back, as the topic says', () => {
  // The shape the topic describes, read off the generated files rather than
  // taken on trust: `test/plugin/write-commands.test.ts` proves the preview
  // and the refusal by executing them; this only checks the topic is
  // describing the same shape.
  const handBack = committed.filter(
    (f) => readFileSync(path.join(COMMANDS_DIR, f), 'utf8').includes('WITHOUT `--yes`'),
  );
  assert.ok(handBack.length >= 5, `only ${handBack.length} command files hand back`);
  for (const file of handBack) {
    const text = readFileSync(path.join(COMMANDS_DIR, file), 'utf8');
    assert.match(text, /Exit code 1 is the expected outcome/, file);
    assert.match(text, /Do not run it yourself/, file);
  }
  const text = topic();
  assert.match(text, /Exit code 1 there is the expected outcome, not a failure/);
  assert.match(text, /claims `origin: "human"`/);
});

/* -------------------------------------------------------------------- *
 * Surfaces.                                                            *
 * -------------------------------------------------------------------- */

test('the CLI serves the topic, and does so outside a workspace', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-slash-topic-'));
  try {
    let out = '';
    const code = runCli(['help', 'slash'], cwd, (s) => { out += `${s}\n`; });
    assert.equal(code, 0, out);
    assert.match(out, /- `\/mycontext:review` — /);
    assert.equal(out.includes('{{'), false, 'an unexpanded placeholder reached the reader');
  } finally {
    removeTree(cwd);
  }
});

/** No Hebrew twin, on the same terms as `cli` and `tools` — see the note in
 * `test/help/tools-topic.test.ts`. */
test('the slash topic has no Hebrew source, and asking for one says which file to create', () => {
  assert.throws(
    () => helpTopic('slash', CONFIG, 'he'),
    /the topic "slash" has no "he" source/,
    'a silent English fallback is how the Hebrew README came to carry an English section',
  );
});
