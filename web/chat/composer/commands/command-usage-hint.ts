import type { NativeCommand } from "../composer-types.ts";

export function commandUsageHint(candidate: NativeCommand) {
  const args = candidate.arguments ?? [];
  return args.map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`)).join(" ");
}
