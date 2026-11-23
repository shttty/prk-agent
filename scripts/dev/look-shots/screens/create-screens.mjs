import { selectSession } from "./select-session.mjs";
import { openSidebar } from "./open-sidebar.mjs";
import { openRowMenu } from "./open-row-menu.mjs";
import { runMenuAction } from "./run-menu-action.mjs";
import { openProcessFold } from "./open-process-fold.mjs";
import { scrollTranscript } from "./scroll-transcript.mjs";

export function createScreens(fixture) {
  const { workers, PLUGIN, todoWidget, extensionUi, statusEntries, notice, monitorOf } = fixture;
  const SCREENS = {
    main: {
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await page.locator("#toggle-workspace").click();
        if (phone) { await scrollTranscript(page); return; }
        await page.locator('#desktop-stage[data-open="true"]').waitFor();
        await page.locator("#toggle-tree").click(); await page.locator("#pin-tree").click();
        for (const path of ["analysis.py", "README.md"]) { await page.locator(`#file-tree li[data-path="${path}"] .pi-files-row`).click(); await page.waitForTimeout(400); }
        await page.locator('#file-tree li[data-path="analysis.py"] .pi-files-row').click();
        await page.locator('#desktop-stage .pi-tab[data-kind="terminal"]').first().waitFor();
        await page.waitForTimeout(900);
        await scrollTranscript(page);
      },
    },
    chat: {
      storage: { "pi.layout.monitorCollapsed": "true" },
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await openProcessFold(page);
        await page.locator("#chat-tool-mode").waitFor();
        await page.locator(".pi-turn-process .pi-tool > summary").nth(2).click();
        await scrollTranscript(page);
      },
    },
    todo: {
      storage: { "pi.layout.monitorCollapsed": "true" },
      async run(page, phone) { await selectSession(page, phone, "w1"); await scrollTranscript(page); await page.locator("#todo-toggle").click(); await page.waitForTimeout(350); },
    },
    "todo-folded": {
      storage: { "pi.layout.monitorCollapsed": "true" },
      async run(page, phone) { await selectSession(page, phone, "w1"); await scrollTranscript(page); await page.locator("#todo-dock").waitFor(); await page.waitForTimeout(250); },
    },
    // A widget text the parser rejects: the plugin's own lines, not the float.
    "todo-fallback": {
      storage: { "pi.layout.monitorCollapsed": "true" }, render: () => ({ widgets: [todoWidget(["\x1b[1mTodo\x1b[0m \x1b[2m(3/7)\x1b[0m", "\x1b[2m✓ 3 completed\x1b[0m", "\x1b[36m\x1b[1m▸ 画月度趋势图\x1b[0m"])] }),
      async run(page, phone) { await selectSession(page, phone, "w1"); await scrollTranscript(page); await page.locator('[data-widget-key="prk-todolist.todo"]').waitFor(); await page.waitForTimeout(250); },
    },
    monitor: {
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await scrollTranscript(page);
        if (phone) await page.locator("#toggle-monitor").click();
        await page.locator("#monitor-card").waitFor();
        await page.waitForFunction(() => Number(document.querySelector("#monitor-cpu")?.dataset.points) > 150);
      },
    },
    // Folded: the monitor button alone at the chat column's top corner.
    "monitor-pill": {
      storage: { "pi.layout.monitorCollapsed": "true" },
      async run(page, phone) { await selectSession(page, phone, "w1"); await scrollTranscript(page); await page.locator(phone ? ".topbar #toggle-monitor" : ".pi-chatcol > #toggle-monitor").waitFor(); await page.waitForTimeout(250); },
    },
    settings: {
      async run(page, phone) { await selectSession(page, phone, "w1"); if (phone) await openSidebar(page); await page.locator("#open-settings").click(); await page.locator("#open-archive").waitFor(); await page.waitForTimeout(400); },
    },
    archive: {
      async run(page, phone) { await selectSession(page, phone, "w1"); await runMenuAction(page, phone, "w8", "archive-session"); await page.locator('[data-affected="w4"]').waitFor(); await page.waitForTimeout(400); },
    },
    "archive-list": {
      async run(page, phone) { await selectSession(page, phone, "w1"); if (phone) await openSidebar(page); await page.locator("#open-settings").click(); await page.locator("#open-archive").click(); await page.locator("[data-archive-group]").first().waitFor(); await page.waitForTimeout(400); },
    },
    details: {
      async run(page, phone) { await selectSession(page, phone, "w1"); await runMenuAction(page, phone, "w1", "session-details"); await page.locator("#session-usage").waitFor().catch(() => {}); await page.waitForTimeout(500); },
    },
    rename: {
      async run(page, phone) { await selectSession(page, phone, "w1"); await runMenuAction(page, phone, "w1", "rename-worker"); await page.waitForTimeout(400); },
    },
    targets: {
      async run(page, phone) { await selectSession(page, phone, "w1"); if (phone) await openSidebar(page); await page.locator("#manage-targets").click(); await page.locator('[data-action="edit-target"]').first().waitFor(); await page.waitForTimeout(400); },
    },
    create: {
      async run(page, phone) { await selectSession(page, phone, "w1"); if (phone) await openSidebar(page); await page.locator("#create-session").click(); await page.locator("#create-worker-target").waitFor(); await page.locator("#create-worker-kernel").waitFor(); await page.locator("#confirm-create-worker").waitFor(); await page.waitForTimeout(400); },
    },
    "row-menu": {
      async run(page, phone) { await selectSession(page, phone, "w1"); await openRowMenu(page, phone, "w1"); await page.waitForTimeout(300); },
    },
    "file-menu": {
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await page.locator("#toggle-workspace").click();
        await page.locator("#toggle-tree").click();
        const row = page.locator('#file-tree li[data-path="analysis.py"]');
        await row.waitFor();
        await page.waitForTimeout(300);
        if (phone) await row.locator(".pi-files-more").click();
        else await row.locator(".pi-files-line").click({ button: "right" });
        await page.waitForTimeout(500);
      },
    },
    slash: {
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator("#composer").click(); await page.keyboard.type("/"); await page.waitForTimeout(500); },
    },
    at: {
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator("#composer").click(); await page.keyboard.type("看看 @"); await page.locator("#native-reference-list[data-status='ready']").waitFor(); await page.waitForTimeout(300); },
    },
    empty: {
      workers: [],
      async run(page) { await page.locator("#empty-view h2").waitFor(); await page.waitForTimeout(300); },
    },
    "new-session": {
      async run(page, phone) { await selectSession(page, phone, "w7"); await page.waitForTimeout(300); },
    },
    "ext-dialog": {
      storage: { "pi.layout.monitorCollapsed": "true" }, render: PLUGIN.dialog,
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator('[data-prompt-kind="select"]').waitFor(); await scrollTranscript(page); },
    },
    "ext-custom": {
      storage: { "pi.layout.monitorCollapsed": "true" }, render: PLUGIN.custom,
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator('[data-prompt-kind="custom"]').waitFor(); await scrollTranscript(page); },
    },
    "ext-tray": {
      storage: { "pi.layout.monitorCollapsed": "true" }, render: PLUGIN.tray,
      snapshot: () => ({ state: "running", extensionUi: { ...extensionUi, status: statusEntries, working: { visible: true, message: "跑测试中… 42/120" } } }),
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator('[data-widget-key="pytest"]').waitFor(); await scrollTranscript(page); },
    },
    // The session cannot be read: one banner holding the headline, the reason and the retry (no second box in the chat).
    error: {
      storage: { "pi.layout.monitorCollapsed": "true" },
      snapshot: () => ({ streamId: "" }),
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator("#connection-banner #chat-error").waitFor(); await page.waitForTimeout(250); },
    },
    // The reload notice over a live conversation (the transcript is not pushed down; the error screen shows it without one).
    "banner-chat": {
      storage: { "pi.layout.monitorCollapsed": "true" },
      workers: workers.map((worker) => (worker.name === "w1" ? { ...worker, requiresReload: true } : worker)),
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await scrollTranscript(page);
        await page.waitForFunction(() => Number(document.querySelector("#session-banners")?.dataset.count) >= 1);
      },
    },
    // The same banner beside the unfolded monitor panel: the stack keeps to the room on its left.
    "banner-monitor": {
      workers: workers.map((worker) => (worker.name === "w1" ? { ...worker, requiresReload: true } : worker)),
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        await scrollTranscript(page);
        if (phone) await page.locator("#toggle-monitor").click();
        await page.locator("#monitor-card").waitFor();
        await page.waitForFunction(() => Number(document.querySelector("#session-banners")?.dataset.count) >= 1);
      },
    },
    // The ask card: Mantine Tabs, one dot per question (filled once answered).
    "ask-tabs": {
      storage: { "pi.layout.monitorCollapsed": "true" },
      snapshot: () => ({ extensionUi: { ...extensionUi, prompts: [{ id: "ask-1", kind: "ask", title: "", questions: [
        { id: "db", header: "存储", question: "用哪个数据库保存会话归档？", recommended: 1, options: [{ label: "SQLite", description: "单文件，无需服务" }, { label: "Postgres", description: "联网，需要运维" }] },
        { id: "tz", header: "时区", question: "报表用哪个时区？", options: [{ label: "UTC" }, { label: "Asia/Shanghai" }] },
      ] }] } }),
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator(".pi-ask").waitFor(); await page.locator('[data-ask-option="0"]').click(); await scrollTranscript(page); },
    },
    // A settings panel whose request failed: one inline Alert.
    "panel-errors": {
      async run(page, phone) {
        await page.route("**/api/artifacts", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "读取远程工具失败：目标机无响应。" }) }));
        await selectSession(page, phone, "w1");
        if (phone) await openSidebar(page);
        await page.locator("#open-settings").click();
        await page.locator("#open-artifacts").click();
        await page.locator("#artifacts-error").waitFor();
      },
    },
    // The monitor panel with a failed collector: one inline Alert under the title.
    "monitor-error": {
      workers: workers.map((worker) => (worker.name === "w1" ? { ...worker, monitor: { ...monitorOf(), state: "error", error: "终端通道被拒绝。" } } : worker)),
      async run(page, phone) {
        await selectSession(page, phone, "w1");
        if (phone) await page.locator("#toggle-monitor").click();
        await page.locator("#monitor-note").waitFor();
      },
    },
    // Two shell tabs (one the model's), and the end-shell confirmation.
    "terminal-tabs": {
      desktopOnly: true,
      storage: { "pi.layout.monitorCollapsed": "true" },
      async run(page, phone) {
        await page.route("**/api/sessions/w1/terminals", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ terminals: [{ name: "shell" }, { name: "agent", owner: "model", label: "agent" }] }) }));
        await selectSession(page, phone, "w1");
        await page.locator("#toggle-workspace").click();
        await page.locator('#desktop-stage[data-open="true"]').waitFor();
        await page.locator('#desktop-stage .pi-tab[data-kind="terminal"][data-shell="agent"]').waitFor();
        await page.locator('.pi-tab[data-shell="agent"] [data-action="close-tab"]').click();
        await page.waitForTimeout(300);
      },
    },
    "ext-toast": {
      storage: { "pi.layout.monitorCollapsed": "true" },
      snapshot: () => ({ extensionUi: { ...extensionUi, status: statusEntries, notifications: [notice("n1", "info", "清洗报告已写到 report/clean.md", 900), notice("n2", "warning", "sales.csv 有 312 行 region 为空，已跳过", 500)] } }),
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator("[data-toast-id]").first().waitFor(); await scrollTranscript(page); },
    },
    "ext-overlay": {
      storage: { "pi.layout.monitorCollapsed": "true" }, render: PLUGIN.overlay,
      async run(page, phone) { await selectSession(page, phone, "w1"); await page.locator(".extension-ui-overlay").waitFor(); },
    },
    drawer: {
      phoneOnly: true,
      async run(page, phone) { await selectSession(page, phone, "w1"); await openSidebar(page); },
    },
  };
  return SCREENS;
}
