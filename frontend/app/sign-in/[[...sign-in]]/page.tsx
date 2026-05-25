// Catch-all route so Clerk's prebuilt <SignIn /> can own the URL space
// (`/sign-in`, `/sign-in/factor-one`, etc.) without us writing a route per step.
//
// Intentionally left as Clerk's default (light) theme — the rest of the
// dashboard is dark, but sign-in is hit once per session and readability of
// Clerk's defaults beats fighting their appearance API for full dark control.

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <SignIn />
    </main>
  );
}
