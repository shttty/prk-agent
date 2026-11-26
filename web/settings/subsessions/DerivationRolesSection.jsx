import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";

export function DerivationRolesSection({ roles, builtinRoles, busy, error, onAdd, onEdit, onDelete }) {
  const entries = Object.entries(roles || {});
  return <section className="settings-section subsession-section" data-section="derivation-roles">
    <div className="subsession-section-head">
      <div className="subsession-section-title">
        <h3 className="pi-settings-heading">Roles</h3>
        <Badge size="xs" variant="light" color="gray" tt="none" data-role-count={entries.length}>{entries.length}</Badge>
      </div>
      <Button id="add-derivation-role" size="compact-sm" variant="default" leftSection={<IconPlus size={14} />} disabled={busy} onClick={onAdd}>新建 Role</Button>
    </div>
    {error ? <InlineAlert id="derivation-roles-error" data-status="error">{error}</InlineAlert> : null}
    {entries.length === 0 ? (
      <div className="subsession-empty" data-empty="roles"><Text size="sm" c="dimmed">暂无 Role。</Text></div>
    ) : (
      <div className="subsession-roles-list" id="derivation-roles-list">
        {entries.map(([name, role]) => {
          const overrideCount = Object.keys(role?.capabilities || {}).length;
          const modelLabel = role?.model
            ? `${role.model}${role.thinkingLevel ? ` · ${role.thinkingLevel}` : ""}`
            : role?.thinkingLevel ? `思考 ${role.thinkingLevel}` : "跟随父会话";
          const builtin = Object.hasOwn(builtinRoles, name);
          return <article key={name} className="subsession-role-row" data-role-row={name} data-builtin={builtin || undefined}>
            <div className="subsession-role-main">
              <div className="subsession-role-head">
                <code className="subsession-role-name" data-field="name">{name}</code>
                <div className="subsession-role-badges">
                  <Badge size="xs" variant="light" color="gray" tt="none" data-field="model" data-model={role?.model || ""} data-thinking={role?.thinkingLevel || ""}>{modelLabel}</Badge>
                  <Badge size="xs" variant="light" color={role?.toolMode ? "accent" : "gray"} tt="none" data-field="tool-mode" data-tool-mode={role?.toolMode || "default"}>{role?.toolMode ? `工具 ${role.toolMode}` : "工具跟随默认"}</Badge>
                  <Badge size="xs" variant="light" color={role?.isolated === true ? "teal" : "gray"} tt="none" data-field="isolated" data-isolated={role?.isolated === undefined ? "default" : String(role.isolated)}>{role?.isolated === true ? "worktree 隔离" : role?.isolated === false ? "不隔离" : "隔离跟随默认"}</Badge>
                  <Badge size="xs" variant="light" color={overrideCount > 0 ? "accent" : "gray"} tt="none" data-field="capabilities" data-override-count={overrideCount}>{overrideCount > 0 ? `${overrideCount} 项开关覆盖` : "默认开关"}</Badge>
                </div>
              </div>
              {role?.description ? <div className="subsession-role-desc" data-field="description">{role.description}</div> : null}
            </div>
            <Group gap={6} wrap="nowrap" className="subsession-role-actions">
              <Button size="compact-sm" variant="subtle" data-action="edit-role" data-role={name} disabled={busy} onClick={() => onEdit(name)}>编辑</Button>
              {!builtin ? <Button size="compact-sm" variant="subtle" color="red" data-action="delete-role" data-role={name} disabled={busy} onClick={() => onDelete(name)}>删除</Button> : null}
            </Group>
          </article>;
        })}
      </div>
    )}
  </section>;
}
