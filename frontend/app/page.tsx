// Root: send everyone to /dashboard. Middleware redirects unauthenticated
// visitors to /sign-in, so this stays a one-liner.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
