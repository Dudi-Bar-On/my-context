/**
 * The injected-context blocks in README.md and docs/README.he.md, pinned to
 * what the hooks actually emit.
 *
 * `scripts/gen-doc-examples.ts` can only generate blocks whose command is a
 * CLI invocation, and injection is not one: it is produced by the SessionStart
 * and PreToolUse hooks, and no CLI command renders a selection. So the READMEs'
 * injection blocks are the one part of their example output that `npm run
 * gen:docs` cannot fill — which would otherwise leave the most load-bearing
 * output in the documentation as the only output nothing checks.
 *
 * This file closes that hole from the other side: it re-derives each block by
 * running the real hook against the committed documentation fixture and asserts
 * that BOTH documents quote that text verbatim. A change to the renderer, the
 * selector, the budgets or the fixture fails here with the text to paste.
 *
 * The Hebrew mirror is covered because these blocks are copied into it in
 * English — they are the tool's own output, not prose — so nothing here depends
 * on the translation, and a mirror that drifted here would be quoting words the
 * tool never said.
 *
 * When it fails, the fix is replacing the block in both documents with the text
 * this test prints — never editing the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { materializeDocFixture } from '../../scripts/doc-fixture.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const HOOKS = path.join(REPO, 'src', 'hooks');

/**
 * Every document that quotes injected output, LF-normalized: a working tree
 * checked out before `.gitattributes` is CRLF.
 *
 * The Hebrew mirror is here for the same reason the English is: these blocks
 * are the one part of the documentation `npm run gen:docs` cannot fill, so
 * without an assertion they are hand-copied text nothing checks — and a mirror
 * whose injected output has drifted is worse than one that is merely stale,
 * because it reads as the tool's own words.
 */
const DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')];
const documents = DOCUMENTS.map((relative) => ({
  relative,
  text: readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n'),
}));

/**
 * Runs a hook the way Claude Code runs it — a child process fed a JSON payload
 * on stdin — and returns its stdout.
 *
 * A child, rather than importing the builder, for one reason that cannot be
 * worked around in-process: `GLOBAL_DIR` is `homedir()/.my-context` and is
 * computed once at module load, so a maintainer who keeps a global corpus
 * would have their own items folded into every assertion here. `homedir()`
 * reads `HOME` first and `USERPROFILE` on Windows, so both are pointed at an
 * empty directory inside the fixture.
 */
function runHook(script: string, dir: string, payload: Record<string, unknown>): string {
  const home = path.join(dir, '.no-global-layer');
  mkdirSync(home, { recursive: true });
  return execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HOOKS, script)], {
    cwd: dir,
    input: JSON.stringify({ cwd: dir, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

function withFixture<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inject-'));
  try {
    materializeDocFixture(dir);
    return fn(dir);
  } finally {
    removeTree(dir);
  }
}

/**
 * Asserts every document quotes `text` verbatim.
 *
 * The emptiness guard is not ceremony: every hook here fails open and returns
 * '' on any error, and '' is a substring of every document — so without it, a
 * hook that had stopped injecting entirely would make this file pass.
 */
function assertQuotedInDocs(text: string, what: string): void {
  const body = text.replaceAll('\r\n', '\n').trimEnd();
  assert.ok(body.length > 0, `${what} produced no output — this assertion would be vacuous`);
  for (const doc of documents) {
    assert.ok(
      doc.text.includes(body),
      `${doc.relative} no longer quotes ${what} verbatim. Replace the block with:\n\n${body}\n`,
    );
  }
}

test('the session-start block in section 3 is what the hook emits', () => {
  const text = withFixture((dir) =>
    runHook('session-start.ts', dir, { source: 'startup', session_id: 'docs-session' }));
  assert.match(text, /## my_context index/, 'the index tier stopped being part of a session start');
  assertQuotedInDocs(text, 'the SessionStart injection');
});

test('the just-in-time block in section 4 is what the hook emits', () => {
  const file = 'src/billing/prices.js';
  const raw = withFixture((dir) =>
    runHook('pre-tool-use.ts', dir, {
      session_id: 'docs-jit', tool_name: 'Edit', tool_input: { file_path: file },
    }));
  assert.notEqual(raw.trim(), '', `the PreToolUse hook said nothing about ${file}`);
  const parsed = JSON.parse(raw) as
    { hookSpecificOutput?: { additionalContext?: string } };
  const text = parsed.hookSpecificOutput?.additionalContext ?? '';
  assert.match(text, /INV-prices-are-integer-cents/, `nothing matched the scope of ${file}`);
  assertQuotedInDocs(text, `the just-in-time injection for ${file}`);
});

/**
 * The two disclosure lines section 4 quotes for the budget explanation, both
 * produced by squeezing the fixture's budgets until they spill. `pinned: 10` is
 * below the cost of the fixture's one pinned item, and `index: 60` fits three
 * of its five normative index lines.
 */
test('the spill and truncation lines in section 4 are what a full budget emits', () => {
  const text = withFixture((dir) => {
    writeFileSync(
      path.join(dir, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', categories: {}, budgets: { pinned: 10, index: 60 } }),
      'utf8',
    );
    return runHook('session-start.ts', dir, { source: 'startup', session_id: 'docs-spill' });
  });

  const lines = text.replaceAll('\r\n', '\n').split('\n');

  const spill = lines.find((l) => l.startsWith('_1 item(s) omitted'));
  assert.ok(spill, `no spill disclosure was rendered:\n${text}`);
  assertQuotedInDocs(spill, 'the budget spill disclosure');

  const truncation = lines.find((l) => l.startsWith('- … +'));
  assert.ok(truncation, `no index truncation line was rendered:\n${text}`);
  assertQuotedInDocs(truncation, 'the index truncation line');
});
