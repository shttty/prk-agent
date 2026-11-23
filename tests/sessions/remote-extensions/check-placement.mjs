import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

export async function checkExtensionPlacement({ create, call, localCwd, generations, packages, client, configPath, instancesPath, native, host, proof }) {
  const local = await create("local");
  const localIdentity = await call("remote_probe", { action: "identity" }, local);
  assert.notEqual(localIdentity.details.pid, process.pid, "A local instance still owns an independent session host");
  assert.equal(localIdentity.details.cwd, localCwd);
  assert(generations.some((entry) => entry.sessionId === local));
  const configBefore = await readFile(configPath, "utf8");
  const instancesBefore = await readFile(instancesPath, "utf8");
  const source = packages.capabilities.source;
  await client.request("pluginsChange", { source, location: "gateway" });
  await native(local, "reload");
  assert.equal((await call("remote_probe", { action: "identity" }, local)).details.pid, process.pid);
  await host.pluginsChange({ source, location: "host" });
  await native(local, "reload");
  assert.notEqual((await call("remote_probe", { action: "identity" }, local)).details.pid, process.pid);
  assert.equal(await readFile(configPath, "utf8"), configBefore, "Placement belongs only to native packages settings");
  assert.equal(await readFile(instancesPath, "utf8"), instancesBefore, "Placement never writes instance configuration");
  assert.equal((await stat(instancesPath)).mode & 0o777, 0o600);
  proof("unique-package-placement", { source, localPid: localIdentity.details.pid, gatewayPid: process.pid, locations: ["host", "gateway", "host"] });
}
