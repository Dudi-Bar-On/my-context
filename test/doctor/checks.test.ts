import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constants, mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listRepoFiles, checkIndexFreshness, checkOrphanRelations, checkSourceDrift, checkDeadScopes,
  checkPermissions, checkSessionIdMismatch, checkUnknownCategory, runChecks,
} from '../../src/doctor/checks.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import { SESSION_PROTOCOL, ingestDir } from '../../src/ingest/session.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n`;

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
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
  return { repoRoot, root, cleanup: () => removeTree(repoRoot) };
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
    removeTree(outsideDir);
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
    const findings = checkDeadScopes(repoRoot, [item({ id: 'CONST-a', scope: ['src/legacy/**'] })], resolveConfig({}));
    assert.equal(findings[0].code, 'dead_scope');
    assert.equal(findings[0].level, 'warn');
    assert.equal(findings[0].item, 'CONST-a');
    assert.match(findings[0].message, /src\/legacy\/\*\*/);
  } finally {
    cleanup();
  }
});

/**
 * The message names the glob, and does NOT name the item — `item` is a field
 * of the finding, and every surface renders it beside the message: the text
 * report prefixes the line with it, `--full` gives it its own labelled line,
 * `--json` has the field. It used to be named inside the sentence as well,
 * which put the same id twice on one line and made this the widest line
 * `doctor` printed (442 characters at the widest id this project can mint).
 *
 * Asserted as an absence rather than left to the width budget, because
 * wrapping the report (`doctor --full`, format.ts `paragraph`) already holds
 * the width whether or not the id is repeated — so nothing else would notice
 * it coming back.
 */
test('dead scopes: the message does not repeat the id the finding already carries', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const id = 'CONST-a-long-enough-id-that-repeating-it-costs-a-whole-line';
    const findings = checkDeadScopes(repoRoot, [item({ id, scope: ['src/legacy/**'] })], resolveConfig({}));
    assert.equal(findings[0].item, id);
    assert.ok(!findings[0].message.includes(id), findings[0].message);
    // Still actionable without it: the glob is named, and so is what to do.
    assert.match(findings[0].message, /Re-scope it/);
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
    ], resolveConfig({}));
    assert.deepEqual(findings, []);
  } finally {
    cleanup();
  }
});

test('dead scopes: a live glob is clean, and only the dead one is named', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkDeadScopes(repoRoot, [item({ scope: ['src/db/**', 'src/gone/**'] })], resolveConfig({}));
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /src\/gone/);
  } finally {
    cleanup();
  }
});

test('dead scopes: only active items are checked — a draft is not rot', () => {
  const { repoRoot, cleanup } = repo();
  try {
    assert.deepEqual(checkDeadScopes(repoRoot, [item({ status: 'draft', scope: ['src/gone/**'] })], resolveConfig({})), []);
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
      config: resolveConfig({}),
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
      config: resolveConfig({}),
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
    // Filename says "ING-a", but the header inside claims id "ING-b". Verified
    // (see checkSessionIdMismatch's doc comment, and a manual openIngestSession/
    // saveSession/listSessions repro) that the real damage is NOT a silently
    // skipped resume — it is a duplicate header+applied-log written under
    // "ING-b.json" on the next save, and listSessions then listing the
    // session twice. The message must describe that, and must not tell the
    // reader to rename the file (which would orphan the applied log instead).
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
    assert.match(findings[0].message, /duplicate/);
    assert.match(findings[0].message, /next save/i);
    assert.match(findings[0].message, /Do NOT rename the file/);
    assert.doesNotMatch(
      findings[0].message,
      /silently (skipped|lost)/,
      'must not claim the resume silently loses records — it does not',
    );
  } finally {
    cleanup();
  }
});

test('session id mismatch: a non-session .json file with the same shape is ignored (protocol gate)', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    // No `protocol` field at all — an arbitrary stray .json dropped into
    // .ingest/ by something else entirely.
    writeFileSync(
      path.join(ingestDir(root), 'notes.json'),
      JSON.stringify({ id: 'whatever' }),
      'utf8',
    );
    assert.deepEqual(checkSessionIdMismatch(root), []);
  } finally {
    cleanup();
  }
});

test('session id mismatch: a .json file with a different/older protocol string is ignored', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    writeFileSync(
      path.join(ingestDir(root), 'ING-old.json'),
      JSON.stringify({ protocol: 'my_context/ingest-session@0', id: 'ING-mismatched-BOGUS' }),
      'utf8',
    );
    assert.deepEqual(checkSessionIdMismatch(root), []);
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

test('session id mismatch: non-.json files in .ingest/ (applied logs, stale .tmp-) are never inspected', () => {
  const { root, cleanup } = repo();
  try {
    mkdirSync(ingestDir(root), { recursive: true });
    // A real applied-log file, and a crash-leftover temp file — neither is
    // JSON-parseable as a session header, and neither should be listed.
    writeFileSync(path.join(ingestDir(root), 'ING-a.applied.jsonl'), '{"anchor":"x"}\n', 'utf8');
    writeFileSync(path.join(ingestDir(root), 'ING-a.json.tmp-1234'), 'garbage', 'utf8');
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
    const findings = runChecks({ root, repoRoot, dbPath: path.join(root, '.index.db'), items: [], config: resolveConfig({}) });
    assert.ok(findings.some((f) => f.code === 'session_id_mismatch'));
  } finally {
    cleanup();
  }
});

/**
 * 1C.7 — the `dead_scope` advice used to end "an item left with no globs at
 * all is unrestricted and injects on every file" for EVERY item, which is
 * false for a rationale one: `select` filters `isNormative` before it looks at
 * `always` or `scope`, so a `decision` is injected on no file whatever its
 * scope says.
 *
 * Tier first, then policy — the same order `select` itself applies, and the
 * order `mycontext supersede`'s preview and `review promote`'s completion line
 * were already written in.
 */
test('dead scopes: the advice does not promise an injection on the rationale tier', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkDeadScopes(
      repoRoot,
      [item({ id: 'DEC-a', type: 'decision', scope: ['src/legacy/**'] })],
      resolveConfig({}),
    );
    assert.equal(findings.length, 1);
    // The false sentence, in the two spellings it could come back as.
    assert.ok(!/injects on every file/.test(findings[0].message), findings[0].message);
    assert.ok(!/unrestricted/.test(findings[0].message), findings[0].message);
    // The existing spelling, reused rather than reworded — see
    // RATIONALE_NOT_INJECTED (core/render-item.ts).
    assert.match(findings[0].message, /searchable, and counted in the session index/);
    // And it still says why re-scoping is worth doing at all.
    assert.match(findings[0].message, /query_items/);
  } finally {
    cleanup();
  }
});

/** The normative tier keeps the injection sentence, which is true there. */
test('dead scopes: a normative item is still told an unscoped item injects everywhere', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const findings = checkDeadScopes(
      repoRoot, [item({ scope: ['src/legacy/**'] })], resolveConfig({}),
    );
    assert.match(findings[0].message, /unrestricted and injects on every file/);
  } finally {
    cleanup();
  }
});

/**
 * A category retiered in config takes the NEW tier's advice — the resolved
 * config is what the whole product reads, not the built-in catalogue.
 */
test('dead scopes: retiering a category in config changes which advice it gets', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const config = resolveConfig({ categories: { constraint: { tier: 'rationale' } } });
    const findings = checkDeadScopes(repoRoot, [item({ scope: ['src/legacy/**'] })], config);
    assert.ok(!/injects on every file/.test(findings[0].message), findings[0].message);
    assert.match(findings[0].message, /rationale-tier category in this project/);
  } finally {
    cleanup();
  }
});

/** The scopePolicy branches remain, and remain reachable — on the normative
 * tier, which is the only tier on which they were ever true. */
test('dead scopes: scopePolicy still decides the advice on the normative tier', () => {
  const { repoRoot, cleanup } = repo();
  try {
    const cases: [string, RegExp][] = [
      ['required', /must keep at least one glob/],
      ['inert', /injected on no file at all/],
      ['global', /unrestricted and injects on every file/],
    ];
    for (const [policy, expected] of cases) {
      const config = resolveConfig({ categories: { constraint: { scopePolicy: policy } } });
      const findings = checkDeadScopes(repoRoot, [item({ scope: ['src/legacy/**'] })], config);
      assert.match(findings[0].message, expected, `scopePolicy ${policy}`);
    }
  } finally {
    cleanup();
  }
});

/**
 * Phase 3 removed `policy`, `postmortem` and `taxonomy`. A project that
 * captured items under one of them keeps those items — `loadLayer` indexes an
 * item whose category is absent from config rather than dropping it — and this
 * check is what turns "still there but inert" into a named route out.
 *
 * The item is named because the route names it: `supersede` takes an id.
 */
test('unknown category: an item of a removed category is named, with the supersede route', () => {
  const findings = checkUnknownCategory(
    [item({ id: 'POL-eu-only', type: 'policy' }), item()],
    resolveConfig({}),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'unknown_category');
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].item, 'POL-eu-only');
  assert.match(findings[0].message, /mycontext supersede POL-eu-only --by/);
  // The other route, and the reason a third does not exist.
  assert.match(findings[0].message, /declare "policy" in \.my_context\/config\.json/);
  assert.match(findings[0].message, /no retype/i);
  // It must not read as data loss: that is the fear this finding exists to answer.
  assert.match(findings[0].message, /Nothing has been dropped/);
});

/**
 * `enabled: false` is a deliberate configuration choice with a one-word fix,
 * not a removed category — and firing here would put a permanent warning on
 * every project that switches a category off, which the README documents as
 * supported.
 */
test('unknown category: a merely DISABLED category is not reported here', () => {
  const config = resolveConfig({ categories: { constraint: { enabled: false } } });
  assert.deepEqual(checkUnknownCategory([item()], config), []);
});

/** A category the project declares itself is defined, however unusual its name. */
test('unknown category: a custom category the project declares is not reported', () => {
  const config = resolveConfig({
    categories: { security_control: { tier: 'normative', description: 'A control' } },
  });
  assert.deepEqual(checkUnknownCategory([item({ type: 'security_control' })], config), []);
});

/** `runChecks` has to actually run it, or every assertion above is about a
 * function nothing calls. */
test('unknown category: runChecks includes the finding', () => {
  const { repoRoot, root, cleanup } = repo();
  try {
    const findings = runChecks({
      root, repoRoot, dbPath: path.join(root, 'index.db'),
      items: [item({ id: 'PM-outage', type: 'postmortem' })], config: resolveConfig({}),
    });
    assert.ok(findings.some((f) => f.code === 'unknown_category' && f.item === 'PM-outage'),
      JSON.stringify(findings.map((f) => f.code)));
  } finally {
    cleanup();
  }
});
