import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import type { UnmeasurableWhy } from '../../src/core/context-occupancy.ts';

/**
 * `mycontext statusline` — the §4b bridge (ui3 tasks 4 and 5).
 *
 * **Why this file redirects HOME before it imports anything.**
 * `statusline install --yes` saves the setting it replaced under
 * `Workspace.globalRoot`, which is `path.join(homedir(), '.my-context')`
 * resolved ONCE at module load (`src/core/workspace.ts`). A test that ran
 * `install --yes` without moving `homedir()` first would write a backup file
 * into the developer's real global directory — the exact offence
 * `test/helpers/real-home-guard.ts` was written for after two fixture files
 * left there turned 134 unrelated tests red. So this file does what
 * `test/cli/edit-global-layer.test.ts` and `supersede-global-layer.test.ts`
 * do: point `HOME`/`USERPROFILE` at a temp directory at the TOP of the file,
 * `await import()` the module graph only afterwards, and assert the redirect
 * took effect before anything depends on it.
 *
 * The redirect also reaches the SPAWNED runs below, which inherit the
 * environment — so a child process that installs writes its backup into the
 * same fake home.
 */
const home = mkdtempSync(path.join(tmpdir(), 'myctx-sl-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;
// A test that left this set from the ambient environment would be asserting
// against the developer's own Claude Code configuration directory.
delete process.env.CLAUDE_CONFIG_DIR;

const { runCli } = await import('../../src/cli/index.ts');
const { recordAudit } = await import('../../src/core/audit.ts');
const { classifyContext, readTee, writeTee } = await import('../../src/core/statusline-tee.ts');
const { GLOBAL_DIR, resolveWorkspace } = await import('../../src/core/workspace.ts');
const { ONE_LINE_ENV, myctxShare, myctxShareByRow, occupancyFromPayload, occupancyFromTee,
  statusLineText } = await import('../../src/cli/commands/statusline.ts');
const { LEVEL_GLYPH, LEVEL_ICON, LEVEL_INK, NO_EXTRAS, SEP, separatorFor, usageLevelOf } =
  await import('../../src/cli/commands/statusline-powerline.ts');
const { openProjection, queryProjection, syncProjection } =
  await import('../../src/core/audit-db.ts');
const { INSTALLED, claudeSettingsPath } = await import('../../src/cli/commands/statusline-install.ts');

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

test('the fake home actually took effect — otherwise every install test below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

/* -------------------------------------------------------------------- *
 * Task 4: the bridge command.                                          *
 * -------------------------------------------------------------------- */

/** The one artefact every saved copy is keyed into. */
const SAVED_COPY = path.join(GLOBAL_DIR, 'statusline-replaced.json');

/**
 * The saved copies live in ONE file for the whole machine — keyed by settings
 * path since 2026-08-27, but still one file — so every test in this run shares
 * it, and several tests below leave an entry behind on purpose (an `uninstall`
 * that refuses, or one run without `--yes`, does not spend the saved copy).
 * Clearing it here is what makes an assertion about the map's KEYS an assertion
 * about the test that wrote them, rather than about whatever ran before it.
 * `test/cli/statusline-chain.test.ts` does the same thing for the same reason.
 */
function project(): string {
  rmSync(SAVED_COPY, { force: true });
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-sl-'));
  runCli(['init'], dir, () => {});
  return dir;
}

/** One saved copy, as stored: `{ "<resolved settings path>": { …entry… } }`. */
interface SavedEntry {
  replacedAt: string;
  settingsPath: string;
  previous: unknown;
  previousText: string | null;
  installedText: string;
}

function savedMap(): Record<string, SavedEntry> {
  // Named rather than left to ENOENT: the mutant this catches — an `uninstall`
  // that removes the whole store instead of its own entry — makes the file
  // VANISH, and a raw `readFileSync` failure reports that as an I/O error deep
  // in a helper rather than as the destroyed backup it is.
  assert.ok(
    existsSync(SAVED_COPY),
    `the saved-copy file is gone (${SAVED_COPY}). Every profile's saved copy went with it — an `
    + 'uninstall must remove its OWN entry, and the file only when the last entry goes.',
  );
  return JSON.parse(readFileSync(SAVED_COPY, 'utf8')) as Record<string, SavedEntry>;
}

/**
 * The entry for one settings file, asserted to EXIST.
 *
 * Read through `path.resolve` rather than through the raw string the test
 * passed to `--settings`: the key is the resolved path, which is the whole
 * point of the keying — two spellings of one file must not become two entries.
 */
function savedEntry(file: string): SavedEntry {
  const entry = savedMap()[path.resolve(file)];
  assert.ok(entry !== undefined, `no saved copy for ${file}; keys are ${JSON.stringify(Object.keys(savedMap()))}`);
  return entry;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/**
 * Claude Code's status-line payload, shaped as build 2.1.239 sends it.
 *
 * `projectDir` is a real directory rather than the spec's illustrative
 * `/repo`: the command resolves the workspace from what the PAYLOAD says (see
 * `cmdStatusline`), so a payload naming a directory that does not exist is
 * the "no project workspace" row, and a test that used it could never see a
 * tee written at all.
 */
function payload(sessionId: string, projectDir: string): Record<string, unknown> {
  return {
    session_id: sessionId,
    cwd: projectDir,
    version: '2.1.239',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: projectDir, project_dir: projectDir },
    context_window: {
      total_input_tokens: 47000, total_output_tokens: 9000, context_window_size: 200000,
      current_usage: {
        input_tokens: 1000, cache_creation_input_tokens: 6000,
        cache_read_input_tokens: 40000, output_tokens: 9000,
      },
      used_percentage: 23.5, remaining_percentage: 76.5,
    },
  };
}

/**
 * One bar, spelled the way the renderer spells it.
 *
 * The separator is composed from the module's own `SEP` rather than typed as a
 * literal: U+E0B0 is a private-use glyph that an editor, a terminal or a
 * copy-paste renders as nothing at all, and a test that pasted it would either
 * assert against an empty string it could not see or fail with two identical
 * looking values. Composing it means the assertions below read as blocks.
 *
 * **AND IT PICKS THE THIN SEPARATOR THE WAY THE RENDERER DOES.** Two blocks
 * that share a background are parted by U+E0B1, because the solid one would be
 * painted in the colour it sits on and vanish. That rule is old; what is new
 * since the used-of-maximum ruling is how OFTEN it fires — five fields can now
 * be one band at once, so a calm bar is mostly thin separators. The helper
 * derives it from the blocks rather than restating a hand-kept list of which
 * pairs are adjacent, using the same `separatorFor` the renderer calls.
 */
function bar(...blocks: string[]): string {
  const joined = blocks.map((block, i) => {
    if (i === blocks.length - 1) return block;
    const here = inkOf(block);
    const next = inkOf(blocks[i + 1]!);
    return `${block} ${separatorFor(here, next)} `;
  }).join('');
  return `▐ ${joined} ▌`;
}

/**
 * The ink a rendered block text would carry — derived by asking the module,
 * never by a table here. Only the used-of-max fields can share a ground, so
 * only they need banding; everything else keeps its own fixed hue and the
 * default is a distinct one so unrelated blocks always get the solid arrow.
 */
function inkOf(text: string): { bg: number; fg: number } {
  const pct = /(\d+(?:\.\d+)?)%/.exec(text);
  if (pct === null || !/(^|\s)(ask|ctx|7d|5h|myctx) /.test(text)) {
    // A block that is not used-of-max keeps its own fixed hue, and no two of
    // them share one, so the SOLID arrow is always right between them. Keyed
    // on the whole text rather than its length — 'p' and 'b' are both one
    // character and are the project and the branch, which are two hues.
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) % 100_000;
    return { bg: -1 - h, fg: 0 };
  }
  const level = usageLevelOf(Number(pct[1]));
  return level === null ? { bg: -1, fg: 0 } : LEVEL_INK[level];
}

/**
 * The bar as ROWS, joined by the newline Claude Code splits on.
 *
 * Two rows under the owner's 2026-08-31 ruling; THREE since the
 * used-of-maximum ruling of 2026-09-01 gave the ask and the context figure a
 * row of their own. Variadic rather than fixed at two, so a caller with
 * nothing to say on the account row simply passes two.
 *
 * Composed from `bar` rather than spelled out, so a change to the caps or the
 * separator moves every form together.
 */
function bars(...rows: string[][]): string {
  return rows.map((row) => bar(...row)).join('\n');
}

/**
 * The four blocks the owner drew, and the states the last one takes.
 *
 * Rendered to a STRING and asserted on — nothing here installs anything, writes
 * a setting or touches a home directory (`test/helpers/real-home-guard.ts`).
 *
 * `colour: false` throughout, so what is pinned is the TEXT: every block says
 * its fact in words, and the hue is the second carrier rather than the only
 * one. The colours, and the band they are chosen by, are pinned in
 * `test/cli/statusline-powerline.test.ts` against the web's own
 * `occupancyLevel` rather than against a number written here.
 */
test('statusLineText renders each state without ever inventing a number', () => {
  const base = {
    ...NO_EXTRAS,
    model: 'Opus 4.5',
    project: 'test_mycontext_plugin',
    branch: 'campaign/my-context-test',
    threshold: 98,
    myctx: null,
    focus: null,
    lastAudit: null,
    myctxNote: null,
    teeNote: null,
  };
  const at = (percent: number): string => statusLineText(
    { ...base, occupancy: { state: 'known' as const, percent, ageMs: 0, usedTokens: Math.round(percent * 10_000), windowSize: 1_000_000 } }, false, null,
  );
  const head = ['Opus 4.5', 'test_mycontext_plugin', 'campaign/my-context-test'];

  // Calm, approaching, and at the ask. The figures are not chosen here: 88.2 is
  // `occupancyBands(98).warn` and 98 is the threshold itself, so moving either
  // boundary moves which of these is which — see the powerline test for the pin.
  // The bands are ABSOLUTE — green below 60, amber to 85, red past it — and
  // they do not move when the handover threshold does.
  //
  // The ASK is the other question, and since the owner's 2026-08-31 ruling it
  // answers at EVERY fill rather than falling silent until it is nearly due.
  // Since the used-of-maximum ruling of 2026-09-01 it answers in the same four
  // controls every such field uses, with the threshold as its maximum — and it
  // still collapses to WORDS once the ask has fired, because past the ask the
  // number stops being the point and the action is.
  assert.equal(at(42), bars(head, [
    'ask ▓▓▓▓░░░░░░ 43% (42.0 / 98)', 'ctx ▓▓▓▓░░░░░░ 42.0% (420.0k / 1.0M)']));
  assert.equal(at(70), bars(head, [
    `${LEVEL_ICON.warning} ask ▓▓▓▓▓▓▓░░░ 71% (70.0 / 98)`,
    `${LEVEL_ICON.warning} ctx ▓▓▓▓▓▓▓░░░ 70.0% (700.0k / 1.0M)`]));
  assert.equal(at(93.4), bars(head, [
    `${LEVEL_ICON.critical} ask ▓▓▓▓▓▓▓▓▓▓ 95% (93.4 / 98)`,
    `${LEVEL_ICON.critical} ctx ▓▓▓▓▓▓▓▓▓░ 93.4% (934.0k / 1.0M)`]));
  assert.equal(at(99.2), bars(head, [
    '◆ handover due',
    `${LEVEL_ICON.critical} ctx ▓▓▓▓▓▓▓▓▓▓ 99.2% (992.0k / 1.0M)`]));

  // The reasons `readOccupancy` keeps apart stay apart here. Collapsing them
  // into one "unknown" is the whole failure that type exists to prevent, and
  // the status line is where a person reads the answer.
  const why = (w: UnmeasurableWhy): string => statusLineText(
    { ...base, occupancy: { state: 'unmeasurable' as const, why: w } }, false, null,
  );
  assert.equal(why('no-bridge'), bars(head, [`${LEVEL_GLYPH.neutral} ctx — no bridge`]));
  assert.equal(why('no-sample'), bars(head, [`${LEVEL_GLYPH.neutral} ctx — no sample`]));
  assert.equal(why('unknown-shape'), bars(head, [`${LEVEL_GLYPH.neutral} ctx — unreadable`]));
  assert.equal(
    new Set([why('no-bridge'), why('no-sample'), why('unknown-shape')]).size, 3,
    'three reasons, three sentences — a reader told "not installed" about a bridge that IS '
    + 'installed goes and installs it a second time',
  );

  // A FOSSIL SAYS `—` AND NEVER A NUMBER. A stale figure drawn as if fresh is
  // the defect that cost a missed handover at a full window while the strip
  // read 60.1%; the one thing this block must never do is look like a reading.
  assert.equal(why('stale'), bars(head, [`${LEVEL_GLYPH.neutral} ctx — stale`]));
  // The CTX block specifically, not the whole line — `Opus 4.5` has a digit in
  // it and the model block is entitled to one. What must carry no digit is the
  // block a reader reads as the occupancy.
  const staleCtx = why('stale').split(SEP).at(-1);
  assert.doesNotMatch(staleCtx ?? '', /[0-9]/);
});

/**
 * The payload states map onto the reasons the tee does — the same mapping, not
 * a second opinion about the same three shapes.
 *
 * `not-yet-known` is `no-sample` and NOT `unknown-shape`, for
 * `readOccupancy`'s own stated reason: `current_usage === null` is what Claude
 * Code sends between a compaction and the next API call, and reporting a schema
 * break there sends a person to re-verify their binary over a payload that was
 * perfectly well formed and simply had nothing to report yet.
 */
test('a payload with no workspace behind it is classified the way the tee would be', () => {
  assert.deepEqual(
    occupancyFromPayload(classifyContext(payload('s', '/repo'))),
    // The two numbers the percentage came FROM, carried rather than
    // reconstructed: the bar draws `(47.0k / 200.0k)` beside the figure since
    // the used-of-maximum ruling, and a numerator back-derived from a rounded
    // percentage would be a worse number than the one already in hand.
    { state: 'known', percent: 23.5, ageMs: 0, usedTokens: 47_000, windowSize: 200_000 },
  );
  assert.deepEqual(
    occupancyFromPayload({
      state: 'not-yet-known', usedTokens: null, windowSize: 200000, percent: null,
    }),
    { state: 'unmeasurable', why: 'no-sample' },
  );
  assert.deepEqual(
    occupancyFromPayload({ state: 'unknown', usedTokens: null, windowSize: null, percent: null }),
    { state: 'unmeasurable', why: 'unknown-shape' },
  );
  // `known` with no percentage is a window size that was absent or zero, which
  // is a shape this product cannot read — never a 0% window.
  assert.deepEqual(
    occupancyFromPayload({ state: 'known', usedTokens: 4000, windowSize: null, percent: null }),
    { state: 'unmeasurable', why: 'unknown-shape' },
  );
});

/**
 * A tee that did not land is disclosed even when the myctx half is fine.
 *
 * The obvious shape — one note field, rendered only when `myctx` is null —
 * drops this on the floor: `writeTee` refuses an unsafe `session_id` while
 * `myctxShare` answers for that same id perfectly well, so the line would
 * show a confident myctx figure and never mention that the web UI is getting
 * no sample at all. That is `INV-nothing-is-dropped-silently` on the one
 * surface whose whole job is disclosure — and the powerline did not get to
 * drop it just because the owner's sketch had four blocks in it.
 *
 * **SUPERSEDED, and recorded rather than dropped.** This paragraph used to
 * read: *"The context block stays LAST whatever else is disclosed: the ruling
 * is that the right end of the bar is what shifts as the window fills, and a
 * block after it would move the thing the eye is trained on."* An owner ruling
 * of 2026-08-31 replaced it — the context figure is now CENTRED, with the
 * disclosures drawn to its right, because the owner ruled it the most
 * important information on the bar and the centre is where the eye lands. See
 * `statusline-powerline.ts` · `buildSegments` for the full record of the
 * supersession. What this test pins is unchanged: both notes reach the line.
 */
/**
 * **THE WAY BACK TO ONE LINE, and it is a real rendering rather than a code
 * path nobody has looked at.**
 *
 * The two-line form rests on a reading of ONE build's renderer. Two multi-line
 * regressions are already on record — a second line vanishing on narrow
 * terminals, and 2.1.80 truncating line 2 as though it were joined to line 1 —
 * so a user who meets a third needs a way back that does not involve waiting
 * for this project to ship. What they get is one line carrying EVERYTHING,
 * never a second line quietly lost.
 */
test('MYCONTEXT_STATUSLINE_ONE_LINE folds the bar back to a single line, losing nothing', () => {
  const base = {
    ...NO_EXTRAS,
    model: 'Opus 4.5', project: 'test_mycontext_plugin', branch: 'campaign/my-context-test',
    threshold: 98,
    occupancy: { state: 'known' as const, percent: 42, ageMs: 0, usedTokens: 420_000, windowSize: 1_000_000 },
    myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
    focus: null,
    lastAudit: null,
    myctxNote: null, teeNote: null,
  };
  const two = statusLineText(base, false, null, {});
  const one = statusLineText(base, false, null, { [ONE_LINE_ENV]: '1' });

  assert.equal(two.split('\n').length, 3, 'three rows by default since 2026-09-01');
  assert.equal(one.split('\n').length, 1, 'one line when the escape hatch is set');

  // NOTHING IS LOST. Every block on any row of the three-row form is still on
  // the single line — which is the whole claim the fallback makes.
  for (const block of ['Opus 4.5', 'test_mycontext_plugin', 'campaign/my-context-test',
    'ask ▓▓▓▓░░░░░░ 43% (42.0 / 98)', 'ctx ▓▓▓▓░░░░░░ 42.0% (420.0k / 1.0M)',
    'myctx ░░░░░░░░░░ 0.6% (6.2k / 1.0M)']) {
    assert.ok(two.includes(block), `two-line form is missing ${block}`);
    assert.ok(one.includes(block), `one-line fallback is missing ${block}`);
  }

  // An empty value is not a refusal — the same convention NO_COLOR follows,
  // so a shell that exports an empty placeholder does not silently downgrade
  // the bar for everyone using it.
  assert.equal(
    statusLineText(base, false, null, { [ONE_LINE_ENV]: '' }).split('\n').length, 3,
  );
});

test('a tee that did not land is disclosed beside a myctx share that did', () => {
  const line = statusLineText(
    {
      ...NO_EXTRAS,
      model: 'Opus 4.5',
      project: 'test_mycontext_plugin',
      branch: 'campaign/my-context-test',
      threshold: 98,
      occupancy: { state: 'known', percent: 23.5, ageMs: 0, usedTokens: Math.round((23.5) * 10_000), windowSize: 1_000_000 },
      myctx: { tokens: 6200, injections: 3, unrecorded: 0 },
      focus: null,
      lastAudit: null,
      myctxNote: null,
      teeNote: 'tee not written (disk full)',
    },
    false,
    null,
  );
  assert.equal(line, bars(
    ['Opus 4.5', 'test_mycontext_plugin', 'campaign/my-context-test'],
    ['ask ▓▓░░░░░░░░ 24% (23.5 / 98)', 'ctx ▓▓░░░░░░░░ 23.5% (235.0k / 1.0M)'],
    // The account row: the banded share, and the disclosure that rides the
    // context field in its absent state.
    ['myctx ░░░░░░░░░░ 0.6% (6.2k / 1.0M)', 'tee not written (disk full)'],
  ));

  // `≥` and not a rounded-up guess: some records carry no estimate, so the
  // true share is at least this and the block says exactly that.
  assert.equal(
    statusLineText(
      {
        ...NO_EXTRAS,
        model: null, project: null, branch: null, threshold: 98,
        occupancy: { state: 'known', percent: 23.5, ageMs: 0, usedTokens: Math.round((23.5) * 10_000), windowSize: 1_000_000 },
        myctx: { tokens: 6200, injections: 3, unrecorded: 2 },
        focus: null,
        lastAudit: null,
        myctxNote: null, teeNote: null,
      },
      false, null,
    ),
    // The `≥` rides the LABEL because it qualifies the NUMERATOR — some
    // injection records carry no frozen estimate, so the true share is at
    // least this — and that is a fact about the count, never about the bar.
    bars(['ask ▓▓░░░░░░░░ 24% (23.5 / 98)', 'ctx ▓▓░░░░░░░░ 23.5% (235.0k / 1.0M)'],
      ['myctx ≥ ░░░░░░░░░░ 0.6% (6.2k / 1.0M)']),
  );

  // Two notes, two fields: a share that could not be computed is named, and
  // the tee's own refusal is named beside it rather than instead of it.
  assert.equal(
    statusLineText(
      {
        ...NO_EXTRAS,
        model: null, project: null, branch: null, threshold: 98,
        occupancy: { state: 'known', percent: 23.5, ageMs: 0, usedTokens: Math.round((23.5) * 10_000), windowSize: 1_000_000 },
        myctx: null,
        focus: null,
        lastAudit: null, myctxNote: 'projection sync failed',
        teeNote: 'tee not written (unsafe session id)',
      },
      false, null,
    ),
    // Both notes ride the ACCOUNT row, because a tee that stopped landing is
    // news and news goes where the reader is still looking — never on the
    // identity row, and never crowding the window pair.
    bars(
      ['ask ▓▓░░░░░░░░ 24% (23.5 / 98)',
        'ctx ▓▓░░░░░░░░ 23.5% (235.0k / 1.0M)'],
      ['myctx unavailable (projection sync failed)',
        'tee not written (unsafe session id)'],
    ),
  );

  // A session that injected nothing is not a session with a zero share: the
  // block is absent, and the owner's four blocks are what is left.
  assert.equal(
    statusLineText(
      {
        ...NO_EXTRAS,
        model: 'Opus 4.5', project: 'p', branch: 'b', threshold: 98,
        occupancy: { state: 'known', percent: 23.5, ageMs: 0, usedTokens: Math.round((23.5) * 10_000), windowSize: 1_000_000 },
        myctx: { tokens: 0, injections: 0, unrecorded: 0 },
        focus: null,
        lastAudit: null,
        myctxNote: null, teeNote: null,
      },
      false, null,
    ),
    bars(['Opus 4.5', 'p', 'b'],
      ['ask ▓▓░░░░░░░░ 24% (23.5 / 98)',
        'ctx ▓▓░░░░░░░░ 23.5% (235.0k / 1.0M)']),
  );
});

test('myctxShare sums recorded tokens and COUNTS absences — never defaults them to zero', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 4000,
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-b', tier: 'jit' }], tokens: 2200,
    });
    // A record written before the `tokens` field existed: counted, never summed as zero.
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/b.ts',
      injected: [{ id: 'RULE-c', tier: 'jit' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'OTHER', hook: 'PreToolUse', path: 'src/c.ts',
      injected: [{ id: 'RULE-d', tier: 'jit' }], tokens: 999,
    });
    assert.deepEqual(myctxShare(root, 's1'), { tokens: 6200, injections: 3, unrecorded: 1 });
    assert.deepEqual(myctxShare(root, 'never-seen'), { tokens: 0, injections: 0, unrecorded: 0 });
  } finally {
    removeTree(dir);
  }
});

/**
 * **The pin on the one rule `myctxShare` spells twice.**
 *
 * The share is computed as a SQL aggregate because the record-by-record
 * version measured p95 71.8 ms over 5,000 injection records on a per-message
 * path (`test/perf/statusline-latency.perf.ts`). The FILTER is not respelled —
 * `filterSelect` is nested verbatim — but "a `tokens` that is not a number is
 * an absence, counted rather than zeroed" now exists in SQL as well as in
 * JavaScript, and two spellings of one rule is the drift this project keeps
 * finding. So both are run over the same corpus and required to agree, the way
 * `test/core/audit-projection.test.ts` holds `filterSelect` to `filterAudit`.
 *
 * The corpus exercises every shape the two could disagree about: a recorded
 * count, a record with no `tokens` key at all, an explicit JSON `null`, a
 * string where a number belongs, a zero (which `IS NOT NULL` and a falsy check
 * disagree about), another session's record, and a non-injection record.
 */
test('the SQL share and the record-by-record share give the same answer', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    const inject = (extra: Record<string, unknown>): void => {
      recordAudit(root, {
        kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
        injected: [{ id: 'RULE-a', tier: 'jit' }],
        ...extra,
      } as Parameters<typeof recordAudit>[1]);
    };
    inject({ tokens: 4000 });
    inject({});                       // the field never existed
    inject({ tokens: null });         // present, explicitly no number
    inject({ tokens: '2200' });       // a string where a number belongs
    inject({ tokens: 0 });            // a real zero: recorded, and it is not an absence
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'OTHER', hook: 'PreToolUse', path: 'src/c.ts',
      injected: [{ id: 'RULE-d', tier: 'jit' }], tokens: 999,
    });
    recordAudit(root, {
      kind: 'mutation', op: 'create', sessionId: 's1', itemId: 'CONST-x', origin: 'human',
    });

    const db = openProjection(root);
    let byRow;
    try {
      syncProjection(root, db);
      byRow = myctxShareByRow(queryProjection(db, { sessionId: 's1', kind: 'injection' }));
    } finally {
      db.close();
    }
    assert.deepEqual(byRow, { tokens: 4000, injections: 5, unrecorded: 3 });
    assert.deepEqual(myctxShare(root, 's1'), byRow);
  } finally {
    removeTree(dir);
  }
});

/**
 * **THE ALLEGED CROSS-SESSION LEAK, PINNED SHUT** (statusline defect 1).
 *
 * The report was that `mycontext statusline` prints "whichever sample was
 * written most recently — in practice, the operator's own live session", so
 * that every session but one is told something false about itself and the
 * colour bands can never be seen to move. It was reproduced four times, and
 * the reproduction varied `context_window.used_percentage`.
 *
 * It is NOT what the code does, and this test is the proof, run the way the
 * defect was reported: two sessions, one workspace, interleaved, through a
 * real process. Each is told its own number.
 *
 * The reproduction could not have shown otherwise. `classifyContext` derives
 * the percentage from `current_usage`'s three token counts over
 * `context_window_size` — §4b constraint 3, matching what Claude Code itself
 * displays — and NEVER from `used_percentage`, the rounded integer Claude Code
 * sends alongside it. Four payloads differing only in a field nothing reads
 * are four identical payloads, and the one figure they all printed was the
 * base payload's own, correctly. The next test asserts that too, because "the
 * field is ignored" is what made a careful reading of the symptom point at the
 * wrong module.
 *
 * The mutation that makes this red is the defect exactly as reported: have
 * `readTee` answer with the newest file in `.statusline/` rather than with the
 * named session's.
 */
test('two sessions in one workspace are each told their OWN context figure', () => {
  const dir = project();
  try {
    const at = (sessionId: string, cacheRead: number): Record<string, unknown> => {
      const p = payload(sessionId, dir);
      (p.context_window as Record<string, unknown>).current_usage = {
        input_tokens: 1000, cache_creation_input_tokens: 6000,
        cache_read_input_tokens: cacheRead, output_tokens: 9000,
      };
      return p;
    };
    const line = (p: Record<string, unknown>): string => {
      const result = spawnSync(process.execPath, [CLI, 'statusline'], {
        cwd: dir, input: JSON.stringify(p), encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };

    // 25,000 / 200,000 = 12.5%; 186,000 / 200,000 = 93.0%. Interleaved, then
    // repeated, because the report rested on its second pass: "with the tee
    // files definitely present, printed the same figure again for both".
    for (const pass of [1, 2]) {
      assert.match(line(at('sess-low', 18000)), /ctx .*12\.5%/, `pass ${pass}: the low session`);
      assert.match(line(at('sess-high', 179000)), /ctx .*93\.0%/, `pass ${pass}: the high session`);
    }

    // And the band MOVES with it, which the report says can never be observed:
    // the low session is `ok` and the high one is not.
    // The low session is `safe` and carries no icon; the high one is banded
    // and carries one. FOUR levels since 2026-09-01, so the assertion is about
    // WHETHER an icon is there rather than which of two glyphs it is.
    assert.ok(line(at('sess-low', 18000)).includes('ctx ▓░░░░░░░░░ 12.5%'));
    assert.ok(line(at('sess-high', 179000)).includes(`${LEVEL_ICON.critical} ctx `));
    assert.ok(!line(at('sess-low', 18000)).includes(LEVEL_ICON.critical));

    // **The read, asked directly, with the OTHER session's sample the newer of
    // the two on disk.** The command above cannot show this on its own: it
    // tees the session it was handed immediately before reading it back, so
    // that session's file is always the newest one in the directory and a
    // "newest wins" bug would be invisible to it. Here `sess-high` is written
    // last and `sess-low` is the one asked for, which is the report's scenario
    // exactly — two sessions open, one of them not the most recent writer.
    const root = path.join(dir, '.my_context');
    assert.equal(writeTee(root, at('sess-low', 18000)).written, true);
    assert.equal(writeTee(root, at('sess-high', 179000)).written, true);
    const low = occupancyFromTee(root, 'sess-low', Date.now());
    const high = occupancyFromTee(root, 'sess-high', Date.now());
    assert.equal(low.state, 'known');
    assert.equal(high.state, 'known');
    assert.equal(low.state === 'known' ? low.percent : null, 12.5,
      'the older session is still told its own number, not the newer writer’s');
    assert.equal(high.state === 'known' ? high.percent : null, 93);
  } finally {
    removeTree(dir);
  }
});

test('the context figure comes from `current_usage`, never from `used_percentage`', () => {
  const dir = project();
  try {
    const line = (mutate: (cw: Record<string, unknown>) => void): string => {
      const p = payload('sess-src', dir);
      mutate(p.context_window as Record<string, unknown>);
      const result = spawnSync(process.execPath, [CLI, 'statusline'], {
        cwd: dir, input: JSON.stringify(p), encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    // The reported reproduction, exactly: only `used_percentage` moves.
    for (const pct of [22, 65, 80, 93]) {
      assert.match(
        line((cw) => { cw.used_percentage = pct; cw.remaining_percentage = 100 - pct; }),
        /ctx .*23\.5%/,
        `used_percentage ${pct} changes nothing, because nothing reads it`,
      );
    }
    // The field that IS read moves it.
    assert.match(
      line((cw) => {
        cw.current_usage = {
          input_tokens: 1000, cache_creation_input_tokens: 6000,
          cache_read_input_tokens: 179000, output_tokens: 9000,
        };
      }),
      /ctx .*93\.0%/,
    );
  } finally {
    removeTree(dir);
  }
});

/**
 * **DEFECT 2: a lifetime total presented as a current share.**
 *
 * Measured on this repository's own corpus, 2026-08-31: 2,556,774 tokens over
 * 289 injection records and fourteen days, printed beside a 1,000,000-token
 * window that was 25.1% full. Two bounds fix it and NEITHER alone is enough —
 * bounding to the compaction epoch by itself still gave 1,192,523, because 83%
 * of that epoch belonged to `subagent-start`. So both bounds are asserted here
 * over one corpus built to separate them.
 */
test('the myctx share counts only THIS window: since the last compaction, and never a subagent’s', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    const inject = (op: string, sessionId: string, tokens: number): void => {
      recordAudit(root, {
        kind: 'injection', op, sessionId, hook: 'SessionStart',
        injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens,
      } as Parameters<typeof recordAudit>[1]);
    };

    // ── the epoch that was compacted away ──
    inject('session-start', 's1', 4000);
    inject('jit', 's1', 8000);
    inject('subagent-start', 's1', 500000);
    // Everything above this line is gone from the window.
    recordAudit(root, { kind: 'hook', op: 'pre-compact', sessionId: 's1', hook: 'PreCompact' });
    recordAudit(root, { kind: 'hook', op: 'post-compact', sessionId: 's1', hook: 'PostCompact' });

    // ── the epoch the session is actually holding ──
    inject('compact-restore', 's1', 1500);
    inject('jit', 's1', 700);
    // A subagent this session dispatched. The record carries THIS session's id
    // — `INJECTION_OPS` files it that way on purpose, so that
    // `audit --kind injection` does not under-report what models were shown —
    // but the text went into a different model's window and never into this
    // one.
    inject('subagent-start', 's1', 900000);

    assert.deepEqual(
      myctxShare(root, 's1'),
      { tokens: 2200, injections: 2, unrecorded: 0 },
      'only compact-restore + jit, and only since the pre-compact',
    );

    // A session that has never been compacted keeps the unbounded sum, which
    // is the right answer for it: it is still holding everything it was given.
    // The subagent bound still applies — that one is not about time.
    inject('session-start', 's2', 3300);
    inject('subagent-start', 's2', 777000);
    assert.deepEqual(myctxShare(root, 's2'), { tokens: 3300, injections: 1, unrecorded: 0 });
  } finally {
    removeTree(dir);
  }
});

test('the command tees the payload keyed by session and prints the line (spawned, real stdin)', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: JSON.stringify(payload('sess-e2e', dir)), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    // The powerline, end to end through a real process: the model block, the
    // context block, and both caps. Escapes ARE expected here — Claude Code
    // reads this pipe and renders them, which is why `colourAllowed` does not
    // key on `isTTY` alone (a status line coloured only when nobody is looking
    // at it is not a coloured status line).
    assert.match(result.stdout, /Opus 4\.5 /);
    assert.match(result.stdout, /ctx .*23\.5%/);
    assert.ok(result.stdout.includes('▐'), 'the opening cap is on the line');
    assert.ok(result.stdout.includes('▌'), 'the closing cap is on the line');
    assert.ok(result.stdout.includes(SEP), 'the powerline separator U+E0B0 is on the line');
    assert.doesNotMatch(result.stdout, / \| /, 'the pipe-delimited line was replaced, not wrapped');

    // NO_COLOR is honoured by the same command on the same payload, and what
    // comes back is the SAME TEXT with not one escape byte in it. This is the
    // half that cannot be checked by rendering in-process: the decision reads
    // the environment, so only a real child process can be told 'no'.
    const plain = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: JSON.stringify(payload('sess-e2e', dir)), encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(plain.status, 0, plain.stderr);
    assert.ok(!plain.stdout.includes('\u001b'), 'never a raw escape into a pipe that said no');
    assert.match(plain.stdout, /ctx .*23\.5%/);
    assert.ok(plain.stdout.includes(SEP), 'the same text, and the glyphs are text');
    const tee = readTee(path.join(dir, '.my_context'), 'sess-e2e');
    assert.equal((tee?.payload as { session_id?: string } | undefined)?.session_id, 'sess-e2e');
  } finally {
    removeTree(dir);
  }
});

test('unparseable stdin prints a diagnosis line and exits 0 — a status line must not crash-loop', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: 'not json', encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /unreadable status payload/);
  } finally {
    removeTree(dir);
  }
});

test('run bare with no stdin, it explains itself and exits 1', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: '', encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /status-line JSON on stdin/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The in-process guard, and it is not a nicety: `readFileSync(0)` BLOCKS
 * until stdin reaches EOF, and a `node --test` child's stdin is a pipe that
 * nothing ever closes — measured, on this machine, by running a one-line test
 * that reads fd 0 and watching it sit there until the runner was killed.
 * `test/docs/inventory.test.ts` runs every command the usage banner
 * advertises, bare and IN PROCESS, so a `statusline` that reached for stdin
 * there would not fail the suite: it would hang it, with no output naming the
 * cause. The command therefore reads stdin only when this process was
 * launched AS the CLI, which is the only time fd 0 is its to consume.
 */
test('called as a library rather than as the CLI, it never reaches for stdin', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline'], dir);
    assert.equal(code, 1);
    assert.match(out, /status-line JSON on stdin/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The bare verb takes no flags, and `--yes` is one of them.
 *
 * This is what keeps `statusline` out of §7's approval boundary
 * (`test/helpers/approval-boundary.ts`): that derivation probes every
 * registered command with a sentinel flag and then with `--yes`, and a
 * command that swallows either would be classified wrongly — unreachable in
 * the first case, "changes what governs this project" in the second.
 * `statusline install --yes` writes a Claude Code setting; it changes nothing
 * about what governs this project, so the bare verb must refuse both.
 */
test('the bare verb refuses an unknown flag, and refuses --yes among them', () => {
  const dir = project();
  try {
    const sentinel = run(['statusline', '--zzz-not-a-flag-any-command-accepts'], dir);
    assert.equal(sentinel.code, 1);
    assert.match(sentinel.out, /unknown option "--zzz-not-a-flag-any-command-accepts"/);
    const yes = run(['statusline', '--yes'], dir);
    assert.equal(yes.code, 1);
    assert.match(yes.out, /unknown option "--yes"/);
    assert.match(yes.out, /statusline install/, 'the refusal must point at the subcommand that does take it');
  } finally {
    removeTree(dir);
  }
});

test('an unknown subcommand is refused by name rather than read as a payload', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline', 'enable'], dir);
    assert.equal(code, 1);
    assert.match(out, /unknown subcommand "enable"/);
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Task 5: install / uninstall.                                          *
 * -------------------------------------------------------------------- */

test('claudeSettingsPath honours CLAUDE_CONFIG_DIR and falls back to ~/.claude', () => {
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '/cfg' }), path.join('/cfg', 'settings.json'));
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '' }), path.join(home, '.claude', 'settings.json'));
  assert.ok(claudeSettingsPath({}).endsWith(path.join('.claude', 'settings.json')));
});

function settingsFixture(dir: string, body: unknown, name = 'settings.json'): string {
  const file = path.join(dir, name);
  // No trailing newline, two-space indent: one particular shape of a file the
  // user wrote, so the round-trip test below has something to be identical to.
  writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
  return file;
}

const FOREIGN = { type: 'command', command: 'bash my-line.sh' };

test('install without --yes prints both settings and WRITES NOTHING', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file], dir);
    assert.equal(code, 0);
    assert.match(out, /bash my-line\.sh/, 'the existing setting must be shown');
    // Against INSTALLED.command itself, not against a substring that also
    // appears in the surrounding prose: the installed value stopped being
    // `mycontext statusline` on 2026-08-27 (that name is not on PATH), and a
    // /mycontext statusline/ match would have gone on passing by finding the
    // sentence about `uninstall` instead of the replacement it is checking.
    assert.ok(
      out.includes(JSON.stringify(INSTALLED)),
      `the replacement must be shown verbatim; got:\n${out}`,
    );
    assert.match(out, /--yes/, 'the refusal must say how to consent');
    assert.equal(readFileSync(file, 'utf8'), before, 'the settings file was written');
    assert.equal(existsSync(SAVED_COPY), false);
  } finally {
    removeTree(dir);
  }
});

test('install --yes writes the setting, preserves every other key, and saves the previous value', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const after = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(after.statusLine, INSTALLED);
    assert.equal(after.model, 'opus', 'an unrelated key was lost');

    const ws = resolveWorkspace(dir);
    assert.equal(
      path.join(ws.globalRoot, 'statusline-replaced.json'), SAVED_COPY,
      'the saved copy is still one file under globalRoot; only its INTERIOR is keyed now',
    );
    const backup = savedEntry(file);
    assert.deepEqual(backup.previous, FOREIGN);
    assert.equal(backup.settingsPath, file);

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(restored.statusLine, FOREIGN);
  } finally {
    removeTree(dir);
  }
});

/**
 * **Uninstall must actually undo install — to the byte.**
 *
 * Restoring the KEY is not the same as restoring the FILE. A settings file is
 * a document a human edits: its indentation, its key order and whether it
 * ends in a newline are that human's, and a "reversible" install that hands
 * back a re-serialized file has silently rewritten every one of them. The
 * comparison below is therefore on the bytes, not on the parsed object, and
 * it is the assertion this whole feature is judged by.
 */
test('the install → uninstall round trip leaves the settings file byte-identical', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    // Deliberately not what this command would write: four-space indent, our
    // key in the middle rather than first, and no trailing newline.
    const before = '{\n    "model": "opus",\n    "statusLine": {\n        "type": "command",\n'
      + '        "command": "bash my-line.sh"\n    },\n    "verbose": true\n}';
    writeFileSync(file, before, 'utf8');

    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    assert.notEqual(readFileSync(file, 'utf8'), before, 'install did not write anything');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(
      readFileSync(file, 'utf8'), before,
      'uninstall restored the statusLine key but not the file: the user\'s indentation, key '
      + 'order or trailing newline did not survive the round trip',
    );
  } finally {
    removeTree(dir);
  }
});

test('install --yes on a settings file with NO statusLine records previous: null; uninstall removes the key', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { model: 'opus' });
    const before = readFileSync(file, 'utf8');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    assert.equal(savedEntry(file).previous, null);

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.equal('statusLine' in restored, false);
    assert.equal(restored.model, 'opus');
    assert.equal(readFileSync(file, 'utf8'), before, 'the round trip was not byte-clean');
  } finally {
    removeTree(dir);
  }
});

test('a missing settings file installs into a fresh one, and uninstall takes the whole file back out', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'nested', 'settings.json');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const after = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(after.statusLine, INSTALLED);

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(
      existsSync(file), false,
      'install created this file; leaving an otherwise-empty settings file behind is not the '
      + 'inverse of creating one',
    );
    assert.match(out, /did not exist/, 'removing a file must be announced, never done quietly');
  } finally {
    removeTree(dir);
  }
});

test('an unparseable settings file is refused untouched — never clobbered', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    writeFileSync(file, '{ not json', 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /could not be parsed/);
    assert.equal(readFileSync(file, 'utf8'), '{ not json');
  } finally {
    removeTree(dir);
  }
});

test('a settings file holding a JSON array is refused too — "an object" is the requirement', () => {
  const dir = project();
  try {
    const file = path.join(dir, 'settings.json');
    writeFileSync(file, '[1, 2, 3]', 'utf8');
    const { code, out } = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /could not be parsed/);
    assert.equal(readFileSync(file, 'utf8'), '[1, 2, 3]');
  } finally {
    removeTree(dir);
  }
});

/**
 * **The dangling-entry defect, in the one shape that produces it.**
 *
 * `install --yes` run twice would, on the obvious implementation, save `{our
 * own value}` as "the previous setting" — and the user's real one is then
 * gone for good. `uninstall --yes` afterwards restores `mycontext
 * statusline`, i.e. it removes nothing: a `statusLine` entry pointing at a
 * bridge the user has just uninstalled. A half-removal that leaves a dangling
 * entry is worse than offering no uninstall at all, so the second install is
 * a no-op that says so.
 */
test('installing twice does not overwrite the saved previous value with our own', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const second = run(['statusline', 'install', '--settings', file, '--yes'], dir);
    assert.equal(second.code, 0, second.out);
    assert.match(second.out, /already installed/i);

    assert.deepEqual(
      savedEntry(file).previous, FOREIGN, 'the second install ate the real previous value',
    );

    assert.equal(run(['statusline', 'uninstall', '--settings', file, '--yes'], dir).code, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(restored.statusLine, FOREIGN);
  } finally {
    removeTree(dir);
  }
});

/**
 * The other half of "configuration is the user's to make": a `statusLine`
 * that is not ours is not ours to restore over. Between install and uninstall
 * the user may have pointed Claude Code at something else entirely — and
 * writing our saved backup over THAT would be the silent clobber this command
 * refuses on the way in, performed on the way out.
 */
test('uninstall refuses when the statusLine in the file is no longer ours, and names what is there', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const theirs = { type: 'command', command: 'starship prompt' };
    writeFileSync(file, JSON.stringify({ statusLine: theirs }, null, 2), 'utf8');
    const before = readFileSync(file, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 1);
    assert.match(out, /starship prompt/, 'the refusal must say what is there');
    assert.equal(readFileSync(file, 'utf8'), before, 'a foreign statusLine was overwritten');
  } finally {
    removeTree(dir);
  }
});

test('uninstall without --yes prints what it would restore and writes nothing', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);
    const installed = readFileSync(file, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file], dir);
    assert.equal(code, 0);
    assert.match(out, /bash my-line\.sh/);
    assert.match(out, /--yes/);
    assert.equal(readFileSync(file, 'utf8'), installed);
  } finally {
    removeTree(dir);
  }
});

test('uninstall with nothing installed says so and writes nothing', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { model: 'opus' });
    const before = readFileSync(file, 'utf8');
    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.match(out, /no mycontext status line/i);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    removeTree(dir);
  }
});

test('install and uninstall refuse a flag neither of them takes', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, {});
    for (const verb of ['install', 'uninstall']) {
      const { code, out } = run(['statusline', verb, '--settings', file, '--forse'], dir);
      assert.equal(code, 1, out);
      assert.match(out, /unknown option "--forse"/);
    }
  } finally {
    removeTree(dir);
  }
});

test('--settings with no value is refused rather than resolved to the real one', () => {
  const dir = project();
  try {
    const { code, out } = run(['statusline', 'install', '--settings'], dir);
    assert.equal(code, 1, out);
    assert.match(out, /--settings/);
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * The saved copy is keyed by the settings file it belongs to.           *
 * -------------------------------------------------------------------- */

/**
 * **The defect this section exists for (fixed 2026-08-27).**
 *
 * The saved copy used to be ONE object for the whole machine, so a second
 * install — into a second Claude Code profile, or into a temp file from a
 * test — would have overwritten the first install's only record of what it
 * replaced. `install` therefore carried a guard that REFUSED outright when a
 * live saved copy named a different settings file.
 *
 * The guard's reasoning was right and the design under it was wrong, in two
 * ways that both showed up as real failures. `--settings <path>` was not
 * isolated: the command consulted global state about a settings file nobody
 * asked it about, so anyone with two profiles was told to uninstall the other
 * one first. And `test/cli/f2-registry.test.ts` — which probes
 * `statusline install --settings <temp>` and does NOT redirect HOME — went red
 * or green according to whether the bridge happened to be installed in the
 * developer's own `~/.claude/settings.json`.
 *
 * Keying the saved copy by `path.resolve(settingsPath)` removes both: two
 * installs are two entries, and neither can reach the other's.
 */
const OTHER_FOREIGN = { type: 'command', command: 'starship prompt' };

test('two settings files install independently, and uninstalling one leaves the other restorable', () => {
  const dir = project();
  try {
    const a = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' }, 'profile-a.json');
    const b = settingsFixture(dir, { statusLine: OTHER_FOREIGN, model: 'sonnet' }, 'profile-b.json');
    const beforeA = readFileSync(a, 'utf8');
    const beforeB = readFileSync(b, 'utf8');

    const first = run(['statusline', 'install', '--settings', a, '--yes'], dir);
    assert.equal(first.code, 0, first.out);
    // The install the old single-file design REFUSED. Exit 0 here is the whole
    // fix: a second settings file is a second entry, not a collision.
    const second = run(['statusline', 'install', '--settings', b, '--yes'], dir);
    assert.equal(
      second.code, 0,
      `installing into a second settings file was refused — the saved copy is not keyed:\n${second.out}`,
    );

    assert.deepEqual(
      Object.keys(savedMap()).sort(), [path.resolve(a), path.resolve(b)].sort(),
      'both installs must be recorded, each under its own settings path',
    );
    assert.deepEqual(savedEntry(a).previous, FOREIGN);
    assert.deepEqual(
      savedEntry(b).previous, OTHER_FOREIGN, 'the second install ate the first\'s entry',
    );

    const removedA = run(['statusline', 'uninstall', '--settings', a, '--yes'], dir);
    assert.equal(removedA.code, 0, removedA.out);
    assert.equal(readFileSync(a, 'utf8'), beforeA, 'A did not come back byte for byte');
    assert.deepEqual(
      Object.keys(savedMap()), [path.resolve(b)],
      'uninstalling A removed more than its own entry — B has nothing left to restore',
    );
    assert.deepEqual(
      (JSON.parse(readFileSync(b, 'utf8')) as Record<string, unknown>).statusLine, INSTALLED,
      'uninstalling A wrote into B\'s settings file',
    );

    const removedB = run(['statusline', 'uninstall', '--settings', b, '--yes'], dir);
    assert.equal(removedB.code, 0, removedB.out);
    assert.equal(readFileSync(b, 'utf8'), beforeB, 'B did not come back byte for byte');
    assert.equal(
      existsSync(SAVED_COPY), false,
      'the last entry was spent; leaving an empty map behind is not the inverse of creating one',
    );
  } finally {
    removeTree(dir);
  }
});

/**
 * With no `--settings` and one entry, uninstall still finds it — that is the
 * spelling the owner actually runs, and the keying must not have cost it.
 */
test('uninstall with no --settings falls back to the one settings file that has a saved copy', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    const before = readFileSync(file, 'utf8');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const { code, out } = run(['statusline', 'uninstall', '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(readFileSync(file, 'utf8'), before);
  } finally {
    removeTree(dir);
  }
});

/**
 * …and with SEVERAL, it refuses and says what is installed where.
 *
 * This is the answer the old design could not give: with one saved copy there
 * was only ever one file to guess at. Guessing between two profiles would
 * restore one profile's value into the other's file, which is a swap rather
 * than an undo — so the ambiguity goes back to the person who can resolve it.
 */
test('uninstall with no --settings and several profiles saved names them all rather than guessing', () => {
  const dir = project();
  try {
    const a = settingsFixture(dir, { statusLine: FOREIGN }, 'profile-a.json');
    const b = settingsFixture(dir, { statusLine: OTHER_FOREIGN }, 'profile-b.json');
    assert.equal(run(['statusline', 'install', '--settings', a, '--yes'], dir).code, 0);
    assert.equal(run(['statusline', 'install', '--settings', b, '--yes'], dir).code, 0);
    const installedA = readFileSync(a, 'utf8');
    const installedB = readFileSync(b, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--yes'], dir);
    assert.equal(code, 1, out);
    assert.ok(out.includes(a), `the refusal must name every settings file it could mean; got:\n${out}`);
    assert.ok(out.includes(b), `the refusal must name every settings file it could mean; got:\n${out}`);
    assert.match(out, /--settings/, 'and it must say how to disambiguate');
    assert.equal(readFileSync(a, 'utf8'), installedA, 'a refusal wrote to A anyway');
    assert.equal(readFileSync(b, 'utf8'), installedB, 'a refusal wrote to B anyway');
    assert.equal(Object.keys(savedMap()).length, 2, 'a refusal spent a saved copy');
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Migration from the legacy single-object shape.                        *
 * -------------------------------------------------------------------- */

/**
 * The legacy file, in the exact shape every build before 2026-08-27 wrote:
 * one object, `settingsPath` at the top level, and no key above it.
 *
 * `previousText` is deliberately nothing this command would ever produce —
 * tab indentation, our key in the middle, no trailing newline — because that
 * is the whole value of saving the FILE rather than the key, and a migration
 * that canonicalized it would be indistinguishable from one that worked.
 */
function legacyFixture(dir: string): { file: string; previousText: string; legacy: SavedEntry } {
  const file = path.join(dir, 'legacy-settings.json');
  const previousText = '{\n\t"model": "opus",\n\t"statusLine": {\n\t\t"type": "command",\n'
    + '\t\t"command": "bash my-line.sh"\n\t},\n\t"verbose": true\n}';
  const installedText = `${JSON.stringify(
    { ...(JSON.parse(previousText) as Record<string, unknown>), statusLine: INSTALLED }, null, 2,
  )}\n`;
  writeFileSync(file, installedText, 'utf8');
  const legacy: SavedEntry = {
    replacedAt: '2026-08-01T09:15:00.000Z',
    settingsPath: file,
    previous: FOREIGN,
    previousText,
    installedText,
  };
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(SAVED_COPY, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8');
  return { file, previousText, legacy };
}

/**
 * **The one thing in this change that must not go wrong.**
 *
 * A saved copy in the legacy shape exists on the owner's machine right now and
 * holds his real previous status line. `readSaved` therefore accepts BOTH
 * shapes, reading the legacy object as an entry keyed by its own
 * `settingsPath` — so an uninstall works off it with no migration having
 * happened at all, which is exactly the case where a user upgrades and
 * immediately uninstalls.
 */
test('a legacy single-object saved copy still restores, byte for byte, with no migration first', () => {
  const dir = project();
  try {
    const { file, previousText } = legacyFixture(dir);
    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(
      readFileSync(file, 'utf8'), previousText,
      'a status line saved by an earlier build did not come back byte for byte',
    );
    assert.equal(existsSync(SAVED_COPY), false, 'the legacy entry was spent; the file goes with it');
  } finally {
    removeTree(dir);
  }
});

test('the first write migrates the legacy shape into the map, and the legacy entry survives unchanged', () => {
  const dir = project();
  try {
    const { file, previousText, legacy } = legacyFixture(dir);
    const other = settingsFixture(dir, { statusLine: OTHER_FOREIGN }, 'other.json');

    // A write for a DIFFERENT settings file: the migration must carry the
    // legacy entry across rather than replace the file with its own.
    const installed = run(['statusline', 'install', '--settings', other, '--yes'], dir);
    assert.equal(installed.code, 0, installed.out);

    assert.deepEqual(
      Object.keys(savedMap()).sort(), [path.resolve(file), path.resolve(other)].sort(),
      'the migration dropped the legacy entry, or failed to key it by its own settings path',
    );
    assert.deepEqual(
      savedEntry(file), legacy,
      'the legacy entry did not survive the migration field for field',
    );

    // And it still restores afterwards — the assertion the migration is for.
    const removed = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(removed.code, 0, removed.out);
    assert.equal(
      readFileSync(file, 'utf8'), previousText,
      'the owner\'s real previous status line did not survive the migration byte for byte',
    );
    assert.deepEqual(
      Object.keys(savedMap()), [path.resolve(other)], 'the other profile lost its entry',
    );
  } finally {
    removeTree(dir);
  }
});

/* -------------------------------------------------------------------- *
 * Degradation: an unreadable saved copy must behave exactly as before.  *
 * -------------------------------------------------------------------- */

/**
 * The behaviour being PRESERVED, read off the pre-change code rather than
 * chosen: an unparseable saved copy reads as "nothing saved", so `uninstall`
 * removes our key rather than restoring anything, says so, and leaves the
 * unreadable file alone — it is not this command's to delete, and inventing a
 * previous value is the one thing it must never do.
 */
test('an unreadable saved copy still degrades to removing the key, and is never rewritten', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const garbage = '{ not json at all';
    writeFileSync(SAVED_COPY, garbage, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.match(out, /No saved copy/i, 'the degradation must be disclosed, not silent');
    const after = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    assert.equal('statusLine' in after, false, 'our key was left behind');
    assert.equal(after.model, 'opus', 'an unrelated key was lost');
    assert.equal(
      readFileSync(SAVED_COPY, 'utf8'), garbage,
      'an unreadable saved copy was rewritten or deleted rather than left for its owner',
    );
  } finally {
    removeTree(dir);
  }
});

/**
 * The map's own version of that degradation: one entry that is not a backup
 * must cost only itself. A shape check that refused the WHOLE file over one
 * bad value would take a healthy profile's saved copy down with a corrupted
 * one — precisely the coupling the keying was introduced to remove.
 */
test('a malformed entry beside a well-formed one costs only itself', () => {
  const dir = project();
  try {
    const file = settingsFixture(dir, { statusLine: FOREIGN, model: 'opus' });
    const before = readFileSync(file, 'utf8');
    assert.equal(run(['statusline', 'install', '--settings', file, '--yes'], dir).code, 0);

    const map = savedMap() as Record<string, unknown>;
    map[path.resolve(path.join(dir, 'gone.json'))] = 42;
    writeFileSync(SAVED_COPY, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

    const { code, out } = run(['statusline', 'uninstall', '--settings', file, '--yes'], dir);
    assert.equal(code, 0, out);
    assert.equal(readFileSync(file, 'utf8'), before, 'the healthy entry stopped restoring');
  } finally {
    removeTree(dir);
  }
});
