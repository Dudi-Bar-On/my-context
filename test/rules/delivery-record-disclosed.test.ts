// @basis TASK-deliveratdoor-returns-whether-it-recorded-the-delivery-and, INV-nothing-is-dropped-silently, INV-hooks-fail-open
/**
 * **A door that delivered and could not write the record says so.**
 *
 * `recordDelivery` has returned `recorded` since it was written, and its own
 * contract puts the disclosure on the caller — *"the caller discloses, this
 * module does not, because only the caller knows which channel a person is
 * watching."* Both doors ended `}).text;` and `grep -rn "\.recorded"` found no
 * consumer anywhere in `src/`.
 *
 * **What that costs is a contradiction the product prints at itself.** The
 * constants ARE delivered; nothing says the record of that failed; and later
 * in the same session `assertDoor` tells the reader *"this session has no
 * record of the product rule store being delivered to it"*. Both sentences are
 * about the same session and only one of them is about what happened.
 *
 * ── HOW THE WRITE IS MADE TO FAIL, AND WHY THIS SHAPE ──────────────────────
 *
 * `.rules/delivered.test.jsonl` is created as a DIRECTORY. `recordDelivery`'s
 * `appendFileSync` then refuses, which is the exact failure path the flag
 * exists for, and it needs no permission bit — ACL denial does not bite for
 * the account this suite runs as (measured 2026-09-14: `icacls /deny` applied
 * cleanly and the file stayed readable), so a test written against a chmod
 * would pass by never failing.
 *
 * **`deliveredFile` decides the name, not this file.** A test that rebuilt the
 * path out of `DELIVERED_FILE` by hand would be a second answer to *which
 * file*, and the first thing it would be wrong about is itself — the module's
 * own words about why that function is exported.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { storeAppendix } from '../../src/hooks/session-start.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { deliveredFile } from '../../src/rules/delivered.ts';
import { RULES_DIR_ENV } from '../../src/rules/deliver.ts';
import { writeManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const MARKER = 'a body stops at the first ## heading';

const PRODUCT_ENTRY = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  `title: ${MARKER}`,
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

function storeFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-rec-store-'));
  writeFileSync(path.join(dir, 'fact.md'), PRODUCT_ENTRY, 'utf8');
  writeManifest(dir);
  return dir;
}

function workspace(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-rec-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the sandbox workspace did not initialize');
  return cwd;
}

/**
 * Make the log unwritable by putting a DIRECTORY where the file goes, and
 * confirm the obstruction actually landed before anything is asserted about
 * it. A proof whose setup silently did nothing reports green for the wrong
 * reason.
 */
function blockTheLog(stateRoot: string): string {
  const file = deliveredFile(stateRoot);
  mkdirSync(file, { recursive: true });
  let threw = false;
  try { writeFileSync(file, 'x', { flag: 'a' }); } catch { threw = true; }
  assert.equal(threw, true, 'the obstruction did not land — a write to the log still succeeded');
  return file;
}

function withStore<T>(dir: string, fn: () => T): T {
  const before = process.env[RULES_DIR_ENV];
  process.env[RULES_DIR_ENV] = dir;
  try { return fn(); } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
  }
}

/** Captures stderr for one synchronous call and always restores it. */
function captureStderr(fn: () => void): string {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr as unknown as { write: unknown }).write = ((chunk: unknown): boolean => {
    captured += String(chunk);
    return true;
  });
  try { fn(); } finally {
    (process.stderr as unknown as { write: unknown }).write = original;
  }
  return captured;
}

test('the session-start door delivers, cannot record it, and SAYS SO', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const stateRoot = path.join(cwd, '.my_context');
    blockTheLog(stateRoot);
    let text = '';
    const said = captureStderr(() => {
      text = storeAppendix(cwd, { sessionId: 's-unrecorded', source: 'startup', storeDir: store });
    });
    // The DELIVERY is unaffected — this is the half the disclosure has to be
    // able to claim, and the reason the sentence says "nothing is missing from
    // this session's context".
    assert.ok(text.includes(MARKER), 'the block was not delivered, so this proves nothing');
    assert.match(said, /the product rule store WAS delivered at this session-start door/);
    assert.match(said, /key `s-unrecorded`/);
    // It has to name the consequence a reader will meet LATER, because the
    // later sentence is the confident one.
    assert.match(said, /no record of the store being delivered/);
    assert.match(said, /Nothing was blocked\./);
  } finally { removeTree(cwd); removeTree(store); }
});

test('a compact-restore names its own door, not session-start', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    blockTheLog(path.join(cwd, '.my_context'));
    const said = captureStderr(() => {
      storeAppendix(cwd, { sessionId: 's-c', source: 'compact', storeDir: store });
    });
    assert.match(said, /at this compact-restore door/);
  } finally { removeTree(cwd); removeTree(store); }
});

test('the subagent door delivers, cannot record it, and SAYS SO', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    blockTheLog(path.join(cwd, '.my_context'));
    let out = '';
    const said = withStore(store, () => captureStderr(() => {
      out = buildSubagentStartOutput(
        { cwd, session_id: 's-parent', agent_id: 'lane-7' }, cwd,
      );
    }));
    assert.ok(out.includes(MARKER), 'the lane did not receive the store, so this proves nothing');
    assert.match(said, /at this subagent-start door/);
    // The key is the COMPOSITE, because that is what `pre-tool-use.ts` will
    // ask about at the lane's first tool call — a disclosure naming the bare
    // session id would send a reader looking in the wrong row.
    assert.match(said, /key `s-parent::lane-7`/);
  } finally { removeTree(cwd); removeTree(store); }
});

test('a door whose record LANDED says nothing at all', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    let text = '';
    const said = captureStderr(() => {
      text = storeAppendix(cwd, { sessionId: 's-ok', source: 'startup', storeDir: store });
    });
    assert.ok(text.includes(MARKER));
    assert.equal(
      said, '',
      'the line fires on the healthy path, which is how a real warning stops being read',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('a workspace with nowhere to record is silent HERE, because the binary discloses it', () => {
  // `storeAppendix` returns `''` before any door runs when there is no state
  // root at all. Nothing was delivered, so there is no failed record to
  // report, and `noWorkspaceLine` is already the disclosure for it — a second
  // line about the same fact is the duplication this project measures.
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const store = storeFixture();
  try {
    let text = 'unset';
    const said = captureStderr(() => {
      text = storeAppendix(bare, { sessionId: 's-none', source: 'startup', storeDir: store });
    });
    assert.equal(text, '');
    assert.equal(said, '');
  } finally { removeTree(bare); removeTree(store); }
});
