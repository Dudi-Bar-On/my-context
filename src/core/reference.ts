import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Budgets } from './config.ts';
import { relPosix } from './paths.ts';
import { estimateTokens } from './select.ts';
import { checksum } from './slug.ts';
import { normalizeEol } from './text.ts';
import type { Item } from './types.ts';

/**
 * A `reference` item's body is a SNAPSHOT of a file, taken at capture, and
 * never a live read.
 *
 * The reason is a trust boundary, not an implementation convenience. If the
 * body were read from disk at injection time, then any category a project
 * retiers to `normative` would let whoever can edit the target file change
 * what governs the project — including an agent, which is exactly the hole
 * the staged-revision gate (spec §4) closed. A live read would also break
 * `INV-markdown-is-the-source-of-truth` (the rendered item would not
 * round-trip: what is on disk in `items/` would not be what a session saw)
 * and make the injection budget unpredictable, since a tracked file can grow
 * without bound between one session and the next.
 *
 * So the file is read exactly twice by supported commands: once by
 * `mycontext add … --file`, and once per `mycontext refresh`. Everything in
 * between reads the item.
 */

/**
 * The hard ceiling on a snapshot, in bytes of the file as it is on disk.
 *
 * 256 KiB is not a budget number and must not be read as one — the injection
 * budgets are far smaller, and a file a fraction of this size already spills
 * (see `snapshotCost`). It is the point past which a snapshot stops being
 * cheap for the parts of the program that have nothing to do with injection:
 * the whole text is held in memory, hashed, written into a Markdown item, and
 * re-read and re-parsed by `rebuild` on EVERY command, so an unbounded
 * snapshot makes `list`, `status` and `doctor` slower for as long as the item
 * exists.
 *
 * Capture above this refuses. Capture below it is never silent: `snapshotCost`
 * is reported on every capture and every refresh, because "accepted without
 * comment" is the outcome this codebase does not permit for a value that will
 * cost the reader something later.
 */
export const SNAPSHOT_MAX_BYTES = 256 * 1024;

/**
 * The text a snapshot stores, from the bytes on disk.
 *
 * This must be exactly what `createItem`/`updateItem` do to a body
 * (`normalizeEol(...).trim()`, mutate.ts) — otherwise the checksum recorded
 * at capture would describe text the item does not hold, and `doctor` would
 * report drift against a file that had not changed. `snapshotChecksum` is
 * defined over the output of this function for the same reason.
 */
export function snapshotText(raw: string): string {
  return normalizeEol(raw).trim();
}

/** The checksum of a file's content as a snapshot stores it — see `snapshotText`. */
export function snapshotChecksum(raw: string): string {
  return checksum(snapshotText(raw));
}

/**
 * The snapshot as it is STORED in an item's body: the file's text, quoted —
 * every line prefixed with `> `, and an empty line written as a bare `>`.
 *
 * This is not decoration, and it is the one place a snapshot is not
 * byte-identical to its file. An item's body is the prose BEFORE its first
 * `## ` section: `splitSections` (item.ts) moves everything from a `## ` line
 * onward into a section and drops a leading `# ` line outright, and
 * `validateBody` (validate.ts) refuses such a body at the write boundary
 * precisely because the loss is silent and permanent. A Markdown roadmap is
 * nothing but headings, so storing one raw would mean every realistic
 * reference either refused at capture or lost its content on the next write.
 *
 * Quoting is the smallest change that fixes it: `> ## Q3` matches neither
 * pattern, so the body round-trips unchanged through `renderItem`/`parseItem`,
 * which is `INV-markdown-is-the-source-of-truth`. It is also what the content
 * *is* — a quotation of another file — so `mycontext show` and an injected
 * block both render it as one.
 *
 * The transform is exactly reversible (`snapshotSource`), and the recorded
 * `source_checksum` is taken over the FILE's text, never over the quoted form,
 * so a reader comparing a checksum by hand gets the answer they expect.
 */
export function snapshotBody(text: string): string {
  return text.split('\n').map((line) => (line === '' ? '>' : `> ${line}`)).join('\n');
}

/**
 * The inverse of `snapshotBody`: the file's text, recovered from the body.
 *
 * Tolerant of `>` with no space after it, because that is what `snapshotBody`
 * itself writes for an empty line, and of a line with no `>` at all, which
 * only a hand edit can produce — recovering it verbatim means such a line
 * shows up as drift (the recovered text no longer matches the file) rather
 * than being silently discarded on the next refresh.
 */
export function snapshotSource(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.startsWith('> ') ? line.slice(2) : line === '>' ? '' : line))
    .join('\n');
}

/**
 * Whether `item` is a whole-file snapshot: it names a source file, it records
 * that file's checksum, and it has NO `source_anchor`.
 *
 * The anchor is what separates the two provenance shapes that share these
 * three frontmatter fields, and they drift differently:
 *
 *  - An INGESTED item (`source_anchor` set) holds a human- or model-written
 *    assertion extracted from one section of a document. Its body is not the
 *    section, so drift is "the section this was extracted from changed" and
 *    the remedy is to re-read and re-judge it. That is the check that has
 *    existed since Plan 4.
 *  - A SNAPSHOT (no anchor) holds the file itself. Drift is "the item is no
 *    longer a copy of the file", and the remedy is mechanical: re-read it.
 *
 * `doctor` reports both, with different messages and different routes, and
 * this predicate is what routes them.
 */
export function isSnapshot(item: Item): boolean {
  return item.sourceFile !== null && item.sourceAnchor === null && item.sourceChecksum !== null;
}

/** What a snapshot costs, in the units each surface has to be honest about. */
export interface SnapshotCost {
  bytes: number;
  lines: number;
  /** `estimateTokens` over the snapshot text — the same chars/4 estimate the selector budgets with. */
  tokens: number;
}

export function snapshotCost(text: string): SnapshotCost {
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: text === '' ? 0 : text.split('\n').length,
    tokens: estimateTokens(text),
  };
}

/** A file read for capture: where it came from, what it says, and what it costs. */
export interface Snapshot {
  /** Repo-root-relative, POSIX — the form `source_file` stores and `doctor` resolves. */
  sourceFile: string;
  /** The absolute path actually read, for messages. */
  absolute: string;
  /** The file's own text, normalized and trimmed. What `checksum` is taken over. */
  text: string;
  /** The item body to store: `text`, quoted — see `snapshotBody`. */
  body: string;
  checksum: string;
  /**
   * Measured over `body`, not `text`. The quoting adds two characters per line
   * and those characters are injected along with everything else, so charging
   * the reader for the file alone would understate what the item costs by
   * exactly the amount this codebase is not allowed to leave unsaid.
   */
  cost: SnapshotCost;
}

/** Thrown by `readSnapshot`; the message is already a `my_context:` sentence. */
export class SnapshotError extends Error {}

/**
 * Bytes that mean "this is not text". A snapshot becomes an item's Markdown
 * body, so a file with a NUL in it cannot round-trip and would corrupt the
 * item file rather than fail — the silent-corruption class `validateBody`
 * guards one field over.
 */
function looksBinary(raw: Buffer): boolean {
  return raw.includes(0);
}

/**
 * Reads `target` (a path as the user typed it, resolved against `cwd`) as a
 * snapshot of a file inside `repoRoot`.
 *
 * Every refusal is explicit and names the file. Nothing here warns and
 * continues: a capture that half-worked would leave an item whose body is not
 * the file it claims to be, which is the one thing a `reference` may not be.
 */
export function readSnapshot(repoRoot: string, cwd: string, target: string): Snapshot {
  const absolute = path.resolve(cwd, target);
  const rel = relPosix(repoRoot, absolute);

  // Refused for the same reason `checkSourceDrift` refuses to read one: a
  // `source_file` that climbs out of the repository names something `doctor`
  // will never verify, so the item's provenance would be permanently
  // unconfirmable — and capture is the one moment where saying so is cheap.
  if (rel === '' || rel === '..' || rel.startsWith('../')) {
    throw new SnapshotError(
      `my_context: ${absolute} is outside this repository (${repoRoot}), and a reference records ` +
      `its source as a repository-relative path so \`mycontext doctor\` can check it for drift. ` +
      `Copy the file into the repository first, or capture its content with --body instead — ` +
      `a --body item records no source and is never checked for drift.`,
    );
  }

  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    throw new SnapshotError(
      `my_context: ${rel} could not be read (no such file, or no permission). Nothing was ` +
      `created. Check the path — it is resolved relative to the directory you ran the command in.`,
    );
  }

  if (stat.isDirectory()) {
    throw new SnapshotError(
      `my_context: ${rel} is a directory. A reference snapshots ONE file; there is no ` +
      `whole-directory form, because a directory has no single content to checksum and no ` +
      `single thing for \`mycontext doctor\` to report drift against. Name a file.`,
    );
  }

  if (stat.size > SNAPSHOT_MAX_BYTES) {
    throw new SnapshotError(
      `my_context: ${rel} is ${stat.size} bytes, over the ${SNAPSHOT_MAX_BYTES}-byte limit on a ` +
      `reference snapshot. The limit is not about the injection budget — a file far smaller than ` +
      `this already spills — it is that the snapshot is re-read and re-parsed by every command ` +
      `that rebuilds the index, so an unbounded one slows the whole tool for as long as the item ` +
      `exists. Reference a smaller file, or split this one.`,
    );
  }

  let raw: Buffer;
  try {
    raw = readFileSync(absolute);
  } catch {
    throw new SnapshotError(
      `my_context: ${rel} could not be read (no permission, or it changed while being read). ` +
      `Nothing was created.`,
    );
  }

  if (looksBinary(raw)) {
    throw new SnapshotError(
      `my_context: ${rel} contains NUL bytes, so it is not text. A snapshot becomes the item's ` +
      `Markdown body and must survive being written and read back unchanged; a binary file ` +
      `would not. Nothing was created.`,
    );
  }

  const text = snapshotText(raw.toString('utf8'));
  if (text === '') {
    throw new SnapshotError(
      `my_context: ${rel} is empty (or is nothing but whitespace). A reference to it would carry ` +
      `no content and would report drift the moment anything was written to the file. Nothing ` +
      `was created.`,
    );
  }

  const body = snapshotBody(text);
  return {
    sourceFile: rel,
    absolute,
    text,
    body,
    checksum: checksum(text),
    cost: snapshotCost(body),
  };
}

/**
 * The most generous FULL-TEXT budget in this project.
 *
 * `budgets.index` is deliberately excluded: it pays for one-line index
 * entries, not for a block of body text, so comparing a snapshot's size to it
 * would answer a question nobody asked. The four that remain — `pinned`,
 * `jit`, `restored`, `continuity` — are the ones `fitToBudget`
 * (select.ts) charges an item's rendered block against, so the largest of them
 * is the ceiling above which an item cannot be injected in full anywhere.
 *
 * `continuity` is included because it charges a rendered block like the other
 * three — and it is the SMALLEST of them by design, so it never moves this
 * maximum on a default config. Excluding it would nonetheless be a lie the day
 * somebody raised it, and this function's whole job is to be the ceiling.
 */
export function largestFullTextBudget(budgets: Budgets): number {
  return Math.max(budgets.pinned, budgets.jit, budgets.restored, budgets.continuity);
}

/**
 * What this snapshot will cost, as lines a capture surface prints — always,
 * not only when it is large.
 *
 * The honest form of this has two halves, because the answer depends on the
 * category's tier and a user may retier `reference`:
 *
 *  - On the RATIONALE tier (the default for `reference`) the item is never
 *    injected in full and is not even named in the session index — `select`
 *    filters `isNormative` before it looks at anything else, and `buildIndex`
 *    reduces every rationale type to a bare count. So the snapshot costs the
 *    injection budget NOTHING, whatever its size, and saying "this will use N
 *    of your budget" would be false.
 *  - On the NORMATIVE tier it is a candidate like any other, and `fitToBudget`
 *    admits or spills it whole. So the number that matters is its estimated
 *    token cost against the budget it would compete in.
 *
 * `budget` is the largest full-text budget in the resolved config, since that
 * is the most generous tier the item could ever be admitted to; a snapshot
 * over it cannot be injected in full anywhere.
 *
 * Two functions rather than one block, because the two surfaces need
 * different halves: capture has no previous size to compare against and
 * prints both, while `refresh` prints its own before-and-after line and
 * would otherwise state the new size twice in four lines.
 */
export function snapshotSizeLine(cost: SnapshotCost): string {
  return `${cost.lines} line(s), ${cost.bytes} bytes, ~${cost.tokens} estimated tokens`;
}

export function snapshotBudgetLine(
  cost: SnapshotCost, tier: 'normative' | 'rationale', budget: number,
): string {
  if (tier === 'rationale') {
    return (
      `this category is on the rationale tier, so the item is never injected in full and costs ` +
      `the injection budget nothing. It is stored, searchable, and counted in the session index. ` +
      `Retiering the category to "normative" in config changes that — and changes what governs ` +
      `this project — see README, "reference".`
    );
  }
  return cost.tokens > budget
    ? `this exceeds the largest full-text budget in this project (${budget} estimated tokens), ` +
      `so it can never be injected in full: it will spill, and every session it spills from is ` +
      `told so by id. Fetch it with \`mycontext show <id>\`.`
    : `this category is normative, so the item competes for the injection budget against every ` +
      `other normative item; the largest full-text budget here is ${budget} estimated tokens, ` +
      `and an item that does not fit spills whole and is disclosed by id.`;
}
