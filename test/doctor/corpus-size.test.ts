import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkCorpusSize, FALLBACK_CEILING_WARN_ITEMS, runChecks } from '../../src/doctor/checks.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function fakeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `CONST-i${i}` } as unknown as Item));
}

/** Full-shape items, so the OTHER checks runChecks runs do not trip over them. */
function fullItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i): Item => ({
    id: `CONST-i${i}`, type: 'constraint', title: `C ${i}`, status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/constraint/CONST-i${i}.md`,
  }));
}

test('the trigger is 5,000 — the low edge of the design band, not a number to drift', () => {
  // Every other test here derives from the export, so without this literal
  // pin a changed threshold would re-derive every expectation and survive.
  // 5,000 is the design's mitigation-band low edge (§6 risk 3) and the
  // largest size the warm-cache fallback was priced at (597.7 ms, M1).
  assert.equal(FALLBACK_CEILING_WARN_ITEMS, 5000);
});

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
  // The measurement's own condition, not merely the word "cold" somewhere:
  // the number is only honest with its cache state attached.
  assert.match(findings[0].message, /cold file cache/);
});

test('the warning names the consequence honestly: a killed fallback is a disclosed miss, not "degraded performance"', () => {
  const [finding] = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS));
  assert.match(finding.message, /killed/);
  assert.match(finding.message, /disclosed\s+miss/);
});

test('runChecks includes checkCorpusSize', () => {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-corpus-size-'));
  try {
    const root = path.join(repoRoot, '.my_context');
    const findings = runChecks({
      root, repoRoot, dbPath: path.join(root, '.index.db'),
      items: fullItems(FALLBACK_CEILING_WARN_ITEMS), config: resolveConfig({}),
    });
    assert.ok(
      findings.some((f) => f.code === 'corpus_size_fallback_ceiling'),
      'runChecks must include checkCorpusSize findings',
    );
  } finally {
    removeTree(repoRoot);
  }
});

test('well past the band: still exactly one warn, reporting the actual count', () => {
  const findings = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS + 4321));
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, new RegExp(String(FALLBACK_CEILING_WARN_ITEMS + 4321)));
});
