import { parseCapabilitySwitches } from "../../capabilities/parse-switches.ts";
import { MIN_GENERATED_ID_CHARS } from "./document-constants.ts";
import { DELEGATION_LEVELS } from "../../session/delegation-levels.ts";
import { FILE_CHUNK_BYTES_MAX } from "../../workspace/workspace-options.ts";

export function groupOptions<T extends object>(name: string, value: unknown, defaults: T): T {
  if (value === undefined) return { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid PRK configuration: ${name} must be an object.`);
  const merged = { ...defaults };
  for (const [key, option] of Object.entries(value)) {
    if (!Object.hasOwn(defaults, key)) throw new Error(`Invalid PRK configuration: unsupported ${name}.${key}.`);
    const field = `${name}.${key}`;
    const original = defaults[key as keyof T];
    if (field === "session.capabilities") {
      Object.assign(merged, { capabilities: parseCapabilitySwitches(option) });
      continue;
    }
    if (field === "remoteHost.nodeArgs" || field === "remoteHost.bunArgs") {
      if (!Array.isArray(option) || option.some((arg) => typeof arg !== "string" || arg.includes("\0"))) {
        throw new Error(`Invalid PRK configuration: ${field} must be an array of strings without NUL.`);
      }
    } else if (typeof original === "number") {
      const port = key === "port";
      const zero = key === "port" || field === "http.streamTimeoutMs" || field === "session.askTimeoutMs" || field === "remoteHost.memorySwapMax";
      const max = port ? 65_535 : field === "workspace.fileChunkBytes" ? FILE_CHUNK_BYTES_MAX : field === "limits.socketPathBytes" ? 100 : field === "monitor.memoryAlertPercent" ? 100 : key.endsWith("Ms") ? 2_147_483_647 : Number.MAX_SAFE_INTEGER;
      const min = field === "namespace.maxChars" ? JSON.stringify({ variables: [], added: [], modified: [], deleted: [], truncated: false }).length
        : name === "limits" ? MIN_GENERATED_ID_CHARS[key as keyof typeof MIN_GENERATED_ID_CHARS] ?? 1 : zero ? 0 : 1;
      if (typeof option !== "number" || !Number.isSafeInteger(option) || option < min || option > max) {
        throw new Error(`Invalid PRK configuration: ${field} must be a safe integer from ${min} to ${max}.`);
      }
    } else if (typeof original === "boolean") {
      if (typeof option !== "boolean") throw new Error(`Invalid PRK configuration: ${field} must be a boolean.`);
    } else {
      const choices: readonly string[] | undefined = key === "defaultThinkingLevel" ? ["off", "minimal", "low", "medium", "high", "xhigh", "max"]
        : key === "defaultSendMode" ? ["auto", "plain"]
        : key === "defaultDerivedLifecycle" ? ["temporary", "persistent"]
        : key === "workerTools" ? ["code", "direct"]
        : field === "session.delegation" ? DELEGATION_LEVELS
        : field === "remoteHost.runtime" ? ["bun", "node"]
        : key === "defaultExportFormat" ? ["jsonl", "html"] : undefined;
      if (typeof option !== "string" || (choices && !choices.includes(option))) {
        throw new Error(`Invalid PRK configuration: ${field} must be ${choices ? choices.join(" or ") : "a string"}.`);
      }
    }
    Object.assign(merged, { [key]: option });
  }
  return merged;
}
