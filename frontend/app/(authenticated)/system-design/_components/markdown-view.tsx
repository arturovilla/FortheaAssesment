"use client";

// Renders a markdown string as React. Pluggable behaviour:
//   - remark-gfm: tables, task-lists, strikethrough, autolinks (every part-*
//     doc uses tables heavily)
//   - rehype-highlight: syntax-highlights fenced code blocks via highlight.js
//     (theme loaded in globals.css)
//   - custom <code> override: routes ```mermaid blocks to MermaidBlock instead
//     of letting highlight.js try to colour mermaid syntax
//
// The prose styling uses @tailwindcss/typography's `prose` class with
// per-element overrides to match the Catppuccin palette. `dark:prose-invert`
// flips defaults to dark-mode-appropriate; the overrides tune colours to
// the exact tokens used elsewhere in the app.

import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "./mermaid-block";

// Rewrite intra-docs markdown links so README-style references navigate
// inside /system-design instead of trying to open the raw .md file.
//
//   ./part-1-architecture.md#2-multi-tenancy
//   frontend/docs/part-1-architecture.md#2-multi-tenancy
//     → /system-design/part-1-architecture#2-multi-tenancy
//
// External links (http/https), absolute paths, and pure fragments are passed
// through unchanged so #section anchors on the current page still work.
function rewriteHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith("http") || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  const normalized = href.replace(/^\.\//, "").replace(/^frontend\/docs\//, "");
  const match = /^([^#]+?)\.md(#.*)?$/.exec(normalized);
  if (match) {
    const slug = match[1];
    const hash = match[2] ?? "";
    return `/system-design/${slug}${hash}`;
  }
  return href;
}

const COMPONENTS: Components = {
  // react-markdown gives us BOTH `pre` and `code` for fenced blocks. The
  // language hint lives on `code` as className="language-xxx", so the cleanest
  // hook is here — intercept `language-mermaid`, render via mermaid; let
  // everything else pass through to default styling + rehype-highlight.
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match?.[1] === "mermaid") {
      return <MermaidBlock code={String(children).trim()} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  // External links open in a new tab; intra-docs links rewrite to
  // /system-design routes; same-page anchors pass through.
  a({ href, children, ...props }) {
    const resolved = rewriteHref(href);
    const external = resolved?.startsWith("http");
    return (
      <a
        href={resolved}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
};

export function MarkdownView({ source }: { source: string }) {
  return (
    <article
      className={[
        // Tailwind typography base + dark-mode defaults
        "prose prose-invert max-w-none",
        // Catppuccin tuning — keep these tight so we read prose consistently
        // across all docs.
        "prose-headings:text-ctp-text",
        "prose-h1:border-b prose-h1:border-ctp-surface0/60 prose-h1:pb-3",
        "prose-h2:mt-10 prose-h2:border-b prose-h2:border-ctp-surface0/40 prose-h2:pb-2",
        "prose-p:text-ctp-subtext1",
        "prose-li:text-ctp-subtext1",
        "prose-strong:text-ctp-text",
        "prose-a:text-ctp-blue prose-a:no-underline hover:prose-a:underline",
        // Inline code (the prose-code selector excludes fenced blocks since
        // those are wrapped in <pre>). Style as a subtle pill.
        "prose-code:rounded prose-code:bg-ctp-surface0/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-ctp-text prose-code:before:content-none prose-code:after:content-none",
        // Fenced blocks: highlight.js colours the tokens; we frame the block.
        "prose-pre:rounded-lg prose-pre:border prose-pre:border-ctp-surface0/60 prose-pre:bg-ctp-mantle",
        // Tables: every doc has them; pad cells and zebra-stripe.
        "prose-table:text-sm",
        "prose-th:border-ctp-surface0/60 prose-th:text-ctp-text",
        "prose-td:border-ctp-surface0/40 prose-td:text-ctp-subtext1",
        // Blockquotes (none in the docs today but harmless)
        "prose-blockquote:border-l-ctp-overlay0/60 prose-blockquote:text-ctp-subtext0",
        // Horizontal rules
        "prose-hr:border-ctp-surface0/60",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // rehype-raw runs FIRST so inline HTML (e.g. the status pills in
        // README) is parsed into the AST. rehype-slug then gets a chance to
        // assign id attributes to headings (needed for fragment-link nav).
        // rehype-highlight runs last to add syntax-token classes to code.
        rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
        components={COMPONENTS}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
