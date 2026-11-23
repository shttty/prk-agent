import assert from "node:assert/strict";

export async function checkMemoryWrites({ setup, text }) {
    const s = await setup("core");
    const direct = await s.create();
    // Keep this first: disabling control persistence must fail before unrelated coverage.
    await s.memoryCall(direct, { target: "control", action: "add", content: "CONTROL_GATE_PROBE" });
    assert.equal(await s.disk("control"), "CONTROL_GATE_PROBE", "control add saves directly without human approval");
    assert.deepEqual(s.notices(direct, "control").at(-1).details.changes, [{ target: "control", action: "add", after: "CONTROL_GATE_PROBE" }]);
    await s.manual("control", []);
    const code = await s.create("code"), remote = await s.create("direct", "beta");
    const first = await s.memoryCall(direct, { target: "user", action: "add", content: "user-known" });
    assert(first.tools.includes("memory"), "direct mode declares the memory tool to the provider");
    assert(first.system.includes("SOUL_FIXTURE_92741"), "session.soulFile is injected through the real SDK");
    assert(!first.system.includes("user-known"), "a write does not change the already-created system prompt");
    assert.equal(await s.disk("user"), "user-known");
    const saved = JSON.parse(text(first.result));
    assert(saved.usage.some(({ target, chars, limit }) => target === "user" && chars === 10 && limit === 128));
    assert(!text(first.result).includes("user-known"), "success reports usage and confirmation, not the saved entries");
    assert.equal((await s.turn(direct)).system, first.system, "the next provider payload keeps the frozen system prefix");
    const fresh = await s.create();
    const freshPayload = await s.turn(fresh);
    assert(freshPayload.system.includes("user-known"));
    assert.match(freshPayload.system, /10\/128/);
    await s.memoryCall(direct, { target: "instance", action: "add", content: "alpha-only" });
    assert.equal(await s.disk("instance", "alpha"), "alpha-only");
    assert.equal(await s.disk("instance", "beta"), "");
    await s.memoryCall(remote, { target: "instance", action: "add", content: "beta-only" });
    assert.equal(await s.disk("instance", "beta"), "beta-only", "remote instance writes remain in the Gateway home");
    await s.memoryCall(direct, { target: "instance", instance: "beta", action: "add", content: "must-not-cross-instance" }, true);
    assert.equal(await s.disk("instance", "alpha"), "alpha-only");
    assert.equal(await s.disk("instance", "beta"), "beta-only", "model calls cannot select an arbitrary instance");
    const alphaPayload = await s.turn(await s.create());
    const betaPayload = await s.turn(await s.create("direct", "beta"));
    assert(alphaPayload.system.includes("alpha-only") && !alphaPayload.system.includes("beta-only"));
    assert(betaPayload.system.includes("beta-only") && !betaPayload.system.includes("alpha-only"));
    const codeSaved = await s.codeCall(code, { target: "memory", action: "add", content: "code-shared" });
    assert(!codeSaved.tools.includes("memory"), "code mode reaches memory only through the Gateway callable");
    await s.memoryCall(direct, { target: "memory", action: "add", content: "direct-shared" });
    assert.equal(await s.disk("memory"), "code-shared\n§\ndirect-shared", "code/direct share the same Gateway files and delimiter");
    await s.post("change", { target: "user", action: "replace", old_text: "user-known", content: "operator-reread" });
    assert.equal((await s.turn(direct)).system, first.system, "human edits also preserve a running session's prefix");
    assert.equal((await s.action(direct, "reload")).status, "completed");
    const reloaded = await s.turn(direct);
    assert(reloaded.system.includes("operator-reread") && reloaded.system.includes("alpha-only"), "native reload takes a new memory snapshot");

    // Strict unique substring matching, disk rereads and whole-batch rollback, including control.
    await s.manual("user", ["needle", "needle extended"]);
    for (const operation of [
      { target: "user", action: "replace", old_text: "needle", content: "must-not-replace" },
      { target: "user", action: "remove", old_text: "not-present" },
      { target: "user", action: "add", content: "needle" },
    ]) {
      const refused = await s.memoryCall(direct, operation, true);
      assert(text(refused.result).includes("needle") && text(refused.result).includes("needle extended"), "refusal returns current candidate entries to the provider");
      assert.equal(await s.disk("user"), "needle\n§\nneedle extended");
    }
    await s.memoryCall(direct, { target: "user", action: "replace", old_text: "extended", content: "unique-replacement" });
    assert.equal(await s.disk("user"), "needle\n§\nunique-replacement", "a unique short substring selects one complete entry");
    await s.memoryCall(direct, { target: "user", action: "remove", old_text: "replacement" });
    assert.equal(await s.disk("user"), "needle");
    const beforeAtomic = await Promise.all([s.disk("user"), s.disk("memory"), s.disk("control")]);
    await s.memoryCall(direct, { operations: [
      { target: "control", action: "add", content: "must-not-save-control" },
      { target: "user", action: "add", content: "must-not-save" },
      { target: "memory", action: "remove", old_text: "missing-match" },
    ] }, true);
    assert.deepEqual(await Promise.all([s.disk("user"), s.disk("memory"), s.disk("control")]), beforeAtomic);
    assert.equal(s.notices(direct, "control").length, 1, "an invalid mixed batch emits no control write notice");
    for (const target of ["user", "memory", "instance"]) {
      await s.manual(target, [`current-${target}`]);
      const refused = await s.memoryCall(direct, { target, action: "add", content: "x".repeat(129) }, true);
      assert(text(refused.result).includes(`current-${target}`), "capacity errors include every existing entry");
      assert.equal(await s.disk(target), `current-${target}`, `${target} hard capacity rejects the whole write`);
    }
    await s.manual("memory", ["a".repeat(128)]);
    await s.memoryCall(direct, { operations: [
      { target: "memory", action: "add", content: "b".repeat(128) },
      { target: "memory", action: "remove", old_text: "a".repeat(128) },
    ] });
    assert.equal(await s.disk("memory"), "b".repeat(128), "capacity is checked on the final batch, not the overflowing intermediate state");
    await s.manual("user", ["😀".repeat(128)]);
    const unicode = await s.memoryCall(direct, { target: "user", action: "replace", old_text: "😀", content: "界".repeat(128) });
    assert.equal(JSON.parse(text(unicode.result)).usage.find(({ target }) => target === "user").chars, 128, "capacity counts characters, not UTF-16 units");

    // Control saves directly in code/direct mode, retaining the soft recommendation and diffs.
    await s.manual("memory", []);
    await s.post("change", { target: "control", action: "add", content: "CONTROL_ORIGINAL" });
    assert.equal(await s.disk("control"), "CONTROL_ORIGINAL");
    const longRule = `CONTROL_LONG_${"r".repeat(70)}`;
    const savedControl = await s.codeCall(code, { target: "control", action: "add", content: longRule });
    assert.equal(await s.disk("control"), `CONTROL_ORIGINAL\n§\n${longRule}`);
    assert.deepEqual(s.notices(code, "control").at(-1).details.changes, [{ target: "control", action: "add", after: longRule }]);
    const usage = JSON.parse(text(savedControl.result).split("\n").find((line) => line.startsWith("{")));
    assert(usage.usage.some(({ target, soft, overLimit }) => target === "control" && soft && overLimit), "exceeding the recommendation warns instead of refusing the write");
    assert(!text(savedControl.result).includes(longRule), "a control tool result does not echo the saved entry");
    const controlDocument = (await s.post("list")).memories.find(({ target }) => target === "control");
    assert.equal(controlDocument.soft, true);
    assert.equal(controlDocument.overLimit, true);
    assert.equal(s.row(code).asking, undefined);
    for (const [operation, expected, change] of [
      [{ action: "replace", old_text: "CONTROL_ORIGINAL", content: "CONTROL_CHANGED" }, `CONTROL_CHANGED\n§\n${longRule}`, { target: "control", action: "replace", before: "CONTROL_ORIGINAL", after: "CONTROL_CHANGED" }],
      [{ action: "remove", old_text: "CONTROL_CHANGED" }, longRule, { target: "control", action: "remove", before: "CONTROL_CHANGED" }],
    ]) {
      const count = s.notices(direct, "control").length;
      await s.memoryCall(direct, { target: "control", ...operation });
      assert.equal(await s.disk("control"), expected);
      assert.equal(s.notices(direct, "control").length, count + 1);
      assert.deepEqual(s.notices(direct, "control").at(-1).details.changes, [change]);
    }
    await s.memoryCall(direct, { operations: [
      { target: "control", action: "add", content: "CONTROL_GROUP_ONE" },
      { target: "memory", action: "add", content: "MIXED_SAVED" },
      { target: "control", action: "add", content: "CONTROL_GROUP_TWO" },
    ] });
    assert.equal(await s.disk("memory"), "MIXED_SAVED");
    assert.equal(await s.disk("control"), `${longRule}\n§\nCONTROL_GROUP_ONE\n§\nCONTROL_GROUP_TWO`);
    assert.deepEqual(s.notices(direct, "control").at(-1).details.changes, [
      { target: "control", action: "add", after: "CONTROL_GROUP_ONE" },
      { target: "control", action: "add", after: "CONTROL_GROUP_TWO" },
    ]);
    assert.equal(s.notices(direct).length, s.notices(direct, "control").length, "main-model noncontrol writes produce no notice");
    const currentPrompt = (await s.turn(await s.create())).system;
    assert(currentPrompt.includes("CONTROL_GROUP_ONE") && currentPrompt.includes("界"));
    assert(currentPrompt.indexOf("CONTROL_GROUP_ONE") < currentPrompt.indexOf("界"), "control is injected ahead of user memory");
    await s.stop();
}
