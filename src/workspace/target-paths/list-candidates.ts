import { WireError } from "../../gateway/wire/create-error.ts";
import { posix } from "node:path";
import type { FileOperation, TargetFileContext } from "../target-files/files-types.ts";
import type { NativeReferenceCandidate } from "../../sessions/native-interaction/native-types.ts";
import { request } from "../target-files/request.ts";
import { decodeListing } from "./decode-listing.ts";
import { stat } from "../target-files/stat.ts";
import { resolveReference } from "./resolve-reference.ts";

export async function listCandidates(op: FileOperation, target: TargetFileContext, token: string): Promise<{ candidates: NativeReferenceCandidate[]; truncated: boolean }> {
  const { directory, fragment } = resolveReference(target.cwd, token);
  const limits = op.options.references;
  const reply = await request(op, "listFiles", { path: directory,
    hidden: fragment.startsWith("."), gitignore: false,
    maxEntries: limits.maxEntries, maxBytes: limits.listingBytes, timeoutMs: limits.timeoutMs,
  });
  const listing = { entries: decodeListing(reply.payload, reply.json.count), truncated: reply.json.truncated === true };
  const candidates: NativeReferenceCandidate[] = [];
  let bytes = Buffer.byteLength('{"candidates":[],"truncated":false}');
  if (bytes > limits.listingBytes) throw new WireError("TOO_LARGE", "Reference listing budget cannot hold its response envelope.");
  let truncated = listing.truncated;
  for (const entry of listing.entries) {
    // Preserve @ directory navigation: recursive traversal is bounded upstream, not treated as scandir.
    if (entry.path.includes("/") || entry.path.startsWith(".") !== fragment.startsWith(".") || !entry.path.toLocaleLowerCase().includes(fragment)) continue;
    const path = posix.join(directory, entry.path);
    const kind = entry.kind === "symlink" ? (await stat(op, path)).type : entry.kind;
    const candidate: NativeReferenceCandidate = {
      type: "target-file", source: "session-target", target: target.target, sessionId: target.sessionId,
      path, name: entry.path, label: kind === "directory" ? "directory" : "file",
      selectable: kind === "file", navigable: kind === "directory",
    };
    const size = Buffer.byteLength(JSON.stringify(candidate)) + (candidates.length ? 1 : 0);
    if (bytes + size > limits.listingBytes) { truncated = true; break; }
    candidates.push(candidate);
    bytes += size;
  }
  return { candidates, truncated };
}
