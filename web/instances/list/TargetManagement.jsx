import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { TargetEditor } from "../editor/TargetEditor.jsx";
import { InstanceSettings } from "../settings/InstanceSettings.jsx";
import { TargetList } from "./TargetList.jsx";
export function TargetManagement({ actions, mobile = false }) {
  const [editor, setEditor] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current += 1;
  }, []);
  const cancelRead = () => { requestRef.current += 1; setLoadingId(null); };
  const edit = async (id) => {
    const request = ++requestRef.current;
    setLoadingId(id);
    try {
      const config = await actions.getTarget(id);
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
  return <TargetList actions={actions} loadingId={loadingId} onAdd={() => { cancelRead(); setEditor({ id: null, config: null }); }} onEdit={edit} onSettings={setSettings} />;
}
