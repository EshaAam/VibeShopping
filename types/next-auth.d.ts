import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  export interface Session {
    user: {
      role: string;
    } & DefaultSession['user'];
  }

  // What authorize() returns and the jwt callback receives on sign-in
  export interface User {
    role?: string;
  }
}

// next-auth/jwt only re-exports this module, so augment it at the source
declare module '@auth/core/jwt' {
  export interface JWT {
    role?: string;
  }
}
