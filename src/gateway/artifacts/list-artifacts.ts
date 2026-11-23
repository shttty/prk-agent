import type { HostContext } from "../host/host-state.ts";
import type { GatewaySessionHost } from "../host/host-types.ts";
import { readManifest } from "../../artifacts/store/read-artifact-manifest.ts";

export function artifactsList(ctx: HostContext): ReturnType<GatewaySessionHost["artifactsList"]> { return readManifest(ctx.host.artifactStore.directory); }
