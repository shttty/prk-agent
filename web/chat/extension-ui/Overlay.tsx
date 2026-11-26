import { useRef } from "react";
import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Prompt } from "./Prompt.tsx";
import type { ExtensionAction, ExtensionPrompt } from "./extension-render-types.ts";

export type OverlayGeometry = { width: number; height: number; cellWidth: number; cellHeight: number };
type OverlayProps = { prompt: ExtensionPrompt; index: number; actions: ExtensionAction; geometry: OverlayGeometry };

/**
 * A plugin's `ctx.ui.custom` overlay. The plugin asks for TUI placement (anchor, margin, row/col in terminal cells), so
 * this one is positioned absolutely from the options and the measured cell size: a layout component cannot express it.
 */
export function Overlay({ prompt, index, actions, geometry }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const options = prompt.overlay || {};
  const focus = prompt.focused ?? prompt.focus ?? options.focus;
  useEffect(() => { if (focus && !prompt.hidden) ref.current?.querySelector<HTMLElement>("input,textarea,button")?.focus({ preventScroll: true }); }, [focus, prompt.hidden]);
  const cells = (value: number | string | undefined, metric: number) => typeof value === "number" ? `${value * metric}px` : value;
  const margin = typeof options.margin === "number" ? { top: options.margin, right: options.margin, bottom: options.margin, left: options.margin } : options.margin || {};
  const anchor = options.anchor || "center";
  const horizontal = anchor.includes("left") ? "left" : anchor.includes("right") ? "right" : "center";
  const vertical = anchor.includes("top") ? "top" : anchor.includes("bottom") ? "bottom" : "center";
  const style: CSSProperties = { zIndex: `calc(var(--pi-z-extension-overlay) + ${index})`, width: cells(options.width, geometry.cellWidth), minWidth: cells(options.minWidth, geometry.cellWidth), maxWidth: `calc(100vw - ${((margin.left || 0) + (margin.right || 0)) * geometry.cellWidth}px)`, maxHeight: cells(options.maxHeight, geometry.cellHeight), left: options.col !== undefined ? cells(options.col, geometry.cellWidth) : horizontal === "left" ? cells(margin.left || 0, geometry.cellWidth) : horizontal === "center" ? "50%" : undefined, right: options.col === undefined && horizontal === "right" ? cells(margin.right || 0, geometry.cellWidth) : undefined, top: options.row !== undefined ? cells(options.row, geometry.cellHeight) : vertical === "top" ? cells(margin.top || 0, geometry.cellHeight) : vertical === "center" ? "50%" : undefined, bottom: options.row === undefined && vertical === "bottom" ? cells(margin.bottom || 0, geometry.cellHeight) : undefined, transform: `translate(${options.col === undefined && horizontal === "center" ? "-50%" : "0"}, ${options.row === undefined && vertical === "center" ? "-50%" : "0"}) translate(${cells(options.offsetX ?? 0, geometry.cellWidth)}, ${cells(options.offsetY ?? 0, geometry.cellHeight)})` };
  return <div ref={ref} className="extension-ui-overlay" style={style} hidden={prompt.hidden || prompt.visible === false} role="dialog" data-focused={focus ? "true" : "false"}><Prompt prompt={prompt} actions={actions} /></div>;
}
