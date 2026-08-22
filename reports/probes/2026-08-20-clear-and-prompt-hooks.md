# Probe: what `/clear` reports, what a slash command reaches, and the `fork` source nobody knew about

**Tasks 1 and 2** of `docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md`.
Measured 2026-08-22 on branch `b16-clear-probe` (base `master`, `5e8e634`).
Consumed by **Tasks 6, 8, 12 and 16**.

Both tasks are marked **BLOCKED on an interactive session**. They are not, and the third finding
below is the reason it mattered to check.

---

## 0. The premise that was wrong, and the one that was right

Task 1 says, as its first line, that `claude -p` cannot produce a `/clear`. **On 2.1.239 it can.**
`claude --resume <id> -p "/clear"` runs the same `clearConversation` the interactive `/clear` runs,
fires the same two hooks, and mints the same new session id. Section 1 records the payloads.

What was right is the reasoning behind the block: *listing a value in a comment and a matcher is not
evidence the platform ever sends it.* That reasoning turned out to cut the other way too. The
platform sends a fifth `SessionStart` source — `fork` — that this project's comment, its matcher and
its entire source tree have never heard of, and a forked session gets **no injection at all**.

---

## 1. Method, so this can be repeated on a later build

Two independent methods, used together. Every claim below is tagged with which one backs it.

### 1a. Static — grep the shipped binary

The installed builds are single PE executables under
`C:/Users/UserC/.local/share/claude/versions/` — `2.1.237`, `2.1.238`, `2.1.239`.
`C:/Users/UserC/.local/bin/claude.exe` is a launcher, byte-identical in size to `2.1.239`.
`grep -a` works on them; `dd if=<build> bs=1 skip=<offset> count=<n> | tr -d '\000'` dumps a
readable window around a hit.

**Every static quote below is from `2.1.239`** and carries its byte offset in that file, which is
how to re-find it. Offsets are build-specific and will move; the quoted fragment is the identity.
This is the method `src/core/statusline-tee.ts`'s spec §4b was derived by, and the ui3 plan records
that precedent.

Minified identifiers (`flo`, `rit`, `J4s`, `br`) are **not stable across builds** — `2.1.238`
renames the schema helper `Or` to `Mr` and `kt` to `Ct`, for instance. Re-derive them by grepping
for the string literals (`"SessionStart"`, `hook_event_name:`), never by the short name.

### 1b. Live — a throwaway hook harness under `claude -p`

Nothing in the repository was touched. The harness lives entirely in this session's scratchpad:

- `echo.mjs` — reads fd 0, appends one line of `<iso> <tag> <raw payload>` to `payloads.jsonl`.
- `probe-settings.json` — passed with `--settings`, so no user, project or plugin settings file was
  edited and there is nothing to un-register. It declares **two** `SessionStart` entries: one with
  no matcher (tag `SessionStart-ALL`, matches everything) and one carrying
  **the exact matcher string this project ships** (tag `SessionStart-MYCONTEXT-MATCHER`), so the
  manifest's own behaviour is measured rather than reasoned about.
- `.claude/commands/probeslash.md` — a one-line project-scoped slash command.
- `probe-settings2.json` — the same, plus **`SubagentStart` and `SubagentStop` with no matcher**, so
  Task 2's "register echo hooks for every candidate prompt event" is answered by a firing or by a
  registered silence, never by an absence of registration.

Run from an empty scratch directory, never from the repository, so no `.my_context/` was read or
written.

**One trap worth recording.** Under Git Bash, `-p "/clear"` is rewritten by MSYS path conversion
into `-p "C:/Program Files/Git/clear"` and silently becomes a plain prompt. The first slash-command
run produced `"prompt":"C:/Program Files/Git/probeslash someArg"` and no expansion event, which
looks exactly like a negative result. Run these from PowerShell, or set `MSYS_NO_PATHCONV=1`.

### 1c. Where the raw payloads came from

Section 1d numbers the lines of one consolidated run: startup + a `Read`, then `--resume` + `/clear`,
then `--resume --fork-session`, then a slash command, then plain text. Line numbers below refer to it.

### 1d. The consolidated run, one line per hook firing

| # | hook tag | `hook_event_name` | `source` / `reason` | `session_id` |
|---|---|---|---|---|
| 1 | `SessionStart-ALL` | `SessionStart` | `startup` | `6eb9731c-811d-495e-8009-e1aa81ef3f42` |
| 2 | `SessionStart-MYCONTEXT-MATCHER` | `SessionStart` | `startup` | `6eb9731c-…` |
| 3 | `UserPromptSubmit` | `UserPromptSubmit` | *(no `source` key)* | `6eb9731c-…` |
| 4 | `PreToolUse` | `PreToolUse` | — | `6eb9731c-…` |
| 5 | `SessionEnd` | `SessionEnd` | `reason: other` | `6eb9731c-…` |
| 6 | `SessionStart-MYCONTEXT-MATCHER` | `SessionStart` | `resume` | `6eb9731c-…` |
| 7 | `SessionStart-ALL` | `SessionStart` | `resume` | `6eb9731c-…` |
| 8 | `SessionEnd` | `SessionEnd` | **`reason: clear`** | `6eb9731c-…` **(old id)** |
| 9 | `SessionStart-ALL` | `SessionStart` | **`clear`** | **`db2ddf37-55fc-4dc3-990f-95026128c997`** |
| 10 | `SessionStart-MYCONTEXT-MATCHER` | `SessionStart` | `clear` | `db2ddf37-…` |
| 11 | `SessionEnd` | `SessionEnd` | `reason: other` | `db2ddf37-…` |
| 12 | `SessionStart-ALL` | `SessionStart` | **`fork`** | **`73728916-626c-4ec8-bdc6-93c42f943491`** |
| — | **`SessionStart-MYCONTEXT-MATCHER` DID NOT FIRE** | — | — | — |
| 13 | `UserPromptSubmit` | `UserPromptSubmit` | *(no `source` key)* | `73728916-…` |
| 14 | `SessionEnd` | `SessionEnd` | `reason: other` | `73728916-…` |
| 15–16 | both `SessionStart` | `SessionStart` | `startup` | `8321812a-5d4f-46a1-8a58-532b717ffb3a` |
| 17 | `UserPromptExpansion` | `UserPromptExpansion` | `expansion_type: slash_command` | `8321812a-…` |
| 18 | `UserPromptSubmit` | `UserPromptSubmit` | *(no `source` key)* | `8321812a-…` |
| 19 | `SessionEnd` | `SessionEnd` | `reason: other` | `8321812a-…` |
| 20–21 | both `SessionStart` | `SessionStart` | `startup` | `5840abc9-3e49-4c9f-b74a-68d1a579a30d` |
| 22 | `UserPromptSubmit` | `UserPromptSubmit` | *(no `source` key)* | `5840abc9-…` |
| — | **no `UserPromptExpansion` on plain typed text** | — | — | — |
| 23 | `SessionEnd` | `SessionEnd` | `reason: other` | `5840abc9-…` |

Lines 8→9 are the clear. Line 12 is the fork. Lines 17→18 are the slash command; line 22 is plain
text submitted the same way, and the difference between them is the whole of Task 2's answer.

---

## 2. Question 1 — does `/clear` fire `SessionStart`, with what `source`, and does `session_id` survive?

### Evidence class: **MEASURED**, and independently **TRACED** in the binary. The two agree exactly.

#### 2a. The measurement

Raw payload, line 8 — the firing *before* the clear, transcript path elided for width:

```
2026-08-22T07:06:33.112Z SessionEnd {"session_id":"6eb9731c-811d-495e-8009-e1aa81ef3f42",
"transcript_path":"…\\6eb9731c-811d-495e-8009-e1aa81ef3f42.jsonl","cwd":"…\\scratchpad\\probe",
"prompt_id":"961a2b27-f674-4d5e-821c-258df0f058bd","hook_event_name":"SessionEnd","reason":"clear"}
```

Raw payload, line 9 — the firing *after* the clear, 638 ms later:

```
2026-08-22T07:06:33.750Z SessionStart-ALL {"session_id":"db2ddf37-55fc-4dc3-990f-95026128c997",
"transcript_path":"…\\db2ddf37-55fc-4dc3-990f-95026128c997.jsonl","cwd":"…\\scratchpad\\probe",
"hook_event_name":"SessionStart","source":"clear"}
```

Reproduced three times across separate runs, with different ids each time, always the same shape.

#### 2b. The answers

| Question | Answer | Evidence |
|---|---|---|
| Does `SessionStart` fire after `/clear` at all? | **yes** | payload line 9 (and line 10 — the shipped matcher's own copy) |
| If it fires, what is `source`? | **`clear`**, exactly | payload line 9 |
| Is `session_id` after the clear the same as before? | **different** — `6eb9731c-…` before, `db2ddf37-…` after | payload lines 8 and 9 |
| Does the shipped matcher `"startup\|clear\|resume\|compact"` catch it? | **yes** | payload line 10 |
| Does the new id persist afterwards? | **yes** — it gets its own transcript file, and a later `--resume` of it carries it on `UserPromptSubmit` and `PreToolUse` | separate run, and the `transcript_path` in line 9 |

Two further firings, not asked for but consumed by Task 7 and by anything reasoning about session
lifetime:

- **`/clear` fires `SessionEnd` with `reason: "clear"` first**, carrying the **old** id (line 8).
  The pair `SessionEnd(old, clear)` → `SessionStart(new, clear)` is the complete signal.
- **`/clear` fires no `UserPromptSubmit`.** It is a local command, not a prompt (see §3c).

#### 2c. The trace, which says *why*

The payload is built by a generator whose fifth statement is the whole of the id question
(build `2.1.239`, byte 317109402):

```
async function*flo(e,t,r,n,o,i,s,a=Q_,l){let c=r!==void 0?{id:Uk(r),project:e.project}:e,
u={...b_(c,rr()),hook_event_name:"SessionStart",source:t,agent_type:o,model:i,
session_title:n??EA(c.id)};
```

`source` is the parameter `t`. `session_id` comes from `b_`, whose first field is
`session_id:e.id` (byte 317119661) — so the payload's id is literally `.id` on the object at `c`.

**`Uk` does not mint anything.** It is `function Uk(e){return e}` (byte 300631629) — a branded-type
cast erased to identity. The `r !== void 0` branch does not *create* an id; it lets a caller
**override** which id the payload reports, which matters for `resume` and `fork` and not for `clear`.

There is exactly one caller of `flo` (2 occurrences of `flo(` in the whole binary, one of them the
definition): the wrapper `rit(e,t,{sessionId:r,sessionTitle:n,agentType:o,model:i,…})` at byte
314792639, which passes its `sessionId` option straight through as `r`. Word-boundary grep finds
**six** call sites of `rit`, and they are the complete set of `SessionStart` producers:

| `source` | call site (byte, `2.1.239`) | passes `sessionId`? | resulting `session_id` |
|---|---|---|---|
| `startup` | `ldt(ui,{kind:"session-start",source:"startup",…})` — several, e.g. 326677042 | no | the process's own id |
| `compact` | `rit(t.session,"compact",{model:…,storageV5:…})` @ 314816104 | no | unchanged |
| `clear` | `rit(e,"clear",{storageV5:f})` @ 315156523 | **no** | `e.id` — see below |
| `resume` | `{sessionId:c}` @ 316746644, `{sessionId:nr}` @ 326478173 | yes | the resumed transcript's id |
| `fork` | same two sites, `{sessionId:r.forkSession?Vt():c}` / `{sessionId:nr}` | yes | a **new** id |

So `clear` passes no `sessionId` — and yet the measured id changes. The reason is that `e` is not a
snapshot. The clear handler is `clearConversation`, minified `Flo` (byte 315153445):

```
Et(Y$m,{clearConversation:()=>Flo,hasAgentTaskSurvivingClear:()=>ZPl});
async function*Flo({session:e,setMessages:t,readFileState:r,…,storageV5:f}){
```

`session` is threaded from `AppRoot`, which several call sites construct as `z2,{session:ar()}`
where `function ar(){return br}` (byte 300710504) — the process-wide session store. The React
context hands that same object back unchanged: `useSession`'s snapshot function is
`()=>oGl?oGl(Emo):Emo` over `useSyncExternalStore(Emo.subscribe,tPE,tPE)` (byte 317888948), i.e. the
store **is** the snapshot. And the store's `id` is a getter over a mutable descriptor, whose
`update` assigns in place (byte 300682900):

```
update(d){let p=!1;if(d.id!==void 0||"parentId"in d){…if(d.id!==void 0&&d.id!==e.id)e.id=d.id,p=!0;
```

Between the `SessionEnd` at the top of `Flo` and the `rit(e,"clear",…)` at the bottom, the handler
calls `J4s({setCurrentAsParent:!0})`, and that is the minting (byte 300710504):

```
function J4s(e={}){let t=br.id;…let n=CRu();return br.update({id:Uze.randomUUID(),
...e.setCurrentAsParent&&{parentId:t}}),kRu(br.id,"clear",n),br.id}
```

`br.update({id:Uze.randomUUID()})` — a fresh UUID, with the pre-clear id kept as `parentId`.
`kRu(br.id,"clear",n)` is the emitter the parent investigation spotted; it fires **after** the mint,
so it broadcasts the new id. Corroboration from the same handler, a few statements later:

```
if(await iUe(),eDl(),tDl(I),await Frm(Vt(),Yv(),f),p)…
```

and just above it `if(…,process.env.CLAUDE_CODE_SESSION_ID)process.env.CLAUDE_CODE_SESSION_ID=Vt();`
— re-reading `function Vt(){return xM()?.sessionId??br.id}` and reassigning the environment variable,
which is a no-op unless the id changed.

The pre-clear id is **not** in the hook payload. It is retained in the store as `parentId`, and the
product exposes it: the transcript UI offers a `rewind_pre_clear` restore keyed on `xHt()`
(`parentSessionId`) at byte 326546448.

#### 2d. Decision table for Tasks 6 and 8 — resolved

The plan's table has four rows. **Row 2 applies**: `source` is `clear` and the `session_id` is new.

> `clear` / new id — The branch still runs and is a no-op by construction (a fresh id has no state).
> Task 8 keeps it — it costs one comparison — but the disclosure must say *"no prior state for this
> session id"* rather than claiming a clear happened.

Two consequences the plan's table does not spell out, both measured:

1. **The parent's seen file is never reached by the clear branch.** The `SessionStart` payload
   carries only the new id; the old key is not in it. A handler that clears "this session's" seen
   file on `source === 'clear'` clears a file that was created microseconds earlier and is empty.
   The pre-clear state is orphaned, not cleared — it is what Task 12's prune trigger has to collect.
2. **`SessionEnd` with `reason: "clear"` is the only firing that carries the old id.** If Tasks 6/8
   want the pre-clear seen file actually removed rather than orphaned, that is the event that can do
   it, and mycontext registers no `SessionEnd` hook. **This is a design question for the owner, not
   a fact this probe settles** — it is recorded here because the decision table was written without
   knowing the event existed.

---

## 3. Question 2 — what does the slash-command carrier look like?

### Evidence class: **MEASURED**, and **TRACED**.

§6m.8 rules that the slash command *"arrives as a prompt and therefore reaches a hook that does carry
`session_id`"*. That is **correct**, and there are in fact **two** such events, both carrying
`session_id` as a required field.

#### 3a. `UserPromptExpansion` — the event nobody named

Raw payload, line 17, on `/probeslash someArg`:

```
2026-08-22T07:07:04.674Z UserPromptExpansion {"session_id":"8321812a-5d4f-46a1-8a58-532b717ffb3a",
"transcript_path":"…","cwd":"…\\scratchpad\\probe","prompt_id":"d472fded-27d1-44fc-9c72-537805695652",
"permission_mode":"dontAsk","hook_event_name":"UserPromptExpansion","expansion_type":"slash_command",
"command_name":"probeslash","command_args":"someArg","command_source":"projectSettings",
"prompt":"/probeslash someArg"}
```

And on one of **this project's own** plugin commands, `/mycontext:status`, separately measured:

```
"hook_event_name":"UserPromptExpansion","expansion_type":"slash_command",
"command_name":"mycontext:status","command_args":"","command_source":"plugin",
"prompt":"/mycontext:status"
```

Schema (build `2.1.239`, byte 303340792 region):

```
hook_event_name:kt("UserPromptExpansion"),expansion_type:Or(["slash_command","mcp_prompt"]),
command_name:L(),command_args:L(),command_source:L().optional(),prompt:L()
```

Present in all three installed builds (`2.1.237` as `Lr([...])`, `2.1.238` as `Mr([...])`).

#### 3b. `UserPromptSubmit` — fires too, carrying the raw command line

Raw payload, line 18 — 600 ms after line 17, same `prompt_id`:

```
2026-08-22T07:07:05.274Z UserPromptSubmit {"session_id":"8321812a-5d4f-46a1-8a58-532b717ffb3a",…,
"prompt_id":"d472fded-27d1-44fc-9c72-537805695652","permission_mode":"dontAsk",
"hook_event_name":"UserPromptSubmit","prompt":"/probeslash someArg"}
```

versus plain typed text, line 22:

```
2026-08-22T07:07:16.004Z UserPromptSubmit {"session_id":"5840abc9-3e49-4c9f-b74a-68d1a579a30d",…,
"prompt_id":"b0a0b497-f086-4bc6-b2b3-ec3e1a82c9a3","permission_mode":"dontAsk",
"hook_event_name":"UserPromptSubmit","prompt":"plain typed text, no slash"}
```

#### 3c. The answers

| Question | Answer | Evidence class |
|---|---|---|
| Which event does a slash command reach? | **`UserPromptExpansion`** (structured), and then **`UserPromptSubmit`** (raw text) | measured, lines 17–18 |
| Does it carry `session_id`? | **yes**, both do, and it is **required** in the shared base schema | measured; and the base schema `YH=ve(()=>_e({session_id:L(),transcript_path:L(),cwd:L(),…` at byte 303336785 |
| Is a slash command distinguishable from typed text? | **yes, decisively** — `UserPromptExpansion` fires **only** for a slash command or an MCP prompt, and carries `command_name` and `command_args` already parsed | measured: line 17 present for `/probeslash`, **absent** for line 22's plain text |
| Do the two events correlate? | **yes** — identical `prompt_id` | measured, lines 17 and 18 |
| Do `SubagentStart` / `SubagentStop` fire on a prompt? | **no.** Both were registered with **no matcher** (so they match everything) and neither fired — on a slash command or on plain text | measured (registered silence, not an absence of registration) |
| Does `UserPromptSubmit` carry a `source` telling user text from SDK text? | **declared but not emitted on 2.1.239** | see below |

**On `UserPromptSubmit.source`, and why it must not be relied on.** The schema declares
`source:Or(["user","sdk","system","loop_wakeup","schedule_wakeup","poll_event"]).optional()` with a
`.describe()` ending *"Payloads may omit it while the field rolls out."* Both emitters spread a
constant-folded `false` where it would go (byte 313024411):

```
hook_event_name:"UserPromptSubmit",prompt:r,...!1,session_title:EA(e.id)
```

`...!1` spreads nothing. The caller even computes the value —
`c_r(F,gn(i).mode,i,$2i({promptSource:O??"sdk",wakeupSource:y}))` at byte 320405916 — and the
generator's fourth parameter is never read. **Measured: no `source` key on any of the four
`UserPromptSubmit` payloads captured.** A value in a schema is not a value on the wire, which is the
lesson this whole probe exists to carry.

**Why `/clear` produced no `UserPromptSubmit`.** `UserPromptSubmit` is emitted only after the
slash-command dispatcher returns something still worth querying (byte 320404200 region):

```
if(!D.shouldQuery||n==="bash"||D.forkDispatched||S===!0)return D;
```

`/clear` is a local command that returns `shouldQuery:!1`, so the flow returns before the hook.
`UserPromptExpansion` has the mirror-image restriction: it is fired from `Mvl` (byte 312399679),
reached only from the `case"prompt":` arm of the dispatcher (byte 312394304). **So the two events
partition the command space**: prompt-type commands — markdown commands, skills, plugin commands,
MCP prompts — get both; built-in local commands like `/clear`, `/resume` and `/branch` get neither.
`/mycontext:*` commands are markdown plugin commands and therefore get both, as measured.

#### 3d. Decision table for Task 16 — resolved

The plan's table has three rows. **Row 1 applies**:

> A prompt event fires and carries `session_id` — Register it in `hooks/hooks.json`, with a binary
> that recognises a sentinel line the slash command emits and calls `setSessionName` /
> `setCarrySource`. **State its cost in the same commit:** it is a hook on every prompt, and the
> Global Constraint about the absent in-process bound applies to it exactly as it does to
> `SubagentStart`.

With one correction the plan could not have made, and it removes the row's own cost:
**`UserPromptExpansion` is not a hook on every prompt.** It fires only on command expansion, and
`command_name` is already parsed, so **no sentinel line is needed** — the binary matches on
`command_name === "mycontext:session-name"` (or whatever Task 16 names) and reads `command_args`.
That is strictly cheaper and strictly more reliable than a `UserPromptSubmit` hook that has to
string-match a sentinel out of `prompt` on every turn. Whether to take that route is Task 16's
call; the measurement is that the route exists.

---

## 4. Question 3 — `fork`: a real session shape that gets nothing

### Evidence class: **MEASURED**, including the defect itself. Not inferred.

#### 4a. The value is legal in all three builds

```
hook_event_name:kt("SessionStart"),source:Or(["startup","resume","clear","compact","fork"]),
agent_type:L().optional(),model:L().optional(),session_title:L().optional()
```

Build `2.1.239`, byte 303340792. Present identically in `2.1.237` (`Lr([…])`) and `2.1.238`
(`Mr([…])`) — this is not a value that appeared yesterday.

#### 4b. It is reachable two ways, both of them ordinary

**Route 1 — a CLI flag.** Registered at byte 327232295:

```
option("--fork-session","When resuming, create a new session ID instead of reusing the original
(use with --resume or --continue)",()=>!0)
```

and consumed at byte 316746644:

```
rit({id:Vt(),project:{originalCwd:$n(),projectRoot:pl()}},r.forkSession?"fork":"resume",
{sessionId:r.forkSession?Vt():c,sessionTitle:EA(Vt())??s?.customTitle,storageV5:r.storageV5})
```

**Route 2 — a shipped interactive slash command.** At byte 316417406:

```
name:"branch",description:"Create a branch of the current conversation at this point",
argumentHint:"[name]"
```

whose implementation ends `if(e.resume)await e.resume(a,y,"fork")` (byte 316416541), reaching
`rit(te,Qn==="fork"?"fork":"resume",{sessionId:nr,…})` at byte 326478173. The user-facing string is
*"Branched conversation. You are now in the new branch (session …). Use /resume … to return to the
original"*.

#### 4c. The matcher does not catch it — measured

The matcher is **not** applied as a regex when it is a plain pipe list. `cEE` (byte 317136540):

```
function cEE(e,t,r,n){if(!t||t==="*")return!0;if((r?/^[a-zA-Z0-9_|, -]+$/:/^[a-zA-Z0-9_|]+$/).test(t))
return t.split(r?/[|,]/:"|").map((s)=>s.trim()).filter(Boolean).flatMap((s)=>vOn(Q3(s),n)).includes(e);
```

`"startup|clear|resume|compact"` matches `/^[a-zA-Z0-9_|]+$/`, so it takes the exact-membership
path: `["startup","clear","resume","compact"].includes("fork")` is `false`. There is no substring
reading under which it could pass either.

**And the harness proves it.** The probe registered a second `SessionStart` entry carrying the exact
string from `hooks/hooks.json` · `"matcher": "startup|clear|resume|compact",` · ~6. On the fork run
it did not fire. Raw payload, line 12 — the *only* `SessionStart` line the fork produced:

```
2026-08-22T07:06:40.843Z SessionStart-ALL {"session_id":"73728916-626c-4ec8-bdc6-93c42f943491",
"transcript_path":"…\\73728916-626c-4ec8-bdc6-93c42f943491.jsonl","cwd":"…\\scratchpad\\probe",
"hook_event_name":"SessionStart","source":"fork"}
```

Compare lines 6–7, the plain `--resume` of the same session id moments earlier, where **both**
entries fired. The only difference between the two invocations is `--fork-session`.

#### 4d. What it means for this project

`grep -rn "fork" src/ hooks/ test/` returns seven lines, all in `src/ui/git-info.ts` and
`test/ui/git-info.test.ts`, all about a git remote named `fork`. Nothing in the product knows the
session source exists. `src/hooks/io.ts` · `SessionStart only: startup | clear | resume | compact.` · ~8
enumerates four of five.

So: a user who runs `claude --resume <id> --fork-session`, or types `/branch`, lands in a session
with a **new** id, a **full copy of the prior conversation**, and **no mycontext injection at all** —
no index, no normative tier, no focus, silently. It is not a degraded injection; it is zero. And
because the id is new, the seen file is empty, so nothing downstream compensates.

That is the exact shape of `INV-nothing-is-dropped-silently`, one layer out.

**`hooks/hooks.json` was NOT changed by this probe.** Adding `fork` to the matcher is a behaviour
change to a shipped manifest. The evidence is here; the ruling is the owner's. Two notes for whoever
carries it:

- The one-character fix is `"startup|clear|resume|compact|fork"`. The alternative — dropping the
  matcher entirely, as the `SubagentStart`, `PreCompact` and `PostToolUseFailure` entries already
  do — would also catch the *next* value the platform adds, at the cost of firing on sources the
  handler has no branch for. `if(!t||t==="*")return!0` (byte 317136540) is the rule that makes an
  absent matcher match everything.
- A forked session is **not** the `resume` case in disguise. `resume` keeps the original id, so the
  seen file carries over and the injection is correctly deduplicated. `fork` gets a new id with an
  empty seen file over a conversation that has already seen everything — so if the matcher is
  widened, the fork branch behaves like `startup`, not like `resume`, and will re-inject material
  already in the transcript. That is a Task 8 design question, and it did not exist before this
  measurement.

---

## 5. What still needs a human at a terminal

Not much, and none of it blocks Tasks 6, 8, 12 or 16.

1. **Interactive `/clear` specifically.** What was measured is `claude --resume <id> -p "/clear"`.
   The handler is the same `clearConversation` in both cases and nothing on the id-minting path is
   gated on interactivity — `J4s` takes no such flag. But `--print` mode is a different entry point,
   and this probe cannot rule out an interactive-only difference it did not think to look for. The
   answer is **very** unlikely to differ; if a human ever runs the sequence, this file is where the
   contradiction would be recorded.
2. **Interactive `/branch`.** Route 2 in §4b is traced, not measured — the `--fork-session` flag
   (route 1) is what produced payload line 12. Both reach the same `rit(…,"fork",…)`, so the payload
   shape cannot differ, but "typing `/branch` produces `source: fork`" is an inference from the call
   graph rather than a reading from a payload.
3. **`UserPromptSubmit.source` once it ships.** It is declared and not emitted on `2.1.239`. Nothing
   should be written against it until a payload is seen carrying it.
4. **A multi-turn interactive session.** The `--input-format stream-json` route was tried as a way to
   sequence *tool call → `/clear` → tool call* in one process and **does not work**: the three queued
   user messages were coalesced into a single turn (one `UserPromptSubmit`, `num_turns:3`, the
   `/clear` never dispatched as a command). Recorded so nobody spends the attempt again. The
   chained-`--resume` route in §1c is the working substitute and answered the question.

## 6. What this probe deliberately does not claim

- That `startup`, `resume` and `compact` behave as the code says on every path. `startup` and
  `resume` were measured (lines 1–2, 6–7); **`compact` was not** — its call site is traced
  (`rit(t.session,"compact",…)`, byte 314816104, no `sessionId`, so the id is unchanged) and that is
  all the evidence there is for it here.
- That the byte offsets survive an upgrade. They will not. §1a says how to re-derive them.
- That `fork` is the last source value. The enum has grown; §4d's second bullet is written on the
  assumption it will grow again.

---

## 7. Cleanup

The harness never entered the repository. `probe-settings.json` was passed with `--settings` for the
lifetime of each `claude -p` invocation and no user, project, plugin or managed settings file was
edited, so there is no hook entry to remove — Task 1's Step 4 and Task 2's Step 4 have nothing to
undo. The recorded payloads are quoted above; the scratch directory holding `echo.mjs`,
`payloads.jsonl` and the throwaway `probeslash` command is session-local and is not tracked.
