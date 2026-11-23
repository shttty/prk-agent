// Browser-side workbench HTTP/SSE fixture used with the real Vite UI.
import { builtinThemes } from "../../shared/themes.js";
import { createMockFs } from "./workspace-mock/create-mock-fs.mjs";
import { SESSIONS, SNAPSHOTS } from "./workspace-mock/session-snapshots.mjs";

/**
 * Open the workbench in a fresh context. `storage` is written to localStorage once per tab session (a reload keeps
 * what the page saved). `routes` maps an exact `/api/...` path to `(body) => json` for extra endpoints (throw
 * `{status,code,message}` to fail); `ui` is merged into the `GET /api/ui` reply. Pushing a live
 * event: dispatch on `window.__eventSources` (the page's fake EventSources, workbench stream included). `targets`,
 * `archive` and `models` fill the workbench and model catalog; `terminalReplay` is what a terminal socket replays on
 * attach; `search` is appended to the page URL (e.g. `?look=a`). Returns { context, page, problems } where problems
 * collects uncaught page errors.
 */
export async function openMockWorkbench(browser, serverUrl, { fs = createMockFs(), storage = {}, viewport = { width: 1440, height: 900 }, deviceScaleFactor, colorScheme = "light", mobile = false, hasTouch = mobile, sessions = SESSIONS, snapshots = SNAPSHOTS, routes = {}, ui = {}, targets = [{ id: "alpha", label: "Alpha", local: false, python: "/usr/bin/python3", cwd: "/data", tags: [] }], archive = [], models = { models: [], defaultModel: "clp/gpt-6" }, terminals = [], terminalReplay = "$ ", search = "", beforeGoto } = {}) {
  sessions = sessions.map((sessionRow) => sessionRow.monitor?.machine ? { ...sessionRow, monitor: { ...sessionRow.monitor, customMetrics: sessionRow.monitor.customMetrics ?? [], machine: { sampledAt: Date.now() - sessionRow.monitor.machine.ageMs, ...sessionRow.monitor.machine } } } : sessionRow);
  const context = await browser.newContext({ viewport, colorScheme, hasTouch, ...(deviceScaleFactor ? { deviceScaleFactor } : {}), ...(mobile ? { isMobile: true } : {}) });
  const page = await context.newPage();
  const problems = [];
  const shells = new Map((terminals ?? []).map((shell) => [shell.name, { generation: "g1", connectionStatus: "connected", ...shell }]));
  page.on("pageerror", (error) => problems.push(error.message));
  await page.addInitScript(({ snapshots: initial, storage: seed }) => {
    // (Firefox also runs this on about:blank, where storage access throws.)
    try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value); } } catch { /* about:blank */ }
    window.__eventSources = [];
    class FakeEventSource extends EventTarget {
      constructor(url) {
        super(); this.url = url; this.readyState = 0;
        window.__eventSources.push(this);
        setTimeout(() => {
          this.readyState = 1; this.dispatchEvent(new Event("open")); this.onopen?.(new Event("open"));
          const sessionId = /sessions\/([^/]+)\/events/.exec(url)?.[1];
          if (sessionId && initial[sessionId]) this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(initial[sessionId]) }));
          // The collection subscription's first frame is the workbench; the mock serves it at /api/workbench.
          if (url.endsWith("/api/sessions/events")) void fetch("/api/workbench").then((response) => response.json()).then((body) => this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(body) })));
        }, 30);
      }
      close() { this.readyState = 2; }
    }
    window.EventSource = FakeEventSource;
    // Firefox (WebDriver BiDi) hands route handlers no request body: the files routes also get it in a header.
    const nativeFetch = window.fetch;
    window.fetch = (input, init = {}) => (typeof init.body === "string" && String(input?.url ?? input).includes("/files/")
      ? nativeFetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), "x-mock-body": encodeURIComponent(init.body) } })
      : nativeFetch(input, init));
  }, { snapshots, storage });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/workbench") return json({ targets, sessions, archive });
    if (path === "/api/ui") return json({ extensionUiRenderIntervalMs: 60, ...ui });
    if (path === "/api/models") return json(models);
    if (path === "/api/themes/list") return json({ themes: builtinThemes });
    const filesRoute = /\/files\/(\w+)$/.exec(path);
    if (filesRoute) {
      const request = route.request();
      const body = request.postDataJSON() ?? (request.headers()["x-mock-body"] ? JSON.parse(decodeURIComponent(request.headers()["x-mock-body"])) : {});
      try { return json(fs.handle(filesRoute[1], body)); } catch (error) { return json({ code: error.code, message: error.message }, error.status ?? 500); }
    }
    const extra = routes[path];
    // An extra route fails by throwing `{status, code, message}`, like the files routes above.
    if (extra) {
      try { return json(await extra(route.request().postDataJSON() ?? {}), 200); } catch (error) { return json({ code: error.code, message: error.message }, error.status ?? 500); }
    }
    const history = /^\/api\/sessions\/([^/]+)\/monitor\/history$/.exec(path);
    if (history) {
      const entry = sessions.find(({ sessionId }) => sessionId === history[1]);
      const machine = entry?.monitor?.machine;
      return json({ instance: entry?.target ?? "alpha", windowMs: 900000, machine: machine ? [{ at: machine.sampledAt, value: machine }] : [], customMetrics: [] });
    }
    // The server's terminal list: the shells it was started with plus every one a socket attached to, minus the ended ones.
    // `terminals: null` makes the list unreachable (a page that must not open a shell of its own).
    if (/\/terminals$/.test(path)) return terminals === null ? json({ code: "UNAVAILABLE", message: "terminals unavailable" }, 503) : json({ terminals: [...shells.values()] });
    if (/\/terminals\/close$/.test(path)) { shells.delete(route.request().postDataJSON()?.name); return json({ closed: true }); }
    // The Gateway's monitor focus lease (host-types.ts monitorFocus). Without `leaseMs` the page re-sent the heartbeat
    // immediately, ~1000 requests a second while a monitor card was open.
    if (/^\/api\/sessions\/[^/]+\/monitor\/focus$/.test(path)) return json({ focused: route.request().postDataJSON()?.open === true, leaseMs: 30000 });
    const sessionId = /^\/api\/sessions\/([^/]+)$/.exec(path);
    if (sessionId && snapshots[sessionId[1]]) return json(snapshots[sessionId[1]]);
    return json({});
  });
  // Terminal sockets are answered here, never forwarded: each connection gets the replay snapshot, pings are answered,
  // and tests can push frames or drop the connection through `sockets`.
  const sockets = [];
  // A tab made from the terminal list connects with the public `?generation=` query (docs/wire/workspace.md).
  await page.routeWebSocket(/\/api\/sessions\/[^/]+\/terminals\/[^/]+\/ws(\?generation=[^&]+)?$/, (ws) => {
    const name = decodeURIComponent(/\/terminals\/([^/]+)\/ws(\?|$)/.exec(ws.url())[1]);
    if (terminals !== null && !shells.has(name)) shells.set(name, { name, generation: "g1", connectionStatus: "connected" });
    const socket = { url: ws.url(), received: [], send: (frame) => ws.send(JSON.stringify(frame)), close: (code = 1001) => ws.close({ code }) };
    sockets.push(socket);
    ws.onMessage((raw) => {
      const frame = JSON.parse(String(raw));
      socket.received.push(frame);
      if (frame.type === "ping") socket.send({ type: "pong" });
    });
    socket.send({ type: "snapshot", name, connectionStatus: "connected", replay: terminalReplay });
  });
  await beforeGoto?.(page);
  await page.goto(`${serverUrl}/${search}`);
  return { context, page, problems, sockets };
}


