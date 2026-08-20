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
    /* WHO IS ACTING — decided once, at boot, from the environment.
       Until now `viewerContext.ts` initialised its module-level provider to
       LOCAL_SINGLE_USER, so the single-user provider was the DEFAULT rather
       than a choice, and SESSION_VIEWER existed without ever being reachable.
       `activateViewerProvider` reads PHILOS_VIEWER_MODE and installs one
       provider with no overlap between them: LOCAL_DEV means one local
       developer, anything else — including a missing variable — means
       SESSION, where a request without a valid session resolves to nobody.
       A missing variable must not open the dev door. */
    const { activateViewerProvider } = await import('./app/lib/philos/identity/viewerMode');
    const mode = activateViewerProvider();
    console.log(`[philos] viewer provider: ${mode}`);

    const { runStartupRecovery } = await import('./app/lib/essence/startup-recovery');
    try {
      await runStartupRecovery();
    } catch (err) {
      // Recovery failures must not crash the server.
      console.error('[essence] startup recovery failed (non-fatal):', err);
    }
  }
}
