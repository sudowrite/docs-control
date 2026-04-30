/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing .js ES modules from lib/
    esmExternals: true,
    // Packages that need Node.js runtime (not bundled)
    serverComponentsExternalPackages: [
      'gray-matter',
      'turndown',
      'cheerio',
      // Agent SDK has native binaries and a Claude Code subprocess wrapper —
      // must stay external to avoid Next bundling its optional native deps.
      '@anthropic-ai/claude-agent-sdk',
    ],
    // The Agent SDK loads its native binary at runtime, so Next's static file
    // tracer doesn't see it. Explicitly include all platform binaries on the
    // chat stream route so Vercel's lambda has whatever the runtime needs.
    outputFileTracingIncludes: {
      '/api/chat/stream': [
        './node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/**/*',
        './node_modules/@anthropic-ai/claude-agent-sdk-linux-arm64/**/*',
      ],
    },
  },
};

export default nextConfig;
