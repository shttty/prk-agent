import { useState } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { Text } from "@mantine/core";
import { ArchivePreviewList } from "./ArchivePreviewList.tsx";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import type { ArchivePreview } from "../../../src/gateway/wire/web-types.ts";
import type { SessionRow } from "../../workbench/store/store-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
type ArchiveConfirmationProps = { actions: WorkbenchActions; onClose: () => void; sessionRow: SessionRow | undefined };

export function ArchiveConfirmation({ actions, onClose, sessionRow }: ArchiveConfirmationProps) {
  const archiving = useWorkbench((state: WorkbenchState) => state.session.pending.has("archiving"));
  const [preview, setPreview] = useState<ArchivePreview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setPreview(null);
    setError("");
    if (!sessionRow?.sessionId) return undefined;
    actions.archivePreview(sessionRow.sessionId)
      .then((value) => { if (live) setPreview(value); })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : "读取受影响的会话失败。"); });
    return () => { live = false; };
  }, [actions, sessionRow?.sessionId]);
  const sessions = preview?.sessions || [];
  async function confirm() {
    if (!preview) return;
    setError("");
    const result = await actions.archiveSession();
    if (result !== false) onClose();
    else setError("归档未确认。");
  }
  return <Stack gap="md" className="management-archive-confirm">
    <div className="management-archive-lead"><span className="management-archive-lead-icon" aria-hidden="true"><IconArchive size={18} stroke={1.7} /></span><Text size="sm">{sessions.length > 1 ? `下面 ${sessions.length} 个会话会一起停止并归档：` : "这个会话会停止并归档。"}</Text></div>
    {!preview && !error && <Text size="sm" c="dimmed">正在读取受影响的会话…</Text>}
    {preview && <ArchivePreviewList sessions={sessions} root={preview.root} retained={preview.retained} />}
    <FormError>{error}</FormError>
    <Group justify="flex-end"><Button data-action="cancel" variant="default" onClick={onClose}>取消</Button><Button id="confirm-archive" onClick={() => void confirm()} loading={archiving} disabled={!preview}>归档</Button></Group>
  </Stack>;
}
