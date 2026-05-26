// Two-column layout used by every /system-design page. Left column = sticky
// docs nav; right column = the rendered markdown article. Both columns sit
// inside the same max-w-7xl <main> from the shared layout.

import { DocsNav } from "./docs-nav";

export function DocsShell({
  activeSlug,
  children,
}: {
  activeSlug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside>
        <DocsNav activeSlug={activeSlug} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
