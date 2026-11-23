import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleMemory } from "./assemble-memory.mjs";
import { sample } from "./sample.mjs";

/** Publish own-scope charges, including subprocesses; unavailable counters are never guessed. */
export function startMemoryTelemetry(intervalMs = 1000, publish) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2_147_483_647) {
    throw new TypeError("Remote host telemetryIntervalMs must be a timer integer from 1 to 2147483647");
  }
  if (!process.env.PRK_EXT_SCOPE_PATH) {
    console.error(`[${new Date().toISOString()}] [remote-extension host] running unscoped; cgroup memory telemetry unavailable`);
    return { stop() {} };
  }
  const groups = readFileSync("/proc/self/cgroup", "utf8").trim().split("\n").filter((line) => line.startsWith("0::"));
  const group = groups[0]?.slice(3);
  if (groups.length !== 1 || !group.startsWith("/") || !group.endsWith(".scope")) {
    throw new Error("Remote host memory telemetry requires its own cgroup-v2 systemd scope");
  }
  const scope = join("/sys/fs/cgroup", group);
  const ctx = assembleMemory(scope, publish);
  // Initial failures reject load, before the host can advertise a successful registration.
  publish(sample(ctx));
  ctx.timer = setInterval(() => {
    try { publish(sample(ctx)); }
    catch (error) {
      clearInterval(ctx.timer);
      console.error("[remote-extension host] memory telemetry failed:", error);
    }
  }, intervalMs);
  ctx.timer.unref();
  return { stop: ctx.stop };
}
