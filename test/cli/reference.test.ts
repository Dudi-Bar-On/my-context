import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, runCli } from '../../src/cli/index.ts';
import { checkSourceDrift } from '../../src/doctor/checks.ts';
import { snapshotChecksum, snapshotSource } from '../../src/core/reference.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext add --file`, `mycontext refresh`, and the `doctor` finding that
 * joins them — the whole `reference` loop from the human surface.
 *
 * The claims under test are the ones the documentation makes, and each is one
 * a reader would be entitled to act on: the body is the file rather than
 * anything composed here, the item records where it came from, the file is
 * never re-read behind the user's back, drift is reported with the command
 * that resolves it, and the refresh goes through the same confirmation any
 * other content change does.
 */

const ROADMAP = ['# Roadmap', '', '## Q3', '', '- usage-based pricing', ''].join('\n');
const ROADMAP_V2 = ['# Roadmap', '', '## Q3', '', '- usage-based pricing', '- dunning', ''].join('\n');

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-refcli-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'));
  writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP, 'utf8');
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function items(cwd: string): Item[] {
  const { store } = openStore(resolveWorkspace(cwd));
  const all = store.all();
  store.close();
  return all;
}

function get(cwd: string, id: string): Item {
  const item = items(cwd).find((i) => i.id === id);
  assert.ok(item, `no item ${id}`);
  return item!;
}

/** `doctor`'s own call shape: repoRoot is the parent of `.my_context`. */
function findings(cwd: string): ReturnType<typeof checkSourceDrift> {
  return checkSourceDrift(cwd, items(cwd));
}

function capture(cwd: string): { code: number; out: string } {
  return run(['add', '--summary-omitted', 'reference', 'Roadmap', '--file', 'docs/roadmap.md'], cwd);
}

// --- capture ---

test('--file stores the file as the body and records where it came from', () => {
  const cwd = sandbox();
  try {
    const { code } = capture(cwd);
    assert.equal(code, 0);
    const item = get(cwd, 'REF-roadmap');
    assert.equal(item.sourceFile, 'docs/roadmap.md');
    assert.equal(item.sourceAnchor, null, 'a whole-file snapshot has no anchor');
    assert.equal(item.sourceChecksum, snapshotChecksum(ROADMAP));
    assert.equal(snapshotSource(item.body), ROADMAP.trim(),
      'the body is not the file — that is the one thing a reference may not be');
  } finally {
    removeTree(cwd);
  }
});

test('the capture always says what the snapshot costs, and what the tier does with it', () => {
  const cwd = sandbox();
  try {
    const { out } = capture(cwd);
    assert.match(out, /snapshotting docs\/roadmap\.md — \d+ line\(s\), \d+ bytes, ~\d+ estimated tokens/);
    // The honest half: on the rationale tier the size costs the injection
    // budget nothing, and a message claiming otherwise would be false.
    assert.match(out, /rationale tier[\s\S]*costs the injection budget nothing/);
    assert.match(out, /changes what governs this project/);
  } finally {
    removeTree(cwd);
  }
});

test('--body and --file together are refused, and nothing is created', () => {
  const cwd = sandbox();
  try {
    const { code, out } = run(
      ['add', '--summary-omitted', 'reference', 'Roadmap', '--file', 'docs/roadmap.md', '--body', 'mine'], cwd,
    );
    assert.equal(code, 1);
    assert.match(out, /--body and --file both supply the item's body/);
    assert.deepEqual(items(cwd), [], 'a refused capture must write nothing');
  } finally {
    removeTree(cwd);
  }
});

test('a --file refusal lands before the item is created, not after', () => {
  const cwd = sandbox();
  try {
    const { code, out } = run(['add', '--summary-omitted', 'reference', 'Missing', '--file', 'docs/nope.md'], cwd);
    assert.equal(code, 1);
    assert.match(out, /could not be read/);
    assert.deepEqual(items(cwd), []);
  } finally {
    removeTree(cwd);
  }
});

test('--note records the WHY the snapshot itself cannot carry', () => {
  const cwd = sandbox();
  try {
    const { code } = run([
      'add', '--summary-omitted', 'reference', 'Roadmap', '--file', 'docs/roadmap.md',
      '--note', 'The ordering is what matters; the dates move.',
      '--note', 'Retire this when billing moves out of the monolith.',
    ], cwd);
    assert.equal(code, 0);
    const item = get(cwd, 'REF-roadmap');
    assert.deepEqual(
      item.observations.map((o) => `${o.category}: ${o.text}`),
      [
        'note: The ordering is what matters; the dates move.',
        'note: Retire this when billing moves out of the monolith.',
      ],
      'every --note is kept, in command-line order — the second must not be dropped',
    );
  } finally {
    removeTree(cwd);
  }
});

test('a snapshot into a NORMATIVE category says so before the confirmation', () => {
  const cwd = sandbox();
  try {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { reference: { tier: 'normative' } } }),
      'utf8',
    );
    // No `--yes`: stdin is not interactive under `node --test`, so the gate
    // refuses — which is the point. What matters is that the disclosure is
    // printed BEFORE it, where a human would read it.
    const { code, out } = capture(cwd);
    assert.equal(code, 1);
    assert.deepEqual(items(cwd), []);
    assert.match(out, /this body is a snapshot of docs\/roadmap\.md, not text written here/);
    assert.match(out, /governing this project at once/);
    assert.ok(
      out.indexOf('snapshot of docs/roadmap.md') < out.indexOf('stdin')
      || !out.includes('stdin'),
      'the disclosure must precede the confirmation refusal',
    );
    // And the budget half changes with the tier rather than staying put.
    assert.match(out, /competes for the injection budget|can never be injected in full/);
  } finally {
    removeTree(cwd);
  }
});

// --- drift ---

test('doctor is silent while the file is unchanged, and names refresh once it is not', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    assert.deepEqual(findings(cwd), [], 'a fresh snapshot is not drift');

    writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP_V2, 'utf8');
    const drifted = findings(cwd);
    assert.equal(drifted.length, 1);
    assert.equal(drifted[0].code, 'source_drift');
    assert.equal(drifted[0].item, 'REF-roadmap');
    assert.match(drifted[0].message, /mycontext refresh REF-roadmap/,
      'the finding must name the route out, not merely report the divergence');
    assert.match(drifted[0].message, /still holds the OLD text/);
  } finally {
    removeTree(cwd);
  }
});

test('the snapshot is never re-read behind the user: the item is unchanged after drift', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    const before = get(cwd, 'REF-roadmap');
    writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP_V2, 'utf8');
    // Every command below rebuilds the index from Markdown; none of them may
    // pick up the new text. A live read here would be the trust hole.
    run(['list'], cwd);
    run(['status'], cwd);
    const after = get(cwd, 'REF-roadmap');
    assert.equal(after.body, before.body);
    assert.equal(after.sourceChecksum, before.sourceChecksum);
  } finally {
    removeTree(cwd);
  }
});

test('a deleted source is an error naming what the item still holds', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP, 'utf8');
    removeTree(path.join(cwd, 'docs'));
    const found = findings(cwd);
    assert.equal(found.length, 1);
    assert.equal(found[0].code, 'source_missing');
    assert.match(found[0].message, /still holds the snapshot/);
  } finally {
    removeTree(cwd);
  }
});

// --- refresh ---

test('refresh replaces the body, updates the checksum, and clears the finding', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP_V2, 'utf8');

    const { code, out } = run(['refresh', 'REF-roadmap', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /checksum\s+\w+ -> \w+/);
    assert.match(out, /size\s+\d+ -> \d+ line\(s\)/);

    const item = get(cwd, 'REF-roadmap');
    assert.equal(snapshotSource(item.body), ROADMAP_V2.trim());
    assert.equal(item.sourceChecksum, snapshotChecksum(ROADMAP_V2));
    assert.deepEqual(findings(cwd), []);
  } finally {
    removeTree(cwd);
  }
});

test('refresh without --yes writes nothing — it is the same gate every content change has', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    const before = get(cwd, 'REF-roadmap');
    writeFileSync(path.join(cwd, 'docs', 'roadmap.md'), ROADMAP_V2, 'utf8');

    const { code } = run(['refresh', 'REF-roadmap'], cwd);
    assert.equal(code, 1);
    assert.equal(get(cwd, 'REF-roadmap').body, before.body, 'a declined refresh wrote anyway');
  } finally {
    removeTree(cwd);
  }
});

test('refresh on an unchanged file says so and writes nothing', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    const file = path.join(cwd, '.my_context', 'items', 'reference', 'REF-roadmap.md');
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['refresh', 'REF-roadmap', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /already current/);
    assert.equal(readFileSync(file, 'utf8'), before, 'a no-op refresh rewrote the file');
  } finally {
    removeTree(cwd);
  }
});

test('refresh refuses an item that is not a snapshot, and says which kind it is', () => {
  const cwd = sandbox();
  try {
    run(['add', '--summary-omitted', 'decision', 'A decision with no source'], cwd);
    const { code, out } = run(['refresh', 'DEC-a-decision-with-no-source', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /records no source file/);
    assert.match(out, /--file/);
  } finally {
    removeTree(cwd);
  }
});

test('refresh refuses an INGESTED item rather than overwriting an extraction', () => {
  const cwd = sandbox();
  try {
    // The shape ingest produces: a source file AND an anchor, with a body that
    // is somebody's assertion about the section rather than a copy of it.
    const dir = path.join(cwd, '.my_context', 'items', 'requirement');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'REQ-x.md'), [
      '---', 'id: REQ-x', 'type: requirement', 'title: X', 'status: active',
      'source_file: docs/roadmap.md', 'source_anchor: q3', 'source_checksum: abc0000000000000',
      '---', '', '# X', '', 'Somebody wrote this from the section.', '',
    ].join('\n'), 'utf8');
    run(['repair', '--yes'], cwd);

    const { code, out } = run(['refresh', 'REQ-x', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /extracted from/);
    assert.match(out, /discard that work/);
  } finally {
    removeTree(cwd);
  }
});

test('an ingested item keeps the anchored drift check, not the snapshot one', () => {
  const cwd = sandbox();
  try {
    capture(cwd);
    const dir = path.join(cwd, '.my_context', 'items', 'requirement');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'REQ-x.md'), [
      '---', 'id: REQ-x', 'type: requirement', 'title: X', 'status: active',
      'source_file: docs/roadmap.md', 'source_anchor: nonexistent-heading',
      'source_checksum: abc0000000000000',
      '---', '', '# X', '', 'Somebody wrote this from the section.', '',
    ].join('\n'), 'utf8');
    run(['repair', '--yes'], cwd);

    const codes = findings(cwd).map((f) => `${f.item}:${f.code}`);
    // The snapshot is clean; the anchored item reports through its own check,
    // and neither item is reported twice.
    assert.deepEqual(codes, ['REQ-x:source_anchor_missing']);
  } finally {
    removeTree(cwd);
  }
});
