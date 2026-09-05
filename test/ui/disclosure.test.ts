/**
 * **`lib/disclosure.js` — the one shared `?`, drawn against a stand-in
 * document.**
 *
 * `STD-a-screen-explains-itself-in-plain-words-and-depth-hides` names one
 * component, one icon, one interaction, one set of string keys.
 * `TASK-one-circled-question-mark-carries-every-screen-s-extended` (seq:20)
 * is the task that builds it, first of three, because
 * `TASK-scope-coverage-summarises-first-and-shows-detail-on-demand` (seq:21)
 * is its first consumer and everything after copies what it draws.
 *
 * ── WHAT THIS FILE PINS ─────────────────────────────────────────────────
 *
 *   - the shape: `details.help > summary + div.helpbox`, matching the four
 *     hand-built call sites in `coverage.js`, `doctor.js` (twice) and
 *     `work.js` byte for byte, so promoting a fifth site to this factory
 *     changes nothing about what a reader sees;
 *   - the summary carries ONLY the keyed short label — never the body;
 *   - the body is exactly the nodes the caller passed, appended in order;
 *   - the optional example block, labelled with the shared `th.example` key
 *     rather than a second one minted for the same word, and omitted
 *     entirely when no example is given — a boundary this screen's own
 *     content earns, not a slot every caller must fill;
 *   - that it is a REAL `<details>`/`<summary>` pair, which is this file's
 *     whole keyboard-access argument: nothing here calls
 *     `addEventListener`, and there is nothing else that could make the
 *     disclosure operable from a keyboard.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE ───────────────────────────────────
 *
 * `module.registerHooks` maps `/lib/` and `/screens/` onto
 * `src/ui/public/`, the arrangement `test/ui/command-actions.test.ts`
 * settled on: the REAL bytes load, unmodified, so nothing that passes here
 * can differ from what a browser runs. The stand-in `document` is installed
 * only for the duration of a build.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('/screens/') || specifier.startsWith('/lib/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// ── The stand-in document — `el()`'s own members, and nothing more ────────

interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  children: FakeNode[];
}

function textNode(text: string): FakeNode {
  return { tag: '#text', className: '', textContent: text, children: [] };
}

interface FakeElement extends FakeNode {
  append: (...nodes: (FakeNode | string)[]) => void;
}

function element(tag: string): FakeElement {
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    children: [],
    append: (...nodes: (FakeNode | string)[]): void => {
      for (const child of nodes) node.children.push(typeof child === 'string' ? textNode(child) : child);
    },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

async function withDocument<T>(body: () => Promise<T> | T): Promise<T> {
  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  try {
    return await body();
  } finally {
    if (!had) delete globals.document;
  }
}

/** The text a node carries — appended children, or a `textContent` set directly. */
function textOf(node: FakeNode): string {
  return node.children.length > 0 ? node.children.map(textOf).join('') : node.textContent;
}

function findAll(root: FakeNode, predicate: (node: FakeNode) => boolean): FakeNode[] {
  const out: FakeNode[] = [];
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (predicate(child)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

interface DisclosureModule {
  helpDisclosure: (
    ctx: { t: (key: string, subs?: Record<string, unknown>) => FakeNode[] },
    summaryKey: string,
    body: (FakeNode | string)[],
    options?: { summarySubs?: Record<string, unknown>; example?: (FakeNode | string)[] },
  ) => FakeElement;
}

async function disclosureModule(): Promise<DisclosureModule> {
  return (await import(pathToFileURL(path.join(PUBLIC, 'lib', 'disclosure.js')).href)) as DisclosureModule;
}

/** A minimal `ctx.t`, standing in for `lib/i18n.js`: renders `KEY[sub=value]`. */
function fakeCtx(): { t: (key: string, subs?: Record<string, unknown>) => FakeNode[] } {
  return {
    t: (key, subs = {}) => {
      const parts = Object.entries(subs).map(([k, v]) => `[${k}=${v}]`).join('');
      return [textNode(`${key}${parts}`)];
    },
  };
}

test('the disclosure is a real <details>/<summary> pair — the whole keyboard-access argument', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(fakeCtx(), 'help.k', [textNode('body')]));
  assert.equal(built.tag, 'details');
  assert.equal(built.className, 'help');
  const summary = built.children.find((c) => c.tag === 'summary');
  assert.ok(summary !== undefined, 'no <summary> child — a <details> with none has no visible '
    + 'toggle and no keyboard target at all');
});

test('the summary carries only the keyed short label, nothing of the body', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(fakeCtx(), 'help.k', [textNode('the long body')]));
  const summary = built.children.find((c) => c.tag === 'summary')!;
  assert.equal(textOf(summary), 'help.k');
  assert.ok(!textOf(summary).includes('the long body'),
    'the body leaked into the summary — the short sentence and the disclosure would read as one');
});

test('summarySubs fill the summary key\'s own slots, exactly as ctx.t(key, subs) everywhere else', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(
    fakeCtx(), 'help.k', [], { summarySubs: { code: 'RULE-x' } },
  ));
  const summary = built.children.find((c) => c.tag === 'summary')!;
  assert.equal(textOf(summary), 'help.k[code=RULE-x]');
});

test('the body is exactly the nodes the caller passed, appended in order, inside .helpbox', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(
    fakeCtx(), 'help.k', [textNode('first'), textNode('second')],
  ));
  const box = built.children.find((c) => c.tag === 'div' && c.className === 'helpbox')!;
  assert.ok(box !== undefined, 'no div.helpbox — styles.css has no rule for anything else');
  assert.deepEqual(box.children.map(textOf), ['first', 'second']);
});

test('no example given draws no .ex — a boundary the content earns, not a slot every caller fills', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(fakeCtx(), 'help.k', [textNode('body')]));
  assert.deepEqual(findAll(built, (n) => n.className === 'ex'), []);
});

test('an example is labelled with the shared th.example key, not a second one minted for "Example"', async () => {
  const { helpDisclosure } = await disclosureModule();
  const built = await withDocument(() => helpDisclosure(
    fakeCtx(), 'help.k', [textNode('body')], { example: [textNode('a file that does not exist yet')] },
  ));
  const ex = findAll(built, (n) => n.className === 'ex')[0]!;
  assert.ok(textOf(ex).startsWith('th.example'),
    'the example block does not open with th.example — a second "Example" key was minted, or the '
    + 'label is unkeyed English');
  assert.ok(textOf(ex).includes('a file that does not exist yet'));
});

/**
 * The source with its comments stripped — what the browser actually EXECUTES.
 * This file's own header discusses `addEventListener` and `innerHTML` by name
 * in prose, so a scan of the raw bytes would fail on the commentary rather
 * than pass on clean code (`test/ui/coverage-screen.test.ts` records the same
 * reasoning). Block comments first, then whole-line and trailing `//`.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('no click or keyboard handler opens or closes the disclosure — <details>/<summary> already does', async () => {
  // **Narrowed 2026-09-05, not widened away.** The claim was ever about ONE
  // failure mode: a second piece of script deciding open/closed and
  // disagreeing with the native element that already decides it — which is
  // what a `click`/`keydown`/`keyup` listener on the `<details>`/`<summary>`
  // pair would be. `TASK-repaint-task-10-the-print-register` added a
  // DIFFERENT listener for a DIFFERENT reason: forcing every disclosure open
  // for a printout has nothing to do with how a reader on screen opens or
  // closes one, and it listens for a print MEDIA CHANGE, never a click or a
  // key. So the assertion is now specific to the failure it was written
  // against, rather than a blanket ban on a word that this file has a second,
  // legitimate reason to use.
  const { readFileSync } = await import('node:fs');
  const code = codeOnly(readFileSync(path.join(PUBLIC, 'lib', 'disclosure.js'), 'utf8'));
  assert.ok(!/addEventListener\(\s*'(click|keydown|keyup|keypress)'/.test(code),
    'this file wires its own open/close handler — <details>/<summary> already provides one, and a '
    + 'second means the two can disagree');
});

test('the print-forced-open listener is the ONLY addEventListener here, and it never toggles a click', async () => {
  const { readFileSync } = await import('node:fs');
  const code = codeOnly(readFileSync(path.join(PUBLIC, 'lib', 'disclosure.js'), 'utf8'));
  const calls = [...code.matchAll(/\.addEventListener\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(calls.sort(), ['beforeprint', 'change', 'afterprint'].sort(),
    'a new addEventListener landed in this file beyond the print-forced-open trio — read it '
    + 'against the reasoning above before assuming it belongs');
});

test('this file writes no innerHTML and no style attribute', async () => {
  const { readFileSync } = await import('node:fs');
  const code = codeOnly(readFileSync(path.join(PUBLIC, 'lib', 'disclosure.js'), 'utf8'));
  assert.ok(!code.includes('innerHTML'), 'innerHTML destroys the .m bidi-isolation spans');
  assert.ok(!/setAttribute\(\s*'style'/.test(code), 'CSP forbids a style attribute');
});
