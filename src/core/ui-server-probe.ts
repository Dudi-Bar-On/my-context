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
const PROBE_TIMEOUT_MS = 250;

export type Liveness =
  /** A server is listening where the record said. */
  | { state: 'alive'; port: number; url: string }
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
  const listening = await connects(record.host, record.port, timeoutMs);
  if (!listening) {
    clearUiServerRecord(globalRoot);
    return { state: 'dead', why: 'port', port: record.port };
  }
  return { state: 'alive', port: record.port, url: record.url };
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
 */
function connects(host: string, port: number, timeoutMs: number): Promise<boolean> {
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
