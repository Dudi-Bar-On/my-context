/**
 * **Results are files, and they cite** — `plan:recall seq:2`, Task 10 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §9 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── THEY ARE GITIGNORED, AND THAT IS THE PRIVACY BOUNDARY ──────────────────
 *
 * A result holds conversation text, and the owner's ruling is that
 * conversation files are gitignored *"so no sensitive data would be saved in
 * git"*. The plan's own self-review calls this the boundary that cannot be got
 * wrong. They live under `RETRIEVAL_DIR` beside the missions that produced
 * them, and NOT in `reports/`, which is hand-written narrative.
 *
 * ── THE FILE IS MARKDOWN, AND THAT IS A DECISION ───────────────────────────
 *
 * A JSON file would be easier to parse back and is the wrong answer: the
 * subagent writing it is a model, the owner reads it in the viewer, and §9
 * asks for something he reads and chooses from. So the format is the one both
 * ends can already handle — a claim per line, with its citations in brackets:
 *
 *     - Anchors are a table. [turn sess-a@918273] [file src/core/anchors.ts:95]
 *
 * Three bracket shapes and no more, because the design names exactly three
 * kinds of record a claim may point at: a turn, a commit, a file and line.
 * **A line with no bracket parses as a claim with NO citations rather than
 * being skipped**, which is what lets `validateResult` report it —
 * `INV-nothing-is-dropped-silently`. A parser that dropped uncited lines would
 * make an uncited result look like a short one.
 *
 * ── AND A RESULT CAN SAY IT HAS AGED ───────────────────────────────────────
 *
 * Citations are what make a result KEEPABLE: one whose citations still resolve
 * is still true, and one whose citations have moved can say so instead of
 * rotting silently. `checkCitations` therefore reports three states and never
 * two — `resolved`, `unresolved`, and **`unchecked`** for a citation nothing
 * available could check. Folding `unchecked` into either of the others is the
 * silent-drop this project keeps finding, so it is a column of its own and
 * `aged` is driven by `unresolved` alone.
 *
 * Only the file-and-line resolver has a default, because it is the only one
 * this module can answer without reaching outside itself. A turn needs the
 * conversation index and a commit needs git; both are INJECTED, which keeps
 * this module free of a database handle and a subprocess, and keeps `unchecked`
 * honest when a caller supplies neither.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RETRIEVAL_DIR } from './mission.ts';

export { RETRIEVAL_DIR };

/** What a result file is called. A mission in the same directory is not one. */
export const RESULT_SUFFIX = '.result.md';

/** The three kinds of record a claim may point at. There are no others. */
export type Citation =
  | { kind: 'turn'; sessionId: string; agentId: string | null; byteOffset: number }
  | { kind: 'commit'; hash: string }
  | { kind: 'file'; file: string; line: number };

/** One thing the subagent says it found, and what it rests on. */
export interface Claim {
  text: string;
  citations: Citation[];
}

/** One result, kept and re-verifiable. */
export interface RetrievalResult {
  id: string;
  /** ISO. A result that is not dated cannot be judged against the code today. */
  at: string;
  mode: string;
  query: { names: string[]; terms: string[] } | null;
  /** The mission this answers, so a round can be re-run rather than guessed at. */
  missionPath?: string;
  claims: Claim[];
}

/** Something wrong with a result, as a reader can act on it. */
export interface ResultFinding {
  kind: 'uncited' | 'report-line';
  detail: string;
}

/** What one citation check found. */
export interface AgeReport {
  resolved: number;
  unresolved: number;
  /** Citations nothing available could check. Not resolved, and not aged. */
  unchecked: number;
  /** True when at least one citation no longer resolves. */
  aged: boolean;
  findings: ResultFinding[];
}

/** How a caller answers *does this still resolve*. `null` means it cannot say. */
export interface CitationResolvers {
  turn?: (citation: Extract<Citation, { kind: 'turn' }>) => boolean | null;
  commit?: (citation: Extract<Citation, { kind: 'commit' }>) => boolean | null;
  file?: (citation: Extract<Citation, { kind: 'file' }>) => boolean | null;
}

/** One row of the index the UI lists. */
export interface ResultSummary {
  id: string;
  path: string;
  at: string;
  mode: string;
  claims: number;
  bytes: number;
}

/**
 * **Whether a `.gitignore` really ignores the retrieval directory.**
 *
 * Matching is deliberately narrow — an exact directory rule, with or without a
 * leading slash or a trailing one. A loose match would let a rule that merely
 * mentions the path pass while ignoring nothing, and this is the assertion
 * standing between conversation text and the repository.
 */
export function ignoresRetrievalDir(gitignore: string): boolean {
  const wanted = RETRIEVAL_DIR.split(path.sep).join('/');
  return gitignore.split(/\r?\n/).some((raw) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return false;
    const rule = line.replace(/^\//, '').replace(/\/$/, '');
    return rule === wanted;
  });
}

/** Where one result belongs under a workspace root. */
export function resultPathFor(root: string, id: string): string {
  return path.join(root, RETRIEVAL_DIR, `${id}${RESULT_SUFFIX}`);
}

/** One citation, in the bracket form the file carries and the parser reads back. */
function renderCitation(citation: Citation): string {
  if (citation.kind === 'turn') {
    const where = citation.agentId === null
      ? citation.sessionId
      : `${citation.sessionId}/${citation.agentId}`;
    return `[turn ${where}@${citation.byteOffset}]`;
  }
  if (citation.kind === 'commit') return `[commit ${citation.hash}]`;
  return `[file ${citation.file}:${citation.line}]`;
}

/** **The result, as the owner reads it.** */
export function renderResult(result: RetrievalResult): string {
  const out: string[] = [];
  out.push(`# Retrieval result — ${result.id}`);
  out.push('');
  out.push(`**Written** ${result.at} · **mode** \`${result.mode}\``);
  if (result.missionPath !== undefined) out.push(`**Mission** \`${result.missionPath}\``);
  if (result.query !== null) {
    if (result.query.names.length > 0) {
      out.push(`**Names** ${result.query.names.map((name) => `\`${name}\``).join(', ')}`);
    }
    if (result.query.terms.length > 0) {
      out.push(`**Terms** ${result.query.terms.map((term) => `\`${term}\``).join(', ')}`);
    }
  }
  out.push('');
  out.push('## What it found');
  out.push('');
  for (const claim of result.claims) {
    const cited = claim.citations.map(renderCitation).join(' ');
    out.push(`- ${claim.text}${cited === '' ? '' : ` ${cited}`}`);
  }
  out.push('');
  return out.join('\n');
}

/** Every citation bracket on one line, and the claim text with them removed. */
function splitClaim(line: string): Claim {
  const citations: Citation[] = [];
  const text = line.replace(/\[(turn|commit|file) ([^\]]+)\]/g, (_whole, kind: string, body: string) => {
    if (kind === 'turn') {
      const match = /^(.+?)@(\d+)$/.exec(body.trim());
      if (match !== null) {
        const [session, agent] = (match[1] ?? '').split('/');
        citations.push({
          kind: 'turn',
          sessionId: session ?? '',
          agentId: agent === undefined || agent === '' ? null : agent,
          byteOffset: Number(match[2]),
        });
      }
      return '';
    }
    if (kind === 'commit') {
      citations.push({ kind: 'commit', hash: body.trim() });
      return '';
    }
    const match = /^(.*):(\d+)$/.exec(body.trim());
    if (match !== null) {
      citations.push({ kind: 'file', file: match[1] ?? '', line: Number(match[2]) });
    }
    return '';
  });
  return { text: text.trim(), citations };
}

/** A `**Field** value` line's value, or `null`. */
function fieldOf(text: string, name: string): string | null {
  const match = new RegExp(`^\\*\\*${name}\\*\\* (.+)$`, 'm').exec(text);
  return match === null ? null : (match[1] ?? '').trim();
}

/** The backticked items of a field line. */
function listOf(text: string, name: string): string[] {
  const raw = fieldOf(text, name);
  if (raw === null) return [];
  return [...raw.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');
}

/**
 * **Read a result file back.**
 *
 * A line under *What it found* that carries no bracket comes back as a claim
 * with an empty `citations`, never as nothing — that is what makes an uncited
 * result reportable rather than invisible.
 */
export function parseResult(text: string): RetrievalResult {
  const id = (/^# Retrieval result — (.+)$/m.exec(text)?.[1] ?? '').trim();
  const written = fieldOf(text, 'Written') ?? '';
  const at = (/^(\S+)/.exec(written)?.[1] ?? '').trim();
  const mode = (/\*\*mode\*\* `([^`]+)`/.exec(written)?.[1] ?? '').trim();
  const missionPath = (/^\*\*Mission\*\* `([^`]+)`$/m.exec(text)?.[1] ?? '').trim();
  const names = listOf(text, 'Names');
  const terms = listOf(text, 'Terms');

  const body = text.split(/^## What it found$/m)[1] ?? '';
  const claims: Claim[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('- ')) continue;
    claims.push(splitClaim(line.slice(2)));
  }

  const result: RetrievalResult = {
    id,
    at,
    mode,
    query: names.length + terms.length === 0 ? null : { names, terms },
    claims,
  };
  if (missionPath !== '') result.missionPath = missionPath;
  return result;
}

/** **Write a result under a workspace root, and say where it went.** */
export function writeResult(root: string, result: RetrievalResult): { path: string; text: string } {
  const file = resultPathFor(root, result.id);
  mkdirSync(path.dirname(file), { recursive: true });
  const text = renderResult(result);
  writeFileSync(file, text, 'utf8');
  return { path: file, text };
}

/** **Read one result file.** */
export function readResult(file: string): RetrievalResult {
  return parseResult(readFileSync(file, 'utf8'));
}

/**
 * **Everything that has been asked before, newest first.**
 *
 * §9's *ask once, build on it many times* needs a list, and a directory that
 * also holds missions needs the suffix to tell them apart — a mission is an
 * instruction, not an answer, and listing one as a result would offer the
 * owner something with no claims in it.
 */
export function listResults(root: string): ResultSummary[] {
  const dir = path.join(root, RETRIEVAL_DIR);
  if (!existsSync(dir)) return [];
  const found: ResultSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(RESULT_SUFFIX)) continue;
    const file = path.join(dir, name);
    let parsed: RetrievalResult;
    try {
      parsed = readResult(file);
    } catch {
      continue;
    }
    found.push({
      id: parsed.id === '' ? name.slice(0, -RESULT_SUFFIX.length) : parsed.id,
      path: file,
      at: parsed.at,
      mode: parsed.mode,
      claims: parsed.claims.length,
      bytes: statSync(file).size,
    });
  }
  return found.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * **What is wrong with a result, before anybody acts on it.**
 *
 * Two findings, and both are about the thing the design says makes a result
 * trustworthy rather than trusted.
 */
export function validateResult(result: RetrievalResult): ResultFinding[] {
  const findings: ResultFinding[] = [];
  for (const claim of result.claims) {
    if (claim.citations.length === 0) {
      findings.push({
        kind: 'uncited',
        detail:
          `a claim rests on nothing that can be checked: "${claim.text}". A result resting on `
          + 'what somebody once said in a conversation is what this is designed not to produce.',
      });
      continue;
    }
    for (const citation of claim.citations) {
      if (citation.kind !== 'file') continue;
      const posix = citation.file.split(path.sep).join('/');
      if (!posix.startsWith('reports/')) continue;
      findings.push({
        kind: 'report-line',
        detail:
          `"${claim.text}" cites ${posix}:${citation.line}. A report is PREPENDED to, so every `
          + 'line number in it moves on the next write — cite an item by id '
          + '(`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).',
      });
    }
  }
  return findings;
}

/** The default file resolver: the file is there, and it is still that long. */
function fileStillResolves(root: string, file: string, line: number): boolean {
  const full = path.isAbsolute(file) ? file : path.join(root, file);
  let text: string;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    return false;
  }
  return line >= 1 && line <= text.split(/\r?\n/).length;
}

/**
 * **Does this result still stand?**
 *
 * `aged` is driven by `unresolved` alone. A citation nothing could check is
 * counted in `unchecked` and changes nothing: saying a result has aged because
 * nobody handed in a resolver would be telling the owner something false,
 * which the design says plainly is worse than silence.
 */
export function checkCitations(
  root: string, result: RetrievalResult, resolvers: CitationResolvers = {},
): AgeReport {
  const report: AgeReport = {
    resolved: 0, unresolved: 0, unchecked: 0, aged: false, findings: [],
  };
  for (const claim of result.claims) {
    for (const citation of claim.citations) {
      let answer: boolean | null;
      if (citation.kind === 'turn') {
        answer = resolvers.turn === undefined ? null : resolvers.turn(citation);
      } else if (citation.kind === 'commit') {
        answer = resolvers.commit === undefined ? null : resolvers.commit(citation);
      } else {
        answer = resolvers.file === undefined
          ? fileStillResolves(root, citation.file, citation.line)
          : resolvers.file(citation);
      }

      if (answer === null) {
        report.unchecked += 1;
        continue;
      }
      if (answer) {
        report.resolved += 1;
        continue;
      }
      report.unresolved += 1;
      report.findings.push({
        kind: 'uncited',
        detail:
          `a citation no longer resolves: ${renderCitation(citation)} behind "${claim.text}". `
          + 'The result has aged; what it says may still be true, but this is no longer the '
          + 'record that shows it.',
      });
    }
  }
  report.aged = report.unresolved > 0;
  return report;
}
