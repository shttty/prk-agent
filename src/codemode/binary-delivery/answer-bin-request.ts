import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Static } from "typebox";
import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";
import { ARCH } from "./binary-platforms.ts";
import type { binRequest } from "./binary-request-schema.ts";

export async function answerBinRequest(dir: string, request: Static<typeof binRequest>): Promise<{ sha256: string; size: number }> {
  if (request.system !== "Linux") throw new Error(`tool_bin supports Linux targets only; this target reports ${JSON.stringify(request.system)}.`);
  const arch = ARCH[request.machine.toLowerCase()];
  if (!arch) throw new Error(`tool_bin supports x86_64 and aarch64 only; this target reports ${JSON.stringify(request.machine)}.`);
  const tools = readManifest(dir).tools;
  const tool = Object.hasOwn(tools, request.name) ? tools[request.name] : undefined;
  const asset = tool?.versions[tool.current]?.platforms[arch];
  if (!asset) throw new Error(`No current ${request.name} artifact for linux-${arch} on the Gateway.`);
  const sha256 = asset.sha256;
  const path = join(dir, "store", sha256);
  try {
    return { sha256, size: (await stat(path)).size };
  } catch (error) {
    throw new Error(`Cannot read Gateway artifact ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
