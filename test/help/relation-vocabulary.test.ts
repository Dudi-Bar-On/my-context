/**
 * **The relation vocabulary reaches a reader, or this file fails.**
 *
 * The defect this pins is measured, not hypothetical. On 2026-09-02
 * `RELATION_TYPES` (`core/vocabulary.ts`) went from eight names to twelve —
 * `depends_on`, `caused_by`, `conflicts_with` and `amends` were added — and
 * `linkItems` accepted all twelve from that moment. But `link_items`'
 * `relation` argument was a bare string whose entire description was
 * `See mycontext_help("workflow")`, and the workflow topic's answer was a
 * HAND-TYPED table of nine rows that nobody updated. So the tool accepted four
 * values that no surface an agent or a user can read ever named, and the one
 * document it pointed at was wrong.
 *
 * Two mechanisms now stop that, and each has its own test below:
 *
 * 1. `link_items` declares `enum: RELATION_TYPES`, so `mycontext help tools`
 *    — which renders `{{TOOL_REFERENCE}}` from the LIVE `tools/list` schemas
 *    — prints every name automatically.
 * 2. `mycontext help workflow` renders `{{RELATION_TABLE}}` from
 *    `RELATION_TYPES` and `RELATION_MEANINGS` together, and REFUSES to render
 *    at all when the two disagree.
 *
 * **What happens when a thirteenth type is added.** Adding a name to
 * `RELATION_TYPES` alone reddens `relation table: every type has a meaning`
 * below AND makes `mycontext help workflow` throw for a real user, naming the
 * type with no sentence. Writing the sentence is what makes both go green, and
 * the name then appears in the `tools` topic with no further edit anywhere —
 * which is what `every relation type reaches mycontext help tools` holds.
 * There is no third step that could be forgotten, because there is no
 * hand-written copy left to forget.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { helpTopic, relationTable, toolReference } from '../../src/help/index.ts';
import { RELATION_MEANINGS, RELATION_TYPES } from '../../src/core/vocabulary.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { createRegistry } from '../../src/mcp/tools.ts';

const CONFIG = resolveConfig({});
const REPO = path.join(import.meta.dirname, '..', '..');

const WORKFLOW_SOURCE = readFileSync(
  path.join(REPO, 'src', 'help', 'topics', 'workflow.md'), 'utf8',
).replaceAll('\r\n', '\n');

/** The `link_items` definition as `tools/list` answers it. `createRegistry`'s
 * `cwd` is captured by the HANDLERS and never read by `list()`, so no
 * workspace is needed to read a schema. */
function linkItemsSchema(): Record<string, unknown> {
  const tool = createRegistry(REPO).list().find((t) => t.name === 'link_items');
  assert.ok(tool, 'link_items is not registered');
  const properties = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
  return properties.relation;
}

/* -------------------------------------------------------------------- *
 * The guarantee: a type in the vocabulary reaches the help.             *
 * -------------------------------------------------------------------- */

test('every relation type reaches mycontext help workflow', () => {
  const topic = helpTopic('workflow', CONFIG);
  for (const type of RELATION_TYPES) {
    assert.match(
      topic, new RegExp(`^\\| \`${type}\` \\| .+ \\|$`, 'm'),
      `${type} is in RELATION_TYPES but has no row in the workflow topic`,
    );
  }
  // Not vacuous: the table is present at all, and it is the generated one.
  assert.match(topic, /^\| Relation \| Meaning \|$/m);
  assert.equal(topic.includes('{{'), false, 'an unexpanded placeholder reached the reader');
});

test('every relation type reaches mycontext help tools, via the link_items enum', () => {
  const topic = helpTopic('tools', CONFIG);
  const line = topic.split('\n').find((l) => l.trimStart().startsWith('- `relation`'));
  assert.ok(line, 'the tools topic prints no `relation` argument for link_items');
  for (const type of RELATION_TYPES) {
    assert.ok(
      line.includes(`\`${type}\``),
      `${type} is in RELATION_TYPES but does not reach the tool reference: ${line}`,
    );
  }
});

/**
 * The property that makes the line above self-maintaining: the tool reference
 * reads the enum out of the schema, so a type added to `RELATION_TYPES`
 * arrives in the `tools` topic with no edit to any document.
 *
 * Rendered from an INVENTED tool rather than from the registry, on
 * `test/help/tools-topic.test.ts`'s terms: a test that only asserted the real
 * output could not tell a generated reference from a pasted one.
 */
test('the tool reference prints an enum it was never told about', () => {
  const rendered = toolReference([{
    name: 'zzz_probe',
    description: 'a tool invented by this test',
    inputSchema: {
      type: 'object',
      properties: { relation: { type: 'string', enum: ['zzz_only_here'] } },
      required: ['relation'],
    },
  }]);
  assert.match(rendered, /- `relation` — \*\*required\*\* — one of `zzz_only_here`/);
});

test('the link_items schema declares RELATION_TYPES itself, not a copy of it', () => {
  const relation = linkItemsSchema();
  assert.deepEqual(
    relation.enum, RELATION_TYPES,
    'link_items must advertise the vocabulary it gates on — a second spelling of a closed ' +
    'vocabulary is the defect this whole file exists to end',
  );
  // `supersedes` IS a member and is nonetheless refused by `linkItems` by
  // name, so the schema has to say so rather than merely list it — otherwise
  // the enum advertises a value that always throws.
  assert.match(String(relation.description), /supersede_item/);
  assert.match(String(relation.description), /superseded_by/);
});

/* -------------------------------------------------------------------- *
 * The refusal: names and meanings cannot disagree in silence.           *
 * -------------------------------------------------------------------- */

test('relation table: every type has a meaning, and every meaning has a type', () => {
  // The real pair, checked directly as well as through the renderer, so the
  // failure names the field rather than a rendering.
  for (const type of RELATION_TYPES) {
    assert.ok(
      Object.hasOwn(RELATION_MEANINGS, type),
      `${type} is in RELATION_TYPES with no sentence in RELATION_MEANINGS — link_items ` +
      'already accepts it, so until one is written the vocabulary a caller can read is ' +
      'smaller than the one it can write. Write the sentence in core/vocabulary.ts.',
    );
  }
  for (const type of Object.keys(RELATION_MEANINGS)) {
    assert.ok(
      RELATION_TYPES.includes(type),
      `${type} has a meaning but is not in RELATION_TYPES — link_items refuses it, so ` +
      'documenting it would advertise a value no caller can use.',
    );
  }
  assert.doesNotThrow(() => relationTable());
});

test('a type with no meaning stops the workflow topic rendering, and names itself', () => {
  assert.throws(
    () => relationTable([...RELATION_TYPES, 'zzz_new_edge'], RELATION_MEANINGS),
    /zzz_new_edge — write one sentence for each in RELATION_MEANINGS/,
  );
});

test('a meaning for a name outside the vocabulary is refused too', () => {
  assert.throws(
    () => relationTable(RELATION_TYPES, { ...RELATION_MEANINGS, zzz_retired_edge: 'gone' }),
    /zzz_retired_edge — link_items refuses these/,
  );
});

test('a meaning containing a pipe is refused rather than breaking the table', () => {
  assert.throws(
    () => relationTable(['a'], { a: 'one thing | another' }),
    /contains a "\|", which ends a cell/,
  );
});

/* -------------------------------------------------------------------- *
 * Generated, not written.                                              *
 * -------------------------------------------------------------------- */

test('workflow.md carries the token and no hand-typed vocabulary', () => {
  assert.equal(
    WORKFLOW_SOURCE.split('{{RELATION_TABLE}}').length - 1, 1,
    'workflow.md must carry {{RELATION_TABLE}} exactly once — the relation table is generated ' +
    'from RELATION_TYPES and RELATION_MEANINGS, and a second copy would be free to drift',
  );
  for (const type of RELATION_TYPES) {
    assert.doesNotMatch(
      WORKFLOW_SOURCE, new RegExp(`^\\| \`${type}\` \\|`, 'm'),
      `workflow.md has a hand-typed row for ${type}. That table went stale once already — ` +
      'nine rows against a vocabulary of twelve. Delete it; the token renders the real one.',
    );
  }
});

test('the rendered table follows RELATION_TYPES order, so it is derived from the list', () => {
  const meanings = { blocks: RELATION_MEANINGS.blocks, links_to: RELATION_MEANINGS.links_to };
  // The MEANINGS are declared `blocks` first and the TYPES ask for `links_to`
  // first, so a renderer walking the map instead of the list gets this wrong.
  const rows = relationTable(['links_to', 'blocks'], meanings).split('\n').slice(2);
  assert.deepEqual(rows.map((r) => r.split('`')[1]), ['links_to', 'blocks']);
});
