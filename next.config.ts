import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lint runs in CI; skip during build so eslint-config-next version mismatches
  // don't block deploys.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
