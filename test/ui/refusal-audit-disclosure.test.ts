// @basis TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen, TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where
/**
 * **The UI server's two audit writes read their answer, exactly as the hooks
 * now read theirs.**
 *
 * `recordAudit` returns `{ written, error }` and never throws.
 * `TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen` found
 * fourteen hook call sites discarding that answer, and commit 199dfcc3 closed
 * every one of them: each hook reads the result and writes
 * `unrecordedHookLine` to stderr, the channel whose reader is the person who
 * can act. Two sites in the web UI were still discarding theirs, and both
 * justified it IN WRITING by citing the hooks — *"exactly as the hooks discard
 * theirs"* — a precedent that had already been reversed. A comment citing a
 * practice that no longer exists is worse than no comment: it is an argument a
 * reviewer has to go and check.
 *
 * ── WHY THE DISCLOSURE IS NOT ON THE WIRE ─────────────────────────────────
 *
 * Owner ruling A4 (2026-08-20, web-ui plan §0.6): **a refusal answers with its
 * status code and NOTHING ELSE**, and `sendRefusal` holds that structurally by
 * having no parameter a body could be passed in. So a `disclosures` array on
 * the refusal body is not available here, and it would be the wrong reader
 * anyway: the party being refused is the one party with no business knowing
 * that this machine's audit directory has stopped accepting writes.
 *
 * The channel used instead is the one this server already has for exactly this
 * class of fault — `onSessionStoreIssue`, which `src/cli/commands/ui.ts`
 * prints as a `mycontext ui:` line the owner sees. Its own docstring names
 * what it is for: *"both are machine state beside the corpus, both cost
 * something LATER and somewhere else, and neither is a reason to refuse to
 * serve now"*, and it was chosen over a second callback because *"a disclosure
 * channel with no listener is the silent drop wearing a name"*. An unwritable
 * audit log is that shape precisely. The last test below asserts the ruling is
 * still intact while the disclosure happens.
 *
 * ── HOW THE LOG IS MADE UNWRITABLE ────────────────────────────────────────
 *
 * A FILE where the `.audit` directory must be, which is `test/core/audit.test.ts`'s
 * own technique: `mkdirSync` then fails with ENOTDIR/EEXIST on every platform,
 * so nothing here depends on POSIX permissions that Windows does not have.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { auditDir } from '../../src/core/audit.ts';
import { recordRefusal } from '../../src/ui/security.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';

/**
 * **The retired sentence, and the three files that used to carry it.**
 *
 * `core/audit.ts`'s `recordAudit` docblock taught the discard — *"Hooks discard
 * it, because there is no one to tell"* — and called it *"the disclosed cost of
 * failing open"*. Both UI sites then cited the hooks as their precedent. When
 * 199dfcc3 reversed the practice, the prose was left behind in all three
 * places, so a reviewer reading any one of them was told the current design was
 * the opposite of what ships.
 *
 * This is asserted rather than merely edited because a comment is exactly the
 * thing nothing fails over: `hooks/io.ts`'s own docstring calls that sentence
 * *"the sentence this function exists to retire"*, and a retirement nobody
 * checks is a sentence that comes back on the next copy-paste.
 */
const RETIRED = [
  /discard(s)? (it|theirs)[,.]? (because|exactly)/i,
  /there is no one to tell/i,
];

const SOURCES = [
  'src/core/audit.ts',
  'src/ui/security.ts',
  'src/ui/server.ts',
];

test('no file still teaches the discard that 199dfcc3 retired', () => {
  // Every offender, not the first: three files carried this sentence, and a
  // check that stops at one turns a single edit into three red runs.
  const offenders: string[] = [];
  for (const relative of SOURCES) {
    const text = readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    for (const [index, line] of text.split('\n').entries()) {
      if (RETIRED.some((pattern) => pattern.test(line))) {
        offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'these lines still state the practice this project reversed: every caller of `recordAudit` '
    + 'reads its answer, and a comment saying otherwise is an argument a reviewer has to go and '
    + `disprove.\n${offenders.join('\n')}`);
});

/** A workspace whose audit directory cannot be created, and never will be. */
function blockedProject(): { cwd: string; done: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ui-unrecorded-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
  const audit = auditDir(path.join(cwd, '.my_context'));
  // Whatever `init` left there goes, and a file stands in its place.
  removeTree(audit);
  writeFileSync(audit, 'a file standing where the audit directory must be\n', 'utf8');
  return { cwd, done: () => removeTree(cwd) };
}

test('recordRefusal still REPORTS a failed write rather than throwing or swallowing it', () => {
  const { cwd, done } = blockedProject();
  try {
    const result = recordRefusal(path.join(cwd, '.my_context'), {
      check: 'token-missing', status: 401, method: 'GET', route: '/api/ping',
      host: '127.0.0.1:1', origin: null,
    });
    assert.equal(result.written, false,
      'the append cannot have succeeded against a file standing where the directory must be');
    assert.equal(typeof result.error, 'string');
    assert.notEqual(result.error, '',
      'a `written: false` with no reason is the silent drop with a boolean in front of it');
  } finally { done(); }
});

test('a refusal whose audit record could not be written says so on the server\'s own channel', async () => {
  const { cwd, done } = blockedProject();
  const issues: string[] = [];
  const server = await startSafeUiServer({
    cwd, port: 0, idleMs: 60_000, onSessionStoreIssue: (message) => { issues.push(message); },
  });
  try {
    // No token: the gate refuses, and `refuse()` records before it answers.
    const refused = await fetch(`http://127.0.0.1:${server.port}/api/ping`);
    assert.equal(refused.status, 401, 'the fixture did not actually draw a refusal');

    const disclosure = issues.find((message) => message.includes('--op ui-refused'));
    assert.ok(disclosure,
      'the refusal record was lost and nothing said so; what was said was '
      + `${JSON.stringify(issues)}`);
    // The SHARED sentence, not a softer one invented here: `hooks/io.ts`'s
    // `unrecordedHookLine` is what sixteen hook doors say, and a second wording
    // for the same fault is how two surfaces come to disagree about what an
    // unwritable log means.
    assert.match(disclosure, /audit record could not be written/,
      `the notice does not name the fault: ${disclosure}`);
    assert.match(disclosure, /floor/,
      `the notice does not say what the loss costs a later count: ${disclosure}`);
    assert.match(disclosure, /Nothing was blocked/,
      `the notice does not say the request was still answered: ${disclosure}`);
  } finally { await server.close(); done(); }
});

test('a nonce mint whose audit record could not be written says so too', async () => {
  const { cwd, done } = blockedProject();
  const issues: string[] = [];
  const server = await startSafeUiServer({
    cwd, port: 0, idleMs: 60_000, onSessionStoreIssue: (message) => { issues.push(message); },
  });
  try {
    const minted = await fetch(`http://127.0.0.1:${server.port}/api/nonce`, { method: 'POST' });
    assert.equal(minted.status, 200, 'the fixture did not actually mint a credential');
    const disclosure = issues.find((message) => message.includes('--op nonce-minted'));
    assert.ok(disclosure,
      'a credential came into existence and the record of it was lost in silence; what was '
      + `said was ${JSON.stringify(issues)}`);
  } finally { await server.close(); done(); }
});

/**
 * **The disclosure did not become a body.** Owner ruling A4 again, asserted
 * from the outside on the one path where the temptation is largest: the
 * refused party gets a status and nothing else, WHILE the owner's terminal
 * gets the whole sentence. Two readers, one fault, and only one of them is a
 * stranger.
 */
test('the refused party is still told nothing at all', async () => {
  const { cwd, done } = blockedProject();
  const issues: string[] = [];
  const server = await startSafeUiServer({
    cwd, port: 0, idleMs: 60_000, onSessionStoreIssue: (message) => { issues.push(message); },
  });
  try {
    const refused = await fetch(`http://127.0.0.1:${server.port}/api/ping`);
    assert.equal(refused.status, 401);
    assert.equal(await refused.text(), '',
      'ruling A4: a refusal carries a status line and nothing else, and an audit fault is not '
      + 'an exception to it');
    assert.equal(refused.headers.get('content-type'), null,
      'a refusal that grew a content-type has grown a body to put in it');
    assert.ok(issues.some((message) => message.includes('--op ui-refused')),
      'the fault was silently dropped rather than moved to the channel that has a reader');
  } finally { await server.close(); done(); }
});
