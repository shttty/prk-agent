import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parseProcessWindowLimits } from "../../src/target-environment/process-window/parse-limits.ts";
import { verifyGatewayCallbacks } from "../fixtures/tool-library/verify-gateway-callbacks.mjs";
import { createTarget } from "./fixtures/create-target.mjs";

const environment = await createTarget(process.argv[2] ?? "local");
const home = environment.home;
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir, { recursive: true });
const cleanups = [];
try {
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  await verifyGatewayCallbacks({ modelRuntime, environment, home, agentDir,
    configuration: { python: environment.python, cwd: environment.root, acquire: environment.acquire,
      processWindow: parseProcessWindowLimits(), memoryMax: "4G", memorySwapMax: "0", scoped: false },
    onCleanup: (cleanup) => cleanups.push(cleanup),
    text: (result) => result.content.filter(({ type }) => type === "text").map(({ text }) => text).join("\n"),
  });
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", root: environment.root, gatewayLibrary: true }));
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup();
  await environment.close();
}
