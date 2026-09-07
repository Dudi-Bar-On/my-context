// @basis none - a harness, not a test: it asserts nothing about the product, only builds the throwaway home the write specs spawn into and fingerprints the real one so a spec can.
/**
 * **THE SECOND STORE, AND THE ONE THAT WAS NOT ISOLATED.**
 *
 * `plan:builder seq:11` (D12) isolates the CORPUS: every execution runs in a
 * `mkdtemp` copy, because `src/ui/execute.ts` appends an audit record before it
 * runs anything. That covers everything workspace-scoped.
 *
 * It does not cover the GLOBAL ROOT. `src/core/workspace.ts` computes
 *
 *     export const GLOBAL_DIR = path.join(homedir(), '.my-context');
 *
 * ONCE, AT MODULE LOAD, and that directory is shared by every corpus on the
 * machine. Two things reach it and they are not the same two:
 *
 *   * `ui-server.json` and the session digests — ALREADY ISOLATED, and not by
 *     `HOME`. `core/ui-sessions.ts` and `core/ui-server-record.ts` both consult
 *     `MYCONTEXT_UI_SESSIONS_DIR` before `GLOBAL_DIR`, and
 *     `test/helpers/pin-sessions-dir.ts` — imported by `test/ui/helpers.ts`,
 *     which every spec here goes through — points it at a fresh temp directory
 *     per worker process and lets the spawned child inherit it. Measured
 *     2026-09-07: importing `test/ui/helpers.ts` alone sets the variable.
 *
 *   * **THE GLOBAL CORPUS LAYER — NOT ISOLATED, and this is what remained.**
 *     `core/open-store.ts` opens the store with `global: existsSync(
 *     ws.globalRoot) ? ws.globalRoot : undefined`, and `core/inject.ts` asks
 *     `hasGlobalCorpus(ws.globalRoot)`. Neither reads
 *     `MYCONTEXT_UI_SESSIONS_DIR`; both read `GLOBAL_DIR` through
 *     `resolveWorkspace`. So on a machine whose `~/.my-context/items` exists,
 *     the maintainer's own items are folded into every list, every search and
 *     every count these specs compare against the CLI — and `statusline
 *     install` writes `statusline-replaced.json` there, so it is a directory
 *     the product does write to as well as read.
 *
 * `test/docs/injection.test.ts`' `runHook` already had the shape and the
 * reason, in its own words: *"`GLOBAL_DIR` is `homedir()/.my-context`, computed
 * once at module load, so a maintainer who keeps a global corpus would have
 * their own items folded into every assertion here. `homedir()` reads `HOME`
 * first and `USERPROFILE` on Windows, so both are pointed at an empty directory
 * inside the fixture."* This is that, pointed at a UI server rather than a hook.
 *
 * ── WHY THE ENVIRONMENT IS HANDED TO THE SPAWN, NOT SET ON THIS PROCESS ────
 *
 * Because a spec cannot set it early enough. `GLOBAL_DIR` is a module-level
 * `const`, and a Playwright spec's `import` declarations are evaluated before
 * its first statement — so by the time any line of a spec runs, every `src/`
 * module it imports has already read the real `homedir()`. Mutating
 * `process.env` afterwards would move the CHILD and leave this process behind,
 * which is a half-isolation that reads as a whole one. Handing the child an
 * explicit environment says exactly what is true: the server, and everything
 * `execFile`s out of it, sees the throwaway home; this process does not, and
 * therefore never asks the store a question the global layer could answer.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * The REAL global root, resolved here and never through `src/`.
 *
 * Deliberately re-derived rather than imported from `core/workspace.ts`: a spec
 * that proved the real root untouched by asking the module under test where the
 * real root is would be proving nothing if that module were the thing that was
 * wrong.
 */
export const REAL_GLOBAL_ROOT = path.join(homedir(), '.my-context');

/**
 * A throwaway `HOME` inside `root`, and the environment a child must be spawned
 * with to see it.
 *
 * `HOME` for POSIX, `USERPROFILE` for Windows — `os.homedir()` reads the first
 * and falls back to the second, and this suite runs on both.
 * `test/cli/ui-enabled.test.ts` spells the same pair for the same reason.
 */
export function throwawayHome(root: string): { home: string; env: NodeJS.ProcessEnv } {
  const home = path.join(root, '.throwaway-home');
  mkdirSync(home, { recursive: true });
  return { home, env: { ...process.env, HOME: home, USERPROFILE: home } };
}

/**
 * Every file under a directory, by repository-relative path, with the SHA-256
 * of its bytes — so "unchanged" means the bytes, not the mtime.
 *
 * A missing directory is the empty map rather than a throw: on a fresh machine
 * `~/.my-context` does not exist at all, and a spec asserting it was not
 * written to is asserting something true in that case too.
 */
export function fingerprint(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  walk(dir, '');
  return out;

  function walk(here: string, prefix: string): void {
    let entries: string[];
    try {
      entries = readdirSync(here);
    } catch {
      return;
    }
    for (const name of entries.sort()) {
      const full = path.join(here, name);
      const rel = prefix === '' ? name : `${prefix}/${name}`;
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(full, rel);
        continue;
      }
      try {
        out.set(rel, createHash('sha256').update(readFileSync(full)).digest('hex'));
      } catch {
        out.set(rel, 'unreadable');
      }
    }
  }
}

/** The differences between two fingerprints, as lines a failure can carry. */
export function fingerprintDiff(before: Map<string, string>, after: Map<string, string>): string[] {
  const lines: string[] = [];
  for (const [name, hash] of after) {
    const was = before.get(name);
    if (was === undefined) lines.push(`CREATED ${name}`);
    else if (was !== hash) lines.push(`MODIFIED ${name}`);
  }
  for (const name of before.keys()) if (!after.has(name)) lines.push(`DELETED ${name}`);
  return lines.sort();
}
