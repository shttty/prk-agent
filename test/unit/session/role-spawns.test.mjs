import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDerivationConfig } from "../../../src/config/derivation/parse-config.ts";
import { renderSessions } from "../../../src/plugins/sessions/prompt/render.ts";
import { buildDerivationPayload } from "../../../web/settings/subsessions/build-derivation-payload.js";

const parse = (roles) => parseDerivationConfig({ derivation: { roles } });

test("role spawns keep their meaning: omitted is unrestricted, empty is none", () => {
  const { roles } = parse({ lead: { spawns: ["task", "worker"] }, worker: {}, leaf: { spawns: [] } });
  assert.deepEqual(roles.lead.spawns, ["task", "worker"]);
  assert.deepEqual(roles.leaf.spawns, []);
  assert.equal(roles.worker.spawns, undefined);
  assert.equal(roles.task.spawns, undefined);
});

test("role spawns accept only configured role names in a list", () => {
  assert.throws(() => parse({ lead: { spawns: ["ghost"] } }), /role "lead" spawns unknown role "ghost"/);
  assert.throws(() => parse({ task: { spawns: ["task", "gone"] } }), /unknown role "gone"/);
  assert.throws(() => parse({ lead: { spawns: "task" } }), /spawns must be a list of role names/);
  assert.throws(() => parse({ lead: { spawns: [1] } }), /spawns must be a list of role names/);
});

const rolesBlock = (roles) => renderSessions(undefined, "eager", ["session_spawn"], roles);
const taskAndSmall = [{ name: "small", description: "Fast role." }, { name: "task", description: "Default role." }];

test("the sessions section lists spawnable roles as name: description with the pick sentence", () => {
  const text = rolesBlock([{ name: "lead", description: "Plans work." }, { name: "plain" }, ...taskAndSmall]);
  assert.match(text, /^Roles for session_spawn:\nlead: Plans work\.\nplain\nsmall: Fast role\.\ntask: Default role\.\nPick the role whose description fits the task; omit role for task\.$/m);
  assert.equal(rolesBlock(taskAndSmall), rolesBlock(taskAndSmall));
});

test("a restricted role list shows only what is allowed and never suggests omitting role without task", () => {
  const text = rolesBlock([taskAndSmall[0]]);
  assert.match(text, /^Roles for session_spawn:\nsmall: Fast role\.\nPick the role whose description fits the task; role is required\.$/m);
  assert.doesNotMatch(text, /task: Default/);
});

test("an empty spawns list says the role cannot spawn and a session without session_spawn lists nothing", () => {
  assert.match(rolesBlock([]), /^Your role cannot spawn child sessions; session_spawn will be rejected\.$/m);
  assert.doesNotMatch(rolesBlock([]), /Roles for session_spawn/);
  assert.equal(renderSessions(undefined, "eager", ["session_list"], taskAndSmall), "");
  assert.doesNotMatch(renderSessions(undefined, "eager", ["session_spawn"]), /Roles for session_spawn|cannot spawn/);
});

test("saving roles from the settings page keeps spawns, including the empty list", () => {
  const draft = { defaultToolMode: "", defaultIsolated: false, maxDepth: 3, defaultInstructions: "x" };
  const { roles } = buildDerivationPayload(draft, { lead: { spawns: ["task"] }, leaf: { spawns: [] }, open: {} });
  assert.deepEqual(roles, { lead: { spawns: ["task"] }, leaf: { spawns: [] }, open: {} });
});
