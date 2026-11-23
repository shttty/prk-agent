
export function parseBody(text) {
  if (!text.trim()) return {};
  try { return JSON.parse(text); }
  catch { return { message: "服务响应无法解析。" }; }
}

