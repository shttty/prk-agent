import assert from "node:assert/strict";
import { join } from "node:path";

export async function createProbeProvider({ ModelRuntime, fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentSystemPrompt, getCurrentTools, agentDir, text, ns, remoteReload, mode, getActive }) {
      const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const faux = fauxProvider({ provider: "spawn-bench", models: [{ id: "parent" }, { id: "child" }], tokensPerSecond: 100000000 });
      runtime.registerNativeProvider(faux.provider);
      const result = (name, arguments_) => fauxAssistantMessage(fauxToolCall(name, arguments_), { stopReason: "toolUse" });
      const kernelProbe = `import time as _bt\n_bench_ready_ns = _bt.monotonic_ns()\nimport os as _bo, json as _bj\nfrom pathlib import Path as _BP\n_bench_scope = next(line[3:] for line in _BP('/proc/self/cgroup').read_text().splitlines() if line.startswith('0::'))\nprint('SPAWN_BENCH_KERNEL ' + _bj.dumps({'readyNs':str(_bench_ready_ns),'pid':_bo.getpid(),'scope':_bench_scope,'memoryCurrent':int((_BP('/sys/fs/cgroup') / _bench_scope.lstrip('/') / 'memory.current').read_text())}))`;
      function contextSize(context) {
        const system = getCurrentSystemPrompt(context.messages);
        const tools = getCurrentTools(context.messages);
        const task = text(context.messages.findLast((entry) => entry.role === "user"));
        const toolsJson = JSON.stringify(tools);
        const chars = [...system + toolsJson + task].length;
        return { systemChars: [...system].length, toolsChars: [...toolsJson].length, taskChars: [...task].length,
          totalChars: chars, estimatedTokens: Math.ceil(chars / 4), utf8Bytes: Buffer.byteLength(system + toolsJson + task), toolNames: tools.map((tool) => tool.name) };
      }
      faux.setResponses(Array.from({ length: 10000 }, () => (context, _options, _state, model) => {
        const active = getActive();
        assert(active, "Unexpected provider request outside a measured operation");
        const last = context.messages.at(-1);
        if (model.id === "parent") {
          if (last?.role === "toolResult") {
            assert(!last.isError, text(last));
            if (last.toolName === "session_spawn") {
              const body = text(last);
              const match = body.match(/\{[^\n]*"sessionId"[^\n]*\}/);
              active.receipt = JSON.parse(match ? match[0] : body).children[0];
              active.admissionNs = ns();
            }
            return fauxAssistantMessage("Parent tool completed.");
          }
          const command = /^BENCH_PARENT (\{.*\})$/s.exec(text(last));
          if (command) {
            const { tool, args: toolArgs } = JSON.parse(command[1]);
            if (tool === "session_spawn") active.spawnNs = ns();
            // Parent is independently set direct so spawn measurement excludes parent kernel startup.
            return result(tool, toolArgs);
          }
          if (text(last).includes(active.marker)) active.resultProviderNs ??= ns();
          return fauxAssistantMessage("Parent received result.");
        }
        assert.equal(model.id, "child");
        if (last?.role !== "toolResult") {
          const measured = contextSize(context);
          if (!active.firstContext) { active.firstContext = measured; active.firstRequestNs = ns(); }
          else active.postReloadContext = measured;
          if (active.idleOnly || (remoteReload && !active.activated)) return fauxAssistantMessage("Admitted; awaiting benchmark activation.");
          active.kernelDispatchNs = ns();
          return result("kernel_code", { code: kernelProbe, title: "Spawn benchmark" });
        }
        assert(!last.isError, text(last));
        const probe = /SPAWN_BENCH_KERNEL (\{[^\n]+\})/.exec(text(last));
        if (probe) {
          active.kernel = JSON.parse(probe[1]);
          active.kernelReturnNs = ns();
          return mode === "direct" ? result("session_result", { summary: active.marker })
            : result("kernel_code", { code: `gateway.session_result(summary=${JSON.stringify(active.marker)})`, title: "Submit benchmark result" });
        }
        return fauxAssistantMessage("Child result submitted.");
      }));
  return { runtime, faux };
}
