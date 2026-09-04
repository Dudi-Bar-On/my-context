/**
 * `mycontext link <from> <relation> <to>` — the CLI spelling `link_items` had
 * and the terminal did not (owner instruction, 2026-09-04: "support relation
 * using the cli too"). See `src/cli/commands/link.ts` for why it takes no
 * `--yes`: adding an edge crosses no trust boundary, the same fact that gives
 * `link_items` no `origin` at all.
 *
 * This is a thin CLI wrapper over `linkItems` (core/relations.ts), which
 * already owns every refusal — the vocabulary, the self-link check, the
 * retirement-edge redirect, the duplicate-edge no-op. These tests exercise
 * that the wrapper reaches those refusals rather than re-deriving them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { RELATION_TYPES } from '../../src/core/vocabulary.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-link-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function itemFile(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

/** Two active, human-origin items, unlinked. */
function twoItems(cwd: string): { from: string; to: string } {
  run(['add', '--summary-omitted', 'constraint', 'The pool is capped at twenty', '--yes'], cwd);
  run(['add', '--summary-omitted', 'decision', 'Stripe was chosen for payments'], cwd);
  return {
    from: 'CONST-the-pool-is-capped-at-twenty',
    to: 'DEC-stripe-was-chosen-for-payments',
  };
}

test('the registry knows the command, with no --yes in its usage', () => {
  const def = COMMANDS.get('link');
  assert.ok(def, '`mycontext link` is not registered');
  assert.equal(def!.usage, 'link <from> <relation> <to>');
});

test('link writes a relation, no --yes required, and the file carries the edge', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks', to], cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`${from} blocks ${to}`));
    assert.match(itemFile(cwd, 'constraint', from), /blocks \[\[DEC-stripe/);
  });
});

test('a duplicate edge is a no-op that says so, not an error', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    run(['link', from, 'blocks', to], cwd);
    const { code, out } = run(['link', from, 'blocks', to], cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`${from} already blocks ${to}`));
  });
});

test('a self-link is refused', () => {
  withProject((cwd) => {
    const { from } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks', from], cwd);
    assert.equal(code, 1);
    assert.match(out, /cannot link to itself/);
  });
});

test('an unknown relation is refused, naming the real vocabulary rather than restating it', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'not-a-relation', to], cwd);
    assert.equal(code, 1);
    for (const name of RELATION_TYPES) {
      if (name === 'supersedes') continue; // refused by name below its own check, still in the enum
      assert.match(out, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} missing from the printed vocabulary`);
    }
  });
});

test('"supersedes" is refused and redirected to `mycontext supersede`', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'supersedes', to], cwd);
    assert.equal(code, 1);
    assert.match(out, /supersede_item|mycontext supersede/);
    assert.doesNotMatch(itemFile(cwd, 'constraint', from), /supersedes/);
  });
});

test('"superseded_by" is refused the same way, even though it is not in the enum at all', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'superseded_by', to], cwd);
    assert.equal(code, 1);
    assert.match(out, /supersede_item|mycontext supersede/);
  });
});

test('an unresolved target is permitted, with a note', () => {
  withProject((cwd) => {
    const { from } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks', 'CONST-does-not-exist-yet'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /does not exist yet/);
  });
});

test('too few positionals prints usage and the vocabulary', () => {
  withProject((cwd) => {
    const { from } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext link <from> <relation> <to>/);
    assert.match(out, /blocks/);
  });
});

test('an unknown flag is refused — link has no flags at all', () => {
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks', to, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown (flag|option) "--yes"/);
  });
});

test('link is on no approval boundary — no confirmation prompt exists to decline', () => {
  // The probe `test/helpers/approval-boundary.ts` uses: does the command
  // refuse --yes rather than accepting it and asking for confirmation?
  withProject((cwd) => {
    const { from, to } = twoItems(cwd);
    const { code, out } = run(['link', from, 'blocks', to, '--yes', '--zzz-sentinel'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown (flag|option) "--yes"/);
  });
});
