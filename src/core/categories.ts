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
  policy:        def('policy', 'POL', 'normative', false,
    'Higher-level business or security guideline governing how rules apply'),

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
  postmortem:    def('postmortem', 'PM', 'rationale', false,
    'Incident debrief'),
  taxonomy:      def('taxonomy', 'TAX', 'rationale', false,
    'How domain concepts relate'),
};

export type ProfileName = 'minimal' | 'standard' | 'full';

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
