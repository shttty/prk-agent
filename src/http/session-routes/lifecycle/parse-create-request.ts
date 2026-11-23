import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import { HttpError } from "../../request/create-error.ts";
import { nativeRequest } from "../../request/validate-wire-params.ts";
import type { ProjectSelection } from "../../../gateway/projects/project-types.ts";

export function createSessionRequest(limits: LimitsOptions, body: Record<string, unknown>) {
  if (Object.keys(body).some((key) => !["target", "label", "cwd", "project"].includes(key))
    || body.target === undefined) {
    throw new HttpError(400, "Session creation accepts target and optional label/cwd/project.");
  }
  if (typeof body.target !== "string" || body.target.trim().length === 0 || body.target.length > limits.identityChars) {
    throw new HttpError(400, `Target ID must be a non-empty string of at most ${limits.identityChars} characters.`);
  }
  if (body.label !== undefined && (typeof body.label !== "string" || body.label.length > limits.labelChars || /\p{Cc}/u.test(body.label))) {
    throw new HttpError(400, `Session label must contain at most ${limits.labelChars} characters without control characters.`);
  }
  if (body.cwd !== undefined && (typeof body.cwd !== "string" || body.cwd.trim().length === 0 || body.cwd.length > limits.cwdChars || /\p{Cc}/u.test(body.cwd))) {
    throw new HttpError(400, "Session cwd must be a non-empty valid string.");
  }
  nativeRequest(limits, body, "createSession");
  return {
    target: body.target,
    ...(body.label === undefined ? {} : { label: body.label }),
    ...(body.cwd === undefined ? {} : { cwd: body.cwd }),
    ...(body.project === undefined ? {} : { project: body.project as ProjectSelection }),
  };
}
