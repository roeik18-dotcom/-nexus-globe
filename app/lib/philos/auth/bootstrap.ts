/**
 * WHICH AUTH IS INSTALLED, decided once, at boot.
 *
 * The production path is NOT configured, and this file says so out loud
 * rather than defaulting to something that happens to work. With no
 * credential source connected, `NO_CREDENTIAL_PROVIDER` authenticates nobody
 * and `NO_IDENTITY_DIRECTORY` maps nobody — a deployment reaching here has no
 * way in, which is the correct state for a system whose credential source has
 * not been built.
 *
 * The development path is installed ONLY in a development or test runtime,
 * and the guard throws before anything is installed if the dev flag is set in
 * a production-like one.
 */
import { DEV_ACCOUNT_SECRETS, DEV_IDENTITY_TABLE, DEV_ACCOUNTS } from "./devFixtureAccounts";
import { DevPasswordVerifier } from "./devPasswordVerifier";
import { setCredentialVerifier } from "./credentialVerifier";
import { setIdentityDirectory, StaticIdentityDirectory } from "./identityDirectory";
import { assertRuntimeSafe, devSignInAllowed, type RuntimeEnv } from "./productionGuard";

export type AuthMode = "DEV_PASSWORD" | "NOT_CONFIGURED";

export async function activateAuth(env: RuntimeEnv = process.env): Promise<AuthMode> {
  // Throws in a production-like runtime with the dev flag set. Before any
  // provider is installed, so a refused runtime installs nothing at all.
  assertRuntimeSafe(env);

  if (!devSignInAllowed(env)) return "NOT_CONFIGURED";

  setCredentialVerifier(new DevPasswordVerifier(await DEV_ACCOUNTS(), env));
  setIdentityDirectory(new StaticIdentityDirectory(DEV_IDENTITY_TABLE));
  return "DEV_PASSWORD";
}

export { DEV_ACCOUNT_SECRETS };
