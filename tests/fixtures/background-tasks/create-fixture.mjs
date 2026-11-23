import assert from "node:assert/strict";
import { createKernelAsyncFixture, text, until } from "../kernel-async-setting/create-fixture.mjs";

/** Real isolated target/Gateway/browser; faux decisions call the actual declared kernel and terminal tools. */
export async function createBackgroundTasksFixture(target) {
  const holds = new Map();
  let assistant, toolCall;
  const f = await createKernelAsyncFixture({ ...target, capabilities: { "lazy:tool:terminal_textsend": false }, respond: async (context, options, request) => {
    if (!assistant) {
      const api = await import("@earendil-works/pi-ai");
      assistant = api.fauxAssistantMessage;
      toolCall = api.fauxToolCall;
    }
    if (request.last?.role === "toolResult") return assistant("BACKGROUND_TOOL_OBSERVED");
    const command = /^BACKGROUND_TOOL (\{.*\})$/s.exec(text(request.last));
    if (command) {
      const input = JSON.parse(command[1]);
      request.id = input.id;
      assert(request.tools.includes(input.tool), `${input.tool} is directly declared in this fixture`);
      return assistant(toolCall(input.tool, input.args, { id: input.id }), { stopReason: "toolUse" });
    }
    const hold = holds.get(text(request.last));
    if (hold) {
      hold.signal = options.signal;
      assert(hold.signal, "the real SDK supplies the foreground model cancellation signal");
      hold.onAbort = () => { hold.aborted = true; hold.gate.resolve(); };
      hold.signal.addEventListener("abort", hold.onAbort, { once: true });
      try { await hold.gate.promise; return assistant(hold.reply); }
      finally { hold.signal.removeEventListener("abort", hold.onAbort); }
    }
    return assistant("BACKGROUND_NATIVE_EVENT_OBSERVED");
  } });
  target.onCleanup(() => { for (const hold of holds.values()) hold.gate.resolve(); });
  const send = async (message) => {
    await f.page.locator("#composer").fill(message);
    await f.page.locator("#send-message").click();
  };
  return { ...f,
    async tool(id, tool, args) {
      await f.idle();
      await send(`BACKGROUND_TOOL ${JSON.stringify({ id, tool, args })}`);
      const result = await until(() => f.results.get(id), `${id}: real SDK tool result consumed`);
      assert.equal(result.isError, false, text(result));
      await f.idle();
      return JSON.parse(text(result));
    },
    async hold(id) {
      await f.idle();
      const prompt = `BACKGROUND_HOLD_${id}`;
      const hold = { gate: Promise.withResolvers(), aborted: false, reply: `BACKGROUND_CONTINUED_${id}` };
      holds.set(prompt, hold);
      await send(prompt);
      await until(() => hold.signal, `${id}: foreground faux response entered`);
      const operation = (await f.state()).operation;
      assert(operation, "the model turn has a real active operation");
      return { operation, signal: hold.signal,
        async finish() {
          assert.equal(hold.aborted, false, "task interruption never aborts the foreground model request");
          assert.equal(hold.signal.aborted, false);
          hold.gate.resolve();
          const snapshot = await f.idle();
          assert(snapshot.messages.some((message) => message.role === "assistant" && text(message) === hold.reply), "the same foreground request completes its reply");
          assert.equal(snapshot.recentOperations?.find((entry) => entry.operationId === operation.operationId)?.status, "completed");
        },
      };
    },
    async terminals() {
      const response = await f.page.request.get(`${f.apiUrl}/api/sessions/${encodeURIComponent(f.sessionId)}/terminals`);
      assert.equal(response.status(), 200);
      return (await response.json()).terminals;
    },
  };
}
