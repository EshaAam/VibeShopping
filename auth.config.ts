// Edge-safe half of the Auth.js config: who may see which page, and what a
// session looks like. The middleware runs this on every request, so it must not
// import the database - the full config with the Prisma adapter and the
// credentials provider lives in auth.ts and extends this one.
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

export const authConfig = {
  pages: {
    signIn: "/sign-in",
    error: "/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      //setting the user id on the session object from the jwt token
      // A name change arrives through the jwt callback's "update" branch;
      // with JWT sessions this callback never receives `user` or `trigger`.
      session.user.id = token.sub as string;
      session.user.name = token.name;
      session.user.role = token.role as string;
      return session;
    },

    //for guest shopping use sessionCartId
    authorized({ request, auth }) {
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
