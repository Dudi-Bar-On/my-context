/**
 * `mycontext inbox-promote` — the way out of the inbox (plan Task 4).
 *
 * The load-bearing tests here are the two that pin the trust boundary, and
 * they are a PAIR on purpose. `an agent-authored note lands as a draft` and
 * `a human-authored note lands active` differ in exactly one input — who
 * authored the capture — so together they say that the demotion comes from
 * the origin being carried forward and not from a blanket rule this command
 * invented. Either one alone passes on a command that hardcodes its answer,
 * which is the half-checking this repository keeps paying for.
 *
 * The other pair is `the target is created before the origin is retired`
 * and the dry-run test: between them they say that neither half of the write
 * can land alone unannounced.
 *
 * Refusals are asserted against THIS COMMAND's usage line, never against the
 * top-level banner — see `test/cli/add-flags.test.ts` for why an assertion
 * against the banner can pass on another command's advertisement of the same
 * flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/**
 * The same output with every run of whitespace collapsed to one space. The
 * closing sentences go through `paragraph` (format.ts) and wrap to the layout
 * budget, so a regex over the raw text misses a phrase that is plainly there.
 */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

/** A throwaway project, disposed by the caller. */
function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inbox-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

/**
 * A note authored the way an agent authors one: through the MCP write path,
 * which stamps `origin: 'agent'` in the HANDLER and refuses to take an origin
 * from the tool call at all. This must not be weakened to a CLI-authored note
 * with a flag — the whole point of the assertion it serves is that the origin
 * came from a surface that cannot claim to be human.
 */
function agentNote(cwd: string, title: string): void {
  const result = createRegistry(cwd).call('create_item', { type: 'note', title });
  assert.ok(JSON.stringify(result).includes('NOTE-'), `the agent note was not created: ${JSON.stringify(result)}`);
}

/** Every item file under the workspace, by path, with its bytes. */
function corpus(cwd: string): Record<string, string> {
  const lines: string[] = [];
  runCli(['list', '--json'], cwd, (s) => lines.push(s));
  const listed = JSON.parse(lines.join('\n')) as { items: { id: string; filePath: string }[] };
  const out: Record<string, string> = {};
  for (const item of listed.items) {
    out[item.filePath] = readFileSync(path.join(cwd, '.my_context', item.filePath), 'utf8');
  }
  return out;
}

test('a note promoted to a decision creates the decision and links back with derived_from', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Maybe we should pin the pool size', '--yes'], cwd);
    const promoted = run(
      ['inbox-promote', 'NOTE-maybe-we-should-pin-the-pool-size', '--to', 'decision', '--yes'],
      cwd,
    );
    assert.equal(promoted.code, 0, promoted.out);

    const shown = run(['show', 'DEC-maybe-we-should-pin-the-pool-size'], cwd);
    assert.equal(shown.code, 0, shown.out);
    assert.match(shown.out, /derived_from/);
    assert.match(shown.out, /NOTE-maybe-we-should-pin-the-pool-size/);
    // The direction, not merely the presence of both words on the page: the
    // edge is on the NEW item pointing back, because `derived_from` on the
    // target reads "DEC-x derived from NOTE-y", which is the true sentence.
    assert.match(prose(shown.out), /- derived_from \[\[NOTE-maybe-we-should-pin-the-pool-size\]\]/);
    const back = run(['show', 'NOTE-maybe-we-should-pin-the-pool-size'], cwd);
    assert.doesNotMatch(prose(back.out), /derived_from/,
      'the reverse edge would read "NOTE-y derived from DEC-x", which is false');
  } finally {
    removeTree(cwd);
  }
});

test('the origin is deprecated, not deleted, and stays on disk and searchable', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Maybe we should pin the pool size', '--body', 'Twenty is a guess.',
      '--yes'], cwd);
    run(['inbox-promote', 'NOTE-maybe-we-should-pin-the-pool-size', '--to', 'decision',
      '--yes'], cwd);

    const shown = run(['show', 'NOTE-maybe-we-should-pin-the-pool-size'], cwd);
    assert.equal(shown.code, 0,
      'the origin must still exist — §1.3 marks it resolved rather than deleting it');
    assert.match(shown.out, /deprecated/);
    // Retired, and the body it was captured with is still there: "nothing is
    // deleted" is a claim about content, not only about the file existing.
    assert.match(shown.out, /Twenty is a guess\./);
    // `valid_until` moves with the retirement, whichever write path retires
    // the item — the invariant `stampValidUntil` exists to keep.
    assert.match(shown.out, /valid_until: \d{4}-\d{2}-\d{2}/);

    const found = run(['search', 'pin the pool size'], cwd);
    assert.match(found.out, /NOTE-maybe-we-should-pin-the-pool-size/,
      'a retired capture is still searchable');
  } finally {
    removeTree(cwd);
  }
});

test('an agent-authored note promoted into a normative category lands as a draft', () => {
  const cwd = project();
  try {
    agentNote(cwd, 'The retry loop swallows 5xx');
    const promoted = run(['inbox-promote', 'NOTE-the-retry-loop-swallows-5xx',
      '--to', 'known_issue', '--yes'], cwd);
    assert.equal(promoted.code, 0, promoted.out);

    const shown = run(['show', 'KNOWN-the-retry-loop-swallows-5xx'], cwd);
    assert.match(shown.out, /status: draft/,
      'promotion is not laundering: trustedStatus must still see a non-human origin');
    assert.match(shown.out, /origin: agent/,
      'the origin is carried forward, not restamped — that is what the draft rests on');
    // The preview said so BEFORE the write, which is the half a human acts on.
    assert.match(prose(promoted.out), /origin agent \(carried from NOTE-the-retry-loop-swallows-5xx/);
    assert.match(prose(promoted.out), /status draft/);
  } finally {
    removeTree(cwd);
  }
});

test('a human-authored note promoted into the same normative category lands active', () => {
  const cwd = project();
  try {
    // The twin of the test above, differing in exactly one input. Without it,
    // a command that hardcoded `status: 'draft'` for every normative target
    // would pass the draft assertion and be wrong about every human capture.
    run(['add', 'note', 'The retry loop swallows 5xx', '--yes'], cwd);
    const promoted = run(['inbox-promote', 'NOTE-the-retry-loop-swallows-5xx',
      '--to', 'known_issue', '--yes'], cwd);
    assert.equal(promoted.code, 0, promoted.out);

    const shown = run(['show', 'KNOWN-the-retry-loop-swallows-5xx'], cwd);
    assert.match(shown.out, /status: active/,
      'a human promoting their own note is what `mycontext add known_issue` already is');
    assert.match(shown.out, /origin: human/);
  } finally {
    removeTree(cwd);
  }
});

test('the title, body and tags travel, and --title replaces the title alone', () => {
  const cwd = project();
  try {
    run(['add', 'todo', 'Pin the pool', '--body', 'It flaps under load.',
      '--tags', 'db,perf', '--yes'], cwd);
    const promoted = run(['inbox-promote', 'TODO-pin-the-pool', '--to', 'decision',
      '--title', 'The Postgres pool is capped at twenty', '--yes'], cwd);
    assert.equal(promoted.code, 0, promoted.out);

    const shown = run(['show', 'DEC-the-postgres-pool-is-capped-at-twenty'], cwd);
    assert.equal(shown.code, 0, shown.out);
    assert.match(shown.out, /^title: The Postgres pool is capped at twenty$/m);
    assert.match(shown.out, /It flaps under load\./, 'the body travels');
    assert.match(prose(shown.out), /tags: - db - perf/, 'the tags travel');
  } finally {
    removeTree(cwd);
  }
});

test('promoting into todo or note is refused', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    for (const target of ['todo', 'note']) {
      const refused = run(['inbox-promote', 'NOTE-something', '--to', target, '--yes'], cwd);
      assert.equal(refused.code, 1, refused.out);
      assert.match(prose(refused.out), /stays in the inbox/i);
      // Refused BEFORE the preview: a refusal preceded by "about to promote"
      // reads as a report of something that then did not happen.
      assert.doesNotMatch(refused.out, /about to promote/);
    }
    assert.match(run(['show', 'NOTE-something'], cwd).out, /status: active/,
      'a refused promotion writes nothing');
  } finally {
    removeTree(cwd);
  }
});

test('promoting an item that is not a todo or a note is refused by name', () => {
  const cwd = project();
  try {
    run(['add', 'decision', 'Use Postgres', '--yes'], cwd);
    const refused = run(['inbox-promote', 'DEC-use-postgres', '--to', 'adr', '--yes'], cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.match(prose(refused.out), /is a decision, not a todo or a note/);
    assert.doesNotMatch(refused.out, /about to promote/);
  } finally {
    removeTree(cwd);
  }
});

test('an unknown id is refused, and the message names where to look', () => {
  const cwd = project();
  try {
    const refused = run(['inbox-promote', 'NOTE-nothing-here', '--to', 'decision', '--yes'], cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.match(prose(refused.out), /no item with id "NOTE-nothing-here"/);
    assert.match(prose(refused.out), /mycontext todo/);
  } finally {
    removeTree(cwd);
  }
});

test('an unknown target category fails once, with the catalogue named', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    const refused = run(['inbox-promote', 'NOTE-something', '--to', 'nonsense', '--yes'], cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /nonsense/);
    assert.match(refused.out, /decision/, 'the enum error lists the real categories');
    // ONE message, from `resolveCategory` — not a second wording invented
    // here that could drift from it.
    assert.equal(refused.out.split('\n').filter((l) => l.startsWith('my_context:')).length, 1);
    assert.doesNotMatch(refused.out, /about to promote/);
  } finally {
    removeTree(cwd);
  }
});

test('the target is created before the origin is retired, so a refused create leaves the inbox whole', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    const before = corpus(cwd);
    const refused = run(['inbox-promote', 'NOTE-something', '--to', 'nonsense', '--yes'], cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.deepEqual(corpus(cwd), before,
      'the create is refused before anything about the origin has moved');
  } finally {
    removeTree(cwd);
  }
});

test('without --yes it previews, refuses, and writes nothing', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    const before = corpus(cwd);
    const declined = run(['inbox-promote', 'NOTE-something', '--to', 'decision'], cwd);
    assert.equal(declined.code, 1, declined.out);
    assert.match(declined.out, /about to promote out of the inbox:/);
    assert.match(declined.out, /refusing without confirmation/);
    assert.deepEqual(corpus(cwd), before, 'a declined promotion writes neither half');
  } finally {
    removeTree(cwd);
  }
});

/**
 * The half-completed promotion, which is the only failure this command's
 * ordering can actually produce and therefore the one its message has to be
 * right about.
 *
 * Windows-only, and the mechanism is why: making the origin's file read-only
 * turns `persist`'s rename into an EPERM, which is a real filesystem refusal
 * rather than a stub. On POSIX the same bit does not stop a rename — the
 * directory's permissions govern — so this would not reproduce there, and the
 * same reasoning is already recorded on the NTFS hazard tests in
 * `test/core/snapshot.test.ts` and `test/lesson/derive-guards.test.ts`.
 *
 * What it pins is the whole point of creating the target first: the target
 * exists, the message says so, and it names the one command that finishes the
 * job. A promotion that stopped half way and reported either "created" or a
 * bare error would leave the user with a corpus they were not told about.
 */
test('a retirement that fails leaves the target named, and the finishing command with it', {
  skip: process.platform !== 'win32'
    ? 'Windows-only: a read-only file refuses a rename over it only on NTFS'
    : false,
}, () => {
  const cwd = project();
  const file = path.join(cwd, '.my_context', 'items', 'note', 'NOTE-something.md');
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    chmodSync(file, 0o444);
    const halfway = run(['inbox-promote', 'NOTE-something', '--to', 'decision', '--yes'], cwd);
    assert.equal(halfway.code, 1, halfway.out);
    assert.match(prose(halfway.out), /DEC-something exists and is not affected by that/);
    assert.match(prose(halfway.out), /the promotion is half done/);
    assert.match(prose(halfway.out),
      /`mycontext edit NOTE-something --status deprecated`/);
    chmodSync(file, 0o666);

    // Both halves of the claim are true on disk: the target landed, and the
    // capture is untouched — still active, not left in some third state.
    assert.equal(run(['show', 'DEC-something'], cwd).code, 0,
      'the message says the target exists; it must');
    assert.match(run(['show', 'NOTE-something'], cwd).out, /status: active/,
      'the message says the capture is still active; it must be');
  } finally {
    try { chmodSync(file, 0o666); } catch { /* the add may not have got that far */ }
    removeTree(cwd);
  }
});

test('what stays behind is named rather than dropped', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--note', 'It came up in review.',
      '--scope', 'src/db/**', '--yes'], cwd);
    const promoted = run(['inbox-promote', 'NOTE-something', '--to', 'decision', '--yes'], cwd);
    assert.equal(promoted.code, 0, promoted.out);
    assert.match(prose(promoted.out), /NOTE-something keeps its scope, its 1 observation\(s\)/);
    // And the claim is true: the new item really does not carry them.
    const shown = run(['show', 'DEC-something'], cwd);
    assert.doesNotMatch(shown.out, /src\/db/);
    assert.doesNotMatch(shown.out, /It came up in review\./);
    // …and the origin really does keep them.
    const kept = run(['show', 'NOTE-something'], cwd);
    assert.match(kept.out, /It came up in review\./);
    assert.match(kept.out, /src\/db/);
  } finally {
    removeTree(cwd);
  }
});

test('an unknown flag is refused against this command\'s own usage, before anything opens', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    const refused = run(['inbox-promote', 'NOTE-something', '--to', 'decision', '--yse'], cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.match(refused.out, /unknown option "--yse"/);
    assert.match(refused.out, /usage: mycontext inbox-promote <todo or note id> --to <category>/);
  } finally {
    removeTree(cwd);
  }
});

test('a second positional is refused rather than swallowed', () => {
  const cwd = project();
  try {
    run(['add', 'note', 'Something', '--yes'], cwd);
    const refused = run(['inbox-promote', 'NOTE-something', 'decision', '--to', 'adr', '--yes'],
      cwd);
    assert.equal(refused.code, 1, refused.out);
    assert.match(prose(refused.out), /unexpected argument "decision"/);
    assert.doesNotMatch(refused.out, /about to promote/);
  } finally {
    removeTree(cwd);
  }
});

test('the id and --to are both required, and neither is guessed', () => {
  const cwd = project();
  try {
    assert.match(run(['inbox-promote'], cwd).out, /usage: mycontext inbox-promote/);
    assert.match(run(['inbox-promote', 'NOTE-something'], cwd).out,
      /usage: mycontext inbox-promote/);
    assert.equal(run(['inbox-promote', 'NOTE-something'], cwd).code, 1);
  } finally {
    removeTree(cwd);
  }
});

test('a promoted todo is still counted by `mycontext todo --all`', () => {
  const cwd = project();
  try {
    run(['add', 'todo', 'Pin the pool', '--yes'], cwd);
    run(['inbox-promote', 'TODO-pin-the-pool', '--to', 'decision', '--yes'], cwd);

    const listed = run(['todo'], cwd);
    assert.match(prose(listed.out), /1 retired \(superseded\/deprecated\/validated\) and not shown/,
      'hidden is fine; unmentioned is not');
    assert.match(run(['todo', '--all'], cwd).out, /TODO-pin-the-pool/);
  } finally {
    removeTree(cwd);
  }
});
