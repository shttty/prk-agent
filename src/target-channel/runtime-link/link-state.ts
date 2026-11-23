import type { TargetTransport } from "../process-transport/transport-types.ts";
import type { TargetEvent } from "../channels/channel-types.ts";
import type { ProcessWindow, ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

export type Reply = Record<string, unknown>;
export interface PendingReply { reject(error: Error): void; resolve(reply: Reply): void }
export interface RuntimeLinkContext {
  readonly transport: TargetTransport;
  readonly timeoutMs: number;
  readonly onEvent: (event: TargetEvent) => void;
  readonly onExit: (reason: string) => void;
  readonly handshake: PromiseWithResolvers<void>;
  readonly replies: Map<number, PendingReply>;
  readonly window: ProcessWindow;
  readonly limits: ProcessWindowLimits;
  stage: "ready" | "hello" | "run";
  pending: string;
  nextId: number;
  exited: string | undefined;
  closing: Promise<void> | undefined;
  startTimer: NodeJS.Timeout | undefined;
}
