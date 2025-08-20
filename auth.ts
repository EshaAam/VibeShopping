// import { error } from 'console';
import NextAuth, { NextAuthConfig } from 'next-auth';
import { prisma } from './db/prisma';
import {PrismaAdapter} from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials';
import { compareSync } from 'bcrypt-ts-edge';

export const config = {
    pages: {
        signIn: '/sign-in',
        error: '/error'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60 // 30 days
    },
    adapter: PrismaAdapter(prisma),
    providers: [
    CredentialsProvider({
      credentials: {
        email: {
          type: 'email',
        },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (credentials == null) return null;

        // Find user in database
        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email as string,
          },
        });
        // Check if user exists and password is correct
        if (user && user.password) {
          const isMatch = compareSync(
            credentials.password as string,
            user.password
          );
          // If password is correct, return user object
          if (isMatch) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            };
          }
        }
        // If user doesn't exist or password is incorrect, return null
        return null;
      },
    }),
  ],
  callbacks: {
    async session ({session,  user, trigger, token} : any) {
        //setting the user id on the session object
        session.user.id = token.sub; 
        session.user.name = token.name;
        session.user.role = token.role;
        console.log(token);
        
        //if there becomes a update then set the name in the session
        if(trigger == 'update') {
          session.user.name = user.name;
        }
        return session;

    },
     async jwt({ token, user, trigger, session }: any) {
      // Assign user fields to token
      if (user) {
        token.role = user.role;

        // If user has no name, use email as their default name
        if (user.name === 'NO_NAME') {
          token.name = user.email!.split('@')[0];

          // Update the user in the database with the new name
          await prisma.user.update({
            where: { id: user.id },
            data: { name: token.name },
          });
        }
      }

      // Handle session updates (e.g., name change)
      if (session?.user.name && trigger === 'update') {
        token.name = session.user.name;
      }

      return token;
    },
  },

} satisfies NextAuthConfig;
export const {handlers, auth, signIn, signOut} = NextAuth(config);