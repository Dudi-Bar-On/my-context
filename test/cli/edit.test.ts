import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { OUTPUT_WIDTH } from '../../src/cli/commands/format.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { revisionLogPath } from '../../src/core/revision.ts';
import { stageIn } from '../helpers/revisions.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext edit` — the human route to changing an item, and the first one
 * this project has had. Everything here drives the real command through
 * `runCli`, because what is most likely to be wrong is boundary behaviour:
 * which cases are gated, what the preview claims, and whether a refusal
 * arrives before or after a human is asked to approve something.
 *
 * **One test per row of spec §2's gate table**, plus the interactions the
 * table does not name: `scopePolicy: "required"`, `agentEdits`, a pending
 * revision on the item being edited, and the global layer.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(config?: unknown): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-edit-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  if (config !== undefined) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify(config, null, 2) + '\n', 'utf8',
    );
  }
  return cwd;
}

function withProject(fn: (cwd: string) => void, config?: unknown): void {
  const cwd = project(config);
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function itemFile(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
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

const RULE = 'CONST-pool-capped-at-10';

/** One ACTIVE, governing normative item — `add --yes` passes `origin: 'human'`. */
function governing(cwd: string, extra: string[] = []): string {
  run(['add', 'constraint', 'Pool capped at 10', '--body', 'Ten connections.',
    '--scope', 'src/db/**', ...extra, '--yes'], cwd);
  return RULE;
}

/** One rationale item. Rationale categories need no confirmation at capture. */
function rationale(cwd: string): string {
  run(['add', 'decision', 'Use SQLite for the index', '--body', 'It ships with Node.'], cwd);
  return 'DEC-use-sqlite-for-the-index';
}

/** A normative DRAFT: a non-human origin is forced to `draft` by `trustedStatus`. */
function draft(cwd: string): string {
  createRegistry(cwd).call('create_item', {
    type: 'constraint', title: 'Retries capped at three', body: 'Three tries.',
  });
  return 'CONST-retries-capped-at-three';
}

test('edit is a registered command, so it inherits the registry conventions', () => {
  assert.ok(COMMANDS.has('edit'), 'edit must be a registry command, not a switch arm');
});

// --- spec §2, row by row -----------------------------------------------------

test('row 1: a rationale item\'s content is edited with no gate at all', () => {
  withProject((cwd) => {
    const id = rationale(cwd);
    const { code, out } = run(['edit', id, '--body', 'It ships with Node 24.'], cwd);

    assert.equal(code, 0, out);
    // No preview, no prompt, no --yes: nothing this edit can do requires one.
    assert.doesNotMatch(out, /about to edit/);
    assert.doesNotMatch(out, /refusing without confirmation/);
    assert.match(itemFile(cwd, 'decision', id), /It ships with Node 24\./);
  });
});

test('row 2: reach and force on a rationale item are refused, before any preview', () => {
  withProject((cwd) => {
    const id = rationale(cwd);
    for (const args of [['--always'], ['--severity', 'hard']]) {
      const { code, out } = run(['edit', id, ...args, '--yes'], cwd);
      assert.equal(code, 1, out);
      assert.match(out, phrase('only governs on the normative tier'));
      assert.match(out, phrase('Nothing was changed.'));
      assert.doesNotMatch(out, /about to edit/, 'the refusal must precede the preview');
    }
    assert.match(itemFile(cwd, 'decision', id), /^always: false$/m);
    assert.match(itemFile(cwd, 'decision', id), /^severity: soft$/m);
  });
});

/**
 * The row's exception, and it is deliberate rather than an oversight: Task 3
 * accepted `scope` on the rationale tier where it refused `always` and
 * `severity`. `query_items({path})` matches scope over EVERY item, rationale
 * included, so a decision's scope is how a reader finds what was decided about
 * a file — and refusing it here would make `scopePolicy: "required"` on a
 * rationale category unsatisfiable, two settings contradicting each other.
 * Pinned so this command cannot drift into refusing it on the strength of the
 * table's shorter wording.
 */
test('row 2, the exception: scope on a rationale item is accepted, ungated', () => {
  withProject((cwd) => {
    const id = rationale(cwd);
    const { code, out } = run(['edit', id, '--scope', 'src/db/**'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /about to edit/);
    assert.match(itemFile(cwd, 'decision', id), /src\/db\/\*\*/);
  });
});

test('row 3: a normative DRAFT is ungated in every class of field', () => {
  withProject((cwd) => {
    const id = draft(cwd);
    // Content, reach and force in one call — nothing governs yet, so none of
    // it needs a human's approval beyond the promotion `review` already gates.
    const { code, out } = run([
      'edit', id, '--body', 'Four tries.', '--always', '--severity', 'hard',
    ], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /about to edit/);
    assert.doesNotMatch(out, /refusing without confirmation/);
    const file = itemFile(cwd, 'constraint', id);
    assert.match(file, /^status: draft$/m, 'the edit must not promote it');
    assert.match(file, /^always: true$/m);
    assert.match(file, /^severity: hard$/m);
  });
});

test('row 4: content on a governing normative item previews and confirms', () => {
  withProject((cwd) => {
    const id = governing(cwd);

    // Without --yes, and with no terminal to ask in, it refuses and writes nothing.
    const refused = run(['edit', id, '--body', 'Twelve connections.'], cwd);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /about to edit/);
    assert.match(refused.out, /refusing without confirmation/);
    assert.match(itemFile(cwd, 'constraint', id), /Ten connections\./);

    const { code, out } = run(['edit', id, '--body', 'Twelve connections.', '--yes'], cwd);
    assert.equal(code, 0, out);
    // The preview shows the change as a DIFF, both sides, not a field name.
    assert.match(out, /^ {4}- Ten connections\.$/m);
    assert.match(out, /^ {4}\+ Twelve connections\.$/m);
    // Content does not move what governs, so the preview does not print an
    // "after" line it would have to fill with the same phrase twice.
    assert.match(out, /^ {2}today {4}/m);
    assert.doesNotMatch(out, /^ {2}after {4}/m);
    assert.match(itemFile(cwd, 'constraint', id), /Twelve connections\./);
  });
});

test('row 5: reach or force on a governing item shows what governs BEFORE and AFTER', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--scope', 'src/api/**', '--yes'], cwd);

    assert.equal(code, 0, out);
    assert.match(out, phrase('today injected when work touches src/db/**'));
    assert.match(out, phrase('after injected when work touches src/api/**'));
    assert.match(itemFile(cwd, 'constraint', id), /src\/api\/\*\*/);
  });
});

test('row 5: the before/after pair is printed even when force does not move injection', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    // `severity` is force, but it changes nothing about WHERE the item is
    // injected. "This does not change what is injected" is the answer a human
    // approving it needs, and silence does not give it.
    const { out } = run(['edit', id, '--severity', 'hard', '--yes'], cwd);
    assert.match(out, phrase('today injected when work touches src/db/**'));
    assert.match(out, phrase('after injected when work touches src/db/**'));
  });
});

test('the preview names the crossing when an edit takes an item out of injection', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--status', 'deprecated', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, phrase('after not injected (status "deprecated")'));
    assert.match(out, phrase(`this edit takes ${id} out of injection`));
  });
});

// --- the preview must not claim an injection that will not happen ------------

/**
 * The defect this project has produced three times: a preview that reads
 * `always`/`scope` before the tier, or before eligibility, and promises an
 * injection for an item that is injected nowhere. `injection`
 * (cli/commands/injection.ts) mirrors `select`'s own order, and these are the
 * two cases where a naive preview would lie.
 */
test('the preview does not promise an injection a disabled category cannot deliver', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    // Disabled AFTER capture, so the item exists and is `active` while its
    // category injects nothing.
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { constraint: { enabled: false } } }, null, 2) + '\n', 'utf8',
    );
    const { out } = run(['edit', id, '--scope', 'src/api/**', '--yes'], cwd);
    assert.match(out, phrase('today not injected (category "constraint" is disabled in this project)'));
    assert.doesNotMatch(out, /injected when work touches/);
  });
});

test('the preview reads an empty scope through scopePolicy, not as a constant', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { out } = run(['edit', id, '--scope=', '--yes'], cwd);
    // `inert`: an item with no scope is injected on no file at all. A preview
    // that said "unrestricted, so it is injected on the first file touched"
    // here would be exactly backwards.
    assert.match(out, phrase('scopePolicy is "inert"'));
    assert.match(out, phrase(`this edit takes ${id} out of injection`));
  }, { categories: { constraint: { scopePolicy: 'inert' } } });
});

// --- the interactions the table does not name --------------------------------

test('scopePolicy "required" refuses an edit that removes the last glob, before the preview', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--scope=', '--yes'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, phrase('scopePolicy "required"'));
    // The EDIT remedy, not the capture one: there is no flag to pass here —
    // the fix is to replace the globs rather than clear them. `mycontext add`
    // is told to pass `--scope`; this surface is told something else, and
    // `scopeRequirementError` owns both wordings.
    assert.match(out, phrase('Replace the globs rather than clearing them'));
    assert.doesNotMatch(out, /about to edit/, 'the refusal must precede the preview');
    assert.match(itemFile(cwd, 'constraint', id), /src\/db\/\*\*/, 'nothing was written');
  }, { categories: { constraint: { scopePolicy: 'required' } } });
});

test('a human edit is never staged, whatever agentEdits says', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--body', 'Twelve connections.', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /staged/i, 'a human edit applies; it is not held for review');
    // Applied to the file, and no revision log exists at all.
    assert.match(itemFile(cwd, 'constraint', id), /Twelve connections\./);
    assert.equal(existsSync(revisionLogPath(path.join(cwd, '.my_context'))), false);
    assert.match(run(['review', 'revisions'], cwd).out, /no revisions pending/);
  }, { categories: { constraint: { agentEdits: 'review' } } });
});

test('editing an item that carries a colliding pending revision says so, twice', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const staged = stageIn(cwd, id, { body: 'Ten connections, and no more.' });

    const { code, out } = run(['edit', id, '--body', 'Twelve connections.', '--yes'], cwd);
    assert.equal(code, 0, out);
    // Before the prompt: what this edit is about to do to the proposal.
    assert.match(out, phrase(`${id} carries 1 pending revision(s) (${staged.revision.revisionId})`));
    assert.match(out, phrase('this edit makes it STALE'));
    // After the write: what it actually did, read back from the store.
    assert.match(out, phrase(`(${staged.revision.revisionId}) is now STALE`));
    assert.match(out, phrase('Nothing was discarded'));
    // And the proposal really is still there, promotable only with --force.
    const revisions = run(['review', 'revisions', id], cwd);
    assert.match(revisions.out, new RegExp(staged.revision.revisionId));
    assert.match(revisions.out, /STALE/);
  });
});

test('a pending revision on a different field is not reported as made stale', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const staged = stageIn(cwd, id, { title: 'Pool capped at ten' });
    // Staleness is per FIELD, so an edit to the body leaves a title proposal
    // promotable. Warning about it would be a warning about nothing.
    const { out } = run(['edit', id, '--body', 'Twelve connections.', '--yes'], cwd);
    assert.match(out, phrase(`${id} carries 1 pending revision(s)`));
    assert.match(out, phrase('None of it proposes a field this edit changes'));
    assert.doesNotMatch(out, /STALE/);
    assert.match(run(['review', 'revisions', id], cwd).out, phrase('applies cleanly'));
    assert.ok(staged.revision.revisionId);
  });
});

test('the revision warning is printed on the UNGATED path too', () => {
  withProject((cwd) => {
    // A normative draft carries no gate and can still carry a revision (Task 5
    // applies `agentEdits` with no draft exemption), so this is the one path
    // with no prompt to hang the warning on.
    const id = draft(cwd);
    stageIn(cwd, id, { body: 'Four tries.' });
    const { code, out } = run(['edit', id, '--body', 'Five tries.'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /about to edit/);
    assert.match(out, phrase('this edit makes it STALE'));
  });
});

// --- the refusals every command owes -----------------------------------------

test('an unknown flag is refused rather than folded into the edit', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--tite', 'x', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--tite"/);
    assert.match(out, /usage: mycontext edit/);
  });
});

test('--yes=false declines, exactly as passing no --yes does', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--body', 'Twelve connections.', '--yes=false'], cwd);
    assert.equal(code, 1, out);
    assert.match(itemFile(cwd, 'constraint', id), /Ten connections\./);
  });
});

test('a non-existent id is reported clearly, naming how to find the right one', () => {
  withProject((cwd) => {
    const { code, out } = run(['edit', 'CONST-nothing-like-this', '--body', 'x', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /no item with id "CONST-nothing-like-this"/);
    assert.match(out, /mycontext list/);
  });
});

test('naming no field at all is refused rather than reported as a successful edit', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase('nothing to edit — no field was named'));
  });
});

/**
 * The flag is the assertion, and this is where that matters.
 *
 * `updateItem` refuses an inert field only when the value MOVES — its callers
 * are programs echoing back a field they just read. Nothing echoes on a CLI:
 * every flag here was typed by a human, so `--always` on an item that already
 * stores `always: true` is still an assertion about the pinned tier, and
 * accepting it silently (as "nothing to change") would be the drop spec §3
 * exists to close. `review promote` takes the identical divergence, and it was
 * found there by running the command rather than by reading it.
 *
 * The stored value gets there the only way it can: the category was normative
 * when the item was captured and is rationale in the config read now.
 */
test('the inert-field refusal fires on the FLAG, not on the value moving', () => {
  withProject((cwd) => {
    const id = governing(cwd, ['--severity', 'hard']);
    run(['edit', id, '--always', '--yes'], cwd);
    assert.match(itemFile(cwd, 'constraint', id), /^always: true$/m);
    // Retiered underneath the item: `always: true` and `severity: hard` are now
    // stored and inert.
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { constraint: { tier: 'rationale' } } }, null, 2) + '\n', 'utf8',
    );

    for (const args of [['--always'], ['--severity', 'hard']]) {
      const { code, out } = run(['edit', id, ...args, '--yes'], cwd);
      assert.equal(code, 1, out);
      assert.match(out, phrase('only governs on the normative tier'));
      assert.doesNotMatch(out, phrase('nothing to change'));
    }

    // The neutral values stay available, which is what keeps a stored-but-inert
    // flag removable: `--always=false` asserts nothing about the pinned tier.
    const cleared = run(['edit', id, '--always=false'], cwd);
    assert.equal(cleared.code, 0, cleared.out);
    assert.match(itemFile(cwd, 'constraint', id), /^always: false$/m);
  });
});

test('an edit that changes nothing says so and writes nothing', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const before = itemFile(cwd, 'constraint', id);
    // Every field, each at the value the item already has. An echo is not a
    // change: a human who passed one must not be shown a preview of an empty
    // change and asked to approve it.
    const { code, out } = run([
      'edit', id, '--title', 'Pool capped at 10', '--body', 'Ten connections.',
      '--scope', 'src/db/**', '--severity', 'soft', '--status', 'active', '--yes',
    ], cwd);
    assert.equal(code, 0, out);
    assert.match(out, phrase('nothing to change'));
    assert.doesNotMatch(out, /about to edit/, 'there is nothing to confirm');
    assert.equal(itemFile(cwd, 'constraint', id), before);
  });
});

test('a second positional is refused rather than silently ignored', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, 'a new title', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase('unexpected argument "a new title"'));
  });
});

test('a bad --severity or --status is refused in the shared enum wording', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const severity = run(['edit', id, '--severity', 'harsh', '--yes'], cwd);
    assert.equal(severity.code, 1);
    assert.match(severity.out, phrase('"severity" must be one of: hard, soft'));
    const status = run(['edit', id, '--status', 'activ', '--yes'], cwd);
    assert.equal(status.code, 1);
    assert.match(status.out, phrase('"status" must be one of'));
    assert.match(status.out, phrase('The closest match is "active"'));
  });
});

/**
 * Retirement in this system names its replacement in both directions, and the
 * README states plainly that "retirement without a successor is not offered".
 * A bare `--status superseded` here would produce exactly that item — marked
 * as replaced by nothing, with no edge to follow back — and make that
 * documented promise false the day this command shipped.
 */
test('--status superseded is refused, naming the command that retires properly', () => {
  withProject((cwd) => {
    const id = governing(cwd);
    const { code, out } = run(['edit', id, '--status', 'superseded', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, phrase(`mycontext supersede ${id} --by <replacement id>`));
    assert.match(itemFile(cwd, 'constraint', id), /^status: active$/m);
  });
});

// --- layout ------------------------------------------------------------------

test('the preview fits the layout budget at the widest id this project can mint', () => {
  withProject((cwd) => {
    // Six characters of category prefix plus `slugify`'s sixty-character
    // ceiling — the same hostile id every other layout test measures at.
    const title = 'Pool capped at ten connections because the database refuses more than that';
    run(['add', 'constraint', title, '--body', 'Ten connections.', '--scope', 'src/db/**', '--yes'], cwd);
    const id = run(['list', 'constraint'], cwd).out.match(/CONST-[a-z0-9-]+/)?.[0];
    assert.ok(id && id.length >= 60, `expected a long id, got ${id}`);

    for (const args of [
      ['edit', id, '--body', 'Twelve connections.', '--yes'],
      ['edit', id, '--scope', 'src/api/**', '--yes'],
      ['edit', id, '--status', 'deprecated', '--yes'],
    ]) {
      const { out } = run(args, cwd);
      const over = out.split('\n').filter((l) => [...l].length > OUTPUT_WIDTH);
      assert.deepEqual(
        over, [],
        `\`${args.join(' ')}\` printed line(s) over ${OUTPUT_WIDTH}:\n${over.join('\n')}`,
      );
      assert.match(out, /about to edit/, 'measured on a real preview, not a refusal');
    }
  });
});
