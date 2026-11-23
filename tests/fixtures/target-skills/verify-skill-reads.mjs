import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function verifySkillReads({ provider, host, sessionId: worker, action, catalog, near, far, targetHome, globalHome, winner, loser, client, web, home }) {
  const { fauxAssistantMessage, fauxToolCall, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const text = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const run = async (tool, args, error = false) => {
    let prompt;
    provider.setResponses([
      (context) => { prompt = getSystemMessageText(getCurrentSystemMessage(context.messages)); return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" }); },
      fauxAssistantMessage("Observed target skill operation."),
    ]);
    const admitted = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: "Exercise target skill operation." });
    assert.equal(admitted.accepted, true);
    assert.equal((await admitted.completion).status, "completed");
    const result = host.state(worker).messages.findLast((message) => message.role === "toolResult");
    assert.equal(result.isError, error, text(result));
    return { result, prompt };
  };
  const checkSkillFiles = async (directory, expected) => {
    const read = await run("skill_read", { path: `${directory}/x/SKILL.md` });
    const output = text(read.result);
    assert(output.includes(`Base directory for this skill: ${directory}/x`));
    assert.deepEqual([...output.matchAll(/<file>(.*?)<\/file>/gu)].map((match) => match[1]), expected.map((file) => `${directory}/x/${file}`));
    assert(!output.includes("SUPPORT_CONTENT_NOT_READ_27391"), "Supporting file contents are not read");
    await mkdir(join(directory, "x/files"));
    for (let index = 11; index >= 0; index--) await writeFile(join(directory, `x/files/${String(index).padStart(2, "0")}.txt`), "not read\n");
    const capped = text((await run("skill_read", { path: `${directory}/x/SKILL.md`, offset: 1, limit: 1 })).result);
    assert.deepEqual([...capped.matchAll(/<file>(.*?)<\/file>/gu)].map((match) => match[1]), [".notes/info.txt", ...Array.from({ length: 9 }, (_, index) => `files/0${index}.txt`)].map((file) => `${directory}/x/${file}`), "Sorted first ten paths are appended even to paginated body reads");
    const codeRead = text((await run("kernel_code", { code: `print(gateway.skill_read(path=${JSON.stringify(`${directory}/x/SKILL.md`)}, offset=1, limit=1))` })).result);
    assert(codeRead.includes(`<file>${directory}/x/.notes/info.txt</file>`), "Code-mode structured output includes the same file appendix");
    return read;
  };
  const read = await checkSkillFiles(near, [".notes/info.txt", "references/extra.md", "references/r.md", "sub/SKILL.md", "support.txt"]);
  assert.match(text(read.result), /NEAR_BODY_27391/);
  assert(read.prompt.includes("NEAR_BODY_27391"));
  assert(!read.prompt.includes("FAR_BODY_27391"));
  assert.match(text((await run("skill_read", { path: `${near}/x/support.txt` })).result), /SUPPORT_BODY_27391/);
  for (const path of [`${near}/x/references/r.md`, `${near}/x/sub/SKILL.md`, `${near}/root.md`]) {
    const output = text((await run("skill_read", { path })).result);
    assert(!output.includes("<skill_files>"));
    assert(!output.includes("Base directory for this skill:"));
  }
  assert.match(text((await run("skill_read", { path: `${far}/x/SKILL.md` }, true)).result), /shadow|covered|覆盖/iu);
  for (const name of ["x", "y"]) await run("skill_read", { path: `${targetHome}/${name}/SKILL.md` }, true);
  const beforeSwitches = host.state(worker);
  await action("capabilities", { changes: [{ id: winner, enabled: false }] });
  assert.equal((await catalog()).entries.find((entry) => entry.id === loser).shadowedBy, undefined, "Disabling winner immediately projects next enabled candidate");
  assert.equal((await catalog()).requiresReload, false);
  assert.equal((await catalog()).entries.find((entry) => entry.id === winner).loaded, true);
  const fallback = await run("skill_read", { path: `${far}/x/SKILL.md` });
  assert.match(text(fallback.result), /FAR_BODY_27391/);
  assert(fallback.prompt.includes("FAR_BODY_27391") && !fallback.prompt.includes("NEAR_BODY_27391"), "The next request advertises the current same-name winner");
  assert.match(text((await run("skill_read", { path: `${near}/x/SKILL.md` }, true)).result), /shadow|enabled loaded/iu);
  await action("capabilities", { changes: [{ id: loser, enabled: false }] });
  assert.equal((await catalog()).entries.find((entry) => entry.id === `skill:${globalHome}/x/SKILL.md`).shadowedBy, undefined, "Gateway global wins when all project copies are disabled");
  assert.equal((await catalog()).requiresReload, false);
  const globalRead = await checkSkillFiles(globalHome, [".notes/info.txt", "references/r.md", "sub/SKILL.md"]);
  assert(globalRead.prompt.includes("GLOBAL_BODY_27391") && !globalRead.prompt.includes("NEAR_BODY_27391") && !globalRead.prompt.includes("FAR_BODY_27391"));
  for (const path of [`${globalHome}/x/references/r.md`, `${globalHome}/x/sub/SKILL.md`]) {
    assert(!text((await run("skill_read", { path })).result).includes("<skill_files>"));
  }
  await action("capabilities", { changes: [{ id: loser, enabled: null }] });
  await action("capabilities", { changes: [{ id: winner, enabled: true }] });
  const restored = await run("skill_read", { path: `${near}/x/SKILL.md` });
  assert.match(text(restored.result), /NEAR_BODY_27391/);
  assert(restored.prompt.includes("NEAR_BODY_27391") && !restored.prompt.includes("GLOBAL_BODY_27391"));
  const uniquePath = `${globalHome}/gateway-only/SKILL.md`;
  await action("capabilities", { changes: [{ id: `skill:${uniquePath}`, enabled: false }] });
  const denied = await run("skill_read", { path: uniquePath }, true);
  assert.match(text(denied.result), /enabled loaded skill/iu, "Closed skills reject body reads immediately");
  assert(!denied.prompt.includes("<name>gateway-only</name>"), "Closed skills disappear from the next request");
  await action("capabilities", { changes: [{ id: `skill:${uniquePath}`, enabled: true }] });
  const reopened = await run("skill_read", { path: uniquePath });
  assert.match(text(reopened.result), /GATEWAY_ONLY_BODY_27391/);
  assert(reopened.prompt.includes("<name>gateway-only</name>"));
  assert.equal((await catalog()).requiresReload, false);
  assert.equal(host.state(worker).sessionId, beforeSwitches.sessionId);
  assert.equal(host.state(worker).kernel.kernelId, beforeSwitches.kernel.kernelId);
  await run("skill_manage", { action: "create", name: "other-instance", scope: "instance:elsewhere", description: "OTHER_INSTANCE_27391", whenToUse: "Fixture isolation", evidence: "Target skill scope fixture", procedure: ["Observe isolation"], pitfalls: [], verification: [] });
  await action("reload");
  const excluded = await catalog();
  assert(!excluded.entries.some((entry) => entry.name === "other-instance"), "Nonmatching shared skill is not injected into session catalog");
  assert.equal(excluded.requiresReload, false);
  const changed = await client.request("skillsScope", { name: "other-instance", scope: "instance:fixture" });
  assert.equal(changed.skills.find((entry) => entry.name === "other-instance").scope, "instance:fixture");
  await action("reload");
  const sharedPath = join(home, "skills/other-instance/SKILL.md");
  assert.match(text((await run("skill_read", { path: sharedPath })).result), /OTHER_INSTANCE_27391/);
  assert.equal((await client.request("skillsList")).skills[0].distinctSessions, 1, "Only successful shared body reads count");
  const scopeUrl = `${web.url}/api/skills/other-instance/scope`;
  for (const body of [{ scope: "instance:" }, { scope: "global", name: "other-instance" }, { scope: "global\n" }, {}]) {
    const response = await fetch(scopeUrl, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body) });
    assert.equal(response.status, 400, await response.text());
  }
  const response = await fetch(scopeUrl, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify({ scope: "project:target-project" }) });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).skills[0].scope, "project:target-project");
  assert.equal((await catalog()).requiresReload, true, "Scope changes mark existing loadout for reload");
  await action("reload");
  assert(!(await catalog()).entries.some((entry) => entry.name === "other-instance"));
  await client.request("assignProject", { sessionId: worker, project: { id: "target-project", name: "Target project" } });
  await action("reload");
  assert((await catalog()).entries.some((entry) => entry.name === "other-instance"), "Matching projectId injects project skill");
  await run("skill_manage", { action: "patch", name: "other-instance", section: "scope", value: "global" });
  assert.equal((await client.request("skillsList")).skills[0].scope, "global");
  await client.request("assignProject", { sessionId: worker, project: null });
  await action("reload");
  assert((await catalog()).entries.some((entry) => entry.name === "other-instance"), "Global skill survives leaving project");
}
