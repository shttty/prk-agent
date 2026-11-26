import { Button, CloseButton, Group, Stack, Text, TextInput } from "@mantine/core";
import { isAbsolutePath } from "../directory-picker/is-absolute-path.ts";
import { BrowsePathButton } from "./BrowsePathButton.tsx";
import type { DraftForm, DraftInspection } from "./editor-types.ts";
import { feedbackColor } from "./feedback-color.ts";

type PythonFieldProps = { form: DraftForm; update: (patch: Partial<DraftForm>) => void; inspection: DraftInspection; connected: boolean; onBrowse: (mode: "directory" | "file") => void };

/**
 * An explicit Python is checked on the target after testing its connection.
 * Leaving it empty selects the instance's managed environment.
 */
export function PythonField({ form, update, inspection, connected, onBrowse }: PythonFieldProps) {
  const { probed, checked, checkPython } = inspection;
  const python = form.python.trim();
  const candidates = connected && probed?.status === "success" ? probed.candidates : [];
  const choose = (path: string) => { update({ python: path }); void checkPython(path); };
  const state = checked?.status;
  return <Stack gap={6}>
    <Group align="flex-end" wrap="nowrap">
      <TextInput id="target-python" flex={1} label="Python 解释器" placeholder="留空使用托管环境" spellCheck={false} autoComplete="off"
        description={connected ? "指定绝对路径使用现有 Python（3.9 及以上），否则使用实例托管环境。" : "先测试连接，再选择已有解释器。"}
        readOnly={!connected} data-connected={connected ? "true" : "false"} value={form.python} onChange={(event) => update({ python: event.currentTarget.value })}
        rightSection={form.python ? <CloseButton id="clear-target-python" size="sm" aria-label="使用托管 Python" onClick={() => update({ python: "" })} /> : null} />
      <BrowsePathButton mode="file" connected={connected} onBrowse={onBrowse} />
      <Button id="check-target-python" variant="default" onClick={() => void checkPython(python)} loading={state === "pending"} disabled={!connected || !isAbsolutePath(python)}>检查</Button>
    </Group>
    {candidates.length > 0 && <Group id="target-python-candidates" gap={6}>{candidates.map((path) => <Button key={path} size="compact-xs" variant={path === python ? "light" : "default"} maw="100%"
      data-action="use-python-candidate" data-path={path} onClick={() => choose(path)}>{path}</Button>)}</Group>}
    {checked && <Text id="target-python-check" size="sm" c={feedbackColor(checked.status)} style={{ overflowWrap: "anywhere" }} data-state={state} role={state === "error" ? "alert" : "status"} data-version={checked.status === "success" ? checked.version : undefined} data-code={checked.status === "error" ? checked.error.code || undefined : undefined} data-reason={checked.status === "error" ? checked.error.reason || undefined : undefined}>
      {checked.status === "pending" ? "正在目标机上检查版本…" : checked.status === "success" ? `Python ${checked.version} · ${checked.path}` : checked.error.text}
    </Text>}
  </Stack>;
}
