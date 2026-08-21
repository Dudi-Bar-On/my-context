/**
 * The UI page's own bytes: `index.html`, the stylesheet and the browser `.js`
 * modules under `src/ui/public/`.
 *
 * **This is the one surface that answers without a token**, and it has to be:
 * the page cannot present a token it has not loaded the code to fetch. Task
 * 13's dispatch sends every non-`/api` path here before the security gate
 * runs, so everything this module can be made to return is, by construction,
 * readable by anything that can reach the port. That is the whole reason the
 * containment check below is written as a check on the RESOLVED path rather
 * than on the spelling of the request.
 *
 * **Traversal-proof means three independent refusals, not one.** Each has a
 * domain the other two do not cover, and `test/ui/static.test.ts` exercises
 * each through an input the others let past — otherwise a broken guard is
 * invisible behind a working one:
 *
 *   1. **Containment on the resolved absolute path.** This is the shape the
 *      corpus prescribes after
 *      `KNOWN-repo-containment-guard-is-defeated-across-windows-drive`: a
 *      guard that inspects a RELATIVE path's spelling — rejecting `..` and
 *      `../` — is defeated on Windows the moment the two paths are on
 *      different drives, because `path.relative` then returns an absolute
 *      path that begins with neither. Nothing here inspects a spelling.
 *      Decode first, resolve, then require the result to sit strictly INSIDE
 *      the public directory, so no encoding of `..` — raw, `%2F`, `%2e` — has
 *      anything left to walk around. The separator in `root + path.sep` is
 *      load-bearing: without it a sibling directory whose name merely starts
 *      with the root's would pass a bare `startsWith`.
 *   2. **The extension allow-list.** An unknown extension is refused rather
 *      than served as an octet-stream. This directory holds `.html`, `.css`
 *      and `.js`; a fourth kind appearing is a mistake to surface, not
 *      content to ship. It also happens to refuse most of the Win32 path
 *      spellings `pack/layout.ts` enumerates — a trailing dot or space, and
 *      `styles.css::$DATA` — because each of them lands outside the four
 *      keys below.
 *   3. **A link may not leave the directory either.** Guard 1 is lexical, so
 *      a symlink or a Windows junction under `public/` would satisfy it while
 *      the bytes came from anywhere on the disk. The real path of the file
 *      must equal the path we resolved, with the root itself realpath-ed
 *      first so an install living under a symlinked prefix — pnpm, a macOS
 *      `/tmp` — does not fail every request.
 *
 * **What this module deliberately does NOT do:**
 *
 *   - **No `Cache-Control`, no `Content-Security-Policy`, no status other
 *     than 200.** Headers are the caller's (Task 13): a token-guarded
 *     ephemeral app sets `no-store`, and `null` here means "not a static
 *     asset", which the caller answers as 404. There is no partial content,
 *     no conditional request and no compression — the whole payload is a few
 *     tens of kilobytes from local disk, over a loopback socket, to one
 *     browser.
 *   - **No `index.html` fallback for an unknown path.** The app's router is
 *     keyed on `location.hash` (Task 16), and a fragment never reaches the
 *     server, so there are no deep links for a fallback to rescue. Serving
 *     the shell for every unmatched path would only turn a typo into a blank
 *     page.
 *   - **No touch on the idle monitor.** §2 defines idleness over `/api`
 *     requests; a static GET is not one, and this module is not given the
 *     monitor to touch.
 *   - **No write, of any kind.** `readFileSync` and `realpathSync` are the
 *     only filesystem calls here, which is what lets Task 13's runtime half
 *     make the stronger of the two available claims about this path: not
 *     merely that no corpus byte CHANGES, but that no file APPEARS — unlike
 *     the read-only SQLite opens in `read-model.ts`, which create `-wal` and
 *     `-shm` sidecars.
 *
 * One platform difference is recorded rather than papered over: NTFS and
 * default APFS are case-insensitive, so `/STYLES.css` serves on Windows and
 * macOS and 404s on Linux. It cannot leave the public directory on any of
 * them — case folds a name, it does not add a path segment — so this is a
 * portability wart, not a hole, and the fix belongs with whoever decides
 * whether asset names are a grammar.
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Buffer } from 'node:buffer';

/**
 * A served asset. `status` is always 200 — a refusal is `null`, not a status —
 * and it is in the shape because Task 13's dispatch writes the same three
 * fields for every response it sends, static or JSON.
 */
export interface StaticAsset {
  status: number;
  contentType: string;
  body: Buffer;
}

/**
 * The four kinds of file this directory may hold, matched case-sensitively so
 * the answer does not depend on the filesystem underneath. `.svg` is here
 * because Task 12's interface lists it; no `.svg` exists in the tree today.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Strictly inside — the public directory is not itself an asset. */
function contains(root: string, candidate: string): boolean {
  return candidate.startsWith(root + path.sep);
}

/**
 * Serve one asset out of `publicDir`, or `null` for "not a static asset".
 *
 * `null` is every refusal: outside the directory, an extension we do not
 * serve, a link that leaves, a name the filesystem will not open, and a file
 * that is not there. The caller cannot tell them apart, and must not — the
 * one distinction that would be useful to a caller is also the one that tells
 * a stranger which paths exist.
 */
export function serveStatic(pathname: string, publicDir: string): StaticAsset | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // a malformed %-escape is not a path; `decodeURIComponent` throws on it
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  // A backslash is a separator on win32 and an ordinary filename character
  // everywhere else. Refusing it outright is what stops `/sub\mod.js` — which
  // guard 1 cannot see, because it never leaves the directory — from serving
  // on Windows and 404-ing on Linux.
  if (relative.includes('\\')) return null;

  let root: string;
  try {
    root = realpathSync(publicDir);
  } catch {
    return null; // no public directory: there is nothing static to serve
  }

  const resolved = path.resolve(root, relative);
  if (!contains(root, resolved)) return null;

  const contentType = CONTENT_TYPES[path.extname(resolved)];
  if (contentType === undefined) return null;

  try {
    // `realpathSync` also rejects the names the filesystem will not open at
    // all — an embedded NUL, a Win32 device — by throwing rather than by
    // being enumerated here.
    if (realpathSync(resolved) !== resolved) return null;
    return { status: 200, contentType, body: readFileSync(resolved) };
  } catch {
    return null; // missing, unreadable, or a name the OS refuses. Not a throw.
  }
}
