import { localEnabled } from "../../configuration/read-native-tools.ts";
import type { RuntimeContext } from "../../runtime-state.ts";

export function renderNativeTools(ctx: RuntimeContext): string {
  if (!localEnabled(ctx)) return "";
  return "Native read/edit/write/bash/grep/find/ls execute in the target Pi host, bound to this session's cwd.";
}
