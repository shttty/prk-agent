import { useState } from "react";
import { Alert, Button, Group, Input, SegmentedControl, Text } from "@mantine/core";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchReads } from "../workbench-reads-types.ts";

const LANGUAGES = [{ value: "python", label: "Python" }, { value: "bun", label: "Bun" }];

/** Session kernel language (native action `kernel-language`). The value shown is the snapshot's `kernelLanguage`,
 * changed only by the server's answer; a choice waits for confirmation because the switch drops the namespace. */
type KernelLanguageSettingProps = { actions: WorkbenchActions; blocked: boolean };

export function KernelLanguageSetting({ actions, blocked }: KernelLanguageSettingProps) {
  const language = useWorkbench((state: WorkbenchReads) => state.session.snapshot?.kernelLanguage ?? "python");
  const running = useWorkbench((state: WorkbenchReads) => (state.session.snapshot?.kernel?.activeCells?.length ?? 0) > 0);
  const available = useWorkbench((state: WorkbenchReads) => state.session.nativeCatalog?.value?.actions?.some((item) => item.name === "kernel-language"));
  const [requested, setRequested] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const disabled = blocked || running || !available || saving;
  const confirm = async () => {
    setSaving(true);
    try { await actions.executeNativeAction("kernel-language", { language: requested }, { transcript: false }); }
    finally { setSaving(false); setRequested(null); }
  };
  return <Input.Wrapper label="Kernel 语言">
    <SegmentedControl id="kernel-language" size="sm" fullWidth data-value={language} data-status={running ? "running" : disabled ? "disabled" : "ready"}
      data={LANGUAGES.map(({ value, label }) => ({ value, label: <span data-language={value}>{label}</span> }))}
      value={language} disabled={disabled} onChange={(value) => setRequested(value === language ? null : value)} />
    {requested && !blocked && !running ? <Alert className="pi-kernel-language-confirm" color="gray" variant="light" mt="xs">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="sm">会丢失当前变量。</Text>
        <Group gap="xs" wrap="nowrap">
          <Button size="compact-sm" variant="default" data-action="cancel-kernel-language" onClick={() => setRequested(null)}>取消</Button>
          <Button size="compact-sm" id="confirm-kernel-language" loading={saving} onClick={() => void confirm()}>切换</Button>
        </Group>
      </Group>
    </Alert> : null}
  </Input.Wrapper>;
}
