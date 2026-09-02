import { Agent, request as httpRequest } from 'node:http';
import net from 'node:net';
import { clearUiServerRecord, readUiServerRecord } from './ui-server-record.ts';

// --- Is a UI server actually there? -----------------------------------------
//
// `ui-server-record.ts` writes down where a server SHOULD be. This module is
// the part that finds out, and the distinction between the two is the whole
// point of having two modules.
//
// A record is a CLAIM. A server killed with the machine, a process that crashed
// between `listen` and its own cleanup, a pid the operating system has since
// handed to something else — all three leave a record that reads perfectly and
// describes nothing. Believing it would be the same mistake as the audit
// projection that reported the corpus loading for nine days while no injection
// had happened since 2026-08-19: a query correct about what it measured and
// silent about what it missed. So liveness is PROVED, in three steps, and only
// the third one decides.
//
// WHAT "ALIVE" MEANS HERE, stated because the narrow reading is deliberate: the
// port accepts a TCP connection. A server that accepts and then answers wrongly
// is a different defect with a different fix, and restarting it would destroy
// the evidence while fixing nothing. This probe exists to answer "is there a
// process listening for the owner's browser", and it answers exactly that.

/**
 * How long the connect attempt may take.
 *
 * This runs on `Stop`, which the platform genuinely waits for before ending an
 * assistant turn, on a 3-second hook timeout — so the budget for the whole hook
 * is small and a probe is only one of the things in it. A loopback connect to a
 * listening socket completes in well under a millisecond; anything approaching
 * a quarter of a second means the port is not answering, and for this question
 * "not answering" and "not there" are the same answer.
 */
export const PROBE_TIMEOUT_MS = 250;

export type Liveness =
  /**
   * A server is listening where the record said.
   *
   * `pid` is carried because the ONE caller that may need to end this server —
   * `ui-server-upkeep.ts`, when the server answers and reports its own code
   * stale — would otherwise re-read the record to find it. Two reads of one
   * file inside one call is two chances to read two different servers: the
   * record can be rewritten between them by a restart racing this very probe.
   * The pid that comes back here is the pid whose port was just proved to
   * answer, which is the only pid it is safe to signal.
   *
   * `workspace` rides along for the same caller and the same reason. A UI
   * server serves ONE corpus — the one its working directory resolves to — and
   * a replacement started anywhere else is not a replacement: measured
   * 2026-09-02, a restart run from a nested directory came back serving 44
   * items where the server it replaced had been serving 760, and answered every
   * question correctly about the wrong corpus.
   */
  | { state: 'alive'; pid: number; port: number; url: string; workspace: string }
  /** Nothing has ever recorded a server, or the record was unreadable. */
  | { state: 'no-record' }
  /** A record existed and was WRONG. It has been removed. */
  | { state: 'dead'; why: 'pid' | 'port'; port: number };

export async function probeUiServer(
  globalRoot?: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<Liveness> {
  const record = readUiServerRecord(globalRoot);
  if (record === null) return { state: 'no-record' };

  // Step 2: the pid. Cheap, synchronous, and it catches the ordinary case — a
  // server the owner closed, or one that went with a reboot.
  //
  // It is NOT sufficient and must not be treated as though it were: pids are
  // reused, so a live pid may belong to something that has never opened a
  // socket. Signal 0 sends nothing; it only asks whether the process exists and
  // whether we may signal it. EPERM therefore means SOMETHING IS THERE that we
  // do not own — which is a live pid for this purpose, and step 3 will settle
  // whether it is the server.
  try {
    process.kill(record.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') {
      clearUiServerRecord(globalRoot);
      return { state: 'dead', why: 'pid', port: record.port };
    }
  }

  // Step 3: the port. THIS is the measurement; everything above it is a claim.
  const listening = await portAccepts(record.host, record.port, timeoutMs);
  if (!listening) {
    clearUiServerRecord(globalRoot);
    return { state: 'dead', why: 'port', port: record.port };
  }
  return {
    state: 'alive',
    pid: record.pid,
    port: record.port,
    url: record.url,
    workspace: record.workspace,
  };
}

/**
 * Connect, then hang up immediately. Never rejects.
 *
 * The connection is destroyed the instant it opens: this asks a question and
 * has no business sending a byte. A request would touch the server's idle
 * monitor and make the probe itself look like the activity it is measuring —
 * a server nobody has opened would then be kept alive forever by the thing
 * checking on it.
 *
 * Every outcome is a boolean because every outcome means the same thing to the
 * caller. ECONNREFUSED, EHOSTUNREACH, a timeout and a socket that errors after
 * connecting are four different stories about one fact: nothing is serving
 * there. Distinguishing them would produce a `why` no caller could act on
 * differently.
 *
 * **Exported for `ui-server-upkeep.ts`, which asks it a different question than
 * `probeUiServer` does**, and the difference is the whole of the 2026-08-31
 * defect. `probeUiServer` aims this at the RECORD's address — "is the server we
 * wrote down still there". The upkeep aims it at the CONFIGURED port — "would
 * the server I am about to start be able to bind". With no record to aim at,
 * the first question has no answer and the second one still does, and reading
 * the first as though it answered the second is what let a port that was
 * already serving be counted three times as a server that could not start.
 */
export function portAccepts(
  host: string, port: number, timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (answer: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(answer);
    };
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// --- Is the server that answered still running the code on disk? ------------
//
// `probeUiServer` above answers "is there a process listening", and it answers
// exactly that on purpose. This half answers the question the upkeep could not
// ask until now: **the process that answered loaded its TypeScript modules once
// and holds them; has the disk moved on since?**
//
// The measured case, 2026-09-02: the running server started at 16:12:39, the
// last commit to its own modules landed at 16:28:26 — sixteen minutes LATER —
// and the upkeep, probing it every minute, left it alone every time, because a
// server that accepts a connection is healthy by the only definition the
// mechanism had. The owner restarted Claude Code and got the old code back.
//
// **The answer is not derived here, it is FETCHED.** `src/ui/server.ts` already
// serves `staleCode` on `/api/meta`, computed from the one `CodeIdentity` that
// server stamped at startup (`core/code-identity.ts`), and that same field is
// what raises the code-skew banner in an open tab. Stamping a second identity
// in the hook would be two stamps that can disagree about what "stale" means —
// this repository's most-repeated defect, measured nine times — so the running
// server is ASKED and its own answer is used.

/**
 * What the server said about itself.
 *
 * `unknown` is a third value rather than a boolean's false, and the distinction
 * is the same one `stampCodeIdentity` makes when its own walk fails: **a
 * disclosure that could not be measured must not be invented.** A refused
 * connection, a timeout, a body that will not parse and a credential exchange
 * that did not complete are all `unknown`, and every caller treats `unknown`
 * exactly as it treats `fresh` — it leaves the server alone. Restarting a
 * server because a question about it went unanswered would be a new outage
 * bought to fix an old one.
 */
export type Freshness = 'fresh' | 'stale' | 'unknown';

/**
 * How long the WHOLE exchange gets — three requests against one loopback
 * server, bounded once by a single deadline rather than three times over.
 *
 * The derivation, and it is a budget rather than a guess. This rides `Stop`, on
 * a 3-second hook timeout the platform genuinely waits on, and
 * `PROBE_TIMEOUT_MS` above has already spent up to 250ms of it. What is being
 * waited for is two in-memory operations (a nonce mint, a nonce redemption) and
 * one `/api/meta`, whose only expensive part is `CodeIdentity.isStale()` —
 * measured in `core/code-identity.ts` at 2.4ms for the stat gate and 48.7ms
 * when the gate fires and 4.43 MB has to be re-read. One second is a wide
 * multiple of that and still leaves more than half the hook's budget unspent.
 *
 * Deliberately NOT `cli/commands/ui.ts`'s `MINT_TIMEOUT_MS` of five seconds:
 * that one is a command a person is waiting at a terminal for, and it may spend
 * the time. This one is a hook on every assistant turn, and a five-second wait
 * here would be a five-second pause in front of the owner.
 */
export const FRESHNESS_TIMEOUT_MS = 1_000;

/**
 * The dispatcher these three requests go out on: **one connection per request,
 * closed when the answer is in.**
 *
 * `agent: false` is NOT the same thing and was measured not to be: since Node
 * 19 the default `Agent` has `keepAlive: true`, and `agent: false` builds a new
 * agent WITH THE DEFAULTS — so the socket is pooled rather than dropped, and a
 * `server.close()` on the other end waits on it forever. A bare `net` server
 * held one such connection indefinitely on 2026-09-02 and hung a test file that
 * had already got its answer 7ms earlier.
 *
 * That is not merely a test's problem. This caller may be about to STOP the
 * server it is talking to, and holding a pooled socket to a process being
 * asked to exit is the one connection it must not keep.
 */
const NO_KEEP_ALIVE = new Agent({ keepAlive: false });

/** What one request came back with, or `null` for every way of not answering. */
interface Answer {
  status: number;
  /** The parsed body, or `null` when there was none or it was not JSON. */
  body: unknown;
  /** `Set-Cookie`, verbatim, however many there were. */
  cookies: readonly string[];
}

/**
 * One request, and the socket goes with the answer. Never rejects.
 *
 * **`node:http` and not `fetch`, and the reason was measured rather than
 * preferred.** `fetch` keeps its connection alive under a global dispatcher
 * this module cannot reach without a runtime dependency
 * (`CONST-zero-runtime-dependencies`), and a kept-alive socket is not a
 * detail here: `server.close()` on the other end waits for it, so a probe
 * left a server unable to shut down — 2026-09-02, a test suite that hung
 * indefinitely on a socket the question had already finished with. It is
 * also exactly wrong for the caller, which may be about to STOP the server
 * it is talking to.
 *
 * `NO_KEEP_ALIVE` above is why the connection does not survive the answer, and
 * why `agent: false` is not what is passed.
 *
 * `req.setTimeout` is an INACTIVITY timeout, so the remaining budget is
 * recomputed per request from one deadline the caller holds — three requests
 * each given the whole timeout would permit three times the wait, which is the
 * budget spent three times over.
 */
function askOnce(
  target: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
  timeoutMs: number,
): Promise<Answer | null> {
  return new Promise((resolve) => {
    if (timeoutMs <= 0) { resolve(null); return; }
    let settled = false;
    let socket: net.Socket | null = null;
    // **The socket is destroyed by hand, and `req.destroy()` is not enough.**
    // Measured 2026-09-02 against a listener that accepts and hangs up: the
    // request errors with `socket hang up`, `req.destroy()` returns, and
    // `req.socket.destroyed` is still `false` — the connection stays half-open
    // and the other end's `server.close()` waits on it for the life of the
    // process. Every exit from this function goes through here for that reason.
    const done = (answer: Answer | null): void => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(answer);
    };
    try {
      const req = httpRequest(
        target,
        { method: init.method, headers: init.headers, agent: NO_KEEP_ALIVE },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
          res.on('error', () => done(null));
          res.on('end', () => {
            let body: unknown = null;
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = null; }
            const answer: Answer = {
              status: res.statusCode ?? 0,
              body,
              cookies: res.headers['set-cookie'] ?? [],
            };
            done(answer);
          });
        },
      );
      req.on('socket', (assigned: net.Socket) => { socket = assigned; });
      req.setTimeout(timeoutMs, () => done(null));
      req.on('error', () => done(null));
      if (init.body !== undefined) req.write(init.body);
      req.end();
    } catch {
      // A malformed URL, or a target this process cannot open at all. The
      // question has no answer, which is what `null` says.
      done(null);
    }
  });
}

/** One field off a JSON body, when the body is an object and the field is a string. */
function stringField(body: unknown, key: string): string | null {
  if (body === null || typeof body !== 'object') return null;
  const found = (body as Record<string, unknown>)[key];
  return typeof found === 'string' && found !== '' ? found : null;
}

/**
 * `/api/meta` is behind the gate, so this has to earn a credential first — and
 * it earns it the way `mycontext ui --nonce` already does, through
 * `POST /api/nonce`, rather than through anything invented here.
 *
 * **There is no unauthenticated route to this answer and none is added.**
 * `src/ui/server.ts` puts every `/api/` path behind `validateApiRequest`, which
 * refuses a caller with no token 401 and one with a wrong token 403; only
 * `POST /api/handoff` and `POST /api/nonce` are token-EXEMPT, and the exemption
 * is keyed on `gate.check`, not on the status. So the exchange is exactly the
 * one the product already documents for a caller holding nothing:
 *
 *   1. `POST /api/nonce`    mint a nonce from a server that is already running
 *   2. `POST /api/handoff`  redeem it for a credential
 *   3. `GET  /api/meta`     ask, carrying that credential back
 *
 * Host and Origin are still checked on all three. `node:http` sets `Host` from
 * the URL — `127.0.0.1:<port>`, which is precisely the `wantHost` the gate
 * builds — and sends no `Origin`, and an absent Origin is what the gate permits
 * for a same-origin caller. That is not a new allowance: `mintNonceFrom` in
 * `src/cli/commands/ui.ts` reaches step 1 the same way and has since
 * 2026-08-28.
 *
 * **Step 3 hands back exactly what step 2 set, cookie name and all**, which is
 * what a reloaded page does and is why this file spells no header name. The
 * gate reads `header ?? cookie` and accepts either proof; returning the
 * `Set-Cookie` the server just issued means the credential AND its name come
 * from the server's own answer. Naming `TOKEN_HEADER` here instead would be a
 * second spelling of a `src/ui/` constant inside `src/core/`, and the first
 * `src/core/` → `src/ui/` import in the tree, to carry a string the response
 * already contains.
 *
 * **The cost this buys is stated rather than hidden.** Step 1 writes one
 * `nonce-minted` audit row every time it runs (`recordNonceMint`,
 * `src/ui/security.ts`) — a credential coming into existence is a security
 * event and the log is the accountability trail for it. That is why the caller
 * floors this ask at `SPAWN_INTERVAL_MS` on its own clock rather than asking on
 * every probe: at most one row per workspace per five minutes, against the
 * sixty an unfloored per-probe ask would write in the same hour. See
 * `lastFreshnessAt` in `ui-server-upkeep.ts` for the whole argument.
 *
 * `url` ends in `/` — the liveness record's `url` field is written that way —
 * so `${url}api/meta` needs no join, which is `mintNonceFrom`'s convention and
 * not a second one.
 *
 * Never throws, and never guesses: every failure of every step is `unknown`.
 */
export async function askServerFreshness(
  url: string, timeoutMs: number = FRESHNESS_TIMEOUT_MS,
): Promise<Freshness> {
  // ONE deadline for the whole exchange, and each step gets what is left of it.
  const deadline = Date.now() + timeoutMs;
  const left = (): number => deadline - Date.now();

  const minted = await askOnce(`${url}api/nonce`, { method: 'POST' }, left());
  if (minted === null || minted.status !== 200) return 'unknown';
  const nonce = stringField(minted.body, 'nonce');
  if (nonce === null) return 'unknown';

  const body = JSON.stringify({ nonce });
  const handed = await askOnce(`${url}api/handoff`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
  }, left());
  if (handed === null || handed.status !== 200) return 'unknown';
  // Everything before the first `;` of each `Set-Cookie` is the `name=value`
  // pair; the rest is `Path`, `HttpOnly` and `SameSite`, which are instructions
  // to a browser and are never sent back.
  const cookie = handed.cookies
    .map((set) => set.split(';')[0] as string)
    .filter((pair) => pair.includes('='))
    .join('; ');
  if (cookie === '') return 'unknown';

  const meta = await askOnce(`${url}api/meta`, { method: 'GET', headers: { cookie } }, left());
  if (meta === null || meta.status !== 200) return 'unknown';
  const staleCode = meta.body !== null && typeof meta.body === 'object'
    ? (meta.body as Record<string, unknown>)['staleCode']
    : undefined;
  // `true` and `false` are the two measurements; anything else — a field a later
  // build stopped serving, a body of a shape this does not know — is the absence
  // of one, and is not read as either.
  if (staleCode === true) return 'stale';
  if (staleCode === false) return 'fresh';
  return 'unknown';
}
