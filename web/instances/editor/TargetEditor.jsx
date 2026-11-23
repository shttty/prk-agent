import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { useContext } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Card } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { text } from "../../sessions/sidebar/text.js";
import { makeId } from "../../sessions/dialogs/make-id.js";
import { EMPTY_DIRECTORY } from "../directory-picker/empty-directory.js";
import { browseDirectory } from "../directory-picker/browse-directory.js";
import { pickerStartDirectory } from "./picker-start-directory.js";
import { DirectoryPicker } from "../directory-picker/DirectoryPicker.jsx";
import { ConfigurationIssueNotice } from "../configuration-issue/ConfigurationIssueNotice.jsx";
import { saveBlocker } from "./save-blocker.js";
import { targetPayload } from "./target-payload.js";
import { targetError } from "../target-errors/target-error.js";
import { useDraftInspection } from "./use-draft-inspection.js";
import { ConnectionFields } from "./ConnectionFields.jsx";
import { PythonField } from "./PythonField.jsx";
import { BrowsePathButton } from "./BrowsePathButton.jsx";
import "./editor.css";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import { EnvironmentProgress } from "../environment/EnvironmentProgress.jsx";
import { useEnvironmentGate } from "../environment/use-environment-gate.js";
// A complete connection starts deployment, using an explicit Python or its managed environment (docs/wire/targets.md).
const DEPLOYING = new Set(["checking", "transferring", "failed"]);
const BLOCKERS = {
  label: "实例显示名为必填项。",
  cwd: "工作目录需为绝对路径。",
  "python-path": "Python 解释器需为目标机上的绝对路径。",
};
export function TargetEditor({ actions, existingId, initialConfig, onClose }) {
  const store = useContext(WorkbenchContext);
  const sessionError = useWorkbench((state) => state.session.error);
  const mutating = useWorkbench((state) => state.pending.has("targetMutating"));
  const issue = useWorkbench((state) => existingId ? state.targets.find((item) => item.id === existingId)?.configurationIssue : undefined);
  const [form, setForm] = useState(() => {
    const label = text(initialConfig?.label).trim();
    return {
      id: text(initialConfig?.id).trim() || makeId("target"),
      label,
      labelTouched: Boolean(label),
      tags: Array.isArray(initialConfig?.tags) ? initialConfig.tags.join(", ") : "",
      local: initialConfig?.local === true,
      sshCommand: text(initialConfig?.sshCommand),
      python: text(initialConfig?.python),
      pythonIndexUrl: text(initialConfig?.pythonIndexUrl),
      cwd: text(initialConfig?.cwd),
      executionTimeoutMs: initialConfig?.executionTimeoutMs,
    };
  });
  const [error, setError] = useState({ text: initialConfig?.loadError || "" });
  const [picker, setPicker] = useState(null);
  const [directory, setDirectory] = useState(EMPTY_DIRECTORY);
  const browseSerial = useRef(0);
  const mountedRef = useRef(true);
  // Set once a save started (or failed) the instance's deploy: the editor then stays open to show it.
  const [savedId, setSavedId] = useState(null);
  const gate = useEnvironmentGate(actions, existingId || savedId || "");
  const retryEnvironment = () => void gate.start(() => {});
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const inspection = useDraftInspection(actions, form, (hostname) => setForm((current) => current.labelTouched || !hostname ? current : { ...current, label: hostname }));
  const connected = inspection.probed?.status === "success";

  useEffect(() => () => {
    mountedRef.current = false;
    browseSerial.current += 1;
  }, []);

  if (initialConfig?.loadError) return <Stack gap="md"><InlineAlert size="sm">{initialConfig.loadError}</InlineAlert><Group justify="flex-end"><Button variant="default" onClick={onClose}>关闭</Button></Group></Stack>;

  /** Browses the draft connection's file system; every path is absolute, so no cwd rides along. */
  async function browse(path) {
    if (!inspection.connection) {
      setDirectory((current) => ({ ...current, error: "请先填写连接命令。" }));
      return;
    }
    await browseDirectory(actions, inspection.connection, path, setDirectory, mountedRef, browseSerial);
  }
  function openPicker(mode) {
    setPicker(mode);
    setDirectory(EMPTY_DIRECTORY);
    void browse(pickerStartDirectory(mode, form));
  }
  function closePicker() {
    browseSerial.current += 1;
    setPicker(null);
  }
  function choose(path) {
    closePicker();
    if (picker === "directory") return update({ cwd: path });
    update({ python: path });
    void inspection.checkPython(path);
  }

  function save(event) {
    event.preventDefault();
    const blocker = saveBlocker(form);
    if (blocker) return setError({ text: BLOCKERS[blocker] });
    const target = targetPayload(form, existingId ? initialConfig : null);
    setError({ text: "" });
    actions.saveTarget(target, existingId || null).then((result) => {
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
      if (!deploys && !DEPLOYING.has(held?.status)) return onClose();
      setSavedId(id);
      if (held && held.status !== "failed") gate.watch(held);
    }).catch((cause) => {
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
          <TextInput id="target-cwd" className="management-directory-input" label="工作目录" placeholder="/绝对路径" value={form.cwd} onChange={(event) => update({ cwd: event.currentTarget.value })} maxLength={4096} />
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
        {existingId && (gate.failure || DEPLOYING.has(gate.environment?.status)) ? <EnvironmentProgress environment={gate.environment} failure={gate.failure} onDeploy={retryEnvironment} deploying={gate.waiting} linked={gate.linked} /> : null}
        {error.text || sessionError ? <InlineAlert id="target-editor-error" size="sm" data-code={error.code || undefined} data-reason={error.reason || undefined}>{error.text || sessionError}</InlineAlert> : null}
        <Group justify="flex-end"><Button data-action="cancel" variant="default" onClick={onClose}>取消</Button><Button id="save-target" type="submit" loading={mutating}>保存</Button></Group>
      </Stack>
    </form>
  );
}
