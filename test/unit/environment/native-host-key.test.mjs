import assert from "node:assert/strict";
import test from "node:test";
import { hashNativeHost } from "../../../src/remote-extensions/bundle/hash-native-host.ts";

// Entries as `npm query` reports them: the key may only follow what is copied into the bundle.
const packages = [
  { location: "node_modules/@earendil-works/pi-coding-agent", version: "1.6.0", resolved: "https://registry.example/pi.tgz", dev: false },
  { location: "node_modules/jiti", version: "2.6.1", integrity: "sha512-a" },
  { location: "node_modules/typebox", version: "1.4.7" },
];
const files = [Buffer.from("export const host = 1;\n")];

test("native host key follows the bundled package set, not lock metadata or query order", () => {
  const key = hashNativeHost(packages, files, "x86_64");
  // An unrelated dependency upgrade changes the lock and npm's metadata, never the bundled location@version set.
  const requeried = [...packages].reverse().map(({ location, version }) => ({ location, version, resolved: "https://mirror.example/x.tgz", integrity: "sha512-b" }));
  assert.equal(hashNativeHost(requeried, files, "x86_64"), key);
  assert.notEqual(hashNativeHost(packages.map((entry) => entry.location === "node_modules/jiti" ? { ...entry, version: "2.6.2" } : entry), files, "x86_64"), key);
  assert.notEqual(hashNativeHost([...packages, { location: "node_modules/jiti/node_modules/pathe", version: "2.0.3" }], files, "x86_64"), key);
  assert.notEqual(hashNativeHost(packages, [Buffer.from("export const host = 2;\n")], "x86_64"), key);
  assert.notEqual(hashNativeHost(packages, files, "aarch64"), key);
});
