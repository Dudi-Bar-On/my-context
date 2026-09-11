// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-the-browser-suite-returns-to-the-real-corpus-and-the, TASK-last-ui-task-return-the-ui-to-the-real-corpus, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE STATES A SPEC MAY ASK A THROWAWAY TWIN FOR, EACH ONE NAMED.**
 *
 * ── THE OWNER'S EXCEPTION, IN HIS OWN WORDS ───────────────────────────────
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` is
 * `hard`: verification runs against this repository's own corpus, and an
 * exception is asked for FIRST. He gave one on 2026-09-11, for this work,
 * in these terms:
 *
 *     "Each of those tests makes a private throwaway copy of your corpus,
 *      puts the one thing it needs into the copy, runs, and deletes the copy.
 *      Your real corpus is never touched."
 *
 * That is the whole of the exception and this file is the whole of what it
 * licences. **It is not `.demo-corpus` coming back**, it is not a second
 * corpus, and it is not a fixture anybody maintains by hand: every seed below
 * takes the LIVE corpus as it stands today and adds ONE state to a private
 * copy of it, through the product's own commands. Nothing here authors an
 * item, a session or a record by hand.
 *
 * ── WHY THE SEEDS ARE NAMED, AND NAMED IN THE SPEC ────────────────────────
 *
 * The retired fixture's real cost was not that it was simulated. It was that
 * a spec could not say what it needed: `.demo-corpus` held one of everything,
 * so a test asserting a spilled list looked identical to a test asserting an
 * empty one, and when the fixture went away nobody could tell from the spec
 * which state it had been leaning on. 41 browser failures on 2026-09-10 were
 * that, and every one had to be re-derived by reading the app.
 *
 * So a seeded spec names its state at the top of its own file:
 *
 *     const test = seededTest(squeezeBudgets(TIGHT));
 *
 * and a reader knows, without opening anything else, that this file requires
 * a selection that overflows. `e2e/scratch-seeds.spec.ts` is the gate that
 * each of these actually produces what its name claims.
 *
 * ── WHAT IS MEASURED, TODAY, ON THE LIVE CORPUS ───────────────────────────
 *
 * Re-measured 2026-09-11 against this repository, which is why each seed
 * exists:
 *
 *   `selection.spilled` is **0** on every question the preview asks — the
 *   real budgets (pinned 30,000 / jit 32,000 / index 8,000) are larger than
 *   the corpus needs, so nothing overflows and a paging control has nothing
 *   to page.                                    → `squeezeBudgets`
 *
 *   The review queue is **empty in both halves**: `reviewQueue.drafts` 0 and
 *   `pendingRevisions.revisions` 0. Both revisions in `.revisions/` were
 *   promoted on 2026-08-29.        → `draftInQueue`, `pendingRevision`
 *
 *   All **78** doctor findings route to `acknowledge` — not one `run`-routed
 *   finding exists, so Doctor's repair control cannot be reached at all.
 *                                                → `driftedSource`
 *
 *   No session in the live corpus carries a spilled injection, and the
 *   `demo-session-a3f9c1-*` ids three specs still name by hand belong to the
 *   retired fixture and are in no corpus anywhere. → `realInjections`
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The CLI every seed types its commands through — the real one, by path. */
const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/** The hook entry points `realInjections` feeds, exactly as Claude Code does. */
const HOOKS = path.resolve(import.meta.dirname, '..', 'src', 'hooks');

/** The agent-origin write `pendingRevision` needs and no CLI can make. */
const AGENT_WRITE = path.resolve(import.meta.dirname, 'seed-agent-write.ts');

/**
 * **One state, put into one throwaway copy, through the product's own code.**
 *
 * `root` is the copy's workspace root and `env` carries the throwaway `HOME`
 * that `e2e/throwaway-home.ts` minted for it — pass it to every child, or the
 * child reads the machine's real `~/.my-context` and the isolation is a
 * comment rather than a fact.
 */
export type Seed = (root: string, env: NodeJS.ProcessEnv) => void;

/** Several seeds, applied in the order written. */
export function seeds(...parts: readonly Seed[]): Seed {
  return (root, env) => { for (const part of parts) part(root, env); };
}

/**
 * Run one CLI command against the copy and return what it printed.
 *
 * **`stdout` is returned even when the command exits non-zero**, because
 * `mycontext doctor` exits 1 whenever it has findings and a seed that treated
 * that as a crash would be unable to read the corpus it just seeded.
 */
export function runCli(root: string, env: NodeJS.ProcessEnv, args: readonly string[]): string {
  try {
    return execFileSync(process.execPath, [CLI, ...args], {
      cwd: root, encoding: 'utf8', stdio: 'pipe', env,
    });
  } catch (err) {
    const out = (err as { stdout?: string }).stdout;
    if (typeof out === 'string' && out.length > 0) return out;
    throw err;
  }
}

/**
 * The id the CLI minted, read out of `add`'s own stdout.
 *
 * **It throws rather than guessing**, and that is the lesson `doctor-workspace.ts`
 * paid for: the contradiction gate (landed 2026-09-08) refuses an `add` whose
 * text is near-identical to something already governing, and the refusal
 * itself NAMES the items it collided with — so a regex that simply took the
 * first id-shaped token out of the output would silently return SOMEBODY
 * ELSE'S id and the seed would go on to edit a real governing item. Measured
 * here on 2026-09-11: `add rule` was refused, and the first id in the refusal
 * was an unrelated governing rule.
 */
function createdId(output: string): string {
  const id = /created (\S+)/.exec(output)?.[1];
  if (id === undefined) {
    throw new Error(
      'seeds: `mycontext add` did not report creating anything. The contradiction gate or the '
      + `summary gate probably refused it, and it said why:\n${output}`,
    );
  }
  return id;
}

/* ══ 1 · A SELECTION THAT ACTUALLY OVERFLOWS ═══════════════════════════════ */

/**
 * **The budgets this repository's own corpus overflows at.**
 *
 * Measured 2026-09-11 on a throwaway twin, by asking `/api/select` the two
 * questions the preview asks:
 *
 *   `session-start`, cold          full 8, spilled **158** — `pinned` and
 *                                  `index`, and no band, because a session
 *                                  start never splits into bands.
 *   `tool`, `src/api/handler.ts`   full 8, spilled **120** — every one `jit`
 *                                  and every one `band 2`, because
 *                                  `RULE-handlers-validate-at-the-boundary`
 *                                  declares `src/api/**` and takes band 1.
 *
 * The two answers therefore share no row, which is the property
 * `preview-spilled.spec.ts`'s disjointness test exists to measure and which
 * the live corpus cannot demonstrate at all: at the real budgets both answers
 * are empty, and two empty sets are trivially disjoint.
 *
 * **Not 1, and not 0.** A budget dragged to nothing spills EVERYTHING and
 * makes the paging control's own cap the only thing under test. These numbers
 * are roughly a tenth of the real ones — small enough that the corpus
 * overflows them today, large enough that several items still fit, so
 * `full` and `spilled` are both non-empty and a test can tell them apart.
 */
export const TIGHT_BUDGETS = { pinned: 3000, jit: 3000, index: 900 } as const;

/**
 * Lower one or more budgets in the copy's `config.json`, through
 * `mycontext config`, which is the command a person uses for this.
 *
 * `config.json` is a READ of the corpus at every selection, so no rebuild is
 * needed for it to take effect — but `scratchCorpus` rebuilds after seeding
 * anyway, and this seed does not depend on which side of that it runs on.
 */
export function squeezeBudgets(budgets: Readonly<Record<string, number>>): Seed {
  return (root, env) => {
    for (const [tier, value] of Object.entries(budgets)) {
      runCli(root, env, ['config', `budgets.${tier}`, '--set', String(value), '--yes']);
    }
  };
}

/* ══ 2 · A REVIEW QUEUE WITH SOMETHING IN IT ═══════════════════════════════ */

/** The title `draftInQueue` gives the note it creates, so a spec can find it. */
export const SEEDED_DRAFT_TITLE = 'A seeded note, waiting in the draft queue of a throwaway copy';

/**
 * **One item waiting in the DRAFT half of the Review queue.**
 *
 * Two commands, both of them ones a person types: `add` mints an item, and
 * `edit --status draft` puts it in the queue. The category is `note` on
 * purpose — it is rationale-tier, so `add` does not have to argue with the
 * gates that guard a governing normative item, and the draft queue draws a
 * row per DRAFT rather than per category, so the row is the same row.
 *
 * The body says what it is, inside the corpus, because a reader who finds this
 * item in a temp directory deserves to know why it is there.
 */
export function draftInQueue(): Seed {
  return (root, env) => {
    const id = createdId(runCli(root, env, [
      'add', 'note', SEEDED_DRAFT_TITLE,
      '--body',
      'This note was created by `e2e/seeds.ts` in a private, disposable copy of the corpus, so '
      + 'that the Review queue has one draft to draw. It governs nothing, it asserts nothing, '
      + 'and the copy it lives in is deleted when the test that made it ends.',
      '--summary', 'A seeded note that exists so the draft queue has a row to draw.',
      '--yes',
    ]));
    runCli(root, env, ['edit', id, '--status', 'draft', '--yes']);
  };
}

/**
 * **One PENDING REVISION, staged the way the MCP surface stages one.**
 *
 * The target is chosen from the copy rather than named here: the active `rule`
 * whose id sorts first. Naming an id would tie this seed to one item surviving
 * in the corpus forever, which is the shrink-only-ledger mistake in a smaller
 * form — `port/101` is the big one.
 *
 * `e2e/seed-agent-write.ts` carries the reason a child process and an
 * agent origin are both needed. In short: `mycontext edit` is `origin: 'human'`
 * and therefore APPLIES; only a non-human origin is HELD.
 */
function firstGoverningRule(root: string, env: NodeJS.ProcessEnv): string {
  const listed = JSON.parse(runCli(root, env, ['list', 'rule', '--json'])) as
    { id: string; status: string }[] | { items: { id: string; status: string }[] };
  const items = Array.isArray(listed) ? listed : listed.items;
  const target = items.filter((i) => i.status === 'active').map((i) => i.id).sort()[0];
  if (target === undefined) {
    throw new Error('seeds: the copy holds no active rule to propose a change to.');
  }
  return target;
}

/** The sentence the agent proposes. Named so a spec can assert on it. */
export const PROPOSED_SUMMARY =
  'A sentence an agent proposed for this rule, held in a throwaway copy for a human to approve.';

function stageAgainst(root: string, env: NodeJS.ProcessEnv, target: string): void {
  execFileSync(process.execPath, [AGENT_WRITE, root, target, PROPOSED_SUMMARY], {
    encoding: 'utf8', stdio: 'pipe', env,
  });
}

export function pendingRevision(): Seed {
  return (root, env) => { stageAgainst(root, env, firstGoverningRule(root, env)); };
}

/**
 * **A pending revision the corpus has since moved out from under — `STALE`.**
 *
 * `execute.spec.ts`'s Review-queue test is about the honest refusal: the dry
 * run behind the confirm runs the same argv the real run would, `review
 * promote-revision` refuses a proposal whose base no longer matches, and the
 * reader is shown that refusal instead of a "Run it" button. A revision that
 * applies cleanly proves the opposite thing, so `pendingRevision()` is not
 * interchangeable with this and the two are separate exports rather than a
 * flag, so a spec's own first line says which it needs.
 *
 * The staleness is REAL and is made the way staleness happens: the agent
 * proposes a new summary, and then a human — at the terminal, through
 * `mycontext edit`, origin `human`, so it APPLIES — writes a different one.
 * The proposal's recorded `base` is now nobody's current text.
 */
export function staleRevision(): Seed {
  return (root, env) => {
    const target = firstGoverningRule(root, env);
    stageAgainst(root, env, target);
    runCli(root, env, [
      'edit', target, '--summary',
      'A third sentence, written by a human after the proposal was staged, which is what makes '
      + 'that proposal stale.',
      '--yes',
    ]);
  };
}

/** The title `pinnableItem` gives the rule it creates, so a spec can find it. */
export const SEEDED_PINNABLE_TITLE =
  'A seeded rule about naming a throwaway copy in a browser test';

/**
 * **One NORMATIVE, UNPINNED item that `pin` will actually accept.**
 *
 * `execute.spec.ts`'s boundary-confirm test needs an item whose `always` can
 * genuinely move, and on this corpus finding one by walking the files does not
 * work — twice over, and both refusals are the product being right:
 *
 *   1. **Tier.** `always` governs only on the normative tier, and `pin` refuses
 *      a rationale-tier item in as many words: *"this would be stored and then
 *      do nothing at all."* The first unpinned item on disk is an `adr`.
 *   2. **The contradiction gate**, landed 2026-09-08. The first unpinned
 *      NORMATIVE item is `CONST-a-correction-records-the-class-of-error-not-
 *      only-the`, and editing it is refused with *"may contradict 1 item that
 *      currently govern[s], and nothing was changed"*. Which item trips the
 *      gate is a property of the corpus on the day, so no walk can dodge it.
 *
 * So one is made instead, with text distinctive enough to be nobody's near
 * twin — and where the gate still fires, the settlement a person would make is
 * made through `--distinct`, exactly as `e2e/doctor-workspace.ts` does and for
 * the reason it gives: wording around the gate is dodging it, and naming the
 * items it found is answering it.
 */
export function pinnableItem(): Seed {
  return (root, env) => {
    addSettlingContradictions(root, env, [
      'add', 'rule', SEEDED_PINNABLE_TITLE,
      '--body',
      'A throwaway copy of this corpus is named in the test that made it, so a reader who finds '
      + 'one in a temporary directory can tell which spec is responsible for it. This rule was '
      + 'created by e2e/seeds.ts inside such a copy and is deleted with it.',
      '--summary', 'A seeded rule that exists so a browser test has something it may pin.',
      '--yes',
    ]);
  };
}

/**
 * `mycontext add`, and where the contradiction gate refuses, the settlement a
 * person makes rather than a reword.
 *
 * The refusal names the items it collided with, one per line; `--distinct <id>`
 * is the recorded ruling that this item and that one are different claims. One
 * retry, because a second refusal after every named item has been settled is a
 * different failure and should be read as itself rather than looped over.
 */
export function addSettlingContradictions(
  root: string, env: NodeJS.ProcessEnv, args: readonly string[],
): string {
  const first = runCli(root, env, args);
  if (/created \S+/.test(first)) return createdId(first);
  const collided = [...first.matchAll(/^\s{2}([A-Z][A-Za-z]*-[a-z0-9][a-z0-9-]*)\s/gm)]
    .map((m) => m[1]);
  if (collided.length === 0) return createdId(first);
  const settled = collided.flatMap((id) => ['--distinct', id]);
  return createdId(runCli(root, env, [...args, ...settled]));
}

/* ══ 3 · A DOCTOR FINDING THAT ROUTES TO `run` ═════════════════════════════ */

/** The document `driftedSource` writes, snapshots, and then changes. */
export const DRIFTED_DOC = path.join('docs', 'seeded-drifting-source.md');

/** The title of the reference item that snapshots it. */
export const DRIFTED_REF_TITLE = 'A seeded reference whose source drifts, in a throwaway copy';

/**
 * **One `source_drift` finding, which is the only `run`-routed remedy this
 * corpus can be made to produce without inventing a defect.**
 *
 * Measured 2026-09-11 on the live corpus: 78 findings, **all 78 routing to
 * `acknowledge`**, 18 of them open. `execute.spec.ts`'s "Doctor's repair
 * reaches a confirm" needs a card-level repair carrying `--yes`, and there is
 * no such row — the test cannot be measured here at all, and it was passing
 * on `.demo-corpus` only because that fixture happened to hold a drifted
 * reference.
 *
 * So one is made, by doing the thing that makes one: write a document, snapshot
 * it into a `reference` item (`mycontext add reference --file`), and then change
 * the document. `checkSourceDrift` compares the live file's checksum against
 * the one the item holds, finds them different, and answers
 * `refreshRemedy(id)` — `{ route: 'run', command: 'refresh', values: { id,
 * yes: true } }`. Measured on the twin: exactly **one** `run`-routed finding,
 * so `.first()` on that screen is unambiguous.
 *
 * Nothing about this is manufactured: the drift is real drift, of a real file,
 * detected by the real check.
 */
export function driftedSource(): Seed {
  return (root, env) => {
    const doc = path.join(root, DRIFTED_DOC);
    writeFileSync(doc,
      '# A seeded source document\n\n'
      + 'A paragraph a reference item snapshots, in a disposable copy of the corpus.\n');
    runCli(root, env, [
      'add', 'reference', DRIFTED_REF_TITLE, '--file', DRIFTED_DOC.split(path.sep).join('/'),
      '--summary', 'A seeded reference that exists so one doctor finding routes to a repair.',
      '--yes',
    ]);
    appendFileSync(doc,
      '\nA line appended AFTER the snapshot, so the item holds the old text and doctor says so.\n');
  };
}

/**
 * **Procedures, which this corpus holds none of.**
 *
 * `served-shape.spec.ts`'s last test compares the cards the Procedures screen
 * drew against what `/api/procedures` listed, and guards the comparison
 * against its own vacuity — two empty lists compare equal. Measured on the
 * live corpus 2026-09-11: `/api/procedures` lists NOTHING, so the guard fires
 * and the test says so, correctly.
 *
 * Three of them, and two are then driven through `procedure activate` and
 * `procedure done` — the commands a person types — so the screen has more than
 * one lifecycle state to draw.
 *
 * **The states are NOT what the test rests on**, and saying so here is the
 * point: `served-shape.spec.ts` compares the cards the screen drew against the
 * ids `/api/procedures` listed, so what it needs is that the list is not empty.
 * `runCli` returns a command's stdout even when it exits non-zero, so a refused
 * `activate` would leave three ready procedures and the comparison would still
 * be a real one. If a spec ever comes to need a RUNNING procedure specifically,
 * it should assert that state rather than trust this sentence.
 */
export function procedures(): Seed {
  return (root, env) => {
    const ids: string[] = [];
    for (const [title, first, second] of [
      ['Bring a browser lane back onto the real corpus',
        'Read the two items the plan names before touching a spec.',
        'Re-measure every figure the last lane reported, and say where it differs.'],
      ['Retire a fixture without losing the reason it existed',
        'Classify every spec that named it into the three cases the return names.',
        'Re-derive any shrink-only ledger over the corpus that replaces it.'],
      ['Settle a doctor code that answers for many rows at once',
        'Read one finding of the code in full before settling the class.',
        'Acknowledge the class, and record what was read rather than the count.'],
    ] as [string, string, string][]) {
      ids.push(addSettlingContradictions(root, env, [
        'add', 'procedure', title,
        '--body', 'Seeded by e2e/seeds.ts into a disposable copy of this corpus so the Procedures '
          + 'screen has something to draw. It is deleted with the copy.',
        '--summary', `A seeded one-shot procedure: ${title.toLowerCase()}.`,
        '--step', first, '--step', second,
        '--yes',
      ]));
    }
    // One RUNNING and one FINISHED, so the screen draws all three states rather
    // than three copies of one.
    runCli(root, env, ['procedure', 'activate', ids[1]!]);
    runCli(root, env, ['procedure', 'activate', ids[2]!]);
    runCli(root, env, ['procedure', 'done', ids[2]!]);
  };
}

/* ══ 4 · SESSIONS WITH REAL INJECTION HISTORY ══════════════════════════════ */

/** The session ids `realInjections` produces. Named here, used by the specs. */
export const SEEDED_SESSION = 'e2e-seeded-session';
/** A session driven through several events, so its lists overflow. */
export const SEEDED_LONG = `${SEEDED_SESSION}-long`;
/** A session `/clear` destroyed: ledger history, no seen file. */
export const SEEDED_CLEARED = `${SEEDED_SESSION}-cleared`;
/**
 * A session with ONE start and nothing else — short enough that its lists fit
 * inside their own caps.
 *
 * Seeded LAST, so it is the one `/api/sessions` answers as `default` and the
 * one the shell lands on. Both halves of that matter and they pull in
 * opposite directions: `injected-empty.spec.ts`'s first test needs the landing
 * session to HAVE lines, and `session-picker.spec.ts` needs it to hold none
 * BACK — "over the default session this table holds nothing back" is its
 * precondition, and without it the picker could be proved to have moved
 * nothing. A short session satisfies both; the long one satisfies neither.
 */
export const SEEDED_SHORT = `${SEEDED_SESSION}-short`;
/** An id no seed ever writes — the true "nothing to report" case. */
export const SEEDED_NEVER = `${SEEDED_SESSION}-never-injected-into`;

/**
 * **Real injections, from the real hook entry points, fed on stdin.**
 *
 * `scripts/demo-corpus.ts` did exactly this before it was retired, and its own
 * words are the reason to keep the method and drop the fixture: *"Nothing here
 * is fabricated. The real hook is fed the real payload on stdin, exactly as
 * Claude Code feeds it, and whatever it does to `state/` is what the product
 * does."* What was wrong with `.demo-corpus` was the corpus underneath, not
 * this.
 *
 * Three shapes come out of it, and `injected-empty.spec.ts` and
 * `injected-real-spills.spec.ts` between them need all three:
 *
 *   `SEEDED_LONG`      several `SessionStart`s and a `PreToolUse` against a
 *                      scoped path, so the seen file is long enough for a
 *                      bounded list to hold rows back, and — under
 *                      `squeezeBudgets` — the injections really spill.
 *   `SEEDED_SHORT`     one `SessionStart`, seeded last, so the shell lands on
 *                      a session that has lines and holds none of them back.
 *   `SEEDED_CLEARED`   one `SessionStart`, then the real `SessionEnd` hook
 *                      with `reason: 'clear'`. The ledger keeps the injection
 *                      and the seen file is gone: a session with a history and
 *                      an empty window, produced by the product rather than
 *                      asserted to be impossible.
 *   `SEEDED_NEVER`     written nowhere, so a screen has a measured zero to
 *                      draw rather than a blank.
 *
 * **`starts` is the number of SessionStarts the long session gets.** Each one
 * appends an injection record and grows the seen file. Four is what carries
 * the long session past `BOUND_CAP_TABLE`, the 50-row cap on `Injected now`:
 * measured on a twin 2026-09-11, the long session's seen file holds 100 lines
 * at the real budgets and the short one 45, which is why one draws the paging
 * control and the other draws "Showing all 45".
 */
export function realInjections(starts = 4, toolPath = 'src/core/inject.ts'): Seed {
  return (root, env) => {
    const hook = (script: string, payload: Record<string, unknown>): void => {
      execFileSync(process.execPath, [
        '--disable-warning=ExperimentalWarning', path.join(HOOKS, script),
      ], { cwd: root, input: JSON.stringify(payload), encoding: 'utf8', stdio: 'pipe', env });
    };
    // **The CLEARED session goes FIRST, and the order is load-bearing.**
    // `/api/sessions` answers the MOST RECENTLY INJECTED session as its
    // `default`, and the shell lands on that one. Seeded last, the default
    // would be a session whose window was destroyed — so `Injected now` would
    // open on an empty table and `injected-empty.spec.ts`'s first test, whose
    // whole subject is a session that HAS lines, would measure the opposite of
    // what it says. Measured here on 2026-09-11, in exactly that shape.
    hook('session-start.ts', {
      session_id: SEEDED_CLEARED, hook_event_name: 'SessionStart', source: 'startup', cwd: root,
    });
    hook('session-end.ts', {
      session_id: SEEDED_CLEARED, hook_event_name: 'SessionEnd', reason: 'clear', cwd: root,
    });
    for (let i = 0; i < starts; i++) {
      hook('session-start.ts', {
        session_id: SEEDED_LONG, hook_event_name: 'SessionStart',
        source: ['startup', 'resume', 'compact', 'clear'][i % 4], cwd: root,
      });
      hook('pre-tool-use.ts', {
        session_id: SEEDED_LONG, hook_event_name: 'PreToolUse',
        tool_name: 'Edit', tool_input: { file_path: path.join(root, toolPath) }, cwd: root,
      });
    }
    // LAST, so this is the session the shell lands on. See `SEEDED_SHORT`.
    hook('session-start.ts', {
      session_id: SEEDED_SHORT, hook_event_name: 'SessionStart', source: 'startup', cwd: root,
    });
    // **The audit projection is NOT built here, and that is deliberate.**
    // These hooks have just appended injection records to the log, and a
    // projection behind its log makes every read surface refuse — but
    // `scratchCorpus` rebuilds the index AFTER the seed runs, and the ledger
    // and the projection both live in that index, so a sync made here is
    // undone a moment later. It is made once, last, by `scratchCorpus` itself,
    // where nothing can undo it.
  };
}
