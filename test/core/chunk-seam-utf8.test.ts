// @basis TASK-a-byte-offset-and-a-character-offset-are-the-same-number-and,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A chunk boundary is counted in BYTES, and a UTF-8 character is not one
 * byte.** Every transcript reader in this project walks a file in 1 MiB
 * chunks, and every one of them has to decide what it carries across the seam
 * between two chunks. Carrying a `Buffer` is correct. Carrying a `string` —
 * which is what `chunk.toString('utf8')` hands you — decodes each chunk on its
 * own, so the character that straddles the seam is split into TWO U+FFFD, one
 * at the tail of this chunk and one at the head of the next.
 *
 * **The whole point of this file is that it is written in Hebrew.** On ASCII a
 * byte offset and a character offset are the same number, so an assertion over
 * ASCII text CANNOT fail on this defect — which is exactly why two of the three
 * readers shipped wrong and survived review. Every seam assertion below puts a
 * two-byte Hebrew character ACROSS the 1 MiB boundary and reads the text back.
 *
 * **Three readers, one fixture.** They used to be three private 1 MiB
 * constants — `WALK_CHUNK_BYTES` and two called `CHUNK_BYTES` — and since
 * 2026-09-13 they are one, `LINE_WALK_CHUNK_BYTES` in `src/core/line-walk.ts`,
 * which is where the carry now lives. This file did not change with it, and
 * that is the point: it drove these three readers before the extraction and it
 * drives them after, which is what makes it the extraction's own proof. All
 * three walks still start at byte zero, so one transcript whose seam record
 * straddles byte 1 048 576 exercises all three at the same character:
 *
 *   1. `iterateTranscript` — the reader that was already RIGHT, and had no test
 *      saying so. A correct implementation with no falsifiable test is one
 *      refactor away from joining the other two.
 *   2. `apiConversation` → `readWindow` — was carrying a `string`.
 *   3. `summariseTranscript` — was carrying a `string`.
 *
 * A FOURTH reader existed and is not here: `conversation-redaction.ts` walked
 * the same chunks and had no seam assertion at all. It is proved in
 * `test/core/line-walk.test.ts` beside the shared walk itself, because its
 * fixture is a redacted COPY on disk rather than a record read back.
 *
 * **The fixture guards itself.** `the fixture really does split a Hebrew
 * character at the 1 MiB boundary` asserts that byte 1 048 576 of the file is a
 * UTF-8 CONTINUATION byte. Without that, a fixture that drifted by one byte
 * would leave every assertion below green for the wrong reason — the failure
 * this item is about, one layer up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, iterateTranscript, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { summariseTranscript } from '../../src/core/session-summary.ts';
import {
  apiConversation, type ConversationBody,
} from '../../src/ui/read-model-conversations.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/** The chunk size all three readers use. The seam is at this byte. */
const SEAM = 1024 * 1024;
/** U+FFFD. What a decoder emits where it found half a character. */
const REPLACEMENT = '�';

/**
 * Hebrew letters only — every one of them two bytes in UTF-8 and none of them
 * escaped by `JSON.stringify`. No spaces, so ANY odd offset into the run splits
 * a character rather than landing between two.
 */
const ALEFBET = 'אבגדהוזחטיכלמנסעפצקרשת';
/** The run that straddles the seam: 440 characters, 880 bytes. */
const SEAM_HEBREW = ALEFBET.repeat(20);
/**
 * The seam record's text. The English tail is there for ONE reason: the
 * summary reader admits a point by scoring English cues, so a record with no
 * cue would be dropped before the text this test wants to read could reach
 * `points`. `we decided` is `DECISION_CUES`' `decided` pattern, weight 3,
 * against a person's bar of 1.
 */
const SEAM_TEXT = `${SEAM_HEBREW} we decided that the seam carries bytes.`;

interface Fixture {
  /** Where the transcript lives. */
  file: string;
  /** The record index of the line the seam falls inside. */
  seamIndex: number;
  /** The whole file, so a test can assert about the byte at the seam. */
  bytes: Buffer;
  dispose: () => void;
  /** The workspace the UI read model is served from. */
  ws: Workspace;
  cwd: string;
  session: string;
}

/** A filler record: no `message`, so the summary reader drops it at stage 1. */
const filler = (n: number): string =>
  JSON.stringify({ type: 'system', subtype: 'filler', pad: 'x'.repeat(n) }) + '\n';

/**
 * Build a transcript whose seam record's Hebrew run straddles byte `SEAM`.
 *
 * The seam line is placed so that the boundary falls 441 bytes into an 880-byte
 * Hebrew run — an ODD offset, which is what puts it between the two bytes of
 * one character rather than between two characters.
 */
function build(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-seam-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-seam-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  process.env['CLAUDE_CONFIG_DIR'] = home;

  const seamLine = JSON.stringify({
    type: 'user',
    timestamp: '2026-09-13T10:00:00.000Z',
    message: { role: 'user', content: SEAM_TEXT },
  }) + '\n';
  // Everything before the first Hebrew letter is ASCII, so a character index
  // into the line is also a byte index into it.
  const hebrewAt = seamLine.indexOf(ALEFBET[0] as string);
  assert.ok(hebrewAt > 0, 'the seam line no longer contains the Hebrew run');

  // Where the seam line must START so that the boundary lands 441 bytes into
  // its Hebrew run.
  const startAt = SEAM - hebrewAt - 441;

  const lines: string[] = [];
  let at = 0;
  const overhead = filler(0).length;
  const base = filler(60_000);
  while (startAt - at > base.length + overhead + 4096) { lines.push(base); at += base.length; }
  lines.push(filler(startAt - at - overhead));
  const seamIndex = lines.length;
  lines.push(seamLine);
  lines.push(filler(64));

  const session = 'seam1';
  const file = path.join(dir, `${session}.jsonl`);
  const bytes = Buffer.from(lines.join(''), 'utf8');
  writeFileSync(file, bytes);

  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  return {
    file,
    seamIndex,
    bytes,
    ws,
    cwd,
    session,
    dispose: () => {
      delete process.env['CLAUDE_CONFIG_DIR'];
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/* ── the fixture guards itself ────────────────────────────────────────────── */

test('the fixture really does split a Hebrew character at the 1 MiB boundary', () => {
  const f = build();
  try {
    assert.ok(
      f.bytes.length > SEAM,
      `the transcript is ${f.bytes.length} bytes and the seam is at ${SEAM}. A file that never `
      + 'reaches the boundary exercises no seam at all, and every assertion in this file would '
      + 'be green because nothing was tested.',
    );
    const byte = f.bytes[SEAM] as number;
    assert.equal(
      byte & 0xc0, 0x80,
      `byte ${SEAM} is 0x${byte.toString(16)}, which is not a UTF-8 continuation byte. The `
      + 'boundary has drifted off the middle of a Hebrew character, so the seam assertions '
      + 'below can no longer fail and prove nothing. Re-derive `startAt`.',
    );
    // And the byte before it is the LEAD of that same character — the pair the
    // two chunks would otherwise be handed separately.
    const lead = f.bytes[SEAM - 1] as number;
    assert.equal(
      lead & 0xe0, 0xc0,
      `byte ${SEAM - 1} is 0x${lead.toString(16)}, not the lead byte of a two-byte sequence.`,
    );
  } finally { f.dispose(); }
});

/* ── 1. the reader that was already right ─────────────────────────────────── */

test('iterateTranscript carries bytes across the seam, so the Hebrew survives it', () => {
  const f = build();
  try {
    let seen: string | null = null;
    for (const step of iterateTranscript(f.file)) {
      if (step.index !== f.seamIndex) continue;
      const message = (step.record as { message?: { content?: unknown } } | null)?.message;
      seen = typeof message?.content === 'string' ? message.content : null;
      break;
    }
    assert.ok(seen !== null, `no record at index ${f.seamIndex} carried the seam text — the `
      + 'fixture and the walk disagree about which record straddles the boundary');
    assert.ok(
      !seen.includes(REPLACEMENT),
      'the record straddling the 1 MiB boundary came back with U+FFFD in it. `iterateTranscript` '
      + 'has stopped carrying a `Buffer` across the chunk seam and is carrying a decoded `string` '
      + 'instead, so the Hebrew character on the boundary was split into two replacement '
      + 'characters. This is the one reader that was already right; it is right because `carry` '
      + 'is a Buffer.',
    );
    assert.equal(
      seen, SEAM_TEXT,
      'the seam record round-tripped to something other than what was written.',
    );
  } finally { f.dispose(); }
});

/* ── 2. the conversation read model ───────────────────────────────────────── */

test('the conversation endpoint reads the seam record without corrupting it', () => {
  const f = build();
  try {
    rebuildConversations(f.ws.dbPath, process.env, f.cwd);
    const index = ConversationIndex.openReadOnlyChecked(f.ws.dbPath);
    index.close();

    const url = new URL(
      `http://localhost/api/conversations/${f.session}?offset=${f.seamIndex}&limit=2`,
    );
    const answer = apiConversation(f.ws, url, { id: f.session });
    assert.equal(answer.status, 200, 'the seam session is not being served at all');
    const body = answer.body as ConversationBody;
    const record = body.records.find((r) => r.index === f.seamIndex);
    assert.ok(record !== undefined, `the answer carries no record at index ${f.seamIndex}`);
    assert.equal(record.unreadable, false, 'the seam record did not parse');

    assert.ok(
      !record.text.includes(REPLACEMENT),
      'the record straddling the 1 MiB boundary came back with U+FFFD in it. `readWindow` is '
      + 'carrying a decoded `string` across the chunk seam again: `CHUNK_BYTES` counts BYTES, so '
      + 'decoding each chunk on its own splits the Hebrew character on the boundary into two '
      + 'replacement characters. Carry a `Buffer` and decode whole lines, the way '
      + '`iterateTranscript` does.',
    );
    assert.equal(
      record.text, SEAM_TEXT,
      'the seam record\'s text is not what was written to the transcript.',
    );
  } finally { f.dispose(); }
});

/* ── 3. the session summary ───────────────────────────────────────────────── */

test('the session summary reads the seam record without corrupting it', () => {
  const f = build();
  try {
    const summary = summariseTranscript(f.file);
    assert.ok(
      summary.coverage.readBytes > SEAM,
      `the summary read ${summary.coverage.readBytes} bytes and the seam is at ${SEAM}; it never `
      + 'reached the boundary, so this test proves nothing',
    );
    const point = summary.points.find((p) => p.recordIndex === f.seamIndex);
    assert.ok(
      point !== undefined,
      `no point came from record ${f.seamIndex}. The seam record carries a decision cue on `
      + 'purpose so that its TEXT reaches `points`; if admission changed, this test has stopped '
      + 'reading the seam and must be repaired rather than deleted.',
    );

    assert.ok(
      !point.text.includes(REPLACEMENT),
      'the point taken from the record straddling the 1 MiB boundary carries U+FFFD. '
      + '`summariseTranscript` is carrying a decoded `string` across the chunk seam again — '
      + '`CHUNK_BYTES` and `upToBytes` both count BYTES, and a Hebrew character is two of them. '
      + 'Carry a `Buffer` and decode whole lines.',
    );
    assert.ok(
      point.text.includes(SEAM_HEBREW),
      'the point no longer carries the whole Hebrew run it was extracted from, so a character '
      + 'was lost or rewritten somewhere between the read and the point.',
    );
  } finally { f.dispose(); }
});
