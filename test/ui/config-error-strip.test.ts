/**
 * **`plan:live seq:13`, the half that was never built.**
 *
 * `test/ui/live-config.test.ts`'s R4 section proved the SERVER half of this:
 * `/api/meta` carries `configError: string | null`, present either way, and it
 * cannot disagree with `/api/config`'s `servingLastGood` because both are read
 * off the same loader. Its own header says exactly why that field exists —
 * *"Simulate draws a ribbon and Work draws a governing set from that last good
 * config, and until now nothing on those screens could tell them the file had
 * moved out from under it"* — and exactly where it was meant to land: *"the
 * shell fetches it on EVERY screen to fill the status strip"*.
 *
 * **Measured against `src/ui/public/app.js` on 2026-09-05: nothing read it.**
 * `grep -n configError src/ui/public/*.js src/ui/public/screens/*.js` matched
 * nothing at all. The field has been on the wire since `plan:live seq:8`
 * landed and no browser code has ever looked at it — the shell fetches
 * `/api/meta` once, at boot, in `fillGit()`, and reads `staleCode` off it
 * (`noteCodeSkew`) and `corpus` off it (`noteCorpusDrift`), and stops. A field
 * served and never read is indistinguishable, to the reader who hits it, from
 * a field nobody added.
 *
 * **The string keys this needs do not exist yet, on the same footing as
 * `ex.codeSkew` before it was routed.** This lane owns `server.ts`,
 * `read-model.ts`, `app.js` and `config.js` — not `strings/en.js` or
 * `strings/he.js`, and a UI sentence here is composed by the design-of-record
 * owner, never invented at the point of use. So the wiring below follows
 * `showCodeSkew`'s own seam exactly: it is written to draw the moment the keys
 * land, and it draws nothing — never a `t()` throw — while they do not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const APP_JS = readFileSync(path.join(REPO, 'src', 'ui', 'public', 'app.js'), 'utf8');

/**
 * `assert.ok(re.test(…))` rather than `assert.match`: `app.js` is hundreds of
 * kilobytes and a failed `assert.match` prints the whole haystack, burying the
 * one sentence that says what went wrong — the same reason `code-skew.test.ts`
 * uses this helper instead.
 */
function assertMatches(text: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(text), `${message}\n  pattern: ${String(pattern)}`);
}

test('the shell reads configError off the SAME /api/meta call staleCode and corpus already use', () => {
  // Not a second fetch: `configError` rides the request `fillGit()` already
  // makes, exactly as `staleCode` and `corpus` do — a second call to
  // `/api/meta` here would be a second answer that could disagree with the
  // first one this same function already trusts.
  assertMatches(APP_JS,
    /const meta = await api\('\/api\/meta'\);\n(?:\s*\/\/.*\n)*\s*noteCodeSkew\(meta\);\n(?:\s*\/\/.*\n)*\s*noteCorpusDrift\(meta\);\n(?:\s*\/\/.*\n)*\s*noteConfigError\(meta\);/,
    'noteConfigError must read the same first-paint answer noteCodeSkew and noteCorpusDrift already do');
});

test('the strip draws the config state at boot, not only after the first answer', () => {
  // The exact shape `fillCorpusDrift()` is called for in `fillChrome()`: a
  // page that has not been told whether the config broke is not a page that
  // measured a working one — `STD-a-measured-zero-is-drawn-and-named-…`
  // clause 3, a blank is never the answer for a fact this shell has a field
  // for.
  assertMatches(APP_JS,
    /fillCorpusDrift\(\);\n(?:\s*\/\/[\s\S]{0,400}?\n)*\s*fillConfigError\(\);/,
    'fillChrome must draw the config state before the first /api/meta answer lands, exactly as it '
    + 'already does for corpus drift');
});

test('three states, none of them blank — broken, current, and not yet known', () => {
  // `configError` is `string | null`, never absent — so the chip has exactly
  // the three readings `corpusDrift()`'s three states already taught this
  // file: unmeasured (nothing has answered `/api/meta` yet), a measured good
  // state (`null` — the file on disk IS the config governing this page), and
  // the break itself. Never a fourth, and never nothing.
  assertMatches(APP_JS, /function fillConfigError\(\)/,
    'a named function draws the chip, the same shape every other strip segment takes');
  assertMatches(APP_JS, /function noteConfigError\(answer\)/,
    'a named function reads the field off an /api answer, the same shape noteCorpusDrift takes');
});

test('the pending string keys are named in the shell, not left to memory', () => {
  // The seam `showCodeSkew` set: `t()` throws on a missing key by design, so a
  // guard checked BEFORE any `translate()` call is what lets this land before
  // the design-of-record owner has composed the sentence, and draws with no
  // further change here the moment they do.
  assertMatches(APP_JS, /'strip\.configBroken'/,
    'the broken-state key is named in the shell');
  assertMatches(APP_JS, /'strip\.configOk'/,
    'the good-state key is named in the shell — a measured zero is drawn and named too');
  assertMatches(APP_JS, /'strip\.configUnknown'/,
    'the not-yet-known key is named in the shell — "no answer yet" is a third fact, not the good one');
  assertMatches(APP_JS, /if \(!\(key in table\.strings\)\) return false;/,
    'the draw is guarded on the key existing, so a missing table entry renders nothing rather than throwing');
  // **The keys reach `translate()`/`flat()` by VARIABLE, never as an inline
  // literal.** `test/ui/viewmodel.test.ts`'s "every string key app.js itself
  // names is declared in both tables" scans this file for the literal call
  // shape `translate(table.strings, '…')` and fails the whole suite on any
  // key not yet in both tables — the same reason `CODE_SKEW_KEY` is a
  // constant and not a literal inside `showCodeSkew`'s own `translate()` call.
  assertMatches(APP_JS, /translate\(table\.strings, key\)/,
    'the config chip\'s translate() call takes a variable, not a literal — invisible to the '
    + 'key-declared-in-both-tables scan until the keys land');
  assertMatches(APP_JS, /CONFIG_UNKNOWN_KEY = 'strip\.configUnknown';/,
    'and the literal lives ONLY in the constant\'s own declaration');
});

test('the config chip has its own element, beside the drift chip it sits next to', () => {
  // `#corpusdrift` is its own element beside `#stripitems` for the reason
  // `fillItems`'s header gives: two facts, two sources, two refill triggers,
  // one `replaceChildren` per fact so a refill of either can never blank the
  // other. `#configerr` follows the same rule — it is a THIRD fact in the same
  // group, on yet another source (`/api/meta`, read once at boot, never on the
  // per-minute heartbeat `staleCode` and `corpus` also ride).
  assertMatches(APP_JS, /drift\.id = 'corpusdrift';/, 'the drift element this chip sits beside');
  assertMatches(APP_JS, /configErr\.id = 'configerr';/,
    'the config chip gets its own element, so filling it can never blank the drift chip or the count');
  assertMatches(APP_JS, /corpus\.append\(count, drift, configErr, notes\);/,
    'appended into the corpus group — config governs the whole corpus, the same identity timescale '
    + 'as the drift chip beside it');
});
