import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse, stringify } from "smol-toml";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { renameInstanceIds } from "../config-toml-migration/rename-instance-ids.mjs";
import { convertConfig } from "./convert-config.mjs";
import { convertHistory } from "./convert-history.mjs";
import { resolvePythonSelections } from "./resolve-python-selections.mjs";

export function planMigration(home, kernelspecDirectory) {
  if (!home || !isAbsolute(home) || !statSync(home).isDirectory()) throw new Error("--home must be an explicit absolute existing directory");
  home = resolve(home);
  if (kernelspecDirectory && !isAbsolute(kernelspecDirectory)) throw new Error("--kernelspec-directory must be absolute");
  for (const file of ["config.json", "instances.json"]) if (existsSync(join(home, file))) throw new Error("PIENV cutover requires split TOML; legacy Jupyter JSON is not supported by the current JSON-to-TOML tool");
  const originals = new Map();
  const configText = existsSync(join(home, "config.toml")) ? readFileSync(join(home, "config.toml"), "utf8") : "";
  const instanceText = readFileSync(join(home, "instances.toml"), "utf8");
  const originalConfig = parse(configText);
  const originalInstances = parse(instanceText);
  const renamedInstances = renameInstanceIds(originalInstances);
  const converted = convertConfig(originalConfig, renamedInstances);
  const directory = resolve(home, converted.parsed.session.historyDir);
  if (relative(home, directory).startsWith("..") || directory === home) throw new Error("Migration history directory must be inside the supplied home");
  const changes = [];
  const preservation = [];
  const selections = [];
  for (const file of existsSync(directory) ? readdirSync(directory, { recursive: true }).filter((name) => name.endsWith(".jsonl")) : []) {
    const path = join(directory, file);
    const text = readFileSync(path, "utf8");
    const result = convertHistory(path, text, converted.parsed.limits);
    originals.set(path, text);
    preservation.push(result.preservation);
    selections.push(...result.selections);
    if (result.changed) changes.push({ path, text: result.text, mode: 0o666 });
  }
  resolvePythonSelections(converted, selections, kernelspecDirectory);
  for (const [name, before, after, text] of [["config.toml", originalConfig, converted.config, configText], ["instances.toml", originalInstances, converted.instances, instanceText]]) {
    const path = join(home, name);
    originals.set(path, text);
    if (isDeepStrictEqual(before, after)) continue;
    const output = stringify(after);
    if (!isDeepStrictEqual(parse(output), after)) throw new Error(`TOML roundtrip changes ${name}`);
    changes.push({ path, text: output, mode: name === "instances.toml" ? 0o600 : 0o666 });
  }
  parsePrkConfig(converted.config, converted.instances);
  const terminal = join(directory, "terminal-bindings.json");
  if (existsSync(terminal)) {
    const text = readFileSync(terminal, "utf8");
    const bindings = JSON.parse(text);
    if (!Array.isArray(bindings)) throw new Error("Invalid terminal binding array");
    for (const row of bindings) {
      if (!row || typeof row !== "object" || Object.keys(row).some((key) => !["sessionId", "name", "target", "serverName", "owner", "label"].includes(key))
        || ["sessionId", "name", "target"].some((key) => typeof row[key] !== "string" || !row[key])
        || typeof row.serverName !== "string" || !/^prk_[a-f0-9]{32}$/.test(row.serverName)
        || (row.owner !== undefined && row.owner !== "model") || (row.label !== undefined && typeof row.label !== "string")) throw new Error("Invalid terminal binding row");
    }
    originals.set(terminal, text);
    changes.push({ path: terminal, remove: true });
  }
  const instancesPath = join(home, "instances.toml");
  const onlyRenamedIds = renamedInstances !== originalInstances && changes.length === 1
    && changes[0].path === instancesPath && isDeepStrictEqual(parse(stringify(renamedInstances)), converted.instances);
  return { home, changes, originals: onlyRenamedIds ? new Map([[instancesPath, instanceText]]) : originals,
    backupName: onlyRenamedIds ? "before-instance-id" : "before-pienv", preservation: onlyRenamedIds ? [] : preservation,
    pending: converted.instances.instances.filter((target) => !target.python || (!target.local && !target.sshCommand)).map(({ id }) => id) };
}
