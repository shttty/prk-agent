import { localEnabled } from "../configuration/read-native-tools.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function getLocalTools(ctx: RuntimeContext): boolean { return localEnabled(ctx); }
