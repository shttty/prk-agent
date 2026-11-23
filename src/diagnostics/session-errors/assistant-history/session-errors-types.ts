import type { AgentSession } from "@earendil-works/pi-coding-agent";

export type AssistantFailure = Extract<AgentSession["messages"][number], { role: "assistant" }>;
