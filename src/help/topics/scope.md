# Scope

`scope` is a list of globs, relative to the repository root, always POSIX —
forward slashes, no drive letter, no leading `./`. Globs are matched against
paths like `src/db/writer.ts`, never `C:\repo\src\db\writer.ts`.

An item with **no scope is never injected**. It is indexed and searchable, and
that is all. This is the default and it is deliberate: a corpus where everything
activates everywhere refills the context window as it grows.

## Supported syntax

| Pattern | Matches | Does not match |
|---|---|---|
| `src/db/**` | `src/db/writer.ts`, `src/db/a/b.ts` | `src/db`, `src/api/x.ts` |
| `src/*.ts` | `src/a.ts` | `src/x/a.ts` |
| `src/**/test.ts` | `src/test.ts`, `src/a/b/test.ts` | `src/test.tsx` |
| `**/*.sql` | `migrations/001.sql` | `migrations/001.py` |
| `**` | everything | nothing |

## Worked examples

| The item says | Scope to write | Why |
|---|---|---|
| "Postgres pool must never exceed 20" | `["src/db/**", "src/api/handlers/**"]` | The pool config *and* every caller that opens a connection |
| "Money is stored as integer cents" | `["src/billing/**", "src/models/**", "migrations/**"]` | Violated wherever money is defined or persisted |
| "React components use function syntax" | `["src/components/**/*.tsx"]` | Narrow by extension, broad by directory |
| "Never hand-edit generated protobuf output" | `["**/*_pb2.py", "**/*.pb.go"]` | The rule follows a file shape, not a directory |
| "Migrations run inside a transaction" | `["migrations/**"]` | One directory owns the concern |
| "Auth tokens are validated server-side" | `["src/api/**", "src/middleware/**"]` | The boundary where a token arrives |
| "Prefer composition over inheritance" | `[]` — none | A taste preference is not worth activating on every file |
| "Always run the linter before committing" | `[]` with `always: true` | Process guidance is relevant regardless of path |

## Two ways to get this wrong

**Too broad.** `["**"]`, or `["src/**"]` for a rule about one subsystem. Every
file operation anywhere then spends budget on it. If you are tempted by `**`,
what you want is `always: true` with no scope — that puts the item in the pinned
tier where it is budgeted once per session instead of on every tool call.

**Too narrow.** `["src/db/pool.ts"]`. The next refactor renames the file and the
constraint silently stops activating, which is indistinguishable from never
having written it. Scope the directory that owns the concern, not the file that
happens to hold it today.

Rule of thumb: name the directories in which a violation would appear.
