import { useContext } from "react";
import { Popover } from "@mantine/core";
import { MonitorPill } from "../../monitor/button/MonitorPill.jsx";
import Chat from "../../chat/thread/Chat.jsx";
import Crossfade from "../../design-system/crossfade/Crossfade.jsx";
import { SessionHeading } from "./chrome/SessionHeading.jsx";
import { HEADING_ROOM } from "./page-constants.js";
import { StageCorner } from "../stage/stage-corner.js";

// The panel's placement (Floating UI): under the pill, right edges aligned, never flipped above it. Each time it is
// placed the panel fits the window's height, and the chat column learns how far the pill's right edge sits from its
// own, the inset its reading column keeps clear of (--pi-monitor-side, page.css).
const PANEL_PLACEMENT = { flip: false, size: { padding: 12, apply({ elements, availableHeight }) {
  elements.floating.style.maxHeight = `${availableHeight}px`;
  const column = elements.reference.closest(".pi-chatcol");
  column?.style.setProperty("--pi-monitor-reach", `${column.getBoundingClientRect().right - elements.reference.getBoundingClientRect().right}px`);
} } };

/** The conversation column. Desktop: a card whose top is one control strip laid out as a row: the session sidebar's
 * expand button when that is folded (`expandSessionBar`), the session heading when there is room, the monitor pill
 * (the panel unfolds from it) and, while the chat holds the stage's top-right corner, the stage's buttons (StageCorner).
 * Phone: the bare column. `chatWidth` is the column's width as laid out; `monitor` is the folding state ("chip" |
 * "panel" | "overlay"). */
export function ChatColumn({ mobile, actions, sessionRow, selectedSessionId, banners, bannerBottom, expandSessionBar, chatWidth, monitor, monitorUnfolded, monitorPanel, onToggleMonitor, onViewTerminal }) {
  const corner = useContext(StageCorner);
  return <div className={`pi-chatcol${mobile ? "" : " has-float"}`} style={{ "--pi-banner-bottom": `${bannerBottom}px` }} data-monitor={mobile ? undefined : monitor}>
    {banners}
    {!mobile && <div className="pi-chat-strip">
      {expandSessionBar}
      {chatWidth >= HEADING_ROOM && <SessionHeading sessionRow={sessionRow} />}
      <Popover opened={monitorUnfolded} position="bottom-end" offset={7} width="var(--pi-monitor-w)" zIndex="var(--pi-z-monitor-panel)" middlewares={PANEL_PLACEMENT} transitionProps={{ duration: 0 }} unstyled>
        <Popover.Target><MonitorPill sessionRow={sessionRow} opened={monitorUnfolded} onToggle={onToggleMonitor} /></Popover.Target>
        <Popover.Dropdown className="pi-monitor-dropdown">{monitorPanel}</Popover.Dropdown>
      </Popover>
      {corner && <div className="pi-chat-corner" ref={corner} />}
    </div>}
    {/* Another session cross-fades in (opaque layers, plus-lighter, one curve); the transcript itself never animates. */}
    <Crossfade className="pi-chat-fade" layerKey={selectedSessionId}><Chat key={selectedSessionId} actions={actions} onViewTerminal={onViewTerminal} /></Crossfade>
  </div>;
}
