/**
 * **The help card, opened the way a reader opens it — every subject, every
 * section, and every claim held against the derivation it came from.**
 *
 * `TASK-the-help-is-tested-as-a-reader-would-use-it-every-subject`, owner
 * ruling 2026-09-06 (plan D27): *"do the same as D12 but for the help"*.
 *
 * ── WHY THIS FILE IS NOT `cli-help.test.ts` ───────────────────────────────
 *
 * `test/ui/cli-help.test.ts` tests the ENDPOINT: it asks `apiCliHelpSubject`
 * and holds the JSON against `COMMAND_FLAGS`, `toolDefinitions()`,
 * `slashCommands()` and `MCP_HELP_TOPICS`. Every one of its assertions is worth
 * keeping and not one of them opens the card.
 *
 * **And the three defects this screen shipped in one day all lived past the
 * endpoint.** Slash commands drew no parameters while 90 of the 91 files
 * declared `argument-hint` — nothing had asked for it. A topic drew `##`
 * instead of a heading: the Markdown served was correct and the element it went
 * into was `<pre>`. And a count inside a sentence went stale because nothing
 * read the sentence. Each is a defect BETWEEN the JSON and the reader, so this
 * file starts at the reader — `paintCliHelp` is called, the picker is MOVED,
 * and what is asserted is the text that ends up in the pane.
 *
 * ── THE BAR, WHICH IS NOT D12'S ───────────────────────────────────────────
 *
 * D12 passes once a composed command has been EXECUTED and returned the right
 * answer, because the Composer's job is to produce something that runs. **The
 * help produces nothing that runs; its job is to be TRUE.** So a test here
 * passes only once the string ON THE SCREEN has been compared with the record
 * it was derived from and found equal — not that a table appeared, not that a
 * row count matched. The flag cells are compared with `FLAG_DECLARATIONS`; the
 * tool table with the tool's own JSON Schema; the hint with the committed
 * `commands/*.md` frontmatter, re-read here; the topic body with `helpTopic`'s
 * own source, heading by heading.
 *
 * ── AND WHERE A SECTION IS ABSENT, THE ABSENCE IS MEASURED ────────────────
 *
 * The skeleton (`plan:library seq:5`) promises the same sections in the same
 * order for every kind, and each kind fills a different subset. Those absences
 * are asserted with the same force as the presences, because `LoadMyContext` —
 * the one shortcut that genuinely takes nothing — and a shortcut whose hint
 * nobody wrote down would look identical if a section were merely skipped.
 *
 * ── IN BOTH LANGUAGES ─────────────────────────────────────────────────────
 *
 * Every walk below runs `en` and `he`. Not as a translation check — the string
 * table already has one — but because the text a reader is shown must be the
 * same DERIVATION in both, and because a Hebrew sentence that still says "the
 * only one" after English was corrected is the same defect in a different
 * alphabet. The LAYOUT half of Hebrew is a picture and lives in
 * `e2e/cli-help.spec.ts`, where a browser can lay it out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  COMMAND_FLAGS, FLAG_DECLARATIONS, SUBCOMMAND_FLAGS, SUBCOMMAND_FLAG_DECLARATIONS,
  type FlagDeclaration,
} from '../../src/core/command-flags.ts';
import { editFlagSurface } from '../../src/core/edit-flags.ts';
import { MCP_HELP_TOPICS } from '../../src/core/teach.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { helpTopic, slashCommands, toolDefinitions } from '../../src/help/index.ts';
import { apiCliHelp, apiCliHelpSubject } from '../../src/ui/read-model-cli-help.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

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

/** THIS repository is the workspace under test — `edit`'s flags are its config's. */
const ws = resolveWorkspace(REPO);
const NO_PARAMS = new URL('http://127.0.0.1/api/cli-help');

/* ══ THE STAND-IN DOCUMENT ═════════════════════════════════════════════════
 *
 * The members `screens/parts.js`, `lib/i18n.js`, `lib/markdown.js` and this
 * screen touch, and no more — `library-screen.test.ts`'s own bargain, plus the
 * two this card needs that no other screen does: a node that really dispatches
 * its listeners, because MOVING THE PICKER is how every subject below is
 * opened, and an `id` field, because `markdownNodes` slugs every heading.   */

interface FakeNode {
  tag: string; className: string; textContent: string; href: string; target: string; rel: string;
  type: string; title: string; value: string; label: string; dir: string; id: string;
  dataset: Record<string, string>; attrs: Record<string, string>; children: FakeNode[];
  listeners: Record<string, (() => void)[]>;
  style: { setProperty: (name: string, value: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: FakeNode[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, fn: () => void) => void;
  dispatchEvent: (event: { type: string }) => boolean;
}

function element(tag: string): FakeNode {
  const node: FakeNode = {
    tag,
    className: '',
    textContent: '',
    href: '', target: '', rel: '', type: '', title: '', value: '', label: '', dir: '', id: '',
    dataset: {},
    attrs: {},
    listeners: {},
    style: { setProperty(name, value): void { node.attrs[`style:${name}`] = value; } },
    children: [],
    append(...nodes): void {
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    replaceChildren(...nodes): void { node.children.length = 0; node.append(...nodes); },
    setAttribute(name, value): void { node.attrs[name] = value; },
    addEventListener(type, fn): void { (node.listeners[type] ??= []).push(fn); },
    dispatchEvent(event): boolean {
      for (const fn of node.listeners[event.type] ?? []) fn();
      return true;
    },
  };
  return node;
}
function textNode(text: string): FakeNode {
  const node = element('#text');
  node.textContent = text;
  return node;
}

const DOC = {
  createElement: element,
  createTextNode: textNode,
  createElementNS: (_ns: string, tag: string) => element(tag),
};

const flat = (nodes: FakeNode[]): FakeNode[] => {
  const out: FakeNode[] = [];
  const walk = (n: FakeNode): void => { out.push(n); for (const c of n.children) walk(c); };
  for (const n of nodes) walk(n);
  return out;
};
/** Every leaf's text, joined — what a reader sees under one node. */
const textOf = (node: FakeNode): string =>
  flat([node]).filter((n) => n.children.length === 0).map((n) => n.textContent).join('');
const hasClass = (node: FakeNode, cls: string): boolean =>
  node.className.split(/\s+/).includes(cls);
/** A heading's words, with the inline markers a renderer consumes taken off. */
const plain = (text: string): string => text.replaceAll(/[`*_]/g, '').trim();

/** Run one paint with the stand-in installed as the ambient document. */
async function withDocument(work: () => void | Promise<void>): Promise<void> {
  const real = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = DOC;
  try {
    await work();
    // The screen `void`s its own paint — a listener cannot be awaited — so one
    // macrotask turn is what lets it settle. `ctx.api` resolves without a
    // socket, so this is a settle rather than a wait.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  } finally {
    (globalThis as { document?: unknown }).document = real;
  }
}

/* ══ THE CARD, PAINTED ═════════════════════════════════════════════════════ */

const screen = () => browserModule<{
  paintCliHelp: (ctx: unknown, host: FakeNode) => Promise<void>;
}>('screens', 'cli-help.js');
const stringTable = (lang: string) =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

interface Card {
  root: FakeNode;
  select: FakeNode;
  pane: FakeNode;
  /** The card's own string table, so a test names a key rather than a sentence. */
  say: (key: string, subs?: Record<string, unknown>) => string;
}

/**
 * The card, painted against the REAL read model.
 *
 * `ctx.api` is not a fixture: it is `apiCliHelp` and `apiCliHelpSubject` over
 * this repository's own workspace, which is what makes everything below a
 * comparison against a derivation rather than against a second copy of one. A
 * read those two refuse throws here rather than yielding an empty object — a
 * card that tolerated a missing read silently is how a section goes missing.
 */
async function openCard(lang: 'en' | 'he'): Promise<Card> {
  const { paintCliHelp } = await screen();
  const { strings: table } = await stringTable(lang);
  const i18n = await browserModule<{
    t: (s: Record<string, string>, k: string, subs?: Record<string, unknown>, d?: unknown) => FakeNode[];
    tFlat: (s: Record<string, string>, k: string, subs?: Record<string, unknown>) => string;
  }>('lib', 'i18n.js');
  const ctx = {
    lang,
    t: (key: string, subs?: Record<string, unknown>) => i18n.t(table, key, subs ?? {}, DOC),
    tFlat: (key: string, subs?: Record<string, unknown>) => i18n.tFlat(table, key, subs ?? {}),
    api: (url: string) => {
      if (url === '/api/cli-help') return Promise.resolve(apiCliHelp(ws).body);
      const parts = /^\/api\/cli-help\/([^/]+)\/(.+)$/.exec(url);
      if (parts === null) throw new Error(`unexpected read: ${url}`);
      const answer = apiCliHelpSubject(ws, NO_PARAMS, {
        kind: decodeURIComponent(parts[1] ?? ''), id: decodeURIComponent(parts[2] ?? ''),
      });
      if (answer.status !== 200) {
        throw new Error(`${url} answered ${answer.status}: ${JSON.stringify(answer.body)}`);
      }
      return Promise.resolve(answer.body);
    },
  };
  const root = element('main');
  await withDocument(() => paintCliHelp(ctx, root));
  const nodes = flat([root]);
  const select = nodes.find((n) => n.tag === 'select');
  assert.ok(select, 'the card drew no picker at all');
  const pane = nodes.find((n) => n.className === 'clihdetail');
  assert.ok(pane, 'the card drew no detail pane');
  return { root, select, pane, say: (key, subs) => i18n.tFlat(table, key, subs ?? {}) };
}

/**
 * Open one subject the way a reader does — by moving the picker, which is what
 * the screen listens to. Nothing here calls a paint function directly: the
 * `change` handler is the one code path that draws a subject however it was
 * reached, and a test that went round it would not be testing the card.
 */
async function open(card: Card, kind: string, id: string): Promise<FakeNode> {
  card.select.value = `${kind}/${id}`;
  await withDocument(() => { card.select.dispatchEvent({ type: 'change' }); });
  return card.pane;
}

/** Every subject the picker offers, which is the endpoint's own roster. */
const roster = (): { kind: string; id: string; label: string }[] =>
  (apiCliHelp(ws).body as { subjects: { kind: string; id: string; label: string }[] }).subjects;

/** The section headings drawn, in order — `p.welllabel` is the skeleton's own. */
const sectionsOf = (pane: FakeNode): string[] =>
  flat([pane]).filter((n) => n.tag === 'p' && hasClass(n, 'welllabel')).map((n) => textOf(n));

/** A pane that drew a refusal instead of a subject. `.spill` is `errorNote`'s. */
const spills = (pane: FakeNode): string[] =>
  flat([pane]).filter((n) => hasClass(n, 'spill')).map((n) => textOf(n));

const LANGS = ['en', 'he'] as const;

/* ══ 1. EVERY SUBJECT OPENS, IN BOTH LANGUAGES ═════════════════════════════ */

/**
 * The whole roster, opened one at a time, in both languages — 168 subjects on
 * the day this was written and never a figure typed here: the count comes off
 * the endpoint, so a subject that arrives tomorrow is opened by this test
 * tomorrow.
 *
 * What it asserts is the floor everything below stands on: the heading a reader
 * sees is the label the PICKER offered, and no subject painted a refusal into
 * the pane. A card that answered 200 and drew `errorNote` passes every
 * assertion in the endpoint suite.
 */
for (const lang of LANGS) {
  test(`every subject the picker offers opens and draws its own heading — ${lang}`, async () => {
    const card = await openCard(lang);
    const subjects = roster();
    assert.ok(subjects.length > 150, `only ${subjects.length} subjects — this walk measures nothing`);
    const wrong: string[] = [];
    const refused: string[] = [];
    for (const subject of subjects) {
      const pane = await open(card, subject.kind, subject.id);
      const heading = flat([pane]).find((n) => n.tag === 'h3');
      if (heading === undefined || textOf(heading) !== subject.label) {
        wrong.push(`${subject.kind}/${subject.id}: ${heading === undefined ? '(none)' : textOf(heading)}`);
      }
      for (const spill of spills(pane)) refused.push(`${subject.kind}/${subject.id}: ${spill}`);
    }
    assert.deepEqual(wrong, [], 'the heading on the card must be the label the picker offered — '
      + 'a reader who chose one subject and is reading another has no way to tell');
    assert.deepEqual(refused, [], 'a subject painted a refusal into the pane. The endpoint '
      + 'answered 200, so this is a defect between the JSON and the reader — exactly the gap '
      + 'the endpoint suite cannot see');
  });
}

/* ══ 2. EVERY SECTION THE SKELETON PROMISES, AND EVERY ABSENCE MEASURED ════ */

/**
 * **The per-kind census — `plan:library seq:5`'s skeleton, pinned.**
 *
 * The sections are the same in the same order for every kind, and each kind
 * fills a different subset. That subset is the thing that must not drift
 * silently: a `slash` subject drew no "what it takes" for weeks while 90 of the
 * 91 files declared one, and every render test passed throughout.
 *
 *   command  what it is · what it takes · worked examples   (3)
 *   tool     what it is · what it takes                     (2)
 *   slash    what it is · what it takes · where it runs     (3)
 *   topic    what it is                                     (1)
 *
 * `tool` has no "where it runs" because every tool runs in the one place, and
 * no worked example because nothing generates one — `mycontext help tools` has
 * none either. `topic` fills one section BECAUSE IT IS A DOCUMENT: forcing a
 * prose page to grow a "what it takes" table would be this skeleton's own
 * defect in the opposite direction.
 */
const SKELETON: Record<string, string[]> = {
  command: ['clih.s1', 'clih.s2', 'clih.ex'],
  tool: ['clih.s1', 'clih.s2'],
  slash: ['clih.s1', 'clih.s2', 'clih.s3'],
  topic: ['clih.s1'],
};

for (const lang of LANGS) {
  test(`every subject draws exactly the sections its kind promises — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    for (const subject of roster()) {
      const pane = await open(card, subject.kind, subject.id);
      const expected = (SKELETON[subject.kind] ?? []).map((key) => card.say(key));
      // Sub-headings inside a section — the composed line, the transcripts, a
      // subcommand's own name — are also `p.welllabel`, so the census is taken
      // over the skeleton's own four names rather than over every well label.
      const drawn = sectionsOf(pane).filter((text) => expected.includes(text));
      if (JSON.stringify(drawn) !== JSON.stringify(expected)) {
        wrong.push(`${subject.kind}/${subject.id}: ${JSON.stringify(drawn)}`);
      }
    }
    assert.deepEqual(wrong, [], 'a subject is missing a section its kind promises, or draws one '
      + 'out of order. The order IS the standard — what it is, what it takes, where it runs, a '
      + 'worked example — and a kind that stops filling one of its sections is the '
      + 'slash-parameter defect happening again');
  });
}

/* ══ 3. EVERY SWITCH ROW, AGAINST THE DECLARATION IT CAME FROM ═════════════ */

/** One drawn table row, read back out of the cells the screen built. */
interface DrawnRow { name: string; takes: string; means: string }

/** Every `table.flagtable` row under one pane, header excluded. */
function drawnRows(pane: FakeNode): DrawnRow[] {
  const rows: DrawnRow[] = [];
  for (const table of flat([pane]).filter((n) => n.tag === 'table' && hasClass(n, 'flagtable'))) {
    for (const tr of table.children.filter((n) => n.tag === 'tr')) {
      const cells = tr.children.filter((n) => n.tag === 'td');
      if (cells.length !== 3) continue; // the header row is `th`
      rows.push({
        name: textOf(cells[0] as FakeNode),
        takes: textOf(cells[1] as FakeNode),
        means: textOf(cells[2] as FakeNode),
      });
    }
  }
  return rows;
}

/**
 * What the "takes" cell must say for one declaration, composed from the SAME
 * three-way rule `takesCell` implements and the same string table the card drew
 * from — never a second copy of the sentence.
 */
function expectedTakes(card: Card, decl: FlagDeclaration): string {
  if (decl.values !== undefined && decl.values.length > 0) {
    return card.say('clih.oneof') + decl.values.join(', ');
  }
  if (decl.format !== undefined) {
    return decl.example !== undefined && decl.example !== ''
      ? `${decl.format} ${card.say('clih.eg')} ${decl.example}`
      : decl.format;
  }
  return card.say('clih.bare');
}

/** One command's expected rows, from whichever record holds its flags. */
function declaredFor(name: string): { flag: string; decl: FlagDeclaration }[] {
  if (Object.hasOwn(COMMAND_FLAGS, name)) {
    const spec = COMMAND_FLAGS[name];
    const declared = FLAG_DECLARATIONS[name] ?? {};
    return spec.allowed.map((flag) => ({ flag, decl: declared[flag] as FlagDeclaration }));
  }
  if (Object.hasOwn(SUBCOMMAND_FLAGS, name)) {
    const declared = SUBCOMMAND_FLAG_DECLARATIONS[name] ?? {};
    return Object.values(SUBCOMMAND_FLAGS[name]).flatMap((spec) =>
      spec.allowed.map((flag) => ({ flag, decl: declared[flag] as FlagDeclaration })));
  }
  return [];
}

/**
 * **Every flag row on the card, held against `command-flags.ts` cell by cell.**
 *
 * The item's bar at its narrowest: not that a table appeared and not that a row
 * count matched, but that the three strings a reader reads — the switch, what
 * may go in it, and what it does — are each EQUAL to the declaration the CLI's
 * own parser is built from. A note that drifted from its declaration passes
 * every count there is.
 *
 * The per-workspace sentence is part of the third cell and is checked
 * deliberately: `clih.ask` is drawn wherever a declaration carries `source`, and
 * a reader not told that the legal set depends on their own config has been
 * shown a list that is only true here.
 */
for (const lang of LANGS) {
  test(`every switch row equals its declaration, cell by cell — ${lang}`, async () => {
    const card = await openCard(lang);
    const edit = editFlagSurface(ws.config);
    const wrong: string[] = [];
    let counted = 0;

    for (const subject of roster().filter((s) => s.kind === 'command')) {
      const pane = await open(card, subject.kind, subject.id);
      const drawn = drawnRows(pane);
      const expected = subject.id === 'edit'
        ? edit.allowed.map((flag) => ({ flag, decl: edit.flags[flag] as FlagDeclaration }))
        : declaredFor(subject.id);
      if (drawn.length !== expected.length) {
        wrong.push(`${subject.id}: drew ${drawn.length} rows, declares ${expected.length}`);
        continue;
      }
      for (const [i, want] of expected.entries()) {
        const got = drawn[i] as DrawnRow;
        counted += 1;
        if (want.decl === undefined) {
          wrong.push(`${subject.id} --${want.flag}: no declaration at all`);
          continue;
        }
        if (got.name !== `--${want.flag}`) {
          wrong.push(`${subject.id} row ${i}: drew ${got.name}, declares --${want.flag}`);
          continue;
        }
        const takes = expectedTakes(card, want.decl);
        if (got.takes !== takes) {
          wrong.push(`${subject.id} --${want.flag} takes: ${JSON.stringify(got.takes)} != ${JSON.stringify(takes)}`);
        }
        // The declaration's note, plus the two sentences this card is allowed
        // to APPEND to it: the per-workspace `source` disclosure, and the
        // `--yes` held-back note whose own rule `cli-help.test.ts` owns.
        if (!got.means.startsWith(want.decl.note)) {
          wrong.push(`${subject.id} --${want.flag} means: ${JSON.stringify(got.means.slice(0, 80))} does not open with its declaration`);
          continue;
        }
        if (want.decl.source !== undefined
          && !got.means.includes(card.say('clih.ask', { source: want.decl.source }))) {
          wrong.push(`${subject.id} --${want.flag}: the per-workspace source sentence is missing`);
        }
      }
    }
    assert.ok(counted > 150, `only ${counted} rows compared — the walk measures nothing`);
    assert.deepEqual(wrong, [], 'a switch on the screen does not equal the declaration it was '
      + 'derived from. That is the whole claim this card makes');
  });
}

/* ══ 4. EVERY TOOL ARGUMENT, AGAINST ITS OWN JSON SCHEMA ═══════════════════ */

/**
 * **The tool table, held against `tools/list`'s own schema.**
 *
 * `cli-help.test.ts` compares the argument NAMES. Everything a reader actually
 * reads — whether it is required, what may go in it, and what it means — was
 * compared with nothing, and the "what it does" column is where that showed:
 * **21 of the 109 argument rows drew an EMPTY cell**, because their schema
 * declares no `description`.
 *
 * A CLI flag in that state is a hard refusal (`flagView` throws), and the reason
 * stated there applies here word for word: *"an undeclared flag would reach a
 * reader as a row with an empty explanation — which is the state this page
 * exists to end."* The tool half had no such gate.
 *
 * It is NOT repaired by writing 21 descriptions into `src/mcp/tools.ts`. Those
 * strings are what the MODEL is sent, and that file's rule is deliberate and
 * restated at each one — *"the description says the one thing a caller cannot
 * infer from the name"*. `get_item`'s `id` is not under-documented for a model;
 * it is under-documented for a reader of a column headed "what it does". So the
 * repair is on the card, where the absence is NAMED as measured, exactly as
 * `LoadMyContext`'s missing hint is.
 */
for (const lang of LANGS) {
  test(`every tool argument row equals its schema, and a missing description is named — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    const blank: string[] = [];
    let counted = 0;
    for (const tool of toolDefinitions()) {
      const pane = await open(card, 'tool', tool.name);
      const schema = tool.inputSchema;
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
      const names = Object.keys(properties);
      const said = flat([pane]).map((n) => textOf(n));

      // §1 is the tool's own description, verbatim.
      if (!said.includes(tool.description)) {
        wrong.push(`${tool.name}: the schema's description is not on the card`);
      }

      const drawn = drawnRows(pane);
      if (names.length === 0) {
        if (drawn.length !== 0) wrong.push(`${tool.name}: drew a table for a tool with no arguments`);
        // The absence is a SENTENCE, not a blank section.
        if (!said.includes(card.say('clih.noargs'))) {
          wrong.push(`${tool.name}: takes no argument and the card does not say so`);
        }
        continue;
      }
      if (drawn.length !== names.length) {
        wrong.push(`${tool.name}: drew ${drawn.length} rows for ${names.length} arguments`);
        continue;
      }
      for (const [i, argument] of names.entries()) {
        const got = drawn[i] as DrawnRow;
        const detail = properties[argument] ?? {};
        counted += 1;
        const wantName = required.includes(argument)
          ? `${argument} ${card.say('clih.req')}`
          : argument;
        if (got.name !== wantName) {
          wrong.push(`${tool.name}.${argument}: drew ${JSON.stringify(got.name)}, schema says ${JSON.stringify(wantName)}`);
        }
        const takes = Array.isArray(detail.enum) && detail.enum.length > 0
          ? card.say('clih.oneof') + detail.enum.map(String).join(', ')
          : (typeof detail.type === 'string' ? detail.type : '—');
        if (got.takes !== takes) {
          wrong.push(`${tool.name}.${argument} takes: ${JSON.stringify(got.takes.slice(0, 60))} != ${JSON.stringify(takes.slice(0, 60))}`);
        }
        const note = typeof detail.description === 'string' ? detail.description : '';
        if (note !== '') {
          if (got.means !== note) {
            wrong.push(`${tool.name}.${argument} means: ${JSON.stringify(got.means.slice(0, 60))} != the schema's own sentence`);
          }
        } else if (got.means.trim() === '') {
          blank.push(`${tool.name}.${argument}`);
        } else if (got.means !== card.say('clih.argnodesc')) {
          wrong.push(`${tool.name}.${argument}: an undeclared description is drawn as ${JSON.stringify(got.means.slice(0, 60))} rather than as the measured absence`);
        }
      }
    }
    assert.ok(counted > 80, `only ${counted} argument rows compared`);
    assert.deepEqual(blank, [], 'these tool arguments render as a row with an EMPTY "what it '
      + 'does" cell. A CLI flag in this state is refused outright by `flagView`, for a reason '
      + 'that holds here word for word: a row with an empty explanation is the state this page '
      + 'exists to end. The schema is right to stay silent — those sentences are what the model '
      + 'is sent — so the CARD must name the absence instead of drawing a hole');
    assert.deepEqual(wrong, [], 'a tool argument on the screen does not equal its JSON Schema');
  });
}

/* ══ 5. EVERY SHORTCUT: ITS HINT, ITS CATEGORY, AND WHAT IT RUNS ═══════════ */

/**
 * The `argument-hint` of one committed command file, or null where it declares
 * none — parsed HERE rather than taken from `slashCommands()`, so a parse that
 * silently dropped the field cannot agree with itself.
 */
function hintOf(name: string): string | null {
  const source = readFileSync(path.join(REPO, 'commands', `${name}.md`), 'utf8')
    .replaceAll('\r\n', '\n');
  const front = /^---\n([\s\S]*?)\n---/.exec(source);
  if (front === null) return null;
  const line = /^argument-hint:[ \t]*(.*)$/m.exec(front[1] ?? '');
  if (line === null) return null;
  const raw = (line[1] ?? '').trim();
  const quoted = /^"(.*)"$/.exec(raw);
  const value = quoted === null ? raw : (quoted[1] ?? '').replaceAll('\\"', '"');
  return value === '' ? null : value;
}

/**
 * **The hint is drawn verbatim, and where there is none the card says WHICH
 * kind of none it is.**
 *
 * Owner review 2026-09-06: *"most if not all the slash commands does not shows
 * parameters like the cli commands does"*. They did not, and 90 of the 91 files
 * had declared it since they were generated.
 *
 * The one file with no hint is `LoadMyContext`, and its body says *"with no
 * arguments"* in as many words — so "Takes no argument." is a MEASUREMENT and
 * not an inference from an empty field. That sentence is asserted too, because
 * the day a second file loses its hint this card would start telling a reader a
 * shortcut takes nothing when nobody had written it down.
 */
for (const lang of LANGS) {
  test(`every shortcut draws its committed hint, and the one with none is measured — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    const hintless: string[] = [];
    for (const slash of slashCommands()) {
      const pane = await open(card, 'slash', slash.name);
      const said = flat([pane]).map((n) => textOf(n));
      const hint = hintOf(slash.name);
      if (hint === null) {
        hintless.push(slash.name);
        if (!said.includes(card.say('clih.slashnoargs'))) {
          wrong.push(`${slash.name}: no hint, and the card does not say it takes none`);
        }
        continue;
      }
      if (!said.includes(`${card.say('clih.slashargs')} ${hint}`)) {
        wrong.push(`${slash.name}: the committed hint ${JSON.stringify(hint)} is not on the card`);
      }
      if (said.includes(card.say('clih.slashnoargs'))) {
        wrong.push(`${slash.name}: declares a hint and the card also says it takes none`);
      }
    }
    assert.deepEqual(wrong, [], 'a shortcut\'s parameters on the card are not the ones its own '
      + 'committed file declares');
    assert.deepEqual(hintless, ['LoadMyContext'], 'the set of shortcuts drawn as "takes no '
      + 'argument" must be exactly the set that genuinely takes none. A file that merely lost '
      + 'its `argument-hint` would be drawn identically, and that conflation is the one '
      + 'distinction this section exists to preserve');
    assert.match(
      readFileSync(path.join(REPO, 'commands', 'LoadMyContext.md'), 'utf8'), /with no arguments/,
      'the one shortcut the card tells a reader takes nothing must SAY so in its own file — '
      + 'otherwise the card is inferring "takes none" from "nobody wrote it down"',
    );
  });
}

/**
 * **The category a shortcut's name carries, in the category's own words.**
 *
 * `plan:library seq:3`. Nothing here is authored: the sentence is
 * `config.categories[x].description`, resolved against THIS project's config,
 * and the specimen is what `mycontext examples <category> --short` prints. So
 * the comparison is against the config, not against the endpoint's copy of it.
 */
for (const lang of LANGS) {
  test(`every add- and list- shortcut draws its category's own description — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    let drawn = 0;
    // Every description this project's config declares. A shortcut whose name
    // carries no category must draw NONE of them — which is a stronger negative
    // than looking for the absence of a label, because it would catch a
    // description attached to the wrong shortcut as well as one invented here.
    const everyDescription = Object.values(ws.config.categories).map((c) => c.description);
    for (const slash of slashCommands()) {
      const prefix = slash.name.startsWith('add-') ? 'add-'
        : slash.name.startsWith('list-') ? 'list-' : null;
      const wanted = prefix === null ? '' : slash.name.slice(prefix.length).replaceAll('-', '_');
      const texts = flat([await open(card, 'slash', slash.name)]).map((n) => textOf(n));
      if (prefix === null || !Object.hasOwn(ws.config.categories, wanted)) {
        const leaked = everyDescription.filter((d) => texts.some((t) => t.includes(d)));
        if (leaked.length > 0) {
          wrong.push(`${slash.name}: drew a category description for a name that carries none`);
        }
        continue;
      }
      const category = ws.config.categories[wanted];
      drawn += 1;
      const sentence = `${card.say('clih.catwhat', { name: category.name })} ${category.description}`;
      if (!texts.includes(sentence)) {
        wrong.push(`${slash.name}: the ${category.name} description on the card is not this project's`);
      }
    }
    assert.ok(drawn > 40, `only ${drawn} shortcuts carried a category — the walk measures nothing`);
    assert.deepEqual(wrong, [], 'the sentence that tells a reader what a category IS must be the '
      + 'category\'s own, resolved from this project\'s config — 29 hand-written ones are the '
      + 'drift this project measures in days');
  });
}

/**
 * **Every cross-reference resolves, and following one MOVES THE PICKER.**
 *
 * The reference is derived from the invocations inside the shortcut's own file,
 * so it cannot drift from what the shortcut runs — but a link pointing at a
 * subject the picker does not offer would silently do nothing, and a link that
 * repainted the pane without moving the select would leave the control and the
 * card disagreeing about which subject is on screen.
 */
for (const lang of LANGS) {
  test(`every cross-reference is a subject the picker offers, and following one moves it — ${lang}`, async () => {
    const card = await openCard(lang);
    const offered = new Set(roster().map((s) => `${s.kind}/${s.id}`));
    const wrong: string[] = [];
    let links = 0;
    for (const slash of slashCommands()) {
      const pane = await open(card, 'slash', slash.name);
      const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'slash', id: slash.name }).body as
        { runs: { kind: string; id: string; label: string }[] };
      const drawn = flat([pane]).filter((n) => n.tag === 'button' && hasClass(n, 'crumb'));
      assert.ok(body.runs.length > 0, `${slash.name} names no subject it runs`);
      if (drawn.length !== body.runs.length) {
        wrong.push(`${slash.name}: ${drawn.length} links for ${body.runs.length} targets`);
        continue;
      }
      for (const [i, run] of body.runs.entries()) {
        links += 1;
        if (textOf(drawn[i] as FakeNode) !== run.label) {
          wrong.push(`${slash.name} link ${i}: ${textOf(drawn[i] as FakeNode)} != ${run.label}`);
        }
        if (!offered.has(`${run.kind}/${run.id}`)) {
          wrong.push(`${slash.name} link ${i}: ${run.kind}/${run.id} is not a subject the picker offers`);
        }
      }
    }
    assert.ok(links > 100, `only ${links} cross-references walked`);
    assert.deepEqual(wrong, [], 'a cross-reference does not name a subject this card serves');

    // And one, followed: the picker moves with the pane.
    const pane = await open(card, 'slash', 'discard');
    const link = flat([pane]).find((n) => n.tag === 'button' && hasClass(n, 'crumb'));
    assert.ok(link, '/mycontext:discard drew no cross-reference');
    await withDocument(() => { link.dispatchEvent({ type: 'click' }); });
    assert.equal(card.select.value, 'command/review',
      'following a link must move the picker rather than paint the pane behind its back — the '
      + 'select is the address of this card');
    assert.equal(textOf(flat([card.pane]).find((n) => n.tag === 'h3') as FakeNode), 'mycontext review',
      'and the pane must be showing what the picker now says it is showing');
  });
}

/* ══ 6. A TOPIC IS RENDERED AS A DOCUMENT, NOT PRINTED AS ONE ══════════════ */

/**
 * **The `##` defect, held shut.**
 *
 * A help topic drew `##` where a heading belonged, because it was a
 * `<pre class="m transcript">` over a source that is Markdown — correct output
 * of the wrong thing, which a render test passes every time. So this asserts
 * the two halves that failure had: every ATX heading in the SOURCE became a
 * heading ELEMENT on the card, and no `#` marker survives into the text a
 * reader sees.
 *
 * The source is `helpTopic`'s own output, re-derived here — the same string the
 * terminal prints — so this is a comparison against the derivation and not
 * against the endpoint's copy of it.
 */
for (const lang of LANGS) {
  test(`every help topic is rendered as a document, headings and all — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    for (const topic of MCP_HELP_TOPICS) {
      const pane = await open(card, 'topic', topic);
      const source = helpTopic(topic, ws.config);
      const body = flat([pane]).find((n) => hasClass(n, 'topicbody'));
      if (body === undefined) { wrong.push(`${topic}: no topic body`); continue; }
      assert.ok(hasClass(body, 'md'),
        `${topic} must wear the console's own body-text class, so a topic reads like an item body`);

      // Every `#`-led line in the source, outside a fenced block, is a heading
      // the reader must SEE as one.
      const headings: string[] = [];
      let fenced = false;
      for (const line of source.split('\n')) {
        if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
        if (fenced) continue;
        const atx = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
        if (atx !== null) headings.push(atx[2] ?? '');
      }
      assert.ok(headings.length > 0, `${topic} has no headings at all — this check measures nothing`);
      const drawn = flat([body]).filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => textOf(n));
      if (drawn.length !== headings.length) {
        wrong.push(`${topic}: ${headings.length} headings in the source, ${drawn.length} drawn as headings`);
      }
      // Compared with the inline markers taken off BOTH sides: `### \`constraint\``
      // is a heading whose text is `constraint`, and a renderer that draws the
      // backticks would be the same defect one level down.
      const missing = headings.map(plain).filter((h) => !drawn.map(plain).includes(h));
      if (missing.length > 0) {
        wrong.push(`${topic}: ${missing.length} heading(s) not drawn as headings — ${missing.slice(0, 3).join(' | ')}`);
      }

      // And no BLOCK of the document is a heading line printed as prose, which
      // is what the `<pre>` did: `## Tools` arriving as a paragraph rather than
      // as an `h2`. Prose that mentions `##` inside a sentence is untouched by
      // this — `capture` names the marker in a list item on purpose.
      const source_lines = new Set(source.split('\n').map((l) => l.trim()));
      const printed = flat([body])
        .filter((n) => n.tag === 'p' || n.tag === 'pre')
        .map((n) => textOf(n).split('\n')[0]?.trim() ?? '')
        .filter((first) => /^#{1,6}\s/.test(first) && source_lines.has(first));
      if (printed.length > 0) wrong.push(`${topic}: drew the heading line ${JSON.stringify(printed[0])} as prose`);
    }
    assert.deepEqual(wrong, [], 'a topic is being printed rather than rendered. This shipped '
      + 'once already: correct output of the wrong thing, which every render test passes');
  });
}

/* ══ 7. THE CARD'S OWN PROSE, RE-DERIVED ═══════════════════════════════════
 *
 * The third defect of that day was a COUNT INSIDE A SENTENCE that nothing read.
 * This card prints five figures and makes three countable claims about itself,
 * and not one of the three had a test. Each is derived here from the record the
 * sentence is about, in both languages — a Hebrew sentence still saying "the
 * only one" after English was corrected is the same defect in a different
 * alphabet.                                                                 */

for (const lang of LANGS) {
  test(`the counts the card prints are the endpoint's, and its claims about itself hold — ${lang}`, async () => {
    const card = await openCard(lang);
    const index = apiCliHelp(ws).body as {
      counts: Record<string, number>; flagRows: number; withheld: { topics: string[] };
    };
    const said = flat([card.root]).map((n) => textOf(n));
    assert.ok(
      said.includes(card.say('clih.counts', {
        commands: index.counts.command, slash: index.counts.slash,
        tools: index.counts.tool, topics: index.counts.topic, flags: index.flagRows,
      })),
      'the headline figures on the card must be the endpoint\'s five, measured on the request',
    );

    // "One help topic is missing on purpose" — and exactly one is.
    assert.equal(index.withheld.topics.length, 1,
      'the withholding sentence says ONE topic is missing on purpose. A second withheld topic '
      + 'makes that sentence false and nothing else on this screen would notice');

    // "This is the one command whose switches are decided by your project."
    const dynamic = roster().filter((s) => s.kind === 'command')
      .filter((s) => (apiCliHelpSubject(ws, NO_PARAMS, { kind: 'command', id: s.id }).body as
        { surface: string }).surface === 'dynamic');
    assert.deepEqual(dynamic.map((s) => s.id), ['edit'],
      'the dynamic-surface sentence claims to be about THE ONE command whose flags a project '
      + 'decides. A second one makes that sentence a lie in both languages');

    // "It is the only command file that allows it."
    const invocable = slashCommands().filter((c) => c.modelInvocable).map((c) => c.name);
    assert.equal(invocable.length, 1,
      `the card tells a reader this is the ONLY command file Claude may run itself, and ${invocable.length} `
      + `are: ${invocable.join(', ')}. That is the "still covers all 41" defect — a count inside `
      + 'a sentence that nothing reads');
    const pane = await open(card, 'slash', invocable[0] as string);
    assert.ok(flat([pane]).map((n) => textOf(n)).includes(card.say('clih.slashmodel')),
      'and the one that is model-invocable must be the one drawn as such');
  });
}

/* ══ 8. THE COMPOSED LINE, AND WHAT IT LEFT OFF ════════════════════════════ */

/**
 * The line a reader COPIES is the endpoint's own string, every flag left off is
 * named with a reason that names something, and every command line carries its
 * own direction.
 *
 * `cli-help.test.ts` already puts every composed line through the CLI's parser.
 * What it cannot see is the drawing: an `omitted` entry whose `with` was empty
 * renders "— already fills that slot." with nothing before it, which is a
 * reason that explains nothing; and an `.excmd` without `dir` opens at its right
 * edge under RTL and shows a Hebrew reader the tail of the line instead of the
 * command's own name.
 */
for (const lang of LANGS) {
  test(`the composed line drawn is the endpoint's own, and every omission names its cause — ${lang}`, async () => {
    const card = await openCard(lang);
    const wrong: string[] = [];
    let lines = 0;
    let omissions = 0;
    for (const subject of roster().filter((s) => s.kind === 'command')) {
      const pane = await open(card, subject.kind, subject.id);
      const body = apiCliHelpSubject(ws, NO_PARAMS, { kind: 'command', id: subject.id }).body as
        { worked: { command: string; ok: boolean; omitted: { flag: string; with?: string }[] }[] };
      const drawn = flat([pane]).filter((n) => n.tag === 'p' && hasClass(n, 'excmd'));
      const texts = drawn.map((n) => textOf(n));
      for (const line of body.worked) {
        lines += 1;
        if (!line.ok) { wrong.push(`${subject.id}: the endpoint served a refused line`); continue; }
        if (!texts.includes(line.command)) {
          wrong.push(`${subject.id}: the composed line is not on the card`);
        }
        for (const off of line.omitted) {
          omissions += 1;
          if (off.with !== undefined && off.with.trim() === '') {
            wrong.push(`${subject.id} --${off.flag}: an omission reason with nothing named in it`);
          }
        }
      }
      for (const node of drawn) {
        if (node.dir !== 'ltr') wrong.push(`${subject.id}: a command line with no direction of its own`);
      }
      for (const item of flat([pane]).filter((n) => n.tag === 'li')) {
        if (textOf(item).trim().endsWith('—')) {
          wrong.push(`${subject.id}: an omission drawn with a dash and no reason after it`);
        }
      }
    }
    assert.ok(lines > 50 && omissions > 10, `${lines} lines and ${omissions} omissions walked`);
    assert.deepEqual(wrong, [], 'the line a reader copies is not the line the endpoint composed '
      + 'and put through the CLI\'s own parser');
  });
}
