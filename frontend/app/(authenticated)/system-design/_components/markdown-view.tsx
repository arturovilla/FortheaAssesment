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
        // TUI palette — headings sit in the teal accent; H1/H2 underlines are
        // dashed teal, matching the panel-cap separators used on the
        // dashboard. Square corners throughout.
        "prose-headings:text-ctp-teal",
        "prose-h1:border-b prose-h1:border-dashed prose-h1:border-ctp-teal/40 prose-h1:pb-3 prose-h1:uppercase prose-h1:tracking-[0.06em]",
        "prose-h2:mt-10 prose-h2:border-b prose-h2:border-dashed prose-h2:border-ctp-teal/30 prose-h2:pb-2",
        "prose-h3:text-ctp-mauve",
        "prose-h4:text-ctp-text",
        "prose-p:text-ctp-subtext1",
        "prose-li:text-ctp-subtext1",
        "prose-strong:text-ctp-text",
        "prose-a:text-ctp-mauve prose-a:underline hover:prose-a:text-ctp-lavender",
        // Inline code: square dashed pill in surface0; no fancy quote marks
        // injected by Tailwind typography defaults.
        "prose-code:rounded-none prose-code:border prose-code:border-dashed prose-code:border-ctp-overlay0/40 prose-code:bg-ctp-surface0/40 prose-code:px-1 prose-code:py-0.5 prose-code:text-ctp-text prose-code:before:content-none prose-code:after:content-none",
        // Fenced blocks: highlight.js colours the tokens; we frame the block
        // with a dashed teal border, matching the TuiPanel aesthetic.
        "prose-pre:rounded-none prose-pre:border prose-pre:border-dashed prose-pre:border-ctp-overlay0/50 prose-pre:bg-ctp-mantle",
        // Tables: every doc has them.
        "prose-table:text-sm",
        "prose-th:border-ctp-overlay0/50 prose-th:text-ctp-teal",
        "prose-td:border-ctp-surface0/40 prose-td:text-ctp-subtext1",
        // Blockquotes
        "prose-blockquote:border-l-ctp-mauve/50 prose-blockquote:text-ctp-subtext0",
        // Horizontal rules
        "prose-hr:border-dashed prose-hr:border-ctp-teal/30",
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
