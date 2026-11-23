export function assembleLazySwitchMock() {
  const GROUP = "group:tools:package:probe";
  const TOOLS = [
    { name: "probe_a" },
    { name: "probe_model", exposure: "model-only" },
    { name: "probe_off", off: true },
  ];
  // Switch layers, highest precedence first: session, instance, global (the backend's lazy resolution).
  const layers = { global: {}, instance: {}, session: {} };
  const posts = [];

  /**
   * Backend rule (resolve-lazy-state.ts): walk lowest → highest; the effective value falls back to the group key, but
   * `overridden` means the top layer holds a value for this id itself (a group override shows on the group row only).
   */
  function lazyState(id, group, available, stack) {
    let enabled = false, defaultEnabled = false, overridden = false;
    for (let index = stack.length - 1; index >= 0; index--) {
      const value = stack[index][id] ?? (group === undefined ? undefined : stack[index][group]);
      if (index === 0) { defaultEnabled = enabled; overridden = stack[index][id] !== undefined; }
      if (value !== undefined) enabled = value;
    }
    return { id, enabled, defaultEnabled, overridden, available };
  }

  function catalog(scope) {
    const stack = scope === "session" ? [layers.session, layers.instance, layers.global] : scope === "instance" ? [layers.instance, layers.global] : [{}, layers.global];
    const entries = TOOLS.map((tool) => {
      const id = `tool:${tool.name}`;
      const inherited = stack.slice(1).find((layer) => layer[id] !== undefined)?.[id] ?? !tool.off;
      const enabled = stack[0][id] ?? inherited;
      return { id, kind: "tool", name: tool.name, description: "d", group: GROUP, groupLabel: "probe", enabled, configured: enabled, groupEnabled: true,
        defaultEnabled: inherited, overridden: stack[0][id] !== undefined, available: true, ...(tool.exposure ? { exposure: tool.exposure } : {}),
        lazy: lazyState(`lazy:tool:${tool.name}`, `lazy:${GROUP}`, enabled && tool.exposure !== "model-only", stack) };
    });
    const groups = [{ id: GROUP, kind: "tool", name: "probe", enabled: true, available: true, defaultEnabled: true, overridden: false, lazy: lazyState(`lazy:${GROUP}`, undefined, true, stack) }];
    return { entries, groups, localTools: false, requiresReload: false };
  }

  const beforeGoto = async (page) => {
    await page.route("**/api/capabilities**", (route) => {
      const request = route.request();
      const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        posts.push(body);
        const table = body.instance ? layers.instance : layers.global;
        for (const { id, enabled } of body.changes) {
          if (enabled === null) delete table[id]; else table[id] = enabled;
        }
        return json({ catalog: catalog(body.instance ? "instance" : "global"), terminal: {} });
      }
      return json({ catalog: catalog(new URL(request.url()).searchParams.get("instance") ? "instance" : "global"), terminal: {} });
    });
    await page.route("**/api/sessions/w1/native", (route) => {
      const body = route.request().postDataJSON() ?? {};
      const json = (value) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
      if (body.action !== "capabilities") return json({ commands: [], actions: [], target: { sessionId: "w1", state: "idle" }, resources: [] });
      if (body.args?.changes) {
        posts.push({ session: true, ...body.args });
        for (const { id, enabled } of body.args.changes) {
          if (enabled === null) delete layers.session[id]; else layers.session[id] = enabled;
        }
      }
      return json({ requestId: body.requestId, action: "capabilities", status: "completed", message: "ok", data: catalog("session") });
    });
  };
  const routes = { "/api/tools/list": () => ({ tools: [] }), "/api/skills/list": () => ({ skills: [] }) };
  return { GROUP, layers, posts, beforeGoto, routes };
}
