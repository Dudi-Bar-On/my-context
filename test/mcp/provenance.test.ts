/**
 * The two things an MCP answer now says about itself: which CODE produced it,
 * and which CORPUS it came out of.
 *
 * Both are pinned here because both were invisible on 2026-08-27 and both cost
 * a working day. The server's frozen modules reported `checksum mismatch` for
 * 719 of 736 healthy items and nothing said the process was an hour behind
 * disk; subagents were fed a nested 44-item corpus instead of the repository's
 * 736-item one and nothing named the root.
 *
 * The wording is asserted, not only the mechanism. A disclosure that fires
 * correctly and reads as an emergency is the failure it was built to prevent —
 * that is the whole shape of the outage, where 719 intact items were reported
 * as damaged — so the stale line is checked for what it must SAY and for what
 * it must not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stampCodeIdentity, type CodeIdentity } from '../../src/core/code-identity.ts';
import {
  corpusRootLine, nestedCorpusNote, resolveCorpus,
} from '../../src/core/corpus-identity.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { splitProvenance, staleCodeNote, toolResultProvenance } from '../../src/mcp/provenance.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/* -------------------------------------------------------------------------- *
 * A stand-in for the MCP server's scope: an entry module and a module it
 * imports. There is no asset half — the MCP server serves no files — which is
 * exactly the case `CodeScope.assets` was made optional for.
 * -------------------------------------------------------------------------- */

function codeTree(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-mcp-code-'));
  writeFileSync(path.join(root, 'hash.ts'), 'export const ALGO = 1;\n', 'utf8');
  writeFileSync(
    path.join(root, 'server.ts'),
    "import { ALGO } from './hash.ts';\nexport const X = ALGO;\n", 'utf8');
  // Nothing imports this one. Editing it must raise nothing at all: the scope
  // is the import closure of the entry, not the directory around it.
  writeFileSync(path.join(root, 'statusline.ts'), 'export const BAR = 1;\n', 'utf8');
  return root;
}

/**
 * Change a file and leave its mtime observably later. `isStale()` gates its
 * exact content comparison on a cheap size-and-mtime stamp, and a same-length
 * rewrite inside one filesystem tick can land on the previous timestamp — see
 * `test/ui/code-skew.test.ts`, which measured that at ~1 in 200. Content still
 * decides the answer; this only makes sure the gate opens.
 */
function edit(file: string, text: string): void {
  writeFileSync(file, text, 'utf8');
  const later = new Date(Date.now() + 1_000);
  utimesSync(file, later, later);
}

/* -------------------------------------------------------------------------- *
 * PART A — the server says whether it is running current code.
 * -------------------------------------------------------------------------- */

test('a server with no identity claims nothing, in either direction', () => {
  // `null` is a registry built by something that is not the long-lived stdio
  // process. Silence is the answer: a freshness claim from a process that
  // measured nothing is worse than no claim at all.
  assert.equal(staleCodeNote(null), '');
});

test('a server whose sources have not moved says nothing about its code', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity({ entry: path.join(root, 'server.ts') });
    assert.equal(code.files, 2, 'the scope is the entry and what it imports, and no more');
    assert.equal(staleCodeNote(code), '');
    // The sibling nothing imports is not this server's code.
    edit(path.join(root, 'statusline.ts'), 'export const BAR = 2;\n');
    assert.equal(staleCodeNote(code), '', 'a file this server never loaded must raise nothing');
  } finally { removeTree(root); }
});

test('a server whose module graph moved says so plainly, and says how to fix it', () => {
  const root = codeTree();
  try {
    const code = stampCodeIdentity({ entry: path.join(root, 'server.ts') });
    edit(path.join(root, 'hash.ts'), 'export const ALGO = 2;\n');
    const note = staleCodeNote(code);

    // The three facts a reader of a suspicious answer needs, and nothing else.
    assert.ok(note.includes(code.startedAt), 'the moment this process loaded its code');
    assert.match(note, /has changed on disk since/, 'that the disk has moved on');
    assert.match(note, /may not reflect the current source/, 'what that costs the answer');
    assert.match(note, /restarting the MCP server is the fix/, 'the remedy, in one clause');

    // And the register. Stale is not damage: the server is answering correctly
    // for the code it holds, and a line written in the voice of corruption
    // would reproduce the outage's own mistake.
    assert.match(note, /Nothing is broken and nothing was blocked/);
    assert.doesNotMatch(note, /lost|corrupt|damaged|mismatch/i);
  } finally { removeTree(root); }
});

test('the stale line rides on the tool result itself, not on a second call', () => {
  const root = codeTree();
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-prov-'));
  try {
    runCli(['init'], cwd, () => {});
    const code = stampCodeIdentity({ entry: path.join(root, 'server.ts') });
    const registry = createRegistry(cwd, code);
    assert.doesNotMatch(registry.call('mycontext_help', { topic: 'capture' }), /running code/);

    edit(path.join(root, 'hash.ts'), 'export const ALGO = 3;\n');
    const answered = registry.call('mycontext_help', { topic: 'capture' });
    assert.match(answered, /this MCP server is running code it loaded at/,
      'a reader of THIS answer must not need a second tool call to learn the code is stale');
    // The answer itself is untouched — the disclosure is a footer, never an
    // edit to what the tool said.
    assert.equal(
      splitProvenance(answered).answer,
      splitProvenance(createRegistry(cwd, null).call('mycontext_help', { topic: 'capture' })).answer,
    );
  } finally { removeTree(root); removeTree(cwd); }
});

/* -------------------------------------------------------------------------- *
 * PART B — every answer names the corpus it used.
 * -------------------------------------------------------------------------- */

/** A corpus at `root/inner`, with an enclosing corpus at `root`. */
function nestedTree(outerItems: number, innerItems: number): { outer: string; inner: string } {
  const outer = mkdtempSync(path.join(tmpdir(), 'myctx-nest-'));
  const inner = path.join(outer, 'inner');
  mkdirSync(inner, { recursive: true });
  runCli(['init'], outer, () => {});
  runCli(['init'], inner, () => {});
  // Real items, `always: true`, so the injection actually renders something —
  // the standing root line is gated on the block having a body, exactly as the
  // subagent frame is.
  const write = (dir: string, count: number): void => {
    const items = path.join(dir, '.my_context', 'items', 'constraint');
    mkdirSync(items, { recursive: true });
    for (let i = 0; i < count; i += 1) {
      const id = `CONST-x${i}`;
      writeFileSync(path.join(items, `${id}.md`), `---
id: ${id}
type: constraint
title: Title of ${id}
status: active
always: true
---

# Title of ${id}

Body text.
`, 'utf8');
    }
  };
  write(outer, outerItems);
  write(inner, innerItems);
  return { outer, inner };
}

test('every MCP result names the absolute corpus root it resolved', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-prov-root-'));
  try {
    runCli(['init'], cwd, () => {});
    const expected = `my_context corpus: ${path.join(cwd, '.my_context')}.`;
    for (const [tool, args] of [
      ['mycontext_help', { topic: 'capture' }],
      ['list_drafts', {}],
      ['load_context', {}],
    ] as [string, Record<string, unknown>][]) {
      assert.equal(splitProvenance(createRegistry(cwd).call(tool, args)).provenance, expected, tool);
    }
  } finally { removeTree(cwd); }
});

test('a nested corpus is named as a DIFFERENT corpus, with both paths and both counts', () => {
  const { outer, inner } = nestedTree(736, 44);
  try {
    const note = nestedCorpusNote(resolveCorpus(inner, ''));
    assert.match(note, /WRONG CORPUS\?/);
    assert.ok(note.includes(path.join(inner, '.my_context')), 'the corpus that was used');
    assert.ok(note.includes(path.join(outer, '.my_context')), 'the corpus above it');
    assert.match(note, /44 item files/, 'what the reader got');
    assert.match(note, /736 item files/, 'what they almost certainly meant');
    // The sentence the whole disclosure exists for.
    assert.match(note, /A DIFFERENT CORPUS, not as a project with little recorded in it/);
    // And it decides nothing.
    assert.match(note, /Nothing was blocked and nothing was overridden/);
    assert.match(note, /MYCONTEXT_CORPUS_DIR=/, 'the way to state the choice instead');

    // Not silently refused, not silently switched: the resolution stands.
    assert.equal(resolveCorpus(inner, '').root, path.join(inner, '.my_context'));
  } finally { removeTree(outer); }
});

test('an ordinary corpus with nothing above it raises no wrong-corpus note', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-flat-'));
  try {
    runCli(['init'], cwd, () => {});
    const resolution = resolveCorpus(cwd, '');
    assert.equal(resolution.nesting, null);
    assert.equal(nestedCorpusNote(resolution), '');
    assert.equal(corpusRootLine(resolution), `my_context corpus: ${path.join(cwd, '.my_context')}.`);
  } finally { removeTree(cwd); }
});

test('an explicit MYCONTEXT_CORPUS_DIR is a stated choice, so it is named but never alarmed about', () => {
  const { outer, inner } = nestedTree(3, 1);
  try {
    const chosen = path.join(inner, '.my_context');
    const resolution = resolveCorpus(outer, chosen);
    assert.equal(resolution.root, chosen);
    assert.equal(resolution.nesting, null, 'no walk stopped early — a caller named this root');
    assert.equal(nestedCorpusNote(resolution), '');
    assert.match(corpusRootLine(resolution), /\(named by MYCONTEXT_CORPUS_DIR\)\.$/);
  } finally { removeTree(outer); }
});

test('the wrong-corpus note reaches a subagent, in the block the subagent reads', () => {
  const { outer, inner } = nestedTree(5, 1);
  try {
    const text = buildInjection(inner, { event: 'subagent', sessionId: 's', agentId: 'a' });
    assert.match(text, /WRONG CORPUS\?/);
    assert.ok(text.includes(`_my_context corpus: ${path.join(inner, '.my_context')}._`),
      'and the root it actually used is named on the same block');
  } finally { removeTree(outer); }
});

test('a session start gets the wrong-corpus note but no standing root line', () => {
  const { outer, inner } = nestedTree(5, 1);
  try {
    const text = buildInjection(inner, { event: 'session-start', sessionId: 's' });
    assert.match(text, /WRONG CORPUS\?/, 'a corpus nested inside another is worth saying anywhere');
    assert.doesNotMatch(text, /_my_context corpus: /,
      'the standing root line is the subagent path only — see the note in inject.ts');
  } finally { removeTree(outer); }
});

/* -------------------------------------------------------------------------- *
 * The splitter, which several tests and the documentation gate depend on.
 * -------------------------------------------------------------------------- */

test('splitProvenance takes the envelope off and leaves everything else alone', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-split-'));
  try {
    runCli(['init'], cwd, () => {});
    const footer = toolResultProvenance(cwd, null);
    assert.notEqual(footer, '');
    assert.deepEqual(splitProvenance(`ANSWER\n\n${footer}`), { answer: 'ANSWER', provenance: footer });

    // A result whose own last paragraph opens with `my_context:` — every
    // refusal on this surface does — is left whole.
    const refusal = 'line one\n\nmy_context: create_item does not take "origin".';
    assert.deepEqual(splitProvenance(refusal), { answer: refusal, provenance: '' });
    assert.deepEqual(splitProvenance('no blank line here'), {
      answer: 'no blank line here', provenance: '',
    });
  } finally { removeTree(cwd); }
});

test('the footer never throws, whatever it is handed', () => {
  const missing = path.join(tmpdir(), 'myctx-nowhere-' + String(Date.now()));
  // No workspace anywhere above a path that does not exist: no root to name,
  // no identity to report, and no throw.
  const broken = { startedAt: 'x', files: 0, scope: { entry: 'x' }, isStale: (): boolean => {
    throw new Error('the walk failed');
  } } as unknown as CodeIdentity;
  assert.doesNotThrow(() => toolResultProvenance(missing, broken));
});
