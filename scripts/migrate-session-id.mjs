#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readInventory } from "./session-id-migration/inventory/read-inventory.mjs";
import { planMigration } from "./session-id-migration/plan-migration.mjs";
import { applyMigration } from "./session-id-migration/apply-migration.mjs";

const usage = "Usage: node scripts/migrate-session-id.mjs --home /absolute/isolated-prk-home --qq-state /absolute/isolated-qq-state\nStop Gateway and QQ first; run on a backed-up copy. No paths default from the environment.";

function main() {
  const { values } = parseArgs({ options: {
    home: { type: "string" }, "qq-state": { type: "string" }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) { console.log(usage); return; }
  if (!values.home || !values["qq-state"]) throw new Error(usage);
  const inventory = readInventory(values.home, values["qq-state"]);
  const changes = planMigration(inventory);
  const result = applyMigration(changes);
  console.log(JSON.stringify({ home: inventory.home, qqState: inventory.qqState, ...result }, null, 2));
}

try { main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
