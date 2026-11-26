import { useState } from "react";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { IconArchive } from "@tabler/icons-react";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { ArchivePreviewList } from "./ArchivePreviewList.tsx";
import { ArchiveProjectOutcome, type ProjectOutcome } from "./ArchiveProjectOutcome.tsx";
import type { ProjectArchivePreview } from "../../../src/gateway/wire/web-types.ts";
import type { ProjectPayload } from "../sidebar/sidebar-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { FormError } from "../../design-system/form-error/FormError.tsx";
/** Archive every active session of one project. A failure stops the batch: the outcome replaces the preview and cannot be confirmed again; close and reopen to preview afresh. */
type ArchiveProjectConfirmationProps = { actions: WorkbenchActions; onClose: () => void; project: ProjectPayload };

export function ArchiveProjectConfirmation({ actions, onClose, project }: ArchiveProjectConfirmationProps) {
  const [preview, setPreview] = useState<ProjectArchivePreview | null>(null);
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [outcome, setOutcome] = useState<ProjectOutcome | null>(null);
  useEffect(() => {
    let live = true;
    setPreview(null);
    setError("");
    if (!project?.id) return undefined;
    actions.archiveProjectPreview(project.id)
      .then((value) => { if (live) setPreview(value); })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : "读取受影响的会话失败。"); });
    return () => { live = false; };
  }, [actions, project?.id]);
  const sessions = preview?.sessions || [];
  async function confirm() {
    if (!preview || archiving || outcome) return;
    setArchiving(true);
    setError("");
    try {
      const result = await actions.archiveProject(project.id);
      if (!result) throw new Error("归档结果未确认。");
      if (!result.error) onClose();
      else setOutcome({ archived: result.archived, unarchived: result.unarchived, error: result.error, unknown: false });
    } catch (cause) {
      setOutcome({ archived: [], unarchived: [], unknown: true, error: { code: "", message: cause instanceof Error ? cause.message : "归档结果未确认。" } });
    } finally {
      setArchiving(false);
    }
  }
  return <Stack gap="md" className="management-archive-confirm" data-project={project?.id} data-status={outcome ? "settled" : preview ? "ready" : "loading"}>
    {!outcome && <div className="management-archive-lead"><span className="management-archive-lead-icon" aria-hidden="true"><IconArchive size={18} stroke={1.7} /></span><Text size="sm">{sessions.length > 0 ? `下面 ${sessions.length} 个会话会一起停止并归档：` : "项目内没有可归档的会话。"}</Text></div>}
    {!preview && !error && <Text size="sm" c="dimmed">正在读取受影响的会话…</Text>}
    {preview && !outcome && <ArchivePreviewList sessions={sessions} retained={preview.retained} />}
    {outcome && <ArchiveProjectOutcome outcome={outcome} />}
    <FormError>{error}</FormError>
    <Group justify="flex-end">
      <Button data-action="cancel" variant="default" onClick={onClose}>{outcome ? "关闭" : "取消"}</Button>
      {!outcome && <Button id="confirm-archive-project" onClick={() => void confirm()} loading={archiving} disabled={!sessions.length}>归档</Button>}
    </Group>
  </Stack>;
}
