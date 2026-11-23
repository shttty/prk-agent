// Repaint each original question/multi/review state in both schemes; submit the shared draft only once per device.
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";

export async function checkAskLayouts(ctx) {
Object.defineProperties(ctx, {
    agentDir: { configurable: true, get: () => agentDir },
    createGatewayHost: { configurable: true, get: () => createGatewayHost },
    startGateway: { configurable: true, get: () => startGateway },
    connectGateway: { configurable: true, get: () => connectGateway },
    startWebApplication: { configurable: true, get: () => startWebApplication },
    startWebDev: { configurable: true, get: () => startWebDev },
    parsePrkConfig: { configurable: true, get: () => parsePrkConfig },
    runtime: { configurable: true, get: () => runtime },
    provider: { configurable: true, get: () => provider },
    contexts: { configurable: true, get: () => contexts },
    shot: { configurable: true, get: () => shot },
    attr: { configurable: true, get: () => attr },
    themeShots: { configurable: true, get: () => themeShots },
    main: { configurable: true, get: () => main },
});

const { agentDir } = initializePrkHome(ctx.root);

const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");

const { fauxProvider, fauxAssistantMessage, fauxToolCall } = await import("@earendil-works/pi-ai");

const { createGatewayHost } = await import("../../../src/gateway/host/start-host.ts");

const { startGateway } = await import("../../../src/gateway/socket-server/start-listener.ts");

const { connectGateway } = await import("../../../src/gateway/socket-client/connect-client.ts");

const { startWebApplication } = await import("../../../src/http/application/start-application.ts");

const { startWebDev } = await import("../../fixtures/web-dev.mjs");

const { parsePrkConfig } = await import("../../../src/config/document/parse-prk-config.ts");

const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });

const provider = fauxProvider({ provider: "ask-ui", models: [{ id: "controlled" }], tokensPerSecond: 10_000 });

runtime.registerNativeProvider(provider.provider);

const contexts = [];

provider.setResponses(Array.from({ length: 300 }, () => async (context) => {
    contexts.push(context);
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") return fauxAssistantMessage("ASK_TURN_DONE");
    const command = /^ASK (\{.*\})$/s.exec(ctx.text(last));
    if (command) return fauxAssistantMessage(fauxToolCall("ask", JSON.parse(command[1])), { stopReason: "toolUse" });
    return fauxAssistantMessage("PLAIN_REPLY");
  }));

const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);

ctx.browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });

const shot = async (page, name) => { if (ctx.evidence) await page.screenshot({ path: join(ctx.evidence, `${name}.png`) }); };

const attr = (page, selector, name) => page.locator(selector).first().getAttribute(name);

const themeShots = async (page, name) => {
    for (const scheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.locator(`html[data-mantine-color-scheme="${scheme}"]`).waitFor();
      await shot(page, name.replace(/-(?:light|dark)(?=-|$)/, `-${scheme}`));
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.locator('html[data-mantine-color-scheme="light"]').waitFor();
  };

const main = await ctx.stack();

for (const [label, viewport, scheme] of [["desktop-light", { width: 1440, height: 900 }, "light"], ["phone-light", { width: 390, height: 844 }, "light"]]) {
    const phone = ctx.isPhone(viewport);
    const { context, page, problems } = await ctx.open(main, viewport, scheme);
    await ctx.ask(page, ctx.QUESTIONS);
    assert.equal(main.prompts().length, 1, `${label}: the Gateway holds one ask dialog`);

    // Tabs: one per question, then the review tab; nothing is answered yet.
    assert.equal(await page.locator("[data-ask-tab-button]").count(), 4, `${label}: question tabs + review`);
    assert.equal(await attr(page, ".pi-ask", "data-ask-tab"), "0");
    assert.deepEqual(await page.locator("[data-ask-tab-button]").evaluateAll((nodes) => nodes.map((node) => node.dataset.answered)), ["false", "false", "false", undefined]);

    // The recommended option is the highlighted row, not an answer, and its preview shows (rendered markdown).
    assert.equal(await attr(page, '[data-ask-option="1"]', "data-recommended"), "true");
    assert.equal(await attr(page, '[data-ask-option="1"]', "data-selected"), "false", `${label}: recommended is not pre-selected`);
    assert.equal(await page.locator('.pi-ask-row[data-active="true"] [data-ask-option]').getAttribute("data-ask-option"), "1");
    await page.locator('[data-ask-preview="1"] pre code').waitFor();
    assert.equal(await page.locator("[data-ask-preview] h2").count(), 1, `${label}: preview is rendered markdown`);
    await themeShots(page, `ask-${label}-1-question`);

    // Clicking selects and moves the highlight (the preview follows it); arrow keys move only the highlight.
    await page.locator('[data-ask-option="0"]').click();
    assert.equal(await attr(page, '[data-ask-option="0"]', "data-selected"), "true");
    assert.equal(await page.locator("[data-ask-preview]").count(), 0, `${label}: an option without preview shows none`);
    if (!phone) {
      await page.keyboard.press("ArrowDown");
      await page.locator('[data-ask-preview="1"]').waitFor();
      assert.equal(await attr(page, '[data-ask-option="1"]', "data-selected"), "false", `${label}: arrows do not select`);
      await page.keyboard.press("Enter"); // single-select: Enter takes the highlighted option and moves on
      await page.locator('.pi-ask[data-ask-tab="1"]').waitFor();
      await page.keyboard.press("Shift+Tab");
      await page.locator('.pi-ask[data-ask-tab="0"]').waitFor();
      assert.equal(await attr(page, '[data-ask-option="1"]', "data-selected"), "true", `${label}: the keyboard answer is kept`);
    } else {
      await page.locator('[data-ask-option="2"]').click();
    }
    assert.equal(await attr(page, '[data-ask-tab-button="0"]', "data-answered"), "true");

    // Multi-select with a note on an option and an "other" answer. The fields take text only: no file input anywhere on the card.
    await page.locator('[data-action="ask-next"]').click();
    await page.locator('.pi-ask[data-ask-tab="1"]').waitFor();
    await page.locator('[data-ask-option="0"]').click();
    await page.locator('[data-ask-option="2"]').click();
    await page.locator('[data-action="ask-note"][data-option="2"]').click();
    await page.locator('[data-ask-field="note"] textarea').fill("only for mobile");
    assert.equal(await attr(page, '[data-action="ask-note"][data-option="2"]', "data-has-note"), "true");
    await page.locator('[data-ask-option="other"]').click();
    await page.locator('[data-ask-field="custom"] textarea').fill("Audit log");
    assert.equal(await page.locator('.pi-ask input[type="file"]').count(), 0, `${label}: the card takes no files`);
    await themeShots(page, `ask-${label}-2-multi`);

    // Review: every question with its current answer; the unanswered one is marked; Submit stays available.
    await page.locator('[data-ask-tab-button="review"]').click();
    await page.locator('.pi-ask[data-ask-tab="review"]').waitFor();
    assert.deepEqual(await page.locator("[data-ask-review]").evaluateAll((nodes) => nodes.map((node) => node.dataset.answered)), ["true", "true", "false"]);
    assert.equal(await attr(page, ".pi-ask-review", "data-ask-unanswered"), "1");
    await themeShots(page, `ask-${label}-3-review`);
    // Going back keeps what was entered.
    await page.locator('[data-ask-review="1"]').click();
    assert.equal(await attr(page, '[data-ask-option="0"]', "data-selected"), "true");
    assert.equal(await page.locator('[data-ask-field="custom"] textarea').count(), 0, `${label}: editors start closed on return`);
    await page.locator('[data-ask-option="other"]').click();
    assert.equal(await page.locator('[data-ask-field="custom"] textarea').inputValue(), "Audit log");
    await page.locator('[data-ask-tab-button="review"]').click();

    await page.locator('[data-action="ask-submit"]').click();
    await page.locator(".pi-ask").waitFor({ state: "detached" });
    const result = await main.toolResult();
    assert.equal(ctx.text(result), `User answers:\nstorage: ${phone ? "DuckDB" : "Postgres"}\nfeatures: [Search, Sync] + "Audit log" (note: only for mobile)\nrollout: (no answer)`, `${label}: the model sees the answers`);
    assert.deepEqual(result.content.map((part) => part.type), ["text"], `${label}: nothing but text reaches the model`);
    assert.deepEqual(problems, [], `${label}: page errors`);
    await context.close();
    for (const scheme of ["light", "dark"]) console.log(`PASS ${label.replace("-light", `-${scheme}`)}: tabs, recommended highlight + preview, single/multi, note, other, review, submit (shared device turn)`);
  }

}
