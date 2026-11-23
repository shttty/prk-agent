import type { ReadArguments, CallTheme } from "./file-types.ts";
import { Text } from "@earendil-works/pi-tui";
export function renderReadCall(args: ReadArguments, theme: CallTheme) {
        const page = [args.offset === undefined ? "" : `offset=${args.offset}`, args.limit === undefined ? "" : `limit=${args.limit}`].filter(Boolean).join(", ");
        return new Text(`${theme.fg("toolTitle", "read")} ${args.path}${page ? ` (${page})` : ""}`, 0, 0);
}
