/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    // The world is the home — entering Philos drops you into the Living Planet.
    return [{ source: "/", destination: "/planet", permanent: false }];
  },
};

module.exports = nextConfig;
