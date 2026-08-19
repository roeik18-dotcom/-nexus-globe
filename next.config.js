/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // exceljs (real Human Config xlsx ingestion, §23) uses internal dynamic
  // requires that the server bundler mishandles when bundled — same class
  // of issue Next.js's own docs describe for native/dynamic-require Node
  // packages. Marking it external makes the server `require()` it natively
  // at runtime instead, which is the documented fix.
  serverExternalPackages: ["exceljs"],
  async redirects() {
    // The Value Hub is the front door, not the globe — PHILOS-PRODUCT-ARCHITECTURE
    // §10.1 and PHILOS-SYSTEM-BLUEPRINT §1. The globe is a visualization layer,
    // reached from the hub once the user has something to visualise.
    return [{ source: "/", destination: "/hub", permanent: false }];
  },
};

module.exports = nextConfig;
