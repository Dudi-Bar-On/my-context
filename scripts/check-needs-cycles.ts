#!/usr/bin/env node
/**
 * **A cycle in `needs` is DETECTED and reported here. It is never broken
 * silently.**
 *
 * `mycontext ready` already answers "what can I start now": readiness is
 * derived on every run from `needs` plus the `state` of what `needs` names,
 * and `mycontext doctor` already reports a blocked task that names nothing, a
 * blocked task whose blockers have all landed, a malformed entry and an
 * unresolved reference. Nothing anywhere reads the graph as a GRAPH, and that
 * is the one failure those three cannot see.
 *
 * ── WHY A CYCLE IS INVISIBLE TO EVERY EXISTING CHECK ────────────────────────
 *
 * Take `a/1` needs `a/2` and `a/2` needs `a/1`. Both references are
 * well-shaped, so `needs_malformed` says nothing. Both resolve to a real task,
 * so `needs_unresolved` says nothing. Neither target is `done`, so both rows
 * land in `ready`'s held list with reason `pending` — "a blocker has not
 * landed" — which is true, reads as ordinary, and will stay true forever.
 * Neither task can ever appear on the ready list and nothing will ever say
 * why. That is the same shape this corpus keeps paying for: a report correct
 * about what it measured and silent about what it missed.
 *
 * So the cycle has to be found by walking the edges, and the ruling for this
 * work is explicit that it is REPORTED rather than resolved: which edge in a
 * cycle is the wrong one is a question about the work, and only a person
 * knows the answer.
 *
 * ── WHAT IT WALKS, AND WHAT IT CANNOT SEE ───────────────────────────────────
 *
 * Nodes are `plan/seq` keys, not items — because the key is not unique. Six
 * live tasks in this corpus answer to `ui3/11x`, so a reference to it means
 * all of them, and the node therefore carries the UNION of what every item
 * under that key needs. Reading it per-item instead would split one blocker
 * into six and could miss a cycle that only closes through the shared key.
 *
 * Superseded items are excluded, exactly as `workItems` excludes them: a
 * replaced task is not a blocker.
 *
 * `done` tasks are KEPT in the graph. A cycle that runs through finished work
 * is still a cycle in what the corpus asserts, and a scan that dropped them
 * would go quiet the moment one member landed — reporting the defect as fixed
 * when nothing about the edges changed.
 *
 * What it cannot see, stated so the result is not read wider than it is: a
 * reference nothing in the corpus answers to is dropped, because it names no
 * node and cannot close a loop. `doctor` reports those as `needs_unresolved`.
 * And a dependency written only in prose is invisible here, as it is to every
 * other reader of this field.
 *
 * ── RUNNING IT ──────────────────────────────────────────────────────────────
 *
 *     node my-context/scripts/check-needs-cycles.ts            # from the repo root
 *     node my-context/scripts/check-needs-cycles.ts --json
 *     node my-context/scripts/check-needs-cycles.ts --quiet    # print only on failure
 *
 * The workspace is resolved from the CURRENT DIRECTORY, the same walk every
 * `mycontext` command does, so it reads whichever corpus the CLI would read.
 * Exit 0 when the graph is acyclic, 1 when it is not.
 */
import { loadLayer, type LoadError } from '../src/core/rebuild.ts';
import {
  buildTaskIndex, DONE_STATE, NEEDS_FIELD, parseNeeds, taskKey, taskState, workItems,
} from '../src/core/needs.ts';
import type { Item } from '../src/core/types.ts';
import { resolveWorkspace } from '../src/core/workspace.ts';

/** One node of the graph: a `plan/seq` key and everything that answers to it. */
interface Node {
  key: string;
  items: Item[];
  /** Resolvable references, de-duplicated across every item under this key. */
  out: string[];
  /** Well-shaped references nothing answers to. Counted, never walked. */
  dangling: string[];
}

interface Cycle {
  /** The keys of the cycle, in the order the walk closed it. */
  keys: string[];
  /** One line per member: the key, its state(s) and its title(s). */
  members: string[];
}

function buildGraph(items: Item[], config: Parameters<typeof buildTaskIndex>[1]): Map<string, Node> {
  const index = buildTaskIndex(items, config);
  const graph = new Map<string, Node>();

  for (const [key, bucket] of index) {
    const out: string[] = [];
    const dangling: string[] = [];
    for (const item of bucket) {
      for (const ref of parseNeeds(item.extra[NEEDS_FIELD]).refs) {
        if (!index.has(ref)) {
          if (!dangling.includes(ref)) dangling.push(ref);
          continue;
        }
        if (!out.includes(ref)) out.push(ref);
      }
    }
    out.sort();
    dangling.sort();
    graph.set(key, { key, items: bucket, out, dangling });
  }
  return graph;
}

/**
 * Tarjan's strongly connected components, iteratively.
 *
 * Iterative rather than recursive on purpose: the recursion depth of a
 * dependency walk is bounded by the length of the longest chain, and nothing
 * bounds that — a plan laid out one-task-at-a-time is a single chain as long
 * as the plan. A stack overflow inside a checker is a checker that reports
 * nothing at all, which is worse than the defect it looks for.
 *
 * A component is a cycle when it holds more than one node, or when a single
 * node names itself.
 */
function findCycles(graph: Map<string, Node>): string[][] {
  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  let counter = 0;

  for (const root of [...graph.keys()].sort()) {
    if (indexOf.has(root)) continue;

    // Each frame is a node plus how far through its edge list we are.
    const work: { key: string; edge: number }[] = [{ key: root, edge: 0 }];
    indexOf.set(root, counter);
    lowlink.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const node = graph.get(frame.key)!;

      if (frame.edge < node.out.length) {
        const next = node.out[frame.edge]!;
        frame.edge++;
        if (!indexOf.has(next)) {
          indexOf.set(next, counter);
          lowlink.set(next, counter);
          counter++;
          stack.push(next);
          onStack.add(next);
          work.push({ key: next, edge: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(frame.key, Math.min(lowlink.get(frame.key)!, indexOf.get(next)!));
        }
        continue;
      }

      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1]!.key;
        lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(frame.key)!));
      }

      if (lowlink.get(frame.key) === indexOf.get(frame.key)) {
        const component: string[] = [];
        for (;;) {
          const member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
          if (member === frame.key) break;
        }
        const selfLoop = component.length === 1
          && graph.get(component[0]!)!.out.includes(component[0]!);
        if (component.length > 1 || selfLoop) cycles.push(component.sort());
      }
    }
  }
  return cycles;
}

function describe(graph: Map<string, Node>, keys: string[]): Cycle {
  const members: string[] = [];
  for (const key of keys) {
    for (const item of graph.get(key)!.items) {
      members.push(`${key}  [${taskState(item) || 'no state'}]  ${item.id}`);
    }
  }
  return { keys, members };
}

function main(): number {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const quiet = argv.includes('--quiet');
  const out = (line: string): void => { process.stdout.write(line + '\n'); };

  const ws = resolveWorkspace(process.cwd());
  if (ws.projectRoot === null) {
    out('my_context: no workspace here. Run this from a directory inside the project.');
    return 1;
  }

  const errors: LoadError[] = [];
  const items = loadLayer(ws.projectRoot, 'project', errors, ws.config);
  const work = workItems(items, ws.config);
  const graph = buildGraph(items, ws.config);

  let edges = 0;
  let dangling = 0;
  let withNeeds = 0;
  for (const node of graph.values()) {
    edges += node.out.length;
    dangling += node.dangling.length;
    if (node.out.length > 0 || node.dangling.length > 0) withNeeds++;
  }
  const keyless = work.filter((i) => taskKey(i) === null).length;
  const open = work.filter((i) => taskState(i) !== DONE_STATE).length;

  // **A CYCLE CHECK OVER NOTHING IS NOT A CLEAN BILL OF HEALTH**, and this
  // check can be pointed at nothing by accident. `my-context/.my_context` is a
  // real workspace holding zero tasks (doctor calls it out as `nested_corpus`),
  // so running from the CODE directory rather than the repo root resolves
  // there, walks an empty graph and prints "no cycle: every needs chain in this
  // corpus terminates" — true, and worthless.
  //
  // That is the vacuous pass this project has now caught five times in other
  // shapes, and it is why this is NOT wired as an `npm run check:*`: npm sets
  // the cwd to the package directory, which is exactly the wrong corpus. Run it
  // from the repo root. A zero-item corpus exits 1 and says which directory it
  // read, so the mistake announces itself instead of reading as success.
  if (work.length === 0) {
    out(`my_context: no work items under ${ws.projectRoot} — nothing was checked, `
      + 'which is not the same as nothing being wrong. Run this from the repository '
      + 'root, where the corpus with the tasks lives.');
    return 1;
  }

  const cycles = findCycles(graph).map((keys) => describe(graph, keys));

  if (json) {
    out(JSON.stringify({
      workItems: work.length,
      open,
      nodes: graph.size,
      keyless,
      nodesWithNeeds: withNeeds,
      edges,
      danglingRefs: dangling,
      cycles: cycles.map((c) => ({ keys: c.keys, members: c.members })),
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    }, null, 2));
    return cycles.length > 0 ? 1 : 0;
  }

  for (const cycle of cycles) {
    out(`CYCLE  ${cycle.keys.join(' -> ')} -> ${cycle.keys[0]}`);
    for (const member of cycle.members) out(`       ${member}`);
    out('');
  }

  if (!quiet || cycles.length > 0) {
    out(
      `${work.length} work item(s), ${open} open · ${graph.size} plan/seq node(s) · ` +
      `${withNeeds} carrying "${NEEDS_FIELD}" · ${edges} edge(s) walked · ` +
      `${dangling} reference(s) nothing answers to, not walked` +
      (keyless > 0 ? ` · ${keyless} item(s) carry no plan/seq and can be needed by nothing` : ''),
    );
    if (cycles.length === 0) {
      out(`no cycle: every "${NEEDS_FIELD}" chain in this corpus terminates.`);
    } else {
      out(
        `${cycles.length} cycle(s). Every task in a cycle is held by ` +
        '`mycontext ready` for reason "a blocker has not landed", and that reason will ' +
        'never clear on its own.',
      );
      out(
        'NOT BROKEN HERE, deliberately: which edge is the wrong one is a question about ' +
        'the work. Read the members, decide which dependency is real, and remove the other ' +
        `with \`mycontext edit <id> --extra ${NEEDS_FIELD}="…"\`.`,
      );
    }
  }

  for (const e of errors) out(`load error: ${e.file}: ${e.message}`);
  return cycles.length > 0 ? 1 : 0;
}

process.exit(main());
