import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItem, renderItem } from '../../src/core/item.ts';

const SAMPLE = `---
id: CONST-pg-pool-cap
type: constraint
title: Postgres connection pool capped at 20
status: active
severity: hard
always: false
scope:
  - "src/db/**"
tags: [database]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-12
valid_until: null
checksum: 0000000000000000
---

# Postgres connection pool capped at 20

RDS permits 25 connections.

## Observations
- [limit] Pool size must never exceed 20 #database
- [symptom] Surfaces under load (not at startup)

## Relations
- derived_from [[ADR-sqlite-jsonb]]
- supersedes [[CONST-old-cap]]
`;

test('parses the common fields', () => {
  const item = parseItem(SAMPLE, 'items/constraint/CONST-pg-pool-cap.md', 'project');
  assert.equal(item.id, 'CONST-pg-pool-cap');
  assert.equal(item.type, 'constraint');
  assert.equal(item.status, 'active');
  assert.equal(item.always, false);
  assert.deepEqual(item.scope, ['src/db/**']);
  assert.equal(item.layer, 'project');
});

test('parses observations with category, tags and context', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(item.observations.length, 2);
  assert.equal(item.observations[0].category, 'limit');
  assert.equal(item.observations[0].text, 'Pool size must never exceed 20');
  assert.deepEqual(item.observations[0].tags, ['database']);
  assert.equal(item.observations[1].context, 'not at startup');
});

test('parses relations', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.deepEqual(item.relations, [
    { type: 'derived_from', target: 'ADR-sqlite-jsonb' },
    { type: 'supersedes', target: 'CONST-old-cap' },
  ]);
});

test('a bare wikilink relation defaults to links_to', () => {
  const text = SAMPLE.replace('- supersedes [[CONST-old-cap]]', '- [[CONST-other]]');
  const item = parseItem(text, 'x.md', 'project');
  assert.deepEqual(item.relations[1], { type: 'links_to', target: 'CONST-other' });
});

test('unknown frontmatter keys are preserved as extra fields', () => {
  const text = SAMPLE.replace('type: constraint', 'type: requirement\nkind: functional');
  const item = parseItem(text, 'x.md', 'project');
  assert.equal(item.extra.kind, 'functional');
});

test('parse then render then parse is identity', () => {
  const once = parseItem(SAMPLE, 'x.md', 'project');
  const twice = parseItem(renderItem(once), 'x.md', 'project');
  assert.deepEqual(twice, once);
});

test('render always emits LF line endings', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(renderItem(item).includes('\r'), false);
});

test('an all-digit checksum survives as a string', () => {
  const item = parseItem(SAMPLE, 'x.md', 'project');
  assert.equal(item.checksum, '0000000000000000');
  assert.equal(typeof item.checksum, 'string');
});

test('a file without frontmatter delimiters throws', () => {
  assert.throws(() => parseItem('# no frontmatter\n', 'x.md', 'project'), /frontmatter/i);
});

test('a missing required field throws naming the field', () => {
  const text = SAMPLE.replace('type: constraint\n', '');
  assert.throws(() => parseItem(text, 'x.md', 'project'), /"type"/);
});

test('an unquoted all-digit extra field preserves leading zeros', () => {
  const text = SAMPLE.replace('type: constraint', 'type: constraint\nkind: 0123');
  const item = parseItem(text, 'x.md', 'project');
  assert.equal(item.extra.kind, '0123');
});

test('an unquoted all-digit extra field survives parse then render then parse', () => {
  const text = SAMPLE.replace('type: constraint', 'type: constraint\nkind: 0123');
  const once = parseItem(text, 'x.md', 'project');
  const twice = parseItem(renderItem(once), 'x.md', 'project');
  assert.deepEqual(twice, once);
  assert.equal(twice.extra.kind, '0123');
});

test('a CRLF file parses to a body with no carriage returns', () => {
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const item = parseItem(crlf, 'x.md', 'project');
  assert.equal(item.body.includes('\r'), false);
  assert.equal(renderItem(item).includes('\r'), false);
});

test('a CRLF item survives parse then render then parse identically', () => {
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const once = parseItem(crlf, 'x.md', 'project');
  const twice = parseItem(renderItem(once), 'x.md', 'project');
  assert.deepEqual(twice, once);
});
