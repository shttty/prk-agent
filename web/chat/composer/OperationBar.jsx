import "./send/send.css";
import { memo } from "react";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { WorkingIndicator } from "../extension-ui/WorkingIndicator.jsx";
import { ExtensionStatus } from "../extension-ui/ExtensionStatus.jsx";
import { AnsiText } from "../ansi/AnsiText.jsx";
import { useBusy } from "./use-busy.js";
import { currentRunStage } from "./run-stage/current-run-stage.js";
export const OperationBar = memo(function OperationBar({ actions }) {
  const { busy: running, cancelling } = useBusy();
  // Sending shows before the Gateway admits the request, while the session may still be idle.
  const stage = useWorkbench((state) => currentRunStage(state)?.stage);
  const stageText = useWorkbench((state) => currentRunStage(state)?.text);
  const busy = running || stage === "sending";
  // Plugin setStatus entries share the running strip above the composer.
  const statusEntries = useWorkbench((state) => state.session.extensionUi?.status || state.session.extensionUiRender?.status);
  const feedback = useWorkbench((state) => state.session.nativeFeedback);
  const working = useWorkbench((state) => state.session.extensionUi?.working);
  const connected = useWorkbench((state) => state.session.connection === "connected");
  const statusCount = (statusEntries || []).length;
  const runningNative = feedback.findLast((item) => item.status === "running");
  const compacting = stage === "compacting";
  return (
    <Group id="operation-bar" hidden={!runningNative && !statusCount && (!busy || (!compacting && working?.visible === false))} className="pi-operation-bar operation-bar" gap={6} wrap="nowrap">
              {busy || runningNative ? <WorkingIndicator indicator={busy ? working?.indicator : undefined} /> : null}
              {cancelling || busy || runningNative ? <Text id="operation-state" size="xs" data-stage={busy ? stage || "waiting" : undefined}>{cancelling ? "正在停止…" : busy ? <AnsiText text={(compacting ? stageText : working?.message || stageText) || "等待模型响应…"} /> : `正在执行 ${safeText(runningNative?.action) || "原生操作"}…`}</Text> : null}
              {cancelling ? <Text id="operation-detail" size="xs" c="dimmed">等待执行端确认</Text> : null}
              {runningNative ? <Button type="button" size="compact-xs" variant="subtle" color="red" disabled={!connected || runningNative.cancellable !== true} onClick={() => void actions.cancelNativeAction(runningNative.requestId)}>取消原生操作</Button> : null}
              <ExtensionStatus entries={statusEntries} />
            </Group>
  );
});
