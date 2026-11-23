import { KERNEL_READ_NOTICE } from "../../target-files/file-protocol.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";

export function fileReadNotice(ctx: RuntimeContext) { return localEnabled(ctx) ? undefined : KERNEL_READ_NOTICE; }
