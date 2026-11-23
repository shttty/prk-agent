
/** Projection exposes raw code or JSON text in `argsText`; structured bodies parse the latter here. */
export function parseToolArgs(code) {
  try {
    const value = JSON.parse(code);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
