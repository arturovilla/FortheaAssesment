import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import "./globals.css";

// IBM Plex Mono is the primary face — every label, value, button, and pill in
// the TUI restyle renders in mono. Plex Sans is kept as a sans fallback for
// any third-party widget (e.g. Clerk's hosted UI) that ignores our overrides.
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Forthea Dashboard",
  description: "Multi-tenant analytics dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ClerkProvider supplies useUser/useAuth/getToken to the whole tree;
    // Providers (TanStack Query, etc.) sits inside so queries can call
    // Clerk's getToken when fetching.
    <ClerkProvider>
      <html
        lang="en"
        className={`${plexMono.variable} ${plexSans.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col font-mono">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
