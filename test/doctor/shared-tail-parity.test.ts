// @basis TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the, CONST-node-24-no-build-step
/**
 * **THE TWO SURFACES CUT A DOCTOR MESSAGE IN THE SAME PLACE, or this fails.**
 *
 * `TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the`, as
 * re-cut by the owner on 2026-09-07 (plan:walk seq:140, option A): *"lift
 * `sharedTail` into a module that BOTH `src/ui/public/screens/doctor.js` and
 * `src/cli/commands/doctor.ts` read … THE CUT IS ALREADY PROVEN — what is
 * missing is the second reader."*
 *
 * ── WHY THERE ARE TWO COPIES AND NOT ONE MODULE ───────────────────────────
 *
 * `src/ui/public/screens/doctor.js` is untyped JavaScript served RAW to the
 * browser from disk (`src/ui/server.ts` · `PUBLIC_DIR`), and `tsconfig.json`
 * sets no `allowJs` — its `include` is `src/**\/*.ts` and three sibling `.ts`
 * globs. So a `.ts` caller cannot statically import it, and the browser cannot
 * be handed a `.ts` file either: `CONST-node-24-no-build-step` says there is no
 * compile step and no `dist/`. One module read by both is the shape the item
 * asked for and the shape this repository cannot build.
 *
 * This project has recorded exactly two answers to that, and
 * `src/cli/commands/format.ts` names both in its own
 * *"WHY THIS IS A SECOND COPY OF THE SPELLING"* header: a dynamic-import bridge
 * behind a runtime arrival check (`statusline-powerline.ts`' occupancy bands),
 * and a copy proven equal by a sweep (`formatDuration`, pinned by
 * `test/ui/duration-parity.test.ts`; `zonedStamp`, pinned by
 * `test/ui/zoned-stamp-parity.test.ts`).
 *
 * **The bridge is async and `cmdDoctor` is sync** — `run: cmdDoctor` is
 * registered as `(ws, args, out) => number` and every emit below it returns a
 * number, not a promise. That is the same reason `formatDuration` and
 * `zonedStamp` were copied rather than bridged, so this takes the same deal and
 * this file is the pin.
 *
 * **So this file stands in for the import.** Every message set that matters —
 * this repository's OWN corpus first, then the guards, then a deterministic
 * spread — must cut identically in both files, or the suite is red. Two copies
 * proven equal, rather than two hoped equal.
 *
 * It goes through the PUBLIC `sharedTail` on both sides and reaches past
 * neither: the observable answer is what the screen and the terminal each act
 * on, and a test that reached into a private helper would keep passing while a
 * wrapper diverged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHARED_MIN, sharedTail } from '../../src/doctor/shared-tail.ts';
import { runChecks } from '../../src/doctor/checks.ts';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveConfig } from '../../src/core/config.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const MY_CONTEXT_ROOT = path.join(REPO, '.my_context');

/** `from '/lib/viewmodel.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

interface ScreenModule { sharedTail: (messages: string[]) => string }

/**
 * `screens/doctor.js` loaded the way `test/ui/doctor-screen.test.ts` loads it,
 * and for the reason its header gives: the screen imports by the specifiers the
 * BROWSER resolves, and Node resolves a leading `/` from the drive root. The
 * rewrite is counted and the result re-checked, so a specifier this pattern
 * cannot see fails here rather than importing a different module graph.
 */
async function screen(): Promise<ScreenModule> {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'doctor.js'), 'utf8');
  let rewritten = 0;
  const text = source.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.ok(rewritten > 0,
    'no root-absolute specifier was rewritten — the screen changed shape and this loader is '
    + 'importing something other than what the browser runs');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module imported below would not be '
    + 'the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as ScreenModule;
}

/**
 * **This repository's own corpus, grouped by code exactly as both surfaces
 * group it** — the screen by card and code (`sharedNotes`), the terminal by its
 * `grouped` map. Read-only: `loadLayer` parses the item files and nothing
 * opens, rebuilds or writes the index.
 *
 * Dogfooding is the point. A parity sweep over hand-typed strings would prove
 * the two functions agree about strings nobody prints; these are the sixty-odd
 * paragraphs the owner actually reads.
 */
function corpusGroups(): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  if (!existsSync(MY_CONTEXT_ROOT)) return groups;
  const items = loadLayer(MY_CONTEXT_ROOT, 'project', []);
  const findings = runChecks({
    root: MY_CONTEXT_ROOT,
    repoRoot: REPO,
    dbPath: path.join(MY_CONTEXT_ROOT, 'index.db'),
    items,
    config: resolveConfig({}),
  });
  for (const finding of findings) {
    const bucket = groups.get(finding.code) ?? [];
    bucket.push(finding.message);
    groups.set(finding.code, bucket);
  }
  return groups;
}

/**
 * Every guard the screen's own tests name, plus the shapes that straddle each
 * one. Hand-written on purpose: these are the cases a real corpus does NOT
 * currently produce, and they are exactly where two copies drift unnoticed.
 */
function guards(): string[][] {
  const long = 'This is the shared explanation that every finding of this code repeats, and it '
    + 'is comfortably longer than the minimum a disclosure has to earn.';
  const short = 'Fix it.';
  return [
    [],
    ['only one finding, so nothing repeats. ' + long],
    ['a is dead. ' + long, 'b is dead. ' + long],
    ['a is dead. ' + long, 'a is dead. ' + long],
    ['a is dead. ' + short, 'b is dead. ' + short],
    ['. ' + 'x'.repeat(80), '. ' + 'x'.repeat(80)],
    ['no sentence break at all ' + long.replace(/\./g, ''), 'nor here ' + long.replace(/\./g, '')],
    ['a. ' + long, 'b. ' + long, 'c. ' + long],
    ['a. ' + long, 'b. ' + long, 'nothing in common here'],
    // Exactly at, one under and one over the minimum a tail must reach.
    ['a. ' + 'y'.repeat(SHARED_MIN - 1), 'b. ' + 'y'.repeat(SHARED_MIN - 1)],
    ['a. ' + 'y'.repeat(SHARED_MIN), 'b. ' + 'y'.repeat(SHARED_MIN)],
    ['a. ' + 'y'.repeat(SHARED_MIN + 1), 'b. ' + 'y'.repeat(SHARED_MIN + 1)],
    // The three sentence terminators, and a break made of a newline.
    ['a? ' + long, 'b? ' + long],
    ['a! ' + long, 'b! ' + long],
    ['a.\n' + long, 'b.\n' + long],
    // A message whose own half is punctuation and spaces only — the WORDS guard.
    ['-- ' + long, '== ' + long],
    // Unicode: the guard is \p{L}\p{N}, not /[a-z0-9]/.
    ['פריט מת. ' + long, 'פריט אחר. ' + long],
    ['', ''],
    ['', 'a. ' + long],
  ];
}

/**
 * A deterministic spread — same sequence on every machine, every run.
 * `Math.random` is not used, for `duration-parity.test.ts`' reason: a parity
 * test that fails on one run in fifty teaches people to re-run it.
 */
function spread(): string[][] {
  const heads = ['alpha', 'beta is longer', '', 'x', 'a. b. c', 'ריק', '  ', 'one.two.three'];
  const tails = [
    'The shared remainder, long enough to matter and repeated on every row of this code.',
    'Short.',
    'A tail with exactly one sentence in it that runs past the sixty character minimum.',
    'Two sentences here. And the second one is what makes the boundary search interesting.',
  ];
  const breaks = ['. ', '? ', '! ', '.  ', '.\n', ''];
  const out: string[][] = [];
  let seed = 20260907;
  for (let i = 0; i < 500; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const size = 1 + (seed % 4);
    const brk = breaks[(seed >> 3) % breaks.length]!;
    const tail = tails[(seed >> 7) % tails.length]!;
    const set: string[] = [];
    for (let k = 0; k < size; k += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      set.push(heads[(seed >> 5) % heads.length]! + brk + tail);
    }
    out.push(set);
  }
  return out;
}

test('the screen and the terminal cut this repository\'s own findings in the same place',
  async () => {
    const other = await screen();
    assert.equal(typeof other.sharedTail, 'function',
      'screens/doctor.js must export sharedTail — without it this whole file is vacuous');
    const groups = corpusGroups();
    assert.ok(groups.size > 0,
      'no findings on this repository\'s own corpus — the sweep below would assert nothing. '
      + 'A corpus this clean is a reason to re-point this test, not to let it pass empty.');
    for (const [code, messages] of groups) {
      assert.equal(sharedTail(messages), other.sharedTail(messages),
        `${code} (${messages.length} finding(s)) — the terminal and the screen disagree about `
        + 'where this code\'s repeated paragraph begins, so one of them is printing the other\'s '
        + 'half');
    }
  });

/**
 * The sweep above is only worth anything if the corpus actually HAS a repeat to
 * find. This is the measurement the item asks for, asserted rather than
 * reported: at least one code group on this repository must yield a real tail.
 */
test('this repository\'s corpus really does repeat a paragraph, so the sweep is not vacuous', () => {
  const groups = corpusGroups();
  const found = [...groups.entries()].filter(([, messages]) => sharedTail(messages) !== '');
  assert.ok(found.length > 0,
    'not one code group on this corpus shares a tail. Either every doctor message stopped '
    + 'repeating itself — in which case this item is done a different way and this file must be '
    + 're-pointed — or the suffix search broke.');
  const longest = Math.max(...found.map(([, messages]) => sharedTail(messages).length));
  assert.ok(longest > 200,
    `the longest shared paragraph on this corpus is ${longest} characters. The defect this item `
    + 'was filed for was 945 identical characters per finding; a two-line answer means the cut '
    + 'is finding a fragment rather than the explanation.');
});

test('the two spellings agree on every guard, which is where copies drift unseen', async () => {
  const other = await screen();
  for (const messages of guards()) {
    assert.equal(sharedTail(messages), other.sharedTail(messages),
      `guard ${JSON.stringify(messages.map((m) => m.slice(0, 24)))} — the screen and the `
      + 'terminal refuse (or accept) this shape differently');
  }
});

test('the two spellings agree across a deterministic spread of message sets', async () => {
  const other = await screen();
  for (const messages of spread()) {
    assert.equal(sharedTail(messages), other.sharedTail(messages),
      `spread ${JSON.stringify(messages.map((m) => m.slice(0, 18)))}`);
  }
});

/**
 * The one number the two files each hold as a literal. Everything above
 * compares OUTPUTS, which would still agree if both sides were changed to 600
 * together — but a change to one alone is what this file exists to catch, and
 * the boundary cases in `guards()` only straddle the value they are generated
 * from. So the terminal's constant is pinned against the screen's SOURCE.
 */
test('SHARED_MIN is the same number in both files', () => {
  assert.equal(SHARED_MIN, 60);
  const source = readFileSync(path.join(PUBLIC, 'screens', 'doctor.js'), 'utf8');
  const declared = /const SHARED_MIN = (\d+);/.exec(source);
  assert.ok(declared !== null,
    'screens/doctor.js no longer declares SHARED_MIN as a literal — the pin below cannot read it');
  assert.equal(Number(declared[1]), SHARED_MIN,
    'the screen and the terminal earn a disclosure at different lengths');
});
