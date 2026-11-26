import { ActionIcon } from "@mantine/core";
import { IconRotate } from "@tabler/icons-react";

const RESTORE_LABEL = "恢复默认";

type RoleRestoreButtonProps = { ids: string[]; capabilityId: string; lazyOverridden?: boolean; disabled: boolean; onRestore: (ids: string[]) => void };

/** Fixed-width slot left of a role switch: the ↺ shows only while the role holds its own value for `ids`. */
export function RoleRestoreButton({ ids, capabilityId, lazyOverridden, disabled, onRestore }: RoleRestoreButtonProps) {
  return <span className="capability-override" data-slot="mode">
    {ids.length > 0 ? <ActionIcon size={22} radius="sm" variant="subtle" color="accent" className="capability-restore" title={RESTORE_LABEL} aria-label={RESTORE_LABEL}
      data-action="restore-role-capability" data-capability-id={capabilityId} data-overridden="true" data-lazy-overridden={lazyOverridden ? "true" : undefined}
      disabled={disabled} onClick={(event) => { event.stopPropagation(); onRestore(ids); }}>
      <IconRotate size={15} stroke={2} aria-hidden="true" />
    </ActionIcon> : null}
  </span>;
}
