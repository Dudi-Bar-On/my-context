/**
 * The perf suite's ceiling, adjusted for the one environment that cannot
 * measure the product budget: the GitHub `windows-latest` runner.
 *
 * The base ceilings are PRODUCT budgets — the JIT hook's 50ms p95, the
 * SessionStart 500ms p95 — and they stay in force wherever the measurement
 * is capable of certifying them: every developer machine, and the Ubuntu CI
 * job.
 *
 * "Capable" on Ubuntu means USUALLY, not always, and the distinction is
 * recorded here because an earlier revision of this comment claimed Ubuntu
 * had held every ceiling on every run — which run 31966918291 falsified the
 * same day. The eight Ubuntu jobs that reached this suite on 2026-08-16
 * measured the focus-set JIT p95 at 3.9, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8 — and
 * 52.7ms. That eighth run was not the focus path drifting: in the same job
 * the PLAIN hit path measured 137.8ms (max 694.9ms) and every perf test's
 * wall-clock ran 3–5× the other seven runs' (the focus-READ p95 stayed at
 * 0.017ms — the code was fine, the VM was not). A degraded VM, visible as
 * every test in the job slowing together. The ceiling is NOT widened for
 * it: a 1-in-8 spurious red that a re-run clears keeps its certification
 * value, where a ceiling sized to absorb a 2.8× degraded VM (137.8ms) would
 * certify nothing tighter than the Windows one. A red Ubuntu perf job is
 * therefore read like this: every test slow together → the runner, re-run
 * it; one test slow alone → the code, investigate before any retry.
 *
 * The Windows runner is not such a machine. Of the 13 CI runs that reached
 * `npm run test:perf` on `windows-latest` between 2026-08-13 (the day the
 * step entered CI, f86db31) and 2026-08-16, TWELVE failed the 50ms JIT
 * hit-path ceiling, one passed. The twelve measured p95s: 51.1, 53.4, 62.8,
 * 66.4, 74.6, 75.7, 82.3, 84.3, 94.1, 97.2, 122.3, 152.1 and 371.5ms —
 * against a dev-machine baseline of 20.7–22.7ms for the same test on the
 * same code (recorded in jit-latency.perf.ts's header). The failures span
 * four days and a dozen unrelated branches, so they are not a regression;
 * and a 51-to-372ms spread — 7× between one run and the next on identical
 * code — is not flake around a just-too-tight bound, it is a runner whose
 * disk and 2-vCPU scheduling noise is LARGER than the entire budget being
 * asserted. A number that fails 12 times in 13 on unchanged code measures
 * the runner, not the code.
 *
 * So on Windows CI the ceiling is 10× the product budget, and it means
 * something DIFFERENT, stated here so nobody reads it as the product claim:
 * it certifies the absence of order-of-magnitude regressions — an O(n)
 * full-corpus scan per call, an accidental per-call process spawn, the
 * 16.9s lock-stall class E4 fixed — all of which land far above 500ms,
 * while the worst runner noise ever observed (371.5ms) stays under it. The
 * 50ms claim for Windows itself rests on the dev-machine baselines recorded
 * in each perf file's header, which is where any future re-measurement
 * belongs too.
 *
 * `env` and `platform` are injectable so the scaling rule is itself pinned
 * by a test instead of asserting whatever machine runs it.
 */
export const WINDOWS_CI_MULTIPLIER = 10;

export function perfCeiling(
  baseMs: number,
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): number {
  const windowsCi = platform === 'win32' && env.GITHUB_ACTIONS === 'true';
  return windowsCi ? baseMs * WINDOWS_CI_MULTIPLIER : baseMs;
}
