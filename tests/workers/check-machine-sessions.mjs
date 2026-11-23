import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const playwrightPath = process.env.PI_TEST_PLAYWRIGHT;
const chromiumPath = process.env.PI_TEST_CHROMIUM;
if (!playwrightPath || !chromiumPath) throw new Error("Set PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM to run the instance browser check.");
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)).href);
const webHost = process.env.PI_TEST_WEB_HOST ?? "127.0.0.1";
const evidence = resolve(process.env.PI_TEST_WEB_EVIDENCE ?? ".smart-cascade/control/instance-browser");
await mkdir(evidence, { recursive: true });


await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const root = await mkdtemp(join(tmpdir(), "pi-instance-browser-"));
  const historyDir = join(root, "history");
  const socket = join(root, "gateway.sock");
  await mkdir(historyDir, { recursive: true });
  await Promise.all(Array.from({ length: 14 }, (_, index) => writeFile(join(tempRoot, `chooser-${String(index).padStart(2, "0")}.txt`), `chooser-${index}`)));
  await mkdir(join(tempRoot, "session-one"), { recursive: true });
  await mkdir(join(tempRoot, "session-two"), { recursive: true });
  const target = executionTargetFromConfig({ ...config, id: "fixture", label: "Fixture instance", tags: [], cwd: tempRoot });
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ provider: "instance-browser", models: [{ id: "controlled" }], tokensPerSecond: 5000 });
  runtime.registerNativeProvider(provider.provider);
  const host = await createGatewayHost({ cwd: root, home: root, historyDir, model: "instance-browser/controlled", targets: [target] }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "low", cwd: root, agentDir: root },
  });
  const gateway = await startGateway(host, socket);
  const web = await startWebApplication({ socket, host: webHost, port: 0 });
  const ui = await startWebDev(web.server.url, { host: webHost });
  let browser;
  onCleanup(async () => {
    await browser?.close().catch(() => {});
    await ui.close().catch(() => {});
    await web.close().catch(() => {});
    await gateway.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  });

  browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox"] });
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const page of [desktop, phone]) {
    page.setDefaultTimeout(15_000);
    await page.goto(ui.url);
    if (page === phone) await page.locator("#open-sidebar").click();
    await page.locator('button[data-action="create-session"][data-target="fixture"]').waitFor();
  }

  const create = async (page, { label, cwd } = {}) => {
    const button = page.locator('button[data-action="create-session"][data-target="fixture"]');
    // The dialog reads the instance's own configuration (cwd, connection); there is no kernelspec catalog any more.
    const config = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/targets/fixture" && response.request().method() === "GET");
    await button.click();
    const dialog = page.locator('#management-dialog[data-kind="create"]');
    await config;
    await dialog.locator("#confirm-create-session").waitFor();
    assert.equal(await dialog.locator("#create-session-kernel").count(), 0, "Creation offers no kernelspec choice: the interpreter is the instance's");
    if (label !== undefined) await dialog.locator("#create-session-label").fill(label);
    if (cwd) {
      const browse = page.waitForResponse((response) => response.url().endsWith("/api/targets/browse") && response.request().method() === "POST");
      await dialog.locator("#browse-session-directory").click();
      await browse;
      assert(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), "Directory chooser has no horizontal overflow on mobile");
      if (page === phone) await page.locator("#directory-picker").screenshot({ path: join(evidence, "phone-directory-chooser.png"), animations: "disabled" });
      await dialog.locator(`#directory-picker [data-action="directory-open"][data-path=${JSON.stringify(join(tempRoot, cwd))}]`).click();
      await dialog.locator('#directory-picker [data-action="directory-select"]').click();
      assert.equal(await dialog.locator("#create-session-cwd").inputValue(), join(tempRoot, cwd), "The chosen directory is written as an absolute path");
    }
    const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/sessions") && candidate.request().method() === "POST");
    await dialog.locator("#confirm-create-session").click();
    const result = await response;
    assert.equal(result.status(), 201);
    assert.deepEqual(result.request().postDataJSON(), { target: "fixture", cwd: join(tempRoot, cwd ?? ""), ...(label ? { label } : {}) }, "Creation sends the instance, the chosen absolute cwd and the label only");
    const { session: worker } = await result.json();
    assert.equal(Object.hasOwn(worker, "kernelName"), false, "Sessions carry no kernelspec");
    if (cwd) assert.equal(worker.cwd, join(tempRoot, cwd));
    await page.waitForFunction((workerLabel) => document.querySelector("#topbar-title")?.textContent === workerLabel && document.querySelector("#composer") && !document.querySelector("#composer").disabled, worker.label);
    await dialog.waitFor({ state: "hidden" });
    return worker;
  };

  await create(desktop, { label: "第二个会话", cwd: "session-one" });
  await create(phone, { cwd: "session-two" });

  await phone.locator("#open-sidebar").click();
  await desktop.screenshot({ path: join(evidence, "desktop-instance-chooser.png"), fullPage: true });
  await phone.screenshot({ path: join(evidence, "phone-instance-chooser.png"), fullPage: true });
  console.log("PASS instance browser: desktop/mobile per-instance creation, named/default sessions, no kernelspec choice, directory selection, mobile overflow boundary");
});
