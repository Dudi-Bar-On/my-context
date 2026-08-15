---
id: LESSON-retry-storms-need-jitter
type: lesson
title: Retry storms need jitter
status: active
severity: soft
always: false
scope: []
tags:
  - reliability
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-14
valid_until: null
checksum: 9ae5e0343e454843
---

# Retry storms need jitter

The March catalogue outage lasted forty minutes because every client retried on the
same fixed one-second interval, so the service was re-hit in synchronized waves and
never got a quiet moment to recover. Retries now use exponential backoff with full
jitter.
