// @basis TASK-an-item-records-the-request-that-produced-it-in-the-owner-s,
// INV-markdown-is-the-source-of-truth, INV-nothing-is-dropped-silently
/**
 * **The door. `store/5` built the room and nobody cut the door.**
 *
 * `Item.request` has round-tripped since 2026-09-10, is outside the checksum
 * and outside the summary basis, and `test/core/request-field.test.ts` proves
 * every one of those absences. What did not exist was any way to WRITE one:
 * no flag on `add`, no flag on `edit`, nothing on the MCP surface, and 0 of
 * 1,098 items carrying a request as a result. This file is the four surfaces
 * that write it, and the one rule that governs all four.
 *
 * **THE RULE, and it is the reason this file is not just four happy paths: a
 * request is RECORDED or CLEARED, never rewritten.** `Item.request` argues it
 * — *"a correction is a NEW request, not a rewritten old one, and there is
 * nothing to gain from a surface that lets somebody improve what he actually
 * typed"* — and the owner's ruling of 2026-09-11 cut the door without
 * reversing that sentence. So an item with no request accepts one, an item
 * with one accepts the empty value that removes it, and an attempt to
 * overwrite one with different text is REFUSED at every surface, human and
 * agent alike. The refusal is the whole reason the door is safe to cut: the
 * field's value is that these are his words, and the failure that would cost
 * the most is a second writer quietly improving them.
 *
 * **The round trip is tested on the shapes an owner actually types**, not on a
 * sanitised sample: a two-paragraph prompt, a double quote, Hebrew (which the
 * owner writes), and a prompt four kilobytes long. Each is asserted BYTE for
 * byte off disk, because the only failure that matters here is silent: a
 * request that is stored slightly tidied still reads like a request.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { renderIndexLine, renderItemBlock } from '../../src/core/render-item.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * The owner's own words, mess and all — the sentence that produced the field,
 * reused here from `request-field.test.ts` for the reason that file gives: an
 * apostrophe nothing has cause to escape, `it's` for `its`, an em dash, and no
 * capital at the start. Any surface that tidies is visible against it.
 */
const OWNER_WORDS = 'the user request prompt in free text should be also documented in the item '
  + 'before it\'s body and summary created, it will ease the user understanding about what the '
  + 'rule or instruction or other item type is because it was written by it\'s own words — this '
  + 'property is for documentation only and should not be injected to the context.';

/** A token that cannot occur anywhere else in a rendered item. */
const CANARY = 'zzqx-door-canary-4471';

function sandbox(prefix: string): string {
  const cwd = mkdtempSync(path.join(tmpdir(), prefix));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

function itemOf(cwd: string, id: string): Item {
  const { store } = openStore(resolveWorkspace(cwd));
  const item = store.get(id);
  store.close();
  assert.ok(item, `no item ${id}`);
  return item;
}

function fileOf(cwd: string, id: string): string {
  const ws = resolveWorkspace(cwd);
  return readFileSync(path.join(ws.projectRoot!, itemOf(cwd, id).filePath), 'utf8');
}

/** One rule, captured through the CLI the way a person captures one. */
function addRule(cwd: string, extra: string[] = []): { code: number; out: string } {
  return run([
    'add', 'rule', 'Do not log customer email',
    '--body', 'Secrets in logs outlive the incident.',
    '--summary', 'Customer email addresses must never be written to a log.',
    ...extra, '--yes',
  ], cwd);
}

const RULE_ID = 'RULE-do-not-log-customer-email';

/* -------------------------------------------------------------------------- *
 * 1. `mycontext add --request` — the capture door.
 * -------------------------------------------------------------------------- */

test('add --request stores the request verbatim, in the file and in the index', () => {
  const cwd = sandbox('myctx-req-add-');
  try {
    assert.equal(addRule(cwd, ['--request', OWNER_WORDS]).code, 0);
    assert.equal(itemOf(cwd, RULE_ID).request, OWNER_WORDS);
    assert.ok(
      fileOf(cwd, RULE_ID).includes(`## Request\n\n${OWNER_WORDS}\n`),
      'the file must carry the request under its own heading, unedited',
    );
  } finally { removeTree(cwd); }
});

test('add without --request leaves no request, and that is not a defect', () => {
  const cwd = sandbox('myctx-req-none-');
  try {
    assert.equal(addRule(cwd).code, 0);
    assert.equal(itemOf(cwd, RULE_ID).request, undefined);
    assert.ok(!fileOf(cwd, RULE_ID).includes('## Request'));
  } finally { removeTree(cwd); }
});

/**
 * **The four shapes an owner types, each asserted off disk byte for byte.**
 *
 * Every one is a different way a store can be subtly wrong and still look
 * right: a paragraph break is what a frontmatter scalar could not have held; a
 * double quote is what an escaper reaches for; Hebrew is what the owner writes
 * and is where a byte-vs-character mistake shows; and four kilobytes is where
 * a truncation would hide. They are one test with four cases rather than four
 * tests, because the assertion is identical and the failure names its own case.
 */
test('a request survives a paragraph break, a quote, Hebrew and four kilobytes', () => {
  const cases: Record<string, string> = {
    newline: 'record the request that produced the item.\n\nverbatim, and never edited.',
    quote: 'he said "do not tidy it" and meant the quotation marks too',
    hebrew: 'תתעד את הבקשה של המשתמש במילים שלו, בלי לתקן ובלי לקצר.',
    long: `${'the owner typed a very long prompt. '.repeat(120)}end.`,
  };
  for (const [name, request] of Object.entries(cases)) {
    const cwd = sandbox(`myctx-req-${name}-`);
    try {
      assert.equal(addRule(cwd, ['--request', request]).code, 0, `${name}: capture failed`);
      assert.equal(itemOf(cwd, RULE_ID).request, request, `${name}: not stored verbatim`);
      assert.ok(
        fileOf(cwd, RULE_ID).includes(`\n## Request\n\n${request}\n`),
        `${name}: the bytes on disk are not the bytes that were typed`,
      );
    } finally { removeTree(cwd); }
  }
});

test('a request carrying a Markdown heading is refused, and nothing is captured', () => {
  const cwd = sandbox('myctx-req-heading-');
  try {
    const result = addRule(cwd, ['--request', 'fix this\n## and this\nthanks']);
    assert.equal(result.code, 1);
    assert.match(result.out, /starts with a Markdown heading/);
    // **Refused BEFORE the confirmation, not after it.** `createItem` refuses
    // the same text at the shared write boundary, so without this line the test
    // would pass whether or not `cmdAdd` checks early — and the whole point of
    // checking early is that a human is not shown "about to create … governing
    // this project at once" and told only after answering that the request was
    // never storable.
    assert.ok(
      !result.out.includes('about to create'),
      'a request that cannot be stored must be refused before the human is asked to approve',
    );
    const { store } = openStore(resolveWorkspace(cwd));
    const found = store.get(RULE_ID);
    store.close();
    assert.equal(found, null, 'the capture must not land when its request cannot be stored');
  } finally { removeTree(cwd); }
});

/* -------------------------------------------------------------------------- *
 * 2. `mycontext edit --request` — recording one, and clearing one.
 * -------------------------------------------------------------------------- */

test('edit --request records a request on an item that has none', () => {
  const cwd = sandbox('myctx-req-edit-');
  try {
    assert.equal(addRule(cwd).code, 0);
    assert.equal(run(['edit', RULE_ID, '--request', OWNER_WORDS, '--yes'], cwd).code, 0);
    assert.equal(itemOf(cwd, RULE_ID).request, OWNER_WORDS);
  } finally { removeTree(cwd); }
});

test('edit --request= clears it, and the file returns to the bytes it had before', () => {
  const cwd = sandbox('myctx-req-clear-');
  try {
    assert.equal(addRule(cwd).code, 0);
    const before = fileOf(cwd, RULE_ID);
    assert.equal(run(['edit', RULE_ID, '--request', OWNER_WORDS, '--yes'], cwd).code, 0);
    assert.notEqual(fileOf(cwd, RULE_ID), before, 'the request must have changed the file');
    assert.equal(run(['edit', RULE_ID, '--request=', '--yes'], cwd).code, 0);
    assert.equal(
      fileOf(cwd, RULE_ID), before,
      'clearing a request must restore the file byte for byte — the checksum never covered it',
    );
  } finally { removeTree(cwd); }
});

test('edit --request will not overwrite a request that is already recorded', () => {
  const cwd = sandbox('myctx-req-overwrite-');
  try {
    assert.equal(addRule(cwd, ['--request', OWNER_WORDS]).code, 0);
    const result = run(['edit', RULE_ID, '--request', 'a tidier version of what he said', '--yes'], cwd);
    assert.equal(result.code, 1);
    assert.match(result.out, /already records a request/);
    // **Refused before the preview**, for the reason the heading refusal above
    // is: `updateItem` refuses this same call at the shared boundary, so
    // without this line the test would pass whether or not `cmdEdit` checks
    // early — and a human would be shown a diff of the rewrite they are not
    // allowed to make, and asked to confirm it.
    assert.ok(
      !result.out.includes('about to edit'),
      'the refusal must come before the preview and the confirmation, not after them',
    );
    assert.equal(
      itemOf(cwd, RULE_ID).request, OWNER_WORDS,
      'the words on disk must be the ones that were recorded first',
    );
  } finally { removeTree(cwd); }
});

test('edit --request with the same words is a no-op, not a refusal', () => {
  const cwd = sandbox('myctx-req-echo-');
  try {
    assert.equal(addRule(cwd, ['--request', OWNER_WORDS]).code, 0);
    const result = run(['edit', RULE_ID, '--request', OWNER_WORDS, '--yes'], cwd);
    assert.equal(result.code, 0, 'an echo asserts nothing and must not be refused');
    assert.equal(itemOf(cwd, RULE_ID).request, OWNER_WORDS);
  } finally { removeTree(cwd); }
});

/* -------------------------------------------------------------------------- *
 * 3. The MCP surface — the path that matters most in practice.
 * -------------------------------------------------------------------------- */

test('create_item records a request, and update_item records one that is missing', () => {
  const cwd = sandbox('myctx-req-mcp-');
  try {
    const registry = createRegistry(cwd);
    registry.call('create_item', {
      type: 'rule', title: 'Do not log customer email',
      body: 'Secrets in logs outlive the incident.',
      summary: 'Customer email addresses must never be written to a log.',
      request: OWNER_WORDS,
    });
    assert.equal(itemOf(cwd, RULE_ID).request, OWNER_WORDS);

    registry.call('create_item', {
      type: 'note', title: 'A note with no request',
      body: 'Nobody asked for this in writing.',
      summary: 'A note that records something nobody asked for in words.',
    });
    const noteId = 'NOTE-a-note-with-no-request';
    assert.equal(itemOf(cwd, noteId).request, undefined);
    createRegistry(cwd).call('update_item', { id: noteId, request: OWNER_WORDS });
    assert.equal(itemOf(cwd, noteId).request, OWNER_WORDS);
  } finally { removeTree(cwd); }
});

test('update_item refuses to rewrite a request an item already carries', () => {
  const cwd = sandbox('myctx-req-mcp-over-');
  try {
    const registry = createRegistry(cwd);
    registry.call('create_item', {
      type: 'note', title: 'A note with a request',
      body: 'He asked for this one in writing.',
      summary: 'A note recording something the owner asked for in writing.',
      request: OWNER_WORDS,
    });
    const noteId = 'NOTE-a-note-with-a-request';
    assert.throws(
      () => createRegistry(cwd).call('update_item', { id: noteId, request: 'tidied up' }),
      /already records a request/,
    );
    assert.equal(itemOf(cwd, noteId).request, OWNER_WORDS);
  } finally { removeTree(cwd); }
});

/**
 * **The mixed call, on the one policy setting where it can go wrong.**
 *
 * `request` is classified `documentation` in `UPDATE_FIELD_POLICY` — a class
 * added for it, because it reaches no injected surface and no decision — and a
 * documentation field is neither staged for review nor refused by a guard. That
 * leaves exactly one hole to close: on a category set to `agentEdits: "review"`,
 * an agent call carrying a body AND a request would stage the body for a human
 * and apply the request at once, which is `updateItem`'s "applied by halves"
 * failure — a success message over an item in a state nobody asked for.
 * `nonContentChanges` reads the documentation class as well as the gated one,
 * so the call is refused whole.
 */
test('an agent call mixing a body with a request is refused, never applied by halves', () => {
  const cwd = sandbox('myctx-req-mixed-');
  try {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { note: { agentEdits: 'review' } } }, null, 2),
    );
    const registry = createRegistry(cwd);
    registry.call('create_item', {
      type: 'note', title: 'A note an agent will try to edit',
      body: 'The first body.',
      summary: 'A note used to prove that a mixed agent edit is refused whole.',
    });
    const noteId = 'NOTE-a-note-an-agent-will-try-to-edit';
    assert.throws(
      () => createRegistry(cwd).call('update_item', {
        id: noteId, body: 'A second body.', summary: 'A second sentence about this note.',
        request: OWNER_WORDS,
      }),
      /request/,
      'a call that stages the body and applies the request is refused, and the refusal names it',
    );
    const after = itemOf(cwd, noteId);
    assert.equal(after.request, undefined, 'nothing may be applied by a refused call');
    assert.equal(after.body, 'The first body.');
  } finally { removeTree(cwd); }
});

/* -------------------------------------------------------------------------- *
 * 4. What the new doors must NOT have changed.
 * -------------------------------------------------------------------------- */

/**
 * `request-field.test.ts` proves the absence for a request planted through
 * `createItem` directly. This asserts it again for one that arrived through the
 * flag a person types, because the structural claim is about the item and the
 * new surfaces are what a future reader will suspect.
 */
test('a request written through the new doors still reaches no injected surface', () => {
  const cwd = sandbox('myctx-req-inject-');
  try {
    assert.equal(addRule(cwd, ['--request', `${OWNER_WORDS} ${CANARY}`]).code, 0);
    const item = itemOf(cwd, RULE_ID);
    assert.ok(item.request!.includes(CANARY), 'the canary must be stored, or this proves nothing');
    assert.ok(!renderItemBlock(item).includes(CANARY), 'a request must never be injected in full');
    assert.ok(!renderIndexLine(item).includes(CANARY), 'a request must never reach the index line');
  } finally { removeTree(cwd); }
});

test('the audit log names the request field when one is recorded', () => {
  const cwd = sandbox('myctx-req-audit-');
  try {
    assert.equal(addRule(cwd).code, 0);
    assert.equal(run(['edit', RULE_ID, '--request', OWNER_WORDS, '--yes'], cwd).code, 0);
    const ws = resolveWorkspace(cwd);
    const dir = path.join(ws.projectRoot!, '.audit');
    const text = readdirSync(dir).filter((n) => n.endsWith('.jsonl'))
      .map((n) => readFileSync(path.join(dir, n), 'utf8')).join('');
    assert.match(text, /"fields":\["request"\]/);
  } finally { removeTree(cwd); }
});
