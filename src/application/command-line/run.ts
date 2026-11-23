import { parseArgs } from "node:util";
import { assertPrkBrand } from "../sdk-brand/assert-brand.ts";
import { assertGooglePatches } from "../sdk-brand/assert-google-patches.ts";
import { assertProviderPolicy } from "../sdk-brand/assert-provider-policy.ts";
import { initializePrkHome } from "../../config/home/initialize-prk-home.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { describeCommandError } from "./describe-command-error.ts";

export async function run(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    // SDK bootstrap boundary: static command imports would run before the selected home override.
    const { values } = parseArgs({ args, strict: false, allowPositionals: true, options: { home: { type: "string" } } });
    if (values.home !== undefined && typeof values.home !== "string") throw new WireError("CLI_ERROR", "--home requires a directory path.");
    initializePrkHome(values.home);
    await assertPrkBrand();
    await assertGooglePatches();
    await assertProviderPolicy();
    const { runCli } = await import("../../gateway/cli/run-cli.ts");
    await runCli(args);
  }
  catch (error) {
    // Only our known-safe diagnostics are printed, never arbitrary provider errors.
    const detail = describeCommandError(error);
    console.error(`[${new Date().toISOString()}] ${detail} No local fallback was started.`);
    process.exitCode = 1;
  }
}
