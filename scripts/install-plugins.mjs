#!/usr/bin/env node
// Installs the plugins bundled by scripts/package-plugins.mjs into a PRK home's agent directory.
// The bundled npm prefix replaces <agent>/npm and each bundled local plugin replaces
// <agent>/plugins/<name>; both hold only downloadable package contents, not user data.
// settings.json gains an entry for each bundled package it does not list yet; existing entries are kept as written.
// Usage: node scripts/install-plugins.mjs --bundle /absolute/plugins --agent-dir /absolute/agent
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { bundle: { type: "string" }, "agent-dir": { type: "string" } } });
try {
  const bundle = values.bundle;
  const agentDir = values["agent-dir"];
  if (!bundle || !agentDir || !isAbsolute(bundle) || !isAbsolute(agentDir)) throw new Error("Usage: node scripts/install-plugins.mjs --bundle /absolute/plugins --agent-dir /absolute/agent");
  const bundled = JSON.parse(readFileSync(join(bundle, "packages.json"), "utf8"));

  if (existsSync(join(bundle, "npm"))) replaceDirectory(join(bundle, "npm"), join(agentDir, "npm"));
  const packages = bundled.map((pkg) => {
    if (pkg.source) return pkg;
    const target = join(agentDir, "plugins", pkg.directory);
    replaceDirectory(join(bundle, "local", pkg.directory), target);
    return { source: target, enabled: pkg.enabled, location: pkg.location };
  });
  for (const pkg of packages) console.log(`plugin files: ${pkg.source.startsWith("npm:") ? `${pkg.source} in ${join(agentDir, "npm")}` : pkg.source}`);

  const settingsPath = join(agentDir, "settings.json");
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
  const listed = new Set((settings.packages ?? []).map((pkg) => (typeof pkg === "string" ? pkg : pkg.source)));
  const added = packages.filter((pkg) => !listed.has(pkg.source));
  if (added.length > 0) {
    settings.packages = [...(settings.packages ?? []), ...added];
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  }
  for (const pkg of added) console.log(`settings.json: added ${pkg.source} (${pkg.enabled ? "enabled" : "disabled"}, ${pkg.location})`);
} catch (error) {
  console.error(`install-plugins: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

// Copies next to the target first, so a failed copy leaves the previous plugin files in place.
function replaceDirectory(from, to) {
  const staging = `${to}.installing`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(join(to, ".."), { recursive: true });
  cpSync(from, staging, { recursive: true, verbatimSymlinks: true });
  rmSync(to, { recursive: true, force: true });
  renameSync(staging, to);
}
