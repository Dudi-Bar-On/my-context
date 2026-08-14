import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractionRequest, renderExtractionRequest, nextRequest, EXTRACTION_PROTOCOL } from '../../src/ingest/request.ts';
import { openIngestSession } from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { CANDIDATE_SCHEMA, validateCandidates } from '../../src/ingest/schema.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;
const CONFIG = resolveConfig({});

function session() {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-req-'));
  const s = openIngestSession(root, 'docs/prd/auth.md', DOC);
  return { s, cleanup: () => removeTree(root) };
}

test('a request carries the chunk, its position and its provenance', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.equal(req.protocol, EXTRACTION_PROTOCOL);
  assert.equal(req.session, s.id);
  assert.equal(req.sourceFile, 'docs/prd/auth.md');
  assert.equal(req.anchor, 'auth');
  assert.equal(req.chunkIndex, 0);
  assert.equal(req.totalChunks, 2);
  assert.match(req.chunk, /Must support SSO/);
  cleanup();
});

test('only enabled categories are offered, each with its description', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const names = req.categories.map((c) => c.name);
  assert.ok(names.includes('constraint'));
  assert.equal(names.includes('policy'), false, 'policy is off in the standard profile');
  assert.ok(req.categories.every((c) => c.description.length > 0));
  cleanup();
});

test('a category with extra fields advertises them so the agent can fill them', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const rule = req.categories.find((c) => c.name === 'rule');
  assert.deepEqual(rule?.extraFields, ['directive']);
  cleanup();
});

test('the callback names both the CLI command and the MCP tool call', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.match(req.callback.cli, /ingest-apply/);
  assert.match(req.callback.cli, new RegExp(s.id));
  assert.match(req.callback.cli, /--anchor auth/);
  assert.equal(req.callback.mcp.tool, 'ingest_document');
  assert.equal(req.callback.mcp.arguments.session, s.id);
  assert.equal(req.callback.mcp.arguments.anchor, 'auth');
  cleanup();
});

test('the instructions state that the agent is the extractor and must not paraphrase quotes', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const text = req.instructions.join(' ');
  assert.match(text, /you are the extractor/i);
  assert.match(text, /verbatim/i);
  assert.match(text, /\[\]/, 'must say to return an empty array when nothing is normative');
  cleanup();
});

test('nextRequest walks pending chunks in order and returns null when done', () => {
  const { s, cleanup } = session();
  assert.equal(nextRequest(s, CONFIG)?.anchor, 'auth');
  s.applied.auth = [];
  assert.equal(nextRequest(s, CONFIG)?.anchor, 'storage');
  s.applied.storage = [];
  assert.equal(nextRequest(s, CONFIG), null);
  cleanup();
});

test('remaining counts chunks still pending, including this one', () => {
  const { s, cleanup } = session();
  assert.equal(buildExtractionRequest(s, s.chunks[0], CONFIG).remaining, 2);
  s.applied.auth = [];
  assert.equal(buildExtractionRequest(s, s.chunks[1], CONFIG).remaining, 1);
  cleanup();
});

test('the rendered block embeds parseable JSON and uses LF only', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.equal(text.includes('\r'), false);
  const json = text.slice(text.indexOf('```json') + 7, text.lastIndexOf('```'));
  const parsed = JSON.parse(json) as { protocol: string };
  assert.equal(parsed.protocol, EXTRACTION_PROTOCOL);
  cleanup();
});

test('renderExtractionRequest strips a \\r that reaches it through any field, not merely one that happens not to occur today', () => {
  // Every current producer of these fields (chunkDocument/normalizeEol, the
  // literal instruction strings) already yields LF-only text, so this
  // exercises the strip directly rather than relying on that upstream
  // guarantee holding forever — a future field (or a caller constructing an
  // ExtractionRequest by hand) could reintroduce a \r without this test
  // going red.
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const withCr: typeof req = { ...req, sourceFile: 'docs/prd/auth.md\r', heading: 'Auth\r\nSection' };
  const text = renderExtractionRequest(withCr);
  assert.equal(text.includes('\r'), false);
  cleanup();
});

// --- content-pinning tests: catch "an empty/deleted artifact still renders
// and parses" mutants that shape-only assertions (JSON parses, no \r, a
// heading line exists) cannot. Each one asserts the SPECIFIC content the
// brief requires the request to be self-contained about is actually there,
// not merely that *some* content is there. ---

test('the schema field is the real CANDIDATE_SCHEMA, not an empty or stub object', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.deepEqual(req.schema, CANDIDATE_SCHEMA);
  cleanup();
});

test('every instruction line is present verbatim in the rendered text, not just in the object', () => {
  // Guards renderExtractionRequest specifically: request.instructions being
  // correct is necessary but not sufficient if the render step drops the
  // bullets on the floor.
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const text = renderExtractionRequest(req);
  for (const line of req.instructions) {
    assert.ok(text.includes(line), `rendered text is missing instruction: ${line}`);
  }
  cleanup();
});

test('an instruction names the callback command and tool by name, not just the object under "callback"', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const text = req.instructions.join(' ');
  assert.match(text, /ingest-apply/);
  assert.match(text, /ingest_document/);
  assert.match(text, /candidates/);
  cleanup();
});

test('the rendered block states the callback command in prose, not only inside the JSON', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  const beforeJson = text.slice(0, text.indexOf('```json'));
  assert.match(beforeJson, /ingest-apply/);
  assert.match(beforeJson, /ingest_document/);
  cleanup();
});

test('categories are sorted alphabetically by name', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const names = req.categories.map((c) => c.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sorted);
  cleanup();
});

test('heading carries the chunk\'s actual section heading', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.equal(req.heading, 'Auth');
  cleanup();
});

test('the header line states the exact chunk position and total, not just that a heading exists', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.match(text.split('\n')[0], /chunk 1 of 2/);
  const text2 = renderExtractionRequest(buildExtractionRequest(s, s.chunks[1], CONFIG));
  assert.match(text2.split('\n')[0], /chunk 2 of 2/);
  cleanup();
});

test('remaining still counts an already-applied chunk when asked for it directly (the +1 branch)', () => {
  // buildExtractionRequest is not only reached through nextRequest — a
  // caller (e.g. a future repair loop re-asking about a specific anchor)
  // can hand it a chunk that is no longer in pendingAnchors(). `remaining`
  // must still report a sane count (pending + this one), not silently
  // treat an already-applied chunk as if it weren't part of the count.
  const { s, cleanup } = session();
  s.applied.auth = []; // "auth" is done; only "storage" is pending
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG); // ask about "auth" anyway
  assert.equal(req.remaining, 2); // pendingAnchors = ['storage'] (1) + 1 for this chunk
  cleanup();
});

test('the callback JSON, plus a "candidates" array, is exactly what validateCandidates accepts — no contradiction between prose and JSON', () => {
  // Task 5 review: the prose previously showed {"...,"candidates":[...]}
  // while the embedded JSON's mcp.arguments.candidates was the STRING
  // "<your JSON array here>" — copying the JSON literally produced
  // "expected a JSON array of candidate items, got string". Pin the fix:
  // the JSON view must not carry a "candidates" key at all (nothing to
  // copy wrong), and appending a real array must validate cleanly.
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.equal('candidates' in req.callback.mcp.arguments, false);
  const withCandidates = { ...req.callback.mcp.arguments, candidates: [] };
  assert.ok(Array.isArray(withCandidates.candidates));
  const result = validateCandidates(withCandidates.candidates, CONFIG, s.chunks[0]);
  assert.deepEqual(result.issues, []);
  cleanup();
});

test('every example a model could copy from the request text validates against validateCandidates', () => {
  // Not the placeholder-string regression above — an actual, realistic
  // candidate shaped exactly the way the instructions describe: a single
  // line body free of headings, a lowercase hyphenated observation
  // category, observation text free of "#" and trailing parens, a
  // non-reserved underscore-only extra key, an array (not bare-string)
  // scope/tags, and a quote copied verbatim from this fixture's chunk.
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const example = [{
    type: 'requirement',
    title: 'The system must support SSO.',
    body: 'SSO is required for enterprise auth compliance and is not optional.',
    quote: 'Must support SSO.',
    severity: 'hard',
    scope: ['src/auth/**'],
    tags: ['auth'],
    observations: [
      { category: 'root-cause', text: 'Enterprise buyers require SSO to sign.', tags: [], context: 'at design time' },
    ],
    extra: { kind: 'functional' },
  }];
  const result = validateCandidates(example, CONFIG, s.chunks[0]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid.length, 1);
  const empty = validateCandidates([], CONFIG, s.chunks[0]);
  assert.deepEqual(empty.issues, []);
  // req.schema is exactly what was validated against — pin that they agree.
  assert.deepEqual(req.schema, CANDIDATE_SCHEMA);
  cleanup();
});

test('the rendered block leads with a human-readable heading naming the source', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.match(text.split('\n')[0], /EXTRACTION REQUEST/);
  assert.match(text, /docs\/prd\/auth\.md/);
  cleanup();
});
