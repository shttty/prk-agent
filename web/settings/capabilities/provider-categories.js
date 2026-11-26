// Provider list sections: what PRK itself saved (沉淀) first, then built-in sources in a fixed order, plugin packages,
// MCP servers and external skill directories.
export const SAVED_GROUPS = ["group:tools:library", "group:skills:shared"];

export const BUILTIN = ["group:tools:local", "group:tools:kernel"];

export const categoryOf = (id) => SAVED_GROUPS.includes(id) ? "saved" : id.startsWith("group:skills:") ? "skill" : id.includes(":remote:") ? "remote" : id.includes(":package:") ? "package" : id.includes(":mcp:") ? "mcp" : "builtin";

export const CATEGORY_ORDER = ["saved", "builtin", "package", "remote", "mcp", "skill"];

export const CATEGORY_LABEL = { saved: "沉淀", builtin: "内置", package: "Gateway 插件", remote: "会话宿主插件", mcp: "MCP", skill: "外部来源" };
