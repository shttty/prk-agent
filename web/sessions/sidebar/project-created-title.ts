const format = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });

export function projectCreatedTitle(created: string | undefined): string | undefined {
  if (!created) return undefined;
  const date = new Date(created);
  return Number.isFinite(date.getTime()) ? `${format.format(date)} 创建` : undefined;
}
