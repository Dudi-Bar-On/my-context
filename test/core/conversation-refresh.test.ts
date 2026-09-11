// @basis TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has, INV-nothing-is-dropped-silently, TASK-the-archive-s-own-scan-re-reads-96-mb-on-every-turn-for-the
/**
 * **The append-only refresh, and the staleness a `stat` can see** —
 * `plan:archive seq:14`.
 *
 * ── THE DEFECT THESE FIXTURES REPRODUCE ────────────────────────────────────
 *
 * `rebuildConversations` had exactly one caller: `mycontext conversation
 * rebuild`, typed by a person. Measured on this project's own corpus
 * 2026-09-08, the index said the owner's session ended `2026-09-07T00:50`
 * while the transcript was 65,046,326 bytes and had been written that minute —
 * over a day, and 11,231,042 bytes, behind, with nothing anywhere saying so.
 *
 * Two properties fix it and this file proves both, because either alone leaves
 * the archive where it was found:
 *
 *   1. **A refresh is CHEAP, and its answer is the expensive one's.** The
 *      whole argument for refreshing automatically is that a transcript only
 *      appends, so a grown one costs its tail. `an appended transcript is
 *      caught up by reading only the tail` asserts the saving AND the
 *      equality — the composed row is compared field by field against the row
 *      a `--full` rebuild of the same file produces, not against numbers
 *      somebody wrote down. A cheap path that is subtly wrong is worse than no
 *      cheap path, because it is wrong quietly and forever: every later
 *      refresh resumes from the position the wrong one left.
 *   2. **A cache that is behind SAYS SO.** `staleBy` is the whole disclosure,
 *      and it is a subtraction over one `stat` so that a read-only surface can
 *      make it without rebuilding anything.
 *
 * ── WHAT THE REFUSALS ARE FOR, WHICH IS THE HALF THAT MATTERS ──────────────
 *
 * The append path is an OPTIMISATION THAT MUST BE ABLE TO DECLINE, and the
 * four tests that make it decline are the ones carrying the real risk. A
 * resume that lands mid-record, a file rewritten rather than appended to, or a
 * row whose scan stopped at the cap would each produce a row that is wrong in
 * a way no count can be checked against — `prompts + answers + machinery`
 * would still equal `records`, because both halves would be wrong together.
 * So each falls to the whole re-read, and each is asserted to.
 *
 * The fourth is the one that had to be found rather than reasoned to, and it
 * is not about counts at all: a session renamed by hand and then un-renamed
 * has a row that has FORGOTTEN the model's title, which only a whole re-read
 * can recover. It has its own test and its own paragraph there, because a
 * divergence between two paths in one obscure case is exactly the kind of bug
 * that survives a green suite.
 *
 * Everything runs against FIXTURES in a temp directory. `CLAUDE_CONFIG_DIR` is
 * redirected per test — the same variable the product honours, so the code
 * path is the real one — and nothing here reaches the developer's own
 * `~/.claude`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  appendFileSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, projectDirName, rebuildConversations, staleBy,
  type ConversationRow,
} from '../../src/core/conversation-index.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = '11111111-2222-3333-4444-555555555555';

/**
 * A throwaway `~/.claude` plus a workspace, wired the way the harness wires
 * the real one. `conversation-index.test.ts`'s `fixture`, with the two things
 * this file needs and that one does not: an APPEND that adds records without
 * rewriting the file, and a second database so the same transcript can be read
 * both ways and the rows compared.
 */
function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  otherDbPath: string;
  file: string;
  write: (lines: unknown[], trailingNewline?: boolean) => void;
  append: (lines: unknown[]) => void;
  /** Bytes exactly as given — how a half-written record is finished. */
  raw: (text: string) => void;
  row: (dbPath?: string) => ConversationRow;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  const otherDbPath = path.join(cwd, 'index-full.db');
  Store.open(dbPath).close();
  Store.open(otherDbPath).close();
  const file = path.join(dir, `${SESSION}.jsonl`);

  const render = (lines: unknown[]): string =>
    lines.map((line) => JSON.stringify(line)).join('\n');

  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dir,
    dbPath,
    otherDbPath,
    file,
    // `trailingNewline` is a parameter and not an assumption: a transcript
    // caught between a record and its newline is the one shape the resume must
    // refuse, and a fixture that could not produce it could not test it.
    write: (lines, trailingNewline = true) => {
      writeFileSync(file, render(lines) + (trailingNewline ? '\n' : ''));
    },
    append: (lines) => {
      appendFileSync(file, render(lines) + '\n');
    },
    raw: (text) => {
      appendFileSync(file, text);
    },
    row: (which = dbPath) => {
      const index = ConversationIndex.openReadOnlyChecked(which);
      try {
        const found = index.get(SESSION);
        assert.notEqual(found, null, 'the fixture session should be indexed');
        return found as ConversationRow;
      } finally {
        index.close();
      }
    },
    dispose: () => {
      removeTree(home);
      removeTree(cwd);
    },
  };
}

const said = (t: string): unknown[] => [{ type: 'text', text: t }];

/** An exchange: one typed prompt, one spoken answer, one tool step. */
function exchange(n: number): unknown[] {
  return [
    {
      type: 'user',
      message: { role: 'user', content: `ask ${n}` },
      timestamp: `2026-09-0${n}T10:00:00.000Z`,
      gitBranch: 'master',
      cwd: '/w',
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] },
      timestamp: `2026-09-0${n}T10:00:01.000Z`,
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: said(`answer ${n}`) },
      timestamp: `2026-09-0${n}T10:00:02.000Z`,
    },
  ];
}

/**
 * Every field a row carries EXCEPT `scannedAt`, which is a clock reading and
 * differs between two runs by construction.
 *
 * Comparing the whole row rather than the counts is deliberate. The counts are
 * the fields a careless merge gets right — they add — and `endedAt`, `branch`
 * and `cwd` are the ones it gets wrong, because they are last-writer-wins and
 * a tail that saw none of them must leave the row's alone rather than null it.
 */
function comparable(row: ConversationRow): Omit<ConversationRow, 'scannedAt'> {
  const { scannedAt: _ignored, ...rest } = row;
  return rest;
}

test('an appended transcript is caught up by reading only the tail, and the row is the one a full read produces', () => {
  const f = fixture();
  try {
    f.write(exchange(1));
    const first = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(first.scanned, 1, 'the first sight of a file is a whole read');
    assert.equal(first.appended, 0);
    const before = statSync(f.file).size;

    f.append([...exchange(2), ...exchange(3)]);
    const grown = statSync(f.file).size;

    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});

    // THE SAVING. Not "faster" — a measurable count of bytes, which is what
    // makes the claim checkable when somebody changes the resume arithmetic.
    assert.equal(refresh.appended, 1, 'the grown transcript took the append path');
    assert.equal(refresh.scanned, 0, 'and nothing was read whole');
    assert.equal(
      refresh.bytesRead, grown - before,
      'exactly the appended tail was read, and not one byte of what was already indexed',
    );

    // THE EQUALITY. Against a `--full` rebuild of the same file in a second
    // database, so the reference is produced rather than remembered.
    rebuildConversations(f.otherDbPath, f.env, f.cwd, { full: true });
    assert.deepEqual(
      comparable(f.row()), comparable(f.row(f.otherDbPath)),
      'the composed row and the whole-read row must be the same row',
    );

    // And the numbers themselves, so a reader of this test can see what was
    // composed rather than only that two things matched.
    const row = f.row();
    assert.equal(row.records, 9, 'three exchanges of three records');
    assert.equal(row.prompts, 3);
    assert.equal(row.answers, 3);
    assert.equal(row.machinery, 3);
    assert.equal(row.endedAt, '2026-09-03T10:00:02.000Z', 'the tail wins on end time');
    assert.equal(row.startedAt, '2026-09-01T10:00:00.000Z', 'and never on start time');
    assert.equal(row.scannedBytes, grown, 'the row accounts for the whole file');
  } finally {
    f.dispose();
  }
});

test('a resume point that is not a line boundary falls to a whole re-read rather than double-counting', () => {
  const f = fixture();
  try {
    // A transcript caught between a record and its newline: the harness had
    // written the object and not yet the `\n`. `bytes` is then NOT a line
    // start, and resuming there would read the rest of that record as a fresh
    // line — one `unreadable` — while the record it belongs to stays counted.
    f.write(exchange(1), false);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    // The harness finishes the record it was in the middle of — the newline
    // arrives first, and only then the next records. That is what makes
    // `row.bytes` point INTO a line rather than at the start of one, which is
    // the whole hazard: the byte at `bytes - 1` is the last character of a
    // record the row has already counted.
    f.raw('\n');
    f.append(exchange(2));

    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(refresh.appended, 0, 'the append path declined');
    assert.equal(refresh.scanned, 1, 'and the file was read whole instead');

    const row = f.row();
    assert.equal(row.unreadable, 0, 'nothing was left half-parsed');
    assert.equal(row.records, 6, 'six records, each counted once');
    assert.equal(row.prompts, 2);
    assert.equal(row.answers, 2);
    assert.equal(row.machinery, 2);

    rebuildConversations(f.otherDbPath, f.env, f.cwd, { full: true });
    assert.deepEqual(comparable(f.row()), comparable(f.row(f.otherDbPath)));
  } finally {
    f.dispose();
  }
});

test('a transcript that shrank is read whole, because a smaller file is not an append', () => {
  const f = fixture();
  try {
    f.write([...exchange(1), ...exchange(2), ...exchange(3)]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(f.row().records, 9);

    // Replaced, not appended to — an export re-written in place, or a file the
    // harness rotated. Carrying nine records forward onto a file that holds
    // three would be a row nothing could ever correct.
    f.write(exchange(1));
    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(refresh.appended, 0);
    assert.equal(refresh.scanned, 1);
    assert.equal(f.row().records, 3, 'the row is what the file now holds');
    assert.equal(f.row().prompts, 1);
  } finally {
    f.dispose();
  }
});

test('a row whose scan hit the cap is never appended to — there is no rest to resume from', () => {
  const f = fixture();
  try {
    f.write([...exchange(1), ...exchange(2), ...exchange(3)]);
    // A cap that stops part-way. The row is then a FLOOR, and `scannedBytes <
    // bytes` says so; resuming at `bytes` would skip everything between where
    // the scan stopped and the end of the file, silently, and call the result
    // a complete row.
    const capped = rebuildConversations(f.dbPath, f.env, f.cwd, { cap: 200 });
    assert.equal(capped.truncated.length, 1, 'the fixture really did hit the cap');
    const short = f.row();
    assert.ok(short.scannedBytes < short.bytes);

    f.append(exchange(4));
    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(refresh.appended, 0, 'a truncated row cannot be extended');
    assert.equal(refresh.scanned, 1);
    assert.equal(f.row().records, 12, 'and the whole file is counted once the cap is gone');
  } finally {
    f.dispose();
  }
});

/**
 * The subtlest of the five refusals, and the one that had to be FOUND rather
 * than reasoned to.
 *
 * The row stores ONE title. A session the user renamed by hand reads
 * `title_source = 'custom'`, and the `ai-title` records the file still carries
 * are nowhere in the row — so if the rename is later undone, a tail that saw
 * no `ai-title` of its own has nothing to fall back to while a whole re-read
 * finds the model's name wherever it sits. Without the guard the two paths
 * disagree, and disagree only here: a rename, then an un-rename, then one more
 * turn. Nobody would have looked.
 */
test('a session whose custom title was removed is read whole, so the model\'s name comes back', () => {
  const f = fixture();
  try {
    f.write([
      ...exchange(1),
      { type: 'ai-title', aiTitle: 'what the model called it' },
    ]);
    mkdirSync(path.join(f.dir, SESSION), { recursive: true });
    const titleFile = path.join(f.dir, SESSION, 'custom-title.json');
    writeFileSync(titleFile, JSON.stringify({ customTitle: 'what I called it' }));

    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(f.row().title, 'what I called it');
    assert.equal(f.row().titleSource, 'custom', 'and the row has forgotten the ai-title');

    // The rename is undone, and the session keeps going.
    rmSync(titleFile);
    f.append(exchange(2));

    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(refresh.appended, 0, 'the append path declined');
    assert.equal(refresh.scanned, 1, 'because only a whole read can find the ai-title again');
    assert.equal(f.row().title, 'what the model called it');
    assert.equal(f.row().titleSource, 'ai');

    rebuildConversations(f.otherDbPath, f.env, f.cwd, { full: true });
    assert.deepEqual(comparable(f.row()), comparable(f.row(f.otherDbPath)));
  } finally {
    f.dispose();
  }
});

test('--full never takes the append path, which is the guarantee it is asked for', () => {
  const f = fixture();
  try {
    f.write(exchange(1));
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    f.append(exchange(2));

    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, { full: true });
    assert.equal(refresh.appended, 0, '`--full` buys a whole read and must get one');
    assert.equal(refresh.scanned, 1);
    assert.equal(refresh.bytesRead, statSync(f.file).size);
  } finally {
    f.dispose();
  }
});

test('an unchanged transcript still costs one stat and reads nothing', () => {
  const f = fixture();
  try {
    f.write(exchange(1));
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const again = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(again.skipped, 1);
    assert.equal(again.appended, 0);
    assert.equal(again.scanned, 0);
    assert.equal(again.bytesRead, 0, 'the freshness key answered without opening the file');
  } finally {
    f.dispose();
  }
});

/**
 * The disclosure, which is required WHATEVER the refresh does — a cache that
 * is behind and does not say so is how the defect stayed invisible for a day.
 *
 * Each case is a state a surface must be able to tell apart, and two of them
 * answer `0` for opposite reasons: a current row has nothing to disclose, and
 * a PRUNED one has a different thing to disclose (`present`, which is already
 * a field). Reporting a deleted transcript as "behind" would be one state
 * wearing another's name.
 */
test('staleBy says how far behind a row is, and answers zero for every state that is not behind', () => {
  assert.equal(staleBy({ bytes: 100 }, 100), 0, 'a row level with its file is current');
  assert.equal(staleBy({ bytes: 100 }, 164), 64, 'a grown file is behind by what it grew');
  assert.equal(staleBy({ bytes: 100 }, null), 0, 'a pruned file is absent, not stale');
  assert.equal(staleBy({ bytes: 100 }, 40), 0, 'a shrunk file is replaced, not stale');
  // The measurement that produced this feature, kept as a fixture so the
  // arithmetic is checked against the case it was written for.
  assert.equal(staleBy({ bytes: 53_815_284 }, 65_046_326), 11_231_042);
});

test('a refreshed index is no longer behind, and the same stat proves it both ways', () => {
  const f = fixture();
  try {
    f.write(exchange(1));
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(staleBy(f.row(), statSync(f.file).size), 0);

    f.append(exchange(2));
    const behind = staleBy(f.row(), statSync(f.file).size);
    assert.ok(behind > 0, 'the index is behind the moment the file grows');

    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(
      staleBy(f.row(), statSync(f.file).size), 0,
      'and the refresh is what makes it current again',
    );
  } finally {
    f.dispose();
  }
});

/**
 * ── THE SECOND DEFECT IN THIS PATH, AND IT IS THE SAME MISTAKE ─────────────
 *
 * `TASK-the-archive-s-own-scan-re-reads-96-mb-on-every-turn-for-the`.
 *
 * The row's `bytes` came from the DIRECTORY LISTING's `stat`; its
 * `scanned_bytes` came from the read that followed. Those are two different
 * moments, and a transcript being appended to grows between them — so the read
 * reached PAST the size the row recorded and the row landed with
 * `scanned_bytes > bytes`. Condition 2 above is
 * `previous.scannedBytes === previous.bytes`; a scan-ahead row fails it, falls
 * to a whole re-read, and the whole re-read — being four hundred milliseconds
 * long — is likelier to be overtaken by the writer than the tail it replaced.
 *
 * MEASURED on this workspace from the Stop hook's own audit rows, 2026-09-08
 * to 2026-09-11, over 203 per-turn refreshes of one live session:
 *
 *     read whole    65   32.0%    70,470,780 bytes avg   435 ms avg
 *     tail         138   68.0%       228,368 bytes avg   119 ms avg
 *
 * and 4,580,600,730 of the 4,612,115,495 bytes the hook read over those four
 * days — 99.3% — were those 65 re-reads. So it is ONE TURN IN THREE, not every
 * turn, and the filed claim that the row never heals is wrong:
 * `P(whole | previous whole) = 0.484` against
 * `P(whole | previous tail) = 0.246`, which is a skew that recurs and clears
 * rather than one that sticks.
 *
 * THE REPAIR is that the scan may not read past the size the row is about to
 * record: the read is clamped to the listing's `stat`, so `scanned_bytes` and
 * `bytes` describe ONE moment. What arrived after that moment is DEFERRED, not
 * dropped — it is the next refresh's tail — and the tests below assert that
 * distinction in both directions rather than only the cheap half.
 */

/** One exchange as the bytes a harness would append, newline and all. */
function rendered(lines: unknown[]): string {
  return lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
}

/**
 * **The harness writing between the listing's `stat` and the read that
 * follows**, reproduced exactly rather than approximated.
 *
 * A racing writer in another process would reproduce this only sometimes, and
 * only on a file big enough to be slow — a test that is green when the timing
 * misses is worse than no test. Patching the ONE `stat` the listing takes
 * makes the interleaving the point rather than the luck: the real `stat` is
 * returned, honestly describing the moment it was taken, and the file grows
 * immediately afterwards, which is precisely what a live transcript does.
 *
 * `grew()` is asserted by every caller and never assumed. If the scanner ever
 * stops asking `statSync` for the size, the patch stops firing and the tests
 * that rest on it go RED rather than quietly proving nothing.
 */
function appendAfterTheStat(target: string, tail: string): {
  grew: () => boolean; restore: () => void;
} {
  // The builtin's own export object, which is what `syncBuiltinESMExports`
  // republishes to every module holding a named import of it. `node:module`
  // exists for exactly this and it is the reason no dependency is needed.
  const builtin = fs as unknown as { statSync: unknown };
  const real = fs.statSync as unknown as (p: unknown, options?: unknown) => unknown;
  let fired = false;
  builtin.statSync = (p: unknown, options?: unknown): unknown => {
    const stat = real(p, options);
    if (!fired && typeof p === 'string' && path.resolve(p) === path.resolve(target)) {
      fired = true;
      appendFileSync(target, tail);
    }
    return stat;
  };
  syncBuiltinESMExports();
  return {
    grew: () => fired,
    restore: () => {
      builtin.statSync = real;
      syncBuiltinESMExports();
    },
  };
}

test('a transcript that grew between the stat and the read is recorded level, never scan-ahead', () => {
  const f = fixture();
  f.write(exchange(1));
  const race = appendAfterTheStat(f.file, rendered(exchange(2)));
  try {
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
  } finally {
    race.restore();
  }
  try {
    assert.ok(race.grew(), 'the fixture really did append between the stat and the read');
    const row = f.row();
    // THE DEFECT, in one line. `scanned_bytes > bytes` is a row whose two
    // numbers were taken at two different moments, and it costs the session a
    // whole re-read on the next turn and every turn that follows it.
    assert.equal(
      row.scannedBytes, row.bytes,
      'the size the row records and the position the scan reached are one moment',
    );
  } finally {
    f.dispose();
  }
});

test('the bytes that arrived during a scan are deferred to the next refresh, not dropped and not re-read whole', () => {
  const f = fixture();
  f.write(exchange(1));
  const atStat = statSync(f.file).size;
  const race = appendAfterTheStat(f.file, rendered(exchange(2)));
  try {
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
  } finally {
    race.restore();
  }
  try {
    assert.ok(race.grew(), 'the fixture really did append between the stat and the read');
    const grown = statSync(f.file).size;

    // NOT INDEXED YET, and the row says so: it accounts for the file as the
    // listing saw it, and for nothing after.
    assert.equal(f.row().bytes, atStat, 'the row accounts for the file the listing stat saw');
    assert.equal(
      f.row().records, 3,
      'and for none of what arrived after it — the tail is deferred, not counted early',
    );

    // AND IT IS THE NEXT SCAN'S TAIL. The other half of the same promise:
    // deferred is only honest if something later reaches it, and reaches it
    // cheaply.
    const refresh = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(refresh.appended, 1, 'the deferred bytes are the next refresh’s append path');
    assert.equal(
      refresh.bytesRead, grown - atStat,
      'and cost exactly themselves — not the whole file the old skew re-read',
    );
    assert.equal(f.row().records, 6, 'nothing that arrived during the scan was lost');

    // The composed row against a `--full` read of the same file, so the
    // reference is produced rather than remembered.
    rebuildConversations(f.otherDbPath, f.env, f.cwd, { full: true });
    assert.deepEqual(
      comparable(f.row()), comparable(f.row(f.otherDbPath)),
      'and the row a deferred tail composes is the row a whole read produces',
    );
  } finally {
    f.dispose();
  }
});

test('an index left scan-ahead by an earlier build heals on the first refresh and stays cheap after it', () => {
  const f = fixture();
  try {
    f.write(exchange(1));
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    // The state the old build left on this workspace's own index, measured
    // 2026-09-11: `bytes 97,446,894  scanned_bytes 97,447,607` — 713 bytes of
    // skew buying a 97 MB read. Written through the index's own `upsert`,
    // because that is the shape the row actually has on disk.
    const index = ConversationIndex.open(f.dbPath);
    try {
      const stale = index.get(SESSION);
      assert.notEqual(stale, null);
      const row = stale as ConversationRow;
      index.upsert({ ...row, scannedBytes: row.bytes + 713 });
    } finally {
      index.close();
    }
    assert.ok(f.row().scannedBytes > f.row().bytes, 'the fixture really is scan-ahead');

    // **AND THE HEAL HAPPENS WHILE THE SESSION IS STILL BEING TYPED INTO**,
    // which is the only condition under which it was ever needed. A scan-ahead
    // row read whole on a QUIET file was always levelled — that heal was never
    // the problem and asserting it would prove nothing. The re-read is 435 ms
    // on the live transcript, so in the field it is the read MOST likely to be
    // overtaken, which is why the defect looked like it never healed: the cure
    // re-created the disease.
    f.append(exchange(2));
    const race = appendAfterTheStat(f.file, rendered(exchange(3)));
    let heal;
    try {
      heal = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    } finally {
      race.restore();
    }
    assert.ok(race.grew(), 'the fixture really did append during the healing re-read');
    assert.equal(heal.scanned, 1, 'a scan-ahead row cannot be resumed, so it is read whole ONCE');
    assert.equal(
      f.row().scannedBytes, f.row().bytes,
      'and the row that re-read leaves behind is level, even though the file moved under it',
    );

    const after = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(
      after.appended, 1,
      'so the turn after it is a tail again — which is what "it heals" has to mean',
    );
  } finally {
    f.dispose();
  }
});

test('a lane transcript that grew between the stat and the read is recorded level too', () => {
  const f = fixture();
  const agentId = 'agent-0123456789abcdef';
  const lane = path.join(f.dir, SESSION, 'subagents', `${agentId}.jsonl`);
  f.write(exchange(1));
  mkdirSync(path.dirname(lane), { recursive: true });
  writeFileSync(lane, rendered(exchange(1)));
  const race = appendAfterTheStat(lane, rendered(exchange(2)));
  try {
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
  } finally {
    race.restore();
  }
  try {
    assert.ok(race.grew(), 'the fixture really did append between the stat and the read');
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const row = index.getSubagent(agentId);
      assert.notEqual(row, null, 'the lane should be indexed');
      // A RUNNING lane appends exactly as a session does — the append path was
      // measured firing on 2 of 254 lanes — so the same clamp has to hold here
      // or the archive trades one scan-ahead row for three hundred.
      const lit = row as { bytes: number; scannedBytes: number };
      assert.equal(lit.scannedBytes, lit.bytes, 'a lane row records one moment too');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a transcript whose last record has no newline yet is counted, because a clamp that lands on the end of the file IS the end of the file', () => {
  const f = fixture();
  try {
    // The harness had written the object and not yet the `\n`. The read now
    // stops at the size the listing saw, so the walk can no longer learn that
    // it reached the end by running out of file — it has to ASK, and this is
    // the record that goes missing in silence if it does not.
    f.write(exchange(1), false);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(f.row().records, 3, 'the last record is read, not discarded by the clamp');
  } finally {
    f.dispose();
  }
});
