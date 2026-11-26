import type { DialogRequest } from "./dialog-request-types.ts";

const TITLES: Record<string, string> = { create: "新建会话", project: "所属项目", rename: "重命名会话", "rename-project": "重命名项目", derivation: "派生会话管理", archive: "归档会话", "archive-project": "归档项目内全部会话", retarget: "换到新的执行环境", root: "设为 root", supervisor: "设为项目 supervisor" };

export function dialogTitle(dialog: DialogRequest | null): string {
  if (dialog?.type === "project-memory") return `${dialog.project.name} · 项目记忆`;
  return (dialog && TITLES[dialog.type]) || "管理";
}
