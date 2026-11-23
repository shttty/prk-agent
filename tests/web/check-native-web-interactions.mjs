#!/usr/bin/env node
import { openSessionMenu } from "./native-interactions/open-session-menu.mjs";
import { chooseSessionMenuItem } from "./native-interactions/choose-session-menu-item.mjs";
import { openSessionDetails } from "./native-interactions/open-session-details.mjs";
import { waitForIdle } from "./native-interactions/wait-for-idle.mjs";
import { waitForRunning } from "./native-interactions/wait-for-running.mjs";
import { waitForOperationCompletion } from "./native-interactions/wait-for-operation-completion.mjs";
import { sendUi } from "./native-interactions/send-ui.mjs";
import { chooseCommand } from "./native-interactions/choose-command.mjs";
import { chooseReference } from "./native-interactions/choose-reference.mjs";
import { setQueue } from "./native-interactions/set-queue.mjs";
import { selectSession } from "./native-interactions/select-session.mjs";
import { recoverWithNewKernel } from "./native-interactions/recover-with-new-kernel.mjs";
import { checkComposingEnter } from "./native-interactions/check-composing-enter.mjs";
import { checkSettingsAndInput } from "./native-interactions/check-settings-and-input.mjs";
import { checkReferencesAndClone } from "./native-interactions/check-references-and-clone.mjs";
import { checkCancellationAndFork } from "./native-interactions/check-cancellation-and-fork.mjs";
import { checkRerunDraftsAndReconnect } from "./native-interactions/check-rerun-drafts-and-reconnect.mjs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";

const PLAYWRIGHT = process.env.PI_TEST_PLAYWRIGHT;
const CHROMIUM = process.env.PI_TEST_CHROMIUM;
if (!PLAYWRIGHT || !CHROMIUM) throw new Error("Set PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM to run native web acceptance.");
const { chromium } = await import(pathToFileURL(resolve(PLAYWRIGHT)).href);
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function expectVisible(page, selector) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible" });
  assert.equal(await locator.isVisible(), true, `${selector} must be visible`);
}

async function readJsonResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { text }; }
}

// Playwright waitForFunction polls synchronous truthiness: a Promise is truthy even
// when it resolves false. Await HTTP observations before deciding to stop polling.
async function waitForObservation(page, predicate, argument, { timeout }) {
  const deadline = Date.now() + timeout;
  do {
    const value = await page.evaluate(predicate, argument);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error(`Observation did not become true within ${timeout}ms: ${JSON.stringify(argument)}`);
}

const root = await mkdtemp(join(tmpdir(), "pi-native-web-"));
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(agentDir, { recursive: true });
  // Bind every SDK import and its provider lookups to this disposable PRK home.
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxAssistantMessage, fauxProvider, fauxToolCall } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
const ctx = {
  openSessionMenu: (...args) => openSessionMenu(ctx, ...args),
  chooseSessionMenuItem: (...args) => chooseSessionMenuItem(ctx, ...args),
  openSessionDetails: (...args) => openSessionDetails(ctx, ...args),
  waitForIdle: (...args) => waitForIdle(ctx, ...args),
  waitForRunning: (...args) => waitForRunning(ctx, ...args),
  waitForOperationCompletion: (...args) => waitForOperationCompletion(ctx, ...args),
  sendUi: (...args) => sendUi(ctx, ...args),
  chooseCommand: (...args) => chooseCommand(ctx, ...args),
  chooseReference: (...args) => chooseReference(ctx, ...args),
  setQueue: (...args) => setQueue(ctx, ...args),
  selectSession: (...args) => selectSession(ctx, ...args),
  recoverWithNewKernel: (...args) => recoverWithNewKernel(ctx, ...args),
  checkComposingEnter: (...args) => checkComposingEnter(ctx, ...args),
  get CHROMIUM() { return CHROMIUM; },
  get ModelRuntime() { return ModelRuntime; },
  get PNG_1X1() { return PNG_1X1; },
  get agentDir() { return agentDir; },
  get chromium() { return chromium; },
  get config() { return config; },
  get createGatewayHost() { return createGatewayHost; },
  get expectVisible() { return expectVisible; },
  get fauxAssistantMessage() { return fauxAssistantMessage; },
  get fauxProvider() { return fauxProvider; },
  get fauxToolCall() { return fauxToolCall; },
  get onCleanup() { return onCleanup; },
  get readJsonResponse() { return readJsonResponse; },
  get root() { return root; },
  get startGateway() { return startGateway; },
  get startWebApplication() { return startWebApplication; },
  get tempRoot() { return tempRoot; },
  get waitForObservation() { return waitForObservation; },
};
await checkSettingsAndInput(ctx);
await checkReferencesAndClone(ctx);
await checkCancellationAndFork(ctx);
await checkRerunDraftsAndReconnect(ctx);
});
} finally {
  await rm(root, { recursive: true, force: true });
}