import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { PROJECT_TYPE } from "../history-protocol.ts";

export function writeProject(manager: SessionManager, project: { readonly id: string; readonly name: string } | null): void {
  manager.appendCustomEntry(PROJECT_TYPE, { version: 1, project });
}
