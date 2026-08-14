import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext supersede` is the human route to retiring an item. Before it,
 * there was none: `supersedeItem` was reachable only through the
 * `supersede_item` MCP tool, which refuses a non-human caller retiring a
 * governing normative item — correctly — and the human it deferred to had no
 * command to make that decision with.
 *
 * Every test here goes through `runCli`, i.e. the same dispatch a user hits,
 * because the parts most likely to be wrong (unknown-flag refusal, the
 * confirmation gate, `origin: 'human'`) are all boundary behaviour rather
 * than anything `supersedeItem` itself decides.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-supersede-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function itemFile(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

/** Two active constraints, the ordinary shape of a replacement. `add --yes`
 * passes `origin: 'human'`, so both land `active` rather than `draft`. */
function pair(cwd: string, scope = 'src/db/**'): { old: string; next: string } {
  run(['add', 'constraint', 'Pool capped at 10', '--scope', scope, '--yes'], cwd);
  run(['add', 'constraint', 'Pool capped at 20', '--scope', scope, '--yes'], cwd);
  return { old: 'CONST-pool-capped-at-10', next: 'CONST-pool-capped-at-20' };
}

test('supersede is a registered command', () => {
  assert.ok(COMMANDS.has('supersede'), 'supersede must be a registry command, not a switch arm');
});

test('supersede retires the item and records both directions', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const { code, out } = run(['supersede', old, '--by', next, '--yes'], cwd);

    assert.equal(code, 0, out);
    assert.match(itemFile(cwd, 'constraint', old), /^status: superseded$/m);
    assert.match(itemFile(cwd, 'constraint', old), new RegExp(`- superseded_by \\[\\[${next}\\]\\]`));
    assert.match(itemFile(cwd, 'constraint', next), new RegExp(`- supersedes \\[\\[${old}\\]\\]`));
    // The report names both edges, so a user who does not open the files
    // still learns what was written.
    assert.match(out, /superseded_by/);
    assert.match(out, /supersedes/);
  });
});

/**
 * The whole reason this command exists: `supersedeItem` refuses a non-human
 * caller retiring an `active` normative item, and this is the surface that
 * passes `origin: 'human'`. If the call site dropped it, this retirement
 * would be refused — which is a far better failure than the reverse, but
 * still a broken command.
 */
test('supersede retires an ACTIVE governing normative item — the case the MCP tool refuses', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    // Precondition, asserted rather than assumed: if `add --yes` ever stopped
    // producing an active item, the test below would pass for the wrong
    // reason (an agent may supersede a draft).
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);

    const { code, out } = run(['supersede', old, '--by', next, '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /non-human caller/);
  });
});

test('supersede records --reason as an observation on the replacement', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const { code, out } = run(
      ['supersede', old, '--by', next, '--reason', 'RDS instance resized.', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(itemFile(cwd, 'constraint', next), /RDS instance resized/);
  });
});

/**
 * The preview is what the human is actually approving. `review promote`'s
 * preview was criticised in audit for omitting `always` — the field with the
 * largest injection footprint — so this one states the retiring item's
 * status, the terms on which it is injected today, and what governs
 * afterwards.
 */
test('the preview names the retiring item, its status and the pinned flag', () => {
  withProject((cwd) => {
    // `mycontext add` has no `--always`; the supported route to a pinned item
    // is an agent's draft promoted by a human with `--always`, which is
    // exactly the route `review promote`'s own preview exists to gate.
    const registry = createRegistry(cwd);
    for (const title of ['Run the suite before claiming done', 'Run the suite and read the output']) {
      registry.call('create_item', { type: 'instruction', title, body: 'b' });
    }
    for (const id of ['INSTR-run-the-suite-before-claiming-done', 'INSTR-run-the-suite-and-read-the-output']) {
      const promoted = run(['review', 'promote', id, '--always', '--yes'], cwd);
      assert.equal(promoted.code, 0, promoted.out);
    }

    const { code, out } = run([
      'supersede', 'INSTR-run-the-suite-before-claiming-done',
      '--by', 'INSTR-run-the-suite-and-read-the-output', '--yes',
    ], cwd);

    assert.equal(code, 0, out);
    assert.match(out, /about to supersede/);
    assert.match(out, /INSTR-run-the-suite-before-claiming-done/);
    assert.match(out, /active -> superseded/);
    // `always` twice over: the retiring item is pinned today, and so is the
    // replacement. A preview that hid this would hide the largest single
    // change to what every future session receives.
    assert.match(out, /PINNED/);
    assert.match(out, /every session start/);
  });
});

/**
 * Retiring something in favour of a draft leaves NOTHING governing in its
 * place — a draft is not injected until a human promotes it. That is not
 * implied by a status column, so the preview has to say it.
 */
test('the preview says so when nothing will govern in the retired item\'s place', () => {
  withProject((cwd) => {
    run(['add', 'constraint', 'Pool capped at 10', '--scope', 'src/db/**', '--yes'], cwd);
    // A draft replacement, the way an agent's capture arrives: `create_item`
    // through the real MCP surface demotes a normative item to `draft`.
    createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'Pool capped at 20', body: 'b', scope: ['src/db/**'],
    });

    const { out } = run([
      'supersede', 'CONST-pool-capped-at-10', '--by', 'CONST-pool-capped-at-20', '--yes',
    ], cwd);
    assert.match(out, /not injected \(status "draft"\)/);
    assert.match(out, /nothing will govern in CONST-pool-capped-at-10's place/);
    assert.match(out, /mycontext review promote CONST-pool-capped-at-20/);
  });
});

// --- the confirmation gate ---

test('supersede refuses without confirmation and writes nothing', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const before = itemFile(cwd, 'constraint', old);

    const { code, out } = run(['supersede', old, '--by', next], cwd);
    assert.equal(code, 1);
    assert.match(out, /refusing without confirmation/);
    assert.equal(itemFile(cwd, 'constraint', old), before);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede --yes=false DECLINES rather than confirming', () => {
  for (const spelling of ['--yes=false', '--yes=no', '--yes=0', '--yes=off']) {
    withProject((cwd) => {
      const { old, next } = pair(cwd);
      const { code } = run(['supersede', old, '--by', next, spelling], cwd);
      assert.equal(code, 1, `${spelling} should decline`);
      assert.match(
        itemFile(cwd, 'constraint', old), /^status: active$/m,
        `${spelling} retired the item — the spelling an operator reaches for to DECLINE ` +
        `must never confirm`,
      );
    });
  }
});

test('supersede --yes=maybe is refused loudly with nothing written', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const { code, out } = run(['supersede', old, '--by', next, '--yes=maybe'], cwd);
    assert.equal(code, 1);
    assert.match(out, /--yes accepts/);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

// --- argument handling ---

test('supersede refuses an option it does not recognise, before any preview', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const { code, out } = run(['supersede', old, '--by', next, '--force', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--force"/);
    assert.doesNotMatch(out, /about to supersede/);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede without --by prints usage and exits 1', () => {
  withProject((cwd) => {
    const { old } = pair(cwd);
    const { code, out } = run(['supersede', old], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext supersede/);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede with no arguments at all prints usage and exits 1', () => {
  withProject((cwd) => {
    const { code, out } = run(['supersede'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext supersede/);
  });
});

/**
 * `mycontext supersede A B` reads like it ought to work. Silently ignoring
 * `B` while retiring `A` in favour of whatever `--by` named is the
 * "nothing is dropped silently" failure, on a command that retires things.
 */
test('a second positional is named rather than ignored', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    const { code, out } = run(['supersede', old, next, '--by', next, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, new RegExp(`unexpected argument "${next}"`));
    assert.doesNotMatch(out, /about to supersede/);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede refuses an item superseding itself, before any preview', () => {
  withProject((cwd) => {
    const { old } = pair(cwd);
    const { code, out } = run(['supersede', old, '--by', old, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /cannot supersede itself/);
    assert.doesNotMatch(out, /about to supersede/);
    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede names whichever side of the pair does not exist', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);

    const missingReplacement = run(['supersede', old, '--by', 'CONST-nope', '--yes'], cwd);
    assert.equal(missingReplacement.code, 1);
    assert.match(missingReplacement.out, /no item with id "CONST-nope"/);
    assert.match(missingReplacement.out, /--by/);
    assert.doesNotMatch(missingReplacement.out, /about to supersede/);

    const missingRetiree = run(['supersede', 'CONST-nope', '--by', next, '--yes'], cwd);
    assert.equal(missingRetiree.code, 1);
    assert.match(missingRetiree.out, /no item with id "CONST-nope"/);

    assert.match(itemFile(cwd, 'constraint', old), /^status: active$/m);
  });
});

test('supersede is idempotent through the CLI', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    assert.equal(run(['supersede', old, '--by', next, '--yes'], cwd).code, 0);
    const again = run(['supersede', old, '--by', next, '--yes'], cwd);

    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /already superseded/);
    const text = itemFile(cwd, 'constraint', next);
    assert.equal(text.match(/- supersedes /g)?.length, 1);
    assert.equal(
      itemFile(cwd, 'constraint', old).match(/- superseded_by /g)?.length, 1,
      'a second run must not append a duplicate back-reference',
    );
  });
});

/**
 * After the write, the retired item must be gone from the injected set and
 * still present in the corpus — "nothing is deleted" is the promise the
 * command's own message makes, so it is checked rather than asserted only in
 * prose.
 */
test('a superseded item stays on disk, stays searchable, and stops being injected', () => {
  withProject((cwd) => {
    const { old, next } = pair(cwd);
    run(['supersede', old, '--by', next, '--yes'], cwd);

    const shown = run(['show', old], cwd);
    assert.equal(shown.code, 0, shown.out);
    assert.match(shown.out, /superseded/);

    const listed = run(['list', 'constraint', '--full'], cwd);
    assert.match(listed.out, new RegExp(old));

    // `doctor` must not report the pair as damaged: the back-reference is a
    // new field on an existing file, and a checksum it did not update would
    // read as a hand edit.
    const doctor = run(['doctor'], cwd);
    assert.doesNotMatch(doctor.out, /checksum mismatch/, doctor.out);
    assert.doesNotMatch(doctor.out, /orphan_relation/, doctor.out);
  });
});
