import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HELP_TOPICS, captureTopicSource, categoryTable, exampleItem, helpTopic, toolDescriptions,
} from '../../src/help/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseItem } from '../../src/core/item.ts';
import { runCli } from '../../src/cli/index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
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

test('there are exactly the four documented topics', () => {
  assert.deepEqual([...HELP_TOPICS].sort(), ['capture', 'categories', 'scope', 'workflow']);
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

test('help("categories") states the adr versus decision boundary', () => {
  const text = helpTopic('categories', CONFIG);
  assert.match(text, /`adr` vs `decision`/);
});

test('help("scope") is worked examples, not prose', () => {
  const text = helpTopic('scope', CONFIG);
  assert.match(text, /src\/db\/\*\*/);
  assert.match(text, /Too broad/i);
  assert.match(text, /Too narrow/i);
  const tableRows = text.split('\n').filter((l) => l.startsWith('| `') || l.startsWith('| "'));
  assert.ok(tableRows.length >= 8, `only ${tableRows.length} worked example rows`);
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
