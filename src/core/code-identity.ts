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
 * ── THE SCOPE WAS `src/`, AND `src/` IS NOT WHAT THE SERVER LOADS ───────────
 *
 * **The disclosure was right and far too coarse, measured 2026-09-01.** A web
 * page told its reader to restart a server that was perfectly current:
 *
 *     server process started      13:10:50
 *     src/ui/server.ts            2026-08-31 20:20    older
 *     src/ui/read-model.ts        12:33               older
 *     src/ui/watch-model.ts       00:57               older
 *     src/ui/public/graph.js      12:19               older
 *     src/ui/public/app.js        10:46               older
 *
 * Nothing the web app uses had moved. What had moved was
 * `src/cli/commands/statusline-powerline.ts`, under a lane editing the terminal
 * status line — a file no request this server answers has ever loaded. The
 * walk root was `src/`, so it covered `src/cli/`, `src/mcp/`, `src/doctor/`,
 * `src/hooks/`, `src/pack/`'s writers and every other sibling, and a modal
 * fired on all of them.
 *
 * That matters more than an ordinary false positive. This modal is the
 * product's ONLY warning for a real and confusing failure mode, and a
 * disclosure that cries wolf is one people learn to dismiss — the same argument
 * "CONTENT, not mtime" already makes below, one level up.
 *
 * ── SO THE SCOPE IS DERIVED, AND IT IS NOT A LIST OF DIRECTORIES ────────────
 *
 * Excluding a hand-written set of siblings would be a list that must agree with
 * something derived, which is this project's most-repeated defect and has been
 * measured nine times. The scope is therefore COMPUTED, from two facts the
 * server states about itself and nothing else:
 *
 *   `entry`    the server's own module. `server.ts` passes
 *              `import.meta.filename`, so the file names ITSELF and no path is
 *              spelled anywhere. Everything the server can answer a request
 *              from is reachable from it by import; nothing else is.
 *   `assets`   the directory `serveStatic` is called with — `PUBLIC_DIR`, the
 *              same constant, not a second spelling of it.
 *
 * `moduleGraph` then walks the imports out of `entry` transitively. That walk
 * is sound BECAUSE of `CONST-node-24-no-build-step`: source is executed
 * directly, every relative import carries an explicit extension, and there is
 * no bundler, no path alias and no loader hook between the specifier and the
 * file. A relative specifier is therefore a literal string in the source, and a
 * static read finds all of them. Measured on this repository, 2026-09-01:
 *
 *     full src/ walk                 227 files    5.68 MB
 *     server module graph            107 files    2.41 MB
 *     + src/ui/public/                48 files    2.02 MB
 *     the scope this module stamps   155 files    4.43 MB
 *
 * and `src/cli/commands/statusline-powerline.ts` is not in it, while
 * `src/core/select.ts` — the file whose four-hour skew started all of this — is,
 * because `read-model.ts` imports it. Three files under `src/cli/commands/` ARE
 * in it (`format.ts`, `injection.ts`, `registry.ts`), which is correct and is
 * the whole argument for deriving rather than excluding by directory: the
 * server really does load them, and a rule that dropped `src/cli/` wholesale
 * would have reintroduced the original defect for exactly those three.
 *
 * **Why a static read and not the runtime module map.** Node can be asked what
 * the PROCESS has loaded — `module.registerHooks`, or an inspector session —
 * and it would answer the wrong question. This process is `mycontext ui`, which
 * boots through `src/cli/index.ts` and therefore really has loaded the whole
 * CLI, `statusline-powerline.ts` included. The question the modal asks is not
 * "what did this process load" but "can this server still answer for the page
 * in front of you", and the answer to that is the forward import closure of the
 * server module — a static property of the source, read statically.
 *
 * ── STAT FIRST, CONTENT ONLY WHEN SOMETHING MOVED ───────────────────────────
 *
 * Two stamps, and the cheap one gates the exact one. Measured on this
 * repository, warm, over the scope above:
 *
 *     stat gate            2.4 ms      every ask
 *     derive + content    48.7 ms      only when the stat stamp changed
 *
 * against the 3.1 ms `/api/simulate` that `liveWorkspace` measured itself
 * against. The heartbeat asks once a minute per open tab, so the standing cost
 * is the first line and it is noise. The second is paid only while somebody is
 * actively editing a file this server loads, at most once per tab per minute,
 * and it is the price of READING 4.43 MB rather than believing an mtime —
 * which is the ruling two paragraphs down and the reason the disclosure is
 * worth anything.
 *
 * **The stat gate runs over the LAST derived scope, and that is sound rather
 * than lucky.** Re-deriving the module graph means reading source, which is the
 * expensive half; so the cheap ask stats the files the last derivation found,
 * plus a fresh directory walk of `assets`. A module can only ENTER or LEAVE the
 * graph by some file already in it changing its imports, and a file whose
 * imports changed has a different size or mtime. So a scope that needs
 * re-deriving always announces itself through the cheap stamp first.
 *
 * **The gate's resolution is the filesystem's, and it is measured rather than
 * assumed.** On NTFS a size-preserving rewrite can land on the timestamp the
 * previous write got: 1 rewrite in 200, in a loop with nothing between the two
 * writes, came back with an identical size AND mtime, and the gate then
 * correctly declines to re-read a file it has no evidence moved. Nothing a
 * person does reaches that window — an editor save is milliseconds of typing
 * away from the last one — but `test/ui/code-skew.test.ts` does, which is why
 * its fixture edits stamp their own mtime instead of trusting the clock.
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
 *
 * A file that is simply NOT THERE is the one exception, and it is not a
 * failure: it is a measurement. A module the graph names and the disk does not
 * hold is stamped `gone`, in both stamps, so a deleted file reads as the change
 * it is. Every other error still propagates to the guard above.
 *
 * ── WHY THIS SITS IN `core/` AND NOT IN `ui/` ───────────────────────────────
 *
 * It was written for the web server and lived beside it, and on 2026-08-27 the
 * SECOND long-lived process in this product hit the same defect at ten times
 * the volume. The MCP server also loads its modules once and holds them; its
 * `core/content-hash.ts` drifted from disk, and for an hour it reported
 * `checksum mismatch` for **719 of 736 items**, each with the sentence "part of
 * this item's text may already have been lost". The corpus was never damaged —
 * a sweep with the on-disk code matched 736 of 736 — and a migration was
 * planned against the reading before anyone thought to distrust the process
 * that produced it. The web UI had documented that exact trap for a month; the
 * MCP server had no such signal.
 *
 * So this module is not a UI concern, it is a property of any process in this
 * repository that loads TypeScript once and answers questions for an hour. It
 * moved rather than being copied, because two stamps that could disagree about
 * what "stale" means is this project's most-repeated defect wearing a new hat.
 * `src/mcp/provenance.ts` is the second caller, and it supplies only `entry` —
 * `assets` is optional BECAUSE the MCP server has no asset half at all: it
 * serves no files, so there is no second thing for its modules to disagree
 * with, and a scope that invented one would stamp a directory the server never
 * reads.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * The pair of things that can disagree: the modules this server answers from,
 * and the assets it hands the browser.
 *
 * Both are supplied by `server.ts` out of values it already holds —
 * `import.meta.filename` and `PUBLIC_DIR` — rather than defaulted here. A
 * default would be this module's guess at where the server lives, which is
 * exactly the hand-kept path the scope is derived to avoid.
 */
export interface CodeScope {
  /** The server's own module. The root of the import closure it can answer from. */
  readonly entry: string;
  /**
   * The directory `serveStatic` serves. Read through on every request, so
   * always current.
   *
   * **Absent means there is no asset half**, which is the MCP server's case and
   * not a defaulting decision: it hands the client no files, so the only thing
   * that can be stale about it is its own module graph. Omitting the key and
   * passing an empty string are deliberately different — an empty string is a
   * path, and `walk('')` reads the process's working directory.
   */
  readonly assets?: string;
}

export interface CodeIdentity {
  /** The pair whose freshness this identity answers for. */
  readonly scope: CodeScope;
  /**
   * When this process's modules were loaded, ISO-8601. The other half of the
   * measurement the task records: a reader who knows this and knows when they
   * saved a file can see the four hours for themselves.
   */
  readonly startedAt: string;
  /**
   * How many files the scope came to when it was stamped, or 0 if it could not
   * be read. Not a disclosure — nothing renders it — but the one number that
   * makes "the scope narrowed" checkable at runtime rather than only in a test.
   */
  readonly files: number;
  /**
   * `true` when the source on disk is not the source this process loaded — so
   * the browser may already be running code the server cannot answer for, and
   * the remedy is a restart.
   */
  isStale(): boolean;
}

/**
 * Every relative specifier a Node ESM source can name another file with.
 *
 * Four shapes, and they are all of them — written here WITHOUT their quotes,
 * because a quoted relative specifier in this comment is one this pattern would
 * read out of its own docstring and carry into the scope as a file that does
 * not exist:
 *
 *     … from ./x.ts        covers import, import type, export … from, export *
 *     import ./x.ts        the bare side-effect form
 *     import( ./x.ts )     dynamic
 *     import( new URL( ./x.js , import.meta.url).href )
 *
 * The last is how `execute-catalogue.ts` loads `public/lib/palette-defs.js`,
 * and matching it is what keeps that one file derived rather than excused in a
 * comment.
 *
 * **`new URL(…)` counts only INSIDE an `import(`, and that was measured.** A
 * bare `new URL` over a relative path is a path, not an import: `doctor/
 * checks.ts` builds one to compare a shim on PATH against its own entry point,
 * and nothing ever imports it. Matching `new URL` on its own followed that path
 * into `src/cli/index.ts` and from there into every command the CLI registers —
 * the scope came back at 196 files with `statusline-powerline.ts` in it, which
 * is the defect being fixed, restored through the fix.
 *
 * Deliberately NOT "any quoted relative string" either: that variant was
 * measured the same day and pulled in 42 extra files — the entire CLI again —
 * through paths named inside prose. A pattern that reads documentation as
 * dependency is the coarse scope wearing a regex.
 */
const RELATIVE_SPECIFIER = new RegExp(
  '(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*(?:new\\s+URL\\s*\\(\\s*)?|^\\s*import\\s+)'
  + '[\'"](\\.\\.?/[^\'"\\n]*)[\'"]', 'gm');

/** Codes that mean "there is no file here", as opposed to "I could not read it". */
const ABSENT = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);

/** The bytes of `file`, or `null` when nothing is there. Any other failure throws. */
function sourceOf(file: string): Buffer | null {
  try {
    return readFileSync(file);
  } catch (err) {
    if (ABSENT.has((err as NodeJS.ErrnoException)?.code ?? '')) return null;
    throw err;
  }
}

/**
 * The import closure of `entry`, as absolute paths mapped to the bytes the walk
 * already had to read.
 *
 * The bytes ride along because the caller hashes exactly these files a moment
 * later, and reading 2.5 MB twice to answer one question is a cost with no
 * argument behind it.
 *
 * A specifier that resolves to nothing is KEPT, with `null` for its bytes. That
 * is what makes a deleted module detectable: the importer's own bytes did not
 * change, so it still names the file, and the file's absence becomes part of
 * the stamp instead of vanishing from it.
 */
function moduleGraph(entry: string): Map<string, Buffer | null> {
  const found = new Map<string, Buffer | null>();
  const queue: string[] = [path.resolve(entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (found.has(file)) continue;
    const bytes = sourceOf(file);
    found.set(file, bytes);
    if (bytes === null) continue;
    const text = bytes.toString('utf8');
    const dir = path.dirname(file);
    RELATIVE_SPECIFIER.lastIndex = 0;
    let match = RELATIVE_SPECIFIER.exec(text);
    while (match !== null) {
      queue.push(path.resolve(dir, match[1] as string));
      match = RELATIVE_SPECIFIER.exec(text);
    }
  }
  return found;
}

/** Every file under `root`, as absolute paths. */
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
      else if (entry.isFile()) found.push(path.join(root, child));
    }
  };
  visit('');
  return found;
}

/**
 * The whole scope, and the bytes of the half that had to be read to find it.
 *
 * `public/lib/palette-defs.js` is in both halves — the module graph reaches it
 * through `execute-catalogue.ts` and the asset walk lists it — so the union is
 * taken by key and it is stamped once.
 */
function scopeFiles(scope: CodeScope): { files: string[]; read: Map<string, Buffer | null> } {
  const read = moduleGraph(scope.entry);
  const files = new Set<string>(read.keys());
  if (scope.assets !== undefined) for (const asset of walk(scope.assets)) files.add(asset);
  return { files: [...files].sort(), read };
}

/**
 * The scope, as absolute paths — the derivation itself, exported so it can be
 * asserted over.
 *
 * **A test that established membership by EDITING a file would be the wrong
 * test.** The only way to ask `isStale()` whether it covers `src/core/select.ts`
 * is to change `src/core/select.ts` while it watches, and this suite runs many
 * files at once over that same checkout — the shared-mutable-resource defect
 * `test/ui/code-skew.test.ts`'s own header is careful to avoid for exactly this
 * reason. Reading the set is the same fact with nothing in the blast radius.
 */
export function codeScope(scope: CodeScope): string[] {
  return scopeFiles(scope).files;
}

/** Cheap: path, size and mtime. Decides only whether the content stamp is worth running. */
function statStamp(files: string[]): string {
  const hash = createHash('sha1');
  for (const file of files) {
    hash.update(file).update('\0');
    try {
      const stat = statSync(file);
      hash.update(String(stat.size)).update('\0').update(String(stat.mtimeMs)).update('\0');
    } catch (err) {
      if (!ABSENT.has((err as NodeJS.ErrnoException)?.code ?? '')) throw err;
      hash.update('gone').update('\0');
    }
  }
  return hash.digest('hex');
}

/** Exact: path and bytes. The only thing that ever decides `isStale()`. */
function contentStamp(files: string[], read: Map<string, Buffer | null>): string {
  const hash = createHash('sha1');
  for (const file of files) {
    hash.update(file).update('\0');
    const cached = read.get(file);
    const bytes = cached === undefined ? sourceOf(file) : cached;
    hash.update(bytes === null ? 'gone' : bytes).update('\0');
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
export function stampCodeIdentity(scope: CodeScope): CodeIdentity {
  const startedAt = new Date().toISOString();

  let bootContent: string | null = null;
  let lastProbe: string[] = [];
  let lastStat: string | null = null;
  let lastAnswer = false;
  let files = 0;

  try {
    const found = scopeFiles(scope);
    lastProbe = found.files;
    files = found.files.length;
    lastStat = statStamp(found.files);
    bootContent = contentStamp(found.files, found.read);
  } catch {
    // No readable scope to compare against — an install that hid its sources, a
    // permission, a path that is not there. `isStale()` stays `false` for the
    // life of the process rather than claiming a skew it cannot see: a
    // disclosure that cannot be measured must not be invented.
    bootContent = null;
  }

  return {
    scope,
    startedAt,
    files,
    isStale(): boolean {
      if (bootContent === null) return false;
      try {
        // The cheap ask: stat what the last derivation found, and re-walk the
        // asset directory so a file that APPEARED under it is seen without
        // reading anything. See the header for why the module half needs no
        // re-derivation to be gated. A scope with no asset half (the MCP
        // server) probes the last derivation alone, which is already sorted.
        const probe = scope.assets === undefined
          ? lastProbe
          : [...new Set([...lastProbe, ...walk(scope.assets)])].sort();
        const stat = statStamp(probe);
        if (stat === lastStat) return lastAnswer;
        const found = scopeFiles(scope);
        lastProbe = found.files;
        lastStat = statStamp(found.files);
        lastAnswer = contentStamp(found.files, found.read) !== bootContent;
        return lastAnswer;
      } catch {
        // Mid-flight: a file being rewritten, a rename, a held handle. The last
        // answer we were sure of, never a flap in either direction.
        return lastAnswer;
      }
    },
  };
}
