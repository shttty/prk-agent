import { Flex, SimpleGrid, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "./tri-switch.css";

type TriStop = "off" | "lazy" | "on";
type PrkTriSwitchProps = {
  /** The radiogroup's accessible name. */
  label: string;
  /** null = mixed: striped track, no knob. */
  value: TriStop | null;
  /** Set: the middle stop is a dashed, disabled gap with this tooltip. */
  lazyReason?: string;
  disabled?: boolean;
  /** Rendered in a fixed slot just left of the track (e.g. a reset button). */
  leading?: ReactNode;
  onChange: (next: TriStop) => void;
};

const STOPS: readonly { value: TriStop; label: string }[] = [
  { value: "off", label: "关闭" },
  { value: "lazy", label: "懒加载" },
  { value: "on", label: "开启" },
];
const FLASH_MS = 1200;

/** 12px knob glyphs: hollow ring / half-filled disc / solid dot, readable without colour. */
function Glyph({ value }: { value: TriStop }) {
  if (value === "off") return <svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (value === "lazy") return <svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M6 2.1a3.9 3.9 0 0 0 0 7.8z" fill="currentColor" /></svg>;
  return <svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="currentColor" /></svg>;
}

/**
 * PRK three-way pill switch (design system): knob at left / middle / right = 关闭 / 懒加载 / 开启, track grey / blue /
 * green. Clicking a third jumps straight there. The state word fades in left of the `leading` slot for a moment after a
 * click (and on desktop hover). The three hit zones are the cells of a 3-column grid over the track.
 */
export function PrkTriSwitch({ label, value, lazyReason, disabled = false, leading = null, onChange }: PrkTriSwitchProps) {
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const stops = STOPS.map((stop) => ({ ...stop, disabled: disabled || (stop.value === "lazy" && Boolean(lazyReason)) }));
  const pick = (next: TriStop) => {
    clearTimeout(timer.current);
    setFlash(true);
    timer.current = setTimeout(() => setFlash(false), FLASH_MS);
    if (next !== value) onChange(next);
  };
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const enabled = stops.filter((stop) => !stop.disabled);
    const index = enabled.findIndex((stop) => stop.value === value);
    const next = enabled[Math.max(0, Math.min(enabled.length - 1, (index < 0 ? (step > 0 ? -1 : enabled.length) : index) + step))];
    if (next) pick(next.value);
  };
  const shown = STOPS.find((stop) => stop.value === value)?.label ?? "混合";
  return <Flex component="span" align="center" gap={6} pos="relative" flex="none" className="tri prk-tri-switch" data-value={value ?? "mixed"} data-lazy={lazyReason ? "unavailable" : "available"} data-flash={flash ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
    <Text component="span" className="tri-status" aria-hidden="true" w={42} flex="0 0 42px" py={2} ta="right" fz={12} lh={1.4} c="var(--pi-ink-2)">{shown}</Text>
    {leading}
    <SimpleGrid cols={3} spacing={0} pos="relative" w="var(--tri-w)" h="var(--tri-h)" className="tri-track prk-pill-track" role="radiogroup" aria-label={label} onKeyDown={keyDown}>
      {/* Exception to the layout rule: the knob slides between the stops and the gap mark sits on the middle one, so both overlay the grid. */}
      {lazyReason ? <span className="tri-gap" aria-hidden="true" /> : null}
      {value ? <span className="tri-knob prk-pill-knob" aria-hidden="true"><Glyph value={value} /></span> : null}
      {stops.map((stop) => {
        const zone = <UnstyledButton key={stop.value} type="button" className="tri-zone" w="100%" h="100%" data-zone={stop.value} data-stop={stop.value} role="radio" aria-checked={stop.value === value} aria-label={stop.label}
          tabIndex={stop.value === (value ?? "off") ? 0 : -1} disabled={stop.disabled} onClick={(event) => { event.stopPropagation(); pick(stop.value); }} />;
        return stop.value === "lazy" && lazyReason
          ? <Tooltip key={stop.value} label={lazyReason} withinPortal events={{ hover: true, focus: true, touch: true }}><span className="tri-zone-wrap" data-zone="lazy">{zone}</span></Tooltip>
          : zone;
      })}
    </SimpleGrid>
  </Flex>;
}
