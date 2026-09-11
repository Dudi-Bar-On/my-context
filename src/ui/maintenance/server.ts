/**
 * **The maintenance tool's server — and the first thing to know about it is
 * that it does not ship.**
 *
 * D41 spec §11, `plan:store seq:3` Task 9. Read §11.1 and §11.2 together,
 * because the second is only honest while the first is true:
 *
 * > *`package.json`'s `files` already keeps `scripts/` out of the published
 * > package; the same mechanism keeps this out. **A user does not fail to
 * > access the tool — they do not have it.** That is why §11.2 can skip
 * > authentication honestly.*
 *
 * And then: *"No authentication. Owner ruling: it is used for a short time and
 * then closed. Safe BECAUSE §11.1 means the surface does not exist anywhere
 * else. **If it ever ships, this section is void and must be revisited.**"*
 *
 * So the exclusion is not a packaging detail that happens to be true today. It
 * is the whole security model, and `test/rules/maintenance-absent.test.ts`
 * asserts it two ways — by asking npm what a publish would upload, and by
 * reading the `files` rule that does the excluding — rather than assuming it.
 * `MAINTENANCE_DIR` below is exported so that the assertion and the
 * `package.json` exclusion name the same directory rather than two strings
 * that agree by luck.
 *
 * ── WHY THIS IS NOT `src/ui/server.ts` WITH A FLAG ─────────────────────────
 *
 * Three reasons, and the third is the one that decides it.
 *
 *  1. `src/ui/server.ts` is a READ-ONLY surface, and `test/ui/no-writes.test.ts`
 *     holds it to one writer. This tool writes entries directly — spec §11.3
 *     says so explicitly, contrasting it with the Composer, which composes a
 *     command for a person to run precisely because it lives in the shipped UI.
 *  2. That server carries a nonce handshake, a token, an origin check and an
 *     idle timeout (`src/ui/security.ts`), all of which exist because it is
 *     reachable by a user. None of it is needed here and all of it would be
 *     code a reader has to discount.
 *  3. **It ships.** A flag on a shipped server is a surface that exists on
 *     every install and is merely turned off, which is the exact shape §11.1
 *     rejects.
 *
 * ── LOOPBACK, AND NEVER 58888 ──────────────────────────────────────────────
 *
 * Spec §11.2: *"Its own process, its own port, never 58888 (the owner's UI
 * server), a free port chosen at start. Bound to loopback only."* Both are
 * refusals BEFORE the socket is opened, not checks after it: a server that
 * binds and then complains has already been listening on the wrong interface,
 * and a port that is refused only when it is already taken would bind 58888
 * happily on the day the owner's server is down and answer in its place.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { entriesDir } from '../../rules/store.ts';
import { handle, html, type MaintenanceContext } from './router.ts';
import { escapeHtml, nav, page } from './screens/page.ts';

/**
 * The directory this tool lives in, relative to the package root, in the
 * spelling `package.json`'s `files` exclusion uses.
 *
 * Exported so the exclusion, the server and the test that proves the exclusion
 * are one string. The alternative — three literals that happen to agree — is
 * the drift this whole store exists to end, arriving in the store's own tool.
 */
export const MAINTENANCE_DIR = 'src/ui/maintenance';

/**
 * The owner's UI server, and the one port this tool may never take.
 *
 * It is a constant rather than a comment because the refusal below has to name
 * it in its own message: a worker reading "port refused" and no number will
 * try the next port up, and the next port up is fine.
 */
export const OWNERS_PORT = 58888;

/** Loopback, and the only interface this tool is allowed to answer on. */
export const LOOPBACK = '127.0.0.1';

export interface MaintenanceOptions {
  /** Must be `127.0.0.1`. Present only so the refusal can be tested. */
  host?: string;
  /** `0` — a free port chosen by the kernel — unless a caller names one. */
  port?: number;
  /** The store to maintain. Defaults to the one inside this package. */
  storeDir?: string;
  /**
   * The recommended size of the `product` tier, in bytes. Spec §10: *"the
   * budget is changeable by the owner, not a constant in the code"* — so it
   * arrives as an option and the code holds only a default.
   */
  budgetBytes?: number;
}

export interface RunningMaintenanceServer {
  host: string;
  port: number;
  url: string;
  stop(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // A maintenance form is prose, not an upload. The cap is generous enough
      // that no entry anybody would write reaches it and small enough that a
      // stuck client cannot exhaust the process.
      if (size > 2_000_000) { reject(new Error('request body too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Start the tool. Rejects rather than binding when the host is not loopback or
 * the port is the owner's.
 */
export function startMaintenanceServer(
  options: MaintenanceOptions,
): Promise<RunningMaintenanceServer> {
  const host = options.host ?? LOOPBACK;
  if (host !== LOOPBACK) {
    return Promise.reject(new Error(
      `mycontext maintenance: refusing to bind ${host} — this tool serves ${LOOPBACK} only. ` +
      `It has no authentication, which is safe only because it does not ship and is not ` +
      `reachable from the network (spec §11.1, §11.2).`,
    ));
  }
  const port = options.port ?? 0;
  if (port === OWNERS_PORT) {
    return Promise.reject(new Error(
      `mycontext maintenance: refusing port ${OWNERS_PORT} — that is the owner's UI server. ` +
      `This tool takes a free port chosen at start (spec §11.2); pass no port, or any port ` +
      `other than ${OWNERS_PORT}.`,
    ));
  }

  const ctx: MaintenanceContext = {
    storeDir: options.storeDir ?? entriesDir(),
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async (): Promise<void> => {
      const url = new URL(req.url ?? '/', `http://${LOOPBACK}`);
      let body = '';
      if (req.method === 'POST') {
        try { body = await readBody(req); } catch (err) {
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(err instanceof Error ? err.message : String(err));
          return;
        }
      }
      /**
       * **A throw becomes a page, and the page carries the message.**
       *
       * Found in the browser, not reasoned about: `writeEntry` throws
       * `StoreDamagedError` when the store has been changed by something other
       * than this tool (spec §13), and with no catch here the request simply
       * never answered — the browser sat on a navigation until the test timed
       * out, and the one sentence a person needs in order to fix it went to
       * stderr. The store's designed refusal has to reach the screen; a hung
       * tab is the one failure mode that teaches nothing.
       */
      let answer;
      try {
        answer = handle(ctx, req.method ?? 'GET', url, body);
      } catch (err) {
        answer = html(500, page('refused', `${nav()}<h1>refused</h1>`
          + `<p class="refusal">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`));
      }
      res.writeHead(answer.status, answer.headers);
      res.end(answer.body);
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const bound = server.address() as AddressInfo;
      resolve({
        host,
        port: bound.port,
        url: `http://${host}:${bound.port}/`,
        /**
         * **`closeAllConnections` first, and it is not belt-and-braces.**
         *
         * `server.close()` stops ACCEPTING and then waits for every open
         * connection to end on its own. A browser holds its socket open under
         * keep-alive, so a tab pointed at this tool keeps the close pending
         * indefinitely: measured as a Playwright fixture teardown that ran out
         * the 30s test timeout with every assertion in the test already green.
         * A stop that cannot finish while somebody is looking at the page is
         * not a stop.
         */
        stop: () => new Promise<void>((done) => {
          server.closeAllConnections();
          server.close(() => done());
        }),
      });
    });
  });
}
