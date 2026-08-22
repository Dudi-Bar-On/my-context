/**
 * **`SessionEnd` is registered UNMATCHED, and every `reason` reaches a branch.**
 *
 * This is `session-start-matcher.test.ts`'s question asked one event over, and
 * it is asked because that file exists: a `SessionStart` matcher that named
 * four of five `source` values meant a forked session got no injection at all,
 * silently, and no test noticed because every test supplied the `source`
 * itself. A matcher is exact list membership, not a regex — measured in
 * `reports/probes/2026-08-20-clear-and-prompt-hooks.md` — so a value the
 * matcher omits does not fail, it does not RUN.
 *
 * `SessionEnd` takes the other road out of that trap. It carries **no matcher**,
 * which the platform reads as "match everything", so a sixth `reason` still
 * reaches this project's code — and the handler, not the manifest, decides what
 * to do with a value it has never heard of. The two tests below are the two
 * halves of that bargain: the manifest must stay unmatched, and every member of
 * the enum must reach a branch that is not the unknown one.
 *
 * ── WHERE THE LIST COMES FROM ──────────────────────────────────────────────
 *
 * Claude Code ships as a single executable and validates its own hook payload
 * against a schema carried inside it. Read on build 2.1.239 at
 * `C:/Users/UserC/.local/share/claude/versions/2.1.239`, by
 * `grep -a -b -o 'hook_event_name:kt("SessionEnd")'` and dumping the bytes
 * before the hit:
 *
 *     G3b=["clear","resume","logout","prompt_input_exit","other"],
 *     V3b=ve(()=>Or(G3b)),
 *     q3b=ve(()=>YH().and(_e({hook_event_name:kt("SessionEnd"),reason:V3b()})))
 *
 * Byte-identical in `2.1.237` and `2.1.238`. Like the `source` list it is
 * hand-kept and cannot be derived — it lives in a binary, not in a package this
 * project depends on — so the test's job is to make a change DELIBERATE. When a
 * sixth value appears, the last test here fails, and whoever updates it re-reads
 * the schema on the current build and records the version.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildSessionEndOutcome, SESSION_END_REASONS } from '../../src/hooks/session-end.ts';
import { removeTree } from '../helpers/tmp.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Manifest {
  hooks: Record<string, { matcher?: string; hooks: { command: string; timeout?: number }[] }[]>;
}

function manifest(): Manifest {
  return JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as Manifest;
}

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-session-end-matcher-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

test('SessionEnd is registered once, unmatched, with the 2s ceiling', () => {
  const entries = manifest().hooks['SessionEnd'];
  assert.ok(entries !== undefined, 'the hook binary exists but nothing runs it');
  assert.equal(entries.length, 1, 'two entries would run the hook twice per session end');
  assert.equal(
    Object.hasOwn(entries[0], 'matcher'), false,
    'a matcher here is exact list membership over `reason`, so it would silently skip the ' +
    'reason nobody named — which is the defect `session-start-matcher.test.ts` was written for. ' +
    'The handler branches on every reason instead, and says so for the one it does not know.',
  );
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /src\/hooks\/session-end\.ts/);
  // 2 rather than SessionStart's 10, and the difference is not taste: the
  // platform aborts the whole SessionEnd batch at a floor of 1,500 ms that a
  // PLUGIN's declared timeout is never counted toward. See the header of
  // `src/hooks/session-end.ts` for the trace. A larger number here would be a
  // bound that cannot bite; a smaller one would spend less of a budget the
  // platform has already granted.
  assert.equal(entries[0].hooks[0].timeout, 2);
});

test('every reason the platform sends reaches a branch that is not the unknown one', (t) => {
  const cwd = sandbox(t);
  const handled = SESSION_END_REASONS.map((reason) => {
    const outcome = buildSessionEndOutcome(
      { hook_event_name: 'SessionEnd', session_id: `s-${reason}`, cwd, reason }, cwd,
    );
    assert.notEqual(
      outcome.action, 'unknown',
      `reason '${reason}' is in the platform's enum and this handler does not know it`,
    );
    assert.notEqual(outcome.note, '', `reason '${reason}' produced no sentence`);
    return { reason, action: outcome.action };
  });

  // Exactly one of the five destroys a window. If a second ever does, that is
  // a deliberate change and this line is where it is made.
  assert.deepEqual(
    handled.filter((h) => h.action === 'cleared').map((h) => h.reason), ['clear'],
    'the set of reasons that DELETE a window\'s state changed',
  );
  assert.deepEqual(
    handled.filter((h) => h.action === 'retained').map((h) => h.reason),
    ['resume', 'logout', 'prompt_input_exit', 'other'],
    'the set of reasons whose session id survives the event changed',
  );
});

/**
 * The sixth value, before it exists. A `reason` outside the enum must not be
 * guessed at in either direction — not treated as a clear (which would delete
 * the state of a window that is coming back) and not swallowed (which is how
 * this project stopped noticing `fork`). It is recorded, because a SessionEnd
 * hook that exits 0 has no other channel: the platform copies a SessionEnd
 * hook's output to the user only on the failure branch.
 */
test('a reason outside the enum is recorded rather than guessed at', (t) => {
  const cwd = sandbox(t);
  const root = resolveWorkspace(cwd).projectRoot!;
  const outcome = buildSessionEndOutcome(
    { hook_event_name: 'SessionEnd', session_id: 's-new', cwd, reason: 'hibernate' }, cwd,
  );
  assert.equal(outcome.action, 'unknown');
  assert.match(outcome.note, /hibernate/);

  const rows = readAudit(root).filter((r) => r.op === 'session-end');
  assert.equal(rows.length, 1, 'an unknown reason wrote no record, so nothing would ever say so');
  assert.equal(rows[0].kind, 'hook');
  assert.equal(rows[0].hook, 'SessionEnd');
  assert.equal(rows[0].sessionId, 's-new');
  assert.match(rows[0].note ?? '', /is not one of clear, resume, logout, prompt_input_exit, other/);
});
