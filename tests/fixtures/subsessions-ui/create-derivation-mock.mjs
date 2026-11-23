import { DEFAULT_DERIVATION_ROLES, DEFAULT_DERIVED_INSTRUCTIONS as DEFAULT_INSTRUCTIONS, DEFAULT_MAX_DERIVATION_DEPTH } from "../../../src/config/derivation/derivation-types.ts";
import { parseDerivationConfig } from "../../../src/config/derivation/parse-config.ts";

export { DEFAULT_INSTRUCTIONS };

export const MODELS = {
  models: [
    { value: "clp/gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "clp", thinkingLevels: ["off", "low", "medium", "high"] },
    { value: "clp/gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "clp", thinkingLevels: ["off", "medium"] },
    { value: "clp/claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "clp", thinkingLevels: ["off", "high"] },
  ],
  defaultModel: "clp/gpt-6.1-sol",
};

export const CAPABILITIES_CATALOG = {
  localTools: true,
  requiresReload: false,
  groups: [
    { id: "group:tools:local", kind: "tool", name: "Local Tools", enabled: true, available: true, defaultEnabled: true, overridden: false },
    {
      id: "group:tools:package:probe",
      kind: "tool",
      name: "Probe Toolkit",
      enabled: true,
      available: true,
      defaultEnabled: true,
      overridden: false,
      lazy: { id: "lazy:group:tools:package:probe", enabled: false, defaultEnabled: false, overridden: false, available: true },
    },
    { id: "group:skills:user", kind: "skill", name: "User Skills", enabled: true, available: true, defaultEnabled: true, overridden: false },
  ],
  entries: [
    {
      id: "tool:read",
      kind: "tool",
      name: "read",
      description: "Read files from the workspace.",
      group: "group:tools:local",
      groupLabel: "Local Tools",
      enabled: true,
      configured: true,
      groupEnabled: true,
      defaultEnabled: true,
      overridden: false,
      available: true,
      lazy: { id: "lazy:tool:read", enabled: false, defaultEnabled: false, overridden: false, available: true },
    },
    {
      id: "tool:write",
      kind: "tool",
      name: "write",
      description: "Write files in the workspace.",
      group: "group:tools:local",
      groupLabel: "Local Tools",
      enabled: true,
      configured: true,
      groupEnabled: true,
      defaultEnabled: true,
      overridden: false,
      available: true,
      lazy: { id: "lazy:tool:write", enabled: false, defaultEnabled: false, overridden: false, available: true },
    },
    {
      id: "tool:probe_search",
      kind: "tool",
      name: "probe_search",
      description: "Search across indexed symbols and references.",
      group: "group:tools:package:probe",
      groupLabel: "Probe Toolkit",
      enabled: true,
      configured: true,
      groupEnabled: true,
      defaultEnabled: true,
      overridden: false,
      available: true,
      lazy: { id: "lazy:tool:probe_search", enabled: false, defaultEnabled: false, overridden: false, available: true },
    },
    {
      id: "skill:/home/user/.agents/skills/code-review/SKILL.md",
      kind: "skill",
      name: "code-review",
      description: "Review branch or PR diffs before merge.",
      group: "group:skills:user",
      groupLabel: "User Skills",
      enabled: true,
      configured: true,
      groupEnabled: true,
      defaultEnabled: true,
      overridden: false,
      available: true,
    },
  ],
};

export function createDerivationMock(initialRoles = {}) {
  const defaults = {
    defaultToolMode: "code",
    defaultIsolated: false,
    maxDepth: DEFAULT_MAX_DERIVATION_DEPTH,
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    roles: DEFAULT_DERIVATION_ROLES,
  };
  let derivation = structuredClone(parseDerivationConfig({ derivation: {
    defaultIsolated: false,
    maxDepth: DEFAULT_MAX_DERIVATION_DEPTH,
    defaultInstructions: DEFAULT_INSTRUCTIONS,
    roles: initialRoles,
  } }));
  const posts = [];
  let capabilityGets = 0;

  const beforeGoto = async (page) => {
    await page.route("**/api/derivation", async (route) => {
      const request = route.request();
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "POST") {
        const body = request.postDataJSON() || {};
        posts.push(body);
        try { derivation = structuredClone(parseDerivationConfig(body)); }
        catch (error) { return json({ code: "INVALID_REQUEST", message: error.message }, 400); }
        return json({ derivation, defaults });
      }
      return json({ derivation, defaults });
    });
    await page.route("**/api/capabilities**", async (route) => {
      capabilityGets += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ catalog: CAPABILITIES_CATALOG, terminal: {} }),
      });
    });
  };

  return { posts, getDerivation: () => derivation, getCapabilityGets: () => capabilityGets, beforeGoto };
}
