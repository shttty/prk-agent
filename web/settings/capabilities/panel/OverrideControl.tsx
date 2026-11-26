import type { CapabilityCtx } from "../capability-types.ts";
import { ActionIcon } from "@mantine/core";
import { IconRotate } from "@tabler/icons-react";

const RESTORE = "恢复默认（跟随上一层）";

/**
 * Fixed-width slot left of a switch (启用 or 懒加载). Empty unless this instance/session layer holds its own value for
 * `id`; then an accent ↺ button drops that value (`enabled: null`) so the inherited one applies again. The empty slot
 * keeps its width, so switch columns line up across rows. Global has no layer above, so its slots stay empty.
 * `locked`: the backend refuses the change right now (an unavailable lazy setting), so the reset is disabled like the switch.
 */
type OverrideControlProps = { ctx: Pick<CapabilityCtx, "session" | "instance" | "saving" | "change">; id: string; overridden: boolean | undefined; lazy?: boolean; locked?: boolean };

export function OverrideControl({ ctx, id, overridden, lazy = false, locked = false }: OverrideControlProps) {
  const { session, instance, saving, change } = ctx;
  const shown = Boolean(session || instance) && overridden === true;
  return <span className="capability-override" data-slot={lazy ? "lazy" : "enabled"}>
    {shown ? <ActionIcon size={22} radius="sm" variant="subtle" color="accent" className="capability-restore" title={RESTORE} aria-label={RESTORE}
      {...(lazy ? { "data-lazy-overridden": "true" } : { "data-overridden": "true" })} data-action={lazy ? "restore-lazy" : "restore-default"} data-capability-id={id}
      disabled={saving || locked} onClick={(event) => { event.stopPropagation(); void change(id, null); }}>
      <IconRotate size={15} stroke={2} aria-hidden="true" />
    </ActionIcon> : null}
  </span>;
}
