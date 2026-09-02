import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { record, load, EVIDENCE_DIR } from '../lib/evidence.mjs';

test('records round-trip and carry their id', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  const id = await record('selftest', 'case-one', { exitCode: 0, stdout: 'hi' });
  assert.equal(id, 'selftest/case-one');
  const rows = await load('selftest');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'selftest/case-one');
  assert.equal(rows[0].stdout, 'hi');
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});

test('a duplicate case id is rejected, not silently overwritten', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  await record('selftest', 'dup', { exitCode: 0 });
  await assert.rejects(() => record('selftest', 'dup', { exitCode: 1 }), /duplicate/);
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});

test('a realistic payload round-trips as exactly one line', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  const messy = 'line one\nline two\t"quoted"\\backslash\r\n\u0007bell';
  await record('selftest', 'messy', { stdout: messy, stderr: '', exitCode: 1 });
  const raw = await readFile(join(EVIDENCE_DIR, 'selftest.jsonl'), 'utf8');
  assert.equal(raw.trimEnd().split('\n').length, 1, 'record must occupy exactly one line');
  const rows = await load('selftest');
  assert.equal(rows[0].stdout, messy, 'payload survives the round trip byte for byte');
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});

test('load() tolerates truncated lines and reports them to stderr', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  const goodId = await record('selftest', 'good', { exitCode: 0 });
  // Manually append a truncated line to simulate a write interrupted mid-append
  await appendFile(join(EVIDENCE_DIR, 'selftest.jsonl'), '{"id":"bad","truncat');
  // Capture stderr to verify the warning is printed
  let stderrOutput = '';
  const oldWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    stderrOutput += chunk;
    return true;
  };
  const rows = await load('selftest');
  process.stderr.write = oldWrite;
  // Should still return the good record, not throw
  assert.equal(rows.length, 1, 'load() returns only the parseable record');
  assert.equal(rows[0].id, goodId, 'good record is intact');
  assert.match(stderrOutput, /unparseable line/, 'truncation is reported to stderr');
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});
