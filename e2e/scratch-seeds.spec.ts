// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-the-browser-suite-returns-to-the-real-corpus-and-the, TASK-last-ui-task-return-the-ui-to-the-real-corpus, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE GATE ON THE SEEDING ITSELF — does a twin reach the state its seed
 * claims, and is this repository's own corpus provably untouched while it
 * does?**
 *
 * ── WHY THIS FILE COMES FIRST ──────────────────────────────────────────────
 *
 * `e2e/seeds.ts` is machinery, and machinery that nothing tests is a second
 * place for a wrong answer to live. Every seeded spec in this suite rests on
 * a claim this file makes true or red:
 *
 *   `squeezeBudgets`   the selection really overflows, on both questions, and
 *                      the two answers share no row.
 *   `draftInQueue`     the draft half of the Review queue really draws.
 *   `pendingRevision`  the revision half really draws.
 *   `driftedSource`    Doctor really answers a `run`-routed repair — the thing
 *                      the live corpus cannot produce at all today.
 *   `realInjections`   a session really has an injection history, a cleared
 *                      one really keeps it with no window, and an id nothing
 *                      wrote really reports a measured zero.
 *
 * If one of those goes red here, the specs that lean on it are measuring
 * nothing, and this file says which one rather than leaving five files to fail
 * obscurely.
 *
 * ── AND THE HALF THAT IS ABOUT THE OWNER'S CORPUS ─────────────────────────
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` is
 * `hard`. The exception the owner gave on 2026-09-11 is narrow and its last
 * sentence is the one that matters: *"Your real corpus is never touched."*
 *
 * A test that can leave the owner's corpus modified is worse than a red test,
 * so that sentence is an ASSERTION here and not a comment — the same shape
 * `test/ui/read-model.test.ts` uses for the read surface ("a full sweep of
 * every endpoint here leaves the corpus byte-identical"). This file snapshots
 * every authored byte under `.my_context/`, builds and DRIVES a fully seeded
 * twin, and compares.
 *
 * **A comparison that cannot fail proves nothing**, which is why the last test
 * here exists: it runs the identical comparison over a tree that really did
 * change, and requires it to report the change by name. Without it, a snapshot
 * function that walked nothing at all would pass the assertion above forever.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CORPUS } from './app.ts';
import { openSeeded, scratchCorpus, type Scratch } from './scratch-corpus.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { DIR_NAME } from '../src/core/workspace.ts';
import {
  DRIFTED_DOC, DRIFTED_REF_TITLE, SEEDED_CLEARED, SEEDED_DRAFT_TITLE, SEEDED_LONG, SEEDED_NEVER,
  TIGHT_BUDGETS, draftInQueue, driftedSource, pendingRevision, realInjections, seeds,
  squeezeBudgets,
} from './seeds.ts';

/**
 * **Everything a person authored, and nothing a run derives.**
 *
 * The corpus holds both, and only one of them is what "untouched" is about.
 * `.index.db` is rebuilt from the Markdown on demand; `.audit/` grows an
 * `access` record every time any surface reads (which `e2e/app.ts` names as
 * dogfooding costing what dogfooding costs); `state/` is written by the hooks
 * of whatever session is running. Hashing those would make this test a
 * measurement of the clock.
 *
 * What is left is what a seed WRITES: items, the config a budget lives in, the
 * revision log a staged revision appends to, and the staging directory. If any
 * byte of those moves while a seeded twin is being built and driven, the
 * exception has been broken.
 */
const AUTHORED = ['items', 'config.json', '.revisions', '.staging'] as const;

function snapshotAuthored(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const digest = (file: string): string =>
    createHash('sha256').update(readFileSync(file)).digest('hex');
  const walk = (current: string, label: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const name = `${label}/${entry.name}`;
      if (entry.isDirectory()) walk(full, name);
      else out.set(name, digest(full));
    }
  };
  for (const name of AUTHORED) {
    const full = path.join(root, DIR_NAME, name);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory()) walk(full, name);
    else out.set(name, digest(full));
  }
  return out;
}

/** The files that differ between two snapshots, named, in a stable order. */
function differences(before: Map<string, string>, after: Map<string, string>): string[] {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names].filter((n) => before.get(n) !== after.get(n)).sort();
}

/**
 * One twin, seeded with EVERY state at once, served, and driven — built once
 * for the file because building it costs a corpus copy and two rebuilds, and
 * because the point of the last test is that ALL of this happened while the
 * live corpus stood still.
 *
 * **Serial, and the last test is why.** `fullyParallel` would hand these five
 * tests to five workers and build five twins, at a corpus copy each; worse,
 * the vacuity proof at the foot of this file WRITES into the twin, and a
 * parallel sibling reading the same one would see that write. One worker, in
 * order, and the write happens after everything that reads.
 */
const test = base.extend<object, {
  twin: { scratch: Scratch; harness: UiHarness; before: Map<string, string> };
}>({
  twin: [async ({}, use) => {
    const before = snapshotAuthored(CORPUS);
    const scratch = scratchCorpus(seeds(
      squeezeBudgets(TIGHT_BUDGETS),
      draftInQueue(),
      pendingRevision(),
      driftedSource(),
      realInjections(),
    ));
    const harness = await startUiChild(scratch.root, [], scratch.env);
    try {
      await use({ scratch, harness, before });
    } finally {
      await harness.stop();
      scratch.dispose();
    }
  }, { scope: 'worker', timeout: 180_000 }],
});

test.describe.configure({ mode: 'serial' });

/**
 * Sixty seconds rather than thirty, and the reason is the corpus rather than
 * the browser: `/api/status` runs the whole doctor pass over 1,085 items
 * before it answers, and `/api/doctor` does it again. The twin itself is built
 * under the fixture's own budget and not this one.
 */
test.describe.configure({ timeout: 90_000 });

/**
 * Read one endpoint through the page's own credentialed door.
 *
 * `window.myctx.api` rather than a second HTTP client in the test, for
 * `e2e/served-shape.spec.ts`'s reason: a client of its own authenticates
 * differently from the app and can succeed where the app fails, which is a
 * measurement of the test rather than of the product.
 */
async function api<T>(page: Page, route: string): Promise<T> {
  return await page.evaluate((r) => {
    const ctx = (window as unknown as { myctx: { api: (p: string) => Promise<unknown> } }).myctx;
    return ctx.api(r);
  }, route) as T;
}

interface Spill { id: string; tier: string }
interface Selection { full: { id: string }[]; spilled: Spill[] }
interface Finding { code: string; item?: string; remedy: { route: string; command?: string } }
interface Injected {
  lines: unknown[];
  spills: { alreadyInContext: Spill[]; genuinelyAbsent: Spill[]; error: string | null };
}

/* ══ 1 · squeezeBudgets ════════════════════════════════════════════════════ */

test('a squeezed twin really overflows, on both questions, sharing no row', async ({ page, twin }) => {
  await openSeeded(page, twin.harness);
  const start = await api<Selection>(page, '/api/select?event=session-start&cold=1');
  const tool = await api<Selection>(page, '/api/select?event=tool&path=src/api/handler.ts&cold=1');

  // A row is an item AND the tier that dropped it — `preview-spilled.spec.ts`
  // paid for that distinction on 2026-08-29 and this reads the same pair.
  const rows = (s: Selection): string[] => s.spilled.map((x) => `${x.id} ${x.tier}`);
  const shared = rows(start).filter((r) => rows(tool).includes(r));

  expect(
    Math.min(start.spilled.length, tool.spilled.length),
    'squeezeBudgets must make BOTH questions overflow. On the live corpus at its real budgets '
    + 'each answers spilled: 0, and every spec that pages a spilled list has nothing to page — '
    + 'which is exactly the 16 failures this seed exists to repair.',
  ).toBeGreaterThan(0);

  expect(
    Math.min(start.full.length, tool.full.length),
    'squeezeBudgets must leave something DELIVERED too. A budget squeezed to nothing spills the '
    + 'whole corpus and puts only the display cap under test.',
  ).toBeGreaterThan(0);

  expect(
    shared,
    'a session start spills the pinned tier and the index; a tool event spills jit. The two '
    + 'answers must therefore share no row, or the disjointness those specs measure is vacuous.',
  ).toEqual([]);
});

/* ══ 2 · draftInQueue and pendingRevision ══════════════════════════════════ */

test('a seeded twin has both halves of the Review queue to draw', async ({ page, twin }) => {
  await openSeeded(page, twin.harness);
  const status = await api<{
    reviewQueue: { drafts: number }; pendingRevisions: { revisions: number };
  }>(page, '/api/status');

  expect(
    status.reviewQueue.drafts,
    'draftInQueue must put a draft in the queue. The live corpus reports drafts: 0, which is why '
    + 'the announce and execute specs time out waiting for a control that only draws when '
    + 'something is pending.',
  ).toBeGreaterThan(0);

  expect(
    status.pendingRevisions.revisions,
    'pendingRevision must stage one. The live corpus reports revisions: 0 — both revisions in '
    + '.revisions/ were promoted on 2026-08-29 — and no mycontext command can stage another, '
    + 'because the CLI writes as origin: human and only a non-human origin is held.',
  ).toBeGreaterThan(0);
});

/* ══ 3 · driftedSource ═════════════════════════════════════════════════════ */

test('a seeded twin answers exactly one doctor repair, and it routes to run', async ({ page, twin }) => {
  await openSeeded(page, twin.harness);
  const { findings } = await api<{ findings: Finding[] }>(page, '/api/doctor');
  const repairs = findings.filter((f) => f.remedy.route === 'run');

  expect(
    repairs.map((f) => `${f.code} → ${f.remedy.command}`),
    'driftedSource must produce exactly ONE run-routed finding, and it must be the refresh. '
    + 'Measured on the live corpus 2026-09-11: 78 findings, all 78 routing to acknowledge, so '
    + "execute.spec.ts's repair confirm cannot be reached there at all. Exactly one is what "
    + 'makes .first() on that screen unambiguous.',
  ).toEqual(['source_drift → refresh']);
});

/* ══ 4 · realInjections ════════════════════════════════════════════════════ */

test('a seeded twin carries the three session shapes, and they differ', async ({ page, twin }) => {
  await openSeeded(page, twin.harness);
  const long = await api<Injected>(page, `/api/session/${SEEDED_LONG}/injected`);
  const cleared = await api<Injected>(page, `/api/session/${SEEDED_CLEARED}/injected`);
  const never = await api<Injected>(page, `/api/session/${SEEDED_NEVER}/injected`);

  expect(
    [long.spills.error, cleared.spills.error, never.spills.error],
    'the audit projection must be current in the twin, or every split below reads as a refusal '
    + 'rather than as a measurement. realInjections runs `mycontext audit` after the hooks for '
    + 'exactly this reason.',
  ).toEqual([null, null, null]);

  const shape = (i: Injected): string =>
    `lines ${i.lines.length > 0 ? 'some' : 'none'}`
    + ` · already ${i.spills.alreadyInContext.length > 0 ? 'some' : 'none'}`
    + ` · absent ${i.spills.genuinelyAbsent.length > 0 ? 'some' : 'none'}`;

  expect(
    [shape(long), shape(cleared), shape(never)],
    'the three sessions must be three DIFFERENT shapes: a working session with a window and both '
    + 'halves of the split; a cleared one that kept its injection history and lost its window; '
    + 'and an id nothing ever wrote, which reports a measured zero rather than a blank. On the '
    + 'live corpus every session answers the third shape, so a spec asserting the first two is '
    + 'asserting nothing.',
  ).toEqual([
    'lines some · already some · absent some',
    'lines none · already none · absent some',
    'lines none · already none · absent none',
  ]);

});

/* ══ 5 · THE OWNER'S CORPUS ════════════════════════════════════════════════ */

test('every authored byte of THIS repository is identical after a seeded twin was built and driven', async ({ page, twin }) => {
  await openSeeded(page, twin.harness);
  // Driven, not merely built: a page that never loaded proves nothing about
  // what a server over a copy does to the original.
  await api<Selection>(page, '/api/select?event=session-start&cold=1');

  expect(
    twin.before.size,
    'the snapshot must actually see this repository\'s corpus — an empty walk would satisfy '
    + 'every comparison below forever.',
  ).toBeGreaterThan(1000);

  expect(
    differences(twin.before, snapshotAuthored(CORPUS)),
    'building, seeding and driving a throwaway twin must leave this repository\'s own corpus '
    + 'byte-identical. That is the whole of the owner\'s exception: "Your real corpus is never '
    + 'touched." If a file named here is an item another lane is editing right now, this is '
    + 'reporting that lane and not this one — check it before reading it as a leak.',
  ).toEqual([]);

  // And the sharper half, which no concurrent lane can confuse: not one of the
  // things a seed creates may exist here, by name.
  const leaked = [
    path.join(CORPUS, DRIFTED_DOC),
    ...readdirSync(path.join(CORPUS, DIR_NAME, 'items'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .flatMap((e) => readdirSync(path.join(CORPUS, DIR_NAME, 'items', e.name))
        .map((f) => path.join(CORPUS, DIR_NAME, 'items', e.name, f)))
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        return text.includes(SEEDED_DRAFT_TITLE) || text.includes(DRIFTED_REF_TITLE);
      }),
  ].filter((f) => existsSync(f)).map((f) => path.relative(CORPUS, f));

  expect(
    leaked,
    'not one artefact e2e/seeds.ts creates may exist in this repository. Each is created inside '
    + 'a mkdtemp copy and deleted with it; anything found here escaped.',
  ).toEqual([]);
});

/* ══ 6 · AND THE COMPARISON ITSELF ═════════════════════════════════════════ */

test('the comparison is not vacuous: it names a file on a tree that really changed', async ({ twin }) => {
  // The same snapshot function, over the twin's own corpus, across a write
  // this test makes to the twin and nowhere else. Without this, a
  // `snapshotAuthored` that walked nothing would keep the test above green
  // forever — which is the "assertion that cannot fail" this project has
  // caught in seven of its last eight lanes.
  const before = snapshotAuthored(twin.scratch.root);
  const marker = path.join(twin.scratch.myContextDir, 'items', 'note', 'zz-proof-of-noticing.md');
  writeFileSync(marker, '# not an item, a proof that the comparison notices a byte\n');

  expect(
    differences(before, snapshotAuthored(twin.scratch.root)),
    'snapshotAuthored must NOTICE a file appearing under items/. If this is empty, the '
    + 'byte-identical assertion above is measuring nothing and must not be believed.',
  ).toEqual(['items/note/zz-proof-of-noticing.md']);
});

/* ══ 7 · AND THE COPY IS ACTUALLY GONE ═════════════════════════════════════ */

/**
 * **A twin that outlives its test is a 68 MB leak, once per test.**
 *
 * `dispose` used to try `rmSync` once and swallow the failure, on the reasoning
 * that a stray temp directory is litter rather than a defect. Measured on this
 * machine 2026-09-11: `%TEMP%` held **118 `myctx-e2e-` workspace roots against
 * 13 `myctx-e2eh-` home boxes** — so the home box, which no process opens, went
 * nearly every time, and the workspace, which a UI server had a SQLite handle
 * on, survived about nine times in ten. Several of the survivors are full
 * copies of this corpus.
 *
 * The server is started and stopped here on purpose, so the delete is asked to
 * win against the handle rather than in an empty directory.
 *
 * **AND WHAT THIS TEST DOES NOT PROVE, said plainly.** The retry was removed
 * once — twelve attempts cut to one — and this test STAYED GREEN: the single
 * `rmSync` won that time. So the retry's necessity rests on the `%TEMP%`
 * census above and not on a reproduction here; the race is real but it is not
 * reliable enough for one run to catch. What this test does prove is that the
 * copy is gone when the test ends, which goes red the moment `dispose` stops
 * deleting — and that is the property a leak actually violates.
 */
test('a twin and its throwaway home are gone after a server has held them open', async () => {
  const scratch = scratchCorpus();
  const harness = await startUiChild(scratch.root, [], scratch.env);
  await harness.stop();
  scratch.dispose();
  expect(
    [existsSync(scratch.root), existsSync(scratch.homeBox)],
    'both halves of the twin must be deleted, and deleted even though a server held the '
    + 'workspace open a moment ago. Anything left here is a full copy of this corpus sitting in '
    + '%TEMP% for every test that ran.',
  ).toEqual([false, false]);
});
