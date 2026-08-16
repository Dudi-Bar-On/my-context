# Mutation testing in this repository

Every change here needs a test that fails without it. The way that is checked is
mutation testing: break the guard, run the test that should notice, put the file
back. **`scripts/mutate.ts` is the way to do it. Do not do it by hand.**

```
npm run mutate -- --file src/core/select.ts --from "seen.has(id)" --to "false" \
  -- node --test test/core/select.test.ts
```

The exit code is the verdict, so it composes:

| Exit | Meaning |
|---|---|
| `0` | **KILLED** — the command failed with the guard broken. This is the result you want. |
| `1` | **SURVIVED** — the command passed with the guard broken. Nothing tests it. |
| `2` | Refused, or the arguments were wrong. **Nothing was mutated.** |
| `3` | Mutated, and the tree could not be put back. Read the message; `--restore` retries. |

## Why it exists

Reverting by hand meant `git checkout -- <file>`, which restores the path from
the index and cannot tell a mutant from an uncommitted fix in the same file.
Seven escapes by this project's own count: three agents lost work that way — one
of them a full pass of README edits, costing a whole task — and twice a probe
was run against this repository's own dogfooded corpus under `.my_context/`.

"Commit before mutating" was in every brief for those seven. It is a refusal
now rather than a rule.

## What it refuses

- **A tree with any tracked change.** Commit first. Untracked files are allowed
  through — nothing here writes to a path it was not given — but an untracked
  *target* is refused, because there would be no committed bytes behind it.
- **Anything under `.my_context/` or `.git/`.** Mutate a temp workspace instead;
  `runCli(['init'], mkdtempSync(...))` is what the whole suite does.
- **A `--from` that is missing, or that appears more than once** without
  `--all`. A probe against text that is not there proves nothing.
- **A mutation with no command**, and a command with no mutation.
- **A run started while an earlier mutation is still recorded in flight.**

## How it restores

The bytes read before mutating are held in memory *and* journalled to
`<git-dir>/mycontext-mutation.json` before a single file is written. The restore
rewrites those bytes and then verifies with `git status` that the named paths
came back clean. `git checkout <HEAD> -- <path>` runs only as a fallback after
that verification has already failed, and only against the paths the run itself
mutated.

`SIGINT`/`SIGTERM`/`SIGHUP` restore before exiting. A kill that skips even those
leaves the journal behind:

```
npm run mutate -- --status     # is anything in flight?
npm run mutate -- --restore    # put it back
```

The next ordinary run refuses to start until that journal is cleared.

## Several surfaces at once

A claim made in more than one place needs every copy broken in the same run, or
the surviving copy keeps the suite green:

```
npm run mutate -- \
  --file README.md      --from "is restored" --to "is not restored" \
  --file docs/README.he.md --from "משוחזר"   --to "לא משוחזר" \
  -- node --test test/docs/
```

`--file` opens a group; `--from`, `--to` and `--all` attach to the group above
them. All files in one run are restored together.

## What it does not do

It does not sandbox the command you pass. A command that writes to your tree
still writes to your tree — the guarantees above cover the files this harness
mutates, and nothing else.
