import assert from "node:assert/strict";
import { test } from "node:test";
import { remoteExtensionFingerprint } from "../../../../src/remote-extensions/packages/fingerprint-packages.ts";

const first = Object.freeze({
  name: "first", source: "/owned/first", enabled: true, location: "host", agentDir: "/owned/agent", installedPath: "/owned/first",
  extensions: Object.freeze(["first.mjs", "second.mjs"]),
});
const second = Object.freeze({ ...first, name: "second" });

test("package reordering changes fingerprint", () => {
  assert.notEqual(remoteExtensionFingerprint([first, second], {}), remoteExtensionFingerprint([second, first], {}));
});

test("package location changes affect the fingerprint", () => {
  assert.notEqual(remoteExtensionFingerprint([first], {}), remoteExtensionFingerprint([{ ...first, location: "gateway" }], {}));
});

test("remoteExtensionFingerprint changes for every package load input", () => {
  const baseline = remoteExtensionFingerprint([first], {});
  for (const change of [
    { name: "renamed" }, { source: "npm:other" }, { enabled: false }, { agentDir: "/other/agent" },
    { installedPath: "/other/first" }, { extensions: ["second.mjs", "first.mjs"] }, { location: "gateway" },
  ]) assert.notEqual(remoteExtensionFingerprint([{ ...first, ...change }], {}), baseline, JSON.stringify(change));
});


test("remoteExtensionFingerprint is stable without mutating package or priority order", () => {
  const packages = Object.freeze([first, second]);
  const value = remoteExtensionFingerprint(packages, {});
  assert.equal(remoteExtensionFingerprint(packages, {}), value);
  assert.deepEqual(packages.map(({ name }) => name), ["first", "second"]);
  assert.deepEqual(first.extensions, ["first.mjs", "second.mjs"]);
});
