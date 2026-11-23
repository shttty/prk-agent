import { Badge } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../../design-system/inline-alert/InlineAlert.jsx";
import { LibraryDetails } from "../LibraryDetails.jsx";
export function PeekEntry({ ctx }) {
  const { peekEntry, providers, shadower, kind, saving, scope, setDeletion, mutateLibrary } = ctx;
return peekEntry ? <>
        <div className="capability-peek-head"><span className="capability-peek-name">{peekEntry.name}</span>
          <Badge component="span" variant={peekEntry.enabled && !peekEntry.locked && peekEntry.groupEnabled !== false ? "light" : "default"} color={peekEntry.enabled && !peekEntry.locked && peekEntry.groupEnabled !== false ? "accent" : "gray"} size="sm" tt="none" className="capability-peek-state" data-state={peekEntry.locked ? "locked" : peekEntry.groupEnabled === false ? "group-off" : peekEntry.enabled ? "on" : "off"}>{peekEntry.locked ? "锁定" : peekEntry.groupEnabled === false ? "组已关闭" : peekEntry.catalogued === false ? peekEntry.library?.status : peekEntry.enabled ? "已开" : "已关"}</Badge></div>
        <div className="capability-peek-sub">{providers.find((item) => item.id === peekEntry.group)?.name}</div>
        {peekEntry.description ? <Text size="sm" className="capability-description" data-field="description">{peekEntry.description}</Text> : null}
        {peekEntry.error ? <InlineAlert data-field="module-error">{peekEntry.error}</InlineAlert> : null}
        {peekEntry.source || peekEntry.defaultEnabled !== undefined || peekEntry.shadowedBy ? <dl className="capability-peek-facts">
          {peekEntry.shadowedBy ? <><dt>覆盖者</dt><dd data-field="shadowed-by" data-id={peekEntry.shadowedBy}>{shadower(peekEntry.shadowedBy)}</dd></> : null}
          {peekEntry.source ? <><dt>来源</dt><dd data-field="source">{peekEntry.source}</dd></> : null}
          {peekEntry.module ? <><dt>模块</dt><dd data-field="module">{peekEntry.module}</dd></> : null}
          {peekEntry.overridesBuiltin ? <><dt>覆盖</dt><dd data-field="overrides-builtin">内置模块</dd></> : null}
          {peekEntry.defaultEnabled !== undefined ? <><dt>默认</dt><dd>{peekEntry.defaultEnabled ? "开" : "关"}</dd></> : null}
          {peekEntry.locked ? <><dt>说明</dt><dd>code 模式必需</dd></> : null}
        </dl> : null}
        {peekEntry.library ? <div id={`${kind}-library-detail`} className="capability-library-detail"><LibraryDetails entry={peekEntry.library} kind={kind} busy={saving} scope={scope} onAction={(action, saved) => action === "delete" ? setDeletion(saved) : void mutateLibrary(action, saved)} /></div> : null}
      </> : null;
}
