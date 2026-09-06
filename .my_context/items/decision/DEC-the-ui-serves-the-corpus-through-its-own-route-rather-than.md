---
id: DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than
type: decision
title: the UI serves the corpus through its own route, rather than by widening the document one
status: active
severity: soft
always: false
summary: The console can now open the project's own knowledge files, through a separate door with its own lock, and the rule that said it already could is corrected.
summary_of: c973f3d05b6a986a
scope:
  - src/doctor/checks.ts
  - src/ui/read-model.ts
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
tags:
  - v2
  - ui
  - library
  - corpus
  - security
  - boundary
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 6858dee5d26ff30d
---

# the UI serves the corpus through its own route, rather than by widening the document one

Owner ruling 2026-09-06, given while ruling on the served-path boundary and recorded in
`reports/V2-HANDOVER.md` at 90%, 93%, 94%, 95% and 96%: "widen the served set AND fix the
requirement that contradicts it... Found twice, stepped over twice; the owner ruled to resolve it
on the record this time." The ruling existed. What did not exist was an item carrying it, which is
why it kept being re-found as an open contradiction. This is that item.

THE CONTRADICTION, STATED EXACTLY. `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`
is severity HARD and says "The UI serves the corpus; it does not serve the checkout." Until today
the product did the opposite of both halves: `isServableDocPath` (`src/doctor/checks.ts`) served
`README.md` and every `.md` under `docs/` and `reports/` — the CHECKOUT — and served nothing at all
from `.my_context/items/**` — the CORPUS.

THE FIRST HALF IS NOW BUILT, AND IT IS BUILT AS A SECOND ROUTE RATHER THAN A WIDER FIRST ONE.
`GET /api/corpus` lists the corpus's own item files and `GET /api/corpus/:id` serves one, split
into its frontmatter and its body. `isServableDocPath` is not touched, and
`test/ui/corpus-files.test.ts` asserts it is not: the checkout boundary is exactly where it was.

AND "WIDEN isServableDocPath", THE INSTRUCTION REPEATED FIVE TIMES IN THE HANDOVER, WOULD HAVE
SERVED NOTHING. This is a measurement, not a preference. `buildDocManifest` (`src/ui/read-model.ts`)
sources its paths from `coverageFiles` -> `listRepoFiles`, and `listRepoFiles` drops every path
carrying a `.my_context` segment through `SKIP_DIRS` — deliberately, since 2026-09-04, so the
workspace's own storage is not drawn as project content. A predicate that admitted
`.my_context/items/**` would have been asked about no such path, ever. The feature would have
shipped serving nothing while looking done, and every gate would have been green.

THREE MORE REASONS THE SHAPE IS TWO ROUTES.

  1. The rosters are keyed differently. A document id is a REPOSITORY-relative path; a corpus file
     id is WORKSPACE-relative. One manifest holding both would carry two rootings under one key
     space, which is the ambiguity that only ever shows up as the wrong file being opened.
  2. The costs are not the same cost. `buildDocManifest` READS every file it lists, on every
     request, to derive headings and stat a Hebrew mirror: 190 files today. Folding 951 item files
     into it would make 1,141 reads and 1,141 stats the price of drawing the Library's README row.
     `apiCorpusList` reads no file at all — the roster is one indexed SQL column — and
     `apiCorpusFile` reads exactly the one file asked for.
  3. `checkWatchedDocsServable` measures that everything `watchedDocs` claims is servable. Widening
     the predicate under it would have silently widened that check's meaning too.

THE SECOND HALF — "IT DOES NOT SERVE THE CHECKOUT" — WAS ALREADY OVERRULED BY THE OWNER, ELEVEN
DAYS LATER, AND NOBODY RECORDED IT AGAINST THE REQUIREMENT. `DEC-the-documentation-system-is-hand-
built-over-a-wide-glob`, owner ruling 2026-09-05, says in as many words: "The boundary is the wider
glob over docs and reports rather than watchedDocs alone. A documentation system that cannot show a
report is not one, and most of what this project actually knows is written in reports." That is a
later ruling by the same person on the same question, and it is why `reports/**` — which
`watchedDocs` does not claim — is served today. The requirement was never amended to say so, so the
record read as a live contradiction for eleven days while the decision had in fact been taken.

WHAT THE REQUIREMENT MEANS AFTER TODAY, and the amendment is written into its own body rather than
left here: corpus membership is what makes a document viewable, AND a named, bounded set of
repository documents is served alongside — `README.md`, `docs/**/*.md`, `reports/**/*.md`. What
stays forbidden is what the requirement was actually written against: serving the checkout AT
LARGE, or widening the route until an arbitrary repository file can be fetched. Two enumerated
boundaries, both measured, neither of them "whatever is on disk".

THE REQUIREMENT IS AMENDED RATHER THAN SUPERSEDED, deliberately. Its rule is still in force and
still hard; only its factual claim about what the product does was wrong. Superseding would retire
a rule the owner has never withdrawn.

WIDENING WHAT A SERVER HANDS OUT IS SECURITY WORK, so the envelope is part of the ruling rather
than an implementation detail.

  - ONLY MARKDOWN, and only under `items/`. `isCorpusFilePath` (`src/doctor/checks.ts`, beside
    `isServableDocPath` so the two boundaries are one sentence each in one place) admits `.md`
    under `items/` and nothing else. `config.json`, `state/` and `.audit/` are outside the roster
    by construction, not by a filter that could be forgotten.
  - THE ROSTER IS THE INDEX, NOT A WALK. `items.file_path` for the PROJECT layer is what the corpus
    is. Nothing enumerates the filesystem, so there is no walk to escape from. The `layer =
    'project'` clause is load-bearing: a GLOBAL item's `file_path` is relative to the user's home
    workspace, and serving one would hand out a file from outside the project under an id that
    looks repo-local.
  - AN ID IS A KEY, NEVER A PATH. It is looked up in that roster and refused if absent, so `..`, an
    absolute path, a percent-encoded traversal and a Windows-separator path are ABSENT from the key
    space rather than defended against one spelling at a time. Twenty-one attack spellings are
    asserted to answer 404 in `test/ui/corpus-files.test.ts`, as attacks rather than as edge cases.
  - THE PREDICATE GUARDS THE ROW, NOT THE REQUEST. The index is a SQLite file another process
    wrote; a row claiming `file_path: ../../../.ssh/id_rsa` must not become a servable key by being
    in the table.
  - AND THE REALPATH IS VERIFIED BEFORE THE READ. `rebuild`'s walk FOLLOWS symlinks, so a symlinked
    `.md` inside `items/` is a legal corpus member with a perfectly ordinary id, and nothing about
    the id can say where it lands. The resolved target must sit under the resolved `items/`
    directory or the read is refused with a message that says it escaped. Held by a test that
    builds the symlink and asserts the id IS in the roster first, so the refusal is a refusal of
    something.

FRONTMATTER IS SERVED, NOT STRIPPED, and that is a ruling rather than a default. The console
already renders an item FROM THE INDEX in `aside#pane` — summary, scope, tier, body, provenance,
every field parsed. This surface exists to answer the other question: what is actually written in
the file. Stripping the frontmatter would make it a worse duplicate of the pane. It is carried in
its own field and drawn as preformatted text inside a `<details>`, because YAML pushed through a
Markdown renderer is not a rendering of the file — `---` alone is a thematic break and the closing
fence turns the line above it into a setext `<h2>`. `bytes` on the same response is the whole
file's size, which is the number that says the two halves are the whole of it.

WHAT IS NOW REACHABLE THAT WAS NOT: every `.md` under `.my_context/items/` that this project's own
index holds — 951 files on 2026-09-06 — to a browser already holding the UI token. Nothing else in
`.my_context/` becomes reachable, and nothing outside it changes. The honest residual, said out
loud: item bodies are where this project writes its most detailed reasoning, and they are now
readable as files. That is what was asked for, and it is the same corpus `/api/items`,
`/api/item/:id`, `/api/render` and `/api/search` already serve to the same holder of the same
token. What is new is that it is reachable AS THE FILE, frontmatter included.
