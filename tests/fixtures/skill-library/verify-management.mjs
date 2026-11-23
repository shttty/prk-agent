import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function verifySkillManagement({ home, create, run, client, first, bodyPath, current, fields, post, nativeWorker, text }) {
    const editor = await create("direct");
    const manage = async (args, expectError = false) => run(editor, "skill_manage", { name: "fixture-process", ...args }, undefined, expectError);
    await manage({ action: "create", name: "unrelated-algorithm", ...fields });
    assert.equal((await client.request("skillsList", {})).skills.find((item) => item.name === "unrelated-algorithm").description, fields.description, "A different name is accepted even with the exact description of a promoted skill");
    await manage({ action: "delete", name: "unrelated-algorithm" });
    await manage({ action: "patch", section: "procedure", value: ["PATCH_PROOF_51976", "Retain references/steps.md."] });
    assert.match((await current()).body, /1\. PATCH_PROOF_51976\n2\. Retain references\/steps\.md\./);
    for (const [section, value] of [["whenToUse", "Patched applicability: #signal \"quoted\".\nSecond line."], ["evidence", "R3 fixture: #result \"verified\".\nSecond observation."], ["description", "Patched trigger: #signal \"quoted\".\nSecond trigger."]]) {
      await manage({ action: "patch", section, value });
      assert.equal((await current())[section], value);
      if (section !== "description") assert.match((await current()).body, /Second (line|observation)\./);
    }
    await manage({ action: "patch", section: "pitfalls", value: ["PITFALL_PROOF_72145", "First line\n## Evidence\nDo not splice sections."] });
    await manage({ action: "patch", section: "verification", value: ["VERIFY_PROOF_82631", "Confirm the observed result."] });
    const patched = await run(editor, "skill_read", { path: bodyPath });
    assert.match(text(patched.result), /PITFALL_PROOF_72145/);
    assert.match(text(patched.result), /VERIFY_PROOF_82631/);
    await manage({ action: "patch", section: "pitfalls", value: [] });
    assert(!(await current()).body.includes("PITFALL_PROOF_72145"));
    assert.match((await current()).body, /VERIFY_PROOF_82631/, "Clearing pitfalls preserves verification");
    await manage({ action: "patch", section: "verification", value: [] });
    assert(!(await current()).body.includes("VERIFY_PROOF_82631"));
    const discovered = await run(editor, "tool_search", { query: "skill_manage" });
    const manageDescription = JSON.parse(text(discovered.result)).tools.find((tool) => tool.name === "skill_manage").description;
    await run(first, "kernel_code", { code: `import json\ninfo = gateway.describe('skill_manage')\nassert info['description'] == ${JSON.stringify(manageDescription)}\nsaved = gateway.skill_manage(action='patch', name='fixture-process', section='evidence', value='CODE_PATCH_PROOF_11982: observed #result \\\"quoted\\\".\\nNext observation.')\nassert saved['skill']['evidence'] == 'CODE_PATCH_PROOF_11982: observed #result \\\"quoted\\\".\\nNext observation.'\nprint(json.dumps(info))` });
    await manage({ action: "write_file", path: "scripts/check.py", content: "print(43)\n" });
    assert.match(text((await run(editor, "skill_read", { path: join(home, "skills/fixture-process/scripts/check.py") })).result), /43/);
    await manage({ action: "remove_file", path: "scripts/check.py" });
    assert(!(await client.request("skillsList", {})).skills[0].files.includes("scripts/check.py"));
    for (const args of [
      { action: "write_file", path: "../../escape.txt", content: "escape" },
      { action: "write_file", path: "/tmp/prk-skill-escape", content: "escape" },
      { action: "create", name: "../escape", ...fields },
      { action: "create", name: "missing-description", whenToUse: "Applicable", evidence: "Observed", procedure: ["Inspect"], pitfalls: [], verification: [] },
      { action: "write_file", path: "SKILL.md", content: "Invalid replacement" },
      { action: "remove_file", path: "SKILL.md" },
      { action: "patch", section: "unknown", value: "wrong" },
      { action: "patch", section: "procedure", value: [] },
      { action: "patch", section: "procedure", value: "not an array" },
      { action: "patch", section: "evidence", value: [] },
      { action: "patch", section: "description", value: "x".repeat(1025) },
      { action: "patch", section: "whenToUse", value: "x".repeat(4097) },
      { action: "patch", section: "evidence", value: "x".repeat(8193) },
      { action: "patch", section: "procedure", value: ["x".repeat(2049)] },
      { action: "patch", section: "verification", value: Array(33).fill("step") },
      { action: "create", ...fields },
    ]) await manage(args, true);
    assert.match((await client.request("skillsList", {})).skills[0].content, /PATCH_PROOF_51976/, "Rejected edits leave the valid native skill intact");
    for (const field of ["description", "whenToUse", "evidence"]) {
      for (const value of ["", " \t\n "]) {
        await manage({ action: "create", name: "blank-field", ...fields, [field]: value }, true);
        await manage({ action: "patch", section: field, value }, true);
      }
      const missing = { ...fields };
      delete missing[field];
      await manage({ action: "create", name: "missing-field", ...missing }, true);
    }
    await manage({ action: "create", name: "disposable", ...fields, description: "Temporary deletion acceptance fixture." });
    await manage({ action: "delete", name: "disposable" });
    assert(!(await client.request("skillsList", {})).skills.some((item) => item.name === "disposable"));
    const hiddenName = "hidden-read";
    await manage({ action: "create", name: hiddenName, ...fields, description: "Explicit hidden truncated body reader acceptance." });
    const hiddenPath = join(home, "skills", hiddenName, "SKILL.md");
    const hidden = async () => (await client.request("skillsList", {})).skills.find((item) => item.name === hiddenName);
    // A human-authored native file stays loadable/readable without generated chapters.
    const human = `---\nname: ${hiddenName}\ndescription: Explicit hidden truncated body reader acceptance.\nwhen-to-use: Testing a human-authored skill.\nevidence: R3 fixture supplied an existing native document.\ndisable-model-invocation: true\n---\n# Human workflow\nHUMAN_BODY_PROOF_57391\n\n\`\`\`markdown\n## Procedure\nOnly a code example, not a patchable section.\n\`\`\`\n` + "x\n".repeat(2100);
    await writeFile(hiddenPath, human);
    const humanWorker = await create("direct");
    assert((await client.request("nativeCapabilities", { sessionId: humanWorker })).resources.some((item) => item.name === `/skill:${hiddenName}` && item.loaded));
    const missingSection = await manage({ action: "patch", name: hiddenName, section: "procedure", value: ["Do not guess a human chapter."] }, true);
    assert.match(text(missingSection.result), /procedure.*found 0/);
    assert.equal(await readFile(hiddenPath, "utf8"), human, "Missing-section rejection preserves the human document");
    const readHuman = await run(humanWorker, "skill_read", { path: hiddenPath, limit: 12 });
    assert.match(text(readHuman.result), /HUMAN_BODY_PROOF_57391/);
    const unloaded = await run(editor, "skill_read", { path: hiddenPath }, undefined, true);
    assert.match(text(unloaded.result), /Skill file is not in an enabled loaded skill\./);
    assert.equal((await hidden()).distinctSessions, 1, "A rejected read from a session predating the skill does not count");
    await client.request("reload", { sessionId: editor });
    assert.equal((await hidden()).distinctSessions, 1, "Reloading the skill does not count as reading its body");
    const truncated = await run(editor, "skill_read", { path: hiddenPath });
    assert.equal(truncated.result.details.truncation.truncated, true);
    assert.equal((await hidden()).distinctSessions, 2, "A successful SDK-truncated skill_read counts even for an unadvertised skill");
    await run(nativeWorker, "read", { path: hiddenPath, offset: 8, limit: 1 });
    assert.equal((await hidden()).distinctSessions, 3, "A hidden skill's successful native local read also counts");
    await manage({ action: "delete", name: hiddenName });
    for (const [action, status, manual] of [["promote", "promoted", true], ["demote", "staging", false], ["archive", "archived", false]]) {
      const changed = (await post(`/api/skills/fixture-process/${action}`)).skills.find((item) => item.name === "fixture-process");
      assert.equal(changed.status, status);
      assert.equal(changed.manual, manual);
    }
    await run(editor, "skill_read", { path: join(home, "skills/fixture-process/SKILL.md") }, undefined, true);
    const archived = await current();
    const archivedConflict = await manage({ action: "create", ...fields }, true);
    assert.match(text(archivedConflict.result), /fixture-process.*already exists.*patch.*restoring/);
    assert.equal((await client.request("nativeAction", { sessionId: first, requestId: crypto.randomUUID(), action: "local-tools", args: { enabled: true } })).status, "completed");
    await client.request("reload", { sessionId: first });
    await run(first, "read", { path: bodyPath });
    assert.equal((await current()).distinctSessions, archived.distinctSessions, "A native read of an archived managed file does not count");
    assert.equal((await current()).lastUsedAt, archived.lastUsedAt, "Archived reads do not refresh lastUsedAt");
    await client.request("reload", { sessionId: editor });
    assert(!(await client.request("nativeCapabilities", { sessionId: editor })).resources.some((item) => item.name === "/skill:fixture-process" && item.loaded));
    assert.equal((await post("/api/skills/fixture-process/restore")).skills[0].status, "staging");
    await client.request("reload", { sessionId: editor });
    assert((await client.request("nativeCapabilities", { sessionId: editor })).resources.some((item) => item.name === "/skill:fixture-process" && item.loaded));
    assert.deepEqual(await post("/api/skills/fixture-process/delete"), { skills: [] });
    await assert.rejects(client.request("skillsRestore", { name: "fixture-process" }), (error) => error.code === "NOT_FOUND");
}
