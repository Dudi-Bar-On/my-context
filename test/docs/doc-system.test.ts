/**
 * The documentation SYSTEM's three new gates: the manifest, the heading index
 * and the CLI-versus-UI coverage table.
 *
 * `TASK-extend-the-documentation-test-family-to-hold-the-new`
 * (`plan:docsys seq:8`), which asks for three tests in this family's own shape
 * — `inventory.test.ts`'s two-direction inventory, `counts.test.ts`'s derived
 * numbers, `parity.test.ts`'s regenerate-and-diff — applied to documents
 * instead of to the two READMEs' prose. It extends that family and replaces
 * nothing in it.
 *
 * **ONE TEST HERE IS COMMITTED DELIBERATELY RED**, exactly as
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
