import { parse } from "smol-toml";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_DERIVATION_ROLES, DEFAULT_DERIVED_INSTRUCTIONS, DEFAULT_MAX_DERIVATION_DEPTH } from "../../../src/config/derivation/derivation-types.ts";

export async function checkDerivationApi({ home, document, web, client, saveDerivation }) {
  const get = async () => {
    const response = await fetch(`${web.url}/api/derivation`);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const initial = await get();
  assert.deepEqual(initial.derivation, { roles: DEFAULT_DERIVATION_ROLES });
  assert.deepEqual(initial.defaults, { defaultToolMode: "direct", defaultIsolated: false, roles: DEFAULT_DERIVATION_ROLES,
    maxDepth: DEFAULT_MAX_DERIVATION_DEPTH, defaultInstructions: DEFAULT_DERIVED_INSTRUCTIONS });
  assert.deepEqual(await client.request("derivationGet"), initial, "HTTP reads the actual Gateway-owned config");
  const derivation = { defaultToolMode: "code", defaultIsolated: true, maxDepth: 2,
    defaultInstructions: "GLOBAL_SUBSESSION_INSTRUCTIONS", roles: {
      task: { model: "subsession-check/task", thinkingLevel: "low" },
      small: { description: "Configured lightweight exploration" },
      reviewer: { description: "Read-only controlled role", model: "subsession-check/role", thinkingLevel: "medium", toolMode: "direct",
        isolated: false, instructions: "ROLE_SUBSESSION_INSTRUCTIONS", capabilities: { "tool:write": false, "tool:session_send": false, "group:tools:package:<inline:terminals>": false } },
      silent: { instructions: "" }, isolated: { isolated: true },
    } };
  const saved = await saveDerivation(derivation);
  const merged = { ...derivation, roles: { ...DEFAULT_DERIVATION_ROLES, ...derivation.roles,
    task: { ...DEFAULT_DERIVATION_ROLES.task, ...derivation.roles.task },
    small: { ...DEFAULT_DERIVATION_ROLES.small, ...derivation.roles.small } } };
  assert.deepEqual(saved.derivation, merged, "Builtin role overrides merge field-by-field; custom roles are unchanged");
  assert.deepEqual(saved.defaults, initial.defaults, "Configured values stay in derivation; defaults remain the session-mode and built-in fallback values");
  assert.deepEqual(await get(), saved, "GET returns the full just-saved settings and role maps");
  assert.deepEqual(structuredClone(parse(await readFile(join(home, "config.toml"), "utf8"))), { ...document, derivation: merged }, "Saving preserves every unrelated config field");
  const configPath = join(home, "config.toml"), bytes = await readFile(configPath, "utf8"), before = await stat(configPath);
  for (const invalid of [
    { ...derivation, extra: true }, { ...derivation, defaultModel: "no-provider" }, { ...derivation, defaultThinkingLevel: "extreme" },
    { ...derivation, defaultModel: "subsession-check/explicit" }, { ...derivation, defaultThinkingLevel: "low" },
    { ...derivation, defaultToolMode: "research" }, { ...derivation, defaultIsolated: "true" }, { ...derivation, defaultInstructions: 42 },
    ...[0, 11, 1.5, "2"].map((maxDepth) => ({ ...derivation, maxDepth })),
    { roles: { " ": {} } }, { roles: { valid: { extra: true } } }, { roles: { valid: { model: "no-provider" } } },
    { roles: { valid: { thinkingLevel: "extreme" } } }, { roles: { valid: { toolMode: "research" } } },
    { roles: { valid: { isolated: 1 } } }, { roles: { valid: { instructions: false } } }, { roles: { valid: { description: 42 } } },
    { roles: { valid: { capabilities: { "not-a-capability": true } } } },
    { roles: { valid: { capabilities: { "tool:write": "false" } } } },
  ]) {
    const response = await fetch(`${web.url}/api/derivation`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ derivation: invalid }) });
    assert.equal(response.status, 400, JSON.stringify(invalid));
    const failure = await response.json();
    assert.equal(failure.code, "INVALID_REQUEST", JSON.stringify(failure));
    assert.equal(await readFile(configPath, "utf8"), bytes, "Invalid requests preserve exact on-disk config bytes");
    const after = await stat(configPath);
    assert.deepEqual([after.ino, after.mtimeMs], [before.ino, before.mtimeMs], "Invalid settings do not replace or rewrite config.toml");
    assert.deepEqual(await get(), saved, "Rejected settings never alter the hot config");
  }
  const crossSite = await fetch(`${web.url}/api/derivation`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://unrelated.invalid" }, body: JSON.stringify({ derivation: {} }) });
  assert.equal(crossSite.status, 403, "Derivation writes use the existing browser-origin guard");
  assert.equal(await readFile(configPath, "utf8"), bytes);
  const replaced = await client.request("derivationSet", { derivation: {} });
  assert.deepEqual(replaced.derivation, { roles: DEFAULT_DERIVATION_ROLES }, "Replacement removes configured overrides, not the builtin roles");
  assert.deepEqual(await get(), replaced);
  await saveDerivation(derivation);
}
