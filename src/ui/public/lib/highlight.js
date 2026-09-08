/**
 * **Syntax colour for a fenced block that SAYS what language it is — and for
 * no other kind of block.**
 *
 * `languageFor(info)` decides; `highlightNodes(source, lang, doc)` draws. Those
 * two functions are the whole surface, and the split between them is the point
 * of the file rather than tidiness — see THE SEAM below.
 *
 * ── THE RULING, AND THE MEASUREMENT THAT SHAPED IT ────────────────────────
 *
 * `TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing`, owner
 * 2026-09-08, pointing at a path his terminal had coloured: *"could you do the
 * same in the session browser?"*, then *"Full syntax colouring in fenced blocks
 * too. everything that is colourd should apear similar in the viewer"*, then —
 * on the recommendation this file implements — *"i'll try your recommendation
 * first and see if it is good enough"*.
 *
 * Re-measured on his own transcript on 2026-09-09, 74,099,176 bytes, with a
 * CommonMark-shaped fence scanner (variable-length markers, opener and closer
 * paired), because the item's own table counted fence LINES rather than fenced
 * BLOCKS and therefore reported each block twice:
 *
 *                                   this file          the item's table
 *     assistant text blocks           2,108                 2,060
 *     inline code spans              10,249                10,047
 *     FENCED BLOCKS                     185                   370   ← doubled
 *     with a language tag                25                    25   ← agrees
 *     with NO language tag              160  (86.5%)          345   (93.2%)
 *
 * The tag histogram is identical either way (js 11, bash 6, json 3, yaml 2,
 * ts 1, diff 1, sql 1) because a CLOSING fence carries no info string, so the
 * doubling landed entirely in the untagged column. **The real untagged share is
 * 86.5%, not 93.2%, and the tagged share is 13.5%, not 6.8%** — the conclusion
 * does not move, and the number is corrected here so nobody re-derives it.
 *
 * ── WHY SIX LANGUAGES AND NOT A GENERAL HIGHLIGHTER ───────────────────────
 *
 * Six tokenisers cover all 25 tagged fences in that corpus, and js/ts + bash +
 * json cover 21 of them. `CONST-zero-runtime-dependencies` means a library
 * arrives as vendored bytes with a SHA-256 pin, a `VENDOR.md` row and an
 * upgrade ritual, so the alternative was PRICED rather than assumed —
 * highlight.js 11.11.1, the `es/` build, fetched and measured on 2026-09-09:
 *
 *     es/core.min.js                    20,445 B
 *     es/languages/javascript.min.js     6,583 B
 *     es/languages/typescript.min.js     7,858 B
 *     es/languages/bash.min.js           3,182 B
 *     es/languages/json.min.js             511 B
 *     es/languages/yaml.min.js           1,947 B
 *     es/languages/sql.min.js            6,551 B
 *     es/languages/diff.min.js             611 B
 *     styles/base16/onedark.min.css      1,403 B
 *     ────────────────────────────────────────────
 *     NINE files, 49,091 B, nine digests, nine curl lines, one upgrade ritual
 *
 * It would PASS the gate — all seven `FORBIDDEN` constructs are zero in the
 * core, checked rather than assumed — so this is a question of proportion and
 * not of admissibility. **49,091 vendored bytes to colour 25 blocks**, plus a
 * foreign class vocabulary (`hljs-*`) whose stylesheet is a whole appearance
 * adopted wholesale — the thing `VENDOR.md` records as a DELIBERATE exception
 * for `github-markdown-css` and the default answer nowhere else.
 *
 * This file is the other side of that trade, and `lib/ansi.js` is the
 * precedent sitting beside it: that lane refused ~9-14 KB of vendoring to serve
 * 0.004% of records and hand-wrote ~70 lines instead. The rule it followed is
 * proportion, not prohibition, and the number is the argument.
 *
 * ── THE SEAM, AND WHY IT IS ONE FUNCTION ──────────────────────────────────
 *
 * The ruling is PROVISIONAL by the owner's own words: *"see if it is good
 * enough"* is a verdict he will pass on the 86.5% of fences that stay plain. So
 * the decision "which language, if any" is made in exactly one place —
 * `languageFor` — and it reads ONE input: the fence's own info string. It never
 * looks at the source.
 *
 * If the verdict is that untagged fences need colour too, detection is a second
 * argument to `languageFor` and a fallback inside it. Nothing else moves: not
 * `highlightNodes`, not `markdown.js`, not `styles.css`. That is what "one
 * seam with a clear boundary" is for.
 *
 * **And the measurement that would inform such a change was taken now rather
 * than then**, because the item asks for it and because it points the other
 * way from what a reader would guess. Of the 160 untagged fences in his
 * session, hand-classified by their first line, at most 19 are code or a
 * command in ANY language — `node src/cli/index.ts ui --port 58888`,
 * `const SUBJECT_KEYS = [`, a bare JSON object. The other ~141 are command
 * OUTPUT, aligned ledgers, timelines and measurement tables:
 *
 *     body_disagrees_with_meta (34)  [info]  1 acknowledged
 *     done     406  ████████████████░░░░  80%
 *     types: user=28  assistant=54  system=5  attachment=51
 *
 * So the untagged 86.5% are not "mostly one language nobody typed". They are
 * mostly **not a language at all**, and both detection AND defaulting would
 * paint a column of counts as though the numbers were literals and the words
 * were keywords. That is the failure the ruling's own reasoning names: a
 * misleading line is worse than a plain one.
 *
 * ── NO COLOUR IS SPELLED HERE ─────────────────────────────────────────────
 *
 * Every token gets a CLASS and never an inline colour, exactly as `lib/ansi.js`
 * does and for the same reason: `styles.css` owns the palette, in one block
 * scoped so a foreign vocabulary cannot leak onto a screen. Syntax colours ARE
 * such a vocabulary — they cannot come out of this product's five budgeted
 * meaning hues and must not reach one. The nine hues those classes wear are
 * byte-identical to nine already declared on `.tvterm`, so this adds no hue to
 * the product at all; it re-uses the terminal's own, which is what the owner
 * asked to see.
 *
 * ── NO HTML STRING IS PRODUCED ANYWHERE IN THIS FILE ──────────────────────
 *
 * `doc` is injected for the reason `lib/markdown.js` and `lib/ansi.js` inject
 * it: it is the only thing here that touches a document, so `node --test` can
 * pass a two-method stand-in and every rule below is measurable without a
 * browser. Code inside a fence is arbitrary text somebody else wrote, and it
 * reaches the page through `createTextNode` only.
 *
 * ── AND NOTHING HERE SETS `direction` OR `unicode-bidi` ───────────────────
 *
 * A token wrapper is a NEW inline element inside the LTR island `.tvsaid pre`
 * already is, and that is the exact shape that once put a leading dot at the
 * wrong end of an English sentence on the Hebrew page. A `<span>` with default
 * `unicode-bidi: normal` is TRANSPARENT to the bidi algorithm: splitting a line
 * into spans cannot change how its characters are ordered. Setting `isolate` on
 * a token WOULD change it, by making each token its own bidi run — so no rule
 * here or in `styles.css` does. `e2e/code-colour.spec.ts` measures the rendered
 * text in both languages rather than trusting this paragraph.
 */

/**
 * Info string → the language this file will colour it as, or `null`.
 *
 * **THE SEAM.** One input, one decision, one place. `info` is the fence's own
 * declaration — `markdown-it` hands it over verbatim — and the first word of it
 * is taken, because ```` ```js title=x ```` is a real spelling.
 *
 * `null` means "draw this as plain text", and it is returned for two different
 * situations that must not be confused by a caller:
 *   - the fence declared nothing (160 of 185 blocks), and
 *   - the fence declared something with no tokeniser here (0 of 185 today).
 *
 * `markdown.js` tells them apart by looking at `info` itself, and labels the
 * second — a reader who wrote ```` ```python ```` sees the word `python` above
 * an uncoloured block rather than being left to wonder whether colouring broke.
 */
export function languageFor(info) {
  const first = String(info ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return ALIASES[first] ?? null;
}

/**
 * Every spelling of a language this file tokenises, mapped to its canonical id.
 *
 * The seven tags measured in the corpus are all here; the rest are the ordinary
 * synonyms for the same six tokenisers, which cost a line each and stop a
 * ```` ```shell ```` fence from rendering differently to a ```` ```bash ````
 * one for no reason a reader could see.
 */
const ALIASES = {
  js: 'js', javascript: 'js', jsx: 'js', mjs: 'js', cjs: 'js', node: 'js',
  ts: 'ts', typescript: 'ts', tsx: 'ts',
  bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
  json: 'json', jsonc: 'json',
  yaml: 'yaml', yml: 'yaml',
  sql: 'sql',
  diff: 'diff', patch: 'diff',
};

/** The canonical ids, for a test that wants to enumerate them. */
export const LANGUAGES = ['js', 'ts', 'bash', 'json', 'yaml', 'sql', 'diff'];

/* ── THE CLASS VOCABULARY ──────────────────────────────────────────────────

   Nine names, short because they repeat once per token, and `tvh-` prefixed so
   they sort beside the `tv*` block in `styles.css` and can never collide with
   `lib/ansi.js`'s `tva-*` set. What each MEANS is fixed here and the colour it
   wears is `styles.css`'s business:

     tvh-c  a comment            tvh-f  a function or a command word
     tvh-s  a string             tvh-t  a type or a constructor
     tvh-n  a number             tvh-p  a property, a key, a field
     tvh-k  a keyword            tvh-v  a variable expansion — `$HOME`
     tvh-l  a literal            tvh-a  an option — `--yes`, `-n`

   Diff adds three more, because a diff colours LINES and not tokens:
   `tvh-add`, `tvh-del`, `tvh-meta`. */

/**
 * One language's rules, tried in order at every position, first match winning.
 *
 * Every pattern is STICKY (`y`), so it can only match at the cursor and the
 * scanner never has to check `m.index`. Where a rule must see what precedes the
 * cursor it uses a lookbehind rather than consuming the context, because
 * consuming it would colour the context too.
 *
 * The lists are deliberately SHORT. An unlisted keyword renders in the reader's
 * own ink, which is the safe direction — the same argument `lib/ansi.js` makes
 * for the SGR codes it declines to map. A wrong colour claims something; a
 * missing one claims nothing.
 */
const JS_KEYWORDS = 'as|async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|switch|throw|try|typeof|var|void|while|yield';
/** TypeScript adds these, and `ts` is `js` plus this list and nothing else. */
const TS_KEYWORDS = 'abstract|any|asserts|boolean|declare|enum|implements|infer|interface|is|keyof|namespace|never|number|private|protected|public|readonly|satisfies|string|type|unknown|unique';
const SHELL_KEYWORDS = 'case|do|done|elif|else|esac|export|fi|for|function|if|in|local|return|set|source|then|until|while';
const SQL_KEYWORDS = 'select|from|where|and|or|not|null|in|is|as|on|join|left|right|inner|outer|group|order|by|having|limit|offset|insert|into|values|update|set|delete|create|table|index|view|drop|alter|distinct|union|all|case|when|then|else|end|asc|desc|count|sum|min|max|avg|exists|between|like|primary|key|foreign|references|default|unique|with|returning';

/** `js` and `ts` share every rule but their keyword list. */
function scriptRules(keywords) {
  return [
    { re: /\/\*[\s\S]*?\*\//y, cls: 'tvh-c' },
    { re: /\/\/[^\n]*/y, cls: 'tvh-c' },
    // A template literal is taken WHOLE, `${…}` included. Colouring the
    // interpolations would need a second scanner re-entered at every `${`, and
    // what it would buy is smaller than what a mis-paired brace would cost.
    { re: /`(?:\\[\s\S]|[^`\\])*`/y, cls: 'tvh-s' },
    { re: /'(?:\\.|[^'\\\n])*'/y, cls: 'tvh-s' },
    { re: /"(?:\\.|[^"\\\n])*"/y, cls: 'tvh-s' },
    { re: /(?<![\w$.])(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)n?(?![\w$])/y, cls: 'tvh-n' },
    { re: new RegExp(`(?<![\\w$.])(?:${keywords})(?![\\w$])`, 'y'), cls: 'tvh-k' },
    { re: /(?<![\w$.])(?:true|false|null|undefined|NaN|Infinity|this|super)(?![\w$])/y, cls: 'tvh-l' },
    // A dotted member — `token.content`, `path.posix` — before the two rules
    // below, so the head of `Item.of(x)` is a type and its tail is a property
    // rather than both being read as calls.
    //
    // `(?:^|[^.])` in the lookbehind is there because of ONE character seen in
    // a screenshot: `{ ...item }` was drawn with `item` in the property hue,
    // which claims a member access where the source has a SPREAD. A plain
    // identifier renders in the reader's own ink instead, which is what it is.
    { re: /(?<=(?:^|[^.])\.)[A-Za-z_$][\w$]*/y, cls: 'tvh-p' },
    // A Capitalised identifier. Every constructor, class and TypeScript type in
    // the measured fences is one, and nothing else in them is.
    { re: /(?<![\w$.])[A-Z][\w$]*/y, cls: 'tvh-t' },
    // A name with a `(` after it. Keywords are already gone, so `if (` cannot
    // reach here and `startUiChild(` can.
    { re: /[A-Za-z_$][\w$]*(?=\s*\()/y, cls: 'tvh-f' },
  ];
}

const RULES = {
  js: scriptRules(JS_KEYWORDS),
  ts: scriptRules(`${JS_KEYWORDS}|${TS_KEYWORDS}`),

  /* SHELL. No number rule, and that absence is a decision: a shell fence in
     this corpus is full of ports, versions and paths — `--port 58888`,
     `markdown-it@15.0.1`, `src/cli/index.ts` — and a digit inside one of those
     is not a literal. Colouring it would be the wrong claim on nearly every
     line, so shell colours what a shell itself distinguishes and nothing more. */
  bash: [
    { re: /(?<=^|\s)#[^\n]*/my, cls: 'tvh-c' },
    { re: /'[^'\n]*'/y, cls: 'tvh-s' },
    { re: /"(?:\\.|[^"\\\n])*"/y, cls: 'tvh-s' },
    { re: /\$(?:\{[^}\n]*\}|[A-Za-z_]\w*|[0-9@*#?$!-])/y, cls: 'tvh-v' },
    { re: new RegExp(`(?<=^|[\\s;&|(])(?:${SHELL_KEYWORDS})(?![\\w-])`, 'my'), cls: 'tvh-k' },
    { re: /(?<=^|\s)--?[A-Za-z][\w-]*/my, cls: 'tvh-a' },
    // THE COMMAND POSITION, which is the shell's own grammar rather than a
    // guess: the first word of a line, or of a pipeline stage, is the thing
    // being run. Without it a `mycontext focus --tag ui --yes` fence would have
    // its two flags coloured and its verb left as prose, which reads as a
    // highlighter that half-worked.
    { re: /(?<=(?:^|[|&;(])[ \t]*)[A-Za-z_][\w.-]*(?:\/[\w.@-]+)*/my, cls: 'tvh-f' },
  ],

  json: [
    { re: /"(?:\\.|[^"\\])*"(?=\s*:)/y, cls: 'tvh-p' },
    { re: /"(?:\\.|[^"\\])*"/y, cls: 'tvh-s' },
    { re: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, cls: 'tvh-n' },
    { re: /(?:true|false|null)(?![\w-])/y, cls: 'tvh-l' },
  ],

  yaml: [
    { re: /(?<=^|\s)#[^\n]*/my, cls: 'tvh-c' },
    // A mapping key: at the head of a line, optionally after a `- ` bullet, up
    // to a colon that is followed by space or end of line. The trailing
    // lookahead is what keeps `source: my-context/docs/x.md#task-16` from
    // having its VALUE read as a second key.
    { re: /(?<=^[ \t]*(?:-[ \t]+)?)[A-Za-z_"'][^:\n]*?(?=:(?:[ \t]|$))/my, cls: 'tvh-p' },
    { re: /'[^'\n]*'/y, cls: 'tvh-s' },
    { re: /"(?:\\.|[^"\\\n])*"/y, cls: 'tvh-s' },
    { re: /(?<![\w-])(?:true|false|null|yes|no|on|off|~)(?![\w-])/my, cls: 'tvh-l' },
    { re: /(?<![\w.-])-?\d+(?:\.\d+)?(?![\w.-])/y, cls: 'tvh-n' },
  ],

  sql: [
    { re: /--[^\n]*/y, cls: 'tvh-c' },
    { re: /\/\*[\s\S]*?\*\//y, cls: 'tvh-c' },
    { re: /'(?:''|[^'])*'/y, cls: 'tvh-s' },
    { re: new RegExp(`(?<![\\w.])(?:${SQL_KEYWORDS})(?![\\w.])`, 'iy'), cls: 'tvh-k' },
    { re: /(?<![\w.])\d+(?:\.\d+)?(?![\w.])/y, cls: 'tvh-n' },
  ],
};

/**
 * The generic walk: cursor, ordered rules, first match wins, everything else
 * accumulated as plain text.
 *
 * A run of unmatched characters becomes ONE text node rather than one per
 * character, which is what `plain` is for. A rule that matches the empty string
 * is skipped rather than trusted, because a zero-length match at the cursor
 * would spin here forever — the one failure mode a hand-written scanner has and
 * a vendored one has already survived.
 */
function scanNodes(source, rules, doc) {
  const nodes = [];
  let plain = '';
  let at = 0;
  const flush = () => {
    if (plain === '') return;
    nodes.push(doc.createTextNode(plain));
    plain = '';
  };
  while (at < source.length) {
    let hit = null;
    for (const rule of rules) {
      rule.re.lastIndex = at;
      const match = rule.re.exec(source);
      if (match === null || match[0] === '') continue;
      hit = { text: match[0], cls: rule.cls };
      break;
    }
    if (hit === null) {
      plain += source[at];
      at += 1;
      continue;
    }
    flush();
    const span = doc.createElement('span');
    span.className = hit.cls;
    span.textContent = hit.text;
    nodes.push(span);
    at += hit.text.length;
  }
  flush();
  return nodes;
}

/**
 * A diff, which is the one tagged language that colours LINES and not tokens.
 *
 * The file headers are matched before the bare markers, because `--- a/x` and
 * `+++ b/x` both begin with a character that would otherwise read as a removal
 * or an addition — which is exactly how a hand-rolled diff renderer paints a
 * header the colour of a deletion.
 *
 * The newline is kept INSIDE the span it terminates. Splitting it out would
 * make each line two nodes for no gain, and a `<pre>` renders either the same.
 */
function diffNodes(source, doc) {
  const nodes = [];
  let plain = '';
  const flush = () => {
    if (plain === '') return;
    nodes.push(doc.createTextNode(plain));
    plain = '';
  };
  // `split` keeps every line; the trailing `\n` is re-attached below so the
  // block's own text is reproduced byte for byte.
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const text = i === lines.length - 1 ? line : `${line}\n`;
    const cls = /^(?:---|\+\+\+|@@|diff |index |new file|deleted file|similarity |rename )/.test(line)
      ? 'tvh-meta'
      : line.startsWith('+') ? 'tvh-add'
        : line.startsWith('-') ? 'tvh-del'
          : null;
    if (cls === null) { plain += text; continue; }
    flush();
    const span = doc.createElement('span');
    span.className = cls;
    span.textContent = text;
    nodes.push(span);
  }
  flush();
  return nodes;
}

/**
 * `source` → an array of nodes, tokens wearing classes and everything else
 * plain text.
 *
 * `lang` is what `languageFor` returned and nothing else; an unknown one gets a
 * single text node, so a caller that forgets to ask the seam still renders the
 * fence rather than losing it.
 */
export function highlightNodes(source, lang, doc) {
  const src = String(source);
  if (lang === 'diff') return diffNodes(src, doc);
  const rules = RULES[lang];
  if (rules === undefined) return [doc.createTextNode(src)];
  return scanNodes(src, rules, doc);
}
