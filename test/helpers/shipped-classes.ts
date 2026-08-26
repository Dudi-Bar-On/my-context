/**
 * **Every class token `src/ui/public/styles.css` gives a rule to.**
 *
 * Nine screen tests ask "does this screen invent a class?", and until
 * 2026-08-26 the only acceptable answer was "no class the mockup does not
 * draw". `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` retired
 * that direction: the app is what gets built, and a feature added to it no
 * longer has to be drawn in the design of record first. Under the old rule a
 * new class was, in the tests' own words, "either a typo or a decision the
 * owner has not taken"; under the new one there is a third possibility, and it
 * is now the ordinary one.
 *
 * So the allowed set becomes the mockup's classes UNION this one, and the
 * question each test asks changes from *"did the design draw it?"* to **"does
 * anything style it?"**. That keeps the whole of what those tests were actually
 * catching — a typo produces a class with no rule anywhere and still fails —
 * while a deliberate new class with a real rule passes. The check is not
 * weakened so much as re-pointed at the thing it was always a proxy for.
 *
 * **It reads SELECTORS only, never declaration bodies.** A `content: ".foo"`
 * string or a comment naming a class would otherwise widen the allowed set with
 * text that styles nothing, which is precisely the hole a typo would fall
 * through. Comments are stripped first and only the text before each `{` is
 * scanned.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STYLES = fileURLToPath(new URL('../../src/ui/public/styles.css', import.meta.url));

let cached: Set<string> | null = null;

export function styledClasses(): Set<string> {
  if (cached !== null) return cached;
  const css = readFileSync(STYLES, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Set<string>();
  // Everything before a `{` is a selector list (or an at-rule prelude, which
  // carries no class tokens and so contributes none).
  for (const block of css.split('{')) {
    const selector = block.includes('}') ? block.slice(block.lastIndexOf('}') + 1) : block;
    for (const m of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) tokens.add(m[1]);
  }
  cached = tokens;
  return tokens;
}

/**
 * The union a screen test should measure against: what the design of record
 * draws, plus what the shipped stylesheet actually styles.
 */
export function allowedClasses(drawnByMockup: Set<string>): Set<string> {
  return new Set([...drawnByMockup, ...styledClasses()]);
}
