import { useState } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { text } from "../sidebar/text.js";
import { sessionLabelById } from "../sidebar/labels/session-label-by-id.js";
import { runDialogAction } from "./run-dialog-action.js";
import { HolderChange } from "./HolderChange.jsx";
import { Text } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Card } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Select } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";

/** A session under `name` in the parent chain cannot become its parent (the Gateway refuses the cycle). */
function descendsFrom(sessions, candidate, name) {
  const seen = new Set();
  for (let current = sessions.get(candidate)?.derivation?.owner; current && !seen.has(current); current = sessions.get(current)?.derivation?.owner) {
    if (current === name) return true;
    seen.add(current);
  }
  return false;
}

export function DerivedSessionDialog({ actions, onClose, sessionRow }) {
  const sessions = useWorkbench((state) => state.sessions);
  const managing = useWorkbench((state) => state.session.pending.has("sessionManaging"));
  const derivation = sessionRow?.derivation;
  const [owner, setOwner] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const others = [...sessions.values()].filter((entry) => entry.sessionId !== sessionRow?.sessionId && entry.sessionId !== derivation?.owner && !descendsFrom(sessions, entry.sessionId, sessionRow?.sessionId));
  const options = others.map((entry) => ({ value: entry.sessionId, label: `${text(entry.label).trim() || entry.sessionId}（${entry.sessionId}）` }));
  const source = sessionLabelById(sessions, derivation?.createdBy);
  const currentOwner = derivation?.owner ? sessionLabelById(sessions, derivation.owner) : "用户";
  const run = async (request) => {
    setError("");
    await runDialogAction(() => actions.manageSession(request), onClose, setError, "操作未确认，请刷新。", "管理操作未确认成功。 ");
  };
  if (!derivation) return <Text size="sm" c="dimmed">不是派生会话。</Text>;
  if (confirming) return <Stack gap="md" data-stage="confirm-transfer">
    <Text size="sm">父会话</Text>
    <HolderChange role="owner" from={derivation.owner ? { sessionId: derivation.owner, label: currentOwner } : null} to={{ sessionId: owner, label: sessionLabelById(sessions, owner) }} />
    <Text size="xs" c="dimmed">之后的结果交给新的父会话。</Text>
    <FormError>{error}</FormError>
    <Group justify="flex-end">
      <Button data-action="cancel" variant="default" onClick={() => setConfirming(false)}>返回</Button>
      <Button id="confirm-transfer" loading={managing} disabled={managing} onClick={() => void run({ action: "transfer", owner })}>转交</Button>
    </Group>
  </Stack>;
  return <Stack gap="md" data-stage="manage">
    <Card withBorder padding="sm">
      <Stack gap={4}>
        <Text size="sm" fw={600}>派生会话信息</Text>
        <Text size="xs" c="dimmed">来源：{source} · 当前管理者：{currentOwner}</Text>
        {derivation.pendingOwner ? <Text size="xs" data-field="pending-owner" data-session-id={derivation.pendingOwner}>待接收：{sessionLabelById(sessions, derivation.pendingOwner)}</Text> : null}
        <Text size="xs" c="dimmed">生命周期：{text(derivation.lifecycle) || "—"} · 阶段：{text(derivation.phase) || "—"} · 模型：{text(derivation.model) || "—"}</Text>
        {text(derivation.task) && <Text size="xs" c="dimmed" lineClamp={3}>任务：{text(derivation.task)}</Text>}
      </Stack>
    </Card>
    <Group justify="space-between" align="flex-end">
      <Text size="sm">用户接管</Text>
      <Button id="upgrade-derived-session" onClick={() => void run({ action: "upgrade" })} loading={managing} disabled={managing}>升级为用户管理</Button>
    </Group>
    <Select label="转交给其他 Session" placeholder={options.length ? "选择管理者" : "没有其他 Session"} data={options} value={owner} onChange={(value) => setOwner(value || "")} disabled={!options.length || managing} />
    <Button id="transfer-derived-session" variant="light" disabled={!owner || managing} onClick={() => setConfirming(true)}>转交…</Button>
    <FormError>{error}</FormError>
  </Stack>;
}
