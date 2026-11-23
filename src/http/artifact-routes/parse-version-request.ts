import { exactKeys } from "../request/inspect-request-keys.ts";
import { HttpError } from "../request/create-error.ts";
import { artifactIdentity } from "./parse-artifact-identity.ts";

export function artifactVersionRequest(body: Record<string, unknown>): { name: string; version: string } {
  if (!exactKeys(body, ["name", "version"])) throw new HttpError(400, "Artifact operation requires exactly name and version.");
  return { name: artifactIdentity(body.name, "name"), version: artifactIdentity(body.version, "version") };
}
