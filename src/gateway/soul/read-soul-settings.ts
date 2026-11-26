import type { HostContext } from "../host/host-state.ts";
import { soulPath } from "../../config/session/soul/soul-path.ts";
import { readSoul } from "../../config/session/soul/read-soul.ts";

/** The soul file as the settings page edits it; `path` is the configured path, not where links lead. */
export interface SoulView {
  readonly configured: boolean;
  readonly path: string;
  readonly content: string;
  readonly revision: string;
  readonly maxBytes: number;
}

export function soulGet(ctx: HostContext): SoulView {
  const file = ctx.host.config.session.soulFile;
  const maxBytes = ctx.host.config.limits.contextFileBytes;
  if (!file) return { configured: false, path: "", content: "", revision: "", maxBytes };
  const path = soulPath(ctx.host.paths.home, file);
  return { configured: true, path, ...readSoul(path), maxBytes };
}
