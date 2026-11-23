import { DEFAULT_LIMITS_OPTIONS } from "../../../config/limits/limits-options.ts";
import { WireError } from "../../wire/create-error.ts";

export function writeOutput(value: unknown, maxBytes = DEFAULT_LIMITS_OPTIONS.outputBytes): void {
  if (process.stdout.writableLength > maxBytes) throw new WireError("CLI_ERROR","CLI output consumer is too slow; disconnecting without cancellation.");
  process.stdout.write(JSON.stringify(value) + "\n");
}
