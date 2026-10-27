import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Only the edge-safe config: access is decided from the session JWT, so the
// middleware never loads Prisma or a database driver.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Pages, actions and API routes - not build assets or public images
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
