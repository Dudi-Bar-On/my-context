// @basis TASK-the-composer-is-tested-as-a-user-would-use-it-every-field, TASK-a-test-can-leave-fixtures-in-the-real-home-directory-and
/**
 * **EVERY REMAINING RUNNABLE WRITE, EXECUTED — and the second store isolated.**
 *
 * `plan:builder seq:11` (D12). `composer-execute.spec.ts` established the bar
 * and the pattern and executed a SAMPLE of the writes — `pin` and `add` — each
 * chosen for what it proves. This file runs the rest.
 *
 * ── THE SET, RE-MEASURED RATHER THAN INHERITED ────────────────────────────
 *
 * Measured 2026-09-07 off `src/ui/public/lib/palette-defs.js` itself, not off
 * any number written in the item:
 *
 *     30 catalogue entries — 21 `kind: 'write'`, 9 `kind: 'read'`
 *     27 runnable          — 19 writes, 8 reads
 *      3 NOT runnable      — `init`, `procedure done` (writes), `audit` (read)
 *
 * Of the 19 runnable writes, `composer-execute.spec.ts` executes two: `pin`
 * (test 3) and `add` (test 4). **The four `review` entries are NOT executed
 * there** — its test 5 chooses each one, drives both branches of its six
 * switches and asserts the composed line and the parser's verdict, and never
 * presses Execute. So seventeen remained, and this file executes all seventeen:
 *
 *   test 1  edit · unpin · harden · soften · supersede · refresh · ack   (7)
 *   test 2  focus · repair · rebuild · config                            (4)
 *   test 3  review promote · review discard · review promote-revision ·
 *           review discard-revision · lesson-accept · lesson-discard     (6)
 *
 * ── THE ORACLE IS THE REAL CLI, ON A TWIN OF THE SAME WORKSPACE ───────────
 *
 * The reads in `composer-execute.spec.ts` take the CLI's answer in the SAME
 * workspace, before the run. A write cannot be measured that way: running the
 * oracle first performs the write, and the UI would then be asked to repeat it
 * against a corpus the measurement had already moved.
 *
 * So each test builds TWO workspaces from one source and keeps them in step:
 * the primary, which the browser drives, and the TWIN, which receives the same
 * argv from the real CLI immediately before each run. The twin is copied from
 * the primary AFTER seeding, so every generated id — the drafts' ids, the
 * revisions' `REV-…`, the staged candidates' keys — is the same string on both
 * sides and the two argvs are genuinely identical.
 *
 * A per-command scratch corpus was tried first and is the WRONG oracle here,
 * measured: `core/persist.ts` resolves `source_file` against
 * `path.dirname(root)` and says so — *"under `MYCONTEXT_CORPUS_DIR` the two
 * diverge, the file is not found, and the outcome is `unconfirmed`"* — so
 * `refresh` on a scratch corpus appends a provenance note that a same-root run
 * never prints. The twin has one root, like the primary, and the two agree.
 *
 * ── THE SECOND STORE, WHICH WAS NOT ISOLATED ─────────────────────────────
 *
 * The corpus is isolated by the copy. `~/.my-context` is a DIFFERENT directory,
 * shared by every corpus on the machine, and it was reached by every one of
 * these runs. `e2e/throwaway-home.ts` carries the measurement; test 4 below
 * proves the override works by putting a decoy global layer in the throwaway
 * home and requiring a UI-executed `list` to answer with it, and every test
 * here fingerprints the REAL `~/.my-context` before and after and requires it
 * byte-unchanged.
 *
 * ── THE COPY IS LEANER THAN ITS PRECEDENT, DELIBERATELY ───────────────────
 *
 * `composer-execute.spec.ts` copies the whole of `CORPUS` through
 * `worthCopying`, which on this repository is 279 MB and 30 SECONDS PER
 * WORKSPACE — `node_modules` alone is 187 MB of it. This file needs eight
 * workspaces, and none of them is a runnable checkout: the CLI and the UI
 * server are both started from the REAL repository by absolute path
 * (`composer.ts`' `CLI`, `test/ui/helpers.ts`' `SERVER`), and a workspace here
 * is only two things — the corpus to read and write, and the root that
 * repository-relative paths resolve against. Measured: 2.3 s instead of 30 s.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { CORPUS } from './app.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { REAL_GLOBAL_ROOT, fingerprint, fingerprintDiff, throwawayHome } from './throwaway-home.ts';
import {
  normalise, openApp, outcome, pressExecute, runIt, settleScreen,
} from './composer-run.ts';
import { snapshot, worthCopying } from '../src/ui/execute-effect.ts';
import { addSettlingContradictions } from './seeds.ts';
import { DIR_NAME, resolveWorkspace } from '../src/core/workspace.ts';
import { CATEGORIES } from '../src/core/categories.ts';
import { openRebuiltStore } from '../src/core/open-store.ts';
import { stageRevision } from '../src/core/revision.ts';
import { stageRuleCandidates } from '../src/lesson/derive.ts';
import { runChecks } from '../src/doctor/checks.ts';
import {
  CLI, chooseEntry, composedLine, controlsOf, currentValues, meantArgv,
  openComposer, setValue, settled, specsOf,
} from './composer.ts';

/**
 * What is copied into a workspace: `worthCopying`'s two exclusions, plus the
 * four directories a corpus does not need and a copy pays 27 seconds for.
 *
 * `.demo-corpus` is excluded because a second `.my_context` inside the tree is
 * a second corpus a walk could find; the other three are bulk.
 */
const NOT_WORTH_COPYING = new Set(['node_modules', '.git', 'test-results', '.demo-corpus']);
const leanCopy = (source: string): boolean =>
  worthCopying(source) && !NOT_WORTH_COPYING.has(path.basename(source));

interface Pair {
  /** The workspace the browser drives. */
  root: string;
  myContextDir: string;
  /** The identical workspace the CLI oracle is run in. */
  twin: string;
  /** The environment every child gets: a throwaway `HOME`/`USERPROFILE`. */
  env: NodeJS.ProcessEnv;
  home: string;
  dispose: () => void;
}

/** One workspace, copied from the live corpus and indexed. */
function makeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-d12w-'));
  cpSync(CORPUS, root, { recursive: true, dereference: true, filter: leanCopy });
  return root;
}

/**
 * The primary, its seeding, and then the twin — in that order, because the twin
 * must carry the seeds' generated ids rather than seeds of its own.
 */
function makePair(seed: (root: string) => void = () => {}): Pair {
  const root = makeRoot();
  const homeBox = mkdtempSync(path.join(tmpdir(), 'myctx-d12h-'));
  const { home, env } = throwawayHome(homeBox);
  execFileSync(process.execPath, [CLI, 'rebuild'], { cwd: root, encoding: 'utf8', stdio: 'pipe', env });
  seed(root);
  execFileSync(process.execPath, [CLI, 'rebuild'], { cwd: root, encoding: 'utf8', stdio: 'pipe', env });
  const twin = mkdtempSync(path.join(tmpdir(), 'myctx-d12t-'));
  cpSync(root, twin, { recursive: true, dereference: true, filter: () => true });
  return {
    root,
    myContextDir: path.join(root, DIR_NAME),
    twin,
    env,
    home,
    dispose: () => {
      for (const dir of [root, twin, homeBox]) {
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows lock */ }
      }
    },
  };
}

/** The CLI's own answer to an argv, run in the TWIN. THE ORACLE. */
function cli(pair: Pair, argv: readonly string[]): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [CLI, ...argv], {
      cwd: pair.twin, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: pair.env,
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    return { code: e.status ?? -1, out: e.stdout ?? '' };
  }
}

/**
 * The two workspaces' own paths, replaced by one placeholder, so an output that
 * NAMES where it wrote — `config`'s backup, `review discard-revision`'s log —
 * is compared on what it says rather than on which of the two twins said it.
 */
function unroot(text: string, pair: Pair): string {
  let out = normalise(text);
  for (const root of [pair.root, pair.twin]) {
    for (const spelling of [root, root.replaceAll('\\', '/'), root.replaceAll('/', '\\')]) {
      out = out.split(spelling).join('<ROOT>');
    }
  }
  return out;
}

/**
 * What `state/focus.json` holds, or `null` when there is no focus at all —
 * which is one of the two shapes `focus --clear` may leave behind and is why
 * this is a function rather than a `readFileSync`.
 */
function readFocusFile(file: string): { tags?: string[]; scope?: string[] } | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as { tags?: string[]; scope?: string[] };
}

/** Every item file in a corpus, as `[id, text]`. */
function itemsOf(dir: string): [string, string][] {
  const out: [string, string][] = [];
  for (const [, text] of snapshot(dir)) {
    const id = /^id:\s*(\S+)/m.exec(text)?.[1];
    if (id !== undefined) out.push([id, text]);
  }
  return out;
}

/** The text of one item, read off disk. The evidence a write actually landed. */
function itemText(dir: string, id: string): string {
  const hit = itemsOf(dir).find(([itemId]) => itemId === id);
  expect(hit, `the corpus must still hold ${id}`).not.toBeUndefined();
  return hit![1];
}

/** The categories `pin`, `harden` and `unpin` actually govern — the normative tier. */
const NORMATIVE = new Set(
  Object.values(CATEGORIES).filter((c) => c.tier === 'normative').map((c) => c.name),
);

/**
 * An item this workspace holds that matches, and that no earlier case has
 * claimed. Every fixture in this file is CHOSEN FROM THE CORPUS rather than
 * named, which is the lesson `firstUnpinnedItemId` paid for in the sibling
 * spec: a hard-coded id is a corpus-content assumption that reads as a product
 * failure the day the corpus moves.
 */
function claim(
  dir: string, taken: Set<string>, what: string, matches: (text: string) => boolean,
): string {
  for (const [id, text] of itemsOf(dir)) {
    if (taken.has(id)) continue;
    const type = /^type:\s*(\S+)/m.exec(text)?.[1] ?? '';
    if (!NORMATIVE.has(type)) continue;
    if (!matches(text)) continue;
    taken.add(id);
    return id;
  }
  throw new Error(`e2e: this corpus holds no unclaimed normative item that is ${what}`);
}

/* ══ DRIVING ONE ENTRY ════════════════════════════════════════════════════ */

interface Case {
  /** The catalogue entry, by the name the picker shows. */
  entry: string;
  /** Field name to value, filled the way a person fills it. */
  values: Record<string, string | boolean>;
  /** What this case is called in a failure. */
  what: string;
  /**
   * `full` — the whole of stdout must be the CLI's. `first` — the exit code and
   * the command's own first line, for an answer that names a file it just wrote
   * under a timestamp neither run can share.
   */
  how?: 'full' | 'first';
  /**
   * The confirm must be REFUSED rather than opened, and the refusal must carry
   * this fragment. `src/ui/execute-effect.ts` refuses the confirm when the dry
   * run exits non-zero, so a command the CLI will not perform can never reach
   * `Run it` — and for `config --delete` on a shipped category that refusal IS
   * the correct result.
   */
  refusedWith?: RegExp;
}

/**
 * Choose the entry, fill every field, press Execute, answer the confirm, and
 * compare what came back to what the CLI answered on the twin.
 *
 * Returns the composed line, so a caller can say what it ran in a report.
 */
async function drive(page: Page, pair: Pair, c: Case): Promise<string> {
  const def = await chooseEntry(page, c.entry);
  const controls = await controlsOf(page, def);
  for (const [field, value] of Object.entries(c.values)) {
    const spec = specsOf(def).find((s) => s.name === field);
    expect(spec, `${c.what}: the catalogue entry "${c.entry}" has a field "${field}"`)
      .not.toBeUndefined();
    await setValue(controls.get(field)!, spec!, value);
  }
  expect(await settled(page), `${c.what}: the CLI's parser accepts the composed line`)
    .toBe('passed');

  const line = await composedLine(page);
  expect(line, `${c.what}: a line composes`).not.toBeNull();
  // **Read off the controls, never reconstructed.** The screen seeds and
  // normalises — the glob tester opens on `**` and that value flows into
  // `--scope` — so a values bag a test believes it typed is not the form.
  const argv = meantArgv(def, await currentValues(def, controls));

  if (c.refusedWith !== undefined) {
    const truth = cli(pair, argv);
    expect(truth.code, `${c.what}: the CLI itself must refuse this — otherwise the UI's refusal `
      + 'is the UI being wrong rather than the UI agreeing').not.toBe(0);
    const pressed = await pressExecute(page, c.what);
    expect(pressed.state, `${c.what}: SECURITY — the confirm must not open for a command whose `
      + 'dry run failed; there is no effect to show and nothing to approve').toBe('refused');
    expect(pressed.said, `${c.what}: and the refusal names the reason in the product's words`)
      .toMatch(c.refusedWith);
    return line!;
  }

  // **THE ORACLE, TAKEN ON THE TWIN, IMMEDIATELY BEFORE THE RUN** — so the two
  // workspaces are in the same state when each receives the command.
  const truth = cli(pair, argv);

  await runIt(page, line!, c.what);
  // The write triggers a live refresh that re-renders the whole screen and
  // re-homes the outcome node; reading before that has landed reads a node
  // mid-move. `settleScreen` carries the measurement.
  await settleScreen(page);
  const got = await outcome(page, line!);

  expect(got.ran, `${c.what}: the outcome names the line that was composed`).toBe(line);
  expect(got.code, `${c.what}: the UI's exit code IS the CLI's exit code`).toBe(truth.code);
  if ((c.how ?? 'full') === 'full') {
    expect(unroot(got.out, pair), `${c.what}: the UI's output IS the CLI's output`)
      .toBe(unroot(truth.out, pair));
  } else {
    expect(normalise(truth.out).length, `${c.what}: the CLI printed something to compare`)
      .toBeGreaterThan(0);
    expect(unroot(got.out, pair).split('\n')[0], `${c.what}: the UI's first line is the CLI's`)
      .toBe(unroot(truth.out, pair).split('\n')[0]);
  }
  return line!;
}

/**
 * **The two files in the real global root that a LIVE SERVER owns, excluded by
 * name — and the reason is a measurement, not a convenience.**
 *
 * This assertion went red on its third run with `MODIFIED ui-server.json` and
 * `MODIFIED ui-sessions.json`. The record explains itself: `pid` had gone from
 * 68256 to 440 and `startedAt` from 16:17 to 18:42, on port 58888 — the
 * OWNER'S OWN server restarting on his own machine while the suite ran. Nothing
 * this test spawned can write either file: `test/helpers/pin-sessions-dir.ts`
 * points `MYCONTEXT_UI_SESSIONS_DIR` at a per-process temp directory, and both
 * `core/ui-sessions.ts` and `core/ui-server-record.ts` consult that variable
 * BEFORE `GLOBAL_DIR`. That pin is asserted below rather than assumed, so
 * excluding these two names costs no coverage: the mechanism that keeps them
 * safe is checked directly, and the record is additionally read back to prove
 * it does not name one of THIS test's workspaces.
 *
 * Everything else in that directory — `statusline-replaced.json`, and the
 * `items/` tree a maintainer's global layer would put there — is compared byte
 * for byte, which is the half `HOME` actually protects.
 */
const LIVE_SERVER_OWNS = new Set(['ui-server.json', 'ui-sessions.json']);

/**
 * The real `~/.my-context`, before and after — the negative half of the
 * isolation claim, made on the bytes rather than on the mtimes.
 */
async function withCleanGlobalRoot<T>(run: () => Promise<T>, roots: string[] = []): Promise<T> {
  expect(
    (process.env['MYCONTEXT_UI_SESSIONS_DIR'] ?? '').length,
    'the session store must be pinned before any server starts — it is what keeps '
    + '`ui-server.json` and the session digests out of the real global root, and '
    + '`test/ui/helpers.ts` sets it by importing `test/helpers/pin-sessions-dir.ts`',
  ).toBeGreaterThan(0);
  expect(
    path.resolve(process.env['MYCONTEXT_UI_SESSIONS_DIR'] ?? ''),
    'and it must be pinned somewhere that is NOT the real global root',
  ).not.toBe(path.resolve(REAL_GLOBAL_ROOT));

  const before = fingerprint(REAL_GLOBAL_ROOT);
  try {
    return await run();
  } finally {
    const diff = fingerprintDiff(before, fingerprint(REAL_GLOBAL_ROOT))
      .filter((line) => !LIVE_SERVER_OWNS.has(line.split(' ').slice(1).join(' ')));
    expect(
      diff,
      `the real global root (${REAL_GLOBAL_ROOT}) must be byte-unchanged: it is shared by every `
      + 'corpus on this machine and by the owner\'s own live server, and nothing this run spawned '
      + 'may reach it. Every child is given a throwaway HOME/USERPROFILE — see e2e/throwaway-home.ts',
    ).toEqual([]);

    // And the live record still names the owner's workspace, never one of ours
    // — the check that makes excluding it above honest rather than blind.
    const record = path.join(REAL_GLOBAL_ROOT, 'ui-server.json');
    if (existsSync(record)) {
      const named = (JSON.parse(readFileSync(record, 'utf8')) as { workspace?: string })
        .workspace ?? '';
      for (const root of roots) {
        expect(
          path.resolve(named),
          `SECURITY — the real ui-server.json must not name this test's workspace (${root}); if `
          + 'it does, a server this test started claimed the machine-wide record',
        ).not.toBe(path.resolve(root));
      }
    }
  }
}

/* ══ 1 — THE SEVEN WRITES THAT NAME AN ITEM ══════════════════════════════ */

/**
 * `refresh` needs a snapshot to re-take, and this corpus has none it can use:
 * measured 2026-09-07, 951 of 1,006 items record `source_file: null`, 54 record
 * an ABSOLUTE path from another machine's temp directory (which `refresh`
 * correctly refuses as outside the repository), and the one repository-relative
 * survivor records no `source_checksum`, which `refresh` also correctly
 * refuses. So the fixture is captured the way a person captures one — a real
 * file, `mycontext add --file`, then the file MOVES — rather than by writing a
 * corpus row, which is `scripts/demo-corpus.ts`' standing rule.
 */
const REFRESH_SOURCE = 'e2e-fixture/d12-refresh.md';

function seedSnapshot(root: string): void {
  const file = path.join(root, ...REFRESH_SOURCE.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, 'The first captured line.\nThe second captured line.\n', 'utf8');
  execFileSync(process.execPath, [
    CLI, 'add', 'reference', 'A D12 snapshot for refresh to re-take',
    '--file', REFRESH_SOURCE,
    '--summary', 'A fixture snapshot, so `refresh` has something it can actually refresh.',
    '--yes',
  ], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  // The file moves AFTER the capture, which is the only state in which
  // `refresh` does anything: it re-reads a source that has drifted.
  writeFileSync(
    file,
    'The first captured line.\nThe second captured line.\nA third line, written after the capture.\n',
    'utf8',
  );
}

base('every write that names an item runs, and the corpus says what each one did',
  async ({ page }) => {
    base.setTimeout(900_000);
    const roots: string[] = [];
    await withCleanGlobalRoot(async () => {
      const pair = makePair(seedSnapshot);
      roots.push(pair.root, pair.twin);
      let harness: UiHarness | undefined;
      try {
        harness = await startUiChild(pair.root, [], pair.env);
        await openApp(page, harness);
        await openComposer(page);

        const dir = pair.myContextDir;
        const taken = new Set<string>();
        const editTarget = claim(dir, taken, 'ordinary and normative',
          (t) => /^status:\s*active/m.test(t));
        const pinned = claim(dir, taken, 'pinned', (t) => /^always:\s*true/m.test(t));
        const soft = claim(dir, taken, 'soft', (t) => /^severity:\s*soft/m.test(t));
        const hard = claim(dir, taken, 'hard', (t) => /^severity:\s*hard/m.test(t));
        const retiree = claim(dir, taken, 'active and supersedable',
          (t) => /^status:\s*active/m.test(t));
        const replacement = claim(dir, taken, 'active and a replacement',
          (t) => /^status:\s*active/m.test(t));
        const snapshotId = itemsOf(dir)
          .find(([, t]) => t.includes(`source_file: ${REFRESH_SOURCE}`))?.[0];
        expect(snapshotId, 'the seeded snapshot must be in the corpus').not.toBeUndefined();
        const [ackItem, ackCode] = firstFinding(pair);

        /**
         * **A title carrying a space AND a quote, executed.** The item names the
         * values that have bitten this product before, and the two that a
         * composed line has to survive all the way to `execFile` are a space and
         * a `"`. `composer-matrix.spec.ts` proves the LINE quotes them; this
         * proves the write stores them, because §3.1 sends an id and values and
         * the server rebuilds the argv — two derivations that could disagree
         * about exactly this.
         */
        const editedTitle = 'A D12 fixture title, with a space and a "quoted" word';

        const cases: Case[] = [
          {
            entry: 'edit', what: `edit ${editTarget}`,
            values: { id: editTarget, title: editedTitle, severity: 'hard', yes: true },
          },
          { entry: 'unpin', what: `unpin ${pinned}`, values: { id: pinned, yes: true } },
          { entry: 'harden', what: `harden ${soft}`, values: { id: soft, yes: true } },
          { entry: 'soften', what: `soften ${hard}`, values: { id: hard, yes: true } },
          {
            entry: 'supersede', what: `supersede ${retiree}`,
            values: {
              id: retiree, by: replacement,
              reason: 'A D12 fixture supersedes it, to prove the write lands.', yes: true,
            },
          },
          {
            entry: 'refresh', what: `refresh ${snapshotId!}`,
            values: { id: snapshotId!, yes: true },
          },
          { entry: 'ack', what: `ack ${ackItem}`, values: { id: ackItem, finding: ackCode } },
          {
            entry: 'ack', what: `ack ${ackItem} --clear`,
            values: { id: ackItem, finding: ackCode, clear: true },
          },
        ];

        for (const c of cases) await drive(page, pair, c);

        /* ── AND THE CORRECT RESULT IS ON DISK ───────────────────────────── */
        expect(itemText(dir, editTarget), 'edit wrote the title, quote and all')
          .toContain(editedTitle);
        expect(itemText(dir, editTarget), 'and the severity beside it')
          .toMatch(/^severity:\s*hard/m);
        expect(itemText(dir, pinned), 'unpin cleared the pin').toMatch(/^always:\s*false/m);
        expect(itemText(dir, soft), 'harden raised the severity').toMatch(/^severity:\s*hard/m);
        expect(itemText(dir, hard), 'soften lowered it').toMatch(/^severity:\s*soft/m);
        expect(itemText(dir, retiree), 'supersede retired the item')
          .toMatch(/^status:\s*superseded/m);
        expect(itemText(dir, retiree), 'and named what replaced it').toContain(replacement);
        expect(
          itemText(dir, snapshotId!),
          'refresh re-read the file, so the body carries the line written after the capture',
        ).toContain('A third line, written after the capture.');
        expect(
          itemText(dir, ackItem),
          `ack --clear withdrew the acknowledgement of "${ackCode}", so nothing on the item `
          + 'claims it any more',
        ).not.toContain(ackCode);
      } finally {
        await harness?.stop();
        pair.dispose();
      }
    }, roots);
  });

/**
 * An `(item, code)` pair this workspace's own `doctor` reports — derived with
 * `runChecks`, which is the function `/api/doctor` calls, rather than by
 * parsing the CLI's prose.
 *
 * `about` findings are skipped for the reason `findingOptions`
 * (`screens/palette.js`) skips them: they are not about one item, and `ack`
 * takes an item.
 */
function firstFinding(pair: Pair): [string, string] {
  const ws = resolveWorkspace(pair.root);
  const { store } = openRebuiltStore(ws);
  try {
    const findings = runChecks({
      root: ws.projectRoot!,
      repoRoot: path.dirname(ws.projectRoot!),
      dbPath: ws.dbPath,
      items: store.all(),
      config: ws.config,
    }) as { item?: string; code?: string; about?: string }[];
    for (const finding of findings) {
      if (typeof finding.about === 'string') continue;
      if (typeof finding.item !== 'string' || finding.item === '') continue;
      if (typeof finding.code !== 'string' || finding.code === '') continue;
      // Never one already acknowledged: `ack` answers "Nothing was written" for
      // those, which is correct and is not the path this case is here to run.
      if (itemText(pair.myContextDir, finding.item).includes(finding.code)) continue;
      return [finding.item, finding.code];
    }
  } finally {
    store.close();
  }
  throw new Error('e2e: this corpus reports no unacknowledged per-item doctor finding to `ack`');
}

/* ══ 2 — THE FOUR WRITES THAT NAME NO ITEM ═══════════════════════════════ */

base('every write that names no item runs, and the workspace says what each one did',
  async ({ page }) => {
    base.setTimeout(900_000);
    const roots: string[] = [];
    await withCleanGlobalRoot(async () => {
      const pair = makePair();
      roots.push(pair.root, pair.twin);
      let harness: UiHarness | undefined;
      try {
        harness = await startUiChild(pair.root, [], pair.env);
        await openApp(page, harness);
        await openComposer(page);

        const focusPath = path.join(pair.myContextDir, 'state', 'focus.json');
        const configPath = path.join(pair.myContextDir, 'config.json');
        const indexPath = path.join(pair.myContextDir, '.index.db');

        // The categories the screen itself offers, read off the control rather
        // than named — `config`'s picker is `source: 'categories'`.
        const configDef = await chooseEntry(page, 'config');
        const categories = await (await controlsOf(page, configDef)).get('category')!
          .locator('option')
          .evaluateAll((nodes) => nodes
            .map((n) => (n as HTMLOptionElement).value).filter((v) => v !== ''));
        expect(categories.length, 'the config picker offers this corpus\'s categories')
          .toBeGreaterThan(0);
        const disabling = categories.includes('note') ? 'note' : categories[0]!;

        const before = readFileSync(indexPath);

        const cases: Case[] = [
          {
            entry: 'focus', what: 'focus --tag --category --scope',
            // Every filter `focus` offers at once, which is the interacting
            // pair the item asks for rather than the cross product: a focus
            // narrowed three ways is the one whose count can disagree.
            values: { tag: 'v2', category: categories[0]!, scope: 'e2e/**', yes: true },
          },
          {
            // **The glob box is put BACK to the universal pattern here, and
            // that is an assertion rather than tidying up.** `--clear` takes no
            // axes — the CLI refuses a line that clears and sets at once — so
            // this case can only reach `Run it` if a glob of `**` composes NO
            // `--scope`. Before `valueOf` was fixed (2026-09-07) it did compose
            // one, from the tester's own seed, and `focus --clear` could not be
            // run from this screen at all.
            entry: 'focus', what: 'focus --clear',
            values: { scope: '**', clear: true, yes: true },
          },
          { entry: 'repair', what: 'repair', values: { yes: true } },
          { entry: 'rebuild', what: 'rebuild', values: {} },
          {
            /**
             * **`--delete` on a shipped category, and the refusal IS the
             * result.** The catalogue offers `--delete` because `mycontext
             * config` accepts it, and this corpus declares no custom category —
             * measured: `config.json`'s `categories` holds one entry, a `tier`
             * override on `reference`, and a shipped category "can never be
             * deleted". So the branch is exercised where it can be: the CLI
             * refuses, the dry run exits non-zero, and the confirm is refused
             * with the product's own sentence instead of a button appearing.
             */
            entry: 'config', what: `config ${disabling} --delete`,
            values: { category: disabling, delete: true, yes: true },
            refusedWith: /can never be deleted|ships with my_context/,
          },
          {
            entry: 'config', what: `config ${disabling} --disable`,
            values: { category: disabling, disable: true, yes: true },
            // The success line names the backup it wrote, and the backup's name
            // carries the instant it was written — two runs a second apart
            // cannot share it.
            how: 'first',
          },
        ];

        // **The focus is read off disk BETWEEN the two runs**, because "no
        // focus" after `--clear` is a vacuous assertion unless there was one to
        // clear. `focusPath(root)` is `<root>/state/focus.json` — the file the
        // corpus copy carries and the reason `focus` needed no second store.
        await drive(page, pair, cases[0]!);
        const set = readFocusFile(focusPath);
        expect(set?.tags ?? [], 'focus --tag wrote the tag into state/focus.json')
          .toEqual(['v2']);
        expect(set?.scope ?? [], 'and the scope beside it').toEqual(['e2e/**']);

        for (const c of cases.slice(1)) await drive(page, pair, c);

        /* ── AND THE CORRECT RESULT IS ON DISK ───────────────────────────── */
        const cleared = readFocusFile(focusPath);
        expect(
          cleared === null || (cleared.tags ?? []).length === 0,
          'focus --clear left no focus behind — the file is gone, or holds no axis',
        ).toBe(true);
        expect(readFileSync(indexPath).equals(before), 'rebuild rewrote the index')
          .toBe(false);
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as
          { categories?: Record<string, { enabled?: boolean }> };
        expect(
          config.categories?.[disabling]?.enabled,
          `config --disable recorded "${disabling}" as \`enabled: false\` in config.json — the `
          + 'shape the writer uses, and not a `disabled` key: the first draft of this assertion '
          + 'asked for the wrong one and read the product\'s silence as the write not landing',
        ).toBe(false);
        expect(
          readdirSync(pair.myContextDir).filter((n) => n.startsWith('config.json.bak-')),
          'and the backup its own message named was written beside it',
        ).not.toEqual([]);
      } finally {
        await harness?.stop();
        pair.dispose();
      }
    }, roots);
  });

/* ══ 3 — THE SIX WRITES THAT NEED A QUEUE ════════════════════════════════ */

/** The ids the seeding generates, read back by the test that drives them. */
interface Seeded {
  drafts: string[];
  revisions: { item: string; revision: string }[];
  lesson: string;
  keys: string[];
}

let seeded: Seeded | null = null;

/**
 * **SEEDED WITH THE REAL MUTATION SURFACE, never by writing a row.**
 *
 * `composer-execute.spec.ts`' `seedQueues` established this and the reason —
 * *"a fixture which fakes data teaches the gate to accept a lie"*. This adds
 * the third queue that file did not need: `lesson-accept` and `lesson-discard`
 * take a candidate whose `state` is `pending`, and measured on this corpus
 * 2026-09-07 all eleven staged candidates across all five staging files are
 * `accepted`, so the picker is correctly empty and neither command can be
 * reached. `stageRuleCandidates` is the function the `stage_rule_candidates`
 * MCP tool calls, which is how a lane actually stages one.
 */
function seedQueues(root: string): void {
  const dir = path.join(root, DIR_NAME);
  const drafts: string[] = [];
  for (const [category, title] of [
    ['rule', 'A D12 fixture draft the review queue can promote'],
    ['constraint', 'A D12 fixture draft the review queue can discard'],
  ] as [string, string][]) {
    // **`addSettlingContradictions`, not a bare `add`, since 2026-09-11** —
    // the contradiction gate (`9c9cd31b`, 2026-09-08) refuses this seeding
    // outright and the test died on `Command failed:` before a browser opened.
    // The settlement a person makes is `--distinct <id>` for every item the
    // refusal named; wording the fixture around the gate would be dodging it.
    const id = addSettlingContradictions(root, process.env, [
      'add', category, title,
      '--body', 'Created by e2e/composer-write-execute.spec.ts so `review promote` and `review '
        + 'discard` have something to name. Discarded with the workspace.',
      '--summary', 'A fixture draft for the D12 write sweep.',
      '--yes',
    ]);
    execFileSync(process.execPath, [CLI, 'edit', id, '--status', 'draft', '--yes'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    drafts.push(id);
  }

  const ws = resolveWorkspace(root);
  const { store } = openRebuiltStore(ws);
  const revisions: { item: string; revision: string }[] = [];
  let lesson = '';
  const keys: string[] = [];
  try {
    // TWO revisions on TWO items, because `promote-revision` settles the one it
    // names: a single revision cannot be both promoted and discarded.
    const targets = store.all()
      .filter((it) => it.origin === 'human' && it.status === 'active' && !drafts.includes(it.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 2);
    expect(targets.length, 'two human items to propose against').toBe(2);
    for (const target of targets) {
      const staged = stageRevision(
        { root: ws.projectRoot!, store, config: ws.config },
        target.id,
        { title: `${target.title}, as a D12 fixture proposes it` },
        'agent',
      ) as { revision: { revisionId: string } };
      revisions.push({ item: target.id, revision: staged.revision.revisionId });
    }

    const target = store.all().find((it) => it.type === 'lesson');
    expect(target, 'a lesson to stage rule candidates against').not.toBeUndefined();
    lesson = target!.id;
    // **`lesson-accept` CANNOT BE RUN ON THIS CORPUS, AND THAT IS A PRODUCT
    // FINDING RATHER THAN A FIXTURE PROBLEM — measured 2026-09-11.**
    //
    // `lesson-accept` CREATES a rule, so it meets the contradiction gate that
    // landed on 2026-09-08. The gate is LEXICAL and this corpus holds 1,086
    // items, so it finds a neighbour for anything: measured directly, three
    // completely different candidate texts were each refused against a
    // different item — `DEC-the-admission-staircase-is-built-and-its-sweep-
    // runs-once-on`, then `REQ-session-focus-controls-what-loads`, then
    // `STD-a-summary-is-one-plain-sentence-for-someone-who-does-not`. One of
    // those three was about GARDENING. There is no wording that does not
    // collide, so no fixture text can dodge it.
    //
    // The refusal itself names the settlement — `--distinct <id>` — and that
    // is what every other seeding in this suite does. It is not available
    // here, twice over: `command-flags.ts` allows `lesson-accept` only
    // `--title`, `--scope`, `--severity` and `--directive`, and the command is
    // pressed through the BROWSER, whose composed argv comes from the
    // catalogue and whose screen has no control for settling a contradiction.
    //
    // So the `lesson-accept` entry below is RED on this corpus and is reported
    // as a finding rather than worked around. The five other writes this test
    // drives pass. What changed on 2026-09-11 is that the seeding above now
    // settles its own contradictions and this test reaches the browser at all
    // — before that it died on `Command failed:` in `seedQueues`.
    const out = stageRuleCandidates(ws.projectRoot!, target!, [
      {
        title: 'A D12 fixture candidate the reader accepts',
        directive: 'do',
        body: 'Created by e2e/composer-write-execute.spec.ts so `lesson-accept` has a pending '
          + 'candidate to accept. Discarded with the workspace.',
        scope: ['e2e/**'],
        severity: 'soft',
      },
      {
        title: 'A D12 fixture candidate the reader discards',
        directive: 'dont',
        body: 'Created by e2e/composer-write-execute.spec.ts so `lesson-discard` has a second '
          + 'candidate to discard, one candidate not being two. Discarded with the workspace.',
        scope: ['e2e/**'],
        severity: 'soft',
      },
    ]);
    expect(out.issues, 'the staged candidates are valid').toEqual([]);
    for (const candidate of out.staging.candidates) {
      if (candidate.state === 'pending') keys.push(candidate.key);
    }
    expect(keys.length, 'two pending candidates').toBe(2);
  } finally {
    store.close();
  }
  seeded = { drafts, revisions, lesson, keys };
}

base('the six writes that need a queue run, on a workspace seeded through the real commands',
  async ({ page }) => {
    base.setTimeout(900_000);
    const roots: string[] = [];
    await withCleanGlobalRoot(async () => {
      const pair = makePair(seedQueues);
      roots.push(pair.root, pair.twin);
      const fixture = seeded!;
      let harness: UiHarness | undefined;
      try {
        harness = await startUiChild(pair.root, [], pair.env);
        await openApp(page, harness);
        await openComposer(page);

        /**
         * **`--scope` is typed here rather than left at the screen's seed, and
         * that is a finding rather than a convenience.** The glob tester opens
         * on `EVERY_FILE` — `**` — and `screens/palette.js` says out loud that
         * the seeded pattern flows into the composed argv. For `add`, `edit`,
         * `focus` and `review promote` the CLI takes it. For `lesson-accept` it
         * does NOT: `validateRuleCandidates` refuses a bare `**` by name
         * (*"matches the whole repository, which is what omitting scope already
         * does"*), so the line the Composer composes from its own opening state
         * exits 1 and its confirm is refused. Measured 2026-09-07; reported.
         *
         * A real glob is what a reader who wanted a scope would type, so that
         * is what this drives.
         */
        const scope = 'e2e/**';

        const cases: Case[] = [
          {
            entry: 'review promote', what: `review promote ${fixture.drafts[0]}`,
            values: {
              id: fixture.drafts[0]!, scope, severity: 'soft', always: false, yes: true,
            },
          },
          {
            entry: 'review discard', what: `review discard ${fixture.drafts[1]}`,
            values: { id: fixture.drafts[1]!, yes: true },
          },
          {
            entry: 'review promote-revision',
            what: `review promote-revision ${fixture.revisions[0]!.item}`,
            values: {
              id: fixture.revisions[0]!.item,
              revision: fixture.revisions[0]!.revision,
              force: false, yes: true,
            },
          },
          {
            entry: 'review discard-revision',
            what: `review discard-revision ${fixture.revisions[1]!.item}`,
            values: {
              id: fixture.revisions[1]!.item,
              revision: fixture.revisions[1]!.revision,
              reason: 'A D12 fixture rejects it, to prove the discard lands.',
              yes: true,
            },
          },
          {
            entry: 'lesson-accept', what: `lesson-accept ${fixture.keys[0]}`,
            values: {
              id: fixture.lesson, key: fixture.keys[0]!,
              title: 'A D12 accepted candidate, renamed on the way in',
              scope, severity: 'soft', directive: 'do',
            },
          },
          {
            entry: 'lesson-discard', what: `lesson-discard ${fixture.keys[1]}`,
            values: { id: fixture.lesson, key: fixture.keys[1]! },
          },
        ];

        for (const c of cases) await drive(page, pair, c);

        /* ── AND THE CORRECT RESULT IS ON DISK ───────────────────────────── */
        const dir = pair.myContextDir;
        expect(itemText(dir, fixture.drafts[0]!), 'the promoted draft is active now')
          .toMatch(/^status:\s*active/m);
        expect(itemText(dir, fixture.drafts[1]!), 'the discarded draft is deprecated, not deleted')
          .toMatch(/^status:\s*deprecated/m);
        expect(
          itemText(dir, fixture.revisions[0]!.item),
          'the promoted revision replaced the title it proposed against',
        ).toContain('as a D12 fixture proposes it');
        expect(
          itemText(dir, fixture.revisions[1]!.item),
          'and the discarded one left its item exactly as it was',
        ).not.toContain('as a D12 fixture proposes it');
        expect(
          itemsOf(dir).some(([, t]) => t.includes('A D12 accepted candidate, renamed on the way in')),
          'lesson-accept created the rule the candidate proposed, under the title typed here',
        ).toBe(true);
        const staging = readFileSync(
          path.join(dir, '.staging', `${fixture.lesson}.json`), 'utf8',
        );
        const states = (JSON.parse(staging) as { candidates: { key: string; state: string }[] })
          .candidates;
        expect(
          states.find((c) => c.key === fixture.keys[0])?.state,
          'the accepted candidate is recorded as accepted',
        ).toBe('accepted');
        expect(
          states.find((c) => c.key === fixture.keys[1])?.state,
          'and the discarded one as discarded',
        ).toBe('discarded');
      } finally {
        await harness?.stop();
        pair.dispose();
      }
    }, roots);
  });

/* ══ 4 — THE THROWAWAY HOME, PROVED RATHER THAN ASSUMED ══════════════════ */

/**
 * **The positive half of the isolation claim.**
 *
 * The other three tests assert the real `~/.my-context` is byte-unchanged, and
 * that assertion passes today whether or not the override works — because this
 * machine's global root happens to hold no `items/`, so there is nothing for
 * the store to fold in and nothing the run would write.
 *
 * Measured 2026-09-07, which is what makes the gap real rather than
 * theoretical: with a global layer present, `mycontext list rule` in an
 * unrelated project workspace ANSWERS WITH IT — `core/open-store.ts` opens the
 * store with `global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined`.
 * So a maintainer who keeps one would have their own items in every count these
 * specs compare against the CLI.
 *
 * This test puts a decoy layer in the THROWAWAY home, built by the documented
 * route (`mycontext init` somewhere else, `mycontext add`, then move the
 * directory into place — README, "The global layer — Creating one, today"), and
 * requires a UI-EXECUTED `list` to answer with it. It can only pass if the
 * server the browser is talking to resolved `homedir()` to the throwaway.
 */
const DECOY_TITLE = 'A D12 decoy in the throwaway global layer';

base('the server resolves HOME to the throwaway, proved by a decoy global layer',
  async ({ page }) => {
    base.setTimeout(600_000);
    const roots: string[] = [];
    await withCleanGlobalRoot(async () => {
      const pair = makePair();
      roots.push(pair.root, pair.twin);
      let harness: UiHarness | undefined;
      try {
        // Built with the real commands, in a scratch workspace, then MOVED —
        // which is the only route the product documents to a global layer.
        const scratch = mkdtempSync(path.join(tmpdir(), 'myctx-d12g-'));
        execFileSync(process.execPath, [CLI, 'init'],
          { cwd: scratch, encoding: 'utf8', stdio: 'pipe', env: pair.env });
        execFileSync(process.execPath, [
          CLI, 'add', 'rule', DECOY_TITLE,
          '--body', 'Present only to prove which home directory the server resolved.',
          '--summary', 'A decoy in a throwaway global layer.', '--yes',
        ], { cwd: scratch, encoding: 'utf8', stdio: 'pipe', env: pair.env });
        renameSync(path.join(scratch, DIR_NAME), path.join(pair.home, '.my-context'));
        rmSync(scratch, { recursive: true, force: true });

        harness = await startUiChild(pair.root, [], pair.env);
        await openApp(page, harness);
        await openComposer(page);

        const line = await drive(page, pair, {
          entry: 'list', what: 'list rule, with a decoy global layer in the throwaway home',
          values: { category: 'rule' }, how: 'first',
        });
        const got = await outcome(page, line);
        expect(
          got.out,
          'the UI-executed `list rule` must name the decoy: it exists ONLY in the throwaway '
          + `home (${pair.home}), so an answer that carries it proves the server resolved `
          + 'homedir() there and not to the real one',
        ).toContain('RULE-a-d12-decoy-in-the-throwaway-global-layer');
      } finally {
        await harness?.stop();
        pair.dispose();
      }
    }, roots);
  });
