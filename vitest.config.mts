import { configDefaults, defineConfig } from "vitest/config";
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
    /* `.scratch/` IS NEVER PART OF THE SUITE.
       Without this the default glob sweeps the whole repository, so any
       throwaway harness a person leaves in `.scratch/` named `*.spec.mts` or
       `*.test.ts` is collected by `npm test` — and runs with whatever
       directories happen to be configured. That is not hypothetical: it is
       the exact mechanism that appended four records to the real logs during
       Phase 4, and it stayed open afterwards because the fix at the time was
       to rename the one offending file rather than to close the door.
       Scratch harnesses run through their own config, which names the file
       explicitly and the isolated directories with it. */
    exclude: [...configDefaults.exclude, ".scratch/**"],
  },
});
