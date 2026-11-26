import type { ConfigurationIssue } from "../../../src/gateway/wire/web-types.ts";

// What an instance still needs before it can run anything (the Gateway's `configurationIssue.code`).
const LABELS: Record<ConfigurationIssue["code"], string> = { SSH_COMMAND_REQUIRED: "待补连接命令" };

export function issueLabel(issue: Pick<ConfigurationIssue, "code"> | undefined): string {
  return (issue && LABELS[issue.code]) || "待补配置";
}
