import "./banners.css";
import { useCallback } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { IconChevronUp } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import type { ReactElement } from "react";
import type { AlertProps } from "@mantine/core";
import { TONES } from "./banner-constants.ts";
import { levelOf } from "./banner-level.ts";
import StatusDot from "../../../design-system/status-dot/StatusDot.tsx";
import { Paper } from "@mantine/core";
import LeaveList from "../../../design-system/motion/LeaveList.tsx";
const asElement = (node: Element | null | undefined) => (node instanceof HTMLElement ? node : null);

const findBanner = (key: string) => asElement(document.querySelector(`#session-banners > [data-leave-key="${CSS.escape(key)}"]`));

const findHost = () => asElement(document.querySelector(".pi-banner-lane")?.parentElement);

type BannerStackProps = { items: ReactElement<AlertProps>[]; collapsed: boolean; onToggle: () => void; onBottom: (bottom: number) => void };

// Exception to native layout: the plugin toasts (chat/extension-ui) start below this stack, so its bottom edge is measured
// and handed to the chat column as --pi-banner-bottom. Goes away when the toasts share the column's flow.
export default function BannerStack({ items, collapsed, onToggle, onBottom }: BannerStackProps) {
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return undefined;
    const report = () => onBottom(node.offsetTop + node.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => { observer.disconnect(); onBottom(0); };
  }, [onBottom]);
  // Banners that go (resolved, or folded into the chip) slide off; the leave list outlives the stack for the last one.
  const leave = <LeaveList keys={collapsed ? [] : items.map((item) => String(item.key))} find={findBanner} host={findHost} edge="up" />;
  if (!items.length) return <>{leave}{null}</>;
  const level = levelOf(items);
  const Chevron = collapsed ? IconChevronDown : IconChevronUp;
  return <>{leave}<div className="pi-banner-lane" ref={measure}>
    <div className="pi-banners" id="session-banners" data-count={items.length} data-level={level} data-collapsed={String(collapsed)}>
      <Button id="toggle-banners" className="pi-banners-toggle" variant="default" size="compact-xs" radius="xl" aria-expanded={!collapsed} aria-label={collapsed ? "展开提示" : "收起提示"} leftSection={<StatusDot tone={TONES[level]} size={8} />} rightSection={<Chevron size={14} aria-hidden="true" />} onClick={onToggle}>{items.length}</Button>
      {collapsed ? null : items.map((item) => <Paper key={item.key} className="pi-banner" data-leave-key={item.key} shadow="md" radius="md">{item}</Paper>)}
    </div>
  </div></>;
}

