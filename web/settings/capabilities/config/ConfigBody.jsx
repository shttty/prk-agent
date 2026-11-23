import InlineAlert from "../../../design-system/inline-alert/InlineAlert.jsx";
import { ConfigFields } from "./ConfigFields.jsx";
import { TERMINAL_SECTIONS } from "./terminal-sections.js";
import { PendingBar } from "./PendingBar.jsx";
import { Button } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { rawSections } from "../raw-sections.js";
import { getPath } from "./get-path.js";
import { Text } from "@mantine/core";
export function ConfigBody({ ctx, item }) {
  const { drafts, setDrafts, error, terminal, saving, saveTerminal, providerConfig, pathDraft, setPathDraft, callConfig, setWritten, written } = ctx;

    const draftFor = (values) => {
      const draft = drafts[item.id] ?? values;
      const setDraft = (next) => setDrafts((all) => {
        const { [item.id]: _, ...rest } = all;
        return JSON.stringify(next) === JSON.stringify(values) ? rest : { ...rest, [item.id]: next };
      });
      return [draft, setDraft];
    };
    const errorLine = error ? <InlineAlert id="config-error">{error}</InlineAlert> : null;
    if (item.id === "group:tools:package:<inline:terminals>") {
      if (!terminal) return null;
      const [draft, setDraft] = draftFor(terminal);
      return <>
        <div className="config-body">
          <div className="config-source" data-config-mode="semantic"><code>config.toml · terminal</code></div>
          <ConfigFields sections={TERMINAL_SECTIONS} values={terminal} draft={draft} onDraft={setDraft} />
          {errorLine}
        </div>
        <PendingBar fields={TERMINAL_SECTIONS.flatMap((section) => section.fields)} values={terminal} draft={draft} file="config.toml" busy={saving}
          onWrite={saveTerminal} onReset={() => setDraft(terminal)} />
      </>;
    }
    const view = providerConfig;
    if (!view) return <div className="config-body">{errorLine}</div>;
    if (!view.configured) return <div className="config-body">
      <div className="config-empty" data-config-mode="none">
        {pathDraft === null ? <Button data-action="add-config-path" size="compact-sm" variant="subtle" onClick={() => setPathDraft("")}>添加配置文件路径</Button>
          : <form className="config-path-form" onSubmit={(event) => { event.preventDefault(); void callConfig(item.id, "set", { provider: item.name, file: pathDraft.trim() }).then((next) => { if (next) setPathDraft(null); }); }}>
            <TextInput id="config-path-input" className="config-input" autoFocus placeholder="/绝对路径/config.json" spellCheck={false} value={pathDraft} onChange={(event) => setPathDraft(event.currentTarget.value)} />
            <Button type="submit" size="xs" data-action="save-config-path" loading={saving} disabled={!pathDraft.trim()}>添加</Button>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setPathDraft(null)}>取消</Button>
          </form>}
      </div>
      {errorLine}
    </div>;
    const semantic = view.sections.length > 0;
    const sections = semantic ? view.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field, secret: field.secret || view.secrets.includes(field.key), ...(field.type === "list" && typeof field.default?.[0] === "number" ? { itemType: "number" } : {}) })) }))
      : rawSections(view.values, view.secrets);
    const fields = sections.flatMap((section) => section.fields);
    const [draft, setDraft] = draftFor(view.values);
    const write = async (keys) => {
      const next = await callConfig(item.id, "write", { provider: item.name, changes: keys.map((key) => ({ key, value: getPath(draft, key) })) });
      if (next) { setDrafts(({ [item.id]: _, ...rest }) => rest); setWritten(item.id); }
    };
    return <>
      <div className="config-body">
        <div className="config-source" data-config-mode={semantic ? "semantic" : "raw"}><code id="config-file">{view.file}</code>{view.exists ? null : <span data-exists="false">文件不存在，写入时新建</span>}</div>
        {fields.length ? <ConfigFields sections={sections} values={view.values} draft={draft} onDraft={setDraft} keyLabels={!semantic} /> : <Text size="sm" c="dimmed">文件里没有可编辑的值。</Text>}
        {written === item.id && !drafts[item.id] ? <Text id="config-written" data-status="written" size="xs" c="dimmed">已写入，插件重载后生效。</Text> : null}
        {errorLine}
      </div>
      <PendingBar fields={fields} values={view.values} draft={draft} file={view.file} busy={saving} onWrite={write} onReset={() => setDraft(view.values)} />
    </>;
  }
