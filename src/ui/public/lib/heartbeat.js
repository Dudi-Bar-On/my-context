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
 * Start the heartbeat. `doc` and `pingFn` are injected — `doc` so the rule
 * above can be exercised without a real `Document`, `pingFn` so a failed ping
 * (server already gone) is the caller's problem, not this module's: it must
 * not throw out of a `setInterval` callback, where nothing would catch it.
 * Returns a `stop()` that clears the timer; app.js calls it once, from
 * `api()`'s catch, the moment a request proves the server is gone — the
 * heartbeat must not itself be what reconnects (spec §2: silent
 * reconnection would reintroduce the daemon by another name).
 */
export function startHeartbeat(doc, pingFn, intervalMs) {
  const timer = setInterval(() => {
    if (shouldPing(doc.visibilityState)) pingFn();
  }, intervalMs);
  return () => clearInterval(timer);
}
