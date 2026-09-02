---
id: RULE-do-not-amend-an-append-only-log-append-a-second-record
type: rule
title: Do not amend an append-only log; append a second record instead
status: active
severity: hard
always: false
summary: Never rewrite a file that is only ever added to; add a second entry instead, so nothing another writer added at the same moment is silently destroyed.
summary_of: 3df0ebe9080a6407
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 25b8f185749f0f70
directive: dont
---

# Do not amend an append-only log; append a second record instead

Updating a record in an append-only file means reading the whole file and writing it back. Any line another writer appends between that read and that write is destroyed, silently, and the loss lands on a writer that did nothing wrong. Where the file is the accountability record for a feature, that is the worst possible place for silent loss.

A two-phase fact is therefore written as two records: one when the act is attempted and one when it completes. This is strictly more expressive than amendment — an attempted record with no completion beside it says the act never returned, which an amended single record cannot represent at all.

Locking is not the cheaper answer here: it puts a lock on a hot append path to serve a rare update, and it leaves the invariant depending on every future writer remembering to take it.

## Relations
- derived_from [[LESSON-a-race-a-single-process-cannot-schedule-needs-an-invariant]]
