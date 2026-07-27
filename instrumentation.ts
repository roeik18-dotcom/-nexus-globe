/**
 * Next.js Instrumentation Hook (M0-14)
 *
 * Exported `register()` is called exactly once per server startup by Next.js.
 * The NEXT_RUNTIME guard restricts Node.js-only imports to the Node.js runtime.
 *
 * Stable since Next.js v15 — no experimental flag required.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runStartupRecovery } = await import('./app/lib/essence/startup-recovery');
    try {
      await runStartupRecovery();
    } catch (err) {
      // Recovery failures must not crash the server.
      console.error('[essence] startup recovery failed (non-fatal):', err);
    }
  }
}
