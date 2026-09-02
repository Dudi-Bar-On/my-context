# Transfer and apply — v2.0 review batch

**One bundle, four independent branches.** Each is a single commit on top of your
current `master` (`6265115`), authored `Dudi Bar-On`, and none depends on the
others — merge in any order, or only some.

```
reports/fix-branch/mycontext-v2-review.bundle       (33 KB)
```

| Branch | Files touched | Needs a release? |
|---|---|---|
| `ci/reduce-minutes` | `.github/workflows/ci.yml` | no |
| `fix/audit-note-visible` | `src/cli/commands/audit.ts`, `test/cli/audit.test.ts` | **your call — see below** |
| `docs/v2-review-addendum` | one new file under `docs/superpowers/specs/` | no |
| `docs/v2-expert-review` | one new file under `docs/superpowers/specs/` | no |

---

## Step 1 — copy one file

Copy `mycontext-v2-review.bundle` to your other workstation and put it **outside**
the `my-context` folder. The parent directory is easiest: if the repo is at
`C:\projects\my-context`, the bundle goes in `C:\projects\`.

## Step 2 — bring the branches in

```bash
git status                 # must be clean
git checkout master && git pull

git fetch ../mycontext-v2-review.bundle \
  ci/reduce-minutes:ci/reduce-minutes \
  fix/audit-note-visible:fix/audit-note-visible \
  docs/v2-review-addendum:docs/v2-review-addendum \
  docs/v2-expert-review:docs/v2-expert-review
```

Adjust `../` if you put the bundle elsewhere. Forward slashes work on Windows.

## Step 3 — check what arrived

```bash
git log master..ci/reduce-minutes      --format='%h %an  %s'
git log master..fix/audit-note-visible --format='%h %an  %s'
git log master..docs/v2-review-addendum --format='%h %an  %s'
git log master..docs/v2-expert-review  --format='%h %an  %s'
```

One commit each, all `Dudi Bar-On`. If any shows a different author, stop.

## Step 4 — the two documentation branches

Nothing to test — each adds one new file and touches nothing else.

```bash
git checkout docs/v2-expert-review
git push -u origin docs/v2-expert-review
gh pr create --base master --title "docs: v2.0 expert review addendum"
```

Same for `docs/v2-review-addendum`. **Read them before merging** — the expert
review recommends changes to the plans, the spec and the mockup, and those
recommendations are yours to accept or reject.

## Step 5 — the CI branch

```bash
git checkout ci/reduce-minutes
git push -u origin ci/reduce-minutes
gh pr create --base master --title "ci: run each commit once"
```

**This will not fix CI while your Actions quota is exhausted.** Nothing in a
workflow file can — a run is refused in about four seconds, before the triggers
are read. It halves future consumption. The self-hosted Windows matrix is
prepared in the file but deliberately switched **off**, because a job requesting
a label no online runner offers queues forever rather than failing, and CI
appearing to hang is worse than CI breaking. Flip the two commented lines once a
runner is registered.

## Step 6 — the code fix

```bash
git checkout fix/audit-note-visible
npm run typecheck && npm test
```

Expect **2323 tests, 2311 pass, 11 fail**. The 11 are Node 24.14.x printing
`ExperimentalWarning: SQLite is an experimental feature` against tests asserting
stderr is empty — they fail on `master` too, and were compared by test *name*,
not just by count. **A twelfth failure is a problem.**

Then see the change on a workspace where a run was degraded:

```bash
mycontext audit --kind injection
```

A row carrying a note now ends `— note`, and a legend appears under the table
only when at least one row is marked.

```bash
git push -u origin fix/audit-note-visible
gh pr create --base master --title "fix(audit): show that an injection record carries a note"
```

---

## The one decision: does the audit fix warrant a release?

It changes output on a released surface — `mycontext audit` prints a marker and a
legend it did not print before. Under `VERSIONING.md` that is a **PATCH**: the
program made to do what it already said it did. It is also squarely the case the
"honest edge" paragraph exists for.

If you cut it as `1.0.2`, follow `VERSIONING.md § Cutting a release`. The
changelog section is **not** written for it yet — unlike 1.0.1, where step 1 was
done in advance. A suggested **Fixed** entry, written to the "what changes in
practice" requirement:

> `mycontext audit` now marks an injection record that carries a note, and prints
> a legend when any row is marked. Five degradation disclosures were being written
> to the audit log and rendered nowhere a person reads — among them "N item
> file(s) dropped by the fallback", which is `INV-nothing-is-dropped-silently`'s
> own case. The note itself is not appended to the table: three real note shapes
> push the table's floor to 113–123 columns against a 100-column budget, past the
> point where `table()` stops narrowing, so the terminal would rewrap.
> `mycontext audit --json` prints notes in full.

The two documentation branches and the CI branch need no release and no tag.

---

## What the two review documents contain

**`2026-08-18-v2-review-addendum.md`** — a verification pass. Its §0 marks each
section EXECUTED, READ or RECOMMENDED, and §1–§3 rest only on things that were
actually run. It closes the never-miss guarantees by execution — including
**1,532 ms on the hook path against 17,583 ms on the manual path** under the same
held write lock — records the audit-note defect, and corrects web-ui §9.5.

**`2026-08-18-v2-expert-review-addendum.md`** — ten specialist reviews
consolidated: architecture, UI/UX, CSS/RTL/i18n, performance, client state,
security, silent failures, testing, API contracts, and corpus coherence. Every
finding is marked **[V]** verified, **[M]** measured, or **[R]** reasoned.

Its headline is structural: **none of the three plans' base commits is an
ancestor of HEAD.** They were written on branches that diverged and never merged
back, so three shipped refactors are invisible to all three plans. That is the
root cause of four of its six critical findings, and why §8.1 recommends a
mechanical re-verification pass per plan rather than patching citations one at a
time.

§9 records what held, which is most of the design: every §9 pinned decision
survived inspection, the three-way plan split is the right seam, and the
live-watch design is sound.

---

## If you would rather paste one prompt

Open Claude Code in your `my-context` clone and paste this, fixing the path on the
first line:

````text
BUNDLE: ../mycontext-v2-review.bundle

That file is a git bundle with four independent branches, each one commit on top
of current master, all authored Dudi Bar-On. Bring them in and verify them, but
do not push until I say so.

1. Confirm `git status` is clean, then: git checkout master && git pull

2. git fetch <BUNDLE> \
     ci/reduce-minutes:ci/reduce-minutes \
     fix/audit-note-visible:fix/audit-note-visible \
     docs/v2-review-addendum:docs/v2-review-addendum \
     docs/v2-expert-review:docs/v2-expert-review

3. For each of the four branches run:
     git log master..<branch> --format='%h %an  %s'
   Expect exactly one commit each, all authored Dudi Bar-On. If not, stop.

4. git checkout fix/audit-note-visible && npm run typecheck && npm test
   Expect 2323 tests, 2311 passing, 11 failing. All 11 must be the node:sqlite
   ExperimentalWarning hitting tests that assert stderr is empty; those same 11
   fail on master. If there is a twelfth failure, stop and show me which test
   and its message.

5. Show me `git diff master..docs/v2-expert-review --stat` and the first 60
   lines of the new file, so I can see what it covers before I read it properly.

6. Then STOP. Do not push, do not open a pull request, do not tag.

For context: the two docs branches and the ci branch need no release. The audit
fix changes output on a released surface and may warrant a 1.0.2, which I will
decide separately.
````
