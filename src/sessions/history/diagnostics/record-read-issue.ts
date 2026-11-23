import type { SessionReadFailure, SessionReadIssue } from "../history-types.ts";
import { formatReadIssue } from "../format-read-issue.ts";
import { SessionReadError } from "../read-error.ts";

export function recordReadIssue(
  failures: Map<string, SessionReadFailure>,
  identity: Omit<SessionReadIssue, "reason">,
  cause: unknown,
  permanent = false,
): SessionReadError {
  const issue = formatReadIssue(identity, cause);
  const error = new SessionReadError(issue, cause);
  failures.set(identity.sessionFile, { issue, error, permanent });
  return error;
}
