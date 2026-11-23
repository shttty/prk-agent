import { Value } from "typebox/value";
import { packageSchema } from "./package-protocol.ts";
import type { RemoteExtensionPackage } from "./package-types.ts";

export function parseRemoteExtensionPackage(value: unknown, path = "remote extension"): RemoteExtensionPackage {
  if (!Value.Check(packageSchema, value)) throw new Error(`Invalid ${path}: expected name, version, bundle, node, sha256, platform, extensions and optional location.`);
  const pkg = value as RemoteExtensionPackage;
  if (pkg.extensions.some((entry) => entry.startsWith("/") || entry.split(/[\\/]/u).some((part) => part === ".." || part === ""))) {
    throw new Error(`Invalid ${path}: extension entry paths must remain relative to the bundle.`);
  }
  if (pkg.bundle !== `remote-ext-bundle-${pkg.sha256}` || !/^remote-ext-node-[a-f0-9]{64}$/u.test(pkg.node)) {
    throw new Error(`Invalid ${path}: bundle and Node references must use immutable hash-based artifact names.`);
  }
  return structuredClone(pkg);
}
