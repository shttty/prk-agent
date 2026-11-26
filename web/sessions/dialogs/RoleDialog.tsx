import { useState } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { projectCatalog } from "../sidebar/grouping/project-catalog.ts";
import type { SessionControl } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow, SessionRows } from "../session-row-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { HolderChange } from "./HolderChange.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchReads } from "../workbench-reads-types.ts";

const labelOf = (sessionRow: SessionRow | undefined) => sessionRow?.label.trim() || sessionRow?.sessionId || "";

/**
 * Confirm making `sessionRow` the global root or its project's supervisor (`POST /api/session-control/{root|supervisor}`).
 * Shows who holds the role now; the user is not limited by control rules.
 */
type RoleDialogProps = { actions: WorkbenchActions; onClose: () => void; sessionRow: SessionRow | undefined; role: "root" | "supervisor" };

export function RoleDialog({ actions, onClose, sessionRow, role }: RoleDialogProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const control: SessionControl | null = useWorkbench((state: WorkbenchReads) => state.sessionControl);
  const sessions: SessionRows = useWorkbench((state: WorkbenchReads) => state.sessions);
  const holderId = role === "root" ? control?.rootSessionId : control?.supervisors[sessionRow?.projectId ?? ""];
  const holder = holderId ? sessions.get(holderId) ?? null : null;
  const project = projectCatalog([...sessions.values()]).find((item) => item.id === sessionRow?.projectId);
  const confirm = async () => {
    if (!sessionRow) return;
    setBusy(true); setError("");
    try {
      await actions.designateRole(role, sessionRow.sessionId);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "角色未更改。"); }
    finally { setBusy(false); }
  };
  return <Stack gap="md" data-role={role}>
    {role === "supervisor" ? <Text size="sm" data-field="project">项目：{project?.name || sessionRow?.projectId}</Text> : null}
    <HolderChange role={role} from={holder ? { sessionId: holder.sessionId, label: labelOf(holder) } : holderId ? { sessionId: "", label: holderId.slice(0, 8) } : null} to={{ sessionId: sessionRow?.sessionId, label: labelOf(sessionRow) }} />
    <FormError>{error}</FormError>
    <Group justify="flex-end">
      <Button data-action="cancel" variant="default" onClick={onClose}>取消</Button>
      <Button id="confirm-session-role" data-role={role} loading={busy} disabled={!sessionRow} onClick={() => void confirm()}>{role === "root" ? "设为 root" : "设为 supervisor"}</Button>
    </Group>
  </Stack>;
}
