// @basis TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send,
// TASK-the-open-document-follows-the-session-as-it-is-written-and,
// INV-nothing-is-dropped-silently
/**
 * **THE DOCUMENT SAYS HOW OFTEN IT LOOKS, AND THIS IS WHAT MAKES THAT TRUE.**
 *
 * `screens/conversations.js` draws a `conv.doc.follows` line under an open
 * conversation, and it exists because "a screen that only speaks up when
 * something is wrong leaves a reader unable to tell a fresh view from a check
 * that has stopped running". A disclosure of a cadence is only worth drawing
 * while it is the cadence — and until `plan:archive seq:22` it was kept true by
 * a `{secs}` slot filled from `TIP_MS`, so the sentence could not drift.
 *
 * **THAT SLOT HAD TO GO, and this file is what replaces it.** At `TIP_MS =
 * 5_000` the slot read "every 5 seconds"; at 1000 it reads "every 1 seconds",
 * and in Hebrew "כל 1 שניות". Both are wrong, and this string table has no
 * plural rule to fix them with — `en.js` records refusing the same
 * construction twice already, for `rail.cntSome` ("1 findings") and for the
 * doctor count. So the number is now written into both sentences, and what
 * holds them to the constant is an assertion instead of an author's memory.
 *
 * **IT READS THE SOURCE AS TEXT, on purpose.** `conversations.js` is a browser
 * ES module that imports the DOM at load; `test/ui/viewmodel.test.ts` reads
 * `app.js` the same way for the same reason. The constant is a one-line
 * declaration and a regex over it is honest about what it can see: if the
 * declaration is ever reshaped, this fails LOUDLY rather than quietly matching
 * nothing.
 *
 * **WHAT FAILS THIS TEST, and it is the useful question.** Lowering or raising
 * `TIP_MS` without rewriting both sentences. That is the whole point: the next
 * person to tune the interval is told, in the same commit, that two
 * translations claim a number they no longer honour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

/**
 * The cadence a table must spell, per interval.
 *
 * A MAP rather than a formatter, because the two languages do not agree about
 * where a number stops being a numeral: English writes "every second" and would
 * write "every 2 seconds", Hebrew writes "כל שנייה" and would write "כל 2
 * שניות". A table is the honest shape for that, and an interval missing from it
 * fails below with the sentence a translator has to write.
 */
const SPELLED: Record<number, { en: string; he: string }> = {
  1000: { en: 'every second', he: 'כל שנייה' },
  5000: { en: 'every 5 seconds', he: 'כל 5 שניות' },
};

function tipMs(): number {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'conversations.js'), 'utf8');
  const found = /^const TIP_MS = ([\d_]+);$/m.exec(source);
  assert.ok(
    found !== null,
    'TIP_MS is no longer a bare `const TIP_MS = <number>;` in screens/conversations.js — this '
    + 'test cannot see the cadence any more, and the disclosure it guards is unguarded until '
    + 'the pattern here is updated with it',
  );
  return Number((found as RegExpExecArray)[1]?.replaceAll('_', ''));
}

async function table(name: 'en' | 'he'): Promise<Record<string, string>> {
  const mod = await import(pathToFileURL(path.join(PUBLIC, 'strings', `${name}.js`)).href) as
    { strings?: Record<string, string>; default?: Record<string, string> };
  const found = mod.strings ?? mod.default;
  assert.ok(found !== undefined, `strings/${name}.js exports neither \`strings\` nor a default`);
  return found as Record<string, string>;
}

test('the poll interval is one second, and it is inside the measured budget', () => {
  const ms = tipMs();
  // NOT "it did not change" — the number itself is the ruling. 0.057 ms a call
  // against `measureCorpusDrift`'s 6.24 ms/min budget puts 1000 ms at
  // 3.42 ms/min and 500 ms at 6.84 ms/min, which is the first step over it.
  // `TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send` carries
  // the table; the floor is what this asserts.
  assert.equal(ms, 1000);
  assert.ok(
    ms >= 1000,
    'below 1000 ms the poll spends more than the corpus sweep it was budgeted against, and the '
    + 'answer to "not fast enough" is a push the owner has to rule on — not a shorter interval',
  );
});

test('both string tables spell the cadence the constant actually runs at', async () => {
  const ms = tipMs();
  const want = SPELLED[ms];
  assert.ok(
    want !== undefined,
    `TIP_MS is ${ms} ms and no spelling for it is declared here. Write the English and Hebrew `
    + 'sentences for that cadence into SPELLED above, and into `conv.doc.follows` in both '
    + 'string tables — a disclosure that names a cadence the screen does not run at is a false '
    + 'claim about the screen',
  );

  const en = await table('en');
  const he = await table('he');
  assert.ok(
    en['conv.doc.follows']?.includes(want?.en ?? ''),
    `en.js \`conv.doc.follows\` must say "${want?.en}" while TIP_MS is ${ms} ms; it says: `
    + `${en['conv.doc.follows'] ?? '(missing)'}`,
  );
  assert.ok(
    he['conv.doc.follows']?.includes(want?.he ?? ''),
    `he.js \`conv.doc.follows\` must say "${want?.he}" while TIP_MS is ${ms} ms; it says: `
    + `${he['conv.doc.follows'] ?? '(missing)'}`,
  );
});

// @basis TASK-the-conversation-document-still-writes-the-look-tick-by-hand
/**
 * **THE DOCUMENT TAKES THE LOOK PAIR FROM THE MODULE THAT OWNS IT, and keeps
 * the three things that module cannot hold** — `plan:archive seq:29`.
 *
 * Until that item this file asserted four hand-written lines:
 * `document.addEventListener('visibilitychange', onLook)` and its `window`
 * `focus` twin, and the two removals. Those assertions were true and they were
 * also the measurement that the event names were spelled on two floors —
 * `lib/heartbeat.js`' `attachLook` exists to be the only place either name
 * appears, and a test demanding the second spelling is a test that would fail
 * the unification it was written to protect.
 *
 * **SO THE ASSERTION MOVED UP A FLOOR RATHER THAN BEING DROPPED.** What the
 * pair DOES is asserted against a stand-in in `test/ui/viewmodel.test.ts`,
 * which can fire events; what this file can see is the seam — that the screen
 * goes through `attachLook`, tears down through the handle it returns, and has
 * stopped declaring its own copy of the number. A regression that re-inlines
 * either fails here.
 */
test('the document registers the look pair through heartbeat.js and owns its own clock', () => {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'conversations.js'), 'utf8');

  // THE TWO EVENTS, and they are not interchangeable: a tab switch fires
  // `visibilitychange`, a window raised without a tab change fires only
  // `focus`. Registering one leaves half the returns waiting for a THROTTLED
  // interval — browsers drop a hidden tab's `setInterval` to roughly once a
  // minute — which is the latency the item measured. `attachLook` registers
  // both or neither, which is how adopting half of it became unwritable.
  assert.match(
    source,
    /^import \{ LOOK_GAP_MS, attachLook, shouldPing \} from '\.\.\/lib\/heartbeat\.js';$/m,
    'the document must take the look pair, the gate and the gap from lib/heartbeat.js — all '
    + 'three, because a screen that imports the gate and re-writes the pair is the split this '
    + 'item closed',
  );
  assert.match(
    source,
    /detachLook = attachLook\(document, window, onLook\);/,
    'the open document must register the look pair through attachLook, with the real document '
    + 'and the real window',
  );

  // AND NEITHER NAME IS SPELLED HERE ANY MORE. This is the non-vacuous half:
  // the import above would still pass if the four hand-written lines sat beside
  // it, which is two copies of one fact and exactly the defect.
  assert.equal(
    /addEventListener\((['"])(visibilitychange|focus)\1/.test(source), false,
    'neither look event may be named in this screen again — `attachLook` is the one place either '
    + 'is spelled, and a second spelling here is the duplicate seq:29 removed',
  );
  assert.equal(
    /^\s*const LOOK_GAP_MS = /m.test(source), false,
    'the gap is imported, not re-chosen: a second declaration is a number that can drift from the '
    + 'argument for it',
  );

  // THE TEARDOWN IS THE RETURNED HANDLE. A document-level listener that
  // outlives the well is one per conversation opened in a session, all firing
  // on the next focus, and `tick`'s `isConnected` guard makes every one of them
  // harmless — which is exactly why the leak would never be noticed without it.
  const stop = /const stopFollowing = \(\) => \{[\s\S]*?\n  \};/.exec(source);
  assert.ok(stop !== null, 'stopFollowing is no longer a form this test can find');
  assert.ok(
    (stop as RegExpExecArray)[0].includes('detachLook()'),
    'stopFollowing must remove the look pair through the handle attachLook returned',
  );

  // THE RULE ITSELF DOES NOT MOVE. `onLook` asks `shouldPing` before it asks
  // the server, so a HIDDEN tab still never polls — `focus` fires on windows
  // whose tab is not in front, and that is precisely the case this must not
  // turn into a request.
  const look = /function onLook\(\)[\s\S]*?\n  \}/.exec(source);
  assert.ok(look !== null, 'onLook is no longer a function declaration this test can find');
  assert.ok(
    (look as RegExpExecArray)[0].includes('shouldPing(document.visibilityState)'),
    'onLook must keep `shouldPing` as the gate: this makes a VISIBLE tab faster and must never '
    + 'make a hidden one ask',
  );

  // **AND THE CLOCK IS STILL THE SHARED ONE, which is why `startLookTicks` is
  // not what this screen uses.** That export debounces against its own last
  // fire and has never heard of the scheduled `tick`; `askedAt` is written by
  // BOTH, so a look landing inside `LOOK_GAP_MS` of a scheduled `/tip` is
  // dropped. Adopting the look-only ticker here would turn one return to the
  // tab into two requests a quarter-second apart, at a one-second cadence.
  assert.ok(
    (look as RegExpExecArray)[0].includes('Date.now() - askedAt < LOOK_GAP_MS'),
    'the look tick must debounce against `askedAt` — the clock the SCHEDULED tick writes too — '
    + 'and not against a private one',
  );
  const tick = /const tick = \(\) => \{[\s\S]*?\n  \};/.exec(source);
  assert.ok(tick !== null, 'tick is no longer a form this test can find');
  assert.ok(
    (tick as RegExpExecArray)[0].includes('askedAt = Date.now()'),
    'the scheduled tick must stamp the shared clock, or the guard above has nothing to compare '
    + 'against and the pair of asks comes back',
  );
  // The teardown the gate ORDER exists for: `tick` asks `isConnected` BEFORE
  // `shouldPing`, so a hidden tab whose well was replaced still stops. Under
  // `startHeartbeat`, whose `beat` gates on visibility first, it would not —
  // which is the measured reason this screen kept its own interval.
  assert.ok(
    (tick as RegExpExecArray)[0].indexOf('scroll.isConnected')
      < (tick as RegExpExecArray)[0].indexOf('shouldPing'),
    'a well that is gone must end the follow even while the tab is hidden, so the isConnected '
    + 'teardown comes BEFORE the visibility gate',
  );
});
