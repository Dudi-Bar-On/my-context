// @basis TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never, INV-nothing-is-dropped-silently
/**
 * **The detector proposes, and the substitution replaces exactly what was
 * ticked** — `plan:archive seq:46`, steps 1, 2 and 4.
 *
 * ── WHAT IS WORTH PROVING HERE ────────────────────────────────────────────
 *
 *   1. **The default export is BYTE-IDENTICAL.** The item's ruling in its own
 *      words: *"an export he did not read must be byte-faithful, because a
 *      silent alteration is worse than a silent inclusion when the file's
 *      whole purpose is to be a record."* Two tests hold it — one over a file
 *      with nothing to find, and the one that matters, over a file FULL of
 *      candidates with none of them accepted. `Buffer.equals`, never a record
 *      count: counts are what agree by accident.
 *   2. **A replacement is bounded to what was named.** Accepting one candidate
 *      out of several leaves every other byte of the file where it was, which
 *      is asserted by rebuilding the expected file from the original rather
 *      than by looking for the placeholder and stopping there.
 *   3. **The placeholder is stable and obviously fake.** The same value gets
 *      the same stand-in in record 1, in record 40, and in a tail appended
 *      after the choice was made — which is the item's "a reader of the export
 *      cannot tell that two occurrences were one value" requirement, and the
 *      one that only shows up across an append.
 *   4. **No surface carries the value.** The scan's own output is asserted not
 *      to contain the strings it found. That is not a nicety here: the lane
 *      that reported the 2026-09-08 measurement wrote a live bearer token into
 *      a corpus item, which is committed and pushed.
 *   5. **An interrupted projection costs the partial line, never a duplicated
 *      one** — the property that cannot be read off the code, because the
 *      failure only exists between two runs.
 *
 * ── EVERY CREDENTIAL IN THIS FILE IS SYNTHETIC AND SAYS SO ────────────────
 *
 * Nothing here is read out of the live corpus, out of a real transcript, or
 * out of the developer's home. Each fixture value carries `NOT-REAL` or an
 * obviously invented body inside a shape the detector recognises, so the file
 * can be committed, and so a reader who greps this repository for a leaked key
 * is not sent here by a value that merely looks plausible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SECRET_SHAPES, candidateId, isPlaceholder, matchSecrets, maskSecret, placeholderFor,
  redactLine, redactString, scanSessionSecrets,
} from '../../src/core/conversation-secrets.ts';
import {
  advanceRedaction, chooseRedactions, clearRedactions, readRedactionPlan, redactedCopyPath,
  redactionPlanPath,
} from '../../src/core/conversation-redaction.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Synthetic values, one per shape family, each unmistakably invented.
 *
 * They are declared once and shared, so a shape that stops matching is one
 * failing assertion rather than a quiet gap in a list nobody re-reads.
 */
const FAKE = {
  anthropic: 'sk-ant-api03-NOT-REAL-0000000000000000000000',
  github: 'ghp_NOTREALNOTREALNOTREALNOTREAL0000',
  aws: 'AKIANOTREALNOTREAL00',
  slack: 'xoxb-0000000000-NOTREAL',
  google: 'AIzaNOTREAL00000000000000000000000000000',
  jwt: 'eyJhbGciOiJub3RyZWFsIn0.eyJzdWIiOiJub3RyZWFsIn0.notrealnotrealnotreal',
  npm: 'npm_NOTREALNOTREALNOTREALNOTREALNOTREALN',
  stripe: 'sk_live_NOTREALNOTREALNOTREAL',
  bearer: 'NOTREALbearertokenvalue000000000',
} as const;

/** A transcript record, in the shape the harness writes. */
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

interface Fixture {
  dir: string;
  mirror: string;
  write: (rows: unknown[]) => void;
  append: (rows: unknown[]) => void;
  dispose: () => void;
}

function fixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-redaction-'));
  const mirror = path.join(dir, 'session.jsonl');
  return {
    dir,
    mirror,
    write: (rows) => writeFileSync(mirror, jsonl(rows)),
    append: (rows) => appendFileSync(mirror, jsonl(rows)),
    dispose: () => removeTree(dir),
  };
}

/* -------------------------------------------------------------------- *
 * 1. The shapes.                                                       *
 * -------------------------------------------------------------------- */

test('every declared shape matches something, and each is labelled by the narrowest one', () => {
  const cases: [string, string][] = [
    [`here is ${FAKE.anthropic} ok`, 'anthropic-key'],
    [`token ${FAKE.github} ok`, 'github-token'],
    [`id ${FAKE.aws} ok`, 'aws-access-key-id'],
    [`slack ${FAKE.slack} ok`, 'slack-token'],
    [`google ${FAKE.google} ok`, 'google-api-key'],
    [`jwt ${FAKE.jwt} ok`, 'jwt'],
    [`npm ${FAKE.npm} ok`, 'npm-token'],
    [`stripe ${FAKE.stripe} ok`, 'stripe-key'],
    ['GOCSPX-NOTREALNOTREALNOTREALNOT ok', 'google-oauth-secret'],
    ['SG.NOTREALNOTREALNOT.NOTREALNOTREALNOT ok', 'sendgrid-key'],
    ['"primaryApiKey": "not-a-real-value-here"', 'json-credential-field'],
    ['export GEMINI_API_KEY=not-real-at-all', 'exported-token'],
    ['https://someone:notarealpassword@example.test/x', 'url-userinfo'],
    ['-----BEGIN RSA PRIVATE KEY-----\nnotreal\n-----END RSA PRIVATE KEY-----', 'pem-private-key'],
    ['secret = cryptoRandomBytes', 'key-assignment'],
  ];
  for (const [text, shape] of cases) {
    const found = matchSecrets(text);
    assert.equal(found.length >= 1, true, `nothing matched in: ${text}`);
    assert.equal(found[0]!.shape, shape, `${text} was labelled ${found[0]!.shape}`);
  }
});

/**
 * The overlap rule, which is what makes the label worth reading.
 *
 * `Authorization: Bearer sk-ant-…` is three shapes at once, and a candidate
 * labelled `bearer-header` when it is an Anthropic key tells the reader less
 * than the shape that explains it. One match, and it is the specific one.
 */
test('a value two shapes both match is proposed once, by the narrower shape', () => {
  const found = matchSecrets(`Authorization: Bearer ${FAKE.anthropic}`);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.shape, 'anthropic-key');
  assert.equal(found[0]!.value, FAKE.anthropic);
});

/**
 * **A call is not a credential** — the one structural rule `seq:46`'s
 * measurement of 2026-09-09 identified and deliberately left unapplied, ruled
 * in by the owner on 2026-09-10.
 *
 * `key-assignment` proposed eleven candidates across his 31 transcripts and
 * not one was a credential. Five were `token = mintToken()`,
 * `const token = bearerToken(req…)`, `sessionStorage.getItem(…)` and their
 * kind: the assignment is real, the thing assigned is an expression, and what
 * the pattern captured was the callee's NAME. Rejecting a captured value
 * immediately followed by `(` removes those five and nothing else.
 *
 * The kept case is the one the item names in its own words: `secret =
 * cryptoRandomBytes` written in PROSE is still proposed, because there is no
 * bracket after it and *"that match is the point rather than a bug"*.
 */
test('a value immediately followed by ( is a call, and a call is not proposed', () => {
  for (const call of [
    'const token = mintToken()',
    'const token = bearerToken(req.headers[TOKEN_HEADER])',
    'token: sessionStorage.getItem(\'myctx-token\')',
    'password = readPassword(process.env)',
  ]) {
    assert.deepEqual(matchSecrets(call), [], `a call was proposed: ${call}`);
  }
});

test('only a bracket flush against the value is a call, so prose still proposes', () => {
  const prose = matchSecrets('secret = cryptoRandomBytes');
  assert.equal(prose.length, 1);
  assert.equal(prose[0]!.shape, 'key-assignment');
  const spaced = matchSecrets('secret = NOTAREALVALUE (rotated since)');
  assert.equal(spaced.length, 1, 'a space before the bracket is not a call');
  assert.equal(spaced[0]!.value, 'NOTAREALVALUE');
});

/**
 * The veto belongs to ONE shape, and that is what bounds what it can cost.
 *
 * A credential with a recognisable prefix is proposed by the shape that
 * recognises it, whatever character happens to follow — so the tightening
 * cannot reach any of the six candidates the 2026-09-09 measurement judged
 * plausibly real.
 */
test('a vendor-shaped credential is still proposed when a bracket follows it', () => {
  for (const [text, shape] of [
    [`key ${FAKE.anthropic}(rotated)`, 'anthropic-key'],
    [`token ${FAKE.github}(old)`, 'github-token'],
    [`Authorization: Bearer ${FAKE.bearer}(stale)`, 'bearer-header'],
    [`"password": "NOT-REAL-PASSWORD(with-brackets)"`, 'json-credential-field'],
    ['export MY_API_TOKEN=NOT-REAL-TOKEN(x)', 'exported-token'],
  ] as [string, string][]) {
    const found = matchSecrets(text);
    assert.equal(found.length >= 1, true, `nothing matched in: ${text}`);
    assert.equal(found[0]!.shape, shape, `${text} was labelled ${found[0]!.shape}`);
  }
});

/**
 * **WHAT THE TIGHTENING COSTS, asserted rather than argued away.**
 *
 * `seq:46` says a false positive costs an unticked box while a false negative
 * is invisible, so the silence this rule buys is written down here as a
 * failing case that PASSES — a real password containing a `(` past its eighth
 * character, spelled as a bare assignment, is no longer proposed at all.
 *
 * Two things bound it, and both are asserted beside the miss. The same value
 * spelled as JSON is still proposed, by a shape with no veto — and that is the
 * spelling a harness actually writes, because a transcript is JSON. And the
 * proposal this rule removes was already BROKEN: `(` is outside
 * `key-assignment`'s value class, so the candidate it used to offer was the
 * TRUNCATED PREFIX, and ticking it would have replaced twelve characters of a
 * twenty-character password and reported the box as handled.
 */
test('the cost: a bare assignment whose value contains a bracket is now silent', () => {
  const password = 'NOTAREALPASSWORD(with-brackets)';
  assert.deepEqual(matchSecrets(`PASSWORD='${password}'`), [],
    'this is the miss the call rule buys, and it is here so it is visible');
  const asJson = matchSecrets(`"password": "${password}"`);
  assert.equal(asJson.length, 1, 'the JSON spelling a transcript actually holds is unaffected');
  assert.equal(asJson[0]!.shape, 'json-credential-field');
  assert.equal(asJson[0]!.value, password, 'and it proposes the WHOLE value, not a prefix');
});

/**
 * `seq:46` calls the thirteen *"the starting set, not the finished one"*, so
 * the set has to be able to SAY which members are the thirteen. A widened
 * detector that forgot to mark its additions would be indistinguishable from
 * one that had misremembered the original scan.
 */
test('the shapes say which are the 2026-09-08 thirteen and which this build added', () => {
  const original = SECRET_SHAPES.filter((shape) => !shape.added);
  const added = SECRET_SHAPES.filter((shape) => shape.added);
  assert.equal(original.length, 13, 'the 2026-09-08 scan covered thirteen shapes');
  assert.ok(added.length > 0, 'the item says the thirteen are a starting set');
  assert.equal(new Set(SECRET_SHAPES.map((s) => s.id)).size, SECRET_SHAPES.length,
    'two shapes share an id, so their candidates would collide');
});

test('a placeholder is never proposed as a candidate, so a copy does not redact itself', () => {
  const placeholder = placeholderFor('anthropic-key', candidateId('anthropic-key', FAKE.anthropic));
  assert.equal(isPlaceholder(placeholder), true);
  assert.deepEqual(matchSecrets(`here is ${placeholder} ok`), []);
});

/* -------------------------------------------------------------------- *
 * 2. Ids, masks and the identity.                                      *
 * -------------------------------------------------------------------- */

test('one value is one id and one placeholder, wherever and however often it appears', () => {
  const a = candidateId('anthropic-key', FAKE.anthropic);
  const b = candidateId('anthropic-key', FAKE.anthropic);
  assert.equal(a, b);
  assert.notEqual(a, candidateId('anthropic-key', FAKE.github));
  assert.equal(placeholderFor('anthropic-key', a), placeholderFor('anthropic-key', b));
});

test('the mask carries the shape and the length and never the middle', () => {
  const masked = maskSecret(FAKE.anthropic);
  assert.equal(masked.includes(FAKE.anthropic), false);
  assert.match(masked, /^sk-a/, 'the prefix is what tells one vendor from another');
  assert.match(masked, /\d+ more/, 'the length is what a prefix cannot carry');
  assert.equal(maskSecret('short'), '*****', 'nothing is revealed of a value too short to mask');
});

test('an empty choice returns the text it was handed, identically', () => {
  const text = `a ${FAKE.anthropic} and a ${FAKE.github}`;
  const done = redactString(text, new Set());
  assert.equal(done.text, text);
  assert.equal(done.replaced, 0);
});

test('a line nothing accepted appears in is returned unchanged, byte for byte', () => {
  const line = JSON.stringify(say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z'));
  const other = candidateId('github-token', FAKE.github);
  const done = redactLine(line, new Set([other]));
  assert.equal(done.text, line);
  assert.equal(done.replaced, 0);
});

/* -------------------------------------------------------------------- *
 * 3. The scan.                                                         *
 * -------------------------------------------------------------------- */

test('the scan groups by value, counts occurrences and names the records', () => {
  const f = fixture();
  try {
    f.write([
      say('user', `use ${FAKE.anthropic} please`, '2026-09-09T10:00:00.000Z'),
      say('assistant', 'ok', '2026-09-09T10:00:01.000Z'),
      say('user', `again ${FAKE.anthropic} and ${FAKE.github}`, '2026-09-09T10:00:02.000Z'),
    ]);
    const scan = scanSessionSecrets(f.mirror);
    assert.equal(scan.records, 3);
    assert.equal(scan.candidates.length, 2, 'one candidate per distinct value, not per match');
    const key = scan.candidates.find((c) => c.shape === 'anthropic-key');
    assert.ok(key, 'the Anthropic-shaped value was not proposed');
    assert.equal(key.occurrences, 2);
    assert.deepEqual(key.records, [0, 2]);
    assert.equal(key.id, candidateId('anthropic-key', FAKE.anthropic));
    assert.equal(key.placeholder, placeholderFor('anthropic-key', key.id));
    assert.ok(key.paths.length > 0, 'a candidate has to say WHERE in the record it sits');
  } finally { f.dispose(); }
});

/**
 * The property the whole report rests on, asserted over the report's own JSON
 * rather than field by field: a value that reached a surface once will reach
 * every surface built on it.
 */
test('nothing the scan returns carries a value it found', () => {
  const f = fixture();
  try {
    f.write([
      say('user', `key ${FAKE.anthropic} and ${FAKE.github}`, '2026-09-09T10:00:00.000Z'),
      say('user', `curl -H "Authorization: Bearer ${FAKE.bearer}"`, '2026-09-09T10:00:01.000Z'),
    ]);
    const serialised = JSON.stringify(scanSessionSecrets(f.mirror));
    for (const value of [FAKE.anthropic, FAKE.github, FAKE.bearer]) {
      assert.equal(serialised.includes(value), false,
        'the candidate report carries a value whole; it must carry only a mask');
    }
    assert.ok(serialised.includes('sk-a'), 'the mask still shows enough prefix to judge by');
  } finally { f.dispose(); }
});

/**
 * **The `(32)` used to be the READER's tell, and is now the detector's** —
 * which is the whole of the owner's 2026-09-10 ruling, expressed as the one
 * assertion in this file that CHANGED rather than being added.
 *
 * Until then this test asserted that `const secret = cryptoRandomBytes(32)`
 * was proposed, and its comment said the bracketed call after the value was
 * the tell a person would spot. It was a fair description of a proposer that
 * had never been measured. It has been: `key-assignment` was 0 for 11 on his
 * own transcripts, and five of the eleven were exactly this — a callee's name.
 * A tell a machine can read is not one to spend a reader's attention on.
 */
test('the call a reader used to have to spot is now spotted for them', () => {
  const f = fixture();
  try {
    f.write([say('user', 'const secret = cryptoRandomBytes(32)', '2026-09-09T10:00:00.000Z')]);
    const scan = scanSessionSecrets(f.mirror);
    assert.deepEqual(scan.candidates, [], 'a callee name is not a candidate any more');
    assert.equal(scan.occurrences, 0);
  } finally { f.dispose(); }
});

/**
 * And what the veto does NOT catch is still proposed with the evidence to
 * judge it by — which matters because the corpus form of this false positive
 * is the PROSE one, quoted without its brackets in the very item that reported
 * it, twenty-three times.
 */
test('the context is what tells an identifier from a credential', () => {
  const f = fixture();
  try {
    f.write([say('user', 'the match on `secret = cryptoRandomBytes` is the point',
      '2026-09-09T10:00:00.000Z')]);
    const scan = scanSessionSecrets(f.mirror);
    assert.equal(scan.candidates.length, 1, 'the false positive IS proposed — it is a proposer');
    // The mask covers the matched value even here — it has to, because
    // nothing knows yet that this one is a false positive. What makes it
    // judgeable is everything AROUND it: the assignment, the backticks that
    // say it is being quoted rather than run, and the first four characters
    // the mask leaves. That is the difference between a list a person can
    // clear in a glance and one they have to guess at.
    const context = scan.candidates[0]!.contexts[0]!;
    assert.match(context, /secret = cryp/, 'the assignment itself has to be visible');
    assert.match(context, /is the point/, 'and the words around it, which are what decide it');
  } finally { f.dispose(); }
});

test('a session with nothing credential-shaped is a measured zero, not a promise', () => {
  const f = fixture();
  try {
    f.write([say('user', 'hello there, nothing to see', '2026-09-09T10:00:00.000Z')]);
    const scan = scanSessionSecrets(f.mirror);
    assert.deepEqual(scan.candidates, []);
    assert.equal(scan.records, 1);
    assert.equal(scan.unreadable, 0);
  } finally { f.dispose(); }
});

test('a line that will not parse is counted rather than skipped', () => {
  const f = fixture();
  try {
    f.write([say('user', 'fine', '2026-09-09T10:00:00.000Z')]);
    appendFileSync(f.mirror, '{not json at all\n');
    const scan = scanSessionSecrets(f.mirror);
    assert.equal(scan.unreadable, 1);
    assert.equal(scan.records, 2, 'the unreadable line is still a record that was walked past');
  } finally { f.dispose(); }
});

/* -------------------------------------------------------------------- *
 * 4. The copy.                                                         *
 * -------------------------------------------------------------------- */

test('a copy with nothing accepted is the mirror, byte for byte', () => {
  const f = fixture();
  try {
    f.write([
      say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z'),
      say('assistant', `and ${FAKE.github} and ${FAKE.jwt}`, '2026-09-09T10:00:01.000Z'),
    ]);
    const result = chooseRedactions(f.mirror, 'session', []);
    assert.deepEqual(
      readFileSync(result.file), readFileSync(f.mirror),
      'a file full of candidates, none of them ticked, must come out identical — this is the ' +
      'whole of "nothing is replaced by default"',
    );
    assert.equal(result.plan.replaced, 0);
  } finally { f.dispose(); }
});

test('accepting one candidate moves that value and not one other byte', () => {
  const f = fixture();
  try {
    f.write([
      say('user', `key ${FAKE.anthropic} and ${FAKE.github}`, '2026-09-09T10:00:00.000Z'),
      say('assistant', `still ${FAKE.anthropic}`, '2026-09-09T10:00:01.000Z'),
    ]);
    const original = readFileSync(f.mirror, 'utf8');
    const id = candidateId('anthropic-key', FAKE.anthropic);
    const result = chooseRedactions(f.mirror, 'session', [id]);
    const copy = readFileSync(result.file, 'utf8');

    assert.equal(copy.includes(FAKE.anthropic), false, 'the accepted value survived the copy');
    assert.equal(copy.includes(FAKE.github), true, 'an UNACCEPTED value was replaced anyway');
    assert.equal(result.plan.replaced, 2, 'both occurrences of one value are one choice');
    const placeholder = placeholderFor('anthropic-key', id);
    assert.equal(copy.split(placeholder).length - 1, 2,
      'two occurrences of one value must carry the SAME stand-in, or a reader cannot tell ' +
      'they were one value');
    assert.deepEqual(
      copy.split('\n').filter(Boolean).map((l) => JSON.parse(l)),
      original.split('\n').filter(Boolean)
        .map((l) => JSON.parse(l.split(FAKE.anthropic).join(placeholder))),
      'something other than the accepted value changed between the mirror and the copy',
    );
    assert.equal(readFileSync(f.mirror, 'utf8'), original, 'the MIRROR was altered');
  } finally { f.dispose(); }
});

test('the stand-in is unmistakably fake and names the candidate it stands for', () => {
  const id = candidateId('anthropic-key', FAKE.anthropic);
  const placeholder = placeholderFor('anthropic-key', id);
  assert.match(placeholder, /^FAKE-/, 'a reader skimming has to see it is fake first');
  assert.match(placeholder, /-NOT-A-REAL-VALUE$/, 'and has to see it even if the front is cut');
  assert.ok(placeholder.includes('anthropic-key'), 'the shape says what USED to be there');
  assert.ok(placeholder.includes(id), 'the id is what makes two occurrences visibly one value');
  assert.equal(JSON.parse(JSON.stringify(placeholder)), placeholder,
    'a stand-in that JSON escapes would change the byte length of every line it lands in');
});

/* -------------------------------------------------------------------- *
 * 5. The append — the item's hardest requirement.                       *
 * -------------------------------------------------------------------- */

test('a choice made once is applied to everything appended afterwards', () => {
  const f = fixture();
  try {
    f.write([say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z')]);
    const id = candidateId('anthropic-key', FAKE.anthropic);
    const first = chooseRedactions(f.mirror, 'session', [id]);
    const before = statSync(first.file).size;

    f.append([say('assistant', `the same ${FAKE.anthropic} again`, '2026-09-09T10:00:02.000Z')]);
    const advanced = advanceRedaction(f.mirror, 'session');
    assert.ok(advanced, 'a plan exists, so the copy has to keep up');
    assert.ok(advanced.written > 0, 'the tail was not projected — the secret is back in the copy');
    assert.equal(statSync(advanced.file).size, before + advanced.written,
      'the copy was rewritten rather than appended to');

    const copy = readFileSync(advanced.file, 'utf8');
    assert.equal(copy.includes(FAKE.anthropic), false,
      'the first tail after the choice reintroduced the value, which is the exact failure ' +
      'seq:46 names');
    assert.equal(copy.split(placeholderFor('anthropic-key', id)).length - 1, 2,
      'the value appended later got a DIFFERENT stand-in from the same value before it');
    assert.equal(advanced.plan.records, 2);
  } finally { f.dispose(); }
});

test('a session nobody chose anything for is not projected at all', () => {
  const f = fixture();
  try {
    f.write([say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z')]);
    assert.equal(advanceRedaction(f.mirror, 'session'), null,
      'the ordinary path must cost one existsSync and produce no file');
  } finally { f.dispose(); }
});

test('an interrupted projection costs the partial line and never a duplicated one', () => {
  const f = fixture();
  try {
    f.write([say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z')]);
    const id = candidateId('anthropic-key', FAKE.anthropic);
    const chosen = chooseRedactions(f.mirror, 'session', [id]);
    const good = readFileSync(chosen.file);

    // What a crash between the truncate and the write leaves: bytes past the
    // length the plan agreed the copy holds.
    appendFileSync(chosen.file, '{"half":');
    f.append([say('assistant', 'more', '2026-09-09T10:00:02.000Z')]);
    const repaired = advanceRedaction(f.mirror, 'session');
    assert.ok(repaired);
    const after = readFileSync(repaired.file);
    assert.equal(after.subarray(0, good.length).equals(good), true,
      'the repair did not rebuild what was already correct');
    assert.equal(after.toString('utf8').includes('{"half":'), false,
      'the partial line survived, so the copy is no longer valid JSONL');
    for (const line of after.toString('utf8').split('\n').filter(Boolean)) JSON.parse(line);
  } finally { f.dispose(); }
});

test('changing the choice rebuilds the copy rather than appending to it', () => {
  const f = fixture();
  try {
    f.write([say('user', `a ${FAKE.anthropic} b ${FAKE.github}`, '2026-09-09T10:00:00.000Z')]);
    const anthropic = candidateId('anthropic-key', FAKE.anthropic);
    const github = candidateId('github-token', FAKE.github);
    chooseRedactions(f.mirror, 'session', [anthropic]);
    const second = chooseRedactions(f.mirror, 'session', [github]);
    const copy = readFileSync(second.file, 'utf8');
    assert.equal(copy.includes(FAKE.anthropic), true,
      'unticking a box has to give the value back, which only a rebuild can do');
    assert.equal(copy.includes(FAKE.github), false);
    assert.deepEqual(second.plan.accepted, [github]);
  } finally { f.dispose(); }
});

test('an id that matches nothing is reported and kept, never dropped', () => {
  const f = fixture();
  try {
    f.write([say('user', 'nothing here', '2026-09-09T10:00:00.000Z')]);
    const result = chooseRedactions(f.mirror, 'session', ['deadbeef0000']);
    assert.deepEqual(result.unresolved, ['deadbeef0000']);
    assert.deepEqual(result.plan.accepted, ['deadbeef0000'],
      'a choice about a value that has not been written yet must survive until it is');
  } finally { f.dispose(); }
});

test('the plan on disk holds ids and never a value', () => {
  const f = fixture();
  try {
    f.write([say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z')]);
    const id = candidateId('anthropic-key', FAKE.anthropic);
    chooseRedactions(f.mirror, 'session', [id]);
    const raw = readFileSync(redactionPlanPath(f.mirror), 'utf8');
    assert.equal(raw.includes(FAKE.anthropic), false,
      'the plan sits unencrypted beside the copy for ever; it must not hold the secret');
    const plan = readRedactionPlan(f.mirror);
    assert.ok(plan);
    assert.deepEqual(plan.accepted, [id]);
    assert.equal(plan.shapes[id], 'anthropic-key');
  } finally { f.dispose(); }
});

test('clearing removes the derived copy and the plan, and leaves the mirror', () => {
  const f = fixture();
  try {
    f.write([say('user', `key ${FAKE.anthropic}`, '2026-09-09T10:00:00.000Z')]);
    const before = readFileSync(f.mirror);
    chooseRedactions(f.mirror, 'session', [candidateId('anthropic-key', FAKE.anthropic)]);
    assert.equal(clearRedactions(f.mirror), true);
    assert.equal(readRedactionPlan(f.mirror), null);
    assert.equal(advanceRedaction(f.mirror, 'session'), null);
    assert.equal(readFileSync(f.mirror).equals(before), true, 'the record was touched');
    assert.equal(clearRedactions(f.mirror), false, 'clearing twice is a state, not a failure');
    assert.ok(redactedCopyPath(f.mirror).endsWith('.redacted.jsonl'));
  } finally { f.dispose(); }
});
