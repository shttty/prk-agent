// Bodies written by the Gateway's derivation lifecycle (docs/wire/sessions.md): a one-line tag, then one JSON object.
const RESULT = /^\[派生会话任务结果 \/ child=([^\s/\]]+) \/ task=([^\s/\]]+) \/ result=([^\s/\]]+)\]\n/;
const FAILURE = /^\[派生会话运行失败 \/ child=([^\s/\]]+)\]\n/;
const TEXT = { kind: "text" };
// Formats the target image route serves.
const IMAGE = /\.(?:png|jpe?g|gif|webp)$/i;

/** Display projection of a peer body: a child's delivered result, its run-failure notice, or plain text. Never changes the body. */
export function projectPeerBody(body) {
  if (typeof body !== "string") return TEXT;
  const result = RESULT.exec(body);
  if (result) return projectResult(result, readObject(body.slice(result[0].length)));
  const failure = FAILURE.exec(body);
  if (failure) return projectFailure(failure, readObject(body.slice(failure[0].length)));
  return TEXT;
}

function projectResult([, child, taskId, resultId], data) {
  const result = data?.result;
  if (data?.child !== child || data.taskId !== taskId || !isObject(result) || result.id !== resultId
    || typeof result.summary !== "string" || !result.summary.trim()) return TEXT;
  return {
    kind: "result", child, taskId, resultId, summary: result.summary,
    artifacts: Array.isArray(result.artifacts)
      ? result.artifacts.filter((path) => typeof path === "string" && path).map((path) => ({ path, image: IMAGE.test(path) })) : [],
    patchStats: typeof result.patch?.stats === "string" && result.patch.stats.trim() ? result.patch.stats : "",
    finishedAt: Number.isFinite(result.finishedAt) ? result.finishedAt : null,
    startedAt: Number.isFinite(result.startedAt) ? result.startedAt : null,
  };
}

function projectFailure([, child], data) {
  if (data?.sessionId !== child || typeof data.summary !== "string" || !data.summary.trim()) return TEXT;
  return { kind: "failure", child, status: typeof data.type === "string" ? data.type : "failed", summary: data.summary, detail: JSON.stringify(data, null, 2) };
}

function readObject(text) {
  try {
    const value = JSON.parse(text);
    return isObject(value) ? value : null;
  } catch { return null; }
}

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
