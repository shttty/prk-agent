// Mock backend for the Skills panel: target project `.agents/skills` directories, Gateway global skills,
// shadowed entries and shared-library scope. Every /api call is fulfilled here; EventSource emits one snapshot.

const LONG = "/home/user/workspace/some-very-long-project-name/packages/application-frontend/src/features/deployment/app";
const GROUPS = [
  { path: `${LONG}/.agents/skills`, machine: "alpha", label: "alpha" },
  { path: "/home/user/workspace/some-very-long-project-name/packages/application-frontend/src/.agents/skills", machine: "alpha", label: "alpha" },
  { id: "group:skills:shared", name: "PRK 共享库" },
  // Fixed Gateway label: it does not start with `path`, so it is not a dynamic directory label.
  { id: "group:skills:global", path: "/gateway/.agents/skills", machine: "gateway", name: "全局 · ~/.agents/skills" },
].map((group) => group.id ? group : { ...group, id: `group:skills:dir:${group.machine}:${group.path}`, name: `${group.path} · ${group.label}` });

const entry = (group, name, file, extra = {}) => ({
  id: `skill:${file}`, kind: "skill", name, description: `${name} description`, group: group.id, groupLabel: group.name, source: file,
  enabled: true, configured: true, defaultEnabled: true, overridden: false, groupEnabled: true, ...extra,
});
const WINNER = entry(GROUPS[0], "deploy-check", `${GROUPS[0].path}/deploy-check/SKILL.md`);
const SHADOWED = entry(GROUPS[1], "deploy-check", `${GROUPS[1].path}/deploy-check/SKILL.md`, { shadowedBy: WINNER.id });
// A project directory skill with the shared library's name also wins over the shared one.
const PROJECT_COPY = entry(GROUPS[0], "panel-skill", `${GROUPS[0].path}/panel-skill/SKILL.md`);
const SHARED = entry(GROUPS[2], "panel-skill", "/prk/skills/panel-skill/SKILL.md", { library: { name: "panel-skill" }, shadowedBy: PROJECT_COPY.id });
const OTHER = entry(GROUPS[3], "gateway-only", `${GROUPS[3].path}/gateway-only/SKILL.md`);

export const skillsMock = {
  groups: GROUPS, winner: WINNER, shadowed: SHADOWED, shared: SHARED, failScope: "instance:beta",
  sessionId: "w1", project: { id: "p1", name: "销售项目" },
};

const catalog = () => ({
  groups: GROUPS.map((group) => ({ ...group, kind: "skill", enabled: true, available: true, defaultEnabled: true, overridden: false })),
  entries: [WINNER, PROJECT_COPY, SHADOWED, SHARED, OTHER],
});

// Returns { scopeRequests }: bodies of every POST /api/skills/<name>/scope, in order.
export async function installSkillsMock(page) {
  const library = [{
    name: "panel-skill", version: 1, status: "promoted", manual: false, scope: "global", description: "Reusable fixture workflow",
    whenToUse: "Checking shared skill management.", evidence: "Observed isolated panel workflow.", body: "Read the fixture.", files: [], distinctSessions: 2, lastUsedAt: null,
  }];
  const scopeRequests = [];
  const messages = [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() - 1000 }];
  const snapshot = { streamId: "mock-s1", sessionId: skillsMock.sessionId, sequence: 1, state: "idle", messages, queuedMessages: { steering: [], followUp: [] }, model: "clp/gpt-6", thinkingLevel: "medium", contextUsage: { tokens: 1000, contextWindow: 200000, percent: 1 }, recentOperations: [], messageEntryIds: ["e0"] };
  await page.addInitScript((snap) => {
    class FakeEventSource extends EventTarget {
      constructor(url) {
        super(); this.url = url; this.readyState = 0;
        setTimeout(() => {
          this.readyState = 1; this.dispatchEvent(new Event("open")); this.onopen?.(new Event("open"));
          if (/sessions\/w1\/events/.test(url)) this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(snap) }));
          // The collection subscription's first frame is the workbench; the mock serves it at /api/workbench.
          if (url.endsWith("/api/sessions/events")) void fetch("/api/workbench").then((response) => response.json()).then((body) => this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(body) })));
        }, 30);
      }
      close() { this.readyState = 2; }
    }
    window.EventSource = FakeEventSource;
  }, snapshot);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/workbench") return json({
      targets: [{ id: "alpha", label: "Alpha", local: true, python: "/usr/bin/python3", tags: [] }, { id: "beta", label: "Beta", local: true, python: "/usr/bin/python3", tags: [] }],
      sessions: [{ label: "销售数据分析", sessionId: skillsMock.sessionId, state: "idle", target: "alpha", cwd: LONG, projectId: skillsMock.project.id, projectName: skillsMock.project.name }],
    });
    if (path === "/api/ui") return json({ extensionUiRenderIntervalMs: 60 });
    if (path === "/api/models") return json({ models: [{ value: "clp/gpt-6", label: "GPT-6", provider: "clp", thinkingLevels: ["off", "medium"] }], defaultModel: "clp/gpt-6" });
    if (path === `/api/sessions/${skillsMock.sessionId}/monitor/history`) return json({ instance: "alpha", windowMs: 900000, machine: [], customMetrics: [] });
    if (path === `/api/sessions/${skillsMock.sessionId}/monitor/focus`) return json({ focused: request.postDataJSON()?.open === true, leaseMs: 30000 });
    if (path === "/api/capabilities") return json({ catalog: catalog(), terminal: {} });
    if (path === "/api/skills/list") return json({ skills: library });
    const scope = path.match(/^\/api\/skills\/([^/]+)\/scope$/);
    if (scope) {
      const body = request.postDataJSON();
      scopeRequests.push(body);
      if (body.scope === skillsMock.failScope) return json({ error: "scope rejected" }, 400);
      library.find((saved) => saved.name === decodeURIComponent(scope[1])).scope = body.scope;
      return json({ skills: library });
    }
    if (/^\/api\/sessions\/[^/]+\/native$/.test(path)) {
      if (request.method() !== "POST") return json({ version: 1, commands: [], actions: [], inputPrefixes: [], resources: [], attachments: { enabled: false }, references: {} });
      const body = request.postDataJSON() || {};
      return json({ requestId: body.requestId, action: body.action, status: "completed", message: "ok", data: body.action === "capabilities" ? catalog() : body.action === "extension-ui" ? { streamId: snapshot.streamId } : {} });
    }
    const worker = path.match(/^\/api\/sessions\/([^/]+)$/);
    if (worker && worker[1] === skillsMock.sessionId) return json(snapshot);
    return json({});
  });
  return { scopeRequests };
}

// Opens the session Skills window of the mocked worker.
export async function openSessionSkills(page, phone = false) {
  if (phone) await page.locator("#open-sidebar").click();
  await page.locator(`[data-session-id="${skillsMock.sessionId}"] .management-session-select`).click();
  await page.locator("#composer").waitFor();
  if (phone) await page.locator("#open-sidebar").click();
  await page.locator(`[data-session-id="${skillsMock.sessionId}"] [data-action="session-menu"]`).click();
  await page.locator("#session-skills").click();
  await page.locator('.capabilities-panel[data-kind="skills"][aria-busy="false"]').waitFor();
}
