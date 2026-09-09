// @basis TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never, INV-nothing-is-dropped-silently
/**
 * **`mycontext conversation secrets` and `persist --replace`** — the two
 * command lines `plan:archive seq:46` produces, and the surface a checkbox
 * form will consume.
 *
 * The mechanics are proved in `test/core/conversation-redaction.test.ts`
 * against the functions themselves. What is proved HERE is the part a person —
 * or a screen — meets:
 *
 *   1. **The report writes nothing.** `secrets` is a read, has no `--yes`, and
 *      leaves no file behind. Detection proposes; it never acts.
 *   2. **`--json` carries everything a form needs and nothing it must not
 *      have.** Every candidate has the handle a checkbox ticks, the label it
 *      shows, the evidence a person judges by, and the stand-in it would
 *      become — and no candidate carries its value.
 *   3. **Nothing is ticked by default**, in the payload and on disk. A bare
 *      `persist` produces the byte-faithful copy `seq:4` always produced.
 *   4. **`--replace` replaces exactly what it names**, in a second file, while
 *      the copy this product keeps stays byte-for-byte the transcript.
 *   5. **A choice can be taken back**, which is what `--replace=` is for.
 *
 * The harness home and the mirror root are temp directories set on the process
 * for the duration of each test, because the CLI reads `process.env` the way a
 * real run does. `test/helpers/real-home-guard.ts` would abort the run if
 * anything reached the developer's own home.
 *
 * **Every credential here is synthetic.** Nothing is read out of the live
 * corpus or out of a real transcript: the values below sit inside shapes the
 * detector recognises and say `NOT-REAL` in their own bodies, so this file can
 * be committed without publishing anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { MIRROR_DIR_ENV, mirrorPath } from '../../src/core/conversation-mirror.ts';
import { redactedCopyPath, redactionPlanPath } from '../../src/core/conversation-redaction.ts';
import { candidateId } from '../../src/core/conversation-secrets.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'cccccccc-1111-2222-3333-666666666666';

/** Synthetic, and shaped so the detector proposes them. Neither is a real key. */
const FAKE_KEY = 'sk-ant-api03-NOT-REAL-1111111111111111111111';
const FAKE_TOKEN = 'ghp_NOTREALNOTREALNOTREALNOTREAL1111';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

interface Fixture {
  cwd: string;
  out: string[];
  run: (args: string[]) => number;
  text: () => string;
  json: () => Record<string, unknown>;
  transcript: string;
  copy: string;
  dispose: () => void;
}

function fixture(records?: unknown[]): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-secrets-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-secrets-cwd-'));
  const kept = mkdtempSync(path.join(tmpdir(), 'myctx-secrets-kept-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const transcript = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(transcript, jsonl(records ?? [
    say('user', `use ${FAKE_KEY} to call it`, '2026-09-09T10:00:00.000Z'),
    say('assistant', `and ${FAKE_TOKEN} for the repo`, '2026-09-09T10:00:01.000Z'),
    say('user', `still ${FAKE_KEY}`, '2026-09-09T10:00:02.000Z'),
  ]));

  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: home, [MIRROR_DIR_ENV]: kept };
  rebuildConversations(ws.dbPath, env, cwd, {});

  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  const priorMirror = process.env[MIRROR_DIR_ENV];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  process.env[MIRROR_DIR_ENV] = kept;

  const out: string[] = [];
  return {
    cwd,
    out,
    run: (args) => runCli(args, cwd, (line: string) => out.push(line)),
    text: () => out.join('\n'),
    json: () => JSON.parse(out.join('\n')) as Record<string, unknown>,
    transcript,
    copy: mirrorPath(env, cwd, SESSION),
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      if (priorMirror === undefined) delete process.env[MIRROR_DIR_ENV];
      else process.env[MIRROR_DIR_ENV] = priorMirror;
      removeTree(home);
      removeTree(cwd);
      removeTree(kept);
    },
  };
}

/* -------------------------------------------------------------------- *
 * The report.                                                           *
 * -------------------------------------------------------------------- */

test('the report lists what looks private and replaces nothing', () => {
  const f = fixture();
  try {
    const before = readFileSync(f.transcript);
    assert.equal(f.run(['conversation', 'secrets']), 0, f.text());
    assert.match(f.text(), /credential shape\(s\)/);
    assert.match(f.text(), /NOTHING has been replaced/);
    assert.equal(readFileSync(f.transcript).equals(before), true, 'the report wrote to the file');
    assert.equal(existsSync(f.copy), false, 'a report must not create a copy');
    assert.equal(existsSync(redactedCopyPath(f.copy)), false);
  } finally { f.dispose(); }
});

test('the report masks every value it found, in the terminal and in --json', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'secrets']), 0, f.text());
    assert.equal(f.text().includes(FAKE_KEY), false, 'the report printed a value whole');
    assert.equal(f.text().includes(FAKE_TOKEN), false);

    const g = fixture();
    try {
      assert.equal(g.run(['conversation', 'secrets', '--json']), 0, g.text());
      assert.equal(g.text().includes(FAKE_KEY), false, '--json carried a value whole');
      assert.equal(g.text().includes(FAKE_TOKEN), false);
    } finally { g.dispose(); }
  } finally { f.dispose(); }
});

/**
 * **The whole of what a checkbox form consumes**, asserted field by field
 * because the form is the remaining step of `seq:46` and will be built against
 * this shape rather than against the code.
 */
test('--json carries the handle, the label, the evidence and the stand-in', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'secrets', '--json']), 0, f.text());
    const payload = f.json();
    assert.equal(payload['indexed'], true);
    assert.equal(payload['sessionId'], SESSION);
    assert.equal(payload['chosen'], null, 'nothing has been chosen yet');
    assert.match(String(payload['replaceCommand']), /persist .* --replace/);

    const shapes = payload['shapes'] as { id: string; added: boolean }[];
    assert.equal(shapes.filter((s) => !s.added).length, 13, 'the 2026-09-08 thirteen');
    assert.ok(shapes.some((s) => s.added), 'and what this build added past them');

    const candidates = payload['candidates'] as Record<string, unknown>[];
    assert.equal(candidates.length, 2, 'one candidate per distinct value');
    const key = candidates.find((c) => c['shape'] === 'anthropic-key');
    assert.ok(key, 'the Anthropic-shaped value was not proposed');
    assert.equal(key['id'], candidateId('anthropic-key', FAKE_KEY));
    assert.equal(key['accepted'], false, 'NOTHING is ticked by default');
    assert.equal(key['occurrences'], 2);
    assert.deepEqual(key['records'], [0, 2]);
    assert.equal(typeof key['shapeTitle'], 'string');
    assert.equal(typeof key['preview'], 'string');
    assert.equal(typeof key['placeholder'], 'string');
    assert.ok((key['contexts'] as string[]).length > 0, 'a candidate a form cannot label');
    assert.ok((key['paths'] as string[]).length > 0, 'and one it cannot locate');
  } finally { f.dispose(); }
});

test('a session with nothing credential-shaped says so as a measured zero', () => {
  const f = fixture([say('user', 'nothing interesting here', '2026-09-09T10:00:00.000Z')]);
  try {
    assert.equal(f.run(['conversation', 'secrets']), 0, f.text());
    assert.match(f.text(), /a measured zero/);
    assert.match(f.text(), /NOT a promise/, 'a clean list must not read as a clean session');
  } finally { f.dispose(); }
});

test('a workspace nobody has scanned says which command would change that', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-secrets-bare-'));
  try {
    runCli(['init'], cwd, () => {});
    const out: string[] = [];
    assert.equal(runCli(['conversation', 'secrets'], cwd, (l) => out.push(l)), 0, out.join('\n'));
    assert.match(out.join('\n'), /nothing is indexed in this workspace yet/);
    assert.match(out.join('\n'), /conversation rebuild/);
  } finally { removeTree(cwd); }
});

/* -------------------------------------------------------------------- *
 * The choice.                                                           *
 * -------------------------------------------------------------------- */

test('a bare persist replaces nothing and the copy is the transcript', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'persist', SESSION, '--yes']), 0, f.text());
    assert.equal(readFileSync(f.copy).equals(readFileSync(f.transcript)), true,
      'an export nobody read has to be byte-faithful');
    assert.equal(existsSync(redactedCopyPath(f.copy)), false,
      'a redacted copy appeared without anybody asking for one');
    assert.equal(existsSync(redactionPlanPath(f.copy)), false);
  } finally { f.dispose(); }
});

test('--replace fakes exactly what it names, in a second file, and leaves the record', () => {
  const f = fixture();
  try {
    const id = candidateId('anthropic-key', FAKE_KEY);
    assert.equal(f.run(['conversation', 'persist', SESSION, '--replace', id, '--yes']), 0, f.text());

    assert.equal(readFileSync(f.copy).equals(readFileSync(f.transcript)), true,
      'the copy this product KEEPS must stay byte-for-byte the transcript');

    const redacted = readFileSync(redactedCopyPath(f.copy), 'utf8');
    assert.equal(redacted.includes(FAKE_KEY), false, 'the accepted value survived');
    assert.equal(redacted.includes(FAKE_TOKEN), true, 'an unaccepted value was replaced anyway');
    assert.match(redacted, /FAKE-anthropic-key-[0-9a-f]{12}-NOT-A-REAL-VALUE/);
    for (const line of redacted.split('\n').filter(Boolean)) JSON.parse(line);
    assert.match(f.text(), /2 occurrence\(s\) of 1 candidate\(s\)/);

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'secrets', '--json']), 0, f.text());
    const candidates = f.json()['candidates'] as Record<string, unknown>[];
    assert.equal(candidates.find((c) => c['id'] === id)?.['accepted'], true,
      'a form has to be able to redraw the boxes that are already ticked');
  } finally { f.dispose(); }
});

test('--replace= takes the choice back and removes only the derived copy', () => {
  const f = fixture();
  try {
    const id = candidateId('anthropic-key', FAKE_KEY);
    assert.equal(f.run(['conversation', 'persist', SESSION, '--replace', id, '--yes']), 0, f.text());
    assert.equal(existsSync(redactedCopyPath(f.copy)), true);

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'persist', SESSION, '--replace=', '--yes']), 0, f.text());
    assert.equal(existsSync(redactedCopyPath(f.copy)), false);
    assert.equal(existsSync(redactionPlanPath(f.copy)), false);
    assert.equal(readFileSync(f.copy).equals(readFileSync(f.transcript)), true,
      'taking a choice back must not touch the record');
  } finally { f.dispose(); }
});

test('an id that names nothing in this session is reported and kept', () => {
  const f = fixture();
  try {
    assert.equal(
      f.run(['conversation', 'persist', SESSION, '--replace', 'deadbeef0000', '--yes']),
      0, f.text(),
    );
    assert.match(f.text(), /match nothing in this session/);
    assert.match(f.text(), /kept in the choice anyway/);
  } finally { f.dispose(); }
});

test('`--off` and `--replace` together are refused rather than half-applied', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'persist', SESSION, '--off', '--replace', 'abc']), 1);
    assert.match(f.text(), /opposite acts/);
  } finally { f.dispose(); }
});

test('`--replace` with no session says which session it needs', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'persist', '--replace', 'abc']), 1, f.text());
    assert.match(f.text(), /needs the session/);
  } finally { f.dispose(); }
});

/**
 * The requirement `seq:46` calls the hardest part of the item, reached through
 * the command a person actually types: *"a choice made once must apply to
 * everything appended AFTERWARDS, or the first tail after an export
 * reintroduces the secret."*
 */
test('a rebuild after the choice keeps the redacted copy up with the mirror', () => {
  const f = fixture();
  try {
    const id = candidateId('anthropic-key', FAKE_KEY);
    assert.equal(f.run(['conversation', 'persist', SESSION, '--replace', id, '--yes']), 0, f.text());

    writeFileSync(
      f.transcript,
      readFileSync(f.transcript, 'utf8')
        + jsonl([say('assistant', `the same ${FAKE_KEY} again`, '2026-09-09T10:01:00.000Z')]),
    );
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.text());
    assert.match(f.text(), /redacted copy\/copies took \d+ new byte\(s\)/);

    const redacted = readFileSync(redactedCopyPath(f.copy), 'utf8');
    assert.equal(redacted.includes(FAKE_KEY), false,
      'the first tail after the choice reintroduced the value');
    assert.equal(redacted.split(`FAKE-anthropic-key-${id}-NOT-A-REAL-VALUE`).length - 1, 3,
      'the value appended later must carry the SAME stand-in as the ones before it');
    assert.equal(readFileSync(f.copy).equals(readFileSync(f.transcript)), true,
      'the mirror stopped being byte-faithful once a redaction existed beside it');
  } finally { f.dispose(); }
});
