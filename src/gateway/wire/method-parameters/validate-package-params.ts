import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { keys } from "../fields/has-only-fields.ts";
import { fieldText } from "../fields/is-field-text.ts";
import { invalid } from "./reject-invalid-request.ts";

export function validatePackageParams(value: { method: string }, p: Record<string, unknown>, limits: LimitsOptions): boolean {
  if (value.method === "pluginsList") {
    if (!keys(p, [])) return invalid();
  } else if (value.method === "pluginsInstall" || value.method === "pluginsChange" || value.method === "pluginsUninstall") {
    const allowed = value.method === "pluginsInstall" ? ["source", "location"] : value.method === "pluginsChange" ? ["source", "enabled", "location"] : ["source", "confirm"];
    if (!keys(p, allowed) || !fieldText(p.source, limits.cwdChars)
      || (p.location !== undefined && p.location !== "host" && p.location !== "gateway")
      || (p.enabled !== undefined && typeof p.enabled !== "boolean")
      || (value.method === "pluginsChange" && p.enabled === undefined && p.location === undefined)
      || (value.method === "pluginsUninstall" && p.confirm !== true)) return invalid();
  } else if (value.method === "artifactsList") {
    if (!keys(p, [])) return invalid();
  } else if (value.method === "artifactsUpload" || value.method === "artifactsCurrent" || value.method === "artifactsDelete") {
    if (!keys(p, value.method === "artifactsUpload" ? ["name", "version", "platform", "source", "sha256"] : ["name", "version"])
      || typeof p.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/u.test(p.name)
      || typeof p.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/u.test(p.version)) return invalid();
    if (value.method === "artifactsUpload" && ((p.platform !== "x86_64" && p.platform !== "aarch64") || !fieldText(p.source, limits.cwdChars)
      || (p.sha256 !== undefined && (typeof p.sha256 !== "string" || !/^[A-Fa-f0-9]{64}$/u.test(p.sha256))))) return invalid();
  } else return false;
  return true;
}
