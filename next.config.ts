import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ESLint runs in CI AND during `next build` so cross-module import
  // violations and other lint errors fail deploys.
};

export default nextConfig;
