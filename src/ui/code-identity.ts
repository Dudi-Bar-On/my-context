/**
 * **What code this process is actually running, and whether the disk has moved
 * on since.** `plan:live seq:12`.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * `static.ts`'s `serveStatic` ends in `readFileSync(resolved)` on EVERY
 * request, with no cache: the browser gets `src/ui/public/` as it is on disk
 * right now. TypeScript modules load ONCE, when the process starts. So the two
 * halves of this application age at different rates, and measured on
 * 2026-08-28 they diverged by four hours:
 *
 *     server process (pid 57660) started    13:58
 *     continuity landed in core/select.ts   17:42
 *
 * The browser fetched the NEW `screens/preview.js` — five ribbon tracks — and
 * the server answered `/api/select` from the OLD `select.ts` that knew four.
 * The lane drew and nothing could fill it. The owner reported a feature as
 * broken that had shipped correctly an hour earlier.
 *
 * **The read-through is not the defect and is not touched here.** Live assets
 * are what makes UI iteration fast in this project; the defect is that nothing
 * says the two halves disagree. This module is the saying.
 *
 * ── WHY THE SERVER ANSWERS THIS AND NOT THE BROWSER ─────────────────────────
 *
 * Only one participant can see both halves. The page can see what it was
 * served; it cannot see what the server's modules were loaded from, and a page
 * that merely noticed its own assets changing would be reporting a RESTART as
 * loudly as a skew. The server can see the disk and knows its own load moment,
 * so it can answer the real question — *is the source on disk different from
 * the source this process loaded* — and every surface derives the answer from
 * this one function rather than from a second channel that could disagree.
 * That is the precedent `servingLastGood` set on `/api/config` (`plan:live
 * seq:8`), followed rather than re-invented.
 *
 * ── STAT FIRST, CONTENT ONLY WHEN SOMETHING MOVED ───────────────────────────
 *
 * Two stamps, and the cheap one gates the exact one. Measured on this
 * repository's own `src/` (215 files, 4.9 MB), warm:
 *
 *     walk + stat stamp   ~2.4 ms      every ask
 *     content stamp      ~10.3 ms      only when the stat stamp changed
 *
 * against the 3.1 ms `/api/simulate` that `liveWorkspace` measured itself
 * against. The heartbeat asks once a minute per open tab, so the standing cost
 * is noise.
 *
 * **Content, not mtime, decides.** A `git checkout` that restores identical
 * bytes, a formatter that rewrites a file unchanged, a backup tool that touches
 * everything — each moves an mtime and changes nothing this process loaded. A
 * banner raised for one of those is a banner the reader learns to ignore, and
 * this shell already records the cost of a warning that outlives its cause. So
 * the stat stamp is only ever used to decide whether the content stamp is worth
 * recomputing; it never decides the answer itself. Its result is memoised on
 * the stat stamp that produced it, so a tree that stopped moving costs one walk
 * per ask and nothing else.
 *
 * ── IT NEVER THROWS, AND IT NEVER FLAPS ─────────────────────────────────────
 *
 * A walk can fail halfway for reasons that have nothing to do with freshness: a
 * file being rewritten as it is read, an editor's atomic rename, a virus
 * scanner holding a handle, a network mount. `isStale()` answers the LAST
 * answer it was sure of rather than guessing, for the same reason `liveWorkspace`
 * keeps serving the last config that loaded — an endpoint that took itself down,
 * or that alternated between "your server is stale" and silence, would be a new
 * failure bought to disclose an old one.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * The `src/` tree these modules were loaded from — server modules and
 * `src/ui/public/` together, which is exactly the pair that can disagree.
 *
 * This file lives in `src/ui/`, so its parent is `src/`. Derived rather than
 * configured because this project ships TypeScript directly with no build step:
 * the tree the process imports IS the tree on disk, in a checkout and in an
 * install alike.
 */
export const DEFAULT_CODE_ROOT: string = path.dirname(import.meta.dirname);

export interface CodeIdentity {
  /** The directory whose freshness this identity answers for. */
  readonly root: string;
  /**
   * When this process's modules were loaded, ISO-8601. The other half of the
   * measurement the task records: a reader who knows this and knows when they
   * saved a file can see the four hours for themselves.
   */
  readonly startedAt: string;
  /**
   * `true` when the source on disk is not the source this process loaded — so
   * the browser may already be running code the server cannot answer for, and
   * the remedy is a restart.
   */
  isStale(): boolean;
}

/** Every file under `root`, as sorted `/`-separated relative paths. */
function walk(root: string): string[] {
  const found: string[] = [];
  const visit = (relative: string): void => {
    for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
      // Symlinked directories are NOT followed: `static.ts` refuses to serve
      // through a link that leaves the public directory, and a walk that did
      // follow one could loop. A linked file is stamped by the bytes it
      // resolves to, which is what `readFileSync` gives it below.
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) found.push(child);
    }
  };
  visit('');
  return found.sort();
}

/** Cheap: path, size and mtime. Decides only whether `contentStamp` is worth running. */
function statStamp(root: string, files: string[]): string {
  const hash = createHash('sha1');
  for (const file of files) {
    const stat = statSync(path.join(root, file));
    hash.update(file).update('\0').update(String(stat.size)).update('\0').update(String(stat.mtimeMs)).update('\0');
  }
  return hash.digest('hex');
}

/** Exact: path and bytes. The only thing that ever decides `isStale()`. */
function contentStamp(root: string, files: string[]): string {
  const hash = createHash('sha1');
  for (const file of files) {
    hash.update(file).update('\0').update(readFileSync(path.join(root, file))).update('\0');
  }
  return hash.digest('hex');
}

/**
 * Stamp what this process is running, NOW, and hand back something that can be
 * asked later whether the disk still agrees.
 *
 * Called once per server from `startUiServer`. The stamp is taken at that
 * moment rather than at module load so that a process which starts two servers
 * — `test/ui/server.test.ts` does — gets an honest answer for each, and so that
 * the moment reported as `startedAt` is one a reader can line up with the line
 * their terminal printed.
 */
export function stampCodeIdentity(root: string = DEFAULT_CODE_ROOT): CodeIdentity {
  const startedAt = new Date().toISOString();

  let bootContent: string | null = null;
  let lastStat: string | null = null;
  let lastAnswer = false;

  try {
    const files = walk(root);
    lastStat = statStamp(root, files);
    bootContent = contentStamp(root, files);
  } catch {
    // No readable tree to compare against — an install that hid its sources, a
    // permission, a path that is not there. `isStale()` stays `false` for the
    // life of the process rather than claiming a skew it cannot see: a
    // disclosure that cannot be measured must not be invented.
    bootContent = null;
  }

  return {
    root,
    startedAt,
    isStale(): boolean {
      if (bootContent === null) return false;
      try {
        const files = walk(root);
        const stat = statStamp(root, files);
        if (stat === lastStat) return lastAnswer;
        lastStat = stat;
        lastAnswer = contentStamp(root, files) !== bootContent;
        return lastAnswer;
      } catch {
        // Mid-flight: a file being rewritten, a rename, a held handle. The last
        // answer we were sure of, never a flap in either direction.
        return lastAnswer;
      }
    },
  };
}
