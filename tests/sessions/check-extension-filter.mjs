import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ModelRuntime,
  SessionManager,
  createAgentSessionFromServices,
  createAgentSessionServices,
} from "@earendil-works/pi-coding-agent";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { selectExtensionToolNames } from "../../src/config/extensions/select-extension-tool-names.ts";
import { createSessionSettings } from "../../src/sessions/session-settings/create-settings.ts";
import { parseRemoteExtensionPackage } from "../../src/remote-extensions/packages/parse-package.ts";
import { parsePluginPackages } from "../../src/plugins/packages/parse-packages.ts";

const root = await mkdtemp(join(tmpdir(), "prk-role-extension-filter-"));
const cwd = join(root, "project");
const agentDir = join(root, "agent");
const alphaName = "@prk-test/role-filter-alpha";
const betaName = "@prk-test/role-filter-beta";
const alphaSource = `npm:${alphaName}@1.0.0`;
const betaSource = `npm:${betaName}`;
const alphaPath = join(agentDir, "npm", "node_modules", alphaName, "extensions", "index.js");
const betaPath = join(cwd, ".prk", "npm", "node_modules", betaName, "extensions", "index.js");
const sessions = [];
const originalOffline = process.env.PI_OFFLINE;
process.env.PI_OFFLINE = "1";

async function writeFixturePackage(packageDir, name, version, tools, location) {
  await mkdir(join(packageDir, "extensions"), { recursive: true });
  await writeFile(join(packageDir, "package.json"), JSON.stringify({
    name,
    version,
    type: "module",
    pi: { extensions: ["extensions/index.js"], ...(location === undefined ? {} : { location }) },
  }));
  const registrations = tools.map(({ name: toolName, exposure }) => `
    pi.registerTool({
      name: ${JSON.stringify(toolName)},
      label: ${JSON.stringify(toolName)},
      description: "Local extension-filter fixture",
      ${exposure ? `exposure: ${JSON.stringify(exposure)},` : ""}
      parameters: { type: "object", properties: {} },
      execute: async () => ({ content: [{ type: "text", text: "fixture" }], details: undefined }),
    });
  `).join("\n");
  await writeFile(join(packageDir, "extensions", "index.js"), `export default function (pi) { ${registrations} }\n`);
}

async function createServices(filter) {
  return createAgentSessionServices({
    cwd,
    agentDir,
    modelRuntime,
    settingsManager: createSessionSettings(cwd, agentDir, filter),
    resourceLoaderOptions: {
      noExtensions: false,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    },
  });
}

async function createSession(services, filter, { codeModeWorker = false } = {}) {
  const extensionTools = selectExtensionToolNames(
    services.resourceLoader.getExtensions().extensions,
    filter,
    codeModeWorker,
  );
  const ownedTool = {
    name: "prk_owned",
    label: "PRK-owned tool",
    description: "Must not be affected by extension filters",
    parameters: { type: "object", properties: {} },
    execute: async () => ({ content: [{ type: "text", text: "owned" }], details: undefined }),
  };
  const result = await createAgentSessionFromServices({
    services,
    sessionManager: SessionManager.inMemory(cwd),
    tools: [...extensionTools, ownedTool.name],
    customTools: [ownedTool],
  });
  sessions.push(result.session);
  return { session: result.session, extensionTools };
}

let modelRuntime;
try {
  await mkdir(join(cwd, ".prk"), { recursive: true });
  await mkdir(join(agentDir, "npm", "node_modules"), { recursive: true });
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: alphaSource, enabled: true, location: "gateway" }] }));
  await writeFile(join(cwd, ".prk", "settings.json"), JSON.stringify({
    packages: [{ source: betaSource, extensions: ["extensions/index.js"] }],
  }));
  await writeFixturePackage(join(agentDir, "npm", "node_modules", alphaName), alphaName, "1.0.0", [
    { name: "alpha_tool" },
    { name: "alpha_codemode", exposure: "codemode" },
  ]);
  await writeFixturePackage(join(cwd, ".prk", "npm", "node_modules", betaName), betaName, "1.0.0", [
    { name: "beta_tool" },
  ]);
  modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
    allowModelNetwork: false,
  });

  const defaults = parsePrkConfig({});
  assert.deepEqual(defaults.extensions.deny, { packages: [], tools: [] });
  assert.equal(defaults.extensions.allow, undefined);
  assert.throws(() => parsePrkConfig({ extensions: { unknown: true } }), /unsupported/);
  assert.throws(() => parsePrkConfig({ extensions: { deny: { tools: "beta_tool" } } }), /array of non-empty strings/);

  const denyBothPackages = parsePrkConfig({ extensions: {
    deny: { packages: [alphaName, betaName] },
  } });
  const deniedServices = await createServices(denyBothPackages.extensions);
  assert.deepEqual(deniedServices.resourceLoader.getExtensions().extensions.map(({ resolvedPath }) => resolvedPath), [],
    "one filter applies to global and project packages before loading either extension");

  const workerServices = await createServices(defaults.extensions);
  const workerExtensions = workerServices.resourceLoader.getExtensions().extensions;
  assert.deepEqual(workerExtensions.map(({ resolvedPath }) => resolvedPath).sort(), [alphaPath, betaPath].sort(),
    "default sessions load both package sources");
  const { session: defaultWorker, extensionTools } = await createSession(workerServices, defaults.extensions);
  assert.deepEqual(extensionTools.sort(), ["alpha_tool", "beta_tool"]);
  assert.deepEqual(defaultWorker.getActiveToolNames().sort(), ["alpha_tool", "beta_tool", "prk_owned"],
    "extension tools are exposed by default without affecting PRK-owned tools");

  const denyTool = parsePrkConfig({ extensions: {
    deny: { tools: ["beta_tool"] },
  } });
  const deniedToolServices = await createServices(denyTool.extensions);
  const { session: deniedToolWorker, extensionTools: deniedNames } = await createSession(deniedToolServices, denyTool.extensions);
  assert.deepEqual(deniedNames.sort(), ["alpha_tool"]);
  assert.deepEqual(deniedToolWorker.getActiveToolNames().sort(), ["alpha_tool", "prk_owned"]);

  const allowPackages = parsePrkConfig({ extensions: {
    allow: { packages: [alphaName], tools: ["alpha_tool"] },
  } });
  const allowedPackageServices = await createServices(allowPackages.extensions);
  assert.deepEqual(allowedPackageServices.resourceLoader.getExtensions().extensions.map(({ resolvedPath }) => resolvedPath), [alphaPath],
    "allow mode must load only named packages before extension factories run");
  const { session: allowedPackageWorker } = await createSession(allowedPackageServices, allowPackages.extensions);
  assert.deepEqual(allowedPackageWorker.getActiveToolNames().sort(), ["alpha_tool", "prk_owned"]);

  const allowTool = parsePrkConfig({ extensions: {
    allow: { packages: [alphaName, betaName], tools: ["alpha_tool"] },
  } });
  const allowedToolServices = await createServices(allowTool.extensions);
  assert.equal(allowedToolServices.resourceLoader.getExtensions().extensions.length, 2);
  const { session: allowedToolWorker } = await createSession(allowedToolServices, allowTool.extensions);
  assert.deepEqual(allowedToolWorker.getActiveToolNames().sort(), ["alpha_tool", "prk_owned"],
    "allow mode must expose only named extension tools while leaving PRK tools intact");

  const { session: codeModeWorker, extensionTools: codeModeNames } = await createSession(workerServices, defaults.extensions, { codeModeWorker: true });
  assert(codeModeNames.includes("alpha_codemode"));
  assert(codeModeWorker.getCallableToolNames().includes("alpha_tool"),
    "code-mode workers must retain default-direct tools for native nested execution");
  assert(codeModeWorker.getCallableToolNames().includes("alpha_codemode"),
    "code-mode exposure must retain codemode extension tools when not denied");
  const { session: deniedCodeModeWorker } = await createSession(
    workerServices,
    parsePrkConfig({ extensions: { deny: { tools: ["alpha_codemode"] } } }).extensions,
    { codeModeWorker: true },
  );
  assert.equal(deniedCodeModeWorker.getCallableToolNames().includes("alpha_codemode"), false,
    "tool deny must also subtract codemode extension tools");

  const bundleHash = "a".repeat(64);
  const pkg = parseRemoteExtensionPackage({ name: alphaName, version: "1.0.0", bundle: `remote-ext-bundle-${bundleHash}`, node: `remote-ext-node-${"b".repeat(64)}`, sha256: bundleHash, platform: "x86_64", extensions: ["node_modules/fixture/index.js"] });
  for (const location of [[], ["host", "gateway"], "remote", null]) assert.throws(() => parsePluginPackages([{ source: alphaSource, enabled: true, location }]));
  assert.throws(() => parsePrkConfig({ extensions: { locations: { [alphaName]: "target" } } }), /unsupported/);
  assert.throws(() => parseRemoteExtensionPackage({ ...pkg, extensions: ["../escape.js"] }), /relative/);
  assert.throws(() => parseRemoteExtensionPackage({ ...pkg, bundle: "mutable-bundle" }), /immutable/);
  assert.throws(() => parsePrkConfig({ extensions: { defaultRemote: [pkg] } }), /unsupported/);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: alphaSource, enabled: true, location: "host" }] }));
  const targetSettings = createSessionSettings(cwd, agentDir);
  assert.deepEqual(targetSettings.getGlobalSettings().packages[0], { source: alphaSource, extensions: [] }, "Host extensions are excluded from Gateway imports while native non-extension resources remain available");
  await writeFixturePackage(join(agentDir, "npm", "node_modules", alphaName), alphaName, "1.0.0", [{ name: "alpha_tool" }], "target");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: alphaSource, enabled: true, location: "gateway" }] }));
  const declaredSettings = createSessionSettings(cwd, agentDir);
  assert.deepEqual(declaredSettings.getGlobalSettings().packages[0], { source: alphaSource }, "The single explicit placement wins; package metadata does not create another location authority");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: alphaSource, enabled: false, location: "gateway" }] }));
  assert.deepEqual(createSessionSettings(cwd, agentDir).getGlobalSettings().packages, [], "Disabled packages contribute no native resources");
  console.log("PASS: unified package filtering, default direct tools in code workers, tool deny/allow, and native codemode callability");
} finally {
  for (const session of sessions) session.dispose();
  if (originalOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = originalOffline;
  await rm(root, { recursive: true, force: true });
}
