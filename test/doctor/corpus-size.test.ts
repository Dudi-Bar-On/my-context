import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCorpusSize, FALLBACK_CEILING_WARN_ITEMS } from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';

function fakeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `CONST-i${i}` } as unknown as Item));
}

test('below the trigger band: silent', () => {
  assert.deepEqual(checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS - 1)), []);
});

test('at the trigger band: one warn naming the measured ceiling and its condition', () => {
  const findings = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].code, 'corpus_size_fallback_ceiling');
  assert.match(findings[0].message, /9,903 ms/);
  assert.match(findings[0].message, /10,000 items/);
  assert.match(findings[0].message, /cold/);
});

test('the warning names the consequence honestly: a killed fallback is a disclosed miss, not "degraded performance"', () => {
  const [finding] = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS));
  assert.match(finding.message, /killed/);
  assert.match(finding.message, /disclosed\s+miss/);
});

test('well past the band: still exactly one warn, reporting the actual count', () => {
  const findings = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS + 4321));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, new RegExp(String(FALLBACK_CEILING_WARN_ITEMS + 4321)));
});
