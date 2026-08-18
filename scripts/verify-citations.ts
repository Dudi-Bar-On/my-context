#!/usr/bin/env node
/**
 * **Citations resolve, or this exits 1.**
 *
 * The three web-UI plans went stale silently. Their base commits are not
 * ancestors of `master`, 186 `file:line` citations drifted with them, and the
 * first two sampled were off by 136 and 42 lines — landing mid-comment in
 * unrelated code. Nothing noticed, because nothing was checking.
 *
 * `INV-nothing-is-dropped-silently` is this project's rule for exactly that
 * shape. A citation that quietly stops resolving is that invariant's own
 * failure, one layer up in the documentation. So the citation form carries a
 * VERBATIM source fragment, and this script resolves every one of them.
 *
 * The form (`2026-08-18-v2-decisions.md` §2):
 *
 *     `select.ts` · `export function select(` · ~460
 *      ^ file       ^ verbatim fragment          ^ hint, allowed to be stale
 *
 * The fragment is the identity; the line is a convenience. A refactor that
 * moves code updates the hint (`--fix`) and stays green. A change that
 * deletes or rewrites the cited code turns the citation red — which is the
 * failure you actually want surfaced, and the one a line number cannot
 * distinguish from a harmless shift.
 *
 * Zero dependencies, no build step, erasable syntax only — the same
 * constraints as `src/`.
 *
 * Usage:
 *   node scripts/verify-citations.ts            check, exit 1 on any miss
 *   node scripts/verify-citations.ts --fix      also rewrite stale ~line hints
 *   node scripts/verify-citations.ts --json     machine-readable report
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/** Documents whose citations are checked. Everything under these, recursively. */
const DOC_ROOTS = ['docs/superpowers/specs', 'docs/superpowers/plans', 'docs/design'];

/** Where a bare `select.ts` may be resolved from, in priority order. */
const SEARCH_ROOTS = ['src', 'test', 'scripts', 'docs', '.'];

/**
 * `` `file` · `fragment` · ~line ``, where the fragment may itself contain
 * backticks and is then written as a ``double-backtick span``. The `~line` is
 * optional: a citation may carry the fragment alone.
 */
const CITATION =
  /`([^`\n]+?\.(?:ts|js|mjs|cjs|md|json))`[ \t]*·[ \t]*(?:``(.+?)``|`([^`\n]+?)`)(?:[ \t]*·[ \t]*~(\d+))?/g;

interface Citation {
  doc: string;
  docLine: number;
  file: string;
  fragment: string;
  hint: number | null;
  raw: string;
}

type Verdict =
  | { kind: 'ok'; at: number }
  | { kind: 'moved'; at: number }
  | { kind: 'ambiguous'; at: number; count: number }
  | { kind: 'no-file' }
  | { kind: 'no-match' };

function walk(dir: string, out: string[]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) walk(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * A citation names `select.ts`, not `src/core/select.ts`, because the short
 * form survives a directory move and reads better in a table. Resolution is
 * therefore a suffix match, and an AMBIGUOUS suffix is an error rather than a
 * guess — two files named `index.ts` must not silently resolve to whichever
 * the walk reached first.
 */
const fileIndex = new Map<string, string[]>();

function indexFiles(): void {
  const push = (rel: string) => {
    const norm = rel.split(path.sep).join('/');
    for (const key of suffixKeys(norm)) {
      const list = fileIndex.get(key);
      if (list) list.push(norm);
      else fileIndex.set(key, [norm]);
    }
  };
  const walkAll = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.my_context') continue;
      const full = path.join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walkAll(full);
      else push(path.relative(REPO, full));
    }
  };
  walkAll(REPO);
}

/** `src/core/select.ts` → ['select.ts', 'core/select.ts', 'src/core/select.ts'] */
function suffixKeys(rel: string): string[] {
  const parts = rel.split('/');
  const keys: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) keys.push(parts.slice(i).join('/'));
  return keys;
}

function resolveFile(cited: string): string[] {
  const direct = path.join(REPO, cited);
  try {
    if (statSync(direct).isFile()) return [cited];
  } catch {
    /* fall through to the suffix index */
  }
  const hits = fileIndex.get(cited) ?? [];
  if (hits.length <= 1) return hits;
  // Prefer the earliest SEARCH_ROOT, so `select.ts` resolves to src/ over a
  // same-named fixture in test/. Ties beyond that stay ambiguous on purpose.
  const ranked = hits.slice().sort((a, b) => rank(a) - rank(b));
  const best = rank(ranked[0]!);
  const tied = ranked.filter((h) => rank(h) === best);
  return tied.length === 1 ? [ranked[0]!] : tied;
}

function rank(rel: string): number {
  for (let i = 0; i < SEARCH_ROOTS.length; i++) {
    const root = SEARCH_ROOTS[i]!;
    if (root === '.' || rel.startsWith(`${root}/`)) return i;
  }
  return SEARCH_ROOTS.length;
}

/**
 * Markdown escapes `|` inside a table cell. The fragment is compared against
 * SOURCE, so the escape has to come off first — otherwise every citation in a
 * table whose fragment contains a union type is a false negative.
 */
function unescapeFragment(fragment: string): string {
  return fragment.replace(/\\\|/g, '|').replace(/\\`/g, '`');
}

function findFragment(fileRel: string, fragment: string): number[] {
  let text: string;
  try {
    text = readFileSync(path.join(REPO, fileRel), 'utf8');
  } catch {
    return [];
  }
  const needle = unescapeFragment(fragment).trim();
  if (needle.length === 0) return [];
  const lines = text.split(/\r?\n/);
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(needle)) hits.push(i + 1);
  }
  return hits;
}

function collect(doc: string): Citation[] {
  const text = readFileSync(doc, 'utf8');
  const lines = text.split(/\r?\n/);
  const found: Citation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    CITATION.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITATION.exec(line)) !== null) {
      found.push({
        doc: path.relative(REPO, doc).split(path.sep).join('/'),
        docLine: i + 1,
        file: m[1]!,
        fragment: m[2] ?? m[3]!,
        hint: m[4] ? Number(m[4]) : null,
        raw: m[0]!,
      });
    }
  }
  return found;
}

function judge(c: Citation): Verdict {
  const resolved = resolveFile(c.file);
  if (resolved.length === 0) return { kind: 'no-file' };
  if (resolved.length > 1) {
    const hits = findFragment(resolved[0]!, c.fragment);
    return { kind: 'ambiguous', at: hits[0] ?? 0, count: resolved.length };
  }
  const hits = findFragment(resolved[0]!, c.fragment);
  if (hits.length === 0) return { kind: 'no-match' };
  const at = c.hint !== null && hits.includes(c.hint) ? c.hint : hits[0]!;
  if (c.hint === null || c.hint === at) return { kind: 'ok', at };
  return { kind: 'moved', at };
}

function main(): number {
  const argv = process.argv.slice(2);
  const fix = argv.includes('--fix');
  const asJson = argv.includes('--json');

  indexFiles();

  const docs: string[] = [];
  for (const root of DOC_ROOTS) walk(path.join(REPO, root), docs);
  docs.sort();

  const rows: Array<{ c: Citation; v: Verdict }> = [];
  for (const doc of docs) for (const c of collect(doc)) rows.push({ c, v: judge(c) });

  const broken = rows.filter((r) => r.v.kind === 'no-file' || r.v.kind === 'no-match');
  const moved = rows.filter((r) => r.v.kind === 'moved');
  const ambiguous = rows.filter((r) => r.v.kind === 'ambiguous');

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          checked: rows.length,
          documents: docs.length,
          broken: broken.map((r) => ({ ...r.c, verdict: r.v })),
          moved: moved.map((r) => ({ ...r.c, verdict: r.v })),
          ambiguous: ambiguous.map((r) => ({ ...r.c, verdict: r.v })),
        },
        null,
        2,
      )}\n`,
    );
    return broken.length > 0 || ambiguous.length > 0 ? 1 : 0;
  }

  if (fix && moved.length > 0) {
    const byDoc = new Map<string, Array<{ c: Citation; v: Verdict }>>();
    for (const r of moved) {
      const list = byDoc.get(r.c.doc);
      if (list) list.push(r);
      else byDoc.set(r.c.doc, [r]);
    }
    for (const [doc, items] of byDoc) {
      const full = path.join(REPO, doc);
      let text = readFileSync(full, 'utf8');
      for (const r of items) {
        if (r.v.kind !== 'moved') continue;
        const replaced = r.c.raw.replace(/~\d+$/, `~${r.v.at}`);
        text = text.replace(r.c.raw, replaced);
      }
      writeFileSync(full, text);
      process.stdout.write(`fixed  ${doc}  (${items.length} hint${items.length === 1 ? '' : 's'})\n`);
    }
  }

  for (const r of broken) {
    const why = r.v.kind === 'no-file' ? 'no such file' : 'fragment not found';
    process.stdout.write(
      `BROKEN ${r.c.doc}:${r.c.docLine}\n` +
        `       ${r.c.file} · ${r.c.fragment}\n` +
        `       ${why}\n`,
    );
  }
  for (const r of ambiguous) {
    if (r.v.kind !== 'ambiguous') continue;
    process.stdout.write(
      `AMBIG  ${r.c.doc}:${r.c.docLine}\n` +
        `       "${r.c.file}" matches ${r.v.count} files — cite more of the path\n`,
    );
  }
  if (!fix) {
    for (const r of moved) {
      if (r.v.kind !== 'moved') continue;
      process.stdout.write(
        `MOVED  ${r.c.doc}:${r.c.docLine}  ${r.c.file}  ~${r.c.hint} → ~${r.v.at}\n`,
      );
    }
  }

  const ok = rows.length - broken.length - moved.length - ambiguous.length;
  process.stdout.write(
    `\n${rows.length} citation(s) in ${docs.length} document(s): ` +
      `${ok} ok, ${moved.length} moved, ${ambiguous.length} ambiguous, ${broken.length} broken\n`,
  );
  if (broken.length === 0 && ambiguous.length === 0 && moved.length === 0) {
    process.stdout.write('every citation resolves.\n');
  }
  // A moved hint is not a failure — the fragment resolved, which is the claim.
  // `--fix` refreshes the hint; CI does not need to.
  return broken.length > 0 || ambiguous.length > 0 ? 1 : 0;
}

process.exit(main());
