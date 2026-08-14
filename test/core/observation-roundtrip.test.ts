/**
 * Spec §10 requires the round trip to be lossless: what the mutation layer
 * writes must re-parse to the same item and re-render to the same bytes.
 *
 * The variants below are the ones that broke it. All of them are ordinary
 * prose a model writes without thinking: a double space after a full stop, a
 * tab, a non-breaking space, stray padding, padding inside `context`. Each
 * one used to produce a file whose recorded checksum could never match its
 * own content again — `mycontext doctor` exited 1 and accused the user of
 * editing a file that my_context itself had just written, and `rebuild` did
 * not repair it, because rebuild reads files into the index rather than
 * rewriting them.
 *
 * Every variant is checked two ways, because they fail independently:
 *   (a) `computeItemChecksum(reparsed)` equals the checksum stored IN the
 *       file — the doctor's actual check;
 *   (b) `renderItem(parseItem(file)) === file` — spec §10's byte identity.
 * One variant is additionally driven through the real MCP registry, since
 * that surface (not ingest) is where these arrived and where the collapse
 * used to be missing entirely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { createItem, supersedeItem, type MutationContext } from '../../src/core/mutate.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import type { Observation } from '../../src/core/types.ts';

const NBSP = ' ';

interface Fixture { cwd: string; ctx: MutationContext; close: () => void }

function fixture(): Fixture {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-obs-'));
  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  const root = ws.projectRoot;
  assert.ok(root, 'init should have created a project layer');
  return {
    cwd,
    ctx: { root, store, config: ws.config },
    close: () => { store.close(); rmSync(cwd, { recursive: true, force: true }); },
  };
}

/** Asserts spec §10 on the file `filePath` (root-relative POSIX) actually holds. */
function assertRoundTrips(cwd: string, filePath: string): void {
  const abs = path.join(cwd, '.my_context', ...filePath.split('/'));
  const raw = readFileSync(abs, 'utf8');
  const reparsed = parseItem(raw, filePath, 'project');

  assert.equal(
    computeItemChecksum(reparsed), reparsed.checksum,
    `${filePath}: the checksum stored in the file does not match the file's own content — ` +
    `this is exactly what \`mycontext doctor\` reports as an edit made outside my_context.`,
  );
  assert.equal(renderItem(reparsed), raw, `${filePath}: re-rendering the parsed item is not byte-identical`);
}

const VARIANTS: { name: string; observation: Observation }[] = [
  {
    name: 'a double space after a sentence',
    observation: { category: 'note', text: 'The pool leaked.  Connections were never returned.', tags: [], context: null },
  },
  {
    name: 'a tab inside the text',
    observation: { category: 'note', text: `A tab\there`, tags: [], context: null },
  },
  {
    name: 'a non-breaking space inside the text',
    observation: { category: 'note', text: `A nbsp${NBSP}here`, tags: [], context: null },
  },
  {
    name: 'leading and trailing whitespace',
    observation: { category: 'note', text: '   padded on both ends   ', tags: [], context: null },
  },
  {
    name: 'whitespace at the edges of context',
    observation: { category: 'note', text: 'Rate limiting applies', tags: [], context: '  at registration  ' },
  },
  {
    name: 'whitespace-only context, which renders as no context at all',
    observation: { category: 'note', text: 'Rate limiting applies', tags: [], context: '   ' },
  },
];

for (const variant of VARIANTS) {
  test(`an observation with ${variant.name} round-trips byte-identically`, () => {
    const f = fixture();
    try {
      const result = createItem(f.ctx, {
        type: 'lesson',
        title: `Round trip: ${variant.name}`,
        body: 'A body.',
        observations: [variant.observation],
      });
      assert.equal(result.created, true, result.message);
      assertRoundTrips(f.cwd, result.filePath);
    } finally {
      f.close();
    }
  });
}

test('a second create_item with the same whitespace-noisy observation still dedupes', () => {
  // The hash and the stored item must see the SAME normalized observations.
  // If `contentHash` were taken over the raw input while the item stored the
  // collapsed text, the second call would hash the raw form, fail to match
  // the item on disk, and mint a spurious duplicate.
  const f = fixture();
  try {
    const input = {
      type: 'lesson',
      title: 'Deduped despite noisy whitespace',
      body: 'A body.',
      observations: [{ category: 'note', text: 'One.  Two.', tags: [], context: null }],
    };
    const first = createItem(f.ctx, input);
    const second = createItem(f.ctx, input);
    assert.equal(second.created, false, second.message);
    assert.equal(second.id, first.id);
  } finally {
    f.close();
  }
});

test('a supersede reason carrying a double space round-trips on the replacement', () => {
  // `supersedeItem` builds an observation out of `reason` itself, so it needs
  // the same normalization the create path gets — the replacement's checksum
  // is what breaks otherwise, not the retiree's.
  const f = fixture();
  try {
    const old = createItem(f.ctx, { type: 'lesson', title: 'The old lesson', body: 'Old.' });
    const now = createItem(f.ctx, { type: 'lesson', title: 'The new lesson', body: 'New.' });
    supersedeItem(f.ctx, {
      id: old.id,
      by: now.id,
      reason: 'the pool was fixed.  Properly this time',
    });
    assertRoundTrips(f.cwd, now.filePath);
    assertRoundTrips(f.cwd, old.filePath);
  } finally {
    f.close();
  }
});

test('a double space through the real MCP create_item tool round-trips', () => {
  // The surface where this actually arrived: the MCP path never reaches
  // `src/ingest/schema.ts`, where the collapse used to live.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-obs-mcp-'));
  try {
    runCli(['init'], cwd, () => {});
    const registry = createRegistry(cwd);
    const message = String(registry.call('create_item', {
      type: 'lesson',
      title: 'Written through MCP',
      body: 'A body.',
      observations: [{ category: 'note', text: 'The pool leaked.  Twice.' }],
    }));

    const created = /created (\S+) \(/.exec(message);
    assert.ok(created, `create_item did not report a created item: ${message}`);
    // A checksum mismatch surfaces as a load error appended to the NEXT
    // tool call's output, so the message itself is a witness too.
    assert.doesNotMatch(message, /checksum mismatch/);
    assertRoundTrips(cwd, `items/lesson/${created[1]}.md`);

    const after = String(registry.call('create_item', {
      type: 'lesson', title: 'Anything else', body: 'b',
    }));
    assert.doesNotMatch(after, /could not be read during rebuild/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('extra.__proto__ is refused rather than silently vanishing on write', () => {
  // `renderItem` builds its frontmatter record with `fm[key] = value`; for
  // `__proto__` that sets the record's prototype instead of adding an own
  // property, so the field never reaches the file — while the checksum was
  // taken over an item that still carried it. Verified by execution before
  // this guard was added: the rendered file had no such line, the re-parsed
  // `extra` was `{}`, and the checksum did not match.
  //
  // `JSON.parse`, not an object literal: only the former produces a real own
  // `__proto__` property, which is the shape that actually arrives through
  // the library entry point.
  const f = fixture();
  try {
    const extra = JSON.parse('{"__proto__": "boom"}') as Record<string, string>;
    assert.throws(
      () => createItem(f.ctx, { type: 'lesson', title: 'Proto', body: 'b', extra }),
      /extra field "__proto__" cannot be stored/,
    );

    // `constructor` and `prototype` were tested the same way and DO round-trip
    // (their checksums matched), so they must stay accepted — over-refusing
    // would be an invented rule.
    for (const key of ['constructor', 'prototype']) {
      const ok = createItem(f.ctx, {
        type: 'lesson', title: `Key ${key}`, body: 'b',
        extra: JSON.parse(`{"${key}": "fine"}`) as Record<string, string>,
      });
      assert.equal(ok.created, true, ok.message);
      assertRoundTrips(f.cwd, ok.filePath);
    }
  } finally {
    f.close();
  }
});
