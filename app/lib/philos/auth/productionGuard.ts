/**
 * PRODUCTION GUARD — the dev identity selector cannot exist in a real runtime.
 *
 * `PHILOS_DEV_SIGNIN=1` turns a list of names into a way to become any of
 * them. In development that is the point; anywhere real it is a total
 * authentication bypass that looks like a feature. Deployment discipline is
 * not a control: it is a promise that someone will remember, and the failure
 * mode of forgetting is silent and complete.
 *
 * So the combination is made IMPOSSIBLE rather than discouraged. The guard
 * runs at startup and again at every use of the selector, because a process
 * can be reconfigured after boot and a check that ran once is a check that
 * can be outlived.
 *
 * FAIL CLOSED, LOUDLY. A production-like runtime with the flag set does not
 * quietly ignore the flag — ignoring it would hide a misconfiguration that
 * the operator needs to know about, and would leave them believing the
 * selector is available. It throws, and the message says exactly which two
 * settings conflict.
 */
export interface RuntimeEnv {
  NODE_ENV?: string;
  PHILOS_ENV?: string;
  PHILOS_DEV_SIGNIN?: string;
}

/**
 * "Production-like" is deliberately BROAD. Anything that is not explicitly a
 * development or test runtime counts — staging, preview, review apps, a
 * container with no NODE_ENV at all. An unset variable must not read as
 * "development": that is the same fail-open shape as a missing viewer mode.
 */
export function isProductionLike(env: RuntimeEnv = process.env): boolean {
  const declared = (env.PHILOS_ENV ?? env.NODE_ENV ?? "").toLowerCase();
  return declared !== "development" && declared !== "test";
}

export function devSignInAllowed(env: RuntimeEnv = process.env): boolean {
  return env.PHILOS_DEV_SIGNIN === "1" && !isProductionLike(env);
}

export class InsecureRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsecureRuntimeError";
  }
}

/**
 * Throws when the runtime is production-like AND the dev selector is enabled.
 * Called from the startup hook and from the sign-in path itself.
 */
export function assertRuntimeSafe(env: RuntimeEnv = process.env): void {
  if (env.PHILOS_DEV_SIGNIN === "1" && isProductionLike(env)) {
    throw new InsecureRuntimeError(
      "PHILOS_DEV_SIGNIN=1 in a production-like runtime " +
        `(PHILOS_ENV=${env.PHILOS_ENV ?? "unset"}, NODE_ENV=${env.NODE_ENV ?? "unset"}). ` +
        "The dev identity selector is an authentication bypass and refuses to run here. " +
        "Unset PHILOS_DEV_SIGNIN, or declare the runtime as development/test.",
    );
  }
}
