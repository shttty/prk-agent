import { useState } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { projectCatalog } from "../sidebar/grouping/project-catalog.js";
import { text } from "../sidebar/text.js";
import { HolderChange } from "./HolderChange.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

const labelOf = (sessionRow) => text(sessionRow?.label).trim() || text(sessionRow?.sessionId);

/**
 * Confirm making `sessionRow` the global root or its project's supervisor (`POST /api/session-control/{root|supervisor}`).
 * Shows who holds the role now; the user is not limited by control rules.
 */
export function RoleDialog({ actions, onClose, sessionRow, role }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const control = useWorkbench((state) => state.sessionControl);
  const sessions = useWorkbench((state) => state.sessions);
  const holderId = role === "root" ? control?.rootSessionId : control?.supervisors[sessionRow?.projectId];
  const holder = holderId ? sessions.get(holderId) ?? null : null;
  const project = projectCatalog(sessions).find((item) => item.id === sessionRow?.projectId);
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
    {role === "supervisor" ? <Text size="sm" data-field="project">项目：{project?.name || text(sessionRow?.projectId)}</Text> : null}
    <HolderChange role={role} from={holder ? { sessionId: holder.sessionId, label: labelOf(holder) } : holderId ? { sessionId: "", label: holderId.slice(0, 8) } : null} to={{ sessionId: sessionRow?.sessionId, label: labelOf(sessionRow) }} />
    <FormError>{error}</FormError>
    <Group justify="flex-end">
      <Button data-action="cancel" variant="default" onClick={onClose}>取消</Button>
      <Button id="confirm-session-role" data-role={role} loading={busy} disabled={!sessionRow} onClick={() => void confirm()}>{role === "root" ? "设为 root" : "设为 supervisor"}</Button>
    </Group>
  </Stack>;
}
