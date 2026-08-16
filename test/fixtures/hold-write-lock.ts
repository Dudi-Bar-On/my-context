import { DatabaseSync } from 'node:sqlite';

/**
 * Holds SQLite's write lock on an existing index database until killed (or
 * until a generous deadline, so a test that dies before killing it cannot
 * leave a locker running forever). For the hook-contention tests: the parent
 * waits for the "held" line, runs the hook path against the same file, and
 * measures how long the hook takes to fail open.
 *
 * `busy_timeout = 0` so THIS process never waits on anyone — it either takes
 * the lock immediately or exits nonzero, and the parent's read of "held" is
 * therefore a true statement that the lock is taken, not a hope.
 */
const [dbPath, holdMsRaw] = process.argv.slice(2);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 0;');
db.exec('BEGIN IMMEDIATE');
process.stdout.write('held\n');

const holdMs = Number(holdMsRaw ?? 60_000);
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
db.exec('ROLLBACK');
db.close();
