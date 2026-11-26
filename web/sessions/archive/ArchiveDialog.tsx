import { useState } from "react";
import { Badge, Box, Button, Flex, Group, SegmentedControl, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { ArchiveGroup, PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { SessionTree } from "../dialogs/SessionTree.tsx";
import { sessionKindLabel } from "../dialogs/session-kind-label.ts";
import type { SessionRows } from "../../workbench/store/store-types.ts";
import type { UnreadableSession } from "../../workbench/payloads/payload-types.ts";
import { instanceGroups } from "../sidebar/grouping/instance-groups.ts";
import { projectGroups } from "../sidebar/grouping/project-groups.ts";
import { targetMap } from "../sidebar/grouping/target-map.ts";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.ts";
import { useWorkbenchStore } from "../../workbench/subscription/use-workbench-store.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { ArchiveUnreadableRow } from "../unreadable/ArchiveUnreadableRow.tsx";
import { UnreadableReason } from "../unreadable/UnreadableReason.tsx";
import { archiveGroups, type ArchiveGroupView } from "./archive-groups.ts";
import { formatArchiveTime } from "./format-archive-time.ts";
import "../sidebar/group-header.css";
import "../sidebar/badges.css";
import "./archive.css";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

type ArchiveDialogProps = { actions: WorkbenchActions; onViewHistory?: () => void };
type ViewMode = "instances" | "projects";

export function ArchiveDialog({ actions, onViewHistory }: ArchiveDialogProps) {
  const store = useWorkbenchStore();
  const targetList: PublicExecutionTarget[] = useWorkbench((state: WorkbenchState) => state.targets);
  const sessions: SessionRows = useWorkbench((state: WorkbenchState) => state.sessions);
  const archive: ArchiveGroup[] = useWorkbench((state: WorkbenchState) => state.archive);
  const unreadableSessions: UnreadableSession[] = useWorkbench((state: WorkbenchState) => state.unreadableSessions);
  const mutating = useWorkbench((state: WorkbenchState) => state.pending.has("archiveMutating"));
  // Starts in the sidebar's view, then switches on its own.
  const [viewMode, setViewMode] = useState<ViewMode>(() => store.getSnapshot().viewMode);
  const [filter, setFilter] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const targets = targetMap(targetList);
  const labels = new Map([...sessions.values(), ...archive.flatMap((group) => group.sessions)].map((node) => [node.sessionId, node.label || node.sessionId]));
  const query = filter.trim().toLocaleLowerCase();
  const groups = archiveGroups(archive, unreadableSessions);
  const items = groups.filter((group) => [...group.sessions, ...group.unreadable].some((node) => [node.label, node.sessionId, sessionTargetLabel(node, targets), node.projectName].some((value) => (value ?? "").toLocaleLowerCase().includes(query))))
    .map((group) => {
      // The group shows under the instance and project of its root (or, with none readable, its first unreadable session).
      const { sessionId, target, projectId, projectName } = group.sessions.find((node) => node.sessionId === group.group) ?? group.sessions[0] ?? group.unreadable[0] ?? { sessionId: group.group };
      return { sessionId, target, projectId, projectName, archiveGroup: group };
    });
  const sections = (viewMode === "projects" ? projectGroups(items) : instanceGroups(items, targetList)).filter((section) => section.sessions.length);
  async function run(kind: "unarchive" | "purge", group: string) {
    setError("");
    const ok = kind === "unarchive" ? await actions.unarchive(group) : await actions.purgeArchive(group);
    if (!ok) setError(kind === "unarchive" ? "取消归档未确认。" : "永久删除未确认。");
    else setConfirming(null);
  }
  const showGroup = (group: ArchiveGroupView, section: { id: string }) => {
    const root = group.sessions.find((node) => node.sessionId === group.group) ?? group.sessions[0];
    const members = new Set(group.sessions.map((node) => node.sessionId));
    const count = group.sessions.length + group.unreadable.length;
    return <Stack key={group.group} gap={4} px={12} py={8} className="management-archive-group" data-archive-group={group.group}>
      <Group justify="space-between" wrap="nowrap" gap={10} miw={0} className="management-archive-heading">
        <span className="management-archive-meta">{formatArchiveTime(group.at)} 归档{count > 1 ? ` · ${count} 个会话` : ""}</span>
        {root && <Group gap={6} wrap="nowrap"><Button data-action="unarchive" size="compact-sm" variant="default" disabled={mutating || group.unreadable.length > 0} onClick={() => void run("unarchive", group.group)}>取消归档</Button><Button data-action="purge-archive" size="compact-sm" variant="subtle" color="red" disabled={mutating || group.unreadable.length > 0} onClick={() => setConfirming(group.group)}>永久删除</Button></Group>}
      </Group>
      {root && <SessionTree nodes={group.sessions} root={root.sessionId} renderNode={(node) => {
        // The section already names the instance (space view) or project (project view); rows repeat only what differs.
        const sameInstance = viewMode !== "projects" && section.id === node.target;
        const place = sameInstance ? "" : sessionTargetLabel(node, targets);
        const sameProject = viewMode === "projects" && section.id === (node.projectId?.trim() || "project:ungrouped");
        const location = [place, sameProject ? "" : node.projectName, node.owner && !members.has(node.owner) && labels.has(node.owner) ? `↳ ${labels.get(node.owner)}` : ""].filter(Boolean).join(" · ");
        return <Group justify="space-between" wrap="nowrap" gap="0.5rem" miw={0} className="management-archive-session" data-archived={node.sessionId} data-archive-target={node.target ?? ""} data-archive-project={node.projectId ?? ""} data-archive-owner={node.owner ?? ""}>
          <span className="management-affected-node"><strong>{node.label || node.sessionId}</strong>{sessionKindLabel(node) && <Badge component="span" variant="outline" color="gray" size="xs" tt="none" radius="sm" className="management-affected-tag" data-lifecycle={node.lifecycle}>{sessionKindLabel(node)}</Badge>}{location ? <span className="management-archive-location">{location}</span> : null}</span>
          <Button data-action="view-history" size="compact-xs" variant="subtle" onClick={() => void actions.selectSession(node.sessionId).then((selected: boolean) => { if (selected) onViewHistory?.(); })}>查看历史</Button>
        </Group>;
      }} />}
      {group.unreadable.length > 0 && <ul className="management-affected-tree">{group.unreadable.map((item) => <li key={item.key}><ArchiveUnreadableRow item={item} targets={targets} onOpen={setViewing} /></li>)}</ul>}
      {(group.sessions.some((node) => node.kernelOrphan) || group.unreadable.some((item) => item.unreadable.archived?.kernelOrphan)) && <InlineAlert color="yellow">有 kernel 未关闭，可能需要在目标机上手动清理。</InlineAlert>}
      {confirming === group.group && <InlineAlert size="sm">永久删除这组会话的历史，不能撤销。<Group justify="flex-end" gap="xs" mt="xs"><Button data-action="cancel" size="compact-sm" variant="default" onClick={() => setConfirming(null)}>取消</Button><Button data-action="confirm-purge-archive" size="compact-sm" color="red" loading={mutating} onClick={() => void run("purge", group.group)}>永久删除</Button></Group></InlineAlert>}
    </Stack>;
  };
  return <Stack gap="md">
    <Group justify="space-between" className="management-archive-tools">
      <SegmentedControl id="archive-view-switch" value={viewMode} onChange={(value) => setViewMode(value === "projects" ? "projects" : "instances")} data={[{ label: "实例", value: "instances" }, { label: "项目", value: "projects" }]} />
      <TextInput id="archive-filter-text" className="management-archive-filter" aria-label="筛选归档" placeholder="按会话、实例或项目筛选" value={filter} onChange={(event) => setFilter(event.currentTarget.value)} />
    </Group>
    {!groups.length ? <Text size="sm" c="dimmed" data-state="empty">暂无归档。</Text> : !items.length ? <Text size="sm" c="dimmed" data-state="no-match">没有匹配的归档。</Text> : sections.map((section) => {
      const open = openGroups[section.id] !== false;
      return <section key={section.id} data-archive-section={section.id}>
        <Flex component={UnstyledButton} align="center" w="100%" className="management-group-header" aria-expanded={open} onClick={() => setOpenGroups((current) => ({ ...current, [section.id]: !open }))}><IconChevronRight className="management-group-caret" size={14} /><Text component="span" truncate="end" flex={1} miw={0} className="management-group-name">{section.name}</Text><Box component="span" ml={6} flex="none" className="management-count">{section.sessions.length}</Box></Flex>
        {open && <Stack gap="sm">{section.sessions.map((item) => showGroup(item.archiveGroup, section))}</Stack>}
      </section>;
    })}
    <UnreadableReason issue={unreadableSessions.find((issue) => issue.key === viewing)} onClose={() => setViewing(null)} />
    <FormError>{error}</FormError>
  </Stack>;
}
