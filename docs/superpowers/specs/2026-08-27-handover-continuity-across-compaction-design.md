# Handover continuity across a compaction — design

**Status:** DRAFT 2026-08-27. Two questions in §7 need the owner; nothing else is open.
**Owner requirements that asked for it:** 2026-08-27 — *"on post compact hook, if a
handover file exists read it"* and *"use the most suitable hooks to measure the
context window percentage occupacity, if 98 or greater update the handover file"*.
**Base:** `2026-08-20-v2-hooks-sessions-and-continuity.md`, which took the four
hook-and-session decisions this builds on.

---

## 1. What is actually broken, measured

A compaction is the one moment a session loses everything it has not written down.
This project has a handover file for exactly that, and **nothing in either repository
reads it, writes it, generates it, validates it or links it.** Searched: every
`.ts`, `.js`, `.mjs`, `.json`, `.yml`, `.sh` and `.ps1` in both trees, excluding
`node_modules`. The only non-Markdown occurrences of the word are inside Playwright
accessibility snapshots, where the UI happens to be rendering a directory listing.

So the handover is a document two humans agreed to keep, held up by nothing. It was
written by hand before this session's compaction and read by hand after it, and the
only reason it survived the boundary is that somebody remembered. The project already
has the lesson for this shape:
`LESSON-a-requirement-given-in-conversation-and-never-captured-is-a`.

The second half is worse. **Nothing tells a session how full its own window is.** The
complete `HookInput` surface is 27 fields and not one of them carries a token count,
a percentage or a remaining budget. The nearest thing the product has is
`PreCompact`'s `trigger === 'auto'`, which `src/hooks/post-compact.ts` calls the
product telling you the window filled up — a boolean, after the fact, with the
session already gone.

## 2. The instruction cannot be met by `PostCompact`, and that is stated first

**`PostCompact` stdout never reaches the model.** Build 2.1.239 declares no
`hookSpecificOutput` variant for the event, so anything written there becomes a
user-facing banner appended to the compaction message. The header of
`src/hooks/post-compact.ts` already says so and gives the reading it was established
from. Reading a handover file into a hook that cannot speak to the model is reading
it into a void.

**`SessionStart` is the tier that can, and it already fires on a compaction.** Its
stdout is appended to the model's context verbatim —
`src/hooks/session-start.ts` · `if (text) process.stdout.write(text);` · ~135 — which
is why `src/hooks/io.ts` deliberately excludes `SessionStart` from the envelope
union: wrapping it would deliver the JSON itself into context. Its registered matcher
is `startup|clear|resume|compact|fork`, so the compaction case is already dispatched
and already builds a block; the handover joins that block rather than inventing a
second injection path.

So the requirement is met and the mechanism differs from the words it was asked in.
The division of labour follows from what each event can do:

| event | what it does | why there |
|---|---|---|
| `PostCompact` | RESOLVES the handover, records what it found in one audit row | it already writes an audit row and it can read a file; it cannot speak |
| `SessionStart`, source `compact` | DELIVERS the bounded handover into context | it is the one hook whose stdout the model receives |

This is not a workaround. It is the same shape the injection tiers already have: the
hook that knows something records it, and the hook that can speak says it.

## 3. R1 — after a compaction, the handover arrives

### 3.1 Which file

A new top-level config key, `handover`, registered beside `ui` in
`src/core/config.ts` · `export const TOP_LEVEL_KEYS = [` · ~799. The list is cited by its
opening rather than in full, because a citation a NEW MEMBER breaks is a citation
that will break again — and this key is the member that broke it.

```json
{ "handover": { "path": "reports/V2-HANDOVER.md", "marker": "⏭", "budgetTokens": 1200 } }
```

`path` is repo-relative to the project root and names ONE file. Not a glob: a glob
that matches two handovers has to pick one, and picking is the act that would need a
rule nobody has written. Absent `handover` means the mechanism is off and silent —
a plugin does not read files in somebody's repository because they installed it.

The validator is `requireHandover`, built to the shape of `requireUi` in the same
file: refuse a non-object, refuse an unknown sub-key by name, refuse a `path` that
escapes the project root or is not a string. That refusal style is the house one and
is already pinned by `test/core/config.test.ts`.

### 3.2 How much of it

The handover in this repository is 1,435 lines. Delivering it whole into the window
it exists to protect would be the joke telling itself, so the block is BOUNDED, and
**it is bounded the way the product already bounds things** rather than by a new rule:
`REQ-every-list-and-table-declares-what-leaves-it-and-when-and` is a hard requirement
and a truncated document is the same act as a truncated list.

Two mechanisms, in order:

1. **The marker wins.** If a line matches `^#{1,6}\s*<marker>`, the block is that
   heading through to the next heading at the same level or higher. This project's
   handover already writes `### ⏭ DO THIS FIRST, AFTER THE COMPACTION` and
   `### ⏭ READ THIS FIRST` — the convention exists, is used, and says precisely what
   the next session must do. Reading it is measuring the thing rather than its proxy.
2. **Otherwise the head**, cut at the last section boundary that fits `budgetTokens`.

Either way the block ENDS with what it left behind: how many of how many lines were
delivered, the path, and the fact that the rest is readable. A block that quietly
delivers 40 lines of 1,435 claims to be the handover and is not.

### 3.3 Which session sources get it

`startup`, `clear`, `compact` and `fork` — **every source except `resume`**, which is
the only one that keeps the window it already had. A resumed session that has its
context does not need to be told what it is doing; one that has just been compacted,
cleared or started does.

This is a call taken here rather than left open, because the alternative is a config
key nobody would ever change.

### 3.4 When the file is not there

**It says so, on stderr.** A configured `handover.path` that does not resolve is a
broken agreement, and silence is the defect this whole spec exists to answer —
`src/hooks/io.ts` · `export function noWorkspaceLine(cwd: string): string {` · ~382
is the precedent and the tone. An UNCONFIGURED handover says nothing, because nothing
was promised.

## 4. R2 — at the threshold, the handover is asked for

### 4.1 The number already exists, and it is Claude Code's own

Nothing hands a hook an occupancy figure, but the product already collects one.
`mycontext statusline` receives Claude Code's status-line JSON on stdin and tees it
per session, and the reader
`src/core/statusline-tee.ts` · `export function classifyContext(payload: unknown): ContextSample {` · ~266
already returns `{ state, usedTokens, windowSize, percent }`, computed from
`context_window_size` and the three `current_usage` token fields. **R2 is mostly
built.** What is missing is a hook that reads it and something that can act.

Using Claude Code's own figure rather than arithmetic over the transcript matters:
`context_window_size` is not in the transcript, so computing a percentage there needs
a model-to-window table, and a table like that goes stale silently. Under
`STD-absent-vs-zero` an unmeasured thing is named as unmeasured and never guessed, so
**there is no fallback that invents a percentage.** If the bridge is not installed the
mechanism stands down and says so, once, on stderr.

### 4.2 The bridge is opt-in, and on this machine it is not installed

Measured 2026-08-27: there is no `.statusline` directory in this corpus, and
`~/.claude/settings.json` carries a `statusLine` belonging to a different plugin.
`mycontext statusline install` prints the existing value in full and replaces it only
on `--yes`, saving the previous value so `uninstall` restores it — so installing is
the owner's consented act. **Until he takes it, R2 is inert on this machine.** That is
stated rather than discovered later: it is the same class as the nine-day outage,
where a mechanism was correct about what it measured and silent about what it missed.

### 4.3 Only `Stop` can ask, and this requirement is what unblocks it

A hook cannot write a handover; only the model can. So the mechanism is not *update
the file* — it is *ask the model to, at the last moment where it still can.*

The one registered per-turn event that can speak to the model is `Stop`, through the
`additionalContext` envelope that `src/hooks/observe.ts` records the platform as
declaring for it, and that this project deliberately leaves empty pending an owner
ruling. **The owner asking for R2 is that ruling**, and it is taken narrowly:

- `Stop` speaks ONLY to raise the handover at the threshold. The emptiness stands for
  every other purpose, and a second use needs its own decision.
- It speaks **at most once per session per crossing**, latched in state. A second ask
  after the model has written the handover is a loop, and a loop in a per-turn hook is
  the most expensive bug this design can ship.
- It never blocks. `Stop` runs on a 3-second timeout the platform genuinely waits on.

### 4.4 The threshold, and the one concern worth stating

The owner said 98. **The concern, stated once: Claude Code's own auto-compaction fires
before 98% on current builds, so a 98% trigger can be a threshold that is never
reached — the compaction happens first and the handover is never asked for.**

The design therefore does two things rather than arguing:

- `handover.thresholdPercent` defaults to **98**, as asked.
- **`PreCompact` records the occupancy it fired at**, reading the same tee, into its
  existing audit row, and `trigger` distinguishes `auto` from `manual`. After a
  handful of automatic compactions the corpus knows the real number, and the
  threshold stops being anybody's guess. That is this project's own method: measure
  the thing rather than argue about it.

## 5. What a hook may cost

`Stop` fires on every assistant turn, so its cost is the one that compounds.

| step | cost | bound |
|---|---|---|
| read `<root>/.statusline/<session>.json` | one small file read | already written per assistant message by the bridge itself |
| `classifyContext` | pure function over a parsed object | none needed |
| latch check | one small state read | none needed |

No transcript scan, no directory walk, no network, no spawn. The 8 MB tail-read
helper in `src/core/ledger.ts` · `const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;` · ~868
is deliberately NOT used here — it exists for `PreCompact`, which runs once, and
putting it on a per-turn path would be the wrong trade.

## 6. What this does not do

- It does not write, edit or reformat the handover. A hook that edits the document a
  human maintains is the `config.json` deny rule with the sign flipped.
- It does not decide the handover is stale. It reports what it read; staleness is a
  judgement and belongs to whoever is reading.
- It does not deliver on `resume`.
- It does not install the status-line bridge, and it never installs anything silently.

## 7. What needs the owner

1. **The status-line collision.** Installing the bridge REPLACES the status line he is
   using today. `uninstall` restores it, and `install` shows it before touching it, so
   nothing is lost — but it is his screen. Without it, R2 cannot measure and will say
   so instead of guessing. *Install, or leave R2 inert?*
2. **The threshold.** 98 ships as the default because he named it. §4.4 says why it
   may never fire and what will measure the right number. *Leave 98 and let the
   measurement argue, or start lower?*

## 8. Done when

1. A compaction is followed by a session that receives the handover's marked section,
   bounded, with what was left out named — and a compaction in a workspace with no
   `handover` key changes nothing and says nothing.
2. A missing configured handover discloses on stderr rather than passing silently.
3. Crossing the threshold produces exactly one ask, in one session, and none after the
   handover is written.
4. With no status-line bridge installed, the mechanism stands down and says why, once.
5. `PreCompact` records the occupancy and the trigger of every compaction, so the
   threshold becomes measurable.
