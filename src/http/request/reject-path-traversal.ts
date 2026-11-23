import { HttpError } from "./create-error.ts";

/** Reject encoded separators and dot segments before URL normalization can hide them. */
export function rejectPathTraversal(url: string): void {
  const rawPath = url.split("?", 1)[0] ?? "/";
  for (const segment of rawPath.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      continue;
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw new HttpError(400, "Path traversal and encoded path separators are not allowed.");
    }
  }
}
