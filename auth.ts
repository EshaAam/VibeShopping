// import { error } from 'console';
import NextAuth, { CredentialsSignin, NextAuthConfig } from "next-auth";
import { prisma } from "./db/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { compareSync } from "bcrypt-ts-edge";
import { cookies } from "next/headers";
import { authConfig } from "./auth.config";
import { checkRateLimit, type RateLimit } from "./lib/rate-limit";

// Brute-force brake on password sign-in. Per email stops guessing one
// account's password; per IP stops one machine spraying many accounts, set
// higher because offices and campuses share an address.
const SIGN_IN_LIMITS_PER_EMAIL: RateLimit[] = [{ windowMs: 15 * 60_000, max: 5 }];
const SIGN_IN_LIMITS_PER_IP: RateLimit[] = [{ windowMs: 60 * 60_000, max: 30 }];

// Compared against when there is no password to check, so an unknown email
// takes as long as a wrong password and the timing can't reveal which emails
// have accounts. Same cost factor (10) as real hashes; matches no password.
const TIMING_EQUALISER_HASH = "$2a$10$tAXfSeBvw6ho9zmaCkfz2.LwpjBrTpDq5FBxrjFIN79U42a5EfC5O";

/** Its `code` reaches the sign-in action, which shows a "try later" message. */
export class TooManySignInAttempts extends CredentialsSignin {
  code = "rate_limited";
}

// The full config: the edge-safe part (pages, session, access rules) plus what
// needs the database - the adapter, password sign-in and the cart hand-over.
export const config = {
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: {
          type: "email",
        },
        password: { type: "password" },
      },
      async authorize(credentials, request) {
        if (credentials == null) return null;

        // Checked here rather than in the sign-in action, because Auth.js also
        // exposes this provider directly at /api/auth/callback/credentials.
        const email = String(credentials.email ?? "").trim().toLowerCase();
        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        const byEmail = checkRateLimit("sign-in:email", email, SIGN_IN_LIMITS_PER_EMAIL);
        const byIp = checkRateLimit("sign-in:ip", ip, SIGN_IN_LIMITS_PER_IP);
        if (!byEmail.allowed || !byIp.allowed) throw new TooManySignInAttempts();

        // Find user in database
        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email as string,
          },
        });
        // Always run one bcrypt comparison, even with no account to check
        const isMatch = compareSync(
          credentials.password as string,
          user?.password ?? TIMING_EQUALISER_HASH
        );
        if (user?.password && isMatch) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        }
        // If user doesn't exist or password is incorrect, return null
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
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
              // If both exist, the guest cart on this device wins
              orderBy: { userId: { sort: "asc", nulls: "first" } },
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
              orderBy: { userId: { sort: "asc", nulls: "first" } },
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
  },
} satisfies NextAuthConfig;
export const { handlers, auth, signIn, signOut } = NextAuth(config);
