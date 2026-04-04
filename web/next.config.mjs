/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable ISR revalidation
  experimental: {},
  // Ensure server-only env vars are never exposed to the client
  env: {},
};

export default nextConfig;
