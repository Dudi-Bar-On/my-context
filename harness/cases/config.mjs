import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = [
  'constraint', 'invariant', 'rule', 'requirement', 'standard', 'pattern', 'glossary',
  'instruction', 'non_goal', 'open_question', 'runbook', 'environment', 'known_issue',
  'adr', 'decision', 'lesson', 'tradeoff', 'assumption', 'edge_case', 'risk', 'reference',
];

const NORMATIVE = new Set([
  'constraint', 'invariant', 'rule', 'requirement', 'standard', 'pattern', 'glossary',
  'instruction', 'non_goal', 'open_question', 'runbook', 'environment', 'known_issue',
]);

// Fixture to create README.md for reference category
const referenceFixture = (ws) => {
  writeFileSync(join(ws, 'README.md'), 'Test reference content', 'utf8');
};

// One add and one list per category — 42 cases proving all 21 are enabled by default.
const perCategory = CATEGORIES.flatMap((c) => [
  {
    id: `add-${c}`,
    kind: 'cli',
    ...(c === 'reference' ? { fixture: referenceFixture } : {}),
    argv: c === 'reference'
      ? ['add', 'reference', `A ${c}`, '--file', 'README.md']
      : ['add', c, `A ${c}`, ...(NORMATIVE.has(c) ? ['--yes'] : [])],
    note: `${NORMATIVE.has(c) ? 'normative' : 'rationale'} tier`,
  },
  { id: `list-${c}`, kind: 'cli', argv: ['list', c] },
]);

export const cases = [
  ...perCategory,

  // --- profiles ---
  { id: 'profile-minimal', kind: 'cli', configPatch: { profile: 'minimal', categories: {}, budgets: {} }, argv: ['status', '--json'],
    note: 'minimal enables exactly 8 categories' },
  { id: 'profile-minimal-disabled-category', kind: 'cli', configPatch: { profile: 'minimal', categories: {}, budgets: {} },
    argv: ['add', 'runbook', 'X', '--yes'], note: 'runbook is not in minimal' },
  { id: 'profile-standard', kind: 'cli', configPatch: { profile: 'standard', categories: {}, budgets: {} }, argv: ['status', '--json'] },
  { id: 'profile-full-refused', kind: 'cli', configPatch: { profile: 'full', categories: {}, budgets: {} }, argv: ['status'],
    note: 'README 2864: full was removed and is refused by name' },
  { id: 'profile-unknown-refused', kind: 'cli', configPatch: { profile: 'nope', categories: {}, budgets: {} }, argv: ['status'] },

  // --- budgets ---
  { id: 'budgets-defaults', kind: 'cli', argv: ['status', '--json'],
    note: 'pinned 6000, jit 6000, restored 8000, index 1200' },
  { id: 'budgets-override', kind: 'cli',
    configPatch: { profile: 'standard', categories: {}, budgets: { pinned: 100, jit: 100, restored: 100, index: 50 } },
    argv: ['status'] },
  { id: 'budgets-unknown-key-refused', kind: 'cli', configPatch: { profile: 'standard', categories: {}, budgets: { nope: 1 } },
    argv: ['status'] },
  { id: 'budgets-negative-refused', kind: 'cli', configPatch: { profile: 'standard', categories: {}, budgets: { pinned: -1 } },
    argv: ['status'] },
  { id: 'budgets-non-number-refused', kind: 'cli', configPatch: { profile: 'standard', categories: {}, budgets: { pinned: 'lots' } },
    argv: ['status'] },
  { id: 'budgets-spill-note', kind: 'hook', hook: 'sessionStart',
    configPatch: { profile: 'standard', categories: {}, budgets: { pinned: 50, jit: 6000, restored: 8000, index: 1200 } },
    setup: [['add', 'constraint', 'A very long constraint title that will not fit the budget',
             '--body', 'x'.repeat(4000), '--yes']],
    payload: { session_id: 's1', source: 'startup' },
    note: 'demonstrates non-pinned item is unaffected by pinned budget and lands in index tier' },
  { id: 'budgets-spill-pinned', kind: 'hook', hook: 'sessionStart',
    configPatch: { profile: 'standard', categories: {}, budgets: { pinned: 40, jit: 6000, restored: 8000, index: 1200 } },
    setup: [
      ['add', 'constraint', 'First long constraint', '--body', 'x'.repeat(3000), '--yes'],
      ['pin', 'CONST-first-long-constraint', '--yes'],
      ['add', 'constraint', 'Second long constraint', '--body', 'y'.repeat(3000), '--yes'],
      ['pin', 'CONST-second-long-constraint', '--yes'],
    ],
    payload: { session_id: 's1', source: 'startup' },
    note: 'two pinned items far exceeding a 40-token pinned budget — the excluded one must be NAMED, per INV-nothing-is-dropped-silently' },
  { id: 'budgets-index-overflow', kind: 'hook', hook: 'sessionStart',
    configPatch: { profile: 'standard', categories: {}, budgets: { pinned: 6000, jit: 6000, restored: 8000, index: 60 } },
    setup: [
      ['add', 'constraint', 'Alpha constraint', '--yes'],
      ['add', 'constraint', 'Bravo constraint', '--yes'],
      ['add', 'constraint', 'Charlie constraint', '--yes'],
      ['add', 'rule', 'Delta rule', '--yes'],
      ['add', 'invariant', 'Echo invariant', '--yes'],
    ],
    payload: { session_id: 's1', source: 'startup' },
    note: 'five normative items against a 60-token index budget — the overflow line should say how many more' },

  // --- top-level keys ---
  { id: 'unknown-top-level-key-refused', kind: 'cli', configPatch: { budget: {} }, argv: ['status'],
    note: 'README 3905: refused by name, nothing loads' },
  { id: 'watched-docs-override', kind: 'hook', hook: 'postToolUse',
    configPatch: { profile: 'standard', categories: {}, budgets: {}, watchedDocs: ['notes/**'] },
    payload: { session_id: 's1', tool_name: 'Write', tool_input: { file_path: 'notes/x.md' },
               tool_response: { success: true } },
    note: 'README 3994: watchedDocs replaces the defaults' },
  { id: 'watched-docs-override-hides-default', kind: 'hook', hook: 'postToolUse',
    configPatch: { profile: 'standard', categories: {}, budgets: {}, watchedDocs: ['notes/**'] },
    payload: { session_id: 's1', tool_name: 'Write',
               tool_input: { file_path: 'docs/superpowers/specs/x.md' },
               tool_response: { success: true } } },

  // --- per-category overrides ---
  { id: 'category-disabled', kind: 'cli', configPatch: { profile: 'standard', categories: { runbook: { enabled: false } }, budgets: {} },
    argv: ['add', 'runbook', 'X', '--yes'] },
  { id: 'category-prefix-override', kind: 'cli',
    configPatch: { profile: 'standard', categories: { rule: { prefix: 'POLICY' } }, budgets: {} },
    argv: ['add', 'rule', 'Write the failing test first', '--yes'],
    note: 'README 3625: mints POLICY-...' },
  { id: 'category-prefix-invalid', kind: 'cli',
    configPatch: { profile: 'standard', categories: { rule: { prefix: 'not-valid!' } }, budgets: {} }, argv: ['status'] },
  { id: 'category-tier-override', kind: 'cli',
    configPatch: { profile: 'standard', categories: { decision: { tier: 'normative' } }, budgets: {} }, argv: ['status', '--json'] },
  { id: 'category-agentEdits-allow', kind: 'cli',
    configPatch: { profile: 'standard', categories: { constraint: { agentEdits: 'allow' } }, budgets: {} }, argv: ['status'] },
  { id: 'category-agentEdits-invalid', kind: 'cli',
    configPatch: { profile: 'standard', categories: { constraint: { agentEdits: 'nope' } }, budgets: {} }, argv: ['status'] },
  { id: 'category-scopePolicy-required', kind: 'cli',
    configPatch: { profile: 'standard', categories: { constraint: { scopePolicy: 'required' } }, budgets: {} },
    argv: ['add', 'constraint', 'No scope given', '--yes'],
    note: 'README 3866: required refuses at capture' },
  { id: 'category-scopePolicy-inert', kind: 'cli',
    configPatch: { profile: 'standard', categories: { constraint: { scopePolicy: 'inert' } }, budgets: {} }, argv: ['doctor'] },
  { id: 'category-extraFields-refused', kind: 'cli',
    configPatch: { profile: 'standard', categories: { rule: { extraFields: ['x'] } }, budgets: {} }, argv: ['status'],
    note: 'README 3640: refused by name with a dedicated hint' },
  { id: 'category-unknown-key-refused', kind: 'cli',
    configPatch: { profile: 'standard', categories: { rule: { nope: 1 } }, budgets: {} }, argv: ['status'] },
  { id: 'custom-category-complete', kind: 'cli',
    configPatch: { profile: 'standard', categories: { security_control: { tier: 'normative', description: 'A control' } }, budgets: {} },
    argv: ['add', 'security_control', 'All admin endpoints require MFA', '--yes'],
    note: 'README 3616: derived prefix should be SECURI' },
  { id: 'custom-category-missing-tier', kind: 'cli',
    configPatch: { profile: 'standard', categories: { security_control: { description: 'A control' } }, budgets: {} }, argv: ['status'] },
  { id: 'custom-category-missing-description', kind: 'cli',
    configPatch: { profile: 'standard', categories: { security_control: { tier: 'normative' } }, budgets: {} }, argv: ['status'] },
  { id: 'unknown-category-still-indexed', kind: 'cli',
    setup: [['add', 'runbook', 'A runbook', '--yes']],
    configPatch: { profile: 'standard', categories: { runbook: { enabled: false } }, budgets: {} },
    argv: ['doctor'], note: 'README 3699: one unknown_category warning per item' },
];
