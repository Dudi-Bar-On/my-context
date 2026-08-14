import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openIngestSession, saveSession } from '../../src/ingest/session.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * I10's second half. A mixed ingest batch — some candidates written, some
 * refused — marked the anchor applied and left the rejections nowhere: not in
 * the session file, not in any report. The only record was the transcript of
 * the call that did it, so a resume could not show it and a human reviewing
 * later had no way to learn that anything had been refused at all.
 *
 * The durable half (a `<id>.rejected.jsonl` log, written on both the applied
 * and the still-pending exit) is tested under `test/ingest/`. This file tests
 * the half that makes it a FINDING rather than a file: that `ingest-status`
 * actually shows it, at every detail level and in `--json`.
 *
 * The distinction matters because "durable but unrendered" is exactly the
 * shape of silent loss this project exists to prevent — the data is on disk
 * and every surface a user looks at says everything is fine.
 */
function withSession<T>(
  fn: (cwd: string, run: (...a: string[]) => { code: number; text: string }) => T,
): T {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ingest-rej-'));
  try {
    const run = (...args: string[]) => {
      const lines: string[] = [];
      const code = runCli(args, cwd, (s) => lines.push(s));
      return { code, text: lines.join('\n') };
    };
    assert.equal(run('init').code, 0);

    const root = path.join(cwd, '.my_context');
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    const doc = '# Auth\n\nSessions expire after 30 minutes.\n';
    writeFileSync(path.join(cwd, 'docs', 'auth.md'), doc);

    const session = openIngestSession(root, 'docs/auth.md', doc);
    const anchor = session.chunks[0].anchor;
    // The mixed case: the anchor IS applied, and a candidate was still refused.
    session.applied[anchor] = [
      {
        candidateHash: 'abc123', itemId: 'REQ-sessions-expire',
        action: 'created', at: '2026-08-15T00:00:00.000Z',
      },
    ];
    session.rejected.push({
      anchor,
      at: '2026-08-15T00:00:00.000Z',
      index: 1,
      title: 'Tokens rotate hourly',
      message: 'observations[0].text contains "#".',
    });
    saveSession(root, session);
    return fn(cwd, run);
  } finally {
    removeTree(cwd);
  }
}

test('ingest-status --json carries per-anchor rejections alongside applied: true', () => {
  withSession((_cwd, run) => {
    const { code, text } = run('ingest-status', '--json');
    assert.equal(code, 0);
    const sessions = JSON.parse(text) as {
      rejected: number;
      anchors: { applied: boolean; rejected: { index: number; title: string | null; message: string }[] }[];
    }[];
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].rejected, 1, 'the session-level rejection count must be carried');

    const anchor = sessions[0].anchors[0];
    assert.equal(anchor.applied, true, 'this is the mixed case: the anchor really is applied');
    assert.equal(anchor.rejected.length, 1, 'and it must still report the rejection');
    assert.equal(anchor.rejected[0].index, 1);
    assert.equal(anchor.rejected[0].title, 'Tokens rotate hourly');
    assert.match(anchor.rejected[0].message, /observations\[0\]\.text/);
  });
});

test('ingest-status --full names the rejected candidate under its anchor', () => {
  withSession((_cwd, run) => {
    const { code, text } = run('ingest-status', '--full');
    assert.equal(code, 0);
    assert.match(text, /rejected\s+candidate 1 "Tokens rotate hourly"/);
    assert.match(text, /observations\[0\]\.text/);
    // The anchor line still says applied — the rejection does not replace it.
    assert.match(text, /applied\s+/);
  });
});

test('the default and --summary levels both say candidates were rejected', () => {
  withSession((_cwd, run) => {
    const short = run('ingest-status');
    assert.equal(short.code, 0);
    assert.match(short.text, /1 candidate\(s\) were rejected and not written/);
    assert.match(short.text, /--full/, 'and must say where to see them');

    // `--summary` is the level at which a corpus most easily looks complete.
    const summary = run('ingest-status', '--summary');
    assert.equal(summary.code, 0);
    assert.match(summary.text, /1 candidate\(s\) rejected/);
  });
});

test('a session with no rejections says nothing about them at any level', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ingest-norej-'));
  try {
    const run = (...args: string[]) => {
      const lines: string[] = [];
      const code = runCli(args, cwd, (s) => lines.push(s));
      return { code, text: lines.join('\n') };
    };
    assert.equal(run('init').code, 0);
    const root = path.join(cwd, '.my_context');
    const doc = '# Auth\n\nSessions expire after 30 minutes.\n';
    mkdirSync(path.join(cwd, 'docs'), { recursive: true });
    writeFileSync(path.join(cwd, 'docs', 'auth.md'), doc);
    saveSession(root, openIngestSession(root, 'docs/auth.md', doc));

    for (const level of [[], ['--summary'], ['--full']]) {
      const { code, text } = run('ingest-status', ...level);
      assert.equal(code, 0);
      assert.doesNotMatch(
        text, /rejected\s+candidate|were rejected and not written|candidate\(s\) rejected/,
        `a clean session must not mention rejections at ${level.join(' ') || 'default'}`,
      );
    }
  } finally {
    removeTree(cwd);
  }
});
