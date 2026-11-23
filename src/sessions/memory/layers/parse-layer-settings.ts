import { isAbsolute, join } from "node:path";
import type { LayerSettings, LayerSpec } from "./layer-types.ts";

const LAYER_NAME = /^[a-z][a-z0-9_-]{0,31}$/u;
const PATH_VARIABLE = /\{([a-z]+)\}/gu;

/**
 * Validates a merged TOML document into layer settings; `home` expands `~/`, while `directory` supplies the
 * projects directory when omitted. Unknown keys, wrong types and relative paths throw with the offending key.
 */
export function parseLayerSettings(raw: unknown, home: string, directory: string): LayerSettings {
  const root = table("config", raw);
  known("config", root, ["layers", "projectsDirectory", "review"]);
  if (!Array.isArray(root.layers) || root.layers.length === 0) throw new Error("layers must be a non-empty list.");
  const layers = root.layers.map((item, index) => layer(`layers[${index}]`, item, home));
  const names = new Set<string>();
  for (const { name } of layers) {
    if (names.has(name)) throw new Error(`Duplicate layer name ${name}.`);
    names.add(name);
  }
  const review = root.review === undefined ? {} : table("review", root.review);
  known("review", review, ["enabled", "userTurns", "toolCalls"]);
  return Object.freeze({
    layers: Object.freeze(layers),
    projectsDirectory: absolutePath("projectsDirectory", root.projectsDirectory ?? join(directory, "projects"), home),
    review: Object.freeze({
      enabled: flag("review.enabled", review.enabled, true),
      userTurns: review.userTurns === undefined ? 10 : integer("review.userTurns", review.userTurns, 1, 1000),
      toolCalls: review.toolCalls === undefined ? 15 : integer("review.toolCalls", review.toolCalls, 1, 1000),
    }),
  });
}

function layer(at: string, raw: unknown, home: string): LayerSpec {
  const item = table(at, raw);
  known(at, item, ["name", "path", "description", "capacityCharacters", "soft", "explicitOnly", "review"]);
  const name = text(`${at}.name`, item.name, 32);
  if (!LAYER_NAME.test(name)) throw new Error(`${at}.name must match ${LAYER_NAME.source}.`);
  const path = absolutePath(`${at}.path`, item.path, home);
  for (const [, variable] of path.matchAll(PATH_VARIABLE)) {
    if (variable !== "instance" && variable !== "project") throw new Error(`${at}.path uses unknown {${variable}}; only {instance} and {project}.`);
  }
  return Object.freeze({
    name, path,
    description: text(`${at}.description`, item.description, 500),
    capacityCharacters: integer(`${at}.capacityCharacters`, item.capacityCharacters, 1, 32_000),
    soft: flag(`${at}.soft`, item.soft, false),
    explicitOnly: flag(`${at}.explicitOnly`, item.explicitOnly, false),
    review: flag(`${at}.review`, item.review, false),
  });
}

function table(name: string, raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`${name} must be a table.`);
  return raw as Record<string, unknown>;
}

function known(name: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown key ${name}.${key}.`);
}

function text(name: string, value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim() === "" || Array.from(value.trim()).length > max) {
    throw new Error(`${name} must be a nonblank string of at most ${max} characters.`);
  }
  return value.trim();
}

function integer(name: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

function flag(name: string, value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${name} must be true or false.`);
  return value;
}

function absolutePath(name: string, value: unknown, home: string): string {
  const raw = text(name, value, 1024);
  const path = raw === "~" ? home : raw.startsWith("~/") ? join(home, raw.slice(2)) : raw;
  if (!isAbsolute(path)) throw new Error(`${name} must be absolute or start with ~/.`);
  return path;
}
