import type { RequestContext } from "../listener/listener-state.ts";
import type { IncomingMessage } from "node:http";
import type { ServerResponse } from "node:http";
import { HttpError } from "../request/create-error.ts";
import { artifactUploadRequest } from "./parse-upload-query.ts";
import { stageArtifactUpload } from "../../artifacts/upload-staging/stage-artifact-upload.ts";
import { artifactUploadBody } from "./read-upload-stream.ts";
import { contentLength } from "../request/read-content-length.ts";
import { artifactVersionRequest } from "./parse-version-request.ts";
import { readJsonBody } from "../request/read-json-body.ts";
import { responseJson } from "../responses/write-json.ts";
import { ArtifactError } from "../../artifacts/upload-error/create-artifact-error.ts";
import { gatewayFailure } from "../request/translate-gateway-failure.ts";
import { rm } from "node:fs/promises";

export async function handleArtifactRequest(ctx: RequestContext, request: IncomingMessage, response: ServerResponse, url: URL, path: string): Promise<void> {
  const { gateway, http, artifacts, home } = ctx;

      let staged: string | undefined;
      try {
        let manifest: unknown;
        if (path === "/api/artifacts") {
          if (request.method !== "GET") throw new HttpError(405, "Request method is not supported.");
          manifest = await gateway.call("artifactsList", {});
        } else {
          if (request.method !== "POST") throw new HttpError(405, "Request method is not supported.");
          if (path === "/api/artifacts/upload") {
            const input = artifactUploadRequest(url);
            if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/octet-stream") throw new HttpError(415, "Artifact uploads require application/octet-stream.");
            if (request.headers["content-encoding"] !== undefined && request.headers["content-encoding"] !== "identity") throw new HttpError(415, "Compressed request bodies are not supported.");
            staged = await stageArtifactUpload(home, artifactUploadBody(request, contentLength(http, request, artifacts.maxUploadBytes), http.uploadIdleTimeoutMs), artifacts.maxUploadBytes);
            manifest = await gateway.call("artifactsUpload", { ...input, source: staged });
          } else {
            const input = artifactVersionRequest(await readJsonBody(http, request));
            const method = path === "/api/artifacts/current" ? "artifactsCurrent" : "artifactsDelete";
            manifest = await gateway.call(method, { name: input.name, version: input.version });
          }
        }
        responseJson(http, response, 200, { tools: (manifest as { tools: unknown }).tools, maxUploadBytes: artifacts.maxUploadBytes });
      } catch (error) {
        if (error instanceof ArtifactError) throw error;
        throw gatewayFailure(error, "Artifact storage operation failed.");
      } finally {
        if (staged) await rm(staged, { force: true });
      }
      return;
    
}
