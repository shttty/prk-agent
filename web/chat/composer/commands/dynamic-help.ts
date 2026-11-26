import type { CommandHelp, NativeCommand } from "../composer-types.ts";
import { SUMMARY_LIMIT } from "./command-text.ts";
export function dynamicHelp(command: NativeCommand, description: string): CommandHelp | null {
  const args = command.arguments ?? [];
  if (description.length <= SUMMARY_LIMIT && !args.length) return null;
  return {
    usage: [`/${command.name}${args.map((argument) => (argument.required ? ` <${argument.name}>` : ` [${argument.name}]`)).join("")}`],
    body: description ? [description] : [],
    notes: args.map((argument) => `${argument.name}${argument.required ? "（必填）" : ""}${argument.description ? `：${argument.description}` : ""}`),
  };
}
