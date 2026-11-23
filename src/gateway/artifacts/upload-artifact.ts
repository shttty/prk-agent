import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { dirname } from "node:path";
import { join } from "node:path";
import { WireError } from "../wire/create-error.ts";
import { createReadStream } from "node:fs";

export async function artifactsUpload(ctx: HostContext, request: Parameters<GatewaySessionHost["artifactsUpload"]>[0]): ReturnType<GatewaySessionHost["artifactsUpload"]> {
      if (dirname(request.source) !== join(ctx.host.paths.home, "uploads")) throw new WireError("INVALID_REQUEST", "Artifact uploads require an owned staged file.");
      return ctx.host.artifactStore.upload(request.name, request.version, request.platform, createReadStream(request.source), request.sha256, ctx.host.config.artifacts.maxUploadBytes);
    }
