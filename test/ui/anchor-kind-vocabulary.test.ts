// @basis TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your,
// CONST-node-24-no-build-step,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE KIND VOCABULARY IS WRITTEN TWICE, SO IT IS MEASURED.**
 *
 * `OWNER_ANCHOR_KINDS` lives in `src/core/anchors.ts`, which Node executes as
 * TypeScript; `OWNER_KIND_CHOICES` lives in
 * `src/ui/public/screens/conversations.js`, which a BROWSER loads with no
 * build step (`CONST-node-24-no-build-step`). Neither can import the other and
 * there is no third place both can read, so the list exists twice — and this
 * file is the reason that is a measured copy rather than a remembered one.
 *
 * It is the bargain `TIP_MS` and `conv.doc.follows` already strike one screen
 * along, named where the copy is: *"what holds it to `TIP_MS` is
 * `test/ui/conversation-follow-cadence.test.ts` rather than memory."*
 *
 * ── WHAT A DRIFT WOULD ACTUALLY COST, so this is not read as tidiness ─────
 *
 *   - A kind in the SCREEN and not in the core is a `<select>` option that
 *     the route answers 400 to. The reader picks it, presses Save, and is told
 *     the vocabulary does not hold the word the screen just offered them.
 *   - A kind in the CORE and not in the screen is a capability the product has
 *     and the UI cannot reach, which is exactly what
 *     `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` was
 *     filed about.
 *   - A kind in both and in NEITHER string table blanks the form: `t()` throws
 *     on a key it does not hold, and a throw inside a render leaves a tab
 *     showing nothing at all while every other test passes.
 *
 * ── WHAT IT CANNOT DO, said so a green run is not overread ────────────────
 *
 * It compares membership and key coverage. It cannot tell a Hebrew word that
 * is a mistranslation from one that is right, and it cannot tell whether the
 * six kinds are the SIX HE WANTED — that is the item's ruling and not a
 * property of the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OWNER_ANCHOR_KINDS, AUTOMATIC_ANCHOR_KINDS } from '../../src/core/anchors.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

// The screens import their siblings by absolute browser paths (`/lib/…`),
// which Node cannot resolve on its own. The same hook `transcript-viewer`
// installs, for the same reason and with the same one-line rule.
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

const choices = async (): Promise<string[]> =>
  (await browserModule<{ OWNER_KIND_CHOICES: string[] }>(
    'screens', 'conversations.js')).OWNER_KIND_CHOICES;

/**
 * **ALL NINE, not the six a person may choose.**
 *
 * The three tests this file opened with all read `OWNER_KIND_CHOICES`, which is
 * the owner's own vocabulary — `note`, `decision`, `question`, `defect`,
 * `evidence`, `todo`. The kinds the AUTOMATIC pass writes (`table`, `ruling`)
 * and `report`, which the screen has a word for and neither core list holds,
 * were in NO assertion here. That is how `conv.anchors.kind.ruling` came to
 * read "a ruling you gave" — provenance, said one field along from the
 * provenance field, in the one third of the vocabulary nothing was reading.
 */
const everyKind = async (): Promise<string[]> =>
  [...(await browserModule<{ ANCHOR_KIND_KEYS: Set<string> }>(
    'screens', 'conversations.js')).ANCHOR_KIND_KEYS];

const hues = async (): Promise<Record<string, string | null>> =>
  (await browserModule<{ ANCHOR_KIND_HUE: Record<string, string | null> }>(
    'screens', 'conversations.js')).ANCHOR_KIND_HUE;

const table = async (language: 'en' | 'he'): Promise<Record<string, string>> =>
  (await browserModule<{ strings: Record<string, string> }>(
    'strings', `${language}.js`)).strings;

test('the form offers exactly the kinds the route accepts', async () => {
  const offered = await choices();
  assert.deepEqual([...offered].sort(), [...OWNER_ANCHOR_KINDS].sort(),
    'the screen and the core disagree about what kinds a person may choose. A kind only the '
    + 'screen has is an option the route answers 400 to; a kind only the core has is a '
    + 'capability the UI cannot reach.');
  // A list that emptied would make every assertion below vacuous, and the
  // route's own test says the same thing about the core's copy.
  assert.ok(offered.length > 0, 'an empty vocabulary makes everything here vacuous');
});

test('note is the kind the form opens on', async () => {
  const offered = await choices();
  assert.equal(offered[0], 'note',
    'the first option is what a reader who says nothing gets, and `apiAnchorMark` defaults to '
    + '`note` for a stated reason: it is what every hand-made anchor in this workspace already '
    + 'carries. A form opening on anything else would silently re-kind the ordinary case.');
});

/**
 * **A MIRROR-CHECK, AND ITS POWER IS BORROWED — said so a green run is not
 * overread.**
 *
 * The test above holds the form's list EQUAL to `OWNER_ANCHOR_KINDS`, so this
 * one can only go red when BOTH lists drift together — which is to say when
 * the core itself gains an automatic kind. What actually holds the two
 * vocabularies apart is `test/core/anchor-kinds.test.ts`, on the core's own
 * copy, and that is where a real breach would be caught first.
 *
 * It is kept because it states the item's constraint AT THE SCREEN, where the
 * `<select>` is built, and because the day somebody replaces the equality
 * above with something weaker this becomes the only thing standing. Measured
 * 2026-09-15: adding `'table'` to the form reddens the equality test, and this
 * one with it.
 */
test('no kind the form offers is one the automatic pass writes', async () => {
  const offered = new Set(await choices());
  const shared = AUTOMATIC_ANCHOR_KINDS.filter((kind) => offered.has(kind));
  assert.deepEqual(shared, [],
    'the form offers a kind the automatic pass writes. The item\'s one constraint is that the '
    + 'two vocabularies stay disjoint, so that reconciliation can never mistake a bookmark you '
    + 'made for one it made.');
});

test('every kind the form offers has a word in BOTH tables', async () => {
  const offered = await choices();
  const en = await table('en');
  const he = await table('he');
  const missing: string[] = [];
  const untranslated: string[] = [];
  for (const kind of offered) {
    const key = `conv.anchors.kind.${kind}`;
    if (typeof en[key] !== 'string' || en[key] === '') { missing.push(`${key} (English)`); }
    if (typeof he[key] !== 'string' || he[key] === '') { missing.push(`${key} (Hebrew)`); }
    if (en[key] !== undefined && en[key] === he[key]) untranslated.push(key);
  }
  assert.deepEqual(missing, [],
    'a kind offered in the form with no word in a table draws its raw id to that table\'s '
    + 'readers — or throws, because t() throws on a key it does not hold');
  assert.deepEqual(untranslated, [],
    'a kind whose two tables are byte-identical is an untranslated key wearing a '
    + 'translation\'s clothes');
});

test('a kind is a NAME, never a sentence about who marked it', async () => {
  const offered = await choices();
  const en = await table('en');
  // Read in a `<select>`, where an option carrying a whole clause is an option
  // nobody scans — and `kind.note` used to read "you marked this", which said
  // the same thing as `origin.owner` ("you marked it") one field along.
  const wordy = offered
    .map((kind) => [kind, en[`conv.anchors.kind.${kind}`] ?? ''] as const)
    .filter(([, word]) => word.split(/\s+/).length > 4)
    .map(([kind]) => kind);
  assert.deepEqual(wordy, [],
    'an option in the kind list is a sentence rather than a name');
});

/* ══ THE KINDS THE AUTOMATIC PASS WRITES ARE PART OF THE VOCABULARY ═══════ */

test('every kind the screen can DRAW has a word in both tables', async () => {
  const kinds = await everyKind();
  const en = await table('en');
  const he = await table('he');
  assert.ok(kinds.length > 6,
    'the set the screen draws from is no larger than the set a person may choose, so this '
    + 'file is back to measuring only the owner half and the automatic kinds are unread again');
  const missing: string[] = [];
  for (const kind of kinds) {
    const key = `conv.anchors.kind.${kind}`;
    if (typeof en[key] !== 'string' || en[key] === '') missing.push(`${key} (English)`);
    if (typeof he[key] !== 'string' || he[key] === '') missing.push(`${key} (Hebrew)`);
  }
  assert.deepEqual(missing, [],
    'a kind the screen draws has no word in a table. `anchorRow` guards this with '
    + '`ANCHOR_KIND_KEYS.has(...)` and falls back to the raw id, so the failure is silent on '
    + 'screen: a Hebrew reader is shown `ruling`.');
});

/**
 * **A KIND IS A NAME, AND THIS IS THE HALF THAT WAS NOT MEASURED.**
 *
 * `TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds`, closing
 * paragraph: *"`conv.anchors.kind.ruling` reads 'a ruling you gave' — that is
 * provenance, not a kind, and the row already says 'marked for you' one field
 * along. `kind.note` was moved off exactly that duplication yesterday."*
 *
 * The existing NAME test above reads `OWNER_KIND_CHOICES` and caps at FOUR
 * words; "a ruling you gave" is four and is not an owner choice, so it cleared
 * that gate on both counts. This one reads all nine and caps at three.
 *
 * ── WHAT IT CANNOT DO, so a green run is not overread ────────────────────
 *
 * **It catches the English half only, and the reason is grammatical rather
 * than an omission.** English carries the person as a separate pronoun — "you"
 * — which is a token a word count notices. Hebrew carries it as a VERB SUFFIX:
 * `הכרעה שנתתם` is two words, exactly as `הכרעה` is one more than one, and no
 * count of tokens can tell them apart. Holding the two tables to the same
 * shape would not help either: `evidence` is one word in English and `ראיה` is
 * one in Hebrew, but `something to do` is three against `משהו לעשות`'s two, so
 * a parity rule would redden on a correct pair. The Hebrew half is held by
 * translation review and by this test's English twin failing first.
 */
test('a kind NAMES itself and never says who marked it', async () => {
  const kinds = await everyKind();
  const en = await table('en');
  const wordy = kinds
    .map((kind) => [kind, en[`conv.anchors.kind.${kind}`] ?? ''] as const)
    .filter(([, word]) => word.trim().split(/\s+/).length > 3)
    .map(([kind, word]) => `${kind}: ${JSON.stringify(word)}`);
  assert.deepEqual(wordy, [],
    'the word for a kind is a clause rather than a name. It is read in a `<select>` and on every '
    + 'row of a list measured at 1,155 marks, and the row already carries WHO marked it in '
    + '`conv.anchors.origin.*` — a kind that says so again is one fact in two fields.');
});

/**
 * **THE HUE TABLE IS TOTAL, AND THAT IS WHY `note` IS WRITTEN AS `null`.**
 *
 * `TASK-every-kind-of-mark-is-drawn-in-the-same-grey-so-nine-kinds`. A kind
 * added to `ANCHOR_KIND_KEYS` with no entry here would read `undefined`,
 * `kindHueClass` would return `''`, and the kind would draw grey — which is
 * indistinguishable on screen from `note`'s DELIBERATE grey. A hole that looks
 * exactly like a decision is a hole nobody finds.
 */
test('every kind the screen can draw has a hue group, or an explicit none', async () => {
  const kinds = await everyKind();
  const groups = await hues();
  const holes = kinds.filter((kind) => !Object.hasOwn(groups, kind));
  assert.deepEqual(holes, [],
    'a kind has no entry in ANCHOR_KIND_HUE. Write `null` if it is deliberately ungrouped — '
    + 'an absent key and a null one look identical on screen and only one of them is a '
    + 'decision.');
  const strays = Object.keys(groups).filter((kind) => !kinds.includes(kind));
  assert.deepEqual(strays, [],
    'ANCHOR_KIND_HUE names a kind the screen cannot draw, so a group is being kept for a '
    + 'vocabulary that has moved on');
});

/**
 * **THE BUDGET IS FIVE AND THE GROUPING SPENDS THREE OF THEM** —
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`, which
 * forbids a sixth meaning-hue outright.
 *
 * This gate is about the SET of groups, not about which kind is in which: the
 * grouping is a design ruling and belongs in the item, but "nine kinds did not
 * quietly become nine colours" is a property, and it is the one the decision
 * exists to protect.
 */
test('the kind grouping spends at most three of the five meaning hues', async () => {
  const groups = await hues();
  const spent = [...new Set(Object.values(groups).filter((g): g is string => g !== null))];
  assert.ok(spent.length <= 3,
    `the kind grouping spends ${spent.length} hue classes (${spent.join(', ')}). The budget is `
    + 'five for the WHOLE product and this surface is one of many; nine kinds do not get nine '
    + 'colours, and a grouping that grows a class per kind has stopped being a grouping.');
  assert.ok(spent.length > 0, 'no kind carries a hue at all, so every assertion here is vacuous');
});
