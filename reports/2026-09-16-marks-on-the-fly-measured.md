# Do marks reach an open page on their own? Measured, 2026-09-16

Lane AH · item `TASK-measure-whether-a-mark-really-does-reach-an-open-page-on-its`
(`anchors/14`) · testing commit `d53fadda`.

## What was measured, and on whose server

**Not the owner's process.** Port 58888 is his, it cannot be logged into from here
(the handoff nonce in the URL fragment is one-shot and he holds it), and it was
never touched — it was verified still running under pid 44952 at the end.

What was measured is an **equivalent server** started by this lane on spare ports
(59123 → 59126), `node src/cli/index.ts ui --port <n> --no-open`. It reads the
same corpus, the same `.my_context/.anchors.jsonl` and the same live transcript,
so it exercises the identical mechanism on identical data. Every server used was
checked before measuring: `GET /api/conversations/:id/tip` carried a `marks`
object whose `bytes` equalled the store's size on disk at that instant. A server
whose modules were frozen before `d53fadda` would have failed that check.

**No mark was created, renamed or taken back by this lane.** Nothing was clicked,
no `conversation anchor`, no `conversation rebuild`. Every mark in the table below
was written by the per-turn pass of the main session or of another lane.

## Method

- **Ground truth** — a Node process polled `.anchors.jsonl` 4×/sec and recorded
  every genuinely new row with the wall-clock instant the *file* changed, not the
  row's own `at`.
- **Screen truth** — ONE Playwright tab on
  `#/conversations/at/595db3b1-…/0`, with a `setInterval` poller installed *inside*
  the page recording every change of the `N marked point(s) here.` count, plus a
  `fetch` wrapper logging every `/tip` token and every `/anchors` refetch. A
  `window` sentinel proved no reload; it was re-read intact at the end of every
  window.
- The document was in the **follows** state throughout: *"4394 turns across 52461
  records. Scroll the whole session — there is no page to leave."* — not truncated,
  not a copy, so `tipTimer` runs.
- `document.visibilityState === 'visible'` on every one of ~1,600 ticks per window
  (`hidden: 0`), so `shouldPing` never suppressed a poll and no background
  throttling applied.

### A correction to the method, made mid-run

The brief describes the store as append-only JSONL. **It is not.** The file is
**sorted by `id` and rewritten in full on every write**, so a byte-offset tail
re-reads shifted old rows and reports them as new. The first ground-truth poller
did exactly that and produced three phantom "marks" that were really two
pre-existing lane rows plus a half-line fragment. It was replaced with a poller
that keeps a Set of row ids and diffs the whole file. Anything downstream that
follows this store by byte offset has the same bug.

## Validated observation time

A window counts only where the server was proven up (probed every 5 s) **and**
the page was proven live with its sentinel intact. Five such windows:

| window | from | to | length | marks created |
|---|---|---|---|---|
| W2 | 08:30:37.9 | 08:35:58.4 | 5m 20.5s | 0 |
| W3 | 08:41:25.8 | 08:48:31.7 | 7m 05.9s | 0 |
| W4 | 08:52:57.1 | 08:59:27.7 | 6m 30.6s | 3 |
| W5 | 09:03:44.4 | 09:09:51.1 | 6m 06.7s | 2 |
| W6 | 09:17:07.7 | 09:23:44.9 | 6m 37.2s | 0 |
| **total** | | | **31m 40.9s** | **5** |

All times UTC. The run spanned 08:15–09:24; the gaps are the windows thrown out,
explained under *What went wrong*.

## Results — one row per mark created in the validated windows

| # | entered store | kind | where | writer stamped it | screen showed it | lag (store → screen) |
|---|---|---|---|---|---|---|
| 1 | 08:54:03.826 | table | MAIN | 08:48:26.710 | 08:54:04.093 | **267 ms** |
| 2 | 08:54:03.826 | table | MAIN | 08:54:03.039 | 08:54:04.093 | **267 ms** |
| 3 | 08:54:03.826 | table | LANE `agent-a4a427bd220888ab5` | 08:52:45.032 | n/a — correctly not counted | — |
| 4 | 09:04:13.139 | table | MAIN | 09:04:12.542 | 09:04:13.813 | **674 ms** |
| 5 | 09:04:13.139 | report | LANE `agent-ad746cc09d40c4859` | 09:01:27.263 | n/a — correctly not counted | — |

Marks 1–3 arrived in one store write, 4–5 in another.

**Created vs seen.** 3 main-document marks created, 3 shown unprompted, **0 NEVER
SEEN**. 2 lane marks created, 2 correctly absent from the main count. Median lag
for a main-document mark **267 ms**; median per store write 470 ms; worst 674 ms.

The count moved 588 → 590 → 591 and the arithmetic is exactly right: +2 for the
two main marks, +0 for the lane mark in the same write, +1 for the next main mark
and +0 for the lane mark beside it. A lane's mark moved the shared store file and
so moved the token and forced a refetch, but did not touch the main document's
count — which is the correct behaviour, not a miss.

### The chain, timed link by link

| link | W4 | W5 |
|---|---|---|
| store file changed | 08:54:03.826 | 09:04:13.139 |
| `/tip` token moved | 08:54:03.904 (+78 ms) | 09:04:13.485 (+346 ms) |
| page refetched `/anchors` → 200 | 08:54:03.910 (+84 ms) | 09:04:13.489 (+350 ms) |
| nav count repainted | 08:54:04.093 (+267 ms) | 09:04:13.813 (+674 ms) |

The spread between the two is just where the write landed inside the 1 s `TIP_MS`
period. `tipOk` was 372/372 and 404/404 in the two quiet windows — the probe ran
at exactly 1 Hz and never failed while its server was up.

### Two negative controls, both correct

- **A touch that added nothing.** At 09:17:26 the store's mtime moved with its
  size unchanged and no new ids. The token moved, the page refetched `/anchors`,
  and the count correctly stayed 591. Harmless, but it is a real refetch of the
  whole anchor list bought for nothing — the token is `(present, bytes, mtimeMs)`,
  so any rewrite that leaves the length alone still costs a refetch. Two such
  touches were seen in 31 minutes.
- **A quiet stretch.** W2, W3 and W6 — 19 minutes — produced no marks at all and
  the count did not move. The owner's first hypothesis is real: marks come mostly
  from tables, and a stretch without them produces none.

## The finding that actually answers the complaint

The UI is not where the delay is. Compare the writer's own stamp with the moment
the row reached the store:

| mark | writer stamped | reached store | writer → store |
|---|---|---|---|
| 1 | 08:48:26.710 | 08:54:03.826 | **5m 37.1s** |
| 3 | 08:52:45.032 | 08:54:03.826 | 1m 18.8s |
| 5 | 09:01:27.263 | 09:04:13.139 | 2m 45.9s |
| 2 | 08:54:03.039 | 08:54:03.826 | 0.8s |
| 4 | 09:04:12.542 | 09:04:13.139 | 0.6s |

Marks are **flushed in batches**. A mark stamped when a table appeared can sit for
over five and a half minutes before the store moves, and then several arrive
together. Once the store moves, the screen follows in about a quarter of a second.

So "I could not see new anchor marks added on the fly" is explained twice over,
and neither explanation is the `d53fadda` refresh path: **either no mark was being
created at all** (19 of the 31 measured minutes produced none), **or one was
created and is still sitting unflushed in the writer** for up to ~5.5 minutes.

## What went wrong, and why some windows were thrown out

**A spare UI server does not stay up here.** Four servers were started; three died
silently — clean exit, no stack trace, nothing on stderr — after 6–10 minutes. The
idle shutdown is not the cause: `IDLE_MS` in `src/ui/idle.ts` is 8 hours. One
server (59125) went **down at 09:15:12 and came back by itself at 09:15:19**,
which matches what the main session was writing about at the same moment
("Nobody restarted 58888 — your own product did, automatically"). Running outside
the sandbox did not prevent it.

**The browser is shared with another lane.** Twice the single tab was navigated
out from under this lane — once to `about:blank`, once to
`http://127.0.0.1:51999/#/conversations`, another lane's server. When the tab stops
pinging, the measurement stops with it.

Every window where either of those happened was discarded rather than scored. In
particular the first window (08:15–08:28) is reported as **INDETERMINATE, not a
miss**: a main-document mark entered the store at 08:22:36.99 and the page never
moved off 584, but that server had no health probe on it and had almost certainly
already died — its `/tip` token never moved once across 732 requests, which is
what a dead server looks like. It is not counted for or against.

A consequence worth naming on its own: **when the server restarts, an open page
goes silently stale.** Its tab-lived token belongs to the dead process, every
`/tip` then fails, and the page keeps showing its last count with nothing on
screen saying so. That is a plausible way for the owner to see a page that has
stopped taking marks even though the mechanism works.

**And it happened to the owner's own server during this run.** 58888 was pid
44952 when it was checked at 08:28 and pid 38960 when it was checked at 09:26 —
it restarted itself somewhere in between, unprompted, exactly as the main session
was describing at the time. Any tab he had open on it before that restart has been
showing a frozen count ever since, with no indication on screen. This is the single
most likely explanation for the report that started this task.

## Verdict

**For what it was asked to check, `d53fadda` works.** Over 31m 41s of validated
observation, every main-document mark created reached the open page unprompted,
with no reload, in a median of 267 ms and a worst case of 674 ms. Lane marks were
correctly excluded from the main count. Nothing was NEVER SEEN.

It needs fixes, but not to that path:

1. **The writer's batching, not the reader, is the on-the-fly delay** — up to
   5m 37s measured from the turn to the store. If "as soon as they are created"
   is the goal, this is the only thing left to shorten.
2. **A server restart silently kills an open page's updates.** The token dies with
   the process, `/tip` fails every second, and the page says nothing. It should
   notice repeated failures and say so, or re-handshake.
3. **`.anchors.jsonl` is sorted-and-rewritten, not append-only.** Any consumer
   that tails it by byte offset is wrong; the brief for this very task described
   it the other way round.
4. Minor: an mtime-only touch costs a full `/anchors` refetch for no new marks.

## Evidence

Raw ground truth: `truth3.jsonl`, `truth4.jsonl`, `truth5.jsonl`, `truth5b.jsonl`,
`truth6.jsonl` in this lane's scratchpad; in-page arrays read out of `window.__AH`
under sentinels `LANE-AH-W2-…` through `LANE-AH-W6-…`, each verified intact at the
end of its window.
