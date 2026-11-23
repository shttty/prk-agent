

export function lastPythonResult(ctx, snapshot) {
  return [...(snapshot?.messages ?? [])].reverse().find((message) => message.role === "toolResult" && message.toolName === "kernel_code");
}
