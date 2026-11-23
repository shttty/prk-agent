export function actionArguments(command: string, text: string | undefined): Record<string, unknown> {
  if (command === "settings") {
    const result: Record<string, unknown> = {};
    for (const token of (text ?? "").split(/\s+/u).filter(Boolean)) {
      const separator = token.indexOf("=");
      if (separator <= 0) continue;
      const key = token.slice(0, separator);
      const value = token.slice(separator + 1);
      if (["autoCompaction", "autoRetry", "showImages"].includes(key) && (value === "on" || value === "off")) result[key] = value;
    }
    return result;
  }
  if (command === "model") return text ? { model: text } : {};
  if (command === "thinking") return text ? { level: text } : {};
  if (command === "name") return text ? { name: text } : {};
  if (command === "compact") return text ? { instructions: text } : {};
  if (command === "tree") return text ? { entryId: text.split(/\s/u)[0] } : {};
  if (command === "scoped-models") return text ? { models: text.split(/\s+/u) } : {};
  if (command === "export") return text ? { format: text.split(/\s/u)[0] } : {};
  return {};
}
