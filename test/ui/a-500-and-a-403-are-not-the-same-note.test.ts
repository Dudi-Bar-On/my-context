// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m19, second clause: "a 500 and a 403 reach the reader
 * through the same `errorNote`".**
 *
 * `refusalDetail` in `src/ui/public/app.js` is the one place this shell turns
 * a failed response into the sentence a reader sees. The gate's refusals carry
 * a status line and nothing else (Task 13, ruling A4), so when there is no
 * body it answers `String(response.status)` — and that is every bodyless
 * failure there is. A reader met a bare `403` and a bare `500` as the same
 * shape: a number, framed by `errorNote`, drawn instead of the data.
 *
 * They are opposite facts and the remedies have nothing in common. A 403 is a
 * running server saying no to this credential — the shell RAISES A BANNER for
 * it, clears the token and recovers on the next request. A 500 is the server
 * failing while handling the request: nothing about the credential is wrong,
 * no banner is raised, and a reader who reads the number as a refusal will go
 * and fetch a fresh nonce that changes nothing. `errorNote`'s own docstring
 * ends on the rule this breaks — *"an endpoint that refused and a corpus that
 * is empty are two facts, and this project's own invariant is that the
 * difference survives"*.
 *
 * ── WHAT IS DELIBERATELY NOT CHANGED, AND WHY IT IS HALF THE TEST ─────────
 *
 * **The 4xx strings are byte-identical, and they have to be.** `request()`
 * throws `new Error('401')` for a request it does not send, and its comment
 * says why in as many words: *"Keeping it byte-identical is deliberate: every
 * caller — the screens, `fillProvenance`'s `prov.projFailed`,
 * `ctx-post.spec.ts` — sees precisely what it saw before."* `e2e/ctx-post.spec
 * .ts:211` matches that message against `/^(401|403)$/`. So the narrowing is
 * on the SERVER-FAULT class alone, which no caller reads and no spec pins, and
 * the second test here is what holds the rest still. This lane runs no
 * Playwright, so that contract is asserted here rather than assumed.
 *
 * ── WHY THE FUNCTION IS PARSED OUT AND RUN, RATHER THAN GREPPED ──────────
 *
 * `app.js` is browser code and this lane may not drive a browser, but a test
 * that only matched source text could not plant the condition — and the
 * condition IS the point: a response with a given status and no body. So the
 * declaration is located through TypeScript's own parser (never a grep: the
 * name appears in three comments in this file) and evaluated. What runs is the
 * shipped text, byte for byte, and `refusalDetail` closes over nothing — it
 * reads `response.text()`, `response.status`, `JSON.parse` and `String`, and
 * that is all — so there is no environment to fake and nothing to drift.
 *
 * The last test is what keeps that honest: it asserts the parsed function is
 * the one `request()` actually reaches for on `!response.ok`. Without it this
 * file could go on measuring a function nothing calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const APP = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'app.js');

function parsed(): ts.SourceFile {
  const text = readFileSync(APP, 'utf8');
  return ts.createSourceFile(APP, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
}

/** One top-level function declaration of `app.js`, by name. */
function declaration(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  let found: ts.FunctionDeclaration | undefined;
  source.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
  });
  assert.notEqual(
    found, undefined,
    `\`${name}\` is no longer a top-level function declaration in app.js — this scan has lost ` +
    'its subject and would pass by measuring nothing',
  );
  return found!;
}

type Refusal = (response: { status: number; text(): Promise<string> }) => Promise<string>;

/**
 * The shipped `refusalDetail`, parsed out of `app.js` and made callable.
 *
 * **`statusOnly` is built beside it and the pair is named here on purpose.**
 * Those two declarations are the whole of what this behaviour is: one decides
 * whether there is a body to quote, the other decides what a status ALONE
 * means. Anything either of them comes to depend on has to be added here, and
 * a dependency that was not added fails loudly on a missing name rather than
 * quietly measuring a stale copy.
 */
function refusalDetail(): Refusal {
  const source = parsed();
  const text = ['statusOnly', 'refusalDetail']
    .map((name) => declaration(source, name).getText(source))
    .join('\n');
  // eslint-disable-next-line no-new-func -- the project's own source, read from
  // disk and run unmodified; see this file's header for why it is not grepped.
  return new Function(`${text}\nreturn refusalDetail;`)() as Refusal;
}

const answered = (status: number, body = ''): { status: number; text(): Promise<string> } => ({
  status,
  text: () => Promise.resolve(body),
});

test('a bodyless 500 does not reach the reader as a bare number, the way a refusal does', async () => {
  const said = await refusalDetail()(answered(500));

  assert.notEqual(
    said, '500',
    'the server failed while handling the request and the reader is shown the digits 500 — the ' +
    'same shape a 403 arrives in, which the shell answers with a banner about a credential. ' +
    'A reader who reads it that way goes and fetches a nonce that cannot help.',
  );
  assert.match(
    said, /500/u,
    'the status itself must survive — it is the one fact that was measured, and a sentence ' +
    'without it cannot be looked up',
  );
  assert.match(
    said, /server/u,
    'the sentence has to say WHICH side failed; that is the entire difference from a refusal',
  );
  // 502, 503, 504 are the same class and reach a reader through the same note.
  for (const status of [502, 503]) {
    assert.notEqual(
      await refusalDetail()(answered(status)), String(status),
      `${status} is the same class as 500 and was narrowed only for 500`,
    );
  }
});

test('and every 4xx string is byte-identical, which is a contract this lane cannot run', async () => {
  // `request()`'s own comment, and `e2e/ctx-post.spec.ts:211`'s `/^(401|403)$/`.
  // The computed 401 that never leaves the page is spelled to match what a real
  // token-missing response produces, so a change here silently breaks a pairing
  // no unit test would see. Playwright is not available to this lane; this is
  // the assertion that stands in its place.
  const detail = refusalDetail();
  for (const status of [401, 403, 404, 409, 429]) {
    assert.equal(
      await detail(answered(status)), String(status),
      `a bodyless ${status} must arrive exactly as it always has`,
    );
  }
});

test('an endpoint that sent its own words is still quoted, unedited, on both classes', async () => {
  // The other half of `errorNote`'s rule: what is NOT worded is the message.
  // A narrowing that spoke over the endpoint's own sentence would be a second
  // defect wearing the first one's name.
  const detail = refusalDetail();
  assert.equal(
    await detail(answered(500, JSON.stringify({ error: 'the corpus could not be opened' }))),
    'the corpus could not be opened',
  );
  assert.equal(
    await detail(answered(403, JSON.stringify({ error: 'token-mismatch' }))),
    'token-mismatch',
  );
  // A body that parses to nothing useful still falls back to the status, and
  // for a server fault it falls back to the narrowed sentence rather than to
  // the bare number — the same reasoning as an empty body, which is the state
  // it actually is.
  assert.equal(await detail(answered(403, '{}')), '403');
  assert.notEqual(await detail(answered(500, 'not json at all')), '500');
});

test('and it is the function `request()` reaches for when a response is not ok', () => {
  // Without this, everything above could be measuring a function nothing calls.
  const source = parsed();
  const request = declaration(source, 'request');
  let calls = 0;
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'refusalDetail') calls += 1;
    node.forEachChild(walk);
  };
  walk(request);
  assert.equal(
    calls, 1,
    '`request()` no longer turns a failed response into a sentence through `refusalDetail`, so ' +
    'the narrowing this file measures is on a path the page does not take',
  );
});
