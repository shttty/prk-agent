import { HttpError } from "../request/create-error.ts";

export function artifactIdentity(value: unknown, field: "name" | "version"): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)) {
    throw new HttpError(400, `Artifact ${field} must be 1–128 letters, digits, dots, underscores, pluses or hyphens, starting with a letter or digit.`);
  }
  return value;
}
