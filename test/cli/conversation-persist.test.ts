// @basis INV-nothing-is-dropped-silently, STD-error-message-conventions
/**
 * **`mycontext conversation persist` — the gate, the disclosure and the OFF
 * position**, `plan:archive seq:4`.
 *
 * The mechanics are proved in `test/core/conversation-mirror.test.ts` against
 * the functions themselves. What is proved HERE is the part a person meets:
 *
 *   1. **It refuses without confirmation.** The command writes a file outside
 *      the project, which is an act that asks. `node --test` gives the process
 *      no TTY, so a bare run is the non-interactive refusal — and the
 *      assertion is that NO FILE WAS WRITTEN, not merely that a sentence was
 *      printed. A gate that prints and then writes is the failure this checks.
 *   2. **The preview says what a copy of a session holds, FIRST.** This
 *      follows the precedent `plan:archive seq:11`'s lane set with
 *      `conv.sensitive` on the archive's own help. The security work on the
 *      archive is not this command's; putting the fact in front of the person
 *      at the moment they decide is.
 *   3. **`--off` leaves the file**, and says where it is. Deleting could
 *      destroy the only remaining record of a conversation.
 *   4. **Nothing is listed as kept that is not kept.** A bare `persist` on a
 *      workspace with no marks is a measured zero and names itself as one.
 *
 * The harness home and the mirror root are both temp directories, set on the
 * process for the duration of each test and restored afterwards, because the
 * CLI reads `process.env` the way a real run does. `test/helpers/real-home-guard.ts`
 * would abort the run if anything reached the developer's own home.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { MIRROR_DIR_ENV, mirrorPath } from '../../src/core/conversation-mirror.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'bbbbbbbb-1111-2222-3333-555555555555';

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
  copy: string;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-persist-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-persist-cwd-'));
  const kept = mkdtempSync(path.join(tmpdir(), 'myctx-persist-kept-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl([
    say('user', 'do the thing', '2026-09-09T10:00:00.000Z'),
    say('assistant', 'done', '2026-09-09T10:00:01.000Z'),
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

test('a copy is refused without confirmation, and NOTHING is written', () => {
  const f = fixture();
  try {
    const code = f.run(['conversation', 'persist', SESSION]);
    const drawn = f.out.join('\n');
    assert.equal(code, 1, 'the command succeeded without a confirmation');
    assert.match(drawn, /refusing without confirmation/);
    assert.equal(
      existsSync(f.copy), false,
      'the gate printed and then wrote anyway — the file exists after a refused run',
    );
  } finally {
    f.dispose();
  }
});

test('the preview says what a copy of a session holds before it asks', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'persist', SESSION]);
    const drawn = f.out.join('\n');
    // The three facts a person needs in order to decide, and the ORDER: the
    // sensitivity sentence is the first line, ahead of the arithmetic.
    assert.match(drawn, /every tool call with its full input and its full result/);
    assert.match(drawn, /keys, tokens/);
    assert.match(drawn, /no `\.gitignore` is protecting/);
    const first = f.out.findIndex((line) => /every tool call/.test(line));
    const about = f.out.findIndex((line) => /about to copy session/.test(line));
    assert.ok(first >= 0 && about > first, 'the disclosure does not come first');
  } finally {
    f.dispose();
  }
});

test('with --yes the copy is written, named, and is the file byte for byte', () => {
  const f = fixture();
  try {
    const code = f.run(['conversation', 'persist', SESSION, '--yes']);
    assert.equal(code, 0, f.out.join('\n'));
    assert.ok(existsSync(f.copy), 'no copy was written');
    assert.match(f.out.join('\n'), new RegExp(f.copy.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')),
      'the copy was written and its path was not printed — a file nobody can find is not a copy');
    assert.match(f.out.join('\n'), /kept up to date at the end of every assistant turn/);

    const ws = resolveWorkspace(f.cwd);
    const original = path.join(
      process.env['CLAUDE_CONFIG_DIR'] ?? '', 'projects', projectDirName(f.cwd),
      `${SESSION}.jsonl`,
    );
    assert.deepEqual(readFileSync(f.copy), readFileSync(original));
    assert.ok(ws.dbPath.length > 0);
  } finally {
    f.dispose();
  }
});

test('a bare persist reports a measured zero, and lists the mark once there is one', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'persist']);
    assert.match(f.out.join('\n'), /a measured zero, not a question nobody asked/);

    f.out.length = 0;
    f.run(['conversation', 'persist', SESSION, '--yes']);
    f.out.length = 0;
    f.run(['conversation', 'persist']);
    const drawn = f.out.join('\n');
    assert.match(drawn, new RegExp(SESSION.slice(0, 8)));
    assert.match(drawn, /showing all 1\./);
  } finally {
    f.dispose();
  }
});

test('--off stops the copying and leaves the copy where it is', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'persist', SESSION, '--yes']);
    const bytes = readFileSync(f.copy);
    f.out.length = 0;

    const code = f.run(['conversation', 'persist', SESSION, '--off']);
    assert.equal(code, 0, f.out.join('\n'));
    const drawn = f.out.join('\n');
    assert.match(drawn, /no longer kept up to date/);
    assert.match(drawn, /left exactly where it is/);
    assert.deepEqual(readFileSync(f.copy), bytes, 'stopping the copying deleted the copy');

    f.out.length = 0;
    f.run(['conversation', 'persist']);
    assert.match(f.out.join('\n'), /a measured zero/);
  } finally {
    f.dispose();
  }
});

test('--off with no session says which argument is missing rather than guessing one', () => {
  const f = fixture();
  try {
    const code = f.run(['conversation', 'persist', '--off']);
    assert.equal(code, 1);
    assert.match(f.out.join('\n'), /needs the session to stop keeping/);
  } finally {
    f.dispose();
  }
});

test('forgetting the index says the copies are untouched and where they are', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'persist', SESSION, '--yes']);
    f.out.length = 0;
    f.run(['conversation', 'forget', '--yes']);
    const drawn = f.out.join('\n');
    assert.match(drawn, /1 session\(s\) were being kept outside this project/);
    assert.match(drawn, /copies themselves are UNTOUCHED/);
    assert.ok(existsSync(f.copy), 'forgetting the index deleted a copy of a conversation');
  } finally {
    f.dispose();
  }
});

/**
 * **TURNING SOMETHING OFF MUST NOT TURN THE ARCHIVE ON.**
 *
 * `unpersistSession` opens the index for WRITE, and `ConversationIndex.open`
 * is the only thing in this product that creates the conversation tables. The
 * end-of-turn refresh gates on those tables EXISTING — its own comment: "a
 * workspace nobody has ever scanned is still never opted in by a background
 * hook" — so a `persist --off` that created them would opt a machine into
 * reading its own transcripts by way of a command that reads as a withdrawal.
 *
 * The workspace here is initialised and never scanned, which is the state
 * `mycontext conversation forget` returns a workspace to and the state every
 * fresh corpus in the world is in.
 */
test('--off in a workspace nobody has scanned refuses, and creates no tables', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-persist-virgin-'));
  try {
    runCli(['init'], cwd, () => {});
    const out: string[] = [];
    const code = runCli(['conversation', 'persist', SESSION, '--off'], cwd, (l) => out.push(l));
    assert.equal(code, 1);
    assert.match(out.join('\n'), /nothing is indexed in this workspace yet/);

    // The tables, asked of the database rather than inferred from the message.
    // `mycontext init` writes no `.index.db` at all, so its ABSENCE is the
    // strongest form of the same assertion and is the state a fresh corpus is
    // really in — `openReadOnlyChecked` names it as its own class for exactly
    // that reason.
    const db = path.join(cwd, '.my_context', '.index.db');
    const tables = existsSync(db)
      ? new DatabaseSync(db, { readOnly: true })
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((r) => String((r as { name: unknown }).name))
      : [];
    assert.equal(
      tables.includes('conversations'), false,
      'a withdrawal created the tables the end-of-turn refresh gates on',
    );
    assert.equal(tables.includes('persisted'), false);
  } finally {
    removeTree(cwd);
  }
});
