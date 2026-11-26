import { useState } from "react";
import { useCallback } from "react";
import { createPortal } from "react-dom";
import { Text } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { DetailSheet } from "../capabilities/panel/DetailSheet.jsx";
import MemoryLayerList from "./MemoryLayerList.jsx";
import MemoryDocuments from "./MemoryDocuments.jsx";
import MemoryDeleteDialog from "./MemoryDeleteDialog.jsx";
import LayerConfig from "./LayerConfig.jsx";
import { layerLabel } from "./layer-label.js";
import { useMemoryListing } from "./use-memory-listing.js";
import "../capabilities/capabilities.css";
import "./memory.css";

const CONFIG = "__config";

/**
 * Global memory page, laid out like the tools page: layer list | selected layer; on phones the layer opens in a
 * slide-over. Project-scoped layers are edited per project from the sidebar project menu instead.
 */
export default function MemoryDialog({ actions, mobile }) {
  const memory = useMemoryListing(actions.api);
  const { listing, busy, error, setError, setEditor } = memory;
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [frame, setFrame] = useState(null);
  const rootRef = useCallback((node) => setFrame(node?.closest(".mantine-Modal-content") ?? null), []);
  const currentInstance = useWorkbench((state) => state.sessions.get(state.selectedSessionId)?.target);
  const layers = listing.layers.filter((layer) => layer.scope !== "project");
  const documentsOf = (name) => listing.memories.filter((document) => document.target === name);
  const items = [
    ...layers.map((layer) => ({ id: layer.name, label: layerLabel(layer.name), count: documentsOf(layer.name).reduce((sum, document) => sum + document.entries.length, 0) })),
    { id: CONFIG, label: "配置" },
  ];
  const active = selected ?? items[0].id;
  const choose = (id) => { setSelected(id); setEditor(null); setError(""); if (mobile) setSheetOpen(true); };
  const detail = (back) => {
    const layer = layers.find((item) => item.name === active);
    return <div className="capability-detail memory-detail" data-memory-detail={active}>
      <header className="capability-group capability-line memory-detail-head">{back}<h3 className="capability-group-name">{items.find((item) => item.id === active)?.label}</h3></header>
      <div className="memory-detail-body">
        {!listing.enabled && !listing.error ? <Text id="memory-disabled" size="sm" c="dimmed">记忆已关闭。修改配置后需重启 Gateway。</Text> : null}
        {listing.error ? <InlineAlert id="memory-config-error" size="sm">{listing.error}</InlineAlert> : null}
        {error ? <InlineAlert id="memory-error" size="sm">{error}</InlineAlert> : null}
        {layer ? <MemoryDocuments layer={layer} documents={documentsOf(layer.name)} memory={memory} currentInstance={currentInstance} />
          : active === CONFIG ? <LayerConfig api={actions.api} onSaved={memory.reload} /> : null}
      </div>
    </div>;
  };
  const back = <ActionIcon data-action="close-memory-layer" variant="subtle" color="gray" aria-label="返回" onClick={() => setSheetOpen(false)}><IconChevronLeft size={18} /></ActionIcon>;
  return <div ref={rootRef} className="capabilities-panel" id="memory-manager" data-layout={mobile ? "stack" : "split"} aria-busy={busy} data-enabled={String(listing.enabled)}>
    <MemoryLayerList items={items} active={active} mobile={mobile} onChoose={choose} hint={layers.length < listing.layers.length ? "项目记忆在侧栏项目菜单里。" : ""} />
    {!mobile ? <div className="capability-detail-host">{detail(null)}</div> : null}
    {mobile && frame ? createPortal(<DetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} closeAction="close-memory-layer" id="memory-sheet">{detail(back)}</DetailSheet>, frame) : null}
    <MemoryDeleteDialog memory={memory} />
  </div>;
}
