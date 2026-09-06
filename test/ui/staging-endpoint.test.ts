/**
 * `GET /api/staging` — the read the write surface used to make impossible
 * (owner ruling `DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read`).
 *
 * **Two claims are worth testing here and everything else is scaffolding.**
 *
 *   1. **The split is real, and it is enforced rather than asserted.** The
 *      ruling's own words: *"split the read half into its own module that
 *      imports nothing which writes"*, and *"what must not happen: moving the
 *      write half instead, or re-exporting the read half from the module that
 *      writes"*. Both failure modes leave the import graph exactly as it was
 *      while the diff looks like a fix, so both are measured below — the graph
 *      by walking it, the re-export by reading `derive.ts`' own export list.
 *   2. **The endpoint says what it did not serve.** A picker is where a silent
 *      drop stops being a tidiness question: a `key` box that omits a lesson
 *      reads to the reader as *"nothing is staged for it"*, which is an absence
 *      wearing the costume of an answer.
 *
 * ── WHY THE WALK HERE IS NOT `command-check.test.ts`' WALK, EXACTLY ───────
 *
 * `test/ui/command-check.test.ts` is the precedent the ruling names, and its
 * walk is deliberately CRUDE: it follows every relative specifier, type-only
 * imports included. That over-approximation is free there, because its
 * forbidden set — `execute*.ts`, `src/cli/index.ts`, `node:child_process` — is
 * reached by no type-only path in this tree.
 *
 * It is NOT free here, and that was measured rather than assumed. This module's
 * crude graph is 45 files and DOES contain `core/mutate.ts`, by
 * `routes.ts` -> `import type { Workspace } from '../core/workspace.ts'` and on
 * through `core/content-hash.ts` -> `import type { CreateInput } from './mutate.ts'`.
 * Every edge on that path is `import type`, so under `verbatimModuleSyntax` +
 * `erasableSyntaxOnly` the WHOLE STATEMENT is erased and the module is never
 * loaded. A crude walk aimed at writers would therefore be red on day one for
 * the reason `no-writes.test.ts` names and refuses: guilt by co-location.
 *
 * So this file runs BOTH, each where it is sound:
 *
 *   - `crudeGraph` — every relative specifier, `command-check.test.ts`' own
 *     function, unchanged — for the process spawners. Over-approximating there
 *     can only make the gate stricter.
 *   - `runtimeGraph` — the erasure semantics `no-writes.test.ts` documents:
 *     `import type { X } from './m.ts'` is not an edge, `import { type X, y }`
 *     is — for the WRITERS. Anything looser would let a value import be
 *     laundered as a type; anything stricter fails on types that cost nothing.
 *
 * Both are proved able to FAIL, on modules that really do reach what is banned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { readStagingDir, stagingDir } from '../../src/lesson/staging.ts';
import { apiStaging, type StagingBody } from '../../src/ui/read-model-staging.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { sandbox } from '../helpers/workspace.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const rel = (f: string): string => path.relative(REPO, f).split(path.sep).join('/');

/* ── the two walks ───────────────────────────────────────────────────────── */

/** `command-check.test.ts` · `graphFrom`, verbatim. Type-only edges included. */
function crudeGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) {
      const spec = m[2];
      if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
      else bare.add(spec);
    }
  }
  return { files, bare };
}

/**
 * The same walk with erased statements dropped, so "reachable" means "LOADED
 * at runtime".
 *
 * `import type … from '…'` is skipped; a bare side-effect `import '…'` and a
 * dynamic `import('…')` are followed, because a change that wanted an escape
 * hatch would reach for exactly those.
 */
function runtimeGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  const push = (file: string, spec: string): void => {
    if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
    else bare.add(spec);
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*(['"])([^'"]+)\3/g)) {
      if (m[1] === undefined) push(file, m[4]);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*(['"])([^'"]+)\1/g)) push(file, m[2]);
    for (const m of source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)) push(file, m[2]);
  }
  return { files, bare };
}

const ENDPOINT = path.join(REPO, 'src', 'ui', 'read-model-staging.ts');
const READ_HALF = path.join(REPO, 'src', 'lesson', 'staging.ts');
const WRITE_HALF = path.join(REPO, 'src', 'lesson', 'derive.ts');

/**
 * The modules that WRITE, on the path this read used to be blocked by.
 * `core/mutate.ts` is the one the ruling names; `core/persist.ts` is what lies
 * behind it and is the code that actually puts item Markdown on disk, so a
 * split that stopped at the first name and let the second in would be no split.
 */
const FORBIDDEN_WRITERS = [
  'src/core/mutate.ts', 'src/core/persist.ts', 'src/core/store.ts', 'src/lesson/derive.ts',
];
/** `command-check.test.ts`' set, unchanged — this endpoint answers, it does not act. */
const FORBIDDEN_SPAWNERS = [
  'src/ui/execute.ts', 'src/ui/execute-catalogue.ts', 'src/ui/execute-effect.ts',
  'src/ui/execute-nonce.ts', 'src/cli/index.ts',
];
const FORBIDDEN_BARE = ['node:child_process', 'child_process'];

test('the read half loads nothing that writes, and nothing at all from this project', () => {
  const { files, bare } = runtimeGraph(READ_HALF);
  assert.deepEqual(
    [...files].map(rel), ['src/lesson/staging.ts'],
    'the read half of lesson staging has grown a project import. The whole point of this ' +
    'module is that it is ONE file with no project edge — that is what lets the read server ' +
    'import it. Whatever needed the import either belongs in `derive.ts` with the writes, or ' +
    'is a fact this module should be handed rather than fetch.',
  );
  assert.deepEqual(
    [...bare].sort(), ['node:fs', 'node:path'],
    'the read half imports something beyond node:fs and node:path',
  );
  // And the fs it does import is read-only: naming a mutating API here would
  // put this module back in `no-writes.test.ts`' derived writer set.
  const source = readFileSync(READ_HALF, 'utf8');
  const fsImport = /import\s*\{([^}]*)\}\s*from\s*'node:fs'/.exec(source);
  assert.ok(fsImport, 'the node:fs import is no longer a named-binding list this test can read');
  const bound = fsImport[1].split(',').map((s) => s.trim()).filter((s) => s !== '');
  assert.deepEqual(
    bound.sort(), ['existsSync', 'readFileSync', 'readdirSync'],
    'the read half binds an fs API it did not before. Every name here must be a READ — a ' +
    'write bound in this module makes it a writer by `no-writes.test.ts`\' own derivation, ' +
    'and the module the UI imports for its reads is the last place one may appear.',
  );
});

test('nothing the staging endpoint loads can write a corpus or start a process', () => {
  const { files } = runtimeGraph(ENDPOINT);
  const reachable = [...files].map(rel);

  // Anti-vacuity: a walk that resolved nothing would pass every assertion here.
  assert.ok(
    reachable.includes('src/lesson/staging.ts') && reachable.includes('src/ui/routes.ts'),
    `the walk reached ${reachable.join(', ')} — it must at least reach the two modules this ` +
    'endpoint plainly imports, or the specifier pattern has stopped matching and this test ' +
    'proves nothing.',
  );

  assert.deepEqual(
    FORBIDDEN_WRITERS.filter((m) => reachable.includes(m)), [],
    'the staging ENDPOINT now loads a module that writes. That is the one property the owner ' +
    'ruling asks to be structural rather than promised: `src/ui/read-model.ts` refused this ' +
    'read for years because `listStaging` sat beside `createItem`, and the split is worth ' +
    'nothing if the write surface walks back in behind it. Whatever needed this import ' +
    'belongs behind POST /api/execute, which has a nonce, a confirm and `runnable: true`.',
  );

  // The spawner half is the crude, over-approximating walk — `command-check.test.ts`'
  // own, so the two endpoints are held to one standard.
  const crude = crudeGraph(ENDPOINT);
  const crudeReachable = [...crude.files].map(rel);
  assert.deepEqual(
    FORBIDDEN_SPAWNERS.filter((m) => crudeReachable.includes(m)), [],
    'a module reachable from the staging endpoint can run a command. This endpoint answers, ' +
    'it does not act.',
  );
  assert.deepEqual(
    FORBIDDEN_BARE.filter((m) => crude.bare.has(m)), [],
    'a module reachable from the staging endpoint imports a process spawner — `read-model.ts` ' +
    'reaches one through `doctor/checks.ts`, which is exactly why this endpoint is its own ' +
    'module and spells its own `badRequest`.',
  );
});

/**
 * **Both walks are proved able to fail**, on modules that really do reach what
 * is banned — otherwise the assertions above are green for the wrong reason.
 *
 * The runtime walk is checked against `lesson/derive.ts`, the write half this
 * split was cut out of: it must still see `core/mutate.ts` there. The crude
 * walk is checked against `ui/execute.ts`, which holds this server's one
 * `execFile` — `command-check.test.ts`' own control.
 */
test('the detectors still fail on modules that really do write and really do spawn', () => {
  const writer = [...runtimeGraph(WRITE_HALF).files].map(rel);
  assert.ok(
    writer.includes('src/core/mutate.ts'),
    'the runtime walk no longer sees `core/mutate.ts` from `lesson/derive.ts`, which plainly ' +
    'value-imports `createItem` from it. The writer assertions above are passing for the ' +
    'wrong reason.',
  );
  const spawner = crudeGraph(path.join(REPO, 'src', 'ui', 'execute.ts'));
  assert.ok(
    FORBIDDEN_BARE.some((m) => spawner.bare.has(m)),
    'the crude walk no longer notices `node:child_process` in a module that plainly imports it',
  );
});

/**
 * **The other half of the ruling: the read half must not be re-exported from
 * the module that writes.**
 *
 * A `export { loadStaging } from './staging.ts'` in `derive.ts` would let every
 * caller keep its old import line and its old import graph, and the test above
 * would stay green because it only walks FORWARD from the read modules. That is
 * the ruling's second named failure mode, and this is the assertion that sees
 * it.
 */
test('the write half re-exports nothing from the read half', () => {
  const source = readFileSync(WRITE_HALF, 'utf8');
  const reexports = [...source.matchAll(/(?:^|\n)\s*export\s+(?:type\s+)?(?:\*|\{)[^;]*?from\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1]);
  assert.deepEqual(
    reexports, [],
    'lesson/derive.ts re-exports from another module. The owner ruling names this as one of ' +
    'the two ways the split can be faked: a caller importing the read half THROUGH the write ' +
    'half loads `core/mutate.ts` exactly as it always did, while the diff reads as a fix. ' +
    'Callers import `lesson/staging.ts` directly.',
  );
  // And the read half really is gone from here, rather than kept as a copy.
  for (const symbol of ['loadStaging', 'listStaging', 'readStagingDir', 'stagingDir']) {
    assert.ok(
      !new RegExp(`export\\s+function\\s+${symbol}\\b`).test(source),
      `lesson/derive.ts still exports ${symbol}. It moved to lesson/staging.ts; two copies is ` +
      'the same defect as a re-export with an extra maintenance cost.',
    );
  }
});

/* ── the endpoint ────────────────────────────────────────────────────────── */

test('/api/staging is registered, so a page can actually reach it', () => {
  registerReadRoutes();
  assert.ok(
    registeredRoutes().some((r) => r.method === 'GET' && r.path === '/api/staging'),
    'the read model exists and nothing serves it. `registerStagingRoutes` must be called from ' +
    '`registerReadRoutes`, for the same reason the calls beside it give — a model that ' +
    'answers is not a route that is served.',
  );
});

const url = (query = ''): URL => new URL(`http://localhost/api/staging${query}`);

/** Write a staging file straight to disk — this endpoint's real input. */
function stage(root: string, lessonId: string, candidates: unknown[], overrides: Record<string, unknown> = {}): void {
  writeFileSync(
    path.join(stagingDir(root), `${lessonId}.json`),
    JSON.stringify({
      protocol: 'my_context/lesson-staging@1',
      lessonId,
      createdAt: '2026-09-07T00:00:00.000Z',
      candidates,
      ...overrides,
    }, null, 2) + '\n',
    'utf8',
  );
}

const candidate = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  key: 'aaaa1111',
  state: 'pending',
  ruleId: null,
  candidate: {
    title: 'Run migrations outside peak hours',
    directive: 'do',
    body: 'The lock is held for the whole batch.',
    scope: ['migrations/**'],
    severity: 'soft',
  },
  ...over,
});

function withStaging(fn: (root: string, cwd: string) => void): void {
  const box = sandbox();
  try {
    // `stageRuleCandidates` creates this directory; nothing has run it here.
    mkdirSync(stagingDir(box.root), { recursive: true });
    fn(box.root, box.cwd);
  } finally { box.dispose(); }
}

test('the body carries both vocabularies the key picker needs, and they do not overlap', () => {
  withStaging((root, cwd) => {
    stage(root, 'LESSON-one', [
      candidate(),
      candidate({ key: 'bbbb2222', state: 'accepted', ruleId: 'RULE-x' }),
    ]);
    stage(root, 'LESSON-two', [candidate({ key: 'cccc3333', state: 'discarded' })]);

    const result = apiStaging(resolveWorkspace(cwd), url());
    assert.equal(result.status, 200);
    const body = result.body as StagingBody;

    // The `id` vocabulary: the lessons `lesson-accept` will find staging for.
    assert.deepEqual(body.lessons.map((l) => l.lessonId), ['LESSON-one', 'LESSON-two']);
    assert.deepEqual(
      body.lessons[0],
      { lessonId: 'LESSON-one', createdAt: '2026-09-07T00:00:00.000Z', candidates: 2, pending: 1, accepted: 1, discarded: 0 },
    );

    // The `key` vocabulary: flat, one row per option, each carrying the lesson
    // it is narrowed by — `narrowedOptions` filters on exactly that field.
    assert.deepEqual(
      body.candidates.map((c) => `${c.lessonId} ${c.key} ${c.state}`),
      ['LESSON-one aaaa1111 pending', 'LESSON-one bbbb2222 accepted', 'LESSON-two cccc3333 discarded'],
    );
    assert.equal(body.candidates[0].title, 'Run migrations outside peak hours');
    assert.equal(body.candidates[0].directive, 'do');
    assert.equal(body.candidates[0].severity, 'soft');
    assert.deepEqual(body.candidates[0].scope, ['migrations/**']);
    assert.equal(body.candidates[1].ruleId, 'RULE-x');

    // A summary row carries no candidate content and a candidate row carries no
    // tally: the two lists are a split, not a duplication.
    assert.ok(!Object.hasOwn(body.lessons[0], 'title'));

    assert.deepEqual(body.counts, { lessons: 2, candidates: 3, pending: 1, accepted: 1, discarded: 1 });
    assert.deepEqual(body.skipped, []);
    assert.deepEqual(body.malformed, []);
  });
});

/**
 * **The endpoint does not decide which command the reader is composing.**
 *
 * `lesson-accept` refuses an accepted or discarded candidate; `lesson-discard`
 * refuses only an accepted one. A read that pre-filtered for one would be lying
 * to the other — and on this repository's own corpus, where every staged
 * candidate is already accepted, a filtered body would be empty and
 * indistinguishable from a broken endpoint.
 */
test('accepted and discarded candidates are served, with their state, not filtered away', () => {
  withStaging((root, cwd) => {
    stage(root, 'LESSON-settled', [
      candidate({ key: 'aaaa1111', state: 'accepted', ruleId: 'RULE-a' }),
      candidate({ key: 'bbbb2222', state: 'discarded' }),
    ]);
    const body = apiStaging(resolveWorkspace(cwd), url()).body as StagingBody;
    assert.equal(body.candidates.length, 2, 'a filtered body would be empty and look broken');
    assert.deepEqual(body.candidates.map((c) => c.state), ['accepted', 'discarded']);
    assert.equal(body.counts.pending, 0);
  });
});

/**
 * **Nothing is dropped silently — the assertion `listStaging`'s old
 * `catch { skip }` could not have passed.**
 *
 * Four kinds of unreadable file, each reported by name with a reason a reader
 * can act on. A `key` picker that quietly omitted one of these would be telling
 * the reader nothing is staged for that lesson.
 */
test('every staging file this endpoint would not read is named, with the reason', () => {
  withStaging((root, cwd) => {
    stage(root, 'LESSON-good', [candidate()]);
    writeFileSync(path.join(stagingDir(root), 'LESSON-junk.json'), '{ not json', 'utf8');
    writeFileSync(path.join(stagingDir(root), 'LESSON-array.json'), '[]', 'utf8');
    stage(root, 'LESSON-old', [candidate()], { protocol: 'my_context/lesson-staging@0' });
    stage(root, 'LESSON-shapeless', [], { candidates: 'all of them' });
    // A file whose contents name a DIFFERENT lesson than its filename: it would
    // otherwise offer a key under a lesson id `lesson-accept` cannot match.
    stage(root, 'LESSON-copied', [candidate()], { lessonId: 'LESSON-somewhere-else' });

    const body = apiStaging(resolveWorkspace(cwd), url()).body as StagingBody;
    assert.deepEqual(body.lessons.map((l) => l.lessonId), ['LESSON-good']);
    assert.deepEqual(
      body.skipped.map((s) => s.file).sort(),
      ['LESSON-array.json', 'LESSON-copied.json', 'LESSON-junk.json', 'LESSON-old.json', 'LESSON-shapeless.json'],
    );
    const reason = (file: string): string => body.skipped.find((s) => s.file === file)!.reason;
    assert.match(reason('LESSON-junk.json'), /could not be read as JSON/);
    assert.match(reason('LESSON-array.json'), /an array, not an object/);
    assert.match(reason('LESSON-old.json'), /protocol .* not/);
    assert.match(reason('LESSON-shapeless.json'), /"candidates" field is "all of them", not an array/);
    assert.match(reason('LESSON-copied.json'), /names lesson "LESSON-somewhere-else" internally/);
    // A skip travels as a bare filename — this body reaches a browser.
    for (const s of body.skipped) assert.ok(!s.file.includes(path.sep), `${s.file} carries a path`);
  });
});

test('a candidate row that cannot be projected is reported, and its siblings still are', () => {
  withStaging((root, cwd) => {
    stage(root, 'LESSON-mixed', [
      candidate(),
      'not an object',
      candidate({ key: 42 }),
      candidate({ key: 'dddd4444', state: 'maybe' }),
      candidate({ key: 'eeee5555', candidate: { directive: 'do' } }),
      candidate({ key: 'ffff6666' }),
    ]);
    const body = apiStaging(resolveWorkspace(cwd), url()).body as StagingBody;
    assert.deepEqual(body.candidates.map((c) => c.key), ['aaaa1111', 'ffff6666'],
      'one bad row must not cost the good rows beside it');
    assert.deepEqual(body.malformed.map((m) => m.index), [1, 2, 3, 4]);
    assert.equal(body.malformed[0].lessonId, 'LESSON-mixed');
    assert.match(body.malformed[0].reason, /a string, not an object/);
    assert.match(body.malformed[1].reason, /"key" is 42/);
    assert.match(body.malformed[2].reason, /"state" is "maybe"/);
    assert.match(body.malformed[3].reason, /no "title"/);
    // The tallies count what was SERVED, so `candidates` and the list agree.
    assert.equal(body.lessons[0].candidates, 2);
    assert.equal(body.counts.candidates, body.candidates.length);
  });
});

test('a project with nothing staged answers with empty lists, not an error', () => {
  const box = sandbox();
  try {
    const body = apiStaging(resolveWorkspace(box.cwd), url()).body as StagingBody;
    assert.deepEqual(body.lessons, []);
    assert.deepEqual(body.candidates, []);
    assert.deepEqual(body.skipped, []);
    assert.deepEqual(body.malformed, []);
    assert.deepEqual(body.counts, { lessons: 0, candidates: 0, pending: 0, accepted: 0, discarded: 0 });
  } finally { box.dispose(); }
});

test('an unexpected query parameter is refused rather than ignored', () => {
  const box = sandbox();
  try {
    const ws = resolveWorkspace(box.cwd);
    assert.equal(apiStaging(ws, url('?state=pending')).status, 400);
    assert.equal(apiStaging(ws, url('?lesson=X')).status, 400);
    assert.equal(apiStaging(ws, url()).status, 200);
  } finally { box.dispose(); }
});

/**
 * Against THIS repository's corpus, read-only: every `.staging/*.json` on disk
 * is either served or named as skipped, and the count is taken from the
 * directory rather than from the function under test.
 */
test('on this corpus, every staging file on disk is accounted for', () => {
  const ws = resolveWorkspace(REPO);
  assert.ok(ws.projectRoot !== null, 'this repository is a corpus');
  const onDisk = readdirSync(stagingDir(ws.projectRoot as string)).filter((n) => n.endsWith('.json'));
  const body = apiStaging(ws, url()).body as StagingBody;
  assert.equal(
    body.lessons.length + body.skipped.length, onDisk.length,
    `${onDisk.length} staging files on disk, ${body.lessons.length} served and ` +
    `${body.skipped.length} named as skipped. A file that is neither is a silent drop.`,
  );
  assert.equal(body.counts.candidates + body.malformed.length,
    readStagingDir(ws.projectRoot as string).staging.reduce((n, s) => n + s.candidates.length, 0));
});
