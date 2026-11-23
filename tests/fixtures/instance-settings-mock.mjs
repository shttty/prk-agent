// Mock backend for the instance settings (contract PRK-SKILLS3): GET/POST /api/capabilities with `instance`,
// target config read / delete. Every /api call is fulfilled here; EventSource never connects.
import { builtinThemes } from "../../shared/themes.js";

export const instanceMock = {
  instance: "alpha", failing: "beta",
  globalSkill: { id: "skill:/gateway/.agents/skills/notes/SKILL.md", name: "notes" },
  sharedSkill: { id: "skill:/prk/skills/shared-check/SKILL.md", name: "shared-check" },
  tool: { id: "tool:panel_probe", name: "panel_probe" },
  fresh: { id: "skill:/gateway/.agents/skills/fresh-scan/SKILL.md", name: "fresh-scan" },
};

const GROUPS = [
  { id: "group:skills:global", kind: "skill", name: "全局 · ~/.agents/skills", path: "/gateway/.agents/skills", machine: "gateway" },
  { id: "group:skills:shared", kind: "skill", name: "PRK 共享库" },
  { id: "group:tools:package:panel-fixture", kind: "tool", name: "Panel fixture" },
];
const entry = (group, item, extra = {}) => ({ id: item.id, kind: item.id.split(":")[0], name: item.name, description: `${item.name} description`, group: group.id, groupLabel: group.name, source: item.id.slice(item.id.indexOf(":") + 1), ...extra });
const ROWS = [[GROUPS[0], instanceMock.globalSkill], [GROUPS[1], instanceMock.sharedSkill], [GROUPS[2], instanceMock.tool]];

// Returns { capabilityPosts, refreshPosts, targetDeletes, targetReads }: request bodies / names in order.
// A refresh POST for an instance makes one more skill (instanceMock.fresh) appear in its view.
export async function installInstanceMock(page) {
  const overrides = new Map();
  const refreshed = new Set();
  const capabilityPosts = [], refreshPosts = [], targetDeletes = [], targetReads = [];
  let targets = [
    { id: instanceMock.instance, label: "Alpha", local: true, python: "/usr/bin/python3", cwd: "/data", tags: [] },
    { id: instanceMock.failing, label: "Beta", local: true, python: "/usr/bin/python3", cwd: "/data", tags: [] },
  ];
  // Instance view: the global default is on; an instance row says on/off in `configured`, `overridden` when the table has it.
  const view = (name) => {
    const table = overrides.get(name) ?? new Map();
    const row = ([group, item]) => {
      const set = table.has(item.id);
      const configured = set ? table.get(item.id) : true;
      return entry(group, item, { enabled: configured, configured, defaultEnabled: true, overridden: set, groupEnabled: true });
    };
    const groups = GROUPS.map((group) => ({ ...group, enabled: true, available: true, defaultEnabled: true, overridden: table.has(group.id) }));
    const rows = refreshed.has(name) ? [...ROWS, [GROUPS[0], instanceMock.fresh]] : ROWS;
    const body = { catalog: { groups, entries: rows.map(row) }, terminal: {} };
    return name === instanceMock.failing ? { ...body, instanceError: "Fixture provider discovery failed" } : body;
  };
  await page.addInitScript(() => {
    class FakeEventSource extends EventTarget {
      constructor(url) {
        super(); this.url = url; this.readyState = 0;
        setTimeout(() => {
          this.readyState = 1; this.dispatchEvent(new Event("open")); this.onopen?.(new Event("open"));
          // The collection subscription's first frame is the workbench; the mock serves it at /api/workbench.
          if (url.endsWith("/api/sessions/events")) void fetch("/api/workbench").then((response) => response.json()).then((body) => this.dispatchEvent(new MessageEvent("snapshot", { data: JSON.stringify(body) })));
        }, 30);
      }
      close() { this.readyState = 2; }
    }
    window.EventSource = FakeEventSource;
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/workbench") return json({ targets, sessions: [] });
    if (path === "/api/ui") return json({ extensionUiRenderIntervalMs: 60 });
    if (path === "/api/models") return json({ models: [], defaultModel: "" });
    if (path === "/api/themes/list") return json({ themes: builtinThemes });
    if (path === "/api/capabilities/refresh") {
      const body = request.postDataJSON();
      refreshPosts.push(body);
      refreshed.add(body.instance);
      return json(view(body.instance));
    }
    if (path === "/api/capabilities") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        capabilityPosts.push(body);
        const table = overrides.get(body.instance) ?? new Map();
        overrides.set(body.instance, table);
        for (const { id, enabled } of body.changes) {
          if (enabled === null) table.delete(id); else table.set(id, enabled);
        }
        return json(view(body.instance));
      }
      return json(view(url.searchParams.get("instance")));
    }
    if (/^\/api\/(skills|tools)\/list$/.test(path)) return json({ skills: [], tools: [] });
    const target = path.match(/^\/api\/targets\/([^/]+)$/);
    if (target) {
      const name = decodeURIComponent(target[1]);
      if (request.method() === "DELETE") {
        targetDeletes.push(name);
        targets = targets.filter((item) => item.id !== name);
        return json({ targets, sessions: [] });
      }
      targetReads.push(name);
      return json({ target: targets.find((item) => item.id === name) });
    }
    return json({});
  });
  return { capabilityPosts, refreshPosts, targetDeletes, targetReads };
}
