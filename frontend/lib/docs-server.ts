// Server-only filesystem reader for the /system-design docs. Kept separate
// from lib/docs.ts so the client-safe manifest can be imported by the
// sidebar without dragging `node:fs` into the browser bundle.
//
// `import "server-only"` makes any attempt to import this from a client
// component a build error — earlier signal than the runtime "fs is not
// defined" we'd get otherwise.

import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { findDocBySlug } from "./docs";

// Reads a doc's raw markdown from the on-disk copy at frontend/docs/.
// Returns null when the slug isn't in the manifest or the file is missing.
export async function readDoc(slug: string): Promise<string | null> {
  const entry = findDocBySlug(slug);
  if (!entry) return null;
  const filePath = path.join(process.cwd(), "docs", entry.filename);
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}
