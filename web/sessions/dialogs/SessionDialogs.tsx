import { memo, Fragment, type ReactNode } from "react";
import { Modal } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { SessionRow } from "../session-row-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchReads } from "../workbench-reads-types.ts";
import { ArchiveConfirmation } from "./ArchiveConfirmation.tsx";
import { ArchiveProjectConfirmation } from "./ArchiveProjectConfirmation.tsx";
import { CreateDialog } from "./CreateDialog.tsx";
import { DerivedSessionDialog } from "./DerivedSessionDialog.tsx";
import { ProjectDialog } from "./ProjectDialog.tsx";
import { ProjectMemoryDialog } from "./ProjectMemoryDialog.tsx";
import { RenameDialog } from "./RenameDialog.tsx";
import { RetargetDialog } from "./RetargetDialog.tsx";
import { RoleDialog } from "./RoleDialog.tsx";
import type { DialogRequest } from "./dialog-request-types.ts";
import { dialogTitle } from "./dialog-title.ts";
import "./dialogs.css";

type SessionDialogsProps = { actions: WorkbenchActions; dialog: DialogRequest | null; mobile: boolean; onClose: () => void; contentKey: number | string };

function SessionDialogs({ actions, dialog, mobile, onClose, contentKey }: SessionDialogsProps) {
  const type = dialog?.type;
  const sessionRow: SessionRow | undefined = useWorkbench((state: WorkbenchReads) => (dialog?.targetName || state.selectedSessionId) ? state.sessions.get(dialog?.targetName || state.selectedSessionId || "") : undefined);
  const content = (): ReactNode => {
    if (!dialog) return null;
    const common = { actions, onClose, sessionRow };
    switch (dialog.type) {
      case "create": return <CreateDialog actions={actions} onClose={onClose} initialTarget={dialog.targetName} initialProject={dialog.project} />;
      case "project": return <ProjectDialog {...common} />;
      case "rename": return <RenameDialog {...common} />;
      case "rename-project": return <RenameDialog {...common} project={dialog.project} />;
      case "derivation": return <DerivedSessionDialog {...common} />;
      case "archive": return <ArchiveConfirmation {...common} />;
      case "archive-project": return <ArchiveProjectConfirmation actions={actions} onClose={onClose} project={dialog.project} />;
      case "project-memory": return <ProjectMemoryDialog actions={actions} project={dialog.project} />;
      case "retarget": return <RetargetDialog {...common} />;
      case "root":
      case "supervisor": return <RoleDialog {...common} role={dialog.type} />;
    }
  };
  const wide = type === "archive" || type === "archive-project" || type === "project-memory";
  return <Modal.Stack><Modal stackId="session-management" id="management-dialog" data-kind={type} opened={Boolean(type)} onClose={onClose} closeButtonProps={{ "aria-label": "关闭管理对话框", id: "close-management-dialog" }} title={dialogTitle(dialog)} centered fullScreen={mobile && type === "project-memory"} size={wide ? 540 : 460} className="management-modal"><Fragment key={contentKey}>{content()}</Fragment></Modal></Modal.Stack>;
}
export default memo(SessionDialogs);
