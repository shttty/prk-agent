
export function commandUsageHint(candidate) {
  const args = Array.isArray(candidate.arguments) ? candidate.arguments.filter((argument) => argument && typeof argument.name === "string") : [];
  return args.map((argument) => (argument.required ? `<${argument.name}>` : `[${argument.name}]`)).join(" ");
}
