import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { targetConfig } from "../../../src/gateway/instances/serialize-instance.ts";
import { getTarget } from "../../../src/gateway/instances/configuration/get-instance.ts";
import { editTarget } from "../../../src/gateway/instances/configuration/edit-instance.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";

const globalIndex = "https://python.example/simple";
const instanceIndex = "http://office.example:8080/simple/";
const instance = { id: "office", label: "Office", cwd: "/work", pythonIndexUrl: instanceIndex };
const wire = (method, target) => ({ v: 1, id: 1, method, params: { target } });

test("Python indexes stay credential-free and sparse through config, wire, editable and persisted instances", async () => {
  const document = { instances: [instance, { id: "inherited", label: "Inherited", cwd: "/work" }] };
  const config = parsePrkConfig({ pythonIndexUrl: globalIndex }, document);
  assert.equal(parsePrkConfig({}).pythonIndexUrl, undefined);
  assert.equal(config.pythonIndexUrl, globalIndex);
  assert.equal(config.instances[0].pythonIndexUrl, instanceIndex);
  assert.equal(config.instances[1].pythonIndexUrl, undefined, "the global default is not copied into an override");
  assert.equal(targetConfig(config.instances[0]).pythonIndexUrl, instanceIndex);
  assert.equal("pythonIndexUrl" in targetConfig(config.instances[1]), false);
  for (const method of ["addTarget", "editTarget"]) {
    assert.deepEqual(validateRequest(wire(method, instance)), wire(method, instance));
  }
  for (const value of ["", " ", null, 1, "mirror/simple", "ftp://mirror/simple", "https://", "https://token@mirror/simple",
    "https://user:secret@mirror/simple", "https://mirror/simple?token=secret", "https://mirror/simple#secret", "https://mirror/\nsecret"]) {
    assert.throws(() => parsePrkConfig({ pythonIndexUrl: value }), /pythonIndexUrl/);
    assert.throws(() => parsePrkConfig({}, { instances: [{ ...instance, pythonIndexUrl: value }] }), /pythonIndexUrl/);
    assert.throws(() => validateRequest(wire("addTarget", { ...instance, pythonIndexUrl: value })));
    if (typeof value === "string" && !value.trim()) {
      assert.equal(validateRequest(wire("editTarget", { id: instance.id, pythonIndexUrl: value })).params.target.pythonIndexUrl, value);
    } else {
      assert.throws(() => validateRequest(wire("editTarget", { id: instance.id, pythonIndexUrl: value })));
    }
  }
  assert.throws(() => parsePrkConfig({ indexUrl: globalIndex }), /unsupported field/);
  assert.throws(() => validateRequest(wire("editTarget", { id: instance.id, indexUrl: instanceIndex })));

  const ctx = {
    host: { options: {}, config },
    instances: { targets: config.instances },
    methods: {
      exclusive: (action) => action(),
      getTargetEnvironment: () => undefined,
      workbenchSnapshot: () => ({}),
      mutatePersistedTargets: (mutate) => {
        mutate(document, ctx.instances.targets);
        ctx.instances.targets = parsePrkConfig({ pythonIndexUrl: globalIndex }, document).instances;
      },
    },
  };
  assert.equal(getTarget(ctx, instance.id).pythonIndexUrl, instanceIndex);
  await editTarget(ctx, { target: { id: instance.id, label: "Office edited" } });
  assert.equal(document.instances[0].pythonIndexUrl, instanceIndex, "omitting a patch retains the override");
  for (const blank of ["", "   "]) {
    await editTarget(ctx, { target: { id: instance.id, pythonIndexUrl: instanceIndex } });
    await editTarget(ctx, { target: { id: instance.id, pythonIndexUrl: blank } });
    assert.equal("pythonIndexUrl" in document.instances[0], false, "blank patches clear the persisted override");
    assert.equal("pythonIndexUrl" in getTarget(ctx, instance.id), false);
    assert.equal(ctx.host.config.pythonIndexUrl, globalIndex);
  }
});
