/**
 * @basis TASK-every-anchor-write-inside-a-lane-document-is-refused-because, REQ-every-anchor-capability-is-reachable-from-the-screen-and-a
 *
 * ── THE CONTRACT BETWEEN A WINDOW AND THE VIEWER IT IMPORTS ────────────────
 *
 * `/lane.html` does not draw a lane's transcript. It composes a `ctx` and hands
 * it to `mountDocument`, which is imported whole from `screens/conversations.js`
 * — deliberately, because a page that reimplemented the virtualised scroll
 * would be a second viewer.
 *
 * So the two files have a contract, and until 2026-09-16 NOTHING CHECKED IT.
 * `lane.js`'s own header asserted the shape was complete — *"`t`, `tFlat`,
 * `api` and `navigate` are everything `mountDocument` and its subtree reach
 * for — measured over the file"* — and that was false. `mountDocument` draws
 * four anchor write controls (Mark this point, Rename, Take it back, Put it
 * back) and every one of them calls `ctx.post`, so all four were drawn on
 * `/lane.html`, all four were reachable by mouse and by keyboard, and all four
 * threw `ctx.post is not a function` on the first click.
 *
 * WHAT IT COST. `anchorHref` sends a lane's mark to that window and the
 * application has no route of its own to a lane document, so a lane document
 * was only ever read in the one window where its write controls did not work.
 * Measured the same day: **704 of 1,310 marks carry a lane id.** More than half
 * the bookmarks in the archive sat on turns the reader could not act on, and
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` — the
 * owner's own ruling — was false for every one of them.
 *
 * WHY THIS IS A DERIVATION AND NOT A LIST. A test naming the five members by
 * hand is the same docstring one layer down: it would have been written with
 * the same four and gone green beside the same bug. This one READS what
 * `conversations.js` actually reaches for and requires the window to supply it,
 * so a viewer that starts using a sixth member fails here rather than in the
 * reader's hands.
 *
 * WHY SOURCE TEXT AND NOT AN IMPORT. `lane.js` imports `/lib/i18n.js` — an
 * absolute browser path Node cannot resolve — so neither file loads under
 * `node --test`. `shell-boot-and-heartbeat.test.ts` reads these same two files
 * as text for the same reason, and the browser half is driven in Playwright.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts: string[]): string =>
  readFileSync(path.join(ROOT, ...parts), 'utf8');

/** Every `ctx.<name>` the viewer reaches for, read out of its source. */
function membersUsed(source: string): Set<string> {
  return new Set([...source.matchAll(/\bctx\.(\w+)/g)].map((m) => m[1] ?? ''));
}

/** Every key of `lane.js`'s `const ctx = { … }`, read out of its source. */
function membersSupplied(source: string): Set<string> {
  const literal = /const ctx = \{(.*?)\n\};/s.exec(source);
  assert.notEqual(literal, null,
    'the ctx object literal could not be found in lane.js — this test reads source text, so a '
    + 'refactor that moves it must move this reader too rather than leave it silently matching '
    + 'nothing');
  return new Set(
    [...(literal?.[1] ?? '').matchAll(/^\s*(?:get\s+)?(\w+)\s*[:(]/gm)].map((m) => m[1] ?? ''),
  );
}

test('the lane window supplies every ctx member the viewer it imports reaches for', () => {
  const used = membersUsed(read('src', 'ui', 'public', 'screens', 'conversations.js'));
  const supplied = membersSupplied(read('src', 'ui', 'public', 'lane.js'));

  // The two ways this assertion can lie are "found no members" and "read no
  // file", and only one of them looks like a bug — the `no-writes` derivation's
  // own rule, applied one file along.
  assert.ok(used.size >= 4,
    `the viewer was found to reach for ${used.size} ctx member(s); it has reached for 5. `
    + 'A collapse means the pattern stopped matching, not that the contract shrank.');
  assert.ok(supplied.size >= 4,
    `the window was found to supply ${supplied.size} ctx member(s); it supplies 6.`);

  const missing = [...used].filter((name) => !supplied.has(name)).sort();
  assert.deepEqual(missing, [],
    'a member the viewer calls is not on the ctx the lane window hands it, so every control that '
    + 'reaches for it throws in that window while still being drawn and still being focusable. '
    + 'Either supply it in lane.js or stop drawing the control that needs it — and the second is '
    + 'what makes REQ-every-anchor-capability-is-reachable-from-the-screen-and-a false.');
});

/**
 * **THE VERB, ASSERTED SEPARATELY FROM THE CONTRACT.**
 *
 * The test above would stay green if `post` were supplied as a stub that
 * refused, or as `readJson` under another name. This one holds the two
 * properties the fix actually rests on: it is a POST, and it carries the
 * cookie — which is the whole credential story for this window, measured on
 * 2026-09-16 (`POST /api/conversations/anchors/drop` with
 * `credentials: 'same-origin'` and no custom header answered **400 "id is
 * required."**, the route's own validation rather than 401 or 403).
 */
test('the lane window writes with the cookie and nothing else', () => {
  const lane = read('src', 'ui', 'public', 'lane.js');
  const fn = /async function postJson\([\s\S]*?\n\}/.exec(lane)?.[0] ?? '';
  assert.notEqual(fn, '', 'postJson is what supplies ctx.post');
  assert.match(fn, /method: 'POST'/, 'a write, not a second reader under another name');
  assert.match(fn, /credentials: 'same-origin'/,
    'the token cookie is Path=/, HttpOnly and SameSite=Strict, and validateApiRequest accepts '
    + 'header ?? cookie — so this window needs no token memory, which is the state its own '
    + 'header says it must not pretend to have');
  assert.doesNotMatch(fn, /X-Mycontext-Token/,
    'and it must NOT grow one: a header here would mean remembering a token, which is exactly '
    + 'the shell state readJson refuses on this page');
});
