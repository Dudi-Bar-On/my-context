import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Written into each workspace by the setup step below.
export const FIXTURE_NAME = 'prd.md';
export const FIXTURE_BODY = [
  '# Bookstore API PRD',
  '',
  '## Rate limits',
  '',
  'Every client is capped at 100 requests per minute. Exceeding the cap returns 429.',
  '',
  '## Identifiers',
  '',
  'An ISBN is unique per tenant, not globally.',
  '',
].join('\n');

export function writeFixture(ws) {
  writeFileSync(join(ws, FIXTURE_NAME), FIXTURE_BODY, 'utf8');
}

// Valid ingest candidate for rate-limits section
// Verbatim quote is critical: checked by exact match after whitespace collapsing
const INGEST_CANDIDATE_VALID = {
  type: 'constraint',
  title: 'Clients are rate-limited to 100 requests per minute.',
  body: 'The system enforces a per-client rate limit of 100 requests per minute to prevent overload and ensure fair resource allocation. Clients that exceed this limit receive a 429 response.',
  quote: 'Every client is capped at 100 requests per minute. Exceeding the cap returns 429.',
  severity: 'hard',
  scope: [],
  tags: [],
  observations: [],
};

// Paraphrase instead of verbatim quote - should be rejected
const INGEST_CANDIDATE_PARAPHRASE = {
  type: 'constraint',
  title: 'Rate limit is 100 requests per minute.',
  body: 'Clients are limited to 100 requests per minute, returning 429 when exceeded.',
  quote: 'Clients are limited to 100 requests per minute and get a 429 response if they exceed it.',
  severity: 'hard',
  scope: [],
  tags: [],
  observations: [],
};

export function writeCandidatesJson(ws, candidates) {
  writeFileSync(join(ws, 'candidates.json'), JSON.stringify(candidates), 'utf8');
}

export function writeCandidatesValidFile(ws) {
  writeCandidatesJson(ws, [INGEST_CANDIDATE_VALID]);
}

export function writeCandidatesParaphraseFile(ws) {
  writeCandidatesJson(ws, [INGEST_CANDIDATE_PARAPHRASE]);
}

export function writeEmptyCandidatesFile(ws) {
  writeCandidatesJson(ws, []);
}

// Valid rule candidates for the retry lesson
const LESSON_RULE_CANDIDATE = {
  title: 'Use exponential backoff with jitter in retry logic.',
  directive: 'do',
  body: 'Synchronized retries from many clients on fixed intervals can overwhelm a recovering service. Exponential backoff combined with jitter desynchronizes retries and allows breathing room for recovery.',
  scope: [],
  severity: 'soft',
};

export function writeRuleCandidatesFile(ws, candidates) {
  writeFileSync(join(ws, 'rule-candidates.json'), JSON.stringify(candidates), 'utf8');
}

export function writeRuleCandidatesValidFile(ws) {
  writeRuleCandidatesFile(ws, [LESSON_RULE_CANDIDATE]);
}

// Composite fixtures for cases that need both prd.md and candidate files
export function writeFixtureAndCandidatesValid(ws) {
  writeFixture(ws);
  writeCandidatesValidFile(ws);
}

export function writeFixtureAndCandidatesParaphrase(ws) {
  writeFixture(ws);
  writeCandidatesParaphraseFile(ws);
}

export function writeFixtureAndEmptyCandidates(ws) {
  writeFixture(ws);
  writeEmptyCandidatesFile(ws);
}

export function writeFixtureAndRuleCandidates(ws) {
  writeFixture(ws);
  writeRuleCandidatesValidFile(ws);
}

const LESSON = ['lesson', 'Retry storms need jitter, we learned that the hard way'];
const LESSON_ID = 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way';

// Deterministic session ID from ingest run with FIXTURE_BODY
const INGEST_SESSION_ID = 'ING-prd-md-6e412141-0e7d24f1';

export const cases = [
  // --- ingest: guards ---
  { id: 'ingest-missing-path', kind: 'cli', argv: ['ingest', 'nosuchfile.md'] },
  { id: 'ingest-no-args', kind: 'cli', argv: ['ingest'] },
  { id: 'ingest-status-empty', kind: 'cli', argv: ['ingest-status'] },
  { id: 'ingest-status-full', kind: 'cli', argv: ['ingest-status', '--full'] },
  { id: 'ingest-status-json', kind: 'cli', argv: ['ingest-status', '--json'] },
  { id: 'ingest-status-unknown-flag', kind: 'cli', argv: ['ingest-status', '--nope'] },
  { id: 'ingest-apply-missing-anchor', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--stdin'], note: '--anchor is required' },
  { id: 'ingest-apply-missing-payload', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--anchor', 'rate-limits'],
    note: 'exactly one of --file / --stdin required; uses nonexistent ID to test guard' },
  { id: 'ingest-apply-both-payloads', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--anchor', 'rate-limits', '--stdin', '--file', 'x.json'] },

  // --- lesson: guards ---
  { id: 'lesson-record', kind: 'cli', argv: [...LESSON] },
  { id: 'lesson-existing-id-is-noop', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson', LESSON_ID],
    note: 'README 453: prints "already recorded — nothing was written by this call"' },
  { id: 'lesson-stage-missing-payload', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-stage', LESSON_ID] },
  { id: 'lesson-stage-missing-id', kind: 'cli', argv: ['lesson-stage', 'LESSON-nope', '--stdin'],
    note: 'nonexistent lesson ID; tests guard, not pipeline' },
  { id: 'lesson-accept-missing-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-accept', LESSON_ID] },
  { id: 'lesson-accept-unknown-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-accept', LESSON_ID, 'deadbeef'] },
  { id: 'lesson-discard-unknown-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-discard', LESSON_ID, 'deadbeef'] },
];

// --- ingest with fixtures: protocol envelope testing ---
cases.push(
  { id: 'ingest-first-chunk', kind: 'cli', fixture: writeFixture, argv: ['ingest', FIXTURE_NAME],
    note: 'emits my_context/extraction-request@1 for the first pending section' },
  { id: 'ingest-anchor-rerequest', kind: 'cli', fixture: writeFixture,
    argv: ['ingest', FIXTURE_NAME, '--anchor', 'rate-limits'] },
  { id: 'ingest-status-after-open', kind: 'cli', fixture: writeFixture,
    setup: [['ingest', FIXTURE_NAME]], argv: ['ingest-status', '--full'] },
);

// --- ingest-apply: real two-call protocol ---
cases.push(
  { id: 'ingest-apply-real-session', kind: 'cli', fixture: writeFixtureAndCandidatesValid,
    setup: [['ingest', FIXTURE_NAME]], argv: ['ingest-apply', INGEST_SESSION_ID, '--anchor', 'rate-limits', '--file', 'candidates.json'],
    note: 'tests the two-call protocol: ingest opens session, apply submits candidates for extraction' },
  { id: 'ingest-apply-real-session-readback', kind: 'cli', fixture: writeFixtureAndCandidatesValid,
    setup: [['ingest', FIXTURE_NAME], ['ingest-apply', INGEST_SESSION_ID, '--anchor', 'rate-limits', '--file', 'candidates.json']],
    argv: ['review', 'list', '--full'],
    note: 'readback after apply: shows that candidates land as draft items' },
  { id: 'ingest-apply-paraphrase-rejected', kind: 'cli', fixture: writeFixtureAndCandidatesParaphrase,
    setup: [['ingest', FIXTURE_NAME]], argv: ['ingest-apply', INGEST_SESSION_ID, '--anchor', 'rate-limits', '--file', 'candidates.json'],
    note: 'quote is a paraphrase, not verbatim; documentation says this is rejected' },
  { id: 'ingest-apply-empty-candidates', kind: 'cli', fixture: writeFixtureAndEmptyCandidates,
    setup: [['ingest', FIXTURE_NAME]], argv: ['ingest-apply', INGEST_SESSION_ID, '--anchor', 'rate-limits', '--file', 'candidates.json'],
    note: 'empty candidates array [] is correct when chunk establishes nothing normative' },
  { id: 'ingest-apply-empty-candidates-readback', kind: 'cli', fixture: writeFixtureAndEmptyCandidates,
    setup: [['ingest', FIXTURE_NAME], ['ingest-apply', INGEST_SESSION_ID, '--anchor', 'rate-limits', '--file', 'candidates.json']],
    argv: ['ingest-status', '--full'],
    note: 'readback: ingest-status should show rate-limits marked applied even with no items' },
);

// --- lesson-stage: real two-call protocol ---
cases.push(
  { id: 'lesson-stage-real-payload', kind: 'cli', fixture: writeRuleCandidatesValidFile,
    setup: [[...LESSON]], argv: ['lesson-stage', LESSON_ID, '--file', 'rule-candidates.json'],
    note: 'stages rule candidates for human review; emits my_context/lesson-staging@1 with keys' },
);
