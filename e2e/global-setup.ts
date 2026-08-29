/**
 * Sync the audit projection ONCE, before any worker starts — because doing it
 * per fixture is what made this suite contend.
 *
 * ── WHAT THIS REPLACES ─────────────────────────────────────────────────────
 *
 * `e2e/app.ts`'s fixture used to call `mycontext audit --limit 1` on the way
 * into EVERY test. The reason it did was right and still is: reading
 * `.demo-corpus` appends `access` records to `audit.jsonl`, and a projection
 * behind its log makes the read surface refuse — eighteen of twenty-one
 * screens once rendered "the audit projection is behind relative to its log"
 * where their content belongs (2026-08-24). What was wrong was the FREQUENCY.
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
 * ── WHY ONCE IS ENOUGH, AND HOW THAT STAYS TRUE ────────────────────────────
 *
 * Because the projection is no longer kept current by `mycontext audit`
 * alone. `recordAudit` projects each record on the path that appends it
 * (`audit-db.ts`, "Keeping the projection current on the write path"), and
 * that path is already a write, so every `access` record a server appends
 * during the run carries the projection forward with it. One sync here clears
 * whatever the previous run left behind; the run itself then stays fresh on
 * its own, and the fixtures need only read.
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
 * brought up to date is a whole suite about to measure screens that will
 * refuse, and one legible error here beats two hundred illegible ones there.
 * `CORPUS` is imported from `./app.ts` rather than re-derived, so the corpus
 * this syncs is by construction the corpus the fixtures serve — including
 * under `MYCONTEXT_E2E_CORPUS`.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { CORPUS } from './app.ts';

const CLI = path.join(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

export default function globalSetup(): void {
  execFileSync(process.execPath, [CLI, 'audit', '--limit', '1'], {
    cwd: CORPUS, encoding: 'utf8', stdio: 'pipe',
  });
}
