import { openRebuiltStore } from '../../core/open-store.ts';
import { Store } from '../../core/store.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, toCliMessage } from './context.ts';
import { emitJson, table } from './format.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * The row cap. A `query` with a plausible missing-join typo over a 300-item
 * corpus ran for ~50s and then killed the process with `FATAL ERROR: Reached
 * heap limit` and a full V8 native stack trace — in a command whose own tests
 * assert that a SQL error is reported WITHOUT a stack trace. `Store.raw` calls
 * `.all()`, which materializes the entire result set in memory before this
 * code sees a single row, so nothing downstream of it can bound anything.
 *
 * 1000 is a screenful-of-screenfuls, not a measured limit: it is meant to be
 * larger than any answer a human reads off a terminal and far smaller than a
 * cartesian product. `--limit` raises it, with no ceiling of its own — an
 * explicit large `--limit` is the caller's informed choice, where the old
 * unbounded default was nobody's.
 */
const DEFAULT_ROW_CAP = 1000;

/** Every flag `mycontext query` accepts. Anything else is refused, not absorbed. */
const QUERY_VALUE_FLAGS = ['limit'];
const QUERY_FLAGS = ['json', ...QUERY_VALUE_FLAGS];

const USAGE = `usage: mycontext query [--json] [--limit <n>] "SELECT ..."
       mycontext query [--json] [--limit <n>] -- "-- a query that starts with a SQL comment
                                                  SELECT ..."

Read-only. Only SELECT (or WITH ... SELECT) is accepted, and only one statement.

flags:  --json        one JSON document: { rows, rowCount, truncated, limit, loadErrors }
        --limit <n>   raise (or lower) the ${DEFAULT_ROW_CAP}-row cap. The cap is always
                      reported when it fires; it never truncates silently.
        --            end of flags: everything after it is SQL, so a statement that
                      begins with a "--" comment is not read as a flag.

The detail levels (--full/--short/--summary) are NOT accepted here and never were.
A SQL result set has no levels of detail to choose between: its columns are the ones
your own SELECT names. Passing one is an error rather than a no-op, so a script that
passes one learns that it is not doing what it looks like it is doing.

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
 * FORBIDDEN entries that are ALSO the name of a SQLite function, so the token
 * has a read-only meaning as well as a write one.
 *
 * `REPLACE` is the only one, and that is measured rather than remembered: this
 * engine (SQLite 3.51.2, node:sqlite) exposes 166 functions, and `replace` is
 * the single one of them whose name the keyword scan's `\bWORD\b` regex hits.
 * `json_replace`, `jsonb_replace`, `last_insert_rowid` and the `pragma_*`
 * table-valued functions all embed a guarded word but are NOT hit, because `_`
 * is a word character and so blocks the boundary — each verified through
 * `mycontext query` itself, not by reading the regex. Re-run the census
 * (`SELECT name FROM pragma_function_list`) before adding to this set.
 *
 * The exemption below is "followed by `(`", and it is safe for the whole
 * FORBIDDEN list rather than only for this member: no write statement in SQLite
 * puts `(` directly after its LEADING keyword. Every one of them takes another
 * bare word first — `REPLACE INTO`, `INSERT INTO`, `INSERT OR REPLACE INTO`,
 * `DELETE FROM`, `UPDATE <table>`, `DROP TABLE`, `VACUUM INTO`, `PRAGMA <name>`,
 * `ATTACH DATABASE`. `VACUUM` in particular is not exempted at all, which
 * matters because `VACUUM INTO '<path>'` is the one statement where this
 * function, not the read-only connection, is the actual write barrier.
 */
const ALSO_A_FUNCTION_NAME = new Set(['REPLACE']);

/**
 * The scan pattern for one FORBIDDEN keyword.
 *
 * For a keyword that also names a function, a trailing `(` means the token is
 * being APPLIED rather than starting a statement, so it is not a write:
 * `SELECT replace(title,'a','b') FROM items` writes nothing, and refusing it
 * (which this guard did) is a false positive a reader has to work around with
 * `substr`. `\s*` is part of the exemption because SQLite accepts whitespace
 * between a function name and its argument list, and `strip` above turns a
 * comment in that gap into a space — without it the false positive would only
 * move rather than go.
 *
 * This is a RELAXATION of a security-relevant guard, so it is deliberately the
 * narrowest shape that fixes the defect: `REPLACE` anywhere else — including
 * `REPLACE INTO` on the next line, and `INSERT OR REPLACE INTO` — is still
 * refused. See `test/cli/query-guard-scalar-functions.test.ts`, which pins the
 * write forms next to the reason the exemption exists.
 */
function forbiddenPattern(keyword: string): RegExp {
  const boundary = `\\b${keyword}\\b`;
  return new RegExp(ALSO_A_FUNCTION_NAME.has(keyword) ? `${boundary}(?!\\s*\\()` : boundary);
}

/**
 * Remove comments and `'…'`/`"…"` literals so a keyword inside one is not read
 * as a keyword. Backtick and `[bracket]` identifiers — both legal SQLite — are
 * NOT handled, so this function cannot be relied on to see every keyword in a
 * statement.
 *
 * For writes to the tables in `dbPath` itself, that incompleteness is covered:
 * `Store.openReadOnly` refuses them at the engine layer whatever gets past
 * here. It is NOT covered for `VACUUM INTO`, which writes a full copy of the
 * database to a path the caller names and therefore never writes to `dbPath`
 * at all. Re-verified against a scratch copy of this branch's own
 * `.my_context/.index.db` while writing this comment: on a connection opened
 * `{ readOnly: true }`, `DELETE FROM items` was refused with "attempt to write
 * a readonly database", while `VACUUM INTO '<tempdir>/exfiltrated.db'`
 * SUCCEEDED and produced a 126,976-byte database holding all 39 items.
 * (`ATTACH` was refused on this engine — "unable to open database".)
 * `assertSelectOnly` below is the only barrier for that one statement, so
 * a gap in this function is a gap in that barrier. See `assertSelectOnly`'s
 * own comment, which this now agrees with rather than contradicts.
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
 *
 * The keyword scan has ONE exemption, and it is narrow on purpose: see
 * `forbiddenPattern` and `ALSO_A_FUNCTION_NAME` above. It exists because this
 * guard is not only the CLI's — `DEC-the-ask-screen-accepts-typed-sql-reversing-
 * shown-never-typed` rules that the web Ask screen will reuse THIS function
 * rather than grow a second one, so a false positive here is a refusal a reader
 * meets in a browser, where there is no `substr` workaround to discover.
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
    if (forbiddenPattern(keyword).test(upper)) {
      throw new Error(
        `my_context: query is read-only — "${keyword}" is not allowed. ` +
        `Use the CLI commands to change items; the index is rebuilt from Markdown anyway.`,
      );
    }
  }
}

/**
 * Delegates the alignment to the shared `table` helper (format.ts) rather
 * than keeping a second copy of it: this function was the only report in the
 * CLI that already printed headers, and `table` is that logic promoted to the
 * one place every other report now reads it from. Only the column NAMES are
 * query-specific — they come from the result set, not from a fixed list.
 */
function renderTable(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  return table(columns, rows.map((row) => columns.map((c) => (row[c] === null ? 'NULL' : String(row[c])))));
}

/**
 * `query`'s own argument parser, rather than `positionals(args, [])`, for two
 * reasons that the shared helper cannot serve at once:
 *
 * 1. UNKNOWN FLAGS ARE REFUSED. `positionals` drops every `--token` it does
 *    not recognise, so `mycontext query --full --summary --bogusflag "SELECT
 *    1"` ran happily and ignored all three — `--summary` in particular reads
 *    like it did something. Every other surface in this CLI already refuses
 *    malformed flags (`detailLevel` throws on two levels at once, `boolFlag`
 *    throws on `--json=maybe`, `mycontext add` refuses an unknown flag by
 *    name); `query` was the hole.
 *
 * 2. SQL IS NOT ARGV. A statement that legitimately begins with a `--` line
 *    comment is a single argv token starting with `--`, so `positionals`
 *    dropped it and the user got the usage banner as if they had passed no
 *    SQL at all. `--` as an end-of-flags separator is the conventional fix and
 *    the one taken here: everything after it is SQL verbatim, comments and
 *    leading dashes included. The two changes would otherwise fight — refusing
 *    unknown flags would turn that silent drop into a refusal of a perfectly
 *    valid query — so the refusal message names `--` as the way through.
 *
 * Throws on anything malformed; `cmdQuery` turns that into one line and exit 1.
 */
export function parseQueryArgs(args: string[]): { sql: string; json: boolean; limit: number } {
  const sqlParts: string[] = [];
  const flags: string[] = [];
  let sqlOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (sqlOnly) { sqlParts.push(arg); continue; }
    if (arg === '--') { sqlOnly = true; continue; }
    if (!arg.startsWith('--')) { sqlParts.push(arg); continue; }

    const name = arg.slice(2).split('=')[0];
    if (!QUERY_FLAGS.includes(name)) {
      throw new Error(
        `my_context: unknown flag "${arg.split('=')[0]}" for \`query\`. It accepts ` +
        `${QUERY_FLAGS.map((f) => `--${f}`).join(' and ')} only — the detail levels ` +
        `(--full/--short/--summary) do not apply to a SQL result set, whose columns come from ` +
        `your own SELECT. If this is your SQL rather than a flag (a statement beginning with a ` +
        `"--" comment), put it after a "--" separator: mycontext query -- "<your SQL>".`,
      );
    }
    flags.push(arg);
    // A value flag spelled `--limit 500` consumes the next token; `--limit=500`
    // carries its own. Consuming it here (rather than letting it fall through)
    // is what keeps `500` out of the SQL.
    if (QUERY_VALUE_FLAGS.includes(name) && !arg.includes('=')) {
      const value = args[i + 1];
      if (value === undefined) throw new Error(`my_context: --${name} needs a value, e.g. --${name} 5000.`);
      flags.push(value);
      i++;
    }
  }

  const rawLimit = flag(flags, 'limit');
  let limit = DEFAULT_ROW_CAP;
  if (rawLimit !== null) {
    // Rejected rather than clamped: `--limit 0` and `--limit -1` are both
    // spellings someone reaches for meaning "no limit", and silently reading
    // either as "the default" or "one row" is the silent-wrongness this
    // project keeps finding. There is no "unlimited" spelling on purpose —
    // unbounded is what produced the heap-limit crash.
    if (!/^\d+$/.test(rawLimit.trim()) || Number(rawLimit) < 1) {
      throw new Error(
        `my_context: --limit takes a whole number of rows, 1 or more (got ${JSON.stringify(rawLimit)}). ` +
        `There is no unlimited setting: an unbounded result set is what this cap exists to stop.`,
      );
    }
    limit = Number(rawLimit);
  }

  return { sql: sqlParts.join(' '), json: hasFlag(flags, 'json'), limit };
}

/**
 * Bound the result set by WRAPPING the caller's statement in
 * `SELECT * FROM (…) LIMIT n`, rather than by bounding the row iteration.
 *
 * Bounding the iteration would be the purer fix — it does not touch the SQL at
 * all — but it needs `DatabaseSync.prepare().iterate()`, and the only path to
 * the connection here is `Store.raw`, which is `.all()`: by the time this
 * module holds a value, the whole result set is already materialized. Wrapping
 * moves the bound into the engine, which stops STEPPING at the limit — a 3-way
 * cartesian product over this repo's own 39-item index (59,319 rows) returned
 * 10 rows in 0ms through the wrap.
 *
 * The caller's own `LIMIT` is preserved, not overridden: it applies inside the
 * subquery, so `SELECT id FROM items LIMIT 2` still yields exactly 2 rows.
 * Verified against this repo's index, one case at a time: ORDER BY (including
 * DESC), GROUP BY/HAVING, CTEs (`WITH … SELECT`), column aliases, `SELECT *`,
 * bare expressions (`COUNT(*)`), trailing line and block comments, a `)`
 * inside a string literal, and error messages ("no such column: nope" comes
 * back identical) are all unchanged by the wrap.
 *
 * ONE observable difference, recorded rather than glossed: with duplicate
 * output column names (`SELECT a.id, b.id FROM items a, items b`) the bare
 * form returns row objects with a single `id` key — node:sqlite collapses the
 * second column into the first — while the wrapped form returns `id` and
 * `id:1`. The wrap therefore surfaces a column the bare form silently dropped.
 * Alias the columns if the exact old shape matters.
 *
 * The trailing `;` is stripped and the `)` is placed on its own line: a
 * statement ending in a line comment would otherwise swallow the `)`.
 */
function withRowCap(sql: string, cap: number): string {
  return `SELECT * FROM (\n${sql.trim().replace(/;\s*$/, '')}\n) LIMIT ${cap}`;
}

function cmdQuery(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  let sql: string;
  let json: boolean;
  let limit: number;
  try {
    ({ sql, json, limit } = parseQueryArgs(args));
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

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
  const { store: writer, errors } = openRebuiltStore(ws);
  writer.close();

  let store: Store | null = null;
  try {
    store = Store.openReadOnly(ws.dbPath);
    // One row more than the cap is fetched, and that extra row is the whole
    // truncation signal: it is the difference between "there were exactly
    // `limit` rows" and "there were more and you are not seeing them". It is
    // dropped before anything is printed.
    const fetched = store.raw(withRowCap(sql, limit + 1));
    const truncated = fetched.length > limit;
    const rows = truncated ? fetched.slice(0, limit) : fetched;
    const capNotice =
      `my_context: this result was CAPPED at ${limit} row(s) and more rows matched — what you ` +
      `see is not the whole answer. Re-run with \`--limit ${limit * 10}\` (or higher) to widen ` +
      `the cap, or narrow the query.`;

    if (json) {
      // A DOCUMENT, not a bare array of rows. Two things have to travel
      // alongside the rows and neither has anywhere to live in an array:
      // `truncated`, without which a capped result is a silently short answer
      // to a machine — the exact failure this cap exists to prevent — and the
      // corpus load errors. Those errors used to be appended as a trailing
      // text line AFTER the JSON, which made the output unparseable by
      // `JSON.parse` in precisely the situation a consumer most needs to
      // parse it. Carrying both inside the document does what `status`,
      // `list`, `review list` and `doctor` already do (F2 reporting without
      // giving up machine-readability), so `query --json` is no longer the
      // one surface where the two goals were traded off against each other.
      emitJson(out, {
        rows,
        rowCount: rows.length,
        truncated,
        limit,
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return 0;
    }

    for (const line of renderTable(rows)) out(line);
    if (rows.length) out('');
    out(truncated ? `${rows.length} row(s) shown — capped, there are more` : `${rows.length} row(s)`);
    if (truncated) out(capNotice);
    // F2: query did what it was asked (rows returned), so an unrelated
    // corpus load error is a warning, not a failure — see the identical
    // rule applied throughout context.ts's openMutateContext callers. This
    // was previously discarded silently: `rebuild`'s errors were never
    // read, so a corrupt item elsewhere in the corpus made `query` succeed
    // with no signal at all while `list`/`show` reported it.
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
  usage: 'query "SELECT ..." [--json] [--limit <n>]',
  summary: `read-only SQL over the index (capped at ${DEFAULT_ROW_CAP} rows)`,
  run: cmdQuery,
});
