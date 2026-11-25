import type { IncomingMessage, ServerResponse } from "node:http";
import { posix } from "node:path";
import mime from "mime";
import type { RequestContext } from "../listener/listener-state.ts";
import { HttpError } from "../request/create-error.ts";
import { nativeRequest } from "../request/validate-wire-params.ts";
import { streamDownload } from "./stream-download.ts";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function viewImage({ gateway, limits }: RequestContext, request: IncomingMessage, response: ServerResponse, sessionId: string, query: URLSearchParams): Promise<void> {
  const site = request.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") throw new HttpError(403, "Image requests must be same-origin.");
  const path = query.get("path");
  const target = query.get("target");
  if (query.size !== 2 || path === null || target === null) throw new HttpError(400, "Image requires exactly one path and target.");
  const params = nativeRequest(limits, { path, target, inlineImage: true }, "filesDownload", sessionId);
  const imageType = mime.getType(posix.extname(path));
  if (!imageType || !IMAGE_TYPES.has(imageType)) throw new HttpError(415, "Inline images must be PNG, JPEG, GIF, or WebP.");
  return streamDownload(gateway, response, { ...params, sessionId }, imageType);
}
