#!/usr/bin/env node
/**
 * Re-fetch the vendored `<wa-tree>` / `<wa-tree-item>` closure from the pinned
 * Web Awesome tarball, deterministically.
 *
 *   node scripts/vendor-webawesome.ts
 *
 * ── WHY A SCRIPT AND NOT A `curl` LINE ─────────────────────────────────────
 *
 * `VENDOR.md` re-fetches `markdown-it` with one `curl`, because markdown-it is
 * one file at a stable URL. This dependency is **twenty-six esbuild
 * content-hashed chunks** — `chunk.T2SU5Q2S.js` and friends — and the hashes
 * are an OUTPUT of the build, not a name anybody chose. A `curl` list of them
 * would be twenty-six lines of folklore that nobody could re-derive after an
 * upgrade.
 *
 * So the rule is written down instead of its output:
 *
 *   1. Fetch `@awesome.me/webawesome@3.12.0`'s tarball and REFUSE it unless it
 *      matches `TARBALL` below, byte count and SHA-256.
 *   2. Read the two DOCUMENTED entry points, `dist-cdn/components/tree/tree.js`
 *      and `dist-cdn/components/tree-item/tree-item.js`, and take the ONE chunk
 *      each names in its `import { WaTree } from '…'` /
 *      `import { WaTreeItem } from '…'` line. The chunk hashes are derived here,
 *      never typed.
 *   3. Walk the transitive closure of relative `import` / `export … from` /
 *      `import()` specifiers from those two roots. A bare specifier or a
 *      missing file aborts the run.
 *   4. Copy the closure verbatim into `src/ui/public/lib/vendor/webawesome/chunks/`
 *      and `LICENSE.md` to `webawesome/LICENSE-webawesome.txt`.
 *   5. Print the `VENDOR.md` pin rows, and run `scripts/check-vendor.ts`.
 *
 * ── WHY THE CHUNKS AND NOT THE BARRELS, WHICH IS THE LOAD-BEARING PART ─────
 *
 * The two entry points in step 2 are barrels: each carries ~45 side-effect
 * imports registering every component `wa-tree-item`'s template CAN render —
 * `wa-icon`, `wa-spinner`, `wa-checkbox`. Vendoring a barrel pulls 49 files /
 * 206,017 B, and one of them (`chunk.WSTNGCWW.js`, `wa-icon`) does
 * `await fetch(url, { mode: "cors" })` — a string `scripts/check-vendor.ts`
 * refuses outright and which this plugin's whole offline pitch refuses too.
 *
 * The named import alone reaches the component CLASS and its transitive
 * closure: 26 files, 89,648 B, and **none of the seven `FORBIDDEN` constructs**.
 * That is not a trick to dodge the gate; it is declining three components this
 * product does not use. What it costs is recorded in
 * `docs/superpowers/specs/2026-09-06-tree-component-evaluation.md` §6.5 — we
 * draw our own chevrons as inline `<svg>`, our own loading affordance, and we
 * give up `selection="multiple"`.
 *
 * ── WHY THE TARBALL IS PINNED TOO ──────────────────────────────────────────
 *
 * Because "which chunks" is only reproducible if "which build" is. A registry
 * that re-published 3.12.0 with a different esbuild would silently hand this
 * script a different — and unaudited — file set. The digest below is the one
 * measured on 2026-09-06, and the fetch stops before writing anything if it
 * moves.
 *
 * This is a dev-time script in the same category as `scripts/gen-diagrams.ts`:
 * it never ships and nothing at runtime imports it. Importing it has no side
 * effect (the `isMainEntry` gate every generator here uses).
 */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';

const REPO = path.join(import.meta.dirname, '..');

/** The published artefact this vendoring is derived from, pinned whole. */
export const TARBALL = {
  url: 'https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.12.0.tgz',
  version: '3.12.0',
  bytes: 2_484_536,
  sha256: '8fb34b5d18c0161bf934d264d39dae649aabd8f4e31135e9cd8bfbae5fa3078d',
};

/** Where the closure lands, repo-relative and posix-shaped. */
export const DESTINATION = 'src/ui/public/lib/vendor/webawesome';

/**
 * The two DOCUMENTED entry points and the export each is entered by.
 *
 * These are the stable input. `dist/` is the other build and is out on
 * `CONST-node-24-no-build-step`: its imports are bare (`lit`, `@lit/context`,
 * `nanoid`) and need a resolver. `dist-cdn/` resolves itself with relative
 * `./chunk.*.js` specifiers, which is exactly what a browser can load from a
 * static directory and exactly what the widened vendor gate can prove closed.
 */
export const ENTRIES = [
  { file: 'dist-cdn/components/tree/tree.js', binding: 'WaTree' },
  { file: 'dist-cdn/components/tree-item/tree-item.js', binding: 'WaTreeItem' },
];

/** One member of an unpacked tar archive. */
export interface TarEntry { name: string; bytes: Buffer }

/**
 * Read a (already gunzipped) tar archive.
 *
 * Written here rather than shelled out to `tar` because the answer must not
 * depend on which `tar` is on PATH — bsdtar on win32 and GNU tar on Linux
 * differ on path separators and on how they treat a leading `./`, and this
 * script's whole claim is that its output is byte-reproducible. The format is
 * 512-byte headers followed by 512-byte-padded content; `ustar` prefix fields
 * are honoured because npm tarballs use them for long paths.
 */
export function untar(archive: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  for (let offset = 0; offset + 512 <= archive.length; offset += 512) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break; // two zero blocks end the archive
    const str = (start: number, length: number): string =>
      header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
    const name = str(0, 100);
    const size = Number.parseInt(str(124, 12).trim() || '0', 8);
    const type = str(156, 1);
    const prefix = str(345, 155);
    offset += 512;
    if (type === '0' || type === '') {
      entries.push({
        name: (prefix === '' ? name : `${prefix}/${name}`).replace(/^\.\//, ''),
        bytes: archive.subarray(offset, offset + size),
      });
    }
    offset += Math.ceil(size / 512) * 512 - 512;
  }
  return entries;
}

/** Every module specifier a source file names, in source order. */
export function specifiersOf(source: string): string[] {
  const found: string[] = [];
  const patterns = [
    /(?:^|[^\w$.])import\s*(["'])([^"'\n]*)\1/g, // import "x"
    /(?:^|[^\w$.])(?:import|export)\b[^;'"]*?\bfrom\s*(["'])([^"'\n]*)\1/g, // … from "x"
    /(?:^|[^\w$.])import\s*\(\s*(["'])([^"'\n]*)\1\s*\)/g, // import("x")
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[2]!);
  }
  return found;
}

/**
 * The transitive closure of relative imports from `roots`, as archive-relative
 * paths. Throws on a bare specifier or a specifier naming a file the archive
 * does not carry — a closure with a hole in it is not vendorable, and finding
 * that out here is the point of walking it.
 */
export function closureOf(files: Map<string, Buffer>, roots: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiersOf(files.get(file)!.toString('utf8'))) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) {
        throw new Error(`${file} imports the bare specifier ${JSON.stringify(spec)} — `
          + 'a bare specifier needs a resolver, and there is no build step here');
      }
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (!files.has(target)) {
        throw new Error(`${file} imports ${JSON.stringify(spec)}, which is not in the tarball`);
      }
      queue.push(target);
    }
  }
  return [...seen].sort();
}

/** The chunk one barrel is entered by: the single file its NAMED import names. */
export function rootOf(files: Map<string, Buffer>, entry: string, binding: string): string {
  const source = files.get(entry)?.toString('utf8');
  if (source === undefined) throw new Error(`${entry} is not in the tarball`);
  const named = new RegExp(
    String.raw`import\s*\{[^}]*\b${binding}\b[^}]*\}\s*from\s*["']([^"']+)["']`);
  const match = source.match(named);
  if (match === null) {
    throw new Error(`${entry} no longer imports ${binding} by name — the entry points moved, `
      + 'and the file set must be re-derived rather than guessed');
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(entry), match[1]!));
}

/** Fetch the pinned tarball, refusing anything that is not byte-for-byte it. */
async function fetchTarball(): Promise<Buffer> {
  const response = await fetch(TARBALL.url);
  if (!response.ok) throw new Error(`${TARBALL.url} answered ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== TARBALL.bytes || digest !== TARBALL.sha256) {
    throw new Error(`the tarball is ${bytes.length} bytes / ${digest}; this script pins `
      + `${TARBALL.bytes} / ${TARBALL.sha256}. Nothing was written. An upgrade is a deliberate `
      + 'act: new tarball digest, new file set, new rows in VENDOR.md, tests re-run.');
  }
  return bytes;
}

/** Do it: fetch, derive, copy, print the pin rows. */
export async function vendorWebawesome(): Promise<string[]> {
  const archive = untar(gunzipSync(await fetchTarball()));
  const files = new Map(archive.map((e) => [e.name.replace(/^package\//, ''), e.bytes]));

  const roots = ENTRIES.map((e) => rootOf(files, e.file, e.binding));
  const closure = closureOf(files, roots);

  const chunks = path.join(REPO, ...DESTINATION.split('/'), 'chunks');
  rmSync(path.join(REPO, ...DESTINATION.split('/')), { recursive: true, force: true });
  mkdirSync(chunks, { recursive: true });

  const rows: string[] = [];
  let total = 0;
  for (const file of closure) {
    const bytes = files.get(file)!;
    const name = path.posix.basename(file);
    writeFileSync(path.join(chunks, name), bytes);
    total += bytes.length;
    rows.push(`| \`webawesome/chunks/${name}\` | \`@awesome.me/webawesome\` | ${TARBALL.version} `
      + `| ${bytes.length.toLocaleString('en-US')} `
      + `| \`${createHash('sha256').update(bytes).digest('hex')}\` |`);
  }
  writeFileSync(
    path.join(REPO, ...DESTINATION.split('/'), 'LICENSE-webawesome.txt'),
    files.get('LICENSE.md')!,
  );

  console.log(rows.join('\n'));
  console.log(`\n${closure.length} files, ${total.toLocaleString('en-US')} B, from `
    + `${roots.join(' + ')}.`);
  return rows;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  await vendorWebawesome();
  // Kept as a reminder rather than run: the pin rows above go into VENDOR.md
  // BEFORE the gate can agree with them.
  const dir = path.join(REPO, 'src', 'ui', 'public', 'lib', 'vendor');
  if (existsSync(dir)) {
    console.log(`\nPaste the rows into ${path.join(dir, 'VENDOR.md')}, then run `
      + '`npm run check:vendor`.');
    console.log(`${readdirSync(path.join(REPO, ...DESTINATION.split('/'), 'chunks')).length} `
      + 'chunk(s) on disk.');
  }
}
