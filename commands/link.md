---
description: Record a relation from one item to another
argument-hint: "[from which item, how, to which item]"
disable-model-invocation: true
---

Record a relation between two items in this project's my_context knowledge base.

What the user typed: $ARGUMENTS

1. Work out three things: the item the relation is stored ON (`from`), the relation, and
   the item it points at (`to`). The direction is not symmetric — "A blocks B"
   is stored on A.
2. If the relation was not named, present the vocabulary as a numbered list and stop until
   the user picks one. It is closed on purpose: an open one produces `derived_from`,
   `derivedFrom` and `derived-from` in one corpus, and then no query finds all three.

       1. derived_from   2. constrains   3. supersedes   4. blocks   5. mitigates   6. refines   7. relates_to   8. links_to   9. depends_on   10. caused_by   11. conflicts_with   12. amends   13. produced   14. discovered_by   15. unblocks   16. enforces   17. enforced_by   18. answers

3. Call the `link_items` tool on the `mycontext` MCP server with `from`, `to` and
   `relation`. Report what it says in one line.

`supersedes` and `superseded_by` are **not** available here, and that is not an
oversight. A supersession is a lifecycle change, not just an edge: it sets the retired
item's status too. Use `/mycontext:supersede`, which writes both directions and the
status together.

The target does not have to exist yet — an unresolved link resolves when the item is
created. To remove a relation, that is `/mycontext:unlink`.
