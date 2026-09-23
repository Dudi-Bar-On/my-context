// @basis TASK-the-product-overwrote-the-repository-s-root-gitignore-with-a, INV-nothing-is-dropped-silently
/**
 * **THE REPOSITORY'S OWN `.gitignore` IS NOT THIS PRODUCT'S TO WRITE.**
 *
 * On 2026-09-23 this repository's root `.gitignore` — 73 lines, tracked — was
 * found holding the two bytes `*` and a newline, the exact content the product
 * writes into the private directories it creates. `git add reports/…` refused
 * with *"paths are ignored: reports"*, and the file was restored from `HEAD`
 * in `5664e55c`.
 *
 * Every test here PLANTS one of the conditions that could put a repository
 * root in front of one of those writers, and asserts two things each time:
 * the root file is byte-identical afterwards, and the refusal was SAID
 * (`INV-nothing-is-dropped-silently`). Each one fails against the twelve
 * hand-written `writeFileSync(path.join(dir, '.gitignore'), '*\n')` lines this
 * replaces — that is the point of planting them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  PRIVATE_DIR_NAMES, PRIVATE_GITIGNORE_BODY, writePrivateGitignore,
} from '../../src/core/private-gitignore.ts';
import { ensureLogDir, appendJsonlLine } from '../../src/core/jsonl-log.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import { setCarrySource } from '../../src/core/continuity.ts';
import { ensureDraftDir } from '../../src/core/drafts.ts';
import { ensureIngestDir } from '../../src/ingest/session.ts';
import { recordDelivery } from '../../src/rules/delivered.ts';
import { removeTree } from '../helpers/tmp.ts';

/** What a real checkout's root looks like: a `.git`, and somebody's ignore rules. */
const REAL_RULES = 'node_modules/\ndist/\n.my_context/.index.db\n';

interface Repo { root: string; ignore: string; cleanup: () => void }

function repo(): Repo {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-gi-'));
  mkdirSync(path.join(root, '.git'), { recursive: true });
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  const ignore = path.join(root, '.gitignore');
  writeFileSync(ignore, REAL_RULES, 'utf8');
  return { root, ignore, cleanup: () => removeTree(root) };
}

/** Run `fn` with stderr captured, and return everything it said. */
function said(fn: () => void): string {
  const real = process.stderr.write.bind(process.stderr);
  let out = '';
  // eslint-disable-next-line
  (process.stderr as unknown as { write: unknown }).write = (chunk: unknown): boolean => {
    out += String(chunk);
    return true;
  };
  try { fn(); } finally {
    (process.stderr as unknown as { write: unknown }).write = real;
  }
  return out;
}

/**
 * The authority's sentence shape, and the store's — deliberately one regular
 * expression rather than two, because the two implementations are meant to
 * speak with one voice and a drift in either is a drift this catches.
 */
const REFUSAL = /refused to write a `\*` \.gitignore/;

/** The two assertions every planted condition owes. */
function untouchedAndDisclosed(r: Repo, heard: string): void {
  assert.equal(
    readFileSync(r.ignore, 'utf8'), REAL_RULES,
    'the repository root .gitignore must be byte-identical — this is the 2026-09-23 damage',
  );
  assert.match(heard, REFUSAL, 'the refusal must be said, not swallowed');
}

// ── CONDITION 1: the target directory IS the repository root ────────────────
// `ensureLogDir(dir)` takes an arbitrary directory; every other writer joins a
// fixed private name onto a root. A root handed in already resolved is the
// shortest path from any of them to the repository.

test('a writer handed the repository root refuses, and the root .gitignore survives', () => {
  const r = repo();
  try {
    const heard = said(() => {
      const res = writePrivateGitignore(r.root);
      assert.equal(res.written, false);
      assert.ok(res.refusal);
    });
    untouchedAndDisclosed(r, heard);
  } finally { r.cleanup(); }
});

test('ensureLogDir on the repository root leaves the root .gitignore alone', () => {
  const r = repo();
  try {
    const heard = said(() => { ensureLogDir(r.root); });
    untouchedAndDisclosed(r, heard);
  } finally { r.cleanup(); }
});

test('appendJsonlLine still appends its record when the directory marker is refused', () => {
  const r = repo();
  try {
    const file = path.join(r.root, 'reports', 'log.jsonl');
    const heard = said(() => { appendJsonlLine(r.root, file, { protocol: 'x', a: 1 }); });
    untouchedAndDisclosed(r, heard);
    // A marker that could not be written is a disclosure, never a lost record.
    assert.match(readFileSync(file, 'utf8'), /"a":1/);
  } finally { r.cleanup(); }
});

// ── CONDITION 2: a relative directory, resolved against the wrong cwd ───────
// `path.join('.', '.gitignore')` is `.gitignore`, and `writeFileSync` resolves
// that against `process.cwd()` — the repository root for every CLI run and
// every hook in a checkout.

test('a relative target is refused rather than resolved against the working directory', () => {
  const r = repo();
  const before = process.cwd();
  try {
    process.chdir(r.root);
    const heard = said(() => {
      for (const dir of ['.', '', 'state', './.audit']) {
        assert.equal(writePrivateGitignore(dir).written, false, `${dir} must be refused`);
      }
    });
    untouchedAndDisclosed(r, heard);
    // And nothing was created beside it either.
    assert.equal(existsSync(path.join(r.root, 'state', '.gitignore')), false);
  } finally { process.chdir(before); r.cleanup(); }
});

// ── CONDITION 3: a private name reached through a link into the repository ──
// `e2e/frozen-corpus.ts` builds a sandbox out of directory junctions into this
// repository, and a path joined against one of those lands on the real thing.

test('a private directory name that is a link onto the repository root is refused', (t) => {
  const r = repo();
  try {
    // **THE ROOT FILE IS EMPTIED FIRST, AND THAT IS THE WHOLE POINT OF THIS
    // TEST.** With rules in it, refusal (4) — a `.gitignore` that carries
    // rules is somebody's file — would turn this away on its own, and the
    // test would pass without rule (3) existing at all. An EMPTY root file is
    // exactly what refusal (4) lets through (it is the self-heal case), so
    // the only thing left standing between this link and the repository root
    // is `it holds a .git` — and the assertion below names it.
    writeFileSync(r.ignore, '', 'utf8');
    const corpus = path.join(r.root, '.my_context');
    mkdirSync(corpus, { recursive: true });
    const linked = path.join(corpus, 'state');
    try {
      symlinkSync(r.root, linked, 'junction');
    } catch (err) {
      t.skip(`this process cannot create a directory link here: ${String(err)}`);
      return;
    }
    // The NAME says `state`, so rule (2) admits it.
    const heard = said(() => { assert.equal(writePrivateGitignore(linked).written, false); });
    assert.match(heard, /holds a `\.git`/,
      'the refusal must be the .git one; any other reason means rule (3) is not what stopped it');
    assert.equal(
      readFileSync(r.ignore, 'utf8'), '',
      'the repository root .gitignore must be byte-identical — this is the 2026-09-23 damage',
    );
  } finally { r.cleanup(); }
});

// ── CONDITION 4: a `.gitignore` that already carries rules ─────────────────
// The condition that alone would have prevented the 2026-09-23 damage,
// whichever call site reached the root.

test('a .gitignore with rules in it is never overwritten, wherever it sits', () => {
  const r = repo();
  try {
    const dir = path.join(r.root, '.my_context', 'state');
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, '.gitignore');
    writeFileSync(target, '# somebody edited this\n!keep-me.json\n', 'utf8');
    const heard = said(() => { assert.equal(writePrivateGitignore(dir).written, false); });
    assert.equal(readFileSync(target, 'utf8'), '# somebody edited this\n!keep-me.json\n');
    assert.match(heard, /already carries rules/);
  } finally { r.cleanup(); }
});

// ── AND THE SELF-HEAL THE TWELVE CALL SITES WERE WRITTEN FOR STAYS ─────────

test('an emptied or already-starred marker still heals, in every private directory', () => {
  const r = repo();
  try {
    for (const name of PRIVATE_DIR_NAMES) {
      const dir = path.join(r.root, '.my_context', name);
      mkdirSync(dir, { recursive: true });
      assert.equal(writePrivateGitignore(dir).written, true, `${name} must be writable`);
      assert.equal(readFileSync(path.join(dir, '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);
      writeFileSync(path.join(dir, '.gitignore'), '', 'utf8');
      assert.equal(writePrivateGitignore(dir).written, true, `${name} must self-heal`);
      assert.equal(readFileSync(path.join(dir, '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);
    }
  } finally { r.cleanup(); }
});

test('a directory nested under a private one is admitted — .audit/imported and .staging/restore', () => {
  const r = repo();
  try {
    for (const rel of [['.audit', 'imported'], ['.audit', 'imported', 'acme'], ['.staging', 'restore']]) {
      const dir = path.join(r.root, '.my_context', ...rel);
      mkdirSync(dir, { recursive: true });
      assert.equal(writePrivateGitignore(dir).written, true, rel.join('/'));
    }
  } finally { r.cleanup(); }
});

test('a directory the caller was explicitly GIVEN is admitted by name, and only inside it', () => {
  const r = repo();
  try {
    const given = path.join(r.root, 'reports', 'sessions-box');
    mkdirSync(given, { recursive: true });
    assert.equal(writePrivateGitignore(given, given).written, true);
    // The permission does not travel upward: naming a box does not name its parent.
    const heard = said(() => {
      assert.equal(writePrivateGitignore(path.join(r.root, 'reports'), given).written, false);
      assert.equal(writePrivateGitignore(r.root, given).written, false);
    });
    untouchedAndDisclosed(r, heard);
  } finally { r.cleanup(); }
});

// ── THE REAL CALL SITES, DRIVEN ────────────────────────────────────────────
// Each one still marks its own directory, and none of them can reach the root.

test('every private-state writer marks its own directory and none reaches the root', () => {
  const r = repo();
  try {
    const root = path.join(r.root, '.my_context');
    mkdirSync(path.join(root, 'items'), { recursive: true });

    writeSnapshot(root, 'session-1', ['CONST-a']);
    assert.equal(readFileSync(path.join(root, 'state', '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);

    setCarrySource(root, 'session-1');
    ensureDraftDir(root);
    assert.equal(readFileSync(path.join(root, '.drafts', '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);

    ensureIngestDir(root);
    assert.equal(readFileSync(path.join(root, '.ingest', '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);

    assert.equal(recordDelivery(root, { key: 'k', door: 'subagent-start', kind: 'delivered', entries: 1 }), true);
    assert.equal(readFileSync(path.join(root, '.rules', '.gitignore'), 'utf8'), PRIVATE_GITIGNORE_BODY);

    assert.equal(readFileSync(r.ignore, 'utf8'), REAL_RULES);
  } finally { r.cleanup(); }
});

test('a rule store directory is guarded too, by the one site that may not import the guard', () => {
  const r = repo();
  try {
    const root = path.join(r.root, '.my_context');
    const dir = path.join(root, '.rules');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, '.gitignore'), '# somebody edited this\n!keep.jsonl\n', 'utf8');
    const heard = said(() => {
      recordDelivery(root, { key: 'k', door: 'subagent-start', kind: 'delivered', entries: 1 });
    });
    // INV-nothing-is-dropped-silently: the store's refusal is SAID, in the
    // authority's own sentence shape, not returned quietly.
    assert.match(heard, REFUSAL);
    assert.match(heard, /already carries rules/);
    assert.equal(
      readFileSync(path.join(dir, '.gitignore'), 'utf8'), '# somebody edited this\n!keep.jsonl\n',
      'the store rewrote a .gitignore that already carried rules',
    );
    // And the row it was called for is still written: a marker it must not
    // touch never costs the caller the record.
    assert.ok(readFileSync(path.join(dir, 'delivered.test.jsonl'), 'utf8').includes('"key":"k"'));
  } finally { r.cleanup(); }
});

test('the store refuses a relative target and says so, rather than writing into the cwd', () => {
  const r = repo();
  const before = process.cwd();
  try {
    // `recordDelivery` joins `.rules` onto the root it is handed, so a root of
    // '' leaves a RELATIVE directory that resolves against wherever the process
    // happens to be — the shape that put a `*` in a repository root on
    // 2026-09-23. The cwd is moved into a throwaway repository so that the
    // thing being refused would land somewhere real if it were not refused.
    process.chdir(r.root);
    const heard = said(() => {
      recordDelivery('', { key: 'rel', door: 'subagent-start', kind: 'delivered', entries: 1 });
    });
    assert.match(heard, REFUSAL);
    assert.match(heard, /relative target/);
    assert.equal(existsSync(path.join(r.root, '.rules', '.gitignore')), false);
    assert.equal(readFileSync(r.ignore, 'utf8'), REAL_RULES);
  } finally { process.chdir(before); r.cleanup(); }
});

test('the store refuses a .rules that is a link onto a repository root, by the .git rule', (t) => {
  const r = repo();
  try {
    // The marker content is planted in the root file FIRST, so refusal (4)
    // cannot be what turns this away: `*` is exactly what the writer would
    // have written. Only `it holds a .git` is left, which is the refusal the
    // store used to be missing.
    writeFileSync(r.ignore, '*\n', 'utf8');
    const root = path.join(r.root, '.my_context');
    mkdirSync(root, { recursive: true });
    try {
      symlinkSync(r.root, path.join(root, '.rules'), 'junction');
    } catch (err) {
      t.skip(`this process cannot create a directory link here: ${String(err)}`);
      return;
    }
    const heard = said(() => {
      recordDelivery(root, { key: 'linked', door: 'subagent-start', kind: 'delivered', entries: 1 });
    });
    assert.match(heard, /holds a `\.git`/,
      'the store rewrote a marker in a directory that is a repository root');
  } finally { r.cleanup(); }
});

// ── AND NO SITE MAY GO BACK TO WRITING IT BY HAND ──────────────────────────

test('src/ holds exactly one writer of the `*` .gitignore line', async () => {
  const { readdirSync } = await import('node:fs');
  const src = path.join(import.meta.dirname, '..', '..', 'src');
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      // **THE CALL IS NOT ALWAYS ON ONE LINE, AND THE FIRST VERSION OF THIS
      // SCAN COULD NOT SEE ONE THAT WAS NOT.** `src/cli/index.ts` spells its
      // write over four lines, so a same-line match found nothing there — its
      // entry in `allowed` below was inert, and a stray writer spelled the
      // same way would have passed this green. So the file is read as CODE
      // TEXT with its comment lines blanked (keeping every line position, so
      // the reported line number is still the real one), and each
      // `writeFileSync(` is judged by the rest of its own statement.
      const lines = readFileSync(full, 'utf8').split('\n');
      const code = lines
        // A leading `*`, `//` or `/*` is this repository's own prose about the
        // line, and its prose quotes this exact call more than a dozen times.
        .map((line) => (/^\s*(\*|\/\/|\/\*)/.test(line) ? '' : line))
        .join('\n');
      for (let at = code.indexOf('writeFileSync('); at !== -1; at = code.indexOf('writeFileSync(', at + 1)) {
        // The statement, not a fixed window: it ends at the first `);`, and is
        // capped so an unterminated one cannot swallow the file.
        const end = code.indexOf(');', at);
        const statement = code.slice(at, end === -1 ? at + 400 : Math.min(end + 2, at + 400));
        // Three spellings, because the authority writes the body through a
        // constant rather than a literal and would otherwise be the one writer
        // this scan cannot see — which is the same inert-exception defect the
        // multi-line repair above closes.
        if (!statement.includes('.gitignore')
          && !statement.includes("'*\\n'")
          && !statement.includes('PRIVATE_GITIGNORE_BODY')) continue;
        const line = code.slice(0, at).split('\n').length;
        offenders.push(`${path.relative(path.join(src, '..'), full)}:${line}`);
      }
    }
  };
  walk(src);
  // TWO EXCEPTIONS, BOTH DECISIONS RATHER THAN GAPS.
  //
  // `src/cli/index.ts` writes the corpus root's OWN narrow ignore file at
  // `init` — three names, not a star — which is a different file for a
  // different reason and is guarded by `init` refusing an existing root.
  //
  // `src/rules/delivered.ts` asks the same two questions in place instead of
  // importing the answer. **D41 spec §7 forbids the import**: the store
  // depends on nothing in the corpus but the frontmatter parser, and
  // `test/rules/isolation.test.ts` fails if that widens. Its local guard is
  // narrower than the authority's, because that site's directory name is a
  // constant in the same file — and `a rule store directory is guarded too`
  // below drives it rather than taking the comment on trust.
  const allowed = new Set([
    'src/core/private-gitignore.ts', 'src/cli/index.ts', 'src/rules/delivered.ts',
  ]);

  // ANTI-VACUITY, and it is the finding this test was repaired for. Every
  // exception below is inert unless the scan can actually SEE the site it
  // excuses, and `src/cli/index.ts`'s write is the one spelled across four
  // lines. Asserting that it is FOUND — before it is excused — is what proves
  // the scan reads statements rather than lines, and what would go red if it
  // ever went back to reading lines.
  const found = new Set(offenders.map((o) => o.split(':')[0].replaceAll('\\', '/')));
  for (const site of allowed) {
    assert.ok(found.has(site),
      `${site} is excused by this test and the scan cannot see it, so the exception is inert `
      + 'and a stray writer spelled the same way would pass. Found: ' + [...found].join(', '));
  }
  const strays = offenders.filter((o) => !allowed.has(o.split(':')[0].replaceAll('\\', '/')));
  assert.deepEqual(strays, [], `only ${[...allowed].join(' and ')} may write a .gitignore by hand`);
});
