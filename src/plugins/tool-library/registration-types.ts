import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { PythonToolClient } from "../../kernel/kernel-types.ts";
import type { ToolLibrary } from "../../codemode/tool-library/assemble-tool-library.ts";

export interface ToolLibraryRegistration {
  refresh(): void;
  dispose(): void;
}

export interface ToolLibraryRegistrationContext {
  readonly pi: ExtensionAPI;
  readonly library: ToolLibrary;
  readonly target: string;
  readonly python: () => PythonToolClient;
  readonly sessionId: () => string;
  readonly allowed: (name: string) => boolean;
  readonly known: Map<string, ToolDefinition>;
  refreshing: boolean;
  readonly refresh: () => void;
  subscriptions: (() => void)[];
}
