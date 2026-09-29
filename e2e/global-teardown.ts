// @basis TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
/**
 * **DELETE THE SNAPSHOT `e2e/global-setup.ts` MADE.**
 *
 * A frozen corpus is a real copy of `.my_context/` — this repository's is
 * about 200 MB with the audit log in it — so leaving one behind per run is a
 * disk bill, not litter. `%TEMP%` has already been measured full of the
 * scratch twins nobody deleted: 118 `myctx-e2e-` roots against 13 home boxes
 * on 2026-09-11, several of them full copies of this corpus. That measurement
 * is why `removeWithRetries` exists and why this runs at all.
 *
 * **Only the path THIS RUN created is deleted**, read back from
 * `MYCONTEXT_E2E_FROZEN_ROOT` rather than from the corpus variable the
 * fixtures serve. An operator who pointed `MYCONTEXT_E2E_CORPUS` at a
 * directory of their own gets a frozen copy of it and keeps their original;
 * deleting what the fixtures happened to be serving would have deleted theirs.
 *
 * **It never fails the run.** A snapshot that could not be removed is a
 * warning, not a verdict on the suite — the tests have already finished and
 * their result is the answer the run exists to give. `removeWithRetries`
 * waits out the Windows lock a just-exited server leaves behind, and
 * `disposeFrozenCorpus` says so out loud if twelve attempts were not enough.
 */
import { FROZEN_ROOT_ENV, disposeFrozenCorpus } from './frozen-corpus.ts';

export default function globalTeardown(): void {
  const frozen = process.env[FROZEN_ROOT_ENV];
  if (frozen === undefined || frozen === '') return;
  disposeFrozenCorpus(frozen);
}
