/**
 * Pure browser-module logic for the palette, tested in Node. The DOM half of
 * the palette/work/configure screens has no test — the plan-1 limit (spec §6:
 * rendering is untestable without a browser dependency) applies unchanged.
 *
 * **The import form is a URL, not a relative specifier, and the plan is wrong
 * about this.** Task 9's step 1 writes `await import('../../src/ui/public/lib/
 * command.js')`. That runs green under `node --test` and fails
 * `npm run typecheck` three times over with TS7016 — `allowJs` is off and
 * `tsconfig.json`'s `include` is `.ts` only, so a resolved `.js` module is an
 * implicit `any` and `strict` refuses it. `strings-parity.test.ts` already met
 * this and already wrote down the answer (`strings-parity.test.ts` ·
 * `A URL specifier is what lets this` · ~38), including the second reason: a
 * URL is also the only form that survives a Windows path. This file uses it,
 * and states the module's shape at the boundary rather than inferring it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LIB = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'lib');

/**
 * One browser module, loaded the way the browser loads it — same bytes, no
 * build step. The declared shape is deliberately loose where the module's own
 * contract is a RUNTIME refusal: `composeCommand` takes `unknown[]` because
 * refusing a non-string element is half of what it is for, and a signature of
 * `string[]` would make the test that proves the refusal unwritable.
 */
async function lib<T>(name: string): Promise<T> {
  const url = new URL(`file://${path.join(LIB, name).replaceAll('\\', '/')}`);
  return (await import(url.href)) as T;
}

interface CommandModule {
  quoteArg: (value: unknown) => string;
  composeCommand: (argv: unknown) => string;
}

const command = (): Promise<CommandModule> => lib<CommandModule>('command.js');

test('quoteArg leaves safe values bare and quotes the rest', async () => {
  const { quoteArg } = await command();
  assert.equal(quoteArg('RULE-x'), 'RULE-x');
  assert.equal(quoteArg('src/**,docs/**'), '"src/**,docs/**"'); // * is not in the safe set — the shell must not expand it
  assert.equal(quoteArg('two words'), '"two words"');
  assert.equal(quoteArg('say "hi"'), '"say \\"hi\\""');
  assert.equal(quoteArg('back\\slash'), '"back\\\\slash"');
});

test('a glob with * is quoted — the shell must not expand it', async () => {
  const { quoteArg } = await command();
  assert.equal(quoteArg('src/**'), '"src/**"');
});

test('composeCommand joins quoted argv and refuses garbage', async () => {
  const { composeCommand } = await command();
  assert.equal(
    composeCommand(['mycontext', 'review', 'promote-revision', 'RULE-x', '--revision', 'REV-abc', '--yes']),
    'mycontext review promote-revision RULE-x --revision REV-abc --yes',
  );
  assert.equal(
    composeCommand(['mycontext', 'add', 'rule', 'Two words', '--scope', 'src/**']),
    'mycontext add rule "Two words" --scope "src/**"',
  );
  assert.throws(() => composeCommand([]));
  assert.throws(() => composeCommand(['mycontext', undefined]));
});

/**
 * **The composed-not-executed rule, over the bytes rather than over intent.**
 *
 * Spec §2 is that the UI composes a write and NEVER runs one: what a human
 * settles from this page is a command string they paste into their own shell,
 * where their `permissions.deny` rules can still see it. `no-writes.test.ts`
 * proves that for the SERVER half — the set of write symbols bound under
 * `src/ui/` is exactly the one the owner ruled. Its scope is the `.ts` import
 * graph reached from `src/ui/server.ts`, so the browser modules in
 * `src/ui/public/lib/` are outside it entirely, and the composer is precisely
 * the code whose whole subject is a write. That gap is what this closes.
 *
 * Two halves, because either alone is defeated:
 *
 *   1. **No name here can run, send or navigate.** A composer that fetched its
 *      own composed string to an endpoint would satisfy every other test in
 *      this file — the argv would still be exactly right — and would void the
 *      user's deny rules, which is the §8 risk row stated as code.
 *   2. **Nothing here reaches outside this directory.** Half one is a byte
 *      scan, and a byte scan of a module that imports a helper proves nothing
 *      about the helper. So every specifier must resolve to a sibling `.js` in
 *      this same directory, which makes the scanned set closed under import.
 *
 * The forbidden names live HERE and are deliberately absent from the modules'
 * own comments: a scanner defeated by a file describing what the scanner looks
 * for is the failure `faint-usage.test.ts` records making on its first run.
 *
 * The scan is proved able to fail two ways: `CONTROL` below must trip every
 * single pattern, so a regex that silently stops matching is caught rather
 * than passing everything, and the file list must be non-empty, so a renamed
 * directory reports rather than trivially succeeding.
 */
const LIB_FILES = (): string[] =>
  readdirSync(LIB).filter((name) => name.endsWith('.js')).sort();

const CANNOT_BIND: { name: string; pattern: RegExp }[] = [
  { name: 'fetch', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', pattern: /\bWebSocket\b/ },
  { name: 'EventSource', pattern: /\bEventSource\b/ },
  { name: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { name: 'Worker', pattern: /\bWorker\b/ },
  { name: 'eval()', pattern: /\beval\s*\(/ },
  { name: 'new Function', pattern: /\bnew\s+Function\b/ },
  { name: 'dynamic import()', pattern: /\bimport\s*\(/ },
  { name: 'location', pattern: /\blocation\b/ },
  { name: 'open()', pattern: /\bopen\s*\(/ },
  { name: 'submit()', pattern: /\bsubmit\s*\(/ },
  { name: 'requestSubmit()', pattern: /\brequestSubmit\s*\(/ },
  { name: 'execCommand', pattern: /\bexecCommand\b/ },
  { name: 'postMessage', pattern: /\bpostMessage\b/ },
  { name: 'child_process', pattern: /child_process/ },
];

/** Every banned name in one string, so a pattern that stops matching is seen. */
const CONTROL = [
  'fetch(url)', 'new XMLHttpRequest()', 'new WebSocket(u)', 'new EventSource(u)',
  'navigator.sendBeacon(u)', 'new Worker(u)', 'eval(s)', 'new Function(s)',
  'import(s)', 'location.href = u', 'open(u)', 'form.submit()',
  'form.requestSubmit()', 'document.execCommand("copy")', 'target.postMessage(m)',
  "require('child_process')",
].join('\n');

/** `from '…'` and bare `import '…'`, which is the whole reach of an ES module. */
function specifiers(source: string): string[] {
  const found = [
    ...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
  ];
  return found.map((m) => m[1]);
}

test('the composing modules bind nothing that can run, send or navigate', () => {
  const files = LIB_FILES();
  assert.ok(files.length > 0, `no browser modules found under ${LIB}; the scan would pass vacuously`);

  for (const { name, pattern } of CANNOT_BIND) {
    assert.match(CONTROL, pattern, `the pattern for ${name} no longer matches ${name} itself`);
  }

  const offenders: string[] = [];
  for (const file of files) {
    const source = readFileSync(path.join(LIB, file), 'utf8');
    for (const { name, pattern } of CANNOT_BIND) {
      if (pattern.test(source)) offenders.push(`${file} binds ${name}`);
    }
  }
  assert.deepEqual(
    offenders, [],
    'a module that composes commands may not also be able to run one. If a screen needs to '
    + 'fetch, it does so in src/ui/public/screens/, against a READ endpoint — never from here.',
  );
});

test('the composing modules reach nothing outside their own directory', () => {
  const files = LIB_FILES();
  assert.ok(files.length > 0, `no browser modules found under ${LIB}`);

  const offenders: string[] = [];
  for (const file of files) {
    for (const spec of specifiers(readFileSync(path.join(LIB, file), 'utf8'))) {
      if (!spec.startsWith('./') || !spec.endsWith('.js') || !files.includes(spec.slice(2))) {
        offenders.push(`${file} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(
    offenders, [],
    'the byte scan above is only as good as the closure it runs over: a module that imports '
    + 'from outside this directory imports code nothing here has read.',
  );
});
