/**
 * The `audit_log` MCP tool and the injection `tokens` field: the agent-facing
 * read surface must carry the estimate where it was recorded, and must tell
 * the reader that an older record's missing field means "not recorded" —
 * never zero. The tool emits records as raw JSON lines, so absence is already
 * structural; what needs pinning is that the PREAMBLE explains it, because a
 * model reading two records where one has `tokens` and one does not will
 * otherwise guess.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit } from '../../src/core/audit.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

test('audit_log carries tokens verbatim and explains the absent-field reading', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-audit-mcp-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    const root = resolveWorkspace(cwd).projectRoot!;

    // One record from before the field existed, one from after.
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'old', hook: 'PreToolUse',
      at: '2026-08-14T10:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'new', hook: 'PreToolUse',
      at: '2026-08-15T10:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 456,
    });

    const text = createRegistry(cwd).call('audit_log', { kind: 'injection' });
    assert.equal(typeof text, 'string');
    const lines = (text as string).split('\n');

    // The preamble defines the field and the absent-field reading, in words.
    assert.match(lines[0], /tokens/);
    assert.match(lines[0], /not recorded/);
    assert.match(lines[0], /never as zero/);

    const records = lines.slice(1).map((l) => JSON.parse(l) as Record<string, unknown>);
    const oldRec = records.find((r) => r.sessionId === 'old')!;
    const newRec = records.find((r) => r.sessionId === 'new')!;
    assert.equal(newRec.tokens, 456);
    assert.equal(
      'tokens' in oldRec, false,
      'an old record grew a tokens property on the way out — absence is the disclosure',
    );
  } finally { removeTree(cwd); }
});
