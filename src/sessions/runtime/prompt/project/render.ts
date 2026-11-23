export function renderProject(name: string): string {
  const text = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<project>\n当前项目：${text}\n</project>`;
}
