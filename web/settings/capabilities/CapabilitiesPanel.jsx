import { useCallback } from "react";
import { useEffect } from "react";
import { useLayoutEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { latest } from "./latest.js";
import { scrollMemory } from "./use-provider-scroll.js";
import { buildCapabilityCatalog } from "./build-capability-catalog.js";
import { capabilityHits } from "./capability-hits.js";
import { change as changeMethod } from "./panel/change-capability.js";
import { mutateLibrary as mutateLibraryMethod } from "./panel/mutate-library.js";
import { saveTerminal as saveTerminalMethod } from "./panel/save-terminal.js";
import { callConfig as callConfigMethod } from "./panel/call-config.js";
import { openConfig as openConfigMethod } from "./panel/open-config.js";
import { libraryScope } from "./library-scope.js";
import { showPeek as showPeekMethod } from "./panel/use-capability-peek.js";
import { scheduleHide as scheduleHideMethod } from "./panel/use-capability-peek.js";
import { rowHandlers as rowHandlersMethod } from "./panel/use-capability-peek.js";
import { ProviderList } from "./panel/ProviderList.jsx";
import Crossfade from "../../design-system/crossfade/Crossfade.jsx";
import { Loader } from "@mantine/core";
import { ProviderDetail } from "./panel/ProviderDetail.jsx";
import { CapabilityLayers } from "./panel/CapabilityLayers.jsx";
import { Peek } from "./Peek.jsx";
import { PeekEntry } from "./panel/PeekEntry.jsx";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import "./capabilities.css";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
export default function CapabilitiesPanel({ kind, actions, session = false, instance = "", sessionKey = "", localTools, mobile = false }) {
  const sessions = useWorkbench((state) => state.sessions);
  const targets = useWorkbench((state) => state.targets);
  const [data, setData] = useState(null);
  const [library, setLibrary] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletion, setDeletion] = useState(null);
  const [frame, setFrame] = useState(null);
  const [sheet, setSheet] = useState({ id: null, open: false });
  const [config, setConfig] = useState({ id: null, open: false });
  const [drafts, setDrafts] = useState({});
  const [configs, setConfigs] = useState({});
  const [pathDraft, setPathDraft] = useState(null);
  const [written, setWritten] = useState(null);
  const [peek, setPeek] = useState(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const generation = useRef(0);
  const listRef = useRef(null);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const rootRef = useCallback((node) => setFrame(node?.closest(".mantine-Modal-content") ?? null), []);
  const load = useCallback(async (refresh = false) => {
    const current = ++generation.current;
    setLoading(true); setRefreshing(refresh); setError("");
    try {
      const [settings, catalog, saved] = await Promise.all([
        refresh ? actions.api.post("/capabilities/refresh", instance ? { instance } : {}) : actions.api.get(instance ? `/capabilities?instance=${encodeURIComponent(instance)}` : "/capabilities"),
        session ? actions.nativeData("capabilities") : null,
        actions.api.post(`/${kind}/list`, {}),
      ]);
      if (current !== generation.current) return;
      if (session && !catalog) throw new Error("会话工具设置读取失败。");
      setData({ ...settings, catalog: session ? catalog : settings.catalog });
      setLibrary(latest(saved[kind]));
    } catch (cause) { if (current === generation.current) setError(cause.message); }
    finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [actions, kind, session, instance]);
  useEffect(() => { void load(); return invalidate; }, [load, sessionKey, localTools, invalidate]);
  // Provider list scroll offset per page.
  const scrollKey = `${instance ? `instance:${instance}` : session ? "session" : "global"}:${kind}`;
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (loading || restored.current || !listRef.current) return;
    restored.current = true;
    listRef.current.scrollTop = scrollMemory.get(scrollKey) ?? 0;
  }, [loading, scrollKey]);
  useEffect(() => {
    const list = listRef.current;
    return () => { if (list) scrollMemory.set(scrollKey, list.scrollTop); };
  }, [scrollKey]);
  const pending = loading && !data;
  const { catalog, savedGroup, savedLabel, entries, names, groups, counts, providers } = buildCapabilityCatalog(data, kind, library);
  const { needle, hits, visible, current } = capabilityHits(entries, query, providers, selected);
  const partial = (item) => item.enabled && entries.some((entry) => entry.group === item.id && entry.catalogued && !entry.configured && !entry.locked);
  const disabled = (entry) => saving || entry.locked || entry.available === false || !entry.groupEnabled;
  const configurable = kind === "tools" && !session && !instance;
  const change = (...args) => changeMethod(ctx, ...args);
  const { scope, scopeLabel } = libraryScope({ sessions, targets, generation, setSaving, setError, setLibrary, actions });
  const shadower = (id) => {
    const winner = entries.find((entry) => entry.id === id);
    return winner ? `${winner.name} · ${groups.find((group) => group.id === winner.group)?.name ?? winner.groupLabel}` : id;
  };
  const mutateLibrary = (...args) => mutateLibraryMethod(ctx, ...args);
  // ---- detail card: hover (mouse) / long press (touch) ----
  const peekRef = useRef(null);
  peekRef.current = peekOpen ? peek : null;
  const timers = useRef({ hover: 0, hide: 0 });
  const press = useRef(null);
  const swallow = useRef(false);
  const showPeek = (...args) => showPeekMethod(ctx, ...args);
  const hidePeek = useCallback(() => { clearTimeout(timers.current.hover); setPeekOpen(false); }, []);
  const scheduleHide = (...args) => scheduleHideMethod(ctx, ...args);
  const rowHandlers = (...args) => rowHandlersMethod(ctx, ...args);
  useEffect(() => {
    const pending = timers.current;
    const move = (event) => {
      const state = press.current;
      if (state && !state.fired && Math.hypot(event.clientX - state.x, event.clientY - state.y) > 10) { clearTimeout(state.timer); press.current = null; }
    };
    const end = () => {
      const state = press.current;
      if (!state) return;
      clearTimeout(state.timer);
      // A library card holds actions, so it stays after release and closes on the next tap elsewhere.
      if (state.fired) { if (!state.sticky) hidePeek(); setTimeout(() => { swallow.current = false; }, 350); }
      press.current = null;
    };
    const down = (event) => { if (peekRef.current && !event.target.closest?.(".capability-peek")) hidePeek(); };
    const hold = (event) => { if (press.current?.fired) event.preventDefault(); };
    const click = (event) => { if (swallow.current) { swallow.current = false; event.preventDefault(); event.stopPropagation(); } };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("touchmove", hold, { passive: false });
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("touchmove", hold, { passive: false });
      document.removeEventListener("click", click, true);
      clearTimeout(pending.hover); clearTimeout(pending.hide);
    };
  }, [hidePeek]);
  // ---- config slide-over ----
  const configGroup = providers.find((item) => item.id === config.id);
  const terminal = data?.terminal;
  const saveTerminal = (...args) => saveTerminalMethod(ctx, ...args);
  // Plugin providers: stored semantics → form; only a file → fields derived from the JSON values; nothing → add a path.
  const providerConfig = configGroup && configGroup.id !== "group:tools:package:<inline:terminals>" ? configs[configGroup.id] : undefined;
  const callConfig = (...args) => callConfigMethod(ctx, ...args);
  const openConfig = (...args) => openConfigMethod(ctx, ...args);
  const sheetGroup = providers.find((item) => item.id === sheet.id);
  // The card shows the entry as it is now (a switch may have changed since it opened).
  const peekEntry = peek ? entries.find((entry) => entry.id === peek.entry.id) ?? null : null;
  const ctx = { kind, actions, targets, session, instance, sessionKey, localTools, mobile, data, setData, library, setLibrary, selected, setSelected, query, setQuery, loading, setLoading, refreshing, setRefreshing, saving, setSaving, error, setError, deletion, setDeletion, frame, setFrame, sheet, setSheet, config, setConfig, drafts, setDrafts, configs, setConfigs, pathDraft, setPathDraft, written, setWritten, peek, setPeek, peekOpen, setPeekOpen, generation, listRef, invalidate, rootRef, load, peekRef, timers, press, swallow, showPeek, hidePeek, scheduleHide, rowHandlers, catalog, savedGroup, savedLabel, entries, names, groups, counts, providers, needle, hits, visible, current, scope, scopeLabel, pending, partial, disabled, configurable, shadower, configGroup, terminal, providerConfig, sheetGroup, peekEntry, change, mutateLibrary, saveTerminal, callConfig, openConfig };
  return <div ref={rootRef} className="capabilities-panel" data-kind={kind} data-scope={instance ? "instance" : session ? "session" : "global"} data-layout={mobile ? "stack" : "split"} aria-busy={loading || saving}>
    <ProviderList ctx={ctx} />
    {!mobile ? <Crossfade className="capability-detail-host" layerKey={pending ? "loading" : "list"}>{pending ? <div className="capability-loading" data-status="loading"><Loader size="sm" color="gray" /></div> : <ProviderDetail ctx={ctx} item={current} inSheet={false} />}</Crossfade> : null}
    <CapabilityLayers ctx={ctx} />
    <Peek peek={peek} open={peekOpen} frame={frame} onPointerEnter={() => clearTimeout(timers.current.hide)} onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleHide(); }}>
      <PeekEntry ctx={ctx} />
    </Peek>
    <Modal id={`${kind}-delete-confirm`} opened={Boolean(deletion)} onClose={() => setDeletion(null)} title="确认删除" centered size={380}>
      <Stack gap="md"><Text>{deletion?.name}</Text><Group justify="flex-end"><Button id={`${kind}-cancel-delete`} variant="default" onClick={() => setDeletion(null)}>取消</Button><Button id={`${kind}-confirm-delete`} color="red" loading={saving} onClick={() => { if (deletion) void mutateLibrary("delete", deletion); }}>删除</Button></Group></Stack>
    </Modal>
  </div>;
}
