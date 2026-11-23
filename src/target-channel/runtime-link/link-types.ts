import type { Reply } from "./link-state.ts";

export interface RuntimeLink {
  start(command: string, signal: AbortSignal): Promise<void>;
  request(mod: string, op: string, args?: Record<string, unknown>, signal?: AbortSignal): Promise<Reply>;
  close(): Promise<void>;
}
