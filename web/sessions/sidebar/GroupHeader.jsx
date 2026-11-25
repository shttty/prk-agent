import { IconChevronRight, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
import { LocalBadge } from "./LocalBadge.jsx";
import { projectCreatedTitle } from "./project-created-title.js";

export function GroupHeader({ group, project, open, onToggle, count, state }) {
  const Folder = open ? IconFolderOpen : IconFolder;
  return <button type="button" className="management-group-header" data-action="toggle-session-group" onClick={onToggle} aria-expanded={open} title={project ? projectCreatedTitle(group.created) : undefined}>
    <IconChevronRight className="management-group-caret" size={14} stroke={2} aria-hidden="true" />
    {project && <Folder className="management-project-folder" size={16} stroke={1.7} aria-hidden="true" />}
    <span className="management-group-name">{group.name}</span>
    {group.target?.local === true && <LocalBadge />}
    {state && <span data-descendant-state={state.key} role="img" aria-label={`组内会话：${state.label}`} title={`组内会话：${state.label}`}><StatusDot tone={state.tone} size={6} /></span>}
    {(!project || !open) && <span className="management-count" data-session-count={count}>{count}</span>}
  </button>;
}
