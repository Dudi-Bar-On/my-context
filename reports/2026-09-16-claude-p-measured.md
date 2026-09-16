# `claude -p` measured: the three numbers, and the one that changes the shape

**Lane AG · 2026-09-16 · Phase 1 of `TASK-semantic-search-asked-of-the-model-the-user-already-has-and`
(`semantic/5`).** Measurement only. Nothing was built. The item stays open.

Host: Windows 11, `claude` 2.1.272 at `C:\Users\UserC\.local\bin\claude.exe`, `apiKeySource: "none"`
(OAuth subscription). 27 real `claude -p` invocations, **$0.4717 total**. Every figure below is read
out of a `--output-format json` `result` envelope or a before/after file stat. None is estimated.

---

## 1. RECURSION — it is real, it is reproducible, and it is worse than "it loads the hooks"

### What a naive `claude -p` child actually did

Three calls, no flags beyond `--model`, from `cwd = D:\Users\UserC\source\repos\my-context`.
Before and after: file sizes, mtimes, SQLite row counts.

| watched thing | before | after 3 calls | delta |
|---|---|---|---|
| `~/.claude/projects/D--Users-UserC-source-repos-my-context/*.jsonl` | 13 files | 16 files | **+3 transcripts, ~496 KB each** |
| `.my_context/.index.db` · `conversations` | 13 | 16 | **+3** |
| `.my_context/.index.db` · `conversation_prose` | 11,159 | 11,167 | **+8** |
| `.my_context/.index.db` · `prose_sources` | 466 | 469 | **+3** |
| `.my_context/state/*` | 663 files | 669 files | **+6** (`<sid>.seen.jsonl` + `<sid>.handover-ask.json` per call) |
| `.my_context/.anchors.jsonl` | 1,041 lines / 353,377 B | 1,041 lines / 353,377 B | **content unchanged — but mtime moved on every call** |
| `.my_context/.index.db` · `anchors` | 1,041 | 1,041 | 0 |

In plain words: **a search is a new session, and the new session files itself into the thing you
were searching.** The child loaded this plugin, received the corpus through `SessionStart`
(`additionalContext` is present in its own transcript), and ran its own `Stop` hook — which did
exactly what `src/hooks/stop.ts` says it does: `rebuildConversations`, `reconcileAnchors`,
`markAnchorsOnTurn`. The conversation it indexed was itself.

**The loop is not hypothetical.** Search for "cache eviction"; the query text is now a `prompt` row
in `conversation_prose`. Search again tomorrow and the deterministic search returns your own
question as a hit. Ten searches a day is 3,650 junk conversations a year and roughly 1.8 GB of
transcript.

### Three things I did not expect, and each is worth more than the table

**(a) The child connects every MCP server the user has.** Its `system/init` listed
`chrome-devtools`, `playwright`, `MCP_DOCKER`, `context7`, `github`, `mycontext`, and three
claude.ai connectors (Gmail, Drive, Calendar) — five of them `"status":"connected"`. A search box
that spawns `claude -p` naively starts a Chrome DevTools server and a Playwright server per query.
The memory note about three Playwright lanes holding 13.8 GB exists for a reason; this would spawn
one per search.

**(b) A one-line query writes a half-megabyte transcript.** ~496 KB, because the corpus injection
is written into the transcript alongside the twelve-word prompt.

**(c) Every child rewrites `.anchors.jsonl`.** The content did not change — the mtime did, on every
call, because `reconcileAnchors` runs on the child's `Stop`. The most recent commit on this branch
is *"fourteen tests wrote to one anchor store at the same time, and a different one failed every
run."* A search that spawns children which each reconcile the anchor store re-creates that exact
defect at runtime, in production, against the owner's real store.

### Cost of the recursion, in tokens and seconds

| | input tokens per query | wall clock | cost |
|---|---|---|---|
| naive child (opus-5 1M, inherited from caller) | **43,798** (28,616 cache-create + 15,180 cache-read) | 13.2 s | **$0.296** |
| naive child (`--model claude-haiku-4-5`) | 37,408 / 37,407 | 9.7 s / 8.8 s | $0.044 / $0.036 |
| neutralised child (below) | **465** | 8.2 s median | $0.0037 mean |

**The plugin's own injection is about 80× the tokens of the question being asked.** A 465-token
query becomes a 37,400-token request, because the child is handed the corpus, the user's global
`CLAUDE.md`, the auto-memory file and roughly 130 skill and tool definitions before it is handed
the question.

### How to neutralise it — a flag already exists, and it is `--safe-mode`

`claude --safe-mode` (build 2.1.272): *"Start with all customizations (CLAUDE.md, skills, plugins,
hooks, MCP servers, custom commands and agents, output styles, workflows, custom themes,
keybindings, and more) disabled … **Auth, model selection, built-in tools, and permissions work
normally.** Sets `CLAUDE_CODE_SAFE_MODE=1`."*

Measured over 16 calls with `--safe-mode --no-session-persistence --model claude-haiku-4-5 --tools ""`:

- `.anchors.jsonl` — **not touched** (mtime unchanged)
- `.index.db` row counts — **unchanged on every table**
- `~/.claude/projects/...` — **no new transcript**
- `.my_context/state/` — **no new files**

Nothing. The recursion closes completely, with flags on the host and no change to this plugin.

**`--bare` is the trap, not the answer.** It also skips hooks, but its own help says *"Anthropic
auth is strictly `ANTHROPIC_API_KEY` or apiKeyHelper via `--settings` (OAuth and keychain are never
read)."* The entire premise of the ruling is that the user is already authenticated and this project
holds no key. `--bare` breaks precisely that. `--safe-mode` keeps auth and kills the rest.

The four flags that matter, and why each is load-bearing:

| flag | what it buys | measured |
|---|---|---|
| `--safe-mode` | no plugin, no hooks, no MCP, no CLAUDE.md, no auto-memory; **auth kept** | 37,408 → 465 input tokens; zero corpus writes |
| `--no-session-persistence` | no transcript file at all (`--print` only) | 0 new files under `~/.claude/projects/` |
| `--model claude-haiku-4-5` | the child does not inherit the caller's opus | $0.296 → $0.0037 |
| `--tools ""` | no tool definitions in the prompt, and the child cannot act | part of the 465 |

`--safe-mode` was not tested in isolation from `--no-session-persistence`; both were applied
together and no transcript appeared. That decomposition is one call and is left to Phase 2.

---

## 2. LATENCY — the guess was 1–3 s. The median is 8.2 s, and it never went under 2.4 s.

Wall clock measured by the caller, which is what a reader feels. Neutralised shape,
`claude-haiku-4-5`, realistic expansion prompts (eight alternative phrasings of a real search
phrase), n = 16:

```
4431  4858  5032  5638  5962  6972  7928  8058 | 8371  8917  9785  9824  10602  10653  10655  12427   (ms)
```

- **median 8,215 ms**; p25 ≈ 5.8 s; p75 ≈ 9.9 s; min 4.4 s; max 12.4 s
- floor, for a 40-token "reply with ok" (n = 6): **2,407–3,567 ms**, median 2,939 ms
- naive, plugin loaded (n = 3): 8,845 / 9,723 / 13,228 ms
- process overhead alone (`wall − duration_ms`): **1.5–1.9 s** in some runs, **4.4–4.6 s** in
  others. `claude --version` is 60 ms, so the overhead is session setup — auth, config, model
  resolution — not binary boot.

**A surprise I am flagging rather than smoothing away:** that overhead is bimodal and I did not
explain it. It is not per-call noise — each loop was internally consistent (five consecutive gaps
of 4.46–4.55 s in one loop; five of 1.53–1.94 s in another, same prompt, same flags). Something
about the CLI's startup path has a fast mode and a slow mode roughly 3 s apart, and which one you
get is not under the caller's control as far as I could tell. If Phase 2 can pin the fast path, the
median moves from 8.2 s toward 5 s.

"Cold vs warm" turned out to be the wrong axis. The dominant variable is **output length**, because
Haiku 4.5 thinks: of 350–752 output tokens per call, **311–698 were thinking tokens**. `--effort low`
trimmed but did not remove it (352, 336, 311 across three calls).

**What this decides about the surface.** The item's own rule of thumb was "400 ms is a tier in a
result list, 4 s is a button the reader presses on purpose." It is 8 s. **It is a button, and it is
a button that needs visible progress**, because eight seconds of nothing reads as broken. It cannot
be a tier that quietly appears beneath the deterministic results: those return in 4.3 ms (D77) and
the reader will have finished reading and moved on twice over.

---

## 3. TOKENS PER QUERY

Read from the `usage` block of each `result` message — not estimated from character counts.

**Query expansion, neutralised** (`--safe-mode --tools "" --model claude-haiku-4-5`):

| | value |
|---|---|
| input tokens | 462–469, **median 465** (424 for a trivial one-line prompt) |
| output tokens | 312–752, **median 428** — of which **~90% is thinking** |
| cache creation / read | **0 and 0** — nothing is cacheable; every call pays full input |
| cost per query | $0.0022–$0.0052, **mean $0.0037** (n = 16) |

**Reranking, measured rather than guessed.** 20 real candidate spans pulled from
`conversation_prose` (600 chars each), model asked to order them, n = 2:

| | value |
|---|---|
| input tokens | **4,034** (8.7× expansion) |
| output tokens | 819 / 1,128 (810 / 1,115 of it thinking) |
| wall clock | **12.5 s / 15.6 s** |
| cost per query | **$0.0127 / $0.0142** (3.7× expansion) |

**So "not expensive" now has a figure beside it: about a third of a cent per search with expansion,
about a cent and a third with reranking, on Haiku.** On the caller's inherited Opus it was **$0.296
for a single 52-token answer**, and that is the number the owner should see, because it is what a
naive implementation ships.

**A figure nobody asked for that he should see anyway.** Every call returns a `rate_limit_event`.
His seven-day window read **0.95 utilisation when I started and 0.96 when I finished** — 27
measurement calls moved it about a point. This is a subscription quota, not a bill. Semantic search
does not cost him dollars; it costs him the weekly allowance he is already at the top of.

---

## PRIVACY — both ways it could be false, confirmed. One of them IS false in the naive shape.

### Q1. Does `claude -p` run under the same account and config as the session that wrote the transcript? — YES by default, and `CLAUDE_CONFIG_DIR` is the single thing that decides it.

The child reported `apiKeySource: "none"` (OAuth, not a key), resolved `~/.claude`, loaded the
user-level `enabledPlugins`, and wrote its transcript into `~/.claude/projects/` beside the
transcripts being searched. Same config dir, therefore same credentials, therefore same account. No
third party is introduced. **The rule's argument holds.**

It holds *because the environment is inherited*, and that is a thinner thread than it looks:

- **`CLAUDE_CONFIG_DIR` selects the credentials AND the transcript archive with one value.** This
  project already repoints it — `test/cli/anchors.test.ts`, `test/cli/anchor-backfill.test.ts`,
  `test/cli/conversation-name.test.ts`, `test/cli/conversation-persist.test.ts` all set it to a
  throwaway home, and `src/ui/read-model-conversation-document.ts:811` says the e2e fixtures do too.
- **Measured:** with `CLAUDE_CONFIG_DIR` pointed at an empty directory, `claude -p` exits 1 in
  1.2 s with `is_error: true` and `result: "Not logged in · Please run /login"`,
  `total_cost_usd: 0`. It does **not** fall back to the real credentials. It fails closed. Good.
- **The live hazard is the UI server.** It is a long-lived process (PID 47368 on port 58888, started
  10:55). A search issued from the UI would spawn `claude -p` with *that process's* environment, not
  the session's. Whatever `CLAUDE_CONFIG_DIR` held when the server was started is what the search
  authenticates as. Phase 2 must spawn with an explicitly chosen config dir, never an inherited one.

### Q2. Could anything from a project other than the one being searched be sent? — IN THE NAIVE SHAPE, YES.

Read out of the naive child's own transcript:

- the user's **global** `~/.claude/CLAUDE.md` — present (its `graphify` section matched twice)
- the user's **auto-memory** `MEMORY.md` — present; the line *"UI server is the owner's, on 58888"*
  appears verbatim, and `MEMORY.md` is referenced ten times
- **`userEmail`** — the owner's address, twice
- the corpus injection for whatever directory the child happened to be launched in

None of that is "the project being searched." It is the user's cross-project standing instructions
and his personal memory, sent on every query, because the child is a full Claude Code session and a
full session loads them.

**Under `--safe-mode` all four are gone.** CLAUDE.md, auto-memory, plugins and MCP are disabled by
the flag; input falls to 465 tokens; what is sent is the prompt this plugin composed and nothing
else. **So the answer is: false as written, true under the neutralised shape.** I am reporting it
rather than designing around it, as the item requires. My own reading is that it does not overturn
the ruling — same account, same Anthropic, no new party — but the owner rules on his own property,
and this is the fact he needs in order to rule: *a naive `claude -p` search sends his global
instructions and his personal memory file on every query, and one flag stops it.*

**A third thing the rule did not ask about, which may matter more than either.** `--safe-mode`
disables MCP servers. Without it, a search spawns a child that opens connections to Gmail, Google
Drive and Google Calendar connectors. Nothing was sent to them and all three reported `needs-auth`
— but a search box should not be opening connections to the user's mail.

---

## THE UNAVAILABILITY ANSWERS — three are cheaply separable, and there is a FOURTH

`nothing-to-do-and-could-not-look-are-different-answers` needs distinct values. Measured, they are
distinct and nearly free to distinguish:

| state | signal | cost | latency |
|---|---|---|---|
| **not on PATH** | spawn fails, `ENOENT`, shell exit 127 | $0 | 47 ms |
| **not authenticated** | exit 1; `is_error: true`; `terminal_reason: "api_error"`; `result: "Not logged in · Please run /login"`; `total_cost_usd: 0` | $0 | 1.2 s |
| **answered with nothing** | exit 0; `is_error: false`; a `result` string carrying no usable expansion | full price | full latency |

**And a fourth the rule does not enumerate: rate-limited / over quota.** The owner's seven-day
window is at 0.96. When it reaches 1.0 the call fails — and it fails with
`terminal_reason: "api_error"`, **the same field as "not logged in."** Only the `result` text
separates them. A reader told to log in when he is merely out of weekly quota is the same defect
that rule names, one state further along. **Phase 2 must carry four values, not three**, and must
discriminate on exit code + `is_error` + `result` text, never on `terminal_reason`.

---

## EXPANSION vs RERANKING — expansion, and the numbers are not close

| | expansion | reranking |
|---|---|---|
| input tokens | 465 | **4,034** (8.7×) |
| cost per query | $0.0037 | **$0.0135** (3.7×) |
| wall clock | 8.2 s median | **12.5–15.6 s** |
| scales with | the query | **the candidate set** — 20 candidates cost 4k tokens; 100 would cost ~20k |
| what it returns | FTS5 hits: real spans, real offsets | an ordering, and only over what FTS5 already found |

**And the measurement that settles it.** The rerank prompt said *"drop none."* Both runs dropped
almost everything: asked to order 20 candidates it returned **`5, 6`** and **`5, 6, 4`**.
`INV-nothing-is-dropped-silently` is explicitly preserved by the ruling — *"Ordering is not
filtering"* — and the model, instructed in plain words not to filter, filtered anyway: 17 of 20
results gone, twice out of two attempts. Reranking as measured does not merely cost more; **it
breaks a standing invariant by default**, and would need its own enforcement layer (verify the
returned list is a permutation, re-append everything dropped) before it could be trusted at all.

**Recommendation: build query expansion. Do not build reranking in this phase.** Expansion is 3.7×
cheaper, roughly 1.7× faster, its output is a set of words this project can validate before use, and
every hit it produces is still a real FTS5 span at a real offset. Reranking remains the right answer
to *"find where I decided X when none of X's words appear"*, and the two compose — but it needs the
permutation guard first, and that is a second item, not a second paragraph of this one.

**One consequence of the 8-second median the shape must absorb.** Expansion's call happens *before*
the deterministic search, so a naive wiring makes the reader wait 8 s before seeing anything, while
the deterministic search returns in 4.3 ms. **Show the deterministic results immediately and fold
the expanded hits in when they land** — never make the fast half wait on the slow one. `NO SILENT
SPEND` then falls out of the shape rather than being bolted on: the fast half is free and automatic,
the expansion is the button.

---

## WHAT I SPENT, AND WHAT I LEFT BEHIND

**$0.4717** across 27 `claude -p` invocations (25 billable; two returned before any model call).
$0.296 of that — **63% of the whole measurement** — was the single first naive call on inherited
Opus, which is itself the headline finding. Seven-day quota moved 0.95 → 0.96.

**I polluted the corpus, deliberately and measurably, and it is not cleaned up.** The three naive
calls left, in the owner's real store:

- 3 transcripts in `~/.claude/projects/D--Users-UserC-source-repos-my-context/` —
  `c9cee8d2-53d9-4d06-9e19-c817ea6847e8`, `687758d9-5e10-4208-98d9-eff3199dbd98`,
  `77726f93-428f-455e-8211-15625dda49af` (~496 KB each)
- 3 rows in `conversations`, 8 in `conversation_prose`, 3 in `prose_sources`
- 6 files in `.my_context/state/`

`.anchors.jsonl` was rewritten but is byte-identical; a pre-run copy sits in the lane scratchpad if
the owner wants the mtime restored. I deleted none of it: removing the evidence before it has been
read is the wrong order, and git writes were not mine to make. **Three "conversations" whose entire
content is a question about cache synonyms are now searchable in this project's own recall index —
which is the finding, demonstrated on the owner's own data.**

---

## WHAT PHASE 2 STILL HAS TO DECIDE

1. Whether `--safe-mode` alone suppresses the transcript, or whether `--no-session-persistence` is
   also required. One call decomposes it.
2. The explicit spawn environment: `CLAUDE_CONFIG_DIR` chosen, not inherited, so a search issued
   from the UI server authenticates as the session's account and reads the session's archive.
3. The fourth unavailability value (rate-limited), and the READER of each of the four.
4. Whether the bimodal 1.5 s / 4.5 s startup overhead is controllable. If it is, the median moves
   from 8.2 s toward 5 s — still a button, but a far better one.
5. The permutation guard, if and when reranking is taken up.
