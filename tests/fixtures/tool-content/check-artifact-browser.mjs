import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function until(read, check, label) {
  const deadline = Date.now() + 30000;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
export async function checkArtifactBrowser({ browser, ui, host, sessionId: worker, arch, scripts, hashes, imported, home, web, evidence, sha, text }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(ui.url);
  await page.locator(`[data-session-id="${worker}"] .management-session-select`).click();
  const open = async () => {
    if (await page.locator("#open-sidebar").isVisible()) await page.locator("#open-sidebar").click();
    await page.locator("#open-settings").click();
    await page.locator("#open-artifacts").click();
    await page.locator('#artifacts-manager[aria-busy="false"]').waitFor();
  };
  const upload = async (version, script, platform = arch) => {
    await page.locator("#artifacts-open-upload").click();
    await page.locator("#artifact-name").fill("probe");
    await page.locator("#artifact-version").fill(version);
    await page.locator("#artifact-platform").selectOption(platform);
    await page.locator('#artifacts-upload-form input[type="file"]').setInputFiles({ name: "probe", mimeType: "application/octet-stream", buffer: Buffer.from(script) });
    await page.locator("#artifact-sha256").fill(sha(script));
    await page.locator("#artifacts-upload").click();
    await page.locator("#artifacts-upload-form").waitFor({ state: "detached" });
    await page.locator(`[data-artifact-tool="probe"] [data-artifact-version="${version}"] [data-artifact-platform="${platform}"]`).waitFor();
  };
  const kernel = async (name, expected, output) => {
    await page.locator("#close-settings").click();
    const before = host.state(worker).messages.length;
    const code = `import hashlib, pathlib, subprocess\np = pathlib.Path(tool_bin(${JSON.stringify(name)}))\nactual = hashlib.sha256(p.read_bytes()).hexdigest()\nassert actual == ${JSON.stringify(expected)}, actual\nassert subprocess.check_output([str(p)], text=True) == ${JSON.stringify(output)}\nprint('ARTIFACT_SHA256=' + actual)`;
    await page.locator("#composer").fill(code);
    await page.locator("#send-message").click();
    const state = await until(() => host.state(worker), (state) => state.state === "idle" && state.messages.length > before && state.messages.slice(before).some((message) => message.role === "toolResult"), "real target tool_bin");
    const result = state.messages.slice(before).findLast((message) => message.role === "toolResult");
    assert.equal(result.isError, false, text(result));
    assert(text(result).includes(`ARTIFACT_SHA256=${expected}`), text(result));
    console.log(`TARGET ${name} ${expected}`);
    await open();
  };
  const call = async (path, body, extra = {}) => {
    const response = await fetch(`${web.server.url}/api/artifacts${path}`, { method: "POST", headers: { Origin: web.server.url, "Content-Type": "application/json", ...extra.headers }, body: typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body), ...extra, signal: AbortSignal.timeout(10000) });
    const payload = await response.json();
    return { status: response.status, payload };
  };
  await open();
  await kernel("legacyprobe", sha(imported), "legacy-artifact");
  await upload("1.0.0", scripts[0]);
  await upload("2.0.0", scripts[1]);
  assert.equal(await page.locator('[data-artifact-tool="probe"]').getAttribute("data-current"), "1.0.0");
  await kernel("probe", hashes[0], "artifact-one");
  await page.locator('[data-artifact-tool="probe"] [data-action="artifact-current"]').selectOption("2.0.0");
  await page.locator('[data-artifact-tool="probe"][data-current="2.0.0"]').waitFor();
  await kernel("probe", hashes[1], "artifact-two");
  await page.locator('[data-artifact-tool="probe"] [data-action="artifact-current"]').selectOption("1.0.0");
  await page.locator('[data-artifact-tool="probe"][data-current="1.0.0"]').waitFor();
  await kernel("probe", hashes[0], "artifact-one");
  const snapshot = await readFile(join(home, "assets/manifest.json"), "utf8");
  const blobs = await readdir(join(home, "assets/store"));
  const raw = { headers: { Origin: web.server.url, "Content-Type": "application/octet-stream" } };
  assert.equal((await call(`/upload?name=probe&version=bad-hash&platform=${arch}&sha256=${"0".repeat(64)}`, scripts[1], raw)).status, 400);
  assert.equal((await call("/upload?name=probe&version=bad-platform&platform=ppc64", scripts[1], raw)).status, 400);
  assert.equal((await call(`/upload?name=../probe&version=bad-name&platform=${arch}`, scripts[1], raw)).status, 400);
  assert.equal((await call(`/upload?name=probe&version=bad%2Fversion&platform=${arch}`, scripts[1], raw)).status, 400);
  assert.equal((await call(`/upload?name=probe&version=oversize&platform=${arch}`, Buffer.alloc(1025), raw)).status, 413);
  const chunked = (async function* () { yield Buffer.alloc(600); yield Buffer.alloc(600); })();
  assert.equal((await call(`/upload?name=probe&version=chunked&platform=${arch}`, chunked, { ...raw, body: chunked, duplex: "half" })).status, 413);
  assert.equal((await call(`/upload?name=probe&version=1.0.0&platform=${arch}`, scripts[1], raw)).status, 409);
  assert.equal((await call("/delete", { name: "probe", version: "1.0.0" })).status, 409);
  assert.equal(await readFile(join(home, "assets/manifest.json"), "utf8"), snapshot, "Rejected operations preserve manifest");
  assert.deepEqual(await readdir(join(home, "assets/store")), blobs, "Rejected uploads leave no orphan files");
  // Shared content must survive another version's deletion.
  assert.equal((await call(`/upload?name=shared&version=1.0.0&platform=${arch}`, scripts[1], raw)).status, 200);
  const version = page.locator('[data-artifact-tool="probe"] [data-artifact-version="2.0.0"]');
  await version.locator('[data-action="artifact-delete"]').click();
  await page.locator("#artifacts-confirm-delete").click();
  await page.locator("#artifacts-delete-dialog").waitFor({ state: "hidden" });
  await version.waitFor({ state: "detached" });
  assert.equal(await readFile(join(home, "assets/store", hashes[1]), "utf8"), scripts[1], "Shared blob stays referenced");
  assert.equal((await call(`/upload?name=shared&version=2.0.0&platform=${arch}`, scripts[0], raw)).status, 200);
  assert.equal((await call("/current", { name: "shared", version: "2.0.0" })).status, 200);
  assert.equal((await call("/delete", { name: "shared", version: "1.0.0" })).status, 200);
  await assert.rejects(readFile(join(home, "assets/store", hashes[1])), { code: "ENOENT" }, "Last reference deletion removes orphan blob");
  await upload("2.0.0", scripts[1]);
  await upload("1.0.0", scripts[0], arch === "x86_64" ? "aarch64" : "x86_64");
  assert.equal(await page.locator('[data-artifact-tool="probe"] [data-artifact-version="1.0.0"] [data-artifact-platform]').count(), 2, "A version can gain its other platform without overwriting the first");
  assert.deepEqual(errors, [], "Browser has no runtime errors");
  if (evidence) {
    for (const scheme of ["dark", "light"]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({ path: join(evidence, `artifacts-desktop-${scheme}.png`) });
    }
  }
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", isMobile: true, hasTouch: true });
  const phone = await phoneContext.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(ui.url);
  await phone.locator("#open-sidebar").click();
  await phone.locator("#open-settings").click();
  await phone.locator("#open-artifacts").click();
  await phone.locator('#artifacts-manager[aria-busy="false"]').waitFor();
  const select = phone.locator('[data-artifact-tool="probe"] [data-action="artifact-current"]');
  await select.selectOption("2.0.0");
  await phone.locator('[data-artifact-tool="probe"][data-current="2.0.0"]').waitFor();
  assert.equal((await (await fetch(`${web.server.url}/api/artifacts`)).json()).tools.probe.current, "2.0.0");
  await select.selectOption("1.0.0");
  await phone.locator('[data-artifact-tool="probe"][data-current="1.0.0"]').waitFor();
  assert(await phone.locator("#artifacts-manager").evaluate((el) => el.scrollWidth <= el.clientWidth), "Phone list fits without horizontal overflow");
  if (evidence) await phone.screenshot({ path: join(evidence, "artifacts-phone-dark.png") });
  assert.deepEqual(errors, [], "Desktop and phone have no runtime errors");
  await phoneContext.close();
  console.log("PASS artifacts: real HTTP uploads, Gateway/Jupyter stdin transfer, switch/rollback/import, validation/size/current protection, shared and orphan blob cleanup, desktop/phone UI");
  await context.close();
}
