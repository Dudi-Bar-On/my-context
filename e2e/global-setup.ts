// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception,
// TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
/**
 * **FREEZE THE CORPUS ONCE, BEFORE ANY WORKER STARTS — and with it, the audit
 * projection this file used to be entirely about.**
 *
 * ── WHAT THIS FILE WAS, AND WHY THAT ARGUMENT STILL STANDS ─────────────────
 *
 * `e2e/app.ts`'s fixture used to call `mycontext audit --limit 1` on the way
 * into EVERY test. The reason it did was right and still is: READING A CORPUS
 * appends `access` records to `audit.jsonl`, and a projection behind its log
 * makes the read surface refuse — eighteen of twenty-one screens once rendered
 * "the audit projection is behind relative to its log" where their content
 * belongs (2026-08-24). What was wrong was the FREQUENCY.
 *
 * `mycontext audit` is a WRITE: it opens `.audit/audit.db` `BEGIN IMMEDIATE`,
 * advances the source offsets, stamps the version, and lets SQLite checkpoint
 * the WAL as the last connection closes. The read-only door the servers use
 * (`openProjectionReadOnlyChecked`) deliberately sets NO `busy_timeout` — see
 * `src/core/audit-db.ts` — so it does not wait for a writer, it fails. With
 * one writer per test and four workers, sibling servers were reading the same
 * database a sibling fixture was writing, and the failure surfaced as
 * `database is locked` / `disk I/O error` rendered into whichever card was
 * mid-fetch.
 *
 * ── THE MEASUREMENT THAT MOVED IT HERE ─────────────────────────────────────
 *
 * `item-pane.spec.ts`, at this config's default worker count (`20%` of twenty
 * cores = four), same code, same machine:
 *
 *     write-per-fixture (`syncProjection` in the fixture)   2 of 12 runs failed
 *     synced once here, fixtures only read                  0 of 12 runs failed
 *
 * Two earlier measurements are what make that a diagnosis rather than a
 * coincidence (`plan:walk seq:77`, 2026-08-29): removing the preview screen's
 * own history fetch made the SAME spec worse — 6 of 8 rather than 3 of 8 —
 * while `--workers=1` failed 0 of 3. A change to the screen moved the number
 * in the wrong direction; a change to the parallelism moved it to zero. The
 * screen was never the cause; the write-per-fixture was.
 *
 * ── AND NOW THE SYNC HAPPENS INSIDE A SNAPSHOT ────────────────────────────
 *
 * **Controller ruling, 2026-09-23 (B4 fix round 1, `ui-gates/1`,
 * `rulings/114`): the corpus the suite reads stays this repository's own, and
 * the SESSION STATE inside it is frozen for the length of a run.**
 *
 * `e2e/frozen-corpus.ts` carries the whole argument and the three things that
 * were moving underneath the suite — the driving agent session's own seen
 * file, the run's own `access` records, and a sibling lane's commits. What
 * changes HERE is only where the three index commands land: `freezeCorpus`
 * runs `rebuild`, `audit --limit 1` and `audit replay-ledger` inside the
 * snapshot it just made, because `.index.db` is the one thing it cannot copy
 * (a running server holds a mandatory lock on it — the owner's 2026-08-27
 * report). So the projection is still brought up to date exactly once before
 * any worker starts, and the fixtures still only READ.
 *
 * **The live corpus is now written to by this suite not at all.** That is
 * strictly more of what `INSTR-testing-happens-against-the-current-corpus-and-
 * an-exception` asks than the paragraph this replaces could claim: the suite
 * reads the real corpus, at real scale, with this project's real items, and
 * the few hundred `access` rows a two-project run produces land in a
 * temporary directory that is deleted in `e2e/global-teardown.ts`.
 *
 * ── WHY ONCE IS ENOUGH, AND HOW THAT STAYS TRUE ────────────────────────────
 *
 * Because the projection is no longer kept current by `mycontext audit`
 * alone. `recordAudit` projects each record on the path that appends it
 * (`audit-db.ts`, "Keeping the projection current on the write path"), and
 * that path is already a write, so every `access` record a server appends
 * during the run carries the projection forward with it. One sync in the
 * snapshot clears whatever was behind at the instant it was taken; the run
 * itself then stays fresh on its own, and the fixtures need only read.
 *
 * ── WHY NOT THE OTHER THREE FIXES ──────────────────────────────────────────
 *
 * Lowering `workers` hides the contention and bills everyone's wall clock for
 * it; retrying a locked database is a proxy for the property, which this
 * project has caught itself doing four times; and weakening an assertion
 * turns a finding into a green tick. A spec that still fails once the writing
 * has stopped is a REAL failure, and this file exists so that it is finally
 * legible as one.
 *
 * ── IT FAILS LOUDLY ────────────────────────────────────────────────────────
 *
 * `execFileSync` throws, and a `globalSetup` that throws aborts the run before
 * a single browser opens. That is the right end: a corpus that cannot be
 * snapshotted or brought up to date is a whole suite about to measure screens
 * that will refuse, and one legible error here beats two hundred illegible
 * ones there. `CORPUS` is imported from `./app.ts` rather than re-derived, so
 * the corpus this freezes is by construction the corpus the fixtures would
 * otherwise have served — including under an operator's own
 * `MYCONTEXT_E2E_CORPUS`, who gets a frozen copy of the corpus they named.
 *
 * ── HOW THE WORKERS LEARN ABOUT IT ────────────────────────────────────────
 *
 * By `process.env`. Playwright runs `globalSetup` in the runner process and
 * forks the workers afterwards, so a variable set here is in the environment
 * every worker inherits — and `app.ts`'s `CORPUS` is computed at module load
 * from exactly that variable. This process's own `CORPUS` was computed before
 * this function ran and therefore still names the live repository, which is
 * why the freeze reads from it and is not confused by it.
 */
import { CORPUS, CORPUS_ENV } from './app.ts';
import { ARCHIVE_CONFIG_ENV, FROZEN_ROOT_ENV, freezeCorpus } from './frozen-corpus.ts';

export default function globalSetup(): void {
  const frozen = freezeCorpus(CORPUS);
  process.env[CORPUS_ENV] = frozen.workspace;
  // **The BOX, not the workspace**, and the two are different on purpose: the
  // workspace is named after the repository so the provenance bar and the
  // status strip say what they would say without a sandbox, and it lives
  // inside a `mkdtemp` box that carries the random suffix. Teardown deletes
  // the box.
  //
  // It is also a different QUESTION from `CORPUS_ENV`, which the operator may
  // have set themselves before the run: "which directory do the fixtures
  // serve" and "which directory did THIS run create and therefore owe a
  // delete" must not be answered by one variable.
  process.env[FROZEN_ROOT_ENV] = frozen.box;
  // **And the conversation archive, reached under the snapshot's own name.**
  // The archive is keyed by the workspace's PATH, so a relocated workspace has
  // none at all until it is pointed back; `ARCHIVE_CONFIG_ENV` in
  // `frozen-corpus.ts` carries the measurement that found this. A spec that
  // brings its own archive sets this variable itself and overrides it.
  process.env[ARCHIVE_CONFIG_ENV] = frozen.config;
}
