const FALLBACK_INSTRUCTIONS =
  "Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions.";

/** Build the clean DerivationConfig object for POST /api/derivation from UI draft state and roles map. */
export function buildDerivationPayload(draft, roles) {
  const depth = Math.max(1, Math.min(10, Math.trunc(Number(draft.maxDepth) || 3)));
  const cleanRoles = {};
  for (const [rawName, role] of Object.entries(roles || {})) {
    const name = rawName.trim();
    if (!name || !role || typeof role !== "object") continue;
    const entry = {};
    if (typeof role.description === "string" && role.description.trim()) entry.description = role.description.trim();
    if (typeof role.model === "string" && role.model.trim()) entry.model = role.model.trim();
    if (typeof role.thinkingLevel === "string" && role.thinkingLevel.trim()) entry.thinkingLevel = role.thinkingLevel.trim();
    if (role.toolMode === "code" || role.toolMode === "direct") entry.toolMode = role.toolMode;
    if (typeof role.isolated === "boolean") entry.isolated = role.isolated;
    if (typeof role.instructions === "string" && role.instructions.trim()) entry.instructions = role.instructions;
    if (role.capabilities && typeof role.capabilities === "object") {
      const caps = {};
      for (const [id, enabled] of Object.entries(role.capabilities)) {
        if (typeof enabled === "boolean") caps[id] = enabled;
      }
      if (Object.keys(caps).length > 0) entry.capabilities = caps;
    }
    cleanRoles[name] = entry;
  }
  const derivation = {
    defaultIsolated: Boolean(draft.defaultIsolated),
    maxDepth: depth,
    defaultInstructions: typeof draft.defaultInstructions === "string" ? draft.defaultInstructions : FALLBACK_INSTRUCTIONS,
    roles: cleanRoles,
  };
  if (draft.defaultToolMode === "code" || draft.defaultToolMode === "direct") derivation.defaultToolMode = draft.defaultToolMode;
  return derivation;
}
