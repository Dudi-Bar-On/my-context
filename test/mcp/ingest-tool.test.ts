import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry, TOOL_NAMES } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { INGEST_DOCUMENT_SCHEMA } from '../../src/mcp/tools/ingest.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n\n# Storage\n\nPostgres only.\n`;

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mcp-ing-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

function call(cwd: string, args: Record<string, unknown>): string {
  return createRegistry(cwd).call('ingest_document', args);
}

test('the tool is registered and no longer reserved', () => {
  assert.ok(TOOL_NAMES.includes('ingest_document'));
  assert.equal(RESERVED_TOOLS.includes('ingest_document'), false);
});

test('its description is documented, terse, and says when not to use it', () => {
  const description = toolDescriptions().ingest_document;
  assert.ok(description, 'capture.md is the only source of tool descriptions');
  assert.ok(description.length <= 200, `${description.length} chars`);
  assert.match(description, /Not for:/);
});

test('phase one returns an extraction request', () => {
  const cwd = project();
  const out = call(cwd, { path: 'docs/prd.md' });
  assert.match(out, /EXTRACTION REQUEST/);
  assert.match(out, /password-policy/);
  rmSync(cwd, { recursive: true, force: true });
});

test('phase two stages drafts and returns the next request', () => {
  const cwd = project();
  const session = /ING-[a-z0-9-]+/.exec(call(cwd, { path: 'docs/prd.md' }))![0];

  const applied = call(cwd, {
    session, anchor: 'password-policy',
    candidates: [{
      type: 'requirement',
      title: 'Passwords are at least 12 characters',
      body: 'Enforced at registration.',
      quote: 'Passwords must be at least 12 characters.',
    }],
  });

  assert.match(applied, /created 1/);
  assert.match(applied, /EXTRACTION REQUEST/);

  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot! }, ws.config);
  const item = store.get('REQ-passwords-are-at-least-12-characters');
  assert.equal(item?.status, 'draft');
  assert.equal(item?.origin, 'ingest');
  store.close();
  rmSync(cwd, { recursive: true, force: true });
});

test('a call with neither path nor session throws, naming both', () => {
  const cwd = project();
  assert.throws(() => call(cwd, {}), /"path"[\s\S]*"session"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing document throws a teaching message, not an ENOENT', () => {
  const cwd = project();
  assert.throws(() => call(cwd, { path: 'docs/nope.md' }), /my_context:[\s\S]*docs\/nope\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('rejected candidates are reported to the agent with correcting messages', () => {
  const cwd = project();
  const session = /ING-[a-z0-9-]+/.exec(call(cwd, { path: 'docs/prd.md' }))![0];
  const out = call(cwd, {
    session, anchor: 'password-policy',
    candidates: [{ type: 'requirements', title: 'x', body: 'y', quote: 'Passwords must be at least 12 characters.' }],
  });
  assert.match(out, /closest match is "requirement"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown session throws, naming the id', () => {
  const cwd = project();
  assert.throws(
    () => call(cwd, { session: 'ING-nope-00000000', anchor: 'x', candidates: [] }),
    /ING-nope-00000000/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('session without anchor or without candidates is refused, not half-applied', () => {
  const cwd = project();
  const session = /ING-[a-z0-9-]+/.exec(call(cwd, { path: 'docs/prd.md' }))![0];
  assert.throws(() => call(cwd, { session, candidates: [] }), /"anchor"/);
  assert.throws(() => call(cwd, { session, anchor: 'password-policy' }), /"candidates"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the input schema documents both phases', () => {
  const props = INGEST_DOCUMENT_SCHEMA.properties as Record<string, { description: string }>;
  for (const key of ['path', 'session', 'anchor', 'candidates']) {
    assert.ok(props[key].description.length > 0, key);
  }
});

test('the schema exposes no origin field — trust is not an argument', () => {
  const props = INGEST_DOCUMENT_SCHEMA.properties as Record<string, unknown>;
  assert.equal(Object.hasOwn(props, 'origin'), false);
});
