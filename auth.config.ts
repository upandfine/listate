import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export default {
  providers: [Google],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname.startsWith('/t/') ||
        pathname.startsWith('/datenschutz') ||
        pathname.startsWith('/impressum') ||
        pathname === '/login' ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico';

      if (isPublic) return true;
      return isLoggedIn;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as 'user' | 'admin';
      return session;
    },
  },
} satisfies NextAuthConfig;
