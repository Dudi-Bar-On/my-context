/**
 * **The continuity tier: `plan:live seq:9`, and the defect it was built to end.**
 *
 * `REF-v2-handover-read-before-discussing-the-web-ui` — the document this
 * project holds to be its continuity guarantee — cost 37,831 estimated tokens
 * against a largest budget of 24,000, and was delivered on NO event:
 *
 *     session-start   delivered=NO   spilled=no   index-line=true
 *     compact         delivered=NO   spilled=no   index-line=true
 *     manual          delivered=NO   spilled=no   index-line=true
 *
 * Not spilled. Not even a candidate. It existed as one index line for its whole
 * life, and nothing anywhere said so. Every assertion below fails on the code
 * that shipped that state, which is the point of writing them here rather than
 * against the shapes the implementation happens to have.
 *
 * **The fixture is a fixture and never the real handover item.** Its content is
 * being rewritten in parallel with this work, and a test that read it would
 * pass or fail on someone else's sentence. It is a `reference` — rationale by
 * catalogue, exactly like the real one — which is also the case that proves the
 * tier does not consult `isNormative`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';
import { renderSelection } from '../../src/core/render.ts';
import { continuityFor, CONTINUITY_WINDOW_SESSION, readSeen } from '../../src/core/seen-file.ts';
import { select, tiersRun } from '../../src/core/select.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { checkContinuity } from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/** The one sentence every "was it delivered" assertion below matches on. */
const MARKER_SENTENCE = 'Read reports/V2-HANDOVER.md before changing the web UI.';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-continuity-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

/**
 * The fixture item, written as Markdown rather than built as an object, so the
 * PARSER is on the path too: `continuity: true` has to survive frontmatter to
 * mean anything, and an item that only ever exists in memory would not prove
 * that.
 */
function writeContinuityItem(cwd: string, id = 'REF-handover', body = MARKER_SENTENCE): void {
  const file = path.join(cwd, '.my_context', 'items', 'reference', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: reference
title: Handover pointer
status: active
severity: soft
always: false
continuity: true
origin: human
---

# Handover pointer

${body}
`);
}

/**
 * The same item in memory, for the pure-`select` assertions — parsed from the
 * same Markdown rather than built as an object, so `continuity: true` is proven
 * to survive the frontmatter it actually ships in.
 */
const CONTINUITY_MARKDOWN = `---
id: REF-handover
type: reference
title: Handover pointer
status: active
severity: soft
always: false
continuity: true
origin: human
---

# Handover pointer

${MARKER_SENTENCE}
`;

function continuityItem(over: Partial<Item> = {}): Item {
  return {
    ...parseItem(CONTINUITY_MARKDOWN, 'items/reference/REF-handover.md', 'project'),
    ...over,
  };
}

/* -------------------------------------------------------------------------- *
 * 1 · THE ACCEPTANCE TEST. The assertion that failed on every event.
 * -------------------------------------------------------------------------- */

test('a continuity item is DELIVERED on session-start and again after a compact', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  writeContinuityItem(cwd);
  const ws = resolveWorkspace(cwd);

  // SESSION START. Before this tier existed the item was not a candidate at
  // all: `always: false` kept it off the pinned tier, and the pinned tier plus
  // the index are the only two this event ran.
  const start = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-1' });
  assert.match(start, new RegExp(MARKER_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'the continuity item was not delivered at session start');

  // AFTER A COMPACT. The window was rebuilt, so the item must arrive again —
  // even though the seen file from the session start above already holds it.
  writeSnapshot(ws.projectRoot!, 'sess-1', []);
  const compacted = buildInjection(cwd, {
    event: 'session-start', source: 'compact', sessionId: 'sess-1',
  });
  assert.match(compacted, new RegExp(MARKER_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'the continuity item was not re-delivered after a compaction — the session started over');

  // MANUAL is a session start by another name (`inject.ts`), so it carries the
  // tier too.
  const manual = buildInjection(cwd, { event: 'manual' });
  assert.match(manual, new RegExp(MARKER_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the tier runs on the three session-shaped events and never on a tool event', () => {
  assert.ok(tiersRun({ event: 'session-start' }).includes('continuity'));
  assert.ok(tiersRun({ event: 'compact' }).includes('continuity'));
  assert.ok(tiersRun({ event: 'manual' }).includes('continuity'));
  // A tool event is narrow by construction — that is what the JIT tier is —
  // and continuity is the opposite of narrow.
  assert.ok(!tiersRun({ event: 'tool', path: 'src/a.ts' }).includes('continuity'));
});

test('a rationale-tier item carries the tier — the gate is not isNormative', () => {
  const config = resolveConfig({});
  assert.equal(config.categories.reference.tier, 'rationale',
    'the fixture is only meaningful while `reference` is rationale-tier');
  const selection = select([continuityItem()], { event: 'session-start' }, config);
  assert.deepEqual(
    selection.full.map((e) => [e.item.id, e.tier]),
    [['REF-handover', 'continuity']],
    'a reference is exactly the shape the tier exists for, and isNormative would refuse it',
  );
});

/* -------------------------------------------------------------------------- *
 * 2 · R5 — dedupe against the WINDOW, never against the id alone.
 * -------------------------------------------------------------------------- */

test('within one window the item is delivered once and not resent', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  writeContinuityItem(cwd);
  const ws = resolveWorkspace(cwd);

  const first = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-w' });
  assert.match(first, /Read reports\/V2-HANDOVER\.md/);

  // The marker recorded is the WINDOW, not the instant: an instant would never
  // match itself again and the tier would resend on every event.
  const state = readSeen(ws.projectRoot!, 'sess-w');
  assert.deepEqual([...continuityFor(state, CONTINUITY_WINDOW_SESSION)], ['REF-handover']);

  const second = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-w' });
  assert.equal(/Read reports\/V2-HANDOVER\.md/.test(second), false,
    'the item was resent inside a window that already holds it');
});

test('a repeat firing of the SAME compaction does not resend it', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  writeContinuityItem(cwd);
  const ws = resolveWorkspace(cwd);
  writeSnapshot(ws.projectRoot!, 'sess-r', []);

  const first = buildInjection(cwd, {
    event: 'session-start', source: 'compact', sessionId: 'sess-r',
  });
  assert.match(first, /Read reports\/V2-HANDOVER\.md/);
  const second = buildInjection(cwd, {
    event: 'session-start', source: 'compact', sessionId: 'sess-r',
  });
  assert.equal(/Read reports\/V2-HANDOVER\.md/.test(second), false);
});

test('a SECOND, distinct compaction resends it — the marker moves with the window', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  writeContinuityItem(cwd);
  const ws = resolveWorkspace(cwd);

  writeSnapshot(ws.projectRoot!, 'sess-2c', []);
  assert.match(
    buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-2c' }),
    /Read reports\/V2-HANDOVER\.md/,
  );
  // A new snapshot is a new `capturedAt`, which is a new window.
  writeSnapshot(ws.projectRoot!, 'sess-2c', []);
  assert.match(
    buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-2c' }),
    /Read reports\/V2-HANDOVER\.md/,
    'a distinct compaction did not resend it — this session started over with nothing',
  );
});

test('select dedupes on continuityDelivered and NOT on seen — a compact must survive it', () => {
  const config = resolveConfig({});
  const item = continuityItem();
  // `seen` holds the id, which is what a compaction inside a live session looks
  // like. Deduping on it here is the defect: the window was rebuilt.
  const afterCompact = select(
    [item], { event: 'compact', seen: ['REF-handover'], continuityDelivered: [] }, config,
  );
  assert.deepEqual(afterCompact.full.map((e) => e.item.id), ['REF-handover']);

  const insideWindow = select(
    [item], { event: 'session-start', continuityDelivered: ['REF-handover'] }, config,
  );
  assert.deepEqual(insideWindow.full, []);
});

/* -------------------------------------------------------------------------- *
 * 3 · R3 — overflow is LOUD, in three places, and never absorbed.
 * -------------------------------------------------------------------------- */

test('an over-budget continuity item spills AND says so, in the injected block itself', () => {
  const config = resolveConfig({ budgets: { continuity: 5 } });
  const selection = select([continuityItem()], { event: 'session-start' }, config);

  assert.deepEqual(selection.full, [], 'nothing fits a budget of 5');
  assert.ok(selection.continuitySpill !== null, 'the spill was absorbed instead of reported');
  assert.deepEqual(selection.continuitySpill.ids, ['REF-handover']);
  assert.equal(selection.continuitySpill.budget, 5);
  assert.ok(selection.continuitySpill.cost > 5);

  const text = renderSelection(selection);
  assert.match(text, /CONTINUITY NOT DELIVERED/);
  assert.match(text, /REF-handover/);
  assert.match(text, /budgets\.continuity/);
  assert.match(text, /guarantee is NOT in force/);
});

test('a continuity item that FITS says nothing — a warning always on screen is unread', () => {
  const config = resolveConfig({});
  const selection = select([continuityItem()], { event: 'session-start' }, config);
  assert.equal(selection.continuitySpill, null);
  assert.equal(/CONTINUITY NOT DELIVERED/.test(renderSelection(selection)), false);
});

test('doctor reports the overflow as a finding, not only the session', () => {
  const items = [continuityItem()];
  const over = checkContinuity(items, resolveConfig({ budgets: { continuity: 5 } }));
  assert.deepEqual(over.map((f) => [f.level, f.code]), [['error', 'continuity_overflow']]);
  assert.match(over[0].message, /REF-handover/);
  assert.match(over[0].message, /POINTER PLUS A BOUNDED DIGEST/);

  assert.deepEqual(checkContinuity(items, resolveConfig({})), [],
    'a tier that fits must produce no finding at all');
});

test('doctor names a continuity item that can never be delivered', () => {
  const retired = checkContinuity(
    [continuityItem({ status: 'deprecated' })], resolveConfig({}),
  );
  assert.deepEqual(retired.map((f) => [f.level, f.code]), [['warn', 'continuity_inert']]);
  assert.match(retired[0].message, /is in force for no session/);
});

/* -------------------------------------------------------------------------- *
 * 4 · The narrowings that must not silently swallow it.
 * -------------------------------------------------------------------------- */

test('focus never hides a continuity item, and discloses that it did not', () => {
  const config = resolveConfig({});
  const selection = select(
    [continuityItem()],
    {
      event: 'session-start',
      focus: {
        tags: ['nothing-matches-this'], categories: [], scope: [],
        setAt: '2026-08-28T00:00:00.000Z', setBy: 'human',
      },
    },
    config,
  );
  assert.deepEqual(selection.full.map((e) => e.item.id), ['REF-handover']);
  assert.deepEqual(selection.focus?.exemptContinuity, ['REF-handover']);
  assert.match(renderSelection(selection), /continuity item\(s\) do not match this focus/);
});

test('an item that is both always and continuity arrives once, not twice', () => {
  const config = resolveConfig({});
  const both = parseItem(`---
id: CONST-both
type: constraint
title: Both
status: active
severity: hard
always: true
continuity: true
origin: human
---

# Both

A body.
`, 'items/constraint/CONST-both.md', 'project');
  const selection = select([both], { event: 'session-start' }, config);
  assert.deepEqual(selection.full.map((e) => [e.item.id, e.tier]), [['CONST-both', 'pinned']]);
});

/* -------------------------------------------------------------------------- *
 * 5 · The field itself — parsed, rendered, and invisible when false.
 * -------------------------------------------------------------------------- */

test('continuity round-trips, and an item without it gains no line', () => {
  const withIt = continuityItem();
  assert.equal(withIt.continuity, true);

  const plain = parseItem(`---
id: CONST-plain
type: constraint
title: Plain
status: active
severity: soft
always: false
origin: human
---

# Plain

A body.
`, 'items/constraint/CONST-plain.md', 'project');
  assert.equal(plain.continuity, false, 'an item that predates the field must read false');
  assert.equal(plain.extra.continuity, undefined, 'the field must not leak into extra');

  // `INV-markdown-is-the-source-of-truth`: `files → DB → files` is
  // byte-identical, so the field is written back only when it is TRUE. An
  // unconditional `continuity: false` line would rewrite every item in every
  // corpus on the next write, and the checksum recorded in each would go with
  // it — which is the same reason `steps` is conditional in
  // `computeItemChecksum`.
  assert.match(renderItem(withIt), /^continuity: true$/m);
  assert.equal(/continuity/.test(renderItem(plain)), false);
  assert.equal(renderItem(plain), `---
id: CONST-plain
type: constraint
title: Plain
status: active
severity: soft
always: false
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: null
valid_until: null
checksum: ""
---

# Plain

A body.
`);
});
