import type { PythonToolHooks } from "../kernel-types.ts";
import type { KernelCodeDetails } from "../../codemode/kernel-protocol/kernel-protocol-types.ts";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { PythonOutcome } from "../kernel-types.ts";
import type { KernelMemory } from "../../codemode/kernel-protocol/kernel-protocol-types.ts";
import type { OutputGap } from "../../workspace/terminal-output/terminal-output-types.ts";
import type { KernelRetirementDetails, PythonToolDetails } from "../kernel-types.ts";
import { outputOmission } from "../../workspace/terminal-output/format-output-omission.ts";
import { compactTerminalOutput } from "../../workspace/terminal-output/compact-terminal-output.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../config/terminal/terminal-options.ts";
import { memoryLimitBytes } from "../../config/kernel/parse-memory-limit-bytes.ts";

export function result(ctx: { target: string; hooks: PythonToolHooks; cellDetails?: KernelCodeDetails; namespaceAfterCompaction: boolean },
  signal: AbortSignal | undefined,
  text: string,
  outcome: PythonOutcome,
  truncated: boolean,
  kernelId?: string,
  memory?: KernelMemory,
  gap?: OutputGap,
  images: readonly ImageContent[] = [],
  background = false,
  retirement?: KernelRetirementDetails,
  extras?: Pick<PythonToolDetails, "suggestedMode" | "reset">,
): { content: (TextContent | ImageContent)[]; details: PythonToolDetails; isError?: boolean } {
  const location = `[target ${ctx.target}${kernelId ? `, kernel ${kernelId}` : ""}]`;
  const rawOutput = gap ? `${text.slice(0, gap.at)}\n${outputOmission(gap.chars)}\n${text.slice(gap.at)}` : text;
  if (outcome !== "ok" && !ctx.hooks.codeMode && !background && !retirement && !extras?.suggestedMode && !extras?.reset) throw new Error(`${rawOutput}\n${location}`);
  if (ctx.hooks.codeMode) {
    const compact = compactTerminalOutput(text, "", ctx.hooks.outputOptions ?? DEFAULT_TERMINAL_OPTIONS, undefined, gap);
    text = compact.output;
    truncated ||= compact.truncated;
  } else text = rawOutput;
  const changed = text !== rawOutput;
  let suffix = "";
  const namespace = ctx.cellDetails?.namespace;
  if (ctx.hooks.codeMode && namespace) {
    const full = ctx.namespaceAfterCompaction;
    ctx.namespaceAfterCompaction = false;
    const summary = full ? { variables: namespace.variables, truncated: namespace.truncated }
      : { added: namespace.added, modified: namespace.modified, deleted: namespace.deleted, truncated: namespace.truncated };
    if (full || namespace.added.length || namespace.modified.length || namespace.deleted.length || namespace.truncated) {
      suffix += `\n\nKernel variables (${full ? "full list after compaction" : "cell changes"}):\n${JSON.stringify(summary)}`;
    }
  }
  if (retirement) suffix += `\n${retirement.reason}`;
  if (extras?.suggestedMode) suffix += '\n这类可能卡在 DNS、C 运算或同步调用的任务，下次请用 `mode:"isolated"`。';
  if (extras?.reset) suffix += `\nRetired generation: ${JSON.stringify(extras.reset)}`;
  if (outcome !== "ok") suffix += `\n${location}`;
  if (ctx.hooks.codeMode && memory) {
    const limit = memoryLimitBytes(memory.memoryMax);
    const gibibytes = Math.max(memory.workingSet, limit) >= 1024 ** 3;
    const unit = gibibytes ? 1024 ** 3 : 1024 ** 2;
    suffix += `\n[kernel memory ${(memory.workingSet / unit).toFixed(1)}/${(limit / unit).toFixed(1)} ${gibibytes ? "GiB" : "MiB"}]${memory.oomKill > 0 ? ` · OOM ${memory.oomKill}` : ""}`;
  }
  return {
    content: [{ type: "text", text: text + suffix }, ...images],
    details: { target: ctx.target, outcome, truncated, ...(kernelId ? { kernelId } : {}), ...ctx.cellDetails, ...retirement,
      ...(extras?.suggestedMode && { suggestedMode: extras.suggestedMode }), ...(extras?.reset && { reset: extras.reset }),
      ...(changed ? { rawOutput: rawOutput + suffix } : {}), ...(signal?.aborted ? { interrupted: true } : {}) },
    ...(outcome === "ok" ? {} : { isError: true }),
  };
}
