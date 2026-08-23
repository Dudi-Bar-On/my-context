import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { AUDIT_KINDS } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { bucketise } from '../../src/pack/collide.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiPort, type PortBody } from '../../src/ui/port-model.ts';

/**
 * Every claim `/api/port` makes is checked against the thing that makes it
 * true, not against a copy of it.
 *
 * The three interesting assertions all run a REAL export through the REAL CLI
 * into a temp directory and read the artefact off disk: that is what turns
 * "items/** travels" and ".index.db is rebuilt" from prose into a measurement.
 * A test that only compared the response to a list written beside it would
 * pass on the day the exporter changed and the endpoint did not, which is the
 * entire failure this endpoint exists to prevent.
 *
 * The fixture is plan 1's: a real workspace built by the real CLI. `add`
 * refuses without `--yes` when stdin is not interactive, and cleanup is
 * `removeTree` — a bare `rmSync` here is what `test/no-bare-rmsync.test.ts`
 * fails on.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-port-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.', '--yes']);
  return { dir, done: () => removeTree(dir) };
}

const bodyOf = (dir: string, query = ''): PortBody => {
  const result = apiPort(resolveWorkspace(dir), new URL(`http://x/api/port${query}`));
  assert.equal(result.status, 200);
  return result.body as PortBody;
};

test('/api/port answers the six rows the port section draws, with one chip each', () => {
  const { dir, done } = workspace();
  try {
    const body = bodyOf(dir);
    assert.deepEqual(body.travels, [
      { path: 'items/**', verdict: 'travels' },
      { path: 'config.json', verdict: 'travels' },
      { path: '.audit/', verdict: 'filtered' },
      { path: '.index.db', verdict: 'rebuilt' },
      { path: 'state/*.seen.jsonl', verdict: 'rebuilt' },
      { path: 'state/focus.json', verdict: 'rebuilt' },
    ]);
    // The chip vocabulary is closed: three values and no fourth, so a screen
    // that maps verdicts to `port.yes`/`port.filtered`/`port.no` can never be
    // handed one with no chip behind it.
    assert.deepEqual(
      [...new Set(body.travels.map((r) => r.verdict))].toSorted(),
      ['filtered', 'rebuilt', 'travels'],
    );
  } finally { done(); }
});

test('the travels table is TRUE of a real artefact, not merely consistent with itself', () => {
  const { dir, done } = workspace();
  const out = mkdtempSync(path.join(tmpdir(), 'myctx-port-out-'));
  try {
    const target = path.join(out, 'artefact');
    assert.equal(runCli(['export', '--out', target], dir, () => {}), 0);

    const entries = readdirSync(target).toSorted();
    // What the endpoint SAYS travels, resolved to what an artefact actually
    // holds at its root. `items/**` lands as the `items` directory; the other
    // two travelling rows land as themselves.
    assert.deepEqual(entries, ['config.json', 'history.jsonl', 'items', 'manifest.json']);

    // And the other half, which is the half a receiver cannot check: nothing
    // this endpoint calls `rebuilt` is anywhere in the artefact.
    const rebuilt = new Set(
      bodyOf(dir).travels.filter((r) => r.verdict === 'rebuilt').map((r) => r.path),
    );
    assert.equal(rebuilt.size, 3);
    for (const name of entries) {
      assert.equal(rebuilt.has(name), false, `${name} is in the artefact and is reported rebuilt`);
      assert.notEqual(name, 'state');
    }

    // `manifest.json` is in the artefact and in no row of the table. That is
    // the omission the first disclosure exists for, and it is derived from
    // ROOT_FILES rather than written down — so this asserts the derivation
    // found the real file rather than that someone typed the right name.
    const unaccounted = bodyOf(dir).disclosures.filter((d) => d.where === 'travels');
    assert.ok(unaccounted.some((d) => d.message.includes('manifest.json')));
  } finally { removeTree(out); done(); }
});

test('history: carries and withheld PARTITION the audit vocabulary, so no kind can go missing', () => {
  const { dir, done } = workspace();
  try {
    const { history } = bodyOf(dir);
    assert.deepEqual(history.carries, ['mutation']);
    // The whole point of deriving `withheld`: the two lists together are
    // exactly AUDIT_KINDS, and they do not overlap. A seventh audit kind
    // therefore lands in `withheld` with nobody editing this endpoint — and
    // if someone hand-lists it instead, this fails.
    assert.deepEqual(
      [...history.carries, ...history.withheld].toSorted(),
      [...AUDIT_KINDS].toSorted(),
    );
    assert.equal(new Set([...history.carries, ...history.withheld]).size, AUDIT_KINDS.length);
    assert.equal(history.withheld.includes('mutation'), false);

    // The mockup's prose names three withheld kinds; this build has five. The
    // gap is the reason `withheld` is served at all, so it is asserted rather
    // than left as a comment.
    assert.equal(history.withheld.length, 5);
    for (const kind of ['injection', 'hook', 'focus', 'access', 'progress']) {
      assert.ok(history.withheld.includes(kind as (typeof AUDIT_KINDS)[number]), kind);
    }
    assert.equal(history.importedDir, 'imported/');
  } finally { done(); }
});

test('formats: three rungs are served and `built` agrees with what --format actually accepts', () => {
  const { dir, done } = workspace();
  try {
    const { formats } = bodyOf(dir);
    assert.deepEqual(formats.map((f) => f.id), ['dir', 'bundle', 'zip']);

    // Measured against the real parser, one rung at a time: a `built` flag
    // that disagreed with `--format` would offer the reader a command the CLI
    // refuses. `--dry-run` so the probe writes nothing.
    for (const format of formats) {
      const code = runCli(['export', '--dry-run', '--format', format.id], dir, () => {});
      assert.equal(code === 0, format.built,
        `--format ${format.id} exited ${code}; the endpoint says built=${format.built}`);
    }
    // Named, so the failure above reads as "the dropped rung came back" rather
    // than as an arithmetic accident.
    assert.deepEqual(formats.filter((f) => !f.built).map((f) => f.id), ['bundle']);
  } finally { done(); }
});

test('buckets are the keys `bucketise` really returns, not three strings typed beside it', () => {
  const { dir, done } = workspace();
  try {
    // The one runtime witness of `Buckets`: `bucketise` over nothing returns
    // the shape with every key present and empty. The endpoint pins the same
    // three names at COMPILE time; this is the other direction.
    assert.deepEqual(bodyOf(dir).buckets, Object.keys(bucketise([], () => null)));
  } finally { done(); }
});

test('command.argv is one argument short, and names the flag the CLI really takes', () => {
  const { dir, done } = workspace();
  const out = mkdtempSync(path.join(tmpdir(), 'myctx-port-argv-'));
  try {
    const { argv } = bodyOf(dir).command;
    assert.deepEqual(argv, ['mycontext', 'export', '--out']);

    // Complete it and it runs; the endpoint's argv is the real command minus
    // the one argument the user owns.
    const target = path.join(out, 'a');
    assert.equal(runCli([...argv.slice(1), target], dir, () => {}), 0);

    // The mockup's spelling is refused, which is why the disclosure names it.
    assert.equal(runCli(['export', '--to', path.join(out, 'b')], dir, () => {}), 1);
    assert.equal(readdirSync(out).toSorted().join(','), 'a');
  } finally { removeTree(out); done(); }
});

test('every omission is disclosed, and each disclosure points at a field of this body', () => {
  const { dir, done } = workspace();
  try {
    const body = bodyOf(dir);
    const wheres = [...new Set(body.disclosures.map((d) => d.where))].toSorted();
    assert.deepEqual(wheres, ['buckets', 'command.argv', 'formats', 'history', 'travels']);
    for (const d of body.disclosures) {
      assert.ok(d.message.length > 0, `${d.where} discloses nothing`);
      // A `where` nobody can follow is a disclosure that does not disclose.
      const field = d.where.split('.')[0]!;
      assert.ok(Object.hasOwn(body, field), `disclosure points at ${d.where}, which is not a field`);
    }
    // The counted disclosure is counted, not typed: it has to agree with the
    // list it describes.
    const counted = body.disclosures.find((d) => d.message.includes('audit kinds do not travel'));
    assert.ok(counted);
    assert.ok(counted.message.startsWith(`${body.history.withheld.length} of this build's `));
  } finally { done(); }
});

test('/api/port refuses a parameter it would ignore, and 404s outside a workspace', () => {
  const { dir, done } = workspace();
  try {
    const bad = apiPort(resolveWorkspace(dir), new URL('http://x/api/port?format=zip'));
    assert.equal(bad.status, 400);
    assert.ok(String((bad.body as { error: string }).error).includes('format'));
  } finally { done(); }

  const empty = mkdtempSync(path.join(tmpdir(), 'myctx-port-none-'));
  try {
    const ws = resolveWorkspace(empty);
    assert.equal(ws.projectRoot, null, 'fixture is not workspace-free');
    const result = apiPort(ws, new URL('http://x/api/port'));
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { error: 'no workspace here' });
  } finally { removeTree(empty); }
});
