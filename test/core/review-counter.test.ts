// @basis TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// INV-hooks-fail-open
//
// `INV-hooks-fail-open` is the one that is load-bearing here rather than
// decorative: three of the five assertions below are about a counter that
// CANNOT break `PostToolUse`, which is that invariant restated for this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  bumpCounter, readCounter, resetCounter, reviewCounterPath,
} from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

test('a fresh workspace reads zero rather than throwing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    const got = readCounter(dir);
    assert.equal(got.calls, 0);
    assert.equal(got.fires, 0);
    assert.equal(got.sessionId, null);
  } finally { removeTree(dir); }
});

test('a new session id resets the count rather than inheriting it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    bumpCounter(dir, 'session-a');
    bumpCounter(dir, 'session-a');
    assert.equal(readCounter(dir).calls, 2);
    const moved = bumpCounter(dir, 'session-b');
    assert.equal(moved.calls, 1, 'a different session starts its own count');
    assert.equal(moved.fires, 0, 'and its own fire budget');
  } finally { removeTree(dir); }
});

test('resetting clears the calls and remembers the fire', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    bumpCounter(dir, 's');
    const after = resetCounter(dir, 's');
    assert.equal(after.calls, 0);
    assert.equal(after.fires, 1, 'fires is what maxFiresPerSession is measured against');
    // And it PERSISTS: a fire budget kept only in the returned value would be
    // a budget every hook process re-derives as zero, which is no budget.
    assert.equal(readCounter(dir).fires, 1);
  } finally { removeTree(dir); }
});

test('an unreadable counter file reads as zero and does not throw', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    mkdirSync(path.dirname(reviewCounterPath(dir)), { recursive: true });
    writeFileSync(reviewCounterPath(dir), '{ not json', 'utf8');
    assert.equal(readCounter(dir).calls, 0, 'a corrupt counter must never break a hook');
    // And a bump over a corrupt file still lands, rather than propagating the
    // corruption forward for the life of the session.
    assert.equal(bumpCounter(dir, 's').calls, 1);
  } finally { removeTree(dir); }
});

test('a state root that cannot be written costs a count, never a throw', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    // `state` as a FILE is the cheapest way to make `mkdirSync` refuse on
    // every platform this ships to. The hook path must survive it.
    writeFileSync(path.join(dir, 'state'), 'not a directory', 'utf8');
    const got = bumpCounter(dir, 's');
    assert.equal(got.calls, 1, 'the in-memory answer is still correct for this call');
    assert.equal(got.written, false, 'and it SAYS the write was discarded');
    assert.equal(readCounter(dir).calls, 0, 'nothing was persisted, and that is disclosed');
  } finally { removeTree(dir); }
});
