import { posix } from "node:path";

export const files = (value: unknown): value is Array<{ path: string; content: string }> => Array.isArray(value)
  && value.every((file) => file && typeof file.path === "string" && posix.isAbsolute(file.path) && typeof file.content === "string");
