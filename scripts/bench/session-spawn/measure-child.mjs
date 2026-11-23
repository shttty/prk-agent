import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export async function measureChild({ setActive, idle, parent, fixture, remoteReload, call, targetName, action, host, mode, native, ns, ms, until, text }, index, { idleOnly = false, cold = false } = {}) {
      async function processMemory(pid) {
        const status = await readFile(`/proc/${pid}/status`, "utf8");
        const scope = (await readFile(`/proc/${pid}/cgroup`, "utf8")).split("\n").find((line) => line.startsWith("0::")).slice(3);
        const current = Number(await readFile(join("/sys/fs/cgroup", scope, "memory.current"), "utf8"));
        return { pid, rssBytes: Number(/^VmRSS:\s+(\d+)/m.exec(status)[1]) * 1024, scope, scopeMemoryCurrent: current };
      }
        await idle(parent);
        if (cold) await rm(join(fixture.tempRoot, "target-cache"), { recursive: true, force: true });
        const active = { index, marker: `SPAWN_BENCH_RESULT_${randomUUID()}`, wireBytes: 0, assetBytes: 0, assetByHash: {}, assetMetadata: [], idleOnly, activated: false };
        setActive(active);
        const beforeRss = process.memoryUsage.rss();
        await call("session_spawn", { context: "Execute only the requested minimal kernel probe on the selected benchmark target and submit the measured result.", tasks: [{ task: "Execute one minimal kernel probe, then submit the benchmark result.", label: "Measured child", target: targetName, lifecycle: "persistent", model: "spawn-bench/child", thinkingLevel: "off" }] });
        assert(active.receipt?.sessionId, "Real session_spawn admission missing");
        const child = active.receipt.sessionId;
        await until(() => active.firstContext, "first child provider request");
        await idle(child);
        if (remoteReload) {
          await action(child, "local-tools", { enabled: true });
          active.reloadStartNs = ns();
          await action(child, "reload");
          active.reloadEndNs = ns();
          active.activated = true;
          const submission = await host.session(child).submit({ requestId: randomUUID(), message: "Execute one minimal kernel probe, then submit the benchmark result." });
          assert(submission.accepted);
          assert.equal((await submission.completion).status, "completed");
        }
        if (!idleOnly) {
          await until(() => active.resultProviderNs, "parent provider result delivery");
          await idle(parent);
          await idle(child);
          assert(active.kernel, "Child must actually execute Python");
          assert(host.state(parent).messages.some((message) => message.role === "custom" && text(message).includes(active.marker)), "Parent history must contain the real result notification");
        }
        const current = host.nativeCapabilities(child).target.current;
        assert.equal(current.toolMode, mode);
        assert.equal(current.localTools, native);
        const measured = remoteReload ? active.postReloadContext : active.firstContext;
        assert(measured.toolNames.includes("read") === native);
        assert(measured.toolNames.includes("session_spawn") === (mode === "direct"));
        const hostMemory = active.hostPid ? await processMemory(active.hostPid) : null;
        const liveRss = process.memoryUsage.rss();
        const row = { index, child, beforeRss, liveRss, firstContext: active.firstContext,
          ...(active.postReloadContext ? { postReloadContext: active.postReloadContext } : {}),
          kernel: active.kernel, kernelId: host.state(child).kernel?.kernelId,
          host: hostMemory,
          timingNs: Object.fromEntries(Object.entries(active).filter(([, value]) => typeof value === "bigint").map(([key, value]) => [key, String(value)])),
          assetMetadata: active.assetMetadata, assetByHash: active.assetByHash,
          metrics: { spawnAdmissionMs: ms(active.spawnNs, active.admissionNs), childFirstRequestMs: ms(active.spawnNs, active.firstRequestNs),
            gatewaySpawnMs: ms(active.spawnToolStartNs, active.spawnToolEndNs), gatewayAdmissionDeltaBytes: active.admissionRss - beforeRss,
            gatewayLiveDeltaBytes: liveRss - beforeRss, contextChars: measured.totalChars, contextEstimatedTokens: measured.estimatedTokens,
            channelSentBytes: active.wireBytes, assetBytes: active.assetBytes } };
        if (!idleOnly) Object.assign(row.metrics, {
          kernelReadyMs: ms(active.kernelDispatchNs, BigInt(active.kernel.readyNs)), kernelRoundTripMs: ms(active.kernelDispatchNs, active.kernelReturnNs),
          kernelMemoryCurrentBytes: active.kernel.memoryCurrent,
          endToEndProviderMs: ms(active.spawnNs, active.resultProviderNs),
          ...(active.parentReceivedNs ? { endToEndMessageMs: ms(active.spawnNs, active.parentReceivedNs) } : {}),
        });
        if (active.hostReadyNs) Object.assign(row.metrics, {
          hostDeployReadyMs: ms(active.deployStart, active.hostReadyNs), hostProcessReadyMs: ms(active.hostStart, active.hostReadyNs),
          hostRssBytes: row.host.rssBytes, hostSharedScopeBytes: row.host.scopeMemoryCurrent, reloadMs: ms(active.reloadStartNs, active.reloadEndNs),
        });
        return row;
      }
