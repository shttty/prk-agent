import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { parse as parseDisposition } from "content-disposition";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openSession } from "../web/request-trim/launch-request-workbench.mjs";
import { prepareGatewayEnvironment } from "../fixtures/prepare-gateway-environment.mjs";

const size = 20 * 1024 ** 2;
await withTargetFixture(async ({ config: local, tempRoot: cwd }) => {
  const home = await mkdtemp(join(tmpdir(), "prk-file-download-"));
  let host, gateway, client, web;
  try {
    const { agentDir } = initializePrkHome(home);
    await mkdir(agentDir, { recursive: true });
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "download-test", models: [{ id: "controlled" }] });
    modelRuntime.registerNativeProvider(provider.provider);
    const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, workspace: { fileDownloadBytes: size, fileRequestsMax: 1 } }, { instances: [
      { ...local, id: "local", label: "Local" },
      { id: "remote", label: "Remote (loopback command)", cwd, local: false, sshCommand: "exec /bin/sh", python: local.python },
    ] });
    host = await createGatewayHost({ home, cwd, config, model: "download-test/controlled", historyDir: join(home, "history") },
      { runtimeDependencies: { cwd, agentDir, model: provider.getModel(), modelRuntime, thinkingLevel: "off" } });
    const socket = join(home, "g.sock");
    gateway = await startGateway(host, socket);
    client = await connectGateway(socket);
    web = await startWebApplication({ home, socket, host: "127.0.0.1", port: 0 });
    const name = "构建 (测试).tar.gz";
    const path = join(cwd, name);
    const bytes = randomBytes(size);
    await writeFile(path, bytes);
    for (const target of ["local", "remote"]) {
      await prepareGatewayEnvironment(host, home, target, { prepareArtifacts: target === "local" });
      const { session } = await client.request("createSession", { target });
      const base = `${web.server.url}/api/sessions/${encodeURIComponent(session.sessionId)}/files`;
      const download = (source = path, expected = target, origin = web.server.url) => fetch(`${base}/download`, {
        method: "POST", body: new URLSearchParams({ target: expected, path: source }), headers: { Origin: origin }, signal: AbortSignal.timeout(25000),
      });
      const preview = await fetch(`${base}/read`, { method: "POST", headers: { Origin: web.server.url, "Content-Type": "application/json" }, body: JSON.stringify({ target, path, format: "base64" }) });
      assert.equal(preview.status, 413);
      assert.equal((await preview.json()).code, "TOO_LARGE");
      const response = await download();
      assert.equal(response.status, 200, response.ok ? undefined : await response.text());
      assert.equal(response.headers.get("content-length"), String(size));
      assert.equal(response.headers.get("content-type"), "application/gzip");
      const disposition = parseDisposition(response.headers.get("content-disposition"));
      assert.equal(disposition.type, "attachment");
      assert.equal(disposition.parameters.filename, name);
      assert(Buffer.from(await response.arrayBuffer()).equals(bytes), `${target}: all 20 MiB must match`);
      if (target !== "local") continue;

      const mismatch = await download(path, "remote");
      assert.equal(mismatch.status, 400);
      assert.equal((await mismatch.json()).details.reason, "target-mismatch");
      const foreign = await download(path, target, "http://invalid.example");
      assert.equal(foreign.status, 403);
      await foreign.json();
      const invalid = await download(`${cwd}/../outside`);
      assert.equal(invalid.status, 400);
      await invalid.json();
      const empty = join(cwd, "empty.bin");
      await writeFile(empty, "");
      const zero = await download(empty);
      assert.equal(zero.status, 200);
      assert.equal(zero.headers.get("content-length"), "0");
      assert.equal((await zero.arrayBuffer()).byteLength, 0);
      const changing = join(cwd, "changing.bin");
      await writeFile(changing, "");
      await truncate(changing, size + 1);
      const oversized = await download(changing);
      assert.equal(oversized.status, 413);
      const issue = await oversized.json();
      assert.equal(issue.code, "TOO_LARGE");
      assert.match(issue.error, /download limit/u);
      await truncate(changing, size);
      const interrupted = await download(changing);
      assert.equal(interrupted.status, 200);
      assert.equal(interrupted.headers.get("content-length"), String(size));
      const reader = interrupted.body.getReader();
      assert((await reader.read()).value?.byteLength > 0, "The client really received a prefix before truncation");
      await truncate(changing, 0);
      await assert.rejects(async () => {
        while (!(await reader.read()).done) { /* drain buffered prefix */ }
      }, (error) => error.cause?.code === "UND_ERR_SOCKET");
      const afterFailure = await download(empty);
      assert.equal(afterFailure.status, 200, "Failure frees the only file-operation slot");
      await afterFailure.arrayBuffer();
      await checkBrowserDownload(web.server.url, session.sessionId, path, name, bytes);
    }
    console.log("PASS 20 MiB matches on local and loopback remote connection; preview and download caps, routing, Origin, attachment headers, zero bytes, mid-stream EOF and capacity release; Chromium menu downloads exact bytes");
  } finally {
    client?.disconnect();
    await web?.close();
    if (gateway) await gateway.close(); else await host?.close();
    await rm(home, { recursive: true, force: true });
  }
});

async function checkBrowserDownload(api, sessionId, path, name, expected) {
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  const ui = await startWebDev(api);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.setDefaultTimeout(15_000);
    await openSession(page, ui.url, sessionId);
    const workspace = page.locator("#toggle-workspace");
    if (await workspace.getAttribute("aria-expanded") !== "true") await workspace.click();
    const tree = page.locator("#toggle-tree");
    if (await tree.isVisible() && await tree.getAttribute("aria-pressed") !== "true") await tree.click();
    await page.locator(`#files-panel li[data-path="${path}"] .pi-files-line`).click({ button: "right" });
    const event = page.waitForEvent("download");
    await page.locator('[data-action="download"]').click();
    const file = await event;
    assert.equal(file.suggestedFilename(), name);
    assert.equal(await file.failure(), null);
    assert((await readFile(await file.path())).equals(expected), "Chromium saved all 20 MiB from the native form");
  } finally {
    await browser?.close();
    await ui.close();
  }
}
