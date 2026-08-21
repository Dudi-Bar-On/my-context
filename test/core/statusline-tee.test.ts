import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  sanitizeSessionId, statuslineDir, teePath, writeTee, readTee, classifyContext,
} from '../../src/core/statusline-tee.ts';

/** A payload in the shape Claude Code 2.1.233 actually sends (see the plan's external-facts table). */
function payload(contextWindow: unknown): Record<string, unknown> {
  return {
    session_id: 'sess-abc123',
    transcript_path: '/tmp/t.jsonl',
    cwd: '/repo',
    version: '2.1.233',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: '/repo', project_dir: '/repo' },
    cost: { total_cost_usd: 0.42 },
    ...(contextWindow === undefined ? {} : { context_window: contextWindow }),
  };
}

test('sanitizeSessionId refuses rather than mangles', () => {
  assert.equal(sanitizeSessionId('sess-abc123'), 'sess-abc123');
  assert.equal(sanitizeSessionId('a'.repeat(128)), 'a'.repeat(128));
  assert.equal(sanitizeSessionId('a'.repeat(129)), null);
  assert.equal(sanitizeSessionId('../escape'), null);
  assert.equal(sanitizeSessionId('.hidden'), null);
  assert.equal(sanitizeSessionId('has space'), null);
  assert.equal(sanitizeSessionId(''), null);
});

test('writeTee stores the payload WHOLE and readTee returns it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const p = payload({ total_input_tokens: 5, context_window_size: 10, current_usage: null });
    const result = writeTee(root, p, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(result, { written: true });
    const back = readTee(root, 'sess-abc123');
    assert.equal(back?.receivedAt, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(back?.payload, p); // whole — nothing shredded at write time
    // The dir is gitignored like .audit is.
    assert.equal(readFileSync(path.join(statuslineDir(root), '.gitignore'), 'utf8').trim(), '*');
  } finally { removeTree(root); }
});

test('a payload without session_id, or with an unsafe one, is refused with the reason', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const noId = writeTee(root, { cwd: '/x' });
    assert.equal(noId.written, false);
    assert.match(noId.reason!, /session_id/);
    const badId = writeTee(root, { session_id: '../../etc/passwd' });
    assert.equal(badId.written, false);
    assert.equal(existsSync(statuslineDir(root)) && existsSync(path.join(root, '..', 'etc')), false);
  } finally { removeTree(root); }
});

test('readTee: no sample is null; a half-written sample is null, not a crash', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    assert.equal(readTee(root, 'sess-abc123'), null);
    assert.equal(readTee(root, '../escape'), null);
    mkdirSync(statuslineDir(root), { recursive: true });
    writeFileSync(teePath(root, 'sess-abc123')!, '{"receivedAt": "2026');
    assert.equal(readTee(root, 'sess-abc123'), null);
  } finally { removeTree(root); }
});

test('classifyContext: no context_window at all is UNKNOWN — an older Claude Code build', () => {
  assert.deepEqual(classifyContext(payload(undefined)), {
    state: 'unknown', usedTokens: null, windowSize: null, percent: null,
  });
  assert.equal(classifyContext(payload(null)).state, 'unknown');
  assert.equal(classifyContext(payload('junk')).state, 'unknown');
});

test('classifyContext: current_usage null is NOT-YET-KNOWN — never zero (post-compact state)', () => {
  // Claude Code sends total_input_tokens: 0 in this state (verified in the
  // binary: the `e?…:0` branch). Keying on that 0 would render the state as
  // zero — the lie-toward-reassurance §4b constraint 2 names. The gate is
  // current_usage === null and nothing else.
  const sample = classifyContext(payload({
    total_input_tokens: 0, total_output_tokens: 0,
    context_window_size: 200000, current_usage: null,
    used_percentage: null, remaining_percentage: null,
  }));
  assert.equal(sample.state, 'not-yet-known');
  assert.equal(sample.usedTokens, null);
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, null);
});

test('classifyContext: KNOWN computes input-only from current_usage — the §4b constraint-3 formula', () => {
  const sample = classifyContext(payload({
    total_input_tokens: 47000, total_output_tokens: 9000,
    context_window_size: 200000,
    current_usage: {
      input_tokens: 1000, cache_creation_input_tokens: 6000,
      cache_read_input_tokens: 40000, output_tokens: 9000,
    },
    used_percentage: 23.5, remaining_percentage: 76.5,
  }));
  assert.equal(sample.state, 'known');
  assert.equal(sample.usedTokens, 47000);          // 1000 + 6000 + 40000 — output NOT folded in
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, 23.5);
});

test('classifyContext: a current_usage missing its fields is UNKNOWN, not a guess', () => {
  const sample = classifyContext(payload({
    context_window_size: 200000, current_usage: { input_tokens: 5 },
  }));
  assert.equal(sample.state, 'unknown');
  assert.equal(sample.usedTokens, null);
});
