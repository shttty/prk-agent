/** The allowlist file a path belongs to: web/<top directory>, or the top directory of src, test, scripts and shared. */
export function allowlistScope(path) {
  const [top, second] = path.split("/");
  if (top !== "web") return top;
  return path.split("/").length > 2 ? `web-${second}` : "web-root";
}
