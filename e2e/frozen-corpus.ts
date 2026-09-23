// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception,
// TASK-the-browser-suite-returns-to-the-real-corpus-and-the,
// TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
/**
 * **THE CORPUS IS STILL THIS REPOSITORY'S OWN. WHAT IS FROZEN IS THE SESSION
 * STATE THE SUITE READS WHILE IT RUNS.**
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * `e2e/app.ts`'s `CORPUS` is `REPO` — the live `.my_context/` of the
 * repository the suite is checked out in — by `plan:port seq:99` and the
 * owner's dogfooding instruction, and that stays. What did NOT stay still was
 * the *session state* inside it. Three things write to it while a browser run
 * is in progress, none of them the product under test:
 *
 *   `.my_context/state/<session>.seen.jsonl`   the session-start hook of the
 *       very agent session driving the suite, appending a seen line for every
 *       item delivered to it. A run that takes an hour watches the delivered
 *       preview empty out underneath it.
 *   `.my_context/.audit/`                      every screen the run opens
 *       appends an `access` record — about 150 records per 170 tests,
 *       `e2e/global-setup.ts` measured it — so the audit stream a spec
 *       asserts on is longer at the end of the run than at the start.
 *   `.my_context/items/`                       a sibling lane committing to
 *       the same corpus mid-run. Measured by the B4 lane on 2026-09-22: three
 *       new commits from another lane landed inside one suite run.
 *
 * **Measured, 2026-09-22, run 3 of that lane's budget**: `app-layout.spec.ts`
 * (the boot, the budget ribbon, the gate ladder, the carry) and
 * `chip-hue-authority.spec.ts` (preview and simulate, which hold a
 * live-invalidation subscription) went red for exactly this and nothing else —
 * not reproducible on a fresh runner, not a product defect, not a stale
 * scenario. Controller ruling, 2026-09-23 (B4 fix round 1): keep the corpus
 * real and freeze the state.
 *
 * ── WHAT A FREEZE IS HERE ─────────────────────────────────────────────────
 *
 * One snapshot, once, in `globalSetup`, before a browser opens:
 *
 *   `.my_context/`  is COPIED — items, `.audit/`, `.rules/`,
 *                   `.anchors.jsonl`, the drafts, the verdicts. Real bytes of
 *                   the real corpus, taken at one instant, and nothing that
 *                   happens afterwards can move them.
 *   `state/`        is NOT copied — the per-session latches are the session
 *                   state itself, and the run starts from the one a clean
 *                   checkout has. `copyableIntoSnapshot` below carries the
 *                   argument and the measurement.
 *   everything else is LINKED, not copied — `docs/`, `reports/`, `src/`,
 *                   `node_modules/`, `.git/`. A directory junction on Windows
 *                   and a symlink on POSIX, which `fs.symlinkSync(target,
 *                   link, 'junction')` spells the same way on both.
 *
 * The link half is not a shortcut, it is the point. `read-model-documents.ts`
 * resolves the repository as `path.dirname(projectRoot)`, so the corpus's
 * PARENT has to look like the repository or the Library screen serves nothing;
 * `git-info.ts` wants a `.git`. Those are not session state, they are the
 * repository, and the repository is what a dogfooding suite is supposed to be
 * pointed at. Copying 500 MB of `node_modules` to freeze a seen file would be
 * the fixture this project retired, in a costume.
 *
 * ── WHY `.index.db` IS NOT COPIED, AND WHAT PAYS FOR THAT ─────────────────
 *
 * The owner reported it, 2026-08-27, from a live confirm: *"the corpus could
 * not be copied: EDOM, The process cannot access the file because another
 * process has locked a portion of the file"*. `.index.db` is SQLite and the
 * owner's own UI server holds it open — on Windows that is a mandatory lock,
 * and it is held whenever a server is up, which is always.
 * `src/ui/execute-effect.ts`'s `worthCopying` has excluded it ever since, on
 * the ground `INV-markdown-is-the-source-of-truth` states: the index is
 * DISPOSABLE and rebuilds from the Markdown.
 *
 * So it is rebuilt here instead, with the same three commands
 * `e2e/scratch-corpus.ts` runs for a seeded twin and for the same reasons:
 * `rebuild` (the item index), `audit --limit 1` (the audit PROJECTION, which
 * the delivery-time column and the spill split read) and `audit
 * replay-ledger` (the LEDGER table, without which `/api/sessions` answers
 * `ledger: "not-projected"`, `sessions: []`, and every screen whose subject is
 * a session draws nothing).
 *
 * ── AND THE ONE WRITE THE SUITE USED TO MAKE IS NOW MADE TO THE COPY ──────
 *
 * `e2e/global-setup.ts` has always run `mycontext audit --limit 1` against the
 * served corpus, and wrote a careful paragraph about that being a maintenance
 * command rather than manufactured data. It still is — but it now lands in the
 * snapshot, along with the run's own few hundred `access` records, and the
 * live corpus is left alone for the whole run. That is strictly more of what
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` asks
 * for, not less: the suite reads the real corpus and writes to nobody's.
 *
 * ── WHAT IS DELIBERATELY *NOT* FROZEN ─────────────────────────────────────
 *
 * The conversation archive under the real `~/.claude/projects/`. It is not in
 * the corpus, `conversations*.spec.ts` read it as the product does, and
 * redirecting `HOME` for the shared server would take the archive away from
 * them. `MYCONTEXT_UI_SESSIONS_DIR` is already pinned per worker by
 * `test/helpers/pin-sessions-dir.ts` (via `test/ui/helpers.ts`), so the
 * owner's `~/.my-context/ui-server.json` was never in reach here anyway.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { DIR_NAME } from '../src/core/workspace.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

/** Where `globalSetup` records the snapshot it made, so teardown can delete it. */
export const FROZEN_ROOT_ENV = 'MYCONTEXT_E2E_FROZEN_ROOT';

/**
 * **THE CONVERSATION ARCHIVE IS KEYED BY THE WORKSPACE'S PATH, AND A SNAPSHOT
 * HAS A DIFFERENT ONE.**
 *
 * `conversation-index.ts` finds a project's transcripts at
 * `<config>/projects/<projectDirName(cwd)>`, and `projectDirName` is the cwd
 * with its separators flattened. Measured 2026-09-23:
 *
 *     D:/…/repos/my-context   -> D--Users-UserC-source-repos-my-context   EXISTS
 *     <temp>/…/my-context     -> C--Users-…-myctx-e2e-frozen-Xmo6EW-my-context   does not
 *
 * So a relocated workspace has NO archive at all, however complete its corpus
 * is — and the full gate on 2026-09-23 found exactly that:
 * `e2e/marks-reach.spec.ts` waited out 30 seconds for `.convanch` and
 * `e2e/item-pane.spec.ts` found no id to click, on a snapshot whose
 * `.anchors.jsonl` was present and whose index of it could never be built.
 *
 * The fix is one link and one variable, both inside this run's own box: a
 * throwaway config directory whose `projects/<the snapshot's name>` points at
 * the REAL project's archive directory, and `CLAUDE_CONFIG_DIR` set to it. The
 * product then finds the transcripts it would have found unrelocated.
 *
 * **It is a link and not a copy** because the archive is hundreds of megabytes
 * of transcript and the suite only reads it — the read surface is proved
 * read-only by `test/ui/server-e2e.test.ts`, and the one thing this run
 * writes, the conversation index, lives in the SNAPSHOT's `.index.db`. The
 * owner's `~/.claude` is never written through it.
 *
 * A spec that brings its own archive (`conversations*.spec.ts` all do) sets
 * `CLAUDE_CONFIG_DIR` itself in its `beforeAll` and overrides this, which is
 * the same precedence it already relied on.
 */
export const ARCHIVE_CONFIG_ENV = 'CLAUDE_CONFIG_DIR';

const CLI = path.join(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/**
 * **TWO EXCLUSIONS, AND THEY ARE EXCLUDED FOR OPPOSITE REASONS.**
 *
 * `.index.db` — **locked on Windows and disposable everywhere**, so it is
 * rebuilt rather than copied. `src/ui/execute-effect.ts`'s `worthCopying`
 * spells the same exclusion for the same owner report (2026-08-27, EDOM while
 * a server held it open); the sidecars go with it, because a `-wal` or `-shm`
 * without its database is worse than neither.
 *
 * `state/` — **this is the session state, and the sandbox is the POINT of the
 * ruling rather than an accident of it.** Everything under
 * `.my_context/state/` is per-session latch: `<session>.seen.jsonl`,
 * `.handover-ask.json`, `.restore.json`, `.turn-refresh.json`, one set per
 * agent session that has ever run in this checkout — 753 files on this machine
 * on 2026-09-23. The whole directory is gitignored by `state/.gitignore`'s
 * bare `*`, so **a fresh clone and every CI runner have none of it**, and the
 * browser suite on a hosted runner has therefore always measured a corpus with
 * nothing delivered yet.
 *
 * Copying it forward would have frozen the wrong thing. Measured here, against
 * a snapshot that DID copy it: `e2e/app-layout.spec.ts`'s *"delivered row
 * labels begin at one left edge"* timed out waiting for a second
 * `#deliveredRows .row`, and *"the ribbon's tiers … distinguished by look"*
 * failed with *"the pinned tier drew no segment to compare"* — because the
 * driving agent session's own seen file had already been handed every item
 * this corpus holds, so the selection the preview draws is empty. That is a
 * fact about THIS MACHINE AT THIS HOUR, not about the product, and freezing it
 * would have made the baseline unattributable in the one direction
 * `rulings/114` exists to close.
 *
 * So the run gets the session state a clean checkout has: none. That is what
 * *"point the server at a temp directory"* means — the same move the release
 * prompt makes with `MYCONTEXT_UI_SESSIONS_DIR` for the screenshots and the
 * stranger test, where the temp directory is EMPTY and the owner's record is
 * simply out of reach, not duplicated.
 *
 * **`.audit/` is kept, deliberately, and the asymmetry is not an oversight.**
 * It is equally untracked, and it is not session state: it is the project's
 * own history, it is what the Watch screen and the audit-stream assertions
 * draw, and it does not decide what the selector delivers. Frozen, it is
 * stable for the length of a run, which is all that was wrong with it.
 */
const copyableIntoSnapshot = (corpusDir: string) => (source: string): boolean => {
  const name = path.basename(source);
  if (name.startsWith('.index.db')) return false;
  // The corpus's OWN `state/`, by full path rather than by name: an item whose
  // id happened to be `state` is a different thing, and a filter that cannot
  // tell them apart is the kind of near-miss this project keeps writing down.
  return path.resolve(source) !== path.join(corpusDir, 'state');
};

/**
 * Snapshot `source`'s corpus into a temporary workspace and return its root.
 *
 * The caller is expected to point `MYCONTEXT_E2E_CORPUS` at the result before
 * any worker starts, and to pass the root to `disposeFrozenCorpus` afterwards.
 */
export function freezeCorpus(
  source: string,
): { workspace: string; box: string; config: string } {
  const box = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-frozen-'));
  /**
   * **THE SNAPSHOT KEEPS THE REPOSITORY'S OWN NAME, and that is not cosmetic.**
   *
   * The workspace's basename is what `#hdrrepo` draws — `myctx-e2e-frozen-d2Yk2J`
   * was observed there while this was being built. That string is 23 characters
   * against `my-context`'s ten, and the status bar is laid out by MEASURING its
   * content: `fitStrip` spends a whole row when a subject is cut by more than
   * `STRIP_SLACK` (40px), so a longer repository name can buy the bar an extra
   * row and move every layout assertion below it. A sandbox that changes what
   * the screen says about the repository is a sandbox the specs can see.
   *
   * So the box is the throwaway with the random suffix, and the WORKSPACE
   * inside it is named exactly as the repository is.
   */
  const root = path.join(box, path.basename(path.resolve(source)));
  mkdirSync(root, { recursive: true });

  // The archive, reached under the snapshot's own name. See `ARCHIVE_CONFIG_ENV`.
  const config = path.join(box, 'claude-config');
  mkdirSync(path.join(config, 'projects'), { recursive: true });
  const archive = path.join(
    process.env[ARCHIVE_CONFIG_ENV] ?? path.join(homedir(), '.claude'),
    'projects', projectDirName(path.resolve(source)),
  );
  if (existsSync(archive)) {
    symlinkSync(archive, path.join(config, 'projects', projectDirName(root)), 'junction');
  }
  const env = { ...process.env, [ARCHIVE_CONFIG_ENV]: config };

  // **`dereference: true`**, exactly as `execute-effect.ts` and
  // `scratch-corpus.ts` pass it, and for the reason review found there on
  // 2026-08-28: `cpSync` copies a symlink AS a symlink by default,
  // `src/core/rebuild.ts` documents that item files MAY be symlinks, and
  // `writeItem` resolves before renaming — so a snapshot holding a link would
  // write straight back out into the live corpus it exists to protect.
  const corpusDir = path.join(source, DIR_NAME);
  cpSync(corpusDir, path.join(root, DIR_NAME), {
    recursive: true, dereference: true, filter: copyableIntoSnapshot(corpusDir),
  });

  // The repository AROUND the corpus, linked. `path.dirname(projectRoot)` is
  // how the Library and Coverage screens find `docs/`, and a junction costs
  // nothing and stays truthful about which bytes they are.
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === DIR_NAME) continue;
    const from = path.join(source, entry.name);
    const to = path.join(root, entry.name);
    // `'junction'` is a no-op hint on POSIX (the type argument is ignored
    // there) and the one link kind Windows grants an unelevated process — but
    // it applies to DIRECTORIES only, so a top-level file is copied. They are
    // `package.json`, the READMEs and the tsconfig: bytes, not megabytes, and
    // copying them freezes them too.
    if (entry.isDirectory()) symlinkSync(from, to, 'junction');
    else copyFileSync(from, to);
  }

  /**
   * The index, rebuilt in the snapshot because it could not be copied out of a
   * corpus a running server has open. FOUR commands, four different tables:
   *
   *   `rebuild`                the ITEM index, from the Markdown.
   *   `audit --limit 1`        the audit PROJECTION — the delivery-time column
   *                            and the spill split read it.
   *   `audit replay-ledger`    the LEDGER — without it `/api/sessions` answers
   *                            `ledger: "not-projected"` and every screen
   *                            whose subject is a session draws nothing.
   *   `conversation rebuild`   the CONVERSATION index and the anchor rows.
   *
   * `e2e/scratch-corpus.ts` carries the measurement for the first three; the
   * fourth was found here, by a full gate. **Measured 2026-09-23**: without it
   * `e2e/item-pane.spec.ts` found no `#screen button.linkid` to click at all
   * and `e2e/marks-reach.spec.ts` waited out 30 seconds for `.convanch`,
   * because `mycontext rebuild` rebuilds the corpus index and does not touch
   * the conversation one — and `.index.db` is the file the snapshot cannot
   * copy. `.anchors.jsonl` DOES come across in the copy; what was missing was
   * the index built from it, which is the same distinction `scratch-corpus.ts`
   * records for the ledger.
   */
  for (const args of [
    ['rebuild'], ['audit', '--limit', '1'], ['audit', 'replay-ledger'],
    ['conversation', 'rebuild'],
  ]) {
    execFileSync(process.execPath, [CLI, ...args], {
      cwd: root, encoding: 'utf8', stdio: 'pipe', env,
    });
  }
  return { workspace: root, box, config };
}

/**
 * **Delete a temporary tree, RETRYING, because one attempt loses to Windows.**
 *
 * Moved here from `e2e/scratch-corpus.ts` (which now imports it) when
 * `freezeCorpus` gained a second caller with the same problem; its
 * measurement is the reason it exists and travels with it. The line it
 * replaced tried once and swallowed the failure, on the reasoning that "a
 * scratch directory that outlives one run is litter in `%TEMP%`, never a
 * failure of the test that made it". The first half of that is true and the
 * second half made it invisible. **Measured 2026-09-11: `%TEMP%` held 118
 * `myctx-e2e-` workspace roots against 13 `myctx-e2eh-` home boxes** — so the
 * home box, which no process ever opens, was being removed nearly every time
 * and the workspace, which a UI server had a SQLite handle on, was surviving
 * nine times in ten. Some of the survivors are full 68 MB copies of this
 * corpus.
 *
 * The cause is the handle rather than the code: `harness.stop()` resolves when
 * the child reports exit, and Windows releases a mandatory file lock a beat
 * later. So this waits for the beat. Twelve attempts a quarter-second apart is
 * three seconds of patience against a copy that cost twenty to make, and the
 * loop stops the moment the directory is gone.
 *
 * **`Atomics.wait` rather than a promise**, because the callers' `dispose` is
 * synchronous and is called from a `finally` that a failing test also takes:
 * making it async would mean a test that threw could return before the delete
 * had run, which is the leak this exists to close.
 *
 * Returns whether the tree is actually gone, so a caller can SAY so. A leak
 * nobody is told about is how 118 of them accumulated.
 */
export function removeWithRetries(dir: string): boolean {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      if (!existsSync(dir)) return true;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  return !existsSync(dir);
}

/**
 * Remove a snapshot `freezeCorpus` made, and say so if it could not be.
 *
 * **Only the copied half is deleted by `rmSync`'s own recursion** — the rest
 * of the snapshot is directory junctions, and `rmSync` removes a junction as a
 * link rather than walking through it. That is the property the whole design
 * rests on, and it is asserted rather than assumed:
 * `test/ui/frozen-corpus.test.ts` builds a snapshot over a throwaway tree,
 * writes into the snapshot's corpus, disposes it, and checks that the linked
 * originals — and the source corpus — are untouched and still there.
 */
export function disposeFrozenCorpus(root: string): void {
  if (!removeWithRetries(root)) {
    process.emitWarning(
      `e2e: the frozen corpus could not be deleted and is still in %TEMP%: ${root}`,
    );
  }
}
