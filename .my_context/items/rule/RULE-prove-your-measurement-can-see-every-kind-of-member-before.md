---
id: RULE-prove-your-measurement-can-see-every-kind-of-member-before
type: rule
title: prove your measurement can see every kind of member before you trust the count
status: active
severity: hard
always: true
summary: Before trusting a count, check that your way of counting can see every kind of thing; otherwise none found means only none of the sort you knew to look for.
summary_of: 4560e78940ca2715
scope: []
tags:
  - v2
  - agents
  - pinned-2026-08-23
origin: human
source_file: null
source_anchor: null
source_checksum: b5884b6ad6d50bb4
valid_from: 2026-08-23
valid_until: null
checksum: 9a3ed0b982d2a22a
---

# prove your measurement can see every kind of member before you trust the count

> When you measure a set, first prove your measurement can see every kind of
> member. A scan that reads one syntactic form reports the members written that
> way and silently omits the rest.
>
> Measured on 2026-08-23, three times, on one question. To find which CSS rules a
> set of screens needed, the mockup's static `class=` attributes were scanned. The
> result said three screens needed nothing. It was wrong three ways, each found
> later by somebody else:
>
> - bare ELEMENT rules have no class at all, so `ins{}` and `del{}` were invisible;
> - classes a SCRIPT emits at runtime never appear in static markup, so `.refusal`
>   was invisible;
> - one module built its DOM through a local helper rather than the shared one, so
>   its classes were invisible to a scan keyed on the shared helper's name.
>
> The fix was to measure the other way round — over what the modules actually
> CONSTRUCT — which cannot miss a member because it enumerates the producers
> rather than one spelling of the product. The same session produced the same
> lesson twice more: a port list recalled from memory contained an entry two
> browsers do not refuse, and a set measured against one consumer missed two ports
> another consumer refuses.
>
> DO
> - Enumerate by construction: read what the code produces, not one shape of what
>   it looks like.
> - Before trusting a scan, test it against a member you KNOW exists and one you
>   know does not.
> - State the scope of the scan when you report it: what it walked, and what kind
>   of member it could not have seen.
> - When two measurements disagree, ask what each one measured. Usually both are
>   right about different questions, and the answer you need is the union.
>
> DO NOT
> - Report "none found" from a single-pattern grep as "there are none".
> - Widen a claim beyond the directory, file type or syntax the scan actually
>   covered.
> - Reach for a list from memory when the system can be asked directly.
