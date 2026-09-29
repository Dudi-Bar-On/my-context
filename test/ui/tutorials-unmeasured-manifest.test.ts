// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-nothing-is-dropped-silently
/**
 * **`GET /api/tutorials` may not answer `heRollup: { done: 0, total: 0 }` over
 * a manifest it never read.**
 *
 * Site M7 of `TASK-nine-sites-report-a-measured-zero-for-something-they-could`
 * (report 3, `reports/2026-09-12-silent-failures-reviewed.md`): *"the zeroed
 * rollup is a translation-debt MEASUREMENT over a file that was never read,
 * and the parse error never reaches the wire. Reads as 'this project has no
 * tutorials'."*
 *
 * Two zeros, one class, and the standard
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` says both
 * must be drawn as unmeasured rather than as none:
 *
 *   - `docs/tutorials/manifest.json` will not parse. The roster is not empty;
 *     it is unknown, and the reason is known and was thrown away.
 *   - No project is open, so the manifest was never looked for at all.
 *
 * The recommendation report 3 attaches to this class is MAKE THE ZERO
 * UNREPRESENTABLE, not merely discouraged, and `context-occupancy.ts`'s
 * missing `percent` field is the template it names — so `heRollup` is
 * `null` here rather than a pair of zeroes with a flag beside it, and the
 * reason travels on the wire in `unmeasured` (the shape
 * `read-model-config.ts`'s `parseError`/`resolveError` already uses one
 * directory over).
 *
 * The parse failure is planted as text that is not JSON. `loadTutorialManifest`
 * throws for every reason a manifest cannot be read — absent, unparseable,
 * or the wrong shape — and all of them reach `apiTutorials`'s single `catch`,
 * so the plant is a representative of that catch rather than of one errno.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiTutorials, type TutorialsBody } from '../../src/ui/read-model.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const url = (): URL => new URL('http://127.0.0.1/api/tutorials');

/** A throwaway project whose manifest holds `text` — valid JSON or not. */
function project(text: string): { ws: Workspace; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tut-unmeasured-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
  mkdirSync(path.join(dir, 'docs', 'tutorials'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'tutorials', 'manifest.json'), text);
  return { ws: resolveWorkspace(dir), done: () => removeTree(dir) };
}

test('a manifest that will not parse answers an UNMEASURED rollup, never { done: 0, total: 0 }', () => {
  const { ws, done } = project('not json at all');
  try {
    const result = apiTutorials(ws, url());
    // The 200 is correct and is not what this test is about: this project's
    // own broken manifest is not a reason to fail the screen.
    assert.equal(result.status, 200);
    const body = result.body as TutorialsBody;
    assert.equal(
      body.heRollup, null,
      'a rollup of zero over a manifest that was never read is a measured zero standing in for ' +
      'an unmeasured thing — STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is',
    );
  } finally { done(); }
});

test('the reason the manifest could not be read reaches the wire, rather than being thrown away', () => {
  const { ws, done } = project('not json at all');
  try {
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(
      typeof body.unmeasured, 'string',
      'INV-nothing-is-dropped-silently: the parse error must travel to the reader, not die in the catch',
    );
    assert.match(
      body.unmeasured ?? '', /manifest\.json/,
      'the disclosure must name the file the reader has to go and fix',
    );
  } finally { done(); }
});

test('no project open is unmeasured too — nothing was looked at, so nothing was counted', () => {
  const ws: Workspace = { ...resolveWorkspace(REPO), projectRoot: null };
  const body = apiTutorials(ws, url()).body as TutorialsBody;
  assert.equal(body.heRollup, null, 'no manifest was read, so there is no rollup to report');
  assert.equal(typeof body.unmeasured, 'string', 'and the reader is told why the roster is empty');
});

test('a manifest that DOES parse is measured, and says so by saying nothing', () => {
  const { ws, done } = project(JSON.stringify([{
    id: 'x', title: 'Do the x thing', tier: 'basic',
    cli: [], slash: [], screens: [], categories: [],
    enFile: 'docs/tutorials/x.md', heFile: 'docs/tutorials/x.he.md',
  }]));
  try {
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.deepEqual(
      body.heRollup, { done: 0, total: 0 },
      'a REAL zero is still drawn as a zero — this is the measurement, and it must survive the fix',
    );
    assert.equal(
      body.unmeasured, null,
      'null and never absent, so a reader can tell "measured" from "this build does not say"',
    );
  } finally { done(); }
});
