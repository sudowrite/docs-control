/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing .js ES modules from lib/
    esmExternals: true,
    // Packages that need Node.js runtime (not bundled)
    serverComponentsExternalPackages: ['gray-matter', 'turndown', 'cheerio'],
  },
};

export default nextConfig;
