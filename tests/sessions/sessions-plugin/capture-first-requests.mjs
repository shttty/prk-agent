import assert from "node:assert/strict";
import { assertRenderedSections } from "../prompt-sections/assert-rendered-sections.mjs";
import { assertSessionSection } from "../prompt-sections/assert-session-section.mjs";
import { writeCapture } from "./write-capture.mjs";

export async function captureFirstRequests(fixture, directory) {
  const { host, run, captureFor } = fixture;
  const expected = { kernel: true, gateway_calls: true, tool_catalog: true, sessions: true, ask: true, memory: true, skill_tools: true, native_tools: true };
  const inspect = async (name, request, depth, parentLabel) => {
    const sections = assertRenderedSections(request.instructions, expected);
    assertSessionSection(sections.get("sessions"), { depth, parentLabel });
    for (const tool of ["session_spawn", "session_send", "session_result"]) {
      assert(request.tools.some(({ name }) => name === tool), `${name} must be resident in the first real direct-mode request`);
    }
    for (const tool of ["space_status", "session_list", "session_manage"]) {
      assert(!request.tools.some(({ name }) => name === tool), `${tool} follows the explicit global lazy default`);
      assert.match(sections.get("tool_catalog"), new RegExp(`^${tool}:`, "mu"));
    }
    if (directory) await writeCapture(directory, name, request);
  };
  const root = (await host.createSession({ target: "fixture", label: "Prompt Root" })).session.sessionId;
  host.setSessionRoot({ sessionId: root });
  await inspect("top-level", (await run(root)).request, 0);
  const spawn = async (parent, label) => {
    const batch = (await run(parent, "session_spawn", {
      context: "Isolated system-prompt verification. Do not call tools or finish the task until explicitly instructed.",
      tasks: [{ task: `Observe the assigned ${label} prompt and await explicit instructions.`, label,
        lifecycle: "persistent", target: "fixture" }],
    })).data;
    assert.deepEqual(batch.errors, [], "The real session_spawn tool must admit the child");
    assert.equal(batch.children.length, 1);
    assert.equal(batch.children[0].sessionName, label);
    return host.workbench().sessions.find((entry) => entry.sessionId === batch.children[0].sessionId).sessionId;
  };
  const child = await spawn(root, "Prompt Child");
  await inspect("depth-1", await captureFor(child, { first: true }), 1, "Prompt Root");
  const nested = await spawn(child, "Prompt Grandchild");
  await inspect("depth-2", await captureFor(nested, { first: true }), 2, "Prompt Child");
  return { root, child, nested };
}
