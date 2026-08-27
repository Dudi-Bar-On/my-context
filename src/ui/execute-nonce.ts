/**
 * The execution nonce: proof that THIS run is the one a confirm dialog actually
 * rendered.
 *
 * Spec: `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md`
 * §3.3 and §6.3. The session token in `security.ts` proves *a browser*; it says
 * nothing about which of the things that browser could ask for a person looked
 * at. This store answers exactly that second question and nothing else: a nonce
 * is minted by the GET that renders a confirm, bound to the id and the resolved
 * argv shown in it, and it redeems at most once.
 *
 * **Why this is not optional.** The owner's ruling (§6.1) is that every command
 * in the catalogue may run, and (§6.2) that there is no kill switch — no
 * `--no-execute`, no config key, no environment variable. §6.3 states the
 * consequence in these terms: with nothing else narrowing what may run, the
 * single-use nonce bound to the exact id and argv is the only thing standing
 * between a silent local page and a corpus mutation. A page that never rendered
 * the confirm cannot mint one. That does not make a malicious local page
 * impossible — §6.3 accepts that residual out loud — it makes a *silent*
 * execution impossible, which is the property that matters.
 *
 * It is a sibling of `NonceStore` in `security.ts` and copies its central
 * discipline deliberately: **a nonce is deleted the moment redemption is
 * ATTEMPTED — spent, expired or mismatched, it is gone either way.** What it
 * adds is the binding, because a handoff nonce authorises *a session* while
 * this one authorises *one specific command*.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Two minutes: long enough to read a field-by-field diff of a real item, short
 * enough that a nonce left in a tab a user walked away from is not an authority
 * an hour later.
 *
 * Deliberately NOT the printed-URL nonce's ten minutes (`PRINTED_NONCE_TTL_MS`)
 * and not the opener's ten seconds. Those two bound *getting from a terminal to
 * a browser*; this one bounds *reading one dialog*, which is a different task
 * with a different natural length. Naming one constant for both would tie the
 * confirm window to a change made for an unrelated reason.
 */
export const EXECUTION_NONCE_TTL_MS = 120_000;

/**
 * How many outstanding nonces the store will hold. See `#sweep` — the sweep is
 * the real bound and this is the backstop for the case the sweep cannot reach.
 */
const MAX_OUTSTANDING = 1024;

/**
 * The binding: `sha256` over `JSON.stringify([id, argv])`, lowercase hex.
 *
 * **A digest, so the store holds no command text.** What is minted here sits in
 * memory for up to two minutes across an arbitrary number of requests; there is
 * no reason for it to be a second copy of item ids and argument values, and a
 * store that holds none cannot leak any.
 *
 * **JSON of the array, not a join.** A join on any separator lets `['a b']` and
 * `['a', 'b']` produce the same binding, and those are two different commands —
 * one argument containing a space is not two arguments. `JSON.stringify` keeps
 * the element boundaries, so the binding is over the argv the executor will
 * actually pass to `execFile`, not over a rendering of it.
 */
function bind(id: string, argv: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify([id, argv])).digest('hex');
}

/**
 * Constant-time comparison of two bindings.
 *
 * Both are `sha256` hex, so the lengths always match and the guard below should
 * never fire. It is here because `timingSafeEqual` THROWS on a length mismatch,
 * and a throw out of `redeem` would surface as a 500 where the honest answer is
 * a refusal. A comparison in the gate that can crash is a comparison that can
 * be made to crash.
 *
 * Constant time is cheap insurance rather than a known attack: the binding is
 * not a secret a caller is trying to learn — they supply the id and argv
 * themselves — but this is the file where a byte-at-a-time compare is a habit
 * worth not having, and 64 bytes costs nothing.
 */
function bindingEquals(stored: string, presented: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface Entry {
  /** Epoch ms, inclusive: a nonce redeems AT its expiry and not one ms later. */
  expiry: number;
  binding: string;
}

export class ExecutionNonceStore {
  #entries = new Map<string, Entry>(); // nonce -> what it authorises, until when

  /**
   * Mint a nonce authorising exactly `argv` under `id`.
   *
   * 16 bytes from `randomBytes` — the same 128 bits `NonceStore` uses. This one
   * never transits a command line, but it is presented by a page that also
   * renders agent-authored item bodies, so it is unguessable or it is not a
   * credential.
   */
  mint(
    id: string,
    argv: readonly string[],
    ttlMs: number = EXECUTION_NONCE_TTL_MS,
    now: number = Date.now(),
  ): string {
    this.#sweep(now);
    const nonce = randomBytes(16).toString('hex');
    this.#entries.set(nonce, { expiry: now + ttlMs, binding: bind(id, argv) });
    return nonce;
  }

  /**
   * Spend one attempt against `nonce`, and answer whether it authorised this
   * exact command.
   *
   * **The delete comes FIRST, before the clock and before the binding.** That
   * ordering is the whole point: a mismatched guess costs the nonce just as a
   * correct one does. A nonce that survived a wrong guess would be a nonce an
   * attacker may guess against — 128 bits is not brute-forceable, but "you may
   * try this credential as many times as you like" is not a property to leave
   * lying around next to a store whose entries are minted by page navigation.
   * `NonceStore` deletes on attempt for the same reason; here there is simply
   * one more way to be wrong.
   */
  redeem(
    nonce: string,
    id: string,
    argv: readonly string[],
    now: number = Date.now(),
  ): boolean {
    const entry = this.#entries.get(nonce);
    if (entry === undefined) return false;
    this.#entries.delete(nonce); // one-shot: spent, expired OR mismatched, it is gone
    if (now > entry.expiry) return false;
    return bindingEquals(entry.binding, bind(id, argv));
  }

  /**
   * Drop entries whose window has closed, and — only if that was not enough —
   * the oldest entries beyond `MAX_OUTSTANDING`.
   *
   * **Why this store sweeps when `NonceStore` does not.** A handoff nonce is
   * minted a handful of times per invocation, so `NonceStore` can say "nothing
   * sweeps a nonce that is never presented, and nothing needs to". Here a nonce
   * is minted by every GET that renders a confirm, against a server that stays
   * up for as long as the tab does, and a dialog opened and then closed without
   * confirming is the ordinary case rather than the odd one. Left alone the map
   * would grow with browsing, not with executing.
   *
   * Sweeping on `mint` and not on a timer: a timer would keep an idle process
   * awake to tidy a Map, and the only moment the size can grow is a mint, so
   * that is the moment worth paying for. Cost is O(outstanding) per mint, and
   * outstanding is bounded by the mints of the last two minutes.
   *
   * The cap evicts OLDEST-FIRST, and what it costs when it fires is that
   * somebody's open confirm stops working and they confirm again — a refusal,
   * which is the safe direction. It cannot authorise anything: eviction only
   * ever removes authority. It is here because a page that can mint can mint in
   * a loop, and unbounded growth driven by a caller is a denial of service with
   * extra steps; 1024 outstanding confirms is far past any real use.
   */
  #sweep(now: number): void {
    for (const [nonce, entry] of this.#entries) {
      if (now > entry.expiry) this.#entries.delete(nonce);
    }
    // Map iterates in insertion order, so this takes the oldest first.
    for (const nonce of this.#entries.keys()) {
      if (this.#entries.size < MAX_OUTSTANDING) break;
      this.#entries.delete(nonce);
    }
  }
}
