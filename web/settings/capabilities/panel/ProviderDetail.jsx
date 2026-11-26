import { useState } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { ActionIcon } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { IconChevronDown } from "@tabler/icons-react";
import { OverrideControl } from "./OverrideControl.jsx";
import { categoryOf } from "../provider-categories.js";
import { Button } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { ModeControl } from "./ModeControl.jsx";
import { groupMode } from "./tool-mode.js";
import { groupItem } from "./tool-mode.js";
import { firstSentence } from "./tool-mode.js";
import { Badge } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { PrkSwitch } from "../../../design-system/switch/PrkSwitch.jsx";
import { Text } from "@mantine/core";
import { statusLabels } from "../library-actions.js";

/** Name + one grey line; badges ride on the name line. */
function Copy({ name, title, description, children, handlers }) {
  return <div className="capability-copy" {...handlers}>
    <div className="capability-copy-head">{title ?? <span className="capability-name" data-name={name}>{name}</span>}{children}</div>
    {description ? <div className="capability-summary">{description}</div> : null}
  </div>;
}

/** One provider: its group line (same selector as the members, 混合 when they disagree) and its member lines. */
function ProviderSection({ ctx, item, active, collapsed, onToggle, back }) {
  const { hits, drafts, counts, configurable, openConfig, kind, loading, saving, peekOpen, peek, rowHandlers, scopeLabel, disabled, change, entries, savedGroup, savedEmpty, needle } = ctx;
  const { rows } = hits(item);
  const dirty = drafts[item.id] !== undefined;
  const tools = kind === "tools";
  const members = entries.filter((entry) => entry.group === item.id);
  const grouped = groupItem(item);
  const mode = tools ? groupMode(grouped.item, members) : undefined;
  const count = counts.get(item.id) ?? 0;
  return <section className="capability-section" data-provider-section={item.id}>
    <header className="capability-group capability-line" data-capability-group={item.id} data-state={!item.enabled ? "off" : mode === null ? "mixed" : "on"}>
      {back}
      <Copy title={<h3 className="capability-group-name capability-group-title" title={item.name}>{item.name}</h3>}
        description={<>
          <span className="capability-count" data-count={count}>{count} 项</span>
          {item.id === "group:tools:local" && item.available === false ? <span className="capability-note" data-reason="local-only"> · 仅本机实例可用</span> : null}
        </>}>
        <ActionIcon className="capability-members-toggle" data-action="toggle-members" data-collapsed={String(collapsed)} size="sm" variant="subtle" color="gray" aria-expanded={!collapsed} aria-label={collapsed ? "展开组员" : "折叠组员"} onClick={onToggle}>
          <IconChevronDown size={15} stroke={1.8} />
        </ActionIcon>
      </Copy>
      {configurable && categoryOf(item.id) !== "remote" ? <Button className="capability-config-open" data-action="open-config" data-provider={item.id} size="compact-sm" variant="default" leftSection={<IconSettings size={14} />} rightSection={dirty ? <span className="capability-dirty" data-dirty="true" /> : null} onClick={() => openConfig(item)}>配置</Button> : null}
      {tools ? <ModeControl ctx={ctx} item={grouped.item} group mode={mode} writes={grouped.writes} /> : <span className="capability-pair"><OverrideControl ctx={ctx} id={item.id} overridden={item.overridden} /><PrkSwitch data-action="toggle-group" aria-label={item.name} checked={item.enabled === true} disabled={saving || item.available === false} onChange={(event) => void change(item.id, event.currentTarget.checked)} /></span>}
    </header>
    {collapsed ? null : <div className="capability-rows" id={active ? `${kind}-library-list` : undefined} data-group-enabled={String(item.enabled !== false)} aria-busy={loading || saving}>
      {rows.map((entry) => <div key={entry.id} className="capability-row capability-line" data-capability={entry.id} data-enabled={String(Boolean(entry.enabled))} data-group-enabled={String(entry.groupEnabled !== false)}
        data-available={String(entry.available !== false)} data-module={entry.module} data-pending={entry.pending ? "true" : undefined} data-overrides-builtin={entry.overridesBuiltin ? "true" : undefined}
        data-peeking={peekOpen && peek?.entry.id === entry.id ? "true" : undefined} id={entry.library ? `${kind}-entry-${encodeURIComponent(entry.library.name)}` : undefined} data-status={entry.library?.status}>
        <Copy name={entry.name} description={firstSentence(entry.description)} handlers={rowHandlers(entry)}>
          {entry.library ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" className="capability-stage" data-status={entry.library.status} data-manual={String(entry.library.manual)}>{statusLabels[entry.library.status] ?? entry.library.status}</Badge> : null}
          {entry.library?.scope ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" className="capability-stage capability-scope" data-scope={entry.library.scope}>{scopeLabel(entry.library.scope)}</Badge> : null}
          {entry.shadowedBy ? <Badge component="span" variant="outline" color="gray" size="xs" tt="none" className="capability-stage capability-shadowed" data-shadowed="true">被覆盖</Badge> : null}
          {entry.overridesBuiltin ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" className="capability-stage" data-overrides-builtin="true">覆盖内置</Badge> : null}
          {entry.error ? <Badge component="span" variant="light" color="red" size="xs" tt="none" className="capability-stage" data-reason="module-error">不可用</Badge> : null}
          {entry.pending ? <Badge component="span" variant="light" color="gray" size="xs" tt="none" className="capability-stage" data-reason="pending-inspection">待加载</Badge> : null}
          {entry.locked ? <Badge component="span" variant="transparent" color="gray" size="xs" tt="none" leftSection={<IconLock size={12} />} className="capability-lock" data-locked="true">锁定</Badge> : null}
        </Copy>
        {!entry.catalogued || entry.moduleOnly ? (entry.overridden ? <OverrideControl ctx={ctx} id={entry.id} overridden={entry.overridden} /> : null)
          : tools ? <ModeControl ctx={ctx} item={entry} />
            : <span className="capability-pair"><OverrideControl ctx={ctx} id={entry.id} overridden={entry.overridden} /><PrkSwitch size="sm" data-action="toggle-capability" aria-label={entry.name} checked={entry.locked === true || entry.configured === true} disabled={disabled(entry)} onChange={(event) => void change(entry.id, event.currentTarget.checked)} /></span>}
      </div>)}
      {!rows.length ? <Text size="sm" c="dimmed" data-empty={item.id === savedGroup && !needle ? "saved" : "match"}>{item.id === savedGroup && !needle ? savedEmpty : "无匹配"}</Text> : null}
    </div>}
  </section>;
}

/**
 * Every provider in one scrolling list (the left list jumps to a provider), so groups can be folded and the
 * whole setup reads top to bottom. `item` is the provider picked on the left; it scrolls to the top.
 */
export function ProviderDetail({ ctx, item, inSheet }) {
  const { visible, setSheet } = ctx;
  const [collapsed, setCollapsed] = useState(() => new Set());
  const scroller = useRef(null);
  useEffect(() => {
    const box = scroller.current;
    const target = item && box?.querySelector(`[data-provider-section="${CSS.escape(item.id)}"]`);
    if (target) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, [item]);
  if (!item) return null;
  const toggle = (id) => setCollapsed((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const back = inSheet ? <ActionIcon data-action="close-provider" variant="subtle" color="gray" aria-label="返回" onClick={() => setSheet((state) => ({ ...state, open: false }))}><IconChevronLeft size={18} /></ActionIcon> : null;
  return <div className="capability-detail" data-scroll="detail" ref={scroller}>
    <div className="capability-list">
      {(inSheet ? [item] : visible).map((provider) => <ProviderSection key={provider.id} ctx={ctx} item={provider} active={provider.id === item.id} collapsed={collapsed.has(provider.id)} onToggle={() => toggle(provider.id)} back={provider.id === item.id ? back : null} />)}
    </div>
  </div>;
}
