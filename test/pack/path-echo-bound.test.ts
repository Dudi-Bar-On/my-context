/**
 * The four echoes `TASK-refusefileentry-echoes-a-path-with-no-bound-and-a-path-is-a`
 * left alone when the other five were capped, now bounded — and bounded by a
 * DIFFERENT rule than those five, because these quote PATHS.
 *
 * `manifest.ts`'s `quoted()` (used by `refuseOpaqueMeta`, `refusePackName`,
 * `refuseDescriptiveVersion`) truncates one END and keeps `…`. That is the
 * right trade for a NAME a caller chose, where either end is as good as the
 * other. It is the wrong trade for a PATH: a receiver needs the category
 * prefix AND the filename to find the file a refusal is about, and cutting
 * one away produces a refusal nobody can act on. So `layout.ts`'s
 * `elidedEcho` elides the MIDDLE instead, keeps both ends, and states how
 * many characters it held back — a bare `…` reads the same whether ten
 * characters were cut or ten thousand, and this project's bounds say what
 * they held back.
 *
 * **Measured 2026-08-24, before this bound existed, through `parseManifest`
 * — a stranger's `manifest.json`, no flag typed** (message length in
 * characters): an unknown key of 5,000 characters printed 5,379; a
 * non-string `path` printed 7,075; a bad `sha256` alongside a 5,000-character
 * `path` printed in the 5,280s; and a 5,000-character `path` refused by
 * `layout.ts`'s own shape rules, revoiced by `parseManifest`, printed 5,336.
 * Reproduced below with the same shapes; the exact figures move a few
 * characters with the exact payload, the unboundedness does not.
 *
 * **Why 1024, against `layout.ts`'s own arithmetic.** The longest a LEGAL
 * artefact path can be is `items/<category>/<file>.md`: two 255-byte
 * segments (`MAX_SEGMENT_BYTES`) plus `items/` and two separators, about 767
 * bytes. 1024 is comfortably above that — a legal path never reaches this
 * bound — and comfortably below the multi-thousand-character values a
 * stranger's file can put in these fields. See `MAX_PATH_ECHO`'s own doc
 * comment in `layout.ts` for the number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  buildManifest, parseManifest, renderManifest, type ManifestMeta,
} from '../../src/pack/manifest.ts';
import {
  elidedEcho, refuseArtefactPath, refuseArtefactPaths, MAX_PATH_ECHO,
  type ExportFile,
} from '../../src/pack/layout.ts';

const file = (p: string, body: string): ExportFile => ({ path: p, bytes: Buffer.from(body, 'utf8') });
const FILES = [file('config.json', '{}'), file('items/rule/RULE-a.md', 'a')];
const META: ManifestMeta = {
  kind: 'pack', name: 'acme', version: '2026-08 rev 3', now: 1_755_000_000_000,
};

/** A rendered manifest with one deliberate defect, in the bytes a reader gets. */
function tampered(mutate: (m: Record<string, unknown>) => void): Buffer {
  const copy = JSON.parse(
    renderManifest(buildManifest(FILES, META)).toString('utf8'),
  ) as Record<string, unknown>;
  mutate(copy);
  return Buffer.from(`${JSON.stringify(copy, null, 2)}\n`, 'utf8');
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('expected a refusal, got none');
}

/**
 * The bound every assertion below shares: short, visibly cut, says how much
 * it cut, and keeps both the head and the tail of the value.
 */
function boundedPath(message: string, head: string, tail: string, reason: RegExp): void {
  assert.ok(
    message.length < 2_000,
    `the refusal echoed an unbounded path: ${message.length} characters`,
  );
  assert.match(message, /…\(\d+ characters elided\)…/, 'no stated elision count');
  assert.ok(message.includes(head), 'the category/lead end of the path is gone');
  assert.ok(message.includes(tail), 'the filename/tail end of the path is gone');
  assert.match(message.replace(/\s+/g, ' '), reason);
}

// ---------------------------------------------------------------------------
// `elidedEcho` itself
// ---------------------------------------------------------------------------

test('a value at or under the bound is returned whole, with no marker', () => {
  const short = JSON.stringify('items/rule/RULE-a.md');
  assert.equal(elidedEcho(short), short);
  const exactlyAtBound = JSON.stringify('a'.repeat(MAX_PATH_ECHO - 2));
  assert.equal(exactlyAtBound.length, MAX_PATH_ECHO);
  assert.equal(elidedEcho(exactlyAtBound), exactlyAtBound, 'the boundary itself must not be cut');
});

test('a value over the bound keeps both ends and states the cut', () => {
  const text = JSON.stringify(`items/rule/${'A'.repeat(5000)}.md`);
  const out = elidedEcho(text);
  assert.ok(out.length < text.length, 'nothing was elided');
  assert.ok(out.startsWith('"items/rule/'), 'the lead end (category) is gone');
  assert.ok(out.endsWith('.md"'), 'the tail end (filename) is gone');
  assert.match(out, /…\(\d+ characters elided\)…/);
  const [, countStr] = out.match(/…\((\d+) characters elided\)…/) as RegExpMatchArray;
  assert.equal(Number(countStr), text.length - out.replace(/…\(\d+ characters elided\)…/, '').length,
    'the stated count does not match what is actually missing');
});

test('a real 52-to-104-character path is printed whole, with no marker', () => {
  // The measured range of real paths in this repository (median 52, p95 93,
  // max 104) — nowhere near the 1024-character bound.
  for (const len of [52, 93, 104]) {
    const p = `items/rule/${'a'.repeat(Math.max(1, len - 'items/rule/.md'.length))}.md`;
    const bad = refuseArtefactPath(p);
    // Some of these synthetic names may trip an unrelated rule (none should
    // here, all are plain ascii under the segment cap); the point of this
    // test is narrower than "is legal" — it is "if refused, not for length".
    if (bad !== null) {
      assert.equal(bad.includes('…'), false, `a ${p.length}-character legal-length path was elided`);
    }
    assert.equal(refuseArtefactPath(p), null, `${JSON.stringify(p)} should be a legal path`);
  }
});

// ---------------------------------------------------------------------------
// Branch 4 — `refuseArtefactPath`, revoiced by `parseManifest`
// ---------------------------------------------------------------------------

test('an over-long single-segment path refused by layout.ts is bounded, not echoed whole', () => {
  const longPath = 'A'.repeat(5000);
  const message = refuseArtefactPath(longPath) as string;
  assert.ok(message !== null);
  boundedPath(message, 'AAAA', 'AAAA', /not one of the artefact's root files/);
});

test('the same over-long path, reached from a stranger\'s manifest.json through parseManifest, is bounded', () => {
  const longPath = 'A'.repeat(5000);
  const message = refusalOf(() => parseManifest(tampered((m) => {
    (m.files as Array<Record<string, unknown>>)[0]!.path = longPath;
  })));
  boundedPath(message, 'AAAA', 'AAAA', /does not list one artefact's worth of files/);
});

test('refuseArtefactPaths (the set-level check) bounds the same over-long path', () => {
  const longPath = 'A'.repeat(5000);
  const message = refuseArtefactPaths([longPath]) as string;
  assert.ok(message !== null);
  boundedPath(message, 'AAAA', 'AAAA', /not one of the artefact's root files/);
});

// ---------------------------------------------------------------------------
// The three `refuseFileEntry` branches
// ---------------------------------------------------------------------------

test('an unknown key of 5,000 characters is bounded', () => {
  const key = `Q${'K'.repeat(4999)}`;
  const message = refusalOf(() => parseManifest(tampered((m) => {
    (m.files as Array<Record<string, unknown>>)[0]![key] = 'x';
  })));
  boundedPath(message, 'QKKK', 'KKKK', /which is not a key a manifest entry has/);
});

test('a non-string path (an array standing in for it) is bounded', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => {
    (m.files as Array<Record<string, unknown>>)[0]!.path = Array(1000).fill('zzzz');
  })));
  assert.ok(message.length < 2_000, `still unbounded: ${message.length} characters`);
  assert.match(message, /…\(\d+ characters elided\)…/);
  assert.match(message.replace(/\s+/g, ' '), /which is not a string/);
});

test('a bad sha256 alongside a 5,000-character path is bounded on both quoted values', () => {
  const longPath = `items/rule/${'A'.repeat(5000)}.md`;
  const message = refusalOf(() => parseManifest(tampered((m) => {
    const entry = (m.files as Array<Record<string, unknown>>)[0]!;
    entry.path = longPath;
    entry.sha256 = 'not-a-real-digest';
  })));
  boundedPath(message, 'items/rule/AAAA', 'AAAA.md', /not 64 lowercase hex characters/);
});

test('a bad sha256 that is itself 5,000 characters is bounded too', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => {
    const entry = (m.files as Array<Record<string, unknown>>)[0]!;
    entry.sha256 = 'f'.repeat(5000);
  })));
  assert.ok(message.length < 2_000, `still unbounded: ${message.length} characters`);
  assert.match(message, /…\(\d+ characters elided\)…/);
});

// ---------------------------------------------------------------------------
// A short value is never touched
// ---------------------------------------------------------------------------

test('a short, ordinary manifest entry path is never elided', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => {
    const entry = (m.files as Array<Record<string, unknown>>)[0]!;
    entry.sha256 = 'not-hex-but-short';
  })));
  assert.match(message, /"config\.json"/);
  assert.equal(message.includes('elided'), false, `a short path was elided: ${message}`);
});
