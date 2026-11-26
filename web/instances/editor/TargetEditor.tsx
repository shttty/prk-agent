import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Group, Stack, Text, TextInput } from "@mantine/core";
import type { EditableExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { makeId } from "../../sessions/dialogs/make-id.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { useWorkbenchStore } from "../../workbench/subscription/use-workbench-store.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { ConfigurationIssueNotice } from "../configuration-issue/ConfigurationIssueNotice.tsx";
import { browseDirectory } from "../directory-picker/browse-directory.ts";
import { DirectoryPicker } from "../directory-picker/DirectoryPicker.tsx";
import type { DirectoryState } from "../directory-picker/directory-types.ts";
import { EMPTY_DIRECTORY } from "../directory-picker/empty-directory.ts";
import { EnvironmentProgress } from "../environment/EnvironmentProgress.tsx";
import { useEnvironmentGate } from "../environment/use-environment-gate.ts";
import { targetError, type TargetErrorText } from "../target-errors/target-error.ts";
import { BrowsePathButton } from "./BrowsePathButton.tsx";
import { ConnectionFields } from "./ConnectionFields.tsx";
import type { ConfigLoadFailure, DraftForm, EditorConfig } from "./editor-types.ts";
import { PythonField } from "./PythonField.tsx";
import { pickerStartDirectory } from "./picker-start-directory.ts";
import { saveBlocker } from "./save-blocker.ts";
import { targetPayload } from "./target-payload.ts";
import { useDraftInspection } from "./use-draft-inspection.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

// A complete connection starts deployment, using an explicit Python or its managed environment (docs/wire/targets.md).
const DEPLOYING = new Set(["checking", "transferring", "failed"]);
const BLOCKERS = {
  label: "实例显示名为必填项。",
  cwd: "工作目录需为绝对路径。",
  "python-path": "Python 解释器需为目标机上的绝对路径。",
};

type TargetEditorProps = { actions: WorkbenchActions; existingId: string | null; initialConfig: EditorConfig | null; onClose: () => void };

export function TargetEditor({ initialConfig, onClose, ...rest }: TargetEditorProps) {
  if (initialConfig && "loadError" in initialConfig) return <LoadFailure failure={initialConfig} onClose={onClose} />;
  return <TargetForm {...rest} initialConfig={initialConfig} onClose={onClose} />;
}

function LoadFailure({ failure, onClose }: { failure: ConfigLoadFailure; onClose: () => void }) {
  return <Stack gap="md"><InlineAlert size="sm">{failure.loadError}</InlineAlert><Group justify="flex-end"><Button variant="default" onClick={onClose}>关闭</Button></Group></Stack>;
}

type TargetFormProps = { actions: WorkbenchActions; existingId: string | null; initialConfig: EditableExecutionTarget | null; onClose: () => void };

function TargetForm({ actions, existingId, initialConfig, onClose }: TargetFormProps) {
  const store = useWorkbenchStore();
  const sessionError: string | null = useWorkbench((state: WorkbenchState) => state.session.error);
  const mutating = useWorkbench((state: WorkbenchState) => state.pending.has("targetMutating"));
  const issue = useWorkbench((state: WorkbenchState) => existingId ? state.targets.find((item) => item.id === existingId)?.configurationIssue : undefined);
  const [form, setForm] = useState<DraftForm>(() => {
    const label = initialConfig?.label.trim() ?? "";
    return {
      id: initialConfig?.id.trim() || makeId("target"),
      label,
      labelTouched: Boolean(label),
      tags: initialConfig?.tags.join(", ") ?? "",
      local: initialConfig?.local === true,
      sshCommand: initialConfig?.sshCommand ?? "",
      python: initialConfig?.python ?? "",
      pythonIndexUrl: initialConfig?.pythonIndexUrl ?? "",
      cwd: initialConfig?.cwd ?? "",
      executionTimeoutMs: initialConfig?.executionTimeoutMs,
    };
  });
  const [error, setError] = useState<Partial<TargetErrorText>>({});
  const [picker, setPicker] = useState<"directory" | "file" | null>(null);
  const [directory, setDirectory] = useState<DirectoryState>(EMPTY_DIRECTORY);
  const browseSerial = useRef(0);
  const mountedRef = useRef(true);
  // Set once a save started (or failed) the instance's deploy: the editor then stays open to show it.
  const [savedId, setSavedId] = useState<string | null>(null);
  const gate = useEnvironmentGate(actions, existingId || savedId || "");
  const retryEnvironment = () => void gate.start(() => {});
  const update = (patch: Partial<DraftForm>) => setForm((current) => ({ ...current, ...patch }));
  const inspection = useDraftInspection(actions, form, (hostname) => setForm((current) => current.labelTouched || !hostname ? current : { ...current, label: hostname }));
  const connected = inspection.probed?.status === "success";

  useEffect(() => () => {
    mountedRef.current = false;
    browseSerial.current += 1;
  }, []);

  /** Browses the draft connection's file system; every path is absolute, so no cwd rides along. */
  async function browse(path: string) {
    if (!inspection.connection) {
      setDirectory((current) => ({ ...current, error: "请先填写连接命令。" }));
      return;
    }
    await browseDirectory(actions, inspection.connection, path, setDirectory, mountedRef, browseSerial);
  }
  function openPicker(mode: "directory" | "file") {
    setPicker(mode);
    setDirectory(EMPTY_DIRECTORY);
    void browse(pickerStartDirectory(mode, form));
  }
  function closePicker() {
    browseSerial.current += 1;
    setPicker(null);
  }
  function choose(path: string) {
    closePicker();
    if (picker === "directory") return update({ cwd: path });
    update({ python: path });
    void inspection.checkPython(path);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const blocker = saveBlocker(form);
    if (blocker) return setError({ text: BLOCKERS[blocker] });
    const target = targetPayload(form, existingId ? initialConfig : null);
    setError({});
    actions.saveTarget(target, existingId || null).then((result: unknown) => {
      if (!mountedRef.current) return;
      if (result !== true) return setError(result instanceof Error ? targetError(result) : { text: store.getSnapshot().session.error || "" });
      const id = existingId || target.id;
      const saved = store.getSnapshot().targets.find((item) => item.id === id);
      const held = saved?.environment;
      // The Gateway deploys on a save that completes or changes the connection/interpreter (docs/wire/targets.md,
      // 实例环境下发); its save answer may still predate that task, so the editor decides from what it saved and
      // watches from the snapshot it holds. A cwd/label-only edit or a pending instance deploys nothing.
      const connectionSaved = !existingId || "sshCommand" in target || "python" in target || target.local !== (initialConfig?.local === true);
      const deploys = !saved?.configurationIssue && connectionSaved;
      if (!deploys && !(held && DEPLOYING.has(held.status))) return onClose();
      setSavedId(id);
      if (held && held.status !== "failed") gate.watch(held);
    }).catch((cause: unknown) => {
      if (mountedRef.current) setError(targetError(cause));
    });
  }

  if (picker) return <DirectoryPicker mode={picker} directory={directory} onBrowse={browse} onBack={closePicker} selectDisabled={!inspection.connection} onSelect={choose} />;
  if (savedId) return <Stack gap="md" id="target-environment" data-target={savedId}>
    <EnvironmentProgress environment={gate.environment} failure={gate.failure} onDeploy={retryEnvironment} deploying={gate.waiting} linked={gate.linked} />
    <Group justify="flex-end"><Button data-action="close-environment" variant="default" onClick={onClose}>关闭</Button></Group>
  </Stack>;

  return (
    <form onSubmit={save}>
      <Stack gap="md">
        <ConfigurationIssueNotice issue={issue} />
        <TextInput id="target-label" label="实例显示名" value={form.label} onChange={(event) => update({ label: event.currentTarget.value, labelTouched: true })} maxLength={200} required />
        <TextInput label="标签（可选）" description="多个标签用逗号分隔" value={form.tags} onChange={(event) => update({ tags: event.currentTarget.value })} maxLength={2048} />
        <ConnectionFields form={form} update={update} inspection={inspection} />
        <PythonField form={form} update={update} inspection={inspection} connected={connected} onBrowse={openPicker} />
        <TextInput id="target-python-index-url" label="PyPI 镜像" type="url" placeholder="留空继承全局设置" value={form.pythonIndexUrl} onChange={(event) => update({ pythonIndexUrl: event.currentTarget.value })} />
        <Group align="flex-end" wrap="nowrap">
          <TextInput id="target-cwd" flex={1} label="工作目录" placeholder="/绝对路径" value={form.cwd} onChange={(event) => update({ cwd: event.currentTarget.value })} maxLength={4096} />
          <BrowsePathButton mode="directory" connected={connected} onBrowse={openPicker} />
        </Group>
        {initialConfig?.customMetrics?.length ? <section id="instance-custom-metrics" data-count={initialConfig.customMetrics.length}>
          <Text size="sm" fw={600}>自定义指标</Text>
          <Stack gap="xs" mt="xs">{initialConfig.customMetrics.map((metric) => <Card key={metric.name} withBorder padding="xs" data-metric={metric.name}>
            <Text size="sm" fw={500}>{metric.name}{metric.unit ? ` · ${metric.unit}` : ""}</Text>
            <Text size="xs" c="dimmed">{metric.interval_s} s · {metric.parse} · {metric.chart ?? "line"}</Text>
            <Text size="xs" component="code" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{metric.command}</Text>
          </Card>)}</Stack>
        </section> : null}
        {existingId && (gate.failure || (gate.environment && DEPLOYING.has(gate.environment.status))) ? <EnvironmentProgress environment={gate.environment} failure={gate.failure} onDeploy={retryEnvironment} deploying={gate.waiting} linked={gate.linked} /> : null}
        {error.text || sessionError ? <InlineAlert id="target-editor-error" size="sm" data-code={error.code || undefined} data-reason={error.reason || undefined}>{error.text || sessionError}</InlineAlert> : null}
        <Group justify="flex-end"><Button data-action="cancel" variant="default" onClick={onClose}>取消</Button><Button id="save-target" type="submit" loading={mutating}>保存</Button></Group>
      </Stack>
    </form>
  );
}
