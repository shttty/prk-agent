import { useState } from "react";
import { useSessionEnvironment } from "./environment/use-session-environment.ts";
import { DirectoryPicker } from "../../instances/directory-picker/DirectoryPicker.tsx";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.ts";
import { targetMap } from "../sidebar/grouping/target-map.ts";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { Select } from "@mantine/core";
import { labelForTarget } from "../sidebar/labels/label-for-target.ts";
import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Button } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { ConfigurationIssueNotice } from "../../instances/configuration-issue/ConfigurationIssueNotice.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow } from "../session-row-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchReads } from "../workbench-reads-types.ts";
/** User-forced recovery into another instance or working directory when the original one is gone; the interpreter is the instance's. */
type RetargetDialogProps = { actions: WorkbenchActions; onClose: () => void; sessionRow: SessionRow | undefined };

export function RetargetDialog({ actions, onClose, sessionRow }: RetargetDialogProps) {
  const targets: PublicExecutionTarget[] = useWorkbench((state: WorkbenchReads) => state.targets);
  const recoveryMessage: string = useWorkbench((state: WorkbenchReads) => state.session.recoveryMessage);
  const [targetName, setTargetName] = useState(() => (targets.find((item) => item.id === sessionRow?.target)?.id ?? targets[0]?.id ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const { targetConfig, configurationIssue, cwd, setCwd, loading, error, setError, directory, directoryOpen, setDirectoryOpen, browse, openDirectory, mountedRef } = useSessionEnvironment(actions, targetName, { sessionRow });

  async function submit() {
    if (!targetName || !cwd.trim() || submitting) return;
    setSubmitting(true);
    setFailed(false);
    setError("");
    try {
      const result = await actions.recoverSession("new", { target: targetName, cwd: cwd.trim() });
      if (result !== false) onClose();
      else setFailed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法在新的执行环境中启动。");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (directoryOpen) return <DirectoryPicker directory={directory} onBrowse={browse} onBack={() => setDirectoryOpen(false)} onSelect={(path) => { setCwd(path); setDirectoryOpen(false); }} />;
  const current = [sessionRow && sessionTargetLabel(sessionRow, targetMap(targets)), sessionRow?.cwd].filter(Boolean).join(" · ");
  const recoveryNote = sessionRow?.recovery?.message.trim();
  return <Stack gap="md">
    <Text size="sm" c="dimmed">原来的执行环境：{current || "—"}</Text>
    {recoveryNote && <InlineAlert color="yellow" size="sm">{recoveryNote}</InlineAlert>}
    <Text size="sm">在新的执行环境中继续；原目录的文件和 Python 变量不会迁移。</Text>
    <Select id="retarget-target" label="实例" data={targets.map((item) => ({ value: item.id, label: labelForTarget(item) }))} value={targetName} onChange={(value) => setTargetName(value || "")} allowDeselect={false} disabled={submitting} />
    {loading && <Text size="sm" c="dimmed">正在读取实例配置…</Text>}
    <ConfigurationIssueNotice issue={configurationIssue} />
    <Group align="flex-end" wrap="nowrap"><TextInput id="retarget-cwd" flex={1} label="工作目录" value={cwd} readOnly disabled={loading || !targetConfig} /><Button id="browse-retarget-directory" variant="default" onClick={() => void openDirectory()} disabled={loading || !targetConfig || submitting}>浏览</Button></Group>
    <FormError>{error || (failed ? recoveryMessage || "无法在新的执行环境中启动。" : "")}</FormError>
    <Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button id="confirm-retarget" onClick={() => void submit()} loading={submitting} disabled={loading || !targetConfig || !cwd.trim()}>换到这里继续</Button></Group>
  </Stack>;
}
