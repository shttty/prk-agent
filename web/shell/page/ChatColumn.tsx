import type { ReactNode } from "react";
import type { PopoverProps } from "@mantine/core";
import { Flex, Popover } from "@mantine/core";
import { useContext } from "react";
import type { CssVars, PageActions } from "./page-types.ts";
import { MonitorPill } from "../../monitor/button/MonitorPill.jsx";
import Chat from "../../chat/thread/Chat.jsx";
import Crossfade from "../../design-system/crossfade/Crossfade.tsx";
import { SessionHeading } from "./chrome/SessionHeading.tsx";
import { HEADING_ROOM } from "./page-constants.ts";
import { StageCorner } from "../stage/stage-corner.ts";
import type { SelectedRow } from "../../workbench/store/store-types.ts";
import type { TerminalTask } from "../../chat/background-tasks/background-task-types.ts";

// The panel's placement (Floating UI): under the pill, right edges aligned, never flipped above it. Each time it is
// placed the panel fits the window's height. Documented exception to native layout: the chat column also learns how far
// the pill's right edge sits from its own (--pi-monitor-reach), the inset its reading column keeps clear of
// (--pi-monitor-side, page.css); that distance only exists once Floating UI has placed the panel.
const PANEL_PLACEMENT: PopoverProps["middlewares"] = { flip: false, size: { padding: 12, apply({ elements, availableHeight }) {
  if (elements.floating instanceof HTMLElement) elements.floating.style.maxHeight = `${availableHeight}px`;
  const column = elements.reference instanceof Element ? elements.reference.closest(".pi-chatcol") : null;
  if (column instanceof HTMLElement && elements.reference instanceof Element) column.style.setProperty("--pi-monitor-reach", `${column.getBoundingClientRect().right - elements.reference.getBoundingClientRect().right}px`);
} } };

type ChatColumnProps = {
  mobile: boolean; actions: PageActions; sessionRow: SelectedRow; selectedSessionId: string | null; banners: ReactNode; bannerBottom: number;
  expandSessionBar: ReactNode; chatWidth: number; monitor: "chip" | "panel" | "overlay"; monitorUnfolded: boolean; monitorPanel: ReactNode;
  onToggleMonitor: () => void; onViewTerminal: (sessionId: string, terminal: TerminalTask) => void;
};

/** The conversation column. Desktop: a card whose top is one control strip, a row laid out by Flex: the session sidebar's
 * expand button when that is folded (`expandSessionBar`), the session heading when there is room, the monitor pill
 * (the panel unfolds from it) and, while the chat holds the stage's top-right corner, the stage's buttons (StageCorner).
 * Phone: the bare column. `chatWidth` is the column's width as laid out; `monitor` is the folding state ("chip" |
 * "panel" | "overlay"). */
export function ChatColumn({ mobile, actions, sessionRow, selectedSessionId, banners, bannerBottom, expandSessionBar, chatWidth, monitor, monitorUnfolded, monitorPanel, onToggleMonitor, onViewTerminal }: ChatColumnProps) {
  const corner = useContext(StageCorner);
  const style: CssVars = { "--pi-banner-bottom": `${bannerBottom}px` };
  return <div className={`pi-chatcol${mobile ? "" : " has-float"}`} style={style} data-monitor={mobile ? undefined : monitor}>
    {banners}
    {!mobile && <Flex className="pi-chat-strip" h={36} pl={10} pr={8} gap={6} align="center" wrap="nowrap" flex="none">
      {expandSessionBar}
      {chatWidth >= HEADING_ROOM ? <SessionHeading sessionRow={sessionRow} /> : null}
      <Popover opened={monitorUnfolded} position="bottom-end" offset={7} width="var(--pi-monitor-w)" zIndex="var(--pi-z-monitor-panel)" middlewares={PANEL_PLACEMENT} transitionProps={{ duration: 0 }} unstyled>
        <Popover.Target><MonitorPill sessionRow={sessionRow} opened={monitorUnfolded} onToggle={onToggleMonitor} /></Popover.Target>
        <Popover.Dropdown className="pi-monitor-dropdown">{monitorPanel}</Popover.Dropdown>
      </Popover>
      {corner && <div className="pi-chat-corner" ref={corner} />}
    </Flex>}
    {/* Another session cross-fades in (opaque layers, plus-lighter, one curve); the transcript itself never animates. */}
    <Crossfade className="pi-chat-fade" layerKey={selectedSessionId ?? ""}><Chat key={selectedSessionId} actions={actions} onViewTerminal={onViewTerminal} /></Crossfade>
  </div>;
}
