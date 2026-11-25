import { WireError } from "../../gateway/wire/create-error.ts";
import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";

export function validateRequest(method: string, value: unknown, limits: LimitsOptions): Record<string, unknown> {
  const invalid = (): never => { throw new WireError("INVALID_REQUEST", "Invalid target file request."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const p = Object.fromEntries(Object.entries(value));
  if (typeof p.sessionId !== "string" || !p.sessionId || p.sessionId.length > limits.identityChars || /[\p{Cc}]/u.test(p.sessionId)) return invalid();
  if (typeof p.target !== "string" || !p.target || p.target.length > limits.identityChars || /[\p{Cc}]/u.test(p.target)) return invalid();
  const fields: Record<string, string[]> = {
    filesList: ["path"], filesDownload: ["path"], filesUpload: ["path", "overwrite"], filesRead: ["path", "format"], filesWrite: ["path", "content", "format", "expectedLastModified"],
    filesCreate: ["path", "type", "content", "format"], filesRename: ["path", "newPath"], filesCopy: ["path", "toDir"], filesDelete: ["path"],
  };
  const allowed = fields[method];
  if (!allowed || Object.keys(p).some((key) => key !== "sessionId" && key !== "target" && !allowed.includes(key))) return invalid();
  for (const field of ["path", ...(method === "filesRename" ? ["newPath"] : method === "filesCopy" ? ["toDir"] : [])]) {
    if (method === "filesList" && p[field] === undefined) continue;
    if (typeof p[field] !== "string" || p[field].length > limits.cwdChars) return invalid();
    absolutePath(p[field]);
  }
  if (method === "filesUpload" && typeof p.overwrite !== "boolean") return invalid();
  if (p.format !== undefined && p.format !== "text" && (method !== "filesRead" || p.format !== "base64")) return invalid();
  if (method === "filesWrite" && (typeof p.content !== "string" || p.format === undefined)) return invalid();
  if (method === "filesCreate" && (p.type !== "file" && p.type !== "directory" || p.type === "directory" && (p.content !== undefined || p.format !== undefined))) return invalid();
  if (p.content !== undefined && typeof p.content !== "string") return invalid();
  if (p.expectedLastModified !== undefined && (typeof p.expectedLastModified !== "string" || !/^mtime:-?\d+(?:\.\d+)?$/u.test(p.expectedLastModified) || !Number.isFinite(Number(p.expectedLastModified.slice(6))))) return invalid();
  return p;
}
