import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Tabs } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { IconRotate } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import { PrkTriSwitch } from "../../design-system/switch/PrkTriSwitch.jsx";
import { firstSentence } from "../capabilities/panel/tool-mode.js";
import { modeChanges } from "../capabilities/panel/tool-mode.js";
import { toolMode } from "../capabilities/panel/tool-mode.js";
import { overlayRoleCapabilities } from "./overlay-role-capabilities.js";
import "../capabilities/capabilities.css";

const RESTORE_LABEL = "恢复默认";
const stopOf = (mode) => (mode === "resident" ? "on" : mode);

function lazyReason(item, isGroup) {
  if (!item.lazy) return "不支持懒加载";
  if (item.exposure === "model-only") return "仅模型内部使用的工具不能懒加载";
  if (item.lazy.available === true || item.enabled === false) return "";
  return isGroup ? "组内没有可懒加载的工具" : "该工具不支持懒加载";
}

function RestoreButton({ ids, capabilityId, lazyOverridden, disabled, onRestore }) {
  return <span className="capability-override" data-slot="mode">
    {ids.length > 0 ? <ActionIcon size={22} radius="sm" variant="subtle" color="accent" className="capability-restore" title={RESTORE_LABEL} aria-label={RESTORE_LABEL}
      data-action="restore-role-capability" data-capability-id={capabilityId} data-overridden="true" data-lazy-overridden={lazyOverridden ? "true" : undefined}
      disabled={disabled} onClick={(event) => { event.stopPropagation(); onRestore(ids); }}>
      <IconRotate size={15} stroke={2} aria-hidden="true" />
    </ActionIcon> : null}
  </span>;
}

export function RoleCapabilitiesPanel({ catalog, capabilities, disabled = false, onChange }) {
  const [tab, setTab] = useState("tools");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const { groups, entriesByGroup } = overlayRoleCapabilities(catalog, capabilities, tab);
  const overrideCount = Object.keys(capabilities || {}).length;
  const isTools = tab === "tools";

  const applyWrites = (writes) => {
    const next = { ...(capabilities || {}) };
    for (const { id, enabled } of writes) {
      if (enabled === null || enabled === undefined) delete next[id];
      else next[id] = Boolean(enabled);
    }
    onChange(next);
  };

  const restoreIds = (ids) => applyWrites(ids.map((id) => ({ id, enabled: null })));

  const pickToolStop = (item, stop) => {
    const nextMode = stop === "on" ? (item.lazy ? "resident" : "on") : stop;
    const writes = modeChanges(item, nextMode);
    if (!writes.length) {
      writes.push({ id: item.id, enabled: nextMode !== "off" });
      if (nextMode !== "off" && item.lazy?.id) writes.push({ id: item.lazy.id, enabled: nextMode === "lazy" });
    }
    applyWrites(writes);
  };

  const toggleCollapse = (id) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <section id="role-capabilities" className="subsession-capabilities" data-kind={tab}>
    <div className="subsession-capabilities-head">
      <div className="subsession-capabilities-title">
        <span>工具与 Skills 开关覆盖</span>
        <Badge size="xs" variant="light" color={overrideCount > 0 ? "accent" : "gray"} tt="none" data-override-count={overrideCount}>{overrideCount > 0 ? `已覆盖 ${overrideCount} 项` : "未覆盖"}</Badge>
      </div>
      <Tabs value={tab} onChange={(next) => { if (next) setTab(next); }} className="subsession-capabilities-tabs">
        <Tabs.List>
          <Tabs.Tab value="tools" id="role-capabilities-tab-tools" data-role-cap-tab="tools">工具</Tabs.Tab>
          <Tabs.Tab value="skills" id="role-capabilities-tab-skills" data-role-cap-tab="skills">Skills</Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </div>
    <div className="subsession-capabilities-body">
      {!groups.length ? <Text size="sm" c="dimmed" py="sm">暂无可配置项</Text> : groups.map((group) => {
        const members = entriesByGroup.get(group.id) || [];
        const isCollapsed = collapsed.has(group.id);
        const memberModes = isTools ? new Set(members.map(toolMode)) : null;
        const mode = !isTools ? undefined : !group.enabled ? "off" : memberModes.size > 1 ? null : memberModes.size === 1 ? [...memberModes][0] : toolMode(group);
        const groupOwned = [group.overridden ? group.id : null, group.lazy?.overridden ? group.lazy.id : null].filter(Boolean);
        return <section key={group.id} className="capability-section" data-provider-section={group.id}>
          <header className="capability-group capability-line" data-capability-group={group.id} data-state={!group.enabled ? "off" : mode === null ? "mixed" : "on"}>
            <div className="capability-copy">
              <div className="capability-copy-head">
                <h4 className="capability-group-name" title={group.name}>{group.name}</h4>
                <span className="capability-count" data-count={members.length}>{members.length} 项</span>
                <ActionIcon className="capability-members-toggle" data-action="toggle-members" data-collapsed={String(isCollapsed)} size="sm" variant="subtle" color="gray" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "展开组员" : "折叠组员"} onClick={() => toggleCollapse(group.id)}>
                  <IconChevronDown size={15} stroke={1.8} />
                </ActionIcon>
              </div>
            </div>
            {isTools ? group.id === "group:tools:local" ? null : (
              <span className="capability-mode" data-mode={mode ?? "mixed"} data-lazy-available={String(group.lazy?.available === true)}>
                <PrkTriSwitch label={`${group.name} 加载方式`} value={mode === null ? null : stopOf(mode)} lazyReason={lazyReason(group, true) || undefined}
                  disabled={disabled || group.available === false}
                  leading={<RestoreButton ids={groupOwned} capabilityId={group.id} lazyOverridden={group.lazy?.overridden} disabled={disabled} onRestore={restoreIds} />}
                  onChange={(stop) => pickToolStop(group, stop)} />
              </span>
            ) : (
              <span className="capability-pair">
                <RestoreButton ids={group.overridden ? [group.id] : []} capabilityId={group.id} disabled={disabled} onRestore={restoreIds} />
                <PrkSwitch data-action="toggle-group" aria-label={group.name} checked={group.enabled === true} disabled={disabled || group.available === false}
                  onChange={(event) => applyWrites([{ id: group.id, enabled: event.currentTarget.checked }])} />
              </span>
            )}
          </header>
          {isCollapsed ? null : <div className="capability-rows" data-group-enabled={String(group.enabled !== false)}>
            {members.map((entry) => {
              const entryMode = isTools ? toolMode(entry) : undefined;
              const entryOwned = [entry.overridden ? entry.id : null, entry.lazy?.overridden ? entry.lazy.id : null].filter(Boolean);
              const rowDisabled = disabled || entry.locked === true || entry.available === false || entry.groupEnabled === false;
              return <div key={entry.id} className="capability-row capability-line" data-capability={entry.id} data-enabled={String(Boolean(entry.enabled))} data-group-enabled={String(entry.groupEnabled !== false)}>
                <div className="capability-copy">
                  <div className="capability-copy-head"><span className="capability-name" data-name={entry.name}>{entry.name}</span></div>
                  {entry.description ? <div className="capability-summary">{firstSentence(entry.description)}</div> : null}
                </div>
                {isTools ? (
                  <span className="capability-mode" data-mode={entryMode ?? "off"} data-lazy-available={String(entry.lazy?.available === true)}>
                    <PrkTriSwitch label={`${entry.name} 加载方式`} value={stopOf(entryMode)} lazyReason={lazyReason(entry, false) || undefined}
                      disabled={rowDisabled}
                      leading={<RestoreButton ids={entryOwned} capabilityId={entry.id} lazyOverridden={entry.lazy?.overridden} disabled={disabled} onRestore={restoreIds} />}
                      onChange={(stop) => pickToolStop(entry, stop)} />
                  </span>
                ) : (
                  <span className="capability-pair">
                    <RestoreButton ids={entry.overridden ? [entry.id] : []} capabilityId={entry.id} disabled={disabled} onRestore={restoreIds} />
                    <PrkSwitch size="sm" data-action="toggle-capability" aria-label={entry.name} checked={entry.locked === true || entry.configured === true} disabled={rowDisabled}
                      onChange={(event) => applyWrites([{ id: entry.id, enabled: event.currentTarget.checked }])} />
                  </span>
                )}
              </div>;
            })}
          </div>}
        </section>;
      })}
    </div>
  </section>;
}
