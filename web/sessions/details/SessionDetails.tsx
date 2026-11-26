import "./details.css";
import { memo } from "react";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { label } from "./status-label.ts";
import { SessionUsage } from "./SessionUsage.tsx";
import { SessionSettings } from "./SessionSettings.tsx";
import { SessionResources } from "./SessionResources.tsx";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { sessionRoles } from "../roles/session-roles.ts";
import { RoleBadges } from "../roles/RoleBadges.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { issueLabel } from "../../instances/configuration-issue/issue-label.ts";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { Activity } from "../../workbench/store/store-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
/** 会话详情 of `sessionId`; the body (and its subscriptions, e.g. the event sequence) exists only while open. */
type SessionDetailsProps = { actions: WorkbenchActions; sessionId: string; opened: boolean; onClose: () => void };

export const SessionDetails = memo(function SessionDetails({ actions, sessionId, opened, onClose }: SessionDetailsProps) {
  return <Modal opened={opened} onClose={onClose} closeButtonProps={{ "aria-label": "关闭会话详情", id: "close-session-details" }} title="会话详情" size="lg">
    <SessionDetailsBody actions={actions} sessionId={sessionId} opened={opened} />
  </Modal>;
});

function SessionDetailsBody({ actions, sessionId, opened }: Omit<SessionDetailsProps, "onClose">) {
  const sessionRow = useWorkbench((state: WorkbenchState) => state.sessions.get(sessionId));
  const sessions = useWorkbench((state: WorkbenchState) => state.sessions);
  const targets: PublicExecutionTarget[] = useWorkbench((state: WorkbenchState) => state.targets);
  const sessionControl = useWorkbench((state: WorkbenchState) => state.sessionControl);
  const selectedSessionId = useWorkbench((state: WorkbenchState) => state.selectedSessionId);
  const streamId = useWorkbench((state: WorkbenchState) => state.session.streamId);
  const activities: Activity[] = useWorkbench((state: WorkbenchState) => state.session.activities);
  const model = useWorkbench((state: WorkbenchState) => state.session.snapshot?.model);
  const thinkingLevel = useWorkbench((state: WorkbenchState) => state.session.snapshot?.thinkingLevel);
  const hostState = useWorkbench((state: WorkbenchState) => state.session.snapshot?.state);
  const snapshotSessionId = useWorkbench((state: WorkbenchState) => state.session.snapshot?.sessionId);
  const sequence = useWorkbench((state: WorkbenchState) => state.session.snapshot?.sequence);
  const contextUsage = useWorkbench((state: WorkbenchState) => state.session.snapshot?.contextUsage);
  const kernel = useWorkbench((state: WorkbenchState) => state.session.snapshot?.kernel) || sessionRow?.kernel;
  const target = targets.find((item) => item.id === sessionRow?.target);
  const derivation = sessionRow?.derivation;
  const origin = derivation?.createdBy ? sessions.get(derivation.createdBy)?.label || derivation.createdBy : "独立会话";
  const owner = derivation?.owner ? sessions.get(derivation.owner)?.label || derivation.owner : "用户";
  const roles = sessionRoles(sessionControl, sessionRow);
  const pendingOwner = derivation?.pendingOwner ? sessions.get(derivation.pendingOwner)?.label || derivation.pendingOwner : "";
  return <Stack gap="md">
    <dl className="session-facts">
      <dt>会话</dt><dd id="session-name">{sessionRow?.label || sessionRow?.sessionId || "—"}</dd>
      <dt>执行位置</dt><dd>{target?.label || "已删除实例"}</dd>
      <dt>Python</dt>
      {/* The instance's interpreter (no per-session one): unavailable without the instance, its pending mark without an interpreter. */}
      <dd id="kernel-state" data-python={target?.python || undefined} data-configuration-issue={sessionRow?.configurationIssue?.code}>{!target ? "不可用" : target.python || issueLabel(target.configurationIssue)} · {kernel?.lastOutcome === "unknown" ? "结果未知" : label(kernel?.state || "not_started")}{kernel?.connectionStatus ? ` · ${label(kernel.connectionStatus)}` : ""}</dd>
      <dt>会话状态</dt><dd id="host-state">{label(hostState || sessionRow?.state)}</dd>
      <dt>会话标识</dt><dd id="session-id">{snapshotSessionId || sessionRow?.sessionId || "—"}</dd>
      <dt>事件序号</dt><dd id="sequence-state" data-stream-id={streamId || undefined}>{sequence ?? "—"}</dd>
      <dt>模型</dt><dd>{model || "—"}</dd><dt>Thinking</dt><dd>{thinkingLevel || "—"}</dd>
      <dt>派生来源</dt><dd>{origin}</dd>
      <dt>当前管理者</dt><dd>{owner}</dd>
      {pendingOwner ? <><dt>待接收</dt><dd id="session-pending-owner" data-session-id={derivation?.pendingOwner}>{pendingOwner}</dd></> : null}
      <dt>项目</dt><dd id="session-project">{sessionRow?.projectName || "—"}</dd>
      <dt>角色</dt><dd id="session-roles" data-count={Number(roles.root) + Number(roles.supervisor)}>{roles.root || roles.supervisor ? <RoleBadges {...roles} /> : "—"}</dd>
      {derivation && <><dt>生命周期</dt><dd>{derivation.lifecycle || "—"} · {derivation.phase || "—"} · {derivation.model || "—"}</dd></>}
    </dl>
    <SessionUsage actions={actions} opened={opened} sessionKey={`${sessionRow?.sessionId || ""}:${streamId || ""}:${snapshotSessionId || ""}`} contextUsage={contextUsage} />
    {sessionRow?.state !== "closed" ? <SessionSettings actions={actions} opened={opened} /> : null}
    {sessionRow?.sessionId === selectedSessionId && sessionRow?.state !== "closed" ? <SessionResources /> : null}
    <details className="diagnostics"><summary>运行记录</summary>
      <div id="activity-feed" className="activity-feed" aria-label="运行记录">
        {!activities.length && <Text size="sm" c="dimmed">暂无运行记录</Text>}
        {activities.map((item) => <article className={`activity-card is-${item.tone || "info"}`} key={item.id}>
          <Group justify="space-between" gap="xs"><Text size="sm" fw={500}>{item.title}</Text><Text component="time" size="xs" c="dimmed">{item.time ? new Date(item.time).toLocaleTimeString("zh-CN") : ""}</Text></Group>
          {item.meta && <Text size="xs" c="dimmed">{item.meta}</Text>}
        </article>)}
      </div>
    </details>
  </Stack>;
}
