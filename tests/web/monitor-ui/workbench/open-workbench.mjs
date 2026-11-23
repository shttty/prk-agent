import { openMockWorkbench } from "../../../fixtures/workspace-mock.mjs";
import { createMockFs } from "../../../fixtures/workspace-mock/create-mock-fs.mjs";
import { selectSession } from "../../../fixtures/workspace-mock/select-session.mjs";

export async function openWorkbench(ctx, options = {}, session = "w1") {
  const { browser, server, opened, fixture: { SESSIONS, SNAPSHOTS, routes, TARGETS } } = ctx;
  const handle = await openMockWorkbench(browser, server.url, { fs: createMockFs({ "src/app.py": "x\n" }), sessions: SESSIONS, snapshots: SNAPSHOTS, routes, targets: TARGETS, ...options });
  opened.push(handle.context);
  if (options.mobile) await handle.page.locator("#open-sidebar").click();
  if (session) await selectSession(handle.page, session);
  return handle;
}
