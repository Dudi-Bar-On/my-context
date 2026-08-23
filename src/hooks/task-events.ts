import { capped, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The harness's own tasks, observed — `TaskCreated` and `TaskCompleted`.
 *
 * These two are one file because they are one payload: build 2.1.239 declares
 * them with identical fields (`task_id`, `task_subject`, and the optional
 * `task_description`, `teammate_name` and the deprecated `team_name`) at bytes
 * 303344598 and 303344921, and neither has a matcher query at all — both fall
 * into `case"TeammateIdle":case"TaskCreated":case"TaskCompleted":break;` (byte
 * 317139714), so every registered entry runs and a matcher would be dead
 * configuration. Two binaries, two ops, one shape: a reader filtering
 * `--op task-created` is asking a different question from `--op task-completed`,
 * which is why the ops are not merged, and everything else about them is the
 * same, which is why the code is not duplicated.
 *
 * ── WHAT `seq:21` HOPED FOR, AND WHAT IS ACTUALLY DELIVERED ────────────────
 *
 * The ruling reads *"would tie the harness's tasks to the corpus's own task
 * category"*. Tying them means WRITING: a `TaskCreated` firing becomes a `task`
 * item under `.my_context/items/task/`, or updates one, or closes one on
 * `TaskCompleted`. Every one of those is my_context creating corpus content
 * that no human and no agent asked it to create, from text it did not author,
 * on a schedule the user does not control — and `hooks seq:22`'s constraint is
 * that *a default that quietly does something is worse than no default*. It is
 * also the exact shape `INV-markdown-is-the-source-of-truth` is most exposed
 * to: items that appear in the corpus without a human deciding they belong.
 *
 * So the tie is not made. The rows are written, they carry the harness's own
 * `task_id`, and that id is the join a later ruling would need. Nothing else
 * follows.
 *
 * ── WHAT GOES IN THE ROW ───────────────────────────────────────────────────
 *
 * `task_id` and a capped `task_subject`. `task_description` is on the payload
 * and is deliberately not read and not declared on `HookInput`: it is the body
 * of the task, which is content, and the log records scope. The subject is a
 * one-line title and is capped anyway, for `RefusalDetail`'s reason — it is
 * caller text, and a log line that scrolls the terminal discloses less than one
 * that fits on it.
 */
function observeTask(input: HookInput): Observation | null {
  const id = typeof input.task_id === 'string' && input.task_id !== '' ? input.task_id : null;
  // The id is the gate, not the subject: a row that cannot name the task cannot
  // be joined to anything, which is the only reason to keep it.
  if (id === null) return null;

  const subject = typeof input.task_subject === 'string' && input.task_subject !== ''
    ? capped(input.task_subject, 120) : '<absent>';

  return { note: `task=${capped(id, 64)} subject=${subject}; no corpus item was written` };
}

export const TASK_CREATED: ObservationSpec = {
  hook: 'TaskCreated',
  op: 'task-created',
  observe: observeTask,
};

export const TASK_COMPLETED: ObservationSpec = {
  hook: 'TaskCompleted',
  op: 'task-completed',
  observe: observeTask,
};
