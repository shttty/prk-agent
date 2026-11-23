import { withTargetFixture } from "../../fixtures/target-fixture.mjs";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createPtyTerminals } from "../../../src/workspace/pty-terminals/assemble-terminals.ts";
import { createModelTerminals } from "../../../src/workspace/model-terminals/create-terminals.ts";
import { createTerminalTools } from "../../../src/plugins/terminals/tools/create-tools.ts";

export async function withTerminalFixture(check, terminalOptions = {}) {
  await withTargetFixture(async ({ config, runtime, tempRoot, onCleanup }) => {
    const previousHome = process.env.HOME;
    process.env.HOME = tempRoot;
    onCleanup(async () => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
    const options = parsePrkConfig({ terminal: { yieldMs: 1000, foregroundQuietMs: 10000, quietLadderMs: [200, 1000], ...terminalOptions } });
    const sessionId = "terminal-human-proof";
    const transport = createPtyTerminals({ workspace: options.workspace, acquire: runtime.acquire, runtime: async () => ({ python: config.python, basePython: config.python, env: {} }),
      ownerTarget: () => "fixture", onCleanupUnknown: (error) => { throw error; } });
    const terminals = createModelTerminals({ sessionId, context: config, terminals: transport, options: options.terminal, limits: options.limits });
    const tools = createTerminalTools(() => terminals);
    const notices = [];
    terminals.subscribe((event) => notices.push(event));
    onCleanup(async () => {
      await terminals.closeAll();
      await transport.closeSession(sessionId);
      await transport.shutdown();
    });
    const call = async (name, args = {}) => {
      const tool = tools.find((tool) => tool.name === name);
      if (!tool) throw new Error(`Missing registered tool: ${name}`);
      const result = await tool.execute("terminal-proof", args);
      return result.structuredContent;
    };
    const until = async (read, accepts, label, ms = 15000) => {
      const deadline = Date.now() + ms;
      for (;;) {
        const value = await read();
        if (accepts(value)) return value;
        if (Date.now() >= deadline) throw new Error(`Timed out: ${label}; ${JSON.stringify(value)}`);
        const pause = Promise.withResolvers();
        setTimeout(pause.resolve, 20);
        await pause.promise;
      }
    };
    await check({ call, transport, terminals, notices, until, config, tempRoot, sessionId });
  });
}
