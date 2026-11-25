import { IconChevronRight } from "@tabler/icons-react";
import { layout } from "../../shell/layout/layout-store.js";
import { useLayout } from "../../shell/layout/use-layout.js";

const toggle = (name) => {
  const open = new Set(layout.get().monitorOpenBlocks.split(",").filter(Boolean));
  if (open.has(name)) open.delete(name);
  else open.add(name);
  layout.set({ monitorOpenBlocks: [...open].join(",") });
};

/** A monitor section whose list folds under its heading; the heading keeps its one-line summary either way. The open
 * ones are the layout preference `monitorOpenBlocks`, shared by every session. */
export function FoldSection({ name, title, summary, children, ...props }) {
  const open = useLayout().monitorOpenBlocks.split(",").includes(name);
  return <section className="pi-monitor-section" data-monitor-fold={name} data-open={open ? "true" : "false"} {...props}>
    <h3><button type="button" className="pi-monitor-fold" data-action="toggle-monitor-fold" aria-expanded={open} onClick={() => toggle(name)}>
      <IconChevronRight className="pi-monitor-fold-icon" size={13} stroke={2.4} aria-hidden="true" />
      {title}<span className="pi-monitor-summary">{summary}</span>
    </button></h3>
    {open ? children : null}
  </section>;
}
