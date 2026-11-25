import PanelMotion from "../../../design-system/motion/PanelMotion.jsx";

const findSidebar = () => document.querySelector(".desktop-sidebar");
const findMonitor = () => document.querySelector(".pi-monitor-panel:not(.pi-ghost)");
const findPane = () => document.getElementById("workspace-pane");

/** Open/close motion of the workbench chrome: the session sidebar slides from the left, the phone workspace overlay from
 * the right (opaque, transform only); the monitor panel settles down from its pill and fades on desktop, and on the
 * phone comes down opaque from under the top bar (it must never let the chat show through). */
export function ChromeMotion({ mobile, sidebar, monitor, pane, workspace }) {
  return <>
    <PanelMotion shown={sidebar} find={findSidebar} edge="left" drop={["desktop-sidebar"]} />
    {/* Do not leave a closing monitor ghost over the newly opened desktop workspace. */}
    {!(workspace && !mobile) && <PanelMotion shown={monitor} find={findMonitor} edge="up" distance="rise" fade={!mobile} drop={["pi-monitor-panel"]} />}
    <PanelMotion shown={pane} find={findPane} edge="right" drop={["pi-workspace-pane"]} />
  </>;
}
