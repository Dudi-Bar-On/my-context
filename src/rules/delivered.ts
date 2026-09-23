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
 *
 * ── A TEST'S ROW IS A REAL ROW, AND IT IS NOT A PRODUCTION ROW ─────────────
 *
 * `TASK-more-than-half-the-delivery-log-is-tests-and-the-file-has-no`,
 * measured 2026-09-13. Spec §8.2 defines a COUNT over `delivered.jsonl`, and
 * in this repository 157 of its 278 rows had been written by the test suite:
 * 105 under keys a test spelled `test::…`, 51 under the synthetic session
 * `lane-still-gets-the-no-git-rule::proof`, one under `eyeball::x`. The count
 * spec §8.2 exists to produce was more than half fiction — and those same
 * three synthetic keys were the ONLY three rows in the file that failed to
 * join against the audit log, so they corrupted the join as well as the count.
 *
 * **The delivery is not the problem and must not be touched.**
 * `test/rules/lane-still-gets-the-no-git-rule.test.ts` runs the real door
 * against the real store in the ONE directory where the developer tier is in
 * force (`deliver.ts` · `workspaceIsMyContext`), and that is the only proof
 * that a dispatched lane actually receives the `hard` no-git prohibition. What
 * had to stop was the RECORD. So the record forks and the delivery does not.
 *
 * **The fork is decided by the RECORDER, from a signal a test cannot forget to
 * send.** `NODE_TEST_CONTEXT` is set by Node's own test runner in every test
 * file's child process (`child-v8` on Node 24) and is inherited by every
 * process a test spawns — including this suite's own hook binaries, which
 * `test/rules/delivery.test.ts` starts through `spawnSync` with
 * `{ ...process.env }`. A row is therefore marked test-written by the FACT of
 * being written inside a test, never by the spelling of a key somebody chose.
 * The previous state of this file is the argument: the `test::` prefix was
 * already there on 105 rows and 52 further test rows carried no prefix at all,
 * because a convention a person has to remember is a convention half the
 * callers forget. `test/helpers/pin-rendering.ts` reaches the same conclusion
 * about the real home directory in its own words — *"The two pins above are
 * conventions — a person has to know to write them"* — and turns the property
 * into a check rather than a habit.
 *
 * **A SECOND FILE rather than a flag every reader filters out.** `deliver.ts`
 * states this project's doctrine in its own header, about `request`: a filter
 * is *"a list somebody can forget to extend"*, and structural absence is what
 * it uses instead. A `test: true` field would leave the production count one
 * forgotten `.filter()` away from being wrong again, and would oblige every
 * future reader — including one written by somebody who never heard of this
 * decision — to know about it. A sibling `delivered.test.jsonl` makes
 * `delivered.jsonl` mean what spec §8.2 says with no reader doing anything at
 * all. Nothing is lost: the rows are still written, still complete, still
 * timestamped, one file over.
 *
 * **The routing is symmetric, and that is what keeps the suite honest.**
 * `deliveredFile` is the ONE place the name is decided, so `recordDelivery`,
 * `deliveries`, `wasDelivered` and `assertDelivered` all take the same fork:
 * inside a test process a write and the read that asserts it land on the same
 * file, outside one they land on the production file. A test that wrote to the
 * sibling and read from the production log would prove nothing, and a reader
 * routed by a different rule from the writer would be the second answer this
 * module has spent its whole header refusing.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
 * **Where a row written inside a test goes instead** — the header section
 * *"A TEST'S ROW IS A REAL ROW"* carries the argument and the measurement.
 *
 * Beside the production log rather than under `tmpdir()`, deliberately: these
 * rows record a real door really running, they are the evidence when a test
 * and the product disagree, and a reader who opens `.rules/` should be able to
 * see both halves of what this mechanism wrote. The directory already carries
 * its own `*` .gitignore (`ensureDir`), so neither file is ever staged.
 */
export const DELIVERED_TEST_FILE = 'delivered.test.jsonl';

/**
 * **Is this process a test?** The whole convention, in one predicate, and the
 * reason it is a predicate and not a parameter: a parameter is something a
 * caller passes, and every caller that forgets it writes a production row that
 * is a lie. Node's test runner sets `NODE_TEST_CONTEXT` in each test file's
 * child process and the value is inherited by anything that child spawns, so
 * no test can opt out of being marked and no hook Claude Code runs can be
 * marked by accident.
 *
 * **What it does NOT cover, said out loud:** a harness that is not Node's test
 * runner — the Playwright suite under `e2e/`, or a person running a probe by
 * hand, which is what this file's one `eyeball::x` row was. Neither has ever
 * written into this repository's production log (all 157 polluting rows
 * measured on 2026-09-13 were `node --test` rows but for that single
 * hand-run probe), but if one ever starts a real door against a real
 * workspace, the fix belongs HERE, in the one predicate — not in a key its
 * caller has to remember to spell a particular way.
 */
export function isTestProcess(): boolean {
  return process.env.NODE_TEST_CONTEXT !== undefined;
}

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

/**
 * The file this process reads and writes — the production log, or the sibling
 * that holds what the test suite wrote.
 *
 * Exported because the tests that assert on this file's BYTES have to ask the
 * same question the recorder asked. A test that rebuilt the path out of
 * `DELIVERED_FILE` by hand would be a second answer to *"which file"*, and the
 * first thing it would be wrong about is itself.
 */
export function deliveredFile(root: string): string {
  return path.join(root, DELIVERED_DIR, isTestProcess() ? DELIVERED_TEST_FILE : DELIVERED_FILE);
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
  markPrivate(dir);
  return dir;
}

/**
 * **THE 2026-09-23 INCIDENT, ASKED HERE INSTEAD OF IMPORTED.**
 *
 * A repository's own root `.gitignore` — 73 lines, tracked — was found
 * truncated to the two bytes `*` and a newline, which is what this product
 * writes into the private directories it creates. `core/private-gitignore.ts`
 * is the authority on that line and it carries four refusals: a relative
 * target (it resolves against a working directory nobody chose), a directory
 * that is not one of this product's own, a directory holding a `.git` (never
 * private state, and the one that catches a private NAME that is a link onto
 * a repository), and a `.gitignore` that already carries rules (somebody's
 * file). It discloses every refusal on stderr rather than returning quietly,
 * because `INV-nothing-is-dropped-silently` applies to a marker as much as to
 * a record.
 *
 * **THE STORE MAY NOT IMPORT IT, AND THIS IS THE DUPLICATION THAT BUYS.**
 * D41 spec §7 gives `src/rules/` exactly one edge into `src/core/` — the
 * frontmatter parser — and `test/rules/isolation.test.ts` fails the moment
 * that widens; weakening that assertion to save nineteen lines would trade a
 * governed architectural boundary for a copy this file can keep honest. So
 * all four questions are asked here, in the authority's own order and in its
 * own sentence shape, and `test/core/private-gitignore.test.ts`'s
 * *"a rule store directory is guarded too"* drives them rather than taking
 * this comment on trust.
 *
 * The one narrowing: refusal 2 asks for `DELIVERED_DIR` by name rather than
 * generalising about which directory names are private, because this site
 * builds its own path out of that constant three lines above.
 *
 * Never throws — a marker this could not write must never cost a caller the
 * delivery row it was appending.
 */
function markPrivate(dir: string): void {
  const refuse = (sentence: string): void => {
    try {
      process.stderr.write(
        `my_context: refused to write a \`*\` .gitignore into ${dir} — ${sentence}\n`,
      );
    } catch { /* a lost line is not a lost record */ }
  };
  try {
    if (dir === '' || !path.isAbsolute(dir)) {
      refuse('a relative target resolves against the working directory rather than a corpus, '
        + 'which on 2026-09-23 was a repository root.');
      return;
    }
    if (path.basename(dir) !== DELIVERED_DIR) {
      refuse(`its name is not \`${DELIVERED_DIR}\`, so it is not the directory this log `
        + 'creates for itself.');
      return;
    }
    if (existsSync(path.join(dir, '.git'))) {
      refuse('it holds a `.git`, so it is the root of somebody\'s repository and never this '
        + 'product\'s private state.');
      return;
    }
    const marker = path.join(dir, '.gitignore');
    let existing = '';
    try {
      existing = readFileSync(marker, 'utf8');
    } catch (err) {
      // ENOENT is the ordinary first write. Anything else is a file that IS
      // there and was not read, and overwriting what cannot be read is the
      // exact act these refusals exist to prevent.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        refuse(`its .gitignore exists and could not be read (${
          err instanceof Error ? err.message : String(err)}), so nothing was overwritten.`);
        return;
      }
    }
    if (existing.trim() !== '' && existing.trim() !== '*') {
      refuse('its .gitignore already carries rules, so it is somebody\'s file and not the '
        + 'one-line marker this product writes.');
      return;
    }
    writeFileSync(marker, '*\n', 'utf8');
  } catch (err) {
    refuse(`the write failed (${err instanceof Error ? err.message : String(err)}).`);
  }
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
    const file = deliveredFile(root);
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
    for (const line of readFileSync(deliveredFile(root), 'utf8').split('\n')) {
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
/**
 * **What the applicable-count callback hands back, and why it is not a bare
 * number any more** — `TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody`.
 *
 * It was `() => number`, and `assertDoor`'s implementation of it answered `0`
 * for a store it could not read at all — so the `missed` row below recorded
 * *"0 constant(s) would have applied"*: a measurement nobody took, written
 * into the log spec §8.2 counts, in the one shape that reads as an assurance.
 * `STD-a-measured-zero-is-drawn-and-named` is explicit that a measured zero
 * and an unmeasured one are different facts, and this is the write path
 * version of it.
 *
 * `unreadable` carries the reason instead. It changes NOTHING about what the
 * assertion does — the row is still written, the sentence is still withheld
 * (see the argument below), the hook still cannot fail on a store fault — and
 * only what the row SAYS.
 */
export interface ApplicableCount {
  /**
   * Constants that would have applied. **Not a measurement when `unreadable`
   * is set** — the caller could not count, and `0` there means uncounted.
   */
  count: number;
  /** Why the store could not be counted at all, or `''` when it was read. */
  unreadable: string;
}

/**
 * **What an assertion answers, and why it is two fields rather than a
 * sentence** — `TASK-d70-closed-all-five-instances-and-never-built-the-gate-the`.
 *
 * `assertDelivered` returned only `text`, under a docblock on `recordDelivery`
 * that says in as many words *"the caller discloses, this module does not"* —
 * while this module dropped the one thing there was to disclose. `recorded`
 * is that half, travelling to the caller the docblock names.
 *
 * **`recorded` is `true` whenever no row was owed.** Both latches above return
 * before any write, so nothing was lost and nothing is claimed: `false` means
 * a `missed` row was attempted and refused, and nothing weaker.
 */
export interface DoorAssertion {
  /** The sentence to disclose, or `''` — `assertDelivered`'s old return value. */
  text: string;
  /** `false` only when the `missed` row this call tried to write was refused. */
  recorded: boolean;
}

export function assertDelivered(
  root: string, key: string, applicable: () => ApplicableCount, at?: string,
): DoorAssertion {
  const rows = deliveries(root, key);
  if (rows.some((row) => row.kind === 'delivered')) return { text: '', recorded: true };
  // Already reported for this key: the latch. Not a second sentence, and not
  // a second row — a `missed` count that grew per tool call would measure
  // tool calls rather than doors.
  if (rows.some((row) => row.kind === 'missed')) return { text: '', recorded: true };

  /**
   * **The count is taken LAST, and lazily, and both halves matter.**
   *
   * Last, because the two checks above are two reads of one small file and
   * this one parses a directory of Markdown — on a hook that fires at every
   * tool call. Lazily, so that a key which has already been answered never
   * pays for it at all: past the latch, the store is read at most once per
   * key, ever.
   */
  const { count, unreadable } = applicable();
  // **`recordDelivery`'s answer is READ, and this module's own docblock is the
  // reason it now has to be.** That function says *"the caller discloses, this
  // module does not, because only the caller knows which channel a person is
  // watching"* — and for as long as this line was a bare statement, this
  // module WAS the caller and disclosed nothing, so the sentence was a
  // promise made on somebody else's behalf.
  //
  // What a refused write costs is specific and is not the delivered row's
  // cost: the latch eleven lines above IS this row, so an assertion that
  // could not write it re-asserts on the next tool call for the rest of the
  // session, and spec §8.2's count — `missed` rows over `delivered` rows, the
  // number that turns *"the store is always present"* into a measurement — is
  // a floor rather than a figure. `unrecordedMissLine` says exactly that, and
  // deliberately not `unrecordedDeliveryLine`, which asserts a delivery that
  // did not happen here.
  const recorded = recordDelivery(root, {
    ...(at === undefined ? {} : { at }),
    kind: 'missed',
    key,
    door: key.includes('::') ? 'subagent-start' : 'session-start',
    entries: 0,
    // **"I counted none" and "I could not count" are two sentences here, and
    // they used to be one.** See `ApplicableCount`: a store that could not be
    // read answered `0`, and this row then asserted a zero nobody measured.
    note: `no delivery row for this key at the moment the assertion ran; ` +
      (unreadable === ''
        ? `${count} constant(s) would have applied`
        : `the product rule store could not be read, so how many constant(s) would have ` +
          `applied is UNMEASURED rather than zero — ${unreadable}`),
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
  return { text: count === 0 ? '' : missedDoorLine(key), recorded };
}

/**
 * **The door ran and the RECORD did not** — the disclosure `recordDelivery`'s
 * own contract asks its callers for: *"Returns whether it was written — the
 * caller discloses, this module does not, because only the caller knows which
 * channel a person is watching."*
 *
 * For nine days both doors ended `}).text;` and no consumer of `.recorded`
 * existed anywhere in `src/`
 * (`TASK-deliveratdoor-returns-whether-it-recorded-the-delivery-and`). The
 * cost is a CONTRADICTION the product prints at itself: the constants were
 * delivered, nothing said the record of that failed, and later in the same
 * session `assertDoor` tells the reader *"this session has no record of the
 * product rule store being delivered to it"* — a sentence that is true about
 * the log and false about the session.
 *
 * **So this line says the half `missedDoorLine` cannot know**: the delivery
 * HAPPENED, it is the writing-down that failed, and the missed-door sentence
 * that follows later is therefore expected rather than evidence of a door that
 * did not run.
 *
 * **stderr, and not the block.** The model already has the constants — there
 * is nothing to tell it — and the person watching the session is the only one
 * who can do anything about a directory that will not take a write.
 * `session-start.ts` · `noWorkspaceLine` is the precedent for the channel.
 */
export function unrecordedDeliveryLine(door: Door, key: string | null): string {
  return 'my_context: the product rule store WAS delivered at this ' + door +
    ` door (key \`${key ?? '<no session id>'}\`) and the record of it could not be written to ` +
    `\`${DELIVERED_DIR}/\`. Nothing is missing from this session's context — what is missing is ` +
    'the evidence. A later hook may report that this session has no record of the store being ' +
    'delivered to it; that report will be about this failed write, not about a door that did ' +
    `not run. Check that \`${DELIVERED_DIR}/\` is writable. Nothing was blocked.\n`;
}

/**
 * **The ASSERTION's row did not land**, which is the other half of the same
 * write failure and is not the same sentence.
 *
 * `unrecordedDeliveryLine` above opens *"the product rule store WAS delivered
 * at this door"*. At this site nothing of the kind is known — the assertion
 * fires precisely because no `delivered` row exists for the key — so reusing
 * that wording would tell a reader their session holds constants nobody can
 * show it was given. One fault, two facts, and the project's rule about a
 * second copy applies to sentences as much as to rules: the wording is spelled
 * once, here, rather than softened out of the neighbouring one.
 *
 * **What is actually lost is the LATCH and the COUNT.** `assertDelivered`
 * latches on the `missed` row it writes, so an assertion that could not write
 * one has no memory: it re-asserts at the next tool call, and the next, for
 * the rest of the session. And spec §8.2 counts those rows — *"what is
 * verifiable is that we injected at every door and none was missed"* — so a
 * refused write leaves that count a floor, in the direction that flatters.
 *
 * **It repeats, and that is the disclosure being honest about itself.** Every
 * other line in this area speaks once because a row latches it; the row is
 * what failed here, so there is nothing to latch on, and a line that fell
 * silent after the first firing would be claiming a durability it has not
 * got. The repetition stops when the directory takes a write.
 *
 * **stderr, and the person.** `unrecordedDeliveryLine`'s channel argument
 * holds unchanged: the model can do nothing about a directory that will not
 * take a write, and `hooks/pre-compact.ts` — which rules out stderr for its
 * own event — carries this in the audit row it was already writing instead.
 */
export function unrecordedMissLine(key: string): string {
  return 'my_context: the row recording that NO door delivered the product rule store to this ' +
    `session (key \`${key}\`) could NOT be written to \`${DELIVERED_DIR}/\`. Two consequences: ` +
    'this check latches on that row, so with none written it will say this again on every tool ' +
    'call until the directory is writable; and the count of missed doors against delivered ' +
    'ones — the measurement behind "the store is always present" — is a floor rather than a ' +
    'figure. Nothing was blocked and nothing else changed.\n';
}

/**
 * What a missed door costs, said in the terms the reader can act on.
 *
 * It names the KEY rather than paraphrasing it, because the key is what makes
 * the row findable, and it says what is NOT true rather than what might be:
 * nothing here knows whether the constants reached the model by some other
 * route, and claiming they did not would be the same unmeasured claim this
 * mechanism exists to replace.
 *
 * **BOTH SURFACES ARE NAMED, and that is `mcpsurface/1`'s second half.** This
 * sentence is written FOR A MODEL — it fires precisely when a door did not
 * hand the constants over — and until 2026-09-14 the only route it offered was
 * two terminal commands. An agent whose Bash tool is denied could follow
 * neither, so the product's own advice for *"find out what you were given"*
 * pointed at a door that surface does not have. `list_rules` and
 * `verify_rules` (`src/mcp/tools.ts`) are that door, and the reader is told
 * about the one it can actually use by being told about both. The terminal
 * commands stay, in the same sentence and unchanged in meaning, because the
 * other reader of this line is the person watching the session, and the
 * substitution disclosure both surfaces print is the same either way.
 */
export function missedDoorLine(key: string): string {
  return 'my_context: this session has no record of the product rule store being delivered to ' +
    `it (key \`${key}\`). Every door that starts an agent — session start, including resume and ` +
    'compact-restore, and subagent start — records one, so a key with none means a door did not ' +
    'run or could not write. The constants may still be absent from this context window; ' +
    'nothing can inspect a context window, which is why the record exists. Read them with the ' +
    '`list_rules` MCP tool, or `mycontext rules list` in a terminal; if you suspect the store ' +
    'itself, `verify_rules` or `mycontext rules verify`. Nothing was blocked.\n';
}
