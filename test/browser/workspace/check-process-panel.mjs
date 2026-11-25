import assert from "node:assert/strict";

export async function checkProcessPanel(f, id) {
  const { page } = f;
  const block = page.locator('[data-monitor-block="processes"]');
  const code = `import subprocess
processes = [subprocess.Popen(["sleep", "60"]) for _ in range(24)]`;
  const receipt = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code } })}`);
  assert.equal((await f.complete(id, receipt)).status, "completed");
  await page.locator(`#monitor-overview[data-process-count="24"]`).waitFor();
  await page.locator(`[data-session-id="${id}"] .management-session-state[data-state="background"]`).waitFor({ state: "attached" });
  await block.locator("summary").click();
  const process = block.locator('[data-process-owner="detached"]').first();
  await process.waitFor();
  assert.equal(await process.locator("[title]").getAttribute("title"), "sleep 60");
  const scroller = block.locator(".pi-monitor-block-content");
  assert(await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop > 0 && element.clientHeight < element.scrollHeight;
  }));
  await f.open(id);
  await page.locator('[data-monitor-block="processes"][open]').waitFor();
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    if (width === 390) {
      await page.locator("#theme-toggle").waitFor();
      await page.locator("#toggle-monitor").click();
    }
    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.locator(`html[data-mantine-color-scheme="${colorScheme}"]`).waitFor({ state: "attached" });
      assert(await page.locator("#monitor-overview").isVisible());
      assert(await process.isVisible());
      assert(await block.evaluate((node) => node.scrollWidth === node.clientWidth), `monitor fits ${width}px ${colorScheme}`);
    }
  }
  const stop = await f.send(id, `TOOL ${JSON.stringify({ name: "kernel_code", args: { code: "for child in processes:\n    child.terminate()\n    child.wait()" } })}`);
  assert.equal((await f.complete(id, stop)).status, "completed");
}
