import type { SessionReadIssue } from "./history-types.ts";

export class SessionReadError extends Error {
  readonly issue: SessionReadIssue;

  constructor(issue: SessionReadIssue, cause: unknown) {
    super(`Cannot read session${issue.sessionId === undefined ? "" : ` ${JSON.stringify(issue.sessionId)}`} at ${JSON.stringify(issue.sessionFile)}: ${issue.reason}`, { cause });
    this.name = "SessionReadError";
    this.issue = issue;
  }
}
