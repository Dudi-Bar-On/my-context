import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractionRequest, renderExtractionRequest, nextRequest, EXTRACTION_PROTOCOL } from '../../src/ingest/request.ts';
import { openIngestSession } from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;
const CONFIG = resolveConfig({});

function session() {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-req-'));
  const s = openIngestSession(root, 'docs/prd/auth.md', DOC);
  return { s, cleanup: () => rmSync(root, { recursive: true, force: true }) };
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

test('the rendered block leads with a human-readable heading naming the source', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.match(text.split('\n')[0], /EXTRACTION REQUEST/);
  assert.match(text, /docs\/prd\/auth\.md/);
  cleanup();
});
