// What an instance still needs before it can run anything (the Gateway's `configurationIssue.code`).
const LABELS = { SSH_COMMAND_REQUIRED: "待补连接命令" };

export function issueLabel(issue) {
  return LABELS[issue?.code] || "待补配置";
}
