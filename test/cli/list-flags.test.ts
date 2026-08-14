import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `mycontext list` swallowed any option it did not recognise. `detailLevel`
 * and `wantsJson` refuse a malformed VALUE (`--full=maybe`), and `positionals`
 * drops every `--token` so one cannot be mistaken for the category filter —
 * but nothing anywhere refused an unrecognised NAME. So `list --ful` listed
 * the entire corpus at the default detail and exited 0.
 *
 * That is worse than an error for the specific reason this project keeps
 * re-finding: the output is plausible. A user who typed `--ful` wanting the
 * full table gets the short table, with no signal, and reads it as the answer.
 * Found while fixing the identical defect in `add`, and reported there as
 * still live here.
 */
function sandbox<T>(fn: (cwd: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-list-flags-'));
  try {
    return fn(dir);
  } finally {
    removeTree(dir);
  }
}

function withCorpus<T>(fn: (cwd: string, lines: () => string[], run: (...a: string[]) => number) => T): T {
  return sandbox((cwd) => {
    let out: string[] = [];
    const run = (...args: string[]): number => {
      out = [];
      return runCli(args, cwd, (s) => out.push(s));
    };
    assert.equal(run('init'), 0);
    assert.equal(run('add', 'constraint', 'Pool capped at twenty', '--yes'), 0);
    return fn(cwd, () => out, run);
  });
}

test('list refuses an unrecognised option instead of listing everything', () => {
  withCorpus((_cwd, lines, run) => {
    const code = run('list', '--ful');
    assert.equal(code, 1, '`list --ful` must not exit 0');
    const text = lines().join('\n');
    assert.match(text, /unknown option "--ful"/);
    // The refusal must teach the accepted set, not merely refuse.
    assert.match(text, /--full/);
    assert.match(text, /--json/);
    // And it must not have printed the corpus anyway.
    assert.doesNotMatch(text, /Pool capped at twenty/);
  });
});

test('list still accepts every flag it advertises, and the category filter', () => {
  withCorpus((_cwd, lines, run) => {
    for (const flag of ['--full', '--short', '--summary', '--json']) {
      assert.equal(run('list', flag), 0, `${flag} must still be accepted`);
    }
    // The positional filter still works, and still works AFTER a flag —
    // the reason `positionals` is used here in the first place.
    assert.equal(run('list', '--json', 'constraint'), 0);
    assert.match(lines().join('\n'), /Pool capped at twenty/);

    assert.equal(run('list', 'constraint'), 0);
    assert.match(lines().join('\n'), /Pool capped at twenty/);

    // F2. This used to assert the opposite — "an unknown CATEGORY filters to
    // nothing and exits 0, a legitimate empty answer" — which is precisely
    // the bug: `list constraintt` printed nothing and exited 0, and a reader
    // could not tell that apart from "you have no constraints". An unknown
    // category is a refusal, with the same closest-match teaching `add`
    // gives.
    assert.equal(run('list', 'nosuchcategory'), 1);
    const refusal = lines().join('\n');
    assert.doesNotMatch(refusal, /Pool capped at twenty/);
    assert.match(refusal, /"category" must be one of:/);
    assert.match(refusal, /You passed "nosuchcategory"/);

    // A near-miss gets the suggestion; `nosuchcategory` is too far from
    // anything for `closestMatch` to name one, and it must not invent one.
    assert.doesNotMatch(refusal, /The closest match is/);
    assert.equal(run('list', 'constraintt'), 1);
    assert.match(lines().join('\n'), /The closest match is "constraint"/);
  });
});

test('a valid category with no items says "0 item(s)" rather than printing nothing (F2)', () => {
  withCorpus((_cwd, lines, run) => {
    // `rule` is enabled and empty. Silence here is what made the misspelling
    // above indistinguishable from a real empty answer, so the real empty
    // answer has to speak.
    assert.equal(run('list', 'rule'), 0);
    assert.equal(lines().join('\n').trim(), '0 item(s)');

    assert.equal(run('list', 'rule', '--full'), 0);
    assert.equal(lines().join('\n').trim(), '0 item(s)');
  });
});

/**
 * Disabling a category is non-destructive by design: `resolveCategory`
 * (mutate.ts) stops NEW items being created, but items captured before it was
 * turned off stay on disk and stay indexed. Refusing `list <disabled
 * category>` would hide exactly those items behind an error message — a new
 * silent drop, which is the one failure mode INV-nothing-is-dropped-silently
 * rules out — so the refusal above is checked against every category in the
 * resolved config, not just the enabled ones.
 */
test('a disabled category is still listable, and its existing items are still shown (F2)', () => {
  withCorpus((cwd, lines, run) => {
    const cfgPath = path.join(cwd, '.my_context', 'config.json');
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { categories?: Record<string, unknown> };
    cfg.categories = { ...(cfg.categories ?? {}), constraint: { enabled: false } };
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');

    // The category is genuinely disabled now — `add` refuses it.
    assert.equal(run('add', 'constraint', 'Should not be creatable', '--yes'), 1);
    assert.match(lines().join('\n'), /disabled/i);

    assert.equal(run('list', 'constraint'), 0, 'a disabled category must still be listable');
    assert.match(lines().join('\n'), /Pool capped at twenty/);
  });
});

/**
 * A category renamed or removed from config after items were captured:
 * `loadLayer` (rebuild.ts) still indexes those items on purpose so they can
 * be found. `list <that type>` must therefore still reach them, even though
 * the name is in no config.
 */
test('a type present in the corpus but absent from config is still listable (F2)', () => {
  withCorpus((cwd, lines, run) => {
    const dir = path.join(cwd, '.my_context', 'items', 'ghost');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'GHOST-a.md'),
      '---\nid: GHOST-a\ntype: ghost\ntitle: An orphaned type\nstatus: active\n---\n\n# An orphaned type\n\nBody.\n',
      'utf8',
    );

    assert.equal(run('list', 'ghost'), 0, 'an item whose type left config must still be findable by name');
    assert.match(lines().join('\n'), /GHOST-a/);
  });
});

test('a malformed value on a known flag is still refused by detailLevel', () => {
  withCorpus((_cwd, lines, run) => {
    assert.equal(run('list', '--full=maybe'), 1);
    assert.doesNotMatch(lines().join('\n'), /unknown option/,
      'a bad value must report the value problem, not be misreported as an unknown flag');
  });
});
