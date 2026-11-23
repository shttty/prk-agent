import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export type ProbeCase = (ctx: ExtensionCommandContext, argument: string) => void | Promise<void>;
