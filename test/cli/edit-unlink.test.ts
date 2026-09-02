/**
 * `mycontext edit --unlink <relation> <target>` — the first supported way to
 * remove a relation.
 *
 * `link_items` only ever added one; `updateItem` has no relations field; and
 * hand-editing the Markdown is the route the plugin's `PreToolUse` hook blocks
 * and this project's documentation is not allowed to instruct. The case that
 * produced it: retiring a requirement left a `depends_on` on a still-active
 * item pointing at a superseded one, with nothing that could clear it.
 *
 * The gating is what these tests are mostly about, because the trap here is
 * specific. `RELATION_TYPES` is the whole gate on `linkItems`, and
 * `superseded_by`/`supersedes` are deliberately outside it so that an agent
 * cannot stamp a retirement onto an item without the lifecycle change that
 * makes the claim true. An `unlink` that accepted them would be the same hole
 * facing the other way — a route that REMOVES a retirement edge nobody could
 * ever have added.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unlink-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/**
 * A sentence that may have been WRAPPED to the layout budget. Every prose line
 * this command prints goes through `paragraph`, so a phrase can carry a
 * newline anywhere a space is — matching the literal string would assert the
 * accident of where the wrap fell rather than what was said.
 */
function phrase(text: string): RegExp {
  return new RegExp(text.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
}

/** What `confirmAction` prints when it declines under a non-interactive stdin
 * — i.e. the proof that a confirmation was asked for at all. */
const DECLINED = /refusing without confirmation/;

function itemFile(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

/** Two active, human-origin items with `from` blocking `to`. The link goes in
 * through `link_items`, the only surface that has ever added one, so the edge
 * under test is one the product itself created. */
function linked(cwd: string, relation = 'blocks'): { from: string; to: string } {
  run(['add', '--summary-omitted', 'constraint', 'The pool is capped at twenty', '--yes'], cwd);
  run(['add', '--summary-omitted', 'decision', 'Stripe was chosen for payments'], cwd);
  const from = 'CONST-the-pool-is-capped-at-twenty';
  const to = 'DEC-stripe-was-chosen-for-payments';
  createRegistry(cwd).call('link_items', { from, to, relation });
  return { from, to };
}

test('--unlink removes the relation and says so, and the file no longer carries it', () => {
  withProject((cwd) => {
    const { from, to } = linked(cwd);
    assert.match(itemFile(cwd, 'constraint', from), /blocks \[\[DEC-stripe/, 'setup failed');

    const { code, out } = run(['edit', from, '--unlink', 'blocks', to, '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`${from} no longer blocks ${to}`));
    assert.doesNotMatch(itemFile(cwd, 'constraint', from), /blocks/,
      'the edge is gone from the Markdown, which is the source of truth');
  });
});

test('removing a relation from a governing item previews and confirms, like a scope change', () => {
  withProject((cwd) => {
    const { from, to } = linked(cwd);
    // No `--yes`, and stdin is not interactive under `node --test`, so the
    // confirmation is declined. Nothing may be written.
    const { code, out } = run(['edit', from, '--unlink', 'blocks', to], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /about to edit:/);
    assert.match(out, /relations\s+blocks DEC-stripe-was-chosen-for-payments -> removed/);
    assert.match(out, DECLINED, 'the gate must have asked');
    assert.match(itemFile(cwd, 'constraint', from), /blocks/,
      'a declined confirmation must leave the relation in place');
  });
});

test('a rationale item is ungated, because nothing governs before or after', () => {
  withProject((cwd) => {
    run(['add', '--summary-omitted', 'decision', 'Stripe was chosen for payments'], cwd);
    run(['add', '--summary-omitted', 'decision', 'Payouts run on Fridays'], cwd);
    const from = 'DEC-stripe-was-chosen-for-payments';
    const to = 'DEC-payouts-run-on-fridays';
    createRegistry(cwd).call('link_items', { from, to, relation: 'relates_to' });

    // No `--yes`: the ungated path must not ask, so this succeeds where the
    // governing case above was declined.
    const { code, out } = run(['edit', from, '--unlink', 'relates_to', to], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, DECLINED, 'a rationale item earns no confirmation');
    assert.doesNotMatch(out, /about to edit:/, 'and therefore no preview');
    assert.doesNotMatch(itemFile(cwd, 'decision', from), /relates_to/);
  });
});

/**
 * The trap this row was written around, both spellings of it. `supersedeItem`
 * writes the edge together with the retiree's `status` and `validUntil`;
 * removing the edge alone leaves an item marked retired with nothing recording
 * what replaced it — retirement without a successor, which the README states
 * is not offered.
 */
test('neither retirement edge can be removed, and the refusal names the real remedy', () => {
  withProject((cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'The old cap', '--yes'], cwd);
    run(['add', '--summary-omitted', 'constraint', 'The new cap', '--yes'], cwd);
    const old = 'CONST-the-old-cap';
    const next = 'CONST-the-new-cap';
    const retired = run(['supersede', old, '--by', next, '--yes'], cwd);
    assert.equal(retired.code, 0, retired.out);
    assert.match(itemFile(cwd, 'constraint', old), /superseded_by \[\[CONST-the-new-cap\]\]/);
    assert.match(itemFile(cwd, 'constraint', next), /supersedes \[\[CONST-the-old-cap\]\]/);

    const back = run(['edit', old, '--unlink', 'superseded_by', next, '--yes'], cwd);
    assert.equal(back.code, 1);
    assert.match(back.out, /cannot be removed/);
    assert.match(back.out, /--status active/, 'the refusal names the route that does work');

    const forward = run(['edit', next, '--unlink', 'supersedes', old, '--yes'], cwd);
    assert.equal(forward.code, 1);
    assert.match(forward.out, /cannot be removed/);

    // Both files are untouched, which is the assertion that would fail if the
    // refusal had landed after the write rather than before it.
    assert.match(itemFile(cwd, 'constraint', old), /superseded_by \[\[CONST-the-new-cap\]\]/);
    assert.match(itemFile(cwd, 'constraint', next), /supersedes \[\[CONST-the-old-cap\]\]/);
  });
});

test('the retirement refusal arrives before the preview, not after it', () => {
  withProject((cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'The old cap', '--yes'], cwd);
    run(['add', '--summary-omitted', 'constraint', 'The new cap', '--yes'], cwd);
    run(['supersede', 'CONST-the-old-cap', '--by', 'CONST-the-new-cap', '--yes'], cwd);
    const { out } = run(
      ['edit', 'CONST-the-old-cap', '--unlink', 'superseded_by', 'CONST-the-new-cap'], cwd,
    );
    assert.doesNotMatch(out, /about to edit:/,
      'a refusal preceded by "about to edit" reads as a report of something that then ' +
      'did not happen');
  });
});

/**
 * The vocabulary rule, in the one direction it does NOT apply. `RELATION_TYPES`
 * closes what may be written so that one corpus does not grow `derives_from`,
 * `derivedFrom` and `derived-from`; enforcing it on removal would make the
 * edges most in need of cleaning up — the ones from outside the vocabulary —
 * the only ones with no route out.
 */
test('a relation from outside RELATION_TYPES can still be removed', () => {
  withProject((cwd) => {
    run(['add', '--summary-omitted', 'constraint', 'The pool is capped at twenty', '--yes'], cwd);
    const id = 'CONST-the-pool-is-capped-at-twenty';
    const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
    // `depends_on` stood here until 2026-09-02, when it was adopted into
    // `RELATION_TYPES` — and that is the argument for the name below rather
    // than another plausible one. This test's whole subject is an edge the
    // WRITE gate refuses; an exemplar that a later widening can move inside
    // the gate turns it green while testing nothing.
    writeFileSync(
      file,
      readFileSync(file, 'utf8').trimEnd() + '\n\n## Relations\n- not_a_relation [[REQ-gone]]\n',
      'utf8',
    );
    run(['repair', '--yes'], cwd);

    // Not writable through `link_items` — the check that keeps this test
    // honest about which direction the vocabulary rule runs in.
    assert.throws(
      () => createRegistry(cwd).call('link_items', { from: id, to: 'REQ-gone', relation: 'not_a_relation' }),
      /not_a_relation/,
    );

    const { code, out } = run(['edit', id, '--unlink', 'not_a_relation', 'REQ-gone', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(itemFile(cwd, 'constraint', id), /not_a_relation/);
  });
});

test('an unlink that matches nothing is refused, not reported as a success', () => {
  withProject((cwd) => {
    const { from } = linked(cwd);
    const { code, out } = run(['edit', from, '--unlink', 'blocks', 'REQ-not-there', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /has no "blocks" relation to REQ-not-there/);
    assert.match(out, phrase('it carries blocks DEC-stripe-was-chosen-for-payments'),
      'the refusal lists what the item does carry');
    assert.match(itemFile(cwd, 'constraint', from), /blocks/, 'nothing was written');
  });
});

test('--unlink needs both words, and refuses the = form that can only carry one', () => {
  withProject((cwd) => {
    const { from, to } = linked(cwd);
    for (const args of [
      ['edit', from, '--unlink', 'blocks'],
      ['edit', from, '--unlink', 'blocks', '--yes'],
      ['edit', from, `--unlink=blocks`, to],
    ]) {
      const { code, out } = run(args, cwd);
      assert.equal(code, 1, `${args.join(' ')} was accepted: ${out}`);
      assert.match(out, /--unlink/);
    }
    assert.match(itemFile(cwd, 'constraint', from), /blocks/, 'nothing was written');
  });
});

test('--unlink is repeatable, and composes with a field edit in one confirmation', () => {
  withProject((cwd) => {
    const { from, to } = linked(cwd);
    createRegistry(cwd).call('link_items', { from, to, relation: 'relates_to' });

    const { code, out } = run(
      ['edit', '--summary-unchanged', from, '--unlink', 'blocks', to, '--unlink', 'relates_to', to,
        '--body', 'A new body for the capped pool.', '--yes'],
      cwd,
    );
    assert.equal(code, 0, out);
    assert.equal(
      (out.match(/about to edit:/g) ?? []).length, 1,
      'one edit, one preview and one confirmation — not one per removed edge',
    );
    const file = itemFile(cwd, 'constraint', from);
    assert.doesNotMatch(file, /blocks/);
    assert.doesNotMatch(file, /relates_to/);
    assert.match(file, /A new body for the capped pool\./);
  });
});

/**
 * The asymmetry recorded rather than discovered: there is no `unlink_items`
 * tool, and that is a decision. Adding an edge crosses no trust boundary (a
 * `LinkInput` carries no `origin`); removing one from a governing item takes
 * away part of what that item asserts, which is the class of change
 * `guardedChange` refuses to let an agent make — and there is no staged-
 * revision route for it, because `RevisionChanges` has no relation field.
 */
test('no MCP tool removes a relation, and no named entry point forwards --unlink', () => {
  withProject((cwd) => {
    const registry = createRegistry(cwd);
    const names = registry.list().map((t) => t.name);
    assert.equal(names.includes('unlink_items'), false,
      'removing a relation is a human act — see unlinkItems in src/core/mutate.ts');
    // Not vacuous: the adding half of the pair is there.
    assert.ok(names.includes('link_items'));

    const { from, to } = linked(cwd);
    for (const name of ['pin', 'unpin', 'harden', 'soften']) {
      assert.ok(COMMANDS.has(name), `${name} is not registered`);
      const { code, out } = run([name, from, '--unlink', 'blocks', to, '--yes'], cwd);
      assert.equal(code, 1, `${name} forwarded --unlink: ${out}`);
      assert.match(out, /--unlink/);
    }
    assert.match(itemFile(cwd, 'constraint', from), /blocks/, 'nothing was written');
  });
});
