import { parse, stringify } from "smol-toml";
import assert from "node:assert/strict";
import { chmodSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPrkConfig } from "../../src/config/document/load-prk-config.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { createSessionCollection } from "../../src/sessions/collection/assemble-collection.ts";
import { validateRequest } from "../../src/gateway/wire/validate-request.ts";

const root = await mkdtemp(join(tmpdir(), "prk-instance-storage-"));
const home = join(root, "home");
const parkedHome = join(root, "parked-home");
const configPath = join(home, "config.toml");
const instancesPath = join(home, "instances.toml");
let host;
try {
  await mkdir(home);
  let globalBytes = stringify({ targetCacheRoot: join(root, "cache"), monitor: { enabled: false }, memory: { review: false } });
  await writeFile(configPath, globalBytes);
  assert.deepEqual((await loadPrkConfig(home)).instances, [], "Missing instances.toml means no configured instances");
  for (const document of [null, [], {}, { instances: null }, { instances: {} }, { instances: [], unexpected: true }]) {
    assert.throws(() => parsePrkConfig({}, document), /instance configuration/, "Invalid instance document shape is rejected at the loading boundary");
  }
  const remotePackage = { name: "owned-remote", version: "1.0.0", bundle: `remote-ext-bundle-${"a".repeat(64)}`, node: `remote-ext-node-${"b".repeat(64)}`, sha256: "a".repeat(64), platform: "x86_64", extensions: ["index.js"] };
  const target = { id: "one", label: "Owned instance", local: false, sshCommand: "OWNED_FIXTURE=yes /bin/sh", cwd: home, executionTimeoutMs: 1234, capabilities: { "kernel:bash": false }, customMetrics: [{ name: "fixed", command: "printf 1", interval_s: 1, parse: "number" }] };
  assert.throws(() => parsePrkConfig({}, { instances: [{ ...target, remoteExtensions: [remotePackage] }] }), /instance configuration/, "Removed instance plugin lists are rejected");
  assert.throws(() => parsePrkConfig({ remoteExtensions: [remotePackage] }), /unsupported field/, "Instance remote extensions cannot be placed in global configuration");
  for (const instance of [{ ...target, unexpected: true }, { ...target, python: 42 }, { ...target, sshCommand: 42 }]) {
    assert.throws(() => parsePrkConfig({}, { instances: [instance] }), /instance configuration/, "Instance fields retain their existing strict validation");
  }
  let previewCount = 0;
  let onPreview;
  host = await createGatewayHost({ cwd: home, home, model: "offline/unavailable" }, {
    collectionFactory(...args) {
      const collection = createSessionCollection(...args);
      return {
        ...collection,
        previewTargets(next) {
          collection.previewTargets(next);
          onPreview?.(++previewCount);
        },
      };
    },
  });
  const added = await host.addTarget({ target });
  assert.equal(added.targets[0].id, target.id);
  assert.equal(Object.hasOwn(added.targets[0], "sshCommand"), false);
  assert.equal(added.targets[0].configurationIssue, undefined, "Omitted Python selects a managed runtime, not pending configuration");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Adding an instance never changes global settings");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600, "Instance writes enforce mode 0600");
  const editable = host.getTarget(target.id);
  assert.equal(editable.sshCommand, target.sshCommand, "Editable API retains the original command");
  assert.equal(Object.hasOwn(editable, "token"), false, "Removed token is never projected");
  await host.editTarget({ target: { id: target.id, label: "Edited instance" } });
  const persisted = structuredClone(parse(await readFile(instancesPath, "utf8"))).instances[0];
  assert.equal(persisted.sshCommand, target.sshCommand, "Omitted command retains the saved value");
  assert.deepEqual(persisted.customMetrics, target.customMetrics, "Editing retains other instance fields");
  assert.deepEqual(persisted.capabilities, target.capabilities, "Editing retains instance capabilities");
  assert.equal(Object.hasOwn(persisted, "remoteExtensions"), false, "Instances never store plugin lists");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Editing an instance never changes global settings");
  const beforeInvalid = await readFile(instancesPath, "utf8");
  await assert.rejects(host.editTarget({ target: { id: target.id, python: "relative/python" } }), /absolute executable/);
  assert.equal(await readFile(instancesPath, "utf8"), beforeInvalid, "An invalid interpreter never writes");
  await host.editTarget({ target: { id: target.id, sshCommand: "", python: "/owned/python" } });
  assert.equal(host.getTarget(target.id).configurationIssue.code, "SSH_COMMAND_REQUIRED");
  assert.equal(Object.hasOwn(host.getTarget(target.id), "sshCommand"), false, "Explicit empty PATCH clears the saved command");
  await host.editTarget({ target: { id: target.id, label: "Preserve interpreter" } });
  assert.equal(host.getTarget(target.id).python, "/owned/python", "Omitted interpreter retains the saved value");
  await host.editTarget({ target: { id: target.id, python: "" } });
  const cleared = structuredClone(parse(await readFile(instancesPath, "utf8"))).instances[0];
  assert.equal(Object.hasOwn(cleared, "sshCommand"), false);
  assert.equal(Object.hasOwn(cleared, "python"), false, "Clearing never persists an empty executable or null");
  for (const field of ["sshCommand", "python"]) {
    validateRequest({ v: 1, id: 1, method: "editTarget", params: { target: { id: target.id, [field]: "" } } });
    assert.throws(() => validateRequest({ v: 1, id: 1, method: "addTarget", params: { target: { ...target, [field]: "" } } }), /Invalid v1 request/);
  }

  const instanceBytesBeforePlugins = await readFile(instancesPath, "utf8");
  assert.throws(() => validateRequest({ v: 1, id: 1, method: "remoteExtensionsChange", params: {} }), { code: "UNSUPPORTED_METHOD" });
  assert.throws(() => validateRequest({ v: 1, id: 1, method: "pluginsChange", params: { source: "/owned/plugin", enabled: false, instance: target.id } }), /Invalid v1 request/);
  const source = join(root, "storage-plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/storage", version: "1.0.0", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(source, "index.mjs"), 'export default pi => pi.registerCommand("storage_probe", {handler:async(_args,ctx)=>ctx.ui.notify("storage")});\n');
  await host.pluginsInstall({ source, location: "gateway" });
  await host.pluginsChange({ source, enabled: false });
  assert.deepEqual(JSON.parse(await readFile(join(home, "agent/settings.json"), "utf8")).packages, [{ source, enabled: false, location: "gateway" }]);
  assert.equal((await stat(join(home, "agent/settings.json"))).mode & 0o777, 0o600);
  await host.pluginsUninstall({ source, confirm: true });
  assert.equal(await readFile(instancesPath, "utf8"), instanceBytesBeforePlugins, "Plugin CRUD never writes instance records");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Plugin CRUD never writes the TOML configuration");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600);

  const beforeFailure = await readFile(instancesPath, "utf8");
  const publicBeforeFailure = host.workbench();
  previewCount = 0;
  onPreview = (count) => {
    if (count !== 1) return;
    renameSync(home, parkedHome);
    writeFileSync(home, "not-a-directory");
  };
  try {
    await assert.rejects(host.editTarget({ target: { id: target.id, label: "Staging must fail" } }), /could not be staged/);
  } finally {
    onPreview = undefined;
    unlinkSync(home);
    renameSync(parkedHome, home);
  }
  assert.equal(await readFile(instancesPath, "utf8"), beforeFailure, "Staging failure preserves the complete saved instance document");
  assert.deepEqual(host.workbench(), publicBeforeFailure, "Staging failure preserves the accepted runtime targets");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Staging failure does not touch global settings");

  previewCount = 0;
  onPreview = (count) => {
    if (count !== 2) return;
    const temporary = readdirSync(home).find((name) => name.startsWith("instances.toml.") && name.endsWith(".tmp"));
    assert(temporary, "The candidate is staged before publication");
    unlinkSync(join(home, temporary));
  };
  try {
    await assert.rejects(host.editTarget({ target: { id: target.id, label: "Publication must fail" } }), (error) => error.code === "ENOENT");
  } finally { onPreview = undefined; }
  assert.equal(await readFile(instancesPath, "utf8"), beforeFailure, "Rename failure preserves the complete saved instance document");
  assert.deepEqual(host.workbench(), publicBeforeFailure, "Rename failure preserves accepted runtime targets");
  assert.equal(readdirSync(home).some((name) => name.endsWith(".tmp")), false, "Ordinary failures leave no staging file");

  chmodSync(configPath, 0o600);
  await host.capabilitiesChange({ terminal: { yieldMs: 17 } });
  assert.equal(structuredClone(parse(await readFile(configPath, "utf8"))).terminal.yieldMs, 17, "Global settings save to config.toml");
  assert.equal((await stat(configPath)).mode & 0o777, 0o666 & ~process.umask(), "Global writes use default file permissions instead of fixed 0600");
  assert.equal(await readFile(instancesPath, "utf8"), beforeFailure, "Global settings saves leave instances byte-for-byte unchanged");
  globalBytes = await readFile(configPath, "utf8");
  await host.deleteTarget({ target: target.id, confirm: true });
  assert.deepEqual(structuredClone(parse(await readFile(instancesPath, "utf8"))), { instances: [] }, "Deletion removes every instance field");
  assert.equal(await readFile(configPath, "utf8"), globalBytes, "Deleting an instance leaves global settings unchanged");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600);
  await rm(instancesPath);
  assert.deepEqual((await host.reloadTargets()).targets, [], "Reload treats a missing instance file as an empty instance list");
  console.log("PASS instance storage: strict schema, pending field clearing, permissions, isolated writes, preserved edit semantics, atomic staging/publication failure, and deletion");
} finally {
  try { await host?.close(); }
  finally { await rm(root, { recursive: true, force: true }); }
}
