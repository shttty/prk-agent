import type { LibraryEntry } from "./capability-types.ts";

export const statusLabels: Record<string, string> = { staging: "staging", promoted: "正式", archived: "已归档" };

export const operationLabels: Record<string, string> = { promote: "转正", demote: "降级", archive: "归档", restore: "恢复", delete: "删除" };

export const rowActions = (entry: LibraryEntry): string[] => entry.status === "staging" ? ["promote", "archive", "delete"] : entry.status === "promoted" ? [...(entry.manual ? [] : ["promote"]), "demote", "archive", "delete"] : ["restore", "delete"];
