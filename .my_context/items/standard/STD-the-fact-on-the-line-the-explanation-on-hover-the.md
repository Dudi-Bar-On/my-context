---
id: STD-the-fact-on-the-line-the-explanation-on-hover-the
type: standard
title: the fact on the line, the explanation on hover, the instruction always visible
status: active
severity: hard
always: false
summary: "Say it in fewer words on screen without saying less: the fact on the line, the longer explanation on hover, and anything you must act on always visible."
summary_of: d926df7eff1ad8f1
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - design
  - strings
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-01
valid_until: null
checksum: c7eaa95cec66e12e
---

# the fact on the line, the explanation on hover, the instruction always visible

> OWNER RULING 2026-09-01, made once as a principle after the same complaint arrived three times in different clothes:
>
> > *"go over every screen and simplify by using simple words to shorten texts on screen that most of them are long if not very long, it makes them tedious to read and actually user will not read them, and that is not the intention"*
>
> The three reports were: a doctor message that repeated a long explanation with every finding, which the owner measured at 58,000 characters of near-identical paragraph; notice text that was "quite big and hard to read"; and the item-summary feature itself, which exists because bodies are too long to read. They are one defect.
>
> The same owner, on the status strip the same week: *"WINDOW text hover is great, do the same for all of the other fields exactly"*. That is the other half of this standard arriving from the other direction. Shortening a line is only safe because there is an approved place for what the line stopped carrying, and the owner has now named that place and called it good.
>
> MEASURED, on this repo's own corpus, before anything moved. The Doctor screen's endpoint answered 73 findings carrying 42,353 characters of message, of which 34,440 were the same paragraph drawn again: 34 rows of one code sharing a 943-character explanation, and 36 rows of another sharing a 91-character instruction. Eighty-one per cent of the text on that screen was a re-print.
>
> **THE PRINCIPLE**
>
> **Shorten the words. Never the facts.**
>
> Much of the length that is there is there because a shorter sentence would be a lie. `not measured` against `0` is four extra words buying a distinction that has mattered repeatedly, and `INV-nothing-is-dropped-silently` is why several of these sentences are sentences at all. Length that buys a distinction is not waste, and trading a distinction for brevity is the one failure that sinks the whole programme.
>
> **THE THREE-WAY SPLIT, which is the whole of the rule**
>
> 1. **THE FACT IS ON THE LINE.** What is true, in the fewest plain words that keep it true, drawn always.
> 2. **THE EXPLANATION IS ON HOVER.** A `title` on the element the reader is looking at. This is the approved home for prose the line no longer carries, and `strip.unread`, `strip.unmeasured`, `screen.unread` and `title.noRepair` are the shape to copy: a few words on screen, the sentence in the attribute.
> 3. **THE INSTRUCTION STAYS VISIBLE.** Anything the reader must act on — a refusal's remedy, the command to run, the distinction that changes what they do next — stays on the line, in a control, or in the pane. It never becomes a hover.
>
> **WHAT MAKES A HOVER WORTH HOVERING**
>
> **A tooltip that restates the visible line is worse than none.** It teaches the reader that hovering is not worth doing, and the next tooltip — the one that mattered — goes unread. What makes the strip's window hover good is that it says something the line could not fit: the underlying counts, the age of the sample, where the level boundary sits. If a shortened line's explanation is only the long version of the same sentence, the shortening was cosmetic and the line was already fine.
>
> **A tooltip is not a carrier.** It is invisible to touch, invisible to keyboard-only navigation, and invisible in print. It may hold explanation and it may never hold instruction.
>
> **A disclosure is a carrier; a hover is not.** The mockup's own `details.help` widget is focusable, operable by keyboard and by touch, and it stays open once opened (`docs/design/web-ui-mockup.html` · `<details class="help"><summary data-t="help.whyCold">` · ~2956). It is therefore the correct home for text that is long, actionable, or both, and the correct home for text that is identical across many rows. Choosing between the two is not taste: prose the reader may safely never see goes in a `title`, and prose the reader may need to act on goes in a disclosure, on the same screen, next to what it is about.
>
> **WHAT IT FORBIDS**
>
> - **DELETING a distinction to save characters.** If the shorter sentence is not equally true, the longer one stays.
> - **TRUNCATING at a character count**, with or without an ellipsis. The cut is a sentence boundary the producer wrote, or there is no cut.
> - **PUTTING AN INSTRUCTION IN A `title`.** It is not a carrier, for the three reasons above.
> - **WRITING A `title` THAT RESTATES ITS OWN LINE.**
> - **PRINTING THE SAME PARAGRAPH TWICE on one screen.** Text identical across many rows belongs to the group and not to the row: draw it once, in one disclosure, and let each row keep only what is true of it alone.
> - **EDITING A PRODUCER'S WORDS.** A screen may split a checker's or an endpoint's message and move half of it out of the row, but the halves must join back to the producer's bytes. Rewording someone else's message on the way to the screen is a different change and needs its own decision.
> - **SHORTENING ONE LANGUAGE ONLY.** English terse and Hebrew long defeats the purpose on that surface, and Hebrew terse because it was never fully translated is a lost fact wearing brevity's clothes. The parity gate reads both directions and so does this.
> - **CLOSING A GAP BY BLANKING IT.** `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is untouched and outranks brevity: the short form of a measured zero is still a sentence, and never an empty space.
>
> **THE PROOF EVERY CHANGE OWES**
>
> A change under this standard is not finished until it can show:
>
> - a before-and-after table of every line touched, with character counts, so the owner judges the two side by side;
> - the total characters removed from the screen, and where the removed prose now lives, naming for each move whether it went to a hover or to a disclosure and why that was the right one;
> - for a producer's message that was split, an assertion that the row's remaining text plus the moved text is the original byte for byte, which is what makes "nothing was deleted" checkable rather than claimed;
> - both string tables' key counts before and after, so a lost key is detectable.
>
> **SCOPE**
>
> It governs read surfaces — the screen modules under `src/ui/public/screens/` and the string tables behind them — and the `title` and disclosure text they reach for. It does not govern the CLI's own output, and **it does not license editing `src/doctor/checks.ts` or any other producer's messages**: those are the same complaint at a different address and need their own ruling. Where a screen's shortening would need the mockup to change, the mockup change is reported and sequenced, never made in passing.
>
> **THE SHAPE TO COPY**
>
> The Doctor screen, reworked 2026-09-01, is the worked example. `sharedTail` finds the sentence repeated by every finding of one code and the screen draws it once, under that card, in a disclosure rather than a hover — because the paragraph it holds tells the reader what form to write (`src/ui/public/screens/doctor.js` · `export function sharedTail(messages) {` · ~377). Four keyed sentences were shortened with every distinction intact, and `title.noRepair` is a hover that adds what its two-word line cannot say: that the repair is a person, not a missing control. The byte-for-byte join and the three guards that stop the shortening eating a row are pinned in `test/ui/doctor-screen.test.ts` · `sharedTail refuses every case where factoring would lose a distinction` · ~810.
