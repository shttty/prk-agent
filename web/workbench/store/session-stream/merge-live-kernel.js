// Live frames omit an unchanged namespace; keep it for the same live kernel.
export function mergeLiveKernel(previous, kernel) {
  return !kernel.namespace && previous?.namespace && previous.kernelId === kernel.kernelId && ["idle", "busy"].includes(kernel.state)
    ? { ...kernel, namespace: previous.namespace } : kernel;
}
