/**
 * The ports a browser refuses to open, and the retry that keeps a test child
 * off them.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `startUiChild` asks the OS for a port by binding `--port 0`. The OS answers
 * from its ephemeral range and has no opinion about who will connect. Chrome
 * does: it refuses a fixed list of ports outright, BEFORE it opens a socket,
 * and answers `net::ERR_UNSAFE_PORT`. When the two disagree, the browser suite
 * dies on a navigation with no assertion behind it — an intermittent red that
 * reads exactly like a regression and says nothing about the product. Observed
 * on 2026-08-23, on port 6669.
 *
 * Nothing in the harness ever checked the port it was handed against the
 * constraint its consumer actually imposes. That is the defect. The OS did not
 * choose badly; it was never told what "well" meant.
 *
 * ── THE LIST IS MEASURED, NOT REMEMBERED ───────────────────────────────────
 *
 * Chromium's `net/base/port_util.cc` calls this `kRestrictedPorts`. Copying it
 * out of memory is how a magic array gets one entry wrong for two years, so it
 * was measured instead, on 2026-08-23, against both browsers the e2e config
 * drives — Playwright's bundled Chromium (`chromium-1234`) and Google Chrome as
 * installed (`channel: 'chrome'`):
 *
 *   - Every port from 1 to 65535 was requested from a page already loaded over
 *     loopback, and the failure text of each request was read. Chrome applies
 *     the block BEFORE connecting, so a blocked port answers
 *     `net::ERR_UNSAFE_PORT` while an ordinary closed port answers something
 *     else — which is what makes a sweep possible without binding 65,535
 *     sockets.
 *   - **Both browsers refused exactly the 80 ports below, and nothing above
 *     10080.** The two sets were identical.
 *   - Corroborated end to end with a real server: a page genuinely served on
 *     6669 fails `net::ERR_UNSAFE_PORT`, while the same bytes on an OS-chosen
 *     port return 200.
 *
 * **Why this machine sees it at all.** `netsh int ipv4 show dynamicport tcp`
 * reports Start Port 1024, Number of Ports 13977 — an ephemeral range of
 * 1024-15000, which contains 17 of the 80 (1719, 1720, 1723, 2049, 3659, 4045,
 * 5060, 5061, 6000, 6566, 6665-6669, 6697, 10080). That is about 1 start in
 * 820. A host left on the Windows default of 49152-65535, or on Linux's
 * 32768-60999, draws from a range that contains NONE of them and can never
 * reproduce this — which is exactly why the failure looked like a ghost. The
 * measured ceiling of 10080 is asserted in `unsafe-ports.test.ts`, because that
 * ceiling is the whole reason the bug is invisible on other machines.
 *
 * The ports are listed one per line with what they are, so this reads as a fact
 * about the world rather than as a magic array.
 */

/**
 * Every port Chrome and Chromium refuse to open, measured 2026-08-23.
 * Chromium calls this `kRestrictedPorts`.
 */
export const CHROME_UNSAFE_PORTS: ReadonlySet<number> = new Set([
  1,     // tcpmux
  7,     // echo
  9,     // discard
  11,    // systat
  13,    // daytime
  15,    // netstat
  17,    // qotd
  19,    // chargen
  20,    // ftp data
  21,    // ftp access
  22,    // ssh
  23,    // telnet
  25,    // smtp
  37,    // time
  42,    // name
  43,    // nicname (whois)
  53,    // domain (DNS)
  69,    // tftp
  77,    // priv-rjs
  79,    // finger
  87,    // ttylink
  95,    // supdup
  101,   // hostriame
  102,   // iso-tsap
  103,   // gppitnp
  104,   // acr-nema
  109,   // pop2
  110,   // pop3
  111,   // sunrpc
  113,   // auth (ident)
  115,   // sftp
  117,   // uucp-path
  119,   // nntp
  123,   // ntp
  135,   // loc-srv / epmap
  137,   // netbios name service
  139,   // netbios session service
  143,   // imap2
  161,   // snmp
  179,   // bgp
  389,   // ldap
  427,   // slp (also Apple Filing Protocol discovery)
  465,   // smtp+ssl
  512,   // print / exec
  513,   // login
  514,   // shell
  515,   // printer
  526,   // tempo
  530,   // courier
  531,   // chat
  532,   // netnews
  540,   // uucp
  548,   // afp (Apple Filing Protocol)
  554,   // rtsp
  556,   // remotefs
  563,   // nntp+ssl
  587,   // smtp submission (rfc6409)
  601,   // syslog-conn (rfc3195)
  636,   // ldap+ssl
  989,   // ftps-data
  990,   // ftps
  993,   // imap+ssl
  995,   // pop3+ssl
  1719,  // h323gatestat
  1720,  // h323hostcall
  1723,  // pptp
  2049,  // nfs
  3659,  // apple-sasl / PasswordServer
  4045,  // lockd
  5060,  // sip
  5061,  // sips
  6000,  // X11
  6566,  // sane-port
  6665,  // alternate irc
  6666,  // alternate irc
  6667,  // standard irc
  6668,  // alternate irc
  6669,  // alternate irc  <- the one this project actually drew
  6697,  // irc + tls
  10080, // amanda  <- the highest one; nothing above this is refused
]);

/** Would Chrome refuse to open a page served on this port? */
export function isChromeUnsafePort(port: number): boolean {
  return CHROME_UNSAFE_PORTS.has(port);
}

/**
 * **The ports node's own `fetch` refuses that Chrome does not.** Measured
 * 2026-08-23, in a separate investigation from the sweep above, and the two
 * measurements disagreed — correctly, because they were asking different
 * consumers.
 *
 * `undici` enforces the WHATWG Fetch "bad port" list and answers
 * `TypeError: fetch failed { cause: Error: bad port }` before it opens a
 * socket, exactly as Chrome answers `net::ERR_UNSAFE_PORT` before it opens
 * one. The two lists overlap almost completely; these are the entries the
 * sweep of both browsers measured as FINE and node's `fetch` still refuses.
 * 4190 is the same ManageSieve port the test below pins as safe FOR CHROME —
 * both facts are true, and neither is the whole answer.
 *
 * **This is the measured DIFFERENCE, not an enumeration of undici's list.**
 * The investigation that produced it swept this machine's ephemeral range
 * (1024-15000, `netsh int ipv4 show dynamicport tcp`), where nineteen Fetch-
 * blocked ports live; seventeen were already in `CHROME_UNSAFE_PORTS`. A host
 * with a different ephemeral range could meet a Fetch-blocked port outside
 * that sweep, and nothing here would know. Said out loud rather than implied
 * by a short list.
 *
 * **Why it matters that the harness uses the union.** A UI test child is
 * reached BOTH ways: `server-e2e.test.ts` and `server.test.ts` fetch it from
 * node, and the browser suite navigates to it. Screening for one consumer
 * leaves the other's failure in place — which is precisely the residue the
 * flake investigation predicted: about a tenth of the `bad port` lottery
 * survives a Chrome-only fix, and reappears as the next unidentified red run.
 */
export const FETCH_ONLY_BLOCKED_PORTS: ReadonlySet<number> = new Set([
  4190, // managesieve — refused by undici, NOT by Chrome (both browsers swept)
  6679, // osaut / alternate irc — same split
]);

/**
 * Would EITHER consumer refuse a server on this port?
 *
 * This is what a test harness must ask. `isChromeUnsafePort` answers for a
 * person navigating to a printed URL; this answers for a port a suite will
 * both fetch and navigate.
 */
export function isUnusableTestPort(port: number): boolean {
  return isChromeUnsafePort(port) || FETCH_ONLY_BLOCKED_PORTS.has(port);
}

/** The part of a started server this module needs: which port, and how to stop it. */
export interface PortHarness {
  port: number;
  stop(): Promise<void>;
}

/**
 * How many ports to ask for before giving up.
 *
 * **An unbounded retry is a hang, and a hang is the worst of the three
 * outcomes** — worse than the red it replaces, because it burns the whole
 * suite's timeout and still says nothing. So it is bounded, and the bound is
 * argued rather than picked:
 *
 * On the machine that produced this defect, 17 of 13977 ephemeral ports are
 * refused. Five draws all landing on one of them is (17/13977)^5, about 3e-15 —
 * call it never. On a hostile host where a QUARTER of the range were refused it
 * is 1 in 1024, and the run still terminates with a message instead of hanging.
 * Five is enough to make the honest failure disappear, and small enough that the
 * dishonest one cannot cost more than five spawns.
 */
export const SAFE_PORT_ATTEMPTS = 5;

/**
 * Start something, and keep the first one the browser will actually talk to.
 *
 * Generic over the harness, and taking `start` as an argument, so the decision —
 * which ports are acceptable, how many tries, what to say on failure — is a pure
 * function of a port number and can be tested without binding sockets in a loop.
 * `test/ui/unsafe-ports.test.ts` drives it with a scripted list of ports; that is
 * the only way a fix for an intermittent failure gets to be DEMONSTRATED rather
 * than hoped for.
 *
 * **A child that fails to START is not retried.** Its rejection propagates
 * untouched, on the first attempt, because "the server refused this command
 * line" is an answer, and asking the same question five times only delays it —
 * `server-e2e.test.ts`'s `--host 0.0.0.0` case asserts exactly that rejection.
 *
 * Every harness that is discarded is `stop()`ped and awaited before the next
 * attempt, so a retry cannot leak a process or keep holding the port it just
 * refused.
 */
export async function startOnSafePort<T extends PortHarness>(
  start: () => Promise<T>,
  attempts: number = SAFE_PORT_ATTEMPTS,
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(
      `startOnSafePort: attempts must be a whole number of 1 or more; got ${String(attempts)}.`,
    );
  }
  const refused: number[] = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const harness = await start();
    // The UNION, not Chrome alone: a UI test child is fetched from node by
    // `server.test.ts`/`server-e2e.test.ts` AND navigated by the browser suite.
    // See `FETCH_ONLY_BLOCKED_PORTS` for the two ports where the consumers
    // disagree and why screening for one leaves the other's failure in place.
    if (!isUnusableTestPort(harness.port)) return harness;
    refused.push(harness.port);
    await harness.stop();
  }
  throw new Error(
    `the server bound a port a consumer refuses, ${attempts} attempt(s) in a row: ` +
    `${refused.join(', ')}. Chrome answers net::ERR_UNSAFE_PORT and node's fetch answers ` +
    '`bad port`, both BEFORE opening a socket, so a test on such a port dies on the ' +
    'navigation or the request with no assertion behind it. ' +
    'THIS IS THE HARNESS, NOT THE PRODUCT — nothing about the page was tested either way. ' +
    'If it repeats, the ephemeral range is unusually narrow or the port was forced: on ' +
    'Windows check `netsh int ipv4 show dynamicport tcp`. See test/ui/unsafe-ports.ts.',
  );
}
