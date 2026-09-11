#!/usr/bin/env node
/**
 * **The migration: rules that already govern this project MOVE into the product
 * rule store, once, and there is a way back until that is proven.**
 *
 * D41 spec §15, `plan:store seq:4` Task 16. The owner's ruling is this file's
 * whole shape: *"it should happen only once when we have the store as
 * production grade and not before, so we could be sure it will not mess our
 * corpus and project; it should be done carefully and tested that the
 * migration process is correct, and if not it should be reversible until what
 * is required is fixed."*
 *
 * ── THIS FILE IS A PLAN, NOT A SECOND COPY ─────────────────────────────────
 *
 * `CANDIDATES` names an entry, its kind, its tier, and the corpus item it
 * MOVES. For a candidate that has a source item, **the entry's body is the
 * item's own body, verbatim, at apply time** — nothing is retyped here, so
 * there is no second copy of a rule in this repository waiting to drift. Only
 * the template PARTS are written here, because a `prohibition` needs a `why`
 * and a `fact` needs a `breaks`, and those are shapes the item never had.
 *
 * Five candidates carry `from: null`. Those are product facts that **no corpus
 * item holds today** — they live in code comments and in the bodies of defect
 * tasks — so for them this is authoring rather than migration, and the plan
 * says so in its own output rather than letting the two look alike.
 *
 * ── THE THREE GATES, AND WHY EACH REFUSES RATHER THAN WARNS ────────────────
 *
 * 1. **A PINNED source item refuses the whole plan.** Retiring an `always:
 *    true` rule takes it out of every future session. That is the owner's
 *    decision and there is no version of it an agent should take quietly;
 *    `--allow-pinned` exists so that HIS run can proceed, and this script's
 *    default is to stop and print the list.
 * 2. **An entry NARROWER than the item it would retire refuses.** *"Run both
 *    browser projects"* is one clause of a rule that also says the page must
 *    run, every screen must render, both languages must round-trip and the
 *    print stylesheet must not be blank. Retiring the item by the clause would
 *    lose the rest, which is the loss `AN ENTRY LIVES IN EXACTLY ONE PLACE`
 *    exists to prevent — one place, not one sentence.
 * 3. **A MISSING source item refuses.** A candidate naming an item nobody can
 *    find is either a typo or a rule already retired, and quietly authoring
 *    the entry anyway would produce exactly the duplicate this is here to
 *    avoid.
 *
 * And a fourth gate that is not this file's: `supersedeItem` refuses a
 * non-human caller retiring a governing normative item. **An agent cannot
 * perform this migration**, whatever it passes here.
 *
 * ── THE WAY BACK ───────────────────────────────────────────────────────────
 *
 * `apply` writes a LEDGER (`.my_context/.rules/migration.json`) recording, for
 * every file it is about to change, the bytes that were there. `revert` writes
 * those bytes back, removes the entries it created, restores the store's
 * manifest, and rebuilds the index from disk — because the Markdown is the
 * source of truth and an index left describing the migrated state would make
 * the corpus and its own index disagree.
 *
 * It refuses to revert a file that has changed since the migration. A way back
 * that silently discards somebody's later edit is not a way back.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { rebuild } from '../src/core/rebuild.ts';
import { createItem, supersedeItem, type MutationContext } from '../src/core/mutate.ts';
import type { Origin } from '../src/core/types.ts';
import { composeEntry, type Kind, type Tier } from '../src/rules/schema.ts';
import { DELIVERED_DIR } from '../src/rules/delivered.ts';
import { readManifest, writeEntry, writeManifest } from '../src/rules/manifest.ts';

export interface Candidate {
  /** The entry's id, and the stem of its file. */
  entryId: string;
  kind: Kind;
  tier: Tier;
  title: string;
  /** The corpus item this MOVES, or `null` when nothing in the corpus holds it. */
  from: string | null;
  /**
   * An item that is BROADER than this entry and therefore must not be retired
   * by it. Set this and the candidate refuses: the entry may still be written
   * one day, but not as a retirement of that item.
   */
  broader?: string;
  /** The template's parts for this kind, plus `example` and `check`. */
  parts: Record<string, string | string[]>;
  /** Authored prose. Used only when `from` is `null`; otherwise the item's body. */
  body?: string;
}

export type RowState =
  /** A source item exists, is not pinned, and the entry is not narrower. */
  | 'ready'
  /** No corpus item holds this; writing it is authoring, not migration. */
  | 'authored'
  /** `from` names an item that is not in this corpus. */
  | 'missing'
  /** The source item is `always: true`. The owner's call, never a lane's. */
  | 'pinned'
  /** The entry says less than the item it would retire. */
  | 'narrows'
  /** The source item is already retired — this migration has run. */
  | 'already';

export interface Row {
  candidate: Candidate;
  state: RowState;
  /** One sentence naming what this row is and what it is waiting on. */
  detail: string;
}

export interface MigrationPlan {
  rows: Row[];
  /** `null` when every row may proceed; the refusal sentence otherwise. */
  refusal: string | null;
}

/** What `apply` recorded so that `revert` can put it back. */
interface LedgerFile {
  /** Absolute path. */
  file: string;
  /** The bytes before the migration, or `null` when the file did not exist. */
  before: string | null;
  /** The bytes the migration left, so a later edit can be detected. */
  after: string;
}

interface Ledger {
  at: string;
  /** The corpus items created as the retirees' successors. */
  pointers: string[];
  entryIds: string[];
  itemIds: string[];
  files: LedgerFile[];
}

/**
 * Where the way back lives: beside the store's own delivery record, under
 * `.my_context/.rules/`, and COMMITTED rather than ignored — a ledger that did
 * not survive a clone would make the migration irreversible for everybody but
 * the machine that ran it.
 */
export function ledgerPath(root: string): string {
  return path.join(root, DELIVERED_DIR, 'migration.json');
}

function read(file: string): string | null {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

/** Classify one candidate against the corpus as it stands. */
function classify(ctx: MutationContext, candidate: Candidate): Row {
  if (candidate.from === null) {
    return {
      candidate,
      state: 'authored',
      detail: 'no corpus item holds this rule today, so writing it is AUTHORING rather than '
        + 'migration. Nothing is retired, and nothing is therefore reversible by retirement — '
        + `which is why ${candidate.tier === 'product' ? 'a product-tier' : 'a developer-tier'} `
        + 'entry authored here is a new rule and is the owner\'s to approve.',
    };
  }
  const item = ctx.store.get(candidate.from);
  if (item === null || item === undefined) {
    return {
      candidate,
      state: 'missing',
      detail: `${candidate.from} is not in this corpus. Authoring the entry anyway would produce `
        + 'the duplicate this migration exists to avoid, so it refuses instead.',
    };
  }
  if (item.status === 'superseded' || item.status === 'deprecated') {
    return {
      candidate,
      state: 'already',
      detail: `${candidate.from} is already "${item.status}". This migration has run.`,
    };
  }
  if (candidate.broader !== undefined) {
    return {
      candidate,
      state: 'narrows',
      // `always` is named here as well as in the `pinned` branch below, because
      // only one state can be returned and the owner reading this row must not
      // have to check the pin separately. A row that hid half its reason would
      // be the "fixed in one place, live in the next" gap in a report.
      detail: `the entry says less than ${candidate.broader}, which it would retire. One place is `
        + 'not one sentence: retiring the item by a clause of it loses the rest.'
        + (item.always === true ? ' It is ALSO pinned (always: true).' : ''),
    };
  }
  if (item.always === true) {
    return {
      candidate,
      state: 'pinned',
      detail: `${candidate.from} is PINNED (always: true) and reaches every session. Retiring it `
        + 'takes it out of all of them, which is the owner\'s decision and not a lane\'s.',
    };
  }
  return {
    candidate,
    state: 'ready',
    detail: `${candidate.from} moves: the entry is written and the item is retired with a pointer, `
      + 'stood down in the same act.',
  };
}

const BLOCKING: readonly RowState[] = ['missing', 'pinned', 'narrows', 'already'];

export function planMigration(
  ctx: MutationContext, candidates: readonly Candidate[],
  options: { allowPinned?: boolean } = {},
): MigrationPlan {
  const rows = candidates.map((candidate) => classify(ctx, candidate));
  const blocked = rows.filter((row) => BLOCKING.includes(row.state)
    && !(row.state === 'pinned' && options.allowPinned === true));
  const refusal = blocked.length === 0
    ? null
    : `the migration is refused: ${blocked.length} of ${rows.length} candidate(s) cannot move. `
      + blocked.map((row) => `${row.candidate.entryId} [${row.state}] — ${row.detail}`).join(' ');
  return { rows, refusal };
}

export interface ApplyOptions {
  /** The store directory to write entries into. */
  storeDir: string;
  /**
   * Who is doing this. `supersedeItem` refuses anything but `'human'` for a
   * governing normative item, so this is not a formality — it is the gate.
   */
  origin: Origin;
  confirm: boolean;
  allowPinned?: boolean;
}

export interface ApplyResult {
  migrated: string[];
  authored: string[];
  /** One corpus item per migrated rule, naming where it went. */
  pointers: string[];
  ledger: string;
}

/**
 * **The pointer item, and why there is one PER ENTRY rather than one for the
 * whole migration.**
 *
 * `supersedeItem` retires an item BY another ITEM, and a store entry is not one
 * — the corpus has never heard of the store (spec §7) and giving it an
 * exception here would be the first leak. So the successor is a corpus item.
 *
 * One shared successor was the first shape and it is the wrong one: a reader
 * of a retired rule would land on a list of eleven entries and still have to
 * guess which one replaced the rule they were reading. **A pointer that needs
 * guessing is not a pointer.** One item per entry makes `superseded_by` name
 * exactly where the rule went, in one hop, and the cost is one small decision
 * item per migrated rule — which is the record of the move anyway.
 */
export function pointerIdFor(entryId: string): string {
  return `DEC-moved-${entryId}`;
}

function pointerItem(ctx: MutationContext, candidate: Candidate): string {
  const id = pointerIdFor(candidate.entryId);
  const existing = ctx.store.get(id);
  if (existing !== null && existing !== undefined) return id;
  createItem(ctx, {
    type: 'decision',
    id,
    title: `${candidate.title} — moved into the product rule store`,
    summary: 'This rule now lives in the tool itself rather than in this project\'s notes, and '
      + 'this record says where to read it.',
    body: [
      `This rule is no longer maintained in this corpus. It is now the product rule store entry`,
      `\`${candidate.entryId}\`, at \`src/rules/entries/${candidate.entryId}.md\`, which ships`,
      'inside the package and is delivered at every door an agent starts through.',
      '',
      `Read it with \`mycontext rules show ${candidate.entryId}\`.`,
      '',
      'It was retired here rather than copied, because a copy cannot be superseded and only the',
      'original can — the finding `CLAUDE.md` opens with, measured on 2026-09-07 when five',
      'superseded instructions were being acted on as current.',
    ].join('\n'),
    status: 'active',
    severity: 'soft',
    always: false,
    origin: 'human',
  });
  return id;
}

export function applyMigration(
  ctx: MutationContext, candidates: readonly Candidate[], options: ApplyOptions,
): ApplyResult {
  const plan = planMigration(ctx, candidates, { allowPinned: options.allowPinned });
  if (plan.refusal !== null) throw new Error(`my_context: ${plan.refusal}`);
  if (!options.confirm) {
    throw new Error('my_context: the migration is not confirmed. It retires corpus items and '
      + 'writes to the shipped store, and the owner ruled it happens ONCE — so it asks first.');
  }
  if (read(ledgerPath(ctx.root)) !== null) {
    throw new Error('my_context: a migration ledger is already on disk, so this migration has '
      + 'already run. Revert it before running it again — the ruling is that it happens once.');
  }

  const migrated: string[] = [];
  const authored: string[] = [];
  const itemIds: string[] = [];
  const pointers: string[] = [];

  /**
   * **Every file this call is about to change, with the bytes that were there
   * — recorded BEFORE the write and only once.**
   *
   * Once, because a file is touched more than once: the manifest moves on
   * every `writeEntry`, and the pointer item gains a `supersedes` relation per
   * retirement. A second recording would capture a state this migration had
   * already produced, and the way back would then stop halfway.
   */
  const touched = new Map<string, string | null>();
  const touch = (file: string): void => {
    if (!touched.has(file)) touched.set(file, read(file));
  };

  /** Undo whatever this call managed before it threw. */
  const unwind = (): void => {
    for (const [file, before] of touched) {
      if (before === null) rmSync(file, { force: true });
      else writeFileSync(file, before, 'utf8');
    }
    rebuild(ctx.store, { project: ctx.root }, ctx.config);
  };

  try {
    // Recorded before the first `writeEntry`, which rewrites it.
    touch(path.join(options.storeDir, 'manifest.json'));

    // The entries first, because an entry that fails to compose must not leave
    // a retired item with nowhere to point.
    for (const row of plan.rows) {
      const { candidate } = row;
      const item = candidate.from === null ? null : ctx.store.get(candidate.from);
      const body = candidate.from === null
        ? (candidate.body ?? '')
        // **The item's own body, verbatim.** Nothing is retyped, so the entry
        // carries the evidence that made the rule worth having rather than a
        // summary of it — and this file stays a plan rather than a second copy.
        : `${String(item?.body ?? '').trim()}\n\n*Moved from \`${candidate.from}\` on `
          + `${new Date().toISOString().slice(0, 10)}; that item is retired and points here.*`;
      const text = composeEntry({
        id: candidate.entryId,
        kind: candidate.kind,
        tier: candidate.tier,
        title: candidate.title,
        parts: candidate.parts,
        body,
      });
      touch(path.join(options.storeDir, `${candidate.entryId}.md`));
      writeEntry(options.storeDir, `${candidate.entryId}.md`, text);
      (candidate.from === null ? authored : migrated).push(candidate.entryId);
    }

    const moving = plan.rows.filter((r) => r.candidate.from !== null);
    for (const row of moving) {
      const from = row.candidate.from as string;
      const id = pointerIdFor(row.candidate.entryId);
      touch(path.join(ctx.root, 'items', 'decision', `${id}.md`));
      pointers.push(pointerItem(ctx, row.candidate));

      const item = ctx.store.get(from);
      // `Item.filePath` is relative to the corpus root; `resolve` leaves an
      // absolute one alone, so this is right whichever the store holds.
      touch(path.resolve(ctx.root, String(item?.filePath ?? '')));
      supersedeItem(ctx, {
        id: from,
        by: id,
        origin: options.origin,
        reason: `it moved into the product rule store as \`${row.candidate.entryId}\` — read it `
          + `with \`mycontext rules show ${row.candidate.entryId}\`. One copy, not two: a copy `
          + 'cannot be superseded and only the original can.',
      });
      itemIds.push(from);
    }
  } catch (err) {
    // **A half-applied migration is the one outcome worse than none.** The
    // refusal that brings us here is usually `supersedeItem`'s — a non-human
    // caller cannot retire a governing normative item — and leaving the entry
    // written would put the rule in two places, which is the exact defect.
    unwind();
    throw err;
  }

  const files: LedgerFile[] = [...touched].map(([file, before]) => ({
    file, before, after: read(file) ?? '',
  }));

  const ledger: Ledger = {
    at: new Date().toISOString(),
    pointers,
    entryIds: [...migrated, ...authored],
    itemIds,
    files,
  };
  const at = ledgerPath(ctx.root);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return { migrated, authored, pointers, ledger: at };
}

export interface RevertResult {
  restored: string[];
  removed: string[];
}

/**
 * **The way back, and `test/rules/migration.test.ts` takes it.**
 *
 * Every recorded file is compared against what the migration left BEFORE
 * anything is written. A file somebody has edited since is a file whose later
 * work this would destroy, and destroying work to undo a migration is worse
 * than the migration.
 */
export function revertMigration(
  ctx: MutationContext, options: { storeDir: string },
): RevertResult {
  const at = ledgerPath(ctx.root);
  const raw = read(at);
  if (raw === null) {
    throw new Error('my_context: there is no migration ledger, so no migration is recorded as '
      + 'having run. Nothing is reverted — guessing what to undo is how a way back destroys work.');
  }
  const ledger = JSON.parse(raw) as Ledger;

  const changed = ledger.files.filter((f) => (read(f.file) ?? '') !== f.after);
  if (changed.length > 0) {
    throw new Error('my_context: refusing to revert — '
      + `${changed.map((f) => path.basename(f.file)).join(', ')} has changed since the migration `
      + 'wrote it. Writing the recorded bytes back would discard that work. Settle it by hand, '
      + 'then remove the ledger.');
  }

  const restored: string[] = [];
  const removed: string[] = [];
  for (const entry of ledger.files) {
    if (entry.before === null) {
      rmSync(entry.file, { force: true });
      removed.push(path.basename(entry.file));
      continue;
    }
    writeFileSync(entry.file, entry.before, 'utf8');
    restored.push(path.basename(entry.file));
  }

  // A store whose manifest was created by this migration leaves no manifest at
  // all, which would make every later read report the install incomplete.
  if (!readdirSync(options.storeDir).includes('manifest.json')) writeManifest(options.storeDir);
  else readManifest(options.storeDir);

  // **The Markdown is the source of truth, so the index is re-derived rather
  // than patched.** An index still describing the migrated state would make
  // `list`, `ready` and the injection selector disagree with the files that
  // govern them, which is the one failure a way back must not leave behind.
  rebuild(ctx.store, { project: ctx.root }, ctx.config);

  rmSync(at, { force: true });
  return { restored, removed };
}

/**
 * **THE CANDIDATES**, spec §15, in the two groups it names.
 *
 * The five product candidates are facts about how the tool behaves and are
 * true for anyone who installs it. None of them is held by a corpus item
 * today, so each is marked `from: null` and its text is authored here — the
 * plan reports them as `authored` rather than `ready` precisely so that
 * "nothing was retired for this one" is visible instead of inferred.
 *
 * The six developer candidates are how THIS repository chose to work. Four of
 * them name a source item that is PINNED, and three of those items say more
 * than the entry does — so the plan refuses them twice over and the list goes
 * to the owner.
 */
export const CANDIDATES: readonly Candidate[] = [
  {
    entryId: 'a-body-stops-at-the-first-heading',
    kind: 'fact',
    tier: 'product',
    title: 'an item body stops at the first `##` heading',
    from: null,
    parts: {
      truth: 'when a body is read from a file, everything from the first `## ` heading onwards is '
        + 'a structured section — Relations, Observations — and is not part of the body. A body '
        + 'written with a `##` heading in it therefore does not round-trip whole.',
      breaks: 'the tail of a body is lost on the next write, with no error, and the write reports '
        + 'success. A reader who never re-reads the file never learns.',
      example: '`add --file` truncating a body at the first heading, and `repair` then performing '
        + 'the loss — the defect `TASK-add-file-truncates-a-body-at-the-first-heading-and-repair` '
        + 'records.',
      check: 'none - nothing refuses the write today; that is the open defect the task above '
        + 'names, and declaring a preventive check here would report enforcement that does not '
        + 'exist.',
    },
    body: 'True for anyone who installs the tool, which is why it is a product fact rather than a\n'
      + 'rule of this repository.',
  },
  {
    entryId: 'progress-is-not-a-declared-task-field',
    kind: 'fact',
    tier: 'product',
    title: '`progress` is not a declared field on a task',
    from: null,
    parts: {
      truth: 'a task declares `plan`, `seq` and `state` as extra fields. `progress` is not among '
        + 'them, so writing one stores a value nothing reads and no surface projects.',
      breaks: 'work looks tracked and is not. The field is accepted, the write succeeds, and '
        + '`ready` and the progress tables keep answering from `state`.',
      example: 'the progress tables are rebuilt from `state` every time, which is why a hand-'
        + 'maintained progress column goes stale the moment somebody stops maintaining it.',
      check: 'preventive:the category’s extraFields table is the only declaration of what a '
        + 'task carries, so an undeclared field is refused at the write path rather than stored.',
    },
    body: 'The shape of the mistake is general: a field nothing reads looks exactly like a field\n'
      + 'something reads, until somebody depends on it.',
  },
  {
    entryId: 'a-retired-item-still-exists',
    kind: 'fact',
    tier: 'product',
    title: 'a retired item still exists, and is still readable',
    from: null,
    parts: {
      truth: 'retirement changes an item’s lifecycle fields and adds one relation. The body, '
        + 'the relations and the observations are untouched, the file stays on disk, and '
        + '`mycontext show` still prints it. What changes is that it is no longer selected for '
        + 'injection.',
      breaks: 'a reader who believes retirement deletes will either avoid retiring things that '
        + 'should be retired, or go looking for a copy to keep — and a copy cannot be superseded, '
        + 'which is the defect this whole store exists to end.',
      example: '`STD-answered-questions-are-superseded`: an answered question is superseded, never '
        + 'deleted and never left active.',
      check: 'preventive:src/core/mutate.ts supersedeItem removes no content - it moves the '
        + 'lifecycle fields, adds one relation, and writes an observation recording the '
        + 'stand-down.',
    },
    body: 'This is the fact that makes retirement safe to use, and the reason the corpus can afford\n'
      + 'to have one live copy of anything.',
  },
  {
    entryId: 'create-and-update-are-the-only-write-paths',
    kind: 'fact',
    tier: 'product',
    title: '`createItem` and `updateItem` are the only paths that write an item',
    from: null,
    parts: {
      truth: 'every door that changes an item — the CLI, the MCP tools, ingest, pack import, the '
        + 'web screens — arrives through `createItem` or `updateItem`. They regenerate the summary '
        + 'basis and recalculate the checksum; nothing else does.',
      breaks: 'an item edited by hand keeps a checksum computed from what it used to say, so '
        + '`doctor` reports it as a hand edit and the summary reads stale against a body it no '
        + 'longer describes.',
      example: 'the rule this repository states as "no hand edits to any `.my_context/items/**.md`" '
        + '— items change only through the CLI create/edit/supersede commands.',
      check: 'preventive:src/core/content-hash.ts recomputes the checksum and the summary basis on '
        + 'the write path, so a hand edit is detectable rather than invisible.',
    },
    body: 'The property that follows is the one worth remembering: a file that disagrees with its\n'
      + 'own checksum was not written by the product.',
  },
  {
    entryId: 'an-unknown-category-means-a-possible-wrong-corpus',
    kind: 'fact',
    tier: 'product',
    title: 'an unknown-category error may mean the wrong corpus, not a misspelled flag',
    from: 'RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus',
    parts: {
      truth: 'categories are per-corpus configuration, so a name valid in one corpus is invalid in '
        + 'another. The refusal names the accepted list and never names the corpus it consulted, '
        + 'so one message carries two meanings.',
      breaks: 'the flag gets respelled until something is accepted, against a corpus that was '
        + 'never the intended one — and the write lands somewhere nobody is looking.',
      example: 'check which `.my_context` answered before changing the spelling of the flag.',
      check: 'none - the refusal would have to name the corpus it consulted for this to be '
        + 'checkable, and it does not. That is a fix to the message rather than a check on the '
        + 'reader.',
    },
  },
  {
    entryId: 'never-a-git-command-that-writes-the-shared-tree',
    kind: 'prohibition',
    tier: 'developer',
    title: 'a lane runs no git command that writes the shared working tree',
    from: 'RULE-a-delegated-worker-runs-no-git-command-that-touches-the',
    parts: {
      prohibition: 'a lane runs no git command that writes, moves or discards: `stash`, `checkout`, '
        + '`reset`, `clean`, `restore`, `add`, `commit`, `merge`, `rebase`, and anything with '
        + '`force` in it. `git status`, `git diff` and `git log` are read-only and are fine.',
      why: 'lanes are dispatched in parallel and share ONE checkout. A git command that moves files '
        + 'does not know which changes belong to whom, so it is a whole-tree operation issued by '
        + 'someone holding a fraction of the tree — and the lane that fires it cannot see what it '
        + 'destroyed.',
      example: 'a lane ran `git stash` on 2026-09-05 while three other lanes were writing, and '
        + 'recovered its own files only by checking them out of the stash before the pop landed. '
        + 'The day before, a `git add -A` during a lane’s writes landed unrelated work under '
        + 'the wrong commit messages, and that had to be recorded in an empty commit because the '
        + 'history could not be untangled afterwards.',
      check: 'none - nothing gates what a lane types into a shell, and the archive records the '
        + 'command only when the lane reported it. The measurable half is weaker than the rule, so '
        + 'a detective check here would overstate what is enforced.',
    },
  },
  {
    entryId: 'commit-with-a-pathspec',
    kind: 'prohibition',
    tier: 'developer',
    title: 'the dispatching session commits by explicit path, never by the shared index',
    from: 'LESSON-stage-what-an-agent-reported-touching-not-what-you-told-it',
    parts: {
      prohibition: 'with a lane running, never `git commit` bare and never stage the whole index — '
        + 'use `git commit -- <paths>`, or read `git diff --cached` first and know what is in it.',
      why: 'the index is shared with every lane on the machine. A bare commit takes whatever is '
        + 'staged, including work a lane staged for a different subject, and the commit message '
        + 'then describes a change it does not contain.',
      example: 'a bare `git commit` on 2026-09-09 swept another lane’s staged work into a '
        + 'commit about a table border.',
      check: 'none - git offers no hook that can tell a deliberate pathspec from a lucky one, and '
        + 'the archive sees the command only when it was run in a tool call it recorded.',
    },
  },
  {
    entryId: 'one-lane-at-a-time-when-a-lane-drives-a-browser',
    kind: 'prohibition',
    tier: 'developer',
    title: 'only one lane at a time drives a browser',
    from: null,
    broader: 'RULE-parallel-agents-share-no-mutable-resource-enumerate-and',
    parts: {
      prohibition: 'at most one lane drives Playwright at a time. A second browser-driving lane '
        + 'waits; it is not dispatched in parallel "because the files are disjoint".',
      why: 'a browser is a mutable shared resource that file-level disjointness does not cover: '
        + 'memory and the owner’s machine are the contended thing, not the source tree.',
      example: 'three parallel Playwright lanes held 13.8 GB and made the owner’s mouse crawl.',
      check: 'none - nothing observes how many browsers are running at dispatch time. The nearest '
        + 'enforcement is the dispatching session’s own discipline, which is what this entry '
        + 'is for.',
    },
    body: 'This is a NARROWING of `RULE-parallel-agents-share-no-mutable-resource-enumerate-and`,\n'
      + 'which is broader and stays where it is: that rule says enumerate every shared mutable\n'
      + 'resource before dispatching, and this says what the answer already is for one of them.',
  },
  {
    entryId: 'prove-a-test-by-removal',
    kind: 'procedure',
    tier: 'developer',
    title: 'prove an assertion by removal, one mutation per assertion',
    from: 'RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it',
    parts: {
      steps: [
        'Break exactly the line the assertion rests on — revert it, flip the predicate, delete the guard.',
        'Run the one test file, and read which assertion went red BY THE FAILING STACK’S LINE NUMBER, not by the test’s name.',
        'Where an earlier assertion masks the target, neutralise that one too, and say so.',
        'Write the original bytes back. Never with git — a lane used `git checkout -- <file>` to undo a mutation on 2026-09-10 and destroyed its own phase’s work.',
        'Prove the restore is exact, and record the assertion, the line broken, and whether it went red.',
      ],
      proof: 'the recorded table names one line per assertion and the red is identified by line '
        + 'number. An assertion that stays GREEN is a finding, not a pass: it is reported and the '
        + 'assertion is replaced.',
      example: 'a test for a boot-order defect cleared cookies and asserted the page still '
        + 'rendered. It PASSED against a deliberately reverted `app.js`, because the token also '
        + 'lives in `sessionStorage` — committed as written it would have reported that defect '
        + 'fixed for ever.',
      check: 'none - the archive can see whether a lane REPORTED a removal-proof table; it cannot '
        + 'see whether the mutation was taken. The measurable half is the weaker half.',
    },
  },
  {
    entryId: 'run-both-browser-projects',
    kind: 'procedure',
    tier: 'developer',
    title: 'a browser proof runs both projects and reads Playwright’s own exit code',
    from: 'RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most',
    broader: 'RULE-playwright-is-how-the-ui-is-tested-and-it-is-the-most',
    parts: {
      steps: [
        'Run the suite for BOTH browser projects, not the one that is quicker.',
        'Redirect the output to a file and append the exit code separately.',
        'Read the exit code from the file, never through a pipe — `$?` through `tail` is `tail`’s.',
      ],
      proof: 'the recorded run names both projects and the suite’s own exit code, read from '
        + 'the file rather than from a pipeline.',
      example: 'a run with 88 failures reported exit 0 through `tail` on 2026-09-10.',
      check: 'preventive:scripts/e2e-gate.ts runs the suite the way the project runs it and returns '
        + 'the suite’s own status.',
    },
  },
  {
    entryId: '58888-is-the-owners-server',
    kind: 'fact',
    tier: 'developer',
    title: 'the UI server on 58888 is the owner’s and is running',
    from: 'RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the',
    broader: 'RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the',
    parts: {
      truth: 'port 58888 carries the owner’s own UI server. It is never killed, restarted, '
        + 'replaced, or bound to by anything else; whether it is up is verified in the process '
        + 'list, not assumed and not fixed by starting a second one.',
      breaks: 'the owner loses the screen he is reading, mid-read, and the loss is reported back '
        + 'to him as "the page is blank again" and investigated as a fresh defect.',
      example: 'a UI server started for the owner three separate times reaped itself on a '
        + 'fifteen-minute idle window before he opened the URL — every time.',
      check: 'none - nothing can stop a process from binding a port it can reach. What exists is '
        + 'the disclosure in every lane brief, which is a human gate on a machine problem and is '
        + 'named as one.',
    },
  },
];

function main(argv: string[]): number {
  throw new Error('my_context: `migrate-rules` has no standalone run yet. It retires corpus items, '
    + 'and the owner ruled the migration happens ONCE, only when the store is production grade. '
    + `Call planMigration/applyMigration from a session that can answer for it. (argv: ${argv.join(' ')})`);
}

if (import.meta.filename === process.argv[1]) process.exit(main(process.argv.slice(2)));
