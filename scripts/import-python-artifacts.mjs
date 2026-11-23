#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ArtifactStore } from "../src/artifacts/store/assemble-store.ts";
import { readManifest } from "../src/artifacts/store/read-artifact-manifest.ts";
import { MANAGED_PYTHON } from "../src/artifacts/python/python-release.ts";
import { resolvePrkHome } from "../src/config/home/resolve-prk-home.ts";
import { measureGlibc } from "./python-artifacts/measure-glibc.mjs";

const usage = "Usage: node scripts/import-python-artifacts.mjs --home DIR --source DIR (containing the unpacked musl uv binary and pinned PBS archive)";

async function main() {
  const { values } = parseArgs({ options: { home: { type: "string" }, source: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help) { console.log(usage); return; }
  if (!values.home || !values.source) throw new Error(usage);
  const directory = join(resolvePrkHome(values.home), "assets");
  const store = new ArtifactStore(directory);
  const { uv, python, platform } = MANAGED_PYTHON;
  for (const { name, version, filename, sha256 } of [uv, python]) {
    const existing = readManifest(directory).tools[name]?.versions[version]?.platforms[platform];
    if (existing && (existing.sha256 !== sha256 || (name === python.name && !existing.minGlibc))) {
      throw new Error(`Conflicting digest or missing metadata for ${name}@${version}; remove that version before importing.`);
    }
    let minGlibc = existing?.minGlibc;
    if (!existing) {
      const file = join(values.source, filename);
      if (name === python.name) {
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        if (hash.digest("hex") !== sha256) throw new Error(`Pinned digest mismatch: ${filename}`);
        minGlibc = await measureGlibc(file);
      }
      await store.upload(name, version, platform, createReadStream(file), sha256, undefined, minGlibc);
    }
    console.log(`${name}@${version} ${platform}: ${sha256}${minGlibc ? ` (glibc ≥ ${minGlibc})` : ""}`);
  }
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
