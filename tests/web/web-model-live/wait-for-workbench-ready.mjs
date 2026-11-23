

export async function waitForWorkbenchReady(ctx, page) {
  const serviceReady = page.locator('#management-connection-status[data-status="connected"]');
  const targetCreate = page.locator('button[data-action="create-session"]').first();
  await ctx.waitFor(async () => {
    if (await serviceReady.isVisible().catch(() => false)) return true;
    if (!await targetCreate.isVisible().catch(() => false)) return false;
    return targetCreate.isEnabled().catch(() => false);
  }, "visible workbench readiness", 30_000);
}
