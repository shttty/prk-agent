import assert from "node:assert/strict";
import { readFile, readlink } from "node:fs/promises";
import { join } from "node:path";
import { checkRemoteRegistration } from "./check-registration.mjs";

export async function checkCwdResourceExecution({ host, client, requests, generations, tempRoot, artifacts, send, invoke, exportedCwd, assertContextOrder, exists, put, configuration, samePath, targetRoot, targetCwd, childCwd, backingCwd, backingChild, CONFIG_DIR_NAME, waitForIdle, text }) {
    const assertProof = async (worker, backing, cwd) => {
      const start = JSON.parse(await readFile(join(backing, "resource-start.json"), "utf8"));
      const executed = JSON.parse(await readFile(join(backing, "resource-execution.json"), "utf8"));
      for (const proof of [start, executed]) {
        assert.equal(proof.marker, "TARGET_EXTENSION_PROOF_61842");
        assert.equal(proof.cwd, cwd);
        assert.equal(proof.sessionCwd, cwd, "The extension's public session manager reports the target cwd");
        assert.notEqual(proof.pid, process.pid, "The project extension executes in the real target host, never the Gateway");
      }
      assert.equal(start.phase, "session_start");
      assert.equal(executed.phase, "execute");
      assert.equal(executed.pid, start.pid);
      const generation = generations.find((entry) => entry.sessionId === worker && entry.host.registration?.tools.some((tool) => tool.name === "cwd_resource_proof"));
      assert(generation, "The direct project extension has a real remote host registration");
      assert.equal(generation.host.registration.pid, executed.pid);
      for (const filename of ["resource-start.json", "resource-execution.json"]) {
        assert.equal(await exists(join(cwd, filename)), false, "The Gateway's same absolute cwd must remain untouched");
      }
    };

    const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
    assert.equal(requests.length, 0, "Resource discovery and host startup must precede the first model request");
    const targetCache = join(tempRoot, ".cache/prk");
    const runtime = join(targetCache, "bin", artifacts.bun.sha256, "bun");
    assert.equal(await readlink(`/proc/${generations.find((entry) => entry.sessionId === worker).host.registration.pid}/exe`), runtime, "Project resource resolver and session host both run with the configured Bun artifact");
    assert.equal(await exists(join(targetCache, "remote-extensions", "binary")), false, "Bun resource discovery must not also transfer a Node runtime");
    await send(worker, "/cwd-template alpha", "auto");
    const first = requests[0];
    assert(first.firstSystem, "The provider receives an actual leading SDK system message on its FIRST request");
    assertContextOrder(first.firstSystem, ["TARGET_ANCESTOR_INSTRUCTIONS_61842", "TARGET_PARENT_INSTRUCTIONS_61842", "TARGET_CWD_INSTRUCTIONS_61842"]);
    assert(first.firstSystem.includes(`<cwd>\n${targetCwd}\n</cwd>`), "The SDK's actual first system prompt cwd is the target session cwd");
    assert(first.input.includes("TARGET_CWD_TEMPLATE_EXPANDED value=alpha"), "Actual slash send expands the target prompt template with its argument");
    assert(!first.input.includes("GATEWAY_"));
    for (const marker of ["TARGET_CWD_PI_SKILL_DESCRIPTION", "TARGET_CWD_AGENTS_SKILL_DESCRIPTION"]) assert(first.firstSystem.includes(marker), `${marker} is advertised on the first model call`);
    assert(!first.firstSystem.includes("SKILL_BODY_MUST_NOT_APPEAR"), "Discovery advertises skill frontmatter, not bodies");
    assert(first.firstSystem.includes("GLOBAL_ONLY_SKILL_61842"), "Gateway global skills survive the remote skills override");
    assert(!first.firstSystem.includes("GLOBAL_SHADOWED_SKILL_61842"), "The same-name target project skill overrides the Gateway global skill");
    assert(!first.firstSystem.includes("TARGET_HOME_"), "Target home skills are not advertised");
    await send(worker, "/global-template gamma", "auto");
    assert(requests.some((request) => request.role === "user" && request.input.includes("GLOBAL_TEMPLATE_EXPANDED_61842 value=gamma")), "Gateway global prompts survive the remote prompts override");
    assert(first.tools.includes("cwd_resource_proof"));
    const proofResult = host.session(worker).getSnapshot().messages.findLast((entry) => entry.role === "toolResult" && entry.toolName === "cwd_resource_proof");
    assert(proofResult && !proofResult.isError, "The first model turn actually executes the target project extension");
    assert.equal(JSON.parse(text(proofResult)).cwd, targetCwd);
    await assertProof(worker, backingCwd, targetCwd);
    const catalog = await client.request("nativeCapabilities", { sessionId: worker });
    assert.equal(catalog.target.current.autoCompaction, false, "Target project compaction setting overrides enabled Gateway defaults");
    assert.equal(catalog.target.current.autoRetry, false, "Target project retry setting overrides enabled Gateway defaults");
    assert(catalog.commands.some((entry) => entry.name === "cwd-template" && entry.source === "template"));
    for (const name of ["cwd-pi-skill", "cwd-agents-skill"]) assert(catalog.resources.some((entry) => entry.name === `/skill:${name}` && entry.loaded));
    assert(catalog.commands.some((entry) => entry.name === "global-template" && entry.source === "template"));
    for (const name of ["parent-template", "target-only-template", "outside-template"]) assert(!catalog.commands.some((entry) => entry.name === name), "Ancestor project prompts and target user prompts are excluded");
    assert.equal(await exportedCwd(worker), targetCwd, "Public SDK JSONL export records the actual target cwd, not merely worker metadata");
    const kernel = await invoke(worker, "kernel_code", { code: `import os\nassert os.getcwd() == ${JSON.stringify(targetCwd)}\nprint("TARGET_KERNEL_CWD_61842")`, title: "Target cwd proof" });
    assert(text(kernel).includes("TARGET_KERNEL_CWD_61842"));

    const spawned = JSON.parse(text(await invoke(worker, "session_spawn", { context: "Complete the assigned child task using the selected project resources.", tasks: [{ task: "CHILD_RESOURCE_FIRST_TURN_61842", label: "Child project resources", lifecycle: "persistent", target: "fixture", cwd: childCwd }] }))).children[0];
    const childWorker = host.workbench().sessions.find((entry) => entry.sessionId === spawned.sessionId);
    await waitForIdle(childWorker.sessionId);
    assert.equal(childWorker.cwd, childCwd);
    const childFirst = requests.find((entry) => entry.role === "user" && !entry.input.startsWith("TOOL ") && entry.input.includes("CHILD_RESOURCE_FIRST_TURN_61842"));
    assert(childFirst?.firstSystem, "The actual spawned child makes a first model request");
    assertContextOrder(childFirst.firstSystem, ["TARGET_ANCESTOR_INSTRUCTIONS_61842", "TARGET_PARENT_INSTRUCTIONS_61842", "TARGET_CHILD_INSTRUCTIONS_61842"]);
    assert(!childFirst.firstSystem.includes("TARGET_CWD_INSTRUCTIONS_61842"), "An explicit child cwd must not inherit the parent's cwd context file");
    assert(childFirst.firstSystem.includes("TARGET_CHILD_PI_SKILL_DESCRIPTION"));
    assert(childFirst.firstSystem.includes("TARGET_CHILD_AGENTS_SKILL_DESCRIPTION"));
    assert(!childFirst.firstSystem.includes("TARGET_CWD_PI_SKILL_DESCRIPTION"));
    await assertProof(childWorker.sessionId, backingChild, childCwd);
    const childCatalog = await client.request("nativeCapabilities", { sessionId: childWorker.sessionId });
    assert.equal(childCatalog.target.current.autoCompaction, true, "Explicit child cwd selects that project's settings, not the parent's snapshot");
    assert.equal(childCatalog.target.current.autoRetry, false);
    assert(childCatalog.commands.some((entry) => entry.name === "child-template" && entry.source === "template"));
    assert(!childCatalog.commands.some((entry) => entry.name === "cwd-template" && entry.source === "template"));
    assert.equal(await exportedCwd(childWorker.sessionId), childCwd);
    assert.deepEqual((await host.pluginsList()).packages, [], "Project extension loading does not require configured native packages");
    await checkRemoteRegistration({ host, client, sessionId: worker, backingCwd, targetCwd, configDir: CONFIG_DIR_NAME });

    const assertLimitFailure = async (cwd, path, limit) => {
      const modelRequests = requests.length;
      await assert.rejects(() => client.request("createSession", { target: "fixture", cwd }), (error) => {
        assert(error.message.includes(path), `Resource failure names its target path: ${error.message}`);
        assert(error.message.includes(String(limit)), `Resource failure names the byte limit ${limit}: ${error.message}`);
        assert.match(error.message, /limit|exceed|large/iu);
        return true;
      });
      assert.equal(requests.length, modelRequests, "Over-limit context fails before any model turn; no truncated or Gateway fallback request is sent");
    };
    const oversizeCwd = join(samePath, "oversize");
    await put(join(targetRoot, "oversize", "AGENTS.md"), "x".repeat(configuration.limits.contextFileBytes + 1));
    await assertLimitFailure(oversizeCwd, join(oversizeCwd, "AGENTS.md"), configuration.limits.contextFileBytes);
    const oversizePromptCwd = join(samePath, "oversize-prompt");
    await put(join(targetRoot, "oversize-prompt", CONFIG_DIR_NAME, "prompts", "oversize.md"), "p".repeat(configuration.limits.contextFileBytes + 1));
    await assertLimitFailure(oversizePromptCwd, join(oversizePromptCwd, CONFIG_DIR_NAME, "prompts", "oversize.md"), configuration.limits.contextFileBytes);
    const totalRelative = ["total"];
    for (let index = 0; index < 5; index++) {
      await put(join(targetRoot, ...totalRelative, "AGENTS.md"), "t".repeat(configuration.limits.contextFileBytes - 1024));
      if (index < 4) totalRelative.push(`level-${index}`);
    }
    await assertLimitFailure(join(samePath, ...totalRelative), join(samePath, "total"), configuration.limits.contextTotalBytes);
    for (const cwd of [targetCwd, childCwd]) for (const filename of ["resource-start.json", "resource-execution.json"]) {
      assert.equal(await exists(join(cwd, filename)), false, "All project execution proofs remain exclusively on the target backing mount");
    }
    console.log("PASS session cwd resources: first target AGENTS order and cwd, Gateway same-path exclusion, effective project settings, actual prompt expansion, Pi/.agents skills, target-only direct extension execution, explicit spawn cwd resources, file/total byte-cap wire failures");
}
