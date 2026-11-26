import { isPayload } from "../../../payload/is-payload.ts";
import type { Payload } from "../../../payload/is-payload.ts";
// Bodies written by the Gateway's derivation lifecycle (docs/wire/sessions.md): a one-line tag, then one JSON object.
const RESULT = /^\[派生会话任务结果 \/ child=([^\s/\]]+) \/ task=([^\s/\]]+) \/ result=([^\s/\]]+)\]\n/;
const FAILURE = /^\[派生会话运行失败 \/ child=([^\s/\]]+)\]\n/;
// Formats the target image route serves.
const IMAGE = /\.(?:png|jpe?g|gif|webp)$/i;

export type PeerBody =
  | { kind: "text" }
  | { kind: "result"; child: string; taskId: string; resultId: string; summary: string; artifacts: { path: string; image: boolean }[]; patchStats: string; finishedAt: number | null; startedAt: number | null }
  | { kind: "failure"; child: string; status: string; summary: string; detail: string };

const TEXT: PeerBody = { kind: "text" };

/** Display projection of a peer body: a child's delivered result, its run-failure notice, or plain text. Never changes the body. */
export function projectPeerBody(body: unknown): PeerBody {
  if (typeof body !== "string") return TEXT;
  const result = RESULT.exec(body);
  if (result) return projectResult(result, readObject(body.slice(result[0].length)));
  const failure = FAILURE.exec(body);
  if (failure) return projectFailure(failure, readObject(body.slice(failure[0].length)));
  return TEXT;
}

function projectResult([, child = "", taskId = "", resultId = ""]: RegExpExecArray, data: Payload | null): PeerBody {
  const result = data?.result;
  if (!data || data.child !== child || data.taskId !== taskId || !isPayload(result) || result.id !== resultId
    || typeof result.summary !== "string" || !result.summary.trim()) return TEXT;
  const patch = result.patch;
  return {
    kind: "result", child, taskId, resultId, summary: result.summary,
    artifacts: Array.isArray(result.artifacts)
      ? result.artifacts.filter((path): path is string => typeof path === "string" && Boolean(path)).map((path) => ({ path, image: IMAGE.test(path) })) : [],
    patchStats: isPayload(patch) && typeof patch.stats === "string" && patch.stats.trim() ? patch.stats : "",
    finishedAt: typeof result.finishedAt === "number" && Number.isFinite(result.finishedAt) ? result.finishedAt : null,
    startedAt: typeof result.startedAt === "number" && Number.isFinite(result.startedAt) ? result.startedAt : null,
  };
}

function projectFailure([, child = ""]: RegExpExecArray, data: Payload | null): PeerBody {
  if (!data || data.sessionId !== child || typeof data.summary !== "string" || !data.summary.trim()) return TEXT;
  return { kind: "failure", child, status: typeof data.type === "string" ? data.type : "failed", summary: data.summary, detail: JSON.stringify(data, null, 2) };
}

function readObject(text: string): Payload | null {
  try {
    // Boundary: the body came off the wire.
    const value: unknown = JSON.parse(text);
    return isPayload(value) ? value : null;
  } catch { return null; }
}
