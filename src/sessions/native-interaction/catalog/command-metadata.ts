import type { StaticCommand } from "../native-types.ts";

export const staticCommands: readonly StaticCommand[] = [
  { name: "settings", description: "Inspect or change safe session settings; global defaults are never changed.", source: "builtin", arguments: [{ name: "autoCompaction", description: "on or off", candidates: [{ value: "on" }, { value: "off" }] }, { name: "autoRetry", description: "on or off", candidates: [{ value: "on" }, { value: "off" }] }, { name: "showImages", description: "Web presentation preference; applied locally by the browser", candidates: [{ value: "on" }, { value: "off" }] }], effect: "session", risk: "low" },
  { name: "model", description: "Select the active model for this session.", source: "builtin", arguments: [{ name: "model", description: "PROVIDER/MODEL", required: true }], effect: "model", risk: "model" },
  { name: "tree", description: "Navigate within the current SDK conversation tree.", source: "builtin", arguments: [{ name: "entryId", description: "Existing SDK entry ID", required: true }], effect: "session", risk: "low" },
  { name: "thinking", description: "Select the thinking level supported by the active model.", source: "builtin", arguments: [{ name: "level", description: "Model thinking level", required: true }], effect: "model", risk: "model" },
  { name: "scoped-models", description: "Set the session model cycle scope.", source: "builtin", arguments: [{ name: "models", description: "Space-separated PROVIDER/MODEL values", required: true }], effect: "model", risk: "model" },
  { name: "export", description: "Return a managed HTML or JSONL download payload without writing Gateway files.", source: "builtin", arguments: [{ name: "format", description: "html or jsonl", candidates: [{ value: "html" }, { value: "jsonl" }] }], effect: "external", risk: "low" },
  { name: "import", description: "Import is restricted to an explicitly authorized uploaded session source.", source: "builtin", arguments: [{ name: "source", description: "Approved browser upload", required: true }], effect: "external", risk: "sensitive" },
  { name: "share", description: "External publishing is disabled in Gateway chat.", source: "builtin", effect: "external", risk: "sensitive" },
  { name: "copy", description: "Read the last assistant text for browser clipboard handling.", source: "builtin", effect: "read", risk: "none" },
  { name: "name", description: "Set the SDK session display name.", source: "builtin", arguments: [{ name: "name", description: "Session name", required: true }], effect: "session", risk: "low" },
  { name: "session", description: "Show sanitized SDK session statistics and context usage.", source: "builtin", effect: "read", risk: "none" },
  { name: "changelog", description: "Show the installed Pi release notes and version.", source: "builtin", effect: "read", risk: "none" },
  { name: "hotkeys", description: "Show complete semantic Web/native action help.", source: "builtin", effect: "presentation", risk: "none" },
  { name: "fork", description: "Use the fork icon below an assistant reply to create a new conversation.", source: "builtin", effect: "session", risk: "low" },
  { name: "clone", description: "Clone the current SDK history into an independent managed session without copying execution or task ownership.", source: "builtin", effect: "session", risk: "low" },
  { name: "trust", description: "Project trust changes are disabled from chat.", source: "builtin", effect: "external", risk: "sensitive" },
  { name: "login", description: "Credential changes require the dedicated authorized auth flow.", source: "builtin", effect: "external", risk: "sensitive" },
  { name: "logout", description: "Credential removal requires the dedicated authorized auth flow.", source: "builtin", effect: "external", risk: "sensitive" },
  { name: "new", description: "Create and open an independent managed session without replacing the current session or closing its runtime or kernel.", source: "builtin", effect: "session", risk: "low" },
  { name: "compact", description: "Compact the current SDK context using a real model call.", source: "builtin", arguments: [{ name: "instructions", description: "Optional compaction instructions" }], effect: "context", risk: "model" },
  { name: "reload", description: "Reload approved SDK resources while idle.", source: "builtin", effect: "session", risk: "low" },
  { name: "quit", description: "Leave the Web view; never stop the Gateway.", source: "builtin", effect: "presentation", risk: "none" },
  { name: "llama", description: "Native llama.cpp manager is not loaded by this Gateway runtime.", source: "extension", effect: "external", risk: "sensitive" },
  { name: "debug", description: "Local debug-file export is disabled; diagnostics remain Gateway-owned.", source: "hidden", hidden: true, effect: "external", risk: "sensitive" },
  { name: "arminsayshi", description: "Native presentation easter egg; no model or Gateway side effect.", source: "hidden", hidden: true, effect: "presentation", risk: "none" },
  { name: "dementedelves", description: "Native presentation announcement; no model or Gateway side effect.", source: "hidden", hidden: true, effect: "presentation", risk: "none" },
] as const;

export const replyForkAction: StaticCommand = { name: "fork-reply", description: "Create a conversation through a selected assistant reply.", source: "builtin", effect: "session", risk: "low" };
