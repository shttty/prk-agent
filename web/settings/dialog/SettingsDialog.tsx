import type { LayoutCodeContext } from "../../shell/layout/layout-types.ts";
import type { PageActions, WorkbenchState } from "../../shell/page/page-types.ts";
import { useState } from "react";
import { memo } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { useEffect } from "react";
import { sections } from "./settings-sections.ts";
import { useRef } from "react";
import { Modal } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { IconChevronRight } from "@tabler/icons-react";
import Crossfade from "../../design-system/crossfade/Crossfade.tsx";
import { GeneralSettings } from "./GeneralSettings.tsx";
import { VisualEffectsSettings } from "./VisualEffectsSettings.tsx";
import { TargetManagement } from "../../instances/list/TargetManagement.jsx";
import SubsessionSettings from "../subsessions/SubsessionSettings.tsx";
import MemoryDialog from "../memory/MemoryDialog.tsx";
import SoulSettings from "../soul/SoulSettings.tsx";
import ArtifactsPanel from "../artifacts/ArtifactsPanel.tsx";
import PluginsPanel from "../plugins/PluginsPanel.tsx";
import { ArchiveDialog } from "../../sessions/archive/ArchiveDialog.jsx";
import CapabilitiesPanel from "../capabilities/CapabilitiesPanel.tsx";
import "./settings-dialog.css";
// Desktop: first-level navigation | page. Phone: the full-screen list folds into an icon rail as the page slides in
// over it (transform/opacity only); a tap on the rail's empty part goes back. Page switches cross-fade (Crossfade).
type SettingsDialogProps = {
  opened: boolean; onClose: () => void; fullScreen: boolean; initialSection: string | null; actions: PageActions; onReset: () => void; layoutContext: () => LayoutCodeContext;
};

function SettingsDialog({ opened, onClose, fullScreen, initialSection, actions, onReset, layoutContext }: SettingsDialogProps) {
  const gatewayRestartUnit = useWorkbench((state: WorkbenchState) => state.gatewayRestartUnit);
  const [section, setSection] = useState<string | null>(null);
  // Phone: the last page stays rendered under the list so leaving it slides out instead of vanishing.
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!opened) return;
    const first = initialSection || (fullScreen ? null : "general");
    setSection(first); setShown(first);
  }, [opened, initialSection, fullScreen]);
  const open = (id: string) => { setSection(id); setShown(id); };
  // A plugin's 在工具页查看 opens the tools page on that plugin's source.
  const [toolsFocus, setToolsFocus] = useState<string | null>(null);
  const openTools = (provider: string) => { setToolsFocus(provider); open("tools"); };
  const page = shown;
  const title = sections.find((entry) => entry.id === page)?.label;
  const mode = fullScreen ? (section ? "content" : "list") : "desktop";
  // Phone: entering a page from the list only slides it in; switching pages from the rail cross-fades.
  const wasContent = useRef(false);
  useEffect(() => { wasContent.current = mode === "content"; });
  return <Modal id="settings-dialog" className="pi-settings" opened={opened} onClose={onClose} centered fullScreen={fullScreen} size="min(1100px, 94vw)" closeButtonProps={{ id: "close-settings", "aria-label": "关闭设置" }}
    title={<span className="pi-settings-titlebar" data-mode={mode}>
      <ActionIcon id="settings-back" className="pi-settings-back" variant="subtle" color="gray" aria-label="返回" tabIndex={mode === "content" ? 0 : -1} onClick={() => setSection(null)}><IconChevronLeft size={18} /></ActionIcon>
      <span className="pi-settings-title-root">设置</span><span className="pi-settings-title-page">{title}</span>
    </span>}>
    <div className="pi-settings-shell" data-mode={mode}>
      <nav id="settings-navigation" className="pi-settings-nav" aria-label="设置分类" onClick={(event) => { if (mode === "content" && !(event.target instanceof Element && event.target.closest("button"))) setSection(null); }}>
        {sections.map(({ id, label, Icon, hook }) => <button key={id} id={hook} type="button" data-settings-section={id} aria-current={section === id ? "page" : undefined} aria-label={label} onClick={() => open(id)}>
          <span className="pi-settings-nav-icon"><span><Icon size={18} stroke={1.7} /></span></span>
          <span className="pi-settings-nav-text"><span>{label}</span><IconChevronRight className="pi-settings-chevron" size={15} /></span>
        </button>)}
      </nav>
      <Crossfade id="settings-content" className="pi-settings-content" data-section={page ?? undefined} layerKey={page ?? ""} fade={!fullScreen || wasContent.current}>
        {page === "general" ? <div className="pi-settings-page"><GeneralSettings onReset={onReset} layoutContext={layoutContext} gatewayRestartUnit={gatewayRestartUnit} api={actions.api} /></div> : null}
        {page === "visual-effects" ? <div className="pi-settings-page"><VisualEffectsSettings setShowImages={actions.setShowImages} /></div> : null}
        {page === "targets" ? <div className="pi-settings-page" id="settings-targets"><TargetManagement actions={actions} mobile={fullScreen} /></div> : null}
        {page === "subsessions" ? <div className="pi-settings-page" id="settings-subsessions"><SubsessionSettings actions={actions} mobile={fullScreen} /></div> : null}
        {page === "soul" ? <div className="pi-settings-page" id="settings-soul"><SoulSettings api={actions.api} /></div> : null}
        {page === "memory" ? <MemoryDialog actions={actions} mobile={fullScreen} /> : null}
        {page === "artifacts" ? <div className="pi-settings-page"><ArtifactsPanel actions={actions} /></div> : null}
        {page === "plugins" ? <PluginsPanel actions={actions} gatewayRestartUnit={gatewayRestartUnit} mobile={fullScreen} onOpenTools={openTools} /> : null}
        {page === "archive" ? <div className="pi-settings-page" id="settings-archive"><ArchiveDialog actions={actions} onViewHistory={onClose} /></div> : null}
        {page === "tools" || page === "skills" ? <CapabilitiesPanel key={page} kind={page} actions={actions} mobile={fullScreen} initialProvider={page === "tools" ? toolsFocus ?? undefined : undefined} /> : null}
      </Crossfade>
    </div>
  </Modal>;
}
export default memo(SettingsDialog);
