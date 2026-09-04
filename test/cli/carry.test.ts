/**
 * `mycontext carry` — the one-shot override (owner ruling 2026-09-04,
 * `TASK-no-command-delivers-one-item-at-the-next-injection-so-a`).
 *
 * The cases that matter most are the ones a plausible-but-wrong implementation
 * would pass anyway: a mark that survives a SECOND injection (not one-shot), a
 * mark that silently no-ops on a repeat instead of saying so, and a `--show`
 * that asks for confirmation it has nothing to use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { carryOncePath } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; root: string; dispose(): void }

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-carry-cli-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return { cwd, root: resolveWorkspace(cwd).projectRoot!, dispose: () => removeTree(cwd) };
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/** One normative item, real id returned. */
function addRule(cwd: string, title: string): string {
  const { out } = run(['add', '--summary-omitted', 'rule', title, '--yes'], cwd);
  const id = /created (RULE-[a-z0-9-]+)/.exec(out);
  assert.ok(id, `no id parsed from:\n${out}`);
  return id[1];
}

test('marking without --yes previews the act and refuses off a TTY, and writes nothing', () => {
  const p = project();
  try {
    const id = addRule(p.cwd, 'A rule to carry');
    const { code, out } = run(['carry', id], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /about to mark/);
    assert.match(out, /regardless of its own budget/);
    assert.match(out, /refusing without confirmation/);
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /nothing is carried/);
  } finally { p.dispose(); }
});

test('an unknown id is refused, and nothing is queued', () => {
  const p = project();
  try {
    const { code, out } = run(['carry', 'RULE-does-not-exist', '--yes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /no item with id/);
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /nothing is carried/);
  } finally { p.dispose(); }
});

test('`--yes` marks the id, and `--show` reports it with its title', () => {
  const p = project();
  try {
    const id = addRule(p.cwd, 'A rule to carry');
    const { code, out } = run(['carry', id, '--yes'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, new RegExp(`${id} marked`));
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /1 item\(s\) queued/);
    assert.match(shown, new RegExp(`${id} — A rule to carry`));
  } finally { p.dispose(); }
});

test('marking an id already queued is a no-op that says so, not a duplicate or a second entry', () => {
  const p = project();
  try {
    const id = addRule(p.cwd, 'A rule to carry');
    run(['carry', id, '--yes'], p.cwd);
    const { code, out } = run(['carry', id, '--yes'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, /already marked/);
    const stored = JSON.parse(readFileSync(carryOncePath(p.root), 'utf8')) as { ids: unknown[] };
    assert.equal(stored.ids.length, 1, 'marking twice must not duplicate the entry');
  } finally { p.dispose(); }
});

test('two ids on one command line are refused — carry marks one item per call', () => {
  const p = project();
  try {
    const a = addRule(p.cwd, 'First rule');
    const b = addRule(p.cwd, 'Second rule');
    const { code, out } = run(['carry', a, b, '--yes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /marks ONE item per call/);
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /nothing is carried/);
  } finally { p.dispose(); }
});

test('--show refuses --yes by name, since it reports and changes nothing', () => {
  const p = project();
  try {
    const { code, out } = run(['carry', '--show', '--yes'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /--yes means nothing on `mycontext carry --show`/);
  } finally { p.dispose(); }
});

test('--show and --clear together are refused — they name two different acts', () => {
  const p = project();
  try {
    const { code, out } = run(['carry', '--show', '--clear'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, /name two different acts/);
  } finally { p.dispose(); }
});

test('--clear on an empty queue says there is nothing to clear, and asks no question', () => {
  const p = project();
  try {
    const { code, out } = run(['carry', '--clear', '--yes'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, /nothing is carried, so there is nothing to clear/);
  } finally { p.dispose(); }
});

test('--clear without --yes previews what would be withdrawn and refuses off a TTY', () => {
  const p = project();
  try {
    const id = addRule(p.cwd, 'A rule to carry');
    run(['carry', id, '--yes'], p.cwd);
    const { code, out } = run(['carry', '--clear'], p.cwd);
    assert.equal(code, 1, out);
    assert.match(out, new RegExp(`about to withdraw 1 pending carry mark\\(s\\): ${id}`));
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /1 item\(s\) queued/, 'a refused --clear must not have written anything');
  } finally { p.dispose(); }
});

test('--clear --yes withdraws the whole queue and names what it removed', () => {
  const p = project();
  try {
    const a = addRule(p.cwd, 'First rule');
    const b = addRule(p.cwd, 'Second rule');
    run(['carry', a, '--yes'], p.cwd);
    run(['carry', b, '--yes'], p.cwd);
    const { code, out } = run(['carry', '--clear', '--yes'], p.cwd);
    assert.equal(code, 0, out);
    assert.match(out, /2 mark\(s\) withdrawn/);
    assert.match(out, new RegExp(a));
    assert.match(out, new RegExp(b));
    const { out: shown } = run(['carry', '--show'], p.cwd);
    assert.match(shown, /nothing is carried/);
  } finally { p.dispose(); }
});

test('an unknown flag is refused with the usage, not accepted and ignored', () => {
  const p = project();
  try {
    const { code, out } = run(['carry', '--domain', 'billing'], p.cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--domain"/);
  } finally { p.dispose(); }
});

/**
 * `--show` refuses to guess an item that no longer exists a title for — the id
 * is still shown, and the queue is still reported, because a mark surviving a
 * deleted item is exactly the state `INV-nothing-is-dropped-silently` exists
 * to keep visible rather than hidden by a lookup failure.
 */
test('--show names a queued id the corpus no longer has, rather than silently omitting it', () => {
  const p = project();
  try {
    const id = addRule(p.cwd, 'A rule that will be discarded');
    run(['carry', id, '--yes'], p.cwd);
    // Hand-write the file over the id's own item to simulate it having gone —
    // `supersede`/discard flows are not needed here, only the read path's
    // honesty when a title lookup misses.
    writeFileSync(carryOncePath(p.root), JSON.stringify({
      protocol: 'mycontext-carry-once/1',
      ids: [{ id: 'RULE-long-gone', setAt: new Date().toISOString(), setBy: 'human' }],
    }));
    const { out } = run(['carry', '--show'], p.cwd);
    assert.match(out, /RULE-long-gone \(not in this corpus any more\)/);
  } finally { p.dispose(); }
});

/* ---------------------------------------------------------------------------
 * The one-shot contract, end to end: a spilling item is carried into the very
 * next injection, and is not carried into the one after that.
 * ------------------------------------------------------------------------- */

function setIndexBudget(root: string, tokens: number): void {
  const configPath = path.join(root, 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { budgets?: Record<string, number> };
  config.budgets = { ...config.budgets, index: tokens };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

test('a spilling item is delivered at the very next injection and never again — the one-shot contract', () => {
  const p = project();
  try {
    // A budget that fits exactly one of the two lines below, so the second
    // one spills by construction — the state the item this command exists
    // for is written against.
    setIndexBudget(p.root, 30);
    const kept = addRule(p.cwd, 'Charge amounts in integer cents');
    const spilling = addRule(p.cwd, 'Rotate the session token hourly');

    // Before any carry: `kept` is admitted by the ordinary by-id order and
    // `spilling` is the one that spills — pinned down so the rest of this
    // test is not measuring an accident of which id sorts first. Both are
    // `rule` items — a GOVERNING category — so `spilling` is no longer
    // silently absent: `TASK-a-governing-item-degraded-to-an-index-line-
    // looks-delivered` names it in the "reached this session neither in full
    // nor as a title" disclosure. It must still not appear as an ordinary
    // index BULLET, which is what "spills" meant for this test before that
    // disclosure existed.
    const before = buildInjection(p.cwd, { event: 'manual' });
    assert.match(before, new RegExp(`- ${kept} ·`));
    assert.doesNotMatch(before, new RegExp(`- ${spilling} ·`));
    assert.match(before, new RegExp(`neither in full nor as a title.*${spilling}`));

    assert.equal(run(['carry', spilling, '--yes'], p.cwd).code, 0);

    // The next injection: the marked id arrives, front-of-queue, regardless
    // of its own budget standing — it displaces the id that would otherwise
    // have been admitted.
    const carried = buildInjection(p.cwd, { event: 'manual' });
    assert.match(carried, new RegExp(`${spilling} · rule · Rotate the session token hourly · carried`));
    assert.doesNotMatch(carried, new RegExp(`${kept} ·`), 'the carried id displaced the other line');
    assert.match(carried, /carried from session `a one-shot carry`/);

    // Spent: the mark does not survive the injection that used it.
    assert.match(run(['carry', '--show'], p.cwd).out, /nothing is carried/);

    // The injection after that is the ordinary one again — `spilling` spills
    // exactly as it did before anything was ever marked, proving this was a
    // single use rather than a standing preference.
    const after = buildInjection(p.cwd, { event: 'manual' });
    assert.equal(after, before, 'a spent carry must leave the corpus injecting exactly as it did before it');
  } finally { p.dispose(); }
});
