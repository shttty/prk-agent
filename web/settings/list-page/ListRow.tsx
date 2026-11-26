import type { ComponentProps, KeyboardEvent, ReactNode } from "react";

type ListRowProps = Omit<ComponentProps<"div">, "children"> & { selected: boolean; onChoose: () => void; name?: ReactNode; meta?: ReactNode; count?: number; children?: ReactNode };

/**
 * One row of a settings list column (memory layers, tool and Skills sources, plugins): name, an optional grey line
 * under it, an optional count; neutral selection. Extra props (ids, data-*) land on the row.
 */
export function ListRow({ selected, onChoose, name, meta, count, children, ...props }: ListRowProps) {
  const keyDown = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(); } };
  return <div role="option" tabIndex={0} className="settings-list-row" aria-selected={selected} onClick={onChoose} onKeyDown={keyDown} {...props}>
    <span className="settings-list-text">
      {children ?? <span className="settings-list-name">{name}</span>}
      {meta ? <span className="settings-list-meta">{meta}</span> : null}
    </span>
    {count === undefined ? null : <span className="settings-list-count" data-count={count}>{count}</span>}
  </div>;
}
