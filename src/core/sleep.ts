/**
 * Block the current thread without a dependency and without a busy loop.
 *
 * Shared by `mutate.ts` (SQLite busy/locked retry) and `rebuild.ts` (Windows
 * rename-race retry) so both retry loops back off the same way without
 * either module importing the other — `mutate.ts` already imports
 * `writeItem` from `rebuild.ts`, so `rebuild.ts` importing back from
 * `mutate.ts` would be circular.
 */
export function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
