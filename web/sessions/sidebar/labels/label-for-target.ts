export function labelForTarget(target: { label: string } | undefined): string {
  return target?.label.trim() || "未命名实例";
}
