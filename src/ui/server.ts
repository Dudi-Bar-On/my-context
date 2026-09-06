/**
 * The HTTP surface: dispatch, the security gate, the handoff nonce exchange,
 * and the process's own ephemerality.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §2 (the token, the
 * custom header, Host/Origin, the response headers) and §3 (opening the
 * browser, the idle exit). Plan:
 * `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` Task 13.
 *
 * **Dispatch order, and why each step is where it is.**
 *
 *   1. **Anything outside `/api/` goes to `serveStatic`, before the gate.** The
 *      page cannot present a token it has not loaded the code to fetch, so the
 *      page's own bytes are the one surface that answers without one.
 *      `static.ts` carries the three refusals that make that safe; this module
 *      supplies the headers it deliberately does not set.
 *   2. **`POST /api/handoff` is Host/Origin-checked and token-EXEMPT.** It is
 *      how the page first obtains the token. The exemption is keyed on
 *      `gate.check === 'token-missing'` — the closed vocabulary — and never on
 *      the status code: three of the gate's five refusing exits answer `403`,
 *      so a status cannot say which check refused, which is the reason `check`
 *      exists (plan §0.6 field rule 1).
 *   2b. **`POST /api/nonce` is the same exemption, for a caller holding NO
 *      credential at all** (owner ruling 2026-08-28,
 *      `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 *      out-the-next-one`). It mints a fresh handoff nonce from a server that is
 *      already running, so `mycontext ui --nonce` never has to restart one to
 *      recover a locked-out tab. Held to exactly the gate handoff is: loopback
 *      Host, matching Origin, POST only — and every mint is audited via
 *      `recordNonceMint` (`security.ts`), because a credential coming into
 *      existence is a security event whether or not anything was refused. See
 *      that function for why this route is strictly MORE powerful than
 *      handoff, and why that residual was accepted anyway.
 *   3. **Every other `/api` path passes the full gate**, then `idle.touch()`
 *      for a matched non-stream route, then the handler. An open stream is not
 *      activity (spec §2), so plan 3's stream route inherits ephemerality
 *      without having to remember it. Neither 2 nor 2b touches idle either —
 *      see the mint branch below for why.
 *
 * **A refusal is a status line and nothing else** (owner ruling A4, plan §0.6):
 * see `sendRefusal`, which has no parameter a body could be passed in.
 *
 * **A refusal is recorded** (owner ruling B4, plan §0.6): see `refuse`, which
 * calls `recordRefusal` — one of the two writes this read-only surface
 * performs, on the refusal path only. `test/ui/server-e2e.test.ts` proves both
 * halves: that a full sweep of every registered read route changes not one
 * byte of the corpus, and that a refused request appends exactly one audit
 * record and nothing else. **A mint is recorded too** (owner ruling
 * 2026-08-28): see the `POST /api/nonce` branch below and `recordNonceMint`.
 *
 * **`ping` and `meta` are REGISTERED routes, not branches in the dispatch
 * loop** — a correction to the plan's sample code, which special-cased both
 * above `matchRoute`. Two things fall out of registering them, and both are
 * properties the special cases only promised: they take the same
 * `idle.touch()`, the same headers and the same 405-shaped fallthrough as every
 * other route, and — the load-bearing half — they appear in `registeredRoutes()`,
 * which is what lets the E2E's no-write sweep assert that its route list covers
 * the real table instead of being a hand-maintained copy beside it. `routes.ts`
 * says that is what `registeredRoutes()` is for; the plan's own sample then
 * hand-maintained the list anyway.
 *
 * `/api/handoff` and `/api/nonce` both stay out of the table, because a
 * registered route is a route behind the gate and both of their whole jobs is
 * to be routes that are not.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { AUDIT_KINDS, AUDIT_OPS, type RefusalCheck } from '../core/audit.ts';
import { readOccupancy, type Occupancy } from '../core/context-occupancy.ts';
import { measureCorpusDrift } from '../core/corpus-drift.ts';
import { isMainEntry } from '../core/paths.ts';
// The two closed vocabularies `/api/meta` now serves, each imported from the
// module that DECLARES it rather than restated here. `core/teach.ts` imports
// nothing at all — it is a leaf precisely so a module-scope reader cannot
// enter a cycle — and `core/validate.ts` is the module that enforces
// `STATUSES`, which is the same rule `core/command-flags.ts` follows when it
// builds `--status`' own declaration from it.
import { HELP_TOPICS } from '../core/teach.ts';
import { STATUSES } from '../core/validate.ts';
import { VERSION } from '../core/version.ts';
import { liveWorkspace, repositoryRoot, type Workspace } from '../core/workspace.ts';
import { registerAskRoutes } from './ask-model.ts';
import { stampCodeIdentity, type CodeScope } from '../core/code-identity.ts';
import { registerCaptureRoutes } from './capture-model.ts';
import { CLI_ENTRY, registerExecuteRoutes } from './execute.ts';
import { ExecutionNonceStore } from './execute-nonce.ts';
import { registerPacksRoutes } from './packs-model.ts';
import { registerPortRoutes } from './port-model.ts';
import { registerPreviewHistoryRoutes } from './preview-history.ts';
import { registerProcedureRoutes } from './proc-model.ts';
import { readGitInfo } from './git-info.ts';
import { IDLE_MS, IdleMonitor } from './idle.ts';
import {
  apiCoverage, apiDecay, apiDoc, apiDocList, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem,
  apiItems, apiRender, apiSelect, apiSessions, apiSimulate, apiSimulateSweep, apiStatus, apiTags,
  apiTutorials, apiTutorialDoc,
} from './read-model.ts';
import { registerFlagRoutes } from './read-model-flags.ts';
import { registerConfigRoutes } from './read-model-config.ts';
import { registerWorkRoutes } from './read-model-work.ts';
import { matchRoute, registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { loadSessionDigests, recordSessionDigest } from '../core/ui-sessions.ts';
import {
  clearUiServerRecord, uiServerRecordPath, writeUiServerRecord,
} from '../core/ui-server-record.ts';
import {
  cookieValue, CREDENTIAL_COOKIE, mintToken, NonceStore, recordNonceMint, recordRefusal,
  SECURITY_HEADERS, TOKEN_COOKIE, TOKEN_HEADER, tokenDigest, validateApiRequest,
} from './security.ts';
import { serveStatic } from './static.ts';
import { registerWatchRoutes } from './watch-model.ts';

/** Ten seconds: the nonce that transits a process command line (spec §3). */
export const OPENER_NONCE_TTL_MS = 10_000;
/** Ten minutes: the nonce in a PRINTED url (--no-open / spawn fallback) — never on a command line. */
export const PRINTED_NONCE_TTL_MS = 600_000;
/**
 * Thirty seconds: the nonce `POST /api/nonce` mints (owner ruling 2026-08-28).
 *
 * **Deliberately shorter than `PRINTED_NONCE_TTL_MS`, and the two windows are
 * sized for different moments even though both end up as a URL a person
 * pastes.** `PRINTED_NONCE_TTL_MS` covers a server that just started, which an
 * operator may walk away from before coming back to read the terminal — that
 * is the case `printedNonceTtl()` (`cli/commands/ui.ts`) was widened for on
 * 2026-08-23, up to the whole idle window. This nonce covers the opposite
 * moment: `mycontext ui --nonce` is typed by someone already AT the terminal,
 * for a tab they are looking at RIGHT NOW, and the printed line is read and
 * pasted in the same sitting or not at all — there is no "return later" case
 * to size for.
 *
 * **Deliberately longer than `OPENER_NONCE_TTL_MS`.** That ten-second window
 * is sized for a nonce that transits a process command line — an OS spawning a
 * child, measured in milliseconds. This one transits a PERSON: read a line off
 * a terminal, switch windows, paste it into an address bar. Ten seconds is
 * comfortable for a machine and tight for a hand.
 *
 * **Why short matters more here than for either of those two.** This route is
 * reachable at ANY point while the server is up, by any local process that can
 * reach loopback (see `recordNonceMint` in `security.ts` for the residual that
 * follows from that). A short TTL does not narrow WHO can call the route — it
 * narrows how long a credential that already left the process over HTTP stays
 * good for, which is the one thing left to bound once the route itself is
 * accepted: a terminal window left visible on a shared screen, a scrollback
 * buffer, a copied line sitting in clipboard history, are all a live
 * credential for thirty seconds and inert paper after it.
 *
 * ── UPDATE 2026-09-03: THIS IS NOW THE DEFAULT, NOT THE ONLY, ANSWER ───────
 *
 * `mycontext ui --nonce` used to print this nonce unconditionally — which
 * means the paragraph above, "typed by someone already AT the terminal … the
 * printed line is read and pasted in the same sitting", was a claim about a
 * HUMAN consuming it. Measured that day: the owner hit a dead page repeatedly
 * because a human does not reliably clear thirty seconds between reading a
 * line and a tab finishing its handoff. The ruling did not change; the
 * consumer did. `cli/commands/ui.ts`'s `deliverNonce` now hands this nonce to
 * a BROWSER it spawns itself (`openBrowser`, `ui/open.ts`) unless `--no-open`
 * says otherwise — a spawn measured in milliseconds, so thirty seconds is
 * still ample and this constant is untouched. What moved is who is asked to
 * be fast.
 *
 * A caller that still needs a human to carry the link — `--nonce --no-open`,
 * or this route's own no-browser fallback — asks instead for
 * `PRINTED_NONCE_TTL_MS` by sending `?ttl=printed` (see the route below).
 * That does not widen WHO may call this route or what the resulting TOKEN is
 * good for once redeemed — both are already the residual `recordNonceMint`
 * documents, unmoved by which of two fixed windows the intermediate nonce
 * gets — it only lets an explicitly-human path have the window
 * `PRINTED_NONCE_TTL_MS` already argues for, instead of reusing a window sized
 * for a process.
 */
export const MINT_NONCE_TTL_MS = 30_000;

/**
 * **The start-time half of `plan:live seq:12`.**
 *
 * A sentence at start is cheaper than a banner and it catches the case before
 * anybody is confused — but it CANNOT catch the reader who has had the tab open
 * since the morning, which is the case that actually cost a bug report. So it
 * is added AS WELL AS the banner, never instead of it, and it says the two
 * halves out loud rather than only naming the remedy: a person who knows that
 * assets are live and modules are not can predict the symptom instead of
 * reporting it.
 *
 * Printed by `src/cli/commands/ui.ts`, which owns every line this command puts
 * on a terminal; this module's own main entry still prints EXACTLY the one URL
 * line its harness reads as a readiness signal.
 */
export const CODE_FREEZE_NOTICE =
  'mycontext ui: this server will not pick up code changes without a restart — ' +
  'the browser assets under src/ui/public/ are read live from disk on every request, ' +
  "but the server's own modules are frozen at start.";

export interface UiServerOptions {
  /** Workspace resolution root. */
  cwd: string;
  /** `0` — the default — asks the OS for a free port. */
  port?: number;
  /** MUST be `127.0.0.1`; anything else is refused at startup (spec §2.1). */
  host?: string;
  /** The idle window; tests shrink it. `IdleMonitor` owns what is a legal value. */
  idleMs?: number;
  onExit?: (reason: 'idle' | 'closed') => void;
  /** Test-only override for handoff nonce ttl; production callers omit it. */
  nonceTtlMs?: number;
  /**
   * The pair whose contents decide whether this process is running stale code:
   * this server's own module, and the directory it serves. Defaulted below from
   * `import.meta.filename` and `PUBLIC_DIR` — the file names ITSELF, and the
   * constant `serveStatic` is already called with — so neither half is a path
   * anybody typed and neither can drift from what the server actually loads.
   *
   * A caller supplies it only to point the measurement at a tree it can safely
   * change under a running server, which is how `test/ui/code-skew.test.ts`
   * drives the disclosure without editing the tree every other test in the
   * suite is reading.
   */
  code?: CodeScope;
  /**
   * Told when a file in the GLOBAL directory could not be read or written,
   * with a sentence naming the file and what it costs. Not an error: the server
   * serves either way. Omitting this handler discards the notice, which is a
   * caller's choice to make and not a default this module takes on its behalf.
   *
   * **Two files reach it, not one**: `ui-sessions.json` (the digests of issued
   * tokens) and, since 2026-08-27, `ui-server.json` (the liveness record). The
   * name kept its original spelling on purpose — `src/cli/commands/ui.ts` is
   * the only caller that supplies this handler, and renaming the key would
   * have meant editing that file to say the same thing to the same printer.
   * What the two failures have in common is what this channel is actually for:
   * both are machine state beside the corpus, both cost something LATER and
   * somewhere else, and neither is a reason to refuse to serve now. Each
   * message names its own file, so a reader is never left guessing which.
   */
  onSessionStoreIssue?: (message: string) => void;
}

export interface RunningUiServer {
  port: number;
  /** URL carrying a fresh one-shot handoff nonce in the FRAGMENT. */
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

let routesRegistered = false;

/**
 * `/api/ping`'s occupancy field: the reading for `?session=`, or `null` when no
 * session was named.
 *
 * **`null` is "nobody asked", and it is not an `unmeasurable`.** The four
 * `UnmeasurableWhy` reasons each say something about a workspace a reader can
 * act on — install the bridge, wait a message, upgrade, the session is idle —
 * and none of them is true of a request that simply carried no session id. The
 * boot heartbeat is exactly that request: `fillChrome()` runs before
 * `loadSessions()`, deliberately, so the strip exists before the first data
 * call. Answering `no-sample` there would put a claim about the bridge on a
 * question nobody asked, which is the collapse
 * `core/context-occupancy.ts`'s four reasons exist to undo.
 *
 * A workspace with no `projectRoot` is `null` for the same reason and not a
 * refusal: `/api/ping` answers 200 or the heartbeat stops, and the heartbeat
 * stopping is what starved the idle timer in the boot failure `app.js`'s
 * `main()` documents at length.
 *
 * `readOccupancy` never throws — its own docstring is emphatic — so nothing is
 * wrapped here. An unsafe session id, a torn sample and a killed writer all
 * already land on one of the four named reasons.
 */
function pingOccupancy(ws: Workspace, url: URL): Occupancy | null {
  const root = ws.projectRoot;
  if (root === null) return null;
  const session = url.searchParams.get('session');
  if (session === null || session === '') return null;
  return readOccupancy(root, session);
}

/**
 * The read routes, registered into the shared table `routes.ts` owns.
 *
 * Exported and idempotent so a test can ask what the table holds without
 * starting a server — which is what `test/ui/server-e2e.test.ts` does to prove
 * its sweep covers every registered route. Guarding inside rather than at the
 * call site means every caller inherits the guard, including one written later.
 */
export function registerReadRoutes(): void {
  if (routesRegistered) return;
  routesRegistered = true;

  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });

  // The heartbeat target (Task 16's visibility-gated ping). It reads nothing:
  // being answered at all is the whole payload, and the `idle.touch()` the
  // dispatch does for it is the point.
  //
  // **It carries one field now: `staleCode`** (`plan:live seq:12`). The
  // heartbeat is the ONLY channel this shell polls — once a minute, whenever
  // the tab is visible — and the case that actually cost a bug report was a tab
  // that had been open since the morning. A disclosure that only rode
  // `/api/meta`, which is fetched once at first paint, could not have reached
  // that reader at all; one that rode a new endpoint would be a second channel
  // to keep in step with this one. So the fact travels on the request that is
  // already being made, and it stays a fact rather than a payload: `ctx.code`
  // is the same value every other route sees.
  //
  // **It carries a second now: `corpus`** (`plan:live seq:4`, shaped by the
  // measurement in `seq:5`). Everything this page knows about a changing corpus
  // comes from the audit log, and a Markdown item edited in an editor or by a
  // branch switch appends nothing to it — so the page can be looking at a
  // corpus that has moved under it and say nothing. That is the same defect
  // `staleCode` above exists to remove, one layer down: not "this code is old"
  // but "this DATA is". It rides the heartbeat for the identical reason, and
  // the reason is stronger here, because a corpus drifts while a tab sits open
  // in a way a server's own code cannot.
  //
  // **`measureCorpusDrift` is a stat sweep and not a watcher, and that was
  // measured rather than preferred.** `fs.watch` on this platform loses every
  // named event in a burst of ~20 saved files and missed a real item edit 10
  // times out of 10 when 60 files were rewritten around it; it also costs
  // 96–1,121ms CPU per minute against this sweep's 6.24. See
  // `core/corpus-drift.ts` for the numbers and what they rule out.
  //
  // It stays a READ — `/api/ping` is one of the routes `test/ui/no-writes.test.ts`
  // holds to that — and it never refreshes anything. `SCREEN_INVALIDATION` and
  // `CHROME_INVALIDATION` remain the only things that decide what a change
  // makes stale; this hands them a fact they previously could not have.
  //
  // **AND IT CARRIES A THIRD NOW: `occupancy`** (`plan:walk seq:124`, and it is
  // the same defect as `corpus` one row over).
  //
  // The strip's context percentage comes from the status-line tee, which
  // `mycontext statusline` rewrites on Claude Code's per-message hook — and
  // that command writes NO audit record of any kind. `CHROME_INVALIDATION`'s
  // `session` row can therefore only declare `['injection']`, which is the half
  // of that segment the log can speak for, and its own derivation says so in
  // as many words. So the percentage filled at first paint and never moved
  // again: the owner reported it as "the status bar refreshes but only when i
  // reload the page". **A fact with no audit kind can never appear in a list of
  // kinds** — this project's recurring defect, a hand-kept list that must agree
  // with something derived, and the seventh time it has been measured here.
  //
  // The two mechanisms that would close it by force are both already ruled out
  // BY MEASUREMENT rather than by preference. `fs.watch` loses every named
  // event in a burst of ~20 files on this platform and missed a real item edit
  // ten times out of ten (`core/corpus-drift.ts`). And making `statusline`
  // append an audit row would be one record per assistant message — 5,207 rows
  // of exactly that shape were deleted from this corpus for being noise.
  //
  // So it rides the request that is already being made, for the reason `corpus`
  // does, and the case is stronger: a context window fills while a tab sits
  // open in a way nothing on the audit stream can announce.
  //
  // **SESSION-SCOPED, so it is answered only when a session is named.** This is
  // the one thing that makes it unlike `corpus` and `staleCode`, which are
  // facts about the workspace and the process. `session` is absent on the boot
  // heartbeat, and the honest answer there is `null` — "nobody asked", NOT an
  // `unmeasurable` that would claim a reading was attempted and refused. The
  // key is present either way, for the reason `git` is present either way on
  // `/api/meta`.
  //
  // Measured 2026-08-31, Windows/Node 24: `readOccupancy` p50 0.32ms, p95
  // 0.53ms (one `existsSync`, one small `readFileSync`, one `JSON.parse`) — a
  // twentieth of the `measureCorpusDrift` sweep already on this request, and a
  // FIFTEENTH of the 4.69ms p50 that a full `/api/watch/context` refill costs
  // over a 360-injection session. That ratio is the whole point of putting it
  // here: it is cheap enough to be asked on every heartbeat, so the expensive
  // refill happens only on the ticks where the reading actually moved.
  registerRoute('GET', '/api/ping', {
    kind: 'json',
    handle: (ctx) => ({
      status: 200,
      body: {
        ok: true,
        staleCode: ctx.code.isStale(),
        corpus: measureCorpusDrift(ctx.ws.projectRoot),
        occupancy: pingOccupancy(ctx.ws, ctx.url),
      },
    }),
  });
  // `git` is `null` in a workspace with no `.git` — present either way, because
  // "no repository" is a fact the strip renders rather than a field to omit.
  registerRoute('GET', '/api/meta', {
    kind: 'json',
    handle: (ctx) => ({
      status: 200,
      body: {
        version: VERSION,
        projectRoot: ctx.ws.projectRoot,
        repoRoot: ctx.repoRoot,
        git: readGitInfo(ctx.repoRoot),
        // `plan:live seq:12`, following `servingLastGood`'s precedent on
        // `/api/config`: the fact is DERIVED where it is known — from the one
        // `CodeIdentity` this server stamped — rather than plumbed in beside
        // the answer as a second channel that could disagree with the
        // heartbeat's. `startedAt` is here because the disclosure is only half
        // a sentence without it: a reader who knows when this process loaded
        // its modules can see for themselves how far behind it is.
        startedAt: ctx.code.startedAt,
        staleCode: ctx.code.isStale(),
        // **The config break, on the channel every screen already reads**
        // (`plan:live seq:13`).
        //
        // `servingLastGood` on `/api/config` says the same thing and reaches
        // only whoever opens Configure. Everyone else — Simulate's ribbon,
        // Work's governing set, Capture's tier filter — is being shown numbers
        // derived from a config that is NOT the file in front of them, with no
        // hint that it is not. That is a smaller copy of the defect this whole
        // plan existed to remove, so it rides `/api/meta`, which the shell
        // fetches on every screen to fill the status strip.
        //
        // `string | null`, not a boolean, and not `servingLastGood` respelled:
        // the loader's own sentence is the only thing that tells a reader WHICH
        // break this is, and a strip that can only say "something is wrong"
        // sends them to Configure to find out what — which is the trip this
        // field exists to save them. `null` is the measured good state and is
        // present either way, for the reason `git` is: "the config on disk is
        // the config governing this page" is a finding a strip renders, not a
        // field to omit (STD-a-measured-zero-is-drawn-and-named-…).
        //
        // DERIVED, exactly as `staleCode` above is: it comes from the same
        // `live.now()` that produced `ctx.ws.config`, so this field and the
        // config every other endpoint answered from cannot disagree. See
        // `ApiContext.configError` in `routes.ts`.
        configError: ctx.configError,
        // **The out-of-band-edit disclosure, at first paint** (`plan:live seq:4`).
        //
        // The same value `/api/ping` carries, from the same function, on the
        // request the shell already makes when it fills the status strip. Both
        // channels, for the reason `staleCode` needed both: the heartbeat is
        // the only one that reaches a tab which has been open since the
        // morning, and `/api/meta` is the only one that reaches a tab in its
        // first minute — a strip that had to wait up to 60 seconds before it
        // could say anything about the corpus would be silent over exactly the
        // window in which a reader is deciding whether to trust the page.
        //
        // Present either way, and `drifted: false` is a MEASUREMENT rather than
        // an absence — the sweep ran and found nothing newer than the log. The
        // unmeasured case is `drifted: null` and is a different sentence.
        corpus: measureCorpusDrift(ctx.ws.projectRoot),
        // **The audit vocabulary, unconditionally** (`TASK-no-browser-reachable-endpoint-serves-audit-kinds-so-the`).
        //
        // Before this, the only derivation the browser had was a SIDE EFFECT:
        // `/api/watch/volume` fills every bucket's `byKind` with every
        // `AUDIT_KINDS` member at zero, so the key order of one bucket
        // happened to be the enum. That vanished exactly when it was least
        // affordable — a behind or diverged projection made the endpoint a
        // 503, and an absent one answers with NO buckets — leaving the watch
        // screen's filter row silently offering `All` alone while the live
        // stream filled the table with six kinds of record. `screens/ask.js`
        // needed `AUDIT_OPS` for the identical reason.
        //
        // `/api/meta` is fetched on every screen, unconditionally, and answers
        // 200 whether or not any audit projection has ever been built — so
        // this is present in the one outcome the side-effect route could not
        // cover. Read straight off `core/audit.ts`'s own declarations, never
        // respelled: a second list here could drift from the first exactly
        // the way the mockup's hand-copied one already had once.
        auditKinds: AUDIT_KINDS,
        auditOps: AUDIT_OPS,
        // **Two more closed vocabularies, for the Composer's selection lists**
        // (owner ruling D10, 2026-09-06 ·
        // `TASK-four-composer-fields-have-a-closed-domain-and-still-ask-you`).
        //
        // The same argument `auditKinds` records, one field over. The Composer
        // draws `mycontext search --status <status>` and `mycontext help
        // <topic>`, both of which take a CLOSED set the CLI already refuses
        // outside of — and until this line a browser module could reach neither
        // set. `screens/palette.js` therefore spelled the help topics into
        // itself as a four-element array, which is the hand-copied vocabulary
        // this project measures drifting in days: `HELP_TOPICS` has had SEVEN
        // members since `cli`, `tools` and `slash` landed, so the Composer
        // could not compose three real commands.
        //
        // Read straight off the declaring modules. `STATUSES` is
        // `core/validate.ts`'s, the list `validateItem` enforces and
        // `search.ts` checks `--status` against; `HELP_TOPICS` is
        // `core/teach.ts`'s, the list `mycontext help` lists and
        // `help/index.ts` refuses outside of. A member added to either reaches
        // the Composer with no UI edit, which is the property being bought.
        //
        // **`UI_HELP_TOPICS` is a different list and is deliberately not this
        // one.** That one is the four topics the LEARN SCREEN renders a corpus
        // join for, keyed off the mockup; this one is what `mycontext help`
        // ACCEPTS. A composer that offered the screen's four would refuse to
        // compose `mycontext help cli`, a command that works.
        statuses: STATUSES,
        helpTopics: HELP_TOPICS,
      },
    }),
  });

  registerRoute('GET', '/api/select', json(apiSelect));
  registerRoute('GET', '/api/render', json(apiRender));
  registerRoute('GET', '/api/simulate', json(apiSimulate));
  registerRoute('GET', '/api/simulate/sweep', json(apiSimulateSweep));
  registerRoute('GET', '/api/sessions', json(apiSessions));
  registerRoute('GET', '/api/status', json(apiStatus));
  registerRoute('GET', '/api/doctor', json(apiDoctor));
  registerRoute('GET', '/api/decay', json(apiDecay));
  registerRoute('GET', '/api/coverage', json(apiCoverage));
  registerRoute('GET', '/api/graph', json(apiGraph));
  registerRoute('GET', '/api/items', json(apiItems));
  // The tag vocabulary a focus can be built from, in its two classes with
  // their counts — `REQ-the-focus-dialog-offers-the-tags-it-could-focus-on-
  // with-the`. It is beside `/api/items` because it is the same read of the
  // same corpus asking a different question, and separate from it because
  // `ItemSummary` carries no tags and widening it would put a 431-token
  // vocabulary on every screen that lists items.
  registerRoute('GET', '/api/tags', json(apiTags));
  // `screens/tut.js`'s list, one row per `docs/tutorials/manifest.json` entry
  // — `TASK-get-api-tutorials-reads-the-manifest-and-adds-a-hebrew`
  // (`plan:tuts seq:2`), widened from the six hard-coded rows
  // `TASK-no-endpoint-serves-tutorial-state-so-twelve-cells-are-hard` shipped.
  registerRoute('GET', '/api/tutorials', json(apiTutorials));
  // One tutorial's markdown, by manifest id — `TASK-get-api-doc-colon-id-
  // serves-one-tutorial-by-manifest-id` (`plan:tuts seq:3`). NOT
  // `/api/doc/:id`: that path already serves a wider, differently-keyed
  // manifest (`apiDoc` below); see `apiTutorialDoc`'s own header for why this
  // is nested under `/api/tutorials` instead of colliding with it.
  registerRoute('GET', '/api/tutorials/:id', {
    kind: 'json',
    handle: (ctx) => apiTutorialDoc(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/session/:session/injected', {
    kind: 'json',
    handle: (ctx) => apiInjected(ctx.ws, ctx.url, { session: ctx.params['session'] ?? '' }),
  });
  registerRoute('GET', '/api/item/:id', {
    kind: 'json',
    handle: (ctx) => apiItem(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });
  registerRoute('GET', '/api/help/:topic', {
    kind: 'json',
    handle: (ctx) => apiHelp(ctx.ws, ctx.url, { topic: ctx.params['topic'] ?? '' }),
  });
  // The Documentation screen's manifest — `docsys/4`/`docsys/5`/`docsys/6`,
  // `plan:walk seq:25`. `/api/doc` lists every document the wide glob over
  // `docs/`, `reports/` and `README.md` admits, with no markdown body;
  // `/api/doc/:id` serves one, by an id looked up in that same manifest —
  // see `read-model.ts`'s section header for the full security argument.
  registerRoute('GET', '/api/doc', json(apiDocList));
  registerRoute('GET', '/api/doc/:id', {
    kind: 'json',
    handle: (ctx) => apiDoc(ctx.ws, ctx.url, { id: ctx.params['id'] ?? '' }),
  });

  // Plan 2's Work read model, registered INSIDE this guarded block rather than
  // beside the call to it in `startUiServer`. Two reasons, and both are
  // properties rather than taste: `startUiServer` is called repeatedly in one
  // process by `test/ui/server.test.ts`, so an unguarded second registration
  // would throw; and `server-e2e.test.ts`'s "every registered read route is in
  // the sweep" asks THIS function what the table holds — a route registered
  // only on the server-start path would be invisible to it, which is the
  // silently-shrinking assertion that test exists to prevent.
  registerWorkRoutes();
  // Plan 2's Configure read model, registered here for the same two reasons.
  // It reads `config.json` fresh, validates a candidate and previews it, and
  // writes nothing: the file is the user's to change, so the settlement leaves
  // as a command the browser composes, never as a route that edits it.
  registerConfigRoutes();
  // plan:builder seq:2b. What every command accepts and what may be put in
  // each flag — static for twenty-nine of them, COMPUTED for `edit`, whose
  // accepted set is whatever flags this project's categories declare. Same two
  // reasons as the two calls above for registering it here rather than beside
  // the server start.
  registerFlagRoutes();
  // The injection preview's When column: `audit_item.role` joined to
  // `audit.at`, one query, its own route so that a projection which is behind
  // costs the preview its timestamps and never its selection. Registered here
  // for the same two reasons as the four above.
  registerPreviewHistoryRoutes();
  // Plan 3's Watch read model, registered here for exactly the same two
  // reasons — and it adds the table's first `kind: 'stream'` route, which the
  // dispatch loop below deliberately does not `idle.touch()` for.
  registerWatchRoutes();
  // Plan 3's Ask read model, here for the same two reasons again. The plan
  // defers this call to its own Task 8, and it cannot wait: `no-writes.test.ts`
  // walks the import graph from THIS file and fails on a `src/ui/` module
  // nothing reaches, which is exactly what an unregistered `ask-model.ts`
  // would be. A route nobody wired is one of the two things that assertion
  // exists to say out loud.
  registerAskRoutes();
  // The four screens the mockup draws that had no endpoint at all, wired here
  // on 2026-08-23 for the same two reasons as every call above — and for a
  // third the other four did not have to state, because they were never
  // unwired long enough to meet it.
  //
  // `no-writes.test.ts`'s "the walk examines a real graph" equates every
  // module on disk under `src/ui/` with the set reachable from THIS file, and
  // says of the difference: "either dead code or a route nobody wired". All
  // four models below were written in parallel by agents forbidden to touch
  // this file, so for the length of that wave the assertion was DETERMINISTIC­LY
  // red — it failed twelve consecutive full-suite runs, which made `npm test`
  // unreadable rather than merely noisy. These four calls are what clears it.
  //
  // Each model was measured against the mutation surface before it landed:
  // none binds a symbol in `WRITERS`, and the only genuinely new modules any
  // of them adds to this server's import graph are `core/progress.ts` (pure,
  // imports one type) and `pack/layout.ts` (a leaf whose sole import is
  // `node:buffer`). `core/mutate.ts` IS reachable from here, by the
  // pre-existing `read-model.ts → help/index.ts → mcp/tools.ts` edge this
  // file's own test header already records; not one of these four adds a path
  // to it.
  registerCaptureRoutes();
  registerProcedureRoutes();
  registerPortRoutes();
  registerPacksRoutes();
}

function sendJson(res: ServerResponse, result: JsonResult): void {
  const body = JSON.stringify(result.body);
  res.writeHead(result.status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    // Deliberately NO CORS headers: their absence is the cross-origin defence (spec §2).
  });
  res.end(body);
}

/**
 * A status line and NOTHING ELSE (owner ruling A4, plan §0.6).
 *
 * There is no `body` parameter, and that absence is the whole point. The gate's
 * `reason` is a developer-facing fixed literal that carries no submitted input
 * (ruling 11) and a comment on it says it is never rendered — but a comment
 * cannot stop a later task rendering it, and NOTHING CAN RENDER WHAT IS NEVER
 * SENT. A helper you cannot pass a reason to holds the property structurally.
 *
 * No content-type either: there is no content. The security headers stay,
 * because a refusal is still a response and a cached refusal is still a refusal
 * someone could serve twice.
 *
 * It is also what answers a missing static asset, and for the same reason
 * `static.ts` refuses to distinguish its own refusals: the one distinction that
 * would help a caller is also the one that tells a stranger which paths exist.
 * The audit record is `refuse()`'s job, not this helper's — this one only
 * decides what goes on the wire.
 */
function sendRefusal(res: ServerResponse, status: number): void {
  res.writeHead(status, { ...SECURITY_HEADERS });
  res.end();
}

/** The FIRST value of a repeated header — the same value the gate judged. */
const headerFirst = (v: string | string[] | undefined): string | null =>
  v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;

/**
 * Whether `host` is this machine addressing itself under a different spelling.
 *
 * The three a browser produces on its own: `localhost`, the IPv6 literal
 * `[::1]`, and any `127.x.x.x`. The whole 127/8 block is loopback, not just
 * `127.0.0.1`, and a person who typed `127.0.0.2` reached the same server.
 *
 * The PORT must still match exactly. A loopback name on some other port is a
 * different server — very often another `mycontext ui` — and sending its
 * traffic here would be this process answering for one it knows nothing
 * about. That is the mistake `live/19` records, where a stale global record
 * pointed a command at a stranger's server on 9778.
 */
function isLoopbackSpelling(host: string, port: number): boolean {
  const cut = host.lastIndexOf(':');
  if (cut === -1) return false;
  if (host.slice(cut + 1) !== String(port)) return false;
  const name = host.slice(0, cut).toLowerCase();
  return name === 'localhost' || name === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(name);
}

/**
 * The request body, capped.
 *
 * The cap **destroys the request** rather than only rejecting the promise: a
 * rejection settles this function and leaves the socket streaming, so an
 * unbounded body would go on arriving into a buffer nobody is going to read.
 * `setEncoding` is what makes the concatenation correct — a multi-byte
 * character split across two chunks decodes to a replacement character under a
 * bare `String(chunk)`, and a JSON body is the one place that matters.
 */
const MAX_BODY_BYTES = 64 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error(`request body exceeded ${MAX_BODY_BYTES} bytes`));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Start the server. **Never throws synchronously** — every failure arrives as a
 * rejection, which is why this is `async`.
 *
 * That is not a style choice. `IdleMonitor`'s constructor refuses a malformed
 * window with a message written to be the whole user-facing message, and it
 * says Task 13 should "let it through unchanged"; the entry point below prints
 * `err.message` and exits 1. A constructor that throws out of a function
 * declared to return a promise would skip that `.catch` entirely and print a
 * stack trace instead — measured, and the reason `--idle-ms abc` has a test.
 * `liveWorkspace` throws on a corrupt `config.json` and reaches the same
 * `.catch` by the same route.
 */
export async function startUiServer(options: UiServerOptions): Promise<RunningUiServer> {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    // Refuse to start, not warn (spec §2.1): a bind beyond loopback exposes
    // the corpus to the network, and a warning is a property claim nobody reads.
    throw new Error(`mycontext ui: refusing to bind ${host} — the UI serves 127.0.0.1 only.`);
  }
  /**
   * **The workspace is a SOURCE, not a value — `config.json` is re-read on
   * every request.**
   *
   * `resolveWorkspace(options.cwd)` used to stand here, and its result was
   * handed to every request for the life of the process. That made `ws.config`
   * a photograph taken at start: an out-of-band edit to `config.json` reached
   * `/api/config`, which re-reads, and reached nothing else — measured
   * 2026-08-28 as `9999` on one endpoint and `6000` on the other, permanently.
   * Every reader of `ws.config` deciding admission, tier or budget was deciding
   * against the older of the two.
   *
   * `liveWorkspace` carries the whole argument, including why a file that stops
   * loading MID-SESSION keeps the last config that did rather than taking every
   * endpoint down at once, and why a corrupt file at START still refuses here.
   *
   * `boot` is this one answer, used for the start-time checks below and for
   * nothing else. It is deliberately not named `ws`: a `ws` in this scope is
   * exactly the frozen value this change removes, and the next person to reach
   * for one should have to type `live.now()` instead.
   */
  const live = liveWorkspace(options.cwd);
  const boot = live.now().ws;
  /**
   * **The other half of the same problem, one layer down** (`plan:live seq:12`).
   *
   * `live` above ends the freezing of CONFIG. It does nothing at all about
   * CODE, which is still frozen the moment these modules load and stays frozen
   * for the life of the process — while `serveStatic` hands the browser
   * `src/ui/public/` live from disk on every request. Stamped HERE, next to
   * `live`, because the two are read as a pair by whoever comes looking: one
   * says the config is current, the other says whether the code still is.
   *
   * **The scope is this module and the directory it serves, and both are read
   * off values this file already holds.** It used to be the whole `src/` tree,
   * which meant a lane editing `src/cli/commands/statusline-powerline.ts` told
   * every open web page to restart a server that had never loaded it. See
   * `code-identity.ts` for the measurement and for why the set is derived by
   * walking imports rather than by excluding siblings by name.
   */
  const code = stampCodeIdentity(
    options.code ?? { entry: import.meta.filename, assets: PUBLIC_DIR });
  if (boot.projectRoot === null) {
    throw new Error('mycontext ui: no workspace here. Run `mycontext init` first.');
  }
  const corpusRoot = boot.projectRoot; // narrowed here so the refusal recorder below has a string
  // **`repositoryRoot(cwd)`, not `path.dirname(corpusRoot)` — the THIRD site of
  // one defect, found by review 2026-08-28.**
  //
  // The first was `add --file`, the second `refresh`. Each derived "the
  // repository" from where the CORPUS is, which is the same value right up until
  // `CORPUS_DIR_ENV` points the corpus somewhere else — and then it is a
  // directory the user has never seen. This one feeds `ctx.repoRoot`, which is
  // the `cwd` of BOTH the dry run and the real execution, so a server started
  // with that variable set would have had the confirm and the run agree on the
  // same wrong answer. Agreement is not correctness, and this route's whole
  // claim is that what you read is what runs.
  //
  // Nothing sets it on a server today. It is fixed because the previous two
  // sites were also "nothing does that today" until something did, and because
  // a defect whose three instances were found one at a time is a defect whose
  // fourth instance is the one nobody looks for.
  const repoRoot = repositoryRoot(options.cwd) ?? path.dirname(corpusRoot);
  const token = mintToken();

  /**
   * **The tokens EARLIER runs issued, so a tab that was open when the server
   * restarted is not locked out for good.**
   *
   * Read before the socket binds, and the new token's digest recorded in the
   * same breath, because both are decisions about this run rather than
   * responses to a request — nothing under `src/ui/` may touch this on a
   * request path, and nothing does. `core/ui-sessions.ts` carries the full
   * reasoning; the two facts that matter here are that what is stored is
   * `sha256(token)` and never the token, and that the file lives outside every
   * corpus so the read surface still changes not one byte of the workspace.
   *
   * Both failures are REPORTED rather than thrown. A server that cannot write
   * its session file must still serve — the corpus is readable and the person
   * is waiting — but it must not pretend it persisted, because the cost lands
   * later and somewhere else: the tab opened now would stop working at the next
   * restart, which is precisely the symptom this removes.
   */
  const restored = loadSessionDigests();
  if (restored.error !== null) options.onSessionStoreIssue?.(restored.error);
  const persisted = recordSessionDigest(tokenDigest(token));
  if (persisted.error !== null) options.onSessionStoreIssue?.(persisted.error);

  const nonces = new NonceStore();
  const nonceTtl = options.nonceTtlMs;

  registerReadRoutes();

  /**
   * The execution nonce store, created HERE and closed over by the two execute
   * routes — per server, never module-global.
   *
   * It is not registered inside `registerReadRoutes` with the others, and the
   * difference is the whole reason this block is here rather than there: those
   * routes are stateless, so registering them once for the process is correct.
   * This one authorises a run, and two servers in one test process must not
   * authorise each other's — the node suite starts several. So each server
   * brings its own store, and `registerExecuteRoutes` binds the endpoint to it
   * (registering the routes themselves only the first time, because the route
   * table is process-global and refuses a duplicate).
   *
   * `CLI_ENTRY` is the CLI this server SHIPS WITH, resolved from
   * `import.meta.url` rather than found on PATH. It is a path handed to a child
   * process, never an import: `no-writes.test.ts` bans `src/cli/index.ts` from
   * this process's import graph, and running it in a child is what keeps that
   * ban true while still letting every command in the catalogue run (§6.1).
   */
  registerExecuteRoutes(new ExecutionNonceStore(), CLI_ENTRY);

  /** Set once the socket is bound; the gate compares the submitted Host against it. */
  let boundPort = 0;

  const server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      // A handler that has already written cannot be given a status — a second
      // `writeHead` throws from inside this very catch. The connection is torn
      // down instead, so the client sees a truncated response rather than a
      // silent success, which is the honest signal for "this failed halfway".
      if (res.headersSent) { res.destroy(); return; }
      sendJson(res, {
        status: 500,
        body: { error: err instanceof Error ? err.message : String(err) },
      });
    });
  });

  /**
   * **The record comes back on EVERY exit route, and there is one place it
   * does.**
   *
   * There are two routes out — the idle monitor's `server.close()` and the
   * `close()` this function hands back — and both of them go through the
   * server's own `close` event, because `server.close(cb)` registers `cb` as a
   * `close` listener and nothing else here ends the process cleanly. So this
   * one listener is exactly one removal per route, and it is the reading of
   * "no route can forget" that survives a THIRD route being added later: a
   * `clearUiServerRecord()` line copied into each callback is two lines that
   * can drift, and the drift is invisible — a stale record does not look
   * broken, it looks like a server somewhere else.
   *
   * It is registered here, before either close path exists, so it runs FIRST:
   * `once` fires in registration order, and both routes register theirs at
   * `close()` time. That ordering is load-bearing — `onExit` is what tells the
   * caller the server is gone, and a caller told that while the record still
   * named a live port would be told something untrue for as long as the two
   * listeners are apart.
   *
   * No `try` around it: `clearUiServerRecord` is documented never to throw, and
   * an absent record is success rather than failure there. A catch here would
   * be a branch no test can reach, and it would sit on the one path where a
   * thrown exception has nowhere to go — an event listener, on a process that
   * is already shutting down.
   */
  server.once('close', () => { clearUiServerRecord(); });

  const idle = new IdleMonitor(options.idleMs ?? IDLE_MS, () => {
    // On idle the server closes; open sockets (a stream, in plan 3) are
    // destroyed so close() completes and the page's next fetch fails, which
    // is what triggers the "server has exited" banner (no auto-reconnect).
    server.close(() => options.onExit?.('idle'));
    server.closeAllConnections();
  });

  /**
   * The ONE write this server performs, and then the status (plan §0.6,
   * rulings A4 and B4). Recorded BEFORE the response goes out, so a refusal
   * cannot be answered and then lost; `recordAudit` is a synchronous append,
   * not a read-modify-write.
   *
   * The `AuditWriteResult` is DISCARDED, exactly as the hooks discard theirs:
   * there is no one to tell, and telling the refused party would be the echo
   * ruling 11 removed. A log that has stopped being writable is discoverable
   * through `doctor`'s `audit_log_size` check.
   *
   * `url.pathname`, never `url.search`. Capping and the absent-versus-empty
   * distinction live in `recordRefusal` (§0.6), so every caller gets them.
   */
  function refuse(
    req: IncomingMessage, url: URL, gate: { status: number; check: RefusalCheck },
    res: ServerResponse,
  ): void {
    recordRefusal(corpusRoot, {
      check: gate.check,
      status: gate.status as 401 | 403,
      method: req.method ?? 'GET',
      route: url.pathname,
      host: headerFirst(req.headers.host),
      origin: headerFirst(req.headers.origin),
    });

    // **A token cookie THIS server did not issue is expired here, or the page
    // is locked out for good.**
    //
    // The lockout, measured on 2026-08-23: restart `mycontext ui` on the same
    // port, reload the page WITHOUT the nonce fragment, and the browser sends
    // the previous server's `mycontext_token`. It does not match, every /api
    // call answers 403, and the page cannot recover — the cookie is `HttpOnly`
    // so script cannot clear it, and with no nonce in the URL there is nothing
    // left to re-handshake with. The screen goes blank and stays blank however
    // many times it is reloaded.
    //
    // That is a direct breach of the owner's requirement that a reload always
    // works, and the earlier exemption on `/api/handoff` does not reach it:
    // that one only helps when a nonce IS present.
    //
    // Only the COOKIE is expired, and only when the header did not carry the
    // token. A caller that sent a wrong token in the header chose that value
    // and gets a plain refusal; a browser that merely still had a cookie from
    // the last server is handed a clean slate, so the next load presents
    // nothing, answers 401 rather than 403, and the page can say what is
    // actually wrong.
    if (gate.check === 'token-mismatch'
      && headerFirst(req.headers[TOKEN_HEADER]) === null
      && cookieValue(req.headers.cookie, TOKEN_COOKIE) !== undefined) {
      // **Both cookies, in one response.** `CREDENTIAL_COOKIE` is the
      // script-readable marker that says a token cookie exists and which
      // server issued it; leaving it behind while expiring the token it points
      // at would leave the page promising itself a credential the browser no
      // longer holds — which is the nine-refusals boot again, wearing the fix's
      // own clothes. They are set together and they are cleared together.
      res.setHeader('set-cookie', [
        `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
        `${CREDENTIAL_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0`,
      ]);
    }
    sendRefusal(res, gate.status);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${boundPort}`);

    // Rule 1: the page's own bytes, before the gate. `serveStatic` carries the
    // containment, extension and real-path refusals; `null` is every one of
    // them and is answered as 404 with no body, so which refusal fired is not
    // on the wire.
    if (!url.pathname.startsWith('/api/')) {
      // Rule 1a: this page is served at ONE origin, and every other loopback
      // spelling is redirected to it rather than served at it.
      //
      // **`http://localhost:PORT/` used to load this page and then be refused
      // every /api call it made, for the life of the tab.** `validateApiRequest`
      // compares Host against `127.0.0.1:PORT` (security.ts), and `localhost`
      // never matches it — so the shell loaded, looked alive, and answered 403
      // to everything it asked for. The refusal it drew told the reader to run
      // `mycontext ui --nonce`, which mints a credential and CANNOT help,
      // because the failing check is `host` and not `token-missing`. A person
      // whose browser completes `localhost:58888` was locked out permanently
      // with nothing on screen able to tell them why, and no number of
      // restarts or nonces would ever fix it. Reported by the owner
      // 2026-09-05 after exactly that: four restarts, three nonces, still
      // refused.
      //
      // **A REDIRECT rather than teaching the gate to accept both spellings.**
      // The token lives in a cookie and cookies are scoped to a HOST, not to a
      // port — the fact `/api/handoff`'s own exemption was widened for. Two
      // accepted spellings are two cookie jars, so a reader who authenticated
      // as `127.0.0.1` would be anonymous as `localhost`, and the lockout
      // would come straight back wearing a different hostname. One origin is
      // one jar.
      //
      // The target is built from `boundPort` and NEVER from the Host header,
      // so this cannot be turned into an open redirect. The browser carries
      // the fragment across a 302 by itself, so a nonce link survives the hop
      // and the handoff still happens on the canonical origin.
      //
      // A Host that is not a loopback spelling is REFUSED rather than
      // redirected. That also closes something Rule 1 left open: static ran
      // before any Host check at all, so this server handed its own page to
      // any hostname that resolved here, a rebinding host included.
      const host = headerFirst(req.headers.host);
      if (host !== `127.0.0.1:${boundPort}`) {
        if (host !== null && isLoopbackSpelling(host, boundPort)) {
          res.writeHead(302, {
            ...SECURITY_HEADERS,
            location: `http://127.0.0.1:${boundPort}${url.pathname}${url.search}`,
          });
          res.end();
          return;
        }
        sendRefusal(res, 403);
        return;
      }
      const asset = serveStatic(url.pathname, PUBLIC_DIR);
      if (asset === null) { sendRefusal(res, 404); return; }
      res.writeHead(asset.status, { ...SECURITY_HEADERS, 'content-type': asset.contentType });
      res.end(asset.body);
      return;
    }

    // Host/Origin are validated for EVERY /api request, handoff included; the
    // token check is what handoff alone is exempt from (it is how the page
    // first obtains the token).
    const gate = validateApiRequest(req, {
      token, port: boundPort, priorDigests: restored.digests,
    });

    // Rule 2. Not a registered route: a route in the table is a route behind
    // the gate, and this is the one that must not be.
    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      // `check`, never the status: three of the gate's refusing exits answer
      // 403, so the status cannot say which one refused.
      //
      // **BOTH token exits are exempt here, and the second one had to be added
      // after it locked a real browser out of a real server.** The exemption
      // used to be `token-missing` alone, on the reasoning that a WRONG token
      // should still be refused. That reasoning does not survive the token
      // being kept in a cookie: cookies are scoped to a HOST, not to a port, so
      // `127.0.0.1:58901`'s cookie is sent to `127.0.0.1:58902`, and the next
      // `mycontext ui` mints a different token. The gate reads
      // `header ?? cookie`, so a fresh page arriving with a valid NONCE and a
      // stale cookie presented a mismatched token, was refused 403, and could
      // never obtain a good one — the cookie is `HttpOnly`, so the page cannot
      // clear it either. Measured: handoff with no cookie 200, handoff with a
      // stale token cookie 403.
      //
      // Exempting it costs nothing, because **the nonce is the credential on
      // this route** and it always was. A caller who cannot present an unspent
      // nonce is refused below whatever token it holds; a caller who can has
      // proven exactly what this route asks. Whatever token it happened to be
      // carrying is not evidence about either question — and the 200 response
      // overwrites that cookie, which is how the stale one is cleared.
      if (!gate.ok && gate.check !== 'token-missing' && gate.check !== 'token-mismatch') {
        refuse(req, url, gate, res);
        return;
      }
      let nonce: unknown;
      try {
        nonce = (JSON.parse(await readBody(req)) as { nonce?: unknown }).nonce;
      } catch {
        nonce = undefined;
      }
      if (typeof nonce !== 'string' || !nonces.redeem(nonce)) {
        // A4 again: no body. A nonce refusal is not one of the gate's four
        // exits and is deliberately NOT audited (plan §0.4 item 10), but what
        // goes on the wire is the same status-and-nothing-else.
        sendRefusal(res, 403);
        return;
      }
      // The token also goes back as a cookie, which is what makes a RELOAD
      // work: the fragment is erased on first load and the nonce is one-shot,
      // so the second load has no other credential to present. HttpOnly keeps
      // it out of reach of script — strictly tighter than the sessionStorage
      // copy the page used to keep — and SameSite=Strict keeps it off any
      // request another site started. See `TOKEN_COOKIE` in security.ts.
      //
      // No `Secure`: the server is plain http on loopback by design, and a
      // Secure cookie would simply never be stored.
      //
      // **And the marker beside it, in the same response** — see
      // `CREDENTIAL_COOKIE` in security.ts for the whole argument. It is not
      // `HttpOnly` and must not be: the one thing it exists to do is be
      // READABLE, so that a page arriving with no fragment and no
      // `sessionStorage` can tell "I hold a cookie credential from THIS
      // server" from "I hold nothing" without spending nine refused requests
      // to find out. Its value is this port, because the token cookie is
      // host-scoped and shared with every other `mycontext ui` on 127.0.0.1.
      res.setHeader('set-cookie', [
        `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict`,
        `${CREDENTIAL_COOKIE}=${boundPort}; Path=/; SameSite=Strict`,
      ]);
      sendJson(res, { status: 200, body: { token } });
      return;
    }

    // Rule 2b. Also NOT a registered route, and NOT the table: a route in it
    // is a route BEHIND the gate, and this one's whole job — owner ruling
    // 2026-08-28, KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-
    // that-locks-out-the-next-one — is to serve a caller the full gate would
    // refuse outright on `token-missing`. Since 2026-09-03 it mints at one of
    // TWO fixed TTLs, chosen by an optional `?ttl=printed` — see `MINT_NONCE_
    // TTL_MS`'s docblock and the choice inside the branch below.
    if (url.pathname === '/api/nonce' && req.method === 'POST') {
      // The SAME exemption as handoff, checked against the SAME `gate` value —
      // not a second computation that could drift from the first. Host and
      // Origin are still checked on every /api request, handoff and this
      // route included: what is exempt is the token check alone.
      if (!gate.ok && gate.check !== 'token-missing' && gate.check !== 'token-mismatch') {
        refuse(req, url, gate, res);
        return;
      }
      // **Which of the two TTLs to mint at** — owner ruling 2026-09-03, see
      // `MINT_NONCE_TTL_MS`'s own docblock ("UPDATE 2026-09-03") for the whole
      // argument. `?ttl=printed` is the one caller-supplied bit this route
      // reads at all, and it selects between exactly two fixed constants —
      // never an arbitrary duration a caller names — so a caller can only ever
      // ask for one of the two windows this codebase already argues for
      // elsewhere (`OPENER_NONCE_TTL_MS`'s sibling reasoning, `PRINTED_NONCE_
      // TTL_MS` itself), never a third one invented at the wire. Anything
      // other than exactly `'printed'` — absent, misspelt, anything else —
      // falls to the short default, which is the safer failure direction.
      const ttlMs = url.searchParams.get('ttl') === 'printed'
        ? PRINTED_NONCE_TTL_MS
        : MINT_NONCE_TTL_MS;
      // The mint itself: the same store `urlWithNonce` mints from at startup
      // and `/api/handoff` redeems from, so a nonce printed here is honoured
      // exactly like one printed at startup — one shared store, one contract.
      const nonce = nonces.mint(ttlMs);
      // Audited BEFORE the response goes out, for the same reason `refuse`
      // records before answering: a credential handed out and then lost from
      // the log is the one order that leaves no trail at all. See
      // `recordNonceMint` (security.ts) for the full argument — this route is
      // strictly MORE powerful than handoff, and this write is what makes that
      // discoverable afterwards rather than merely true.
      //
      // Exactly ONE record per mint, whichever `ttlMs` was chosen: the choice
      // above happens before this call and does not branch it, so neither
      // variant of this route can be made to write twice.
      recordNonceMint(corpusRoot, {
        // Not re-read from the header: the gate already proved the submitted
        // Host is exactly this, and `wantHost` inside `validateApiRequest` is
        // the same string constructed the same way — recomputing it here would
        // be a second spelling of a fact the gate already settled.
        host: `127.0.0.1:${boundPort}`,
        origin: headerFirst(req.headers.origin),
      });
      // NOT idle.touch(). A mint is proof a caller may ASK for a credential,
      // not a use of the corpus — the same distinction that already keeps
      // `/api/handoff` off the idle path one branch up, one layer below where
      // spec §2 draws it for an open stream ("not activity"). The difference
      // that makes this one worth spelling out rather than inheriting quietly:
      // this route is reachable by ANY local process at ANY time (see
      // `recordNonceMint`'s residual), so touching idle here would let such a
      // process keep an otherwise-idle, otherwise-dead server up indefinitely
      // just by polling it — turning the idle exit's whole purpose inside out
      // for the one route that was built to work even when nobody is looking
      // at a tab any more.
      //
      // `ttlMs` rides along in the body, alongside the nonce it describes.
      // Not consulted by anything this server does with it — the caller
      // already knows which one it asked for — and not a new fact reaching a
      // caller that did not already have it: `ttlMs` is one of two constants
      // exported from this module, and this is an echo of a choice the caller
      // made in the request, not a disclosure. What it buys is a caller that
      // can assert what it minted rather than trust the choice silently:
      // `test/ui/nonce-route.test.ts` reads it back to prove the two TTLs this
      // route offers are actually different values, from the wire, without
      // waiting out either window in real time.
      sendJson(res, { status: 200, body: { nonce, ttlMs } });
      return;
    }

    // Rule 3: the full gate, then the table.
    if (!gate.ok) { refuse(req, url, gate, res); return; }

    const match = matchRoute(req.method ?? 'GET', url.pathname);
    if (match === null) {
      // The submitted method and path are NOT echoed back. The sender already
      // knows what it sent, so the echo buys nothing — and it is unbounded
      // caller-supplied text, which is the reason ruling 11 took the submitted
      // value out of the gate's reasons and §0.6 field rule 3 caps what reaches
      // the log. A fixed literal says the same thing to the only reader who
      // needs it.
      sendJson(res, { status: 404, body: { error: 'no route matched this request' } });
      return;
    }

    let body: unknown;
    if (req.method === 'POST') {
      try { body = JSON.parse(await readBody(req)); } catch { body = undefined; }
    }
    // **`live.now()`, per request.** The one line that makes every endpoint
    // read the same `config.json` the user is editing. `boot` above is not in
    // scope here on purpose; see the comment where it is bound.
    //
    // ONE call, destructured — never `live.now().ws` here and a second
    // `live.now().configError` beside it. Two calls would read the file twice
    // and could straddle a write, so a request could hold a config from one
    // read and a verdict on it from the other. `WorkspaceNow` returns the pair
    // for exactly that reason; keeping the pair intact is what makes
    // `ctx.configError` a DERIVED fact about `ctx.ws.config` rather than a
    // second channel that can disagree with it (`plan:live seq:13`).
    const now = live.now();
    const ctx: ApiContext = {
      ws: now.ws, configError: now.configError, repoRoot, url, params: match.params, body, code,
    };

    if (match.handler.kind === 'stream') {
      // NOT idle.touch(): an open stream is not activity (spec §2). Plan 3's
      // stream route inherits this without remembering it.
      match.handler.handle(ctx, res);
      return;
    }
    idle.touch();
    sendJson(res, await match.handler.handle(ctx));
  }

  /**
   * **Where this server is listening, written down for whoever looks next.**
   *
   * The sibling of `recordSessionDigest` above: the second write this server
   * performs, outside every request path, and outside every corpus. Spec §3.
   *
   * `port` is a PARAMETER rather than a read of `boundPort`, and that is the
   * whole point of this function existing at all. The port that must be
   * recorded is the one the socket is bound to, read back from
   * `server.address()`; `options.port` defaults to `0`, which asks the OS to
   * choose, so a record made from the request would say `0` on nearly every
   * real start. Nothing downstream could catch it: `0` parses, the record looks
   * whole, and every probe built on it would connect to nothing and conclude a
   * server had died. Naming the argument `port` and calling it with `boundPort`
   * is the smallest arrangement in which the wrong value is not in scope.
   *
   * **The failure is caught and disclosed, never thrown.** `writeUiServerRecord`
   * throws deliberately — it returns `void`, so swallowing a failure inside it
   * would be the silent drop this project refuses, and its author left the
   * decision to the caller. This is that decision: a server that cannot write a
   * hint about itself is still a server, and the person waiting for the page has
   * lost nothing yet. What they have lost is later and elsewhere, and the
   * message says both halves of it: the upkeep hook will find no record and will
   * not put this server back, and — the half added on 2026-08-29, because it is
   * the worse one — `mycontext ui --nonce` reads this same file and nothing
   * else, so THE RECOVERY PATH FOR A LOCKED-OUT TAB IS WHAT SILENTLY STOPS
   * WORKING. That path exists precisely to avoid the restart that locks out the
   * next tab, so a person discovers this failure at the moment they can least
   * afford it. Naming it here is what makes it discoverable at start instead.
   * That is exactly the shape `onSessionStoreIssue` already carries for
   * `ui-sessions.json`, printed by `mycontext ui` as a line the owner sees.
   * That existing channel is used rather than a new `onServerRecordIssue`,
   * because the only caller that supplies a handler is the CLI, a second
   * callback would have to be wired there to say the same sentence to the same
   * printer, and until it was, the notice would go nowhere — a disclosure
   * channel with no listener is the silent drop wearing a name.
   *
   * It is also caught because of WHERE it runs: inside `listen`'s callback,
   * which is not the promise executor. A throw here is not a rejection anything
   * can catch — it is an uncaught exception that takes the process down with a
   * stack naming `node:net` — so `close()` would never be called, the record
   * would never be cleared, and the failure to write a record would present as
   * a crashed server.
   */
  function recordListeningAt(port: number): void {
    try {
      writeUiServerRecord({
        version: 1,
        pid: process.pid,
        host,
        port,
        // The origin a browser would be sent to, and the same one the gate
        // judges submitted `Host` headers against.
        url: `http://${host}:${port}/`,
        startedAt: Date.now(),
        // The REPOSITORY root, not `.my_context` inside it: a hook reads this
        // to decide where to re-spawn `mycontext ui`, and that is a cwd.
        workspace: repoRoot,
      });
    } catch (err) {
      options.onSessionStoreIssue?.(
        `could not write ${uiServerRecordPath()} `
        + `(${err instanceof Error ? err.message : String(err)}). The server still runs and this `
        + 'page still works; what is lost is that nothing else can find this server. '
        + '`mycontext ui --nonce` — the way to recover a tab that has lost its credential '
        + 'WITHOUT restarting — reads that file and will report no record, and the upkeep hook '
        + 'will neither probe this server nor put it back after it exits. Setting `ui.port` in '
        + '.my_context/config.json gives `--nonce` an address to try when the record is missing.',
      );
    }
  }

  return new Promise<RunningUiServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      boundPort = (server.address() as AddressInfo).port;
      // After the read-back, never before it. See `recordListeningAt`.
      recordListeningAt(boundPort);
      idle.touch();
      idle.start();
      resolve({
        port: boundPort,
        urlWithNonce: (ttlMs: number) =>
          `http://127.0.0.1:${boundPort}/#${nonces.mint(nonceTtl ?? ttlMs)}`,
        close: () => new Promise<void>((done) => {
          idle.stop();
          server.close(() => { options.onExit?.('closed'); done(); });
          server.closeAllConnections();
        }),
      });
    });
  });
}

/** The flags the main entry accepts, and the shape it hands `startUiServer`. */
export interface ServerArgs {
  port: number;
  host?: string;
  idleMs?: number;
  nonceTtlMs?: number;
}

/**
 * Parse `--flag value` pairs, and **refuse everything else**.
 *
 * `INV-nothing-is-dropped-silently` is the whole of this function. The obvious
 * `argv.indexOf('--port')` version drops three different mistakes on the floor,
 * and each of them ends as a server that runs with the wrong settings and says
 * nothing:
 *
 *   - **An unknown flag.** `--idle-ms=300` is the one that bites: the equals
 *     spelling matches no key, so the flag vanishes and the server keeps
 *     production's fifteen-minute window — a test written that way does not
 *     fail, it hangs until its own timeout.
 *   - **A flag with no value.** A trailing `--port` reads `undefined` and
 *     becomes the default, so an incomplete command line starts a server on a
 *     port the caller did not ask for.
 *   - **A repeated flag.** One of the two values is used and the other is not,
 *     and nothing says which.
 *
 * `--idle-ms` is passed through as a bare `Number()` **on purpose**:
 * `IdleMonitor`'s constructor already refuses NaN, Infinity, zero, a negative
 * and a fraction, each with a message written to be the whole user-facing
 * message. Validating it here would be a second wording for the same refusal.
 * `--port` and `--nonce-ttl-ms` have no such downstream owner — a NaN ttl makes
 * `now + NaN` an expiry no comparison can satisfy, so every nonce would be
 * refused with nothing to say why — so they are checked here.
 */
export function parseServerArgs(argv: string[]): ServerArgs {
  const seen = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i] ?? '';
    if (!flag.startsWith('--') || !KNOWN_FLAGS.includes(flag.slice(2))) {
      throw new Error(
        `mycontext ui: unknown argument ${JSON.stringify(flag)}. ` +
        `Known flags: ${KNOWN_FLAGS.map((f) => `--${f}`).join(', ')}, each written as ` +
        '`--flag value`. It is refused rather than ignored: a flag that is accepted and ' +
        'dropped starts a server with settings nobody asked for and says nothing.',
      );
    }
    const name = flag.slice(2);
    if (seen.has(name)) {
      throw new Error(
        `mycontext ui: --${name} was given twice. Refused rather than resolved, because ` +
        'either answer — first wins or last wins — uses one value and discards the other ' +
        'without saying which.',
      );
    }
    seen.add(name);
    const value = argv[i + 1];
    if (value === undefined) {
      throw new Error(`mycontext ui: --${name} needs a value; the command line ended after it.`);
    }
    values.set(name, value);
    i++;
  }

  const args: ServerArgs = { port: wholeNumber('port', values.get('port') ?? '0', 0) };
  const host = values.get('host');
  if (host !== undefined) args.host = host;
  const idleMs = values.get('idle-ms');
  // Bare `Number`: `IdleMonitor` owns this refusal and its message. See above.
  if (idleMs !== undefined) args.idleMs = Number(idleMs);
  const nonceTtlMs = values.get('nonce-ttl-ms');
  if (nonceTtlMs !== undefined) args.nonceTtlMs = wholeNumber('nonce-ttl-ms', nonceTtlMs, 1);
  return args;
}

const KNOWN_FLAGS: string[] = ['port', 'host', 'idle-ms', 'nonce-ttl-ms'];

/** A whole number at or above `min`, or a refusal naming what was passed. */
function wholeNumber(name: string, raw: string, min: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(
      `mycontext ui: --${name} must be a whole number of ${min === 0 ? '0 or more' : `${min} or more`}. ` +
      `You passed ${JSON.stringify(raw)}.`,
    );
  }
  return value;
}

/** Main-module entry: what `test/ui/helpers.ts` spawns and what Task 15's command reuses. */
if (isMainEntry(import.meta.filename, process.argv[1])) {
  // Inside the `try` because `parseServerArgs` refuses a bad command line by
  // throwing, and a bad command line is exactly the case that must print its
  // one-line message rather than a stack.
  try {
    const args = parseServerArgs(process.argv.slice(2));
    const running = await startUiServer({ cwd: process.cwd(), ...args, onExit: () => process.exit(0) });
    // Exactly one line on stdout, and the harness's readiness signal.
    process.stdout.write(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
