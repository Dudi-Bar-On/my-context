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
  // Normative because of what the tier DOES, not because a known issue is an
  // instruction. It shipped on the rationale tier — the tier that matches its
  // grammar, since "the sandbox is flaky" is a present fact rather than a
  // directive — and that placement defeats the category's entire purpose. A
  // rationale item is never injected in full AND is not even named in the
  // session index: `buildIndex` (select.ts) enumerates normative items and
  // reduces every rationale type to a bare count, so a `known_issue` reached a
  // session as the digit in "1 known_issue" and nothing else. A category whose
  // one job is "this is broken, do not spend effort on it" cannot do that job
  // from a place the agent never reads. The consequence is stated wherever the
  // category is documented: an agent-captured known issue now lands as a
  // **draft** needing human review, like every other normative capture
  // (`defaultAgentEdits('normative')` is `review`).
  known_issue:   def('known_issue', 'KNOWN', 'normative', true,
    'Broken, flaky or a dead end right now; do not spend effort on it'),

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
};

export type ProfileName = 'minimal' | 'standard';

/**
 * Two profiles, and there used to be three.
 *
 * `full` meant "every category in the catalogue" against `standard`'s "every
 * category the catalogue marks `defaultEnabled`". The gap between those two
 * definitions was exactly `policy`, `postmortem` and `taxonomy` — the three
 * that shipped switched off because each duplicated a clearer sibling — so
 * `full` was, in practice, the name for "including the three nobody should
 * enable". Phase 3 removed all three, and the two names then resolved to the
 * same twenty categories: two profile names that are synonyms, one of which a
 * user has to be told means nothing different.
 *
 * It is REMOVED rather than kept as an alias. `resolveConfig` refuses an
 * unknown profile by name and lists the valid set, so a project whose
 * `config.json` still says `"profile": "full"` is told what changed at load
 * time rather than being silently resolved to `standard` — which would be the
 * accepted-and-ignored failure INV-nothing-is-dropped-silently exists to rule
 * out, applied to the one setting that decides what a corpus can hold.
 *
 * If a category is ever added with `defaultEnabled: false`, the answer is a
 * per-category `"enabled": true` in config, which already works and says which
 * category is being switched on.
 */
export const PROFILES: Record<ProfileName, string[]> = {
  minimal: [
    'constraint', 'assumption', 'invariant', 'tradeoff', 'adr', 'edge_case',
    'rule', 'lesson',
  ],
  standard: Object.values(CATEGORIES)
    .filter((c) => c.defaultEnabled)
    .map((c) => c.name),
};
