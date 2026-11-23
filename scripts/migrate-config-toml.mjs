#!/usr/bin/env node
import { parseArgs } from "node:util";
import { planMigration } from "./config-toml-migration/plan-migration.mjs";
import { applyMigration } from "./config-toml-migration/apply-migration.mjs";

const usage = "Usage: node scripts/migrate-config-toml.mjs --home /absolute/isolated-prk-home\nStop Gateway first; run on a backed-up copy. Migrates JSON to TOML and updates old codemode.binCacheDir and instance name fields. No paths default from the environment.";

function main() {
  const { values } = parseArgs({ options: { home: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help) { console.log(usage); return; }
  if (!values.home) throw new Error(usage);
  const plan = planMigration(values.home);
  console.log(JSON.stringify(applyMigration(plan), null, 2));
}

try { main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
