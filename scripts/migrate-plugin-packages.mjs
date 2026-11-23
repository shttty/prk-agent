#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { planMigration } from "./plugin-migration/plan-migration.mjs";
import { applyMigration } from "./plugin-migration/apply-migration.mjs";

const usage = "Usage: node scripts/migrate-plugin-packages.mjs --home /absolute/owned-prk-copy --source-home /absolute/original-prk-home [--sources /absolute/source-map.json]\nStop the copy's Gateway first. Original home is only used to resolve relative sources. Legacy bundles require an explicit bundle-id to native-source map.";
try {
  const { values } = parseArgs({ options: { home: { type: "string" }, "source-home": { type: "string" }, sources: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help) console.log(usage);
  else {
    if (!values.home || !values["source-home"]) throw new Error(usage);
    const sources = values.sources ? JSON.parse(readFileSync(values.sources, "utf8")) : {};
    if (!sources || typeof sources !== "object" || Array.isArray(sources) || Object.values(sources).some((value) => typeof value !== "string")) throw new Error("--sources must contain an object mapping bundle IDs to explicit native sources.");
    console.log(JSON.stringify(applyMigration(planMigration(values.home, values["source-home"], sources)), null, 2));
  }
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
