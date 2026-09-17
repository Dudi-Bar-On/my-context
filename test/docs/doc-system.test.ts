// @basis TASK-extend-the-documentation-test-family-to-hold-the-new DEC-the-documentation-system-is-hand-built-over-a-wide-glob STD-documentation-is-regenerated-not-edited-to-match TASK-ten-thousand-lines-of-documentation-are-held-by-one-gate RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number INV-nothing-is-dropped-silently RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * The documentation SYSTEM's gates over `docs/` itself: the manifest, the
 * heading index, the CLI-versus-UI coverage table, and — added 2026-09-17 by
 * `rulings/111` — fence identity across copies and the `file.ts:N` citations.
 *
 * ── WHAT `rulings/111` ADDED, AND WHY HERE ────────────────────────────────
 *
 * Two mechanical gates over the twenty-five reference chapters, in sections 4
 * and 5 below. Each carries its own header, its own red proof and its own
 * statement of what it cannot see; this note says only why they landed in this
 * file rather than in a new one.
 *
 * **`counts.test.ts` holds BOTH READMEs to the number of `*.test.ts` files in
 * this directory** — thirteen, stated in §8 of each — so a fourteenth file is
 * an edit to `README.md` AND to `docs/README.he.md` in the same change. A lane
 * was embedding screenshots into `docs/**` while this was written and this lane
 * was told to write nothing there, so a new file was not available: it would
 * have forced either a conflicting write or a knowingly red `counts.test.ts`.
 * **Stated rather than quietly done**, because the previous lane extended an
 * existing file for the same reason and left no note, and a second unexplained
 * extension reads as a habit instead of a constraint.
 *
 * The fit is real and not only convenient: this file is already the one that
 * holds `docs/` itself — the manifest, the heading index, the generated
 * coverage table — where `parity.test.ts` and `system-parity.test.ts` hold a
 * document against its Hebrew mirror and `counts.test.ts` holds the READMEs'
 * prose numbers. Both new gates read across DOCUMENTS, which is this file's
 * subject.
 *
 * **They do not duplicate the two parity gates and were written against them.**
 * Those compare heading sequence, diagram structure and pasted-block identity
 * ACROSS A LANGUAGE PAIR. These ask something else: whether a document's claims
 * still resolve — a fence that two documents share in the SAME language, and a
 * `file.ts:N` pointer against the file it names.
 *
 * `TASK-extend-the-documentation-test-family-to-hold-the-new`
 * (`plan:docsys seq:8`), which asks for three tests in this family's own shape
 * — `inventory.test.ts`'s two-direction inventory, `counts.test.ts`'s derived
 * numbers, `parity.test.ts`'s regenerate-and-diff — applied to documents
 * instead of to the two READMEs' prose. It extends that family and replaces
 * nothing in it.
 *
 * **ONE TEST HERE WAS COMMITTED DELIBERATELY RED, and is green today** — the
 * heading index, repaired since. The paragraph below is kept as the record of
 * why it landed red rather than deleted as stale, because the practice it
 * describes is the file's own convention and the next red one will be written
 * the same way. Read it in the past tense. Exactly as
 * `inventory.test.ts`'s own header records doing between Tasks 4 and 6 of the
 * original documentation plan, and as `docsys/8` instructs: "each test should
 * be committed deliberately red where the corresponding feature is not yet
 * built … a failure list that IS the remaining work, not a surprise
 * regression." The red one is the heading index, and what it found is a real
 * defect in the shipped manifest rather than a missing feature — see its own
 * banner below for the cause, the file, and the fix.
 *
 * **What the boundary is.** `DEC-the-documentation-system-is-hand-built-over-a-wide-glob`
 * (2026-09-05) settled the open question `docs/superpowers/specs/2026-09-05-documentation-screen-design.md`
 * flagged: the manifest is the WIDE glob — every `.md` under `docs/` and
 * `reports/`, plus `README.md` — not `watchedDocs` alone. `docsys/8`'s first
 * test was written before that ruling and asks for `watchedDocs`; the ruling
 * widened the set rather than replacing the question, so both halves are
 * checked here: everything `watchedDocs` names is reachable, AND nothing in
 * the manifest falls outside what the ruling admits.
 *
 * **What this file does NOT check**, stated so a green run is not read as more
 * than it is: whether any document's PROSE is true, and whether a Hebrew
 * mirror says what its English counterpart says. Those remain human review
 * obligations, exactly as `STD-documentation-is-regenerated-not-edited-to-match`
 * already states of the four gates that came before these.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { runCli } from '../../src/cli/index.ts';
import { matchesAnyGlob } from '../../src/core/paths.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import {
  DECLARED, deriveCliUiCoverage, routeLabel, routeNamesCommand,
} from '../../src/core/cli-ui-coverage.ts';
import { apiDoc, apiDocList, type DocBody, type DocListBody } from '../../src/ui/read-model.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { matchRoute, registeredRoutes } from '../../src/ui/routes.ts';
import {
  COVERAGE_DOC_PATH, renderCoverageDocument,
} from '../../scripts/gen-cli-ui-coverage.ts';
import { documentsUnder, fencesIn } from '../../scripts/check-diagrams-parse.ts';
import { SOURCE_ROOTS, walkSources } from '../../scripts/check-cited-items.ts';
import { headings } from '../helpers/markdown.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** This repository is a my_context workspace and dogfoods itself, so the
 * manifest under test is the real one — the same property
 * `test/ui/doc-endpoint.test.ts` relies on, and the reason a fixture copy
 * would be worth less: a copy cannot go stale in the way this is meant to
 * catch. */
const ws = resolveWorkspace(REPO);

const listUrl = new URL('http://127.0.0.1/api/doc');
const oneUrl = new URL('http://127.0.0.1/api/doc/x');

function manifest(): DocListBody {
  const result = apiDocList(ws, listUrl);
  assert.equal(result.status, 200, 'GET /api/doc did not answer 200 against this repository');
  return result.body as DocListBody;
}

/** Every `.md` file under `dir`, repo-relative with forward slashes. */
function markdownUnder(dir: string): string[] {
  return readdirSync(path.join(REPO, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.relative(REPO, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
}

/* ---------------------------------------------------------------------------
 * 1 · Manifest reachability, in both directions.
 * ------------------------------------------------------------------------- */

/**
 * The `inventory.test.ts` shape — "every CLI command is named in README.md,
 * and README.md names no CLI command that does not exist" — applied to
 * documents: every document the ruling admits is in the manifest, and the
 * manifest holds nothing the ruling does not admit.
 *
 * Both halves are derived by walking the filesystem here, independently of the
 * walk `buildDocManifest` does. A test that asked the manifest builder what it
 * had globbed would agree with itself no matter what it globbed.
 */
test('the manifest holds exactly the documents the wide-glob ruling admits', () => {
  const ids = new Set(manifest().documents.map((d) => d.id));
  assert.ok(ids.size > 50, `only ${ids.size} documents reached the manifest — the walk is broken`);

  const onDisk = [...markdownUnder('docs'), ...markdownUnder('reports'), 'README.md'];
  const missing = onDisk.filter((f) => !ids.has(f));
  assert.deepEqual(
    missing, [],
    `these Markdown files exist under the ruled glob but no /api/doc entry names them: ` +
    `${missing.join(', ')}. The ruling is ` +
    'DEC-the-documentation-system-is-hand-built-over-a-wide-glob: every .md under docs/ and ' +
    'reports/, plus README.md.',
  );

  const outside = [...ids].filter((id) => !onDisk.includes(id));
  assert.deepEqual(
    outside, [],
    `the manifest names document(s) the ruled glob does not admit: ${outside.join(', ')}`,
  );
});

/**
 * `docsys/8`'s own wording — "every document `watchedDocs` names resolves to a
 * reachable `GET /api/doc/:id` entry" — kept as its own assertion even though
 * the ruling above widened the set. `watchedDocs` is the list the hooks nudge
 * on, so a document this project WATCHES and cannot open in its own reader is
 * a specific, nameable defect, not merely a subset of the general one.
 */
test('every document watchedDocs names is in the manifest', () => {
  const watched = ws.config.watchedDocs;
  assert.ok(watched.length > 0, 'watchedDocs is empty — this assertion would check nothing');
  const ids = new Set(manifest().documents.map((d) => d.id));
  const covered = markdownUnder('docs').filter((f) => matchesAnyGlob(f, watched));
  assert.ok(
    covered.length > 0,
    `no file matched watchedDocs (${watched.join(', ')}) — the glob matcher is broken, not the corpus`,
  );
  const missing = covered.filter((f) => !ids.has(f));
  assert.deepEqual(missing, [], `watched but unreachable in the reader: ${missing.join(', ')}`);
});

/**
 * Reachability is TWO facts and they fail differently, so both are asserted.
 *
 * The first is routing: a document id carries slashes (`docs/README.he.md`),
 * and `/api/doc/:id` is a ONE-segment parameter. An id therefore only arrives
 * whole if the client percent-encodes it, and `matchRoute` only hands it back
 * whole because it `decodeURIComponent`s each parameter. This is checked for
 * every id in the manifest and costs no I/O.
 *
 * The second is the handler: `apiDoc` looks the id up and reads the file. That
 * is checked on a NAMED set rather than on all of them, and the reason is
 * measured: `apiDoc` rebuilds the whole manifest per call (deliberately — "a
 * manifest that is rebuilt every time is a manifest that can never itself go
 * stale"), so all 166 ids took 31.5s on this machine against 94ms for one. The
 * six below are the documents this system was built for plus the generated
 * one, and the property that makes the rest reachable — an id that round-trips
 * and a file that is readable — is asserted for every document above.
 */
test('every document id round-trips through GET /api/doc/:id', () => {
  registerReadRoutes();
  const documents = manifest().documents;
  for (const doc of documents) {
    const matched = matchRoute('GET', `/api/doc/${encodeURIComponent(doc.id)}`);
    assert.ok(matched !== null, `no route matches the id "${doc.id}" once encoded`);
    assert.equal(
      matched.params['id'], doc.id,
      `the router handed the handler "${matched.params['id']}" for the manifest id "${doc.id}"`,
    );
  }

  for (const id of [
    'README.md', 'docs/README.he.md', 'docs/TUTORIAL.md', 'docs/TUTORIAL-ADVANCED.md',
    COVERAGE_DOC_PATH, documents.map((d) => d.id).filter((i) => i.startsWith('reports/'))[0],
  ]) {
    const result = apiDoc(ws, oneUrl, { id });
    assert.equal(result.status, 200, `GET /api/doc/${id} answered ${result.status}`);
    const body = result.body as DocBody;
    assert.ok(body.markdown.length > 0, `GET /api/doc/${id} served an empty document`);
  }
});

/* ---------------------------------------------------------------------------
 * 2 · The heading index — COMMITTED RED.
 * ------------------------------------------------------------------------- */

/**
 * **THIS TEST IS RED ON PURPOSE, AND WHAT IT FOUND IS A REAL DEFECT.**
 *
 * `docHeadings` (`src/ui/read-model.ts`) toggles its fenced-block flag on ANY
 * fence line, so a NESTED fence closes the outer block in its model. README.md
 * quotes the extraction request inside a five-backtick fence, and that quoted
 * output contains a four-backtick fence around the sample document, whose
 * first line is `# Bookstore API PRD`. The manifest therefore indexes a
 * phantom section: 99 headings where the document has 98, a table-of-contents
 * entry that is quoted example output rather than a section, and a wrong
 * ordinal on every heading after it.
 *
 * The fix is one rule in `docHeadings`: a fence closes only when it is at
 * least as long as the fence that opened it, which is what
 * `test/helpers/markdown.ts`'s `fenceTracker` already does and why the two
 * disagree here. That file belongs to the lane that owns the manifest, so this
 * gate names the defect rather than reaching across to fix it.
 *
 * When it is fixed, this test goes green and stays the gate: the index a
 * reader navigates by must be the document's own sections, in the document's
 * own order, or the deep links `#/docs/:id/:anchor` promise land somewhere the
 * document does not have a section.
 */
test("README.md's heading index is the file's own ATX headings, in count and order", () => {
  const entry = manifest().documents.find((d) => d.id === 'README.md');
  assert.ok(entry !== undefined, 'README.md is not in the manifest at all');

  const own = headings(readFileSync(path.join(REPO, 'README.md'), 'utf8').replaceAll('\r\n', '\n'));
  assert.ok(own.length > 20, `only ${own.length} headings parsed out of README.md — the parser is broken`);

  const RED =
    'EXPECTED FAILURE until docHeadings (src/ui/read-model.ts) stops letting a NESTED fence ' +
    'close the outer one: README.md quotes a four-backtick block inside a five-backtick block, ' +
    'and the `# Bookstore API PRD` line inside it is indexed as a section of the README. ' +
    'Committed red on purpose (docsys/8); the difference below IS the remaining work.';

  assert.deepEqual(
    entry.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`),
    own.map((h) => `${'#'.repeat(h.depth)} ${h.text}`),
    `the manifest's index for README.md is not the document's own headings. ` +
    `Manifest: ${entry.headings.length}; document: ${own.length}. ${RED}`,
  );

  // Anchors are what a deep link carries, so a repeat makes two sections
  // reachable by one link and the second unreachable by any.
  const anchors = entry.headings.map((h) => h.anchor);
  assert.equal(
    new Set(anchors).size, anchors.length,
    'two headings in README.md mint the same anchor — a deep link to the second cannot exist',
  );
});

/* ---------------------------------------------------------------------------
 * 3 · CLI-versus-UI coverage — regenerated, never hand-edited.
 * ------------------------------------------------------------------------- */

/** The command surface as the program holds it: `COMMANDS` after `runCli`'s
 * module has registered everything, which is what importing `index.ts` above
 * does. */
function liveCommands(): { name: string; summary: string }[] {
  assert.ok(typeof runCli === 'function', 'runCli did not import — nothing registered');
  assert.ok(COMMANDS.size > 0, 'COMMANDS is empty — the registrations did not run');
  return [...COMMANDS.values()].map((c) => ({ name: c.name, summary: c.summary }));
}

function liveRoutes(): { method: string; path: string }[] {
  registerReadRoutes();
  return registeredRoutes();
}

/**
 * `parity.test.ts`'s shape, applied to the coverage table: the committed
 * document is compared against what the generator produces from the running
 * program right now. A hand-edited row — the exact defect `gen:docs` exists to
 * prevent — fails here with the regeneration command in the message.
 */
test('the CLI-versus-UI coverage document is generated, not written', () => {
  const committed = readFileSync(path.join(REPO, ...COVERAGE_DOC_PATH.split('/')), 'utf8')
    .replaceAll('\r\n', '\n');
  const rendered = renderCoverageDocument(liveCommands(), liveRoutes());
  assert.equal(
    committed, rendered,
    `${COVERAGE_DOC_PATH} is not what the generator produces from COMMANDS and the route ` +
    'table. Run `npm run gen:docs` — never edit the file. If a command or a route was added, ' +
    'that is exactly what this document is for.',
  );
});

/**
 * `docsys/7`'s own verification, in its own words: "a manually-added CLI
 * command with no UI equivalent is asserted to render as explicitly
 * uncovered, never silently absent from the table."
 *
 * Synthetic inputs rather than the real registry, because the claim is about
 * what the derivation does with a command it has never seen — a claim the real
 * registry cannot make, since every command in it is either covered or not by
 * accident of what exists today.
 */
test('a CLI command with no UI route is rendered as explicitly uncovered, never omitted', () => {
  const commands = [
    { name: 'decay', summary: 'items that have not been injected lately' },
    { name: 'frobnicate', summary: 'a command no route has ever heard of' },
  ];
  const routes = [{ method: 'GET', path: '/api/decay' }];
  const coverage = deriveCliUiCoverage(commands, routes, []);

  assert.deepEqual(
    coverage.rows.map((r) => r.command), ['decay', 'frobnicate'],
    'a command with no route fell out of the table instead of being named in it',
  );
  const frob = coverage.rows[1];
  assert.deepEqual(frob.routes, []);
  assert.equal(frob.basis, 'none');
  assert.match(frob.note, /CLI only/, 'the uncovered row must SAY it is uncovered');
  assert.equal(coverage.covered, 1);
  assert.equal(coverage.cliOnly, 1);

  const document = renderCoverageDocument(commands, routes);
  assert.match(
    document, /\| `mycontext frobnicate` \|.*CLI only \|/,
    'the uncovered command is missing from the rendered table',
  );

  // The other direction of the same question: a route no command names is
  // listed too, or the table would report a capability gap in one direction
  // only.
  const uiOnly = deriveCliUiCoverage(commands, [...routes, { method: 'GET', path: '/api/graph' }], []);
  assert.deepEqual(uiOnly.uiOnly, [{ method: 'GET', path: '/api/graph' }]);
});

/**
 * The drift guard on the one hand-made list this derivation has, in the shape
 * `test/plugin/commands.test.ts` holds `gen-commands.ts`'s `KEEP`: an entry
 * that names a command or a route which no longer exists is a stale
 * declaration, and an entry the name rule already finds is a second spelling
 * of the same fact. Both fail here rather than quietly printing a link to an
 * endpoint that does not answer.
 */
test('every declared CLI/UI equivalence names a live command and a live route', () => {
  const names = new Set(liveCommands().map((c) => c.name));
  const labels = new Set(liveRoutes().map(routeLabel));

  for (const entry of DECLARED) {
    assert.ok(
      names.has(entry.command),
      `DECLARED names "${entry.command}", which is not a registered command. Remove the entry ` +
      'or fix the name — src/core/cli-ui-coverage.ts.',
    );
    assert.ok(entry.routes.length > 0, `DECLARED entry "${entry.command}" declares no route`);
    for (const route of entry.routes) {
      assert.ok(
        labels.has(route),
        `DECLARED maps ${entry.command} to "${route}", which is not registered. The route was ` +
        'renamed or removed and the declaration was not.',
      );
    }
    const alreadyNamed = entry.routes.filter((r) => routeNamesCommand(entry.command, r.split(' ')[1]));
    assert.deepEqual(
      alreadyNamed, [],
      `DECLARED restates what the name rule already finds for "${entry.command}" ` +
      `(${alreadyNamed.join(', ')}) — delete the entry rather than keeping two spellings of it.`,
    );
    assert.ok(entry.why.length > 20, `DECLARED entry "${entry.command}" carries no reason`);
  }

  const declaredNames = DECLARED.map((d) => d.command);
  assert.equal(
    new Set(declaredNames).size, declaredNames.length,
    'a command is declared twice — the second entry is silently ignored',
  );
});

// ── 4. The same drawing in two or three documents, held byte-identical ──────

/**
 * **A prose claim that two fences are identical cannot survive, so the gate
 * owns it.**
 *
 * Five mermaid fences are written once and appear in two or three documents
 * each — `README.md` shares one with `docs/capabilities/01-items-and-corpus.md`,
 * one with `00-index.md`, one with BOTH `02-injection.md` and
 * `docs/system/07-focus.md`, one with `09-cli-and-mcp.md`, and one more with
 * `01-items-and-corpus.md`. The Hebrew edition mirrors them from
 * `docs/README.he.md`'s own fences rather than translating each twice, so the
 * five Hebrew copies form their own identity set alongside the English one.
 * **Ten sets, twenty-two copies** — counted by sweeping the documents on
 * 2026-09-17 rather than taken from the sentence that claims it.
 *
 * Until now the claim lived only in prose, and it has ROTTED THREE TIMES in
 * three spellings. The word "byte-identical" went false when `README.md` moved
 * underneath it. The provenance sentence that replaced it — *"All three counts
 * in that diagram are dated here rather than inside it, because the fence is
 * byte-identical to `README.md`'s own"* (`docs/capabilities/09-cli-and-mcp.md`)
 * — stayed TRUE as a sentence while the picture underneath it silently stopped
 * matching, which is the worse failure: a true-sounding claim standing over a
 * false one. A sentence cannot check itself. This can.
 *
 * ── HOW A COPY IS NAMED, AND WHY NOT BY ITS CONTENT ────────────────────────
 *
 * By the DOCUMENT and the HEADING it sits under, never by matching text. An
 * identity gate that located its copies by content would dissolve the moment
 * one of them drifted — the set would simply stop having two members and the
 * run would go green with nothing left to compare. That is the vacuity this
 * file's siblings keep refusing, and it is the whole reason the anchors below
 * are written out.
 *
 * `nth` is the fence's position within that heading's section, and it is stated
 * only where a section holds more than one: `docs/system/07-focus.md` §2 draws
 * the tier routes and then a second diagram below it. An ordinal is a weak
 * pointer — `TASK-ten-thousand-lines-of-documentation-are-held-by-one-gate`
 * names `linkStyle 3,4` as the shape that silently colours the wrong edges the
 * day something is inserted above it — so it is used here where it is LOUD
 * rather than silent: insert a fence above one of these and the bytes stop
 * matching and this test says so, with both files named.
 *
 * **What this does NOT check**, so a green run is not read wider than it is:
 * that either copy is CORRECT. Two identical wrong diagrams pass every
 * assertion here, and a reversed edge present in both is exactly the finding
 * `rulings/111` was filed from. Shape is `npm run check:diagrams`; truth is the
 * write-time discipline. This holds the one property neither of those can see —
 * that the copies have not drifted apart.
 */
interface Copy {
  /** Repo-relative, forward slashes. */
  file: string;
  /** The heading text exactly as written, without its `#` marker. */
  heading: string;
  /** 1-based position among the fences of that heading's own section. */
  nth?: number;
}

interface CopySet {
  /** What the drawing is, so a failure names something a reader can go and read. */
  name: string;
  copies: Copy[];
}

const FENCE_COPIES: CopySet[] = [
  {
    name: 'the loop an item exists to break',
    copies: [
      { file: 'README.md', heading: 'The cost you actually feel' },
      { file: 'docs/capabilities/01-items-and-corpus.md', heading: 'Items and the corpus' },
    ],
  },
  {
    name: 'the capture-to-corpus pipeline',
    copies: [
      { file: 'README.md', heading: '3. How it works, in three steps' },
      { file: 'docs/capabilities/00-index.md', heading: 'What my_context is' },
    ],
  },
  {
    name: 'the five injection tiers, as one decision per firing site',
    copies: [
      { file: 'README.md', heading: '4. When it comes back, and what' },
      { file: 'docs/capabilities/02-injection.md', heading: 'Where corpus injection actually runs' },
      {
        file: 'docs/system/07-focus.md',
        heading: '2. How it works, and why it cannot be explained without the injection budget',
        nth: 1,
      },
    ],
  },
  {
    name: 'the two surfaces over one corpus',
    copies: [
      { file: 'README.md', heading: '5. Using it' },
      {
        file: 'docs/capabilities/09-cli-and-mcp.md',
        heading: 'Chapter 9 — The CLI and the MCP server',
      },
    ],
  },
  {
    name: 'the draft-to-active lifecycle',
    copies: [
      { file: 'README.md', heading: 'Draft and active, and why review exists' },
      {
        file: 'docs/capabilities/01-items-and-corpus.md',
        heading: 'Frontmatter: the fields every item carries',
      },
    ],
  },
  {
    name: 'the loop an item exists to break (Hebrew)',
    copies: [
      { file: 'docs/README.he.md', heading: 'המחיר שאתה באמת מרגיש' },
      { file: 'docs/capabilities/01-items-and-corpus.he.md', heading: 'פריטים והקורפוס' },
    ],
  },
  {
    name: 'the capture-to-corpus pipeline (Hebrew)',
    copies: [
      { file: 'docs/README.he.md', heading: '3. איך זה עובד, בשלושה צעדים' },
      { file: 'docs/capabilities/00-index.he.md', heading: 'מה זו my_context' },
    ],
  },
  {
    name: 'the five injection tiers (Hebrew)',
    copies: [
      { file: 'docs/README.he.md', heading: '4. מתי זה חוזר, ומה' },
      { file: 'docs/capabilities/02-injection.he.md', heading: 'איפה הזרקת הקורפוס באמת רצה' },
      {
        file: 'docs/system/07-focus.he.md',
        heading: '2. איך זה עובד, ולמה אי אפשר להסביר את זה בלי תקציב ההזרקה',
        nth: 1,
      },
    ],
  },
  {
    name: 'the two surfaces over one corpus (Hebrew)',
    copies: [
      { file: 'docs/README.he.md', heading: '5. שימוש' },
      { file: 'docs/capabilities/09-cli-and-mcp.he.md', heading: 'פרק 9 — שורת הפקודה ושרת ה-MCP' },
    ],
  },
  {
    name: 'the draft-to-active lifecycle (Hebrew)',
    copies: [
      { file: 'docs/README.he.md', heading: 'טיוטה ופעיל, ולמה קיימת סקירה' },
      {
        file: 'docs/capabilities/01-items-and-corpus.he.md',
        heading: 'Frontmatter: השדות שכל פריט נושא',
      },
    ],
  },
];

/** Where a copy was found, or the reason it could not be. */
type Located =
  | { ok: true; source: string; line: number }
  | { ok: false; why: string };

/**
 * The one fence a `Copy` names, located by heading rather than by content.
 *
 * Every way of failing to find it is a finding, never a skip: a heading that was
 * renamed, a section that lost its diagram, a section that gained one. Each of
 * those is a deliberate edit somewhere, and a gate that shrugged at them would
 * be a gate that stops comparing without saying so.
 */
async function locateIn(copy: Copy, text: string): Promise<Located> {
  const all = headings(text);
  const matches = all.filter((h) => h.text === copy.heading);
  if (matches.length !== 1) {
    return {
      ok: false,
      why: `${copy.file} has ${matches.length} headings reading "${copy.heading}" — this claim `
        + 'names a section that is no longer there, or is there twice',
    };
  }
  const from = matches[0]!.line;
  const to = all.find((h) => h.line > from)?.line ?? Number.POSITIVE_INFINITY;
  const section = (await fencesIn(copy.file, text)).filter((f) => f.line > from && f.line < to);
  const nth = copy.nth ?? 1;
  if (section.length < nth) {
    return {
      ok: false,
      why: `${copy.file} section "${copy.heading}" holds ${section.length} mermaid fence(s), so `
        + `there is no #${nth} to compare`,
    };
  }
  if (copy.nth === undefined && section.length > 1) {
    return {
      ok: false,
      why: `${copy.file} section "${copy.heading}" now holds ${section.length} mermaid fences and `
        + 'this claim does not say which. Add `nth` in the change that added the diagram.',
    };
  }
  const fence = section[nth - 1]!;
  return { ok: true, source: fence.source, line: fence.line };
}

/**
 * The same lookup against the document on disk.
 *
 * Split from `locateIn` so the red proof below can drive the WHOLE path —
 * heading match, section bounds, fence extraction, then comparison — against
 * injected text rather than only the comparator at the end of it. A proof that
 * exercised the comparator alone would leave the part most likely to rot, the
 * anchor resolution, unproven.
 */
async function locate(copy: Copy): Promise<Located> {
  const text = readFileSync(path.join(REPO, ...copy.file.split('/')), 'utf8')
    .replaceAll('\r\n', '\n');
  return await locateIn(copy, text);
}

/**
 * The first place two copies stop being the same text, as a sentence a reader
 * can act on without opening either.
 *
 * Kept PURE and away from the filesystem for one reason: it is what the red
 * proof below drives. A comparison that could only be exercised by editing a
 * real document could not be shown to work without editing a real document.
 */
function firstDifference(a: string, b: string): string | null {
  if (a === b) return null;
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] === lb[i]) continue;
    if (la[i] === undefined) return `line ${i + 1}: the second copy has an extra line ${JSON.stringify(lb[i])}`;
    if (lb[i] === undefined) return `line ${i + 1}: the first copy has an extra line ${JSON.stringify(la[i])}`;
    return `line ${i + 1}: ${JSON.stringify(la[i])} vs ${JSON.stringify(lb[i])}`;
  }
  return 'the two differ in trailing content only';
}

/**
 * **THE RED PROOF, run on every single run**, the way `check:diagrams` runs its
 * own before it prints a number. This repository has already shipped one
 * harness that printed "baseline matches the pin" without ever running a test
 * (`19939273`); an identity gate that has never been shown to reject anything
 * is that same object wearing a different name.
 *
 * Three injuries, and they are the three shapes a copy actually drifts by: a
 * retyped byte inside an edge, a deleted line, and an appended one. Each is
 * applied to the REAL text of a REAL copy, in memory, and each must be caught.
 */
test('the fence-identity comparison rejects a drifted copy — the red proof', async () => {
  const located = await locate(FENCE_COPIES[0]!.copies[0]!);
  assert.ok(located.ok, located.ok ? '' : located.why);
  const real = located.source;
  assert.ok(real.includes('\n'), 'the red proof must run against a real multi-line diagram');
  const lines = real.split('\n');

  assert.equal(firstDifference(real, real), null, 'a copy must compare equal to itself');

  const retyped = real.replace('-->', '--> ');
  assert.notEqual(retyped, real, 'the red proof must actually change something');
  assert.notEqual(
    firstDifference(real, retyped), null,
    'a retyped byte inside an edge went unnoticed — the comparison is not comparing',
  );

  const shortened = lines.slice(0, -1).join('\n');
  assert.notEqual(
    firstDifference(real, shortened), null,
    'a deleted line went unnoticed — the comparison is not comparing',
  );

  assert.notEqual(
    firstDifference(real, `${real}\n  Z["an edge nobody drew"]`), null,
    'an appended line went unnoticed — the comparison is not comparing',
  );
});

/**
 * **THE SECOND RED PROOF, and the one that matters more**: the whole path,
 * against the real documents, with a byte injected into one copy.
 *
 * The comparator above is the easy half. What actually rots is the ANCHOR — a
 * renamed heading, a diagram inserted above the one this set names — and a
 * proof that never exercised `locateIn` would leave that half asserted only in
 * a comment. So this reads `README.md` as it stands, retypes one character
 * inside the shared fence, and requires the same comparison the green test runs
 * to name the difference. Nothing is written to any document.
 */
test('the whole path goes red when a real copy is edited — the second red proof', async () => {
  const set = FENCE_COPIES[0]!;
  const [a, b] = set.copies;
  const text = readFileSync(path.join(REPO, ...a!.file.split('/')), 'utf8')
    .replaceAll('\r\n', '\n');

  const clean = await locateIn(a!, text);
  const other = await locate(b!);
  assert.ok(clean.ok && other.ok, 'both copies must locate before the injury means anything');
  assert.equal(firstDifference(clean.source, other.source), null, 'the two must match before injury');

  // One character, inside the fence, in the shape a careless edit takes: a
  // label retyped in one document and not the other.
  const injured = text.replace(clean.source, clean.source.replace('The session ends', 'The session Ends'));
  assert.notEqual(injured, text, 'the injection must actually change the document text');
  const drifted = await locateIn(a!, injured);
  assert.ok(drifted.ok, drifted.ok ? '' : drifted.why);
  assert.notEqual(
    firstDifference(drifted.source, other.source), null,
    'a retyped label in one real copy was not caught — this gate proves nothing',
  );

  // And the anchor itself: rename the heading and the copy must be REPORTED
  // missing rather than silently skipped, which is how an identity set
  // evaporates.
  const renamed = text.replace(`# ${a!.heading}\n`, '# a heading nobody wrote\n');
  assert.notEqual(renamed, text, 'the heading rename must actually change the document text');
  const lost = await locateIn(a!, renamed);
  assert.equal(lost.ok, false, 'a renamed anchor must be reported, never skipped');
  assert.match((lost as { ok: false; why: string }).why, /0 headings reading/);
});

/**
 * **Anti-vacuity.** Ten sets, twenty-two copies, every one located. A rename
 * that took a set's anchors with it would otherwise leave this file asserting
 * nothing and reporting success.
 */
test('every fence copy this claim names is still where it says it is', async (t) => {
  let copies = 0;
  for (const set of FENCE_COPIES) {
    assert.ok(
      set.copies.length >= 2,
      `"${set.name}" names ${set.copies.length} copy — a set of one compares nothing`,
    );
    for (const copy of set.copies) {
      const found = await locate(copy);
      assert.ok(found.ok, found.ok ? '' : found.why);
      copies++;
    }
  }
  assert.equal(FENCE_COPIES.length, 10, 'ten identity sets were swept out of the documents on 2026-09-17');
  assert.equal(copies, 22, 'twenty-two copies were swept out of the documents on 2026-09-17');
  t.diagnostic(`fence copies: ${FENCE_COPIES.length} identity sets, ${copies} copies, all located`);
});

/**
 * The claim itself.
 *
 * Compared against the FIRST copy of each set rather than pairwise, so a set of
 * three reports two independent differences instead of one confusing chain.
 */
test('every copy of a shared fence is byte-identical to the first', async (t) => {
  let compared = 0;
  for (const set of FENCE_COPIES) {
    const located = await Promise.all(set.copies.map(locate));
    for (const l of located) assert.ok(l.ok, l.ok ? '' : l.why);
    const first = located[0] as { ok: true; source: string; line: number };
    for (let i = 1; i < located.length; i++) {
      const other = located[i] as { ok: true; source: string; line: number };
      const diff = firstDifference(first.source, other.source);
      assert.equal(
        diff, null,
        `"${set.name}" has drifted apart.\n`
        + `  ${set.copies[0]!.file}:${first.line}\n`
        + `  ${set.copies[i]!.file}:${other.line}\n`
        + `  ${diff}\n`
        + '  These are ONE drawing kept in two places on purpose. Bring them back into line; do '
        + 'not delete this claim, and do not re-point the anchors to make the comparison pass.',
      );
      compared++;
    }
  }
  t.diagnostic(
    `fence identity: ${compared} comparison(s) across ${FENCE_COPIES.length} sets. CHECKS bytes `
    + 'only — that two copies of one drawing still match. Does NOT check that either is correct, '
    + 'that either parses (npm run check:diagrams), or that a caption agrees with its picture.',
  );
});

// ── 5. Every `file.ts:N` in the documents, resolved against the file ────────

/**
 * **A citation resolver over the documents, rebuilt as a gate.**
 *
 * One lane built this as a THROWAWAY during the 2026-09-17 repair pass, found
 * NINE unlisted errors with it, and then discarded it — so the nine were fixed
 * and the instrument that found them was not kept. `rulings/111` exists partly
 * because of that: the documents carry 398 `file.ts:N` pointers and the only
 * thing that had ever resolved one was a script that no longer exists.
 *
 * `scripts/verify-citations.ts` is the instrument for the OTHER notation — the
 * `` `file` · `fragment` · ~line `` form, whose identity is a verbatim fragment
 * and whose line is a hint. These documents do not write that form. They write
 * a line number inside a code span, and its own header says why that is the
 * weaker claim: *"A refactor that moves code updates the hint and stays green.
 * A change that deletes or rewrites the cited code turns the citation red —
 * which is the failure you actually want surfaced, and the one a line number
 * cannot distinguish from a harmless shift."* This gate is deliberately not
 * pretending otherwise.
 *
 * ── WHAT "RESOLVES" MEANS HERE, DECIDED RATHER THAN ASSUMED ────────────────
 *
 * Two conditions, both mechanical:
 *
 *   1. **The token names exactly one file in the source tree.** A path is
 *      matched as written or as a SUFFIX, because the documents write
 *      `src/core/select.ts` and `screens/conversations.js` and `needs.ts` for
 *      the same kind of pointer, and all three are the author naming a file
 *      rather than three different notations. Measured: exact-path-only
 *      matching reports 21 of these as missing files, and every one of them is
 *      a real file written with a shorter path.
 *   2. **The line, or every line of the range, exists in that file.** A
 *      citation to line 2,600 of a 500-line file is drift with no second
 *      reading.
 *
 * **What it deliberately does NOT check: that the cited line still holds what
 * the sentence says it holds.** A line number survives an edit that changes
 * every character on the line, and no mechanical rule can tell a moved citation
 * from a stale one without the fragment that `verify-citations.ts`'s notation
 * carries and this one does not. Naming that here rather than only in a report
 * is the point: a reader who sees this green must not conclude the documents'
 * line citations are verified. They are RESOLVABLE. `rulings/111` ruled the
 * stronger reading out by name — *"Do not build a gate that re-reads the prose
 * for truth"* — because four reading passes measured 2.0–2.1% wrong claims
 * against 15 introduced per repair.
 *
 * ── WHERE IT LOOKS, AND THE ONE PLACE IT REFUSES TO ────────────────────────
 *
 * Code spans in prose, and mermaid fence bodies. The second is not an extra:
 * twelve of these citations live inside DIAGRAM LABELS, and the task names that
 * as its own blind spot — *"A cited `file.ts:N` inside a label is never
 * resolved against the file."*
 *
 * Every OTHER fenced block is skipped, and that is a correctness requirement
 * rather than a convenience. `docs/capabilities/07-restore-and-handover.md`
 * pastes seven lines of real `mycontext restore` output reading
 * `CARRIED  reports/V2-HANDOVER.md:395`. That is a dated transcript of what the
 * command printed; it is not the chapter claiming line 395 says anything today,
 * and a gate that reddened on frozen output would be asking a document to
 * falsify its own evidence.
 */

/** One `file.ts:N` pointer, and where the document wrote it. */
interface Citation {
  /** Repo-relative document, forward slashes. */
  doc: string;
  /** 1-based line in the document. */
  line: number;
  /** The pointer exactly as written. */
  raw: string;
  /** The path or path-suffix it names. */
  token: string;
  from: number;
  to: number;
  /** A code span in prose, or a label inside a mermaid fence. */
  where: 'prose' | 'diagram';
}

/**
 * **The one metasyntactic token in the documents, exempted by name.**
 *
 * `docs/capabilities/00-index.md` writes *"several corrections below replace a
 * `file.ts:123` reference with a symbol name"*. `file.ts` is the WORD for a
 * citation, not a citation — the same shape as `docs/system/06-ingest.md`
 * quoting an over-long item id *as the defect it is describing*, and neither
 * may be forced to be wrong by a gate.
 *
 * It is one entry and it is held to `verify-citations.ts`'s rule for its own
 * historical markers: **an exemption must excuse something.** The test below
 * fails if this token stops appearing, so a suppression cannot outlive the
 * thing it suppresses and quietly cover the next real break behind it.
 */
const PLACEHOLDER_TOKENS = new Set(['file.ts']);

/** A fence opener or closer, by the CommonMark rule `test/helpers/markdown.ts` states. */
const CITE_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(\S*)/;

/** A code span, of any backtick run length. */
const CODE_SPAN = /(`+)([^`]*?)\1/g;

/** `path.ts:12`, `a/b.js:12-14`, `c.ts:12–14` — the en dash is what the documents use. */
const CITE = /([A-Za-z0-9_./-]+\.(?:ts|js|mjs|cjs)):(\d+)(?:\s*[-–—]\s*(\d+))?/g;

/**
 * Every citation in one document.
 *
 * Exported shape rather than a one-off loop because the red proof drives it
 * against synthetic text: the fence discrimination above is the half most
 * likely to be wrong, and it is invisible in a green sweep.
 */
function citationsIn(doc: string, text: string): Citation[] {
  const out: Citation[] = [];
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  let open: string | null = null;
  let info = '';
  lines.forEach((line, i) => {
    const fence = CITE_FENCE.exec(line);
    let where: 'prose' | 'diagram' | null = null;
    if (open === null) {
      if (fence !== null) { open = fence[1]!; info = fence[2]!; }
      else where = 'prose';
    } else {
      if (info === 'mermaid') where = 'diagram';
      if (fence !== null && fence[1]![0] === open[0] && fence[1]!.length >= open.length && fence[2] === '') {
        open = null;
        info = '';
        // The closing fence line itself is a marker, never content.
        where = null;
      }
    }
    if (where === null) return;
    // In prose only the code spans are pointers; in a label the whole line is.
    const regions = where === 'prose'
      ? [...line.matchAll(CODE_SPAN)].map((m) => m[2]!)
      : [line];
    for (const region of regions) {
      for (const m of region.matchAll(CITE)) {
        const from = Number(m[2]);
        out.push({
          doc,
          line: i + 1,
          raw: m[0]!,
          token: m[1]!,
          from,
          to: m[3] === undefined ? from : Number(m[3]),
          where,
        });
      }
    }
  });
  return out;
}

/** One file of the tree a citation may point into. */
interface TreeFile { path: string; lines: number }

/** What resolving one citation produced. */
type Judgement =
  | { kind: 'resolved'; target: string }
  /** Several files answer to the token; at least one admits the line. */
  | { kind: 'weak'; candidates: string[] }
  | { kind: 'broken'; why: string };

/**
 * **The whole of the judgement, pure, over a tree passed in.**
 *
 * Pure because the red proof below needs a tree it can shape — a 10-line file
 * and a citation to line 40 is a case this repository does not contain today
 * and must still be caught. A resolver that could only be exercised against the
 * real tree could only be proved by breaking a real document.
 */
function judge(c: Citation, tree: TreeFile[]): Judgement {
  const candidates = tree.filter((f) => f.path === c.token || f.path.endsWith(`/${c.token}`));
  if (candidates.length === 0) {
    return { kind: 'broken', why: `no file in the source tree is named "${c.token}"` };
  }
  const fits = (f: TreeFile): boolean => c.from >= 1 && c.to >= c.from && c.to <= f.lines;
  if (candidates.length === 1) {
    const only = candidates[0]!;
    return fits(only)
      ? { kind: 'resolved', target: only.path }
      : { kind: 'broken', why: `${only.path} has ${only.lines} lines, so line ${c.to} is past its end` };
  }
  const admitting = candidates.filter(fits);
  if (admitting.length === 0) {
    return {
      kind: 'broken',
      why: `${candidates.length} files are named "${c.token}" and none of them has a line ${c.to} `
        + `(${candidates.map((f) => `${f.path}: ${f.lines}`).join(', ')})`,
    };
  }
  return { kind: 'weak', candidates: candidates.map((f) => f.path) };
}

/** The source tree a document citation may point into — the same four roots
 * `check-cited-items.ts` walks, read once for the whole file. */
const CITED_TREE: TreeFile[] = (() => {
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walkSources(path.join(REPO, root), files);
  return files.map((full) => ({
    path: path.relative(REPO, full).split(path.sep).join('/'),
    lines: readFileSync(full, 'utf8').replaceAll('\r\n', '\n').split('\n').length,
  }));
})();

/**
 * **THE RED PROOF, run on every single run.** Four shapes, against a tree built
 * for the purpose, because three of them do not exist in this repository today
 * and a gate is not trusted for catching only what it has already seen.
 */
test('the citation resolver refuses a pointer that stopped resolving — the red proof', () => {
  const tree: TreeFile[] = [
    { path: 'src/core/select.ts', lines: 100 },
    { path: 'src/cli/commands/config.ts', lines: 40 },
    { path: 'src/core/config.ts', lines: 900 },
  ];
  const cite = (raw: string): Citation => {
    const found = citationsIn('fixture.md', `a \`${raw}\` b`);
    assert.equal(found.length, 1, `the scanner did not read "${raw}" as one citation`);
    return found[0]!;
  };

  assert.deepEqual(judge(cite('select.ts:50'), tree), { kind: 'resolved', target: 'src/core/select.ts' });
  assert.deepEqual(
    judge(cite('src/core/select.ts:50'), tree), { kind: 'resolved', target: 'src/core/select.ts' },
    'a fully-qualified path must resolve the same way a suffix does',
  );

  const gone = judge(cite('src/core/vanished.ts:3'), tree);
  assert.equal(gone.kind, 'broken', 'a citation into a file that is not there must be refused');

  const past = judge(cite('select.ts:400'), tree);
  assert.equal(past.kind, 'broken', 'a citation past the end of the file must be refused');
  assert.match((past as { why: string }).why, /100 lines/);

  const pastRange = judge(cite('select.ts:98-140'), tree);
  assert.equal(pastRange.kind, 'broken', 'a RANGE running past the end must be refused');

  const nowhere = judge(cite('config.ts:5000'), tree);
  assert.equal(nowhere.kind, 'broken', 'an ambiguous token must still be refused when NO candidate fits');

  const weak = judge(cite('config.ts:30'), tree);
  assert.equal(weak.kind, 'weak', 'an ambiguous token that one candidate admits is weak, not broken');
  assert.deepEqual((weak as { candidates: string[] }).candidates, ['src/cli/commands/config.ts', 'src/core/config.ts']);
});

/**
 * **The scanner's own red proof**, which is the half a green sweep hides. Three
 * discriminations, each of which this repository would be wrong about if it
 * went the other way: a pointer in prose is read, a pointer in a mermaid LABEL
 * is read, and a pointer inside pasted command output is NOT.
 */
test('the citation scanner reads prose and diagram labels and refuses quoted output', () => {
  const doc = [
    'Prose naming `src/core/select.ts:1511–1518` inside a code span.',
    'Prose naming select.ts:9 with no code span, which is not a pointer.',
    '',
    '```mermaid',
    '  A["select.ts:1638<br/>the branch"] --> B',
    '```',
    '',
    '```text',
    'CARRIED  reports/V2-HANDOVER.md:395',
    'CARRIED  src/core/select.ts:12',
    '```',
  ].join('\n');
  const found = citationsIn('fixture.md', doc);
  assert.deepEqual(
    found.map((c) => `${c.where}:${c.raw}`),
    ['prose:src/core/select.ts:1511–1518', 'diagram:select.ts:1638'],
    'the scanner must read code spans and mermaid labels, and must not read pasted output',
  );
  assert.deepEqual([found[0]!.from, found[0]!.to], [1511, 1518], 'an en-dashed range must be read as a range');

  // Five-backtick example blocks hold three-backtick fences in both READMEs,
  // and a `/^```/` toggle flips on those. `test/helpers/markdown.ts` records
  // measuring that it stayed green by luck; this fails outright if it returns.
  const nested = ['`````text', '```mermaid', 'A["select.ts:1"] --> B', '```', '`````', '`select.ts:2`'].join('\n');
  assert.deepEqual(
    citationsIn('fixture.md', nested).map((c) => c.raw), ['select.ts:2'],
    'a mermaid fence nested inside a five-backtick example block is quoted text, not a diagram',
  );
});

/** **Anti-vacuity**: the tree read back, and the documents read back. */
test('the citation sweep reads a real tree and real documents', () => {
  assert.ok(CITED_TREE.length > 500, `expected the real source tree, walked ${CITED_TREE.length} file(s)`);
  assert.ok(
    CITED_TREE.some((f) => f.path === 'src/core/select.ts' && f.lines > 1000),
    'the tree must carry real line counts, not zeros',
  );
  const docs = documentsUnder(REPO);
  assert.ok(docs.length >= 40, `expected the swept documents, saw ${docs.length}`);
  const all = docs.flatMap((d) => citationsIn(d, readFileSync(path.join(REPO, ...d.split('/')), 'utf8')));
  assert.ok(all.length > 300, `expected hundreds of citations in the documents, read ${all.length}`);
  assert.ok(
    all.some((c) => c.where === 'diagram'),
    'the twelve citations inside mermaid labels are the blind spot this closes; none was read',
  );
});

/**
 * The gate.
 *
 * `weak` is reported and does not fail: six bare basenames — `config.ts`,
 * `mutate.ts`, `audit.ts`, `schema.ts`, `focus.ts` — name two or three files
 * each, and the honest answer is that the pointer is weaker than it looks, not
 * that it is broken. The repair is to write the path; nothing here forces it,
 * because forcing 23 edits to remove a warning is how a gate gets switched off.
 */
test('every citation in the documents resolves to a file and a line that exist', (t) => {
  const broken: string[] = [];
  const weak: string[] = [];
  const placeholders = new Set<string>();
  let resolved = 0;
  let diagrams = 0;

  for (const doc of documentsUnder(REPO)) {
    const text = readFileSync(path.join(REPO, ...doc.split('/')), 'utf8');
    for (const c of citationsIn(doc, text)) {
      if (c.where === 'diagram') diagrams++;
      if (PLACEHOLDER_TOKENS.has(c.token)) { placeholders.add(c.token); continue; }
      const verdict = judge(c, CITED_TREE);
      if (verdict.kind === 'resolved') resolved++;
      else if (verdict.kind === 'weak') {
        weak.push(`${c.token} → ${verdict.candidates.join(', ')}`);
      } else {
        broken.push(`${doc}:${c.line}  ${c.raw} — ${verdict.why}`);
      }
    }
  }

  // An exemption must excuse something, or it is a suppressor waiting for the
  // next real break to hide behind it — `verify-citations.ts`'s rule 1, applied
  // to the one placeholder this file admits.
  for (const token of PLACEHOLDER_TOKENS) {
    assert.ok(
      placeholders.has(token),
      `PLACEHOLDER_TOKENS still exempts "${token}" and no document writes it any more. Delete `
      + 'the entry rather than leaving a suppression with nothing under it.',
    );
  }

  assert.deepEqual(
    broken, [],
    `${broken.length} citation(s) in the documents no longer resolve:\n  ${broken.join('\n  ')}\n`
    + 'Repair the document, never this test. A pointer into a file that moved is the failure this '
    + 'gate exists to surface.',
  );

  assert.ok(resolved > 300, `expected hundreds of resolved citations, saw ${resolved}`);
  t.diagnostic(
    `document citations: ${resolved} resolved, ${weak.length} weak (a bare basename naming more `
    + `than one file), ${diagrams} read from inside mermaid labels. CHECKS that the file exists `
    + 'and the line exists. Does NOT check that the cited line still says what the sentence says '
    + 'it says — a line number cannot carry that claim, and `verify-citations.ts`\'s fragment '
    + 'notation is the instrument that can.',
  );
  // Grouped by TOKEN rather than by site: six bare basenames account for all
  // 23, and twenty-three near-identical lines on every run is how a diagnostic
  // stops being read.
  const byToken = new Map<string, number>();
  for (const w of weak) byToken.set(w, (byToken.get(w) ?? 0) + 1);
  for (const [w, n] of [...byToken].sort()) t.diagnostic(`  weak ×${n}: ${w} — write the path`);
});
