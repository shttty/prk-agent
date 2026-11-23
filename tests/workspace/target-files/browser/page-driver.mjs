import { join } from "node:path";

/** One browser page on the harness, with request/console capture. Selectors use ids and data attributes, never copy. */
export async function openPage(rig, { name, compact = false, target = "owned", cwd = rig.work }) {
  const context = await rig.browser.newContext({ viewport: compact ? { width: 390, height: 1100 } : { width: 1100, height: 1500 }, acceptDownloads: true });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  const seen = { requests: [], console: [], errors: [], failed: [] };
  page.on("request", (request) => {
    if (!request.url().includes("/api/")) return;
    let body = null;
    try { body = request.postData() ? JSON.parse(request.postData()) : null; } catch { body = null; }
    seen.requests.push({ method: request.method(), path: new URL(request.url()).pathname, body });
  });
  page.on("response", (response) => { if (response.status() >= 400) seen.failed.push({ status: response.status(), path: new URL(response.url()).pathname }); });
  page.on("console", (message) => seen.console.push({ type: message.type(), text: message.text() }));
  page.on("pageerror", (error) => seen.errors.push(error.message));
  const params = new URLSearchParams({ session: rig.gateway.sessionId, target, cwd, compact: compact ? "1" : "0" });
  await page.goto(`${rig.harness.url}/harness.html?${params}`);
  await page.locator("#files-panel").waitFor();
  const driver = {
    page, context, seen, name,
    shot: async (file) => { const path = join(rig.evidence, `${name}-${file}.png`); await page.screenshot({ path, fullPage: true }); return path; },
    row: (path) => page.locator(`#files-panel li[data-path="${path}"]`),
    tab: (path) => page.locator(`.pi-tab[data-path="${path}"]`),
    editor: (path) => page.locator(`.pi-file[data-path="${path}"]`),
    fileRequests: () => seen.requests.filter((request) => request.path.includes("/files/")),
    environment: (env) => page.evaluate((value) => window.__harness.setEnvironment(value), env),
    menuOn: async (path, action) => { await driver.row(path).locator(".pi-files-line").click({ button: "right" }); await page.locator(`[data-action="${action}"]`).click(); },
    typeInto: async (path, text) => { const content = driver.editor(path).locator(".cm-content"); await content.click(); await page.keyboard.press("Control+End"); await page.keyboard.type(text); },
    waitText: (path, text) => driver.editor(path).locator(".cm-content").filter({ hasText: text }).waitFor(),
    close: () => context.close(),
  };
  return driver;
}
