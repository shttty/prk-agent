import { ActionIcon } from "@mantine/core";
import { Menu } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconDots } from "@tabler/icons-react";
import { IconArchive } from "@tabler/icons-react";
import { IconPencil } from "@tabler/icons-react";
import { projectPayloadForGroup } from "./grouping/project-drop.js";
/**
 * `+` and `…` of a project group header. `+` and "new session" pass the project ({id,name}, or null for the ungrouped
 * group) to the create dialog; rename and archive are available only for real projects.
 */
export function ProjectGroupActions({ group, creating, onOpen }) {
  const project = projectPayloadForGroup(group);
  if (project === undefined) return null;
  const create = () => onOpen("create", undefined, project);
  const id = project?.id ?? group.id;
  return <>
    <ActionIcon className="management-group-add" data-action="create-session" data-project={id} variant="subtle" color="gray" size="md" aria-label={`在${group.name}新建会话`} title={`在${group.name}新建会话`} disabled={creating} onClick={create}><IconPlus size={15} /></ActionIcon>
    {project && <Menu position="bottom-end" withinPortal>
      <Menu.Target><ActionIcon className="management-group-menu" data-action="project-menu" data-project={id} variant="subtle" color="gray" size="md" aria-label={`${group.name}的项目操作`}><IconDots size={15} /></ActionIcon></Menu.Target>
      <Menu.Dropdown>
        <Menu.Item data-action="project-create-session" data-project={id} leftSection={<IconPlus size={14} />} disabled={creating} onClick={create}>在此项目新建会话</Menu.Item>
        <Menu.Item data-action="rename-project" data-project={id} leftSection={<IconPencil size={14} />} onClick={() => onOpen("rename-project", undefined, project)}>重命名项目…</Menu.Item>
        <Menu.Item data-action="archive-project" data-project={id} leftSection={<IconArchive size={14} />} onClick={() => onOpen("archive-project", undefined, project)}>归档项目内全部会话…</Menu.Item>
      </Menu.Dropdown>
    </Menu>}
  </>;
}
