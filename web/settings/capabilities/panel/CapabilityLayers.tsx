import type { CapabilityCtx } from "../capability-types.ts";
import { createPortal } from "react-dom";
import { ProviderDetail } from "./ProviderDetail.tsx";
import { DetailSheet } from "../../list-page/DetailSheet.tsx";
import { CATEGORY_LABEL } from "../provider-categories.ts";
import { categoryOf } from "../provider-categories.ts";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ConfigBody } from "../config/ConfigBody.tsx";
export function CapabilityLayers({ ctx }: { ctx: CapabilityCtx }) {
  const { frame, mobile, sheet, setSheet, sheetGroup, configurable, config, setConfig, configGroup } = ctx;
return frame ? createPortal(<>
    {mobile ? <DetailSheet open={sheet.open} onClose={() => setSheet((state) => ({ ...state, open: false }))} closeAction="close-provider" id="capability-sheet" data-provider={sheetGroup?.id}>
      <ProviderDetail ctx={ctx} item={sheetGroup} onBack={() => setSheet((state) => ({ ...state, open: false }))} />
    </DetailSheet> : null}
    {configurable ? <div className="capability-layer is-config" data-open={String(config.open)}>
      <div className="config-scrim" data-action="close-config" onClick={() => setConfig((state) => ({ ...state, open: false }))} />
      <aside className="config-panel" id="plugin-config" data-provider={configGroup?.id} aria-hidden={!config.open} aria-label="插件配置">
        {configGroup ? <>
          <header className="config-head">
            <div className="config-title"><h3>{configGroup.name}</h3><span>{CATEGORY_LABEL[categoryOf(configGroup.id)]}</span></div>
            <ActionIcon data-action="close-config" variant="subtle" color="gray" aria-label="关闭" onClick={() => setConfig((state) => ({ ...state, open: false }))}><IconX size={18} /></ActionIcon>
          </header>
          <div className="config-scroll">{<ConfigBody ctx={ctx} item={configGroup} />}</div>
        </> : null}
      </aside>
    </div> : null}
  </>, frame) : null;
}
