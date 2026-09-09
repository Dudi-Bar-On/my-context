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
 * **Exported, and since `plan:archive seq:29` actually READ by the second
 * surface** rather than merely offered to it: `screens/conversations.js`
 * imports this name instead of declaring its own `250`, so the number and the
 * argument for it exist once. It was that screen's number first — the block
 * above is its reasoning, kept here because this is now where it lives.
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
 * **WHAT `screens/conversations.js` ADOPTED, AND WHAT IT DID NOT** —
 * `plan:archive seq:29`, which was filed expecting that screen to adopt THIS
 * function with its `tick` as the `pingFn`. Measured against the code as it
 * now stands, it cannot, and the reason is an ORDERING this function fixes:
 * `beat` asks `shouldPing` BEFORE it calls `pingFn`, and that screen's `tick`
 * asks `scroll.isConnected` FIRST and tears the whole follow down when the
 * answer is no. Under `startHeartbeat` a hidden tab whose document well had
 * been replaced would never reach that teardown — the timer and the listeners
 * would outlive the well they were created for, which is the per-conversation
 * leak `stopFollowing`'s own comment is about. So the screen keeps its
 * interval, and what it adopted is `attachLook` and `LOOK_GAP_MS`: the event
 * PAIR is spelled in one place and the number is chosen in one place, which is
 * what the item was actually about. The rest of the divergence is argued on
 * `attachLook` below, where it belongs — it is a fact about the two callers'
 * clocks, not about this timer.
 */
export function startHeartbeat(doc, pingFn, intervalMs, win) {
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

  const detach = attachLook(doc, win, () => {
    if (stopped) return;
    if (!shouldPing(doc.visibilityState)) return;
    if (Date.now() - askedAt < LOOK_GAP_MS) return;
    clearInterval(timer);
    timer = setInterval(beat, intervalMs);
    ask();
  });

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    detach();
  };
}

/**
 * **Register the LOOK pair on both targets, and hand back the one removal.**
 *
 * The pair — `visibilitychange` on the document and `focus` on the window —
 * is a single fact about how a return to a tab reaches a page, and it was
 * written out twice the moment a second surface wanted it. This is the one
 * place either name is spelled, so a surface that adopts the look tick cannot
 * adopt half of it: `win` absent means NO listeners at all rather than one of
 * the two, which is exactly the state `startHeartbeat`'s stand-in `doc` is in
 * (`test/ui/viewmodel.test.ts` exercises the visibility rule against a
 * two-field object with no `addEventListener` on it).
 *
 * It registers and removes and decides nothing: the gate (`shouldPing`) and
 * the double-fire guard (`LOOK_GAP_MS`) stay with the CALLER, because the
 * callers debounce against different clocks — the heartbeat shares one
 * `askedAt` with its scheduled beat so a look right after a beat is dropped,
 * and a look-only ticker has no beat to share with.
 *
 * **AND THAT SENTENCE IS WHY THIS IS EXPORTED** — `plan:archive seq:29`. The
 * third caller is `screens/conversations.js`, whose look tick debounces
 * against the `askedAt` its own ONE-SECOND `tick` writes, so a look landing
 * 50 ms after a scheduled `/tip` is dropped. `startLookTicks` cannot express
 * that: its `firedAt` is its own, it has never heard of the scheduled ask, and
 * handing that screen a second private clock would make one return to the tab
 * two `/tip` requests a quarter-second apart — the exact collision the number
 * exists for, reintroduced by the refactor that was supposed to unify it. So
 * the screen takes the PAIR from here and keeps its own clock, its own
 * interval re-base and its own `scroll.isConnected` teardown. What is shared
 * is what is genuinely one fact; what is not shared is different behaviour,
 * not a second copy.
 */
export function attachLook(doc, win, handler) {
  if (win === undefined || win === null) return () => {};
  doc.addEventListener('visibilitychange', handler);
  win.addEventListener('focus', handler);
  return () => {
    doc.removeEventListener('visibilitychange', handler);
    win.removeEventListener('focus', handler);
  };
}

/**
 * **The look tick with no timer behind it: run `onLook` when the reader comes
 * back to the tab, and at no other time.**
 *
 * `plan:live seq:22`. `app.js` uses this to REOPEN THE SHARED AUDIT STREAM
 * after our own server closed it, and the whole reason it is a separate
 * export rather than a second argument to `startHeartbeat` is that the
 * heartbeat's scheduled beat must not carry it: a reopen on a 60 s timer
 * would be the silent reconnection §2 forbids, and a reopen on a LOOK is not
 * silent — a reader is standing in front of it.
 *
 * Same three rules as the heartbeat's own look tick, and they are the same
 * code: `attachLook` registers the pair, `shouldPing` gates it so a hidden tab
 * asks for nothing, and `LOOK_GAP_MS` drops the second of the
 * `visibilitychange`/`focus` pair that ONE return fires. What it does not have
 * is an interval to re-base, because there is no interval.
 *
 * `stop()` removes both listeners, for the reason `startHeartbeat`'s does and
 * with more at stake: `app.js` stops this from the same place it stops the
 * heartbeat — the moment a request proves the server is gone — and a look tick
 * surviving that would be a dead page reopening a stream against a process
 * that exited. Idempotent, because more than one failure path calls it.
 */
export function startLookTicks(doc, win, onLook) {
  let stopped = false;
  /** When this ticker last FIRED. `0` is "never", correct on the first look. */
  let firedAt = 0;
  const detach = attachLook(doc, win, () => {
    if (stopped) return;
    if (!shouldPing(doc.visibilityState)) return;
    if (Date.now() - firedAt < LOOK_GAP_MS) return;
    firedAt = Date.now();
    onLook();
  });
  return () => {
    if (stopped) return;
    stopped = true;
    detach();
  };
}
