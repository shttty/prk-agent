import { useState } from "react";
import { targetMap } from "../sidebar/grouping/target-map.js";
import { text } from "../sidebar/text.js";
import { sessionTargetLabel } from "../sidebar/labels/session-target-label.js";
import { projectGroups } from "../sidebar/grouping/project-groups.js";
import { instanceGroups } from "../sidebar/grouping/instance-groups.js";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { SegmentedControl } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { formatArchiveTime } from "./format-archive-time.js";
import { Button } from "@mantine/core";
import { SessionTree } from "../dialogs/SessionTree.jsx";
import { Badge } from "@mantine/core";
import { sessionKindLabel } from "../dialogs/session-kind-label.js";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import "../sidebar/group-header.css";
import "../sidebar/badges.css";
import "./archive.css";
import { archiveGroups } from "./archive-groups.js";
import { ArchiveUnreadableRow } from "../unreadable/ArchiveUnreadableRow.jsx";
import { UnreadableReason } from "../unreadable/UnreadableReason.jsx";
import { useContext } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
export function ArchiveDialog({ actions, onViewHistory }) {
  const store = useContext(WorkbenchContext);
  const targetList = useWorkbench((state) => state.targets);
  const sessions = useWorkbench((state) => state.sessions);
  const archive = useWorkbench((state) => state.archive);
  const unreadableSessions = useWorkbench((state) => state.unreadableSessions);
  const mutating = useWorkbench((state) => state.pending.has("archiveMutating"));
  // Starts in the sidebar's view, then switches on its own.
  const [viewMode, setViewMode] = useState(() => store.getSnapshot().viewMode);
  const [filter, setFilter] = useState("");
  const [openGroups, setOpenGroups] = useState({});
  const [confirming, setConfirming] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState("");
  const targets = targetMap(targetList);
  const labels = new Map([...sessions.values(), ...archive.flatMap((group) => group.sessions)].map((node) => [node.sessionId, text(node.label) || node.sessionId]));
  const query = filter.trim().toLocaleLowerCase();
  const groups = archiveGroups(archive, unreadableSessions);
  const items = groups.filter((group) => [...group.sessions, ...group.unreadable].some((node) => [node.label, node.sessionId, sessionTargetLabel(node, targets), node.projectName].some((value) => text(value).toLocaleLowerCase().includes(query))))
    .map((group) => ({ ...(group.sessions.find((node) => node.sessionId === group.group) || group.sessions[0] || group.unreadable[0]), archiveGroup: group }));
  const sections = (viewMode === "projects" ? projectGroups(items) : instanceGroups(items, targetList)).filter((section) => section.sessions.length);
  async function run(kind, group) {
    setError("");
    const ok = kind === "unarchive" ? await actions.unarchive(group) : await actions.purgeArchive(group);
    if (!ok) setError(kind === "unarchive" ? "取消归档未确认。" : "永久删除未确认。");
    else setConfirming(null);
  }
  return <Stack gap="md">
    <Group className="management-archive-tools" justify="space-between">
      <SegmentedControl id="archive-view-switch" value={viewMode} onChange={setViewMode} data={[{ label: "实例", value: "instances" }, { label: "项目", value: "projects" }]} />
      <TextInput id="archive-filter-text" className="management-archive-filter" aria-label="筛选归档" placeholder="按会话、实例或项目筛选" value={filter} onChange={(event) => setFilter(event.currentTarget.value)} />
    </Group>
    {!groups.length ? <Text size="sm" c="dimmed" data-state="empty">暂无归档。</Text> : !items.length ? <Text size="sm" c="dimmed" data-state="no-match">没有匹配的归档。</Text> : sections.map((section) => {
      const open = openGroups[section.id] !== false;
      return <section key={section.id} data-archive-section={section.id}>
        <button type="button" className="management-group-header" aria-expanded={open} onClick={() => setOpenGroups((current) => ({ ...current, [section.id]: !open }))}><IconChevronRight className="management-group-caret" size={14} /><span>{section.name}</span><span className="management-count">{section.sessions.length}</span></button>
        {open && <Stack gap="sm">{section.sessions.map(({ archiveGroup: group }) => {
          const root = group.sessions.find((node) => node.sessionId === group.group) || group.sessions[0];
          const members = new Set(group.sessions.map((node) => node.sessionId));
          return <div key={group.group} className="management-archive-group" data-archive-group={group.group}>
            <div className="management-archive-heading">
              <span className="management-archive-meta">{formatArchiveTime(group.at)} 归档{group.sessions.length + group.unreadable.length > 1 ? ` · ${group.sessions.length + group.unreadable.length} 个会话` : ""}</span>
              {root && <Group gap={6} wrap="nowrap"><Button data-action="unarchive" size="compact-sm" variant="default" disabled={mutating || group.unreadable.length > 0} onClick={() => void run("unarchive", group.group)}>取消归档</Button><Button data-action="purge-archive" size="compact-sm" variant="subtle" color="red" disabled={mutating || group.unreadable.length > 0} onClick={() => setConfirming(group.group)}>永久删除</Button></Group>}
            </div>
            {root && <SessionTree nodes={group.sessions} root={root.sessionId} renderNode={(node) => {
              // The section already names the instance (space view) or project (project view); rows repeat only what differs.
              const sameInstance = viewMode !== "projects" && section.id === text(node.target);
              const place = sameInstance ? "" : sessionTargetLabel(node, targets);
              const sameProject = viewMode === "projects" && section.id === (text(node.projectId).trim() || "project:ungrouped");
              const location = [place, sameProject ? "" : text(node.projectName), node.owner && !members.has(node.owner) && labels.has(node.owner) ? `↳ ${labels.get(node.owner)}` : ""].filter(Boolean).join(" · ");
              return <div className="management-archive-session" data-archived={node.sessionId} data-archive-target={text(node.target)} data-archive-project={text(node.projectId)} data-archive-owner={text(node.owner)}>
                <span className="management-affected-node"><strong>{text(node.label) || node.sessionId}</strong>{sessionKindLabel(node) && <Badge component="span" variant="outline" color="gray" size="xs" tt="none" radius="sm" className="management-affected-tag" data-lifecycle={node.lifecycle}>{sessionKindLabel(node)}</Badge>}{location ? <span className="management-archive-location">{location}</span> : null}</span>
                <Button data-action="view-history" size="compact-xs" variant="subtle" onClick={async () => { if (await actions.selectSession(node.sessionId)) onViewHistory?.(); }}>查看历史</Button>
              </div>;
            }} />}
            {group.unreadable.length > 0 && <ul className="management-affected-tree">{group.unreadable.map((item) => <li key={item.key}><ArchiveUnreadableRow item={item} targets={targets} onOpen={setViewing} /></li>)}</ul>}
            {(group.sessions.some((node) => node.kernelOrphan) || group.unreadable.some((item) => item.unreadable.archived.kernelOrphan)) && <InlineAlert color="yellow">有 kernel 未关闭，可能需要在目标机上手动清理。</InlineAlert>}
            {confirming === group.group && <InlineAlert size="sm">永久删除这组会话的历史，不能撤销。<Group justify="flex-end" gap="xs" mt="xs"><Button data-action="cancel" size="compact-sm" variant="default" onClick={() => setConfirming(null)}>取消</Button><Button data-action="confirm-purge-archive" size="compact-sm" color="red" loading={mutating} onClick={() => void run("purge", group.group)}>永久删除</Button></Group></InlineAlert>}
          </div>;
        })}</Stack>}
      </section>;
    })}
    <UnreadableReason issue={unreadableSessions.find((issue) => issue.key === viewing)} onClose={() => setViewing(null)} />
    <FormError>{error}</FormError>
  </Stack>;
}
