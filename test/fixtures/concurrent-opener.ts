import { Store } from '../../src/core/store.ts';

/**
 * One first-opener of a brand-new index database, for
 * `test/core/concurrency.test.ts`. Separate processes, not threads: the race
 * `Store.tryOpen`'s `BEGIN IMMEDIATE` closes is between two OS processes each
 * reading `schema_version`, seeing no row, and each running its own
 * `DROP TABLE items` + `INSERT INTO schema_version`.
 *
 * `startAt` is a wall-clock barrier. Spawning N children takes tens of
 * milliseconds each on Windows, which is long enough that they would
 * otherwise arrive one at a time and never contend at all — the window this
 * exercises is a few milliseconds wide.
 */
const [dbPath, startAtRaw] = process.argv.slice(2);

const wait = Number(startAtRaw) - Date.now();
if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);

const store = Store.open(dbPath);
// Touch `items` as well: a process whose table was dropped out from under it
// by a racing opener fails here with `no such table: items`, which is not a
// lock error and so gets no bounded retry.
store.all();
store.close();
