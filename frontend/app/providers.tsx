"use client";

// Client-side providers wired into the root layout. Today just TanStack
// Query; add more here (e.g. a theme context) without touching layout.tsx.
//
// QueryClient is created lazily inside a `useState` initialiser so we get a
// fresh instance per browser tab but the same instance across re-renders.
// `refetchOnWindowFocus: false` keeps the dashboard quiet — we'd rather
// refetch on explicit user action than on every alt-tab.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
