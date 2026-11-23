import assert from "node:assert/strict";
import test from "node:test";
import { renderKernel } from "../../../src/plugins/kernel/prompt/kernel/render.ts";

test("renderKernel includes the cgroup instruction only when the kernel is scoped", () => {
  const baseInput = {
    helpers: [],
    toolLibrary: false,
    autoTools: false,
    kernelCapabilities: () => true,
    capabilityEnabled: () => false,
    fileHelper: () => false,
    binaryPrompt: () => undefined,
  };

  const scopedPrompt = renderKernel({ ...baseInput, kernelScoped: true }, []);
  assert.match(scopedPrompt, /The kernel runs inside a cgroup/);

  const unscopedPrompt = renderKernel({ ...baseInput, kernelScoped: false }, []);
  assert.doesNotMatch(unscopedPrompt, /The kernel runs inside a cgroup/);
  assert.match(unscopedPrompt, /reset: true/);
});

test("file operation guidance requires both callable read and edit helpers", () => {
  for (const names of [[], ["read"], ["edit"], ["read", "edit"]]) {
    const prompt = renderKernel({
      helpers: names.map((name) => ({ name, signature: "()", description: "File operation" })),
      toolLibrary: false,
      autoTools: false,
      kernelCapabilities: () => true,
      capabilityEnabled: () => false,
      fileHelper: (helpers, name) => helpers.some((helper) => helper.name === name),
      binaryPrompt: () => undefined,
    }, []);
    assert.equal(prompt.includes("Use read() to view files and edit() for targeted changes;"), names.length === 2);
  }
});
