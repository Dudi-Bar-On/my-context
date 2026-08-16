import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';
import { RELATION_TYPES, SEVERITIES, STATUSES } from '../../src/core/mutate.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseFrontmatter } from '../../src/core/frontmatter.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { commandSlug, generateCommands } from '../../src/plugin/commands.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * THE drift guard for Task 16's command surface: the set of generated
 * commands must equal the set of ENABLED categories, and the files committed
 * under `commands/` must equal what the generator produces today.
 *
 * This is the defect class this project keeps re-finding — two hand-kept
 * lists of the same thing (the extra-field list, the tool list, the F2 rule,
 * the usage banner) drifting apart — applied to the surface a user actually
 * types. A stale `add-policy.md` would offer a capture `resolveCategory`
 * refuses; a missing `add-rule.md` would silently omit a category from the
 * picker. Neither is visible from inside the plugin at runtime, because
 * Claude Code reads these files, not this code.
 *
 * Nothing here writes anything: the generator is pure, and the comparison is
 * against the working tree.
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const COMMAND_DIR = path.join(ROOT, 'commands');

/** Hand-written and predating the generator; excluded by name, not by shape. */
const HAND_WRITTEN = new Set(['LoadMyContext.md']);

function committedFiles(): string[] {
  return readdirSync(COMMAND_DIR)
    .filter((f) => f.endsWith('.md') && !HAND_WRITTEN.has(f))
    .sort();
}

function read(file: string): string {
  return readFileSync(path.join(COMMAND_DIR, file), 'utf8').replace(/\r\n/g, '\n');
}

const config = resolveConfig({});
const generated = generateCommands(config);
const enabled = Object.values(config.categories).filter((c) => c.enabled).map((c) => c.name).sort();

test('the generated command set is exactly the enabled category set, twice over', () => {
  const added = generated.map((f) => f.file).filter((f) => f.startsWith('add-'))
    .map((f) => f.slice('add-'.length, -'.md'.length)).sort();
  const listed = generated.map((f) => f.file).filter((f) => f.startsWith('list-'))
    .map((f) => f.slice('list-'.length, -'.md'.length)).sort();
  const expected = enabled.map(commandSlug).sort();

  assert.deepEqual(added, expected, 'one add-<type> per enabled category, and no others');
  assert.deepEqual(listed, expected, 'one list-<type> per enabled category, and no others');
});

test('the committed command files are exactly the generated ones, byte for byte', () => {
  assert.deepEqual(
    committedFiles(), generated.map((f) => f.file).sort(),
    'commands/ is out of date — run `npm run gen:commands` and commit the result',
  );
  for (const { file, content } of generated) {
    assert.equal(
      read(file), content.replace(/\r\n/g, '\n'),
      `commands/${file} differs from the generator — run \`npm run gen:commands\``,
    );
  }
});

test('a disabled category gets no command at all', () => {
  // Nothing ships disabled since Phase 3 removed `policy`, `postmortem` and
  // `taxonomy`, so this is driven off a config that switches one off — the
  // state a real project reaches. A command for a disabled category would
  // offer the user a capture `resolveCategory` then refuses.
  const off = resolveConfig({ categories: { standard: { enabled: false } } });
  const files = generateCommands(off).map((f) => f.file);
  assert.equal(files.includes('add-standard.md'), false);
  assert.equal(files.includes('list-standard.md'), false);
  // Not vacuous: the committed set, generated from the default config, has them.
  assert.ok(committedFiles().includes('add-standard.md'));

  // And the three categories Phase 3 removed have no command file left behind.
  for (const removed of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(Object.hasOwn(config.categories, removed), false, `${removed} is still a category`);
    assert.equal(committedFiles().includes(`add-${removed}.md`), false, `add-${removed}.md exists`);
    assert.equal(committedFiles().includes(`list-${removed}.md`), false, `list-${removed}.md exists`);
  }
});

test('enabling a category is all it takes to get its commands — the generator reads the config', () => {
  // Drives the generator with a DIFFERENT config than the committed one, so a
  // generator that ignored its argument and hardcoded today's catalogue would
  // fail here rather than passing every other test in this file.
  const custom = generateCommands(resolveConfig({
    categories: { deployment_note: { tier: 'rationale', description: 'How a deploy went' } },
  }));
  assert.ok(custom.some((f) => f.file === 'add-deployment-note.md'), 'a custom category gets commands');
});

test('two categories that would produce the same command file are refused, not silently merged', () => {
  assert.throws(
    () => generateCommands(resolveConfig({
      categories: {
        'non-goal': { tier: 'normative', description: 'A hyphenated twin of non_goal' },
      },
    })),
    /both produce the command slug "non-goal"/,
  );
});

/**
 * The non-per-category commands, as an exact set rather than a spot check.
 *
 * Phase 4 took this from three to twenty-one, and the reason it is pinned as a
 * whole set is that this is the list a reader consults to answer "is there a
 * command for X". A file added here without being added to §5 of both READMEs
 * is a command nobody knows exists; a file removed is a link in those documents
 * that resolves to nothing. `test/plugin/parity.test.ts` checks the other
 * question — whether every tool has one of these.
 */
const GENERIC = [
  'audit.md', 'decay.md', 'discard.md', 'doctor.md', 'edit.md', 'harden.md', 'ingest.md',
  'lesson-stage.md', 'lesson.md', 'link.md', 'pin.md', 'promote.md', 'query.md',
  'refresh.md', 'review.md', 'search.md', 'show.md', 'soften.md', 'status.md',
  'supersede.md', 'unlink.md', 'unpin.md',
];

test('the generic, non-per-category commands are exactly the expected set', () => {
  const committed = committedFiles();
  const generic = committed.filter((f) => !f.startsWith('add-') && !f.startsWith('list-')).sort();
  assert.deepEqual(generic, [...GENERIC].sort());
});

/**
 * **D3.6: one implementation, two spellings, one enumerating test.**
 *
 * `pin`/`unpin`/`harden`/`soften` are `mycontext edit` under a shorter name —
 * the CLI registers them by rewriting argv into `cmdEdit`, so the gate, the
 * preview and every refusal are `edit`'s. Their slash commands are generated
 * from the same `NAMED_ENTRY_POINTS` list, and this enumerates that list rather
 * than naming four files.
 *
 * The reason it enumerates: this project has already shipped the alternative.
 * A per-preview test that checked one surface stayed green on a mutant, because
 * a surface checked separately is a surface excluded from the agreement. So the
 * assertion below is over the LIST — a fifth named form gets checked the day it
 * is added, and a slash command with no CLI entry behind it fails the byte
 * comparison above.
 */
test('every named entry point has a slash command, and no others do', () => {
  const named = NAMED_ENTRY_POINTS.map((e) => `${e.name}.md`).sort();
  assert.deepEqual(named, ['harden.md', 'pin.md', 'soften.md', 'unpin.md'],
    'the named entry points changed — this list is what both surfaces are generated from');
  for (const entry of NAMED_ENTRY_POINTS) {
    const file = `${entry.name}.md`;
    assert.ok(committedFiles().includes(file), `commands/${file} is missing`);
    const text = read(file);
    // Each names its OWN command and its OWN flag: a template bug that emitted
    // `pin` into all four would still satisfy a set-equality check.
    assert.match(text, new RegExp(`index\\.ts" ${entry.name} <id>`), `${file} runs ${entry.name}`);
    assert.match(
      text, new RegExp(`mycontext edit <id> ${entry.sets.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `${file} must say which edit it is`,
    );
    assert.ok(
      COMMANDS.has(entry.name),
      `${file} names \`mycontext ${entry.name}\`, which the CLI does not register`,
    );
  }
  // And nothing else claims to be a named form of `edit`.
  for (const file of committedFiles()) {
    if (named.includes(file)) continue;
    assert.doesNotMatch(
      read(file), /under a shorter name/,
      `commands/${file} describes itself as a named form of edit but is not one`,
    );
  }
});

/**
 * **The asking flow, and the enums it offers.**
 *
 * Claude Code has no native picker — `argument-hint` is placeholder text on the
 * input line, not a control — so a command that wants the user to choose from a
 * fixed set presents a numbered list and waits. That is available because a
 * command runs through the model.
 *
 * What this pins is that the offered values ARE the program's values: every
 * member of the enum appears, and nothing that is not a member does. The list
 * is generated from `src/core/mutate.ts` for exactly that reason, and this is
 * the check that a copy did not creep back in.
 */
test('the asking flows offer every value the program accepts, and no others', () => {
  const edit = read('edit.md');
  for (const severity of SEVERITIES) {
    assert.match(edit, new RegExp(`\\d\\. ${severity}\\b`), `edit.md must offer severity ${severity}`);
  }
  for (const status of STATUSES) {
    const offered = new RegExp(`\\d\\. ${status}\\b`).test(edit);
    // `superseded` is the one status `cmdEdit` refuses by name — a retirement
    // records its replacement in both directions — so offering it in a picker
    // would be offering a refusal. Asserted in both directions so that neither
    // the code's refusal nor this list can move alone.
    assert.equal(
      offered, status !== 'superseded',
      status === 'superseded'
        ? 'edit.md must NOT offer `superseded`: `mycontext edit --status superseded` is refused'
        : `edit.md must offer status ${status}`,
    );
  }

  const link = read('link.md');
  for (const relation of RELATION_TYPES) {
    assert.match(link, new RegExp(`\\d\\. ${relation}\\b`), `link.md must offer ${relation}`);
  }
  // `supersedes` IS in RELATION_TYPES and is nonetheless refused by `linkItems`
  // by name, so the file has to say so rather than merely list it.
  assert.match(link, /`supersedes` and `superseded_by` are \*\*not\*\* available here/);
  assert.doesNotMatch(link, /\d\. superseded_by/,
    'superseded_by is not in the vocabulary and must not appear as an option');

  // Not vacuous: a numbered list has to be present at all.
  assert.match(edit, /1\. /);
  assert.match(link, /1\. /);
});

/**
 * The write commands' shape, asserted here as text and PROVEN by execution in
 * `test/plugin/write-commands.test.ts`, which runs each dry run and checks it
 * previews, refuses and writes nothing. This half is the half that catches a
 * file quietly telling the model to run the `--yes` form.
 */
test('no command file puts a --yes invocation on the line the model is told to run', () => {
  // A STANDALONE invocation line — an indented line that is nothing but a
  // backticked command — is the shape every "run this" step in these files
  // takes, and is what a model executes. The `add-<type>` files also mention a
  // `--yes` invocation, inline in a sentence about what a shell would do
  // instead of the MCP tool; that is prose about an alternative route, not a
  // step, and it is deliberately left alone here rather than exempted by
  // filename, so the distinction being asserted is a shape rather than a list.
  const standalone = /^\s+`(node [^`]*)`\s*$/;
  let checked = 0;
  for (const file of committedFiles()) {
    for (const line of read(file).split('\n')) {
      const match = standalone.exec(line);
      if (!match) continue;
      checked++;
      assert.doesNotMatch(
        match[1], /--yes/,
        `commands/${file} gives the model a --yes invocation to run:\n  ${line.trim()}\n` +
        `Every gated command claims origin "human" and is on the recommended deny list. ` +
        `These files print the --yes form for the USER to type; they never make it the ` +
        `command in a step.`,
      );
    }
  }
  assert.ok(checked >= 10, `only ${checked} standalone invocations found — the pattern is stale`);
});

/**
 * The frontmatter block of a command file, between the opening `---` and the
 * closing one — what Claude Code hands to its YAML parser.
 */
function frontmatterBlock(file: string, text: string): string {
  assert.match(text, /^---\n/, `${file} starts with frontmatter`);
  const end = text.indexOf('\n---\n', 3);
  assert.ok(end > 0, `${file} has a closing frontmatter fence`);
  return text.slice(4, end + 1);
}

/**
 * This test used to check the frontmatter's SHAPE with three regexes —
 * `/^description: .+$/m`, `/^argument-hint: .+$/m`,
 * `/^disable-model-invocation: true$/m` — and passed on all 38 files while 19
 * of them carried `argument-hint: [--full|--short|--summary] [--json]`, which
 * is not valid YAML. `claude plugin validate .` rejected those 19 and said
 * what happens at runtime: the command "loads with empty metadata (all
 * frontmatter fields silently dropped)". A regex that matches the LINE cannot
 * see that, so it certified `disable-model-invocation: true` on files where
 * it never loaded — the repo's recurring defect (a declaration asserting a
 * property that is not in effect), inside the test written to prevent it.
 *
 * So this parses instead of matching, and asserts on the parsed VALUES.
 * `parseFrontmatter` (src/core/frontmatter.ts) is a subset parser, not YAML;
 * it is used here because it now rejects the broken form for the reason real
 * YAML does — `[a] [b]` is a flow sequence with a stray `]` and `[` inside a
 * plain scalar — and because a hyphenated key like `argument-hint` is a key
 * it accepts. Neither was true before this task: it silently produced the
 * one-element array `['--full|--short|--summary] [--json']`, and it threw on
 * every hyphenated key. Both were fixed with the generator, and
 * `test/core/frontmatter.test.ts` pins them.
 *
 * The real tool remains the authority: `claude --plugin-dir . plugin validate .`
 * is clean on this tree. This test is what runs in CI, where that tool is not.
 */
test('every command file has frontmatter that PARSES, and is user-only', () => {
  for (const file of [...committedFiles(), ...HAND_WRITTEN]) {
    const text = read(file);
    const fm = parseFrontmatter(frontmatterBlock(file, text));
    assert.equal(typeof fm.description, 'string', `${file}: description must parse as a string`);
    assert.ok((fm.description as string).length > 0, `${file}: description is empty`);
  }
  for (const file of committedFiles()) {
    const fm = parseFrontmatter(frontmatterBlock(file, read(file)));
    // User-triggered by construction: the model already has the eleven MCP
    // tools, which are strictly more capable than these prompts. Asserted as
    // the parsed boolean `true`, not as a line of text: the whole point of
    // this task is that the line was present and the value never loaded.
    assert.equal(
      fm['disable-model-invocation'], true,
      `${file}: disable-model-invocation must PARSE as boolean true`,
    );
    // A string, not a list. `[the decision in one sentence]` parses as a
    // one-element sequence — legal YAML, wrong type, and not the hint text.
    assert.equal(typeof fm['argument-hint'], 'string', `${file}: argument-hint must be a string`);
    assert.ok((fm['argument-hint'] as string).length > 0, `${file}: argument-hint is empty`);
  }
});

test('a generated hint or description containing YAML syntax still parses', () => {
  // `resolveConfig` validates a custom category's `tier` and `description`
  // but never its NAME, which is an arbitrary JSON key — and the name is what
  // the frontmatter's description and argument-hint are built from. A name
  // with a colon in it emitted `description: Capture a db: pooling in ...`:
  // the same defect as the shipped one, latent, one config file away.
  const nasty = generateCommands(resolveConfig({
    categories: { 'db: pooling # notes': { tier: 'rationale', description: 'Nasty name' } },
  }));
  const hits = nasty.filter((f) => f.file.includes('db: pooling'));
  assert.equal(hits.length, 2, 'the custom category gets its add- and list- commands');
  for (const { file, content } of hits) {
    const fm = parseFrontmatter(frontmatterBlock(file, content));
    assert.equal(typeof fm.description, 'string', `${file}: description survived quoting`);
    assert.match(fm.description as string, /db: pooling # notes/, `${file}: name kept intact`);
    assert.equal(fm['disable-model-invocation'], true, `${file}: the flag still parses`);
  }
});

test('no generated command uses a positional argument placeholder', () => {
  // `$N` is documented as `$ARGUMENTS[N]` with `$0` as the FIRST argument,
  // which inverts the older 1-based reading. A file that guessed wrong would
  // capture the wrong words silently, so the surface uses `$ARGUMENTS` only.
  for (const file of committedFiles()) {
    assert.doesNotMatch(read(file), /\$[0-9]/, `${file} uses a positional placeholder`);
    assert.match(read(file), /\$ARGUMENTS/, `${file} passes the user's words through`);
  }
});

test('every add-<type> command names its own category to create_item', () => {
  // A template bug that emitted the same `type` for every category would
  // still pass the set-equality test above: 34 files, all capturing
  // constraints.
  for (const category of enabled) {
    // `reference` is the one category with no `create_item` route, and its
    // command is checked below instead of here. A snapshot's body is a copy of
    // a file; `create_item` takes a body from its caller and cannot make that
    // copy, so a generated file telling the model to call it would be
    // instructing the exact stale-paste this category replaces. It is skipped
    // by NAME rather than by "does this file mention create_item", so a
    // template regression that silently dropped the tool call from some OTHER
    // category's file still fails here.
    if (category === 'reference') continue;
    const text = read(`add-${commandSlug(category)}.md`);
    assert.match(text, new RegExp(`type: "${category}"`), `add-${category}.md`);
    assert.match(text, /create_item/, `add-${category}.md calls the tool`);
  }
});

/**
 * The exception, asserted rather than assumed — both halves of it.
 *
 * A file that quietly grew a `create_item` instruction would be telling the
 * model to paste a file's contents into an item body, which is the failure
 * `reference` exists to remove; and a file that lost the `--file` invocation
 * would leave the one capture route for this category undocumented on the one
 * surface a user reaches for it by name.
 */
test('add-reference names the file capture route and no create_item call', () => {
  const text = read('add-reference.md');
  assert.match(text, /add reference "<title>" --file <path>/,
    'add-reference.md must name the only capture route a snapshot has');
  assert.doesNotMatch(text, /create_item` tool/,
    'a snapshot cannot be captured through create_item — its body is a copy of a file, ' +
    'and a body the caller composes is not one');
  assert.match(text, /Do not run it yourself/,
    '`mycontext add` claims origin "human", which is the claim an agent cannot make');
});

test('every list-<type> command lists its own category', () => {
  for (const category of enabled) {
    assert.match(
      read(`list-${commandSlug(category)}.md`),
      new RegExp(`list ${category} \\$ARGUMENTS`),
      `list-${category}.md`,
    );
  }
});

/**
 * The CLI fallback each `add-<type>.md` names, pulled out of the generated
 * text and split the way a shell would: `"..."` groups, everything else on
 * whitespace. Returns the argv AFTER `node "<CLI>"`, i.e. what `runCli` takes.
 */
function fallbackArgv(text: string): string[] {
  const line = text.split('\n').find((l) => l.includes('/src/cli/index.ts" add '));
  assert.ok(line, 'expected a fallback line naming the CLI `add` command');
  const rest = line!.slice(line!.indexOf('/src/cli/index.ts" add ') + '/src/cli/index.ts" '.length);
  // The invocation ends at the closing backtick; the prose after it must not
  // be parsed as arguments (it was, and every token of it joined the title).
  const end = rest.indexOf('`');
  assert.ok(end > 0, 'the fallback invocation must be closed on the same line');
  const command = rest.slice(0, end);
  const argv: string[] = [];
  // `<...>` placeholders are what the human is told to substitute; the test
  // substitutes them too, rather than asserting on the placeholder text.
  for (const [, quoted, bare] of command.matchAll(/"([^"]*)"|(\S+)/g)) {
    const token = quoted ?? bare;
    if (token === '`' || token === undefined) continue;
    argv.push(token.replace(/^`|`$/g, ''));
  }
  return argv.filter((t) => t !== '');
}

/** The file `<path>` stands for — created in the probe workspace by the test. */
const PROBE_FILE = 'probe-source.md';

function substitute(argv: string[], title: string): string[] {
  return argv.map((token) => {
    if (!token.startsWith('<') || !token.endsWith('>')) return token;
    if (token === '<title>') return title;
    if (token === '<glob>') return 'src/**';
    if (token === '<tag>') return 'probe';
    // `--file` takes a path to a real file, and a placeholder standing for one
    // has to resolve to a real file or the "run what the file says" contract
    // becomes "run what the file says, except the argument that reads a disk".
    if (token === '<path>') return PROBE_FILE;
    return 'Because the source said so.';
  });
}

/**
 * I2: the generated file used to assert BOTH that the capture "lands as a
 * **draft**" and that `mycontext add` was an equivalent fallback — while
 * `mycontext add` passes `origin: 'human'` and therefore lands ACTIVE. One
 * file, two opposite claims about the same capture, times every normative
 * category.
 *
 * This test does not compare the sentence to another copy of the sentence.
 * It takes the invocation the generated file tells a human to run, RUNS it,
 * and checks the resulting item against what that file's own words claim: the
 * flags must be accepted by the CLI, the item must exist, and its status must
 * be the one the text names. A generator that advertised `--observations`, or
 * dropped `--yes` from a normative fallback, or went back to claiming the
 * fallback lands a draft, fails here.
 */
test('the CLI fallback each add-<type> names does what that file says it does', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-fallback-'));
  runCli(['init'], cwd, () => {});
  // A file with Markdown headings in it, deliberately: a snapshot of one is
  // the case the storage format has to survive (`snapshotBody`), so the probe
  // must not be the easy case.
  writeFileSync(
    path.join(cwd, PROBE_FILE),
    ['# Probe', '', '## A section', '', '- a line', ''].join('\n'),
    'utf8',
  );

  try {
    for (const category of enabled) {
      const text = read(`add-${commandSlug(category)}.md`);
      const title = `Fallback probe for ${category}`;
      const argv = substitute(fallbackArgv(text), title);

      assert.equal(argv[0], 'add', `${category}: fallback is an \`add\` invocation`);
      assert.equal(argv[1], category, `${category}: fallback captures its own category`);

      let out = '';
      const code = runCli(argv, cwd, (s) => { out += s + '\n'; });
      assert.equal(code, 0, `${category}: the documented fallback failed — ${out}`);

      const { store } = openStore(resolveWorkspace(cwd));
      const item = store.all().find((i) => i.title === title);
      store.close();
      assert.ok(item, `${category}: the fallback created nothing`);

      // The claim under test: whichever status the file's own prose names for
      // the fallback route is the status the fallback actually produces.
      const normative = config.categories[category].tier === 'normative';
      assert.equal(item!.status, 'active', `${category}: the CLI route lands active`);
      assert.equal(
        /the\s+item\s+lands\s+\*\*active\*\*\s+rather\s+than\s+as\s+a\s+draft/s.test(text),
        normative,
        `${category}: a normative add-<type> must say the CLI route lands active, not a draft`,
      );
      assert.equal(
        argv.includes('--yes'), normative,
        `${category}: --yes belongs in the fallback exactly when the category is normative`,
      );
      // Whatever the file tells the human to pass must land. The flags differ
      // by category — `reference` is captured from a file and carries its WHY
      // as a note, everything else takes a body, a scope and a tag — so this
      // asserts on the argv the generated file actually names rather than on
      // one fixed flag set, which would make the check vacuous for the one
      // category whose invocation is different.
      assert.ok(item!.body.length > 0, `${category}: the body was dropped`);
      if (argv.includes('--scope')) {
        assert.deepEqual(item!.scope, ['src/**'], `${category}: --scope was dropped`);
      }
      if (argv.includes('--tags')) {
        assert.deepEqual(item!.tags, ['probe'], `${category}: --tags was dropped`);
      }
      if (argv.includes('--note')) {
        assert.deepEqual(
          item!.observations.map((o) => o.category), ['note'],
          `${category}: --note was dropped`,
        );
      }
      if (argv.includes('--file')) {
        // The whole claim of a `--file` capture: the item records where the
        // body came from, and the body is that file rather than anything the
        // caller composed.
        assert.equal(item!.sourceFile, PROBE_FILE, `${category}: --file recorded no source`);
        assert.match(item!.body, /^> # Probe$/m, `${category}: the body is not the file`);
      }
    }
  } finally {
    removeTree(cwd);
  }
});

test('no add-<type> claims the same capture both lands a draft and lands active', () => {
  // The two sentences may coexist only when each names its own route: the
  // draft claim is about `create_item`, the active claim about the CLI
  // fallback. What must never reappear is a draft claim with no route named
  // for the fallback beside it.
  for (const category of enabled) {
    const text = read(`add-${commandSlug(category)}.md`);
    if (!/lands as a \*\*draft\*\*/.test(text)) continue;
    assert.match(
      text, /lands \*\*active\*\* rather than as a draft/,
      `add-${category}.md claims a draft without saying the CLI fallback does not`,
    );
  }
});

test('the review command tells the model not to promote on the user\'s behalf', () => {
  // The gate this plugin rests on is "a human decided". A command surface
  // that promotes for them, on a "promote them all", removes exactly the act
  // it exists to preserve.
  const text = read('review.md');
  assert.match(text, /Do not promote or discard anything yourself/);
  assert.match(text, /promote them all/);
});
