import { Button, Card, Group, Text, Textarea } from "@mantine/core";
import "./editor.css";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import type { DraftForm, DraftInspection } from "./editor-types.ts";
import { feedbackColor } from "./feedback-color.ts";

type ConnectionFieldsProps = { form: DraftForm; update: (patch: Partial<DraftForm>) => void; inspection: DraftInspection };

/**
 * Where the instance runs: the Gateway host, or whatever the typed command connects to; plus the draft's connection
 * test. An empty command saves the instance as pending (a stored one is cleared).
 */
export function ConnectionFields({ form, update, inspection }: ConnectionFieldsProps) {
  const { connection, probed, testConnection } = inspection;
  const state = probed?.status || "idle";
  const title = state === "pending" ? "正在测试连接" : state === "error" ? "连接测试失败" : state === "success" ? "已测试连接" : "尚未测试连接";
  const note = probed?.status === "success" ? [probed.platform, `${probed.candidates.length} 个 Python 候选`].filter(Boolean).join(" · ")
    : form.local ? "在 Gateway 本机启动目标进程。" : "执行连接命令并在目标机启动目标进程。";
  return <>
    <PrkSwitch id="target-local" label="Gateway 本机" checked={form.local} onChange={(event) => update({ local: event.currentTarget.checked })} />
    {!form.local && <Textarea id="target-ssh-command" label="连接命令" autosize minRows={1} maxRows={6} spellCheck={false} autoComplete="off"
      description="本机用 /bin/sh -c 原样执行；跑完后须连到目标机上读 stdin 的非交互 shell。不支持交互密码、OTP 或 MFA 菜单。留空则保存为待补。"
      placeholder="ssh -T -oBatchMode=yes user@host" value={form.sshCommand}
      onChange={(event) => update({ sshCommand: event.currentTarget.value })}
      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
      styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", wordBreak: "break-all" } }} />}
    <Card id="target-inspection" data-state={state} withBorder padding="sm">
      <Group justify="space-between" align="flex-start">
        <div className="management-inspection-copy"><Text size="sm" fw={600}>{title}</Text><Text size="xs" c="dimmed">{note}</Text></div>
        <Button id="inspect-target" variant="default" onClick={() => void testConnection()} loading={state === "pending"} disabled={!connection}>测试连接</Button>
      </Group>
      {probed && <Text id="target-inspection-feedback" size="sm" mt={8} c={feedbackColor(probed.status)} style={{ overflowWrap: "anywhere" }} data-state={state} role={state === "error" ? "alert" : "status"} data-code={probed.status === "error" ? probed.error.code || undefined : undefined} data-reason={probed.status === "error" ? probed.error.reason || undefined : undefined}  >{probed.status === "pending" ? "正在测试连接…" : probed.status === "success" ? `可连接 · ${probed.hostname}` : probed.error.text}</Text>}
    </Card>
  </>;
}
