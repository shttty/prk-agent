export function parseSlash(message: string): { kind: "command" | "unknown" | "text"; name?: string; args?: string } {
  const trimmed = message.trimStart();
  if (!trimmed.startsWith("/")) return { kind: "text" };
  const match = /^\/([^\s]+)(?:\s+([\s\S]*))?$/u.exec(trimmed);
  if (!match) return { kind: "unknown", name: trimmed.slice(1).split(/\s/u)[0] };
  return { kind: "command", name: match[1], args: match[2]?.trim() };
}
