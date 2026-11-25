import assert from "node:assert/strict";

export async function checkProcessPanel(f, id) {
  const { page } = f;
  const section = page.locator("#monitor-processes");
  const code = `import subprocess
processes = [subprocess.Popen(["sleep", "60"]) for _ in range(24)]`;
  const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
  assert.equal((await f.complete(id, receipt)).status, "completed");
  await page.locator('#monitor-processes[data-count="24"][data-detached="24"][data-open="false"]').waitFor();
  assert.equal(await section.locator("li").count(), 0);
  await page.locator(`[data-session-list] [data-session-id="${id}"] [data-state="background"]`).waitFor({ state: "attached" });
  await section.locator('[data-action="toggle-monitor-fold"]').click();
  const process = section.locator('li[data-process-owner="detached"]').first();
  await process.waitFor();
  assert.equal(await process.locator("[title]").getAttribute("title"), "sleep 60");
  assert(await section.locator("ul").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop > 0 && element.clientHeight < element.scrollHeight;
  }));
  await f.open(id);
  await page.locator('#monitor-processes[data-open="true"]').waitFor();
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    if (width === 390) {
      await page.locator("#theme-toggle").waitFor();
      await page.locator("#toggle-monitor").click();
    }
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.locator(`html[data-mantine-color-scheme="${colorScheme}"]`).waitFor({ state: "attached" });
      assert(await page.locator("#monitor-machine").isVisible());
      assert(await process.isVisible());
      assert(await section.evaluate((node) => node.scrollWidth === node.clientWidth), `monitor fits ${width}px ${colorScheme}`);
      assert(await section.locator(".pi-monitor-summary").evaluate((node) => node.getClientRects().length === 1 && node.offsetHeight < 2 * parseFloat(getComputedStyle(node).lineHeight)), `summary is one line at ${width}px`);
    }
  }
  const stop = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code: "for child in processes:\n    child.terminate()\n    child.wait()" } })}`);
  assert.equal((await f.complete(id, stop)).status, "completed");
}
