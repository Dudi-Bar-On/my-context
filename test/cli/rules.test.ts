// @basis TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it, INV-nothing-is-dropped-silently
/**
 * **`mycontext rules` — verify, restore, list, show.**
 *
 * D41 spec §13, `plan:store seq:1` Task 5. The command reads a store that is
 * NOT the user's corpus: everything it prints comes out of the installed
 * package, and `test/rules/isolation.test.ts` is what holds that separation.
 * What is asserted here is the command's own contract — that a planted
 * mismatch exits non-zero and NAMES the entry, that the tier decides what a
 * foreign workspace sees, and that the restore is local.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, cpSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { SUBCOMMANDS } from '../../src/cli/commands/rules.ts';
import { entriesDir } from '../../src/rules/store.ts';
import { verifyManifest, writeManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const SEED = 'numbered-options-on-a-question-put-to-the-owner';
const REPO = path.resolve(import.meta.dirname, '..', '..');

interface Run { code: number; text: string }

/** The CLI, run from `cwd`, with its exit code — never a pipeline's. */
function cli(argv: string[], cwd: string): Run {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, text: lines.join('\n') };
}

function inTemp(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-rulescli-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
    fn(cwd);
  } finally { removeTree(cwd); }
}

/**
 * Damage the SHIPPED store, run something, and put it back byte for byte.
 *
 * The store is a checked-in directory of this repository, so a test that
 * damaged it and crashed would leave the working tree wrong. The original text
 * is read first and restored in a `finally`, and the assertion that it came
 * back is part of the helper rather than left to each caller.
 */
function whileDamaged(fn: () => void): void {
  const file = path.join(entriesDir(), `${SEED}.md`);
  const before = readFileSync(file, 'utf8');
  const manifest = readFileSync(path.join(entriesDir(), 'manifest.json'), 'utf8');
  try {
    appendFileSync(file, '\nplanted by test/cli/rules.test.ts\n', 'utf8');
    assert.equal(verifyManifest(entriesDir()).ok, false, 'the plant did not damage the store');
    fn();
  } finally {
    writeFileSync(file, before, 'utf8');
    writeFileSync(path.join(entriesDir(), 'manifest.json'), manifest, 'utf8');
    assert.deepEqual(
      verifyManifest(entriesDir()), { ok: true },
      'the shipped store was left damaged by this test',
    );
  }
}

/* ══ 1. VERIFY ═════════════════════════════════════════════════════════════ */

test('`rules verify` exits 0 on an intact store and names where it looked', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'verify'], cwd);
    assert.equal(run.code, 0, run.text);
    assert.match(run.text, /intact/);
    assert.ok(run.text.includes(entriesDir()), 'the report does not say which directory it checked');
  });
});

test('`rules verify` exits NON-ZERO on a planted mismatch and names the entry', () => {
  inTemp((cwd) => {
    whileDamaged(() => {
      const run = cli(['rules', 'verify'], cwd);
      assert.equal(
        run.code, 1,
        'a damaged store verified successfully. Every later phase treats this store as true.',
      );
      assert.ok(
        run.text.includes(SEED),
        `the refusal does not name the entry:\n${run.text}`,
      );
      assert.match(run.text, /altered/);
      // Spec §13, and it is the half an implementation drops.
      assert.match(run.text, /reads still work/i);
    });
  });
});

test('`rules verify --json` carries the same verdict as the text surface', () => {
  inTemp((cwd) => {
    whileDamaged(() => {
      const run = cli(['rules', 'verify', '--json'], cwd);
      assert.equal(run.code, 1);
      const body = JSON.parse(run.text) as { ok: boolean; problems: { entry: string; why: string }[] };
      assert.equal(body.ok, false);
      assert.deepEqual(body.problems.map((p) => p.entry), [SEED]);
      assert.deepEqual(body.problems.map((p) => p.why), ['altered']);
    });
  });
});

/**
 * Spec §13: restore is LOCAL. This phase ships one copy of the store — the
 * package's — so there is nothing on this machine to restore FROM, and the
 * command says exactly that rather than reporting a restore it did not
 * perform. That honesty is the assertion; the restore mechanism itself is
 * asserted against two real directories in `test/rules/manifest.test.ts`.
 */
test('`rules verify --restore` consults no network, and says why it restored nothing', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'verify', '--restore'], cwd);
    assert.equal(run.code, 0, run.text);
    assert.match(run.text, /nothing was restored/);
    assert.match(run.text, /installed package/);
  });
});

test('the restore path names no network primitive at all', () => {
  const sources = [
    path.join(REPO, 'src', 'cli', 'commands', 'rules.ts'),
    path.join(REPO, 'src', 'rules', 'manifest.ts'),
  ];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const shape of [/\bfetch\s*\(/, /node:https?/, /node:net/]) {
      assert.ok(!shape.test(text), `${path.basename(file)} carries ${String(shape)}`);
    }
  }
});

/* ══ 2. LIST AND SHOW, AND THE TIER ════════════════════════════════════════ */

test('`rules list` inside my_context lists the developer-tier entry', () => {
  const run = cli(['rules', 'list'], REPO);
  assert.equal(run.code, 0, run.text);
  assert.ok(run.text.includes(SEED), run.text);
  assert.match(run.text, /developer/);
});

test('`rules list` in a foreign workspace withholds the developer tier', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'list'], cwd);
    assert.equal(run.code, 0, run.text);
    assert.equal(
      run.text.includes(SEED), false,
      'a developer-tier entry was listed outside my_context. Shipping a rule about how THIS ' +
      'repository works as the tool\'s law is what the tier exists to prevent.',
    );
    // Two truths that must not collapse into one sentence: an empty store and
    // a store with nothing that applies here.
    assert.match(run.text, /applies in this workspace/);
  });
});

test('`rules show` prints the whole template, including the verbatim request', () => {
  const run = cli(['rules', 'show', SEED], REPO);
  assert.equal(run.code, 0, run.text);
  assert.match(run.text, /trigger: putting a decision to the owner/);
  assert.match(run.text, /check: detective:/);
  // Spec §6: documentation only, and THIS is the documentation surface.
  assert.match(run.text, /never injected/);
  assert.match(run.text, /answer by number/);
});

test('`rules show` on an id that does not apply here refuses, and says how to find one', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'show', SEED], cwd);
    assert.equal(run.code, 1);
    assert.match(run.text, /rules list/);
  });
});

test('`rules show` with no id refuses rather than guessing', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'show'], cwd);
    assert.equal(run.code, 1);
    assert.match(run.text, /needs an entry id/);
  });
});

/* ══ 3. THE PARSER ═════════════════════════════════════════════════════════ */

test('an unknown subcommand is refused in the words every subcommanded command uses', () => {
  inTemp((cwd) => {
    const run = cli(['rules', 'zzz'], cwd);
    assert.equal(run.code, 1);
    // `subcommandedByParser` (test/helpers/approval-boundary.ts) derives the
    // subcommanded set by matching exactly this phrase, so a command that
    // refuses in its own words is one the approval-boundary probe never
    // expands — the blind spot that let `statusline install --yes` go unseen.
    assert.match(run.text, /\bunknown (?:[a-z-]+ )?subcommand\b/);
  });
});

test('a flag one subcommand takes is refused on the subcommands that do not', () => {
  inTemp((cwd) => {
    assert.equal(cli(['rules', 'list', '--restore'], cwd).code, 1);
    assert.equal(cli(['rules', 'show', SEED, '--restore'], cwd).code, 1);
  });
});

test('the registry usage line advertises exactly the subcommands the command dispatches', () => {
  const def = COMMANDS.get('rules');
  assert.ok(def !== undefined, '`rules` is not registered');
  const group = /^rules \[([a-z|]+)\]/.exec(def.usage);
  assert.ok(group !== null, `the usage line does not advertise an alternation: ${def.usage}`);
  assert.deepEqual(
    group[1].split('|'), [...SUBCOMMANDS],
    'a subcommand that is dispatched and not advertised is one the approval-boundary probe ' +
    'never reaches, and one no permission rule is written against.',
  );
});

/* ══ 4. THE STORE IS NOT THE CORPUS ════════════════════════════════════════ */

/**
 * Every file under `dir`, relative, sorted, and measured.
 *
 * The index is a SQLite file whose size moves on any open, so it is named and
 * not measured; every other file is compared by length, which is enough to see
 * an item written, removed or rewritten.
 */
function listing(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stats = statSync(full);
      if (stats.isDirectory()) { walk(full, `${prefix}${name}/`); continue; }
      out.push(/\.(db|db-wal|db-shm)$/.test(name) ? `${prefix}${name}` : `${prefix}${name}:${stats.size}`);
    }
  };
  walk(dir, '');
  return out;
}

test('`rules` writes nothing into the workspace it is run from', () => {
  inTemp((cwd) => {
    const corpus = path.join(cwd, '.my_context');
    const copy = mkdtempSync(path.join(tmpdir(), 'myctx-rules-before-'));
    try {
      cpSync(corpus, copy, { recursive: true });
      const before = listing(copy);
      assert.ok(before.length > 0, 'the workspace snapshot is empty, so this proves nothing');
      cli(['rules', 'list'], cwd);
      cli(['rules', 'verify'], cwd);
      cli(['rules', 'show', SEED], cwd);
      assert.deepEqual(
        listing(corpus), before,
        'a `rules` command changed the corpus. The store is not a corpus category (spec §7) ' +
        'and nothing it does may touch `.my_context/`.',
      );
    } finally { removeTree(copy); }
  });
});

test('the store the command reads is inside the package, not the workspace', () => {
  inTemp((cwd) => {
    assert.ok(
      !path.resolve(entriesDir()).startsWith(path.resolve(cwd)),
      'the rule store resolved into the workspace. It ships inside the package, so its ' +
      'location is a fact about the installation and never about where the user is standing.',
    );
    // And regenerating it is a no-op on a clean tree, which is what makes the
    // assertion above testable at all rather than a claim about a path string.
    const before = readFileSync(path.join(entriesDir(), 'manifest.json'), 'utf8');
    writeManifest(entriesDir());
    assert.equal(readFileSync(path.join(entriesDir(), 'manifest.json'), 'utf8'), before);
  });
});
