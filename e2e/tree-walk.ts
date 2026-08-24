/**
 * **A TREE comparison between a screen and its mockup section.**
 *
 * ── WHY THIS EXISTS BESIDE `screen-parity.spec.ts` ─────────────────────────
 *
 * That file flattens each screen to a SORTED SET of element KINDS
 * (`tag.class1.class2`) and reports what the mockup has and the app does not.
 * Read its `COLLECT_KINDS`: the set is built with `new Set()` and sorted, so
 * four things a person sees the instant they look at the screen are invisible
 * to it —
 *
 *   ORDER     a table drawn above its caption is the same set as below it.
 *   NESTING   a table BESIDE a card is the same set as one INSIDE it.
 *   QUANTITY  one `.blk` and twelve `.blk` are the same set.
 *   CONTENT   the set holds no text at all.
 *
 * and for the eight screens in its `DATA_DEPENDENT` the ledger is a CEILING,
 * so drawing FEWER kinds than the mockup passes too.
 *
 * This module compares the TREES. Tag, classes, sibling order, depth and
 * count, walked in parallel from `<section data-p="NAME">` on both sides, and
 * every divergence carries a locator a person can paste into devtools.
 *
 * ── WHAT IT DELIBERATELY DOES NOT COMPARE ──────────────────────────────────
 *
 * **Text content.** The mockup carries a sample scene — five rows, one
 * session, invented ids. The app renders whatever the corpus holds. Comparing
 * strings would report every cell on every screen and drown the structural
 * findings, which are the ones that decide whether a fix is code. Leaf text is
 * CARRIED on each node (truncated) so a locator can be recognised by eye, and
 * it is never a divergence.
 *
 * ── VISIBILITY, AND THE SVG TRAP ───────────────────────────────────────────
 *
 * Hidden elements are skipped on both sides, subtree and all, for the reason
 * `screen-parity.spec.ts` gives: the mockup keeps every state variant in
 * markup and shows one, so counting hidden nodes would demand the app render
 * states that are not true.
 *
 * `offsetParent === null` is the display:none test and it is an HTMLElement
 * property. On an SVG element it is `undefined`, so `=== null` is false and
 * SVG children are never skipped by it — correct, since an `<svg>` that is
 * itself hidden is skipped as a whole and its children are never reached.
 *
 * Classes are read with `getAttribute('class')` and NEVER `el.className`. On
 * an SVG element `className` is an `SVGAnimatedString`, so a walker that reads
 * it records every `<rect>`, `<path>`, `<circle>` and `<text>` as a bare tag
 * with no classes. That defect stood in this repository's parity gate for
 * weeks. `tree-parity.spec.ts` proves this walker does not have it, in the
 * browser, against markup written for the purpose.
 */

/** One element, as extracted from a live page. */
export interface TreeNode {
  /** `div`, `rect`, `svg`. */
  readonly tag: string;
  /** `tag.class1.class2`, classes sorted — the same spelling `COLLECT_KINDS` uses. */
  readonly kind: string;
  /** 1-based position among the parent's element children, INCLUDING hidden ones. */
  readonly idx: number;
  /** How many element children the parent has, hidden ones included. */
  readonly sibs: number;
  /** Leaf text, trimmed and truncated. Never compared; carried so a human can recognise the node. */
  readonly text: string;
  readonly kids: TreeNode[];
}

/**
 * **Runs in the browser.** Self-contained by necessity: Playwright serialises
 * this function, so it may close over nothing.
 *
 * Returns `null` when the selector matches nothing, which the caller must
 * treat as "this screen could not be measured" and say so rather than
 * reporting zero divergences.
 */
export const EXTRACT_TREE = (selector: string): TreeNode | null => {
  const root = document.querySelector(selector);
  if (root === null) return null;

  const shown = (el: Element): boolean => {
    // `offsetParent` is undefined on SVG elements, so `=== null` is false and
    // they pass — which is right: a hidden <svg> host is skipped whole.
    const off = (el as HTMLElement).offsetParent;
    if (off === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  };

  const walk = (el: Element, idx: number, sibs: number): TreeNode => {
    // getAttribute, never el.className — see this file's header.
    const raw = (el.getAttribute('class') ?? '').trim();
    const cls = raw === '' ? '' : `.${raw.split(/\s+/).sort().join('.')}`;
    const kids: TreeNode[] = [];
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (!shown(child)) continue;
      kids.push(walk(child, i + 1, children.length));
    }
    const text = kids.length === 0 ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
    return {
      tag: el.tagName.toLowerCase(),
      kind: `${el.tagName.toLowerCase()}${cls}`,
      idx, sibs,
      text: text.length > 48 ? `${text.slice(0, 48)}…` : text,
      kids,
    };
  };

  return walk(root, 1, 1);
};

/** What kind of difference this is, structurally. */
export type DivergenceType =
  /** The mockup draws this child kind under this parent; the app draws none. */
  | 'ABSENT'
  /** The app draws this child kind under this parent; the mockup draws none. */
  | 'EXTRA'
  /** Both draw it, in different numbers. */
  | 'QUANTITY'
  /** Both draw the same kinds under this parent, in a different sequence. */
  | 'ORDER';

/**
 * Code gap or fixture gap — the distinction the inventory exists to make.
 *
 * `AMBIGUOUS` is a first-class verdict and not a failure of nerve: for a kind
 * the screen's own module demonstrably builds, a DOM that lacks it is
 * consistent with both "this corpus gives it nothing to draw" and "the branch
 * that draws it is unreachable", and nothing visible in the DOM separates
 * those two. Guessing between them is how a ledger rots.
 */
export type Verdict = 'STRUCTURAL' | 'DATA' | 'AMBIGUOUS';

export interface Divergence {
  readonly screen: string;
  readonly type: DivergenceType;
  /** The child kind at issue. Empty for ORDER, which is about the sequence. */
  readonly kind: string;
  /**
   * The locator of whichever side HAS the node — the mockup's for an ABSENT,
   * the app's for an EXTRA. The grouping key, and never on its own an answer
   * to "which document is this path in": read the two below for that.
   *
   * `section[data-p="gaps"] > div.card:nth-child(2) > table`.
   */
  readonly locator: string;
  /** Where the MOCKUP draws it. `null` when the mockup draws none. */
  readonly mockLocator: string | null;
  /** Where the APP draws it. `null` when the app draws none. */
  readonly appLocator: string | null;
  readonly mockCount: number;
  readonly appCount: number;
  /** Depth below the section root. 1 = a direct child of `<section>`. */
  readonly depth: number;
  verdict: Verdict;
  /** Why the verdict, in one clause. Written by `classify`. */
  why: string;
  /** For ORDER, the two sequences. For ABSENT, where else the kind lives. */
  readonly detail: string;
  /** Sample leaf text from the mockup node, when there is one. */
  readonly sample: string;
}

/** `tag.class:nth-child(n)`, with the index omitted when the node is an only child. */
function step(node: TreeNode): string {
  return node.sibs > 1 ? `${node.kind}:nth-child(${node.idx})` : node.kind;
}

/** A recursive shape signature — kinds and nesting, no indices, no text. */
export function signature(node: TreeNode): string {
  if (node.kids.length === 0) return node.kind;
  return `${node.kind}(${node.kids.map(signature).join(',')})`;
}

/** Every kind anywhere in a tree, with the locator of its first occurrence. */
function kindIndex(root: TreeNode, rootPath: string): Map<string, string> {
  const found = new Map<string, string>();
  const visit = (node: TreeNode, path: string): void => {
    if (!found.has(node.kind)) found.set(node.kind, path);
    for (const kid of node.kids) visit(kid, `${path} > ${step(kid)}`);
  };
  visit(root, rootPath);
  return found;
}

/** Collapse consecutive duplicates: [a,a,b,a] -> [a,b,a]. */
function runs(kinds: string[]): string[] {
  const out: string[] = [];
  for (const k of kinds) if (out[out.length - 1] !== k) out.push(k);
  return out;
}

/** Longest contiguous run of one kind in a sequence. */
function longestRun(kinds: string[], kind: string): number {
  let best = 0, cur = 0;
  for (const k of kinds) { cur = k === kind ? cur + 1 : 0; if (cur > best) best = cur; }
  return best;
}

/**
 * **The same element wearing a different state class.**
 *
 * `td.m` on one side and `td.m.stale` on the other, in the same cell of the
 * same row, is not a missing node and not an extra one. It is ONE node whose
 * class list carries a state — stale, warn, superseded, selected — and which
 * state it carries is decided by the record under it. Reported as an ABSENT
 * plus an EXTRA it reads as two code gaps; named as what it is, it reads as
 * the corpus difference it almost always is.
 *
 * "Almost always", so the verdict this feeds is AMBIGUOUS and never DATA: a
 * screen that hard-codes `stale` on a fresh field would look exactly the same
 * from here.
 */
function modifierTwin(kind: string, otherKinds: string[]): string | null {
  const [tag, ...cls] = kind.split('.');
  const mine = new Set(cls);
  for (const other of otherKinds) {
    const [otherTag, ...otherCls] = other.split('.');
    if (otherTag !== tag || other === kind) continue;
    const theirs = new Set(otherCls);
    const sub = [...mine].every((c) => theirs.has(c));
    const sup = [...theirs].every((c) => mine.has(c));
    if (!sub && !sup) continue;
    const differ = sub
      ? [...theirs].filter((c) => !mine.has(c))
      : [...mine].filter((c) => !theirs.has(c));
    return `the other side draws \`${other}\` here — same tag, class lists differ only by ` +
      `[${differ.join(', ')}], which is a STATE class rather than a different element`;
  }
  return null;
}

function counts(kids: TreeNode[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of kids) m.set(k.kind, (m.get(k.kind) ?? 0) + 1);
  return m;
}

export interface DiffOptions {
  /** Refuse to walk forever on a screen the app filled with thousands of rows. */
  readonly maxNodes?: number;
}

/**
 * Walk both trees in lock-step and report every divergence.
 *
 * ── HOW CHILDREN ARE ALIGNED, AND WHY NOT AN LCS ───────────────────────────
 *
 * At each aligned pair of parents this compares the MULTISET of child kinds
 * first, then the SEQUENCE with consecutive duplicates collapsed, then recurses
 * on children paired kind-by-kind — the i-th `tr` on the left against the i-th
 * `tr` on the right.
 *
 * An LCS alignment would be the textbook answer and it is the wrong one here.
 * The app renders 43 rows where the mockup draws 5; an LCS reports 38 separate
 * insertions, one per row, and the finding a person needs — "this list is the
 * same shape, the corpus is bigger" — is buried under 38 lines that all say the
 * same thing. Collapsing to counts says it once, and says it in the one form
 * that can be judged DATA rather than code.
 *
 * Recursion into a repeated kind is capped: the first three pairs, deduped.
 * Rows built by one template diverge identically or not at all, and thirty
 * copies of one finding is the same drowning by another route.
 */
export function diffTrees(
  screen: string, mock: TreeNode, app: TreeNode, options: DiffOptions = {},
): Divergence[] {
  const maxNodes = options.maxNodes ?? 20_000;
  const rootPath = `section[data-p="${screen}"]`;
  const out: Divergence[] = [];
  const appKinds = kindIndex(app, rootPath);
  const mockKinds = kindIndex(mock, rootPath);
  let visited = 0;
  let truncated = false;

  // **The section element's OWN classes are not compared here**, and the
  // reason is a measurement artefact worth naming rather than silencing.
  //
  // The mockup's `go(s)` sets `printing` on the section it shows — a hook for
  // its own `@media print` rule `[data-p].printing{display:block!important}`.
  // The app's stylesheet has no `.printing` rule at all. So the root kind
  // differs on ALL TWENTY-ONE screens, identically, for one reason. Reported
  // twenty-one times it is noise that buries the findings underneath it;
  // reported once, at the top of the inventory, it is a real question about
  // how the app prints. `rootDivergence` below returns it for the caller to
  // hoist.

  const recurse = (m: TreeNode, a: TreeNode, mPath: string, aPath: string, depth: number): void => {
    if (visited++ > maxNodes) { truncated = true; return; }

    const mKinds = m.kids.map((k) => k.kind);
    const aKinds = a.kids.map((k) => k.kind);
    const mCount = counts(m.kids);
    const aCount = counts(a.kids);
    const here = mPath === aPath ? null : aPath;

    const all = [...new Set([...mCount.keys(), ...aCount.keys()])].sort();
    for (const kind of all) {
      const mn = mCount.get(kind) ?? 0;
      const an = aCount.get(kind) ?? 0;
      if (mn === an) continue;

      const type: DivergenceType = an === 0 ? 'ABSENT' : mn === 0 ? 'EXTRA' : 'QUANTITY';
      const sampleNode = (mn > 0 ? m.kids : a.kids).find((k) => k.kind === kind);
      let detail = '';
      if (type === 'ABSENT') {
        const elsewhere = appKinds.get(kind);
        detail = elsewhere === undefined
          ? 'this kind appears nowhere in the app section'
          : `the app draws this kind elsewhere: ${elsewhere}`;
        const twin = modifierTwin(kind, [...aCount.keys()]);
        if (twin !== null) detail += `; ${twin}`;
      } else if (type === 'EXTRA') {
        const elsewhere = mockKinds.get(kind);
        detail = elsewhere === undefined
          ? 'this kind appears nowhere in the mockup section'
          : `the mockup draws this kind elsewhere: ${elsewhere}`;
        const twin = modifierTwin(kind, [...mCount.keys()]);
        if (twin !== null) detail += `; ${twin}`;
      } else {
        const mSame = m.kids.filter((k) => k.kind === kind);
        const aSame = a.kids.filter((k) => k.kind === kind);
        const mShapes = new Set(mSame.map(signature)).size;
        const aShapes = new Set(aSame.map(signature)).size;
        const same = signature(mSame[0]!) === signature(aSame[0]!);
        detail = `longest contiguous run mockup ${longestRun(mKinds, kind)} / ` +
          `app ${longestRun(aKinds, kind)}; distinct subtree shapes mockup ${mShapes} / ` +
          `app ${aShapes}; first occurrence subtree shapes ${same ? 'agree' : 'DIFFER'}`;
      }

      out.push({
        screen, type, kind,
        locator: `${mn > 0 ? mPath : aPath} > ${kind}`,
        mockLocator: mn > 0 ? `${mPath} > ${kind}` : null,
        appLocator: an > 0 ? `${aPath} > ${kind}` : null,
        mockCount: mn, appCount: an, depth: depth + 1,
        verdict: 'AMBIGUOUS', why: '', detail,
        sample: sampleNode?.text ?? '',
      });
    }

    // ORDER, isolated from presence: compare the collapsed sequences using only
    // the kinds BOTH sides draw. Restricting to the shared kinds is what stops
    // one absent child from being reported a second time as a reordering.
    const shared = new Set([...mCount.keys()].filter((k) => aCount.has(k)));
    const mSeq = runs(mKinds.filter((k) => shared.has(k)));
    const aSeq = runs(aKinds.filter((k) => shared.has(k)));
    if (mSeq.join('|') !== aSeq.join('|')) {
      out.push({
        screen, type: 'ORDER', kind: '', locator: mPath,
        mockLocator: mPath, appLocator: here ?? aPath,
        mockCount: mSeq.length, appCount: aSeq.length, depth,
        verdict: 'STRUCTURAL',
        why: 'the same children are drawn in a different sequence — a tree difference, never a corpus one',
        detail: `mockup [${mSeq.join(', ')}] / app [${aSeq.join(', ')}]`,
        sample: '',
      });
    }

    // Pair kind-by-kind and recurse, capped per kind.
    for (const kind of all) {
      const mSame = m.kids.filter((k) => k.kind === kind);
      const aSame = a.kids.filter((k) => k.kind === kind);
      const pairs = Math.min(mSame.length, aSame.length, 3);
      for (let i = 0; i < pairs; i++) {
        recurse(mSame[i]!, aSame[i]!, `${mPath} > ${step(mSame[i]!)}`,
          `${aPath} > ${step(aSame[i]!)}`, depth + 1);
      }
    }
  };

  recurse(mock, app, rootPath, rootPath, 0);
  if (truncated) {
    out.push({
      screen, type: 'EXTRA', kind: '', locator: rootPath,
      mockLocator: null, appLocator: null,
      mockCount: 0, appCount: 0, depth: 0, verdict: 'AMBIGUOUS',
      why: `the walk hit its ${maxNodes}-node cap and stopped — this screen's list is INCOMPLETE`,
      detail: 'raise maxNodes and re-run before trusting this screen', sample: '',
    });
  }
  return dedupe(out);
}

/**
 * The one thing `diffTrees` deliberately leaves out: the section element's own
 * classes. Returned separately so an inventory can state it once instead of
 * twenty-one times. `null` when the two agree.
 */
export function rootDivergence(mock: TreeNode, app: TreeNode): string | null {
  return mock.kind === app.kind ? null : `mockup ${mock.kind} / app ${app.kind}`;
}

/**
 * Collapse findings that differ only in a sibling index.
 *
 * The i-th and the (i+1)-th row of one table are built by one line of code, so
 * a divergence inside them is ONE finding reported twice. Normalising
 * `:nth-child(7)` to `:nth-child(n)` and grouping is the difference between an
 * inventory a person reads and a log a person closes.
 */
function dedupe(all: Divergence[]): Divergence[] {
  const byKey = new Map<string, { div: Divergence; n: number }>();
  for (const d of all) {
    const norm = d.locator.replace(/:nth-child\(\d+\)/g, ':nth-child(n)');
    const key = [norm, d.type, d.kind, d.mockCount, d.appCount, d.detail].join('|');
    const seen = byKey.get(key);
    if (seen === undefined) byKey.set(key, { div: d, n: 1 });
    else seen.n += 1;
  }
  return [...byKey.values()].map(({ div, n }) =>
    n === 1 ? div : { ...div, detail: `${div.detail} (reported on ${n} sibling subtrees)` });
}

/**
 * **Every word this source could ever put in a `class` attribute or a tag name.**
 *
 * `src/ui/public/` builds its DOM through one factory — `el(tag, cls, txt)` in
 * `screens/parts.js` — so every tag and every class it can emit is a STRING
 * LITERAL somewhere in the file. Collecting the literals and splitting them on
 * whitespace gives the screen's whole vocabulary, and a class that is not in it
 * cannot be emitted whatever the corpus holds.
 *
 * **Comments are stripped first, and that is not tidiness.** These modules
 * carry more prose than code — `preview.js` opens with two hundred lines of it
 * — and the prose quotes markup constantly. A plain search for the token `m`
 * or `card` hits a paragraph ABOUT the class and reports that the code can
 * build it, which converts a real code gap into an AMBIGUOUS and buries it.
 * Block comments and whole-line `//` and ` *` lines go before the literals are
 * read.
 *
 * Interpolations are split on too: `` `rung ${state}` `` contributes `rung`,
 * and the part the template computes is unknowable from source, which is one
 * more reason a hit here is evidence and never proof.
 */
export function vocabulary(source: string): Set<string> {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
  const out = new Set<string>();
  for (const m of code.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    // The interpolated expression is DROPPED, not split on. `${state}` is a
    // variable name, and admitting it would let any identifier in the file
    // stand as evidence that the code can emit a class of that name.
    const body = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    for (const word of body.split(/\s+/)) {
      if (/^[A-Za-z][\w-]*$/.test(word)) out.add(word);
    }
  }
  return out;
}

/**
 * **Code gap or fixture gap.**
 *
 * The only evidence a DOM comparison has is the DOM, and the DOM cannot tell a
 * branch that does not exist from a branch nothing reached. So the second
 * source of evidence is the SOURCE: `vocab` is every tag and class token the
 * screen's own module — plus the shared factories, the libraries and the shell
 * — can put on an element, and a hit there is evidence the code CAN build the
 * node.
 *
 * That evidence is one-way, and the verdicts say so. Token present + node
 * absent is AMBIGUOUS, never DATA: it is equally consistent with a corpus that
 * gives the branch nothing and with a branch that is unreachable. Token absent
 * is STRUCTURAL, which IS decidable — code that never spells the class cannot
 * emit it, whatever the corpus holds.
 */
export function classify(d: Divergence, vocab: Set<string>): Divergence {
  const parts = d.kind.split('.');
  const tag = parts[0] ?? '';
  const tokens = parts.slice(1);
  const mentioned = tokens.length === 0
    ? vocab.has(tag)
    : tokens.every((t) => vocab.has(t));

  if (d.type === 'ORDER') return d;  // already STRUCTURAL, and not corpus-decidable

  if (d.type === 'QUANTITY') {
    // **Only one QUANTITY case is decidable, and it is the DATA one.**
    //
    // Identical subtree shape on both sides means one template rendered a
    // different number of times, which is what a different number of records
    // looks like. Everything else is a shrug and is recorded as one: the
    // mockup's `docs` sample draws 2 paragraphs where the app renders 13 of a
    // real document, and whether the extra eleven are "more data" or "a
    // different renderer" is not a question a node count answers.
    if (d.detail.includes('shapes agree')) {
      d.verdict = 'DATA';
      d.why = 'one template repeated a different number of times, identical subtree shape — ' +
        'this corpus holds a different number of records than the mockup\'s sample scene';
    } else {
      d.verdict = 'AMBIGUOUS';
      d.why = 'the counts differ AND the repeated nodes are shaped differently, so this is ' +
        'not one template over more rows — could be a richer record or a different builder; ' +
        'read the nested findings under this parent before deciding';
    }
    return d;
  }

  // A state class is neither a missing element nor an extra one, whichever
  // direction it was reported from.
  if (d.detail.includes('which is a STATE class')) {
    d.verdict = 'AMBIGUOUS';
    d.why = 'the same tag in the same place on both sides, differing only by a state class — ' +
      'which state a node carries is decided by the record under it, so this is DATA unless ' +
      'the screen hard-codes the modifier';
    return d;
  }

  if (d.type === 'EXTRA') {
    d.verdict = 'STRUCTURAL';
    d.why = d.detail.startsWith('the mockup draws this kind elsewhere')
      ? 'the app nests this kind somewhere the mockup does not — a placement difference in code'
      : 'the app draws a node the mockup has nowhere on this screen';
    return d;
  }

  // ABSENT
  if (d.detail.startsWith('the app draws this kind elsewhere')) {
    d.verdict = 'STRUCTURAL';
    d.why = 'the app builds this kind but hangs it off a different parent — nesting differs, ' +
      'and no corpus can move a node';
    return d;
  }
  if (mentioned) {
    d.verdict = 'AMBIGUOUS';
    d.why = 'the screen module contains this class, so the code can build it; absent here is ' +
      'equally consistent with a corpus that gives the branch nothing and a branch nothing reaches';
    return d;
  }
  d.verdict = 'STRUCTURAL';
  d.why = 'this screen\'s module — plus parts.js, lib/ and app.js — never mentions this class, ' +
    'so no corpus can make it appear';
  return d;
}
