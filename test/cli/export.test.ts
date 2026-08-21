/**
 * `mycontext export` — the command over `buildBundle`, the two writers, and
 * the preview it prints on every path.
 *
 * **What this file is for, and what it deliberately leaves to `test/pack/`.**
 * The bytes an artefact carries are `bundle.test.ts`'s subject, the directory
 * shape is `dir-writer.test.ts`'s and the archive layout is `zip.test.ts`'s.
 * Re-asserting any of those here would be a second copy of a decision that
 * already has an owner. What is only true at this seam is asserted here: the
 * refusals happen before the corpus is opened, `--out` is honoured relative to
 * the directory the user typed the command in, the preview is printed on every
 * path including `--dry-run`, and the preview names what did NOT travel —
 * which is the disclosure half of the allow-list and the half no lower module
 * is in a position to print.
 *
 * **The F2 rule is tested here as well as in `f2-registry.test.ts`.** The
 * registry guard proves the exit code and that the load error is reported; the
 * test below additionally proves that the export still HAPPENED — that the
 * artefact is on disk and verifies — which is the half a guard driven by exit
 * codes cannot see, and the half a new command most often gets wrong by
 * treating an unrelated corrupt file as a reason to write nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { parseItem } from '../../src/core/item.ts';
import { parseManifest } from '../../src/pack/manifest.ts';
import { readArtefact } from '../../src/pack/reader.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; dispose(): void }

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/**
 * A workspace with three items: two normative and active, one `reference`
 * carrying provenance so `--as-pack` has something real to drop.
 */
function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-export-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  assert.equal(
    runCli(['add', 'constraint', 'Postgres pool capped at 20', '--yes'], cwd, () => {}), 0,
  );
  assert.equal(
    runCli(['add', 'rule', 'Never log customer email', '--yes'], cwd, () => {}), 0,
  );
  writeFileSync(path.join(cwd, 'roadmap.md'), '# Roadmap\n\n## Q3\n\n- one\n', 'utf8');
  assert.equal(
    runCli(['add', 'reference', 'Billing roadmap', '--file', 'roadmap.md'], cwd, () => {}), 0,
  );
  return { cwd, dispose: () => removeTree(cwd) };
}

/** The same fixture every F2 test in this suite plants. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n',
  );
}

/** Wrapping is a layout decision; a phrase assertion must not depend on it. */
function flat(out: string): string {
  return out.replace(/\s+/g, ' ');
}

/* -------------------------------------------------------------------------- *
 * Refusals — every one of them before the corpus is opened.
 * -------------------------------------------------------------------------- */

test('an unknown flag is refused before the corpus is opened, and nothing is written', () => {
  const p = project();
  try {
    // The corrupt file is the probe: every path that opens the corpus reports
    // it (that is F2, asserted below), so a refusal whose output does NOT name
    // it is a refusal that happened first. This is the only assertion
    // available for "before" that does not reach inside the command.
    plantUnrelatedCorruptItem(p.cwd);
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out, '--bogus'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /unknown option "--bogus"/);
    assert.match(result.out, /usage: mycontext export/);
    assert.doesNotMatch(
      result.out, /CONST-broken\.md/,
      'the corpus was opened before the flag was refused',
    );
    assert.equal(existsSync(out), false);
  } finally { p.dispose(); }
});

test('a positional argument is refused — the destination is a flag, not a word', () => {
  const p = project();
  try {
    const result = run(['export', 'somewhere'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /usage: mycontext export/);
    assert.equal(existsSync(path.join(p.cwd, 'somewhere')), false);
  } finally { p.dispose(); }
});

test('--out is required unless --dry-run, and the refusal names the flag', () => {
  const p = project();
  try {
    const result = run(['export'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /--out/);
  } finally { p.dispose(); }
});

test('--format takes dir or zip, and any other word is refused rather than guessed', () => {
  const p = project();
  try {
    const result = run(['export', '--out', path.join(p.cwd, 'a'), '--format', 'tar'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /"tar"/);
    assert.match(flat(result.out), /dir/);
    assert.match(flat(result.out), /zip/);
    assert.equal(existsSync(path.join(p.cwd, 'a')), false);
  } finally { p.dispose(); }
});

test('--as-pack without --pack-version is refused, naming the flag', () => {
  const p = project();
  try {
    const result = run(
      ['export', '--out', path.join(p.cwd, 'a'), '--as-pack', '--pack-name', 'acme'], p.cwd,
    );
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /--pack-version/);
    assert.equal(existsSync(path.join(p.cwd, 'a')), false);
  } finally { p.dispose(); }
});

test('--as-pack without --pack-name is refused, naming the flag', () => {
  const p = project();
  try {
    const result = run(
      ['export', '--out', path.join(p.cwd, 'a'), '--as-pack', '--pack-version', '2026.8'], p.cwd,
    );
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /--pack-name/);
    assert.equal(existsSync(path.join(p.cwd, 'a')), false);
  } finally { p.dispose(); }
});

test('--pack-version without --as-pack is refused, naming the flag', () => {
  const p = project();
  try {
    const result = run(
      ['export', '--out', path.join(p.cwd, 'a'), '--pack-version', '2026.8'], p.cwd,
    );
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /--pack-version/);
    assert.match(result.out, /--as-pack/);
    assert.equal(existsSync(path.join(p.cwd, 'a')), false);
  } finally { p.dispose(); }
});

test('--pack-name without --as-pack is refused, naming the flag', () => {
  const p = project();
  try {
    const result = run(['export', '--out', path.join(p.cwd, 'a'), '--pack-name', 'acme'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /--pack-name/);
    assert.match(result.out, /--as-pack/);
  } finally { p.dispose(); }
});

test('an existing --out is refused, and the existing content is untouched', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'occupied');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'mine.txt'), 'do not lose this\n', 'utf8');
    const result = run(['export', '--out', out], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.equal(readFileSync(path.join(out, 'mine.txt'), 'utf8'), 'do not lose this\n');
    assert.equal(existsSync(path.join(out, 'manifest.json')), false);
  } finally { p.dispose(); }
});

test('an existing --out is refused for a ZIP too, and the file on disk is untouched', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'acme.zip');
    writeFileSync(out, 'not really an archive\n', 'utf8');
    const result = run(['export', '--out', out, '--format', 'zip'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.equal(readFileSync(out, 'utf8'), 'not really an archive\n');
  } finally { p.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * The two formats.
 * -------------------------------------------------------------------------- */

test('--format dir writes the canonical shape and prints the preview', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out], p.cwd);
    assert.equal(result.code, 0, result.out);

    assert.ok(existsSync(path.join(out, 'manifest.json')), 'no manifest.json');
    assert.ok(existsSync(path.join(out, 'config.json')), 'no config.json');
    assert.ok(existsSync(path.join(out, 'history.jsonl')), 'no history.jsonl');
    const manifest = parseManifest(readFileSync(path.join(out, 'manifest.json')));
    assert.equal(manifest.kind, 'export');
    assert.equal(manifest.itemCount, 3);

    // The artefact reads back through the reader that will import it, so the
    // command is held to the format rather than to its own idea of one.
    const artefact = readArtefact(out);
    assert.equal(artefact.format, 'dir');
    assert.deepEqual(artefact.verification, { missing: [], extra: [], mismatched: [] });
    assert.equal(artefact.items.length, 3);

    const flattened = flat(result.out);
    assert.match(flattened, /about to export 3 item\(s\)/);
    assert.match(flattened, /constraint 1/);
    assert.match(flattened, /rule 1/);
    assert.match(flattened, /reference 1/);
  } finally { p.dispose(); }
});

test('--format zip writes one file whose first four bytes are the local header signature', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'acme.zip');
    const result = run(['export', '--out', out, '--format', 'zip'], p.cwd);
    assert.equal(result.code, 0, result.out);

    const bytes = readFileSync(out);
    assert.deepEqual([...bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
    const artefact = readArtefact(out);
    assert.equal(artefact.format, 'zip');
    assert.equal(artefact.items.length, 3);
    assert.deepEqual(artefact.verification, { missing: [], extra: [], mismatched: [] });
  } finally { p.dispose(); }
});

test('--out is resolved against the directory the command was run in', () => {
  const p = project();
  try {
    const result = run(['export', '--out', 'relative-artefact'], p.cwd);
    assert.equal(result.code, 0, result.out);
    assert.ok(
      existsSync(path.join(p.cwd, 'relative-artefact', 'manifest.json')),
      'a relative --out landed somewhere other than the working directory',
    );
  } finally { p.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * The pack projection.
 * -------------------------------------------------------------------------- */

test('--as-pack names the pack in the manifest and drops provenance, and says so', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'pack');
    const result = run([
      'export', '--out', out, '--as-pack', '--pack-name', 'acme-security',
      '--pack-version', '2026.8.1',
    ], p.cwd);
    assert.equal(result.code, 0, result.out);

    const manifest = parseManifest(readFileSync(path.join(out, 'manifest.json')));
    assert.equal(manifest.kind, 'pack');
    assert.equal(manifest.name, 'acme-security');
    assert.equal(manifest.version, '2026.8.1');

    const file = path.join(out, 'items', 'reference', 'REF-billing-roadmap.md');
    const item = parseItem(readFileSync(file, 'utf8'), 'items/reference/REF-billing-roadmap.md', 'project');
    assert.equal(item.sourceFile, null);
    assert.equal(item.sourceChecksum, null);

    const flattened = flat(result.out);
    assert.match(flattened, /as a pack/);
    assert.match(flattened, /dropped for a pack/);
    assert.match(flattened, /source_file/);
  } finally { p.dispose(); }
});

test('a full export keeps provenance — the repository travels with the corpus', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'artefact');
    assert.equal(run(['export', '--out', out], p.cwd).code, 0);
    const relative = 'items/reference/REF-billing-roadmap.md';
    const item = parseItem(readFileSync(path.join(out, ...relative.split('/')), 'utf8'), relative, 'project');
    assert.equal(item.sourceFile, 'roadmap.md');
  } finally { p.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * Selection, history and the disclosure.
 * -------------------------------------------------------------------------- */

test('--type narrows the selection and every withheld item is named with its flag', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out, '--type', 'constraint'], p.cwd);
    assert.equal(result.code, 0, result.out);
    assert.equal(readArtefact(out).items.length, 1);
    assert.match(flat(result.out), /excluded by --type/);
  } finally { p.dispose(); }
});

test('--no-history writes no history.jsonl at all, which is not the same as an empty one', () => {
  const p = project();
  try {
    const withHistory = path.join(p.cwd, 'with');
    const without = path.join(p.cwd, 'without');
    assert.equal(run(['export', '--out', withHistory], p.cwd).code, 0);
    assert.equal(run(['export', '--out', without, '--no-history'], p.cwd).code, 0);
    assert.ok(existsSync(path.join(withHistory, 'history.jsonl')));
    assert.equal(existsSync(path.join(without, 'history.jsonl')), false);
  } finally { p.dispose(); }
});

test('the preview names what does NOT travel', () => {
  const p = project();
  try {
    const output = run(['export', '--dry-run'], p.cwd).out;
    assert.match(output, /not travelling/);
    for (const absent of ['revisions', 'ingest', 'index', 'session state']) {
      assert.match(flat(output), new RegExp(absent));
    }
  } finally { p.dispose(); }
});

test('--dry-run prints the preview and creates nothing', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out, '--dry-run'], p.cwd);
    assert.equal(result.code, 0, result.out);
    assert.match(flat(result.out), /about to export 3 item\(s\)/);
    assert.equal(existsSync(out), false);
  } finally { p.dispose(); }
});

test('--dry-run needs no --out, because there is nothing it would write there', () => {
  const p = project();
  try {
    const result = run(['export', '--dry-run'], p.cwd);
    assert.equal(result.code, 0, result.out);
    assert.match(flat(result.out), /about to export 3 item\(s\)/);
  } finally { p.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * `--json`, and the F2 rule.
 * -------------------------------------------------------------------------- */

test('--json emits one parseable document with load errors inside it', () => {
  const p = project();
  try {
    plantUnrelatedCorruptItem(p.cwd);
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out, '--json'], p.cwd);
    assert.equal(result.code, 0, result.out);

    const doc = JSON.parse(result.out) as {
      kind: string; format: string; out: string; dryRun: boolean; written: boolean;
      items: number; files: string[];
      loadErrors: { file: string; message: string }[];
    };
    assert.equal(doc.kind, 'export');
    assert.equal(doc.format, 'dir');
    assert.equal(doc.dryRun, false);
    assert.equal(doc.written, true);
    assert.equal(doc.items, 3);
    assert.ok(doc.files.includes('manifest.json'), `no manifest.json in ${doc.files.join(', ')}`);
    assert.equal(doc.loadErrors.length, 1);
    assert.match(doc.loadErrors[0].file, /CONST-broken\.md/);
  } finally { p.dispose(); }
});

test('--dry-run --json says written: false and leaves the destination alone', () => {
  const p = project();
  try {
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out, '--dry-run', '--json'], p.cwd);
    assert.equal(result.code, 0, result.out);
    const doc = JSON.parse(result.out) as { dryRun: boolean; written: boolean };
    assert.equal(doc.dryRun, true);
    assert.equal(doc.written, false);
    assert.equal(existsSync(out), false);
  } finally { p.dispose(); }
});

test('a load error elsewhere in the corpus does not turn a successful export into a failure', () => {
  // The F2 rule, restated as a test because it is the rule a new command
  // most often gets wrong.
  const p = project();
  try {
    plantUnrelatedCorruptItem(p.cwd);
    const out = path.join(p.cwd, 'artefact');
    const result = run(['export', '--out', out], p.cwd);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /CONST-broken\.md/);
    // The half an exit-code guard cannot see: the export still happened, and
    // the artefact it wrote verifies.
    assert.deepEqual(readArtefact(out).verification, { missing: [], extra: [], mismatched: [] });
  } finally { p.dispose(); }
});

test('there is no --yes on export, because there is no corpus write to confirm', () => {
  // Design decision 9, asserted rather than stated: a confirmation here would
  // train the reflex the gate on the import side depends on.
  const p = project();
  try {
    const result = run(['export', '--out', path.join(p.cwd, 'a'), '--yes'], p.cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /unknown option "--yes"/);
  } finally { p.dispose(); }
});

test('export outside a workspace says so rather than writing an empty artefact', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-export-bare-'));
  try {
    const result = run(['export', '--out', path.join(cwd, 'a')], cwd);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /no workspace here/);
    assert.equal(existsSync(path.join(cwd, 'a')), false);
  } finally { removeTree(cwd); }
});
