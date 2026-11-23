import type { WriteArguments, CallTheme } from "./file-types.ts";
import { Text } from "@earendil-works/pi-tui";
export function renderWriteCall(args: WriteArguments, theme: CallTheme) { return new Text(`${theme.fg("toolTitle", "write")} ${args.path}`, 0, 0); }
