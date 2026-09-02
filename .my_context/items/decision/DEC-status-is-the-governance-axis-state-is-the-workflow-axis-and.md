---
id: DEC-status-is-the-governance-axis-state-is-the-workflow-axis-and
type: decision
title: status is the governance axis, state is the workflow axis, and they are not collapsed
status: active
severity: soft
always: false
summary: One field says whether a record still stands; the other says how far the work got. They look alike, so people merge them, and that quietly breaks both.
summary_of: b6d8519f7757870e
scope: []
tags:
  - v2
  - corpus
  - owner-ruling
  - doctor
  - task
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-31
valid_until: null
checksum: d557be7cef329851
---

# status is the governance axis, state is the workflow axis, and they are not collapsed

OWNER RULING, 2026-08-31, after a proposed migration of the task items was stopped at both of its verification gates.

THE RULING, in one line each. `status` is the GOVERNANCE axis, and it answers: does this record still stand? `state` is the WORKFLOW axis, and it answers: where is this work? A task carrying `state: done` alongside `status: active` is the convention working, not drift. The two fields may not be collapsed into one.

WHY THIS IS RECORDED AT ALL. A dispatch brief read the co-occurrence of finished work and an `active` status as a defect and proposed a migration to repair it. The reasoning is natural, it is what anyone re-derives from a glance at the fields, and verification refused it on three separate counts. Without this item the next reader re-derives the same trap.

THE COUNTS, which are the convention working. There are 503 task items. Of those, 376 carry `state: done`, and 372 of the 376 carry `status: active`.

    state     status        count
    done      active          372
    todo      active          123
    blocked   active            3
    done      superseded        2
    done      deprecated        2
    doing     active            1

THE FIRST REFUSAL: the proposed value cannot be added in configuration. The migration wanted a new status of `resolved`. Status is a closed union in the type system — `types.ts` · `export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';` · ~2 — so adding one is a change to source in several files, never a change to `config.json`. The legal statuses for a task are draft, active, validated, deprecated and superseded, read through the same merge that `edit`, `help` and the doctor all read: `tag-projection.ts` · `export function updatesFor(config: Config, type: string): CategoryUpdates {` · ~135, layered over `categories.ts` · `export const TIER_UPDATES: Record<Tier, CategoryUpdates> = {` · ~104.

THE SECOND REFUSAL: the workflow field has four values, not two. `state` is declared as todo, doing, blocked and done, and all four are in live use. A two-line mapping applied to a four-value field silently mis-sets every item in the states it does not name — which is the exact class of defect such a migration exists to remove.

THE THIRD REFUSAL, and the one that decided it: the migration buys nothing measurable. The stated benefit was that a meaningful status would give the body-agreement doctor check a real second axis. Simulated over this corpus against the real check, the `body_disagrees_with_meta` count is 36 in every variant — baseline, the new value made legal but no item migrated, the intended mapping applied, and a legal-only mapping. Not one finding was gained and not one was removed; only the wording of five findings changed.

THE REASON IT BUYS NOTHING, which is the part worth keeping. The check already reads the workflow field as its closure signal: `checks.ts` · `function alreadyClosed(item: Item): boolean {` · ~1964 returns true for `state` of done. And the vocabulary comparison is per field — `checks.ts` · `function unheldValues(config: Config, item: Item): Map<string, { field: string; current: string }> {` · ~1945 — so a body shouting a completion word is compared against `state`, the field that declares it, and never against `status`. A status computed from `state` therefore carries no information the check does not already hold. There is no second axis to gain.

WHAT MADE IT DANGEROUS AS WELL AS USELESS. An `active` status is what makes an item eligible for injection at all: `select.ts` · `if (item.status !== 'active') return false;` · ~340. Moving finished tasks to any other value removes them from the delivery pool, dropping the eligible task count from 499 to 127. Three of the four alternatives would also report those items as retired — `select.ts` · `export const RETIRED_STATUSES = new Set([` · ~632 — hiding them from the inbox and counting them as retired in the corpus health summary.

THE SENTENCE THAT SETTLES IT. The declaration table already says this in as many words: it documents `status` as whether the item governs, and the task category's own `state` as where the task is. That the task category defines a `state` field of its own, rather than reusing `status`, is the design having ALREADY made this distinction deliberately. Collapsing the two would delete that distinction rather than sharpen it.

A SUBTLE TRAP, preserved because it cost real effort to find. The word `resolved` currently sits in the doctor's lexicon of English closing verdicts — `checks.ts` · `const CLOSING_VERDICTS = new Set([` · ~1882 — where it is matched only on an item that is still open. Were it also declared as a field value, the per-field vocabulary comparison would match it FIRST, and that comparison carries no such guard. A guarded signal would silently become an unguarded one. In this corpus that swaps the wording of two findings rather than adding any, which is precisely why it would have gone unnoticed.

SCOPE OF THIS RULING, so it is not over-applied. It governs the task category. The meaning of `status` on every OTHER tier and category is untouched: elsewhere it continues to mean exactly what the declaration table says it means, and nothing here narrows or redefines it.

WHAT WAS WEIGHED AGAINST IT: making `resolved` legal in source and migrating anyway, on the grounds that a finished task reading as active still looks wrong. Declined, because the appearance is the only argument for it. The measurement says the check does not improve, the delivery consequence is a real regression, and the distinction being erased is one the design made on purpose.
