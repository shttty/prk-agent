import { summarizeDescription } from "./summarize-description.ts";

const DOUBLE = '"'.repeat(3);
const SINGLE = "'".repeat(3);

/**
 * The docstring of a stub: the description's first paragraph (`summary`) or all of it (`full`), then the tool's prompt guidelines as bullets.
 * Backslashes and triple quotes are escaped so the stub stays valid Python.
 */
export function renderDocstring(description: string, guidelines: readonly string[], detail: "summary" | "full"): string {
  const text = detail === "summary" ? summarizeDescription(description) : description.trim().replace(/[ \t]+$/gmu, "");
  const bullets = guidelines.map((guideline) => guideline.trim().replace(/\s+/gu, " ")).filter(Boolean).map((guideline) => `- ${guideline}`);
  const body = [text, ...(bullets.length > 0 ? [bullets.join("\n")] : [])].filter(Boolean).join("\n\n");
  const escaped = body.replaceAll("\\", "\\\\").replaceAll(DOUBLE, SINGLE).replace(/"$/u, '\\"');
  return `    ${DOUBLE}${escaped.split("\n").map((line) => (line ? `    ${line}` : line)).join("\n").trimStart()}${DOUBLE}`;
}
