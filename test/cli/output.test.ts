import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

/**
 * The user's standing output requirement, which Task 15 could not meet
 * because its brief predated it: every reporting command takes
 * `--full`/`--short`/`--summary` and `--json`, prints column HEADERS, and
 * renders hierarchical data (ingest sessions with per-anchor progress) as
 * JSON rather than flattening it into columns that cannot carry it.
 *
 * These drive the real commands end to end. The per-helper unit tests live in
 * `test/cli/format.test.ts`.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-output-'));
  try {
    runCli(['init'], cwd, () => {});
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function seed(cwd: string): void {
  run(['add', 'constraint', 'Pool capped at 20'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
}

/** An ingest session with two chunks, one applied — the hierarchical case. */
function ingestSession(cwd: string): string {
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(
    path.join(cwd, 'docs', 'prd.md'),
    '# Password policy\n\nPasswords must be at least 12 characters.\n\n' +
    '# Session policy\n\nSessions expire after 30 minutes.\n',
    'utf8',
  );
  const started = run(['ingest', 'docs/prd.md'], cwd);
  const id = /ING-[a-z0-9-]+/.exec(started.out)![0];
  writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
  }]), 'utf8');
  run([ 'ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  return id;
}

// --- list ---

test('list prints column headers above the data', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list'], cwd);
    const [header, rule] = out.split('\n');
    assert.match(header, /^id\s+type\s+status\s+title$/);
    assert.match(rule, /^-+\s+-+\s+-+\s+-+$/);
  });
});

test('list --full adds the columns the default view has no room for', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list', '--full'], cwd);
    assert.match(out.split('\n')[0], /^id\s+type\s+status\s+origin\s+layer\s+scope\s+title$/);
    assert.match(out, /human/);
  });
});

test('list --summary counts by category instead of listing rows', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['list', '--summary'], cwd);
    assert.match(out, /^type\s+items$/m);
    assert.match(out, /^constraint\s+1$/m);
    assert.match(out, /2 item\(s\)/);
    assert.doesNotMatch(out, /CONST-pool-capped-at-20/);
  });
});

test('list --json is parseable JSON carrying fields no column shows', () => {
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['list', '--json'], cwd).out) as {
      items: { id: string; scope: string[]; origin: string; layer: string }[];
      count: number;
      loadErrors: unknown[];
    };
    assert.equal(parsed.count, 2);
    assert.deepEqual(parsed.loadErrors, []);
    const constraint = parsed.items.find((i) => i.id === 'CONST-pool-capped-at-20');
    assert.ok(constraint, 'the constraint is in the document');
    assert.equal(constraint.origin, 'human');
    assert.equal(constraint.layer, 'project');
    assert.deepEqual(constraint.scope, []);
  });
});

test('a category filter still works when a flag precedes it', () => {
  // `args[0]` would read "--json" as the category filter and list nothing —
  // an empty answer that looks like a true one.
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['list', '--json', 'lesson'], cwd).out) as { count: number };
    assert.equal(parsed.count, 1);
  });
});

test('list --json reports a corpus load error inside the document, keeping it parseable', () => {
  withProject((cwd) => {
    seed(cwd);
    mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
    writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter\n');
    const { code, out } = run(['list', '--json'], cwd);
    assert.equal(code, 0, 'F2: list did its job');
    const parsed = JSON.parse(out) as { loadErrors: { file: string }[] };
    assert.equal(parsed.loadErrors.length, 1);
    assert.match(parsed.loadErrors[0].file, /CONST-broken\.md/);
  });
});

test('the usage banner never runs a long usage string into its summary', () => {
  // `padEnd(28)` produced `status [--full|--short|--summary] [--json]counts,
  // review queue, …` once the detail flags were added to the usage strings.
  withProject((cwd) => {
    const { out } = run(['--help'], cwd);
    assert.match(out, /\[--json\] {2}counts, review queue/);
    assert.doesNotMatch(out, /\][a-z]/, 'no summary starts immediately after a "]"');
  });
});

// --- status ---

test('status --json carries the counts, the queue, health and the usage caveat', () => {
  withProject((cwd) => {
    seed(cwd);
    const { code, out } = run(['status', '--json'], cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as {
      profile: string;
      items: { total: number; byCategory: Record<string, number> };
      reviewQueue: { drafts: number };
      usage: { sessionsRecorded: number; cold: number; caveat: string };
      health: { errors: number; warnings: number; infos: number };
      ingest: unknown[];
      loadErrors: unknown[];
    };
    assert.equal(parsed.profile, 'standard');
    assert.equal(parsed.items.total, 2);
    assert.equal(parsed.items.byCategory.constraint, 1);
    assert.equal(parsed.reviewQueue.drafts, 0);
    assert.equal(parsed.usage.sessionsRecorded, 0);
    // The hedge is DATA, not decoration: a consumer ranking items by "cold"
    // is exactly the reader who must be told the ledger records injection.
    assert.match(parsed.usage.caveat, /records injection, not reading/);
    assert.equal(typeof parsed.health.errors, 'number');
    assert.deepEqual(parsed.ingest, []);
    assert.deepEqual(parsed.loadErrors, []);
  });
});

test('status --summary drops the tallies but keeps the queue, usage and health lines', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['status', '--summary'], cwd);
    assert.doesNotMatch(out, /by category/);
    assert.match(out, /review queue:/);
    assert.match(out, /usage:/);
    assert.match(out, /health:/);
  });
});

test('status prints tallies as headed tables at the default level', () => {
  withProject((cwd) => {
    seed(cwd);
    const { out } = run(['status'], cwd);
    assert.match(out, /^\s{2}category\s+items$/m);
    assert.match(out, /^\s{2}status\s+items$/m);
    assert.match(out, /^\s{2}origin\s+items$/m);
  });
});

test('status --full shows an ingest session\'s pending anchors, which no column can carry', () => {
  withProject((cwd) => {
    const id = ingestSession(cwd);
    const short = run(['status'], cwd).out;
    assert.match(short, /ingest: 1 unfinished session/);
    assert.doesNotMatch(short, /pending: session-policy/);

    const full = run(['status', '--full'], cwd).out;
    assert.match(full, new RegExp(`${id} pending: session-policy`));

    const parsed = JSON.parse(run(['status', '--json'], cwd).out) as {
      ingest: { id: string; applied: number; chunks: number; pendingAnchors: string[] }[];
    };
    assert.equal(parsed.ingest.length, 1);
    assert.equal(parsed.ingest[0].applied, 1);
    assert.equal(parsed.ingest[0].chunks, 2);
    assert.deepEqual(parsed.ingest[0].pendingAnchors, ['session-policy']);
  });
});

test('two detail levels at once is refused rather than one being silently chosen', () => {
  withProject((cwd) => {
    const { code, out } = run(['status', '--full', '--summary'], cwd);
    assert.equal(code, 1);
    assert.match(out, /only one of/);
  });
});

// --- decay ---

test('decay --json carries every list plus the caveat, and --summary carries no rows', () => {
  withProject((cwd) => {
    seed(cwd);
    const parsed = JSON.parse(run(['decay', '--json'], cwd).out) as {
      window: number; sessionsRecorded: number; caveat: string;
      counts: { cold: number; unscoped: number; warm: number };
      unscoped: { id: string }[];
    };
    assert.equal(parsed.window, 20);
    assert.equal(parsed.sessionsRecorded, 0);
    assert.match(parsed.caveat, /NOT mean unused/);
    assert.equal(parsed.counts.unscoped, 1, 'the constraint has no scope');
    assert.equal(parsed.unscoped[0].id, 'CONST-pool-capped-at-20');

    const summary = run(['decay', '--summary'], cwd).out;
    assert.match(summary, /cold 0, unscoped 1, warm 0/);
    assert.doesNotMatch(summary, /CONST-pool-capped-at-20/);
    // The hedge survives every detail level — a shorter report may drop rows,
    // never the reason its own headline might mislead.
    assert.match(summary, /NOT mean unused/);
    // And with an empty ledger it says there is NO measurement, rather than
    // hedging a real signal that does not exist.
    assert.match(summary, /no sessions recorded yet — nothing here has been measured/);
    assert.doesNotMatch(summary, /only 0 session\(s\)/);
  });
});

/**
 * Review finding, and the fourth instance of the class: `decay --full`
 * rendered a PINNED item's scope as `(none)`, in a report whose own summary
 * said `unscoped 0` and whose own module defines unscoped as "no scope AND no
 * pin". On this repo that was 7 of 25 cold rows — `RULE-erasable-syntax-only`
 * and `CONST-zero-runtime-dependencies` among them — each inviting exactly
 * the wrong action. `list --full` renders the same field as `always`, so the
 * two commands disagreed about the same value inside one release.
 */
test('decay --full says "always" for a pinned item, never "(none)", agreeing with list --full', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'rule', 'RULE-pinned.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---
id: RULE-pinned
type: rule
title: A pinned rule with no scope
status: active
always: true
directive: do
---

# A pinned rule with no scope

Body.
`, 'utf8');

    const full = run(['decay', '--full'], cwd).out;
    assert.match(full, /^\s+RULE-pinned\s+rule\s+0\s+never\s+always\s/m);
    assert.doesNotMatch(full, /RULE-pinned.*\(none\)/);
    // It is cold, not unscoped — a pin reaches every session.
    assert.match(full, /cold \(1\)/);
    assert.doesNotMatch(full, /^unscoped \(/m);

    // The same field, the same word, in the other command that shows it.
    assert.match(run(['list', 'rule', '--full'], cwd).out, /RULE-pinned\s+rule\s+active\s+human\s+project\s+always/);

    // And the machine surface carries the distinction rather than leaving a
    // consumer to infer "unscoped" from an empty scope array.
    const parsed = JSON.parse(run(['decay', '--json'], cwd).out) as
      { cold: { id: string; always: boolean; scope: string[] }[] };
    assert.equal(parsed.cold[0].always, true);
    assert.deepEqual(parsed.cold[0].scope, []);
  });
});

test('decay prints headers over its rows', () => {
  withProject((cwd) => {
    seed(cwd);
    assert.match(run(['decay'], cwd).out, /^\s{2}id\s+type\s+usage\s+title$/m);
    assert.match(run(['decay', '--full'], cwd).out, /^\s{2}id\s+type\s+injections\s+last injected\s+scope\s+title$/m);
  });
});

// --- doctor ---

test('doctor --json carries findings, counts and the exit code it returns', () => {
  withProject((cwd) => {
    seed(cwd);
    const { code, out } = run(['doctor', '--json'], cwd);
    const parsed = JSON.parse(out) as {
      counts: { errors: number }; exitCode: number; findings: { level: string; code: string }[];
    };
    assert.equal(parsed.exitCode, code, 'the reported code is the returned code');
    assert.equal(parsed.counts.errors, 0);
    assert.ok(Array.isArray(parsed.findings));
  });
});

test('doctor --full lists one headed row per finding; --summary is the one-line form', () => {
  withProject((cwd) => {
    // A dead scope glob is a warn-level finding, so there is a row to show.
    run(['add', 'constraint', 'Scoped at a directory that does not exist'], cwd);
    const file = path.join(cwd, '.my_context', 'items', 'constraint',
      'CONST-scoped-at-a-directory-that-does-not-exist.md');
    const text = readFileSync(file, 'utf8');
    writeFileSync(file, text.replace('scope: []', 'scope:\n  - nope/**'), 'utf8');

    const full = run(['doctor', '--full'], cwd).out;
    assert.match(full, /^level\s+code\s+item\s+message$/m);
    assert.match(full, /^warn\s+dead_scope/m);

    const summary = run(['doctor', '--summary'], cwd).out;
    assert.match(summary, /my_context doctor: \d+ error\(s\)/);
    assert.doesNotMatch(summary, /dead_scope/);
    // `--quiet` predates the levels and still means the same thing.
    assert.equal(run(['doctor', '--quiet'], cwd).out, summary);
  });
});

// --- ingest-status ---

test('ingest-status renders per-anchor progress in --full and --json, and a table by default', () => {
  withProject((cwd) => {
    const id = ingestSession(cwd);

    const short = run(['ingest-status'], cwd).out;
    assert.match(short, /^session\s+source\s+applied$/m);
    assert.match(short, new RegExp(`${id}\\s+docs/prd\\.md\\s+1/2`));
    assert.doesNotMatch(short, /applied\s+password-policy/);

    const full = run(['ingest-status', '--full'], cwd).out;
    assert.match(full, /applied\s+password-policy/);
    assert.match(full, /pending\s+session-policy/);

    const parsed = JSON.parse(run(['ingest-status', '--json'], cwd).out) as {
      id: string; applied: number; anchors: { anchor: string; applied: boolean }[];
    }[];
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].applied, 1);
    assert.deepEqual(parsed[0].anchors, [
      { anchor: 'password-policy', applied: true },
      { anchor: 'session-policy', applied: false },
    ]);

    assert.match(run(['ingest-status', '--summary'], cwd).out, /1 ingest session\(s\), 1 unfinished/);
  });
});

test('ingest-status --json on a workspace with no sessions is an empty array, not prose', () => {
  withProject((cwd) => {
    assert.deepEqual(JSON.parse(run(['ingest-status', '--json'], cwd).out), []);
  });
});

// --- review list ---

test('review list prints headers, and --json carries the body a column cannot', () => {
  withProject((cwd) => {
    const file = path.join(cwd, '.my_context', 'items', 'requirement', 'REQ-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---
id: REQ-a
type: requirement
title: Requirement A
status: draft
severity: soft
always: false
origin: ingest
source_file: docs/prd.md
source_anchor: password-policy
---

# Requirement A

Body text.
`, 'utf8');

    const short = run(['review', 'list'], cwd).out;
    assert.match(short, /^id\s+type\s+origin\s+source\s+title$/m);

    assert.match(run(['review', 'list', '--full'], cwd).out,
      /^id\s+type\s+origin\s+severity\s+scope\s+source\s+title$/m);

    assert.match(run(['review', 'list', '--summary'], cwd).out, /^1 draft\(s\) pending\./m);

    const parsed = JSON.parse(run(['review', 'list', '--json'], cwd).out) as {
      drafts: { id: string; body: string; sourceAnchor: string }[]; count: number;
    };
    assert.equal(parsed.count, 1);
    assert.equal(parsed.drafts[0].sourceAnchor, 'password-policy');
    assert.match(parsed.drafts[0].body, /Body text/);
  });
});
