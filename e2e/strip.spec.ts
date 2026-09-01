/**
 * **The status strip, driven — every segment the design of record declares.**
 *
 * On 2026-08-28 the mockup's strip carried 44 elements in 5 colours and the
 * app's carried 4 in 1, and the gap had gone a month without being measured
 * because nothing looked. `plan:walk seq:29b` asks for exactly this file:
 * "a browser test drives the strip and asserts the segment count against the
 * mockup's own, so the next divergence is caught rather than measured a month
 * later".
 *
 * **The unit is a STRING KEY, not an element count, and that is not a
 * weakening.** The mockup declares every state of the git group and the
 * context group at once and hides all but one, because it is a demo you click
 * to cycle; the app renders the ONE state it measured and cannot render the
 * others without inventing the values they interpolate — `t()` throws on a
 * missing substitution, which is the correct behaviour and the reason a
 * hidden `strip.branch` with no branch cannot exist here. Counting elements
 * would therefore compare a page showing seven git states against a page
 * showing one and fail for a reason that is not a defect.
 *
 * So the app tags every keyed segment it draws with `data-k`, this file drives
 * it through the states, and the union of what it drew is compared with what
 * the mockup declares. That is strictly stronger than a count: a count cannot
 * tell you WHICH segment went missing, and this names it.
 *
 * **Derived from the mockup's own bytes**, like `declared()` and
 * `declaredMonospace()` in `mockup.ts` and for the reason those are derived —
 * "a test that remembers a number fails for the wrong reason the next time a
 * screen gains a label". A segment added to the design of record fails here
 * until the app draws it, which is the direction `DEC-the-app-is-what-is-built
 * -the-mockup-is-history-and-a-gap` keeps: the mockup's second job is a list
 * of intended features not yet implemented, and a gap nobody is forced to look
 * at is a gap that rots.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { MOCKUP_PATH, MOCKUP_URL } from './mockup.ts';
import path from 'node:path';

/** The terminal bar's source, read for its field ids and nothing else. */
const TERMINAL_PATH = path.join(
  import.meta.dirname, '..', 'src', 'cli', 'commands', 'statusline-powerline.ts',
);

/**
 * Every `data-t` key the design of record's `<footer class="strip">` declares,
 * MINUS the mockup's own demo controls.
 *
 * The exclusion is STRUCTURAL rather than a name list: the reduced-transparency
 * checkbox lives inside `.noprint`, which is how this design already marks
 * "chrome that is not part of the product being drawn". A second demo control
 * added the same way is excluded the same way, with no edit here.
 */
function declaredStripKeys(): Set<string> {
  const html = readFileSync(MOCKUP_PATH, 'utf8');
  const open = html.indexOf('<footer class="strip">');
  const close = html.indexOf('</footer>', open);
  expect(open, 'the design of record must declare a footer.strip').toBeGreaterThan(-1);
  expect(close, 'the strip footer must be closed').toBeGreaterThan(open);
  let block = html.slice(open, close);
  const demo = block.indexOf('class="small noprint"');
  if (demo !== -1) block = block.slice(0, demo);
  const keys = new Set([...block.matchAll(/\sdata-t="([^"]+)"/g)].map((m) => m[1]!));
  // **AND THE HEADER'S PROVENANCE GROUP, which is the same subject in a
  // different row since `plan:walk seq:114`.** The repo group moved out of the
  // strip on 2026-08-31, and reading only the footer after that would have
  // QUIETLY SHRUNK this comparison by eight keys — every git state, plus the
  // group's own label — so the test would have gone on passing while nothing
  // checked whether the branch, the commit or the upstream chip were drawn at
  // all. A gate that gets weaker when a thing moves is a gate that rewards
  // moving it.
  for (const key of declaredHeaderProvenanceKeys()) keys.add(key);
  return keys;
}

/** Every key the design of record declares inside the HEADER's `.sgrp-repo`. */
function declaredHeaderProvenanceKeys(): Set<string> {
  const html = readFileSync(MOCKUP_PATH, 'utf8');
  const open = html.indexOf('<span class="sgrp sgrp-repo">');
  expect(open, 'the design of record must declare the repo provenance group').toBeGreaterThan(-1);
  // Bounded at the PICKERS and not at `</header>`: `.topr` carries `top.focus`
  // and `top.session`, which are the header's own controls and not provenance,
  // and sweeping them in here would demand the strip draw two keys that belong
  // to a dialog neither this file nor this app builds.
  const close = html.indexOf('<div class="topr">', open);
  expect(close, 'the repo group must sit inside the header, before the pickers').toBeGreaterThan(open);
  const block = html.slice(open, close);
  return new Set([...block.matchAll(/\sdata-t="([^"]+)"/g)].map((m) => m[1]!));
}

/**
 * **The ledger of what the strip declares and does not draw — EMPTY since
 * 2026-08-31, and it emptied by the segment leaving the design of record.**
 *
 * It held one entry, `strip.meas`: the "measured" chip beside the audit append
 * p95, unreachable because no endpoint on this read surface exposes an
 * aggregate over the audit log and the mockup's `0.55 ms` was a benchmark
 * figure out of `core/audit-db.ts`'s header rather than anything this server
 * took. The owner's status-bar ruling of 2026-08-31 cut the p95 and that chip
 * together — a developer diagnostic with no action attached, holding a
 * permanent place in the densest row this shell has — so the entry is gone
 * because the thing it tracked is, which is one of the two legitimate ways a
 * ledger shrinks. (The other is the gap being closed. Neither is deleting the
 * entry to go green.)
 *
 * Nothing else in the strip is in here, and a second entry would be a claim
 * that the design of record declares something the app cannot draw. The
 * question to answer first is whether the segment has a SOURCE, because
 * `plan:port seq:6` assumed two segments shared one blocker and there were
 * forty with several.
 */
const NOT_DRAWN_YET = new Set<string>([]);

interface Scenario {
  readonly name: string;
  readonly git?: unknown;
  readonly items?: number;
  /**
   * `/api/status`' health tally, which the corpus group's doctor count is read
   * off (owner ruling 2026-08-31). Defaults to a measured zero, which is what
   * every scenario written before that ruling means.
   */
  readonly health?: { errors: number; warnings: number; infos: number };
  /** `/api/status`' two waiting queues, which the review count is the sum of. */
  readonly queue?: { drafts: number; revisions: number };
  /** `null` fulfils nothing and lets the real endpoint answer. */
  readonly context?: unknown;
  /** The `corpus` block `/api/meta` and `/api/ping` both carry — the drift sweep. */
  readonly corpus?: unknown;
  readonly sessions?: unknown;
  /** Endpoints that are made to fail, by path fragment. */
  readonly fail?: readonly string[];
}

const KNOWN_SAMPLE = (state: string, used: number | null, size: number | null, pct: number | null) => ({
  receivedAt: new Date().toISOString(),
  model: 'Claude', version: '1.0.0',
  context: { state, usedTokens: used, windowSize: size, percent: pct },
});

/**
 * The handover block `/api/watch/context` serves (`plan:walk seq:118`).
 *
 * `thresholdPercent` is the number the occupancy bands are derived from, and 98
 * is what `handoverThresholdPercent()` resolves to with nothing configured —
 * the same value the live corpus is running on. It is passed as DATA here
 * rather than hard-coded into an expectation below, so a fixture at a different
 * threshold moves the boundaries the tests check with it.
 */
/**
 * The `rateLimits` block `/api/watch/context` serves — `classifyRateLimits`'
 * shape, which is the payload's own two windows read at the moment
 * `classifyContext` reads the context window.
 *
 * `resetsAt` is unix SECONDS and is set into the FUTURE from now rather than
 * pinned, because what the strip draws is a countdown computed at render time:
 * a fixture with a fixed epoch would go negative the day after it was written,
 * and the clamp that stops it would then be the only thing under test.
 */
const RATE = (five: number | null, seven: number | null) => ({
  fiveHour: five === null ? null : { usedPercent: five, resetsAt: Math.floor(Date.now() / 1000) + 7_200 },
  sevenDay: seven === null ? null : { usedPercent: seven, resetsAt: Math.floor(Date.now() / 1000) + 140_000 },
});

const HANDOVER = (verdict: string, extra: Record<string, unknown> = {}) => ({
  verdict,
  path: verdict === 'off' ? null : 'reports/V2-HANDOVER.md',
  askedAt: null,
  writtenAt: null,
  thresholdPercent: verdict === 'off' ? null : 98,
  ...extra,
});

/**
 * The states, chosen to reach every key exactly once between them rather than
 * to be exhaustive twice over — eight boots is already eight boots.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    name: 'on a branch, in sync, context known and healthy, handover not yet asked',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    // Both corpus counts non-zero, so the two doors are drawn and this file
    // sees them. `in-sync` deliberately draws NO upstream chip since the
    // 2026-08-31 ruling — the reassurance was cut — which is asserted on its
    // own further down rather than inferred from this union.
    health: { errors: 2, warnings: 3, infos: 9 },
    queue: { drafts: 4, revisions: 1 },
    corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'),
      // Both windows well inside their ceilings: the figures draw, the band
      // chip does not. That is the common case and it is meant to cost the row
      // nothing.
      rateLimits: RATE(16, 50),
      // ── THE SEVEN FIELDS THE STRIP GAINED ON 2026-09-01, all present at
      // once so line 1 and the cost group are drawn in full somewhere in this
      // walk. Their absent states are reached by the scenarios below.
      modes: 'high · think · 200k+',
      sessionName: 'walk lane',
      costUsd: 4.62,
      warmPercent: 91.4,
      focus: 'plan:walk seq:118',
      lastAudit: { state: 'known', op: 'subagent-stop', at: new Date().toISOString() },
    },
  },
  {
    name: 'the window is two thirds full and the ask has NOT fired — the pair, apart',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 140000, 200000, 70.0),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'),
      rateLimits: RATE(16, 50),
      // A log that has not moved for longer than a context sample stays
      // current, and a session with NO focus. Both are measured states and
      // both are drawn: `nothing logged for 3h20m` in the warn hue, and
      // `no focus set` — which the terminal leaves silent and this row has the
      // width to say.
      focus: null,
      lastAudit: { state: 'known', op: 'jit', at: new Date(Date.now() - 12_000_000).toISOString() },
    },
  },
  {
    name: 'differs from upstream, project-knowledge partial, NEARING the ask, handover acted on',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'differs' },
    items: 0,
    corpus: { drifted: true, aheadByMs: 240_000, scanned: 12, truncated: false },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 182000, 200000, 91.0),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 1 }, mycontextError: null,
      handover: HANDOVER('acted-on', {
        askedAt: new Date(Date.now() - 7_200_000).toISOString(),
        writtenAt: new Date(Date.now() - 7_000_000).toISOString(),
      }),
      // The seven-day window inside the warn band. **Banded by `fillLevel`
      // since 2026-09-01, not by `occupancyLevel`** — the ABSOLUTE bands, 60
      // and 85, which is what `rateLimitSegment` bands the same two windows
      // with in the terminal. A quota's own fullness has nothing to do with
      // when a handover is due, and banding it against the handover threshold
      // was one surface answering a question the other answered differently.
      // 70 is `warn` on those bands; 95 would now be `crit`, which is the
      // scenario below.
      rateLimits: RATE(16, 70),
      // A log with no rows at all. A MEASUREMENT — "nothing has been recorded"
      // — and not the same fact as a read that failed, which is below.
      lastAudit: { state: 'empty' },
    },
  },
  {
    name: 'no upstream, project-knowledge unavailable, AT the ask, handover IGNORED',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'no-upstream' },
    items: 1,
    corpus: { drifted: null, aheadByMs: null, scanned: 5000, truncated: true },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 197000, 200000, 98.5),
      mycontext: null, mycontextError: 'the audit log could not be read',
      handover: HANDOVER('ignored', { askedAt: new Date(Date.now() - 600_000).toISOString() }),
      // The five-hour window past the absolute crit band. One chip for both
      // windows, and it reports the WORSE of the two: the question a reader has
      // is "is either of them close", and two chips saying one word is the
      // crowding this pass exists to undo.
      rateLimits: RATE(99, 50),
      // "I could not tell", which is not a measurement and does not render as
      // one. Collapsing this into `empty` would make a broken projection look
      // like a quiet machine.
      lastAudit: { state: 'unreadable' },
    },
  },
  {
    name: 'local tip unreadable, context not yet known, handover feature OFF',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'unknown' },
    items: 2,
    context: {
      session: 's', sample: KNOWN_SAMPLE('not-yet-known', null, 200000, null),
      mycontext: null, mycontextError: 'no projection',
      handover: HANDOVER('off'),
    },
  },
  {
    name: 'detached HEAD, context unknown to this build, handover unverifiable',
    git: { detached: true, branch: null, commit: '7f3a91c9d2', upstream: 'unknown' },
    items: 3,
    context: {
      session: 's', sample: KNOWN_SAMPLE('unknown', null, null, null),
      mycontext: null, mycontextError: 'no projection',
      handover: HANDOVER('unverifiable', { askedAt: 'not-a-date' }),
    },
  },
  {
    name: 'a sample too old to be levelled is drawn WITHOUT a level',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 7,
    context: {
      session: 's',
      sample: {
        // Twenty-nine hours, which is the age the LIVE corpus's own tee reads.
        // Its occupancy is 60.1% — a comfortable green, about a window that no
        // longer exists. `plan:walk seq:117`: do not colour a stale figure as
        // though it were live.
        receivedAt: new Date(Date.now() - 29 * 3_600_000).toISOString(),
        model: 'Claude', version: '1.0.0',
        context: { state: 'known', usedTokens: 120200, windowSize: 200000, percent: 60.1 },
      },
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'),
    },
  },
  {
    name: 'not a git repository, and no status-line bridge sampled',
    git: null,
    items: 4,
    context: { session: 's', sample: null, mycontext: null, mycontextError: 'no projection' },
  },
  {
    name: 'a cold session has no live context number',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 5,
    sessions: { sessions: [], default: null },
  },
  {
    name: 'every endpoint the strip asks refuses to answer',
    fail: ['/api/meta', '/api/status', '/api/watch/context'],
  },
];

async function boot(page: Page, s: Scenario): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  for (const fragment of s.fail ?? []) {
    await page.route(`**${fragment}*`, (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'refused by the test' }),
    }));
  }
  if (s.git !== undefined) {
    await page.route('**/api/meta*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.2', git: s.git, staleCode: false,
        // The repository's own directory, which the header group's project
        // name is the basename of — the same derivation `mycontext statusline`
        // makes from the session directory Claude Code names.
        repoRoot: '/w/test_mycontext_plugin',
        // `corpus` rides `/api/meta` at first paint and `/api/ping` on the
        // heartbeat, both from `measureCorpusDrift`. Omitting it here is a
        // scenario in its own right: the strip must then say NOT KNOWN, never
        // "in step", because a page that has not been told is not a page that
        // measured nothing.
        ...(s.corpus === undefined ? {} : { corpus: s.corpus }),
      }),
    }));
  }
  if (s.items !== undefined) {
    await page.route('**/api/status*', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        version: '1.0.2', profile: 'default',
        items: { total: s.items, byCategory: {}, byStatus: {}, byOrigin: {} },
        reviewQueue: { drafts: s.queue?.drafts ?? 0, always: 0, globalLayerDrafts: 0 },
        pendingRevisions: { items: 0, fields: 0, revisions: s.queue?.revisions ?? 0 },
        health: s.health ?? { errors: 0, warnings: 0, infos: 0 },
      }),
    }));
  }
  if (s.context !== undefined) {
    await page.route('**/api/watch/context*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(s.context),
    }));
  }
  if (s.sessions !== undefined) {
    await page.route('**/api/sessions*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(s.sessions),
    }));
  }
  await page.reload();
  // The strip's four provenance groups are built synchronously by
  // `renderChrome()`; the segments inside them arrive with their fetches. Wait
  // for the last one to land rather than for `load`, which fires while every
  // group is still empty.
  // SIX in the strip since 2026-09-01, and the seventh in the header. The bar
  // is two rows now — identity above, state below — and the count is DERIVED
  // from the mockup rather than pinned here, for the reason every other number
  // in this file is: a test that remembers a number fails for the wrong reason
  // the next time the design of record gains a group.
  await expect(page.locator('#strip .slab')).toHaveCount(declaredStripGroups());
  await expect(page.locator('#hdrrepo .slab')).toHaveCount(1);
  await expect(page.locator('#ctx [data-k]').first()).toBeVisible();
  await expect(page.locator('#gitstate [data-k]').first()).toBeVisible();
  // AND WAIT FOR THE WHOLE DRAW, not for its first element. `drawContext`
  // fills `#ctx` and then calls `drawIdentity`, which fills line 1, the cost
  // group and the audit clock; `#auditlog` is the LAST box it touches. Waiting
  // on `#ctx`'s first child alone left a window in which a test could read a
  // half-drawn bar — which is what an intermittent failure in one browser
  // project per run turned out to be.
  await expect(page.locator('#auditlog').locator('*').first()).toBeAttached();
}

/**
 * How many provenance groups the design of record declares INSIDE the strip.
 *
 * Derived, never pinned. The strip went from three groups to six on 2026-09-01
 * when the bar split into two rows and gained the model, the window and the
 * cost; a remembered `3` would have failed that day for a reason that is not a
 * defect, and a remembered `6` will do the same the next time.
 */
function declaredStripGroups(): number {
  const html = readFileSync(MOCKUP_PATH, 'utf8');
  const open = html.indexOf('<footer class="strip">');
  const close = html.indexOf('</footer>', open);
  return [...html.slice(open, close).matchAll(/class="slab"/g)].length;
}

/** Every `data-k` the strip is currently drawing. */
function drawn(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('#strip [data-k], #hdrrepo [data-k]')]
    .map((el) => (el as HTMLElement).dataset['k'] ?? ''));
}

/**
 * Every FIELD id the strip is currently drawing — the header's provenance group
 * included, because the repo group is the same surface in a different row since
 * `plan:walk seq:114` and a gate that got weaker when a group moved would be a
 * gate that rewarded moving it.
 */
function fields(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('#strip [data-f], #hdrrepo [data-f]')]
    .map((el) => (el as HTMLElement).dataset['f'] ?? ''));
}

/**
 * **THE PARITY GATE'S BROWSER HALF: the terminal's fields, actually drawn.**
 *
 * `test/ui/strip-parity.test.ts` compares the two surfaces by scanning bytes,
 * which is fast and is what a unit gate can do. It cannot prove the strip
 * DRAWS what it declares — a `data-f` on a branch nothing reaches would satisfy
 * it. This does: it collects `[data-f]` out of a real page across every state
 * the file walks, and asserts the same subset.
 *
 * The terminal's set is derived from its own source here too, by the same one
 * form, so there is no list of field names in this file either.
 */
test('every field the terminal status line draws is drawn by the strip', async ({ app }) => {
  const { page } = app;
  const terminal = new Set(
    [...readFileSync(TERMINAL_PATH, 'utf8').matchAll(/(?:\bfield: |\.dataset\.f = )'([a-z0-9-]+)'/g)]
      .map((m) => m[1]!),
  );
  expect(terminal.size,
    'the terminal declared too few field ids to be reading the file — a scan that stops '
    + 'matching turns the subset assertion below into a tautology').toBeGreaterThan(9);

  const seen = new Set<string>();
  for (const scenario of SCENARIOS) {
    await boot(page, scenario);
    for (const f of await fields(page)) seen.add(f);
  }
  expect([...terminal].filter((f) => !seen.has(f)).sort(),
    'the terminal status line draws these and the strip never drew one of them in any state '
    + 'this file walks. The strip is a SUPERSET by the owner ruling of 2026-09-01, so the fix '
    + 'is to draw them — never to drop them from the terminal.').toEqual([]);
});

test('the strip draws every segment the design of record declares', async ({ app }) => {
  const { page } = app;
  const declared = declaredStripKeys();
  expect(declared.size, 'the mockup must declare strip keys — an empty set would make this vacuous')
    .toBeGreaterThan(15);

  const seen = new Set<string>();
  for (const scenario of SCENARIOS) {
    await boot(page, scenario);
    const keys = await drawn(page);
    expect(keys.length, `${scenario.name}: the strip drew no keyed segment at all`).toBeGreaterThan(0);
    for (const k of keys) seen.add(k);
  }

  const missing = [...declared].filter((k) => !seen.has(k) && !NOT_DRAWN_YET.has(k)).sort();
  expect(missing,
    'the design of record declares these strip segments and the app never drew one of them, in '
    + 'any of the states this file drives. Either draw it, or add it to NOT_DRAWN_YET with the '
    + 'reason it has no source — the ledger shrinks, it does not grow by default.').toEqual([]);

  // The other direction, so the ledger cannot rot: an entry that IS drawn is
  // an entry that should have been deleted.
  const stale = [...NOT_DRAWN_YET].filter((k) => seen.has(k)).sort();
  expect(stale, 'NOT_DRAWN_YET names a segment the app now draws — delete the entry').toEqual([]);
});

test('every provenance group is told apart by a WORD as well as by a colour', async ({ app }) => {
  const { page } = app;
  const groups = await page.evaluate(() => [
    ...document.querySelectorAll('#hdrrepo .slab, #strip .slab'),
  ].map((el) => ({ text: (el.textContent ?? '').trim(), colour: getComputedStyle(el).color })));

  // ── SEVEN GROUPS SINCE 2026-09-01, AND COLOUR IS NO LONGER ONE PER GROUP.
  //
  // It was four, and four colours, until the bar split into two rows and gained
  // the model, the window and the cost. Seven groups cannot have seven hues:
  // `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` assigns
  // five and this pass introduced none, so colour now groups the bar by SOURCE
  // and the WORD is what tells one group from another.
  //
  // That is not a weakening, and the old comment on the assertion below already
  // said why: `--gold` and `--ok` measure 1.04:1 against each other — the same
  // state to a dichromat, identical grey on a mono printer, one system tone
  // under forced-colors. The word was always the channel that survived all
  // three, and it is the one held to one-per-group here.
  //
  // The COUNT is derived — from the design of record's own slabs — for the
  // reason every other number in this file is derived.
  const expected = declaredStripGroups() + 1;
  expect(groups, 'the shell must carry every provenance group the design declares, the '
    + "header's repo group included").toHaveLength(expected);
  // Colour, because the owner asked for it: "use colors to diffrentiate
  // between properties". More than one, and never one for the whole bar — a
  // bar whose entire job is provenance rendered in a single colour makes a
  // reader parse a sentence to learn what a glance should say.
  expect(new Set(groups.map((g) => g.colour)).size,
    'the provenance groups must be coloured by source, in more than one hue').toBeGreaterThan(3);
  // AND a word, one per group, because colour alone is not a channel.
  expect(new Set(groups.map((g) => g.text)).size,
    'every provenance group needs its own label — 06-a11y.html: "a glyph AND a colour AND a '
    + 'name in the accessible string"').toBe(expected);
  for (const g of groups) expect(g.text, 'a group label may not be empty').not.toBe('');
});

test('the group colours survive forced-colors as words, not as hues', async ({ app }) => {
  const { page } = app;
  await page.emulateMedia({ forcedColors: 'active' });
  const words = await page.evaluate(() => [
    ...document.querySelectorAll('#hdrrepo .slab, #strip .slab'),
  ].map((el) => (el.textContent ?? '').trim()));
  await page.emulateMedia({ forcedColors: 'none' });
  expect(new Set(words).size,
    'forced-colors replaces every colour in the page with a system tone, so a bar differentiated '
    + 'by colour ALONE becomes one colour. The words are what is left, and there must be one per '
    + 'group.').toBe(declaredStripGroups() + 1);
});

test('an unmeasured segment says so, and offers the call again', async ({ app }) => {
  const { page } = app;
  await boot(page, SCENARIOS[SCENARIOS.length - 1]!);

  // The defect this replaces: both catch blocks left their span EMPTY, with no
  // retry, so one transient failure blanked the segment permanently — which is
  // what the owner saw as a status line that "is not constantly showing".
  for (const sel of ['#gitstate', '#stripitems', '#ctx']) {
    const text = ((await page.locator(sel).textContent()) ?? '').trim();
    expect(text, `${sel} went blank. A blank is indistinguishable from a failure to load, and a `
      + 'reader who cannot tell those apart stops trusting the surface '
      + '(STD-a-measured-zero-is-drawn-and-named, clause 3).').not.toBe('');
    expect(await page.locator(`${sel} [data-k="strip.unread"]`).count(),
      `${sel} must NAME its state rather than merely not being empty`).toBe(1);
    expect(await page.locator(`${sel} button`).count(),
      `${sel} must offer the call again — an unmeasured state with no way back is the permanent `
      + 'blank wearing a label').toBeGreaterThan(0);
  }

  // And the injections figure keeps its LABEL through the failure, so the
  // property the reader is owed is on screen even while its number is not. It
  // was two figures until 2026-08-31; the audit append p95 and its `measured`
  // chip were cut by the owner's ruling as a developer diagnostic with no
  // action attached, and the injection count was kept by the same ruling as the
  // at-a-glance proof the core feature fires.
  //
  // **`strip.unread`, not `strip.unmeasured`, since 2026-09-01.** The figure
  // gained its source that day — `/api/watch/context`'s `mycontext.injections`,
  // which this test has just made refuse — so the honest state here is the one
  // every other segment on that body is in: the call did not answer, and asking
  // again can fix it. `strip.unmeasured` is now what a call that ANSWERED and
  // could not count says, and there is no retry offered for that one because
  // there is nothing a retry would change.
  const audit = ((await page.locator('#auditstate').textContent()) ?? '');
  expect(audit, 'the audit group must still name the injections property').toContain('injections');
  expect(audit, 'the audit append p95 was cut — it may not come back through a label')
    .not.toContain('p95');
  expect(await page.locator('#auditstate [data-k="strip.unread"]').count(),
    'the injections figure rides /api/watch/context and must name its state when that refuses')
    .toBe(1);
  // And the call is offered again — from the audit CLOCK beside it, which rides
  // the same body and already draws the button. The figure deliberately does
  // not draw a second one: it is the same retry, and the row is the densest in
  // the shell. Asserted on the GROUP for that reason, not on the segment.
  expect(await page.locator('.sgrp-audit button').count(),
    'the audit group must offer the call again somewhere — one button for one call')
    .toBeGreaterThan(0);
});

test('the strip renders at its own type step, and the app matches the design of record', async ({ page }) => {
  // The design of record first — this is the surface the size was changed on.
  await page.goto(MOCKUP_URL);
  const mockup = await page.evaluate(() => {
    const el = document.querySelector('.strip');
    if (el === null) return null;
    const cs = getComputedStyle(el);
    const mono = document.querySelector('.strip .m');
    return {
      strip: cs.fontSize,
      token: getComputedStyle(document.documentElement).getPropertyValue('--fs-strip').trim(),
      mono: mono === null ? null : getComputedStyle(mono).fontSize,
    };
  });
  expect(mockup, 'the mockup must draw a .strip').not.toBeNull();
  expect(mockup!.token, 'the strip has its own type token, so a prose repaint cannot move it')
    .toBe('14px');
  // BOTH SIDES OF THE SAME REQUIREMENT, pinned as a range rather than as one
  // number, because the owner said both halves of it a day apart: "the font
  // should be bigger to be readable" at 13px, and then "maybe also the status
  // lines font is too big and setting it a little bit smaller will allow more
  // details to be presented" at 15px. Readable AND dense. 14px is the value
  // that sits between them, chosen only AFTER the two changes that recovered
  // the space — the no-bridge sentence cut to three words, and the provenance
  // row filled — so it is not a size compensating for crowding that has since
  // been removed.
  expect(parseFloat(mockup!.strip),
    'the strip may not go back to the 13px the owner could not read, and a prose token is how it '
    + 'would: --fs-0 IS 13px, which is what the strip used to point at').toBeGreaterThan(13);
  expect(parseFloat(mockup!.strip),
    'nor may it climb back to the size the owner called too big for the detail it has to carry')
    .toBeLessThan(15);
  expect(parseFloat(mockup!.mono ?? '0'),
    'a monospace run in the strip must not fall back under the old size through `.m`\'s .87em')
    .toBeGreaterThanOrEqual(13);
});

test('the app draws the strip at exactly the size the design of record does', async ({ app }) => {
  const { page } = app;
  const shipped = await page.evaluate(() => ({
    strip: getComputedStyle(document.querySelector('#strip')!).fontSize,
    token: getComputedStyle(document.documentElement).getPropertyValue('--fs-strip').trim(),
  }));
  const declaredToken = /--fs-strip:([^;]+);/.exec(readFileSync(MOCKUP_PATH, 'utf8'))?.[1]?.trim();
  expect(declaredToken, 'the mockup must declare --fs-strip').toBe('14px');
  expect(shipped.token, 'styles.css and the mockup carry one token, held byte-identical by '
    + 'test/ui/styles-parity.test.ts — this is the rendered half of that').toBe(declaredToken);
  expect(shipped.strip, 'the strip must render at its own token, not at the prose step').toBe('14px');
});

/**
 * **The row is tall enough for what it holds, and what it holds is centred in
 * it.** Owner, 2026-08-29: "the status line occures too low at the bottom,
 * increase its height a little."
 *
 * Measured before anything moved, because "too low" has two readings and only
 * one of them is a height. At 30px the content was already vertically CENTRED —
 * the group label's ink box sat 7px from the top of the row and 7px from the
 * bottom — so this was not a baseline fault, and a taller row would have been
 * the wrong answer if it had been. What the same measurement showed is that the
 * tallest element in the row was 31px inside a 30px row: the retry button and
 * the chips had no clearance at all and one already spilled a pixel past the
 * bottom edge of the window. Centred content with nothing around it is what
 * reads as jammed against the bottom.
 *
 * Both halves are asserted, so a later change cannot fix one by breaking the
 * other: a row that grows while the content drifts off centre fails here, and
 * so does a row that centres content it has no room for.
 */
test('the strip is tall enough for its controls and centres them in the row', async ({ app }) => {
  const m = await app.page.evaluate(() => {
    const strip = document.getElementById('strip')!;
    const box = strip.getBoundingClientRect();
    const kids = [...strip.querySelectorAll('*')]
      .map((el) => el.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.width > 0);
    const label = document.querySelector('#strip .slab')!;
    // MEASURED AGAINST THE LABEL'S OWN ROW, not against the whole strip.
    // The bar is two rows since 2026-09-01, so a label on the identity row is
    // correctly nowhere near the centre of the FOOTER — it is centred in the
    // 28px track it sits in, which is what the owner's "the text is cut" /
    // "moved up a little" reading was always about. Comparing ink against the
    // footer would assert that a two-row bar is a one-row bar.
    const row = label.closest('.striprow')!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(label);
    const ink = range.getBoundingClientRect();
    return {
      height: Math.round(box.height),
      tallest: Math.round(Math.max(...kids.map((b) => b.height))),
      inkTop: Math.round(ink.top - row.top),
      inkBottom: Math.round(row.bottom - ink.bottom),
      bottom: Math.round(box.bottom),
      viewport: window.innerHeight,
      top: Math.round(box.top),
      // The fourth track of `.app`'s own `grid-template-rows`, resolved by the
      // browser — the number the strip must be, read from the shell rather
      // than typed here.
      gridRow: Math.round(parseFloat(
        getComputedStyle(document.getElementById('app')!).gridTemplateRows.split(' ')[3] ?? '0',
      )),
      // AND THE CONTENT'S OWN EXTENT, which is what actually went wrong: on
      // 2026-09-01 an intermediate state of the two-row change had a 64px box
      // with 137px of content in it, escaping in BOTH directions. Geometry that
      // measures only the BOX cannot see that — `e2e/app-layout.spec.ts`'s
      // no-empty-band assertion passed over exactly this shape once already.
      contentTop: Math.round(Math.min(...kids.map((b) => b.top))),
      contentBottom: Math.round(Math.max(...kids.map((b) => b.bottom))),
    };
  });

  // ── DERIVED, NOT REMEMBERED, SINCE 2026-09-01. This read `toBe(38)`
  // while the bar was one row; it is two rows now — 28px of identity over
  // 38px of state — and a remembered number would have failed that day for a
  // reason that is not a defect, and again the next time a row moves. What the
  // assertion is actually for is that the strip is EXACTLY the row the shell
  // grid reserves for it: a bar taller than its box overflows a container that
  // reserved less, and whatever escapes lands behind content laid out as though
  // the strip ended where its box says it does.
  expect(m.height, 'the strip must be exactly the shell grid\'s fourth row').toBe(m.gridRow);
  expect(m.bottom, 'the strip ends at the bottom edge of the window, as the grid puts it')
    .toBe(m.viewport);
  // ── THE CONTAINER ENCLOSES ITS CONTENT. The owner reported the strip's
  // groups sitting above and below its own box, hidden behind cards laid out as
  // though the bar ended where it said it did. A parent not sized by its
  // children is the whole of that defect and everything else was a consequence,
  // so it is asserted directly rather than inferred from the height above.
  expect(m.contentTop, 'something in the strip starts ABOVE the strip')
    .toBeGreaterThanOrEqual(m.top);
  expect(m.contentBottom, 'something in the strip ends BELOW the strip — and the '
    + 'strip is the last grid row, so below it is outside the window')
    .toBeLessThanOrEqual(m.bottom);
  expect(m.height - m.tallest,
    'the tallest thing in the strip is a chip or the retry button. At 30px that measured 31px in '
    + 'a 30px row — no clearance, and a pixel of it outside the window. There must be room around '
    + 'it, or a centred row still reads as jammed against the bottom.').toBeGreaterThanOrEqual(6);
  // OPTICALLY centred, which is not geometrically centred. `align-items:center`
  // centres the LINE BOX, and a line box is not symmetrical about its ink: the
  // descender hangs below the baseline, so geometric centring leaves the
  // visible text sitting low with its descenders nearest the clipping edge.
  // The text must therefore sit AT or ABOVE the middle, with the leftover room
  // under it — "the text should be moved up a little", measured rather than
  // eyeballed.
  expect(m.inkTop, 'the text must not sit BELOW optical centre — that is the "too low at the '
    + 'bottom" the owner reported, and a taller row alone only adds space above it')
    .toBeLessThanOrEqual(m.inkBottom);
  expect(m.inkBottom - m.inkTop, 'moved up a LITTLE: an over-correction is the same fault '
    + 'upside down').toBeLessThanOrEqual(4);
});

/**
 * **The text is INSIDE its container — measured on the text, not on the row.**
 *
 * This is the assertion that distinguishes "the row is tall enough" from "the
 * glyphs are in it", and only the second is what a reader sees. It was missing:
 * `app-layout.spec.ts` asserts every shell row is occupied and that no
 * perspective element exceeds the viewport, and both of those pass while a
 * descender is being shaved off the bottom of the strip.
 *
 * The two `overflow:hidden` boxes are the ones that can actually cut — the
 * context sentence and the audit property names, where the hidden overflow is
 * what makes the ellipsis work and clips vertically as a side effect. Measured
 * at three viewport heights, because "in a full screen it appears a little bit
 * cut" is a claim about one size and has to be answered at several.
 */
test('no text in the strip is clipped by the box it sits in, at any window height', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(size);
    const cut = await page.evaluate(() => {
      const strip = document.getElementById('strip')!;
      const box = strip.getBoundingClientRect();
      const bad: string[] = [];
      const walk = (el: Element): void => {
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
            const range = document.createRange();
            range.selectNodeContents(child);
            const ink = range.getBoundingClientRect();
            if (ink.height === 0) continue;
            const where = `"${(child.textContent ?? '').trim().slice(0, 24)}"`;
            // Inside the strip itself…
            if (ink.top < box.top || ink.bottom > box.bottom) {
              bad.push(`${where} outside the strip by ${Math.max(box.top - ink.top, ink.bottom - box.bottom).toFixed(1)}px`);
            }
            // …and inside every ancestor that would clip it.
            for (let a: HTMLElement | null = child.parentElement; a !== null && strip.contains(a); a = a.parentElement) {
              if (getComputedStyle(a).overflowY === 'visible') continue;
              const ab = a.getBoundingClientRect();
              if (ink.top < ab.top || ink.bottom > ab.bottom) {
                bad.push(`${where} clipped by ${a.tagName}.${a.className} by ${Math.max(ab.top - ink.top, ink.bottom - ab.bottom).toFixed(1)}px`);
              }
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child as Element);
          }
        }
      };
      walk(strip);
      return bad;
    });
    expect(cut, `at ${size.width}x${size.height}: a run of text in the status strip is being cut `
      + 'by the box around it. The row height, the line-height of the two ellipsising boxes and '
      + 'the strip\'s own bottom padding are the three things that decide this — see the status '
      + 'strip rule in styles.css for what each of them was measured at.').toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

/**
 * **No group collapses, and the bar does not spill.**
 *
 * The strip has more to say than a 1280px window holds, so something has to
 * give, and WHICH thing gives is a decision rather than an accident. Owner,
 * 2026-08-29: "it includes a very long text that are not so important and other
 * more important info could not be seen like the context size left filled
 * percentage". So the audit group — two figures this read surface has no source
 * for — yields three times as fast as the context group, which carries the live
 * measurement this product is about.
 *
 * Both ends of that are asserted, because both have been wrong in a browser
 * during this task: with the audit group at `flex:none` the context sentence
 * measured ZERO px, and with it unfloored the audit group did. A group at zero
 * is the four-of-forty-four defect wearing a flexbox — the property is gone and
 * the reader is back to not knowing it exists.
 */
/**
 * **AT THE OWNER'S WIDTH, NOTHING IS SHORTENED.** Owner ruling 2026-09-01:
 * *"rebalance the fields between the lines to show their maximum lenght and
 * not truncated"*.
 *
 * Measured at 2273px on the day: row 1 was using 34% of the strip while row 2
 * was saturated, and exactly two segments were clipped — `in step with the
 * log` (104px shown, 168 needed) and `injections today` (37 shown, 101 needed).
 * 128px of unmet need beside 1,600px of unused space one row up.
 *
 * **Truncation is measured, not eyeballed**: an element whose `scrollWidth`
 * exceeds its `clientWidth` is one whose text does not fit its box, which is
 * exactly what an ellipsis means and is true whether or not one is rendered.
 *
 * This is a WIDTH-SPECIFIC assertion and deliberately so. The strip still
 * ellipsises at a narrow window — that is what the give-way order and the
 * titles are for, and `every provenance group keeps a width` below holds that
 * behaviour at 900px. What the owner ruled is that a bar with 1,600px spare
 * has no business shortening anything, and the fix for that is the balance of
 * the two rows rather than shorter strings.
 */
test('nothing in the strip is truncated at the width the owner reads it at', async ({ app }) => {
  const { page } = app;
  await boot(page, SCENARIOS[0]!);
  await page.setViewportSize({ width: 2273, height: 900 });
  const clipped = await page.evaluate(() => [
    ...document.querySelectorAll('#strip *, #hdrrepo *'),
  ].filter((el) => {
    const e = el as HTMLElement;
    if (e.offsetParent === null) return false;
    return e.scrollWidth > e.clientWidth + 1;
  }).map((el) => {
    const e = el as HTMLElement;
    const name = e.dataset['k'] ?? (e.id === '' ? e.className : e.id);
    return `${name}: ${e.clientWidth} shown, ${e.scrollWidth} needed`;
  }));
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(clipped, 'at 2273px the strip has room for every field at full length. A segment '
    + 'shortened here is a row that needs rebalancing, never a string that needs abbreviating.')
    .toEqual([]);
});

test('every provenance group keeps a width, and the strip never spills', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const m = await page.evaluate(() => {
      const strip = document.getElementById('strip')!;
      return {
        groups: [...strip.querySelectorAll('.sgrp')].map((el) => ({
          name: (el as HTMLElement).className,
          width: Math.round(el.getBoundingClientRect().width),
        })),
        spill: strip.scrollWidth - strip.clientWidth,
      };
    });
    expect(m.groups.length, `${size.width}px: every provenance group the design of record `
      + 'declares inside the footer — DERIVED, because the count went from three to seven '
      + 'in one evening and a remembered number fails for the wrong reason each time')
      .toBe(declaredStripGroups());
    for (const g of m.groups) {
      expect(g.width, `${size.width}px: ${g.name} collapsed to nothing. A group squeezed to zero `
        + 'has removed the property from the strip as surely as never building it').toBeGreaterThan(20);
    }
    expect(m.spill, `${size.width}px: the strip is wider than the window it sits in, so its tail `
      + '— the live-stream fault and the screen-refresh affordance — is off-screen').toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

/**
 * **Every CONTROL in the strip sits inside the strip — the same property as
 * the text one element along, which is why it is measured the same way.**
 *
 * Owner, 2026-08-29: "the refresh button when occures is displayed cutted at
 * the bottom ... on top of the refresh button apears New activity for this
 * screen." Measured: `#screenstale` was 49px tall in a 38px row, its top 5.8px
 * above the strip and its bottom 4.8px past the bottom edge of the WINDOW — the
 * strip's bottom is the viewport's bottom, so an overhang there is a clip.
 *
 * The cause was neither the row height nor the font: `app.js` builds the
 * affordance as a plain `<span>` holding a message and a `button.icon`, and
 * `.icon` is `display:grid` — a block. A block child inside a blockified flex
 * item takes its own line, so the message stacked ON TOP of the button. It has
 * been that way since the affordance was built, and at the old 30px row it
 * overhung by 8px more, so the taller strip did not cause it and had in fact
 * been reducing it. Neither element has a rule in the design of record, which
 * is how a control ships with no layout of its own.
 *
 * The two affordances are hidden until something happens, so this UNHIDES them:
 * a control that is only wrong when it appears is a control no passing test
 * ever looks at, which is the whole reason this was found by a person.
 */
test('every control in the strip sits inside the strip, at any window height', async ({ app }) => {
  const { page } = app;
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    const over = await page.evaluate(() => {
      // Both are built hidden and shown by events this test cannot raise on
      // demand. Showing them by hand measures the layout, which is the thing
      // under test; what raises them is `live-refresh.spec.ts`'s business.
      // `screenstale`/`screenstalesep` are NOT in this list any more: the
      // screen-refresh affordance moved out of the strip on 2026-08-31
      // (`plan:walk seq:116`, "move the refresh button to the screen") and its
      // separator was deleted with it. `e2e/live-refresh.spec.ts` measures it
      // in its new home, where it now belongs.
      for (const id of ['livesep', 'livestate']) {
        (document.getElementById(id) as HTMLElement).hidden = false;
      }
      const live = document.getElementById('livestate')!;
      if ((live.textContent ?? '') === '') live.textContent = 'the live stream ended';
      const strip = document.getElementById('strip')!;
      const box = strip.getBoundingClientRect();
      const bad: string[] = [];
      for (const el of strip.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        const above = box.top - r.top;
        const below = r.bottom - box.bottom;
        if (above > 0.5 || below > 0.5) {
          bad.push(`${el.tagName.toLowerCase()}#${(el as HTMLElement).id}.${(el as HTMLElement).className}`
            + ` overhangs by ${Math.max(above, below).toFixed(1)}px (height ${r.height.toFixed(1)} in a ${box.height}px row)`);
        }
      }
      // Put them back, so nothing after this test inherits a state the page
      // never actually reached.
      for (const id of ['livesep', 'livestate']) {
        (document.getElementById(id) as HTMLElement).hidden = true;
      }
      return bad;
    });
    expect(over, `at ${size.width}x${size.height}: something in the status strip is taller than `
      + 'the row it sits in. The strip is the last grid row, so its bottom IS the bottom of the '
      + 'window — an overhang there is not an overhang, it is a clip, and the reader sees a '
      + 'control with its bottom sliced off.').toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});

/* ══ `plan:walk seq:114` — THE REPO GROUP MOVED, AND THE WIDTHS SAY SO ═══ */

/**
 * **The rendered widths, not the markup's nesting** — which is what the task
 * asks for in those words, and for a reason: the repo group could be nested
 * inside the header and still be 372px of a 906px strip if the move were only
 * a DOM edit. What the owner reported was a crowded row and an unreadable
 * figure, and both of those are measurements.
 *
 * Measured on 2026-08-31, at the suite's pinned 1280px, over `.demo-corpus`:
 *
 *     before   repo 372.5 · corpus 136.4 · session 227.0 · audit 170.0
 *              #ctx 157.4 · header empty 668.1
 *     after    corpus 314.2 · session 347.1 · audit 170.0   (repo: 469.4, in the header)
 *              #ctx 277.5 · header empty 198.7
 *
 * The assertions below are the PROPERTIES those numbers were taken to
 * establish, not the numbers themselves — a test that remembers a width fails
 * for the wrong reason the next time a branch is renamed.
 */
test('the repo group renders in the header, at full branch and SHA, and not in the strip',
  async ({ app }) => {
    const { page } = app;
    await boot(page, {
      name: 'a long branch name, in sync',
      git: { branch: 'campaign/my-context-test', commit: '4945935abcdef0123456', upstream: 'in-sync' },
      items: 43,
      corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
      context: {
        session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
        mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
        handover: HANDOVER('not-asked'),
      },
    });

    const m = await page.evaluate(() => {
      const repo = document.getElementById('hdrrepo');
      const header = document.getElementById('topbar')!;
      const strip = document.getElementById('strip')!;
      return {
        inHeader: repo !== null && header.contains(repo),
        inStrip: repo !== null && strip.contains(repo),
        stripHasGit: strip.querySelector('#gitstate') !== null,
        branchText: (document.querySelector('#gitstate [data-k="strip.branch"]')?.textContent ?? '').trim(),
        headerSpill: header.scrollWidth - header.clientWidth,
      };
    });

    expect(m.inHeader, 'the repo group must render in the header — `index.html`\'s own comment has '
      + 'called this row "primitive 8: git where the avatar would have gone" since it was written')
      .toBe(true);
    expect(m.inStrip, 'and it must have LEFT the strip, not been duplicated into both').toBe(false);
    expect(m.stripHasGit, 'the strip must no longer carry #gitstate').toBe(false);
    // **The FULL branch name.** The ruling that shortened it to a last path
    // segment earlier the same day was a ruling about the strip's width, and
    // this row is not short of width — 1,692px of it was empty at 2304.
    expect(m.branchText, 'the branch keeps its full name in the header: `campaign/my-context-test` '
      + 'and `campaign/my-context-prod` are two branches and a reader should not have to hover')
      .toContain('campaign/my-context-test');
    // And the commit stays seven characters, which is the length git prints.
    expect(m.branchText, 'the short SHA is what tells a reader which build is being served')
      .toContain('4945935');
    expect(m.branchText, 'a forty-character SHA would be the only thing in this row nobody reads')
      .not.toContain('4945935abcdef0123456');
    expect(m.headerSpill, 'the header must not overflow now that it carries the group').toBe(0);
  });

/**
 * **The move pays the strip back, and the payment is what is asserted.**
 *
 * The task's own words: *"the strip's remaining groups are measured before and
 * after and the context figure is legible"*. `#ctx` measured 157.4px at 1280px
 * with the repo group in the row and 277.5px without it — and legibility is a
 * property of the figure, not of a number this file remembers, so what is
 * asserted is that the context group now holds MORE of the strip than any
 * other, at every width the shell is measured at.
 */
test('with the repo group gone, the context figure holds the largest share of the strip',
  async ({ app }) => {
    const { page } = app;
    // A KNOWN context, deliberately: over the bare fixture the session group is
    // three words ("no status-line bridge") and would lose a width comparison to
    // a group holding two em dashes, which would say nothing about whether the
    // move paid. What is under test is the SHARE the live measurement gets when
    // there IS one.
    await boot(page, {
      name: 'context known, for a width comparison that means something',
      git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
      items: 43,
      corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
      context: {
        session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
        mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
        handover: HANDOVER('not-asked'),
      },
    });
    for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 },
      { width: 900, height: 560 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      const m = await page.evaluate(() => {
        const strip = document.getElementById('strip')!;
        const widths: Record<string, number> = {};
        for (const g of strip.querySelectorAll('.sgrp')) {
          widths[(g as HTMLElement).className.replace('sgrp sgrp-', '')] =
            Math.round(g.getBoundingClientRect().width);
        }
        return {
          widths,
          ctx: Math.round((document.getElementById('ctx')?.getBoundingClientRect().width) ?? 0),
          drift: Math.round((document.getElementById('corpusdrift')?.getBoundingClientRect().width) ?? 0),
          spill: strip.scrollWidth - strip.clientWidth,
        };
      });
      const label = `${size.width}px`;
      expect(m.spill, `${label}: the strip is wider than the window it sits in`).toBeLessThanOrEqual(0);
      expect(m.widths['session'], `${label}: the session group must be the widest in the strip — it `
        + 'carries the live context measurement this product is about, and the repo group was moved '
        + `out of this row to give it back the width. Measured: ${JSON.stringify(m.widths)}`)
        .toBeGreaterThan(Math.max(m.widths['corpus'] ?? 0, m.widths['audit'] ?? 0));
      expect(m.ctx, `${label}: #ctx collapsed`).toBeGreaterThan(100);
      // The drift chip is a STATE, and a state squeezed to nothing has removed
      // the property as surely as never drawing it — the same floor argument
      // `.sgrp-audit`'s own 170px is written for.
      expect(m.drift, `${label}: the corpus drift chip was squeezed to nothing`).toBeGreaterThan(20);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
  });

/* ══ `plan:walk seq:117`, RE-RULED 2026-08-31 — TWO FIELDS, DRIVEN APART ══ */

/**
 * **The context figure answers TWO questions and they are drawn as two fields**
 * — owner ruling 2026-08-31, *"the context figure becomes TWO fields, not
 * one."*
 *
 *   ABSOLUTE FILL       how full the window is. ok / warn / crit on FIXED
 *                       bands (`CONTEXT_FILL_WARN_PERCENT` = 60,
 *                       `CONTEXT_FILL_CRIT_PERCENT` = 85). Does not move when
 *                       anybody reconfigures the handover threshold.
 *   HANDOVER PROXIMITY  how close the ask is. One GOLD marker at two weights,
 *                       fired by `occupancyLevel` against the SERVED
 *                       threshold, and SILENT below `T * 0.9`.
 *
 * **The pair is the point, and the case below that proves it is 91%.** At the
 * 98 this fixture serves, 91% is a nearly-full window (crit) whose ask has NOT
 * fired (91 < 98, and 91 > 88.2 so the gold marker is at its lighter weight).
 * One three-step ramp could not draw that: it had one colour for the two
 * readings, which is what the split exists to end.
 *
 * The boundaries are DERIVED here as they are in the product — the absolute
 * pair read off `lib/viewmodel.js`, the threshold read off the fixture's own
 * served `HANDOVER` — so a boundary moved in either place moves this test with
 * it. A test that remembers a number fails for the wrong reason the next time
 * one is configured.
 */
const FILL_CASES: readonly { pct: number; key: string; band: string }[] = [
  { pct: 0, key: 'strip.fillOk', band: 'ok' },
  { pct: 59.9, key: 'strip.fillOk', band: 'ok' },
  { pct: 60, key: 'strip.fillWarn', band: 'warn' },
  { pct: 70, key: 'strip.fillWarn', band: 'warn' },
  { pct: 84.9, key: 'strip.fillWarn', band: 'warn' },
  { pct: 85, key: 'strip.fillCrit', band: 'crit' },
  { pct: 91, key: 'strip.fillCrit', band: 'crit' },
  { pct: 99.7, key: 'strip.fillCrit', band: 'crit' },
];

/** `null` means the gold marker must be SILENT at that occupancy. */
const ASK_CASES: readonly { pct: number; key: string | null }[] = [
  { pct: 23.5, key: null },
  { pct: 70, key: null },
  { pct: 88.1, key: null },
  { pct: 88.2, key: 'strip.ctxWarn' },
  { pct: 91, key: 'strip.ctxWarn' },
  { pct: 97.9, key: 'strip.ctxWarn' },
  { pct: 98.0, key: 'strip.ctxCrit' },
  { pct: 99.7, key: 'strip.ctxCrit' },
];

const AT_OCCUPANCY = (pct: number): Scenario => ({
  name: `occupancy ${pct}%`,
  git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
  items: 43,
  corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
  context: {
    session: 's',
    sample: KNOWN_SAMPLE('known', Math.round(200000 * pct / 100), 200000, pct),
    mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
    handover: HANDOVER('not-asked'),
    rateLimits: RATE(16, 50),
  },
});

test('the absolute fill band is fixed, and does not move with the handover threshold',
  async ({ app }) => {
    const { page } = app;
    const colours = new Map<string, string>();
    for (const { pct, key, band } of FILL_CASES) {
      await boot(page, AT_OCCUPANCY(pct));
      const m = await page.evaluate((k) => {
        const el = document.querySelector(`#ctx [data-k="${k}"]`);
        if (el === null) {
          return {
            found: false, colour: '', text: '', title: '',
            drew: [...document.querySelectorAll('#ctx [data-k]')]
              .map((e) => (e as HTMLElement).dataset['k']).join(', '),
          };
        }
        return {
          found: true, colour: getComputedStyle(el).color,
          text: (el.textContent ?? '').trim(), title: (el as HTMLElement).title, drew: '',
        };
      }, key);
      expect(m.found, `${pct}% must draw ${key} — the absolute boundaries are 60 and 85 and `
        + `they are not the handover threshold. Drew: ${m.drew}`).toBe(true);
      // Colour is never the only carrier: a WORD, in the chip, that survives a
      // dichromat, a mono printer and forced-colors.
      expect(m.text, `${pct}%: the fill band must be a WORD as well as a hue`).not.toBe('');
      // And the title names the boundary it came from, so "filling" is not a
      // colour a reader has to take on trust — AND says the band is ABSOLUTE,
      // because the whole point is that it is not the threshold. Every one of
      // the three names its own boundary; only the two lower ones name the pair,
      // since `crit` has nothing above it to bound against.
      expect(m.title, `${pct}%: the title must say the band is absolute`).toContain('ABSOLUTE');
      expect(m.title, `${pct}%: the title must name the boundary it came from`)
        .toContain(band === 'ok' ? '60' : band === 'warn' ? '60' : '85');
      colours.set(band, m.colour);

      // The percentage itself is STILL A NUMBER on screen beside the chip.
      const sentence = await page.locator('#ctx [data-k="strip.ctx.known"]').textContent();
      expect(sentence ?? '', `${pct}%: the percentage must stay a number — colour is an addition `
        + 'to the reading, never a replacement for it').toContain(String(pct));
    }
    expect(new Set(colours.values()).size,
      'the three fill bands must be three distinct computed colours — a band a reader cannot tell '
      + `from its neighbour is a band that says nothing. Got: ${JSON.stringify([...colours])}`)
      .toBe(3);
  });

test('the handover ask is a GOLD marker at two weights, and is silent below the warn band',
  async ({ app }) => {
    const { page } = app;
    const seen = new Map<string, { colour: string; text: string; bold: number }>();
    for (const { pct, key } of ASK_CASES) {
      await boot(page, AT_OCCUPANCY(pct));
      const m = await page.evaluate(() => {
        const el = document.querySelector('#ctx [data-k="strip.ctxWarn"], #ctx [data-k="strip.ctxCrit"]');
        return el === null
          ? { key: null as string | null, colour: '', text: '', title: '', bold: 0 }
          : {
            key: (el as HTMLElement).dataset['k'] ?? null,
            colour: getComputedStyle(el).color,
            text: (el.textContent ?? '').trim(),
            title: (el as HTMLElement).title,
            bold: el.querySelectorAll('b').length,
          };
      });
      expect(m.key, `${pct}%: the handover marker must ${key === null ? 'be SILENT' : `draw ${key}`}`
        + ' — below the warn band it says nothing at all, because "well below the handover ask" is '
        + 'the common case and therefore free of information. That is the same ruling that cut '
        + '`strip.inSync` from the repo group.').toBe(key);
      if (key === null) continue;
      expect(m.text, `${pct}%: the marker must be a WORD, not a hue alone`).not.toBe('');
      expect(m.title, `${pct}%: the marker owes the reader the threshold it came from`)
        .toContain('98');
      seen.set(key, { colour: m.colour, text: m.text, bold: m.bold });
    }

    const warn = seen.get('strip.ctxWarn')!;
    const crit = seen.get('strip.ctxCrit')!;
    // ONE HUE, TWO WEIGHTS. `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-
    // crit-and-warn` assigns all five meaning-hues, and two full ramps beside
    // each other would need a sixth and a seventh. Gold already means "this
    // wants your attention", and an ask is a request rather than a severity.
    expect(crit.colour, 'both weights of the handover marker are GOLD — a second hue here would be '
      + 'a sixth meaning-colour, which the hue budget does not have').toBe(warn.colour);
    // So the two states are told apart by the WORD and by the emphasis, which
    // are the carriers that survive a dichromat, a mono printer and
    // forced-colors — never by the hue, because there is only one.
    expect(crit.text, 'the two weights must not say the same thing').not.toBe(warn.text);
    expect(crit.bold, 'the AT-the-ask weight is emphasised, and the emphasis is markup — a `{b:}` '
      + 'run in the string table — so it survives a monochrome printer').toBeGreaterThan(0);
    expect(warn.bold, 'the approaching weight is the quieter one').toBe(0);
  });

test('a full window and a fired ask are DIFFERENT facts, and 91% is where that shows',
  async ({ app }) => {
    const { page } = app;
    await boot(page, AT_OCCUPANCY(91));
    // Awaited as LOCATORS before anything is read off the page: `boot` waits for
    // the context group's FIRST keyed segment, and the chips arrive in the same
    // `replaceChildren` as that segment only when the fetch that carries them
    // has resolved. A bare `evaluate` here is a single synchronous read that can
    // legitimately land one frame early — it did, inside the full file and never
    // alone, which is the signature of a race rather than a defect.
    await expect(page.locator('#ctx [data-k="strip.fillCrit"]')).toBeAttached();
    await expect(page.locator('#ctx [data-k="strip.ctxWarn"]')).toBeAttached();
    const m = await page.evaluate(() => {
      const fill = document.querySelector('#ctx [data-k="strip.fillCrit"]');
      const ask = document.querySelector('#ctx [data-k="strip.ctxWarn"]');
      const fired = document.querySelector('#ctx [data-k="strip.ctxCrit"]');
      return {
        fill: fill === null ? '' : getComputedStyle(fill).color,
        ask: ask === null ? '' : getComputedStyle(ask).color,
        firedDrawn: fired !== null,
        drew: [...document.querySelectorAll('#ctx [data-k]')]
          .map((e) => (e as HTMLElement).dataset['k']).join(', '),
      };
    });
    // The reading this whole split exists to make possible: the window is
    // nearly full AND the ask has not fired. One ramp had one colour for both.
    expect(m.fill, '91% is past the absolute crit band of 85, so the fill chip must be drawn. '
      + `Drew: ${m.drew}`).not.toBe('');
    expect(m.ask, '91% is past 88.2 — nine tenths of the served threshold of 98 — so the gold '
      + 'marker must be drawn at its lighter weight').not.toBe('');
    expect(m.firedDrawn, '91% is BELOW the served threshold of 98, so the ask has not fired and '
      + 'the emphasised weight must not be drawn').toBe(false);
    expect(m.fill, 'the two fields must be two colours, or a reader cannot tell "the window is '
      + 'full" from "the ask has fired" — which is the entire reason there are two of them')
      .not.toBe(m.ask);
  });

/**
 * **A stale figure is drawn WITHOUT a level**, and that is visibly not-a-level
 * rather than a fourth level.
 *
 * `plan:walk seq:117`: *"Do not colour a stale figure as though it were live.
 * The strip already discloses age — a fossil rendered in confident red is worse
 * than an uncoloured number."* The fixture is the live corpus's own state: 60.1%
 * received 29 hours ago, which would otherwise be a comfortable green about a
 * window that no longer exists.
 */
test('a context sample too old to be current is drawn without a level', async ({ app }) => {
  const { page } = app;
  await boot(page, SCENARIOS.find((x) => x.name.includes('too old'))!);
  const m = await page.evaluate(() => {
    const stale = document.querySelector('#ctx [data-k="strip.ctxLevelStale"]');
    const levels = ['strip.ctxOk', 'strip.ctxWarn', 'strip.ctxCrit']
      .filter((k) => document.querySelector(`#ctx [data-k="${k}"]`) !== null);
    const neutral = document.querySelector('#strip .chip.unmeas');
    return {
      staleDrawn: stale !== null,
      levels,
      staleColour: stale === null ? '' : getComputedStyle(stale).color,
      neutralColour: neutral === null ? '' : getComputedStyle(neutral).color,
      sentence: (document.querySelector('#ctx [data-k="strip.ctx.known"]')?.textContent ?? '').trim(),
    };
  });
  expect(m.staleDrawn, 'a stale reading must SAY it is unplaced rather than going quiet — a blank '
    + 'is indistinguishable from a failure to load').toBe(true);
  expect(m.levels, 'a stale reading must carry no level at all').toEqual([]);
  expect(m.staleColour, 'the unplaced state wears the strip\'s existing NEUTRAL, so it reads as '
    + 'not-a-level rather than as a fourth level').toBe(m.neutralColour);
  // The number and its age both stay: the reader is told what was measured and
  // when, and only the LEVEL is withheld.
  expect(m.sentence).toContain('60.1');
  expect(m.sentence).toContain('ago');
});

/* ══ `plan:walk seq:118` — THE HANDOVER VERDICT, ALL FIVE STATES ═════════ */

/**
 * **A session driven into each state, rather than an assertion that the element
 * exists** — the task's own acceptance, in those words.
 *
 * `ignored` is the one that matters most and the one a reader will never think
 * to check for, so what is asserted about it is not merely that it is drawn but
 * that it is VISIBLY DISTINCT from `acted-on` rather than a quieter version of
 * it — different key, different word, different hue.
 */
const VERDICTS: readonly { verdict: string; key: string; extra?: Record<string, unknown> }[] = [
  { verdict: 'acted-on', key: 'strip.hoActed', extra: {
    askedAt: new Date(Date.now() - 7_200_000).toISOString(),
    writtenAt: new Date(Date.now() - 7_000_000).toISOString(),
  } },
  { verdict: 'ignored', key: 'strip.hoIgnored', extra: {
    askedAt: new Date(Date.now() - 600_000).toISOString(),
  } },
  { verdict: 'not-asked', key: 'strip.hoNotAsked' },
  { verdict: 'off', key: 'strip.hoOff' },
  { verdict: 'unverifiable', key: 'strip.hoUnknown' },
];

test('the strip draws the handover verdict it is SERVED, in every state', async ({ app }) => {
  const { page } = app;
  const seen = new Map<string, { colour: string; text: string }>();
  for (const { verdict, key, extra } of VERDICTS) {
    await boot(page, {
      name: `handover ${verdict}`,
      git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
      items: 43,
      corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
      context: {
        session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
        mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
        handover: HANDOVER(verdict, extra ?? {}),
      },
    });
    const m = await page.evaluate((k) => {
      const el = document.querySelector(`#ctx [data-k="${k}"]`);
      return el === null
        ? { found: false, colour: '', text: '', title: '' }
        : {
          found: true,
          colour: getComputedStyle(el).color,
          text: (el.textContent ?? '').trim(),
          title: (el as HTMLElement).title,
        };
    }, key);
    expect(m.found, `the served verdict "${verdict}" must draw ${key} — none of the five may be `
      + 'silent, and `off` is a different fact from `not-asked` rather than a spelling of it')
      .toBe(true);
    expect(m.text, `${verdict}: the state must be a WORD, not a hue alone`).not.toBe('');
    expect(m.title, `${verdict}: the chip owes the reader the reasoning behind it`).not.toBe('');
    seen.set(verdict, { colour: m.colour, text: m.text });
  }

  const acted = seen.get('acted-on')!;
  const ignored = seen.get('ignored')!;
  expect(ignored.colour, '`ignored` must be VISIBLY DISTINCT from `acted-on` rather than a quieter '
    + 'shade of it: it is the state a reader would never think to go and check for, and this '
    + 'project has already paid once for a guarantee that read exactly like the mechanism working')
    .not.toBe(acted.colour);
  expect(ignored.text).not.toBe(acted.text);
  // `off` and `not-asked` are the second pair that must not collapse: one means
  // nobody configured this, the other means somebody did and the moment never
  // came.
  expect(seen.get('off')!.text).not.toBe(seen.get('not-asked')!.text);
});

/**
 * **`acted-on` carries WHEN**, because the value of the state is knowing the
 * handover is CURRENT — not that something happened to it once. Computed from
 * the served `writtenAt` at render time, so it ticks, exactly as the "as of …
 * ago" on the context sentence beside it does.
 */
test('the acted-on verdict says when the handover was written', async ({ app }) => {
  const { page } = app;
  await boot(page, {
    name: 'handover acted on two hours ago',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('acted-on', {
        askedAt: new Date(Date.now() - 7_400_000).toISOString(),
        writtenAt: new Date(Date.now() - 7_200_000).toISOString(),
      }),
    },
  });
  await expect(
    page.locator('#ctx [data-k="strip.hoActed"]'),
    'the handover is only useful if the reader can tell whether it is current, and "2h" is what '
    + 'says so',
  ).toContainText('2h');
});

/* ══ THE CORPUS DRIFT CHIP — THREE STATES, AND THE THIRD IS NOT "NO" ═════ */

/**
 * `measureCorpusDrift` landed on 2026-08-31 and both `/api/ping` and
 * `/api/meta` served its answer; nothing drew it, and its six string keys sat
 * in both tables. The third state is the load-bearing one: a truncated sweep
 * that found nothing answers `drifted: null`, and a surface drawing that must
 * say "not known" and may never say "no".
 */
const DRIFTS: readonly { name: string; corpus: unknown; key: string }[] = [
  {
    name: 'nothing under items/ is newer than the log',
    corpus: { drifted: false, aheadByMs: null, scanned: 42, truncated: false },
    key: 'strip.corpusInStep',
  },
  {
    name: 'an item was edited outside the log four minutes ago',
    corpus: { drifted: true, aheadByMs: 240_000, scanned: 42, truncated: false },
    key: 'strip.corpusDrifted',
  },
  {
    name: 'the sweep hit its bound and found nothing, which is NOT nothing',
    corpus: { drifted: null, aheadByMs: null, scanned: 5000, truncated: true },
    key: 'strip.corpusDriftUnknown',
  },
];

test('the corpus group draws the drift the heartbeat measured, in all three states',
  async ({ app }) => {
    const { page } = app;
    for (const { name, corpus, key } of DRIFTS) {
      await boot(page, {
        name,
        git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
        items: 43,
        corpus,
        context: {
          session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
          mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
          handover: HANDOVER('not-asked'),
        },
      });
      await expect(
        page.locator(`#corpusdrift [data-k="${key}"]`),
        `${name}: the corpus group must draw ${key}`,
      ).toBeVisible();
      await expect(
        page.locator('#corpusdrift .chip'),
        `${name}: exactly one drift state at a time`,
      ).toHaveCount(1);
      const title = await page.locator('#corpusdrift .chip').getAttribute('title');
      expect(title ?? '', `${name}: the chip owes the reader why`).not.toBe('');
    }
  });

/**
 * **A page nobody has told is NOT a page that measured nothing.**
 *
 * `/api/meta` answering without a `corpus` block at all — an older server, or a
 * refusal — must leave the strip saying NOT KNOWN. Drawing "in step with the
 * log" there would be the exact claim `core/corpus-drift.ts` refuses to make
 * from a truncated sweep, made one layer up by a client instead.
 */
test('with nothing served, the drift chip says not known rather than in step', async ({ app }) => {
  const { page } = app;
  await boot(page, {
    name: 'a server that carries no corpus block',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'),
    },
  });
  await expect(page.locator('#corpusdrift [data-k="strip.corpusDriftUnknown"]')).toBeVisible();
  await expect(page.locator('#corpusdrift [data-k="strip.corpusInStep"]')).toHaveCount(0);
});

/* ══ THE 2026-08-31 STATUS-BAR PASS: WHAT WAS CUT, AND WHAT REPLACED IT ══ */

/**
 * **A branch that matches its upstream draws its NAME and nothing else.**
 *
 * Owner ruling: *"in sync with origin/<branch>" occupies an expensive place —
 * keep the branch NAME and commit, drop the reassurance.* The verdict now costs
 * this row nothing in the common case and still carries the whole signal,
 * because the only state it draws is a state worth drawing.
 *
 * The three CONDITIONS are asserted alongside it, so "nothing is drawn" cannot
 * quietly become "nothing is ever drawn" — which is the failure mode of every
 * field that earns its place by being silent.
 */
test('the in-sync reassurance is gone, and the conditions that replaced it are not',
  async ({ app }) => {
    const { page } = app;
    const base = {
      items: 43,
      corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
      context: {
        session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
        mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
        handover: HANDOVER('not-asked'), rateLimits: RATE(16, 50),
      },
    };
    const drewFor = async (upstream: string): Promise<string[]> => {
      await boot(page, {
        ...base, name: `upstream ${upstream}`,
        git: { branch: 'main', commit: '7f3a91c9d2', upstream },
      });
      return page.evaluate(() => [...document.querySelectorAll('#gitstate [data-k]')]
        .map((el) => (el as HTMLElement).dataset['k'] ?? ''));
    };

    expect(await drewFor('in-sync'),
      'a branch in sync with its upstream draws its NAME and its COMMIT — identity, which stays — '
      + 'and no chip at all. "in sync with origin/main" is true in the common case and therefore '
      + 'free of information, and it was holding a permanent place in the most expensive row this '
      + 'shell has.').toEqual(['strip.branch']);

    // And every state that IS worth acting on still speaks. A field that earns
    // its place by silence has to be shown still capable of noise.
    expect(await drewFor('differs')).toEqual(['strip.branch', 'strip.differs']);
    expect(await drewFor('no-upstream')).toEqual(['strip.branch', 'strip.noUpstream']);
    expect(await drewFor('unknown')).toEqual(['strip.branch', 'strip.unknownTip']);
  });

/**
 * **The two corpus counts are DOORS, and they cost nothing to serve.**
 *
 * The ruling attached a condition to the doctor count: *"DO NOT run a full
 * doctor sweep on the heartbeat … if you cannot make it cheap, do not build
 * it."* It is not run. `/api/status` — the one call the corpus group already
 * makes for the item count — has served `health` and `reviewQueue` beside that
 * count since it was written, so both numbers ride a response already on the
 * wire. What this test can hold is the OTHER half: that they are read from that
 * response and that pressing them goes somewhere.
 */
test('the doctor and review counts are drawn from /api/status, and both are doors',
  async ({ app }) => {
    const { page } = app;
    await boot(page, SCENARIOS[0]!);

    const doc = page.locator('#corpusnotes [data-k="strip.doc"]');
    await expect(doc, 'the doctor count must be drawn').toBeVisible();
    // errors + warnings, and NOT infos: an `info` finding is a remark, and a
    // count that includes remarks is a count nobody acts on. Same arithmetic as
    // the rail badge, from one spelling.
    await expect(doc, 'errors + warnings, the same two the rail badge sums').toContainText('5');
    expect(await doc.evaluate((el) => el.tagName.toLowerCase()),
      'a count that is not a door is only half of it').toBe('button');

    const queue = page.locator('#corpusnotes [data-k="strip.queue"]');
    await expect(queue, 'the review count must be drawn when it is non-zero').toBeVisible();
    await expect(queue, 'both queues — drafts to promote and revisions to rule on').toContainText('5');

    await doc.click();
    await expect.poll(() => page.evaluate(() => location.hash),
      { message: 'the doctor count did not open Doctor' }).toBe('#/doctor');
    await boot(page, SCENARIOS[0]!);
    await page.locator('#corpusnotes [data-k="strip.queue"]').click();
    await expect.poll(() => page.evaluate(() => location.hash),
      { message: 'the review count did not open the review queue' }).toBe('#/work');
  });

/**
 * **An empty review queue draws nothing; a doctor count of zero draws ZERO.**
 *
 * They differ on purpose. A corpus with no findings is a MEASURED ZERO and the
 * reader is entitled to it — *"no findings"* is the answer most worth having
 * and a blank cannot give it
 * (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, clause 1).
 * An empty review queue is not a finding about the corpus at all: it is the
 * absence of a request, and the ruling says that one *"renders only when
 * non-zero"*.
 */
test('a zero doctor count is drawn and named; an empty review queue is not drawn',
  async ({ app }) => {
    const { page } = app;
    await boot(page, {
      name: 'a clean corpus with nothing waiting',
      git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
      items: 43,
      health: { errors: 0, warnings: 0, infos: 4 },
      queue: { drafts: 0, revisions: 0 },
      corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
      context: {
        session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
        mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
        handover: HANDOVER('not-asked'), rateLimits: RATE(16, 50),
      },
    });
    await expect(page.locator('#corpusnotes [data-k="strip.doc"]'),
      'a measured zero is drawn and named — "no findings" is the answer a reader most wants and '
      + 'a blank cannot give it').toContainText('0');
    await expect(page.locator('#corpusnotes [data-k="strip.queue"]'),
      'an empty review queue is the absence of a request, not a finding, and the ruling says it '
      + 'renders only when non-zero').toHaveCount(0);
  });

/**
 * **The account's two rate-limit windows: a figure, a countdown, and a band
 * that is silent until it matters.**
 *
 * The owner's seven-day window read 49% and nothing on any surface said so.
 * `resets_at` is unix SECONDS and the countdown is what makes the figure
 * actionable rather than merely alarming, so both halves are asserted.
 */
test('the rate-limit windows draw a figure and a countdown, and band silently below the warn band',
  async ({ app }) => {
    const { page } = app;
    await boot(page, SCENARIOS[0]!);
    const five = page.locator('#limitstate [data-k="strip.rl5"]');
    const seven = page.locator('#limitstate [data-k="strip.rl7"]');
    await expect(five, 'the five-hour window must be drawn').toContainText('16');
    await expect(seven, 'the seven-day window must be drawn').toContainText('50');
    // The countdown, computed at render time from `resetsAt`. Matched as a
    // SHAPE and not as `2h`: the fixture sets the reset two hours out when the
    // module loads and `formatAge` floors, so a suite that takes eight minutes
    // to reach this test legitimately renders `1h`. A test that remembers a
    // number fails for the wrong reason, and here the wrong reason would be
    // its own runtime.
    await expect(five, 'a percentage with no reset time is alarming rather than actionable')
      .toContainText(/\d+[smhd]/);
    // Both windows well inside their ceilings: no chip, no width, nothing said.
    await expect(page.locator('#limitstate [data-k="strip.rlNear"], #limitstate [data-k="strip.rlAt"]'),
      'a limit nowhere near its ceiling changes nothing a reader does next, so it draws no chip')
      .toHaveCount(0);
  });

/**
 * **Absent is silence, never a placeholder.** `rate_limits` is optional in the
 * payload and either window inside it can be missing on its own. A `0%`
 * invented for a window nobody reported would be a claim about an account that
 * was never made — which is the opposite failure from the blank
 * `STD-a-measured-zero-is-drawn-and-named` forbids, and the ruling names it:
 * *"treat as possibly-absent; render nothing rather than a placeholder."*
 */
test('a window the payload did not carry draws nothing at all', async ({ app }) => {
  const { page } = app;
  await boot(page, {
    name: 'seven-day window served, five-hour window absent',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'), rateLimits: RATE(null, 50),
    },
  });
  await expect(page.locator('#limitstate [data-k="strip.rl7"]')).toContainText('50');
  await expect(page.locator('#limitstate [data-k="strip.rl5"]'),
    'a window nobody reported is not a window measured at 0%').toHaveCount(0);

  await boot(page, {
    name: 'no rate_limits block at all',
    git: { branch: 'main', commit: '7f3a91c9d2', upstream: 'in-sync' },
    items: 43,
    corpus: { drifted: false, aheadByMs: null, scanned: 12, truncated: false },
    context: {
      session: 's', sample: KNOWN_SAMPLE('known', 47000, 200000, 23.5),
      mycontext: { tokens: 6200, injections: 3, unrecorded: 0 }, mycontextError: null,
      handover: HANDOVER('not-asked'),
    },
  });
  await expect(page.locator('#limitstate [data-k="strip.rl5"], #limitstate [data-k="strip.rl7"]'),
    'an older server that carries no rateLimits at all must leave the strip silent about the '
    + 'account, not claim two zeroes').toHaveCount(0);
});
