import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
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

test('the generic, non-per-category commands are present', () => {
  for (const file of ['search.md', 'review.md', 'status.md']) {
    assert.ok(committedFiles().includes(file), `commands/${file}`);
  }
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
    const text = read(`add-${commandSlug(category)}.md`);
    assert.match(text, new RegExp(`type: "${category}"`), `add-${category}.md`);
    assert.match(text, /create_item/, `add-${category}.md calls the tool`);
  }
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

function substitute(argv: string[], title: string): string[] {
  return argv.map((token) => {
    if (!token.startsWith('<') || !token.endsWith('>')) return token;
    if (token === '<title>') return title;
    if (token === '<glob>') return 'src/**';
    if (token === '<tag>') return 'probe';
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
      // The body/scope/tags the file tells the human to pass must land.
      assert.ok(item!.body.length > 0, `${category}: --body was dropped`);
      assert.deepEqual(item!.scope, ['src/**'], `${category}: --scope was dropped`);
      assert.deepEqual(item!.tags, ['probe'], `${category}: --tags was dropped`);
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
