import { Textarea } from "@mantine/core";
import { Card } from "@mantine/core";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
/**
 * Where the instance runs: the Gateway host, or whatever the typed command connects to; plus the draft's connection
 * test. An empty command saves the instance as pending (a stored one is cleared).
 */
export function ConnectionFields({ form, update, inspection }) {
  const { connection, probed, testConnection } = inspection;
  const state = probed?.status || "idle";
  const title = state === "pending" ? "正在测试连接" : state === "error" ? "连接测试失败" : state === "success" ? "已测试连接" : "尚未测试连接";
  const note = state === "success" ? [probed.platform, `${probed.candidates.length} 个 Python 候选`].filter(Boolean).join(" · ")
    : form.local ? "在 Gateway 本机启动目标进程。" : "执行连接命令并在目标机启动目标进程。";
  return <>
    <PrkSwitch id="target-local" label="Gateway 本机" checked={form.local} onChange={(event) => update({ local: event.currentTarget.checked })} />
    {!form.local && <Textarea id="target-ssh-command" label="连接命令" autosize minRows={1} maxRows={6} spellCheck={false} autoComplete="off"
      description="本机用 /bin/sh -c 原样执行；跑完后须连到目标机上读 stdin 的非交互 shell。不支持交互密码、OTP 或 MFA 菜单。留空则保存为待补。"
      placeholder="ssh -T -oBatchMode=yes user@host" value={form.sshCommand}
      onChange={(event) => update({ sshCommand: event.currentTarget.value })}
      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
      styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", wordBreak: "break-all" } }} />}
    <Card id="target-inspection" data-state={state} withBorder padding="sm" className="management-inspection-card">
      <Group justify="space-between" align="flex-start" className="management-inspection-header">
        <div className="management-inspection-copy"><Text size="sm" fw={600}>{title}</Text><Text size="xs" c="dimmed">{note}</Text></div>
        <Button id="inspect-target" variant="default" onClick={() => void testConnection()} loading={state === "pending"} disabled={!connection}>测试连接</Button>
      </Group>
      {probed && <Text id="target-inspection-feedback" size="sm" data-state={state} role={state === "error" ? "alert" : "status"} data-code={probed.error?.code || undefined} data-reason={probed.error?.reason || undefined}
        className={`management-inspection-feedback management-inspection-feedback-${state}`}>{state === "pending" ? "正在测试连接…" : state === "success" ? `可连接 · ${probed.hostname}` : probed.error.text}</Text>}
    </Card>
  </>;
}
