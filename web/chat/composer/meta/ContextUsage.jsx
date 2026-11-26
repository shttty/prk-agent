import { useState } from "react";
import { useEffect } from "react";
import { Popover } from "@mantine/core";
import { UnstyledButton } from "@mantine/core";
import { Text } from "@mantine/core";
import { contextText } from "../../session-usage/context-text.js";
import { UsageFacts } from "../../session-usage/UsageFacts.jsx";
/** SDK-reported context window usage; unknown stays unknown. `short` drops the word for a narrow row, `ringOnly` also the number. */
export function ContextUsage({ usage, actions, sessionKey, short, ringOnly }) {
  const [opened, setOpened] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!opened) return undefined;
    let live = true;
    setLoading(true);
    setFailed(false);
    void Promise.resolve(actions.nativeData("session")).then((data) => {
      if (!live) return;
      setStats(data || null);
      setFailed(!data);
      setLoading(false);
    });
    return () => { live = false; };
  }, [opened, actions, sessionKey]);
  const percent = Number.isFinite(usage?.percent) ? Math.max(0, Math.min(100, usage.percent)) : null;
  const awaitingUsage = usage?.tokens === null;
  const tone = percent === null ? "unknown" : percent >= 85 ? "high" : percent >= 60 ? "mid" : "low";
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  return (
    <Popover id="context-usage" opened={opened} onChange={setOpened} position="top-end" width={320} shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton className="pi-context-usage" data-tone={tone} onClick={() => setOpened((value) => !value)} onKeyDown={(event) => { if (event.key === "Escape" && opened) { event.stopPropagation(); setOpened(false); } }} aria-label={awaitingUsage ? "上下文用量待下一轮更新" : `上下文用量：${contextText(usage)}`} aria-expanded={opened} aria-haspopup="dialog">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle cx="8" cy="8" r={radius} className="pi-context-track" />
            {percent !== null ? <circle cx="8" cy="8" r={radius} className="pi-context-fill" strokeDasharray={`${(percent / 100) * circumference} ${circumference}`} transform="rotate(-90 8 8)" /> : null}
          </svg>
          {ringOnly ? null : <span>{awaitingUsage ? (short ? "待更新" : "上下文待更新") : percent === null ? (short ? "—" : "上下文 —") : `${short ? "" : "上下文 "}${Math.round(percent)}%`}</span>}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown className="pi-usage-popover">
        <Text className="pi-usage-title">会话用量</Text>
        <UsageFacts stats={stats} contextUsage={usage} loading={loading} failed={failed} />
        <Text className="pi-usage-note">更多信息在会话详情里。</Text>
      </Popover.Dropdown>
    </Popover>
  );
}
