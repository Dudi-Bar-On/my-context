const SEED = ['add', 'constraint', 'Pool capped at 20', '--scope', 'src/db/**', '--yes'];
const ID = 'CONST-pool-capped-at-20';
const seed = [SEED];

export const cases = [
  { id: 'handshake-and-list', kind: 'mcp', tool: '__list__',
    note: 'serverInfo.version is 0.1.0 while the plugin is 1.0.0 — F3' },

  // create_item
  { id: 'create_item-minimal', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Uploads capped at 10 MB' },
    note: 'normative capture by an agent must land as draft' },
  { id: 'create_item-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'We chose Stripe' }, note: 'rationale lands active' },
  { id: 'create_item-full', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Full', body: 'b', scope: ['src/**'], tags: ['t'],
            severity: 'hard', always: true,
            observations: [{ category: 'limit', text: 'o', tags: ['x'], context: 'c' }] } },
  { id: 'create_item-idempotent', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Pool capped at 20' }, setup: seed,
    note: 'README 2707: reports the existing item rather than duplicating' },
  { id: 'create_item-relations-refused', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', relations: [] },
    note: 'README 2725: refuses relations by name' },
  { id: 'create_item-origin-refused', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', origin: 'human' },
    note: 'README 4070: no tool takes origin' },
  { id: 'create_item-unknown-arg', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', nope: 1 } },
  { id: 'create_item-missing-required', kind: 'mcp', tool: 'create_item', args: { title: 'X' } },
  { id: 'create_item-hard-on-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'X', severity: 'hard' } },
  { id: 'create_item-always-on-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'X', always: true } },

  // update_item
  { id: 'update_item-title', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, title: 'New' }, note: 'may stage rather than apply under agentEdits: review' },
  { id: 'update_item-status-on-normative-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, status: 'active' }, note: 'README 2708' },
  { id: 'update_item-scope-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, scope: ['x/**'] } },
  { id: 'update_item-always-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, always: true } },
  { id: 'update_item-severity-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, severity: 'soft' } },
  { id: 'update_item-extra', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, extra: { kind: 'perf' } } },
  { id: 'update_item-missing-id', kind: 'mcp', tool: 'update_item', args: { title: 'X' } },
  { id: 'update_item-unknown-arg', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, nope: 1 } },

  // the rest
  { id: 'get_item-ok', kind: 'mcp', tool: 'get_item', setup: seed, args: { id: ID } },
  { id: 'get_item-missing', kind: 'mcp', tool: 'get_item', args: { id: 'CONST-nope' } },
  { id: 'get_item-unknown-arg', kind: 'mcp', tool: 'get_item', setup: seed,
    args: { id: ID, nope: 1 } },
  { id: 'query_items-bare', kind: 'mcp', tool: 'query_items', setup: seed, args: {} },
  { id: 'query_items-type', kind: 'mcp', tool: 'query_items', setup: seed,
    args: { type: 'constraint' } },
  { id: 'query_items-all-filters', kind: 'mcp', tool: 'query_items', setup: seed,
    args: { type: 'constraint', status: 'active', tag: 'db', text: 'pool',
            path: 'src/db/w.ts', relation: 'relates_to', limit: 5 } },
  { id: 'query_items-bad-status', kind: 'mcp', tool: 'query_items', args: { status: 'nope' } },
  { id: 'query_items-unknown-arg', kind: 'mcp', tool: 'query_items', args: { nope: 1 } },
  { id: 'list_drafts-bare', kind: 'mcp', tool: 'list_drafts', args: {} },
  { id: 'list_drafts-type-limit', kind: 'mcp', tool: 'list_drafts',
    args: { type: 'constraint', limit: 5 } },
  { id: 'load_context-bare', kind: 'mcp', tool: 'load_context', setup: seed, args: {} },
  { id: 'load_context-any-arg-refused', kind: 'mcp', tool: 'load_context', args: { limit: 1 },
    note: 'no arguments are allowed at all' },
  { id: 'link_items-ok', kind: 'mcp', tool: 'link_items',
    setup: [SEED, ['add', 'constraint', 'Pool capped at 50', '--yes']],
    args: { from: ID, to: 'CONST-pool-capped-at-50', relation: 'relates_to' } },
  { id: 'link_items-supersedes-refused', kind: 'mcp', tool: 'link_items',
    setup: [SEED, ['add', 'constraint', 'Pool capped at 50', '--yes']],
    args: { from: ID, to: 'CONST-pool-capped-at-50', relation: 'supersedes' } },
  { id: 'link_items-missing-relation', kind: 'mcp', tool: 'link_items',
    args: { from: ID, to: 'X' } },
  { id: 'supersede_item-governing-refused', kind: 'mcp', tool: 'supersede_item', setup: seed,
    args: { id: ID, by: 'CONST-nope' }, note: 'README 2710: refuses governing normative items' },
  { id: 'refresh_item-non-snapshot', kind: 'mcp', tool: 'refresh_item', setup: seed,
    args: { id: ID } },
  { id: 'audit_log-bare', kind: 'mcp', tool: 'audit_log', setup: seed, args: {} },
  { id: 'audit_log-actor', kind: 'mcp', tool: 'audit_log', setup: seed, args: { actor: 'agent' } },
  { id: 'audit_log-origin-refused', kind: 'mcp', tool: 'audit_log', args: { origin: 'agent' },
    note: 'README 2715: the argument is actor, not origin' },
  { id: 'audit_log-since-span', kind: 'mcp', tool: 'audit_log', setup: seed, args: { since: '7d' } },
  { id: 'audit_log-all-filters', kind: 'mcp', tool: 'audit_log', setup: seed,
    args: { item: ID, session: 's', op: 'create', kind: 'mutation', actor: 'human',
            since: '12h', limit: 5 } },
  { id: 'mycontext_help-categories', kind: 'mcp', tool: 'mycontext_help',
    args: { topic: 'categories' } },
  { id: 'mycontext_help-scope', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'scope' } },
  { id: 'mycontext_help-capture', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'capture' } },
  { id: 'mycontext_help-workflow', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'workflow' } },
  { id: 'mycontext_help-invalid-topic', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'query' } },
  { id: 'mycontext_examples-rule', kind: 'mcp', tool: 'mycontext_examples', args: { type: 'rule' } },
  { id: 'mycontext_examples-invalid', kind: 'mcp', tool: 'mycontext_examples',
    args: { type: 'nosuchtype' } },
  { id: 'focus_context-empty-reports-only', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: {} },
  { id: 'focus_context-tags', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { tags: ['db'] } },
  { id: 'focus_context-preview', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { tags: ['db'], preview: true } },
  { id: 'focus_context-clear', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { clear: true } },
  { id: 'focus_context-clear-with-axis-refused', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { clear: true, tags: ['db'] } },
  { id: 'ingest_document-no-args', kind: 'mcp', tool: 'ingest_document', args: {} },
  { id: 'ingest_document-session-without-anchor', kind: 'mcp', tool: 'ingest_document',
    args: { session: 'ING-nope' }, note: 'anchor and candidates required alongside session' },

  // Read-back cases: verify operations have documented effects
  // These use multi-call sequences so multiple tool calls execute in one workspace

  // 1. Agent-created constraint lands as draft (verify with list and query in same workspace)
  { id: 'create_item-constraint-readback', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'constraint', title: 'Agent Constraint Test' } },
      { tool: 'list_drafts', args: { type: 'constraint' } },
      { tool: 'query_items', args: { type: 'constraint', status: 'active' } }
    ],
    note: 'create constraint as agent (should land as draft), list_drafts shows it, query for active shows it is not active' },

  // 2. Agent-created decision lands as active (verify with query and list in same workspace)
  { id: 'create_item-decision-readback', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'decision', title: 'Agent Decision Test' } },
      { tool: 'query_items', args: { type: 'decision', status: 'active' } },
      { tool: 'list_drafts', args: { type: 'decision' } }
    ],
    note: 'create decision as agent (should land as active), query for active shows it, list_drafts shows it is not in drafts' },

  // 3. Idempotent create shows only one item (both create calls in same workspace)
  { id: 'create_item-idempotent-readback', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'constraint', title: 'Idempotent Test Item' } },
      { tool: 'create_item', args: { type: 'constraint', title: 'Idempotent Test Item' } },
      { tool: 'query_items', args: { type: 'constraint', text: 'Idempotent Test Item' } }
    ],
    note: 'create same item twice, query shows result: does second call mint a duplicate or report the existing item?' },

  // 4. update_item effect (create → update → read in same workspace)
  { id: 'update_item-title-effect', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'constraint', title: 'Original Title' } },
      { tool: 'update_item', args: { id: 'CONST-original-title', title: 'New Title' } },
      { tool: 'get_item', args: { id: 'CONST-original-title' } }
    ],
    note: 'create constraint, update title to New Title, read back to show whether title changed or staged as revision' },

  // 5. link_items effect (create two → link → read both in same workspace)
  { id: 'link_items-effect', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'constraint', title: 'Link Source' } },
      { tool: 'create_item', args: { type: 'constraint', title: 'Link Target' } },
      { tool: 'link_items', args: { from: 'CONST-link-source', to: 'CONST-link-target', relation: 'relates_to' } },
      { tool: 'get_item', args: { id: 'CONST-link-source' } },
      { tool: 'get_item', args: { id: 'CONST-link-target' } }
    ],
    note: 'create two items, link them, read both ends to show relations are recorded' },

  // 6. focus_context effect (set focus → report focus in same workspace)
  { id: 'focus_context-effect', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'constraint', title: 'Tagged Item', tags: ['focus-test'] } },
      { tool: 'focus_context', args: { tags: ['focus-test'] } },
      { tool: 'focus_context', args: {} }
    ],
    note: 'create tagged item, set focus to tag, call focus_context with no args to show the focus is reported' },

  // 7. supersede_item on rationale item (create two → supersede → read both)
  { id: 'supersede_item-rationale-effect', kind: 'mcp',
    calls: [
      { tool: 'create_item', args: { type: 'decision', title: 'Old Decision' } },
      { tool: 'create_item', args: { type: 'decision', title: 'New Decision' } },
      { tool: 'supersede_item', args: { id: 'DEC-old-decision', by: 'DEC-new-decision' } },
      { tool: 'get_item', args: { id: 'DEC-old-decision' } },
      { tool: 'get_item', args: { id: 'DEC-new-decision' } }
    ],
    note: 'create two decisions, supersede first with second, read both to show relations and status' },
];
