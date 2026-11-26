// Provider list sections: built-in sources first in a fixed order (saved tools lead), then plugin packages, MCP servers
// and skill directories.
export const BUILTIN = ["group:tools:library", "group:tools:local", "group:tools:kernel"];

export type ProviderCategory = "builtin" | "package" | "remote" | "mcp" | "skill";

export const categoryOf = (id: string): ProviderCategory => id.startsWith("group:skills:") ? "skill" : id.includes(":remote:") ? "remote" : id.includes(":package:") ? "package" : id.includes(":mcp:") ? "mcp" : "builtin";

export const CATEGORY_ORDER: ProviderCategory[] = ["builtin", "package", "remote", "mcp", "skill"];

export const CATEGORY_LABEL: Record<ProviderCategory, string> = { builtin: "内置", package: "Gateway 插件", remote: "会话宿主插件", mcp: "MCP", skill: "来源" };
