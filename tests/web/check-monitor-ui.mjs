// Browser layout/interaction checks with the existing mocked API. Real history, custom commands and reloads are
// covered by check-monitor-history-real.mjs against owned Gateway/Jupyter/HTTP/Vite services.
import { startWebDev } from "../fixtures/web-dev.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { createFixture } from "./monitor-ui/fixture/create-fixture.mjs";
import { openWorkbench } from "./monitor-ui/workbench/open-workbench.mjs";
import { runStep } from "./monitor-ui/workbench/run-step.mjs";
import { checkReadings } from "./monitor-ui/check-readings.mjs";
import { checkLayout } from "./monitor-ui/check-layout.mjs";
import { checkStatesAndDiffs } from "./monitor-ui/check-states-and-diffs.mjs";

const fixture = createFixture();
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
const opened = [];
const done = [];

const context = { browser, server, opened, done, fixture };
const checks = {
  ...fixture,
  open: (...args) => openWorkbench(context, ...args),
  step: (...args) => runStep(context, ...args),
};

try {
  await checkReadings(checks);
  await checkLayout(checks);
  await checkStatesAndDiffs(checks);
} finally {
  await browser.close();
  await server.close();
}
console.log(`PASS monitor panel browser suite (${done.length} steps)`);
