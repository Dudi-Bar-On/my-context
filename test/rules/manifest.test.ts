// @basis TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it, INV-nothing-is-dropped-silently
/**
 * **A damaged store refuses WRITES and still allows READS, and names the entry
 * that is wrong.**
 *
 * D41 spec §13, `plan:store seq:1` Task 4. The two halves of that sentence are
 * asserted separately below and the second matters as much as the first:
 * blocking reads punishes a user for a damaged install they can still recover
 * from. It is a safety catch, not a hostage.
 *
 * The distinction spec §13 draws — that this refusal is NOT §10's budget
 * refusal — lives in a comment beside the refusal itself, in
 * `src/rules/manifest.ts`, and `the refusal says which refusal it is not` at
 * the foot of this file holds it there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  MANIFEST_FILE, StoreDamagedError, assertStoreWritable, manifestPath, readManifest,
  restoreEntries, verifyManifest, writeEntry, writeManifest,
} from '../../src/rules/manifest.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SEED = 'numbered-options-on-a-question-put-to-the-owner';

/** A throwaway copy of the shipped store, with its manifest regenerated. */
function copy(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-manifest-'));
  cpSync(entriesDir(), dir, { recursive: true });
  writeManifest(dir);
  return dir;
}

function withCopy(fn: (dir: string) => void): void {
  const dir = copy();
  try { fn(dir); } finally { removeTree(dir); }
}

/** The file one entry id lives in, inside `dir`. */
function fileOf(dir: string, id: string): string {
  const row = readManifest(dir).entries.find((e) => e.id === id);
  assert.ok(row !== undefined, `${id} is not in the manifest`);
  return path.join(dir, row.file);
}

/* ══ 1. A CLEAN STORE ══════════════════════════════════════════════════════ */

test('a store whose manifest was just written verifies', () => {
  withCopy((dir) => assert.deepEqual(verifyManifest(dir), { ok: true }));
});

test('the shipped store verifies against the manifest that ships with it', () => {
  const answer = verifyManifest(entriesDir());
  assert.deepEqual(
    answer, { ok: true },
    'the store as committed does not match its own manifest. Regenerate it with ' +
    '`mycontext rules verify --restore` only after establishing WHY it drifted — every later ' +
    'phase treats this store as true.',
  );
});

test('the manifest lists every entry, by id as well as by file', () => {
  const manifest = readManifest(entriesDir());
  assert.deepEqual(
    manifest.entries.map((e) => e.id).sort(),
    loadRules(entriesDir(), true).entries.map((e) => e.id).sort(),
    'the manifest and the loader disagree about what is in the store',
  );
  assert.ok(manifest.entries.every((e) => /^[0-9a-f]{64}$/.test(e.checksum)));
});

/* ══ 2. A DAMAGED STORE, AND WHICH ENTRY ═══════════════════════════════════ */

test('an altered entry is NAMED, not merely reported', () => {
  withCopy((dir) => {
    appendFileSync(fileOf(dir, SEED), '\nquietly added.\n', 'utf8');
    const answer = verifyManifest(dir);
    assert.equal(answer.ok, false);
    if (answer.ok) return;
    assert.equal(answer.why, 'altered');
    assert.equal(
      answer.entry, SEED,
      'the refusal did not name the entry. "The store is damaged" is not actionable; ' +
      '"this entry is altered" is.',
    );
  });
});

test('a missing entry is named, and distinguished from an altered one', () => {
  withCopy((dir) => {
    rmSync(fileOf(dir, SEED));
    const answer = verifyManifest(dir);
    assert.equal(answer.ok, false);
    if (answer.ok) return;
    assert.equal(answer.entry, SEED);
    assert.equal(
      answer.why, 'missing',
      'a deleted entry was reported as altered. The two have different remedies — one is put ' +
      'back from the package, the other is a change somebody made and may want to keep.',
    );
  });
});

/**
 * An ADDED entry is the third damage, and it is the one a manifest of
 * checksums would miss if it only walked its own rows: a file nobody shipped,
 * carrying a rule nobody wrote, loads exactly like a real one.
 */
test('an entry the manifest never listed is reported, not ignored', () => {
  withCopy((dir) => {
    writeFileSync(path.join(dir, 'planted.md'), '---\nid: planted\n---\n', 'utf8');
    const answer = verifyManifest(dir);
    assert.equal(answer.ok, false);
    if (answer.ok) return;
    assert.equal(answer.why, 'unexpected');
    assert.match(answer.entry, /planted/);
  });
});

test('every damaged entry is reported, not only the first', () => {
  withCopy((dir) => {
    appendFileSync(fileOf(dir, SEED), '\naltered.\n', 'utf8');
    writeFileSync(path.join(dir, 'planted.md'), '---\nid: planted\n---\n', 'utf8');
    const answer = verifyManifest(dir);
    assert.equal(answer.ok, false);
    if (answer.ok) return;
    assert.equal(
      answer.problems.length, 2,
      'two entries are damaged and the report named one. Naming the first and dropping the rest ' +
      'is a drop (INV-nothing-is-dropped-silently), and it makes a repair look complete when it ' +
      'has fixed half the damage.',
    );
  });
});

test('a store with no manifest at all is damaged, and says so in those words', () => {
  withCopy((dir) => {
    rmSync(manifestPath(dir));
    const answer = verifyManifest(dir);
    assert.equal(answer.ok, false);
    if (answer.ok) return;
    assert.match(answer.problems[0].detail, /manifest/i);
  });
});

/* ══ 3. REFUSES WRITES, ALLOWS READS ═══════════════════════════════════════ */

test('a damaged store REFUSES WRITES and names the entry in the refusal', () => {
  withCopy((dir) => {
    appendFileSync(fileOf(dir, SEED), '\naltered.\n', 'utf8');
    assert.throws(
      () => writeEntry(dir, 'anything.md', '---\nid: x\n---\n'),
      (err: unknown) => {
        assert.ok(err instanceof StoreDamagedError, 'a write on a damaged store threw the wrong error');
        assert.match(err.message, new RegExp(SEED), 'the refusal does not name the damaged entry');
        return true;
      },
    );
  });
});

/**
 * **The half that matters as much, and is the one an implementation drops.**
 * Spec §13: *"Refuse writes, not reads. Blocking reads punishes a user for a
 * damaged install they can still recover from."*
 */
test('a damaged store STILL READS, and returns the entries that are intact', () => {
  withCopy((dir) => {
    appendFileSync(fileOf(dir, SEED), '\naltered.\n', 'utf8');
    assert.equal(verifyManifest(dir).ok, false, 'the store under test is not actually damaged');

    const { entries, refused } = loadRules(dir, true);
    assert.deepEqual(refused, [], 'a damaged store stopped loading. Reads are not the catch.');
    assert.ok(
      entries.some((e) => e.id === SEED),
      'the altered entry was withheld from a read. A user with a damaged install can still ' +
      'recover from it, and cannot recover from a tool that has stopped answering.',
    );
  });
});

test('a clean store writes without complaint, so the refusal is about damage', () => {
  withCopy((dir) => {
    writeEntry(dir, 'added.md', '---\nid: added\n---\n');
    assert.equal(readFileSync(path.join(dir, 'added.md'), 'utf8'), '---\nid: added\n---\n');
  });
});

/**
 * Regenerating the manifest is how a damaged store is made whole, so gating
 * that regeneration on the manifest being intact would make damage
 * unrecoverable — the one shape a safety catch must not have.
 */
test('the manifest can be regenerated on a damaged store, or damage is a dead end', () => {
  withCopy((dir) => {
    appendFileSync(fileOf(dir, SEED), '\naltered.\n', 'utf8');
    writeManifest(dir);
    assert.deepEqual(verifyManifest(dir), { ok: true });
  });
});

/* ══ 4. RESTORE, FROM THE PACKAGE AND FROM NOWHERE ELSE ════════════════════ */

test('restore puts back an altered entry, byte for byte, from the installed package', () => {
  withCopy((dir) => {
    const file = fileOf(dir, SEED);
    const before = readFileSync(file, 'utf8');
    appendFileSync(file, '\naltered.\n', 'utf8');

    const report = restoreEntries(entriesDir(), dir);
    assert.deepEqual(report.restored, [SEED]);
    assert.equal(readFileSync(file, 'utf8'), before);
    assert.deepEqual(verifyManifest(dir), { ok: true });
  });
});

test('restore puts back a missing entry', () => {
  withCopy((dir) => {
    rmSync(fileOf(dir, SEED));
    assert.deepEqual(restoreEntries(entriesDir(), dir).restored, [SEED]);
    assert.deepEqual(verifyManifest(dir), { ok: true });
  });
});

/**
 * A planted entry is NAMED and left where it is. Deleting a file nobody asked
 * to delete is the shape this project refuses elsewhere for the same reason
 * (`conversation persist --off` leaves the copy exactly where it is): a
 * restore that silently removed a file could destroy the only copy of
 * something a person put there on purpose.
 */
test('restore names an entry it did not put there, and does not delete it', () => {
  withCopy((dir) => {
    const planted = path.join(dir, 'planted.md');
    writeFileSync(planted, '---\nid: planted\n---\n', 'utf8');
    const report = restoreEntries(entriesDir(), dir);
    assert.deepEqual(report.restored, []);
    assert.deepEqual(report.unexpected, ['planted.md']);
    assert.equal(readFileSync(planted, 'utf8'), '---\nid: planted\n---\n');
  });
});

test('restore on an undamaged store changes nothing and says so', () => {
  withCopy((dir) => {
    const report = restoreEntries(entriesDir(), dir);
    assert.deepEqual(report, { restored: [], unexpected: [] });
  });
});

/**
 * Spec §13: *"restores from the installed package first, the network only as a
 * fallback"* — and this phase builds no fallback at all. Asserted the only way
 * an absence of network can be asserted: the modules that would do it carry no
 * way to. Running with no network available would prove nothing, because a
 * restore that never needed the network passes that test whether or not the
 * code is there.
 */
test('nothing in the store can reach the network', () => {
  const files = ['schema.ts', 'store.ts', 'manifest.ts']
    .map((f) => path.join(import.meta.dirname, '..', '..', 'src', 'rules', f));
  files.push(path.join(import.meta.dirname, '..', '..', 'src', 'cli', 'commands', 'rules.ts'));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const shape of [/\bfetch\s*\(/, /node:https?/, /node:net/, /node:dgram/, /XMLHttpRequest/]) {
      assert.ok(
        !shape.test(text),
        `${path.basename(file)} carries ${String(shape)}. The rules ship inside the package, so ` +
        `restoring them is a local operation: if the package is intact, they are intact, and ` +
        `the network is not a dependency.`,
      );
    }
  }
});

/* ══ 5. THE COMMENT SPEC §13 ASKS FOR ══════════════════════════════════════ */

/**
 * The plan asks for the distinction in a comment where the refusal lives
 * (Task 4 step 5), and a comment is exactly the artifact that gets deleted by
 * a tidy-up. This holds it there — cheaply, and it is the same shape
 * `test/docs/*` uses to hold a paragraph to a number.
 */
test('the refusal says which refusal it is not', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'rules', 'manifest.ts'), 'utf8',
  );
  assert.match(source, /budget/i, 'the refusal no longer distinguishes itself from §10\'s budget refusal');
  assert.match(
    source, /overspent/i,
    'the sentence that draws the line is gone. One refuses because we overspent; the other ' +
    'because we cannot say what is true — and they look alike enough that a reader deleting ' +
    'one will think it is the other.',
  );
});

test('the manifest file is named once, and the tests read it from there', () => {
  assert.equal(path.basename(manifestPath(entriesDir())), MANIFEST_FILE);
});
