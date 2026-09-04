/**
 * **`screens/watch.js`'s own `REGISTERED_HOOK_OPS` against `core/audit.ts`'s** —
 * the two cannot be one declaration (a browser ES module cannot import
 * `core/audit.ts`; see both modules' own docblocks on the constant) so this is
 * the guard that stops the duplicate from drifting in silence, the same
 * mitigation `test/hooks/hooks-manifest.test.ts` applies to `hooks/hooks.json`
 * itself (`TASK-the-audit-stream-does-not-show-every-hook-that-is-registered`,
 * hooks/31).
 *
 * The import technique — rewrite the two absolute specifiers Node cannot
 * resolve, then `import()` a `data:` URL — is `test/ui/config-screen.test.ts`'s
 * own, copied rather than reinvented.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REGISTERED_HOOK_OPS as CORE_REGISTERED_HOOK_OPS } from '../../src/core/audit.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCREENS = path.join(REPO, 'src', 'ui', 'public', 'screens');
const LIB = path.join(REPO, 'src', 'ui', 'public', 'lib');
const SCREEN = path.join(SCREENS, 'watch.js');

const PARTS = "'/screens/parts.js'";
const VIEWMODEL = "'/lib/viewmodel.js'";

interface WatchScreen {
  REGISTERED_HOOK_OPS: Record<string, string[]>;
}

async function screen(): Promise<WatchScreen> {
  let text = readFileSync(SCREEN, 'utf8');
  for (const [specifier, real] of [
    [PARTS, path.join(SCREENS, 'parts.js')],
    [VIEWMODEL, path.join(LIB, 'viewmodel.js')],
  ] as const) {
    assert.ok(text.includes(`from ${specifier};`),
      `screens/watch.js no longer imports from ${specifier}; the rewrite below would import an ` +
      'unmodified module and fail on a specifier Node cannot resolve, so fix the rewrite rather ' +
      'than deleting this assertion.');
    text = text.replace(specifier, JSON.stringify(pathToFileURL(real).href));
  }
  return (await import(`data:text/javascript,${encodeURIComponent(text)}`)) as WatchScreen;
}

test('watch.js\'s REGISTERED_HOOK_OPS is byte-identical, as data, to core/audit.ts\'s', async () => {
  const { REGISTERED_HOOK_OPS: clientSide } = await screen();
  assert.deepEqual(clientSide, CORE_REGISTERED_HOOK_OPS,
    'screens/watch.js\'s REGISTERED_HOOK_OPS has drifted from core/audit.ts\'s — the two are a ' +
    'deliberate duplicate (a browser module cannot import core/audit.ts) and must be kept equal ' +
    'by hand until one of them changes; see both declarations\' own docblocks');
});
