// /system-design — landing page redirects to the default doc.
// Keeps the route shape consistent (everything lives under
// /system-design/<slug>) without an empty intermediate page.

import { redirect } from "next/navigation";

import { DEFAULT_DOC_SLUG } from "@/lib/docs";

export default function SystemDesignIndex() {
  redirect(`/system-design/${DEFAULT_DOC_SLUG}`);
}
