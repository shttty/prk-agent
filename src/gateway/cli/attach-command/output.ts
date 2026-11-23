import type { AttachCommandContext } from "../command-state.ts";
import { writeOutput } from "./write-json-output.ts";

export function output(ctx: AttachCommandContext, value: unknown): void {
  writeOutput(value, ctx.config.limits.outputBytes);
}
