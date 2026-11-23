import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function verifySkillReading({ home, create, run, client, referencePath, bodyPath, external, current, initialEntry, text }) {
  let entry = initialEntry;
    const combinations = [["code", false], ["direct", false], ["code", true], ["direct", true]];
    for (const [mode, localTools] of combinations) {
      const untouched = await create(mode, localTools);
      const advertised = await run(untouched, "kernel_code", { code: "print('catalog only; no skill body read')" });
      assert.match(advertised.systemPrompt, /<name>fixture-process<\/name>/, "Untouched staging skill is still advertised");
      if (mode === "code") {
        await run(untouched, "kernel_code", { code: `print(gateway.skill_read(path=${JSON.stringify(referencePath)}))` });
        await run(untouched, "kernel_code", { code: `gateway.skill_read(path=${JSON.stringify(bodyPath)}, offset=10000)` }, undefined, true);
      } else {
        await run(untouched, "skill_read", { path: referencePath });
        await run(untouched, "skill_read", { path: bodyPath, offset: 10000 }, undefined, true);
      }
      if (localTools) {
        await run(untouched, "read", { path: referencePath });
        await run(untouched, "read", { path: external });
        await run(untouched, "read", { path: bodyPath, offset: 10000 }, undefined, true);
        await run(untouched, "read", { path: "skills/fixture-process/SKILL.md" });
        await run(untouched, "bash", { command: `cat ${JSON.stringify(bodyPath)}` });
      }
      const expanded = await run(untouched, "kernel_code", { code: "print('slash transport without a counted read event')" }, "/skill:fixture-process explicit request");
      assert.match(expanded.userInput, /BODY_PROOF_61942/, "Native slash expansion still supplies the skill body");
      assert.equal((await current()).distinctSessions, 0, "Supporting/unrelated/failed reads, relative native reads, bash and slash must not create body-read usage");
      assert.equal((await current()).lastUsedAt, undefined);
    }
    entry = (await client.request("skillsList", {})).skills[0];
    assert.equal(entry.distinctSessions, 0, "Multiple native sessions advertising an untouched skill must not count as reads");
    assert.equal(entry.lastUsedAt, undefined, "Loading does not set a last-read timestamp");
    assert.equal(entry.status, "staging", "An unread skill must not auto-promote after multiple advertisements");
    const bodyOffset = entry.content.split("\n").findIndex((line) => line.includes("BODY_PROOF_61942")) + 1;
    for (const [index, [mode, localTools]] of combinations.entries()) {
      const worker = await create(mode, localTools);
      const catalog = await client.request("nativeCapabilities", { sessionId: worker });
      assert(catalog.resources.some((item) => item.type === "skill" && item.name === "/skill:fixture-process" && item.loaded), "Next native SDK session discovers staging skill");
      const path = join(home, "skills", "fixture-process", "SKILL.md");
      const observed = localTools
        ? await run(worker, "read", { path, offset: bodyOffset, limit: 1 })
        : mode === "code"
          ? await run(worker, "kernel_code", { code: "body = gateway.skill_read(path='fixture-process/SKILL.md')\nassert 'BODY_PROOF_61942' in body\nprint(body)" })
          : await run(worker, "skill_read", { path, offset: bodyOffset, limit: 1 });
      assert.match(observed.systemPrompt, /<available_skills>/, `${mode} effective provider system prompt advertises native loaded skills`);
      assert.match(observed.systemPrompt, /<name>fixture-process<\/name>/);
      assert.equal((observed.systemPrompt.match(/<name>fixture-process<\/name>/gu) ?? []).length, 1, "Native catalog must not be duplicated");
      assert.equal(observed.systemPrompt.includes("<name>external-native</name>"), true, "Loaded native skills are advertised in both modes independently of local host tools");
      assert.match(text(observed.result), /BODY_PROOF_61942/, `${mode} model receives Gateway-host skill body content, not only its description`);
      const counted = await current();
      const expectedSessions = index + 1;
      assert.equal(counted.distinctSessions, expectedSessions, "Successful skill_read and native read in code/direct count each native session");
      assert.equal(counted.status, expectedSessions >= 3 ? "promoted" : "staging", "Only real reads reach the configured promotion threshold");
      assert(counted.lastUsedAt);
      if (mode === "code") assert.deepEqual(observed.declarations, ["kernel_code", "kernel_interrupt", "kernel_read", ...(localTools ? ["bash", "edit", "find", "grep", "ls", "read", "write"] : [])].sort());
      else {
        assert(observed.declarations.includes("tool_search") && observed.declarations.includes("tool_call"));
        for (const name of ["skill_manage", "skill_read"]) assert(!observed.declarations.includes(name) && observed.systemPrompt.includes(name), `${name} remains available on demand`);
      }
      assert.equal(observed.declarations.includes("read"), localTools, "Native skill readers are declared only with the switch on");
      const reference = join(home, "skills", "fixture-process", "references", "steps.md");
      const readReference = mode === "code"
        ? await run(worker, "kernel_code", { code: `print(gateway.skill_read(path=${JSON.stringify(reference)}))` })
        : await run(worker, "skill_read", { path: reference });
      assert.match(text(readReference.result), /REFERENCE_PROOF_41873/, `${mode} can read native skill supporting files on the Gateway`);
      const expanded = await run(worker, "kernel_code", { code: "print('native skill expansion observed')" }, "/skill:fixture-process explicit request");
      assert.match(expanded.userInput, /^<skill name="fixture-process" location="/);
      assert.match(expanded.userInput, /BODY_PROOF_61942/);
      assert.match(expanded.userInput, /explicit request$/);
      const externalExpanded = await run(worker, "kernel_code", { code: "print('external native command observed')" }, "/skill:external-native explicit native command");
      assert.match(externalExpanded.userInput, /EXTERNAL_NATIVE_BODY_78613/, "Nonshared native slash expansion remains supported in every mode");
      if (localTools) assert.match(text((await run(worker, "read", { path: external })).result), /EXTERNAL_NATIVE_BODY_78613/);
      assert.equal((await current()).lastUsedAt, counted.lastUsedAt, "Support reads and slash expansion do not refresh lastUsedAt");
      if (localTools) await run(worker, "read", { path });
      else if (mode === "code") await run(worker, "kernel_code", { code: `print(gateway.skill_read(path=${JSON.stringify(path)}))` });
      else await run(worker, "skill_read", { path });
      assert.equal((await current()).distinctSessions, expectedSessions, "Repeated reads in the same SDK session deduplicate");
      assert((await current()).lastUsedAt > counted.lastUsedAt, "A repeated successful body read refreshes lastUsedAt");
      if (process.env.PI_TEST_SKILL_EVIDENCE) {
        await mkdir(process.env.PI_TEST_SKILL_EVIDENCE, { recursive: true });
        await writeFile(join(process.env.PI_TEST_SKILL_EVIDENCE, `native-skill-${mode}-${localTools ? "on" : "off"}.json`), JSON.stringify({ mode, localTools, declarations: observed.declarations, systemPrompt: observed.systemPrompt, readBody: text(observed.result), readReference: text(readReference.result), expandedUserInput: expanded.userInput }, null, 2) + "\n");
      }
    }
    entry = (await client.request("skillsList", {})).skills[0];
    assert.equal(entry.distinctSessions, 4);
    assert.equal(entry.status, "promoted");
    assert.match(entry.body, /## Procedure/);
    assert(!entry.body.includes("when-to-use:"));
    const nativeWorker = await create("code", true);
    await run(nativeWorker, "read", { path: bodyPath, offset: bodyOffset, limit: 1 });
    assert.equal((await current()).distinctSessions, 5, "Successful absolute native read counts without skill_read in code mode");
  return nativeWorker;
}
