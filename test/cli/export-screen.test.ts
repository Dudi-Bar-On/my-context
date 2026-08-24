/**
 * `mycontext export --as-pack`, at the seam where a hostile pack name reaches
 * a terminal and a file this product signs.
 *
 * `test/pack/bundle-screen.test.ts` owns the rule; this file owns the DOOR —
 * the exit code, the empty destination, and the terminal line. Both are worth
 * having: the unit test proves `buildBundle` refuses, and this one proves the
 * command lets that refusal decide, because the measurement that opened this
 * task was taken here and not there.
 *
 * **Measured on 2026-08-24, before the screen was wired**, with a real
 * workspace and a real destination. Every one of the six exited 0, printed the
 * value into the preview's first line, and wrote it into `manifest.json`:
 *
 *     --pack-name "invoice<U+202E>gnp.exe" printed
 *       …as a pack named "invoice<U+202E>gnp.exe", version "2026-08 rev 3"
 *
 * which a bidi-aware terminal renders as `invoiceexe.png` with everything
 * after it reversed too — the override has no PDF after it, so its effect runs
 * to the end of the line, and the version that follows is reordered with it.
 *
 * **The cost, stated the way the task states it.** The artefact this produced
 * was UN-IMPORTABLE: `pack import` and `init --pack` both refuse it, because
 * the import side is screened. So what this closes is a pack you cannot give
 * away rather than one that lands somewhere hostile — and a name this product
 * writes into a file it signs, on a terminal that is the author's own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Project { cwd: string; dispose(): void }

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

function project(): Project {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-export-screen-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  assert.equal(runCli(['add', 'rule', 'Never log customer email', '--yes'], cwd, () => {}), 0);
  return { cwd, dispose: () => removeTree(cwd) };
}

/** Wrapping is a layout decision; a phrase assertion must not depend on it. */
function flat(out: string): string {
  return out.replace(/\s+/g, ' ');
}

const RLO = '‮';
const TAG = '\u{e0041}';
const ZWSP = '​';

for (const [label, codePoint, spelling] of [
  ['U+202E', RLO, 'U\\+202E'],
  ['U+E0041', TAG, 'U\\+E0041'],
  ['U+200B', ZWSP, 'U\\+200B'],
] as const) {
  test(`--pack-name carrying ${label} is refused, nothing is written, and the refusal `
    + 'does not carry it', () => {
    const { cwd, dispose } = project();
    try {
      const out5 = path.join(cwd, 'artefact');
      const { code, out } = run(
        ['export', '--out', out5, '--as-pack',
          '--pack-name', `acme${codePoint}security`, '--pack-version', '2026-08 rev 3'],
        cwd,
      );

      assert.equal(code, 1, out);
      assert.match(out, new RegExp(spelling));
      assert.match(flat(out), /the pack name/);
      assert.equal(
        out.includes(codePoint), false,
        `the refusal printed ${label} itself: ${JSON.stringify(out)}`,
      );
      // Nothing on disk, and specifically no `manifest.json` holding the value
      // — which is where every one of these landed before.
      assert.equal(existsSync(out5), false, `${out5} was written`);
    } finally { dispose(); }
  });

  test(`--pack-version carrying ${label} is refused, and nothing is written`, () => {
    const { cwd, dispose } = project();
    try {
      const out5 = path.join(cwd, 'artefact');
      const { code, out } = run(
        ['export', '--out', out5, '--as-pack',
          '--pack-name', 'acme security', '--pack-version', `rev${codePoint}3`],
        cwd,
      );

      assert.equal(code, 1, out);
      assert.match(out, new RegExp(spelling));
      assert.match(flat(out), /the pack version/);
      assert.equal(
        out.includes(codePoint), false,
        `the refusal printed ${label} itself: ${JSON.stringify(out)}`,
      );
      assert.equal(existsSync(out5), false, `${out5} was written`);
    } finally { dispose(); }
  });
}

test('a newline in --pack-name is still refused, by the guard that was already there', () => {
  const { cwd, dispose } = project();
  try {
    const out5 = path.join(cwd, 'artefact');
    // This is the measurement that says the guard was never absent — only the
    // screen beside it was. It must keep passing, and it must keep being
    // `refusePackName` that answers.
    const { code, out } = run(
      ['export', '--out', out5, '--as-pack',
        '--pack-name', 'acme\nsecurity', '--pack-version', '2026-08 rev 3'],
      cwd,
    );

    assert.equal(code, 1, out);
    assert.match(flat(out), /contains a control character/);
    assert.equal(existsSync(out5), false, `${out5} was written`);
  } finally { dispose(); }
});

test('the screen refuses before the preview, so --dry-run never prints the name either', () => {
  const { cwd, dispose } = project();
  try {
    const { code, out } = run(
      ['export', '--dry-run', '--as-pack',
        '--pack-name', `acme${RLO}security`, '--pack-version', '2026-08 rev 3'],
      cwd,
    );

    assert.equal(code, 1, out);
    assert.match(out, /U\+202E/);
    // The preview's first line is where the name printed. It must not have run
    // at all — a screen that fired after it would refuse and have printed.
    assert.equal(flat(out).includes('about to export'), false, out);
    assert.equal(out.includes(RLO), false, 'the refusal printed U+202E itself');
  } finally { dispose(); }
});

test('a zip destination is refused the same way, and no file is left behind', () => {
  const { cwd, dispose } = project();
  try {
    const target = path.join(cwd, 'artefact.zip');
    const { code, out } = run(
      ['export', '--out', target, '--format', 'zip', '--as-pack',
        '--pack-name', `acme${ZWSP}security`, '--pack-version', '2026-08 rev 3'],
      cwd,
    );

    assert.equal(code, 1, out);
    assert.match(out, /U\+200B/);
    assert.equal(existsSync(target), false, `${target} was written`);
  } finally { dispose(); }
});

test('an ordinary pack still exports, and its manifest carries the two strings', () => {
  const { cwd, dispose } = project();
  try {
    const out5 = path.join(cwd, 'artefact');
    const { code, out } = run(
      ['export', '--out', out5, '--as-pack',
        '--pack-name', 'acme security', '--pack-version', '2026-08 rev 3'],
      cwd,
    );

    assert.equal(code, 0, out);
    assert.ok(readdirSync(out5).includes('manifest.json'), out);
    const manifest = JSON.parse(readFileSync(path.join(out5, 'manifest.json'), 'utf8')) as {
      name: string; version: string;
    };
    assert.equal(manifest.name, 'acme security');
    assert.equal(manifest.version, '2026-08 rev 3');
  } finally { dispose(); }
});
