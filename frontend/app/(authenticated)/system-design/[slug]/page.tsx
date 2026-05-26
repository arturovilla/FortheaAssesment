// /system-design/[slug] — renders one doc from frontend/docs/.
//
// Server component: reads the markdown synchronously from disk via the docs
// manifest, then hands the raw string to the client-side MarkdownView. The
// sidebar is the same on every doc page, so wrap with the shared DocsShell.

import { notFound } from "next/navigation";

import { findDocBySlug } from "@/lib/docs";
import { readDoc } from "@/lib/docs-server";

import { DocsShell } from "../_components/docs-shell";
import { MarkdownView } from "../_components/markdown-view";

export default async function DocPage({
  params,
}: {
  // Next.js 16 makes route params async.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = findDocBySlug(slug);
  if (!entry) notFound();

  const source = await readDoc(slug);
  if (source === null) notFound();

  return (
    <DocsShell activeSlug={slug}>
      <header className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
          {entry.hint}
        </div>
      </header>
      <MarkdownView source={source} />
    </DocsShell>
  );
}
