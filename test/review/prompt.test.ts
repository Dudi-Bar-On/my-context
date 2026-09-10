// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
//
// **The prompt is the most important file in the change and the one most
// likely to ship untested.** What is asserted here is STRUCTURE — the five
// rules are present, the order is checks before rules before lessons, the
// relevance requirement is stated, and two specific phrasings are absent. What
// is NOT asserted, and cannot be, is that the prompt produces good proposals.
// The plan says so in as many words, and the only real check is a week of
// reading what it writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewPrompt, ANTI_LEARNING, ARTIFACT_ORDER, BOUNDARY, RELEVANCE, SHAPE_CONTRACT,
} from '../../src/review/prompt.ts';
import type { PassInput } from '../../src/review/input.ts';

const empty: PassInput = {
  points: [], readTo: 0, sources: [], whole: true, skipped: [],
  readBytes: 0, records: 0, unreadable: 0, briefPoints: 0, ms: 0,
};

test('all five anti-learning rules are present', () => {
  for (const rule of ['missing binaries', 'credentials', 'transient',
    'one-off', 'unresolved failures']) {
    assert.match(ANTI_LEARNING.toLowerCase(), new RegExp(rule.split(' ')[0]!),
      `the ${rule} rule is missing — the fifth was added upstream LATER, as a scar`);
  }
  // The fifth in full, because it is the one that was added late and the one
  // whose absence is invisible: four rules read like a complete list.
  assert.match(ANTI_LEARNING, /untested sequence of\s+failures/i);
});

test('the anti-learning list states its own limit', () => {
  // §12: these rules catch carelessness, not falsehood. A prompt that listed
  // five screens and implied they were a defence against untruth would be
  // making exactly the overclaim the fifth rule forbids.
  assert.match(ANTI_LEARNING, /0 of 360/,
    'the measured limit of a write-time screen must be in the file, not only in the design');
  assert.match(ANTI_LEARNING, /carelessness/i);
});

test('the artifact order prefers a check over a rule over a lesson', () => {
  const check = ARTIFACT_ORDER.indexOf('check');
  const rule = ARTIFACT_ORDER.indexOf('rule');
  const lesson = ARTIFACT_ORDER.indexOf('lesson');
  assert.ok(check >= 0 && rule >= 0 && lesson >= 0, 'all three tiers must be named');
  assert.ok(check < rule && rule < lesson,
    'prose is the weakest artifact measured; a check is the strongest');
});

test('the artifact order asks the second question, not only the first', () => {
  assert.match(ARTIFACT_ORDER, /what did we learn/i);
  assert.match(ARTIFACT_ORDER, /can it be checked/i);
  assert.match(ARTIFACT_ORDER, /fallback/i, 'prose stops being the default; it stays a category');
});

test('the prompt never contains the sentence that trips the provider filter', () => {
  assert.doesNotMatch(reviewPrompt(empty), /save the approach as a skill so you can reuse it/i,
    'that phrasing provokes a content-filter rejection surfaced as a BILLING error');
});

test('a proposal must name its evidence', () => {
  assert.match(reviewPrompt(empty), /name what in the transcript/i);
  assert.match(RELEVANCE, /refused/i, 'evidence that does not touch the target is refused, not softened');
});

test('the prompt does not tell the pass to be active', () => {
  assert.doesNotMatch(reviewPrompt(empty), /missed learning opportunity|be active/i,
    'that framing is the named cause of upstream issue #66350 — unrelated content written into a skill');
  // The opposite is stated positively, which is the part that actually changes
  // behaviour: a pass that believes silence is failure will find something.
  assert.match(RELEVANCE, /proposing nothing is a correct outcome/i);
});

test('the shape contract forbids quoted user text, dates and ticket ids as content', () => {
  assert.match(SHAPE_CONTRACT, /no ticket ids/i);
  assert.match(SHAPE_CONTRACT, /quoted user text/i);
  assert.match(SHAPE_CONTRACT, /maximum care/i, 'the owner asked for that, in those words');
  assert.match(SHAPE_CONTRACT, /250 characters/);
});

test('the boundary says the pass never promotes', () => {
  assert.match(BOUNDARY, /draft/i);
  assert.match(BOUNDARY, /may not edit/i);
  assert.match(BOUNDARY, /the person promotes/i);
});

test('the prompt leads with coverage and discloses the dropped dispatch briefs', () => {
  const partial: PassInput = {
    ...empty,
    whole: false,
    briefPoints: 1927,
    skipped: [{ file: 'lane.jsonl', why: 'budget', bytes: 4096, readBytes: 0 }],
  };
  const text = reviewPrompt(partial);
  const coverage = text.indexOf('COVERAGE');
  assert.ok(coverage >= 0 && coverage < 200, 'coverage a reader has to scroll to is coverage nobody reads');
  assert.match(text, /NOT read whole/i);
  assert.match(text, /1927 line\(s\) in lane transcripts were dropped/);
  assert.match(text, /not ten confirmations/,
    'a rule quoted into ten dispatch briefs would otherwise look like ten independent sightings');
});
