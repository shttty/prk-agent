/** A Gateway with two worker sessions, its web API and a Vite UI. */
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseTargets } from "../target-instances/parse-targets.mjs";

export async function stack(ctx, session = {}) {
    const dir = await mkdtemp(join(ctx.root, "stack-"));
    const host = await ctx.createGatewayHost({ cwd: dir, home: dir, historyDir: join(dir, "history"), targets: parseTargets([{ id: "fixture", label: "Fixture", ...ctx.config, cwd: ctx.root }]), model: "ask-ui/controlled", config: ctx.parsePrkConfig({ session: { workerTools: "direct", ...session } }) }, { runtimeDependencies: { cwd: dir, agentDir: ctx.agentDir, model: ctx.provider.getModel(), modelRuntime: ctx.runtime, thinkingLevel: "off" } });
    const gateway = await ctx.startGateway(host, join(dir, "g.sock"));
    const client = await ctx.connectGateway(join(dir, "g.sock"));
    const main = (await client.request("createSession", { target: "fixture", label: "asker" })).session.sessionId;
    const other = (await client.request("createSession", { target: "fixture", label: "bystander" })).session.sessionId;
    const web = await ctx.startWebApplication({ socket: join(dir, "g.sock"), host: "127.0.0.1", port: 0 });
    const ui = await ctx.startWebDev(web.server.url);
    const entry = {
      host, main, other, ui,
      prompts: (name = main) => host.state(name).extensionUi.prompts.filter((prompt) => prompt.kind === "ask"),
      /** What the model was shown for the tool result of the turn that just ended. */
      async toolResult() {
        await ctx.until(() => host.state(main).state, (state) => state === "idle", "turn end");
        return ctx.contexts.findLast((context) => context.messages.at(-1)?.role === "toolResult").messages.at(-1);
      },
      async close() { await ui.close(); await web.close(); client.disconnect(); await gateway.close(); },
    };
    ctx.stacks.push(entry);
    return entry;
  }
