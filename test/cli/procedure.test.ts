/**
 * `mycontext procedure` — the one-shot lifecycle, end to end through `runCli`.
 *
 * Everything here goes through the CLI dispatch a user actually hits, because
 * the parts most likely to be wrong are boundary behaviour rather than
 * anything `updateItem` or `procedureProgress` decide on their own: that
 * `activate` performs BOTH writes, that `step` performs NEITHER, that the
 * category refusal names both categories when the near miss is a `runbook`,
 * and that a `ready` procedure's invisibility is disclosed rather than
 * discovered.
 *
 * Three adaptations from the plan's draft of this file, each because the
 * surface it named does not exist under that name:
 *
 *  - `withWorkspace` is written here, from `mkdtempSync` + `mycontext init` +
 *    `removeTree`, the same shape `test/cli/supersede.test.ts` uses. The
 *    shared `test/helpers/workspace.ts` exports `sandbox()`, which hands back
 *    a MutationContext over an in-memory index — the wrong tool for a test
 *    whose subject is what the CLI writes to disk.
 *  - `readFileBytes` resolves under `.my_context/`, which is where a
 *    workspace's `items/` actually live.
 *  - there is no `mycontext inject` command. The session-start injection is
 *    `buildSessionStartOutput` (src/hooks/session-start.ts), which is the
 *    function the hook itself calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { removeTree } from '../helpers/tmp.ts';

const ID = 'PROC-rotate-the-webhook-secret';

function withWorkspace(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-procedure-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0);
    fn(dir);
  } finally {
    removeTree(dir);
  }
}

/** The item file's bytes, so a test can assert nothing moved them. */
function readFileBytes(dir: string, relative: string): string {
  return readFileSync(path.join(dir, '.my_context', ...relative.split('/')), 'utf8');
}

function seed(dir: string): void {
  runCli(['add', '--summary-omitted', 'procedure', 'Rotate the webhook secret',
    '--body', 'Run this when the shared secret leaks.',
    '--step', 'Deploy the next secret beside the live one',
    '--step', 'Roll the endpoint secret',
    '--step', 'Promote and redeploy', '--yes'], dir, () => {});
}

test('activate sets BOTH status and always — a procedure that is only eligible is a bug', () => {
  withWorkspace((dir) => {
    seed(dir);
    assert.equal(runCli(['procedure', 'activate', ID, '--yes'], dir, () => {}), 0);
    const shown: string[] = [];
    runCli(['show', ID], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /status:\s*active/);
    assert.match(shown.join('\n'), /always:\s*true/);
  });
});

test('an activated procedure is injected in full at session start', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    const injected = buildSessionStartOutput(dir);
    // The steps are the point: an injected procedure without them is the
    // silent under-delivery Task 6 exists to prevent.
    assert.match(injected, /- \[ \] Roll the endpoint secret/);
  });
});

test('done retires it to deprecated, and it stays counted as retired', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'done', ID, '--yes'], dir, () => {});
    const shown: string[] = [];
    runCli(['show', ID], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /deprecated/);
    const injected = buildSessionStartOutput(dir);
    assert.doesNotMatch(injected, /Roll the endpoint secret/);
    assert.match(injected, /retired/);
  });
});

test('step records progress WITHOUT touching the item — checksum and file do not move', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    const before = readFileBytes(dir, `items/procedure/${ID}.md`);
    runCli(['procedure', 'step', ID, '2'], dir, () => {});
    const after = readFileBytes(dir, `items/procedure/${ID}.md`);
    assert.equal(after, before, 'progress must never enter items/ — spec §6m.3');
    const shown: string[] = [];
    runCli(['procedure', 'show', ID], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /1 of 3/);
    assert.match(shown.join('\n'), /- \[x\] Roll the endpoint secret/);  // rendered, not stored
  });
});

test('doctor stays clean after progress — the checksum never moved', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '2'], dir, () => {});
    const out: string[] = [];
    runCli(['doctor'], dir, (s) => out.push(s));
    assert.doesNotMatch(out.join('\n'), /checksum mismatch/);
  });
});

test('re-activating clears the previous run', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'step', ID, '1'], dir, () => {});
    runCli(['procedure', 'done', ID, '--yes'], dir, () => {});
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    const shown: string[] = [];
    runCli(['procedure', 'show', ID], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /0 of 3/);
  });
});

test('step on a procedure that is not active is refused, and names activate', () => {
  withWorkspace((dir) => {
    seed(dir);
    // The same correction the `ready` test carries, for the same reason: the
    // plan's draft assumed the seeded procedure was not yet active, and
    // `mycontext add … --yes` claims `origin: "human"`, so it is. Put it back
    // to a draft to have a procedure that has not been initiated.
    runCli(['edit', ID, '--status', 'draft', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'step', ID, '1'], dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /procedure activate/);
  });
});

test('a step number outside the list is refused rather than recorded', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', ID, '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'step', ID, '9'], dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /3 step/);
  });
});

test('`procedure list` discloses that a ready procedure reaches no index line', () => {
  withWorkspace((dir) => {
    seed(dir);
    // `--status draft` as well as the tag, which the plan's draft of this test
    // omitted: `mycontext add … --yes` claims `origin: "human"`, so
    // `trustedStatus` leaves a normative capture ACTIVE, and the lifecycle
    // table's `ready` stage is `status: draft` **plus** the tag. Tagging an
    // active procedure `ready` produces an active procedure, which is a
    // different row and would never print this disclosure.
    runCli(['edit', ID, '--status', 'draft', '--tags', 'ready', '--yes'], dir, () => {});
    const out: string[] = [];
    runCli(['procedure', 'list'], dir, (s) => out.push(s));
    assert.match(out.join('\n'), /ready/);
    assert.match(out.join('\n'), /not injected and not named in the index/);
  });
});

test('an item that is not a procedure is refused by name', () => {
  withWorkspace((dir) => {
    runCli(['add', '--summary-omitted', 'rule', 'Never log secrets', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'show', 'RULE-never-log-secrets'], dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /is a rule, not a procedure/);
  });
});

test('a RUNBOOK is refused, and the refusal says which of the two this is', () => {
  withWorkspace((dir) => {
    // The confusable pair, and the one refusal a user will actually hit.
    // §6l F7 predicted that two ordered-step categories would be filed
    // interchangeably; §6o accepted that risk on the condition that the
    // difference is statable wherever an author is choosing. This message is
    // the fourth of those places, and it is the only one that reaches somebody
    // who has ALREADY chosen wrongly.
    runCli(['add', '--summary-omitted', 'runbook', 'Rotate the webhook secret', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'activate', 'RUN-rotate-the-webhook-secret'],
      dir, (s) => out.push(s)), 1);
    const text = out.join('\n');
    assert.match(text, /is a runbook, not a procedure/);
    // Not "unsupported", not "coming soon": a runbook has no lifecycle because
    // it is never finished, and the message has to say so or the user will
    // wait for the feature.
    assert.match(text, /repeatable/);
    assert.match(text, /done once/);
  });
});
