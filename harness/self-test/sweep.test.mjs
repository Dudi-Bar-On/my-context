import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runTable } from '../sweep.mjs';
import { load, EVIDENCE_DIR } from '../lib/evidence.mjs';

test('runTable records one evidence row per case, including setup state', async () => {
  await rm(join(EVIDENCE_DIR, 'sweepselftest.jsonl'), { force: true });
  await runTable('sweepselftest', [
    { id: 'help', kind: 'cli', argv: ['--help'] },
    {
      id: 'list-after-add',
      kind: 'cli',
      setup: [['add', 'constraint', 'Probe rule', '--yes']],
      // `--full` is required here: `mycontext list <category>` at the
      // default detail level only prints an id/type/status table (the id is
      // a slug of the title, e.g. `CONST-probe-rule`, not the title text
      // itself). The literal title "Probe rule" only appears in `--full` or
      // `--json` output — verified against the actual CLI, see task-6-report.md.
      argv: ['list', 'constraint', '--full'],
    },
  ]);
  const rows = await load('sweepselftest');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.caseId === 'help').exitCode, 0);
  assert.match(rows.find((r) => r.caseId === 'list-after-add').stdout, /Probe rule/);
  await rm(join(EVIDENCE_DIR, 'sweepselftest.jsonl'), { force: true });
});

test('a case that throws records harnessError and does not abort the remaining cases', async () => {
  await rm(join(EVIDENCE_DIR, 'sweepcrashtest.jsonl'), { force: true });
  await runTable('sweepcrashtest', [
    // `runOne` rejects any kind it does not recognise — this is the cheapest
    // way to force the case body itself to throw, so we can prove the throw
    // (a) is recorded rather than swallowed and (b) does not abort the sweep.
    { id: 'boom', kind: 'nonsense' },
    { id: 'after-boom', kind: 'cli', argv: ['--help'] },
  ]);
  const rows = await load('sweepcrashtest');
  assert.equal(rows.length, 2, 'one bad case must not prevent the rest of the table from running');
  const boom = rows.find((r) => r.caseId === 'boom');
  assert.ok(boom.harnessError, 'the crash is recorded as evidence, not silently dropped');
  assert.match(boom.harnessError, /unknown case kind/);
  assert.equal(rows.find((r) => r.caseId === 'after-boom').exitCode, 0, 'the next case still ran normally');
  await rm(join(EVIDENCE_DIR, 'sweepcrashtest.jsonl'), { force: true });
});

test('a hook case and an mcp case both record real evidence', async () => {
  await rm(join(EVIDENCE_DIR, 'sweephookmcptest.jsonl'), { force: true });
  await runTable('sweephookmcptest', [
    {
      id: 'session-start',
      kind: 'hook',
      hook: 'sessionStart',
      payload: { session_id: 's1', source: 'startup' },
    },
    { id: 'list-tools', kind: 'mcp', tool: '__list__' },
  ]);
  const rows = await load('sweephookmcptest');
  assert.equal(rows.length, 2);
  const hookRow = rows.find((r) => r.caseId === 'session-start');
  assert.equal(hookRow.hook, 'sessionStart');
  assert.equal(hookRow.exitCode, 0, 'hooks fail open on an empty corpus');
  const mcpRow = rows.find((r) => r.caseId === 'list-tools');
  assert.equal(mcpRow.tool, '__list__');
  assert.ok(Array.isArray(mcpRow.result.tools), 'the tool list comes back as evidence');
  assert.ok(mcpRow.result.tools.some((t) => t.name === 'load_context'));
  await rm(join(EVIDENCE_DIR, 'sweephookmcptest.jsonl'), { force: true });
});
