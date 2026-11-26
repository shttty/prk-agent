import { useMemo } from "react";
import { useState } from "react";
import { useSessionEnvironment } from "./environment/use-session-environment.ts";
import { EnvironmentProgress } from "../../instances/environment/EnvironmentProgress.tsx";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { EnvironmentFailure, TargetEnvironment } from "../../instances/environment/environment-types.ts";
import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import { useWorkbenchStore } from "../../workbench/subscription/use-workbench-store.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { DirectoryPicker } from "../../instances/directory-picker/DirectoryPicker.tsx";
import { Stack } from "@mantine/core";
import { Select } from "@mantine/core";
import { labelForTarget } from "../sidebar/labels/label-for-target.ts";
import { Text } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { ConfigurationIssueNotice } from "../../instances/configuration-issue/ConfigurationIssueNotice.tsx";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { ProjectSelector } from "./ProjectSelector.tsx";
import { deploymentFailure } from "./deployment-failure.ts";
import { RequestError } from "../../workbench/store/requests/request-error.ts";
import { useProjectChoice } from "./use-project-choice.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
/** New session: the Gateway brings the instance's remote environment up to date inside the create itself (sharing the
 * instance's one deployment); while it does, the dialog shows that deployment's real progress from the workbench stream.
 * A failed deployment creates nothing (DEPLOYMENT_FAILED) and the same create is the retry. */
type CreateDialogProps = { actions: WorkbenchActions; onClose: () => void; initialTarget?: string; initialProject?: ProjectPayload };

export function CreateDialog({ actions, onClose, initialTarget, initialProject }: CreateDialogProps) {
  const store = useWorkbenchStore();
  const targetList: PublicExecutionTarget[] = useWorkbench((state: WorkbenchState) => state.targets);
  const targets = useMemo(() => [...targetList].sort((left, right) => Number(right.local === true) - Number(left.local === true)), [targetList]);
  const [targetName, setTargetName] = useState(() => targets.find((item) => item.id === initialTarget)?.id || targets[0]?.id || "");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<EnvironmentFailure | null>(null);
  const choice = useProjectChoice(initialProject?.id);
  const { targetConfig, configurationIssue, cwd, setCwd, loading, error, setError, directory, directoryOpen, setDirectoryOpen, browse, openDirectory } = useSessionEnvironment(actions, targetName, { create: true, setLabel });
  const environment: TargetEnvironment | null = useWorkbench((state: WorkbenchState) => state.targets.find((target) => target.id === targetName)?.environment ?? null);
  const linked: boolean = useWorkbench((state: WorkbenchState) => state.workbenchLinked);
  const busy = creating;
  const showEnvironment = failure || (creating && environment !== null && ["checking", "transferring"].includes(environment.status));

  async function create() {
    const chosenCwd = cwd.trim();
    if (!targetName || !chosenCwd || busy) return;
    const resolved = choice.resolve();
    // A new project goes by name only (the Gateway makes its id); ungrouped sends no project.
    const project = resolved.name ? { name: resolved.name } : resolved.project || undefined;
    const chosenLabel = label.trim();
    setError("");
    setFailure(null);
    setCreating(true);
    try {
      const result = await actions.createSession(targetName, { cwd: chosenCwd, ...(chosenLabel ? { label: chosenLabel } : {}), ...(project ? { project } : {}) });
      // The deployment's own error (code, reason) is more precise than the create's DEPLOYMENT_FAILED wrapper.
      if (result instanceof RequestError && result.code === "DEPLOYMENT_FAILED") setFailure(deploymentFailure(result));
      else if (result) onClose();
      else setError(store.getSnapshot().session.error || "新会话创建失败。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "新会话创建失败。");
    } finally {
      setCreating(false);
    }
  }
  if (directoryOpen) return <DirectoryPicker directory={directory} onBrowse={browse} onBack={() => setDirectoryOpen(false)} onSelect={(path) => { setCwd(path); setDirectoryOpen(false); }} />;

  return (
    <Stack gap="md">
      <Select id="create-session-target" label="实例" data={targets.map((item) => ({ value: item.id, label: labelForTarget(item) }))} value={targetName || null} onChange={(value) => { setTargetName(value || ""); setFailure(null); }} allowDeselect={false} disabled={busy || !targets.length} />
      {loading && <Text size="sm" c="dimmed">正在读取实例配置…</Text>}
      <ConfigurationIssueNotice issue={configurationIssue} />
      <TextInput id="create-session-label" label="会话名称" placeholder="可选" value={label} onChange={(event) => setLabel(event.currentTarget.value)} maxLength={200} disabled={loading || !targetConfig} />
      <Group align="flex-end" wrap="nowrap"><TextInput id="create-session-cwd" flex={1} label="工作目录" value={cwd} readOnly disabled={loading || !targetConfig} /><Button id="browse-session-directory" variant="default" onClick={() => void openDirectory()} disabled={loading || !targetConfig}>浏览</Button></Group>
      <ProjectSelector choice={choice} disabled={busy} />
      {showEnvironment ? <EnvironmentProgress environment={environment} failure={failure} onDeploy={() => void create()} deploying={creating} linked={linked} /> : null}
      {creating && <Text size="sm" c="dimmed">正在创建会话…</Text>}
      <FormError>{error}</FormError>
      <Group justify="flex-end">
        <Button data-action="cancel" variant="default" onClick={onClose}>取消</Button>
        {!loading && targetConfig && <Button id="confirm-create-session" onClick={() => void create()} loading={busy} disabled={!cwd.trim()}>创建并打开</Button>}
      </Group>
    </Stack>
  );
}
