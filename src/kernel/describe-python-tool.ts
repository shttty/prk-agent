export function pythonToolMetadata(target: string, codeMode: boolean) {
  return { name: codeMode ? "kernel_code" : "python", description: `Run Python in the retained ${target} kernel.`, ...(codeMode ? { exposure: "model-only" as const } : {}) };
}
