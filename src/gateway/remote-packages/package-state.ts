import type { PrkConfig } from "../../config/document/document-types.ts";
import type { RemoteExtensionStatus } from "../../remote-extensions/packages/package-types.ts";

export interface PackageState {
  extensionConfig: PrkConfig["extensions"];
  pluginWarnings: Map<string, Set<string>>;
  pluginFailures: Map<string, string>;
  remoteStatuses: Map<string, RemoteExtensionStatus[]>;
  remoteCatalogStatuses: Map<string, RemoteExtensionStatus[]>;
}
