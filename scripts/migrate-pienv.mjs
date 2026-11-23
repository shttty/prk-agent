#!/usr/bin/env node
import { parseArgs } from "node:util";
import { planMigration } from "./pienv-migration/plan-migration.mjs";
import { applyMigration } from "./pienv-migration/apply-migration.mjs";

const { values } = parseArgs({ options: { home: { type: "string" }, "kernelspec-directory": { type: "string" }, "gateway-stopped": { type: "boolean" } } });
try {
  if (!values["gateway-stopped"]) throw new Error("Stop this home's Gateway first, then pass --gateway-stopped with --home /absolute/home. No default home is used.");
  console.log(JSON.stringify(applyMigration(planMigration(values.home, values["kernelspec-directory"])), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
