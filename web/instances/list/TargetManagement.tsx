import { useEffect, useRef, useState } from "react";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { TargetEditor } from "../editor/TargetEditor.tsx";
import type { EditorConfig } from "../editor/editor-types.ts";
import { InstanceSettings } from "../settings/InstanceSettings.tsx";
import { TargetList } from "./TargetList.tsx";

type TargetManagementProps = { actions: WorkbenchActions; mobile?: boolean };
type Editing = { id: string | null; config: EditorConfig | null };

export function TargetManagement({ actions, mobile = false }: TargetManagementProps) {
  const [editor, setEditor] = useState<Editing | null>(null);
  const [settings, setSettings] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current += 1;
  }, []);
  const cancelRead = () => { requestRef.current += 1; setLoadingId(null); };
  const edit = async (id: string) => {
    const request = ++requestRef.current;
    setLoadingId(id);
    try {
      const config: EditorConfig = await actions.getTarget(id);
      if (!mountedRef.current || request !== requestRef.current) return;
      setEditor({ id, config });
    } catch (cause) {
      if (!mountedRef.current || request !== requestRef.current) return;
      setEditor({ id, config: { id, label: id, loadError: cause instanceof Error ? cause.message : "实例配置读取失败。" } });
    } finally {
      if (mountedRef.current && request === requestRef.current) setLoadingId(null);
    }
  };
  if (editor) return <TargetEditor actions={actions} existingId={editor.id} initialConfig={editor.config} onClose={() => { cancelRead(); setEditor(null); }} />;
  if (settings) return <InstanceSettings actions={actions} id={settings} mobile={mobile} onClose={() => setSettings(null)} onBack={() => setSettings(null)} />;
  return <TargetList actions={actions} loadingId={loadingId} onAdd={() => { cancelRead(); setEditor({ id: null, config: null }); }} onEdit={(id) => void edit(id)} onSettings={setSettings} />;
}
