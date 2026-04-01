import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import type { NextRequest } from 'next/server';
import { validateApiKey } from './api-keys';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Restrict to @sudowrite.com domain
      return profile?.email?.endsWith('@sudowrite.com') ?? false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});

/**
 * Dual auth: checks NextAuth session first, then Bearer token.
 * Returns the authenticated user email/identifier or null.
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<string | null> {
  // Check NextAuth session
  const session = await auth();
  if (session?.user?.email) {
    return session.user.email;
  }

  // Check Bearer token (for agent API access)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('swdc_')) {
      const keyMeta = await validateApiKey(token);
      if (keyMeta) {
        return `agent:${keyMeta.name}`;
      }
    }
  }

  return null;
}
