import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { SendMode } from "../../gateway/wire/wire-types.ts";
import type { CapabilitySwitches } from "../capabilities/capability-types.ts";
import type { DelegationLevel } from "./delegation-levels.ts";

export const TOOL_MODES = ["code", "direct"] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

/** Gateway-owned defaults; each runtime receives its own explicit options. */
export const DEFAULT_SESSION_OPTIONS = Object.freeze({
  /** Gateway session history (Pi JSONL); relative paths resolve against the PRK home. */
  historyDir: "sessions" as string,
  /** Hand-written soul/persona layer; "" = none. Relative to the PRK home. */
  soulFile: "" as string,
  workerTools: "code" as ToolMode,
  delegation: "eager" as DelegationLevel,
  localTools: false,
  toolTitle: true,
  capabilities: Object.freeze({}) as CapabilitySwitches,
  idleTimeoutMs: 30 * 60 * 1000,
  /** `ask` tool: after this many ms an unanswered dialog auto-selects each question's recommended option; 0 = wait indefinitely. */
  askTimeoutMs: 0,
  providerRetryGraceMs: 2500,
  idleCheckIntervalMs: 1000,
  recentOperationsMax: 64,
  inboxMaxMessages: 32,
  inboxMaxChars: 131072,
  maxMessageChars: 16384,
  rememberedNoReplyMax: 4096,
  rememberedRepliesMax: 4096,
  noExtensions: true,
  noSkills: false,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
  bootstrapNoSkills: false,
  hostExpandPromptTemplates: true,
  expectReplyForNewMessages: true,
  expectReplyForReplies: false,
  defaultThinkingLevel: "medium" as AgentSession["thinkingLevel"],
  defaultDerivedLifecycle: "temporary" as "temporary" | "persistent",
  defaultSendMode: "auto" as SendMode,
  defaultExportFormat: "jsonl" as "jsonl" | "html",
  errorDetailChars: 8000,
  errorStackLines: 40,
  errorLookbackMessages: 3,
});

export type SessionOptions = {
  readonly [K in keyof typeof DEFAULT_SESSION_OPTIONS]: (typeof DEFAULT_SESSION_OPTIONS)[K] extends number
    ? number : (typeof DEFAULT_SESSION_OPTIONS)[K] extends boolean ? boolean : (typeof DEFAULT_SESSION_OPTIONS)[K];
};

export type ToolTitleSettings = { enabled: boolean };
