/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
    outputFileTracingIncludes: {
      '/**': [
        './node_modules/better-sqlite3/**/*',
        './lib/blocklists/**/*',
      ],
    },
  },
};

export default nextConfig;
