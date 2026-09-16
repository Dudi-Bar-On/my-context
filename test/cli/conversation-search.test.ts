// @basis TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done,
// INV-nothing-is-dropped-silently
/**
 * **`mycontext conversation search` — THE SURFACE THAT ASKS FOR SAID, RAN OR
 * BOTH**, `semantic/10`.
 *
 * The item's condition on the whole change is that the third kind of span is
 * only worth having if a reader can CHOOSE it: *"A SEARCH THAT RETURNS
 * EVERYTHING IS NOT BETTER THAN ONE THAT RETURNS TOO LITTLE. Adding 3.6x the
 * text will drown a prose query in command noise unless the reader can say
 * WHICH KIND he wants."* This file holds the command to that.
 *
 * ── WHAT IS WORTH PROVING, AND WHY EACH ONE CAN FAIL ──────────────────────
 *
 *   1. **The default is what was SAID**, so the command answers today's
 *      question today's way. The fixture's tool call holds the query word and
 *      the default must not return it.
 *   2. **`--sources ran` reaches the index**, and returns the row the default
 *      would not.
 *   3. **THE DISCLOSURE LINE.** A `said` search over a word that lives only in
 *      what was RUN prints the count of what it did not look at and names the
 *      flag that would. Without it the zero reads as an answer about the
 *      archive, which is the exact substitution
 *      `INV-nothing-is-dropped-silently` forbids.
 *   4. **What is in no index at all is named on every answer**, hit or miss.
 *   5. **A value the flag does not know is REFUSED**, not defaulted — a
 *      surface that accepted `--sources tools` and quietly searched what was
 *      said would print a heading that is not true of its own rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { projectDirName } from '../../src/core/conversation-index.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'dddddddd-1111-2222-3333-666666666666';

const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
});

/** A record that ONLY called a tool — machinery, and what this feature is for. */
const ran = (name: string, input: Record<string, unknown>, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_a', name, input }] },
  timestamp: at,
  cwd: '/w',
});

/** What the command PRINTED — 67.0% of the real archive, and in no index. */
const printed = (text: string, at: string): unknown => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', content: text }] },
  timestamp: at,
  cwd: '/w',
});

interface Fixture {
  cwd: string;
  out: string[];
  run: (args: string[]) => number;
  drawn: () => string;
  clear: () => void;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-cs-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cs-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), [
    say('user', 'the harbour is quiet tonight', '2026-09-16T10:00:00.000Z'),
    ran('Bash', {
      command: 'node scripts/periscope.ts --raise',
      description: 'raise the periscope',
    }, '2026-09-16T10:00:01.000Z'),
    printed('periscope raised, 3 contacts on the horizon', '2026-09-16T10:00:02.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');

  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  runCli(['init'], cwd, () => {});
  runCli(['conversation', 'rebuild'], cwd, () => {});

  const out: string[] = [];
  return {
    cwd,
    out,
    run: (args) => runCli(args, cwd, (line: string) => out.push(line)),
    drawn: () => out.join('\n'),
    clear: () => { out.length = 0; },
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** The `--json` body of one search. */
function search(f: Fixture, args: string[]): {
  sources: string;
  hits: { kind: string }[];
  kinds: string[];
  elsewhere: { kinds: string[]; matched: number } | null;
  unindexed: string[];
} {
  f.clear();
  assert.equal(f.run(['conversation', 'search', ...args, '--json']), 0, f.drawn());
  return JSON.parse(f.drawn());
}

test('the command answers what was SAID unless it is asked for more', () => {
  const f = fixture();
  try {
    const said = search(f, ['periscope']);
    assert.equal(said.sources, 'said');
    assert.deepEqual(said.kinds, ['prompt', 'answer']);
    assert.equal(said.hits.length, 0, 'nobody said the word — a tool call did');

    const run = search(f, ['periscope', '--sources', 'ran']);
    assert.equal(run.hits.length, 1, 'and `--sources ran` reaches it');
    assert.equal(run.hits[0]?.kind, 'ran');

    const both = search(f, ['periscope', '--sources', 'both']);
    assert.equal(both.hits.length, 1);
    assert.deepEqual(both.kinds, ['prompt', 'answer', 'ran']);
    assert.equal(both.elsewhere, null, 'asking for all of it leaves nothing to disclose');
  } finally { f.dispose(); }
});

test('a said answer says how much is in what was RUN, and names the flag that would show it', () => {
  const f = fixture();
  try {
    const said = search(f, ['periscope']);
    // **THE NUMBER, NOT A SHRUG.** A zero in one half of the archive is not a
    // zero in the archive, and this is the difference.
    assert.deepEqual(said.elsewhere, { kinds: ['ran'], matched: 1 });

    f.clear();
    assert.equal(f.run(['conversation', 'search', 'periscope']), 0, f.drawn());
    const drawn = f.drawn();
    assert.match(drawn, /1 more in what was RUN/, 'the count reaches the screen');
    assert.match(drawn, /--sources ran/, 'and so does the way to see it');
  } finally { f.dispose(); }
});

test('every answer names what is in no index at all, hit or miss', () => {
  const f = fixture();
  try {
    assert.deepEqual(search(f, ['periscope']).unindexed, ['tool_result', 'thinking']);
    // And the thing itself is unreachable: the words below are ONLY in the
    // `tool_result` record of the fixture.
    assert.equal(search(f, ['3 contacts', '--sources', 'both']).hits.length, 0);

    f.clear();
    assert.equal(f.run(['conversation', 'search', 'harbour']), 0, f.drawn());
    assert.match(
      f.drawn(), /tool_result and thinking blocks are NOT indexed/,
      'a search that FOUND something still says what it could not look in',
    );
  } finally { f.dispose(); }
});

test('a sources value the flag does not know is refused, never defaulted', () => {
  const f = fixture();
  try {
    f.clear();
    assert.equal(f.run(['conversation', 'search', 'periscope', '--sources', 'tools']), 1);
    assert.match(f.drawn(), /takes said, ran, both/);
    assert.doesNotMatch(f.drawn(), /hit\(s\)/, 'and nothing was searched');
  } finally { f.dispose(); }
});
