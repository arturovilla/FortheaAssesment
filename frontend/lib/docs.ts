// Docs manifest — the curated list + order of markdown files surfaced in
// /system-design. README is pinned at the top because it carries the brief
// and the FR/NFR grid the rest of the docs reference; the parts follow in
// numerical order; the supporting data-generator note sits at the bottom.
//
// Adding a new doc = drop the .md into frontend/docs/ and add an entry here.
// We never list files dynamically so the order + labels + slugs stay
// editorial decisions, not whatever the filesystem returns.
//
// CLIENT-SAFE: this file must stay free of node-only imports (`fs`, `path`,
// etc.) so client components like the sidebar can import DOCS. The filesystem
// reader lives in lib/docs-server.ts.

export interface DocEntry {
  slug: string;
  title: string;
  hint: string;       // shown under the title in the sidebar
  filename: string;
}

export const DOCS: readonly DocEntry[] = [
  {
    slug: "readme",
    title: "Brief & requirements",
    hint: "The assessment, framed",
    filename: "README.md",
  },
  {
    slug: "part-1-architecture",
    title: "Part 1: Architecture",
    hint: "Systems design + decisions",
    filename: "part-1-architecture.md",
  },
  {
    slug: "part-2-backend",
    title: "Part 2: Backend",
    hint: "FastAPI service design",
    filename: "part-2-backend.md",
  },
  {
    slug: "part-3-data-engineering",
    title: "Part 3: Data Engineering",
    hint: "Pipeline, marts, anomaly SQL",
    filename: "part-3-data-engineering.md",
  },
  {
    slug: "part-4-frontend",
    title: "Part 4: Frontend",
    hint: "Next.js dashboard + auth flow",
    filename: "part-4-frontend.md",
  },
  {
    slug: "part-5-llm-integration",
    title: "Part 5: LLM Integration",
    hint: "Conversational analytics + guardrails",
    filename: "part-5-llm-integration.md",
  },
  {
    slug: "data-generator",
    title: "Data Generator",
    hint: "Synthetic data shape + rationale",
    filename: "data-generator.md",
  },
];

export const DEFAULT_DOC_SLUG = "readme";

export function findDocBySlug(slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug === slug);
}
