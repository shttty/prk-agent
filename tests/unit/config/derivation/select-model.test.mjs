import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDerivationConfig } from "../../../../src/config/derivation/parse-config.ts";
import { selectDerivationModel } from "../../../../src/config/derivation/select-model.ts";
import { DEFAULT_DERIVED_INSTRUCTIONS } from "../../../../src/config/derivation/derivation-types.ts";

const parentModel = { provider: "fixture", id: "parent", reasoning: true };
const taskModel = { provider: "fixture", id: "task", reasoning: true };
const explicitModel = { provider: "fixture", id: "explicit", reasoning: true };
const noThinkingModel = { provider: "fixture", id: "no-thinking", reasoning: false };
const models = new Map([parentModel, taskModel, explicitModel, noThinkingModel].map((model) => [`${model.provider}/${model.id}`, model]));
const runtime = { getModel: (provider, id) => models.get(`${provider}/${id}`) };
const parent = { model: parentModel, thinkingLevel: "medium" };

test("omitted role selects task for every lifecycle without changing persisted explicit selections", () => {
  const config = parseDerivationConfig({ derivation: { roles: { task: { model: "fixture/task", thinkingLevel: "low", instructions: "Task instructions" } } } });
  for (const lifecycle of ["temporary", "persistent", "user"]) {
    assert.deepEqual(selectDerivationModel(config, { lifecycle }, parent, runtime), {
      model: taskModel, thinkingLevel: "low", instructions: "Task instructions",
    });
    assert.deepEqual(selectDerivationModel(config, { lifecycle, role: "task" }, parent, runtime), selectDerivationModel(config, { lifecycle }, parent, runtime));
  }
  const restored = selectDerivationModel({}, { lifecycle: "persistent", model: "fixture/explicit", thinkingLevel: "high" }, parent, runtime);
  assert.equal(restored.model, explicitModel);
  assert.equal(restored.thinkingLevel, "high");
});

test("model and thinking independently select explicit request then role then current parent", () => {
  const config = parseDerivationConfig({ derivation: { roles: { task: { model: "fixture/task", thinkingLevel: "low" }, modelOnly: { model: "fixture/task" }, thinkingOnly: { thinkingLevel: "high" } } } });
  for (const [request, model, thinkingLevel] of [
    [{}, taskModel, "low"],
    [{ model: "fixture/explicit" }, explicitModel, "low"],
    [{ thinkingLevel: "off" }, taskModel, "off"],
    [{ model: "fixture/explicit", thinkingLevel: "high" }, explicitModel, "high"],
    [{ role: "modelOnly" }, taskModel, "medium"],
    [{ role: "thinkingOnly" }, parentModel, "high"],
    [{ role: "small" }, parentModel, "medium"],
  ]) {
    const selected = selectDerivationModel(config, { lifecycle: "temporary", ...request }, parent, runtime);
    assert.equal(selected.model, model);
    assert.equal(selected.thinkingLevel, thinkingLevel);
  }
  const inherited = selectDerivationModel(parseDerivationConfig({}), { lifecycle: "temporary" }, parent, runtime);
  assert.equal(inherited.model, parent.model);
  assert.equal(inherited.thinkingLevel, parent.thinkingLevel);
  const current = { model: explicitModel, thinkingLevel: "high" };
  const changed = selectDerivationModel({}, { lifecycle: "temporary" }, current, runtime);
  assert.equal(changed.model, current.model);
  assert.equal(changed.thinkingLevel, current.thinkingLevel);
});

test("instructions use task by default and preserve explicit empty role overrides", () => {
  const config = parseDerivationConfig({ derivation: { defaultInstructions: "Global instructions", roles: { task: { instructions: "Task instructions" }, silent: { instructions: "" }, reviewer: {} } } });
  assert.equal(selectDerivationModel(config, { lifecycle: "persistent" }, parent, runtime).instructions, "Task instructions");
  assert.equal(selectDerivationModel(config, { lifecycle: "temporary", role: "silent" }, parent, runtime).instructions, "");
  assert.equal(selectDerivationModel(config, { lifecycle: "temporary", role: "reviewer" }, parent, runtime).instructions, "Global instructions");
  assert.equal(selectDerivationModel({}, { lifecycle: "temporary" }, parent, runtime).instructions, DEFAULT_DERIVED_INSTRUCTIONS);
});

test("unknown roles and unavailable model or thinking choices fail instead of falling back", () => {
  const config = parseDerivationConfig({ derivation: { roles: { task: { model: "fixture/task" }, unavailable: { model: "fixture/missing" }, incompatible: { model: "fixture/no-thinking" } } } });
  for (const role of ["missing", "toString", "__proto__", "", 1]) {
    assert.throws(() => selectDerivationModel(config, { lifecycle: "temporary", role }, parent, runtime));
  }
  for (const request of [
    { role: "unavailable" }, { model: "fixture/missing" }, { model: "unqualified" },
    { role: "incompatible" }, { model: "fixture/no-thinking" }, { thinkingLevel: "max" },
  ]) assert.throws(() => selectDerivationModel(config, { lifecycle: "temporary", ...request }, parent, runtime));
  const explicit = selectDerivationModel(config, { lifecycle: "temporary", role: "incompatible", thinkingLevel: "off" }, parent, runtime);
  assert.equal(explicit.model, noThinkingModel);
  assert.equal(explicit.thinkingLevel, "off");
});
