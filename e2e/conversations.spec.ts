// @basis TASK-a-fold-spends-eleven-lines-saying-some-bookkeeping-happened,
// TASK-a-lane-opens-in-a-new-tab-with-no-warning-no-landing-and-no,
// TASK-a-lane-opens-inside-the-whole-app-and-he-asked-for-the,
// TASK-the-count-of-helper-agents-is-not-a-link-so-the-only-way-to,
// TASK-the-list-row-cannot-link-its-lane-count-because-the-whole,
// TASK-the-list-is-browsable-filter-search-and-duration-across,
// TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and,
// TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has,
// TASK-the-open-document-follows-the-session-as-it-is-written-and,
// TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send,
// TASK-the-conversation-document-still-writes-the-look-tick-by-hand,
// TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds,
// TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which,
// TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because,
// TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the,
// TASK-a-question-its-options-the-answer-chosen-and-a-shell-command,
// TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn,
// TASK-the-row-where-a-lane-reports-back-cannot-say-whose-report-it,
// TASK-a-selected-passage-copies-as-something-a-terminal-will,
// TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form,
// TASK-a-lane-is-named-by-what-it-did-and-never-by-what-it-is-so,
// INV-nothing-is-dropped-silently
/**
 * The conversation archive, driven in a real browser in both languages —
 * `plan:archive seq:3` for the list, and `seq:7`, `seq:8` and `seq:13` for the
 * document.
 *
 * **Why this exists as well as the two `node --test` files.** They prove the
 * endpoint and the arithmetic; this one proves the SCREEN, and this project
 * has repeatedly found real defects in a picture after every assertion had
 * passed — a tag name 897px from its own checkbox, a leading dot at the wrong
 * end under RTL, 552 detached Hebrew full stops.
 *
 * ── THE ONE THING THIS FILE EXISTS FOR ────────────────────────────────────
 *
 * The owner opened his own session and the screen said *"Showing entries 0–50
 * of 24,757"* with **no way to reach entry 51**. So the load-bearing test here
 * is `the end of the session is reachable` — it scrolls to the bottom of a
 * 480-node document and asserts the LAST turn is on screen and readable. That
 * is the defect, restated as something that fails when it comes back.
 *
 * Beside it sits its twin, `only a window of the document is ever in the DOM`,
 * because a viewer that reached the end by rendering all 27,813 records would
 * pass the first test and be unusable — the answer `seq:7` rules out by name:
 * *"one scrollable document over the whole session, with only what is on
 * screen in the DOM."*
 *
 * The server is the suite's own `startUiChild` on its own port, with the
 * sessions store pinned by `test/ui/helpers.ts`' import of
 * `pin-sessions-dir.ts` — so the owner's server on 58888 and the global record
 * at `~/.my-context/ui-server.json` are untouched. `CLAUDE_CONFIG_DIR` points
 * the scanner at a throwaway home, so no real transcript is read.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const ESC = '\u001b';

/** Exchanges in the fixture. Enough that a window is a small fraction of it. */
const ROUNDS = 120;

/**
 * A session long enough to have an unreachable end, shaped like a real one.
 *
 * Each round is a prompt, an answer, and a run of machinery between them —
 * which is what a transcript actually looks like: on the owner's own file,
 * 62.6% of records carry no `message` at all and 2,456 of 27,813 are turns
 * somebody took.
 *
 * Three records are planted for specific assertions and are named here so a
 * reader does not have to find them: the FIRST answer carries Markdown (a
 * heading, a list, a fence and a table) for `seq:8`; one tool result deep in
 * the file carries a real ANSI sequence; and the LAST prompt carries a phrase
 * that appears nowhere else, so "the end is reachable" cannot pass by
 * accident.
 */
const LAST_PHRASE = 'the very last thing anybody asked';
const DEEP_PHRASE = 'a needle only the whole-session filter can find';

/**
 * **THE LANE PLANTED HALF WAY DOWN** — `plan:archive seq:15`.
 *
 * The round is 60 of 120 ON PURPOSE. The item's requirement is the RETURN —
 * *"let the user return exactly to the cursor point from where it requested to
 * view the subagent content"* — and a return proved at the top or at the end
 * proves nothing: both are positions a document can land on by accident. The
 * middle of a 22,000px virtualised scroll is not.
 *
 * Two lanes, at two depths, because a build that only looked at the session
 * would mis-file a fifth of the real ones: `agent-outer` was dispatched by the
 * SESSION, and `agent-inner` by a call that lives inside `agent-outer.jsonl`
 * and nowhere in the session's own file.
 */
const LANE_ROUND = 60;
const LANE_CALL = 'toolu_LANE_MID';
const ASK_CALL = 'toolu_ASK_LAST';
/** A CHECKBOX question — `multiSelect`, several ticks in one answer. */
const ASK_MANY = 'toolu_ASK_MANY';
const DEEP_CALL = 'toolu_LANE_DEEP';
const LANE_BRIEF = 'read the index and report what it holds';
const LANE_PHRASE = 'the working that produced the lane report';
const DEEP_PHRASE_LANE = 'the deeper lane, dispatched from inside a lane';

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 8, 9, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'The conversation archive' });
  for (let i = 0; i < ROUNDS; i += 1) {
    const last = i === ROUNDS - 1;
    rows.push({
      type: 'user',
      message: {
        role: 'user',
        content: last ? LAST_PHRASE : (i === 71 ? DEEP_PHRASE : `round ${i}: keep going`),
      },
      timestamp: at(i * 4),
      gitBranch: 'master',
    });
    rows.push({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: text(i === 0
          ? [
            '## What the terminal showed',
            '',
            'Rendering **formatted** text with `code`, a list and a table:',
            '',
            '- the first point',
            '- the second point',
            '',
            '```sh',
            'mycontext conversation rebuild',
            '```',
            '',
            '| column | meaning |',
            '| --- | --- |',
            '| one | the first |',
          ].join('\n')
          : `answer ${i}: קודם כול, then back to English.`),
      },
      timestamp: at(i * 4 + 1),
    });
    rows.push({ type: 'attachment', attachment: { type: 'total_tokens_reminder' } });
    // THE SHELL COMMAND, WITH ITS OWN `id` AND A RESULT THAT NAMES IT BACK.
    // Every real `tool_use` carries one — 3,354 of 3,354 on the owner's
    // transcript — and it is what lets the promoted row say how the command
    // ENDED without copying its output out of the fold (`plan:archive
    // seq:16`).
    rows.push({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: `toolu_R${i}`, name: 'Bash', input: { command: `echo ${i}`, description: `Echo round ${i}` } }],
      },
      timestamp: at(i * 4 + 2),
    });
    rows.push({
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: `toolu_R${i}`,
          content: i === 3
            ? `Call log:\n${ESC}[2m  - waiting for locator('nav')${ESC}[22m\n`
            : `round ${i} output`,
        }],
      },
      timestamp: at(i * 4 + 3),
    });
    // THE DISPATCHING TURN, half way down. One more record in this one run,
    // so every other fold keeps the count its own assertions make. It carries
    // an `id`, which is what the lane's sidecar names it by, and a `prompt`,
    // which is the lane brief `seq:24` made visible.
    if (i === LANE_ROUND) {
      rows.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use', id: LANE_CALL, name: 'Agent',
            input: {
              subagent_type: 'general-purpose',
              description: 'Read the index',
              prompt: LANE_BRIEF,
            },
          }],
        },
        timestamp: at(i * 4 + 3),
      });
    }
    // PLANTED IN THE LAST ROUND ONLY, so every other fold keeps the four
    // records its own assertions count. These are the two shapes that lost the
    // most when a tool call kept 160 characters of its input: a `Write`, whose
    // `file_path` won and whose CONTENT was dropped, and an `AskUserQuestion`,
    // which captured NOTHING AT ALL because `questions` is an array and the
    // fallback took only strings. 71 of the owner's calls were that second one.
    if (last) {
      rows.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Write', input: {
            file_path: '/tmp/report.md', content: 'the whole file body, not only its path',
          } }],
        },
        timestamp: at(i * 4 + 3),
      });
      rows.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: ASK_CALL, name: 'AskUserQuestion', input: {
            questions: [{
              question: 'Which corpus should the suite read?',
              header: 'Corpus',
              multiSelect: false,
              options: [
                { label: 'The live corpus', description: 'dogfooding, as the rule requires' },
                { label: 'A fixture corpus', description: 'needs approval first' },
              ],
            }],
          } }],
        },
        timestamp: at(i * 4 + 3),
      });
      // WHICH ONE HE CHOSE, in the shape the transcript actually records it:
      // English prose in the `tool_result`, with no chosen-index field
      // anywhere. `plan:archive seq:16` — the answer is matched to an option
      // by text, and the option he DECLINED stays on the screen because it is
      // the record of what was considered.
      rows.push({
        type: 'user',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result', tool_use_id: ASK_CALL,
            content: 'The user answered: "Which corpus should the suite read?"="The live corpus". Read the answers carefully.',
          }],
        },
      });
      // **A CHECKBOX QUESTION, AND ITS ANSWER IS WHY THIS FIXTURE EXISTS.**
      // Owner report 2026-09-10: the ticks did not show. A multi-select answer
      // quotes the picked labels INSIDE the value, so `", "` — the separator
      // between one question and the next — occurs in the middle of the answer.
      // The sentence below is that shape verbatim, and it also ends in trailing
      // prose, which is what defeats a lookahead.
      rows.push({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: ASK_MANY, name: 'AskUserQuestion', input: {
            questions: [{
              question: 'Which modes ship first?',
              header: 'Modes',
              multiSelect: true,
              options: [
                { label: '1 — From selection', description: 'reconstruct from a copied passage' },
                { label: '2 — Free text search', description: 'scoped by session and dates' },
                { label: '3 — List the subjects', description: 'when you do not know what to ask' },
                { label: '4 — List the anchors', description: 'the marked fixed points' },
              ],
            }],
          } }],
        },
        timestamp: at(i * 4 + 3),
      });
      rows.push({
        type: 'user',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result', tool_use_id: ASK_MANY,
            content: 'The user answered: "Which modes ship first?"="1 — From selection, '
              + '"2 — Free text search", 3 — List the subjects, 4 — List the anchors". '
              + 'Read the answers carefully.',
          }],
        },
        timestamp: at(i * 4 + 3),
      });
    }
    rows.push({ type: 'queue-operation', operation: 'drain' });
  }
  return rows;
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-conv-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-conv-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'sess-archive.jsonl'),
    session().map((r) => JSON.stringify(r)).join('\n') + '\n',
  );

  // **THE TWO LANES, ON DISK WHERE THE HARNESS PUTS THEM** — a `subagents/`
  // directory under the session's own name, each transcript beside an
  // `agent-<id>.meta.json`. That sidecar is the only place the dispatching
  // `toolUseId` is recorded, and 253 of 253 real ones carry it.
  const lanes = path.join(dir, 'sess-archive', 'subagents');
  mkdirSync(lanes, { recursive: true });
  const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

  writeFileSync(path.join(lanes, 'agent-outer.jsonl'), jsonl([
    { type: 'user', message: { role: 'user', content: LANE_BRIEF }, timestamp: '2026-09-08T09:04:10.000Z' },
    { type: 'assistant', message: { role: 'assistant', content: text(LANE_PHRASE) }, timestamp: '2026-09-08T09:04:11.000Z' },
    // The call that makes the depth-2 lane. It lives HERE and nowhere in the
    // session's file, which is the whole reason the roster has to be resolved
    // through the owning session rather than through the document's own id.
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: DEEP_CALL, name: 'Agent', input: { prompt: 'go one level deeper' } }],
      },
      timestamp: '2026-09-08T09:04:12.000Z',
    },
  ]));
  writeFileSync(path.join(lanes, 'agent-outer.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'Read the index',
    toolUseId: LANE_CALL, spawnDepth: 1,
  }));

  writeFileSync(path.join(lanes, 'agent-inner.jsonl'), jsonl([
    { type: 'user', message: { role: 'user', content: 'go one level deeper' }, timestamp: '2026-09-08T09:04:20.000Z' },
    { type: 'assistant', message: { role: 'assistant', content: text(DEEP_PHRASE_LANE) }, timestamp: '2026-09-08T09:04:21.000Z' },
  ]));
  writeFileSync(path.join(lanes, 'agent-inner.meta.json'), JSON.stringify({
    agentType: 'Explore', description: 'One level deeper',
    toolUseId: DEEP_CALL, parentAgentId: 'outer', spawnDepth: 2,
  }));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // The index is built by a CLI WRITE, because the server cannot build it.
    // That is the whole read/write split, exercised here the way a user meets
    // it: run the command, then reload the screen.
    runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally {
    process.chdir(previous);
  }
  harness = await startUiChild(cwd);
});

test.afterAll(async () => {
  await harness?.stop();
  delete process.env['CLAUDE_CONFIG_DIR'];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
});

/**
 * Open the app at a hash, in one language — in ONE page load.
 *
 * The language is planted by `addInitScript` before any of the app's own code
 * runs, rather than set and then navigated to. The first draft loaded the page
 * twice (set `localStorage`, then go again), and the second navigation aborted
 * the first page's in-flight heartbeat: the app reads a rejected fetch as
 * "the server has exited" and raises `#exited`, a fixed overlay that then
 * physically intercepted every click.
 */
async function open(page: Page, hash: string, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  // A FRESH nonce per page. `harness.nonce` is the one the server printed at
  // start and it is SINGLE-USE.
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash.replace(/^#/, '#'));
  // **SCOPED TO THE VISIBLE SCREEN, and that is a repair rather than tidiness.**
  //
  // This read `.convrow, .tvturn, .spill` PAGE-WIDE, and `app.js` says why that
  // cannot hold: *"the router keeps every visited screen inside `#screen`,
  // merely hidden"*. `.spill` is what `errorNote` wears and what the
  // no-credential note wears, so under load the screen the app booted on
  // leaves one behind — HIDDEN — and `waitForSelector` locks onto the first
  // match in DOM order and waits on an element that will never be visible,
  // even after `.convrow` has drawn. Seen as a rotating handful of failures
  // per run whose set changed every time and which all passed alone:
  // 15 of 66, then 11, then 6 of 132, never twice the same test.
  const on = '[data-p]:not([hidden])';
  await page.waitForSelector(
    `${on} .convrow, ${on} .tvturn, ${on} .spill`, { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/**
 * Open the one session and wait for the document to have drawn its first turn.
 *
 * **`at` defaults to `'top'` AND THAT IS NOT WHERE A SESSION OPENS ANY MORE.**
 * `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work` moved the
 * default landing to the END — that is the owner's ruling and the missing half
 * of the follow, since a document only follows a reader who is at the tail. The
 * tests that read the BEGINNING of the document — who spoke first, the first
 * timestamp, the first ANSI colours — are about the document and not about
 * where it opens, so they press Top and say so, rather than being rewritten to
 * assert on whichever turn the end happens to hold.
 *
 * `at: 'default'` is the un-pressed path, and `a session opens at its end` is
 * where the ruling itself is asserted.
 */
async function openDocument(
  page: Page, lang: 'en' | 'he', at: 'top' | 'default' = 'top',
): Promise<void> {
  await open(page, '#/conversations', lang);
  await page.locator('.convrow').first().click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  if (at === 'top') {
    await page.locator('button.tvtop').click();
    await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
  }
}

for (const lang of ['en', 'he'] as const) {
  test(`the list names each session and its counts (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);

    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    const row = page.locator('.convrow').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('The conversation archive');
    // The title came from the model, and the screen says so rather than
    // letting it read as a name a person chose.
    await expect(row).toContainText(lang === 'he' ? 'המודל' : 'the model');
    await expect(row).toContainText('master');

    await page.screenshot({ path: `e2e/screens/conversations-list-${lang}.png`, fullPage: true });
  });

  /* ══ seq:13 — THE DOCUMENT SKELETON ════════════════════════════════════ */

  test(`the session reads as a document: who spoke, when, machinery folded (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // A HEADING PER TURN, naming the speaker — the shape the owner supplied by
    // example. `<h4>` inside a `<header>`, not a styled div: a document a
    // screen reader walks wants headings.
    const first = page.locator('.tvturn').first();
    await expect(first.locator('h4.tvname')).toBeVisible();
    await expect(first.locator('h4.tvname'))
      .toHaveText(lang === 'he' ? 'אתם' : 'You');

    // THE TIMESTAMP ON ITS OWN, beneath the speaker, machine-readable.
    const stamp = first.locator('time.tvat');
    await expect(stamp).toHaveAttribute('datetime', /^2026-09-08T/);

    // ── AND IT IS IN THE READER'S CLOCK, AND IT SAYS WHICH CLOCK ────────
    //
    // `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`.
    // The owner reported three hours of his session missing; nothing was
    // missing, the screen was drawing the stored UTC value with the `Z` sliced
    // off and he is UTC+3.
    //
    // `playwright.config.ts` pins `timezoneId: 'UTC'`, so the reader HERE is a
    // UTC reader and the digits do not move — which is exactly why this
    // assertion is about the MARKER. A UTC reader is the one for whom the
    // named zone looks like decoration, and dropping it is how the defect
    // comes back for everybody else. The shift itself is proven in
    // `the reader's own zone` below, which runs a browser in Asia/Jerusalem.
    //
    // The `datetime` above is unchanged and still UTC: the stored value never
    // moved, only the display.
    await expect(stamp).toHaveText('2026-09-08 09:00 GMT+0');

    // **`dir="ltr"` SURVIVES, and it now carries more than it did.** A
    // previous lane found `2026-09-08 09:00` drawn as `09:00 2026-09-08` on
    // the Hebrew page — two neutral runs reordered by the RTL paragraph — and
    // fixed it here. Naming the zone made the stamp THREE runs, so the same
    // bidi rule now has a third field to move.
    //
    // Asserted as the COMPUTED direction and not only the attribute, because
    // the attribute is the means and the direction is the property: a
    // stylesheet rule could satisfy one and break the other.
    await expect(stamp).toHaveAttribute('dir', 'ltr');
    expect(await stamp.evaluate((n) => getComputedStyle(n).direction)).toBe('ltr');

    // And the VISUAL order, which is the thing the screenshot showed and no
    // `textContent` assertion can see: bidi reorders what is painted, not what
    // is in the DOM. The first character's box must start to the LEFT of the
    // last character's, on both pages — that is false the moment the stamp is
    // allowed to inherit an RTL paragraph.
    const order = await stamp.evaluate((n) => {
      const text = n.firstChild;
      if (text === null) return null;
      const box = (from: number, to: number): DOMRect => {
        const r = document.createRange();
        r.setStart(text, from);
        r.setEnd(text, to);
        return r.getBoundingClientRect();
      };
      const len = (text.textContent ?? '').length;
      return { first: box(0, 1).left, last: box(len - 1, len).left };
    });
    expect(order).not.toBeNull();
    expect(order!.first).toBeLessThan(order!.last);

    // Distinct by MORE than colour: a glyph beside the accent, so the
    // distinction survives a monochrome print and a colour-blind reader.
    await expect(first.locator('.tvmark')).toHaveAttribute('data-g', '▸');
    await expect(page.locator('.tvturn.tvclaude .tvmark').first())
      .toHaveAttribute('data-g', '◆');

    // ── THE COMMAND IS A ROW, NOT A RECORD INSIDE A FOLD ──────────────────
    //
    // `plan:archive seq:16`. Owner ruling 2026-09-08: he wants to see *"the
    // shell commands that were executed"*. They were never absent from the
    // file — `classifyTurn` calls a tool call machinery and the viewer folds
    // machinery away, so they were present, counted and collapsed as noise.
    // Now the CALL is a row a reader meets and the OUTPUT is still folded,
    // which is the ruling in its own words.
    const ran = page.locator('.tvdeed').first();
    await expect(ran).toBeVisible();
    await expect(ran.locator('h4.tvname'))
      .toHaveText(lang === 'he' ? 'מעטפת' : 'Shell');
    // WHAT RAN, verbatim — 81% of the owner's commands are longer than the
    // 160-character summary line, so the summary is not the record.
    await expect(ran.locator('.tvterm')).toHaveText('echo 0');
    // AND HOW IT ENDED, in the vocabulary this app already uses for the
    // outcome of a command.
    await expect(ran.locator('.exitcode')).toHaveText(lang === 'he' ? 'הצליחה' : 'succeeded');
    // The prose ABOUT the act reads after the act itself.
    await expect(ran).toContainText('Echo round 0');

    // THE FOLD, which is what `seq:13` adds to `seq:7`: a RUN of machinery as
    // ONE line, not one row per record. What is left between two turns once
    // the command has been promoted is the result it produced and the
    // book-keeping around it, and they draw as a single `<details>`.
    const fold = page.locator('.tvwork').filter({ hasText: 'round 0 output' }).first();
    await expect(fold).toBeVisible();
    await expect(fold.locator('summary .tvmark')).toHaveAttribute('data-g', '⚙');
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(false);

    // A real <details>: Enter opens it, with no key handler of our own.
    await fold.locator('summary.tvworksum').focus();
    await page.keyboard.press('Enter');
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);
    // And opening it shows every record in the run, book-keeping included —
    // a reader who cannot see that a record was there cannot know one was
    // skipped.
    //
    // **THREE `.tvstep`s FOR TWO RECORDS, AND THAT IS `plan:archive seq:39`.**
    // The result keeps a row of its own; the `queue-operation` record, which
    // draws nothing but its own name, is counted on ONE collapsed line — and
    // that line is itself a `<details>` holding the record's own index row, so
    // nothing became unreachable. The count on the summary above is still 2.
    // `a fold counts its empty records on one line, and that line opens` is
    // where the whole of that behaviour is driven.
    await expect(fold.locator('.tvstep')).toHaveCount(3);
    await expect(fold.locator('details.tvquiet')).toHaveCount(1);
    // The steps are in RECORD order, so the run opens on the result the
    // command produced and closes on the harness's own queue record. A step's
    // number is the record's own index in the file, the one the list screen
    // and the endpoint both count in.
    await expect(fold.locator('.tvstep').first()).toContainText('round 0 output');
    // ── A RECORD WITH NO `message` NAMES ITSELF FINER THAN ITS TYPE ────────
    //
    // `plan:archive seq:28`. `queue-operation` and `attachment` name the
    // ENVELOPE; the subtype names the thing. 3,646 of the owner's 4,864
    // attachments are book-keeping and 1,218 are not, and until 2026-09-09
    // they rendered identically.
    await expect(fold.locator('.tvstep').last()).toContainText('queue-operation · drain');

    // A TURN IS NOT FOLDED — the reader came for it.
    await expect(page.locator('.tvturn details.tvwork')).toHaveCount(0);

    // NOTHING ON THIS SCREEN CLAIMS A SIZE LIMIT — `seq:7`'s remainder, and
    // the sentence he was reading when he ruled it out. It stood under the
    // scroll and said "A turn longer than 60000 characters is shown up to
    // there and says so; tool output, up to 4000." Both caps are gone from the
    // read model, so the disclosure went with them and NO row may carry a
    // "shown N of M characters" line either.
    const viewer = page.locator('.tvroot');
    await expect(viewer).not.toContainText(lang === 'he' ? 'תור ארוך מ' : 'is shown up to there');
    await expect(viewer).not.toContainText(lang === 'he' ? 'מוצגים' : 'The rest is in the file');
    await expect(page.locator('.tvcut')).toHaveCount(0);

    await page.screenshot({
      path: `e2e/screens/conversations-document-${lang}.png`, fullPage: true,
    });
  });

  /* ══ seq:24 — AN OPENED STEP SHOWS WHAT WAS ASKED ═════════════════════ */

  /**
   * The owner pasted his own terminal output back and found a `Write(...)`
   * with the file it wrote and a `Bash(...)` with the command it ran, both
   * ABSENT from the session he was reading here. It was a CAPTURE defect —
   * `detail` reduced a whole input to one line of 160 characters and nothing
   * else about the input was ever in the read model — so no amount of opening
   * the fold could have shown it. 3,027 of 3,280 tool calls on his transcript
   * lost content that way, 4.45 MB of it.
   *
   * This drives the repair on a real screen, in both languages, because a
   * server test can prove the field is served and cannot prove it is DRAWN.
   */
  test(`an opened step shows what the tool was asked, not only what came back (${lang})`, async ({ page }) => {
    // The end of the document, where the planted `Write` and `AskUserQuestion`
    // sit — and where a session opens anyway.
    await openDocument(page, lang, 'default');
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // THE FILE'S CONTENT, not only the path the fold summary already named.
    // `Write` is not promoted, so this is still read by opening the fold.
    const fold = page.locator('.tvwork').filter({ hasText: 'Write' }).first();
    await expect(fold).toBeVisible();
    // It NAMES what ran — a fold that says only "3 steps" cannot be skimmed.
    await expect(fold.locator('.tvtools')).toContainText('Write');
    await fold.locator('summary.tvworksum').click();
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);
    await expect(fold).toContainText('the whole file body, not only its path');

    // ── THE QUESTION, EVERY OPTION, AND THE ONE HE PICKED ─────────────────
    //
    // `plan:archive seq:16`, and it is a ROW now rather than a record inside a
    // fold. The options he declined stay on the screen because they are the
    // record of what was considered; the answer is matched to an option out of
    // the result's English, because no chosen-index is recorded anywhere.
    const ask = page.locator('.tvdeed').filter({ hasText: 'Which corpus' }).first();
    await expect(ask).toBeVisible();
    await expect(ask.locator('h4.tvname'))
      .toHaveText(lang === 'he' ? 'Claude' : 'Claude');
    await expect(ask).toContainText('Which corpus should the suite read?');
    await expect(ask).toContainText('The live corpus');
    await expect(ask).toContainText('A fixture corpus');
    // The one he chose is MARKED, and the mark is a word as well as a colour.
    const chosen = ask.locator('li.tvstep').filter({ hasText: 'The live corpus' });
    await expect(chosen.locator('.chip.ok')).toContainText(lang === 'he' ? 'נבחר' : 'chosen');
    const declined = ask.locator('li.tvstep').filter({ hasText: 'A fixture corpus' });
    await expect(declined.locator('.chip.ok')).toHaveCount(0);

    // **EVERY TICK OF A CHECKBOX QUESTION, WHICH IS THE DEFECT HE REPORTED.**
    // Only the FIRST used to be marked: the answer was split on `"`, and a
    // multi-select answer quotes its picked labels inside the value, so it
    // truncated at `1 — From selection, `. All four are asserted rather than
    // one, because a fix that recovered two would still be broken.
    const many = page.locator('.tvdeed').filter({ hasText: 'Which modes ship first?' }).first();
    await expect(many).toBeVisible();
    for (const label of ['1 — From selection', '2 — Free text search',
      '3 — List the subjects', '4 — List the anchors']) {
      const row = many.locator('li.tvstep').filter({ hasText: label });
      await expect(row.locator('.chip.ok'), `"${label}" is not marked chosen`)
        .toContainText(lang === 'he' ? 'נבחר' : 'chosen');
    }

    // THE COMMAND THAT RAN, on its own row — `description` used to be the only
    // thing kept, and the command was invisible on this screen.
    const ran = page.locator('.tvdeed').filter({ hasText: 'echo 119' }).first();
    await expect(ran).toBeVisible();
    await expect(ran.locator('.tvterm')).toHaveText('echo 119');
    // THE ORDER, which is the second half of the repair: the ACT reads before
    // the prose ABOUT the act, because the prose is written by the same party
    // whose actions are being read. The command is drawn first and on its own,
    // so what is left in the argument list is the prose.
    expect((await ran.locator('.tvarg').allTextContents()).map((t) => t.trim()))
      .toEqual(['description']);

    // THE ROWS THEMSELVES, not `fullPage`. A full-page screenshot RESIZES the
    // viewport, the document's resize handler re-renders the window, and the
    // `<details>` this test just opened comes back closed — so the artifact
    // showed a shut fold while every assertion above had passed. An element
    // screenshot leaves the viewport alone and photographs what was read.
    await ask.screenshot({ path: `e2e/screens/conversations-asked-${lang}.png` });
  });

  /* ══ seq:14 — THE LIST SAYS WHERE IT STANDS, EVEN WHEN IT IS FINE ══════ */

  test(`the list says it is current when nothing has grown (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);

    // **Drawn when the list is CURRENT as well as when it is behind, and that
    // is the rule rather than a nicety.** `seq:14`'s defect was an archive
    // that was over a day stale in front of the owner with nothing saying so;
    // a screen that only speaks up when something is wrong leaves a reader
    // unable to tell a fresh list from a check that has stopped running, which
    // is precisely the state that feature was in. This fixture is rebuilt and
    // never appended to, so the answer here is "current".
    //
    // Scoped to the card that HOLDS THE LIST rather than to `.pane`: the shell
    // draws several, and one of them is the item detail aside.
    const card = page.locator('.card.pane').filter({ has: page.locator('.convrow') });
    await expect(card).toContainText(
      lang === 'he' ? 'מעודכן מול כל קובץ בדיסק' : 'Current with every file on disk');

    // …and nothing claims otherwise. The behind chip and the behind line are
    // the two things that must NOT be here.
    await expect(page.locator('.convrow .chip.warn')).toHaveCount(0);
    await expect(card).not.toContainText(
      lang === 'he' ? 'גדלו מאז הקריאה האחרונה' : 'have grown since they were last read');
  });

  /* ══ seq:7 — ONE SCROLL, AND AN END YOU CAN REACH ══════════════════════ */

  test(`the end of the session is reachable — the defect this replaces (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // The screen used to say "Showing entries 0–50 of 24,757" and there was no
    // way to reach entry 51. There is now no page at all: the count line
    // describes the WHOLE session.
    const count = page.locator('p.tvcount');
    await expect(count).toHaveAttribute('aria-live', 'polite');
    await expect(count).toContainText(String(ROUNDS * 2));

    // Scroll to the very end and read the last thing anybody said.
    //
    // **NAMED, AND THE NAMING WAS EARNED TWICE.** This was
    // `.tvbar button.tvjump` with `.first()`/`.last()`. `plan:archive seq:19`
    // added a third `button.tvjump` — the "N new below" affordance, hidden
    // until turns arrive — and `.last()` began waiting for ever on a control
    // that is correctly invisible; scoping to `.tvbar` fixed that and left the
    // COUNTING in place. The copy controls
    // (`TASK-a-selected-passage-copies-as-something-a-terminal-will`) then
    // landed inside the bar and `.last()` moved again, this time to a button
    // that copies. `button.tvend` cannot be moved by a button that is not End.
    await page.locator('button.tvend').click();
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // …and back to the top, to the first thing.
    await page.locator('button.tvtop').click();
    await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
  });

  test(`only a window of the document is ever in the DOM (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // 480 nodes over 721 records. A viewer that reached the end by drawing all
    // of them would pass the test above and be unusable, which is the answer
    // `seq:7` rules out by name.
    const drawn = await page.locator('.tvscroll .tvrow').count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(80);

    // The scrollbar still describes the whole document: the container is as
    // tall as the model says the whole session is, and the drawn rows are
    // positioned inside it — so the reader scrolls one continuous surface
    // rather than a window that ends.
    const geometry = await page.locator('.tvscroll').evaluate((n) => ({
      scrollHeight: (n as HTMLElement).scrollHeight,
      clientHeight: (n as HTMLElement).clientHeight,
    }));
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight * 5);

    // Scrolling into the middle keeps the DOM the same size — the window
    // moves, it does not grow.
    await page.locator('.tvscroll').evaluate((n) => {
      (n as HTMLElement).scrollTop = (n as HTMLElement).scrollHeight / 2;
    });
    await page.waitForTimeout(400);
    const mid = await page.locator('.tvscroll .tvrow').count();
    expect(mid).toBeLessThan(80);
  });

  test(`content is on screen at every depth, not only at the two ends (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // **THE GUARD FOR THE DEFECT THE FIXTURE COULD NOT FIND.** Driven on the
    // owner's real 61 MB session, the well drew COMPLETELY BLANK at four of
    // seven scroll positions: thirteen rows in the DOM, none of them on
    // screen, no error anywhere. Both tests above passed the whole time — one
    // scrolls to the very end, the other counts rows in the DOM, and neither
    // asks the only question that matters, which is whether the reader can SEE
    // anything.
    //
    // The cause was two positions for one row: the scroller's model and the
    // layout's own, which disagree until every drawn row has been measured.
    // `mountDocument` now positions rows FROM the model, so there is one
    // position; this is what fails if that ever stops being true.
    const blank = await page.evaluate(async () => {
      const well = document.querySelector('.tvscroll') as HTMLElement;
      const out: number[] = [];
      for (const frac of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95, 1]) {
        well.scrollTop = Math.round(well.scrollHeight * frac);
        let seen = 0;
        for (let i = 0; i < 40; i += 1) {
          await new Promise((r) => { setTimeout(r, 150); });
          const box = well.getBoundingClientRect();
          const rows = [...well.querySelectorAll('.tvrow')];
          const visible = rows.filter((row) => {
            const b = row.getBoundingClientRect();
            return b.bottom > box.top + 1 && b.top < box.bottom - 1;
          });
          seen = visible.length;
          if (seen > 0 && !visible.some((row) => row.classList.contains('tvwait'))) break;
        }
        if (seen === 0) out.push(frac);
      }
      return out;
    });
    expect(blank, 'the well drew nothing at these fractions of the document — a virtualised '
      + 'scroll that reaches the end and shows nothing on the way is not a document')
      .toEqual([]);
  });

  /* ══ seq:8 — WHAT THE TERMINAL SHOWED ══════════════════════════════════ */

  test(`a turn renders with its formatting, and terminal colour survives (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // MARKDOWN, not plain text in a box. Measured on the owner's transcript:
    // 175 records carry a fence and ONE carries an ANSI escape, which is why
    // the renderer is the vendored tokeniser and not an ANSI library.
    const said = page.locator('.tvturn.tvclaude .tvsaid').first();
    // `h3`, not `h2`, and that is the renderer's own documented policy rather
    // than a surprise: `lib/markdown.js`' console policy nests a document's
    // headings under the card's own by `min(level + 1, 4)`, which
    // `lib/vendor/VENDOR.md` records as the difference between it and the
    // GitHub view. A turn is content inside a page, so it inherits that.
    await expect(said.locator('h3')).toHaveText('What the terminal showed');
    // `<b>`, not `<strong>`: the console policy's `strong_open` case builds
    // `b`, and the GitHub policy in the same module builds `strong`. Asserted
    // on the RENDERED element, which is how the stylesheet was found to be
    // styling a tag this renderer never emits.
    await expect(said.locator('b')).toHaveText('formatted');
    // Inline code is `<span class="m">` and a fence is a BARE `<pre>` — the
    // console policy's own shapes, not the GitHub policy's `<code>`. These two
    // assertions are what found two dead rules in the stylesheet.
    await expect(said.locator('span.m').first()).toHaveText('code');
    await expect(said.locator('pre')).toContainText('mycontext conversation rebuild');
    await expect(said.locator('table th').first()).toHaveText('column');
    await expect(said.locator('li')).toHaveCount(2);

    // `dir="auto"` is load-bearing: an English turn in the Hebrew page's RTL
    // flow renders its trailing full stop at the WRONG END without it.
    await expect(said).toHaveAttribute('dir', 'auto');

    // ANSI: the escape bytes are gone and the colour they carried is a span.
    await page.locator('.tvscroll').evaluate((n) => { (n as HTMLElement).scrollTop = 1600; });
    await page.waitForTimeout(500);
    // **THE FOLD IS NAMED BY ITS NODE, AND `.first()` IS WHY.** This read
    // `page.locator('.tvwork').first()`, which is a LAZY locator: it is
    // re-resolved on every assertion. Clicking a summary that is above the
    // visible part of the well makes Playwright scroll the well to reach it,
    // the window moves, and "the first fold in the DOM" is then a different
    // element — so the assertion below waited on a fold this test never
    // opened, which is correctly closed and correctly invisible.
    //
    // It survived only because DOM order used to be insertion order, which is
    // arbitrary; `TASK-a-selected-passage-copies-as-something-a-terminal-will`
    // made it DOCUMENT order so that a browser selection runs the way the
    // reader sees it, and `.first()` started tracking the top of the window.
    // A test that names the row it means cannot be moved by a scroll.
    const foldN = await page.locator('.tvwork').first()
      .evaluate((n) => (n as HTMLElement).dataset['n'] ?? '');
    const opened = page.locator(`.tvwork[data-n="${foldN}"]`);
    await opened.locator('summary.tvworksum').click();
    await expect(opened.locator('.tvterm').first()).toBeVisible();
    const escaped = await page.locator('.tvscroll').innerText();
    expect(escaped).not.toContain('\u001b');
    expect(escaped).not.toContain('[22m');
  });

  /* ══ THE FILTER, WHICH NOW SEES THE WHOLE SESSION ══════════════════════ */

  test(`the filter reads the whole session, not a loaded page (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // The needle is in round 71 of 120 — far past any window that was ever
    // loaded, and far past the fifty records the old screen could search.
    await page.locator('input.tvfind').fill('needle only the whole-session');
    await expect(page.locator('.tvscroll')).toContainText(DEEP_PHRASE, { timeout: 20_000 });
    await expect(page.locator('p.tvcount')).toContainText('1');

    await page.locator('input.tvfind').fill('nothing at all matches this');
    await expect(page.locator('p.tvcount'))
      .toContainText(lang === 'he' ? 'שום דבר' : 'Nothing in this session matches');

    await page.locator('input.tvfind').fill('');
    await expect(page.locator('p.tvcount')).toContainText(String(ROUNDS * 2));

    await page.screenshot({ path: `e2e/screens/conversations-search-${lang}.png`, fullPage: true });
  });

  /* ══ THE RTL EDGE, WHICH THIS PROJECT HAS BEEN BURNED BY ═══════════════ */

  test(`the turn accent sits on the reading edge, in this language (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    const side = await page.locator('.tvturn').first().evaluate((node) => {
      const style = getComputedStyle(node as Element);
      return {
        width: style.borderInlineStartWidth,
        colour: style.borderInlineStartColor,
        left: style.borderLeftWidth,
        right: style.borderRightWidth,
      };
    });
    expect(side.width).toBe('3px');
    expect(side.colour).not.toBe('rgba(0, 0, 0, 0)');
    // Under RTL the logical start edge is the RIGHT one. This is the assertion
    // that catches a physical `border-left` written by habit.
    if (lang === 'he') expect(side.right).toBe('3px');
    else expect(side.left).toBe('3px');

    // Nothing in the viewer resolves to a PHYSICAL text alignment — the rule
    // `styles.css`' own header states and `app-layout.spec.ts` enforces on the
    // audit screen. Checked here because this block is new CSS.
    const physical = await page.locator('.tvroot').evaluate((root) => {
      const bad: string[] = [];
      for (const node of [root, ...root.querySelectorAll('*')]) {
        const align = getComputedStyle(node).textAlign;
        if (align === 'left' || align === 'right') bad.push(`${node.className}:${align}`);
      }
      return bad;
    });
    expect(physical, 'a physical text-align in the viewer is a defect under RTL').toEqual([]);

    // And no key is left untranslated: the document's own furniture is in this
    // language, not English wearing a Hebrew page.
    const bar = await page.locator('.tvbar').innerText();
    if (lang === 'he') expect(bar).not.toMatch(/Top|End/);
  });
}

/* ══ seq:18 — THE READER'S OWN CLOCK, IN A BROWSER THAT IS NOT ON UTC ═════ */

/**
 * **THE THREE HOURS, REPRODUCED AND THEN GONE** —
 * `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`.
 *
 * Every other test in this file runs under `playwright.config.ts`'
 * `timezoneId: 'UTC'`, which is right for determinism and is also the one
 * setting under which this defect is INVISIBLE: a UTC reader sees the stored
 * value and the local value agree, so a viewer that never converts passes.
 * That is how it shipped.
 *
 * So this block moves the browser to the owner's own zone and nothing else.
 * `Asia/Jerusalem` is still a PIN — a named zone, not the machine's — so the
 * digits below are as deterministic as every other assertion here; what
 * changes is which reader they are determined for.
 *
 * The fixture's first prompt is `09:00:00Z`, so the number to look for is
 * `12:00`. If this test ever draws `09:00` again, that is the owner's report
 * of three missing hours, arriving before he does.
 */
test.describe('the reader\'s own zone', () => {
  test.use({ timezoneId: 'Asia/Jerusalem' });

  for (const lang of ['en', 'he'] as const) {
    test(`a stamp is converted to the reader's clock and names it (${lang})`, async ({ page }) => {
      await openDocument(page, lang);

      const stamp = page.locator('.tvturn time.tvat').first();
      // THE SHIFT. Three hours, exactly the ones he reported.
      await expect(stamp).toHaveText('2026-09-08 12:00 GMT+3');
      // THE STORED VALUE DID NOT MOVE. `datetime` is still the record's own
      // UTC — a document read by a machine, or exported and read next year,
      // has the instant and not one reader's rendering of it.
      await expect(stamp).toHaveAttribute('datetime', '2026-09-08T09:00:00.000Z');

      // The LIST says the same thing about the same session. `endedAt` is the
      // fixture's last record, `09:07:59Z`, which is `12:07` on this clock —
      // the point being that a reader who looks at both surfaces is not handed
      // a subtraction to do.
      await page.evaluate(() => { location.hash = '#/conversations'; });
      await page.waitForSelector('.convrow', { timeout: 20_000 });
      await expect(page.locator('.convrow').first()).toContainText('2026-09-08 12:07 GMT+3');
    });
  }
});

/* == seq:37 - THE DATE FILTER MEASURES THE READER'S DAY =================== */

/**
 * **A FILTER AND THE COLUMN ABOVE IT, ASKED THE SAME QUESTION IN A BROWSER
 * THAT IS NOT ON UTC** -
 * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`.
 *
 * `seq:10` gave the list `since` and `until` and compared them against the
 * stored UTC instant as a STRING PREFIX. `seq:18` - the block above - moved
 * every stamp on the same screen into the reader's clock and named it. So the
 * list drew `GMT+3` on a row and filed that row under a day computed three
 * hours away, and a reader asking for the date PRINTED ON THE ROW was shown
 * nothing at all.
 *
 * -- ITS OWN ARCHIVE, AND WHY IT CANNOT BORROW THE SHARED ONE -------------
 *
 * The fixture every other test here reads is one session on 2026-09-08, whose
 * UTC day and Jerusalem day are the SAME - under which this defect is
 * invisible, exactly as `timezoneId: 'UTC'` makes it invisible. What is needed
 * is a session whose two days disagree, and a second one on the other side of
 * a DST transition, and neither can be added to the shared file without moving
 * the last phrase that `the end of the session is reachable` rests on. So: its
 * own home, its own cwd, its own server - `the archive says how far behind it
 * is` reached the same conclusion for the same reason.
 *
 * -- WHY BOTH SESSIONS SIT AT 21:30Z --------------------------------------
 *
 * `Asia/Jerusalem` is `GMT+2` in January and `GMT+3` in July. The same wall
 * time is therefore `23:30` on the 15th in one and `00:30` on the 16th in the
 * other - one instant-shape, two days, which no fixed offset can produce.
 *
 *   - the shipped UTC-prefix build files BOTH on the 15th, so the July filter
 *     below draws no row and this is red;
 *   - a "+3 everywhere" build files BOTH on the 16th, so the January filter
 *     draws no row and this is red.
 *
 * The DST half is asserted on the SCREEN as well as through the filter: the
 * two rows carry `GMT+2` and `GMT+3` in one browser, in one session, so the
 * transition is something a reader can see rather than a claim in a comment.
 */
test.describe('a date filter measures the reader’s day', () => {
  test.use({ timezoneId: 'Asia/Jerusalem' });

  let zoned: UiHarness;
  let zonedCwd: string;
  let zonedHome: string;

  /** A short session that ends at `endsAt`. This block is about the LIST. */
  const pair = (title: string, startsAt: string, endsAt: string): unknown[] => [
    { type: 'ai-title', aiTitle: title },
    {
      type: 'user', timestamp: startsAt, gitBranch: 'master',
      message: { role: 'user', content: 'what day is this' },
    },
    {
      type: 'assistant', timestamp: endsAt, gitBranch: 'master',
      message: { role: 'assistant', content: text('the day you are in') },
    },
  ];

  test.beforeAll(async () => {
    zonedHome = mkdtempSync(path.join(tmpdir(), 'e2e-zoned-home-'));
    zonedCwd = mkdtempSync(path.join(tmpdir(), 'e2e-zoned-cwd-'));
    const dir = path.join(zonedHome, 'projects', projectDirName(zonedCwd));
    mkdirSync(dir, { recursive: true });
    // 21:30Z in JANUARY is 23:30 on the 15th - the zone is GMT+2 then.
    writeFileSync(
      path.join(dir, 'sess-winter.jsonl'),
      pair('The January session', '2026-01-15T21:00:00.000Z', '2026-01-15T21:30:00.000Z')
        .map((r) => JSON.stringify(r)).join('\n') + '\n',
    );
    // 21:30Z in JULY is 00:30 on the 16th - the zone is GMT+3 then.
    writeFileSync(
      path.join(dir, 'sess-summer.jsonl'),
      pair('The July session', '2026-07-15T21:00:00.000Z', '2026-07-15T21:30:00.000Z')
        .map((r) => JSON.stringify(r)).join('\n') + '\n',
    );

    process.env['CLAUDE_CONFIG_DIR'] = zonedHome;
    const previous = process.cwd();
    process.chdir(zonedCwd);
    try {
      runCli(['init'], zonedCwd, () => {});
      runCli(['conversation', 'rebuild'], zonedCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    zoned = await startUiChild(zonedCwd);
  });

  test.afterAll(async () => {
    await zoned?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (zonedCwd) removeTree(zonedCwd);
    if (zonedHome) removeTree(zonedHome);
  });

  for (const lang of ['en', 'he'] as const) {
    test(`the day a row is filed under is the day printed on it (${lang})`, async ({ page }) => {
      await page.addInitScript((l) => {
        try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
      }, lang);
      const nonce = await mintNonce(zoned.port);
      await page.goto(`http://127.0.0.1:${zoned.port}/#${nonce}`);
      await page.waitForSelector('.rail', { timeout: 20_000 });
      await page.evaluate(() => { location.hash = '#/conversations'; });
      await page.waitForSelector('.convrow', { timeout: 20_000 });
      await expect(page.locator('#exited')).toBeHidden();

      const card = page.locator('.card.pane').filter({ has: page.locator('.convfilter') });
      const rows = card.locator('.convrow');
      await expect(rows).toHaveCount(2);

      // -- WHAT THE COLUMN SAYS, AND THAT THE ZONE MOVES WITH THE YEAR ------
      await expect(rows.filter({ hasText: 'The July session' }))
        .toContainText('2026-07-16 00:30 GMT+3');
      await expect(rows.filter({ hasText: 'The January session' }))
        .toContainText('2026-01-15 23:30 GMT+2');

      const since = card.locator('.convdate').first();
      const until = card.locator('.convdate').nth(1);
      // The clock named beside the counts, drawn only once a bound is set.
      const clock = card.locator('p.small', {
        hasText: lang === 'he' ? 'התאריכים נספרים' : 'Dates are counted',
      });
      await expect(clock).toHaveCount(0);

      // -- THE DEFECT, RESTATED AS A FILTER ---------------------------------
      //
      // The row above says 2026-07-16. Under the shipped build the same row was
      // filed under 2026-07-15, so asking for the day printed on it drew an
      // empty list.
      await since.fill('2026-07-16');
      await until.fill('2026-07-16');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('The July session');
      // And the screen NAMES the clock those days were counted on, so an empty
      // answer can still say whose day it looked for - `seq:18`'s rule applied
      // to a control instead of to a stamp.
      await expect(clock).toContainText('GMT+3');

      // Not on BOTH days: a bound that merely widened would pass the assertion
      // above and still disagree with the column.
      await since.fill('2026-07-15');
      await until.fill('2026-07-15');
      await expect(rows).toHaveCount(0);
      await expect(card).toContainText(
        lang === 'he' ? 'אף שיחה לא מתאימה' : 'No session matches',
      );
      // The empty answer still says whose day it looked for. This is the one
      // moment the line is not a repeat of the rows, because there are none.
      await expect(clock).toContainText('GMT+3');

      // -- AND THE DST HALF, WHICH AN OFFSET WOULD FAIL ---------------------
      //
      // Same wall time, other side of the transition. Anything that added a
      // fixed three hours files this row on the 16th and draws nothing here.
      await since.fill('2026-01-15');
      await until.fill('2026-01-15');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('The January session');
      // The named clock followed the transition too - GMT+2, and not the GMT+3
      // this same browser was told a moment ago.
      await expect(clock).toContainText('GMT+2');

      await since.fill('2026-01-16');
      await until.fill('2026-01-16');
      await expect(rows).toHaveCount(0);

      // -- BOTH ENDS INCLUSIVE, over a range that holds both ----------------
      await since.fill('2026-01-15');
      await until.fill('2026-07-16');
      await expect(rows).toHaveCount(2);

      await page.screenshot({
        path: `e2e/screens/conversations-zoned-filter-${lang}.png`, fullPage: true,
      });
    });
  }
});

test('the screen is reachable from the rail, under Read', async ({ page }) => {
  await open(page, '#/conversations', 'en');
  const nav = page.locator('.nav[href="#/conversations"], .nav').filter({ hasText: 'Conversations' });
  await expect(nav.first()).toBeVisible();
  await expect(page.locator('.nav[aria-current="page"]')).toContainText('Conversations');
});

/* ══ seq:14 — THE STALENESS LINE, IN A BROWSER ════════════════════════════ */

/**
 * **The deliverable `seq:14` closed without, and named in its own closure as
 * still owed.** That lane built `conv.behind`, `conv.behindRow`,
 * `conv.current`, `conv.refreshedBy` and `staleBytes` on the endpoint, in both
 * languages, and did not touch this file: *"the staleness line is built … and
 * has NO browser test … It is a required deliverable of the next lane on this
 * screen."*
 *
 * **It gets a harness of its own, and that is not caution — it is the only
 * shape that works.** The fixture the rest of this file shares is planted with
 * a last phrase that `the end of the session is reachable` asserts on;
 * appending to it to make the index stale would move that phrase off the end
 * and break the one test this whole file exists for. So: its own home, its own
 * cwd, its own transcript, its own server.
 *
 * The staleness is produced the way the owner's own was — by APPENDING to a
 * transcript AFTER the index was built, and never rebuilding. `seq:14`'s
 * refresh fires on the Stop hook, which no browser test runs, so the index
 * here stays exactly as stale as it was made.
 */
test.describe('the archive says how far behind it is', () => {
  let stale: UiHarness;
  let staleCwd: string;
  let staleHome: string;
  /** Bytes the transcript grew by after the index was built. */
  let grewBy = 0;

  test.beforeAll(async () => {
    staleHome = mkdtempSync(path.join(tmpdir(), 'e2e-stale-home-'));
    staleCwd = mkdtempSync(path.join(tmpdir(), 'e2e-stale-cwd-'));
    const dir = path.join(staleHome, 'projects', projectDirName(staleCwd));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'sess-stale.jsonl');
    // A short session — this test is about the LIST, not the document.
    writeFileSync(file, session().slice(0, 61).map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = staleHome;
    const previous = process.cwd();
    process.chdir(staleCwd);
    try {
      runCli(['init'], staleCwd, () => {});
      runCli(['conversation', 'rebuild'], staleCwd, () => {});
    } finally {
      process.chdir(previous);
    }

    // THE APPEND, after the rebuild and with nothing to refresh it. Sized to
    // land in kilobytes rather than bytes, so the screen's own `sizeText`
    // renders a unit a reader recognises and the assertion below can name it.
    const grew = [];
    for (let i = 0; i < 30; i += 1) {
      grew.push({
        type: 'user',
        message: { role: 'user', content: `written after the index was built (${i}) ${'.'.repeat(200)}` },
        timestamp: new Date(Date.UTC(2026, 8, 8, 10, 0, i)).toISOString(),
      });
    }
    const added = grew.map((r) => JSON.stringify(r)).join('\n') + '\n';
    grewBy = Buffer.byteLength(added);
    appendFileSync(file, added);

    stale = await startUiChild(staleCwd);
  });

  test.afterAll(async () => {
    await stale?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (staleCwd) removeTree(staleCwd);
    if (staleHome) removeTree(staleHome);
  });

  for (const lang of ['en', 'he'] as const) {
    test(`the list says it is behind, by how much, and who fixes it (${lang})`, async ({ page }) => {
      await page.addInitScript((l) => {
        try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
      }, lang);
      const nonce = await mintNonce(stale.port);
      await page.goto(`http://127.0.0.1:${stale.port}/#${nonce}`);
      await page.waitForSelector('.rail', { timeout: 20_000 });
      await page.evaluate(() => { location.hash = '#/conversations'; });
      await page.waitForSelector('.convrow', { timeout: 20_000 });
      await expect(page.locator('#exited')).toBeHidden();

      expect(grewBy).toBeGreaterThan(1024);

      // Scoped to the card that holds the list: the shell draws `.spill`
      // paragraphs of its own — the credential note, the refusal wording — and
      // an unscoped locator resolves to four of them.
      const card = page.locator('.card.pane').filter({ has: page.locator('.convrow') });

      // THE LIST-LEVEL LINE. It names the amount, because "this list is a bit
      // old" is not a fact anybody can act on — the owner's was 11,231,042
      // bytes behind and the screen said nothing at all.
      const behind = card.locator('p.spill');
      await expect(behind).toContainText(
        lang === 'he' ? 'גדלו מאז הקריאה האחרונה' : 'have grown since they were last read');
      await expect(behind).toContainText('KB');

      // WHO REFRESHES IT, and the command a person can run instead of waiting.
      // Composed, never run: this server writes nothing, which is the whole
      // reason the index can be stale in the first place.
      await expect(card).toContainText(
        lang === 'he' ? 'מתרעננת בסוף כל תור' : 'refreshed at the end of each of your turns');
      await expect(card.locator('p.convcmd')).toContainText('mycontext conversation rebuild');

      // THE PER-ROW CHIP. An aggregate line above the list cannot say WHICH
      // session is behind, and a reader scanning a list of sessions has to be
      // able to tell.
      const chip = page.locator('.convrow .chip.warn');
      await expect(chip).toHaveCount(1);
      await expect(chip).toContainText(lang === 'he' ? 'מפגר' : 'Behind by');
      await expect(chip).toContainText('KB');

      // And the fresh half is NOT also drawn. Two lines claiming opposite
      // things about one list is worse than either alone.
      await expect(card).not.toContainText(
        lang === 'he' ? 'מעודכן מול כל קובץ בדיסק' : 'Current with every file on disk');

      await page.screenshot({
        path: `e2e/screens/conversations-stale-${lang}.png`, fullPage: true,
      });
    });
  }
});

/* ══ seq:19 — THE DOCUMENT FOLLOWS A SESSION STILL BEING WRITTEN ══════════ */

/**
 * **A test cannot use the live session, and `seq:19` says why:** *"the session
 * on screen may be the session writing the record of it being on screen. The
 * document grows BECAUSE it is being looked at."* So this describe writes its
 * own transcript and appends to it itself, and watches its own append arrive.
 *
 * The two cases are the two halves of the owner's condition — *"if i am at the
 * end of the file i could see the changes live near real time asap"* — which
 * binds in both directions: at the tail, follow; scrolled up, DO NOT MOVE.
 */
test.describe('the open document follows the session as it is written', () => {
  let live: UiHarness;
  let liveCwd: string;
  let liveHome: string;
  let liveFile: string;
  let clock = 0;

  /** One prompt and one answer, appended to the file the browser is reading. */
  const appendTurn = (phrase: string): void => {
    clock += 1;
    appendFileSync(liveFile, [
      {
        type: 'user',
        message: { role: 'user', content: phrase },
        timestamp: new Date(Date.UTC(2026, 8, 8, 11, 0, clock)).toISOString(),
      },
      { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  };

  test.beforeAll(async () => {
    liveHome = mkdtempSync(path.join(tmpdir(), 'e2e-live-home-'));
    liveCwd = mkdtempSync(path.join(tmpdir(), 'e2e-live-cwd-'));
    const dir = path.join(liveHome, 'projects', projectDirName(liveCwd));
    mkdirSync(dir, { recursive: true });
    liveFile = path.join(dir, 'sess-live.jsonl');
    // Long enough that the document does not fit the viewport, which is what
    // makes "scrolled up" a state this fixture can actually be in.
    writeFileSync(liveFile, session().map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = liveHome;
    const previous = process.cwd();
    process.chdir(liveCwd);
    try {
      runCli(['init'], liveCwd, () => {});
      runCli(['conversation', 'rebuild'], liveCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    live = await startUiChild(liveCwd);
  });

  test.afterAll(async () => {
    await live?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (liveCwd) removeTree(liveCwd);
    if (liveHome) removeTree(liveHome);
  });

  const openLive = async (page: Page, lang: 'en' | 'he'): Promise<void> => {
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(live.port);
    await page.goto(`http://127.0.0.1:${live.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  for (const lang of ['en', 'he'] as const) {
    test(`at the end of the file, a new turn arrives on its own (${lang})`, async ({ page }) => {
      // The poll is one second and the append has to be noticed, read and
      // drawn after it; the default per-test budget is too tight to be honest
      // about that, and this fixture builds a whole server of its own first.
      test.setTimeout(90_000);
      await openLive(page, lang);

      // The document SAYS it is following, and at what cadence — the same
      // disclosure rule the list's "current" line follows, applied to a
      // document that would otherwise update silently or not at all.
      const follows = page.locator('p.tvfollows');
      await expect(follows).toBeVisible();
      // `seq:22` moved the cadence to one second and, with it, the sentence:
      // a `{secs}` slot cannot spell "every 1 seconds" or "כל 1 שניות" in a table
      // with no plural rule, so the number is written into both translations
      // and `test/ui/conversation-follow-cadence.test.ts` is what holds them to
      // `TIP_MS`. It also now discloses the return-to-tab tick, which is the
      // half of the following a reader is most likely to notice.
      await expect(follows).toContainText(lang === 'he' ? 'כל שנייה' : 'every second');

      await page.locator('button.tvend').click();
      await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

      const phrase = `written while the browser was open ${lang}`;
      appendTurn(phrase);

      // NOBODY RELOADED. The document is the same page load it was, and the
      // turn arrives at the bottom on its own — which is the whole request.
      await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 60_000 });

      // AND THE READER IS LOOKING AT IT, not merely holding it in the DOM.
      //
      // Measured against the WELL and not against the browser viewport, which
      // is what `toBeInViewport()` asks and what failed here first: the
      // document well is taller than the window on this fixture, so its own
      // bottom rows are correctly outside the page's viewport while being
      // exactly where the reader's eye is inside the scroll. The band that
      // matters is `.tvscroll`'s, which is the same comparison `content is on
      // screen at every depth, not only at the two ends` makes for the same
      // reason.
      await expect.poll(async () => page.evaluate((needle) => {
        const well = document.querySelector('.tvscroll') as HTMLElement | null;
        if (well === null) return 'no well';
        const box = well.getBoundingClientRect();
        const row = [...well.querySelectorAll('.tvturn')]
          .find((one) => (one.textContent ?? '').includes(needle as string));
        if (row === undefined) return 'not drawn';
        const seen = row.getBoundingClientRect();
        return seen.bottom > box.top + 1 && seen.top < box.bottom - 1 ? 'in the well' : 'off screen';
      }, phrase), {
        timeout: 20_000,
        message: 'a reader who was at the end when a turn arrived must be looking at it, not '
          + 'holding it somewhere below the fold',
      }).toBe('in the well');

      await page.screenshot({
        path: `e2e/screens/conversations-follow-${lang}.png`, fullPage: true,
      });
    });

    test(`a reader who has scrolled up is told, not dragged (${lang})`, async ({ page }) => {
      test.setTimeout(90_000);
      await openLive(page, lang);

      await page.locator('button.tvtop').click();
      await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
      const before = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);

      const phrase = `arrived while they were reading the top ${lang}`;
      appendTurn(phrase);

      // THE AFFORDANCE, not the jump. `seq:19`: "A reader dragged to the
      // bottom mid-sentence has been punished for reading."
      const affordance = page.locator('button.tvnew');
      await expect(affordance).toBeVisible({ timeout: 60_000 });
      await expect(affordance).toContainText(lang === 'he' ? 'חדשים למטה' : 'new below');

      // AND THE READER DID NOT MOVE. This is the assertion the whole item
      // turns on; everything above it is the plumbing that makes it possible.
      const after = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);
      expect(after).toBe(before);
      await expect(page.locator('.tvscroll')).not.toContainText(phrase);

      // …and taking the offer goes to it.
      await affordance.click();
      await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 20_000 });
      await expect(affordance).toBeHidden();
    });
  }

  /**
   * **THE COMPOSITION `seq:23` EXISTS FOR, asserted rather than argued.** The
   * document follows only a reader who is AT THE TAIL — `atTail()` is the gate,
   * and `seq:19`'s ruling is that a reader above the end is never dragged down.
   * While a session opened at record zero that meant the feature the owner
   * asked for did not start until he had travelled to the end himself. Nobody
   * presses anything here: the session is opened, and a turn is appended.
   */
  test('the follow is already running at the moment the session opens', async ({ page }) => {
    test.setTimeout(90_000);
    await openLive(page, 'en');
    // NO `.tvjump` CLICK. That absence is the test.
    await expect(page.locator('button.tvnew')).toBeHidden();

    const phrase = 'arrived without anybody travelling to the end first';
    appendTurn(phrase);
    await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 30_000 });
    // AND THE READER WAS TAKEN WITH IT rather than told about it, because they
    // were at the tail from the first frame.
    await expect(page.locator('button.tvnew')).toBeHidden();
  });

  /* ══ seq:22 — HOW LONG IT ACTUALLY TAKES ═══════════════════════════════ */

  /**
   * **THE NUMBER THE OWNER ASKED ABOUT IS APPENDED-TO-ON-SCREEN, NOT THE
   * INTERVAL.** `seq:19` proved the turn arrives; his ruling on it was about
   * how long that took — *"it should occure immediate as possible"*, sharpened
   * to *"almost after it occured on the terminal — near real time"*. So these
   * two MEASURE, and the assertion is a ceiling on a measurement rather than a
   * restatement of `TIP_MS`. A 1000 ms interval that delivers in 1600 ms is not
   * what the item claims, and only a clock can tell the two apart.
   *
   * **English only, and not because Hebrew matters less.** The quantity is a
   * round trip and a tail read; nothing on the path is language-dependent, and
   * a second copy would double the wall clock of the slowest describe in this
   * file to re-measure the same server.
   *
   * **The ceilings are loose on purpose.** These run headed, several workers
   * deep, on a machine that may be running other lanes — the same contention
   * `playwright.config.ts` measured and capped workers for. A tight bound would
   * report the machine rather than the screen. The numbers are PRINTED either
   * way, so a regression shows up as a number moving even when nothing fails.
   */
  test('a turn appended while the reader watches is on screen within a second or so', async ({ page }) => {
    test.setTimeout(90_000);
    await openLive(page, 'en');
    // **NO JUMP, AND NO HUNT FOR A PLANTED PHRASE.** The document opens at its
    // end since `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`,
    // so there is nothing to press — and this describe appends to ONE shared
    // transcript from several tests, so "the last phrase" is whichever sibling
    // ran last and is not a thing a test may assert on. Being at the tail is
    // the state that matters, and the affordance is how the screen says so: it
    // appears only for a reader who is NOT at the end.
    await expect(page.locator('button.tvnew')).toBeHidden();
    // The tab is in front, which is the condition `shouldPing` gates on and
    // therefore the condition this measurement is about.
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');

    // Three appends, because ONE measures where in the poll period the append
    // happened to land as much as it measures the poll. Three spread across it
    // and the worst of them is the honest headline.
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const phrase = `latency probe ${i} ${Date.now()}`;
      const t0 = Date.now();
      appendTurn(phrase);
      // Polled IN THE PAGE at 25 ms, so the clock reads the screen rather than
      // the test runner's own round trips.
      await page.waitForFunction(
        (needle) => (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
        phrase,
        { polling: 25, timeout: 30_000 },
      );
      seen.push(Date.now() - t0);
      // Clear of the next probe, so two appends never share one tick.
      await page.waitForTimeout(1_500);
    }

    const worst = Math.max(...seen);
    console.log(`[seq:22] appended -> on screen, tab in front: ${seen.join(' ms, ')} ms`);
    // A CEILING, and it is the one the item's arithmetic buys: one poll period
    // plus a `/tip` plus a resumed outline read plus a paint. Four seconds is
    // deliberately generous against a contended machine — the point of the
    // bound is that a regression to the old five-second interval, or to a poll
    // that stopped running, fails here rather than reaching the owner.
    expect(worst).toBeLessThan(4_000);
  });

  /**
   * **THE RETURN TO THE TAB, which is `seq:22`'s first deliverable.** A hidden
   * tab does not ask — `shouldPing`, and that rule does not move — so
   * everything appended while the reader was away is waiting. Before this item
   * the screen then waited for the next SCHEDULED tick, and that is not one
   * interval: Chrome throttles a hidden tab's `setInterval` towards once a
   * minute, so the wait after a return was a throttled period rather than
   * `TIP_MS`. This asserts the screen answers the look in one round trip.
   *
   * ── WHY `visibilityState` IS OVERRIDDEN HERE, WHICH IS A REAL WEAKNESS ────
   *
   * The first draft of this test backgrounded the page with a second tab and
   * `bringToFront()`, and it FAILED — the page stayed `visible`. Measured
   * three ways against Playwright 1.62 on this machine, 2026-09-08, before
   * anything was stubbed:
   *
   *     context.newPage() + other.bringToFront()   both pages report `visible`
   *     window.open('_blank') from the first page  both pages report `visible`
   *     CDP Emulation.setPageVisibilityOverride    'wasn't found' — removed
   *     CDP Page.setWebLifecycleState 'frozen'     still reports `visible`
   *
   * Playwright gives every page its own top-level window rather than a tab, so
   * nothing in the harness can produce a genuinely hidden document. So the
   * property is overridden — and the override is confined to the ONE thing the
   * harness cannot do. Everything else on the path is real: the real
   * `visibilitychange` and `focus` events, the real `onLook` handler, the real
   * `shouldPing` gate reading the property, real requests to `/tip`, a real
   * append on disk and a real repaint.
   *
   * **AND THE FIRST HALF OF THIS TEST IS WHAT KEEPS THAT HONEST.** A stub that
   * the code ignored would show up as the hidden document polling anyway, so
   * the six seconds of silence below is not padding — it is the evidence that
   * the override reaches the gate at all, and it is also the assertion that
   * `seq:22` did not weaken the rule `test/ui/viewmodel.test.ts` states in
   * isolation: a tab nobody is looking at does not ask.
   *
   * What is NOT covered, said rather than implied: the browser's own
   * background-timer throttling. That is what makes the real-world wait much
   * worse than `TIP_MS` and it is exactly the part a test cannot stage.
   */
  test('a reader coming back to the tab is not made to wait for the next tick', async ({ page }) => {
    test.setTimeout(90_000);

    // Added BEFORE `openLive`'s own init script and its navigation, so the app
    // sees the overridden getter from its first line.
    await page.addInitScript(() => {
      let forced: string | null = null;
      Object.defineProperty(Document.prototype, 'visibilityState', {
        configurable: true,
        get(): string { return forced ?? 'visible'; },
      });
      Object.defineProperty(window, '__look', {
        value: (state: string | null) => {
          forced = state;
          // BOTH events, because the screen registers both and the guard that
          // stops them asking twice is the thing worth measuring.
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
        },
      });
    });

    /** Every `/tip` the page asks for, by wall clock. */
    const tips: number[] = [];
    page.on('request', (r) => { if (r.url().includes('/tip')) tips.push(Date.now()); });

    await openLive(page, 'en');
    // **NO JUMP, AND NO HUNT FOR A PLANTED PHRASE.** The document opens at its
    // end since `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`,
    // so there is nothing to press — and this describe appends to ONE shared
    // transcript from several tests, so "the last phrase" is whichever sibling
    // ran last and is not a thing a test may assert on. Being at the tail is
    // the state that matters, and the affordance is how the screen says so: it
    // appears only for a reader who is NOT at the end.
    await expect(page.locator('button.tvnew')).toBeHidden();

    await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
      .__look('hidden'));
    expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');

    const phrase = 'appended while the reader was away';
    const hiddenFrom = Date.now();
    appendTurn(phrase);
    // Six seconds — long enough that the OLD five-second interval would have
    // fired once and the new one six times, had the tab been in front.
    await page.waitForTimeout(6_000);
    const asked = tips.filter((t) => t > hiddenFrom).length;
    expect(asked, 'a hidden tab must not ask, and this is the rule seq:22 must not move').toBe(0);
    expect(await page.evaluate((needle) =>
      (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
    phrase)).toBe(false);

    const t0 = Date.now();
    await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
      .__look(null));
    await page.waitForFunction(
      (needle) => (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
      phrase,
      { polling: 25, timeout: 30_000 },
    );
    const back = Date.now() - t0;
    console.log(`[seq:22] returned to tab -> on screen: ${back} ms`);
    // ONE ROUND TRIP, not one interval and certainly not one throttled
    // interval. The bound is under the 5 s the screen used to wait at BEST,
    // so a regression that deletes the two listeners cannot pass here.
    expect(back).toBeLessThan(3_000);

    // AND EXACTLY ONE ASK IN THAT FIRST MOMENT. `visibilitychange` and `focus`
    // both fired, microseconds apart, and the screen answered once — which is
    // the double-fire guard, load-bearing at a one-second interval and
    // untestable by reading the code.
    const burst = tips.filter((t) => t >= t0 && t < t0 + 300).length;
    console.log(`[seq:22] /tip requests in the 300 ms after the look: ${burst}`);
    expect(burst, 'one look, one ask — visibilitychange and focus must not both fire a tick')
      .toBe(1);
  });

  /**
   * **A BIG JUMP COUNTS RIGHT, and the item asks for this in those words:** the
   * "N new below" affordance must be correct after a long absence, not only
   * after a single turn arriving under a reader who is watching.
   *
   * The failure it guards against is not hypothetical arithmetic. `refill`
   * rebuilds the LAST node rather than skipping past it — an open `work` run
   * that the append extended is a different node now — so the increment is
   * `fresh.length - 1` and not `fresh.length`. That off-by-one is invisible
   * when one turn arrives and one node changes, and it is the whole count when
   * forty do.
   */
  test('after a long absence the count of what arrived is right, not approximately right',
    async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        let forced: string | null = null;
        Object.defineProperty(Document.prototype, 'visibilityState', {
          configurable: true,
          get(): string { return forced ?? 'visible'; },
        });
        Object.defineProperty(window, '__look', {
          value: (state: string | null) => {
            forced = state;
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
          },
        });
      });

      await openLive(page, 'en');
      // SCROLLED UP, which is what makes the count exist at all: a reader at
      // the tail is taken there and never sees a number.
      await page.locator('button.tvtop').click();
      await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });

      await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
        .__look('hidden'));

      // TWENTY turns while away. Each `appendTurn` writes a `user` record and
      // an `attachment` record, and a `said` node closes any open `work` run —
      // so twenty rounds is forty nodes, and the one node that was open at the
      // end of the document is rebuilt rather than added. Forty is therefore
      // the number the screen must say.
      const many = 20;
      for (let i = 0; i < many; i += 1) appendTurn(`a turn that landed while nobody looked ${i}`);
      await page.waitForTimeout(2_000);
      await expect(page.locator('button.tvnew')).toBeHidden();

      const scrolledTo = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);
      await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
        .__look(null));

      const affordance = page.locator('button.tvnew');
      await expect(affordance).toBeVisible({ timeout: 20_000 });
      const said = (await affordance.textContent() ?? '').trim();
      console.log(`[seq:22] after ${many} turns arrived unseen, the screen says: ${said}`);
      // THE NUMBER, not "a number". `{n} new below` with `n` wrong is worse
      // than no affordance, because a reader acts on it.
      expect(said).toContain(`${many * 2} new below`);

      // AND THE READER STILL DID NOT MOVE, which is `seq:19`'s ruling and does
      // not stop applying because a lot arrived at once.
      expect(await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop))
        .toBe(scrolledTo);

      await affordance.click();
      await expect(page.locator('.tvscroll'))
        .toContainText(`a turn that landed while nobody looked ${many - 1}`, { timeout: 20_000 });
      await expect(affordance).toBeHidden();
    });
});

/* ══ seq:19 — A TRANSCRIPT REPLACED UNDER THE READER ══════════════════════
 *
 * Owner report 2026-09-09: he was reading a session and met
 * `conv.doc.replaced` — *"This transcript was replaced rather than added to …
 * Reload the page to read it as it stands."* — and ruled it be fixed.
 *
 * The DIAGNOSIS was right and only the remedy was wrong. A transcript only
 * ever appends, so a smaller file, or the same length with a new `mtime`, is a
 * REWRITE and every byte offset the open document holds points somewhere else.
 * What could not stand is that the only way forward was `F5`, on the one
 * screen whose entire purpose is that nobody has to press it.
 *
 * `seq:19`'s own rule decides who gets which answer, and it is the same gate
 * the ordinary append already runs through: **the follow moves only the reader
 * who is at the end.** At the tail the document is rebuilt against the file as
 * it now stands and the following carries on; above the end, nothing moves and
 * the notice stands.
 *
 * ── WHAT MAKES THE FIRST TEST NON-VACUOUS, WHICH IS THE POINT ────────────
 *
 * Against the code this replaces, `stopWith` cleared the interval and removed
 * the listeners — so a turn appended AFTER the replacement could never arrive,
 * ever, on that page load. The last assertion is therefore false against the
 * old behaviour by construction rather than by luck, and the notice assertion
 * is false against it too. The SECOND test asserts today's behaviour unchanged
 * and is deliberately green either way: it is the guard that the repair did
 * not widen past the reader it was ruled for.
 *
 * ── ITS OWN HARNESS, FOR THE REASON THE STALENESS BLOCK GIVES ────────────
 *
 * This block REPLACES its transcript, and the fixture above it is shared by
 * six tests that append to theirs. A shorter file underneath them would take
 * `LAST_PHRASE` — the phrase this whole file exists to assert on — off the end
 * of a session another test is reading. So: its own home, its own cwd, its own
 * transcript, its own server.
 */
test.describe('a transcript replaced under the reader', () => {
  let swap: UiHarness;
  let swapCwd: string;
  let swapHome: string;
  let swapFile: string;

  /** The file the browser is reading, written SHORTER and with a new ending. */
  const replaceTranscript = (phrase: string): void => {
    const rows: unknown[] = [{ type: 'ai-title', aiTitle: 'The conversation archive' }];
    for (let i = 0; i < 6; i += 1) {
      rows.push({
        type: 'user',
        message: { role: 'user', content: i === 5 ? phrase : `rewritten round ${i}` },
        timestamp: new Date(Date.UTC(2026, 8, 8, 12, 0, i)).toISOString(),
        gitBranch: 'master',
      });
    }
    // SHORTER than what it replaces, so the shrink is a fact about the size
    // and this test never has to rely on filesystem `mtime` granularity.
    writeFileSync(swapFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  };

  const appendTo = (phrase: string): void => {
    appendFileSync(swapFile, `${JSON.stringify({
      type: 'user',
      message: { role: 'user', content: phrase },
      timestamp: new Date(Date.UTC(2026, 8, 8, 13, 0, 0)).toISOString(),
    })}\n`);
  };

  /**
   * The FULL fixture on disk, so the document is taller than the viewport and
   * "scrolled up" is a state this block can actually be in.
   *
   * **Called per test, and that is a consequence of what these tests DO.** The
   * three below share one transcript and one server per worker, and every one
   * of them replaces that transcript with a six-round file — so the second
   * test in a worker would open the leftovers of the first and find neither
   * the round-zero answer it scrolls to nor enough document to scroll. Found
   * by running the file rather than the test: both pass alone.
   */
  const restoreTranscript = (): void => {
    writeFileSync(swapFile, session().map((r) => JSON.stringify(r)).join('\n') + '\n');
  };

  test.beforeAll(async () => {
    swapHome = mkdtempSync(path.join(tmpdir(), 'e2e-swap-home-'));
    swapCwd = mkdtempSync(path.join(tmpdir(), 'e2e-swap-cwd-'));
    const dir = path.join(swapHome, 'projects', projectDirName(swapCwd));
    mkdirSync(dir, { recursive: true });
    swapFile = path.join(dir, 'sess-swap.jsonl');
    restoreTranscript();

    process.env['CLAUDE_CONFIG_DIR'] = swapHome;
    const previous = process.cwd();
    process.chdir(swapCwd);
    try {
      runCli(['init'], swapCwd, () => {});
      runCli(['conversation', 'rebuild'], swapCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    swap = await startUiChild(swapCwd);
  });

  test.afterAll(async () => {
    await swap?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (swapCwd) removeTree(swapCwd);
    if (swapHome) removeTree(swapHome);
  });

  test.beforeEach(() => { restoreTranscript(); });

  const openSwap = async (page: Page, lang: 'en' | 'he'): Promise<void> => {
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(swap.port);
    await page.goto(`http://127.0.0.1:${swap.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  test('at the end, a replaced transcript is rebuilt in place and the follow carries on', async ({ page }) => {
    test.setTimeout(120_000);
    await openSwap(page, 'en');
    await page.locator('button.tvend').click();
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // The head states the size of the file it is built from. It is read now so
    // the rebuild can be shown to have moved it, rather than the test taking
    // the document's own word that it re-read anything.
    const sizeBefore = await page.locator('p.tvfacts').innerText();

    const rewritten = 'the ending of the file that replaced the first one';
    replaceTranscript(rewritten);

    // ── REBUILT, IN PLACE, WITH NOBODY PRESSING ANYTHING ──────────────────
    await expect(page.locator('.tvscroll'))
      .toContainText(rewritten, { timeout: 60_000 });
    // AND THE OLD FILE IS GONE FROM THE SCREEN. A document that spliced the
    // new file onto the old one would still be showing this, and it is the
    // hole the notice existed to refuse.
    await expect(page.locator('.tvscroll')).not.toContainText(LAST_PHRASE);

    // ── AND NO NOTICE, BECAUSE THERE IS NOTHING TO DECIDE ─────────────────
    const follows = page.locator('p.tvfollows');
    await expect(follows).toContainText('every second');
    await expect(follows).not.toContainText('Reload the page');
    await expect(follows).not.toHaveClass(/tvwarn/);

    // ── THE HEAD FOLLOWED THE FILE ────────────────────────────────────────
    // Drawn once at mount, this line would still state the size of a file that
    // no longer exists — a head contradicting the document under it, which is
    // worse than the notice it replaced because nothing would say so.
    await expect.poll(async () => page.locator('p.tvfacts').innerText(), { timeout: 20_000 })
      .not.toBe(sizeBefore);

    // ── AND IT IS STILL FOLLOWING, WHICH IS THE ASSERTION THAT IS FALSE
    //    AGAINST THE OLD BEHAVIOUR ────────────────────────────────────────
    // `stopWith` cleared the interval and removed both look listeners, so this
    // turn could never have arrived on this page load.
    const after = 'appended after the replacement, on the same page load';
    appendTo(after);
    await expect(page.locator('.tvscroll')).toContainText(after, { timeout: 60_000 });

    await page.screenshot({
      path: 'e2e/screens/conversations-replaced-rebuilt.png', fullPage: true,
    });
  });

  for (const lang of ['en', 'he'] as const) {
    test(`a reader above the end is told the transcript was replaced, and not moved (${lang})`, async ({ page }) => {
      // TODAY'S BEHAVIOUR, ASSERTED SO THE REPAIR CANNOT WIDEN PAST THE READER
      // IT WAS RULED FOR. Rebuilding under someone who is mid-document would
      // move their place — `TASK-a-refresh-keeps-the-reader-s-place-or-it-asks`
      // — and `seq:19` already refused it once for the ordinary append.
      test.setTimeout(120_000);
      await openSwap(page, lang);
      await page.locator('button.tvtop').click();
      await expect(page.locator('.tvscroll'))
        .toContainText('What the terminal showed', { timeout: 20_000 });
      const before = await page.locator('.tvscroll')
        .evaluate((n) => (n as HTMLElement).scrollTop);

      const rewritten = `a rewrite they were not at the end for ${lang}`;
      replaceTranscript(rewritten);

      const follows = page.locator('p.tvfollows');
      await expect(follows).toContainText(
        lang === 'he' ? 'טענו מחדש את הדף' : 'Reload the page', { timeout: 60_000 });
      await expect(follows).toHaveClass(/tvwarn/);

      // AND THEY DID NOT MOVE, and are not shown the other file.
      expect(await page.locator('.tvscroll')
        .evaluate((n) => (n as HTMLElement).scrollTop)).toBe(before);
      await expect(page.locator('.tvscroll')).not.toContainText(rewritten);
    });
  }
});

/* ══ seq:20 — THE CHIP GLYPHS, MEASURED IN THE CASCADE ════════════════════ */

/**
 * **`getComputedStyle(el, '::before').content`, kept rather than thrown away.**
 * `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds` was found
 * with exactly this probe and closes by saying that whatever is chosen, this is
 * the guard — because the defect is a SPECIFICITY one and no assertion on
 * markup can see it. Every `data-g` was still in the DOM while six of the eight
 * chip kinds drew their colour's glyph instead.
 *
 * **AND IT ASSERTS THE SCOPE, WHICH IS THE RULING.** Owner ruling 2026-09-08:
 * the `data-g` comes alive on the conversation archive's chips and NOWHERE
 * else, because letting it win everywhere would change glyphs he has read for
 * weeks on Doctor, Decay, Work, Watch and Status. So the half of this test that
 * will look wrong to a future reader — an unmarked `warn` chip must still draw
 * `▲` even with a `data-g` on it — is there on purpose. Two glyph vocabularies
 * coexist deliberately; deleting that assertion is how the ruling gets quietly
 * reversed.
 */
test.describe('a conversation chip draws its own glyph, and only there', () => {
  test('the six kinds that overrode data-g honour it when a chip asks', async ({ page }) => {
    await open(page, '#/conversations', 'en');

    const drawn = await page.evaluate(() => {
      const read = (cls: string, g: string): string => {
        const span = document.createElement('span');
        span.className = cls;
        span.dataset['g'] = g;
        span.textContent = 'probe';
        document.body.append(span);
        const got = getComputedStyle(span, '::before').content;
        span.remove();
        return got;
      };
      const kinds = ['warn', 'crit', 'carry', 'ok', 'gov', 'unmeas', 'index', ''];
      const out: Record<string, { plain: string; glyphed: string }> = {};
      for (const kind of kinds) {
        out[kind === '' ? 'plain' : kind] = {
          plain: read(`chip ${kind}`.trim(), '⦸'),
          glyphed: read(`chip ${kind} glyphed`.trim(), '⦸'),
        };
      }
      return out;
    });

    // WHAT THE ITEM MEASURED, UNCHANGED: an unmarked meaning-coloured chip
    // still wears its colour's glyph, `data-g` or no `data-g`. That is the
    // ruling and not a leftover.
    expect(drawn['warn']?.plain).toContain('▲');
    expect(drawn['crit']?.plain).toContain('■');
    expect(drawn['carry']?.plain).toContain('◇');
    expect(drawn['ok']?.plain).toContain('●');
    expect(drawn['gov']?.plain).toContain('◆');
    expect(drawn['unmeas']?.plain).toContain('◌');
    // …and the two kinds that always honoured it still do.
    expect(drawn['index']?.plain).toContain('⦸');
    expect(drawn['plain']?.plain).toContain('⦸');

    // AND THE OPT-IN WINS ON ALL EIGHT. `.chip.glyphed[data-g]::before` beats
    // the colour classes on SPECIFICITY rather than on source order, which is
    // what stops a future re-ordering of the stylesheet from undoing it.
    for (const kind of Object.keys(drawn)) {
      expect(drawn[kind]?.glyphed, `chip ${kind} glyphed`).toContain('⦸');
    }
  });

  test('the marked chips the shared fixture happens to draw all honour their data-g', async ({ page }) => {
    await open(page, '#/conversations', 'en');

    // **THIS SWEEP IS A NET, NOT THE PROOF.** The shared fixture is a clean
    // session — nothing pruned, nothing capped, no failed step — so it draws
    // few marked chips or none, and a loop over an empty list asserts nothing.
    // The describe below plants a fixture that DOES draw them and is where the
    // claim is actually tested. This one is here because it costs one page load
    // and catches a marked chip that stops honouring its glyph anywhere on this
    // screen, including ones added later.
    for (const where of ['#/conversations', 'document'] as const) {
      if (where === 'document') {
        await page.locator('.convrow').first().click();
        await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
      }
      const marked = await page.evaluate(() =>
        [...document.querySelectorAll('.chip.glyphed')].map((el) => ({
          cls: el.className,
          g: (el as HTMLElement).dataset['g'] ?? '',
          before: getComputedStyle(el, '::before').content,
        })));
      for (const one of marked) {
        expect(one.g, `${one.cls} carries a data-g`).not.toBe('');
        expect(one.before, `${one.cls} draws its own data-g`).toContain(one.g);
      }
    }

    // The synthetic-turn label is the one that always worked, and it is the
    // control: `.chip.index` has no `::before` of its own, so it honours
    // `data-g` through the base rule and needs no opt-in. If this fails, the
    // base rule moved.
    //
    // **NOT `.tvdeed`'s tag, which wears the same classes and is a different
    // claim.** `plan:archive seq:16` gave a promoted command and a promoted
    // question a `chip index tvtag` of their own, so an unqualified `.first()`
    // now finds one of those on this fixture — which would test the base rule
    // against the wrong glyph and say nothing about the synthetic label.
    const tag = page.locator('.tvturn:not(.tvdeed) .chip.index.tvtag').first();
    if (await tag.count() > 0) {
      const before = await tag.evaluate((el) => getComputedStyle(el, '::before').content);
      expect(before).toContain('⌁');
    }

    // And the promoted rows honour THEIR glyphs through the same base rule,
    // which is the property that made reusing `.chip.index` correct rather
    // than convenient.
    const deedTag = page.locator('.tvdeed .chip.index.tvtag').first();
    if (await deedTag.count() > 0) {
      const g = await deedTag.evaluate((el) => (el as HTMLElement).dataset['g'] ?? '');
      const before = await deedTag.evaluate((el) => getComputedStyle(el, '::before').content);
      expect(g).not.toBe('');
      expect(before).toContain(g);
    }
  });
});

/**
 * **THE CHIPS THE ITEM NAMED, DRAWN BY THE SCREEN RATHER THAN BY A PROBE.**
 *
 * The probe above proves the CASCADE; this proves the SCREEN uses it, and the
 * two are different claims — a `data-g` can render perfectly on a chip no call
 * site ever marks. It needs a fixture of its own because the shared session is
 * clean: `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds`
 * lists six dead call sites and not one of them fires on a healthy transcript.
 *
 * So this plants the two that can be made to happen without a new feature:
 *   - a PRUNED row — indexed, then the file deleted, which is what the harness
 *     does to a real transcript and the reason `export` exists at all. `chip
 *     warn` with `data-g="⦸"`, which used to draw `▲`.
 *   - a FAILED STEP — a `tool_result` carrying `is_error`, which is the one
 *     field `shapeOf` reads for it. `chip crit` with `data-g="⚠"`, which used
 *     to draw `■`.
 *
 * **AND A BEHIND ROW, WHICH IS THE CONTROL AND THE POINT.** Appending to the
 * indexed session after the rebuild puts an UNMARKED `chip warn` on the same
 * list as the marked one. Two `warn` chips, side by side, drawing two different
 * glyphs — `▲` and `⦸` — is the owner's ruling as a picture: `data-g` comes
 * alive where a chip asks for it and the colour vocabulary is untouched
 * everywhere else.
 *
 * The one dead call site this cannot reach is `conv.scanCapped`, which needs a
 * 256 MB transcript.
 *
 * **`conv.exported` WAS the second one, and it is not any more.** This comment
 * read *"needs the export `plan:archive` seq:4/5 has not shipped — `source` is
 * hard-coded `'live'` in `conversation-index.ts` today, so no row can carry it
 * yet"*, which was exactly right when it was written and stopped being true on
 * 2026-09-09: `source` now carries `'live'`, `'persisted'` and `'exported'`.
 * The chip is drawn, and its glyph is read off the cascade the way the two
 * below are, in `e2e/conversations-kept.spec.ts` — a fixture of its own,
 * because reaching that state needs a copy taken and a transcript deleted
 * afterwards, which is a different setup from this block's.
 */
test.describe('the archive draws its own glyphs where the item said it did not', () => {
  let glyphs: UiHarness;
  let glyphCwd: string;
  let glyphHome: string;

  test.beforeAll(async () => {
    glyphHome = mkdtempSync(path.join(tmpdir(), 'e2e-glyph-home-'));
    glyphCwd = mkdtempSync(path.join(tmpdir(), 'e2e-glyph-cwd-'));
    const dir = path.join(glyphHome, 'projects', projectDirName(glyphCwd));
    mkdirSync(dir, { recursive: true });

    const at = (s: number): string => new Date(Date.UTC(2026, 8, 8, 13, 0, s)).toISOString();
    const kept = path.join(dir, 'sess-glyph-kept.jsonl');
    writeFileSync(kept, [
      { type: 'user', message: { role: 'user', content: 'the session with a failed step' }, timestamp: at(0) },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'exit 1' } }] },
        timestamp: at(1),
      },
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', is_error: true, content: 'command failed' }] },
        timestamp: at(2),
      },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'that step did not work' }] },
        timestamp: at(3),
      },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');

    const gone = path.join(dir, 'sess-glyph-pruned.jsonl');
    writeFileSync(gone, [
      { type: 'user', message: { role: 'user', content: 'the session the harness later pruned' }, timestamp: at(10) },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'and its answer' }] }, timestamp: at(11) },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = glyphHome;
    const previous = process.cwd();
    process.chdir(glyphCwd);
    try {
      runCli(['init'], glyphCwd, () => {});
      runCli(['conversation', 'rebuild'], glyphCwd, () => {});
    } finally {
      process.chdir(previous);
    }

    // AFTER the index was built, and never rebuilt — which is exactly how the
    // owner's own archive gets into both of these states.
    rmSync(gone);
    appendFileSync(kept, JSON.stringify({
      type: 'user',
      message: { role: 'user', content: `written after the index was built ${'.'.repeat(2000)}` },
      timestamp: at(20),
    }) + '\n');

    glyphs = await startUiChild(glyphCwd);
  });

  test.afterAll(async () => {
    await glyphs?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (glyphCwd) removeTree(glyphCwd);
    if (glyphHome) removeTree(glyphHome);
  });

  const openGlyphs = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
      try { localStorage.setItem('myctx-lang', 'en'); } catch { /* private mode */ }
    });
    const nonce = await mintNonce(glyphs.port);
    await page.goto(`http://127.0.0.1:${glyphs.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  test('two warn chips on one list draw two different glyphs', async ({ page }) => {
    await openGlyphs(page);

    const pruned = page.locator('.convrow .chip.warn.glyphed');
    await expect(pruned).toHaveCount(1);
    await expect(pruned).toContainText('File deleted');
    // THE ASSERTION THE ITEM ASKED FOR, made the way it asked: read the
    // cascade, not the markup. `⦸` was in the DOM before this fix too.
    expect(await pruned.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('⦸');

    // THE CONTROL, on the same screen and in the same colour. An unmarked warn
    // chip still wears `▲`, which is the ruling: the archive's chips changed
    // and the vocabulary the owner reads everywhere else did not.
    const behind = page.locator('.convrow .chip.warn:not(.glyphed)');
    await expect(behind).toHaveCount(1);
    await expect(behind).toContainText('Behind by');
    expect(await behind.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('▲');

    await page.screenshot({ path: 'e2e/screens/conversations-glyphs-en.png', fullPage: true });
  });

  test('a failed step wears a warning sign and not the crit square', async ({ page }) => {
    await openGlyphs(page);
    // The row picked by a CHIP rather than by a title: a row's title is the
    // model's own, and this fixture never gave the model a chance to name one.
    await page.locator('.convrow')
      .filter({ has: page.locator('.chip.warn:not(.glyphed)') }).first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    const bad = page.locator('.tvwork .chip.crit.glyphed').first();
    await expect(bad).toBeVisible({ timeout: 20_000 });
    await expect(bad).toContainText('failed');
    expect(await bad.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('⚠');
    // `■` is what it drew before the opt-in existed. Naming it here is what
    // makes this test fail loudly if the scoping is ever "tidied" away.
    expect(await bad.evaluate((el) => getComputedStyle(el, '::before').content))
      .not.toContain('■');
  });
});

/* ══ seq:23 — A SESSION OPENS WHERE THE WORK IS ═══════════════════════════ */

/**
 * **`TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`.** Owner
 * ruling 2026-09-08: *"when the session is opened in conversation, scroll it to
 * the end by default."* Until then `mountDocument` finished by calling
 * `applyFilter()`, which contains `scroll.scrollTop = 0`, so every session
 * opened at record zero — on the owner's own session, 28,998 records from where
 * he works.
 *
 * **The three tests here are the three ways this goes wrong**, and each is a
 * trap the item named before the code was written:
 *   - the landing is a SUM OF ESTIMATES at mount, so setting `scrollTop` once
 *     lands somewhere that stops being the end the moment the first rows are
 *     measured. Held with `stickUntil`, the way `refill` holds its own.
 *   - the mount path and the FILTER path used to share that one line, and the
 *     filter wants the opposite end. Typing a query must still go to the top.
 *   - a hold is not a pin. A reader who opens a session and scrolls up has said
 *     something, and `seq:19`'s ruling — do not move a reader who is above the
 *     end — does not stop applying in the first three seconds.
 */
test.describe('a session opens at its end', () => {
  for (const lang of ['en', 'he'] as const) {
    test(`the last turn is on screen without anybody pressing End (${lang})`, async ({ page }) => {
      await openDocument(page, lang, 'default');

      // THE RULING, as the reader meets it: the newest turn is in the well.
      await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

      // AND IT HELD. This is the assertion that fails if the landing is set
      // once and hoped for: `scroller.total` is a sum of ESTIMATES at mount and
      // moves under the reader as rows are measured and bodies arrive, so a
      // check taken immediately would pass on a document that has already
      // drifted a screenful up by the time anybody looks. Measured against the
      // well's own scroll box, after the settling window.
      await page.waitForTimeout(1_500);
      const landed = await page.locator('.tvscroll').evaluate((n) => {
        const el = n as HTMLElement;
        return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      });
      expect(landed.max, 'the fixture must be taller than the well, or this proves nothing')
        .toBeGreaterThan(500);
      expect(landed.max - landed.top).toBeLessThan(4);

      // AND THE DISCLOSURE UNDER IT IS READ AND KEPT, in both languages. The
      // cadence sentence lost its `{secs}` slot in `seq:22` — a table with no
      // plural rule cannot spell "every 1 seconds" — so the number is written
      // into the prose, and this is where a human being can look at the result
      // rather than at an assertion about it.
      const follows = page.locator('p.tvfollows');
      console.log(`[seq:22] the note (${lang}): ${(await follows.textContent() ?? '').trim()}`);
      await follows.screenshot({ path: `e2e/screens/conversations-follows-note-${lang}.png` });

      await page.screenshot({
        path: `e2e/screens/conversations-opens-at-end-${lang}.png`, fullPage: true,
      });
    });
  }

  test('typing a query still goes to the top, which is where matches are read from', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // TRAP ONE. `applyFilter` is the input handler as well as the old mount
    // path, and resetting to the top on a filter change is CORRECT. If this
    // ever lands at the bottom, the two paths have been re-joined.
    await page.locator('.tvfind').fill('round 3:');
    await expect(page.locator('.tvscroll')).toContainText('round 3:', { timeout: 20_000 });
    await page.waitForTimeout(1_500);
    expect(await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop)).toBe(0);
  });

  test('a reader who scrolls up as it opens is obeyed, not held', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    const well = page.locator('.tvscroll');
    await expect(well).toContainText(LAST_PHRASE, { timeout: 20_000 });

    /**
     * **THE GAP FROM THE END, never an absolute `scrollTop`.** Two measured
     * failures put it this way. `scroller.total` GROWS while rows are measured
     * and bodies arrive, so an absolute number taken before the document
     * settled compared against a maximum taken after it read as "still at the
     * end" when the reader had moved (chrome, 22508.5 against a 22474
     * maximum). A distance from the end is immune to the total moving.
     */
    const gap = async (): Promise<number> => well.evaluate((n) => {
      const el = n as HTMLElement;
      return (el.scrollHeight - el.clientHeight) - el.scrollTop;
    });

    // **`locator.press`, NOT `keyboard.press` AND NOT `mouse.wheel`.** Both of
    // the cheaper spellings were tried and both failed on the `chrome` project
    // while passing on `chromium`: a single large wheel delta is clamped (170
    // px of a 22,497 px document), and a bare `keyboard.press` goes to whatever
    // holds focus — which is not necessarily the well, and a key that never
    // reaches the well is not the `keydown` this hold listens for. `press` on
    // the locator focuses it first. Pressed repeatedly because one PageUp is
    // one viewport of a document that is still measuring itself.
    await expect.poll(async () => {
      await well.press('PageUp');
      return gap();
    }, {
      timeout: 20_000,
      message: 'PageUp on the well must actually move the reader off the end, or the assertion '
        + 'below proves nothing',
    }).toBeGreaterThan(400);

    // AND THEY STAY THERE. The mount hold is a CEILING released by the reader's
    // own input — `wheel`, `keydown`, `pointerdown` — exactly as the follow's
    // is. If this fails, opening a session has become a pin, which is the wrong
    // `seq:19` in the other direction.
    await page.waitForTimeout(2_000);
    expect(await gap(), 'a reader who took the scroll must not be dragged back to the end')
      .toBeGreaterThan(400);
  });

  test('Top and End still do what they say, with the default moved', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    const well = page.locator('.tvscroll');

    // TOP, pressed INSIDE the hold window. The three release listeners are on
    // the WELL and this button is in the bar above it, so without the handler
    // clearing the hold itself the next paint would put the reader straight
    // back at the end. Top matters more, not less, once the default moves.
    await page.locator('button.tvtop').click();
    await expect(well).toContainText('What the terminal showed', { timeout: 20_000 });
    await page.waitForTimeout(1_500);
    expect(await well.evaluate((n) => (n as HTMLElement).scrollTop)).toBe(0);

    await page.locator('button.tvend').click();
    await expect(well).toContainText(LAST_PHRASE, { timeout: 20_000 });
  });
});

/* ══ seq:15 — A LANE IS OPENED FROM THE TURN THAT DISPATCHED IT ═══════════ */

/**
 * **THE RETURN IS THE REQUIREMENT, NOT THE LINK** — the owner's own words on
 * `plan:archive seq:15`: *"what's important is to let the user return exactly
 * to the cursor point from where it requested to view the subagent content"*.
 *
 * ── WHY THE SHAPE CHOSEN IS THE ONE THAT CAN BE PROVED ────────────────────
 *
 * He left the shape open — *"either as a popup window with the same renderer
 * or a different way"*. What ships is a real `<a target="_blank">`, and the
 * argument is exactly what these tests measure: **the reader's position is not
 * restored, because it is never lost.** The document is not unmounted, not
 * re-laid-out and not scrolled, so there is no arithmetic that can get the
 * return wrong — which matters here more than the phrase "a new tab" suggests,
 * because this scroll is VIRTUALISED: the row a reader is looking at may not
 * be in the DOM, `scroller.total` moves as rows are measured, and a landing
 * computed from a remembered pixel is the defect `atTail()` and `paint`'s
 * anchor node were both written to avoid.
 *
 * ── AND IT IS PROVED IN THE MIDDLE, WHICH IS THE ONLY HONEST PLACE ────────
 *
 * The top and the end are positions a document can land on by accident, so a
 * return proved at either proves nothing. `LANE_ROUND` is 60 of 120 for that
 * reason, and `reachTheLane` walks the reader there through the well's own
 * scroll rather than through a hash.
 */

/** The fold half way down that dispatched a lane, opened, with the reader on it. */
async function reachTheLane(page: Page) {
  const well = page.locator('.tvscroll');
  await expect(well).toContainText(LAST_PHRASE, { timeout: 20_000 });

  // **THE MOUNT LANDING IS A HOLD, and only the reader's own input releases
  // it.** `paint` re-pins to the end for `STICK_MS` after the mount, so a
  // programmatic `scrollTop` inside that window would be undone on the next
  // frame. `press` on the locator focuses the well first, which is what makes
  // this the `keydown` the hold listens for — the note
  // `a reader who scrolls up as it opens is obeyed` records why the cheaper
  // spellings do not work.
  await well.press('PageUp');

  const fold = page.locator('details.tvwork').filter({ has: page.locator('a.tvlane') });
  for (let step = 0; step <= 12; step += 1) {
    // 0.40 → 0.64 of the document. The dispatching turn is round 60 of 120 and
    // the rounds are near enough uniform, so the first or second position
    // draws it; the walk exists so a fixture edit that moves it by a few
    // percent does not turn into a flake.
    const fraction = 0.40 + step * 0.02;
    await well.evaluate((n, f) => {
      const el = n as HTMLElement;
      el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * (f as number));
    }, fraction);
    await page.waitForTimeout(350);
    if (await fold.count() > 0) break;
  }
  expect(await fold.count(), 'the dispatching fold was never drawn between 40% and 64%')
    .toBeGreaterThan(0);

  const one = fold.first();
  await one.locator('summary.tvworksum').click();
  await expect(one.locator('a.tvlane').first()).toBeVisible();
  return one;
}

/** Everything about where the reader is that a return must not disturb. */
const readerPlace = (page: Page): Promise<{
  scrollTop: number; rows: string[]; open: string[];
}> => page.locator('.tvscroll').evaluate((n) => {
  const el = n as HTMLElement;
  return {
    scrollTop: el.scrollTop,
    // The NODES in the DOM and their order — the unit `paint`'s anchor and
    // `atTail()` both work in, and the one that survives a re-sum. A pixel
    // alone would pass on a document that had silently rebuilt every row.
    rows: [...el.querySelectorAll('.tvrow')].map((r) => (r as HTMLElement).dataset['n'] ?? ''),
    open: [...el.querySelectorAll('details.tvwork')]
      .filter((d) => (d as HTMLDetailsElement).open)
      .map((d) => (d as HTMLElement).dataset['n'] ?? ''),
  };
});

for (const lang of ['en', 'he'] as const) {
  test(`the turn that dispatched a lane opens it, and the reader does not move (${lang})`, async ({ page }) => {
    await openDocument(page, lang, 'default');
    const fold = await reachTheLane(page);

    // THE LINK IS ON THE STEP, beside the brief that step already carries.
    const link = fold.locator('a.tvlane').first();
    // **AND IT NAMES A PAGE OF ITS OWN SINCE `seq:51`.** It used to be
    // `#/conversations/agent-outer` — the whole application at a lane address,
    // which is the defect the owner reported: *"what i meant is to only see the
    // viewer with the transcript in it as a single window without all the app
    // arround it"*. `/lane.html` is that window; `a lane opens BARE` below is
    // the assertion that it really has no shell around it.
    await expect(link).toHaveAttribute('href', '/lane.html?id=agent-outer');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    // The label says where it opens rather than leaving that to be discovered,
    // and it says it in the reader's own language.
    await expect(link).toContainText(lang === 'he' ? 'לשונית חדשה' : 'new tab');
    // The brief `seq:24` captured is on the same step, which is why the link
    // belongs here rather than in a list of lanes somewhere else on the page.
    await expect(fold).toContainText(LANE_BRIEF);

    // **AND WHAT KIND OF WORKER IT IS, BESIDE IT** — `plan:archive seq:50`.
    // This is the step in the SESSION's own 120-round document, half way down,
    // which is the screen the owner was on when he reported that the name he
    // knows from the terminal was nowhere near the agent. `general-purpose`
    // here and `Explore` on the depth-2 step below: the value is the lane's
    // own, in the reader's own language.
    const kind = fold.locator('p.tvstephead .tvkind').first();
    await expect(kind.locator('.m')).toHaveText('general-purpose');
    await expect(kind).toContainText(lang === 'he' ? 'סוג' : 'type');

    // ── THE MEASUREMENT ────────────────────────────────────────────────────
    const before = await readerPlace(page);
    expect(before.scrollTop, 'this must be a DEEP offset or the return proves nothing')
      .toBeGreaterThan(2_000);

    const [lane] = await Promise.all([
      page.waitForEvent('popup'),
      link.click(),
    ]);
    await lane.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(lane.locator('.tvscroll')).toContainText(LANE_PHRASE, { timeout: 20_000 });

    // A tab of its own, the SAME renderer, and it says what it is: a helper's
    // transcript rather than a session, with the session it came from named.
    await expect(lane.locator('p.tvlaneof')).toBeVisible();
    // Root-absolute since `seq:51`, and that is load-bearing rather than tidy:
    // this link is now written on `/lane.html`, where a bare
    // `#/conversations/<id>` would resolve against the lane window itself and
    // point the reader back at the page they are already on.
    await expect(lane.locator('a.tvlanehome')).toHaveAttribute('href', '/#/conversations/sess-archive');
    await lane.locator('.tvroot').screenshot({ path: `e2e/screens/conversations-lane-${lang}.png` });
    await lane.close();

    // AND THE READER IS EXACTLY WHERE THEY WERE — the same pixel, the same
    // nodes in the same order, and the fold they opened still open. Nothing
    // was restored; nothing was disturbed.
    await page.waitForTimeout(1_500);
    const after = await readerPlace(page);
    expect(after.scrollTop, 'the same pixel, not a near-enough one').toBe(before.scrollTop);
    expect(after.rows).toEqual(before.rows);
    expect(after.open, 'a `<details>` the reader opened survives the round trip').toEqual(before.open);
  });
}

test('a lane at depth 2 is reachable, because the roster is the SESSION own', async ({ page }) => {
  // Opened directly, which is what a second tab is. `agent-outer`'s own
  // dispatching call lives in `agent-outer.jsonl` and NOWHERE in the session's
  // file, so a build that asked `/subagents` for the document's own id would
  // draw this page with no link at all — and it would look exactly like a lane
  // that dispatched nothing. 43 of this workspace's 254 real lanes are this
  // shape.
  await open(page, '#/conversations/agent-outer', 'en');
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  const fold = page.locator('details.tvwork').filter({ has: page.locator('a.tvlane') }).first();
  await expect(fold).toHaveCount(1);
  await fold.locator('summary.tvworksum').click();
  const deeper = fold.locator('a.tvlane').first();
  await expect(deeper).toHaveAttribute('href', '/lane.html?id=agent-inner');

  const [inner] = await Promise.all([
    page.waitForEvent('popup'),
    deeper.click(),
  ]);
  await expect(inner.locator('.tvscroll')).toContainText(DEEP_PHRASE_LANE, { timeout: 20_000 });
  await inner.close();
});

/* ══ seq:51 — A LANE OPENS BARE, AND HIS SESSION DOES NOT ══════════════════
 *
 * Owner ruling 2026-09-09, correcting what he meant by a new tab: *"you did
 * opened it on a new tab but what you did is actually another tab of mycontext
 * with focus on the viewer where the linked transcript was opened, what i
 * meant is to only see the viewer with the transcript in it as a single window
 * without all the app arround it"* — and, taken the same day after both
 * alternatives were put to him and declined (both documents bare, and a
 * per-reading toggle), **only a LANE opens that way.**
 *
 * ── WHY THE SESSION HALF IS ASSERTED IN THE SAME TEST ────────────────────
 *
 * Because it is the half that can regress silently. A bare lane window is
 * visible the moment anyone looks at it; a session that quietly lost its strip
 * would only be noticed by the one person who uses those instruments. So the
 * opener is measured HERE, in the same act, after the window it spawned has
 * been proved bare: the same page, before and after, with the rail, the header
 * and the strip still on it.
 *
 * ── AND THE ADDRESS DOES NOT DECIDE THE SHAPE ────────────────────────────
 *
 * The ruling's own words are that the shape follows from WHAT is being opened,
 * and `rowFor` is what answers that. `/lane.html?id=<a session>` is therefore
 * not a way to strip his session: `lane.js` re-asks the read model on arrival
 * and hands a session back to the application. The last block drives exactly
 * that, because an address that could take away the instruments would make the
 * ruling a convention rather than a mechanism.
 */
for (const lang of ['en', 'he'] as const) {
  test(`a lane opens BARE and the session it came from keeps its chrome (${lang})`, async ({ page }) => {
    await openDocument(page, lang, 'default');

    // THE SESSION, BEFORE. The three pieces of chrome the ruling names, on the
    // document he works in.
    await expect(page.locator('#topbar')).toBeVisible();
    await expect(page.locator('.rail')).toBeVisible();
    await expect(page.locator('#strip')).toBeVisible();

    const fold = await reachTheLane(page);
    const [lane] = await Promise.all([
      page.waitForEvent('popup'),
      fold.locator('a.tvlane').first().click(),
    ]);
    await lane.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    // ── THE WINDOW IS A PAGE OF ITS OWN ───────────────────────────────────
    expect(new URL(lane.url()).pathname).toBe('/lane.html');
    await expect(lane.locator('body')).toHaveClass(/lanewin/);

    // ── AND THERE IS NO APPLICATION IN IT ─────────────────────────────────
    // Counted, not merely hidden: the shell keeps every visited screen inside
    // `#screen` and merely flips `hidden`, so "not visible" is the assertion a
    // second tab of the app would also pass. `toHaveCount(0)` is the one that
    // says the shell was never built here at all.
    for (const gone of ['#app', '#topbar', '.rail', '#screen', '#strip', '#prov', '#pane',
      '#sesspop', '#focuspop', '#exited']) {
      await expect(lane.locator(gone), `${gone} must not exist in a bare lane window`)
        .toHaveCount(0);
    }

    // ── WHAT IT LOST IS THE APPLICATION, NOT THE PROVENANCE ───────────────
    // A window with no rail still has to say WHICH lane it is and offer a way
    // back. Both were already built by `seq:15` and `seq:40`; this is where
    // they stop being decoration and become the only orientation there is.
    await expect(lane.locator('p.tvlaneof')).toBeVisible();
    await expect(lane.locator('a.tvlanehome')).toBeVisible();
    await expect(lane.locator('button.tvback')).toBeVisible();

    // ── THE SAME RENDERER, WHICH IS THE TRAP THIS ITEM CARRIES ────────────
    // `/doc.html` is drawn by `githubNodes` and emits a bare `code` for inline
    // code; this document is drawn by `markdownNodes` and emits `span.m`. A
    // lane rendered through that page's renderer would have lost the inline
    // hue, the fence colouring, the folds and the terminal rendering — and it
    // would still have looked like a transcript. `.tvturn` and a fold are the
    // cheap proof that `mountDocument` itself drew this.
    await expect(lane.locator('.tvscroll .tvturn').first()).toBeVisible();
    await expect(lane.locator('.tvbar button.tvtop')).toBeVisible();
    // The reader's own language reached the window: the string tables and
    // `applyLanguage` live on this page too, so an RTL reader is not handed an
    // LTR window drawn in English.
    await expect(lane.locator('html')).toHaveAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');

    // ── AND THE WELL TOOK THE ROOM THE CHROME GAVE UP ─────────────────────
    // `.tvscroll` is `min(70vh,860px)` inside the app, which is right there
    // and wrong here: a window whose whole content is one document would sit
    // with a third of itself empty. `body.lanewin` re-sizes it and nothing
    // else, so this is the assertion that the chrome was REPLACED rather than
    // merely deleted.
    const fit = await lane.evaluate(() => {
      const root = document.querySelector('.tvroot') as HTMLElement;
      const well = document.querySelector('.tvscroll') as HTMLElement;
      return {
        below: window.innerHeight - root.getBoundingClientRect().bottom,
        share: well.getBoundingClientRect().height / window.innerHeight,
        wide: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(fit.below, 'a band of nothing under the document is the defect `#prov` already cost once')
      .toBeLessThan(60);
    expect(fit.share, 'the well took the room the rail and the strip gave up')
      .toBeGreaterThan(0.55);
    // And the window does not scroll sideways. `.tvbar` wraps and `.tvscroll`
    // is `contain:inline-size`, both for measured defects in the app; a page
    // with no rail is a WIDER column than either was written against, so the
    // guarantee is re-taken here rather than inherited.
    expect(fit.wide, 'a lane window must not scroll sideways').toBeLessThanOrEqual(0);

    // The WINDOW, not the element — this is the picture the owner asked for,
    // so what is captured is what he would see.
    await lane.screenshot({ path: `e2e/screens/lane-window-${lang}.png` });

    // ── AND A LANE INSIDE A LANE IS BARE TOO, WHICH IS WHERE A RELATIVE
    //    ADDRESS WOULD HAVE BROKEN ───────────────────────────────────────────
    // `agent-outer` dispatched `agent-inner`, the shape 43 of this workspace's
    // 264 lanes have. Every address written by `mountDocument` is now resolved
    // against `/lane.html` rather than against `/`, so this is the assertion
    // that none of them is a bare fragment: a `#/conversations/<id>` href here
    // would silently address the lane window itself.
    const inner = lane.locator('details.tvwork').filter({ has: lane.locator('a.tvlane') }).first();
    await inner.locator('summary.tvworksum').click();
    const deeper = inner.locator('a.tvlane').first();
    await expect(deeper).toHaveAttribute('href', '/lane.html?id=agent-inner');
    const [nested] = await Promise.all([
      lane.waitForEvent('popup'),
      deeper.click(),
    ]);
    await nested.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    expect(new URL(nested.url()).pathname).toBe('/lane.html');
    await expect(nested.locator('.rail')).toHaveCount(0);
    await expect(nested.locator('p.tvlaneof')).toBeVisible();
    await nested.close();

    await lane.close();

    // ── THE SESSION, AFTER. NOT ONE PIECE OF IT MOVED ─────────────────────
    await expect(page.locator('#topbar')).toBeVisible();
    await expect(page.locator('.rail')).toBeVisible();
    await expect(page.locator('#strip')).toBeVisible();
    await expect(page.locator('#app')).toHaveCount(1);
  });
}

test('the bare address is not a way to strip a SESSION — the read model decides, not the URL', async ({ page }) => {
  // The ruling forbids a mode, a preference or a query parameter that chooses
  // the shape: it follows from WHAT is being opened, and `rowFor` is what
  // answers that. So a session id handed to the lane window — a hand-typed
  // address, a stale link, a bookmark from a future in which this widened —
  // is handed back to the application rather than drawn with no instruments.
  await open(page, '#/conversations', 'en');
  await page.goto(`http://127.0.0.1:${harness.port}/lane.html?id=sess-archive`);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  expect(page.url()).toContain('#/conversations/sess-archive');
  expect(new URL(page.url()).pathname, 'a session is handed back to the app, not drawn bare')
    .toBe('/');
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('#strip')).toBeVisible();

  // AND AN ADDRESS THAT NAMES NO LANE AT ALL SAYS SO, in the reader's own
  // language, rather than leaving a blank window —
  // `INV-nothing-is-dropped-silently`. It is also what keeps
  // `conv.doc.noLane` from being a string nothing draws.
  await page.goto(`http://127.0.0.1:${harness.port}/lane.html`);
  await expect(page.locator('#lane .tvroot p.spill')).toContainText('names none');
  await expect(page.locator('.rail'), 'and it is still not the application').toHaveCount(0);
});

/**
 * **THE LOOK TICK IS EXERCISED ON TWO PAGES, AND THIS IS THE SECOND ONE** —
 * `plan:archive seq:29`.
 *
 * `lane.js` imports `mountDocument` and forks nothing, so the follow timer, the
 * visibility gate and the look pair all run in a window with no shell around
 * them. Until now every assertion about any of that was made on `/#/conversations`
 * — where `app.js` ALSO registers a look pair of its own, through
 * `startHeartbeat` and `startLookTicks`. That is the measurement gap this
 * closes: a conversation document that had quietly lost its own pair would
 * still look fast on the app page, because the shell's `/api/ping` and the
 * stream reopen fire on the same two events and the document's next scheduled
 * tick is only a second behind. On `/lane.html` there is no heartbeat, no
 * stream and no shell at all, so the only thing that can turn a return to the
 * tab into a `/tip` is the document's own `onLook`.
 *
 * **Why this is the test seq:29 owed.** That item moved the event PAIR out of
 * this screen and into `lib/heartbeat.js`' `attachLook` — one registration, one
 * removal, taken from the module that already owned the rule. The unit tests
 * prove the seam and the pair; what neither can prove is that the adoption
 * still fires in a browser on the page that has nothing else to cover for it.
 *
 * `visibilityState` is overridden for `openLive`'s measured reason, recorded in
 * full on `a reader coming back to the tab is not made to wait`: Playwright
 * gives every page its own top-level window, so nothing in the harness can make
 * a document genuinely hidden. Everything else here is real — the real events,
 * the real gate, the real debounce against the shared `askedAt`, and real
 * requests to `/tip`.
 */
test('the bare lane window runs the same look tick, and nothing else on it could', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    let forced: string | null = null;
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get(): string { return forced ?? 'visible'; },
    });
    Object.defineProperty(window, '__look', {
      value: (state: string | null) => {
        forced = state;
        // BOTH events, because `attachLook` registers both — and the guard that
        // stops one return asking twice is the thing worth measuring.
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      },
    });
  });

  /** Every `/tip` this window asks for, by wall clock. */
  const tips: number[] = [];
  page.on('request', (r) => { if (r.url().includes('/tip')) tips.push(Date.now()); });

  // **THE APP FIRST, FOR THE CREDENTIAL AND NOTHING ELSE** — the same order
  // `the bare address is not a way to strip a SESSION` uses, and for the reason
  // `lane.js` records: that page exchanges no nonce, it rides the `Path=/`
  // `mycontext_token` cookie the shell's bootstrap set. A first visit straight
  // to `/lane.html` has no cookie and draws the server's refusal instead of a
  // document — measured here, 2026-09-10, as a 20 s wait for `.tvturn`.
  await open(page, '#/conversations', 'en');
  await page.goto(`http://127.0.0.1:${harness.port}/lane.html?id=agent-outer`);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  // There is no application here to ask on this document's behalf, which is the
  // whole point of measuring on this page.
  await expect(page.locator('#strip')).toHaveCount(0);

  // ── IT FOLLOWS AT ALL. A bare window is still a followed document. ───────
  const opened = Date.now();
  await page.waitForTimeout(2_500);
  const polled = tips.filter((t) => t > opened).length;
  expect(polled, 'a lane window follows its transcript like the screen does').toBeGreaterThan(0);

  // ── AND A HIDDEN ONE ASKS NOTHING, which is §2 and not this page's to bend.
  await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
    .__look('hidden'));
  expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');
  const hiddenFrom = Date.now();
  await page.waitForTimeout(3_000);
  expect(tips.filter((t) => t > hiddenFrom).length,
    'a forgotten lane window must not hold the server up').toBe(0);

  // ── THE RETURN IS ONE ASK, AND IT ARRIVES AT ONCE ───────────────────────
  // One ask is `attachLook` registering the pair and `onLook` debouncing it
  // against the `askedAt` the scheduled tick writes; arriving at all is the
  // registration not having been lost on the way into the shared module.
  const t0 = Date.now();
  await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
    .__look(null));
  await page.waitForTimeout(300);
  const burst = tips.filter((t) => t >= t0 && t < t0 + 300).length;
  console.log(`[seq:29] /lane.html /tip requests in the 300 ms after the look: ${burst}`);
  expect(burst,
    'one look, one ask — the pair fires twice and the bare window must answer once')
    .toBe(1);

  // ── AND A LOOK THAT LANDS JUST AFTER A SCHEDULED TICK IS DROPPED ─────────
  //
  // **THIS IS THE ASSERTION THAT SAYS WHY `startLookTicks` IS NOT WHAT THIS
  // SCREEN USES** — `plan:archive seq:29`. The block above passes under either
  // clock: the tab was hidden for three seconds, so the last ask is long past
  // and any debounce lets the first of the pair through. The collision that
  // separates them is a look arriving while a SCHEDULED `/tip` is still fresh,
  // and only a clock the scheduled tick also writes — `askedAt` — can see it.
  // A look-only ticker's private `firedAt` would not, and this bare window
  // would ask twice inside a quarter of a second for one glance at it.
  //
  // Staged rather than waited for: the look is fired the instant a scheduled
  // ask is observed, which is the worst case and the one that is otherwise a
  // one-in-four accident at this cadence.
  const scheduled = tips.length;
  for (let waited = 0; waited < 60 && tips.length === scheduled; waited += 1) {
    await page.waitForTimeout(25);
  }
  expect(tips.length, 'the visible window is polling again, or there is no tick to collide with')
    .toBeGreaterThan(scheduled);
  const justAsked = tips[tips.length - 1] as number;
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(250);
  const doubled = tips.filter((t) => t > justAsked && t < justAsked + 250).length;
  console.log(`[seq:29] extra /tip asks caused by a look within 250 ms of a tick: ${doubled}`);
  expect(doubled,
    'a look inside LOOK_GAP_MS of a SCHEDULED ask must be dropped — the gap is measured against '
    + 'the clock the scheduled tick writes, not against a private one')
    .toBe(0);
});

/**
 * **WHAT KIND OF AGENT IT IS, AND WHAT THAT ONE WAS ASKED TO DO — TWO FIELDS
 * ON THE SAME LINE** — `plan:archive seq:50`.
 *
 * Owner report 2026-09-09, after clicking through to a lane successfully:
 * *"near the agent there was no name like the names i see on the terminal that
 * mostly starts with general purpose"*. The document drew the BRIEF and never
 * the KIND, so the one name he already recognised was the one that was
 * missing. These two tests ask, on both surfaces, whether a reader can now see
 * both — the fields are asserted as SEPARATE runs, because a row that says
 * only one of them is the state being reported and so is a sentence that has
 * glued them together.
 *
 * ── WHY THE DEPTH-2 STEP IS THE ONE THAT PROVES WHERE THE VALUE CAME FROM ──
 *
 * `DEEP_CALL`'s input carries `prompt` and NO `subagent_type`, and that is not
 * a gap in the fixture — measured on this project's own session files,
 * 2026-09-09: **227 `Agent` calls, 227 with a `description`, 214 with a
 * `subagent_type`.** Thirteen dispatchers named no type at all. So a build that
 * drew this field out of the step's own arguments would draw nothing here,
 * while the sidecar carries `agentType` for 269 of 269 indexed lanes and
 * `/subagents` already serves it. The type below is therefore proof that the
 * roster answered, not the call.
 *
 * ── AND IT IS `Explore`, WHICH IS WHY THE FIELD IS NOT COSMETIC ────────────
 *
 * The item warns that every lane in this corpus is `general-purpose` and that a
 * constant field is still a field. Re-measured over the whole index it is not
 * even constant: **269 lanes, 8 distinct types — 233 `general-purpose`, 21
 * `Explore`, 8 `fork`, 7 across five plugin agents.** The fixture's two lanes
 * are one of each shape for exactly that reason, so an implementation that
 * hard-coded the common word would go red here.
 */
for (const lang of ['en', 'he'] as const) {
  test(`a dispatching step says what KIND of agent it opened, beside the brief (${lang})`, async ({ page }) => {
    // Opened directly on the depth-1 lane, whose single dispatching turn needs
    // no scroll walk: this test is about one line of text, and
    // `the turn that dispatched a lane opens it` above already proves the same
    // field on the session's own 120-round document, in the reader's place.
    await open(page, '#/conversations/agent-outer', lang);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    const fold = page.locator('details.tvwork').filter({ has: page.locator('a.tvlane') }).first();
    await fold.locator('summary.tvworksum').click();

    // ONE LINE, and the type is ON it — beside the link and beside the brief,
    // which is where the reader is looking when they decide whether to open
    // the lane at all.
    const line = fold.locator('p.tvstephead').filter({ has: page.locator('a.tvlane') }).first();
    await expect(line.locator('a.tvlane')).toBeVisible();
    const kind = line.locator('.tvkind');
    await expect(kind, 'the kind of worker, on the dispatching step').toBeVisible();
    // THE VALUE, in its own monospace isolated run: an identifier, and on the
    // Hebrew page an identifier that is not isolated is reordered.
    await expect(kind.locator('.m')).toHaveText('Explore');
    // THE LABEL, in the reader's own language, so the run is a named field and
    // not a second identifier sitting between two others.
    await expect(kind).toContainText(lang === 'he' ? 'סוג' : 'type');
    // NOT the common word, which is what a hard-coded label would have said.
    await expect(kind).not.toContainText('general-purpose');

    // AND THE OTHER FIELD IS STILL ITS OWN FIELD. `.tvdetail` is what this
    // step was ASKED; `.tvkind` is what KIND was asked. Two runs, two facts.
    const detail = line.locator('.tvdetail');
    await expect(detail).toHaveText('go one level deeper');
    await expect(detail).not.toContainText('Explore');

    // ── WHERE THE VALUE CAME FROM, ASSERTED AND NOT ASSUMED ───────────────
    // This call recorded no `subagent_type`, so the arguments below cannot be
    // the source. 13 of the owner's 227 `Agent` calls are this shape.
    const argNames = await fold.locator('.tvarg').allInnerTexts();
    expect(argNames, 'the fixture call must carry no type of its own, or this proves nothing')
      .not.toContain('subagent_type');
  });
}

test('a roster row carries the kind of agent and its brief as two fields', async ({ page }) => {
  // The roster is `seq:41`'s, and it already drew the type — as a bare
  // monospace run between the id and the record count, where it read as a
  // second identifier. It is now the same named field the document draws.
  await open(page, '#/conversations/lanes/sess-archive', 'en');
  await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
  // `.rows`-scoped, as every other roster assertion in this file is: the
  // router keeps every visited screen inside `#screen`, merely hidden, so a
  // page-wide `.convrow` can lock onto a row the reader cannot see.
  const rows = page.locator('.rows .convrow');
  await expect(rows).toHaveCount(2);

  // THE PARENT: `general-purpose`, the word the owner recognises.
  await expect(rows.nth(0).locator('.convtitle')).toHaveText('Read the index');
  await expect(rows.nth(0).locator('.convmeta .tvkind .m')).toHaveText('general-purpose');
  await expect(rows.nth(0).locator('.convmeta .tvkind')).toContainText('type');

  // THE CHILD: a different type on the same screen, which is the whole reason
  // the field is worth drawing — an `Explore` lane and a `general-purpose` one
  // are told apart here and nowhere else on this row.
  await expect(rows.nth(1).locator('.convtitle')).toHaveText('One level deeper');
  await expect(rows.nth(1).locator('.convmeta .tvkind .m')).toHaveText('Explore');

  // THE BRIEF IS NOT THE TYPE AND THE TYPE IS NOT THE BRIEF — the row's title
  // says what this one was asked to do and carries no type in it.
  await expect(rows.nth(1).locator('.convtitle')).not.toContainText('Explore');
});

test('a session that dispatched lanes says so on its list row', async ({ page }) => {
  await open(page, '#/conversations', 'en');
  // `seq:12` put the count on every row so the list is answerable without a
  // second request; `seq:15` is what makes it worth having. Two lanes: the one
  // the session dispatched and the one its own lane did.
  await expect(page.locator('.convrow').first()).toContainText('2 helper agents');
});

/* ══ seq:53 — THE COUNT ON THE LIST ROW IS A LINK, AND THE ROW IS STILL ONE
 *            TARGET ══════════════════════════════════════════════════════════
 *
 * `seq:41` made the count a control in the DOCUMENT and wrote down why it could
 * not do the same on the list: the row was a `<button>`, and an anchor inside
 * one is markup a browser un-nests. `seq:47` was then asked for the stylesheet
 * and refused, because the control did not exist. So the row was rebuilt as a
 * CONTAINER WITH TWO CONTROLS — and the risk that carries is that the second
 * one makes the first harder to hit, which would be a worse screen than the one
 * that had a dead number on it.
 *
 * Both tests below are therefore about the ROW as much as about the link, and
 * each was run against the un-rebuilt row and watched go red in both projects.
 */
for (const lang of ['en', 'he'] as const) {
  test(`the lane count on a list row opens the roster and not the session (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);
    const row = page.locator('[data-p]:not([hidden]) .convrow').first();
    const count = row.locator('a.convlanelink');

    // A REAL ANCHOR WITH A REAL ADDRESS, which is the half of this that a
    // reader can copy, middle-click or bookmark without a line of script.
    await expect(count).toHaveCount(1);
    await expect(count).toHaveAttribute('href', '#/conversations/lanes/sess-archive');
    // The same keyed words the document's own roster control uses, so the two
    // controls that go to the same place cannot come to say different things.
    await expect(count).toHaveText(lang === 'en' ? '2 helper agents' : '2 סוכני עזר');

    // **EVERY ADDRESS THE PAGE PASSES THROUGH, not just the one it lands on.**
    // A first draft of this asserted that the document viewer's well was never
    // built, and that assertion was VACUOUS: with the row's handler put back on
    // the container — the regression it is meant to catch — the row still fired,
    // set the hash to the session, and the anchor's own default action then set
    // it to the roster in the same task. The screen that ended up drawn was the
    // right one and the test passed while the defect was present. `ctx.navigate`
    // is `location.hash = …`, so the row firing is observable in the SEQUENCE
    // and nowhere in the final state.
    await page.evaluate(() => {
      const seen: string[] = [location.hash];
      (window as unknown as { seenHashes: string[] }).seenHashes = seen;
      window.addEventListener('hashchange', (e) => { seen.push(new URL(e.newURL).hash); });
    });

    await count.click();

    // IT REACHES THE ROSTER — the two lanes, one dispatched by the session and
    // one by that lane.
    await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
    expect(page.url()).toContain('#/conversations/lanes/sess-archive');
    await expect(page.locator('[data-p]:not([hidden]) .rows .convrow')).toHaveCount(2);

    // **AND THE ROW DID NOT ALSO FIRE.** The session's own address must never
    // have been visited — not transiently, not as the loser of a race. This is
    // what the two controls being SIBLINGS rather than nested buys, and it is
    // asserted rather than argued: with the handler moved back onto the
    // container this line goes red and the two below it stay green.
    const seen = await page.evaluate(
      () => (window as unknown as { seenHashes: string[] }).seenHashes);
    expect(seen.join(' | '), 'the row must not have fired as well')
      .not.toContain('#/conversations/sess-archive');
    // And the well the document draws into was therefore never built either.
    await expect(page.locator('.tvscroll')).toHaveCount(0);
  });

  test(`the whole row still opens the session, and the count is the tab stop after it (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);
    const row = page.locator('[data-p]:not([hidden]) .convrow').first();

    // ── THE WHOLE-ROW TARGET, MEASURED RATHER THAN ASSUMED ────────────────
    //
    // The row is a `<div>` now, so "the whole row opens the session" is a claim
    // about an overlay and not about a tag. `elementFromPoint` is what settles
    // it: the row's own centre, its top corner, its far corner — AND a point on
    // the count's OWN LINE, 24px to one side of it, which is the pixel the item
    // warns about by name ("including the areas around the count").
    const hits = await row.evaluate((n) => {
      const r = n.getBoundingClientRect();
      const a = (n.querySelector('a.convlanelink') as HTMLElement).getBoundingClientRect();
      const beside = a.x - r.x > 40 ? a.x - 24 : a.x + a.width + 24;
      const name = (x: number, y: number): string => {
        const at = document.elementFromPoint(x, y);
        return at === null ? 'nothing' : `${at.tagName}.${(at as HTMLElement).className}`;
      };
      return {
        centre: name(r.x + r.width / 2, r.y + r.height / 2),
        corner: name(r.x + 2, r.y + 2),
        far: name(r.right - 3, r.bottom - 3),
        beside: name(beside, a.y + a.height / 2),
        onCount: name(a.x + a.width / 2, a.y + a.height / 2),
        spot: { x: beside, y: a.y + a.height / 2 },
      };
    });
    for (const where of ['centre', 'corner', 'far', 'beside'] as const) {
      expect(hits[where], `${where} of the row must open the session`)
        .toContain('convrowopen');
    }
    // And the count is the ONE hole in that overlay, or the test above proves
    // nothing about a control a pointer can reach.
    expect(hits.onCount).toContain('convlanelink');

    // ── KEYBOARD, AND THE ORDER THE ITEM ASKS FOR ─────────────────────────
    //
    // "the row, then the count — not the count intercepting the row." Focus is
    // put on the row's control and then moved with real key presses, because
    // tab order is a property of the document and not of a locator.
    await row.locator('.convrowopen').focus();
    await expect(page.locator('.convrowopen:focus')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.convlanelink:focus')).toHaveCount(1);
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.convrowopen:focus')).toHaveCount(1);

    // **AND THE RING IS STILL THE WHOLE ROW'S.** `Shift+Tab` then `Tab` is how
    // the control is reached BY KEY rather than by script, which is what
    // `:focus-visible` answers to. The ring moved to the wrapper when the row
    // stopped being the button; a ring around the title alone would be a
    // smaller mark on the same row a keyboard reader used to see light up.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await row.evaluate((n) => ({
      focused: (document.activeElement as HTMLElement).className,
      visible: (document.activeElement as HTMLElement).matches(':focus-visible'),
      wrap: getComputedStyle(n).outline,
      control: getComputedStyle(document.activeElement as HTMLElement).outlineStyle,
    }));
    expect(ring.focused).toContain('convrowopen');
    expect(ring.visible).toBe(true);
    expect(ring.wrap).toContain('2px');
    expect(ring.wrap).toContain('solid');
    // One ring and not two.
    expect(ring.control).toBe('none');

    // ── AND IT OPENS: BY KEY, AND BY A CLICK BESIDE THE COUNT ─────────────
    await page.keyboard.press('Enter');
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    expect(page.url()).toContain('#/conversations/sess-archive');

    await page.goBack();
    await page.waitForSelector('[data-p]:not([hidden]) .convrow', { timeout: 20_000 });
    await page.mouse.click(hits.spot.x, hits.spot.y);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    expect(page.url()).toContain('#/conversations/sess-archive');
  });
}

/* ══ seq:39 — THE RECORDS THAT SAY ONLY THEIR OWN NAME ═════════════════════
 *
 * Owner ruling 2026-09-09, shown a real fold of eleven rows of which eight
 * could never hold anything: COUNT THEM AS ONE LINE. Measured on his own
 * transcript the same day — 32,610 records — **14,937 of the 27,156 rows an
 * opened fold draws carry nothing at all**, 45.8% of every record in the file,
 * across 26 distinct `type · subtype` keys. The rows an opened fold draws fall
 * from 27,156 to 14,223.
 *
 * What is asserted here is the whole of the item's two open questions: the
 * qualifying test is DERIVED (a `queue-operation · drain` is collapsed and a
 * `tool_result` beside it is not, and no name is written anywhere), and the
 * line OPENS (the record's own index is still reachable, which is what
 * `INV-nothing-is-dropped-silently` asks of a count).
 */
for (const lang of ['en', 'he'] as const) {
  test(`a fold counts its empty records on one line, and that line opens (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    const fold = page.locator('.tvwork').filter({ hasText: 'round 0 output' }).first();
    await expect(fold).toBeVisible();
    // **THE COUNT ON THE SUMMARY DOES NOT MOVE.** `sum(span) === records` is
    // asserted by the endpoint's own tests and the owner was offered dropping
    // these records and declined it on exactly that cost. Only the drawn form
    // collapses: the run is still two records.
    await expect(fold.locator('summary.tvworksum .tvworkn')).toContainText('2');
    await fold.locator('summary.tvworksum').click();
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);

    // The tool result keeps its own row, because it has something to show.
    await expect(fold).toContainText('round 0 output');

    // The queue record does not, because it has nothing — and it was chosen by
    // DRAWING NOTHING rather than by being named in a list.
    const quiet = fold.locator('details.tvquiet');
    await expect(quiet).toHaveCount(1);
    await expect(quiet.locator('summary')).toContainText(
      lang === 'he' ? 'רשומה אחת' : '1 record with nothing in it',
    );
    // It names the type it covers, so the line can be skimmed without opening.
    await expect(quiet.locator('.tvtools')).toContainText('queue-operation · drain');
    expect(await quiet.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(false);

    // ── AND THE RECORD IS STILL REACHABLE, which is the decision the item
    //    left open. A reader reconciling this document against the file needs
    //    the INDEX, and the index is the only thing these rows ever carried.
    await quiet.locator('summary').click();
    expect(await quiet.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);
    const inside = quiet.locator('li.tvstep');
    await expect(inside).toHaveCount(1);
    await expect(inside.first()).toContainText('queue-operation · drain');
    // The record's own number in the file — the one the endpoint, the copy
    // and the list screen all count in.
    await expect(inside.first().locator('.m').first()).not.toBeEmpty();

    await fold.screenshot({ path: `e2e/screens/conversations-fold-quiet-${lang}.png` });
  });
}

/* ══ seq:41 — THE ROSTER, WHICH THE COUNT USED TO BE THE END OF ════════════
 *
 * *"could the user see the list of subagents context files and can view them
 * as we do for a session ?"* — the answer was PARTLY: one lane could be
 * viewed, the CLI could list them, and the browser could not. The count on the
 * row was not a link and `laneIndex` is a map keyed on `toolUseId`, not a list
 * surface.
 *
 * **The owner ruled the shape and it is not re-opened here.** A FLAT LIST WITH
 * THE CHILDREN INDENTED, NOT A FOLDER TREE — measured: 221 lanes at depth 1,
 * 43 at depth 2, and only SEVENTEEN of 264 with any children at all, so a tree
 * would spend expand/collapse on 6.4% of the rows. What this drives is that
 * the surface exists, that a child is drawn under its parent, and that the
 * filter `seq:10` built for sessions is inherited by a flat list.
 */
test('the count of helper agents opens the roster, with a child under its parent', async ({ page }) => {
  await open(page, '#/conversations/sess-archive', 'en');
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  const toRoster = page.locator('button.tvlanes');
  await expect(toRoster).toContainText('2 helper agents');
  await toRoster.click();
  await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
  expect(page.url()).toContain('#/conversations/lanes/sess-archive');

  const rows = page.locator('.rows .convrow');
  await expect(rows).toHaveCount(2);
  // Oldest first, and the child directly under the lane that dispatched it.
  await expect(rows.nth(0)).toContainText('Read the index');
  await expect(rows.nth(0)).toContainText('agent-outer');
  // The parent carries a count, the way a session row already does.
  await expect(rows.nth(0)).toContainText('1 helper agent');
  await expect(rows.nth(1)).toContainText('One level deeper');
  await expect(rows.nth(1)).toContainText('Explore');

  // **THE INDENT IS A FACT AND IT IS ALSO SAID IN WORDS.** A reader who cannot
  // see the indent, and a reader looking at a FILTERED list where the parent
  // may not be on screen at all, both get the sentence.
  await expect(rows.nth(1)).toContainText('dispatched by another helper agent');
  const inset = await rows.nth(1).locator('.convhead')
    .evaluate((n) => getComputedStyle(n as HTMLElement).paddingInlineStart);
  expect(parseFloat(inset), 'a child is drawn in from its parent').toBeGreaterThan(0);
  const flat = await rows.nth(0).locator('.convhead')
    .evaluate((n) => getComputedStyle(n as HTMLElement).paddingInlineStart);
  expect(parseFloat(flat)).toBe(0);

  // The filter a flat list inherits — and it reads the BRIEF, which is the
  // only real name a lane has.
  await page.locator('input.convfind').fill('deeper');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('One level deeper');
  await page.locator('input.convfind').fill('nothing matches this at all');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('.convlanes')).toContainText('No helper agent matches');
  await page.locator('input.convfind').fill('');
  await expect(rows).toHaveCount(2);

  await page.screenshot({ path: 'e2e/screens/conversations-roster-en.png', fullPage: true });

  // ── AND A ROW OPENS THE LANE BARE, IN THIS SAME WINDOW ─────────────────
  //
  // Owner ruling 2026-09-09, answering the boundary `seq:51` drew on purpose
  // and reported rather than decided. This assertion USED TO READ "a row opens
  // the lane in the same viewer a session uses", which was true of the app
  // route; the viewer is still the same one — `lane.js` imports
  // `mountDocument` and forks nothing — and what changed is the SHAPE it
  // arrives in.
  //
  // NO TAB IS SPENT, which is the half of `seq:51`'s argument that was right:
  // a list's rows are not links that spend a tab. So this is a navigation of
  // the page under test, and `waitForEvent('popup')` would hang here.
  await rows.nth(1).click();
  await page.waitForURL(/\/lane\.html/, { timeout: 20_000 });
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  expect(new URL(page.url()).pathname).toBe('/lane.html');
  await expect(page.locator('.tvscroll')).toContainText(DEEP_PHRASE_LANE, { timeout: 20_000 });

  // Bare, counted rather than merely not visible — the shell keeps every
  // visited screen in `#screen` and flips `hidden`, so `toHaveCount(0)` is the
  // only assertion that says it was never built here.
  await expect(page.locator('body')).toHaveClass(/lanewin/);
  for (const gone of ['#app', '#topbar', '.rail', '#screen', '#strip']) {
    await expect(page.locator(gone), `${gone} must not exist in a bare lane window`)
      .toHaveCount(0);
  }

  // **AND THE CLOSE-THIS-TAB CONTROL IS CORRECTLY ABSENT.** `button.tvlaneshut`
  // gates on `history.length === 1` — "this tab was opened for this document
  // and has shown nothing else" — and a reader who arrived by clicking a row
  // has the roster behind them. Closing their only tab would take it away.
  // `a.tvlanehome` is drawn either way and is their route out.
  await expect(page.locator('button.tvlaneshut')).toHaveCount(0);
  await expect(page.locator('a.tvlanehome')).toBeVisible();

  // The browser's own Back is the return, which is what "no tab was spent"
  // has to mean for a reader rather than for a specification.
  await page.goBack();
  await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
  expect(page.url()).toContain('#/conversations/lanes/sess-archive');
});

test('the roster is reachable from a lane too, because it is the SESSION own', async ({ page }) => {
  // The route the item says some lanes have no other: 43 of 264 were
  // dispatched from inside another lane, so reaching them meant finding and
  // opening the parent first. A lane page resolves to its owning session's
  // roster, which is where its siblings are.
  await open(page, '#/conversations/agent-outer', 'en');
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  // **THE IN-APP LANE ROUTE STILL EXISTS, AND THIS IS WHERE THAT IS SAID.**
  // The roster's rows now open `/lane.html` (the ruling of 2026-09-09), and
  // that changed which route a ROW takes — not whether a lane can render
  // inside the shell. `rowFor` still resolves either kind at
  // `#/conversations/<agentId>`, `button.tvlaneshut`'s gate is written for a
  // reader who arrives that way, and this address is what a reader who edits
  // the hash or follows an old bookmark gets.
  await expect(page.locator('.rail')).toBeVisible();
  await expect(page.locator('#strip')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/lanewin/);

  await page.locator('button.tvlanes').click();
  await page.waitForSelector('.rows .convrow', { timeout: 20_000 });
  expect(page.url()).toContain('#/conversations/lanes/sess-archive');
  await expect(page.locator('.rows .convrow')).toHaveCount(2);

  // Back goes to the session this roster belongs to, not to the list.
  await page.locator('button.tvback').click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  expect(page.url()).toContain('#/conversations/sess-archive');
});

/* ══ seq:40 — THE WAY BACK OUT OF THE TAB ══════════════════════════════════
 *
 * Owner ruling 2026-09-09, accepting the new tab and asking for a way back:
 * *"give the user a button on the new tab to close it so he could return to
 * the main viewer"*. The item requires a MEASUREMENT rather than an
 * assumption, because `window.close()` is specified to work only on a window a
 * script opened or on one whose session history holds a single entry — and
 * `laneLink` sets `rel="noopener"`, so the tab has no `window.opener` at all
 * and cannot lean on the first clause.
 *
 * **This is that measurement, and it runs in chromium AND in chrome**, which
 * is why it is a browser test rather than a paragraph: it is a browser rule,
 * not a fact about this code, and browser rules move across versions.
 *
 * What the item asks for first — SAYING that a new tab is opening, before it
 * does — was already built by `seq:15` and is asserted above, in both
 * languages, on `conv.doc.lane`.
 */
test('a lane opened in a new tab can close itself, and the button is only there when it can', async ({ page }) => {
  await openDocument(page, 'en', 'default');
  const fold = await reachTheLane(page);
  const link = fold.locator('a.tvlane').first();

  const [lane] = await Promise.all([
    page.waitForEvent('popup'),
    link.click(),
  ]);
  await lane.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  // The tab the anchor opened: no opener, one history entry.
  expect(await lane.evaluate(() => window.opener !== null),
    '`rel=noopener` is deliberate, so the first clause of the spec is not available').toBe(false);
  expect(await lane.evaluate(() => history.length)).toBe(1);

  const shut = lane.locator('button.tvlaneshut');
  await expect(shut).toBeVisible();
  await expect(shut).toContainText('Close this tab');

  // **IT SETS ITS OWN COLOUR, BACKGROUND AND BORDER.** A Clear button shipped
  // at contrast 1.0 by letting a new control take the user agent's ground, and
  // `e2e/button-contrast.spec.ts` exists for it. `.tvjump` is the class Top,
  // End and "N new below" already wear and it declares all three.
  const face = await shut.evaluate((n) => {
    const cs = getComputedStyle(n as HTMLElement);
    return { color: cs.color, background: cs.backgroundColor, border: cs.borderTopColor };
  });
  expect(face.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(face.color).not.toBe(face.background);

  // ── THE MEASUREMENT ────────────────────────────────────────────────────
  await Promise.all([lane.waitForEvent('close', { timeout: 10_000 }), shut.click()]);
  expect(lane.isClosed(), 'the tab the reader was sent to is gone, and they are back where they were')
    .toBe(true);

  // And the reader's own document is untouched — the whole reason `seq:15`
  // chose a tab over a return.
  await expect(page.locator('.tvscroll')).toBeVisible();
});

test('a document that is NOT in a tab of its own is not offered a close button', async ({ page }) => {
  // A reader who reached a lane by any route that left history behind has
  // somewhere to go back to, and closing their only tab would take the session
  // with it. The back-link stays either way, which is the fallback the item
  // names.
  await open(page, '#/conversations', 'en');
  await page.evaluate(() => { location.hash = '#/conversations/agent-outer'; });
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  expect(await page.evaluate(() => history.length)).toBeGreaterThan(1);
  await expect(page.locator('button.tvlaneshut')).toHaveCount(0);
  await expect(page.locator('a.tvlanehome')).toBeVisible();
});

/**
 * **The list is browsable** — `plan:archive seq:10`, driven in a real browser.
 *
 * The item's complaint is that `drawList` has no filter control at all and
 * that the single find box on the screen lives INSIDE a transcript, matching
 * only the records that were loaded. What is asserted here is the LIST: three
 * controls above it, a duration on every row, and — the part that decides
 * whether the search is worth having on a corpus that is mostly lanes — a
 * session reachable through the one-line description of a lane it dispatched.
 *
 * ── ITS OWN FIXTURE, FOR THE STALENESS BLOCK'S REASON ─────────────────────
 *
 * The shared fixture is ONE session, and a filter over one row can be green
 * with the filter doing nothing at all. This block builds TWO, on two
 * branches, four days apart, one of them carrying a lane — the smallest corpus
 * in which every clause can be wrong.
 *
 * ── WHAT IS DRIVEN RATHER THAN ASSERTED FROM THE BODY ─────────────────────
 *
 * The typing, and it matters: `RULE-a-screen-shows-the-new-state-after-the-
 * reader-acts-on-it` says the list refreshes with no button to press, and the
 * bar is deliberately built ONCE so the caret survives that refresh. A test
 * that fetched the URL directly would prove the endpoint — which
 * `test/ui/conversations-endpoint.test.ts` already does — and would say
 * nothing about the input still holding what was typed into it, which is the
 * defect a rebuilt bar produces.
 */
test.describe('the list is browsable', () => {
  let browsable: UiHarness;
  let browseCwd: string;
  let browseHome: string;

  test.beforeAll(async () => {
    browseHome = mkdtempSync(path.join(tmpdir(), 'e2e-browse-home-'));
    browseCwd = mkdtempSync(path.join(tmpdir(), 'e2e-browse-cwd-'));
    const dir = path.join(browseHome, 'projects', projectDirName(browseCwd));
    mkdirSync(dir, { recursive: true });
    const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

    // Ninety minutes on `main`, four days before the other.
    writeFileSync(path.join(dir, 'sess-alpha.jsonl'), jsonl([
      { type: 'user', timestamp: '2026-09-01T10:00:00.000Z', gitBranch: 'main',
        message: { role: 'user', content: 'the alpha session' } },
      { type: 'assistant', timestamp: '2026-09-01T11:30:00.000Z', gitBranch: 'main',
        message: { role: 'assistant', content: text('done') } },
    ]));

    // Two minutes on `topic`, and the only one with a lane under it.
    //
    // **AND IT HOLDS THE ROW `plan:archive seq:49` IS ABOUT, IN THE ONE SHAPE
    // THAT PROVES IT.** There is no `Agent` call anywhere in this session, so
    // the dispatching link `seq:15` draws has nothing to hang on and the
    // notification is the ONLY route from this document to `agent-probe`.
    // Three notifications, because the claim has three halves:
    //
    //   1. A lane's report, naming a lane that is on disk — it links.
    //   2. A lane's report naming a lane that is NOT — it SAYS SO.
    //      `INV-nothing-is-dropped-silently`, and never a dead link.
    //   3. A BACKGROUND COMMAND carrying the same id that resolves in (1).
    //      It must not link, and the reason it does not is that
    //      `syntheticSpeaker` named it `shell` — `seq:28`'s existing
    //      discriminator, not a second rule. If the id ever escapes from
    //      behind that ruling, this row grows a link and this test goes red.
    //
    // The ids are BARE, as the harness writes them: the file is
    // `agent-probe.jsonl` and the payload says `probe`. That asymmetry is
    // `seq:48`'s and `laneKey` is the one place it is closed.
    const notify = (id: string, summary: string): string => [
      '<task-notification>',
      `<task-id>${id}</task-id>`,
      `<summary>${summary}</summary>`,
      '</task-notification>',
    ].join('\n');
    writeFileSync(path.join(dir, 'sess-beta.jsonl'), jsonl([
      { type: 'user', timestamp: '2026-09-05T10:00:00.000Z', gitBranch: 'topic',
        message: { role: 'user', content: 'the beta session' } },
      { type: 'user', timestamp: '2026-09-05T10:01:00.000Z', gitBranch: 'topic',
        message: { role: 'user', content: notify('probe', 'Agent "read the sextant" finished') } },
      { type: 'user', timestamp: '2026-09-05T10:01:10.000Z', gitBranch: 'topic',
        message: { role: 'user', content: notify('prunedaway', 'Agent "a lane since pruned" finished') } },
      { type: 'user', timestamp: '2026-09-05T10:01:20.000Z', gitBranch: 'topic',
        message: { role: 'user', content: notify('probe', 'Background command "npm test" completed (exit code 0)') } },
      { type: 'assistant', timestamp: '2026-09-05T10:02:00.000Z', gitBranch: 'topic',
        message: { role: 'assistant', content: text('done') } },
    ]));
    const lanes = path.join(dir, 'sess-beta', 'subagents');
    mkdirSync(lanes, { recursive: true });
    writeFileSync(path.join(lanes, 'agent-probe.jsonl'), jsonl([
      { type: 'user', timestamp: '2026-09-05T10:01:00.000Z',
        message: { role: 'user', content: 'go' } },
    ]));
    // THE PHRASE THAT IS NOWHERE ON THE SESSION'S OWN ROW. Neither session's
    // id, title or branch contains `sextant`, so a list that matched only its
    // own rows answers nothing for it.
    writeFileSync(path.join(lanes, 'agent-probe.meta.json'), JSON.stringify({
      agentType: 'Explore', description: 'read the sextant', spawnDepth: 1,
      toolUseId: 'toolu_browse_1',
    }));

    process.env['CLAUDE_CONFIG_DIR'] = browseHome;
    const previous = process.cwd();
    process.chdir(browseCwd);
    try {
      runCli(['init'], browseCwd, () => {});
      runCli(['conversation', 'rebuild'], browseCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    browsable = await startUiChild(browseCwd);
  });

  test.afterAll(async () => {
    await browsable?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (browseCwd) removeTree(browseCwd);
    if (browseHome) removeTree(browseHome);
  });

  const land = async (page: Page, lang: 'en' | 'he'): Promise<void> => {
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(browsable.port);
    await page.goto(`http://127.0.0.1:${browsable.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  for (const lang of ['en', 'he'] as const) {
    test(`the controls narrow the list where the reader is looking (${lang})`, async ({ page }) => {
      await land(page, lang);
      await expect(page.locator('.convrow')).toHaveCount(2);

      // THE BRANCH CHOOSER OFFERS EVERY BRANCH THE ARCHIVE HOLDS — not the
      // ones on this page, and not the ones surviving the current filter.
      const branch = page.locator('select.convselect');
      await expect(branch.locator('option')).toHaveCount(3);
      await branch.selectOption('topic');
      await expect(page.locator('.convrow')).toHaveCount(1);
      // The BRANCH, not the id: neither session carries a title and the list
      // never draws the id — a fact worth knowing, since the id is one of the
      // things the search reads. It is on the URL and in the terminal, and a
      // reader who has one can paste it; nobody reads one off this list.
      await expect(page.locator('.convrow')).toContainText('topic');

      // AND THE CHOOSER STILL OFFERS BOTH, so the filter is undoable. A
      // control that erased itself on first use would be a trap.
      await expect(branch.locator('option')).toHaveCount(3);
      await branch.selectOption('');
      await expect(page.locator('.convrow')).toHaveCount(2);

      // THE DATE BOUNDS ARE INCLUSIVE OF THEIR WHOLE DAY, at both ends.
      await page.locator('input.convdate').first().fill('2026-09-05');
      await expect(page.locator('.convrow')).toHaveCount(1);
      await expect(page.locator('.convrow')).toContainText('topic');
      await page.locator('input.convdate').first().fill('');
      await expect(page.locator('.convrow')).toHaveCount(2);

      // CLEAR PUTS EVERYTHING BACK, in one press.
      await page.locator('select.convselect').selectOption('main');
      await expect(page.locator('.convrow')).toHaveCount(1);
      await page.locator('button.convclear').click();
      await expect(page.locator('.convrow')).toHaveCount(2);
      await expect(page.locator('select.convselect')).toHaveValue('');
    });
  }

  test('a session is found through a lane, and the row says why it is there', async ({ page }) => {
    await land(page, 'en');

    // Typed, character by character, into the real box — and the assertion
    // below on the box's own value is what proves the bar was not rebuilt
    // under the reader's hands when the answer came back.
    const find = page.locator('input.convfind');
    await find.click();
    await find.type('sextant', { delay: 30 });

    await expect(page.locator('.convrow')).toHaveCount(1);
    await expect(page.locator('.convrow')).toContainText('topic');
    await expect(page.locator('.convrow')).toContainText('matched in 1 helper agent');
    // The input still holds what was typed. A bar rebuilt with the results
    // would take the first letter and drop the rest.
    await expect(find).toHaveValue('sextant');
    await expect(find).toBeFocused();

    // The narrowing is disclosed rather than left to be inferred from a
    // shorter list, and the screen says what the search actually read.
    // The RESULTS region, not "the card that has a row in it": the empty
    // answer below has no rows, so a locator defined by the presence of one
    // resolves to nothing exactly when the assertion matters most.
    const card = page.locator('.convresults');
    await expect(card).toContainText('1 of 2 sessions match');
    // The scope sentence sits with the CONTROLS and not with the results,
    // deliberately: it describes what the box does, so it has to be readable
    // when the box has just answered nothing.
    const pane = page.locator('.card.pane').filter({ has: page.locator('.convfilter') });
    await expect(pane).toContainText('It does not read the transcripts');

    await page.screenshot({
      path: 'e2e/screens/conversations-filtered-en.png', fullPage: true,
    });

    // A term nothing matches is a NAMED empty state, not an empty list — the
    // difference between "no session matches" and "the archive is empty".
    await find.fill('');
    await find.type('nothingmatchesthis', { delay: 10 });
    await expect(page.locator('.convrow')).toHaveCount(0);
    await expect(card).toContainText('No session matches what you asked for');
    await expect(card).toContainText('all 2');
  });

  /**
   * **THE ROW WHERE A LANE REPORTED BACK OPENS THAT LANE** — `plan:archive
   * seq:49`, driven as a reader drives it.
   *
   * The unit tests own the id's journey — `test/ui/conversation-document.test.ts`
   * proves it rides only the rows `syntheticSpeaker` named `subagent`, and
   * `test/ui/transcript-viewer.test.ts` proves the roster answers to the bare
   * spelling. Neither can prove there is an anchor on the screen, that it
   * carries the address, or that the two rows beside it draw the disclosure
   * instead — `render()` needs a real document, which is this file's whole
   * reason to exist.
   *
   * **It opens in a NEW TAB and this test does not follow it.** That is
   * `seq:15`'s answer to "return exactly to the cursor point": the reader's
   * document is never unmounted, so their place is not restored — it was never
   * lost. The lane document itself is already driven end to end above.
   */
  test('a lane is opened from the turn where it reported back', async ({ page }) => {
    await land(page, 'en');
    await page.evaluate(() => { location.hash = '#/conversations/sess-beta'; });
    await page.waitForSelector('article.tvturn', { timeout: 20_000 });

    // THE THREE SYNTHETIC ROWS, in the order the file wrote them.
    const rows = page.locator('article.tvturn.tvsyn');
    await expect(rows).toHaveCount(3);

    // 1. A LANE REPORTED, AND THE ROW SAYS WHOSE REPORT IT IS. There is no
    //    `Agent` call in this session at all, so before this the reader had
    //    the roster and nothing else.
    const reported = rows.nth(0);
    await expect(reported).toContainText('Subagent');
    await expect(reported).toContainText('Background task finished');
    const open = reported.locator('a.tvlane');
    await expect(open).toHaveAttribute('href', '/lane.html?id=agent-probe');
    await expect(open).toHaveAttribute('target', '_blank');
    await expect(open).toBeVisible();

    // 2. A LANE THAT IS NOT ON DISK IS SAID, NOT SWALLOWED.
    const pruned = rows.nth(1);
    await expect(pruned).toContainText('Subagent');
    await expect(pruned.locator('a.tvlane')).toHaveCount(0);
    await expect(pruned).toContainText('no longer on disk');

    // 3. A BACKGROUND COMMAND CARRIES A TASK ID TOO — this one is `probe`,
    //    the id that resolves on row 1 — and it must NOT link. The row's name
    //    is the owner's ruling and the link follows the name.
    const shell = rows.nth(2);
    await expect(shell).toContainText('Shell');
    await expect(shell.locator('a.tvlane')).toHaveCount(0);
    await expect(shell).not.toContainText('no longer on disk');

    await page.screenshot({
      path: 'e2e/screens/conversations-lane-reported-en.png', fullPage: true,
    });
  });

  test('every row says how long its session lasted, at both ends of the range', async ({ page }) => {
    await land(page, 'en');
    const rows = page.locator('.convrow');
    // Newest first — `all()`'s order, untouched by the filter.
    await expect(rows.nth(0)).toContainText('took 2m');
    await expect(rows.nth(1)).toContainText('took 1h 30m');
  });
});

/* ══ A MARKED PASSAGE, COPIED AS SOMETHING A TERMINAL WILL ACCEPT ══════════
 *
 * `TASK-a-selected-passage-copies-as-something-a-terminal-will`.
 *
 * ── WHY THESE ARE BROWSER TESTS AND CANNOT BE ANYTHING ELSE ───────────────
 *
 * The item's hard part is a MAPPING: *"a browser selection is a DOM range, and
 * the clipboard must be filled from the RECORD range it corresponds to. In a
 * VIRTUALISED document the rows around the selection may not even be in the
 * DOM."* A `Selection` over a virtualised well is not a thing `node --test`
 * has. `test/ui/passage-copy.test.ts` holds the halves that are arithmetic —
 * what the payload says, and the byte slice — and everything below is the half
 * that only exists in a browser.
 *
 * ── HOW THE CLIPBOARD IS READ, SAID RATHER THAN ASSUMED ───────────────────
 *
 * `navigator.clipboard` needs a permission and a secure context, and a
 * headless engine may refuse it. So these assert `pre.tvclip` — the element
 * the page fills with the payload BEFORE it attempts either clipboard path,
 * and which the `execCommand` fallback then selects. That is the payload the
 * page would write, which is the honest thing to assert when the OS clipboard
 * is not reachable. `the clipboard itself is written when the engine allows
 * it` below measures whether the real write succeeded, and says so either way
 * rather than leaving it unknown.
 */

/** The controls the copy feature draws, and the line it reports through. */
const copyBar = (page: Page) => ({
  message: page.locator('button.tvcopymsg'),
  seen: page.locator('button.tvcopyseen'),
  raw: page.locator('button.tvcopyraw'),
  said: page.locator('p.tvcopied'),
});

/** What the page would put on the clipboard. */
const payload = (page: Page): Promise<string> =>
  page.locator('pre.tvclip').evaluate((n) => n.textContent ?? '');

/**
 * Mark the whole of one drawn row, and wait for the screen to notice.
 *
 * `selectionchange` is delivered as a task rather than synchronously, so a
 * test that marked and clicked in the same tick would click a button that had
 * not yet been armed. The wait is on the BUTTON rather than on a timer.
 */
async function markRow(page: Page, dataN: string): Promise<void> {
  await page.evaluate((n) => {
    const row = document.querySelector(`.tvrow[data-n="${n as string}"]`);
    if (row === null) throw new Error(`row ${n as string} is not drawn`);
    const range = document.createRange();
    range.selectNodeContents(row);
    const selection = document.getSelection();
    if (selection === null) throw new Error('no selection object');
    selection.removeAllRanges();
    selection.addRange(range);
  }, dataN);
  await expect(page.locator('button.tvcopymsg')).toBeEnabled({ timeout: 10_000 });
}

/** The `data-n` of every row currently in the DOM, as numbers. */
const drawnNodes = (page: Page): Promise<number[]> =>
  page.locator('.tvscroll').evaluate((n) => [...n.querySelectorAll('.tvrow')]
    .map((r) => Number((r as HTMLElement).dataset['n'])));

/** Park the well at a fraction of the document and let it settle. */
async function parkAt(page: Page, fraction: number): Promise<void> {
  await page.locator('.tvscroll').evaluate((n, f) => {
    const el = n as HTMLElement;
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * (f as number));
  }, fraction);
  await page.waitForTimeout(500);
}

/** Direction marks a copy must not invent. */
const BIDI = /[‎‏؜‪-‮⁦-⁩]/;

test.describe('a marked passage copies as something a terminal will accept', () => {
  for (const lang of ['en', 'he'] as const) {
    test(`the three copies are named by what they are FOR, and wait to be given something (${lang})`,
      async ({ page }) => {
        await openDocument(page, lang);
        const bar = copyBar(page);

        // NAMED BY PURPOSE, which is the item's own instruction: *"A menu
        // offering 'text / rendered / raw' makes a reader guess; one offering
        // 'paste into a prompt / paste as it looks / the exact record' does
        // not."* Both languages, because a control that says what it is for in
        // one language and names a format in the other has only half shipped.
        await expect(bar.message).toContainText(lang === 'he' ? 'פרומפט' : 'prompt');
        await expect(bar.seen).toContainText(lang === 'he' ? 'נראה' : 'looks');
        await expect(bar.raw).toContainText(lang === 'he' ? 'רשומה' : 'record');

        // Nothing is marked yet, so there is nothing to copy — and the three
        // controls say so by being unusable rather than by refusing after the
        // click. They are PRESENT the whole time, so nothing reflows under a
        // reader in the middle of marking.
        for (const button of [bar.message, bar.seen, bar.raw]) {
          await expect(button).toBeVisible();
          await expect(button).toBeDisabled();
        }
        await expect(bar.said).toContainText(lang === 'he' ? 'סמנו' : 'Mark');

        // The ELEMENT, never `fullPage` — a full-page shot resizes the
        // viewport, and this project has already had a `<details>` come back
        // closed in one.
        await page.locator('.tvbar').screenshot({
          path: `e2e/screens/conversations-copy-bar-${lang}.png`,
        });
      });
  }

  test('a marked shell command copies as the command, and nothing above it', async ({ page }) => {
    await openDocument(page, 'en');
    const bar = copyBar(page);

    // THE CASE THE OWNER NAMED. A promoted `deed` row carries the command
    // verbatim; a heading above it in the payload is exactly what stops a
    // terminal taking the paste.
    const deed = page.locator('article.tvdeed').first();
    await expect(deed).toBeVisible();
    const dataN = await deed.evaluate((n) => (n as HTMLElement).dataset['n'] ?? '');
    await markRow(page, dataN);

    await bar.message.click();
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });

    const text = await payload(page);
    expect(text, 'the command, exactly as it ran, and nothing else').toMatch(/^echo \d+$/);
    expect(text).not.toContain('##');
    // What was NOT taken is said on the screen, because it cannot be said in
    // the payload without breaking the paste — `INV-nothing-is-dropped-silently`.
    await expect(bar.said).toContainText('description');
  });

  test('a marked turn copies its own words, with no invisible marks added', async ({ page }) => {
    // **THE HEBREW PAGE ON PURPOSE.** The item rules out the DOM because this
    // UI inserts direction wrappers and isolation, and *"a DOM selection
    // copies those invisible characters into the clipboard, and they will
    // travel into whatever he pastes into."* Message text is built from the
    // RECORD, so this is where that claim is measured rather than repeated.
    await openDocument(page, 'he');
    const bar = copyBar(page);

    const turn = page.locator('article.tvturn:not(.tvsyn)').first();
    const dataN = await turn.evaluate((n) => (n as HTMLElement).dataset['n'] ?? '');
    await markRow(page, dataN);

    // What the BROWSER would have copied from exactly these rows, measured
    // before the button is pressed (a click collapses nothing — the controls
    // refuse the default on `mousedown` — but reading it first keeps the two
    // measurements about the same selection beyond doubt).
    const rendered = await page.evaluate(() => document.getSelection()?.toString() ?? '');

    await bar.message.click();
    await expect(bar.said).toContainText('הועתק', { timeout: 10_000 });

    const text = await payload(page);
    expect(text.length).toBeGreaterThan(0);
    expect(BIDI.test(text), 'message text carries no direction mark the record did not')
      .toBe(false);
    // Reported rather than asserted: what the browser's own serialisation
    // holds is a fact about the engine, and the ruling this feature rests on
    // is that only one of the two forms is a fact about the RECORD.
    // eslint-disable-next-line no-console
    console.log('[copy] browser selection marks:', BIDI.test(rendered),
      '· rendered codepoints:', rendered.length, '· message codepoints:', text.length);
  });

  test('a passage spanning records that are NOT in the DOM copies all of them',
    async ({ page }) => {
      // ── THE LOAD-BEARING TEST OF THIS FEATURE ──────────────────────────
      //
      // The item says the mapping is the hard part and names why: the rows
      // between a selection's two ends may never have been drawn. This marks a
      // row a fifth of the way down, scrolls a third of the document away,
      // extends the selection into a row down there, and then asks whether the
      // clipboard holds the turns IN BETWEEN — turns that were never in the
      // DOM at any moment while the passage existed.
      //
      // It is the same two-step a reader takes: mark, scroll, shift-click.
      await openDocument(page, 'en', 'default');
      const well = page.locator('.tvscroll');
      const bar = copyBar(page);
      // The mount landing is HELD for `STICK_MS`; only the reader's own input
      // releases it, so a programmatic scroll before this is undone.
      await well.press('PageUp');

      await parkAt(page, 0.20);
      const near = await drawnNodes(page);
      expect(near.length).toBeGreaterThan(0);
      const from = Math.min(...near) + 2;
      await markRow(page, String(from));

      await parkAt(page, 0.55);
      const far = await drawnNodes(page);
      const to = Math.max(...far) - 2;
      expect(to - from, 'this must span far more than one window or it proves nothing')
        .toBeGreaterThan(100);

      // The shift-click, as a selection extension.
      await page.evaluate((n) => {
        const row = document.querySelector(`.tvrow[data-n="${n as string}"]`);
        if (row === null) throw new Error('the far row is not drawn');
        document.getSelection()?.extend(row, row.childNodes.length);
      }, String(to));
      await page.waitForTimeout(400);

      const inDom = new Set(await drawnNodes(page));
      let missing = 0;
      for (let n = from; n <= to; n += 1) if (!inDom.has(n)) missing += 1;
      expect(missing,
        'the middle of the passage has to be OUT of the DOM or this test is vacuous')
        .toBeGreaterThan(80);

      await bar.message.click();
      await expect(bar.said).toContainText('Copied', { timeout: 30_000 });
      const text = await payload(page);

      // WHAT THE PASSAGE HOLDS, compared against WHAT THE SCREEN HOLDS. The
      // fixture numbers every prompt, so the rounds present in the clipboard
      // and the rounds present in the DOM are both countable — and the ones in
      // the first and not the second are the proof.
      const rounds = (source: string): Set<number> => {
        const out = new Set<number>();
        for (const m of source.matchAll(/round (\d+): keep going/g)) out.add(Number(m[1]));
        return out;
      };
      const onScreen = rounds(await well.evaluate((n) => n.textContent ?? ''));
      const copied = rounds(text);
      const never = [...copied].filter((r) => !onScreen.has(r));
      expect(never.length,
        'the copy has to hold turns the DOM never drew — that is the whole mapping')
        .toBeGreaterThan(20);

      // And the count it REPORTS is the count it took.
      const said = await bar.said.textContent() ?? '';
      const sections = Number(/Copied (\d+) sections/.exec(said)?.[1] ?? '0');
      expect(sections).toBe(to - from + 1);
      expect(sections).toBeGreaterThan(inDom.size);
      // eslint-disable-next-line no-console
      console.log('[copy] sections:', sections, '· rows in the DOM:', inDom.size,
        '· turns copied that the DOM never held:', never.length,
        '· payload characters:', text.length);
    });

  test('copying does not move a reader who has taken the scroll', async ({ page }) => {
    // `stickUntil` has exactly three setters and every one of them is the
    // reader consenting to be at the end. Copying adds none, and this is what
    // fails if it ever does.
    await openDocument(page, 'en', 'default');
    const well = page.locator('.tvscroll');
    await well.press('PageUp');
    await parkAt(page, 0.45);

    const nodes = await drawnNodes(page);
    await markRow(page, String(Math.min(...nodes) + 1));
    const before = await well.evaluate((n) => (n as HTMLElement).scrollTop);

    const bar = copyBar(page);
    await bar.message.click();
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
    await page.waitForTimeout(700);

    const after = await well.evaluate((n) => (n as HTMLElement).scrollTop);
    expect(after, 'a copy is not a reason to move the document').toBe(before);
  });

  test('the rendered copy SAYS it is the rendered form', async ({ page }) => {
    await openDocument(page, 'en');
    const bar = copyBar(page);
    const turn = page.locator('article.tvturn').first();
    await markRow(page, await turn.evaluate((n) => (n as HTMLElement).dataset['n'] ?? ''));

    await bar.seen.click();
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
    const text = await payload(page);
    // The item requires it, and the payload is the only place the warning can
    // travel to wherever it is pasted.
    expect(text.startsWith('[Copied AS IT LOOKS')).toBe(true);
    expect(text).toContain('direction marks you cannot see');
  });

  test('the exact record is JSONL that parses, envelope and all', async ({ page }) => {
    await openDocument(page, 'en');
    const bar = copyBar(page);
    const turn = page.locator('article.tvturn').first();
    await markRow(page, await turn.evaluate((n) => (n as HTMLElement).dataset['n'] ?? ''));

    await bar.raw.click();
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
    const text = await payload(page);

    const lines = text.split('\n').filter((l) => l !== '');
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(() => JSON.parse(line) as unknown).not.toThrow();
    // It is the record and not this app's reading of it: the envelope the
    // document never draws is there.
    const first = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(typeof first['type']).toBe('string');
  });

  test('a closed fold is disclosed, and opening it changes what the copy holds',
    async ({ page }) => {
      await openDocument(page, 'en');
      const bar = copyBar(page);
      const fold = page.locator('details.tvwork').first();
      await expect(fold).toBeVisible();
      const dataN = await fold.evaluate((n) => (n as HTMLElement).dataset['n'] ?? '');

      await markRow(page, dataN);
      await bar.message.click();
      await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
      const shut = await payload(page);
      // *"If a selection spans a folded block, either include its content or
      // say it was omitted."* This says it.
      expect(shut).toContain('were left out of this copy');

      // Open it, mark it again, and the same passage now carries the records.
      await fold.locator('summary.tvworksum').click();
      await expect(fold).toHaveAttribute('open', '');
      await markRow(page, dataN);
      await bar.message.click();
      await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
      const opened = await payload(page);
      expect(opened).not.toContain('were left out of this copy');
      // THE RECORDS THEMSELVES, one heading each — not a length comparison.
      // Measured on this fixture: the disclosure sentence is 138 characters
      // and the fold it discloses holds one book-keeping record whose whole
      // content is 31, so "the open copy is longer" is FALSE on exactly the
      // fold this document draws first. What changed is what is in it.
      expect(opened).toContain('###');
      expect(shut).not.toContain('###');
    });

  test('the clipboard itself is written when the engine allows it', async ({ page, context }) => {
    // MEASURED, not assumed. If the permission is refused this reports it and
    // falls back to the payload the page would have written — which is what
    // every test above asserts anyway.
    let granted = true;
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch { granted = false; }

    await openDocument(page, 'en');
    const bar = copyBar(page);
    const deed = page.locator('article.tvdeed').first();
    await markRow(page, await deed.evaluate((n) => (n as HTMLElement).dataset['n'] ?? ''));
    await bar.message.click();
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });

    let onClipboard: string | null = null;
    try {
      onClipboard = await page.evaluate(() => navigator.clipboard.readText());
    } catch { onClipboard = null; }
    // eslint-disable-next-line no-console
    console.log('[copy] permissions granted:', granted, '· clipboard readable:',
      onClipboard !== null);

    if (onClipboard !== null) expect(onClipboard).toBe(await payload(page));
    else expect(await payload(page)).toMatch(/^echo \d+$/);
  });

  /* ══ THE KEY, AND THE PRE-FETCH THAT MAKES IT POSSIBLE ════════════════
   *
   * `TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form`, and
   * the owner's ruling of 2026-09-10: PRE-FETCH ON SELECTION, so that `Ctrl+C`
   * serves MESSAGE TEXT and the key MEANS ONE THING.
   *
   * **These are browser tests for a reason no `node --test` can reach.** The
   * `copy` event is SYNCHRONOUS — `clipboardData.setData` must be called
   * before the handler returns — and that constraint only exists in a browser,
   * over a real selection, over a real virtualised well. The arithmetic half
   * is already asserted by the button tests above; what is measured here is
   * that the KEY reaches records the DOM never drew, that it never falls
   * through to the browser's own rendering, and that it refuses honestly while
   * the pre-fetch is still in flight.
   */

  /** Every `/nodes` fetch this page makes, resettable around one measurement. */
  function nodeFetches(page: Page): { count: number; last: number; reset: () => void } {
    const trace = { count: 0, last: 0, reset: () => { trace.count = 0; trace.last = 0; } };
    page.on('requestfinished', (r) => {
      if (!r.url().includes('/nodes?')) return;
      trace.count += 1;
      trace.last = Date.now();
    });
    return trace;
  }

  /** Wait until no further `/nodes` fetch has finished for `quiet` ms. */
  async function untilQuiet(
    page: Page, trace: { count: number }, quiet = 600,
  ): Promise<void> {
    for (let i = 0; i < 40; i += 1) {
      const seen = trace.count;
      await page.waitForTimeout(quiet);
      if (trace.count === seen) return;
    }
    throw new Error('the pre-fetch never stopped asking');
  }

  /** Extend the live selection to the end of a drawn row — a reader's shift-click. */
  async function extendTo(page: Page, dataN: string): Promise<void> {
    await page.evaluate((n) => {
      const row = document.querySelector(`.tvrow[data-n="${n as string}"]`);
      if (row === null) throw new Error('the far row is not drawn');
      document.getSelection()?.extend(row, row.childNodes.length);
    }, dataN);
  }

  /**
   * Empty the payload element, so that what the NEXT copy writes into it can
   * be told apart from what the last one left there.
   *
   * Without this, comparing the key's payload against the button's would be
   * vacuous: the element already holds the key's bytes, so an assertion that
   * it equals them passes whether the button ran or not.
   */
  const clearPayload = (page: Page): Promise<void> =>
    page.locator('pre.tvclip').evaluate((n) => { n.textContent = ''; });

  /** The numbered rounds present in a piece of text. The fixture numbers them. */
  const rounds = (source: string): Set<number> => {
    const out = new Set<number>();
    for (const m of source.matchAll(/round (\d+): keep going/g)) out.add(Number(m[1]));
    return out;
  };

  test('Ctrl+C serves the RECORD over rows the document never drew, and the pre-fetch pays for it',
    async ({ page, context }) => {
      // ── THE LOAD-BEARING TEST OF THIS ITEM ───────────────────────
      //
      // The defect is that the key gave the BROWSER's copy, and the browser has
      // "nothing at all from the rows the virtualised document has not drawn".
      // So the passage marked here MUST span undrawn rows, and how many is
      // asserted BEFORE the key is pressed — a version of this test over a
      // passage that happened to be fully drawn would pass with the defect
      // reinstated, which is exactly the vacuous shape to avoid.
      let granted = true;
      try {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      } catch { granted = false; }

      await openDocument(page, 'en', 'default');
      const well = page.locator('.tvscroll');
      const bar = copyBar(page);
      await well.press('PageUp');

      await parkAt(page, 0.20);
      const near = await drawnNodes(page);
      expect(near.length).toBeGreaterThan(0);
      const from = Math.min(...near) + 2;
      await markRow(page, String(from));

      await parkAt(page, 0.55);
      const far = await drawnNodes(page);
      const to = Math.max(...far) - 2;
      expect(to - from, 'this must span far more than one window or it proves nothing')
        .toBeGreaterThan(100);

      // WHAT THE PRE-FETCH COSTS, measured from the moment the mark is
      // finished rather than repeated from the item's own numbers.
      const trace = nodeFetches(page);
      trace.reset();
      const markedAt = Date.now();
      await extendTo(page, String(to));
      await untilQuiet(page, trace);
      const spent = trace.last - markedAt;

      // ── NON-VACUITY, ASSERTED BEFORE THE KEY IS PRESSED ──────────────
      const inDom = new Set(await drawnNodes(page));
      let missing = 0;
      for (let n = from; n <= to; n += 1) if (!inDom.has(n)) missing += 1;
      expect(missing,
        'the middle of the passage has to be OUT of the DOM or this test is vacuous')
        .toBeGreaterThan(80);
      expect(trace.count,
        'a passage of undrawn rows costs requests — zero would mean nothing was pre-fetched')
        .toBeGreaterThan(0);

      // WHAT THE BROWSER WOULD HAVE PUT ON THE CLIPBOARD, over the same
      // selection, so the two forms are compared rather than assumed.
      const rendered = await page.evaluate(() => document.getSelection()?.toString() ?? '');

      // THE KEY ITSELF, and not a synthetic `ClipboardEvent`: the real
      // `Control+c`, which is the gesture the item is about.
      await clearPayload(page);
      await page.keyboard.press('Control+c');
      await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
      const text = await payload(page);
      expect(text.length, 'the key wrote the payload, synchronously').toBeGreaterThan(0);

      const onScreen = rounds(await well.evaluate((n) => n.textContent ?? ''));
      const byKey = rounds(text);
      const never = [...byKey].filter((r) => !onScreen.has(r));
      expect(never.length,
        'the key has to reach turns the DOM never drew — that is the whole defect')
        .toBeGreaterThan(20);
      // AND THE BROWSER'S OWN COPY REACHES NONE OF THEM. The defect measured
      // rather than restated: every round the key delivered and the rendered
      // form did not is a round `Ctrl+C` used to lose.
      const byBrowser = rounds(rendered);
      for (const r of never) {
        expect(byBrowser.has(r),
          `round ${r} is in the record copy and cannot be in the browser's`).toBe(false);
      }

      // THE COUNT IT REPORTS IS THE COUNT IT TOOK, in the same sentence the
      // buttons use — one status line, not a second one for the key.
      const said = await bar.said.textContent() ?? '';
      expect(Number(/Copied (\d+) sections/.exec(said)?.[1] ?? '0')).toBe(to - from + 1);

      // ── AND THE OS CLIPBOARD ITSELF, WHERE THE ENGINE ALLOWS IT ────────
      //
      // `pre.tvclip` proves the handler ran; only the real clipboard proves the
      // handler WON — that `preventDefault` took the gesture away from the
      // browser's own serializer. So what is asserted here is the one thing the
      // browser could not have put there: a round from a row it never drew.
      //
      // NOT byte equality. This is the machine's clipboard, shared with every
      // other process on it and with the previous test in the same headed
      // window, and Windows stores clipboard text with its own line endings.
      // An equality assertion over it fails for reasons that have nothing to do
      // with this feature — measured, 2026-09-10, on the first draft of this
      // test. Byte equality is asserted against `pre.tvclip`, which is this
      // page's own record of what it wrote.
      let onClipboard: string | null = null;
      try {
        onClipboard = await page.evaluate(() => navigator.clipboard.readText());
      } catch { onClipboard = null; }
      if (onClipboard !== null) {
        const fromClipboard = rounds(onClipboard);
        expect(never.some((r) => fromClipboard.has(r)),
          'the clipboard has to hold a turn the browser could not have serialised')
          .toBe(true);
      }

      // ── ONE FORMAT, NOT A FOURTH ───────────────────────────
      //
      // The ruling is that the key serves what the FIRST BUTTON serves. So the
      // button is pressed over the same mark and the two payloads are compared
      // byte for byte — with the element emptied first, or the comparison
      // would be against what the key itself left there.
      await clearPayload(page);
      await bar.message.click();
      await expect.poll(async () => (await payload(page)).length,
        { timeout: 30_000 }).toBeGreaterThan(0);
      expect(await payload(page), 'the key and the first button are ONE format').toBe(text);

      // eslint-disable-next-line no-console
      console.log('[ctrl-c] sections:', to - from + 1, '· undrawn when marked:', missing,
        '· pre-fetch requests:', trace.count, '· pre-fetch ms:', spent,
        '· turns the DOM never held:', never.length,
        '· clipboard readable:', onClipboard !== null, '· permissions:', granted);
    });

  test('while the pre-fetch is still in flight the key REFUSES, and says so in the payload',
    async ({ page }) => {
      // *"If the pre-fetch has not landed yet, the handler must still be
      // honest. A copy that silently serves a partial record is worse than the
      // browser's own, because it looks right."*
      //
      // That window is a couple of hundred milliseconds wide against a local
      // server, so it is WIDENED rather than raced for: `/nodes` is held for
      // two seconds, the key is pressed inside the hold, and the same key is
      // pressed again once the hold is lifted. One gesture, one mark: a
      // refusal that says why, and then the record.
      await openDocument(page, 'en', 'default');
      const well = page.locator('.tvscroll');
      const bar = copyBar(page);
      await well.press('PageUp');

      await parkAt(page, 0.20);
      const near = await drawnNodes(page);
      const from = Math.min(...near) + 2;
      await markRow(page, String(from));

      let slow = true;
      await page.route(
        (url) => url.pathname.endsWith('/nodes'),
        async (route) => {
          if (slow) await new Promise((done) => setTimeout(done, 2_000));
          await route.continue();
        });

      await parkAt(page, 0.55);
      const far = await drawnNodes(page);
      const to = Math.max(...far) - 2;
      expect(to - from).toBeGreaterThan(100);
      await extendTo(page, String(to));
      // Long enough for the 90 ms settle to have fired and a request to be in
      // flight, far too short for a two-second hold to have landed.
      await page.waitForTimeout(500);

      const inDom = new Set(await drawnNodes(page));
      let missing = 0;
      for (let n = from; n <= to; n += 1) if (!inDom.has(n)) missing += 1;
      expect(missing, 'without undrawn rows there is nothing to be waiting for')
        .toBeGreaterThan(80);

      await clearPayload(page);
      await page.keyboard.press('Control+c');
      const refused = await payload(page);
      // IT REFUSES — in the payload, so the refusal travels into whatever the
      // reader pastes into, and on the screen as well.
      expect(refused).toContain('still being read from the record');
      await expect(bar.said).toContainText('still being read from the record');
      // AND IT IS NOT A PARTIAL RECORD, which the item calls worse than the
      // browser's own copy because it looks right.
      expect(rounds(refused).size, 'a refusal carries no half of the passage').toBe(0);
      // AND IT IS NOT THE BROWSER'S RENDERED FORM EITHER: the key never falls
      // through, because a key that sometimes falls through is precisely the
      // ambiguity the ruling deleted.
      const rendered = await page.evaluate(() => document.getSelection()?.toString() ?? '');
      expect(rendered.length, 'the browser had plenty it would have given').toBeGreaterThan(200);
      expect(refused).not.toBe(rendered);
      expect(refused.length, 'and the refusal is a sentence, not a transcript')
        .toBeLessThan(rendered.length);

      // ── AND THEN, WITH NOTHING CHANGED BUT TIME, THE SAME KEY ─────────
      //
      // "press it again in a moment" is what the refusal tells the reader to
      // do, so the test does exactly that and nothing else.
      slow = false;
      let took = '';
      for (let i = 0; i < 40; i += 1) {
        await page.waitForTimeout(500);
        await clearPayload(page);
        await page.keyboard.press('Control+c');
        took = await payload(page);
        if (!took.includes('still being read from the record')) break;
      }
      await expect(bar.said).toContainText('Copied');
      const onScreen = rounds(await well.evaluate((n) => n.textContent ?? ''));
      const never = [...rounds(took)].filter((r) => !onScreen.has(r));
      expect(never.length, 'the second press is the whole record, undrawn rows included')
        .toBeGreaterThan(20);
    });

  test('on the Hebrew page the key gives the RECORD, not the rendering', async ({ page }) => {
    // The same argument `a marked turn copies its own words` makes about the
    // first button, made about the key: this UI inserts direction wrappers,
    // and the item's complaint is that `Ctrl+C` carried the page's rendering
    // rather than the record. Measured here in the language where it costs
    // something.
    await openDocument(page, 'he');
    const bar = copyBar(page);
    const turn = page.locator('article.tvturn:not(.tvsyn)').first();
    await markRow(page, await turn.evaluate((n) => (n as HTMLElement).dataset['n'] ?? ''));

    await clearPayload(page);
    await page.keyboard.press('Control+c');
    await expect(bar.said).toContainText('\u05d4\u05d5\u05e2\u05ea\u05e7', { timeout: 10_000 });
    const text = await payload(page);
    expect(text.length).toBeGreaterThan(0);
    expect(BIDI.test(text), 'the key carries no direction mark the record did not').toBe(false);

    // And it is the same bytes the first button gives, in this language too.
    await clearPayload(page);
    await bar.message.click();
    await expect.poll(async () => (await payload(page)).length,
      { timeout: 20_000 }).toBeGreaterThan(0);
    expect(await payload(page)).toBe(text);
  });

  test('the key works in a BARE lane window, which runs the same document', async ({ page }) => {
    // `plan:archive seq:51` shipped `/lane.html`, which imports `mountDocument`
    // and forks nothing — so an affordance added to the document has to be
    // measured in the window with no application around it, or "it works" is a
    // claim about one of the two pages it ships on.
    //
    // THE APP FIRST, FOR THE CREDENTIAL AND NOTHING ELSE: that page exchanges
    // no nonce and rides the `Path=/` cookie the shell's bootstrap set.
    await open(page, '#/conversations', 'en');
    await page.goto(`http://127.0.0.1:${harness.port}/lane.html?id=agent-outer`);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(page.locator('#strip'), 'there is no application here').toHaveCount(0);

    const bar = copyBar(page);
    const turn = page.locator('article.tvturn').first();
    await markRow(page, await turn.evaluate((n) => (n as HTMLElement).dataset['n'] ?? ''));

    await clearPayload(page);
    await page.keyboard.press('Control+c');
    await expect(bar.said).toContainText('Copied', { timeout: 10_000 });
    const text = await payload(page);
    expect(text).toContain(LANE_BRIEF);
    // The record's own words with none of the page's furniture around them: a
    // bare single-turn passage carries no speaker heading, which is
    // `barePassage`'s whole rule and not something the browser's copy does.
    expect(text).not.toContain('##');

    // The same bytes the first button gives, on this page too.
    await clearPayload(page);
    await bar.message.click();
    await expect.poll(async () => (await payload(page)).length,
      { timeout: 20_000 }).toBeGreaterThan(0);
    expect(await payload(page)).toBe(text);
  });
});

/* ══ seq:34 — THE ONE NAME THIS PROJECT OWNS ═══════════════════════════════ */

/**
 * **The archive borrowed Claude Code's name for a session and offered none of
 * its own** — `plan:archive seq:34`, which recorded that silence as a choice
 * rather than leaving it as one. `seq:10`'s spec had asked for the title to be
 * *"taken from the transcript's own `aiTitle` AND OVERRIDABLE for a session
 * worth naming"* and shipped only the borrowing.
 *
 * **What this block asserts is the pair, never the name alone.** The finding
 * behind the item is not that a reader had no name — it is that they could not
 * tell whose the name was. So every assertion here is on THREE things in one
 * row: our name, the mark that says it is ours, and what Claude Code still
 * calls the same session, drawn beside it and not replaced. A screen that drew
 * only the first would pass a weaker test and reproduce the defect exactly.
 *
 * **Its own harness**, for the reason the staleness block has one: the shared
 * fixture's row text is asserted by a dozen tests above, and naming its session
 * would rewrite the heading every one of them reads.
 *
 * The name is set through the CLI, because the server cannot set it — the same
 * read/write split the index itself is built on, exercised the way a person
 * meets it: run the command, then open the screen.
 */
test.describe('a session can be given a name of its own', () => {
  let namedHarness: UiHarness;
  let namedCwd: string;
  let namedHome: string;

  const NAMED_SESSION = 'sess-named';
  const OURS = 'the Tuesday rewrite';
  const THEIRS = 'What the model called it';
  const LANE_LINE = 'Read the ledger';

  test.beforeAll(async () => {
    namedHome = mkdtempSync(path.join(tmpdir(), 'e2e-named-home-'));
    namedCwd = mkdtempSync(path.join(tmpdir(), 'e2e-named-cwd-'));
    const dir = path.join(namedHome, 'projects', projectDirName(namedCwd));
    mkdirSync(dir, { recursive: true });
    const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

    writeFileSync(path.join(dir, `${NAMED_SESSION}.jsonl`), jsonl([
      { type: 'ai-title', aiTitle: THEIRS },
      {
        type: 'user', timestamp: '2026-09-10T09:00:00.000Z', gitBranch: 'master',
        message: { role: 'user', content: 'name this one' },
      },
      {
        type: 'assistant', timestamp: '2026-09-10T09:00:01.000Z', gitBranch: 'master',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_NAMED', name: 'Agent', input: { prompt: LANE_LINE } }],
        },
      },
      {
        type: 'assistant', timestamp: '2026-09-10T09:00:02.000Z', gitBranch: 'master',
        message: { role: 'assistant', content: text('named, and the borrowed one is still here') },
      },
    ]));

    const lanes = path.join(dir, NAMED_SESSION, 'subagents');
    mkdirSync(lanes, { recursive: true });
    writeFileSync(path.join(lanes, 'agent-named.jsonl'), jsonl([
      { type: 'user', message: { role: 'user', content: LANE_LINE }, timestamp: '2026-09-10T09:00:03.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: text('the lane worked') }, timestamp: '2026-09-10T09:00:04.000Z' },
    ]));
    writeFileSync(path.join(lanes, 'agent-named.meta.json'), JSON.stringify({
      agentType: 'general-purpose', description: LANE_LINE,
      toolUseId: 'toolu_NAMED', spawnDepth: 1,
    }));

    process.env['CLAUDE_CONFIG_DIR'] = namedHome;
    const previous = process.cwd();
    process.chdir(namedCwd);
    try {
      runCli(['init'], namedCwd, () => {});
      runCli(['conversation', 'rebuild'], namedCwd, () => {});
      // **The write the server may not make.** `ConversationIndex.open` creates
      // tables, so nothing under `src/ui/` may call it; the name arrives the
      // way every other fact in this index does, through the CLI.
      runCli(['conversation', 'name', NAMED_SESSION, OURS], namedCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    namedHarness = await startUiChild(namedCwd);
  });

  test.afterAll(async () => {
    await namedHarness?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (namedCwd) removeTree(namedCwd);
    if (namedHome) removeTree(namedHome);
  });

  const openNamed = async (page: Page, lang: 'en' | 'he'): Promise<void> => {
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(namedHarness.port);
    await page.goto(`http://127.0.0.1:${namedHarness.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  for (const lang of ['en', 'he'] as const) {
    test(`the row draws our name, marks it ours, and still says what Claude Code calls it (${lang})`, async ({ page }) => {
      await openNamed(page, lang);
      const row = page.locator('.convrow').first();
      await expect(row).toBeVisible();

      // 1. OUR NAME is the heading — `bdi.convtitle`, the element the borrowed
      //    title used to be alone in.
      await expect(row.locator('bdi.convtitle')).toHaveText(OURS);
      // 2. AND IT IS MARKED AS OURS, in the reader's own language.
      await expect(row).toContainText(lang === 'he' ? 'השם ניתן כאן' : 'named here');
      // 3. AND THE BORROWED NAME IS STILL DRAWN. This is the assertion the
      //    item is actually about: the harness's record is REPORTED and never
      //    rewritten, so the reader can tell the two names apart.
      await expect(row).toContainText(lang === 'he' ? 'Claude Code קורא לה' : 'Claude Code calls it');
      await expect(row).toContainText(THEIRS);
      // And the model wrote that one, which the row still says — the borrowed
      // name keeps its own provenance rather than losing it to ours.
      await expect(row).toContainText(lang === 'he' ? 'המודל' : 'the model');

      await page.screenshot({
        path: `e2e/screens/conversations-named-${lang}.png`, fullPage: true,
      });
    });
  }

  /**
   * A name a person types and then cannot search for would be worse than no
   * naming at all: they would look for their own word, find nothing, and read
   * that as the session being gone. `conv.searchScope` promises the search
   * reads it; this is that promise driven.
   */
  test('the search finds the session by the name we gave it', async ({ page }) => {
    await openNamed(page, 'en');
    const card = page.locator('.card.pane').filter({ has: page.locator('.convfilter') });
    const rows = card.locator('.convrow');
    await expect(rows).toHaveCount(1);

    await card.locator('.convfilter input').first().fill('tuesday');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('bdi.convtitle')).toHaveText(OURS);
  });

  /**
   * **The document head, and the BARE LANE WINDOW beside it** — `plan:archive
   * seq:51` ships `/lane.html`, which imports `mountDocument` and forks
   * nothing, so `titleNodes` runs on two pages and one wrong branch is wrong on
   * both.
   *
   * A lane carries no name of ours BY CONSTRUCTION: names are keyed by session
   * and `mycontext conversation name` refuses a lane id in those words. So the
   * lane window must draw the line its dispatcher typed, unmarked — exactly
   * what it drew before this feature existed.
   */
  test('the document head carries all three, and a bare lane window carries none of them', async ({ page }) => {
    await openNamed(page, 'en');
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    const head = page.locator('.tvtitle');
    await expect(head.locator('bdi.convtitle')).toHaveText(OURS);
    await expect(head).toContainText('named here');
    await expect(head).toContainText('Claude Code calls it');
    await expect(head).toContainText(THEIRS);

    await page.goto(`http://127.0.0.1:${namedHarness.port}/lane.html?id=agent-named`);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(page.locator('#strip'), 'there is no application here').toHaveCount(0);
    const laneHead = page.locator('.tvtitle');
    await expect(laneHead.locator('bdi.convtitle')).toHaveText(LANE_LINE);
    await expect(laneHead, 'a lane must never be drawn as though we had named it')
      .not.toContainText('named here');
    await expect(laneHead).not.toContainText(OURS);

    await page.screenshot({ path: 'e2e/screens/conversations-named-lane.png', fullPage: true });
  });
});
