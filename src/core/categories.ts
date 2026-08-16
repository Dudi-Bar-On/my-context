import type { Tier } from './types.ts';

export interface CategoryDef {
  name: string;
  prefix: string;
  tier: Tier;
  defaultEnabled: boolean;
  description: string;
  extraFields: string[];
}

function def(
  name: string, prefix: string, tier: Tier, defaultEnabled: boolean,
  description: string, extraFields: string[] = [],
): CategoryDef {
  return { name, prefix, tier, defaultEnabled, description, extraFields };
}

export const CATEGORIES: Record<string, CategoryDef> = {
  constraint:    def('constraint', 'CONST', 'normative', true,
    'Non-negotiable limit: budget, stack, regulation, SLA'),
  invariant:     def('invariant', 'INV', 'normative', true,
    'Condition that must always hold during execution'),
  rule:          def('rule', 'RULE', 'normative', true,
    'A do/dont directive', ['directive']),
  requirement:   def('requirement', 'REQ', 'normative', true,
    'What must be built', ['kind']),
  standard:      def('standard', 'STD', 'normative', true,
    'Formatting, coding convention, architectural guideline'),
  pattern:       def('pattern', 'PAT', 'normative', true,
    'Reusable solution, or an anti-pattern to avoid'),
  glossary:      def('glossary', 'GLOSS', 'normative', true,
    'Ubiquitous language: the agreed term, and terms not to use'),
  instruction:   def('instruction', 'INSTR', 'normative', true,
    "Governs the agent's process, not the artifact"),
  non_goal:      def('non_goal', 'NOGOAL', 'normative', true,
    'Explicit prohibition on building something'),
  open_question: def('open_question', 'OPENQ', 'normative', true,
    'Deliberately undecided; the agent must not decide it alone', ['blocks']),
  runbook:       def('runbook', 'RUN', 'normative', true,
    'The steps for a named operation, in the order they must be taken'),
  environment:   def('environment', 'ENV', 'normative', true,
    'How the environments differ: what production does that local does not'),

  adr:           def('adr', 'ADR', 'rationale', true,
    'Formal decision record, MADR shape'),
  decision:      def('decision', 'DEC', 'rationale', true,
    'Lightweight decision not warranting a full ADR'),
  lesson:        def('lesson', 'LESSON', 'rationale', true,
    'What was learned; source material for generated rules'),
  tradeoff:      def('tradeoff', 'TRADE', 'rationale', true,
    'What was sacrificed for what'),
  assumption:    def('assumption', 'ASSUME', 'rationale', true,
    'Unverified premise plus validation deadline', ['validate_by', 'validated_on']),
  edge_case:     def('edge_case', 'EDGE', 'rationale', true,
    'Boundary condition; frequently worth promoting'),
  risk:          def('risk', 'RISK', 'rationale', true,
    'May occur and would harm', ['likelihood', 'impact']),
  known_issue:   def('known_issue', 'KNOWN', 'rationale', true,
    'Broken, flaky or a dead end right now; do not spend effort on it'),
};

export type ProfileName = 'minimal' | 'standard' | 'full';

/**
 * `standard` and `full` currently resolve to the SAME set, and that is a
 * result rather than an oversight: `standard` means "every category the
 * catalogue marks `defaultEnabled`" and `full` means "every category in the
 * catalogue", and since Phase 3 removed the three that shipped switched off
 * (`policy`, `postmortem`, `taxonomy` — each a duplicate of a clearer
 * sibling) nothing is left for the two definitions to disagree about. Both
 * names are kept because they say different things: a project that pins
 * `"profile": "full"` is asking for whatever the catalogue holds, and would
 * pick up a future category that shipped disabled; one on `standard` would
 * not. `test/core/categories.test.ts` asserts the equality so that a category
 * added with `defaultEnabled: false` makes it visibly false rather than
 * quietly untrue.
 */
export const PROFILES: Record<ProfileName, string[]> = {
  minimal: [
    'constraint', 'assumption', 'invariant', 'tradeoff', 'adr', 'edge_case',
    'rule', 'lesson',
  ],
  standard: Object.values(CATEGORIES)
    .filter((c) => c.defaultEnabled)
    .map((c) => c.name),
  full: Object.keys(CATEGORIES),
};
