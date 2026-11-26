// What an instance still needs before it can run anything (the Gateway's `configurationIssue.code`; an unknown code reads as a generic hint).
const LABELS: Readonly<Record<string, string>> = { SSH_COMMAND_REQUIRED: "待补连接命令" };

export function issueLabel(issue: { code: string } | undefined): string {
  return (issue && LABELS[issue.code]) || "待补配置";
}
