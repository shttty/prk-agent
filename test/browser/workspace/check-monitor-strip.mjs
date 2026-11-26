import assert from "node:assert/strict";

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

// The pill's width follows the readings; vary it on the live node (two facts, or every fact plus an extra one, a `+N`
// and the alert dot) so the strip is checked at the narrow and the wide end, whatever this machine reports.
const shapePill = (page, wide) => page.locator("#toggle-monitor").evaluate((pill, wide) => {
  for (const node of pill.querySelectorAll("[data-check-extra]")) node.remove();
  const facts = [...pill.querySelectorAll(".pi-monitor-pill-fact")];
  facts.forEach((node, index) => { node.style.display = !wide && index >= 2 ? "none" : ""; });
  if (!wide) return;
  const extra = [facts[0].cloneNode(true), Object.assign(document.createElement("span"), { className: "pi-monitor-delta", textContent: "+1.2k" }), Object.assign(document.createElement("span"), { className: "pi-monitor-dot" })];
  for (const node of extra) node.dataset.checkExtra = "";
  pill.append(...extra);
}, wide);

const geometry = (page) => page.evaluate(() => {
  const box = (selector) => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    return rect?.width ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
  };
  const pill = document.querySelector("#toggle-monitor");
  return { pill: box("#toggle-monitor"), overflowing: pill.scrollWidth > pill.clientWidth, column: box(".pi-chatcol"), heading: box("#session-heading"), controls: [box("#workspace-controls"), box(".pi-stage-strip")].filter(Boolean) };
});

async function setWorkspace(page, open) {
  const toggle = page.locator("#toggle-workspace");
  if ((await toggle.getAttribute("aria-expanded") === "true") !== open) await toggle.click();
  await page.locator(`#toggle-workspace[aria-expanded="${open}"]`).waitFor();
}

async function checkStrip(page, at) {
  for (const wide of [false, true]) {
    await shapePill(page, wide);
    await frames(page);
    const where = JSON.stringify({ ...at, wide });
    const { pill, overflowing, column, heading, controls } = await geometry(page);
    assert(pill && column, `pill shown ${where}`);
    assert(!overflowing && pill.left >= column.left && pill.right <= column.right, `pill whole ${where}: ${JSON.stringify({ pill, column })}`);
    for (const box of controls) assert(!intersects(pill, box), `pill clear of the stage buttons ${where}: ${JSON.stringify({ pill, box })}`);
    if (heading) assert(!intersects(pill, heading), `pill clear of the heading ${where}: ${JSON.stringify({ pill, heading })}`);
  }
  await shapePill(page, false);
}

async function checkPanel(page, width) {
  await setWorkspace(page, false);
  if (await page.locator("#toggle-monitor").getAttribute("aria-pressed") !== "true") await page.locator("#toggle-monitor").click();
  await page.locator('#toggle-monitor[aria-pressed="true"]').waitFor();
  const panel = page.locator(".pi-monitor-panel:has(#monitor-card)");
  await panel.waitFor();
  await page.waitForTimeout(400);
  const [pill, hung] = await Promise.all([page.locator("#toggle-monitor").boundingBox(), panel.boundingBox()]);
  assert(hung.y >= pill.y + pill.height && hung.y - (pill.y + pill.height) < 12 && Math.abs(hung.x + hung.width - (pill.x + pill.width)) < 1, `panel under the pill at ${width}px: ${JSON.stringify({ pill, hung })}`);
}

/** Desktop control strip: at every width, with the workspace open or not, with the chat beside the workspace or in the
 * stage's top-right corner (layout 2), with or without the reconnect button and at either end of the pill's width, the
 * monitor pill keeps clear of the stage's buttons and the session heading and stays whole inside the chat card; the
 * unfolded panel hangs right under the pill, right edges aligned. */
export async function checkMonitorStrip(f, id) {
  const { page } = f;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#toggle-monitor .pi-monitor-pill-fact b").first().waitFor();
  for (const phase of ["live", "chat-corner", "reconnect"]) {
    if (phase === "chat-corner") {
      await setWorkspace(page, true);
      await page.locator('#workspace-controls [aria-haspopup="menu"]').click();
      await page.locator('[data-action="apply-layout"][data-preset="builtin:2"]').click();
    }
    if (phase === "reconnect") {
      await f.request("closeSession", { sessionId: id });
      await page.locator("#topbar-recover").waitFor();
    }
    for (const width of [1440, 1280, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      for (const open of phase === "chat-corner" ? [true] : [false, true]) {
        await setWorkspace(page, open);
        await checkStrip(page, { phase, width, open });
      }
      if (phase !== "chat-corner") await checkPanel(page, width);
    }
  }
}
