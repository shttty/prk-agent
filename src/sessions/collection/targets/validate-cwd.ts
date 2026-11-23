

export function validSessionCwd(cwd: unknown, maxChars: number): cwd is string {
  return typeof cwd === "string" && cwd.trim().length > 0 && cwd.length <= maxChars
    && !cwd.includes("\0") && !/\p{Cc}/u.test(cwd);
}
