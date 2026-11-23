import { SessionManager } from "@earendil-works/pi-coding-agent";
import { dirname } from "node:path";
import { validateMetadataSessionId } from "../../src/sessions/history/identity/validate-metadata-session-id.ts";
import { validateKernelCwd } from "../../src/sessions/history/binding/validate-kernel-cwd.ts";
import { validateTarget } from "../../src/sessions/history/binding/validate-target.ts";
import { validateHistory } from "./validate-history.mjs";

export function convertHistory(file, text, limits) {
  const lines = text.split("\n");
  const entries = lines.filter((line) => line.trim()).map((line) => JSON.parse(line));
  const header = entries[0];
  if (header?.type !== "session" || header.version !== 3) throw new Error(`${file}: unsupported SDK session header`);
  const manager = SessionManager.open(file, dirname(file));
  if (manager.getSessionId() !== header.id || manager.getEntries().length !== entries.length - 1) throw new Error(`${file}: SDK history differs from parsed input`);
  const before = { file, sessionId: header.id, leafId: manager.getLeafId(), header,
    entries: entries.slice(1).map(({ id, parentId }) => ({ id, parentId })) };
  const selections = [];
  let changed = false;
  const output = lines.map((line) => {
    if (!line.trim()) return line;
    const entry = JSON.parse(line);
    if (entry.type !== "custom") return line;
    const kind = entry.customType;
    if (!["gateway-session-binding", "gateway-session-retarget", "gateway-session-kernel-binding"].includes(kind)) return line;
    const data = entry.data;
    const binding = kind === "gateway-session-binding";
    const kernel = kind === "gateway-session-kernel-binding";
    const oldVersion = binding ? 3 : 1;
    const newVersion = binding ? 4 : 2;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${file}: ${entry.id} invalid PRK custom data`);
    const old = data.version === oldVersion;
    if (!old && (kernel || data.version !== newVersion)) throw new Error(`${file}: ${entry.id} unsupported PRK metadata version`);
    const required = ["version", "sessionId", "target", "cwd", ...(old ? ["kernelName"] : []), ...(kernel ? ["kernelId", "url", "status"] : [])];
    const allowed = [...required, ...(kernel ? ["message"] : [])];
    if (Object.keys(data).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(data, key))) throw new Error(`${file}: ${entry.id} invalid PRK metadata fields`);
    validateMetadataSessionId(data.sessionId, "migration subject", limits);
    validateTarget(data.target);
    validateKernelCwd(data.cwd, limits);
    if (old && (typeof data.kernelName !== "string" || !data.kernelName.trim() || data.kernelName.length > 256 || /\p{Cc}/u.test(data.kernelName))) throw new Error(`${file}: ${entry.id} invalid kernelspec selection`);
    selections.push({ target: data.target, cwd: data.cwd, ...(old ? { kernelName: data.kernelName } : {}) });
    if (kernel) {
      if (typeof data.kernelId !== "string" || !data.kernelId.trim() || !["active", "closed", "unavailable"].includes(data.status)) throw new Error(`${file}: ${entry.id} invalid kernel binding`);
      const url = new URL(data.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`${file}: ${entry.id} invalid kernel endpoint`);
      if (data.message !== undefined && (typeof data.message !== "string" || data.message.length > limits.bindingMessageChars)) throw new Error(`${file}: ${entry.id} invalid kernel diagnostic`);
      return line; // Inert SDK history: retain the entire entry and parent chain, never adopt it.
    }
    if (!old) return line;
    changed = true;
    const { kernelName: _retired, ...selection } = data;
    return JSON.stringify({ ...entry, data: { ...selection, version: newVersion } });
  }).join("\n");
  validateHistory(manager, output.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line)).slice(1), limits);
  return { text: output, changed, selections, preservation: before };
}
