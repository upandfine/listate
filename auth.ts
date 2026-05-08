import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';

import authConfig from './auth.config';
import { getDb } from './db';
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from './db/schema';

const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Dev-Bypass-Login.
 *
 * Doppelt abgesichert: greift nur wenn beide Bedingungen erfüllt sind:
 *  1. NODE_ENV !== 'production' (Build-Zeit-Konstante)
 *  2. DEV_AUTH_BYPASS === 'true' (Runtime-ENV, in Sliplane NIE setzen)
 *
 * In Production existiert der Provider nicht – die Login-Seite zeigt
 * dann auch keinen Dev-Login-Button.
 */
export const isDevBypassEnabled =
  process.env.NODE_ENV !== 'production' &&
  process.env.DEV_AUTH_BYPASS === 'true';

const DEV_USER = {
  email: 'dev@listate.local',
  name: 'Dev User',
  role: 'admin' as const,
};

const devBypassProvider = isDevBypassEnabled
  ? [
      Credentials({
        id: 'dev-bypass',
        name: 'Dev Bypass',
        credentials: {},
        async authorize() {
          if (!isDevBypassEnabled) return null;
          const db = getDb();
          // Hole bestehenden Dev-User oder lege ihn an. Damit klappen
          // alle FK-Beziehungen (links.user_id) wie bei einem echten
          // OAuth-Login.
          let dbUser = db
            .select()
            .from(users)
            .where(eq(users.email, DEV_USER.email))
            .get();
          if (!dbUser) {
            const id = crypto.randomUUID();
            db.insert(users)
              .values({
                id,
                email: DEV_USER.email,
                name: DEV_USER.name,
                role: DEV_USER.role,
              })
              .run();
            dbUser = db.select().from(users).where(eq(users.id, id)).get();
          }
          if (!dbUser) return null;
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            image: dbUser.image,
            role: dbUser.role,
          };
        },
      }),
    ]
  : [];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...devBypassProvider],
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (
        user.email &&
        user.id &&
        superAdminEmails.includes(user.email.toLowerCase())
      ) {
        getDb()
          .update(users)
          .set({ role: 'admin' })
          .where(eq(users.id, user.id))
          .run();
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const dbUser = getDb()
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, user.id))
          .get();
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
  },
});
