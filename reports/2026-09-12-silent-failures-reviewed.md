# Silent failures, reviewed

**2026-09-12 · a whole-codebase audit for swallowed errors, dishonest error
handling, and assertions that cannot fail**

Read at the working tree on `b5feb0a2`, not at `HEAD` — twenty-seven files were
modified and four untracked when this began, including `src/hooks/stop.ts`,
`src/core/anchor-pass.ts`, `src/ui/server.ts`, `test/ui/no-writes.test.ts` and
the brand-new `src/ui/retrieval-write.ts`. **Line numbers in files another lane
is editing will drift**; every finding quotes the load-bearing line so it can be
re-found by text.

Nothing was written but this file. No source, no test, no corpus item, no git
state. No test was run — five lanes were live and the suite is load-sensitive —
no server was started or touched, no browser driven.

**Coverage.** 135,651 lines of `src/`, 46,728 of them re-read line by line;
`test/` (565 files) and `e2e/` (103) read for falsifiability; `scripts/`,
`harness/` and `.github/workflows/` read whole. 625 `catch` sites in `src/` were
classified mechanically and then read: 89 rethrow, 38 use the error, 192 swallow
with a written argument, **306 swallow with none**. Of the 203 `readFileSync`
calls, **15 distinguish `ENOENT` from every other errno; 145 do not.**

**A word on calibration, because this codebase earns it.** Most swallows here
are argued in prose, and most of those arguments hold — they are listed in *What
is done well* rather than padded into findings. The damage is concentrated where
the argument is **absent, outgrown, or wider than the code it sits above**. That
last case is the finding of this review, and it has a name below.

---

## The thing underneath all of it

Two hard invariants give opposite instructions for the same event, and the
codebase obeys the one that says nothing.

- `INV-hooks-fail-open` — *"When anything goes wrong the hooks **say nothing**
  and let the session carry on."* Its body enumerates **a corrupt config** among
  the cases this covers.
- `INV-nothing-is-dropped-silently` — *"Anything left out for lack of room, **or
  because it could not be read**, is named somewhere."*

Both are `severity: hard`. A corrupt config is named by both, in opposite
directions.

**The resolution already exists and is already written down.**
`KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses` settles it in
one sentence: *"Keep failing open — that part is right and `INV-hooks-fail-open`
requires it — but **disclose**."* That ruling was applied at exactly one site,
`parseHookInput`, on 2026-09-03. It was not propagated, and the function
immediately upstream of it (B1 below) still carries the defect the ruling closed.

So the recommendation that subsumes most of this report is not a design argument
the owner has to have. It is a propagation task, and it has one governing
sentence: **fail-open governs stdout and the exit code. It does not govern
stderr, and it does not govern the audit row.** Every fix below is an instance of
that, and every one is small.

---

## The five I would fix first

1. **A trailing comma in `config.json` silently removes the entire product from
   every session** — and the audit log keeps writing healthy rows while it
   happens, because the recording path and the delivery path take opposite
   branches of the same throw. (B1)
2. **`mycontext statusline install` can overwrite the user's whole
   `settings.json` with a two-key file** — permissions, hooks, env, model, all
   of it — and save `previousText: null` as the backup, so uninstall cannot put
   it back. (B2)
3. **Declining a review draft deletes it even when the decline never reached
   disk**, and writes an audit row asserting the opposite. The one record in the
   subsystem nobody can reconstruct. (B3)
4. **The browser shell has no `main().catch` and reads `localStorage`
   unguarded** — the two defences `lane.js` and `doc.js` both have. In a browser
   with site data blocked, the app never boots and looks like a dead server. (B7)
5. **The CLI cannot observe a failed write to stdout at all**, so a truncated
   `--json` document exits 0. The "exit codes lying through a pipe" class, still
   open in its purest form. (B9)

**Counts: 11 blockers, 24 majors, 21 minors.**

---

# BLOCKERS

## B1 — A malformed `config.json` empties every delivery, and the audit log says nothing is wrong

**Files.** `src/core/workspace.ts:147-157` (the throw) · `src/core/inject.ts:1145-1156`
· `src/hooks/session-start.ts:123, 137-139, 342-344` · `src/hooks/pre-tool-use.ts:245, 423-427`
· `src/hooks/pre-compact.ts:161, 332-334` · `src/hooks/post-tool-use.ts:65` ·
`src/hooks/subagent-start.ts:328-332`

`loadConfig` throws on a `config.json` that is not valid JSON, and
`resolveWorkspace` propagates it. Six delivery paths call `resolveWorkspace`
inside a catch that returns an empty value:

```ts
// core/inject.ts:1155
} catch {
  return { text: '', pinnedSpill: null, deliveredIds: [] };
}
```

The `Injection` type has no failure channel, so `session-start.ts` receives a
value byte-identical to a healthy workspace with an empty corpus. Its disclosure
is gated on the wrong condition:

```ts
// hooks/session-start.ts:343
if (findProjectRoot(cwd) === null && !hasGlobalCorpus()) process.stderr.write(noWorkspaceLine(cwd));
```

`findProjectRoot` succeeds — the directory is there — so `noWorkspaceLine` never
fires. `storeAppendix` catches to `''`. `handoverAppendix` catches to `''`.
Empty stdout, empty stderr, exit 0.

**What makes this the lead finding rather than one of six.** The *recording*
paths deliberately avoid the throw and say why:
`observe.ts:290`, `post-compact.ts:249`, `session-end.ts:164`,
`post-tool-use.ts:163/232/298` and `pre-tool-use.ts:682` all use
`findProjectRoot`, and `observe.ts:266-270` states the reason —
*"`resolveWorkspace` throws on a `config.json` that is not valid JSON, and a
workspace with a broken config is still a workspace whose events should be
recorded."* The *delivery* paths do not. So on a broken config **the audit log
keeps filling with healthy rows while every delivery returns empty.** The
evidence actively exonerates the failure.

**Scenario.** A user hand-edits `.my_context/config.json` and leaves a trailing
comma. Every session from then on starts with zero project knowledge; every
`Read`/`Edit` gets no JIT tier; every compaction restores nothing; every
subagent dispatches with no rules. `mycontext audit` shows a normal, busy
workspace. The CLI would have said so loudly — `toCliMessage` prefixes and prints
`my_context: <path> is not valid JSON: <reason>` and exits 1 — but nothing in a
session ever calls it. This is the nine-day `noWorkspaceLine` silence reopened
through a different door.

**Size: small.** The sentence already exists and is already well worded. Add a
`failure?: string` to `Injection`, set it in the catch, and have each hook write
it to stderr in `noWorkspaceLine`'s voice. `pre-tool-use.ts`'s Markdown-fallback
path (which discloses on three surfaces) is the in-tree model.

## B2 — `statusline install` overwrites the user's whole `settings.json` when it cannot read it, and destroys its own backup doing so

**File.** `src/cli/commands/statusline-install.ts:721-725`, written at `:890, 899, 908`

```ts
function readSettings(file: string, out: Emit): ReadResult {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return { ok: true, text: null, value: {} };   // :724
  }
```

The docstring argues exactly one case: *"A file that does not exist is
`text: null` with an empty object — a user who never configured Claude Code,
which is a state to install into rather than an error."* The catch covers every
errno. The parse-failure branch twelve lines down is exemplary — it refuses
whole, explains, and says *"Nothing was written"* — and this branch defeats it.

```ts
const installedText = serialize({ ...settings.value, statusLine: INSTALLED });   // :890
saved[backupKey(file)] = { …, previousText: settings.text, … };                 // :899
writeSaved(ws, saved);
writeText(file, installedText);                                                  // :908
```

With `settings.value === {}`, line 890 produces a settings file containing
**only** my_context's statusLine. Permissions, hooks, env, model, MCP servers:
gone. And `previousText` is `null`, so `statusline uninstall` cannot restore
what it replaced — the backup mechanism built for precisely this case is
defeated by the same line.

**Scenario.** On Windows — the owner's platform — `settings.json` is briefly held
by another process (an editor, a sync client, the indexer), or sits behind an
`EACCES` after a permissions change. `mycontext statusline install --yes`
reports success and the user's Claude Code configuration is gone, with no copy.

**Size: one-line.** `catch (err) { if (err.code === 'ENOENT') return { ok: true, text: null, value: {} }; out(…); return { ok: false }; }`
— reusing the parse branch's own wording.

## B3 — A declined draft is deleted even when the decline was never recorded, and the audit row asserts it was

**Files.** `src/review/declined.ts:118-137` · `src/review/decline.ts:121-124, 130-133`

```ts
export function recordDecline(stateRoot: string, decline: Decline): void {
  …
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* survivable litter */ }
  }        // returns void — the failure is unobservable
}
```

```ts
recordDecline(ctx.root, { claim, target, at: now.toISOString(), why });
rmSync(path.join(ctx.root, ...item.filePath.split('/')), { force: true });
ctx.store.deleteById(item.id);
```

`declineDraft`'s own header states the design this defeats: *"Removed first, a
crash leaves the draft gone and the decline unrecorded, and the next pass
proposes the same claim forever with nothing to stop it. **The whole of §8 is
that second failure**, so the write that prevents it goes first."* The ordering
is right. The swallow reproduces the outcome without a crash — and then the
audit note says, permanently and falsely, *"The claim is kept in the decline
ledger so the pass does not re-propose it."*

**Scenario.** The owner declines a draft while `state/` is unwritable (a
read-only checkout, a Windows rename losing to a held handle — a failure this
repo has *measured* nine times in `ui-server-upkeep.json.tmp-*`). The draft and
the item are deleted, the ledger is unchanged, and the next review pass proposes
the identical claim. Forever. The owner's explicit "no" is the one record in this
subsystem that cannot be reconstructed.

**Size: small.** Return `boolean` from `recordDecline` — its two siblings
`writeState` and `writeCounter` already do — and refuse the deletion on `false`,
naming the ledger path.

## B4 — The read boundary casts `status` without validating it, so a typo makes an item vanish from every surface and silently ungoverns it

**Files.** `src/core/item.ts:545-546` · `src/core/validate.ts:26` ·
`src/core/select.ts:521, 1237-1252` · `src/core/trust.ts:349-351`

```ts
status:   (optString(fm, rawBlock, 'status')   ?? 'active') as Status,
severity: (optString(fm, rawBlock, 'severity') ?? 'soft')   as Severity,
```

`STATUSES` is `['active','draft','superseded','deprecated','validated']`, and
every **write** surface refuses against it via `enumError`. The **read**
boundary — the one handling files the product explicitly invites people to
hand-edit — refuses nothing. Note the asymmetry inside `parseItem` itself: `id`
*is* validated (`validateLoadedId`), an unknown `type` *is* raised as a
`LoadError` with a paragraph of reasoning. `status` beside them gets a cast.

Two harms, both confirmed:

- **It disappears.** `isEligible` needs `status === 'active'`; `buildIndex`'s
  three buckets need `'draft'`, `RETIRED_STATUSES`, or `'active'`. A status of
  `retired` — a natural word to type, and *not* in the vocabulary — matches
  none. The item is in no tier, no index bucket, no spill, no `LoadError`. It
  still prints in `mycontext list`, so the user sees it and assumes it governs.
- **The supersede gate fails open.** `trust.ts:349` reads
  `GOVERNING_STATUS[item.status]`, which is `undefined` for an unlisted value,
  so `governsNormatively` is false and the refusal that protects a hard
  governing rule from a non-human caller stops firing. Its sibling `tierOf`
  fails *closed* and argues why at length; the asymmetry is unargued.

`severity` adds a third-order effect: `SEVERITY_RANK[a.severity]` is `undefined`
→ `byPriority` returns `NaN` → ECMA-262 treats it as `+0`, short-circuiting the
layer and id tiebreaks, so admission order under budget pressure becomes
non-deterministic.

**Size: small.** Validate the three enums in `parseItem` and raise a `LoadError`
— which `loadErrorNote` already surfaces into the injected block. Separately make
`GOVERNING_STATUS`'s lookup total and fail closed.

## B5 — An unreadable directory removes a whole corpus layer with zero `LoadError`s

**File.** `src/core/rebuild.ts:81-94`

```ts
try { real = realpathSync(dir); } catch { return out; }
…
try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
```

The argument offered covers one case: *"A missing `.drafts/` costs one failed
`realpathSync` and produces no error."* That is `ENOENT` on one optional
directory. The same two lines swallow `EACCES`, `EPERM`, `ELOOP`, `EIO` and
`EMFILE` on `items/` itself and on every subdirectory mid-walk.

The asymmetry inside the same function proves the intent: a broken **symlink**
*is* pushed as a `LoadError`, with a docstring saying *"never skipped in
silence."* An unreadable **directory** is not. `loadLayer` then returns items with
an empty `errors` array; `loadErrorNote([])` returns `''`; the injection is
simply smaller.

**Scenario.** `items/rule/` is momentarily locked — antivirus, the Windows
indexer, a network mount, or `EMFILE` under load during a 724-file walk. That
session is injected with every category *except* rules. `list`, `select` and
`ready` all under-report. Nothing on any channel says so. If `items/` itself is
unreadable, the entire corpus vanishes silently. This is the one failure
`INV-nothing-is-dropped-silently` names in its own text — *"because it could not
be read"* — and the machinery to report it is already built and already wired
into injection and into fourteen CLI commands.

**Size: small.** `ENOENT` is the only silent case; push a `LoadError` naming the
directory and the errno otherwise.

## B6 — One `readdir` failure makes the audit projection delete itself and report "no records"

**Files.** `src/core/audit.ts:1370-1377` · `src/core/audit-db.ts:197, 222, 290-297`

```ts
export function auditSegments(root: string): string[] {
  const dir = auditDir(root);
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }   // no comment
```

Traced end to end: `[]` → `projectionState`'s `for (const file of known.keys()) if (!seen.has(file)) return 'diverged'` → `syncProjection` executes

```sql
DELETE FROM audit_item; DELETE FROM audit; DELETE FROM audit_source;
```

and re-projects from the same empty list.

A momentary lock or fd exhaustion on `.audit/` makes `mycontext audit` report
**no records** for a workspace holding tens of thousands, and wipes the
projection while doing it. `src/cli/commands/status.ts:97-103` already documents
the downstream half and leaves it open: *"an unreadable audit TREE is
indistinguishable from an empty log (`auditSegments` swallows the readdir error)
… NOTHING surfaces that today; no doctor check exists for audit-log
readability."*

The rule this breaks is enforced correctly 1,200 lines away, in
`src/core/jsonl-log.ts:299-311`, where `ENOENT` is the only swallowed code and
the comment says *"this is NOT the same as 'nothing has been recorded'."*

**Size: small.** Swallow `ENOENT`; throw otherwise. Add the doctor check the
`status.ts` comment says does not exist.

## B7 — The browser shell has no `main().catch` and reads `localStorage` unguarded

**File.** `src/ui/public/app.js:8412`, `:8104`, `:8124`

```js
main();                     // :8412 — no .catch, anywhere in the file
```
```js
const lang = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);   // :8104
…
token = await exchangeNonce(fetch.bind(window), nonce);                              // :8124
```

Both defences exist in the two satellite pages and are absent from the shell.
`doc.js` and `lane.js` both end `main().catch(…)` and render the error — each
saying it follows *"the same rule the shell follows."* The shell does not.
`lane.js:144-150` additionally wraps that exact `localStorage` line:

```js
} catch {
  // Private mode refuses `localStorage`. The navigator still answers, and a
  // window that threw here would be blank rather than merely English.
```

**Scenarios.**
- Site data blocked for `127.0.0.1` (strict privacy mode, an extension, an
  enterprise policy): line 8104 throws before `applyStatic`, before
  `renderChrome`, before the heartbeat. The reader gets `index.html`'s authored
  English chrome — rail, strip labels, wordmark — and nothing else. No banner, no
  console message they will read. It looks like a server answering nothing; it is
  a page that never asked.
- **The recovery path itself:** paste the URL `mycontext ui` prints while the
  server is still binding — the 8-second window this codebase measures and
  documents at `app.js:2683-2695`. `exchangeNonce` rejects, `main()` rejects, and
  `history.replaceState` never runs, so the now-spent nonce stays in the address
  bar. The one gesture the product tells a locked-out reader to make does
  nothing at all, silently.

**Size: small.** End with `main().catch(err => banner(...))` in `doc.js`'s shape;
copy `lane.js:144-150` verbatim to line 8104; wrap 8124 so a failed redemption
falls through to `rememberedToken()` + `showDisconnected()`.

## B8 — One failed request kills the heartbeat for the life of the page; the next success wipes the banner that explained it

**File.** `src/ui/public/app.js:2357`, `:2510`, `:8264`, `:2395-2403`

```js
liveUnreachable = true;
showExited();
stopHeartbeat();          // :2357 and :2510
```

`startHeartbeat` is called at **exactly one** site — line 8264, inside `main()`.
`stopHeartbeat` is called from two failure paths and is **never re-armed**: not
by `noteServerAnswered()`, not by `reopenLiveStream()` (which restores only the
*stream*), not by `installNonceRedemption` (which re-runs four fills and one
`heartbeatPing()`, but not the timer). `heartbeat.js:126-132`'s `stop()` also
removes the `visibilitychange`/`focus` listeners, so the look-tick recovery goes
with it.

Then the evidence is erased:

```js
if (response.ok && disconnectedShown) {
  disconnectedShown = false;
  document.getElementById('exited').hidden = true;     // :2402
}
```

**Scenario.** The owner's server is replaced by `restartStaleServer` — which
`app.js:2963` measures as *"six restarts in one night, a down/up cycle every
14-15 minutes."* During the window a `fetch` throws: banner says "The server has
exited", heartbeat dead. Eight seconds later the server is back, the tab
recovers, every pane refills with real data, the first 200 hides the banner.
**The page now looks completely healthy and has no heartbeat for the rest of its
life.** No staleness detection — so the "this page is newer than the server"
banner can never fire again — no corpus drift chip, no occupancy, no session
size, no lane count. Every one keeps displaying the value it held before the
restart with no marker. This is verbatim what `server.ts:1063` warns about:
*"a stale record does not look broken, it looks like a server somewhere else."*

**Size: small.** Add `restartHeartbeat()` and call it from `noteServerAnswered()`
— the one function whose whole job is "the server answered again". If §2 forbids
re-arming, the honest alternative is a `heartbeatStopped` latch that makes every
strip chip draw as *not read* rather than keeping stale values unmarked.

## B9 — The CLI cannot observe a failed write to stdout, so a truncated `--json` exits 0

**File.** `src/cli/index.ts:1698`

```ts
process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
```

This is the **only** output channel in the product. Grep over `src/cli`,
`src/mcp` and `src/rules` finds zero `process.stdout.on('error')`, zero `EPIPE`
handling, no `unhandledRejection` or `uncaughtException` handler, and no site
that inspects a write's outcome. Node constructs the global `console` with
`ignoreErrors: true` — write errors are discarded by design — and
`process.stdout` on a pipe is asynchronous. `emitJson` (`format.ts:355-357`)
writes an entire document in one `console.log`, so this is not a line-granularity
concern.

**Scenario.** A CI step runs `mycontext doctor --json > report.json` on a large
corpus, or `mycontext list --json | head -20`. The write fails or the reader
closes the pipe. `runCli` has already returned its number, `process.exitCode` is
already 0, and no path exists to change it. The gate reads exit 0 and an invalid
or truncated document, and concludes the corpus is healthy.

**Size: small.** Install `process.stdout.on('error', …)` before `runCli` and add
the `unhandledRejection`/`uncaughtException` pair. The gate is a test that pipes
a large `--json` into a reader that closes after one line and asserts non-zero.

## B10 — MCP `status_report` deletes every "I could not measure this" disclosure and prints `health: 0 error(s), 0 warning(s), 0 note(s)`

**File.** `src/mcp/tools.ts:2255-2259`, printed at `:2312-2314`, filter at `:356-358`

```ts
const real = findings.filter((f) => !isDoctorDisclosure(f));
const health = { errors: …, warnings: …, infos: … };   // counted from `real`
```
```ts
`health: ${health.errors} error(s), ${health.warnings} warning(s), ${health.infos} note(s) — see the doctor tool for details.`
```

`isDoctorDisclosure` is `finding.about !== ''`. The findings it removes are
exactly the ones this project built to say *"that is an UNMEASURED set and not a
clean one"* — `state_audit_coverage`, `task_verification_coverage`,
`assumption_overdue_coverage`, `watched_doc_coverage`. The MCP `doctor` tool
makes the same split and then **prints the disclosures** (`:1470`, `:1504`).
`status_report` never computes `disclosures` and never prints them anywhere.

**Scenario.** The audit log has one damaged line. `readAudit` refuses it
correctly and loudly. Three checks return only their coverage disclosure. An
agent calls `status_report`, reads `0 error(s), 0 warning(s), 0 note(s)`,
reports the project healthy and proceeds. Nothing in the result says three health
questions were never asked. The doctor saying healthy because it could not look,
arriving on the surface an agent uses most — and strictly worse than the CLI,
which runs `summarize` over the unfiltered list.

This is governed by `RULE-say-what-your-check-cannot-see-when-you-report-it-green`
and by `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.

**Size: small.** Compute `disclosures` and push one line after `health:` naming
the count and the codes. The filtering is right; the discarding is not.

## B11 — A shipped gate has never been able to fail, and its own header predicted it

**File.** `test/ui/icon-sprite.test.ts:57-63`

```ts
const used = usedIcons(html);                        // /href="#(i-[a-z-]+)"/g
const dangling = used.filter((u) => !defined.includes(u));
assert.deepEqual(dangling, [], '<use> references a symbol the sprite never defines: …');
```

**Measured just now:** `docs/design/web-ui-mockup.html` contains exactly two
`href="#i-` occurrences, at lines 2063 and 2209, and **both are prose inside
comments**, written as `href="#i-<name>"`. `<` is not in `[a-z-]`, so the regex
matches neither. 6 `<symbol id="i-…">` defined, **0** matching `<use>`. `used`
is `[]`, `dangling` is `[]`, and `assert.deepEqual([], [])` is unconditional.

The file's own header says so — *"nothing in the document yet writes a `<use>`,
so `used` is `[]` and the diff passes trivially"* — and calls it "the state this
file starts from". It never left it.

**What ships unnoticed.** The real consumers are elsewhere and unscanned:
`src/ui/public/index.html` has a live `href="#i-open"`, and
`src/ui/public/screens/parts.js:595` sets `use.setAttribute('href', '#i-open')`
at runtime. Rename or drop `i-open` and every `<use>` renders a blank 16×16 box —
indistinguishable from "loaded and empty" — with this test green.

**Size: small (~6 lines).** Point `usedIcons` at the real consumers and guard it
with `assert.ok(used.length > 0, 'no <use> found at all — this diff is checking nothing')`.

---

# MAJORS

## The error channel exists and nobody reads it

**M1 · `recordAudit`'s `written: false` is discarded at 14 of 16 hook call sites.**
`recordAudit` never throws; it returns `{ written: false, error }`
(`src/core/audit.ts:1660`). Exactly two sites read it:
`post-tool-use-failure.ts:137` (which discloses correctly, and is the model) and
`pre-compact.ts:273`. The other fourteen ignore it. Three are load-bearing:

- **`pre-tool-use.ts:388`** is followed at `:416` by `appendSeen`, whose comment
  justifies its own best-effort posture with *"the audit record above already
  holds the delivery durably."* That justification rests on a durability the
  code never checks. If the audit append fails and the seen append succeeds, the
  item is marked delivered for the session and **no record of the delivery exists
  anywhere** — dedupe suppresses it, the log denies it happened.
- **`pre-tool-use.ts:452`** (`recordDeny`) — its docblock calls this *"the one
  hook action that CHANGES what a tool call does, so it is the one that most
  needs to be in the log."* A failed append means a refusal the user sees in the
  transcript and the audit log denies.
- **`subagent-start.ts:271`** is the whole mechanism by which *"a kill becomes
  evidence rather than silence."* A failed append leaves neither row, so a killed
  dispatch looks like a dispatch that never happened. **Size: small, mechanical.**

**M2 · `deliverAtDoor`'s `recorded` flag is dropped at both doors.**
`src/rules/deliver.ts:384` returns `Delivery & { recorded: boolean }`;
`src/rules/delivered.ts:159-161` documents the contract in so many words —
*"Returns whether it was written — **the caller discloses**, this module does
not, because only the caller knows which channel a person is watching."*
`session-start.ts:136` and `subagent-start.ts:321` both end `}).text;`.
`grep -rn "\.recorded"` finds no consumer anywhere.

The consequence is worse than a missing row. With `.rules/delivered.jsonl`
unwritable, the rules **were** delivered — the text went into the window — but no
row exists, so `assertDoor` later prints `missedDoorLine`: *"this session has no
record of the product rule store being delivered to it."* The user is told the
constants may be absent from a window they are demonstrably in, and the §8.2
measurement is corrupted in a way that reads as a product defect. This deepens
the known "delivered and unmeasured" finding into something narrower and
fixable: **the store does record, the record can fail, the failure is returned,
and nobody reads the return value.** **Size: small.**

**M3 · `bumpCounter`'s `written: false` is discarded at its only caller.**
`src/hooks/post-tool-use.ts:312`. `review-counter.ts:188-193` says *"The returned
value is correct for this call even when the write was discarded, **which is why
`written` exists**."* With `state/` unwritable, every `PostToolUse` reads
`calls: 0`, writes nothing, and returns 1 — so the counter never reaches the
threshold and `reviewTrigger` emits, every turn, *"review: no pass — 0 of 25 tool
call(s) since the last pass."* True of the file, completely misleading about the
world: it reads as "not enough activity yet" when the truth is "this subsystem
cannot persist a count and will never fire again." **Size: one-line.**

**M4 · `listStaging` throws away the skip list.** `src/lesson/staging.ts:272-274`
returns `readStagingDir(root).staging` and drops `skipped`. That function's
twenty-line docblock is an argument against exactly this: *"a status line reading
'three staged lessons' over a directory of five files was indistinguishable from
a correct one."* Both consumers — `cli/commands/status.ts:203` and
`mcp/tools.ts:2241` — call the lossy wrapper. Two proposed rules, knowledge the
product exists not to lose, vanish from every surface with no count and no
reason. **Size: small — call `readStagingDir` and print `skipped` the way
`restore --list` already does; then delete `listStaging` so no third caller can
pick the lossy door.**

## A measured zero standing in for an unmeasured thing

**M5 · `measureCorpusDrift` answers `drifted: false` over a subtree it could not
read.** `src/core/corpus-drift.ts:139-141`. `CorpusDrift.drifted`'s own docstring:
*"`false` is a MEASUREMENT: the sweep ran, **reached everything it meant to**,
and found nothing newer."* The file already has the right doctrine — a
`truncated` sweep that finds nothing correctly answers `null` — and the
unreadable-subdirectory case is simply not wired into it. A branch switch
rewrites hundreds of item files, one directory is momentarily locked, `/api/ping`
answers `drifted: false`, and the page explicitly tells the reader it is **not**
stale. **Size: one-line** — a `partial` flag routed to the existing `null` branch.

**M6 · The secrets scan reports "nothing matched" for a session it never
scanned.** `src/ui/read-model-conversations.ts:1587-1608`. When the row is not in
the archive it returns `noSecrets(params.id, **true**, …)` — a complete, clean
scan report with `indexed: true`. The client
(`screens/conversations.js:4195-4227`) skips the `indexed === false` branch and
draws *"None of the 14 shapes this looks for appears in this session. That is a
measured zero and NOT a promise."* A measured zero claimed over zero bytes read,
on the one screen in the product where being wrong has a cost outside the screen
— a reader deciding whether a transcript is safe to share. **Size: one-line each
side** (`if (body.source === null)` is already on the wire).

**M7 · `GET /api/tutorials` answers 200 with `heRollup: { done: 0, total: 0 }`
when the manifest will not parse.** `src/ui/read-model.ts:3446-3466`. The 200 is
argued correctly; the zeroed rollup is a translation-debt *measurement* over a
file that was never read, and the parse error never reaches the wire. Reads as
"this project has no tutorials". `read-model-config.ts:188-199` is the correct
pattern in the same directory. **Size: small.**

**M8 · Two doctor checks report defects derived from a silently truncated
walk.** `src/doctor/checks.ts:328-341`, consumed at `:753` (`checkDeadScopes`)
and `:4053` (`checkCitationForm`). `checkWatchedDocsServable` uses the same
bounded walk and *does* emit a coverage disclosure at `:1026`; these two do not,
and `checkDeadScopes` deliberately walks `dist/`, `build/`, `coverage/` and
`.next/`, so the 20,000 bound is reached far sooner. The output is
*"scope glob `src/payments/**` matches no file in the repository. Re-scope it to
the path that replaced it."* — false, with nothing saying the walk was partial.
A user or agent who follows it **re-scopes a governing constraint to a wrong
path** on a measurement that was never taken. Both are `warn`/`info`, so exit
stays 0. **Size: small.**

**M9 · A ledger that cannot be opened reports "no sessions recorded yet".**
`src/mcp/tools.ts:404-405` and `src/cli/commands/status.ts:111-112` return
`sessionsRecorded: 0`, which drives the message a brand-new workspace gets — and,
in `decay_report`, *"nothing here has been measured; 'cold' currently means only
'never injected'."* An agent is handed a list of governing constraints marked
cold with no hint the measurement failed. **Size: small** — a `measured: boolean`
with its own sentence.

**M10 · `searchArchive` reports an empty prose index as "the archive does not
contain this".** `src/core/conversation-search.ts:452-478`. `SearchResult` carries
`searchable`/`note` precisely so an empty list cannot be mistaken for an answer,
and that machinery is used for exactly one case: a query under three characters.
The file's own header admits *"until a caller runs it the table is EMPTY rather
than stale, and an empty table answers nothing rather than answering wrongly"* —
and then answers `searchable: true, note: null, hits: []`. A retrieval mission
finds no pointers and presents that as "the archive holds no material about
this." **Size: small** — compare `index.proseSources().size` against the archive's
source count.

**M11 · `readVocabulary` and `listResults` drop what they could not read,
uncounted.** `src/core/retrieval/subjects.ts:277` (`catch { continue; }`, with a
docstring claiming unreadable files are *"SKIPPED and counted"* — they are not)
and `src/core/retrieval/result.ts:311-333`. In the first, a renamed document makes
`matchSubjects` report spans as `unnamed`, and `unnamed` is described as *"itself
a signal"* — so the wrong signal is read as evidence. **Size: one-line each.**

## Failures with a state that nothing reports

**M12 · The per-turn anchor pass has a `failed` state nothing reads.**
`src/core/anchor-pass.ts:652` → `src/hooks/stop.ts:1085` → `:1150-1167`.
`did: 'failed'` contributes 0 to `moved` and has no clause; `stood-down` has one.
The type's docblock says the three states exist because *"one is a defect and the
other is the budget working"* — and the code reports the budget working and hides
the defect. The same inversion applies to `ConversationRefresh.mirror`
(documented as *"`null` when the mirror pass itself failed, which … must not read
as"* a pass that found nothing) at `:1131` and `:1197`, and to
`ConversationRefresh.anchors`, which is written at `:1037-1047`, returned at
`:1090`, and **read by nothing in `src/` or `test/`**. A damaged
`.my_context/.anchors.jsonl` therefore stops the prose index advancing and stops
every bookmark being marked, silently, from the first turn on — and `.anchors.jsonl`
is the one table no rebuild can re-derive. **Size: small.**

**M13 · `reviewTrigger`'s failure is indistinguishable from "review is switched
off".** `src/review/trigger.ts:225-228` returns `null`, which already means four
benign things, and `reviewNote` answers all five with silence. The function's own
doc is proud that *"a refusal DOES get a clause, and that asymmetry is the
point"* — the asymmetry holds for every decline except the one caused by a bug.
**Size: small** — return `{ fire: false, because: … }` instead of `null`.

**M14 · The handover ask is withheld at 99% occupancy when the latch will not
write, and nothing says so.** `src/hooks/stop.ts:468` — `if (!writeLatch(...)) return null;`,
and `writeLatch` swallows the reason. The write-before-you-speak ordering is
*correct* and well argued. What is missing is that the suppression is announced
nowhere: with `state/` unwritable the window fills, the model is never asked to
write the handover, the compaction destroys the session, and the log's
`handoverAsk` field says `not-asked` — which reads as "the session never filled
up". `standDownOnce` (`:272-277`) has the same shape. **Size: small** —
`resetAsksForWindow` already has the `unwritable` vocabulary.

**M15 · One unreadable transcript directory deletes every row in the conversation
index.** `src/core/conversation-index.ts:943-948` → `:3441`
`index.removeMissing(new Set(files.map(f => f.sessionId)))`. The docstring claims
*"the caller is given the empty list plus the path it looked in, so 'nothing
here' can be told from 'looked in the wrong place'"* — the return type is
`TranscriptFile[]`; only the path survives, never the reason. A transient
`EPERM`/`EBUSY` on `~/.claude/projects/<project>` empties the archive list, the
search index's `sourcesOf`, and every retrieval pointer; the Stop hook reports
*"N indexed session(s) no longer on disk"* — a confident sentence with the wrong
cause. **Size: small.**

**M16 · A transient read error permanently breaks a mirror under a confidently
false explanation.** `src/core/conversation-mirror.ts:125-131` (`sizeOf`) and
`:163-179` (`windowEndingAt`) return `null` for absent *and* unreadable, and three
consumers decide on it: `:515` rewrites the archive row as `exported` and
announces *"the transcript is gone"*; `:537` **deletes the owner's standing
persist mark**; `:545` sets `REPLACED_NOTE` — *"the transcript on disk is no
longer the file this mirror was copied from — it was replaced or rewritten"* —
and that one is **sticky** (`:527`, *"Already broken. It is not retried"*). A
specific, checkable claim about the owner's data, false, permanent, from one
locked read. **Size: small** — on unreadable, do nothing this turn and report a
fourth state.

**M17 · A corrupt or locked index makes every retrieval mission answer "no
material".** `src/ui/read-model-retrieval.ts:343-348` catches everything, where
the sibling route `read-model-conversations.ts:2046-2056` narrows on `instanceof`
and rethrows the rest. `openReadOnlyChecked` throws four distinguishable things;
one of them is "genuinely empty" and three are faults. **Size: one-line.**

**M18 · `readSnapshotMeta` collapses "unreadable" into "absent", and PostCompact
then asserts the false version loudly.** `src/core/ledger.ts:861-878` →
`src/hooks/post-compact.ts:299-301`: *"NO PreCompact snapshot for this session —
the compaction restored nothing, and whatever this window held is not coming
back."* When the file exists and is truncated, that sentence is wrong and
confident, and sends the operator to their hook config instead of their disk. A
malformed `itemIds` is worse: it yields a *successful* read of an empty snapshot,
so a partial restore presents itself as a complete one. **Size: small.**

**M19 · The PreCompact transcript arm reports the same number for "nothing
cited", "could not read", and "read only the last 8 MB".** `src/core/ledger.ts:889-924`,
reported at `hooks/pre-compact.ts:322`. `buildRestoreSnapshot`'s docblock states
the rule this breaks — *"A MISS is the direction this design forbids, so no
failure below may shrink the capture silently"* — and the other two shrink
vectors *are* disclosed. With `stop.ts:750` recording a measured session
transcript of **65,046,326 bytes**, the 8 MB tail covers about 12% of it. Every id
cited in the first 57 MB is dropped from the restore snapshot, and the row says
`N cited in the transcript` as a flat measurement. **Size: small.**

**M20 · The restore tier drops snapshot ids with no disclosure, while the carry
tier names every one of its drops.** `src/core/select.ts:1638-1647` vs `:1104-1120`.
An id in the snapshot that has since been superseded, retired, disabled, or
hidden by a focus is never a *candidate*, so no `Spill` is written and
`noteParts` has no entry. `carriedDropReason` exists solely to name those same
five cases for the carry tier. Mitigation, checked: `post-compact.ts:302` records
`snapshot N id(s), M re-delivered` in the audit log — countable after the fact by
a human, carrying no ids and no reason, and not where anyone looks mid-task.
**Size: medium** — reuse `carriedDropReason`.

## Writes and refusals that lie

**M21 · The anchor write routes answer `200 { indexed: false }` and not one
client call site reads it.** `src/ui/anchor-write.ts:88-100`, returned at `:206,
253, 289, 314`; consumers at `screens/conversations.js:1171, 1513, 1549, 5186,
5228`. The *read* side honours the same field at four places and draws
`conv.neverScanned`; the write side never does. The relabel path reads only
`tookOwnership`, so an `indexed:false` body falls through to drawing
**"Renamed"** for a rename that did not happen. `conversations.js:1156-1159` says
this is the thing it exists to forbid: *"A button that appears to have worked and
has not…"*. Related, same module: `anchor-write.ts:148-165, 221` answers
**200 `{ indexed: true, anchor: null }`** when the row cannot be read back — a
success envelope for a write the server could not confirm landed. **Size: small
(five call sites), or one-line if the routes answer 409 instead.**

**M22 · `applyImport` throws after writing `config.json` and creating items, and
the refusal reads as though nothing happened.** `src/pack/import.ts:501-530`,
surfaced at `cli/commands/pack.ts:606-612`. Every other refusal in the module
lives in `planImport`, before any write; this one fires mid-loop, after
`config.json` has been overwritten and an arbitrary prefix of
`plan.buckets.new` created. `writeImportRecord` never runs, so
`mycontext pack list` does not show the pack and `review promote --all --pack`
cannot reach the items now sitting in the corpus as orphaned drafts the user does
not know exist. **Size: medium** — move the check into `planImport`.

**M23 · The rule-store refusal names a remedy that is a guaranteed no-op.**
`src/rules/store.ts:86-92` and `src/rules/deliver.ts:226-228` both instruct
`mycontext rules verify --restore`. At `cli/commands/rules.ts:220-223`:

```ts
const packageStore = entriesDir();
const store = entriesDir();
const restored = restore && path.resolve(packageStore) !== path.resolve(store) ? restoreEntries(…) : null;
```

Two identical calls to a pure function, so the condition is **always false** and
`restoreEntries` is unreachable. `restoreLines` is honest about it in the
terminal — and that honesty is right. What is wrong is that `renderRefusals`
puts the dead remedy at the top of the text **delivered into every model's
context window at every door**: *"N product constant(s) did not load, and are
therefore NOT in force below. Run `mycontext rules verify --restore`."* The agent
runs it, gets "nothing was restored", exit 0, and has exhausted the only remedy
named. The owner's own standard — a refusal must say what would unblock it, in a
form a gate can test — is not met. **Size: one-line ×2.**

**M24 · Two exit codes that say "done" for work that was not done.**
`cli/commands/ingest.ts:220-259` returns 0 when **every** candidate was rejected —
though `ingest/apply.ts:384-387` models that case separately by leaving the
anchor pending, so the code already knows the difference. And
`cli/commands/pack.ts:592-605` returns 0 on `overwriteBlocked`, which
`outcomeLines` describes as *"item(s) [that] differ in a field no write path here
can reach"* — the tool could not do what was asked. A pipeline
(`ingest-apply … && echo applied`, or `pack import --yes && review promote --all`)
logs success over nothing. **Size: one-line each.**

Also in this family: **`check_failed` does not name which check failed**
(`doctor/checks.ts:4611-4623` over thirty anonymous arrow functions). The
handling is right — error level, exit 1, others unaffected — but the one finding
that marks a hole in coverage is the one that cannot say where the hole is.
**Size: small.**

## Tests that cannot fail

**M25 · Five gates with no positive control**, each the only one of its siblings
without it:

| Location | The control its siblings have |
|---|---|
| `test/ui/graph-screen.test.ts:512-526` | `enKeys.size > 0`. All three extractions key on the same `gr.` prefix and quote style, so they go empty together; `deepEqual([], [])` passes and both loops iterate zero times. This test's own comment documents the *same mechanism* silently disabling it until 2026-09-01 (`gr\.[a-z]+` could not match a camelCase key; 12 of 25 invisible for months). The repair widened the regex and did not add the control. Every sibling has it: `learn-screen:434`, `status-screen:488`, `styles-parity:835`, `library-screen:513`. **1 line.** |
| `test/core/corpus-checksums.test.ts:24-71` | Three silent exits: a root-missing `return`, no `items.length` assertion (so `loadLayer` returning `[]` makes both `deepEqual`s green over 1,108 unexamined items), and a second test pinning one literal filename that is renamed as routine work. Guards the one corruption class nothing else catches — a truncated item, self-consistent and round-tripping, caught only by the recorded checksum. **~4 lines.** |
| `test/no-bare-rmsync.test.ts:42-62` | Per-**line** regex, so a multi-line `rmSync(dir, {\n recursive: true …})` is invisible; no file-count assertion, no planted control — though this repo has that pattern in `test/core/retrieval-return.test.ts:125-135`. Guards a measured Windows `EPERM` flake (1 in 5 full-suite runs). **~8 lines.** |
| `test/rules/isolation.test.ts:128-140` | `out` never asserted non-empty. Its three siblings each have it — `list` at `:116`, `doctor` at `:146`, the injection at `:162`. The file even opens with a test titled *"the store is non-empty, or every assertion in this file is vacuous"*. **1 line.** |
| `test/core/open-readonly-checked.test.ts:24-28` | Bare `assert.throws` with no matcher **and no assertion that the file was not created** — so a `Store.openReadOnlyChecked` that mints an empty `.index.db` and *then* throws passes a test whose title is *"it must never be created by a reader"*. Its direct twin `test/core/ledger-readonly.test.ts:202-212` asserts `existsSync(dbPath) === false` and the same for `-wal`. **3 lines, copied from the twin.** |

---

# MINORS

| # | Location | What is wrong | Size |
|---|---|---|---|
| m1 | `src/hooks/io.ts:220-226` | `readStdin`'s `catch { return ''; }` with the docstring *"Returns '' when there is no stdin (interactive runs)"* — see the pattern section; this is the single most load-bearing instance. | one-line |
| m2 | `src/core/ledger.ts:1052-1059` | `readCarryOnce` returns `{ ids: [], error: null }`; its docstring says *"a corrupt file degrades to 'nothing is carried' **and says so**"*. Every anticipated failure in the same file populates `error`; the unanticipated one nulls it. `carry --show` prints "nothing carried" for a queue it could not read. | one-line |
| m3 | `src/core/ledger.ts:1136-1145` | `spendCarryOnce` returns the ids as spent even when the clearing write failed, so a one-shot carry becomes a permanent invisible pin. | small |
| m4 | `src/core/ui-sessions.ts:149-154, 195-197` | Docstring: *"`error` is non-null only when a file EXISTS and could not be used."* False — `EACCES` returns `error: null`, and so does a JSON scalar. Every open tab is locked out and the channel built to explain it is silent; `recordSessionDigest` then rewrites the store from an empty base, discarding every other issued digest. | small |
| m5 | `src/core/jsonl-log.ts:119-122` | `isTorn` returns `{ torn: false }` — "not torn" — for a file it could not `stat`. | one-line |
| m6 | `src/core/jsonl-log.ts:157-192` | `healTornTail` truncates on a stale size bound with no lock, and `audit-db.ts:318-322` states two concurrent writers is the ordinary case. Between `isTorn`'s `stat` and the `truncateSync`, another process can append complete records this one then truncates away; the fall-through `truncateSync(file, 0)` is the same at whole-file scale. Surfaces only as `diverged`, which `auditFailureNote` is deliberately silent about. **I could not reproduce this**; it is derived from the code plus the stated concurrency model. | medium |
| m7 | `src/core/review-counter.ts:111` · `src/core/ui-server-upkeep.ts:604` | `return { ...FRESH }` for a state file that could not be read. Both are argued for the *shape* (type-check every field) and neither for the *conflation*. | one-line |
| m8 | `src/core/code-identity.ts:415-423, 431, 447` | An install whose sources cannot be walked sets `bootContent = null` → `isStale()` returns `false` → `/api/meta` serves `staleCode: false` → the probe reads `fresh` → upkeep does nothing. `askServerFreshness` is meticulous about three states and maps a non-boolean to `'unknown'` already; the *origin* has only two. The owner's server would run stale code indefinitely with the in-tab banner unable to fire. **Verify at the `/api/meta` handler before fixing.** | medium |
| m9 | `src/core/handover.ts:92-96` | An unreadable handover reports `state: 'missing'`. The alarm fires with the wrong diagnosis; the user goes and finds the file. | one-line |
| m10 | `src/core/mutate.ts:2538-2546` | `catch { restingSaid = ''; }` on the tests-resting-on check during supersede. "It cannot fail the write" is well argued; `''` being byte-identical to "no tests rest on this item" is not. | one-line |
| m11 | `src/core/focus.ts:471-479` | `clearFocus` says "there was nothing to remove" when it could not look. `readFocus`, 80 lines above, does it correctly — the inconsistency inside one file is the tell. | one-line |
| m12 | `src/core/tests-resting-on.ts:200-215, 253-257` | An unreadable test file is reported as a file that declares nothing, feeding the retirement/supersede safety answer. `RestingTests` carries `truncated` and no `unreadable`. | one-line |
| m13 | `src/core/decay.ts:103` | `config.categories[item.type]?.tier !== 'normative'` — `?.` makes an absent category "not normative", so a renamed category's items vanish from `mycontext decay` and are never reviewed for retirement. `DecayReport.unrestricted`'s own docblock is scrupulous about exactly this. | one-line |
| m14 | `src/core/anchors.ts:170-186` | `resolveAnchor` gives one answer to three states; a locked transcript is diagnosed to the owner as a corrupt byte offset. `review/drift.ts:153-158` inherits it. | small |
| m15 | `src/core/conversation-redaction.ts:415-433, 449` | The verbatim-line count is disclosed once, at choice time, and never again as the tail grows. And `removed` is set only on the `unlink` path, so a successful `rmSync` fallback reports "nothing was being faked in this session" having just deleted the plan and the copy. Worth stating beside it: the tail is re-redacted **by shape**, not by remembered value, so `replaced: 0` on a later tail is not a promise. | small |
| m16 | `src/ui/git-info.ts:53-62` + `app.js:5589` | `in-sync` draws **no chip**, and `git-info`'s own docblock calls that verdict *"the dangerous one: a wrong answer shaped exactly like a right one"* when the ref is not the upstream. Silence is the benign branch and it is the branch that can be confidently wrong. | small |
| m17 | `src/ui/packs-model.ts:356-364` | The function whose stated job is `INV-nothing-is-dropped-silently` returns an empty `Dropped[]` on any read failure. | one-line |
| m18 | `src/ui/execute-effect.ts:168-173, 191-196, 234-239` | `symlinksUnder` — the assertion that `dereference: true` held — reports "no symlinks" for a directory it could not read, and the two snapshot walks silently narrow the confirm dialog, against `execute.ts:751`'s rule that *"a command whose effect cannot be shown does not get a weaker confirm — it does not run."* Note `:258-261` gets the file-level version right. | small |
| m19 | `src/ui/server.ts:1407` · `app.js:2277-2282, 2406` | A malformed POST body is reported as a missing field (*"candidate is required"* for a body that was not JSON), against `read-model-config.ts:246-249`'s own stated rule. And a 500 and a 403 reach the reader through the same `errorNote`. | one-line / small |
| m20 | `src/ui/public/app.js:8349` | `// TEMPDISABLED void heartbeatPing();` — the boot beat that `heartbeatPing`'s own header argues for. No item id, no date, no re-enable condition; in combination with B8 it is the only beat some pages ever get. | one-line |
| m21 | `src/mcp/protocol.ts:241-299` | No `'end'`, `'close'` or `'error'` handler on either stream. A final request without a trailing newline is never parsed, never answered, never logged — the client blocks forever. `server.ts:50-59`'s catch wraps only registration, so `process.exitCode = 1` is unreachable for every runtime failure. | small |

Also: `src/cli/commands/rules.ts:279` bypasses `toCliMessage`, so a raw SQLite
error reaches the user without the `my_context:` marker (one-line);
`src/pack/imported-audit.ts:510-516, 534-541` reads an unreadable `import.json`
as "no pack imported here", 100 lines from the sibling `rowsOf` that
discriminates `ENOENT` correctly (one-line); `src/lesson/staging.ts:223-227` and
`src/doctor/checks.ts:1196-1222, 3341-3342` are the same shape;
`src/rules/manifest.ts:165, 550, 626` would erase the store changelog on the next
publish after a corrupt manifest, reachable only from `src/ui/maintenance/`,
which `package.json` excludes from `files` — minor **today**, major the day it
ships; `scripts/e2e-gate.ts:173` guards on `total1 === 0` and not on
`failed1.length === 0`, so a phase 1 that exits non-zero without marking any spec
failed runs `--last-failed` against a stale `.last-run.json` — the exact hazard
its own comment names — and can print GREEN over a red run;
`harness/baseline.mjs:22-23`'s `.catch((e) => ({ stdout: e.stdout ?? '' }))` makes
a suite that never spawned produce `failed: 0` and exit 0 with *"baseline matches
the pin"*; `test/ui/screen-literals.test.ts:430` is the suite's one
`assert.ok(true)` — deliberately a reporter, but it would print "0 literals
enumerated" and pass if `KNOWN_LITERALS` collapsed;
`test/ui/library-screen.test.ts:534-541` passes a **string** as
`assert.throws`'s second argument, where Node treats it as the message and not a
matcher, so any error passes including an `ENOENT` from a wrong `PUBLIC`;
`e2e/composer-staging.spec.ts:206, 282` skip on a property of the developer's
working tree, so one `review promote --all` silently removes two Composer tests.

---

# Patterns

These are worth more than the individual findings. Every blocker above is an
instance of one of them.

## P1 — The argued case licenses the unargued class

A `catch` carries a comment justifying **one** failure — usually `ENOENT`, or
"there is no stdin", or "a missing `.drafts/`" — and then swallows **every**
errno. The comment is correct about the case it names, which is what makes it
persuasive; the code is wider than the comment, which is what makes it a defect.
And because this codebase treats comments as the argument, the docstring then
states a property the code does not have, and other modules cite it.

The cleanest instance is at the door of the whole product. `src/hooks/io.ts:220`:

```ts
/** Reads fd 0 to EOF. Returns '' when there is no stdin (interactive runs). */
export function readStdin(): string {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}
```

`readFileSync(0)` throws `EAGAIN` on a non-blocking pipe. That returns `''`. And
three modules reason *from this docstring* to a decision to say nothing:

- `src/hooks/io.ts:313` — `// Not an error: \`readStdin\` documents '' as the interactive-run answer.`
- `src/hooks/observe.ts:256` — *"An empty payload is an interactive run with no stdin — `readStdin` documents `''` as that answer — **not a platform that stopped sending fields.** Saying anything about it would make every such run noisy about nothing."*
- `src/hooks/session-end.ts:149` — the same sentence again.

`parseHookInput` is one of the best error boundaries in the codebase — it
separates empty from not-JSON from wrong-shape and explains each. Its one soft
spot is an assumption it imports from a comment that over-claims. And the fix
that *created* that boundary,
`KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses`, stopped one
function short of the function whose docstring became the new boundary's premise.

Same shape, with the docstring asserting the opposite of the code:
`ledger.ts:1052` (*"and says so"* → `error: null`), `ui-sessions.ts:195`
(*"`error` is non-null only when a file EXISTS and could not be used"* → it is
not), `conversation-index.ts:938` (*"'nothing here' can be told from 'looked in
the wrong place'"* → it cannot), `corpus-drift.ts` (*"`false` is a MEASUREMENT …
reached everything it meant to"* → it did not), `statusline-install.ts:711`,
`packs-model.ts:330`, `retrieval/subjects.ts:266` (*"SKIPPED and counted"* → not
counted), `rebuild.ts:82`, `staging.ts:218`, `imported-audit.ts:501`.

**The discipline already exists in this repo, in twelve files.**
`code-identity.ts:271` keeps an `ABSENT` set; `imported-audit.ts:406`,
`jsonl-log.ts:299`, `focus.ts:393`, `continuity.ts:101`, `ledger.ts:1015`,
`session-names.ts:103`, `window-state.ts:63`, `revision.ts`, `seen-file.ts`,
`ingest/session.ts` and `help/index.ts` all discriminate. **15 sites do; 145 do
not.** This is an inconsistency, not an unknown — which makes it mechanical to
close.

**The gate this project would build for it:** a check that every `catch` wrapping
an `fs` read either rethrows, inspects `.code`, or names the directory it could
not read. That is testable, it is the shape of gate this repo already builds
(`check-basis`, `check-retired`, `no-writes`), and it would have caught B2, B5,
B6, M5, M15 and half the minors.

## P2 — The error channel is built, documented, and dropped at the call site

The module does it right, says in writing that the caller must disclose, and
every caller drops the value.

| Producer | What it says | Readers |
|---|---|---|
| `core/audit.ts:1660` `recordAudit` | returns `{ written, error }`, never throws | **2 of 16** hook sites |
| `rules/delivered.ts:159` `recordDelivery` | *"the caller discloses, this module does not"* | **0 of 2** doors (via `deliverAtDoor.recorded`) |
| `core/review-counter.ts:188` `bumpCounter` | *"which is why `written` exists"* | **0 of 1** |
| `core/ui-server-upkeep.ts:672` `writeState` | returns `false` so a rate can be recorded | — |
| `review/declined.ts:118` `recordDecline` | returns **`void`** — the channel was never built, and `declineDraft` deletes on its silence | — |
| `lesson/staging.ts:190` `readStagingDir` | returns `skipped` with a reason per file | **0 of 2**, both call the lossy `listStaging` wrapper |

The producers are not the problem. The obligation is handed across a boundary in
prose and nothing enforces the handoff.

**The gate:** these are six named functions. A test asserting that every call
site of each one binds the result is a grep with an allowlist, in the idiom of
`test/ui/no-writes.test.ts`.

## P3 — A measured zero standing in for an unmeasured thing

`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is an owner
ruling, made *"ONCE as a principle after this product had decided the same
question independently four times and got it right four times and wrong once."*
`RULE-say-what-your-check-cannot-see-when-you-report-it-green` says the same
thing for checks. The violations are concentrated where the answer is a count or
a boolean returned from a path that could not look: `[]`, `0`, `false`,
`{ ...FRESH }`, `drifted: false`, `indexed: true`, `health: 0/0/0`,
`staleCode: false`, `torn: false`, `sessionsRecorded: 0`.

`core/corpus-identity.ts:118-133` is the counter-example and the template:
`countItems` returns `UNREADABLE = -1`, rendered as *"an items/ directory that
could not be read"*, never as `0`. So is `core/context-occupancy.ts`, which has
four distinct `UnmeasurableWhy` reasons and **no `percent` field at all** on the
unmeasurable branch, so no caller can write `?? 0`. That is the shape: make the
zero unrepresentable, not merely discouraged.

## P4 — The unlisted input takes the benign branch

The shape the owner asked to have hunted, found four more times outside the
known `isWriter` case:

- `trust.ts:349` — `GOVERNING_STATUS[status]` is `undefined` for an unlisted
  status, so the supersede gate fails **open**. Its sibling `tierOf` fails closed
  and argues why.
- `decay.ts:103` — `?.tier !== 'normative'` makes an absent category benign.
- `ui/git-info.ts` + `app.js:5589` — `in-sync` draws no chip, so the verdict the
  module itself calls *"the dangerous one"* is rendered as silence.
- `hooks/pre-tool-use.ts:732` — `/Edit|Write/` is case-sensitive and
  `FILE_PATH_KEYS` is a closed list of three, so an unrecognised tool shape is
  neither denied nor JIT-injected for. Blast radius is limited by the
  `hooks.json` matcher today.

Worth recording as the counter-example: the `'<absent>'` discipline across
`post-compact.ts:255`, `pre-compact.ts:63`, `file-changed.ts:126`, `setup.ts:54`,
`config-change.ts:62`, `instructions-loaded.ts:61`, `session-end.ts:231` names
unknown enum members loudly instead of defaulting. That is this pattern done
right, consistently, seven times.

## P5 — The disclosure is routed to a surface nobody is on

Not silence exactly — worse, because it reads as coverage. `assertDoor`'s
`catch { return 0 }` argues *"reporting against it would blame the door for the
store's own damage — which `mycontext rules verify` is the surface for."* The
attribution argument is sound; the routing sends the only disclosure to a command
that runs on nobody's schedule, and (M23) that command's advertised remedy is
unreachable. `checkGoverningSpillPressure` is the same trade made well —
*"silent rather than alarmed when it cannot look"*, fully argued — but its last
step is the same: a doctor run shows nothing at all, not even that the check
could not look. One `info` disclosure would preserve every stated property
(read-only, not counted toward the exit code) and end the silence.

---

# What is done well

This is not a courtesy section. The codebase's own arguments are better than most
production code's, and a review that flattened them would be miscalibrated.

**The arguments that hold, and that I checked and left alone.**
`core/lock.ts` end to end — no path falls through to an unlocked write, a timeout
**throws** carrying the lock file, recorded pid and age, and every failure in
`judgeStale`/`reclaimStaleLock` returns the safe direction; the pid-reuse
residual is stated plainly as a deliberate trade.
`core/select.ts` in whole — pure, and every drop is recorded: `Spill.band`,
`PinnedSpill`, `ContinuitySpill`, `GoverningSpill`, `CarriedSummary.dropped`,
with a **second budget pass run purely to compute what the carry ordering cost**.
`core/render.ts` — every disclosure is explicitly outside every budget, because
*"a disclosure a budget could drop is not a disclosure."*
`core/config.ts` — unknown top-level keys, unknown budget keys and invalid tiers
all throw; `agentEditsFor` fails closed to `review`.
`core/rebuild.ts:174-228` — an unknown `type` and a checksum mismatch are both
**reported and still indexed**, because *"a tampered file must be visible, not
made unreadable."*
`core/anchor-file.ts` — a damaged line throws rather than reading as a shorter
list, and `absent` is reported separately from empty so adoption cannot delete
565 bookmarks. (M12 is only that the caller discards its value.)
`core/conversation-index.ts:1901-1955` — absence is checked with `statSync`
*before* the open, explicitly so a permission failure is not reported as an empty
archive, plus a `PRAGMA page_count` so a zero-length file is not mistaken for a
prepared corpus. That is the pattern M17 is a caller failing to adopt.
`hooks/pre-tool-use.ts:281-350` — the SQLite→Markdown fallback discloses on
**three** surfaces: inline to the model, in the audit note, and per dropped file.
The standard the rest of the directory should be held to.
`ui/public/lib/sse.js` — `JSON.parse` deliberately allowed to throw (*"a broken
stream is reported rather than skipped"*), frame state reset before dispatch so a
throw cannot leave half a frame attached to the next, a lone trailing `\r` held
rather than guessed.
`ui/security.ts:311-345` — no catch at all, five refusing exits, fail-closed, no
submitted value echoed back.
`pack/zip.ts`, `pack/reader.ts`, `pack/manifest.ts` — CRC mismatch, truncated
data, unsupported method, oversized inflate, BOM, CRLF, unknown manifest key:
every one refuses by name with the reason. I found no default-to-empty anywhere
in that path.
`cli/commands/registry.ts` — `--yes=maybe` throws rather than guessing;
`--yes=false --yes=true` throws; *"Silently keeping the first was a drop;
silently keeping the last is the same drop with a different victim; concatenating
them invents a value the caller never typed."* The strongest argument in the
codebase, and the code matches it.
`ingest/apply.ts:339-387` and `ingest/schema.ts:300-575` — all-rejected leaves
the anchor pending, mixed keeps the successes and writes rejections to
`<id>.rejected.jsonl`, and every malformed field is a per-candidate refusal with
a sentence, including `extra.<key>: null` and a `__proto__` `defineProperty`
guard that fixed a real *"reported updated having silently dropped the field"*
bug.

**The no-writes guarantee holds.** Checked against `test/ui/no-writes.test.ts`'s
`RULED_WRITES`: `anchor-write.ts` binds exactly `markAnchor`,
`markAutomaticAnchors`, `unmarkAnchor`; `retrieval-write.ts` binds exactly
`approveStagedRestore`, `stageRetrievalReturn`; both register from
`startUiServer` rather than `registerReadRoutes`, so the byte-identical sweep
over the read surface still means what it claims. `openForWrite` opens the read
door first so a bookmark cannot create the archive. **No write in the serving
path outside the ruled exceptions.** The only gap on this axis is M21: a ruled
write reporting a success it did not verify.

**The gates are real gates.** `scripts/check-test-glob.ts` is built on a
measurement — unquoted, `sh` expands `**` as `*`, **2 of 4 test files executed,
exit code 0** — and answers it with a control (the quoting) plus a corroboration
(count parity), run *before* `npm test` because *"a check that runs after the
suite tells you the suite you already trusted was wrong."* `scripts/e2e-gate.ts`
prints every spec that needed the serial retry **unconditionally, before the
verdict and regardless of which way it goes**, *"so this set cannot grow without
being seen"* — and names the live measurement where a verdict-gated report would
have hidden two specs that cleared.

**The suite is unusually disciplined about its own falsifiability.** It has a
house anti-vacuity pattern (`assert.ok(x.size > 0, '…the scans above are
checking nothing')`), planted POSITIVE CONTROL strings in
`test/core/retrieval-return.test.ts:125-135`, and a stated doctrine —
*"a checker is not verified until it has been made red"* — that
`scripts/check-retired.ts` earned by having once been caught passing everything.
`test/ui/no-writes.test.ts:1959` and `:2061` are explicit: *"A ban that scans
nothing reports no violations"* and *"this assertion examined nothing. That is
not a pass."* `test/core/vocabulary-graph.test.ts:119-134` is a whole test
written to keep the one after it from going vacuous. Of 533 assertion-bearing
loops, 344 with no length control, 40 built from a scan or a filter — **all 40
read, 35 cross-guarded.** Clean sweeps worth recording so nobody repeats them:
**one** `assert.ok(true)` in the entire suite; **zero** floating Playwright
assertions across 103 e2e files; **zero** `expect.soft`; **zero** catches around
an assertion; the e2e conditional skips all push a `measured`/`unmeasured`
annotation *before* skipping, and `e2e/preview-spilled.spec.ts:552-566`
documents splitting a test in two on 2026-09-11 precisely so a skip could not
hide a passing half.

**The evidence harness gets it right.** `harness/lib/evidence.mjs` throws on a
duplicate id — *"A silently overwritten record would make a finding
untraceable"* — and `harness/sweep.mjs` records a cleanup failure **beside** the
outcome rather than letting a `finally` replace it, with *"A harness crash is
itself evidence — never swallow it."* All `record()` calls are awaited. (The one
hole is `baseline.mjs`, in the minors.)

**And the product has already fixed defects of exactly this class, by itself:**
`doctor --jso` once ran every check, printed prose, and exited 0 for a CI job
that meant to parse JSON; the doctor summary once read clean above a run that
exited 1; `parseHookInput` once swallowed every stdin failure into `{}`;
`screen-parity` was once blind to prose by construction and the owner found it by
looking. Each is recorded where the next reader will meet it. That is why P1 is
worth closing mechanically rather than case by case — the judgement is already
in the codebase; it just has not reached every site.

---

# What I could not assess, and why

- **Anything requiring execution.** No test, no server, no browser, per the
  constraints. Every finding is read from source. The Windows transient-error
  scenarios (B2, B5, B6, M15, M16) are inferred from this repo's *own measured*
  `EPERM` on `rename` (`ui-server-record.ts:100-128`,
  `ui-server-upkeep.ts:648-655`) rather than reproduced.
- **Ordering claims in the browser.** B8 and the `#exited` sequences in B7/M-adjacent
  material depend on which of two parallel responses lands first, argued from
  `/api/status`'s own documented 1.9–3.0 s cost. **The four-step sequence that
  permanently silences the disconnect banner deserves a Playwright reproduction
  before it is filed.**
- **Existing coverage for any finding.** I did not run the suite, so I cannot say
  which of these are already pinned or knowingly accepted.
- **`m6` (the `healTornTail` race)** needs a concurrent-append harness.
  **`m8`** rests on `/api/meta` serving `staleCode` from `CodeIdentity.isStale()`
  and nowhere else — grep-verified, handler not read.
- **Whether Claude Code surfaces stderr on each event.** Most recommendations
  above route a disclosure there. The hook files assert it confidently for
  SessionStart/PreToolUse/SubagentStart and assert the **opposite** for SessionEnd
  (`session-end.ts:45-51`), and warn that PostCompact stderr becomes a user-facing
  banner. I did not verify any of it against a build. Where the claim is that
  stderr is discarded, the fix must be the audit row instead.
- **Volume.** `src/ui/read-model.ts` (4,203 lines),
  `read-model-conversation-document.ts` (2,658), `lib/viewmodel.js` (100 KB) and
  `cli/commands/statusline*.ts` (5,344 combined) were swept by pattern rather than
  read end to end. `src/ui/public/screens/*.js` was read only where a server
  contract needed its consumer checked.
- **In-flight work.** `src/ui/retrieval-write.ts` and its test are **untracked** —
  another lane's work in progress. I checked them against the no-writes ruling and
  they hold, but any finding there would be premature.
- **The tail of ~290 unguarded loops** whose iterable is a local literal or an
  `Object.entries` of a hand-written table. Non-vacuous by construction and
  spot-checked, not read exhaustively. If you want certainty there it is a
  mechanical second pass.
