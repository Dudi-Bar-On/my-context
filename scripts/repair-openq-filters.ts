/**
 * One-off repair for F1: OPENQ-how-do-filters-respect-dependencies.md carries
 * an observation whose text ends in a trailing "(...)" — `parseObservations`
 * (item.ts) reads a trailing parenthetical as the observation's `context`
 * field, so the text silently truncated at "merely referential" and lost the
 * second list on every read. `validateObservationText` (mutate.ts) refuses
 * this shape at the write boundary today, but this item predates the guard.
 *
 * This script loads the item through `parseItem` (so nothing but the one
 * broken observation's text changes), rewrites that text so the parenthetical
 * is no longer trailing — keeping both lists, losing neither — and writes it
 * back through `writeItem`, which recomputes the checksum from the corrected
 * content. No checksum is hand-typed.
 *
 * Run once: node scripts/repair-openq-filters.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseItem } from '../src/core/item.ts';
import { validateObservationText } from '../src/core/validate.ts';
import { writeItem } from '../src/core/rebuild.ts';

const ROOT = path.join(process.cwd(), '.my_context');
const REL = 'items/open_question/OPENQ-how-do-filters-respect-dependencies.md';
const FILE = path.join(ROOT, ...REL.split('/'));

// `parseObservations` already reads the trailing "(...)" as this
// observation's `context` field, so on disk-as-parsed the *text* ends at
// "merely referential" and the second list survives only in `context`. The
// repair reunites them into a single, non-truncating text and clears
// `context` so nothing is duplicated between the two fields.
const BROKEN_TEXT =
  'Which relation types are load-bearing (blocks, depends_on, constrains, enforces) versus ' +
  'merely referential';
const BROKEN_CONTEXT = 'derived_from, links_to, discovered_by, supersedes';

const FIXED =
  'Which relation types are load-bearing (blocks, depends_on, constrains, enforces) versus ' +
  'merely referential — derived_from, links_to, discovered_by, supersedes';

const raw = readFileSync(FILE, 'utf8');
const item = parseItem(raw, REL, 'project');

const idx = item.observations.findIndex(
  (o) => o.text === BROKEN_TEXT && o.context === BROKEN_CONTEXT,
);
if (idx === -1) {
  throw new Error(
    `expected observation not found — the file may already be repaired or have changed. ` +
    `Looked for text ${JSON.stringify(BROKEN_TEXT)} with context ${JSON.stringify(BROKEN_CONTEXT)}`,
  );
}

validateObservationText(FIXED, 'the repaired observation text');
item.observations[idx] = { ...item.observations[idx], text: FIXED, context: null };

const written = writeItem(ROOT, item);
console.log(`repaired ${written}`);
