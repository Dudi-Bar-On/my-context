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
  // The one-shot sibling of `runbook`, and the pair is deliberate (spec §6o).
  // `runbook` is REPEATABLE: it is performed whenever the named operation comes
  // up, and it governs for as long as the operation exists. A `procedure` is
  // performed ONCE — a migration, a data fix, a one-time correction — and then
  // it is finished, which is why it is the category that carries a lifecycle
  // and `runbook` is not. Collapsing the two would lose the property that makes
  // the one-shot honest: it stops being injected when it is done.
  //
  // The test an author applies, and it is the same sentence the topic file,
  // both READMEs and both `examples` outputs give: will you do this again next
  // time the situation arises? Then it is a `runbook`. Is it done once and then
  // finished? Then it is a `procedure`.
  //
  // NORMATIVE, like `runbook`, and unlike `todo`/`note` below: an active
  // procedure is injected in full, is named in the index, and an agent-authored
  // one lands `draft` through `trustedStatus` with no exception anywhere.
  procedure:     def('procedure', 'PROC', 'normative', true,
    'An ordered operation performed once and then finished; a repeatable one is a runbook'),
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
  // RATIONALE, and the tier is the trust boundary rather than a taxonomy
  // judgement. A reference's body is a snapshot of a file, so if the category
  // were normative, whoever can edit that file — an agent included — would
  // change what governs this project by editing it, which is the hole the
  // staged-revision gate (spec §4) exists to close, reopened through a
  // different door. On the rationale tier the item cannot govern at all:
  // `select` filters `isNormative` before it reads `always` or `scope`, so the
  // question never arises. A user MAY retier it in config, and the machinery
  // honours that; what it costs is stated wherever the category is documented
  // rather than softened.
  reference:     def('reference', 'REF', 'rationale', true,
    'A snapshot of a file, with its origin recorded so doctor reports drift'),
  // The inbox, and the tier is the feature rather than a taxonomy judgement.
  // Every other category expects the author to already know what kind of
  // knowledge they have; at the moment a thought arrives mid-development they
  // do not, and the friction of choosing is what stops it being recorded at
  // all. RATIONALE means `select` never admits either to a full-text tier
  // (`isNormative` is consulted before `always` and `scope` are read) and
  // `buildIndex` reduces both to a bare count — so twenty unbuilt things do
  // not arrive in every session as twenty things the model is told to care
  // about and cannot act on. It also means `trustedStatus` does not force an
  // agent's capture to `draft`: a `todo` asserts nothing, it records an
  // intention, and draft-gating the one operation that must have no friction
  // would defeat the reason both exist.
  todo:          def('todo', 'TODO', 'rationale', true,
    'Something to build or fix later, captured the moment it occurs to you'),
  note:          def('note', 'NOTE', 'rationale', true,
    'Anything that arose during development and must not be lost'),
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
 * enable". Phase 3 removed all three, and the two names have resolved to the
 * same catalogue ever since — twenty categories then, twenty-four now, every
 * one of them enabled by default. Two profile names that are synonyms, one of
 * which a user has to be told means nothing different.
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
  // `todo`, `note` and `procedure` are all deliberately absent, for two
  // different reasons. `minimal` is the smallest useful NORMATIVE vocabulary
  // for a project that wants one: an inbox is orthogonal to that, and a
  // one-shot operation record is not something a corpus needs on day one.
  // The per-category `"enabled": true` in config already switches any of them
  // on and says which.
  minimal: [
    'constraint', 'assumption', 'invariant', 'tradeoff', 'adr', 'edge_case',
    'rule', 'lesson',
  ],
  standard: Object.values(CATEGORIES)
    .filter((c) => c.defaultEnabled)
    .map((c) => c.name),
};
