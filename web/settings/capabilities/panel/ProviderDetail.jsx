import { ActionIcon } from "@mantine/core";
import { Tooltip } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { IconLock } from "@tabler/icons-react";
import { OverrideControl } from "./OverrideControl.jsx";
import { ModeControl } from "./ModeControl.jsx";
import { groupMode } from "./tool-mode.js";
import { groupItem } from "./tool-mode.js";
import { firstSentence } from "./tool-mode.js";
import { categoryOf } from "../provider-categories.js";
import { statusLabels } from "../library-actions.js";
import { PrkSwitch } from "../../../design-system/switch/PrkSwitch.jsx";
import { DetailHeader } from "../../list-page/DetailHeader.jsx";

/** Name + one grey line; badges ride on the name line. */
function Copy({ name, description, children, handlers }) {
  return <div className="capability-copy" {...handlers}>
    <div className="capability-copy-head"><span className="capability-name" data-name={name}>{name}</span>{children}</div>
    {description ? <div className="capability-summary">{description}</div> : null}
  </div>;
}

const tag = (props, text) => <Badge component="span" variant="light" color="gray" size="xs" tt="none" className="capability-stage" {...props}>{text}</Badge>;

/** One member line: name, summary, state badges and its own switch (disabled while the group is off). */
function ProviderRow({ ctx, entry }) {
  const { kind, peekOpen, peek, rowHandlers, scopeLabel, disabled, change } = ctx;
  return <div className="capability-row capability-line" data-capability={entry.id} data-enabled={String(Boolean(entry.enabled))} data-group-enabled={String(entry.groupEnabled !== false)}
    data-available={String(entry.available !== false)} data-module={entry.module} data-pending={entry.pending ? "true" : undefined} data-overrides-builtin={entry.overridesBuiltin ? "true" : undefined}
    data-peeking={peekOpen && peek?.entry.id === entry.id ? "true" : undefined} id={entry.library ? `${kind}-entry-${encodeURIComponent(entry.library.name)}` : undefined} data-status={entry.library?.status}>
    <Copy name={entry.name} description={firstSentence(entry.description)} handlers={rowHandlers(entry)}>
      {entry.library ? tag({ "data-status": entry.library.status, "data-manual": String(entry.library.manual) }, statusLabels[entry.library.status] ?? entry.library.status) : null}
      {entry.library?.scope ? tag({ className: "capability-stage capability-scope", "data-scope": entry.library.scope }, scopeLabel(entry.library.scope)) : null}
      {entry.shadowedBy ? tag({ variant: "outline", className: "capability-stage capability-shadowed", "data-shadowed": "true" }, "被覆盖") : null}
      {entry.overridesBuiltin ? tag({ "data-overrides-builtin": "true" }, "覆盖内置") : null}
      {entry.error ? tag({ color: "red", "data-reason": "module-error" }, "不可用") : null}
      {entry.pending ? tag({ "data-reason": "pending-inspection" }, "待加载") : null}
      {entry.locked ? <Badge component="span" variant="transparent" color="gray" size="xs" tt="none" leftSection={<IconLock size={12} />} className="capability-lock" data-locked="true">锁定</Badge> : null}
    </Copy>
    {!entry.catalogued || entry.moduleOnly ? (entry.overridden ? <OverrideControl ctx={ctx} id={entry.id} overridden={entry.overridden} /> : null)
      : kind === "tools" ? <ModeControl ctx={ctx} item={entry} />
        : <span className="capability-pair"><OverrideControl ctx={ctx} id={entry.id} overridden={entry.overridden} /><PrkSwitch data-action="toggle-capability" aria-label={entry.name} checked={entry.locked === true || entry.configured === true} disabled={disabled(entry)} onChange={(event) => void change(entry.id, event.currentTarget.checked)} /></span>}
  </div>;
}

/**
 * The provider picked in the source list: its title line (count, 配置, the group switch — 混合 when members
 * disagree) and its member lines. `onBack` is set inside the phone sheet.
 */
export function ProviderDetail({ ctx, item, onBack }) {
  const { hits, drafts, counts, configurable, openConfig, kind, loading, saving, change, entries, savedGroup, savedEmpty, needle } = ctx;
  if (!item) return null;
  const { rows } = hits(item);
  const tools = kind === "tools";
  const grouped = groupItem(item);
  const mode = tools ? groupMode(grouped.item, entries.filter((entry) => entry.group === item.id)) : undefined;
  const count = counts.get(item.id) ?? 0;
  const empty = item.id === savedGroup && !needle;
  return <div className="settings-detail capability-detail" data-scroll="detail">
    <section className="capability-section" data-provider-section={item.id}>
      <DetailHeader title={item.name} onBack={onBack} backAction="close-provider" data-capability-group={item.id} data-state={!item.enabled ? "off" : mode === null ? "mixed" : "on"}
        meta={<><span className="capability-count" data-count={count}>{count} 项</span>{item.id === "group:tools:local" && item.available === false ? <span data-reason="local-only"> · 仅本机实例可用</span> : null}</>}>
        {configurable && categoryOf(item.id) !== "remote" ? <Tooltip label="配置"><ActionIcon className="capability-config-open" data-action="open-config" data-provider={item.id} variant="subtle" color="gray" aria-label="配置" onClick={() => openConfig(item)}>
          <IconSettings size={16} />{drafts[item.id] !== undefined ? <span className="capability-dirty" data-dirty="true" /> : null}
        </ActionIcon></Tooltip> : null}
        {tools ? <ModeControl ctx={ctx} item={grouped.item} group mode={mode} writes={grouped.writes} />
          : <span className="capability-pair"><OverrideControl ctx={ctx} id={item.id} overridden={item.overridden} /><PrkSwitch data-action="toggle-group" aria-label={item.name} checked={item.enabled === true} disabled={saving || item.available === false} onChange={(event) => void change(item.id, event.currentTarget.checked)} /></span>}
      </DetailHeader>
      <div className="capability-list capability-rows" id={`${kind}-library-list`} data-group-enabled={String(item.enabled !== false)} aria-busy={loading || saving}>
        {rows.map((entry) => <ProviderRow key={entry.id} ctx={ctx} entry={entry} />)}
        {!rows.length ? <Text size="sm" c="dimmed" data-empty={empty ? "saved" : "match"}>{empty ? savedEmpty : "无匹配"}</Text> : null}
      </div>
    </section>
  </div>;
}
