import { useState } from "react";
import { useSessionEnvironment } from "./environment/use-session-environment.js";
import { DirectoryPicker } from "../../instances/directory-picker/DirectoryPicker.jsx";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.js";
import { targetMap } from "../sidebar/grouping/target-map.js";
import { text } from "../sidebar/text.js";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { Select } from "@mantine/core";
import { labelForTarget } from "../sidebar/labels/label-for-target.js";
import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Button } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { ConfigurationIssueNotice } from "../../instances/configuration-issue/ConfigurationIssueNotice.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/** User-forced recovery into another instance or working directory when the original one is gone; the interpreter is the instance's. */
export function RetargetDialog({ actions, onClose, sessionRow }) {
  const targets = useWorkbench((state) => state.targets);
  const recoveryMessage = useWorkbench((state) => state.session.recoveryMessage);
  const [targetName, setTargetName] = useState(() => (targets.some((item) => item.id === sessionRow?.target) ? sessionRow.target : targets[0]?.id || ""));
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
  const current = [sessionTargetLabel(sessionRow, targetMap(targets)), text(sessionRow?.cwd)].filter(Boolean).join(" · ");
  const recoveryNote = text(sessionRow?.recovery?.message).trim();
  return <Stack gap="md">
    <Text size="sm" c="dimmed">原来的执行环境：{current || "—"}</Text>
    {recoveryNote && <InlineAlert color="yellow" size="sm">{recoveryNote}</InlineAlert>}
    <Text size="sm">在新的执行环境中继续；原目录的文件和 Python 变量不会迁移。</Text>
    <Select id="retarget-target" label="实例" data={targets.map((item) => ({ value: item.id, label: labelForTarget(item) }))} value={targetName} onChange={(value) => setTargetName(value || "")} allowDeselect={false} disabled={submitting} />
    {loading && <Text size="sm" c="dimmed">正在读取实例配置…</Text>}
    <ConfigurationIssueNotice issue={configurationIssue} />
    <Group align="flex-end" wrap="nowrap"><TextInput id="retarget-cwd" className="management-directory-input" label="工作目录" value={cwd} readOnly disabled={loading || !targetConfig} /><Button id="browse-retarget-directory" variant="default" onClick={() => void openDirectory()} disabled={loading || !targetConfig || submitting}>浏览</Button></Group>
    <FormError>{error || (failed ? text(recoveryMessage) || "无法在新的执行环境中启动。" : "")}</FormError>
    <Group justify="flex-end"><Button variant="default" onClick={onClose}>取消</Button><Button id="confirm-retarget" onClick={() => void submit()} loading={submitting} disabled={loading || !targetConfig || !cwd.trim()}>换到这里继续</Button></Group>
  </Stack>;
}
