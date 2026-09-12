/**
 * **The retrieval screen's endpoints — and every one of them reads.**
 *
 * `plan:recall seq:2`, Task 11 and Task 12 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, §4, §9,
 * §10 and §10a of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * ── THE SAFETY BOUNDARY IS THE SERVER'S OWN SHAPE ─────────────────────────
 *
 * The plan's self-review calls Task 11 step 2 the boundary that cannot be got
 * wrong: **nothing reaches the owner's context until he chooses it.** On this
 * surface that is not a rule anybody has to remember, it is what the server
 * already is. `test/ui/server-e2e.test.ts` snapshots every byte under the
 * workspace, sweeps every registered route, and compares — so a route here
 * that wrote a mission, staged a return, or delivered anything would turn that
 * assertion red. The four routes below therefore answer with TEXT and with
 * COMPOSED COMMANDS, and a person runs the commands.
 *
 * That is not a limitation being worked around; it is the same treatment
 * `plan:recall seq:1` gave the anchor mark on the same screen — *"the command
 * is COMPOSED from the argv the server built, shown, and run by a person"* —
 * and it is the strongest possible form of the rule, because the browser is
 * physically unable to break it.
 *
 * `missionText` and `markReturn` are both PURE, which is what makes this
 * possible at all: the screen can show the owner exactly what a subagent would
 * be told, and exactly what would arrive in a window, before anything at all
 * has happened.
 *
 * ── ITS OWN MODULE, FOR `read-model-staging.ts`'s MEASURED REASON ─────────
 *
 * `read-model-conversations.ts`' runtime graph is exactly two project files —
 * itself and `core/conversation-index.ts` — and
 * `test/ui/conversations-endpoint.test.ts` WALKS that graph and fails if a
 * writer or a store handle becomes reachable. The marking has to read the
 * corpus, because *has this ruling been reversed* is a question only the
 * corpus can answer, so it cannot live there. A sibling module keeps both
 * honest, which is the precedent `read-model-command.ts` and
 * `read-model-staging.ts` already set.
 *
 * ── AND THE MARKING IS WHY THIS TOUCHES THE CORPUS AT ALL ─────────────────
 *
 * §10: what returns arrives *"dated, stated plainly as a record rather than a
 * current instruction, and checked so a ruling that has since been reversed
 * says so on arrival"*. `CLAUDE.md` opens with the measurement that buys —
 * five superseded instructions acted on as current on 2026-09-07 — and a
 * retrieval result, being a model's account of what was once said, is the most
 * likely document in this product to carry one back.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { RETRIEVAL_DIR } from '../core/retrieval/mission.ts';
import { missionText, type MaterialPointer, type MissionRequest, type RetrievalMode }
  from '../core/retrieval/mission.ts';
import { queryFromPassage } from '../core/retrieval/from-selection.ts';
import { ConversationIndex } from '../core/conversation-index.ts';
import { searchArchive } from '../core/conversation-search.ts';
import {
  checkCitations, listResults, readResult, resultContract, resultPathFor, validateResult,
  type AgeReport, type Claim, type ResultSummary, type RetrievalResult,
} from '../core/retrieval/result.ts';
import {
  markReturn, returnReviewForm, returnShortfalls, type MarkedReturn, type RulingLookup,
} from '../core/retrieval/return.ts';
import { Store } from '../core/store.ts';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/** The repository root — `ws.projectRoot` is the `.my_context` directory. */
function repoRootOf(ws: Workspace): string {
  return path.dirname(ws.projectRoot ?? process.cwd());
}

/**
 * **The four ways in, §4, and all four ship** — owner ruling, restated in the
 * plan's Task 11 step 1.
 *
 * Served as DATA rather than spelled into the screen, for the reason
 * `FLAGLESS_COMMANDS` is data: "which modes exist" is a question the screen has
 * to be able to ask rather than a list two files keep in step by hand. The
 * label each one wears is in the string tables; what is here is the mode and
 * whether it needs a passage, which is the only thing that changes the form.
 */
export const RETRIEVAL_MODES: { mode: RetrievalMode; needsText: boolean }[] = [
  { mode: 'from-selection', needsText: true },
  { mode: 'free-text', needsText: true },
  { mode: 'list-subjects', needsText: false },
  { mode: 'list-anchors', needsText: false },
];

/* ── GET /api/retrieval — what has been asked before ─────────────────────── */

/** The list screen's answer. */
export interface RetrievalListBody {
  /** Newest first. Empty is a state, not an error. */
  results: ResultSummary[];
  /** Where results live, relative to the repository. Shown so the empty state can name it. */
  dir: string;
  /** Whether that directory exists yet. Nothing has ever been asked when it does not. */
  present: boolean;
  /**
   * **Whether `.gitignore` really ignores it** — the PRIVACY boundary, and the
   * plan's other named one.
   *
   * Results hold conversation text and the owner ruled conversation files stay
   * out of git. It is reported on the screen rather than only asserted in a
   * test because the test proves it TODAY and this proves it on the workspace
   * the reader is actually looking at, which may be a copy, a worktree, or a
   * checkout whose `.gitignore` somebody has edited.
   */
  ignored: boolean;
  modes: { mode: RetrievalMode; needsText: boolean }[];
}

export function apiRetrieval(ws: Workspace): JsonResult {
  const repo = repoRootOf(ws);
  const dir = RETRIEVAL_DIR.split(path.sep).join('/');
  let ignored = false;
  try {
    const gitignore = readFileSync(path.join(repo, '.gitignore'), 'utf8');
    ignored = gitignore.split(/\r?\n/).some((raw) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) return false;
      return line.replace(/^\//, '').replace(/\/$/, '') === dir;
    });
  } catch { ignored = false; }

  const body: RetrievalListBody = {
    results: listResults(repo),
    dir,
    present: existsSync(path.join(repo, RETRIEVAL_DIR)),
    ignored,
    modes: RETRIEVAL_MODES,
  };
  return { status: 200, body };
}

/* ── GET /api/retrieval/:id — one result, read and judged ────────────────── */

/** One claim as the screen numbers it. */
export interface ClaimView {
  /** 1-based, and the number he picks by. */
  n: number;
  text: string;
  citations: { kind: string; where: string }[];
}

export interface RetrievalResultBody {
  id: string;
  path: string;
  at: string;
  mode: string;
  missionPath: string | null;
  query: { names: string[]; terms: string[] } | null;
  claims: ClaimView[];
  /** What is wrong with it, before anybody acts on it. */
  findings: { kind: string; detail: string }[];
  /** Whether a citation no longer resolves. */
  age: AgeReport;
}

/** A citation rendered for a reader, never for a parser. */
function citationView(claim: Claim): { kind: string; where: string }[] {
  return claim.citations.map((citation) => {
    if (citation.kind === 'turn') {
      const where = citation.agentId === null
        ? citation.sessionId : `${citation.sessionId}/${citation.agentId}`;
      return { kind: 'turn', where: `${where}@${citation.byteOffset}` };
    }
    if (citation.kind === 'commit') return { kind: 'commit', where: citation.hash };
    return { kind: 'file', where: `${citation.file}:${citation.line}` };
  });
}

/**
 * The result named by `id`, or the refusal to answer with.
 *
 * **The absent case is a 404 and not a 400**, and the distinction is load-
 * bearing rather than pedantry: a malformed id is a caller fault, while an id
 * that names no file is the ordinary state of a workspace where nothing has
 * been asked yet. `test/ui/server-e2e.test.ts`' sweep accepts 200 and 404 and
 * refuses 400 for exactly this reason — a route that errors proves nothing
 * about whether it writes, and *there is nothing there* is the case that most
 * tempts a read into creating something.
 */
function loadFor(
  ws: Workspace, id: string,
): { result: RetrievalResult; file: string } | JsonResult {
  if (id === '' || /[\/]/.test(id) || id.includes('..')) {
    return badRequest(
      `"${id}" is not a result id. An id names a file in the retrieval directory and carries `
      + 'no path separators.',
    );
  }
  const file = resultPathFor(repoRootOf(ws), id);
  if (!existsSync(file)) {
    return {
      status: 404,
      body: {
        error:
          `there is no result "${id}". Nothing was read, and nothing was created — a read `
          + 'surface that built what it could not find would be this server’s one rule broken.',
      },
    };
  }
  try {
    return { result: readResult(file), file };
  } catch (err) {
    return badRequest(
      `the result "${id}" could not be read — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** True for the refusal half of `loadFor`'s answer. */
function refused(
  loaded: { result: RetrievalResult; file: string } | JsonResult,
): loaded is JsonResult {
  return (loaded as { result?: RetrievalResult }).result === undefined;
}

/*
 * **Only the file resolver has an answer here, and the other two say so.**
 *
 * `checkCitations` defaults the file-and-line check and takes the other two as
 * injections, because a turn needs the conversation index and a commit needs a
 * subprocess — and this surface opens neither. So both come back `unchecked`
 * rather than being folded into `resolved`, which is the whole reason
 * `unchecked` is a column of its own: `aged` is driven by `unresolved` alone,
 * and telling the owner a result has aged because nobody handed in a resolver
 * would be telling him something false. `INV-nothing-is-dropped-silently`.
 */

export function apiRetrievalResult(ws: Workspace, id: string): JsonResult {
  const loaded = loadFor(ws, id);
  if (refused(loaded)) return loaded;
  const { result, file } = loaded;
  const repo = repoRootOf(ws);

  const body: RetrievalResultBody = {
    id: result.id,
    path: path.relative(repo, file).split(path.sep).join('/'),
    at: result.at,
    mode: result.mode,
    missionPath: result.missionPath ?? null,
    query: result.query,
    claims: result.claims.map((claim, index) => ({
      n: index + 1, text: claim.text, citations: citationView(claim),
    })),
    findings: validateResult(result),
    age: checkCitations(repo, result),
  };
  return { status: 200, body };
}

/* ── POST /api/retrieval/mission — compose one, and write nothing ────────── */

/**
 * **What a mission would say, shown before anything is dispatched.**
 *
 * `missionText` is pure and `writeMission` is not, and only the pure one is
 * reachable from here. The screen shows the text and composes the two things a
 * person does with it: copy it into a fresh window, or save it beside the
 * result. Both are his act.
 *
 * The passage arrives in the BODY and never in the query string. A copied
 * passage is conversation text and a query string reaches the server log, the
 * browser history and the referer header; this project keeps conversation text
 * out of git for the same reason and the reason does not stop at git.
 */
export interface MissionComposeBody {
  text: string;
  /** What the passage was reduced to, so *nothing to match on* can be SHOWN. */
  query: { names: string[]; terms: string[]; matchable: boolean; note: string | null };
  /** Where the subagent would be told to write. */
  resultPath: string;
  id: string;
}

/** The scope a mission request asked for, normalised. */
function request0Scope(input: Record<string, unknown>): {
  sessionId: string | null; from: string | null; to: string | null;
} {
  const scope = input['scope'];
  if (scope === null || typeof scope !== 'object' || Array.isArray(scope)) {
    return { sessionId: null, from: null, to: null };
  }
  const asked = scope as Record<string, unknown>;
  return {
    sessionId: typeof asked['sessionId'] === 'string' && asked['sessionId'] !== ''
      ? asked['sessionId'] : null,
    from: typeof asked['from'] === 'string' && asked['from'] !== '' ? asked['from'] : null,
    to: typeof asked['to'] === 'string' && asked['to'] !== '' ? asked['to'] : null,
  };
}

/** Most points one mission carries. A subagent with 400 places to read has no brief. */
const POINTER_CAP = 60;

/**
 * **The material — the points in the archive the subagent is to OPEN.**
 *
 * A mission with an empty pointer table is the defect this exists to close: it
 * tells a helper to *"open it at these points"* and then names none, which
 * reads as a working brief and answers nothing. It was found by driving the
 * screen rather than by a unit test, which is exactly what the browser is for.
 *
 * Each NAME the passage carried is searched for separately and the hits are
 * merged, rather than one query being built out of all of them: the names are
 * alternatives, not a conjunction — a passage that mentions two item ids is
 * about both, and a turn naming either is material. §3's measurement is what
 * makes the per-name search the right unit at all (item-id slugs matched 68%
 * against this archive where a word-bag matched 32%).
 *
 * **It is a READ, and it creates nothing.** `openReadOnlyChecked` cannot build
 * the index it reads, so an archive nobody has scanned yields no points and
 * SAYS so through the empty table rather than being quietly filled in — the
 * same refusal `read-model-conversations.ts` makes one module over, and
 * `test/ui/server-e2e.test.ts` is what proves nothing is written.
 *
 * A name shorter than the index’s trigram run cannot be searched for at all;
 * `searchArchive` says so rather than answering "nothing found", and such a
 * name simply contributes no points here.
 */
function pointersFor(
  ws: Workspace,
  names: readonly string[],
  scope: { sessionId: string | null; from: string | null; to: string | null },
): MaterialPointer[] {
  if (names.length === 0) return [];
  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch {
    // An archive nobody has scanned. The mission then carries no points, which
    // is honest: there is nothing to open.
    return [];
  }
  try {
    const seen = new Set<string>();
    const out: MaterialPointer[] = [];
    const files = new Map<string, string | null>();
    for (const name of names) {
      if (out.length >= POINTER_CAP) break;
      const found = searchArchive(index, name, {
        sessionId: scope.sessionId ?? undefined,
        limit: POINTER_CAP,
      });
      for (const hit of found.hits) {
        if (out.length >= POINTER_CAP) break;
        // Two names matching one turn is one point, not two.
        const key = `${hit.sessionId}\u0000${hit.agentId ?? ''}\u0000${hit.byteOffset}`;
        if (seen.has(key)) continue;
        // The date scope, applied here because `matchProse` does not take one:
        // a turn with no stamp is KEPT rather than dropped, since "undated" is
        // not "outside the range" and dropping it would lose it silently.
        if (hit.at !== null) {
          const day = hit.at.slice(0, 10);
          if (scope.from !== null && day < scope.from) continue;
          if (scope.to !== null && day > scope.to) continue;
        }
        if (!files.has(hit.sessionId)) {
          files.set(hit.sessionId, index.get(hit.sessionId)?.file ?? null);
        }
        const file = files.get(hit.sessionId) ?? null;
        if (file === null) continue;
        seen.add(key);
        out.push({
          sessionId: hit.sessionId,
          agentId: hit.agentId,
          file,
          recordIndex: hit.recordIndex,
          byteOffset: hit.byteOffset,
          stance: hit.kind,
          tool: null,
          at: hit.at,
        });
      }
    }
    // Chronological, because the mission asks for a chronological account and
    // a table in score order would be asking the subagent to sort it.
    out.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '') || a.byteOffset - b.byteOffset);
    return out;
  } finally {
    index.close();
  }
}

export function apiRetrievalMission(ws: Workspace, raw: unknown): JsonResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return badRequest('the body must be an object');
  }
  const input = raw as Record<string, unknown>;
  const mode = String(input['mode'] ?? '');
  if (!RETRIEVAL_MODES.some((entry) => entry.mode === mode)) {
    return badRequest(
      `"${mode}" is not one of the four modes: `
      + `${RETRIEVAL_MODES.map((entry) => entry.mode).join(', ')}.`,
    );
  }
  // **Task 12 — rounds compose**, parsed before the passage is required,
  // because a second round HAS its subject: he picked one out of the last
  // result, and that subject is what this round is querying with. Demanding a
  // passage as well would be asking him to retype what he just clicked.
  const rawRound = input['round'];
  let round: { n: number; subject: string; from: string } | null = null;
  if (rawRound !== null && typeof rawRound === 'object' && !Array.isArray(rawRound)) {
    const asked = rawRound as Record<string, unknown>;
    const n = Number(asked['n'] ?? 2);
    const subject = String(asked['subject'] ?? '');
    const from = String(asked['from'] ?? '');
    if (subject === '' || from === '') {
      return badRequest(
        'a second round names the subject he chose and the result it was listed in. Without '
        + 'both, it is a first round wearing a number.',
      );
    }
    round = { n: Number.isInteger(n) && n > 1 ? n : 2, subject, from };
  }

  const typed = typeof input['passage'] === 'string' ? input['passage'] : '';
  const passage = typed.trim() === '' && round !== null ? round.subject : typed;
  const needsText = RETRIEVAL_MODES.find((entry) => entry.mode === mode)?.needsText === true;
  if (needsText && round === null && passage.trim() === '') {
    return badRequest(
      `the "${mode}" mode is a passage, and none was given. A round with nothing in it would `
      + 'have to guess a subject, and a guess that resolves is worse than silence.',
    );
  }

  const repo = repoRootOf(ws);
  const at = new Date().toISOString();
  const id = `recall-${at.replace(/[:.]/g, '-')}`;
  const query = queryFromPassage(passage);

  const pointers = pointersFor(ws, query.names, request0Scope(input));
  const request: MissionRequest = {
    id,
    mode: mode as RetrievalMode,
    at,
    repoRoot: repo,
    resultPath: path.relative(repo, resultPathFor(repo, id)).split(path.sep).join('/'),
    query: query.matchable ? { names: query.names, terms: query.terms } : null,
    pointers,
    resultShape: resultContract(),
  };
  const scope = input['scope'];
  if (scope !== null && typeof scope === 'object' && !Array.isArray(scope)) {
    const asked = scope as Record<string, unknown>;
    request.scope = {
      sessionId: typeof asked['sessionId'] === 'string' ? asked['sessionId'] : null,
      from: typeof asked['from'] === 'string' ? asked['from'] : null,
      to: typeof asked['to'] === 'string' ? asked['to'] : null,
    };
  }
  if (round !== null) request.round = round;

  const body: MissionComposeBody = {
    text: missionText(request),
    query: {
      names: query.names, terms: query.terms, matchable: query.matchable, note: query.note,
    },
    resultPath: request.resultPath,
    id,
  };
  return { status: 200, body };
}

/* ── POST /api/retrieval/return — mark a choice, for either destination ──── */

/**
 * **Whether a ruling still stands, read out of this corpus, read-only.**
 *
 * The lookup is built here and HANDED to `markReturn`, which is
 * `CitationResolvers`' shape one module over and keeps `retrieval/return.ts`
 * free of a database handle. A corpus that will not open answers `null` for
 * every id, and the marking then says *named, and not found* rather than
 * passing them silently.
 */
function rulingLookup(ws: Workspace): RulingLookup {
  let byId: Map<string, { status: string; supersededBy: string | null }> | null = null;
  try {
    const store = Store.openReadOnlyChecked(ws.dbPath);
    try {
      byId = new Map(store.all().map((item) => [item.id, {
        status: item.status as string,
        supersededBy: item.relations.find((r) => r.type === 'superseded_by')?.target ?? null,
      }]));
    } finally { store.close(); }
  } catch { byId = null; }
  return (id: string) => {
    const row = byId?.get(id);
    return row === undefined ? null : { id, status: row.status, supersededBy: row.supersededBy };
  };
}

export interface RetrievalReturnBody {
  /** The marked text. Exactly what would arrive, in either destination. */
  text: string;
  /** What he reads before approving a staged one. */
  reviewForm: string;
  /** Every way this is partial, in words. */
  shortfalls: string[];
  reversed: { id: string; status: string; supersededBy: string | null }[];
  unknown: string[];
  chosen: number[];
  left: number;
  at: string;
  /**
   * **The command that puts it in a FRESH window** — spec §10a, D34's carrier.
   *
   * Composed and never run. `mycontext restore --build --from-result` stages
   * it as a PROPOSAL; `--approve` is the owner's act and refuses any actor but
   * him; the clear is his and has no verb anywhere in this product. A browser
   * that could run this would be the read-only guarantee failing at the one
   * place a new feature most wants to break it.
   */
  stageArgv: string[];
}

export function apiRetrievalReturn(ws: Workspace, raw: unknown): JsonResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return badRequest('the body must be an object');
  }
  const input = raw as Record<string, unknown>;
  const loaded = loadFor(ws, String(input['id'] ?? ''));
  if (refused(loaded)) return loaded;
  const { result, file } = loaded;

  const asked = input['claims'];
  const chosen = Array.isArray(asked)
    ? asked.map((value) => Number(value))
    : result.claims.map((_claim, index) => index + 1);

  let marked: MarkedReturn;
  try {
    marked = markReturn(result, chosen, rulingLookup(ws));
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }

  const relative = path.relative(repoRootOf(ws), file).split(path.sep).join('/');
  const stageArgv = ['mycontext', 'restore', '--build', '--from-result', relative];
  if (marked.left > 0) stageArgv.push('--claims', marked.chosen.join(','));

  const body: RetrievalReturnBody = {
    text: marked.text,
    reviewForm: returnReviewForm(marked, relative),
    shortfalls: returnShortfalls(marked),
    reversed: marked.reversed,
    unknown: marked.unknown,
    chosen: marked.chosen,
    left: marked.left,
    at: marked.at,
    stageArgv,
  };
  return { status: 200, body };
}

export function registerRetrievalRoutes(): void {
  registerRoute('GET', '/api/retrieval', {
    kind: 'json', handle: (ctx: ApiContext) => apiRetrieval(ctx.ws),
  });
  // **`/mission` and `/return` before `/:id`.** The router matches in
  // registration order, and `/api/retrieval/:id` would otherwise swallow them
  // and answer 404 on a working feature — the worst kind of 404, and the same
  // reason `/search` is registered before `/:id` one module over.
  registerRoute('POST', '/api/retrieval/mission', {
    kind: 'json', handle: (ctx: ApiContext) => apiRetrievalMission(ctx.ws, ctx.body),
  });
  registerRoute('POST', '/api/retrieval/return', {
    kind: 'json', handle: (ctx: ApiContext) => apiRetrievalReturn(ctx.ws, ctx.body),
  });
  registerRoute('GET', '/api/retrieval/:id', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiRetrievalResult(ctx.ws, ctx.params['id'] ?? ''),
  });
}
