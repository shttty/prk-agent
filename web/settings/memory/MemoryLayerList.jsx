import { Text } from "@mantine/core";

/**
 * Left column of the memory page, in the tools page's list styles: one row per layer with its entry count, then
 * the configuration row. `items` are `{ id, label, count? }`.
 */
export default function MemoryLayerList({ items, active, mobile, onChoose, hint }) {
  const keyDown = (event, id) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(id); } };
  return <section className="capability-providers memory-layers">
    <div className="capability-provider-list memory-layer-list" id="memory-layers" role="listbox" aria-label="记忆层">
      {items.map((item) => <div key={item.id} role="option" tabIndex={0} className="capability-provider" id={`memory-layer-${item.id}`} data-memory-layer={item.id}
        aria-selected={!mobile && active === item.id} onClick={() => onChoose(item.id)} onKeyDown={(event) => keyDown(event, item.id)}>
        <span className="capability-provider-name">{item.label}</span>
        {item.count === undefined ? null : <span className="capability-count" data-count={item.count}>{item.count}</span>}
      </div>)}
    </div>
    {hint ? <Text id="memory-project-hint" className="memory-hint">{hint}</Text> : null}
  </section>;
}
