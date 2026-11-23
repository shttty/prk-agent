import type { ExecutionTarget } from "./target-types.ts";

export interface ConfigurationIssue {
  readonly code: "SSH_COMMAND_REQUIRED";
  readonly message: string;
}

export function configurationIssue(target: Pick<ExecutionTarget, "local" | "sshCommand">): ConfigurationIssue | undefined {
  if (!target.local && !target.sshCommand) return { code: "SSH_COMMAND_REQUIRED", message: "Configure an unattended target shell command." };
  return undefined;
}
