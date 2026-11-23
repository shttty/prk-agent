import { ActionIcon } from "@mantine/core";
import { IconRotate } from "@tabler/icons-react";
import { toolMode } from "./tool-mode.js";
import { modeChanges } from "./tool-mode.js";
import { PrkTriSwitch } from "../../../design-system/switch/PrkTriSwitch.jsx";

const RESTORE = "恢复默认（跟随上一层）";

/**
 * Why 懒加载 is not offered. The backend reports `lazy.available: false` for every disabled tool/group, but from 关闭
 * picking 懒加载 enables it first, so "off" alone is not a reason: only intrinsic ones (no lazy field, model-only,
 * unsupported while enabled, no lazy-capable member) disable the middle stop.
 */
function lazyReason(item, group) {
  if (!item.lazy) return "不支持懒加载";
  if (item.exposure === "model-only") return "仅模型内部使用的工具不能懒加载";
  if (item.lazy.available === true || item.enabled === false) return "";
  if (group) return "组内没有可懒加载的工具";
  return "该工具不支持懒加载";
}

/** Catalog mode → switch stop: resident (lazy off) and plain on are both the right-hand 开启. */
const stopOf = (mode) => (mode === "resident" ? "on" : mode);

/**
 * ↺ slot + pill switch for one tool or tool group. `mode` null = members disagree (striped, no knob).
 * The ↺ appears when this layer holds its own value for the enable or the lazy id; it clears both in one batch.
 */
export function ModeControl({ ctx, item, group = false, mode = toolMode(item), writes = (next) => modeChanges(item, next) }) {
  const { session, instance, saving, change } = ctx;
  const off = saving || item.locked === true || item.available === false || item.groupEnabled === false;
  const owned = [item.overridden ? item.id : null, item.lazy?.overridden ? item.lazy.id : null].filter(Boolean);
  const resetLocked = off || (!item.overridden && item.lazy?.overridden === true && item.lazy.available !== true);
  const pick = async (stop) => {
    const next = stop === "on" ? (item.lazy ? "resident" : "on") : stop;
    const changes = writes(next);
    if (changes.length) await change(changes);
  };
  const reset = <span className="capability-override" data-slot="mode">
    {(session || instance) && owned.length ? <ActionIcon size={22} radius="sm" variant="subtle" color="accent" className="capability-restore" title={RESTORE} aria-label={RESTORE}
      data-action="restore-default" data-overridden="true" data-lazy-overridden={item.lazy?.overridden ? "true" : undefined} disabled={resetLocked}
      onClick={(event) => { event.stopPropagation(); void change(owned.map((id) => ({ id, enabled: null }))); }}>
      <IconRotate size={15} stroke={2} aria-hidden="true" />
    </ActionIcon> : null}
  </span>;
  return <span className="capability-mode" data-mode={mode ?? "mixed"} data-lazy-available={String(item.lazy?.available === true)}>
    <PrkTriSwitch label={`${item.name} 加载方式`} value={mode === null ? null : stopOf(mode)} lazyReason={lazyReason(item, group) || undefined} disabled={off} leading={reset} onChange={(stop) => void pick(stop)} />
  </span>;
}
