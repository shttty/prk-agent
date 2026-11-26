import assert from "node:assert/strict";
import test from "node:test";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { denyExtensionPackages } from "../../../src/config/extensions/deny-extension-packages.ts";
import { capabilityId } from "../../../src/config/capabilities/validate-capability-id.ts";
import { createProviderBootstrap } from "../../../src/gateway/models/create-provider-bootstrap.ts";
import { entryPackageSource } from "../../../src/plugins/package-load/find-entry-package.ts";
import { listLoadablePackages } from "../../../src/plugins/package-load/list-loadable-packages.ts";
import { packageLoadId } from "../../../src/plugins/package-load/package-load-id.ts";
import { attachPackageLoad } from "../../../src/plugins/package-load/attach-package-load.ts";
import { unloadedPackageSources } from "../../../src/plugins/package-load/unloaded-package-sources.ts";
import { validatePackageLoadChange } from "../../../src/plugins/package-load/validate-package-load-change.ts";
import { unloadedPackages } from "../../../src/sessions/runtime/capabilities/read-unloaded-packages.ts";
import { createSessionSettings } from "../../../src/sessions/session-settings/create-settings.ts";

const installed = (source, name, enabled = true) => ({ source, name, enabled, location: "gateway" });
const recall = installed("/pkg/recall", "recall");
const tools = installed("npm:@scope/tools@1.2.0", "@scope/tools");
const registered = createProviderBootstrap([]);
registered.providerPolicy({ providerId: "relay", operation: "register", source: "/pkg/relay", extensionPath: "/pkg/relay/index.js" });
const packages = listLoadablePackages([recall, tools, installed("/pkg/relay", "relay"), installed("/pkg/off", "off", false)], registered.modelProviders);

test("a load switch is a capability id with the usual layer order", () => {
  assert.equal(capabilityId(packageLoadId("npm:@scope/tools@1.2.0")), true);
  assert.equal(capabilityId("load:package:"), false);
  const [session, instance, global] = [{}, {}, {}];
  assert.deepEqual(unloadedPackageSources(packages, [session, instance, global]), []);
  global[packageLoadId(recall.source)] = false;
  assert.deepEqual(unloadedPackageSources(packages, [session, instance, global]), [recall.source], "the global default applies");
  instance[packageLoadId(recall.source)] = true;
  assert.deepEqual(unloadedPackageSources(packages, [session, instance, global]), [], "an instance beats the default");
  session[packageLoadId(recall.source)] = false;
  instance[packageLoadId(tools.source)] = false;
  assert.deepEqual(unloadedPackageSources(packages, [session, instance, global]), [recall.source, tools.source], "a session beats its instance");
});

test("projecting the layers reports where a package's switch stands", () => {
  const catalog = { entries: [], groups: [{ id: "group:tools:package:recall" }, { id: "group:tools:local" }], localTools: true, requiresReload: false };
  const attached = attachPackageLoad(catalog, packages, [{ [packageLoadId(tools.source)]: false }, { [packageLoadId(recall.source)]: false }]);
  assert.deepEqual(attached.groups, [{ id: "group:tools:package:recall", package: recall.source }, { id: "group:tools:local" }], "a group names its package");
  const view = attached.packages;
  assert.deepEqual(view.map(({ source, load }) => [source, load.enabled, load.defaultEnabled, load.overridden]), [
    [recall.source, false, false, false], [tools.source, false, true, true], ["/pkg/relay", true, true, false],
  ]);
  assert.equal(view.some(({ source }) => source === "/pkg/off"), false, "a package disabled in plugin settings has no load switch");
});

test("a provider package refuses its load switch off, and the refusal names the providers", () => {
  const relay = packages.find(({ name }) => name === "relay");
  assert.deepEqual(relay.providerIds, ["relay"]);
  assert.throws(() => validatePackageLoadChange(packages, { id: packageLoadId(relay.source), enabled: false }),
    (error) => error.code === "PROVIDER_POLICY" && error.details.providerErrors[0].providerId === "relay" && /whole Gateway/.test(error.message));
  validatePackageLoadChange(packages, { id: packageLoadId(relay.source), enabled: true });
  validatePackageLoadChange(packages, { id: packageLoadId(relay.source), enabled: null });
  validatePackageLoadChange(packages, { id: packageLoadId(recall.source), enabled: false });
});

test("an unknown package is refused unless the change only resets its switch", () => {
  const id = packageLoadId("/pkg/gone");
  assert.throws(() => validatePackageLoadChange(packages, { id, enabled: false }), (error) => error.code === "NOT_FOUND");
  validatePackageLoadChange(packages, { id, enabled: null });
});

test("catalog groups of a package resolve to its settings source", () => {
  assert.equal(entryPackageSource("group:tools:package:recall", packages), recall.source);
  assert.equal(entryPackageSource("group:skills:package:@scope/tools", packages), tools.source);
  assert.equal(entryPackageSource("group:tools:remote:office:/pkg/recall", packages), recall.source);
  assert.equal(entryPackageSource("group:tools:package:<inline:sessions>", packages), undefined);
  assert.equal(entryPackageSource("group:tools:mcp:docs", packages), undefined);
});

test("denying a package removes it from the settings Pi's loader resolves, and nothing else", () => {
  const source = SettingsManager.inMemory({ packages: [{ source: recall.source, enabled: true, location: "gateway" }, { source: tools.source, enabled: true, location: "gateway" }] });
  const filter = denyExtensionPackages({ deny: { packages: ["/pkg/other"], tools: ["blocked"] } }, [recall.source]);
  assert.deepEqual(filter, { deny: { packages: ["/pkg/other", recall.source], tools: ["blocked"] } });
  assert.equal(denyExtensionPackages(undefined, []), undefined);
  const settings = createSessionSettings("/work", "/agent", filter, source);
  assert.deepEqual(settings.getGlobalSettings().packages.map((pkg) => pkg.source), [tools.source]);
  const unfiltered = createSessionSettings("/work", "/agent", undefined, source);
  assert.deepEqual(unfiltered.getGlobalSettings().packages.map((pkg) => pkg.source), [recall.source, tools.source]);
});

test("a stored layer that switches a provider package off is refused when the session loads, not ignored", () => {
  const session = (layers, overrides = {}) => ({ target: { id: "box" }, capabilityOverrides: overrides, dependencies: {
    modelProviders: registered.modelProviders, capabilityLayers: () => layers,
    remoteExtensions: () => ({ packages: [recall, tools, installed("/pkg/relay", "relay")] }),
  } });
  assert.deepEqual(unloadedPackages(session([{ [packageLoadId(recall.source)]: false }])), [recall.source]);
  for (const [layers, overrides] of [[[{ [packageLoadId("/pkg/relay")]: false }], {}], [[{}], { [packageLoadId("/pkg/relay")]: false }]]) {
    assert.throws(() => unloadedPackages(session(layers, overrides)), (error) => error.code === "PROVIDER_POLICY" && error.details.providerErrors[0].providerId === "relay");
  }
});
