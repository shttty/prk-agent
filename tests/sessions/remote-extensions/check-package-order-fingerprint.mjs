import assert from "node:assert/strict";
import { remoteExtensionFingerprint } from "../../../src/remote-extensions/packages/fingerprint-packages.ts";

export function checkPackageOrderFingerprint(packages) {
  const targetPackages = [packages.lsp, packages.capabilities].map(({ source }) => ({ source, enabled: true, location: "host" }));
  const reversedTargetPackages = [...targetPackages].reverse();
  assert.notEqual(remoteExtensionFingerprint(targetPackages), remoteExtensionFingerprint(reversedTargetPackages), "Native package order changes the load-order fingerprint");
  return { targetPackages, reversedTargetPackages };
}
