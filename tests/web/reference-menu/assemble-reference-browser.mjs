// The session cwd sits two levels below the fixture directory, which holds a decoy file at the same relative spelling.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseTargets } from "../target-instances/parse-targets.mjs";
import { loadChromium } from "../../fixtures/workspace-mock/load-chromium.mjs";

export async function assembleReferenceBrowser(ctx) {
Object.defineProperties(ctx, {
    cwd: { configurable: true, get: () => cwd },
    targetPath: { configurable: true, get: () => targetPath },
    evidence: { configurable: true, get: () => evidence },
    ui: { configurable: true, get: () => ui, set: (value) => { ui = value; } },
    browser: { configurable: true, get: () => browser, set: (value) => { browser = value; } },
    receivedInput: { configurable: true, get: () => receivedInput, set: (value) => { receivedInput = value; } },
    sessionId: { configurable: true, get: () => sessionId },
});

assert.ok(ctx.tempRoot, "owned target fixture");

const cwd = join(ctx.tempRoot, "home", "u", "proj");

// Candidates name absolute target paths.
const targetPath = (path) => join(cwd, path);

await mkdir(join(cwd, "deep", "level1", "level2"), { recursive: true });

await writeFile(join(cwd, "deep", "level1", "level2", "leaf.txt"), "LEAF\n");

await mkdir(join(cwd, "folder"));

await writeFile(join(cwd, "folder", "note.txt"), "CWD_NOTE_62419\n");

await mkdir(join(ctx.tempRoot, "folder"));

await writeFile(join(ctx.tempRoot, "folder", "note.txt"), "ROOT_DECOY_73820\n");

await writeFile(join(ctx.tempRoot, "home", "u", "sibling.txt"), "SIBLING\n");

await mkdir(join(cwd, "many"));

for (let index = 0; index < 30; index++) await writeFile(join(cwd, "many", `f${String(index).padStart(2, "0")}.txt`), "x\n");

const evidence = process.env.PI_TEST_WEB_EVIDENCE ? resolve(process.env.PI_TEST_WEB_EVIDENCE) : await mkdtemp(join(tmpdir(), "pi-reference-menu-evidence-"));

await mkdir(evidence, { recursive: true });

let host, gateway, web, ui, browser;

ctx.onCleanup(async () => {
      await Promise.allSettled([browser?.close()]);
      await Promise.allSettled([ui?.close(), web?.close(), gateway?.close()]);
      await host?.close();
    });

const runtime = await ctx.ModelRuntime.create({ authPath: join(ctx.agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });

const faux = ctx.fauxProvider({ provider: "reference-menu-controlled", models: [{ id: "controlled" }], tokensPerSecond: 10000 });

runtime.registerNativeProvider(faux.provider);

let receivedInput;

faux.setResponses(Array.from({ length: 20 }, () => (context) => {
      const content = context.messages.filter((message) => message.role === "user").at(-1)?.content;
      receivedInput = typeof content === "string" ? content : content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      return ctx.fauxAssistantMessage("REFERENCE_MENU_REPLY");
    }));

host = await ctx.createGatewayHost({
      cwd: ctx.root, home: ctx.root, historyDir: join(ctx.root, "history"), model: "reference-menu-controlled/controlled", thinkingLevel: "off",
      config: ctx.parsePrkConfig({ session: { noExtensions: false, workerTools: "direct" } }),
      targets: parseTargets([{ id: "fixture", label: "Reference fixture", tags: [], ...ctx.config, cwd }]),
    }, { runtimeDependencies: { model: faux.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: ctx.root, agentDir: ctx.agentDir } });

const socket = join(ctx.root, "g.sock");

gateway = await ctx.startGateway(host, socket);

web = await ctx.startWebApplication({ socket, host: "127.0.0.1", port: 0 });

ui = await ctx.startWebDev(web.server.url);

browser = await loadChromium();

const created = await fetch(`${web.server.url}/api/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: web.server.url },
      body: JSON.stringify({ target: "fixture", label: "Reference worker" }),
    });

assert.equal(created.status, 201);

const sessionId = (await created.json()).name;

}
