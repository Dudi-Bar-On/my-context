import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../../src/core/config.ts';
import { commandSlug, generateCommands } from '../../src/plugin/commands.ts';

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
  // policy, postmortem and taxonomy are off in the default profile, and
  // `resolveCategory` refuses them — a command for one would offer the user a
  // capture that cannot succeed.
  for (const disabled of ['policy', 'postmortem', 'taxonomy']) {
    assert.equal(config.categories[disabled].enabled, false, `${disabled} is disabled by default`);
    assert.equal(committedFiles().includes(`add-${disabled}.md`), false, `add-${disabled}.md exists`);
    assert.equal(committedFiles().includes(`list-${disabled}.md`), false, `list-${disabled}.md exists`);
  }
});

test('enabling a category is all it takes to get its commands — the generator reads the config', () => {
  // Drives the generator with a DIFFERENT config than the committed one, so a
  // generator that ignored its argument and hardcoded today's 17 categories
  // would fail here rather than passing every other test in this file.
  const full = generateCommands(resolveConfig({ profile: 'full' }));
  assert.ok(full.some((f) => f.file === 'add-policy.md'), 'policy is enabled by the full profile');
  assert.ok(full.some((f) => f.file === 'list-taxonomy.md'));

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

test('every command file is frontmatter-shaped and user-only', () => {
  for (const file of [...committedFiles(), ...HAND_WRITTEN]) {
    const text = read(file);
    assert.match(text, /^---\n/, `${file} starts with frontmatter`);
    assert.match(text, /^description: .+$/m, `${file} has a description`);
  }
  for (const file of committedFiles()) {
    // User-triggered by construction: the model already has the eleven MCP
    // tools, which are strictly more capable than these prompts.
    assert.match(read(file), /^disable-model-invocation: true$/m, file);
    assert.match(read(file), /^argument-hint: .+$/m, file);
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

test('the review command tells the model not to promote on the user\'s behalf', () => {
  // The gate this plugin rests on is "a human decided". A command surface
  // that promotes for them, on a "promote them all", removes exactly the act
  // it exists to preserve.
  const text = read('review.md');
  assert.match(text, /Do not promote or discard anything yourself/);
  assert.match(text, /promote them all/);
});
