/**
 * **EVERY USER-FACING STRING LITERAL UNDER `screens/`, ENUMERATED — so that
 * "the UI is translated" stops being an assumption and becomes a measurement.**
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * `screens/preview.js` shipped two sentences as English literals with no string
 * key and no `ctx.t`:
 *
 *     label.append(el('span', null, 'does not run on this event'));
 *     el('div', 'hint', 'Absent, not empty — this event never reaches the tier at all.')
 *
 * In Hebrew both stayed English. The screen switched language around them and
 * they did not move — measured in a real browser with `document.dir === 'rtl'`.
 *
 * **No gate could see it, and both gates were sound.**
 * `test/ui/strings-parity.test.ts` compares KEY SETS between `en.js` and
 * `he.js`; a string with no key is invisible to it, because there is nothing to
 * be missing from the other table. `e2e/bidi.spec.ts` censuses `.m`/`.v` runs
 * per `data-t`; text under no `data-t` is not censused either. The defect sat
 * precisely in the gap between what the two of them measure.
 *
 * That is the same blind spot that made `plan:walk seq:7` decline to build
 * `#readout` — its words are literals under no `data-t`, and the agent
 * correctly refused to invent keys rather than shipping untranslated prose.
 * Here the literals had already shipped, and **nobody knew how many more there
 * were, because nothing counted them.**
 *
 * So this counts them. The two above are keyed now (`preview.notrun`,
 * `preview.notrunn`); what this file is for is the question they raised.
 *
 * ── WHAT IT MEASURES, AND WHERE THE LINE IS ───────────────────────────────
 *
 * A literal is USER-FACING when it reaches the DOM as text. In this codebase
 * text reaches the DOM through five vectors and no others, so those five are
 * what `collect()` walks:
 *
 *   `el(tag, cls, TEXT)`     the house element factory's third argument
 *   `.append(TEXT)`          a bare string among append/prepend arguments
 *   `.textContent = TEXT`    direct assignment
 *   `.title = TEXT`          a tooltip is read by a person
 *   `setAttribute(…, TEXT)`  for `aria-label`, `title` and `placeholder`
 *
 * **Parsed, not grepped.** A regex over the source cannot tell a sentence in
 * argument position from a class name, an id, a CSS property or a comment, and
 * every one of those is a string literal in these files. TypeScript's own parser
 * is already a devDependency (`CONST-zero-runtime-dependencies` permits it, and
 * this is a test), and it answers the question exactly: which syntactic position
 * is this literal in.
 *
 * **Concatenation is followed.** `'Headroom ' + n + ' tokens.'` is ONE sentence
 * assembled in pieces, and reading only its leaves would report three fragments
 * and hide the sentence — so `textOf` walks `+` chains and template expressions
 * and reconstructs the whole. This is not cosmetic: it is the difference between
 * the ribbon's index-tier hint being seen and being missed.
 *
 * **A literal is PROSE when it carries at least two words containing letters,
 * once substitutions are removed.** That line is drawn where it is because the
 * alternative — every literal — is 74 sites of which 62 are separators (`' '`,
 * `' — '`, `' · '`, `', '`), em-dashes standing for an absent value, and
 * pure-substitution templates like `` `${a}/${b}` ``. None of those is
 * translatable text, and a check that reported them would be a check nobody
 * could act on. Two words is deliberately GENEROUS: it admits
 * `'not reached — '`, `'regime change · '` and `'Copy failed'`, all of which are
 * real prose, and the ledger below then rules on each one by name rather than
 * letting a threshold rule silently.
 *
 * ── WHAT THIS FILE CANNOT DO, SAID SO A GREEN RUN IS NOT OVERREAD ─────────
 *
 * It cannot see a sentence composed somewhere else and passed in as a variable,
 * and it cannot judge whether a keyed string's Hebrew is any good — that is
 * `strings-parity`'s stated non-goal too. It measures literals at the five
 * places text enters the DOM, which is where the two sentences that prompted it
 * lived.
 *
 * **And it reads a conditional's BRANCHES as one hole rather than as two
 * strings.** `` `${a}${cond ? ` · to ${b}` : ''}` `` reports the outer sentence
 * and not the ` · to ` inside the ternary, because the branch is an expression
 * in a substitution and not a literal in argument position. That is a known
 * floor, stated rather than discovered: what it hides is short connective
 * fragments, and what it must never hide is a whole sentence — a sentence long
 * enough to matter does not fit inside a substitution slot without the outer
 * literal around it also being reported, which is how the ribbon's tier label
 * came to be in the ledger below.
 *
 * ── THE LEDGER, AND ITS ONE RULE ──────────────────────────────────────────
 *
 * `KNOWN_LITERALS` is the measured truth as of 2026-08-29, one entry per
 * literal, each with the reason it is there. Two kinds, and the distinction is
 * the whole point of keeping the list:
 *
 *   `vocabulary` — correctly a literal. Product vocabulary, an identifier, a
 *                  tier name. Keying these would translate a symbol.
 *   `unkeyed`    — a real defect: prose that stays English under `א`. Recorded
 *                  rather than asserted away, so that it can be found and fixed
 *                  and so that it cannot grow.
 *
 * **On the first run, `vocabulary` was empty, and that is the finding rather
 * than a flaw in the scheme.** Everything above the prose line turned out to be
 * genuine prose; the vocabulary cases — a tier name, an id, `<id> · <n> tokens`
 * — all fall BELOW it, which is the line doing its job rather than the ledger
 * excusing anything. The kind is kept because the next literal somebody adds may
 * legitimately be one, and a ledger with no way to say so would push a symbol
 * into the string tables.
 *
 * **The assertion is EQUALITY, in both directions**, which makes the ledger a
 * ratchet: a new literal fails because it is not in the list, and a literal that
 * gets keyed fails until it is REMOVED from the list. The second half is what
 * stops this becoming a graveyard of stale entries, and it is why the list may
 * only shrink.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');

/**
 * A substitution's stand-in inside a reconstructed sentence.
 *
 * It has to be a character that cannot occur in source text, because the prose
 * test counts WORDS and a stand-in that looked like one would make
 * `` `${a}/${b}` `` read as prose. U+0001 is not writable in these files.
 */
const HOLE = '\u0001';

interface Literal { readonly file: string; readonly where: string; readonly text: string }

/**
 * The text a node contributes, or `null` when it contributes none.
 *
 * Recursive through `+` and through parentheses for the reason in this file's
 * header: a sentence built in pieces is one sentence. A `+` whose operands are
 * both non-literal (`num(a) + num(b)`) answers `null` and is not reported; one
 * with a literal anywhere in it answers the whole reconstruction, with `HOLE`
 * standing where the runtime values go.
 */
function textOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((s) => HOLE + s.literal.text).join('');
  }
  if (ts.isParenthesizedExpression(node)) return textOf(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = textOf(node.left);
    const right = textOf(node.right);
    if (left === null && right === null) return null;
    return (left ?? HOLE) + (right ?? HOLE);
  }
  return null;
}

/** The attributes whose value a person reads. */
const READABLE_ATTRS = new Set(['aria-label', 'title', 'placeholder']);
/** The properties whose assignment puts text on screen. */
const READABLE_PROPS = new Set(['textContent', 'title', 'placeholder', 'ariaLabel']);

/** Every literal reaching the DOM in one screen module. */
function collect(file: string, source: string): Literal[] {
  const found: Literal[] = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);

  const take = (node: ts.Node, where: string): void => {
    const text = textOf(node);
    if (text !== null) found.push({ file, where, text });
  };

  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      // `el(tag, cls, TEXT)` — the house factory. Its first two arguments are a
      // tag name and a class list, which are not prose and are not read here.
      if (ts.isIdentifier(node.expression) && node.expression.text === 'el'
        && node.arguments.length >= 3) {
        take(node.arguments[2]!, 'el(,,text)');
      }
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        if (method === 'append' || method === 'prepend') {
          for (const argument of node.arguments) take(argument, `.${method}()`);
        }
        if (method === 'setAttribute' && node.arguments.length === 2) {
          const name = node.arguments[0]!;
          if (ts.isStringLiteral(name) && READABLE_ATTRS.has(name.text)) {
            take(node.arguments[1]!, `setAttribute(${name.text})`);
          }
        }
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && READABLE_PROPS.has(node.left.name.text)) {
      take(node.right, `.${node.left.name.text} =`);
    }
    ts.forEachChild(node, walk);
  };

  walk(tree);
  return found;
}

/**
 * Whether a literal is PROSE — two or more words carrying letters, with the
 * substitution holes removed first. See this file's header for where the line
 * is drawn and why it is drawn generously.
 */
function isProse(text: string): boolean {
  const bare = text.split(HOLE).join(' ').trim();
  if (bare === '') return false;
  return bare.split(/\s+/).filter((word) => /[A-Za-z\u0590-\u05FF]/.test(word)).length >= 2;
}

type Verdict = 'vocabulary' | 'unkeyed';

/**
 * **THE MEASURED TRUTH, 2026-08-29.** One entry per user-facing prose literal
 * under `screens/`, with the ruling on it. Keyed by file and exact text, never
 * by line number, which drifts on every edit above it.
 *
 * The two `preview.js` sentences this whole check was written for are ABSENT
 * from this list, because they are keyed now (`preview.notrun`,
 * `preview.notrunn`). That absence is the point: the ledger holds what is still
 * wrong, not what once was.
 */
const KNOWN_LITERALS: { file: string; text: string; verdict: Verdict; reason: string }[] = [
  // ── preview.js ────────────────────────────────────────────────────────
  {
    file: 'preview.js',
    text: ' — all five, or this previews a different question.',
    verdict: 'unkeyed',
    reason: 'The tail of the helpbox sentence whose head is `help.p1`. The five '
      + 'input names between them are `.m` literals (`SelectContext` field names) and '
      + 'are correctly untranslated; this clause is prose and is not. It stays English '
      + 'under Hebrew. Filed, not accepted.',
  },
  {
    file: 'preview.js',
    text: `path — none (${HOLE} takes none)`,
    verdict: 'unkeyed',
    reason: 'The path slot on the three events that take no path. The design of record '
      + 'writes it as one unkeyed literal and the app drew it with the event name '
      + 'substituted in. Prose around an identifier; stays English under Hebrew. Filed.',
  },
  {
    file: 'preview.js',
    text: `not reached — ${HOLE}`,
    verdict: 'unkeyed',
    reason: 'The ladder\'s below-the-break state. The substituted half is `GATES[i].q`, '
      + 'the design of record\'s own gate description, which is itself an unkeyed literal '
      + '— so keying this alone would translate two words and leave the sentence. Both '
      + 'halves belong in one fix, with the `GATES` table. Filed together.',
  },
  {
    file: 'preview.js',
    text: `${HOLE} / ${HOLE}${HOLE} · ${HOLE} in · ${HOLE} out`,
    verdict: 'unkeyed',
    reason: 'The ribbon tier label — used / budget, then how many went in and how many '
      + 'fell out. `in` and `out` are prose, not vocabulary: the design of record '
      + 'translates them itself (renderRibbons: HEB ? \' נכנסו · \' : \' in · \'), so the '
      + 'copy exists. Found only because this check follows `+` concatenation — the '
      + 'sentence is a template and a string added together, and reading either half '
      + 'alone would have missed it. Filed.',
  },
  // NOT listed, and deliberately: the admitted segment's tooltip
  // (`<id> · <n> tokens`) carries one letter-word — the unit — and falls below
  // the prose line. It is an id, a middot and a number, which is what the line
  // is drawn to exclude. Its GHOST counterpart is listed immediately below,
  // because `budget exceeded` puts it over.
  {
    file: 'preview.js',
    text: `${HOLE} · ${HOLE} tokens · budget exceeded`,
    verdict: 'unkeyed',
    reason: 'The ghost tooltip. Same shape as the one above plus a two-word verdict, '
      + 'which is prose. A tooltip is read by a person and is translatable — `data-t-title` '
      + 'exists in the design of record for exactly this. Filed.',
  },
  {
    file: 'preview.js',
    text: `Drawn to the simulator's range, ${HOLE}`,
    verdict: 'unkeyed',
    reason: 'The ribbon hint said when a reader has widened the simulator\'s range. An '
      + 'app-only sentence — the design of record has no range control and so no copy for '
      + 'it, which is why no key was written. Prose, stays English. Filed.',
  },
  {
    file: 'preview.js',
    text: ` — the budget in force is still ${HOLE}, and the track past it is range, not headroom. `,
    verdict: 'unkeyed',
    reason: 'The second half of the range hint above, and the same filing. Split across a '
      + '`<b>` and a text node in the source; one sentence to a reader.',
  },
  {
    file: 'preview.js',
    text: `Everything selected fit. Headroom ${HOLE} tokens.`,
    verdict: 'unkeyed',
    reason: 'The no-spill ribbon hint. The design of record DOES carry Hebrew for this one '
      + '(`renderRibbons`: הכול נכנס. עודף … אסימונים.), so the copy exists and the fix is '
      + 'cheap — it is out of this task\'s two-sentence bound, not out of reach. Filed.',
  },
  {
    file: 'preview.js',
    text: `Headroom ${HOLE}. ${HOLE} index lines did not fit; `
      + 'per-line index costs are exposed by no endpoint, so the ghost lane cannot size them.',
    verdict: 'unkeyed',
    reason: 'The index tier\'s hint, naming the one figure no endpoint serves. App-only '
      + 'prose with no mockup copy behind it. Filed.',
  },
  // The spill hint is THREE nodes and one sentence to a reader. Its head —
  // `Headroom <n>. ` — carries one letter-word and falls below the prose line,
  // so it is not listed; the two nodes that carry the sentence are, and they
  // are what a fix has to move. A sentence split across nodes is caught by the
  // nodes that hold its words, which is the property this check needs and has.
  {
    file: 'preview.js',
    text: `the smallest thing that did not fit costs ${HOLE}`,
    verdict: 'unkeyed',
    reason: 'The emphasised middle of the spill hint. The design of record carries Hebrew '
      + 'for it (הדבר הקטן ביותר שלא נכנס עולה …). Filed with the node beside it; its '
      + '`Headroom <n>. ` head is below the prose line and is fixed with them.',
  },
  {
    file: 'preview.js',
    text: ' — so the headroom is not usable by anything currently selected.',
    verdict: 'unkeyed',
    reason: 'The tail of the spill hint. Hebrew exists in the design of record '
      + '(— ולכן העודף אינו שמיש לאף פריט שנבחר.). Filed.',
  },
  // ── coverage.js — not this task's file; reported, not touched ─────────
  {
    file: 'coverage.js',
    text: 'Copy failed',
    verdict: 'unkeyed',
    reason: 'The copy button\'s failure state, in English under `א`. Its success state '
      + '(`Copied`) is one word and falls below the prose line, so the pair is split by the '
      + 'threshold and only half is listed — recorded here so the next reader fixes both. '
      + 'Not this task\'s file (lane discipline); reported to the owner.',
  },
  // ── watch.js — not this task's file; reported, not touched ────────────
  {
    file: 'watch.js',
    text: 'regime change · ',
    verdict: 'unkeyed',
    reason: 'A feed row prefix. `watch.js` already carries a filed task for the emphasis '
      + 'runs its string grammar has no marker for, and this belongs with it. Not this '
      + 'task\'s file; reported.',
  },
];

test('every user-facing literal under screens/ is enumerated, and the ledger is exact', () => {
  const files = readdirSync(SCREENS).filter((f) => f.endsWith('.js')).sort();
  assert.ok(
    files.length > 0,
    `no screen module found under ${SCREENS} — every assertion below walks this set, so an `
      + 'empty one would pass while measuring nothing',
  );

  const prose: Literal[] = [];
  for (const file of files) {
    for (const literal of collect(file, readFileSync(path.join(SCREENS, file), 'utf8'))) {
      if (isProse(literal.text)) prose.push(literal);
    }
  }

  // Compared as a SET of `file` NUL `text`, because one sentence can legitimately
  // be built twice in a file and the ledger rules on the sentence, not the site.
  const key = (file: string, text: string): string => `${file}\u0000${text}`;
  const measured = new Set(prose.map((l) => key(l.file, l.text)));
  const ledger = new Set(KNOWN_LITERALS.map((l) => key(l.file, l.text)));

  const appeared = [...measured].filter((k) => !ledger.has(k)).sort();
  const departed = [...ledger].filter((k) => !measured.has(k)).sort();

  const show = (keys: string[]): string[] =>
    keys.map((k) => { const [file, text] = k.split('\u0000'); return `${file}: ${JSON.stringify(text)}`; });

  assert.deepEqual(
    show(appeared),
    [],
    'a user-facing string literal appeared under screens/ that this ledger does not name. '
      + 'Give it a key in BOTH string tables and draw it through ctx.t — or, if it is '
      + 'genuinely product vocabulary, add it to KNOWN_LITERALS with the reason. Do not '
      + 'delete this assertion: a string with no key is invisible to strings-parity and to '
      + 'bidi.spec, and this is the only thing that sees it.',
  );

  assert.deepEqual(
    show(departed),
    [],
    'this ledger names a literal that is no longer in the source — it was keyed, moved or '
      + 'deleted. Remove the entry. The list is a ratchet and may only shrink; stale entries '
      + 'are how a ledger stops describing the code it is about.',
  );
});

/**
 * The ledger's own shape, asserted so an entry cannot be added without the two
 * things that make it worth having: a verdict and a reason a later reader can
 * act on.
 */
test('every ledger entry carries a verdict and a reason', () => {
  const bad: string[] = [];
  for (const entry of KNOWN_LITERALS) {
    if (entry.verdict !== 'vocabulary' && entry.verdict !== 'unkeyed') {
      bad.push(`${entry.file}: verdict must be 'vocabulary' or 'unkeyed'`);
    }
    if (entry.reason.trim().length < 40) {
      bad.push(`${entry.file}: ${JSON.stringify(entry.text)} — the reason must say WHY, `
        + 'not merely that somebody looked');
    }
  }
  assert.deepEqual(bad, [], 'ledger entries missing a verdict or a usable reason');
});

/**
 * **The count, drawn and named.** Not an assertion about the number — a pinned
 * total fails for the wrong reason the next time a screen gains a sentence, and
 * the equality test above already holds the membership exactly. This reports the
 * split so a run says what the state of the UI's translation actually is, which
 * is the claim the whole file exists to turn from an assumption into a
 * measurement.
 */
test('the ledger reports how much of screens/ is still unkeyed', () => {
  const unkeyed = KNOWN_LITERALS.filter((l) => l.verdict === 'unkeyed');
  const files = new Set(unkeyed.map((l) => l.file));
  console.log(
    `screens/: ${KNOWN_LITERALS.length} user-facing literals enumerated — `
      + `${unkeyed.length} still unkeyed across ${files.size} file(s) `
      + `(${[...files].sort().join(', ')}), `
      + `${KNOWN_LITERALS.length - unkeyed.length} correctly product vocabulary.`,
  );
  assert.ok(true);
});
