import type { EditArguments, CallTheme } from "./file-types.ts";
import { Text } from "@earendil-works/pi-tui";
export function renderEditCall(args: EditArguments, theme: CallTheme) { return new Text(`${theme.fg("toolTitle", "edit")} ${args.path} (${args.edits.length} replacement(s))`, 0, 0); }
