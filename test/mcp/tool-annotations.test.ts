// @basis TASK-no-mcp-tool-carries-annotations-so-a-client-cannot-tell-a, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mcpsurface/2`: a client could not tell a read from a retirement.**
 *
 * Every `ToolAnnotations` default is the cautious one — `readOnlyHint` false,
 * `destructiveHint` TRUE, `openWorldHint` TRUE — so a tool that declared
 * nothing was not "undescribed", it was actively claiming to be a possibly
 * destructive, open-world write. All twenty-six claimed that, `get_item`
 * included.
 *
 * ── WHAT THIS FILE REFUSES TO DO ────────────────────────────────────────────
 *
 * It does not restate the table. A test listing which tools are read-only, next
 * to a source file listing which tools are read-only, is two copies of one
 * claim and catches nothing but a typo — and the second copy cannot be
 * superseded, which is the defect this repository spent a day measuring. So the
 * assertions here are of three kinds, none of them a copy:
 *
 *  1. STRUCTURAL — every tool declares, nothing relies on a default, and the
 *     fields that are meaningful only for writes appear only on writes.
 *  2. DERIVED — the CLI's own approval boundary is computed from the real
 *     argument parser (`test/helpers/approval-boundary.ts`), and no tool whose
 *     counterpart sits behind `--yes` may call itself read-only. Nothing
 *     hand-written on either side; the two surfaces are asked to agree.
 *  3. THE ITEM'S OWN EXAMPLE — `get_item` versus `supersede_item`, which is the
 *     pair the task names, told apart without parsing English.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../../src/mcp/protocol.ts';
import type { ToolDefinition } from '../../src/mcp/protocol.ts';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { TOOL_PARITY } from '../../src/plugin/parity.ts';
import { approvalBoundary } from '../helpers/approval-boundary.ts';

const tools = (): ToolDefinition[] => createRegistry(process.cwd()).list();
const byName = (): Map<string, ToolDefinition> => new Map(tools().map((t) => [t.name, t]));

test('every advertised tool carries annotations — no tool is described by silence', () => {
  const bare = tools().filter((t) => t.annotations === undefined);
  assert.deepEqual(bare.map((t) => t.name), []);
  assert.equal(tools().length, TOOL_NAMES.length);
  assert.equal(TOOL_NAMES.length > 0, true, 'an empty registry would pass everything below');
});

test('no tool leans on a default for the two hints that decide auto-approval', () => {
  // `readOnlyHint` and `openWorldHint` are the pair a host needs before it can
  // offer a read-only mode at all, and both have a default that would be wrong
  // for most of this surface. Declared explicitly, on every tool, or the
  // annotation block is decoration.
  for (const tool of tools()) {
    assert.equal(
      typeof tool.annotations.readOnlyHint, 'boolean',
      `${tool.name} does not say whether it is read-only`,
    );
    assert.equal(
      typeof tool.annotations.openWorldHint, 'boolean',
      `${tool.name} does not say whether its world is closed`,
    );
  }
});

test('the surface really does split, and neither side is empty', () => {
  // A table that marked everything read-only, or nothing, would satisfy every
  // structural assertion above and carry no information at all.
  const reads = tools().filter((t) => t.annotations.readOnlyHint === true);
  const writes = tools().filter((t) => t.annotations.readOnlyHint === false);
  assert.equal(reads.length + writes.length, tools().length);
  assert.equal(reads.length > 0, true, 'nothing on this surface claims to only read');
  assert.equal(writes.length > 0, true, 'nothing on this surface admits to writing');
});

test('destructiveHint and idempotentHint appear exactly where they mean something', () => {
  // The specification says of both: "This property is meaningful only when
  // `readOnlyHint == false`". A read carrying them is noise a client has to
  // decide whether to trust; a write missing them falls back to
  // destructiveHint TRUE, which is the over-warning that makes a confirmation
  // prompt worth ignoring.
  for (const tool of tools()) {
    const { readOnlyHint, destructiveHint, idempotentHint } = tool.annotations;
    if (readOnlyHint === true) {
      assert.equal(destructiveHint, undefined, `${tool.name} reads, but rates its destructiveness`);
      assert.equal(idempotentHint, undefined, `${tool.name} reads, but rates its idempotence`);
      continue;
    }
    assert.equal(typeof destructiveHint, 'boolean', `${tool.name} writes and does not say how`);
    assert.equal(typeof idempotentHint, 'boolean', `${tool.name} writes and does not say how`);
  }
});

test('no tool behind the CLI approval gate claims to be read-only', () => {
  /**
   * **The derived assertion, and the only one here that could catch a wrong
   * judgement rather than a missing field.**
   *
   * `approvalBoundary().gated` is computed by handing `--yes` to the real
   * argument parser for every command string the CLI dispatches — nothing is
   * listed by hand. `TOOL_PARITY` already names each tool's CLI counterpart
   * and is itself enforced in both directions by `test/plugin/parity.test.ts`.
   * So: if a person decided a command needs a human in the loop, the tool that
   * reaches the same code cannot be advertised to a host as safe to run
   * unattended.
   *
   * MATCHED EXACTLY, never by prefix. `review promote` is gated and bare
   * `review` is not, and `list_drafts` — whose counterpart is bare `review` —
   * genuinely only reads. A prefix match would have demanded that it call
   * itself a write, which is how a check like this starts lying.
   *
   * ONE DIRECTION ONLY, and the converse is deliberately not asserted: it is
   * false. `link_items` writes an edge and `mycontext link` takes no `--yes`,
   * because — parity.ts' own words — "recording a relation is the one write
   * with no trust boundary on it". A tool may write without being gated; it
   * may not be gated without writing.
   */
  const { gated } = approvalBoundary();
  const definitions = byName();

  const constrained = TOOL_PARITY
    .filter((row) => row.cli !== null && gated.has(row.cli))
    .map((row) => row.tool);

  // Without this, a renamed command or an empty boundary would leave the loop
  // below iterating over nothing and reporting green — the vacuous pass this
  // whole check exists to be the opposite of.
  assert.equal(
    constrained.length >= 5, true,
    `only ${constrained.length} tool(s) matched the approval boundary — the derivation has ` +
    `stopped finding them, so the assertion below is no longer testing anything`,
  );

  for (const name of constrained) {
    const tool = definitions.get(name);
    assert.notEqual(tool, undefined, `${name} is in TOOL_PARITY but not in the registry`);
    assert.equal(
      tool!.annotations.readOnlyHint, false,
      `${name} advertises readOnlyHint true, but its CLI counterpart is behind \`--yes\` — ` +
      `a host would auto-approve an act a person is asked to confirm`,
    );
  }
});

test('get_item and supersede_item are told apart without reading a word of English', () => {
  // The pair `mcpsurface/2` names. This is the whole consequence stated as one
  // assertion: a client sorting tools by behaviour gets these two into
  // different piles from the machine-readable block alone.
  const t = byName();
  const read = t.get('get_item')!.annotations;
  const retire = t.get('supersede_item')!.annotations;

  assert.equal(read.readOnlyHint, true);
  assert.equal(retire.readOnlyHint, false);
  assert.equal(retire.destructiveHint, true);
  assert.notDeepEqual(read, retire);
});

test('annotations reach the wire, not just the registry object', () => {
  // `tools/list` is where a client actually learns this. A registry that
  // carried annotations while the protocol layer dropped them on the floor
  // would satisfy every assertion above and change nothing for any caller.
  const result = createSession(createRegistry(process.cwd()))
    .handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })!.result as { tools: ToolDefinition[] };
  const wire = result.tools.find((t) => t.name === 'supersede_item')!;
  assert.equal(wire.annotations.destructiveHint, true);
  assert.equal(result.tools.every((t) => t.annotations !== undefined), true);
});

test('two tools sharing a shape do not share one mutable object', () => {
  // Four shapes serve twenty-six tools. If the constant itself were handed
  // out, a client — or a later handler — editing one tool's annotations would
  // silently re-describe every tool that answers to the same shape.
  const list = tools();
  const a = list.find((t) => t.name === 'get_item')!;
  const b = list.find((t) => t.name === 'query_items')!;
  assert.deepEqual(a.annotations, b.annotations, 'both are plain reads');
  assert.notEqual(a.annotations, b.annotations, 'but not the same object');
});
