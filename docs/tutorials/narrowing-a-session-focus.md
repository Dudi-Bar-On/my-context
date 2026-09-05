# Narrow what gets injected into this session

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

You are spending the afternoon on the billing code. Your corpus governs six
other areas as well, and every one of them is competing for the same injection
budget on every file you touch.

Focus is a temporary filter over what may be injected. It is how you say "for
now, this part of the corpus" without deleting, deprecating or retiering
anything.

## How it works

Focus narrows on three axes — `--tag`, `--category` and `--scope` — and
positional arguments are tags. It has four properties worth knowing before you
set one:

1. **Tags decide injection here.** Outside a focus, tags are pure metadata. The
   moment a focus is set, an item matching none of its tags is held back.
2. **`severity: hard` is exempt.** Focus never hides a hard item, and it says so
   rather than quietly making an exception.
3. **It discloses rather than refuses.** It hides what you asked it to hide and
   tells you the cost, including relations left dangling.
4. **The preview calls the same selection the injection will**, so a preview and
   the injection that follows it cannot disagree.

Focus lives in `.my_context/state/focus.json`, which is gitignored — it is local
to your machine and never narrows a teammate's injection.

Nothing is hidden from *reading*. An item out of focus is still in the corpus,
still listed, still printable with `mycontext show`. Focus is about what arrives
unasked.

## From the CLI

Always preview first:

```console
$ mycontext focus billing --preview
my_context: preview only — nothing was changed.
focus: tags: billing
1 item(s) in focus, 3 hidden by focus (of the eligible corpus).

hidden by focus — still in the corpus, still readable with `mycontext show`:
  LESSON-the-sandbox-declines-3ds-cards-at-random
  RULE-every-price-is-an-integer-of-minor-units
  TODO-check-whether-the-3ds-retry-path-double-charges

0 load-bearing relations dangling.

1 severity:hard item(s) do not match this focus and are injected anyway — focus never hides one:
  CONST-card-numbers-never-reach-the-logs
Apply it by running the same command without --preview.
```

Everything you need in order to decide is in that output: what stays, what goes,
what is exempt, and what relation you are about to leave pointing at nothing.

```bash
mycontext focus billing                    # apply it
mycontext focus --category constraint      # narrow by category instead
mycontext focus --scope "src/billing/**"   # or by path
mycontext focus --show                     # what is set
mycontext focus --clear                    # remove it
mycontext focus --relations                # the relation types you can focus on
```

**The slash command.** `/mycontext:focus` sets or previews one from inside a
session, which is usually where you want it — the focus you need is the one for
the work you are about to do.

**From an agent**, `focus_context` sets or previews a focus with the same three
axes.

**What the CLI can do here that the UI cannot.** `--relations` and `--show`.
And the preview in the form above: the browser has a Composer entry for `focus`
carrying `tag`, `category`, `scope` and `clear`, but the disclosure block —
what is hidden, what is exempt, what dangles — is the terminal's answer.

## From the UI

The **Composer** screen (`nav.ch`) is where focus is reached in the browser. It
is the screen whose contract is *real pickers and a live glob tester*: the
categories, the item ids, the drafts and the pending revisions are all fetched
from the running corpus, and the glob you type for `--scope` is matched by the
server through the very cache the selector uses. Nothing on that screen is a
canned example.

`focus` is one of its 27 catalogue entries and sits on the trust boundary, so
running it from the browser goes through the field-by-field confirm.

The focus already in force is drawn on a **different** screen: **Injection
preview** names focus as one rung of its gate ladder, lists the items the active
focus is hiding, and offers to run the same preview with `focus=off` — which the
screen labels as the different question it is, rather than as a toggle that
quietly changes the answer.

**What the UI can do here that the CLI cannot.** Test the scope glob against the
real file tree while you are typing it; pick the tag or category from what the
corpus actually holds instead of from memory; and see, on one screen, the
selection with the focus and the selection without it.

**What the UI cannot do here.** Clear a focus without going through the confirm,
answer `--relations`, or give you the preview block above — the count of
dangling load-bearing relations, and the named hard items that are injected
anyway, are the terminal's disclosure and have no screen.
