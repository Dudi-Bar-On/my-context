// @basis TASK-the-composer-is-tested-as-a-user-would-use-it-every-field, DEC-run-is-removed-execute-is-the-only-way-to-run-what-the
/**
 * **THE BAR: A TEST PASSES ONLY ONCE THE COMMAND HAS BEEN EXECUTED AND HAS
 * RETURNED THE CORRECT RESULT.**
 *
 * `plan:builder seq:11` (D12), the sentence the owner says decides what
 * "passes" means. `composer-matrix.spec.ts` sweeps the form; this file runs
 * what the form composed and checks the answer against the CLI itself.
 *
 * ── THE ORACLE IS THE REAL CLI, IN THE SAME WORKSPACE ─────────────────────
 *
 * "The correct result" cannot be a string a test author typed, because then the
 * test asserts that the author and the product agree rather than that the
 * product is right. So every execution here is compared to `node src/cli/index.ts
 * <the same argv>` run in the same workspace: the UI's exit code must be the
 * CLI's exit code, and for the reads whose output is content rather than a
 * report, the UI's stdout must be the CLI's stdout.
 *
 * ── WHY EVERYTHING RUNS IN A DISPOSABLE COPY OF THE LIVE CORPUS ───────────
 *
 * The standing rule is that tests run against the CURRENT corpus, and the
 * item's own paragraph grants exactly one exception: *"`e2e/execute.spec.ts`
 * already isolates write tests into their own workspace and is the precedent to
 * follow rather than a new mechanism to invent."* Both are honoured here by
 * copying the live corpus and running in the copy — the DATA is the current
 * corpus, and the WRITES land nowhere the owner has to clean up.
 *
 * It is also not optional for the reads. `src/ui/execute.ts` appends an
 * `execute` audit record BEFORE it runs anything, so there is no such thing as
 * running a read from this UI without writing to the corpus it read.
 *
 * **And it is what makes the item's write clause reachable at all.** Two thirds
 * of the runnable entries are writes; `pin` and `add` are run here for real,
 * and what they did is read back out of the files afterwards.
 *
 * ── WHAT THIS FILE DOES *NOT* INHERIT FROM ITS PRECEDENT ──────────────────
 *
 * `e2e/execute.spec.ts` passes 10/10 over `.demo-corpus` and, measured today,
 * 2/8 over this repository's own corpus. Every one of the six failures is a
 * CORPUS-CONTENT assumption in the spec rather than a product defect, and they
 * are named in this lane's report. This file takes the isolation pattern and
 * none of the assumptions: it reads its fixtures out of the workspace it built
 * (`firstItemId`, `firstUnpinnedItemId`), and where the corpus cannot supply
 * something it SEEDS it with the real commands rather than assuming it is there.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { CORPUS } from './app.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { snapshot, worthCopying } from '../src/ui/execute-effect.ts';
import { DIR_NAME } from '../src/core/workspace.ts';
import { CATEGORIES } from '../src/core/categories.ts';
import { openRebuiltStore } from '../src/core/open-store.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import { stageRevision } from '../src/core/revision.ts';
import {
  CLI, CMD, PAL, chooseEntry, composedLine, controlsOf, currentValues, meantArgv,
  openComposer, setValue, settled, specsOf,
} from './composer.ts';

interface Workspace { root: string; myContextDir: string }

/**
 * A disposable copy of the live corpus, indexed. `worthCopying` (skip `.audit`
 * and `.index.db*`) is reused from `src/ui/execute-effect.ts` rather than
 * re-spelled, and `rebuild` is run here rather than left to the server because
 * the server's read routes open the index `openReadOnlyChecked`, which cannot
 * CREATE a database that does not exist — `e2e/execute.spec.ts` measured every
 * SQLite-backed route answering `unable to open database file` without it.
 */
function makeWorkspace(): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-d12-'));
  cpSync(CORPUS, root, { recursive: true, filter: worthCopying });
  execFileSync(process.execPath, [CLI, 'rebuild'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  return { root, myContextDir: path.join(root, DIR_NAME) };
}

/** The CLI's own answer to an argv, in the workspace under test. THE ORACLE. */
function cli(root: string, argv: readonly string[]): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [CLI, ...argv], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    return { code: e.status ?? -1, out: e.stdout ?? '' };
  }
}

/**
 * Two texts compared as a person compares two terminal outputs: trailing
 * whitespace and blank-line runs do not carry meaning, and the UI renders
 * stdout into a `<pre>` through `textContent`.
 */
function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

/** An id this workspace's own files carry — never a hard-coded one. */
function firstItemId(dir: string): string {
  for (const [, text] of snapshot(dir)) {
    const id = /^id:\s*(\S+)/m.exec(text)?.[1];
    if (id !== undefined) return id;
  }
  throw new Error(`e2e: no item under ${dir}`);
}

/**
 * **The first item this corpus says is not pinned AND COULD BE — which is two
 * conditions, and the second one is the whole lesson of this helper.**
 *
 * `e2e/execute.spec.ts` asks only the first: the first item whose `always` is
 * `false`. On `.demo-corpus` that lands on something pinnable and its boundary
 * test passes. On THIS repository's corpus the first such item is
 * `ADR-build-rather-than-adopt`, and `pin` refuses it outright, correctly and
 * in its own words:
 *
 *     "always" is a field on every item, but it only governs on the NORMATIVE
 *     tier — and "adr" is a rationale-tier category in this project. `always:
 *     true` asks for the pinned tier, which selection admits only normative
 *     items to, so this would be stored and then do nothing at all.
 *
 * That refusal is the product being right. What was wrong was the fixture, and
 * the shape of the wrongness is exactly what this lane was told not to inherit:
 * a corpus-content assumption that reads as a product failure. It presents as
 * "the confirm never opened", which is why it has been attributed to the
 * derivation being slow — the confirm GET is refused in about a second and the
 * timeout that follows is a test waiting for something that already answered.
 *
 * So the tier is read from `CATEGORIES`, the same record `isNormative` consults,
 * rather than from a list of category names this file would have to keep.
 */
function firstUnpinnedItemId(dir: string): string {
  const normative = new Set(
    Object.values(CATEGORIES).filter((c) => c.tier === 'normative').map((c) => c.name),
  );
  for (const [, text] of snapshot(dir)) {
    const always = /^always:\s*(\S+)/m.exec(text)?.[1];
    const id = /^id:\s*(\S+)/m.exec(text)?.[1];
    const type = /^type:\s*(\S+)/m.exec(text)?.[1];
    if (always === 'false' && id !== undefined && type !== undefined && normative.has(type)) {
      return id;
    }
  }
  throw new Error(
    `e2e: no item under ${dir} is both unpinned and on the normative tier — \`pin\` governs `
    + 'only there, so there is nothing in this corpus the boundary test could pin',
  );
}

/** Open the app on a server of our own, authenticated the way a person is. */
async function openApp(page: Page, h: UiHarness): Promise<void> {
  await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
  await expect(
    page.locator('.nav').first(),
    'the isolated server never rendered a rail button — it probably has no token',
  ).toBeVisible({ timeout: 20_000 });
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
  }
}

/**
 * **THE OUTCOME REGION FOR ONE COMPOSED LINE, and never for the line before it.**
 *
 * `.execresult` cannot be reached with `.first()`, and that is a property of
 * the product rather than a quirk of the selector. `app.js`' own
 * `attachExecuteOutcome` CARRIES the outcome node across the redraw its run
 * caused, and re-homes it onto a control whose `data-cmdkey` matches; when the
 * composed line has moved on there is no match and the outcome goes to the TOP
 * OF THE SECTION instead, deliberately, so a reader is not left hunting for
 * what their click did. So after running `status` and then choosing `doctor`,
 * the palette section holds `status`'s outcome above `doctor`'s form — and a
 * `.first()` reads the wrong run. This test asserted `mycontext status` where
 * it had composed `mycontext doctor` and was right to fail.
 *
 * `data-cmdkey` is `commandActions`' own identity for a control — the composed
 * line — and is stamped on the result region for exactly this. Selecting by it
 * is asking for the outcome of THIS command by the product's own name for it.
 */
function outcomeFor(page: Page, line: string): Locator {
  return page.locator(`${PAL} .execresult[data-cmdkey="${line.replace(/"/g, '\\"')}"]`);
}

/**
 * Press Execute and wait for the confirm — or for the reason there is not one.
 *
 * The wait races the confirm against the result region's own error note, so a
 * refused confirm GET fails in the SERVER'S words within seconds instead of
 * timing out in ninety and saying only "hidden".
 */
async function openConfirm(page: Page, what: string): Promise<Locator> {
  const actions = page.locator(`${CMD} .cmdactions`).first();
  await expect(actions, `${what}: a command control is on screen to press`).toHaveCount(1);
  await actions.getByRole('button', { name: 'Execute', exact: true }).click();
  const confirm = actions.locator('.confirm');
  // Polled only while the control is still WORKING; the assertion is made once,
  // afterwards. `expect.poll(...).toBe('open')` keeps polling a settled refusal
  // until the timeout, which is how a confirm refused in one second reported
  // itself as three and a half minutes of nothing.
  let state = 'waiting';
  await expect
    .poll(async () => {
      state = await readState();
      return state === 'waiting' ? 'waiting' : 'settled';
    }, {
      timeout: 180_000,
      intervals: [200, 500, 1000, 2000],
      message: `${what}: the confirm neither opened nor said why. The confirm GET derives the `
        + 'effect by copying the corpus to a scratch directory and running the command there '
        + '(`src/ui/execute-effect.ts`), which costs real seconds.',
    })
    .toBe('settled');
  expect(state, `${what}: the confirm must open`).toBe('open');
  return confirm;

  async function readState(): Promise<string> {
    {
      if (await confirm.isVisible().catch(() => false)) return 'open';
      // **Everything the control is saying, not just the shape this test hoped
      // for.** The first version of this wait watched only `.spill`, and when
      // the confirm did not open it reported "hidden" and nothing else — three
      // tests spent 3.5 minutes each arriving at a message that named no cause.
      // The result region is a live region the product fills with the reason,
      // so the reason is what the failure should carry.
      const said = (await actions.locator('.execresult').textContent().catch(() => '')) ?? '';
      // `exec.checking` is the pending sentence the control draws while the
      // derivation runs, so it is a WAIT and not an answer. Anything else in
      // this region is the reason there will be no confirm.
      if (said.trim() === '' || /Checking|בודק|נבדק/.test(said)) return 'waiting';
      return `the control says: ${said.trim().slice(0, 500)}`;
    }
  }
}

/** Press Execute, answer the confirm, and settle. THE NONCE PATH, NOT BYPASSED. */
async function runIt(page: Page, line: string, what: string): Promise<void> {
  // **The confirm is NOT bypassed**, which is the item's own instruction about
  // the approval boundary: "Entries that sit on the approval boundary exercise
  // the confirm-and-nonce path, which must not be bypassed to make a test
  // convenient." The nonce is minted by the GET that renders this, and spending
  // it is the only way to reach the run.
  const confirm = await openConfirm(page, what);
  await confirm.getByRole('button', { name: 'Run it', exact: true }).click();
  await expect(outcomeFor(page, line).locator('.exitcode'), `${what}: an outcome arrives`)
    .toBeVisible({ timeout: 180_000 });
}

/**
 * What the outcome region says: the exit code it drew, and what the command
 * printed — ALL of what it printed, which takes a click.
 *
 * **The output is BOUNDED, and that is a feature rather than truncation.**
 * `saidNodes` hands the command's lines to `boundedList` with `BOUND_CAP_LIST`,
 * so a long answer is drawn as an opening window under a "Show all N" control.
 * Comparing the drawn window to the CLI's whole stdout reports a difference
 * that is not one: `mycontext show <id>` lost its entire body and every
 * observation, sixteen lines, and looked like the UI dropping output.
 *
 * So this presses the control, which is what a reader does and which also makes
 * the affordance itself part of what is under test — a "Show all" that did not
 * show all would fail the comparison below rather than passing quietly.
 */
async function outcome(page: Page, line: string): Promise<{ code: number; out: string; ran: string }> {
  const region = outcomeFor(page, line);
  const codeText = (await region.locator('.exitcode').first().textContent()) ?? '';
  const code = Number(/(-?\d+)/.exec(codeText)?.[1] ?? 'NaN');
  const showAll = region.getByRole('button', { name: /^Show all |^הצג את כל / });
  if (await showAll.count() > 0 && await showAll.first().isVisible().catch(() => false)) {
    await showAll.first().click();
  }
  const said = region.locator('pre.lit');
  const out = await said.count() > 0 ? ((await said.first().textContent()) ?? '') : '';
  const ran = (await region.locator('.cmd code').first().textContent()) ?? '';
  return { code, out, ran };
}

/* ══ 1 — READS, RUN, AND CHECKED AGAINST THE CLI ══════════════════════════ */

base('every read the catalogue licenses runs, and answers exactly what the CLI answers',
  async ({ page }) => {
    base.setTimeout(600_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(ws.root);
      await openApp(page, harness);
      await openComposer(page);

      const itemId = firstItemId(ws.myContextDir);
      /**
       * The reads, and the value each needs to be a read of something.
       *
       * `rebuild` is licensed to run and is excluded from THIS test rather
       * than forgotten: it rewrites `.index.db`, so its "correct result" is a
       * file on disk rather than a line of stdout, and comparing its output to
       * a second rebuild's would compare two writes. It runs in test 4.
       */
      /**
       * The reads, the value each needs to be a read of something, and how
       * strongly its answer can be compared.
       *
       * `full` — the whole of stdout must match the CLI's, byte for byte after
       * whitespace normalisation. Reserved for answers that fit in one drawn
       * window: `saidNodes` PAGES a long answer as well as capping it, and
       * "Show all" expands within a page rather than across them, so a
       * thousand-row `list` cannot be compared this way without asserting a
       * fact about `BOUND_CAP_LIST` instead of about the command.
       *
       * `first` — the exit code and the command's own first line. That is the
       * honest bar for the four REPORTS, whose bodies carry counts that this
       * run's own audit record has already moved by the time the comparison is
       * made, and for the uncapped `list`, which is the paged case and is
       * included deliberately rather than avoided: it is the shape a reader
       * meets most often on this corpus.
       *
       * `list invariant` rather than `list` for the `full` case, and the
       * category is chosen because it is SMALL (10 lines on this corpus)
       * rather than because it is interesting — the comparison is about the
       * pipe from the CLI to the screen, and a large answer tests the pager.
       *
       * `rebuild` is licensed to run and is absent on purpose rather than
       * forgotten: it rewrites `.index.db`, so its "correct result" is a file
       * on disk and comparing its stdout to a second rebuild's would compare
       * two writes.
       */
      const cases: [string, Record<string, string>, 'full' | 'first'][] = [
        ['status', {}, 'first'],
        ['doctor', {}, 'first'],
        ['decay', {}, 'first'],
        ['review revisions', {}, 'first'],
        ['show', { id: itemId }, 'full'],
        ['list', { category: 'invariant' }, 'full'],
        ['search', { text: 'retry' }, 'full'],
        ['help', {}, 'full'],
        ['list', {}, 'first'],
      ];

      let ran = 0;
      for (const [name, values, how] of cases) {
        const def = await chooseEntry(page, name);
        const controls = await controlsOf(page, def);
        for (const [field, value] of Object.entries(values)) {
          const spec = specsOf(def).find((s) => s.name === field)!;
          await setValue(controls.get(field)!, spec, value);
        }
        expect(await settled(page), `${name}: the CLI's parser accepts the composed line`)
          .toBe('passed');

        const line = await composedLine(page);
        expect(line, `${name}: a line composes`).not.toBeNull();
        const argv = meantArgv(def, await currentValues(def, controls));

        // **THE ORACLE, TAKEN BEFORE THE RUN.** The UI's own execution appends
        // an audit record, so asking the CLI afterwards would be asking it
        // about a corpus the measurement itself had already moved.
        const truth = cli(ws.root, argv);

        await runIt(page, line!, name);
        const got = await outcome(page, line!);

        // **The command that ran is the command that was shown.** `exec.ran`
        // draws the argv this control was built with, and the item's whole
        // subject is that a composed line and what actually happened must not
        // be two different things.
        expect(got.ran, `${name}: the outcome names the line that was composed`).toBe(line);
        expect(got.code, `${name}: the UI's exit code IS the CLI's exit code`).toBe(truth.code);

        // **AND THE CORRECT RESULT.** For the four content reads the whole of
        // stdout is compared; for the four reports it is the command's own
        // first line, because a report carries counts this run's own audit
        // record has already changed by the time the comparison is made.
        if (how === 'full') {
          expect(normalise(got.out), `${name}: the UI's output IS the CLI's output`)
            .toBe(normalise(truth.out));
        } else {
          expect(normalise(truth.out).length, `${name}: the CLI printed something to compare`)
            .toBeGreaterThan(0);
          expect(normalise(got.out).split('\n')[0], `${name}: the UI's first line is the CLI's`)
            .toBe(normalise(truth.out).split('\n')[0]);
        }
        ran += 1;
      }
      expect(ran, 'reads executed and checked against the CLI').toBe(cases.length);
    } finally {
      await harness?.stop();
      try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* Windows lock */ }
    }
  });

/* ══ 2 — THE TWO PATHS THAT EXIST TODAY, AND THEY AGREE ═══════════════════ */

base('the browser composes an argv and the server rebuilds it, and the two agree',
  async ({ page }) => {
    base.setTimeout(300_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(ws.root);
      await openApp(page, harness);
      await openComposer(page);
      const itemId = firstUnpinnedItemId(ws.myContextDir);

      /**
       * **THE ITEM'S "BOTH PATHS AGREE" CLAUSE, POINTED AT THE TWO PATHS THAT
       * STILL EXIST.**
       *
       * The clause names RUN and EXECUTE. `DEC-run-is-removed-execute-is-the-
       * only-way-to-run-what-the` deleted RUN on 2026-09-07 — see this lane's
       * report — so the pair it named is gone. What has NOT gone is the reason
       * the clause was written: one composed line, two independent derivations
       * of what it means, either of which can drift.
       *
       * Today those two are the BROWSER's `commandFor(def, values)`, which
       * draws the line a reader reads, and the SERVER's `resolveCommand(id,
       * values)` (`src/ui/execute-catalogue.ts`), which rebuilds the argv from
       * the entry id and the values the confirm was asked with and is what
       * actually runs. §3.1's whole design is that the client sends an id and
       * never a command, so these two are genuinely separate derivations and
       * the confirm answers with the server's own `argv` — which is what makes
       * the disagreement observable at all.
       *
       * This is the assertion `builder/15` would have made about RUN, made
       * about the pair that replaced it.
       */
      for (const [name, values] of [
        ['pin', { id: itemId, yes: true }],
        ['harden', { id: itemId, yes: true }],
        ['show', { id: itemId }],
        ['search', { text: 'retry budget' }],
      ] as [string, Record<string, string | boolean>][]) {
        const def = await chooseEntry(page, name);
        const controls = await controlsOf(page, def);
        for (const [field, value] of Object.entries(values)) {
          const spec = specsOf(def).find((s) => s.name === field)!;
          await setValue(controls.get(field)!, spec, value);
        }
        const mine = meantArgv(def, await currentValues(def, controls));
        const shown = await composedLine(page);

        /**
         * **THE SERVER'S ARGV IS READ OFF THE CONFIRM, not fetched.**
         *
         * A hand-rolled `fetch` from the page carries no credential and is
         * refused — `app.js` says so in as many words, and the first draft of
         * this test learned it as `Received: undefined`. That was worth
         * learning twice: the same shortcut in `composer-matrix.spec.ts`' own
         * refusal test made an unauthenticated 401 look like the catalogue
         * refusing an unlicensed command, which is a test passing for a reason
         * that has nothing to do with what it claims.
         *
         * So this reads the value a PERSON is shown. `commandActions` renders
         * the confirm's command box out of `answer.argv` — the server's own
         * rebuild, `composeCommand`d — so the text in that box IS the server's
         * derivation, and comparing it to the composed line above compares
         * exactly what the item's clause is about: the line the reader approves
         * and the line that runs.
         */
        const confirm = await openConfirm(page, name);
        const theirs = (await confirm.locator('.cmd code').first().textContent()) ?? '';

        expect(
          theirs,
          `${name}: the argv the SERVER would run must be the argv the BROWSER showed — `
          + 'a reader who approves a line must be approving the line that runs',
        ).toBe(shown);
        // And it is the argv the catalogue means, so the agreement is not two
        // copies of one mistake.
        expect(theirs, `${name}: and both are the catalogue's own argv`)
          .toBe(`mycontext ${mine.map((a) => (/^[A-Za-z0-9@%_+=:,.\/\-]+$/.test(a) ? a : `"${a.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)).join(' ')}`);

        // Left without running: this test is about what the two paths SAY, and
        // the confirm is the last point at which nothing has happened yet.
        await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
    } finally {
      await harness?.stop();
      try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* Windows lock */ }
    }
  });

/* ══ 3 — A WRITE ON THE APPROVAL BOUNDARY, RUN FOR REAL ═══════════════════ */

base('a boundary write runs behind the confirm, and the corpus says what it did',
  async ({ page }) => {
    base.setTimeout(300_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(ws.root);
      await openApp(page, harness);
      await openComposer(page);
      const itemId = firstUnpinnedItemId(ws.myContextDir);

      const def = await chooseEntry(page, 'pin');
      const controls = await controlsOf(page, def);
      await setValue(controls.get('id')!, specsOf(def).find((s) => s.name === 'id')!, itemId);
      // `--yes` deliberately: `pin` is `edit --always=true` under a shorter name
      // and inherits `edit`'s confirmation gate, so composing it WITHOUT `--yes`
      // composes a command that previews and then declines for want of a
      // terminal — the opposite of what this test proves.
      await setValue(controls.get('yes')!, specsOf(def).find((s) => s.name === 'yes')!, true);
      expect(await settled(page), 'pin: the parser accepts it').toBe('passed');

      const holding = [...snapshot(ws.myContextDir)].find(([, t]) => t.includes(`id: ${itemId}`))!;
      expect(holding[1], 'chosen precisely because it is not yet pinned')
        .toMatch(/^always:\s*false/m);

      const line = await composedLine(page);
      const confirm = await openConfirm(page, `pin ${itemId}`);

      // **The security surface, and it is the reason the confirm exists**: every
      // field the command changes is named, before and after, and only then is
      // there a button that runs it.
      await expect(
        confirm.getByRole('table', { name: /changes/i }),
        `\`pin ${itemId}\` must show a non-empty diff — the item was chosen because \`always\` `
        + 'genuinely changes',
      ).toBeVisible({ timeout: 30_000 });
      await expect(confirm.locator('.residual'), "and the residual risk, in the reader's language")
        .not.toBeEmpty();
      await confirm.getByRole('button', { name: 'Run it', exact: true }).click();
      await expect(outcomeFor(page, line!).locator('.exitcode'), 'an outcome arrives')
        .toBeVisible({ timeout: 180_000 });

      const got = await outcome(page, line!);
      expect(got.code, 'pin exits clean').toBe(0);

      // **THE CORRECT RESULT IS ON DISK, and that is the only place it can be
      // read honestly.** A screen that says a write worked is the claim; the
      // file is the evidence.
      const after = [...snapshot(ws.myContextDir)].find(([, t]) => t.includes(`id: ${itemId}`))![1];
      expect(after, `the corpus must record that ${itemId} is now pinned`)
        .toMatch(/^always:\s*true/m);
      // And the CLI agrees about what the corpus now says.
      const shown = cli(ws.root, ['show', itemId]);
      expect(shown.code, 'the CLI can still read the item it just changed').toBe(0);
    } finally {
      await harness?.stop();
      try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* Windows lock */ }
    }
  });

/* ══ 4 — THE SHELL-ACTIVE VALUE, EXECUTED ═════════════════════════════════ */

base('a value the Composer refuses to COPY still executes as a literal, and is stored as one',
  async ({ page }) => {
    base.setTimeout(300_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(ws.root);
      await openApp(page, harness);
      await openComposer(page);

      /**
       * **THE OTHER HALF OF THE `$(…)` ASYMMETRY, PROVED BY RUNNING IT.**
       *
       * `composer-matrix.spec.ts` proves that a value carrying `$` blocks Copy
       * on all 42 free-text boxes, because a PASTE reaches a shell where the
       * substitution is live. `command-actions.js` says the other half out
       * loud — "an execution reaches `execFile` with an argv array, where it is
       * an ordinary literal" — and that half had never been executed. This runs
       * it and reads the value back out of the item's own file: if the claim
       * were wrong, what lands on disk is the output of `id`.
       */
      const title = 'D12 literal before$(id)after';
      const def = await chooseEntry(page, 'add');
      const controls = await controlsOf(page, def);
      const categories = await controls.get('category')!.locator('option').evaluateAll(
        (nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ''),
      );
      await setValue(controls.get('category')!,
        specsOf(def).find((s) => s.name === 'category')!, categories[0]!);
      await setValue(controls.get('title')!,
        specsOf(def).find((s) => s.name === 'title')!, title);
      // **`--summary` is not decoration here, and the product said so.** Without
      // it the confirm GET is refused outright: "this capture carries no
      // summary, and an item created without one can never afterwards be asked
      // for it … `summary_stale` compares a summary against the content it was
      // written against, so an item with none is invisible to that check."
      // That refusal is the product being right, and it is the second
      // corpus-shaped assumption this file met head-on: a test that supplies
      // the minimum a form accepts is not a test that supplies what the COMMAND
      // requires.
      await setValue(controls.get('summary')!,
        specsOf(def).find((s) => s.name === 'summary')!,
        'A D12 fixture proving an argv array carries $(…) as a literal.');
      await setValue(controls.get('yes')!, specsOf(def).find((s) => s.name === 'yes')!, true);

      // Copy is refused — the matrix spec's rule, restated here because this
      // test is about the control being refused and the RUN not being.
      await expect(
        page.locator(`${CMD} .cmdactions`).locator(':scope > button').first(),
        'Copy stays refused for a shell-active value',
      ).toBeDisabled();

      const line = await composedLine(page);
      await runIt(page, line!, 'add with a shell-active title');
      const got = await outcome(page, line!);
      expect(got.code, 'add exits clean').toBe(0);

      // **What is on disk is the literal, not the expansion.**
      const written = [...snapshot(ws.myContextDir)].find(([, t]) => t.includes(title));
      expect(written, `an item titled "${title}" must exist — the run reported exit 0`)
        .not.toBeUndefined();
      expect(
        written![1],
        'SECURITY — the stored title must be the literal the reader typed; if `id` ran, the '
        + 'argv array was not what reached the child process',
      ).toContain('before$(id)after');
      expect(written![1], 'and nothing that looks like the output of `id`')
        .not.toMatch(/uid=\d+/);
    } finally {
      await harness?.stop();
      try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* Windows lock */ }
    }
  });

/* ══ 5 — THE FOUR ENTRIES THIS CORPUS STARVES ═════════════════════════════ */

/**
 * **SEEDED WITH THE REAL MUTATION SURFACE, never by writing a row.**
 *
 * `scripts/demo-corpus.ts` states the rule this follows and the reason for it:
 * *"Nothing writes a row into a table to make a screen look full; the owner's
 * standing rule is that a fixture which fakes data teaches the gate to accept a
 * lie."* So a draft is reached the way a human reaches one — `mycontext add`
 * then `mycontext edit --status draft` — and a revision is staged by
 * `stageRevision` with `origin: 'agent'`, which is exactly what an agent's
 * `update_item` does when it proposes a change to an item a human owns.
 */
function seedQueues(ws: Workspace): void {
  const drafts: [string, string][] = [
    ['rule', 'A D12 fixture draft, so the review queue is a queue'],
    ['constraint', 'A second D12 fixture draft, because one draft is not a list'],
  ];
  for (const [category, title] of drafts) {
    execFileSync(process.execPath, [
      CLI, 'add', category, title,
      '--body', 'Created by e2e/composer-execute.spec.ts to give `review promote` and `review '
        + 'discard` something to name. Discarded with the workspace.',
      '--summary', 'A fixture draft for the D12 composer sweep.',
      '--yes',
    ], { cwd: ws.root, encoding: 'utf8', stdio: 'pipe' });
    const made = [...snapshot(ws.myContextDir)]
      .find(([, t]) => t.includes(title));
    const id = /^id:\s*(\S+)/m.exec(made![1])![1]!;
    execFileSync(process.execPath, [CLI, 'edit', id, '--status', 'draft', '--yes'],
      { cwd: ws.root, encoding: 'utf8', stdio: 'pipe' });
  }

  // One staged revision, so `review promote-revision` and `review
  // discard-revision` have a `REV-…` to name.
  const workspace = resolveWorkspace(ws.root);
  const { store } = openRebuiltStore(workspace);
  try {
    const target = store.all()
      .filter((it) => it.origin === 'human' && it.status === 'active')
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (target === undefined) throw new Error('e2e: no human item to propose against');
    stageRevision(
      { root: workspace.projectRoot!, store, config: workspace.config },
      target.id,
      { title: `${target.title}, as a D12 fixture proposes it` },
      'agent',
    );
  } finally {
    store.close();
  }
}

base('the four review entries, on a corpus that has a draft and a revision to name',
  async ({ page }) => {
    base.setTimeout(300_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      seedQueues(ws);
      execFileSync(process.execPath, [CLI, 'rebuild'],
        { cwd: ws.root, encoding: 'utf8', stdio: 'pipe' });
      harness = await startUiChild(ws.root);
      await openApp(page, harness);
      await openComposer(page);

      /**
       * **THE COVERAGE THIS LANE COULD NOT REACH ON THE LIVE CORPUS, REACHED.**
       *
       * `composer-matrix.spec.ts` drives 17 of the catalogue's 23 switches and
       * names the six it cannot: `review promote`'s `always` and `yes`, `review
       * discard`'s `yes`, `review promote-revision`'s `force` and `yes`, and
       * `review discard-revision`'s `yes`. All six are unreachable for one
       * reason — those four entries take a REQUIRED `<select>` sourced from
       * `drafts` or `revisions`, and this repository's own corpus has none of
       * either, so the picker is correctly disabled and no line composes.
       *
       * That is a fact about the corpus rather than about the screen, and the
       * item's answer to it is already written: tests run against the current
       * corpus, and a write test gets an isolated workspace. This is that
       * workspace with two drafts and one revision put into it by the real
       * commands, which is the only way "every combination" can mean every
       * combination on a corpus whose queues happen to be empty today.
       */
      let branches = 0;
      for (const name of
        ['review promote', 'review discard', 'review promote-revision', 'review discard-revision']
      ) {
        const def = await chooseEntry(page, name);
        const controls = await controlsOf(page, def);

        for (const spec of specsOf(def)) {
          if (spec.required !== true) continue;
          const values = await controls.get(spec.name)!.locator('option').evaluateAll(
            (nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ''),
          );
          expect(
            values.length,
            `${name} · ${spec.name}: the seeded workspace must fill this picker — it is sourced `
            + `from \`${spec.source}\`, and an empty one is why the live corpus cannot reach here`,
          ).toBeGreaterThan(0);
          await setValue(controls.get(spec.name)!, spec, values[0]!);
        }

        const switches = specsOf(def).filter((s) => s.boolean === true);
        for (const spec of switches) {
          const control = controls.get(spec.name)!;
          await setValue(control, spec, false);
          const off = await composedLine(page);
          expect(off, `${name} · --${spec.name}: a line composes at last`).not.toBeNull();
          expect(off!, `${name} · --${spec.name} off`).not.toContain(`--${spec.name}`);
          await setValue(control, spec, true);
          const on = await composedLine(page);
          expect(on!, `${name} · --${spec.name} on`).toContain(`--${spec.name}`);
          expect(on!.replace(` --${spec.name}`, ''), `${name} · --${spec.name} adds only itself`)
            .toBe(off!);
          expect(await settled(page), `${name} · --${spec.name}: the CLI accepts the line`)
            .toBe('passed');
          await setValue(control, spec, false);
          branches += 1;
        }
      }
      expect(
        branches,
        'the six switches the live corpus starves, driven on both branches — 17 + 6 = the '
        + "catalogue's 23",
      ).toBe(6);
    } finally {
      await harness?.stop();
      try { rmSync(ws.root, { recursive: true, force: true }); } catch { /* Windows lock */ }
    }
  });
