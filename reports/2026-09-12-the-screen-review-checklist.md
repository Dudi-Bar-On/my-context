# The screen review, walkable — `port/98`

Built 2026-09-12 for the owner, who asked for a checklist rather than an afternoon.

## READ THIS BEFORE YOU START — the task's own precondition has expired

`port/98` says, in its own words: *"It must run while the simulated corpus is still being
served. On real data an absent feature and a missing feature look identical, and this project
spent a full day on exactly that confusion."*

**The app is already on the real corpus** — 1,108 items, real conversations, real audit rows.
**And `port/99`, the task whose whole job is "return the UI to the real corpus", is still `todo`.**
The return happened without its own task, so the review's fixture is gone.

That does not make the review worthless; it changes what it can conclude. **On real data, "this is
not on the screen" no longer means "this is not built."** Every row below therefore asks you to rule
on what you SEE, and flags separately where absence is ambiguous.

There is also a sequencing fact: `port/98` needs `port/93` (pixel parity), whose own dependency
`port/94` is **done** — so `port/93` is dispatchable today and exists precisely to make this list
short. Running it first is the cheaper order.

## How to use this

Open the app. For each screen: look for the three things named, then write **OK**, **FIX: <what>**,
or **?** (cannot tell on real data). Twenty rows. Anything you mark FIX becomes an item; anything
you mark **?** is a candidate for re-running the review on the fixture.

Two accepted divergences carry in from the ledger and must NOT be re-reported as defects:
`span.prop` on the carried block, and `span.chip` on the index tier.

| # | Screen | Look at | Verdict |
|---|---|---|---|
| 1 | Injection preview | the three doors each render; the event picker's kinds match what the hook actually sends; twelve sentences are suspected to have no translation key | |
| 2 | Scope coverage | the coverage figure agrees with what Doctor says; empty state says why it is empty | |
| 3 | Budget simulator | it opens on a tier that shows something, not nothing; the window it simulates is the real one | |
| 4 | Injected now | what it lists matches what a session actually received | |
| 5 | Audit stream | the newer row kinds are visible, not collapsed into one generic cell; a capped answer is distinguishable from a complete one | |
| 6 | Ask | the four canned reports; whether any sentence explains the fetch cap | |
| 7 | Doctor (47) | the 47 findings are readable and each says what would clear it | |
| 8 | Decay | it distinguishes "nothing decayed" from "not measured" | |
| 9 | Relations | the graph draws; an item with no relations says so | |
| 10 | Status | the review-queue age pill has a colour; the em dash can say why it is there | |
| 11 | Review queue (0) | the empty state is a sentence, not a blank | |
| 12 | Capture | its composed state; four ledger entries hang on this one | |
| 13 | Composer | what "implemented" means for it; the id picker shows what you chose | |
| 14 | Configure | the three broken-config sentences are drawn in English with no key; `watchedDocs` is the one subject nothing prints | |
| 15 | Procedures | disclosures sit at the foot instead of beside the card they qualify | |
| 16 | Export / import | whether it ever imports, or a third of the screen is permanently a description | |
| 17 | Template packs | whether one card is actually a template pack or an imported example | |
| 18 | Conversations | the anchor controls (new today): mark from a hit, mark while reading, see, find, go to, rename, drop, run the pass | |
| 19 | Help | it says "Hebrew: 24 of 24 written" and shows all 24 titles in English | |
| 20 | Learn | the unmeasured mark is drawn where a verdict is not yet earned | |

## Three things to look at ONCE, not per screen

- **Every screen heading carries an internal design verdict** in a `<span class="verdict">` —
  *"✅ `exit 1` loses the findings list"*, *"⚠️ conditional pass"*. To a user a green tick beside a
  title reads as a health claim about the product. Rule once: keep, hide, or reword.
- **Hover / click help.** 75 buttons across the screens carry 5 titles between them.
- **The footer.** Below ~1,200 px it overlaps itself and pushes the whole WHERE and LIMITS groups
  off-screen with no scrollbar. And the number and its unit are separate spans under `direction:
  rtl`, so Hebrew renders `%43`, `%14`, `7607.12$`.

## What this review cannot settle, and should not pretend to

`e2e/screen-parity.spec.ts` compares element KINDS. It is blind to prose, spacing and colour — it
caught nothing when the audit stream rendered one generic cell for four record kinds, because every
element involved was the same `bdi` and `span.m`. **Looking is the instrument.** The owner certifies,
not the agent and not the gate — `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`.
