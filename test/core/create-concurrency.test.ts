/**
 * The race `test/core/concurrency.test.ts` cannot see: concurrent
 * `create_item` calls with the SAME title and DIFFERENT bodies.
 *
 * That test gives every writer a distinct title, so every writer allocates in
 * a different id family and no two writers ever compute the same id. Same
 * title + different bodies is the case where all racers compute the same
 * `nextId` from their own stale `ctx.store` snapshot, and the write that used
 * to follow (`writeFileSync` + `renameSync`) overwrote unconditionally — so
 * bodies were lost while every racer reported `created` and exit 0.
 *
 * The assertion is on the MARKDOWN, which is the source of truth (spec §3),
 * re-read from scratch: N processes must leave N items whose bodies are
 * exactly the N distinct bodies written, and the id each process was TOLD it
 * got must hold that process's own body.
 *
 * HONEST LIMIT: this is a probabilistic detector, not a proof of exclusion. A
 * green run means the race did not happen to lose anything this time, not
 * that it cannot. Two things push the detection rate up rather than leaving
 * it to luck: the fixture's wall-clock rendezvous barrier (see its comment),
 * and ROUNDS — each round is an independent race on a fresh title, and the
 * test fails if any round loses anything. Measured against the unfixed code
 * (`writeItem` overwriting unconditionally, no exclusive-create path): 5 of 8
 * runs red with one round and no barrier; 8 of 8 runs red with the barrier and
 * the 4 rounds configured below. That is a measurement of this machine on this
 * day, not a guarantee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { createItem, type CreateInput, type MutationContext } from '../../src/core/mutate.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const WRITER = fileURLToPath(new URL('../fixtures/same-title-writer.ts', import.meta.url));

const RACERS = 8;
const ROUNDS = 4;
/** How far ahead of spawning to set the rendezvous instant. Must comfortably
 * exceed Node's cold start plus this project's module graph — a barrier that
 * has already elapsed by the time a child reaches it is no barrier at all. */
const BARRIER_LEAD_MS = 1500;

interface RunResult { code: number; out: string; err: string }

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-same-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function writer(cwd: string, round: number, index: number, startAt: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--disable-warning=ExperimentalWarning', WRITER, cwd, String(round), String(index), String(startAt)],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { out += chunk; });
    child.stderr.on('data', (chunk: string) => { err += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, out, err }));
  });
}

/** Read the corpus back from Markdown — not from the index the racers wrote. */
function itemsOnDisk(cwd: string): Item[] {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  const items = store.all();
  store.close();
  return items;
}

/** The id out of `my_context: created <id> (status) at ...`, or out of the
 * duplicate message — either is an id this process claims holds its work. */
function reportedId(message: string): string | null {
  const created = /created (\S+) \(/.exec(message);
  if (created) return created[1];
  const dup = /already captured as (\S+)\./.exec(message);
  return dup ? dup[1] : null;
}

test('concurrent create_item calls with one title and many bodies lose nothing', async () => {
  const cwd = project();
  try {
    for (let round = 0; round < ROUNDS; round++) {
      const startAt = Date.now() + BARRIER_LEAD_MS;
      const results = await Promise.all(
        Array.from({ length: RACERS }, (_unused, i) => writer(cwd, round, i, startAt)),
      );

      for (const [i, result] of results.entries()) {
        assert.equal(result.code, 0, `round ${round} writer ${i} failed: ${result.err}`);
      }

      const title = `A contended lesson ${round}`;
      const contended = itemsOnDisk(cwd).filter((i) => i.title === title);
      const bodies = contended.map((i) => i.body).sort();
      const expected = Array.from({ length: RACERS }, (_u, i) => `body-${round}-${i}`).sort();

      // Every distinct body survives, and no id was minted twice: `rebuild`
      // reports a duplicate id rather than indexing both copies, so a
      // matching count AND a matching body set together rule out both "one
      // write overwrote another" and "two files claim one id".
      assert.deepEqual(bodies, expected, `round ${round}: bodies lost`);
      assert.equal(contended.length, RACERS, `round ${round}: wrong item count`);

      // …and the id each racer was told it got really holds that racer's body.
      const byId = new Map(contended.map((i) => [i.id, i.body]));
      for (const [i, result] of results.entries()) {
        const id = reportedId(result.out);
        assert.ok(id, `round ${round} writer ${i} reported no id: ${JSON.stringify(result.out)}`);
        assert.equal(
          byId.get(id), `body-${round}-${i}`,
          `round ${round} writer ${i} was told ${id}, which holds ${String(byId.get(id))}`,
        );
      }
    }
  } finally {
    removeTree(cwd);
  }
});

/**
 * The same race, made DETERMINISTIC — no processes, no timing, no luck.
 *
 * A losing racer is exactly a caller whose `ctx.store` does not know about an
 * item that is already on disk. Two `MutationContext`s over one root, each
 * with its OWN in-memory store, reproduce that state exactly and repeatably:
 * whatever context A writes, context B's store has never heard of. These pin
 * the behaviour the concurrency test above can only sample — measured, the
 * mutant that drops the advance-to-next-candidate retry killed the
 * concurrent test in only 5 of 8 runs, and kills these every time.
 */
function contexts(): { cwd: string; a: MutationContext; b: MutationContext; close: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stale-'));
  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot;
  assert.ok(root, 'init should have created a project layer');
  const storeA = Store.open(':memory:');
  const storeB = Store.open(':memory:');
  return {
    cwd,
    a: { root, store: storeA, config: ws.config },
    b: { root, store: storeB, config: ws.config },
    close: () => {
      storeA.close();
      storeB.close();
      removeTree(cwd);
    },
  };
}

const CONTENDED: CreateInput = { type: 'lesson', title: 'A contended lesson', body: 'first body' };

test('a caller whose store has not seen the file on disk advances instead of overwriting', () => {
  const f = contexts();
  try {
    const first = createItem(f.a, CONTENDED);
    assert.equal(first.created, true, first.message);

    // B's store is empty, so B allocates the SAME id `first` took and only
    // finds out at the write. It must move to the next id in the family —
    // not overwrite, and not re-consult its own (stale) store, which would
    // just re-derive the same wrong answer.
    const second = createItem(f.b, { ...CONTENDED, body: 'second body' });
    assert.equal(second.created, true, second.message);
    assert.notEqual(second.id, first.id);
    assert.equal(second.id, `${first.id}-2`, 'it must advance in the family sequence, not invent an id');

    const bodies = itemsOnDisk(f.cwd)
      .filter((i) => i.title === CONTENDED.title).map((i) => i.body).sort();
    assert.deepEqual(bodies, ['first body', 'second body']);
  } finally {
    f.close();
  }
});

test('a caller whose store has not seen its OWN content on disk reports a duplicate, not a new item', () => {
  const f = contexts();
  try {
    const first = createItem(f.a, CONTENDED);
    const second = createItem(f.b, CONTENDED);

    assert.equal(second.created, false, second.message);
    assert.equal(second.id, first.id);
    assert.match(second.message, /already captured as/);
    assert.equal(itemsOnDisk(f.cwd).filter((i) => i.title === CONTENDED.title).length, 1);
  } finally {
    f.close();
  }
});

test('the explicit-id path refuses a stale-store collision instead of overwriting it', () => {
  // Ingest revisions pass an explicit id, where there is no "next candidate"
  // to advance to — so the only two legal outcomes are duplicate no-op and
  // the update_item/supersede_item refusal.
  const f = contexts();
  try {
    createItem(f.a, { ...CONTENDED, id: 'LESSON-pinned' });

    const same = createItem(f.b, { ...CONTENDED, id: 'LESSON-pinned' });
    assert.equal(same.created, false, same.message);
    assert.equal(same.id, 'LESSON-pinned');

    assert.throws(
      () => createItem(f.b, { ...CONTENDED, id: 'LESSON-pinned', body: 'different body' }),
      /already exists with different content/,
    );
    const survivors = itemsOnDisk(f.cwd).filter((i) => i.id === 'LESSON-pinned');
    assert.equal(survivors.length, 1);
    assert.equal(survivors[0].body, 'first body', 'the loser must not have overwritten the winner');
  } finally {
    f.close();
  }
});

test('the store row written is the item that actually landed on disk', () => {
  // `ctx.store.upsert` must happen for the id that WON, not the one first
  // guessed — otherwise the index points at an item this process never wrote.
  const f = contexts();
  try {
    const first = createItem(f.a, CONTENDED);
    const second = createItem(f.b, { ...CONTENDED, body: 'second body' });

    const indexed = f.b.store.get(second.id);
    assert.ok(indexed, `${second.id} must be in the writer's own index`);
    assert.equal(indexed.body, 'second body');
    assert.equal(indexed.filePath, second.filePath);
    // …and nothing was indexed under the id it guessed first and lost.
    assert.equal(f.b.store.get(first.id), null, 'the id this caller lost must not be in its index');
  } finally {
    f.close();
  }
});
