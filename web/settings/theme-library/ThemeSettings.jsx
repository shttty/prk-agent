import { useThemeLibrary } from "../../design-system/theme/use-theme-library.js";
import { useMantineColorScheme } from "@mantine/core";
import { useComputedColorScheme } from "@mantine/core";
import { useState } from "react";
import { useEffect } from "react";
import { builtinThemes } from "../../../shared/themes.js";
import { Stack } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { Alert } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { FileButton } from "@mantine/core";
import { resolvedTokens } from "../../../shared/themes.js";
import "./themes.css";
export default function ThemeSettings() {
  const library = useThemeLibrary();
  const { api, themes, selectedId, setSelectedId, selected, refresh, error: loadError } = library;
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const mode = useComputedColorScheme("light");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { void refresh(); }, [refresh]);
  const current = selected || builtinThemes.find((entry) => entry.mode === mode);
  const choice = selected?.id || (colorScheme === "auto" ? "auto" : `builtin-${colorScheme}`);
  const run = async (action) => {
    setBusy(true); setError(null);
    try { await action(); } catch (failure) { setError({ message: failure.message, key: failure.details?.key }); }
    finally { setBusy(false); }
  };
  const choose = (id) => {
    setConfirm(false);
    const entry = themes.find((item) => item.id === id);
    setSelectedId(entry?.id || "");
    setColorScheme(entry?.mode || "auto");
  };
  const inspect = async (text) => {
    setPreview(null);
    let document;
    try { document = JSON.parse(text); } catch { throw new Error("JSON 格式无效。"); }
    setPreview(await api.post("/themes/preview", { theme: document }));
  };
  const save = () => run(async () => {
    const result = await api.post("/themes/import", { theme: preview.theme });
    library.setThemes((entries) => [...entries, result.theme]);
    setSelectedId(result.theme.id); setColorScheme(result.theme.mode);
    setSource(""); setPreview(null);
  });
  const remove = () => run(async () => {
    const result = await api.post("/themes/delete", { id: current.id, confirm: true });
    library.setThemes(result.themes);
    choose(`builtin-${current.mode}`);
  });
  const download = () => {
    const { name, mode, tokens } = current;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify({ name, mode, tokens }, null, 2)}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${name}.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="settings-section" id="theme-settings" data-section="theme" aria-busy={busy}>
    <h3 className="pi-settings-heading">主题</h3>
    <Stack gap="sm">
      <NativeSelect id="settings-theme" aria-label="选用主题" value={choice} disabled={busy} onChange={(event) => choose(event.currentTarget.value)} data={[
        { value: "auto", label: "跟随系统" }, ...themes.map((entry) => ({ value: entry.id, label: `${entry.name}${entry.builtin ? " · 内置" : ""}` })),
      ]} />
      <Group gap="xs">
        <Button id="theme-export" variant="default" size="compact-sm" onClick={download}>导出当前主题</Button>
        {!current.builtin && <Button id="theme-delete" variant="subtle" color="gray" size="compact-sm" disabled={busy} onClick={() => setConfirm(true)}>删除</Button>}
      </Group>
      {confirm && <Group id="theme-delete-confirmation" gap="xs"><Text size="sm">删除「{current.name}」？</Text><Button id="theme-confirm-delete" color="red" size="compact-sm" disabled={busy} onClick={remove}>删除</Button><Button id="theme-cancel-delete" variant="default" size="compact-sm" onClick={() => setConfirm(false)}>取消</Button></Group>}
      {loadError && <Alert id="theme-load-error" color="red">{loadError}</Alert>}
      {selectedId && !selected && !loadError && <Text size="xs" c="dimmed" id="theme-unavailable">正在使用内置主题；所选主题尚未加载或已被删除。</Text>}
      <Textarea id="theme-json" label="导入主题" placeholder="先粘贴主题 JSON 或选择文件" autosize minRows={3} maxRows={6} value={source} disabled={busy} onChange={(event) => { setSource(event.currentTarget.value); setPreview(null); setError(null); }} />
      <Group gap="xs">
        <FileButton accept="application/json,.json" onChange={(file) => file && run(async () => { const text = await file.text(); setSource(text); await inspect(text); })} inputProps={{ id: "theme-file" }}>
          {(props) => <Button {...props} id="theme-choose-file" disabled={busy} variant="default" size="compact-sm">选择文件</Button>}
        </FileButton>
        <Button id="theme-preview" variant="default" size="compact-sm" disabled={busy || !source.trim()} onClick={() => run(() => inspect(source))}>预览</Button>
      </Group>
      {error && <Alert id="theme-error" data-key={error.key} color="red" role="alert">{error.message}</Alert>}
      {preview && <>
        <div id="theme-preview-sample" className="pi-theme-preview" style={resolvedTokens(preview.theme)} data-mode={preview.theme.mode}>
          <strong>{preview.theme.name}</strong><p>正文文字 <span className="pi-theme-secondary">次要文字</span></p>
          <pre><span className="pi-theme-comment"># 注释</span>{"\n"}<span className="pi-theme-keyword">return</span>{" 42"}</pre>
        </div>
        {preview.warnings.length > 0 && <Alert id="theme-aa-warnings" color="yellow" title="以下对比度低于 AA 4.5，可继续使用">
          <ul className="pi-theme-warnings">{preview.warnings.map((warning) => <li key={warning.id} data-pair={warning.id} data-ratio={warning.ratio}>{warning.label}：{warning.ratio.toFixed(2)}</li>)}</ul>
        </Alert>}
        <Button id="theme-save" disabled={busy} onClick={save}>保存并选用</Button>
      </>}
    </Stack>
  </section>;
}
