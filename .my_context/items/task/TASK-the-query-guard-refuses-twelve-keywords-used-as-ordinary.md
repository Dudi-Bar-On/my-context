---
id: TASK-the-query-guard-refuses-twelve-keywords-used-as-ordinary
type: task
title: the query guard refuses twelve keywords used as ordinary identifiers
status: active
severity: soft
always: false
summary: The safety check on typed queries rejects twelve ordinary words used as names, refusing queries that read nothing and write nothing.
summary_of: a2cefa4a46aff523
scope: []
tags:
  - "plan:rulings"
  - "seq:46"
  - "state:done"
  - v2
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 702fe35ab4acf227
plan: rulings
seq: "46"
state: done
---

# the query guard refuses twelve keywords used as ordinary identifiers

Found while fixing plan:rulings seq:45 (the `replace()` false positive), measured against SQLite 3.51.2, and DELIBERATELY LEFT REFUSED rather than half-fixed.

THE MEASUREMENT. SQLite accepts twelve of the guard's nineteen forbidden tokens as ordinary unquoted identifiers - an alias, a CTE name, a table name: `REPLACE, TRUNCATE, VACUUM, PRAGMA, ATTACH, DETACH, REINDEX, ANALYZE, BEGIN, ROLLBACK, SAVEPOINT, RELEASE`. Only seven are hard keywords the engine itself rejects in that position. So this reads nothing, writes nothing, and is refused today:

    mycontext query "WITH analyze AS (SELECT 1 AS n) SELECT * FROM analyze"
    my_context: query is read-only - "ANALYZE" is not allowed.

Verified by hand after the seq 45 fix landed. `analyze` is a plausible CTE name in a corpus tool, so this is reachable rather than theoretical.

WHY IT WAS NOT FIXED WITH THE FIRST ONE, and this reasoning is the point of the item. `replace` was safe to exempt on a LEXICAL test - a trailing `(` means the token is being applied as a function, and no write statement puts a bracket after its leading keyword. Identifier position has no such test. `ANALYZE items` and `FROM analyze` differ only in what a grammar knows about the surrounding clause, so telling them apart needs a real parser. This project ships ZERO runtime dependencies, so that parser would be ours to write and ours to be wrong in - and this function is the sole barrier for `VACUUM INTO '<path>'`, which writes an arbitrary file. A half-parser here makes a hole in the one thing standing in front of that.

IT IS ALREADY PINNED, not merely noted: `test/cli/query-guard-scalar-functions.test.ts` carries it as a KNOWN LIMITATION test with the measurement and the workaround, so the next reader finds the finding instead of rediscovering it. The workaround is double-quoting - `WITH "analyze" AS (...)` - which works because `strip` blanks double-quoted runs before the scan. Confirmed working.

WHY IT WILL COME BACK. DEC-the-ask-screen-accepts-typed-sql-reversing-shown-never-typed rules that the Ask screen accepts typed SQL and must REUSE this guard rather than grow a second implementation. Every false positive here becomes a refusal a reader meets in a browser, with no shell to try the workaround in and no comment to read. That screen is plan:ui3 seq 15.

WHAT WOULD ACTUALLY SETTLE IT, in the order a reader should consider them: (1) accept the limitation and make the REFUSAL teach the workaround, which is cheap and honest and may be the whole answer; (2) narrow the scan to statement-start positions after a clause boundary, which is a parser by another name; (3) stop scanning text at all and rely on the engine - `Store.openReadOnly` plus an authorizer callback - which is the only approach that cannot be fooled by spelling, and is a real design change with its own risks. Option 1 is the recommendation until somebody needs more.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND IT IS NOW A BLOCKER ON A FEATURE, which it was not when it was filed. Raise it accordingly.

DEC-the-ask-screen-accepts-typed-sql rests its entire safety argument on reusing this guard: "mycontext query already accepts arbitrary SQL from a human and defends it -- that guard is the one to reuse; the UI must not grow a second one". IF THE GUARD IS WRONG, REUSING IT SHIPS THE WRONGNESS TO A BROWSER, where a reader has less recourse than a terminal user who can rephrase.

THE MEASUREMENT IS SOLID and was made against SQLite 3.51.2: twelve of the nineteen forbidden tokens are accepted by SQLite as ordinary unquoted identifiers -- REPLACE, TRUNCATE, VACUUM, PRAGMA, ATTACH, DETACH, REINDEX, ANALYZE, BEGIN, ROLLBACK, SAVEPOINT, RELEASE. Only seven are hard keywords. So a statement that reads nothing and writes nothing is refused.

THREE OPEN TASKS ARE ONE FEATURE and the order is 46, then plan:api seq:6, then plan:ui3 seq:15. This one first.
