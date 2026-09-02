/**
 * ══ UNPINNED BY THE OWNER'S RULING OF 2026-09-02 ═══════════════════════════
 *
 * *"i told you not to change the mockup" · "only our app" · "it should stay as
 * reference"* — `docs/design/web-ui-mockup.html` is a FROZEN REFERENCE. It is
 * read, never written. The owner then chose, from three options: **freeze the
 * mockup, and unpin the CSS coupling — `styles-parity` stops asserting
 * equality and becomes one-directional.** That supersedes the instruction
 * carried in this file's own header below and in several task bodies, that the
 * mockup is the design of record and must move first.
 *
 * Byte identity is a TWO-DIRECTIONAL claim: it fails when styles.css moves as
 * loudly as when the mockup does, and while the mockup cannot move, the only
 * ways to go green are to revert the app or to edit a frozen file. So every
 * `assert.equal(shipped, mockup)` below is gone.
 *
 * **What is LOST**, said plainly rather than left to be discovered: nothing
 * now compares a VALUE in `styles.css` against the design of record. A token
 * repainted, a radius, a spacing step, a chip's colour, a duration, a
 * `grid-template-areas` re-cut — all of it can drift from the mockup silently
 * and deliberately, and that drift is the ruling's intent, not a hole in it.
 *
 * **What REMAINS**, and it is most of what this file historically caught: the
 * mockup is now a FLOOR on the app's rule SET. Every selector the design of
 * record declares must still be declared in `styles.css`, non-empty. Read the
 * entries in `SCREEN_SELECTORS` below — `.chip.index` invisible for eight
 * days, `#pane` styled in one file and unbuilt in the other, `svg.chart`
 * painting every node a black slab, `.linkid` falling back to UA chrome on
 * four screens, `.md h4` styling a tag the renderer cannot emit. Every one of
 * those was a rule that DID NOT EXIST, not a rule whose bytes had drifted. A
 * presence floor still catches all of them, and it lets the app move.
 *
 * The budget gates — the five meaning hues, what a chip may spend, the
 * `@font-face` resolution, the nine vendored weights, `index.html`'s nesting
 * and its sprite's missing `style=` — constrain `styles.css`/`index.html`
 * ALONE and are untouched.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **`styles.css` and the mockup's `:root` tokens, primitive rules, and now
 * the screen-level rules the `nav.inj` screens actually render.** (Held to
 * byte identity until 2026-09-02 — see the ruling above.) Plan Task 16 Step 4b
 * started this file in the shape of
 * `test/ui/strings-parity.test.ts`: a token or a rule edited in one file and
 * not the other fails here instead of drifting silently — the exact failure
 * the retired two-palette placeholder this file replaces already caused once
 * (`docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` · `Adding it
 * here would put the same tokens in two files with no test holding them
 * together` · ~686). This task (carrying the mockup's `.app`/`.nav`/`.card`/
 * `.chip.*`/`.pair` composition/etc. across for the three built screens)
 * extends the same discipline to every block it adds, per its own brief:
 * "Extend that test with every block you add."
 *
 * **Scope, now three tiers instead of two.** `styles.css`'s own header names
 * four tiers; the first three are checked here — the TOKENS `:root`, the
 * LEGACY SCALE `:root` (newly copied whole by this task — see styles.css's
 * own comment on that block for why cherry-picking `--fs-2` alone stopped
 * being enough), the sans/mono `:root`, and every primitive-or-screen rule
 * this file or that one declares with a real selector. The `@font-face`
 * block is deliberately NOT byte-compared (its `url()` paths differ on
 * purpose); it gets its own resolution check below instead, the same shape
 * `test/ui/fonts.test.ts` already uses for the mockup's copy. The foundation
 * rules (`*`, `html,body`, `body`) and the i18n utility classes (`.m`, `.v`,
 * `bdi`, the `[dir="rtl"]` override) stay outside this file's scope, for the
 * same reason Task 16 gave them originally.
 *
 * **Extraction is CONTENT-addressed, not position-addressed.** The mockup
 * declares FIVE `:root{}` blocks total (TOKENS, LEGACY SCALE, sans/mono, plus
 * two more nested inside its own print and reduced-transparency `@media`
 * registers that redeclare a handful of the same custom-property NAMES for a
 * different context) — "the Nth `:root`" would silently pick the wrong one
 * the moment either file's ordering changes. Each of the three this file
 * copies is found by a property marker unique to it among all five —
 * `--ground:` for TOKENS, `--fs-00:` for LEGACY SCALE (checked: `--panel:`
 * and `--paper:` each recur in the print register's override block and would
 * have picked the wrong one), `--sans:` for the font stack.
 *
 * A plain rule is found by its selector anchored at the start of a line
 * (`^\.blk\{`, `/m` flag), not a bare substring search — `.lit.linked
 * .blk{…}` contains the literal text `.blk{` too, and a substring match would
 * silently grab the wrong rule's body. Line-anchoring is safe because every
 * rule this file checks is written this way in the mockup — checked by hand
 * against the source once, and re-checked every run by the "was found at
 * all" assertions below, which fail loudly if that formatting ever changes.
 *
 * **Two selectors — `.pair` and `.chip` — are genuinely declared TWICE** in
 * the mockup's own stylesheet: once as the primitive (perspective-only /
 * font-weight-only) and once again further down, adding properties the
 * primitive doesn't set. `ruleAt`'s plain `.exec()` always returns the FIRST
 * match, so the second declaration needs its own `ruleAtNth(css, sel, 1)`
 * helper rather than reusing `ruleAt` — checked directly: `docs/design/
 * web-ui-mockup.html` declares `^\.pair\{` and `^\.chip\{` (line-anchored,
 * `/gm`) exactly twice each and nothing else in this file's scope more than
 * once, verified against the live mockup before this task's rules were
 * written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const STYLES = path.join(REPO, 'src', 'ui', 'public', 'styles.css');
const FONTS = path.join(REPO, 'src', 'ui', 'public', 'fonts');
const INDEX = path.join(REPO, 'src', 'ui', 'public', 'index.html');

const mockupHtml = readFileSync(MOCKUP, 'utf8');
const stylesCss = readFileSync(STYLES, 'utf8');
const indexHtml = readFileSync(INDEX, 'utf8');

/** The mockup's inline `<style>` block only — never a comment ABOUT the CSS. */
function mockupStyleBlock(): string {
  const start = mockupHtml.indexOf('<style>');
  const end = mockupHtml.indexOf('</style>');
  assert.ok(start !== -1 && end !== -1, 'the mockup must carry an inline <style> block');
  return mockupHtml.slice(start, end);
}

const MOCKUP_CSS = mockupStyleBlock();

/**
 * The `:root{...}` block, in `css`, whose body contains `marker` — content-
 * addressed rather than positional, per the header above. `[^}]*` is safe
 * here because no token value in either `:root` block contains a `}`.
 */
function rootBlockContaining(css: string, marker: string, label: string): string {
  const blocks = [...css.matchAll(/:root\{[^}]*\}/g)].map((m) => m[0]);
  const hit = blocks.find((b) => b.includes(marker));
  assert.ok(hit !== undefined, `${label}: no :root{} block contains ${marker} — found ${blocks.length} :root block(s)`);
  return hit!;
}

/** One rule, found by its selector anchored at the START of a line. */
function ruleAt(css: string, selector: string, label: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\{[^}]*\\}`, 'm');
  const hit = re.exec(css)?.[0];
  assert.ok(hit !== undefined, `${label}: selector ${JSON.stringify(selector)} not found as a line-anchored rule`);
  return hit!;
}

/**
 * The Nth (0-based) rule for a selector the mockup declares more than once —
 * `.pair` and `.chip` only, per the header above. `ruleAt` always returns the
 * first match, which is why this exists as its own function rather than an
 * optional parameter nobody else needs.
 */
function ruleAtNth(css: string, selector: string, n: number, label: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\{[^}]*\\}`, 'gm');
  const matches = [...css.matchAll(re)];
  assert.ok(matches.length > n,
    `${label}: expected at least ${n + 1} line-anchored occurrence(s) of ${JSON.stringify(selector)}, found ${matches.length}`);
  return matches[n]![0];
}

/**
 * The custom-property NAMES a `:root{…}` block declares, in declaration order.
 * Names, never values: the ruling of 2026-09-02 frees every VALUE in
 * `styles.css` to move away from the design of record.
 */
function declaredTokens(block: string): string[] {
  return [...block.matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]!);
}

/**
 * **One-directional since the owner's ruling of 2026-09-02.** These three
 * asserted `assert.equal(shipped, mockup)` and now assert only that no token
 * the design of record declares has DISAPPEARED from `styles.css`.
 *
 * Lost: every token VALUE. `--ground` may be repainted, `--fs-2` re-stepped,
 * `--dur-act` retimed, and nothing here will say so.
 *
 * Kept: a token deleted or renamed in `styles.css` while `var(--it)` is still
 * spent somewhere still fails — which is the failure that has an invisible
 * symptom (an unresolved `var()` falls back to nothing at all), where a
 * changed value has a visible one.
 */
for (const [label, marker] of [
  ['TOKENS', '--ground:'], ['sans/mono', '--sans:'], ['LEGACY SCALE', '--fs-00:'],
] as const) {
  test(`styles.css declares every token the mockup's ${label} :root block does (values are free to differ — owner's ruling, 2026-09-02)`, () => {
    const mockup = declaredTokens(rootBlockContaining(MOCKUP_CSS, marker, 'mockup'));
    const shipped = new Set(declaredTokens(rootBlockContaining(stylesCss, marker, 'styles.css')));
    assert.ok(mockup.length > 0, `${label}: the mockup's block declares no token — the extraction is broken`);
    assert.deepEqual(mockup.filter((t) => !shipped.has(t)), [],
      `${label}: declared by the design of record and no longer declared by styles.css. `
      + 'Values may drift (the mockup is a frozen reference since 2026-09-02); a token that '
      + 'stops existing leaves every var() that spends it resolving to nothing.');
  });
}

/**
 * ── THE HUE BUDGET, WHICH NOTHING WAS COMPARING AGAINST ────────────────────
 *
 * `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` ratified
 * five meaning hues and named, in the same ruling, why the record had drifted:
 * *"there is no gate comparing the declared token set against the budget —
 * which is why five hues shipped without anyone ruling on the fifth"*. The
 * approved direction said four, the stylesheet shipped five, `--warn` was
 * added back by implementation rather than by ruling, and the disagreement
 * survived for four days across eight call sites because no test could see it.
 *
 * These two are that gate. The first pins the budget by NAME; the second pins
 * what a chip may spend, which is the surface the budget is actually about.
 *
 * **A sixth hue is not forbidden here — it is made loud.** Adding one fails
 * these two tests, and the correct response is an owner ruling that edits
 * `BUDGET` in the same commit, exactly the paperwork the fifth hue never got.
 */
const BUDGET = ['gold', 'ok', 'carry', 'crit', 'warn'] as const;
/** The decoration step a chip may spend INSTEAD of a meaning: `.index`, `.unmeas`. */
const NEUTRAL = 'dim';

test('the TOKENS block declares exactly the five budgeted meaning hues', () => {
  // Content-addressed to the `--*bg` mixes rather than to a line number: a
  // meaning hue is one the LEGACY SCALE block gives an opaque pill background
  // to, which is what makes it usable as a chip in the first place. A sixth
  // hue arriving with its own mix is caught here; one arriving WITHOUT a mix
  // is caught by the chip test below.
  // **styles.css ALONE since the owner's ruling of 2026-09-02.** This loop ran
  // over the mockup too. It must not: the budget is edited by an owner ruling,
  // and the day a sixth hue is ruled in, the mockup — frozen, and still
  // carrying five — would fail this and the only way green would be to edit a
  // file that may not be edited. Nothing is lost by dropping it: the mockup is
  // read-only, so its hue set cannot change, and this gate exists to police
  // what SHIPS. (`e2e/chip-hue-authority.spec.ts` still measures the mockup's
  // own chips in a browser, which is the check that found a defect in it.)
  for (const [label, css] of [['styles.css', stylesCss]] as const) {
    const legacy = rootBlockContaining(css, '--fs-00:', label);
    const mixed = [...legacy.matchAll(/--([a-z0-9-]+)bg:color-mix\(in oklch, ?var\(--([a-z0-9-]+)\)/g)];
    const named = mixed.map((m) => m[2]!);
    assert.deepEqual([...named].sort(), [...BUDGET].sort(),
      `${label}: the meaning hues with a chip background do not match the ruled budget of five. `
      + 'If a hue was added, it needs an owner ruling and this list edited in the same commit — '
      + 'that paperwork is exactly what --warn never got, and the direction document and the '
      + `stylesheet then disagreed in silence. Found: ${JSON.stringify(named)}`);
    for (const hue of BUDGET) {
      const tokens = rootBlockContaining(css, '--ground:', label);
      assert.match(tokens, new RegExp(`--${hue}:#[0-9a-f]{6}`),
        `${label}: --${hue} is in the budget but the TOKENS block does not declare it`);
    }
  }
});

test('every chip modifier spends a budgeted hue or the neutral — in both files', () => {
  // **This is the test that would have caught `.chip.index`.** That rule lived
  // in styles.css as an unapproved proposal and in the mockup not at all, so
  // the app drew a legible neutral chip and the design of record drew seven
  // invisible ones — and every gate was green, because a rule that exists in
  // only ONE file is invisible to a list of selectors that never names it.
  // Comparing the SETS is what makes a whole missing rule a failure.
  const allowed = new Set<string>([...BUDGET, NEUTRAL]);
  const read = (css: string): Map<string, string> => {
    const found = new Map<string, string>();
    for (const m of css.matchAll(/^\.chip\.([a-z0-9-]+)\{([^}]*)\}/gm)) {
      const colour = /(?:^|;)color:var\(--([a-z0-9-]+)\)/.exec(m[2]!)?.[1] ?? '(none)';
      found.set(m[1]!, colour);
    }
    return found;
  };
  const shipped = read(stylesCss);
  const mockup = read(MOCKUP_CSS);

  assert.ok(shipped.size >= 6, `only ${shipped.size} chip modifiers found in styles.css — the `
    + 'regex has stopped matching, so this test proves nothing');
  // **ONE-DIRECTIONAL SINCE THE OWNER'S RULING OF 2026-09-02.** This was a SET
  // EQUALITY — a modifier in either file and not the other failed — plus a
  // per-name colour equality. Both made the app's chip vocabulary and its
  // palette hostages of a file that may no longer be edited.
  //
  // LOST: a NEW `.chip.something` in the app is no longer news, and a chip that
  // changes which hue it spends is no longer news either. The design of record
  // and the app may draw the same chip in different colours, silently.
  //
  // KEPT, and it is both halves that ever caught anything: the budget (a chip
  // may still only spend one of the five ruled hues or the neutral — a sixth
  // needs an owner ruling and an edit to BUDGET above), and the mockup as a
  // FLOOR (a modifier the design of record declares may not simply vanish from
  // styles.css — that direction is `.chip.index`'s own lesson, seven invisible
  // chips drawn by a rule that existed in only one file).
  for (const [name, colour] of shipped) {
    assert.ok(allowed.has(colour),
      `.chip.${name} spends --${colour}, which is neither one of the five budgeted meaning hues `
      + `nor the neutral --${NEUTRAL}. Five is the budget; a sixth needs an owner ruling.`);
  }
  assert.deepEqual([...mockup.keys()].filter((name) => !shipped.has(name)).sort(), [],
    'the design of record declares these chip modifiers and styles.css no longer does. The app '
    + 'may ADD a chip (the mockup is a frozen reference since 2026-09-02); it may not silently '
    + 'stop styling one the design draws.');
});

/**
 * Every primitive rule §3 names, plus §4's plate — the same ten selectors
 * `test/ui/primitives.test.ts` enumerates for the mockup alone. `.row`'s
 * `:hover`, its reduced-motion transition and its `[aria-pressed="true"]`
 * look are checked as their own entries: each is a rule the primitive
 * genuinely owns (row.ts style header, mockup ~256-278), not screen wiring.
 */
const PRIMITIVE_SELECTORS = [
  '.pane,.rail,.hdr',
  '.scene',
  '.pair',
  '.plane.l',
  '.plane.r',
  '.row',
  '.row:hover',
  '.row[aria-pressed="true"]',
  '.plate',
  '.lit',
  '.blk',
  '.chip',
];

/**
 * **THE FLOOR, and it replaces byte identity — owner's ruling, 2026-09-02.**
 *
 * Every selector in the two lists is one the design of record declares. What
 * is asserted is that `styles.css` declares it too, with a non-empty body.
 * What is no longer asserted is that the two bodies are the same bytes.
 *
 * Lost: every declared VALUE. A colour, a radius, a spacing step, a border, a
 * `grid-template-areas` re-cut — the app may move any of them away from the
 * design of record and nothing here will report it.
 *
 * Kept: the rule EXISTING. Read the entries in `SCREEN_SELECTORS` — every
 * anecdote written into that list is a rule that was ABSENT from one file
 * (`.chip.index`, `#pane`, `svg.chart`, `.gloss`, `.md h4`, `.prov`,
 * `.strip`), never a rule whose bytes had drifted. An absent rule has no
 * visible symptom in review — a black slab, a UA-chrome button, a chip at
 * 1.0:1 contrast — and that is the half worth keeping.
 */
function assertDeclared(selector: string): void {
  // `ruleAt` asserts the rule is FOUND, line-anchored, which is the coverage
  // this replaced byte identity with.
  const shipped = ruleAt(stylesCss, selector, 'styles.css');
  // An EMPTY body is a rule that styles nothing — except where the design of
  // record declares it empty on purpose, which four of the primitives are:
  // `.scene{}` is the documented "not here" marker for perspective, and
  // `.pair`/`.plane.l`/`.plane.r` were emptied together when the owner ruled
  // the scene flat on 2026-08-22 (`test/ui/primitives.test.ts` holds that
  // shape against the mockup, and `.scene` must stay empty rather than vanish).
  // So the mockup's own body decides whether empty is allowed — the reference
  // reading of "colours and styles" the owner kept it for, not a byte match.
  const emptyIsIntended = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{\\}`, 'm').test(MOCKUP_CSS);
  if (emptyIsIntended) return;
  assert.ok(shipped.length > `${selector}{}`.length,
    `styles.css declares ${selector} with an empty body, and the design of record declares it `
    + 'with a real one — a rule that styles nothing is the same as no rule at all');
}

/**
 * Whether the design of record pins this selector too — reported in the
 * failure message, never asserted.
 *
 * **This is the half that had to stop being an assertion.** These lists carry
 * this file's standing brief, "extend that test with every block you add", and
 * under the old rule every block added to `styles.css` went into the mockup
 * first. The app is free to add rules the mockup lacks now (owner, 2026-09-02),
 * so requiring a mockup counterpart here would put the block back: the first
 * dialog rule listed below would fail against a file that may not be edited.
 */
function mockupPins(selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\{`, 'm').test(MOCKUP_CSS);
}

for (const selector of PRIMITIVE_SELECTORS) {
  test(`primitive rule ${selector} is declared in styles.css (the mockup is a floor, not a mirror — owner's ruling, 2026-09-02)`, () => {
    assert.ok(mockupPins(selector),
      `${selector} is listed as a PRIMITIVE the design of record pins, and the mockup no longer `
      + 'declares it — an app-only rule belongs in SCREEN_SELECTORS, not here');
    assertDeclared(selector);
  });
}

test('the row still has a reduced-motion transition block of its own (bytes no longer pinned to the mockup — owner\'s ruling, 2026-09-02)', () => {
  // Was byte-identical to the mockup's copy. Now: the guard must still EXIST
  // in styles.css, because `primitives.test.ts` proves the same shape about the
  // mockup and the point of the rule is that the unconditional `.row` stays
  // static. The transition's own duration and easing are free to move.
  const shipped = /@media \(prefers-reduced-motion:no-preference\)\{\s*\.row\{[^}]*transition:[^}]*\}\s*\}/.exec(stylesCss)?.[0];
  assert.ok(shipped !== undefined,
    'styles.css: .row\'s transition must live inside a prefers-reduced-motion:no-preference block');
  assert.doesNotMatch(ruleAt(stylesCss, '.row', 'styles.css'), /transition:/,
    'the unconditional .row rule must stay static — a transition there defeats the guard above');
});

/**
 * **This task's own carry-across.** Every screen-level selector `index.html`,
 * `app.js`, `screens/parts.js`, `screens/preview.js`, `screens/simulate.js`
 * and `screens/injected.js` actually render, minus the two that need
 * `ruleAtNth` instead (`.pair`, `.chip` — their own tests below) and the two
 * `@media` blocks (also below, since `ruleAt`'s single-selector regex cannot
 * span a wrapping `@media{}`). Reversing Task 16's own prior test — see the
 * comment where that test used to be, further down — is not a mistake: that
 * test encoded "the shell doesn't carry screen wiring" while no screen
 * existed yet to need it; this task IS that screen's wiring landing.
 */
const SCREEN_SELECTORS = [
  '.app', '.app.pane-open', '.hdr', '.logo', '.mark', '.mark::after',
  '.logo b', '.topr', '.sel', '.sel b', '.live', '.icon',
  '.icon:hover,.sel:hover', '.icon[aria-pressed="true"]', '.rail',
  '.grp', '.grp>p', '.nav', '.nav:hover', '.nav[aria-current="page"]',
  '.body', '.banner', '.banner[hidden]',
  '.phd', '.verdict', '.psub',
  '.card', '.card>h3', '.plane>.pane', '.rows', '.row .idfull', '.carrieditem',
  'table', 'caption', 'th', 'td', 'tr:last-child td',
  '.chip.gov', '.chip.ok', '.chip.warn', '.chip.crit', '.chip.carry',
  '.chip.gov::before', '.chip.ok::before', '.chip.warn::before', '.chip.crit::before', '.chip.carry::before',
  '.chip::before', '.small',
  'details.help', 'details.help>summary', 'details.help>summary::-webkit-details-marker',
  'details.help>summary::before', 'details.help[open]>summary', '.helpbox', '.helpbox b',
  '.segbar', '.segbar button', '.segbar button[aria-pressed="true"]',
  '.simctl', '.simctl input[type=range]',
  '.lit.linked .blk', '.lit.linked .blk.sel',
  // Widened from `.blk .linkid,.carrieditem .linkid` on 2026-08-22, in the
  // mockup and here together. `.linkid` is a bare `<button>` that relies on
  // this rule for its whole appearance, and it is built OUTSIDE those two
  // containers on four screens — inside a `<td>` on `injected`, in the
  // coverage detail pane, on `doctor` and on `learn`. Scoped to the two, those
  // instances fell back to the UA button chrome: 22 white rectangles on
  // coverage and 12 on injected, measured. The mockup carried the same gap and
  // was fixed in the same commit, so these stay byte-identical.
  '.linkid', '.linkid:hover',
  // **The title-bar popovers, added 2026-09-02 with the dialogs they style** —
  // `#sesspop` and `#focuspop`, and this file's standing brief ("extend that
  // test with every block you add").
  //
  // Nine selectors, and every one of them is the item pane's lesson repeating:
  // `.gloss` and `.gloss.float` are named by this stylesheet's own R5 comment
  // as still-used card material, the tokens they spend were carried across on
  // day one, and the RULES were never carried at all — invisible in both
  // directions for exactly as long as no element in the app wore the class.
  // The same held for `.aside`. A parity list measures what it names.
  '.gloss', '.gloss.float', '.aside',
  '.pop', '.pop[hidden]', '.pop h3', '.pop .row', '.pop .row:hover',
  '.pop .row[aria-selected="true"]', '.pop hr',
  // **The item detail pane, added 2026-08-23 with the element it styles.**
  //
  // These were absent for a reason worth recording, because it is how a
  // designed, debugged and repainted feature shipped with every gate green:
  // the app had no `#pane`, so there was nothing for a parity assertion to
  // measure and no assertion was written. `plan:repaint seq:9c` rescoped this
  // whole block from `.pane` to `#pane` after `.card.pane` collided with it —
  // real work, done on the MOCKUP, on an element the app did not have. The two
  // pane selectors that WERE listed (`.pane,.rail,.hdr` above and
  // `.plane>.pane` below) both pass, because the app uses them elsewhere.
  //
  // The lesson generalises past this rule: parity measures what the app
  // renders against what the mockup declares, so a whole element the app never
  // built is invisible to it in both directions.
  '#pane', '#pane[hidden]', '#pane h3', '#pane dl', '#pane dt', '#panetitle',
  // **The item summary, added 2026-09-01 with the block it styles** — this
  // file's standing brief, "extend that test with every block you add", and
  // the reason the block was written into the mockup first rather than into
  // the stylesheet alone. `plan:walk seq:119` phase 3: the summary is the
  // field that lets a reader understand an item without reading its body, and
  // `.itemsum.stale` / `.rowsum.stale` are the disclosure that stops a summary
  // the item has outgrown from being read as a current one.
  '.itemsum', '.itemsum.stale', '.summstale',
  '.itemprops', '.itemprops[hidden]', '.row.hassum', '.rowsum', '.rowsum.stale',
  // The audit stream's own seven (ui3 Task 11, mockup ~907-923). Added with
  // the carry, per this file's own standing brief — "Extend that test with
  // every block you add" — so the pulse, the token bar, the not-recorded void
  // and the regime rule cannot drift from the design of record either way.
  '.pulse', '.pulse svg', '.tokbar', '.tokvoid', '.nt',
  'tr.regime td', 'tr.regime .ln', 'tr.regime .rw',
  // The injection preview's two graphics (ui3 Task 1s, mockup ~813-851 and
  // ~927-936) — the four-tier budget ribbon with its ghost lane, and the gate
  // ladder. Added with the carry, per this file's own standing brief.
  // `.track .seg`'s reduced-motion transition needs its own regex test below,
  // for the same reason `.row`'s and `.lit.linked .blk`'s do: `ruleAt`'s
  // single-selector regex cannot span a wrapping `@media{}`.
  '.ribbon', '.rlabel', '.rlabel .n', '.track', '.track .seg',
  '.seg.pinned', '.seg.jit', '.seg.restored', '.seg.index', '.seg.head',
  '.ghosts', '.ghosts .gh', '.ghosts .gap', '.notrun', '.hint', '.hint b',
  '.gladder', '.rung', '.rung:last-child', '.rung .n', '.rung.pass .n',
  '.rung.binds', '.rung.binds .n', '.rung.after', '.rung .q',
  // The four families carried on 2026-08-23 for the six screens dispatched
  // in wave 1 (mockup ~650-655, ~951-958, ~1006-1007). Carried BEFORE the
  // screens that consume them, so six agents building six modules at once
  // never touch styles.css — measured first: `ask`, `config` and `tut` need
  // nothing new here at all. Added with the carry, per this file's standing
  // brief: "Extend that test with every block you add."
  '.md', '.md h1,.md h2,.md h3', '.md p', '.md ul', '.md pre',
  // The nine `.md` rules the widened renderer needs, added 2026-08-28 with the
  // branches that emit them (`plan:walk seq:37`, under DEC-markdown-is-served-
  // from-a-manifest-rendered-by-one-renderer). Added with the carry, per this
  // file's standing brief: "Extend that test with every block you add."
  //
  // `.md h4` is the odd one and worth the sentence: `###` has produced an `h4`
  // since the renderer existed, `.md h1,.md h2,.md h3` styles an `h1` this
  // renderer cannot emit, and nothing styled the tag it actually produces.
  // `screens/docs.js` had already reported that in prose; this is it closed.
  '.md h4', '.md ol', '.md li', '.md em', '.md blockquote',
  '.md blockquote :last-child', '.md hr', '.md table', '.md th,.md td',
  '.globtree', '.globtree div', '.globtree div.hit', '.globin',
  'td.stale', '[dir="rtl"] td.stale',
  // Carried at the merge, after the first carry's measurement proved partial:
  // it read `class=` attributes out of the mockup's static markup, so it could
  // see neither a BARE ELEMENT rule nor a class a script emits. Both were
  // missed. `work.js` builds `<ins>`/`<del>` for its diff and `docs.js` emits
  // `span.refusal` for a markdown construct its renderer refuses to perform —
  // found by re-measuring over what the six modules CONSTRUCT rather than over
  // what the design of record draws.
  '.refusal', 'ins', 'del',
  // **Configure's ten `.delta`/`.blast` rules, carried 2026-08-30 (plan:walk
  // seq:112).** Listed here with the carry, per this file's standing brief:
  // "Extend that test with every block you add."
  //
  // They were declined twice by styles.css's own note — "CSS for markup
  // nothing renders" — and the premise expired without the note expiring with
  // it: `screens/config.js` draws `div.blast` on all four composer panes and
  // `div.delta` on every value that moved, and `div.blast` left
  // `screen-parity`'s KNOWN_GAPS on 2026-08-29 because it is BUILT.
  //
  // The two families are one carry because they are one reading. The plate
  // says WHICH values moved and the panel says HOW MUCH of the corpus that
  // costs; unstyled, a panel reporting 66 items stopping is the same grey
  // paragraph as one reporting none. Held byte-identical in both directions
  // so neither the border colours nor `.was`'s strike-through can drift from
  // the design of record — and driven, computed rather than by class name, in
  // `e2e/config-blast-face.spec.ts`, because this file greps a stylesheet and
  // a stylesheet that reads correctly is exactly what 110 grey chart marks
  // looked like for six days.
  '.delta', '.delta .was', '.delta .will', '.delta .arrow',
  '.delta.gain', '.delta.loss',
  '.blast', '.blast.warn', '.blast.crit', '.blast b',
  // **Configure's paste hand-off, carried 2026-09-01 (`plan:config seq:4`),
  // and it went into the mockup FIRST.** The task's own words are *"as numbered
  // steps rather than prose"*: the four steps happen in an order — open the
  // file, put the block HERE, paste it, run this to confirm — and prose loses
  // the order the moment a reader is halfway through it. Two rules, and both
  // are logical rather than physical: `padding-inline-start` puts the markers
  // on the correct side in Hebrew, which `padding-left` would not.
  '.steps', '.steps li',
  // Wave-2 pre-work, 2026-08-23: the graphics the eight gap screens draw,
  // carried ahead of them because these screens already exist and open — an
  // agent building a heat map has to be able to look at one. Derived from
  // screen-parity's KNOWN_GAPS, which names the element kinds each screen must
  // gain, rather than from the mockup's class= attributes; that scan was wrong
  // three times in one day. `.simctl` and its range input are deliberately NOT
  // re-listed: they were already carried for the built simulate screen, and
  // re-carrying them duplicated the rule — which `ruleAt` would not have caught,
  // because it takes the first match.
  '.sim', '.ladder', '.ladder>div', '.ladder>div.at', '.ladder>div.ev',
  '.readout', '.readout b',
  '.div-row', '.div-l,.div-r', '.div-l', '.div-l i', '.div-r i',
  '.div-name,.div-n', '.div-n',
  // `.div-name` gained a rule of its own on 2026-08-29 (`plan:walk seq:47`):
  // the shared rule's `nowrap`/`ellipsis` moved down onto `.div-n`, which is a
  // `12/22` tally and does want one line, and the NAME now wraps instead —
  // measured clipping 10 of 10 real ids at the old 168px track, and 6 of 6 of
  // the design's own fixtures. Listed here with the change, per this file's
  // standing brief: "Extend that test with every block you add."
  '.div-name',
  '.heat', '.hstrip', '.hstrip i', '.hstrip i.h1', '.hstrip i.h2',
  '.hstrip i.h3', '.hstrip i.sp', '.hname', '.heataxis',
  '.mini', '.mini i.g', '.mini i.u', '.mini i.x',
  '.legend', '.legend i', '.legend .ln', '.legend i.warm', '.legend i.cold',
  '.legend i.never', '.legend i.badpin', '.legend i.focusn', '.legend i.missn',
  '.legend i.supn', '.legend .ln.bearing', '.legend .ln.ref', '.legend .ln.dang',
  // **The SVG chart, which this stylesheet had no rules for at all.** Measured
  // in a browser on 2026-08-23: with only styles.css loaded, `path` resolved to
  // `fill:rgb(0,0,0); stroke:none` and `rect` to `fill:rgb(0,0,0)` — every node
  // a black slab and every edge a black filled blob, on graph, watch, decay and
  // simulate alike. The only mention of `svg.chart` in the file was a comment.
  //
  // Two earlier carries missed it for a STRUCTURAL reason worth keeping:
  // `screen-parity`'s COLLECT_KINDS reads `el.className`, which on an SVG
  // element is an SVGAnimatedString rather than a string, so every SVG element
  // is recorded as a bare tag with no classes. A carry derived from that ledger
  // cannot see an SVG class. The same blindness means the gate cannot tell
  // `<path class="edge dangling">` from `<path>` — filed separately.
  'svg.chart', 'svg.chart text', 'svg.chart text.mono', 'svg.chart .axis',
  'svg.chart .step', 'svg.chart .nowline', 'svg.chart .defline', 'svg.chart .never',
  'svg.chart .node', 'svg.chart .node.focus', 'svg.chart .node.missing',
  'svg.chart .node.superseded', 'svg.chart .node.more',
  'svg.chart .edge', 'svg.chart .edge.bearing', 'svg.chart .edge.ref',
  'svg.chart .edge.dangling', 'svg.chart text.nid', 'svg.chart text.rel',
  // The per-mark colour classes, added 2026-08-29 (plan:walk seq:78). Until
  // they existed the screens wrote `fill="var(--warn)"` as a presentation
  // attribute and `svg.chart text{fill:var(--dim)}` — an author rule — beat
  // every one of them: 112 marks asked for a colour and 112 rendered grey.
  'svg.chart text.ink', 'svg.chart text.gold', 'svg.chart text.warn',
  'svg.chart text.crit', 'svg.chart text.nid.more',
  // **The provenance bar and the status strip, added 2026-08-29 with the
  // strip's four provenance groups (plan:walk seq:29b).** Both bars were
  // carried from the mockup byte-for-byte when `renderChrome()` landed and
  // NEITHER was ever held here — invisible to this file in both directions
  // for the same structural reason `#pane` was, and the reason the strip's
  // own task could claim that changing only the app "would make styles-parity
  // fail" when in fact nothing would have noticed. It would now.
  '.prov', '.prov b', '.provparts,.provproj', '.prov [hidden]',
  // Added 2026-08-31 with `plan:walk seq:114`, which moved the repo provenance
  // group out of the strip and into the header. `.gitstate` shows one of seven
  // states and hides six, and `.chip` sets `display` — so the group needed the
  // same `[hidden]` dodge in its new container that `.strip [hidden]` gives it
  // in its old one. Listed here with the rule, per this file's standing brief.
  '.hdr [hidden]',
  '.strip', '.strip .sep', '.strip [hidden]',
  '.gitstate,.ctxstate,.corpusstate,.auditstate', '.ctxstate', '.ctxstate>span',
  // **`.strip>*` BECAME `.striprow>*` on 2026-09-01, and the entry MOVED rather
  // than being dropped.** The strip is two rows now — identity above, state
  // below, the terminal bar's own split — so `.strip` is a grid of two STATED
  // heights and the flex rule belongs on the rows inside it. A `flex:` property
  // left on the children of a grid is inert, which is exactly the kind of rule
  // that goes on passing while doing nothing.
  '.striprow', '.striprow>*', '.striprow>.sgrp',
  // The provenance grouping itself: a colour per source AND a label word.
  '.sgrp', '.slab', '.sgrp-repo .slab', '.sgrp-corpus .slab',
  '.sgrp-session .slab', '.sgrp-audit .slab', '.sgrp-session',
  // The three groups line 1 and line 2 gained with the two-row strip
  // (2026-09-01). No new hue: `--carry` and `--dim` are already spent here.
  '.sgrp-model .slab', '.sgrp-window .slab', '.sgrp-cost .slab', '.sgrp-limits .slab',
  '.sgrp-window', '.modelstate,.windowstate,.coststate,.limitstate', '.windowstate',
  '.striprow .chip',
  // **The emphasised context figure and the two banded rate windows.** The
  // owner's 2026-09-01 ruling put the band on the FIGURE — it had been on a
  // chip beside it while the number stayed grey — and asked for a background
  // and a heavier face. Listed here with the rules, per this file's standing
  // brief, and worth the entry: the box metrics and the colours are two rules
  // ON PURPOSE, so that a band change can never resize the row, and a carry
  // that merged them would silently reintroduce the jitter.
  '.ctxstate>.ctxfig', '.ctxfig.ok', '.ctxfig.warn', '.ctxfig.crit', '.ctxfig.unmeas',
  '.rlfig.ok', '.rlfig.warn', '.rlfig.crit', '.rlfig.unmeas',
  '.reponame', '.auditlog',
  // Added 2026-08-31 with the corpus group's drift chip (`plan:walk seq:4`
  // drawn at last): a group that used to be a count and a noun now carries a
  // sentence, so it needs a shrink factor, a floor, and a clipping box for
  // the chip — measured at 900px, where without them the strip spilled 21px
  // and the context group was squeezed to zero.
  '.sgrp-corpus', '.corpusstate', '.corpusdrift', '.corpusdrift .chip', '.ctxstate>.chip',
  '.strip .m', '.chip.unmeas', '.chip.unmeas::before',
  // **`.chip.index`, the second neutral — added 2026-08-31 with the rule, per
  // this file's standing brief ("Extend that test with every block you add").**
  //
  // It is worth the sentence because it is the exact hole this file exists to
  // close, and it sat open for eight days. `styles.css` carried the rule as a
  // PROPOSAL, the mockup carried none, and `.chip.index` was in neither this
  // list nor any other — so the app rendered a legible neutral chip, the design
  // of record rendered SEVEN invisible ones (`rgb(11,12,17)` on `rgb(11,12,17)`,
  // contrast 1.0, two on `preview` and five on `ask`), and every gate was green
  // in both directions. A rule that exists in one file and not the other is
  // invisible here unless its selector is named, which is what `plan:walk
  // seq:15` says about the cascade and what this entry says about a whole rule.
  '.chip.index',
  '.idkind', '.idslug', 'h2', 'button',
  ':where(button,a,input,select,summary):focus-visible',
  '[dir="rtl"] .icon-open', '[class^="icon-"]',
];

for (const selector of SCREEN_SELECTORS) {
  test(`screen-level rule ${selector} is declared in styles.css (the mockup is a floor, not a mirror — owner's ruling, 2026-09-02)`, () => {
    // `mockupPins()` is READ and not asserted — see its own comment. A rule the
    // design of record pins may not vanish from styles.css; a rule the app
    // added on its own is welcome here and needs no counterpart.
    assertDeclared(selector);
  });
}

test('the SECOND .pair rule (the two-plane scene\'s own grid, not the perspective primitive) is still declared', () => {
  // Was byte-identical to the mockup's. Kept as a presence check because the
  // two `.pair` declarations do different jobs and a merge would silently drop
  // one of them — `ruleAt` takes the FIRST match, so the loop above cannot see
  // the second at all.
  assert.ok(ruleAtNth(stylesCss, '.pair', 1, 'styles.css').length > '.pair{}'.length,
    'styles.css must still declare the scene grid as its own rule');
});

test('the SECOND .chip rule (border/size/line-height, not the font-weight primitive) is still declared', () => {
  assert.ok(ruleAtNth(stylesCss, '.chip', 1, 'styles.css').length > '.chip{}'.length,
    'styles.css must still declare the chip\'s box as its own rule — see the .pair note above');
});

test('the .pair still collapses to one column under a width media query', () => {
  // Was byte-identical to the mockup's copy, breakpoint included. The
  // breakpoint is now the app's to choose; that it COLLAPSES is the invariant —
  // two planes side by side on a narrow window is the horizontal scroll
  // `e2e/app-layout.spec.ts` forbids.
  assert.match(stylesCss, /@media \(max-width:\d+px\)\{\.pair\{grid-template-columns:1fr\}\}/,
    'styles.css: .pair must still collapse to a single column at some max-width');
});

test('the .lit.linked .blk transition still lives under the reduced-motion guard', () => {
  // Was byte-identical to the mockup's copy, `var(--dur-act)` and `var(--ease)`
  // included. What survives is the GUARD: an unconditional transition here
  // animates for a reader who asked for no motion.
  assert.match(stylesCss, /@media \(prefers-reduced-motion:no-preference\)\{\s*\n\s*\.lit\.linked \.blk\{transition:[^}]*\}\s*\n\}/,
    'styles.css: .lit.linked .blk\'s transition must sit inside a prefers-reduced-motion guard');
});

/**
 * **The ribbon's retiming block** (spec §5) — a segment travels to its new
 * width rather than redrawing, because on this chart the movement is the data.
 * Held byte-identical for the same reason the two blocks above it are, and
 * carried even though it is inert today: both files rebuild every `.seg` on
 * each event change, so no node survives a re-render to animate from. Each
 * file records that against its own copy; what must not happen is one of them
 * fixing it and the declaration drifting.
 */
test('the .track .seg retiming still lives under the reduced-motion guard', () => {
  // Byte identity with the mockup's copy dropped by the owner's ruling of
  // 2026-09-02; the guard is what is kept, for the reason above it.
  assert.match(stylesCss, /@media \(prefers-reduced-motion:no-preference\)\{\s*\n\s*\.track \.seg\{transition:[^}]*\}\s*\n\}/,
    'styles.css: .track .seg\'s retiming must sit inside a prefers-reduced-motion guard');
});

/**
 * **DELETED 2026-09-02 (owner's ruling): `the parity checks above are not
 * vacuous — every extracted block is non-empty`.**
 *
 * Its whole subject was the byte comparisons: a regex that silently matched
 * `""` would have made every `assert.equal(shipped, mockup)` above pass by
 * comparing two empty strings, so one test swept all of them and asserted the
 * extractions were real. There are no byte comparisons left, and the risk it
 * named cannot happen to a check that never compares two things.
 *
 * Nothing is uncovered by its going: `assertDeclared()` now carries the
 * non-empty assertion PER SELECTOR (a stronger placement — it names the
 * offending rule instead of a sweep), the two `ruleAtNth` tests carry their
 * own, and the token-coverage tests assert the mockup's `:root` blocks yield
 * tokens before comparing anything. Deleted rather than left standing, because
 * a test whose name promises to guard a comparison that no longer exists is a
 * claim nobody can check.
 */

/**
 * **Reversed from Task 16's own test.** `.lit.linked` and `.linkid` used to
 * be asserted ABSENT here — correct while no screen existed to compose them,
 * named explicitly in styles.css's own (now-updated) header as "a screen's
 * job to bring in, not a shell's". `screens/preview.js` and `screens/
 * parts.js` are that screen (Task 17), and `SCREEN_SELECTORS` above now
 * carries `.lit.linked .blk`/`.lit.linked .blk.sel`/`.blk .linkid,
 * .carrieditem .linkid`/`.blk .linkid:hover,.carrieditem .linkid:hover` with
 * their own byte-parity assertions — a positive check is strictly stronger
 * than the absence check it replaces, so nothing is lost by removing it.
 */

/**
 * `styles.css`'s own `@font-face` `url()` paths resolve relative to
 * `styles.css` ITSELF (served at `/styles.css`), not to the mockup's
 * location — the one deliberate divergence from byte parity, explained in
 * styles.css's own comment on the block. Same method
 * `test/ui/fonts.test.ts` uses for the mockup's copy, pointed at this file
 * instead.
 */
test('every @font-face src in styles.css resolves to a real file, relative to styles.css itself', () => {
  const rules = [...stylesCss.matchAll(
    /@font-face\{font-family:"([^"]+)";font-weight:(\d+);[^}]*url\("([^"]+)"\)/g,
  )];
  assert.ok(rules.length >= 9, `expected at least 9 @font-face rules, found ${rules.length}`);
  const missing: string[] = [];
  for (const [, family, weight, url] of rules) {
    const resolved = path.resolve(path.dirname(STYLES), url!);
    if (!existsSync(resolved)) missing.push(`${family} ${weight} -> ${url} (resolved: ${resolved})`);
  }
  assert.deepEqual(missing, [], 'declared in styles.css but not on disk relative to it');
});

test('the nine vendored weights styles.css declares match what static.ts can now serve', () => {
  const expected = [
    'geist-400.woff2', 'geist-450.woff2', 'geist-500.woff2', 'geist-600.woff2',
    'geist-mono-400.woff2', 'geist-mono-500.woff2',
    'plex-sans-hebrew-400.woff2', 'plex-sans-hebrew-500.woff2', 'plex-sans-hebrew-600.woff2',
  ];
  const missing = expected.filter((f) => !existsSync(path.join(FONTS, f)));
  assert.deepEqual(missing, [], 'missing from src/ui/public/fonts');
  for (const f of expected) {
    assert.match(stylesCss, new RegExp(`url\\("fonts/${f.replace('.', '\\.')}"\\)`), `styles.css never references fonts/${f}`);
  }
});

/**
 * **`index.html`'s icon sprite, held to the same discipline as styles.css —
 * copied byte-for-byte from the mockup, not invented, and pinned here so it
 * cannot drift.** Not a CSS block, so it lives outside every check above,
 * but it is the same kind of carry-across this whole file exists to hold:
 * `screens/parts.js`'s `openIcon()` (Task 17) has always emitted `<svg
 * class="icon-open"><use href="#i-open">`, and until this sprite existed in
 * `index.html` that `<use>` pointed at nothing — an empty 16×16 box, visually
 * indistinguishable from "loaded correctly but blank". Found by inspecting a
 * real screenshot, not by reading the CSS.
 *
 * **The six `<symbol>` ids are checked present; their bodies are NOT compared
 * (owner's ruling, 2026-09-02 — see this file's header). The wrapping `<svg>`
 * tag was never compared either**, for the same reason `styles.css`'s own `@font-face`
 * `url()` paths aren't: the mockup's tag carries `style="display:none"`,
 * which the server's CSP refused outright when it read `style-src 'self'` —
 * index.html's own comment on the sprite and styles.css's `body>svg[aria-
 * hidden="true"]{display:none}` explain the substitute. Checked from
 * `aria-hidden="true">` onward (present in both, unlike the differing tag
 * before it) through the six symbols to `</svg>`.
 */
test('index.html defines every icon symbol the mockup does (the path data is no longer compared — owner\'s ruling, 2026-09-02)', () => {
  const start = 'aria-hidden="true">';
  const end = '</svg>';
  function spriteFrom(html: string, label: string): string {
    // From the FIRST `<svg` (the sprite, always earlier in the document than
    // any screen-rendered icon) rather than the bare marker, so a future
    // `.icon-open` instance elsewhere in the static markup could never be
    // mistaken for the sprite itself.
    const svgTag = html.indexOf('<svg');
    assert.ok(svgTag !== -1, `${label}: no <svg> found at all`);
    const s = html.indexOf(start, svgTag);
    assert.ok(s !== -1, `${label}: sprite's aria-hidden="true"> not found`);
    const e = html.indexOf(end, s);
    assert.ok(e !== -1, `${label}: sprite close tag not found after its start`);
    return html.slice(s + start.length, e);
  }
  const mockup = spriteFrom(mockupHtml, 'mockup');
  const shipped = spriteFrom(indexHtml, 'index.html');
  // **ONE-DIRECTIONAL SINCE THE OWNER'S RULING OF 2026-09-02.** This asserted
  // `assert.equal(shipped, mockup)` over the whole six-symbol slice.
  //
  // LOST: the PATH DATA. A glyph redrawn in `index.html` — a different `d`, a
  // different stroke width, a different viewBox — no longer has to be redrawn
  // in the design of record, and nothing reports the divergence.
  //
  // KEPT: the link. Every symbol the design of record defines must still be
  // defined in `index.html`, and the six §6 glyphs by name — which is the whole
  // of what this test was written for. `screens/parts.js`'s `openIcon()` emits
  // `<use href="#i-open">`, and a `<use>` pointing at a symbol nobody defined
  // renders an empty 16x16 box, indistinguishable from "loaded and blank".
  const defined = (svg: string): Set<string> =>
    new Set([...svg.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1]!));
  const inMockup = defined(mockup);
  assert.ok(inMockup.size >= 6, `the mockup's sprite defines ${inMockup.size} symbol(s) — the extraction is broken`);
  const inShipped = defined(shipped);
  assert.deepEqual([...inMockup].filter((id) => !inShipped.has(id)).sort(), [],
    'the design of record defines these symbols and index.html no longer does — every <use> '
    + 'reaching for one renders an empty box. index.html may define MORE (the mockup is a frozen '
    + 'reference since 2026-09-02); it may not define fewer.');
  assert.ok(shipped.length > 500, 'the sprite is suspiciously short — six symbols expected');
  for (const id of ['i-refresh', 'i-copy', 'i-open', 'i-confirm', 'i-search', 'i-add']) {
    assert.match(shipped, new RegExp(`id="${id}"`), `sprite is missing #${id}`);
  }
});

/**
 * **This assertion outlived its original reason, and is kept on a new one.**
 *
 * It was written because `style-src 'self'` refused the attribute outright.
 * The CSP now reads `style-src-attr 'unsafe-inline'` — a computed length has
 * to be applicable for any chart to draw a bar — so the platform would today
 * accept `style="display:none"` here without complaint.
 *
 * The rule it now enforces is ours rather than the browser’s: a STATIC
 * declaration belongs in the stylesheet, where this suite can hold it
 * byte-identical to the design of record. `style-src-attr` was re-opened for
 * values computed at runtime that cannot be written down in advance; spending
 * it on a constant would put one of the sprite’s declarations somewhere this
 * suite does not compare, which is how the two files drift.
 */
test('index.html\'s sprite <svg> carries no inline style attribute (CSP: style-src \'self\', no unsafe-inline)', () => {
  // Anchored on 'aria-hidden="true">' (present in both files, unlike the
  // wrapping tag) and walked BACKWARDS to the nearest preceding `<svg` —
  // never a forward search from `indexHtml.indexOf('<svg')`, which lands on
  // the literal text `<svg class="icon-<name>">` inside this file's own
  // prose comment describing how a screen consumes a glyph, not the real tag.
  const ariaIdx = indexHtml.indexOf('aria-hidden="true">');
  assert.ok(ariaIdx !== -1, 'sprite aria-hidden="true"> not found');
  const tagStart = indexHtml.lastIndexOf('<svg', ariaIdx);
  assert.ok(tagStart !== -1, 'no <svg start tag precedes aria-hidden="true">');
  const svgTag = indexHtml.slice(tagStart, ariaIdx + 'aria-hidden="true">'.length);
  assert.doesNotMatch(svgTag, /style=/, `the sprite's own <svg> tag must not carry a style attribute: ${svgTag}`);
  assert.match(svgTag, /aria-hidden="true"/, 'the sprite must still announce aria-hidden="true"');
});

/**
 * **`index.html`'s `.app` wrapper — the grid `.app{grid-template-areas:…}`
 * in styles.css has nothing to grid without an element carrying
 * `class="app"`.** Structural, not byte-identical (the mockup's own `.app`
 * also holds the provenance bar and footer strip this shell does not build —
 * §0.2, "unowned"), so this checks NESTING rather than reusing the sprite
 * test's exact-slice approach: `.hdr`, `.rail`, `.body` and the exit banner
 * must all be inside the one element carrying `id="app"`.
 */
test('index.html\'s header, rail, body and exit banner all sit inside #app', () => {
  const appStart = indexHtml.indexOf('<div class="app" id="app">');
  assert.ok(appStart !== -1, '#app wrapper not found');
  const bodyCloseTag = '</body>';
  const afterApp = indexHtml.indexOf(bodyCloseTag, appStart);
  assert.ok(afterApp !== -1, 'expected a </body> after #app opens');
  // The wrapper's own close is the last `</div>` before `<script type=
  // "module" src="/app.js">` — checked by position, not by counting nested
  // divs (the header alone has none, but a later task's markup might).
  const scriptTag = '<script type="module" src="/app.js">';
  const scriptIndex = indexHtml.indexOf(scriptTag, appStart);
  assert.ok(scriptIndex !== -1 && scriptIndex < afterApp, 'expected the app.js script tag inside <body>');
  const appRegion = indexHtml.slice(appStart, scriptIndex);
  for (const needle of [
    'id="topbar" class="hdr"',
    'class="rail" id="nav"',
    'class="body" id="screen"',
    'class="banner" id="exited"',
  ]) {
    assert.ok(appRegion.includes(needle), `#app wrapper does not contain ${JSON.stringify(needle)} before the app.js script tag`);
  }
});
