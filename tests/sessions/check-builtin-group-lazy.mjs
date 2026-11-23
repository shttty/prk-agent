import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { assembleFixture } from "../fixtures/tool-search/assemble-fixture.mjs";

if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) {
  throw new Error("Built-in group acceptance requires its owned Jupyter fixture; unset JUPYTER_URL and JUPYTER_TOKEN.");
}
const home = await mkdtemp(join(tmpdir(), "prk-builtin-group-lazy-"));
const environment = Object.fromEntries(["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
await mkdir(process.env.HOME);
const { agentDir } = initializePrkHome(home);
try {
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
  await withTargetFixture(async ({ config, onCleanup }) => {
    const { action, client, catalog, host, sessionId: worker, run } = await assembleFixture({ home, agentDir, config, onCleanup });
    await run();
    const initial = host.state(worker);
    const inventory = await catalog();
    const group = inventory.groups.find((entry) => entry.id === "group:tools:package:<inline:sessions>");
    assert.deepEqual(group?.lazy, {
      id: "lazy:group:tools:package:<inline:sessions>", enabled: false, defaultEnabled: false, overridden: false, available: true,
    }, "Callable inline sessions group exposes its resident default through the real catalog");
    const members = inventory.entries.filter((entry) => entry.group === group.id && entry.lazy?.available);
    assert(members.some((entry) => entry.name === "space_status"), "The migrated space_status is an ordinary callable plugin group member");
    assert(members.length >= 2, "The fixture exercises group membership, not only one selected tool");
    const itemId = "lazy:tool:space_status";
    const groupId = group.lazy.id;
    const change = (changes, instance) => client.request("capabilitiesChange", {
      changes, ...(instance ? { instance } : {}),
    });
    const sessionChange = (changes) => action("capabilities", { changes });
    await change(["session_list", "session_manage"].map((name) => ({ id: `lazy:tool:${name}`, enabled: null })));
    const observe = async (groupLazy, itemLazy, label) => {
      const current = await catalog();
      const currentGroup = current.groups.find((entry) => entry.id === group.id);
      assert.equal(currentGroup.lazy.enabled, groupLazy, `${label}: group effective lazy`);
      assert.equal(currentGroup.lazy.available, true);
      assert.equal(current.requiresReload, false);
      const request = (await run()).requests[0];
      const declarations = JSON.parse(request.declarations);
      for (const member of members) {
        const entry = current.entries.find((candidate) => candidate.id === member.id);
        const lazy = member.name === "space_status" ? itemLazy : groupLazy;
        assert.equal(entry.enabled, true, `${label}: lazy never disables ${member.name}`);
        assert.equal(entry.exposure, member.exposure, `${label}: registry exposure is unchanged`);
        assert.equal(entry.lazy.enabled, lazy, `${label}: catalog lazy for ${member.name}`);
        assert.equal(request.tools.includes(member.name), !lazy, `${label}: next real SDK request declaration for ${member.name}`);
        assert.equal(declarations.some((tool) => tool.name === member.name), !lazy, `${label}: full provider schema presence for ${member.name}`);
      }
      const kernel = current.entries.find((entry) => entry.id === "tool:kernel_code");
      assert.equal(kernel.lazy.available, false, "Model-only kernel_code remains ineligible");
      assert(request.tools.includes("kernel_code"), "Group lazy never hides model-only kernel_code");
      const state = host.state(worker);
      assert.equal(state.streamId, initial.streamId, `${label}: same runtime`);
      assert.equal(state.sessionId, initial.sessionId);
      assert.equal(state.kernel.kernelId, initial.kernel.kernelId, `${label}: no kernel reload`);
    };
    await change([{ id: groupId, enabled: false }, { id: itemId, enabled: true }]);
    await observe(false, true, "global resident group with lazy item override");
    await change([{ id: groupId, enabled: true }, { id: itemId, enabled: false }]);
    await observe(true, false, "global lazy group with resident item override");
    await change([{ id: groupId, enabled: true }], "fixture");
    await observe(true, true, "instance group beats lower global item");
    await change([{ id: itemId, enabled: false }], "fixture");
    await observe(true, false, "same-instance item beats group");
    await sessionChange([{ id: groupId, enabled: true }]);
    await observe(true, true, "session group beats lower instance item");
    await sessionChange([{ id: itemId, enabled: false }]);
    await observe(true, false, "same-session resident item beats group");
    await sessionChange([{ id: groupId, enabled: false }, { id: itemId, enabled: true }]);
    await observe(false, true, "same-session lazy item beats resident group");
    await sessionChange([{ id: itemId, enabled: null }]);
    await observe(false, false, "reset item rejoins resident group");
    await sessionChange([{ id: groupId, enabled: true }]);
    await observe(true, true, "group lazy hides every callable member on the next request");
    console.log("PASS built-in group catalog defaults, real SDK provider declarations, global/instance/session group precedence and per-item overrides/reset; unchanged exposure and runtime/kernel identity; controlled provider only");
  }, { rootDir: () => home });
} finally {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(home, { recursive: true, force: true });
}
