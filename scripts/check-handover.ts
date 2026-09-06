#!/usr/bin/env node
/**
 * **The handover is checked for TRUTH, not only for currency.**
 *
 * `PreCompact` makes the handover CURRENT. Nothing made it TRUE, and a wrong
 * claim inside it is copied into the next session, and the next, until somebody
 * happens to measure. This is the after-the-fact reader that measures.
 *
 * ── THE DEFECT THAT SHIPPED NOTHING ONLY BY LUCK ────────────────────────────
 *
 * `reports/V2-HANDOVER.md` carried the instruction *"widen `isServableDocPath`
 * to serve `.my_context/items/**`"* in SIX consecutive blocks — 90%, 92%, 93%,
 * 94%, 95% and 96% — and it was wrong the whole time. `SKIP_DIRS`
 * (`src/doctor/checks.ts`) contains `.my_context`, so `listRepoFiles` never
 * yields a corpus path and that predicate would have been asked about no corpus
 * file, ever. A lane following the instruction faithfully would have shipped a
 * feature that served NOTHING, looked done, and passed every gate. It was
 * caught only because one lane measured instead of trusting.
 *
 * The wrong instruction has a SHAPE, and the shape is what this script looks
 * for: it is carried forward again and again and never becomes a closed item,
 * BECAUSE IT CANNOT BE. Six carries and no closure was the tell, and nothing
 * looked for it.
 *
 * ── WHY THIS IS NOT `verify-citations.ts`, WHICH WAS THE OBVIOUS ANSWER ─────
 *
 * The handover is the one document that gate does not read, so widening it to
 * cover the handover looks like the whole fix. **Measured on 2026-09-06, it is
 * the same defect one layer up.** In 2,831 lines the handover carries:
 *
 *       0  citations in the checked `file` · `fragment` · `~line` form
 *     137  `·` characters, none of which that gate would even read: every one
 *          is prose punctuation, and zero stand where a citation separator
 *          stands, so zero would raise its `UNREAD` fault
 *       2  bare `file.ts:123` pointers, both in prose rather than in a
 *          language-tagged fence, so zero would raise its `BARE` fault
 *
 * **The refusal is therefore not fear of a red gate. It is that the run would
 * be entirely green and entirely empty.** Pointed at the handover today,
 * `verify-citations.ts` walks 2,831 lines, raises no fault, and checks ZERO
 * claims. That is the outcome its own header calls "not coverage, it is the
 * appearance of coverage", in the paragraph refusing `.my_context/items/` for
 * the identical reason, and its settled rule is that **it walks what it can
 * resolve BY FRAGMENT.** The handover speaks no fragments. Adding it there
 * would have been a change that looked done and served nothing — which is
 * precisely the bug this file exists to catch. The measurement is recorded in
 * that script's header too, beside the paragraph it belongs with.
 *
 * ── WHAT THE HANDOVER DOES SPEAK, AND IT IS CHECKABLE ───────────────────────
 *
 * Measured the same day, the handover's real pointer vocabulary is the
 * project's own:
 *
 *     100  `plan/seq` lane references   (57 distinct; `library/2` eleven times)
 *      63  item-id references          (51 distinct)
 *
 * Those resolve against the corpus — which is the point. A `plan/seq` that
 * names no task, or an item id nothing answers to, is a pointer into nothing
 * written by an assistant with no room left to check it, and it is exactly the
 * class of claim that gets copied forward six times.
 *
 * ── THE TWO TIERS, AND WHY THE LINE IS WHERE IT IS ──────────────────────────
 *
 * **DANGLING is GATED.** A pointer nothing answers to is binary, cheap to
 * repair, and has one honest reading. It was measured at ZERO the day this
 * landed, so gating it costs nothing today and catches the first one tomorrow.
 *
 * **CARRIED is REPORTED and never gates.** "This instruction has been repeated
 * five times and its task is still open" is a judgement about the work, not a
 * defect in the file. It can be cleared only by doing the work or by an owner
 * ruling, and a gate a writer cannot clear is a wall. `check-needs-cycles.ts`
 * draws the same line for the same reason and says so in the same words.
 *
 * ── WHAT THIS MUST NEVER DO ─────────────────────────────────────────────────
 *
 * The handover is written under pressure, at high occupancy, by an assistant
 * with very little room left — that is its entire purpose. **Nothing here runs
 * on the write path.** This script is not called by `PreCompact`, by
 * `SessionStart`, by `handover-ask.ts` or by any hook; it is a gate, run after
 * the fact, and it fails the way a linter fails: naming the suspect line, never
 * refusing the write. If a future change makes writing a handover slower,
 * harder, or refusable at 97% occupancy, that change is wrong and this
 * paragraph is the argument against it.
 *
 * There is deliberately **no `--fix`**. Every finding here is a claim about the
 * work, and rewriting the record of a past session to satisfy a checker is the
 * one repair that must stay a person's.
 *
 * ── WHAT IT CANNOT SEE, STATED SO THE RESULT IS NOT READ WIDER THAN IT IS ───
 *
 * An instruction written in pure prose that names no lane and no item is
 * invisible here. That is not a gap to be closed by cleverness — it is the
 * argument for `TASK-an-actionable-line-in-the-handover-names-an-item-and-the`:
 * the handover should carry POINTERS, and a claim that lives only on the bridge
 * between sessions is re-litigated forever.
 *
 * **A THIRD CHECK WAS MEASURED AND REFUSED: the file paths.** The handover
 * names 90 distinct backticked file paths, and "does this file still exist" is
 * the same class of claim as everything above. Measured: 66 resolve, 4 are
 * globs, and 20 do not — and reading the 20 by hand, almost none is a defect.
 * They are outer-repo paths from before the 2026-09-03 relocation
 * (`my-context/docs/...`), scratchpad files that were meant to be temporary,
 * `.my_context/` and `.claude/` paths outside any source walk, and one
 * fragment (`-2.md`) left by a line wrap. Twenty findings nobody is asked to
 * repair, printed on every run, is a wall — and the first thing that happens to
 * a wall is that someone routes around it, taking the six real CARRIED lines
 * with them. The measurement is recorded so the next person does not re-take
 * it; the check is not shipped.
 *
 * A shortened id (`DEC-focus-discloses-and-allows` for
 * `DEC-focus-discloses-and-allows-rather-than-refusing-to-hide`) RESOLVES, by
 * unambiguous prefix. Sixteen of the sixty-three references are shortened —
 * some by the writer, some by a line wrap breaking the id at a hyphen — and a
 * checker that called those sixteen broken would be wrong sixteen times on its
 * first run and switched off on its second. An AMBIGUOUS prefix is a finding;
 * a prefix nothing answers to is a finding.
 *
 * ── RUNNING IT ──────────────────────────────────────────────────────────────
 *
 *     npm run check:handover                       # the gate
 *     node scripts/check-handover.ts --json
 *     node scripts/check-handover.ts --quiet       # print only on failure
 *     node scripts/check-handover.ts --carried 3   # lower the repetition floor
 *     node scripts/check-handover.ts reports/OTHER.md
 *
 * Exit 0 when every pointer resolves. Exit 1 when one does not. Repetition
 * never sets the exit code.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import { isMainEntry } from '../src/core/paths.ts';
import { buildTaskIndex, DONE_STATE, taskState, workItems } from '../src/core/needs.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import type { Item } from '../src/core/types.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/** The handover, and the only file this is pointed at unless told otherwise. */
export const DEFAULT_DOC = 'reports/V2-HANDOVER.md';

/**
 * **The block boundary, and it is the unit that makes repetition countable
 * without git archaeology.**
 *
 * The handover ACCUMULATES: each compaction PREPENDS a `## ⏭ READ THIS FIRST`
 * section above the last one rather than replacing it, so one file holds every
 * session's notes newest-first. "Carried N times" is therefore "appears in N
 * distinct blocks", answerable by reading ONE FILE — no git archaeology — which
 * is why this check is cheap enough to be a gate at all. That characterisation
 * was asserted before it was measured, and it holds: 2,831 lines, and every
 * block above the first is still there.
 *
 * **`###` counts too, and the drift is the reason.** Eleven blocks are written
 * `## ⏭`; four older ones — 2026-08-26 and 2026-08-27, plus two `⏭ THE NEXT
 * TASK` sections — are `### ⏭`. Fifteen in all. They are session boundaries by
 * every reading except the heading level, and a checker that only knew the
 * modern spelling would silently stop counting the older half of its own
 * evidence.
 */
export const BLOCK_HEAD = /^#{2,3}\s*⏭/;

/**
 * A `plan/seq` lane reference, as the handover writes it: backticked, because
 * unbackticked `library/2` is indistinguishable from a path fragment and this
 * corpus writes it in backticks 100 times out of 100.
 */
export const LANE = /`([a-z][a-z0-9-]*)\/(\d+[a-z]?)`/g;

/**
 * An item id. Written both bare and backticked, and — the part that matters —
 * often SHORTENED, either by the writer or by a line wrap that breaks the id at
 * one of its own hyphens. See the prefix rule above.
 */
export const ITEM_ID = /\b([A-Z][A-Z0-9]{1,9})-([a-z0-9][a-z0-9-]{3,})/g;

export type Kind = 'lane' | 'item';

/** One pointer, and every block it was written in. */
export interface Pointer {
  kind: Kind;
  /** Exactly as written, so a finding can be grepped for. */
  raw: string;
  /** What it resolved to, or `null`. For an item, the full id. */
  resolved: string | null;
  /** Why it did not resolve, when it did not. */
  why: string | null;
  /** Distinct block indices, newest first, that carry it. */
  blocks: number[];
  /** First line it appears on, for the finding. */
  line: number;
  /**
   * Whether the work it names is still open. `null` for a pointer that names
   * something with no `state` at all — a decision, a rule, a requirement —
   * which cannot be "closed" and whose repetition is therefore not a signal.
   */
  open: boolean | null;
  /** The states behind it, for the report. */
  states: string[];
}

export interface Block {
  index: number;
  line: number;
  heading: string;
}

export function readBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  lines.forEach((l, i) => {
    if (BLOCK_HEAD.test(l)) blocks.push({ index: blocks.length, line: i + 1, heading: l.trim() });
  });
  return blocks;
}

/** The block a line falls in, or `-1` for the preamble above the first one. */
export function blockOf(blocks: Block[], line: number): number {
  let found = -1;
  for (const b of blocks) {
    if (b.line <= line) found = b.index;
    else break;
  }
  return found;
}

export interface Corpus {
  /** `plan/seq` → the items answering to it. */
  lanes: Map<string, Item[]>;
  /** Every plan name the corpus uses. */
  plans: Set<string>;
  /** Every item id, sorted, for prefix resolution. */
  ids: string[];
  byId: Map<string, Item>;
  /** The id prefixes this corpus actually uses (`TASK`, `DEC`, …). */
  prefixes: Set<string>;
}

export function readCorpus(items: Item[], config: Parameters<typeof buildTaskIndex>[1]): Corpus {
  const lanes = buildTaskIndex(items, config);
  const plans = new Set<string>();
  for (const key of lanes.keys()) plans.add(key.split('/')[0]!);
  const byId = new Map<string, Item>();
  for (const item of items) byId.set(item.id, item);
  const ids = [...byId.keys()].sort();
  const prefixes = new Set(ids.map((id) => id.split('-')[0]!));
  return { lanes, plans, ids, byId, prefixes };
}

/**
 * Resolve an id that may have been shortened. Exact first, then the unique
 * item it prefixes. A trailing hyphen is stripped: it is the signature of a
 * line wrap breaking the id at its own punctuation, and it is not a claim
 * about anything.
 */
export function resolveId(
  corpus: Corpus, written: string,
): { id: string | null; why: string | null; skip: boolean } {
  const probe = written.replace(/-+$/, '');
  if (corpus.byId.has(probe)) return { id: probe, why: null, skip: false };
  const hits = corpus.ids.filter((id) => id.startsWith(`${probe}-`));
  if (hits.length === 1) return { id: hits[0]!, why: null, skip: false };
  if (hits.length > 1) {
    return { id: null, why: `${hits.length} items start with it — write more of the id`, skip: false };
  }
  const parts = probe.split('-');
  const prefix = parts[0]!;
  // **NOT EVERY `CAPS-lowercase` STRING IS AN ID, and the first run proved it.**
  // `UI-side`, `MCP-only`, `SVG-blind` and `NUL-byte` are English compounds and
  // were reported as four broken pointers — a checker wrong four times on its
  // first run is a checker switched off on its second. Two conditions, either
  // one of which makes the string a claim about the corpus: it opens with a
  // prefix this corpus actually uses, or it is long enough that nothing else in
  // English is shaped like it.
  //
  // THREE, MEASURED, not guessed: the shortest id in this corpus carries three
  // segments after its prefix (`INV-hooks-fail-open`, `INV-select-is-pure` —
  // nine ids of 961), and the four English compounds carry one. The nine short
  // ids are unaffected by this branch either way, because every one of them
  // also opens with a prefix the corpus uses and is admitted by the first
  // condition; the length rule only ever decides a string whose prefix is
  // unknown. A first draft wrote FOUR here on an unchecked assumption about
  // the corpus — the exact habit this whole script exists to break — and the
  // number was wrong by one.
  //
  // THE BLIND SPOT THAT BUYS, NAMED: a MISSPELLED prefix on a one- or
  // two-segment id (`DECI-focus`) is invisible here. Measured at zero today,
  // and the trade is four certain false findings against one hypothetical
  // missed one.
  if (!corpus.prefixes.has(prefix) && parts.length - 1 < 3) {
    return { id: null, why: null, skip: true };
  }
  if (!corpus.prefixes.has(prefix)) {
    return { id: null, why: `"${prefix}" is not a category id this corpus uses`, skip: false };
  }
  return { id: null, why: 'no item answers to it', skip: false };
}

export function scan(text: string, blocks: Block[], corpus: Corpus): Pointer[] {
  const lines = text.split(/\r?\n/);
  const found = new Map<string, Pointer>();

  const note = (
    kind: Kind, raw: string, line: number,
    resolve: () => { resolved: string | null; why: string | null; open: boolean | null; states: string[] },
  ): void => {
    const key = `${kind}:${raw}`;
    let p = found.get(key);
    if (p === undefined) {
      const r = resolve();
      p = { kind, raw, line, blocks: [], ...r };
      found.set(key, p);
    }
    const b = blockOf(blocks, line);
    if (!p.blocks.includes(b)) p.blocks.push(b);
  };

  lines.forEach((text_, i) => {
    const line = i + 1;
    for (const m of text_.matchAll(LANE)) {
      const plan = m[1]!;
      const key = `${plan}/${m[2]!}`;
      // A `word/number` whose left half is no plan this corpus knows is not a
      // lane reference at all — it is a path, a ratio, a version. Skipped
      // rather than reported, and that blind spot is named in the summary.
      if (!corpus.plans.has(plan)) continue;
      note('lane', key, line, () => {
        const bucket = corpus.lanes.get(key);
        if (bucket === undefined || bucket.length === 0) {
          return { resolved: null, why: 'no task answers to it', open: null, states: [] };
        }
        const states = bucket.map((it) => taskState(it) || 'no state');
        // Satisfied only when EVERY item under the key is done — the same
        // reading `refStatus` takes, and the one that cannot under-report.
        const open = bucket.some((it) => taskState(it) !== DONE_STATE);
        return { resolved: key, why: null, open, states };
      });
    }
    for (const m of text_.matchAll(ITEM_ID)) {
      const written = `${m[1]!}-${m[2]!}`;
      if (resolveId(corpus, written).skip) continue;
      note('item', written, line, () => {
        const { id, why } = resolveId(corpus, written);
        if (id === null) return { resolved: null, why, open: null, states: [] };
        const item = corpus.byId.get(id)!;
        const state = taskState(item);
        return {
          resolved: id,
          why: null,
          // No `state` means nothing to close. A decision or a requirement
          // repeated across blocks is a standing fact being restated, not an
          // instruction that cannot land, and reporting it would bury the
          // signal this whole check exists to raise.
          open: state === '' ? null : state !== DONE_STATE,
          states: state === '' ? [] : [state],
        };
      });
    }
  });

  return [...found.values()].sort((a, b) => a.line - b.line);
}

export interface Args {
  json: boolean;
  quiet: boolean;
  /** Blocks a still-open pointer must appear in before it is reported. */
  carriedAt: number;
  /** The document to read, repo-relative or absolute. */
  rel: string;
}

/**
 * **The value of `--carried` is not a path**, and separating the two is the
 * whole of this function.
 *
 * It is excluded by INDEX rather than by comparing it to the parsed number, so
 * `--carried 3 reports/X.md` reads `reports/X.md` rather than nothing.
 *
 * `flagAt === -1` IS GUARDED, and it was not on the first draft: `-1 + 1` is 0,
 * so with no `--carried` the filter dropped `argv[0]` — the path — and the
 * script silently read the DEFAULT document instead of the one it was pointed
 * at. It printed a full, correct-looking, entirely green report about the wrong
 * file. That is exactly the defect this whole script was written to catch,
 * inside the script itself, and it was found the only way it ever gets found:
 * by planting a broken pointer in a copy and watching the run stay green.
 */
export function parseArgs(argv: string[]): Args {
  const flagAt = argv.indexOf('--carried');
  const n = flagAt === -1 ? NaN : Number(argv[flagAt + 1]);
  const skipAt = flagAt === -1 ? -1 : flagAt + 1;
  const rest = argv.filter((a, i) => !a.startsWith('--') && i !== skipAt);
  return {
    json: argv.includes('--json'),
    quiet: argv.includes('--quiet'),
    carriedAt: Number.isInteger(n) && n >= 2 ? n : 3,
    rel: rest[0] ?? DEFAULT_DOC,
  };
}

function main(): number {
  const { json, quiet, carriedAt, rel } = parseArgs(process.argv.slice(2));
  const out = (line: string): void => { process.stdout.write(`${line}\n`); };

  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    out('my_context: no workspace here. Run this from a directory inside the project.');
    return 1;
  }

  let text: string;
  try {
    // `resolve`, not `join`: an absolute path is how this gets pointed at a
    // planted copy to be watched going red, which is the only way anyone can
    // trust it went green for a reason.
    text = readFileSync(path.resolve(REPO, rel), 'utf8');
  } catch {
    out(`my_context: cannot read ${rel} — nothing was checked, which is not the same as nothing being wrong.`);
    return 1;
  }

  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config);
  const work = workItems(items, ws.config);
  // The vacuous pass this project has now caught six times in other shapes: a
  // corpus with no work in it resolves nothing, reports nothing, and reads as
  // success. It exits 1 and names the directory instead.
  if (work.length === 0) {
    out(`my_context: no work items under ${ws.projectRoot} — nothing was checked, `
      + 'which is not the same as nothing being wrong. Run this from the repository root.');
    return 1;
  }
  const corpus = readCorpus(items, ws.config);

  const lines = text.split(/\r?\n/);
  const blocks = readBlocks(lines);
  const pointers = scan(text, blocks, corpus);

  const dangling = pointers.filter((p) => p.resolved === null);
  const carried = pointers
    .filter((p) => p.open === true && p.blocks.length >= carriedAt)
    .sort((a, b) => b.blocks.length - a.blocks.length);

  if (json) {
    out(JSON.stringify({
      doc: rel,
      lines: lines.length,
      blocks: blocks.length,
      pointers: pointers.length,
      lanes: pointers.filter((p) => p.kind === 'lane').length,
      items: pointers.filter((p) => p.kind === 'item').length,
      carriedFloor: carriedAt,
      dangling: dangling.map((p) => ({ kind: p.kind, raw: p.raw, line: p.line, why: p.why })),
      carried: carried.map((p) => ({
        kind: p.kind, raw: p.raw, line: p.line, resolved: p.resolved,
        blocks: p.blocks.length, states: p.states,
      })),
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    }, null, 2));
    return dangling.length > 0 ? 1 : 0;
  }

  for (const p of dangling) {
    out(`DANGLING ${rel}:${p.line}`);
    out(`         ${p.kind === 'lane' ? 'lane' : 'item'} ${p.raw}`);
    out(`         ${p.why}`);
  }
  // `--quiet` is "print only on failure", and a carry is never a failure. It
  // still prints alongside a real failure, because a dangling pointer and a
  // five-times-carried instruction on the same page are usually the same story.
  for (const p of quiet && dangling.length === 0 ? [] : carried) {
    out(`CARRIED  ${rel}:${p.line}`);
    out(`         ${p.raw} → ${p.resolved} [${p.states.join(', ')}]`);
    out(`         carried in ${p.blocks.length} of ${blocks.length} blocks and still open`);
  }

  if (!quiet || dangling.length > 0) {
    out('');
    out(`${lines.length} line(s), ${blocks.length} block(s) · ${pointers.length} distinct pointer(s): `
      + `${pointers.filter((p) => p.kind === 'lane').length} lane, `
      + `${pointers.filter((p) => p.kind === 'item').length} item · `
      + `${dangling.length} resolving to nothing`);
    if (dangling.length === 0) out('every pointer in the handover names something that exists.');
    if (carried.length > 0) {
      out('');
      out(`${carried.length} instruction(s) carried into ${carriedAt}+ blocks with the work still open. `
        + 'REPORTED, never gated: repetition is a question about the work, and only a person '
        + 'knows whether a line has been repeated five times because it is hard or because it '
        + 'is impossible. Six carries and no closure is what the `isServableDocPath` defect '
        + 'looked like from outside.');
    }
    out('An instruction written in prose that names no lane and no item is invisible here — '
      + 'which is the argument for writing pointers rather than claims, not a gap in this check.');
  }

  for (const e of errors) out(`load error: ${e.file}: ${e.message}`);
  return dangling.length > 0 ? 1 : 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
