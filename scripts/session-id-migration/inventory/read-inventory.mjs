import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parse } from "smol-toml";
import { selectSessionPaths } from "./select-session-paths.mjs";
import { DEFAULT_SESSION_OPTIONS } from "../../../src/config/session/session-options.ts";

export function readInventory(home, qqState) {
  if (!isAbsolute(home) || !isAbsolute(qqState)) throw new Error("--home and --qq-state must be explicit absolute directories");
  home = resolve(home);
  qqState = resolve(qqState);
  for (const path of [home, qqState]) {
    if (!statSync(path).isDirectory()) throw new Error(`Expected a directory: ${path}`);
  }
  const paths = [];
  const read = (path, optional = false) => {
    try {
      const text = readFileSync(path, "utf8");
      paths.push(path);
      return { path, text };
    } catch (error) { if (optional && error.code === "ENOENT") return undefined; throw error; }
  };
  const configFile = read(join(home, "config.toml"), true);
  let historyDir = DEFAULT_SESSION_OPTIONS.historyDir;
  if (configFile !== undefined) {
    const config = parse(configFile.text);
    if (config === null || typeof config !== "object" || Array.isArray(config)) throw new Error(`${configFile.path}: expected configuration object`);
    if (config.session?.historyDir !== undefined) historyDir = config.session.historyDir;
  }
  if (typeof historyDir !== "string" || !historyDir.trim()) throw new Error(`${join(home, "config.toml")}: session.historyDir must be a nonempty path`);
  const directory = resolve(home, historyDir);
  const names = readdirSync(directory);
  paths.push(...names.map((name) => join(directory, name)));
  paths.push(...readdirSync(qqState).map((name) => join(qqState, name)));
  const sessions = selectSessionPaths(directory, names).map((path) => read(path));
  const sidecars = {
    terminals: read(join(directory, "terminal-bindings.json"), true),
    control: read(join(home, "session-control.json"), true),
    currentWorker: read(join(qqState, "current-worker.json"), true),
    currentSession: read(join(qqState, "current-session.json"), true),
  };
  return { home, qqState, sessions, sidecars, paths };
}
