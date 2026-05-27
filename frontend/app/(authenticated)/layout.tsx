// Shared layout for both authenticated views: /dashboard and /system-design.
//
// Topbar layout (TUI restyle):
//   left  : FORTHEA TUI v0.1.0 brand · TenantSelector
//   right : ViewToggle (bracket tabs) · ● READY status · Clerk UserButton
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
      <header className="sticky top-0 z-10 border-b border-dashed border-ctp-overlay0/40 bg-ctp-crust/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
          <div className="flex items-center gap-5">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-ctp-teal md:inline">
              FORTHEA TUI v0.1.0
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-ctp-overlay0/40 md:inline-block" />
            <TenantSelector />
          </div>
          <div className="flex items-center gap-5">
            <ViewToggle />
            <span aria-hidden className="hidden h-4 w-px bg-ctp-overlay0/40 lg:inline-block" />
            <span className="hidden items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-ctp-green lg:inline-flex">
              <span className="text-ctp-green">●</span>
              READY
            </span>
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "h-8 w-8 ring-1 ring-ctp-overlay0/40 hover:ring-ctp-mauve/60 transition",
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
