/** One sub-session role as configured: every field is optional and falls back to the parent session or the defaults. */
export type RoleConfig = { description?: string; model?: string; thinkingLevel?: string; toolMode?: "code" | "direct"; isolated?: boolean; instructions?: string; capabilities?: Record<string, boolean>; spawns?: string[] };

export type ToolModeChoice = "" | "code" | "direct";

/** The global defaults form. */
export type DerivationDraft = { defaultToolMode: ToolModeChoice; defaultIsolated: boolean; maxDepth: number; defaultInstructions: string };

/** The Gateway's own defaults (`/derivation` `defaults`), with its built-in roles. */
export type DerivationDefaults = Required<Omit<DerivationDraft, "defaultToolMode">> & { defaultToolMode: "code" | "direct"; roles: Record<string, RoleConfig> };

/** `/derivation`: the saved configuration and the defaults. */
export type DerivationReply = { derivation?: Partial<DerivationDraft> & { roles?: Record<string, RoleConfig> }; defaults?: Partial<DerivationDefaults> };

export type ModelOption = { value: string; label?: string; provider?: string; thinkingLevels?: readonly string[] };

export type RoleEditorState = { mode: "create" | "edit"; name: string; originalName: string; role: RoleConfig; builtin?: boolean };
