import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
