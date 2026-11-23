#!/usr/bin/env node
import { assembleReferenceBrowser } from "./reference-menu/assemble-reference-browser.mjs";
import { checkTargetReferenceMenu } from "./reference-menu/check-target-reference-menu.mjs";
// The composer's @ target-file menu on the real path (Web → Gateway → owned target daemon, controlled model):
// directories open in place (no trailing space, menu stays), files insert with a space and add a reference badge,
// keyboard ↑↓/Tab/Enter/Esc with aria-activedescendant and scroll-follow, Enter never sends while the menu is open,
// /abs steps down, a missing directory and ~/ say why in the menu, Pi's own path list never appears,
// and phone taps work. Asserts only ids / data-* / values, never UI copy.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";

const root = await mkdtemp(join(tmpdir(), "pi-reference-menu-"));
try {
  const { agentDir } = initializePrkHome(root);
  await mkdir(join(agentDir, "extensions"), { recursive: true });
  // One extension command so the composer's Pi autocomplete is live (it is off when there is nothing to complete).
  await writeFile(join(agentDir, "extensions", "ref-probe.js"), `export default function (pi) {
  pi.registerCommand("ref-probe", { description: "reference menu probe", handler: async () => {} });
}\n`);
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxAssistantMessage, fauxProvider } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  const { startWebDev } = await import("../fixtures/web-dev.mjs");

  await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
const ctx = {
  get ModelRuntime() { return ModelRuntime; },
  get agentDir() { return agentDir; },
  get config() { return config; },
  get createGatewayHost() { return createGatewayHost; },
  get fauxAssistantMessage() { return fauxAssistantMessage; },
  get fauxProvider() { return fauxProvider; },
  get onCleanup() { return onCleanup; },
  get parsePrkConfig() { return parsePrkConfig; },
  get root() { return root; },
  get startGateway() { return startGateway; },
  get startWebApplication() { return startWebApplication; },
  get startWebDev() { return startWebDev; },
  get tempRoot() { return tempRoot; },
};
await assembleReferenceBrowser(ctx);
await checkTargetReferenceMenu(ctx);
console.log(`evidence: ${ctx.evidence}`);
});
} finally {
  await rm(root, { recursive: true, force: true });
}
