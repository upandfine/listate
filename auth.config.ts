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
      const isAdmin = auth?.user?.role === 'admin';
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname === '/' ||
        pathname.startsWith('/t/') ||
        pathname.startsWith('/datenschutz') ||
        pathname.startsWith('/impressum') ||
        pathname === '/login' ||
        pathname.startsWith('/api/auth') ||
        pathname === '/api/health' ||
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico' ||
        pathname === '/icon.svg' ||
        pathname === '/apple-icon' ||
        pathname === '/opengraph-image' ||
        pathname === '/twitter-image' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname === '/manifest.webmanifest';

      if (isPublic) return true;

      // /admin nur für Admins; Nicht-Admins werden auf /login geschickt,
      // wo sie sich ggf. mit Admin-Account einloggen können.
      if (pathname.startsWith('/admin')) {
        return isLoggedIn && isAdmin;
      }

      return isLoggedIn;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role as 'user' | 'admin';
      return session;
    },
  },
} satisfies NextAuthConfig;
