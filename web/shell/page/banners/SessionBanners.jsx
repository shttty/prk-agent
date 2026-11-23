import { memo } from "react";
import { useState } from "react";
import { Alert } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { IconAlertCircle } from "@tabler/icons-react";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import BannerRow from "./BannerRow.jsx";
import BannerStack from "./BannerStack.jsx";
/**
 * Session banners over the top of the conversation column (the empty view when there is no session): connection,
 * error, model fallback, native catalog, failed start and pending reload. They never move the transcript or the composer. The fold
 * applies to the session it was folded in only (memory only; another session starts unfolded).
 */
export const SessionBanners = memo(function SessionBanners({ actions, onBottom }) {
  const sessionRow = useWorkbench((state) => state.sessions.get(state.selectedSessionId));
  const status = useWorkbench((state) => state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state);
  const notice = useWorkbench((state) => state.session.banner);
  const error = useWorkbench((state) => state.session.error);
  const catalogError = useWorkbench((state) => state.session.nativeCatalog.error);
  const disconnected = useWorkbench((state) => state.session.connection === "disconnected");
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const sending = useWorkbench((state) => state.session.pending.has("sending"));
  const nativePending = useWorkbench((state) => state.session.pending.has("nativeActionPending"));
  const snapshotRequiresReload = useWorkbench((state) => state.session.snapshot?.requiresReload);
  const modelFallback = useWorkbench((state) => state.session.snapshot?.modelFallback);
  const scope = useWorkbench((state) => `${state.selectedSessionId ?? ""}:${state.session.snapshot?.sessionId ?? ""}`);
  const [foldedFor, setFoldedFor] = useState(null);
  const closed = sessionRow?.state === "closed";
  // No runtime and its last start failed; the next message tries again.
  const unavailable = Boolean(sessionRow && (status === "unavailable" || sessionRow.state === "unavailable"));
  const liveView = Boolean(sessionRow && !closed && !unavailable && status !== "closed");
  const connectionFailed = liveView && (disconnected || (notice?.connection && notice.tone === "error"));
  const banner = notice?.text || (connectionFailed ? "连接已断开。" : "");
  // Startup failures still need a reason. Operation outcomes belong only at the transcript end;
  // a plain closed session keeps its existing reconnect/retarget controls in the menu and topbar.
  const showUnavailable = unavailable && notice?.kind !== "send-rejected";
  const retry = connectionFailed ? <Button id="retry-connection" variant="default" size="xs" disabled={sending} onClick={() => void actions.reconnect()}>重试连接</Button> : null;
  const reload = <Button id="reload-capabilities" size="compact-xs" variant="default" disabled={status !== "idle" || nativePending} onClick={() => void actions.executeNativeAction("reload", {}, { transcript: false })}>重载</Button>;
  const items = [
    banner ? <Alert key="connection" id="connection-banner" data-kind={notice?.kind} data-stage={notice?.stage} data-code={notice?.code} data-submitted={notice?.submitted === undefined ? undefined : String(notice.submitted)} color={notice?.tone === "error" ? "red" : "gray"} icon={<IconInfoCircle size={18} />} role="status" withCloseButton={Boolean(error)} closeButtonLabel="关闭错误提示" onClose={actions.clearError}>
      <BannerRow actions={retry}>
        {error ? <><Text size="sm" fw={700}>{banner}</Text><div id="chat-error" role="alert"><Text size="sm">{error}</Text></div></> : <Text size="sm">{banner}</Text>}
      </BannerRow>
    </Alert> : error ? <Alert key="error" id={sessionRow ? "chat-error" : "notice"} data-testid={sessionRow ? undefined : "global-error"} color="red" icon={<IconAlertCircle size={18} />} role="alert" withCloseButton closeButtonLabel="关闭错误提示" onClose={actions.clearError}>{error}</Alert> : null,
    sessionRow && modelFallback ? <Alert key="model-fallback" id="model-fallback-banner" className="shell-alert" data-previous-model={modelFallback.previousModel} data-model={modelFallback.model} data-reason={modelFallback.reason} color="gray" icon={<IconInfoCircle size={18} />} role="status">
      <Text size="sm">{modelFallback.reason}</Text>
      <Group gap="xs" mt="xs">
        <Button id="select-available-model" size="compact-xs" variant="default" disabled={!connected || nativePending} onClick={() => { const select = document.getElementById("chat-model-select"); select?.focus(); select?.click(); }}>选择模型</Button>
        <Button id="acknowledge-model-fallback" size="compact-xs" variant="subtle" color="gray" disabled={!connected || nativePending} onClick={() => void actions.executeNativeAction("acknowledge-model-fallback", {}, { transcript: false })}>确认</Button>
      </Group>
    </Alert> : null,
    sessionRow && catalogError ? <Alert key="catalog" color="yellow" icon={<IconInfoCircle size={18} />} role="status">原生能力目录不可用：{catalogError}</Alert> : null,
    sessionRow && showUnavailable ? <Alert key="recovery" id="recovery-controls" data-kind="unavailable" color="yellow" icon={<IconInfoCircle size={18} />} role="status">
      <Text size="sm" id="recovery-status">无法启动。{sessionRow.recovery?.message ? ` ${sessionRow.recovery.message}` : ""}</Text>
    </Alert> : null,
    sessionRow && (sessionRow.requiresReload || snapshotRequiresReload) ? <Alert key="reload" color="gray" icon={<IconInfoCircle size={18} />} data-requires-reload="true" role="status">
      <BannerRow actions={reload}><Text size="sm">会话设置已改，重载后生效</Text></BannerRow>
    </Alert> : null,
  ].filter(Boolean);
  // Another session never inherits a fold: drop it during this render, before anything is drawn from it.
  if (foldedFor !== null && foldedFor !== scope) setFoldedFor(null);
  const folded = foldedFor === scope;
  return <BannerStack items={items} collapsed={folded} onToggle={() => setFoldedFor(folded ? null : scope)} onBottom={onBottom} />;
});
