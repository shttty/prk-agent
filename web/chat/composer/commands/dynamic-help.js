import { SUMMARY_LIMIT } from "./command-text.js";
export function dynamicHelp(command, description) {
  const args = Array.isArray(command.arguments) ? command.arguments.filter((argument) => argument && typeof argument.name === "string") : [];
  if (description.length <= SUMMARY_LIMIT && !args.length) return null;
  return {
    usage: [`/${command.name}${args.map((argument) => (argument.required ? ` <${argument.name}>` : ` [${argument.name}]`)).join("")}`],
    body: description ? [description] : [],
    notes: args.map((argument) => `${argument.name}${argument.required ? "（必填）" : ""}${argument.description ? `：${argument.description}` : ""}`),
  };
}
