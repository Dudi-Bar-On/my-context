// @basis TASK-an-exiting-server-deletes-the-liveness-record-without,
// KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that,
// RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
/**
 * **The URL a human reads off the terminal must not carry the opener's window.**
 *
 * ── THE MEASUREMENT, 2026-09-12 ────────────────────────────────────────────
 *
 * The owner pasted a URL and said it did not work. It worked; it had EXPIRED.
 * `mycontext ui` launches a browser on a URL carrying `OPENER_NONCE_TTL_MS` —
 * ten seconds — and that is right for the opener: on Windows the URL sits on a
 * command line every local account can read for the lifetime of the spawn
 * (`src/ui/open.ts`), and the launch spends it in milliseconds. But the URL
 * does not stop existing once it is spent. It is in the address bar of the tab
 * that opened, and a person who reloads it, copies it, or hands it on is
 * holding the shortest-lived credential this product mints: ten seconds against
 * `MINT_NONCE_TTL_MS`'s thirty and `PRINTED_NONCE_TTL_MS`'s ten minutes.
 *
 * ── THE 2026-09-03 RULING IS HONOURED, NOT REVERSED ───────────────────────
 *
 * That ruling sizes a credential by who spends it — a browser this process
 * opens gets thirty seconds, a human carrying the link gets ten minutes. The
 * start path is the third case it did not cover, because BOTH consumers are
 * present at once. So the opener keeps its ten seconds (and with them the
 * command-line argument that set them) and the human is given a second
 * credential sized for a human. Neither of the ruling's two windows moves, and
 * the first assertion below would go red if either did.
 *
 * ── WHY THE TTL AND NOT THE PRINTED STRING ────────────────────────────────
 *
 * The claim is about a NUMBER that a printed URL cannot show: two nonces look
 * alike and differ only in when they stop working. Proving it through the
 * string would mean waiting ten seconds and redeeming, which buys a slow test
 * and a timing race for a fact `startedLines` states directly. So it takes the
 * URL builder as a parameter and this file hands it a spy that records the
 * window it was asked for.
 *
 * The last case is what ties that unit to the call site: it reads
 * `src/cli/commands/ui.ts` and refuses any use of `OPENER_NONCE_TTL_MS` to
 * build a URL outside the `openBrowser(...)` call. Without it, `startedLines`
 * could be perfect while `cmdUi` printed something else — which is exactly the
 * shape the defect had.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startedLines } from '../../src/cli/commands/ui.ts';
import {
  MINT_NONCE_TTL_MS, OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS,
} from '../../src/ui/server.ts';

const UI_COMMAND = path.join(import.meta.dirname, '..', '..', 'src', 'cli', 'commands', 'ui.ts');

/**
 * A window SHORTER than `PRINTED_NONCE_TTL_MS`, so the ten-minute floor is what
 * decides. `IDLE_MS` — the real default, eight hours — would make
 * `printedNonceTtl` answer eight hours, and an assertion written against that
 * would be proving the floor and the follow-the-window rule at once and
 * distinguishing neither. The second case below takes the other side.
 */
const SHORT_IDLE = 60_000;

/** A builder that records the window it was asked for and answers a marker URL. */
function spy(): { asked: number[]; build: (ttlMs: number) => string } {
  const asked: number[] = [];
  return {
    asked,
    build: (ttlMs: number): string => {
      asked.push(ttlMs);
      return `http://127.0.0.1:4321/#nonce-for-${ttlMs}`;
    },
  };
}

test('the URL printed on a successful launch outlives the opener`s window', () => {
  const url = spy();
  const lines = startedLines(4321, SHORT_IDLE, url.build);

  assert.equal(url.asked.length, 1,
    `exactly one URL is minted for the reader; ${url.asked.length} were`);
  // THE ASSERTION THIS FILE EXISTS FOR. A URL a person reads off a terminal,
  // switches windows with, and pastes cannot carry the ten seconds sized for a
  // spawn that consumes it immediately.
  assert.ok(url.asked[0]! > OPENER_NONCE_TTL_MS,
    `the printed URL was minted for ${url.asked[0]}ms — the opener's window is `
    + `${OPENER_NONCE_TTL_MS}ms, and a link a human reads cannot be sized for a browser launch`);
  // And it is not the 30s one either: that window is for a browser this process
  // opens (`deliverNonce`), and the reader here is a person.
  assert.ok(url.asked[0]! > MINT_NONCE_TTL_MS,
    `the printed URL was minted for ${url.asked[0]}ms, the window sized for a browser to spend`);
  assert.equal(url.asked[0], PRINTED_NONCE_TTL_MS,
    'the printed URL must carry the window the 2026-09-03 ruling gives a human carrying a link');
  assert.ok(lines.some((line) => line.includes(`#nonce-for-${PRINTED_NONCE_TTL_MS}`)),
    `the URL that was minted never reached the output: ${JSON.stringify(lines)}`);
});

test('a longer idle window lengthens the printed URL with it', () => {
  // `printedNonceTtl` is `max(PRINTED_NONCE_TTL_MS, idleMs)` — a server asked to
  // live for a day must not print a credential that dies in ten minutes, which
  // is the 2026-08-23 measurement that rule came from. Asserted here because
  // this line is a second caller of it and could easily have hard-coded the
  // constant instead.
  const day = 24 * 60 * 60 * 1_000;
  const url = spy();
  startedLines(4321, day, url.build);
  assert.equal(url.asked[0], day,
    'the printed URL still dies in ten minutes while the server was asked to live a day — a '
    + 'live server nobody can get into is indistinguishable from a dead one (2026-08-23)');
});

test('the line says the opener`s link is spent, and how to get another', () => {
  const url = spy();
  const joined = startedLines(4321, SHORT_IDLE, url.build).join('\n');

  // Two links now exist and only one of them works. A reader who is not told
  // which reaches for the one in their address bar — the dead one.
  assert.match(joined, new RegExp(`${OPENER_NONCE_TTL_MS / 1_000}s`),
    `the output never says how short the browser's link is: ${joined}`);
  // And after the printed one is spent — it is one-shot — there has to be a
  // named way back, or this is the locked-out tab again.
  assert.match(joined, /--nonce/,
    `the output names no way to get another credential once this one is spent: ${joined}`);
  // The start facts the line has always carried must survive the addition.
  assert.match(joined, /serving on http:\/\/127\.0\.0\.1:4321/, joined);
});

test('the opener`s window builds the opener`s URL and nothing else', () => {
  const source = readFileSync(UI_COMMAND, 'utf8');
  const uses = source.split('\n')
    .map((line, index) => ({ line, at: index + 1 }))
    .filter((entry) => entry.line.includes('urlWithNonce(OPENER_NONCE_TTL_MS)'));

  // Not vacuous: the opener DOES still use it, and must, or the ten-second
  // window `src/ui/open.ts` argues for has quietly been widened.
  assert.equal(uses.length, 1,
    `expected exactly one URL minted at the opener's window; found ${uses.length}`);
  assert.match(uses[0]!.line, /openBrowser\(/,
    `src/cli/commands/ui.ts:${uses[0]!.at} mints a URL at the opener's ten-second window outside `
    + `the browser launch, which is how a human ends up holding it: ${uses[0]!.line.trim()}. `
    + 'If that URL still goes only to `openBrowser` and was merely lifted onto a line of its own, '
    + 'this gate is reading one spelling and needs widening — check where the value goes first.');
});
