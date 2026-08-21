import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * One contract, checked in one place: **`--json` output is a single JSON
 * document, and it stays parseable when the corpus has a load error.**
 *
 * This existed as prose in README's Output section ("it carries any corpus
 * load errors inside the document so it stays parseable") and as a comment on
 * four separate commands, but as an assertion on only some of them and never
 * with a corrupt item planted — so `decay --json` shipped emitting the
 * document followed by plain-text `my_context: error ...` lines: exit 0,
 * empty stderr, unparseable stdout, precisely when something was wrong. The
 * per-command tests cover each surface's own fields; this file covers the one
 * property they share, so a seventh JSON surface cannot re-derive it wrong.
 *
 * The list below is written out by hand rather than iterated from `COMMANDS`
 * (as `f2-registry.test.ts` does) because `list` is not in that registry at
 * all, and because each surface needs its own setup to reach its JSON branch.
 * `carriesLoadErrors: false` marks the one surface that legitimately has no
 * `loadErrors` field — see its note.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-json-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', 'constraint', 'A real item so the reports are not empty', '--yes'], cwd, () => {});
  return cwd;
}

/** The same fixture every F2 test in this suite uses. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

interface Surface {
  label: string;
  args: string[];
  /**
   * False only for `ingest-status`, whose success path never rebuilds the
   * item index (it reads session files under `state/` only), so it has no
   * load errors to carry — the same carve-out `f2-registry.test.ts` makes
   * for it in `DOES_NOT_REBUILD`. Its output must still parse.
   */
  carriesLoadErrors: boolean;
}

const SURFACES: Surface[] = [
  { label: 'status --json', args: ['status', '--json'], carriesLoadErrors: true },
  { label: 'list --json', args: ['list', '--json'], carriesLoadErrors: true },
  { label: 'decay --json', args: ['decay', '--json'], carriesLoadErrors: true },
  { label: 'doctor --json', args: ['doctor', '--json'], carriesLoadErrors: true },
  { label: 'review list --json', args: ['review', 'list', '--json'], carriesLoadErrors: true },
  { label: 'query --json', args: ['query', '--json', 'SELECT id FROM items'], carriesLoadErrors: true },
  { label: 'ingest-status --json', args: ['ingest-status', '--json'], carriesLoadErrors: false },
  // `--dry-run` so this surface writes nothing: the property under test is
  // that the document stays one document, and a destination would add a
  // filesystem failure mode that has nothing to do with it. The write path is
  // covered with its own `--json` assertions in `test/cli/export.test.ts`.
  { label: 'export --dry-run --json', args: ['export', '--dry-run', '--json'], carriesLoadErrors: true },
];

for (const surface of SURFACES) {
  test(`\`mycontext ${surface.label}\` emits one parseable document even with a corpus load error`, () => {
    const cwd = project();
    try {
      plantUnrelatedCorruptItem(cwd);
      const { out } = run(surface.args, cwd);

      let doc: unknown;
      try {
        doc = JSON.parse(out);
      } catch (err) {
        assert.fail(
          `\`${surface.label}\` did not emit a single parseable JSON document ` +
          `(${err instanceof Error ? err.message : String(err)}). Output was:\n${out}`,
        );
      }

      // `emitLoadErrors`' text prefix must not appear anywhere on a `--json`
      // surface: a document followed by prose lines is the exact regression
      // this file exists to catch, and it is invisible to a check that only
      // parses a prefix of the output.
      assert.doesNotMatch(
        out, /my_context: error/,
        `\`${surface.label}\` printed a plain-text load-error line beside its JSON document`,
      );

      if (surface.carriesLoadErrors) {
        const errors = (doc as { loadErrors?: unknown }).loadErrors;
        assert.ok(
          Array.isArray(errors),
          `\`${surface.label}\` has no \`loadErrors\` array — a corpus load error would be ` +
          `dropped silently (INV-nothing-is-dropped-silently). Document was:\n${out}`,
        );
        assert.equal(
          (errors as { file: string }[]).length, 1,
          `\`${surface.label}\` reported ${(errors as unknown[]).length} load error(s), expected 1`,
        );
        assert.match((errors as { file: string }[])[0].file, /CONST-broken\.md$/);
      }
    } finally {
      removeTree(cwd);
    }
  });
}

test('the shared guard is not vacuous — the fixture really does produce a load error', () => {
  const cwd = project();
  try {
    plantUnrelatedCorruptItem(cwd);
    // The text surface is where `emitLoadErrors` speaks; if this is silent,
    // every `loadErrors: []` assertion above would be passing for the wrong
    // reason.
    const { out } = run(['list'], cwd);
    assert.match(out, /my_context: error {2}.*CONST-broken\.md/);
  } finally {
    removeTree(cwd);
  }
});
