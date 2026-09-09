// @basis TASK-the-session-field-names-a-session-and-says-nothing-about-its, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **THE SESSION FIELD SAYS HOW BIG THIS SESSION IS AND HOW MANY LANES RAN
 * UNDER IT** — owner request, 2026-09-09: *"nwo staus line shows SESSION
 * MyContext V2.0, we could add here the session size and the amount of
 * subagents files"*, on both surfaces.
 *
 * ── WHAT IS WORTH PROVING HERE ──────────────────────────────────────────────
 *
 *  1. **The count reads a DIRECTORY and opens nothing.** `countSubagentFiles`
 *     exists because the two obvious alternatives are both a hundred times
 *     more expensive than they look — the conversation index (6.738 ms, and
 *     off by default in most workspaces) and `listSubagentFiles`
 *     (109.079 ms measured over 262 lanes, because it stats every file and
 *     parses every sidecar). A test cannot assert a timing without becoming a
 *     flake on a contended machine, so what is asserted is the OBSERVABLE
 *     consequence of the cheap route: `.meta.json` sidecars are excluded by
 *     the extension test alone even though they share a stem with the
 *     transcripts, and a directory with no index in sight still answers.
 *
 *  2. **A missing directory is ZERO, and zero is DRAWN.** A session that
 *     dispatched no lanes has no `subagents/` directory at all — measured
 *     here, 2 of the 4 sessions in this project's own directory have none — so
 *     the absent case is the ORDINARY case and a bar that omitted it would be
 *     silent about the common state.
 *
 *  3. **A failed `stat` is `unmeasurable` and is NOT zero.** These are
 *     different facts with different causes — a pruned transcript against a
 *     session that has recorded nothing — and the item names this as the state
 *     a careless implementation collapses. It is asserted on the rendering,
 *     because the collapse would be invisible in the data.
 *
 *  4. **ONE SPELLING OF A SIZE.** The Conversations screen has drawn this
 *     product's transcripts through `formatBytes` since the archive shipped;
 *     the terminal now draws the same file through the same function, over the
 *     `viewmodel.js` bridge, so the two cannot disagree about one file. The
 *     assertion is an EQUALITY against that function rather than a hardcoded
 *     `49.6 MB`, because a literal would go stale the day the divisor is
 *     argued about again and would pass while the two surfaces diverged.
 *
 *  5. **The ranking, which is the answer to "what drops first".** Size before
 *     lanes, and both before the session name — argued in `GIVE` and asserted
 *     here as a relation between ranks rather than at a named width, so the
 *     claim survives every future change to how wide a block renders.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude`: `CLAUDE_CONFIG_DIR` is the variable the product honours, so
 * redirecting it is the code path a real run takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  countSubagentFiles, subagentDir, transcriptDir,
} from '../../src/core/conversation-index.ts';
import { sessionScaleOf } from '../../src/cli/commands/statusline.ts';
import {
  GIVE, NO_EXTRAS, buildLines, bytes, type PowerlineInput, type SessionScale,
} from '../../src/cli/commands/statusline-powerline.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/**
 * A transcript directory laid out the way Claude Code lays one out: the
 * session's own `.jsonl` at the top level, and its lanes one directory down
 * with a `.meta.json` sidecar beside each — which is the pair a count keyed on
 * a prefix rather than on the extension would find twice.
 */
function fixture(lanes: number, transcriptBytes: number | null): {
  env: Record<string, string | undefined>; cwd: string; dir: string; file: string;
  clean: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-scale-'));
  const env = { CLAUDE_CONFIG_DIR: home };
  const cwd = path.join(home, 'w', 'repo');
  const dir = transcriptDir(env, cwd);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${SESSION}.jsonl`);
  // `null` means the transcript is NOT written, which is the `unmeasurable`
  // case: the directory exists and the file does not.
  if (transcriptBytes !== null) writeFileSync(file, 'x'.repeat(transcriptBytes));
  if (lanes > 0) {
    const agents = subagentDir(env, cwd, SESSION);
    mkdirSync(agents, { recursive: true });
    for (let i = 0; i < lanes; i += 1) {
      const id = `agent-${String(i).padStart(4, '0')}`;
      writeFileSync(path.join(agents, `${id}.jsonl`), '{}\n');
      writeFileSync(path.join(agents, `${id}.meta.json`), '{"agentType":"claude"}');
    }
  }
  return { env, cwd, dir, file, clean: () => removeTree(home) };
}

/** One bar built over a session scale and nothing else worth drawing. */
function identityOf(scale: SessionScale | null): { label: string; text: string }[] {
  const input: PowerlineInput = {
    ...NO_EXTRAS,
    model: null, project: 'repo', branch: null,
    occupancy: { state: 'unmeasurable', why: 'no-sample' },
    threshold: null, myctx: null, focus: null, lastAudit: null,
    myctxNote: null, teeNote: null, corpus: null,
    sessionScale: scale,
  };
  return buildLines(input, Date.now()).identity
    .map((s) => ({ label: s.label ?? '', text: s.text }));
}

test('the lane count reads the directory and counts transcripts, never their sidecars', () => {
  const f = fixture(7, 1024);
  try {
    // Fourteen files on disk, seven lanes. `agent-0000.jsonl` and
    // `agent-0000.meta.json` share a stem, so a count keyed on the `agent-`
    // prefix would report fourteen and tell the owner he had dispatched twice
    // as many lanes as he had.
    assert.equal(countSubagentFiles(subagentDir(f.env, f.cwd, SESSION)), 7);
  } finally {
    f.clean();
  }
});

test('a session that dispatched no lanes is a measured ZERO, not an error', () => {
  const f = fixture(0, 1024);
  try {
    const dir = subagentDir(f.env, f.cwd, SESSION);
    // The directory is not there at all, which is the ordinary state for a
    // session that never dispatched. It must not throw and must not be an
    // absence — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
    assert.equal(countSubagentFiles(dir), 0);
    const scale = sessionScaleOf(f.env, f.cwd, SESSION, null);
    assert.equal(scale.lanes, 0);
    // AND IT IS DRAWN. A bar that omitted zero would be silent in the common
    // case, and a blank is indistinguishable from a field that failed.
    const drawn = identityOf(scale);
    assert.deepEqual(
      drawn.filter((s) => s.label === 'LANES'), [{ label: 'LANES', text: '0' }],
      'a zero lane count must be drawn and named, never omitted',
    );
  } finally {
    f.clean();
  }
});

test('the transcript size comes from the payload path when there is one, and the derivation when there is not', () => {
  const f = fixture(3, 4096);
  try {
    // The payload's own `transcript_path` — the exact file, with no cwd
    // re-encoded into a directory name.
    const fromPayload = sessionScaleOf(f.env, f.cwd, SESSION, f.file);
    assert.equal(fromPayload.transcriptBytes, 4096);
    assert.equal(fromPayload.lanes, 3);
    // And the fallback, which must find the same file and the same lanes.
    const derived = sessionScaleOf(f.env, f.cwd, SESSION, null);
    assert.deepEqual(derived, fromPayload,
      'the derived path and the payload path must reach one transcript and one lanes directory');
  } finally {
    f.clean();
  }
});

test('a transcript that cannot be read is unmeasurable, and unmeasurable is not zero', () => {
  const f = fixture(2, null);
  try {
    const scale = sessionScaleOf(f.env, f.cwd, SESSION, null);
    assert.equal(scale.transcriptBytes, null,
      'a stat that failed must be null — a 0 here would claim the transcript is empty');
    // The lanes are still counted: two independent reads, and one refusing is
    // not a reason to lose the other.
    assert.equal(scale.lanes, 2);
    const drawn = identityOf(scale);
    assert.deepEqual(
      drawn.filter((s) => s.label === 'SIZE'),
      [{ label: 'SIZE', text: 'unmeasurable' }],
      'the unreadable state is named on the bar, and never rendered as a size',
    );
  } finally {
    f.clean();
  }
});

test('neither field is drawn when no session was named — that is not a zero', () => {
  // `null` is "nobody asked": a payload with no `session_id` has no file to
  // stat and no directory to read. It is not `0 B` and not `0 lanes`, and the
  // difference is the whole of clause 3 above.
  const labels = identityOf(null).map((s) => s.label);
  assert.ok(!labels.includes('SIZE'), 'an unasked question must not draw a size');
  assert.ok(!labels.includes('LANES'), 'an unasked question must not draw a lane count');
});

test('the terminal spells a size with the web strip’s own function, not one of its own', () => {
  const drawn = identityOf({ transcriptBytes: 52_061_736, lanes: 262 });
  const size = drawn.find((s) => s.label === 'SIZE');
  // An EQUALITY against `formatBytes` over the bridge, never a literal
  // `49.6 MB`: a literal would keep passing on the day one surface changed its
  // divisor, which is exactly the divergence this shares a function to prevent.
  assert.equal(size?.text, bytes(52_061_736));
  // And the count carries no unit, because the label already is one. `LANES
  // 262 lanes` would say it twice on the tightest surface in the product.
  assert.deepEqual(
    drawn.filter((s) => s.label === 'LANES'), [{ label: 'LANES', text: '262' }],
  );
});

test('both new fields sit after the session name, in the order the reader reads', () => {
  const input: PowerlineInput = {
    ...NO_EXTRAS,
    model: null, project: 'repo', branch: null,
    sessionName: 'MyContext V2.0',
    occupancy: { state: 'unmeasurable', why: 'no-sample' },
    threshold: null, myctx: null, focus: 'plan:archive seq:44', lastAudit: null,
    myctxNote: null, teeNote: null, corpus: null,
    sessionScale: { transcriptBytes: 52_061_736, lanes: 262 },
  };
  const fields = buildLines(input, Date.now()).identity.map((s) => s.field);
  // The row reads outward in ONE direction: which repository, which window,
  // how big it has become, how many lanes it has run, and finally what it is
  // for. Compared as a subsequence of field ids rather than as the whole row,
  // so a field added elsewhere on line 1 does not fail this.
  assert.deepEqual(
    fields.filter((f) => f !== undefined
      && ['project', 'session-name', 'session-size', 'session-lanes', 'focus'].includes(f)),
    ['project', 'session-name', 'session-size', 'session-lanes', 'focus'],
  );
});

test('the size is the first of the pair given up, and both go before the window can be named', () => {
  // The ANSWER TO "what drops first", asserted as a relation between ranks
  // rather than at a named width — a width assertion would move every time a
  // block's spelling changed and would prove nothing about the ordering.
  //
  // Lower goes first. The lane count outranks the size because it is the fact
  // with no other cheap source: `mycontext conversation subagents` can answer
  // it only where the archive was built, and `plan:archive seq:9` established
  // that the archive is off by default and that no read surface may build one.
  // A transcript's size is one `ls -l` away in any shell and is monotonic.
  assert.ok(GIVE.sessionSize < GIVE.sessionLanes,
    'the size is the more recoverable half and is what a narrow terminal gives up first');
  // And both go before the name, the focus and everything that says where you
  // are: a window you cannot NAME is worse than one whose size you do not know.
  for (const [name, rank] of [
    ['sessionName', GIVE.sessionName], ['focus', GIVE.focus],
    ['project', GIVE.project], ['branch', GIVE.branch], ['cwd', GIVE.cwd],
    ['corpusRoot', GIVE.corpusRoot],
  ] as const) {
    assert.ok(GIVE.sessionLanes < rank,
      `${name} must outlive both 2026-09-09 fields — it is identity and they are scale`);
  }
});
