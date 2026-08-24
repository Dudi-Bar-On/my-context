/**
 * `refuseOpaqueMeta`'s echoes, bounded — and the reason the bound is on the
 * VALUE and not on the message.
 *
 * `refuseOpaqueMeta` quotes the value it refuses, and the branches that do so
 * are not all downstream of its 64-code-point limit. Three fire BEFORE it:
 * the not-a-string branch, the all-whitespace branch and the trim-mismatch
 * branch. Each therefore quoted whatever arrived, at whatever length it
 * arrived at.
 *
 * **Measured on 2026-08-24, before the bound existed**, both surfaces, real
 * commands, message length in characters:
 *
 *     mycontext export --as-pack --pack-name "<5,000 spaces>"      5,178
 *     mycontext export --as-pack --pack-name "<5,000 z> "         10,252
 *     mycontext pack import <dir>   manifest name 5,000 spaces     5,175
 *     mycontext pack import <dir>   manifest name 5,000 z + " "   10,249
 *     mycontext pack import <dir>   manifest name ["zzzz" × 1000]  7,215
 *
 * The trim-mismatch figures are roughly double because that branch quotes the
 * value TWICE — once as what arrived and once as what to write instead.
 *
 * **Reachable from a stranger's file, which is what makes it worth bounding.**
 * `parseManifest` puts a received manifest's `name` and `version` through
 * `refuseMeta`, so a 5,000-character name in somebody else's artefact reaches
 * the terminal through these branches without anybody typing a flag. The
 * `parseManifest` tests below are that half; the `refusePackName` tests are
 * the rule itself.
 *
 * **Why the cap is on the value.** Measured on the import door on 2026-08-23:
 * capping the MESSAGE kept the attacker's 5,000 characters and threw away the
 * sentence saying what was wrong, because `refuseOpaqueMeta` prints the value
 * FIRST and the reason after it. So every assertion here checks both halves —
 * the message is short AND it still ends with the reason.
 *
 * The number is 256, the one this codebase already settled on for exactly this
 * job (`ui/security.ts` · `export const REFUSAL_VALUE_MAX = 256;` · ~291), and
 * the marker is its `…`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  buildManifest, parseManifest, refuseDescriptiveVersion, refusePackName, renderManifest,
  type ManifestMeta,
} from '../../src/pack/manifest.ts';
import type { ExportFile } from '../../src/pack/layout.ts';

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
 * The bound every assertion below shares: short, visibly cut, and STILL
 * carrying the sentence that says what was wrong.
 *
 * The ceiling is generous on purpose — it is not asserting the exact cap, it
 * is asserting that nothing unbounded got through. The exact cap is one
 * number in one module, and a test that pinned it here would fail the day
 * somebody rewrote a sentence rather than the day the bound came off.
 */
function bounded(message: string, reason: RegExp): void {
  assert.ok(
    message.length < 1_200,
    `the refusal echoed an unbounded value: ${message.length} characters`,
  );
  assert.match(message, /…/);
  assert.match(message.replace(/\s+/g, ' '), reason);
}

const SPACES = ' '.repeat(5000);
const UNTRIMMED = `${'z'.repeat(5000)} `;

// ---------------------------------------------------------------------------
// The rule itself
// ---------------------------------------------------------------------------

test('the all-whitespace branch bounds what it quotes and keeps its reason', () => {
  const message = refusePackName(SPACES);
  assert.ok(message !== null, 'a name of 5,000 spaces was accepted');
  bounded(message, /only whitespace/);
});

test('the trim-mismatch branch bounds BOTH values it quotes and keeps its reason', () => {
  const message = refusePackName(UNTRIMMED);
  assert.ok(message !== null, 'an untrimmed name was accepted');
  // This branch quotes twice — the value, and the value to write instead —
  // which is why it measured double the whitespace branch.
  bounded(message, /leading or trailing whitespace/);
  assert.equal(
    message.includes('z'.repeat(300)), false,
    'one of the two quoted values is still unbounded',
  );
});

test('the not-a-string branch bounds what it quotes too', () => {
  // Also before the length rule, also reachable from a stranger's manifest,
  // and it measured 7,215 characters through `pack import`.
  const message = refusePackName(Array(1000).fill('zzzz'));
  assert.ok(message !== null, 'an array was accepted as a name');
  bounded(message, /which is not a string/);
});

test('a version is held to the same bound, because it is the same guard', () => {
  const message = refuseDescriptiveVersion(UNTRIMMED);
  assert.ok(message !== null, 'an untrimmed version was accepted');
  bounded(message, /leading or trailing whitespace/);
  assert.match(message.replace(/\s+/g, ' '), /this pack's version/);
});

test('a value short enough to print whole is printed whole, with no marker', () => {
  // The bound must not become a truncation everything gets: a value a reader
  // could act on is quoted in full, and `…` is what says one was not.
  const message = refusePackName('acme security ');
  assert.ok(message !== null);
  assert.match(message, /"acme security "/);
  assert.equal(message.includes('…'), false, `a short value was truncated: ${message}`);
});

// ---------------------------------------------------------------------------
// The stranger's file — the half nobody typed
// ---------------------------------------------------------------------------

test('a 5,000-character whitespace name in a received manifest is bounded', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => { m.name = SPACES; })));
  bounded(message, /only whitespace/);
});

test('a 5,000-character untrimmed name in a received manifest is bounded', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => { m.name = UNTRIMMED; })));
  bounded(message, /leading or trailing whitespace/);
});

test('a non-string name in a received manifest is bounded', () => {
  const message = refusalOf(
    () => parseManifest(tampered((m) => { m.name = Array(1000).fill('zzzz'); })),
  );
  bounded(message, /which is not a string/);
});

test('a 5,000-character untrimmed VERSION in a received manifest is bounded', () => {
  const message = refusalOf(() => parseManifest(tampered((m) => { m.version = UNTRIMMED; })));
  bounded(message, /leading or trailing whitespace/);
});
