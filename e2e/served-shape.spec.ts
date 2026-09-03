/**
 * **What the endpoint returned, against what the screen drew — the shape
 * assertions the owner ruled and the suite did not have.**
 *
 * Owner ruling, 2026-08-22, on
 * `TASK-point-the-e2e-suite-at-the-served-corpus-not-only-at-the`:
 *
 *   *"assert SHAPES, not a pinned snapshot. So every assertion is about the
 *   relationship between what the endpoint returned and what the screen drew —
 *   a row per item the API listed, a count that matches the payload, an empty
 *   state that appears only when the endpoint says empty … No assertion names
 *   an id, a title or a number that lives in the corpus."*
 *
 * That ruling was recorded as met and was not. Verified 2026-08-26: the suite
 * genuinely reaches the served corpus — `e2e/app.ts` starts a real server over
 * `.demo-corpus` and fifteen specs consume it — but **no spec compared a drawn
 * count against a payload count.** The strongest corpus assertion in the suite
 * was a text-length floor: `body.innerText.length > 200`
 * (`e2e/app-layout.spec.ts`'s first test). A screen that drew every row twice,
 * dropped half of them, or rendered somebody else's payload satisfies that
 * floor, and so does a screen whose numbers are furniture.
 *
 * ── WHY A COUNT AND NOT A CONTENT MATCH ────────────────────────────────────
 *
 * Because the corpus grows. An assertion naming an id or a total is a fact
 * about the fixture on the day it was written, and `screen-parity.spec.ts`'s
 * header has this project's own account of what that costs: a gate measured
 * against a corpus that moved reports code gaps that are only data gaps. A
 * relationship between two things measured in the SAME run cannot go stale,
 * and it cannot pass by accident over a screen that rendered nothing — which
 * a floor, a snapshot and an element census can all do.
 *
 * ── THE COST, HANDLED HERE RATHER THAN DISCOVERED LATER ────────────────────
 *
 * The task states it: *"a failure says 'the row count did not match the
 * payload' rather than 'CONST-… is missing', so every assertion needs a
 * message carrying both numbers and the query that produced them. A shape
 * assertion with a bare message is the flakiest thing in a suite."* Every
 * `expect` below therefore carries the endpoint it read, the number the
 * payload held and the number the page drew.
 *
 * ── THE PAYLOAD IS FETCHED THROUGH THE PAGE'S OWN DOOR ─────────────────────
 *
 * `window.myctx.api` — the same function every screen calls, carrying the same
 * token through the same refusal handling. Two reasons, and neither is
 * convenience. A second HTTP client in the test would authenticate differently
 * from the app and could succeed where the app fails, which is the failure
 * mode this whole file exists to end. And a read through any other door would
 * be a read the SERVER never associated with this page.
 *
 * **It is a second read of the same endpoint, and that is deliberate.** The
 * screen has already fetched; this fetches again and compares. Over a corpus
 * nothing is writing to, the two reads answer identically — the read surface
 * performs no writes (`test/ui/server-e2e.test.ts` snapshots every byte under
 * the workspace across a full route sweep), and every spec in this suite is
 * read-only against `.demo-corpus` for exactly that reason. A route that DID
 * move under two reads would be a defect this comparison is entitled to find.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './app.ts';

/** `parts.js` · `BOUND_CAP_LIST` — the display cap on a bounded list. */
const BOUND_CAP_LIST = 20;

/**
 * The five tracks the budget ribbon draws, in `preview.js`'s `TIERS` order —
 * the DRAWING order, which is deliberately not `select.ts`'s run order. Held
 * here so a per-track assertion can name which track it is talking about
 * without reading the track's own chip, which is what it is checking.
 */
const TIERS = ['pinned', 'jit', 'restored', 'continuity', 'index'] as const;

/**
 * The element on each screen that exists ONLY once its payload has arrived.
 *
 * **A `.card` is not that element, and the first draft of this file learned it
 * the expensive way: every comparison below measured zero against a real
 * payload count and failed as though the app were broken.** Three of these
 * screens append static furniture before they fetch — `proc.js` says so in as
 * many words, *"static and unconditional: the lifecycle table is what a
 * procedure IS, and it does not stop being true because a read failed"* — so
 * a card is visible while the data regions are still empty.
 *
 * That is a real property of these screens and not a nuisance, which is why
 * the marker is per screen and named rather than replaced with a sleep: the
 * thing worth waiting for is the region the payload BUILDS, and each screen
 * builds a different one.
 *
 * **None of these markers is the thing being counted.** Waiting on the count
 * itself would turn every assertion below into a poll that passes as soon as
 * it agrees with itself; these wait for the region to exist and then count
 * what is in it, once.
 */
const READY: Record<string, string> = {
  // Drawn by `drawRibbons`, from the selection — five tracks, unconditionally,
  // including the ones the event never reached.
  preview: '#ribbons .ribbon',
  // The three severity cards are built after `/api/doctor` answers, in place
  // of the refusal note.
  doctor: '.card',
  // `two` is appended to the root only after both procedure reads settle; the
  // static lifecycle card is NOT inside it.
  proc: '.two > .card',
};

/** Navigate the rail and wait for the region the payload builds. */
async function show(page: Page, screen: string): Promise<void> {
  await page.evaluate((s) => {
    document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`)?.click();
  }, screen);
  await expect(
    page.locator(`section[data-p="${screen}"] ${READY[screen]}`).first(),
    `the ${screen} screen never drew \`${READY[screen]}\`, the region its payload builds — `
    + 'nothing below measures a page whose fetch had not returned',
  ).toBeVisible({ timeout: 20_000 });
}

/** Read a payload through the page's own authenticated door. See the header. */
function payload<T>(page: Page, route: string): Promise<T> {
  return page.evaluate(
    (r) => (window as unknown as { myctx: { api: (p: string) => Promise<unknown> } }).myctx.api(r),
    route,
  ) as Promise<T>;
}

/* -------------------------------------------------------------------------- *
 * The injection preview — the screen that promises exactly what Claude gets.
 * -------------------------------------------------------------------------- */

interface SelectionPayload {
  full: { item: { id: string }; tier: string }[];
  spilled: { id: string; tier: string }[];
  index: { normative: unknown[]; truncated: number };
  tokens: number;
}

/**
 * **The query the preview screen is CURRENTLY showing, composed by the app's
 * own `selectQuery`.**
 *
 * A hand-written `'/api/select?cold=1&event=session-start'` is a different
 * question, and asking it cost this file a failure that read exactly like a
 * defect: the pinned track drew 23 ghosts against 27 spilled items. Both
 * numbers were right. `preview.js` asks `selectQuery(event, path,
 * ctx.session())` — the SELECTED session, not a cold one — and a cold session
 * has a different seen ledger, so it spills a different set. A shape assertion
 * that fetches its own version of the question is measuring two screens.
 *
 * So the event comes from `#evsel`, the session from `window.myctx.session()`,
 * and the composition from `/lib/viewmodel.js` — the module the browser
 * resolves, imported by the specifier the browser resolves it under, which is
 * the shape `e2e/bounded-paging.spec.ts` established for reaching a shipped
 * module from inside the running app.
 *
 * `event=tool` is the one event that also needs a path and is not what the
 * screen opens on; if a future default lands there this returns the same query
 * the screen used, which is still the right comparison.
 */
async function selectRoute(page: Page): Promise<string> {
  return await page.evaluate(async () => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const vm = await load('/lib/viewmodel.js') as unknown as {
      selectQuery: (event: string, path: string | null, session: string) => string;
    };
    const ctx = (window as unknown as { myctx: { session: () => string } }).myctx;
    const event = document.querySelector<HTMLSelectElement>('#evsel')?.value ?? 'session-start';
    return `/api/select?${vm.selectQuery(event, null, ctx.session())}`;
  });
}

test('Delivered draws one row per item /api/select admitted, up to its own cap', async ({ app }) => {
  const { page } = app;
  await show(page, 'preview');
  const SELECT = await selectRoute(page);
  const selection = await payload<SelectionPayload>(page, SELECT);
  const drawn = await page.locator('section[data-p="preview"] #deliveredRows .row').count();

  // **`min`, not equality, and the cap is not a fudge factor.** `boundedList`
  // is given `{ cap: BOUND_CAP_LIST, displayOnly: true }`: the rows are a
  // DISPLAY window over a delivery that was complete, and the screen says so
  // in its own bound sentence. Asserting bare equality would make this test
  // fail the day the corpus grows past twenty for a reason that is the design
  // working. Asserting `<= cap` alone would pass over a screen that drew
  // nothing.
  const expected = Math.min(selection.full.length, BOUND_CAP_LIST);
  expect(
    drawn,
    `Delivered drew ${drawn} rows; \`${SELECT}\` admitted ${selection.full.length} items and the `
    + `display cap is ${BOUND_CAP_LIST}, so ${expected} rows were owed. A row per admitted item `
    + 'is the whole promise of this screen — it claims to show exactly what a session is given.',
  ).toBe(expected);

  // Anti-vacuity: a corpus that delivered nothing would satisfy the equality
  // above with two zeroes and prove nothing about the render loop. The fixture
  // is built to deliver; if it stops, that is the fixture failing as itself.
  expect(
    selection.full.length,
    `\`${SELECT}\` admitted nothing at all over this corpus, so the row comparison above compared `
    + 'zero against zero. Rebuild the fixture: `node scripts/demo-corpus.ts`.',
  ).toBeGreaterThan(0);
});

/**
 * **A segment per admitted item and a ghost per spilled one, on every track.**
 *
 * This is the assertion that replaces the `if (track.segs === 0) continue;`
 * guard removed from `e2e/app-layout.spec.ts` on 2026-08-28. That guard existed
 * because the continuity tier admitted nothing over this corpus, so the ribbon
 * test could only say "a track that drew something must draw a lane" and had to
 * stay silent about a track that drew nothing — which is precisely the state a
 * broken tier and an empty tier share.
 *
 * Counting against the payload removes the ambiguity in both directions: a
 * track draws exactly as many segments as the endpoint admitted to it, which
 * is an assertion about zero as much as about four. It is the owner's *"an
 * empty state that appears only when the endpoint says empty"*, per tier.
 *
 * **`index` is one aggregate segment and no ghosts, by design.** `preview.js`
 * draws the index tier as a single segment labelled with the line count and
 * carries the truncation as its `out` figure, because index lines are not
 * items and there is nothing to draw a lane out of. That is asserted as the
 * rule it is, rather than excluded.
 */
test('every ribbon track draws one segment per item the payload admitted to it, and one ghost per item it spilled', async ({ app }) => {
  const { page } = app;
  await show(page, 'preview');
  const SELECT = await selectRoute(page);
  const selection = await payload<SelectionPayload>(page, SELECT);

  const tracks = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('section[data-p="preview"] #ribbons .ribbon')]
      .map((ribbon) => ({
        chip: ribbon.querySelector<HTMLElement>('.rlabel .chip')?.textContent?.trim() ?? '',
        runs: ribbon.querySelector('.track .notrun') === null,
        label: ribbon.querySelector<HTMLElement>('.rlabel .n')?.textContent?.trim() ?? '',
        segs: ribbon.querySelectorAll('.track .seg:not(.head)').length,
        ghosts: ribbon.querySelectorAll('.ghosts .gh').length,
      })));

  expect(
    tracks.map((t) => t.chip),
    'the ribbon did not draw the five tracks this comparison indexes by chip',
  ).toEqual([...TIERS]);

  for (const [i, tier] of TIERS.entries()) {
    const track = tracks[i]!;
    // A tier this event never reaches is drawn hatched and named, and admits
    // nothing by definition — `preview.ribbonn` is explicit that "absent" and
    // "empty" are different facts. There is no payload count to compare it
    // against, so the assertion is that it admitted nothing.
    if (!track.runs) {
      const claimed = selection.full.filter((e) => e.tier === tier).length;
      expect(
        claimed,
        `the ${tier} track is drawn ABSENT — the event never reaches it — while \`${SELECT}\` `
        + `reports ${claimed} items admitted to that tier. One of the two is wrong about `
        + 'whether the tier ran.',
      ).toBe(0);
      continue;
    }

    const admitted = selection.full.filter((e) => e.tier === tier).length;
    const spilled = selection.spilled.filter((s) => s.tier === tier).length;
    const isIndex = tier === 'index';
    // The index tier's one aggregate segment, and its `in` figure is a count of
    // index LINES rather than of items.
    const owedSegs = isIndex ? 1 : admitted;
    const owedGhosts = isIndex ? 0 : spilled;

    expect(
      track.segs,
      `the ${tier} track drew ${track.segs} segments; \`${SELECT}\` admitted ${admitted} items to `
      + `that tier${isIndex ? ' and the index tier is drawn as ONE aggregate segment' : ''}, so `
      + `${owedSegs} were owed. A track that draws fewer segments than the payload admitted is `
      + 'reporting a delivery that did not happen, or hiding one that did.',
    ).toBe(owedSegs);

    expect(
      track.ghosts,
      `the ${tier} track drew ${track.ghosts} ghosts; \`${SELECT}\` spilled ${spilled} items from `
      + `that tier${isIndex ? ' and the index tier draws no ghost lane at all' : ''}, so `
      + `${owedGhosts} were owed. INV-nothing-is-dropped-silently is the invariant a missing `
      + 'ghost breaks: an item excluded for budget has to be visible somewhere.',
    ).toBe(owedGhosts);

    // The label and the bar are the same fact twice: `.rlabel .n` reads
    // `used / budget · N in · M out`, and N and M are the two numbers just
    // compared against. A bar drawn correctly beside a label that disagrees
    // with it is worse than either being wrong alone.
    const counts = /·\s*([\d,]+) in\s*·\s*([\d,]+) out/.exec(track.label);
    expect(
      counts,
      `the ${tier} track's label ${JSON.stringify(track.label)} does not carry the "N in · M out" `
      + 'figures this compares against',
    ).not.toBeNull();
    const inCount = Number(counts![1]!.replaceAll(',', ''));
    const outCount = Number(counts![2]!.replaceAll(',', ''));
    expect(
      inCount,
      `the ${tier} label claims ${inCount} in; \`${SELECT}\` reports `
      + `${isIndex ? selection.index.normative.length : admitted}`
      + `${isIndex ? ' normative index lines' : ' items admitted to that tier'}`,
    ).toBe(isIndex ? selection.index.normative.length : admitted);
    expect(
      outCount,
      `the ${tier} label claims ${outCount} out; \`${SELECT}\` reports `
      + `${isIndex ? selection.index.truncated : spilled}`
      + `${isIndex ? ' index lines truncated' : ' items spilled from that tier'}`,
    ).toBe(isIndex ? selection.index.truncated : spilled);
  }

  // Anti-vacuity again, and specifically for the tier this test was written
  // for: `scripts/demo-corpus.ts` authors a bounded continuity item so the
  // fifth track delivers. If that stops being true the comparison above goes
  // quietly back to zero against zero, which is the state the two removed
  // guards described.
  expect(
    selection.full.filter((e) => e.tier === 'continuity').length,
    'the continuity tier admitted nothing over this corpus, so its track comparison compared zero '
    + 'against zero. `scripts/demo-corpus.ts` authors a bounded continuity item for exactly this '
    + 'reason; rebuild the fixture with `node scripts/demo-corpus.ts`.',
  ).toBeGreaterThan(0);
});

/* -------------------------------------------------------------------------- *
 * Doctor — a row per finding, and no row of its own.
 * -------------------------------------------------------------------------- */

/**
 * The three severity cards, in `doctor.js`'s `CARDS` order — which is the
 * order the screen draws them and therefore the order every per-card
 * comparison below indexes by.
 *
 * These are the LEVELS `runChecks` emits, not the headings the cards wear:
 * `doctor.js` writes "warning" over `warn` and "notice" over `info`, and its
 * own comment says the level is the join key and the heading is the label. The
 * join key is what a payload comparison needs.
 */
const LEVELS = ['error', 'warn', 'info'] as const;

test('Doctor draws one row per finding /api/doctor returned, and invents none', async ({ app }) => {
  const { page } = app;
  await show(page, 'doctor');
  const doctor = await payload<{
    findings: { level: string; code: string; about?: string }[];
  }>(page, '/api/doctor');

  const drawn = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('section[data-p="doctor"] tbody tr')]
      .map((tr) => tr.querySelector<HTMLElement>('td.m')?.textContent?.trim() ?? ''));

  // **`/api/doctor` serves `runChecks` WHOLE, and the screen partitions it.**
  // A finding carrying `about` is a DISCLOSURE about a check rather than a
  // finding about the corpus, and it deliberately draws no row — it is a
  // `details.help` sibling of the table. So the row count is owed against the
  // findings that are rows, and this comparison would otherwise report a
  // deliberate partition as rows lost in transit.
  //
  // The original invariant is not weakened, it is SPLIT: the count below is
  // against rows, and the disclosures are asserted PRESENT a few lines down.
  // Dropping the second half would turn a real guarantee — nothing reaches the
  // screen and vanishes — into an equality that a screen could satisfy by
  // hiding anything it liked, which is the failure this test exists to catch.
  const rows = doctor.findings.filter((f) => f.about === undefined);
  const notes = doctor.findings.filter((f) => f.about !== undefined);

  expect(
    drawn.length,
    `Doctor drew ${drawn.length} rows across its three cards; \`/api/doctor\` returned `
    + `${rows.length} finding(s) that are rows (of ${doctor.findings.length} served, `
    + `${notes.length} being disclosures that draw no row). A findings list that loses rows `
    + 'on the way to the screen is a corpus reported healthier than it is.',
  ).toBe(rows.length);

  // **The other half: a disclosure draws no ROW, but it must still be READABLE.**
  // `INV-nothing-is-dropped-silently`. Asserted by code rather than by counting
  // `details.help` elements, because that class also carries the per-code help a
  // row can open, so an element count would pass while naming nothing.
  if (notes.length > 0) {
    const shown = await page.evaluate(() =>
      document.querySelector<HTMLElement>('section[data-p="doctor"]')?.textContent ?? '');
    for (const note of notes) {
      expect(
        shown,
        `\`/api/doctor\` served the disclosure \`${note.code}\` (about \`${note.about}\`) and the `
        + 'Doctor screen does not mention it anywhere. A disclosure draws no row on purpose; '
        + 'disappearing entirely is the silent drop INV-nothing-is-dropped-silently forbids.',
      ).toContain(note.code);
    }
  }

  // Every drawn row carries a code the payload actually holds — sorted, so the
  // comparison is about the multiset and not about the order the three cards
  // happen to be built in.
  const sortedDrawn = [...drawn].sort();
  const sortedPayload = rows.map((f) => f.code).sort();
  expect(
    sortedDrawn,
    `the codes Doctor drew are not the codes \`/api/doctor\` returned — ${drawn.length} drawn `
    + `against ${doctor.findings.length} in the payload. A row naming a check that did not run is `
    + 'a finding invented by the screen.',
  ).toEqual(sortedPayload);

  // **Per CARD, against the payload's own per-level counts.** Doctor draws all
  // three severity cards unconditionally — "a doctor that could not run and a
  // corpus with no findings are opposite facts" — so each card's row count is
  // a claim about how many findings the payload holds at THAT level, and the
  // sum being right is satisfied by a screen that put every row in one card.
  //
  // This is where an `expect(perCard.some((n) => n === 0)).toBe(true)` stood
  // until 2026-08-29, with the message *"no severity card was empty (1, 6, 1
  // rows), so this run did not exercise the empty-card case … it is this
  // assertion telling you it measured nothing about emptiness"*. The
  // observation was right and the expression was wrong: a red gate for a
  // non-defect is a gate readers learn to discount, and this one was red or
  // green depending on what the corpus happened to hold that morning. The
  // empty-card rule is now MEASURED ON EVERY RUN, over a body this suite
  // serves itself — `an empty severity card appears exactly where /api/doctor
  // returned nothing at that level`, below — which is strictly better than
  // either failing or skipping, because the case no longer depends on the day.
  const perCard = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('section[data-p="doctor"] .card')]
      .map((card) => card.querySelectorAll('tbody tr').length));
  // `rows`, not `doctor.findings`: every disclosure is `info`, so owing the
  // notice card the served count would demand rows for lines that draw none.
  const owed = LEVELS.map((level) => rows.filter((f) => f.level === level).length);
  expect(
    perCard,
    `the three severity cards hold ${perCard.join(' + ')} rows; \`/api/doctor\` returned `
    + `${owed.join(' + ')} findings at ${LEVELS.join(', ')} respectively, out of `
    + `${doctor.findings.length}. A card is one LEVEL, so a screen that drew the right total `
    + 'in the wrong cards has told the reader an error is a notice.',
  ).toEqual(owed);
});

/**
 * **An empty severity card, measured every run because the body is served.**
 *
 * The owner's ruling is *"an empty state that appears only when the endpoint
 * says empty"*, and it has two directions: a level the payload has nothing at
 * must draw no rows AND say so, and a level it has findings at must draw them
 * and say nothing. Over `.demo-corpus` on 2026-08-29 all three levels were
 * occupied (1, 6, 1), so neither direction could be exercised at all.
 *
 * **Serving the body is why this is not a skip.** `page.route()` fulfilling
 * `/api/doctor` is the pattern `e2e/doctor-repairless.spec.ts` and
 * `e2e/chart-scale.spec.ts` already use, and its reasoning applies verbatim
 * here: `.demo-corpus` is shared by every spec in this suite and driven by
 * them, so editing items into it to empty a level would rewrite bodies
 * underneath the others. `/api/doctor` serves `runChecks` verbatim —
 * `{ findings: Finding[] }`, unfiltered — so fulfilling that route is the
 * endpoint's own body shape, and what is under test is the DRAWING of it.
 * A case that can be constructed should be constructed: "we could not measure
 * this today" becomes "we measure it every run".
 *
 * **Four bodies, so every card is empty in one and full in another.** A rule
 * checked only where it holds is half a rule: `NO_WARN` and `ONLY_WARN`
 * between them leave each of the three cards empty at least once and populated
 * at least once, `ALL_LEVELS` is the direction where no card may claim
 * emptiness, and `NONE` is the owner's *"a clean corpus draws three empty
 * cards, not an empty screen"*.
 *
 * The codes and messages are real ones from `src/doctor/checks.ts`, abbreviated
 * rather than invented, so a reworded check leaves this spec asserting about a
 * finding that still exists.
 */
interface Finding { level: string; code: string; message: string }

const mk = (level: string, code: string, message: string): Finding => ({ level, code, message });

const BODIES: { name: string; findings: Finding[]; owed: number[] }[] = [
  {
    name: 'nothing at warn',
    findings: [
      mk('error', 'index_stale', 'the index is older than the items it indexes. Run `mycontext rebuild`.'),
      mk('info', 'nested_corpus', 'a second corpus is nested at "sub/project".'),
      mk('info', 'audit_log_size', 'the audit log is large. Run `mycontext audit --files`.'),
    ],
    owed: [1, 0, 2],
  },
  {
    name: 'nothing at error and nothing at notice',
    findings: [
      mk('warn', 'dead_scope', 'scope glob "src/billing/**" matches no file in the repository.'),
      mk('warn', 'blocked_without_needs', 'is at state "blocked" and names nothing in "needs".'),
    ],
    owed: [0, 2, 0],
  },
  {
    name: 'every level occupied',
    findings: [
      mk('error', 'index_stale', 'the index is older than the items it indexes. Run `mycontext rebuild`.'),
      mk('warn', 'dead_scope', 'scope glob "src/billing/**" matches no file in the repository.'),
      mk('info', 'nested_corpus', 'a second corpus is nested at "sub/project".'),
    ],
    owed: [1, 1, 1],
  },
  { name: 'a clean corpus', findings: [], owed: [0, 0, 0] },
];

for (const body of BODIES) {
  test(`an empty severity card appears exactly where /api/doctor returned nothing at that level — ${body.name}`, async ({ app }) => {
    const { page } = app;

    await page.route('**/api/doctor*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ findings: body.findings }),
    }));
    await page.evaluate(() => { location.hash = '#/doctor'; });
    // The three cards are built AFTER the endpoint answers, so their appearance
    // is the signal that this served body is what is on screen — never a sleep.
    await expect(
      page.locator('section[data-p="doctor"] .card.pane'),
      'Doctor did not draw its three severity cards over a served body, so nothing below is '
      + 'reading the payload this test served',
    ).toHaveCount(3, { timeout: 20_000 });

    // `p.small` inside a card is `doc.zero` and nothing else: the tally is a
    // child of the SECTION, the message is a `td.small`, and a command is a
    // `div.cmd`. So "the card said it is empty" is exactly this count.
    const drawn = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('section[data-p="doctor"] .card.pane')]
        .map((card) => ({
          rows: card.querySelectorAll('tbody tr').length,
          saysZero: card.querySelectorAll(':scope > p.small').length,
        })));

    expect(
      drawn.map((c) => c.rows),
      `\`/api/doctor\` was served ${body.findings.length} findings — ${body.owed.join(' + ')} at `
      + `${LEVELS.join(', ')} — and the three cards drew ${drawn.map((c) => c.rows).join(' + ')}. `
      + 'A card is one level; rows landing in the wrong one tell the reader an error is a notice.',
    ).toEqual(body.owed);

    // **Both directions, which is the whole ruling.** A screen that drew the
    // zero note unconditionally would satisfy "the empty card says so" and be
    // telling every reader that a card with six errors in it found nothing.
    expect(
      drawn.map((c) => c.saysZero === 1),
      'a level with no findings must NAME its zero — `doc.zero`, "Checked — none here" '
      + '— and a level with findings must not. A blank card headed `error` reads AS an '
      + 'error (STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is), and a zero note '
      + 'over a populated table is the same lie in the other direction. Served: '
      + `${body.owed.join(' + ')}; drawn: ${drawn.map((c) => c.rows).join(' + ')}; said empty: `
      + `${drawn.map((c) => c.saysZero).join(' + ')}.`,
    ).toEqual(body.owed.map((n) => n === 0));
  });
}

/* -------------------------------------------------------------------------- *
 * Procedures — a card per procedure, identified by the payload's own ids.
 * -------------------------------------------------------------------------- */

test('Procedures draws one card per procedure /api/procedures listed', async ({ app }) => {
  const { page } = app;
  await show(page, 'proc');
  const list = await payload<{ procedures: { id: string }[] }>(page, '/api/procedures');

  // The ids come from the PAYLOAD and are compared against the headings the
  // page drew. Nothing here names an id: the expected set is whatever the
  // endpoint just said, which is what keeps this true as the corpus grows.
  const wanted = list.procedures.map((p) => p.id).sort();
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('section[data-p="proc"] .two > .card h3')]
      .map((h) => h.textContent?.trim() ?? ''));
  const drawn = headings.filter((h) => wanted.includes(h)).sort();

  expect(
    drawn,
    `the Procedures screen drew cards for ${drawn.length} of the ${wanted.length} procedures `
    + '`/api/procedures` listed. `proc.js` renders one card per summary and the write card beside '
    + `them; the headings it drew were ${JSON.stringify(headings)}.`,
  ).toEqual(wanted);

  expect(
    wanted.length,
    '`/api/procedures` listed no procedures, so the comparison above compared two empty lists. '
    + 'The fixture builds three across three lifecycle states; rebuild it with '
    + '`node scripts/demo-corpus.ts`.',
  ).toBeGreaterThan(0);
});
