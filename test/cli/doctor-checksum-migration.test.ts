import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { parseItem } from '../../src/core/item.ts';
import { writeItem } from '../../src/core/rebuild.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext doctor` must tell "the recorded checksum's BASIS changed" (a
 * migration `mycontext repair` clears) apart from "the CONTENT changed" (real
 * corruption) — see item.ts's `classifyChecksumMismatch` and rebuild.ts's
 * `LoadError.kind`. This exercises the CLI end to end: a project item whose
 * checksum is tagged with a basis version this build does not compute (its
 * hash is otherwise the real, correct one — only the version tag is stale)
 * must be reported as a `warn`-level `checksum_basis_migration` finding
 * naming `mycontext repair`, and must NOT push the corpus into the
 * "corruption" / non-zero-exit path the same command reserves for a real
 * content alteration.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-doctor-migration-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** Writes a well-formed, correctly-checksummed item through the real write
 *  path, then re-tags its recorded checksum's basis version WITHOUT changing
 *  the hash — simulating an item whose content never moved but whose
 *  recorded checksum was computed under a since-retired formula. */
function writeMigratedItem(root: string, id: string, type: string): string {
  const rel = `items/${type}/${id}.md`;
  const shell = `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\nBody.\n`;
  const file = writeItem(root, parseItem(shell, rel, 'project'));
  const text = readFileSync(file, 'utf8');
  const m = /^checksum: ([0-9a-f]{16})$/m.exec(text);
  if (!m) throw new Error(`test fixture: could not find a bare v1 checksum in ${file}`);
  writeFileSync(file, text.replace(`checksum: ${m[1]}`, `checksum: "2:${m[1]}"`), 'utf8');
  return file;
}

test('a corpus entirely on an older checksum basis is a MIGRATION finding, not corruption', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    writeMigratedItem(root, 'CONST-a', 'constraint');

    const { code, out } = run(['doctor'], cwd);

    assert.equal(code, 0, 'a basis migration alone must not fail the build the way corruption does');
    assert.match(out, /checksum_basis_migration/);
    assert.match(out, /\[warn\]/);
    assert.match(out, /mycontext repair/);
    assert.match(out, /MIGRATION/);
    // The exact claim Part B forbids on this branch.
    assert.doesNotMatch(out, /may already have been lost/);
    // And it must not be folded into "corpus load errors", which is the
    // block that means "this corpus failed to load" and drives doctor's
    // corruption-style reporting.
    assert.doesNotMatch(out, /corpus load error/);
    assert.match(out, /0 error\(s\)/);
  });
});

test('doctor --json reports the migration as a warn-level finding, not a load error', () => {
  withProject((cwd) => {
    const root = path.join(cwd, '.my_context');
    writeMigratedItem(root, 'CONST-a', 'constraint');

    const { code, out } = run(['doctor', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out.trim());
    assert.equal(doc.loadErrorCount, 0);
    assert.equal(doc.exitCode, 0);
    const migrationFinding = doc.findings.find((f: { code: string }) => f.code === 'checksum_basis_migration');
    assert.ok(migrationFinding, 'expected a checksum_basis_migration finding in the JSON findings array');
    assert.equal(migrationFinding.level, 'warn');
    assert.equal(migrationFinding.item, 'CONST-a');
  });
});
