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
 *      `import` statements, `fetch`, `XMLHttpRequest`, `Worker`,
 *      `importScripts`, `eval`, `new Function`, `WebAssembly`. All are zero in
 *      what is committed today and all must stay zero, because a plugin whose
 *      pitch is installing without fetching packages cannot ship a renderer
 *      that fetches at render time.
 *
 * Upgrading is a deliberate act: new file, new digest, new row, and this check
 * green again on purpose.
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
    if (/(^|[;\s(])import\s*[({'"[]/.test(text)) {
      problems.push(`${pin.file} carries an import statement — it is no longer a single file`);
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

/** The vendored payloads on disk: code, not licences and not this manifest. */
export function vendorFiles(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === VENDOR_MANIFEST || entry.name.startsWith('LICENSE')) continue;
    out.set(entry.name, readFileSync(path.join(dir, entry.name)));
  }
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
