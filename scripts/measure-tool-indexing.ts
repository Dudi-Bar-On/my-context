#!/usr/bin/env node
/**
 * **WHAT INDEXING WHAT WAS DONE WOULD COST, MEASURED OVER THE REAL ARCHIVE
 * BEFORE ANY OF IT IS OFFERED** — the measurement
 * `TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done`
 * (`semantic/10`) exists to produce.
 *
 *     node scripts/measure-tool-indexing.ts [--db <path>] [--sources <n>]
 *
 * It READS. It opens the archive index read-only, walks the transcripts it
 * already knows about over exactly the byte ranges it has already scanned, and
 * writes nothing anywhere.
 *
 * ── WHAT IT ANSWERS, AND WHY IT IS THREE QUESTIONS AND NOT ONE ─────────────
 *
 *   1. **How much is there.** `text`, `tool_use` and `tool_result` as
 *      characters, so the 4.6% / 16.6% / 78.9% split the item was dispatched
 *      on can be re-derived on THIS workspace rather than trusted.
 *   2. **What a CAP buys.** `tool_use` is not uniformly useful: `Bash`'s
 *      `command` is a line and `Write`'s `content` is a file. The cap curve is
 *      the difference between indexing the commands and indexing the files a
 *      second time, and `TOOL_VALUE_CAP` is read off it.
 *   3. **What `tool_result` would cost CAPPED**, which is the question the
 *      owner has to rule on and which this script exists to put a number
 *      beside. Nothing here ships it — `buildSearchIndex` does not index
 *      results at any cap, and will not until he says so.
 *
 * ── THE RENDERER IS THE SHIPPED ONE ────────────────────────────────────────
 *
 * `toolProseOf` and `proseOf` are imported from `core/conversation-search.ts`
 * rather than re-written here, so what this measures and what the index stores
 * cannot drift. `CLAUDE.md` opens by describing what a second copy costs.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { MAX_SCAN_BYTES, classifyTurn, iterateTranscript } from '../src/core/conversation-index.ts';
import { proseOf, toolProseOf } from '../src/core/conversation-search.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';

/** The caps the curve is taken at, in characters of one ARGUMENT. */
const TOOL_CAPS = [250, 500, 1_000, 2_000, 4_000, 8_000, Number.POSITIVE_INFINITY];

/** The caps the `tool_result` projection is taken at, in characters of one RESULT. */
const RESULT_CAPS = [512, 1_024, 2_048, 4_096, Number.POSITIVE_INFINITY];

/** One column of the tally: how many spans, and how many characters in them. */
interface Tally { spans: number; chars: number }

function add(t: Tally, text: string): void {
  if (text.trim() === '') return;
  t.spans += 1;
  t.chars += text.length;
}

function blank(): Tally { return { spans: 0, chars: 0 }; }

/**
 * **What one `tool_result` block holds, as characters a trigram index would
 * store** — the same rendering rule `toolProseOf` uses for an argument: a
 * string is its own characters, anything else is its JSON.
 *
 * It is here rather than in `core/` deliberately. Nothing in the product reads
 * `tool_result`, and putting a renderer for it beside the shipped one would be
 * a half-built feature sitting in the source waiting to be switched on by
 * somebody who had not read the ruling it is waiting for.
 */
function resultTextOf(record: Record<string, unknown> | null, cap: number): string {
  if (record === null) return '';
  const message = record.message;
  if (typeof message !== 'object' || message === null) return '';
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: unknown; content?: unknown };
    if (typed.type !== 'tool_result') continue;
    const body = typeof typed.content === 'string'
      ? typed.content
      : JSON.stringify(typed.content ?? '');
    const text = body ?? '';
    parts.push(text.length <= cap ? text : text.slice(0, cap));
  }
  return parts.join('\n');
}

interface Totals {
  sources: number;
  records: number;
  bytesWalked: number;
  said: Tally;
  ran: Map<number, Tally>;
  result: Map<number, Tally>;
  /** Raw character volume by block type, which is the split the item quotes. */
  raw: { text: number; toolUse: number; toolResult: number; thinking: number };
}

/** Raw characters of each block type in one record — the denominator, unrendered. */
function rawChars(record: Record<string, unknown> | null, into: Totals['raw']): void {
  if (record === null) return;
  const message = record.message;
  if (typeof message !== 'object' || message === null) return;
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') { into.text += content.length; return; }
  if (!Array.isArray(content)) return;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: unknown };
    const size = JSON.stringify(block)?.length ?? 0;
    if (typed.type === 'text') into.text += size;
    else if (typed.type === 'tool_use') into.toolUse += size;
    else if (typed.type === 'tool_result') into.toolResult += size;
    else if (typed.type === 'thinking') into.thinking += size;
  }
}

export function measure(dbFile: string, maxSources: number): Totals {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const rows = db.prepare(
    'SELECT key, file, bytes FROM prose_sources ORDER BY bytes DESC',
  ).all() as { key: string; file: string; bytes: number }[];
  db.close();

  const totals: Totals = {
    sources: 0,
    records: 0,
    bytesWalked: 0,
    said: blank(),
    ran: new Map(TOOL_CAPS.map((c) => [c, blank()])),
    result: new Map(RESULT_CAPS.map((c) => [c, blank()])),
    raw: { text: 0, toolUse: 0, toolResult: 0, thinking: 0 },
  };

  for (const row of rows.slice(0, maxSources)) {
    totals.sources += 1;
    const cursor = { scannedBytes: 0, reachedEnd: false, unreadable: 0 };
    // **The same bound the index walks under**: stop at the archive row's own
    // byte count, capped at `MAX_SCAN_BYTES`. A measurement taken over MORE of
    // the file than the index reads would overstate every number below.
    const cap = Math.min(MAX_SCAN_BYTES, row.bytes);
    for (const step of iterateTranscript(row.file, { cap, cursor })) {
      totals.records += 1;
      const record = step.record;
      if (record === null) continue;
      rawChars(record, totals.raw);
      const said = classifyTurn(record.type, (record.message as
        { content?: unknown } | undefined)?.content);
      if (said !== 'machinery') add(totals.said, proseOf(record));
      for (const c of TOOL_CAPS) add(totals.ran.get(c) as Tally, toolProseOf(record, c));
      for (const c of RESULT_CAPS) add(totals.result.get(c) as Tally, resultTextOf(record, c));
    }
    totals.bytesWalked += cursor.scannedBytes;
  }
  return totals;
}

function n(value: number): string { return value.toLocaleString('en-US'); }

function capName(cap: number): string {
  return Number.isFinite(cap) ? n(cap) : 'uncapped';
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const dbFlag = argv.indexOf('--db');
  const sourcesFlag = argv.indexOf('--sources');
  const root = resolveWorkspace(process.cwd()).projectRoot;
  if (root === null && dbFlag === -1) {
    process.stderr.write('my_context: no .my_context workspace here, and no --db given.\n');
    return 1;
  }
  const dbFile = dbFlag === -1
    ? path.join(root as string, '.index.db')
    : (argv[dbFlag + 1] as string);
  const maxSources = sourcesFlag === -1
    ? Number.POSITIVE_INFINITY
    : Number(argv[sourcesFlag + 1]);

  const began = Date.now();
  const t = measure(dbFile, maxSources);
  const ms = Date.now() - began;

  const say = (line: string): void => { process.stdout.write(`${line}\n`); };

  say('');
  say(`WHAT INDEXING WHAT WAS DONE COSTS — ${dbFile}`);
  say(`  ${n(t.sources)} transcripts, ${n(t.records)} records, ${n(t.bytesWalked)} bytes `
    + `walked in ${n(ms)} ms`);
  say('');
  say('1. THE ARCHIVE BY BLOCK TYPE — raw characters, before any rendering');
  const raw = t.raw.text + t.raw.toolUse + t.raw.toolResult + t.raw.thinking;
  const pct = (v: number): string => `${((v / raw) * 100).toFixed(1)}%`;
  say(`    tool_result   ${n(t.raw.toolResult).padStart(13)}   ${pct(t.raw.toolResult).padStart(6)}`);
  say(`    tool_use      ${n(t.raw.toolUse).padStart(13)}   ${pct(t.raw.toolUse).padStart(6)}`);
  say(`    text          ${n(t.raw.text).padStart(13)}   ${pct(t.raw.text).padStart(6)}`);
  say(`    thinking      ${n(t.raw.thinking).padStart(13)}   ${pct(t.raw.thinking).padStart(6)}`);
  say('');
  say('2. WHAT IS INDEXED TODAY — said, as the spans the index actually holds');
  say(`    said          ${n(t.said.chars).padStart(13)} chars   ${n(t.said.spans)} spans`);
  say('');
  say('3. WHAT WAS RUN, RENDERED, AT EACH CAP ON ONE ARGUMENT');
  say('    cap            chars          spans     x said');
  for (const c of TOOL_CAPS) {
    const tally = t.ran.get(c) as Tally;
    say(`    ${capName(c).padStart(8)}   ${n(tally.chars).padStart(13)}   ${n(tally.spans).padStart(8)}`
      + `   ${(tally.chars / Math.max(1, t.said.chars)).toFixed(2)}x`);
  }
  say('');
  say('4. WHAT tool_result WOULD COST, CAPPED — MEASURED, NOT SHIPPED');
  say('    cap            chars          spans     x said');
  for (const c of RESULT_CAPS) {
    const tally = t.result.get(c) as Tally;
    say(`    ${capName(c).padStart(8)}   ${n(tally.chars).padStart(13)}   ${n(tally.spans).padStart(8)}`
      + `   ${(tally.chars / Math.max(1, t.said.chars)).toFixed(2)}x`);
  }
  say('');
  say('  Multiply a character column by the index\'s own measured bytes-per-character to get');
  say('  bytes of FTS5. That ratio is NOT assumed here: read it off the shipped index with');
  say('  `SELECT sum(length(block)) FROM conversation_prose_data` over `sum(length(text))`.');
  say('');
  return 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exitCode = main();
