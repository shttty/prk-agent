import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProviderPolicyError } from "../../sessions/model-providers/provider-types.ts";

export interface RemoteExtensionPackage {
  name: string;
  version: string;
  bundle: string;
  node: string;
  sha256: string;
  platform: "x86_64" | "aarch64";
  extensions: string[];
}
type RemoteExtensionToolMetadata = Pick<ToolDefinition, "name" | "description" | "label" | "parameters">;
export interface RemoteExtensionStatus {
  name: string;
  instance: string;
  sessionId?: string;
  location: "local" | "target";
  generation?: string;
  pid?: number;
  commands?: Array<{ name: string; description?: string }>;
  tools?: RemoteExtensionToolMetadata[];
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
  providerErrors?: readonly ProviderPolicyError[];
}
