import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    /* The suite runs as ONE LOCAL DEVELOPER.
       The viewer provider now defaults to whatever PHILOS_VIEWER_MODE says,
       resolved per call rather than installed at boot — so with no variable
       set the tests would run in SESSION mode, present no cookie, resolve to
       nobody, and fail 41 assertions that have nothing to do with identity.
       Declaring the mode here is the honest version of what used to be true
       by accident: these tests assume one known viewer. The two-viewer suite
       overrides the provider explicitly and restores it in a finally. */
    env: { PHILOS_VIEWER_MODE: "LOCAL_DEV" },
  },
});
