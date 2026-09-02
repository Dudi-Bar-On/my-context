import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SEED = ['add', 'constraint', 'Pool capped at 20', '--yes'];
const ID = 'CONST-pool-capped-at-20';
const SEED2 = ['add', 'constraint', 'Pool capped at 50', '--yes'];
const ID2 = 'CONST-pool-capped-at-50';
const seed = [SEED];
const seedTwo = [SEED, SEED2];

// Fixture to write ROADMAP.md in the workspace so reference --file works
const writeDoc = (ws) =>
  writeFileSync(join(ws, 'ROADMAP.md'), '# Roadmap\n\nDates move; ordering is what matters.\n', 'utf8');

// PostFixture to modify ROADMAP.md so refresh has something to do
const editDoc = (ws) =>
  writeFileSync(join(ws, 'ROADMAP.md'), '# Roadmap\n\nCompletely different content now.\n', 'utf8');

// Fixture to write an item with incorrect checksum so repair has something to do
const writeBadChecksum = (ws) => {
  const itemContent = `---
id: CONST-broken-checksum
type: constraint
title: Broken checksum
status: active
severity: soft
always: false
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-17
valid_until: null
checksum: ffffffffffffffff
---

# Broken checksum

This item has an intentionally wrong checksum.
`;
  const dir = join(ws, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  const itemPath = join(dir, 'CONST-broken-checksum.md');
  writeFileSync(itemPath, itemContent, 'utf8');
};

// Fixture to write a draft item so review promote can work
const writeDraftItem = (ws) => {
  const itemContent = `---
id: CONST-draft-item
type: constraint
title: Draft item
status: draft
severity: soft
always: false
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-17
valid_until: null
checksum: 5d41402abc4b2a76b9719d911017c592
---

# Draft item

This item is in draft status pending review.
`;
  const dir = join(ws, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  const itemPath = join(dir, 'CONST-draft-item.md');
  writeFileSync(itemPath, itemContent, 'utf8');
};

export const cases = [
  // --- edit ---
  { id: 'edit-title', kind: 'cli', setup: seed, argv: ['edit', ID, '--title', 'New title', '--yes'] },
  { id: 'edit-title-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--title', 'New title', '--yes']], argv: ['show', ID] },
  { id: 'edit-body', kind: 'cli', setup: seed, argv: ['edit', ID, '--body', 'New body', '--yes'] },
  { id: 'edit-body-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--body', 'New body', '--yes']], argv: ['show', ID] },
  { id: 'edit-scope', kind: 'cli', setup: seed, argv: ['edit', ID, '--scope', 'src/db/**', '--yes'] },
  { id: 'edit-scope-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--scope', 'src/db/**', '--yes']], argv: ['show', ID] },
  { id: 'edit-tags', kind: 'cli', setup: seed, argv: ['edit', ID, '--tags', 'db,pool', '--yes'] },
  { id: 'edit-tags-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--tags', 'db,pool', '--yes']], argv: ['show', ID] },
  { id: 'edit-severity', kind: 'cli', setup: seed, argv: ['edit', ID, '--severity', 'hard', '--yes'] },
  { id: 'edit-severity-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--severity', 'hard', '--yes']], argv: ['show', ID] },
  { id: 'edit-status-validated', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--status', 'validated', '--yes'] },
  { id: 'edit-status-validated-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--status', 'validated', '--yes']], argv: ['show', ID] },
  { id: 'edit-status-superseded-refused', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--status', 'superseded', '--yes'],
    note: 'edit.ts:519 explicitly refuses superseded' },
  { id: 'edit-always-true', kind: 'cli', setup: seed, argv: ['edit', ID, '--always', '--yes'] },
  { id: 'edit-always-true-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--always', '--yes']], argv: ['show', ID] },
  { id: 'edit-always-false', kind: 'cli', setup: seed, argv: ['edit', ID, '--always=false', '--yes'] },
  { id: 'edit-always-false-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--always=false', '--yes']], argv: ['show', ID] },
  { id: 'edit-extra-repeated', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--extra', 'kind=perf', '--extra', 'impact=high', '--yes'] },
  { id: 'edit-extra-repeated-readback', kind: 'cli', setup: [...seed, ['edit', ID, '--extra', 'kind=perf', '--extra', 'impact=high', '--yes']], argv: ['show', ID] },
  { id: 'edit-unlink-two-words', kind: 'cli', setup: seedTwo,
    argv: ['edit', ID, '--unlink', 'relates_to', ID2, '--yes'] },
  { id: 'edit-unlink-equals-refused', kind: 'cli', setup: seed,
    argv: ['edit', ID, `--unlink=relates_to`, '--yes'],
    note: 'the --unlink= form is refused; it takes two words' },
  { id: 'edit-no-yes-declines', kind: 'cli', setup: seed, argv: ['edit', ID, '--title', 'X'],
    note: 'non-TTY without --yes must refuse, not proceed' },
  { id: 'edit-unknown-flag', kind: 'cli', setup: seed, argv: ['edit', ID, '--nope', '--yes'] },
  { id: 'edit-missing-id', kind: 'cli', argv: ['edit', 'CONST-nope', '--title', 'X', '--yes'] },

  // --- named entry points (all equal edit with one field) ---
  { id: 'pin', kind: 'cli', setup: seed, argv: ['pin', ID, '--yes'] },
  { id: 'pin-readback', kind: 'cli', setup: [...seed, ['pin', ID, '--yes']], argv: ['show', ID] },
  { id: 'pin-no-yes-declines', kind: 'cli', setup: seed, argv: ['pin', ID],
    note: 'pin without --yes in non-TTY must refuse' },
  { id: 'unpin-from-pinned', kind: 'cli',
    setup: [SEED, ['pin', ID, '--yes']],
    argv: ['unpin', ID, '--yes'],
    note: 'unpin against an item that IS pinned — exercises the real write path' },
  { id: 'unpin-from-pinned-readback', kind: 'cli',
    setup: [SEED, ['pin', ID, '--yes'], ['unpin', ID, '--yes']],
    argv: ['show', ID],
    note: 'always must be false after a genuine unpin' },
  { id: 'unpin-no-yes-declines', kind: 'cli', setup: seed, argv: ['unpin', ID],
    note: 'unpin without --yes in non-TTY must refuse' },
  { id: 'unpin-from-pinned-no-yes', kind: 'cli',
    setup: [SEED, ['pin', ID, '--yes']],
    argv: ['unpin', ID],
    note: 'unpin with real work pending and no --yes — does it gate like pin does?' },
  { id: 'harden', kind: 'cli', setup: seed, argv: ['harden', ID, '--yes'] },
  { id: 'harden-readback', kind: 'cli', setup: [...seed, ['harden', ID, '--yes']], argv: ['show', ID] },
  { id: 'harden-no-yes-declines', kind: 'cli', setup: seed, argv: ['harden', ID],
    note: 'harden without --yes in non-TTY must refuse' },
  { id: 'soften-from-hard', kind: 'cli',
    setup: [SEED, ['harden', ID, '--yes']],
    argv: ['soften', ID, '--yes'],
    note: 'soften against a hard item — exercises the real write path' },
  { id: 'soften-from-hard-readback', kind: 'cli',
    setup: [SEED, ['harden', ID, '--yes'], ['soften', ID, '--yes']],
    argv: ['show', ID],
    note: 'severity must be soft after a genuine soften' },
  { id: 'soften-no-yes-declines', kind: 'cli', setup: seed, argv: ['soften', ID],
    note: 'soften without --yes in non-TTY must refuse' },
  { id: 'soften-from-hard-no-yes', kind: 'cli',
    setup: [SEED, ['harden', ID, '--yes']],
    argv: ['soften', ID],
    note: 'soften with real work pending and no --yes — does it gate like harden does?' },
  { id: 'pin-rejects-other-flags', kind: 'cli', setup: seed,
    argv: ['pin', ID, '--severity', 'hard', '--yes'],
    note: 'NAMED_ALLOWED is [yes] only' },
  { id: 'pin-on-rationale-reference', kind: 'cli',
    fixture: writeDoc,
    setup: [['add', 'reference', 'Roadmap', '--file', 'ROADMAP.md']],
    argv: ['pin', 'REF-roadmap', '--yes'],
    note: 'reference route requires a real file; fixture provides ROADMAP.md' },

  // --- supersede ---
  { id: 'supersede-ok', kind: 'cli', setup: seedTwo, argv: ['supersede', ID, '--by', ID2, '--yes'] },
  { id: 'supersede-ok-readback-retiring', kind: 'cli', setup: [...seedTwo, ['supersede', ID, '--by', ID2, '--yes']], argv: ['show', ID] },
  { id: 'supersede-ok-readback-replacement', kind: 'cli', setup: [...seedTwo, ['supersede', ID, '--by', ID2, '--yes']], argv: ['show', ID2] },
  { id: 'supersede-with-reason', kind: 'cli', setup: seedTwo,
    argv: ['supersede', ID, '--by', ID2, '--reason', 'raised the cap', '--yes'] },
  { id: 'supersede-missing-by', kind: 'cli', setup: seed, argv: ['supersede', ID, '--yes'],
    note: '--by is required' },
  { id: 'supersede-unknown-flag', kind: 'cli', setup: seedTwo,
    argv: ['supersede', ID, '--by', ID2, '--nope', '--yes'] },
  { id: 'supersede-no-yes-declines', kind: 'cli', setup: seedTwo, argv: ['supersede', ID, '--by', ID2],
    note: 'supersede without --yes in non-TTY must refuse' },

  // --- refresh / repair ---
  { id: 'refresh-reference', kind: 'cli',
    fixture: writeDoc,
    setup: [['add', 'reference', 'Roadmap', '--file', 'ROADMAP.md']],
    argv: ['refresh', 'REF-roadmap', '--yes'],
    note: 'reference route requires a real file; fixture provides ROADMAP.md' },
  { id: 'refresh-non-snapshot-refused', kind: 'cli', setup: seed, argv: ['refresh', ID, '--yes'],
    note: 'refuses items that are not file snapshots' },
  { id: 'refresh-no-yes-declines', kind: 'cli',
    fixture: writeDoc,
    setup: [['add', 'reference', 'Roadmap', '--file', 'ROADMAP.md']],
    argv: ['refresh', 'REF-roadmap'],
    note: 'refresh without --yes in non-TTY must refuse' },
  { id: 'refresh-drifted-no-yes', kind: 'cli',
    fixture: writeDoc,
    setup: [['add', 'reference', 'Roadmap', '--file', 'ROADMAP.md']],
    postFixture: editDoc,
    argv: ['refresh', 'REF-roadmap'],
    note: 'source file changed after snapshot, no --yes — does refresh gate?' },
  { id: 'refresh-drifted-readback', kind: 'cli',
    fixture: writeDoc,
    setup: [['add', 'reference', 'Roadmap', '--file', 'ROADMAP.md']],
    postFixture: editDoc,
    argv: ['doctor'],
    note: 'doctor should raise source_drift when the snapshot no longer matches the file' },
  { id: 'repair-without-yes-lists-only', kind: 'cli',
    fixture: writeBadChecksum,
    setup: [],
    argv: ['repair'],
    note: 'lists items needing repair but changes nothing' },
  { id: 'repair-with-yes', kind: 'cli',
    fixture: writeBadChecksum,
    setup: [],
    argv: ['repair', '--yes'],
    note: 'actually re-stamps items with correct checksums' },
  { id: 'repair-with-yes-readback', kind: 'cli',
    fixture: writeBadChecksum,
    setup: [['repair', '--yes']],
    argv: ['show', 'CONST-broken-checksum'],
    note: 'checksum should be corrected after repair' },
  { id: 'repair-unknown-flag', kind: 'cli', argv: ['repair', '--nope'] },

  // --- review family: per-subcommand flags ---
  { id: 'review-list-default', kind: 'cli', argv: ['review'] },
  { id: 'review-list-explicit', kind: 'cli', argv: ['review', 'list'] },
  { id: 'review-list-full', kind: 'cli', argv: ['review', 'list', '--full'] },
  { id: 'review-list-json', kind: 'cli', argv: ['review', 'list', '--json'] },
  { id: 'review-list-type', kind: 'cli', argv: ['review', 'list', '--type', 'constraint'] },
  { id: 'review-list-unknown-flag', kind: 'cli', argv: ['review', 'list', '--nope'] },
  { id: 'review-show-missing', kind: 'cli', argv: ['review', 'show', 'CONST-nope'] },
  { id: 'review-promote-missing', kind: 'cli', argv: ['review', 'promote', 'CONST-nope', '--yes'] },
  { id: 'review-promote-flags', kind: 'cli',
    fixture: writeDraftItem,
    setup: [],
    argv: ['review', 'promote', 'CONST-draft-item', '--scope', 'src/**', '--severity', 'hard', '--always', '--yes'],
    note: 'promote a draft item with scope/severity/always flags' },
  { id: 'review-promote-flags-readback', kind: 'cli',
    fixture: writeDraftItem,
    setup: [['review', 'promote', 'CONST-draft-item', '--scope', 'src/**', '--severity', 'hard', '--always', '--yes']],
    argv: ['show', 'CONST-draft-item'],
    note: 'verify scope/severity/always were actually applied' },
  { id: 'review-discard-missing', kind: 'cli', argv: ['review', 'discard', 'CONST-nope', '--yes'] },
  { id: 'review-revisions', kind: 'cli', setup: seed, argv: ['review', 'revisions'] },
  { id: 'review-revisions-full', kind: 'cli', setup: seed, argv: ['review', 'revisions', '--full'] },
  { id: 'review-promote-revision-missing', kind: 'cli', setup: seed,
    argv: ['review', 'promote-revision', ID, '--yes'] },
  { id: 'review-promote-revision-force', kind: 'cli', setup: seed,
    argv: ['review', 'promote-revision', ID, '--force', '--yes'] },
  { id: 'review-discard-revision-reason', kind: 'cli', setup: seed,
    argv: ['review', 'discard-revision', ID, '--reason', 'superseded', '--yes'] },
  { id: 'review-unknown-subcommand', kind: 'cli', argv: ['review', 'nosuchsub'] },
];
