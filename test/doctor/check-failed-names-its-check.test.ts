// @basis TASK-a-doctor-finding-that-means-a-gate-is-broken-names-no-code, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registeredCheckName, firstOwnFrame, type Finding } from '../../src/doctor/checks.ts';

/**
 * **The one finding whose meaning is "a gate is broken", and it used to be the
 * only one that could not say which gate.**
 *
 * `runChecks`' catch-all produced `a doctor check threw: <message>` — no check
 * name, no position in the registry, no frame — while the array it was
 * iterating was in scope at the throw site. Two independent reviews reached
 * that on 2026-09-12 and 2026-09-13 (row 67 of the consolidated findings).
 * Every other doctor finding says something about the CORPUS and can be traced
 * from the item it names; this one says something about the TOOL, and an
 * anonymous one costs a reader attention and buys nothing.
 *
 * The name is DERIVED from the registry entry's own source rather than read
 * from a parallel list of labels — see `registeredCheckName`'s docblock for
 * why a label list is the same defect wearing a different hat. What that buys
 * is the property asserted below: the name cannot disagree with the function
 * actually called, because it IS the call.
 */

test('a registry entry names the check it calls, read off the entry itself', () => {
  const checkCorpusSize = (): Finding[] => [];
  const entry = (): Finding[] => checkCorpusSize();
  assert.equal(registeredCheckName(entry), 'checkCorpusSize');
});

test('the name survives the argument shapes the real registry actually uses', () => {
  const opts = { root: 'r', dbPath: 'd', items: [], config: {}, repoRoot: 'rr' };
  const checkPermissions = (..._a: unknown[]): Finding[] => [];
  const checkIndexFreshness = (..._a: unknown[]): Finding[] => [];
  assert.equal(
    registeredCheckName(() => checkIndexFreshness(opts.root, opts.dbPath)),
    'checkIndexFreshness',
  );
  // Three arguments, one of them an imported symbol that is NOT the callee —
  // the entry `checkPermissions(opts.root, accessSync, opts.repoRoot)` is the
  // only one shaped like this, and a naive "last identifier" read would get
  // it wrong.
  assert.equal(
    registeredCheckName(() => checkPermissions(opts.root, Object.keys, opts.repoRoot)),
    'checkPermissions',
  );
});

test('AND IT GOES RED: an entry naming no check is reported as unnamed, not mislabelled', () => {
  // The failure this must not have is a confident wrong name. An entry whose
  // source carries no `check…` identifier gets a phrase a reader can see is
  // an absence, rather than borrowing the nearest word in the closure.
  const helper = (): Finding[] => [];
  assert.equal(registeredCheckName(() => helper()), 'an unnamed check');
});

test('the frame reported is the first one outside node internals', () => {
  const stack = [
    'Error: boom',
    '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
    '    at checkTaskUnverified (D:\\repo\\src\\doctor\\checks.ts:2500:11)',
    '    at runChecks (D:\\repo\\src\\doctor\\checks.ts:4700:24)',
  ].join('\n');
  assert.equal(firstOwnFrame(stack), 'at checkTaskUnverified (D:\\repo\\src\\doctor\\checks.ts:2500:11)');
});

test('AND IT GOES RED: a stack of nothing but internals says so rather than inventing a frame', () => {
  const stack = [
    'Error: boom',
    '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
  ].join('\n');
  assert.equal(firstOwnFrame(stack), 'no frame outside node internals');
  // And the header line is never mistaken for a frame, whatever it says.
  assert.equal(firstOwnFrame('Error: at the office'), 'no frame outside node internals');
});
