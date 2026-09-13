/**
 * **One reading of `runChecks`, proved current before it is reused.**
 *
 * `/api/status` and `/api/doctor` both run the whole doctor sweep, and the
 * sweep is what makes them slow. Measured against the owner's corpus on
 * 2026-09-14 (1,239 items, 4,739 files under the repository), in-process, with
 * no HTTP in the way:
 *
 * | span                            |     ms | share |
 * |---------------------------------|-------:|------:|
 * | `runChecks` -- all 32 checks     | 3,121 | ~97 % |
 * |   `checkCorpusContradictions`    | 1,640 | ~53 % |
 * |   `checkCitationForm`            |   512 | ~16 % |
 * |   `checkStateUnaudited`          |   220 |       |
 * |   `checkTaskUnverified`          |   201 |       |
 * | `store.all()` (1,239 items)      |    26 |  <1 % |
 * | `Store.openReadOnlyChecked`      |     3 |  <1 % |
 *
 * So the four seconds are ONE function, called twice per page load, and the
 * two endpoints between them spent 6.4 s of a single-threaded server's only
 * thread on the same computation over the same bytes.
 *
 * **What this module does not do: make it cheaper.** `checkCorpusContradictions`
 * is O(n^2) over the governing items and `checkCitationForm` reads every tracked
 * file; both live in `src/doctor/checks.ts`, which is not this lane's file and
 * is not touched. What is removed here is the REPETITION, which is the half of
 * the cost that is this server's own doing.
 *
 * ## Why a fingerprint and not a timeout
 *
 * A TTL cache answers with a report that MAY be out of date and cannot say
 * whether it is. `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * is this product's own standard against exactly that: a cached figure
 * presented as live is a measurement claim nobody made. So the reuse here is
 * conditional on PROOF, not on a clock -- a reading is reused only when a walk
 * of everything the checks read says none of it moved.
 *
 * **What the checks read, exhaustively, and how each is covered.** Every one of
 * the 32 checks in `runChecks` takes its inputs from four places and no others
 * (verified by reading `src/doctor/checks.ts`: it imports no `homedir`, reads
 * no environment variable, and resolves every path against `root` or
 * `repoRoot`):
 *
 *   - files under `repoRoot` -- the source walk (`listRepoFiles`,
 *     `listFilesForScopeCheck`), which is where `checkCitationForm`,
 *     `checkDeadScopes`, `checkSourceDrift`, `checkWatchedDocsServable`,
 *     `checkTutorialRoster`, `checkNestedCorpus` and `checkForeignStore` look;
 *   - files under `root` (`<repoRoot>/.my_context`) -- the item Markdown, the
 *     audit segments, the verdict log, the seen files, `config.json` and
 *     `.index.db` itself. `root` is `path.dirname`'s inverse of `repoRoot` at
 *     both call sites, so it is INSIDE the walk rather than beside it;
 *   - `items` and `config`, which are the index database and `config.json`
 *     parsed -- both files in the walk above;
 *   - the CLOCK, in exactly one check: `checkAssumptionOverdue` compares against
 *     `new Date().toISOString().slice(0, 10)`. It is the only `Date.now()` or
 *     `new Date()` in the file that feeds a verdict, so the UTC DAY is mixed
 *     into the key and a reading never survives midnight.
 *
 * The walk skips `.git` and `node_modules` and nothing else -- deliberately the
 * same pair as `SCOPE_SKIP_DIRS`, the SMALLEST skip set any check uses, because
 * a fingerprint blind to a directory a check reads is a fingerprint that proves
 * the wrong thing. `SKIP_DIRS` (the larger set) is not used here for that
 * reason.
 *
 * **The residual, stated rather than glossed.** The key is
 * (path, size, mtimeMs) per file, not content. A file rewritten to the same
 * length within one filesystem mtime tick is invisible to it. That is the same
 * evidence `checkIndexFreshness` itself rules on -- it compares the index's
 * mtime against the newest item's -- so the memo is exactly as sharp as the
 * check it is memoizing, and no sharper.
 *
 * ## When the proof is unaffordable, nothing is reused
 *
 * The walk is bounded twice: `FINGERPRINT_FILE_CAP` entries and
 * `FINGERPRINT_BUDGET_MS` of wall time. A tree that blows either bound yields
 * NO key, the checks run, nothing is stored, and `basis: 'none'` says so in the
 * response. After the first such failure the walk is not attempted again for
 * the life of the process -- paying the budget on every request to learn the
 * same thing twice is a cost with no answer attached.
 *
 * A workspace whose `projectRoot` is the global corpus would make `repoRoot` a
 * home directory; that is precisely what the two bounds are for, and it is not
 * a new exposure -- `checkNestedCorpus` and `checkDeadScopes` already walk
 * `repoRoot` unbounded-by-time today.
 *
 * ## No disk is written, and the guarantee is structural
 *
 * The memo is one module-level variable. This file binds `readdirSync` and
 * `statSync` from `node:fs` and nothing else, so `test/ui/no-writes.test.ts`
 * sees no new write symbol in the `src/ui/` graph -- the cache cannot be made to
 * persist by accident, because there is no writer here to reach for.
 */
import { readdirSync, statSync, type Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runChecks, type Finding } from '../doctor/checks.ts';
import type { Config } from '../core/config.ts';
import type { Item } from '../core/types.ts';

/**
 * Directories the freshness walk never descends into.
 *
 * `.git` holds no source a check reads and rewrites itself constantly, which
 * would make every reading look stale; `node_modules` is vendor code and can be
 * enormous. This is `SCOPE_SKIP_DIRS` in `src/doctor/checks.ts` -- the smallest
 * set any check skips -- and must stay the smallest, for the reason this
 * module's header gives.
 */
const FINGERPRINT_SKIP = new Set(['.git', 'node_modules']);

/**
 * **The one file excluded by NAME, and the measurement that forced it.**
 *
 * With the walk above and nothing else, the memo never hit once — measured
 * 2026-09-14 by snapshotting the whole tree either side of a single
 * `/api/status` call: exactly one entry moved, `.my_context/.index.db-shm`, and
 * it moved on every call. It is SQLite's WAL INDEX: shared memory backed by a
 * file, rewritten by the act of opening the database read-only, and holding no
 * database content of its own — everything in it is derivable from the `-wal`
 * file beside it, which is why SQLite deletes it on last-connection close and
 * rebuilds it on next open.
 *
 * So it is the one thing in the tree whose mtime is a fact about THIS SERVER
 * having read, not about the corpus having changed, and a freshness proof that
 * counted it proves only that a read happened.
 *
 * **`-wal` is deliberately NOT excluded.** It carries committed pages the main
 * database file has not been checkpointed with yet, so a corpus change can live
 * entirely in `-wal` with `.index.db`'s own mtime untouched — dropping it would
 * be the unsound exclusion this one is not.
 */
const FINGERPRINT_SKIP_SUFFIX = '-shm';

/** Entries the walk will look at before it declares the tree unfingerprintable. */
const FINGERPRINT_FILE_CAP = 60_000;

/**
 * Wall-clock the walk may spend before it gives up.
 *
 * 750 ms is set against the measurement this module exists for: the sweep it
 * guards costs 3,100 ms, and a proof that costs a quarter of the thing it saves
 * has stopped being worth taking. The owner's repository fingerprints in ~120 ms.
 */
const FINGERPRINT_BUDGET_MS = 750;

/**
 * How a health reading in a response body came to be there.
 *
 * This rides on `/api/status` and `/api/doctor` so that a reader can tell a
 * report COMPUTED for their request from one REUSED -- and, when it was reused,
 * how old it is and what proved it current. There is no CLI counterpart to this
 * field because `mycontext doctor` runs the checks once per invocation and has
 * nothing to disclose.
 */
export interface HealthReading {
  /**
   * `computed` -- `runChecks` ran during this request.
   * `reused` -- a previous run's findings, with `basis` naming the proof.
   */
  source: 'computed' | 'reused';
  /** When `runChecks` last actually ran for these findings, ISO 8601. */
  computedAt: string;
  /** Age of the findings at the moment this response was built. `0` when computed. */
  ageMs: number;
  /**
   * `workspace-fingerprint` -- path, size and mtime of every file under the
   * repository (minus `.git` and `node_modules`), plus the UTC day, were
   * unchanged since `computedAt`.
   * `none` -- no freshness proof was available; the findings were computed,
   * never reused, and `unprovable` says why.
   */
  basis: 'workspace-fingerprint' | 'none';
  /** Milliseconds this request spent proving freshness. */
  proofMs: number;
  /** Why `basis` is `none`, or `null` when it is not. */
  unprovable: string | null;
}

/** The findings, and the provenance that must travel with them. */
export interface HealthSnapshot {
  findings: Finding[];
  reading: HealthReading;
}

interface Memo {
  key: string;
  findings: Finding[];
  computedAt: number;
}

let memo: Memo | null = null;

/**
 * Set once the walk has failed its bounds, and never cleared.
 *
 * A tree too big to fingerprint at 09:00 is too big at 09:01; retrying buys the
 * same answer for the same 750 ms on every request. The string is the reason,
 * carried into `HealthReading.unprovable` verbatim.
 */
let unfingerprintable: string | null = null;

/**
 * `(path, size, mtime)` over the whole repository plus the UTC day, or `null`
 * when the tree exceeded either bound.
 *
 * Entries are sorted per directory so the digest is a fact about the tree and
 * not about the order the filesystem happened to enumerate it in.
 */
function fingerprint(repoRoot: string): string | null {
  if (unfingerprintable !== null) return null;
  const hash = createHash('sha1');
  const deadline = performance.now() + FINGERPRINT_BUDGET_MS;
  let seen = 0;
  let failure: string | null = null;

  const walk = (dir: string, rel: string): void => {
    if (failure !== null) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      // Unreadable is a FACT about the tree and is hashed as one: a directory
      // that becomes readable changes the key, which is the correct outcome.
      hash.update(`!${rel}\n`);
      return;
    }
    const directories = new Set<string>();
    const names: string[] = [];
    for (const entry of entries) {
      names.push(entry.name);
      if (entry.isDirectory()) directories.add(entry.name);
    }
    names.sort();
    for (const name of names) {
      if (failure !== null) return;
      if (FINGERPRINT_SKIP.has(name)) continue;
      if (name.endsWith(FINGERPRINT_SKIP_SUFFIX) && !directories.has(name)) continue;
      const childRel = rel === '' ? name : `${rel}/${name}`;
      if (directories.has(name)) {
        walk(path.join(dir, name), childRel);
        continue;
      }
      seen++;
      if (seen > FINGERPRINT_FILE_CAP) {
        failure = `the repository holds more than ${FINGERPRINT_FILE_CAP} files, which is more ` +
          'than this server will walk to prove a health report current';
        return;
      }
      if (performance.now() > deadline) {
        failure = 'walking the repository to prove a health report current exceeded ' +
          `${FINGERPRINT_BUDGET_MS} ms, so no reading is reused on this workspace`;
        return;
      }
      try {
        const stat = statSync(path.join(dir, name));
        hash.update(`${childRel} ${stat.size} ${stat.mtimeMs}\n`);
      } catch {
        hash.update(`!${childRel}\n`);
      }
    }
  };

  walk(repoRoot, '');
  if (failure !== null) {
    unfingerprintable = failure;
    return null;
  }
  // `checkAssumptionOverdue` is the one check that reads the clock, and it
  // reads the UTC day. Mixing the same day in means a reading cannot outlive
  // the only thing about it that ages on its own.
  hash.update(` day=${new Date().toISOString().slice(0, 10)}`);
  return hash.digest('hex');
}

/**
 * `runChecks`, run at most once per state of the workspace.
 *
 * The stored array is FROZEN -- every caller today only filters and counts it,
 * and a caller that sorted it in place would otherwise corrupt the next
 * response rather than fail. `Object.freeze` makes that a loud error in the
 * module that did it.
 */
export function healthSnapshot(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[]; config: Config;
}): HealthSnapshot {
  const started = performance.now();
  const key = fingerprint(opts.repoRoot);
  const proofMs = Math.round(performance.now() - started);

  if (key !== null && memo !== null && memo.key === key) {
    return {
      findings: memo.findings,
      reading: {
        source: 'reused',
        computedAt: new Date(memo.computedAt).toISOString(),
        ageMs: Date.now() - memo.computedAt,
        basis: 'workspace-fingerprint',
        proofMs,
        unprovable: null,
      },
    };
  }

  const findings = runChecks(opts);
  const computedAt = Date.now();
  memo = key === null ? null : { key, findings: Object.freeze(findings) as Finding[], computedAt };
  return {
    findings,
    reading: {
      source: 'computed',
      computedAt: new Date(computedAt).toISOString(),
      ageMs: 0,
      basis: key === null ? 'none' : 'workspace-fingerprint',
      proofMs,
      unprovable: key === null ? unfingerprintable : null,
    },
  };
}

/**
 * Drop the memo and the give-up flag.
 *
 * **For tests only**, and it exists because the memo is process-local: a suite
 * that builds two fixtures in one process would otherwise have the first
 * fixture's findings proved current for the second by a fingerprint neither of
 * them can distinguish -- the two live in different directories, so the keys
 * differ, but a test that means to prove the COMPUTE path must be able to say
 * so rather than rely on that.
 */
export function resetHealthMemo(): void {
  memo = null;
  unfingerprintable = null;
}
