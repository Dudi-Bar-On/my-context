/**
 * **THE SENTENCE EVERY FINDING OF ONE CODE REPEATS, FOUND ONCE — the terminal's
 * copy of `src/ui/public/screens/doctor.js`'s `sharedTail`.**
 *
 * `TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the`, re-cut by
 * the owner on 2026-09-07 (plan:walk seq:140, option A) down to two sentences:
 * *"lift `sharedTail` into a module that BOTH `src/ui/public/screens/doctor.js`
 * and `src/cli/commands/doctor.ts` read … THE CUT IS ALREADY PROVEN — what is
 * missing is the second reader. The terminal currently gets none of it, which
 * is the half nobody noticed while the screen looked correct."*
 *
 * ── WHICH OF THE TWO RECORDED MECHANISMS THIS IS, AND WHY NOT THE OTHER ───
 *
 * `screens/doctor.js` is untyped JavaScript, served RAW from disk to the
 * browser (`src/ui/server.ts` · `PUBLIC_DIR`), and `tsconfig.json` sets no
 * `allowJs` — its `include` is `src/**\/*.ts` plus three sibling `.ts` globs. A
 * `.ts` file cannot statically import it, and the browser cannot be handed a
 * `.ts` file either, because `CONST-node-24-no-build-step` says there is no
 * compile step and no `dist/`. **One module read by both is what the item asked
 * for and what this repository cannot build**, so the question is only which of
 * the two answers already on the record applies.
 *
 * `src/cli/commands/format.ts` names them both, under its own
 * *"WHY THIS IS A SECOND COPY OF THE SPELLING, AND WHAT HOLDS THEM EQUAL"*:
 *
 *   1. a dynamic-import bridge behind a runtime arrival check —
 *      `statusline-powerline.ts`' occupancy bands, with `LEVEL_SOURCE` naming
 *      the file it reaches for;
 *   2. a copy proven equal by a parity sweep — `formatDuration`, pinned by
 *      `test/ui/duration-parity.test.ts`, and `zonedStamp`, pinned by
 *      `test/ui/zoned-stamp-parity.test.ts`.
 *
 * **The bridge is not available to this caller, and the reason is the call site
 * rather than a preference.** `cmdDoctor` is registered as a `CommandFn`
 * (`src/cli/commands/registry.ts` · `export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;`)
 * and returns an exit code; every emit under it is a synchronous `out(line)`. `await` is
 * not spellable anywhere on that path without making the whole command
 * asynchronous, which would change the shape of every command in the registry
 * for one paragraph of prose. That is the identical reason `formatDuration` and
 * `zonedStamp` were copied rather than bridged, so this takes the same deal.
 *
 * **The deal is the test, not the intention.** `test/doctor/shared-tail-parity.test.ts`
 * sweeps this repository's own doctor findings, every guard, and a
 * deterministic spread of message sets through BOTH spellings and asserts the
 * answers are identical. Two copies proven equal, rather than two hoped equal.
 * No third mechanism was invented, and `tsconfig.json` was not touched.
 *
 * ── WHAT THE FUNCTION DECIDES (the screen's reasoning, which still governs) ─
 *
 * Measured on this repo's own corpus: 61 findings carrying 63,560 characters,
 * 945 of every `citation_form` message identical on all of them — 58,000
 * characters of one paragraph. So the repeat is factored out and drawn ONCE per
 * code. Every finding keeps the whole of what is TRUE OF IT ALONE and loses not
 * one character of it; what leaves the line is only the part that was already
 * on the screen N times.
 *
 * **The cut is the producer's own sentence boundary, never a character count.**
 * The common suffix is computed backwards over the messages, then advanced to
 * the first sentence break inside it, so the finding keeps a finished sentence
 * and the note begins with one. A truncation at N characters would cut
 * mid-clause and would be a different sentence rather than a shorter one.
 *
 * Three guards, and each answers a way this could lie:
 *   - two messages at least, or there is no repetition to factor;
 *   - `SHARED_MIN` characters at least, so a shared full stop earns no note;
 *   - every message must keep WORDS of its own, so two identical messages never
 *     collapse into two blank lines and one note.
 * Fail any of them and the answer is the empty string — the surface prints
 * exactly what it printed before, which is the safe direction for a defect
 * here.
 */

/** The length a shared tail must reach before it is worth saying separately. */
export const SHARED_MIN = 60;

/** One letter or one digit — what "the finding still says something" means. */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The text every one of `messages` ends with, beginning at a sentence break, or
 * `''` when factoring it out would lose something.
 *
 * Character-for-character the decision `screens/doctor.js` makes. Any edit here
 * is an edit there, and the parity test is what says so.
 */
export function sharedTail(messages: string[]): string {
  if (messages.length < 2) return '';
  let suffix = messages[0]!;
  for (const message of messages.slice(1)) {
    let same = 0;
    while (same < suffix.length && same < message.length
      && suffix[suffix.length - 1 - same] === message[message.length - 1 - same]) same += 1;
    suffix = suffix.slice(suffix.length - same);
    if (suffix === '') return '';
  }
  const boundary = /[.!?]\s+/.exec(suffix);
  if (boundary === null) return '';
  const tail = suffix.slice(boundary.index + boundary[0].length);
  if (tail.length < SHARED_MIN) return '';
  for (const message of messages) {
    // WORDS of its own, not merely characters: a message whose whole first
    // 'sentence' is the punctuation that opened it would pass a trim() and
    // still leave a line saying '.' beside a note holding everything.
    if (!LETTER_OR_DIGIT.test(message.slice(0, message.length - tail.length))) {
      return '';
    }
  }
  return tail;
}
