import { existsSync } from 'node:fs';
import { rebuild } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors } from './context.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext query "SELECT ..." [--json]

Read-only. Only SELECT (or WITH ... SELECT) is accepted, and only one statement.

schema: items(id, type, title, status, always, has_scope, layer, file_path, updated_at, data)
        data holds the full item as JSON — reach into it with json_extract(data, '$.scope').
        updated_at is INDEX WRITE TIME, not a Markdown timestamp: every query rebuilds the
        index first, so updated_at is rewritten to "now" on every row, every run, whether or
        not the underlying Markdown changed. It answers "when did this row last get indexed"
        (always: this invocation), never "when did this item last change" — for that, read
        the Markdown file or its git history.`;

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
 * plainly one read-only statement. For almost everything on the FORBIDDEN
 * list, this is NOT what makes the query read-only — `Store.openReadOnly` is,
 * at the engine layer, because those statements would write to the tables in
 * `dbPath` itself, and the engine refuses that regardless of what gets past
 * this function. A denylist over a full SQL grammar cannot be complete, and
 * this one is explicitly not: it has no entry for `sqlite_dbpage` or
 * `writable_schema`, and `strip` above does not understand backtick or
 * `[bracket]` identifiers. Do not remove the read-only connection on the
 * strength of these checks.
 *
 * `VACUUM INTO '<path>'` is the one statement in FORBIDDEN where that division
 * of labour is backwards: it does not write to `dbPath`, it writes a full
 * database copy to a path the caller names, and `new DatabaseSync(dbPath,
 * { readOnly: true })` does not stop it — verified directly, see
 * `store-readonly.test.ts`. For that statement THIS prefix/keyword check is
 * the only thing standing between the caller and an arbitrary-path write, not
 * a backstop in front of the engine. Do not relax or remove this function on
 * the theory that the read-only connection has every case covered — for this
 * one case it does not.
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

  // Bring the index up to date through a normal writable connection first, so
  // a read-only query never returns stale answers relative to the Markdown as
  // of THIS invocation — that freshness guarantee, not WAL mechanics, is why
  // this ordering must not change. The original version of this comment also
  // claimed "a read-only connection cannot create or recover a WAL, so
  // opening one against a database left with a live -wal file fails or reads
  // stale data" — that claim was tested directly against both a live and an
  // orphaned `-wal` on this engine and is false: the read-only open succeeded
  // both times and returned correct, non-stale data, recovering an orphaned
  // WAL rather than failing on it. Kept here as a correction, not deleted,
  // because the false version was written as a load-bearing "do not reorder"
  // instruction — the real reason not to reorder is the one above (rebuild
  // must happen before the read to guarantee freshness), and closing the
  // writer first still checkpoints the WAL as a matter of course even though
  // this code no longer depends on that being necessary for correctness.
  const writer = Store.open(ws.dbPath);
  const { errors } = rebuild(writer, {
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
      // F2: query did what it was asked (rows returned), so an unrelated
      // corpus load error is a warning, not a failure — see the identical
      // rule applied throughout context.ts's openMutateContext callers. This
      // was previously discarded silently: `rebuild`'s errors were never
      // read, so a corrupt item elsewhere in the corpus made `query` succeed
      // with no signal at all while `list`/`show` reported it. Note this
      // trailing line means `--json` output is only strictly parseable as
      // pure JSON when `errors` is empty (the common case, and the one every
      // existing test exercises) — `Emit` is a single text sink with no
      // separate channel to put diagnostics on, same constraint every other
      // command here has, and reporting the error (per F2) wins over keeping
      // the output machine-parseable in the presence of a real corruption.
      emitLoadErrors(errors, out);
      return 0;
    }

    for (const line of renderTable(rows)) out(line);
    if (rows.length) out('');
    out(`${rows.length} row(s)`);
    emitLoadErrors(errors, out);
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
