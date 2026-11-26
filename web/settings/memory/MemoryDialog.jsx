import { useState } from "react";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { SplitPage } from "../list-page/SplitPage.jsx";
import { DetailHeader } from "../list-page/DetailHeader.jsx";
import MemoryLayerList from "./MemoryLayerList.jsx";
import MemoryDocuments from "./MemoryDocuments.jsx";
import MemoryDeleteDialog from "./MemoryDeleteDialog.jsx";
import LayerConfig from "./LayerConfig.jsx";
import { layerLabel } from "./layer-label.js";
import { useMemoryListing } from "./use-memory-listing.js";
import "./memory.css";

const CONFIG = "__config";

/** Global memory page: layer list | selected layer. Project-scoped layers are edited from the sidebar project menu. */
export default function MemoryDialog({ actions, mobile }) {
  const memory = useMemoryListing(actions.api);
  const { listing, busy, error, setError, setEditor } = memory;
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    return <div className="settings-detail" data-memory-detail={active}>
      <DetailHeader title={items.find((item) => item.id === active)?.label} onBack={back} backAction="close-memory-layer" />
      <div className="settings-detail-body">
        {!listing.enabled && !listing.error ? <Text id="memory-disabled" size="sm" c="dimmed">记忆已关闭。修改配置后需重启 Gateway。</Text> : null}
        {listing.error ? <InlineAlert id="memory-config-error" size="sm">{listing.error}</InlineAlert> : null}
        {error ? <InlineAlert id="memory-error" size="sm">{error}</InlineAlert> : null}
        {layer ? <MemoryDocuments layer={layer} documents={documentsOf(layer.name)} memory={memory} currentInstance={currentInstance} />
          : active === CONFIG ? <LayerConfig api={actions.api} onSaved={memory.reload} /> : null}
      </div>
    </div>;
  };
  return <>
    <SplitPage id="memory-manager" mobile={mobile} sheetOpen={sheetOpen} onCloseSheet={() => setSheetOpen(false)} sheetId="memory-sheet" backAction="close-memory-layer"
      aria-busy={busy} data-enabled={String(listing.enabled)} detail={detail}
      list={<MemoryLayerList items={items} active={active} mobile={mobile} onChoose={choose} hint={layers.length < listing.layers.length ? "项目记忆在侧栏项目菜单里。" : ""} />} />
    <MemoryDeleteDialog memory={memory} />
  </>;
}
