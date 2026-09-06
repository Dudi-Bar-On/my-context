import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';
import { RELATION_TYPES } from '../../src/core/relations.ts';
import { SEVERITIES, STATUSES } from '../../src/core/validate.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseFrontmatter } from '../../src/core/frontmatter.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { commandSlug, generateCommands } from '../../src/plugin/commands.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox } from '../helpers/workspace.ts';
import { filesToRemove, KEEP } from '../../scripts/gen-commands.ts';

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
const HAND_WRITTEN = new Set(['LoadMyContext.md', 'session-name.md', 'session-carry.md']);

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

// --- The drift guard, Task 16's own reason for being IN --------------------
//
// Two hand-kept lists of the same set — `scripts/gen-commands.ts`'s `KEEP`
// and this file's `HAND_WRITTEN` — is the defect class this project keeps
// re-finding. Measured 2026-09-03: this assertion had never been written,
// so `HAND_WRITTEN` could gain an entry `KEEP` never heard of (or the
// reverse) and nothing here would notice until a real hand-written command
// was deleted by `npm run gen:commands`.

test('the generator\'s KEEP and this file\'s HAND_WRITTEN name exactly the same files', () => {
  assert.deepEqual(
    [...KEEP].sort(), [...HAND_WRITTEN].sort(),
    'scripts/gen-commands.ts KEEP and test/plugin/commands.test.ts HAND_WRITTEN have drifted apart — ' +
    'a file in one and not the other is either deleted by the generator or wrongly excused by the ' +
    'parity test above',
  );
});

test('the drift guard actually stops a deletion, proven both ways', () => {
  // A directory holding one generated file and one hand-written one that the
  // generator, this run, does not want to produce (e.g. a category just
  // disabled, or — Task 16's own motivating case — a hand-written command
  // like `session-name.md` the generator has never heard of at all).
  const existing = ['add-rule.md', 'session-name.md'];
  const wanted = new Set(['add-rule.md']); // this run's generator output

  // WITHOUT the guard: prove the deletion actually happens. An empty `keep`
  // is exactly what `scripts/gen-commands.ts` would be if `KEEP` (or an
  // entry in it) did not exist — nothing here is asserting a guard fires
  // that was never given the chance to.
  assert.deepEqual(
    filesToRemove(existing, wanted, new Set()), ['session-name.md'],
    'without a guard entry, a hand-written command is deleted — this is the data-loss ' +
    'this task exists to prevent',
  );

  // WITH the guard: the same inputs, `session-name.md` named in `keep`, and
  // it must survive.
  assert.deepEqual(
    filesToRemove(existing, wanted, new Set(['session-name.md'])), [],
    'with the guard entry present, the hand-written command must not be deleted',
  );
});

test('every file KEEP actually names survives filesToRemove against the real generated set', () => {
  // The integration form of the same proof, against this run's real
  // generator output and the real `commands/` directory listing, so the
  // guard is proven over the thing it actually protects, not only a
  // fabricated fixture.
  const existing = [...committedFiles(), ...KEEP];
  const wanted = new Set(generated.map((f) => f.file));
  const removed = filesToRemove(existing, wanted, KEEP);
  for (const kept of KEEP) assert.equal(removed.includes(kept), false, `${kept} would be deleted`);
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
  'add.md', 'audit.md', 'decay.md', 'discard.md', 'doctor.md', 'edit.md', 'harden.md',
  'handover.md', 'inbox-promote.md', 'ingest.md',
  'focus.md', 'lesson-stage.md', 'lesson.md', 'link.md', 'pin.md', 'procedure.md', 'promote.md',
  'query.md', 'ready.md',
  'refresh.md', 'review.md', 'search.md', 'show.md', 'soften.md', 'status.md',
  'supersede.md', 'todo.md', 'ui.md', 'unlink.md', 'unpin.md',
];

test('the generic, non-per-category commands are exactly the expected set', () => {
  const committed = committedFiles();
  const generic = committed.filter((f) => !f.startsWith('add-') && !f.startsWith('list-')).sort();
  assert.deepEqual(generic, [...GENERIC].sort());
});

/**
 * **The generic capture, and why the partition above must not swallow it.**
 *
 * `add.md` is the one capture command with no category in its name, and it
 * exists because the per-category files are generated at BUILD time from this
 * plugin's own defaults: a category a project defines in `config.json`, or one
 * a pack enables, gets no file and was therefore unreachable from the slash
 * surface entirely.
 *
 * `add.md` is deliberately not `add-.md`. Every counting test in this
 * repository partitions `commands/` on the `add-`/`list-` prefixes —
 * `test/docs/counts.test.ts`, `src/help/index.ts`'s `isPerCategory` — so a
 * generic command named with the per-category prefix would be counted as a
 * 25th category's command and reported as one in both READMEs.
 */
test('a generic add command exists and is not counted as a per-category one', () => {
  const files = generateCommands(resolveConfig({})).map((f) => f.file);
  assert.ok(files.includes('add.md'), 'the generic capture command is not generated');
  assert.equal(/^(add|list)-/.test('add.md'), false,
    'add.md must not carry the per-category prefix — every count in this repo splits on it');
  // It is generated from nothing, so it survives a config that switches a
  // category off. A per-category file would not.
  const off = resolveConfig({ categories: { standard: { enabled: false } } });
  assert.ok(generateCommands(off).map((f) => f.file).includes('add.md'));
});

/**
 * **A generic command that hardcodes a category is a per-category command with
 * the wrong name.** The whole value of this file is that the category is a
 * runtime argument, so it must name none of them as the thing being captured
 * and must point at the one list that is resolved per project.
 */
test('the generic add command names no category to capture, so a custom one is reachable', () => {
  const file = generateCommands(resolveConfig({})).find((f) => f.file === 'add.md');
  assert.ok(file, 'add.md is not generated');
  for (const name of enabled) {
    assert.doesNotMatch(
      file!.content, new RegExp(`add ${name}\\b`),
      `add.md captures \`${name}\` by name; a generic command that hardcodes a category is ` +
      `a per-category command with the wrong name`,
    );
  }
  // The category list it points at is the resolved one, printed by the program.
  assert.match(file!.content, /help categories/,
    'add.md must send the reader to the catalogue as this project resolves it');
  // And the capture goes through the tool, not the human-facing CLI command:
  // `mycontext add` claims `origin: "human"` and creates a normative item
  // ACTIVE, which is the crossing §7 of the README is about.
  assert.match(file!.content, /`create_item` tool/, 'add.md must capture through the tool');
});

/**
 * **The gap, executed rather than described.**
 *
 * Everything above is text about a file. This runs the route that file names,
 * against a category this build has never heard of, and requires that it
 * captures — which is the whole claim of the task: a `config.json` category is
 * reachable from the slash surface, and it is reachable *only* this way,
 * because the per-category files are generated at build time and this one is
 * not among them.
 *
 * Both halves are asserted, so the test cannot pass by being about a category
 * the plugin already ships a file for.
 */
test('the route the generic add names captures a category no committed file covers', () => {
  const CUSTOM = 'deployment_note';
  assert.equal(
    Object.hasOwn(config.categories, CUSTOM), false,
    `${CUSTOM} is now a shipped category — this test needs one this build does not have`,
  );
  assert.equal(
    committedFiles().includes(`add-${commandSlug(CUSTOM)}.md`), false,
    'a committed per-category file already covers it, so this is not the gap it claims to be',
  );

  const box = sandbox({
    categories: { [CUSTOM]: { tier: 'rationale', description: 'How a deploy went' } },
  });
  try {
    // 1. The catalogue the generated file sends the reader to is this
    //    project's, not the one the plugin shipped.
    let table = '';
    runCli(['help', 'categories'], box.cwd, (s) => { table += `${s}\n`; });
    assert.match(table, new RegExp(`\`${CUSTOM}\``),
      '`mycontext help categories` does not name the project-defined category, so the ' +
      'generated file points the reader at a list that would not tell them it exists');

    // 2. The capture step itself, through the tool the file names.
    const created = createRegistry(box.cwd).call('create_item', { summary_omitted: true,
      type: CUSTOM, title: 'The July rollout needed a manual step', body: 'It did.',
    });
    assert.match(created, new RegExp(`items/${CUSTOM}/[A-Z]+-the-july-rollout-needed-a-manual-step`),
      `create_item did not file the capture under the project-defined category:\n${created}`);

    // 3. And the refusal the file promises for a name this project does NOT
    //    have: by name, with the catalogue listed, from the same one place.
    assert.throws(
      () => createRegistry(box.cwd).call('create_item', { summary_omitted: true, type: 'deployment_notes', title: 'x' }),
      (error: Error) => {
        assert.match(error.message, /"type" must be one of: /, 'the catalogue must be listed');
        assert.match(error.message, new RegExp(CUSTOM), 'the listed catalogue is this project\'s');
        assert.match(error.message, /You passed "deployment_notes"/, 'refused by name');
        return true;
      },
    );
  } finally {
    box.dispose();
  }
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

/**
 * **The omission that cost a detour, pinned so it cannot come back.**
 *
 * `lesson.md` used to say only this: "Do not run it yourself: `mycontext
 * lesson` claims `origin: "human"`, which is the one claim you cannot make."
 * Every word of that is true about the unflagged CLI command and the file
 * stopped there — so an agent that read it concluded it could not record a
 * lesson AT ALL, which is false: `create_item` on the MCP server has recorded
 * agent-origin lessons since it existed. That conclusion was reached, acted
 * on, and survived several exchanges before anyone checked.
 *
 * Three facts have to be in this file, and they are asserted separately so
 * that losing any ONE of them fails with its own name rather than as a diff
 * nobody reads. This is a text assertion and knows it: `test/cli/lesson.test.ts`
 * is what proves the behaviour the sentences describe, by reading the written
 * item off disk.
 */
test('lesson.md names all three recording routes and which one is strongest', () => {
  const text = read('lesson.md');

  // 1. The unflagged CLI command is still the user's, and still off limits.
  assert.match(
    text, /With no flag it claims `origin: "human"`, which is the\n   one claim you cannot make\./,
    'lesson.md must still say that `mycontext lesson` with no flag claims human origin',
  );

  // 2. There is a CLI spelling an agent MAY use, and what it lands as.
  assert.match(
    text, /lesson --agent "<the lesson in one sentence>"/,
    'lesson.md must name `mycontext lesson --agent` — the shell route that is honest',
  );
  assert.match(
    text, /`--agent` records `origin: "agent"`/,
    'lesson.md must say what --agent actually records',
  );
  assert.match(
    text, /lands \*\*active\*\* rather than as a draft/,
    'lesson.md must say a lesson lands active — it is rationale tier, so nothing demotes it',
  );

  // 3. The MCP tool does the same thing more strongly, and WHY it is stronger:
  //    the handler stamps the origin instead of the caller declaring it.
  assert.match(
    text, /`create_item` tool/,
    'lesson.md must name the MCP route it previously omitted entirely',
  );
  assert.match(
    text, /stamps `origin: "agent"` itself and refuses to take an\n     origin from the tool call/,
    'lesson.md must say WHY the tool is stronger than the flag — the handler stamps the ' +
    'origin, so the caller never declares it',
  );
  assert.match(
    text, /\*\*weaker\*\* than the tool: the flag\n     is self-declared/,
    'lesson.md must say plainly that the CLI flag is the weaker mechanism, or the next ' +
    'reader mistakes it for an enforcement',
  );
});

/**
 * The other half of the same sentence: `lesson-accept` is a **normative** act —
 * it creates a rule that governs this repository, and it is the approval gate
 * itself. No generated file may hand an agent an `--agent` spelling of it, and
 * the CLI refuses one by name (`test/cli/lesson.test.ts`). Enumerated over
 * every committed file rather than asserted about `lesson.md` alone, because a
 * surface checked in one place is a surface excluded from the agreement
 * everywhere else.
 */
test('no command file gives lesson-accept an --agent spelling', () => {
  for (const file of committedFiles()) {
    for (const line of read(file).split('\n')) {
      if (!line.includes('lesson-accept')) continue;
      assert.doesNotMatch(
        line, /--agent/,
        `commands/${file} attaches --agent to lesson-accept:\n  ${line.trim()}\n` +
        `Recording a lesson has an honest agent spelling; approving what it obliges does ` +
        `not, because that IS the approval gate.`,
      );
    }
  }
  // Not vacuous: the flag and the command both have to appear in this corpus
  // of files at all, or the loop above proves nothing.
  assert.ok(committedFiles().some((f) => read(f).includes('lesson --agent')),
    'no committed command file mentions `lesson --agent` — the pattern is stale');
  assert.ok(committedFiles().some((f) => read(f).includes('lesson-accept')),
    'no committed command file mentions `lesson-accept` — the pattern is stale');
});
