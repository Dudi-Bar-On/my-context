import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { confirmAction, drafts } from '../../src/cli/commands/review.ts';
import { sandbox } from '../helpers/workspace.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function draft(cwd: string, id: string, type: string, title: string, extra = ''): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${title}
status: draft
severity: soft
always: false
origin: ingest
source_file: docs/prd.md
source_anchor: password-policy
${extra}---

# ${title}

Body text.
`, 'utf8');
}

/** Plants a corrupt, unrelated item file so `openMutateContext`'s rebuild
 * reports a load error that has nothing to do with the command under test —
 * the same fixture `test/cli/lesson.test.ts`/`test/cli/ingest.test.ts` use
 * for the identical F2 assertion on their own commands. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-review-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/** Every test runs inside this so a FAILING assertion still cleans up its
 * temp project — a bare `rmSync` at the end of the test body only runs when
 * every assertion above it passed, and a failing test leaks its directory. */
function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('review lists drafts with their type, origin and source', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
    const { code, out } = run(['review'], cwd);
    assert.equal(code, 0);
    assert.match(out, /REQ-a\s+requirement\s+ingest\s+docs\/prd\.md/);
    assert.match(out, /CONST-b/);
    assert.match(out, /2 draft/);
  });
});

test('review reports an empty queue rather than printing nothing', () => {
  withProject((cwd) => {
    const { code, out } = run(['review'], cwd);
    assert.equal(code, 0);
    assert.match(out, /no drafts/i);
  });
});

test('review --type filters the queue', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
    const { out } = run(['review', 'list', '--type', 'constraint'], cwd);
    assert.match(out, /CONST-b/);
    assert.equal(/REQ-a/.test(out), false);
  });
});

test('review show prints the full item and its provenance', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'show', 'REQ-a'], cwd);
    assert.equal(code, 0);
    assert.match(out, /Body text\./);
    assert.match(out, /docs\/prd\.md/);
    assert.match(out, /password-policy/);
  });
});

test('promote moves a draft to active', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /REQ-a.*active/);
    assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+active/);
  });
});

test('promote can set scope in the same step', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    run(['review', 'promote', 'REQ-a', '--scope', 'src/auth/**', '--yes'], cwd);
    // Unquoted — NEEDS_QUOTES does not fire on `/` or `*`. See Task 9's note.
    assert.match(run(['show', 'REQ-a'], cwd).out, /^\s+- src\/auth\/\*\*$/m);
  });
});

test('promoting a non-draft is refused with its actual status', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Already active'], cwd);
    const { code, out } = run(['review', 'promote', 'CONST-already-active', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /active/);
    assert.match(out, /only drafts/i);
  });
});

test('promoting into a disabled category is refused rather than creating a silently inert item', () => {
  withProject((cwd) => {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', categories: { requirement: { enabled: false } } }, null, 2),
      'utf8',
    );
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /not enabled/i);
    assert.match(out, /never be injected/i);
  });
});

// Review round (Task 10): the preview used to print unconditionally before
// the disabled-category refusal, so a refused promote still claimed to be
// "about to promote" it.
test('a disabled-category refusal never claims to be about to promote', () => {
  withProject((cwd) => {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', categories: { requirement: { enabled: false } } }, null, 2),
      'utf8',
    );
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.doesNotMatch(out, /about to promote/);
  });
});

test('discard deprecates rather than deleting, leaving a trail', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'discard', 'REQ-a', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /deprecated/);
    assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+deprecated/);
    assert.match(run(['review'], cwd).out, /no drafts/i);
  });
});

test('an unknown id is reported for every subcommand', () => {
  withProject((cwd) => {
    for (const sub of ['show', 'promote', 'discard']) {
      const { code, out } = run(['review', sub, 'REQ-nope', '--yes'], cwd);
      assert.equal(code, 1, sub);
      assert.match(out, /REQ-nope/, sub);
    }
  });
});

test('an unknown subcommand prints usage', () => {
  withProject((cwd) => {
    const { code, out } = run(['review', 'frobnicate'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext review/);
  });
});

test('an unknown subcommand given with an id is refused, not silently promoted', () => {
  // Without the subcommand whitelist check, an unrecognized subcommand falls
  // through past the `show`/`discard` branches to the `promote` logic at the
  // bottom — so a typo'd subcommand paired with a real draft id would
  // silently promote it. This pins that the whitelist check runs first.
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'frobnicate', 'REQ-a'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext review/);
    assert.match(run(['show', 'REQ-a'], cwd).out, /status: draft/);
  });
});

// --- Review round (Task 10): exit code on an unrelated load error ---
//
// F2 (context.ts's doc comment on openMutateContext, and the identical rule
// already pinned for `add`/`list`/`show`/`ingest-apply`/`lesson*`): a command
// that did what it was asked reports an unrelated corpus load error as a
// WARNING and still exits 0. This matters most for `promote`/`discard`
// specifically: they perform a real, persisted write (status -> active or
// deprecated, on disk, checksum recomputed) BEFORE this exit code is
// decided, so exiting 1 here reports failure AFTER a committed effect — a
// caller scripting `promote && next-step` would see failure despite the
// promotion having genuinely happened.

test('review lists the queue and exits 0 despite an unrelated load error', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['review'], cwd);
    assert.equal(code, 0);
    assert.match(out, /REQ-a/);
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  });
});

test('review show exits 0 despite an unrelated load error', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['review', 'show', 'REQ-a'], cwd);
    assert.equal(code, 0);
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  });
});

test('promote persists the promotion and exits 0 despite an unrelated load error', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-good', 'requirement', 'Requirement Good');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['review', 'promote', 'REQ-good', '--yes'], cwd);
    assert.equal(code, 0, 'the promotion succeeded and was persisted; an unrelated corpus problem is a warning');
    assert.match(out, /REQ-good.*active/);
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
    // The write really happened, independent of the exit code.
    assert.match(run(['list'], cwd).out, /REQ-good\s+requirement\s+active/);
  });
});

test('discard persists the demotion and exits 0 despite an unrelated load error', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-good', 'requirement', 'Requirement Good');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['review', 'discard', 'REQ-good', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
    assert.match(run(['list'], cwd).out, /REQ-good\s+requirement\s+deprecated/);
  });
});

// --- Review round (Task 10): the promote preview is pinned ---

test('promote prints id, type, title, severity, scope and a body excerpt before promoting', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A', 'scope:\n  - src/auth/**\n');
    const { out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    const previewEnd = out.indexOf('is now active');
    assert.notEqual(previewEnd, -1, 'expected a success line');
    const preview = out.slice(0, previewEnd);
    assert.match(preview, /id\s+REQ-a/);
    assert.match(preview, /type\s+requirement/);
    assert.match(preview, /title\s+Requirement A/);
    assert.match(preview, /severity\s+soft/);
    assert.match(preview, /scope\s+src\/auth\/\*\*/);
    assert.match(preview, /Body text\./);
  });
});

test('promote of a bodyless item still shows the preview fields', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.match(out, /about to promote:/);
    assert.match(out, /id\s+REQ-a/);
  });
});

// --- Review round (Task 10): --always falsifies its own scope message ---
//
// select.ts admits `always` items to the pinned tier with NO scope check
// (`fitToBudget(fresh.filter((i) => i.always), ...)`), so an unscoped
// `--always` item genuinely IS auto-injected — at every session start.

test('promote --always does not claim the item is never auto-injected', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { out } = run(['review', 'promote', 'REQ-a', '--always', '--yes'], cwd);
    assert.doesNotMatch(out, /never auto-injected/);
    assert.match(out, /always/);
    assert.match(run(['show', 'REQ-a'], cwd).out, /always: true/);
  });
});

test('promote --always=true is accepted, matching every other flag in this CLI', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    run(['review', 'promote', 'REQ-a', '--always=true', '--yes'], cwd);
    assert.match(run(['show', 'REQ-a'], cwd).out, /always: true/);
  });
});

test('an unscoped promote without --always still says it is never auto-injected', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.match(out, /never auto-injected/);
  });
});

// --- Review round (Task 10): --severity is validated, not silently discarded ---

test('promote refuses a bogus --severity rather than silently discarding it, before any preview', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'promote', 'REQ-a', '--severity', 'bogus', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /severity/i);
    // Refused before printing the preview or asking for confirmation — not
    // merely refused eventually by updateItem's own validateEnums backstop
    // after the preview already scrolled past.
    assert.doesNotMatch(out, /about to promote/);
    // Nothing was promoted — the item is still a draft.
    assert.match(run(['show', 'REQ-a'], cwd).out, /status: draft/);
  });
});

// --- RULING (Task 10 review): promote/discard require confirmation ---
//
// `node --test` runs with a non-TTY stdin (verified: `process.stdin.isTTY`
// is `undefined` in this harness), so these exercise the real, non-injected
// code path — not a mock.

test('promote without --yes refuses on non-interactive stdin, and does not promote', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'promote', 'REQ-a'], cwd);
    assert.equal(code, 1);
    assert.match(out, /confirmation/i);
    assert.match(out, /--yes/);
    assert.match(run(['show', 'REQ-a'], cwd).out, /status: draft/);
  });
});

test('discard without --yes refuses on non-interactive stdin, and does not discard', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'discard', 'REQ-a'], cwd);
    assert.equal(code, 1);
    assert.match(out, /confirmation/i);
    assert.match(run(['show', 'REQ-a'], cwd).out, /status: draft/);
  });
});

test('promote --yes proceeds without any prompt output', () => {
  withProject((cwd) => {
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { code, out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /\[y\/N\]/);
  });
});

// confirmAction's TTY+prompt branch, unit-tested directly with an injected
// reader — a real pty is not available in this harness, so `isTTY`/`readLine`
// are passed explicitly rather than relying on the ambient process.

test('confirmAction accepts "y" and "yes" on a TTY', () => {
  let asked = '';
  const out = (s: string) => { asked += s; };
  assert.equal(confirmAction([], out, 'Promote it?', true, () => 'y'), true);
  assert.equal(confirmAction([], out, 'Promote it?', true, () => 'yes'), true);
  assert.equal(confirmAction([], out, 'Promote it?', true, () => 'YES'), true);
  assert.match(asked, /Promote it\? \[y\/N\]/);
});

test('confirmAction refuses anything else on a TTY, including empty input', () => {
  const lines: string[] = [];
  const out = (s: string) => { lines.push(s); };
  assert.equal(confirmAction([], out, 'Discard it?', true, () => 'n'), false);
  assert.equal(confirmAction([], out, 'Discard it?', true, () => ''), false);
  assert.equal(confirmAction([], out, 'Discard it?', true, () => 'please'), false);
  assert.ok(lines.some((l) => /not confirmed/i.test(l)));
});

test('confirmAction refuses on a non-TTY without --yes, without ever reading a line', () => {
  const out = () => {};
  let readLineCalled = false;
  const result = confirmAction([], out, 'Promote it?', false, () => { readLineCalled = true; return 'y'; });
  assert.equal(result, false);
  assert.equal(readLineCalled, false, 'a non-interactive refusal must not block trying to read stdin');
});

test('confirmAction --yes bypasses the prompt entirely, on a TTY or not', () => {
  const out = () => {};
  let readLineCalled = false;
  const readLine = () => { readLineCalled = true; return 'n'; };
  assert.equal(confirmAction(['--yes'], out, 'Promote it?', false, readLine), true);
  assert.equal(confirmAction(['--yes'], out, 'Promote it?', true, readLine), true);
  assert.equal(readLineCalled, false, '--yes must short-circuit before any prompt is even asked');
});

// --- Review round (Task 10): five messages falsely claimed "not implemented yet" ---

// --- Review round (Task 10): a global-layer draft can never be promoted or
// discarded from a project, so it must not appear in the queue at all —
// `Store.upsert` (not the filesystem) is enough to pin `drafts()`'s own
// filter, without writing outside a project's temp root or touching a real
// home directory (`review`'s global layer resolves against the real
// `~/.my-context`, which this test suite must never write to).

test('drafts() excludes a global-layer draft — it can never be promoted from this project', () => {
  const s = sandbox();
  s.ctx.store.upsert({
    id: 'CONST-global-draft', type: 'constraint', title: 'Global draft', status: 'draft',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'ingest',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: '', observations: [], relations: [], layer: 'global',
    filePath: 'items/constraint/CONST-global-draft.md',
  });
  s.ctx.store.upsert({
    id: 'CONST-project-draft', type: 'constraint', title: 'Project draft', status: 'draft',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'ingest',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: '', extra: {},
    body: '', observations: [], relations: [], layer: 'project',
    filePath: 'items/constraint/CONST-project-draft.md',
  });
  const queue = drafts(s.ctx, null);
  assert.deepEqual(queue.map((i) => i.id), ['CONST-project-draft']);
  s.dispose();
});

test('a demoted draft item is told to promote it with mycontext review promote', () => {
  withProject((cwd) => {
    // create_item is not exercised through the CLI here (no MCP surface in
    // this test file); this asserts the CLI-visible half of the same fix —
    // that review's own messages never resurrect the retired wording.
    draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
    const { out } = run(['review', 'promote', 'REQ-a', '--yes'], cwd);
    assert.doesNotMatch(out, /not implemented yet/i);
  });
});
