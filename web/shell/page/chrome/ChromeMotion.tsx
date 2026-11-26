import PanelMotion from "../../../design-system/motion/PanelMotion.tsx";

const findElement = (selector: string) => () => {
  const node = document.querySelector(selector);
  return node instanceof HTMLElement ? node : null;
};

const findSidebar = findElement(".desktop-sidebar");
// Desktop: the popover holding the panel (it is the box placed under the pill); phone: the sheet.
const findMonitor = findElement(".pi-monitor-dropdown:not(.pi-ghost), .pi-monitor-panel[data-mobile]:not(.pi-ghost)");
const findPane = findElement("#workspace-pane");

type ChromeMotionProps = { mobile: boolean; sidebar: boolean; monitor: boolean; pane: boolean; workspace: boolean };

/** Open/close motion of the workbench chrome: the session sidebar slides from the left, the phone workspace overlay from
 * the right (opaque, transform only); the monitor panel settles down from its pill and fades on desktop, and on the
 * phone comes down opaque from under the top bar (it must never let the chat show through). */
export function ChromeMotion({ mobile, sidebar, monitor, pane, workspace }: ChromeMotionProps) {
  return <>
    <PanelMotion shown={sidebar} find={findSidebar} edge="left" drop={["desktop-sidebar"]} />
    {/* Do not leave a closing monitor ghost over the newly opened desktop workspace. */}
    {!(workspace && !mobile) && <PanelMotion shown={monitor} find={findMonitor} edge="up" distance="rise" fade={!mobile} drop={["pi-monitor-dropdown", "pi-monitor-panel"]} />}
    <PanelMotion shown={pane} find={findPane} edge="right" drop={["pi-workspace-pane"]} />
  </>;
}
