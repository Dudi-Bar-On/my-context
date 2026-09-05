import type { Tier } from './types.ts';

/**
 * Where a value lives — and therefore which operations are legal on it.
 *
 * **Owner ruling, 2026-08-23: `update` is not a legal operation on a tag.** A
 * tag is a MEMBERSHIP, and a set supports add and remove; what looks like an
 * update is a remove plus an add, two operations that can half-fail and that a
 * typo turns into a silent third membership. The `key:value` convention hides
 * that by making two distinct tags feel like one slot with two values.
 *
 * So the test is one sentence: **if you would ever want to update it, it is a
 * field.** A `tag` is legitimate only while its value is fixed for the life of
 * the item.
 *
 * This is not theory. Measured across 276 task items on 2026-08-23: all 276
 * carried a `state:` TAG, 213 also carried a `state` FIELD, and THIRTEEN
 * disagreed — five reading `done` as a tag and `doing` as a field. `state` is
 * the one name that got "updated" hundreds of times, and it is the one that
 * drifted. The category error and the defect are the same thing.
 */
export type UpdateStore = 'field' | 'tag';

/**
 * One updatable name on an item, and everything a person or a refusal needs to
 * know about it.
 *
 * `store` and `note` are required; the rest is absent when it does not apply.
 * That asymmetry is deliberate — an absent `values` means "free text", which is
 * a real answer, whereas an absent `note` would mean this declaration cannot be
 * rendered, and rendering is half of what it exists for.
 */
export interface UpdatableName {
  /** `field` for a value that changes; `tag` for a membership fixed for the item's life. */
  store: UpdateStore;
  /**
   * The closed vocabulary. Absent means free text.
   *
   * **This is what makes a typo impossible rather than merely unlikely.** Until
   * it existed, `state:donee` would have removed a task from every progress
   * view with no gate noticing — grepped the source on 2026-08-23 and found
   * nothing anywhere reading or checking the `plan:`/`seq:`/`state:` prefixes.
   */
  values?: readonly string[];
  /**
   * For a `field` that must stay filterable: the tag prefix the tool keeps in
   * sync with it, writing `<projectsTo>:<value>` and rewriting it on change.
   *
   * The projection is GENERATED, never typed. That is what makes remove-then-add
   * atomic — a machine does both — and it is why grouping keeps working
   * unchanged while the value itself moves to the field that can hold it.
   */
  projectsTo?: string;
  /**
   * How it is changed, as it is typed. Absent means the generic spelling for an
   * extra field, `mycontext edit <id> --extra <name>=<value>`.
   *
   * Spelled out per name because it is not derivable and getting it wrong costs
   * a person an attempt: `always` has two spellings (`edit --always=true` and
   * `mycontext pin`), and `source_file` has no command at all.
   */
  command?: string;
  /** One line a person reads. Rendered by `mycontext help` and `mycontext examples`. */
  note: string;
}

/**
 * A category's own updatable surface, by name. Empty is a real answer.
 *
 * Two places produce one: the catalogue below, for the twenty-nine shipped
 * categories, and `.my_context/config.json`, for the ones a person defines —
 * "custom categories are created by humen and it should be written in a way a
 * user could edit and define it in the config" (owner, 2026-08-23). The loader
 * that reads, validates and merges the config half is `requireUpdates`
 * (core/config.ts), and it states the merge: a CUSTOM category's declaration is
 * whatever its entry says, and an override on a SHIPPED one EXTENDS this table
 * by name rather than replacing it — the same direction as `extraFields`,
 * because they are two halves of one description.
 */
export type CategoryUpdates = Readonly<Record<string, UpdatableName>>;

/**
 * **The update rules that belong to the TIER, declared once.**
 *
 * REQ-every-category-declares-what-may-be-updated-on-its-items-and names this
 * as a constraint on the design rather than a convenience: "Most update rules
 * belong to the TIER, not the category… Declaring those per category would put
 * 27 copies of one fact in the catalogue. Tier declares the general rules; a
 * category declares only what is genuinely its own."
 *
 * So `CATEGORIES[x].updates` below carries a category's OWN names and nothing
 * else, and every one of the 29 shipped categories is silent about `title`,
 * `status` and the rest — because this table already said it.
 *
 * **The two tiers differ in exactly two entries, and the difference is read off
 * the code that enforces it** (`cli/commands/edit.ts` · `      if (patch.always === true) {` · ~743),
 * not off the comment table above it. On a rationale-tier item `--always true`
 * and `--severity hard` are refused through `inertFieldError`; `--always=false`
 * and `--severity soft` are accepted, because they assert nothing about the
 * pinned tier and clearing a stored-but-inert value is a legitimate cleanup.
 * `scope` is NOT refused on the rationale tier, which is why it appears
 * identically under both.
 */
export const TIER_UPDATES: Record<Tier, CategoryUpdates> = {
  normative: {
    title: { store: 'field', command: 'mycontext edit <id> --title "…"', note: 'The one-line name. Changing it does not change the id.' },
    body: { store: 'field', command: 'mycontext edit <id> --body "…" | --file <path>', note: 'What the item actually says. On a governing item this is gated and previewed.' },
    summary: { store: 'field', command: 'mycontext edit <id> --summary "…"', note: 'One plain sentence saying what this item IS and why it matters, for a reader who does NOT know this codebase - plain words, no ids, no paths, no numbers. Max 160 chars; the body keeps the precision. `--summary=` removes it.' },
    scope: { store: 'field', command: 'mycontext edit <id> --scope "a/**,b/**"', note: 'The globs this governs. Empty means everywhere, unless the category sets scopePolicy required.' },
    tags: { store: 'tag', command: 'mycontext edit <id> --tags "a,b"', note: 'REPLACES the whole list. Read the current tags back first or the others are dropped.' },
    status: { store: 'field', values: ['draft', 'active', 'validated', 'deprecated', 'superseded'], command: 'mycontext edit <id> --status <status>', note: 'Whether it governs. Moving a normative item into active or validated is gated and previewed.' },
    severity: { store: 'field', values: ['hard', 'soft'], command: 'mycontext harden <id> | mycontext soften <id>', note: 'Binding or advisory. `edit --severity` is the same change under another name.' },
    always: { store: 'field', values: ['true', 'false'], command: 'mycontext pin <id> | mycontext unpin <id>', note: 'Injected at every session start. `edit --always=true` is the same change under another name.' },
    continuity: { store: 'field', values: ['true', 'false'], command: 'mycontext edit <id> --continuity[=false]', note: 'Re-delivered on every session start and after every compaction, against its own budget. For what the NEXT session needs in order not to start over — a pointer plus a bounded digest, never a document.' },
  },
  rationale: {
    title: { store: 'field', command: 'mycontext edit <id> --title "…"', note: 'The one-line name. Changing it does not change the id.' },
    body: { store: 'field', command: 'mycontext edit <id> --body "…" | --file <path>', note: 'What the item actually says. Ungated on this tier — nothing governs before or after.' },
    summary: { store: 'field', command: 'mycontext edit <id> --summary "…"', note: 'One plain sentence saying what this item IS and why it matters, for a reader who does NOT know this codebase - plain words, no ids, no paths, no numbers. Max 160 chars; the body keeps the precision. `--summary=` removes it.' },
    scope: { store: 'field', command: 'mycontext edit <id> --scope "a/**,b/**"', note: 'The globs this is about. Accepted on this tier, unlike severity and always.' },
    tags: { store: 'tag', command: 'mycontext edit <id> --tags "a,b"', note: 'REPLACES the whole list. Read the current tags back first or the others are dropped.' },
    status: { store: 'field', values: ['draft', 'active', 'validated', 'deprecated', 'superseded'], command: 'mycontext edit <id> --status <status>', note: 'Ungated on this tier: a rationale item governs nothing before or after.' },
    severity: { store: 'field', values: ['soft'], command: 'mycontext soften <id>', note: 'Only soft. `--severity hard` is REFUSED here — severity governs on the normative tier only.' },
    always: { store: 'field', values: ['false'], command: 'mycontext unpin <id>', note: 'Only false. `--always true` is REFUSED here — pinning governs on the normative tier only.' },
    continuity: { store: 'field', values: ['true', 'false'], command: 'mycontext edit <id> --continuity[=false]', note: 'Accepted on this tier, unlike severity and always: the continuity tier is not a governance tier and never consults isNormative, so a reference can carry it.' },
  },
};

export interface CategoryDef {
  name: string;
  prefix: string;
  tier: Tier;
  defaultEnabled: boolean;
  description: string;
  extraFields: string[];
  /**
   * What may be updated on an item of THIS category, beyond what its tier
   * already declares in `TIER_UPDATES`.
   *
   * Every category has one, and `{}` is a real declaration rather than a gap:
   * it says this category adds nothing of its own, which is true of nineteen of
   * the twenty-nine shipped ones. What it must never be is absent — a category
   * that cannot describe its own updates teaches nobody anything, which is the
   * sentence the requirement opens with.
   */
  updates: CategoryUpdates;
}

function def(
  name: string, prefix: string, tier: Tier, defaultEnabled: boolean,
  description: string, extraFields: string[] = [], updates: CategoryUpdates = {},
): CategoryDef {
  return { name, prefix, tier, defaultEnabled, description, extraFields, updates };
}

export const CATEGORIES: Record<string, CategoryDef> = {
  constraint:    def('constraint', 'CONST', 'normative', true,
    'Non-negotiable limit: budget, stack, regulation, SLA'),
  invariant:     def('invariant', 'INV', 'normative', true,
    'Condition that must always hold during execution'),
  rule:          def('rule', 'RULE', 'normative', true,
    'A do/dont directive', ['directive'], {
      // The ONE vocabulary here read off code rather than guessed at:
      // `revision-diff.ts` renders a directive change as
      // `- directive: dont` / `+ directive: do` (~70), and the shipped example
      // carries `dont`. Both members, both attested.
      directive: {
        store: 'field', values: ['do', 'dont'],
        note: 'Whether this rule tells you to do something or not to. It is what the rule MEANS, which is why `directive` can never be removed from the category.',
      },
    }),
  requirement:   def('requirement', 'REQ', 'normative', true,
    'What must be built', ['kind'], {
      // NO `values`, deliberately. `functional` is the only value this build
      // attests — the shipped example and the one requirement in this corpus
      // both carry it — and nothing in `src/` constrains the field. Declaring
      // a vocabulary from one observed member would be exactly the invented
      // claim this requirement exists to stop: four statements in the design
      // of record were measured false in one week that way.
      kind: {
        store: 'field',
        note: 'What kind of requirement this is. The shipped example uses `functional`; nothing constrains the value today.',
      },
    }),
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
    'Deliberately undecided; the agent must not decide it alone', ['blocks'], {
      blocks: {
        store: 'field',
        note: 'What cannot proceed until this is answered. Free text — name the work, not the person.',
      },
    }),
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
  // NORMATIVE, and it has to be: an exception is read at exactly the moment
  // the item it waives is being applied, so it must arrive by the same route
  // and against the same budget. On the rationale tier it would reach a
  // session as a digit in a count while the rule it carves out of arrived in
  // full — the reader would be told the rule and not told that it does not
  // apply here, which is worse than not recording the exception at all. It is
  // the `known_issue` argument, on the one category whose whole content is
  // "the thing you are about to obey has a hole in it".
  //
  // `waives` names ONE normative item, and the id is the point. A carve-out
  // from "our rules generally" is not an exception; it is a different rule,
  // and it should be written as one. `until` is a DATE for the same reason
  // `assumption` carries `validate_by`: a carve-out with no end is an
  // amendment nobody argued for, and this project already has the shape for a
  // change that is meant to last — the `amends` relation, on an item that
  // says what the new reading is.
  exception:     def('exception', 'EXC', 'normative', true,
    'A scoped, dated carve-out from a named normative item, and the reason it was granted',
    ['waives', 'until', 'granted_by', 'reason'], {
      waives: {
        store: 'field',
        note: 'The id of the ONE normative item this carves out of. A carve-out from the rules in general is not an exception — it is a different rule, and it belongs in the category for one.',
      },
      until: {
        store: 'field',
        note: 'The date the carve-out expires, as YYYY-MM-DD. An exception with no end date is a permanent change to the rule, made without anybody deciding to make one.',
      },
      granted_by: {
        store: 'field',
        note: 'Who granted it. A person, not a role: an exception is somebody choosing to carry a risk, and the record has to say who.',
      },
      reason: {
        store: 'field',
        note: 'Why it was granted — the circumstance that made the rule the wrong answer here. It is what a reader needs in order to tell whether that circumstance still holds.',
      },
    }),
  // NORMATIVE, and for what the tier DOES rather than by analogy: a contract
  // is a promise this project has made to somebody outside it, so work that
  // would break it is wrong in exactly the sense the normative tier means.
  // `constraint` is its nearest neighbour and the two are separate because
  // they answer different questions at the moment somebody goes to change
  // something. A constraint says what the limit IS; a contract says WHO IS
  // HOLDING YOU TO IT and what breaking it would cost them, which is the half
  // a person needs in order to decide whether the break is worth negotiating.
  contract:      def('contract', 'CONTRACT', 'normative', true,
    'A surface other parties depend on, and what changing it costs',
    ['consumers', 'stability', 'breaking'], {
      consumers: {
        store: 'field',
        note: 'Who depends on this surface, named. A contract with no named consumer is a design note: nobody can be asked whether a change to it is acceptable.',
      },
      // NO closed `values`, and the restraint is the one `requirement.kind`
      // states. The familiar triple (experimental / stable / frozen) is an
      // inference from other projects, and an inference is not an
      // attestation: nothing in this build has ever written a stability
      // value, so declaring a vocabulary here would enforce a rule against
      // items nobody has seen.
      stability: {
        store: 'field',
        note: 'How much this surface may still move. Nothing constrains the value today — say it in whatever words the consumers above would recognise.',
      },
      breaking: {
        store: 'field',
        note: 'What counts as a breaking change to this surface, and what it would cost the consumers named above. It is the sentence that makes the promise checkable.',
      },
    }),

  adr:           def('adr', 'ADR', 'rationale', true,
    'Formal decision record, MADR shape'),
  decision:      def('decision', 'DEC', 'rationale', true,
    'Lightweight decision not warranting a full ADR'),
  lesson:        def('lesson', 'LESSON', 'rationale', true,
    'What was learned; source material for generated rules'),
  tradeoff:      def('tradeoff', 'TRADE', 'rationale', true,
    'What was sacrificed for what'),
  assumption:    def('assumption', 'ASSUME', 'rationale', true,
    'Unverified premise plus validation deadline', ['validate_by', 'validated_on'], {
      validate_by: {
        store: 'field',
        note: 'The date by which this premise must be checked, as YYYY-MM-DD. An assumption with no deadline is a belief.',
      },
      validated_on: {
        store: 'field',
        note: 'The date it was actually checked, as YYYY-MM-DD. Absent means it has not been.',
      },
    }),
  edge_case:     def('edge_case', 'EDGE', 'rationale', true,
    'Boundary condition; frequently worth promoting'),
  risk:          def('risk', 'RISK', 'rationale', true,
    'May occur and would harm', ['likelihood', 'impact'], {
      // Same restraint as `requirement.kind`. The shipped example attests
      // `medium` and `high`; `low` is an inference from a familiar triple, and
      // an inference is not an attestation. Left open until the owner rules,
      // rather than declared and enforced against items nobody checked.
      likelihood: {
        store: 'field',
        note: 'How likely it is. The shipped example uses `medium`; nothing constrains the value today.',
      },
      impact: {
        store: 'field',
        note: 'How much it would harm. The shipped example uses `high`; nothing constrains the value today.',
      },
    }),
  // RATIONALE, and the tier decides itself: a measurement is a FACT ABOUT A
  // MOMENT, never an instruction. Nothing an agent does is wrong because a
  // number was once measured — what would be wrong is acting on a stale one,
  // and the four fields exist so that a reader can tell. `method` and
  // `revision` are what make the number re-takeable; `measured_on` is what
  // makes it datable. A measurement carrying none of them is an assertion
  // wearing a digit, which is the shape this corpus has already been burnt by:
  // four statements in its own design of record were measured false in a week.
  measurement:   def('measurement', 'MEAS', 'rationale', true,
    'A number, how it was obtained and when, so a later reader can tell whether it still holds',
    ['method', 'measured_on', 'subject', 'revision'], {
      method: {
        store: 'field',
        note: 'How the number was obtained, precisely enough that somebody else could take it again and get the same one. A method nobody can repeat makes the number unfalsifiable.',
      },
      measured_on: {
        store: 'field',
        note: 'The date it was taken, as YYYY-MM-DD. It is what turns a number into a number AS OF a moment, which is the only kind that can go stale honestly.',
      },
      subject: {
        store: 'field',
        note: 'What was measured — the corpus, the file, the command, the population. Two measurements of different subjects are not a trend.',
      },
      revision: {
        store: 'field',
        note: 'The revision of the thing measured: a commit, a tag, a version. It is what a later reader compares against to decide whether re-taking the number is worth the effort.',
      },
    }),
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
  // A unit of planned work, and the ONE category the product already had the
  // machinery for and not the entry: `cli/commands/ready.ts` prints the column
  // headers `['task','pri','state','title']`, `core/needs.ts` computes
  // readiness from a `needs` field, and `doctor/checks.ts` carries
  // `blocked_without_needs`, `blocked_needs_met` and `needs_unresolved`. All of
  // it was reachable only by a project that invented `task` in its own
  // `config.json`, so a fresh install got a `ready` command that could never
  // find anything and three doctor checks that could never fire. Shipping the
  // category is what closes that.
  //
  // Taken verbatim from the working definition this repository's outer corpus
  // has run on since 2026-08-23 — the same tier, prefix, description, eight
  // extra fields and eight update declarations — rather than re-derived, so a
  // corpus that already holds task items keeps the exact shape it was written
  // against.
  //
  // RATIONALE, and deliberately: a task is REASONING ABOUT WORK, not a rule the
  // work must satisfy. Nothing an agent does is wrong because a task exists, so
  // it must not reach the tier that is injected in full and named in the
  // session index — 515 open tasks arriving as 515 things a model is told to
  // care about is exactly the failure the tier boundary exists to prevent. The
  // views that DO need them (`ready`, `plan`, `doctor`) query the store
  // directly and never go through `select`.
  // **A PLAN IS NOT A TASK**, and the separation is enforced by the fields the
  // category declares rather than by its name. `isWorkCategory`
  // (core/needs.ts) answers "does this category plan work?" by asking for
  // `plan`, `seq` and `state` TOGETHER — a body of work, a position inside
  // it, and where that position has got to. A `plan` carries `state` and
  // neither of the other two, so it is not a work category: it never appears
  // in `mycontext ready`, it is never a `needs` target, and none of doctor's
  // three task checks reads it. That is correct and deliberate. A plan is the
  // CONTAINER — `task.plan` names it — and the things that can be picked up,
  // waited on and finished are the tasks inside it.
  //
  // So `state` here does not mean what `task.state` means, and it carries no
  // closed vocabulary for the reason `requirement.kind` and `risk.likelihood`
  // carry none: borrowing `todo/doing/blocked/done` from `task` would be an
  // inference from a neighbour rather than anything this build attests, and it
  // would invite exactly the collapse this comment exists to prevent.
  // `done_when` is the field that actually finishes a plan — a stated
  // condition, checkable by somebody who did not write it — and `wave` is the
  // ordering ACROSS plans, the same idea `task.seq` is one level down.
  //
  // RATIONALE, like `task`, and by the same argument: a plan is reasoning
  // about work, not a rule the work must satisfy. Nothing an agent does is
  // wrong because a plan exists.
  plan:          def('plan', 'PLAN', 'rationale', true,
    'A named body of work: its goal, the order it is taken in, and the condition that finishes it',
    ['goal', 'done_when', 'wave', 'state'], {
      goal: {
        store: 'field',
        note: 'What this body of work is for, in one sentence — the thing that would be true afterwards and is not true now.',
      },
      done_when: {
        store: 'field',
        note: 'The condition that finishes it, stated so that somebody who did not write the plan can check it. "When the tasks are done" is not one: it says nothing the task states do not already say.',
      },
      wave: {
        store: 'field',
        note: 'Which wave this plan is taken in — the ordering ACROSS plans, as `seq` is the ordering across the tasks within one.',
      },
      state: {
        store: 'field',
        note: 'Where the plan as a whole has got to. It is NOT `task.state`, and it carries no closed vocabulary: a plan is not a unit of work, it never appears in `mycontext ready`, and nothing computes this from the tasks inside it.',
      },
    }),
  // `progress` and `last_change` are RETIRED (owner ruling, 2026-09-03):
  // removed from `extraFields` and from `updates` below, so neither is a
  // legal target for a new `--extra` write from this build on. Retirement
  // here does not mean erasure — `unknownExtraFieldError` (core/trust.ts)
  // refuses only the KEYS A CALLER PASSES, never the item's stored result, so
  // the 518 items already carrying these two keys keep them on disk and keep
  // rendering unchanged; only a fresh assertion of either is now refused. That
  // asymmetry is deliberate and matches `scripts/check-retired.ts`'s own
  // meaning of the word for markdown prose: a correction stops NEW instances,
  // it does not rewrite history. `last_change` earned this the way its own
  // note said it would - "hand-typed and unreliable, all 133 disagree with
  // the audit log" - and `progress` was never more than state's shadow ("only
  // 0 and 100 are used today; state is the real signal"). Neither had a
  // doctor check reading it; `verified_on`, below, does not repeat that.
  task:          def('task', 'TASK', 'rationale', true,
    'A unit of planned work, tracked to completion. Its plan, sequence and state live in extra fields; the body is what the task actually requires.',
    ['plan', 'seq', 'state', 'priority', 'needs', 'verified_on'], {
      state: {
        store: 'field', values: ['todo', 'doing', 'blocked', 'done'], projectsTo: 'state',
        note: 'Where this task is.',
      },
      plan: {
        store: 'field', projectsTo: 'plan',
        note: 'Which body of work it belongs to.',
      },
      seq: {
        store: 'field', projectsTo: 'seq',
        note: 'Position within the plan.',
      },
      priority: {
        store: 'field', values: ['1', '2', '3', '4'],
        note: '1 is highest.',
      },
      needs: {
        store: 'field',
        note: 'The plan/seq references this task waits on, comma-separated - e.g. "walk/7, port/6". Shape is checked, existence is not: a reference to a task that does not exist yet is legitimate, because plans are written before their tasks are.',
      },
      // The owner ruling this whole entry exists to satisfy: "verified_on
      // WITH its doctor check ... a field without a consumer repeats that."
      // `checkTaskUnverified` (doctor/checks.ts) is the consumer -- a `done`
      // task with no `verified_on` is reported, once the task was created
      // after the field existed to be filled in (`VERIFIED_ON_INTRODUCED_AT`
      // is the cutoff; `checkStateUnaudited`'s birth cutoff is the model).
      verified_on: {
        store: 'field',
        note: 'The date a person checked this task\'s work and confirmed it actually does what `state: done` claims. Not stamped by finishing the work - by someone looking at it afterwards. `checkTaskUnverified` reports a done task that lacks it.',
      },
    }),
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
 * same catalogue ever since — twenty categories then, twenty-nine now, every
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
