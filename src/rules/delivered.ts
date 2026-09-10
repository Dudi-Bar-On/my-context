/**
 * **The record of a delivery, and the assertion that a door was not missed.**
 *
 * D41 spec §8.2, `plan:store seq:2` Task 7. Read that section before this
 * file, because it decides what this module is allowed to claim:
 *
 * > *Nothing can inspect a model's context window. **What is verifiable is
 * > that we injected at every door and none was missed.*** So: each injection
 * > is **recorded**, and a later hook **asserts** the current session has had
 * > one. That yields a count instead of a promise.
 *
 * So nothing here says the rules are in memory. A row says a door RAN and
 * what it handed over; a `missed` row says a key reached a later hook with no
 * such row behind it. The difference between those two sentences is the whole
 * design, and it is the reason "verify it is in memory" is not a task anybody
 * can be asked to finish.
 *
 * ── WHY NOT THE AUDIT LOG, WHICH ALREADY EXISTS ────────────────────────────
 *
 * Two reasons, and the second is the one that settles it.
 *
 *  1. `AUDIT_OPS` is a CLOSED vocabulary and `parseAudit` refuses a whole
 *     segment on an op it does not know (`core/audit.ts`), so a
 *     `rules-delivered` op would be the third widening of it in a month and
 *     would make every already-written log unreadable to an older reader.
 *     `core/inject.ts` declined the same widening for the subagent attempt
 *     record and put its discriminator in a `note` instead.
 *  2. **`src/rules/` may not import `src/core/`** beyond the frontmatter
 *     parser — `test/rules/isolation.test.ts` asserts it by walking the
 *     import graph, and `recordAudit` lives in `src/core/audit.ts`. Reaching
 *     for it would be the edge spec §7 spent a section rejecting, arriving
 *     through the one module that had a good excuse.
 *
 * So this is a small append-only JSONL in a directory of its own — see
 * `DELIVERED_DIR` for why it is not `state/`. `root` is passed in, the same
 * discipline as `loadRules(root, …)`, because this module has no business
 * deciding where a workspace is.
 *
 * ── IT NEVER THROWS, AND A FAILED WRITE IS NOT A FAILED DELIVERY ───────────
 *
 * `INV-hooks-fail-open`. Every entry point returns a value for every
 * filesystem outcome. The accepted failure direction is the one the seen file
 * already takes: a lost row costs a FALSE `missed` report later, which is
 * noisy; a throw would cost the session its injection, which is the failure
 * this store exists to prevent. Noise over silence, disclosed either way.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * **Its own directory, and not `state/`.** Three reasons, and the third is the
 * one that would have cost data.
 *
 *  1. `state/` is SWEPT. `hooks/session-start.ts` · `sweepStaleState` prunes
 *     it, and a log that is pruned is a count that quietly resets — which is
 *     the one property spec §8.2 asks this file for.
 *  2. `test/hooks/session-start-handover-window.test.ts` digests the whole of
 *     `state/` before and after a SessionStart and asserts the two are equal,
 *     because the handover read path must stamp nothing. A delivery row landing
 *     there would redden a test whose subject is a different mechanism, and the
 *     right answer to that is not to widen the test.
 *  3. This is a LOG, not session state: append-only, read by counting, and
 *     outliving every session in it. `.audit/` is the precedent and this
 *     follows it exactly, including the `*` .gitignore below.
 */
export const DELIVERED_DIR = '.rules';
export const DELIVERED_FILE = 'delivered.jsonl';

/**
 * The doors, and they are spelled the way `core/audit.ts` already spells the
 * matching injection ops so the two logs can be read side by side without a
 * translation table. `manual` is `/LoadMyContext`.
 *
 * **`pre-compact` is NOT here, and its absence is a measurement rather than an
 * oversight** — see `hooks/pre-compact.ts`, which records the reason at the
 * one place a reader would go looking for the missing door.
 */
export type Door = 'session-start' | 'compact-restore' | 'subagent-start' | 'manual';

export interface DeliveryRecord {
  /** ISO instant. */
  at: string;
  /** `delivered` — a door ran. `missed` — a later hook found no `delivered`. */
  kind: 'delivered' | 'missed';
  /**
   * The key a delivery is deduped and asserted under: the session id, or
   * `session::agent` for a subagent (`hooks/io.ts` · `ledgerKey`). Passed in,
   * never composed here — a second spelling of that composite is the defect
   * `core/inject.ts` · `dedupeKey` exists to prevent.
   */
  key: string;
  door: Door;
  /** How many constants the door handed over. `0` is a real answer — see below. */
  entries: number;
  /** Entry ids that did not load, and are therefore not in force. */
  refused?: number;
  /** Spec §9 disagreements reported at this delivery. */
  conflicts?: number;
  /** Free text, for what a field cannot carry. */
  note?: string;
}

function filePath(root: string): string {
  return path.join(root, DELIVERED_DIR, DELIVERED_FILE);
}

/**
 * Create the directory and (re)write its `*` .gitignore.
 *
 * Rewritten on every append rather than once at creation, exactly as
 * `core/drafts.ts` and `core/continuity.ts` do it and for their reason: a
 * directory this product creates inside a repository it does not own must
 * carry its own ignore rule, because a line added to the repository's root
 * `.gitignore` is an edit to a file that belongs to somebody else — and an
 * emptied or hand-edited one repairs itself on the next write rather than
 * silently leaving a machine-local log staged.
 */
function ensureDir(root: string): string {
  const dir = path.join(root, DELIVERED_DIR);
  mkdirSync(dir, { recursive: true });
  try { writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8'); } catch { /* best effort */ }
  return dir;
}

/**
 * The cap, and why there is one at all.
 *
 * Measured over 36,024 audit records this workspace already holds: 1,082
 * `subagent-start` against 54 `session-start`. One row per door means this
 * file grows at roughly the rate of that log, and a file nobody prunes is a
 * file that eventually costs a hook its timeout to read. `wasDelivered` reads
 * the whole file, so the bound has to be on the file and not on the reader.
 *
 * The trim keeps the TAIL, which is the half the assertion asks about: a key
 * old enough to fall off the end belongs to a session that ended long ago.
 */
const MAX_ROWS = 5000;

function trim(file: string): void {
  try {
    const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '');
    if (lines.length <= MAX_ROWS) return;
    writeFileSync(file, `${lines.slice(-MAX_ROWS).join('\n')}\n`, 'utf8');
  } catch { /* a trim that fails costs disk, never a delivery */ }
}

/**
 * Append one row. Returns whether it was written — the caller discloses, this
 * module does not, because only the caller knows which channel a person is
 * watching.
 *
 * **A delivery that carried NOTHING is still recorded**, and this is the same
 * ruling `core/inject.ts` makes for the subagent completion record: if an
 * empty delivery wrote no row, a store with nothing applicable and a hook
 * killed mid-render would leave the IDENTICAL evidence — no row — and the
 * assertion below would report a missed door for a door that ran perfectly.
 * The row is about the DOOR, not about the payload.
 */
export function recordDelivery(root: string, record: Omit<DeliveryRecord, 'at'> & { at?: string }): boolean {
  try {
    ensureDir(root);
    const file = filePath(root);
    const row: DeliveryRecord = { at: record.at ?? new Date().toISOString(), ...record };
    appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
    trim(file);
    return true;
  } catch {
    return false;
  }
}

/** Every row for `key`, oldest first. An unreadable file is an empty answer. */
export function deliveries(root: string, key: string): DeliveryRecord[] {
  try {
    const rows: DeliveryRecord[] = [];
    for (const line of readFileSync(filePath(root), 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      try {
        const row = JSON.parse(line) as DeliveryRecord;
        if (row.key === key) rows.push(row);
      } catch { /* one damaged line is not the whole file */ }
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * Has a door delivered to `key`?
 *
 * `false` for an unreadable file, deliberately: the answer the assertion
 * gives on that is "report it", and reporting a delivery nobody can find is
 * the correct reading of a record that cannot be read.
 */
export function wasDelivered(root: string, key: string): boolean {
  return deliveries(root, key).some((row) => row.kind === 'delivered');
}

/**
 * **The assertion.** Returns the sentence to disclose, or `''`.
 *
 * Called from a hook that runs LATER than any door — `hooks/pre-tool-use.ts`
 * at the first tool call of a session or a subagent, and `hooks/pre-compact.ts`
 * at the last moment before a window is rebuilt. Those two between them cover
 * both shapes of key: a subagent that never compacts is caught at its first
 * tool call, and a session whose every tool call was a `Bash` — which the
 * PreToolUse matcher does not fire for — is caught at its compaction.
 *
 * **It latches on the `missed` row it writes, so it speaks once per key.** A
 * line on every tool call is a line nobody reads, which would cost exactly
 * the sessions it exists for; and the row is also the COUNT spec §8.2 asks
 * for — `missed` rows over `delivered` rows is the number that turns "the
 * store is always present" from a claim into a measurement. Writing the row
 * before returning the sentence is deliberate for the reason
 * `hooks/subagent-start.ts` writes its attempt record first: a process killed
 * after the disclosure and before the row would leave a person told and a log
 * that disagrees with them.
 */
export function assertDelivered(
  root: string, key: string, applicable: () => number, at?: string,
): string {
  const rows = deliveries(root, key);
  if (rows.some((row) => row.kind === 'delivered')) return '';
  // Already reported for this key: the latch. Not a second sentence, and not
  // a second row — a `missed` count that grew per tool call would measure
  // tool calls rather than doors.
  if (rows.some((row) => row.kind === 'missed')) return '';

  /**
   * **The count is taken LAST, and lazily, and both halves matter.**
   *
   * Last, because the two checks above are two reads of one small file and
   * this one parses a directory of Markdown — on a hook that fires at every
   * tool call. Lazily, so that a key which has already been answered never
   * pays for it at all: past the latch, the store is read at most once per
   * key, ever.
   */
  const count = applicable();
  recordDelivery(root, {
    ...(at === undefined ? {} : { at }),
    kind: 'missed',
    key,
    door: key.includes('::') ? 'subagent-start' : 'session-start',
    entries: 0,
    note: `no delivery row for this key at the moment the assertion ran; ` +
      `${count} constant(s) would have applied`,
  });
  /**
   * **A miss with nothing to miss is RECORDED and not REPORTED, and this is a
   * measurement talking.**
   *
   * The row is written either way: "no door ran for this key" is the fact
   * spec §8.2 asks to be countable, and it is true whatever the store held.
   * The SENTENCE is withheld when the applicable set is empty, because a
   * sentence saying a reader may be missing the constants — when there were
   * none for them to miss — is a check crying wolf, and this one has to be
   * believed the day it fires.
   *
   * It is not hypothetical. The first draft reported unconditionally and
   * reddened `pre-tool-use emits the deny envelope for a write into the
   * managed directory`, which asserts the hook's stderr is EMPTY, in a
   * sandbox where the shipped store's only entry is `developer` tier and
   * therefore applies to nothing. Every sandbox in the suite is in that
   * state, and so is every stranger's install until the store carries its
   * first `product` entry.
   */
  return count === 0 ? '' : missedDoorLine(key);
}

/**
 * What a missed door costs, said in the terms the reader can act on.
 *
 * It names the KEY rather than paraphrasing it, because the key is what makes
 * the row findable, and it says what is NOT true rather than what might be:
 * nothing here knows whether the constants reached the model by some other
 * route, and claiming they did not would be the same unmeasured claim this
 * mechanism exists to replace.
 */
export function missedDoorLine(key: string): string {
  return 'my_context: this session has no record of the product rule store being delivered to ' +
    `it (key \`${key}\`). Every door that starts an agent — session start, including resume and ` +
    'compact-restore, and subagent start — records one, so a key with none means a door did not ' +
    'run or could not write. The constants may still be absent from this context window; ' +
    'nothing can inspect a context window, which is why the record exists. Run ' +
    '`mycontext rules list` to read them, and `mycontext rules verify` if you suspect the store ' +
    'itself. Nothing was blocked.\n';
}
