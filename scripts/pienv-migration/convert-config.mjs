import { parse, stringify } from "smol-toml";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";

export function convertConfig(config, instances) {
  const next = parse(stringify(config));
  const targets = parse(stringify(instances));
  for (const key of ["idleExitMs", "restartBackoffMs", "restartBackoffMaxMs", "restartAttemptsMax", "startTimeoutMs"]) {
    if (!next.monitor || !Object.hasOwn(next.monitor, key)) continue;
    const value = next.monitor[key];
    if (!Number.isSafeInteger(value) || value < 1 || (key.endsWith("Ms") && value > 2147483647)) throw new Error(`Invalid legacy monitor.${key}`);
    if (key === "startTimeoutMs") {
      next.targetConnection ??= parse("");
      if (Object.hasOwn(next.targetConnection, key) && next.targetConnection[key] !== value) throw new Error("Conflicting old/new targetConnection.startTimeoutMs");
      next.targetConnection[key] = value;
    }
    delete next.monitor[key];
  }
  if (!targets || typeof targets !== "object" || Array.isArray(targets) || Object.keys(targets).some((key) => key !== "instances") || !Array.isArray(targets.instances)) throw new Error("Invalid instances document");
  const obsolete = ["initialInfoWaitMs", "kernelDeathPollIntervalMs", "hostnameCloseTimeoutMs"];
  const moved = ["maxOutputChars", "startTimeoutMs", "interruptTimeoutMs", "closeTimeoutMs", "progressIntervalMs", "maxProgressUpdates", "progressSuffixChars", "executionTimeoutMs"];
  if (Object.hasOwn(next, "jupyter")) {
    const options = next.jupyter;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Invalid legacy jupyter configuration");
    for (const [key, value] of Object.entries(options)) {
      if (![...obsolete, ...moved, "requestTimeoutMs", "maxReferenceBytes"].includes(key) || !Number.isSafeInteger(value) || value < 1 || (key.endsWith("Ms") && value > 2147483647)) throw new Error(`Invalid legacy jupyter.${key}`);
      if (obsolete.includes(key)) continue;
      const group = moved.includes(key) ? "kernel" : key === "requestTimeoutMs" ? "targetConnection" : "references";
      const field = key === "maxReferenceBytes" ? "maxBytes" : key;
      next[group] ??= parse("");
      if (Object.hasOwn(next[group], field) && next[group][field] !== value) throw new Error(`Conflicting old/new ${group}.${field}`);
      next[group][field] = value;
    }
    delete next.jupyter;
  }
  const legacyLimits = { urlChars: 2048, tokenChars: 8192, kernelNameChars: 256 };
  for (const key of Object.keys(legacyLimits)) {
    if (!next.limits || !Object.hasOwn(next.limits, key)) continue;
    const value = next.limits[key];
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid legacy limits.${key}`);
    legacyLimits[key] = value;
    if (key === "urlChars") {
      if (Object.hasOwn(next.limits, "sshCommandChars") && next.limits.sshCommandChars !== value) throw new Error("Conflicting old/new command input limit");
      next.limits.sshCommandChars = value;
    }
    delete next.limits[key];
  }
  const legacy = new Map();
  const endpoints = new Set();
  for (const target of targets.instances) {
    if (!target || typeof target !== "object" || Array.isArray(target)) throw new Error("Invalid legacy instance");
    if (!["url", "token", "defaultKernelName"].some((key) => Object.hasOwn(target, key))) continue;
    if (Object.hasOwn(target, "sshCommand") || Object.hasOwn(target, "python")) throw new Error("Mixed legacy/new instance schema");
    if (typeof target.url !== "string" || !target.url || target.url.length > legacyLimits.urlChars) throw new Error("Invalid legacy instance URL");
    const url = new URL(target.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid legacy instance URL");
    url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    if (endpoints.has(url.href)) throw new Error("Duplicate legacy instance endpoint");
    endpoints.add(url.href);
    if (typeof target.token !== "string" || !target.token.trim() || target.token.length > legacyLimits.tokenChars || /\p{Cc}/u.test(target.token)) throw new Error("Invalid legacy instance token");
    const name = target.defaultKernelName;
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > legacyLimits.kernelNameChars || /\p{Cc}/u.test(name))) throw new Error("Invalid legacy default kernelspec");
    legacy.set(target.id, { defaultKernelName: name, local: target.local === true });
    delete target.url;
    delete target.token;
    delete target.defaultKernelName;
    target.local = target.local === true;
  }
  const parsed = parsePrkConfig(next, targets);
  return { config: next, instances: targets, parsed, legacy };
}
