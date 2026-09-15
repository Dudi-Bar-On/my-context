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
