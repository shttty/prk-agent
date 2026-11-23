import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../prepare-gateway-environment.mjs";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../target-fixture.mjs";

export async function withGatewayValues(check, plugins = false) {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const home = await mkdtemp(join(tmpdir(), "prk-pyvalues-"));
    const agentDir = join(home, "agent");
    await mkdir(agentDir);
    if (plugins) {
      const source = join(home, "plugin");
      await mkdir(source);
      await writeFile(join(source, "package.json"), JSON.stringify({ name: "prk-python-values", type: "module", pi: { extensions: ["index.mjs"] } }));
      await copyFile(new URL("./structured-plugin.mjs", import.meta.url), join(source, "index.mjs"));
      await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "gateway" }] }));
    }
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "python-values", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(provider.provider);
    provider.setResponses(Array.from({ length: 300 }, () => (context) => {
      const last = context.messages.at(-1);
      const text = typeof last?.content === "string" ? last.content : (last?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
      if (last?.role === "user" && text.startsWith("CELL ")) return fauxAssistantMessage(fauxToolCall("kernel_code", { code: JSON.parse(text.slice(5)) }), { stopReason: "toolUse" });
      return fauxAssistantMessage("Controlled idle response.");
    }));
    const host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig({ session: { noExtensions: !plugins, localTools: true, askTimeoutMs: 40 }, memory: { review: false } }), model: "python-values/controlled", targets: [executionTargetFromConfig({ ...config, id: "local", label: "local", local: true, cwd: home })] }, { runtimeDependencies: { cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off" } });
    onCleanup(async () => { await host.close(); await rm(home, { recursive: true, force: true }); });
    await prepareGatewayEnvironment(host, home, "local");
    const worker = (await host.createSession({ target: "local" })).session.sessionId;
    const run = async (name, code, error = false) => {
      const operation = await host.session(name).submit({ requestId: randomUUID(), message: `CELL ${JSON.stringify(code)}` });
      assert.equal(operation.accepted, true);
      assert.equal((await operation.completion).status, "completed");
      const snapshot = host.session(name).getSnapshot();
      const projected = snapshot.messages.findLast((message) => message.role === "toolResult" && message.toolName === "kernel_code");
      const result = projected?.outputPreview ? host.toolContent(name, projected.toolCallId).result : projected;
      const text = result?.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
      assert(result, "The real SDK executed kernel_code");
      assert.equal(result.isError, error, text);
      return { result, text };
    };
    await writeFile(join(home, "native.txt"), "needle before\n");
    await writeFile(join(home, "plugin.json"), "{}\n");
    await check({ host, home, sessionId: worker, run });
  });
}
