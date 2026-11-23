const format = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });

export function ProjectCreatedDate({ created }) {
  if (!created) return null;
  const date = new Date(created);
  if (!Number.isFinite(date.getTime())) return null;
  return <time className="management-project-created" dateTime={created}>{format.format(date)} 创建</time>;
}
