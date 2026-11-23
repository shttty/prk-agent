
// Provider list sections (mock): built-in sources first in a fixed order, then plugin packages, then MCP servers.
export const BUILTIN = ["group:tools:local", "group:tools:kernel", "group:tools:library"];

export const categoryOf = (id) => id.startsWith("group:skills:") ? "skill" : id.includes(":remote:") ? "remote" : id.includes(":package:") ? "package" : id.includes(":mcp:") ? "mcp" : "builtin";

export const CATEGORY_ORDER = ["builtin", "package", "remote", "mcp", "skill"];

export const CATEGORY_LABEL = { builtin: "内置", package: "Gateway 插件", remote: "会话宿主插件", mcp: "MCP", skill: "来源" };
