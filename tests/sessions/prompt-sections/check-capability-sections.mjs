import assert from "node:assert/strict";
import { assertRenderedSections } from "./assert-rendered-sections.mjs";
import { assertSessionSection } from "./assert-session-section.mjs";

export async function checkCapabilitySections(fixture, root, child) {
  const { run, toggle, action } = fixture;
  const full = { kernel: true, gateway_calls: true, tool_catalog: true, sessions: true, ask: true, memory: true, skill_tools: true, native_tools: true };
  await toggle(child, "tool:session_spawn", false);
  const childRequest = (await run(child)).request;
  const childSections = assertRenderedSections(childRequest.instructions, full);
  assertSessionSection(childSections.get("sessions"), { depth: 1, parentLabel: "Prompt Root Renamed", canSpawn: false });
  assert.doesNotMatch(childSections.get("tool_catalog"), /^session_spawn:/mu, "A disabled capability cannot remain in the hidden catalog");
  await toggle(root, "tool:session_spawn", false);
  const topRequest = (await run(root)).request;
  assertRenderedSections(topRequest.instructions, { ...full, sessions: false });
  assert(!topRequest.tools.some(({ name }) => name === "session_spawn"), "The general sessions explanation follows actual callable capability gating");
  for (const name of ["ask", "memory", "skill_read", "skill_manage"]) await toggle(root, `tool:${name}`, false);
  await action(root, "local-tools", { enabled: false });
  assertRenderedSections((await run(root)).request.instructions, {
    ...full, sessions: false, ask: false, memory: false, skill_tools: false, native_tools: false,
  });
  // Direct mode permits disabling kernel_code; no active tool means every PRK topic is empty.
  const catalog = await action(root, "capabilities");
  for (const entry of catalog.entries.filter((entry) => entry.id.startsWith("tool:") && entry.enabled)) await toggle(root, entry.id, false);
  const empty = (await run(root)).request;
  const absent = Object.fromEntries(Object.keys(full).map((name) => [name, false]));
  assertRenderedSections(empty.instructions, absent);
  assert.deepEqual(empty.tools, [], "An entirely disabled tool surface must serialize no declarations");
  await toggle(root, "tool:kernel_code", true);
  assertRenderedSections((await run(root)).request.instructions, { ...absent, kernel: true, gateway_calls: true, tool_catalog: true });
}
