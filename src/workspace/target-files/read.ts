import { WireError } from "../../gateway/wire/create-error.ts";
import type { WorkspaceFileFormat } from "../files/files-types.ts";
import type { FileOperation, FileRead } from "./files-types.ts";
import { request } from "./request.ts";
import { formatMetadata } from "./format-metadata.ts";
import { absolutePath } from "../target-paths/absolute-path.ts";
import { readBytes } from "./read-bytes.ts";

export async function read(op: FileOperation, path: string, format?: WorkspaceFileFormat, maxBytes = op.options.workspace.fileReadBytes): Promise<FileRead> {
  absolutePath(path);
  const opened = await request(op, "open", { path, noFollow: false });
  const handle = opened.json.handle;
  try {
    const info = formatMetadata(opened.json.info, path);
    if (info.size !== null && info.size > maxBytes) throw new WireError("TOO_LARGE", `File exceeds the ${maxBytes} byte read limit.`);
    const bytes = await readBytes(op, opened, maxBytes);
    let text: string | undefined;
    if (format !== "base64") {
      try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { if (format === "text") throw new WireError("INVALID_REQUEST", "File is not valid UTF-8 text."); }
      if (format === undefined && bytes.includes(0)) text = undefined;
    }
    return { ...info, size: bytes.byteLength, content: text ?? bytes.toString("base64"), format: text === undefined ? "base64" : "text" };
  } finally {
    await request(op, "close", { handle }, { signal: undefined, session: opened.session });
  }
}
