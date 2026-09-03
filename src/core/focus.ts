import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { recordAudit, type AuditWriteResult } from './audit.ts';
import type { Item, Origin } from './types.ts';
import { ORIGINS } from './validate.ts';

// --- Session focus ----------------------------------------------------------
//
// `REQ-session-focus-controls-what-loads` is a `hard` requirement in this
// project's own corpus. This module is the state it needs; `core/select.ts`
// applies it, because "what gets injected" has exactly one answer and focus is
// a filter INSIDE that answer rather than a second path to it.
//
// **The decision it implements (plan decision Q2): focus discloses and
// allows.** It hides exactly what it was asked to hide and reports the cost —
// how many items are hidden, and how many load-bearing relations that leaves
// dangling. It never refuses a hide because something visible points at the
// item being hidden. The rejected alternative was refusing: focus would then
// get weaker the more connected the corpus is, and "why is this still here"
// becomes the question a user cannot answer.
//
// **What focus is scoped to: the WORKSPACE, not the session, and that is a
// deviation from this requirement's own `[decision]` observation, made on
// measured grounds rather than preference.** That observation asks for
// `.my_context/state/<session_id>.focus.json`. No surface that can SET a focus
// has a trustworthy session id: the CLI runs in a terminal and is handed none,
// and the MCP server's `CLAUDE_CODE_SESSION_ID` does not match the id the hooks
// receive on a resumed session — measured in this repository, and documented at
// length in `core/inject.ts`. A session-keyed file would therefore be written
// under a key the hooks never read, so focus would appear to work and change
// nothing. One file per workspace is the shape that can actually be both
// written and read.
//
// The cost of that choice is the one the requirement warns about: a focus
// outlives the session that set it, so it can surprise. Three things pay for
// it, and all three are load-bearing rather than decorative:
//
//  1. Every injection under an active focus says so, in the injected block —
//     a forgotten focus announces itself at the next session start, which is
//     exactly the moment a person can act on it.
//  2. `mycontext focus --show` and `doctor`'s `focus_active` check both report
//     it, so it is discoverable without waiting for a session.
//  3. `mycontext focus --clear` is one command, and the injected note names it.
//
// **It lives under `state/`, which is gitignored generated state, so a focus is
// local to one machine and never travels with the corpus.** That is right for
// a temporary narrowing: `config.json` is per-project and committed, and a
// focus that landed in a teammate's checkout would silently narrow THEIR
// injection.

export const FOCUS_PROTOCOL = 'my_context/focus@1';

/**
 * The axes v1 narrows on: `tags`, `categories` and `scope`.
 *
 * These three and no more, deliberately. They are the axes that already exist
 * and that a person already thinks in — `ROADMAP` D4.2 names the same three —
 * and every additional axis costs the disclosure its sharpness: a hide that
 * happened for one of five reasons is harder to read than one that happened
 * for one of three.
 *
 * **Relations are deliberately NOT an axis.** "This item and everything it
 * depends on" is the transitive closure
 * `OPENQ-how-do-filters-respect-dependencies` weighed and Q2 rejected: a
 * closure silently overrides an explicit exclusion, which is the opposite of
 * disclose-and-allow. Relations are read here for the DISCLOSURE — the dangling
 * count — and never for the selection.
 *
 * Within an axis the values are OR'd; across axes they are AND'd. So
 * `--tag billing --tag invoicing --category rule` means "a rule tagged billing
 * or invoicing". An empty axis constrains nothing.
 */
export interface FocusAxes {
  tags: string[];
  categories: string[];
  /**
   * Repo-relative paths, or globs. A path is read the way the JIT tier reads
   * one — the item's own scope globs decide whether it applies — and a glob is
   * additionally matched against the item's globs directly. See
   * `focusMatchesScope` in `core/select.ts`.
   */
  scope: string[];
}

export interface Focus extends FocusAxes {
  /** UTC ISO-8601. Items and logs travel between machines; so does this. */
  setAt: string;
  /** Who narrowed the context. A model narrowing its own is worth being able to see. */
  setBy: Origin;
}

/**
 * The relation vocabulary, classified into what focus must disclose and what it
 * need not.
 *
 * **"Load-bearing" means: hiding the far end leaves the visible item's own
 * instruction incomplete or wrongly actionable.** That is the test, and it is
 * narrower than "related". The archetype is the one
 * `OPENQ-how-do-filters-respect-dependencies` wrote down: an `open_question`
 * that `blocks` a requirement is the only thing telling an agent not to start
 * the requirement, so hiding the question while showing the requirement invites
 * work that was deliberately blocked. `derived_from` is the counter-example
 * from the same item: a rule that says `derived_from LESSON-x` still stands on
 * its own, and hiding the lesson costs provenance, not correctness.
 *
 * **This table is a superset of `RELATION_TYPES` (`core/vocabulary.ts`), and
 * the two disagree — which is recorded here rather than quietly reconciled.**
 * `RELATION_TYPES` is the whole gate on `linkItems`, and it lists
 * `derived_from`, `constrains`, `supersedes`, `blocks`, `mitigates`, `refines`,
 * `relates_to`, `links_to`, and — since 2026-09-02 — `depends_on`,
 * `caused_by`, `conflicts_with` and `amends`. This project's own corpus,
 * measured on 2026-08-16, additionally carried `superseded_by`, `produced`,
 * `discovered_by`, `unblocks`, `enforces`, `enforced_by`, `depends_on` and
 * `answers` — eight edge types that `link_items` would then have refused, and
 * that exist because the corpus was seeded before the enum closed and because
 * the Markdown parser does not gate relation names. `depends_on` has since
 * been adopted INTO the enum, so SEVEN of those eight remain unwritable
 * through `link_items` — `answers`, `discovered_by`, `enforced_by`,
 * `enforces`, `produced`, `superseded_by` and `unblocks`. Reconciling the
 * remaining seven is a separate job and is deliberately not done here.
 * Nothing here widens the enum:
 * classifying an edge is not permission to create one. But focus must be able
 * to classify what is ON DISK, and a table that only knew the enum would report
 * zero dangling relations for the very corpus that raised the question. The
 * disagreement is disclosed in both READMEs' known-gaps section too.
 *
 * An unrecognised relation type is treated as load-bearing — see `isLoadBearing`.
 */
export const RELATION_CLASSIFICATION: Record<string, 'load-bearing' | 'referential'> = {
  // Load-bearing: a dependency, a constraint, or a lifecycle gate.
  blocks: 'load-bearing',
  unblocks: 'load-bearing',
  // `depends_on` — this item's correctness RESTS ON the target, so hiding the
  // target leaves the visible item looking self-standing when it is not: the
  // reader acts on a claim whose premise they cannot see and cannot check.
  depends_on: 'load-bearing',
  constrains: 'load-bearing',
  answers: 'load-bearing',
  enforces: 'load-bearing',
  enforced_by: 'load-bearing',
  refines: 'load-bearing',
  // Hiding the far end leaves this item's own instruction wrongly actionable,
  // which is the test at the top of this comment, applied one type at a time:
  //
  // `conflicts_with` — a rule shown alone reads as settled; the whole content
  // of the edge is that something visible-elsewhere contradicts it, so hiding
  // that end is hiding the only reason not to act on what is on screen. It is
  // the one SYMMETRIC member, and the classification is symmetric with it: it
  // is load-bearing from either end, which is exactly why no mirror needs to
  // be stored for focus to report it — `danglingEdges` already reports a
  // hidden `from` as well as a hidden `to`.
  conflicts_with: 'load-bearing',
  // `amends` — the target STAYS ACTIVE and this item adds to it. Read on its
  // own, an amendment is a fragment: it states the addition and not the thing
  // being added to, so a reader who cannot see the target cannot tell what the
  // rule now is. That is the same failure as a hidden premise, not the merely
  // missing provenance `derived_from` costs.
  amends: 'load-bearing',

  // Referential: provenance, cross-reference, or a fact the item already
  // carries in a field of its own.
  //
  // `supersedes`/`superseded_by` are referential HERE and only here: a
  // retirement is carried by `status`, which focus never touches, so a
  // superseded item is already outside the eligible set before focus is
  // consulted and the edge cannot dangle in a way that misleads.
  //
  // `mitigates` is referential because a mitigation stands on its own and a
  // risk without its mitigation in view is still a true risk — the cost is
  // duplicated work, not a violated rule.
  //
  // `caused_by` names what PRODUCED the thing this item describes. The item is
  // complete without it — a known issue is just as broken whether or not its
  // cause is on screen — so hiding the cause costs an explanation rather than
  // correctness. That is the same line `derived_from` falls on, and the two
  // are deliberately classified alike: one is the provenance of the artefact,
  // the other the provenance of the fact, and neither is an instruction.
  derived_from: 'referential',
  caused_by: 'referential',
  relates_to: 'referential',
  links_to: 'referential',
  discovered_by: 'referential',
  produced: 'referential',
  mitigates: 'referential',
  supersedes: 'referential',
  superseded_by: 'referential',
};

/**
 * Whether an edge of this type dangles loudly.
 *
 * **An unknown type counts as load-bearing.** The relation name is not gated on
 * the read path — `rebuild` indexes whatever the Markdown says — so a corpus can
 * carry an edge this table has never seen. Reporting it costs a possibly
 * inflated count; not reporting it costs exactly the silent orphan the open
 * question was written to prevent, and this project's rule is that the
 * disclosure errs loud. `mycontext focus --relations` prints the table, so a
 * reader can see which side of the line every type they use falls on.
 */
export function isLoadBearing(type: string): boolean {
  return RELATION_CLASSIFICATION[type] !== 'referential';
}

/**
 * One load-bearing relation with exactly one end hidden by focus.
 *
 * `hiddenEnd` says which end went: `'to'` is the shape the open question named
 * (a visible item points at something that is no longer there), `'from'` is its
 * mirror (something no longer there points at a visible item, e.g. the hidden
 * `open_question` that `blocks` a requirement still on screen). Both are
 * reported, because both leave the reader acting on an incomplete instruction —
 * and the mirror is the more dangerous of the two.
 */
export interface DanglingEdge {
  from: string;
  type: string;
  to: string;
  hiddenEnd: 'from' | 'to';
}

/**
 * The load-bearing edges that focus left dangling, deduplicated and ordered.
 *
 * An edge counts when one end is in `hidden` and the other is in `visible`.
 * Edges between two hidden items are NOT counted: nothing on screen depends on
 * them, so there is no reader to mislead. Edges pointing at an id in neither set
 * are not counted either — that is an orphan or a rationale-tier target, which
 * `doctor`'s `orphan_relations` check owns and focus did not cause.
 */
export function danglingEdges(visible: Item[], hidden: Item[]): DanglingEdge[] {
  const hiddenIds = new Set(hidden.map((i) => i.id));
  const visibleIds = new Set(visible.map((i) => i.id));
  const seen = new Set<string>();
  const out: DanglingEdge[] = [];

  const add = (from: string, type: string, to: string, hiddenEnd: 'from' | 'to'): void => {
    const key = `${from}|${type}|${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ from, type, to, hiddenEnd });
  };

  for (const item of visible) {
    for (const rel of item.relations) {
      if (isLoadBearing(rel.type) && hiddenIds.has(rel.target)) add(item.id, rel.type, rel.target, 'to');
    }
  }
  for (const item of hidden) {
    for (const rel of item.relations) {
      if (isLoadBearing(rel.type) && visibleIds.has(rel.target)) {
        add(item.id, rel.type, rel.target, 'from');
      }
    }
  }

  return out.sort((a, b) => (
    a.from < b.from ? -1 : a.from > b.from ? 1
      : a.type < b.type ? -1 : a.type > b.type ? 1
        : a.to < b.to ? -1 : a.to > b.to ? 1 : 0
  ));
}

/**
 * What an active focus did to a selection — the disclosure, computed by
 * `select` on the same pass that applied the filter.
 *
 * `null` on `Selection` means no focus was active. A focus that is active but
 * hides nothing still produces a report with `hidden: []`, because "focus is on
 * and cost you nothing" and "focus is off" are different facts and a session
 * running under a forgotten focus must be told which one it is in.
 */
export interface FocusReport {
  /** What was asked for, so the disclosure can name it. */
  axes: FocusAxes;
  /**
   * **Which universe the counts below are counting**, because two events count
   * different ones and a bare "7 hidden" would mean different things.
   *
   *  - `'corpus'` — every eligible item in the workspace. Session start,
   *    compaction restore, and the manual `load_context`.
   *  - `'path'` — only the eligible items that apply to the file this tool call
   *    touched. A JIT event delivers nothing else, so counting the rest would
   *    report a cost this event never paid.
   */
  universe: 'corpus' | 'path';
  /** Ids hidden by focus, sorted. Hidden, not gone: still in the corpus and still readable. */
  hidden: string[];
  /** Eligible items still visible in the same universe. */
  visible: number;
  /**
   * `severity: hard` items that do NOT match the focus and are injected anyway.
   *
   * **Focus never hides a hard item**, per this requirement's own `[rule]`
   * observation, and that is not a default that can be turned off. A hard item
   * is what the project says must not be violated; narrowing exists to reduce
   * noise, and a rule you must not break is not noise. The exemption is
   * disclosed rather than assumed — a user who asked for a narrow corpus and
   * got three extra items is owed the reason.
   */
  exemptHard: string[];
  /**
   * `always: true` items that do NOT match the focus and are injected anyway.
   *
   * A SECOND list rather than more ids in the first, because they are kept for
   * a different reason and the sentence beside each says which. `severity:
   * hard` means the item must not be VIOLATED; `always` means it must not fall
   * OUT OF CONTEXT. An item can carry either without the other.
   *
   * Added 2026-08-27 with the exemption itself. Before that a focus hid pinned
   * items outright — six of them for three days, including the instruction to
   * use this product for every fitting category, hidden by this product — and
   * the report above said nothing, because there was nothing to say: they were
   * not kept, they were gone. Now they are kept, and a report that counted only
   * the hard ones would undercount what the focus let through, which is the
   * same silence one level along.
   */
  exemptAlways: string[];
  /**
   * `continuity: true` items that do NOT match the focus and are injected
   * anyway.
   *
   * A THIRD list, for the reason there is a second: the three exemptions are
   * kept for three different reasons and the sentence beside each says which.
   * `severity: hard` means the item must not be VIOLATED; `always` means it
   * must not fall OUT OF CONTEXT; `continuity` means the NEXT session must
   * not start over without it. An item can carry any of the three without the
   * others.
   */
  exemptContinuity: string[];
  /** Load-bearing relations with exactly one end hidden. The cost Q2 requires reporting. */
  dangling: DanglingEdge[];
}

/** True when at least one axis constrains something. */
export function isFocusActive(focus: FocusAxes | null): focus is FocusAxes {
  if (focus === null) return false;
  return focus.tags.length > 0 || focus.categories.length > 0 || focus.scope.length > 0;
}

/** `tags: billing, invoicing · scope: src/api` — the axes, for a human. */
export function describeFocus(focus: FocusAxes): string {
  const parts: string[] = [];
  if (focus.tags.length) parts.push(`tags: ${focus.tags.join(', ')}`);
  if (focus.categories.length) parts.push(`categories: ${focus.categories.join(', ')}`);
  if (focus.scope.length) parts.push(`scope: ${focus.scope.join(', ')}`);
  return parts.length ? parts.join(' · ') : 'no axes set';
}

export function focusPath(root: string): string {
  return path.join(root, 'state', 'focus.json');
}

/**
 * What is on disk, and what went wrong reading it — both, never one silently
 * standing in for the other.
 *
 * A focus file that cannot be read fails OPEN (`focus` is null, so nothing is
 * hidden), because the alternative — refusing to inject — breaks a session over
 * a file the user can delete. But failing open here is a real event: the user
 * asked for a narrowing and is not getting it. So the reason comes back with
 * the answer and every caller discloses it: the injected block carries a note,
 * `mycontext focus` reports it, and `doctor` reports it. That is the difference
 * between failing open and failing silently.
 */
export interface FocusState {
  focus: Focus | null;
  error: string | null;
}

const EMPTY: FocusState = { focus: null, error: null };

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/**
 * Reads the focus. Never throws.
 *
 * On the hot path: one `readFileSync` of a file measured in hundreds of bytes,
 * per tool call. No parse of the corpus, no database, no directory scan. ENOENT
 * — by far the common case, since most workspaces have no focus — is the
 * cheapest possible answer and is not reported as an error.
 */
export function readFocus(root: string): FocusState {
  let raw: string;
  try {
    raw = readFileSync(focusPath(root), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY;
    return {
      focus: null,
      error: `could not be read (${err instanceof Error ? err.message : String(err)})`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { focus: null, error: `is not valid JSON (${(err as Error).message})` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { focus: null, error: 'is not a JSON object' };
  }

  const row = parsed as Record<string, unknown>;
  if (row.protocol !== FOCUS_PROTOCOL) {
    return {
      focus: null,
      error: `declares protocol ${JSON.stringify(row.protocol)}, not ${FOCUS_PROTOCOL}`,
    };
  }

  return {
    focus: {
      tags: strings(row.tags),
      categories: strings(row.categories),
      scope: strings(row.scope),
      setAt: typeof row.setAt === 'string' ? row.setAt : '',
      // Narrowed against `ORIGINS`, never against the members spelled out
      // here. `'human'` is the fallback for a `setBy` that is absent or is
      // not an origin at all — but WHICH values are origins is `Origin`'s
      // question, and a copy of the answer in this file would fail in the
      // quietest way available: a member added to the union would be
      // rewritten to `'human'` on read, and the focus would report an
      // author nobody set.
      setBy: ORIGINS.find((origin) => origin === row.setBy) ?? 'human',
    },
    error: null,
  };
}

/**
 * The line an injection carries when the focus file could not be read.
 *
 * Failing open means the user's narrowing is NOT in effect, and that is the
 * whole reason this sentence exists: without it, a corrupt focus file looks
 * exactly like no focus at all, and the user reads a wide injection as
 * evidence their focus was wrong rather than unreadable.
 *
 * The path is named relative to the workspace, never absolutely: this string
 * goes into a model's context, and a machine-specific path there is noise the
 * reader cannot act on any better than on the relative one.
 */
export function focusErrorNote(error: string | null): string {
  if (error === null) return '';
  return (
    `_my_context: \`.my_context/state/focus.json\` ${error}, so NO focus is in effect and ` +
    `nothing is hidden. Fix the file, or run \`mycontext focus --clear\` to remove it._`
  );
}

/** Writes the focus, creating `state/` if it is not there yet. Throws on failure. */
export function writeFocus(root: string, focus: Focus): string {
  const target = focusPath(root);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(
    target,
    `${JSON.stringify({ protocol: FOCUS_PROTOCOL, ...focus }, null, 2)}\n`,
    'utf8',
  );
  return target;
}

/** Removes the focus. Returns whether there was one to remove. */
export function clearFocus(root: string): boolean {
  const target = focusPath(root);
  try {
    readFileSync(target);
  } catch {
    return false;
  }
  rmSync(target, { force: true });
  return true;
}

/**
 * Sets the focus AND records it in the audit log. One function, so the CLI and
 * the `focus_context` MCP tool cannot differ about either half.
 *
 * The audit record carries the axes, never the ids they select: which items a
 * focus hides is a function of the corpus at injection time, and the injection
 * records already say how many it hid. `origin` is the point of the record —
 * an agent narrowing its own context is exactly what someone reading this log
 * later needs to be able to see.
 *
 * The audit result is RETURNED rather than swallowed, the same contract every
 * mutation on this project follows: the caller puts `auditFailureNote` into the
 * message a human or a model reads, so a focus change missing from the log says
 * so at the moment it happens.
 */
export function setFocus(
  root: string, axes: FocusAxes, origin: Origin,
): { focus: Focus; audit: AuditWriteResult } {
  const focus: Focus = { ...axes, setAt: new Date().toISOString(), setBy: origin };
  writeFocus(root, focus);
  const audit = recordAudit(root, {
    kind: 'focus',
    op: 'focus-set',
    origin,
    note: describeFocus(axes),
  });
  return { focus, audit };
}

/** Clears the focus and records it. Records nothing when there was no focus to clear. */
export function unsetFocus(
  root: string, origin: Origin,
): { existed: boolean; audit: AuditWriteResult } {
  const existed = clearFocus(root);
  if (!existed) return { existed, audit: { written: true } };
  return {
    existed,
    audit: recordAudit(root, { kind: 'focus', op: 'focus-clear', origin }),
  };
}

/**
 * The focus report as lines of plain text, shared by `mycontext focus` and the
 * `focus_context` MCP tool.
 *
 * **Every line holds the 100-column budget at this project's hostile id length
 * of 67 characters**, which is why a dangling edge is two lines rather than one:
 * `<67-char id> <relation> <67-char id>` is 141 columns and no table can rescue
 * it. The id is alone on its line (69 columns with the indent) and the edge is
 * on the next (up to 80).
 *
 * The id lists are capped and the cap is disclosed with the remainder, never
 * silently truncated — `--json` returns all of them.
 */
export function focusReportLines(report: FocusReport, limit = 10): string[] {
  const lines: string[] = [];
  lines.push(`focus: ${describeFocus(report.axes)}`);
  lines.push(
    `${report.visible} item(s) in focus, ${report.hidden.length} hidden by focus ` +
    `(of the ${report.universe === 'path' ? 'items that apply to this path' : 'eligible corpus'}).`,
  );

  if (report.hidden.length > 0) {
    lines.push('', 'hidden by focus — still in the corpus, still readable with `mycontext show`:');
    for (const id of report.hidden.slice(0, limit)) lines.push(`  ${id}`);
    if (report.hidden.length > limit) {
      lines.push(`  … +${report.hidden.length - limit} more (--json lists every one)`);
    }
  }

  lines.push('');
  // Its own block, for the reason the type records: three exemptions, three
  // reasons, and one merged count is a count nobody can act on. Listed like
  // `exemptHard` above it — capped, with the remainder disclosed rather than
  // truncated quietly.
  if (report.exemptAlways.length > 0) {
    lines.push(
      `${report.exemptAlways.length} pinned item(s) do not match this focus and are ` +
      'injected anyway — focus never hides one:',
    );
    for (const id of report.exemptAlways.slice(0, limit)) lines.push(`  ${id}`);
    if (report.exemptAlways.length > limit) {
      lines.push(`  … +${report.exemptAlways.length - limit} more (--json lists every one)`);
    }
  }

  if (report.exemptContinuity.length > 0) {
    lines.push(
      `${report.exemptContinuity.length} continuity item(s) do not match this focus and are ` +
      'injected anyway — focus never hides one either:',
    );
    for (const id of report.exemptContinuity.slice(0, limit)) lines.push(`  ${id}`);
    if (report.exemptContinuity.length > limit) {
      lines.push(`  … +${report.exemptContinuity.length - limit} more (--json lists every one)`);
    }
  }

  if (report.dangling.length === 0) {
    lines.push('0 load-bearing relations dangling.');
  } else {
    lines.push(
      `${report.dangling.length} load-bearing relation(s) dangling — one end is hidden, ` +
      'the other is not:',
    );
    for (const edge of report.dangling.slice(0, limit)) {
      // `(hidden)` marks the end that went, on whichever line carries it. It is
      // not a third line and not a trailing column: at 67-character ids the
      // second line is already 87 columns, and a `(hidden end: to)` suffix put
      // it at 104 — over the budget this report holds.
      lines.push(`  ${edge.from}${edge.hiddenEnd === 'from' ? ' (hidden)' : ''}`);
      lines.push(`    ${edge.type} → ${edge.to}${edge.hiddenEnd === 'to' ? ' (hidden)' : ''}`);
    }
    if (report.dangling.length > limit) {
      lines.push(`  … +${report.dangling.length - limit} more (--json lists every one)`);
    }
  }

  if (report.exemptHard.length > 0) {
    lines.push('');
    lines.push(
      `${report.exemptHard.length} severity:hard item(s) do not match this focus and are ` +
      'injected anyway — focus never hides one:',
    );
    for (const id of report.exemptHard.slice(0, limit)) lines.push(`  ${id}`);
    if (report.exemptHard.length > limit) {
      lines.push(`  … +${report.exemptHard.length - limit} more (--json lists every one)`);
    }
  }

  return lines;
}

/** The relation classification, as a two-column table. `mycontext focus --relations`. */
export function relationTableLines(): string[] {
  const names = Object.keys(RELATION_CLASSIFICATION).sort();
  const width = Math.max(...names.map((n) => n.length));
  return [
    'load-bearing means: hiding the far end leaves the visible item\'s own instruction',
    'incomplete or wrongly actionable. Focus counts those and reports them; it never',
    'refuses a hide. An unlisted relation type counts as load-bearing.',
    '',
    ...names.map((n) => `  ${n.padEnd(width)}  ${RELATION_CLASSIFICATION[n]}`),
  ];
}
