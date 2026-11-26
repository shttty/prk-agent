import { Box, Flex, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
import { LocalBadge } from "./LocalBadge.tsx";
import type { RowState } from "./labels/row-state.ts";
import { projectCreatedTitle } from "./project-created-title.ts";
import type { ProjectPayload, SessionGroup } from "./sidebar-types.ts";

type GroupHeaderProps = { group: SessionGroup; project: ProjectPayload | null | undefined; open: boolean; onToggle: () => void; count: number | undefined; state: RowState | false | undefined };

export function GroupHeader({ group, project, open, onToggle, count, state }: GroupHeaderProps) {
  const Folder = open ? IconFolderOpen : IconFolder;
  return <Flex component={UnstyledButton} align="center" flex={1} miw={0} className="management-group-header" data-action="toggle-session-group" onClick={onToggle} aria-expanded={open} title={project ? projectCreatedTitle(group.created) : undefined}>
    <IconChevronRight className="management-group-caret" size={14} stroke={2} aria-hidden="true" />
    {project && <Folder className="management-project-folder" size={16} stroke={1.7} aria-hidden="true" />}
    <Text component="span" truncate="end" miw={0} flex={project ? "0 1 auto" : 1} className="management-group-name">{group.name}</Text>
    {group.target?.local === true && <LocalBadge ml={6} flex="none" />}
    {state && <Box component="span" ml={6} flex="none" data-descendant-state={state.key} role="img" aria-label={`组内会话：${state.label}`} title={`组内会话：${state.label}`}><StatusDot tone={state.tone} size={6} /></Box>}
    {(!project || !open) && <Box component="span" ml={6} flex="none" className="management-count" data-session-count={count}>{count}</Box>}
  </Flex>;
}
