
export function workspacePath(value: unknown, max: number, root = false): value is string {
  return typeof value === "string" && value.length <= max && (root && value === "" || value.length > 0
    && !/^[A-Za-z]:/u.test(value) && !/[\\\p{Cc}]/u.test(value)
    && value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."));
}
