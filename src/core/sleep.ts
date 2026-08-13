/**
 * Block the current thread without a dependency and without a busy loop.
 *
 * Shared by three retry loops: `mutate.ts` (SQLite busy/locked retry),
 * `rebuild.ts` (Windows rename-race retry) and `store.ts`
 * (`openWithBusyRetry`, for the WAL-transition window on a database's
 * first-ever open). Its own module so they all back off the same way without
 * importing each other — `mutate.ts` already imports `writeItem` from
 * `rebuild.ts`, so `rebuild.ts` importing back from `mutate.ts` would be
 * circular.
 */
export function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
