import type { PageActions, WorkbenchState } from "../../shell/page/page-types.ts";
import { useState } from "react";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { SplitPage } from "../list-page/SplitPage.tsx";
import { DetailHeader } from "../list-page/DetailHeader.tsx";
import { LinkWait } from "../list-page/LinkWait.tsx";
import { ListRow } from "../list-page/ListRow.tsx";
import MemoryDocuments from "./MemoryDocuments.tsx";
import MemoryDeleteDialog from "./MemoryDeleteDialog.tsx";
import LayerConfig from "./LayerConfig.tsx";
import { layerLabel } from "./layer-label.ts";
import { useMemoryListing } from "./use-memory-listing.ts";
import "./memory.css";

const CONFIG = "__config";

/** Global memory page: layer list | selected layer. Project-scoped layers are edited from the sidebar project menu. */
export default function MemoryDialog({ actions, mobile }: { actions: PageActions; mobile: boolean }) {
  const memory = useMemoryListing(actions.api);
  const { listing, busy, error, setError, setEditor } = memory;
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentInstance = useWorkbench((state: WorkbenchState) => state.selectedSessionId ? state.sessions.get(state.selectedSessionId)?.target : undefined);
  const layers = listing.layers.filter((layer) => layer.scope !== "project");
  const documentsOf = (name: string) => listing.memories.filter((document) => document.target === name);
  const items: { id: string; label: string; count?: number }[] = [
    ...layers.map((layer) => ({ id: layer.name, label: layerLabel(layer.name), count: documentsOf(layer.name).reduce((sum, document) => sum + document.entries.length, 0) })),
    { id: CONFIG, label: "配置" },
  ];
  const active = selected ?? items[0]?.id ?? CONFIG;
  const choose = (id: string) => { setSelected(id); setEditor(null); setError(""); if (mobile) setSheetOpen(true); };
  const detail = (back: (() => void) | null) => {
    const layer = layers.find((item) => item.name === active);
    return <div className="settings-detail" data-memory-detail={active}>
      <DetailHeader title={items.find((item) => item.id === active)?.label} onBack={back} backAction="close-memory-layer" />
      <div className="settings-detail-body">
        {!listing.enabled && !listing.error ? <Text id="memory-disabled" size="sm" c="dimmed">记忆已关闭。修改配置后需重启 Gateway。</Text> : null}
        {listing.error ? <InlineAlert id="memory-config-error" size="sm">{listing.error}</InlineAlert> : null}
        {error ? <InlineAlert id="memory-error" size="sm">{error}</InlineAlert> : null}
        {memory.waiting ? <LinkWait /> : layer ? <MemoryDocuments layer={layer} documents={documentsOf(layer.name)} memory={memory} currentInstance={currentInstance} />
          : active === CONFIG ? <LayerConfig api={actions.api} onSaved={memory.reload} /> : null}
      </div>
    </div>;
  };
  return <>
    <SplitPage id="memory-manager" mobile={mobile} sheetOpen={sheetOpen} onCloseSheet={() => setSheetOpen(false)} sheetId="memory-sheet" backAction="close-memory-layer"
      aria-busy={busy} data-enabled={String(listing.enabled)} detail={detail}
      list={<section className="settings-list memory-layers">
        <div className="settings-list-scroll" id="memory-layers" role="listbox" aria-label="记忆层">
          {items.map((item) => <ListRow key={item.id} id={`memory-layer-${item.id}`} data-memory-layer={item.id} name={item.label} count={item.count}
            selected={!mobile && active === item.id} onChoose={() => choose(item.id)} />)}
        </div>
        {layers.length < listing.layers.length ? <div className="settings-list-foot" id="memory-project-hint">项目记忆在侧栏项目菜单里。</div> : null}
      </section>} />
    <MemoryDeleteDialog memory={memory} />
  </>;
}
