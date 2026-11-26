import type { PageActions, WorkbenchState } from "../../shell/page/page-types.ts";
import type { CapabilityCtx, CapabilityData, CapabilityEntry, CapabilityGroup, ConfigValues, LibraryEntry, Peek as PeekState, PressState, ProviderConfigView } from "./capability-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { useCallback } from "react";
import { useEffect } from "react";
import { useLayoutEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { latest } from "./latest.ts";
import { scrollMemory } from "./use-provider-scroll.ts";
import { buildCapabilityCatalog } from "./build-capability-catalog.ts";
import { capabilityHits } from "./capability-hits.ts";
import { change as changeMethod } from "./panel/change-capability.ts";
import { mutateLibrary as mutateLibraryMethod } from "./panel/mutate-library.ts";
import { saveTerminal as saveTerminalMethod } from "./panel/save-terminal.ts";
import { callConfig as callConfigMethod } from "./panel/call-config.ts";
import { openConfig as openConfigMethod } from "./panel/open-config.ts";
import { libraryScope } from "./library-scope.ts";
import { showPeek as showPeekMethod } from "./panel/show-peek.ts";
import { scheduleHide as scheduleHideMethod } from "./panel/schedule-hide.ts";
import { rowHandlers as rowHandlersMethod } from "./panel/row-handlers.ts";
import { ProviderList } from "./panel/ProviderList.tsx";
import Crossfade from "../../design-system/crossfade/Crossfade.tsx";
import { Loader } from "@mantine/core";
import { ProviderDetail } from "./panel/ProviderDetail.tsx";
import { CapabilityLayers } from "./panel/CapabilityLayers.tsx";
import { Peek } from "./Peek.tsx";
import { PeekEntry } from "./panel/PeekEntry.tsx";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import "../list-page/list-page.css";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { useRelink } from "../list-page/use-relink.ts";
import { LinkWait } from "../list-page/LinkWait.tsx";
import "./capabilities.css";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
type CapabilitiesPanelProps = { kind: "tools" | "skills"; actions: PageActions; session?: boolean; instance?: string; sessionKey?: string; localTools?: unknown; mobile?: boolean; initialProvider?: string };

export default function CapabilitiesPanel({ kind, actions, session = false, instance = "", sessionKey = "", localTools, mobile = false, initialProvider }: CapabilitiesPanelProps) {
  const sessions = useWorkbench((state: WorkbenchState) => state.sessions);
  const targets = useWorkbench((state: WorkbenchState) => state.targets);
  const [data, setData] = useState<CapabilityData | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(initialProvider ?? null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [deletion, setDeletion] = useState<LibraryEntry | null>(null);
  const [frame, setFrame] = useState<Element | null>(null);
  const [sheet, setSheet] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  const [config, setConfig] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  const [drafts, setDrafts] = useState<Record<string, ConfigValues>>({});
  const [configs, setConfigs] = useState<Record<string, ProviderConfigView>>({});
  const [pathDraft, setPathDraft] = useState<string | null>(null);
  const [written, setWritten] = useState<string | null>(null);
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const generation = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const rootRef = useCallback((node: HTMLDivElement | null) => setFrame(node?.closest(".mantine-Modal-content") ?? null), []);
  const load = useCallback(async (refresh = false) => {
    const current = ++generation.current;
    setLoading(true); setRefreshing(refresh); setError("");
    try {
      const [settings, catalog, saved]: [CapabilityData, CapabilityData["catalog"] | null, Record<string, LibraryEntry[]>] = await Promise.all([
        refresh ? actions.api.post<CapabilityData>("/capabilities/refresh", instance ? { instance } : {}) : actions.api.get<CapabilityData>(instance ? `/capabilities?instance=${encodeURIComponent(instance)}` : "/capabilities"),
        session ? actions.nativeData<NonNullable<CapabilityData["catalog"]>>("capabilities") : null,
        actions.api.post<Record<string, LibraryEntry[]>>(`/${kind}/list`, {}),
      ]);
      if (current !== generation.current) return;
      if (session && !catalog) throw new Error("会话工具设置读取失败。");
      setData({ ...settings, catalog: (session ? catalog : settings.catalog) ?? undefined });
      setLibrary(latest(saved[kind]));
      setWaiting(false);
    } catch (cause) {
      if (current !== generation.current) return;
      if (isConnectionFailure(cause)) setWaiting(true);
      else setError(toFailure(cause).message);
    }
    finally { if (current === generation.current) { setLoading(false); setRefreshing(false); } }
  }, [actions, kind, session, instance]);
  useEffect(() => { void load(); return invalidate; }, [load, sessionKey, localTools, invalidate]);
  useRelink(() => void load(), waiting);
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
  const { catalog, savedGroup, savedLabel, savedEmpty, entries, names, groups, counts, providers } = buildCapabilityCatalog(data, kind, library);
  const { needle, hits, visible, current } = capabilityHits(entries, query, providers, selected);
    const disabled = (entry: CapabilityEntry) => saving || entry.locked || entry.available === false || !entry.groupEnabled;
  const configurable = kind === "tools" && !session && !instance;
  const change = (idOrChanges: Parameters<typeof changeMethod>[1], enabled?: boolean | null) => changeMethod(ctx, idOrChanges, enabled);
  const { scope, scopeLabel } = libraryScope({ sessions, targets, generation, setSaving, setError, setLibrary, actions });
  const shadower = (id: string) => {
    const winner = entries.find((entry) => entry.id === id);
    return winner ? `${winner.name} · ${groups.find((group) => group.id === winner.group)?.name ?? winner.groupLabel}` : id;
  };
  const mutateLibrary = (action: string, entry: LibraryEntry) => mutateLibraryMethod(ctx, action, entry);
  // ---- detail card: hover (mouse) / long press (touch) ----
  const peekRef = useRef<PeekState | null>(null);
  peekRef.current = peekOpen ? peek : null;
  const timers = useRef<CapabilityCtx["timers"]["current"]>({ hover: undefined, hide: undefined });
  const press = useRef<PressState | null>(null);
  const swallow = useRef(false);
  const showPeek = (next: PeekState) => showPeekMethod(ctx, next);
  const hidePeek = useCallback(() => { clearTimeout(timers.current.hover); setPeekOpen(false); }, []);
  const scheduleHide = () => scheduleHideMethod(ctx);
  const rowHandlers = (entry: CapabilityEntry) => rowHandlersMethod(ctx, entry);
  useEffect(() => {
    const pending = timers.current;
    const move = (event: PointerEvent) => {
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
    const down = (event: PointerEvent) => { if (peekRef.current && !(event.target instanceof Element && event.target.closest(".capability-peek"))) hidePeek(); };
    const hold = (event: TouchEvent) => { if (press.current?.fired) event.preventDefault(); };
    const click = (event: MouseEvent) => { if (swallow.current) { swallow.current = false; event.preventDefault(); event.stopPropagation(); } };
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
      document.removeEventListener("touchmove", hold);
      document.removeEventListener("click", click, true);
      clearTimeout(pending.hover); clearTimeout(pending.hide);
    };
  }, [hidePeek]);
  // ---- config slide-over ----
  const configGroup = providers.find((item) => item.id === config.id);
  const terminal = data?.terminal;
  const saveTerminal = (keys: string[]) => saveTerminalMethod(ctx, keys);
  // Plugin providers: stored semantics → form; only a file → fields derived from the JSON values; nothing → add a path.
  const providerConfig = configGroup && configGroup.id !== "group:tools:package:<inline:terminals>" ? configs[configGroup.id] : undefined;
  const callConfig = (id: string, route: string, body: object) => callConfigMethod(ctx, id, route, body);
  const openConfig = (item: CapabilityGroup) => openConfigMethod(ctx, item);
  const sheetGroup = providers.find((item) => item.id === sheet.id);
  // The card shows the entry as it is now (a switch may have changed since it opened).
  const peekEntry = peek ? entries.find((entry) => entry.id === peek.entry.id) ?? null : null;
  const ctx: CapabilityCtx = { kind, actions, targets, session, instance, sessionKey, localTools, mobile, data, setData, library, setLibrary, selected, setSelected, query, setQuery, loading, setLoading, refreshing, saving, setSaving, error, setError, deletion, setDeletion, frame, sheet, setSheet, config, setConfig, drafts, setDrafts, configs, setConfigs, pathDraft, setPathDraft, written, setWritten, peek, setPeek, peekOpen, setPeekOpen, generation, listRef, load, peekRef, timers, press, swallow, showPeek, hidePeek, scheduleHide, rowHandlers, waiting, catalog, savedGroup, savedLabel, savedEmpty, entries, names, groups, counts, providers, needle, hits, visible, current, scope, scopeLabel, pending, disabled, configurable, shadower, configGroup, terminal, providerConfig, sheetGroup, peekEntry, change, mutateLibrary, saveTerminal, callConfig, openConfig };
  return <div ref={rootRef} className="capabilities-panel settings-list-page" data-kind={kind} data-scope={instance ? "instance" : session ? "session" : "global"} data-layout={mobile ? "stack" : "split"} aria-busy={loading || saving}>
    <ProviderList ctx={ctx} />
    {!mobile ? <Crossfade className="settings-detail-host" layerKey={pending ? "loading" : "list"}>{pending ? <div className="capability-loading" data-status="loading"><Loader size="sm" color="gray" /></div> : waiting ? <LinkWait /> : <ProviderDetail ctx={ctx} item={current} />}</Crossfade> : null}
    <CapabilityLayers ctx={ctx} />
    <Peek peek={peek} open={peekOpen} frame={frame} onPointerEnter={() => clearTimeout(timers.current.hide)} onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleHide(); }}>
      <PeekEntry ctx={ctx} />
    </Peek>
    <Modal id={`${kind}-delete-confirm`} opened={Boolean(deletion)} onClose={() => setDeletion(null)} title="确认删除" centered size={380}>
      <Stack gap="md"><Text>{deletion?.name}</Text><Group justify="flex-end"><Button id={`${kind}-cancel-delete`} variant="default" onClick={() => setDeletion(null)}>取消</Button><Button id={`${kind}-confirm-delete`} color="red" loading={saving} onClick={() => { if (deletion) void mutateLibrary("delete", deletion); }}>删除</Button></Group></Stack>
    </Modal>
  </div>;
}
