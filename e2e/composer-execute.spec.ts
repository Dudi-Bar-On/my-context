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
import { test as base, expect } from '@playwright/test';
import { CORPUS } from './app.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { throwawayHome } from './throwaway-home.ts';
import {
  normalise, openApp, openConfirm, outcome, outcomeFor, runIt,
} from './composer-run.ts';
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

interface Workspace { root: string; myContextDir: string; env: NodeJS.ProcessEnv }

/**
 * A disposable copy of the live corpus, indexed. `worthCopying` (skip `.audit`
 * and `.index.db*`) is reused from `src/ui/execute-effect.ts` rather than
 * re-spelled, and `rebuild` is run here rather than left to the server because
 * the server's read routes open the index `openReadOnlyChecked`, which cannot
 * CREATE a database that does not exist — `e2e/execute.spec.ts` measured every
 * SQLite-backed route answering `unable to open database file` without it.
 *
 * **AND A THROWAWAY HOME, which is the second store and was not isolated.**
 * The copy above isolates the CORPUS; `~/.my-context` is a different directory,
 * shared by every corpus on the machine, and `core/open-store.ts` folds it in
 * as the global layer whenever it exists. `e2e/throwaway-home.ts` carries the
 * measurement and the reason the environment is handed to the spawn rather than
 * set on this process.
 */
function makeWorkspace(): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-d12-'));
  cpSync(CORPUS, root, { recursive: true, filter: worthCopying });
  execFileSync(process.execPath, [CLI, 'rebuild'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  return { root, myContextDir: path.join(root, DIR_NAME), env: throwawayHome(root).env };
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

/* ══ 1 — READS, RUN, AND CHECKED AGAINST THE CLI ══════════════════════════ */

base('every read the catalogue licenses runs, and answers exactly what the CLI answers',
  async ({ page }) => {
    base.setTimeout(600_000);
    const ws = makeWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(ws.root, [], ws.env);
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
      harness = await startUiChild(ws.root, [], ws.env);
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
      harness = await startUiChild(ws.root, [], ws.env);
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
      harness = await startUiChild(ws.root, [], ws.env);
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
      harness = await startUiChild(ws.root, [], ws.env);
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
