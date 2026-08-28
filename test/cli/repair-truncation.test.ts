/**
 * **`mycontext repair` may not shrink a body.**
 *
 * Three surfaces used to disagree about the same input, and only one was safe:
 * `edit --body` REFUSED text containing a `## ` heading and explained exactly
 * what would be lost; `add` and `repair` accepted the identical shape, and
 * `repair` — which re-renders every item it touches from the parsed form —
 * PERFORMED the loss `edit` refuses to allow, reported success, and re-stamped
 * the checksum over the deletion so `doctor` went quiet.
 *
 * Measured on this repository's own corpus before the fix: two task bodies
 * went 3,918 -> 1,272 bytes and 5,507 -> 1,535 in the commit that hand-edited
 * them and then ran `repair`. Both were recovered from git; nothing in the
 * tool could have found them.
 *
 * These tests pin the answer: such an item is HELD BACK, named, and the file
 * is left exactly as it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/** Wrapped prose collapsed to one line — see `todo.test.ts` for why. */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-repair-trunc-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/**
 * A hand-edited item: sections a human wrote, a checksum that no longer
 * matches, and therefore a `repair` candidate. Written straight to disk
 * because that is the only way this shape is ever produced — no write path in
 * the tool can create it.
 */
function writeSectioned(cwd: string, id: string): string {
  const file = path.join(cwd, '.my_context', 'items', 'note', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, [
    '---',
    `id: ${id}`,
    'type: note',
    `title: ${id}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    'checksum: deadbeefdeadbeef',
    '---',
    '',
    `# ${id}`,
    '',
    'The prose that survives.',
    '',
    '## The measurement',
    '',
    'Two thirds of this item lives under a heading, which is where the loss was.',
    '',
    '## What was decided',
    '',
    'And here is the rest of it.',
    '',
  ].join('\n'), 'utf8');
  return file;
}

/** A hand-edited item with nothing under a heading — a lawful repair candidate. */
function writeFlat(cwd: string, id: string): string {
  const file = path.join(cwd, '.my_context', 'items', 'note', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, [
    '---',
    `id: ${id}`,
    'type: note',
    `title: ${id}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    'checksum: deadbeefdeadbeef',
    '---',
    '',
    `# ${id}`,
    '',
    'All of this survives a re-render.',
    '',
  ].join('\n'), 'utf8');
  return file;
}

test('repair holds back an item whose rewrite would delete text, and changes nothing on disk', () => {
  withProject((cwd) => {
    const file = writeSectioned(cwd, 'NOTE-sectioned');
    const before = readFileSync(file, 'utf8');
    const beforeMtime = statSync(file).mtimeMs;

    const { code, out } = run(['repair', '--yes'], cwd);

    assert.equal(code, 1, 'the reported mismatch was not settled, so this is not a success');
    assert.match(prose(out), /cannot be re-stamped without DELETING text/);
    assert.match(prose(out), /nothing was re-stamped/);
    assert.equal(readFileSync(file, 'utf8'), before, 'the file must be byte-identical');
    assert.equal(statSync(file).mtimeMs, beforeMtime, 'the file must not even be rewritten');
  });
});

test('the withheld report names the item, the first line it would drop, and how much', () => {
  withProject((cwd) => {
    writeSectioned(cwd, 'NOTE-sectioned');
    const { out } = run(['repair', '--yes'], cwd);
    assert.match(out, /NOTE-sectioned/);
    assert.match(out, /## The measurement/, 'the line that would be lost is named, as `edit --body` names it');
    assert.match(prose(out), /line\(s\), \d+ bytes/);
    // And the route out is a route, not a shrug.
    assert.match(prose(out), /\*\*Name\*\*/);
    assert.match(prose(out), /## Observations/);
  });
});

test('the disclosure is readable BEFORE the confirmation, not after it', () => {
  withProject((cwd) => {
    writeSectioned(cwd, 'NOTE-sectioned');
    writeFlat(cwd, 'NOTE-flat');
    const { out } = run(['repair'], cwd);
    assert.ok(
      out.indexOf('DELETING text') < out.indexOf('refusing without confirmation'),
      'a caveat printed after the decision point is not a caveat',
    );
  });
});

test('a lawful candidate beside a withheld one is still re-stamped, and the withheld one is named again', () => {
  withProject((cwd) => {
    const sectioned = writeSectioned(cwd, 'NOTE-sectioned');
    const flat = writeFlat(cwd, 'NOTE-flat');
    const sectionedBefore = readFileSync(sectioned, 'utf8');

    const { code, out } = run(['repair', '--yes'], cwd);

    assert.equal(code, 1, 'one item is still unsettled, and the exit code says so');
    assert.match(out, /re-stamped NOTE-flat/);
    assert.doesNotMatch(out, /re-stamped NOTE-sectioned/);
    assert.match(prose(out), /held back and NOT re-stamped.*NOTE-sectioned/);
    assert.equal(readFileSync(sectioned, 'utf8'), sectionedBefore);
    assert.doesNotMatch(readFileSync(flat, 'utf8'), /deadbeefdeadbeef/);
  });
});

test('the honesty block no longer claims the body is unchanged — it claims the file was checked', () => {
  // The old sentence read "The body, observations and relations are unchanged."
  // It was true of every item the tool itself wrote and false of exactly the
  // item this command was most dangerous to.
  withProject((cwd) => {
    writeFlat(cwd, 'NOTE-flat');
    const { out } = run(['repair'], cwd);
    assert.doesNotMatch(prose(out), /body, observations and relations are unchanged/i);
    assert.match(prose(out), /compared against what my_context parsed out of it BEFORE anything is written/);
  });
});

test('once the heading is written as bold, repair settles the item', () => {
  // The route the message offers, walked end to end — and the same route the
  // two recovered items in this corpus actually took.
  withProject((cwd) => {
    const file = writeSectioned(cwd, 'NOTE-sectioned');
    assert.equal(run(['repair', '--yes'], cwd).code, 1);

    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(/^## (.+)$/gm, '**$1**'),
      'utf8',
    );

    const { code, out } = run(['repair', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /re-stamped NOTE-sectioned/);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /Two thirds of this item lives under a heading/);
    assert.match(after, /And here is the rest of it\./);
    assert.equal(run(['doctor'], cwd).code, 0);
  });
});

test('a corpus with nothing to withhold reads exactly as it did before', () => {
  withProject((cwd) => {
    writeFlat(cwd, 'NOTE-flat');
    const { code, out } = run(['repair', '--yes'], cwd);
    assert.equal(code, 0);
    assert.match(out, /re-stamped 1 item\(s\)/);
    assert.doesNotMatch(out, /DELETING text/);
    assert.doesNotMatch(out, /held back and NOT re-stamped/);
  });
});
