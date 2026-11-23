import type { RemoteExtensionArtifacts } from "./bundle-types.ts";
import type { RemoteExtensionPackage } from "../packages/package-types.ts";

export const nativeBuilds = new Map<string, Promise<RemoteExtensionArtifacts>>();
export const packageBuilds = new Map<string, Promise<RemoteExtensionPackage>>();
