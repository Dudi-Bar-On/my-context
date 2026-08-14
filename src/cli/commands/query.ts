import { existsSync } from 'node:fs';
import { rebuild } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { Workspace } from '../../core/workspace.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext query "SELECT ..." [--json]

Read-only. Only SELECT (or WITH ... SELECT) is accepted, and only one statement.

schema: items(id, type, title, status, always, layer, file_path, updated_at, data)
        data holds the full item as JSON — reach into it with json_extract(data, '$.scope').`;

const FORBIDDEN = [
  'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'VACUUM', 'PRAGMA', 'ATTACH', 'DETACH', 'REINDEX', 'ANALYZE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
];

/**
 * Remove comments and `'…'`/`"…"` literals so a keyword inside one is not read
 * as a keyword. Backtick and `[bracket]` identifiers — both legal SQLite — are
 * NOT handled, which is one of the reasons this function is a UX guard rather
 * than the security boundary. That boundary is `Store.openReadOnly`.
 */
function strip(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * Refuse, with a message that says what to do instead, anything that is not
 * plainly one read-only statement. This is NOT what makes the query read-only —
 * `Store.openReadOnly` is, at the engine layer. A denylist over a full SQL
 * grammar cannot be complete, and this one is explicitly not: it has no entry
 * for `sqlite_dbpage`, `writable_schema` or `RETURNING`, and `strip` above does
 * not understand backtick or `[bracket]` identifiers. Do not remove the
 * read-only connection on the strength of these checks.
 *
 * Order matters to the messages: the empty check, then the one-statement check,
 * then the prefix check, then the keyword scan. `BEGIN; DELETE …` therefore
 * reports "pass exactly one statement", not the read-only message — the tests
 * assert each error where it is actually produced.
 */
export function assertSelectOnly(sql: string): void {
  const bare = strip(sql).trim().replace(/;\s*$/, '');

  if (bare === '') {
    throw new Error('my_context: the query is empty. Pass a SELECT statement.');
  }
  if (bare.includes(';')) {
    throw new Error('my_context: pass exactly one statement. `;` may only appear at the very end.');
  }
  if (!/^\s*(select|with)\b/i.test(bare)) {
    throw new Error(
      `my_context: query is read-only — only SELECT (or WITH … SELECT) is accepted. ` +
      `Yours starts with "${bare.split(/\s+/)[0]}". Use the CLI commands to change items.`,
    );
  }

  const upper = bare.toUpperCase();
  for (const keyword of FORBIDDEN) {
    if (new RegExp(`\\b${keyword}\\b`).test(upper)) {
      throw new Error(
        `my_context: query is read-only — "${keyword}" is not allowed. ` +
        `Use the CLI commands to change items; the index is rebuilt from Markdown anyway.`,
      );
    }
  }
}

function renderTable(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];

  const columns = Object.keys(rows[0]);
  const cells = rows.map((row) => columns.map((c) => (row[c] === null ? 'NULL' : String(row[c]))));
  const widths = columns.map((c, i) =>
    Math.max(c.length, ...cells.map((row) => row[i].length)));

  const pad = (values: string[]): string =>
    values.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();

  return [pad(columns), pad(widths.map((w) => '-'.repeat(w))), ...cells.map(pad)];
}

function cmdQuery(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const sql = positionals(args, []).join(' ');
  if (!sql.trim()) { out(USAGE); return 1; }

  try {
    assertSelectOnly(sql);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Bring the index up to date through a normal writable connection first, so a
  // read-only query never returns stale answers — and, just as load-bearing,
  // so that CLOSING it checkpoints and removes the `-wal`/`-shm` siblings. A
  // read-only connection cannot create or recover a WAL, so the open below
  // depends on this one having been opened and closed first. Do not reorder
  // them, and do not drop the rebuild "because the query is read-only anyway".
  const writer = Store.open(ws.dbPath);
  rebuild(writer, {
    project: ws.projectRoot,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  }, ws.config);
  writer.close();

  let store: Store | null = null;
  try {
    store = Store.openReadOnly(ws.dbPath);
    const rows = store.raw(sql);

    if (hasFlag(args, 'json')) {
      out(JSON.stringify(rows, null, 2));
      return 0;
    }

    for (const line of renderTable(rows)) out(line);
    if (rows.length) out('');
    out(`${rows.length} row(s)`);
    return 0;
  } catch (err) {
    out(`my_context: query failed — ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    try { store?.close(); } catch { /* already closed */ }
  }
}

registerCommand({
  name: 'query',
  usage: 'query "SELECT ..." [--json]',
  summary: 'read-only SQL over the index',
  run: cmdQuery,
});
