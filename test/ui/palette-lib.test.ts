/**
 * Pure browser-module logic for the palette, tested in Node. The DOM half of
 * the palette/work/configure screens has no test — the plan-1 limit (spec §6:
 * rendering is untestable without a browser dependency) applies unchanged.
 *
 * **The import form is a URL, not a relative specifier, and the plan is wrong
 * about this.** Task 9's step 1 writes `await import('../../src/ui/public/lib/
 * command.js')`. That runs green under `node --test` and fails
 * `npm run typecheck` three times over with TS7016 — `allowJs` is off and
 * `tsconfig.json`'s `include` is `.ts` only, so a resolved `.js` module is an
 * implicit `any` and `strict` refuses it. `strings-parity.test.ts` already met
 * this and already wrote down the answer (`strings-parity.test.ts` ·
 * `A URL specifier is what lets this` · ~38), including the second reason: a
 * URL is also the only form that survives a Windows path. This file uses it,
 * and states the module's shape at the boundary rather than inferring it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { CATEGORIES } from '../../src/core/categories.ts';
import { approvalBoundary, commandStrings, UNGATED } from '../helpers/approval-boundary.ts';
import { removeTree } from '../helpers/tmp.ts';

const LIB = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'lib');

/**
 * One browser module, loaded the way the browser loads it — same bytes, no
 * build step. The declared shape is deliberately loose where the module's own
 * contract is a RUNTIME refusal: `composeCommand` takes `unknown[]` because
 * refusing a non-string element is half of what it is for, and a signature of
 * `string[]` would make the test that proves the refusal unwritable.
 */
async function lib<T>(name: string): Promise<T> {
  const url = new URL(`file://${path.join(LIB, name).replaceAll('\\', '/')}`);
  return (await import(url.href)) as T;
}

interface CommandModule {
  quoteArg: (value: unknown) => string;
  composeCommand: (argv: unknown) => string;
}

const command = (): Promise<CommandModule> => lib<CommandModule>('command.js');

test('quoteArg leaves safe values bare and quotes the rest', async () => {
  const { quoteArg } = await command();
  assert.equal(quoteArg('RULE-x'), 'RULE-x');
  assert.equal(quoteArg('src/**,docs/**'), '"src/**,docs/**"'); // * is not in the safe set — the shell must not expand it
  assert.equal(quoteArg('two words'), '"two words"');
  assert.equal(quoteArg('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteArg('back\\slash'), '"back\\\\slash"');
});

test('a glob with * is quoted — the shell must not expand it', async () => {
  const { quoteArg } = await command();
  assert.equal(quoteArg('src/**'), '"src/**"');
});

test('composeCommand joins quoted argv and refuses garbage', async () => {
  const { composeCommand } = await command();
  assert.equal(
    composeCommand(['mycontext', 'review', 'promote-revision', 'RULE-x', '--revision', 'REV-abc', '--yes']),
    'mycontext review promote-revision RULE-x --revision REV-abc --yes',
  );
  assert.equal(
    composeCommand(['mycontext', 'add', 'rule', 'Two words', '--scope', 'src/**']),
    'mycontext add rule "Two words" --scope "src/**"',
  );
  assert.throws(() => composeCommand([]));
  assert.throws(() => composeCommand(['mycontext', undefined]));
});

/**
 * **The composed-not-executed rule, over the bytes rather than over intent.**
 *
 * Spec §2 is that the UI composes a write and NEVER runs one: what a human
 * settles from this page is a command string they paste into their own shell,
 * where their `permissions.deny` rules can still see it. `no-writes.test.ts`
 * proves that for the SERVER half — the set of write symbols bound under
 * `src/ui/` is exactly the one the owner ruled. Its scope is the `.ts` import
 * graph reached from `src/ui/server.ts`, so the browser modules in
 * `src/ui/public/lib/` are outside it entirely, and the composer is precisely
 * the code whose whole subject is a write. That gap is what this closes.
 *
 * Two halves, because either alone is defeated:
 *
 *   1. **No name here can run, send or navigate.** A composer that fetched its
 *      own composed string to an endpoint would satisfy every other test in
 *      this file — the argv would still be exactly right — and would void the
 *      user's deny rules, which is the §8 risk row stated as code.
 *   2. **Nothing here reaches outside this directory.** Half one is a byte
 *      scan, and a byte scan of a module that imports a helper proves nothing
 *      about the helper. So every specifier must resolve to a sibling `.js` in
 *      this same directory, which makes the scanned set closed under import.
 *
 * The forbidden names live HERE and are deliberately absent from the modules'
 * own comments: a scanner defeated by a file describing what the scanner looks
 * for is the failure `faint-usage.test.ts` records making on its first run.
 *
 * The scan is proved able to fail two ways: `CONTROL` below must trip every
 * single pattern, so a regex that silently stops matching is caught rather
 * than passing everything, and the file list must be non-empty, so a renamed
 * directory reports rather than trivially succeeding.
 */
const LIB_FILES = (): string[] =>
  readdirSync(LIB).filter((name) => name.endsWith('.js')).sort();

/**
 * The COMPOSING modules: the two entry points plus everything they import,
 * transitively. Derived, not listed — a third composer added tomorrow is
 * covered the moment something imports it.
 *
 * Scope matters as much as the scan. `lib/` is not "the composers" — it is
 * the browser's shared modules, and it already holds `sse.js`, a stream
 * parser whose docblock has to NAME `fetch` and `EventSource` to explain why
 * the page uses one and not the other. Scanning the whole directory read that
 * comment as a binding and failed. The claim this test makes is about the
 * modules that compose a write; the closure below is exactly those.
 */
const COMPOSER_ENTRIES = ['command.js', 'palette-defs.js'];

function composingModules(): string[] {
  const seen = new Set<string>();
  const queue = [...COMPOSER_ENTRIES];
  while (queue.length > 0) {
    const file = queue.shift() ?? '';
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(readFileSync(path.join(LIB, file), 'utf8'))) {
      if (spec.startsWith('./') && spec.endsWith('.js')) queue.push(spec.slice(2));
    }
  }
  return [...seen].sort();
}

const CANNOT_BIND: { name: string; pattern: RegExp }[] = [
  { name: 'fetch', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'EventSource', pattern: /\bEventSource\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'Worker', pattern: /\bWorker\b/ },
  { name: 'eval()', pattern: /\beval\s*\(/ },
  { name: 'new Function', pattern: /\bnew\s+Function\b/ },
  { name: 'dynamic import()', pattern: /\bimport\s*\(/ },
  { name: 'location', pattern: /\blocation\b/ },
  { name: 'open()', pattern: /\bopen\s*\(/ },
  { name: 'submit()', pattern: /\bsubmit\s*\(/ },
  { name: 'requestSubmit()', pattern: /\brequestSubmit\s*\(/ },
  { name: 'execCommand', pattern: /\bexecCommand\b/ },
  { name: 'postMessage', pattern: /\bpostMessage\b/ },
  { name: 'child_process', pattern: /child_process/ },
];

/** Every banned name in one string, so a pattern that stops matching is seen. */
const CONTROL = [
  'fetch(url)', 'new XMLHttpRequest()', 'new WebSocket(u)', 'new EventSource(u)',
  'navigator.sendBeacon(u)', 'new Worker(u)', 'eval(s)', 'new Function(s)',
  'import(s)', 'location.href = u', 'open(u)', 'form.submit()',
  'form.requestSubmit()', 'document.execCommand("copy")', 'target.postMessage(m)',
  "require('child_process')",
].join('\n');

/** `from '…'` and bare `import '…'`, which is the whole reach of an ES module. */
/**
 * `\b` is not enough in front of `from`, and the flag `--valid-from` is what
 * proved it: `{ name: 'valid-from', input: 'text' }` contains the bytes
 * `from', input: '`, and a word boundary matches after the `-` — so the
 * catalogue was reported as importing a module named `, input: `. The
 * lookbehind excludes the three ways `from` can be the tail of something that
 * is not the keyword: a hyphen or an identifier character before it, or a
 * quote (a string that merely ENDS in the word). Everything the keyword can
 * legitimately follow — a newline, a space, `}` after a named-import list — is
 * still matched.
 */
function specifiers(source: string): string[] {
  const found = [
    ...source.matchAll(/(?<![-'"\w$])from\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
  ];
  return found.map((m) => m[1]);
}

test('the composing modules bind nothing that can run, send or navigate', () => {
  const files = composingModules();
  assert.ok(files.length >= COMPOSER_ENTRIES.length,
    `the composer closure is smaller than its own entry points; the scan would pass vacuously`);
  for (const entry of COMPOSER_ENTRIES) {
    assert.ok(files.includes(entry), `${entry} is missing from the closure — it was renamed or removed`);
  }

  for (const { name, pattern } of CANNOT_BIND) {
    assert.match(CONTROL, pattern, `the pattern for ${name} no longer matches ${name} itself`);
  }

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(path.join(LIB, file), 'utf8');
    for (const { name, pattern } of CANNOT_BIND) {
      if (pattern.test(source)) offenders.push(`${file} binds ${name}`);
    }
  }
  assert.deepEqual(
    offenders, [],
    'a module that composes commands may not also be able to run one. If a screen needs to '
    + 'fetch, it does so in src/ui/public/screens/, against a READ endpoint — never from here.',
  );
});

test('the composing modules reach nothing outside their own directory', () => {
  const files = LIB_FILES();
  assert.ok(files.length > 0, `no browser modules found under ${LIB}`);

  // `CONTROL`'s move, for the reader below `specifiers`: the closure this
  // walks currently imports NOTHING, so an empty result here is the honest
  // answer and cannot distinguish "reaches outside nowhere" from "the regex
  // stopped matching". The regex is therefore asked about text that does
  // contain imports — including the two shapes the lookbehind must NOT read as
  // one.
  assert.deepEqual(
    specifiers([
      "import { a } from './b.js';",
      "import './side-effect.js';",
      "export { c } from '../outside.js';",
      // The one that actually bit: a flag whose NAME ends in "-from", so a
      // word boundary alone reads `from', input: '` as an import of
      // `, input: `. A string whose last WORD is "from" is beyond a byte scan
      // and is deliberately not claimed here.
      "const flag = { name: 'valid-from', input: 'text' };",
    ].join('\n')),
    ['./b.js', '../outside.js', './side-effect.js'],
    'the import scanner no longer reads the imports it is pointed at, or it reads a string ' +
    'ending in "from" as one. Either way the check below would pass over anything.',
  );

  const offenders: string[] = [];
  for (const file of composingModules()) {
    for (const spec of specifiers(readFileSync(path.join(LIB, file), 'utf8'))) {
      if (!spec.startsWith('./') || !spec.endsWith('.js') || !files.includes(spec.slice(2))) {
        offenders.push(`${file} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(
    offenders, [],
    'the byte scan above is only as good as the closure it runs over: a module that imports '
    + 'from outside this directory imports code nothing here has read.',
  );
});

// ─── Task 10: the command catalogue ────────────────────────────────────────

interface Field {
  name: string; required?: boolean; boolean?: boolean; joined?: boolean;
  options?: string[]; source?: string; input?: string;
}
interface Def {
  name: string; kind: 'write' | 'read'; base: string[];
  args: Field[]; flags: Field[];
  boundary?: boolean; ungated?: boolean;
  screen?: string; endpoint?: (values: Record<string, string>) => string;
}
interface DefsModule { PALETTE: Def[]; commandFor: (def: Def, values: Record<string, unknown>) => string[] }

const defs = (): Promise<DefsModule> => lib<DefsModule>('palette-defs.js');

test('commandFor builds the exact argv for representative commands', async () => {
  const { PALETTE, commandFor } = await defs();
  const { composeCommand } = await command();
  const byName = new Map(PALETTE.map((d) => [d.name, d]));

  assert.equal(
    composeCommand(commandFor(byName.get('review promote-revision')!,
      { id: 'RULE-x', revision: 'REV-abc', yes: true })),
    'mycontext review promote-revision RULE-x --revision REV-abc --yes',
  );
  assert.equal(
    composeCommand(commandFor(byName.get('add')!,
      { category: 'rule', title: 'Two words', scope: 'src/**', body: 'Body.', yes: true })),
    'mycontext add rule "Two words" --body Body. --scope "src/**" --yes',
  );
  assert.equal(
    composeCommand(commandFor(byName.get('supersede')!, { id: 'RULE-a', by: 'RULE-b' })),
    'mycontext supersede RULE-a --by RULE-b',
  );
  assert.throws(() => commandFor(byName.get('supersede')!, { id: 'RULE-a' })); // --by is required
});

/**
 * **The deny-rule check, derived — and why the plan's version is replaced.**
 *
 * Task 10 step 1 writes this test against fourteen deny prefixes transcribed
 * out of `README.md`. Written exactly as the plan gives it, against exactly
 * this catalogue, it PASSES — and it is wrong: the recipe the boundary
 * derivation produces today has **eighteen** command strings, and the four it
 * is missing (`inbox-promote`, `pack import`, `procedure activate`,
 * `procedure done`) are all commands that change what governs a project with
 * no human in the loop. A green test over a stale list is the exact failure
 * `test/helpers/approval-boundary.ts` was built to end — four surfaces each
 * kept the list by hand and all four went stale — and copying that list a
 * fifth time, into a test, would have re-created it one layer down.
 *
 * So the recipe is asked for, not remembered: `approvalBoundary().denyRequired`
 * probes the real argument parser for which command strings accept `--yes`,
 * adds the one member whose gate is ABSENT rather than weak, and adds the four
 * aliases that need rules of their own because a permission rule matches a
 * command STRING.
 *
 * Both directions are checked, because each catches a different mistake:
 *
 *   - **Forward.** A write this catalogue composes that no deny rule can match
 *     is a hole in the user's recipe, offered from the UI. Two exemptions,
 *     named and re-verified below rather than skipped by name.
 *   - **Reverse.** A boundary command the catalogue does NOT offer is a
 *     decision, and it must be a written one. `NOT_IN_PALETTE` accounts for
 *     every such command, so the day a new gated command ships this test goes
 *     red and someone chooses, rather than the palette silently lagging.
 */
const OFF_BOUNDARY: Record<string, string> = {
  ack: 'records that a PERSON read a doctor finding and ruled on it, anchored to the item as it '
    + 'stands. It writes into the item file and re-stamps its checksum, and it changes nothing '
    + 'about what the item SAYS or whether it governs — which is `cli/commands/ack.ts` own '
    + 'argument for why it is a verb rather than a flag on `edit`, whose gate is sized to a '
    + 'change that CAN move governance. It accepts no --yes and is absent from the shipped deny '
    + 'recipe, and the derivation agrees. Its real gate is stronger than a deny rule and is not '
    + 'a permission at all: `acknowledgeFinding` (core/mutate.ts) refuses any origin but '
    + '`human`, and this command is its only caller — there is deliberately no MCP tool.',
  rebuild: 'rewrites only the derived index (.index.db), which the README tells users they may '
    + 'delete and rebuild freely. It changes nothing about what governs, so it is on no deny '
    + 'list — and it is still COMPOSED rather than executed, like every other write here.',
  'lesson-discard': 'rejects a staged rule candidate. It settles a decision but creates no '
    + 'governing item, and it is absent from the shipped deny recipe.',
};

const NOT_IN_PALETTE: Record<string, string> = {
  'inbox-promote': 'promotes a todo or note into a normative category — a promotion, and this '
    + 'plan routes promotion through the Work screen\'s review queue where the diff is visible. '
    + 'A second, quieter promotion path in the palette is a design decision, not an omission.',
  'pack import': 'imports a pack from a path on disk. The palette\'s pickers are all corpus '
    + 'sources (items, categories, files, revisions, drafts, topics); there is no file-path '
    + 'picker and plan 2 gives packs no screen.',
  'procedure activate': 'procedure state, which plan 2 gives no screen and no picker source.',
  'procedure done': 'procedure state, which plan 2 gives no screen and no picker source.',
};

/** The command string a permission rule is written against: `base` less `mycontext`. */
const commandString = (def: Def): string => def.base.slice(1).join(' ');

test('every composed write needs a deny rule, and the recipe is derived rather than remembered', async () => {
  const { PALETTE } = await defs();
  const deny = new Set(approvalBoundary().denyRequired);
  const writes = PALETTE.filter((d) => d.kind === 'write');

  // Forward: nothing composed here escapes the recipe except by written name.
  const uncovered: string[] = [];
  for (const def of writes) {
    if (Object.hasOwn(OFF_BOUNDARY, def.name)) continue;
    if (!deny.has(commandString(def))) uncovered.push(def.name);
  }
  assert.deepEqual(uncovered, [], 'these composed writes match no deny rule the derivation knows');

  // The exemptions are re-verified, so one that stops being true fails here
  // rather than quietly excusing a command that HAS joined the boundary.
  const wrongly = Object.keys(OFF_BOUNDARY).filter((name) => deny.has(name));
  assert.deepEqual(
    wrongly, [],
    'a command exempted as off-the-boundary is now ON it. Drop its OFF_BOUNDARY entry.',
  );

  // Reverse: every boundary command is offered, or is accounted for in writing.
  const offered = new Set(writes.map(commandString));
  const missing = [...deny].filter((name) => !offered.has(name)).sort();
  assert.deepEqual(
    missing, Object.keys(NOT_IN_PALETTE).sort(),
    'the set of boundary commands this palette does not offer has changed. Add the new one to '
    + 'NOT_IN_PALETTE with the reason, or add it to the catalogue — do not let the palette lag '
    + 'the boundary in silence, which is how all four hand-kept copies of this list went stale.',
  );
});

/**
 * **`--yes` is shown, and where there is no `--yes` the def says so.**
 *
 * The boundary exists so that a human sees what they are approving. A def on
 * it that did not carry `--yes` would compose a command whose gate the user
 * then has to answer at a prompt they cannot see from this page; a def that
 * carried it while being off the boundary would advertise a flag the command
 * refuses. Both markings are derived from the same probe.
 *
 * `lesson-accept` is the member with nothing to show: it creates an `active`
 * rule with no `--yes` and no prompt of any kind, so it is marked `ungated`
 * and must NOT offer the flag. That is exactly the case a hand-marked boolean
 * would get wrong, which is why it is derived too.
 */
test('the boundary markings and the --yes flags are the ones the parser gives', async () => {
  const { PALETTE } = await defs();
  const { gated, boundary } = approvalBoundary();
  const writes = PALETTE.filter((d) => d.kind === 'write');
  const problems: string[] = [];

  for (const def of writes) {
    const name = commandString(def);
    const onBoundary = gated.has(name) || boundary.includes(name);
    const hasYes = def.flags.some((f) => f.name === 'yes');
    if (Boolean(def.boundary) !== onBoundary) {
      problems.push(`${def.name}: boundary=${Boolean(def.boundary)} but the parser says ${onBoundary}`);
    }
    if (gated.has(name) !== hasYes) {
      problems.push(`${def.name}: --yes offered=${hasYes} but the parser accepts it=${gated.has(name)}`);
    }
    if (Boolean(def.ungated) && hasYes) {
      problems.push(`${def.name}: marked ungated and yet offers --yes`);
    }
  }
  assert.deepEqual(problems, []);

  // Anti-vacuity in both directions: the loop must have seen both kinds.
  assert.ok(writes.some((d) => d.boundary), 'no def is on the boundary; the check ran over nothing');
  assert.ok(writes.some((d) => !d.boundary), 'every def is on the boundary; the check cannot fail');
  const ungated = writes.filter((d) => d.ungated).map((d) => d.name);
  assert.deepEqual(ungated, Object.keys(UNGATED), 'the ungated member is not the one the derivation names');
});

test('every read def names a screen or an endpoint — a read the UI cannot execute is not listed', async () => {
  const { PALETTE } = await defs();
  for (const def of PALETTE.filter((d) => d.kind === 'read')) {
    assert.ok(
      typeof def.screen === 'string' || typeof def.endpoint === 'function',
      `${def.name} is a read with no execution path`,
    );
  }
});

test('every def names a command string the CLI registry actually has', async () => {
  const { PALETTE } = await defs();
  const real = new Set(commandStrings());
  const unknown = PALETTE
    .filter((d) => !real.has(commandString(d)) || d.base[0] !== 'mycontext')
    .map((d) => `${d.name} -> ${d.base.join(' ')}`);
  assert.deepEqual(
    unknown, [],
    'a def names a command the registry does not register. The catalogue is checked against '
    + 'COMMANDS and the four SUBCOMMANDS exports, not against memory.',
  );
  // Anti-vacuity: the derived set must be a real one, not an empty set that
  // every membership test passes against.
  assert.ok(real.size > 20, `commandStrings() returned ${real.size} strings; the derivation is broken`);
});

/**
 * **The catalogue defers to the corpus for categories rather than copying it.**
 *
 * `CATEGORIES` has moved twice this year (21 → 24 built-ins, plus whatever a
 * project's config enables or disables), and a palette that spelled the names
 * would be a fifth hand-kept list. Every place a category is chosen therefore
 * names `source: 'categories'` — resolved at runtime from `/api/config` — and
 * this test fails if any def ever hardcodes the names instead.
 */
test('no def transcribes the category catalogue', async () => {
  const { PALETTE } = await defs();
  const names = new Set(Object.keys(CATEGORIES));
  assert.ok(names.size > 10, `CATEGORIES has ${names.size} entries; the derivation is broken`);

  const problems: string[] = [];
  for (const def of PALETTE) {
    for (const field of [...def.args, ...def.flags]) {
      const copied = (field.options ?? []).filter((option) => names.has(option));
      if (copied.length > 0) {
        problems.push(`${def.name}.${field.name} spells category names (${copied.join(', ')})`);
      }
    }
  }
  assert.deepEqual(
    problems, [],
    'use source: "categories" so the picker follows this project\'s enabled set.',
  );
  // The `add` positional and `search --type` are the two that must be pickers.
  const add = PALETTE.find((d) => d.name === 'add');
  assert.equal(add?.args.find((a) => a.name === 'category')?.source, 'categories');
  const search = PALETTE.find((d) => d.name === 'search');
  assert.equal(search?.flags.find((f) => f.name === 'type')?.source, 'categories');
});

// ─── the catalogue against the real argument parser ────────────────────────

const SENTINEL = '--zzz-not-a-flag-any-command-accepts';

/** A throwaway workspace and a `run` that never throws out of a test. */
function workspace(): { run: (argv: string[]) => string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-palette-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
  const run = (argv: string[]): string => {
    const lines: string[] = [];
    try {
      runCli(argv, dir, (s) => lines.push(s));
    } catch (err) {
      lines.push(`THREW: ${(err as Error).message}`);
    }
    return lines.join('\n');
  };
  return { run, dispose: () => removeTree(dir) };
}

const refuses = (text: string, flag: string): boolean =>
  text.includes(`unknown flag "${flag}"`) || text.includes(`unknown option "${flag}"`);

/**
 * Commands whose flag surface this probe cannot reach, each with the reason —
 * the same table `approval-boundary.ts` keeps, for the same reason: a probe's
 * negative answer is worthless without one. Every entry is re-checked, so a
 * command that grows flag validation has to be re-classified rather than
 * silently keeping an excuse it no longer needs.
 */
const NO_FLAG_PROBE: Record<string, string> = {
  rebuild: 're-indexes what is on disk and validates nothing — it runs even when handed the '
    + 'sentinel. It takes no flags, and the catalogue advertises none.',
};

/**
 * `lesson-accept` and `lesson-discard` were the other two rows, excused
 * because they "validate no flags at all" and failed on the missing staged
 * candidate first — so the sentinel was ACCEPTED and this probe would have
 * answered "accepts everything" for two WRITE entries in the catalogue.
 *
 * plan:builder seq:1c gave both a parser (`core/command-flags.ts`), so the
 * excuse is gone and the catalogue's four `lesson-accept` flags are now
 * checked against the real refusal rather than read out of the usage line the
 * command happened to print.
 */

/**
 * Flags the command accepts and the catalogue deliberately does NOT offer.
 * Named here so that leaving one out is a decision with a reason attached,
 * and adding one later means editing a test that states why it was left out.
 */
const FLAGS_NOT_OFFERED: Record<string, Record<string, string>> = {
  ack: {
    list: '--list prints what doctor reports on one item and what has been ruled on already, '
      + 'and it takes NO code operand — `ack <id> --list` is the whole form. This model composes '
      + 'one argv from a def whose `code` argument is REQUIRED, so offering the flag would '
      + 'compose `ack <id> <code> --list`, in which the code a reader chose is silently ignored: '
      + 'the command would print a report rather than record the ruling the line appears to '
      + 'make. It is also a READ in a write def, which is the same shape that keeps every '
      + '`kind: read` row out of a write def — and the Doctor screen already draws what it would '
      + 'print. When the palette offers it, it belongs as its own read entry rather than as a '
      + 'checkbox on this one, and this row must move rather than stand over the opposite.',
  },
  'review promote': {
    all: 'bulk promotion: --all --pack <name> settles every draft a pack imported in one '
      + 'confirmation. Promotion is a human act — both READMEs and the skill say an agent must '
      + 'never promote on a user\'s behalf — and turning the bulk form into a palette checkbox '
      + 'moves an unreviewed promotion closer to one click than the CLI puts it. That is a '
      + 'design decision about the approval boundary, not a convenience, and this task does '
      + 'not take it.',
    pack: 'the other half of --all; it means nothing on its own and the CLI says so.',
    source: 'the third part of the same bulk form, and it exists only when --pack is ambiguous: '
      + 'two packs that call themselves one name are two membership records, and --source names '
      + 'which of them to promote. It cannot be offered without --all and --pack, which are not '
      + 'offered, and offering it alone would compose a flag the command refuses.',
  },
  add: {
    // 2026-09-02: `mycontext add` began REFUSING without `--summary` (an item
    // created with none could never afterwards be asked for one), and the
    // palette composed `add` without it — a regression that handed the user a
    // command guaranteed to be refused. `--summary` is now offered below, so
    // its excuse row is gone; only its opt-out survives here.
    'summary-omitted': '--summary-omitted is the named opt-out on the CREATION gate: a capture '
      + 'carrying no --summary is refused, and this flag is how a person says the item should '
      + 'genuinely have none. It is not offered for the reason its edit-side sibling '
      + '--summary-unchanged already states: it must be a DELIBERATE act, and a checkbox sitting '
      + 'beside a title field is the least deliberate control there is. When the palette does '
      + 'offer it, it belongs beside the refusal it answers rather than in the flag list, and '
      + 'this row must move rather than stand over the opposite.',
  },
  edit: {
    summary: '--summary is a first-class field on every item as of the summary plan phase 1, and '
      + 'both `add` and `edit` accept it. The palette does not offer it YET, and the reason is '
      + 'lane rather than design: `src/ui/public/lib/palette-defs.js` belongs to the web shell, and '
      + 'phase 1 deliberately reaches no screen — the field, its staleness mechanism and the '
      + 'CLI/MCP surfaces are phase 1; every screen is phase 3. This row is an excuse with an '
      + 'expiry: the `excused && offered` branch below fails the moment the palette adds it, so '
      + 'phase 3 cannot leave this sentence standing over the opposite.',
    'summary-unchanged': '--summary-unchanged is the escape hatch on the summary gate: an edit '
      + 'that moves the body is refused without a new --summary, and this flag is how a person '
      + 'says the edit does not change what the item MEANS. It is not offered for the same lane '
      + 'reason --summary directly above is not — `palette-defs.js` belongs to the web shell — '
      + 'and for one of its own: it is a switch that must be a DELIBERATE act, and a checkbox '
      + 'sitting beside a body textarea is the least deliberate control there is. When the '
      + 'palette does offer it, it belongs beside the refusal it answers rather than in the '
      + 'flag list, and this row must move rather than stand over the opposite.',
    unlink: '--unlink <relation> <target> takes TWO operands. This model is one value per flag, '
      + 'so a def advertising it would compose `--unlink rel` and lose the target silently — '
      + 'the one failure the whole composed-and-shown design exists to prevent.',
  },
};

test('every advertised flag is accepted, and every accepted flag is advertised or named', async () => {
  const { PALETTE } = await defs();
  const ws = workspace();
  try {
    const unreachable: string[] = [];
    const problems: string[] = [];

    for (const def of PALETTE.filter((d) => d.kind === 'write')) {
      const argv = def.base.slice(1);
      const advertised = def.flags.map((f) => f.name);

      if (!refuses(ws.run([...argv, SENTINEL]), SENTINEL)) {
        unreachable.push(def.name);
        continue;
      }

      // The candidate universe is what the command's own refusal prints, plus
      // what the catalogue claims. Anything the command names and does not
      // accept is a flag of a sibling subcommand; anything it accepts and the
      // catalogue omits is drift.
      const printed = [...ws.run([...argv, SENTINEL]).matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]);
      const universe = [...new Set([...printed, ...advertised])].filter((f) => !f.startsWith('zzz'));

      for (const flag of universe) {
        const accepted = !refuses(ws.run([...argv, `--${flag}`]), `--${flag}`);
        const offered = advertised.includes(flag);
        const excused = Object.hasOwn(FLAGS_NOT_OFFERED[def.name] ?? {}, flag);
        if (offered && !accepted) problems.push(`${def.name}: advertises --${flag}, which it refuses`);
        if (accepted && !offered && !excused) problems.push(`${def.name}: accepts --${flag}, not offered`);
        if (excused && !accepted) problems.push(`${def.name}: --${flag} is excused but no longer accepted`);
        // An excused flag that IS offered means the written reason is now
        // false. Adding `--all --pack` to the palette has to move the reason
        // out of FLAGS_NOT_OFFERED, not leave it standing over the opposite.
        if (excused && offered) problems.push(`${def.name}: --${flag} is offered but still excused as not offered`);
      }
    }

    assert.deepEqual(
      problems, [],
      'the catalogue and the real parser disagree about a flag set. The plan\'s own text is the '
      + 'rule here: a def must never advertise a flag its command refuses.',
    );
    assert.deepEqual(
      unreachable.sort(), Object.keys(NO_FLAG_PROBE).sort(),
      'the set of catalogue commands whose flags this probe cannot reach has changed. Add the '
      + 'new one to NO_FLAG_PROBE with the reason, or drop the entry that is no longer true.',
    );

    // The one unreachable command that DOES advertise flags is checked against
    // the usage line it prints — a weaker channel than the parser, and the
    // only one it offers.
    const lesson = PALETTE.find((d) => d.name === 'lesson-accept');
    const usage = ws.run(['lesson-accept']);
    for (const flag of lesson?.flags.map((f) => f.name) ?? []) {
      assert.ok(usage.includes(`--${flag}`), `lesson-accept does not document --${flag}`);
    }
    assert.ok(!usage.includes('--yes'), 'lesson-accept has grown a --yes; it is no longer the ungated member');
  } finally {
    ws.dispose();
  }
});

/**
 * **Every argv this catalogue can compose is one the real parser accepts.**
 *
 * This is the check the others are scaffolding for. A composed command is
 * handed to a human to run; if the composer produces a string the CLI refuses,
 * the user finds out by pasting it into their own shell and reading an error.
 * So every def is composed with every flag it offers, one at a time, and the
 * result is fed to the real argument parser — the one that will read it for
 * real — with only PARSE refusals counted. Semantic failures ("no such item")
 * are expected and ignored: the ids are invented, and inventing a live draft
 * queue would test the corpus rather than the composer.
 *
 * One flag at a time rather than all together, so that mutually exclusive
 * pairs the CLI declares (`add --body` / `--file`) do not read as composition
 * faults. Choosing between them is the screen's job, not the catalogue's.
 */
const PARSE_REFUSALS = [
  'unknown flag "', 'unknown option "', 'unexpected argument', 'needs a value', 'THREW:',
];

/** A value that will parse for this field — shape matters, existence does not. */
function sample(field: Field): unknown {
  if (field.boolean) return true;
  if (field.options) return field.options[0];
  switch (field.name) {
    case 'category': return Object.keys(CATEGORIES)[0];
    case 'extra': return 'k=v';
    case 'tags': return 'a,b';
    case 'revision': return 'REV-abc';
    case 'by': return 'RULE-b';
    case 'id': return 'RULE-a';
    case 'key': return 'k';
    default: return field.input === 'glob' ? 'src/**' : 'a value';
  }
}

test('every argv the catalogue composes is one the real parser accepts', async () => {
  const { PALETTE, commandFor } = await defs();
  const ws = workspace();
  try {
    const problems: string[] = [];
    let composed = 0;

    for (const def of PALETTE.filter((d) => d.kind === 'write')) {
      const base: Record<string, unknown> = {};
      for (const arg of def.args) base[arg.name] = sample(arg);
      for (const flag of def.flags.filter((f) => f.required)) base[flag.name] = sample(flag);

      const variants = [{ ...base }, ...def.flags.map((flag) => ({ ...base, [flag.name]: sample(flag) }))];
      for (const values of variants) {
        const argv = commandFor(def, values);
        composed += 1;
        const output = ws.run(argv.slice(1));
        const refusal = PARSE_REFUSALS.find((marker) => output.includes(marker));
        if (refusal !== undefined) {
          problems.push(`${argv.join(' ')}\n    refused (${refusal}): ${output.split('\n')[0]}`);
        }
      }
    }

    assert.deepEqual(problems, [], 'the composer produced a command the CLI will not parse');
    assert.ok(composed > 40, `only ${composed} commands were composed; the sweep is not covering the catalogue`);

    // Aliveness: the same detector must catch a command that IS malformed —
    // `--always false` was the plan's own spelling, and the CLI refuses it.
    const control = ws.run(['edit', 'RULE-a', '--always', 'false']);
    assert.ok(
      PARSE_REFUSALS.some((marker) => control.includes(marker)),
      'the refusal detector no longer notices a refused command; the sweep above proves nothing',
    );
  } finally {
    ws.dispose();
  }
});

// ─── plan:builder seq:3 — the catalogue against the registry, BOTH ways ─────

/**
 * **The gate that makes the catalogue's coverage a claim rather than a hope.**
 *
 * `every def names a command string the CLI registry actually has` runs ONE
 * direction: a def that names a command nobody registers fails. The other
 * direction was unchecked, and it is the one that goes wrong silently — a
 * command the CLI has and the catalogue lacks is invisible, so the catalogue
 * falls behind the parser one shipped command at a time and every test stays
 * green. That is the drift `plan:builder` exists to end, measured four times
 * this week already (§7 of both READMEs, the deny block, the skill, and the
 * approval-boundary probe's hand-kept subcommanded list).
 *
 * So this test is written the way `KNOWN_GAPS` in `screen-parity` is: **an
 * unlisted gap is a regression, AND a closed entry must be deleted.** A
 * command string must be EITHER in the catalogue or named below with a reason,
 * never both and never neither. Adding an entry without removing its row here
 * fails; shipping a command without doing one or the other fails.
 *
 * **The count worth knowing.** The registry dispatches 39 COMMANDS, and five of
 * them dispatch again on a subcommand, so a permission rule — and a catalogue
 * entry — is written against one of 53 command STRINGS. `builder/3`'s title
 * says 38 and its body says the CLI registers 38; both are stale, and the
 * figure a reader of this test needs is neither: `commandStrings()` is derived
 * here on every run and nothing below is written down twice.
 */

/**
 * Command strings the catalogue WITHHOLDS, as a decision rather than a backlog.
 *
 * These three are the ones `plan:walk seq:108` measured. Of seven
 * `commandActions` call sites, five pass a catalogue id and get Execute; `proc`,
 * `port` and `packs` pass `id: null` and get Copy alone — and each of those
 * three screens gives the SAME first reason in its own words: the command it
 * composes is not in the catalogue, the client sends an id and never a command,
 * so there is nothing for the server to rebuild and nothing to execute.
 *
 * Adding these entries would therefore hand Execute to three screens as a side
 * effect of a coverage exercise. That is a decision about the approval boundary
 * and it is an open question with the owner, so it is not taken here. Each row
 * carries the screen's OWN second reason too, because two of the three survive
 * the catalogue gaining an entry and would still have to be answered.
 */
const WITHHELD: Record<string, string> = {
  'procedure done': 'proc.js composes this and passes `id: null`. Its second reason outlives a '
    + 'catalogue entry: the composed line carries no `--yes` because the confirmation prompt IS '
    + 'the human\'s decision ("active -> done stays yours"), and offering Execute would answer '
    + 'that prompt on their behalf.',
  export: 'port.js composes this and passes `id: null`. Its second reason outlives a catalogue '
    + 'entry too: the composed line is deliberately one argument short — `--out` arrives with no '
    + 'destination, because the CLI refuses to default one — so an Execute button on it could '
    + 'only refuse, or write somewhere the reader did not pick.',
  init: 'packs.js composes `init --pack <path>` and passes `id: null`. Here the omission is the '
    + 'ANSWER rather than a shortfall, in that screen\'s own words: `init` is the command run '
    + 'BEFORE there is a workspace for this UI to be served from, so there was never anything '
    + 'for the catalogue to carry.',
};

/**
 * Command strings the catalogue does not carry YET, each with the reason.
 *
 * Unlike `WITHHELD`, nothing here is a decision against an entry — it is the
 * measured distance between what the CLI dispatches and what the Composer
 * offers, named so that it cannot grow in silence. The owner ruled on
 * 2026-08-24 that the catalogue should cover all of them.
 *
 * **The reasons cluster into three, and only the third is real work on the
 * catalogue itself.** A `kind: 'read'` def must name a screen or an endpoint —
 * `every read def names a screen or an endpoint` is the test, and it is right:
 * a read the UI cannot execute is not a read, it is a command to copy. Most
 * rows below are that shape. A few are writes that would be entries today if
 * anybody had written them. And every row shares one consequence: `palette.js`
 * builds the Composer's picker from `PALETTE` itself, so closing a row changes
 * what a screen shows — which is a UI change, governed by the mockup and owed a
 * browser test that drives it.
 */
const UNCATALOGUED: Record<string, string> = {
  // `ack` stood here until 2026-09-03 and its row named the condition that
  // closed it: "a control that composed a usable line would have to be driven
  // by the doctor read model rather than by a flag declaration". `Finding.remedy`
  // (src/doctor/checks.ts) is that read model — every check declares whether a
  // person settles its finding — so the entry is in `PALETTE` and the row is
  // deleted rather than left standing over the opposite. `e2e/doctor-repairless.spec.ts`
  // is the browser test the row asked for.
  audit: 'a read with no execution path in this UI. `/api/audit` does not exist; the audit log '
    + 'reaches the browser through the Watch and Ask read models, which answer different '
    + 'questions.',
  examples: 'a read whose answer is an example item and its updatable surface. `mycontext help` '
    + 'is catalogued and reaches `#/learn`; this one has no screen of its own.',
  focus: 'a WRITE — it sets the injection focus for the whole project — and the one write in '
    + 'this list whose entry needs a design decision first: a focus is not addressed by an item '
    + 'id, so the def\'s `args` have no `source` any existing screen resolves.',
  'inbox-promote': 'a write on the approval boundary, and a straightforward entry. It is here '
    + 'rather than in the catalogue only because closing it changes the Composer picker.',
  ingest: 'a read that prints an extraction request for a model to answer. Its output is a '
    + 'protocol document, not a report a screen renders.',
  'ingest-apply': 'a write that reads its payload from a FILE or from stdin. Neither is '
    + 'composable by a form that produces one argv, which is the same shape that keeps '
    + '`lesson-stage` out.',
  'ingest-status': 'a read with no screen. The ingest sessions are not rendered anywhere in this '
    + 'UI yet.',
  lesson: 'a write, and the entry is straightforward. Held with the rest so that closing the '
    + 'Composer\'s gap is one reviewed change rather than nine.',
  'lesson-stage': 'a write whose payload is a FILE or stdin — see `ingest-apply`.',
  'pack import': 'a write on the approval boundary. `packs.js` already composes it, and its '
    + 'entry is straightforward; it is held with `init`, which the same screen composes, so that '
    + 'the two are settled together.',
  'pack list': 'a read the Packs screen already renders from `/api/packs`, so the entry would be '
    + 'a second route to a page that exists.',
  'procedure activate': 'a write the Procedures screen composes. Held with `procedure done`, '
    + 'which is WITHHELD: settling one subcommand of a screen\'s pair and not the other is how a '
    + 'screen ends up with Execute on half its buttons.',
  'procedure list': 'a read the Procedures screen already renders from `/api/procedures`.',
  'procedure show': 'a read already rendered from `/api/procedure/:id`.',
  'procedure step': 'a write, held with the other two `procedure` subcommands.',
  query: 'a read that takes SQL. Offering a text box that composes arbitrary SQL into a command '
    + 'line is a design decision about the Composer, not a missing row.',
  ready: 'a read with no screen. Readiness is derived per run and nothing in this UI renders it.',
  'review list': 'a read the Work screen already renders; `review revisions` is catalogued '
    + 'because the revision queue is the half that screen composes from.',
  'review show': 'a read of one queue entry, already rendered by the Work screen.',
  'session carry': 'a read of what a session leaves behind, with no screen.',
  'session list': 'a read the Sessions data reaches through `/api/sessions`.',
  'session name': 'a write, and a small one. Held with the rest.',
  'statusline install': 'a write, and the one pair in this list that is NOT on the approval '
    + 'boundary: it edits Claude Code\'s own settings.json and changes nothing that governs this '
    + 'project (see OUTSIDE_BOUNDARY in test/helpers/approval-boundary.ts). Composing an edit to '
    + 'a file outside the workspace is its own decision.',
  'statusline uninstall': 'the other half of install, and off the boundary for the same reason.',
  todo: 'a read with no screen of its own.',
  ui: 'the command that STARTS this server. A def for it would compose, inside the running UI, '
    + 'the line that launches the running UI.',
};

test('every command string is catalogued or named as a gap, in BOTH directions', async () => {
  const { PALETTE } = await defs();
  const catalogued = PALETTE.map((def) => commandString(def));
  const named = [...Object.keys(WITHHELD), ...Object.keys(UNCATALOGUED)];

  // Checked first, so the failure names the overlap rather than arriving as a
  // length mismatch in the comparison below. THIS is "a closed entry must be
  // deleted": a row that stays after its entry lands excuses a gap that is not
  // there any more, and the next reader believes it.
  const both = named.filter((command) => catalogued.includes(command)).sort();
  assert.deepEqual(
    both, [],
    'these command strings are IN the catalogue and still named as gaps. Delete the row — while ' +
    'it stands it is a written reason for an absence that has been closed.',
  );
  const twice = named.filter((c) => Object.hasOwn(WITHHELD, c) && Object.hasOwn(UNCATALOGUED, c));
  assert.deepEqual(twice, [], 'a command cannot be both withheld by decision and merely not yet done');

  const real = commandStrings();
  // Anti-vacuity, and the number is derived rather than asserted: a broken
  // derivation returns few strings and every membership test below would pass.
  assert.ok(real.length > 40, `commandStrings() returned ${real.length}; the derivation is broken`);

  assert.deepEqual(
    [...catalogued, ...named].sort(), [...real].sort(),
    'the catalogue and the registry do not partition the command strings between them. A ' +
    'command the CLI dispatches that is neither catalogued nor named here is the silent half ' +
    'of this drift: nothing offers it, nothing says why, and no test notices. A name here that ' +
    'the registry does not have is the other half — a reason for the absence of something that ' +
    'does not exist.',
  );

  const empty = Object.entries({ ...WITHHELD, ...UNCATALOGUED })
    .filter(([, reason]) => reason.trim() === '')
    .map(([command]) => command);
  assert.deepEqual(empty, [], 'a named gap with no reason is an unnamed gap with extra steps');
});

/**
 * The three WITHHELD rows are about a specific, measured consequence, so the
 * consequence is asserted rather than described: each is composed by a screen
 * that passes `id: null`, and each of those screens says so in its own source.
 *
 * If somebody catalogues one of them, the row above fails first. If somebody
 * changes a screen to pass an id, this fails — which is the Execute grant the
 * owner has an open question about, arriving as a red test rather than as a
 * button.
 */
test('the three withheld commands are still composed with no catalogue id', () => {
  const screens = path.resolve(import.meta.dirname, '../../src/ui/public/screens');
  for (const screen of ['proc.js', 'port.js', 'packs.js']) {
    const text = readFileSync(path.join(screens, screen), 'utf8');
    assert.match(
      text, /commandActions\(\{ argv, id: null/,
      `${screen} no longer composes with \`id: null\`. That is the Execute grant plan:walk ` +
      'seq:108 measured and the owner has an open question about — it is not a refactor.',
    );
  }
});
