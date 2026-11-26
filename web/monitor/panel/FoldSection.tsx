import type { ComponentProps } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import { layout } from "../../shell/layout/layout-store.js";
import { useLayout } from "../../shell/layout/use-layout.js";
import { SectionTitle } from "./SectionTitle.tsx";
import { openMonitorBlocks } from "./open-monitor-blocks.ts";

const toggle = (name: string) => {
  const open = new Set(openMonitorBlocks(layout.get()));
  if (open.has(name)) open.delete(name);
  else open.add(name);
  layout.set({ monitorOpenBlocks: [...open].join(",") });
};

type FoldSectionProps = ComponentProps<"section"> & { name: string; title: string; summary: string };

/** A monitor section whose list folds under its heading; the heading keeps its summary text either way, cut
 * to one line with the full text on hover. The open
 * ones are the layout preference `monitorOpenBlocks`, shared by every session. */
export function FoldSection({ name, title, summary, children, ...props }: FoldSectionProps) {
  const open = openMonitorBlocks(useLayout()).includes(name);
  return <section className="pi-monitor-section" data-monitor-fold={name} data-open={open ? "true" : "false"} {...props}>
    <SectionTitle flush={!open}><button type="button" className="pi-monitor-fold" data-action="toggle-monitor-fold" aria-expanded={open} onClick={() => toggle(name)}>
      <IconChevronRight className="pi-monitor-fold-icon" size={12} stroke={2} aria-hidden="true" />
      <span className="pi-monitor-fold-title">{title}</span><span className="pi-monitor-summary" title={summary}>{summary}</span>
    </button></SectionTitle>
    {open ? children : null}
  </section>;
}
