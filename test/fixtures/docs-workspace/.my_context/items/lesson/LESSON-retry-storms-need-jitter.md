---
id: LESSON-retry-storms-need-jitter
type: lesson
title: Retry storms need jitter
status: active
severity: soft
always: false
summary: When everything retries at the same moment after a failure, the retries themselves become the outage.
summary_of: c2baba9bccd24a6b
scope: []
tags:
  - reliability
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: e6c193cfdc2c75db
---

# Retry storms need jitter

The March catalogue outage lasted forty minutes because every client retried on the
same fixed one-second interval, so the service was re-hit in synchronized waves and
never got a quiet moment to recover. Retries now use exponential backoff with full
jitter.
