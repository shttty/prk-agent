import { parse } from "smol-toml";
import type { PrkDocumentFilename } from "./read-prk-document-snapshot.ts";

export function parsePrkDocument(source: string, filename: PrkDocumentFilename): Record<string, unknown> {
  const kind = filename === "config.toml" ? "PRK configuration" : "instance configuration";
  let parsed: unknown;
  try { parsed = parse(source); }
  catch { throw new Error(`Invalid ${kind}: ${filename} is not valid TOML.`); }
  return plainTomlValue(parsed, kind) as Record<string, unknown>;
}

function plainTomlValue(value: unknown, kind: string): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => plainTomlValue(item, kind));
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) throw new Error(`Invalid ${kind}: unsupported TOML value.`);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainTomlValue(item, kind)]));
  }
  throw new Error(`Invalid ${kind}: unsupported TOML value.`);
}
