import { createPortal } from "react-dom";
import { ProviderDetail } from "./ProviderDetail.jsx";
import { DetailSheet } from "./DetailSheet.jsx";
import { CATEGORY_LABEL } from "../provider-categories.js";
import { categoryOf } from "../provider-categories.js";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { ConfigBody } from "../config/ConfigBody.jsx";
export function CapabilityLayers({ ctx }) {
  const { frame, mobile, sheet, setSheet, sheetGroup, configurable, config, setConfig, configGroup } = ctx;
return frame ? createPortal(<>
    {mobile ? <DetailSheet open={sheet.open} onClose={() => setSheet((state) => ({ ...state, open: false }))} closeAction="close-provider" id="capability-sheet" data-provider={sheetGroup?.id}>
      <ProviderDetail ctx={ctx} item={sheetGroup} inSheet={true} />
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
