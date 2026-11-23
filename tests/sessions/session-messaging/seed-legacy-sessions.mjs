import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";

export async function seedLegacySessions({ home, historyDir }) {
  await mkdir(historyDir, { recursive: true });
  const sessions = {};
  for (const [name, owner] of [["legacy-owner", null], ["legacy-child", "legacy-owner"], ["legacy-grandchild", "legacy-child"], ["legacy-peer", null]]) {
    const path = join(historyDir, `${name}.jsonl`);
    await writeFile(path, "");
    const manager = SessionManager.open(path, historyDir, home);
    const sessionId = manager.getSessionId();
    manager.appendSessionInfo(`Label for ${name}`);
    manager.appendCustomEntry("gateway-session-binding", { version: 4, target: "local", cwd: home, sessionId });
    manager.appendModelChange("session-messaging-check", "controlled");
    manager.appendThinkingLevelChange("off");
    manager.appendCustomEntry("gateway-session-sleep", { version: 1, sessionId, sleeping: true });
    if (owner) manager.appendCustomEntry("gateway-derived-session", {
      sessionId, createdBy: sessions[owner].sessionId, owner: sessions[owner].sessionId, taskId: `${name}-task`, task: `Historical task for ${name}`,
      lifecycle: "persistent", phase: "working", model: "session-messaging-check/controlled", thinkingLevel: "off",
    });
    manager.appendMessage({ role: "user", content: `LEGACY_HISTORY_${name}`, timestamp: Date.now() });
    sessions[name] = { sessionId, sessionName: `Label for ${name}` };
  }
  return sessions;
}
