function firstLine(text) {
  return text?.trimStart().split(/\r?\n/, 1)[0].trim() || "";
}

export function taskName(task) {
  const text = task.kind === "kernel" ? firstLine(task.title) || firstLine(task.code) || "kernel_code"
    : `${task.name} · ${firstLine(task.command)}`;
  const chars = [...text];
  return chars.length > 80 ? `${chars.slice(0, 79).join("")}…` : text;
}
