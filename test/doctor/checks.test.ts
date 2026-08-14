import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants, mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listRepoFiles, checkIndexFreshness, checkOrphanRelations,
  checkSourceDrift, checkDeadScopes, checkPermissions, checkSessionIdMismatch, runChecks,
} from '../../src/doctor/checks.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import { SESSION_PROTOCOL, ingestDir } from '../../src/ingest/session.ts';
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

test('listRepoFiles honors an explicit limit exactly, not off-by-one', () => {
  const { repoRoot, cleanup } = repo();
  try {
    for (const name of ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']) {
      writeFileSync(path.join(repoRoot, name), 'x');
    }
    // src/db/writer.ts from repo() plus the 5 files above is 6 candidates;
    // capping at 3 must yield exactly 3, never 4 (an off-by-one `>` in place
    // of `>=` would let one extra entry through).
    const files = listRepoFiles(repoRoot, 3);
    assert.equal(files.length, 3);
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
  assert.equal(findings[0].level, 'warn');
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
    assert.equal(findings[0].level, 'warn');
    assert.match(findings[0].message, /credentials/);
  } finally {
    cleanup();
  }
});

test('source drift: two items from two different source documents are each checked against their own', () => {
  // Regression: the per-document chunk cache must be keyed by sourceFile,
  // not by a constant — otherwise the second item's provenance gets checked
  // against the first document's chunks, and a genuinely clean item reports
  // a false source_anchor_missing (or worse, a false-clean pass hides real
  // drift) purely because it wasn't the first document processed.
  const { repoRoot, cleanup } = repo();
  try {
    const docA = `# Alpha\n\nFirst document content.\n`;
    const docB = `# Beta\n\nSecond, unrelated document content.\n`;
    writeFileSync(path.join(repoRoot, 'a.md'), docA);
    writeFileSync(path.join(repoRoot, 'b.md'), docB);
    const chunkA = chunkDocument(docA)[0];
    const chunkB = chunkDocument(docB)[0];

    const findings = checkSourceDrift(repoRoot, [
      item({ id: 'REQ-a', sourceFile: 'a.md', sourceAnchor: chunkA.anchor, sourceChecksum: chunkA.checksum }),
      item({ id: 'REQ-b', sourceFile: 'b.md', sourceAnchor: chunkB.anchor, sourceChecksum: chunkB.checksum }),
    ]);
    assert.deepEqual(findings, []);
  } finally {
    cleanup();
  }
});

test('source drift: a source_file that escapes repoRoot is never followed, even if it genuinely matches', () => {
  const { repoRoot, cleanup } = repo();
  const outsideDir = mkdtempSync(path.join(tmpdir(), 'myctx-doc-outside-'));
  try {
    const outsideDoc = `# Escaped\n\nThis document lives outside the workspace on purpose.\n`;
    writeFileSync(path.join(outsideDir, 'escaped.md'), outsideDoc);
    const chunk = chunkDocument(outsideDoc)[0];
    const rel = path.relative(repoRoot, path.join(outsideDir, 'escaped.md')).split(path.sep).join('/');
    assert.ok(rel.startsWith('../'), 'the fixture must actually escape repoRoot for this test to mean anything');

    const findings = checkSourceDrift(repoRoot, [item({
      id: 'REQ-esc', sourceFile: rel, sourceAnchor: chunk.anchor, sourceChecksum: chunk.checksum,
    })]);
    // Even though a genuinely matching document exists at that path, doctor
    // must never read outside repoRoot — it is reported as unverifiable, not
    // silently trusted as clean.
    assert.equal(findings[0]?.code, 'source_missing');
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
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
    assert.equal(findings[0].level, 'warn');
    assert.equal(findings[0].item, 'CONST-a');
    assert.match(findings[0].message, /src\/legacy\/\*\*/);
  } finally {
    cleanup();
  }
});

test('dead scopes: a scope into a directory listRepoFiles skips (.my_context, dist, ...) is still live', () => {
  // Regression: checkDeadScopes must NOT rely on listRepoFiles' noise-skipping
  // list, since a real constraint can legitimately scope into .my_context/
  // itself or into build output. Using that list previously made a live
  // scope glob into .my_context/** report as dead_scope on this repo's own
  // corpus (STD-answered-questions-are-superseded).
  const { repoRoot, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, '.my_context', 'items', 'constraint', 'CONST-a.md'), 'x');
    mkdirSync(path.join(repoRoot, 'dist'), { recursive: true });
    writeFileSync(path.join(repoRoot, 'dist', 'bundle.js'), 'x');

    const findings = checkDeadScopes(repoRoot, [
      item({ id: 'CONST-a', scope: ['.my_context/**'] }),
      item({ id: 'CONST-b', scope: ['dist/**'] }),
    ]);
    assert.deepEqual(findings, []);
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
    const finding = findings.find((f) => f.code === 'index_not_ignored');
    assert.ok(finding);
    assert.equal(finding.level, 'warn');
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

for (const [label, line] of [
  ['a trailing-star pattern', '.index.db*'],
  ['a root-anchored pattern', '/.index.db'],
  ['a double-star-anchored pattern', '**/.index.db'],
  ['a bare wildcard', '*'],
] as const) {
  test(`permissions: ${label} in the gitignore covers the index (not just literal ".index.db")`, () => {
    const { root, cleanup } = repo();
    try {
      writeFileSync(path.join(root, '.gitignore'), `${line}\n`);
      assert.equal(checkPermissions(root).some((f) => f.code === 'index_not_ignored'), false);
    } finally {
      cleanup();
    }
  });
}

test('permissions: a rule in the repo-root gitignore also covers the index', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, '.gitignore'), '.index.db\n.index.db-*\n');
    assert.equal(checkPermissions(root, undefined, repoRoot).some((f) => f.code === 'index_not_ignored'), false);
  } finally {
    cleanup();
  }
});

test('permissions: a repo-root rule ignoring the whole workspace directory covers the index too', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, '.gitignore'), '.my_context/\n');
    assert.equal(checkPermissions(root, undefined, repoRoot).some((f) => f.code === 'index_not_ignored'), false);
  } finally {
    cleanup();
  }
});

test('permissions: a repo-root gitignore that does not cover the workspace still warns', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    writeFileSync(path.join(repoRoot, '.gitignore'), 'node_modules\n');
    assert.ok(checkPermissions(root, undefined, repoRoot).some((f) => f.code === 'index_not_ignored'));
  } finally {
    cleanup();
  }
});

test('permissions: probes each target with R_OK|W_OK, never a weaker mode like F_OK', () => {
  const { root, cleanup } = repo();
  try {
    const modes: (number | undefined)[] = [];
    const access = (_target: string, mode?: number) => { modes.push(mode); };
    checkPermissions(root, access);
    assert.ok(modes.length >= 2, 'both root and items/ must be probed');
    for (const mode of modes) {
      assert.equal(mode, constants.R_OK | constants.W_OK);
    }
  } finally {
    cleanup();
  }
});

test('permissions: an access failure is reported as a not_writable error', () => {
  const { root, cleanup } = repo();
  try {
    const access = () => { throw new Error('EACCES: permission denied'); };
    const findings = checkPermissions(root, access);
    const errors = findings.filter((f) => f.code === 'not_writable');
    assert.equal(errors.length, 2, 'both root and items/ fail the injected access check');
    for (const f of errors) assert.equal(f.level, 'error');
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
    // Regression: checkPermissions must actually be wired into runChecks.
    // Deleting that line from the checks array leaves the whole suite green
    // otherwise — nothing else asserts a permissions code comes out of
    // runChecks specifically (only out of checkPermissions in isolation).
    assert.ok(codes.has('index_not_ignored'), 'runChecks must include checkPermissions findings');
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

test('session id mismatch: a header id that disagrees with its filename is reported', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    // Filename says "ING-a", but the header inside claims id "ING-b" — the
    // exact shape listSessions would silently mis-key on: it would read
    // this file, then look up ING-b's applied log (which may not exist,
    // or belong to an unrelated session), never ING-a's actual log.
    writeFileSync(
      path.join(ingestDir(root), 'ING-a.json'),
      JSON.stringify({
        protocol: SESSION_PROTOCOL, id: 'ING-b', sourceFile: 'docs/x.md',
        sourceChecksum: 'x', createdAt: '2026-01-01T00:00:00.000Z', chunks: [],
      }),
      'utf8',
    );
    const findings = checkSessionIdMismatch(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'session_id_mismatch');
    assert.equal(findings[0].level, 'error');
    assert.match(findings[0].message, /ING-a\.json/);
    assert.match(findings[0].message, /ING-b/);
  } finally {
    cleanup();
  }
});

test('session id mismatch: a matching filename/id is clean', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    writeFileSync(
      path.join(ingestDir(root), 'ING-a.json'),
      JSON.stringify({
        protocol: SESSION_PROTOCOL, id: 'ING-a', sourceFile: 'docs/x.md',
        sourceChecksum: 'x', createdAt: '2026-01-01T00:00:00.000Z', chunks: [],
      }),
      'utf8',
    );
    assert.deepEqual(checkSessionIdMismatch(root), []);
  } finally {
    cleanup();
  }
});

test('session id mismatch: no .ingest directory at all is clean, not an error', () => {
  const { root, cleanup } = repo();
  try {
    assert.deepEqual(checkSessionIdMismatch(root), []);
  } finally {
    cleanup();
  }
});

test('session id mismatch: a corrupt session file is skipped, not reported', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    writeFileSync(path.join(ingestDir(root), 'ING-a.json'), 'not json', 'utf8');
    assert.deepEqual(checkSessionIdMismatch(root), []);
  } finally {
    cleanup();
  }
});

test('runChecks includes checkSessionIdMismatch', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    writeFileSync(
      path.join(ingestDir(root), 'ING-a.json'),
      JSON.stringify({
        protocol: SESSION_PROTOCOL, id: 'ING-mismatch', sourceFile: 'docs/x.md',
        sourceChecksum: 'x', createdAt: '2026-01-01T00:00:00.000Z', chunks: [],
      }),
      'utf8',
    );
    const findings = runChecks({ root, repoRoot, dbPath: path.join(root, '.index.db'), items: [] });
    assert.ok(findings.some((f) => f.code === 'session_id_mismatch'));
  } finally {
    cleanup();
  }
});
