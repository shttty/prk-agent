export function pythonToolMetadata(target: string, codeMode: boolean) {
  return { name: codeMode ? "kernel_code" : "python", description: `Execute Python code in a retained ${target} Python kernel. Interrupting a cell may also affect other cells using the same subprocess or socket.`, ...(codeMode ? { exposure: "model-only" as const } : {}) };
}
