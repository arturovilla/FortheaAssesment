// Shared layout for both authenticated views: /dashboard and /system-design.
//
// Topbar layout:
//   left  : TenantSelector
//   right : ViewToggle (Dashboard | System design) + Clerk UserButton
//
// The layout is intentionally neutral — no h1, no page-specific copy. Each
// child route owns its own content header. Both routes inherit Clerk
// protection from middleware.ts at the project root.

import { UserButton } from "@clerk/nextjs";

import { TenantSelector } from "./_components/tenant-selector";
import { ViewToggle } from "./_components/view-toggle";

// Every route under (authenticated) is request-time only:
//   - Clerk middleware gates each request, so prerendering is meaningless
//   - useSearchParams() inside TenantSelector + useRange triggers Next.js's
//     SSR-bailout error on prerender
//   - /system-design pages read markdown via fs.readFile per request
//
// Forcing dynamic at the layout level applies to every page that uses this
// layout, so we don't have to remember to set it on each new authenticated
// route.
export const dynamic = "force-dynamic";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ctp-crust text-ctp-text">
      <header className="sticky top-0 z-10 border-b border-ctp-surface0/60 bg-ctp-crust/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3.5 sm:px-8">
          <TenantSelector />
          <div className="flex items-center gap-3">
            <ViewToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "h-9 w-9 ring-1 ring-ctp-surface0/60 hover:ring-ctp-overlay0/60 transition",
                },
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
