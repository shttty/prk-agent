import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkLocalHooks({ client, kernel, text, localCwd, events, generations, proof }) {
      const local = (await client.request("createSession", { target: "local" })).session.sessionId;
      const localEdit = await kernel('local_view = read("local.txt", limit=1)\nlocal_ref = local_view["lines"][0]["ref"]\nprint(edit("local.txt", [{"op":"replace", "start":local_ref, "end":local_ref, "text":"LOCAL_CHANGED"}]))', local);
      assert.match(text(localEdit.result), /LOCAL_CHANGED/);
      assert.equal(await readFile(join(localCwd, "local.txt"), "utf8"), "LOCAL_CHANGED\n");
      const localEvents = await events(localCwd);
      for (const phase of ["tool_call", "tool_result"]) {
        const entry = localEvents.find((event) => event.phase === phase && event.toolName === "edit");
        assert(entry, `Local native kernel edit must emit ${phase}`);
        assert.notEqual(entry.pid, process.pid, "Local instance plugin hooks execute in its independent session host");
        assert.equal(entry.input.path, join(localCwd, "local.txt"));
        assert.match(entry.toolCallId, /\/\d+$/);
      }
      assert(generations.some((entry) => entry.sessionId === local), "Local instances create their own plugin host");
      proof("local-native-kernel-hooks", { pid: localEvents.find((event) => event.toolName === "edit").pid, events: localEvents.filter((event) => event.toolName === "edit").map(({ phase, toolCallId }) => ({ phase, toolCallId })) });

return localEvents;
}
