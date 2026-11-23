import { randomUUID } from "node:crypto";
import { processStreamId } from "./host-stream-state.ts";

export function createSessionStreamId(): string {
  return `${processStreamId}:${randomUUID()}`;
}
