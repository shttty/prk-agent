import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { Tabs } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Modal } from "@mantine/core";
import MemoryDocuments from "./MemoryDocuments.jsx";
import LayerConfig from "./LayerConfig.jsx";
import { layerLabel } from "./layer-label.js";
import "./memory.css";

const CONFIG_TAB = "__config";

export default function MemoryDialog({ actions }) {
  const [listing, setListing] = useState({ enabled: true, layers: [], memories: [] });
  const [tab, setTab] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const adopt = useCallback((result) => { setListing(result); }, []);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const reload = useCallback(() => {
    const current = ++generation.current;
    setBusy(true);
    actions.api.post("/memory/list", {}).then((result) => {
      if (current === generation.current) adopt(result);
    }).catch((cause) => {
      if (current === generation.current) setError(cause.message);
    }).finally(() => { if (current === generation.current) setBusy(false); });
  }, [actions, adopt]);
  useEffect(() => {
    setEditor(null); setDeletion(null); setError("");
    reload();
    return invalidate;
  }, [reload, invalidate]);

  const mutate = async (path, request) => {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const result = await actions.api.post(path, request);
      if (current !== generation.current) return;
      adopt(result); setEditor(null); setDeletion(null);
    } catch (cause) {
      if (current === generation.current) setError(cause.message);
    } finally { if (current === generation.current) setBusy(false); }
  };
  const save = () => {
    const { old_text, content, ...scope } = editor;
    void mutate("/memory/change", { ...scope, action: old_text === undefined ? "add" : "replace", content, ...(old_text === undefined ? {} : { old_text }) });
  };
  const remove = () => {
    const { old_text, target: _target, ...scope } = deletion;
    void mutate(old_text === undefined ? "/memory/delete-instance" : "/memory/change", old_text === undefined
      ? { instance: deletion.instance, confirm: true }
      : { target: deletion.target, ...scope, action: "remove", old_text });
  };

  const active = tab ?? listing.layers[0]?.name ?? CONFIG_TAB;
  return <>
      <Stack gap="sm" id="memory-manager" aria-busy={busy} data-enabled={String(listing.enabled)}>
        {!listing.enabled && !listing.error ? <Text id="memory-disabled" size="sm" c="dimmed">记忆已关闭。修改配置后需重启 Gateway。</Text> : null}
        {listing.error ? <InlineAlert id="memory-config-error" size="sm">{listing.error}</InlineAlert> : null}
        {error ? <InlineAlert id="memory-error" size="sm">{error}</InlineAlert> : null}
        <Tabs value={active} onChange={(value) => { setTab(value); setEditor(null); setError(""); }}>
          <Tabs.List grow>
            {listing.layers.map((layer) => <Tabs.Tab key={layer.name} value={layer.name} id={`memory-tab-${layer.name}`}>{layerLabel(layer.name)}</Tabs.Tab>)}
            <Tabs.Tab value={CONFIG_TAB} id="memory-tab-config">配置</Tabs.Tab>
          </Tabs.List>
          {listing.layers.map((layer) => <Tabs.Panel key={layer.name} value={layer.name} pt="md">
            <MemoryDocuments layer={layer} label={layerLabel(layer.name)} documents={listing.memories.filter((document) => document.target === layer.name)}
              busy={busy} editor={editor} setEditor={setEditor} setDeletion={setDeletion} onSave={save} />
          </Tabs.Panel>)}
          <Tabs.Panel value={CONFIG_TAB} pt="md">{active === CONFIG_TAB ? <LayerConfig api={actions.api} onSaved={reload} /> : null}</Tabs.Panel>
        </Tabs>
      </Stack>
    <Modal id="memory-delete-dialog" opened={Boolean(deletion)} onClose={() => setDeletion(null)} title="确认删除" centered size={380}>
      <Stack gap="md"><Text className="memory-entry-content">{deletion?.old_text ?? deletion?.instance}</Text>{error ? <InlineAlert size="sm">{error}</InlineAlert> : null}<Group justify="flex-end"><Button id="memory-cancel-delete" variant="default" disabled={busy} onClick={() => setDeletion(null)}>取消</Button><Button id="memory-confirm-delete" color="red" loading={busy} onClick={remove}>删除</Button></Group></Stack>
    </Modal>
  </>;
}
