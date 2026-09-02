# R5 — The export format, and whether history travels

**Re-opens two rulings from `R3-devtools.md`** at the owner's instruction: the *format* (R3 ruled on a
tarball because `REQUIREMENTS-ADDENDUM-2.md` offered one, not because it surveyed) and the conclusion
that *history does not travel* (R3: "state in the design that git is the history export, and that the
audit log is deliberately not exported. Do not build a history serializer"). R3's **git findings stand
and are inherited**, including the verified `git subtree split | git bundle | git subtree add` recipe,
the no-subprocess-from-a-hook ruling, the quarantine-on-arrival trust model, the mandatory Unicode
screen, and the no-registry ruling. Nothing below contradicts those.

**Evidence markers.** `[V]` — verified by executing it on this machine, this session, against the real
repository or a scratch workspace driving the project's own modules. `[W]` — verified this session
against a primary web source, cited. `[B]` — inference, argued but not executed. Every ruling says
which it is. Web search was used for §"Formats, ruled" rows 3–13 and for the cryptography in
§"Provenance"; it is marked inline.

---

## Formats, ruled

Measured against the six questions asked, plus one the brief did not ask and that turns out to
separate the candidates more sharply than any of the others — **is the artefact reproducible**, i.e.
do two exports of an unchanged corpus produce the same bytes.

| # | Format | History | Provenance | Verifiable | Diffable | Reproducible | Tool receiver may lack | 40 / 5,000 items | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Plain directory, workspace shape** | only what you put in it | in files | via manifest | `diff -r`, `git diff` — per item | trivially | **none** | 63 KB / ~7 MB `[V]` | **ADOPTABLE — the canonical form** |
| 2 | **Deterministic ZIP**, written with `node:zlib` only | no | in files | per-entry CRC32 + manifest | after unpack | **yes, if normalised** `[V]` | none — every Windows since XP, macOS, Linux `[W]` | fine at both | **ADOPTABLE — the single-file spelling** |
| 3 | **tar / tar.gz** | no | in files | manifest only | after unpack | only with the full normalisation list `[W]` | Explorer double-click needs **Win 11 post-Oct-2023**; Win 10 has CLI only `[W]` | fine at both | **ADOPTABLE-AS-FALLBACK** — dominated by ZIP |
| 4 | **`git bundle`** (corpus-only branch) | **yes, natively** | commit author/date/message, signable | `bundle verify` checks format + prerequisites, **not** object content `[W]` | yes, after clone | no (pack bytes vary) | **git** | fine at both | **ADOPTABLE — the history spelling** |
| 5 | **A git repository as the artefact** | **yes** | as above, plus `git pull` to update | signed tags/commits | yes, natively | n/a | git | fine at both | **ADOPTABLE — the R13 pack shape** (R3's ruling, kept) |
| 6 | **OCI artefact** | no | digest + `artifactType` (image-spec 1.1.0, 2024-03-13) `[W]` | strong (digest-addressed) | no | yes | **a registry, and in practice `oras`/`crane`** `[W]` | fine at both | **INCOMPATIBLE** — the registry is an operator and a liability |
| 7 | **SQLite as the container** | whatever you put in it | in tables | none built in | **no** — binary | no | none (`node:sqlite` present) | fine at both | **INCOMPATIBLE** — see below |
| 8 | **JSON Lines, everything in one file** | yes if included | in records | manifest | line-per-item only | yes | none | fine at both | **INCOMPATIBLE as the container** / **ADOPTABLE for the history payload** |
| 9 | **mbox-style Markdown concatenation** | no | in the text | none | yes, textually | yes | none | fine at both | **INCOMPATIBLE** — RFC 4155 mandates **no** escaping scheme; `From ` re-quoting is a known corruption source `[W]` |
| 10 | **`git fast-export` stream** | **yes** | commit metadata | none standalone | poorly | no | git | fine at both | **INCOMPATIBLE** — strictly dominated by #4; docs assign the stream **no version and no stability guarantee** `[W]` |
| 11 | **Bespoke length-prefixed stream** (fast-import's `data <count>\n<raw>` framing `[W]`) | yes if included | in records | manifest | no | yes | **mycontext is the only reader** | fine at both | **INCOMPATIBLE** — buys nothing over #1 and costs every other tool |
| 12 | **Content-addressed serialisation (Nix NAR, IPFS CAR)** | no | digest | **strong** | no | **yes, by design** `[W]` | a NAR/CAR reader | fine at both | **ADOPTABLE-AS-PRECEDENT** — steal the determinism rules, not the format |
| 13 | **A sorted manifest of full SHA-256 digests** | no | yes | **yes** | yes (it is text) | yes | none (`node:crypto`) | fine at both | **ADOPTABLE — mandatory, and container-independent** |

### The three rows that need their reasoning shown

**#7, SQLite.** Tempting: one file, `node:sqlite` is already a dependency-free stdlib module the
project uses, it holds heterogeneous payloads, and it scales. Four objections, any one sufficient.
`[V]` On this machine (Node **v24.14.0**) `require('node:sqlite')` still prints
`ExperimentalWarning: SQLite is an experimental feature and might change at any time`; `[W]` the module
is documented at **Stability 1.1 (Active development)** through 24.0.0–24.14.x and only reaches
**1.2 (Release Candidate)** in 24.15.0 (2026-04-15). A wire format that two machines must agree on
cannot rest on a module whose own maintainers reserve the right to change it — the *disposable index*
can, and does, because deleting it costs nothing. Second, it is binary: no `git diff`, no PR review, no
reading it in a text editor, and the project's whole culture is that the artefact is readable.
Third, one corrupt byte can lose the whole file, where a directory loses one item. Fourth and worst,
it inverts the product's founding invariant: `INV-markdown-is-the-source-of-truth` plus "JSONL is
truth, SQLite is a disposable projection" would become "the projection is the transport."

**#8, JSON Lines as the container.** Encoding every Markdown body as a JSON string means the artefact
is no longer the corpus, it is an *encoding* of the corpus, and the invariant should extend to the
wire. It also destroys per-item diff granularity — a one-word change to one rule is a changed 4 KB
line. `[W]` And JSON Lines has no RFC and no IANA-registered media type; `.jsonl` /
`application/jsonl` are community conventions on jsonlines.org, which is fine for a payload named by a
versioned manifest and not fine as the identity of the whole artefact. **But it is exactly right for
the history payload** — because there it is *inherited* rather than invented: the audit log is already
JSONL, so `history.jsonl` introduces no new format at all.

**#4 vs #2, and what `git bundle verify` actually promises.** `[W]` The documented scope of
`git bundle verify` is that the bundle is well-formed and that its prerequisite commits exist and are
fully linked in the receiving repository. It is not documented as re-hashing object content; the
integrity you get is git's ordinary content-addressing, `[W]` still SHA-1 by default (with the
collision-detecting `sha1dc` implementation, default since Git 2.13, 2017). `[W]` Bundle v3 adds a
capabilities section carrying `object-format` and `filter`, so a SHA-256 bundle is expressible, but
SHA-256 repositories remain opt-in and poorly supported by hosts. **Practical reading: a bundle's
verification claim is "these objects hash to these names," which is real but weaker than people
assume, and it is orthogonal to whether the rules inside are safe.** That distinction has to appear in
the same sentence as any claim about it, per
`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`.

---

## The recommendation

**R3's mistake was not choosing tar. It was treating "the format" as one question.** It is three, and
separating them dissolves most of the argument.

### 1. The identity layer — `manifest.json`, and it is the only part that is mandatory

A sorted list of `{path, sha256}` over every file in the export, a single digest over that sorted
list, the format version, the producing mycontext version, the source identity (a URL and a resolved
commit sha when there is one), the source's resolved category configuration, and the filter that
produced the selection. Full SHA-256, never the item `checksum` field — `[V, R3]` that field is
`sha256(content).slice(0, 16)`, a **64-bit truncation** whose birthday bound is ~2³²; it is adequate
for noticing a hand edit and useless as an integrity control, and confusing the two would ship
something that looks like a supply-chain control and is none.

The manifest is **derivable and never authoritative** — if it disagrees with the items, the items win
and the disagreement is reported, or it contradicts `INV-markdown-is-the-source-of-truth`.

The payoff is the argument that settles the format debate: **once identity lives in the manifest, the
container is a delivery detail.** The same corpus shipped as a directory, a zip and a bundle has one
digest. Re-containerising does not change what you reviewed. Two people can compare exports by
comparing one hash. Nothing else in this report buys as much for as little.

`[W]` Copy the shape from OPA's `.signatures.json` (`files: [{name, hash, algorithm}]`) and the
discipline from OCI descriptors (digest + media type + size) without adopting either transport.

### 2. The canonical form — a plain directory in the workspace shape

```
manifest.json
config.json
items/<category>/<ID>.md
history.jsonl          ← new; see Part 2
```

Zero code to produce. `diff -r` and `git diff` work per item, which is the granularity a reviewer
needs when R3's trust model puts forty stranger-authored drafts in front of them. One damaged file
loses one item. Every tool on earth reads it.

And one property no container has: **it unpacks into something that is already a valid `.my_context/`,
minus the machine-local directories.** A receiver with no plugin, no git and no patience can copy
`items/` into their workspace and be done — `[V, R3]` every CLI command opens through
`openRebuiltStore`, which rebuilds the index from Markdown first, so the receiver rebuilds itself and
needs to be told nothing. **Import's manual fallback is `cp -r`, and that is a feature, not an
admission.** Every clever container destroys it.

Every other spelling is a *packaging* of this directory and must unpack to byte-identical content —
which the manifest proves rather than promises.

### 3. The single-file spellings — two, chosen by what the receiver has

**If the receiver has git and you want the corpus's own revision history: `git bundle`.** R3 verified
the recipe end to end; I inherit it. It is the only container that carries history natively, is
incrementally updatable (`git subtree pull`), and can be signed with machinery the receiver already
has. Constraint unchanged: CLI-time subprocess only, never from a hook.

**If the receiver has nothing and needs one file: a deterministic ZIP, written by the plugin.**

`[V]` **Verified by execution, not argued.** A 64-line writer using only `node:zlib`
(`deflateRawSync` + `crc32`, both present on Node 24.14.0) and `node:fs`:

- produced a **byte-identical archive on two consecutive runs** —
  `63afedc0f30f7d64…` for both, because entries are sorted by name and the DOS timestamp is pinned to
  a constant;
- was read correctly by **`C:\Windows\System32\tar.exe`** (`tar -tf`) and extracted correctly by
  **PowerShell `Expand-Archive`**, recreating `items/rule/RULE-a.md` at the right path.

`[W]` And ZIP is the only archive a non-technical receiver can double-click on **every** supported
Windows — Compressed Folders since Windows XP. Native Explorer extraction of `.tar`/`.tar.gz`/`.7z`
shipped only in **KB5031455, 2023-10-31, Windows 11 22H2+**; Windows 10 has `tar.exe` on the command
line (since build 17063, Dec 2017) and **no Explorer support at all**. `[W]` macOS and Linux open both.
So tar's only advantage — a marginally simpler writer — is paid for by the receivers most likely to
be non-technical.

**The determinism requirement is not decoration and it is where naive tar/zip both fail.** `[W]`
reproducible-builds.org's archive checklist names the causes precisely: mtimes, entry ordering,
uid/gid, PAX/extra headers, permission bits. `[W]` Nix's NAR format exists specifically to eliminate
all of them so a directory tree has one canonical byte serialisation. mycontext does not need NAR — it
needs NAR's *rules*: **sort entries by path, pin the timestamp to a constant, write no owner
metadata, write no extra fields.** Four lines, and without them "did this export change" becomes
unanswerable without unpacking.

### 4. What this costs, honestly

The plugin gains a ZIP writer (~64 lines, verified) and a ZIP reader (~50 lines: parse the
end-of-central-directory record, walk the central directory, `inflateRawSync` each entry) — plus the
manifest builder, which it needs regardless. `[B]` The Zip64 limits (>4 GB total, >65,535 entries) are
unreachable for a corpus measured at **1,475 bytes/item mean, 5,256 bytes max, 44 items = 63 KB**
`[V]`, projecting to **~7 MB at 5,000 items**, but the limit belongs in a comment so the next person
does not discover it.

### 5. Rejected, in one line each

OCI (`[W]` the Distribution Spec needs no client *binary*, but it needs a *registry* — an operator,
an availability dependency, and the liability in every supply-chain incident R3 surveyed). SQLite
(§ above). JSONL-as-container and any bespoke length-prefixed stream (mycontext becomes the only
reader; Markdown stops being the artefact). mbox-style concatenation (`[W]` RFC 4155 mandates no
escaping; `>From ` re-quoting corrupts bodies; and no reader exists for "an mbox of Markdown items").
`git fast-export` (`[W]` no versioning, no stability guarantee, strictly dominated by `git bundle`).

---

## History — which records travel

The owner's instruction is that the audit travels "native or filtered — it just should include the
relevant info logged so it could fit." Here is the cut, per record kind, against the real log.

**The measurement first, because it decides most rows.** `[V]` This workspace's live log: **116
records, 60,691 bytes**, over two days on a 44-item corpus. By kind: **88 injections (52,408 bytes,
86% of the file)**, 28 hook records (8,283 bytes), **zero mutations**. Distinct sessions: 2. And from
those 116 records I recovered **40 distinct file paths from the publisher's repository** —
`src/core/select.ts`, `.github/workflows/release.yml`, `docs/design/web-ui-mockup.html`,
`docs/superpowers/specs/2026-08-18-v2-decisions.md` — and, from the `note` field alone, **the id and
type of every subagent the publisher ran**: `pr-review-toolkit:silent-failure-hunter`,
`frontend-excellence:css-expert`, `feature-dev:code-architect`, `claude-code-guide`. That is what "a
short, non-content note" turned out to contain in practice.

| Record kind (`op`) | Travels? | Why | Redaction |
|---|---|---|---|
| `mutation` / **`create`** | **Yes** | The only record of when an item was authored and by what `origin`. `[V]` The item file carries **no `created` and no `updated` field** — `COMMON_KEYS` in `item.ts` has `valid_from`/`valid_until`, which are *semantic validity*, not authorship. Without this record the receiver cannot date the item at all. | **None needed.** `[V]` `auditMutation` (persist.ts) sets no `sessionId` and no `path`; a mutation record is `{at, kind, op, origin, itemId, fields, note?}`. |
| `mutation` / **`promote`**, **`accept`** | **Yes — the single most valuable record** | This is the human crossing the draft→active trust gate. `origin: human` on a `promote` is the machine-readable form of "a person read this before it started governing." Nothing else in the export says it. | None. |
| `mutation` / **`update`**, **`refresh`** | **Yes** | `fields` names which item columns actually moved, so a receiver sees churn without the text. `refresh` is a *negative* signal worth keeping — it records a re-stamp after a hand edit. | None. `fields` is schema vocabulary. |
| `mutation` / **`supersede`** | **Yes** | `note` is `by <itemId>` — structured, corpus-internal, and exactly the retirement link a receiver wants. | Only via the **join rule** below: drop the note if the replacement item is not in the export. |
| `mutation` / **`link`**, **`unlink`** | **Yes** | `note` is `<relation> <targetId>` — structured. Relation history explains a graph the receiver otherwise sees only in its final state. | Join rule. |
| `mutation` / **`stage`** | **Yes, record only** | Records that a change was proposed and by whom. | `[V]` `note` is a bare `revisionId` pointing into `.revisions/`, which is gitignored and does not travel — **a dangling pointer**. Drop the note, keep the record. |
| `mutation` / **`discard`** | **Yes, note redacted by default** | "Nobody approved this" is as much a fact about a corpus as an approval is — the module says so itself. | `[V]` `revision.ts:1204` writes `note: "<revisionId>: <free-text human reason>"`. **Free text authored by a human is the leak in the travelling set.** Strip everything after the revisionId unless `--include-notes`; report the count dropped. |
| `injection` / `session-start`, `jit`, `compact-restore`, `manual` | **No** | Four independent reasons, any one sufficient. (1) An injection into a session the receiver never had is unfalsifiable and unusable. (2) `[V]` It is **86% of the log's bytes**. (3) `[V]` `sessionId` and `path` are pure local leakage — 40 repo paths from 116 records. (4) **The decisive one:** replaying a foreign injection into the receiver's ledger would make `seen` suppress items on the hot path that were never injected — `ledgerRows`' own documented third limit, applied across a machine boundary. | n/a — excluded wholesale. |
| *(derived)* **per-item usage summary** | **Yes, as a statistic, in the manifest** | The one useful thing injections say to a stranger is "this rule is actually used." `{id, injections, spills, firstSeen, lastSeen}` at day granularity answers it. | Carries **no** session id, **no** path, no sub-day timestamps. Must be labelled a derived statistic, never a record, and must not enter `history.jsonl`. |
| `hook` / `post-tool-use` | **No** | `[V]` `path` + tool name + `"<Tool> on a watched document — capture nudge emitted"` is a keystroke-level edit history of the publisher's repository. | n/a. |
| `hook` / `deny` | **No** | `[V]` `path` + `"<tool> refused"` — local security telemetry about the publisher's permission configuration. | n/a. |
| `hook` / `pre-compact` | **No** | Session lifecycle on another machine. | n/a. |
| `focus` / `focus-set`, `focus-clear` | **No** | A statement about one session on one machine, not about the corpus. `[V]` And `describeFocus` puts `scope: <globs>` into the note — the publisher's directory layout again. | n/a. |

### The cross-cutting rule the table depends on: **join the history filter to the item selection**

A mutation record naming an item the export *excluded* leaks that item's id — and mycontext ids are
not opaque handles. `[V]` They are slugified titles: `RULE-postgres-pool-capped-at-20`,
`INV-hooks-fail-open`, `LESSON-dogfooding-found-the-missing-edit-path`. **An id is a sentence.** So a
history that is filtered by *kind* but not by *item* silently republishes the subject of every rule
the publisher deliberately withheld. Filter both, and report the count of records dropped for that
reason separately from the count dropped by kind — `INV-nothing-is-dropped-silently` applied to the
history filter.

Two smaller notes. **Timestamps stay.** They reveal working hours and time zone across an
organisation; that is real and minor, and provenance without time is worthless. Say it in the docs
rather than dropping the field. **Name the file `history.jsonl`, not `audit.jsonl`, and give it its own
protocol string** (`my_context/audit-export@1`) — so that a receiver who drops the unpacked folder
into `.my_context/` cannot accidentally poison their own log. `[V]` `jsonl-log.ts` refuses a protocol
mismatch on every line, so the wrong file in the wrong place fails loudly instead of merging quietly.

### The size answer

`[V]` A mutation record is ~160–220 bytes on the observed shape. At three mutations per item that is
**~26 KB for 40 items and ~3 MB for 5,000** — comparable to the corpus itself and entirely
unremarkable. `[V]` Injection records do **not** grow with corpus size: the `injected` array is bounded
by `DEFAULT_BUDGETS` (`pinned: 6000, index: 1200` tokens), and the observed session-start record is
~1.5 KB whether the corpus is 44 items or 5,000. Their *count* grows with tool calls — 85 `jit`
records in two days here. So the exclusion of injections is a decision about meaning and leakage, not
about size; it just happens to remove 86% of the bytes as well.

---

## Provenance: can history justify trust?

**It can justify a reading order. It cannot justify skipping review.** Argued in both directions,
because this is the question the owner is really asking.

### The strongest case for exporting it — and it is stronger than R3 allowed

R3 ruled: *"Git answers what did this rule say, and when did it change, and who changed it… That is
the question an importer cares about."* Two verified facts undercut that.

**First, the item file cannot answer it.** `[V]` `COMMON_KEYS` in `item.ts` is `id, type, title,
status, severity, always, scope, tags, origin, source_file, source_anchor, source_checksum,
valid_from, valid_until, checksum`. There is **no creation date and no modification date**. `origin` is
a *single current value* overwritten by the last write. So an item that was drafted by an agent and
later edited by a human is indistinguishable, on disk, from one a human wrote outright. For a receiver
whose transport is a directory, a zip or an OCI blob — anything but git — **the mutation log is the
only artefact that can date an item or say who touched it.**

**Second, git records the commit, not the act.** `[V]` In this repository, **33 of 44 corpus items
(75%) have exactly one commit**, and it is the bulk `feat: dogfood my_context with its own normative
knowledge` by one committer on 2026-08-13. Twenty-two commits touch `.my_context/items` in total. A
bulk commit collapses forty authoring decisions — some `human`, some `agent`, some promoted through
review and some not — into one line with one name on it. **The audit log does not collapse them.** So
even in the case R3 optimised for, git's answer is thinner than the audit's, and it is thin in exactly
the dimension (`origin`) that the product's entire trust boundary is built on.

### The strongest case against — and it is decisive about what history may *authorise*

**The audit log has no integrity control whatsoever.** `[V]` I read `audit.ts`, `audit-db.ts`,
`jsonl-log.ts` and `ledger-replay.ts`: there is no hash chain, no per-record digest, no sequence
number, no signature. Its defences are entirely structural and entirely local — append-only by
convention, one `protocol` check per line, a torn tail truncated before the next append, and byte-offset
divergence detection in the projection. **Not one of those survives leaving the machine.** An exported
`history.jsonl` is a text file the publisher wrote, and the publisher is the party whose
trustworthiness is in question. It is **testimony, not evidence.**

The item `checksum` cannot rescue it: `[V, R3]` 16 hex chars is a 64-bit truncated SHA-256 with a ~2³²
birthday bound. And note a detail R3's provenance proposal walks into: `[V]` `computeItemChecksum`
covers `id, type, title, status, severity, always, scope, tags, origin, extra, body, observations,
relations` — it does **not** cover `source_file`, `source_anchor` or `source_checksum`. So the three
fields R3 proposes to hold an imported item's pack provenance are **outside the item's own checksum**,
and editing them is invisible to `doctor`. That needs saying wherever that proposal is implemented.

`[W, R3]` And the @antv finding applies verbatim and forecloses the obvious wrong design: 639
malicious package versions carried **forged SLSA provenance that passed npm's verification**. Attested
provenance was forgeable; *self*-attested provenance, which is all an exported audit log is, is
strictly weaker. **No quantity of exported history may downgrade R3's Layer 1 quarantine.** Everything
lands `draft`. No exemption, and specifically no "items with a clean human-promotion history import as
active" — that flag is the hole, spelled in provenance instead of in a signature.

### What history should therefore be used for — three things, all worth building

**1. Rank the review queue.** R3 correctly refused `--promote-all` and correctly accepted the cost:
importing "the React flavour" gives you forty drafts, not forty rules. History solves the *queue*
problem without opening a hole, because it changes the **order**, not the **gate**. Created by
`agent`, promoted by `agent` ninety seconds later, updated three times last week, never injected →
read first. Created by `human`, promoted by `human` eight months ago, unchanged since, injected 300
times → read last. Same forty reviews; a fraction of the time to the first useful finding.

**2. Corroboration at import — worth more than the history itself.** Cross-check the history against
the items it accompanies and report agreement *and* disagreement:

- does every exported item have a `create` record? *Absent means the history does not cover this item —
  which must be said, never inferred as "no changes."*
- does the item's frontmatter `origin` match the `origin` on its last content-changing mutation?
- **does every item arriving as `status: active` have a `promote` or `accept` record with
  `origin: human`?**

The third is the one that pays. *"This stranger's rule governs your project and nothing in the history
they shipped shows a human ever approved it"* is an actionable sentence produced by one join, and it
is unavailable from any other artefact. Agreement proves only self-consistency — a forger who edits
frontmatter can edit the log too — but **disagreement is a finding**, and the asymmetry is worth the
code.

**3. Disclose the sparse case, loudly.** `[V]` This very workspace would export a history containing
**zero mutation records**: the log begins 2026-08-17 and the corpus was written 2026-08-13. Exported
history is sparse by construction — the log rotates, machines are wiped, the log is gitignored so a
fresh clone starts empty. Import must print *"history covers 0 of 44 items"* rather than rendering an
empty section that reads like a clean bill of health. That is `INV-nothing-is-dropped-silently` at the
feature level, and it is the failure mode this feature will actually hit first.

### If you ever want filtered history to be genuinely verifiable

`[W]` The construction question has a settled answer and it is not the obvious one. A **hash chain**
(`hₙ = H(hₙ₋₁ ‖ recordₙ)`) is the wrong primitive here: removing a record breaks re-derivation for
everything after it unless you disclose the removed record's hash — which leaks the existence of
exactly what you filtered out. A **Merkle tree with inclusion proofs** is the right one: each surviving
record proves membership against a single signed root, and the records you removed need never be
revealed. That is **RFC 9162** (Certificate Transparency v2.0, December 2021, obsoleting RFC 6962), and
it is why Trillian and Sigstore Rekor are Merkle-based rather than chained. `[W]` The redaction case
even has a formal standard now — **ISO/IEC 23264-2**, redaction of authentic data, adopted 2024-08-26.

**Ruling: do not build it, and reserve the field.** Three costs, the last fatal. A hash per record on
the append path — which is the `PreToolUse` path under a 50 ms p95 ceiling. A signing key, which is a
key-management story a plugin should not own. And a root that must be published somewhere the
publisher cannot rewrite: **a Merkle root signed by the publisher and shipped inside the publisher's
own export proves nothing against an attacker who controls the publisher. A transparency log needs a
witness, and mycontext has no business operating one** — which is R3's no-registry ruling arriving
again from a different direction. So: put `"integrity": null` in the manifest with a documented
meaning, so a later version can fill it without a format break, and **never describe the export as
verified history** in any surface.

---

## Merging into an existing log

This is the part where I stopped reasoning and ran it, because the failure is silent.

### The mechanics, verified

`[V]` There are **two** independent recorded read positions over `.audit/`, not one:
`audit_source(file, bytes, records)` in `.audit/audit.db` (`audit-db.ts`), and `ledger.sourceBytes(file)`
in `.index.db`, consumed by `topUpLedger` (`ledger-replay.ts`). Both track a **byte offset per segment
path**. Both treat "a segment shrank or vanished" as `diverged` → discard and rebuild (safe). Both
treat "a segment grew" as `behind` → **resume from the stored offset**.

**Therefore the corrupting operation is precisely: rewriting a segment so that it stays the same size
or grows. Merging foreign records into `audit.jsonl` in timestamp order is exactly that operation.**

`[V]` **Demonstrated** on a scratch workspace driving the project's own `audit-db.ts` (Node 24.14.0):

| Operation | `projectionState` | Result after `syncProjection` |
|---|---|---|
| Pure append at EOF (what a local write does) | `behind` | Correct — `RULE-1, RULE-2, RULE-3` |
| Rewrite-larger, foreign record merged in timestamp order, **fixed-width ids** | `behind` | **`RULE-1, RULE-2, RULE-3, RULE-3, RULE-99`** — one record duplicated, the merged-in foreign record **silently absent**, no error raised |
| Rewrite-larger, same merge, **realistic variable-length ids** | `behind` | **THROWS** `"the audit log … cannot be trusted"` — the stale offset lands mid-record and the whole log becomes unreadable |
| Rewrite smaller (shrink) | `diverged` | Correct — discarded and rebuilt |

So merging in place yields **silent duplication or total refusal, decided by byte luck**. Both are
unacceptable; only one is visible. And `mycontext audit` answers from the projection, so the silent
case is the one a user would act on.

### The design, which is forced rather than chosen

**1. Never write a foreign record into `audit.jsonl` or any `audit.<stamp>-<pid>.jsonl` segment.** Not
a preference — the table above is what happens.

**2. You also cannot wrap foreign records in an envelope and put them in a segment.** `[V]`
`jsonl-log.ts` refuses a `protocol` mismatch **on every line, torn tail included**, deliberately
("unrecognised protocol is version skew, not a truncated write"). So an envelope carrying
`my_context/audit-import@1` inside a segment makes the entire log unreadable. And an envelope carrying
`my_context/audit@1` makes a foreign record **indistinguishable from a local one to every existing
reader** — including `ledgerRows`, which would replay another machine's injections into this machine's
ledger and make `seen` suppress items on the hot path that were never injected. **The protocol rule is
doing real work here: it forecloses the tempting design before anyone writes it.**

**3. Therefore: a separate directory, a separate protocol, separate rows.**
`.audit/imported/<source-slug>-<sha>.jsonl`, written once and never appended to, carrying
`protocol: 'my_context/audit-import@1'` and a first-line header record naming the source identity, its
resolved commit sha, the filter that produced it, the exporting version, and the counts of what was
dropped and why.

`[V]` This is safe **by construction, with no code change**: `auditSegments` filters
`readdirSync(.audit)` against `^audit\.[0-9TZ]+-\d+\.jsonl$` and appends `audit.jsonl`. A subdirectory
matches nothing, so imported history is invisible to `readAudit`, to `syncProjection`'s source list and
to `topUpLedger` today. **That property is the design; preserve it explicitly with a test rather than
letting it be an accident.**

**4. Idempotence comes free.** The filename carries the source and its content digest, so a second
import of the same pack finds the file present and writes nothing. A later import of a moved-forward
source writes a second file; the two are ordered by their recorded `at`, not by file position.

**5. Query surface.** Give the projection a second source list for `.audit/imported/*.jsonl`; the
existing `audit.src` column already stores the originating file path, so "is this foreign" is derivable
without a schema change. `mycontext audit` stays **local-only by default**, with `--imported` /
`--all`, and every foreign row renders with its source. The project's own sentence, one step further:
reading an unreadable log as empty is the one answer an audit trail must never give — and answering
*"what happened here"* with something that happened on someone else's machine is the second.

**6. Ordering.** Foreign records keep their original `at`. Do not renumber and do not restamp. Within
local records `ORDER BY seq` remains `ORDER BY at`; any mixed view must sort by `at` and must say it is
mixed.

**7. Session ids.** Today no travelling record carries one — `[V]` `auditMutation` sets no `sessionId`.
If that ever changes, namespace it by pack id before storage: two packs that both pseudonymise to
`session-1` collide catastrophically where two UUIDs would not.

**8. The line someone will cross, so write it down next to the replay.** R7's newly clarified
cross-session-continuity requirement wants a new session to inherit what a previous one saw. That is a
legitimate **same-machine** ledger replay. Doing the same thing with **imported** injections is the
identical code path across a machine boundary and corrupts `seen` — the hot-path suppression would hide
items that were never injected here. The two features will look identical to whoever implements R7(3);
the prohibition belongs in `ledger-replay.ts`, not in a report.

---

## What I could not verify

- **The git bundle / subtree recipe.** Inherited from R3's `[V]`; I did not re-execute it.
- **The 5,000-item corpus.** 7.0 MB is `5,000 × the measured 1,475-byte mean`. Real corpora skew — the
  largest item here is 5,256 bytes — so treat it as an order of magnitude, not a figure. I did not
  build one, did not time a 5,000-entry zip write, and did not check that Explorer or `Expand-Archive`
  handle a 5,000-entry archive; only the three-entry case was executed.
- **Mutation record size and content.** `[V]` This workspace's log contains **zero** mutation records,
  so ~160–220 bytes is arithmetic on the record shape and the call sites in `persist.ts`,
  `mutate.ts`, `relations.ts` and `revision.ts` — not an observation of real records. Every claim in
  the history table about what a mutation record contains is from the write path, which I read, not
  from data.
- **"The log has no integrity control."** This is a claim about an absence. I read `audit.ts`,
  `audit-db.ts`, `jsonl-log.ts` and `ledger-replay.ts` and found none; I did not read every module.
- **Session id unguessability.** I assumed Claude Code session ids are UUIDs from the one observed
  (`9e5b6b17-c186-…`); I did not verify how they are generated.
- **Zip64.** My writer uses 32-bit fields. >4 GB or >65,535 entries needs Zip64 and would silently
  produce a malformed archive. Unreachable at 5,000 items; untested.
- **OCI without a client.** `[W]` The Distribution Spec is plain HTTPS and needs no specific binary; I
  did not attempt a push, and the multi-step chunked upload is fiddly enough that the practical
  answer may differ from the specified one.
- **`node:sqlite` on 24.15+.** `[V]` This machine is 24.14.0 and warns; `[W]` 24.15.0 (2026-04-15)
  promotes the module to Stability 1.2. I did not test on 24.15+, so the "still warns" observation is
  specific to this build.
- **Windows ZIP history.** `[W]` The Windows XP claim is sourced to a Microsoft devblog; an earlier
  Windows ME claim appears only in forum sources and I did not confirm it.

---

## Headline

**The format argument dissolves once you notice it is three questions**: identity belongs in a sorted
`manifest.json` of full SHA-256 digests, which makes the container a delivery detail; the canonical
form is a plain directory in the workspace shape, whose manual import is `cp -r`; and the single-file
spelling is `git bundle` when the receiver has git and history matters, or a **deterministic ZIP** —
verified here at 64 lines of `node:zlib`, byte-identical across runs, opened by Windows `tar.exe` and
`Expand-Archive` — when the receiver has nothing, because ZIP is the only archive every Windows since
XP double-clicks. **History should travel, but only the mutations**: `create`, `update`, `promote`,
`accept`, `stage`, `discard`, `supersede`, `refresh`, `link`, `unlink` — which carry no session id and
no path and are the *only* record of when an item was authored and by whom, since the item file has no
date field at all and 75% of this corpus has exactly one git commit — while injections, hook actions and
focus changes stay home, because they are 86% of the log's bytes, they leak forty of the publisher's
repository paths and every subagent they run, and replaying them would make `seen` suppress items that
were never injected. **Exported history cannot justify trusting an imported item and must never be
allowed to**: the log has no hash chain, no signature and no sequence number, so it is testimony from
the party whose trustworthiness is in question — what it can do is **rank the review queue** and answer
one join that nothing else can, *"this item arrives `active` and nothing in its history shows a human
ever approved it."*
