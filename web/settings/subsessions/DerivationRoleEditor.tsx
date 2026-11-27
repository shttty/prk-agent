import type { CapabilityCatalog } from "../capabilities/capability-types.ts";
import type { ModelOption, RoleConfig, RoleEditorState } from "./subsession-types.ts";
import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { RoleCapabilitiesPanel } from "./RoleCapabilitiesPanel.tsx";

const ALL_THINKING = ["off", "minimal", "low", "medium", "high", "xhigh"];

type RoleDraft = { name: string; description: string; model: string; thinkingLevel: string; toolMode: string; isolated: string; spawnsLimited: string; spawns: string; instructions: string; capabilities: Record<string, boolean> };

type DerivationRoleEditorProps = {
  editor: RoleEditorState; existingNames: string[]; models: readonly ModelOption[]; catalog: CapabilityCatalog | null; busy: boolean; saving: boolean; error: string;
  onSave: (name: string, role: RoleConfig, originalName: string) => void; onCancel: () => void;
};

export function DerivationRoleEditor({ editor, existingNames, models, catalog, busy, saving, error, onSave, onCancel }: DerivationRoleEditorProps) {
  const [draft, setDraft] = useState<RoleDraft>(() => ({
    name: editor.name || "",
    description: editor.role?.description || "",
    model: editor.role?.model || "",
    thinkingLevel: editor.role?.thinkingLevel || "",
    toolMode: editor.role?.toolMode || "",
    isolated: editor.role?.isolated === true ? "true" : editor.role?.isolated === false ? "false" : "",
    spawnsLimited: editor.role?.spawns ? "limited" : "",
    spawns: (editor.role?.spawns || []).join(", "),
    instructions: editor.role?.instructions || "",
    capabilities: { ...(editor.role?.capabilities || {}) },
  }));
  const [localError, setLocalError] = useState("");
  const update = (patch: Partial<RoleDraft>) => { setLocalError(""); setDraft((current) => ({ ...current, ...patch })); };

  const modelOptions: { value: string; label: string }[] = [{ value: "", label: "跟随父会话" }];
  if (draft.model && !models.some((item) => item.value === draft.model)) {
    modelOptions.push({ value: draft.model, label: draft.model });
  }
  for (const model of models) {
    modelOptions.push({ value: model.value, label: model.provider ? `${model.label || model.value} · ${model.provider}` : (model.label || model.value) });
  }
  const selectedModel = models.find((item) => item.value === draft.model);
  const supportedLevels = draft.model
    ? (selectedModel?.thinkingLevels || (draft.thinkingLevel ? [draft.thinkingLevel] : ALL_THINKING))
    : ALL_THINKING;
  const thinkingOptions = [{ value: "", label: "跟随父会话" }, ...supportedLevels.map((level) => ({ value: level, label: level }))];

  const handleModelChange = (nextModel: string) => {
    const nextEntry = models.find((item) => item.value === nextModel);
    const nextLevels = nextModel ? (nextEntry?.thinkingLevels || []) : ALL_THINKING;
    const keepThinking = !draft.thinkingLevel || nextLevels.includes(draft.thinkingLevel);
    update({ model: nextModel, ...(keepThinking ? {} : { thinkingLevel: "" }) });
  };

  const submit = () => {
    const name = draft.name.trim();
    if (!name) return setLocalError("请填写 Role 标识名。");
    if (name !== editor.originalName && existingNames.includes(name)) return setLocalError(`Role "${name}" 已存在。`);
    const rolePayload: RoleConfig = {
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.model ? { model: draft.model } : {}),
      ...(draft.thinkingLevel ? { thinkingLevel: draft.thinkingLevel } : {}),
      ...(draft.toolMode === "code" || draft.toolMode === "direct" ? { toolMode: draft.toolMode } : {}),
      ...(draft.isolated === "true" ? { isolated: true } : draft.isolated === "false" ? { isolated: false } : {}),
      ...(draft.spawnsLimited === "limited" ? { spawns: draft.spawns.split(/[\s,，]+/).filter(Boolean) } : {}),
      ...(draft.instructions.trim() ? { instructions: draft.instructions } : {}),
      ...(Object.keys(draft.capabilities).length ? { capabilities: draft.capabilities } : {}),
    };
    onSave(name, rolePayload, editor.originalName);
  };

  return <section className="settings-section subsession-section" data-section="derivation-roles">
    <div id="derivation-role-editor" className="subsession-role-editor" data-mode={editor.mode} data-role={editor.originalName || ""}>
      <div className="subsession-editor-head">
        <div className="subsession-editor-title">
          <ActionIcon variant="subtle" color="gray" aria-label="返回" disabled={busy} onClick={onCancel}><IconChevronLeft size={18} /></ActionIcon>
          <span>{editor.mode === "create" ? "新建 Role" : "编辑 Role"}</span>
          {editor.originalName ? <code>{editor.originalName}</code> : null}
        </div>
        <Group gap={6}>
          <Button id="cancel-derivation-role" variant="default" size="xs" disabled={busy} onClick={onCancel}>取消</Button>
          <Button id="save-derivation-role" size="xs" loading={saving} disabled={busy} onClick={submit}>保存 Role</Button>
        </Group>
      </div>
      {localError || error ? <InlineAlert id="derivation-role-error" data-status="error">{localError || error}</InlineAlert> : null}
      <div className="subsession-card">
        <div className="subsession-grid">
          <TextInput id="role-name" label="Role 标识名" placeholder="例如 scout" value={draft.name} disabled={busy || editor.builtin}
            onChange={(event) => update({ name: event.currentTarget.value })} required />
          <TextInput id="role-description" label="简介" placeholder="可选" value={draft.description} disabled={busy}
            onChange={(event) => update({ description: event.currentTarget.value })} />
          <NativeSelect id="role-tool-mode" label="工具档位" value={draft.toolMode} disabled={busy}
            data={[{ value: "", label: "跟随默认" }, { value: "code", label: "code" }, { value: "direct", label: "direct" }]}
            onChange={(event) => update({ toolMode: event.currentTarget.value })} />
          <NativeSelect id="role-isolated" label="Worktree 隔离" value={draft.isolated} disabled={busy}
            data={[{ value: "", label: "跟随默认" }, { value: "true", label: "开启" }, { value: "false", label: "关闭" }]}
            onChange={(event) => update({ isolated: event.currentTarget.value })} />
          <NativeSelect id="role-spawns-limited" label="可派生的 Role" value={draft.spawnsLimited} disabled={busy}
            data={[{ value: "", label: "不限制" }, { value: "limited", label: "仅限指定" }]}
            onChange={(event) => update({ spawnsLimited: event.currentTarget.value })} />
          {draft.spawnsLimited === "limited" ? <TextInput id="role-spawns" label="允许的 Role 名" placeholder="逗号分隔；留空表示不能派生" value={draft.spawns} disabled={busy}
            onChange={(event) => update({ spawns: event.currentTarget.value })} /> : null}
          <NativeSelect id="role-model" label="模型" value={draft.model} disabled={busy}
            data={modelOptions} onChange={(event) => handleModelChange(event.currentTarget.value)} />
          <NativeSelect id="role-thinking" label="思考档" value={draft.thinkingLevel}
            disabled={busy || (Boolean(draft.model) && supportedLevels.length === 0)}
            data={thinkingOptions} onChange={(event) => update({ thinkingLevel: event.currentTarget.value })} />
          <Textarea id="role-instructions" className="subsession-grid-full" label="角色提示词" placeholder="留空则使用上面的默认子会话提示词"
            autosize minRows={2} maxRows={5} value={draft.instructions} disabled={busy}
            onChange={(event) => update({ instructions: event.currentTarget.value })} />
        </div>
      </div>
      <RoleCapabilitiesPanel catalog={catalog} capabilities={draft.capabilities} disabled={busy}
        onChange={(capabilities) => update({ capabilities })} />
    </div>
  </section>;
}
