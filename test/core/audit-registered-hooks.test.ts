/**
 * **`REGISTERED_HOOK_OPS` against `hooks/hooks.json` and against the closed
 * op vocabulary** (`TASK-the-audit-stream-does-not-show-every-hook-that-is-
 * registered`, hooks/31).
 *
 * The table exists to answer "has this REGISTERED hook ever fired", and that
 * answer is only trustworthy if the table's KEYS are exactly the events
 * `hooks/hooks.json` registers and its VALUES are exactly the ops a hook can
 * write — checked here in both directions so a manifest change or a new op
 * that forgets this table fails a test rather than drifting silently, the
 * fate `core/audit.ts`'s own docblock on the table names for the sibling
 * vocabulary this project already shipped without one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_OPS, HOOK_OPS, INJECTION_OPS, REGISTERED_HOOK_OPS, type AuditOp,
} from '../../src/core/audit.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function manifestEvents(): string[] {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')) as {
    hooks: Record<string, unknown>;
  };
  return Object.keys(raw.hooks);
}

test('every REGISTERED_HOOK_OPS key is an event hooks.json registers, and every registered event has a key', () => {
  const registered = new Set(manifestEvents());
  const keyed = new Set(Object.keys(REGISTERED_HOOK_OPS));
  for (const event of keyed) {
    assert.ok(registered.has(event),
      `REGISTERED_HOOK_OPS names "${event}", which hooks/hooks.json does not register`);
  }
  for (const event of registered) {
    assert.ok(keyed.has(event),
      `hooks/hooks.json registers "${event}", which REGISTERED_HOOK_OPS does not account for — a ` +
      'hook the manifest lists but this table forgets is invisible to the registered-vs-seen panel');
  }
});

test('every op REGISTERED_HOOK_OPS lists is a member of AUDIT_OPS', () => {
  for (const [event, ops] of Object.entries(REGISTERED_HOOK_OPS)) {
    for (const op of ops) {
      assert.ok((AUDIT_OPS as string[]).includes(op),
        `REGISTERED_HOOK_OPS["${event}"] lists "${op}", which AUDIT_OPS does not contain`);
    }
  }
});

test('the union of every op listed is exactly HOOK_OPS plus INJECTION_OPS minus "manual"', () => {
  const expected = new Set<AuditOp>([
    ...HOOK_OPS, ...INJECTION_OPS.filter((op) => op !== 'manual'),
  ]);
  const actual = new Set<AuditOp>(Object.values(REGISTERED_HOOK_OPS).flat());
  for (const op of expected) {
    assert.ok(actual.has(op), `"${op}" is written by a registered hook but no key lists it`);
  }
  for (const op of actual) {
    assert.ok(expected.has(op),
      `REGISTERED_HOOK_OPS lists "${op}", which is neither a HOOK_OPS nor a non-manual ` +
      'INJECTION_OPS member — either it is misclassified here or the vocabulary moved');
  }
  assert.equal(actual.size, expected.size, 'the two sets differ in size despite matching elementwise');
});

test('no op is listed under two different hooks', () => {
  const owner = new Map<AuditOp, string>();
  for (const [event, ops] of Object.entries(REGISTERED_HOOK_OPS)) {
    for (const op of ops) {
      const already = owner.get(op);
      assert.equal(already, undefined,
        `"${op}" is listed under both "${already}" and "${event}" — an op is written by exactly ` +
        'one hook, and a reader joining "seen" counts back to a hook would double-count it');
      owner.set(op, event);
    }
  }
});

test('"manual" is not attributed to any registered hook', () => {
  for (const [event, ops] of Object.entries(REGISTERED_HOOK_OPS)) {
    assert.ok(!ops.includes('manual' as AuditOp),
      `"${event}" lists "manual", which core/inject.ts writes with no "hook" field at all — it is ` +
      'the load_context MCP tool, not a hooks.json registration');
  }
});
