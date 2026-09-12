// @basis TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with
/**
 * **No test binds a listening port except through a starter that screens it.**
 *
 * ── WHY A TEST AND NOT A COMMENT ────────────────────────────────────────────
 *
 * The screen already existed. `test/ui/unsafe-ports.ts` carries the 80 ports
 * Chrome refuses and the 2 more node's `fetch` refuses, both MEASURED, and
 * `startOnSafePort` discards a server that landed on one and asks for another
 * port. `test/ui/helpers.ts` has a paragraph telling the next person to use it.
 *
 * That paragraph was the whole enforcement, and it failed exactly the way a
 * paragraph fails: **only one starter of four went through the guard.** The
 * spawned-child path did; the in-process path (ten files, twenty call sites),
 * one raw `http.createServer` around a single handler, and one bare
 * `spawnUiChild` asking for `--port 0` did not. Nobody decided that. Each was
 * written by somebody who had not read the paragraph, which is the normal case.
 *
 * The cost is measured and it is not five flakes. On this machine
 * `netsh int ipv4 show dynamicport tcp` reports an ephemeral range of
 * 1024-15000, which contains 19 refused ports — roughly 1 draw in 736. Under
 * load a full `npm test` drew enough of them to fail about five tests a run,
 * **in different files each run**, every one of which passed alone. A varying
 * set of victims is what teaches people to re-run instead of read, and the cost
 * of that habit is the next real failure being dismissed. See
 * `TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with`.
 *
 * So the rule gets a gate. A new helper that binds a port the unguarded way
 * fails here, in `npm test`, on the day it is written — not as somebody else's
 * red run a fortnight later.
 *
 * ── THE THREE SHAPES, AND THE ONE MODULE EACH IS ALLOWED IN ─────────────────
 *
 *   1. `in-process` — importing `startUiServer` from `src/ui/server.ts`.
 *      Allowed only in `test/helpers/safe-ui-server.ts`, which wraps it.
 *   2. `raw-listen` — binding a port directly in a file that then reaches a
 *      server over HTTP. Allowed only in `test/helpers/safe-port.ts`.
 *   3. `os-port-spawn` — a `spawnUiChild` call asking for `--port 0`, which is
 *      the OS choosing, without `startOnSafePort` on it. Allowed only in
 *      `test/ui/helpers.ts`, where `startUiChild` IS that wrapping.
 *
 * One allowed module per shape, named here rather than accumulated as a list.
 * `plan:walk seq:79` is the counter-example this design is answering: an
 * allowance list grew to five entries and hid two real failures inside itself.
 * A list that can only ever have one entry per shape cannot do that, and adding
 * a second entry is a visible act in a reviewed diff rather than a line in a
 * file nobody reads.
 *
 * ── WHY THE SCREEN IS NOT INSIDE `startUiServer` ────────────────────────────
 *
 * Because the list is a fact about a TEST's consumers, not about the product. A
 * person who runs `mycontext ui --port 6669` and gets served on some other port
 * has been lied to by their own tool. `test/helpers/safe-ui-server.ts` carries
 * the full argument.
 *
 * ── A COMMENT IS PROSE, AND PROSE DOES NOT BIND A PORT ──────────────────────
 *
 * Every comment is masked to spaces before anything is matched, line numbers
 * intact. That is not a concession to this file's own header: fifteen files in
 * the tree NAME `startUiServer` in a comment while importing nothing, and a
 * checker wrong fifteen times on its first run is a checker switched off on
 * its second. Both halves were reported by this gate's own first runs — the
 * block mask by its header, the line mask by a comment in
 * `test/ui/conversation-document.test.ts` quoting the bare bind it had just
 * stopped performing.
 *
 * ── THIS FILE IS ITS OWN FIXTURE, AND IS SCANNED LIKE EVERY OTHER ───────────
 *
 * The positive controls below need source text containing the exact tokens this
 * gate refuses, and those live in string literals, which are code. So every
 * refused token is built by CONCATENATION and the literal never appears in this
 * file at all. The usual alternative — exempt the gate from its own scan —
 * opens the one hole nobody would think to look in, so it is not taken: the
 * last test asserts there is no exemption and that this file is clean.
 *
 * ── WHAT IT CANNOT SEE ──────────────────────────────────────────────────────
 *
 *   - **The comment mask is naive.** It has no idea what a string literal is,
 *     so a `/*` inside one starts a mask and could hide a real offence after
 *     it. That is a false NEGATIVE, which is the worse direction, and it is
 *     accepted because the alternative is a tokeniser. The canary is the second
 *     test below: each of the three wrappers must still EXHIBIT its shape after
 *     masking, so a mask that started eating source would redden here rather
 *     than go quiet.
 *
 *   - **`raw-listen` couples a bind to an HTTP reach PER FILE.** A file that
 *     binds while a different file fetches is not seen. Nothing in the tree is
 *     shaped that way today, and the alternative — flagging every bind,
 *     including the four `net.createServer()` probes that are only ever reached
 *     with `net.connect` and are genuinely not exposed to a `bad port` — is the
 *     shape that gets a checker switched off. A false offender is worse than
 *     this gap.
 *   - It reads text, not a type graph. An alias through a re-export would pass.
 *     That is a deliberate act, and this gate is aimed at the accident.
 *   - It says nothing about a port bound inside `src/`. A hook or an upkeep
 *     tick that starts a server is out of reach here, exactly as it is for
 *     `test/ui/sessions-pin.test.ts`, and for the same reason: descending into
 *     `src/` costs more false offenders than it finds real ones.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

/** The three shapes, spelled the way an offence is reported. */
type Shape = 'in-process' | 'raw-listen' | 'os-port-spawn';

export interface Offence {
  file: string;
  line: number;
  shape: Shape;
  detail: string;
}

interface Source { file: string; text: string }

/**
 * The one module each shape is allowed in, keyed by repo-relative POSIX path.
 *
 * Not a list that grows: each entry is the wrapper that APPLIES the guard, so
 * a second entry would mean a second wrapper, which is a design change and not
 * a waiver.
 */
const ALLOWED: Record<Shape, string> = {
  'in-process': 'test/helpers/safe-ui-server.ts',
  'raw-listen': 'test/helpers/safe-port.ts',
  'os-port-spawn': 'test/ui/helpers.ts',
};

/* ── the detectors ────────────────────────────────────────────────────────── */

/**
 * Built rather than written, so this file does not match its own controls.
 * See the header.
 */
const UI_SERVER_EXPORT = 'startUi' + 'Server';
const LISTEN_CALL = '.' + 'listen(';
const SPAWN_CALL = 'spawnUi' + 'Child(';
const OS_PORT = "'--port', '0'";

/**
 * The token that IS each shape, for the canary below: the allowed module has
 * to still contain the thing it is allowed to contain, AFTER masking.
 */
const SHAPE_TOKEN: Record<Shape, string> = {
  'in-process': UI_SERVER_EXPORT,
  'raw-listen': LISTEN_CALL,
  'os-port-spawn': SPAWN_CALL,
};

/** An `import … startUiServer … from '…/src/ui/server.ts'`, across line breaks. */
const IMPORT_UI_SERVER = new RegExp(
  String.raw`import[^;]*\b${UI_SERVER_EXPORT}\b[^;]*from\s*'[^']*src/ui/server\.ts'`,
  's',
);

/** What counts as "this file reaches a server over HTTP". */
function reachesOverHttp(text: string): boolean {
  return text.includes('fetch(') || text.includes('.goto(');
}

/**
 * The text with every comment blanked to spaces — same length, newlines kept,
 * so every reported line number is still the line in the file.
 *
 * **A `//` preceded by a colon is left alone**, because that is a URL scheme
 * and not a comment. Without that exception the first `http://…` on a line
 * would blank the rest of it, which is how a masker starts hiding the very
 * calls it was written to expose. Both halves of this rule were reported by
 * this gate's own first two runs: the block mask by its header, the line mask
 * by `test/ui/conversation-document.test.ts`, whose comment quotes the bare
 * bind it no longer performs.
 *
 * Exported because the mask is the part most likely to be wrong, and a caller
 * that wants to see what was judged should be able to look at it rather than
 * infer it from a verdict.
 */
export function maskComments(text: string): string {
  const blanked = (m: string): string => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blanked)
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, (m, before: string) =>
      before + blanked(m.slice(before.length))))
    .join('\n');
}

/** Every offence in one source. */
export function offencesIn(input: Source): Offence[] {
  const out: Offence[] = [];
  // Prose is not code. A comment naming `startUiServer` imports nothing, binds
  // nothing, and spawns nothing; judging it reports fifteen files that are
  // innocent, including this one's own header.
  const source: Source = { file: input.file, text: maskComments(input.text) };
  const lines = source.text.split('\n');

  // 1. in-process. Reported at the line the import STARTS on, which is where a
  //    reader has to make the change.
  if (source.file !== ALLOWED['in-process'] && IMPORT_UI_SERVER.test(source.text)) {
    const at = lines.findIndex((l) => l.includes(UI_SERVER_EXPORT) && l.includes('import'));
    const start = at === -1 ? lines.findIndex((l) => l.includes(UI_SERVER_EXPORT)) : at;
    out.push({
      file: source.file,
      line: (start === -1 ? 0 : start) + 1,
      shape: 'in-process',
      detail:
        `imports ${UI_SERVER_EXPORT} from src/ui/server.ts. Its default port is 0 — the OS `
        + "choosing — and the OS does not know that node's fetch refuses a list of ports "
        + `outright with \`bad port\`. Import { startSafeUiServer } from '${ALLOWED['in-process']}' `
        + 'instead; same options, same rejections, a port a consumer will talk to.',
    });
  }

  // 2. raw-listen, only where the same file also reaches a server over HTTP.
  if (source.file !== ALLOWED['raw-listen'] && reachesOverHttp(source.text)) {
    lines.forEach((line, i) => {
      if (!line.includes(LISTEN_CALL)) return;
      out.push({
        file: source.file,
        line: i + 1,
        shape: 'raw-listen',
        detail:
          'binds a port directly in a file that then reaches a server over HTTP. '
          + `Wrap the server in listenOnSafePort from '${ALLOWED['raw-listen']}', which `
          + 'discards a port the consumer refuses and binds another.',
      });
    });
  }

  // 3. os-port-spawn. An explicit non-zero port is the CALLER's choice and is
  //    left alone: retrying it would only rebind the same number.
  if (source.file !== ALLOWED['os-port-spawn']) {
    lines.forEach((line, i) => {
      if (!line.includes(SPAWN_CALL) || !line.includes(OS_PORT)) return;
      if (line.includes('startOnSafePort(')) return;
      out.push({
        file: source.file,
        line: i + 1,
        shape: 'os-port-spawn',
        detail:
          `asks the OS for a port (${OS_PORT}) without the screen. Call startUiChild from `
          + `'${ALLOWED['os-port-spawn']}', or wrap this call in startOnSafePort(...).`,
      });
    });
  }

  return out;
}

/* ── the tree ─────────────────────────────────────────────────────────────── */

const SCANNED_ROOTS = ['test', 'e2e'];
const SCANNED_EXTENSIONS = ['.ts', '.js', '.mjs'];

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCANNED_EXTENSIONS.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function sources(): Source[] {
  const out: Source[] = [];
  for (const root of SCANNED_ROOTS) {
    for (const full of walk(path.join(REPO, root), [])) {
      out.push({
        file: path.relative(REPO, full).split(path.sep).join('/'),
        text: readFileSync(full, 'utf8'),
      });
    }
  }
  return out;
}

/* ── the gate ─────────────────────────────────────────────────────────────── */

test('no test or spec binds a port outside a starter that screens it', () => {
  const scanned = sources();

  // Anti-vacuity. A walk that found nothing would report green forever while
  // the tree filled up with unguarded binds, which is the failure this file
  // exists to prevent — so it fails as itself.
  assert.ok(scanned.length > 100, `scanned only ${scanned.length} files under test/ and e2e/`);
  for (const [shape, file] of Object.entries(ALLOWED)) {
    assert.ok(
      scanned.some((s) => s.file === file),
      `the module allowed to hold the ${shape} shape is missing: ${file}`,
    );
  }

  const offences = scanned.flatMap(offencesIn);
  assert.deepEqual(
    offences.map((o) => `${o.file}:${o.line} [${o.shape}] ${o.detail}`),
    [],
    'a port bound outside the safe-port guard fails under load and blames an innocent file',
  );
});

/**
 * **The allowance is an allowance, not a hole.** Each allowed module must
 * ACTUALLY contain the shape it is allowed to contain — otherwise the name has
 * drifted off the wrapper, and the gate is exempting a file that no longer
 * applies any guard while the real wrapper goes unchecked.
 */
test('each allowed module really is the wrapper it is allowed to be', () => {
  const scanned = sources();
  const find = (file: string): Source => {
    const found = scanned.find((s) => s.file === file);
    assert.ok(found !== undefined, `missing: ${file}`);
    return found;
  };

  for (const shape of Object.keys(ALLOWED) as Shape[]) {
    const file = ALLOWED[shape];
    const source = find(file);
    // AFTER masking, because that is what the gate judges. A mask that started
    // eating source instead of comments would empty these and redden here,
    // rather than quietly stop finding offences everywhere else.
    const code = maskComments(source.text);
    assert.ok(
      code.includes(SHAPE_TOKEN[shape]),
      `${file} is allowed to hold the ${shape} shape but no longer contains `
      + `${SHAPE_TOKEN[shape]} in code — either the wrapper moved, or the comment `
      + 'mask is eating source',
    );
    // And it applies the guard rather than merely holding the shape.
    assert.match(
      code, /startOnSafePort/,
      `${file} is exempt from ${shape} but never calls startOnSafePort`,
    );
  }
});

/* ── positive controls: the detectors can still fail ──────────────────────── */

/**
 * **The mask, on its own, including the exception that is easy to lose.**
 *
 * Written because a removal proof found it uncovered: widening the line-comment
 * rule to swallow `://` reddened NOTHING, because every other assertion here
 * happens to keep its `fetch(` to the left of the URL. An exception no test
 * defends is an exception the next reader deletes as dead weight.
 */
test('the mask blanks comments, spares URL schemes, and keeps every line', () => {
  const masked = maskComments(
    "const u = 'http://x/y'; // a trailing note\n"
    + '/* a block\n   of prose */ code();\n',
  );
  assert.match(masked, /'http:\/\/x\/y'/, 'a URL scheme is not a comment');
  assert.doesNotMatch(masked, /trailing note/, 'the line comment survived the mask');
  assert.doesNotMatch(masked, /of prose/, 'the block comment survived the mask');
  assert.match(masked, /code\(\);/, 'code after a block comment was eaten');
  assert.equal(masked.split('\n').length, 4, 'line numbers must not move');
  assert.equal(masked.split('\n')[0]?.length, "const u = 'http://x/y'; // a trailing note".length,
    'the mask must pad, not shorten — a shortened line moves every column after it');
});

test('the in-process shape is caught, and only outside its wrapper', () => {
  const text = `import { ${UI_SERVER_EXPORT}, type X } from '../../src/ui/server.ts';\n`;
  const caught = offencesIn({ file: 'test/ui/planted.test.ts', text });
  assert.equal(caught.length, 1, JSON.stringify(caught));
  assert.equal(caught[0]?.shape, 'in-process');
  assert.equal(caught[0]?.line, 1);
  assert.match(caught[0]?.detail ?? '', /startSafeUiServer/);

  // The same text in the wrapper is not an offence.
  assert.deepEqual(offencesIn({ file: ALLOWED['in-process'], text }), []);

  // A MULTI-LINE import is the spelling `test/ui/nonce-route.test.ts` uses, and
  // a line-at-a-time matcher would miss it.
  const wrapped = `import {\n  A, B, ${UI_SERVER_EXPORT}, type C,\n} from '../../src/ui/server.ts';\n`;
  assert.equal(offencesIn({ file: 'test/ui/planted.test.ts', text: wrapped }).length, 1);

  // A file that merely NAMES it in prose is not an offence. Fifteen files do,
  // and a checker that is wrong fifteen times on its first run is a checker
  // that gets deleted.
  assert.deepEqual(
    offencesIn({
      file: 'test/ui/prose.test.ts',
      text: ` * the liveness record ${UI_SERVER_EXPORT} writes on listen.\n`,
    }),
    [],
  );

  // An import of something ELSE from the same module is not an offence.
  assert.deepEqual(
    offencesIn({
      file: 'test/ui/other.test.ts',
      text: "import { CODE_FREEZE_NOTICE } from '../../src/ui/server.ts';\n",
    }),
    [],
  );
});

test('the raw-listen shape is caught only where the file also talks HTTP', () => {
  const binding = `  server${LISTEN_CALL}0, '127.0.0.1', done);\n`;

  const withFetch = offencesIn({
    file: 'test/ui/planted.test.ts',
    text: `${binding}  const r = await fetch(\`http://127.0.0.1:\${port}/x\`);\n`,
  });
  assert.equal(withFetch.length, 1, JSON.stringify(withFetch));
  assert.equal(withFetch[0]?.shape, 'raw-listen');
  assert.equal(withFetch[0]?.line, 1);

  // A browser navigation counts as reaching it too.
  assert.equal(
    offencesIn({
      file: 'e2e/planted.spec.ts',
      text: `${binding}  await page.goto(url);\n`,
    }).length,
    1,
  );

  // A bind nothing fetches — the four `net.createServer()` probes reached with
  // `net.connect` — is deliberately NOT an offence. `bad port` is enforced by
  // fetch and by browsers; a raw socket connects to any port at all.
  assert.deepEqual(offencesIn({ file: 'test/core/probe.test.ts', text: binding }), []);

  // And the wrapper itself is allowed to bind.
  assert.deepEqual(
    offencesIn({ file: ALLOWED['raw-listen'], text: `${binding}fetch(\n` }),
    [],
  );
});

test('an OS-chosen port handed to a spawned child is caught unless it is screened', () => {
  const bare = `    first = await ${SPAWN_CALL}cwd, [${OS_PORT}]);\n`;
  const caught = offencesIn({ file: 'test/ui/planted.test.ts', text: bare });
  assert.equal(caught.length, 1, JSON.stringify(caught));
  assert.equal(caught[0]?.shape, 'os-port-spawn');
  assert.match(caught[0]?.detail ?? '', /startUiChild/);

  // Screened on the same call: not an offence.
  assert.deepEqual(
    offencesIn({
      file: 'test/ui/planted.test.ts',
      text: `    first = await startOnSafePort(() => ${SPAWN_CALL}cwd, [${OS_PORT}]));\n`,
    }),
    [],
  );

  // An EXPLICIT port is the caller's own choice — `session-continuity` restarts
  // on the first server's already-screened port, and `unsafe-ports.test.ts`
  // asks for 6669 on purpose to prove the retry against real sockets. Retrying
  // either would rebind the same number.
  assert.deepEqual(
    offencesIn({
      file: 'test/ui/planted.test.ts',
      text: `    second = await ${SPAWN_CALL}cwd, ['--port', String(port)]);\n`
        + `    const h = await ${SPAWN_CALL}cwd, ['--port', '6669']);\n`,
    }),
    [],
  );
});

/**
 * The header claims this file is scanned like every other, with no exemption.
 * That claim is worth exactly as much as the assertion under it.
 */
test('this gate exempts itself from nothing, and is clean under its own scan', () => {
  const self = 'test/ui/safe-port-gate.test.ts';
  assert.ok(
    !Object.values(ALLOWED).includes(self),
    'the gate has been added to its own allowance list',
  );
  const source = sources().find((s) => s.file === self);
  assert.ok(source !== undefined, `${self} was not reached by the walk`);
  assert.deepEqual(offencesIn(source), []);
});
