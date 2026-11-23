import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { NativeActionRequest } from "../../../gateway/wire/wire-types.ts";
import type { LimitsOptions } from "../../../config/limits/limits-options.ts";
import type { NativeContext, NativeTarget } from "../native-types.ts";
import { argumentText } from "../dispatch/read-text-argument.ts";

async function exportSessionPayload(target: NativeTarget, format: string, limits: LimitsOptions): Promise<{ readonly format: "html" | "jsonl"; readonly filename: string; readonly content: string }> {
  if (!target.session) throw new WireError("UNAVAILABLE", "Native export requires an active SDK session; read-only history export is unsupported.");
  const selected = format === "html" ? "html" : format === "jsonl" ? "jsonl" : undefined;
  if (!selected) throw new WireError("INVALID_REQUEST", "Export format must be html or jsonl.");
  const directory = await mkdtemp(join(tmpdir(), "pi-gateway-export-"));
  try {
    const path = join(directory, `session.${selected}`);
    if (selected === "html") await target.session.exportToHtml(path);
    else target.session.exportToJsonl(path);
    if ((await stat(path)).size > limits.outputBytes) throw new WireError("TOO_LARGE", "Native export exceeds the browser download limit.");
    const payload: { format: "html" | "jsonl"; filename: string; content: string } = { format: selected, filename: `${target.sessionId}.${selected}`, content: await readFile(path, "utf8") };
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > limits.outputBytes - limits.exportEnvelopeReserveBytes) throw new WireError("TOO_LARGE", "Native export exceeds the browser download limit.");
    return payload;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function exportSession(ctx: NativeContext, target: NativeTarget, request: NativeActionRequest) {
  const format = argumentText(request.args, "format") ?? ctx.sessionOptions.defaultExportFormat;
  return exportSessionPayload(target, format, ctx.limits);
}
