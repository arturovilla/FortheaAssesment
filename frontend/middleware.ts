// Clerk + Next.js middleware.
//
// Every request goes through `clerkMiddleware`, which attaches the request's
// auth state to `auth()` calls in pages, routes, and server components. We
// then mark public routes (the sign-in page) and call `auth.protect()` on
// everything else — unauthenticated requests get redirected to /sign-in.
//
// Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`, but Clerk's
// SDK 7.4.x still ships `clerkMiddleware` for the middleware convention; the
// deprecation is non-breaking. Swap to `proxy.ts` once Clerk publishes
// official Next 16 proxy guidance.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on every page route except Next internals + static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API/TRPC routes.
    "/(api|trpc)(.*)",
  ],
};
