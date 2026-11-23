import { createReadStream, readFileSync } from "node:fs";
import type { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { createTransferContext } from "./create-transfer-context.ts";

const installSource = readFileSync(new URL("./install-transferred-artifact.sh", import.meta.url), "utf8");

export async function writeTransferredArtifact(
  ctx: { remote: RemoteExecutionEnv; signal: AbortSignal; binChunkBytes: number },
  asset: { name: string; sha256: string; executable: boolean },
  transfer: { path: string; size: number; gzip: boolean },
  staging: { uploadPath: string; blob: string },
  acknowledged: (bytes: number) => void,
): Promise<void> {
  const context = createTransferContext(ctx.signal);
  let first = true;
  for await (const chunk of createReadStream(transfer.path, { highWaterMark: ctx.binChunkBytes })) {
    ctx.signal.throwIfAborted();
    const result = await (first ? ctx.remote.writeFile(staging.uploadPath, chunk, context) : ctx.remote.appendFile(staging.uploadPath, chunk, context));
    if (!result.ok) throw result.error;
    first = false;
    acknowledged(chunk.length);
  }
  ctx.signal.throwIfAborted();
  if (first) {
    const result = await ctx.remote.writeFile(staging.uploadPath, new Uint8Array(), context);
    if (!result.ok) throw result.error;
  }
  let output = "";
  const result = await ctx.remote.exec(["/bin/sh", "-c", installSource, "prk-install-artifact", staging.uploadPath, staging.blob, asset.sha256, transfer.gzip ? "gzip" : "identity", asset.executable ? "yes" : "no"], {
    onOutput(text) { output = (output + text).slice(-8192); },
  }, context);
  if (!result.ok) throw result.error;
  if (result.value.exitCode !== 0) throw new Error(`Environment artifact ${asset.name} verification failed: ${output}`);
}
