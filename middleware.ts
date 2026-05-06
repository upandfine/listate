import NextAuth from 'next-auth';
import authConfig from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export default middleware((_req) => {
  // Routenschutz erfolgt im `authorized`-Callback (auth.config.ts).
  // Bei false redirected Auth.js automatisch zur Login-Seite.
});

export const config = {
  // Alles außer Next-Internals und statische Assets durchlassen, der Callback entscheidet.
  matcher: [
    '/((?!_next/|favicon\\.ico|.*\\.(?:png|svg|ico|webp|jpg|jpeg|gif)).*)',
  ],
};
