---
id: TASK-semantic-search-asked-of-the-model-the-user-already-has-and
type: task
title: semantic search, asked of the model the user already has — and the three numbers nobody has taken before it is built
status: superseded
severity: soft
always: false
summary: Let the search find a passage that means what you asked even when it uses different words, by asking the Claude the user is already running - now measured, and the measurement decides its shape.
summary_of: 2ac6b158c2363646
summary_was:
  - 2026-09-16 Let the search find a passage that means what you asked even when it uses different words, by asking the Claude the user is already running.
scope:
  - src/core/conversation-search.ts
  - src/core/**
  - src/ui/public/screens/conversations.js
  - test/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: 2026-09-16
checksum: d86507288952d30b
plan: semantic
seq: "5"
state: todo
priority: "1"
---

# semantic search, asked of the model the user already has — and the three numbers nobody has taken before it is built

THE OWNER RULED IT, 2026-09-16: "implement it completelly including the semantic search, the
model is always available because users ar using it for development, it is not expansive and i
want you to implement it from day 0", then "claude -p is correct".

`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the` IS THE RULING AND IT IS
SETTLED. Ranking is allowed. Semantic ships. The model is the user’s own `claude -p` — NOT a
bundled embeddings model, NOT an API key this project holds. Do not reopen any of the three.
D77’s numbers stand behind it and are not to be re-derived: 11,692 vectors, brute-force cosine
at 4.3 ms per query — the INDEX was never the problem; the MODEL was.

── PHASE 1: MEASURE THREE THINGS, AND REPORT THEM BEFORE BUILDING ANYTHING ───────

The owner ruled the cost is acceptable. That is his call and it is made. But "he ruled the cost
is acceptable" is NOT the claim "the cost is X", and this campaign has already shipped three
reports whose own numbers were wrong. Take the numbers.

  1. RECURSION, AND IT IS THE SHARP ONE. `claude -p` spawned from this plugin starts a NEW
     Claude Code session — which loads THIS PLUGIN’S OWN HOOKS, which inject the corpus and
     run the anchor pass over the transcript. A search that silently starts a session that
     indexes and marks is not a search, and at worst it is a loop. MEASURE WHAT ACTUALLY
     HAPPENS — does the child load the plugin, does it write to `.anchors.jsonl`, does it
     append to the archive — and neutralise it. This is the first thing to find out and the
     answer may change the whole shape.
  2. LATENCY, cold and warm. "1–3 seconds" is a guess this session made up and nothing rests
     on it. The real number decides the surface: 400 ms is a tier, 4 s is a button.
  3. TOKENS PER QUERY, so "not expensive" has a figure beside it the owner can check.

── PHASE 2: THE THREE WAYS IT IS UNAVAILABLE ARE THREE ANSWERS ──────────────

`nothing-to-do-and-could-not-look-are-different-answers`, and this is the easiest thing here to
get wrong. "No semantic result" must never be the value for all of:
  — `claude` IS NOT ON PATH — the plugin is installed where it was not expected;
  — `claude` is there but NOT AUTHENTICATED;
  — it answered, and nothing matched.
The third is a measured zero. The first two are refusals, and the reader must be told WHICH,
because one is fixed by installing something and the other by logging in. A search box that
says "no matches" to a reader who is merely logged out is precisely that rule’s defect. Add the
READER of each disclosure in the same change — a field nobody prints is a comment with a type.

── PHASE 3: WHAT IT ACTUALLY DOES ───────────────────────────────

Anthropic ships NO embeddings endpoint, so this is not vector search and must not pretend to
be. Two shapes are open and the measurement decides between them — say which you chose and
why, against Phase 1’s numbers:
  — QUERY EXPANSION. Ask the model for the other words this idea is written in, then run the
    deterministic search from `semantic/4` over the expanded set. One call per query, the
    result is still FTS5, and every hit is a real span with a real offset.
  — RERANKING. Run the deterministic search wide, hand the model the candidates, let it order
    them. Better answers, more tokens, and it can only reorder what FTS5 already found.
Expansion is the cheaper one and is probably right; reranking is the one that answers "find the
passage where I decided X" when none of X’s words appear. They compose.

── WHAT MUST STAY TRUE ──────────────────────────────────────

  — THE DETERMINISTIC SEARCH STANDS ALONE. With `claude` absent, `semantic/4` works exactly as
    it does with it present. Semantic is an addition, never the thing that makes search work.
  — `CONST-zero-runtime-dependencies` IS UNTOUCHED and stays untouched: `dependencies` empty,
    nothing fetched at install. `claude` is the HOST, not a dependency — the rule says so.
  — THE CONVERSATION IS HIS PROPERTY. The rule argues no new party sees anything because the
    transcripts were produced BY Claude Code. THAT IS AN ARGUMENT, NOT A MEASUREMENT.
    CONFIRM BOTH WAYS IT COULD BE FALSE: that `claude -p` runs under the same account and
    config as the session that wrote the transcript, and that nothing from a project other
    than the one being searched is ever sent. If either is false, STOP AND REPORT — do not
    build around it.
  — NO SILENT SPEND. A call that costs the owner tokens is not made by a keystroke he did not
    aim. Say what triggers it.

── PHASE 1 IS DONE. MEASURED 2026-09-16 BY LANE AG · `reports/2026-09-16-claude-p-measured.md` ───

27 real `claude -p` calls, $0.4717 spent, seven-day quota 0.95 → 0.96. Do not re-derive these.

RECURSION: CONFIRMED, AND IT IS WORSE THAN THE ITEM GUESSED. Three naive calls from this repo's
cwd each: loaded this plugin and took the corpus through `SessionStart`; ran their own `Stop`,
so `rebuildConversations` + `reconcileAnchors` + `markAnchorsOnTurn` all fired; wrote a ~496 KB
transcript under `~/.claude/projects/`; added a row to `conversations`, rows to
`conversation_prose` and `prose_sources`; left two files each in `.my_context/state/`; and
rewrote `.anchors.jsonl` (byte-identical, mtime moved — which is the concurrent-writer defect the
anchor-store commit of this same week was about). THE QUERY BECOMES A SEARCHABLE CONVERSATION.
The child also CONNECTED EVERY MCP SERVER the user has, Playwright and chrome-devtools included.

NEUTRALISED BY `--safe-mode --no-session-persistence --model claude-haiku-4-5 --tools ""`, and
verified over 16 calls: no transcript, no state file, no row, `.anchors.jsonl` untouched.
`--bare` is the TRAP — it also skips hooks but reads neither OAuth nor keychain, which breaks the
one premise the ruling rests on. `--safe-mode` keeps auth.

LATENCY: 8.2 s MEDIAN (n=16, wall clock, neutralised, haiku), p25 5.8 s, p75 9.9 s, min 4.4 s,
max 12.4 s; floor 2.4 s for a forty-token answer; 8.8–13.2 s naive. The "1–3 seconds" guess was
wrong by 3–8×. IT IS A BUTTON WITH VISIBLE PROGRESS, NOT A TIER. Startup overhead is bimodal,
1.5–1.9 s or 4.4–4.6 s, consistent within a run and UNEXPLAINED — pinning the fast path is worth
3 s of the median.

TOKENS: 465 in / 428 out median per expansion (~90% of output is thinking), ZERO cacheable,
mean $0.0037. Naive: 37,400–43,800 in, up to $0.296 on inherited Opus — 80× the tokens of the
question. Reranking 20 candidates measured at 4,034 in, 12.5–15.6 s, $0.0135.

PRIVACY, BOTH HALVES ANSWERED. Same account and config: YES by default — `apiKeySource: "none"`,
resolves `~/.claude`, writes beside the transcripts being searched — but `CLAUDE_CONFIG_DIR`
picks credentials AND archive with one value, this project already repoints it in four test
files, and an empty one makes `claude -p` exit 1 with "Not logged in" rather than falling back.
THE UI SERVER IS THE HAZARD: a search from it would spawn with that long-lived process's env.
Nothing from another project: FALSE IN THE NAIVE SHAPE, TRUE UNDER `--safe-mode`. The naive child
carried the user's GLOBAL `~/.claude/CLAUDE.md`, his auto-memory `MEMORY.md` and his `userEmail`.
Reported, not designed around; the owner rules on his own property.

A FOURTH UNAVAILABILITY STATE EXISTS AND THE RULE NAMES ONLY THREE: rate-limited. It returns
`terminal_reason: "api_error"` — THE SAME FIELD as not-logged-in — so discriminate on exit code +
`is_error` + `result` text, never on `terminal_reason`. Measured: not-on-PATH is ENOENT/127 at
47 ms and $0; not-authenticated is exit 1, `is_error: true`, `"Not logged in · Please run /login"`,
$0, 1.2 s; answered-with-nothing is exit 0 at full price.

SHAPE CHOSEN: QUERY EXPANSION. Reranking is 8.7× the input tokens, 3.7× the cost and ~1.7× the
latency — and asked in plain words to order 20 candidates and DROP NONE it returned `5, 6` and
then `5, 6, 4`, breaking `INV-nothing-is-dropped-silently` twice out of two. Reranking needs a
permutation guard first and is a SEPARATE item. Because expansion's call precedes the search,
show the deterministic results at 4.3 ms and fold the expanded hits in when they land.

── WHAT PHASE 2 STILL OWES ──────────────────────────────────────

  1. Does `--safe-mode` alone suppress the transcript, or is `--no-session-persistence` needed?
     One call decomposes it; both were applied together.
  2. Spawn with an EXPLICIT `CLAUDE_CONFIG_DIR`, never an inherited one.
  3. Four unavailability values, not three, and the READER of each.
  4. Whether the bimodal startup overhead is controllable.
  5. The permutation guard, if reranking is ever taken up.

## Relations
- superseded_by [[RULE-search-may-rank-its-results-and-semantic-search-is-not]]

## Request

fix it now, i want to see marks as soon as they are created, about the search - implement it completelly including the semantic search, the model is always available because users ar using it for development, it is not expansive and i want you to implement it from day 0
