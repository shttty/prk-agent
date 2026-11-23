import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { Textarea } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";

const DEPTH_OPTIONS = Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}` }));

export function DerivationDefaultsSection({ draft, defaults, busy, saving, saved, error, onChange, onSave }) {

  return <section className="settings-section subsession-section" data-section="derivation-defaults">
    <div className="subsession-section-head">
      <div className="subsession-section-title">
        <h3 className="pi-settings-heading">全局默认设置</h3>
        {saved ? <Badge id="derivation-defaults-status" data-status="saved" role="status" component="span" variant="light" color="green" size="sm" tt="none">已保存</Badge> : null}
      </div>
    </div>
    {error ? <InlineAlert id="derivation-defaults-error" data-status="error">{error}</InlineAlert> : null}
    <div className="subsession-card">
      <div className="subsession-field">
        <div className="subsession-field-label"><span>默认工具档位</span></div>
        <div className="subsession-field-control">
          <NativeSelect id="derivation-default-tool-mode" className="subsession-select-sm" size="xs" aria-label="默认工具档位" value={draft.defaultToolMode} disabled={busy}
            data={[{ value: "", label: "跟随会话默认" }, { value: "code", label: "code" }, { value: "direct", label: "direct" }]}
            onChange={(event) => onChange({ defaultToolMode: event.currentTarget.value })} />
        </div>
      </div>
      <div className="subsession-field">
        <div className="subsession-field-label"><span>默认 worktree 隔离</span></div>
        <div className="subsession-field-control">
          <PrkSwitch id="derivation-default-isolated" aria-label="默认 worktree 隔离" checked={Boolean(draft.defaultIsolated)} disabled={busy}
            onChange={(event) => onChange({ defaultIsolated: event.currentTarget.checked })} />
        </div>
      </div>
      <div className="subsession-field">
        <div className="subsession-field-label"><span>最大嵌套深度</span></div>
        <div className="subsession-field-control">
          <NativeSelect id="derivation-max-depth" className="subsession-select-sm" size="xs" aria-label="最大嵌套深度" value={String(draft.maxDepth)} disabled={busy}
            data={DEPTH_OPTIONS} onChange={(event) => onChange({ maxDepth: Number(event.currentTarget.value) })} />
        </div>
      </div>
      <div className="subsession-field is-column">
        <div className="subsession-field-head">
          <span className="subsession-field-label">默认子会话提示词</span>
          <Button id="reset-derivation-instructions" size="compact-xs" variant="subtle" disabled={busy}
            onClick={() => onChange({ defaultInstructions: defaults.defaultInstructions })}>恢复默认</Button>
        </div>
        <Textarea id="derivation-default-instructions" aria-label="默认子会话提示词" autosize minRows={2} maxRows={5} value={draft.defaultInstructions} disabled={busy}
          onChange={(event) => onChange({ defaultInstructions: event.currentTarget.value })} />
      </div>
      <div className="subsession-footer">
        <Button id="save-derivation-defaults" size="xs" loading={saving} disabled={busy} onClick={onSave}>保存默认设置</Button>
      </div>
    </div>
  </section>;
}
