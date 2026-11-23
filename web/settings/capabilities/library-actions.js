
export const operationLabels = { promote: "转正", demote: "降级", archive: "归档", restore: "恢复", delete: "删除" };

export const rowActions = (entry) => entry.status === "staging" ? ["promote", "archive", "delete"] : entry.status === "promoted" ? [...(entry.manual ? [] : ["promote"]), "demote", "archive", "delete"] : ["restore", "delete"];
