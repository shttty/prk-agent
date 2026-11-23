// One real Gateway/SDK/faux-provider browser scenario; ids/data hooks only. Full-only.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { parseTargets } from "./target-instances/parse-targets.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-memory-ui-"));
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
async function until(read, check, label) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const { agentDir } = initializePrkHome(root);
    const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
    const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
    const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
    const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
    const { startWebApplication } = await import("../../src/http/application/start-application.ts");
    const { startWebDev } = await import("../fixtures/web-dev.mjs");
    const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "memory-ui", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });
    runtime.registerNativeProvider(provider.provider);
    let reviews = 0;
    provider.setResponses(Array.from({ length: 100 }, () => (context) => {
      const tools = getCurrentTools(context.messages).map((tool) => tool.name);
      const last = context.messages.at(-1);
      if (context.messages.findLastIndex((message) => message.role === "toolResult") > context.messages.findLastIndex((message) => message.role === "assistant")) return fauxAssistantMessage("Saved once.");
      if (tools.length === 1 && tools[0] === "memory") {
        reviews++;
        return fauxAssistantMessage(fauxToolCall("memory", { target: "user", action: "add", content: `Review fact ${reviews}: the fixture user communicates in concise Chinese.` }), { stopReason: "toolUse" });
      }
      const command = /^MEMORY (\{.*\})$/s.exec(text(last));
      if (command) return fauxAssistantMessage(fauxToolCall("memory", JSON.parse(command[1])), { stopReason: "toolUse" });
      return fauxAssistantMessage("Observed the fixture conversation.");
    }));
    // The pre-layer layout under the PRK home: soft control at 60 characters, review after two user turns.
    await mkdir(join(root, "memories"), { recursive: true });
    const layer = (name, file, limit, extra = "") => `[[layers]]\nname = "${name}"\npath = "${join(root, "memories", file)}"\ndescription = "${name} memory"\ncapacityCharacters = ${limit}\nreview = true\n${extra}`;
    await writeFile(join(root, "memories/localmemory.toml"), [
      "[review]\nuserTurns = 2\ntoolCalls = 1000",
      layer("control", "CONTROL.md", 60, "soft = true\nexplicitOnly = true"), layer("user", "USER.md", 1375), layer("memory", "MEMORY.md", 2200), layer("instance", "instances/{instance}.md", 1375),
    ].join("\n"));
    const host = await createGatewayHost({ cwd: root, home: root, model: "memory-ui/controlled", config: parsePrkConfig({ session: { workerTools: "direct", idleTimeoutMs: 60000 } }), targets: parseTargets([
      { id: "fixture", label: "Fixture", tags: [], ...config, cwd: root },
    ]) }, { runtimeDependencies: { cwd: root, agentDir, model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off" } });
    const gateway = await startGateway(host, join(root, "gateway.sock"));
    onCleanup(() => gateway.close());
    const web = await startWebApplication({ socket: join(root, "gateway.sock"), host: "127.0.0.1", port: 0 });
    onCleanup(() => web.close());
    const ui = await startWebDev(web.server.url);
    onCleanup(() => ui.close());
    const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
    const browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, ignoreDefaultArgs: ["--hide-scrollbars"], args: ["--no-sandbox"] });
    onCleanup(() => browser.close());
    const worker = (await host.createSession({ target: "fixture", label: "Memory fixture" })).session.sessionId;
    const readControl = () => readFile(join(root, "memories/CONTROL.md"), "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; });

    for (const [tag, viewport, scheme] of [["desktop-light", { width: 1440, height: 900 }, "light"], ["phone-dark", { width: 390, height: 844 }, "dark"]]) {
      const context = await browser.newContext({ viewport, colorScheme: scheme, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(ui.url);
      const select = async () => {
        if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
        await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
        await page.locator("#composer").waitFor();
      };
      await select();
      const openMemory = async () => {
        if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
        await page.locator("#open-settings").click();
        await page.locator("#open-memory").click();
        await page.locator('#memory-manager[aria-busy="false"]').waitFor();
      };
      const doc = (target) => page.locator(`[data-memory-target="${target}"]`).first();
      const add = async (target, content) => {
        await page.locator(`#memory-tab-${target}`).click();
        await doc(target).locator('[data-action="memory-add"]').click();
        await page.locator("#memory-content").fill(content);
        await page.locator("#memory-save").click();
        await page.locator("#memory-content").waitFor({ state: "detached" });
      };
      await openMemory();
      const initial = `Operator fact ${tag}: prefers brief factual answers.`;
      const replacement = `Operator fact ${tag}: prefers concise Chinese answers.`;
      await add("memory", initial);
      await doc("memory").locator('[data-action="memory-edit"]').first().click();
      await page.locator("#memory-content").fill(replacement);
      await page.locator("#memory-save").click();
      await page.locator("#memory-content").waitFor({ state: "detached" });
      assert.equal(await doc("memory").locator('[data-field="content"]').first().textContent(), replacement);
      assert.equal((await readFile(join(root, "memories/MEMORY.md"), "utf8")).trim(), replacement);
      await doc("memory").locator('[data-action="memory-remove"]').first().click();
      await page.locator("#memory-confirm-delete").click();
      await page.locator("#memory-confirm-delete").waitFor({ state: "detached" });
      assert.equal(await doc("memory").locator("[data-memory-entry]").count(), 0);
      assert.equal((await readFile(join(root, "memories/MEMORY.md"), "utf8")).trim(), "");
      await add("control", `Operator rule ${tag}: ask before destructive changes; retain explicit user authorization boundaries.`);
      assert.equal(await doc("control").locator("[data-over-limit]").getAttribute("data-over-limit"), "true");
      assert.equal(host.state(worker).extensionUi.prompts.length, 0, "operator edits need no dialog");
      // Layer configuration form: a saved capacity reaches the TOML and the document view; a stale save is refused.
      const tomlPath = join(root, "memories/localmemory.toml");
      const capacity = tag === "desktop-light" ? 1400 : 1500;
      await page.locator("#memory-tab-config").click();
      await page.locator('#memory-config[aria-busy="false"]').waitFor();
      const userCapacity = page.locator('#memory-shared-form [data-layer-card][data-name="user"] input[data-field="capacityCharacters"]');
      await userCapacity.fill(String(capacity));
      await page.locator("#memory-config-save").click();
      await until(() => readFile(tomlPath, "utf8"), (text) => text.includes(`capacityCharacters = ${capacity}`), "form save writes the TOML");
      await page.locator("#memory-tab-user").click();
      await until(() => doc("user").locator(".memory-usage").getAttribute("data-limit"), (limit) => limit === String(capacity), "document shows the saved capacity");
      await page.locator("#memory-tab-config").click();
      await page.locator('#memory-config[aria-busy="false"]').waitFor();
      await writeFile(tomlPath, `${await readFile(tomlPath, "utf8")}\n# edited elsewhere ${tag}\n`);
      await userCapacity.fill(String(capacity + 1));
      await page.locator("#memory-config-save").click();
      await page.locator('#memory-config-save-error[data-conflict="true"]').waitFor();
      assert((await readFile(tomlPath, "utf8")).includes(`# edited elsewhere ${tag}`), "a stale save leaves the file alone");
      await page.locator("#memory-config-reload").click();
      await page.locator("#memory-config-save-error").waitFor({ state: "detached" });
      await page.locator("#memory-config-raw-toggle").click();
      assert((await page.locator("#memory-config-raw").textContent()).includes(`# edited elsewhere ${tag}`), "reload shows the current file");
      if (evidence) await page.screenshot({ path: join(evidence, `memory-config-${tag}.png`) });
      await page.locator("#close-settings").click();

      const send = async (message) => {
        const before = host.state(worker).messages.length;
        await page.locator("#composer").fill(message);
        await page.locator("#send-message").click();
        await until(() => host.state(worker), (state) => state.messages.length > before && state.state === "idle", "main reply completed");
      };
      const controlNotices = page.locator('[data-memory-notice="control"]');
      const writeControl = async (operation) => {
        const before = await controlNotices.count();
        await send(`MEMORY ${JSON.stringify(operation)}`);
        await until(() => controlNotices.count(), (count) => count === before + 1, "control notice delivered");
        assert.equal(await page.locator("#chat-error").count(), 0, "model control writes complete without UI errors");
        return controlNotices.last();
      };
      const saved = `Model rule ${tag}: merges require explicit operator approval.`;
      const addedNotice = await writeControl({ target: "control", action: "add", content: saved });
      assert((await readControl()).includes(saved), "model control add writes immediately");
      await addedNotice.locator('[data-action="toggle-note"]').click();
      assert.equal(await addedNotice.locator('[data-memory-change="add"][data-target="control"] [data-side="after"] p').textContent(), saved);
      const controlCount = await controlNotices.count();
      await page.reload();
      await select();
      await until(() => controlNotices.count(), (count) => count === controlCount, "saved control notice survives reload");
      await controlNotices.last().locator('[data-action="toggle-note"]').click();
      assert.equal(await controlNotices.last().locator('[data-memory-change="add"][data-target="control"] [data-side="after"] p').textContent(), saved);
      const beforeReviews = reviews;
      await send("Fixture user prefers concise Chinese answers, independent of task.");
      await send("Please retain that context for future conversations.");
      await until(() => reviews, (value) => value === beforeReviews + 1, "background review");
      const notices = page.locator('[data-memory-notice="review"]');
      await until(() => notices.count(), (count) => count === reviews, "review notice delivered");
      await notices.last().locator('[data-action="toggle-note"]').click();
      await notices.last().locator('[data-memory-change="add"][data-target="user"]').waitFor();
      const revised = `Revised ${saved}`;
      const replacedNotice = await writeControl({ target: "control", action: "replace", old_text: saved, content: revised });
      assert((await readControl()).includes(revised), "model control replace writes immediately");
      await replacedNotice.locator('[data-action="toggle-note"]').click();
      const replacementChange = replacedNotice.locator('[data-memory-change="replace"][data-target="control"]');
      assert.equal(await replacementChange.locator('[data-side="before"] p').textContent(), saved);
      assert.equal(await replacementChange.locator('[data-side="after"] p').textContent(), revised);
      if (tag === "phone-dark" && evidence) await page.screenshot({ path: join(evidence, `memory-${tag}.png`) });
      const removedNotice = await writeControl({ target: "control", action: "remove", old_text: revised });
      assert(!(await readControl()).includes(revised), "model control remove writes immediately");
      await removedNotice.locator('[data-action="toggle-note"]').click();
      assert.equal(await removedNotice.locator('[data-memory-change="remove"][data-target="control"] [data-side="before"] p').textContent(), revised);
      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
      console.log(`PASS memory UI ${tag}: CRUD, operator control, soft limit, immediate control add/replace/remove notices, reload, review notice`);
    }
  });
} finally { await rm(root, { recursive: true, force: true }); }
