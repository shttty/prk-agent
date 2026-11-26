import { ListRow } from "../list-page/ListRow.jsx";

/** Left column of the memory page: one row per layer with its entry count, then the configuration row. */
export default function MemoryLayerList({ items, active, mobile, onChoose, hint }) {
  return <section className="settings-list memory-layers">
    <div className="settings-list-scroll" id="memory-layers" role="listbox" aria-label="记忆层">
      {items.map((item) => <ListRow key={item.id} id={`memory-layer-${item.id}`} data-memory-layer={item.id} name={item.label} count={item.count}
        selected={!mobile && active === item.id} onChoose={() => onChoose(item.id)} />)}
    </div>
    {hint ? <div className="settings-list-foot" id="memory-project-hint">{hint}</div> : null}
  </section>;
}
