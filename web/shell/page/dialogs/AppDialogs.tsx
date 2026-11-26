import type { WorkbenchState } from "../page-types.ts";
import type { PublicExecutionTarget } from "../../../../src/gateway/wire/web-types.ts";
import type { LayoutCodeContext } from "../../layout/layout-types.ts";
import type { DialogState, PageActions } from "../page-types.ts";
import { memo } from "react";
import { Modal } from "@mantine/core";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import Management from "../../../sessions/dialogs/SessionDialogs.jsx";
import { SessionDetails } from "../../../sessions/details/SessionDetails.jsx";
import CapabilitiesPanel from "../../../settings/capabilities/CapabilitiesPanel.tsx";
import { InstanceSettings } from "../../../instances/settings/InstanceSettings.jsx";
import SettingsDialog from "../../../settings/dialog/SettingsDialog.tsx";
const MANAGEMENT_ELSEWHERE = ["details", "tools", "skills", "instance"];
type AppDialogsProps = {
  dialog: DialogState | null; dialogMatches: boolean; dialogSerial: number; actions: PageActions; dialogActions: PageActions; mobile: boolean;
  onCloseDialog: () => void; settingsOpen: boolean; settingsSection: string | null; onCloseSettings: () => void; onReset: () => void; layoutContext: () => LayoutCodeContext;
};

/**
 * The page's dialogs: session management, 会话详情, session tools/Skills, instance settings and the settings window.
 * `dialog` is the open session/instance dialog (`dialogMatches`: it belongs to the selected session).
 */
export const AppDialogs = memo(function AppDialogs({ dialog, dialogMatches, dialogSerial, actions, dialogActions, mobile, onCloseDialog, settingsOpen, settingsSection, onCloseSettings, onReset, layoutContext }: AppDialogsProps) {
  const toolsDialog = dialogMatches && dialog && (dialog.type === "tools" || dialog.type === "skills") ? dialog : null;
  const instance = dialog?.type === "instance" ? dialog : null;
  const instanceLabel = useWorkbench((state: WorkbenchState) => state.targets.find((target: PublicExecutionTarget) => target.id === dialog?.targetName)?.label);
  const detailsProps = { actions, sessionId: dialog?.sessionId, opened: dialogMatches && dialog?.type === "details", onClose: onCloseDialog };
  return <>
    <Management contentKey={dialogSerial} actions={dialogActions} dialog={dialogMatches && !MANAGEMENT_ELSEWHERE.includes(dialog?.type ?? "") ? dialog : null} mobile={mobile} onClose={onCloseDialog} />
    <SessionDetails {...detailsProps} />
    <Modal id="session-capabilities-dialog" opened={Boolean(toolsDialog)} onClose={onCloseDialog} title={dialog?.type === "skills" ? "会话 Skills" : "会话工具"} size="min(1000px, 94vw)" fullScreen={mobile} centered closeButtonProps={{ id: "close-session-capabilities", "aria-label": "关闭会话工具设置" }}>
      {toolsDialog?.sessionId ? <SessionCapabilities key={`${toolsDialog.sessionId}:${toolsDialog.type}`} kind={toolsDialog.type === "skills" ? "skills" : "tools"} sessionId={toolsDialog.sessionId} actions={actions} mobile={mobile} /> : null}
    </Modal>
    <Modal id="instance-settings-dialog" opened={Boolean(instance)} onClose={onCloseDialog} title={instanceLabel || ""} size="min(1000px, 94vw)" fullScreen={mobile} centered closeButtonProps={{ id: "close-instance-settings", "aria-label": "关闭实例设置" }}>
      {instance ? <InstanceSettings key={instance.targetName} actions={actions} id={instance.targetName} mobile={mobile} onClose={onCloseDialog} onBack={undefined} /> : null}
    </Modal>
    <SettingsDialog opened={settingsOpen} onClose={onCloseSettings} fullScreen={mobile} initialSection={settingsSection} actions={actions} onReset={onReset} layoutContext={layoutContext} />
  </>;
});

function SessionCapabilities({ kind, sessionId, actions, mobile }: { kind: "tools" | "skills"; sessionId: string; actions: PageActions; mobile: boolean }) {
  const sessionKey = useWorkbench((state: WorkbenchState) => `${sessionId}:${state.session.streamId || ""}:${state.session.snapshot?.sessionId}`);
  const localTools = useWorkbench((state: WorkbenchState) => state.session.nativeCatalog?.value?.target?.current?.localTools);
  return <CapabilitiesPanel kind={kind} actions={actions} session mobile={mobile} sessionKey={sessionKey} localTools={localTools} />;
}
