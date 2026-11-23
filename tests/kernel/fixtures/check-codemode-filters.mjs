import assert from "node:assert/strict";
import { join } from "node:path";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { startGateway } from "../../../src/gateway/socket-server/start-listener.ts";
import { connectGateway } from "../../../src/gateway/socket-client/connect-client.ts";
import { readCallableNames } from "../../fixtures/gateway-prompt/read-callable-names.mjs";

export async function checkCodemodeFilters({ createHost, home, callbackPackage, otherPackage, run, prompts, text, onCleanup }) {
  let result;
    const filterCases = [
      { name: "deny-tools", policy: { deny: { tools: ["extension_default", "extension_value"] } }, denied: ["extension_default", "extension_value"], allowed: "extension_direct" },
      { name: "allow-tools-deny-wins", policy: { allow: { packages: [callbackPackage, otherPackage], tools: ["extension_direct", "extension_value"] }, deny: { tools: ["extension_value"] } }, denied: ["extension_default", "extension_value", "extension_other", "web_search"], allowed: "extension_direct" },
      { name: "deny-packages", policy: { deny: { packages: [callbackPackage] } }, denied: ["extension_default", "extension_direct", "extension_value"], allowed: "extension_other" },
      { name: "allow-packages", policy: { allow: { packages: [callbackPackage], tools: ["extension_default", "extension_direct", "extension_value", "extension_other", "web_search"] } }, denied: ["extension_other", "web_search"], allowed: "extension_direct" },
    ];
    for (const [index, filter] of filterCases.entries()) {
      const filtered = await createHost(parsePrkConfig({ session: { noExtensions: false }, memory: { review: false }, extensions: filter.policy }), join(home, filter.name));
      const filteredHost = filtered.host;
      const socket = join(home, `f${index}.sock`);
      const filteredEndpoint = await startGateway(filteredHost, socket);
      const filteredClient = await connectGateway(socket);
      onCleanup(async () => { await filteredClient.disconnect(); await filteredEndpoint.close(); });
      const filteredWorker = await filtered.createWorker();
      result = await run(`names = {tool['name'] for tool in gateway.describe()}\nfor name in ${JSON.stringify(filter.denied)}:\n    assert name not in names\n    try:\n        gateway.call(name, {})\n        raise AssertionError('denied tool executed: ' + name)\n    except RuntimeError as error:\n        assert 'Tool ' + name + ' not found' in str(error)\nassert gateway.call('${filter.allowed}', {}) == '${filter.allowed === "extension_other" ? "other" : filter.allowed}-result'\nprint('${filter.name}: GATEWAY_FILTER_OK')`, false, filteredHost, filteredWorker);
      assert.match(text(result), /GATEWAY_FILTER_OK/);
      const listed = readCallableNames(prompts.at(-1));
      for (const name of filter.denied) assert(!listed.includes(name), `${filter.name}: the provider catalog excludes denied ${name}`);
      assert(listed.includes(filter.allowed), `${filter.name}: the provider catalog advertises allowed ${filter.allowed}`);
      for (const name of filter.denied) assert(result.details.callbacks.some((callback) => callback.name === name && callback.status === "error"));
      console.log(text(result));
    }
}
