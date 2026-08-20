import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * NO legacy redirects yet, deliberately.
   *
   * `/social?scale=…` is now the one social terminal and the nav points only
   * there. Redirecting `/hub/community`, `/planet` and `/world` was tried and
   * reverted: several in-page links are RELATIVE (`?mode=groups&community=…`
   * on the group cards), so on `/social` they resolve against the new path and
   * drop the `scale` parameter — a redirect would have turned working links
   * into silent scale resets.
   *
   * Both paths therefore stay live during the hoist. The redirects go in once
   * the relative links carry the scale explicitly.
   */
};

export default nextConfig;
