import { CreateDialog } from "./CreateDialog.jsx";
import { ProjectDialog } from "./ProjectDialog.jsx";
import { RenameDialog } from "./RenameDialog.jsx";
import { DerivedSessionDialog } from "./DerivedSessionDialog.jsx";
import { ArchiveConfirmation } from "./ArchiveConfirmation.jsx";
import { ArchiveProjectConfirmation } from "./ArchiveProjectConfirmation.jsx";
import { RetargetDialog } from "./RetargetDialog.jsx";
import { RoleDialog } from "./RoleDialog.jsx";
import { ProjectMemoryDialog } from "./ProjectMemoryDialog.jsx";
import { Modal } from "@mantine/core";
import React from "react";
import { memo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import "./dialogs.css";
function SessionDialogs({ actions, dialog, mobile, onClose, contentKey }) {
  const type = dialog?.type;
  const sessionRow = useWorkbench((state) => state.sessions.get(dialog?.targetName || state.selectedSessionId));
  const titles = { create: "新建会话", project: "所属项目", rename: "重命名会话", "rename-project": "重命名项目", derivation: "派生会话管理", archive: "归档会话", "archive-project": "归档项目内全部会话", retarget: "换到新的执行环境", root: "设为 root", supervisor: "设为项目 supervisor" };
  const content = !type ? null : type === "create" ? <CreateDialog actions={actions} onClose={onClose} initialTarget={dialog.targetName} initialProject={dialog.project} />
        : type === "project" ? <ProjectDialog actions={actions} onClose={onClose} sessionRow={sessionRow} />
          : type === "rename" || type === "rename-project" ? <RenameDialog actions={actions} onClose={onClose} sessionRow={sessionRow} project={type === "rename-project" ? dialog.project : undefined} />
            : type === "derivation" ? <DerivedSessionDialog actions={actions} onClose={onClose} sessionRow={sessionRow} />
              : type === "archive" ? <ArchiveConfirmation actions={actions} onClose={onClose} sessionRow={sessionRow} />
                : type === "archive-project" ? <ArchiveProjectConfirmation actions={actions} onClose={onClose} project={dialog.project} />
                : type === "project-memory" ? <ProjectMemoryDialog actions={actions} project={dialog.project} />
                : type === "retarget" ? <RetargetDialog actions={actions} onClose={onClose} sessionRow={sessionRow} />
                  : type === "root" || type === "supervisor" ? <RoleDialog actions={actions} onClose={onClose} sessionRow={sessionRow} role={type} />
                    : null;
  return <Modal.Stack><Modal stackId="session-management" id="management-dialog" data-kind={type} opened={Boolean(type)} onClose={onClose} closeButtonProps={{ "aria-label": "关闭管理对话框", id: "close-management-dialog" }} title={type === "project-memory" ? `${dialog.project.name} · 项目记忆` : titles[type] || "管理"} centered fullScreen={mobile && type === "project-memory"} size={type === "archive" || type === "archive-project" || type === "project-memory" ? 540 : 460} className="management-modal"><React.Fragment key={contentKey}>{content}</React.Fragment></Modal></Modal.Stack>;
}
export default memo(SessionDialogs);
