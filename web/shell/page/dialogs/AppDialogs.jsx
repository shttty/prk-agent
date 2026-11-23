import { memo } from "react";
import { Modal } from "@mantine/core";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import Management from "../../../sessions/dialogs/SessionDialogs.jsx";
import { SessionDetails } from "../../../sessions/details/SessionDetails.jsx";
import CapabilitiesPanel from "../../../settings/capabilities/CapabilitiesPanel.jsx";
import { InstanceSettings } from "../../../instances/settings/InstanceSettings.jsx";
import SettingsDialog from "../../../settings/dialog/SettingsDialog.jsx";
const MANAGEMENT_ELSEWHERE = ["details", "tools", "skills", "instance"];
/**
 * The page's dialogs: session management, 会话详情, session tools/Skills, instance settings and the settings window.
 * `dialog` is the open session/instance dialog (`dialogMatches`: it belongs to the selected session).
 */
export const AppDialogs = memo(function AppDialogs({ dialog, dialogMatches, dialogSerial, actions, dialogActions, mobile, onCloseDialog, settingsOpen, settingsSection, onCloseSettings, onReset, layoutContext }) {
  const sessionTools = dialogMatches && ["tools", "skills"].includes(dialog?.type);
  const instanceLabel = useWorkbench((state) => state.targets.find((target) => target.id === dialog?.targetName)?.label);
  return <>
    <Management contentKey={dialogSerial} actions={dialogActions} dialog={dialogMatches && !MANAGEMENT_ELSEWHERE.includes(dialog?.type) ? dialog : null} onClose={onCloseDialog} />
    <SessionDetails actions={actions} sessionId={dialog?.sessionId} opened={dialogMatches && dialog?.type === "details"} onClose={onCloseDialog} />
    <Modal id="session-capabilities-dialog" opened={sessionTools} onClose={onCloseDialog} title={dialog?.type === "skills" ? "会话 Skills" : "会话工具"} size="min(1000px, 94vw)" fullScreen={mobile} centered closeButtonProps={{ id: "close-session-capabilities", "aria-label": "关闭会话工具设置" }}>
      {sessionTools ? <SessionCapabilities key={`${dialog.sessionId}:${dialog.type}`} kind={dialog.type} sessionId={dialog.sessionId} actions={actions} mobile={mobile} /> : null}
    </Modal>
    <Modal id="instance-settings-dialog" opened={dialog?.type === "instance"} onClose={onCloseDialog} title={instanceLabel || ""} size="min(1000px, 94vw)" fullScreen={mobile} centered closeButtonProps={{ id: "close-instance-settings", "aria-label": "关闭实例设置" }}>
      {dialog?.type === "instance" ? <InstanceSettings key={dialog.targetName} actions={actions} id={dialog.targetName} mobile={mobile} onClose={onCloseDialog} /> : null}
    </Modal>
    <SettingsDialog opened={settingsOpen} onClose={onCloseSettings} fullScreen={mobile} initialSection={settingsSection} actions={actions} onReset={onReset} layoutContext={layoutContext} />
  </>;
});

function SessionCapabilities({ kind, sessionId, actions, mobile }) {
  const sessionKey = useWorkbench((state) => `${sessionId}:${state.session.streamId || ""}:${state.session.snapshot?.sessionId}`);
  const localTools = useWorkbench((state) => state.session.nativeCatalog?.value?.target?.current?.localTools);
  return <CapabilitiesPanel kind={kind} actions={actions} session mobile={mobile} sessionKey={sessionKey} localTools={localTools} />;
}
