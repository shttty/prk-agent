import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { object } from "../is-record.ts";
import { keys } from "../fields/has-only-fields.ts";
import { fieldText } from "../fields/is-field-text.ts";
import { routingIdentifier } from "../fields/is-routing-identifier.ts";
import { skillScopePattern } from "../scope-constants.ts";
import { invalid } from "./reject-invalid-request.ts";

export function validateLibraryParams(value: { method: string }, p: Record<string, unknown>, limits: LimitsOptions): boolean {
  if (value.method === "toolsList") {
    if (!keys(p, ["target"]) || (p.target !== undefined && !routingIdentifier(p.target, limits))) return invalid();
  } else if (["toolsPromote", "toolsDemote", "toolsArchive", "toolsRestore", "toolsDelete"].includes(value.method)) {
    if (!keys(p, ["name"]) || !fieldText(p.name, limits.identityChars) || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(p.name)) return invalid();
  } else if (value.method === "skillsList") {
    if (!keys(p, [])) return invalid();
  } else if (["skillsPromote", "skillsDemote", "skillsArchive", "skillsRestore", "skillsDelete"].includes(value.method)) {
    if (!keys(p, ["name"]) || typeof p.name !== "string" || p.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(p.name)) return invalid();
  } else if (value.method === "skillsScope") {
    if (!keys(p, ["name", "scope"]) || typeof p.name !== "string" || p.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(p.name)
      || typeof p.scope !== "string" || !skillScopePattern.test(p.scope)) return invalid();
  } else if (value.method === "themesList") {
    if (!keys(p, [])) return invalid();
  } else if (value.method === "themesPreview" || value.method === "themesImport") {
    if (!keys(p, ["theme"]) || !("theme" in p)) return invalid();
  } else if (value.method === "themesDelete") {
    if (!keys(p, ["id", "confirm"]) || typeof p.id !== "string" || p.confirm !== true) return invalid();
  } else if (value.method === "memoryList") {
    if (!keys(p, [])) return invalid();
  } else if (value.method === "memoryChange") {
    if (!keys(p, ["instance", "project", "target", "action", "content", "old_text", "operations"])
      || (p.instance !== undefined && !routingIdentifier(p.instance, limits)) || (p.project !== undefined && !routingIdentifier(p.project, limits))) return invalid();
    // MemoryStore validates the operation once, shared with model tools and human edits.
  } else if (value.method === "memoryDeleteInstance") {
    if (!keys(p, ["instance", "confirm"]) || !routingIdentifier(p.instance, limits) || p.confirm !== true) return invalid();
  } else if (value.method === "memoryConfigGet" || value.method === "memoryConfigSave") {
    // Envelope shape only; MemoryStore parses the TOML document once, shared with every reader of the file.
    const fields = value.method === "memoryConfigGet" ? ["file"] : ["file", "document", "hash"];
    if (!keys(p, fields) || (p.file !== "shared" && p.file !== "override")
      || (value.method === "memoryConfigSave" && (!object(p.document) || typeof p.hash !== "string"))) return invalid();
  } else if (value.method.startsWith("pluginConfig")) {
    // Envelope shape only; PluginConfigStore validates paths, keys and semantics once, shared with the model tool.
    const fields = { pluginConfigGet: ["provider"], pluginConfigSet: ["provider", "file", "sections"], pluginConfigWrite: ["provider", "changes"] }[value.method]!;
    if (!keys(p, fields) || !fieldText(p.provider, 200)
      || (value.method === "pluginConfigSet" && (!fieldText(p.file, limits.cwdChars) || (p.sections !== undefined && !Array.isArray(p.sections))))
      || (value.method === "pluginConfigWrite" && (!Array.isArray(p.changes) || p.changes.length === 0 || p.changes.some((change: unknown) => !object(change) || !keys(change, ["key", "value"]) || !fieldText(change.key, 256) || !("value" in change))))) return invalid();
  } else return false;
  return true;
}
