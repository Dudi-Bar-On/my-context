/**
 * The two agent-facing messages §5, §6 and §7 quote, pinned to what the real
 * MCP server actually says.
 *
 * `scripts/gen-doc-examples.ts` can only generate a block whose command is a
 * CLI invocation. The `agentEdits` setting's whole point is what an AGENT is
 * told — one sentence under `allow`, a paragraph under `review` — and no CLI
 * command prints either. So without this file those two blocks would be the
 * only quoted tool output in the documentation that nothing checks, in the one
 * section whose subject is trusting the tool. `test/docs/injection.test.ts`
 * closes the same hole for the hook output; this is that pattern applied to
 * the second uncoverable surface.
 *
 * Both messages are derived by driving `src/mcp/server.ts` over stdio against
 * the committed documentation fixture — the same corpus every generated
 * example runs against — so a change to the message, to `agentEditsFor`, or to
 * the fixture fails here with the text to paste.
 *
 * The workspace path is scrubbed with the generator's own `scrubOutput`, so
 * `<workspace>` means the same thing in a hand-pasted block as it does in a
 * generated one.
 *
 * When it fails, the fix is replacing the block in BOTH documents with the
 * text this test prints — never editing the assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeDocFixture } from '../../scripts/doc-fixture.ts';
import { scrubOutput } from '../../scripts/gen-doc-examples.ts';
import { revisionDir } from '../../src/core/revision.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

const DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')];
const documents = DOCUMENTS.map((relative) => ({
  relative,
  text: readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n'),
}));

/** The item the documentation's walkthrough proposes a change to. */
const ITEM = 'RULE-never-log-customer-email';

/**
 * The proposed body, byte-identical to the one the fixture's committed
 * revision log carries. Identical on purpose: the revision id is derived from
 * the item, the base and the proposal, so the `REV-…` in the message this test
 * derives is the same `REV-…` the generated `review revisions` block shows.
 * A drift between them would make the walkthrough read as two different
 * proposals.
 */
const PROPOSAL =
  'Log the customer id instead. Crash reports and analytics payloads leave our systems ' +
  'the same way access logs do, so no sink gets the address.';

/**
 * Calls one MCP tool against `cwd` over real stdio and returns the text
 * content of the response.
 *
 * A child process rather than a direct `updateItem` call, for the same reason
 * `injection.test.ts` spawns the hooks: the documentation quotes what the tool
 * SAYS, and the sentence is assembled by `src/mcp/tools.ts` from a
 * `MutationResult`. Calling the store directly would pin the store's data and
 * leave the assembled sentence — the part a reader sees — unchecked.
 */
async function callTool(cwd: string, args: Record<string, unknown>): Promise<string> {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', SERVER], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffered = '';
  let stderr = '';
  const seen: Record<string, unknown>[] = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffered += chunk;
    for (;;) {
      const newline = buffered.indexOf('\n');
      if (newline < 0) break;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() !== '') seen.push(JSON.parse(line) as Record<string, unknown>);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  const send = (message: unknown): void => { child.stdin.write(JSON.stringify(message) + '\n'); };
  send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05', capabilities: {},
      clientInfo: { name: 'docs-test', version: '0' },
    },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'update_item', arguments: args } });

  const deadline = Date.now() + 30_000;
  while (seen.length < 2 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // Wait for the streams to close, not merely for the kill to be sent. The
  // child's cwd is the temp fixture, and on Windows a live process pins its
  // own working directory: returning before it is gone makes `removeTree`
  // report a leak on every run, which is how a real handle leak stops being
  // visible.
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    child.once('close', () => resolve());
    child.stdin.end();
    child.kill();
  });
  assert.ok(seen.length >= 2, `the MCP server did not answer tools/call; stderr:\n${stderr}`);

  const result = seen[seen.length - 1] as
    { result?: { content?: { type: string; text: string }[] } };
  const text = result.result?.content?.[0]?.text;
  assert.ok(typeof text === 'string' && text.length > 0,
    `no text content came back: ${JSON.stringify(seen[seen.length - 1])}`);
  return text;
}

/**
 * A fixture copy with its committed revision log removed.
 *
 * The fixture ships one pending revision, which is what the generated
 * `review revisions` block documents. Staging the identical proposal against
 * it a second time is deliberately deduplicated by the store, and answers with
 * a different message — so the message a first-time proposal gets can only be
 * derived from a workspace where that proposal has not been made.
 */
function freshWorkspace<T>(config: string | null, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-staged-'));
  materializeDocFixture(dir);
  const root = path.join(dir, '.my_context');
  rmSync(revisionDir(root), { recursive: true, force: true });
  if (config !== null) writeFileSync(path.join(root, 'config.json'), config, 'utf8');
  return fn(dir).finally(() => removeTree(dir));
}

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

test('the staged-revision message the documentation quotes is what update_item says', async () => {
  const text = await freshWorkspace(null, (dir) =>
    callTool(dir, { id: ITEM, body: PROPOSAL }).then((raw) => scrubOutput(raw, dir)));

  // The three properties the surrounding prose claims about this message,
  // asserted before the verbatim check so a failure says WHICH property broke
  // rather than only that some bytes moved.
  assert.match(text, /^my_context: NOT applied/,
    'the first words must say the edit did not take effect');
  assert.match(text, /`mycontext review revisions`/,
    'the message must name the command that surfaces it — §5 tells the reader it does');
  assert.match(text, /<workspace>\/\.my_context\/\.revisions\/revisions\.jsonl/,
    'the log path must survive scrubbing as <workspace>, or the docs cannot quote it');

  assertQuotedInDocs(text, 'the staged-revision response from `update_item`');
});

test('the applied message the documentation quotes is what update_item says under allow', async () => {
  const text = await freshWorkspace(
    '{"profile":"standard","categories":{"rule":{"agentEdits":"allow"}}}',
    (dir) => callTool(dir, { id: ITEM, body: PROPOSAL }),
  );

  // The whole point of the pair: the same call, the same item, one setting
  // apart, and the outcomes are opposite. If this ever starts with "NOT
  // applied", `allow` has stopped meaning what §6 says it means.
  assert.doesNotMatch(text, /NOT applied/);
  assertQuotedInDocs(text.trim(), 'the applied response from `update_item` under agentEdits: allow');
});

/**
 * `extra` is CONTENT — banned tree-wide, for the reason
 * `test/docs/compaction-claim.test.ts` bans the restore claim tree-wide.
 *
 * Phase 1A moved `extra` into `UPDATE_FIELD_POLICY` as content, so a non-human
 * caller's change to it is staged like a change to title, body or tags
 * (`src/core/mutate.ts`, `REVISION_FIELDS` in `src/core/revision.ts`, and the
 * `update_item` schema). The phase review then found the claim still stating the
 * OLD behaviour on eight surfaces: `README.md`'s §5 tool table said in as many
 * words "Extra fields apply directly", its Hebrew mirror said the same, and six
 * more places enumerated revisable content as "title, body or tags".
 *
 * "Extra fields apply directly" is not a stale phrasing. It is a description of
 * the hole B1.1 closed — an agent holding only the MCP tools rewriting
 * `rule.directive` on a governing, active, hard rule — printed in the table a
 * reader consults to learn what the tools do. The call is shown being staged
 * over the real server in `test/mcp/extra-gate-e2e.test.ts`.
 *
 * So the ban is tree-wide rather than per-file, because the failure mode was
 * eight copies each of which looked like a cross-reference to a copy somebody
 * else had checked, and a per-file assertion is what let six survive a pass
 * that corrected two.
 */
test('no surface says extra applies directly, or lists revisable content without it', () => {
  const SURFACES = [
    'README.md',
    path.join('docs', 'README.he.md'),
    path.join('skills', 'mycontext', 'SKILL.md'),
    path.join('commands', 'LoadMyContext.md'),
    path.join('src', 'help', 'topics', 'workflow.md'),
    path.join('src', 'help', 'topics', 'capture.md'),
  ];

  const offenders: string[] = [];
  for (const relative of SURFACES) {
    const text = readFileSync(path.join(REPO, relative), 'utf8').replace(/\s+/g, ' ');
    // The literal claim, in both languages.
    if (/extra fields? (?:apply|applies) directly/i.test(text)) {
      offenders.push(`${relative}: "extra fields apply directly"`);
    }
    if (/שדות נוספים חלים ישירות/.test(text)) {
      offenders.push(`${relative}: the Hebrew "extra fields apply directly"`);
    }
    // And the enumeration that omits it, which is the same claim by silence: a
    // reader told a revision carries "title, body or tags" concludes a change
    // to anything else does not wait.
    if (/title, body,? (?:or|and) tags/i.test(text)) {
      offenders.push(`${relative}: enumerates revisable content as "title, body or tags"`);
    }
    if (/לכותרת, לגוף או לתגיות|הכותרת, הגוף או התגיות/.test(text)) {
      offenders.push(`${relative}: the Hebrew enumeration omits extra`);
    }
  }

  assert.deepEqual(
    offenders, [],
    'these surfaces describe `extra` as applying directly, which is the behaviour ' +
    'Phase 1A removed — it is the hole, not a wording. `extra` is content and stages ' +
    'like title, body and tags; see UPDATE_FIELD_POLICY in src/core/mutate.ts.',
  );
});

/** The positive half, so the ban above cannot be satisfied by deleting the
 * subject: both READMEs must actually name `extra` among what a revision
 * carries. Without this, removing the sentence entirely would pass. */
test('both READMEs name extra among the content a revision carries', () => {
  for (const doc of documents) {
    assert.match(
      doc.text.replace(/\s+/g, ' '),
      /(?:title, body, tags or `extra`|לכותרת, לגוף, לתגיות או ל-<span dir="ltr">`extra`<\/span>)/,
      `${doc.relative} must list \`extra\` beside title, body and tags as staged content`,
    );
  }
});
