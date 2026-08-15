# Scope

`scope` is a list of globs, relative to the repository root, always POSIX —
forward slashes, no drive letter, no leading `./`. Globs are matched against
paths like `src/db/writer.ts`, never `C:\repo\src\db\writer.ts`.

Scope is a **restriction**. An item that declares globs applies only to the
files they match. An item that declares **no scope is not restricted, so it
applies to every file** — it is injected the first time a session touches
anything. You write a scope when you want to narrow an item, and you write
nothing when you don't, which is the shorter thing to type for the common case.

`always: true` is a separate setting and is unaffected by scope: it puts the
item in the pinned tier and injects it at every session start, before any file
is touched.

The cost of leaving scope off is real and bounded rather than hidden: an
unscoped item competes for the `jit` budget on every file operation, and what
does not fit is disclosed as a spill rather than dropped. A corpus with many
large unscoped items will spend that budget on them instead of on the item that
actually named the file — so scope the items that genuinely belong to one part
of the tree.

## Supported syntax

| Pattern | Matches | Does not match |
|---|---|---|
| `src/db/**` | `src/db/writer.ts`, `src/db/a/b.ts` | `src/db`, `src/api/x.ts` |
| `src/*.ts` | `src/a.ts` | `src/x/a.ts` |
| `src/**/test.ts` | `src/test.ts`, `src/a/b/test.ts` | `src/test.tsx` |
| `**/*.sql` | `migrations/001.sql` | `migrations/001.py` |
| `**` | everything | nothing |

`**` is therefore the same thing as writing no scope at all, which is why the
ingest and lesson paths reject it and tell you to omit the field instead.

## Worked examples

| The item says | Scope to write | Why |
|---|---|---|
| "Postgres pool must never exceed 20" | `["src/db/**", "src/api/handlers/**"]` | The pool config *and* every caller that opens a connection |
| "Money is stored as integer cents" | `["src/billing/**", "src/models/**", "migrations/**"]` | Violated wherever money is defined or persisted |
| "React components use function syntax" | `["src/components/**/*.tsx"]` | Narrow by extension, broad by directory |
| "Never hand-edit generated protobuf output" | `["**/*_pb2.py", "**/*.pb.go"]` | The rule follows a file shape, not a directory |
| "Migrations run inside a transaction" | `["migrations/**"]` | One directory owns the concern |
| "Auth tokens are validated server-side" | `["src/api/**", "src/middleware/**"]` | The boundary where a token arrives |
| "Prefer composition over inheritance" | `[]` — none | It is about how you write code anywhere, not about a directory |
| "Always run the linter before committing" | `[]` with `always: true` | Process guidance, and needed before the first file is touched |

## Two ways to get this wrong

**Too broad.** `["src/**"]` for a rule about one subsystem. Every file operation
anywhere then spends budget on it — as does leaving scope off entirely, which is
the same thing spelled shorter. That is the right setting for an item that
really does apply everywhere, and the wrong one for an item that belongs to a
subsystem. If the item must be in context before any file is touched, what you
want is `always: true`: the pinned tier is budgeted once per session rather than
on every tool call.

**Too narrow.** `["src/db/pool.ts"]`. The next refactor renames the file and the
constraint silently stops activating, which is indistinguishable from never
having written it. Scope the directory that owns the concern, not the file that
happens to hold it today.

Rule of thumb: name the directories in which a violation would appear.
