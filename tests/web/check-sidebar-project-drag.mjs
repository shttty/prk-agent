import assert from "node:assert/strict";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { SNAPSHOTS } from "../fixtures/workspace-mock/session-snapshots.mjs";

const sessions = [
  { sessionId: "s-k8s", target: "alpha", label: "ae3ae5", state: "idle", cwd: "/tmp", projectId: "proj-k8s", projectName: "k8s" },
  { sessionId: "s-deploy", target: "alpha", label: "新会话 6", state: "idle", cwd: "/tmp", projectId: "proj-deploy", projectName: "交易机部署" },
  { sessionId: "s-loose", target: "alpha", label: "hello", state: "idle", cwd: "/tmp" },
];
const snapshots = {
  "s-k8s": { ...SNAPSHOTS.w1, sessionId: "s-k8s", streamId: "st-k8s" },
  "s-deploy": { ...SNAPSHOTS.w1, sessionId: "s-deploy", streamId: "st-deploy" },
  "s-loose": { ...SNAPSHOTS.w1, sessionId: "s-loose", streamId: "st-loose" },
};

const calls = [];
const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  const { context, page, problems } = await openMockWorkbench(browser, server.url, {
    sessions,
    snapshots,
    routes: {
      "/api/sessions/s-loose/project": (body) => {
        calls.push({ sessionId: "s-loose", project: body.project });
        const row = sessions.find((s) => s.sessionId === "s-loose");
        return { ...row, ...(body.project ? { projectId: body.project.id, projectName: body.project.name } : { projectId: undefined, projectName: undefined }) };
      },
      "/api/sessions/s-k8s/project": (body) => {
        calls.push({ sessionId: "s-k8s", project: body.project });
        const row = sessions.find((s) => s.sessionId === "s-k8s");
        return { ...row, ...(body.project ? { projectId: body.project.id, projectName: body.project.name } : { projectId: undefined, projectName: undefined }) };
      },
    },
  });
  await page.locator('[data-session-id="s-k8s"]').waitFor();
  await page.locator('#management-view-switch input[value="projects"] + label').click();
  await page.locator('.management-group[data-group="proj-k8s"] [data-session-id="s-k8s"]').waitFor();
  await page.locator('[data-session-id="s-deploy"] .management-session-select').click();
  await page.locator("#composer").waitFor();
  // Drag unselected ungrouped session s-loose into proj-deploy:
  await page.locator('[data-session-id="s-loose"]').dragTo(page.locator('.management-group[data-group="proj-deploy"]'));
  await page.locator('.management-group[data-group="proj-deploy"] [data-session-id="s-loose"]').waitFor();
  assert.deepEqual(calls.at(-1), { sessionId: "s-loose", project: { id: "proj-deploy", name: "交易机部署" } });

  // Now ungrouped group vanished (no ungrouped sessions left); dragging s-k8s reveals ungrouped drop zone and drops it out:
  const source = page.locator('[data-session-id="s-k8s"]');
  await source.dispatchEvent("dragstart", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  const ungroupedZone = page.locator('.management-group[data-group="project:ungrouped"]');
  await ungroupedZone.waitFor();
  await ungroupedZone.dispatchEvent("dragover", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await ungroupedZone.dispatchEvent("drop", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await source.dispatchEvent("dragend");
  await page.locator('.management-group[data-group="project:ungrouped"] [data-session-id="s-k8s"]').waitFor();
  assert.deepEqual(calls.at(-1), { sessionId: "s-k8s", project: null });

  assert.deepEqual(problems, []);
  await context.close();
  console.log("PASS sidebar project drag: unselected session moves into project and out to ungrouped drop zone");
} finally {
  await browser.close();
  await server.close();
}
