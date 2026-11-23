#!/usr/bin/env node
// Stages the agent's configured Pi packages so a machine without registry access can load them.
// npm sources become one npm prefix (<out>/npm) laid out like <PRK home>/agent/npm, so the same
// `npm:` sources resolve there without a download; absolute local directories are exported from
// their git HEAD, with runtime dependencies, into <out>/local/<directory name>.
// --skip leaves out a configured package by source, npm name or directory name (for example one that only works on this machine).
// Usage: node scripts/package-plugins.mjs --agent-dir /absolute/agent --out /absolute/stage/plugins [--skip NAME]...
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { "agent-dir": { type: "string" }, out: { type: "string" }, skip: { type: "string", multiple: true, default: [] } } });
try {
  const agentDir = values["agent-dir"];
  const out = values.out;
  if (!agentDir || !out || !isAbsolute(agentDir) || !isAbsolute(out)) throw new Error("Usage: node scripts/package-plugins.mjs --agent-dir /absolute/agent --out /absolute/stage/plugins");
  const configured = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8")).packages ?? [];
  const unknownSkips = values.skip.filter((name) => !configured.some((pkg) => names(pkg.source).includes(name)));
  if (unknownSkips.length > 0) throw new Error(`--skip matches no configured package: ${unknownSkips.join(", ")}`);
  const packages = configured.filter((pkg) => !values.skip.some((name) => names(pkg.source).includes(name)));
  const npmPackages = packages.filter((pkg) => pkg.source.startsWith("npm:"));
  const localPackages = packages.filter((pkg) => isAbsolute(pkg.source));
  const unsupported = packages.filter((pkg) => !npmPackages.includes(pkg) && !localPackages.includes(pkg));
  if (unsupported.length > 0) throw new Error(`cannot bundle sources other than npm: and absolute directories: ${unsupported.map((pkg) => pkg.source).join(", ")}`);

  mkdirSync(out, { recursive: true });
  if (npmPackages.length > 0) stageNpm(npmPackages, join(agentDir, "npm"), join(out, "npm"));
  const bundled = packages.map((pkg) => localPackages.includes(pkg)
    ? { directory: stageLocal(pkg.source, join(out, "local")), enabled: pkg.enabled, location: pkg.location }
    : { source: pkg.source, enabled: pkg.enabled, location: pkg.location });
  writeFileSync(join(out, "packages.json"), `${JSON.stringify(bundled, null, 2)}\n`);
  for (const pkg of bundled) console.log(`bundled ${pkg.source ?? `local/${pkg.directory}`}`);
  for (const pkg of configured.filter((item) => !packages.includes(item))) console.log(`skipped ${pkg.source}`);
} catch (error) {
  console.error(`package-plugins: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

// Installs the versions this agent currently runs, with Pi's own peer handling: hosts provide the pi-* peers.
function stageNpm(packages, installedRoot, prefix) {
  const specs = packages.map((pkg) => {
    const name = names(pkg.source)[1];
    const manifest = join(installedRoot, "node_modules", name, "package.json");
    if (!existsSync(manifest)) throw new Error(`${pkg.source} is configured but not installed under ${installedRoot}`);
    return `${name}@${JSON.parse(readFileSync(manifest, "utf8")).version}`;
  });
  mkdirSync(prefix, { recursive: true });
  writeFileSync(join(prefix, "package.json"), `${JSON.stringify({ name: "prk-agent-extensions", private: true }, null, 2)}\n`);
  npm(["install", ...specs, "--prefix", prefix, "--legacy-peer-deps", "--no-audit", "--no-fund"]);
}

// Exports committed files only, so the bundle matches a commit rather than whatever the working tree holds.
function stageLocal(source, parent) {
  if (execFileSync("git", ["-C", source, "status", "--porcelain"], { encoding: "utf8" }).trim() !== "") throw new Error(`${source} has uncommitted changes; commit first`);
  const directory = basename(source);
  const target = join(parent, directory);
  if (existsSync(target)) throw new Error(`two local plugins share the directory name ${directory}`);
  mkdirSync(target, { recursive: true });
  execFileSync("sh", ["-c", 'git -C "$1" archive HEAD | tar -x -C "$2"', "_", source, target], { stdio: "inherit" });
  const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
  if (Object.keys(manifest.dependencies ?? {}).length > 0) npm(["install", "--prefix", target, "--omit=dev", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"]);
  return directory;
}

function names(source) {
  return [source, source.startsWith("npm:") ? source.slice("npm:".length).replace(/(?<=.)@[^/]*$/, "") : basename(source)];
}

function npm(args) {
  execFileSync("npm", args, { stdio: ["ignore", "inherit", "inherit"] });
}
