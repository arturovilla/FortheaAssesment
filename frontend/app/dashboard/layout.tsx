// Shared layout for every /dashboard/* route.
//
// Topbar:
//   - Tenant selector on the left (chip for single-tenant, animated dropdown
//     for multi-tenant). Active tenant lives in the URL.
//   - Clerk's UserButton on the right (avatar → menu with sign out).
//
// Layout shape:
//   - Sticky topbar with subtle translucent border, sits on the dark page.
//   - Main content area is in a max-w-7xl container with breathing room,
//     so cards and charts don't sprawl edge-to-edge on wide displays.

import { UserButton } from "@clerk/nextjs";
import { TenantSelector } from "./_components/tenant-selector";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ctp-crust text-ctp-text">
      <header className="sticky top-0 z-10 border-b border-ctp-surface0/60 bg-ctp-crust/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 sm:px-8">
          <TenantSelector />
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  "h-9 w-9 ring-1 ring-ctp-surface0/60 hover:ring-ctp-overlay0/60 transition",
              },
            }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
