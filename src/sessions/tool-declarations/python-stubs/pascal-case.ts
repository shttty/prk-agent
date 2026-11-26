/** `web_search` -> `WebSearch`, `numResults` -> `NumResults`: each alphanumeric run gets a capital first letter. */
export function pascalCase(text: string): string {
  return text.split(/[^A-Za-z0-9]+/u).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join("");
}
