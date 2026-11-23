#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ArtifactStore } from "../src/artifacts/store/assemble-store.ts";
import { readManifest } from "../src/artifacts/store/read-artifact-manifest.ts";
import { resolvePrkHome } from "../src/config/home/resolve-prk-home.ts";

const usage = "Usage: node scripts/import-tool-artifacts.mjs --home DIR [--version imported]";
const identifier = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/u;

async function main() {
  const { values } = parseArgs({ options: {
    home: { type: "string" }, version: { type: "string", default: "imported" }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) { console.log(usage); return; }
  if (!values.home) throw new Error(usage);
  if (!identifier.test(values.version)) throw new Error("Invalid version: use 1–128 letters, digits, '.', '_', '+', or '-', starting with a letter or digit.");
  const directory = join(resolvePrkHome(values.home), "assets");
  const legacy = join(directory, "bin");
  if (!(await lstat(legacy)).isDirectory()) throw new Error(`Unsupported legacy entry: ${legacy} must be a directory, not a symlink or file.`);
  const entries = [];
  // Inspect the whole legacy tree before publishing anything; unknown entries must not be silently lost.
  for (const tool of (await readdir(legacy, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const toolPath = join(legacy, tool.name);
    if (!tool.isDirectory() || !identifier.test(tool.name)) throw new Error(`Unsupported legacy tool entry: ${toolPath}`);
    const platforms = await readdir(toolPath, { withFileTypes: true });
    if (!platforms.length) throw new Error(`No platform entries in ${toolPath}`);
    for (const platform of platforms.sort((a, b) => a.name.localeCompare(b.name))) {
      const platformPath = join(toolPath, platform.name);
      if (!platform.isDirectory() || !["linux-x86_64", "linux-aarch64"].includes(platform.name)) throw new Error(`Unsupported legacy platform entry: ${platformPath}`);
      const files = await readdir(platformPath, { withFileTypes: true });
      if (files.length !== 1 || files[0].name !== tool.name || !files[0].isFile()) throw new Error(`Expected exactly one regular file at ${join(platformPath, tool.name)}; no other entries are supported.`);
      entries.push({ name: tool.name, platform: platform.name.slice("linux-".length), path: join(platformPath, tool.name) });
    }
  }
  if (!entries.length) throw new Error(`No legacy artifacts found in ${legacy}`);
  const manifest = readManifest(directory);
  for (const entry of entries) {
    const tool = Object.hasOwn(manifest.tools, entry.name) ? manifest.tools[entry.name] : undefined;
    const version = tool && Object.hasOwn(tool.versions, values.version) ? tool.versions[values.version] : undefined;
    if (version?.platforms[entry.platform]) throw new Error(`Artifact ${entry.name}@${values.version} for ${entry.platform} already exists; nothing was imported. Choose another --version if needed.`);
  }
  const store = new ArtifactStore(directory);
  for (const entry of entries) {
    const updated = await store.upload(entry.name, values.version, entry.platform, createReadStream(entry.path));
    const artifact = updated.tools[entry.name].versions[values.version].platforms[entry.platform];
    console.log(`Imported ${entry.name}@${values.version} ${entry.platform}: ${artifact.sha256} (${artifact.size} bytes)`);
  }
  console.log(`Legacy files remain untouched at ${legacy}. Existing tools keep their current version; the first imported version becomes current for new tools.`);
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
