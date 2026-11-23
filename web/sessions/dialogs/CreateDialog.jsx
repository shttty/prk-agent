import { useMemo } from "react";
import { useState } from "react";
import { useContext } from "react";
import { useSessionEnvironment } from "./environment/use-session-environment.js";
import { useEnvironmentGate } from "../../instances/environment/use-environment-gate.js";
import { EnvironmentProgress } from "../../instances/environment/EnvironmentProgress.jsx";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import { DirectoryPicker } from "../../instances/directory-picker/DirectoryPicker.jsx";
import { Stack } from "@mantine/core";
import { Select } from "@mantine/core";
import { labelForTarget } from "../sidebar/labels/label-for-target.js";
import { Text } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { ConfigurationIssueNotice } from "../../instances/configuration-issue/ConfigurationIssueNotice.jsx";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { ProjectSelector } from "./ProjectSelector.jsx";
import { useProjectChoice } from "./use-project-choice.js";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/** New session: the instance's remote environment is checked/deployed first (sharing the instance's one task, with its
 * real progress), and only a ready environment lets the original synchronous create run. A failed or interrupted wait
 * creates nothing and offers an explicit retry; closing the dialog drops the intent but not the Gateway's task. */
export function CreateDialog({ actions, onClose, initialTarget, initialProject }) {
  const store = useContext(WorkbenchContext);
  const targetList = useWorkbench((state) => state.targets);
  const targets = useMemo(() => [...targetList].sort((left, right) => Number(right.local === true) - Number(left.local === true)), [targetList]);
  const [targetName, setTargetName] = useState(() => targets.find((item) => item.id === initialTarget)?.id || targets[0]?.id || "");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const choice = useProjectChoice(initialProject?.id);
  const { targetConfig, configurationIssue, cwd, setCwd, loading, error, setError, directory, directoryOpen, setDirectoryOpen, browse, openDirectory } = useSessionEnvironment(actions, targetName, { create: true, setLabel });
  const gate = useEnvironmentGate(actions, targetName);
  const busy = creating || gate.waiting;
  const showEnvironment = attempted && (gate.failure || (gate.environment && gate.environment.status !== "ready"));

  async function create() {
    const chosenCwd = cwd.trim();
    if (!targetName || !chosenCwd || busy) return;
    const resolved = choice.resolve();
    // A new project goes by name only (the Gateway makes its id); ungrouped sends no project.
    const project = resolved.name ? { name: resolved.name } : resolved.project || undefined;
    const chosenLabel = label.trim();
    setError("");
    setAttempted(true);
    const run = async () => {
      setCreating(true);
      try {
        const result = await actions.createSession(targetName, { cwd: chosenCwd, ...(chosenLabel ? { label: chosenLabel } : {}), ...(project ? { project } : {}) });
        if (result?.code === "ENVIRONMENT_REQUIRED") gate.refuse(result);
        else if (result) onClose();
        else setError(store.getSnapshot().session.error || "新会话创建失败。");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "新会话创建失败。");
      } finally {
        setCreating(false);
      }
    };
    // A pending instance (no command/interpreter) creates a history-only session: no runtime, nothing to deploy.
    if (configurationIssue) return run();
    await gate.start(run);
  }
  if (directoryOpen) return <DirectoryPicker directory={directory} onBrowse={browse} onBack={() => setDirectoryOpen(false)} onSelect={(path) => { setCwd(path); setDirectoryOpen(false); }} />;

  return (
    <Stack gap="md">
      <Select id="create-session-target" label="实例" data={targets.map((item) => ({ value: item.id, label: labelForTarget(item) }))} value={targetName || null} onChange={(value) => { setTargetName(value || ""); setAttempted(false); }} allowDeselect={false} disabled={busy || !targets.length} />
      {loading && <Text size="sm" c="dimmed">正在读取实例配置…</Text>}
      <ConfigurationIssueNotice issue={configurationIssue} />
      <TextInput id="create-session-label" label="会话名称" placeholder="可选" value={label} onChange={(event) => setLabel(event.currentTarget.value)} maxLength={200} disabled={loading || !targetConfig} />
      <Group align="flex-end" wrap="nowrap"><TextInput id="create-session-cwd" className="management-directory-input" label="工作目录" value={cwd} readOnly disabled={loading || !targetConfig} /><Button id="browse-session-directory" variant="default" onClick={() => void openDirectory()} disabled={loading || !targetConfig}>浏览</Button></Group>
      <ProjectSelector choice={choice} disabled={busy} />
      {showEnvironment ? <EnvironmentProgress environment={gate.environment} failure={gate.failure} onDeploy={() => void create()} deploying={gate.waiting} linked={gate.linked} /> : null}
      {creating && <Text size="sm" c="dimmed">正在创建会话…</Text>}
      <FormError>{error}</FormError>
      <Group justify="flex-end">
        <Button data-action="cancel" variant="default" onClick={onClose}>取消</Button>
        {!loading && targetConfig && <Button id="confirm-create-session" onClick={() => void create()} loading={busy} disabled={!cwd.trim()}>创建并打开</Button>}
      </Group>
    </Stack>
  );
}
