#!/usr/bin/env node
/**
 * Refuse a vendored file that was edited, patched, upgraded, or taught to
 * reach the network.
 *
 *   npm run check:vendor
 *
 * `src/ui/public/lib/vendor/` holds third-party code committed unmodified, the
 * same category as the nine `.woff2` faces under `src/ui/public/fonts/`.
 * `CONST-zero-runtime-dependencies` is not bent by that — `dependencies` is
 * still empty and these are static assets — but a vendored file is exactly the
 * kind of thing that gets a one-line "just this once" patch and then silently
 * disagrees with its own provenance for a year.
 *
 * So there are two gates here, and they answer two different questions:
 *
 *   1. **Is it the file we said it was?** Byte count and SHA-256 against the
 *      pins in `VENDOR.md`. The table in that document is the source of truth
 *      and is PARSED, not duplicated here — a pin edited to match a patched
 *      file is a visible diff on a table of digests, which is the point.
 *   2. **Can it reach out?** A static scan for the constructs that would make
 *      an offline plugin fetch something at render time, or execute a string:
 *      `fetch`, `XMLHttpRequest`, `Worker`, `importScripts`, `eval`,
 *      `new Function`, `WebAssembly`. All are zero in what is committed today
 *      and all must stay zero, because a plugin whose pitch is installing
 *      without fetching packages cannot ship a renderer that fetches at render
 *      time. An `import` is the third question and now has its own answer,
 *      below.
 *   3. **Does it stay inside?** Every module specifier a vendored file names
 *      must be RELATIVE and must resolve to another file pinned in the same
 *      manifest. A bare specifier fails (it needs a resolver this product does
 *      not have), a relative specifier landing outside the manifest fails, and
 *      an `import()` whose argument is not a literal fails because nothing can
 *      say where it goes.
 *
 * Upgrading is a deliberate act: new file, new digest, new row, and this check
 * green again on purpose.
 *
 * ── WHY 2 AND 3 ARE TWO QUESTIONS AND NOT ONE, AS OF 2026-09-06 ────────────
 *
 * This file used to answer both with one line — any `import` statement at all
 * was a problem ("it is no longer a single file") — and it read the vendor
 * directory with a single non-recursive `readdirSync`. Both were exactly right
 * for the two things vendored then: `markdown-it.esm.min.js` and
 * `github-markdown-light.css` are self-contained files sitting flat in one
 * directory, and either would be a different thing entirely if it started
 * importing.
 *
 * Both are fatal for a MODULE GRAPH, and
 * `DEC-the-vendor-gate-walks-subdirectories-and-admits-a-relative` is the
 * owner's ruling that the graph is admitted: *"Widen it: walk subdirectories,
 * and allow a relative import only when it resolves to another file in the
 * pinned manifest — still refusing bare specifiers."* Web Awesome's `<wa-tree>`
 * is 26 ES modules importing each other by relative path
 * (`docs/superpowers/specs/2026-09-06-tree-component-evaluation.md`), and under
 * the old rules they would have been not merely rejected but SILENTLY
 * UNAUDITED — the flat read never saw a subdirectory, so nothing under one was
 * pinned, digested or scanned.
 *
 * The widened rule is strictly STRONGER over a graph than the old one was over
 * a file. "No imports" says a file is alone. "Every import resolves to another
 * pin" says the graph is CLOSED: nothing in the vendor directory can reach a
 * byte that this manifest has not pinned and this scan has not read. A chunk
 * dropped by a bad upgrade, an extra chunk slipped in, and an edited chunk are
 * all three still failures, and now so is a chunk that starts importing
 * something from outside.
 *
 * **`FORBIDDEN` was not relaxed to let this in, and must not be.** The 26 files
 * contain none of the seven constructs — measured, and that is precisely why
 * the component-class closure was vendored instead of the documented barrel
 * entries, which pull in `wa-icon` and its `await fetch(url, {mode:"cors"})`.
 * A vendored set that trips one of these is a set to stop and re-derive, never
 * a reason to shorten the list.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';

const REPO = path.join(import.meta.dirname, '..');

/** The vendor directory, repo-relative. */
export const VENDOR_DIR = 'src/ui/public/lib/vendor';

/** The manifest that carries the pins, inside it. */
export const VENDOR_MANIFEST = 'VENDOR.md';

/** One pinned file: what `VENDOR.md`'s table claims about it. */
export interface VendorPin {
  file: string;
  pkg: string;
  version: string;
  bytes: number;
  sha256: string;
}

/**
 * The constructs a vendored browser asset may not contain. Each is a plain
 * substring rather than a pattern, because the claim being made is literal —
 * "this string does not occur" is checkable by a reader, and a regex that
 * nearly matches is how a scan like this quietly stops scanning.
 */
export const FORBIDDEN = [
  'fetch(', 'XMLHttpRequest', 'new Worker', 'importScripts', 'eval(',
  'new Function', 'WebAssembly',
];

/**
 * What one vendored file reaches for: the module specifiers it names, and how
 * many of its `import()` calls name nothing a reader can resolve.
 */
export interface ModuleReach {
  /** Every specifier, in source order: side-effect, `… from`, and `import()`. */
  specifiers: string[];
  /** `import(` calls whose argument is not one string literal. */
  computed: number;
}

/**
 * The module specifiers a vendored file names.
 *
 * Three shapes, kept as three patterns rather than one clever one, because the
 * claim each makes has to be readable: `import "x"` (side-effect),
 * `import …/export … from "x"` (the bulk of an esbuild chunk graph), and
 * `import("x")` (dynamic). The `[^;'"]*?` between the keyword and `from`
 * crosses newlines on purpose — esbuild writes a named import list over
 * several lines — and stops at a `;` or a quote so it cannot run past the end
 * of one statement into the next.
 *
 * `(?:^|[^\w$.])` in front of every keyword is what keeps `import.meta` out of
 * the dynamic pattern, `!important` out of everything, and a property called
 * `.import` from being read as a statement.
 *
 * **`export { X as default }` deliberately does not match**, because it names
 * no module. Only `export … from` reaches another file, and only that is a
 * specifier to resolve.
 *
 * The one thing a byte scan cannot promise is that a specifier hidden in a
 * computed expression was seen — so `computed` counts the `import(` calls
 * whose argument is not a literal, and `auditVendor` refuses on that count
 * rather than passing over what it could not read.
 */
export function moduleReach(text: string): ModuleReach {
  const specifiers: string[] = [];
  const patterns = [
    /(?:^|[^\w$.])import\s*(["'])([^"'\n]*)\1/g,
    /(?:^|[^\w$.])(?:import|export)\b[^;'"]*?\bfrom\s*(["'])([^"'\n]*)\1/g,
    /(?:^|[^\w$.])import\s*\(\s*(["'])([^"'\n]*)\1\s*\)/g,
    /@import\s+(?:url\(\s*)?(["'])([^"'\n]*)\1/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specifiers.push(match[2]!);
  }
  const dynamic = [...text.matchAll(/(?:^|[^\w$.])import\s*\(/g)].length;
  const literal = [...text.matchAll(/(?:^|[^\w$.])import\s*\(\s*["'][^"'\n]*["']\s*\)/g)].length;
  return { specifiers, computed: dynamic - literal };
}

/** `VENDOR.md`'s pin table, parsed. */
export function readPins(manifest: string): VendorPin[] {
  const pins: VendorPin[] = [];
  for (const line of manifest.split('\n')) {
    const row = line.match(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([\d,]+)\s*\|\s*`([0-9a-f]{64})`\s*\|$/);
    if (row === null) continue;
    pins.push({
      file: row[1]!,
      pkg: row[2]!,
      version: row[3]!,
      bytes: Number(row[4]!.replaceAll(',', '')),
      sha256: row[5]!,
    });
  }
  return pins;
}

/** Everything wrong with the vendor directory, as sentences. */
export function auditVendor(
  pins: VendorPin[],
  files: Map<string, Buffer>,
): string[] {
  const problems: string[] = [];
  const pinned = new Set(pins.map((p) => p.file));

  for (const pin of pins) {
    const bytes = files.get(pin.file);
    if (bytes === undefined) {
      problems.push(`${pin.file} is pinned in ${VENDOR_MANIFEST} and is not on disk`);
      continue;
    }
    if (bytes.length !== pin.bytes) {
      problems.push(
        `${pin.file} is ${bytes.length} bytes; ${VENDOR_MANIFEST} pins ${pin.bytes}`);
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== pin.sha256) {
      problems.push(
        `${pin.file} hashes to ${digest}; ${VENDOR_MANIFEST} pins ${pin.sha256}. A vendored `
        + 'file is never edited in place: re-fetch it, or record a new version and a new digest.');
    }
    const text = bytes.toString('utf8');
    const reach = moduleReach(text);
    if (reach.computed > 0) {
      problems.push(
        `${pin.file} calls import() with something other than a string literal — nothing here `
        + 'can say what it loads, so it cannot be shown to stay inside this directory');
    }
    for (const specifier of reach.specifiers) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        problems.push(
          `${pin.file} imports the bare specifier ${JSON.stringify(specifier)} — a bare `
          + 'specifier needs a resolver, and this product has no build step to give it one');
        continue;
      }
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(pin.file), specifier));
      if (!pinned.has(target)) {
        problems.push(
          `${pin.file} imports ${JSON.stringify(specifier)}, which resolves to ${target} — `
          + `that is not pinned in ${VENDOR_MANIFEST}. A relative import is admitted only when `
          + 'it lands on another file this manifest pins, so the vendored graph is closed and '
          + 'every byte in it has been digested and scanned.');
      }
    }
    for (const construct of FORBIDDEN) {
      if (text.includes(construct)) {
        problems.push(
          `${pin.file} contains ${JSON.stringify(construct)} — a vendored asset may not fetch `
          + 'at render time or execute a string');
      }
    }
  }

  for (const name of files.keys()) {
    if (!pinned.has(name)) {
      problems.push(
        `${name} is in ${VENDOR_DIR} and is pinned nowhere in ${VENDOR_MANIFEST} — every `
        + 'vendored file carries a version and a digest, or nobody can tell what it is');
    }
  }
  return problems;
}

/**
 * The vendored payloads on disk: code, not licences and not this manifest.
 *
 * **Recursive since 2026-09-06**, and that is a security fix rather than a
 * convenience. The single `readdirSync` this replaces did not descend, so a
 * file in a subdirectory was not merely unpinned — it was invisible: no digest,
 * no byte count, no `FORBIDDEN` scan, and no complaint. A directory of
 * unaudited third-party JavaScript inside the vendor directory would have
 * passed this check silently.
 *
 * Keys are POSIX-shaped paths relative to `dir` — `webawesome/chunks/chunk.X.js`
 * — because that is what `VENDOR.md`'s `file` column carries and what a
 * relative import has to be resolved against. `path.posix` on both sides means
 * the answer does not depend on which separator the host uses.
 *
 * Licences are skipped by BASENAME, so a `LICENSE-*.txt` beside the code it
 * covers is skipped wherever in the tree it sits. They are not payload: nothing
 * loads one, and `test/ui/webawesome.test.ts` holds each against the bytes its
 * package publishes.
 */
export function vendorFiles(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (absolute: string, prefix: string): void => {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path.join(absolute, entry.name), relative);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === VENDOR_MANIFEST || entry.name.startsWith('LICENSE')) continue;
      out.set(relative, readFileSync(path.join(absolute, entry.name)));
    }
  };
  walk(dir, '');
  return out;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const dir = path.join(REPO, ...VENDOR_DIR.split('/'));
  const pins = readPins(readFileSync(path.join(dir, VENDOR_MANIFEST), 'utf8'));
  const problems = auditVendor(pins, vendorFiles(dir));
  if (problems.length === 0) {
    console.log(`${pins.length} vendored file(s) match ${VENDOR_DIR}/${VENDOR_MANIFEST}.`);
  } else {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`${VENDOR_DIR}: ${problems.length} problem(s).`);
    process.exitCode = 1;
  }
}
