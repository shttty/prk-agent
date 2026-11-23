import type { UiContext, Overlay } from "../ui-types.ts";
import type { TUI } from "@earendil-works/pi-tui";
import { addChild } from "./viewport/add-child.ts";
import { removeChild } from "./viewport/remove-child.ts";
import { clear } from "./viewport/clear.ts";
import { getShowHardwareCursor } from "./terminal/get-hardware-cursor.ts";
import { setShowHardwareCursor } from "./terminal/set-hardware-cursor.ts";
import { getClearOnShrink } from "./terminal/get-clear-on-shrink.ts";
import { setClearOnShrink } from "./terminal/set-clear-on-shrink.ts";
import { setFocus } from "./viewport/set-focus.ts";
import { hideOverlay } from "./overlays/hide-overlay.ts";
import { hasOverlay } from "./overlays/has-overlay.ts";
import { start } from "./terminal/start.ts";
import { stop } from "./terminal/stop.ts";
import { renderNow } from "./viewport/render-now.ts";
import { requestRender } from "./viewport/request-render.ts";
import { addInputListener } from "./input/add-input-listener.ts";
import { removeInputListener } from "./input/remove-input-listener.ts";
import { onTerminalColorSchemeChange } from "./terminal/subscribe-color-scheme.ts";
import { setTerminalColorSchemeNotifications } from "./terminal/set-color-notifications.ts";
import { unsupportedTui } from "./terminal/reject-terminal-operation.ts";
import { queryTerminalColors } from "./terminal/query-colors.ts";
import { renderTerminal } from "./terminal/reject-terminal-render.ts";
import { invalidateViewport } from "./viewport/invalidate.ts";
import { getTerminal } from "./terminal/get-terminal.ts";
import { showOverlay } from "./overlays/show-overlay.ts";

export function createTuiAdapter(ctx: UiContext, overlays: Map<string, Overlay>): TUI {
  const adapter: TUI = {
    mode: "regular",
    children: [],
    get terminal(): never { return getTerminal(ctx); },
    fullRedraws: 0,
    addChild: () => addChild(ctx),
    removeChild: () => removeChild(ctx),
    clear: () => clear(ctx),
    getShowHardwareCursor: () => getShowHardwareCursor(ctx),
    setShowHardwareCursor: () => setShowHardwareCursor(ctx),
    getClearOnShrink: () => getClearOnShrink(ctx),
    setClearOnShrink: () => setClearOnShrink(ctx),
    setFocus: (component) => setFocus(ctx, overlays, component),
    showOverlay: (component, options) => showOverlay(ctx, overlays, component, options),
    hideOverlay: () => hideOverlay(ctx, overlays),
    hasOverlay: () => hasOverlay(ctx, overlays),
    start: () => start(ctx),
    stop: () => stop(ctx),
    renderNow: () => renderNow(ctx),
    requestRender: () => requestRender(ctx),
    addInputListener: () => addInputListener(ctx),
    removeInputListener: () => removeInputListener(ctx),
    onTerminalColorSchemeChange: () => onTerminalColorSchemeChange(ctx),
    setTerminalColorSchemeNotifications: () => setTerminalColorSchemeNotifications(ctx),
    setSuspendSignalHandler: () => unsupportedTui("suspend signal handler"),
    queryTerminalColors: () => queryTerminalColors(ctx),
    render: () => renderTerminal(ctx),
    invalidate: () => invalidateViewport(ctx),
  };
  return adapter;
}
