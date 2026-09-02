import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { auditLogPath, readAudit } from '../../src/core/audit.ts';
import { CORPUS_DIR_ENV } from '../../src/core/workspace.ts';
import { type HookInput } from '../../src/hooks/io.ts';
import { buildSubagentStartOutput, nestedCorpusRefusal } from '../../src/hooks/subagent-start.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **`SubagentStart` refuses a corpus nobody chose.**
 *
 * The defect these pin is not a missing disclosure. `core/corpus-identity.ts`
 * resolved this condition correctly and `core/inject.ts` put the loud note at
 * the top of every subagent's block — and on 2026-09-02 a stray `cd` into
 * `my-context/` twice sent whole waves of subagents into the 44-item nested
 * corpus instead of the 759-item one above it. Each was told, in the first
 * paragraph of its own context, and each carried on. So the four cases below
 * are about what the hook DOES, not about what it says: the two halves of the
 * condition, the two halves of the action, and the words that make the refusal
 * usable.
 *
 * What "refuse" means here is bounded, and `nestedCorpusRefusal`'s header
 * carries the measurement: `SubagentStart` cannot abort the dispatch it fires
 * for, so what is refused is the injection and the audit row, and the text
 * travels as a `blockingError` rather than as the friendly paragraph that was
 * already being ignored. Nothing below asserts a dispatch was stopped, because
 * none is.
 */

const PARENT = 'session-parent';
const AGENT = 'agent-under-test';

/** A corpus at `outer/inner`, with an enclosing corpus at `outer`. */
function nestedTree(outerItems: number, innerItems: number): { outer: string; inner: string } {
  const outer = mkdtempSync(path.join(tmpdir(), 'myctx-sa-nest-'));
  const inner = path.join(outer, 'inner');
  mkdirSync(inner, { recursive: true });
  runCli(['init'], outer, () => {});
  runCli(['init'], inner, () => {});
  write(outer, outerItems);
  write(inner, innerItems);
  return { outer, inner };
}

/** `always: true`, so an injection that is allowed actually renders a body. */
function write(dir: string, count: number): void {
  const items = path.join(dir, '.my_context', 'items', 'constraint');
  mkdirSync(items, { recursive: true });
  for (let i = 0; i < count; i += 1) {
    const id = `CONST-${path.basename(dir)}-${i}`;
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
}

function payload(cwd: string): HookInput {
  return {
    hook_event_name: 'SubagentStart',
    session_id: PARENT,
    agent_id: AGENT,
    agent_type: 'general-purpose',
    cwd,
  };
}

/** The refusal carried by a `decision: block` envelope, or `null`. */
function refusalOf(output: string): string | null {
  if (output === '') return null;
  const parsed = JSON.parse(output) as { decision?: string; reason?: string };
  return parsed.decision === 'block' ? parsed.reason ?? '' : null;
}

/** The `additionalContext` of an ordinary envelope, or `null`. */
function contextOf(output: string): string | null {
  if (output === '') return null;
  const parsed = JSON.parse(output) as {
    hookSpecificOutput?: { additionalContext?: string };
  };
  return parsed.hookSpecificOutput?.additionalContext ?? null;
}

/**
 * The variable is read from the real environment by default — the same default
 * `resolveCorpus` and `findProjectRoot` carry — so a test that means "no
 * caller stated a choice" has to guarantee it rather than assume it.
 */
function withCorpusDir<T>(value: string | undefined, run: () => T): T {
  const before = process.env[CORPUS_DIR_ENV];
  if (value === undefined) delete process.env[CORPUS_DIR_ENV];
  else process.env[CORPUS_DIR_ENV] = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env[CORPUS_DIR_ENV];
    else process.env[CORPUS_DIR_ENV] = before;
  }
}

// --- 1. Nested, and nobody stated a choice: REFUSED --------------------------

/**
 * The case that produced the defect. Both halves of the action are asserted,
 * because either one alone leaves the original failure standing: an injection
 * withheld but an attempt row still written puts a subagent's trace in the log
 * the status bar never reads, and a row withheld but the block still delivered
 * is the disclosure that was already ignored.
 */
test('a nested corpus with no stated choice is refused: no injection, no audit row', () => {
  const { outer, inner } = nestedTree(759, 44);
  try {
    withCorpusDir(undefined, () => {
      const out = buildSubagentStartOutput(payload(inner), inner);

      const refusal = refusalOf(out);
      assert.ok(refusal !== null, 'the envelope must carry a block decision, not context');
      assert.equal(contextOf(out), null, 'nothing from the nested corpus may be injected');
      assert.doesNotMatch(refusal, /CONST-inner-0/u, 'no item text leaks through the refusal');

      // The nested log is where the original defect put its rows. It must be
      // untouched — including never being created by this dispatch.
      const nestedLog = auditLogPath(path.join(inner, '.my_context'));
      assert.equal(
        existsSync(nestedLog) && readAudit(path.join(inner, '.my_context')).length > 0,
        false,
        'a refused dispatch writes nothing into the nested log',
      );
      // And nothing was written into the enclosing one either: refusing is not
      // switching, and this hook touched no corpus at all.
      assert.equal(readAudit(path.join(outer, '.my_context')).length, 0);
    });
  } finally { removeTree(outer); }
});

// --- 2. Nested, but a caller named the corpus: ALLOWED -----------------------

/**
 * **The half of the condition that is not optional.**
 * `ui/execute-effect.ts` points `MYCONTEXT_CORPUS_DIR` at a scratch copy on
 * every confirm, so refusing a stated choice would break a working feature —
 * and alarming about a deliberate choice is exactly how a check teaches its
 * reader to dismiss it. A named corpus is delivered normally, nested or not.
 */
test('a nested corpus named explicitly by MYCONTEXT_CORPUS_DIR is delivered, not refused', () => {
  const { outer, inner } = nestedTree(759, 44);
  try {
    const chosen = path.join(inner, '.my_context');
    withCorpusDir(chosen, () => {
      const out = buildSubagentStartOutput(payload(inner), inner);
      assert.equal(refusalOf(out), null, 'a stated choice is never refused');
      const text = contextOf(out) ?? '';
      assert.match(text, /CONST-inner-0/u, 'the named corpus is what gets injected');
      assert.doesNotMatch(text, /WRONG CORPUS/u, 'and it is not alarmed about either');
      // The ordinary pair of records is written, into the corpus that was named.
      assert.ok(readAudit(chosen).length > 0, 'the audit rows go to the stated corpus');
    });
    // Stated directly against the builder as well, so the reason is legible
    // without reading the envelope: it is the override, not the tree.
    assert.equal(nestedCorpusRefusal(inner, path.join(inner, '.my_context')), '');
    assert.notEqual(nestedCorpusRefusal(inner, ''), '');
  } finally { removeTree(outer); }
});

// --- 3. Not nested: ALLOWED -------------------------------------------------

/**
 * The ordinary case, and the one that must stay cheap and silent. A check that
 * fires on a flat corpus is a check nobody keeps.
 */
test('an ordinary corpus with nothing above it is delivered untouched', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-sa-flat-'));
  try {
    runCli(['init'], cwd, () => {});
    write(cwd, 3);
    withCorpusDir(undefined, () => {
      assert.equal(nestedCorpusRefusal(cwd), '');
      const out = buildSubagentStartOutput(payload(cwd), cwd);
      assert.equal(refusalOf(out), null);
      assert.match(contextOf(out) ?? '', /CONST-/u);
      assert.ok(readAudit(path.join(cwd, '.my_context')).length > 0);
    });
  } finally { removeTree(cwd); }
});

// --- 4. The refusal text, which is the deliverable --------------------------

/**
 * **Both paths and both counts, on the page, next to each other.**
 *
 * The entire original failure was reading "44 items" as *a project with little
 * recorded in it* rather than *a different project*. One number cannot say
 * that; two, beside two paths, can. The rest of the clauses are what turn a
 * refusal into something a reader can act on without a second tool call: what
 * was not touched, and the two — exactly two — ways forward.
 */
test('the refusal names both corpora, both counts, and both ways out', () => {
  const { outer, inner } = nestedTree(759, 44);
  try {
    const refusal = nestedCorpusRefusal(inner, '');

    assert.match(refusal, /^my_context: REFUSED\./u, 'prefixed once, per STD-error-message-conventions');
    assert.ok(refusal.includes(path.join(inner, '.my_context')), 'the corpus that was resolved');
    assert.ok(refusal.includes(path.join(outer, '.my_context')), 'the corpus above it');
    assert.match(refusal, /44 item files/u, 'what this dispatch would have got');
    assert.match(refusal, /759 item files/u, 'what it almost certainly meant');
    assert.match(refusal, /A DIFFERENT CORPUS, not as a project with little recorded in it/u);

    // Nothing was injected, and nothing in the corpus itself was harmed.
    assert.match(refusal, /nothing was injected/u);
    assert.match(refusal, /Nothing in either corpus was blocked, changed or written to/u);
    assert.match(refusal, /no `subagent-start` audit row was recorded/u);

    // The two ways forward, and no third one guessed on the reader's behalf.
    assert.ok(refusal.includes(`run from ${outer}`), 'way out 1: the enclosing directory');
    assert.ok(
      refusal.includes(`${CORPUS_DIR_ENV}=${path.join(outer, '.my_context')}`),
      'way out 2: state the choice by name',
    );
    assert.match(refusal, /will not guess between them/u);
    assert.doesNotMatch(refusal, /ignore this/u, 'a refusal never invites itself to be ignored');

    // And it does not claim a power the event does not have.
    assert.match(refusal, /SubagentStart cannot stop the dispatch it fires for/u);
  } finally { removeTree(outer); }
});
