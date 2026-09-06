/**
 * **`GET /api/staging` — the rule candidates waiting for a human, served by a
 * module that cannot write one.**
 *
 * Owner ruling `DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read`
 * (2026-09-06), unblocking the `key` field on `lesson-accept` and
 * `lesson-discard`.
 *
 * ── WHAT WAS IN THE WAY, MEASURED ─────────────────────────────────────────
 *
 * `listStaging` lived in `lesson/derive.ts`, which VALUE-IMPORTS `createItem`
 * from `core/mutate.ts`. Measured on the runtime import graph — type-only
 * imports erased, which `tsconfig.json`'s `verbatimModuleSyntax` +
 * `erasableSyntaxOnly` make exact — `lesson/derive.ts` reaches 36 files
 * including `core/mutate.ts` and, through it, `core/persist.ts`: the code that
 * writes item Markdown to disk. Two surfaces had already refused this read
 * rather than pay that, and both named it an owner's ruling to make:
 * `read-model.ts`' `StatusBody` on the status screen's `st.staged` row, and
 * `palette-defs.js` on this very field.
 *
 * The read half is now `lesson/staging.ts`, whose runtime graph is ONE file —
 * itself — with no project import at all and only `node:fs` and `node:path`
 * bare. This module imports that and the route table, and nothing else that
 * touches a corpus.
 *
 * `test/ui/staging-endpoint.test.ts` walks both graphs and fails if
 * `core/mutate.ts`, `core/persist.ts`, `lesson/derive.ts`, `src/cli/index.ts`,
 * `src/ui/execute*.ts` or `node:child_process` becomes reachable from either —
 * with a control that proves the walk can still FAIL. Without that the split
 * would be a claim about today's imports rather than a bound on tomorrow's,
 * which is the distinction `command-check.test.ts` was built to hold and the
 * one the ruling asks for by name.
 *
 * ── ITS OWN MODULE RATHER THAN A FUNCTION IN `read-model.ts` ──────────────
 *
 * `read-model.ts` reaches `doctor/checks.ts`, which imports
 * `node:child_process`, and it is 4,000 lines that three lanes edit. Serving
 * this from there would put a process spawner into the graph this file's whole
 * promise is about and collide with work in flight. `read-model-command.ts` is
 * the precedent — same reason, same shape, `registerCommandRoutes` called from
 * `registerReadRoutes` — and this follows it down to spelling `badRequest` and
 * the parameter refusal locally rather than importing five lines and the
 * spawner behind them.
 *
 * ── IT READS; IT DOES NOT RULE ────────────────────────────────────────────
 *
 * Every candidate is served with its `state`, including the accepted and the
 * discarded ones, and this endpoint filters none of them out. `lesson-accept`
 * refuses an accepted or a discarded candidate and `lesson-discard` refuses an
 * accepted one, so a picker will want to narrow — but WHICH of the two
 * commands is being composed is the composer's fact, not this endpoint's, and
 * a read that pre-filtered for one of them would be lying to the other. That
 * matters more than it sounds: measured on this corpus 2026-09-07, all 11
 * candidates across all 5 staging files are `accepted`, so a filtered endpoint
 * would serve an empty body and be indistinguishable from a broken one.
 */
import {
  readStagingDir, type SkippedStaging, type StagedRule,
} from '../lesson/staging.ts';
import type { Workspace } from '../core/workspace.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * **`badRequest` and the parameter refusal are spelled here rather than
 * imported from `read-model.ts`, for the reason `read-model-command.ts`
 * measured and wrote down.**
 *
 * `read-model.ts` imports `doctor/checks.ts` — reasonably, for `/api/doctor` —
 * and `doctor/checks.ts` imports `node:child_process`. Importing two helpers
 * totalling five lines therefore puts a process spawner into this module's
 * import graph, and the guard test catches it on the first run. The wording is
 * `read-model.ts`' verbatim so a reader meets one sentence and not two, and
 * there is nothing here to drift: a 400 and an `{ error }` envelope.
 *
 * Lifting the pair into a shared module of their own is the tidier fix, is now
 * wanted by two files rather than one, and is still not a lane's to take while
 * `read-model.ts` is being edited beside it. It is named in the report.
 */
const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/** `read-model.ts` · `unknownParams`, for the empty allow-list case only. */
function refuseAnyParameter(url: URL): string | null {
  for (const key of url.searchParams.keys()) {
    return `unknown parameter "${key}" — this endpoint accepts no parameters. `
      + 'A parameter accepted and ignored would silently answer a different question.';
  }
  return null;
}

/**
 * One lesson that has staging, and the tally of what is in it — never the
 * candidates themselves, which are in the flat list below.
 *
 * The two lists are a split, not a duplication: nothing appears in both. A
 * reader asking *"what is waiting?"* wants this one and can count without
 * scanning; a picker asking *"which keys may I offer for the lesson the reader
 * chose?"* wants the flat one, because that is the shape `narrowedOptions`
 * (`public/screens/palette.js`) filters — one row per option, carrying the
 * value it is narrowed by.
 */
export interface StagedLessonSummary {
  lessonId: string;
  /** ISO 8601, as `stageRuleCandidates` wrote it. */
  createdAt: string;
  candidates: number;
  pending: number;
  accepted: number;
  discarded: number;
}

/**
 * One staged rule candidate, flattened onto its lesson.
 *
 * `lessonId` rides on every row because the row is meaningless without it:
 * `key` is a checksum of the candidate's CONTENT (`candidateKey`,
 * `lesson/derive.ts`), so it is unique within a lesson and says nothing about
 * which lesson. `mycontext lesson-accept <lessonId> <key>` takes both, and a
 * key offered without the lesson it belongs to composes a line the CLI refuses.
 *
 * The candidate's own fields are flattened rather than nested under
 * `candidate:` as they are on disk. A picker labels with `title` and
 * `directive`; a reader confirming what they are about to make governing wants
 * `body`, `severity` and `scope`, which is what `lesson-accept` prints before
 * it acts. Both read them at one level here.
 */
export interface StagedCandidate {
  lessonId: string;
  key: string;
  state: 'pending' | 'accepted' | 'discarded';
  /** The rule this became, or `null` while it is pending or discarded. */
  ruleId: string | null;
  title: string;
  directive: string;
  severity: string;
  scope: string[];
  body: string;
}

/** A candidate inside a readable staging file that this endpoint could not project. */
export interface MalformedCandidate {
  lessonId: string;
  /** Its position in that file's `candidates` array — the only handle it has. */
  index: number;
  reason: string;
}

export interface StagingBody {
  lessons: StagedLessonSummary[];
  candidates: StagedCandidate[];
  counts: {
    lessons: number;
    candidates: number;
    pending: number;
    accepted: number;
    discarded: number;
  };
  /** Files under `.staging/` this sweep would not read — `readStagingDir`'s own list. */
  skipped: SkippedStaging[];
  /** Rows inside files it DID read that it could not project. */
  malformed: MalformedCandidate[];
}

const STATES = ['pending', 'accepted', 'discarded'];

/**
 * Project one on-disk `StagedRule`, or say why not.
 *
 * `readStagingDir` checks the FILE — its protocol, its identity, that
 * `candidates` is an array. It deliberately does not walk into the rows,
 * because a sweep that refused a whole file over one bad row would hide four
 * good ones. So the rows are checked here, at the one place they are turned
 * into a body, and a row that cannot be turned into one becomes a
 * `malformed` entry rather than a `null` in the list or a 500 for the whole
 * request. `.staging/` is unauthenticated working state — `loadStaging` says
 * so in as many words — so "the shape on disk is the shape in the type" is an
 * assumption this endpoint may not make.
 */
function project(lessonId: string, row: unknown, index: number):
{ ok: true; value: StagedCandidate } | { ok: false; reason: string } {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    return { ok: false, reason: `it is ${row === null ? 'null' : Array.isArray(row) ? 'an array' : `a ${typeof row}`}, not an object` };
  }
  const staged = row as unknown as StagedRule;
  if (typeof staged.key !== 'string' || staged.key === '') {
    return { ok: false, reason: `its "key" is ${JSON.stringify(staged.key)}, and a candidate with no key cannot be named on a command line` };
  }
  if (!STATES.includes(staged.state as string)) {
    return { ok: false, reason: `its "state" is ${JSON.stringify(staged.state)}, not one of ${STATES.join(', ')}` };
  }
  const candidate = staged.candidate;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return { ok: false, reason: `its "candidate" is ${candidate === null ? 'null' : typeof candidate}, not an object` };
  }
  if (typeof candidate.title !== 'string' || candidate.title === '') {
    return { ok: false, reason: `its candidate has no "title", so there is nothing to show a reader` };
  }
  const scope = Array.isArray(candidate.scope)
    ? candidate.scope.filter((s: unknown): s is string => typeof s === 'string')
    : [];
  return {
    ok: true,
    value: {
      lessonId,
      key: staged.key,
      state: staged.state,
      ruleId: typeof staged.ruleId === 'string' ? staged.ruleId : null,
      title: candidate.title,
      directive: typeof candidate.directive === 'string' ? candidate.directive : '',
      severity: typeof candidate.severity === 'string' ? candidate.severity : '',
      scope,
      body: typeof candidate.body === 'string' ? candidate.body : '',
    },
  };
}

/**
 * `GET /api/staging` — every rule candidate under `.my_context/.staging/`,
 * with the lesson it came from and what a human has already ruled about it.
 *
 * **The contract, so the picker that follows is a one-line change.**
 *
 *   - `lessons[]` — one row per staging file, with `lessonId`, `createdAt` and
 *     a four-way tally. This is the `id` vocabulary: the lesson ids
 *     `lesson-accept` and `lesson-discard` will actually find staging for.
 *   - `candidates[]` — one row per (lesson, key), flat, each carrying its own
 *     `lessonId`. This is the `key` vocabulary, in exactly the shape
 *     `narrowedOptions` filters: `{ value: key, label: …, item: lessonId }`
 *     falls out of it with no reshaping, because `dependsOn: 'id'` matches on
 *     a row's `item`.
 *   - `counts` — the same tallies summed, so the status screen's `st.staged`
 *     row can be filled without walking the lists.
 *   - `skipped[]` and `malformed[]` — what was NOT served, and why, in words.
 *
 * **Nothing is dropped silently, and a picker is where that stops being a
 * slogan.** A `key` box that quietly omits the lesson a reader is looking for
 * reads to them as *"there is nothing staged for it"* — an absence that looks
 * like an answer. `INV-nothing-is-dropped-silently` is the rule; these two
 * lists are how this endpoint keeps it. Both are normally empty, and both are
 * always present so a caller cannot forget to look.
 *
 * **No parameters, and no filter by state.** The whole directory is five files
 * and eleven candidates on this corpus — there is nothing here to paginate,
 * and a `?state=pending` would be this endpoint deciding which command the
 * reader is composing. See the module comment.
 *
 * **A workspace with no project root answers `200` with an empty body**, which
 * is `apiTutorials`' precedent for the same impossible state. `mycontext ui`
 * refuses to start without one (`server.ts` · *"no workspace here"*), so the
 * branch exists to be total rather than to be reached.
 */
export function apiStaging(ws: Workspace, url: URL): JsonResult {
  const bad = refuseAnyParameter(url);
  if (bad) return badRequest(bad);

  const body: StagingBody = {
    lessons: [], candidates: [],
    counts: { lessons: 0, candidates: 0, pending: 0, accepted: 0, discarded: 0 },
    skipped: [], malformed: [],
  };
  const root = ws.projectRoot;
  if (root === null) return { status: 200, body };

  const { staging, skipped } = readStagingDir(root);
  body.skipped = skipped;

  for (const one of staging) {
    const summary: StagedLessonSummary = {
      lessonId: one.lessonId,
      createdAt: typeof one.createdAt === 'string' ? one.createdAt : '',
      candidates: 0, pending: 0, accepted: 0, discarded: 0,
    };
    one.candidates.forEach((row: unknown, index: number) => {
      const projected = project(one.lessonId, row, index);
      if (!projected.ok) {
        body.malformed.push({ lessonId: one.lessonId, index, reason: projected.reason });
        return;
      }
      body.candidates.push(projected.value);
      summary.candidates += 1;
      summary[projected.value.state] += 1;
    });
    body.lessons.push(summary);
    body.counts.candidates += summary.candidates;
    body.counts.pending += summary.pending;
    body.counts.accepted += summary.accepted;
    body.counts.discarded += summary.discarded;
  }
  body.counts.lessons = body.lessons.length;
  return { status: 200, body };
}

export function registerStagingRoutes(): void {
  registerRoute('GET', '/api/staging', {
    kind: 'json', handle: (ctx: ApiContext) => apiStaging(ctx.ws, ctx.url),
  });
}
