export function isPythonIndexUrl(value: unknown): value is string {
  if (typeof value !== "string" || !/^https?:\/\//iu.test(value) || /[\s\p{Cc}?#]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}
