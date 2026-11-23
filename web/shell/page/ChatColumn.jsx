import { MonitorPill } from "../../monitor/button/MonitorPill.jsx";
import Chat from "../../chat/thread/Chat.jsx";
import Crossfade from "../../design-system/crossfade/Crossfade.jsx";
import { SessionHeading } from "./chrome/SessionHeading.jsx";
import { HEADING_ROOM } from "./page-constants.js";

/** The conversation column. Desktop: a card with a control strip at its top (session heading when there is room, the
 * monitor pill and its floating panel; `controlsOver`: the stage's control group sits over its top-right corner), the
 * session sidebar's expand button when that is folded (`expandSessionBar`). Phone: the bare column. `chatWidth` is the
 * column's width as laid out; `monitor` is the folding state ("chip" | "panel" | "overlay"). */
export function ChatColumn({ mobile, actions, sessionRow, selectedSessionId, banners, bannerBottom, expandSessionBar, chatWidth, controlsOver, monitor, monitorUnfolded, monitorPanel, onToggleMonitor, onViewTerminal }) {
  return <div className={`pi-chatcol${mobile ? "" : " has-float"}${controlsOver ? " has-controls" : ""}${expandSessionBar ? " has-expand" : ""}`} style={{ "--pi-banner-bottom": `${bannerBottom}px` }} data-monitor={mobile ? undefined : monitor}>
    {banners}
    {expandSessionBar}
    {!mobile && chatWidth >= HEADING_ROOM && <SessionHeading sessionRow={sessionRow} />}
    {!mobile && <MonitorPill sessionRow={sessionRow} opened={monitorUnfolded} onToggle={onToggleMonitor} />}
    {!mobile && monitorPanel}
    {/* Another session cross-fades in (opaque layers, plus-lighter, one curve); the transcript itself never animates. */}
    <Crossfade className="pi-chat-fade" layerKey={selectedSessionId}><Chat key={selectedSessionId} actions={actions} onViewTerminal={onViewTerminal} /></Crossfade>
  </div>;
}
