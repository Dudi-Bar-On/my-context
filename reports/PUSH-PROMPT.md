# Getting these fixes into your repo

**Read Part 1 first (it is four lines), then either follow Part 2 by hand or
paste Part 3 into Claude Code.** About twenty minutes, most of it waiting for
`npm test`.

**Version: `1.0.1`, a PATCH.** Argued in Part 5, from your own `VERSIONING.md`.

## Part 1 - the short version

1. Copy `reports/fix-branch/my-context-doc-sweep.bundle` to your machine.
2. Fetch the branch from it, rebase onto `origin/master`, run the suite.
3. Read the Hebrew diff yourself - no test can check it.
4. Cut 1.0.1 per `VERSIONING.md`, then push and tag.

---

## Part 2 - why it was not just pushed

Paste the block in Part 3 into Claude Code, running in your own clone of
`my-context` where you are authenticated as Dudi Bar-On.

**Why this exists:** the fix branch was built on a different machine, whose git
identity is `usercourses63`. The commits are authored as you, but a push from
there would be recorded by GitHub as pushed by that account — permanently and
publicly. So nothing was pushed. Carry the branch over and push it yourself.

You need one file from the test repository:
`reports/fix-branch/my-context-doc-sweep.bundle` (26 KB). The individual
patches are beside it in `reports/fix-branch/*.patch` if you prefer to apply
them one at a time.

---

## Part 2b - the runbook, by hand

If you would rather not hand it to an agent, this is the whole thing.

    # B0 - start clean
    git status                 # must be clean
    git fetch origin
    git checkout master && git pull

    # B1 - bring the branch in from the bundle
    git fetch ~/my-context-doc-sweep.bundle fix/v1.0.0-doc-sweep:fix/v1.0.0-doc-sweep
    git checkout fix/v1.0.0-doc-sweep

    # B2 - rebase onto current master (verified to replay cleanly)
    git rebase origin/master

    # B3 - all nine commits must read "Dudi Bar-On <dudi.bar.on@gmail.com>"
    git log origin/master..HEAD --format='%h %an <%ae> %s'

    # B4 - the pin: expect 2308 pass / 11 known-red. A twelfth is a problem.
    npm run typecheck && npm test
    node --test test/docs/parity.test.ts test/docs/examples.test.ts                 test/docs/inventory.test.ts test/docs/injection.test.ts

    # B5 - must print NOTHING, proving no generated block was hand-edited
    npm run gen:docs && git diff --stat

    # B6 - the step only you can do
    git diff origin/master..HEAD -- docs/README.he.md

    # B7 - cut 1.0.1. Step 1 of VERSIONING.md is already done (CHANGELOG.md
    #      carries "## [Unreleased] - 1.0.1 when tagged").
    node scripts/set-version.ts 1.0.1
    npm run gen:docs                    # step 2 stales the documented status examples
    npm test && npx tsc --noEmit && claude plugin validate --strict .
    #      then close the changelog section by hand as "## [1.0.1] - 2026-08-18"
    #      with a fresh empty "## [Unreleased]" above it, and commit that on its own

    # B8 - push, PR, and only after it merges, tag
    git push -u origin fix/v1.0.0-doc-sweep
    gh pr create --base master --title "1.0.1: 33 verified documentation contradictions, plus F3/D10/F4"
    # after merge, from master:
    git tag v1.0.1 && git push origin v1.0.1

**B5 is the one people skip.** Roughly 30% of the README is generated from live
command output, and hand-editing inside a generated block is silently reverted
by the next `gen:docs`. Every change on this branch was made in hand-written
prose, so the generator reports `unchanged` for both documents. If it prints a
diff, stop.

**B6 is the one no test can do.** `test/docs/parity.test.ts` checks that both
documents carry the same example markers in the same order. It cannot check
whether the Hebrew reads well, and your own
`STD-documentation-is-regenerated-not-edited-to-match` says so in as many words.

---

## Part 3 - the prompt

````text
I am picking up a fix branch built for my `my-context` plugin on another
machine. It was never pushed, deliberately. I have a git bundle containing it.

Context you need:

- The branch is `fix/v1.0.0-doc-sweep`, 9 commits, based on `master` at
  `2f306ad` (tag v1.0.0). This is a PATCH: 1.0.1.
- It fixes 33 verified documentation contradictions plus 4 code/test defects
  found by an exhaustive test campaign against v1.0.0.
- Every change was made in BOTH `README.md` and `docs/README.he.md`, because
  `test/docs/parity.test.ts` requires the same example markers in the same
  order across both, and the project's own standard
  (`STD-documentation-is-regenerated-not-edited-to-match`) makes keeping the
  Hebrew current a review obligation.
- The pinned test baseline is **2308 pass / 11 known-red**. The 11 are Node
  24.14.0 emitting `ExperimentalWarning: SQLite is an experimental feature`
  against tests that assert stderr is empty. A twelfth failure is a problem.

Do this:

1. Confirm the tree is clean, then bring the remote up to date:
       git fetch origin

2. Fetch the branch from the bundle (I will give you its path) and check it out:
       git fetch <path-to>/my-context-doc-sweep.bundle fix/v1.0.0-doc-sweep:fix/v1.0.0-doc-sweep
       git checkout fix/v1.0.0-doc-sweep

3. Rebase it onto current master. The branch was cut from `2f306ad` (tag
   v1.0.0) and master has since moved to `3f4ad84` — the v2.0 design artifacts
   and the ROADMAP Q5 note. This was already verified to replay cleanly: the
   eight commits touch `README.md`, `docs/README.he.md`, `src/mcp/protocol.ts`,
   `src/cli/commands/audit.ts`, `test/mcp/protocol.test.ts` and
   `test/core/seen-file.test.ts`, while the new commits touch only
   `docs/ROADMAP.md` and new files under `docs/design/` and `docs/superpowers/`.
       git rebase origin/master
   If it conflicts anyway, stop and show me.

4. Confirm all nine commits are authored "Dudi Bar-On <dudi.bar.on@gmail.com>":
       git log origin/master..HEAD --format='%h %an <%ae> %s'
   If any commit carries a different author, stop and tell me.

5. Run the suite and compare to the pin:
       npm run typecheck
       npm test
   Expect 11 failures, all of them the SQLite ExperimentalWarning on stderr.
   If there is a twelfth, stop and show me which test and its message.

6. Verify the four doc tests specifically, since most of the diff is
   documentation:
       node --test test/docs/parity.test.ts test/docs/examples.test.ts \
                   test/docs/inventory.test.ts test/docs/injection.test.ts

7. Confirm `npm run gen:docs` produces NO diff. Every change was made in
   hand-written prose, none inside a generated block, so the generator must be
   a no-op here:
       npm run gen:docs && git diff --stat
   If that prints changes, stop and show me — it means a marked block was
   edited by hand and I need to fix the source instead.

8. Read the Hebrew changes and tell me if any read badly. I am a native
   speaker and will judge, but flag anything that looks like it was translated
   rather than written:
       git diff origin/master..HEAD -- docs/README.he.md

9. Then STOP and ask me before pushing. Do not push, do not open a PR, and do
   not tag until I say so.

When I approve, push the branch and open a PR against `master` titled
"v1.0.0 documentation sweep: 33 verified contradictions, plus F3/D10/F4",
with a body summarising the four clusters and the four code fixes.
````

---

## Part 4 - what is in the branch

| Commit | Fix |
|---|---|
| `02cdbc8` | **F3** — MCP `serverInfo.version` reported `0.1.0` through the 0.9.0 and 1.0.0 releases. Now read from `package.json` via `core/version.ts`, removing the transcribed constant rather than adding it to `set-version.ts` |
| `3341f13` | **F-090 / F-091 / F-059** — section 8 still said Linux was uncertified and nothing was tagged. Both had shipped; removing them also repairs the section's own opening guarantee |
| `ddd68e9` | **D1-017 / D1-018 / E1-084** — `known_issue` is normative; both READMEs described it as rationale that "lands active". The most consequential defect found |
| `793837e` | **B-006 / B-075 / B-078 / F-060 / F-110** — `tags` and `severity` do gate injection under a focus, denied in six places |
| `9c18f0e` | **B-009 / D1-A1 / D2-079** — "these twenty-five are all of them"; 20 more flags run at exit 0. 25 rows → 47, plus 6 widened "where it works" cells |
| `3f278ff` | **The nineteen singles** — counts, reversed behaviour, guarantees missing their condition, self-contradictions |
| `af0fe17` | **D10 / D11 / D12** — `audit --role` silently filtered nothing outside `--items` and had no validation. Now refused where it means nothing, validated with a closest-match hint, and documented |
| `2fc0c52` | **F4** — a timing test asserting an upper bound on wall-clock backoff went red purely because the READMEs grew ~5%. Now samples three times and keeps the fastest; band unchanged |
| `5e1c87c` | **1.0.1 preparation** — the CHANGELOG entry (step 1 of your release process), and `VERSIONING.md` catching up: its "Before 1.0" section still said "This project is `0.x`" and that Linux certification, session focus and the audit log were unbuilt |

---

## Part 5 - why 1.0.1, and not 1.1.0 or 2.0.0

From `VERSIONING.md`, not from generic SemVer.

**PATCH is defined there as "the program is made to do what it already said it
did."** That is this branch: the documentation is corrected to describe shipped
behaviour, and two bugs are fixed so the code matches what was already
documented. None of the four compatibility surfaces changed meaning - not the
corpus on disk, not the configuration format, not which items land in which
injection tier, and not the CLI, slash-command or MCP contracts.

**The one entry that needs argument is `audit --role`.** It used to be accepted
and ignored outside `--items`; it now exits 1, so a script passing it would
break. `VERSIONING.md` answers this directly, and names the case:

> Closing a hole is a `PATCH` even though behaviour changes, because the old
> behaviour was never the contract. ... **The honest edge:** ... fixing a flag
> that was accepted and ignored means a script that passed it now gets a
> refusal. Those are correct, and they are still a surprise on a Tuesday.
> Anything in that class is called out in `CHANGELOG.md` under **Fixed** with
> what changes in practice - a version number cannot carry that, so the
> changelog has to.

So: **PATCH, and the changelog carries the surprise.** It does - the
`audit --role` entry states what exits 1 now, who is affected, and what is
unchanged.

**Not MINOR:** nothing new was added. The flag reference grew from 25 rows to
47, but every one of those flags already shipped in 1.0.0. The document was
incomplete; the product was not.

**Not MAJOR:** no category was removed or retiered, no config key changed
meaning, no command or tool was removed, no `--json` field changed. The
`known_issue` fix is *documentation* catching up to a tier change that shipped
long ago - the category did not move in this release.

**One line about `serverInfo.version`.** MCP clients now receive `1.0.0` instead
of `0.1.0` at `initialize`. That is a value correction on a surface that was
reporting a falsehood, not a contract change.

---

## Part 6 - three things to decide yourself

These were deliberately **not** changed.

**1. `F1` — the 11 known-red tests.** Node 24.14.0 emits
`ExperimentalWarning: SQLite is an experimental feature` and eleven tests assert
stderr is empty. Your CI pins `node-version: '24'` and went green on
2026-08-16, so this is specific to 24.14.x. The fix would be to filter Node's
own runtime warnings from those assertions — faithful to their intent, since
they mean "no stray output from *our* code" — but it edits a stderr assertion to
accommodate an environment, and that can hide a real regression later. Your
call.

**2. `L-F1` — `Bash` bypasses the write-deny.** The `PreToolUse` deny covers
`Read|Edit|MultiEdit|Write|NotebookEdit`. A shell write into `.my_context/` is
neither denied nor audited, and a hard link bypasses the path check too (a
second inode name is invisible to canonicalisation). Everything else holds:
`\\?\`, `\\localhost\C$`, 8.3 short names, junctions and `..` are all denied.
Intercepting shell is not feasible, so the honest fix is documentation. Note
that `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` — your
own recorded standard — already anticipates exactly this, and section 7 already
discloses the Bash-shaped hole. You may consider this adequately covered.

**3. `L-F2` — `actor` vs `origin`.** The MCP `audit_log` tool takes `actor`;
the CLI flag and the stored record field are both `origin`. Cosmetic, but it is
one concept with two names across two surfaces. Renaming the MCP parameter is a
breaking change to a tool schema, which is why it was left alone.

---

## Part 7 - remaining findings, not fixed

From the earlier sweeps, still open and documented in `FINDINGS.md`:

`D2` `D3` `D4` `D5` `D6` `D7` `D8` `D9` `D13` `D14` `D15` `D16` `D20` `D21`
`F2` — mostly CLI message-consistency issues (`repair` says "unknown flag"
where its siblings say "unknown option"; `rebuild` accepts an unknown flag
silently; `list --short` is byte-identical to bare `list`). Two are more than
cosmetic and worth your judgement:

- **`D20`** — `PostToolUse` never writes to the audit ledger, while every other
  hook does. Either an omission or a deliberate choice about noise; the code
  does not say which.
- **`D21`** — `link_items` records the relation on the source item only, so the
  target has no back-reference. Whether that is a bug depends on whether
  relations are meant to be readable from both ends.

They were left because each is a small design decision that should be yours,
not because they are hard.

---

## Part 8 - the campaign's own artefacts

Everything is in the test repository, not the plugin:

| File | What |
|---|---|
| `reports/FINDINGS.md` | all findings, with evidence per claim |
| `reports/COVERAGE.md` | what was tested, what was not, and the ten records that prove nothing |
| `reports/LIVE-PASS.md` | the 22 live checks inside Claude Code |
| `reports/TUTORIAL.md` | new-user quickstart, all output real |
| `reports/TUTORIAL-ADVANCED.md` | tiers, scope policy, focus, budgets, pipelines, audit |
| `reports/claims/section-*.md` | all 716 README claims, verdict by verdict |
| `reports/HANDOVER.md` | campaign state |
