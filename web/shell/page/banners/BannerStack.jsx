import "./banners.css";
import { useCallback } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { IconChevronUp } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import StatusDot from "../../../design-system/status-dot/StatusDot.jsx";
import { Paper } from "@mantine/core";
import LeaveList from "../../../design-system/motion/LeaveList.jsx";
export const TONES = { error: "error", warn: "warn", info: "idle" };

export const levelOf = (items) => (items.some((item) => item.props.color === "red") ? "error" : items.some((item) => item.props.color === "yellow") ? "warn" : "info");

const findBanner = (key) => document.querySelector(`#session-banners > [data-leave-key="${CSS.escape(key)}"]`);

const findHost = () => document.querySelector(".pi-banner-lane")?.parentElement ?? null;

export default function BannerStack({ items, collapsed, onToggle, onBottom }) {
  const measure = useCallback((node) => {
    const report = () => onBottom(node.offsetTop + node.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => { observer.disconnect(); onBottom(0); };
  }, [onBottom]);
  // Banners that go (resolved, or folded into the chip) slide off; the leave list outlives the stack for the last one.
  const leave = <LeaveList keys={collapsed ? [] : items.map((item) => item.key)} find={findBanner} host={findHost} edge="up" />;
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

