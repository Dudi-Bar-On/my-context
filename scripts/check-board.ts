#!/usr/bin/env node
/**
 * **The board is not true, and this is what keeps it true.**
 *
 *     npm run check:board
 *
 * Two questions, asked of the same corpus, in the order a reader needs them.
 *
 * ── TIER 1: THE D MAP PARSES, AND GATES ────────────────────────────────────
 *
 * `REF-the-d-numbers-what-each-one-means-and-which-are-only` is the register
 * that mints this project's subject numbers and it is PROSE. Every progress
 * table this campaign produced was a regex over that prose, and TWO ROWS CAME
 * OUT WRONG ON 2026-09-16: `D78` was reported CLOSED because its text QUOTES
 * D57's closure, and `D57` was reported 0/3 because it matched that day's
 * `anchors/` items by name.
 *
 * The register now carries a delimited block of rows beside its argument, and
 * this tier proves the block is readable: every line between the sentinels
 * parses, no D number repeats, every member names work this corpus actually
 * holds, and no item falls under two subjects. Any of those FAILS THE RUN and
 * names the line, because a row that silently does not parse is a subject that
 * has silently left the board — the exact failure the block replaces.
 *
 * The double-claim check is the one that is easy to under-rate. One item under
 * two subjects makes both rows count it, so the board's totals stop adding up
 * while every individual row still looks right — a progress table lying in the
 * one way nobody audits.
 *
 * ── TIER 2: A COMMIT NAMED AN ITEM AND THE ITEM IS STILL OPEN ──────────────
 *
 * **REPORTED, never gated.** MEASURED 2026-09-16: 23 of 153 open task items
 * were already named by a commit since 2026-09-14 — `readmodel/1`'s work was
 * in HEAD at `aebc76f0` with the item still reading `state: todo`, so `D72`
 * reported 0/4 with two of its four shipped, and every dispatch decision taken
 * from that table rested on a number that was wrong.
 *
 * The cause is this project's own defect inside its own dispatch loop: every
 * lane brief says "close each finished item", some lanes do and some do not,
 * and the commit step verifies the code and the tests AND NEVER VERIFIES THAT
 * THE ITEM STATE CHANGED.
 *
 * **It cannot gate, and the reason is not timidity.** A commit that FILES an
 * item names it too; a partial landing is legitimate and frequent; a handover
 * commit names live lanes on purpose. On the day this was written, 7 of the 26
 * findings were one of those three. A gate here would be red on a correct tree
 * within a day and off within a week.
 *
 * **WHAT WOULD MAKE IT A GATE**: nothing available today, and saying so is the
 * point. It could only gate if "this commit finishes that item" were something
 * a commit could DECLARE rather than something a reader infers from prose —
 * a trailer, say, checked at the moment the commit is written. Until a commit
 * can say which items it closes, the honest instrument is a report a person
 * reads, and no `--strict` flag is offered for somebody to flip later without
 * re-reading this paragraph.
 *
 * ── THE FOUR THINGS IT KNOWS NOT TO REPORT, AND EVERY ONE IS DERIVED ───────
 *
 * Measured on the first real run: the naive detector found 26 items, and 22 of
 * them were one of these four. A report wrong four times out of five is a
 * report nobody opens twice.
 *
 *  1. **Work that is done, deprecated or superseded** is not open and is never
 *     a finding.
 *  2. **A commit that CREATED the item's file is filing it, not leaving it
 *     open.** Asked of git (`--diff-filter=A --follow`), never of a list
 *     somebody maintains.
 *  3. **A commit that changed nothing outside `reports/` and `.my_context/`
 *     did no work**, so naming an item in it is bookkeeping: a handover names
 *     every live lane on purpose, a filing commit names what it files, and a
 *     reconciliation names what it closes. All three are correct, all three
 *     look exactly like drift from the message alone, and git already holds
 *     the one fact that separates them. On the day this was written the
 *     handover changed one file under `reports/` and the two filing commits
 *     changed nothing but the items they created.
 *  4. **An item may record that it is deliberately still open**, with a line
 *     `NAMED-BUT-OPEN <sha> — <what remains>` in its body. That is the "yes,
 *     deliberately" this check owes its reader, and it is SELF-EXPIRING in the
 *     only way that matters: the record names ONE commit, so the next commit
 *     that names the item reports again. An acknowledgement that silenced an
 *     item for ever would be a second place for a fact to be wrong.
 *
 * **And a drift row still prints the item's record when it has one**, so a
 * reader met by a fresh landing on an item somebody has already ruled on sees
 * that ruling rather than having to go and find it.
 *
 * ── WHY ONE SCRIPT AND NOT TWO ─────────────────────────────────────────────
 *
 * Because of the ruling in `7d10c14d`, pinned by `test/scripts/workflow-gates
 * .test.ts`: a check whose only non-zero exits are anti-vacuity guards must
 * NOT be a CI step, since "a never-gating check there prints 224 lines into a
 * green log and manufactures the appearance of coverage". Tier 2 alone is
 * exactly that check. Tier 1 alone is a real gate. Together they are one
 * question — *is the board true* — asked in a step that can genuinely go red,
 * so the report is read inside a run whose greenness means something.
 *
 * The one non-zero exit that is not a finding is "nothing was checked": no
 * workspace, no work items, no register, no block. `check-handover.ts` and
 * `check-cited-items.ts` both draw that line in the same place, and this
 * repository has been bitten by a vacuous pass in six other shapes.
 *
 * Usage:
 *
 *     node scripts/check-board.ts
 *     node scripts/check-board.ts --json
 *     node scripts/check-board.ts --orphans      # list the unclaimed open work
 *     node scripts/check-board.ts --commits 200  # widen the window read
 *     node scripts/check-board.ts --register <id>
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import {
  dBoard, DONE_STATE, parseDMap, taskKey, taskState, workItems,
  type DBoard, type DMapReading, type WorkItem,
} from '../src/core/needs.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';
import type { Item } from '../src/core/types.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/** The register, and the only item this is pointed at unless told otherwise. */
export const DEFAULT_REGISTER = 'REF-the-d-numbers-what-each-one-means-and-which-are-only';

/**
 * How far back the drift tier reads, in COMMITS rather than in days.
 *
 * A commit count is deterministic and carries no clock: the same repository
 * answers the same way tomorrow for the same HEAD, and a machine whose date is
 * wrong does not change what is checked. The window slides as commits land,
 * which is what a drift report wants — and the number is printed on every run
 * so a reader never has to guess what was looked at.
 */
export const DEFAULT_COMMITS = 120;

/**
 * A lane address as a COMMIT MESSAGE writes it: bare, because that is how they
 * are written here — `rulings/93:`, `anchors/6 and /7`, `readmodel/2`.
 *
 * `check-handover.ts` requires backticks for the same notation and is right to:
 * in a handover, unbackticked `library/2` is indistinguishable from a path
 * fragment. A commit subject has no such convention, and requiring backticks
 * here would have found 2 of the 26 findings. The false-positive risk that
 * buys — `src/cli` is `word/word` and every path in a message looks like one —
 * is closed the same way `scan` closes it there: THE LEFT HALF MUST BE A PLAN
 * THIS CORPUS USES, and the right half must start with a digit.
 */
const LANE_IN_COMMIT = /\b([a-z][a-z0-9_-]*)\/(\d[a-z0-9_-]*)\b/g;

/**
 * The "yes, deliberately" an item may carry, and the shape is deliberate too.
 *
 * It names ONE commit. A record that silenced the item outright would be an
 * acknowledgement with no expiry — and this corpus has already paid for a fact
 * recorded in a second place that nobody re-reads. Naming the commit means the
 * NEXT commit that names the item reports again, which is the only expiry that
 * cannot itself go stale.
 */
export const RECORD = /^\s*NAMED-BUT-OPEN\s+([0-9a-f]{7,40})\b[\s—:-]*(.*)$/gim;

export interface Naming {
  /** Abbreviated sha, as printed. */
  sha: string;
  /** Full sha, for `git` calls. */
  full: string;
  date: string;
  subject: string;
  /** Exactly as the message wrote it. */
  raw: string;
  /** See `Commit.didWork`. A naming in a commit that did none is bookkeeping. */
  didWork: boolean;
}

/**
 * Why a naming is, or is not, a finding.
 *
 *   - `drift`      — a commit that DID WORK named this item and nobody closed it.
 *   - `filed`      — the only commit naming it is the one that CREATED its file.
 *   - `bookkeeping` — every naming is in a commit that changed nothing outside
 *                    `reports/` and `.my_context/`: a handover, a filing, a
 *                    reconciliation. Those name live work ON PURPOSE.
 *   - `recorded`   — a person wrote `NAMED-BUT-OPEN <sha>` on the item.
 *
 * The item's verdict is the strongest any one of its namings earns, because a
 * filing commit plus a later working commit is DRIFT: the later commit is the
 * one nobody acted on.
 */
export type Verdict = 'drift' | 'filed' | 'bookkeeping' | 'recorded';

export interface Finding {
  item: WorkItem;
  key: string | null;
  state: string;
  verdict: Verdict;
  namings: Naming[];
  /** For `recorded`, the reason the item gives. */
  reason: string | null;
}

export interface Commit {
  full: string;
  sha: string;
  date: string;
  subject: string;
  text: string;
  /**
   * Whether this commit changed anything outside `reports/` and
   * `.my_context/` — which is to say, whether it DID ANY WORK.
   *
   * Derived rather than guessed at, and it is the single rule that makes this
   * tier readable. A handover names every live lane by address on purpose; a
   * filing commit names the item it files; a reconciliation names the items it
   * closes. All three are correct, all three look exactly like drift from the
   * message alone, and all three are separated by one fact git already holds.
   * Measured on the window this was written against: the handover changed one
   * file under `reports/`, and the two filing commits changed nothing but the
   * items they created.
   */
  didWork: boolean;
}

/** Read the window, newest first. Read-only: `log` never writes. */
export function readCommits(repo: string, limit: number): Commit[] {
  const raw = execFileSync(
    'git',
    [
      'log', `-n${limit}`, '--format=%x00%H%x1f%ad%x1f%s%x1f%b%x1f', '--date=short',
      // `--name-only` with `-m` so a merge lists its files rather than none.
      // A merge that lists nothing would read as "changed no source" and turn
      // every naming inside it into bookkeeping.
      '--name-only', '-m',
    ],
    { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const out: Commit[] = [];
  // NUL between commits, unit separator between fields, so a subject or body
  // containing a newline — most of them do — cannot be read as a boundary.
  // Written as ESCAPES and not as the bytes themselves: `2f25357c` spent a day
  // on a raw NUL that made a 9,400-line file binary to git, and
  // `check-text-files` exists so there is never a second one.
  for (const chunk of raw.split('\u0000')) {
    if (chunk.trim() === '') continue;
    const [full, date, subject, body, files] = chunk.split('\u001f');
    if (full === undefined || date === undefined || subject === undefined) continue;
    const touched = (files ?? '').split('\n').map((f) => f.trim()).filter((f) => f !== '');
    out.push({
      full, sha: full.slice(0, 8), date, subject,
      text: `${subject}\n${body ?? ''}`,
      didWork: touched.some((f) => !f.startsWith('reports/') && !f.startsWith('.my_context/')),
    });
  }
  return out;
}

/**
 * The commit that ADDED an item's file, or null.
 *
 * `--diff-filter=A` and `--follow`: an item that was renamed — which happens
 * when a title is corrected — would otherwise report its rename as its birth,
 * and the real filing commit would go on being reported as drift forever.
 */
export function creationOf(repo: string, file: string): string | null {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%H', '-1', '--', file],
      { cwd: repo, encoding: 'utf8' },
    ).trim();
    return out === '' ? null : out;
  } catch {
    // A file git has never seen is a NEW item in the working tree, which is
    // not a defect and not a filing either: it has no creating commit yet, so
    // no commit can be excused by one. Reported as it stands.
    return null;
  }
}

/** Where an item's Markdown lives, repo-relative and POSIX-spelled. */
function itemFile(projectRoot: string, item: Item): string {
  const full = path.join(projectRoot, '.my_context', 'items', item.type, `${item.id}.md`);
  return path.relative(REPO, full).split(path.sep).join('/');
}

/** Is this work item still open — not done, not cancelled, not replaced? */
export function isOpen(item: WorkItem): boolean {
  return taskState(item) !== DONE_STATE
    && item.status !== 'deprecated'
    && item.status !== 'superseded';
}

/** Every `NAMED-BUT-OPEN` record on an item, sha → reason. */
export function recordsOn(item: Item): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of item.body.matchAll(RECORD)) {
    found.set(match[1]!.toLowerCase(), (match[2] ?? '').trim());
  }
  return found;
}

/**
 * The drift tier, computed.
 *
 * An item reaches a finding when a commit in the window names it AND it is
 * still open. Which of the three verdicts it gets is decided per NAMING, and
 * the item's verdict is the strongest one any naming earns: a filing commit
 * plus a later working commit is DRIFT, because the later commit is the one
 * nobody acted on.
 */
export function drift(
  repo: string, projectRoot: string, items: Item[],
  commits: Commit[], config: Parameters<typeof workItems>[1],
): Finding[] {
  const work = workItems(items, config);
  const open = work.filter(isOpen);
  const byKey = new Map<string, WorkItem[]>();
  const plans = new Set<string>();
  for (const item of work) {
    const key = taskKey(item);
    if (key === null) continue;
    plans.add(key.split('/')[0]!);
    const bucket = byKey.get(key);
    if (bucket === undefined) byKey.set(key, [item]);
    else bucket.push(item);
  }
  const openIds = new Set(open.map((i) => i.id));

  const namings = new Map<string, Naming[]>();
  for (const commit of commits) {
    const seen = new Set<string>();
    for (const match of commit.text.matchAll(LANE_IN_COMMIT)) {
      const plan = match[1]!.toLowerCase();
      if (!plans.has(plan)) continue;
      const key = `${plan}/${match[2]!.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const item of byKey.get(key) ?? []) {
        if (!openIds.has(item.id)) continue;
        const list = namings.get(item.id);
        const naming: Naming = {
          sha: commit.sha, full: commit.full, date: commit.date,
          subject: commit.subject, raw: match[0]!, didWork: commit.didWork,
        };
        if (list === undefined) namings.set(item.id, [naming]);
        else list.push(naming);
      }
    }
  }

  const byId = new Map(open.map((i) => [i.id, i]));
  const findings: Finding[] = [];
  for (const [id, list] of namings) {
    const item = byId.get(id)!;
    const born = creationOf(repo, itemFile(projectRoot, item));
    const records = recordsOn(item);
    let verdict: Verdict = 'filed';
    let reason: string | null = null;
    if (records.size > 0) reason = [...records.values()].find((r) => r !== '') ?? null;
    for (const naming of list) {
      if (born !== null && naming.full === born) continue;
      if (!naming.didWork) {
        if (verdict === 'filed') verdict = 'bookkeeping';
        continue;
      }
      // Matched by PREFIX, because a record is written with whatever length of
      // sha a person copied — `git log --oneline` gives seven or eight and
      // `%H` gives forty. Requiring one spelling would silently ignore the
      // record, which is the failure mode a deliberate acknowledgement can
      // least afford.
      const record = [...records].find(([sha]) => naming.full.startsWith(sha))?.[1];
      if (record !== undefined) {
        if (verdict !== 'drift') verdict = 'recorded';
        continue;
      }
      verdict = 'drift';
    }
    findings.push({
      item, key: taskKey(item), state: taskState(item) === '' ? '(none)' : taskState(item),
      verdict, namings: list, reason,
    });
  }
  findings.sort((a, b) => (a.key ?? a.item.id).localeCompare(b.key ?? b.item.id));
  return findings;
}

export interface Args {
  json: boolean;
  orphans: boolean;
  commits: number;
  register: string;
}

/**
 * `--commits` takes a value and `--register` takes a value; both are excluded
 * by INDEX rather than by comparing the parsed result, which is the bug
 * `check-handover.ts`'s `parseArgs` carries the incident report for.
 */
export function parseArgs(argv: string[]): Args {
  const value = (name: string): { raw: string | null; at: number } => {
    const at = argv.indexOf(`--${name}`);
    return { raw: at === -1 ? null : (argv[at + 1] ?? null), at };
  };
  const commits = value('commits');
  const register = value('register');
  const n = commits.raw === null ? NaN : Number(commits.raw);
  return {
    json: argv.includes('--json'),
    orphans: argv.includes('--orphans'),
    commits: Number.isInteger(n) && n > 0 ? n : DEFAULT_COMMITS,
    register: register.raw ?? DEFAULT_REGISTER,
  };
}

/** Everything tier 1 found that fails the run, as lines a person can act on. */
export function gateLines(reading: DMapReading, board: DBoard, register: string): string[] {
  const out: string[] = [];
  for (const defect of reading.defects) {
    out.push(`UNPARSED ${register} body line ${defect.line}`);
    out.push(`         ${defect.text}`);
    out.push(`         ${defect.why}`);
  }
  for (const bad of board.unresolved) {
    out.push(`DANGLING D${bad.d} (body line ${bad.line}) names ${bad.member}`);
    out.push(`         ${bad.why}`);
  }
  for (const clash of board.doubleClaimed) {
    out.push(`TWO SUBJECTS ${clash.key ?? clash.id} is claimed by D${clash.ds.join(' and D')}`);
    out.push(`         ${clash.id}`);
    out.push('         both rows count it, so the board\'s totals do not add up');
  }
  return out;
}

function main(): number {
  const { json, orphans, commits, register } = parseArgs(process.argv.slice(2));
  const out = (line: string): void => { process.stdout.write(`${line}\n`); };

  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    out('my_context: no workspace here. Run this from a directory inside the project.');
    return 1;
  }
  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config);
  const work = workItems(items, ws.config);
  // The vacuous pass, refused: a corpus with no work resolves nothing, reports
  // nothing, and reads as success.
  if (work.length === 0) {
    out(`my_context: no work items under ${ws.projectRoot} — nothing was checked, `
      + 'which is not the same as nothing being wrong. Run this from the repository root.');
    return 1;
  }
  const item = items.find((i) => i.id === register);
  if (item === undefined) {
    out(`my_context: no item ${register} in this corpus — nothing was checked. `
      + 'Point this at the register with --register <id>.');
    return 1;
  }
  const reading = parseDMap(item.body);
  if (!reading.found) {
    out(`my_context: ${register} carries no [D-MAP] block — nothing was checked, which is not `
      + 'the same as nothing being wrong. The block is the map; the prose around it is the '
      + 'argument.');
    return 1;
  }
  if (reading.rows.length === 0 && reading.defects.length === 0) {
    out(`my_context: ${register}'s [D-MAP] block is empty — nothing was checked.`);
    return 1;
  }
  const board = dBoard(reading, items, ws.config);
  const gates = gateLines(reading, board, register);

  const commitList = readCommits(REPO, commits);
  // The same refusal one level down: a window with no commits in it reports no
  // drift and looks exactly like a clean tree.
  if (commitList.length === 0) {
    out('my_context: git returned no commits — nothing was checked.');
    return 1;
  }
  const findings = drift(REPO, ws.projectRoot, items, commitList, ws.config);
  const drifted = findings.filter((f) => f.verdict === 'drift');
  const recorded = findings.filter((f) => f.verdict === 'recorded');
  const filed = findings.filter((f) => f.verdict === 'filed' || f.verdict === 'bookkeeping');
  const openWork = work.filter(isOpen);
  const closable = board.subjects.filter(
    (s) => s.row.status === 'open' && s.items.length > 0 && s.done === s.items.length,
  );

  if (json) {
    out(JSON.stringify({
      register,
      rows: reading.rows.length,
      defects: reading.defects,
      unresolved: board.unresolved,
      doubleClaimed: board.doubleClaimed,
      orphans: board.orphans.map((i) => ({ id: i.id, key: taskKey(i), title: i.title })),
      closable: closable.map((s) => ({ d: s.row.d, items: s.items.length })),
      commitsRead: commitList.length,
      openWork: openWork.length,
      drift: findings.map((f) => ({
        id: f.item.id, key: f.key, state: f.state, verdict: f.verdict, reason: f.reason,
        namings: f.namings.map((n) => ({ sha: n.sha, date: n.date, raw: n.raw, subject: n.subject })),
      })),
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    }, null, 2));
    return gates.length > 0 ? 1 : 0;
  }

  for (const line of gates) out(line);
  if (gates.length > 0) out('');
  out(`THE D MAP — ${reading.rows.length} rows in ${register}, `
    + `${gates.length === 0 ? 'every one of them parsed and resolved' : `${gates.length} finding(s) above`}.`);
  if (board.orphans.length > 0) {
    out(`  ${board.orphans.length} open work item(s) are claimed by NO subject. Filing an item `
      + 'before its number is minted is ordinary; nobody being told is not. '
      + `${orphans ? '' : 'List them with --orphans.'}`);
    if (orphans) {
      for (const orphan of board.orphans) {
        out(`  ORPHAN ${(taskKey(orphan) ?? '(no plan/seq)').padEnd(16)} ${orphan.title}`);
      }
    }
  }
  if (closable.length > 0) {
    // One line and not one per subject. A subject closes on a JUDGEMENT and
    // never on a count — `D78`'s own row says so — so this is a thing for a
    // person to look at, and twenty-two sentences saying the same thing is how
    // a report teaches its reader to skip it.
    out(`  ${closable.length} subject(s) read "open" with every item done, and a subject closes `
      + 'on a judgement rather than a count. Somebody should look at: '
      + closable.map((s) => `D${s.row.d} (${s.items.length})`).join(', ') + '.');
  }

  out('');
  out(`NAMED BY A COMMIT AND STILL OPEN — ${drifted.length} of ${openWork.length} open work items, `
    + `over the last ${commitList.length} commits (${commitList.at(-1)!.date} to ${commitList[0]!.date}).`);
  out('REPORTED, never gated. A commit that files an item names it; a partial landing is');
  out('legitimate. What would make it a gate is a commit DECLARING which items it closes —');
  out('see this file\'s header. Record a deliberate one on the item as');
  out('`NAMED-BUT-OPEN <sha> — <what remains>`, which expires at the next commit naming it.');
  out('');
  for (const finding of drifted) {
    out(`OPEN     ${(finding.key ?? finding.item.id).padEnd(16)} state: ${finding.state}`);
    out(`         ${finding.item.title}`);
    // Only the namings that DID WORK. A drift row listing the handover that
    // mentioned the item alongside the commit that changed its code buries the
    // one line the reader is here for.
    for (const naming of finding.namings.filter((n) => n.didWork)) {
      out(`         ${naming.sha} ${naming.date}  "${naming.raw}"  ${naming.subject}`);
    }
    // A record that does not cover every working commit still tells the reader
    // what the last person to look at this concluded, so it is printed here
    // rather than only in the tier below.
    if (finding.reason !== null) out(`         recorded: ${finding.reason}`);
  }
  if (recorded.length > 0) {
    out('');
    out(`${recorded.length} further item(s) record that they are deliberately open:`);
    for (const finding of recorded) {
      out(`  ${(finding.key ?? finding.item.id).padEnd(16)} ${finding.reason ?? '(no reason written)'}`);
    }
  }
  if (filed.length > 0) {
    out('');
    out(`${filed.length} item(s) are named only by a commit that filed them or by one that `
      + 'changed nothing outside reports/ and .my_context/ — a handover, a filing, a '
      + 'reconciliation. Not listed: nothing is owed on them.');
  }
  for (const error of errors) out(`LOAD     ${error.file}: ${error.message}`);
  return gates.length > 0 ? 1 : 0;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
