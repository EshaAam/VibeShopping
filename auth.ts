// import { error } from 'console';
import NextAuth, { NextAuthConfig } from "next-auth";
import { prisma } from "./db/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { compareSync } from "bcrypt-ts-edge";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const config = {
  pages: {
    signIn: "/sign-in",
    error: "/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: {
          type: "email",
        },
        password: { type: "password" },
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
    async session({ session, user, trigger, token }: any) {
      //setting the user id on the session object from the jwt token
      session.user.id = token.sub;
      session.user.name = token.name;
      session.user.role = token.role;
      // console.log(token);

      //if there becomes a update then set the name in the session
      if (trigger == "update") {
        session.user.name = user.name;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }: any) {
      if (user) {
        // Assign user properties to the token
        token.id = user.id;
        token.role = user.role;

        if (trigger === 'signIn' || trigger === 'signUp') {
          const cookiesObject = await cookies();
          const sessionCartId = cookiesObject.get('sessionCartId')?.value;
          const sessionWishlistId = cookiesObject.get('sessionWishlistId')?.value;

          if (sessionCartId) {
            // Only claim a guest cart (or one already ours). On a shared
            // browser the session cart can belong to someone else's account.
            const sessionCart = await prisma.cart.findFirst({
              where: {
                sessionCartId,
                OR: [{ userId: null }, { userId: user.id }],
              },
            });

            if (sessionCart) {
              // Replace the user's stored cart with the guest cart in one
              // transaction. The guest cart itself is excluded from the delete,
              // since it may already belong to this user from an earlier login.
              await prisma.$transaction([
                prisma.cart.deleteMany({
                  where: { userId: user.id, id: { not: sessionCart.id } },
                }),
                prisma.cart.update({
                  where: { id: sessionCart.id },
                  data: { userId: user.id },
                }),
              ]);
            }
          }

          // Handle wishlist merge on sign-in
          if (sessionWishlistId) {
            const sessionWishlist = await prisma.wishlist.findFirst({
              where: {
                sessionWishlistId,
                OR: [{ userId: null }, { userId: user.id }],
              },
            });

            if (sessionWishlist) {
              // Same swap as the cart above
              await prisma.$transaction([
                prisma.wishlist.deleteMany({
                  where: { userId: user.id, id: { not: sessionWishlist.id } },
                }),
                prisma.wishlist.update({
                  where: { id: sessionWishlist.id },
                  data: { userId: user.id },
                }),
              ]);
            }
          }
        }

        // If user has no name, use email as their default name
        // Must match the column default in schema.prisma
        if (user.name === "No_Name") {
          token.name = user.email!.split("@")[0];

          // Update the user in the database with the new name
          await prisma.user.update({
            where: { id: user.id },
            data: { name: token.name },
          });
        }
      }

      // Handle session updates (e.g., name change)
      if (session?.user.name && trigger === "update") {
        token.name = session.user.name;
      }

      return token;
    },

    //for guest shopping use sessionCartId
    authorized({ request, auth }: any) {
      // Array of regex patterns of protected paths
      const protectedPaths = [
        /\/shipping-address/,
        /\/payment-method/,
        /\/place-order/,
        /\/profile/,
        /\/user\/(.*)/,
        /\/order\/(.*)/,
        /\/admin/,
      ];

      // Get pathname from the req URL object
      const { pathname } = request.nextUrl;

      // Check if user is not authenticated and on a protected path
      if (!auth && protectedPaths.some((p) => p.test(pathname))) return false;

      // Signed in is not enough for the admin area
      if (/^\/admin/.test(pathname) && auth?.user?.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.nextUrl));
      }

      // Check if cookies need to be set
      const hasCartCookie = request.cookies.get("sessionCartId");
      const hasWishlistCookie = request.cookies.get("sessionWishlistId");

      if (!hasCartCookie || !hasWishlistCookie) {
        // Clone the request headers
        const newRequestHeaders = new Headers(request.headers);

        // Create a new response and add the new headers
        const response = NextResponse.next({
          request: {
            headers: newRequestHeaders,
          },
        });

        // These ids are the only thing standing between a guest and their
        // cart, so keep them away from client-side scripts
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          path: "/",
        };

        // Set cart cookie if not present
        if (!hasCartCookie) {
          const sessionCartId = crypto.randomUUID();
          response.cookies.set("sessionCartId", sessionCartId, cookieOptions);
        }

        // Set wishlist cookie if not present
        if (!hasWishlistCookie) {
          const sessionWishlistId = crypto.randomUUID();
          response.cookies.set("sessionWishlistId", sessionWishlistId, cookieOptions);
        }

        return response;
      } else {
        return true;
      }
    },
  },
} satisfies NextAuthConfig;
export const { handlers, auth, signIn, signOut } = NextAuth(config);
