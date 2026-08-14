import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listRepoFiles, checkIndexFreshness, checkOrphanRelations,
  checkSourceDrift, checkDeadScopes, checkPermissions, runChecks,
} from '../../src/doctor/checks.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import type { Item } from '../../src/core/types.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n`;

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function repo(): { repoRoot: string; root: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-doc-'));
  const root = path.join(repoRoot, '.my_context');
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(repoRoot, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return { repoRoot, root, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
}

test('listRepoFiles returns POSIX paths and skips the usual noise', () => {
  const { repoRoot, cleanup } = repo();
  try {
    mkdirSync(path.join(repoRoot, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(path.join(repoRoot, 'node_modules', 'pkg', 'index.js'), '');
    mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
    writeFileSync(path.join(repoRoot, '.git', 'HEAD'), '');

    const files = listRepoFiles(repoRoot);
    assert.ok(files.includes('src/db/writer.ts'));
    assert.equal(files.some((f) => f.includes('node_modules')), false);
    assert.equal(files.some((f) => f.includes('.git/')), false);
    assert.equal(files.some((f) => f.includes('.my_context')), false);
    assert.equal(files.some((f) => f.includes('\\')), false);
  } finally {
    cleanup();
  }
});

test('index freshness: a missing index is informational, not an error', () => {
  const { root, cleanup } = repo();
  try {
    const findings = checkIndexFreshness(root, path.join(root, '.index.db'));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].level, 'info');
    assert.equal(findings[0].code, 'index_missing');
  } finally {
    cleanup();
  }
});

test('index freshness: an index older than the newest item file is a warning', () => {
  const { root, cleanup } = repo();
  try {
    const db = path.join(root, '.index.db');
    writeFileSync(db, '');
    const old = new Date(Date.now() - 60_000);
    utimesSync(db, old, old);
    writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), '---\nid: CONST-a\n---\n');

    const findings = checkIndexFreshness(root, db);
    assert.equal(findings[0].code, 'index_stale');
    assert.equal(findings[0].level, 'warn');
    assert.match(findings[0].message, /rebuild/);
  } finally {
    cleanup();
  }
});

test('index freshness: a fresh index reports nothing', () => {
  const { root, cleanup } = repo();
  try {
    writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), '---\nid: CONST-a\n---\n');
    const db = path.join(root, '.index.db');
    writeFileSync(db, '');
    assert.deepEqual(checkIndexFreshness(root, db), []);
  } finally {
    cleanup();
  }
});

test('orphan relations name the source item and the missing target', () => {
  const findings = checkOrphanRelations([
    item({ id: 'CONST-a', relations: [{ type: 'derived_from', target: 'ADR-gone' }] }),
    item({ id: 'ADR-here', type: 'adr' }),
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'orphan_relation');
  assert.equal(findings[0].item, 'CONST-a');
  assert.match(findings[0].message, /ADR-gone/);
  assert.match(findings[0].message, /derived_from/);
});

test('a resolved relation is not an orphan', () => {
  assert.deepEqual(checkOrphanRelations([
    item({ id: 'CONST-a', relations: [{ type: 'supersedes', target: 'CONST-b' }] }),
    item({ id: 'CONST-b' }),
  ]), []);
});

test('source drift: an unchanged source is clean', () => {
  const { repoRoot, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, 'prd.md'), DOC);
    const chunk = chunkDocument(DOC)[0];
    assert.deepEqual(checkSourceDrift(repoRoot, [item({
      sourceFile: 'prd.md', sourceAnchor: chunk.anchor, sourceChecksum: chunk.checksum,
    })]), []);
  } finally {
    cleanup();
  }
});

test('source drift: an edited source is flagged and never auto-resolved', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const chunk = chunkDocument(DOC)[0];
    writeFileSync(path.join(repoRoot, 'prd.md'), DOC.replace('12', '16'));

    const findings = checkSourceDrift(repoRoot, [item({
      id: 'REQ-pw', sourceFile: 'prd.md', sourceAnchor: chunk.anchor, sourceChecksum: chunk.checksum,
    })]);
    assert.equal(findings[0].code, 'source_drift');
    assert.equal(findings[0].level, 'warn');
    assert.equal(findings[0].item, 'REQ-pw');
    assert.match(findings[0].message, /prd\.md/);
    assert.match(findings[0].message, /update or supersede/i);
    assert.equal(chunkDocument(DOC)[0].checksum, chunk.checksum, 'the check must not rewrite anything');
  } finally {
    cleanup();
  }
});

test('source drift: a deleted source file is an error', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkSourceDrift(repoRoot, [item({
      id: 'REQ-pw', sourceFile: 'gone.md', sourceAnchor: 'password-policy', sourceChecksum: 'abc',
    })]);
    assert.equal(findings[0].code, 'source_missing');
    assert.equal(findings[0].level, 'error');
  } finally {
    cleanup();
  }
});

test('source drift: a renamed heading loses the anchor and says so', () => {
  const { repoRoot, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, 'prd.md'), DOC.replace('# Password policy', '# Credentials'));
    const findings = checkSourceDrift(repoRoot, [item({
      id: 'REQ-pw', sourceFile: 'prd.md', sourceAnchor: 'password-policy', sourceChecksum: 'abc',
    })]);
    assert.equal(findings[0].code, 'source_anchor_missing');
    assert.match(findings[0].message, /credentials/);
  } finally {
    cleanup();
  }
});

test('items with no provenance are not drift-checked', () => {
  const { repoRoot, cleanup } = repo();
  try {
    assert.deepEqual(checkSourceDrift(repoRoot, [item()]), []);
  } finally {
    cleanup();
  }
});

test('dead scopes: a glob matching nothing on disk is flagged', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkDeadScopes(repoRoot, [item({ id: 'CONST-a', scope: ['src/legacy/**'] })]);
    assert.equal(findings[0].code, 'dead_scope');
    assert.equal(findings[0].item, 'CONST-a');
    assert.match(findings[0].message, /src\/legacy\/\*\*/);
  } finally {
    cleanup();
  }
});

test('dead scopes: a live glob is clean, and only the dead one is named', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkDeadScopes(repoRoot, [item({ scope: ['src/db/**', 'src/gone/**'] })]);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /src\/gone/);
  } finally {
    cleanup();
  }
});

test('dead scopes: only active items are checked — a draft is not rot', () => {
  const { repoRoot, cleanup } = repo();
  try {
    assert.deepEqual(checkDeadScopes(repoRoot, [item({ status: 'draft', scope: ['src/gone/**'] })]), []);
  } finally {
    cleanup();
  }
});

test('permissions: a writable workspace is clean', () => {
  const { root, cleanup } = repo();
  try {
    assert.deepEqual(checkPermissions(root).filter((f) => f.level === 'error'), []);
  } finally {
    cleanup();
  }
});

test('permissions: a missing gitignore for the index is a warning', () => {
  const { root, cleanup } = repo();
  try {
    const findings = checkPermissions(root);
    assert.ok(findings.some((f) => f.code === 'index_not_ignored'));
  } finally {
    cleanup();
  }
});

test('permissions: an existing gitignore that does not cover the index still warns', () => {
  const { root, cleanup } = repo();
  try {
    writeFileSync(path.join(root, '.gitignore'), 'node_modules\n*.log\n');
    assert.ok(checkPermissions(root).some((f) => f.code === 'index_not_ignored'));
  } finally {
    cleanup();
  }
});

test('permissions: an existing gitignore covering the index is clean', () => {
  const { root, cleanup } = repo();
  try {
    writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
    assert.equal(checkPermissions(root).some((f) => f.code === 'index_not_ignored'), false);
  } finally {
    cleanup();
  }
});

test('runChecks aggregates every check and one failing check does not hide the others', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    const findings = runChecks({
      root, repoRoot,
      dbPath: path.join(root, '.index.db'),
      items: [
        item({ id: 'CONST-a', scope: ['src/gone/**'], relations: [{ type: 'derived_from', target: 'ADR-gone' }] }),
        item({ id: 'REQ-b', sourceFile: 'gone.md', sourceAnchor: 'x', sourceChecksum: 'y' }),
      ],
    });
    const codes = new Set(findings.map((f) => f.code));
    assert.ok(codes.has('orphan_relation'));
    assert.ok(codes.has('dead_scope'));
    assert.ok(codes.has('source_missing'));
    assert.ok(codes.has('index_missing'));
  } finally {
    cleanup();
  }
});

test('runChecks: a check that actually throws is caught and does not suppress the others', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    // relations: null is not a shape checkOrphanRelations can iterate — it throws.
    // runChecks must catch that and still run checkDeadScopes / checkIndexFreshness.
    const poisoned = item({
      id: 'CONST-a', scope: ['src/gone/**'], relations: null as unknown as [],
    });
    const findings = runChecks({
      root, repoRoot,
      dbPath: path.join(root, '.index.db'),
      items: [poisoned],
    });
    const codes = new Set(findings.map((f) => f.code));
    assert.ok(codes.has('check_failed'), 'the throwing check must be reported, not swallowed');
    assert.ok(codes.has('dead_scope'), 'a check after the throwing one must still run');
    assert.ok(codes.has('index_missing'), 'a check before the throwing one must still run');
  } finally {
    cleanup();
  }
});
