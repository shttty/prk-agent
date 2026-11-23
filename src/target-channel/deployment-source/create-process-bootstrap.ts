import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";

export function createProcessBootstrap(limits: ProcessWindowLimits = parseProcessWindowLimits()): string {
  // Split the marker so a shell's echo of the bootstrap never looks like READY.
  return "import sys,base64;exec(\"import tty\\nif sys.stdin.isatty():tty.setraw(0)\");"
    + "print(\"@@PRK-\"+\"READY@@\",flush=True);"
    + `p=sys.stdin.buffer.readline(${limits.maxFrameBytes + 1});`
    + `assert p.endswith(b"\\n") and len(p)<=${limits.maxFrameBytes},"bootstrap frame too large";`
    + "exec(compile(base64.b64decode(p),\"target-channel\",\"exec\"))";
}
