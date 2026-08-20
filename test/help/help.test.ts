import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HELP_TOPICS, captureTopicSource, categoryTable, exampleItem, exampleItemShort, helpTopic,
  toolDescriptions,
} from '../../src/help/index.ts';
import { CATEGORIES } from '../../src/core/categories.ts';
import { SCOPE_POLICIES, resolveConfig } from '../../src/core/config.ts';
import { validateBody } from '../../src/core/validate.ts';
import { parseItem } from '../../src/core/item.ts';
import { runCli } from '../../src/cli/index.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

/**
 * The two malformed-Tools-line tests below feed `toolDescriptions` a MODIFIED
 * COPY of capture.md's text. They must never write to the real file:
 * `src/help/topics/capture.md` is a tracked source file the shipped product
 * reads at runtime, `node --test` runs test files concurrently, and a
 * corrupted capture.md makes `createRegistry` throw — which is exactly how
 * this used to make unrelated tests (and their child processes) fail
 * intermittently. Appending keeps the bad line inside the trailing `## Tools`
 * section, which is where the parser must catch it.
 */
function captureWith(extra: string): string {
  return captureTopicSource() + extra;
}

/**
 * The topic list, pinned literally on purpose: `HELP_TOPICS` is what the CLI
 * banner, `helpTopic`'s refusal and the `mycontext_help` schema all read, so a
 * topic appearing or disappearing should be a decision somebody made and not a
 * diff nobody noticed. `cli` was added by the help-cli branch; the four before
 * it had no topic covering the CLI's own commands and flags, which cost three
 * wrong invocations in one session.
 */
test('there are exactly the five documented topics', () => {
  assert.deepEqual(
    [...HELP_TOPICS].sort(), ['capture', 'categories', 'cli', 'scope', 'workflow'],
  );
});

test('every topic renders with no unexpanded placeholders', () => {
  for (const topic of HELP_TOPICS) {
    const text = helpTopic(topic, CONFIG);
    assert.ok(text.length > 200, `${topic} is suspiciously short`);
    assert.equal(text.includes('{{'), false, `${topic} has an unexpanded placeholder`);
  }
});

test('the category table is generated from the config, not hand-written', () => {
  const table = categoryTable(CONFIG);
  assert.match(table, /`constraint`/);
  assert.match(table, /`lesson`/);
  assert.equal(/`policy`/.test(table), false, 'policy is disabled by default');
});

test('a custom category documents itself', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const text = helpTopic('categories', cfg);
  assert.match(text, /`sla`/);
  assert.match(text, /Latency target/);
});

test('a project tier override shows the overridden tier', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const rows = categoryTable(cfg).split('\n').filter((l) => l.includes('`edge_case`'));
  assert.equal(rows.length, 1);
  assert.match(rows[0], /normative/);
});

test('help("scope") is worked examples, not prose', () => {
  const text = helpTopic('scope', CONFIG);
  assert.match(text, /src\/db\/\*\*/);
  assert.match(text, /Too broad/i);
  assert.match(text, /Too narrow/i);
  const tableRows = text.split('\n').filter((l) => l.startsWith('| `') || l.startsWith('| "'));
  assert.ok(tableRows.length >= 8, `only ${tableRows.length} worked example rows`);
});

/**
 * The scope topic's central claim — "no scope means every file" — is the
 * DEFAULT policy and not a law: `categories.<name>.scopePolicy` has two other
 * settings, and one of them (`inert`) inverts it exactly. `scopeRequirementError`
 * (core/trust.ts) refuses a capture under `required` and sends the reader here
 * by name, so a topic silent on the key was answering a question with the
 * opposite of the truth for a project that had set it.
 *
 * Derived from `SCOPE_POLICIES` rather than from a list written here, so a
 * fourth policy reddens this instead of shipping undocumented.
 */
test('the scope topic names every scope policy the config accepts', () => {
  const text = helpTopic('scope', CONFIG);
  for (const policy of SCOPE_POLICIES) {
    assert.match(
      text, new RegExp(`\`${policy}\``),
      `mycontext help scope never mentions the "${policy}" scope policy, which a project can ` +
      `set on any category and which changes what an empty scope means. The refusal that ` +
      `enforces it cites this topic.`,
    );
  }
  assert.match(text, /scopePolicy/, 'the topic must name the config key itself, not only its values');
});

/**
 * `validateBody`'s refusal offers three routes for a body line that starts
 * with `#`, cites this topic by name, and the topic used to know about two of
 * them. The `## Steps` section is a field of the item — it is where an ordered
 * procedure's steps belong — and a reader following the refusal's own pointer
 * has to find it here.
 *
 * Asserted against the THROWN message rather than against the source file, and
 * in both directions: if steps ever stop being a route, the first assertion is
 * what goes red, and whoever removes them is told to correct the topic too.
 */
test('the capture topic covers every route the body-heading refusal offers', () => {
  let message = '';
  try {
    validateBody('# a heading');
    assert.fail('a body line starting with # is no longer refused');
  } catch (err) {
    message = (err as Error).message;
  }
  assert.match(message, /"## Steps" section/, 'the refusal no longer offers the steps route');
  assert.match(message, /mycontext_help\("capture"\)/, 'the refusal no longer cites this topic');
  assert.match(
    helpTopic('capture', CONFIG), /`## Steps` section/,
    'the refusal sends a reader to `mycontext_help("capture")` for a route the capture topic ' +
    'does not mention. Every route the refusal names has to be findable where it sends them.',
  );
});

test('an unknown topic is refused with the closest named', () => {
  assert.throws(
    () => helpTopic('categorys', CONFIG),
    /closest match is "categories"/,
  );
});

test('tool descriptions parse out of capture.md and are terse', () => {
  const descriptions = toolDescriptions();
  assert.ok(descriptions.create_item, 'create_item is undocumented');
  assert.ok(descriptions.ingest_document, 'the reserved tool is undocumented');
  for (const [name, text] of Object.entries(descriptions)) {
    assert.ok(text.length <= 200, `${name} description is ${text.length} chars`);
    assert.ok(text.length >= 20, `${name} description is too thin`);
  }
});

test('every tool description says when not to use it', () => {
  for (const [name, text] of Object.entries(toolDescriptions())) {
    assert.match(text, /Not for:/, `${name} does not say when not to use it`);
  }
});

test('a malformed tool name throws rather than being dropped silently', () => {
  const source = captureWith(
    '\n- `bad-name`: a tool name with a hyphen, which TOOL_LINE does not accept\n',
  );
  // Without the guard the bad line is simply skipped, so `toolDescriptions`
  // returns normally and this assertion fails.
  assert.throws(() => toolDescriptions(source), /my_context:.*does not match/);
});

test('a description wrapped onto a second line throws rather than being silently truncated', () => {
  const source = captureWith(
    '\n- `some_tool`: A description that wraps\n  onto a second line for readability.\n',
  );
  // Without the guard the continuation line is dropped and `some_tool` is
  // silently truncated to its first line, so no error is thrown.
  assert.throws(() => toolDescriptions(source), /my_context:.*does not match/);
  // And the truncation this guards against is real: the continuation text is
  // genuinely not part of what a non-throwing parse would return.
  assert.equal(source.includes('onto a second line for readability.'), true);
});

test('the tracked capture.md is never rewritten by these tests', () => {
  // The guard for the failure this replaced: a test that edits
  // src/help/topics/capture.md corrupts a source file other, concurrently
  // running test files read through createRegistry().
  assert.equal(
    captureTopicSource().includes('onto a second line for readability.'), false,
  );
  assert.ok(toolDescriptions().create_item);
});

test('there is no delete tool documented anywhere', () => {
  assert.equal(Object.keys(toolDescriptions()).some((n) => /delete|remove/.test(n)), false);
  for (const topic of HELP_TOPICS) {
    assert.equal(/delete_item/.test(helpTopic(topic, CONFIG)), false, topic);
  }
});

test('every enabled category has an example that parses back', () => {
  for (const category of Object.values(CONFIG.categories)) {
    if (!category.enabled) continue;
    const text = exampleItem(category.name, CONFIG);
    const item = parseItem(text, `items/${category.name}/x.md`, 'project');
    assert.equal(item.type, category.name, category.name);
    assert.ok(item.id.startsWith(`${category.prefix}-`), `${category.name}: ${item.id}`);
    assert.ok(item.title.length > 0, category.name);
  }
});

test('the constraint example round-trips observations, relations, scope, tags and extra', () => {
  const item = parseItem(
    exampleItem('constraint', CONFIG), 'items/constraint/x.md', 'project',
  );
  assert.deepEqual(item.scope, ['src/db/**', 'src/api/handlers/**']);
  assert.deepEqual(item.tags, ['database', 'performance']);
  assert.equal(item.severity, 'hard');
  assert.equal(item.observations.length, 1);
  assert.equal(item.observations[0].category, 'limit');
  assert.match(item.observations[0].text, /never exceed 20/);
  assert.deepEqual(item.observations[0].tags, ['database']);
  assert.equal(item.relations.length, 1);
  assert.deepEqual(item.relations[0], { type: 'derived_from', target: 'ADR-managed-postgres' });
  assert.match(item.body, /RDS permits 25 connections/);
});

test('the risk example round-trips its extra fields and relations', () => {
  const item = parseItem(exampleItem('risk', CONFIG), 'items/risk/x.md', 'project');
  assert.deepEqual(item.extra, { likelihood: 'medium', impact: 'high' });
  assert.equal(item.relations.length, 1);
  assert.deepEqual(
    item.relations[0], { type: 'mitigates', target: 'CONST-import-batch-size' },
  );
  assert.match(item.body, /no backoff today/);
});

/**
 * `--short` is what makes one specimen per category affordable in a document:
 * twenty full renderings is ~500 lines of near-identical YAML per README. The
 * budget is therefore the point of the feature, and it is asserted rather than
 * described — a short form that crept back up to the full frontmatter would
 * still pass every other check in this file.
 */
test('the short form of every enabled category is four to six lines', () => {
  for (const category of Object.values(CONFIG.categories)) {
    if (!category.enabled) continue;
    const short = exampleItemShort(category.name, CONFIG);
    const lines = short.split('\n');
    // A SNAPSHOT specimen (`reference`) gets a wider budget, and the reason is
    // the same one that sets the narrow budget for everything else: what the
    // block has to teach. Elsewhere the body is one or two sentences somebody
    // typed, and a longer one would be padding. Here the body is a quoted
    // FILE — the `> ` prefixes, the headings that survive them, and the fact
    // that the whole file is present rather than summarised are the format,
    // not decoration, and a one-line specimen would show none of it. Still
    // bounded, and still one block per category: eleven lines, not the ~25 of
    // the full rendering this form exists to avoid.
    const ceiling = lines.some((l) => l.startsWith('source_file: ')) ? 11 : 6;
    assert.ok(lines.length >= 4 && lines.length <= ceiling,
      `\`examples ${category.name} --short\` is ${lines.length} lines:\n${lines.join('\n')}`);
    assert.ok(exampleItemShort(category.name, CONFIG).length
      < exampleItem(category.name, CONFIG).length, `${category.name}: the short form is not `
      + `shorter than the full one`);
  }
});

test('the short form keeps the id, the title and the body, and drops the shared frontmatter', () => {
  const text = exampleItemShort('rule', CONFIG);
  assert.match(text, /^id: RULE-never-log-request-bodies-on-auth-endpoints$/m);
  assert.match(text, /^title: Never log request bodies on auth endpoints$/m);
  assert.match(text, /^Bodies carry passwords and reset tokens/m);
  for (const dropped of ['checksum', 'origin', 'status', 'source_file', 'valid_from', 'tags']) {
    assert.doesNotMatch(text, new RegExp(`^${dropped}:`, 'm'),
      `\`${dropped}\` is identical on every category's specimen and teaches nothing about ` +
      `this one; the full rendering is what shows the stored shape`);
    // Not vacuous: the full form does carry it.
    assert.match(exampleItem('rule', CONFIG), new RegExp(`^${dropped}:`, 'm'));
  }
});

/**
 * The category-specific fields are the whole reason the short form is worth
 * printing: they are the one part of the frontmatter that differs *because of*
 * the category. Every one the catalogue declares and a specimen populates has
 * to survive the cut.
 */
test('the short form keeps the fields only that category has', () => {
  const expected: Record<string, string[]> = {
    rule: ['directive: dont'],
    requirement: ['kind: functional'],
    risk: ['likelihood: medium', 'impact: high'],
    assumption: ['validate_by: '],
    constraint: ['severity: hard', 'observations: limit'],
    instruction: ['always: true'],
    adr: ['observations: driver, option, consequence'],
  };
  for (const [name, lines] of Object.entries(expected)) {
    const text = exampleItemShort(name, CONFIG);
    for (const line of lines) {
      assert.ok(text.includes(line), `\`examples ${name} --short\` does not carry "${line}":\n${text}`);
    }
  }
  // And the defaults are NOT printed where a specimen takes them, or the two
  // lines above would say nothing about the category.
  assert.doesNotMatch(exampleItemShort('decision', CONFIG), /severity|always/);
});

/**
 * The placeholder body in `seedFor` is for a category the catalogue has never
 * heard of. A BUILT-IN reaching it means the product ships filler under its own
 * name — which is what `mycontext examples policy` did ("Replace this body with
 * the real content and reason.") for the three categories Phase 3 removed. A
 * category added to the catalogue without a worked example fails here.
 */
test('no category in the catalogue falls back to the placeholder seed', () => {
  for (const name of Object.keys(CATEGORIES)) {
    assert.doesNotMatch(
      exampleItem(name, CONFIG), /Replace this body with the real content/,
      `\`mycontext examples ${name}\` prints the custom-category placeholder. Give it a real ` +
      `seed in SEEDS (src/help/index.ts) — a real title, a real body, and the fields that ` +
      `distinguish the category.`,
    );
  }
});

test('the three new categories carry the knowledge that distinguishes them', () => {
  // `runbook`'s value is the ORDERING, so the specimen has to be ordered steps
  // and not a paragraph — a runbook seed that reads like an `instruction`
  // would teach the wrong distinction in both READMEs, which print it.
  const runbook = exampleItemShort('runbook', CONFIG);
  for (const step of ['1. ', '2. ', '3. ']) assert.ok(runbook.includes(step), runbook);

  // `environment`'s is the DIFFERENCE between where the code runs, so all
  // three environments have to appear; a specimen naming one is a constraint.
  const environment = exampleItemShort('environment', CONFIG).toLowerCase();
  for (const where of ['local', 'staging', 'production']) {
    assert.ok(environment.includes(where), `${where} is missing:\n${environment}`);
  }

  // `known_issue`'s is that it EXPIRES, and the topic tells a reader to name
  // the condition that would make it false. The shipped specimen has to obey
  // the advice the same product gives.
  const known = exampleItemShort('known_issue', CONFIG);
  assert.match(known, /retire this item/i, known);
});

test('a custom category gets a usable example rather than an error', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const item = parseItem(exampleItem('sla', cfg), 'items/sla/x.md', 'project');
  assert.equal(item.type, 'sla');
});

test('an unknown example type is refused with the closest named', () => {
  assert.throws(() => exampleItem('constraints', CONFIG), /closest match is "constraint"/);
});

test('the CLI lists topics when help is given no argument', () => {
  // Asserts on text only cmdHelp emits — USAGE itself already interpolates
  // HELP_TOPICS, so matching against `out` for the topic names alone would
  // pass even if `help` were still short-circuited by the early guard before
  // ever reaching cmdHelp.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /help topics:/);
  assert.match(out, /e\.g\. mycontext help scope/);
  for (const topic of HELP_TOPICS) assert.match(out, new RegExp(topic));
  removeTree(cwd);
});

test('the CLI prints a topic and works outside a workspace', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help', 'scope'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /Too broad/i);
  removeTree(cwd);
});

test('the CLI rejects an unknown topic non-zero', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help', 'nonsense'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 1);
  assert.match(out, /must be one of/);
  removeTree(cwd);
});

test('the CLI prints an example item', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['examples', 'constraint'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /type: constraint/);
  removeTree(cwd);
});

test('the CLI prints the short form when asked for it', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['examples', 'constraint', '--short'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /^id: CONST-postgres-connection-pool-capped-at-20$/m);
  assert.doesNotMatch(out, /^checksum:/m, 'the full item was printed, flag ignored');
  removeTree(cwd);
});

/**
 * `examples` read `args[0]` and ignored everything after it, so
 * `mycontext examples rule --shrot` printed the full item and exited 0 — the
 * reader asked for the short form, was handed the long one, and was told
 * nothing. That is the accepted-and-ignored failure this project treats as the
 * one unacceptable one, and adding a flag to the command is what made it
 * reachable by a plausible typo.
 */
test('examples refuses an option it does not recognise', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['examples', 'rule', '--shrot'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 1, `\`examples rule --shrot\` exited ${code}. Output:\n${out}`);
  assert.match(out, /unknown option "--shrot"/);
  assert.doesNotMatch(out, /^id: RULE-/m, 'it printed an item anyway');
  removeTree(cwd);
});

test('examples with only a flag is a usage error, not a category named --short', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['examples', '--short'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext examples <category> \[--short\]/);
  removeTree(cwd);
});
