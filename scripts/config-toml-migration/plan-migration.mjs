import { lstatSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { parsePrkDocument } from "../../src/config/document/storage/parse-prk-document.ts";
import { formatTomlDocument } from "../../src/config/document/storage/format-toml-document.ts";
import { renameInstanceIds } from "./rename-instance-ids.mjs";
import { migrateCacheRoot } from "./migrate-cache-root.mjs";

export function planMigration(home) {
  if (!home || !isAbsolute(home)) throw new Error("--home must be an explicit absolute directory; no environment default is used.");
  home = resolve(home);
  if (!statSync(home).isDirectory()) throw new Error("--home must name an existing directory.");
  const changes = [];
  const original = [];
  const converted = [];
  for (const [filename, fallback] of [["config.toml", {}], ["instances.toml", { instances: [] }]]) {
    const destination = join(home, filename);
    const json = destination.replace(/\.toml$/u, ".json");
    const fromJson = occupied(json);
    const source = fromJson ? json : destination;
    let document = fallback;
    if (fromJson) {
      if (occupied(destination)) throw new Error(`Migration preflight failed: occupied path ${destination}; no files were written.`);
      try { document = JSON.parse(readFileSync(source, "utf8")); }
      catch { throw new Error(`Migration preflight failed: ${filename.replace(/\.toml$/u, ".json")} is not readable JSON; no files were written.`); }
      rejectNull(document, filename.replace(/\.toml$/u, ".json"));
    } else if (occupied(destination)) document = parsePrkDocument(readFileSync(destination, "utf8"), filename);
    const migrated = filename === "config.toml" ? migrateCacheRoot(document) : renameInstanceIds(document);
    original.push(migrated);
    if (!fromJson && migrated === document) {
      converted.push(document);
      continue;
    }
    const backup = `${source}.${fromJson ? "before-toml" : filename === "instances.toml" ? "before-instance-id" : "before-target-cache-root"}`;
    if (occupied(backup)) throw new Error(`Migration preflight failed: occupied path ${backup}; no files were written.`);
    let text;
    let roundtrip;
    try {
      text = formatTomlDocument(filename, migrated);
      roundtrip = parsePrkDocument(text, filename);
    } catch {
      throw new Error(`Migration preflight failed: ${filename} cannot roundtrip through TOML; no files were written.`);
    }
    if (!isDeepStrictEqual(migrated, roundtrip)) {
      throw new Error(`Migration preflight failed: ${filename} TOML roundtrip changes values; no files were written.`);
    }
    converted.push(roundtrip);
    changes.push({ source, destination, backup, text, mode: filename === "instances.toml" ? 0o600 : 0o666 });
  }
  let before;
  let after;
  try {
    before = parsePrkConfig(...original);
    after = parsePrkConfig(...converted);
  } catch {
    throw new Error("Migration preflight failed: config and instances do not pass PRK configuration validation; no files were written.");
  }
  if (!isDeepStrictEqual(before, after)) throw new Error("Migration preflight failed: TOML changes PRK configuration semantics; no files were written.");
  return { home, changes };
}

function occupied(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function rejectNull(value, path) {
  if (value === null) throw new Error(`Migration preflight failed: ${path} is null; TOML has no null value; no files were written.`);
  if (Array.isArray(value)) value.forEach((item, index) => rejectNull(item, `${path}[${index}]`));
  else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      rejectNull(item, /^[A-Za-z_]\w*$/u.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`);
    }
  }
}
