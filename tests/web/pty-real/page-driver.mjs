import { join } from "node:path";

/** One browser page on the harness (`app: false`) or on the real App (`app: true`: web/index.html, selected session through
 * the session list). Terminal sockets go through `routeWebSocket` as a pass-through to the real Gateway: it records
 * urls/frames and lets the test drop the page side (network loss) — it never answers for the server. Server frames reach the
 * page in their order; `holdClosed(shell, until)` only delays that shell's real `closed` frame (and what follows it) until
 * `until` settles, to put a real event order under test. */
export async function openPage(rig, { name, sessionId, compact = false, viewport, app = false, colorScheme }) {
  const context = await rig.browser.newContext({ viewport: viewport ?? (compact ? { width: 390, height: 844 } : { width: 1500, height: 900 }), ...(app && compact ? { isMobile: true, hasTouch: true } : {}), ...(colorScheme ? { colorScheme } : {}) });
  context.setDefaultTimeout(10000);
  // Every width xterm's renderer gives its .xterm-screen (DomRenderer sets it to round(cols × char width) on each resize), per
  // screen element, in order: the cols a fit started from are read back from it (see layout-probe). DOM only, no xterm objects.
  await context.addInitScript(() => {
    const ids = new WeakMap(); let next = 0; window.__screenWidths = [];
    const note = (el, width) => { if (!ids.has(el)) ids.set(el, ++next); const id = ids.get(el); if (width && window.__screenWidths.findLast((e) => e.id === id)?.width !== width) window.__screenWidths.push({ id, shell: el.closest(".pi-term")?.dataset.shell ?? null, width }); };
    window.__screenId = (el) => ids.get(el) ?? null;
    // Records arrive batched: each one's oldValue is the style before that change, so several resizes in one task all show.
    const widthIn = (style) => /(?:^|;)\s*width:\s*([\d.]+px)/u.exec(style ?? "")?.[1] ?? null;
    new MutationObserver((records) => {
      const touched = new Set();
      for (const r of records) {
        if (r.type === "attributes" && r.target.classList?.contains("xterm-screen")) { note(r.target, widthIn(r.oldValue)); touched.add(r.target); }
        for (const n of r.addedNodes ?? []) if (n.nodeType === 1) for (const el of [n, ...n.querySelectorAll(".xterm-screen")]) if (el.classList.contains("xterm-screen")) touched.add(el);
      }
      for (const el of touched) note(el, el.style.width);
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ["style"] });
  });
  const page = await context.newPage();
  const seen = { sockets: [], errors: [], console: [], failed: [], holds: new Map() };
  page.on("pageerror", (error) => seen.errors.push(error.message));
  page.on("console", (message) => seen.console.push({ type: message.type(), text: message.text() }));
  page.on("response", (response) => { if (response.status() >= 400) seen.failed.push({ status: response.status(), url: new URL(response.url()).pathname }); });
  await page.routeWebSocket(/\/api\/sessions\/.*\/terminals\/.*\/ws/, (ws) => {
    const url = new URL(ws.url());
    const entry = { url: ws.url(), session: url.pathname.split("/")[3], shell: decodeURIComponent(url.pathname.split("/")[5]), generationQuery: url.searchParams.get("generation"), snapshot: null, closeCode: null, input: [], resizes: [], frames: 0, types: new Set(), page: ws };
    seen.sockets.push(entry);
    const server = ws.connectToServer();
    ws.onMessage((message) => { try { const frame = JSON.parse(String(message)); if (frame.type === "input") entry.input.push(frame.data); else if (frame.type === "resize") entry.resizes.push({ rows: frame.rows, cols: frame.cols }); } catch { /* non-JSON */ } server.send(message); });
    // Server frames and the server close go to the page through one queue per socket, so a held frame delays, never reorders.
    let queue = Promise.resolve();
    const later = (step) => { queue = queue.then(step); };
    server.onMessage((message) => {
      entry.frames++;
      let type = null;
      try { const frame = JSON.parse(String(message)); type = frame.type; entry.types.add(frame.type); if (frame.type === "snapshot" && !entry.snapshot) entry.snapshot = { generation: frame.generation, owner: frame.owner, label: frame.label, rows: frame.rows, cols: frame.cols, replay: frame.replay }; } catch { /* non-JSON */ }
      const hold = type === "closed" ? seen.holds.get(entry.shell) : null;
      later(async () => { if (hold) { entry.closedHeld = true; await hold; } ws.send(message); });
    });
    ws.onClose((code, reason) => { entry.closeCode ??= code ?? 1005; server.close({ code, reason }); });
    server.onClose((code, reason) => later(() => { entry.closeCode ??= code ?? 1005; ws.close({ code, reason }); }));
  });
  if (app) await page.goto(`${rig.harness.url}/`);
  else await page.goto(`${rig.harness.url}/harness.html?${new URLSearchParams({ session: sessionId, cwd: rig.fixture.root, compact: compact ? "1" : "0" })}`);
  const driver = {
    page, context, seen, name, rig, compact,
    shot: async (file) => { const path = join(rig.evidence, `${name}-${file}.png`); await page.screenshot({ path, clip: { x: 0, y: 0, width: Math.min(page.viewportSize().width, 1500), height: 700 } }); return path; },
    tab: (shell) => page.locator(`.pi-tab[data-kind="terminal"][data-shell="${shell}"]`),
    view: (shell) => page.locator(`.pi-term[data-shell="${shell}"] .pi-term-view`),
    rows: (shell) => page.locator(`.pi-term[data-shell="${shell}"] .xterm-rows`),
    text: async (shell) => (await driver.rows(shell).innerText()) ?? "",
    focus: async (shell) => { await driver.tab(shell).click(); await page.locator(`.pi-term[data-shell="${shell}"] .xterm`).click(); },
    type: async (shell, text) => { await driver.focus(shell); await page.keyboard.type(text); },
    run: async (shell, command) => { await driver.type(shell, command); await page.keyboard.press("Enter"); },
    // `attached`, not visible: a background tab's view is hidden but still live.
    status: (shell, value) => driver.view(shell).and(page.locator(`[data-status="${value}"]`)).waitFor({ state: "attached", timeout: 20000 }),
    connected: (shell) => ({ waitFor: () => driver.status(shell, "connected") }),
    evaluate: (run, arg) => Promise.race([page.evaluate(run, arg), new Promise((_, reject) => setTimeout(() => reject(new Error("page.evaluate did not answer within 15s (page busy?)")), 15000))]),
    sockets: (shell) => seen.sockets.filter((entry) => entry.shell === shell),
    waitText: async (shell, text) => { for (let i = 0; i < 100; i++) { if ((await driver.text(shell)).includes(text)) return; await page.waitForTimeout(100); } throw new Error(`terminal ${shell} never showed ${text}; has: ${(await driver.text(shell)).slice(-300)}`); },
    holdClosed: (shell, until) => { seen.holds.set(shell, until); },
    close: () => context.close(),
  };
  return driver;
}
