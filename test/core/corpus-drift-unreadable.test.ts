// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`measureCorpusDrift` may not answer `drifted: false` over a subtree it
 * could not read.**
 *
 * Site M5 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * (report 3, `reports/2026-09-12-silent-failures-reviewed.md`). `CorpusDrift`'s
 * own docstring already states the rule this broke: *"`false` is a MEASUREMENT:
 * the sweep ran, **reached everything it meant to**, and found nothing
 * newer."* The file already had the right doctrine for the OTHER way a sweep
 * falls short — a `truncated` sweep that finds nothing answers `null` — and the
 * unreadable-subdirectory case simply was not wired into it.
 *
 * What it costs: a branch switch rewrites hundreds of item files, one directory
 * is momentarily locked, `/api/ping` answers `drifted: false`, and the page
 * tells the reader in so many words that it is **not** stale.
 *
 * **Where the answer is printed, so "disclosed" means something here.**
 * `drifted` is served on `/api/ping` and `/api/meta` and drawn by
 * `fillCorpusDrift` (`src/ui/public/app.js`) through `corpusDrift()`
 * (`src/ui/public/lib/viewmodel.js`), whose table has exactly three states:
 * `drifted`, `in-step`, and an `unmeas` chip for `null`. So the convention this
 * site reports through is the EXISTING `drifted: null` — nothing new is
 * invented, and `unreadable` beside it is the count that makes the `null`
 * legible, exactly as `scanned` makes `truncated` legible.
 *
 * The refusal is planted by a fixture process — see
 * `test/fixtures/force-corpus-drift-readdir-failure.ts` for why no arrangement
 * of the real filesystem produces it on this platform.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { auditLogPath } from '../../src/core/audit.ts';
import type { CorpusDrift } from '../../src/core/corpus-drift.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'force-corpus-drift-readdir-failure.ts');

/**
 * A workspace whose audit log is NEWER than every item file, so an unblinded
 * sweep answers the measured `drifted: false`. That is the answer the blinded
 * sweep must not be able to borrow.
 */
function project(): { root: string; done: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-drift-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'fixture command failed: init');
  const ws = resolveWorkspace(cwd);
  assert.ok(ws.projectRoot !== null);
  const root = ws.projectRoot;
  for (const [dir, id] of [['constraint', 'CONST-a'], ['note', 'NOTE-b']] as const) {
    const file = path.join(root, 'items', dir, `${id}.md`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `---\nid: ${id}\ntype: ${dir}\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\nBody.\n`,
      'utf8',
    );
  }
  // The log is written last and then stamped into the future, so no item can
  // be newer than it and `drifted` is a true `false` for a complete sweep.
  const log = auditLogPath(root);
  mkdirSync(path.dirname(log), { recursive: true });
  writeFileSync(log, '');
  const ahead = new Date(Date.now() + 60_000);
  utimesSync(log, ahead, ahead);
  return { root, done: () => removeTree(cwd) };
}

function sweep(root: string, blind: string): CorpusDrift {
  const run = spawnSync(process.execPath, [FIXTURE, root, blind], { encoding: 'utf8' });
  assert.equal(run.status, 0, `fixture failed: ${run.stderr}`);
  return JSON.parse(run.stdout.trim()) as CorpusDrift;
}

test('a subtree the sweep could not read makes the answer UNKNOWN, never "in step"', () => {
  const p = project();
  try {
    const answer = sweep(p.root, 'items/note');
    assert.equal(
      answer.drifted, null,
      'CorpusDrift.drifted says `false` is a MEASUREMENT — the sweep ran and reached everything '
      + 'it meant to. A subtree that refused is exactly the case where it did not, and the page '
      + 'draws `false` as "this is not stale"',
    );
    assert.ok(
      answer.unreadable > 0,
      'INV-nothing-is-dropped-silently: how many entries refused is the number that makes the '
      + 'unknown legible, the way `scanned` makes `truncated` legible',
    );
  } finally { p.done(); }
});

test('the CONTROL: the same corpus, nothing blinded, answers the measured false', () => {
  const p = project();
  try {
    const answer = sweep(p.root, '-');
    assert.equal(
      answer.drifted, false,
      'the measured negative must survive the repair — a sweep that reached everything and found '
      + 'nothing newer is a FINDING, and turning it into an unknown would be the opposite defect',
    );
    assert.equal(answer.unreadable, 0, 'and nothing refused, said as a number rather than by silence');
    assert.equal(answer.truncated, false);
    assert.ok(answer.scanned > 0, 'the sweep really did look');
  } finally { p.done(); }
});

test('a refusal does NOT mask real drift — evidence already found is still reported', () => {
  const p = project();
  try {
    // One item stamped newer than the log: the sweep has its finding whether or
    // not another subtree refuses, and `drifted: true` is not an unknown.
    const item = path.join(p.root, 'items', 'constraint', 'CONST-a.md');
    const later = new Date(Date.now() + 5 * 60_000);
    utimesSync(item, later, later);
    const answer = sweep(p.root, 'items/note');
    assert.equal(
      answer.drifted, true,
      'a refusal somewhere else cannot unmake evidence the sweep actually holds — that would be '
      + 'this defect inverted, hiding a real finding behind a partial walk',
    );
  } finally { p.done(); }
});
