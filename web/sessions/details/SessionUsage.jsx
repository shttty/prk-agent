import { useState } from "react";
import { useEffect } from "react";
import { Text } from "@mantine/core";
import { UsageFacts } from "../../chat/session-usage/UsageFacts.jsx";
export function SessionUsage({ actions, opened, sessionKey, contextUsage }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!opened) return undefined;
    let live = true;
    setLoading(true);
    setFailed(false);
    void actions.nativeData("session").then((data) => {
      if (!live) return;
      setStats(data || null);
      setFailed(!data);
      setLoading(false);
    });
    return () => { live = false; };
  }, [opened, actions, sessionKey]);
  return <section className="session-section" aria-label="用量">
    <Text className="session-section-title">用量</Text>
    <UsageFacts className="session-facts" id="session-usage" stats={stats} contextUsage={contextUsage} loading={loading} failed={failed} />
  </section>;
}

