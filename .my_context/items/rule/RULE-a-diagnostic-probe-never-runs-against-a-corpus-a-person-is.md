---
id: RULE-a-diagnostic-probe-never-runs-against-a-corpus-a-person-is
type: rule
title: a diagnostic probe never runs against a corpus a person is using
status: active
severity: soft
always: true
summary: Run diagnostic probes in a throwaway workspace, because test writes into a knowledge store people rely on are indistinguishable from real records.
summary_of: 880f38b131dc1a5c
scope: []
tags:
  - probes
  - hooks
  - sessions
  - safety
  - owner-ruling
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r6b.md"
source_anchor: null
source_checksum: 8c0a1e0471af5b03
valid_from: 2026-09-02
valid_until: null
checksum: b5f3c749535a8e5f
---

# a diagnostic probe never runs against a corpus a person is using

> A diagnostic probe - anything run to find out how a mechanism BEHAVES, rather than to record real knowledge - never runs against a corpus a person is using. Point it at a throwaway workspace with `MYCONTEXT_CORPUS_DIR` and let it write whatever it likes there.
>
> **THIS IS NOT HYPOTHETICAL, AND THE COST WAS A MORNING.** On 2026-09-02, hook probes were run against the live corpus. They wrote REAL injection rows under SYNTHETIC session ids. Those rows were the newest, so they became the three most recent injections. The web status bar opens on the most recent session; that session had no statusline payload, because no person ever had it; so every field on the bar read "not read". The owner lost a morning to a status screen that was telling the exact truth about a session that never existed.
>
> **WHY THE DAMAGE OUTLIVES THE PROBE.** A probe's writes are indistinguishable from real ones the moment they are on disk - which is what makes it a good probe and what makes it dangerous. They do not fail, they do not warn, and afterwards nothing can tell them apart from the records they sit beside. They then feed everything that reads "the latest" or "the last few", which is most of the reporting surface. The probe finished in seconds; its output stayed, and was believed.
>
> **WHAT COUNTS AS A PROBE.** Anything that exercises hooks, sessions, injection, ingest or the audit log to see what happens. If the point of running it is the OBSERVATION rather than the record it leaves behind, it is a probe, and it goes in a temp workspace.

## Observations
- [note] Point a probe at a temp workspace with the corpus-directory environment variable and let it write freely there.
- [note] A probe is anything run for the observation rather than for the record it leaves behind: hooks, sessions, injection, ingest, the audit log.
- [note] The harm is not the write, it is that the write is newest and every latest-N reader believes it.
