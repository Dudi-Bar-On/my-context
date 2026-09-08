// src/ui/public/lib/heartbeat.js
// The page heartbeats ONLY while visible (spec §2): a tab in a background
// window stops pinging, so a forgotten tab stops holding the server up
// within one idle window (src/ui/idle.ts, Task 3).
//
// A plain browser ES module: no types, no imports, no build step. The rule
// itself (`shouldPing`) is one line on purpose — the whole point of pulling
// it out of `startHeartbeat` is that `test/ui/viewmodel.test.ts` can assert
// on the RULE without faking `setInterval` or a real `document`.

/** The §2 rule, and nothing else: ping only when the tab is actually visible. */
export function shouldPing(visibilityState) {
  return visibilityState === 'visible';
}

/**
 * How close to the last ask a LOOK-tick is dropped as a duplicate.
 *
 * **Sized against the collision it exists for, not against the interval** —
 * `screens/conversations.js` established this number and the argument at a
 * 1000 ms cadence, and neither depends on the cadence. One return to a tab
 * fires `visibilitychange` and `focus` in the same task, so the gap this has
 * to swallow is microseconds; a quarter second is two orders of magnitude of
 * slack over that. At this module's 60 s cadence it is a four-hundredth of the
 * period, so a reader who genuinely leaves and returns inside one interval is
 * answered rather than debounced away.
 *
 * Exported so the second surface with this behaviour reads the number rather
 * than re-choosing it — see the block on `startHeartbeat` for why there is
 * still a second surface at all.
 */
export const LOOK_GAP_MS = 250;

/**
 * Start the heartbeat. `doc` and `pingFn` are injected — `doc` so the rule
 * above can be exercised without a real `Document`, `pingFn` so a failed ping
 * (server already gone) is the caller's problem, not this module's: it must
 * not throw out of a `setInterval` callback, where nothing would catch it.
 * Returns a `stop()` that clears the timer; app.js calls it once, from
 * `api()`'s catch, the moment a request proves the server is gone — the
 * heartbeat must not itself be what reconnects (spec §2: silent
 * reconnection would reintroduce the daemon by another name).
 *
 * ── THE LOOK-TICK (`win`) ────────────────────────────────────────────────
 *
 * **Looking at the tab is a signal, and until this existed the strip threw it
 * away** (`TASK-the-status-strip-has-the-same-return-to-tab-delay-the`, and
 * `TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send` one floor
 * up, which fixed the identical shape in the conversation document). A
 * `setInterval` whose callback merely RETURNS while hidden means a reader who
 * comes back waits for the next SCHEDULED beat — and browsers throttle a
 * hidden tab's timers towards once a minute, so that wait is a throttled
 * period rather than the interval anyone chose. Everything `/api/ping`
 * carries is therefore stale on return, and says nothing about being stale.
 *
 * **`win` is what turns it on, and it is OPTIONAL because a stand-in `doc`
 * has no `addEventListener`** — `test/ui/viewmodel.test.ts` exercises the
 * visibility rule against a two-field object, which is the whole reason `doc`
 * is injected at all. Omit `win` and this is exactly the timer it always was.
 *
 * **BOTH events or neither, deliberately.** A tab switch fires
 * `visibilitychange`; a window RAISED without a tab change fires only
 * `focus`. Registering one of the two leaves half the returns slow, and the
 * half it leaves slow is the one an owner watching a terminal beside a
 * browser actually does — so the pair is gated on a single argument rather
 * than offered separately.
 *
 * **`shouldPing` is still the gate and it does not move.** `focus` fires on a
 * window whose tab is not the front one, so the look-tick asks the same
 * question the scheduled beat asks and stops there when the answer is no.
 * This makes a VISIBLE tab faster and nothing else.
 *
 * **Two guards, against two different collisions.** `LOOK_GAP_MS` drops the
 * second of the `visibilitychange`/`focus` PAIR that one return fires; and
 * re-basing the interval is what stops a look-tick colliding with a SCHEDULED
 * one, so after a manual ask the next scheduled ask is a full `intervalMs`
 * away rather than whatever was left of the old period.
 *
 * **AND `stop()` REMOVES THE LISTENERS, which is load-bearing here for a
 * stronger reason than tidiness.** `app.js` calls `stop()` from `api()`'s
 * catch the moment a request proves the server is gone. A focus tick fired
 * after that stop would be a dead page pinging a process that exited — the
 * silent reconnection §2 forbids, arriving through the one channel that
 * outlives a cleared timer. So the listeners are removed rather than merely
 * gated, and `stopped` closes the window between an event already queued and
 * the removal taking effect.
 *
 * **WHY `screens/conversations.js` STILL HAS ITS OWN COPY.** This module is
 * where the four rules now live, and it is written to be the one mechanism —
 * the shape it takes (`doc`, a callback, an interval, `win`) is the shape
 * that screen's `tick`/`stopFollowing` pair already has. It has not adopted
 * it yet only because that file is being edited by another lane; the item
 * that owns the adoption is named in this lane's report. What must not happen
 * is a THIRD hand-written copy: a surface that wants this asks for `win`.
 */
export function startHeartbeat(doc, pingFn, intervalMs, win) {
  const looks = win !== undefined && win !== null;
  let stopped = false;
  /**
   * When the last beat actually ASKED — the half of the double-fire guard the
   * look-tick reads. `0` is "never", which is correct on the first look.
   */
  let askedAt = 0;
  const ask = () => {
    askedAt = Date.now();
    pingFn();
  };
  const beat = () => {
    if (shouldPing(doc.visibilityState)) ask();
  };
  let timer = setInterval(beat, intervalMs);

  const onLook = () => {
    if (stopped) return;
    if (!shouldPing(doc.visibilityState)) return;
    if (Date.now() - askedAt < LOOK_GAP_MS) return;
    clearInterval(timer);
    timer = setInterval(beat, intervalMs);
    ask();
  };
  if (looks) {
    doc.addEventListener('visibilitychange', onLook);
    win.addEventListener('focus', onLook);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    if (looks) {
      doc.removeEventListener('visibilitychange', onLook);
      win.removeEventListener('focus', onLook);
    }
  };
}
